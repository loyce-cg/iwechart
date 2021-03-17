import {window, Types, Q, mail, app} from "pmc-mail";
import {AdditionalLoginStepData} from "../../main/TwofaService";
import {TwofaApi, ChallengeModel} from "../../main/TwofaApi";
import {i18n} from "./i18n/index";
import * as webauthn from "webauthn-js";
import {DataEncoder} from "../../main/DataEncoder";

export interface Model {
    data: AdditionalLoginStepData;
    cancellable: boolean;
    u2f: U2FData;
}

export interface U2FData {
    register: webauthn.Types.PublicKeyCredentialCreationOptions;
    login: webauthn.Types.PublicKeyCredentialRequestOptions;
}

export interface CodeWindowOptions {
    data: AdditionalLoginStepData,
    api: TwofaApi,
    cancellable: boolean,
    host: string,
    u2f: U2FData
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
    u2f: U2FData;
    
    constructor(parent: Types.app.WindowParent, options: CodeWindowOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.data = options.data;
        this.cancellable = !!options.cancellable;
        
        this.setPluginViewAssets("twofa");
        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = 400;
        this.openWindowOptions.height = 200;
        this.openWindowOptions.modal = true;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.title = this.i18n("plugin.twofa.window.code.title");
        this.openWindowOptions.electronPartition = app.ElectronPartitions.HTTPS_SECURE_CONTEXT;
        (<any>this.loadWindowOptions).host = options.host;
        this.api = options.api;
        this.u2f = options.u2f;
        this.defer = Q.defer<void>();
    }
    
    static isSupported(data: AdditionalLoginStepData) {
        return data.type == "googleAuthenticator" ||  data.type == "email" ||  data.type == "sms" ||  data.type == "u2f";
    }
    
    getModel(): Model {
        return {
            data: this.data,
            cancellable: this.cancellable,
            u2f: DataEncoder.decode(this.u2f)
        };
    }
    
    getPromise(): Q.Promise<void> {
        return this.defer.promise;
    }
    
    onViewSubmit(model: ChallengeModel) {
        Q().then(() => {
            return this.api.challenge(DataEncoder.encode(model));
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