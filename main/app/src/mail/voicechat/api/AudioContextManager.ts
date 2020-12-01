import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.voicechat.api.AudioContextManager");

export interface AudioWorklet {
    addModule(moduleName: string): Promise<any>;
}

export interface AudioContextDestination extends AudioNode {
}

export interface MediaStreamAudioSourceNode {
    connect(node: AudioWorkletNode): void;
    disconnect(): void;
    mediaStream: {
        getAudioTracks(): {stop(): void}[];
    };
}

export declare class AudioContext {
    sampleRate: number;
    state: string;
    listener: AudioListener;
    
    constructor(options: {sampleRate: number});
    audioWorklet: AudioWorklet;
    destination: AudioContextDestination;
    createMediaStreamSource(mediaStream: MediaStream): MediaStreamAudioSourceNode;
    resume(): Promise<AudioContext>;
    suspend(): Promise<void>;
    close(): Promise<void>;
    createPanner(): PannerNode;
}

export interface AudioContextManagerOptions {
    recordProcessor: string;
    audioProcessor: string;
    sampleRate?: number;
}

export declare class AudioWorkletNode {
    constructor(audioContext: AudioContext, processorName: string);
    onprocessorerror: (error: any) => any;
    port: {
        onmessage: (event: any) => any;
        postMessage(data: any): any;
    };
    connect(destination: AudioContextDestination): any;
    disconnect(destination: AudioContextDestination): any;
    disconnect(): any;
}

export class AudioContextManager {
    
    audioContextPromise: Promise<AudioContext>;
    
    constructor(
        public options: AudioContextManagerOptions
    ) {
    }
    
    async initAudio() {
        if (this.audioContextPromise) {
            let audioContext = await this.audioContextPromise;
            if (audioContext.state === "suspended") {
                audioContext.resume();
            }
            return audioContext;
        }
        return this.audioContextPromise = (async () => {
            try {
                let audioContext = new AudioContext({sampleRate: this.options.sampleRate || 48000});
                audioContext.listener.setOrientation(0, 0, -1, 0, 1, 0);
                audioContext.listener.setPosition(0, 0, 0);
                await audioContext.audioWorklet.addModule(this.options.recordProcessor);
                await audioContext.audioWorklet.addModule(this.options.audioProcessor);
                if (audioContext.state === "suspended") {
                    audioContext.resume();
                }
                Logger.info("Audio started");
                return audioContext;
            }
            catch (e) {
                this.audioContextPromise = null;
                throw e;
            }
        })();
    }
    
    closeAudio() {
        if (this.audioContextPromise) {
            this.audioContextPromise.then(x => x.close()).then(() => {
                console.info("Audio context closed");
            }, e => {
                console.error("Error during closing audio context", e)
            });
            delete this.audioContextPromise;
            console.info("Audio stopped");
        }
        else {
            console.info("Audio not initialized so on close there is no action required");
        }
    }
    
    createAudioWorkletNode(audioContext: AudioContext, processorName: string) {
        return new AudioWorkletNode(audioContext, processorName);
    }
}