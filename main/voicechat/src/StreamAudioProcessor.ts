import {RingBuffer} from "./RingBuffer";

class StreamAudioProcessor extends AudioWorkletProcessor {
    
    _buffer  = new RingBuffer(22050); // 500ms buffer (assuming 44100Hz default audio playback sample rate)
    _stopped = false;
    
    constructor(...args: any[]) {
        super(...args)
        
        this.port.onmessage = (e) => {
            const msg = e.data;
            const method = msg.method;
            const params = msg.params;
            if (method === "push") {
                this._buffer.push(params.data);
                this.port.postMessage({method: "available", available: this._buffer.available});
            }
            else if (method === "stop") {
                this._stopped = true;
                if (msg.id) {
                    this.port.postMessage({id: msg.id, result: true});
                }
            }
            else if (method === "info") {
                this.port.postMessage({id: msg.id, result: {stopped:  this._stopped, available: this._buffer.available, free: this._buffer.free}});
            }
            else if (method === "skip") {
                this._buffer.skip(params.size);
            }
        }
    }
    
    // The method is called synchronously from the audio rendering thread, once for each block of audio
    // (also known as a rendering quantum) being directed through the processor's corresponding AudioWorkletNode.
    // In other words, every time a new block of audio is ready for your processor to manipulate, your process()
    // function is invoked to do so.
    process(_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: any) {
        if (this._buffer.empty()) {
            return (!this._stopped);
        }
        const output = outputs[0];
        this._buffer.pull(output[0]);
        this.port.postMessage({method: "available", available: this._buffer.available});
        return true;
    }
}

console.log("registering stream-audio-processor");
registerProcessor("stream-audio-processor", StreamAudioProcessor);
