import {WindowComponentController} from "../../base/WindowComponentController";
import {LoginWindowController} from "../LoginWindowController";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    desktopDownloadUrl: string;
    desktopDownloadUrls: {
        linux: string;
        win32: string;
        darwin: string;
    };
    webAccessEnabled: boolean;
    registerFromDesktopApp: boolean;
    isAdmin: boolean;
    login: string;
}

export class AfterRegisterController extends WindowComponentController<LoginWindowController> {
    
    static textsPrefix: string = "window.login.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    model: Model;
    
    constructor(parent: LoginWindowController, model: Model) {
        super(parent);
        this.ipcMode = true;
        this.model = model;
    }
    
    getModel(): Model {
        return this.model;
    }
    
    onViewLogin() {
        this.parent.openLogin();
    }
    
    onViewDownload() {
        this.parent.app.openUrl(this.model.desktopDownloadUrl);
    }
    
    updateInfo(login: string, isAdmin: boolean): void {
        this.callViewMethod("onUpdateInfo", login, isAdmin);
    }
}
