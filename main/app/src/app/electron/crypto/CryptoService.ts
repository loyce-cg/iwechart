import { CryptoSerializer } from "./CryptoSerializer";
import { WorkerManager } from "./WorkerManager";
import * as PrivmxCrypto from "privmx-crypto";

/** Overlay for WorkerManager to encode/decode data before and after calling a worker.
  * It always implements CryptoService interface for privmx-crypto */
export class CryptoService {
    
    constructor(
        public workerManager: WorkerManager
    ) {
    }
    
    async execute(method: string, params: any) {
        let p = CryptoSerializer.encode(params, true);
        let res = await this.workerManager.call(method, p, PrivmxCrypto.crypto.webworker.Helper.getTransferable(p));
        return CryptoSerializer.decode(res, false);
    }
}