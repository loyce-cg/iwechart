import {IMusicPlayer} from "./IMusicPlayer";
import {app} from "../../../Types";
import {WebUtils} from "../../../web-utils/WebUtils";
import Q = require("q");

export class MusicPlayer implements IMusicPlayer {
    
    audio: HTMLAudioElement;
    data: string[] = [];
    onTrackEndedCB: () => void = () => {};
    onGotDurationCB: (duration: number) => void = () => {};
    onTimeChangedCB: (time: number) => void = () => {};
    currIdx: number = -1;
    timer: any;
    
    initPlayer(audio: HTMLAudioElement): void {
        this.audio = audio;
        this.audio.onended = () => {
            if (this.onTrackEndedCB) {
                this.onTrackEndedCB();
            }
        };
        this.audio.ondurationchange = () => {
            if (this.onGotDurationCB) {
                this.onGotDurationCB(this.audio.duration);
            }
            this.stopTimer();
            if (this.onTimeChangedCB) {
                this.onTimeChangedCB(0);
            }
        };
    }
    
    has(idx: number): boolean {
        return idx < this.data.length;
    }
    
    add(data: app.BlobData): void {
        this.data.push(data ? WebUtils.createObjectURL(data) : null);
    }
    
    setData(idx: number, data: app.BlobData): void {
        if (this.data[idx]) {
            URL.revokeObjectURL(this.data[idx]);
        }
        this.data[idx] = data ? WebUtils.createObjectURL(data) : null;
    }
    
    delete(idx: number): void {
        if (!this.has(idx)) {
            return;
        }
        if (this.data[idx]) {
            URL.revokeObjectURL(this.data[idx]);
        }
        this.data.splice(idx, 1);
    }
    
    clear(): void {
        this.data.forEach(x => {
            if (x) {
                URL.revokeObjectURL(x);
            }
        });
        this.data.length = 0;
        this.currIdx = -1;
        this.audio.pause();
        this.stopTimer();
        this.audio.src = "";
    }
    
    play(idx: number): void {
        if (idx != this.currIdx || !this.audio.src || this.audio.src != this.data[idx]) {
            this.currIdx = idx;
            this.audio.src = this.data[idx];
        }
        this.audio.play().then(() => {
            this.startTimer();
        });
    }
    
    pause(): void {
        this.audio.pause();
        this.stopTimer();
    }
    
    seekTo(value: number): void {
        this.audio.currentTime = value;
    }
    
    setIsMuted(muted: boolean): void {
        this.audio.muted = muted;
    }
    
    setVolume(volume: number): void {
        this.audio.volume = volume;
    }
    
    startTimer(): void {
        this.stopTimer();
        this.timer = setInterval(() => {
            if (this.onTimeChangedCB) {
                this.onTimeChangedCB(this.audio.currentTime);
            }
        }, 1000);
    }
    
    stopTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
    
    onTrackEnded(cb: () => void): void {
        this.onTrackEndedCB = cb;
    }
    
    onGotDuration(cb: (duration: number) => void): void {
        this.onGotDurationCB = cb;
    }
    
    onTimeChanged(cb: (time: number) => void): void {
        this.onTimeChangedCB = cb;
    }
    
    canPlayTypes(mimes: string[]): Q.Promise<{ [key: string]: boolean }> {
        return Q().then(() => {
            return this.canPlayTypes2(mimes);
        });
    }
    
    canPlayTypes2(mimes: string[]): { [key: string]: boolean } {
        let canPlay: { [key: string]: boolean } = {};
        for (let mime of mimes) {
            canPlay[mime] = this.audio.canPlayType(mime) != "";
        }
        return canPlay;
    }
    
}