import * as ByteBuffer from "bytebuffer";

export type StreamInfo = any;

export interface StreamStartMessage {
    method: "streamStart";
    params: {
        streamId: string;
        peerId: string;
        info: StreamInfo;
    }
}

export interface Timestamp {
    start: string;
    encode: number;
    encrypt: number;
}

export interface StreamDataParams {
    streamName: string;
    time: Timestamp;
    data: ByteBuffer|Cipher;
}

export interface StreamDataMessage {
    method: "streamData";
    params: {
        streamId: string;
        time: Timestamp;
        data: ByteBuffer|Cipher;
    };
}

export interface StreamStopMessage {
    method: "streamStop";
    params: {
        streamId: string;
    }
}

export interface PeerHelloMessage {
    method: "peerHello";
    params: {
        peerId: string;
        info: {nickname: string}
    }
}

export interface PeerInfoMessage {
    method: "peerInfo";
    params: {
        peerId: string;
        info: {nickname: string}
    }
}

export interface PeerByeMessage {
    method: "peerBye";
    params: {
        peerId: string;
    }
}

export interface DingDongMessage {
    method: "dingdong";
    params: {}
}

export interface MsgMessage {
    method: "message";
    params: {
        data: "ping"|"pong";
        from: string;
        tstamp: string;
    }
}

export type Message = StreamStartMessage|StreamDataMessage|StreamStopMessage|PeerHelloMessage|PeerInfoMessage|PeerByeMessage|DingDongMessage|MsgMessage;

export interface RoomJoinResult {
    success: boolean;
    user: string;
    timestamp: string;
    streams: {
        stream_id: string;
        peerId: string;
    }[];
    info: {
        nickname: string;
        peerId: string;
    }[];
}

export interface Cipher {
    iv: ByteBuffer;
    ct: ByteBuffer;
}