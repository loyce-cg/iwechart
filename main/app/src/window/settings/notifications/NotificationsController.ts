import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {Notifications, UserPreferences} from "../../../mail/UserPreferences";
import {mail, utils} from "../../../Types";
import {Inject} from "../../../utils/Decorators"
import { LocaleService, MailConst } from "../../../mail";
import { i18n } from "../i18n";
import { SoundsCategory, Sound, SoundsLibrary } from "../../../sounds/SoundsLibrary";

export interface SimpleNotificationEntry {
    userPreferencesKey: string;
    defaultValue: boolean;
    i18nKey: string;
}

export interface Model {
    uiNotifications: boolean;
    notifications: Notifications;
    entries: SimpleNotificationEntry[];
    uiAppSilentMode: boolean;
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

export class NotificationsController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "notifications";
    
    @Inject userPreferences: UserPreferences;
    @Inject notifications: utils.Option<mail.NotificationEntry[]>;
    
    soundsLibrary: SoundsLibrary = new SoundsLibrary();
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
        this.notifications = this.parent.notifications;
    }
    
    prepare(): void {
        let entries = this.notifications;
        let defaultValue: Notifications = {
            enabled: false,
            email: ""
        };
        entries.value.forEach(x => {
            defaultValue[x.userPreferencesKey] = x.defaultValue;
        });
        let model: Model = {
            uiNotifications: this.getGlobalNotificationsEnabled(),
            notifications: this.userPreferences.getValue<Notifications>("notifications", defaultValue),
            entries: entries.value.filter(x => x.userPreferencesKey != "mails").map(this.convertNotificationEntry),
            uiAppSilentMode: this.app.getSilentMode(),
            audioNotifications: this.getAudioNotificationsEnabled(),
            soundsCategories: this.soundsLibrary.categories.map(x => ({
                spec: x,
                sounds: this.soundsLibrary.getSoundsByCategory(x.name),
                currentSound: this.userPreferences.getSoundName(x.name),
            })),
        };
        this.callViewMethod("renderContent", model);
    }
    
    convertNotificationEntry(entry: mail.NotificationEntry): SimpleNotificationEntry {
        return {
            userPreferencesKey: entry.userPreferencesKey,
            defaultValue: entry.defaultValue,
            i18nKey: entry.i18nKey,
        };
    }
    
    getGlobalNotificationsEnabled(): boolean {
        return this.userPreferences.getValue(MailConst.UI_NOTIFICATIONS, true);
    }
    
    setGlobalNotificationsEnabled(value: boolean) {
        this.userPreferences.set(MailConst.UI_NOTIFICATIONS, value, true);
    }    
    
    onViewOpenSections(): void {
        this.app.openSections();
    }
    
    onViewPlay(sound: string): void {
        this.app.playAudio(sound, true);
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
