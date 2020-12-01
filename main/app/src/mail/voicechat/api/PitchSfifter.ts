import * as PitchShift from "pitch-shift";

export class SimplePitchShifter {
    
    frameSize: number;
    shift: PitchShift.PitchShiftFunc;
    buf: Float32Array;
    pos: number;
    
    constructor(frameSize: number, pitchRate: number, sampleRate: number, length: number) {
        this.frameSize = frameSize;
        this.shift = PitchShift(this.onData.bind(this), () => pitchRate, {frameSize: frameSize, sampleRate: sampleRate});
        this.buf = new Float32Array(length);
        this.pos = 0;
    }
    
    onData(buff: Float32Array) {
        this.pos = SimplePitchShifter.copyBuffer(buff, this.buf, this.pos);
    }
    
    process(buf: Float32Array) {
        this.shift(buf);
    }
    
    finish() {
        this.shift(new Float32Array(this.frameSize));
        return this.buf;
    }
    
    static copyBuffer(input: Float32Array, output: Float32Array, outputPos: number) {
        let length = Math.min(input.length, output.length - outputPos);
        for (let i = 0; i < length; i++) {
            output[outputPos + i] = input[i];
        }
        return outputPos + length;
    }
    
    static process(input: Float32Array, pitchRate: number, sampleRate: number, frameSize?: number) {
        frameSize = frameSize || 512;
        let shifter = new SimplePitchShifter(frameSize, pitchRate, sampleRate, input.length);
        for (let i = 0; i < input.length; i += frameSize) {
            shifter.process(input.subarray(i, i + frameSize));
        }
        return shifter.finish();
    }
}
export class PitchShifter {
    
    frameSize: number;
    shift: PitchShift.PitchShiftFunc;
    pitchRate: number;
    onDataCore: (buff: Float32Array) => void;
    
    constructor(frameSize: number, sampleRate: number) {
        this.frameSize = frameSize;
        this.pitchRate = 1.0;
        this.shift = PitchShift(this.onData.bind(this), () => this.pitchRate, {frameSize: frameSize, sampleRate: sampleRate});
    }
    
    onData(buff: Float32Array) {
        if (this.onDataCore) {
            this.onDataCore(buff);
        }
    }
    
    process(input: Float32Array, pitchRate: number) {
        let pos = 0;
        let output = new Float32Array(input.length);
        this.pitchRate = pitchRate;
        this.onDataCore = frame => {
            pos = SimplePitchShifter.copyBuffer(frame, output, pos);
        };
        for (let i = 0; i < input.length; i += this.frameSize) {
            this.shift(input.subarray(i, i + this.frameSize));
        }
        return output.subarray(0, pos);
    }
}