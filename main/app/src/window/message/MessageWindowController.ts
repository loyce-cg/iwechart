import {BaseWindowController} from "./../base/BaseWindowController";
import {SourceWindowController} from "../source/SourceWindowController";
import {EmailInfoWindowController, EmailInfoModel} from "../emailinfo/EmailInfoWindowController";
import {SinkIndex} from "../../mail/SinkIndex";
import {SinkIndexEntry} from "../../mail/SinkIndexEntry";
import * as privfs from "privfs-client";
import * as Q from "q";
import {app, utils, event} from "../../Types";
import {LowUser} from "../../mail/LowUser";
import {Inject} from "../../utils/Decorators"
import {Persons} from "../../mail/person/Persons";
import {ContactService} from "../../mail/contact/ContactService";
import {SinkIndexManager } from "../../mail/SinkIndexManager";
import {SinkService} from "../../mail/SinkService";
import {MessageService} from "../../mail/MessageService";
import {LowUserService2} from "../../mail/LowUserService2";
import {MessageFlagsUpdater} from "../../mail/MessageFlagsUpdater";
import {MessageSenderVerifier} from "../../mail/MessageSenderVerifier";
import {PersonService} from "../../mail/person/PersonService";
import {Person} from "../../mail/person/Person";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    showStatusBar: boolean;
}

export type VerifyInfoModel = string|{
    verifyInfo: privfs.pki.Types.pki.KeyStoreEntry;
    indexEntry: SinkIndexEntry
}

export interface ReceiverPerson {
    receiver: privfs.message.MessageReceiver;
    person: Person;
}

export interface HeaderModel {
    indexEntry: SinkIndexEntry;
    lowReceiver: boolean;
    sender: Person;
    senderIsLowUser: boolean;
    myPerson: ReceiverPerson;
    receiversPersons: ReceiverPerson[];
}

export class MessageWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.message.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject persons: Persons;
    @Inject personService: PersonService;
    @Inject identity: privfs.identity.Identity;
    @Inject contactService: ContactService;
    @Inject sinkIndexManager: SinkIndexManager;
    @Inject sinkService: SinkService;
    @Inject messageService: MessageService;
    @Inject userConfig: privfs.types.core.UserConfig;
    @Inject lowUserService2: LowUserService2;
    @Inject messageFlagsUpdater: MessageFlagsUpdater;
    @Inject messageSenderVerifier: MessageSenderVerifier;
    docked: boolean;
    indexEntry: SinkIndexEntry;
    verifyInfo: privfs.pki.Types.pki.KeyStoreCacheEntry;
    
    constructor(parent: app.WindowParent, docked?: boolean) {
        super(parent, __filename, __dirname, null, docked ? (<any>parent).taskStream : null);
        this.docked = docked;
        if (this.docked) {
            this.openWindowOptions.widget = false;
            this.openWindowOptions.decoration = false;
        }
        else {
            this.openWindowOptions = {
                toolbar: false,
                maximized: false,
                show: false,
                position: "center",
                minWidth: 500,
                minHeight: 315,
                width: 1000,
                height: 565,
                resizable: true,
                icon: "icon ico-letter"
            };
        }
        this.registerChangeEvent(this.persons.changeEvent, this.onPersonsChange, "multi");
    }
    
    onCustomAction(listener: (event: event.CustomActionEvent) => void) {
        this.addEventListener("customaction", listener);
    }
    
    getModel(): Model {
        return {
            showStatusBar: !this.docked
        };
    }
    
    onViewLoad(): void {
        if (this.indexEntry == null) {
            return;
        }
        this.callViewMethod("readyToRenderMessage");
    }
    
    onViewCustomAction(actionType: string) {
        this.dispatchEvent<event.CustomActionEvent>({
            type: "customaction",
            target: this,
            actionType: actionType
        });
    }
    
    onViewSendMessage(type: string, hashmail: string, sid: string): void {
        if (this.indexEntry == null) {
            return;
        }
        let message = this.indexEntry.getMessage();
        if (type == "sender") {
            if (this.indexEntry.isContactFormMessage()) {
                let email = this.indexEntry.getContactFormMessageSender();
                if (email) {
                    this.sendMailTo(email);
                    return
                }
            }
            this.sendMailTo(message.sender.hashmail);
            return;
        }
        else if (type == "receiver") {
            for (var i in message.receivers) {
                let receiver = message.receivers[i];
                if (receiver.user.hashmail == hashmail && receiver.sink.id == sid) {
                    let contact = this.contactService.getContactByHashmail(hashmail);
                    if (contact != null) {
                        for (var i in contact.sinks) {
                            let sink = contact.sinks[i];
                            if (sid == sink.id) {
                                this.sendMailTo(new privfs.message.MessageReceiver(sink, contact.user));
                                return;
                            }
                        }
                        this.sendMailTo(new privfs.message.MessageReceiver(receiver.sink, contact.user));
                        return;
                    }
                    this.sendMailTo(receiver);
                    return;
                }
            }
            this.sendMailTo(hashmail);
        }
    }
    
    onViewDownloadAttachment(idx: number): void {
        if (this.indexEntry == null) {
            return;
        }

        // local session passed here to supress error as this controller is obsolete
        this.downloadAttachment(this.app.sessionManager.getLocalSession(), this.indexEntry.getMessage().attachments[idx]);
    }
    
    onViewReplyToAll(text: string): void {
        this.sendMailByType("reply-to-all", text);
    }
    
    onViewReply(text: string): void {
        this.sendMailByType("reply", text);
    }
    
    onViewForward(text: string): void {
        this.sendMailByType("forward", text);
    }
    
    onViewMove(): void {
        let allSinks = this.sinkIndexManager.getAllSinks();
        let available = allSinks.filter( x => {
            return x != this.indexEntry.index.sink && x.extra && (x.extra.type == "inbox" || x.extra.type == "outbox" || x.extra.type == "trash" || x.extra.type == "form" || x.extra.type == "contact");
        });
        available.sort(SinkIndex.sinkComparator);
        this.callViewMethod("showMoveToDialog", available);
    }
    
    onViewMoveTo(sinkId: string): void {
        if (this.indexEntry == null) {
            return;
        }
        if (this.networkIsDown()) {
            this.showOfflineError();
            return;
        }
        this.addTaskEx("", true, () => {
            return Q().then(() => {
                let sink = this.sinkIndexManager.getSinkById(sinkId);
                return this.sinkService.moveMessage(this.indexEntry, sink);
            })
            .then(() => {
                if (!this.docked) {
                    this.close(true);
                }
            });
        });
    }
    
    onViewDelete(): void {
        if (this.indexEntry == null) {
            return;
        }
        if (this.networkIsDown()) {
            this.showOfflineError();
            return;
        }
        let controller = this;
        Q().then(() => {
            return controller.deleteMessage(controller.indexEntry);
        })
        .then(result => {
            if (result && !controller.docked) {
                controller.close(true);
            }
        });
    }
    
    onViewShowSource(): void {
        if (this.indexEntry == null) {
            return;
        }
        this.app.ioc.create(SourceWindowController, [this, this.indexEntry]).then(win => {
            this.openChildWindow(win);
        });
    }
    
    onViewResendMessage(): void {
        if (this.indexEntry == null) {
            return;
        }
        this.addTaskEx(this.i18n("window.message.task.resendMessage.text"), true, () => {
            return Q().then(() => {
                return this.messageService.resendMessage(this.indexEntry);
            })
            .then(() => {
                if (!this.docked) {
                    this.close(true);
                }
            })
            .fail(e => {
                let error = this.messageService.getMessagePostError(e);
                this.onErrorCustom(error.msg, e);
            });
        });
    }
    
    onViewAddContact(type: string, hashmail: string, sid: string): void {
        if (this.indexEntry == null) {
            return;
        }
        if (this.networkIsDown()) {
            this.showOfflineError();
            return;
        }
        let message = this.indexEntry.getMessage();
        this.addTaskEx(this.i18n("window.message.task.addToContacts.text"), true, () => {
            return Q().then(() => {
                if (type == "sender") {
                    return this.contactService.addSenderToContacts(this.indexEntry, true, true);
                }
                else if (type == "receiver") {
                    for (var i in message.receivers) {
                        let receiver = message.receivers[i];
                        if (receiver.user.hashmail == hashmail && receiver.sink.id == sid) {
                            return this.contactService.addReceiverToContacts(receiver, true);
                        }
                    }
                }
            })
            .fail(this.onErrorCustom.bind(this, this.i18n("window.message.addContact.failure")));
        });
    }
    
    onViewShowVerifyInfo(): void {
        this.refreshVerifyInfo();
    }
    
    onViewRefreshVerifyInfo(): void {
        this.refreshVerifyInfo(true);
    }
    
    onViewShowInfo(): void {
        let info = this.getLowUserInfo();
        let model: EmailInfoModel;
        if (info == null) {
            return;
        }
        if (info.lowUser) {
            let link = this.userConfig.talkUrl + "?" + info.lowUser.username;
            model = {
                password: info.lowUser.password,
                link: link,
                hint: info.lowUser.hint,
                lowUser: info.lowUser
            };
        }
        else if (info.password) {
            model = {
                password: info.password
            };
        }
        else {
            model = {};
        }
        this.app.ioc.create(EmailInfoWindowController, [this, model]).then(win => {
            this.openChildWindow(win);
        });
    }
    
    getLowUserInfo(): {lowUser?: LowUser, password?: string} {
        let message = this.indexEntry.getMessage();
        if (this.indexEntry.isContactFormMessage() || this.indexEntry.getOriginalSinkType() == "form") {
            let lowUser = this.lowUserService2.getLowUserBySource(this.indexEntry.getCfmId());
            if (lowUser == null) {
                let json = this.indexEntry.getContentAsJson();
                if (json && json.password) {
                    return {password: json.password};
                }
                return {};
            }
            else {
                return {lowUser: lowUser};
            }
        }
        else if (this.lowUserService2.isLowUser(message.sender)) {
            let user = message.sender;
            return {lowUser: this.lowUserService2.getLowUser(user.user, user.host)};
        }
        else if (message.receivers.length == 1 && this.lowUserService2.isLowUser(message.receivers[0].user)) {
            let user = message.receivers[0].user;
            return {lowUser: this.lowUserService2.getLowUser(user.user, user.host)};
        }
        return null;
    }
    
    onPersonsChange(): void {
        if (this.indexEntry == null) {
            return;
        }
        this.callViewMethod("renderHeader", this.getHeaderModel(this.indexEntry));
    }
    
    getHeaderModel(indexEntry: SinkIndexEntry): HeaderModel {
        let message = indexEntry.getMessage();
        let lowReceiver = message.receivers.length == 1 && this.lowUserService2.isLowUser(message.receivers[0].user);
        let model: HeaderModel = {
            indexEntry: indexEntry,
            lowReceiver: lowReceiver,
            sender: this.personService.getPersonProxy(message.sender),
            senderIsLowUser: this.lowUserService2.isLowUser(message.sender),
            myPerson: {
                person: this.personService.getPersonProxy(this.identity),
                receiver: this.sinkService.getMeAsReceiver()
            },
            receiversPersons: message.receivers.map(x => {
                return {
                    person: this.personService.getPersonProxy(x.user),
                    receiver: x
                };
            })
        };
        return model;
    }
    
    sendMailByType(type: string, text: string): void {
        if (this.indexEntry == null) {
            return;
        }
        this.sendMail({
            type: type,
            indexEntry: this.indexEntry,
            message: this.indexEntry.getMessage(),
            text: text
        });
    }
    
    setIndexEntry(indexEntry: SinkIndexEntry): void {
        if (this.indexEntry == indexEntry) {
            return;
        }
        if (this.indexEntry) {
            this.unregisterChangeEvent(this.indexEntry.index.entries.changeEvent, this.onSinkIndexChange);
        }
        this.indexEntry = indexEntry;
        this.verifyInfo = null;
        if (this.indexEntry == null) {
            this.setTitle("");
        }
        else {
            this.messageFlagsUpdater.setMessageReadStatus(this.indexEntry, true);
            this.contactService.addSenderAndReceiversToContacts(this.indexEntry);
            this.setTitle(this.indexEntry.getMessage().title);
            this.registerChangeEvent(this.indexEntry.index.entries.changeEvent, this.onSinkIndexChange);
        }
        this.callViewMethod("readyToRenderMessage");
    }
    
    onSinkIndexChange(event: utils.collection.CollectionEvent<SinkIndexEntry>): void {
        if (event.element == this.indexEntry) {
            this.callViewMethod("refreshVerifyInfo", this.indexEntry);
            this.refreshVerifyInfo();
        }
    }
    
    refreshVerifyInfo(refresh?: boolean): void {
        let indexEntry = this.indexEntry;
        if (indexEntry == null) {
            this.callViewMethod("refreshVerifyInfoDialog", "no-message");
        }
        if (indexEntry.hasVerifiedInformation()) {
            if (indexEntry.getMessage().sender.user == "anonymous" || this.lowUserService2.isLowUser(indexEntry.getMessage().sender)) {
                this.callViewMethod("refreshVerifyInfoDialog", "anonymous");
                return;
            }
            this.callViewMethod("refreshVerifyInfoDialog", "loading");
            Q().then(() => {
                if (refresh) {
                    return this.messageSenderVerifier.renewMessageVerify(indexEntry, this.verifyInfo != null)
                    .then(data => {
                        return data.fetch;
                    });
                }
                return this.messageSenderVerifier.getVerifyInfo(indexEntry);
            })
            .then(verifyInfo => {
                if (indexEntry == this.indexEntry) {
                    this.verifyInfo = verifyInfo;
                    if (verifyInfo == null) {
                        this.callViewMethod("refreshVerifyInfoDialog", "fetch-error");
                    }
                    else {
                        this.callViewMethod("refreshVerifyInfoDialog", {
                            verifyInfo: verifyInfo,
                            indexEntry: this.indexEntry
                        });
                    }
                }
            })
            .fail(e => {
                this.callViewMethod("refreshVerifyInfoDialog", "fetch-error");
                this.logError(e);
            });
        }
        else {
            this.callViewMethod("refreshVerifyInfoDialog", "no-verified");
        }
    }
    
    onViewReadyToRenderMessage(): void {
        let msg = this.indexEntry ? this.indexEntry.getMessage() : null;
        this.callViewMethod("renderMessage", this.indexEntry ? this.getHeaderModel(this.indexEntry) : null);
        if (msg) {
            msg.attachments.forEach((attachment, i) => {
                if (attachment.getMimeType().indexOf("image/") != 0) {
                    return;
                }
                Q().then(() => {
                    return attachment.getContent(true);
                })
                .progress(progress => {
                    this.callViewMethod("setImageProgress", msg.msgId, i, progress);
                })
                .then(content => {
                    let data: app.BlobData = {
                        mimetype: content.getMimeType(),
                        buffer: content.getBuffer()
                    };
                    this.callViewMethod("setImageDataUrl", msg.msgId, i, data);
                })
                .fail(this.errorCallback);
            });
        }
    }
}
