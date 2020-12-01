import {mail, utils, Types} from "pmc-mail";
import {ChatEntry} from "./ChatEntry";
import {ChatMessage} from "./ChatMessage";

export class ChatsCollection {
    
    map: {[conversationId: string]: ChatEntry};
    collection: utils.collection.MutableCollection<ChatEntry>;
    bindedProcessEvent: Types.utils.collection.CollectionEventCallback<mail.SinkIndexEntry>;
    formatter: mail.SinkIndexEntryFormatter;
    
    constructor(
        public personService: mail.person.PersonService,
        public conversationService: mail.conversation.ConversationService,
        public sourceCollection: utils.collection.BaseCollection<mail.SinkIndexEntry>
    ) {
        this.formatter = new mail.SinkIndexEntryFormatter(personService);
        this.map = {};
        let messages: ChatEntry[] = [];
        this.sourceCollection.forEach(entry => {
            if (ChatMessage.isChatMessage(entry)) {
                let convId = this.conversationService.getConversationId(entry);
                let chat = this.map[convId];
                if (chat == null) {
                    chat = new ChatEntry(convId, this.formatter);
                    this.map[convId] = chat;
                    messages.push(chat);
                }
                chat.add(entry);
            }
        });
        this.collection = new utils.collection.MutableCollection(messages);
        this.bindedProcessEvent = this.processEvent.bind(this);
        this.sourceCollection.changeEvent.add(this.processEvents.bind(this), "multi");
    }
    
    getCollection(): utils.collection.BaseCollection<ChatEntry> {
        return this.collection;
    }
    
    processEvents(events: Types.utils.collection.CollectionEventArgs<mail.SinkIndexEntry>[]): void {
        this.collection.changeEvent.hold();
        utils.Event.applyEvents(events, this.bindedProcessEvent);
        this.collection.reductEvents();
        this.collection.changeEvent.release();
    }
    
    processEvent(event: Types.utils.collection.CollectionEvent<mail.SinkIndexEntry>): void {
        if (event.type == "add" || event.type == "remove" || event.type == "update") {
            let entry = event.element;
            if (ChatMessage.isChatMessage(entry)) {
                let convId = this.conversationService.getConversationId(entry);
                let chat = this.map[convId];
                if (chat == null) {
                    if (event.type == "add") {
                        chat = new ChatEntry(convId, this.formatter);
                        chat.add(entry);
                        this.map[convId] = chat;
                        this.collection.add(chat);
                    }
                }
                else {
                    if (event.type == "add") {
                        chat.add(entry);
                        this.collection.updateElement(chat);
                    }
                    else if (event.type == "remove") {
                        chat.remove(entry);
                        if (chat.isEmpty()) {
                            delete this.map[convId];
                            this.collection.remove(chat);
                        }
                        else {
                            this.collection.updateElement(chat);
                        }
                    }
                    else if (event.type == "update") {
                        chat.update(entry);
                        this.collection.updateElement(chat);
                    }
                }
            }
        }
        else if (event.type == "clear") {
            this.collection.clear();
        }
    }
}
