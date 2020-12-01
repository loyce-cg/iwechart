import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {Mail, UserPreferences} from "../../../mail/UserPreferences";
import {Inject} from "../../../utils/Decorators"
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    mail: Mail;
}

export class MailController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "mail";
    
    @Inject userPreferences: UserPreferences;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
    }
    
    prepare(): void {
        let model: Model = {
            mail: this.userPreferences.data.mail
        };
        this.callViewMethod("renderContent", model);
    }
}
