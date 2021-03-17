export interface SectionVideoConferenceModel {
    isVideoConferenceActive: boolean;
    isUserParticipating: boolean;
    personModels: VideoConferencePersonModel[];
    isUserInAnyVideoConference: boolean;
}

export interface VideoConferencePersonModel {
    hashmail: string;
    name: string;
}
