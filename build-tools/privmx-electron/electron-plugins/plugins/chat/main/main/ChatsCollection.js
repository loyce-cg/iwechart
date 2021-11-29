"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var ChatEntry_1 = require("./ChatEntry");
var ChatMessage_1 = require("./ChatMessage");
var ChatsCollection = (function () {
    function ChatsCollection(personService, conversationService, sourceCollection) {
        var _this = this;
        this.personService = personService;
        this.conversationService = conversationService;
        this.sourceCollection = sourceCollection;
        this.formatter = new pmc_mail_1.mail.SinkIndexEntryFormatter(personService);
        this.map = {};
        var messages = [];
        this.sourceCollection.forEach(function (entry) {
            if (ChatMessage_1.ChatMessage.isChatMessage(entry)) {
                var convId = _this.conversationService.getConversationId(entry);
                var chat = _this.map[convId];
                if (chat == null) {
                    chat = new ChatEntry_1.ChatEntry(convId, _this.formatter);
                    _this.map[convId] = chat;
                    messages.push(chat);
                }
                chat.add(entry);
            }
        });
        this.collection = new pmc_mail_1.utils.collection.MutableCollection(messages);
        this.bindedProcessEvent = this.processEvent.bind(this);
        this.sourceCollection.changeEvent.add(this.processEvents.bind(this), "multi");
    }
    ChatsCollection.prototype.getCollection = function () {
        return this.collection;
    };
    ChatsCollection.prototype.processEvents = function (events) {
        this.collection.changeEvent.hold();
        pmc_mail_1.utils.Event.applyEvents(events, this.bindedProcessEvent);
        this.collection.reductEvents();
        this.collection.changeEvent.release();
    };
    ChatsCollection.prototype.processEvent = function (event) {
        if (event.type == "add" || event.type == "remove" || event.type == "update") {
            var entry = event.element;
            if (ChatMessage_1.ChatMessage.isChatMessage(entry)) {
                var convId = this.conversationService.getConversationId(entry);
                var chat = this.map[convId];
                if (chat == null) {
                    if (event.type == "add") {
                        chat = new ChatEntry_1.ChatEntry(convId, this.formatter);
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
    };
    return ChatsCollection;
}());
exports.ChatsCollection = ChatsCollection;
ChatsCollection.prototype.className = "com.privmx.plugin.chat.main.ChatsCollection";

//# sourceMappingURL=ChatsCollection.js.map
