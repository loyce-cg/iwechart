export class RingBuffer {
    
    _length: number;
    _readIndex: number;
    _writeIndex: number;
    _data: any;
    
    constructor(length: number) {
        this._length = length + 1;
        this._readIndex  = 0;
        this._writeIndex = 0;
        this._data = new Float32Array(length + 1);
    }
    
    empty() {
        return this._readIndex === this._writeIndex;
    }
    
    get available() {
        // 0123456 (length 7)
        // ..r.w.. = 2
        // ..w.r.. = 5
        if (this._writeIndex < this._readIndex) {
            return this._length - (this._readIndex - this._writeIndex);
        }
        return this._writeIndex - this._readIndex;
    }
    
    get free() {
        // 0123456 (length 7)
        // ..r.w.. = 4
        // ..w.r.. = 1
        if (this._writeIndex < this._readIndex) {
            return (this._readIndex - this._writeIndex - 1);
        }
        return (this._length - this._writeIndex - 1) + this._readIndex;
    }
    
    skip(size: number) {
        if (size >= this.free) {
            this.clear();
            return;
        }
        this._readIndex = (this._readIndex + size) % this._length;
    }
    
    clear() {
        this._readIndex = this._writeIndex = 0;
    }
    
    push(source: Float32Array) {
        const sourceLength = source.length;
        const prevFree = this.free;
        for (let i = 0; i < sourceLength; ++i) {
            this._data[this._writeIndex] = source[i];
            this._writeIndex = (this._writeIndex + 1) % this._length;
        }
        if (prevFree < sourceLength) {
            if (sourceLength >= this._length) {
                this._readIndex = (this._writeIndex + 1) % this._length;
            }
            else {
                this._readIndex = (this._readIndex + (sourceLength - prevFree)) % this._length;
            }
        }
    }
    
    pull(destination: Float32Array) {
        const destinationLength = destination.length;
        for (let i = 0; i < destinationLength; ++i) {
            if (this._readIndex === this._writeIndex) {
                destination[i] = 0.0;
            }
            else {
                destination[i] = this._data[this._readIndex];
                this._readIndex = (this._readIndex + 1) % this._length;
            }
        }
        return destination;
    }
    
    take(length: number) {
        let buffer = new Float32Array(length);
        return this.pull(buffer);
    }
}