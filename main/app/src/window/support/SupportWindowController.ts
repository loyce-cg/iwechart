import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app, utils} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { WebCCApi } from "../../mail/WebCCApi";
import { RegisterUtils } from "../login/RegisterUtils";
import { KeepLoginEvent } from "../login/LoginWindowController";

export interface Model {
    url: string;
    supportEnabled: boolean;
}


export class SupportWindowController extends BaseWindowController {
    static readonly FORM_WINDOW_HEIGHT: number = 640;
    static readonly FORM_WINDOW_WIDTH: number = 800;
    static readonly STATIC_MESSAGE_WINDOW_HEIGHT: number = 440;
    static readonly STATIC_MESSAGE_WINDOW_WIDTH: number = 640;

    loginData: {login: string; password: string; domain: string};
    static textsPrefix: string = "window.support.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    supportUrl: string;
    registerUtils: RegisterUtils;
    afterLoadDefer: Q.Deferred<void>;
    iframeLoaded: boolean = false;

    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.afterLoadDefer = Q.defer<void>();
        let windowHeight = this.isSupportEnabled() ? SupportWindowController.FORM_WINDOW_HEIGHT : SupportWindowController.STATIC_MESSAGE_WINDOW_HEIGHT;
        let windowWidth = this.isSupportEnabled() ? SupportWindowController.FORM_WINDOW_WIDTH : SupportWindowController.STATIC_MESSAGE_WINDOW_WIDTH;    
        this.openWindowOptions = {
            hidden: this.isSupportEnabled(),
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: windowWidth,
            height: windowHeight,
            minWidth: windowWidth,
            minHeight: windowHeight,
            title: this.i18n("window.support.title"),
            backgroundColor: "#0a2933"
        };
    }
    
    waitOnLoad(): Q.Promise<void> {
        return this.afterLoadDefer.promise;
    }

    isIframeLoaded(): boolean {
        return this.iframeLoaded;
    }

    init(): Q.IWhenable<void> {
        return Q().then(() => {
            if  (this.isSupportEnabled()) {
                return this.loadSupportForm();
            }
            else {
                this.setIFrameLoaded();
            }    
        })
    }
    

    onViewIframeLoaded(): void {
        this.setIFrameLoaded();
    }
    
    setIFrameLoaded(): void {
        this.iframeLoaded = true;
        this.nwin.show();
        this.afterLoadDefer.resolve();
    }

    getModel(): Model {
        return {
            url: this.supportUrl,
            supportEnabled: this.isSupportEnabled()
        }
    }
        
    onViewClose(): void {
        this.close();
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

    loadSupportForm(): Q.Promise<void> {
        console.log("loading support form...");
        return Q().then(() => {
            return this.app.isLogged() ? this.app.mailClientApi.privmxRegistry.getGateway() : this.app.mcaFactory.getGateway(this.app.userCredentials.hashmail.host)
        })
        .then(gateway => {
            return WebCCApi.getControlCenterSupportForm(gateway, {lang: this.getLang(), version: this.getAppVersion()})
        })
        .then(data => {
            this.supportUrl = data.url;
        })
        .fail(e => {
            this.app.errorLog.onErrorCustom("Ups.. Something went wrong. Please try again later.", e);
            this.close();
        })
    }


    isSupportEnabled(): boolean {
        return this.app.serverConfigForUser.supportFormEnabled;
    }

    getLang(): string {
        return this.app.localeService.currentLang;

    }

    getAppVersion(): string {
        return this.app.getVersion().str;
    }
}
