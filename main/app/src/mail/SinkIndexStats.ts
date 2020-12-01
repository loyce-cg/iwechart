import {Event} from "../utils/Event";
import {BaseCollection} from "../utils/collection/BaseCollection";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {mail, utils} from "../Types";

export class SinkIndexStats {
    
    collection: BaseCollection<SinkIndexEntry>;
    bindedEvent: utils.collection.CollectionEventsCallback<SinkIndexEntry>;
    changeEvent: Event<any, any, any>;
    stats: mail.UnreadStatsBySid;
    
    constructor(collection: BaseCollection<SinkIndexEntry>) {
        this.collection = collection;
        this.bindedEvent = this.onEvents.bind(this);
        this.collection.changeEvent.add(this.bindedEvent, "multi");
        this.changeEvent = new Event();
    }
    
    destroy(): void {
        this.collection.changeEvent.remove(this.bindedEvent, "multi");
        this.changeEvent.clear();
    }
    
    onEvents(_events: utils.collection.CollectionEventArgs<SinkIndexEntry>[]): void {
        this.recalculateStats();
    }
    
    recalculateStats(): void {
        let stats = SinkIndexStats.getEmptyStatsBySid();
        this.collection.forEach(entry => {
            let type = entry.source.data.type || "";
            let data = entry.source.data.contentType == "application/json" ? entry.getContentAsJson() : null;
            let jsonType = data && data.type ? data.type : "";
            if (!stats.byType[type]) {
                stats.byType[type] = SinkIndexStats.getEmptyStatsByType();
            }
            if (!stats.byType[type].byJsonType[jsonType]) {
                stats.byType[type].byJsonType[jsonType] = {unread: 0};
            }
            if (!stats.byJsonType[jsonType]) {
                stats.byJsonType[jsonType] = SinkIndexStats.getEmptyStatsByJsonType();
            }
            if (!stats.byJsonType[jsonType].byType[type]) {
                stats.byJsonType[jsonType].byType[type] = {unread: 0};;
            }
            if (!entry.isRead()) {
                stats.unread++;
                stats.byType[type].unread++;
                stats.byType[type].byJsonType[jsonType].unread++;
                stats.byJsonType[jsonType].unread++;
                stats.byJsonType[jsonType].byType[type].unread++;
            }
        });
        if (!SinkIndexStats.compareStatsBySid(this.stats, stats)) {
            this.stats = stats;
            this.changeEvent.trigger();
        }
    }
    
    static compareStatsBySid(a: mail.UnreadStatsBySid, b: mail.UnreadStatsBySid): boolean {
        if (a == null || b == null) {
            return false;
        }
        if (a.unread != b.unread) {
            return false;
        }
        for (let type in a.byType) {
            if (!(type in b.byType) || a.byType[type].unread != b.byType[type].unread) {
                return false;
            }
        }
        for (let type in b.byType) {
            if (!(type in a.byType) || a.byType[type].unread != b.byType[type].unread) {
                return false;
            }
        }
        for (let jsonType in a.byJsonType) {
            if (!(jsonType in b.byJsonType) || a.byJsonType[jsonType].unread != b.byJsonType[jsonType].unread) {
                return false;
            }
        }
        for (let jsonType in b.byJsonType) {
            if (!(jsonType in a.byJsonType) || a.byJsonType[jsonType].unread != b.byJsonType[jsonType].unread) {
                return false;
            }
        }
        return true;
    }
    
    static addStats(base: mail.UnreadStatsBySid, additional: mail.UnreadStatsBySid): void {
        base.unread += additional.unread;
        for (let type in additional.byType) {
            let additionalByType = additional.byType[type];
            if (!(type in base.byType)) {
                base.byType[type] = SinkIndexStats.getEmptyStatsByType();
            }
            let baseByType = base.byType[type];
            baseByType.unread += additionalByType.unread;
            for (let jsonType in additionalByType.byJsonType) {
                if (!(jsonType in baseByType.byJsonType)) {
                    baseByType.byJsonType[jsonType] = {unread: 0};
                }
                baseByType.byJsonType[jsonType].unread += additionalByType.byJsonType[jsonType].unread;
            }
        }
        for (let jsonType in additional.byJsonType) {
            let additionalByJsonType = additional.byJsonType[jsonType];
            if (!(jsonType in base.byJsonType)) {
                base.byJsonType[jsonType] = SinkIndexStats.getEmptyStatsByJsonType();
            }
            let baseByJsonType = base.byJsonType[jsonType];
            baseByJsonType.unread += additionalByJsonType.unread;
            for (let type in additionalByJsonType.byType) {
                if (!(type in baseByJsonType.byType)) {
                    baseByJsonType.byType[type] = {unread: 0};
                }
                baseByJsonType.byType[type].unread += additionalByJsonType.byType[type].unread;
            }
        }
    }
    
    static addStatsWithSid(base: mail.UnreadStatsCombined, additional: mail.UnreadStatsBySid, sid: string): void {
        SinkIndexStats.addStats(base, additional);
        if (!base.bySid) {
            base.bySid = {};
        }
        if (!(sid in base.bySid)) {
            base.bySid[sid] = SinkIndexStats.getEmptyStatsBySid();
        }
        SinkIndexStats.addStats(base.bySid[sid], additional);
    }
    
    static getEmptyCombined(): mail.UnreadStatsCombined {
        return {
            unread: 0,
            byType: {},
            byJsonType: {},
            bySid: {}
        };
    }
    
    static getEmptyStatsBySid(): mail.UnreadStatsBySid {
        return {
            unread: 0,
            byType: {},
            byJsonType: {}
        };
    }
    
    static getEmptyStatsByType(): mail.UnreadStatsByType {
        return {
            unread: 0,
            byJsonType: {}
        };
    }
    
    static getEmptyStatsByJsonType(): mail.UnreadStatsByJsonType {
        return {
            unread: 0,
            byType: {}
        };
    }
    
    static getUnreadByType(stats: mail.UnreadStatsWithByType, type: string): number {
        return stats && stats.byType && type in stats.byType ? stats.byType[type].unread : 0;
    }
    
    getStats(): mail.UnreadStatsBySid {
        if (this.stats == null) {
            this.recalculateStats();
        }
        return this.stats;
    }
}
