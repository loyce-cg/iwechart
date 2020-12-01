import {window} from "./Window";

export class Settings {
    
    localStorageSupported: boolean;
    
    constructor() {
        try {
            this.localStorageSupported = window.localStorage != null;
        }
        catch (e) {
            this.localStorageSupported = false;
        }
    }
    
    getItem(key: string): string {
        return this.localStorageSupported ? window.localStorage.getItem(key) : null;
    }
    
    setItem(key: string, value: string): void {
        if (this.localStorageSupported) {
            window.localStorage.setItem(key, value);
        }
    }
}

