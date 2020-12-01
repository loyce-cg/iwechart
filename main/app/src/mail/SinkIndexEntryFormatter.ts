import {mail, privfs} from "../build/core";

export interface PersonGetter {
    getPerson(hashmail: string): mail.person.Person;
}

export class SinkIndexEntryFormatter {
    
    formattersMap: {[key: string]: (source: privfs.types.message.SerializedMessageFull) => any};
    
    constructor(public personGetter: PersonGetter) {
        this.formattersMap = {
            receivers: source => {
                return source.data.receivers.map(r => {
                    return this.personGetter.getPerson(r.hashmail).getName();
                }).join(", ");
            },
            sender: source => {
                return this.personGetter.getPerson(source.data.sender.hashmail).getName();
            },
            date: source => {
                return source.serverDate;
            },
            attachment: source => {
                return source.data.attachments.length > 0;
            }
        };
    }
    
    format(source: privfs.types.message.SerializedMessageFull, key: string): any {
        if (key in this.formattersMap) {
            return this.formattersMap[key](source);
        }
        return (<any>source.data)[key];
    }
}