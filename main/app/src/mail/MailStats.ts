import {SinkIndex} from "./SinkIndex";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {MutableCollection} from "../utils/collection/MutableCollection";
import {BaseCollection} from "../utils/collection/BaseCollection";
import {SinkIndexStats} from "./SinkIndexStats";
import {mail, utils, event} from "../Types";
import {EventDispatcher} from "../utils/EventDispatcher";
import { Session } from "./session/SessionManager";

export class MailStats {
    
    map: {[sid: string]: {index: SinkIndex, stats: SinkIndexStats}};
    bindedEvent: utils.collection.CollectionEventCallback<SinkIndex>;
    hostHash: string;
    
    constructor(
        public sinkIndexCollection: MutableCollection<SinkIndex>,
        public collectionSource: {getCollection(sid: string): BaseCollection<SinkIndexEntry>},
        public eventDispatcher: EventDispatcher
    ) {
        this.map = {};
    }
    
    destroy(): void {
        this.sinkIndexCollection.changeEvent.remove(this.bindedEvent);
        for (let sid in this.map) {
            this.map[sid].stats.destroy();
        }
    }
    
    getStats(sid: string): mail.UnreadStatsBySid {
        return sid in this.map ? this.map[sid].stats.getStats() : null;
    }
    
    getUnreadByType(sid: string, type: string): number {
        return SinkIndexStats.getUnreadByType(this.getStats(sid), type);
    }
    
    addSink(sinkIndex: SinkIndex): void {
        let stats = new SinkIndexStats(this.collectionSource.getCollection(sinkIndex.sink.id));
        stats.changeEvent.add(this.onStatsChange.bind(this, sinkIndex));
        this.map[sinkIndex.sink.id] = {
            index: sinkIndex,
            stats: stats
        };
        stats.recalculateStats();
    }
    
    removeSink(sid: string): void {
        if (sid in this.map) {
            let entry = this.map[sid];
            delete this.map[sid];
            entry.stats.destroy();
        }
    }
    
    onStatsChange(sinkIndex: SinkIndex): void {
        this.sinkIndexCollection.updateElement(sinkIndex);
        this.eventDispatcher.dispatchEvent<event.MailStatsEvent>({
            type: "mailstats",
            mailStats: this,
            stats: this.getCombinedStats()
        });
    }
    
    getCombinedStats(): mail.UnreadStatsCombined {
        let stats = SinkIndexStats.getEmptyCombined();
        for (let sid in this.map) {
            let entry = this.map[sid];
            if (entry.index.includeStatsToCombined()) {
                SinkIndexStats.addStatsWithSid(stats, entry.stats.getStats(), entry.index.sink.id);
            }
        }
        return stats;
    }
    
    setHostHash(session: Session): void {
        this.hostHash = session.hostHash;
        this.sinkIndexCollection.forEach(x => {
            this.addSink(x);
        });
        this.bindedEvent = (event: utils.collection.CollectionEvent<SinkIndex>) => {
            if (event.type == "add") {
                this.addSink(event.element);
            }
            else if (event.type == "remove") {
                this.removeSink(event.element.sink.id);
            }
        };
        this.sinkIndexCollection.changeEvent.add(this.bindedEvent);
    }
    
}