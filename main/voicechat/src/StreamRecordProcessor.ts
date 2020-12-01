class StreamRecordProcessor extends AudioWorkletProcessor {
    
    _stopped = false;
    
    constructor(...args: any[]) {
        super(...args)
        
        this.port.onmessage = (e) => {
            const msg = e.data;
            const method = msg.method;
            // const params = msg.params;
            if (method === "stop") {
                this._stopped = true;
                if (msg.id) {
                    this.port.postMessage({id: msg.id, result: true});
                }
            }
        }
    }
    
    // The method is called synchronously from the audio rendering thread, once for each block of audio
    // (also known as a rendering quantum) being directed through the processor's corresponding AudioWorkletNode.
    // In other words, every time a new block of audio is ready for your processor to manipulate, your process()
    // function is invoked to do so.
    process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: any) {
        const input = inputs[0]
        this.port.postMessage({method: "stream", params: {data: input[0]}});
        return !(this._stopped);
    }
}

console.log("registering stream-record-processor");
registerProcessor("stream-record-processor", StreamRecordProcessor);
