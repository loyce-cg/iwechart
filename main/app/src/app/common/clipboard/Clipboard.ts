import { CommonApplication } from "../CommonApplication";
import { SystemClipboardIntegration } from "../../../mail/UserPreferences";

export type ClipboardData = {[format: string]: any};
export type ClipboardElement = {
    data: ClipboardData;
    source: "system" | "privmx";
    addedAt: Date;
    modifiedAt: Date;
};

export class Clipboard {
    
    static CHANGE_EVENT: string = "clipboard-changed";
    
    static FORMAT_TEXT: string = "text";
    static FORMAT_HTML: string = "html";
    static FORMAT_SYSTEM_FILES: string = "__system_files__";
    static FORMAT_PRIVMX_FILE: string = "file";
    static FORMAT_PRIVMX_FILES: string = "files";
    static FORMAT_PRIVMX_DIRECTORY: string = "directory";
    static FORMAT_PRIVMX_DIRECTORIES: string = "directories";
    static FORMAT_PRIVMX_TASKS: string = "__privmx_tasks__";
    
    static CLIPBOARD_CHECK_INTRVAL: number = 1000;
    static CLIPBOARD_MAX_SIZE = 100;
    static CLIPBOARD_CLEANUP_INTRVAL: number = 5 * 60 * 1000;
    static LOGGED_OUT_CLIPBOARD_INTEGRATION_ENABLED: boolean = true;
    storedElements: ClipboardElement[] = [];
    // protected systemIntegration: boolean = true;
    
    constructor(public app: CommonApplication) {
        setInterval(() => {
            this.populateFromSystem();
        }, Clipboard.CLIPBOARD_CHECK_INTRVAL);
        setInterval(() => {
            this.cleanup();
        }, Clipboard.CLIPBOARD_CLEANUP_INTRVAL);
    }
    
    validateClipboard(data: ClipboardData) {
        let keys = Object.keys(data);
        if ("text" in data && keys.length == 1 && data["text"] == "") {
            return false;
        }
        return true;
    }
    
    populateFromSystem(): void {
        // if (!this.isSystemIntegrationEnabled()) {
        //     return;
        // }
        let systemData = this.app.getSystemCliboardData(true);
        if (this.systemClipboardDiffers(systemData)) {
            if (this.validateClipboard(systemData)) {
                let now = new Date();
                this.storedElements.push({
                    data: systemData,
                    source: "system",
                    addedAt: now,
                    modifiedAt: now,
                });
                this.log("populateFromSystem()");
                this.debug();
                this.dispachChangeEvent("get");
            }
        }
    }
    
    // enableSystemIntegration(): void {
    //     this.toggleSystemIntegration(true);
    // }
    
    // disableSystemIntegration(): void {
    //     this.toggleSystemIntegration(false);
    // }
    
    isSystemIntegrationEnabled(): boolean {
        // return this.systemIntegration;
        if (!this.app.userPreferences || !this.app.isLogged()) {
            return Clipboard.LOGGED_OUT_CLIPBOARD_INTEGRATION_ENABLED;
        }
        return this.app.userPreferences.getSystemClipboardIntegration() == SystemClipboardIntegration.ENABLED;
    }
    
    // toggleSystemIntegration(enabled: boolean): void {
    //     this.systemIntegration = enabled;
    //     let mostRecentSystemElement = this.findMatchingElement(null, "system");
    //     if (mostRecentSystemElement) {
    //         this.storedElements = this.storedElements.filter(x => this.elementMatches(x, null, "privmx") || x == mostRecentSystemElement);
    //     }
    // }
    
    elementMatches(element: ClipboardElement, format: string = null, source: "system"|"privmx"|"any"|"auto" = "auto"): boolean {
        if (source == "auto") {
            // source = this.isSystemIntegrationEnabled() ? "any" : "privmx";
            source = "any";
        }
        if (source != "any" && element.source != source) {
            return false;
        }
        return format === null ? true : (format in element.data);
    }
    
    findMatchingElement(format: string = null, source: "system"|"privmx"|"any"|"auto" = "auto"): ClipboardElement {
        for (let i = this.storedElements.length - 1; i >= 0; --i) {
            if (this.elementMatches(this.storedElements[i], format, source))  {
                return this.storedElements[i];
            }
        }
        return null;
    }
    
    findMatchingElements(format: string = null, source: "system"|"privmx"|"auto"|"any" = "auto"): ClipboardElement[] {
        let elements: ClipboardElement[] = [];
        for (let i = this.storedElements.length - 1; i >= 0; --i) {
            if (this.elementMatches(this.storedElements[i], format, source))  {
                elements.push(this.storedElements[i]);
            }
        }
        return elements;
    }
    
    hasMatchingElements(format: string = null, source: "system"|"privmx"|"auto"|"any" = "auto"): boolean {
        for (let i = this.storedElements.length - 1; i >= 0; --i) {
            if (this.elementMatches(this.storedElements[i], format, source))  {
                return true;
            }
        }
        return false;
    }
    
    countMatchingElements(format: string = null, source: "system"|"privmx"|"auto"|"any" = "auto"): number {
        let count: number = 0;
        for (let i = this.storedElements.length - 1; i >= 0; --i) {
            if (this.elementMatches(this.storedElements[i], format, source))  {
                ++count;
            }
        }
        return count;
    }
    
    cleanup(): void {
        let currentSize = this.storedElements.length;
        let maxSize = Clipboard.CLIPBOARD_MAX_SIZE;
        if (currentSize > maxSize) {
            let mostRecentSystemElement = this.findMatchingElement(null, "system");
            this.storedElements = this.storedElements.slice(-maxSize);
            if (mostRecentSystemElement && this.findMatchingElement(null, "system") != mostRecentSystemElement) {
                this.storedElements.splice(0, 0, mostRecentSystemElement);
            }
            this.dispachChangeEvent("cleanup");
        }
    }
    
    get(format: string = null, source: "system"|"privmx"|"any"|"auto" = "auto"): ClipboardData {
        this.populateFromSystem();
        this.log("get()");
        this.debug();
        
        let element = this.findMatchingElement(format, source);
        return element ? element.data : {};
    }
    
    getFormat<T = any>(format: string, source: "system"|"privmx"|"any"|"auto" = "auto"): T {
        let data = this.get(format, source);
        return data ? data[format] : null;
    }
    
    set(element: ClipboardData, addedAt: Date = null, source: "system"|"privmx" = "privmx"): void {
        // if (source == "system" && !this.isSystemIntegrationEnabled()) {
        //     return;
        // }
        if (!addedAt) {
            addedAt = new Date();
        }
        this.storedElements.push({
            data: element,
            source: source,
            addedAt: addedAt,
            modifiedAt: addedAt,
        });
        this.log("set()");
        this.debug();
        if (this.isSystemIntegrationEnabled()) {
            this.app.setSystemCliboardData(element);
        }
        this.dispachChangeEvent("set");
    }
    
    add(element: ClipboardData, addedAt: Date, source: "system"|"privmx" = "privmx"): void {
        this.set(element, addedAt, source);
    }
    
    update(element: ClipboardElement, newData: ClipboardData): void {
        for (let i = this.storedElements.length - 1; i >= 0; --i) {
            if (this.storedElements[i].addedAt == element.addedAt) {
                this.storedElements[i].data = newData;
                this.storedElements[i].modifiedAt = new Date();
            }
        }
    }
    
    hasFormat(format: string): boolean {
        return this.hasMatchingElements(format);
    }
    
    hasOneOfFormats(formats: string[]): boolean {
        for (let format of formats) {
            if (this.hasMatchingElements(format)) {
                return true;
            }
        }
        return false;
    }
    
    hasElement(): boolean {
        return this.getAvailableFormats().length > 0;
    }
    
    getAvailableFormats(): string[] {
        let formats: { [key: string]: boolean } = {};
        for (let i = this.storedElements.length - 1; i >= 0; --i) {
            for (let key of Object.keys(this.storedElements[i])) {
                formats[key] = true;
            }
        }
        return Object.keys(formats);
    }
    
    systemClipboardDiffers(systemData: ClipboardData): boolean {
        if (!systemData) {
            return false;
        }
        let mostRecentSystemElement = this.findMatchingElement(null, "system");
        if (!mostRecentSystemElement) {
            return true;
        }
        if (mostRecentSystemElement) {
            for (let format in systemData) {
                if (mostRecentSystemElement.data[format] != systemData[format]) {
                    return true;
                }
            }
            for (let format in mostRecentSystemElement) {
                if (mostRecentSystemElement.data[format] != systemData[format]) {
                    return true;
                }
            }
        }
        return false;
    }
    
    mostRecentIsSystem(): boolean {
        return this.storedElements.length > 0 && this.storedElements[this.storedElements.length - 1] && this.storedElements[this.storedElements.length - 1].source == "system";
    }
    
    clear() {
        this.storedElements = [];
        this.dispachChangeEvent("clear");
    }
    
    dispachChangeEvent(from: string) {
        this.app.dispatchEvent({type: Clipboard.CHANGE_EVENT});
    }
    
    log(...args: any[]): void {
        return;
        console.log(...args);
    }
    
    debug(): void {
        this.log(`Clipboard.length = ${this.storedElements.length}`);
        let lim = 10;
        for (let i = this.storedElements.length - 1; i >= 0; --i) {
            if (lim-- <= 0) {
                break;
            }
            let e = this.storedElements[i];
            this.log(`    [${i}] ${e.source == "privmx" ? "pmx" : "sys"}:`);
            for (let k in e.data) {
                let v = String(e.data[k]).substr(0, 100);
                this.log(`        ${k} = ${v}`);
            }
        }
    }
    
}
