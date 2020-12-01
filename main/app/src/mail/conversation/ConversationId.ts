import {SinkIndexEntry} from "../SinkIndexEntry";
import * as privfs from "privfs-client";

export class ConversationId {
    
    hashmails: string[];
    
    constructor(hashmails?: string[]) {
        this.hashmails = hashmails || [];
    }
    
    add(hashmail: string) {
        if (this.hashmails.indexOf(hashmail) == -1) {
            this.hashmails.push(hashmail);
        }
    }
    
    remove(hashmail: string) {
        let index = this.hashmails.indexOf(hashmail);
        if (index != -1) {
            this.hashmails.splice(index, 1);
        }
    }
    
    length(): number {
        return this.hashmails.length;
    }
    
    contains(hashmail: string): boolean {
        return this.hashmails.indexOf(hashmail) != -1;
    }
    
    toString(): string {
        this.hashmails.sort();
        return this.hashmails.join(",");
    }
    
    static parse(cId: string): ConversationId {
        return new ConversationId(cId.split(","));
    }
    
    static createFromIndexEntry(indexEntry: SinkIndexEntry): ConversationId {
        return ConversationId.createFromSource(indexEntry.source);
    }
    
    static createFromSource(source: privfs.types.message.SerializedMessageFull): ConversationId {
        let convId = new ConversationId();
        let receivers = source.data.receivers;
        for (let i = 0; i < receivers.length; i++) {
            convId.add(receivers[i].hashmail);
        }
        convId.add(source.data.sender.hashmail);
        return convId;
    }
    
    static createFromMessage(msg: privfs.types.message.Message): ConversationId {
        let convId = new ConversationId();
        let receivers = msg.receivers;
        for (let i = 0; i < receivers.length; i++) {
            convId.add(receivers[i].user.hashmail);
        }
        convId.add(msg.sender.hashmail);
        return convId;
    }
    
    static createFromHashmails(hashmails: string[]): ConversationId {
        return new ConversationId(hashmails);
    }
}

