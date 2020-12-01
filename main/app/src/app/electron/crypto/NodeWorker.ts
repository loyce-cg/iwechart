import { IpcResponse, IpcRequest, TransferListItem, Worker } from "./Types";
import * as Q from "q";

/** Generic class for communication with node worker. It uses a simple 'call' method which returns promise */
export class NodeWorker {
    
    messageId: number;
    map: {[id: string]: {defer: Q.Deferred<any>}};
    
    constructor(
        public id: number,
        public worker: Worker
    ) {
        this.messageId = 0;
        this.map = {};
    }
    
    onMessage(response: IpcResponse) {
        if (!response) {
            console.log("[Worker " + this.id + "] Get invalid message", response);
            return;
        }
        let entry = this.map[response.id];
        delete this.map[response.id];
        if (!entry) {
            console.log("[Worker " + this.id + "] Get message with invalid id", response);
            return;
        }
        if (response.error) {
            entry.defer.reject(response.error);
        }
        else {
            entry.defer.resolve(response.result);
        }
    }
    
    async call<T = any>(method: string, params: any, transferList?: TransferListItem[]): Promise<T> {
        let id = this.messageId++;
        let defer = Q.defer<T>();
        let request: IpcRequest = {
            id: id,
            method: method,
            params: params
        };
        this.map[id] = {
            defer: defer
        };
        this.worker.postMessage(request, transferList);
        return defer.promise;
    }
    
    cleanup() {
        for (let id in this.map) {
            this.map[id].defer.reject("Worker " + this.id + " closed");
        }
        this.map = {};
    }
}