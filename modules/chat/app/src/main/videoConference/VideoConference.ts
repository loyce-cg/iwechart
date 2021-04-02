import { Q, webUtils, window } from "pmc-web";
import { VideoConferenceConfiguration, VideoConferenceState, VideoConferenceConnectionLostReason, VideoConferenceTrack, VideoConferenceParticipant, VideoConferenceConnectionOptions } from "./Types";
import * as Types from "./Types";

export type MessageType = "error" | "warning" | "success" | "info";

export interface AvailableDevices {
    audioOutput: AvailableDevice[];
    audioInput: AvailableDevice[];
    videoInput: AvailableDevice[];
}

export interface AvailableDevice {
    id: string;
    name: string;
    mediaDeviceInfo: MediaDeviceInfo;
}

export interface VideoConferenceOptions {
    configuration: VideoConferenceConfiguration;
    onDevicesListChanged: (devices: MediaDeviceInfo[]) => void;
    onConnectionLost: (reason: VideoConferenceConnectionLostReason, extraInfo: string) => void;
    onUserJoined: (participantId: string) => void;
    onUserLeft: (participantId: string) => void;
    onDominantSpeakerChanged: () => void;
    onDesktopSharingEnabled: () => void;
    onLocalAudioTrackCreated: () => void;
    onLocalVideoTrackCreated: () => void;
    onRemoteAudioTrackCreated: (participantId: string) => void;
    onRemoteVideoTrackCreated: (participantId: string) => void;
    onRemoteAudioTrackDeleted: (participantId: string) => void;
    onRemoteVideoTrackDeleted: (participantId: string) => void;
    onDesktopSharingDisabled: () => void;
    onLocalAudioOutputEnabled: () => void;
    onLocalAudioOutputDisabled: () => void;
    onLocalAudioInputEnabled: () => void;
    onLocalAudioInputDisabled: () => void;
    onLocalVideoInputEnabled: () => void;
    onLocalVideoInputDisabled: () => void;
    onTrackMutedStatusChanged: (track: VideoConferenceTrack) => void;
    onTrackAudioLevelChanged: (participantId: string, audioLevel: number) => void;
    onParticipantConnectionStatsUpdated: (participantId: string, stats: JitsiMeetJS.ConferenceStats) => void;
    requestShowMessage: (i18nKey: string, type: MessageType) => void;
}


export abstract class VideoConference {
    
    static readonly ENCRYPTION_ALGORITHM_KEYGEN = {
        name: "AES-GCM",
        length: 256,
    };
    static readonly ENCRYPTION_USAGES: KeyUsage[] = ["encrypt", "decrypt"];
    static readonly PARTICIPANT_TALKING_AUDIO_LEVEL_THRESHOLD: number = 0.008;
    static readonly PARTICIPANT_NOT_TALKING_DELAY: number = 1000;
    static readonly ERROR_E2EE_NOT_SUPPORTED: string = "E2EE is not supported";
    
    protected conference: any;
    protected configuration: VideoConferenceConfiguration;
    protected state: VideoConferenceState = VideoConferenceState.DISCONNECTED;
    protected localVideoTrack: VideoConferenceTrack = null;
    protected localAudioTrack: VideoConferenceTrack = null;
    protected remoteVideoTracks: { [participantId: string]: VideoConferenceTrack } = {};
    protected remoteAudioTracks: { [participantId: string]: VideoConferenceTrack } = {};
    protected onDevicesListChanged: (devices: MediaDeviceInfo[]) => void = () => {};
    protected onConnectionLost: (reason: VideoConferenceConnectionLostReason, extraInfo: string) => void = () => {};
    protected onUserJoined: (participantId: string) => void = () => {};
    protected onUserLeft: (participantId: string) => void = () => {};
    protected onDominantSpeakerChanged?: () => void = () => {};
    protected onDesktopSharingEnabled: () => void = () => {};
    protected onLocalAudioTrackCreated: () => void = () => {};
    protected onLocalVideoTrackCreated: () => void = () => {};
    protected onRemoteAudioTrackCreated: (participantId: string) => void = () => {};
    protected onRemoteVideoTrackCreated: (participantId: string) => void = () => {};
    protected onRemoteAudioTrackDeleted: (participantId: string) => void = () => {};
    protected onRemoteVideoTrackDeleted: (participantId: string) => void = () => {};
    protected onDesktopSharingDisabled: () => void = () => {};
    protected onLocalAudioOutputEnabled?: () => void = () => {};
    protected onLocalAudioOutputDisabled?: () => void = () => {};
    protected onLocalAudioInputEnabled?: () => void = () => {};
    protected onLocalAudioInputDisabled?: () => void = () => {};
    protected onLocalVideoInputEnabled?: () => void = () => {};
    protected onLocalVideoInputDisabled?: () => void = () => {};
    protected onTrackMutedStatusChanged?: (track: VideoConferenceTrack) => void = () => {};
    protected onTrackAudioLevelChanged?: (participantId: string, audioLevel: number) => void = () => {};
    protected onParticipantConnectionStatsUpdated: (participantId: string, stats: JitsiMeetJS.ConferenceStats) => void = () => {};
    protected isDesktopSharingEnabled: boolean = false;
    protected isLocalAudioOutputEnabled: boolean = true;
    protected isLocalAudioInputEnabled: boolean = true;
    protected isLocalVideoInputEnabled: boolean = true;
    protected localAudioOutputDeviceId: string = null;
    protected localAudioInputDeviceId: string = null;
    protected localVideoInputDeviceId: string = null;
    protected localParticipant: VideoConferenceParticipant<null> = null;
    protected participants: { [participantId: string]: VideoConferenceParticipant<any> } = {};
    protected requestShowMessage: (i18nKey: string, type: MessageType) => void = () => {};
    protected encryptionKey: CryptoKey;
    protected encryptionIV: Buffer;
    public localAudioLevelObserver: webUtils.AudioLevelObserver = null;
    
    
    constructor(options: VideoConferenceOptions) {
        this.configuration = options.configuration;
        // for (let k in options) {
        //     let orig: any = (<any>options)[k];
        //     (<any>options)[k] = (...args: any[]) => {
        //         console.log(k, args)
        //         orig(...args);
        //     };
        // }
        this.onDevicesListChanged = options.onDevicesListChanged;
        this.onConnectionLost = options.onConnectionLost;
        this.onUserJoined = options.onUserJoined;
        this.onUserLeft = options.onUserLeft;
        this.onDominantSpeakerChanged = options.onDominantSpeakerChanged;
        this.onDesktopSharingEnabled = options.onDesktopSharingEnabled;
        this.onLocalAudioTrackCreated = options.onLocalAudioTrackCreated;
        this.onLocalVideoTrackCreated = options.onLocalVideoTrackCreated;
        this.onRemoteAudioTrackCreated = options.onRemoteAudioTrackCreated;
        this.onRemoteVideoTrackCreated = options.onRemoteVideoTrackCreated;
        this.onRemoteAudioTrackDeleted = options.onRemoteAudioTrackDeleted;
        this.onRemoteVideoTrackDeleted = options.onRemoteVideoTrackDeleted;
        this.onDesktopSharingDisabled = options.onDesktopSharingDisabled;
        this.onLocalAudioOutputEnabled = options.onLocalAudioOutputEnabled;
        this.onLocalAudioOutputDisabled = options.onLocalAudioOutputDisabled;
        this.onLocalAudioInputEnabled = options.onLocalAudioInputEnabled;
        this.onLocalAudioInputDisabled = options.onLocalAudioInputDisabled;
        this.onLocalVideoInputEnabled = options.onLocalVideoInputEnabled;
        this.onLocalVideoInputDisabled = options.onLocalVideoInputDisabled;
        this.onTrackMutedStatusChanged = options.onTrackMutedStatusChanged;
        this.onTrackAudioLevelChanged = options.onTrackAudioLevelChanged;
        this.onParticipantConnectionStatsUpdated = options.onParticipantConnectionStatsUpdated;
        this.requestShowMessage = options.requestShowMessage;
    }
    
    abstract isE2EEEnabled(): boolean;
    
    abstract updateE2EEEnabled(options: Types.VideoConferenceOptions): void;
    
    
    
    
    
    /*****************************************
    ****************** State *****************
    *****************************************/
    getState(): VideoConferenceState {
        return this.state;
    }
    
    setState(newState: VideoConferenceState): void {
        this.state = newState;
    }
    
    
    
    
    
    
    /*****************************************
    *************** Connection ***************
    *****************************************/
    abstract connect(connectionOptions: VideoConferenceConnectionOptions): Q.Promise<void>;
    abstract disconnect(): Q.Promise<void>;
    
    
    
    
    
    /*****************************************
    ***************** Tracks *****************
    *****************************************/
    abstract createLocalTracks(audioDeviceId?: string, videoDeviceId?: string): Q.Promise<void>;
    
    getLocalAudioTrack(): VideoConferenceTrack {
        return this.localAudioTrack;
    }
    
    getLocalVideoTrack(): VideoConferenceTrack {
        return this.localVideoTrack;
    }
    
    getRemoteAudioTrack(participantId: string): VideoConferenceTrack {
        return this.remoteAudioTracks[participantId];
    }
    
    getRemoteVideoTrack(participantId: string): VideoConferenceTrack {
        return this.remoteVideoTracks[participantId];
    }
    
    getAudioTrack(participantId: string): VideoConferenceTrack {
        let localParticipantId = this.getLocalParticipant().id;
        return participantId == localParticipantId ? this.getLocalAudioTrack() : this.getRemoteAudioTrack(participantId);
    }
    
    getVideoTrack(participantId: string): VideoConferenceTrack {
        let localParticipantId = this.getLocalParticipant().id;
        return participantId == localParticipantId ? this.getLocalVideoTrack() : this.getRemoteVideoTrack(participantId);
    }
    
    
    
    
    
    /*****************************************
    ********** Audio, video, devices *********
    *****************************************/
    abstract enableLocalAudioOutput(): void;
    abstract disableLocalAudioOutput(): void;
    abstract enableLocalAudioInput(): Q.Promise<void>;
    abstract disableLocalAudioInput(): void;
    abstract enableLocalVideoInput(): Q.Promise<void>;
    abstract disableLocalVideoInput(): void;
    abstract setAudioOutputDeviceId(deviceId: string): void;
    abstract setAudioInputDeviceId(deviceId: string): void;
    abstract setVideoInputDeviceId(deviceId: string): void;
    abstract getAvailableDevices(): Q.Promise<AvailableDevices>;
    protected abstract _updateIsParticipantTalking(participantId: string, newAudioLevel?: number): void;
    
    getIsLocalAudioOutputEnabled(): boolean {
        return this.isLocalAudioOutputEnabled;
    }
    
    getIsLocalAudioInputEnabled(): boolean {
        return this.isLocalAudioInputEnabled;
    }
    
    getIsLocalVideoInputEnabled(): boolean {
        return this.isLocalVideoInputEnabled;
    }
    
    getLocalAudioOutputDeviceId(): string {
        return this.localAudioOutputDeviceId;
    }
    
    getLocalAudioInputDeviceId(): string {
        return this.localAudioInputDeviceId;
    }
    
    getLocalVideoInputDeviceId(): string {
        return this.localVideoInputDeviceId;
    }
    
    configureInitialDevices(audioOutput: string | false, audioInput: string | false, videoInput: string | false): void {
        this.isLocalAudioOutputEnabled = !!audioOutput;
        this.isLocalAudioInputEnabled = audioInput !== false;
        this.isLocalVideoInputEnabled = videoInput !== false;
        this.localAudioOutputDeviceId = audioOutput ? audioOutput : null;
        this.localAudioInputDeviceId = audioInput ? audioInput : null;
        this.localVideoInputDeviceId = videoInput ? videoInput : null;
    }
    
    startLocalAudioLevelObserver(): void {
        if (this.localAudioLevelObserver) {
            this.localAudioLevelObserver.dispose();
        }
        this.localAudioLevelObserver = new webUtils.AudioLevelObserver(this.localAudioInputDeviceId, audioLevel => {
            if (this.localParticipant && this.conference) {
                this._updateIsParticipantTalking(this.localParticipant.id, audioLevel);
                this.onTrackAudioLevelChanged(this.localParticipant.id, audioLevel);
            }
        });
    }
    
    stopLocalAudioLevelObserver(): void {
        if (this.localAudioLevelObserver) {
            this.localAudioLevelObserver.dispose();
            this.localAudioLevelObserver = null;
        }
    }
    
    
    
    
    
    /*****************************************
    ************* Desktop sharing ************
    *****************************************/
    abstract disableSharingDesktop(): void;
    abstract enableSharingDesktop(): void;
    abstract getLocalDesktopTrack(): VideoConferenceTrack;
    isLocalParticipantSharingDesktop(): boolean {
        return this.isDesktopSharingEnabled;
    }
    
    
    
    
    
    /*****************************************
    ************** Participants **************
    *****************************************/
    getLocalParticipant(): VideoConferenceParticipant<null> {
        return this.localParticipant;
    }
    
    abstract getLocalParticipantId(): string;
    
    getParticipants(): { [participantId: string]: VideoConferenceParticipant<any> } {
        return this.participants;
    }
    
    getParticipant(participantId: string): VideoConferenceParticipant<any> {
        return this.participants[participantId];
    }
    
    encryptParticipantName(participantName: string): Q.Promise<string> {
        return Q().then(() => {
            return crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: new Buffer(this.encryptionIV),
                    tagLength: 128,
                },
                this.encryptionKey,
                new Buffer(participantName)
            );
        })
        .then(arrBuff => {
            return new Buffer(arrBuff).toString("hex");
        });
    }
    
    decryptParticipantName(participantName: string): Q.Promise<string> {
        return Q().then(() => {
            return crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: this.encryptionIV,
                    tagLength: 128,
                },
                this.encryptionKey,
                Buffer.from(participantName, "hex")
            );
        })
        .then(arrBuff => {
            return new Buffer(arrBuff).toString();
        });
    }
    
    generateEncryptionKey(): Q.Promise<string> {
        return Q().then(() => {
            // console.log("crypto.subtle:",!!crypto.subtle);
            return crypto.subtle.generateKey(
                VideoConference.ENCRYPTION_ALGORITHM_KEYGEN,
                true,
                VideoConference.ENCRYPTION_USAGES
            );
        })
        .then((key: CryptoKey) => {
            return crypto.subtle.exportKey("raw", key);
        })
        .then(exportedKey => {
            return new Buffer(exportedKey).toString("hex");
        });
    }
    
    generateEncryptionIv(): string {
        return new Buffer(<Uint8Array>crypto.getRandomValues(new Uint8Array(12))).toString("hex");
    }
    
    setEncryptionKey(key: string): Q.Promise<void> {
        return Q().then(() => {
            return crypto.subtle.importKey(
                "raw",
                Buffer.from(key, "hex"),
                <any>VideoConference.ENCRYPTION_ALGORITHM_KEYGEN,
                true,
                VideoConference.ENCRYPTION_USAGES
            );
        })
        .then(importedKey => {
            this.encryptionKey = importedKey;
        });
    }
    
    setEncryptionIV(iv: string): void {
        this.encryptionIV = new Buffer(iv);
    }
    
    isParticipantAudible(participantId: string): boolean {
        let participant = this.getParticipant(participantId);
        if (!participant) {
            return false;
        }
        if (participant == this.localParticipant) {
            return this.isLocalAudioInputEnabled && participant && participant.isTalking;
        }
        else {
            return this.isLocalAudioOutputEnabled && participant && participant.isTalking;
        }
    }
    
    abstract getDominantSpeaker(): VideoConferenceParticipant<any>;
    
    
    
    
    
    
    /*****************************************
    **************** Messages ****************
    *****************************************/
    showErrorMessage(i18nKey: string): void {
        return this.showMessage(i18nKey, "error");
    }
    
    showWarningMessage(i18nKey: string): void {
        return this.showMessage(i18nKey, "warning");
    }
    
    showSuccessMessage(i18nKey: string): void {
        return this.showMessage(i18nKey, "success");
    }
    
    showInfoMessage(i18nKey: string): void {
        return this.showMessage(i18nKey, "info");
    }
    
    showMessage(i18nKey: string, type: MessageType): void {
        this.requestShowMessage(i18nKey, type);
    }
    
    
    
    
    
    /*****************************************
    ********** Camera configuration **********
    *****************************************/
    protected _cameraConfiguration: window.videorecorder.CameraConfiguration;
    protected _previouslySetResolution: window.videorecorder.VideoResolution | null = null;
    
    abstract trySetupCameraConfiguration(): Promise<void>;
    
    async getAvailableResolutions(): Promise<window.videorecorder.VideoResolution[]> {
        if (!this.isLocalVideoInputEnabled) {
            return [];
        }
        if (!this._cameraConfiguration) {
            await this.trySetupCameraConfiguration();
        }
        return this._cameraConfiguration ? this._cameraConfiguration.getAvailableResolutions() : [];
    }
    
    async setResolution(resolution: window.videorecorder.VideoResolution): Promise<void> {
        this._previouslySetResolution = JSON.parse(JSON.stringify(resolution));
        if (!this._cameraConfiguration) {
            await this.trySetupCameraConfiguration();
        }
        if (this._cameraConfiguration) {
            this._cameraConfiguration.setResolution(resolution);
        }
    }
    
    async clearCameraConfiguration(): Promise<void> {
        this._cameraConfiguration = null;
    }
    
    
    
    
    
    /*****************************************
    ****************** Misc ******************
    *****************************************/
    abstract setVideoFrameSignatureVerificationRatioInverse(videoFrameSignatureVerificationRatioInverse: number): void;
}
