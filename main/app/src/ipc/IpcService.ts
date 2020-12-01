import * as RootLogger from "simplito-logger";
import * as Q from "q";
import {ipc} from "../Types";

let Logger = RootLogger.get("privfs-mail-client.ipc.renderer.IpcSender");

export class IpcService {
    
    map: {[key: string]: Q.Deferred<any>};
    index: number;
    
    static create<T = any>(ipcRenderer: ipc.IpcRenderer, serviceDefinition: ipc.IpcServiceDefinition): T {
        let service = <any>{};
        let ipcService = new IpcService(ipcRenderer, serviceDefinition.inChannelName, serviceDefinition.outChannelName);
        serviceDefinition.methods.forEach(methodName => {
            service[methodName] = function(...args: any[]) {
                return ipcService.send(methodName, args)
            };
        });
        return service;
    }
    
    constructor(public ipcRenderer: ipc.IpcRenderer, public inChannelName: string, public outChannelName: string) {
        this.map = {};
        this.index = 0;
        
        this.ipcRenderer.on(this.outChannelName, (_event: ipc.IpcRendererEvent, arg: ipc.IpcResponse) => {
            Logger.debug("receive response", arg);
            let entry = this.map[arg.id];
            if (arg.success) {
                entry.resolve(arg.value);
            }
            else {
                if (arg.value && Object.keys(arg.value).length == 3 && arg.value.name && arg.value.message && arg.value.stack) {
                    let error = new Error()
                    error.name = arg.value.name
                    error.message = arg.value.message
                    error.stack = arg.value.stack
                    entry.reject(error)
                }
                else {
                    entry.reject(arg.value);
                }
            }
            delete this.map[arg.id];
        });
    }
    
    send<T>(method: string, params?: any[]): Q.Promise<T> {
        let defer = Q.defer();
        this.index++
        this.map[this.index] = defer;
        let request: ipc.IpcRequest = {
            id: this.index,
            method: method,
            params: params
        };
        Logger.debug("send request", request);
        this.ipcRenderer.send(this.inChannelName, request);
        return <Q.Promise<T>>defer.promise;
    }
}
