import {event, section} from "../../Types";
import {SectionManager} from "./SectionManager";
import {UserPreferences} from "../UserPreferences";
import {MailConst} from "../MailConst";
import {Lang} from "../../utils/Lang";
import * as Q from "q";

export class UserPreferencesService {
    
    static USER_PREFERENCES_KEY = "chat-plugin.muted-channels";
    
    constructor(
        public sectionManager: SectionManager,
        public userPreferences: UserPreferences
    ) {
        this.userPreferences.eventDispatcher.addEventListener<event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this));
    }
    
    parseUserSettigs(settings: section.UserSettingsSerialized): section.UserSettings {
        return {
            visible: "visible" in settings ? !!settings.visible : true,
            mutedModules: "mutedModules" in settings ? {
                chat: "chat" in settings.mutedModules ? !!settings.mutedModules.chat : false,
                notes2: "notes2" in settings.mutedModules ? !!settings.mutedModules.notes2 : false,
                tasks: "tasks" in settings.mutedModules ? !!settings.mutedModules.tasks : false,
            } : { chat: false, notes2: false, tasks: false }
        }
    }
    
    getPreferences(): section.UserSettingsSerialized[] {
        return this.userPreferences.getValue(UserPreferencesService.USER_PREFERENCES_KEY) || [];
    }
    
    getUserSettings(sectionId: section.SectionId): section.UserSettings {
        let prefs = this.getPreferences();
        let settings = Lang.find(prefs, x => x.id == sectionId);
        if (settings) {
            return this.parseUserSettigs(settings);
        }
        return {
            visible: true,
            mutedModules: { chat: false, notes2: false, tasks: false },
        };
    }
    
    onUserPreferencesChange(_event: event.UserPreferencesChangeEvent): void {
        let prefs = this.getPreferences();
        prefs.forEach(x => {
            this.processUserSettingsEntry(x);
        });
    }
    
    processUserSettingsEntry(rawSettings: section.UserSettingsSerialized): void {
        this.sectionManager.setUserSettings(rawSettings.id, this.parseUserSettigs(rawSettings));
    }
    
    saveUserSettingsEntry(rawSettings: section.UserSettingsSerialized): Q.Promise<void> {
        return Q().then(() => {
            let prefs = this.getPreferences();
            let index = Lang.indexOf(prefs, x => x.id == rawSettings.id);
            if (index == -1) {
                prefs.push(rawSettings);
            }
            else {
                prefs[index] = rawSettings;
            }
            let notificationsMutedSinks: string[] = [];
            prefs.forEach(setting => {
                for (let k in setting.mutedModules) {
                    if (setting.mutedModules[k]) {
                        let section = this.sectionManager.getSection(setting.id);
                        if (section && section.hasChatModule()) {
                            notificationsMutedSinks.push(section.getChatSink().id + "/" + k);
                        }
                    }
                }
            });
            let map: {[key: string]: any} = {};
            map[MailConst.NOTIFICATIONS_MUTED_SINKS] = JSON.stringify(notificationsMutedSinks);
            map[UserPreferencesService.USER_PREFERENCES_KEY] = prefs;
            return this.userPreferences.setMany(map, true);
        })
        .then(() => {
            this.processUserSettingsEntry(rawSettings);
        });
    }
}