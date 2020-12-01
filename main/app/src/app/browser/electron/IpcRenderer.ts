import * as RootLogger from "simplito-logger";
import {ipc} from "../../../Types";
import {IpcMain} from "./IpcMain";
let Logger = RootLogger.get("privfs-mail-client.app.browser.electron.IpcRenderer");

export class IpcRenderer implements ipc.IpcRenderer {
    
    id: number;
    ipcMain: IpcMain;
    listeners: {[name: string]: ipc.IpcRendererListener[]};
    sender: ipc.IpcSender;
    
    constructor(id: number, ipcMain: IpcMain) {
        this.ipcMain = ipcMain;
        this.listeners = {};
        this.sender = {
            id: id,
            send: (channel: string, data: any) => {
                this.dispatchEvent(channel, data);
            }
        }
    }
    
    on(channel: string, listener: ipc.IpcRendererListener): void {
        if (!(channel in this.listeners)) {
            this.listeners[channel] = [];
        }
        this.listeners[channel].push(listener);
    }
    
    send(channel: string, data: any): void {
        this.ipcMain.dispatchEvent({sender: this.sender}, channel, data);
    }
    
    dispatchEvent(channel: string, data: any): void {
        let listeners = this.listeners[channel];
        if (listeners == null) {
            return;
        }
        let event: ipc.IpcRendererEvent = {senderId: 0};
        for (let i = 0; i < listeners.length; i++) {
            try {
                listeners[i](event, data);
            }
            catch (e) {
                Logger.error("Error during calling renderer ipc listener", e);
            }
        }
    }
    
    removeListener(channel: string, listener: ipc.IpcRendererListener): void {
        let listeners = this.listeners[channel];
        if (listeners == null) {
            return;
        }
        let index = listeners.indexOf(listener);
        if (index != -1) {
            listeners.splice(index, 1);
        }
    }
    
    removeAllListeners(channel: string): void {
        delete this.listeners[channel];
    }
}

