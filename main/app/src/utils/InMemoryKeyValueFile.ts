import * as Q from "q";
import * as Utils from "simplito-utils";

export class InMemoryKeyValueFile<T = any> {
    
    constructor(public map: {[key: string]: T}) {
    }
    
    init() {
        return Q(this);
    }
    
    save(_data: {[key: string]: T}): Q.Promise<void> {
        return Q();
    }
    
    hasKey(key: string): boolean {
        return key in this.map;
    }
    
    hasValue(value: T): boolean {
        for (var key in this.map) {
            if (this.map[key] == value) {
                return true;
            }
        }
        return false;
    }
    
    getValueByKey(key: string): T {
        return key in this.map ? this.map[key] : null;
    }
    
    getKeyByValue(value: T): string {
        for (var key in this.map) {
            if (this.map[key] == value) {
                return key;
            }
        }
        return null;
    }
    
    set(key: string, value: T): Q.Promise<void> {
        this.map = this.setAtCopy(key, value);
        return Q();
    }
    
    setAtCopy(key: string, value: T): {[key: string]: T} {
        let copy = Utils.simpleDeepClone(this.map);
        copy[key] = value;
        return copy;
    }
    
    remove(key: string): Q.Promise<void> {
        this.map = this.removeAtCopy(key);
        return Q();
    }
    
    removeAtCopy(key: string): {[key: string]: T} {
        let copy = Utils.simpleDeepClone(this.map);
        delete copy[key];
        return copy;
    }
    
    isEmpty(): boolean {
        return Object.keys(this.map).length === 0;
    }
    
    getAll(): {[key: string]: T} {
        return Utils.simpleDeepClone(this.map);
    }
    
    replaceData(data: {[key: string]: T}, _dontSave?: boolean): Q.Promise<any> {
        this.map = data;
        return Q();
    }
}
