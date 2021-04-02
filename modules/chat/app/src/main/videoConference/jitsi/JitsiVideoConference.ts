import { Q, window } from "pmc-web";
import { AvailableDevices, VideoConference, VideoConferenceOptions } from "../VideoConference";
import { VideoConferenceState, VideoConferenceParticipant, VideoConferenceConnectionLostReason, VideoConferenceConnectionOptions } from "../Types";
import * as Types from "../Types";
import { SpecLogger } from "./SpecLogger";
import { DominantSpeakerService } from "./DominantSpeakerService";
import { VideoResolutions } from "./VideoResolutions";


enum JitsiParticipantProperty {
    E2EEENABLED = "e2eeEnabled",
    E2EE = "features_e2ee",
    E2EE_KEY = "e2ee.idKey",
    E2EE_SIGNATUREKEY = "e2ee.signatureKey",
}

type VideoTrackSource = "camera" | "desktop";
type VideoTrackType = VideoTrackSource;

export class JitsiVideoConference extends VideoConference {
    
    static readonly ENABLE_E2EE: boolean = true;
    static readonly ENABLE_E2E_PING: boolean = true;
    
    protected enableE2EE: boolean = JitsiVideoConference.ENABLE_E2EE;
    protected connection: JitsiMeetJS.JitsiConnection = null;
    protected conference: JitsiMeetJS.JitsiConference = null;
    protected localDesktopTrack: JitsiMeetJS.JitsiLocalTrack = null;
    protected localVideoTrack: JitsiMeetJS.JitsiLocalTrack = null;
    protected localAudioTrack: JitsiMeetJS.JitsiLocalTrack = null;
    protected remoteVideoTracks: { [participantId: string]: JitsiMeetJS.JitsiRemoteTrack } = {};
    protected remoteAudioTracks: { [participantId: string]: JitsiMeetJS.JitsiRemoteTrack } = {};
    protected localParticipant: VideoConferenceParticipant<null> = null;
    protected participants: { [participantId: string]: VideoConferenceParticipant<JitsiMeetJS.JitsiParticipant> } = {};
    protected uniqueConnectionId: string = null;
    protected dominantSpeakerService: DominantSpeakerService = new DominantSpeakerService();
    
    constructor(options: VideoConferenceOptions) {
        super(options);
        JitsiVideoConference.initJitsi();
        JitsiMeetJS.mediaDevices.addEventListener(JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED, () => {
            this.refreshDevicesList();
        });
        this.dominantSpeakerService.addOnUpdateHandler(this._onDominantSpeakerChanged.bind(this));
    }
    
    isE2EEEnabled(): boolean {
        return this.enableE2EE;
    }
    
    updateE2EEEnabled(options: Types.VideoConferenceOptions): void {
        this.enableE2EE = JitsiVideoConference.ENABLE_E2EE && !options.experimentalH264;
    }
    
    
    
    
    
    /*****************************************
    ******* Connection and conferences *******
    *****************************************/
    connect(connectionOptions: VideoConferenceConnectionOptions): Q.Promise<void> {
        const { configuration, tmpUserName, tmpUserPassword, options } = connectionOptions;
        this.updateE2EEEnabled(options);
        let uniqueConnectionId = Math.random().toString(36).substr(2);
        console.log("%c " + uniqueConnectionId, "color:#00ff00;")
        this.uniqueConnectionId = uniqueConnectionId;
        
        this.localParticipant = null;
        this.participants = {};
        this.configuration = configuration;
        
        let creatingConference = !!(tmpUserName && tmpUserPassword);
        
        // Check state, set new state
        if (this.state != VideoConferenceState.DISCONNECTED) {
            console.log("%c " + this.state, "color:#ff0000;")
            return Q.reject("JitsiVideoConference.connect(): wrong state (1)");
        }
        this.setState(VideoConferenceState.CONNECTING);
        
        let encryptedLocalParticipantName: string;
        return Q().then(() => {
            if (this.state != VideoConferenceState.CONNECTING) {
                throw "JitsiVideoConference.connect(): wrong state (2)";
            }
            if (this.uniqueConnectionId != uniqueConnectionId) throw "Connecting cancelled due to a new connection attempt";
            return this.encryptParticipantName(this.configuration.hashmail);
        })
        .then(_encryptedLocalParticipantName => {
            if (this.state != VideoConferenceState.CONNECTING) {
                throw "JitsiVideoConference.connect(): wrong state (3)";
            }
            if (this.uniqueConnectionId != uniqueConnectionId) throw "Connecting cancelled due to a new connection attempt";
            encryptedLocalParticipantName = _encryptedLocalParticipantName;
            
            let connectedDeferred = Q.defer<void>();
            
            // Create connection and create event listeners
            this.connection = new JitsiMeetJS.JitsiConnection(this.configuration.appId, this.configuration.token, {
                hosts: <any>{
                    anonymousdomain: `guest.${this.configuration.domain}`,
                    domain: this.configuration.domain,
                    muc: `conference.${this.configuration.domain}`,
                },
                serviceUrl: `https://${this.configuration.domain}/http-bind`,
            });
            this.connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, (...args: any[]) => {
                connectedDeferred.resolve();
            });
            this.connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, (...args: any[]) => {
                this._onConnectionLost("connectingFailed", "JitsiMeetJS.events.connection.CONNECTION_FAILED");
                connectedDeferred.reject("JitsiVideoConference.connect(): connection failed (JitsiMeetJS.events.connection.CONNECTION_FAILED)");
            });
            this.connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED, () => {
                this._onConnectionLost("connectionLost", "JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED");
            });
            this.connection.addEventListener(JitsiMeetJS.errors.connection.SERVER_ERROR, () => {
                this._onConnectionLost("connectionLost", "JitsiMeetJS.errors.connection.SERVER_ERROR");
            });
            this.connection.addEventListener(JitsiMeetJS.errors.connection.CONNECTION_DROPPED_ERROR, () => {
                this._onConnectionLost("connectionLost", "JitsiMeetJS.errors.connection.CONNECTION_DROPPED_ERROR");
            });
            let ee = (<any>this.connection).xmpp.eventEmitter;
            let orig = ee.emit.bind(ee);
            ee.emit = (...args: any[]) => {
                (<any>SpecLogger.log)(...args);
                return orig(...args);
            };
            
            // Connect
            if (creatingConference) {
                this.connection.connect({
                    id: tmpUserName,
                    password: tmpUserPassword,
                });
            }
            else {
                this.connection.connect();
            }
            
            return connectedDeferred.promise;
        })
        .then(() => {
            if (this.state != VideoConferenceState.CONNECTING) {
                throw "JitsiVideoConference.connect(): wrong state (4)";
            }
            if (this.uniqueConnectionId != uniqueConnectionId) throw "Connecting cancelled due to a new connection attempt";
            let joinedDeferred = Q.defer<void>();
            
            // Join the conference and create event listeners
            this.conference = this.connection.initJitsiConference(this.configuration.conferenceId, {
                openBridgeChannel: "websocket",
                p2p: {
                    enabled: false,
                    // enabled: true,
                    // stunServers: [
                    //     `stun:${this.configuration.domain}:3478`,
                    //     `stun:${this.configuration.domain}:443`,
                    // ],
                },
                e2eping: {
                    pingInterval: JitsiVideoConference.ENABLE_E2E_PING ? 10000 : -1,
                },
                videoQuality: options.experimentalH264 ? {
                    preferredCodec: "h264",
                    // preferredCodec: "vp9",
                    disabledCodec: "vp8",
                } : undefined,
            });
            if (!this.conference.isE2EESupported()) {
                throw VideoConference.ERROR_E2EE_NOT_SUPPORTED;
            }
            let ee = (<any>this.conference).eventEmitter;
            let orig = ee.emit.bind(ee);
            ee.emit = (...args: any[]) => {
                (<any>SpecLogger.log)(...args);
                return orig(...args);
            };
            {
                let ee = (<any>this.conference)._e2eEncryption._olmAdapter.eventEmitter;
                let orig = ee.emit.bind(ee);
                ee.emit = (...args: any[]) => {
                    (<any>SpecLogger.log)(...args);
                    return orig(...args);
                };
            }
            this.localParticipant = {
                id: this.conference.myUserId(),
                hashmail: this.configuration.hashmail,
                e2ee: <any>{
                    supports: false,
                    enabled: false,
                    hasKey: false,
                    hasSignatureKey: false,
                },
                isTalking: false,
                _participant: null,
            };
            // console.log(this.conference)
            //if (creatingConference)this.enableE2EE();
            this.conference.on(JitsiMeetJS.events.conference.TRACK_ADDED, this._onRemoteTrackAdded.bind(this));
            this.conference.on(JitsiMeetJS.events.conference.TRACK_REMOVED, this._onRemoteTrackRemoved.bind(this));
            this.conference.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, () => {
                this.setState(VideoConferenceState.CONNECTED);
                SpecLogger.log("JOINEDDEFERRED.RESOLVE()");
                joinedDeferred.resolve();
            });
            this.conference.on(JitsiMeetJS.events.conference.CONFERENCE_FAILED, (...args: any[]) => {
                this._onConnectionLost("connectingFailed", "JitsiMeetJS.events.conference.CONFERENCE_FAILED");
                joinedDeferred.reject("JitsiVideoConference.connect(): conference failed (JitsiMeetJS.events.conference.CONFERENCE_FAILED)");
            });
            this.conference.addEventListener(JitsiMeetJS.errors.conference.CONNECTION_ERROR, () => {
                this._onConnectionLost("connectionLost", "JitsiMeetJS.errors.conference.CONNECTION_ERROR");
            });
            this.conference.addEventListener(JitsiMeetJS.errors.conference.CONFERENCE_DESTROYED, () => {
                this._onConnectionLost("connectionLost", "JitsiMeetJS.errors.conference.CONFERENCE_DESTROYED");
            });
            this.conference.addEventListener(JitsiMeetJS.events.conference.PARTICIPANT_PROPERTY_CHANGED, this._onParticipantPropertyChanged.bind(this));
            this.conference.addEventListener(JitsiMeetJS.events.conference.PARTCIPANT_FEATURES_CHANGED, (...args: any[]) => {
                this._log("PARTCIPANT_FEATURES_CHANGED", args);
            });
            this.conference.addEventListener(JitsiMeetJS.events.conference.USER_ROLE_CHANGED, this._onParticipantRoleChanged.bind(this));
            this.conference.addEventListener(JitsiMeetJS.events.conference.USER_STATUS_CHANGED, (...args: any[]) => {
                this._log("USER_STATUS_CHANGED", args);
            });
            // this.conference.addEventListener(JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED, (...args: any[]) => {
            //     this._log("DISPLAY_NAME_CHANGED", args);
            // });
            this.conference.addEventListener(JitsiMeetJS.events.conference.USER_JOINED, this._onUserJoined.bind(this));
            this.conference.addEventListener(JitsiMeetJS.events.conference.USER_LEFT, this._onUserLeft.bind(this));
            this.conference.addEventListener(JitsiMeetJS.events.conference.DOMINANT_SPEAKER_CHANGED, (...args: any[]) => {
                this._log("DOMINANT_SPEAKER_CHANGED", args);
            });
            // this.conference.addEventListener(JitsiMeetJS.events.conference.MEMBERS_ONLY_CHANGED, (...args: any[]) => {
            //     this._log("MEMBERS_ONLY_CHANGED", args);
            // });
            this.conference.addEventListener(JitsiMeetJS.events.conference.PROPERTIES_CHANGED, (...args: any[]) => {
                this._log("PROPERTIES_CHANGED", args);
            });
            // this.conference.addEventListener(JitsiMeetJS.events.conference.RECORDER_STATE_CHANGED, (...args: any[]) => {
            //     this._log("RECORDER_STATE_CHANGED", args);
            // });
            // this.conference.addEventListener(JitsiMeetJS.events.conference.ENDPOINT_MESSAGE_RECEIVED, (... args: any[]) => {
            //     this._log("### conference.ENDPOINT_MESSAGE_RECEIVED", args);
            // });
            this.conference.addEventListener(JitsiMeetJS.events.connectionQuality.LOCAL_STATS_UPDATED, (stats: JitsiMeetJS.ConferenceStats) => {
                const localParticipant = this.getLocalParticipant();
                if (localParticipant) {
                    this.updateParticipantConnectionStats(this.localParticipant.id, stats);
                }
            });
            this.conference.addEventListener(JitsiMeetJS.events.connectionQuality.REMOTE_STATS_UPDATED, (participantId: string, stats: JitsiMeetJS.ConferenceStats) => {
                this.updateParticipantConnectionStats(participantId, stats);
            });
            this.conference.addEventListener("e2eping.e2e_rtt_changed", (participant: JitsiMeetJS.JitsiParticipant, e2ePing: number) => {
                this.updateParticipantConnectionStats(participant._id, {
                    e2ePing: e2ePing,
                });
            });
            this.conference.addEventListener(JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED, this._onTrackAudioLevelChanged.bind(this));
            this.conference.setDisplayName(encryptedLocalParticipantName);
            if (creatingConference) {
                this._log(`joining without password`);
                this.conference.join();
            }
            else {
                this._log(`joining with password '${this.configuration.conferencePassword}'`);
                this.conference.join(this.configuration.conferencePassword);
            }
            
            return joinedDeferred.promise;
        })
        // .then(() => {
        //     return Q.delay(5000);
        // })
        // .then(() => {
        //     return this._enableE2EE();
        //     return (<any>this.conference)._e2eEncryption.setEnabled(true);
        // })
        // .then(() => {
        //     return Q.delay(5000);
        // })
        // .then(() => {
        //     return this.createLocalTracks();
        // })
        .then(() => {
            if (this.state != VideoConferenceState.CONNECTED) {
                throw "JitsiVideoConference.connect(): wrong state (5)";
            }
            if (this.uniqueConnectionId != uniqueConnectionId) throw "Connecting cancelled due to a new connection attempt";
            return Q().then(() => {
                console.log("A", performance.now());
                // let olmAdapter = (<any>this.conference)._e2eEncryption._olmAdapter;
                // return this._waitUntil(() => {
                //     console.log("%c check", "color:#00ffff; font-weight:bold");
                //     for (const participant of olmAdapter._conf.getParticipants()) {
                //         console.log(`%c check partic ${participant.getId()}`, "color:#00ffff; font-weight:bold");
                //         const olmData = olmAdapter._getParticipantOlmData(participant);
                //         console.log(`%c check partic ${participant.getId()} ${olmData.session?"has":"nope"}`, "color:#00ffff; font-weight:bold");
                //         if (!olmData.session) {
                //             return false;
                //         }
                //     }
                //     return true;
                // }, 100, 5000);
            })
            .then(() => {
                console.log("B", performance.now());
                return this._enableE2EE_promised();
            })
            .then(() => {
                return Q.delay(1000);
            })
            .then(() => {
                console.log("C", performance.now());
                if (!creatingConference) {
                    return this.createLocalTracks();
                }
            })
            .then(x => {
                console.log("D", performance.now());
                // (<any>this.conference).setReceiverVideoConstraint(2160);
                // (<any>this.conference).setSenderVideoConstraint(2160);
                // setTimeout(() => {
                //     (<any>this.conference).setReceiverVideoConstraint(2160);
                //     (<any>this.conference).setSenderVideoConstraint(2160);
                // }, 10000);
                return x;
            });
        })
        .fail(e => {
            this._onConnectionLost("connectingFailed", `${e}`);
            console.error("JitsiVideoConference.connect():", e);
            throw e;
        });
    }
    
    disconnect(): Q.Promise<void> {
        this.uniqueConnectionId = null;
        SpecLogger.dump();
        // Check state, set new state
        if (this.state == VideoConferenceState.DISCONNECTED) {
            // this._onConnectionLost("disconnected");
            return Q();
        }
        this.setState(VideoConferenceState.DISCONNECTING);
        
        return this.cleanup().fin(() => {
            this.setState(VideoConferenceState.DISCONNECTED);
            // Notify
            this._onConnectionLost("disconnected", "JitsiVideoConference.disconnect()");
        })
        .fail(e => {
            console.error("JitsiVideoConference.disconnect():", e);
            throw e;
        });
    }
    
    cleanup(): Q.Promise<void> {
        return Q().then(() => {
            // Clear tracks
            if (this.conference) {
                return this.clearTracks();
            }
        })
        .then(() => {
            // Leave the conference
            if (this.conference) {
                return this.conference.leave();
            }
        })
        .then(() => {
            // Disconnect
            if (this.connection) {
                return this.connection.disconnect();
            }
        })
        .then(() => {
            // Cleanup
            this.conference = null;
            this.connection = null;
        });
    }
    
    protected _waitForConferenceEvent(eventName: string, timeout?: number, extraVerificator?: (...args: any[]) => boolean): Q.Promise<void> {
        return Q().then(() => {
            let deferred = Q.defer<void>();
            let timeoutId: number;
            if (timeout) {
                timeoutId = <any>setTimeout(() => {
                    fn();
                }, timeout);
            }
            let fn = (...args: any[]) => {
                if (extraVerificator && !extraVerificator(...args)) {
                    return;
                }
                if (timeout) {
                    clearTimeout(timeoutId);
                }
                this.conference.off(eventName, fn);
                deferred.resolve();
            };
            this.conference.on(eventName, fn);
            return deferred.promise;
        });
    }
    
    protected _waitUntil(callback: () => boolean, interval: number = 100, timeout?: number): Q.Promise<void> {
        let deferred = Q.defer<void>();
        let timeoutId: number;
        let intervalId: number;
        if (timeout) {
            timeoutId = <any>setTimeout(() => {
                deferred.resolve();
                clearInterval(intervalId);
            }, timeout);
        }
        intervalId = <any>setInterval(() => {
            if (callback()) {
                clearInterval(intervalId);
                deferred.resolve();
                if (timeout) {
                    clearTimeout(timeoutId);
                }
            }
        }, interval);
        return deferred.promise;
    }
    
    protected _areAllRemoteParticipantsE2EEReady(): boolean {
        if (this.enableE2EE) {
            for (let participantId in this.participants) {
                let participant = this.participants[participantId];
                if (!participant.e2ee.enabled || !participant.e2ee.hasKey || !participant.e2ee.hasSignatureKey || !participant.e2ee.supports) {
                    return false;
                }
            }
        }
        return true;
    }
    
    protected _enableE2EE_promised(): Q.Promise<void> {
        SpecLogger.log("TOGGLEE2EE(true)");
        return Q().then(() => {
            if (this.conference._isE2EEEnabled()) {
                return;
            }
            // this.clearRemoteTracks();
            // let prom = (<any>this.conference)._e2eEncryption.setEnabled(true);
            if (this.enableE2EE) {
                return this.conference.toggleE2EE(true);
            }
        })
        .then(() => {
            if (this.enableE2EE) {
                if (!this.conference._isE2EEEnabled()) {
                    throw "Could not enable E2EE";
                }
                (<any>this.conference).setLocalParticipantProperty("e2eeEnabled", true);
                let p = this.getParticipant(this.conference.myUserId()).e2ee;
                p.enabled = true;
                p.hasKey = true;
                p.hasSignatureKey = true;
                p.supports = true;
                this._log(`e2ee = ${this.conference._isE2EEEnabled() ? "ON" : "OFF"}`);
            }
        });
    }
    
    protected _enableE2EE(): void {
        if (this.enableE2EE) {
            SpecLogger.log("TOGGLEE2EE(true)");
            if (this.conference._isE2EEEnabled()) {
                return;
            }
            this.clearRemoteTracks();
            this.conference.toggleE2EE(true);
            if (!this.conference._isE2EEEnabled()) {
                throw "Could not enable E2EE";
            }
            (<any>this.conference).setLocalParticipantProperty("e2eeEnabled", true);
            let p = this.getParticipant(this.conference.myUserId()).e2ee;
            p.enabled = true;
            p.hasKey = true;
            p.hasSignatureKey = true;
            p.supports = true;
            this._log(`e2ee = ${this.conference._isE2EEEnabled() ? "ON" : "OFF"}`);
        }
    }
    
    protected _sendKeys(): void {
        if (this.enableE2EE) {
            let e = (<any>this.conference)._e2eEncryption;
            e._olmAdapter.updateKey(e._key).then((index:any) => {
                e._e2eeCtx.setKey(this.conference.myUserId(), e._key, index);
            });
        }
    }
    
    protected _onConnectionLost(reason: VideoConferenceConnectionLostReason, extraInfo: string): void {
        console.warn("-onconlost");
        this.stopLocalAudioLevelObserver();
        this.uniqueConnectionId = null;
        if (this.state == VideoConferenceState.DISCONNECTING) {
            return;
        }
        console.warn("do clean");
        this.cleanup().fin(() => {
            console.warn("cleaned, set stte");
            this.setState(VideoConferenceState.DISCONNECTED);
            this.onConnectionLost(reason, extraInfo);
        })
        .then(x=>console.log("Y",x))
        .fail(e=>console.error("X",e));
    }
    
    
    
    
    
    /*****************************************
    ***************** Tracks *****************
    *****************************************/
    createLocalAudioTrack(deviceId?: string): Q.Promise<void> {
        let options: JitsiMeetJS.JitsiCreateLocalTracksOptions = {
            devices: ["audio"],
            micDeviceId: deviceId ? deviceId : undefined,
        };
        return Q().then(() => {
            return JitsiMeetJS.createLocalTracks(options);
        })
        .then(tracks => {
            if (!this.conference) {
                return;
            }
            let ee = (<any>tracks[0]);
            let orig = ee.emit.bind(ee);
            ee.emit = (...args: any[]) => {
                (<any>SpecLogger.log)(...args);
                return orig(...args);
            };
            tracks[0].mute();
            setTimeout(() => {
                tracks[0].unmute(); 
            }, 1000);
            this.localAudioInputDeviceId = tracks[0].getDeviceId();
            return Q(this.addOrReplaceJitsiAudioTrack(tracks[0]));
        })
        .then(() => {
            this.onLocalAudioTrackCreated();
        })
        .catch(e => {
            this.showErrorMessage("plugin.chat.component.videoconference.error.createLocalAudioTrackFailed");
            this.disableLocalAudioInput();
        });
    }
    
    createLocalVideoTrack(deviceId?: string): Q.Promise<void> {
        const prevRes = this._previouslySetResolution;
        let options: JitsiMeetJS.JitsiCreateLocalTracksOptions = {
            devices: ["video"],
            cameraDeviceId: deviceId ? deviceId : undefined,
            constraints: {
                video: {
                    width: {
                        ideal: prevRes ? prevRes.width : VideoResolutions.DEFAULT_RESOLUTION.width,
                        min: VideoResolutions.MIN_RESOLUTION.width,
                        max: VideoResolutions.MAX_RESOLUTION.width,
                    },
                    height: {
                        ideal: prevRes ? prevRes.height : VideoResolutions.DEFAULT_RESOLUTION.height,
                        min: VideoResolutions.MIN_RESOLUTION.height,
                        max: VideoResolutions.MAX_RESOLUTION.height,
                    },
                },
            },
        };
        return Q().then(() => {
            if (!this.isLocalVideoInputEnabled) {
                return;
            }
            return JitsiMeetJS.createLocalTracks(options);
        })
        .then(tracks => {
            if (!this.conference || !this.isLocalVideoInputEnabled) {
                return;
            }
            let ee = (<any>tracks[0]);
            let orig = ee.emit.bind(ee);
            ee.emit = (...args: any[]) => {
                (<any>SpecLogger.log)(...args);
                return orig(...args);
            };
            this.localVideoInputDeviceId = tracks[0].getDeviceId();
            return this.addOrReplaceJitsiVideoTrack(tracks[0], "camera");
        })
        .then(() => {
            if (!this.isLocalVideoInputEnabled) {
                return;
            }
            this.onLocalVideoTrackCreated();
        })
        .catch(e => {
            console.log(e)
            this.showErrorMessage("plugin.chat.component.videoconference.error.createLocalVideoTrackFailed");
            this.disableLocalVideoInput();
        });
    }
    
    createLocalTracks(audioDeviceId?: string, videoDeviceId?: string): Q.Promise<void> {
        this._log("createLocalTracks", {audioDeviceId,videoDeviceId},audioDeviceId || this.localAudioInputDeviceId || undefined,videoDeviceId || this.localVideoInputDeviceId || undefined)
        return Q.all([
            this.isLocalAudioInputEnabled ? this.createLocalAudioTrack(audioDeviceId || this.localAudioInputDeviceId || undefined) : Q(),
            this.isLocalVideoInputEnabled ? this.createLocalVideoTrack(videoDeviceId || this.localVideoInputDeviceId || undefined) : Q(),
        ])
        .thenResolve(null);
    }
    
    protected _onRemoteTrackAdded(localOrRemoteTrack: JitsiMeetJS.JitsiTrack): void {
        if (localOrRemoteTrack.isLocal()) {
            return;
        }
        let track = <JitsiMeetJS.JitsiRemoteTrack>localOrRemoteTrack;
        let participantId = track.getParticipantId();
        if (!this.isParticipantReady(participantId)) {// || !this.isParticipantReady(this.conference.myUserId())) {
            this._log("IGNORING REMOTE TRACK", {participantId}, track.getType(), {
                other:JSON.parse(JSON.stringify(this.getParticipant(participantId).e2ee)),
                local:JSON.parse(JSON.stringify(this.getParticipant(this.conference.myUserId()).e2ee)),
            });
            return;
        }
        this._log("onRemoteTrackAdded", participantId, track.getType());
        if (track.getType() == "audio") {
            this.remoteAudioTracks[participantId] = track;
            this._updateIsParticipantTalking(participantId);
            this.onRemoteAudioTrackCreated(participantId);
        }
        else {
            track.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, (...args: any[]) => {
                this._log("track.LOCAL_TRACK_STOPPED", args);
            });
            track.addEventListener(JitsiMeetJS.events.track.TRACK_MUTE_CHANGED, this._onTrackMutedStatusChanged.bind(this));
            track.addEventListener(JitsiMeetJS.events.track.TRACK_VIDEOTYPE_CHANGED, (trackType: VideoTrackType) => {
                this._onTrackVideoTypeChanged(participantId, trackType);
            });
            this.dominantSpeakerService.setSpeakerIsSharingDesktop(participantId, track.videoType == "desktop");
            //track.addEventListener(JitsiMeetJS.events.track.TRACK_AUDIO_LEVEL_CHANGED, this._onTrackAudioLevelChanged.bind(this));
            let ee = (<any>track);
            let orig = ee.emit.bind(ee);
            ee.emit = (...args: any[]) => {
                (<any>SpecLogger.log)(...args);
                return orig(...args);
            };
            this.remoteVideoTracks[participantId] = track;
            this.onRemoteVideoTrackCreated(participantId);
        }
    }
    
    protected _onRemoteTrackRemoved(localOrRemoteTrack: JitsiMeetJS.JitsiTrack): void {
        if (localOrRemoteTrack.isLocal()) {
            return;
        }
        let track = <JitsiMeetJS.JitsiRemoteTrack>localOrRemoteTrack;
        let participantId = track.getParticipantId();
        this._log("onRemoteTrackRemoved", participantId, track.getType());
        if (track.videoType == "desktop") {
            this.dominantSpeakerService.setSpeakerIsSharingDesktop(participantId, false);
        }
        // console.log("%c XXX", "color:#0000ff")
        if (track.getType() == "audio") {
            if (this.remoteAudioTracks[participantId]) {
                this.onRemoteAudioTrackDeleted(participantId);
                delete this.remoteAudioTracks[participantId];
            }
        }
        else {
            if (this.remoteVideoTracks[participantId]) {
                this.onRemoteVideoTrackDeleted(participantId);
                delete this.remoteVideoTracks[participantId];
            }
        }
    }
    
    protected _onTrackMutedStatusChanged(localOrRemoteTrack: JitsiMeetJS.JitsiRemoteTrack): void {
        this._log("_onTrackMutedStatusChanged", localOrRemoteTrack.getParticipantId(), localOrRemoteTrack.getType());
        this.onTrackMutedStatusChanged(localOrRemoteTrack);
    }
    
    protected _onTrackVideoTypeChanged(participantId: string, trackType: VideoTrackType): void {
        console.log("_onTrackVideoTypeChanged", participantId, trackType);
        let isSharingDesktop = trackType == "desktop";
        this.dominantSpeakerService.setSpeakerIsSharingDesktop(participantId, isSharingDesktop);
    }
    
    protected _onTrackAudioLevelChanged(participantId: string, audioLevel: number): void {
        // this._log("_onTrackAudioLevelChanged", participantId, audioLevel);
        this.dominantSpeakerService.setSpeakerAudioLevel(participantId, audioLevel);
        this._updateIsParticipantTalking(participantId, audioLevel);
        this.onTrackAudioLevelChanged(participantId, audioLevel);
    }
    
    clearLocalAudioTrack(): Q.Promise<void> {
        if (this.localAudioTrack) {
            return Q().then(() => {
                return this.conference.removeTrack(this.localAudioTrack);
            })
            .then(() => {
                this.localAudioTrack.dispose();
                this.localAudioTrack = null;
            });
        }
        return Q();
    }
    
    clearLocalVideoTrack(): Q.Promise<void> {
        if (this.localVideoTrack) {
            return Q().then(() => {
                return this.conference.removeTrack(this.localVideoTrack);
            })
            .then(() => {
                this.localVideoTrack.dispose();
                this.localVideoTrack = null;
                this._cameraConfiguration = null;
            });
        }
        return Q();
    }
    
    clearLocalTracks(): Q.Promise<void> {
        return Q.all([
            this.clearLocalAudioTrack(),
            this.clearLocalVideoTrack(),
            this.clearLocalDesktopTrack(),
        ])
        .thenResolve(null);
    }
    
    clearRemoteAudioTracks(): void {
        for (let participantId in this.remoteAudioTracks) {
            delete this.remoteAudioTracks[participantId];
        }
    }
    
    clearRemoteVideoTracks(): void {
        for (let participantId in this.remoteVideoTracks) {
            delete this.remoteVideoTracks[participantId];
        }
    }
    
    clearRemoteTracks(): void {
        this.clearRemoteAudioTracks();
        this.clearRemoteVideoTracks();
    }
    
    clearTracks(): Q.Promise<void> {
        return Q.all([
            this.clearLocalTracks(),
            this.clearRemoteTracks(),
        ])
        .thenResolve(null);
    }
    
    private async addOrReplaceJitsiTrack(oldTrack: JitsiMeetJS.JitsiLocalTrack, newTrack: JitsiMeetJS.JitsiLocalTrack, disposeOldTrack: boolean): Promise<void> {
        if (oldTrack == newTrack) {
            return;
        }
        if (oldTrack) {
            await this.conference.replaceTrack(oldTrack, newTrack);
            if (disposeOldTrack) {
                await oldTrack.dispose();
            }
        }
        else {
            await this.conference.addTrack(newTrack);
        }
    }
    
    private async addOrReplaceJitsiAudioTrack(newAudioTrack: JitsiMeetJS.JitsiLocalTrack): Promise<void> {
        let oldAudioTrack = this.localAudioTrack;
        this.localAudioTrack = newAudioTrack;
        await this.addOrReplaceJitsiTrack(oldAudioTrack, newAudioTrack, true);
    }
    
    private async addOrReplaceJitsiVideoTrack(newVideoTrack: JitsiMeetJS.JitsiLocalTrack, newVideoTrackSource: VideoTrackSource): Promise<void> {
        let oldVideoTrack = <JitsiMeetJS.JitsiLocalTrack>this.conference.getLocalTracks().filter(track => track.getType() == "video")[0];
        let oldVideoTrackSource = this.getAttachedTrackSource(oldVideoTrack);
        let isSameSource = oldVideoTrackSource == newVideoTrackSource;
        if (newVideoTrackSource == "desktop") {
            this.localDesktopTrack = newVideoTrack;
        }
        else if (newVideoTrackSource == "camera") {
            this.localVideoTrack = newVideoTrack;
        }
        await this.addOrReplaceJitsiTrack(oldVideoTrack, newVideoTrack, isSameSource);
    }
    
    private getAttachedTrackSource(track: JitsiMeetJS.JitsiLocalTrack): VideoTrackSource {
        if (track == this.localVideoTrack) {
            return "camera";
        }
        if (track == this.localDesktopTrack) {
            return "desktop";
        }
        return null;
    }
    
    
    
    
    
    /*****************************************
    ************** Audio, video **************
    *****************************************/
    enableLocalAudioOutput(): void {
        if (this.isLocalAudioOutputEnabled) {
            return;
        }
        this.isLocalAudioOutputEnabled = true;
        this.onLocalAudioOutputEnabled();
    }
    
    disableLocalAudioOutput(): void {
        if (!this.isLocalAudioOutputEnabled) {
            return;
        }
        this.isLocalAudioOutputEnabled = false;
        this.onLocalAudioOutputDisabled();
    }
    
    enableLocalAudioInput(): Q.Promise<void> {
        if (this.isLocalAudioInputEnabled) {
            return Q.resolve();
        }
        this.isLocalAudioInputEnabled = true;
        return this.createLocalAudioTrack(this.localAudioInputDeviceId).then(() => {
            this.stopLocalAudioLevelObserver();
            if (this.isLocalAudioInputEnabled) {
                this.onLocalAudioInputEnabled();
            }
        })
        .fail(e => {
            this.isLocalAudioInputEnabled = false;
            throw e;
        });
    }
    
    disableLocalAudioInput(): void {
        if (!this.isLocalAudioInputEnabled) {
            return;
        }
        this.clearLocalAudioTrack().then(() => {
            this.onLocalAudioInputDisabled();
        });
        this.isLocalAudioInputEnabled = false;
        this.startLocalAudioLevelObserver();
    }
    
    enableLocalVideoInput(): Q.Promise<void> {
        if (this.isLocalVideoInputEnabled) {
            return Q.resolve();
        }
        this.isLocalVideoInputEnabled = true;
        
        // Hack that fixes jitsi bug
        // Jitsi bug: disposing track that was replaced causes detaching the new track
        // Hack: clear local video track when disabling desktop sharing
        if (this.localVideoTrack && this.isDesktopSharingEnabled) {
            this.onLocalVideoInputEnabled();
            return Q();
        }
        
        return this.createLocalVideoTrack(this.localVideoInputDeviceId).then(() => {
            if (this.isLocalVideoInputEnabled) {
                this.onLocalVideoInputEnabled();
            }
        })
        .fail(e => {
            this.isLocalVideoInputEnabled = false;
            throw e;
        });
    }
    
    disableLocalVideoInput(): Q.Promise<void> {
        if (!this.isLocalVideoInputEnabled) {
            return;
        }
        this.isLocalVideoInputEnabled = false;
        
        // Hack that fixes jitsi bug
        // Jitsi bug: disposing track that was replaced causes detaching the new track
        // Hack: clear local video track when disabling desktop sharing
        if (!this.isDesktopSharingEnabled) {
            this.clearLocalVideoTrack();
        }
        this.onLocalVideoInputDisabled();
    }
    
    setAudioOutputDeviceId(deviceId: string): void {
        this.localAudioOutputDeviceId = deviceId;
        JitsiMeetJS.mediaDevices.setAudioOutputDevice(deviceId);
        this.refreshDevicesList();
    }
    
    setAudioInputDeviceId(deviceId: string): void {
        if (!this.isLocalAudioInputEnabled) {
            this.isLocalAudioInputEnabled = true;
            this.onLocalAudioInputEnabled();
        }
        this.localAudioInputDeviceId = deviceId;
        this.createLocalAudioTrack(deviceId);
        this.refreshDevicesList();
    }
    
    setVideoInputDeviceId(deviceId: string): void {
        if (this.isLocalVideoInputEnabled && this.localVideoInputDeviceId == deviceId) {
            return;
        }
        if (!this.isLocalVideoInputEnabled) {
            this.localVideoInputDeviceId = deviceId;
            this.enableLocalVideoInput();
            this.refreshDevicesList();
            return;
        }
        this.localVideoInputDeviceId = deviceId;
        this.createLocalVideoTrack(deviceId);
        this.refreshDevicesList();
    }
    
    protected _updateIsParticipantTalking(participantId: string, newAudioLevel: number = null): void {
        let participant = this.getParticipant(participantId);
        if (!participant) {
            return;
        }
        let track = participant == this.localParticipant ? this.localAudioTrack : this.remoteAudioTracks[participantId];
        let audioLevel = newAudioLevel === null ? (track ? track.audioLevel : 0) : newAudioLevel;
        participant.isTalking = audioLevel > VideoConference.PARTICIPANT_TALKING_AUDIO_LEVEL_THRESHOLD;
        // if (participant == this.localParticipant) {
        //     console.log(`%c LOCAL, ${participant.isTalking}`, "color:#ff00ff;font-weight:bold;");
        // }else {
            
        //     console.log(`%c REMOT, ${participant.isTalking}`, "color:#ff00ff;font-weight:bold;");
        // }
        // console.log(`%c isaud, ${this.isParticipantAudible(participant.id)}`, "color:#ff00ff;font-weight:bold;");
    }
    
    
    
    
    
    /*****************************************
    ***************** Devices ****************
    *****************************************/
    listAvailableDevices(): Q.Promise<MediaDeviceInfo[]> {
        let devicesDeferred = Q.defer<MediaDeviceInfo[]>();
        JitsiMeetJS.mediaDevices.enumerateDevices((devices: MediaDeviceInfo[]) => {
            devicesDeferred.resolve(devices);
        });
        return devicesDeferred.promise;
    }
    
    refreshDevicesList(): Q.Promise<void> {
        return this.listAvailableDevices().then(devices => {
            this.onDevicesListChanged(devices);
        });
    }
    
    getAvailableDevices(): Q.Promise<AvailableDevices> {
        return this.listAvailableDevices().then(mediaDevices => {
            return <AvailableDevices>{
                audioOutput: mediaDevices.filter(x => x.kind == "audiooutput").map(x => ({ id: x.deviceId, name: x.label, mediaDeviceInfo: x })),
                audioInput: mediaDevices.filter(x => x.kind == "audioinput").map(x => ({ id: x.deviceId, name: x.label, mediaDeviceInfo: x })),
                videoInput: mediaDevices.filter(x => x.kind == "videoinput").map(x => ({ id: x.deviceId, name: x.label, mediaDeviceInfo: x })),
            };
        });
    }
    
    
    
    
    
    /*****************************************
    ************* Desktop sharing ************
    *****************************************/
    enableSharingDesktop(): void {
        if (this.isDesktopSharingEnabled) {
            return;
        }
        this.isDesktopSharingEnabled = true;
        this.createDesktopTrack()
        .then(() => {
            if (this.isDesktopSharingEnabled) {
                this.onDesktopSharingEnabled();
            }
        });
    }
    
    disableSharingDesktop(): void {
        if (!this.isDesktopSharingEnabled) {
            return;
        }
        this.isDesktopSharingEnabled = false;
        
        // Hack that fixes jitsi bug
        // Jitsi bug: disposing track that was replaced causes detaching the new track
        // Hack: clear local video track when disabling desktop sharing
        if (!this.isLocalVideoInputEnabled) {
            this.clearLocalVideoTrack();
        }
        
        this.clearLocalDesktopTrack().then(() => {
            if (this.localVideoTrack && this.isLocalVideoInputEnabled) {
                this.addOrReplaceJitsiVideoTrack(this.localVideoTrack, "camera");
            }
            this.onDesktopSharingDisabled();
        });
    }
    
    getLocalDesktopTrack(): JitsiMeetJS.JitsiLocalTrack {
        return this.isDesktopSharingEnabled ? this.localDesktopTrack : null;
    }
    
    clearLocalDesktopTrack(): Q.Promise<void> {
        if (this.localDesktopTrack) {
            return Q().then(() => {
                return this.conference.removeTrack(this.localDesktopTrack);
            })
            .then(() => {
                this.localDesktopTrack.dispose();
                this.localDesktopTrack = null;
            });
        }
        return Q();
    }
    
    private createDesktopTrack(): Q.Promise<void> {
        let options: JitsiMeetJS.JitsiCreateLocalTracksOptions = <any>{
            devices: ["desktop"],
            // minFps: 30,
            // maxFps: 30,
            // desktopSharingFrameRate:{
            //     min: 30,
            //     max: 30,
            // },
        };
        return Q().then(() => {
            return JitsiMeetJS.createLocalTracks(options);
        })
        .then(tracks => {
            if (!this.conference) {
                return;
            }
            return this.addOrReplaceJitsiVideoTrack(tracks[0], "desktop");
        })
        .catch(e => {
            console.log(e);
            this.showErrorMessage("plugin.chat.component.videoconference.error.createLocalDesktopTrackFailed");
            this.disableSharingDesktop();
        });
    }
    
    
    
    
    
    /*****************************************
    ************** Participants **************
    *****************************************/
    getLocalParticipant(): VideoConferenceParticipant<null> {
        return this.localParticipant;
    }
    
    getLocalParticipantId(): string {
        if (!this.conference) {
            let stackTrace: string;
            try {
                throw new Error();
            }
            catch (e) {
                stackTrace = (e as Error).stack;
            }
            throw new Error(`Video not ready: ${stackTrace}`);
        }
        return this.conference.myUserId();
    }
    
    getParticipants(): { [participantId: string]: VideoConferenceParticipant<JitsiMeetJS.JitsiParticipant> } {
        return this.participants;
    }
    
    getParticipant(participantId: string): VideoConferenceParticipant<JitsiMeetJS.JitsiParticipant> {
        if (!this.conference) {
            return null;
        }
        return this.conference.myUserId() == participantId ? this.localParticipant : this.participants[participantId];
    }
    
    isParticipantReady(participantId: string): boolean {
        let participant = this.getParticipant(participantId);
        if (!participant) {
            return false;
        }
        if (this.enableE2EE) {
            return participant.e2ee.enabled && participant.e2ee.hasKey && participant.e2ee.hasSignatureKey;
        }
        else {
            return true;
        }
        //return participant.e2ee.supports && participant.e2ee.enabled && participant.e2ee.hasKey && participant.e2ee.hasSignatureKey;
    }
    
    protected _onUserJoined(participantId: string, participant: JitsiMeetJS.JitsiParticipant): void {
        this._log("_onUserJoined", participantId);
        this.participants[participantId] = {
            id: participant._id,
            hashmail: participant._displayName,
            e2ee: {
                supports: false,
                enabled: false,
                hasKey: false,
                hasSignatureKey: false,
            },
            isTalking: false,
            _participant: participant,
        };
        this.dominantSpeakerService.setSpeaker({
            id: participantId,
            audioLevel: 0,
            isLocal: false,
            isSharingDesktop: false,
        });
        this.decryptParticipantName(participant._displayName)
        .then(hashmail => {
            if (participantId in this.participants) {
                this.participants[participantId].hashmail = hashmail;
                this.onUserJoined(participantId);
            }
        });
    }
    
    protected _onUserLeft(participantId: string): void {
        this._log("_onUserLeft", participantId);
        delete this.participants[participantId];
        this.dominantSpeakerService.removeSpeaker(participantId);
        this.onUserLeft(participantId);
    }
    
    protected _onParticipantPropertyChanged(jitsiParticipant: JitsiMeetJS.JitsiParticipant, propertyName: JitsiParticipantProperty, oldValue: any, newValue: any): void {
        this._log("PARTICIPANT_PROPERTY_CHANGED", jitsiParticipant, propertyName, oldValue, newValue);
        let participant = this.getParticipant(jitsiParticipant._id);
        if (!participant) {
            return;
        }
        if (propertyName == JitsiParticipantProperty.E2EE) {
            let isEnabled = newValue === "true" || newValue === true;
            participant.e2ee.supports = isEnabled;
        }
        else if (propertyName == JitsiParticipantProperty.E2EEENABLED) {
            let isEnabled = newValue === "true" || newValue === true;
            participant.e2ee.enabled = isEnabled;
        }
        else if (propertyName == JitsiParticipantProperty.E2EE_KEY) {
            let isEnabled = !!newValue;
            participant.e2ee.hasKey = isEnabled;
        }
        else if (propertyName == JitsiParticipantProperty.E2EE_SIGNATUREKEY) {
            let isEnabled = !!newValue;
            participant.e2ee.hasSignatureKey = isEnabled;
        }
    }
    
    protected _onParticipantRoleChanged(participantId: string, role: "none"|"moderator"): void {
        this._log("USER_ROLE_CHANGED", participantId, role);
        if (participantId == this.conference.myUserId() && role == "moderator" && !this.conference.room.locked) {
            this._log(`locking with password '${this.configuration.conferencePassword}'`);
            this.conference.lock(this.configuration.conferencePassword);
        }
    }
    
    protected _onDominantSpeakerChanged(participantId: string): void {
        this.onDominantSpeakerChanged();
    }
    
    getDominantSpeaker(): VideoConferenceParticipant<any> {
        let dominantSpeakerId = this.dominantSpeakerService.getDominantSpeakerId();
        if (!dominantSpeakerId) {
            return this.getDefaultDominantSpeaker();
        }
        let participant = this.getParticipant(dominantSpeakerId);
        return participant;
    }
    
    private getDefaultDominantSpeaker(): VideoConferenceParticipant<any> {
        let localParticipantId = this.localParticipant ? this.localParticipant.id : null;
        for (let participantId in this.participants) {
            if (localParticipantId != participantId) {
                return this.participants[participantId];
            }
        }
        return this.participants[localParticipantId];
    }
    
    updateParticipantConnectionStats(participantId: string, stats: JitsiMeetJS.ConferenceStats): void {
        this.onParticipantConnectionStatsUpdated(participantId, stats);
    }
    
    
    
    
    
    /*****************************************
    ********** Jitsi initialization **********
    *****************************************/
    static isJitsiInitialized: boolean = false;
    static initJitsi(): void {
        if (this.isJitsiInitialized) {
            return;
        }
        this.isJitsiInitialized = true;
        JitsiMeetJS.init({
            //disableAudioLevels: true,
        });
        JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.WARN);
    }
    
    
    
    
    
    /*****************************************
    ********** Camera configuration **********
    *****************************************/
    async trySetupCameraConfiguration(): Promise<void> {
        if (this.conference && this.conference.getLocalVideoTrack() && this.conference.getLocalVideoTrack().stream) {
            const localVideoTrack = this.conference.getLocalVideoTrack();
            const mediaStream = localVideoTrack.stream;
            this._cameraConfiguration = new window.videorecorder.CameraConfiguration(mediaStream, VideoResolutions.AVAILABLE_RESOLUTIONS);
            await this._cameraConfiguration.setResolution(VideoResolutions.DEFAULT_RESOLUTION);
        }
    }
    
    
    
    
    
    /*****************************************
    ****************** Misc ******************
    *****************************************/
    protected _log(...args: any[]): void {
        if (args.length > 0 && typeof(args[0]) == "string") {
            args[0] = "%c" + args[0];
            args.splice(1, 0, "background:#333; color:#fff; padding:2px;");
            console.log(...args);
        }
    }
    
    setVideoFrameSignatureVerificationRatioInverse(videoFrameSignatureVerificationRatioInverse: number): void {
        try {
            this.conference.setVideoFrameSignatureVerificationRatioInverse(videoFrameSignatureVerificationRatioInverse);
        }
        catch (e) {
            console.error("Could not set videoFrameSignatureVerificationRatioInverse", e);
        }
    }
}
