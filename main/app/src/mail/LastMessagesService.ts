import * as Q from "q";
import {SinkIndexManager} from "./SinkIndexManager";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {PromiseUtils} from "simplito-promise";
import {Utils} from "../utils/Utils";
import {CollectionFactory} from "./CollectionFactory";

export class LastMessagesService {
    
    constructor(
        public sinkIndexManager: SinkIndexManager,
        public collectionFactory: CollectionFactory
    ) {
    }
    
    deleteMessages(count: number): Q.Promise<void> {
        return Q().then(() => {
            this.sinkIndexManager.holdChangeEventDeep();
            return this.getTheOldestMessages(count);
        })
        .then(list => {
            return PromiseUtils.oneByOne(list, (_i, entry) => {
                return entry.index.deleteEntry(entry.id);
            });
        })
        .fin(() => {
            this.sinkIndexManager.releaseChangeEventDeep();
        });
    }
    
    getLastMessageByType(hashmail: string, type: string|string[], compareWithSender?: boolean): SinkIndexEntry {
        let types = Array.isArray(type) ? type : [type];
        let messages = this.collectionFactory.getMessagesByConversationId(hashmail);
        let lastEntry: SinkIndexEntry;
        messages.forEach(entry => {
            if ((!lastEntry) || (entry.source.serverDate > lastEntry.source.serverDate)) {
                let type = entry.source.data.type || "";
                if (types.indexOf(type) !== -1) {
                    if ((!compareWithSender) || (compareWithSender && entry.source.data.sender.hashmail == hashmail)) {
                        lastEntry = entry;
                    }
                }
            }
        });
        return lastEntry;
    }
    
    getLastMailMessage(hashmail: string, compareWithSender?: boolean): SinkIndexEntry {
        return this.getLastMessageByType(hashmail, ["", "pki-event"], compareWithSender);
    }
    
    countMessagesByType(hashmail: string, onlyReceived?: boolean): {[type: string]: number} {
        let messages = this.collectionFactory.getMessagesByConversationId(hashmail);
        let result: {[type: string]: number} = {};
        messages.forEach(entry => {
            let type = entry.source.data.type || "";
            if ((!onlyReceived) || (onlyReceived && entry.source.data.sender.hashmail == hashmail)) {
                result[type] = result[type] ? result[type] + 1 : 1;
            }
        });
        return result;
    }
    
    getTheOldestMessages(count: number): Q.Promise<SinkIndexEntry[]> {
        return Q().then(() => {
            let lists: {i: number, list: SinkIndexEntry[]}[] = [];
            let indexes = this.sinkIndexManager.indexes.getEnumerable();
            for (var i in indexes) {
                lists.push({
                    i: 0,
                    list: indexes[i].entries.getEnumerable()
                });
            }
            let result: SinkIndexEntry[] = [];
            for (let i = 0; i < count; i++) {
                let msg = null;
                let lc = null;
                for (let j = 0; j < lists.length; j++) {
                    let l = lists[j];
                    if (l.i >= l.list.length) {
                        continue;
                    }
                    let m = l.list[l.i];
                    if (msg == null || m.source.serverDate < msg.source.serverDate) {
                        msg = m;
                        lc = l;
                    }
                }
                if (msg == null) {
                    break;
                }
                lc.i++;
                result.push(msg);
            }
            return result;
        });
    }
    
    getSizeOfTheOldestMessages(count: number): Q.Promise<number> {
        return Q().then(() => {
            return this.getTheOldestMessages(count);
        })
        .then(list => {
            let size = 0;
            list.forEach(entry => {
                size += Utils.getStringUtf8Length(JSON.stringify(entry.source));
                if (entry.source.data && entry.source.data.attachments) {
                    entry.source.data.attachments.forEach(a => {
                        size += a.size;
                    });
                }
            });
            return size;
        });
    }
}