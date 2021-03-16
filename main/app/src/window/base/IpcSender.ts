import {BaseWindowController} from "./BaseWindowController";
import * as RootLogger from "simplito-logger";

let Logger = RootLogger.get("privfs-mail-client.window.base.IpcSender");

export type IpcListener = (event: any, arg: any) => any;

export class IpcSender {
    
    channel: string;
    private destroyed: boolean;
    
    constructor(public controller: BaseWindowController, channelId: string) {
        this.channel = channelId;
        this.destroyed = false;
    }
    
    send(data: any): void {
        if (this.destroyed || this.controller.isDestroyed()) {
            Logger.warn("Trying send ipc data through destroyed sender");
            return;
        }
        if (this.controller.nwin) {
            this.controller.nwin.sendIpc(this.channel, data);
        }
    }
    
    addListener(listener: IpcListener): void {
        if (this.destroyed || this.controller.isDestroyed()) {
            Logger.warn("Trying add listener to destroyed ipc sender");
            return;
        }
        this.controller.app.addIpcListener(this.channel, listener);
    }
    
    destroy(): void {
        this.controller.app.removeAllIpcListeners(this.channel);
        this.destroyed = true;
    }
}