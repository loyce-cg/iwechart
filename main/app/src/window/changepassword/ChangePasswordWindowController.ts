import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app} from "../../Types";
import * as privfs from "privfs-client";
import {Inject} from "../../utils/Decorators"
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class ChangePasswordWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.changePassword.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    
    constructor(parent: app.WindowParent, public callback: (newPassword: string) => void) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.addViewScript({path: "build/zxcvbn.js"});
        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = 670;
        this.openWindowOptions.height = 370;
        this.openWindowOptions.modal = true;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.closable = false;
        this.openWindowOptions.title = this.i18n("window.changePassword.title");
    }
    
    onViewChangePassword(currentPassword: string, newPassword: string, repeatedPassword: string, weakPassword: boolean) {
        let clearForm = false;
        this.addTaskEx("", true, () => {
            if (!currentPassword) {
                return this.alert(this.i18n("window.changePassword.submit.error.emptyPassword"));
            }
            if (currentPassword != this.app.userCredentials.password) {
                return this.alert(this.i18n("window.changePassword.submit.error.invalidPassword"));
            }

            if (newPassword.length < 8) {
                return this.alert(this.i18n("window.changePassword.submit.error.tooShortPassword"));
            }
            if (!newPassword || newPassword != repeatedPassword) {
                return this.alert(this.i18n("window.changePassword.submit.error.passwordsMismatch"));
            }
            clearForm = true;
            return Q().then(() => {
                return this.app.mailClientApi.privmxRegistry.getIdentityProvider();
            })
            .then(identityProvider => {
                return this.srpSecure.changePasswordByOldPassword(identityProvider.getLogin(), currentPassword, newPassword, weakPassword);
            })
            .then(() => {
                this.close();
                this.callback(newPassword);
            })
            .fail(e => {
                let msg = this.prepareErrorMessage(e, error => {
                    if (privfs.core.ApiErrorCodes.is(e, "DIFFERENT_M1") || e == "Connection Broken (processMessage - got ALERT: Different M1)") {
                        error.message = this.i18n("window.changePassword.submit.error.invalidPassword");
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
                        error.message = this.i18n("window.changePassword.submit.error.invalidPassword");
                        return error;
                    }
                });
                this.onErrorCustom(msg, e, true);
            });
        })
        .fin(() => {
            Q.delay(500)
            .then(() => {
                this.callViewMethod("clearChangePasswordForm", clearForm);
            });
        });
    }
}
