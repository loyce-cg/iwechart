"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var SendingQueue = (function () {
    function SendingQueue(processingFunc, freezeFunc, unfreezeFunc) {
        this.messagesMap = {};
        this.processingFunc = processingFunc;
        this.freezeFunc = freezeFunc;
        this.unfreezeFunc = unfreezeFunc;
    }
    SendingQueue.prototype.add = function (text) {
        var _this = this;
        var id = ++SendingQueue.msgId;
        this.messagesMap[id] = { id: id, text: text, msgId: null, processing: false, sent: false, sendingError: false };
        this.processDelay().then(function () { return _this.process(); });
        return id;
    };
    SendingQueue.prototype.delete = function (id) {
        if (id in this.messagesMap) {
            delete this.messagesMap[id];
        }
    };
    SendingQueue.prototype.deleteIfSent = function (id) {
        if (id in this.messagesMap && !this.messagesMap[id].sendingError) {
            delete this.messagesMap[id];
        }
    };
    SendingQueue.prototype.getFirstToProcess = function () {
        var msg;
        for (var id in this.messagesMap) {
            if (!this.isMessageProcessing(Number(id))) {
                msg = this.messagesMap[id];
                break;
            }
        }
        return msg;
    };
    SendingQueue.prototype.processDelay = function () {
        return pmc_mail_1.Q.Promise(function (resolve) {
            setTimeout(function () { return resolve(); }, 10);
        });
    };
    SendingQueue.prototype.process = function () {
        var _this = this;
        this.freezeFunc();
        return pmc_mail_1.Q().then(function () {
            var first = _this.getFirstToProcess();
            if (first) {
                return _this.processMessage(first)
                    .then(function () {
                    var next = _this.getFirstToProcess();
                    if (next) {
                        return _this.process();
                    }
                    else {
                        _this.unfreezeFunc();
                    }
                });
            }
            else {
                _this.unfreezeFunc();
            }
        });
    };
    SendingQueue.prototype.processMessage = function (msg) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.messagesMap[msg.id].processing = true;
            _this.messagesMap[msg.id].sendingError = false;
            return _this.processingFunc(msg.text, msg.id);
        })
            .then(function () {
            _this.deleteIfSent(msg.id);
        })
            .catch(function (e) {
            return _this.process();
        });
    };
    SendingQueue.prototype.get = function (id) {
        if (id in this.messagesMap) {
            return this.messagesMap[id];
        }
        return null;
    };
    SendingQueue.prototype.updateMessageId = function (id, msgId) {
        this.messagesMap[id].msgId = msgId;
    };
    SendingQueue.prototype.isMessageProcessing = function (id) {
        if (id in this.messagesMap) {
            return this.messagesMap[id].processing;
        }
        return false;
    };
    SendingQueue.prototype.isMessageSent = function (id) {
        if (id in this.messagesMap) {
            return this.messagesMap[id].sent;
        }
        return true;
    };
    SendingQueue.prototype.isMessageSending = function (id) {
        return this.isMessageProcessing(id) && !this.isMessageSent(id);
    };
    SendingQueue.prototype.resend = function (id) {
        this.messagesMap[id].processing = false;
        this.messagesMap[id].sendingError = true;
    };
    SendingQueue.prototype.messageToString = function (msg) {
        return "id: " + msg.id + " / text: " + msg.text;
    };
    SendingQueue.msgId = 0;
    return SendingQueue;
}());
exports.SendingQueue = SendingQueue;
SendingQueue.prototype.className = "com.privmx.plugin.chat.component.chatmessages.SendingQueue";

//# sourceMappingURL=SendingQueue.js.map
