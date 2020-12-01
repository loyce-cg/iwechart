import {MutableCollection} from "../../utils/collection/MutableCollection";
import {Utils} from "../../utils/Utils";
import {utils} from "../../Types";
import * as privfs from "privfs-client";
import * as Q from "q";

export class KvdbCollection<T extends privfs.types.db.KvdbEntry> implements utils.IKeyValueDb<T> {
    
    dbId: string;
    extKey: privfs.crypto.ecc.ExtKey;
    newlyCreated: boolean;
    collection: MutableCollection<T>;
    seq: number;
    afterUpdate: (oldEntry: T, newEntry: T) => void;
    
    constructor(
        public kvdb: privfs.db.KeyValueDb<T>
    ) {
        this.seq = 0;
        this.collection = new MutableCollection<T>();
    }
    
    static createAndInit<T>(kvdb: privfs.db.KeyValueDb<T>) {
        let res = new KvdbCollection(kvdb);
        return res.refresh().thenResolve(res);
    }
    
    get(key: string): Q.Promise<T> {
        return Q(this.getSync(key));
    }
    
    opt(key: string, defaultValue: T): Q.Promise<T> {
        return Q(this.optSync(key, defaultValue));
    }
    
    hasSync(key: string): boolean {
        return this.getSync(key) != null;
    }
    
    getSync(key: string): T {
        return this.collection.find(x => x.secured && x.secured.key == key);
    }
    
    getSyncWithCheck(key: string): T {
        let res = this.getSync(key);
        if (res == null) {
            throw new Error("Cannot get entry with key '" + key + "'");
        }
        return res;
    }
    
    optSync(key: string, defaultValue: T): T {
        let res = this.getSync(key);
        return res ? res : defaultValue;
    }
    
    set(key: string, value: T, useVersion?: boolean) {
        return Q().then(() => {
            return this.kvdb.getEntryKey(key);
        })
        .then(entryKey => {
            return this.kvdb.set(key, value, useVersion).then(() => {
                (<any>value).__key = entryKey.toString("hex");
                let index = this.collection.indexOfBy(x => x.secured && x.secured.key == key);
                if (index == -1) {
                    this.collection.add(value);
                }
                else {
                    this.collection.setAt(index, value);
                }
            });
        });
    }
    
    withLock(key: string, func: (content: T|false, lockId: string, entryKey: Buffer) => Q.IWhenable<T>) {
        return Q().then(() => {
            return this.kvdb.getEntryKey(key);
        })
        .then(entryKey => {
            let value: T = null;
            return this.kvdb.withLock(key, (content, lockId, entryKey) => {
                return Q().then(() => func(content, lockId, entryKey)).then(x => {
                    value = x;
                    return x;
                });
            })
            .then(() => {
                if (!value) {
                    return;
                }
                (<any>value).__key = entryKey.toString("hex");
                let index = this.collection.indexOfBy(x => x.secured && x.secured.key == key);
                if (index == -1) {
                    this.collection.add(value);
                }
                else {
                    this.collection.setAt(index, value);
                }
            });
        });
    }
    
    refresh() {
        return Q().then(() => {
            return this.kvdb.getAll(this.seq);
        })
        .then(data => {
            this.processUpdate(data);
        });
    }
    
    processUpdate(data: privfs.types.db.KvdbFetchResult<T>) {
        try {
            this.collection.changeEvent.hold();
            this.seq = data.seq;
            for (let key in data.map) {
                let e = this.collection.find(x => (<any>x).__key == key);
                let old: T;
                if (e) {
                    old = JSON.parse(JSON.stringify(e));
                    Utils.assignObject(e, data.map[key]);
                    (<any>e).__key = key;
                    this.collection.updateElement(e);
                }
                else {
                    e = data.map[key];
                    (<any>e).__key = key;
                    this.collection.add(e);
                }
                if (this.afterUpdate) {
                    this.afterUpdate(old, e);
                }
            }
        }
        finally {
            this.collection.changeEvent.release();
        }
    }
}

Object.defineProperty(KvdbCollection.prototype, "dbId", {
    get: function(this: KvdbCollection<any>): string {
        return this.kvdb.dbId;
    },
    enumerable: true
});

Object.defineProperty(KvdbCollection.prototype, "extKey", {
    get: function(this: KvdbCollection<any>): privfs.crypto.ecc.ExtKey {
        return this.kvdb.extKey;
    },
    enumerable: true
});

Object.defineProperty(KvdbCollection.prototype, "newlyCreated", {
    get: function(this: KvdbCollection<any>): boolean {
        return this.kvdb.newlyCreated;
    },
    enumerable: true
});