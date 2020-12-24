import * as Q from "q";
import { utils } from "../Types";

export class InMemoryKvdbMap<T> implements utils.IKvdbMap<T> {
    
    constructor(public map: {[key: string]: T}) {
    }
    
    has(key: string): boolean {
        return key in this.map;
    }
    
    get(key: string): T {
        return this.map[key];
    }
    
    getEntries(_copy: boolean): {[key: string]: T} {
        return {...this.map};
    }
    
    getValues(): T[] {
        return Object.values(this.map);
    }
    
    set(key: string, value: T): Q.Promise<void> {
        return Q().then(() => {
            this.map[key] = value;
        });
    }
    
    remove(key: string): Q.Promise<void> {
        return Q().then(() => {
            delete this.map[key];
        });
    }
    
    setMany(map: {[key: string]: T}): Q.Promise<boolean> {
        return Q().then(() => {
            for (const key in map) {
                this.map[key] = map[key];
            }
            return true;
        });
    }
    
    removeMany(keys: string[]): Q.Promise<void> {
        return Q().then(() => {
            for (const key of keys) {
                delete this.map[key];
            }
        });
    }
    
    forEach(func: (key: string, value: T) => void): void {
        for (const key in this.map) {
            func(key, this.map[key]);
        }
    }
}
