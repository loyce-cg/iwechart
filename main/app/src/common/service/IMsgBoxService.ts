import {MsgBoxOptions, MsgBoxResult} from "../../window/msgbox/MsgBoxWindowController";
import {Model as SubIdModel} from "../../window/subid/SubIdWindowController";

export interface IMsgBoxService {
    alert(controlerId: number, message?: string): Q.Promise<MsgBoxResult>;
    alertEx(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult>;
    confirm(controlerId: number, message?: string): Q.Promise<MsgBoxResult>;
    confirmEx(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult>;
    prompt(controlerId: number, message?: string, value?: string): Q.Promise<MsgBoxResult>;
    promptEx(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult>;
    msgBox(controlerId: number, options: MsgBoxOptions): Q.Promise<MsgBoxResult>;
    subId(controllerId: number, model: SubIdModel): Q.Promise<void>;
}
