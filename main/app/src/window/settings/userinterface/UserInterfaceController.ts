import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {UI, UserPreferences, UnreadBadgeClickAction, PasteAsFileAction, SystemClipboardIntegration} from "../../../mail/UserPreferences";
import {Inject} from "../../../utils/Decorators"
import { EncryptionEffectController } from "../../../component/encryptioneffect/main";
import { LocaleService, MailConst } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    ui: UI;
    isElectron: boolean;
    systemLabel?: string;
    osSuffix: string;
    isEncryptionEffectFeatureEnabled?: boolean;
    availableUnreadBadgeClickActions: UnreadBadgeClickAction[],
    availablePasteAsFileActions: PasteAsFileAction[],
    availableSystemClipboardIntegrations: SystemClipboardIntegration[],
    autostartEnabled?: boolean,
    errorsLoggingEnabled?: boolean
}

export class UserInterfaceController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "userinterface";
    
    @Inject userPreferences: UserPreferences;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
    }
    
    prepare(): void {
        // propagate defaults if values not set
        let uiPrefs = this.userPreferences.data.ui;
        Object.keys(UserPreferences.DEFAULTS.ui).forEach(key => {  
            if ((<any>uiPrefs)[key] == null) {
                (<any>uiPrefs)[key] = (<any>UserPreferences.DEFAULTS.ui)[key];
            }
        })

        // override autostartEnabled opion read from user profile whilst in electron app
        if (this.app.isElectronApp()) {
            let autostartEnabled = this.getAutostartSetting();
            uiPrefs.autostartEnabled = autostartEnabled;
        }

        // override errorsLoggingEnabled option read from user profile whilst in electron app
        if (this.app.isElectronApp()) {
            let errorsLoggingEnabled = this.getErrorsLoggingSetting();
            uiPrefs.errorsLoggingEnabled = errorsLoggingEnabled;
        }

        let model: Model = {
            ui: uiPrefs,
            isElectron: this.app.isElectronApp(),
            systemLabel: this.app.isElectronApp() ? (<any>this.app).getSystemLabel() : null,
            osSuffix: this.app.isElectronApp() ? "." + process.platform : "",
            isEncryptionEffectFeatureEnabled: EncryptionEffectController.FEATURE_ENABLED,
            availableUnreadBadgeClickActions: [UnreadBadgeClickAction.ASK, UnreadBadgeClickAction.IGNORE, UnreadBadgeClickAction.MARK_AS_READ],
            availablePasteAsFileActions: [PasteAsFileAction.ASK, PasteAsFileAction.PASTE_AS_TEXT, PasteAsFileAction.PASTE_AS_FILE],
            availableSystemClipboardIntegrations: [SystemClipboardIntegration.ASK, SystemClipboardIntegration.ENABLED, SystemClipboardIntegration.DISABLED],
            autostartEnabled: this.app.isElectronApp() ? (<any>this.app).isAutostartEnabled() : undefined,
            errorsLoggingEnabled: this.app.isElectronApp() ? (<any>this.app).profile.isErrorsLoggingEnabled(): undefined
        };
        this.callViewMethod("renderContent", model);
    }
}
