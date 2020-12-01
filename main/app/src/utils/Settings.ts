import {PromiseUtils} from "simplito-promise";
import {Event} from "./Event";
import {utils} from "../Types";

export interface SubRaw {
    defaultValue: any;
    subs?: {[name: string]: SubRaw};
}

export class Settings {
    
    name: string;
    defaultValue: any;
    storage: utils.IStorage;
    subSettings: {[name: string]: Settings};
    currentValue: any;
    setPromise: Q.Promise<void>;
    newValueToSet: boolean;
    changeEvent: Event<string, Settings, any>;
    
    constructor(name: string, defaultValue: any, storage: utils.IStorage, subs: {[name: string]: SubRaw}) {
        this.name = name;
        this.defaultValue = defaultValue;
        this.storage = storage;
        this.changeEvent = new Event();
        this.subSettings = {};
        if (subs) {
            for (let subName in subs) {
                let sub = subs[subName];
                this.subSettings[subName] = new Settings(this.name + "." + subName, sub.defaultValue, this.storage, sub.subs);
            }
        }
    }
    
    create(prefix: string): Settings {
        return this.subSettings[prefix];
    }
    
    init(): Q.Promise<void> {
        return this.storage.get(this.name)
        .then(value => {
            this.currentValue = value;
            return PromiseUtils.oneByOne(this.subSettings, (_i, sub) => {
                return sub.init();
            });
        });
    }
    
    setDefault(defaultValue: any): Settings {
        this.defaultValue = defaultValue;
        return this;
    }
    
    get(type?: string): any {
        if (this.currentValue == null) {
            return this.defaultValue;
        }
        if (typeof(type) == "undefined" || type == "string") {
            return this.currentValue;
        }
        if (type == "boolean") {
            return this.currentValue == "true";
        }
        if (type == "int") {
            return parseInt(this.currentValue);
        }
        if (type == "float") {
            return parseFloat(this.currentValue);
        }
        if (type == "object") {
            return JSON.parse(this.currentValue);
        }
        throw new Error("Invalid type");
    }
    
    set(value: any, caller?: any): Q.Promise<void> {
        if (!isNaN(value) || typeof(value) == "string") {
            this.currentValue = value.toString();
        }
        else if (typeof(value) == "object") {
            this.currentValue = JSON.stringify(value);
        }
        else {
            throw new Error("Invalid type");
        }
        if (this.setPromise == null) {
            this.setPromise = this.setCore();
        }
        else {
            this.newValueToSet = true;
        }
        this.changeEvent.trigger("set", this, caller);
        return this.setPromise;
    }
    
    setCore(): Q.Promise<void> {
        return this.storage.set(this.name, this.currentValue)
        .then(() => {
            if (this.newValueToSet) {
                this.newValueToSet = false;
                return this.setCore();
            }
            this.setPromise = null;
        });
    }
    
    objectGet(key: string): any {
        let object = this.get("object") || this.defaultValue;
        return object[key];
    }
    
    objectSet(key: string, value: any): Q.Promise<void> {
        let object = this.get("object") || {};
        object[key] = value;
        return this.set(object);
    }
}
