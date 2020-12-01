import {window, Types, Q, mail} from "pmc-mail";
import {AdditionalLoginStepData} from "../../main/TwofaService";
import {TwofaApi} from "../../main/TwofaApi";
import {i18n} from "./i18n/index";

export interface Model {
    data: AdditionalLoginStepData;
    cancellable: boolean;
}

export class CodeWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.twofa.window.code.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    data: AdditionalLoginStepData;
    api: TwofaApi;
    defer: Q.Deferred<void>;
    cancellable: boolean;
    
    constructor(parent: Types.app.WindowParent, data: AdditionalLoginStepData, api: TwofaApi, cancellable?: boolean) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.data = data;
        this.cancellable = !!cancellable;
        
        this.setPluginViewAssets("twofa");
        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = 400;
        this.openWindowOptions.height = 400;
        this.openWindowOptions.modal = true;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.title = this.i18n("plugin.twofa.window.code.title");
        this.api = api;
        this.defer = Q.defer<void>();
    }
    
    static isSupported(data: AdditionalLoginStepData) {
        return data.type == "googleAuthenticator" ||  data.type == "email" ||  data.type == "sms";
    }
    
    getModel(): Model {
        return {
            data: this.data,
            cancellable: this.cancellable,
        };
    }
    
    getPromise(): Q.Promise<void> {
        return this.defer.promise;
    }
    
    onViewSubmit(code: string, rememberDeviceId: boolean) {
        Q().then(() => {
            return this.api.challenge(code, rememberDeviceId);
        })
        .then(() => {
            this.callViewMethod("clearState");
            this.defer.resolve();
            this.close();
        })
        .fail(e => {
            this.logError(e);
            if (e && e.data && e.data.error && e.data.error.code == TwofaApi.TWOFA_INVALID_CODE) {
                this.callViewMethod("clearState");
                this.callViewMethod("showMessage", "error", this.i18n("plugin.twofa.window.code.invalid", e.data.error.data));
            }
            else if (e && e.data && e.data.error && e.data.error.code == TwofaApi.TWOFA_VERIFICATION_FAILED) {
                this.callViewMethod("clearState");
                this.defer.reject("additional-login-step-fail")
                this.close();
            }
            else {
                this.callViewMethod("clearState");
                this.callViewMethod("showMessage", "error", this.i18n("plugin.twofa.window.code.error.unexpected"));
            }
        });
    }
    
    onViewCancel(): void {
        if (this.cancellable) {
            this.close();
        }
    }
    
    onViewResend() {
        Q().then(() => {
            return this.api.resendCode();
        })
        .then(() => {
            this.callViewMethod("showMessage", "success", this.i18n("plugin.twofa.window.code.resend.success"));
            this.callViewMethod("clearState");
        })
        .fail(e => {
            this.logError(e);
            if (e && e.data && e.data.error && e.data.error.code == TwofaApi.TWOFA_CODE_ALREADY_RESEND) {
                this.callViewMethod("showMessage", "info", this.i18n("plugin.twofa.window.code.resend.alreadyResent"));
            }
            else {
                this.callViewMethod("showMessage", "error", this.i18n("plugin.twofa.window.code.resend.error"));
            }
            this.callViewMethod("clearState");
        });
    }
    
    close(force?: boolean): Q.IWhenable<void> {
        return Q().then(() => {
            return super.close(force);
        })
        .then(() => {
            this.defer.reject("additional-login-step-cancel");
        });
    }
}