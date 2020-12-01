import * as RootLogger from "simplito-logger";
import {ipc} from "../../../Types";
let Logger = RootLogger.get("privfs-mail-client.app.browser.electron.IpcMain");

export class IpcMain {
    
    ipcListeners: {[channel: string]: ipc.IpcMainListener[]};
    
    constructor() {
        this.ipcListeners = {};
    }
    
    dispatchEvent(event: ipc.IpcMainEvent, channel: string, data: any): void {
        let listeners = this.ipcListeners[channel];
        if (listeners == null) {
            return;
        }
        for (let i = 0; i < listeners.length; i++) {
            try {
                listeners[i](event, data);
            }
            catch (e) {
                Logger.error("Error during calling main ipc listener", e);
            }
        }
    }
    
    addIpcListener(channel: string, listener: ipc.IpcMainListener): void {
        if (!(channel in this.ipcListeners)) {
            this.ipcListeners[channel] = [];
        }
        this.ipcListeners[channel].push(listener);
    }
    
    removeAllIpcListeners(channel: string): void {
        delete this.ipcListeners[channel];
    }
    
    on(channel: string, listener: ipc.IpcMainListener): void {
        return this.addIpcListener(channel, listener);
    }
}