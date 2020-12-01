import { PitchShifter, SimplePitchShifter } from "./PitchSfifter";

export class Utils {
    
    static f32_to_i16(data: Float32Array) {
        let buf = new Int16Array(data.length);
        for (let i = 0; i < data.length; ++i) {
            buf[i] = data[i] * 32767;
        }
        return buf;
    }
    
    static i16_to_f32(data: Int16Array) {
        let buf = new Float32Array(data.length);
        for (let i = 0; i < data.length; ++i) {
            buf[i] = data[i] / 32767.0;
        }
        return buf;
    }
    
    static async resample(data: Float32Array, sourceSampleRate: number, destSampleRate: number) {
        if (sourceSampleRate === destSampleRate) {
            return data;
        }
        let sourceLength = data.length;
        let destLength = Math.ceil(sourceLength * destSampleRate / sourceSampleRate);
        let oc = new OfflineAudioContext(1, destLength, destSampleRate);
        let sb = oc.createBuffer(1, sourceLength, sourceSampleRate);
        let cd = sb.getChannelData(0);
        for (let i = 0; i < sourceLength; ++i) {
            cd[i] = data[i];
        }
        let bs = oc.createBufferSource();
        bs.buffer = sb;
        bs.connect(oc.destination);
        bs.start();
        let ab = await oc.startRendering();
        return ab.getChannelData(0);
    }
    
    static async speedUpCore(data: Float32Array, sourceSampleRate: number, rate: number) {
        let sourceLength = data.length;
        let ctx = new OfflineAudioContext(1, Math.ceil(sourceLength / rate), sourceSampleRate);
        let srcBuf = ctx.createBuffer(1, sourceLength, sourceSampleRate);
        let channelData = srcBuf.getChannelData(0);
        for (let i = 0; i < sourceLength; ++i) {
            channelData[i] = data[i];
        }
        let srcBfSrc = ctx.createBufferSource();
        srcBfSrc.buffer = srcBuf;
        srcBfSrc.playbackRate.value = rate;
        srcBfSrc.connect(ctx.destination);
        srcBfSrc.start();
        let ab = await ctx.startRendering();
        srcBfSrc.stop();
        srcBfSrc.disconnect();
        return ab.getChannelData(0);
    }
    
    static async speedUp(data: Float32Array, sourceSampleRate: number, rate: number) {
        let buf = await Utils.speedUpCore(data, sourceSampleRate, rate);
        return SimplePitchShifter.process(buf, 1 / rate, sourceSampleRate);
    }
    
    static async speedUpEx(data: Float32Array, sourceSampleRate: number, rate: number, pitchShifter: PitchShifter) {
        let buf = await Utils.speedUpCore(data, sourceSampleRate, rate);
        return pitchShifter.process(buf, 1 / rate);
    }
    
    static ensize(input: Float32Array, ratio: number) {
        if (ratio <= 1.0) {
            return input;
        }
        let result = new Float32Array(Math.floor(input.length * ratio));
        let q = ratio - 1.0;
        let j = 0;
        let k = 0;
        for (let i = 0; i < input.length; i++) {
            result[j] = input[i];
            j++;
            k += q;
            while (k > 1) {
                result[j] = input[i];
                j++;
                k -= 1;
            }
        }
        return result;
    }
    
    static removeFromList<T>(list: T[], entry: T): number {
        let index = list.indexOf(entry);
        if (index != -1) {
            list.splice(index, 1);
        }
        return index;
    }
    
    static addFunklyToList<T>(list: T[], entry: T): number {
        let x = list.length % 4;
        if (x == 0) {
            list.splice(0, 0, entry);
            return 0;
        }
        else if (x == 1) {
            let index = Math.ceil(list.length / 2);
            list.splice(index, 0, entry);
            return index;
        }
        else if (x == 2) {
            let index = Math.floor(list.length / 2);
            list.splice(index, 0, entry);
            return index;
        }
        else if (x == 3) {
            list.push(entry);
            return list.length - 1;
        }
    }
}