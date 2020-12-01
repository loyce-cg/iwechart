import * as RootLogger from "simplito-logger";
import * as Q from "q";
import {ipc} from "../Types";
let Logger = RootLogger.get("privfs-mail-client.ipc.IpcContainer");

export class IpcHolder {
    
    services: {[name: string]: ipc.IpcContainerEntry};
    
    constructor(public ipcMain: ipc.IpcMain) {
        this.services = {};
    }
    
    getServicesDefinitions(): ipc.IpcServicesDefinitions {
        let result: ipc.IpcServicesDefinitions = {};
        for (let serviceName in this.services) {
            let entry = this.services[serviceName];
            result[entry.serviceName] = {
                serviceName: entry.serviceName,
                inChannelName: entry.inChannelName,
                outChannelName: entry.outChannelName,
                methods: entry.methods
            };
        }
        return result;
    }
    
    register(serviceName: string, service: any): void {
        if (serviceName in this.services) {
            throw new Error("Service with name '" + serviceName + "' already exists");
        }
        let entry = this.services[serviceName] = {
            serviceName: serviceName,
            service: service,
            inChannelName: serviceName + "Request",
            outChannelName: serviceName + "Response",
            methods: (<any>service).__exportedMethods || []
        };
        this.ipcMain.on(entry.inChannelName, (event: ipc.IpcMainEvent, arg: ipc.IpcRequest) => {
            Logger.debug("receive request", arg)
            Q().then(() => {
                if (entry.methods.indexOf(arg.method) == -1) {
                    throw new Error("No method with name '" + arg.method + "'");
                }
                return service[arg.method].apply(service, arg.params).then((x: any) => {
                    let response: ipc.IpcResponse = {
                        id: arg.id,
                        success: true,
                        value: x
                    };
                    return response;
                }, (e: any) => {
                    Logger.error("IPC request error", e);
                    if (e instanceof Error) {
                        e = {
                            name: e.name,
                            message: e.message,
                            stack: e.stack
                        };
                    }
                    let response: ipc.IpcResponse = {
                        id: arg.id,
                        success: false,
                        value: e
                    };
                    return response;
                });
            })
            .then(response => {
                return event.sender.send(entry.outChannelName, response);
            })
            .fail(e => {
                Logger.error("Unexpected error during processing ipc event", arg, e);
            });
        });
    }
}