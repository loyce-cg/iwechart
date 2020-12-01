import * as privfs from "privfs-client";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import {KvdbCollection} from "./KvdbCollection";
import {utils} from "../../Types";
import { KvdbMap, KvdbEntry } from "./KvdbMap";
let Logger = RootLogger.get("crm-plugin.main.KvdbCollectionManager");

export class KvdbCollectionManager {
    
    map: {[dbId: string]: KvdbCollection<any>};
    collections: KvdbCollection<any>[];
    pollTimeout: any;
    polling: boolean;
    pollingEnabled: boolean;
    
    constructor(
        public manager: privfs.db.KeyValueDbManager,
        public kvdbPollInterval: utils.Option<number>
    ) {
        this.map = {};
        this.collections = [];
        this.pollingEnabled = true;
    }
    
    getByKvdb<T>(kvdb: privfs.db.KeyValueDb<T>): Q.Promise<KvdbCollection<T>> {
        if (kvdb.dbId in this.map) {
            return Q(this.map[kvdb.dbId]);
        }
        return Q().then(() => {
            return KvdbCollection.createAndInit(kvdb);
        })
        .then(x => {
            this.map[x.kvdb.dbId] = x;
            this.collections.push(x);
            return x;
        });
    }
    
    getOrCreateByIndex<T>(index: number, options: privfs.types.db.KeyValueDbOptions): Q.Promise<KvdbCollection<T>> {
        return Q().then(() => {
            return this.manager.client.deriveKey(index);
        })
        .then(extKey => {
            return this.getOrCreateByExtKey(extKey, options);
        });
    }
    
    getOrCreateByExtKey<T>(extKey: privfs.crypto.ecc.ExtKey, options: privfs.types.db.KeyValueDbOptions): Q.Promise<KvdbCollection<T>> {
        let dbId = privfs.db.KeyValueDb.getDbId(extKey);
        if (dbId in this.map) {
            return Q(this.map[dbId]);
        }
        return Q().then(() => {
            return this.manager.getOrCreateByExtKey<T>(extKey, options);
        })
        .then(kvdb => {
            return this.getByKvdb(kvdb);
        });
    }
    
    getByExtKey<T>(extKey: privfs.crypto.ecc.ExtKey): Q.Promise<KvdbCollection<T>> {
        let dbId = privfs.db.KeyValueDb.getDbId(extKey);
        if (dbId in this.map) {
            return Q(this.map[dbId]);
        }
        return Q().then(() => {
            return this.manager.getByExtKey<T>(extKey);
        })
        .then(kvdb => {
            return this.getByKvdb(kvdb);
        });
    }
    
    getOrCreateMapByIndex<T>(index: number, options: privfs.types.db.KeyValueDbOptions): Q.Promise<KvdbMap<T>> {
        return Q().then(() => {
            return this.getOrCreateByIndex<KvdbEntry<T>>(index, options);
        })
        .then(kvdb => {
            return new KvdbMap(kvdb);
        });
    }
    
    forcePoll() {
        clearTimeout(this.pollTimeout);
        this.pollTimeout = null;
        this.poll();
    }
    
    poll() {
        if (this.pollTimeout || this.polling || !this.pollingEnabled) {
            return;
        }
        this.polling = true;
        Q().then(() => {
            return this.collections.length == 0 ? <privfs.types.db.KeyValueDbPollResult<any>>{} : this.manager.pollCursors(this.collections);
        })
        .then(result => {
            for (let dbId in result) {
                let kvdbColl = this.map[dbId];
                if (!kvdbColl) {
                    continue;
                }
                kvdbColl.processUpdate(result[dbId]);
            }
        })
        .fail(e => {
            Logger.error("Error during polling Kvdb", e);
        })
        .finally(() => {
            this.polling = false;
            if (!this.pollingEnabled) {
                return;
            }
            this.pollTimeout = setTimeout(() => {
                this.pollTimeout = null;
                this.poll();
            }, this.kvdbPollInterval.value);
        });
    }
    
    stopPolling(): void {
        this.pollingEnabled = false;
        clearTimeout(this.pollTimeout);
        this.pollTimeout = null;
    }
    
    startPolling(): void {
        this.pollingEnabled = true;
        this.forcePoll();
    }
}