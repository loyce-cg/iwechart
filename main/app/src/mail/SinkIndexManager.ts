import * as Q from "q";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.SinkIndexManager");
import {Map} from "../utils/Map";
import {MergedCollection} from "../utils/collection/MergedCollection";
import {MutableCollection} from "../utils/collection/MutableCollection";
import {Event} from "../utils/Event";
import {SinkIndex, PollingItem} from "./SinkIndex";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {UpdatesQueue} from "./UpdatesQueue";
import {SinkPolling} from "./SinkPolling";
import * as privfs from "privfs-client";
import {PromiseUtils} from "simplito-promise";
import {ParallelTaskStream} from "../task/ParallelTaskStream";
import {mail, event, utils} from "../Types";
import {Lang} from "../utils/Lang";
import {EventDispatcher} from "../utils/EventDispatcher";
import {SortTake} from "../utils/SortTake";

export interface SinkSource {
    getIndexBySinkId(sid: string): SinkIndex;
    getSinkById(sid: string): privfs.message.MessageSinkPriv;
}

export class SinkIndexManager {
    
    indexes: Map<SinkIndex>;
    sinkIndexCollection: MutableCollection<SinkIndex>;
    messagesCollection: MergedCollection<SinkIndexEntry>;
    changeEvent: Event<string, [string, SinkIndex, SinkIndexEntry][], any>;
    onIndexChangeBinded: (events: [string, SinkIndex, SinkIndexEntry][]) => void;
    updatesQueue: UpdatesQueue;
    sinkPolling: SinkPolling;
    additionalSinks: privfs.message.MessageSinkPriv[];
    contactFormSink: {value: privfs.message.MessageSinkPriv};
    loadingSinks: {[sid: string]: Q.Promise<SinkIndex>};
    onInitPromise: Q.Deferred<void>;
    
    constructor(
        public storage: utils.IStorage,
        public messageManager: privfs.message.MessageManager,
        public taskStream: ParallelTaskStream,
        public identity: privfs.identity.Identity,
        public eventDispatcher: EventDispatcher
    ) {
        this.indexes = new Map<SinkIndex>();
        this.sinkIndexCollection = new MutableCollection<SinkIndex>();
        this.messagesCollection = new MergedCollection<SinkIndexEntry>();
        this.changeEvent = new Event<string, [string, SinkIndex, SinkIndexEntry][], any>();
        this.onIndexChangeBinded = this.onIndexChange.bind(this);
        this.updatesQueue = new UpdatesQueue(this.storage, this.messageManager, this);
        this.additionalSinks = [];
        this.loadingSinks = {};
        this.onInitPromise = Q.defer();
    }
    
    init(sinks: privfs.message.MessageSinkPriv[]): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("init");
            let tasks: Q.Promise<void>[] = [];
            sinks.forEach(sink => {
                if (sink.extra.type != "inbox" && sink.extra.type != "outbox" && sink.extra.type != "form" && sink.extra.type != "trash") {
                    this.additionalSinks.push(sink);
                    return;
                }
                let index = new SinkIndex(sink, this);
                index.changeEvent.add(this.onIndexChangeBinded, "multi");
                this.indexes.put(sink.id, index);
                this.sinkIndexCollection.add(index);
                this.messagesCollection.addCollection(index.entries);
                tasks.push(index.load());
            });
            return Q.all(tasks);
        })
        .then(() => {
            return this.updatesQueue.load();
        })
        .then(() => {
            Logger.debug("init completed");
            this.changeEvent.trigger("init");
            this.onInitPromise.resolve();
        });
    }
    
    waitForInit(): Q.Promise<void> {
        return this.onInitPromise.promise;
    }
    
    destroy(): void {
        this.stopSinkPolling();
    }
    
    addSinkWithoutLoadM(options: {sink: privfs.message.MessageSinkPriv, sinkIndexModifier?: (sinkIndex: SinkIndex) => void}): SinkIndex {
        let index = new SinkIndex(options.sink, this);
        if (options.sinkIndexModifier) {
            options.sinkIndexModifier(index);
        }
        index.changeEvent.add(this.onIndexChangeBinded, "multi");
        this.indexes.put(options.sink.id, index);
        this.sinkIndexCollection.add(index);
        this.messagesCollection.addCollection(index.entries);
        return index;
    }
    
    addSinkM(options: {sink: privfs.message.MessageSinkPriv, load: boolean, loadLastCount?: number, preLoad?: boolean, sinkIndexModifier?: (sinkIndex: SinkIndex) => void}): Q.Promise<SinkIndex> {
        if (options.sink.id in this.loadingSinks) {
            return this.loadingSinks[options.sink.id];
        }
        let sinkIndex = this.getIndexBySink(options.sink);
        if (sinkIndex) {
            return Q(sinkIndex);
        }
        return this.loadingSinks[options.sink.id] = Q().then(() => {
            if (options.load) {
                let index = new SinkIndex(options.sink, this);
                if (options.sinkIndexModifier) {
                    options.sinkIndexModifier(index);
                }
                return Q().then(() =>{
                    if (options.preLoad) {
                        return index.load();
                    }
                })
                .then(() => {
                    return index.synchronizeUsingSinkInfo();
                })
                .then(() => {
                    return index.loadLastMessages(options.loadLastCount);
                })
                .then(() => {
                    index.changeEvent.add(this.onIndexChangeBinded, "multi");
                    this.indexes.put(options.sink.id, index);
                    this.sinkIndexCollection.add(index);
                    this.messagesCollection.addCollection(index.entries);
                    index.changeEvent.trigger("load", index);
                    return index;
                })
            }
            let sinkIndex = this.addSinkWithoutLoadM(options);
            return sinkIndex.load().thenResolve(sinkIndex);
        });
    }
    
    addSinkWithoutLoad(sink: privfs.message.MessageSinkPriv, useStorage: boolean = true, sendModificationToServer: boolean = true): SinkIndex {
        return this.addSinkWithoutLoadM({
            sink: sink,
            sinkIndexModifier: sink => {
                sink.useStorage = useStorage;
                sink.sendModificationToServer = sendModificationToServer;
            }
        });
    }
    
    addSink(sink: privfs.message.MessageSinkPriv, load: boolean = false, useStorage: boolean = true, sendModificationToServer: boolean = true): Q.Promise<SinkIndex> {
        return this.addSinkM({
            sink: sink,
            load: load,
            sinkIndexModifier: sink => {
                sink.useStorage = useStorage;
                sink.sendModificationToServer = sendModificationToServer;
            }
        });
    }
    
    addSinkWithCheck(sink: privfs.message.MessageSinkPriv, load: boolean = false, useStorage: boolean = true): Q.Promise<SinkIndex> {
        return this.addSink(sink, load, useStorage);
    }
    
    removeSink(sink: privfs.message.MessageSinkPriv): Q.Promise<void> {
        return Q().then(() => {
            let index = this.getIndexBySink(sink);
            if (index) {
                index.changeEvent.remove(this.onIndexChangeBinded);
                this.indexes.remove(sink.id);
                this.sinkIndexCollection.remove(index);
                this.messagesCollection.removeCollection(index.entries);
            }
        });
    }
    
    onIndexChange(events: [string, SinkIndex, SinkIndexEntry][]): void {
        this.changeEvent.trigger("index-change", events);
    }
    
    getAllCursors(): privfs.message.MessageSinkCursor[] {
        let map = this.indexes.getEnumerable();
        return Object.keys(map).map(k => {
            return map[k].cursor;
        });
    }
    
    getAllSinksEx(): privfs.message.MessageSinkPriv[] {
        return this.additionalSinks.concat(this.getAllSinks());
    }
    
    getAllSinks(): privfs.message.MessageSinkPriv[] {
        let map = this.indexes.getEnumerable();
        return Object.keys(map).map(k => {
            return map[k].sink;
        });
    }
    
    getAllIndexesBySinkType(type: string): SinkIndex[] {
        return this.getAllIndexesAsList().filter(index => {
            return index.sink.extra.type == type;
        });
    }
    
    getAllIndexes(): {[id: string]: SinkIndex} {
        return this.indexes.getEnumerable();
    }
    
    getIndexBySinkId(id: string): SinkIndex {
        return this.indexes.get(id);
    }
    
    getSinkIndexById(id: string): SinkIndex {
        return this.indexes.get(id);
    }
    
    getSinkById(id: string): privfs.message.MessageSinkPriv {
        let index = this.getIndexBySinkId(id);
        return index == null ? null : index.sink;
    }
    
    getIndexBySink(sink: privfs.message.MessageSinkPriv): SinkIndex {
        return this.getIndexBySinkId(sink.id);
    }
    
    getSinkIndexByWif(wif: string): SinkIndex {
        let en = this.getAllIndexes();
        for (let id in en) {
            if (en[id].sink.privWif == wif) {
                return en[id];
            }
        }
        return null;
    }
    
    getAllIndexesAsList(): SinkIndex[] {
        return this.indexes.getValues();
    }
    
    updateIndexes(update: {[sid: string]: privfs.types.message.SinkPollEntry}): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("updateIndexes", update);
            this.holdChangeEvent();
            let result: PollingItem[][] = [];
            return PromiseUtils.oneByOne(update, (id, data) => {
                Logger.debug("sink id", id);
                let index = this.getIndexBySinkId(id);
                if (index == null) {
                    Logger.debug("index not found!", id);
                    return;
                }
                return index.process(data).then(addedEntries => {
                    result.push(addedEntries);
                });
            })
            .then(() => {
                let res: PollingItem[] = Array.prototype.concat.apply([], result);
                this.eventDispatcher.dispatchEvent<event.SinkPollingResultEvent>({
                    type: "sinkpollingresult",
                    entries: res
                });
            })
            .fin(() => {
                this.releaseChangeEvent();
            });
        });
    }
    
    holdChangeEvent(): void {
        this.changeEvent.hold();
    }
    
    releaseChangeEvent(): void {
        this.changeEvent.release();
    }
    
    holdChangeEventDeep(): void {
        this.holdChangeEvent();
        for (let i in this.indexes.getEnumerable()) {
            this.indexes.get(i).holdChangeEvent();
        }
    }
    
    releaseChangeEventDeep(): void {
        for (let i in this.indexes.getEnumerable()) {
            this.indexes.get(i).releaseChangeEvent();
        }
        this.releaseChangeEvent();
    }
    
    getIndexEntryFromHandler(handler: mail.MessageHandler): SinkIndexEntry {
        if (handler instanceof SinkIndexEntry) {
            return handler;
        }
        let index = this.getIndexBySink(handler.sink);
        return index == null ? null : index.getEntry(handler.id);
    }
    
    getCursorBySink(sink: privfs.message.MessageSinkPriv): privfs.message.MessageSinkCursor {
        return this.getCursorBySinkId(sink.id);
    }
    
    getCursorBySinkId(id: string): privfs.message.MessageSinkCursor {
        let index = this.getIndexBySinkId(id);
        return index == null ? null : index.cursor;
    }
    
    getCursorsForPolling(): privfs.message.MessageSinkCursor[] {
        return this.getAllCursors();
    }
    
    consumePollingResult(data: privfs.types.message.SinkPollResult): Q.Promise<void> {
         return this.updateIndexes(data.sinks);
    }
    
    afterPolling(): Q.Promise<void> {
        return this.updatesQueue.run();
    }
    
    startSinkPolling(): void {
        if (!this.sinkPolling) {
            this.sinkPolling = new SinkPolling(this.taskStream, this.messageManager, this, true);
        }
    }
    
    stopSinkPolling(): void {
        if (this.sinkPolling) {
            this.sinkPolling.destroy();
            delete this.sinkPolling;
        }
    }
    
    getContactFormSink(): privfs.message.MessageSinkPriv {
        if (this.contactFormSink == null) {
            this.contactFormSink = {value: Lang.find(this.getAllSinksEx(), x => x.extra.type == "contact")};
        }
        return this.contactFormSink.value;
    }
    
    removeAllMessagesByDomains(domains: string[]): void {
        this.indexes.forEach(index => {
            let isUserFromDomain = (user: privfs.identity.User): boolean => {
                return domains.indexOf(user.host) != -1;
            };
            let isIndexEntryFromDomain = (indexEntry: SinkIndexEntry): boolean => {
                let msg = indexEntry.getMessage();
                if (isUserFromDomain(msg.sender)) {
                    return true;
                }
                for (let i = 0; i < msg.receivers.length; i++) {
                    if (isUserFromDomain(msg.receivers[i].user)) {
                        return true;
                    }
                }
            };
            let check = (indexEntry: SinkIndexEntry) => {
                if (isIndexEntryFromDomain(indexEntry)) {
                    Logger.debug("Deleting", indexEntry.id, indexEntry.getMessage().sender.hashmail);
                    index.deleteEntry(indexEntry.id)
                    .fail(e => {
                        Logger.error("Cannot delete", indexEntry.id, e);
                    });
                }
            };
            index.entries.forEach(check);
        });
    }
    
    removeAllMessagesByHashmails(hashmails: string[]): void {
        this.indexes.forEach(index => {
            let userAtHashmailList = (user: privfs.identity.User): boolean => {
                return hashmails.indexOf(user.hashmail) != -1;
            };
            let isIndexEntryConnectedWithHasmails = (indexEntry: SinkIndexEntry): boolean => {
                let msg = indexEntry.getMessage();
                if (userAtHashmailList(msg.sender)) {
                    return true;
                }
                for (let i = 0; i < msg.receivers.length; i++) {
                    if (userAtHashmailList(msg.receivers[i].user)) {
                        return true;
                    }
                }
            };
            let check = (indexEntry: SinkIndexEntry) => {
                if (isIndexEntryConnectedWithHasmails(indexEntry)) {
                    Logger.debug("Deleting", indexEntry.id, indexEntry.getMessage().sender.hashmail);
                    index.deleteEntry(indexEntry.id)
                    .fail(e => {
                        Logger.error("Cannot delete", indexEntry.id, e);
                    });
                }
            };
            index.entries.forEach(check);
        });
    }
    
    getMessagesSummaryByDomain(): {[domain: string]: {count: number, lastDate: number}} {
        let result: {[domain: string]: {count: number, lastDate: number}} = {};
        this.indexes.forEach(index => {
            let process = (indexEntry: SinkIndexEntry) => {
                let domain = indexEntry.host;
                if (!(domain in result)) {
                    result[domain] = {
                        count: 0,
                        lastDate: 0
                    };
                }
                result[domain].count++;
                if (indexEntry.source.serverDate > result[domain].lastDate) {
                    result[domain].lastDate = indexEntry.source.serverDate;
                }
            };
            index.entries.forEach(process);
        });
        return result;
    }
    
    getLastUnfilteredMessagesFromDomain(domain: string, count: number): SinkIndexEntry[] {
        let result = new SortTake(count, (a: SinkIndexEntry, b: SinkIndexEntry) => {
            return b.source.serverDate - a.source.serverDate;
        });
        this.indexes.forEach(index => {
            let process = (indexEntry: SinkIndexEntry) => {
                if (indexEntry.host != domain) {
                    return;
                }
                result.add(indexEntry);
            };
            index.entries.forEach(process);
        });
        return result.list;
    }
}

