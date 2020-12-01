import {utils} from "../Types";
import * as Q from "q";

export class InMemoryStorage implements utils.IStorage {
    
    map: {[key: string]: any}
    
    constructor() {
        this.map = {};
    }
    
    get<T = any>(key: string): Q.Promise<T> {
        return Q(this.map[key]);
    }
    
    set<T = any>(key: string, item: T): Q.Promise<void> {
        return Q().then(() => {
            this.map[key] = item;
        });
    }
    
    remove(key: string): Q.Promise<void> {
        return Q().then(() => {
            delete this.map[key];
        });
    }
    
    getItem(key: string): Q.IWhenable<any> {
        return this.map[key];
    }
    
    setItem(key: string, value: any): Q.IWhenable<void> {
        this.map[key] = value;
    }
    
    removeItem(key: string): Q.IWhenable<void> {
        delete this.map[key];
    }
    
    getStorageType(): string {
        return "inmemory";
    }
    
    length(): Q.IWhenable<number> {
        return Object.keys(this.map).length;
    }
    
    iterate(func: (key: string, value: any) => void): Q.IWhenable<void> {
        for (let key in this.map) {
            func(key, this.map[key]);
        }
    }
    
    clear(): Q.IWhenable<void> {
        this.map = {};
    }
}