import * as privfs from "privfs-client";
import {SinkIndexManager} from "./SinkIndexManager";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import {Lang} from "../utils/Lang";
import {SinkIndex} from "./SinkIndex";
import {mail, utils} from "../Types";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {BaseCollection} from "../utils/collection/BaseCollection";
import {LowUserService2} from "./LowUserService2";
import {UserEntryService} from "./person/UserEntryService";
import {SinkProvider} from "./SinkProvider";
let Logger = RootLogger.get("privfs-mail-client.mail.SinkService");

export class SinkService {
    
    identityReceiver: privfs.message.MessageReceiver; //zmienna pomocnicza przy pobieraniu identity jako receiver, wymaga wczytanego inboxa
    
    constructor(
        public identityProvider: utils.IdentityProvider,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public sinkIndexManager: SinkIndexManager,
        public messageManager: privfs.message.MessageManager,
        public sinkEncryptor: privfs.crypto.utils.ObjectEncryptor,
        public userConfig: privfs.types.core.UserConfig,
        public sinkFilter: utils.Option<mail.SinkFilter>,
        public lowUserService2: LowUserService2,
        public authData: privfs.types.core.UserDataEx,
        public userEntryService: UserEntryService,
        public sinkProvider: SinkProvider
    ) {
    }
    
    loadSinks(): Q.Promise<void> {
        return Q().then(() => {
            return this.messageManager.sinkGetAllMy(this.sinkEncryptor);
        })
        .then(sinks => {
            sinks = sinks.filter(sink => {
                return !!sink.name;
            });
            if (this.sinkFilter.value) {
                sinks = sinks.filter(this.sinkFilter.value);
            }
            return this.ensureRequiredSinks(sinks);
        })
        .then(sinks => {
            return this.sinkIndexManager.init(sinks);
        })
        //Already loaded
        // .then(() => {
        //     return this.lowUserService2.loadLowUserService();
        // })
        .then(() => {
            return this.lowUserService2.refreshSinksRegistry();
        });
    }
    
    ensureRequiredSinks(sinks?: privfs.message.MessageSinkPriv[]): Q.Promise<privfs.message.MessageSinkPriv[]> {
        return Q().then(() => {
            sinks = sinks || [];
            Logger.debug("ensureRequiredSinks", sinks);
            let outboxExists = false, trashExists = false, inboxExists = false, contactExists = false, mainPageFormExists = false;
            sinks.some(sink => {
                if (sink.extra.type == "outbox") {
                    outboxExists = true;
                }
                else if (sink.extra.type == "trash") {
                    trashExists = true;
                }
                else if (sink.extra.type == "inbox") {
                    inboxExists = true;
                }
                else if (sink.extra.type == "contact") {
                    contactExists = true;
                }
                else if (sink.extra.type == "form" && sink.extra.subtype == "main-page-form") {
                    mainPageFormExists = true;
                }
                return (outboxExists && trashExists && inboxExists && contactExists && mainPageFormExists);
            });
            let tasks = [];
            if (!outboxExists) {
                tasks.push(this.messageManager.sinkCreate("Outbox", "", "private", {type: "outbox"}, this.sinkEncryptor, {}));
            }
            if (!trashExists) {
                tasks.push(this.messageManager.sinkCreate("Trash", "", "private", {type: "trash"}, this.sinkEncryptor, {}));
            }
            if (!inboxExists) {
                tasks.push(this.messageManager.sinkCreate("Inbox", "", "public", {type: "inbox"}, this.sinkEncryptor, {}));
            }
            if (!contactExists) {
                tasks.push(this.messageManager.sinkCreate("Contact", "", "anonymous", {type: "contact"}, this.sinkEncryptor, {verify: "email"}));
            }
            if (!mainPageFormExists && this.identityProvider.isAdmin() && (<any>this.userConfig).createMainPageForm) {
                tasks.push(this.messageManager.sinkCreate("Main Contact Form", "", "anonymous", {type: "form", subtype: "main-page-form"}, this.sinkEncryptor, {
                    afterValidation: "empty",
                    verify: "email",
                    removable: false
                }));
            }
            Logger.debug("need to create " + tasks.length + " required sink(s)");
            return Q.all(tasks);
        })
        .then(createdSinks => {
            sinks = sinks.concat(createdSinks);
            let inbox = Lang.find(sinks, x => x.extra.type == "inbox");
            let contact = Lang.find(sinks, x => x.extra.type == "contact");
            return this.createSinkProxy(contact, inbox);
        })
        .then(() => {
            return this.publishMainPageForm(sinks);
        })
        .then(() => {
            return sinks;
        });
    }
    
    createSinkProxy(from: privfs.message.MessageSinkPriv, to: privfs.message.MessageSinkPriv): Q.Promise<void> {
        return Q().then(() => {
            let tasks: any[] = [];
            if (!from.hasInProxyTo(to.id)) {
                from.addToProxyTo(to.id);
                tasks.push(this.messageManager.sinkSave(from, this.sinkEncryptor));
            }
            if (!to.hasInProxyFrom(from.id)) {
                to.addToProxyFrom(from.id);
                tasks.push(this.messageManager.sinkSave(to, this.sinkEncryptor));
            }
            return Q.all(tasks).then(() => {});
        });
    }
    
    ensureInbox(sinks: privfs.message.MessageSinkPriv[]): Q.Promise<privfs.message.MessageSinkPriv[]> {
        return Q().then(() => {
            sinks = sinks || [];
            Logger.debug("ensureInbox", sinks);
            let inboxExists = false;
            sinks.some(sink => {
                if (sink.extra.type == "inbox") {
                    inboxExists = true;
                    return true;
                }
            });
            if (!inboxExists) {
                return this.messageManager.sinkCreate("Inbox", "", "public", {type: "inbox"}, this.sinkEncryptor, {});
            }
        })
        .then(createdSink => {
            if (createdSink) {
                sinks.push(createdSink);
            }
            return sinks;
        });
    }
    
    createSink(name: string, description: string, acl: string, extra: any, options?: privfs.types.message.SinkOptions): Q.Promise<privfs.message.MessageSinkPriv> {
        Logger.debug("createSink", arguments);
        return Q().then(() => {
            extra = extra || {};
            if (typeof(name) != "string" || (name = name.trim()) == "") {
                throw new Error("api.createSink.error.invalidName");
            }
            this.sinkIndexManager.indexes.forEach(index => {
                let sink = index.sink;
                if (sink.name == name) {
                    throw new Error("api.createSink.error.nameExists");
                }
                if (sink.extra.type == extra.type && (sink.extra.type == "outbox" || sink.extra.type == "trash")) {
                    throw new Error("api.createSink.error.sinkExists");
                }
            });
            return this.messageManager.sinkCreate(name, description, acl, extra, this.sinkEncryptor, options || {});
        })
        .then(sink => {
            return this.sinkIndexManager.addSink(sink).then(() => this.lowUserService2.refreshSinksRegistry()).thenResolve(sink);
        });
    }
    
    createInbox(name: string, description: string, isPrivate?: boolean): Q.Promise<privfs.message.MessageSinkPriv> {
        return Q().then(() => {
            let extra = {
                isPrivate: !!isPrivate,
                type: "inbox"
            };
            return this.createSink(name, description, "public", extra);
        })
        .then(sink => {
            if (!sink.extra.isPrivate) {
                this.userEntryService.publishUserEntry();
            }
            return sink;
        });
    }
    
    getSinkById(id: string): privfs.message.MessageSinkPriv {
        return this.sinkIndexManager.getSinkById(id);
    }
    
    getSinkIndexById(id: string): SinkIndex {
        return this.sinkIndexManager.getIndexBySinkId(id);
    }
    
    createFolder(name: string): Q.Promise<privfs.message.MessageSinkPriv> {
        Logger.debug("createFolder");
        return this.createSink(name, "", "private", {type: "folder"});
    }
    
    createTrash(): Q.Promise<privfs.message.MessageSinkPriv> {
        Logger.debug("createTrash");
        return this.createSink("Trash", "", "private", {type: "trash"});
    }
    
    createOutbox(): Q.Promise<privfs.message.MessageSinkPriv> {
        Logger.debug("createOutbox");
        return this.createSink("Sent", "", "private", {type: "outbox"});
    }
    
    createSecureFormInbox(name: string, privfsClientInfo?: any, options?: privfs.types.message.SinkOptions): Q.Promise<privfs.message.MessageSinkPriv> {
        Logger.debug("createSecureFormInbox");
        return this.createSink(name, "", "anonymous", {
            type: "form",
            privfsClientInfo: privfsClientInfo
        }, options);
    }
    
    deleteSecureFormInbox(id: string): Q.Promise<void> {
        let sink = this.getSinkById(id);
        return Q().then(() => {
            return this.messageManager.sinkDelete(sink);
        })
        .then(() => {
            return this.sinkIndexManager.removeSink(sink);
        });
    }
    
    moveMessage(handler: mail.MessageHandler, destinationSink: privfs.message.MessageSinkPriv): Q.Promise<void> {
        return Q().then(() => {
            let sourceIndex = this.sinkIndexManager.getIndexBySink(handler.sink);
            let destinationIndex = this.sinkIndexManager.getIndexBySink(destinationSink);
            if (sourceIndex == null || destinationIndex == null) {
                throw new Error("api.error.indexNotFound");
            }
            return sourceIndex.moveEntry(handler.id, destinationIndex);
        });
    }
    
    moveToTrash(handler: mail.MessageHandler): Q.Promise<void> {
        return this.moveMessage(handler, this.getTrash());
    }
    
    getSinkIndexEntry(sink: privfs.message.MessageSinkPriv, id: number): Q.Promise<SinkIndexEntry> {
        return Q().then(() => {
            let index = this.sinkIndexManager.getIndexBySink(sink);
            let entry = index.getEntry(id);
            if (entry == null) {
                throw new Error("api.error.entryNotFound");
            }
            return entry;
        });
    }
    
    getSinkIndexEntries(sink: privfs.message.MessageSinkPriv, ids: number[]): Q.Promise<SinkIndexEntry[]> {
        return Q().then(() => {
            let index = this.sinkIndexManager.getIndexBySink(sink);
            return ids.map(id => {
                let entry = index.getEntry(id);
                if (entry == null) {
                    throw new Error("api.error.entryNotFound");
                }
                return entry;
            });
        });
    }
    
    getMessage(sink: privfs.message.MessageSinkPriv, id: number): Q.Promise<privfs.message.SentMessage> {
        return this.getSinkIndexEntry(sink, id)
        .then(entry => {
            return entry.getMessage();
        });
    }
    
    getMessages(sink: privfs.message.MessageSinkPriv, ids: number[]): Q.Promise<privfs.message.SentMessage[]> {
        return this.getSinkIndexEntries(sink, ids)
        .then(entries => {
            return entries.map(entry => {
                return entry.getMessage();
            });
        });
    }
    
    deleteMessage(handler: mail.MessageHandler, force?: boolean): Q.Promise<void> {
        return Q().then(() => {
            if (handler.sink.extra.type == "trash" || force) {
                let index = this.sinkIndexManager.getIndexBySink(handler.sink);
                if (index == null) {
                    throw new Error("api.error.indexNotFound");
                }
                return index.deleteEntry(handler.id);
            }
            else {
                return this.moveToTrash(handler);
            }
        });
    }
    
    emptyTrash(): Q.Promise<void> {
        return Q().then(() => {
            let index = this.sinkIndexManager.getIndexBySink(this.getTrash());
            if (index == null) {
                throw new Error("api.error.indexNotFound");
            }
            return index.clear();
        });
    }
    
    getMeAsReceiver(): privfs.message.MessageReceiver {
        if (this.identityReceiver == null) {
            this.identityReceiver = new privfs.message.MessageReceiver(this.findFirstPublicInbox(), this.identityProvider.getIdentity());
        }
        return this.identityReceiver;
    }
    
    publishMainPageForm(sinks: privfs.message.MessageSinkPriv[]): Q.Promise<void> {
        return Q().then(() => {
            if (!this.identityProvider.isAdmin()  || !(<any>this.userConfig).createMainPageForm) {
                return;
            }
            let sink = Lang.find(sinks, x => x.extra && x.extra.type == "form" && x.extra.subtype == "main-page-form");
            if (sink == null) {
                return;
            }
            return Q().then(() => {
                return this.srpSecure.request("setMainPageForm", {
                    sid: sink.id
                });
            })
            .then(() => {
                return this.srpSecure.changeUserData(this.identityProvider.getIdentity().user, {secureFormsEnabled: true});
            })
            .then(() => {
                this.authData.myData.raw.secureFormsEnabled = true;
            });
        });
    }
    
    getSinksIndexCollection(): BaseCollection<SinkIndex> {
        return this.sinkIndexManager.sinkIndexCollection;
    }
    
    pollSinkIfNeeded(sink: privfs.message.MessageSinkPriv): void {
        let index = this.sinkIndexManager.getIndexBySink(sink);
        if (index.needUpdate && this.sinkIndexManager.sinkPolling) {
            this.sinkIndexManager.sinkPolling.kick();
        }
    }
    
    createSecureFormToken(sid: string): Q.Promise<string> {
        return this.srpSecure.request<string>("createSecureFormToken", {sid: sid});
    }
    
    getTrash(): privfs.message.MessageSinkPriv {
        return this.sinkProvider.getTrash();
    }
    
    getAllSecureFormInboxes(): privfs.message.MessageSinkPriv[] {
        return this.sinkProvider.getAllSecureFormInboxes();
    }
    
    getInboxes(): privfs.message.MessageSinkPriv[] {
        return this.sinkProvider.getInboxes();
    }
    
    getOutbox(): privfs.message.MessageSinkPriv {
        return this.sinkProvider.getOutbox();
    }
    
    findFirstPublicInbox(): privfs.message.MessageSinkPriv {
        return this.sinkProvider.findFirstPublicInbox();
    }
    
    findFirstSinkByType(type: string, acl?: string): privfs.message.MessageSinkPriv {
        return this.sinkProvider.findFirstSinkByType(type, acl);
    }
}