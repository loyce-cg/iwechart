import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {SinkIndexManager} from "../../../mail/SinkIndexManager";
import {Inject} from "../../../utils/Decorators"
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    userContactFormUrl: string;
    activated: boolean;
    verifyEmail: boolean;
    requirePass: boolean;
}

export class ContactFormController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "contactForm";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject sinkIndexManager: SinkIndexManager;
    @Inject authData: privfs.types.core.UserDataEx;
    @Inject messageManager: privfs.message.MessageManager;
    @Inject sinkEncryptor: privfs.crypto.utils.ObjectEncryptor;
    @Inject userConfig: privfs.types.core.UserConfig;
    @Inject identity: privfs.identity.Identity;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.sinkIndexManager = this.parent.sinkIndexManager;
        this.authData = this.parent.authData;
        this.messageManager = this.parent.messageManager;
        this.sinkEncryptor = this.parent.sinkEncryptor;
        this.userConfig = this.parent.userConfig;
        this.identity = this.parent.identity;
    }
    
    prepare(): void {
        let sink = this.sinkIndexManager.getContactFormSink();
        let model: Model = {
            userContactFormUrl: this.userConfig.userContactFormUrl + "?" + this.identity.user,
            activated: this.authData.myData.raw.contactFormEnabled,
            verifyEmail: sink.options.verify == "email",
            requirePass: !!(<any>sink.options).requirePass
        };
        this.callViewMethod("renderContent", model);
    }
    
    onViewSwitchActivateContactForm(mode: boolean) {
        this.addTaskEx("", true, () => {
            return this.srpSecure.setContactFormEnabled(mode).then(() => {
                this.authData.myData.raw.contactFormEnabled = mode;
                this.callViewMethod("setActivateContactForm", mode);
            });
        });
    }
    
    onViewSwitchVerifyEmailContactForm(mode: boolean) {
        this.addTaskEx("", true, () => {
            let contactForm = this.sinkIndexManager.getContactFormSink();
            if (mode) {
                contactForm.options.verify = "email";
            }
            else {
                delete contactForm.options.verify;
            }
            return Q().then(() => {
                return this.messageManager.sinkSave(contactForm, this.sinkEncryptor);
            })
            .then(() => {
                this.callViewMethod("setVerifyEmailContactForm", mode);
            });
        });
    }
    
    onViewSwitchRequirePassContactForm(mode: boolean) {
        this.addTaskEx("", true, () => {
            let contactForm = this.sinkIndexManager.getContactFormSink();
            (<any>contactForm.options).requirePass = mode;
            return Q().then(() => {
                return this.messageManager.sinkSave(contactForm, this.sinkEncryptor);
            })
            .then(() => {
                this.callViewMethod("setRequirePassContactForm", mode);
            });
        });
    }
}
