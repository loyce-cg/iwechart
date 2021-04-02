import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {Notifications, UserPreferences} from "../../../mail/UserPreferences";
import {mail, utils} from "../../../Types";
import {Inject} from "../../../utils/Decorators"
import { LocaleService, MailConst } from "../../../mail";
import { i18n } from "../i18n";
import { SoundsCategory, Sound, SoundsLibrary } from "../../../sounds/SoundsLibrary";
import { SliderController } from "../../../component/slider/SliderController";

export interface SimpleNotificationEntry {
    userPreferencesKey: string;
    defaultValue: boolean;
    i18nKey: string;
}

export interface Model {
    uiNotifications: boolean;
    notifications: Notifications;
    notificationsVolume: number;
    entries: SimpleNotificationEntry[];
    uiAppSilentMode: boolean;
    audioNotifications: boolean;
    soundsCategories: {
        spec: SoundsCategory;
        sounds: Sound[];
        currentSound: string;
    }[];
    isElectron: boolean;
}

export interface PartialResult {
    // notifications: boolean;
    notificationsVolume: number;
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
    volumeSlider: SliderController;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
        this.notifications = this.parent.notifications;
        this.volumeSlider = this.addComponent("volumeSlider", this.componentFactory.createComponent("slider", [this, {
            onUserValueChange: value => {
                this.volumeSlider.value = value;
            },
        }]));
        this.volumeSlider.setMax(1.0);
        this.volumeSlider.setValue(1.0);
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
            notificationsVolume: this.getNotificationsVolume(),
            entries: entries.value.filter(x => x.userPreferencesKey != "mails").map(this.convertNotificationEntry),
            uiAppSilentMode: this.app.getSilentMode(),
            audioNotifications: this.getAudioNotificationsEnabled(),
            soundsCategories: this.soundsLibrary.categories.map(x => ({
                spec: x,
                sounds: this.soundsLibrary.getSoundsByCategory(x.name),
                currentSound: this.userPreferences.getSoundName(x.name),
            })),
            isElectron: this.app.isElectronApp()
        };
        this.volumeSlider.setValue(model.notificationsVolume);
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
        this.app.playAudio(sound, { force: true, defaultVolume: this.volumeSlider.value });
    }
    
    getAudioNotificationsEnabled(): boolean {
        return this.userPreferences.getValue(MailConst.UI_AUDIO, true);
    }
    
    setAudioNotificationsEnabled(value: boolean) {
        this.userPreferences.set(MailConst.UI_AUDIO, value, true);
    }
    
    getNotificationsVolume(): number {
        return this.userPreferences.getValue(MailConst.UI_NOTIFICATIONS_VOLUME, 1.0);
    }
    
    setNotificationsVolume(value: number) {
        this.userPreferences.set(MailConst.UI_NOTIFICATIONS_VOLUME, value, true);
    }
    
    onViewSavePartialResult(resultStr: string): void {
        let result: PartialResult = JSON.parse(resultStr);
        // if (this.getGlobalNotificationsEnabled() != result.notifications) {
        //     this.setGlobalNotificationsEnabled(result.notifications);
        // }
        if (this.getAudioNotificationsEnabled() != result.audioNotifications) {
            this.setAudioNotificationsEnabled(result.audioNotifications);
        }
        if (this.getNotificationsVolume() != result.notificationsVolume) {
            this.setNotificationsVolume(result.notificationsVolume);
        }
    }
    
}
