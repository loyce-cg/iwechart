import { BaseCollection } from "../utils/collection/BaseCollection";
import { SinkIndexEntry } from "./SinkIndexEntry";
import { MailFilterCollection } from "./MailFilterCollection";
import * as RootLogger from "simplito-logger";
import { FilteredCollection } from "../utils/collection/FilteredCollection";
import { Map } from "../utils/Map";
import { MutableCollection } from "../utils/collection/MutableCollection";
import * as privfs from "privfs-client";
import { ConversationService } from "./conversation/ConversationService";
import { mail } from "../Types";
let Logger = RootLogger.get("privfs-mail-client.mail.CollectionFactory");

export class CollectionFactory {
    
    messageCollectionsByHashmail: Map<FilteredCollection<SinkIndexEntry>>;
    attachmentsCollectionMap: {[sinkId: string]: MutableCollection<mail.AttachmentEntry>}; //jej inicjacja potrzebuje sinkIndexManager
    
    constructor(
        public mailFilterCollection: MailFilterCollection,
        public conversationService: ConversationService
    ) {
        this.messageCollectionsByHashmail = new Map<FilteredCollection<SinkIndexEntry>>();
        this.attachmentsCollectionMap = {};
    }
    
    destroy() {
        this.mailFilterCollection.messagesCollection.destroy();
        this.messageCollectionsByHashmail.forEach(x => {
            x.destroy();
        });
        for (let sinkId in this.attachmentsCollectionMap) {
            this.attachmentsCollectionMap[sinkId].destroy();
        }
    }
    
    getMessagesCollection(): BaseCollection<SinkIndexEntry> {
        return this.mailFilterCollection.messagesCollection;
    }
    
    getMessagesCollectionBySid(sid: string): BaseCollection<SinkIndexEntry> {
        return this.mailFilterCollection.getCollection(sid);
    }
    
    getMessagesByConversationId(conversationId: string): BaseCollection<SinkIndexEntry> {
        Logger.debug("getMessagesByConversationId", conversationId);
        if (this.messageCollectionsByHashmail.has(conversationId)) {
            return this.messageCollectionsByHashmail.get(conversationId);
        }
        let collection = new FilteredCollection(this.getMessagesCollection(), entry => {
            return entry.index.sink.extra.type != "trash" && conversationId == this.conversationService.getConversationId(entry);
        });
        this.messageCollectionsByHashmail.put(conversationId, collection);
        return collection;
    }
    
    getAttachmentsCollectionByBaseCollection(id: string, entries: BaseCollection<SinkIndexEntry>): MutableCollection<mail.AttachmentEntry> {
        if (this.attachmentsCollectionMap[id] == null) {
            let filteredEntries = entries;
            let messagesFromInboxWithAttachments = new FilteredCollection(filteredEntries, entry => {
                return entry.source.data != null && entry.source.data.attachments != null && entry.source.data.attachments.length > 0;
            });
            let createAttachmentEntry = (entry: SinkIndexEntry, attachment: privfs.message.MessageAttachment, i: number): mail.AttachmentEntry => {
                return {
                    entry: entry,
                    attachment: attachment,
                    index: i,
                    id: entry.sink.id + "/" + entry.source.serverId + "/" + i
                };
            };
            let attachments: mail.AttachmentEntry[] = [];
            messagesFromInboxWithAttachments.forEach(entry => {
                entry.getMessage().attachments.forEach((attachment, i) => {
                    attachments.push(createAttachmentEntry(entry, attachment, i));
                });
            });
            let collection = new MutableCollection(attachments);
            messagesFromInboxWithAttachments.changeEvent.add((event) => {
                if (event.type == "add") {
                    event.element.getMessage().attachments.forEach((attachment, i) => {
                        collection.add(createAttachmentEntry(event.element, attachment, i));
                    });
                }
                else if (event.type == "remove") {
                    collection.removeBy("entry", event.element);
                }
                else if (event.type == "clear") {
                    collection.clear();
                }
            });
            this.attachmentsCollectionMap[id] = collection;
        }
        return this.attachmentsCollectionMap[id];
    }
    
    getAttachmentsCollection(sink: privfs.message.MessageSinkPriv): MutableCollection<mail.AttachmentEntry> {
        return this.getAttachmentsCollectionByBaseCollection(sink.id, this.getMessagesCollectionBySid(sink.id));
    }
}