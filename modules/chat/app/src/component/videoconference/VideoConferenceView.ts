import { component, window as wnd, Q, JQuery as $, webUtils } from "pmc-web";
import { func as videoConferenceTemplate } from "./template/video-conference.html";
import { Model } from "./VideoConferenceController";
import { MessageType, VideoConference } from "../../main/videoConference/VideoConference";
import { JitsiVideoConference } from "../../main/videoConference/jitsi/JitsiVideoConference";
import { VideoConferenceConnectionLostReason, VideoConferenceConfiguration, VideoConferenceTrack, VideoConferenceState, VideoConferenceParticipant } from "../../main/videoConference/Types";
import { VideoConferenceLayoutCalculator } from "./VideoConferenceLayoutCalculator";
import { JitsiMeetScreenObtainerCallback, JitsiMeetScreenObtainerOptions } from "../../main/videoConference/jitsi/JitsiMeetScreenObtainer";
import { DesktopPickerResult, DesktopPickerView } from "../desktoppicker/DesktopPickerView";
import { GongMessagePopup } from "../gongmessagepopup/GongMessagePopup";
const Olm = require("olm");

export class VideoConferenceView extends component.base.ComponentView {
    
    // HTML elements
    $container: JQuery;
    $main: JQuery;
    $titleContainer: JQuery;
    $controlsContainer: JQuery;
    $disconnectButton: JQuery<HTMLButtonElement>;
    $disableDesktopSharingButton: JQuery<HTMLButtonElement>;
    $enableDesktopSharingButton: JQuery<HTMLButtonElement>;
    $disableLocalAudioOutputButton: JQuery<HTMLButtonElement>;
    $enableLocalAudioOutputButton: JQuery<HTMLButtonElement>;
    $disableLocalAudioInputButton: JQuery<HTMLButtonElement>;
    $enableLocalAudioInputButton: JQuery<HTMLButtonElement>;
    $disableLocalVideoInputButton: JQuery<HTMLButtonElement>;
    $enableLocalVideoInputButton: JQuery<HTMLButtonElement>;
    $toggleExtraSettingsButton: JQuery<HTMLButtonElement>;
    $resolutionCustomSelectContainer: JQuery;
    $switchModeToTilesButton: JQuery<HTMLButtonElement>;
    $switchModeToSingleSpeakerButton: JQuery<HTMLButtonElement>;
    $disableAlwaysOnTopButton: JQuery<HTMLButtonElement>;
    $enableAlwaysOnTopButton: JQuery<HTMLButtonElement>;
    $extraSettingsContainer: JQuery;
    $changeAudioOutputSelect: JQuery<HTMLSelectElement>;
    $changeAudioInputSelect: JQuery<HTMLSelectElement>;
    $changeVideoInputSelect: JQuery<HTMLSelectElement>;
    $gongButton: JQuery<HTMLButtonElement>;
    $audiosContainer: JQuery;
    $videosContainer: JQuery;
    $localAudioContainer: JQuery;
    $localVideoContainer: JQuery;
    $remoteAudiosContainer: JQuery;
    $remoteVideosContainer: JQuery;
    $desktopPickerContainer: JQuery;
    $curtain: JQuery;
    
    // Video conference
    videoConference: VideoConference;
    userContainerByParticipantId: { [participantId: string]: HTMLDivElement } = {};
    audioByParticipantId: { [participantId: string]: HTMLAudioElement } = {};
    videoByParticipantId: { [participantId: string]: HTMLVideoElement } = {};
    participantNotTalkingTimeoutByParticipantId: { [participantId: string]: number } = {};
    isTalkingWhenMutedNotificationVisible: boolean = false;
    showTalkingWhenMutedNotificationTimeout: number = null;
    lastShowTalkingWhenMutedNotificationCallTime: number = null;
    
    // Components
    notifications: component.notification.NotificationView;
    desktopPicker: DesktopPickerView;
    resolutionCustomSelect: component.customselect.CustomSelectView;
    gongMessagePopup: GongMessagePopup;
    
    // Display mode
    containersDisplayMode: "tiles" | "single-speaker" = "tiles";
    singleSpeakerModeForcedParticipantId: string = null;
    
    // Misc
    gongButtonStopAnimationTimeout: number = null;
    parent: wnd.base.BaseAppWindowView<any>;
    videoConferenceTemplate: webUtils.template.Template<Model, void, webUtils.MailClientViewHelper>;
    isDeviceSelectorOpen: boolean = false;
    
    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent);
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.desktopPicker = this.addComponent("desktopPicker", new DesktopPickerView(this));
        this.resolutionCustomSelect = this.addComponent("resolutionCustomSelect", new component.customselect.CustomSelectView(this, {}));
        this.resolutionCustomSelect.onChange(value => {
            this.onResolutionCustomSelectChange(value);
        });
        this.gongMessagePopup = new GongMessagePopup(this);
    }
    
    init(model: Model): Q.Promise<void> {
        return Q()
        .then(() => {
            this.videoConferenceTemplate = this.templateManager.createTemplate(videoConferenceTemplate);
            this.$main = this.videoConferenceTemplate.renderToJQ(model);
            this.$container.append(this.$main);
            
            // Html elements
            this.$titleContainer = this.$main.find(".title-container");
            this.$controlsContainer = this.$main.find(".controls-container");
            this.$disconnectButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='disconnect']");
            this.$disableDesktopSharingButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='disable-desktop-sharing']");
            this.$enableDesktopSharingButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='enable-desktop-sharing']");
            this.$disableLocalAudioOutputButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='disable-local-audio-output']");
            this.$enableLocalAudioOutputButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='enable-local-audio-output']");
            this.$disableLocalAudioInputButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='disable-local-audio-input']");
            this.$enableLocalAudioInputButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='enable-local-audio-input']");
            this.$disableLocalVideoInputButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='disable-local-video-input']");
            this.$enableLocalVideoInputButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='enable-local-video-input']");
            this.$toggleExtraSettingsButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='toggle-extra-settings']");
            this.$resolutionCustomSelectContainer = this.$controlsContainer.find(".resolution-custom-select-container");
            this.$switchModeToTilesButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='switch-mode-to-tiles']");
            this.$switchModeToSingleSpeakerButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='switch-mode-to-single-speaker']");
            this.$disableAlwaysOnTopButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='disable-always-on-top']");
            this.$enableAlwaysOnTopButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='enable-always-on-top']");
            this.$extraSettingsContainer = this.$controlsContainer.find(".extra-settings-container");
            this.$changeAudioOutputSelect = <JQuery<HTMLSelectElement>>this.$controlsContainer.find("[data-action='change-audio-output']");
            this.$changeAudioInputSelect = <JQuery<HTMLSelectElement>>this.$controlsContainer.find("[data-action='change-audio-input']");
            this.$changeVideoInputSelect = <JQuery<HTMLSelectElement>>this.$controlsContainer.find("[data-action='change-video-input']");
            this.$gongButton = <JQuery<HTMLButtonElement>>this.$controlsContainer.find("[data-action='videoconference-gong']");
            this.$audiosContainer = this.$main.find(".audios-container");
            this.$videosContainer = this.$main.find(".videos-container");
            this.$localAudioContainer = this.$audiosContainer.find(".local-audio-container");
            this.$localVideoContainer = this.$videosContainer.find(".local-video-container");
            this.$remoteAudiosContainer = this.$audiosContainer.find(".remote-audios-container");
            this.$remoteVideosContainer = this.$videosContainer.find(".remote-videos-container");
            this.$desktopPickerContainer = this.$main.find(".desktop-picker-container");
            this.$curtain = this.$main.find(".curtain");
            
            // Events
            this.$disconnectButton.on("click", this.onDisconnectButtonClick.bind(this));
            this.$disableDesktopSharingButton.on("click", this.onDisableDesktopSharingButtonClick.bind(this));
            this.$enableDesktopSharingButton.on("click", this.onEnableDesktopSharingButtonClick.bind(this));
            this.$enableLocalAudioOutputButton.on("click", this.onEnableLocalAudioOutputButtonClick.bind(this));
            this.$disableLocalAudioOutputButton.on("click", this.onDisableLocalAudioOutputButtonClick.bind(this));
            this.$enableLocalAudioInputButton.on("click", this.onEnableLocalAudioInputButtonClick.bind(this));
            this.$disableLocalAudioInputButton.on("click", this.onDisableLocalAudioInputButtonClick.bind(this));
            this.$enableLocalVideoInputButton.on("click", this.onEnableLocalVideoInputButtonClick.bind(this));
            this.$disableLocalVideoInputButton.on("click", this.onDisableLocalVideoInputButtonClick.bind(this));
            this.$toggleExtraSettingsButton.on("click", this.onToggleExtraSettingsButtonClick.bind(this));
            // this.$toggleExtraSettingsButton.on("contextmenu", this.onToggleExtraSettingsButtonRightClick.bind(this));
            this.$switchModeToTilesButton.on("click", this.onSwitchModeToTilesButtonClick.bind(this));
            this.$switchModeToSingleSpeakerButton.on("click", this.onSwitchModeToSingleSpeakerButtonClick.bind(this));
            this.$disableAlwaysOnTopButton.on("click", this.onDisableAlwaysOnTopClick.bind(this));
            this.$enableAlwaysOnTopButton.on("click", this.onEnableAlwaysOnTopClick.bind(this));
            this.$changeAudioOutputSelect.on("change", this.onChangeAudioOutputSelectChange.bind(this));
            this.$changeAudioInputSelect.on("change", this.onChangeAudioInputSelectChange.bind(this));
            this.$changeVideoInputSelect.on("change", this.onChangeVideoInputSelectChange.bind(this));
            this.$gongButton.on("click", this.onGongButtonClick.bind(this));
            this.$main.on("click", "button[data-action='message-box-ok']", () => this.hideMessageOverlay());
            this.$main.on("click", ".user-container", this.onUserContainerClick.bind(this));
        })
        .then(() => {
            this.videoConference = new JitsiVideoConference({
                configuration: null,
                onDevicesListChanged: this.onDevicesListChanged.bind(this),
                onConnectionLost: this.onConnectionLost.bind(this),
                onUserJoined: this.onUserJoined.bind(this),
                onUserLeft: this.onUserLeft.bind(this),
                onDominantSpeakerChanged: this.onDominantSpeakerChanged.bind(this),
                onDesktopSharingEnabled: this.onDesktopSharingEnabled.bind(this),
                onLocalAudioTrackCreated: this.onLocalAudioTrackCreated.bind(this),
                onLocalVideoTrackCreated: this.onLocalVideoTrackCreated.bind(this),
                onRemoteAudioTrackCreated: this.onRemoteAudioTrackCreated.bind(this),
                onRemoteVideoTrackCreated: this.onRemoteVideoTrackCreated.bind(this),
                onRemoteAudioTrackDeleted: this.onRemoteAudioTrackDeleted.bind(this),
                onRemoteVideoTrackDeleted: this.onRemoteVideoTrackDeleted.bind(this),
                onDesktopSharingDisabled: this.onDesktopSharingDisabled.bind(this),
                onLocalAudioOutputEnabled: this.onLocalAudioOutputEnabled.bind(this),
                onLocalAudioOutputDisabled: this.onLocalAudioOutputDisabled.bind(this),
                onLocalAudioInputEnabled: this.onLocalAudioInputEnabled.bind(this),
                onLocalAudioInputDisabled: this.onLocalAudioInputDisabled.bind(this),
                onLocalVideoInputEnabled: this.onLocalVideoInputEnabled.bind(this),
                onLocalVideoInputDisabled: this.onLocalVideoInputDisabled.bind(this),
                onTrackMutedStatusChanged: this.onTrackMutedStatusChanged.bind(this),
                onTrackAudioLevelChanged: this.onTrackAudioLevelChanged.bind(this),
                requestShowMessage: this.showMessage.bind(this),
            });
        })
        .then(() => {
            this.notifications.$container = this.$container.find(".notifications-container");
            return this.notifications.triggerInit();
        })
        .then(() => {
            this.desktopPicker.$container = this.$desktopPickerContainer;
            return this.desktopPicker.triggerInit();
        })
        .then(() => {
            this.resolutionCustomSelect.$container = this.$resolutionCustomSelectContainer;
            return this.resolutionCustomSelect.triggerInit();
        })
        .then(() => {
            if ((<any>window).ResizeObserver) {
                let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                    this.onContainerSizeChanged();
                });
                resizeObserver.observe(this.$container[0]);
            }
        });
    }
    
    disconnect(): Q.Promise<void> {
        if (this.videoConference.getState() == VideoConferenceState.DISCONNECTED) {
            this.onConnectionLost("connectingFailed");
            return Q();
        }
        else {
            return this.videoConference.disconnect();
        }
    }
    
    connect(configurationStr: string, tmpUserName?: string, tmpUserPassword?: string): Q.Promise<boolean> {
        console.log("%c connect()", "color:#0000ff")
        this.userContainerByParticipantId = {};
        this.audioByParticipantId = {};
        this.videoByParticipantId = {};
        let configuration: VideoConferenceConfiguration = JSON.parse(configurationStr);
        (<any>window).$ = $;
        return Q().then(() => {
            if (!(<any>window).privmxOlmInitialized) {
                this.initJitsiMeetScreenObtainer();
                return Olm.init();
            }
        })
        .then(() => {
            (<any>window).privmxOlmInitialized = true;
            if (configuration.conferenceEncryptionKey) {
                return this.videoConference.setEncryptionKey(configuration.conferenceEncryptionKey);
            }
        })
        .then(() => {
            if (configuration.conferenceEncryptionIV) {
                this.videoConference.setEncryptionIV(configuration.conferenceEncryptionIV);
            }
            if (tmpUserName && tmpUserPassword) {
                return true;
            }
            return this.chooseDevices();
        })
        .then(doConnect => {
            if (doConnect) {
                return this.videoConference.connect(configuration, tmpUserName, tmpUserPassword)
                .then(() => {
                    this.triggerEvent("connected");
                })
                .then(() => {
                    if (tmpUserName && tmpUserPassword) {
                        this.chooseDevices().then(doConnect => {
                            if (doConnect) {
                                this.videoConference.createLocalTracks()
                                .then(() => {
                                    this.createLocalParticipantUserContainer();
                                });
                            }
                            else {
                                this.disconnect();
                            }
                        });
                    }
                    else {
                        this.createLocalParticipantUserContainer();
                    }
                })
                .thenResolve(doConnect);
            }
            else {
                this.triggerEvent("connectCancelled");
            }
            return doConnect;
        })
        .fail((e: any) => {
            if (e === VideoConference.ERROR_E2EE_NOT_SUPPORTED) {
                this.triggerEvent("unsupportedBrowser", e);
            }
            console.error("VideoConferenceView.connect():", e);
            throw e;
        });
    }
    
    connectAndCreateConference(configurationStr: string, tmpUserName: string, tmpUserPassword: string): Q.Promise<string> {
        return Q().then(() => {
            return this.videoConference.generateEncryptionKey();
        })
        .then(generatedEncryptionKey => {
            if (generatedEncryptionKey) {
                return this.videoConference.setEncryptionKey(generatedEncryptionKey).thenResolve(generatedEncryptionKey);
            }
        })
        .then(generatedEncryptionKey => {
            let generatedEncryptionIV = this.videoConference.generateEncryptionIv();
            this.videoConference.setEncryptionIV(generatedEncryptionIV);
            return this.connect(configurationStr, tmpUserName, tmpUserPassword).then(doConnect => {
                if (!doConnect) {
                    return JSON.stringify({
                        status: "cancelled",
                    });
                }
                return JSON.stringify({
                    status: "ok",
                    data: {
                        key: generatedEncryptionKey,
                        iv: generatedEncryptionIV,
                    },
                });
            });
        })
        .fail(e => {
            console.error(e);
            return JSON.stringify({
                status: "error",
            });
        });
        // return this.connect(configurationStr, tmpUserName, tmpUserPassword).then(() => {
        //     return this.videoConference.generateEncryptionKey();
        // })
        // .then(generatedEncryptionKey => {
        //     if (generatedEncryptionKey) {
        //         return this.videoConference.setEncryptionKey(generatedEncryptionKey).thenResolve(generatedEncryptionKey);
        //     }
        // })
        // .then(generatedEncryptionKey => {
        //     let generatedEncryptionIV = this.videoConference.generateEncryptionIv();
        //     this.videoConference.setEncryptionIV(generatedEncryptionIV);
        //     return JSON.stringify({
        //         key: generatedEncryptionKey,
        //         iv: generatedEncryptionIV,
        //     });
        // })
        // .fail(() => {
        //     return null;
        // });
    }
    
    updateConferenceMetadata(metaData: { title: string }): void {
        this.$main.find(".conference-title").text(metaData.title);
    }
    
    
    
    
    
    /*****************************************
    ***** VideoConference event handlers *****
    *****************************************/
    onDevicesListChanged(devices: MediaDeviceInfo[]): void {
        let audioOutputDevices = devices.filter(device => device.kind == "audiooutput");
        let audioInputDevices = devices.filter(device => device.kind == "audioinput");
        let videoInputDevices = devices.filter(device => device.kind == "videoinput");
        this.fillDevicesHtmlSelect(this.$changeAudioOutputSelect, audioOutputDevices, this.videoConference.getLocalAudioOutputDeviceId());
        this.fillDevicesHtmlSelect(this.$changeAudioInputSelect, audioInputDevices, this.videoConference.getLocalAudioInputDeviceId());
        this.fillDevicesHtmlSelect(this.$changeVideoInputSelect, videoInputDevices, this.videoConference.getLocalVideoInputDeviceId());
    }
    
    onConnectionLost(reason: VideoConferenceConnectionLostReason): void {
        this.userContainerByParticipantId = {};
        this.audioByParticipantId = {};
        this.videoByParticipantId = {};
        this.triggerEvent("leaveVideoConference");
        this.$remoteAudiosContainer.empty();
        this.$remoteVideosContainer.empty();
        this.$localAudioContainer.empty();
        this.$localVideoContainer.empty();
    }
    
    onUserJoined(participantId: string): void {
        this.createUserContainer(participantId);
        this.onDominantSpeakerChanged();
    }
    
    onUserLeft(participantId: string): void {
        if (this.singleSpeakerModeForcedParticipantId == participantId) {
            this.switchModeToSingleSpeaker();
        }
        this.removeUserContainer(participantId);
        this.onDominantSpeakerChanged();
    }
    
    getDominantSpeaker(): VideoConferenceParticipant<any> {
        if (this.containersDisplayMode == "single-speaker" && this.singleSpeakerModeForcedParticipantId) {
            let participant = this.videoConference.getParticipant(this.singleSpeakerModeForcedParticipantId);
            if (participant) {
                return participant;
            }
        }
        return this.videoConference.getDominantSpeaker();
    }
    
    onDominantSpeakerChanged(): void {
        let dominantSpeaker = this.getDominantSpeaker();
        let $userContainers = this.$remoteVideosContainer.find(".user-container");
        if (dominantSpeaker) {
            let participantId = dominantSpeaker.id;
            $userContainers.filter(`.user-container:not([data-participant-id='${participantId}'])`).removeClass("dominant-speaker");
            this.getUserContainer(dominantSpeaker.id).addClass("dominant-speaker");
        }
        else {
            $userContainers.find(".user-container").removeClass("dominant-speaker");
        }
        let localParticipant = this.videoConference.getLocalParticipant();
        if ($userContainers.filter(".dominant-speaker").length == 0 && localParticipant) {
            $userContainers.filter(`.user-container[data-participant-id='${localParticipant.id}']`).addClass("dominant-speaker");
        }
    }
    
    onDesktopSharingEnabled(): void {
        this.setHtmlElementData(this.$main, "desktop-sharing-enabled", "true");
        this.videoConference.getLocalDesktopTrack().attach(this.getLocalUserVideoElement()[0]);
        this.refreshTrackAvailability(this.videoConference.getLocalParticipantId());
    }
    
    onLocalAudioTrackCreated(): void {
        this.$localAudioContainer.find("audio").remove();
        let $audio: JQuery<HTMLAudioElement> = $(`<audio autoplay muted />`);
        this.$localAudioContainer.append($audio);
        this.videoConference.getLocalAudioTrack().attach($audio[0]);
        this.audioByParticipantId[this.videoConference.getLocalParticipantId()] = $audio[0];
    }
    
    onLocalVideoTrackCreated(): void {
        // this.$localVideoContainer.find("video").remove();
        // let $video: JQuery<HTMLAudioElement> = $(`<video autoplay />`);
        // this.$localVideoContainer.append($video);
        // let localParticipantId = this.videoConference.getLocalParticipant().id;
        // this.createUserContainer(localParticipantId);
        // this.onRemoteVideoTrackCreated(localParticipantId);
        // // this.videoConference.getLocalVideoTrack().attach($video[0]);
        // this._arrangeUserContainers();
        this.hideLocalVideo();
        this.updateAvailableResolutions(true)
            .then(() => { this.showLocalVideo(); })
            .catch(() => { this.showLocalVideo(); });
        let localParticipantId = this.videoConference.getLocalParticipantId();
        if (localParticipantId) {
            let $userContainer = this.getUserContainer(localParticipantId);
            if ($userContainer && $userContainer.length > 0) {
                let $video = this.getLocalUserVideoElement();
                let track = this.videoConference.getVideoTrack(localParticipantId);
                if ($video && $video.length > 0 && track) {
                    track.attach($video[0]);
                }
                return;
            }
        }
        this.createLocalParticipantUserContainer();
    }
    
    onRemoteAudioTrackCreated(participantId: string): void {
        this.$remoteAudiosContainer.find(`audio[data-participant-id='${participantId}']`).remove();
        let $audio: JQuery<HTMLAudioElement> = $(`<audio autoplay data-participant-id='${participantId}' muted />`);
        $audio[0].dataset["isMuted"] = "true";
        this.$remoteAudiosContainer.append($audio);
        let track = this.videoConference.getRemoteAudioTrack(participantId);
        this.audioByParticipantId[participantId] = $audio[0];
        track.attach($audio[0]);
        this.updateRemoteParticipantAudioLevel(participantId, track.audioLevel);
        this.refreshTrackAvailability(participantId);
    }
    
    onRemoteVideoTrackCreated(participantId: string): void {
        let $userContainer = this.getOrCreateUserContainer(participantId);
        let $video = $userContainer.find("video");
        let track = this.videoConference.getVideoTrack(participantId);
        if (track) {
            track.attach($video[0]);
        }
        this.refreshTrackAvailability(participantId);
    }
    
    onRemoteAudioTrackDeleted(participantId: string): void {
        const $audio = this.$remoteAudiosContainer.find(`audio[data-participant-id='${participantId}']`);
        let track = this.videoConference.getAudioTrack(participantId);
        if (track) {
            track.detach($audio[0]);
        }
        $audio.remove();
        delete this.audioByParticipantId[participantId];
        let userContainer = this.getUserContainer(participantId)[0];
        if (userContainer) {
            userContainer.classList.remove("is-talking");
        }
        this.refreshTrackAvailability(participantId);
    }
    
    onRemoteVideoTrackDeleted(participantId: string): void {
        let $userContainer = this.getOrCreateUserContainer(participantId);
        let $video = $userContainer.find("video");
        let track = this.videoConference.getRemoteVideoTrack(participantId);
        if (track) {
            track.detach($video[0]);
        }
        this.refreshTrackAvailability(participantId);
        delete this.videoByParticipantId[participantId];
    }
    
    onDesktopSharingDisabled(): void {
        this.setHtmlElementData(this.$main, "desktop-sharing-enabled", "false");
        if (this.videoConference.getIsLocalVideoInputEnabled()) {
            this.videoConference.getLocalVideoTrack().attach(this.getLocalUserVideoElement()[0]);
        }
        this.refreshTrackAvailability(this.videoConference.getLocalParticipantId());
    }
    
    onLocalAudioOutputEnabled(): void {
        // console.log("%c 1", "color:#fff;background:#00ff00;font-weight:bold;")
        this.setHtmlElementData(this.$main, "local-audio-output-enabled", "true");
        // console.log("%c 2", "color:#fff;background:#00ff00;font-weight:bold;")
        // this.$changeAudioOutputSelect.prop("disabled", false);
        let $audios = <JQuery<HTMLAudioElement>>this.$remoteAudiosContainer.find("audio");
        $audios.each((_, audio) => {
            // console.log("%c 3a", "color:#fff;background:#00ff00;font-weight:bold;")
            audio.muted = !this.videoConference.isParticipantAudible(audio.dataset["participantId"]);
            // console.log("%c 3b", "color:#fff;background:#00ff00;font-weight:bold;")
        });
        // console.log("%c 4", "color:#fff;background:#00ff00;font-weight:bold;")
        if (this.videoConference.getLocalParticipant()) {
            this.refreshTrackAvailability(this.videoConference.getLocalParticipantId());
        }
    }
    
    onLocalAudioOutputDisabled(): void {
        this.setHtmlElementData(this.$main, "local-audio-output-enabled", "false");
        // this.$changeAudioOutputSelect.prop("disabled", true);
        let $audios = <JQuery<HTMLAudioElement>>this.$remoteAudiosContainer.find("audio");
        $audios.each((_, audio) => {
            audio.muted = !this.videoConference.isParticipantAudible(audio.dataset["participantId"]);
        });
        if (this.videoConference.getLocalParticipant()) {
            this.refreshTrackAvailability(this.videoConference.getLocalParticipantId());
        }
    }
    
    onLocalAudioInputEnabled(): void {
        this.setHtmlElementData(this.$main, "local-audio-input-enabled", "true");
        // this.$changeAudioInputSelect.prop("disabled", false);
        this.hideTalkingWhenMutedNotification(false);
        if (this.videoConference.getLocalParticipant()) {
            this.refreshTrackAvailability(this.videoConference.getLocalParticipantId());
        }
    }
    
    onLocalAudioInputDisabled(): void {
        this.setHtmlElementData(this.$main, "local-audio-input-enabled", "false");
        // this.$changeAudioInputSelect.prop("disabled", true);
        if (this.videoConference.getLocalParticipant()) {
            this.refreshTrackAvailability(this.videoConference.getLocalParticipantId());
        }
    }
    
    onLocalVideoInputEnabled(): void {
        this.updateAvailableResolutions();
        this.setHtmlElementData(this.$main, "local-video-input-enabled", "true");
        // this.$changeVideoInputSelect.prop("disabled", false);
        if (this.videoConference.getLocalParticipant()) {
            let localParticipantId = this.videoConference.getLocalParticipant().id;
            this.refreshTrackAvailability(localParticipantId);
            let track = this.videoConference.getVideoTrack(localParticipantId);
            if (track && !this.videoConference.isLocalParticipantSharingDesktop()) {
                this.onRemoteVideoTrackCreated(localParticipantId);
            }
        }
    }
    
    onLocalVideoInputDisabled(): void {
        this.updateAvailableResolutions();
        this.setHtmlElementData(this.$main, "local-video-input-enabled", "false");
        // this.$changeVideoInputSelect.prop("disabled", true);
        if (this.videoConference.getLocalParticipant()) { // && !this.videoConference.isLocalParticipantSharingDesktop()
            this.refreshTrackAvailability(this.videoConference.getLocalParticipant().id);
        }
    }
    
    onTrackMutedStatusChanged(track: VideoConferenceTrack): void {
        let participantId = track.getParticipantId();
        if (participantId) {
            this.refreshTrackAvailability(participantId);
        }
    }
    
    onTrackAudioLevelChanged(participantId: string, audioLevel: number): void {
        if (this.videoConference.getLocalParticipant().id == participantId) {
            this.updateLocalParticipantAudioLevel(audioLevel);
        }
        else {
            this.updateRemoteParticipantAudioLevel(participantId, audioLevel);
        }
    }
    
    updateLocalParticipantAudioLevel(audioLevel: number): void {
        let isTalking = audioLevel > VideoConference.PARTICIPANT_TALKING_AUDIO_LEVEL_THRESHOLD;
        // console.log(`%c local talking  = ${isTalking}; islocalInEn=${this.videoConference.getIsLocalAudioInputEnabled()}`, "color:#ff00ff;font-weight:bold;");
        if (isTalking && !this.videoConference.getIsLocalAudioInputEnabled()) {
            this.showTalkingWhenMutedNotification();
        }
        else {
            this.hideTalkingWhenMutedNotification();
        }
        if (this.videoConference.getIsLocalAudioInputEnabled()) {
            let localParticipant = this.videoConference.getLocalParticipant();
            let userContainer = localParticipant ? <HTMLDivElement>this.getUserContainer(localParticipant.id)[0] : null;
            let audioElement = localParticipant ? this.audioByParticipantId[localParticipant.id] : null;
            if (userContainer && audioElement) {
                this._updateParticipantAudioLevel(localParticipant.id, !isTalking, audioElement, userContainer);
            }
        }
    }
    
    
    
    
    
    /*****************************************
    *********** HTML event handlers **********
    *****************************************/
    onDisconnectButtonClick(): void {
        this.videoConference.disconnect();
    }
    
    onDisableDesktopSharingButtonClick(): void {
        this.videoConference.disableSharingDesktop();
    }
    
    onEnableDesktopSharingButtonClick(): void {
        this.videoConference.enableSharingDesktop();
    }
    
    onEnableLocalAudioOutputButtonClick(): void {
        this.videoConference.enableLocalAudioOutput();
    }
    
    onDisableLocalAudioOutputButtonClick(): void {
        this.videoConference.disableLocalAudioOutput();
    }
    
    onEnableLocalAudioInputButtonClick(): void {
        this.videoConference.enableLocalAudioInput();
    }
    
    onDisableLocalAudioInputButtonClick(): void {
        this.videoConference.disableLocalAudioInput();
    }
    
    onEnableLocalVideoInputButtonClick(): void {
        this.videoConference.enableLocalVideoInput();
    }
    
    onDisableLocalVideoInputButtonClick(): void {
        this.videoConference.disableLocalVideoInput();
    }
    
    async onToggleExtraSettingsButtonClick(): Promise<void> {
        if (this.isDeviceSelectorOpen) {
            return;
        }
        try {
            this.isDeviceSelectorOpen = true;
            const mediaDevices = await this.parent.getMediaDevices({
                videoInput: true,
                audioInput: true,
                audioOutput: true,
            }, true);
            if (!mediaDevices.rawResult || !mediaDevices.rawResult.selected) {
                this.isDeviceSelectorOpen = false;
                return;
            }
            if (mediaDevices.videoInput) {
                this.videoConference.setVideoInputDeviceId(mediaDevices.videoInput);
            }
            if (mediaDevices.audioInput) {
                this.videoConference.setAudioInputDeviceId(mediaDevices.audioInput);
            }
            if (mediaDevices.audioOutput) {
                this.videoConference.setAudioOutputDeviceId(mediaDevices.audioOutput);
            }
        }
        finally {
            this.isDeviceSelectorOpen = false;
        }
    }
    
    onToggleExtraSettingsButtonRightClick(): void {
        this.$toggleExtraSettingsButton.off("contextmenu");
        const $elem = $(`
            <select style="position: fixed; left: 5px; top: 5px; z-index: 9999999;">
                <option value="1">1 / 1</option>
                <option value="5">1 / 5</option>
                <option value="25">1 / 25</option>
                <option value="100">1 / 100</option>
                <option value="250">1 / 250</option>
                <option value="1000">1 / 1000</option>
                <option value="1000000000">No frame verification</option>
            </select>
        `);
        $(document.body).append($elem);
        $elem.on("change", () => {
            const val = parseInt($elem.val() as string);
            this.setVideoFrameSignatureVerificationRatioInverse(val);
        });
    }
    
    setVideoFrameSignatureVerificationRatioInverse(videoFrameSignatureVerificationRatioInverse: number): void {
        this.videoConference.setVideoFrameSignatureVerificationRatioInverse(videoFrameSignatureVerificationRatioInverse);
    }
    
    onSwitchModeToTilesButtonClick(): void {
        this.switchModeToTiles();
    }
    
    onSwitchModeToSingleSpeakerButtonClick(): void {
        this.switchModeToSingleSpeaker();
    }
    
    onChangeAudioOutputSelectChange(): void {
        let deviceId = <string>this.$changeAudioOutputSelect.val();
        this.videoConference.setAudioOutputDeviceId(deviceId);
    }
    
    onChangeAudioInputSelectChange(): void {
        let deviceId = <string>this.$changeAudioInputSelect.val();
        this.videoConference.setAudioInputDeviceId(deviceId);
    }
    
    onChangeVideoInputSelectChange(): void {
        let deviceId = <string>this.$changeVideoInputSelect.val();
        this.videoConference.setVideoInputDeviceId(deviceId);
    }
    
    async onGongButtonClick(): Promise<void> {
        const message = await this.askForGongMessage();
        if (message === false) {
            return;
        }
        this.$gongButton.addClass("ringing");
        if (this.gongButtonStopAnimationTimeout !== null) {
            clearTimeout(this.gongButtonStopAnimationTimeout);
            this.gongButtonStopAnimationTimeout = null;
        }
        this.gongButtonStopAnimationTimeout = <any>setTimeout(() => {
            this.$gongButton.removeClass("ringing");
            this.gongButtonStopAnimationTimeout = null;
        }, 2500);
        this.triggerEvent("gong", message);
    }
    
    async askForGongMessage(): Promise<string|false> {
        return this.gongMessagePopup.show(this.$gongButton);
    }
    
    onUserContainerClick(e: MouseEvent): void {
        let $userContainer = <JQuery>$(e.currentTarget);
        let participantId = $userContainer.data("participant-id");
        if (this.containersDisplayMode == "tiles") {
            this.switchModeToSingleSpeaker(participantId);
        }
        else {
            this.switchModeToTiles();
        }
    }
    
    
    
    
    
    /*****************************************
    ****************** Users *****************
    *****************************************/
    getParticipantName(participantId: string, escapeHtml: boolean = true): string {
        let person = this.personsComponent.getPerson(this.getParticipantHashmail(participantId))
        if (!person) {
            return "";
        }
        let participantName: string = person.name ? person.name : person.username;
        if (escapeHtml) {
            participantName = this.templateManager.defaultHelper.escapeHtml(participantName);
        }
        return participantName;
    }
    
    getParticipantHashmail(participantId: string, escapeHtml: boolean = true): string {
        let participant = this.videoConference.getParticipant(participantId);
        let participantHashmail = participant ? participant.hashmail : "";
        if (escapeHtml) {
            participantHashmail = this.templateManager.defaultHelper.escapeHtml(participantHashmail);
        }
        return participantHashmail;
    }
    
    createUserContainer(participantId: string): JQuery {
        this.removeUserContainer(participantId);
        let localParticipantId = this.videoConference.getLocalParticipant().id;
        let isLocalParticipant = participantId == localParticipantId;
        let participantHashmail = this.getParticipantHashmail(participantId);
        let participantName: string = this.getParticipantName(participantId);
        let dominantSpeaker = this.videoConference.getDominantSpeaker();
        let isDominantSpeaker = dominantSpeaker && dominantSpeaker.id  == participantId;
        
        let localParticipantClass: string = isLocalParticipant ? "user-container--local-participant" : "user-container--remote-participant";
        let dominantSpeakerClass: string = isDominantSpeaker ? "dominant-speaker" : "";
        let $userContainer: JQuery = $(`
            <div class="user-container ${localParticipantClass} ${dominantSpeakerClass}" data-participant-id="${participantId}">
                <div class="user-name">
                    <canvas class="not-rendered" data-hashmail-image="${participantHashmail}" data-tooltip-trigger="${participantHashmail}" data-width="30" data-height="30" data-auto-size="true" data-auto-refresh="true"></canvas>
                    <span>${participantName}</span>
                    <i class="privmx-icon privmx-icon-chat is-talking-icon"></i>
                    <i class="fa fa-microphone-slash no-audio-info"></i>
                </div>
                <div class="no-video-info">
                    <div class="no-video-info-avatar">
                        <canvas class="not-rendered" data-hashmail-image="${participantHashmail}" data-tooltip-trigger="${participantHashmail}" data-width="100" data-height="100" data-auto-size="true" data-auto-refresh="true"></canvas>
                    </div>
                    <span>${participantName}</span>
                </div>
                <video autoplay="true" data-participant-id="${participantId}" muted />
            </div>
        `);
        this.userContainerByParticipantId[participantId] = <HTMLDivElement>$userContainer[0];
        this.videoByParticipantId[participantId] = <HTMLVideoElement>$userContainer.find("video")[0];
        this.$remoteVideosContainer.append($userContainer);
        this.refreshAvatars();
        this.refreshTrackAvailability(participantId);
        this._arrangeUserContainers();
        return $userContainer;
    }
    
    createLocalParticipantUserContainer(): void {
        let localParticipantId = this.videoConference.getLocalParticipant().id;
        let $userContainer = this.getUserContainer(localParticipantId);
        if ($userContainer.length > 0) {
            return;
        }
        let audio = this.audioByParticipantId[localParticipantId];
        this.createUserContainer(localParticipantId);
        this.audioByParticipantId[localParticipantId] = audio;
        this.onRemoteVideoTrackCreated(localParticipantId);
        // this.videoConference.getLocalVideoTrack().attach($video[0]);
        this._arrangeUserContainers();
    }
    
    removeUserContainer(participantId: string): void {
        delete this.userContainerByParticipantId[participantId];
        delete this.audioByParticipantId[participantId];
        delete this.videoByParticipantId[participantId];
        let $container = this.getUserContainer(participantId);
        $container.remove();
        if ($container.length > 0) {
            this._arrangeUserContainers();
        }
    }
    
    getUserContainer(participantId: string): JQuery {
        return this.$remoteVideosContainer.find(`.user-container[data-participant-id='${participantId}']`);
    }
    
    getOrCreateUserContainer(participantId: string): JQuery {
        let $userContainer = this.$remoteVideosContainer.find(`.user-container[data-participant-id='${participantId}']`);
        if ($userContainer.length == 0) {
            $userContainer = this.createUserContainer(participantId);
        }
        return $userContainer;
    }
    
    getLocalUserVideoElement(): JQuery {
        let localParticipantId = this.videoConference.getLocalParticipantId();
        return this.$remoteVideosContainer.find(`.user-container[data-participant-id='${localParticipantId}'] video`);
    }
    
    hideLocalVideo(): void {
        const video = this.getLocalUserVideoElement()[0];
        if (video) {
            video.style.opacity = "0";
        }
    }
    
    showLocalVideo(): void {
        const video = this.getLocalUserVideoElement()[0];
        if (video) {
            video.style.opacity = "1";
        }
    }
    
    refreshTrackAvailability(participantId: string): void {
        let $video = this.$videosContainer.find(`video[data-participant-id="${participantId}"]`);
        let $userContainer = $video.closest(".user-container");
        let participant = this.videoConference.getParticipant(participantId);
        let isLocal = this.videoConference.getLocalParticipant() == participant;
        let isLocalAndDesktopSharing = isLocal ? this.videoConference.isLocalParticipantSharingDesktop() : false;
        let videoTrack = isLocalAndDesktopSharing ? this.videoConference.getLocalDesktopTrack() : this.videoConference.getVideoTrack(participantId);
        $userContainer.toggleClass("no-video", !videoTrack || videoTrack.isMuted() || !participant || (isLocal ? (!this.videoConference.getIsLocalVideoInputEnabled() && !isLocalAndDesktopSharing) : participant._participant._tracks.indexOf(videoTrack) < 0));
        setTimeout(() => {
            let audioTrack = this.videoConference.getAudioTrack(participantId);
            $userContainer.toggleClass("no-audio", !audioTrack || !participant);
        }, 0);
    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    updateRemoteParticipantAudioLevel(participantId: string, audioLevel: number): void {
        let audioElement = this.audioByParticipantId[participantId];
        let userContainer = this.userContainerByParticipantId[participantId];
        if (audioElement && userContainer) {
            let newIsMuted = audioLevel <= VideoConference.PARTICIPANT_TALKING_AUDIO_LEVEL_THRESHOLD;
            if (!newIsMuted) {
                this._stopParticipantNotTalkingTimeout(participantId);
            }
            this._updateParticipantAudioLevel(participantId, newIsMuted, audioElement, userContainer);
        }
    }
    
    protected _updateParticipantAudioLevel(participantId: string, newIsMuted: boolean, audioElement: HTMLAudioElement, userContainer: HTMLDivElement): void {
        let prevIsMuted = audioElement.dataset["isMuted"] == "true";
        if (prevIsMuted != newIsMuted) {
            if (newIsMuted) {
                if (!(participantId in this.participantNotTalkingTimeoutByParticipantId)) {
                    this.onParticipantStopTalking(participantId, audioElement, userContainer);
                }
            }
            else {
                this.onParticipantStartTalking(participantId, audioElement, userContainer);
            }
        }
    }
    
    onParticipantStartTalking(participantId: string, audio: HTMLAudioElement, userContainer: HTMLDivElement): void {
        if (participantId != this.videoConference.getLocalParticipantId()) {
            audio.muted = !this.videoConference.isParticipantAudible(participantId);
        }
        audio.dataset["isMuted"] = "false";
        userContainer.classList.add("is-talking");
    }
    
    onParticipantStopTalking(participantId: string, audio: HTMLAudioElement, userContainer: HTMLDivElement): void {
        this._stopParticipantNotTalkingTimeout(participantId);
        this.participantNotTalkingTimeoutByParticipantId[participantId] = <any>setTimeout(() => {
            delete this.participantNotTalkingTimeoutByParticipantId[participantId];
            this._onParticipantStopTalking(participantId, audio, userContainer);
        }, VideoConference.PARTICIPANT_NOT_TALKING_DELAY);
    }
    
    protected _onParticipantStopTalking(participantId: string, audio: HTMLAudioElement, userContainer: HTMLDivElement): void {
        if (participantId != this.videoConference.getLocalParticipantId()) {
            audio.muted = !this.videoConference.isParticipantAudible(audio.dataset["participantId"]);
        }
        audio.dataset["isMuted"] = "true";
        userContainer.classList.remove("is-talking");
    }
    
    protected _stopParticipantNotTalkingTimeout(participantId: string): void {
        if (participantId in this.participantNotTalkingTimeoutByParticipantId) {
            clearTimeout(this.participantNotTalkingTimeoutByParticipantId[participantId]);
            delete this.participantNotTalkingTimeoutByParticipantId[participantId];
        }
    }
    
    showTalkingWhenMutedNotification(): void {
        let now = new Date().getTime();
        this.lastShowTalkingWhenMutedNotificationCallTime = now;
        if (this.showTalkingWhenMutedNotificationTimeout !== null) {
            return;
        }
        this.showTalkingWhenMutedNotificationTimeout = <any>setTimeout(() => {
            this.showTalkingWhenMutedNotificationTimeout = null;
            this._showTalkingWhenMutedNotification();
        }, 300);
    }
    
    hideTalkingWhenMutedNotification(delayed: boolean = true): void {
        let now = new Date().getTime();
        if (delayed && (now - this.lastShowTalkingWhenMutedNotificationCallTime <= 750)) {
            return;
        }
        if (this.showTalkingWhenMutedNotificationTimeout !== null) {
            clearTimeout(this.showTalkingWhenMutedNotificationTimeout);
            this.showTalkingWhenMutedNotificationTimeout = null;
        }
        this._hideTalkingWhenMutedNotification();
    }
    
    protected _showTalkingWhenMutedNotification(): void {
        if (this.isTalkingWhenMutedNotificationVisible) {
            return;
        }
        this.isTalkingWhenMutedNotificationVisible = true;
        this.triggerEvent("showTalkingWhenMutedNotification");
    }
    
    protected _hideTalkingWhenMutedNotification(): void {
        if (!this.isTalkingWhenMutedNotificationVisible) {
            return;
        }
        this.isTalkingWhenMutedNotificationVisible = false;
        this.triggerEvent("hideTalkingWhenMutedNotification");
    }
    
    protected _arrangeUserContainers(): void {
        const spacing = 8;
        const columnSpacing = spacing;
        const rowSpacing = spacing;
        const availableWidth = this.$remoteVideosContainer.width();
        const availableHeight = this.$remoteVideosContainer.height();
        const $userContainers = this.$remoteVideosContainer.find(".user-container[data-participant-id]");
        const nPeople = $userContainers.length;
        if (nPeople == 0) {
            return;
        }
        let { personWidth, personHeight } = VideoConferenceLayoutCalculator.calculate(nPeople, availableWidth, availableHeight, columnSpacing, rowSpacing);
        $userContainers.css({
            width: `${personWidth}px`,
            height: `${personHeight}px`,
        });
    }
    
    protected switchModeToTiles(): void {
        this.singleSpeakerModeForcedParticipantId = null;
        this.containersDisplayMode = "tiles";
        this.setHtmlElementData(this.$main, "user-containers-display-mode", "tiles");
    }
    
    protected switchModeToSingleSpeaker(singleSpeakerModeForcedParticipantId: string = null): void {
        this.singleSpeakerModeForcedParticipantId = singleSpeakerModeForcedParticipantId;
        this.containersDisplayMode = "single-speaker";
        this.setHtmlElementData(this.$main, "user-containers-display-mode", "single-speaker");
        this.onDominantSpeakerChanged();
    }
    
    
    
    
    
    /*****************************************
    **************** Overlays ****************
    *****************************************/
    showLoadingOverlay(): void {
        this.$main.toggleClass("with-loading-overlay", true);
    }
    
    hideLoadingOverlay(): void {
        this.$main.toggleClass("with-loading-overlay", false);
    }
    
    showMessageOverlay(text: string, type: string): void {
        this.$main.find(".message-overlay .message-text").text(text).attr("data-type", type);
        this.$main.toggleClass("with-message-overlay", true);
    }
    
    hideMessageOverlay(): void {
        this.$main.toggleClass("with-message-overlay", false);
    }
    
    showInitialPopupOverlay(): void {
        this.$main.toggleClass("with-initial-popup-overlay", true);
    }
    
    hideInitialPopupOverlay(): void {
        this.$main.toggleClass("with-initial-popup-overlay", false);
    }
    
    
    
    
    
    /*****************************************
    ************** Initial popup *************
    *****************************************/
    chooseDevices(): Q.Promise<boolean> {
        return Q().then(() => {
            return this.parent.getMediaDevices({
                videoInput: true,
                audioInput: true,
                audioOutput: true,
            }, false);
        })
        .then(mediaDevices => {
            let audioOutput: string | false = mediaDevices.rawResult && mediaDevices.rawResult.audioOutput === false ? false : mediaDevices.audioOutput;
            let audioInput: string | false = mediaDevices.rawResult && mediaDevices.rawResult.audioInput === false ? false : mediaDevices.audioInput;
            let videoInput: string | false = mediaDevices.rawResult && mediaDevices.rawResult.videoInput === false ? false : mediaDevices.videoInput;
            this.videoConference.configureInitialDevices(audioOutput, audioInput, videoInput);
            // console.log("%c 3b", "background:#ff0000;color:#fff;font-weight:bold")
            if (audioOutput === false || !this.videoConference.getIsLocalAudioOutputEnabled()) {
                this.onLocalAudioOutputDisabled();
            }
            else {
                this.onLocalAudioOutputEnabled();
            }
            // console.log("%c 3c", "background:#ff0000;color:#fff;font-weight:bold")
            if (audioInput === false || !this.videoConference.getIsLocalAudioInputEnabled()) {
                this.onLocalAudioInputDisabled();
            }
            else {
                this.onLocalAudioInputEnabled();
            }
            if (videoInput === false || !this.videoConference.getIsLocalVideoInputEnabled()) {
                this.onLocalVideoInputDisabled();
            }
            else {
                this.onLocalVideoInputEnabled();
            }
            // console.log("%c 4", "background:#ff0000;color:#fff;font-weight:bold")
            return true;
        });
    }
    
    
    
    
    
    /*****************************************
    **************** Messages ****************
    *****************************************/
    showMessage(i18nKey: string, type: MessageType): void {
        let message = this.i18n(i18nKey);
        this.showMessageOverlay(message, type);
    }
    
    i18n(key: string, ...args: any[]): string {
        return (<any>this.parent).i18n(key, ...args);
    }
    
    
    
    
    
    /*****************************************
    ****************** Misc ******************
    *****************************************/
    protected setHtmlElementData($element: JQuery, dataKey: string, dataValue: string): void {
        $element.data(dataKey, dataValue);
        $element.attr(`data-${dataKey}`, dataValue);
    }
    
    protected fillDevicesHtmlSelect($element: JQuery<HTMLSelectElement>, devices: MediaDeviceInfo[], selectedDeviceId?: string, withDisabledOption: boolean = false): void {
        $element.empty();
        if (!selectedDeviceId) {
            selectedDeviceId = devices[0] ? devices[0].deviceId : null;
        }
        if (withDisabledOption) {
            selectedDeviceId = devices.length > 0 ? devices[0].deviceId : "disabled";
        }
        if (withDisabledOption) {
            $element.append(`<option value="disabled" selected>${this.i18n("plugin.chat.component.videoconference.deviceSelect.disabled")}</option>`);
        }
        for (let device of devices) {
            let isSelected = selectedDeviceId == device.deviceId;
            $element.append(`<option value="${device.deviceId}" ${isSelected ? "selected" : ""}>${device.label}</option>`);
        }
    }
    
    protected onContainerSizeChanged(): void {
        this._arrangeUserContainers();
    }
    
    private initJitsiMeetScreenObtainer(): void {
        if ((<any>window).JitsiMeetScreenObtainer) {
            return;
        }
        (<any>window).JitsiMeetScreenObtainer = {
            openDesktopPicker: this.openDesktopPicker.bind(this),
        };
    }
    
    private toggleCurtain(isVisible: boolean): void {
        this.$curtain.toggleClass("visible", isVisible);
    }
    
    private showCurtain(): void {
        this.toggleCurtain(true);
    }
    
    private hideCurtain(): void {
        this.toggleCurtain(false);
    }
    
    updateControlsContainerMiniState(): void {
        const isMini = this.$container.width() < 600;
        const isWithoutAdvancedControls = this.$container.width() < 400;
        this.$titleContainer.toggleClass("mini", isMini);
        this.$controlsContainer.toggleClass("mini", isMini);
        this.$controlsContainer.toggleClass("mini--without-advanced-controls", isWithoutAdvancedControls);
    }
    
    
    
    
    
    /*****************************************
    ************* Desktop picker *************
    *****************************************/
    async openDesktopPicker(options: JitsiMeetScreenObtainerOptions, callback: JitsiMeetScreenObtainerCallback): Promise<void> {
        console.log("openDesktopPicker");
        this.showCurtain();
        this.$desktopPickerContainer.addClass("visible");
        let result: DesktopPickerResult;
        try {
            result = await this.desktopPicker.showPickerAndGetUserChoice();
        }
        finally {
            this.$desktopPickerContainer.removeClass("visible");
            this.hideCurtain();
        }
        
        if (!result) {
            this.videoConference.disableSharingDesktop();
            return;
        }
        
        try {
            callback(result.sourceId, result.sourceType, result.screenShareAudio);
        }
        catch (e) {
            console.error("Error while calling callback:", e);
        }
    }
    
    
    
    
    
    /*****************************************
    ********** Camera configuration **********
    *****************************************/
    async updateAvailableResolutions(resetCameraConfig: boolean = false): Promise<void> {
        if (resetCameraConfig) {
            await this.videoConference.clearCameraConfiguration();
        }
        let resolutions: wnd.videorecorder.VideoResolution[] = await this.getAvailableResolutions();
        this.triggerEvent("setAvailableResolutions", resolutions);
    }
    
    async onResolutionCustomSelectChange(resolutionStr: string): Promise<void> {
        if (!resolutionStr) {
            return;
        }
        const [width, height] = resolutionStr.split("x").map(x => parseInt(x));
        await this.setResolution({ width, height });
    }
    
    getAvailableResolutions(): Promise<wnd.videorecorder.VideoResolution[]> {
        return this.videoConference.getAvailableResolutions();
    }
    
    setResolution(resolution: wnd.videorecorder.VideoResolution): Promise<void> {
        return this.videoConference.setResolution(resolution);
    }
    
    
    
    
    
    /*****************************************
    ************** Always on top *************
    *****************************************/
    onEnableAlwaysOnTopClick(): void {
        this.enableAlwaysOnTop();
    }
    
    onDisableAlwaysOnTopClick(): void {
        this.disableAlwaysOnTop();
    }
    
    enableAlwaysOnTop(): void {
        this.setAlwaysOnTop(true);
    }
    
    disableAlwaysOnTop(): void {
        this.setAlwaysOnTop(false);
    }
    
    setAlwaysOnTop(alwaysOnTop: boolean): void {
        this.setHtmlElementData(this.$main, "always-on-top-enabled", alwaysOnTop ? "true" : "false");
        this.triggerEvent("setAlwaysOnTop", alwaysOnTop);
    }
}
