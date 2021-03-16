export enum VideoConferenceState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    DISCONNECTING = "disconnecting",
}

export interface VideoConferenceConfiguration {
    domain: string;
    appId: string;
    token: string;
    
    hashmail: string;
    
    conferenceId: string;
    conferencePassword: string;
    conferenceEncryptionKey: string;
    conferenceEncryptionIV: string;
    
}

export type VideoConferenceConnectionLostReason = "connectingFailed" | "connectionLost" | "disconnected";

export interface VideoConferenceTrack {
    containers: HTMLElement[];
    audioLevel: number;
    getType(): "audio" | "video";
    isMuted(): boolean;
    attach(container: HTMLElement): void;
    detach(container: HTMLElement): void;
    getId(): string;
    setAudioOutput(deviceId: string): void;
    isEnded(): boolean;
    setEffect(effect: any): void;
    isLocal(): boolean;
    getParticipantId(): string;
}

export interface VideoConferenceParticipant<T> {
    id: string;
    hashmail: string;
    e2ee: {
        supports: boolean;
        enabled: boolean;
        hasKey: boolean;
        hasSignatureKey: boolean;
    };
    isTalking: boolean;
    _participant: T;
}
