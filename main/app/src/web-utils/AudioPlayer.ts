import * as Q from "q";
import Promise = Q.Promise;
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.webutils.AudioPlayer");

export type AudioBuffer = number;
export type AudioDestination = number;
export interface AudioSource {
    buffer: AudioBuffer;
    start(pos: number): void;
    connect(destination: AudioDestination): void;
    onended: () => void;
}
export interface AudioContextType {
    destination: AudioDestination;
    state: string;
    onstatechange: () => void;
    resume(): void;
    suspend(): void;
    close(): void;
    decodeAudioData(data: any, successCallback: (buffer: AudioBuffer) => void, errorCallback: (e: any) => void): void;
    createBufferSource(): AudioSource;
}
let AudioContext: {new(): AudioContextType} = (<any>window).AudioContext || (<any>window).webkitAudioContext;

export class AudioPlayer {
    
    sounds: {[id: string]: string} = {};
    buffers: {[id: string]: AudioBuffer} = {};
    enabled: boolean;
    playingSourceCount: number;
    context: AudioContextType;
    
    constructor() {
        this.sounds = {};
        this.enabled = false;
        this.playingSourceCount = 0;
    }
    
    has(id: string): boolean {
        return id in this.sounds;
    }
    
    add(id: string, url: string): void {
        Logger.debug("add", id, url);
        if ((id in this.sounds) && this.sounds[id] != url && (id in this.buffers)) {
            delete this.buffers[id];
        }
        this.sounds[id] = url;
    }
    
    prepare(id: string, url: string): Q.Promise<any> {
        return Promise((resolve, reject) => {
            Logger.debug("prepare", id, url);
            let request = new XMLHttpRequest();
            request.open('GET', url, true);
            request.responseType = 'arraybuffer';
            request.onload = () => {
                let context = this.context;
                if (!context) {
                    context=this.context = new AudioContext();
                }
                this.context.decodeAudioData(request.response, buffer => {
                    Logger.debug("decoded", id);
                    this.buffers[id] = buffer;
                    resolve(null);
                }, reject);
            };
            request.send();
        });
    }
    
    getBuffer(id: string): Q.Promise<AudioBuffer> {
        return Q().then(() => {
            Logger.debug("getBuffer", id);
            if (!this.buffers[id]) {
                if (!this.sounds[id]) {
                    throw new Error("Unknown id");
                }
                return this.prepare(id, this.sounds[id]);
            }
        })
        .then(() => {
            return this.buffers[id];
        });
    }
    
    play(id: string, force: boolean = false): void {
        if (!this.enabled && !force) {
            Logger.debug("play - skipped", id);
            return;
        }
        Logger.debug("play", id);
        this.getBuffer(id)
        .then(buffer => {
            let source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.context.destination);
            if (this.context.state == "suspended") {
                this.context.resume();
            }
            this.playingSourceCount++;
            source.start(0);
            source.onended = () => {
                this.playingSourceCount--;
                if (this.playingSourceCount == 0) {
                    this.context.suspend();
                }
            };
        });
    }
    
    enable() {
        return Q().then(() => {
            if (!this.enabled) {
                Logger.debug("enabling");
                this.context = new AudioContext();
                this.context.onstatechange = () => {
                    if (this.context) {
                        Logger.debug("audio context state change:", this.context.state);
                    }
                };
                this.context.suspend();
                this.buffers = {};
                this.enabled = true;
            }
        });
    }
    
    disable() {
        return Q().then(() => {
            if (this.enabled) {
                Logger.debug("disabling");
                this.context.close();
                setTimeout(() => {
                    delete this.context;
                    this.buffers = {};
                    Logger.debug("deleting audio context and buffers");
                }, 1);
                this.enabled = false;
            }
        });
    }
}

