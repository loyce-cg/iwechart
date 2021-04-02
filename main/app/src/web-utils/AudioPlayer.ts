import * as Q from "q";
import Promise = Q.Promise;
import * as RootLogger from "simplito-logger";
import { app } from "../Types";
let Logger = RootLogger.get("privfs-mail-client.webutils.AudioPlayer");

export type AudioDestination = number;
export interface AudioSource {
    buffer: AudioBuffer;
    start(pos: number): void;
    connect(destination: AudioDestination): void;
    onended: () => void;
}
export type AudioContextType = AudioContext;
let AudioContext: {new(): AudioContextType} = (<any>window).AudioContext || (<any>window).webkitAudioContext;

export class AudioPlayer {
    
    sounds: {[id: string]: string} = {};
    buffers: {[id: string]: AudioBuffer} = {};
    enabled: boolean;
    playingSourceCount: number;
    context: AudioContextType;
    private contextGainNode: GainNode;
    private defaultVolume: number = 1.0;
    
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
            request.open("GET", url, true);
            request.responseType = "arraybuffer";
            request.onload = () => {
                let context = this.context;
                if (!context) {
                    this.createAudioContext();
                    context = this.context;
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
    
    createAudioContext(): void {
        if (this.context && this.contextGainNode) {
            this.contextGainNode.disconnect(this.context.destination);
        }
        this.context = new AudioContext();
        this.contextGainNode = this.context.createGain();
        this.contextGainNode.gain.value = this.defaultVolume;
        this.contextGainNode.connect(this.context.destination);
    }
    
    setDefaultVolume(defaultVolume: number): void {
        this.defaultVolume = defaultVolume;
        if (this.contextGainNode) {
            this.contextGainNode.gain.value = defaultVolume;
        }
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
    
    play(id: string, options: app.PlayAudioOptions): void {
        if (!this.enabled && !options.force) {
            Logger.debug("play - skipped", id);
            return;
        }
        Logger.debug("play", id);
        this.getBuffer(id)
        .then(buffer => {
            let source = this.context.createBufferSource();
            source.buffer = buffer;
            if (this.context.state == "suspended") {
                this.context.resume();
            }
            this.playingSourceCount++;
            this.contextGainNode.gain.value = typeof(options.defaultVolume) === "number" ? options.defaultVolume : this.defaultVolume;
            source.connect(this.contextGainNode);
            source.start(0);
            source.onended = () => {
                source.disconnect(this.contextGainNode);
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
                this.createAudioContext();
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

