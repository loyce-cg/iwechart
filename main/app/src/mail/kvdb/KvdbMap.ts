import { KvdbCollection } from "./KvdbCollection";
import * as privfs from "privfs-client";
import * as Q from "q";
import { utils } from "../../Types";

export interface KvdbEntry<T> extends privfs.types.db.KvdbEntry {
    secured: {
        key?: string;
        value: T;
    }
}

export class KvdbMap<T> implements utils.IKvdbMap<T> {
    
    dbId: string;
    extKey: privfs.crypto.ecc.ExtKey;
    newlyCreated: boolean;
    
    constructor(
        public kvdb: KvdbCollection<KvdbEntry<T>>
    ) {
    }
    
    has(key: string): boolean {
        return this.get(key) != null;
    }
    
    get(key: string): T {
        let entry = this.kvdb.getSync(key);
        return entry && entry.secured ? entry.secured.value : null;
    }
    
    getEntries(_copy?: boolean) {
        let map: {[key: string]: T} = {};
        this.kvdb.collection.forEach(x => {
            if (x.secured && x.secured.value) {
                map[x.secured.key] = x.secured.value;
            }
        });
        return map;
    }
    
    getValues() {
        let res: T[] = [];
        this.kvdb.collection.forEach(x => {
            if (x.secured && x.secured.value) {
                res.push(x.secured.value);
            }
        });
        return res;
    }
    
    set(key: string, value: T): Q.Promise<void> {
        return this.kvdb.set(key, {secured: {value: value}}, false);
    }
    
    remove(key: string): Q.Promise<void> {
        return this.kvdb.set(key, {secured: {value: null}}, false);
    }
    
    setWithLock(key: string, func: (content: T|false) => Q.IWhenable<T>): Q.Promise<void> {
        return this.kvdb.withLock(key, entry => {
            let oldValue: false|T = entry == false || !entry || !entry.secured ? false : entry.secured.value;
            return Q().then(() => func(oldValue)).then(value => {
                if (!value) {
                    return;
                }
                return {secured: {value: value}};
            });
        });
    }
    
    setMany(map: {[key: string]: T}) {
        let promises: Q.Promise<void>[] = [];
        for (let key in map) {
            promises.push(this.set(key, map[key]));
        }
        return Q.all(promises).thenResolve(true);
    }
    
    removeMany(keys: string[]): Q.Promise<void> {
        return Q.all(keys.map(x => this.remove(x))).thenResolve(null);
    }
    
    forEach(func: (key: string, value: T) => void) {
        this.kvdb.collection.forEach(x => {
            if (x.secured && x.secured.value) {
                func(x.secured.key, x.secured.value);
            }
        });
    }
}

Object.defineProperty(KvdbMap.prototype, "dbId", {
    get: function(this: KvdbMap<any>): string {
        return this.kvdb.dbId;
    },
    enumerable: true
});

Object.defineProperty(KvdbMap.prototype, "extKey", {
    get: function(this: KvdbMap<any>): privfs.crypto.ecc.ExtKey {
        return this.kvdb.extKey;
    },
    enumerable: true
});

Object.defineProperty(KvdbMap.prototype, "newlyCreated", {
    get: function(this: KvdbMap<any>): boolean {
        return this.kvdb.newlyCreated;
    },
    enumerable: true
});