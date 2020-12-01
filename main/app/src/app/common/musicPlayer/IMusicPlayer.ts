import {app} from "../../../Types";

export interface IMusicPlayer {
    add(data: app.BlobData): void;
    setData(idx: number, data: app.BlobData): void;
    delete(idx: number): void;
    clear(): void;
    play(idx: number): void;
    pause(): void;
    seekTo(value: number): void;
    setIsMuted(muted: boolean): void;
    setVolume(volume: number): void;
    onTrackEnded(cb: () => void): void;
    onGotDuration(cb: (duration: number) => void): void;
    onTimeChanged(cb: (value: number) => void): void;
    canPlayTypes(mimes: string[]): Q.Promise<{ [key: string]: boolean }>;
}
