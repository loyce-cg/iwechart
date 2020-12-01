import {WindowComponentController} from "../../base/WindowComponentController";
import {LoginWindowController} from "../LoginWindowController";
import {MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import {app} from "../../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    host: string;
}

export class AlternativeLoginController extends WindowComponentController<LoginWindowController> {
    
    static textsPrefix: string = "window.login.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    alert: (message?: string) => Q.Promise<MsgBoxResult>;
    
    constructor(parent: LoginWindowController) {
        super(parent);
        this.ipcMode = true;
        this.alert = this.parent.alert.bind(this.parent);
    }
    
    getModel(): Model {
        return {
            host: this.app.getDefaultHost()
        };
    }
    
    onViewLogin(words: string): void {
        if (!words) {
            this.alert(this.i18n("window.login.submit.error.emptyWords"))
            .then(() => this.callViewMethod("showError", null));
            return;
        }
        this.addTaskEx(this.i18n("window.login.task.alternativeLogin.text"), true, () => {
            return Q().then(() => {
                return this.app.mcaFactory.alternativeLogin(this.app.getDefaultHost(), words);
            })
            .then(mca => {
                return mca.privmxRegistry.getIdentity().then(identity => {
                    return this.app.onLogin(mca, {
                        type: app.LoginType.MNEMONIC,
                        hashmail: identity,
                        mnemonic: words
                    });
                });
            })
            .fail(e => {
                this.logError(e);
                let msg = this.prepareErrorMessage(e, error => {
                    if (e === "additional-login-step-cancel") {
                        error.code = 9001;
                        error.message = this.i18n("window.login.submit.error.additionalLoginStepCancel");
                        return error;
                    }
                    if (e === "additional-login-step-fail") {
                        error.code = 9002;
                        error.message = this.i18n("window.login.submit.error.additionalLoginStepFail");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "USER_DOESNT_EXIST")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submitAlternativeLogin.error.invalidWords");
                        return error;
                    }
                    if (privfs.core.ApiErrorCodes.is(e, "LOGIN_BLOCKED")) {
                        error.code = e.data.error.code;
                        error.message = this.i18n("window.login.submit.error.loginBlocked");
                        return error;
                    }
                    if (e == "AssertionError: Invalid mnemonic" || e == "AssertionError: Invalid mnemonic checksum" || privfs.core.ApiErrorCodes.is(e, "INVALID_SIGNATURE")) {
                        error.message = this.i18n("window.login.submitAlternativeLogin.error.invalidWords");
                        if (privfs.core.ApiErrorCodes.is(e, "INVALID_SIGNATURE")) {
                            error.code = e.data.error.code;
                        }
                        else {
                            error.code = 0x9000;
                        }
                        return error;
                    }
                });
                this.callViewMethod("showError", msg);
            });
        });
    }
    
    onViewOpenLogin(): void {
        this.parent.openLogin();
    }
}
