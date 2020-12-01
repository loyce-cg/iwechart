import {WindowComponentController} from "../../base/WindowComponentController";
import {LoginWindowController} from "../LoginWindowController";
import {MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";
import { WebCCApi } from "../../../mail/WebCCApi";
import * as WebCCApiTypes from "../../../mail/WebCCApiTypes";
import * as Types from "../../../Types";
export interface Model {
    active: string;
    noTerms?: boolean;
    adminRegistration: boolean;
    domain: string;
    domainPrefix?: string;
    email: string;
    registerKey?: string;
    termsUrl?: string;
    privacyPolicyUrl?: string;
    predefinedUsername?: string;
    token?: string;
    noInfoBox?: boolean;
    originalUrl?: string;
    applicationCode: string;
}

export class RegisterNewWayController extends WindowComponentController<LoginWindowController> {
    
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

    registerTeamServer(companyName: string, domainPrefix: string): Q.Promise<WebCCApiTypes.api.auth.RegisterByAppCodeResult> {
        return WebCCApi.registerByApplicationCode(this.app.getCcApiEndpoint() || WebCCApi.ApiEndpoint, {
            applicationCode: this.model.applicationCode,
            prefix: domainPrefix,
            companyName: companyName
        })
    }

    delayPromise(ms: number): Q.Promise<void> {
        let waitPromise = Q.defer<void>();
        setTimeout(() => {
            // console.log("waiting done.");
            return waitPromise.resolve();
        }, ms);
        return waitPromise.promise;
    }

    waitForHost(domain: string): Q.Promise<void> {
        if (this.parent.app.isElectronApp()) {
            (<any>this.parent.app).isHostAvailable(domain)
            .then((avail: Q.Promise<boolean>) => {
                // console.log("Domain ", domain, avail ? "available" : " not available");
                return avail ? this.delayPromise(5000) : this.delayPromise(1000).then(() => this.waitForHost(domain));
            })
        }
        else {
            // console.log("not electron app.");
            return Q.reject<void>("Supported only in desktop client");
        }
    }

    onViewRegister(hashmail: string, password: string, password2: string, email: string, pin: string, terms: string, weakPassword: boolean, companyName: string, domainPrefix: string): void {

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
        // console.log("start register")
        this.addTaskEx(this.i18n("window.login.task.register.text"), true, () => {
            return Q().then(() => {
                return this.registerTeamServer(companyName, domainPrefix);
            })
            .then(serverRegisterResult => {
                // console.log(serverRegisterResult);
                
                let tokenResult = this.parent.registerUtils.checkAndSetTokenInfo(serverRegisterResult.registrationToken);
                if (!tokenResult) {
                    return Q.reject<any>("Invalid token result");
                }
                // return this.waitForHost(this.app.getRegisterTokenInfo().domain); // this is Node.js related thus available only in Desktop app (to change later)
                return;
            })
            .then(() => {
                // console.log("mcaFactory.register", hm.user, hm.host);
                return this.app.mcaFactory.register({
                    username: hm.user,
                    host: this.app.getRegisterTokenInfo().domain,
                    login: hm.user,
                    password: password,
                    email: email,
                    pin: pin,
                    token: this.app.getRegisterTokenInfo().token,
                    weakPassword: weakPassword,
                    registerKey: this.app.getRegisterTokenInfo().key
                });
            })
            .then(() => {
                let hashmail = hm.user + "#" + this.app.getRegisterTokenInfo().domain;
                // console.log("user registered");
                return Q().then(() => {
                    this.app.markTokenAsUsed(this.app.getRegisterTokenInfo().token);
                    this.app.markRegisterKeyAsUsed(this.app.getRegisterTokenInfo().key);
                    this.parent.settings.objectSet("remember-hashmail", true);
                    this.parent.settings.objectSet("remember-hashmail-value", hashmail);
                    this.parent.settings.objectSet("remember-password", false);
                    this.parent.settings.objectSet("remember-password", "");
                    // this.parent.onAfterRegister(hm, this.model.adminRegistration);
                    // auto login
                    return this.parent.registerUtils.autoLogin(hm.user, this.app.getRegisterTokenInfo().domain, password);
                });
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

    onViewAction(action: string): void {

    }

    onViewNextStep(companyName: string): void {
        Q().then(() => {
            return WebCCApi.getPrefix(this.app.getCcApiEndpoint() || WebCCApi.ApiEndpoint, {companyName});
        })
        .then(data => {
            this.callViewMethod("updatePrefix", data.prefix);
        })
    }

    onViewPrefixChange(prefix: string): void {
        Q().then(() => {
            return WebCCApi.verifyPrefix(this.app.getCcApiEndpoint() || WebCCApi.ApiEndpoint, {prefix});
        })
        .then(res => {
            this.callViewMethod("setPrefixCorrect", true);
        })
        .fail(() => {
            this.callViewMethod("setPrefixCorrect", false);
        });
    }
}
