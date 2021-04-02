declare module JitsiMeetJS {
    
    function init(options?: JitsiInitOptions): void;
    function setLogLevel(logLevel: JitsiMeetJS.logLevels): void;
    function createLocalTracks(options?: JitsiCreateLocalTracksOptions, firePermissionPromptIsShownEvent?: boolean): Promise<JitsiLocalTrack[]>;
    function isDesktopSharingEnabled(): boolean;
    
    module events {
        module conference {
            const TRACK_ADDED: string;
            const TRACK_REMOVED: string;
            const TRACK_MUTE_CHANGED: string;
            const TRACK_AUDIO_LEVEL_CHANGED: string;
            const DATA_CHANNEL_OPENED: string;
            const DOMINANT_SPEAKER_CHANGED: string;
            const USER_JOINED: string;
            const USER_LEFT: string;
            const MESSAGE_RECEIVED: string;
            const DISPLAY_NAME_CHANGED: string;
            const SUBJECT_CHANGED: string;
            const LAST_N_ENDPOINTS_CHANGED: string;
            const CONFERENCE_JOINED: string;
            const CONFERENCE_LEFT: string;
            const DTMF_SUPPORT_CHANGED: string;
            const USER_ROLE_CHANGED: string;
            const USER_STATUS_CHANGED: string;
            const CONFERENCE_FAILED: string;
            const CONFERENCE_ERROR: string;
            const KICKED: string;
            const START_MUTED_POLICY_CHANGED: string;
            const STARTED_MUTED: string;
            const CONNECTION_STATS: string;
            const BEFORE_STATISTICS_DISPOSED: string;
            const AUTH_STATUS_CHANGED: string;
            const ENDPOINT_MESSAGE_RECEIVED: string;
            const TALK_WHILE_MUTED: string;
            const NO_AUDIO_INPUT: string;
            const AUDIO_INPUT_STATE_CHANGE: string;
            const NOISY_MIC: string;
            const PARTICIPANT_PROPERTY_CHANGED: string;
            const PARTCIPANT_FEATURES_CHANGED: string;
            const MEMBERS_ONLY_CHANGED: string;
            const PROPERTIES_CHANGED: string;
            const RECORDER_STATE_CHANGED: string;
        }
        module connection {
            const CONNECTION_FAILED: string;
            const CONNECTION_ESTABLISHED: string;
            const CONNECTION_DISCONNECTED: string;
            const WRONG_STATE: string;
        }
        module detection {
            const VAD_SCORE_PUBLISHED: string;
        }
        module track {
            const LOCAL_TRACK_STOPPED: string;
            const TRACK_AUDIO_OUTPUT_CHANGED: string;
            const TRACK_AUDIO_LEVEL_CHANGED: string;
            const TRACK_MUTE_CHANGED: string;
            const TRACK_VIDEOTYPE_CHANGED: string;
        }
        module mediaDevices {
            const DEVICE_LIST_CHANGED: string;
            const PERMISSION_PROMPT_IS_SHOWN: string;
        }
        module connectionQuality {
            const LOCAL_STATS_UPDATED: string;
            const REMOTE_STATS_UPDATED: string;
        }
    }
    
    module errors {
        module conference {
            const CONNECTION_ERROR: string;
            const SETUP_FAILED: string;
            const AUTHENTICATION_REQUIRED: string;
            const PASSWORD_REQUIRED: string;
            const PASSWORD_NOT_SUPPORTED: string;
            const VIDEOBRIDGE_NOT_AVAILABLE: string;
            const RESERVATION_ERROR: string;
            const GRACEFUL_SHUTDOWN: string;
            const JINGLE_FATAL_ERROR: string;
            const CONFERENCE_DESTROYED: string;
            const CHAT_ERROR: string;
            const FOCUS_DISCONNECTED: string;
            const CONFERENCE_MAX_USERS: string;
        }
        module connection {
            const CONNECTION_DROPPED_ERROR: string;
            const PASSWORD_REQUIRED: string;
            const SERVER_ERROR: string;
            const OTHER_ERROR: string;
        }
        module track {
            const GENERAL: string;
            const UNSUPPORTED_RESOLUTION: string;
            const PERMISSION_DENIED: string;
            const NOT_FOUND: string;
            const CONSTRAINT_FAILED: string;
            const TRACK_IS_DISPOSED: string;
            const TRACK_NO_STREAM_FOUND: string;
            const SCREENSHARING_GENERIC_ERROR: string;
            const SCREENSHARING_USER_CANCELED: string;
        }
    }
    
    module mediaDevices {
        function isDeviceListAvailable(): boolean;
        function isDeviceChangeAvailable(deviceType: "input" | "output"): boolean;
        function enumerateDevices(callback: (devices: MediaDeviceInfo[]) => void): void;
        function setAudioOutputDevice(deviceId: string): void;
        function getAudioOutputDevice(): string;
        function isDevicePermissionGranted(type: "audio" | "video"): Promise<boolean>;
        function addEventListener(event: any, listener: any): void;
        function removeEventListener(event: any, listener: any): void;
    }
    
    enum logLevels {
        TRACE,
        DEBUG,
        INFO,
        LOG,
        WARN,
        ERROR,
    }
    
    interface JitsiConnectionOptions {
        hosts: {
            domain: string;
            muc: string;
        };
        serviceUrl: string;
    }
    
    interface JitsiInitOptions {
        // useIPv6 - boolean property
        // disableAudioLevels - boolean property. Enables/disables audio levels.
        // disableSimulcast - boolean property. Enables/disables simulcast.
        // enableWindowOnErrorHandler - boolean property (default false). Enables/disables attaching global onerror handler (window.onerror).
        // disableThirdPartyRequests - if true - callstats will be disabled and the callstats API won't be included.
        // enableAnalyticsLogging - boolean property (default false). Enables/disables analytics logging.
        // externalStorage - Object that implements the Storage interface. If specified this object will be used for storing data instead of localStorage.
        // callStatsCustomScriptUrl - (optional) custom url to access callstats client script
        // disableRtx - (optional) boolean property (default to false). Enables/disable the use of RTX.
        // disableH264 - (optional) boolean property (default to false). If enabled, strips the H.264 codec from the local SDP.
        // preferH264 - (optional) boolean property (default to false). Enables/disable preferring the first instance of an h264 codec in an offer by moving it to the front of the codec list.
        [key: string]: any;
    }
    
    interface JitsiInitConferenceOptions {
        // openBridgeChannel - Enables/disables bridge channel. Values can be "datachannel", "websocket", true (treat it as "datachannel"), undefined (treat it as "datachannel") and false (don't open any channel). NOTE: we recommend to set that option to true
        // recordingType - the type of recording to be used
        // callStatsID - callstats credentials
        // callStatsSecret - callstats credentials
        // enableTalkWhileMuted - boolean property. Enables/disables talk while muted detection, by default the value is false/disabled.
        // ignoreStartMuted - ignores start muted events coming from jicofo.
        // startSilent - enables silent mode, will mark audio as inactive will not send/receive audio
        // confID - Used for statistics to identify conference, if tenants are supported will contain tenant and the non lower case variant for the room name.
        // siteID - (optional) Used for statistics to identify the site where the user is coming from, if tenants are supported it will contain a unique identifier for that tenant. If not provided, the value will be infered from confID
        // statisticsId - The id to be used as stats instead of default callStatsUsername.
        // statisticsDisplayName - The display name to be used for stats, used for callstats.
        [key: string]: any;
    }
    
    interface JitsiCreateLocalTracksOptions {
        devices?: ("desktop"|"video"|"audio")[];
        resolution?: any;
        constraints?: any;
        cameraDeviceId?: string;
        micDeviceId?: string;
        minFps?: number;
        maxFps?: number;
        facingMode?: "user" | "environment";
    }
    
    class JitsiConnection {
        constructor(appId: string, token: string, options: JitsiConnectionOptions);
        connect(options?: { id: string, password: string }): void;
        disconnect(): void;
        initJitsiConference(roomName: string, options: JitsiInitConferenceOptions): JitsiConference;
        addEventListener(event: any, listener: any): void;
        removeEventListener(event: any, listener: any): void;
    }
    
    class ChatRoom {
        locked: boolean;
    }
    
    class JitsiConference {
        join(password?: string): void;
        leave(): Promise<void>;
        myUserId(): string;
        getLocalTracks(): JitsiTrack[];
        getLocalAudioTrack(): JitsiLocalTrack;
        getLocalVideoTrack(): JitsiLocalTrack;
        addEventListener(event: any, listener: any): void;
        removeEventListener(event: any, listener: any): void;
        on(event: any, listener: any): void;
        off(event: any, listener: any): void;
        sendTextMessage(text: string): void;
        setDisplayName(name: string): void;
        selectParticipant(participantId: string): void;
        sendCommand(cmd: string, values: { value: any, attributes: Object, children: Array<any> }): void;
        sendCommandOnce(cmd: string, values: { value: any, attributes: Object, children: Array<any> }): void;
        removeCommand(cmd: string): void;
        addCommandListener(cmd: string, handler: any): void;
        removeCommandListener(cmd: string): void;
        addTrack(localTrack: JitsiLocalTrack): Promise<void>;
        removeTrack(localTrack: JitsiLocalTrack): Promise<void>;
        replaceTrack(oldLocalTrack: JitsiLocalTrack, newLocalTrack: JitsiLocalTrack): Promise<void>;
        isDTMFSupported(): boolean;
        getRole(): "moderator" | "none";
        isModerator(): boolean;
        lock(password: string): Promise<void>;
        unlock(): Promise<void>;
        setSubject(subject: string): void;
        isE2EESupported(): boolean;
        toggleE2EE(isEnabled: boolean): boolean;
        _isE2EEEnabled(): boolean;
        setVideoFrameSignatureVerificationRatioInverse: (videoFrameSignatureVerificationRatioInverse: number) => void;
        room: ChatRoom;
    }
    
    class JitsiTrack {
        containers: HTMLElement[];
        audioLevel: number;
        videoType: "camera" | "desktop";
        getType(): "audio" | "video";
        isMuted(): boolean;
        attach(container: HTMLElement): void;
        detach(container: HTMLElement): void;
        getId(): string;
        setAudioOutput(deviceId: string): void;
        isEnded(): boolean;
        setEffect(effect: any): void;
        isLocal(): boolean;
        addEventListener(event: any, listener: any): void;
        removeEventListener(event: any, listener: any): void;
        on(event: any, listener: any): void;
        off(event: any, listener: any): void;
        getParticipantId(): string;
    }
    
    class JitsiLocalTrack extends JitsiTrack {
        mute(): Promise<void>;
        unmute(): Promise<void>;
        dispose(): Promise<void>;
        getDeviceId(): string;
        stream: MediaStream;
    }
    
    class JitsiRemoteTrack extends JitsiTrack {
        getParticipantId(): string;
    }
    
    enum ParticipantConnectionStatus {
        ACTIVE = "active",
        INACTIVE = "inactive",
        INTERRUPTED = "interrupted",
        RESTORING = "restoring",
    }
    
    class JitsiParticipant {
        _id: string;
        _displayName: string;
        _tracks: JitsiTrack[];
        _role: "none" | "moderator";
        _hidden : boolean;
        _connectionStatus: ParticipantConnectionStatus;
        _properties: { [key: string]: any };
    }
    
    interface ConferenceStats {
        bandwidth?: {
            download?: number;
            upload?: number;
        };
        bitrate?: {
            video?: {
                download?: number;
                upload?: number;
            };
            audio?: {
                download?: number;
                upload?: number;
            };
            download?: number;
            upload?: number;
        };
        packetLoss?: {
            download?: number;
            upload?: number;
        };
        jvbRTT?: number;
        e2ePing?: number;
        connectionQuality?: number;
        maxEnabledResolution?: number;
    }
    
}
