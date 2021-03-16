import * as Q from "q";
import {MutableCollection} from "../utils/collection/MutableCollection";
import {FilteredCollection} from "../utils/collection/FilteredCollection";
import {Event} from "../utils/Event";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.SinkIndex");
import * as privfs from "privfs-client";
import * as Utils from "simplito-utils";
import {SinkIndexManager} from "./SinkIndexManager";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {PromiseUtils} from "simplito-promise";
import {Flags, SerializedEntry, MessageModification} from "./UpdatesQueue";
import {KvdbSettingsStorage} from "./KvdbSettingsStorage";
import { Lang } from "../utils/Lang";

export enum BaseEntryMode {
    NOT_LOADED,
    DELETED
}

export type SinkIndexEntryInfo = SinkIndexEntryInfoNotLoaded|SinkIndexEntryInfoDeleted;

export interface SinkIndexEntryInfoNotLoaded {
    id: number;
    mode: BaseEntryMode.NOT_LOADED;
    canBeInCache: boolean;
    ignoreDeleted?: boolean;
}

export interface SinkIndexEntryInfoDeleted {
    id: number;
    mode: BaseEntryMode.DELETED;
}

export interface PollingItem {
    entry: SinkIndexEntry,
    newStickers: privfs.types.core.Sticker[];
}

export type BaseEntry = SinkIndexEntry|SinkIndexEntryInfo;

export class SinkIndex {
    
    sink: privfs.message.MessageSinkPriv;
    sinkIndexManager: SinkIndexManager;
    storageKey: string;
    baseEntries: MutableCollection<BaseEntry>;
    entries: FilteredCollection<SinkIndexEntry>;
    cursor: privfs.message.MessageSinkCursor;
    changeEvent: Event<string, SinkIndex, SinkIndexEntry>;
    needUpdate: boolean;
    useStorage: boolean;
    sendModificationToServer: boolean;
    onBeforeAddEntry: (entry: SinkIndexEntry) => void;
    useReadIndex: boolean;
    settingsStorage: KvdbSettingsStorage;
    readIndex: number;
    autoMarkMyMessagesAsRead: boolean;
    autoCorrectTags: boolean;
    includeStatsToCombined: () => boolean = () => true;
    loadAllEntriesFromCache: boolean = true;
    
    constructor(sink: privfs.message.MessageSinkPriv, sinkIndexManager: SinkIndexManager) {
        this.sink = sink;
        this.sinkIndexManager = sinkIndexManager;
        this.useStorage = true;
        this.autoCorrectTags = true;
        this.sendModificationToServer = true;
        this.storageKey = "idx-" + this.sink.id;
        this.baseEntries = new MutableCollection();
        this.entries = new FilteredCollection(<any>this.baseEntries, x => x instanceof SinkIndexEntry);
        this.cursor = new privfs.message.MessageSinkCursor(this.sink, 0, 0);
        this.changeEvent = new Event<string, SinkIndex, SinkIndexEntry>();
    }
    
    load(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("load sink index", this.storageKey);
            return this.settingsStorage ? this.settingsStorage.getReadIndex(this.sink.id) : null;
        })
        .then(readIndex => {
            this.readIndex = readIndex;
            return this.useStorage ? this.sinkIndexManager.storage.get(this.storageKey) : {seq: 0, modSeq: 0, version: 1};
        })
        .then(value => {
            this.cursor.seq = value == null ? 0 : value.seq;
            this.cursor.modSeq = value == null ? 0 : value.modSeq;
            if (value == null || !("version" in value)) {
                return this.matchMissingAsDeleted();
            }
        })
        .then(() => {
            return this.loadEntries();
        });
    }
    
    matchMissingAsDeleted(): Q.Promise<void> {
        return Q().then(() => {
            let tasks: Q.Promise<any>[] = [];
            for (let i = 1; i <= this.cursor.seq; i++) {
                let task = this.sinkIndexManager.storage.get(this.getEntryStorageKeyById(i));
                tasks.push(task);
            }
            return Q.all(tasks);
        })
        .then(values => {
            let tasks: Q.Promise<any>[] = [];
            values.forEach((x, i) => {
                if (x == null) {
                    tasks.push(this.saveInStorage({id: i + 1, mode: BaseEntryMode.DELETED}));
                }
            })
            return Q.all(tasks).then(() => null);
        });
    }
    
    loadEntries(): Q.Promise<void> {
        if (!this.useStorage) {
            return Q();
        }
        if (!this.loadAllEntriesFromCache) {
            return Q().then(() => {
                let entries: BaseEntry[] = [];
                for (let i = 1; i <= this.cursor.seq; i++) {
                    entries.push({id: i, mode: BaseEntryMode.NOT_LOADED, canBeInCache: true});
                }
                this.baseEntries.clear();
                this.baseEntries.addAll(entries);
                this.changeEvent.trigger("load", this);
            });
        }
        return Q().then(() => {
            let entries: BaseEntry[] = [];
            let tasks: Q.Promise<any>[] = [];
            for (let i = 1; i <= this.cursor.seq; i++) {
                let task = this.sinkIndexManager.storage.get(this.getEntryStorageKeyById(i));
                tasks.push(task);
            }
            return Q.all(tasks)
            .then(values => {
                values.forEach((value, i) => {
                    if (value) {
                        if (value.mode) {
                            entries.push(value);
                        }
                        else {
                            let entry = SinkIndexEntry.create(value, this);
                            
                            // Nie usuwać !! - optymalizacja parsowania wiadomosci od razu przy pobieraniu
                            // entry.getContentAsJson() ma zaimplementowany cache, wiec mozna go wywolac wczesniej
                            if (entry.source.data.contentType == "application/json") {
                                entry.getContentAsJson();
                            }
                            entries.push(entry);
                        }
                    }
                    else {
                        entries.push({id: i + 1, mode: BaseEntryMode.NOT_LOADED, canBeInCache: false});
                    }
                });
            })
            .then(() => {
                this.baseEntries.clear();
                this.baseEntries.addAll(entries);
                this.changeEvent.trigger("load", this);
            });
        });
    }
    
    loadFromCache(ent: SinkIndexEntryInfoNotLoaded[]) {
        if (!this.useStorage || ent.length == 0) {
            return Q();
        }
        return Q().then(() => {
            let tasks: Q.Promise<any>[] = [];
            ent.forEach(e => {
                let task = this.sinkIndexManager.storage.get(this.getEntryStorageKeyById(e.id));
                tasks.push(task);
            });
            return Q.all(tasks);
        })
        .then(values => {
            values.forEach((value, i) => {
                let e = ent[i];
                if (!value) {
                    e.canBeInCache = false;
                    return;
                }
                if (value.mode) {
                    if (e.ignoreDeleted) {
                        e.canBeInCache = false;
                    }
                    else {
                        this.baseEntries.replaceElement(e, value);
                    }
                }
                else {
                    let entry = SinkIndexEntry.create(value, this);
                    
                    // Nie usuwać !! - optymalizacja parsowania wiadomosci od razu przy pobieraniu
                    // entry.getContentAsJson() ma zaimplementowany cache, wiec mozna go wywolac wczesniej
                    if (entry.source.data.contentType == "application/json") {
                        entry.getContentAsJson();
                    }
                    this.baseEntries.replaceElement(e, entry);
                }
            });
        });
    }
    
    loadLastMessages(count?: number): Q.Promise<void> {
        return Q().then(() => {
            let toLoadFromCache: SinkIndexEntryInfoNotLoaded[] = [];
            let lastMessagesCount = 0;
            for (let i = this.baseEntries.list.length - 1; i >= 0; i--) {
                let e = <SinkIndexEntryInfoNotLoaded>this.baseEntries.list[i];
                if (e.mode == BaseEntryMode.NOT_LOADED) {
                    if (e.canBeInCache) {
                        toLoadFromCache.push(e);
                    }
                    lastMessagesCount++;
                }
                else if (e instanceof SinkIndexEntry) {
                    lastMessagesCount++;
                }
                if (count && lastMessagesCount >= count) {
                    break;
                }
            }
            return this.loadFromCache(toLoadFromCache);
        })
        .then(() => {
            let mids: number[] = [];
            let lastMessagesCount = 0;
            for (let i = this.baseEntries.list.length - 1; i >= 0; i--) {
                if ((<SinkIndexEntryInfo>this.baseEntries.list[i]).mode == BaseEntryMode.NOT_LOADED) {
                    mids.push(this.baseEntries.list[i].id);
                    lastMessagesCount++;
                }
                else if (this.baseEntries.list[i] instanceof SinkIndexEntry) {
                    lastMessagesCount++;
                }
                if (count && lastMessagesCount >= count) {
                    break;
                }
            }
            mids.reverse();
            return this.loadMessages(mids, false);
        });
    }
    
    loadMessages(mids: number[], filterLoaded: boolean = true): Q.Promise<void> {
        if (filterLoaded) {
            mids = mids.filter(x => this.getEntry(x) == null);
        }
        if (mids.length == 0) {
            return Q();
        }
        return Q().then(() => {
            this.holdChangeEvent();
            return mids.length > 0 ? this.sinkIndexManager.messageManager.messageGet(this.sink, mids, "DATA_AND_META", false) : [];
        })
        .then((messages: privfs.types.message.MessageEntryParsed[]) => {
            return PromiseUtils.oneByOne(messages, (_, m) => {
                if ((<any>m).metaError || (<any>m).dataError) {
                    Logger.warn("Cannot process message from messageGet, error during decoding.", this, m);
                    return;
                }
                else {
                    let entry = new SinkIndexEntry(m.data.source, m.meta.data, m.meta.tags, [], m.meta.stickers, this);
                    this.baseEntries.setAt(entry.id - 1, entry);
                    return this.saveInStorage(entry);
                }
            })
        })
        .fin(() => {
            this.releaseChangeEvent();
        });
    }
    
    synchronizeUsingSinkInfo(): Q.Promise<void> {
        let info: privfs.types.message.SinkInfo&{mods: {mid: number, modSeq: number}[]};
        return Q().then(() => {
            this.holdChangeEvent();
            return this.sinkIndexManager.messageManager.storage.request("sinkInfoAndMods", {sid: this.sink.id, addMidList: true, seq: this.cursor.seq, modSeq: this.cursor.modSeq});
        })
        .then(i => {
            info = i;
            const promises: Q.Promise<void>[] = [];
            let midsIndex = 0;
            for (let i = 1; i <= info.seq; i++) {
                const messageExists = i == info.mids[midsIndex];
                if (messageExists) {
                    midsIndex++;
                    this.markThatMessageExists(i);
                }
                else {
                    this.markThatMessageIsDeleted(i, promises);
                }
            }
            info.mods.forEach(x => {
                this.markThatMessageHaveToBeLoadedAgain(x.mid, promises);
            });
            return Q.all(promises);
        })
        .then(() => {
            this.cursor.seq = info.seq;
            this.cursor.modSeq = info.modSeq;
            return this.save();
        })
        .fin(() => {
            this.releaseChangeEvent();
        });
    }
    
    markThatMessageExists(mid: number) {
        const entry = this.getBaseEntryByMid(mid);
        if (entry == null || this.isDeletedEntry(entry)) {
            const newEntry: SinkIndexEntryInfoNotLoaded = {
                id: mid,
                mode: BaseEntryMode.NOT_LOADED,
                canBeInCache: true,
                ignoreDeleted: true
            };
            this.setBaseEntry(newEntry);
        }
        else if (this.isNotLoadedEntry(entry)) {
            entry.ignoreDeleted = true;
        }
    }
    
    markThatMessageIsDeleted(mid: number, taskList: Q.Promise<void>[]) {
        const entry = this.getBaseEntryByMid(mid);
        if (entry == null || !this.isDeletedEntry(entry)) {
            const newEntry: SinkIndexEntryInfoDeleted = {
                id: mid,
                mode: BaseEntryMode.DELETED
            };
            this.setBaseEntry(newEntry);
            taskList.push(this.saveInStorage(newEntry));
        }
    }
    
    markThatMessageHaveToBeLoadedAgain(mid: number, taskList: Q.Promise<void>[]) {
        const entry = this.getBaseEntryByMid(mid);
        taskList.push(this.removeStorageEntry(entry));
        if (entry == null || !this.isNotLoadedEntry(entry)) {
            const newEntry: SinkIndexEntryInfoNotLoaded = {
                id: mid,
                mode: BaseEntryMode.NOT_LOADED,
                canBeInCache: true
            };
            this.setBaseEntry(newEntry);
        }
    }
    
    getBaseEntryByMid(mid: number) {
        return this.baseEntries.get(this.getBaseEntryIndexFromMid(mid));
    }
    
    setBaseEntry(baseEntry: BaseEntry) {
        this.baseEntries.setAt(this.getBaseEntryIndexFromMid(baseEntry.id), baseEntry);
    }
    
    getBaseEntryIndexFromMid(mid: number) {
        return mid - 1;
    }
    
    isLoadedEntry(entry: BaseEntry): entry is SinkIndexEntry {
        return entry instanceof SinkIndexEntry;
    }
    
    isNotLoadedEntry(entry: BaseEntry): entry is SinkIndexEntryInfoNotLoaded {
        return (<SinkIndexEntryInfoNotLoaded>entry).mode == BaseEntryMode.NOT_LOADED;
    }
    
    isDeletedEntry(entry: BaseEntry): entry is SinkIndexEntryInfoDeleted {
        return (<SinkIndexEntryInfoDeleted>entry).mode == BaseEntryMode.DELETED;
    }
    
    getMessagesCount(): number {
        let sum = 0;
        this.baseEntries.forEach(x => {
            if (x instanceof SinkIndexEntry || (<SinkIndexEntryInfo>x).mode == BaseEntryMode.NOT_LOADED) {
                sum++;
            }
        });
        return sum;
    }

    getReadableMessagesCount(): number {
        let sum = 0;
        this.baseEntries.forEach(x => {
            if (x instanceof SinkIndexEntry || (<SinkIndexEntryInfo>x).mode == BaseEntryMode.NOT_LOADED) {
                if (x instanceof SinkIndexEntry) {
                    if (x.source && x.source.data && x.source.data.type == "chat-message" && x.source.data.contentType == "application/json") {
                        return;
                    }
                }
                sum++;
            }
        });
        return sum;
    }


    getBaseEntry(id: number): BaseEntry {
        return this.baseEntries.list[id - 1];
    }
    
    getEntry(id: number): SinkIndexEntry {
        return this.entries.find(entry => {
            return entry.id == id;
        });
    }
    
    process(data: privfs.types.message.SinkPollEntry): Q.Promise<PollingItem[]> {
        let result: PollingItem[] = [];
        let newStickers: privfs.types.core.Sticker[] = [];
        this.needUpdate = false;
        return Q().then(() => {
            Logger.debug("process poll", data, this);
            this.holdChangeEvent();
            data.msg.forEach(x => {
                if ((<any>x).error) {
                    Logger.warn("Cannot process message, error during decoding.", this, x);
                }
            });
            return PromiseUtils.oneByOne(data.meta, (_, meta) => {
                if (meta == null || meta.modSeq <= this.cursor.modSeq) {
                    return;
                }
                if ((<any>meta).error) {
                    Logger.warn("Cannot process meta, error during decoding.", this, meta);
                    return;
                }
                let entry = this.getBaseEntry(meta.msgId);
                if (meta.deleted) {
                    if (entry == null || (<SinkIndexEntryInfo>entry).mode == BaseEntryMode.DELETED) {
                        return;
                    }
                    return this.deleteFromStorage(entry)
                    .then(() => {
                        this.removeFromEntries(entry, true);
                    });
                }
                if (entry == null) {
                    let message: privfs.message.SentMessage = null;
                    for (var j in data.msg) {
                        if (data.msg[j] && data.msg[j].serverId == meta.msgId) {
                            message = data.msg[j];
                            break;
                        }
                    }
                    if (message == null) {
                        Logger.warn("Cannot process meta because there isn't a corresponding message in index.", this, meta);
                        return;
                    }
                    let entry = new SinkIndexEntry(message.source, meta.data, meta.tags, [], meta.stickers, this);
                    if (this.onBeforeAddEntry) {
                        this.onBeforeAddEntry(entry);
                    }
                    return this.saveInStorage(entry)
                    .then(() => {
                        result.push({entry: entry, newStickers: newStickers});
                        this.addToEntries(entry, true);
                    });
                }
                else {
                    return Q().then(() => {
                        if (entry instanceof SinkIndexEntry) {
                            return entry;
                        }

                        if (entry.mode == BaseEntryMode.NOT_LOADED) {
                            return this.loadFromCache([entry]).then(() => {
                                return this.getBaseEntry(meta.msgId);
                            });
                        }

                        return null;
                    })
                    .then(entry => {

                        if (!(entry instanceof SinkIndexEntry)) {
                            Logger.warn("Cannot process meta because there isn't a corresponding message in index.", this, meta);
                            return;
                        }
                        let message = Lang.find(data.msg, x => x.serverId == meta.msgId);
                        if (message != null) {
                            let newEntry = new SinkIndexEntry(message.source, meta.data, meta.tags, [], meta.stickers, this);
                            return this.saveInStorage(newEntry).then(() => {
                                this.replaceInEntries(entry, newEntry, true);
                            });
                        }
                        else {
                            if (this.sendModificationToServer) {
                                entry.data = meta.data || {};
                            }
                            entry.stickers = meta.stickers || [];
                            newStickers = meta.stickers.filter(s => s.t == (<any>meta).timestamp);
                            result.push({entry: entry, newStickers: newStickers});
                            return this.saveInStorage(entry).then(() => {
                                this.updateInEntries(entry, true);
                            });
                        }
                    })
                }
            })
            .then(() => {
                if (this.cursor.modSeq >= data.modSeq) {
                    return;
                }
                this.cursor.seq = data.seq;
                this.cursor.modSeq = data.modSeq;
                return this.save()
                .then(() => {
                    this.changeEvent.trigger("save", this);
                });
            })
            .fin(() => {
                this.releaseChangeEvent();
            });
        })
        .then(() => {
            return result;
        });
    }
    
    setFlag(id: number, flag: string, value: boolean): Q.Promise<void> {
        return this.updateEntry(id, (data, tags) => {
            if (!data) {
                data = {};
            }
            data[flag] = value;
            return {
                data: data,
                tags: tags
            }
        });
    }
    
    updateReadIndex(readIndex: number): void {
        if (this.useReadIndex && readIndex > this.readIndex) {
            let indicies: number[] = [];
            this.baseEntries.forEach((x, i) => {
                if (x instanceof SinkIndexEntry) {
                    let willBeRead = x.id <= readIndex || (x.data && x.data.read);
                    if (x.isRead() != willBeRead) {
                        indicies.push(i);
                    }
                }
            });
            this.settingsStorage.setReadIndex(this.sink.id, readIndex);
            this.readIndex = readIndex;
            indicies.forEach(x => {
                this.baseEntries.updateAt(x);
            });
        }
    }
    
    setStickers(id: number, stickers: string[], replace: boolean): Q.Promise<void> {
        return Q().then(() => {
            let entry = this.getEntry(id);
            if (entry == null) {
                throw new Error("Entry not found");
            }
            return this.sinkIndexManager.messageManager.messageSetStickers(entry.sink.id, entry.id, stickers, replace).then(stickers => {
                entry.stickers = stickers;
                this.updateInEntries(entry, true);
            });
        });
    }
    
    updateEntry(id: number, func: (data: Flags, tags: string[], entry: SinkIndexEntry) => Q.IWhenable<{data: Flags, tags: string[]}|false>): Q.Promise<void> {
        return Q().then(() => {
            let entry = this.getEntry(id);
            if (entry == null) {
                throw new Error("Entry not found");
            }
            return entry.updateQueue.add(() => {
                let entry = this.getEntry(id);
                if (entry == null) {
                    return;
                }
                let copyForModify = Utils.simpleDeepClone(entry.data);
                let copyForModifyTags = Utils.simpleDeepClone(entry.tags);
                return Q().then(() => {
                    return func(copyForModify, copyForModifyTags, entry);
                })
                .then(result => {
                    if (result === false) {
                        return;
                    }
                    Logger.debug("updateEntry", id, entry, this);
                    let modifications = SinkIndexEntry.getMetaDiff(entry.data, entry.tags, result.data, result.tags);
                    let oldMods = Utils.simpleDeepClone(entry.metaCommit.mods);
                    if (result.data && result.data.read) {
                        this.updateReadIndex(entry.id);
                    }
                    if (!this.sendModificationToServer) {
                        return this.saveInStorageWithMods(entry, modifications).then(() => {
                            entry.addMods(modifications);
                            this.updateInEntries(entry, true);
                        });
                    }
                    return this.sinkIndexManager.updatesQueue.addUpdateTask(entry.sink.id, entry.id, () => {
                        return this.saveInStorageWithMods(entry, modifications).then(() => {
                            entry.addMods(modifications);
                            this.updateInEntries(entry, true);
                        });
                    })
                    .fail(e => {
                        entry.metaCommit.mods = oldMods;
                        entry.refreshMeta();
                        this.updateInEntries(entry, true);
                        return Q.reject(e);
                    });
                });
            });
        });
    }
    
    revertUpdateEntry(id: number): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("revertUpdateEntry", id, this);
            let entry = this.getEntry(id);
            if (entry == null) {
                Logger.warn("Cannot revert update, there isn't entry in index", id, this);
                return;
            }
            entry.metaCommit.mods = [];
            entry.refreshMeta();
            return this.saveInStorage(entry)
            .then(() => {
                this.updateInEntries(entry, false);
                this.changeEvent.trigger("update-revert", this, entry);
            });
        });
    }
    
    deleteEntry(id: number): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("deleteEntry", id, this);
            let entry = this.getEntry(id);
            if (entry == null) {
                throw new Error("Entry not found");
            }
            return this.sinkIndexManager.updatesQueue.addDeleteTask(entry.sink.id, entry.id, entry.source, entry.data, entry.tags, entry.stickers, () => {
                return this.deleteFromStorage(entry)
                .then(() => {
                    this.removeFromEntries(entry, true);
                });
            });
        });
    }
    
    revertDeleteEntry(id: number, source: privfs.types.message.SerializedMessageFull, data: Flags, tags: string[], stickers: privfs.types.core.Sticker[]): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("revertDeleteEntry", id, source, data, this);
            let entry = this.getEntry(id);
            if (entry != null) {
                Logger.warn("Cannot revert delete, there is still entry in index", id, source, data, this);
                return;
            }
            entry = new SinkIndexEntry(source, data, tags, [], stickers, this);
            return this.saveInStorage(entry)
            .then(() => {
                this.addToEntries(entry, false);
                this.changeEvent.trigger("delete-revert", this, entry);
            });
        });
    }
    
    moveEntry(id: number, destinationIndex: SinkIndex): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("moveEntry", id, this);
            let entry = this.getEntry(id);
            if (entry == null) {
                throw new Error("Entry not found");
            }
            destinationIndex.needUpdate = true;
            return this.sinkIndexManager.updatesQueue.addMoveTask(entry.sink.id, entry.id, entry.source, entry.data, entry.tags, entry.stickers, destinationIndex.sink.id, () => {
                return this.deleteFromStorage(entry)
                .then(() => {
                    this.removeFromEntries(entry, false);
                    this.changeEvent.trigger("move", this, entry);
                });
            });
        });
    }
    
    revertMoveEntry(id: number, source: privfs.types.message.SerializedMessageFull, data: Flags, tags: string[], stickers: privfs.types.core.Sticker[]): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("revertMoveEntry", id, source, data, this);
            let entry = this.getEntry(id);
            if (entry != null) {
                Logger.warn("Cannot revert move, there is still entry in index", id, source, data, this);
                return;
            }
            entry = new SinkIndexEntry(source, data, tags, [], stickers, this);
            return this.saveInStorage(entry)
            .then(() => {
                this.addToEntries(entry, false);
                this.changeEvent.trigger("move-revert", this, entry);
            });
        });
    }
    
    deleteOldEntry(id: number): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("deleteOldEntries", id, this);
            let entry = this.getBaseEntry(id);
            if (entry == null) {
                return;
            }
            return this.deleteFromStorage(entry)
            .then(() => {
                this.removeFromEntries(entry, true);
            });
        });
    }
    
    clear(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("clear", this);
            let messages: SerializedEntry[] = [];
            let entries: SinkIndexEntry[] = [];
            this.entries.forEach(entry => {
                entries.push(entry);
                messages.push({
                    id: entry.id,
                    source: entry.source,
                    data: entry.data,
                    tags: entry.tags,
                    stickers: entry.stickers
                });
            });
            return this.sinkIndexManager.updatesQueue.addDeleteBulkTask(this.sink.id, messages, () => {
                entries.forEach(x => {
                    this.removeFromEntries(x, true);
                });
                return PromiseUtils.oneByOne(entries, (_, entry) => {
                    return this.deleteFromStorage(entry);
                })
                .then(() => {
                    this.changeEvent.trigger("clear", this);
                });
            });
        });
    }
    
    revertDeleteBulk(messages: SerializedEntry[]): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("revertDeleteBulk", messages, this);
            return PromiseUtils.oneByOne(messages, (_, r) => {
                let entry = this.getEntry(r.id);
                if (entry != null) {
                    Logger.warn("Cannot revert delete (from bulk), there is still entry in index", r, this);
                    return;
                }
                entry = new SinkIndexEntry(r.source, r.data, r.tags, [], r.stickers, this);
                return this.saveInStorage(entry)
                .then(() => {
                    this.addToEntries(entry, false);
                });
            })
            .then(() => {
                this.changeEvent.trigger("delete-bulk-revert", this);
            });
        });
    }
    
    addEntry(source: privfs.types.message.SerializedMessageFull, data: Flags, tags: string[], replace?: boolean): Q.Promise<SinkIndexEntry> {
        return Q().then(() => {
            Logger.debug("addEntry", source, data, tags, this);
            let entry = this.getEntry(source.serverId);
            if (entry == null) {
                entry = new SinkIndexEntry(source, data, tags, [], [], this);
                return this.saveInStorage(entry)
                .then(() => {
                    this.addToEntries(entry, true);
                    return entry;
                });
            }
            else {
                if (replace) {
                    let newEntry = new SinkIndexEntry(source, data, tags, [], [], this);
                    return this.saveInStorage(newEntry).then(() => {
                        this.replaceInEntries(entry, newEntry, true);
                        return newEntry;
                    });
                }
                else {
                    entry.data = data;
                    return this.saveInStorage(entry)
                    .then(() => {
                        this.updateInEntries(entry, true);
                        return entry;
                    });
                }
            }
        });
    }
    
    addToEntries(entry: BaseEntry, fireEvent: boolean): void {
        this.baseEntries.setAt(entry.id - 1, entry);
        if (fireEvent && entry instanceof SinkIndexEntry) {
            this.changeEvent.trigger("new", this, entry);
        }
    }
    
    updateInEntries(entry: BaseEntry, fireEvent: boolean): void {
        this.baseEntries.setAt(entry.id - 1, entry);
        if (fireEvent && entry instanceof SinkIndexEntry) {
            this.changeEvent.trigger("update", this, entry);
        }
    }
    
    replaceInEntries(oldEntry: BaseEntry, entry: BaseEntry, fireEvent: boolean): void {
        this.baseEntries.setAt(oldEntry.id - 1, entry);
        if (fireEvent && entry instanceof SinkIndexEntry) {
            this.changeEvent.trigger("update", this, entry);
        }
    }
    
    removeFromEntries(entry: BaseEntry, fireEvent: boolean): void {
        this.baseEntries.setAt(entry.id - 1, {id: entry.id, mode: BaseEntryMode.DELETED});
        if (fireEvent && entry instanceof SinkIndexEntry) {
            this.changeEvent.trigger("delete", this, entry);
        }
    }
    
    deleteFromStorage(entry: BaseEntry): Q.Promise<void> {
        return Q().then(() => {
            return this.useStorage ? this.sinkIndexManager.storage.set(this.getEntryStorageKey(entry), {id: entry.id, mode: BaseEntryMode.DELETED}) : null;
        });
    }
    
    saveInStorage(entry: BaseEntry): Q.Promise<void> {
        return Q().then(() => {
            return this.useStorage ? this.sinkIndexManager.storage.set(this.getEntryStorageKey(entry), entry instanceof SinkIndexEntry ? entry.serializeCore() : entry) : null;
        });
    }
    
    saveInStorageWithMods(entry: SinkIndexEntry, mods: MessageModification[]): Q.Promise<void> {
        return Q().then(() => {
            return this.useStorage ? this.sinkIndexManager.storage.set(this.getEntryStorageKey(entry), entry.serializeCoreWithMods(mods)) : null;
        });
    }
    
    removeStorageEntry(entry: BaseEntry): Q.Promise<void> {
        return Q().then(() => {
            return this.useStorage ? this.sinkIndexManager.storage.remove(this.getEntryStorageKey(entry)) : null;
        });
    }
    
    save(): Q.Promise<void> {
        return Q().then(() => {
            if (!this.useStorage) {
                return;
            }
            Logger.debug("saving index", this);
            let data = {
                seq: this.cursor.seq,
                modSeq: this.cursor.modSeq,
                version: 1
            };
            return this.sinkIndexManager.storage.set(this.storageKey, data);
        });
    }
    
    getEntryStorageKey(entry: BaseEntry): string {
        return this.getEntryStorageKeyById(entry.id);
    }
    
    getEntryStorageKeyById(id: number): string {
        return this.storageKey + "/m/" + id;
    }
    
    holdChangeEvent(): void {
        this.changeEvent.hold();
        this.baseEntries.changeEvent.hold();
    }
    
    releaseChangeEvent(): void {
        this.changeEvent.release();
        this.baseEntries.changeEvent.release();
    }
    
    getLastDate(): number {
        let last = this.entries.getLast();
        return last ? last.source.serverDate : 0;
    }

    getLastDateIgnoreSaveFileMessageType(): number {
        let filtered = this.entries.list.filter(x => {
            let asJson = x.getContentAsJson();
            if (asJson && asJson.type == "save-file") {
                return false;
            }
            return true;
        });
        let last = filtered[filtered.length - 1];
        return last ? last.source.serverDate : 0;
    }

    
    static sinkIndexComparator(aIndex: SinkIndex, bIndex: SinkIndex): number {
        return SinkIndex.sinkComparator(aIndex.sink, bIndex.sink);
    }
    
    static sinkComparator(a: privfs.message.MessageSinkPriv, b: privfs.message.MessageSinkPriv): number {
        if (a.extra.type == b.extra.type) {
            if (a.extra.type == "inbox") {
                if (a.extra.isPrivate && !b.extra.isPrivate) {
                    return 1;
                }
                if (!a.extra.isPrivate && b.extra.isPrivate) {
                    return -1;
                }
            }
            return a.name.localeCompare(b.name);
        }
        if (a.extra.type == "inbox") {
            return -1;
        }
        if (b.extra.type == "inbox") {
            return 1;
        }
        if (a.extra.type == "folder") {
            return -1;
        }
        if (b.extra.type == "folder") {
            return 1;
        }
        if (a.extra.type == "outbox") {
            return -1;
        }
        if (b.extra.type == "outbox") {
            return 1;
        }
        if (a.extra.type == "form") {
            return -1;
        }
        if (b.extra.type == "form") {
            return 1;
        }
    }
}
