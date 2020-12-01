import {ConversationId} from "./ConversationId";
import {Conversation} from "./Conversation";
import {SinkIndexEntry} from "../SinkIndexEntry";
import {ConversationsCollection} from "./ConversationsCollection";
import {BaseCollection } from "../../utils/collection/BaseCollection";
import * as privfs from "privfs-client";
import {FilteredCollection} from "../../utils/collection/FilteredCollection";
import {ContactService} from "../contact/ContactService";
import { PersonService } from "../person/PersonService";

export class ConversationService {
    
    conversationCollection: ConversationsCollection;
    
    constructor(
        public identity: privfs.identity.Identity,
        public contactService: ContactService,
        public personService: PersonService,
        public messagesCollection: BaseCollection<SinkIndexEntry>
    ) {
        let collection = new FilteredCollection(this.messagesCollection, entry => {
            return entry.index.sink.extra.type != "trash";
        });
        this.conversationCollection = new ConversationsCollection(this, this.contactService, collection, this.personService);
    }
    
    getOrCreateConversation(hashmails: string[]): Conversation {
        let convId = ConversationId.createFromHashmails(hashmails).toString();
        let conversation = this.getConversation(convId);
        return conversation ? conversation : this.addPredefinedConversation(convId);
    }
    
    getConversationId(indexEntry: SinkIndexEntry): string {
        let convId = ConversationId.createFromIndexEntry(indexEntry);
        if (convId.length() != 1 || !convId.contains(this.identity.hashmail)) {
            convId.remove(this.identity.hashmail);
        }
        return convId.toString();
    }
    
    getConversationCollection(): BaseCollection<Conversation> {
        return this.conversationCollection.getCollection();
    }
    
    addPredefinedConversation(conversationId: string): Conversation {
        return this.conversationCollection.addPredefined(conversationId);
    }
    
    getConversation(conversationId: string): Conversation {
        return this.conversationCollection.getConversation(conversationId);
    }
    
    hasConversation(conversationId: string): boolean {
        return this.conversationCollection.hasConversation(conversationId);
    }
}