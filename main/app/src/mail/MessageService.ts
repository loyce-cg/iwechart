import * as privfs from "privfs-client";
import {MessageTagsFactory} from "./MessageTagsFactory";
import * as Q from "q";
import {SinkIndex} from "./SinkIndex";
import * as RootLogger from "simplito-logger";
import {MessageSenderVerifier} from "./MessageSenderVerifier";
import {Exception} from "privmx-exception";
import {mail} from "../Types";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {HashmailResolver} from "./HashmailResolver";
import { LocaleService } from "./LocaleService";
import { MailUtils } from "./MailUtils";
let Logger = RootLogger.get("privfs-mail-client.mail.MessageService");

export class MessageService {
    
    constructor(
        public messageManager: privfs.message.MessageManager,
        public messageSenderVerifier: MessageSenderVerifier,
        public messageTagsFactory: MessageTagsFactory,
        public identity: privfs.identity.Identity,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public hashmailResolver: HashmailResolver,
        public sinkIndexProvider: mail.SinkIndexProvider,
        public sinkProvider: mail.SinkProvider,
        public localeService: LocaleService
    ) {
    }
    
    static createMessage(sender: privfs.identity.Identity, oneOrMoreReceivers: privfs.message.MessageReceiver|privfs.message.MessageReceiver[], subject: string, text: string): privfs.message.Message {
        let receivers = Array.isArray(oneOrMoreReceivers) ? oneOrMoreReceivers : [oneOrMoreReceivers];
        let message = new privfs.message.Message();
        message.setSender(sender);
        receivers.forEach(receiver => {
            message.addReceiver(receiver);
        });
        message.title = subject;
        message.text = text;
        return message;
    }
    
    createMessage(oneOrMoreReceivers: privfs.message.MessageReceiver|privfs.message.MessageReceiver[], subject: string, text: string): privfs.message.Message {
        return MessageService.createMessage(this.identity, oneOrMoreReceivers, subject, text);
    }
    
    addEntryAndEncryptTags(index: SinkIndex, receiverPub: privfs.crypto.ecc.PublicKey, source: privfs.types.message.SerializedMessageFull, flags: any, tags: string[], replace?: boolean): Q.Promise<void> {
        return Q().then(() => {
            return this.messageManager.tagService.createTags(receiverPub, tags);
        })
        .then(mTags => {
            index.addEntry(source, flags, mTags, replace);
        })
        .fail(e => {
            Logger.error("Error during adding entry to sink", e);
            return Q.reject<void>(e);
        });
    }
    
    sendSimpleMessage(message: privfs.message.Message, extra?: string, addToSink?: boolean, tags?: string[]): Q.Promise<privfs.types.message.ReceiverData[]> {
        let outTags: string[], outFlags: any;
        return Q().then(() => {
            outTags = MessageTagsFactory.getMessageTags(message);
            if (tags) {
                outTags = outTags.concat(tags);
            }
            if (!addToSink) {
                return;
            }
            outFlags = {
                read: true,
                verified: null,
                tagged: true
            };
            return this.messageSenderVerifier.verifyMessageCore2(message.sender, new Date())
            .then(data => {
                outFlags.verified = data.verified;
            })
            .fail(e => {
                Logger.error("Error during verifying yourself ...", e);
            });
        })
        .then(() => {
            let opts: privfs.types.message.SendOptions = {};
            if (extra) {
                opts.extra = extra;
            }
            return <Q.Promise<privfs.types.message.ReceiverData[]>>this.messageManager.messagePost(message, outTags, opts);
        })
        .then(res => {
            if (addToSink) {
                res.forEach(x => {
                    if (x.success) {
                        let sinkIndex = this.sinkIndexProvider.getSinkIndexById(x.receiver.sink.id);
                        if (sinkIndex) {
                            this.addEntryAndEncryptTags(sinkIndex, x.receiver.user.pub, res[0].source, outFlags, outTags);
                        }
                    }
                });
            }
            return res;
        });
    }
    
    sendSimpleMessage2(hashmail: string, subject: string, text: string, type?: string, extra?: string, addToSink?: boolean): Q.Promise<privfs.types.message.ReceiverData[]> {
        return Q().then(() => {
            return this.hashmailResolver.resolveHashmail(hashmail);
        })
        .then(info => {
            if (info.receivers.length == 0) {
                throw new Error("Cannot send message to " + hashmail + " there is no sink.");
            }
            let msg = this.createMessage(info.receivers[0], subject, text);
            if (type) {
                msg.type = type;
            }
            return this.sendSimpleMessage(msg, extra, addToSink);
        });
    }
    
    editSimpleMessage(originalMessageId: number, message: privfs.message.Message, addToSink?: boolean, tags?: string[]): Q.Promise<privfs.message.SentMessage> {
        let outTags: string[], outFlags: any;
        return Q().then(() => {
            outTags = MessageTagsFactory.getMessageTags(message);
            if (tags) {
                outTags = outTags.concat(tags);
            }
            if (!addToSink) {
                return;
            }
            outFlags = {
                read: true,
                verified: null,
                tagged: true
            };
            return this.messageSenderVerifier.verifyMessageCore2(message.sender, new Date())
            .then(data => {
                outFlags.verified = data.verified;
            })
            .fail(e => {
                Logger.error("Error during verifying yourself ...", e);
            });
        })
        .then(() => {
            return this.messageManager.messageUpdate(message, originalMessageId, outTags);
        })
        .then(res => {
            if (addToSink) {
                let sinkIndex = this.sinkIndexProvider.getSinkIndexById(res.receivers[0].sink.id);
                if (sinkIndex) {
                    this.addEntryAndEncryptTags(sinkIndex, res.receivers[0].user.pub, res.source, outFlags, outTags, true);
                }
            }
            return res;
        });
    }
    
    sendMessage(message: privfs.message.Message, extra?: string): Q.Promise<mail.MessagePostResult> {
        Logger.debug("sendMessage", message);
        let outbox: privfs.message.MessageSinkPriv, outFlags: mail.Flags, outTags: string[];
        return Q().then(() => {
            outbox = this.sinkProvider.getOutbox();
            outFlags = {
                read: true,
                verified: null,
                tagged: true
            };
            return this.messageSenderVerifier.verifyMessageCore2(message.sender, new Date())
            .then(data => {
                outFlags.verified = data.verified;
            })
            .fail(e => {
                Logger.error("Error during verifying yourself ...", e);
            });
        })
        .then(() => {
            return this.messageTagsFactory.getAllTagsForMessage(message, outFlags);
        })
        .then(tags => {
            outTags = tags;
            return this.messageManager.messagePost(message, MessageTagsFactory.getMessageTags(message), {
                outbox: {
                    sink: outbox,
                    tags: outTags,
                    flags: outFlags
                },
                extra: extra || ""
            });
        })
        .then((info: privfs.types.message.MessagePostResultOutbox) => {
            Logger.debug("after messagePost");
            let result: mail.MessagePostResult = {
                message: message,
                info: info.results,
                errors: info.errors,
                nooneGetMsg: info.nooneGetMsg,
                full: info,
                outMessage: info.outboxMessage,
                outSink: outbox
            };
            if (result.nooneGetMsg || info.outboxError) {
                throw new Exception("sendMessageError", result);
            }
            let index = this.sinkIndexProvider.getSinkIndexById(outbox.id);
            this.addEntryAndEncryptTags(index, this.identity.pub, result.outMessage.source, outFlags, outTags);
            Logger.debug("added to outbox");
            if (result.errors > 0) {
                throw new Exception("sendMessageError", result);
            }
            return result;
        });
    }
    
    resendMessage(indexEntry: SinkIndexEntry): Q.Promise<mail.MessagePostResult> {
        let message: privfs.message.Message, outbox: privfs.message.MessageSinkPriv;
        let outFlags: mail.Flags, outTags: string[], result: mail.MessagePostResult, receivers: privfs.message.MessageReceiver[];
        return Q().then(() => {
            let oldMessage = indexEntry.getMessage();
            if (oldMessage.sender.pub58 != this.identity.pub58) {
                throw new Error("InvalidSender");
            }
            if (!oldMessage.hasNotSent()) {
                return [];
            }
            receivers = [];
            oldMessage.receivers.forEach(receiver => {
                if (receiver.sent === false) {
                    receivers.push(receiver);
                }
            });
            message = this.messageManager.convertMessageToRaw(oldMessage, false);
            message.setSender(this.identity);
            outbox = this.sinkProvider.getOutbox();
            outFlags = indexEntry.data;
            return this.messageTagsFactory.getAllTagsForMessage(message, outFlags);
        })
        .then(tags => {
            outTags = tags;
            return this.messageManager.messageResend(message, MessageTagsFactory.getMessageTags(message), receivers, {outbox: {
                sink: outbox,
                tags: outTags,
                flags: outFlags
            }});
        })
        .then((info: privfs.types.message.MessagePostResultOutbox) => {
            result = {
                message: message,
                info: info.results,
                errors: info.errors,
                nooneGetMsg: info.nooneGetMsg,
                full: info,
                outMessage: info.outboxMessage,
                outSink: outbox
            };
            if (result.nooneGetMsg || info.outboxError) {
                throw new Exception("sendMessageError", result);
            }
            let index = this.sinkIndexProvider.getSinkIndexById(outbox.id);
            this.addEntryAndEncryptTags(index, this.identity.pub, result.outMessage.source, outFlags, outTags);
            return index.deleteEntry(indexEntry.id);
        })
        .then(() => {
            if (result.errors > 0) {
                throw new Exception("sendMessageError", result);
            }
            return result;
        });
    }
    
    getMessagePostError(e: any): {savedToOutbox: boolean, msg: string} {
        return MailUtils.getMessagePostError(this.localeService, e);
    }
}
