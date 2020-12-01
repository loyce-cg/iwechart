declare class AudioWorkletProcessor {
    port: {
        onmessage: (event: any) => void;
        postMessage(msg: any): void
    }
    
    constructor(...args: any[]);
}

declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;