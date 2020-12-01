import {ComponentController} from "../base/ComponentController";
import * as Types from "../../Types";
import Q = require("q");
import { UserPreferences } from "../../mail/UserPreferences";
import { Inject } from "../../utils/Decorators";
import { MailConst } from "../../mail/MailConst";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class EncryptionEffectController extends ComponentController {
    
    static textsPrefix: string = "component.encryptionEffect.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static readonly FEATURE_ENABLED = true;
    static readonly EFFECT_DURATION_MS = 300;
    
    @Inject userPreferences: UserPreferences;
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }

    customShowForChat(text: string): void {
        if (text.length == 0 || !EncryptionEffectController.FEATURE_ENABLED || !this.userPreferences.getValue<boolean>(MailConst.UI_SHOW_ENCRYPTED_TEXT, true)) {
            return;
        }
        this.callViewMethod("customShowForChat", text.length);
    }

    show(text: string, encryptor: (text: string) => Q.Promise<string> = null, textAfterEffect: string = null): Q.Promise<void> {
        if (!EncryptionEffectController.FEATURE_ENABLED || !this.userPreferences.getValue<boolean>(MailConst.UI_SHOW_ENCRYPTED_TEXT, true)) {
            return Q().then(() => {
                if (textAfterEffect !== null) {
                    this.callViewMethod("setText", textAfterEffect);
                }
            });
        }
        
        let effectDeferred = Q.defer<void>();
        setTimeout(() => {
            effectDeferred.resolve();
        }, EncryptionEffectController.EFFECT_DURATION_MS);
        
        return Q()
        .then(() => {
            if (encryptor) {
                return encryptor(text);
            }
            return text;
        })
        .then(encryptedText => {
            this.callViewMethod("show", encryptedText);
            return effectDeferred.promise;
        })
        .then(() => {
            this.callViewMethod("hide", textAfterEffect);
        });
    }



}