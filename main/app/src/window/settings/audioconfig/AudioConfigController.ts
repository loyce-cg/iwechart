import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {UserPreferences} from "../../../mail/UserPreferences";
import {Inject} from "../../../utils/Decorators";
import { LocaleService, MailConst } from "../../../mail";
import { i18n } from "../i18n";
import { SoundsCategory, Sound, SoundsLibrary } from "../../../sounds/SoundsLibrary";

export interface Model {
    // notifications: boolean;
    audioNotifications: boolean;
    soundsCategories: {
        spec: SoundsCategory;
        sounds: Sound[];
        currentSound: string;
    }[];
}

export interface PartialResult {
    // notifications: boolean;
    audioNotifications: boolean;
}

export class AudioConfigController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "audioconfig";
    
    @Inject userPreferences: UserPreferences;
    
    soundsLibrary: SoundsLibrary = new SoundsLibrary();
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
    }
    
    prepare(): void {
        if (!this.app.isElectronApp()) {
            return;
        }
        let model: Model = {
            // notifications: this.getGlobalNotificationsEnabled(),
            audioNotifications: this.getAudioNotificationsEnabled(),
            soundsCategories: this.soundsLibrary.categories.map(x => ({
                spec: x,
                sounds: this.soundsLibrary.getSoundsByCategory(x.name),
                currentSound: this.userPreferences.getSoundName(x.name),
            })),
        };
        this.callViewMethod("renderContent", model);
    }
    
    onViewPlay(sound: string): void {
        this.app.playAudio(sound, { force: true });
    }
    
    getGlobalNotificationsEnabled(): boolean {
        return this.userPreferences.getValue(MailConst.UI_NOTIFICATIONS, true);
    }
    
    setGlobalNotificationsEnabled(value: boolean) {
        this.userPreferences.set(MailConst.UI_NOTIFICATIONS, value, true);
    }
    
    getAudioNotificationsEnabled(): boolean {
        return this.userPreferences.getValue(MailConst.UI_AUDIO, true);
    }
    
    setAudioNotificationsEnabled(value: boolean) {
        this.userPreferences.set(MailConst.UI_AUDIO, value, true);
    }
    
    onViewSavePartialResult(resultStr: string): void {
        let result: PartialResult = JSON.parse(resultStr);
        // if (this.getGlobalNotificationsEnabled() != result.notifications) {
        //     this.setGlobalNotificationsEnabled(result.notifications);
        // }
        if (this.getAudioNotificationsEnabled() != result.audioNotifications) {
            this.setAudioNotificationsEnabled(result.audioNotifications);
        }
    }
    
}
