import * as RootLogger from "simplito-logger";
import * as privfs from "privfs-client";
import {PromiseUtils} from "simplito-promise";
import * as Utils from "simplito-utils";
import * as Q from "q";
import LodashGet = require("lodash.get");
import LodashSet = require("lodash.set");
import {utils, event} from "../Types";
import { EventDispatcher } from "../utils/EventDispatcher";
import { MailConst } from "./MailConst";
import { SoundsLibrary, SoundsCategoryName } from "../sounds/SoundsLibrary";
import { LocaleService } from ".";
let Logger = RootLogger.get("privfs-mail-client.mail.UserPreferences");


export interface Profile {
    name?: string;
    image?: string;
    description?: string;
}

export interface Presence {
    autoPresenceAfterLogin: boolean;
    dontAskAboutPresenceType: boolean;
    type: string;
    whitelist: string[];
}

export interface Notifications {
    [name: string]: any;
    enabled: boolean;
    email: string;
}

export enum UnreadBadgeClickAction {
    ASK = "ask",
    IGNORE = "ignore",
    MARK_AS_READ = "mark-as-read",
}

export enum PasteAsFileAction {
    ASK = "ask",
    PASTE_AS_TEXT = "paste-as-text",
    PASTE_AS_FILE = "paste-as-file",
}

export enum SystemClipboardIntegration {
    ASK = "ask",
    DISABLED = "disabled",
    ENABLED = "enabled",
}

export interface ContentEditableEditorSettings {
    isAutoTaskPickerEnabled?: boolean;
    isAutoFilePickerEnabled?: boolean;
}

export interface UI {
    
    windowTitleBarButtonsPosition: string;
    audio: boolean;
    notifications: boolean;
    notificationsVolume: number;
    seenFirstLoginInfo: boolean;
    lang?: string;
    spellchecker2: boolean;
    spellCheckerLanguages: string;
    showEncryptedText: boolean;
    showAllSections: boolean;
    
    contextSwitchWithoutShift: boolean;
    
    unreadBadgeClickAction: UnreadBadgeClickAction;
    unreadBadgeUseDoubleClick: boolean;
    playBubblePopSound: boolean;
    pasteAsFileAction: PasteAsFileAction;
    appSilentMode: boolean;
    onlineFirst: boolean;
    systemClipboardIntegration: SystemClipboardIntegration;
    pinnedSectionIdsStr: string;
    autoMarkAsRead: boolean;
    inactivityOverlay: boolean;
    autostartEnabled?: boolean;
    errorsLoggingEnabled?: boolean;
    selectedDevices?: string;
    videoFrameSignatureVerificationRatioInverse?: number;
    customSuccessColor?: string;
}

export interface Mail {
    signature?: string;
}

export interface Player {
    loop?: boolean;
    random?: boolean;
    playlist?: string[];
    collapsed?: boolean;
    muted?: boolean;
    volume?: number;
}

export interface Actions {
    initDataProcessed?: boolean;
}

export interface Sounds {
    [key: string]: string;
}

export interface CustomSectionNames {
    [key: string]: string;
}

export interface Preferences {
    version?: number;
    ui?: UI;
    profile?: Profile;
    notifications?: Notifications;
    presence?: Presence;
    mail?: Mail;
    player?: Player;
    actions?: Actions;
    sounds?: Sounds;
    customSectionNames?: CustomSectionNames;
    contentEditableEditor?: ContentEditableEditorSettings;
}

export interface PreferencesKvdbEntry extends privfs.types.db.KvdbEntry {
    secured: {
        key?: string;
        value: Preferences;
    }
}

export class UserPreferences {
    static DEFAULTS: Preferences = {
        version: 1,
        ui: {
            windowTitleBarButtonsPosition: "right",
            audio: false,
            notifications: true,
            notificationsVolume: 1.0,
            seenFirstLoginInfo: false,
            spellchecker2: false,
            spellCheckerLanguages: null,
            showEncryptedText: true,
            showAllSections: true,
            contextSwitchWithoutShift: true,
            unreadBadgeClickAction: UnreadBadgeClickAction.ASK,
            unreadBadgeUseDoubleClick: false,
            playBubblePopSound: true,
            pasteAsFileAction: PasteAsFileAction.ASK,
            appSilentMode: false,
            onlineFirst: false,
            systemClipboardIntegration: SystemClipboardIntegration.ASK,
            pinnedSectionIdsStr: "[]",
            autoMarkAsRead: true,
            inactivityOverlay: true,
            selectedDevices: null,
            videoFrameSignatureVerificationRatioInverse: 1000,
            customSuccessColor: "default",
        },
        profile: {
            name: "",
            image: "",
            description: ""
        },
        notifications: {
            enabled: false,
            email: ""
        },
        presence: {
            autoPresenceAfterLogin: false,
            dontAskAboutPresenceType: false,
            type: "noone",
            whitelist: <string[]>[]
        },
        player: {
            loop: true,
            random: false,
            playlist: [],
            collapsed: false,
            muted: false,
            volume: 1.0,
        },
        actions: {
            initDataProcessed: false
        },
        sounds: {},
        customSectionNames: {},
        contentEditableEditor: {
            isAutoFilePickerEnabled: true,
            isAutoTaskPickerEnabled: true,
        },
    };
    
    data: Preferences;
    defaults: Preferences;
    soundsLibrary: SoundsLibrary = new SoundsLibrary();
    
    constructor(
        public kvdb: utils.IKeyValueDb<PreferencesKvdbEntry>,
        public kvdbKey: string,
        public eventDispatcher: EventDispatcher
    ) {
        this.defaults = Utils.simpleDeepClone(UserPreferences.DEFAULTS);
    }
    
    load(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("load");
            return this.kvdb.opt(this.kvdbKey, {secured: {value: this.defaults}});
        })
        .then(data => {
            this.data = data.secured.value || {};
            Logger.debug("loaded", this.data);
            this.eventDispatcher.dispatchEvent<event.UserPreferencesChangeEvent>({
                type: "userpreferenceschange",
                operation: "load",
                userPreferences: this
            });
        });
    }
    
    save(data?: Preferences): Q.Promise<void> {
        let dataToSave = data || this.data;
        return PromiseUtils.notify(notify => {
            Logger.debug("save");
            notify("Saving user preferences");
            return this.kvdb.set(this.kvdbKey, {secured: {value: dataToSave}});
        })
        .then(() => {
            this.data = dataToSave;
            Logger.debug("saved", this.data);
            this.eventDispatcher.dispatchEvent<event.UserPreferencesChangeEvent>({
                type: "userpreferenceschange",
                operation: "save",
                userPreferences: this
            });
        });
    }
    
    set(path: string, value: any, save: boolean): Q.Promise<void> {
        return Q().then(() => {
            if (LodashGet(this.data, path) === value) {
                return;
            }
            Logger.debug("set", path, value, save);
            LodashSet(this.data, path, value);
            if (save) {
                return this.save();
            }
        });
    }
    
    setMany(changesMap: {[path: string]: any}, save: boolean): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("setMany", changesMap, save);
            for (var path in changesMap) {
                LodashSet(this.data, path, changesMap[path]);
            }
            if (save) {
                return this.save();
            }
        });
    }
    
    get<T>(path: string, defaultValue?: T): Q.Promise<T> {
        return Q().then(() => {
            Logger.debug("get", path, defaultValue);
            return this.getValue<T>(path, defaultValue);
        });
    }
    
    getValue<T>(path: string, defaultValue?: T): T {
        return LodashGet(this.data, path, defaultValue);
    }
    
    getMany(pathsOrMap: string[]|{[path: string]: any}): {[path: string]: any} {
        return Q().then(() => {
            Logger.debug("getMany", pathsOrMap);
            let result: {[path: string]: any} = {};
            if (Array.isArray(pathsOrMap)) {
                pathsOrMap.forEach(path => {
                    result[path] = LodashGet(this.data, path);
                });
            }
            else {
                for (let path in pathsOrMap) {
                    result[path] = LodashGet(this.data, path, pathsOrMap[path]);
                }
            }
            return result;
        });
    }
    
    update(fn: (data: Preferences) => Preferences): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("update");
            let data = this.data ? Utils.simpleDeepClone(this.data) : {};
            return fn(data);
        })
        .then(changes => {
            if (changes) {
                return this.save(changes);
            }
        });
    }
    
    getMutedSinksWithModules(): string[] {
        let muted = this.getValue(MailConst.NOTIFICATIONS_MUTED_SINKS, "")
        return  muted.length > 0 ? JSON.parse(muted) : [];
    }
    
    isGloballyMuted(): boolean {
        return !this.getValue(MailConst.UI_NOTIFICATIONS, true);
    }
    
    isSpellCheckerEnabled(): boolean {
        return this.getValue(MailConst.UI_SPELLCHECKER, false);
    }
    
    getSpellCheckerLanguages(skipEnabledCheck: boolean = false): string[] {
        if (!skipEnabledCheck) {
            let isSpellCheckerEnabled = this.getValue(MailConst.UI_SPELLCHECKER, false);
            if (!isSpellCheckerEnabled) {
                return [];
            }
        }
        
        let spellCheckerLanguagesStr = this.getValue(MailConst.UI_SPELLCHECKER_LANGUAGES, JSON.stringify(this.getDefaultSpellCheckerLanguages()));
        
        try {
            let arr = JSON.parse(spellCheckerLanguagesStr);
            return arr ? arr : this.getDefaultSpellCheckerLanguages();
        }
        catch {}
        
        return this.getDefaultSpellCheckerLanguages();
    }
    
    getDefaultSpellCheckerLanguages(): string[] {
        let defaultLangCode = this.getValue<string>("ui.lang") || "en";
        let defaultLang = LocaleService.AVAILABLE_LANGS.filter(x => x.code == defaultLangCode)[0];
        let defaultLanguages = [defaultLang ? defaultLang.spellCheckerCode : "en-US"];
        return defaultLanguages;
    }
    
    setSpellCheckerLanguages(langs: string[]): Q.Promise<void> {
        return this.set(MailConst.UI_SPELLCHECKER_LANGUAGES, JSON.stringify(langs), true);
    }
    
    getUnreadBadgeClickAction(): UnreadBadgeClickAction {
        return this.getValue(MailConst.UI_UNREAD_BADGE_CLICK_ACTION, UnreadBadgeClickAction.ASK);
    }
    
    getUnreadBadgeUseDoubleClick(): boolean {
        return this.getValue(MailConst.UI_UNREAD_BADGE_USE_DOUBLE_CLICK, false);
    }
    
    getPlayBubblePopSound(): boolean {
        return this.getValue(MailConst.UI_PLAY_BUBBLE_POP_SOUND, true);
    }
    
    getPasteAsFileAction(): PasteAsFileAction {
        return this.getValue(MailConst.UI_PASTE_AS_FILE_ACTION, PasteAsFileAction.ASK);
    }
    
    getSystemClipboardIntegration(): SystemClipboardIntegration {
        return this.getValue(MailConst.UI_SYSTEM_CLIPBOARD_INTEGRATION, SystemClipboardIntegration.ASK);
    }
    
    getSoundName(categoryName: SoundsCategoryName): string {
        let sounds = <{ [key:string]: string }>this.getValue("sounds", null);
        return sounds && sounds[categoryName] ? this.soundsLibrary.getExistingSoundName(categoryName, sounds[categoryName]) : this.soundsLibrary.getDefaultSoundName(categoryName);
    }
    
    getCustomSectionNames(): CustomSectionNames {
        return this.getValue(MailConst.CUSTOM_SECTION_NAMES, {});
    }
    
    getPinnedSectionIds(): string[] {
        let val = this.getValue(MailConst.UI_PINNED_SECTION_IDS_STR, "[]");
        let ids = JSON.parse(val);
        return ids ? ids : [];
    }
    
    setPinnedSectionIds(ids: string[]): Q.Promise<void> {
        return this.set(MailConst.UI_PINNED_SECTION_IDS_STR, JSON.stringify(ids), true);
    }
    
    getAutoMarkAsRead(): boolean {
        return this.getValue(MailConst.UI_AUTO_MARK_AS_READ, true);
    }

    getInactivityOverlay(): boolean {
        return this.getValue(MailConst.UI_INACTIVITY_OVERLAY, true);
    }
    
    getIsAutoTaskPickerEnabled(): boolean {
        return false;
        // return this.getValue(MailConst.CED_IS_AUTO_TASK_PICKER_ENABLED, true);
    }
    
    getIsAutoFilePickerEnabled(): boolean {
        return false;
        // return this.getValue(MailConst.CED_IS_AUTO_FILE_PICKER_ENABLED, true);
    }
    
    getProfileImage(): string {
        return this.getValue(MailConst.PROFILE_IMAGE, "") || "";
    }
    
    getVideoFrameSignatureVerificationRatioInverse(): number {
        return this.getValue<number>(MailConst.UI_VIDEO_FRAME_SIGNATURE_VERIFICATION_RATIO_INVERSE, 1000) || 1000;
    }
    
    async setVideoFrameSignatureVerificationRatioInverse(ratioInverse: number): Promise<void> {
        await this.set(MailConst.UI_VIDEO_FRAME_SIGNATURE_VERIFICATION_RATIO_INVERSE, ratioInverse, true);
    }
    
}
