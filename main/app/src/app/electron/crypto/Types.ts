export interface IpcRequest<T = any> {
    id: number;
    method: string;
    params: T;
}

export interface IpcResponse<T = any> {
    id: number;
    result?: T;
    error?: any;
}

// ==================================
// Typings for  worker_threads module, can be removed after upgrading node typings to >= 10
// ==================================

export type TransferListItem = ArrayBuffer;

export interface Worker {
    new(scriptPath: string, options?: {workerData?: any}): Worker;
    postMessage(data: any, transferList?: TransferListItem[]): void;
    terminate(): void;
    on(type: "message", callback: (message: any) => void): void;
    on(type: "error", callback: (error: any) => void): void;
    on(type: "exit", callback: (code: number) => void): void;
}

export interface Port {
    on(type: "message", callback: (message: any) => void): void;
    postMessage(data: any, transferList?: TransferListItem[]): void;
}

export interface WorkerThreadsModule {
    Worker: Worker;
    parentPort: Port;
    workerData: any;
}