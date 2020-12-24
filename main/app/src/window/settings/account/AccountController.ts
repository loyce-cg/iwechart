import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {Inject} from "../../../utils/Decorators"
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";
import {event} from "../../../Types";

export interface Model {
    isMnemonicEnabled: boolean;
}

export class AccountController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "account";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    
    modelTransformer: (model: Model) => Q.IWhenable<Model>;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.identity = this.parent.identity;
    }
    
    prepare(): void {
        let model: Model = {
            isMnemonicEnabled: this.app.isMnemonicEnabled,
        };
        this.callViewMethod("renderContent", model);``
    }
    
    onViewChangePassword(type: string, currentPassword: string, newPassword: string, repeatedPassword: string, weakPassword: boolean): void {
        let login: string;
        let clearFields: boolean = false;
        this.addTaskEx("", true, () => {
            if (!currentPassword) {
                return this.parent.alert(this.i18n("window.settings.submit.error.emptyPassword"));
            }
            if (newPassword.length < 8) {
                return this.parent.alert(this.i18n("window.settings.submit.error.tooShortPassword"));
            }
            if (!newPassword || newPassword != repeatedPassword) {
                return this.parent.alert(this.i18n("window.settings.submitRegister.error.passwordsMismatch"));
            }
            clearFields = true;
            return Q().then(() => {
                return this.app.mailClientApi.privmxRegistry.getIdentityProvider();
            })
            .then(identityProvider => {
                login = identityProvider.getLogin();
                if (type == "oldPassword") {
                    return this.srpSecure.changePasswordByOldPassword(login, currentPassword, newPassword, weakPassword);
                }
                if (type == "secretIdWords") {
                    return this.srpSecure.changePasswordByRecovery(currentPassword, login, newPassword, weakPassword);
                }
            })
            .then(() => {
                if (type == "oldPassword") {
                    this.parent.app.userCredentials.password = newPassword;
                    this.parent.app.dispatchEvent<event.AfterPasswordChangedEvent>({type: "afterPasswordChanged", userCredentials: this.parent.app.userCredentials});
                }
            })
            .fail(e => {
                let msg = this.prepareErrorMessage(e, error => {
                    if (privfs.core.ApiErrorCodes.is(e, "DIFFERENT_M1") || e == "Connection Broken (processMessage - got ALERT: Different M1)") {
                        error.message = this.i18n("window.settings.submit.error.invalidPassword2");
                        if (privfs.core.ApiErrorCodes.is(e, "DIFFERENT_M1")) {
                            error.code = e.data.error.code;
                        }
                        else {
                            error.code = 0x10000;
                        }
                        return error;
                    }
                    if (privfs.exception.PrivFsException.is(e, "INVALID_VERIFER")) {
                        error.code = e.errorObject.code;
                        error.message = this.i18n("window.settings.submit.error.invalidPassword2");
                        return error;
                    }
                });
                this.parent.onErrorCustom(msg, e, true);
            });
        })
        .fin(() => {
            Q.delay(500)
            .then(() => {
                this.callViewMethod("clearChangePasswordForm", clearFields);
            });
        });
    }
    
    onViewShowSecretIdWords(): void {
        this.parent.promptEx({
            message: this.i18n("window.settings.section.alternativeLogin.enterPassword"),
            height: 170,
            ok: {
                label: this.i18n("window.settings.section.alternativeLogin.show"),
                faIcon: "eye"
            },
            input: {
                type: "password",
                placeholder: this.i18n("window.settings.section.alternativeLogin.enterPassword")
            },
            processing: "ok",
            onClose: result => {
                if (result.result != "ok") {
                    result.close();
                    return;
                }
                if (!result.value) {
                    result.showInputError(this.i18n("window.settings.submit.error.emptyPassword"));
                    return;
                }
                result.hideInputError();
                result.startProcessing("");
                return Q().then(() => {
                    return this.app.mailClientApi.privmxRegistry.getIdentityProvider();
                })
                .then(ip => {
                    return this.srpSecure.getRecoveryInfo(ip.getLogin(), result.value);
                })
                .then(info => {
                    result.close();
                    this.parent.promptEx({
                        message: this.i18n("window.settings.section.alternativeLogin.yourSecretIdWords"),
                        info: this.i18n("window.settings.section.alternativeLogin.info"),
                        height: 230,
                        width: 600,
                        input: {
                            value: info.mnemonic,
                            readonly: true,
                            multiline: true,
                            height: 65
                        },
                        cancel: {visible: false}
                    });
                })
                .fail(e => {
                    if (privfs.core.ApiErrorCodes.is(e, "DIFFERENT_M1") || e == "Connection Broken (processMessage - got ALERT: Different M1)") {
                        result.showInputError(this.i18n("window.settings.section.alternativeLogin.invalidPassword"));
                    }
                    else {
                        this.onError(e);
                    }
                })
                .fin(() => {
                    result.stopProcessing();
                });
            }
        });
    }
}
