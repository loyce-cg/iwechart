import { IpcResponse, IpcRequest, WorkerThreadsModule, Port } from "./Types";
import * as PrivmxCrypto from "privmx-crypto";
import { CryptoSerializer } from "./CryptoSerializer";
var WorkerThreads: WorkerThreadsModule = require("worker_threads");

/** This code is executed in node worker! It just takes incoming data and call SyncService from privmx-crypto */
class CryptoWorker {
    
    workerId: number;
    cryptoSync: PrivmxCrypto.crypto.sync.CryptoSync;
    
    constructor(public port: Port, workerData: any) {
        this.cryptoSync = new PrivmxCrypto.crypto.sync.CryptoSync();
        this.workerId = workerData ? workerData.id : null;
        this.port.on("message", this.onMessage.bind(this));
    }
    
    onMessage(request: IpcRequest) {
        if (!request) {
            console.log("[!Worker " + this.workerId + "] invalid message", request);
            return;
        }
        try {
            let res = this.execute(request.method, request.params);
            let response: IpcResponse = {
                id: request.id,
                result: res
            };
            this.port.postMessage(response, PrivmxCrypto.crypto.webworker.Helper.getTransferable(res));
        }
        catch (e) {
            let response: IpcResponse = {
                id: request.id,
                error: e
            };
            this.port.postMessage(response, PrivmxCrypto.crypto.webworker.Helper.getTransferable(e));
        }
    }
    
    execute(method: string, params: any) {
        if (method == "setEntropy") {
            return;
        }
        let decodedParams = CryptoSerializer.decode(params, false);
        let service = <any>this.cryptoSync;
        let res = service[method].apply(service, decodedParams);
        return CryptoSerializer.encode(res, false);
    }
}

let worker = new CryptoWorker(WorkerThreads.parentPort, WorkerThreads.workerData);