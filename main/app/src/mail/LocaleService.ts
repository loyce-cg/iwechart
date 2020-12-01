import moment = require("moment");
import {Event} from "../utils/Event";
import {app} from "../Types";
require("moment/locale/da");
require("moment/locale/de");
require("moment/locale/es");
require("moment/locale/fr");
require("moment/locale/it");
require("moment/locale/nl");
require("moment/locale/pl");
require("moment/locale/sv");

export interface Language {
    code: string;
    nativeName: string;
    isExperimental: boolean;
    flagCode?: string;
    showEvenIfEmpty?: boolean;
    isEmpty: boolean;
}

export class LocaleService {
    
    static moment: any = moment;
    static readonly FALLBACK_LANG_CODE = "en";
    static readonly LOG_MISSING_TRANSLATIONS = false;
    static readonly AVAILABLE_LANGS: Language[] = [
        { code: "en", nativeName: "English", isExperimental: false, flagCode: "gb", showEvenIfEmpty: true, isEmpty: false },
        { code: "da", nativeName: "Dansk", isExperimental: true, flagCode: "dk", isEmpty: false },
        { code: "de", nativeName: "Deutsch", isExperimental: true, isEmpty: false },
        { code: "es-ES", nativeName: "Español", isExperimental: true, flagCode: "es", isEmpty: false },
        { code: "fr", nativeName: "Français", isExperimental: true, isEmpty: false },
        { code: "it", nativeName: "Italiano", isExperimental: true, isEmpty: false },
        { code: "nl", nativeName: "Nederlands", isExperimental: true, isEmpty: false },
        { code: "pl", nativeName: "Polski", isExperimental: false, isEmpty: false },
        { code: "sv-SE", nativeName: "Svenska", isExperimental: true, flagCode: "se", isEmpty: false },
    ];
    static readonly DEFAULT_LANG_CODE: string = "en";
    static EMPTY_LANGS_PROCESSED: boolean = false;
    
    texts: app.i18nLangs;
    textsWithPrefixes: { [prefix: string]: app.i18nLangs } = {};
    defaultLang: string;
    currentLang: string;
    availableLangs: string[];
    changeEvent: Event<any, any, any>;
    i18nBinded: Function;
    sinkPollingTasks: string[];
    serializedTexts: { [langName: string]: string } = {};
    
    constructor(texts: app.i18nLangs, defaultLang: string, availableLangs: string[] = null) {
        this.texts = texts;
        this.defaultLang = defaultLang;
        this.currentLang = defaultLang;
        this.availableLangs = (availableLangs ? availableLangs : LocaleService.AVAILABLE_LANGS.map(x => x.code)).filter(x => {
            let langSpec = LocaleService.AVAILABLE_LANGS.filter(y => y.code == x)[0];
            return (langSpec && (!langSpec.isEmpty || langSpec.showEvenIfEmpty) && !langSpec.isExperimental);
        });
        this.changeEvent = new Event();
        this.i18nBinded = this.i18n.bind(this);
        this.sinkPollingTasks = [];
        this.reconfigureMoment();
    }
    
    static create(texts: app.i18nLangs, defaultLang?: string): LocaleService {
        this.markEmptyLanguages(texts);
        return new LocaleService(texts, defaultLang ? defaultLang : LocaleService.DEFAULT_LANG_CODE);
    }
    
    static canUseAsDefaultLanguage(langCode: string): boolean {
        let lang = LocaleService.AVAILABLE_LANGS.filter(x => x.code == langCode)[0];
        return lang && !lang.isExperimental;
    }
    
    static markEmptyLanguages(texts: app.i18nLangs): void {
        if (this.EMPTY_LANGS_PROCESSED) {
            return;
        }
        this.EMPTY_LANGS_PROCESSED = true;
        for (let langCode in texts) {
            let langSpec = LocaleService.AVAILABLE_LANGS.filter(x => x.code == langCode)[0];
            if (!langSpec) {
                continue;
            }
            let isEmpty: boolean = true;
            for (let k in texts[langCode]) {
                isEmpty = false;
                break;
            }
            langSpec.isEmpty = isEmpty;
        }
    }
    
    getFlagCode(langCode: string): string {
        let lang = LocaleService.AVAILABLE_LANGS.filter(x => x.code == langCode)[0];
        if (lang && lang.flagCode) {
            return lang.flagCode;
        }
        return langCode;
    }
    
    getSerializedTexts(langName: string): string {
        if (!(langName in this.serializedTexts)) {
            if (langName != LocaleService.FALLBACK_LANG_CODE) {
                for (let key in this.texts[LocaleService.FALLBACK_LANG_CODE]) {
                    if (!(key in this.texts[langName])) {
                        this.texts[langName][key] = this.texts[LocaleService.FALLBACK_LANG_CODE][key];
                        this.logMissingTranslation(langName, key);
                    }
                }
            }
            LocaleService.AVAILABLE_LANGS.forEach(x => {
                if (this.availableLangs.indexOf(x.code) < 0) {
                    return;
                }
                this.texts[langName][`core.langs.${x.code}`] = x.nativeName + (x.isExperimental ? "-test" : "");
            });
            this.serializedTexts[langName] = JSON.stringify(this.texts[langName]);
        }
        return this.serializedTexts[langName];
    }
    
    addTexts(texts: app.i18nLangs): void {
        for (let lang in texts) {
            let langMap = texts[lang];
            if (!(lang in this.texts)) {
                this.texts[lang] = {};
            }
            let dest = this.texts[lang];
            for (let key in langMap) {
                dest[key] = langMap[key];
            }
        }
    }
    
    registerTexts(texts: app.i18nLangs, prefix: string = ""): void {
        for (let lang in texts) {
            let langMap = texts[lang];
            if (!(lang in this.texts)) {
                this.texts[lang] = {};
            }
            let dest = this.texts[lang];
            for (let key in langMap) {
                dest[prefix + key] = langMap[key];
            }
        }
    }
    
    // @todo i18n-per-window: replace registerTexts with registerTexts2 after enabling i18n-per-window
    registerTexts2(texts: app.i18nLangs, prefix: string = ""): void {
        if (prefix in this.textsWithPrefixes) {
            return;
        }
        for (let lang in texts) {
            let langMap = texts[lang];
            if (!(lang in this.texts)) {
                this.textsWithPrefixes[prefix][lang] = {};
            }
            let dest = this.textsWithPrefixes[prefix][lang];
            for (let key in langMap) {
                dest[key] = langMap[key];
            }
        }
    }
    
    i18n(key: string, ...args: any[]): string {
        let text = key;
        let found: boolean = false;
        if (this.texts[this.currentLang] && this.texts[this.currentLang][key]) {
            text = this.texts[this.currentLang][key];
            found = true;
        }
        else if (this.texts[this.defaultLang] && this.texts[this.defaultLang][key]) {
            text = this.texts[this.defaultLang][key];
            found = true;
        }
        if (!found) {
            this.logMissingTranslation(this.currentLang, key);
        }
        let params = Array.prototype.slice.call(arguments);
        params[0] = text;
        return this.formatText.apply(this, params);
    }
    
    i18nGetMatchingKeys(keyPrefix: string, returnFullKeys: boolean = true): string[] {
        let matchingKeys: string[] = [];
        let texts = this.texts[Object.keys(this.texts)[0]];
        let keyPrefixLength = keyPrefix.length;
        for (let key in texts) {
            if (key.substr(0, keyPrefixLength) == keyPrefix) {
                matchingKeys.push(returnFullKeys ? key : key.substr(keyPrefixLength));
            }
        }
        return matchingKeys;
    }
    
    getTaskName(taskName: string): string {
        if (taskName == "sink-polling") {
            let tasks = "";
            this.sinkPollingTasks.forEach((task, i) => {
                if (i == 0) {
                    tasks = task;
                }
                else {
                    tasks += (i == this.sinkPollingTasks.length - 1 ? " " + this.i18n("app.task.sinkPolling.and") + " " : ", ") + task;
                }
            });
            return this.i18n("app.task.sinkPolling", tasks);
        }
        return taskName || this.i18n("app.task.defaultText");
    }
    
    formatText(text: string, ...args: any[]): string {
        text = text.toString();
        if (arguments.length < 2) {
            return text;
        }
        let params = ("object" == typeof(arguments[1])) ? arguments[1] : Array.prototype.slice.call(arguments, 1);
        for (var k in params) {
            text = text.replace(new RegExp("\\{" + k + "\\}", "gi"), params[k]);
        }
        return text;
    }
    
    setLangEx(lang?: string): void {
        if (!lang) {
            this.detectLangFromBrowser();
        }
        else {
            this.setLang(lang);
        }
    }
    
    detectLangFromBrowser(): void {
        let lang = window.navigator.language ? window.navigator.language.split("-")[0] : null;
        return this.setLang(lang);
    }
    
    isValidLang(lang: string): boolean {
        for (let i = 0; i < this.availableLangs.length; i++) {
            if (lang == this.availableLangs[i]) {
                return true;
            }
        }
        return false;
    }
    
    setLang(lang: string): void {
        if (this.isValidLang(lang)) {
            this.currentLang = lang;
            this.reconfigureMoment();
        }
        this.changeEvent.trigger();
    }
    
    getLang(lang: string): string {
        return this.isValidLang(lang) ? lang : this.currentLang;
    }
    
    reconfigureMoment(): void {
        moment.updateLocale(this.currentLang, {calendar: {
            sameDay: 'HH:mm',
            lastDay: "[" + this.i18n("core.date.yesterday") + "] HH:mm",
            lastWeek: 'dddd',
            sameElse: function(this: moment.Moment) {
                return "[" + this.fromNow() + "]";
            }
        }});
    }
    
    timeAgo(dateArg: Date|number|string, withoutSuffix?: boolean): string {
        let date = (typeof(dateArg) == "object") ? <Date>dateArg : new Date(parseInt(<string>dateArg));
        return moment(date).fromNow(withoutSuffix);
    }

    calendarDate(dateArg: Date|number|string, withTime: boolean = true): string {
        if (withTime) {
            return this.calendarDateWithTime(dateArg);
        }
        let date = (typeof(dateArg) == "object") ? <Date>dateArg : new Date(parseInt(<string>dateArg));
        return moment(date).calendar();
    }
    
    calendarDateWithTime(dateArg: Date|number|string): string {
        let date = (typeof(dateArg) == "object") ? <Date>dateArg : new Date(parseInt(<string>dateArg));
        
        const calendarDate = moment(date).calendar();
        const formattedTime = moment(date).format("HH:mm");
        
        if (calendarDate === formattedTime) {
            return formattedTime;
        }
        return calendarDate + ", " + formattedTime;
    }
    
    longDate(date: Date|number): string {
        return moment(date).format("llll Z");
    }
    
    logMissingTranslation(lang: string, key: string): void {
        if (LocaleService.LOG_MISSING_TRANSLATIONS) {
            console.trace();
            console.log({lang,key});
        }
    }
    
}
