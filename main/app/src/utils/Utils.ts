import { Lang } from "./Lang";

export class Utils {
    
    static randomPassword(length: number) {
        let characters = []; //["!", "#", "$", "%", "?"];
        for (let i = 48; i <= 57; i++) {
            characters.push(String.fromCharCode(i));
        }
        for (let i = 65; i <= 90; i++) {
            characters.push(String.fromCharCode(i));
        }
        for (let i = 97; i <= 122; i++) {
            characters.push(String.fromCharCode(i));
        }
        let password = "";
        for (let i = 0; i < length; i++) {
            password += characters[Math.floor(Math.random() * characters.length)];
        }
        return password;
    }
    
    static randomTemporaryPassword(nCharacters: number) {
        let characters = []; //["!", "#", "$", "%", "?"];
        for (let i = 48; i <= 57; i++) {
            characters.push(String.fromCharCode(i));
        }
        let password = "";
        for (let i = 0; i < nCharacters; i++) {
            password += characters[Math.floor(Math.random() * characters.length)];
        }
        return nCharacters < 6 ? password : password.replace(/\B(?=(\d{3})+(?!\d))/g, "-");
    }
    
    static assignObject<T>(dest: T, src: T): void {
        for (let key in dest) {
            delete dest[key];
        }
        for (let key in src) {
            dest[key] = src[key];
        }
    }
    
    static getStringUtf8Length(str: string): number {
        let s = str.length;
        for (let i = str.length - 1; i >= 0; i--) {
            let code = str.charCodeAt(i);
            if (code > 0x7f && code <= 0x7ff) {
                s++;
            }
            else if (code > 0x7ff && code <= 0xffff) {
                s += 2;
                if (code >= 0xDC00 && code <= 0xDFFF) {
                    i--;
                }
            }
        }
        return s;
    }
    
    static safePathName(str: string): string {
        return str.replace(/[^a-z0-9]/gi, "_");
    }
    
    static makeMultiComparatorSorter<T>(...comparators: ((a: T, b: T) => number)[]): (a: T, b: T) => number {
        return (a: T, b: T): number => {
            let res = 0;
            for (let i = 0; i < comparators.length && res == 0; ++i) {
                res = comparators[i](a, b);
            }
            return res;
        };
    }
    
    static arraysEqual<T>(arr0: T[], arr1: T[]): boolean {
        return Lang.arraysEqual(arr0, arr1);
    }
}

export class MultiProvider<I, T, P> {
    
    providers: P[];
    
    constructor(public getter: (provider: P, id: I) => T) {
        this.providers = [];
    }
    
    addProvider(provider: P): void {
        this.providers.push(provider);
    }
    
    getValue(id: I): T {
        for (let i = 0; i < this.providers.length; i++) {
            let value = this.getter(this.providers[i], id);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

}
export class Debouncer {
    private idsMap: {[id: string]: NodeJS.Timeout} = {};
    debounceById(func: (...args: any[]) => any, id: string, timeout: number) {
        if (id in this.idsMap) {
            clearTimeout(this.idsMap[id]);
            delete this.idsMap[id];
        }
        this.idsMap[id] = setTimeout(func, timeout);
    }
}