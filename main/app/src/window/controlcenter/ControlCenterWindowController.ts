import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app, utils} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { WebCCApi } from "../../mail/WebCCApi";
import { RegisterUtils } from "../login/RegisterUtils";
import { KeepLoginEvent, ResetCreateTeamServerButtonStateEvent, FillInLoginFieldsEvent, StartFirstUserRegistrationFromCCEvent } from "../login/LoginWindowController";
import * as privfs from "privfs-client";

export interface Model {
    url: string;
}


export class ControlCenterWindowController extends BaseWindowController {
    loginData: {login: string; password: string; domain: string};
    static textsPrefix: string = "window.controlcenter.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    controlCenterApiUrl: string;
    registerUtils: RegisterUtils;
    afterLoadDefer: Q.Deferred<void>;
    iframeLoaded: boolean = false;

    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname, null, null, "basic");
        this.ipcMode = true;
        this.afterLoadDefer = Q.defer<void>();

        this.openWindowOptions = {
            hidden: true,
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 800,
            height: 640,
            minWidth: 800,
            minHeight: 640,
            title: this.i18n("window.controlcenter.title"),
            usePrivMXUserAgent: true
        };
    }
    
    waitOnLoad(): Q.Promise<void> {
        return this.afterLoadDefer.promise;
    }

    isIframeLoaded(): boolean {
        return this.iframeLoaded;
    }

    init(): Q.IWhenable<void> {
        this.registerUtils = new RegisterUtils(this.app);
        return Q().then(() => {
            let locale = this.app.getEnviromentLocale();
            let lang = this.app.localeService.currentLang;
            let version = this.app.getVersion().str;
            let endpoint = this.app.getCcApiEndpoint() || WebCCApi.ApiEndpoint;
            if (this.app.isRunningInDevMode() && endpoint == WebCCApi.ApiEndpoint) {
                this.alert("Warning: You are connecting to production server running client app in dev mode.");
            }
            return WebCCApi.getRegistrationInfo(this.app.getCcApiEndpoint() || WebCCApi.ApiEndpoint, {lang, locale, version})
        })
        .then(data => {
            this.controlCenterApiUrl = data.url;
            if ((<any>data).openInBrowser == true) {
                this.parent.app.openUrl(data.url);
                this.app.dispatchEvent<ResetCreateTeamServerButtonStateEvent>({type: "reset-state"});
                this.close();
            }
        })
        .fail(e => {
            this.app.errorLog.onErrorCustom("Ups.. Something went wrong. Please try again later.", e);
            this.app.dispatchEvent<ResetCreateTeamServerButtonStateEvent>({type: "reset-state"});
            this.close();
        })
    }
    
    onViewRegisterUser(email: string, login: string, password: string, passwordScore: number, token: string): void {
        Q().then(() => {
            return this.registerUser(login, password, email, passwordScore > 0, token);
        })
        .then(() => {
            this.callViewMethod("afterUserCreated");
        })
        .fail(() => {
            this.callViewMethod("onCannotCreateUser");
        })
        .finally(() => {
            this.app.setRegisterTokenInfo(null);
        })
    }

    onViewStartUserRegstrationByActivationToken(token: string): void {
        return this.startUserRegistrationByActivationToken(token);
    }


    onViewIframeLoaded(): void {
        this.iframeLoaded = true;
        this.nwin.show();
        this.afterLoadDefer.resolve();
    }

    getModel(): Model {
        return {
            url: this.controlCenterApiUrl
        }
    }
        
    onViewClose(): void {
        if (this.loginData) {
            this.app.dispatchEvent<FillInLoginFieldsEvent>({
                type: "fill-in-login-fields",
                hashmail: new privfs.identity.Hashmail({user: this.loginData.login, host: this.loginData.domain}).hashmail,
                password: this.loginData.password
            });
        }
        this.close();
    }

    onViewLogin(): void {
        // auto login
        if (this.loginData) {
            // this.app.dispatchEvent<FillInLoginFieldsEvent>({
            //     type: "fill-in-login-fields",
            //     hashmail: new privfs.identity.Hashmail({user: this.loginData.login, host: this.loginData.domain}).hashmail,
            //     password: this.loginData.password
            // });

            this.registerUtils.autoLogin(this.loginData.login, this.loginData.domain, this.loginData.password);
        }
        else {
            this.close();
        }
    }
    
    startUserRegistrationByActivationToken(token: string): void {
        this.app.dispatchEvent<StartFirstUserRegistrationFromCCEvent>({type: "start-first-user-registration-from-cc", token: token});
    }

    registerUser(login: string, password: string, email: string, weakPassword: boolean, token: string): Q.Promise<void> {
        return Q().then(() => {
            let tokenResult = this.registerUtils.checkAndSetTokenInfo(token);
            if (!tokenResult) {
                return Q.reject<any>("Invalid token result");
            }
            // return this.app.mcaFactory.register(
            return this.app.mcaFactory.registerFirstUser(
                login,
                this.app.getRegisterTokenInfo().domain,
                login,
                password,
                email,
                "",
                this.app.getRegisterTokenInfo().token,
                weakPassword,
                this.app.getRegisterTokenInfo().key);
        })
        .then(() => {
            let hashmail = login + "#" + this.app.getRegisterTokenInfo().domain;

            this.app.markTokenAsUsed(this.app.getRegisterTokenInfo().token);
            this.app.markRegisterKeyAsUsed(this.app.getRegisterTokenInfo().key);
            this.app.dispatchEvent<KeepLoginEvent>({type: "keep-login", login: hashmail, password: ""});
            let domain = this.app.getRegisterTokenInfo().domain;
            this.loginData = {
                domain: domain,
                login: login,
                password: password
            };
            this.app.setRegisterTokenInfo(null);
        })
    }

    onViewSetWindowHeight(size: number) {
        this.nwin.setHeight(size);
        this.center();
    }

    onViewOpenUrl(url: string): void {
        this.parent.app.openUrl(url);
    }

    onViewRequestError(): void {
        this.app.errorLog.onErrorCustom("invalid request from server", null, false);
    }
}
