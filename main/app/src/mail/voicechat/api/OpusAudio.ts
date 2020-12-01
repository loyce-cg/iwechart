import { AsyncHelper } from "./AsyncHelper";
import { RingBuffer } from "./RingBuffer";
import { AudioContextManager, AudioContext, MediaStreamAudioSourceNode, AudioWorkletNode } from "./AudioContextManager";
import { Utils } from "./Utils";
import * as RootLogger from "simplito-logger";
import { PromiseCache } from "../../../utils/PromiseCache";
import { PitchShifter } from "./PitchSfifter";
import * as libopus from "@simplito/libopus";

let Logger = RootLogger.get("privfs-mail-client.mail.voicechat.api.OpusAudio");

export class RawOpusRecorder {
    
    state: string;
    audioContext: AudioContext;
    _mic: MediaStream;
    _micStream: MediaStreamAudioSourceNode;
    _buffer: RingBuffer;
    _encoder: libopus.Encoder;
    _worklet: AudioWorkletNode;
    ondata: (data: Int16Array, startTimestamp: number, encodeTimestamp: number) => void;
    onstart: () => void;
    onpause: () => void;
    onresume: () => void;
    onstop: () => void;
    speedUp: number = 1.0;
    
    constructor(
        public audioContextManager: AudioContextManager
    ) {
        libopus.initialize();
        this.state = "stopped";
    }
    
    async start() {
        if (this.state === "recording") {
            return true;
        }
        
        if (this.state === "paused") {
            this.resume();
            return true;
        }
        
        if (!this.audioContext) {
            // console.log("init audio");
            try {
                this.audioContext = await this.audioContextManager.initAudio();
            }
            catch (e) {
                console.error("Error init audio", e, (e ? e.message : e), (e ? e.stack : e));
                throw e;
            }
        }
        
        this._mic = await navigator.mediaDevices.getUserMedia({audio: true});
        this._micStream = this.audioContext.createMediaStreamSource(this._mic);
        this._worklet = this.audioContextManager.createAudioWorkletNode(this.audioContext, "stream-record-processor");
        this._worklet.onprocessorerror = console.error;
        this._buffer = new RingBuffer(24000);
        const frameSize = 40; // 2.5, 5, 10, 20, 40, 60
        
        this._encoder = new libopus.Encoder(1, 48000, 96000, frameSize, false);
        
        const sourceSampleRate = this.audioContext.sampleRate;
        const sourceChunkSize = sourceSampleRate * frameSize / 1000;
        this._worklet.port.onmessage = async (e: any) => {
            if (!this._buffer || !this.ondata) {
                return;
            }
            let start = Date.now();
            this._buffer.push(Utils.ensize(e.data.params.data, this.speedUp));
            if (this._buffer.available >= sourceChunkSize) {
                let buf = this._buffer.take(sourceChunkSize);
                let buf32 = await Utils.resample(buf, sourceSampleRate, 48000);
                let buf16 = Utils.f32_to_i16(buf32);
                
                this._encoder.input(buf16);
                let enc = this._encoder.output();
                if (enc) {
                    this.ondata(enc, start, Date.now());
                }
            }
        }
        this._micStream.connect(this._worklet);
        this._worklet.connect(this.audioContext.destination);
        this.state = "recording";
        if (this.onstart) {
            this.onstart();
        }
        return true;
    }
    
    pause() {
        this.state = "paused";
        this._worklet.disconnect(this.audioContext.destination)
        if (this.onpause) {
            this.onpause();
        }
    }
    
    resume() {
        this.state = "recording";
        this._buffer.clear();
        this._worklet.connect(this.audioContext.destination);
        if (this.onresume) {
            this.onresume();
        }
    }
    
    stop() {
        this.state = "stopped";
        if (this._worklet) {
            this._worklet.port.postMessage({method: "stop"});
            this._worklet.disconnect();
            delete this._worklet
        }
        if (this._micStream) {
            this._micStream.disconnect();
            this._micStream.mediaStream.getAudioTracks()[0].stop();
            delete this._micStream;
        }
        if (this._encoder) {
            this._encoder.destroy();
            delete this._encoder;
        }
        if (this._mic) {
            delete this._mic;
        }
        delete this._buffer;
        if (this.onstop) {
            this.onstop();
        }
    }
}

export interface PlayerPosition {
    x: number;
    y: number;
    z: number;
}

export class RawOpusPlayer {
    
    state: string;
    _asyncHelper: AsyncHelper;
    audioContext: AudioContext;
    _worklet: AudioWorkletNode;
    onstop: () => void;
    _panner: PannerNode;
    _startPromise: PromiseCache<void>;
    _audioQueue: AudioQueue;
    
    constructor(
        public audioContextManager: AudioContextManager,
        public position: PlayerPosition
    ) {
        libopus.initialize();
        this._asyncHelper = new AsyncHelper();
        this._startPromise = new PromiseCache();
    }
    
    async wait() {
        return new Promise(resolve => setTimeout(resolve(), 1000));
    }
    
    start() {
        let start = async () => {
            if (this.state == "playing") {
                return;
            }
            try {
                if (!this.audioContext) {
                    this.audioContext = await this.audioContextManager.initAudio();
                }
                this._audioQueue = new AudioQueue(this.audioContext.sampleRate, data => {
                    if (this._worklet) {
                        this._worklet.port.postMessage({method: "push", params: {data: data}});
                    }
                });
                this._worklet = this.audioContextManager.createAudioWorkletNode(this.audioContext, "stream-audio-processor")
                this._worklet.port.onmessage = (e: any) => {
                    if (!this._asyncHelper.receive(e.data)) {
                        if (e.data.method == "available" && this._audioQueue) {
                            this._audioQueue.onAvailableDataInWorker(e.data.available);
                        }
                    }
                };
                this._panner = this.audioContext.createPanner();
                this._panner.panningModel = "HRTF";
                this._panner.distanceModel = "inverse";
                this._panner.refDistance = 1;
                this._panner.maxDistance = 10000;
                this._panner.rolloffFactor = 1;
                this._panner.coneInnerAngle = 360;
                this._panner.coneOuterAngle = 0;
                this._panner.coneOuterGain = 0;
                this._panner.setOrientation(1, 0, 0);
                this._panner.setPosition(this.position.x, this.position.y, this.position.z);
                
                this._worklet.connect(this._panner);
                this._panner.connect(this.audioContext.destination);
                this.state = "playing";
            }
            catch (ex) {
                await this.reInitOrDrop();
            }
        };
        return this._startPromise.go(start);
    }

    async reInitOrDrop() {
        try {
            console.log("Re-init ...");
            this.audioContext = await this.audioContextManager.initAudio();
            await this.wait()
            console.log("retry init audio player..")
            this.stop()
            await this.start();    
        }
        catch (e) {
            console.error("Error init audio", e, (e ? e.message : e), (e ? e.stack : e));
            throw e;
        }
    }
    
    setPosition(position: PlayerPosition) {
        this.position = position;
        if (this._panner) {
            this._panner.setPosition(this.position.x, this.position.y, this.position.z);
        }
    }
    
    async info() {
        return this._asyncHelper.send((id: string) => this._worklet.port.postMessage({id: id, method: "info"}))
    }
    
    skip(size: number) {
        this._worklet.port.postMessage({method: "skip", params: {size: size}})
    }
    
    canTakeMoreData() {
        return this._audioQueue && !this._audioQueue.isBufferOverloaded();
    }
    
    input(data: Uint8Array|Int16Array) {
        if (this.state == "playing" && this._audioQueue) {
            this._audioQueue.addEncodedData(data);
        }
    }
    
    pause() {
        this.state = "paused";
    }
    
    resume() {
        this.state = "playing";
    }
    
    stop() {
        this.state = "stopped";
        if (this._worklet) {
            this._worklet.port.postMessage({method: "stop"});
            this._worklet.disconnect();
            delete this._worklet;
        }
        if (this._panner) {
            this._panner.disconnect();
            delete this._panner;
        }
        if (this._audioQueue) {
            this._audioQueue.destroy();
            delete this._audioQueue;
        }
        if (this.onstop) {
            this.onstop();
        }
    }
}

export class AudioQueue {
    
    static DECODER_SAMPLE_RATE = 48000;
    
    _list: Float32Array[] = [];
    _fetching: boolean = false;
    _decoder: libopus.Decoder;
    _speedUpper: SpeedUpper;
    _maxAvailableDataInWorker: number;
    _overloadAt: number;
    _timeoutId: NodeJS.Timer;
    _mainIntervalId: NodeJS.Timer;
    _availableDataInWorker: number = 0;
    _destroyed: boolean;
    
    constructor(
        public sampleRate: number,
        public onData: (data: Float32Array) => void
    ) {
        this._speedUpper = new SpeedUpper(sampleRate);
        this._decoder = new libopus.Decoder(1, AudioQueue.DECODER_SAMPLE_RATE);
        this._mainIntervalId = setInterval(() => this.kick(), 100);
        this._maxAvailableDataInWorker = Math.floor(this.sampleRate * 0.25); // 0.25 second
        this._overloadAt = this.sampleRate * 10; // 10 seconds
    }
    
    destroy() {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;
        this._list = [];
        this._fetching = false;
        clearTimeout(this._timeoutId);
        clearInterval(this._mainIntervalId);
        this._decoder.destroy();
        this._speedUpper.destroy();
    }
    
    onAvailableDataInWorker(availableDataInWorker: number) {
        if (this._destroyed) {
            return;
        }
        this._availableDataInWorker = availableDataInWorker;
        this.kick();
    }
    
    getAllAvailable() {
        let local = 0;
        this._list.forEach(x => local += x.length);
        return {
            local: local,
            worker: this._availableDataInWorker,
            all: local + this._availableDataInWorker
        };
    }
    
    isBufferOverloaded() {
        let available = this.getAllAvailable();
        return available.all > this._overloadAt;
    }
    
    async addEncodedData(data: Uint8Array|Int16Array) {
        try {
            if (this._destroyed) {
                return;
            }
            if (this.isBufferOverloaded()) {
                console.log("Audio buffer is overloaded so dropping audio frame");
                return;
            }
            // TODO: Potentially move decoding to a separate worker
            this._decoder.input(data);
            let dec16 = this._decoder.output();
            if (!dec16) {
                return;
            }
            let dec32 = Utils.i16_to_f32(dec16);
            let dec = await Utils.resample(dec32, AudioQueue.DECODER_SAMPLE_RATE, this.sampleRate);
            this._list.push(dec);
            this.kick();
        }
        catch (e) {
            console.log("Error during adding encoded data", e);
        }
    }
    
    workerCanTakeMoreData() {
        return this._list.length && this._availableDataInWorker < this._maxAvailableDataInWorker;
    }
    
    async kick() {
        if (this._destroyed || this._fetching) {
            return;
        }
        this._fetching = true;
        try {
            if (this.workerCanTakeMoreData()) {
                let dec = this._list.shift();
                let available = this.getAllAvailable();
                let info = await this._speedUpper.getData(dec, available.all);
                if (info.speedUp) {
                    Logger.debug("SpeedUp", info.speedUp, " - Available", available.all, available.local, available.worker);
                }
                else {
                    Logger.debug("OK - Available", available.all, available.local, available.worker);
                }
                this.onData(info.data);
            }
        }
        catch (e) {
            console.log("Error during sending data to worker", e);
        }
        finally {
            this._fetching = false;
            if (this.workerCanTakeMoreData()) {
                this._timeoutId = setTimeout(() => this.kick(), 1);
            }
        }
    }
}

export class SpeedUpper {
    
    static SHIFTER_FRAME_SIZE = 512;
    
    _pitchShifter: PitchShifter;
    _startSpeedUpAt: number;
    _maxSpeedUpAt: number;
    _baseSpeed: number;
    _maxSpeed: number;
    
    constructor(
        public sampleRate: number
    ) {
        this._pitchShifter = new PitchShifter(SpeedUpper.SHIFTER_FRAME_SIZE, this.sampleRate);
        this._startSpeedUpAt = Math.floor(this.sampleRate * 0.5); // 0.5 second
        this._maxSpeedUpAt = Math.floor(this.sampleRate * 3); // 3 second
        this._baseSpeed = 1.0;
        this._maxSpeed = 1.5;
    }
    
    destroy() {
    }
    
    getSpeedUp(available: number) {
        if (available > this._maxSpeedUpAt) {
            return this._maxSpeed;
        }
        let buffLength = this._maxSpeedUpAt - this._startSpeedUpAt;
        let maxSpeedUp = this._maxSpeed - this._baseSpeed;
        return this._baseSpeed + maxSpeedUp * (available - this._startSpeedUpAt) / buffLength + 0.05;
    }
    
    async getData(data: Float32Array, available: number): Promise<{data: Float32Array, speedUp?: number}> {
        if (available > this._startSpeedUpAt) {
            let speedUp = this.getSpeedUp(available);
            return {speedUp: speedUp, data: await Utils.speedUpEx(data, this.sampleRate, speedUp, this._pitchShifter)};
        }
        return {data: data};
    }
}
