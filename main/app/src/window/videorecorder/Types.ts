export enum VideoRecorderMode {
    AUDIO = "audio",
    VIDEO = "video",
    AUDIO_AND_VIDEO = "audioAndVideo",
    PHOTO = "photo",
}

export enum VideoRecorderState {
    BEFORE_RECORDING = "before-recording",
    RECORDING = "recording",
    AFTER_RECORDING = "after-recording",
}

export enum RecordingType {
    AUDIO = "audio",
    VIDEO = "video",
    PHOTO = "photo",
}

export interface RecordedMediaModel {
    dataUrl: string;
    mimeType: string;
    recordingType: RecordingType;
    thumbnailDataUrl?: string;
}

export interface VideoResolution {
    width: number;
    height: number;
    isCurrent?: boolean;
}
