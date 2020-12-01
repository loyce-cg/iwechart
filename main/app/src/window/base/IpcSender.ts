import {BaseWindowController} from "./BaseWindowController";

export type IpcListener = (event: any, arg: any) => any;

export class IpcSender {
    
    channel: string;
    
    constructor(public controller: BaseWindowController, channelId: string) {
        this.channel = channelId;
    }
    
    send(data: any): void {
        if (this.controller.nwin) {
            this.controller.nwin.sendIpc(this.channel, data);
        }
    }
    
    addListener(listener: IpcListener): void {
        this.controller.app.addIpcListener(this.channel, listener);
    }
    
    destroy(): void {
        this.controller.app.removeAllIpcListeners(this.channel);
    }
}