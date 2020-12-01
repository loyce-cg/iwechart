import {BaseWindowController} from "./../base/BaseWindowController";
import {EmailPasswordWindowController, EmailPasswordModel} from "../emailpassword/EmailPasswordWindowController";
import * as privfs from "privfs-client";
import * as Utils from "simplito-utils";
import * as Q from "q";
import {PromiseUtils} from "simplito-promise";
import {DemoException} from "../../mail/DemoException";
import {Contact} from "../../mail/contact/Contact";
import {SinkIndexEntry} from "../../mail/SinkIndexEntry";
import {LowUser} from "../../mail/LowUser";
import {app, mail} from "../../Types";
import {Lang} from "../../utils/Lang";
import {BaseWindowManager} from "../../app/BaseWindowManager";
import {ContactService} from "../../mail/contact/ContactService";
import {UserPreferences} from "../../mail/UserPreferences";
import {MessageTagsFactory} from "../../mail/MessageTagsFactory";
import {MessageManager} from "privfs-client/out/message/MessageManager";
import {MessageFlagsUpdater} from "../../mail/MessageFlagsUpdater";
import {SinkService} from "../../mail/SinkService";
import {MessageService} from "../../mail/MessageService";
import {HashmailResolver} from "../../mail/HashmailResolver";
import {Inject} from "../../utils/Decorators";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export type Receiver = string|privfs.message.MessageReceiver;

export interface Options {
    type?: string;
    receivers?: Receiver[];
    title?: string;
    message?: privfs.message.SentMessage;
    text?: string;
    indexEntry?: SinkIndexEntry;
    lowUserService?: mail.ILowUserService;
    saveToOutbox?: boolean;
    addReceiversToContacts?: boolean;
}

export interface Model {
    contacts: Contact[];
    text: string;
    subject: string;
    receivers: Receiver[];
    attachments: privfs.lazyBuffer.IContent[];
}

export interface ReceiverError {
    index: number;
    hashmail: string;
    receivers: privfs.message.MessageReceiver[];
}

export class ComposeWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.compose.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static MAX_MSG_TEXT_SIZE = 100000;
    
    options: Options;
    sendingMessage: boolean;
    attachments: privfs.lazyBuffer.IContent[];
    lowUserService: mail.ILowUserService;
    @Inject contactService: ContactService;
    @Inject userPreferences: UserPreferences;
    @Inject messageManager: MessageManager;
    @Inject messageFlagsUpdater: MessageFlagsUpdater;
    @Inject sinkService: SinkService;
    @Inject messageService: MessageService;
    @Inject hashmailResolver: HashmailResolver;
    @Inject identity: privfs.identity.Identity;
    
    constructor(parent: app.WindowParent, options: Options) {
        super(parent, __filename, __dirname);
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            minWidth: 500,
            minHeight: 315,
            width: 800,
            height: 565,
            resizable: true,
            title: this.i18n("window.compose.title.emptySubject"),
            icon: "icon ico-letter"
        };
        this.options = options;
        this.sendingMessage = false;
        this.attachments = [];
        this.lowUserService = this.options.lowUserService;
        this.registerChangeEvent(this.contactService.contactCollection.changeEvent, this.onContactChange, "multi");
        
        if (options.type == 'forward') {
            this.addPredefinedAttachments(options.indexEntry.getAttachmentSources(true));
        }
    }
    
    init() {
        if (this.lowUserService == null) {
            return this.app.mailClientApi.privmxRegistry.getLowUserService2().then(lowUserService => {
                this.lowUserService = lowUserService;
            });
        }
    }
    
    getModel(): Model {
        let options = this.options;
        let model: Model = {
            contacts: this.contactService.contactCollection.list,
            text: "",
            subject: "",
            receivers: [],
            attachments: this.attachments
        };
        let userSignature = this.userPreferences.getValue("mail.signature");
        let userSignatureText = userSignature ? "\n" + userSignature : "";
        if (options.type == "predefined") {
            if (options.receivers) {
                model.receivers = options.receivers;
            }
            if (options.title) {
                model.subject = options.title;
            }
            model.text = (options.text || "") + userSignatureText;
        }
        else if (options.type == "reply" || options.type == "reply-to-all") {
            model.subject = Utils.startsWith(options.message.title, "Re: ") ? options.message.title : "Re: " + options.message.title;
            let sourceText = typeof(options.text) == "string" ? options.text : this.getMessageDisplayText(options.indexEntry, options.message);
            model.text = this.getMessageQuot(options.indexEntry, options.message, sourceText) + userSignatureText;
            if (options.type == "reply") {
                let receiver: string;
                if (options.indexEntry.getOriginalSinkType() == "form") {
                    let json = options.indexEntry.getContentAsJson();
                    receiver = json && json.email ? json.email : options.message.sender.hashmail;
                }
                else {
                    receiver = options.indexEntry.getContactFormMessageSender() || options.message.sender.hashmail;
                }
                model.receivers = [receiver];
            }
            else if (options.type == "reply-to-all") {
                options.message.receivers.forEach(receiver => {
                    if (receiver != options.message.mainReceiver) {
                        model.receivers.push(receiver);
                    }
                });
                if (options.message.mainReceiver) {
                    model.receivers.push(options.message.sender.hashmail);
                }
            }
        }
        else if (options.type == "forward") {
            model.subject = "Fwd: " + options.message.title;
            let text = "\n\n-------- " + this.i18n("window.compose.forward.content.separator.text") + " --------\n";
            text += this.i18n("window.compose.forward.content.subject.label") + ": " + options.message.title + "\n";
            text += this.i18n("window.compose.forward.content.date.label") + ": " + options.message.createDate + "\n";
            text += this.i18n("window.compose.forward.content.from.label") + ": " + this.getMessageSender(options.indexEntry, options.message) + "\n";
            text += this.i18n("window.compose.forward.content.to.label") + ": ";
            options.message.receivers.forEach((receiver, i) => {
                text += (i == 0 ? "" : ", ") + this.getReceiverHashmail(receiver);
            });
            text += "\n\n" + this.getMessageDisplayText(options.indexEntry, options.message);
            model.text = text;
            // this.addPredefinedAttachments(options.indexEntry, options.message.attachments);
        }
        else if (options.type == "blank") {
            model.text = userSignatureText;
        }
        if (model.receivers) {
            model.receivers = model.receivers.map(x => {
                let hashmail = typeof(x) == "string" ? x : x.user.hashmail;
                let low = this.lowUserService.getLowUserByHashmail(hashmail);
                return low ? low.email : x;
            });
        }
        return model;
    }
    
    onViewSubjectChange(subject: string): void {
        this.setTitle(subject ? this.i18n("window.compose.title", [subject]) : this.i18n("window.compose.title.emptySubject"));
    }
    
    onViewSend(subject: string, text: string, receivers: Receiver[]): void {
        if (this.sendingMessage) {
            this.alert(this.i18n("window.compose.error.messageAlreadySending"));
            return;
        }
        if (receivers.length == 0) {
            this.alert(this.i18n("window.compose.error.missingRecipients"));
            return;
        }
        if (text.length > ComposeWindowController.MAX_MSG_TEXT_SIZE) {
            this.alert(this.i18n("window.compose.error.messageTextTooLarge", [ComposeWindowController.MAX_MSG_TEXT_SIZE]));
            return;
        }
        let emails = Lang.findAll(receivers, x => typeof(x) == "string" && x.indexOf("@") != -1);
        if (emails.length > 0 && receivers.length > 1) {
            this.alert(this.i18n("window.compose.error.emailMultipleReceivers"));
            return;
        }
        let email: string = null;
        if (emails.length > 0) {
            email = <string>emails[0];
            if (!this.isValidEmail(email)) {
                this.alert(this.i18n("window.compose.error.invalidEmail"));
                return;
            }
            let theAction = (model: EmailPasswordModel, indexEntry: SinkIndexEntry) => {
                let receiver: privfs.message.MessageReceiver;
                let source = indexEntry == null ? "" : indexEntry.getCfmId();
                this.addTaskEx(this.i18n("window.compose.task.sendMessage.text"), true, () => {
                    return Q().then(() => {
                        return this.lowUserService.addLowUser(model.email, model.password, model.hint, model.lang, source, subject, text);
                    })
                    .then(lowUser => {
                        let sink = privfs.message.MessageSinkPriv.fromSerialized(lowUser.sink.wif, "", "", "public", null, null);
                        let user = privfs.identity.Identity.fromSerialized({user: lowUser.username, host: lowUser.host}, lowUser.identity.wif, lowUser.email);
                        receiver = new privfs.message.MessageReceiver(sink, user);
                        if (indexEntry == null) {
                            return;
                        }
                        let msg = new privfs.message.Message();
                        let srcMsg = indexEntry.getMessage();
                        msg.msgId = srcMsg.msgId;
                        msg.createDate = srcMsg.createDate;
                        msg.title = srcMsg.title;
                        msg.text = this.getMessageDisplayText(indexEntry);
                        msg.setSender(user);
                        msg.addReceiver(this.sinkService.getMeAsReceiver());
                        msg.attachments = srcMsg.getAttachmentSources();
                        return this.messageManager.messageCreate(msg, null, MessageTagsFactory.getMessageTags(msg), sink);
                    })
                    .then(() => {
                        this.theSend(subject, text, [receiver], true, model.lang);
                    });
                });
            }
            let thePrompt = (model: EmailPasswordModel, indexEntry: SinkIndexEntry) => {
                this.app.ioc.create(EmailPasswordWindowController, [this, model]).then(win => {
                    this.openChildWindow(win).getPromise().then(r => {
                        if (r.result != "ok") {
                            return;
                        }
                        theAction(r.value, indexEntry);
                    });
                });
            };
            let thePromptUser = (user: LowUser, indexEntry: SinkIndexEntry) => {
                let model: EmailPasswordModel = user == null ? {
                    email: email,
                    password: "",
                    hint: "",
                    lang: this.app.localeService.currentLang,
                    withPassword: true
                } : {
                    email: email,
                    password: user.password,
                    hint: user.hint,
                    lang: user.language,
                    withPassword: true
                };
                return thePrompt(model, indexEntry);
            };
            if (this.options.type == "reply" && (this.options.indexEntry.isContactFormMessage() || this.options.indexEntry.getOriginalSinkType() == "form")) {
                let lowUser = this.lowUserService.getLowUserBySource(this.options.indexEntry.getCfmId());
                if (lowUser) {
                    let sink = privfs.message.MessageSinkPriv.fromSerialized(lowUser.sink.wif, "", "", "public", null, null);
                    let user = privfs.identity.Identity.fromSerialized({user: lowUser.username, host: lowUser.host}, lowUser.identity.wif, lowUser.email);
                    let receiver = new privfs.message.MessageReceiver(sink, user);
                    this.theSend(subject, text, [receiver], true, lowUser.language);
                }
                else {
                    let json = this.options.indexEntry.getContentAsJson();
                    if (json && json.password) {
                        theAction({
                            email: email,
                            password: json.password,
                            hint: "",
                            lang: json.language || this.app.localeService.currentLang,
                            withPassword: true
                        }, this.options.indexEntry);
                    }
                    else {
                        thePromptUser(null, this.options.indexEntry);
                    }
                }
            }
            else if (this.options.type == "reply") {
                let lowUser = this.lowUserService.getLowUserByHashmail(this.options.message.sender.hashmail);
                if (lowUser.email == email) {
                    let sink = privfs.message.MessageSinkPriv.fromSerialized(lowUser.sink.wif, "", "", "public", null, null);
                    let user = privfs.identity.Identity.fromSerialized({user: lowUser.username, host: lowUser.host}, lowUser.identity.wif, lowUser.email);
                    let receiver = new privfs.message.MessageReceiver(sink, user);
                    this.theSend(subject, text, [receiver], true, lowUser.language);
                }
                else {
                    let user = this.lowUserService.getLowUserByEmail(email);
                    thePromptUser(user, null);
                }
            }
            else {
                let user = this.lowUserService.getLowUserByEmail(email);
                thePromptUser(user, null);
            }
        }
        else {
            this.theSend(subject, text, receivers);
        }
    }
    
    theSend(subject: string, text: string, receivers: Receiver[], msgInfoInExtra?: boolean, extraLang?: string): void {
        let currentHashmail: string;
        this.addTask(this.i18n("window.compose.task.sendMessage.text"), true, () => {
            let receiversErrors: ReceiverError[] = [];
            this.sendingMessage = true;
            return PromiseUtils.collect(receivers, (i, receiver) => {
                if (receiver instanceof privfs.message.MessageReceiver) {
                    return receiver;
                }
                return Q().then(() => {
                    currentHashmail = receiver;
                    if (this.app.isDemo() && !this.app.isSupportedHashmail(currentHashmail)) {
                        throw new DemoException("HASHMAIL_NOT_SUPPORTED", currentHashmail);
                    }
                    return this.hashmailResolver.resolveHashmailEx(currentHashmail);
                })
                .then(result => {
                    if (result.receivers.length == 1) {
                        return result.receivers[0];
                    }
                    receiversErrors.push({
                        index: parseInt(i),
                        hashmail: currentHashmail,
                        receivers: result.receivers
                    });
                });
            })
            .then(receiversWithUrl => {
                currentHashmail = null;
                if (receiversErrors.length > 0) {
                    for (let i = 0; i < receiversErrors.length; i++) {
                        let error = receiversErrors[i];
                        if (error.receivers.length == 0) {
                            this.alert(this.i18n("window.compose.error.resolve", [error.hashmail]));
                            return;
                        }
                    }
                    this.callViewMethod("showMultipleReceivers", receiversErrors);
                    return;
                }
                if (msgInfoInExtra == null) {
                    receiversWithUrl.forEach(x => {
                        if (this.lowUserService.isLowUser(x.user)) {
                            msgInfoInExtra = true;
                        }
                    });
                }
                let message: privfs.message.Message;
                return Q().then(() => {
                    return this.messageService.createMessage(receiversWithUrl, subject, text);
                })
                .then(m => {
                    message = m;
                    message.contentType = "html";
                    return this.getEncryptedMessageText(message);
                })
                .then(encryptedText => {
                    this.callViewMethod("setEncryptedMessageText", encryptedText);
                    if (this.options.indexEntry != null) {
                        if (this.options.type == "reply" || this.options.type == "reply-to-all") {
                            message.inReplyTo = this.options.indexEntry.getMessage().msgId;
                        }
                        if (this.options.type == "forward") {
                            message.forwarded = this.options.indexEntry.getMessage().msgId;
                        }
                    }
                    this.attachments.forEach(attachment => {
                        message.addAttachment(attachment);
                    });
                    return Q().delay(500);
                })
                .then(() => {
                    if (this.attachments.length) {
                        this.callViewMethod("showAttachmentsInfobox");
                    }
                    let extra = "";
                    if (msgInfoInExtra) {
                        extra = JSON.stringify({
                            from: message.sender.getDisplayName(null),
                            subject: message.title,
                            body: this.i18n(this.options.type == "reply" ? "window.compose.emailBodyReply." + extraLang : "window.compose.emailBodyNew." + extraLang),
                            lang: extraLang
                        });
                    }
                    return this.options.saveToOutbox === false ?
                        <any>this.messageService.sendSimpleMessage(message, extra) :
                        <any>this.messageService.sendMessage(message, extra);
                })
                .then(() => {
                    if (this.attachments.length) {
                        this.callViewMethod("hideAttachmentsInfobox");
                    }
                    if (this.options.indexEntry != null) {
                        let flags = [];
                        if (this.options.type == "reply" || this.options.type == "reply-to-all") {
                            flags.push({
                                name: "replied",
                                value: true
                            });
                        }
                        if (this.options.type == "forward") {
                            flags.push({
                                name: "forwarded",
                                value: true
                            });
                        }
                        if (flags.length > 0) {
                            this.messageFlagsUpdater.updateMessageFlags(this.options.indexEntry, flags);
                        }
                    }
                    this.app.playAudio("message-sent");
                    if (this.options.addReceiversToContacts === false) {
                        return;
                    }
                    return PromiseUtils.oneByOne(receiversWithUrl, (_i, receiver) => {
                        return this.contactService.addReceiverToContacts(receiver);
                    });
                })
                .then(() => {
                    this.close(true);
                });
            });
        })
        .fail(e => {
            if (currentHashmail != null) {
                let msg = this.prepareErrorMessage(e);
                if (privfs.core.ApiErrorCodes.is(e, "USER_DOESNT_EXIST") || (e && e.message == "user-does-not-exists")) {
                    msg = this.i18n("window.compose.error.userNotFound", [currentHashmail]);
                }
                if (privfs.core.ApiErrorCodes.is(e, "INTERNAL_ERROR")) {
                    msg = this.i18n("window.compose.error.internal", [currentHashmail]);
                }
                if (e != null && e.message == "Invalid parameter") {
                    if (currentHashmail.indexOf("@") != -1) {
                        msg = this.i18n("window.compose.error.email", [currentHashmail]);
                    }
                    else {
                        msg = this.i18n("window.compose.error.hashmail", [currentHashmail]);
                    }
                }
                if (e && e.errorType == "invalid-server-keystore") {
                    msg = this.i18n("window.compose.error.invalidServerHashmail", [currentHashmail]);
                }
                return <Q.Promise<any>>this.onErrorCustom(msg, e);
            }
            this.logError(e);
            let error = this.messageService.getMessagePostError(e);
            return Q().then(() => {
                return this.errorAlert(error.msg, e);
            })
            .then(() => {
                if (error.savedToOutbox) {
                    this.close(true);
                }
                else {
                    this.callViewMethod("unsetEncryptedMessageText");
                    this.callViewMethod("hideAttachmentsInfobox");
                }
            });
        }).fin(() => {
            this.sendingMessage = false;
        });
    }
    
    onViewAddAttachments(): void {
        this.app.openFiles()
        .then(newAttachments => {
            let allAttachments = this.attachments.concat(newAttachments);
            if (this.app.hasMaxFileSizeLimit()) {
                let size = 0;
                for (let i = 0; i < allAttachments.length; i++) {
                    size += allAttachments[i].getSize();
                }
                if (size > this.app.getMaxFileSizeLimit()) {
                    throw new DemoException("MAX_FILE_SIZE_EXCEEDED");
                }
            }
            this.attachments = allAttachments;
            this.callViewMethod("renderAttachments", this.attachments);
        })
        .fail(this.errorCallback);
    }
    
    onViewDeleteAttachment(idx: number): void {
        if (idx == -1) {
            return;
        }
        this.attachments.splice(idx, 1);
        this.callViewMethod("renderAttachments", this.attachments);
    }
    
    onViewDownloadAttachment(idx: number): void {
        let attachment = this.attachments[idx];
        if (attachment == null) {
            return;
        }
        // local session passed just to suppress error as this ComposeWindowController is obsolete
        this.downloadContent(this.app.sessionManager.getLocalSession(), attachment);
    }
    
    sinkSelect(inputId: string, hashmail: string, sink: privfs.types.message.SerializedMessageSink): void {
        this.addTaskEx(this.i18n("window.compose.task.resolveHashmail.text"), true, () => {
            return Q().then(() => {
                return this.hashmailResolver.resolveHashmail(hashmail);
            })
            .then(result => {
                for (var i in result.receivers) {
                    if (result.receivers[i].sink.id == sink.id) {
                        this.callViewMethod("toggleInput", inputId, result.receivers[i]);
                        return;
                    }
                }
                let newSink = privfs.message.MessageSink.fromSerialized(sink.id, sink.name, sink.description);
                let receiver = new privfs.message.MessageReceiver(newSink, result.data.user);
                this.callViewMethod("toggleInput", inputId, receiver);
            });
        });
    }
    
    getMessageDisplayText(indexEntry: SinkIndexEntry, message?: privfs.message.SentMessage): string {
        if (!message) {
            message = indexEntry.getMessage();
        }
        let sinkType = indexEntry.getOriginalSinkType();
        if (message.type == "pki-event") {
            try {
                return JSON.parse(message.text).content;
            }
            catch(e) {}
        }
        else if (sinkType == "form") {
            try {
                let formData = JSON.parse(message.text);
                var text = "";
                for (var key in formData) {
                    text += key + ": " + formData[key]  + "\n";
                }
                return text;
            }
            catch(e) {}
        }
        else if (indexEntry.isContactFormMessage()) {
            try {
                return JSON.parse(message.text).text;
            }
            catch(e) {}
        }
        return message.text;
    }
    
    getMessageSender(indexEntry: SinkIndexEntry, message: privfs.message.SentMessage): string {
        if (indexEntry.getOriginalSinkType() == "form") {
            let json = indexEntry.getContentAsJson();
            return json && json.email ? json.email : message.sender.hashmail;
        }
        let sender = indexEntry.getContactFormMessageSender();
        if (!sender) {
            let lowUser = this.lowUserService.getLowUserByHashmail(message.sender.hashmail);
            sender = lowUser ? lowUser.email : message.sender.hashmail;
        }
        return sender;
    }
    
    getReceiverHashmail(receiver: privfs.message.MessageReceiver) {
        if (receiver.user.user == "anonymous") {
            return this.identity.hashmail;
        }
        let lowUser = this.lowUserService.getLowUserByHashmail(receiver.user.hashmail);
        return lowUser ? lowUser.email : receiver.user.hashmail;
    }
    
    getMessageQuot(indexEntry: SinkIndexEntry, message: privfs.message.SentMessage, text: string): string {
        text = text.replace(/<br\s*\/?>/gmi, "\n");
        let quote = "> " + text.split("\n").join("\n> ");
        let createDate = this.app.localeService.longDate(message.createDate);
        let sender = this.getMessageSender(indexEntry, message);
        let prefix = this.i18n("window.compose.quote.text", [createDate, sender]);
        let parts = ["\n\n", prefix, "\n", quote];
        return parts.join("");
    }
    
    addPredefinedAttachments(attachments: privfs.lazyBuffer.IContent[]): void {
        this.attachments = attachments;
        this.callViewMethod("renderAttachments", this.attachments);
    }
    
    getEncryptedMessageText(message: privfs.message.Message): Q.Promise<string> {
        let receiver = message.receivers[0];
        return Q().then(() => {
            return message.serialize(receiver, [], message.sender.pub58);
        })
        .then(serializedMsg => {
            let extra = {
                data: serializedMsg.data,
                signature: serializedMsg.signature
            };
            let extraBuffer = new Buffer(JSON.stringify(extra), "utf8");
            return privfs.crypto.service.eciesEncrypt((<privfs.identity.Identity>message.sender).priv, receiver.sink.pub, extraBuffer);
        })
        .then(enc => {
            return enc.toString("base64");
        });
    }
    
    afterChildWindowsClose(force?: boolean): Q.Promise<void> {
        this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
        let defer = Q.defer<void>();
        Q().then(() => {
            if (!force) {
                if (this.sendingMessage) {
                    return this.confirm(this.i18n("window.compose.confirm.close.sending.text"));
                }
                return Q().then(() => {
                    return this.retrieveFromView("formIsDirty");
                })
                .then(dirty => {
                    if (dirty) {
                        return this.confirmEx({
                            message: this.i18n("window.compose.confirm.close.dirty.text"),
                            yes: {
                                faIcon: "trash",
                                btnClass: "btn-warning",
                                label: this.i18n("window.compose.confirm.close.dirty.confirm")
                            },
                            no: {
                                faIcon: "",
                                btnClass: "btn-default",
                                label: this.i18n("core.button.cancel.label")
                            }
                        });
                    }
                    return {result: "yes"};
                });
            }
            return {result: "yes"};
        })
        .then(result => {
            if (result.result == "yes") {
                this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                defer.resolve();
            }
            else {
                this.manager.cancelClosing();
                // defer.reject(null);
                defer.resolve();
            }
        });
        return defer.promise;
    }
    
    onContactChange(): void {
        this.callViewMethod("updateContactList", this.contactService.contactCollection.list);
    }
    
    isValidEmail(email: string): boolean {
        let splitted = email.split("@");
        return splitted.length == 2 &&
            splitted[0].length > 0 && splitted[0].trim() == splitted[0] &&
            splitted[1].length > 0 && splitted[1].trim() == splitted[1];
    }
}
