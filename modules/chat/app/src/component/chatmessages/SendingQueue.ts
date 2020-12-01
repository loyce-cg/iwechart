import {Q} from "pmc-mail";
export class SendingQueue {
    static msgId: number = 0;
    messagesMap: {[id: string]: QueuedMessage} = {};
    processingFunc: (text: string, id: number) => Q.Promise<void>;
    freezeFunc: () => void;
    unfreezeFunc: () => void;

    constructor(processingFunc: (text: string, id: number) => Q.Promise<void>, freezeFunc: () => void, unfreezeFunc: () => void) {
        this.processingFunc = processingFunc;
        this.freezeFunc = freezeFunc;
        this.unfreezeFunc = unfreezeFunc;

    }

    add(text: string): number {
        let id = ++SendingQueue.msgId;
        this.messagesMap[id] = {id, text, msgId: null, processing: false, sent: false, sendingError: false};
        this.processDelay().then(() => this.process());
        return id;
    }
    
    delete(id: number): void {
        if (id in this.messagesMap) {
            delete this.messagesMap[id];
        }
    }

    deleteIfSent(id: number): void {
        if (id in this.messagesMap && !this.messagesMap[id].sendingError) {
            delete this.messagesMap[id];
        }
    }


    getFirstToProcess(): QueuedMessage {
        let msg: QueuedMessage;
        for (let id in this.messagesMap) {
            if (! this.isMessageProcessing(Number(id))) {
                msg = this.messagesMap[id];
                break;
            }
        }
        return msg;
    }

    processDelay(): Q.Promise<void> {
        return Q.Promise<void>(resolve => {
            setTimeout(() => resolve(), 10);
        })
    }

    process(): Q.Promise<void> {
        this.freezeFunc();
        return Q().then(() => {
            let first = this.getFirstToProcess();
            if (first) {
                return this.processMessage(first)
                .then(() => {
                    let next = this.getFirstToProcess();
                    if (next) {
                        return this.process();
                    }
                    else {
                        this.unfreezeFunc();
                    }
                })
            }
            else {
                this.unfreezeFunc();
            }    
        })
    }

    processMessage(msg: QueuedMessage) {
        return Q().then(() => {
            // console.log("processing message ", msg.id);
            this.messagesMap[msg.id].processing = true;
            this.messagesMap[msg.id].sendingError = false;
            return this.processingFunc(msg.text, msg.id)
        })
        .then(() => {
            this.deleteIfSent(msg.id);
        })
        .catch(e => {
            return this.process();
        })
    }

    get(id: number): QueuedMessage {
        if (id in this.messagesMap) {
            return this.messagesMap[id];
        }
        return null;
    }

    updateMessageId(id: number, msgId: number): void {
        this.messagesMap[id].msgId = msgId;
    }

    isMessageProcessing(id: number): boolean {
        if (id in this.messagesMap) {
            return this.messagesMap[id].processing;
        }
        return false;
    }


    isMessageSent(id: number): boolean {
        if (id in this.messagesMap) {
            return this.messagesMap[id].sent;
        }
        return true;
        
    }

    isMessageSending(id: number): boolean {
        return this.isMessageProcessing(id) && !this.isMessageSent(id); 
    }

    resend(id: number): void {
        this.messagesMap[id].processing = false;
        this.messagesMap[id].sendingError = true;
    }

    messageToString(msg: QueuedMessage): string {
        return `id: ${msg.id} / text: ${msg.text}`;
    }
}

export interface QueuedMessage {
    id: number;
    text: string;
    msgId: number;
    processing: boolean;
    sent: boolean;
    sendingError: boolean;
}
