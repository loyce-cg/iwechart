import {IpcRenderer} from "./IpcRenderer";
import {app, ipc} from "../../../Types";

export class IpcSender implements app.IpcSender {
    
    constructor(public channel: string, public ipc: IpcRenderer) {
    }
    
    send(params: any) {
        this.ipc.dispatchEvent(this.channel, params);
    }
    
    addListener(listener: ipc.IpcMainListener): void {
        this.ipc.ipcMain.addIpcListener(this.channel, listener);
    }
    
    destroy(): void {
        this.ipc.ipcMain.removeAllIpcListeners(this.channel);
    }
}