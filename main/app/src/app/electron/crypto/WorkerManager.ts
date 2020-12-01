import { NodeWorker } from "./NodeWorker";
import { Lang } from "../../../utils/Lang";
import * as Q from "q";
import { TransferListItem, WorkerThreadsModule } from "./Types";
var WorkerThreads: WorkerThreadsModule = require("worker_threads");

/** Generic class for holding multiple workers and spread calls to them */
export class WorkerManager {
    
    requestId: number;
    workerId: number;
    workers: NodeWorker[];
    stopped: boolean;
    
    constructor(
        public scriptPath: string
    ) {
        this.requestId = 0;
        this.workerId = 0;
        this.workers = [];
        this.stopped = false;
    }
    
    addWorkers(count: number) {
        for (let i = 0; i < count; i++) {
            this.addWorker();
        }
    }
    
    addWorker() {
        if (this.stopped) {
            throw new Error("WorkerManager is stopped");
        }
        let workerId = this.workerId++;
        let nodeWorker = new WorkerThreads.Worker(this.scriptPath, {workerData: {id: workerId}});
        let worker = new NodeWorker(workerId, nodeWorker);
        this.workers.push(worker);
        nodeWorker.on("message", worker.onMessage.bind(worker));
        nodeWorker.on("error", e => {
            console.log("[Worker " + workerId + "] Error", e);
        });
        nodeWorker.on("exit", code => {
            if (this.stopped) {
                return;
            }
            console.log("[Worker " + workerId + "] Stopped with exit code", code);
            Lang.removeFromList(this.workers, worker);
            this.addWorker();
        });
    }
    
    stop() {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        for (let worker of this.workers) {
            worker.cleanup();
            worker.worker.terminate();
        }
        this.workers = [];
    }
    
    call<T = any>(method: string, params: any, transferList?: TransferListItem[]): Q.Promise<T> {
        return Q().then(() => {
            if (this.workers.length == 0) {
                throw new Error("No workers");
            }
            if (this.stopped) {
                throw new Error("Stopped");
            }
            let id = this.requestId++;
            let worker = this.workers[id % this.workers.length];
            return worker.call(method, params, transferList);
        });
    }
}