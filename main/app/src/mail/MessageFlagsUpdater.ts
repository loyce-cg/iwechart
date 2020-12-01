import * as privfs from "privfs-client";
import {MessageTagsFactory} from "./MessageTagsFactory";
import * as Q from "q";
import {mail} from "../Types";
import { SinkIndexEntry } from "./SinkIndexEntry";
import { SinkIndex } from "./SinkIndex";
import { PromiseUtils } from "simplito-promise";
import { SinkIndexManager } from "./SinkIndexManager";

export class MessageFlagsUpdater {
    
    constructor(
        public identity: privfs.identity.Identity,
        public messageTagsFactory: MessageTagsFactory,
        public tagService: privfs.message.TagService,
        public sinkIndexProvider: mail.SinkIndexProvider,
        public sinkIndexManager: SinkIndexManager
    ) {
    }
    
    updateMessageFlagsEx(handler: mail.MessageHandler, fn: (data: mail.Flags) => mail.Flags|false): Q.Promise<void> {
        return Q().then(() => {
            let index = this.sinkIndexProvider.getSinkIndexById(handler.sink.id);
            if (index == null) {
                throw new Error("Index not found");
            }
            return index.updateEntry(handler.id, (data, tags, entry) => {
                return Q().then(() => {
                    return fn(data);
                })
                .then((result): Q.IWhenable<false|{data: mail.Flags, tags: string[]}> => {
                    if (result == false) {
                        return false;
                    }
                    return (entry.index.autoCorrectTags ? this.messageTagsFactory.getAllTagsForSinkIndex(entry).then(tags => {
                        return this.tagService.createTags(this.identity.pub, tags);
                    }) : Q(tags))
                    .then(tags => {
                        return {
                            data: result,
                            tags: tags
                        };
                    });
                });
            });
        });
    }
    
    updateMessageFlag(handler: mail.MessageHandler, name: string, value: any): Q.Promise<void> {
        return this.updateMessageFlagsEx(handler, data => {
            data = data || {};
            if (data[name] === value) {
                return false;
            }
            data[name] = value;
            return data;
        });
    }
    
    updateMessageFlags(handler: mail.MessageHandler, flags: {name: string, value: any}[]): Q.Promise<void> {
        return this.updateMessageFlagsEx(handler, data => {
            data = data || {};
            let changed = false;
            for (let i = 0; i < flags.length; i++) {
                if (data[flags[i].name] !== flags[i].value) {
                    data[flags[i].name] = flags[i].value;
                    changed = true;
                }
            }
            return changed ? data : false;
        });
    }
    
    setMessageReadStatus(handler: mail.MessageHandler, read: boolean): Q.Promise<void> {
        return this.updateMessageFlag(handler, "read", read);
    }
    
    setMessagesReadStatus(entries: SinkIndexEntry[], read: boolean): Q.Promise<void> {
        return Q().then(() => {
            let indexMap: {[sid: string]: {index: SinkIndex, maxId: number, entries: SinkIndexEntry[]}} = {};
            for (var i in entries) {
                let entry = entries[i];
                if (entry.isRead() == read) {
                    continue;
                }
                let indexId = entry.index.sink.id;
                if (!(indexId in indexMap)) {
                    indexMap[indexId] = {
                        index: entry.index,
                        maxId: entry.id,
                        entries: []
                    };
                }
                indexMap[indexId].entries.push(entry);
                indexMap[indexId].maxId = Math.max(indexMap[indexId].maxId, entry.id);
            }
            this.sinkIndexManager.holdChangeEventDeep();
            return PromiseUtils.oneByOne(indexMap, (_i, ie) => {
                ie.index.holdChangeEvent();
                ie.index.updateReadIndex(ie.maxId);
                return PromiseUtils.oneByOne(ie.entries, (_i, indexEntry) => {
                    return this.setMessageReadStatus(indexEntry, read);
                })
                .fin(() => {
                    ie.index.releaseChangeEvent();
                });
            })
            .fin(() => {
                this.sinkIndexManager.releaseChangeEventDeep();
            });
        });
    }
}