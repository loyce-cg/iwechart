import {MsgBoxOptions, MsgBoxResult} from "../msgbox/MsgBoxWindowController";
import {IMsgBoxService} from "../../common/service/IMsgBoxService";
import {Model as SubIdModel} from "../subid/SubIdWindowController";

export class MsgBoxViewService  {
    
    constructor(public controllerId: number, public msgBoxService: IMsgBoxService) {
    }
    
    alert(message?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxService.alert(this.controllerId, message);
    }
    
    alertEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxService.alertEx(this.controllerId, options);
    }
    
    confirm(message?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxService.confirm(this.controllerId, message);
    }
    
    confirmEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxService.confirmEx(this.controllerId, options);
    }
    
    prompt(message?: string, value?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxService.prompt(this.controllerId, message, value);
    }
    
    promptEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxService.promptEx(this.controllerId, options);
    }
    
    msgBox(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxService.msgBox(this.controllerId, options);
    }
    
    subId(model: SubIdModel): Q.Promise<void> {
        return this.msgBoxService.subId(this.controllerId, model);
    }
}