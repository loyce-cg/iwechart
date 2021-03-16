import { VideoConference } from "../VideoConference";

export interface Speaker {
    id: string;
    audioLevel: number;
    isSharingDesktop: boolean;
    isLocal: boolean;
}

export type OnUpdateHandler = (dominantSpeakerId: string) => void;

export type SpeakersMap = { [id: string]: Speaker };

export class DominantSpeakerService {
    private static readonly _MIN_DELAY_BETWEEN_DOMINANT_PARTICIPANT_CHANGES_MS: number = 1000;
    
    private _onUpdateHandlers: OnUpdateHandler[] = [];
    private _speakers: { [speakerId: string]: Speaker } = {};
    private _dominantSpeakerId: string = null;
    private _lastDominantSpeakerChangeTimestamp: number = 0;
    
    constructor() {
    }
    
    getDominantSpeakerId(): string {
        return this._dominantSpeakerId;
    }
    
    addOnUpdateHandler(handler: OnUpdateHandler): void {
        this._onUpdateHandlers.push(handler);
    }
    
    removeOnUpdateHandler(handler: OnUpdateHandler): void {
        let index = this._onUpdateHandlers.indexOf(handler);
        if (index >= 0) {
            this._onUpdateHandlers.splice(index, 1);
        }
    }
    
    setSpeaker(speaker: Speaker): void {
        this._speakers[speaker.id] = speaker;
        this._updateDominantSpeaker();
    }
    
    removeSpeaker(speakerId: string): void {
        if (speakerId in this._speakers) {
            delete this._speakers[speakerId];
            this._updateDominantSpeaker();
        }
    }
    
    setSpeakerAudioLevel(speakerId: string, audioLevel: number): void {
        this._updateSpeaker(speakerId, speaker => speaker.audioLevel = audioLevel);
    }
    
    setSpeakerIsSharingDesktop(speakerId: string, isSharingDesktop: boolean): void {
        this._updateSpeaker(speakerId, speaker => speaker.isSharingDesktop = isSharingDesktop);
    }
    
    private _updateSpeaker(speakerId: string, propertyUpdater: (speaker: Speaker) => void): void {
        let speaker = this._speakers[speakerId];
        if (speaker) {
            propertyUpdater(speaker);
            this._updateDominantSpeaker();
        }
    }
    
    private _updateDominantSpeaker(): void {
        if (!this._canUpdateDominantSpeakerNow()) {
            return;
        }
        
        let newDominantSpeakerId = this._determineDominantSpeakerId();
        if (newDominantSpeakerId && newDominantSpeakerId != this._dominantSpeakerId) {
            this._dominantSpeakerId = newDominantSpeakerId;
            this._lastDominantSpeakerChangeTimestamp = Date.now();
            this._callOnUpdateHandlers();
        }
    }
    
    private _callOnUpdateHandlers(): void {
        for (let handler of this._onUpdateHandlers) {
            handler(this._dominantSpeakerId);
        }
    }
    
    private _determineDominantSpeakerId(): string {
        let remoteSpeakersWithSharedDesktop = this._getRemoteSpeakersWithSharedDesktop();
        let speakers = Object.keys(remoteSpeakersWithSharedDesktop).length > 0 ? remoteSpeakersWithSharedDesktop : this._speakers;
        let remoteSpeakerWithHighestAudioLevel: Speaker = this._getRemoteSpeakerWithHighestAudioLevel(speakers);
        if (remoteSpeakerWithHighestAudioLevel) {
            return remoteSpeakerWithHighestAudioLevel.id;
        }
        
        return null;
    }
    
    private _canUpdateDominantSpeakerNow(): boolean {
        let currentTimestamp = Date.now();
        let allowUpdateAfterTimestamp = this._lastDominantSpeakerChangeTimestamp + DominantSpeakerService._MIN_DELAY_BETWEEN_DOMINANT_PARTICIPANT_CHANGES_MS;
        return currentTimestamp >= allowUpdateAfterTimestamp;
    }
    
    private _getRemoteSpeakersWithSharedDesktop(): SpeakersMap {
        let speakersWithSharedDesktop: SpeakersMap = {};
        
        for (let speakerId in this._speakers) {
            let speaker = this._speakers[speakerId];
            if (!speaker.isLocal && speaker.isSharingDesktop) {
                speakersWithSharedDesktop[speaker.id] = speaker;
            }
        }
        
        return speakersWithSharedDesktop;
    }
    
    private _getRemoteSpeakerWithHighestAudioLevel(speakers: SpeakersMap): Speaker {
        let remoteSpeakerWithHighestAudioLevel: Speaker = null;
        
        const audioLevelThreshold = VideoConference.PARTICIPANT_TALKING_AUDIO_LEVEL_THRESHOLD;
        for (let speakerId in speakers) {
            let speaker = speakers[speakerId];
            if (!speaker.isLocal && speaker.audioLevel >= audioLevelThreshold) {
                if (!remoteSpeakerWithHighestAudioLevel || remoteSpeakerWithHighestAudioLevel.audioLevel < speaker.audioLevel) {
                    remoteSpeakerWithHighestAudioLevel = speaker;
                }
            }
        }
        
        return remoteSpeakerWithHighestAudioLevel;
    }
    
    private _getLocalSpeaker(): Speaker {
        let localSpeaker: Speaker = null;
        
        for (let speakerId in this._speakers) {
            let speaker = this._speakers[speakerId];
            if (speaker.isLocal) {
                localSpeaker = speaker;
                break;
            }
        }
        
        return localSpeaker;
    }
    
}
