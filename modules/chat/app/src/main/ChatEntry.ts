import {mail} from "pmc-mail";

export class ChatEntry {
    
    conversationId: string;
    entries: mail.SinkIndexEntry[];
    unreadCount: number;
    lastEntry: mail.SinkIndexEntry;
    formatter: mail.SinkIndexEntryFormatter
    
    constructor(conversationId: string, formatter: mail.SinkIndexEntryFormatter) {
        this.conversationId = conversationId;
        this.formatter = formatter
        this.entries = [];
        this.unreadCount = 0;
        this.lastEntry = null;
    }
    
    format(key: string): any {
        return this.formatter.format(this.lastEntry.source, key);
    }
    
    getEntryId(): string {
        return this.conversationId;
    }
    
    getEntryType(): string {
        return "chat";
    }
    
    add(entry: mail.SinkIndexEntry): void {
        this.entries.push(entry);
        if (this.lastEntry == null || (entry.source.serverDate > this.lastEntry.source.serverDate)) {
            this.lastEntry = entry;
        }
        this.unreadCount += entry.isRead() ? 0 : 1;
    }
    
    update(entry: mail.SinkIndexEntry): void {
        this.unreadCount = 0;
        for (let i = 0; i < this.entries.length; i++) {
            this.unreadCount += this.entries[i].isRead() ? 0 : 1;
        }
    }
    
    remove(entry: mail.SinkIndexEntry): void {
        let index = this.entries.indexOf(entry);
        if (index == -1) {
            return;
        }
        this.entries.splice(index, 1);
        if (this.lastEntry == entry) {
            this.lastEntry = null;
            for (let i = 0; i < this.entries.length; i++) {
                let entry = this.entries[i];
                if (this.lastEntry == null || (entry.source.serverDate > this.lastEntry.source.serverDate)) {
                    this.lastEntry = entry;
                }
            }
        }
        this.unreadCount -= entry.isRead() ? 0 : 1;
    }
    
    isEmpty(): boolean {
        return this.entries.length == 0;
    }
}

