import {BaseWindowController} from "./../base/BaseWindowController";
import {LoginController} from "./login/LoginController";
import {AlternativeLoginController} from "./alternativelogin/AlternativeLoginController";
import {RegisterController, Model as RegisterModel} from "./register/RegisterController";
import {AfterRegisterController} from "./afterregister/AfterRegisterController";
import {ActivateController} from "./activate/ActivateController";
import {ActivateNewWayController} from "./activatenewway/ActivateNewWayController";
import {ContainerWindowController} from "../container/ContainerWindowController";
import {WayChooserController} from "./waychooser/WayChooserController";
import {app, utils} from "../../Types";
import * as privfs from "privfs-client";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import * as Q from "q";
import {WebCCApi} from "../../mail/WebCCApi";
import { RegisterNewWayController, Model as RegisterNewWayModel } from "./registernewway/main";
import { ControlCenterWindowController } from "../controlcenter/main";
import { RegisterUtils } from "./RegisterUtils";
import { SimpleOpenableElement } from "../../app/common/shell/ShellTypes";
import { LicenceWindowController } from "../licence/LicenceWindowController";
import { DockedWindow } from "../../app/common/window/DockedWindow";
import { Exception } from "../../../node_modules/privmx-exception";

export interface KeepLoginEvent {
    type: "keep-login"
    login: string;
    password: string;
}
export interface ResetCreateTeamServerButtonStateEvent {
    type: "reset-state"
}

export interface StartFirstUserRegistrationFromCCEvent {
    type: "start-first-user-registration-from-cc",
    token: string;
}

export interface FillInLoginFieldsEvent {
    type: "fill-in-login-fields"
    hashmail: string;
    password: string;
}


export interface Model {
    active: string;
    showWindowControls: boolean;
    updateAvailable: boolean;
    updateReadyToInstall: boolean;
    forceUpdate: boolean;
    appVersion: string;
}

export class LoginWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.login.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    lastProgressStatus: app.UpdaterProgressStatus;
    token: string;
    registerKey: string;
    login: LoginController;
    alternativeLogin: AlternativeLoginController;
    register: RegisterController;
    activate: ActivateController;
    // wayChooser: WayChooserController;
    activateNewWay: ActivateNewWayController;
    afterRegister: AfterRegisterController;
    activateKeyCorrect: boolean = false;
    webCCApi: WebCCApi;
    domainSuffix: string;
    registerNewWay: RegisterNewWayController;
    registerUtils: RegisterUtils;

    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname, {
            isPublic: true,
            defaultValue: {
                "remember-hashmail": 0,
                "remember-password": 0
            }
        });
        this.ipcMode = true;
        this.addViewScript({path: "build/zxcvbn.js"});
        let info = this.app.getRegisterTokenInfo();
        this.token = info.token;
        this.registerKey = info.key;
        this.registerUtils = new RegisterUtils(this.app);

        if (this.app.isElectronApp()) {
            this.openWindowOptions.width = 640;
            this.openWindowOptions.height = 480;
            this.openWindowOptions.decoration = false;
            this.openWindowOptions.position = "center-always";
            this.openWindowOptions.title = "PrivMX";
            this.openWindowOptions.fullscreen = false;
        }
        else if (this.app.isWebApp()) {
            this.openWindowOptions.fullscreen = true;
            this.openWindowOptions.cssClass = "app-window";
        }
        this.openWindowOptions.showLoadingScreen = true;
        
        this.login = this.addComponent("login", new LoginController(this));
        this.alternativeLogin = this.addComponent("alternativeLogin", new AlternativeLoginController(this));
        this.register = this.addComponent("register", new RegisterController(this, this.getRegisterModel()));
        this.activate = this.addComponent("activate", new ActivateController(this));
        this.activateNewWay = this.addComponent("activateNewWay", new ActivateNewWayController(this));

        // this.wayChooser = this.addComponent("wayChooser", new WayChooserController(this));
        this.app.addEventListener<KeepLoginEvent>("keep-login", event => {
            if (this.settings.objectGet("remember-hashmail")) {
                this.settings.objectSet("remember-hashmail-value", event.login);
            }
            if (this.settings.objectGet("remember-password")) {
                this.settings.objectSet("remember-password-value", event.password);
            }
        });

        this.app.addEventListener<FillInLoginFieldsEvent>("fill-in-login-fields", event => {
            this.settings.objectSet("remember-hashmail-value", event.hashmail);
            this.login.setLoginField(event.hashmail);
        })

        this.app.addEventListener<ResetCreateTeamServerButtonStateEvent>("reset-state", () => {
            this.login.callViewMethod("onControlCenterLoad", false);
        })

        this.app.addEventListener<StartFirstUserRegistrationFromCCEvent>("start-first-user-registration-from-cc", event => {
            let correct = this.registerUtils.checkAndSetTokenInfo(event.token);
            if (!correct) {
                throw new Exception("Incorrect token from server");
            }
            let registerModel = this.getRegisterModel();
            this.register.updateModel(registerModel);
            this.callViewMethod("setActive", "register");
        })
    }
    
    init(): Q.Promise<void> {
        return;
    }

    afterInit(): Q.Promise<void> {
        return Q().then(() => {
            if (this.app.isElectronApp()) {
                if (! (<any>this.app).profile.isLicenceAccepted()) {
                    this.openLicenseDocked(true);    
                }
            }
        })
    }

    getRegisterModel(): RegisterModel {
        let info = this.app.getRegisterTokenInfo();
        return {
            token: info.token,
            registerKey: this.registerKey,
            adminRegistration: info.isAdmin,
            predefinedUsername: info.username,
            domain: info.domain,
            originalUrl: this.app.getOriginalUrl(),
            noInfoBox: true,
            noTerms: true,
            termsUrl: this.app.getTermsUrl(),
            privacyPolicyUrl: this.app.getPrivacyPolicyUrl(),
        }
    }
    
    getModel(): Model {
        let updateAvail: boolean = false;
        let updateReadyToInstall: boolean = false;
        let forceUpdate: boolean = false;
        
        if (this.app.isElectronApp()) {
              if ((<any>this.app).updater) {
                  if ((<any>this.app).updater.isInQuarantine()) {
                      this.alert(this.i18n("window.login.alert.quarantine"));
                  }
                  else {
                      let updatesInfo = (<any>this.app).updater.getUpdatesInfo();
                      let versionData = updatesInfo && updatesInfo.versionData || null;
                      updateAvail = versionData && versionData.version !== null;
                      updateReadyToInstall = updatesInfo && updatesInfo.readyToInstall;
                      forceUpdate = versionData && versionData.force || false;
                  }
              }
        }

        let active = this.token ? "register" : "login";
        if (this.app.isElectronApp()) {
            if (! (<any>this.app).profile.isLicenceAccepted()) {
                active = "license";  
            }
        }
        return {
            // active: this.token ? "register" : "login",
            active: active,
            showWindowControls: false,
            updateAvailable: updateAvail,
            updateReadyToInstall: updateReadyToInstall,
            forceUpdate: forceUpdate,
            appVersion: this.app.getVersion().ver
        };
    }
    
    onViewChangeLang(lang: string): void {
        this.app.changeLang(lang);
    }
    
    onViewWindowClose() {
        if (this.parent instanceof ContainerWindowController) {
            this.parent.hide();
        }
    }
    
    onViewWindowMinimize() {
        if (this.parent instanceof BaseWindowController) {
            this.parent.nwin.minimize();
        }
    }
    
    onViewWindowToggleMaximize() {
        if (this.parent instanceof BaseWindowController) {
            this.parent.nwin.maximizeToggle();
        }
    }
    
    onAfterRegister(hm: privfs.identity.Hashmail, isAdmin: boolean): void {
        this.afterRegister = this.addComponent("afterRegister", new AfterRegisterController(this, {
            desktopDownloadUrl: this.app.getDesktopDownloadUrl(),
            desktopDownloadUrls: this.app.getDesktopAppUrls(),
            webAccessEnabled: this.app.isWebAccessEnabled(),
            registerFromDesktopApp: this.app.isElectronApp(),
            isAdmin: isAdmin,
            login: hm.hashmail
        }));
        this.callViewMethod("initAfterRegisterAndActivate");
    }
    
    openLogin(): void {
        this.app.setRegisterTokenInfo(null);
        this.login.reinit();
        this.callViewMethod("setActive", "login");
    }
    
    openActivateNewWay(): void {
        // console.log("activateNewWay called");
        this.callViewMethod("setActive", "activateNewWay");
    }

    openAlternativeLogin(): void {
        this.callViewMethod("setActive", "alternativeLogin");
    }

    openRegisterNewWay(email: string, domainSuffix: string, applicationCode: string): void {
        if (this.registerNewWay) {
            this.registerNewWay.updateModel(this.getRegisterNewWayModel(email, domainSuffix, applicationCode));
            this.callViewMethod("setActive", "registerNewWay");
        }
        else {
            this.onRegisterNewWay(email, domainSuffix, applicationCode);
        }
    }
    
    onViewAction(action: string): void {
        setTimeout(() => {
            if (action == "download-updates") {
                if (this.app.isElectronApp()) {
                    if ((<any>this.app).updater) {
                        this.lastProgressStatus = "checking";
                        (<any>this.app).updater.downloadUpdate(this.onUpdateProgress.bind(this))
                        .then(() => {
                            this.callViewMethod("setUpdateStatus", "readyToInstall");
                        })
                        .fail((e: any) => console.log(e));
                    }
                }
            }
            else
            if (action == "install-updates") {
                if (this.app.isElectronApp()) {
                    if ((<any>this.app).updater) {
                        (<any>this.app).updater.startUpdate();
                    }
                }
                
            }
        }, 100);
    }
    
    onUpdateProgress(status: app.UpdaterProgressStatus, downloaded: number, total: number): void {
        if (this.lastProgressStatus == status && this.lastProgressStatus != "downloading") {
            return;
        }
        this.lastProgressStatus = status;
        if (status == "downloading" && total > 0) {
            this.callViewMethod("setDownloadProgress", Math.round(downloaded * 100 / total));
            
        }
        this.callViewMethod("setUpdateStatus", status);
    }
    
    onViewHideLoginInfo(): void {
        this.app.setLoginInfoHidden();
    }

    onViewActivateAccount(): void {
        this.callViewMethod("setActive", "activate");
    }
    
    testEncodeToken(): string {
        let domain = "kamil4";
        let tokenInfo: utils.RegisterTokenInfo = {
            domain: domain,
            token: "a3758a49a0d2284fec0b",
            isAdmin: true
        }
        let buffer = Buffer.from(JSON.stringify(tokenInfo), "utf-8");
        return "activate:" + privfs.bs58.encode(buffer);
    }
    

    // Called when a private user paste his/her token to register account
    onViewKeyInputChange(enteredKey: string): void {
        Q().then(() => {
            return this.addTaskEx("", true, () => {
                this.activateKeyCorrect = this.registerUtils.checkAndSetTokenInfo(enteredKey)
                this.activate.callViewMethod("updateKeyInfo", this.activateKeyCorrect, this.app.getRegisterTokenInfo().isAdmin, this.app.getRegisterTokenInfo().domain);
                return;
            });
        });
    }
    
    onViewActivateNextClick(): void {
        if (!this.activateKeyCorrect) {
            return;
        }
        this.token = this.app.getRegisterTokenInfo().token;
        let model = this.getRegisterModel();
        this.register.updateModel(model);
        this.callViewMethod("setActive", "register");
    }

    onViewActivateNewWayNextClick(applicationCode: string): void {
        // verifying application code 
        Q().then(() => {
            return WebCCApi.verifyApplicationCode(this.app.getCcApiEndpoint() || WebCCApi.ApiEndpoint, {applicationCode});
        })
        .then(userData => {
            this.domainSuffix = userData.domainSuffix;
            this.openRegisterNewWay(userData.email, userData.domainSuffix, applicationCode);
        })
        .catch(e => {
            this.activateNewWay.callViewMethod("keyError");
        });
    }
    onRegisterNewWay(email: string, domainSuffix: string, applicationCode: string): void {
        this.registerNewWay = this.addComponent("registerNewWay", new RegisterNewWayController(this, this.getRegisterNewWayModel(email, domainSuffix, applicationCode)));
        this.callViewMethod("initRegisterNewWayAndActivate");
    }
    
    getRegisterNewWayModel(email: string, domainSuffix: string, applicationCode: string): RegisterNewWayModel {
        return {
            active: "registerNewWay",
            noTerms: true,
            adminRegistration: true,
            email: email,
            domain: domainSuffix,
            noInfoBox: true,
            predefinedUsername: this.i18n("window.login.form.registernewway.manager.value"),
            applicationCode: applicationCode
        }
    }

    onViewOpenManagersZone(): void {
        this.app.openSingletonWindowWithReturn("ControlCenter", ControlCenterWindowController).then(win => {
            let ccWin = (win as ControlCenterWindowController);
            if (! ccWin.isIframeLoaded()) {
                this.login.callViewMethod("onControlCenterLoad", true);
                ccWin.waitOnLoad().then(() => {
                    this.login.callViewMethod("onControlCenterLoad", false);
                })     
            }
        })
        .fail(() => {
            this.login.callViewMethod("onControlCenterLoad", false);
        })
    }

    onViewOpenLicense() {
        this.openLicenseDocked();
    }

    openLicenseDocked(onStartup?: boolean): void {
        let lang = this.app.localeService.currentLang;
        
        if (!lang) {
            lang = this.app.localeService.defaultLang;
        }
        let licencePath = this.app.assetsManager.getAsset("assets/licence_" + lang + ".html", this.app.isElectronApp());
        let fileHandle: any;
        if (this.app.isElectronApp()) {
            fileHandle = {path: licencePath, handleType: "electron", mimeType: null};
        }
        else {
            fileHandle = {file: {path: licencePath}, handleType: "browser"};
        }
        let task = this.app.createContent(fileHandle);
        Q().then(() => {
            let element = new SimpleOpenableElement(task);
            if (! onStartup) {
                this.app.ioc.create(LicenceWindowController, [this, {
                    entry: element,
                    docked: true,
                    onStartup: onStartup
                }]).then(win => {
                    win.openDocked(this.nwin, win.id);
                    let docked = <DockedWindow>win.nwin;

                    // console.log("call show iframe 1");
                    this.callViewMethod("registerDockedLicense", docked.id, docked.load);
                });
            }
            else {
                this.app.ioc.create(LicenceWindowController, [this, {
                    entry: element,
                    docked: true,
                    onStartup: onStartup
                }]).then(win => {
                    win.getUserActionCallback()
                    .then(() => {
                        (<any>this.app).profile.setLicenceAccepted();
                        this.callViewMethod("setActive", "login");
                    })
                    .fail(e => {
                        this.app.exitApp();
                        
                    })
                    win.openDocked(this.nwin, win.id);
                    let docked = <DockedWindow>win.nwin;
                    this.callViewMethod("registerDockedLicense", docked.id, docked.load);
                });
                
            }
            
        })

    }
}
