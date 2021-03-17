import {WindowComponentController} from "../../base/WindowComponentController";
import {LoginWindowController} from "../LoginWindowController";
import {MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import {app} from "../../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    host: string;
    isAdmin: boolean;
    keyCorrect: boolean;
}

export class ActivateController extends WindowComponentController<LoginWindowController> {
    
    static textsPrefix: string = "window.login.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    alert: (message?: string) => Q.Promise<MsgBoxResult>;
    
    constructor(parent: LoginWindowController) {
        super(parent);
        this.ipcMode = true;
        this.alert = this.parent.alert.bind(this.parent);
    }
    
    getModel(): Model {
        return {
            host: this.app.getRegisterTokenInfo().domain,
            isAdmin: this.app.getRegisterTokenInfo().isAdmin,
            keyCorrect: false
        };
    }

    async getHostInputFromView(): Promise<string> {
        return this.retrieveFromView<string>("getHost");
    }    
    onViewOpenLogin(): void {
        this.parent.openLogin();
    }
}
