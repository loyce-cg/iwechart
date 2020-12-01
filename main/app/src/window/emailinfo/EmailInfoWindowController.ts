import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import {EmailPasswordWindowController} from "../emailpassword/EmailPasswordWindowController";
import {LowUser, LowUserService} from "../../mail/LowUser";
import {Inject} from "../../utils/Decorators"
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface EmailInfoModel {
    password?: string;
    link?: string;
    hint?: string;
    lowUser?: LowUser;
}

export class EmailInfoWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.emailinfo.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject lowUserService: LowUserService;
    model: EmailInfoModel;
    
    constructor(parent: app.WindowParent, model: EmailInfoModel) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.model = model;
        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = 550;
        this.openWindowOptions.height = 430;
        this.openWindowOptions.modal = true;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.title = this.i18n("window.emailinfo.title");
    }
    
    getModel(): EmailInfoModel {
        return this.model;
    }
    
    onViewAction(_result: string): void {
        this.close();
    }
    
    onViewEditUser() {
        if (!this.model.lowUser) {
            return;
        }
        this.app.ioc.create(EmailPasswordWindowController, [this, {
            password: this.model.password,
            hint: this.model.hint,
            email: this.model.lowUser.email,
            lang: this.model.lowUser.language,
            withPassword: this.model.lowUser.password != ""
        }, this.model.lowUser]).then(win => {
            this.openChildWindow(win).getPromise().then(r => {
                if (r.result != "ok") {
                    return;
                }
                this.model.password = r.value.password;
                this.model.hint = r.value.hint;
                this.callViewMethod("refresh", this.model);
            });
        });
    }
    
    onViewBlockUser() {
        this.addTaskEx("", true, () => {
            this.callViewMethod("startProcessing", "block-user");
            return this.lowUserService.modifyUserBlocked(this.model.lowUser, true).then(() => {
                this.callViewMethod("stopProcessing", "block-user");
                this.callViewMethod("refresh", this.model);
            });
        });
    }
    
    onViewUnblockUser() {
        this.addTaskEx("", true, () => {
            this.callViewMethod("startProcessing", "unblock-user");
            return this.lowUserService.modifyUserBlocked(this.model.lowUser, false).then(() => {
                this.callViewMethod("stopProcessing", "unblock-user");
                this.callViewMethod("refresh", this.model);
            });
        });
    }
}
