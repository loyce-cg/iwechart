import {Person} from "../person/Person";
import {SinkIndexEntry} from "../SinkIndexEntry";
import {mail} from "../../Types";

export class Conversation {
    
    id: string;
    persons: Person[];
    predefined: boolean;
    entries: SinkIndexEntry[];
    stats: mail.UnreadStatsWithByType;
    lastEntry: SinkIndexEntry;
    
    constructor(id: string, persons: Person[], predefined: boolean) {
        this.id = id;
        this.persons = persons;
        this.predefined = predefined;
        this.entries = [];
        this.stats = {
            unread: 0,
            byType: {}
        };
    }
    
    static create(id: string, personGetter: (hashmail: string) => Person, predefined: boolean): Conversation {
        let hashmails = id.split(",");
        let list = [];
        for (let i = 0; i < hashmails.length; i++) {
            list.push(personGetter(hashmails[i]));
        }
        return new Conversation(id, list, predefined);
    }
    
    add(entry: SinkIndexEntry): void {
        this.entries.push(entry);
        if (!entry.isRead()) {
            this.stats.unread++;
            this.updateStatsByType(entry, 1);
        }
        if (this.lastEntry == null || entry.source.serverDate > this.lastEntry.source.serverDate) {
            this.lastEntry = entry;
        }
    }
    
    update(_entry: SinkIndexEntry): void {
        this.stats = {
            unread: 0,
            byType: {}
        };
        for (let i = 0; i < this.entries.length; i++) {
            if (!this.entries[i].isRead()) {
                this.stats.unread++;
                this.updateStatsByType(this.entries[i], 1);
            }
        }
    }
    
    remove(entry: SinkIndexEntry): void {
        let index = this.entries.indexOf(entry);
        if (index == -1) {
            return;
        }
        this.entries.splice(index, 1);
        if (!entry.isRead()) {
            this.stats.unread--;
            this.updateStatsByType(entry, -1);
        }
        if (entry == this.lastEntry) {
            this.lastEntry = null;
            for (let i = 0; i < this.entries.length; i++) {
                if (this.lastEntry == null || this.entries[i].source.serverDate > this.lastEntry.source.serverDate) {
                    this.lastEntry = this.entries[i];
                }
            }
        }
    }
    
    getLastTime(): number {
        return this.lastEntry ? this.lastEntry.source.serverDate : 0;
    }
    
    isEmpty(): boolean {
        return this.entries.length == 0;
    }
    
    setPredefined(predefined: boolean): void {
        this.predefined = predefined;
    }
    
    isPredfined(): boolean {
        return !!this.predefined;
    }
    
    hasPerson(person: Person): boolean {
        for (let i = 0; i < this.persons.length; i++) {
            if (this.persons[i] == person) {
                return true;
            }
        }
        return false;
    }
    
    getHashmails(): string[] {
        let hashmails = [];
        for (let i = 0; i < this.persons.length; i++) {
            hashmails.push(this.persons[i].getHashmail());
        }
        return hashmails;
    }
    
    updateStatsByType(entry: SinkIndexEntry, amount: number): void {
        let type = entry.source.data.type || "";
        if (!this.stats.byType[type]) {
            this.stats.byType[type] = {unread: amount};
        }
        else {
            this.stats.byType[type].unread += amount;
        }
    }
    
    isSingleContact(): boolean {
        return this.persons.length == 1 && this.persons[0].hasContact();
    }
    
    getFirstPerson(): Person {
        return this.persons.length == 0 ? null : this.persons[0];
    }
    
    canBeRemoved(): boolean {
        return this.isEmpty() && !this.isPredfined() && !this.isSingleContact();
    }
}

