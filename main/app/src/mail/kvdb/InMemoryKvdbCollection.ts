import * as privfs from "privfs-client";
import {utils} from "../../Types";
import {MutableCollection} from "../../utils/collection/MutableCollection";
import * as Q from "q";

export class InMemoryKvdbCollection<T extends privfs.types.db.KvdbEntry> implements utils.IKeyValueDbCollection<T> {
    
    collection: MutableCollection<T>;
    
    constructor(
        public dbId: string,
        public extKey: privfs.crypto.ecc.ExtKey,
        public newlyCreated: boolean
    ) {
        this.collection = new MutableCollection();
    }
    
    get(key: string): Q.Promise<T> {
        return Q(this.getSync(key));
    }
    
    getSync(key: string): T {
        return this.collection.find(x => x.secured && x.secured.key == key);
    }
    
    opt(key: string, defaultValue: T): Q.Promise<T> {
        return Q(this.optSync(key, defaultValue));
    }
    
    optSync(key: string, defaultValue: T): T {
        let res = this.getSync(key);
        return res ? res : defaultValue;
    }
    
    hasSync(key: string): boolean {
        return this.getSync(key) != null;
    }
    
    set(key: string, value: T): Q.Promise<void> {
        return Q().then(() => {
            let index = this.collection.indexOfBy(x => x.secured && x.secured.key == key);
            if (index == -1) {
                this.collection.add(value);
            }
            else {
                this.collection.setAt(index, value);
            }
        });
    }
    
    withLock(key: string, func: (content: T|false, lockId: string, entryKey: Buffer) => Q.IWhenable<T>): Q.Promise<void> {
        return Q().then(() => {
            let content = this.getSync(key);
            return func(content ? content : false, "", null);
        })
        .then(value => {
            if (!value) {
                return;
            }
            let index = this.collection.indexOfBy(x => x.secured && x.secured.key == key);
            if (index == -1) {
                this.collection.add(value);
            }
            else {
                this.collection.setAt(index, value);
            }
        });
    }
}