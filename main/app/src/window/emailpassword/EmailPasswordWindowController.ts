import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app} from "../../Types";
import {Utils as PasswordUtils} from "../../utils/Utils";
import {LowUser, LowUserService} from "../../mail/LowUser"
import {Inject} from "../../utils/Decorators"
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface EmailPasswordResult {
    result: string;
    value: EmailPasswordModel;
}

export interface EmailPasswordModel {
    password: string;
    hint: string;
    email: string;
    lang: string;
    withPassword: boolean;
}


export class EmailPasswordWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.emailpassword.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject lowUserService: LowUserService;
    result: string;
    value: EmailPasswordModel;
    model: EmailPasswordModel;
    editLowUser: LowUser;
    deferred: Q.Deferred<EmailPasswordResult>;
    
    constructor(parent: app.WindowParent, model: EmailPasswordModel, editLowUser?: LowUser) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.model = model;
        this.editLowUser = editLowUser;
        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = 650;
        this.openWindowOptions.height = 530;
        this.openWindowOptions.modal = true;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.title = this.i18n("window.emailpassword.title");
        this.deferred = Q.defer<EmailPasswordResult>();
    }
    
    getModel(): EmailPasswordModel {
        return this.model;
    }
    
    
    onViewAction(result: string, value: EmailPasswordModel): void {
        this.result = result;
        this.value = value;
        if (this.result == "ok") {
            if (!this.value || (this.value.withPassword && !this.value.password)) {
                this.alert(this.i18n("window.emailpassword.invalidPassword"));
            }
            else {
                if (this.editLowUser) {
                    this.callViewMethod("startProcessing");
                    Q.delay(10).then(() => {
                        return this.lowUserService.editUser(this.editLowUser, this.value.password, this.value.hint, this.value.lang);
                    })
                    .then(() => {
                        this.callViewMethod("stopProcessing");
                        this.closeCore();
                    })
                    .fail(e => {
                        this.callViewMethod("stopProcessing");
                        this.onError(e);
                    });
                }
                else {
                    this.closeCore();
                }
            }
        }
        else {
            this.closeCore();
        }
    }
    
    onViewEscape(): void {
        this.close();
    }
    
    onViewGeneratePassword(): void {
        this.callViewMethod("setGeneratedPassword", PasswordUtils.randomPassword(8));
    }
    
    close(_force?: boolean): void {
        this.result = "close";
        this.value = null;
        this.closeCore();
    }
    
    closeCore(): Q.Promise<void> {
        if (typeof(this.result) == "undefined") {
            this.result = "close";
            this.value = null;
        }
        let controller = this;
        return Q().then(() => {
            return BaseWindowController.prototype.close.call(controller);
        })
        .then(() => {
            controller.deferred.resolve({
                result: this.result,
                value: this.value
            });
        });
    }
    
    getPromise(): Q.Promise<EmailPasswordResult> {
        return this.deferred.promise;
    }
}
