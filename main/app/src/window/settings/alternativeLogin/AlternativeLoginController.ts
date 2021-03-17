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

export class AlternativeLoginController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "alternativeLogin";
    
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
        this.callViewMethod("renderContent", model);
    }
    
    onViewShowSecretIdWords(): void {
        this.parent.promptEx({
            message: this.i18n("window.settings.section.alternativeLogin.enterPassword"),
            height: 190,
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
                        height: 265,
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
