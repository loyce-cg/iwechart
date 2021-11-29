"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var ChatMessage = (function () {
    function ChatMessage() {
    }
    ChatMessage.isChatMessage = function (sinkIndexEntry) {
        return sinkIndexEntry.source.data.type == pmc_mail_1.mail.section.ChatModuleService.CHAT_MESSAGE_TYPE;
    };
    return ChatMessage;
}());
exports.ChatMessage = ChatMessage;
ChatMessage.prototype.className = "com.privmx.plugin.chat.main.ChatMessage";

//# sourceMappingURL=ChatMessage.js.map
