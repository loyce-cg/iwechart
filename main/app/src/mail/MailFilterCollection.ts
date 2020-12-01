import {SinkIndex} from "./SinkIndex";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {FilteredCollection} from "../utils/collection/FilteredCollection";
import {MergedCollection} from "../utils/collection/MergedCollection";
import {BaseCollection} from "../utils/collection/BaseCollection";
import {MailFilter} from "./MailFilter";
import { SinkIndexManager } from "./SinkIndexManager";

export class MailFilterCollection {
    
    map: {[sid: string]: {index: SinkIndex, filteredEntries: FilteredCollection<SinkIndexEntry>}};
    messagesCollection: MergedCollection<SinkIndexEntry>;
    
    constructor(
        public mailFilter: MailFilter,
        public sinkIndexManager: SinkIndexManager
    ) {
        this.map = {};
        this.messagesCollection = new MergedCollection();
        this.bindWithCollection(this.sinkIndexManager.sinkIndexCollection);
    }
    
    getCollection(sid: string) {
        return sid in this.map ? this.map[sid].filteredEntries : null;
    }
    
    addSink(sinkIndex: SinkIndex) {
        let filteredEntries = this.mailFilter.registerCollection(sinkIndex.entries);
        this.messagesCollection.addCollection(filteredEntries);
        this.map[sinkIndex.sink.id] = {
            index: sinkIndex,
            filteredEntries: filteredEntries
        };
    }
    
    removeSink(sid: string) {
        if (sid in this.map) {
            let entry = this.map[sid];
            delete this.map[sid];
            this.messagesCollection.removeCollection(entry.filteredEntries);
        }
    }
    
    bindWithCollection(collection: BaseCollection<SinkIndex>) {
        collection.forEach(x => {
            this.addSink(x);
        });
        collection.changeEvent.add(event => {
            if (event.type == "add") {
                this.addSink(event.element);
            }
            else if (event.type == "remove") {
                this.removeSink(event.element.sink.id);
            }
        })
    }
}