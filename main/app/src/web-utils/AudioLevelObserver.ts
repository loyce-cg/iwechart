export class AudioLevelObserver {
    
    disposed: boolean = false;
    protected mediaStream: MediaStream = null;
    protected audioContext: AudioContext = null;
    protected scriptProcessor: ScriptProcessorNode = null;
    protected mediaStreamSource: MediaStreamAudioSourceNode = null;
    protected analyser: AnalyserNode = null;
    
    constructor(deviceId: string, public onGotAudioLevel: (audioLevel: number) => void) {
        this._start(deviceId);
    }
    
    dispose(): void {
        this._stop();
    }
    
    protected async _start(deviceId: string): Promise<void> {
        if (this.disposed) {
            return;
        }
        if (!deviceId) {
            const infos = await navigator.mediaDevices.enumerateDevices();
            for (let info of infos) {
                if (info.kind == "audioinput") {
                    deviceId = info.deviceId;
                    break;
                }
            }
        }
        if (this.disposed) {
            return;
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId }});
        if (this.disposed) {
            return;
        }
        if (mediaStream) {
            this.mediaStream = mediaStream;
            this.audioContext = new AudioContext();
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.fftSize = 2048;
            this.mediaStreamSource.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            this.scriptProcessor.onaudioprocess = () => {
                if (this.disposed) {
                    return;
                }
                let data = new Uint8Array(this.analyser.frequencyBinCount);
                this.analyser.getByteTimeDomainData(data);
                let maxVolume = data.reduce((prev, curr) => Math.max(prev, curr), 0);
                let audioLevel = parseFloat(((maxVolume - 127) / 128).toFixed(3));
                this.onGotAudioLevel(audioLevel);
            };
        }
    }
    
    protected _stop(): void {
        this.disposed = true;
        if (this.mediaStream && this.audioContext && this.scriptProcessor && this.mediaStreamSource && this.analyser) {
            this.scriptProcessor.disconnect(this.audioContext.destination);
            this.analyser.disconnect(this.scriptProcessor);
            this.mediaStreamSource.disconnect(this.analyser);
            
            this.mediaStream = null;
            this.audioContext = null;
            this.scriptProcessor = null;
            this.mediaStreamSource = null;
            this.analyser = null;
        }
    }
    
}
