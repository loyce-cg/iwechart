import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";

export interface SmtpInnerConfig {
    port: number;
    auth: boolean;
    username: string;
    password: string;
}

export interface SmtpConfig {
    type: string;
    smtpCfg?: SmtpInnerConfig;
}

export class SmtpController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.smtp.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "smtp";
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
    }
    
    onViewSave(channelId: number, config: SmtpConfig) {
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            return Q().then(() => {
                //return this.app.mailClientApi.srpSecure.setSmtpConfig(config);
            })
            .then(() => {
                this.callViewMethod("showSaveSuccess");
            })
            .fail(e => {
                this.logError(e);
                this.callViewMethod("showSaveError");
            });
        });
    }
    
    prepare(): Q.Promise<void> {
        return Q().then(() => {
            //return this.app.mailClientApi.srpSecure.getSmtpConfig();
        })
        .then(config => {
            this.callViewMethod("refreshContent", config);
        });
    }
}
