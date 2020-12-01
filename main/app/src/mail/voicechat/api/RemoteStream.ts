import { RawOpusPlayer, PlayerPosition } from "./OpusAudio";
import { AudioContextManager } from "./AudioContextManager";
import { StreamInfo } from "./Types";

export class RemoteStream {
    
    id: string;
    in: number = 0;
    out: number = 0;
    lastts: number = 0;
    history: any[] = [];
    player: RawOpusPlayer;
    info: StreamInfo;
    peerId: string;
    
    constructor(audioContextManager: AudioContextManager, streamId: string, peerId: string, info: StreamInfo, position: PlayerPosition) {
        this.id = streamId;
        this.peerId = peerId;
        this.info = info;
        this.player = new RawOpusPlayer(audioContextManager, position);
    }
    
    async init() {
        return this.player.start();
    }
    
    markts() {
        const ts = new Date().getTime();
        let td = ts - this.lastts;
        this.lastts = ts;
        this.history.unshift(td);
        if (this.history.length > 200) {
            this.history.pop();
        }
    }
    
    canTakeMoreData() {
        return this.player.canTakeMoreData();
    }
    
    input(data: ArrayBuffer) {
        let array = new Uint8Array(data);
        this.in += array.length;
        this.player.input(array);
    }
    
    stop() {
        this.player.stop();
    }
}
