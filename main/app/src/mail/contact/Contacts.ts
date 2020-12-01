import {MutableCollection} from "../../utils/collection/MutableCollection";
import {Contact, SerializedContact} from "./Contact";
import {KvdbMap} from "../kvdb/KvdbMap";
import * as Q from "q";

export class Contacts {
    
    constructor(
        public contactCollection: MutableCollection<Contact>,
        public kvdb: KvdbMap<SerializedContact>
    ) {
        this.synchronize();
    }
    
    set(hashmail: string, updater?: (contact: Contact, newlyCreated: boolean) => any): Q.Promise<Contact> {
        let contact = this.contactCollection.find(x => x.getHashmail() == hashmail);
        let toAdd = contact == null;
        if (toAdd) {
            contact = new Contact();
        }
        
        let currentContactVersion = contact.dataVersion;
        if (updater && updater(contact, toAdd) === false) {
            return Q(contact);
        }
        
        let update = false;
        if (toAdd) {
            this.contactCollection.add(contact);
            contact.dataVersion = (new Date()).getTime();
            update = true;
        }
        else {
            if (currentContactVersion < contact.dataVersion) {
                this.contactCollection.updateElement(contact);
                update = true;
            }
        }
        if (update) {
            return this.kvdb.set(hashmail, contact.serialize()).thenResolve(contact);
        }
        return Q(contact);
    }
    
    remove(contact: Contact): Q.Promise<void> {
        // info o remove do synchronizacji
        this.contactCollection.remove(contact);
        return this.kvdb.remove(contact.getHashmail());
    }
    
    getMostCurrentContact(a: Contact, b: Contact): Contact {
        return a.dataVersion > b.dataVersion ? a : b;
    }
    
    synchronize(): void {
        let readContacts = Contact.deserializeMany(this.kvdb.getValues());
        let synchronized: Contact[] = [];
        this.contactCollection.forEach(contact => {
            let found = false;
            readContacts.forEach(contactFromFile => {
                if (contact.getHashmail() == contactFromFile.getHashmail()) {
                    synchronized.push(contact.dataVersion > contactFromFile.dataVersion && !contact.toRemove ? contact : contactFromFile);
                    found = true;
                }
            });
            if (!found && !contact.toRemove) {
                synchronized.push(contact);
            }
        });
        readContacts.forEach(x => {
            if (this.contactCollection.find(y => y.getHashmail() == x.getHashmail()) == null) {
                synchronized.push(x);
            }
        });
        this.contactCollection.rebuild(synchronized);
    }
}