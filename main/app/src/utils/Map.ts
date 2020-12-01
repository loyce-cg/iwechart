export class Map<T> {
    
    map: {[key: string]: T};
    
    constructor() {
        this.map = {};
    }
    
    put(key: string, entry: T): void {
        this.map[key] = entry;
    }
    
    get(key: string): T {
        return this.map[key];
    }
    
    has(key: string): boolean {
        return key in this.map;
    }
    
    forEach(func: (value: T, key: string) => void): void {
        for (let key in this.map) {
            func(this.map[key], key);
        }
    }
    
    find(func: (key: string, value: T) => boolean): T {
        for (let key in this.map) {
            let value = this.map[key];
            if (func(key, value)) {
                return value;
            }
        }
        return null;
    }
    
    getEnumerable(): {[key: string]: T} {
        return this.map;
    }
    
    getKeys(): string[] {
        let keys: string[] = [];
        for (let key in this.map) {
            keys.push(key);
        }
        return keys;
    }
    
    getValues(): T[] {
        let values: T[] = [];
        for (let key in this.map) {
            values.push(this.map[key]);
        }
        return values;
    }
    
    each(func: (key: string, value: T) => void): void {
        for (let key in this.map) {
            func(key, this.map[key]);
        }
    }
    
    clear(): void {
        this.map = {};
    }
    
    remove(key: string) {
        delete this.map[key];
    }
}

