import localforage = require("localforage");
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.utils.WebStorage");
import * as Q from "q";

function ObjectAssign(target: any, ...args: any[]): any {
    if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
    }
    var to = Object(target);
    for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
        if (nextSource != null) {
            for (var nextKey in nextSource) {
                if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                    to[nextKey] = nextSource[nextKey];
                }
            }
        }
    }
    return to;
};

function ensureForcedIndexedDBDriver() {
    var name = "forcedIndexedDB";
    return localforage.getDriver(name).catch(function() {
        return localforage.getDriver(localforage.INDEXEDDB).then(driver => {
            var newDriver = ObjectAssign({}, driver, {_driver: name});
            return localforage.defineDriver(newDriver)
        });
    });
}

export class WebStorage {
    
    lf: any;
    
    constructor() {
        ensureForcedIndexedDBDriver()
        .then(driver => {
            localforage.config({
                name: "privmx",
                driver: ["forcedIndexedDB", localforage.LOCALSTORAGE]
            });
        });
        this.lf = localforage;
    }
    
    getStorageType(): string {
        let name = localforage.driver();
        switch (name) {
            case "asyncStorage":
                return "IndexedDB";
            case "forcedIndexedDB":
                return "IndexedDB";
            case "localStorageWrapper":
                return "LocalStorage";
            case "webSQLStorage":
                return "WebSQL";
        }
    }
    
    getItem(key: string): Q.Promise<string> {
        return Q(1).then(() => {
            Logger.debug("getItem", key);
            return localforage.getItem(key);
        });
    }
    
    setItem(key: string, value: string): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("setItem", key, value);
            return localforage.setItem(key, value);
        })
        .then(() => {});
    }
    
    removeItem(key: string): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("removeItem", key);
            return localforage.removeItem(key);
        });
    }
    
    clear(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("clear");
            return localforage.clear();
        });
    }
    
    length():  Q.Promise<number> {
        return Q().then(() => {
            Logger.debug("length");
            return localforage.length();
        });
    }
    
    key(keyIndex: number):  Q.Promise<string> {
        return Q().then(() => {
            Logger.debug("key");
            return localforage.key(keyIndex);
        });
    }
    
    keys(): Q.Promise<string[]> {
        return Q().then(() => {
            Logger.debug("keys");
            return localforage.keys();
        });
    }
    
    iterate(iteratorCallback: (key: string, value: string) => void): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("iterate");
            return localforage.iterate(iteratorCallback);
        });
    }
}
