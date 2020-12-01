import {WindowComponentController} from "../../base/WindowComponentController";
import {LoginWindowController} from "../LoginWindowController";
import {MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    active?: string;
    token: string;
    registerKey: string;
    adminRegistration: boolean;
    predefinedUsername: string;
    originalUrl: string;
    domain: string;
    noTerms?: boolean;
    noInfoBox?: boolean;
    termsUrl: string;
    privacyPolicyUrl: string;
}

export class RegisterController extends WindowComponentController<LoginWindowController> {
    
    static textsPrefix: string = "window.login.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    alert: (message?: string) => Q.Promise<MsgBoxResult>;
    model: Model;
    
    constructor(parent: LoginWindowController, model: Model) {
        super(parent);
        this.ipcMode = true;
        this.model = model;
        this.alert = this.parent.alert.bind(this.parent);
    }
    
    getModel(): Model {
        return this.model;
    }
    
    onViewRegister(hashmail: string, password: string, password2: string, email: string, pin: string, token: string, terms: string, weakPassword: boolean, registerKey: string): void {
        if (!hashmail) {
            this.alert(this.i18n("window.login.submit.error.emptyHashmail"))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }
        if (hashmail.indexOf("#") == -1) {
            hashmail += "#" + this.app.getDefaultHost();
        }
        if (!this.app.isSupportedHashmail(hashmail)) {
            this.alert(this.i18n("window.login.submit.error.unsupportedHashmail", [this.app.getSupportedHosts().join(", ")]))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }
        let hm = new privfs.identity.Hashmail(hashmail);
        if (!password) {
            this.alert(this.i18n("window.login.submit.error.emptyPassword"))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }
        if (password.length < 8) {
            this.alert(this.i18n("window.login.submit.error.tooShortPassword"))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }
        if (password !== password2) {
            this.alert(this.i18n("window.login.submitRegister.error.passwordsMismatch"))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }
        if (!this.model.noTerms && !terms) {
            this.alert(this.i18n("window.login.submitRegister.error.termsRequired"))
            .then(this.callViewMethod.bind(this, "showError", null));
            return;
        }
        this.addTaskEx(this.i18n("window.login.task.register.text"), true, () => {
            return Q().then(() => {
                let key = registerKey || this.app.getRegisterTokenInfo().key;
                return this.app.mcaFactory.register({
                    username: hm.user,
                    host: hm.host,
                    login: hm.user,
                    password: password,
                    email: "",
                    pin: pin,
                    token: token,
                    weakPassword: weakPassword,
                    registerKey: key
                });
            })
            .then(() => {
                return Q().then(() => {
                    this.app.markTokenAsUsed(token);
                    this.app.markRegisterKeyAsUsed(registerKey);
                    this.parent.settings.objectSet("remember-hashmail", true);
                    this.parent.settings.objectSet("remember-hashmail-value", hashmail);
                    this.parent.settings.objectSet("remember-password", false);
                    this.parent.settings.objectSet("remember-password", "");
                    this.parent.onAfterRegister(hm, this.model.adminRegistration);
                    this.app.setRegisterTokenInfo(null);
                    this.app.clearSession();
    
                    // console.log("auto-login from registerController");
                    // return this.parent.registerUtils.autoLogin(hm.user, this.app.getRegisterTokenInfo().domain, password);
                })
            })
            .fail(e => {
                this.logError(e);
                let msg = this.prepareErrorMessage(e, error => {
                    if (privfs.core.ApiErrorCodes.is(e, "INVALID_USERNAME")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.invalidUsername");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "INVALID_HOST")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.invalidHost");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "USER_ALREADY_EXISTS")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.userAlreadyExists");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "MAX_PIN_ATTEMPTS_EXCEEDED")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.maxPinAttemptsExceeded");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "INVALID_PIN")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.invalidPin");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "OPEN_REGISTRATION_DISABLED")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.openRegistrationDisabled");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "INVALID_TOKEN")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.invalidToken");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "INVALID_EMAIL")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.invalidEmail");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "FORBIDDEN_USERNAME")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitRegister.error.forbiddenUsername");
                        return error;
                    }
                });
                this.callViewMethod("showError", msg);
            });
        });
    }
    
    updateModel(model: Model) {
        this.model = model;
        this.callViewMethod("updateModel", model);
    }
}
