import * as Q from "q";
import {KvdbSettingEntry} from "./kvdb/KvdbUtils";
import {utils} from "../Types";
import {Lang} from "../utils/Lang";
import * as privfs from "privfs-client";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.KvdbSettingsStorage");

export abstract class BaseKvdbSettingsStorage<T> {
    
    queue: {id: string, value: T}[];
    running: boolean;
    scheduled: boolean;
    timeoutId: NodeJS.Timer;
    
    constructor(
        public kvdb: utils.IKeyValueDb<KvdbSettingEntry>
    ) {
        this.queue = [];
        this.running = false;
        this.scheduled = false;
    }
    
    abstract getEntryKey(id: string): string;
    
    abstract parseValue(value: string): T;
    
    abstract serializeValue(value: T): string;
    
    abstract mergeValues(a: T, b: T): T;
    
    getValue(id: string, defaultValue: T): Q.Promise<T> {
        return Q().then(() => {
            return this.kvdb.opt(this.getEntryKey(id), null);
        })
        .then(s => {
            return s && s.secured && s.secured.value ? this.parseValue(s.secured.value) : defaultValue;
        });
    }
    
    setValue(id: string, value: T): void {
        let entryIndex = Lang.indexOf(this.queue, x => x.id == id);
        if (entryIndex == -1) {
            this.queue.push({id: id, value: value});
        }
        else {
            this.queue[entryIndex] = {id: id, value: this.mergeValues(this.queue[entryIndex].value, value)};
        }
        this.kick();
    }
    
    kick(): void {
        if (this.running || this.scheduled || this.queue.length == 0) {
            return;
        }
        this.running = true;
        let ele = this.queue.shift();
        Q().then(() => {
            return this.save(ele.id, ele.value);
        })
        .fail(e => {
            if (privfs.core.ApiErrorCodes.is(e, "KVDB_ENTRY_LOCKED")) {
                this.scheduled = true;
                this.queue.push(ele);
                this.timeoutId = setTimeout(() => {
                    this.scheduled = false;
                    this.timeoutId = null;
                    this.kick();
                }, 10000);
            }
            else {
                Logger.error(e);
            }
        })
        .fin(() => {
            this.running = false;
            this.kick();
        });
    }
    
    save(id: string, value: T): Q.Promise<void> {
        return Q().then(() => {
            return this.kvdb.withLock(this.getEntryKey(id), (content) => {
                let entry = content || {secured: {value: null}};
                let oldSerializedValue = entry.secured && entry.secured.value ? entry.secured.value : null;
                if (oldSerializedValue) {
                    let oldValue = this.parseValue(oldSerializedValue);
                    let merged = this.mergeValues(oldValue, value);
                    let serialized = this.serializeValue(merged);
                    if (serialized != oldSerializedValue) {
                        entry.secured.value = serialized;
                        return entry;
                    }
                    return null;
                }
                entry.secured.value = this.serializeValue(value);
                return entry;
            });
        })
    }
    
    clear(): void {
        this.queue = [];
        clearTimeout(this.timeoutId);
        this.scheduled = false;
    }
}

export class KvdbSettingsStorage extends BaseKvdbSettingsStorage<number> {
    
    getEntryKey(id: string): string {
        return "sink-" + id + "-read-index";
    }

    parseValue(value: string): number {
        return parseInt(value);
    }

    serializeValue(value: number): string {
        return value.toString();
    }

    mergeValues(a: number, b: number): number {
        return Math.max(a, b);
    }
    
    getReadIndex(sinkId: string): Q.Promise<number> {
        return this.getValue(sinkId, 0);
    }
    
    setReadIndex(sinkId: string, index: number): void {
        return this.setValue(sinkId, index);
    }
}

export abstract class KvdbListSettingsStorage<T> extends BaseKvdbSettingsStorage<T[]> {
    
    constructor(
        kvdb: utils.IKeyValueDb<KvdbSettingEntry>,
        public namePrefix: string
    ) {
        super(kvdb);
    }
    
    getEntryKey(id: string): string {
        return this.namePrefix + "-" + id;
    }

    parseValue(value: string): T[] {
        return JSON.parse(value);
    }

    serializeValue(value: T[]): string {
        return JSON.stringify(value);
    }

    abstract mergeValues(a: T[], b: T[]): T[];
    
    getArray(id: string): Q.Promise<T[]> {
        return this.getValue(id, []);
    }
}