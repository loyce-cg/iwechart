import {FilteredCollection} from "../utils/collection/FilteredCollection";
import {MergedCollection} from "../utils/collection/MergedCollection";
import {BaseCollection} from "../utils/collection/BaseCollection";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {FilterMode} from "./FilterMode";
import {Model} from "../utils/Model";
import {Event} from "../utils/Event";
import * as Q from "q";
import { KvdbMap } from "./kvdb/KvdbMap";

export interface MailFilterEntry {
    mode: FilterMode;
}

export class DomainsCollections {
    
    collectionsByDomain: {[domain: string]: MergedCollection<SinkIndexEntry>};
    collections: BaseCollection<SinkIndexEntry>[];
    
    constructor() {
        this.collectionsByDomain = {};
        this.collections = [];
    }
    
    getFilteredCollection(collection: BaseCollection<SinkIndexEntry>, domain: string): FilteredCollection<SinkIndexEntry> {
        return new FilteredCollection(collection, entry => entry.host == domain);
    }
    
    addDomain(domain: string): void {
        if (!(domain in this.collectionsByDomain)) {
            let domainCollection = new MergedCollection<SinkIndexEntry>();
            this.collections.forEach(x => {
                domainCollection.addCollection(this.getFilteredCollection(x, domain));
            });
            this.collectionsByDomain[domain] = domainCollection;
        }
    }
    
    addCollection(collection: BaseCollection<SinkIndexEntry>): void {
        this.collections.push(collection);
        for (let domain in this.collectionsByDomain) {
            this.collectionsByDomain[domain].addCollection(this.getFilteredCollection(collection, domain));
        }
    }
}

export class UnknownDomains {
    
    count: Model<number>;
    messagesCount: Model<number>;
    domains: {[domain: string]: boolean};
    held: boolean;
    refreshIntervalId: NodeJS.Timer;
    refreshCoreBinded: () => void;
    
    constructor(public domainsCollections: DomainsCollections) {
        this.count = new Model(0);
        this.messagesCount = new Model(0);
        this.domains = {};
        this.refreshCoreBinded = this.refreshCore.bind(this);
    }
    
    refresh(): void {
        clearInterval(this.refreshIntervalId);
        this.refreshIntervalId = setTimeout(this.refreshCoreBinded, 10);
    }
    
    refreshCore(): void {
        let messagesCount = 0;
        for (let domain in this.domainsCollections.collectionsByDomain) {
            if (domain in this.domains) {
                messagesCount += this.domainsCollections.collectionsByDomain[domain].size();
            }
        }
        this.messagesCount.setWithCheck(messagesCount);
    }
    
    reset(): void {
        this.count.set(0);
        this.messagesCount.set(0);
        this.domains = {};
        this.refresh();
    }
    
    addDomain(domain: string): void {
        if (!(domain in this.domains)) {
            this.domains[domain] = true;
            this.count.setWithCheck(this.count.get() + 1);
        }
        if (!this.held) {
            this.refresh();
        }
    }
    
    hold(): void {
        this.held = true;
        this.count.changeEvent.hold();
        this.messagesCount.changeEvent.hold();
    }
    
    trigger(): void {
        this.count.changeEvent.trigger();
        this.messagesCount.changeEvent.trigger();
    }
    
    release(): void {
        this.held = false;
        this.refresh();
        this.count.changeEvent.release();
        this.messagesCount.changeEvent.release();
    }
}

export class MailFilter {
    
    kvdb: KvdbMap<MailFilterEntry>;
    filteredCollections: FilteredCollection<SinkIndexEntry>[];
    domainsCollections: DomainsCollections;
    unknownDomains: UnknownDomains;
    currentFilter: TheFilter;
    listChangeEvent: Event<any, any, any>
    
    constructor(kvdb: KvdbMap<MailFilterEntry>) {
        this.kvdb = kvdb;
        this.filteredCollections = [];
        this.domainsCollections = new DomainsCollections();
        this.unknownDomains = new UnknownDomains(this.domainsCollections);
        this.listChangeEvent = new Event();
        this.refreshFilter(this.kvdb.getEntries());
    }
    
    registerCollection(collection: BaseCollection<SinkIndexEntry>): FilteredCollection<SinkIndexEntry> {
        this.domainsCollections.addCollection(collection);
        this.unknownDomains.hold();
        let filtered = new FilteredCollection(collection, this.currentFilter.bindedFilter);
        this.filteredCollections.push(filtered);
        this.unknownDomains.trigger();
        this.unknownDomains.release();
        return filtered;
    }
    
    refreshFilter(domains: {[domain: string]: MailFilterEntry}): void {
        this.unknownDomains.reset();
        this.currentFilter = new TheFilter(domains, this);
        this.unknownDomains.hold();
        for (let i = 0; i < this.filteredCollections.length; i++) {
            this.filteredCollections[i].setFilter(this.currentFilter.bindedFilter);
        }
        this.unknownDomains.trigger();
        this.unknownDomains.release();
    }
    
    setDomain(domain: string, mode: FilterMode): Q.Promise<void> {
        return Q().then(() => {
            let value = {mode: mode};
            let mapCopy = this.kvdb.getEntries(true);
            mapCopy[domain] = value;
            this.refreshFilter(mapCopy);
            return this.kvdb.set(domain, value);
        })
        .then(() => {
            this.listChangeEvent.trigger("add", domain, mode);
        })
        .fail(e => {
            this.refreshFilter(this.kvdb.getEntries());
            return Q.reject<void>(e);
        });
    }
    
    removeDomain(domain: string): Q.Promise<void> {
        return Q().then(() => {
            let mapCopy = this.kvdb.getEntries(true);
            delete mapCopy[domain];
            this.refreshFilter(mapCopy);
            return this.kvdb.remove(domain);
        })
        .then(() => {
            this.listChangeEvent.trigger("remove", domain);
        })
        .fail(e => {
            this.refreshFilter(this.kvdb.getEntries());
            return Q.reject<void>(e);
        });
    }
    
    getDeniedDomains(): string[] {
        let result: string[] = [];
        this.kvdb.forEach((domain, entry) => {
            if (entry.mode == FilterMode.DENY) {
                result.push(domain);
            }
        });
        return result;
    }
    
    denyUnknownDomains(): Q.Promise<void> {
        if (this.unknownDomains.count.get() == 0) {
            return Q<void>(null);
        }
        return Q().then(() => {
            let mapCopy = this.kvdb.getEntries(true);
            let unknown = this.unknownDomains.domains;
            let toSet: {[key: string]: MailFilterEntry} = {};
            for (var domain in unknown) {
                mapCopy[domain] = {mode: FilterMode.DENY};
                toSet[domain] = {mode: FilterMode.DENY};
            }
            this.refreshFilter(mapCopy);
            return this.kvdb.setMany(toSet);
        })
        .then(() => {
            this.listChangeEvent.trigger("rebuild");
        })
        .fail(e => {
            this.refreshFilter(this.kvdb.getEntries());
            return Q.reject<void>(e);
        });
    }
}

export class TheFilter {
    
    domains: {[domain: string]: MailFilterEntry};
    mailFilter: MailFilter;
    bindedFilter: (sinkIndexEntry: SinkIndexEntry) => boolean;
    
    constructor(domains: {[domain: string]: MailFilterEntry}, mailFilter: MailFilter) {
        this.domains = domains;
        this.mailFilter = mailFilter;
        this.bindedFilter = this.filter.bind(this);
    }
    
    filter(sinkIndexEntry: SinkIndexEntry): boolean {
        let domain = sinkIndexEntry.host;
        this.mailFilter.domainsCollections.addDomain(domain);
        if (domain in this.domains) {
            return this.domains[domain].mode == FilterMode.ALLOW;
        }
        this.mailFilter.unknownDomains.addDomain(domain);
        return false;
    }
}
