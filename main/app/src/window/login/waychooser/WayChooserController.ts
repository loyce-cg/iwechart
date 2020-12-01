import {WindowComponentController} from "../../base/WindowComponentController";
import {LoginWindowController} from "../LoginWindowController";
import {MsgBoxOptions, MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import {app} from "../../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import {ElectronApplication} from "../../../app/electron/ElectronApplication";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface RemeberModel {
    hashmail: {
        value: string;
        checked: boolean;
    };
    password: {
        value: string;
        checked: boolean;
    };
}

export interface Model {
    active: string;
}

export class WayChooserController extends WindowComponentController<LoginWindowController> {
    
    static textsPrefix: string = "window.login.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    alert: (message?: string) => Q.Promise<MsgBoxResult>;
    confirmEx: (options: MsgBoxOptions) => Q.Promise<MsgBoxResult>;
    
    constructor(parent: LoginWindowController) {
        super(parent);
        this.ipcMode = true;
    }
    
    getModel(): Model {
        return {
            active: "wayChooser"
        };
    }
        
    reinit(): void {
        this.callViewMethod("reinit");
    }

    onViewAction(action: string): void {
        if (action == "managers-zone") {
            this.parent.openActivateNewWay();
        }
        else
        if (action == "members-zone") {
            this.parent.openLogin();
        }
    }
}
