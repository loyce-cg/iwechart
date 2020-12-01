import {MsgBox} from "../app/common/MsgBox";
import {MsgBoxOptions, MsgBoxResult} from "../window/msgbox/MsgBoxWindowController";
import {CommonApplication} from "../app/common/CommonApplication";
import {ApiMethod, ApiService} from "../utils/Decorators";
import {IMsgBoxService} from "../common/service/IMsgBoxService";
import {SubIdWindowController, Model as SubIdModel} from "../window/subid/SubIdWindowController";
import {app} from "../Types";

@ApiService
export class MsgBoxService implements IMsgBoxService {
    
    constructor(public app: CommonApplication) {
    }
    
    getWindowParentByController(controlerId: number): app.WindowParentEx {
        let parent = this.app.getFromObjectMap(controlerId);
        return parent ? parent : this.app;
    }
    
    getMsgBoxByController(controlerId: number): MsgBox {
        let parent = this.app.getFromObjectMap(controlerId);
        return parent ? parent : this.app.msgBox;
    }
    
    @ApiMethod
    alert(controlerId: number, message?: string): Q.Promise<MsgBoxResult> {
        return this.getMsgBoxByController(controlerId).alert(message);
    }
    
    @ApiMethod
    alertEx(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.getMsgBoxByController(controlerId).alertEx(options);
    }
    
    @ApiMethod
    confirm(controlerId: number, message?: string): Q.Promise<MsgBoxResult> {
        return this.getMsgBoxByController(controlerId).confirm(message);
    }
    
    @ApiMethod
    confirmEx(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.getMsgBoxByController(controlerId).confirmEx(options);
    }
    
    @ApiMethod
    prompt(controlerId: number, message?: string, value?: string): Q.Promise<MsgBoxResult> {
        return this.getMsgBoxByController(controlerId).prompt(message, value);
    }
    
    @ApiMethod
    promptEx(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.getMsgBoxByController(controlerId).promptEx(options);
    }
    
    @ApiMethod
    msgBox(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.getMsgBoxByController(controlerId).msgBox(options);
    }
    
    @ApiMethod
    subId(controllerId: number, model: SubIdModel): Q.Promise<void> {
        let parent = this.getWindowParentByController(controllerId);
        return this.app.ioc.create(SubIdWindowController, [parent, model]).then(win => {
            return parent.openChildWindow(win).getPromise();
        });
    }
}