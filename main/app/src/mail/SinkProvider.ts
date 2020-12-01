import * as privfs from "privfs-client";
import {SinkIndexManager} from "./SinkIndexManager";
import * as Q from "q";
import {mail} from "../Types";

export class SinkProvider implements mail.SinkProvider {
    
    sinks: privfs.message.MessageSinkPriv[];
    
    constructor(
        public sinkIndexManager: SinkIndexManager
    ) {
    }
    
    getTrash(): privfs.message.MessageSinkPriv {
        return this.findFirstSinkByType("trash");
    }
    
    getAllSecureFormInboxes(): privfs.message.MessageSinkPriv[] {
        let sinks = this.sinkIndexManager.getAllSinks();
        return sinks.filter(sink => {
            return sink.acl == "anonymous" && sink.extra.type == "form";
        });
    }
    
    waitForInit(): Q.Promise<void> {
        return this.sinkIndexManager.waitForInit();
    }
    
    getInboxes(): privfs.message.MessageSinkPriv[] {
        let inboxes: privfs.message.MessageSinkPriv[] = [];
        this.sinkIndexManager.getAllSinks().forEach(sink => {
            if (sink.extra.type == "inbox" && !sink.extra.isPrivate) {
                inboxes.push(sink);
            }
        });
        return inboxes;
    }
    
    getOutbox(): privfs.message.MessageSinkPriv {
        return this.findFirstSinkByType("outbox");
    }
    
    findFirstPublicInbox(): privfs.message.MessageSinkPriv {
        return this.findFirstSinkByType("inbox", "public");
    }
    
    findFirstSinkByType(type: string, acl?: string): privfs.message.MessageSinkPriv {
        let sinks = this.sinks || this.sinkIndexManager.getAllSinks();
        for (let i = 0; i < sinks.length; i++) {
            let sink = sinks[i];
            if (sink.extra.type == type && (acl == null || acl == sink.acl)) {
                return sink;
            }
        }
        return null;
    }
}