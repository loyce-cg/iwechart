import moment = require("moment");
import {app} from "../Types";
require("moment/locale/pl");

export class MomentService {
    
    static moment: any = moment;
    
    texts: app.i18nLangs;
    defaultLang: string;
    currentLang: string;
    availableLangs: string[];
    i18nBinded: Function;
    
    constructor(texts: app.i18nLangs, defaultLang: string, availableLangs: string[]) {
        this.texts = texts;
        this.defaultLang = defaultLang;
        this.currentLang = defaultLang;
        this.availableLangs = availableLangs;
        this.i18nBinded = this.i18n.bind(this);
        this.reconfigureMoment();
    }
    
    static create(): MomentService {
        return new MomentService({
            "en": {
                "core.date.yesterday": "Yesterday"
            },
            "pl": {
                "core.date.yesterday": "Wczoraj"
            }
        }, "en", ["en", "pl"]);
    }
    
    i18n(key: string, ...args: any[]): string {
        let text = key;
        if (this.texts[this.currentLang] && this.texts[this.currentLang][key]) {
            text = this.texts[this.currentLang][key];
        }
        else if (this.texts[this.defaultLang] && this.texts[this.defaultLang][key]) {
            text = this.texts[this.defaultLang][key];
        }
        let params = Array.prototype.slice.call(arguments);
        params[0] = text;
        return this.formatText.apply(this, params);
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
    }
    
    getLang(lang: string): string {
        return this.isValidLang(lang) ? lang : this.currentLang;
    }
    
    reconfigureMoment(): void {
        moment.updateLocale(this.currentLang, {calendar: {
            sameDay: 'HH:mm',
            lastDay: "[" + this.i18n("core.date.yesterday") + "]",
            lastWeek: 'dddd',
            sameElse: function(this: moment.Moment) {
                return "[" + this.fromNow() + "]";
            }
        }});
    }
    
    timeAgo(date: Date|number): string {
        return moment(date).fromNow();
    }
    
    calendarDate(date: Date|number): string {
        return moment(date).calendar();
    }
    
    longDate(date: Date|number): string {
        return moment(date).format("llll Z");
    }
}

