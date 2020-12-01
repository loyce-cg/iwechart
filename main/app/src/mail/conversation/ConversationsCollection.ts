import {Conversation} from "./Conversation";
import {MutableCollection} from "../../utils/collection/MutableCollection";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {Event} from "../../utils/Event";
import {SinkIndexEntry} from "../SinkIndexEntry";
import {Person} from "../person/Person";
import {utils} from "../../Types";
import {ConversationService} from "./ConversationService";
import {ContactService} from "../contact/ContactService";
import {PersonService} from "../person/PersonService";

export class ConversationsCollection {
    
    map: {[conversationId: string]: Conversation};
    collection: MutableCollection<Conversation>;
    bindedProcessEvent: utils.collection.CollectionEventCallback<SinkIndexEntry>;
    
    constructor(
        public conversationService: ConversationService,
        public contactService: ContactService,
        public sourceCollection: BaseCollection<SinkIndexEntry>,
        public personService: PersonService
    ) {
        this.map = {};
        let conversations: Conversation[] = [];
        this.sourceCollection.forEach(entry => {
            let convId = this.conversationService.getConversationId(entry);
            let conv = this.map[convId];
            if (conv == null) {
                conv = Conversation.create(convId, this.personService.personsGetter, false);
                this.map[convId] = conv;
                conversations.push(conv);
            }
            conv.add(entry);
        });
        this.contactService.contactCollection.forEach(contact => {
            let convId = contact.getHashmail();
            let conv = this.map[convId];
            if (conv == null) {
                conv = Conversation.create(convId, this.personService.personsGetter, false);
                this.map[convId] = conv;
                conversations.push(conv);
            }
        });
        this.collection = new MutableCollection(conversations);
        this.bindedProcessEvent = this.processEvent.bind(this);
        this.sourceCollection.changeEvent.add(this.processEvents.bind(this), "multi");
        this.personService.persons.changeEvent.add(this.onPersonChange.bind(this));
    }
    
    getCollection(): MutableCollection<Conversation> {
        return this.collection;
    }
    
    processEvents(events: utils.collection.CollectionEventArgs<SinkIndexEntry>[]): void {
        this.collection.changeEvent.hold();
        Event.applyEvents(events, this.bindedProcessEvent);
        this.collection.reductEvents();
        this.collection.changeEvent.release();
    }
    
    processEvent(event: utils.collection.CollectionEvent<SinkIndexEntry>): void {
        if (event.type == "add" || event.type == "remove" || event.type == "update") {
            let entry = event.element;
            let convId = this.conversationService.getConversationId(entry);
            let conv = this.map[convId];
            if (conv == null) {
                if (event.type == "add") {
                    conv = Conversation.create(convId, this.personService.personsGetter, false);
                    conv.add(entry);
                    this.map[convId] = conv;
                    this.collection.add(conv);
                }
            }
            else {
                if (event.type == "add") {
                    conv.add(entry);
                    this.collection.updateElement(conv);
                }
                else if (event.type == "remove") {
                    conv.remove(entry);
                    if (conv.canBeRemoved()) {
                        delete this.map[convId];
                        this.collection.remove(conv);
                    }
                    else {
                        this.collection.updateElement(conv);
                    }
                }
                else if (event.type == "update") {
                    conv.update(entry);
                    this.collection.updateElement(conv);
                }
            }
        }
        else if (event.type == "clear") {
            this.collection.clear();
        }
    }
    
    onPersonChange(person: Person): void {
        let toRemove: Conversation[] = [];
        this.collection.forEach(conversation => {
            if (conversation.hasPerson(person)) {
                if (conversation.canBeRemoved()) {
                    toRemove.push(conversation);
                }
                else {
                    this.collection.updateElement(conversation);
                }
            }
        });
        for (let i = 0; i < toRemove.length; i++) {
            delete this.map[toRemove[i].id];
            this.collection.remove(toRemove[i]);
        }
        if (person.hasContact() && !(person.getHashmail() in this.map)) {
            let conv = Conversation.create(person.getHashmail(), this.personService.personsGetter, false);
            this.map[person.getHashmail()] = conv;
            this.collection.add(conv);
        }
    }
    
    addPredefined(conversationId: string): Conversation {
        let conv = this.map[conversationId];
        if (conv == null) {
            conv = Conversation.create(conversationId, this.personService.personsGetter, true);
            this.map[conversationId] = conv;
            this.collection.add(conv);
        }
        else {
            conv.setPredefined(true);
        }
        return conv;
    }
    
    getConversation(conversationId: string): Conversation {
        return this.map[conversationId];
    }
    
    hasConversation(conversationId: string): boolean {
        return conversationId in this.map;
    }
}

