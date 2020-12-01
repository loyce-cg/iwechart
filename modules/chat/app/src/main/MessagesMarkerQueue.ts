import {mail, Q} from "pmc-mail";

export interface MessagesMarkerQueueEntry {
    messages: mail.SinkIndexEntry[];
    time: number;
    markedDeferred?: Q.Deferred<void>;
}

export class MessagesMarkerQueue {
    
    entries: MessagesMarkerQueueEntry[];
    timeoutId: number;
    
    constructor(
        public messageFlagsUpdater: mail.MessageFlagsUpdater,
        public logErrorCallback: (e?: any) => any
    ) {
        this.entries = [];
    }
    
    add(messages: mail.SinkIndexEntry[], delay: number): Q.Promise<void> {
        let def = Q.defer<void>();
        this.entries.push({
            messages: messages,
            time: new Date().getTime() + delay,
            markedDeferred: def,
        });
        if (!this.timeoutId) {
            this.timeoutId = <any>setTimeout(this.onTime.bind(this), delay);
        }
        return def.promise;
    }
    
    onTime() {
        let time = new Date().getTime();
        let newList: MessagesMarkerQueueEntry[] = [];
        let messages: mail.SinkIndexEntry[] = [];
        let nextTimeout: number = null;
        let defs: Q.Deferred<void>[] = [];
        this.entries.forEach(x => {
            let diff = x.time - time;
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
            Q(null).then(() => {
                return this.messageFlagsUpdater.setMessagesReadStatus(messages, true);
            })
            .then(() => {
                defs.forEach(x => x.resolve());
            })
            .fail(e => {
                defs.forEach(x => x.reject());
                this.logErrorCallback(e);
            });
        }
        this.entries = newList;
        if (this.entries.length > 0) {
            this.timeoutId = <any>setTimeout(this.onTime.bind(this), nextTimeout)
        }
        else {
            this.timeoutId = null;
        }
    }
}

export class MessagesMarkerQueueEx {
    
    markDelay: number;
    initialDelay: number;
    afterInitialTimeout: boolean;
    unreadMessages: mail.SinkIndexEntry[];
    initialTimeoutId: number;
    
    constructor(
        public messagesMarkerQueue: MessagesMarkerQueue,
        public provider: {getUnreadMessages(): mail.SinkIndexEntry[]}
    ) {
        this.markDelay = 3000;
        this.initialDelay = 1000;
    }
    
    reset() {
        this.afterInitialTimeout = false;
        this.unreadMessages = null;
        clearTimeout(this.initialTimeoutId);
        this.initialTimeoutId = setTimeout(this.onInitialTimer.bind(this), this.initialDelay);
    }
    
    onInitialTimer() {
        this.initialTimeoutId = null;
        this.afterInitialTimeout = true;
        if (this.unreadMessages && this.unreadMessages.length > 0) {
            this.messagesMarkerQueue.add(this.unreadMessages, this.markDelay - this.initialDelay);
        }
        this.unreadMessages = null;
    }
    
    onUserAction() {
        let unreadMessages = this.provider.getUnreadMessages();
        if (unreadMessages.length == 0) {
            return;
        }
        if (this.afterInitialTimeout) {
            this.messagesMarkerQueue.add(unreadMessages, this.markDelay);
        }
        else {
            this.unreadMessages = unreadMessages;
        }
    }
}