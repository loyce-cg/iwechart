import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import {MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import {Lang} from "../../../utils/Lang";
import * as Q from "q";
import * as privfs from "privfs-client";
import {Inject} from "../../../utils/Decorators";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";

export class InitDataController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.initData.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "initdata";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject userConfig: privfs.types.core.UserConfig;
    
    alert: (message?: string) => Q.Promise<MsgBoxResult>;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.userConfig = this.parent.userConfig;
        this.alert = this.parent.alert.bind(this.parent);
    }
    
    onViewSaveInitData(initData: privfs.types.core.FullInitData): void {
        this.addTaskEx("", true, () => {
            return Q().then(() => {
                return this.srpSecure.setInitData(initData);
            })
            .then(() => {
                this.callViewMethod("onInitDataSave", true);
                this.alert(this.i18n("window.admin.initData.save.success"));
            })
            .fail(e => {
                this.onErrorCustom(this.i18n("window.admin.initData.save.error"), e);
                this.callViewMethod("onInitDataSave", false);
            });
        });
    }
    
    onViewShowAlert(msg: string): void {
        this.alert(msg);
    }
    
    onViewConfirmLangRemoval(lang: string): void {
        this.parent.confirm()
        .then(data => {
            if (data.result == "yes") {
                this.callViewMethod("callEditor", "removeLang", [lang]);
            }
        });
    }
    
    prepare(): Q.Promise<void> {
        return Q().then(() => {
            return this.srpSecure.getFullInitData();
        })
        .then(initData => {
            if (!initData) {
                initData = {
                    defaultLang: this.app.localeService.currentLang,
                    mailsDisabled: false,
                    langs: {}
                };
            }
            if (!initData.defaultLang) {
                initData.defaultLang = this.app.localeService.currentLang;
            }
            if (!(initData.defaultLang in initData.langs)) {
                initData.langs[initData.defaultLang] = [];
            }
            if (!Lang.containsFunc(initData.langs[initData.defaultLang], x => x.type == "sendMail")) {
                initData.langs[initData.defaultLang].push({
                    type: "sendMail",
                    subject: "",
                    content: "",
                    attachments: []
                });
            }
            this.callViewMethod("refreshContent", initData, (<any>this.userConfig).initDataEditMultipleLangs);
        });
    }
}
