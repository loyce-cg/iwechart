import {WindowComponentController} from "../../base/WindowComponentController";
import {LoginWindowController} from "../LoginWindowController";
import {MsgBoxOptions, MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import {app} from "../../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import {ElectronApplication} from "../../../app/electron/ElectronApplication";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface RemeberModel {
    hashmail: {
        value: string;
        checked: boolean;
    };
    password: {
        value: string;
        checked: boolean;
    };
}

export interface Model {
    host: string;
    instanceName: string;
    remember: RemeberModel;
    autoLogin: boolean;
    isMnemonicEnabled: boolean;
    isLoginInfoVisible: boolean;
    isElectron: boolean;
}

export class LoginController extends WindowComponentController<LoginWindowController> {
    
    static textsPrefix: string = "window.login.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    alert: (message?: string) => Q.Promise<MsgBoxResult>;
    confirmEx: (options: MsgBoxOptions) => Q.Promise<MsgBoxResult>;
    
    constructor(parent: LoginWindowController) {
        super(parent);
        this.ipcMode = true;
        this.alert = this.parent.alert.bind(this.parent);
        this.confirmEx = this.parent.confirmEx.bind(this.parent);
    }
    
    getModel(): Model {
        let remember = this.getRemeberModel();
        let savedCredentials = remember.hashmail.checked && !!remember.hashmail.value && remember.password.checked && !!remember.password.value;
        let autoLogin = this.app.startWithAutoLogin() && savedCredentials;
        if (!autoLogin) {
            this.app.onAutoLoginNotPerformed();
        }
        return {
            host: this.app.getDefaultHost(),
            instanceName: this.app.getInstanceName() || this.app.getDefaultHost(),
            remember: remember,
            autoLogin: autoLogin,
            isMnemonicEnabled: this.app.isMnemonicEnabled,
            isLoginInfoVisible: this.app.isLoginInfoVisible(),
            isElectron: this.app.isElectronApp()
        };
    }
    
    onViewHashmailChange(hashmail: string): void {
        if (this.parent.settings.objectGet("remember-hashmail")) {
            this.parent.settings.objectSet("remember-hashmail-value", hashmail);
        }
    }
    
    onViewHashmailRememberChange(checked: boolean): void {
        this.parent.settings.objectSet("remember-hashmail", checked);
        if (!checked) {
            this.parent.settings.objectSet("remember-hashmail-value", "");
            this.parent.settings.objectSet("remember-password", false);
            this.parent.settings.objectSet("remember-password-value", "");
        }
        this.callViewMethod("refreshRemember", this.getRemeberModel());
    }
    
    onViewPasswordRememberChange(checked: boolean): void {
        if (checked) {
            this.showRememberPasswordWarning()
            .then(data => {
                if (data.result == "yes") {
                    this.parent.settings.objectSet("remember-password", true);
                }
                else {
                    this.parent.settings.objectSet("remember-password", false);
                    this.parent.settings.objectSet("remember-password-value", "");
                }
                this.callViewMethod("refreshRemember", this.getRemeberModel());
            });
        }
        else {
            this.parent.settings.objectSet("remember-password", false);
            this.parent.settings.objectSet("remember-password-value", "");
            this.callViewMethod("refreshRemember", this.getRemeberModel());
        }
    }
    
    onViewLogin(hashmail: string, password: string): void {
        if (!hashmail) {
            this.alert(this.i18n("window.login.submit.error.emptyHashmail"))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }
        if (!password) {
            this.alert(this.i18n("window.login.submit.error.emptyPassword"))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }

        // if (this.isLoginExternal(hashmail) && this.app.isElectronApp()) {
        //     this.alert(this.i18n("window.login.submit.error.unsupportedExternalUser"))
        //     .then(this.callViewMethod.bind(this, "showError", null));
        //     return;
        // }

        else {
            Q().then(() => {
                return this.app.isProfileUsed(hashmail);
            })
            .then(used => {
                if (used) {
                    this.alert(this.i18n("window.login.submit.error.duplicateLogin"))
                    .then(this.callViewMethod.bind(this, "showError", null));
                    return;
                }
                else {
                    if (hashmail.indexOf("#") == -1) {
                        hashmail += "#" + this.app.getDefaultHost();
                    }
                    if (!this.app.isSupportedHashmail(hashmail)) {
                        this.alert(this.i18n("window.login.submit.error.unsupportedHashmail", [this.app.getSupportedHosts().join(", ")]))
                        .then(this.callViewMethod.bind(this, "showError", null));
                        return;
                    }
                    if (this.app.isElectronApp()) {
                        (<ElectronApplication>this.app).setDomainFromLogin(hashmail);
                    }
                    
                    let host: string;
                    return this.addTaskEx(this.i18n("window.login.task.login.text"), true, () => {
                        this.app.onLoginStart();
                        return Q().then(() => {
                            let login = hashmail;
                            host = this.app.getDefaultHost();;
                            if (hashmail.indexOf("#") != -1) {
                                let hm = new privfs.identity.Hashmail(hashmail);
                                login = hm.user;
                                host = hm.host;
                            }
                            return this.app.mcaFactory.login(login, host, password);
                        })
                        .then(mca => {
                            //return mca.loginCore().then(() => {
                                let savedHashmail = hashmail;
                                if (this.isLoginExternal(hashmail) && !this.app.isElectronApp()) {
                                    savedHashmail = hashmail.split("#")[0];
                                }
                                if (this.parent.settings.objectGet("remember-hashmail")) {
                                    this.parent.settings.objectSet("remember-hashmail-value", savedHashmail);
                                }
                                if (this.parent.settings.objectGet("remember-password")) {
                                    this.parent.settings.objectSet("remember-password-value", password);
                                }
                                return mca.privmxRegistry.getIdentity().then(identity => {
                                    return this.app.onLogin(mca, {
                                        type: app.LoginType.PASSWORD,
                                        hashmail: identity,
                                        password: password
                                    });
                                });
                            //});
                        })
                        .then(() => {
                            return this.app.registerProfile(hashmail);
                        })
                        .fail(e => {
                            console.log("logged error", e);
                            this.logError(e);
                            this.app.unregisterProfile(hashmail);
                            let msg = "";
                            if (e === "additional-login-step-cancel") {
                                msg = this.i18n("window.login.submit.error.additionalLoginStepCancel");
                            }
                            else if (e === "additional-login-step-fail") {
                                msg = this.i18n("window.login.submit.error.additionalLoginStepFail");
                            }
                            else if (e && e.msg && typeof(e.msg) == "string" && e.msg.indexOf("Failed assert ALLOW_WITH_MAINTENANCE") == 0) {
                                msg = this.i18n("window.login.submit.error.maintenance");
                            }
                            else if (e && typeof(e) == "string" && e.indexOf("Maintenance mode") > -1) {
                                msg = this.i18n("window.login.submit.error.maintenance");
                            }
                            else if (privfs.core.ApiErrorCodes.isEx(e, "DIFFERENT_M1")) {
                                msg = this.i18n("window.login.submit.error.invalidPassword");
                            }
                            else if (privfs.core.ApiErrorCodes.isEx(e, "USER_DOESNT_EXIST")) {
                                msg = this.i18n("window.login.submit.error.invalidPassword");
                            }
                            else if (e && typeof(e) == "string" && e.indexOf("ALERT: User blocked") > -1) {
                                msg = this.i18n("window.login.submit.error.userBlocked");
                            }
                            else if (e && typeof(e) == "string" && e.indexOf("ALERT: Device blocked") > -1) {
                                msg = this.i18n("window.login.submit.error.deviceBlocked");
                            }
                            else if (privfs.core.ApiErrorCodes.isEx(e, "INVALID_VERIFER")) {
                                msg = this.i18n("window.login.submit.error.invalidPassword");
                            }
                            else if (privfs.core.ApiErrorCodes.isEx(e, "LOGIN_BLOCKED")) {
                                msg = this.i18n("window.login.submit.error.loginBlocked");
                            }
                            else if (e && e.toString().startsWith("Error: Config not found")) {
                                msg = this.i18n("core.error.cannotConnect", host ? host : "");
                            }
                            else {
                                msg = this.prepareErrorMessage(e);
                            }
                            this.callViewMethod("showError", msg);
                            this.app.onLoginFail();
                        });
                    });
                
                }
                
            })
            .fail(() => {
                this.app.unregisterProfile(hashmail);
                this.onViewLogin(hashmail, password);
            })
        }
        


    }
    
    isLoginExternal(hashmail: string): boolean {
        return hashmail.indexOf("@") != -1;
    }
    
    onViewOpenAlternativeLogin(): void {
        this.parent.openAlternativeLogin();
    }
    
    getRemeberModel(): RemeberModel {
        return {
            hashmail: {
                value: this.parent.settings.objectGet("remember-hashmail-value") || "",
                checked: !!this.parent.settings.objectGet("remember-hashmail")
            },
            password: {
                value: this.parent.settings.objectGet("remember-password-value") || "",
                checked: !!this.parent.settings.objectGet("remember-password")
            }
        };
    }
    
    showRememberPasswordWarning(): Q.Promise<MsgBoxResult> {
        return this.confirmEx({
            width: 610,
            height: 200,
            message: this.i18n("window.login.rememberPasswordWarning.text"),
            focusOn: "yes",
            no: {
                label: this.i18n("window.login.rememberPasswordWarning.no.text"),
                btnClass: "btn-default",
                order: 1
            },
            yes: {
                label: this.i18n("window.login.rememberPasswordWarning.yes.text"),
                btnClass: "btn-success",
                order: 2
            },
        });
    }
    
    reinit(): void {
        this.callViewMethod("reinit", this.getRemeberModel(), this.app.isLoginInfoVisible());
    }

    setLoginField(login: string): void {
        this.callViewMethod("setLoginField", login);
    }
}
