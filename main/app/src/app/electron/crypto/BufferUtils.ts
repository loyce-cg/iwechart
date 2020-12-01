export class BufferUtils {
    
    static bufferToArray(buffer: Buffer|ArrayBuffer|Uint8Array, copy: boolean): ArrayBuffer {
        if (typeof((<any>buffer).toArrayBuffer) == "function") {
            return (<any>buffer).toArrayBuffer();
        }
        let buf = <Uint8Array>buffer;
        if (buffer instanceof ArrayBuffer) {
            if (!copy) {
                return buffer;
            }
            buf = new Uint8Array(buffer);
        }
        if (!copy && buf.buffer instanceof ArrayBuffer && buf.buffer.byteLength == buf.length) {
            return buf.buffer;
        }
        let ab = new ArrayBuffer(buf.length);
        let view = new Uint8Array(ab);
        for (let i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }
    
    static arrayToBuffer(ab: ArrayBuffer, copy: boolean): Buffer {
        let b = Buffer.from(ab);
        return copy ? b.slice(0) : b;
    }
}