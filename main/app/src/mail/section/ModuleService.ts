import {SectionService} from "./SectionService";
import {SinkIndex} from "../SinkIndex";
import {SinkIndexEntry} from "../SinkIndexEntry";
import {KvdbCollection} from "../kvdb/KvdbCollection";
import {SectionUtils} from "./SectionUtils";
import {section, utils} from "../../Types";
import * as shelltypes from "../../app/common/shell/ShellTypes";
import * as filetree from "../filetree";
import * as privfs from "privfs-client";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import {TarHelper, TarPack} from "../../utils/TarHelper";
import {PromiseUtils} from "simplito-promise";
import { FilteredCollection } from "../../utils/collection/FilteredCollection";
import { ZipPack, ZipHelper } from "../../utils/ZipHelper";
import { FileStyleResolver } from "../../app/common/FileStyleResolver";
import { IContent } from "simplito-lazybuffer";
let Logger = RootLogger.get("privfs-mail-client.mail.section.ModuleService");

export type ModuleFactory<T extends ModuleService = ModuleService> = (section: SectionService) => T;

export interface ModuleService {
    hasModule(): boolean;
    isEnabled(): boolean;
    createModule(enabled?: boolean): Q.Promise<void>;
}

export interface ModuleFactoryObj {
    MODULE_NAME: string;
    FACTORY: ModuleFactory;
}

export class ChatModuleService implements ModuleService {
    
    static SINK_TYPE = "section-chat";
    static CHAT_MESSAGE_TYPE = "chat-message";
    static CHAT_MESSAGE_TITLE = "Chat message";
    static MODULE_NAME: string = "chat";
    static FACTORY: ModuleFactory = section => new ChatModuleService(section);
    
    creatingPromise: Q.Promise<void>;
    sinkIndexPromise: Q.Promise<SinkIndex>;
    sink: privfs.message.MessageSinkPriv;
    sinkIndex: SinkIndex;
    filesMessagesCollection: FilteredCollection<SinkIndexEntry>;
    chatMessagesCollection: FilteredCollection<SinkIndexEntry>;
    
    constructor(public section: SectionService) {
    }
    
    hasModule(): boolean {
        return this.section.secured != null && this.section.secured.modules != null && this.section.secured.modules[ChatModuleService.MODULE_NAME] != null;
    }
    
    isEnabled(): boolean {
        return this.hasModule() && this.section.secured.modules[ChatModuleService.MODULE_NAME].enabled;
    }
    
    createModule(enabled?: boolean): Q.Promise<void> {
        if (this.hasModule()) {
            return Q.reject("module-already-created");
        }
        if (this.creatingPromise == null) {
            let sink: privfs.message.MessageSinkPriv;
            this.creatingPromise = Q().then(() => {
                sink = new privfs.message.MessageSinkPriv(privfs.crypto.serviceSync.eccPrivRandom(), null, null, "shared", null, this.getSinkOptions());
                return this.section.manager.messageManager.storage.sinkCreate(sink.id, "custom", "", sink.options);
            })
            .then(() => {
                return this.section.updateEx(data => {
                    if (!data.data.modules) {
                        data.data.modules = {};
                    }
                    data.data.modules[ChatModuleService.MODULE_NAME] = {
                        enabled: enabled !== false,
                        data: sink.privWif
                    };
                    return data;
                });
            })
            .fin(() => {
                this.creatingPromise = null;
            });
        }
        return this.creatingPromise;
    }
    
    getSink(): privfs.message.MessageSinkPriv {
        if (!this.hasModule()) {
            return null;
        }
        if (this.sink == null) {
            let sinkWif = this.section.secured.modules[ChatModuleService.MODULE_NAME].data;
            this.sink = privfs.message.MessageSinkPriv.fromSerialized(sinkWif, this.section.getName(), null, "shared", {
                type: ChatModuleService.SINK_TYPE,
                scope: this.section.getScope()
            }, null);
        }
        return this.sink;
    }
    
    getSinkOptions(): privfs.types.message.SinkOptions {
        let usersGroupAclEntry = "group:" + this.section.sectionData.group.id;
        return {
            afterValidation: "empty",
            canSenderUpdateMessage: true,
            removable: false,
            acl: {
                manage: "<admin>",
                create: "<admin>",
                delete: "<admin>",
                modify: "<admin>",
                post: usersGroupAclEntry,
                read: usersGroupAclEntry
            },
            notifications: "group:" + this.section.sectionData.group.id
        };
    }
    
    createReceiver(): privfs.message.MessageReceiver {
        return ChatModuleService.createReceiver(this.getSink(), this.section.manager.sectionApi.gateway.getHost(), this.section.getName());
    }
    
    static createReceiver(sink: privfs.message.MessageSinkPriv, host: string, userName?: string): privfs.message.MessageReceiver {
        let user = new privfs.identity.User("chat-channel-" + sink.id + "#" + host, sink.pub, userName);
        return new privfs.message.MessageReceiver(sink, user);
    }
    
    getSinkIndex(): Q.Promise<SinkIndex> {
        if (!this.hasModule()) {
            return Q(null);
        }
        if (this.sinkIndexPromise == null) {
            this.sinkIndexPromise = Q().then(() => {
                return this.section.initStickers();
            })
            .then(() => {
                let sink = this.getSink();
                if (!sink) {
                    return;
                }
                let index = this.section.manager.sinkIndexManager.getIndexBySinkId(sink.id);
                if (index != null) {
                    index.sink = sink;
                    index.loadAllEntriesFromCache = false;
                    index.useStorage = true;
                    index.sendModificationToServer = false;
                    index.autoMarkMyMessagesAsRead = true;
                    index.autoCorrectTags = false;
                    index.onBeforeAddEntry = this.onBeforeSinkIndexEntryAdd.bind(this);
                    index.includeStatsToCombined = () => this.section.isChatModuleEnabled();
                    return index;
                }
                return this.section.manager.sinkIndexManager.addSinkM({
                    sink: sink,
                    load: true,
                    loadLastCount: 30,
                    preLoad: true,
                    sinkIndexModifier: index => {
                        index.loadAllEntriesFromCache = false;
                        index.useStorage = true;
                        index.sendModificationToServer = false;
                        index.autoMarkMyMessagesAsRead = true;
                        index.autoCorrectTags = false;
                        index.onBeforeAddEntry = this.onBeforeSinkIndexEntryAdd.bind(this);
                        index.includeStatsToCombined = () => this.section.isChatModuleEnabled();
                        index.useReadIndex = true;
                        index.settingsStorage = this.section.manager.settingsStorage;
                    }
                })
                .then(sinkIndex => {
                    this.sinkIndex = sinkIndex;
                    this.filesMessagesCollection = new FilteredCollection(this.sinkIndex.entries, sinkIndexEntry => {
                        if (sinkIndexEntry.source.data.contentType != "application/json") {
                            return false;
                        }
                        let data = sinkIndexEntry.getContentAsJson();
                        return data && (data.type == "create-file" || data.type == "rename-file" || data.type == "delete-file" || data.type == "save-file" || data.type == "delete-directory" || data.type == "delete-directory-permanent");
                    });
                    this.chatMessagesCollection = new FilteredCollection(this.sinkIndex.entries, sinkIndexEntry => {
                        return sinkIndexEntry.source.data.contentType != "application/json";
                    });
                    return this.sinkIndex;
                });
            });
        }
        return this.sinkIndexPromise;
    }
    
    onBeforeSinkIndexEntryAdd(entry: SinkIndexEntry) {
        if (entry.source.data.sender.pub58 == this.section.manager.identity.pub58) {
            entry.addMods([{
                type: "setFlag",
                name: "read",
                value: true
            }]);
        }
    }
    
    static createMessage(messageSender: utils.MessageSender, receivers: privfs.message.MessageReceiver[], options: section.SendMessageOptions): privfs.message.Message {
        let message = messageSender.createMessage(receivers, ChatModuleService.CHAT_MESSAGE_TITLE, options.text || "");
        message.setType(ChatModuleService.CHAT_MESSAGE_TYPE);
        message.contentType = options.type || "html";
        (options.attachments || []).forEach(x => {
            message.addAttachment(x);
        });
        if (options.deleted != null) {
            message.deleted = options.deleted;
        }
        return message;
    }
    
    static createJsonMessage(messageSender: utils.MessageSender, receivers: privfs.message.MessageReceiver[], options: section.SendJsonMessageOptions): privfs.message.Message {
        return ChatModuleService.createMessage(messageSender, receivers, {text: JSON.stringify(options.data), attachments: options.attachments, type: options.type || "application/json"});
    }
    
    static createMessageWithAttachment(messageSender: utils.MessageSender, receivers: privfs.message.MessageReceiver[], attachment: privfs.lazyBuffer.IContent): privfs.message.Message {
        return ChatModuleService.createMessage(messageSender, receivers, {attachments: [attachment]});
    }
    
    createMessage(options: section.SendMessageOptions): privfs.message.Message {
        return ChatModuleService.createMessage(this.section.manager.messageSender, [this.createReceiver()], options);
    }
    
    createJsonMessage(options: section.SendJsonMessageOptions): privfs.message.Message {
        return ChatModuleService.createJsonMessage(this.section.manager.messageSender, [this.createReceiver()], options);
    }
    
    createMessageWithAttachment(attachment: privfs.lazyBuffer.IContent): privfs.message.Message {
        return ChatModuleService.createMessageWithAttachment(this.section.manager.messageSender, [this.createReceiver()], attachment);
    }
    
    sendPreparedMessage(message: privfs.message.Message): Q.Promise<privfs.types.message.ReceiverData> {
        return Q().then(() => {
            if (!this.hasModule()) {
                throw new Error("chat-module-not-available");
            }
            return this.section.manager.messageSender.sendSimpleMessage(message, null, true);
        })
        .then(result => {
            if (result.length != 1) {
                throw new Error("invalid-send-message-result");
            }
            return result[0];
        });
    }
    
    editPreparedMessage(originalMessageId: number, message: privfs.message.Message): Q.Promise<privfs.message.SentMessage> {
        return Q().then(() => {
            if (!this.hasModule()) {
                throw new Error("chat-module-not-available");
            }
            return this.section.manager.messageSender.editSimpleMessage(originalMessageId, message, true);
        });
    }
    
    sendTaggedPreparedMessage(message: privfs.message.Message, tags: string[]): Q.Promise<privfs.types.message.ReceiverData> {
        return Q().then(() => {
            if (!this.hasModule()) {
                throw new Error("chat-module-not-available");
            }
            return this.section.manager.messageSender.sendSimpleMessage(message, null, true, tags);
        })
        .then(result => {
            if (result.length != 1) {
                throw new Error("invalid-send-message-result");
            }
            return result[0];
        });
    }
    
    sendMessage(options: section.SendMessageOptions): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendPreparedMessage(this.createMessage(options));
    }
    
    editMessage(originalMessageId: number, options: section.SendMessageOptions): Q.Promise<privfs.message.SentMessage> {
        return this.editPreparedMessage(originalMessageId, this.createMessage(options));
    }
    
    sendJsonMessage(options: section.SendJsonMessageOptions): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendPreparedMessage(this.createJsonMessage(options));
    }
    
    sendTaggedJsonMessage(options: section.SendJsonMessageOptions, tags: string[]): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendTaggedPreparedMessage(this.createJsonMessage(options), tags);
    }
    
    sendMessageWithAttachment(attachment: privfs.lazyBuffer.IContent): Q.Promise<section.SendAttachmentResult> {
        return Q().then(() => {
            return this.sendPreparedMessage(this.createMessageWithAttachment(attachment));
        })
        .then(res => {
            if (!res.success || res.message == null || res.message.attachments.length != 1) {
                return Q.reject({message: "send-msg-error", result: res});
            }
            return {
                result: res,
                openableElement: shelltypes.OpenableAttachment.create(res.message.attachments[0], true, true)
            };
        });
    }

    sendSaveFileMessage(sectionId: string, path: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "save-file",
            path: path,
            sectionId: sectionId,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }
    
    sendCreateFileMessage(path: string, size: number, mimeType: string, did: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "create-file",
            did: did,
            path: path,
            size: size,
            mimeType: mimeType,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }
    
    sendTrashFileMessage(path: string, trashPath: string, mimeType: string, did: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "delete-file",
            did: did,
            path: path,
            trashPath: trashPath,
            mimeType: mimeType,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }
    
    sendDeleteFileMessage(path: string, mimeType: string, did: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "delete-file-permanent",
            did: did,
            path: path,
            mimeType: mimeType,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }
    
    sendRenameFileMessage(oldPath: string, newPath: string, mimeType: string, did: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "rename-file",
            did: did,
            oldPath: oldPath,
            newPath: newPath,
            mimeType: mimeType,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }

    sendMoveFileMessage(oldPath: string, newPath: string, oldSectionId: string, newSectionId: string, mimeType: string, did: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "move-file",
            did: did,
            oldPath: oldPath,
            newPath: newPath,
            oldSectionId: oldSectionId,
            newSectionId: newSectionId,
            mimeType: mimeType,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }

    
    sendCreateDirectoryMessage(path: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "create-directory",
            path: path,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }
    
    sendTrashDirectoryMessage(path: string, trashPath: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "delete-directory",
            path: path,
            trashPath: trashPath,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }
    
    sendDeleteDirectoryMessage(path: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "delete-directory-permanent",
            path: path,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }
    
    sendRenameDirectoryMessage(oldPath: string, newPath: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: "rename-directory",
            oldPath: oldPath,
            newPath: newPath,
            moduleName: section.NotificationModule.NOTES2,
        }});
    }

    sendVoiceChatActivityMessage(type: "joined-voicechat" | "left-voicechat", who: string): Q.Promise<privfs.types.message.ReceiverData> {
        return this.sendJsonMessage({data: {
            type: type,
            who: who,
            moduleName: section.NotificationModule.CHAT,
        }});
    }
    

    sendTaskMessage(type: "create-task" | "modify-task" | "delete-task", who: string, id: string, label: string, name: string,
        description: string, status: string, statusLocaleName: string, numOfStatuses: number, taskLabelClass: string, priority: number,
        assignedTo: string[]): Q.Promise<privfs.types.message.ReceiverData> {
        
        let data = this.sendJsonMessage({data: {
            type: type,
            who: who,
            status: status,
            statusLocaleName: statusLocaleName,
            numOfStatuses: numOfStatuses,
            taskLabelClass: taskLabelClass,
            priority: priority,
            assignedTo: assignedTo,
            id: id,
            label: label,
            name: name,
            description: description,
            moduleName: section.NotificationModule.TASKS,
        }});
        return data;
    }
}

export class KvdbModuleService implements ModuleService {
    
    static MODULE_NAME: string = "kvdb";
    static FACTORY: ModuleFactory = section => new KvdbModuleService(section);
    
    creatingPromise: Q.Promise<void>;
    kvdbPromise: Q.Promise<privfs.db.KeyValueDb<any>>;
    kvdbCollectionPromise: Q.Promise<KvdbCollection<any>>;
    extKey: privfs.crypto.ecc.ExtKey;
    kvdb: privfs.db.KeyValueDb<any>;
    kvdbCollection: KvdbCollection<any>;
    
    constructor(public section: SectionService) {
    }
    
    hasModule(): boolean {
        return this.section.secured != null && this.section.secured.modules != null && this.section.secured.modules[KvdbModuleService.MODULE_NAME] != null;
    }
    
    isEnabled(): boolean {
        return this.hasModule() && this.section.secured.modules[KvdbModuleService.MODULE_NAME].enabled;
    }
    
    getExtKey(): privfs.crypto.ecc.ExtKey {
        if (!this.hasModule()) {
            return null;
        }
        if (this.extKey == null) {
            this.extKey = privfs.crypto.ecc.ExtKey.fromBase58(this.section.secured.modules[KvdbModuleService.MODULE_NAME].data);
        }
        return this.extKey;
    }
    
    createModule(enabled?: boolean): Q.Promise<void> {
        if (this.hasModule()) {
            return Q.reject("module-already-created");
        }
        if (this.creatingPromise == null) {
            let extKey: privfs.crypto.ecc.ExtKey;
            this.creatingPromise = Q().then(() => {
                extKey = privfs.crypto.serviceSync.eccExtRandom();
                return this.section.manager.kvdbCollectionManager.manager.createByExtKey(extKey, this.getKvdbOptions());
            })
            .then(() => {
                return this.section.updateEx(data => {
                    if (!data.data.modules) {
                        data.data.modules = {};
                    }
                    data.data.modules[KvdbModuleService.MODULE_NAME] = {
                        enabled: enabled !== false,
                        data: extKey.getPrivatePartAsBase58()
                    };
                    return data;
                });
            })
            .fin(() => {
                this.creatingPromise = null;
            });
        }
        return this.creatingPromise;
    }
    
    getKvdbOptions(): privfs.types.db.KeyValueDbOptions {
        return SectionUtils.getKvdbOptionsForGroup(this.section.sectionData.group.id);
    }
    
    getKvdb<T = any>(): Q.Promise<privfs.db.KeyValueDb<T>> {
        if (!this.hasModule()) {
            return Q(null);
        }
        if (this.kvdbPromise == null) {
            this.kvdbPromise = Q().then(() => {
                let extKey = this.getExtKey();
                return this.section.manager.kvdbCollectionManager.manager.getOrCreateByExtKey(extKey, this.getKvdbOptions());
            })
            .then(kvdb => {
                return this.kvdb = kvdb;
            });
        }
        return this.kvdbPromise;
    }
    
    getKvdbCollection<T = any>(): Q.Promise<KvdbCollection<T>> {
        if (!this.hasModule()) {
            return Q(null);
        }
        if (this.kvdbCollectionPromise == null) {
            this.kvdbCollectionPromise = Q().then(() => {
                return this.getKvdb<T>();
            })
            .then(kvdb => {
                return this.section.manager.kvdbCollectionManager.getByKvdb(kvdb);
            })
            .then(kvdbCollection => {
                return this.kvdbCollection = kvdbCollection;
            });
        }
        return this.kvdbCollectionPromise;
    }
}

export class CalendarModuleService implements ModuleService {
    
    static MODULE_NAME: string = "calendar";
    static FACTORY: ModuleFactory = section => new CalendarModuleService(section);
    
    creatingPromise: Q.Promise<void>;
    
    constructor(public section: SectionService) {
    }
    
    hasModule(): boolean {
        return this.section.secured != null && this.section.secured.modules != null && this.section.secured.modules[CalendarModuleService.MODULE_NAME] != null;
    }
    
    isEnabled(): boolean {
        return this.hasModule() && this.section.secured.modules[CalendarModuleService.MODULE_NAME].enabled;
    }
    
    createModule(enabled?: boolean): Q.Promise<void> {
        if (this.hasModule()) {
            return Q.reject("module-already-created");
        }
        if (this.creatingPromise == null) {
            this.creatingPromise = Q().then(() => {
                return this.section.updateEx(data => {
                    if (!data.data.modules) {
                        data.data.modules = {};
                    }
                    data.data.modules[CalendarModuleService.MODULE_NAME] = {
                        enabled: enabled !== false,
                        data: null,
                    };
                    return data;
                });
            })
            .fin(() => {
                this.creatingPromise = null;
            });
        }
        return this.creatingPromise;
    }
    
}

export class FileSystemModuleService implements ModuleService {
    
    static MODULE_NAME: string = "file";
    static FACTORY: ModuleFactory = section => new FileSystemModuleService(section);
    
    creatingPromise: Q.Promise<void>;
    fileSystemPromise: Q.Promise<privfs.fs.file.FileSystem>;
    zPromise: Q.Promise<privfs.core.ZPromise<privfs.types.descriptor.IDescriptorManager, privfs.fs.file.FileSystem>>;
    fileTreePromise: Q.Promise<filetree.nt.Tree>;
    rootRef: privfs.fs.descriptor.ref.DescriptorRefWrite;
    fileSystem: privfs.fs.file.FileSystem;
    fileTree: filetree.nt.Tree;
    
    constructor(public section: SectionService) {
    }
    
    hasModule(): boolean {
        return this.section.secured != null && this.section.secured.modules != null && this.section.secured.modules[FileSystemModuleService.MODULE_NAME] != null;
    }
    
    isEnabled(): boolean {
        return this.hasModule() && this.section.secured.modules[FileSystemModuleService.MODULE_NAME].enabled;
    }
    
    createModule(enabled?: boolean): Q.Promise<void> {
        if (this.hasModule()) {
            return Q.reject("module-already-created");
        }
        if (this.creatingPromise == null) {
            let descriptorRef: privfs.fs.descriptor.ref.DescriptorRefWrite;
            let fs: privfs.fs.file.FileSystem;
            this.creatingPromise = Q().then(() => {
                descriptorRef = privfs.fs.descriptor.ref.DescriptorRefWrite.generate(this.section.manager.sectionApi.gateway.getHost());
                fs = this.section.manager.client.getFileSystem(descriptorRef);
                fs.fsd.defaultOptions = {acl: this.getDescriptorAcl()};
                return fs.init();
            })
            .then(() => {
                return this.section.updateEx(data => {
                    if (!data.data.modules) {
                        data.data.modules = {};
                    }
                    data.data.modules[FileSystemModuleService.MODULE_NAME] = {
                        enabled: enabled !== false,
                        data: descriptorRef.extPriv58
                    };
                    return data;
                });
            })
            .fin(() => {
                this.creatingPromise = null;
            });
        }
        return this.creatingPromise;
    }
    
    getDescriptorAcl(): privfs.types.descriptor.DescriptorAcl {
        return SectionUtils.getAclForGroup(this.section.sectionData.group.id);
    }
    
    getRootRef(): privfs.fs.descriptor.ref.DescriptorRefWrite {
        if (!this.hasModule()) {
            return null;
        }
        if (this.rootRef == null) {
            let refRaw = this.section.secured.modules[FileSystemModuleService.MODULE_NAME].data;
            this.rootRef = privfs.fs.descriptor.ref.DescriptorRefWrite.fromExtKey(refRaw, this.section.manager.sectionApi.gateway.getHost());
        }
        return this.rootRef;
    }
    
    getFileSystemZ(): Q.Promise<privfs.core.ZPromise<privfs.types.descriptor.IDescriptorManager, privfs.fs.file.FileSystem>> {
        if (!this.hasModule()) {
            return Q(null);
        }
        if (this.fileSystemPromise != null) {
            return Q().then(() => {
                return privfs.core.ZPromise.create<privfs.types.descriptor.IDescriptorManager, privfs.fs.file.FileSystem>(() => {
                    return this.fileSystemPromise;
                });
            });
        }
        if (this.zPromise == null) {
            let postAction = (fs: privfs.fs.file.FileSystem) => {
                return Q().then(() => {
                    if (fs.root.handle.descriptor.acl) {
                        return;
                    }
                    return fs.root.handle.setAcl(this.getDescriptorAcl()).fail(e => {
                        Logger.error("Error during changing acl for root", e);
                    });
                })
                .then(() => {
                    return this.fileSystem = fs;
                });
            };
            this.zPromise = Q().then(() => {
                return this.section.initStickers();
            })
            .then(() => {
                return this.section.manager.settings.get("section:" + this.section.getId() + ":filesystem");
            })
            .then((data: privfs.types.descriptor.SerializedEntry) => {
                if (data) {
                    let urls = privfs.fs.file.entry.Directory.getUrlsFromEx([data]);
                    let dManager = this.section.manager.client.descriptorManager;
                    return Q.all(Object.keys(urls).filter(url => dManager.getCreateCache(url) != null).map(url => dManager.getCache(url))).thenResolve(data);
                }
                return data;
            })
            .then(data => {
                let ref = this.getRootRef();
                let fs = this.section.manager.client.getFileSystem(ref);
                fs.fsd.defaultOptions = {acl: this.getDescriptorAcl()};
                if (data) {
                    fs.root = privfs.fs.file.entry.Directory.deserializeEx(data, fs.fsd.manager);
                    this.fileSystemPromise = postAction(fs);
                    return privfs.core.ZPromise.create<privfs.types.descriptor.IDescriptorManager, privfs.fs.file.FileSystem>(() => {
                        return this.fileSystemPromise;
                    });
                }
                return fs.initZ().then(initZp => {
                    return privfs.core.ZPromise.create<privfs.types.descriptor.IDescriptorManager, privfs.fs.file.FileSystem>(dm => {
                        if (this.fileSystemPromise == null) {
                            this.fileSystemPromise = initZp.run(dm).then(() => postAction(fs));
                        }
                        return this.fileSystemPromise;
                    });
                });
            });
        }
        return this.zPromise;
    }
    
    getFileSystem(): Q.Promise<privfs.fs.file.FileSystem> {
        if (this.fileSystemPromise != null) {
            return this.fileSystemPromise;
        }
        return this.section.manager.client.descriptorManager.performDeferredAction(this.getFileSystemZ());
    }
    
    getFileTree(): Q.Promise<filetree.nt.Tree> {
        if (!this.hasModule()) {
            return Q(null);
        }
        if (this.fileTreePromise == null) {
            this.fileTreePromise = Q().then(() => {
                return this.getFileSystem();
            })
            .then(fs => {
                return this.fileTree = new filetree.nt.Tree(fs, this.section);
            });
        }
        return this.fileTreePromise;
    }
    
    dumpFileSystem(): Q.Promise<void> {
        return Q().then(() => {
            if (this.fileSystem == null) {
                return;
            }
            return this.section.manager.settings.set("section:" + this.section.getId() + ":filesystem", this.fileSystem.root.serializeEx(true));
        });
    }
    
    // nowa wersja uploadu pliku
    createEx2(fs: privfs.fs.file.FileSystem, pathStr: string, content: IContent, nameResolver: privfs.types.descriptor.NameResolverFactoryT, options?: privfs.types.descriptor.DNVOptions) {
        return Q().then(() => {
            return fs.resolvePath(pathStr);
        })
        .then(path => {
            let usedPath = path;
            let version: privfs.types.descriptor.VersionSnapshot;
            return Q().then(() => {
                let tryOpen = (): Q.Promise<privfs.fs.descriptor.Handle> => {
                    return Q().then(() => {
                        return path.directory.getEntries();
                    })
                    .then(entries => {
                        usedPath = path
                        if (entries.hasName(usedPath.name)) {
                            let nResolver = privfs.fs.file.entry.SimpleNameResolver.getNameResolver(nameResolver, true, usedPath.name);
                            if (nResolver == null) {
                                throw new privfs.exception.PrivFsException("FILE_ALREADY_EXISTS", usedPath.path);
                            }
                            while (entries.hasName(usedPath.name)) {
                                let entryName = nResolver.getNextName();
                                if (entryName == null) {
                                    throw new privfs.exception.PrivFsException("FILE_ALREADY_EXISTS", path.path);
                                }
                                usedPath = fs.fsd.createResolvedPath(path, entryName);
                            }
                        }
                        if (version) {
                            return;
                        }
                        return fs.fsd.manager.create(null, content, "file", false, fs.fsd.getDNVOptions(options)).then(v => {
                            version = v;
                        });
                    })
                    .then(() => {
                        let newEntry = new privfs.fs.file.entry.Entry(usedPath.name, "file", version.ref);
                        return path.directory.addEntry(newEntry, true).fail(e => {
                            if (privfs.exception.PrivFsException.is(e, "FILE_ALREADY_EXISTS")) {
                                return tryOpen();
                            }
                            return Q.reject<privfs.fs.descriptor.Handle>(e);
                        });
                    });
                };
                return tryOpen().thenResolve(version);
            })
            .then(version => {
                return {
                    path: usedPath.path,
                    version: version
                };
            });
        });
    }
    
    uploadFile(options: section.UploadFileTreeOptions): Q.Promise<section.UploadFileTreeResult> {
        let elementMoved = false;
        return Q().then(() => {
            this.section.manager.fileSizeChecker.checkFileSize(options.data.getSize());
            if (!this.hasModule()) {
                throw new Error("file-module-not-available");
            }
            return this.getFileSystem();
        })
        .then(fs => {
            let dstPath = filetree.nt.Helper.resolvePath(options.path || "/", options.data.getName());
            let acl = this.getDescriptorAcl();
            let fOptions = options.fileOptions || {};
            if (!fOptions.acl) {
                fOptions.acl = acl;
            }
            if (options.copyFrom) {
                let copyInfo = this.section.manager.resolveFileId(options.copyFrom);
                return copyInfo.section.getFileSystem().then(srcFs => {
                    let copyDstPath: string;
                    return srcFs.shell.copy(copyInfo.path, dstPath, fOptions, options.conflictBehavior, (r, s) => {
                        if (!copyDstPath && r.status == privfs.fs.file.multi.OperationStatus.FILE_CREATE_SUCCESS) {
                            copyDstPath = r.operation.destination.path;
                        }
                        if (options.statusCallback) {
                            return options.statusCallback(r, s);
                        }
                    }, fs.shell)
                    .then(() => {
                        if (!copyDstPath) {
                            return Q.reject<string>("not-performed");
                        }
                        return copyDstPath;
                    });
                })
            }
            if (options.elementToMove) {
                elementMoved = false;
                let moveInfo = this.section.manager.resolveFileId(options.elementToMove);
                return moveInfo.section.getFileSystem().then(srcFs => {
                    let moveDstPath: string;
                    return srcFs.shell.move(moveInfo.path, dstPath, fOptions, options.conflictBehavior, (r, s) => {
                        if (r.status == privfs.fs.file.multi.OperationStatus.FILE_MOVE_SUCCESS && r.operation.source.path == moveInfo.path) {
                            elementMoved = true;
                        }
                        if (moveDstPath && r.status == privfs.fs.file.multi.OperationStatus.FILE_REMOVE_SUCCESS && r.operation.source.path == moveInfo.path) {
                            elementMoved = true;
                        }
                        if (!moveDstPath && r.status == privfs.fs.file.multi.OperationStatus.FILE_CREATE_SUCCESS || r.status == privfs.fs.file.multi.OperationStatus.FILE_MOVE_SUCCESS) {
                            moveDstPath = r.operation.destination.path;
                        }
                        if (options.statusCallback) {
                            return options.statusCallback(r, s);
                        }
                    }, fs.shell)
                    .then(() => {
                        if (!moveDstPath) {
                            return Q.reject<string>("not-performed");
                        }
                        return moveDstPath;
                    });
                });
            }
            return this.createEx2(fs, dstPath, options.data, true, fOptions).then(x => x.path);
        })
        .then(path => {
            return this.getOpenableElement(path, true).then(openableElement => {
                return Q().then(() => {
                    if (openableElement.mimeType == "application/x-stt" || openableElement.mimeType == "application/x-smm") {
                        return openableElement.getText().then(text => {
                            let styleStr = FileStyleResolver.resolveStyleStrFromContentString(text);
                            if (styleStr) {
                                return openableElement.fileSystem.updateMeta(path, meta => {
                                    (<any>meta).styleStr = styleStr;
                                });
                            }
                        });
                    }
                })
                .fail((e) => {
                    console.log(e);
                })
                .then(() => {
                    return {
                        entryId: openableElement.id,
                        path: path,
                        openableElement: openableElement,
                        elementMoved: elementMoved
                    };
                });
            });
        });
    }
    
    removeFile(path: string): Q.Promise<section.OperationResult> {
        return Q().then(() => {
            if (!this.hasModule()) {
                throw new Error("file-module-not-available");
            }
            return this.getFileSystem();
        })
        .then(fs => {
            return fs.removeFile(path);
        })
        .then(() => {
            let res: section.OperationResult = {
                success: true,
                error: null
            };
            return res;
        })
        .fail(e => {
            let res: section.OperationResult = {
                success: false,
                error: e
            };
            return res;
        });
    }
    
    getOpenableElement(path: string, resolveMimeType: boolean, cache?: boolean): Q.Promise<OpenableSectionFile> {
        return Q().then(() => {
            return this.getFileSystem();
        })
        .then(fs => {
            let openable = new OpenableSectionFile(this.section, fs, path, resolveMimeType, cache);
            return openable.refresh().thenResolve(openable);
        });
    }
    
    exportFiles(zip: boolean = false): Q.Promise<privfs.lazyBuffer.Content> {
        return Q().then(() => {
            return this.getFileSystem();
        })
        .then(fileSystem => {
            if (zip) {
                return ZipFileExporter.exportFileSystem(fileSystem, "");
            }
            else {
                return FileExporter.exportFileSystem(fileSystem, "");
            }
        });
    }
}

export class FileExporter {
    
    static exportDirectoryT(fileSystem: privfs.fs.file.FileSystem, directoryPath: string, tarPack: TarPack, prefixPath: string): Q.Promise<void> {
        return Q().then(() => {
            return fileSystem.list(directoryPath);
        })
        .then(entries => {
            return PromiseUtils.oneByOne(entries, (_, entry) => {
                let entryPath = filetree.nt.Helper.resolvePaths(directoryPath, entry.name);
                if (entry.isFile()) {
                    return fileSystem.read(entryPath).then(content => {
                        let tarName = filetree.nt.Helper.resolvePaths(prefixPath, entryPath).replace(/^\/+/gm, "");
                        tarPack.entry({name: tarName}, content.getBuffer());
                    });
                }
                else if (entry.isDirectory()) {
                    return FileExporter.exportDirectoryT(fileSystem, entryPath, tarPack, prefixPath);
                }
            });
        });
    }
    
    static exportDirectory(fileSystem: privfs.fs.file.FileSystem, directoryPath: string, prefixPath: string): Q.Promise<privfs.lazyBuffer.Content> {
        return TarHelper.withTar(tarPack => {
            return FileExporter.exportDirectoryT(fileSystem, directoryPath, tarPack, prefixPath);
        });
    }
    
    static exportFileSystemT(fileSystem: privfs.fs.file.FileSystem, tarPack: TarPack, prefixPath: string): Q.Promise<void> {
        return FileExporter.exportDirectoryT(fileSystem, "/", tarPack, prefixPath);
    }
    
    static exportFileSystem(fileSystem: privfs.fs.file.FileSystem, prefixPath: string): Q.Promise<privfs.lazyBuffer.Content> {
        return TarHelper.withTar(tarPack => {
            return FileExporter.exportFileSystemT(fileSystem, tarPack,  prefixPath);
        });
    }
}

export class ZipFileExporter {
    
    static exportDirectoryT(fileSystem: privfs.fs.file.FileSystem, directoryPath: string, zipPack: ZipPack, prefixPath: string): Q.Promise<void> {
        return Q().then(() => {
            return fileSystem.list(directoryPath);
        })
        .then(entries => {
            return PromiseUtils.oneByOne(entries, (_, entry) => {
                let entryPath = filetree.nt.Helper.resolvePaths(directoryPath, entry.name);
                if (entry.isFile()) {
                    return fileSystem.read(entryPath).then(content => {
                        let zipName = filetree.nt.Helper.resolvePaths(prefixPath, entryPath).replace(/^\/+/gm, "");
                        zipPack.file(zipName, content.getBuffer().toString());
                    });
                }
                else if (entry.isDirectory()) {
                    return ZipFileExporter.exportDirectoryT(fileSystem, entryPath, zipPack, prefixPath);
                }
            });
        });
    }
    
    static exportDirectory(fileSystem: privfs.fs.file.FileSystem, directoryPath: string, prefixPath: string): Q.Promise<privfs.lazyBuffer.Content> {
        return ZipHelper.withZip(zipPack => {
            return ZipFileExporter.exportDirectoryT(fileSystem, directoryPath, zipPack, prefixPath);
        });
    }
    
    static exportFileSystemT(fileSystem: privfs.fs.file.FileSystem, zipPack: ZipPack, prefixPath: string): Q.Promise<void> {
        return ZipFileExporter.exportDirectoryT(fileSystem, "/", zipPack, prefixPath);
    }
    
    static exportFileSystem(fileSystem: privfs.fs.file.FileSystem, prefixPath: string): Q.Promise<privfs.lazyBuffer.Content> {
        return ZipHelper.withZip(zipPack => {
            return ZipFileExporter.exportFileSystemT(fileSystem, zipPack, prefixPath);
        });
    }
}

export class OpenableSectionFile extends shelltypes.OpenableFile {
    
    id: section.SectionFileId;
        
    constructor(
        public section: SectionService,
        fileSystem: privfs.fs.file.FileSystem,
        path: string,
        resolveMimeType: boolean,
        cacheBlocksInfo?: boolean
    ) {
        super(fileSystem, path, resolveMimeType, cacheBlocksInfo);
        this.id = filetree.nt.Entry.getId(this.section.getId(), path);
    }
    
    equals(ele: shelltypes.OpenableElement): boolean {
        return this == ele || (ele instanceof OpenableSectionFile && ele.id == this.id);
    }
    
    hasElementId(): boolean {
        return true;
    }
    
    getElementId(): string {
        return this.id;
    }
}