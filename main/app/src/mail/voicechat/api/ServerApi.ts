import { AsyncHelper } from "./AsyncHelper";
import * as PSON from "pson";
import { RemoteStream } from "./RemoteStream";
import { Helper } from "./Helper";
import * as ByteBuffer from "bytebuffer";
import { RawOpusRecorder, PlayerPosition } from "./OpusAudio";
import { AudioContextManager, AudioContextManagerOptions } from "./AudioContextManager";
import { Message, StreamInfo, RoomJoinResult, Cipher, StreamDataParams } from "./Types";
import { PositionCalculator } from "./PositionCalculator";
import { Utils } from "./Utils";

export interface RoomInfo {
    name: string;
    key: ArrayBuffer;
}

export class ServerApiClient {
    
    asyncHelper: AsyncHelper;
    pson: PSON.StaticPair;
    ws: WebSocket;
    
    constructor() {
        this.asyncHelper = new AsyncHelper();
        this.pson = new PSON.StaticPair();
    }
    
    async server_call<T = any>(method: string, params: any): Promise<T> {
        if (!this.ws) {
            return Promise.reject("WebSocket closed");
        }
        return this.asyncHelper.send((id: string) => {
            let encoded = this.pson.encode({jsonrpc: "2.0", id: id, method: method, params: params});
            this.ws.send(encoded.toArrayBuffer());
        });
    }
    
    server_cast(method: string, params: any): void {
        if (!this.ws) {
            return;
        }
        var encoded = this.pson.encode({jsonrpc: "2.0", method: method, params: params});
        this.ws.send(encoded.toArrayBuffer());
    }
    
    ping() {
        return this.server_call<{type: "pong"; timestamp: string;}>("ping", {});
    }
    
    pingTo(to: string) {
        return this.server_cast("message", {to: to, data: "ping", tstamp: Date.now().toString()});
    }
    
    pongTo(to: string, tstamp: string) {
        return this.server_cast("message", {to: to, data: "pong", tstamp: tstamp});
    }
    
    dingDong() {
        return this.server_cast("dingdong", {});
    }
    
    roomJoin(roomId: string, auth: string) {
        return this.server_call<RoomJoinResult>("roomJoin", {roomId: roomId, auth: auth});
    }
    
    streamStart(streamName: string, info: StreamInfo) {
        return this.server_cast("streamStart", {streamName: streamName, info: info});
    }
    
    streamStop(streamName: string) {
        return this.server_cast("streamStop", {streamName: streamName});
    }
    
    streamData(model: StreamDataParams) {
        return this.server_cast("streamData", model);
    }
}

export interface RoomPerson {
    nickname: string;
    peerId: string;
    ping: number;
    pinger: NodeJS.Timer;
}

export class SendingQueue {
    
    suspended: boolean = false;
    queue: Function[] = [];
    
    send(func: Function) {
        if (this.suspended) {
            this.queue.push(func);
        }
        else {
            func();
        }
    }
    
    delay(miliseconds: number) {
        this.suspended = true;
        setTimeout(() => {
            for (let f of this.queue) {
                f();
            }
            this.suspended = false;
            this.queue = [];
        }, miliseconds);
    }
}

export class ServerApi {
    
    static MIN_ANGLE = -45;
    static MAX_ANGLE = 45;
    static MAX_BUFFERED_AMOUNT = 13 * 1024; // normal upload is ~13 KB/s, so 13 KB buffer is 1 second buffor in websocket
    static MAX_DELAY = 3000; // max delay for received packets in ms
    static DROPPING_EXPIRED_FRAMES = false;
    
    _conn: boolean = false;
    _disconnect: boolean = false;
    _pinger: number;
    _released: boolean = false;
    onDingDong: () => void;
    onServerPing: (ping: number) => void;
    onRoomInfo: (roomsInfo: {[id: string]: RoomPerson}) => void;
    roomKey: ArrayBuffer;
    remoteStreams: {[id: string]: RemoteStream} = {};
    roomPeople: {[id: string]: RoomPerson} = {};
    peers: string[] = [];
    
    apiClient: ServerApiClient;
    audioContextManager: AudioContextManager;
    recorder: RawOpusRecorder;
    myStreamId: string;
    serverDiff: number = 0;
    sendingQueue: SendingQueue;
    
    constructor(audioContextOptions: AudioContextManagerOptions) {
        this.audioContextManager = new AudioContextManager(audioContextOptions);
        this.apiClient = new ServerApiClient();
        this.myStreamId = Math.random().toString(36).substring(7); // Math.random();
        this.sendingQueue = new SendingQueue();
        this.initRecorder();
    }
    
    initRecorder(): void {
        if (this._released) {
            throw new Error("Already released");
        }
        Helper._log("init recorder");
        this.recorder = new RawOpusRecorder(this.audioContextManager);
        
        this.recorder.onstart = () => {
            this.apiClient.streamStart(this.myStreamId, []);
            Helper._log("Recorder started"); //, myStreamId);
        };
        
        this.recorder.onstop =  () => {
            this.apiClient.streamStop(this.myStreamId);
            Helper._log("Recorder stopped"); //, myStreamId);
        };
        
        this.recorder.onpause = () => {
            Helper._log("Recorder is paused");
        };
        
        this.recorder.onresume = () => {
            Helper._log("Recorder is resuming");
        };
        
        this.recorder.ondata = (typedArray: Int16Array, startTimestamp: number, encodeTimestamp: number) => {
            let bufferedAmmount = this.apiClient.ws.bufferedAmount;
            if (bufferedAmmount > ServerApi.MAX_BUFFERED_AMOUNT) {
                console.warn("Dropping recorder frame cause bufferedAmount is too high", bufferedAmmount);
                return;
            }
            let buffer = ByteBuffer.wrap(<any>typedArray);
            
            Promise.resolve().then((): any => {
                if (this.roomKey !== null) {
                    return Helper.aesGcmEncrypt(buffer, this.roomKey);
                }
                return buffer;
            })
            .then(buffer => {
                this.sendingQueue.send(() => {
                    this.apiClient.streamData({
                        streamName: this.myStreamId,
                        time: {
                            start: this.getTimestampStr(startTimestamp),
                            encode: encodeTimestamp - startTimestamp,
                            encrypt: Date.now() - startTimestamp
                        },
                        data: buffer
                    });
                });
            })
            .catch(console.log);
        };
    }
    
    server_connect(webSocketUrl: string) {
        if (this._released) {
            return Promise.reject("Already released");
        }
        return new Promise((resolve, reject) => {
            if (this.apiClient.ws) {
                return resolve();
            }
            
            let ws = new WebSocket(webSocketUrl);
            this._conn = true; // "connecting in progress" state
            
            ws.onopen = () => {
                if (this._disconnect) {
                    ws.close();
                    reject("Connected but get disconnect order earlier, so closing ws");
                    return;
                }
                this._conn = false;
                this.apiClient.ws = ws;
                Helper._log("WebSocket connected", webSocketUrl);
                // server_commitusername( );
                this._pinger = setInterval(this.server_ping.bind(this), 1000);
                resolve();
            };
            
            ws.onmessage = (message) => {
                message.data.arrayBuffer().then(async (result: ArrayBuffer) => {
                    var x = <Message>this.apiClient.pson.decode(Buffer.from(result));
                    if (this.apiClient.asyncHelper.receive(x)) {
                        // Handled somewhere else ...
                    }
                    else if (x.method == "streamStart") {
                        // _log("New incoming stream: " + x.params.streamId); // + " (clientId: " + x.params.clientId + ")");
                        this.startStream(x.params.streamId, x.params.peerId, x.params.info);
                    }
                    else if (x.method == "streamData") {
                        let data = x.params.data;
                        let st = this.remoteStreams[x.params.streamId];
                        if (!st) {
                            console.warn("Get data from not existing stream", x.params.streamId);
                            st = await this.startStream(x.params.streamId, null, null);
                        }
                        if (!st.canTakeMoreData()) {
                            console.log("Dropping frame from stream " + x.params.streamId + " cause audio buffer is already overloaded");
                            return;
                        }
                        if (ServerApi.DROPPING_EXPIRED_FRAMES && x.params.time) {
                            let sendTimestamp = this.decodeTimestamp(x.params.time.start);
                            let now = Date.now();
                            let delay = now - sendTimestamp - x.params.time.encrypt;
                            if (delay > ServerApi.MAX_DELAY) {
                                console.log("Dropping frame from stream " + x.params.streamId + " cause it exceed max delay", delay);
                                return;
                            }
                        }
                        st.markts();
                        if (this.roomKey !== null) {
                            Helper.aesGcmDecrypt(<Cipher>data, this.roomKey).then(retBuffer => st.input(retBuffer.toArrayBuffer()));
                        }
                        else {
                            st.input((<ByteBuffer>data).toArrayBuffer());
                        }
                    }
                    else if (x.method == "streamStop") {
                        // _log("Stopped stream: " + x.params.streamId);
                        this.stopStream(x.params.streamId);
                    }
                    else if (x.method == "peerHello") {
                        Helper._log("peerHello from: " + JSON.stringify(x.params));
                        this.assignRoomPerson(x.params.info.nickname, x.params.peerId);
                    }
                    else if (x.method == "peerInfo") {
                        Helper._log("peerInfo from: " + JSON.stringify(x.params));
                        this.assignRoomPerson(x.params.info.nickname, x.params.peerId);
                    }
                    else if (x.method == "peerBye") {
                        Helper._log("Bye from: " + JSON.stringify(x.params));
                        if (this.roomPeople[x.params.peerId]) {
                            clearInterval(this.roomPeople[x.params.peerId].pinger);
                            delete this.roomPeople[x.params.peerId];
                            this.roompeople_commit();
                        }
                    }
                    else if (x.method == "dingdong") {
                        // console.log("received dingdong..");
                        if (this.onDingDong) {
                            this.onDingDong();
                        }
                    }
                    else if (x.method == "message") {
                        if (x.params.data == "ping") {
                            this.apiClient.pongTo(x.params.from, x.params.tstamp);
                        }
                        else if (x.params.data == "pong") {
                            if (this.roomPeople[x.params.from]) {
                                this.roomPeople[x.params.from].ping = Date.now() - parseInt(x.params.tstamp);
                            }
                            else {
                                console.warn("Trying set ping of user " + x.params.from + " be it does not exist");
                            }
                            this.roompeople_commit();
                            // _log("Ping to '" + x.params.from + "': " + (Date.now() - x.params.tstamp))
                        }
                    }
                    else {
                        console.log("Unhandled message", x);
                    }
                });
            }
            
            ws.onclose = () => {
                Helper._log("--------------------------- WebSocket disconnected");
                this.apiClient.ws = null;
                this.releaseResources();
            };
            
            ws.onerror = (e) => {
                Helper._log("WebSocket error",e);
                this.apiClient.ws = null;
                this.releaseResources();
                if (this._conn) {
                    this._conn = false;
                    reject();
                }
            }
        });
    }
    
    server_commitusername( ) {
        // console.log("Cannot set username, username comes when you join to room")
        // server_call("peerInfo", { info: { nickname: _localname } })   // commituje globala ;)
        //     .then((result) => _log("Nickname set to " + _localname))
        //     .catch((error) => _log("ERROR: setname Failed"));
    }
    
    server_ping() {
        let start = Date.now();
        this.apiClient.ping().then(response => {
            var elapsed = this.saveServerTimestamp(start, parseInt(response.timestamp));
            if (this.onServerPing) {
                this.onServerPing(elapsed);
            }
        });
    }
    
    connection_ping(to: string) {
        return this.apiClient.pingTo(to);
    }
    
    roompeople_commit() {
        if (this.onRoomInfo) {
            this.onRoomInfo(this.roomPeople);
        }
    }
    
    server_dingdong() {
        return this.apiClient.dingDong();
    }
    
    peerpinger(id: string) {
        return () => this.apiClient.pingTo(id);
    }
    
    assignRoomPerson(nickname: string, peerId: string) {
        let person: RoomPerson = {
            nickname: nickname,
            peerId: peerId,
            ping: null,
            pinger: setInterval(this.peerpinger(peerId), 2345)
        };
        this.roomPeople[peerId] = person;
        this.roompeople_commit();
    }
    
    getPositionByIndex(index: number): PlayerPosition {
        return PositionCalculator.getPositionByIndex(ServerApi.MIN_ANGLE, ServerApi.MAX_ANGLE, index, this.peers.length);
    }
    
    getDefaultPosition(): PlayerPosition {
        return {x: 0, y: 1, z: 1};
    }
    
    registerStream(stream: RemoteStream) {
        this.remoteStreams[stream.id] = stream;
        if (!this.peers.includes(stream.peerId)) {
            Utils.addFunklyToList(this.peers, stream.peerId);
        }
        console.log("registerStream", stream.id, stream.peerId, this.peers);
        this.refreshPositions();
    }
    
    unregisterStream(stream: RemoteStream) {
        delete this.remoteStreams[stream.id];
        Utils.removeFromList(this.peers, stream.peerId);
        console.log("unregisterStream", stream.id, stream.peerId, this.peers);
        this.refreshPositions();
    }
    
    refreshPositions() {
        let streams = Object.values(this.remoteStreams);
        this.peers.forEach((peerId, i) => {
            let stream = streams.find(x => x.peerId == peerId);
            if (!stream) {
                console.log("refreshPositions setPosition no stream", peerId, i, this.getPositionByIndex(i));
                return;
            }
            console.log("refreshPositions setPosition", stream.id, peerId, i, this.getPositionByIndex(i));
            stream.player.setPosition(this.getPositionByIndex(i));
        });
    }
    
    async startStream(streamId: string, peerId: string, info: StreamInfo) {
        if (this._released) {
            throw new Error("Already released");
        }
        let stream = this.remoteStreams[streamId];
        if (stream) {
            return stream;
        }
        stream = new RemoteStream(this.audioContextManager, streamId, peerId, info, this.getDefaultPosition());
        this.registerStream(stream);
        await stream.init();
        return stream;
    }
    
    startStream2(streamId: string, peerId: string, info: StreamInfo) {
        if (this._released) {
            return Promise.reject("Already released");
        }
        let stream = this.remoteStreams[streamId];
        if (stream) {
            return stream.init();
        }
        stream = new RemoteStream(this.audioContextManager, streamId, peerId, info, this.getDefaultPosition());
        this.registerStream(stream);
        return stream.init();
    }
    
    stopStream(streamId: string) {
        let stream = this.remoteStreams[streamId];
        if (stream) {
            stream.stop();
            this.unregisterStream(stream);
        }
    }
    
    saveServerTimestamp(start: number, serverTimestamp: number) {
        let now = Date.now();
        let elapsed = now - start;
        let x = Math.floor(elapsed / 2);
        let myServerTimestamp = start + x;
        this.serverDiff = myServerTimestamp - serverTimestamp;
        // console.log("saveServerTimestamp", this.serverDiff, now, serverTimestamp, start, elapsed);
        return elapsed;
    }
    
    getTimestampStr(timestamp: number) {
        return (timestamp - this.serverDiff).toString();
    }
    
    decodeTimestamp(timestamp: string) {
        return parseInt(timestamp) + this.serverDiff;
    }
    
    // (name:String, key:ArrayBuffer) => Promise Status?
    async STREAMS_talk(webSocketUrl: string, room: RoomInfo, auth: string) {
        if (this._released) {
            throw new Error("Already released");
        }
        try {
            await this.server_connect(webSocketUrl);
            
            let start = Date.now();
            let res = await this.apiClient.roomJoin(room.name, auth);
            this.saveServerTimestamp(start, parseInt(res.timestamp));
            if (!res.success) {
                throw new Error("Cannot connect to stream");
            }
            let promises: Promise<any>[] = [];
            promises.push(this.recorder.start());
            
            this.clearPeopleAndStreams();
            this.roomKey = room.key;
            
            console.log("OnRoomJoin: Adding users", res.info);
            for (let info of (res.info || [])) {
                if (!this.roomPeople[info.peerId] && info.nickname != res.user) {
                    console.log("OnRoomJoin: Adding user", info);
                    this.assignRoomPerson(info.nickname, info.peerId);
                }
            }
            console.log("OnRoomJoin: Adding streams", res.streams);
            for (let stream of (res.streams || [])) {
                console.log("OnRoomJoin: Adding stream", stream);
                promises.push(this.startStream2(stream.stream_id, stream.peerId, []));
            }
            
            await Promise.all(promises);
            Helper._log("Connected to", room.name);
            this.roompeople_commit();
            
            return res.user;
        }
        catch (error) {
            Helper._log("connect Failed");
            throw error;
        }
    }
    
    // Bool => _
    STREAMS_mute(mute: boolean) {
        if (this.recorder) {
            if (mute) {
                this.recorder.pause();
            }
            else {
                this.recorder.resume();
            }
        }
    }
    
    // _ => _
    STREAMS_hangup() {
        this.releaseResources();
        this.closeWs();
    }
    
    releaseResources() {
        if (this._released) {
            return;
        }
        if (this.recorder) {
            this.recorder.stop();
            this.recorder = null;
        }
        this.audioContextManager.closeAudio();
        if (this._pinger) {
            clearInterval(this._pinger);
            this._pinger = null;
        }
        this.clearPeopleAndStreams();
        this._released = true;
    }
    
    clearPeopleAndStreams() {
        for (let k in this.roomPeople) {
            clearInterval(this.roomPeople[k].pinger);
        }
        this.roomPeople = {};
        for (let k in this.remoteStreams) {
            this.remoteStreams[k].stop();
        }
        this.remoteStreams = {};
        this.peers = [];
    }
    
    closeWs() {
        this._disconnect = true;
        if (this.apiClient.ws) {
            this.apiClient.ws.close();
            this.apiClient.ws = null;
        }
    }
}