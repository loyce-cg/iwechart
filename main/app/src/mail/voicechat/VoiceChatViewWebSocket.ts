import * as Q from "q";
import * as WebSocket from "ws";

export type Callback = (data: Buffer|ArrayBuffer) => void;

export class VoiceChatViewWebSocket {
    
    webSocket: WebSocket;
    callbacks: {[id: string]: Callback};
    id: number;
    connected: boolean = false;
    notifyCallback: (data: Buffer) => void;
    
    constructor() {
        this.id = 1;
    }
    
    connect(urlString: string) {
        if (this.webSocket) {
            return Q();
        }
        let connectDefer = Q.defer<void>();
        let url = new URL(urlString);
        this.webSocket = new WebSocket("ws://" + url.host + "/");
        this.webSocket.binaryType = "arraybuffer";
        this.webSocket.addEventListener("open", _event => {
            this.connected = true;
            connectDefer.resolve();
            connectDefer = null;
        });
        this.webSocket.addEventListener("message", event => {
            let buf = Buffer.from(event.data);
            let id = buf.readUInt32BE(0);
            let resData = buf.slice(4);

            if (id in this.callbacks) {
                this.callbacks[id](resData);
                delete this.callbacks[id];
            }
            else if (id == 0) {
                if (this.notifyCallback) {
                    Q().then(() => {
                        return this.notifyCallback(resData);
                    })
                    .fail(e => {
                        console.log("WebsocketChannel error during call notify callback:", e);
                    });
                }
                else {
                    // console.log("There is no notify callback");
                }
            }
            else {
                // console.log("There is no callback with id", id);
            }
        });
        this.webSocket.addEventListener("close", event => {
            // console.log(`WebsocketChannel closed:`, event);
            if (connectDefer) {
                connectDefer.reject("WebsocketChannel closed");
            }
            this.stop();
        });
        this.webSocket.addEventListener("error", event => {
            console.error(`WebsocketChannel error:`, event);
            if (connectDefer) {
                connectDefer.reject("WebsocketChannel error");
            }
            this.stop();
        });
        return connectDefer.promise;
    }
    
    disconnect() {
        if (!this.webSocket) {
            return;
        }
        this.webSocket.close();
        this.webSocket = null;
        this.callbacks = {};
    }
    
    sendCore(data: Buffer, callback: (data: Buffer|ArrayBuffer) => void) {
        let id = this.id++;

        let idBuf = Buffer.alloc(4);
        idBuf.writeUInt32BE(id, 0);
        let fullData = Buffer.concat([idBuf, data])
        this.webSocket.send(fullData);
        this.callbacks[id] = callback;
    }
    
    stop(): void {
        this.disconnect();
    }
}
