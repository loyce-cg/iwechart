import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {Inject} from "../../../utils/Decorators";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";

export class CronController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.cron.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "cron";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.srpSecure = this.parent.srpSecure;
        this.ipcMode = true;
    }
    
    prepare(): Q.Promise<void> {
        return Q().then(() => {
            return this.srpSecure.getConfigEx();
        })
        .then(config => {
            this.callViewMethod("renderContent", config);
        });
    }
}
