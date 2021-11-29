"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ChatEntry = (function () {
    function ChatEntry(conversationId, formatter) {
        this.conversationId = conversationId;
        this.formatter = formatter;
        this.entries = [];
        this.unreadCount = 0;
        this.lastEntry = null;
    }
    ChatEntry.prototype.format = function (key) {
        return this.formatter.format(this.lastEntry.source, key);
    };
    ChatEntry.prototype.getEntryId = function () {
        return this.conversationId;
    };
    ChatEntry.prototype.getEntryType = function () {
        return "chat";
    };
    ChatEntry.prototype.add = function (entry) {
        this.entries.push(entry);
        if (this.lastEntry == null || (entry.source.serverDate > this.lastEntry.source.serverDate)) {
            this.lastEntry = entry;
        }
        this.unreadCount += entry.isRead() ? 0 : 1;
    };
    ChatEntry.prototype.update = function (entry) {
        this.unreadCount = 0;
        for (var i = 0; i < this.entries.length; i++) {
            this.unreadCount += this.entries[i].isRead() ? 0 : 1;
        }
    };
    ChatEntry.prototype.remove = function (entry) {
        var index = this.entries.indexOf(entry);
        if (index == -1) {
            return;
        }
        this.entries.splice(index, 1);
        if (this.lastEntry == entry) {
            this.lastEntry = null;
            for (var i = 0; i < this.entries.length; i++) {
                var entry_1 = this.entries[i];
                if (this.lastEntry == null || (entry_1.source.serverDate > this.lastEntry.source.serverDate)) {
                    this.lastEntry = entry_1;
                }
            }
        }
        this.unreadCount -= entry.isRead() ? 0 : 1;
    };
    ChatEntry.prototype.isEmpty = function () {
        return this.entries.length == 0;
    };
    return ChatEntry;
}());
exports.ChatEntry = ChatEntry;
ChatEntry.prototype.className = "com.privmx.plugin.chat.main.ChatEntry";

//# sourceMappingURL=ChatEntry.js.map
