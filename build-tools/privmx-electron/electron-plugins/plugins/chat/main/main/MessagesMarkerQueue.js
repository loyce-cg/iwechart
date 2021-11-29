"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var MessagesMarkerQueue = (function () {
    function MessagesMarkerQueue(messageFlagsUpdater, logErrorCallback) {
        this.messageFlagsUpdater = messageFlagsUpdater;
        this.logErrorCallback = logErrorCallback;
        this.entries = [];
    }
    MessagesMarkerQueue.prototype.add = function (messages, delay) {
        var def = pmc_mail_1.Q.defer();
        this.entries.push({
            messages: messages,
            time: new Date().getTime() + delay,
            markedDeferred: def,
        });
        if (!this.timeoutId) {
            this.timeoutId = setTimeout(this.onTime.bind(this), delay);
        }
        return def.promise;
    };
    MessagesMarkerQueue.prototype.onTime = function () {
        var _this = this;
        var time = new Date().getTime();
        var newList = [];
        var messages = [];
        var nextTimeout = null;
        var defs = [];
        this.entries.forEach(function (x) {
            var diff = x.time - time;
            if (diff < 0) {
                messages = messages.concat(x.messages);
                defs.push(x.markedDeferred);
            }
            else {
                newList.push(x);
                if (nextTimeout == null || diff < nextTimeout) {
                    nextTimeout = diff;
                }
            }
        });
        if (messages.length > 0) {
            pmc_mail_1.Q(null).then(function () {
                return _this.messageFlagsUpdater.setMessagesReadStatus(messages, true);
            })
                .then(function () {
                defs.forEach(function (x) { return x.resolve(); });
            })
                .fail(function (e) {
                defs.forEach(function (x) { return x.reject(); });
                _this.logErrorCallback(e);
            });
        }
        this.entries = newList;
        if (this.entries.length > 0) {
            this.timeoutId = setTimeout(this.onTime.bind(this), nextTimeout);
        }
        else {
            this.timeoutId = null;
        }
    };
    return MessagesMarkerQueue;
}());
exports.MessagesMarkerQueue = MessagesMarkerQueue;
var MessagesMarkerQueueEx = (function () {
    function MessagesMarkerQueueEx(messagesMarkerQueue, provider) {
        this.messagesMarkerQueue = messagesMarkerQueue;
        this.provider = provider;
        this.markDelay = 3000;
        this.initialDelay = 1000;
    }
    MessagesMarkerQueueEx.prototype.reset = function () {
        this.afterInitialTimeout = false;
        this.unreadMessages = null;
        clearTimeout(this.initialTimeoutId);
        this.initialTimeoutId = setTimeout(this.onInitialTimer.bind(this), this.initialDelay);
    };
    MessagesMarkerQueueEx.prototype.onInitialTimer = function () {
        this.initialTimeoutId = null;
        this.afterInitialTimeout = true;
        if (this.unreadMessages && this.unreadMessages.length > 0) {
            this.messagesMarkerQueue.add(this.unreadMessages, this.markDelay - this.initialDelay);
        }
        this.unreadMessages = null;
    };
    MessagesMarkerQueueEx.prototype.onUserAction = function () {
        var unreadMessages = this.provider.getUnreadMessages();
        if (unreadMessages.length == 0) {
            return;
        }
        if (this.afterInitialTimeout) {
            this.messagesMarkerQueue.add(unreadMessages, this.markDelay);
        }
        else {
            this.unreadMessages = unreadMessages;
        }
    };
    return MessagesMarkerQueueEx;
}());
exports.MessagesMarkerQueueEx = MessagesMarkerQueueEx;
MessagesMarkerQueue.prototype.className = "com.privmx.plugin.chat.main.MessagesMarkerQueue";
MessagesMarkerQueueEx.prototype.className = "com.privmx.plugin.chat.main.MessagesMarkerQueueEx";

//# sourceMappingURL=MessagesMarkerQueue.js.map
