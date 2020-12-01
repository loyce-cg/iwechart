import {SectionApi} from "./SectionApi";
import {SectionKeyManager} from "./SectionKeyManager";
import {SectionService} from "./SectionService";
import {ModuleFactory, ModuleFactoryObj, ModuleService, OpenableSectionFile, FileExporter, ZipFileExporter, ChatModuleService} from "./ModuleService";
import {MutableCollection} from "../../utils/collection/MutableCollection";
import {FilteredCollection} from "../../utils/collection/FilteredCollection";
import {Lang} from "../../utils/Lang";
import {section, utils, event} from "../../Types";
import {SinkIndexManager} from "../SinkIndexManager";
import {PromiseUtils} from "simplito-promise";
import * as RootLogger from "simplito-logger";
import * as Q from "q";
import * as privfs from "privfs-client";
import * as filetree from "../filetree";
import {KvdbSettingsStorage} from "../KvdbSettingsStorage";
import {KvdbCollectionManager} from "../kvdb/KvdbCollectionManager";
import {SectionUtils} from "./SectionUtils";
import {SinkIndex} from "../SinkIndex";
import {KvdbCollection} from "../kvdb/KvdbCollection";
import {SectionConversationService} from "./SectionConversationService";
import {UserPreferencesService} from "./UserPreferencesService";
import {SubidentityService} from "../subidentity/SubidentityService";
import {SubidentityKeyUpdater} from "./SubidentityKeyUpdater";
import {UserPreferences} from "../UserPreferences";
import {Utils} from "../../utils/Utils";
import { ContactService } from "../contact";
import { HashmailResolver } from "../HashmailResolver";
import { SectionAccessManager } from "./SectionAccessManager";
import { ZipHelper, ZipPack } from "../../utils/ZipHelper";
import { TarHelper, TarPack, EventDispatcher } from "../../utils";
import { LocaleService } from "..";
import { CustomSectionNamesManager } from "./CustomSectionNamesManager";
import { PersonService } from "../person/PersonService";
let Logger = RootLogger.get("privfs-mail-client.mail.section.SectionManager");

export interface SectionMapEntry {
    id: string;
    parent: SectionMapEntry;
    section: SectionService;
    children: SectionMapEntry[];
}

export class SectionMap {
    
    sectionMap: {[id: string]: SectionMapEntry};
    
    constructor(
        public collection: MutableCollection<SectionService>
    ) {
        this.sectionMap = {};
    }
    
    getMapEntry(id: string): SectionMapEntry {
        let mapEntry = this.sectionMap[id];
        if (mapEntry == null) {
            this.sectionMap[id] = mapEntry = {
                id: id,
                parent: null,
                section: null,
                children: []
            };
        }
        return mapEntry;
    }
    
    triggerParentsUpdate(mapEntry: SectionMapEntry) {
        let curr = mapEntry;
        while (curr) {
            if (curr.section) {
                this.collection.updateElement(curr.section);
            }
            curr = curr.parent;
        }
    }
    
    onAdd(section: SectionService) {
        return this.onUpdate(section);
    }
    
    onRemove(section: SectionService) {
        this.onRemoveById(section.getId());
    }
    
    onRemoveById(id: string) {
        let mapEntry = this.getMapEntry(id);
        let oldSection = mapEntry.section;
        mapEntry.section = null;
        if (mapEntry.parent != null) {
            Lang.removeBy(mapEntry.parent.children, x => x.id == id);
        }
        mapEntry.parent = null;
        if (oldSection) {
            this.collection.remove(oldSection);
        }
        this.triggerParentsUpdate(mapEntry.parent);
        mapEntry.children.forEach(x => {
            if (x.section) {
                this.collection.updateElement(x.section);
            }
        });
    }
    
    onUpdate(section: SectionService) {
        let id = section.getId();
        let mapEntry = this.getMapEntry(id);
        let oldSection = mapEntry.section;
        mapEntry.section = section;
        section.mapEntry = mapEntry;
        let newParentId = section.sectionData.parentId;
        let oldParent = mapEntry.parent;
        if (mapEntry.parent == null || mapEntry.parent.id != newParentId) {
            if (mapEntry.parent) {
                Lang.removeBy(mapEntry.parent.children, x => x.id == id);
            }
            if (newParentId) {
                let parentEntry = this.getMapEntry(newParentId);
                mapEntry.parent = parentEntry;
                parentEntry.children.push(mapEntry);
            }
            else {
                mapEntry.parent = null;
            }
        }
        if (oldSection == null) {
            this.collection.add(section);
            mapEntry.children.forEach(x => {
                if (x.section) {
                    this.collection.updateElement(x.section);
                }
            });
        }
        else {
            this.collection.updateElement(section);
        }
        if (oldParent != mapEntry.parent) {
            this.triggerParentsUpdate(oldParent);
        }
        this.triggerParentsUpdate(mapEntry.parent);
    }
}

export interface SectionManagerOptions {
    fetchAllSection: boolean;
}

export class SectionManager {
    
    sectionsCollection: MutableCollection<SectionService>;
    managabledCollection: FilteredCollection<SectionService>;
    filteredCollection: FilteredCollection<SectionService>;
    rootSectionsCollection: FilteredCollection<SectionService>;
    modulesRegistry: {[moduleName: string]: ModuleFactory};
    loadingPromise: Q.Promise<void>;
    userPreferencesService: UserPreferencesService;
    sectionMap: SectionMap;
    customSectionNames: CustomSectionNamesManager;
    sectionsLimit: number;
    sectionsCount: number;

    constructor(
        public sectionApi: SectionApi,
        public sectionKeyManager: SectionKeyManager,
        public sectionAccessManager: SectionAccessManager,
        public client: privfs.core.Client,
        public settings: utils.IStorage,
        public settingsStorage: KvdbSettingsStorage,
        public kvdbCollectionManager: KvdbCollectionManager,
        public identity: privfs.identity.Identity,
        public sinkIndexManager: SinkIndexManager,
        public messageSender: utils.MessageSender,
        public subidentityService: SubidentityService,
        public subidentityKeyUpdater: SubidentityKeyUpdater,
        public userPreferences: UserPreferences,
        public sectionConversationService: SectionConversationService,
        public identityProvider: utils.IdentityProvider,
        public fileSizeChecker: utils.FileSizeChecker,
        public messageManager: privfs.message.MessageManager,
        public options: SectionManagerOptions,
        public stickersProvider: section.StickersProvider,
        public personService: PersonService,
        public contactService: ContactService,
        public hashmailResolver: HashmailResolver,
        public localeService: LocaleService,
        public eventDispatcher: EventDispatcher,
    ) {
        this.userPreferencesService = new UserPreferencesService(this, userPreferences);
        this.customSectionNames = new CustomSectionNamesManager(userPreferences);
        this.sectionsCollection = new MutableCollection<SectionService>();
        this.managabledCollection = new FilteredCollection<SectionService>(this.sectionsCollection, x => x.isValid(false) && !x.isPrivateOrUserGroup());
        this.filteredCollection = new FilteredCollection<SectionService>(this.sectionsCollection, x => x.isValid(true) && x.hasAccess());
        this.rootSectionsCollection = new FilteredCollection<SectionService>(this.filteredCollection, x => x.isRoot());
        this.modulesRegistry = {};
        this.sectionKeyManager.eventDispatcher.addEventListener("add", this.onKeyAdd.bind(this));
        this.sectionKeyManager.eventDispatcher.addEventListener("load", this.onKeyLoad.bind(this));
        this.sectionAccessManager.eventDispatcher.addEventListener("refresh-sections", this.onRefreshSections.bind(this));
        this.sectionAccessManager.eventDispatcher.addEventListener<event.SectionStateChangedEvent>("section-state-changed", this.onRefreshSections.bind(this));

        this.sectionMap = new SectionMap(this.sectionsCollection);
        this.contactService.contactCollection.changeEvent.add(this.removeUnusableSections.bind(this), "multi");
        this.loadingPromise = null;
    }
    
    //==================
    //     MODULES
    //==================
    
    getSupportedModules(): string[] {
        return Object.keys(this.modulesRegistry);
    }
    
    hasModuleService(moduleName: string): boolean {
        return moduleName in this.modulesRegistry;
    }
    
    createModuleService(moduleName: string, section: SectionService): ModuleService {
        return moduleName in this.modulesRegistry ? this.modulesRegistry[moduleName](section) : null;
    }
    
    registryModule(moduleName: string, factory: ModuleFactory): void {
        this.modulesRegistry[moduleName] = factory;
    }
    
    registryModuleEx(obj: ModuleFactoryObj): void {
        this.registryModule(obj.MODULE_NAME, obj.FACTORY);
    }
    
    //==================
    //      LOAD
    //==================
    
    load(): Q.Promise<void> {
        if (this.loadingPromise == null) {
            this.loadingPromise = Q().then(() => {
                return Q.all([
                    this.options.fetchAllSection ? this.sectionApi.sectionsGetAllEx() : this.sectionApi.sectionsGetEx(),
                    this.sectionKeyManager.loadKeys(),
                    // this.contactService.getContactsDb()
                ]);
            })
            .then(res => {
                this.sectionsLimit = res[0].limit;
                this.sectionsCount = res[0].count;
                return Q.all([
                    this.loadSectionData(res[0].sections),
                    this.isSectionsLimitReached()
                ])
                .then(res2 => {
                    let reached = res2[1];
                    this.eventDispatcher.dispatchEvent<event.SectionsLimitReachedEvent>({type: "sectionsLimitReached", reached: reached});
                    
                })
            })
            .fin(() => {
                this.loadingPromise = null;
            });
        }
        return this.loadingPromise;
    }
    
    loadSectionData(sections: section.SectionData[]): Q.Promise<void> {
        return Q().then(() => {
            let oldSectionIds = this.sectionsCollection.list.map(x => x.getId());
            oldSectionIds.forEach(id => {
                if (!Lang.containsFunc(sections, x => x.id == id)) {
                    this.sectionMap.onRemoveById(id);
                }
            });
            let sectionsToProcess = sections.filter(data => {
                if (this.isUnusable(data)) {
                    Logger.debug("Section not added - less than 2 users");
                    return false;
                }
                return true;
            });
            return PromiseUtils.oneByOne(sectionsToProcess, (_i, sectionData) => {
                return this.processSectionData(sectionData);
            });
        });
    }
    
    processSectionData(sectionData: section.SectionData): Q.Promise<SectionService> {
        return Q().then(() => {
            return this.sectionKeyManager.getKey(sectionData.id, sectionData.keyId);
        })
        .then(key => {
            let sectionService = this.getSection(sectionData.id);
            if (sectionService != null) {
                return Q().then(() => {
                    return sectionService.setKeyAndSectionData(key, sectionData);
                })
                .then(changed => {
                    if (changed) {
                        this.sectionMap.onUpdate(sectionService);
                    }
                    return sectionService;
                });
            }
            else {
                return Q().then(() => {
                    return SectionService.create(this, sectionData, this.userPreferencesService.getUserSettings(sectionData.id), this.identityProvider, key, this.hashmailResolver);
                })
                .then(sectionService => {
                    this.sectionMap.onAdd(sectionService);
                    return sectionService;
                });
            }
        })
    }
    
    removeUnusableSections() {
        // Logger.debug("Removing unusable section");
        // this.sectionsCollection.forEach(section => {
        //     if (this.isUnusable(section.sectionData)) {
        //         this.sectionMap.onRemove(section);
        //         Logger.debug("Section removed - less than 2 users");
        //     }
        // });
        
    }
    
    isUnusable(_data: section.SectionData): boolean {
        // if (!Lang.startsWith(data.id, "usergroup:")) {
        //     return false;
        // }
        // if (data.group && data.group.users && data.group.users.length >= 2) {
        //     let users = data.group.users;
        //     let nExistingUsers = 0;
        //     for (let user of users) {
        //         if (this.contactService.contactCollection.find(x => x.user.user == user)) {
        //             nExistingUsers++;
        //         }
        //     }
        //     if (nExistingUsers < 2) {
        //         return true;
        //     }
        // }
        return false;
        
    }
    
    syncToManager(manager: SectionManager): Q.Promise<void> {
        return PromiseUtils.oneByOne(this.sectionsCollection.list, (_i, x) => {
            if (!x.isDecrypted()) {
                return;
            }
            if (x.hasAccess()) {
                return manager.processSectionData(x.sectionData);
            }
            let index = manager.sectionsCollection.indexOfBy(y => y.getId() == x.getId());
            if (index != -1) {
                manager.sectionsCollection.removeAt(index);
            }
        });
    }
    
    setUserSettings(sectionId: string, settings: section.UserSettings) {
        let section = this.getSection(sectionId);
        if (!section) {
            return;
        }
        let changed = section.isUserSettingsChanged(settings);
        if (changed) {
            section.userSettings = settings;
            this.sectionMap.onUpdate(section);
        }
    }
    
    addSection(sectionId: section.SectionId): Q.Promise<SectionService> {
        return Q().then(() => {
            return this.sectionApi.sectionGet(sectionId);
        })
        .then(sectionData => {
            return this.processSectionData(sectionData);
        });
    }
    
    //==================
    //   GET & CREATE
    //==================
    
    getSection(id: string): SectionService {
        let mapEntry = this.sectionMap.sectionMap[id];
        return mapEntry ? mapEntry.section : null;
    }
    
    createSection(section: section.SectionCreateModelDecrypted, sendToAdminDb: boolean): Q.Promise<SectionService> {
        let key: section.SectionKey;
        return Q().then(() => {
            if (!section.id) {
                section.id = privfs.crypto.service.randomBytes(15).toString("hex");
            }
            if (section.id.length > 60) {
                throw new Error("Section id is too long '" + section.id + "'");
            }
            if (this.getSection(section.id) != null) {
                throw new Error("Section with id '" + section.id + "' already created");
            }
            return SectionUtils.isGroupTypePublic(section.group.type) || SectionUtils.hasAnyPublicUsersGroupsIn(section.group.users) ? this.sectionKeyManager.getPublicKey(section.id) : this.sectionKeyManager.generateKey(section.id);
        })
        .then(k => {
            key = k;
            return this.sectionKeyManager.storeKey(key);
        })
        .then(() => {
            return SectionService.encode(section.data, key.key);
        })
        .then(encrypted => {
            return this.sectionApi.sectionCreate({
                id: section.id,
                parentId: section.parentId,
                data: encrypted,
                keyId: key.keyId,
                group: section.group,
                state: section.state,
                acl: SectionUtils.serializeAcl(section.acl),
                primary: section.primary,
            });
        })
        .then(sectionData => {
            return this.processSectionData(sectionData);
        })
        .then(service => {
            this.sectionKeyManager.sendKey(key, SectionUtils.filterUsers(section.group.users.concat(section.acl.manage.users)), sendToAdminDb || section.acl.manage.admins);
            return service;
        });
    }
    
    createSectionWithModules(section: section.SectionCreateModelDecrypted, modules: section.ModuleInfo[], sendToAdminDb: boolean): Q.Promise<SectionService> {
        if (Lang.containsFunc(modules, x => !this.hasModuleService(x.name))) {
            return Q.reject("module-not-registered");
        }
        return Q().then(() => {
            return this.createSection(section, sendToAdminDb);
        })
        .then(service => {
            return PromiseUtils.oneByOne(modules, (_i, mdl) => {
                return service.getAndCreateModule(mdl.name, mdl.enabled);
            })
            .thenResolve(service);
        });
    }
    
    //==================
    //     HELPERS
    //==================
    
    getMyPrivateSection(): SectionService {
        return this.getSection(SectionUtils.getPrivateSectionId(this.identity.user));
    }
    
    getSectionByName(sectionName: string): SectionService {
        return this.sectionsCollection.find(x => x.getName() == sectionName);
    }
    
    getSectionBySinkId(sinkId: string): SectionService {
        return this.filteredCollection.find(x => x.hasChatModule() && x.getChatSink().id == sinkId);
    }
    
    getSectionBySink(sink: privfs.message.MessageSink): SectionService {
        return this.getSectionBySinkId(sink.id);
    }
    
    getSectionBySinkIndex(sinkIndex: SinkIndex): SectionService {
        return this.getSectionBySink(sinkIndex.sink);
    }
    
    getSectionByRootRefId(rootRefId: string): SectionService {
        return this.filteredCollection.find(x => x.hasFileModule() && x.getFileRootRef().id == rootRefId);
    }
    
    getSectionByRootRef(rootRef: privfs.fs.descriptor.ref.DescriptorRef): SectionService {
        return this.getSectionByRootRefId(rootRef.id);
    }
    
    getSectionByFileSystem(fs: privfs.fs.file.FileSystem): SectionService {
        return this.getSectionByRootRef(fs.root.ref);
    }
    
    getSectionByFileTree(fileTree: filetree.nt.Tree): SectionService {
        return this.getSectionByFileSystem(fileTree.fileSystem);
    }
    
    getSectionByKvdbExtKey58(extKey58: string): SectionService {
        return this.filteredCollection.find(x => x.hasKvdbModule() && x.getKvdbExtKey().getPrivatePartAsBase58() == extKey58);
    }
    
    getSectionByKvdbExtKey(extKey: privfs.crypto.ecc.ExtKey): SectionService {
        return this.getSectionByKvdbExtKey58(extKey.getPrivatePartAsBase58());
    }
    
    getSectionByKvdb(kvdb: privfs.db.KeyValueDb<any>): SectionService {
        return this.getSectionByKvdbExtKey(kvdb.extKey);
    }
    
    getSectionByKvdbCollection(kvdbCollection: KvdbCollection<any>): SectionService {
        return this.getSectionByKvdb(kvdbCollection.kvdb);
    }
    
    //==================
    //      KEYS
    //==================
    
    onKeyAdd(event: {type: string, key: section.SectionKey, source: string}): void {
        this.onKey(event.key);
        if (this.getSection(event.key.sectionId) == null && event.source == "mail") {
            this.load().fail(e => {
                Logger.error("Error during reloading after mail", e);
            });
        }
    }
    
    onKeyLoad(): void {
        for (let keyMapId in this.sectionKeyManager.keysMap) {
            let key = this.sectionKeyManager.keysMap[keyMapId];
            this.onKey(key);
        }
    }
    
    onKey(key: section.SectionKey): void {
        let section = this.getSection(key.sectionId);
        if (section != null && section.key != key && key.keyId == section.sectionData.keyId) {
            Q().then(() => {
                return section.setKey(key);
            })
            .then(changed => {
                if (changed) {
                    this.sectionMap.onUpdate(section);
                }
            })
            .fail(e => {
                Logger.error("Error during assigning key to section", e);
            });
        }
        this.subidentityKeyUpdater.checkKey(key);
    }
    
    onRefreshSections(): void {
        this.load()
        .then(() => {
            return this.personService.synchronizeWithUsernames(true);
        })
        .fail(e => {
            Logger.error("Error during refreshing sections", e);
        });
    }
    
    //==================
    //     HELPERS
    //==================
    
    resolveSection(destination: string): SectionService {
        if (destination == "my" || destination == "all" || !destination) {
            let section = this.getMyPrivateSection();
            if (section == null) {
                throw new Error("my-section-does-not-exists");
            }
            return section;
        }
        return this.getSection(destination);
    }
    
    uploadFile(options: section.UploadFileOptionsEx): Q.Promise<section.UploadFileResultEx> {
        return Q().then(() => {
            let section = this.resolveSection(options.destination);
            if (section) {
                return section.uploadFile(options).then(x => {
                    return {
                        fileResult: x.fileResult,
                        mailWithFileInfoResult: x.mailWithFileInfoResult,
                        mailResult: x.mailResult,
                        openableElement: x.openableElement,
                        moveResult: x.moveResult,
                        conversationResult: null
                    };
                });
            }
            return this.sectionConversationService.sendAttachmentToConversation(options).then(x => {
                return Q().then(() => {
                    return options.elementToMove ? this.removeFile(options.elementToMove) : null;
                })
                .then(moveResult => {
                    return {
                        fileResult: null,
                        mailWithFileInfoResult: null,
                        mailResult: null,
                        openableElement: x.openableElement,
                        moveResult: moveResult,
                        conversationResult: x.result
                    };
                });
            });
        });
    }
    
    sendMessage(options: section.SendMessageOptionsEx): Q.Promise<section.SendMessageResult> {
        return Q().then(() => {
            let section = this.resolveSection(options.destination);
            if (section) {
                return section.sendMessage(options).then(x => {
                    return {
                        mailResult: x,
                        conversationResult: null,
                        sinkId: x.receiver.sink.id,
                        serverId: x.source.serverId
                    };
                });
            }
            return this.sectionConversationService.sendMessageToConversation(options).then(x => {
                return {
                    mailResult: null,
                    conversationResult: x,
                    sinkId: x.outSink.id,
                    serverId: x.outMessage.source.serverId
                };
            });
        });
    }

    createMessage(options: section.SendMessageOptionsEx): Q.Promise<privfs.message.Message> {
        return Q().then(() => {
            let section = this.resolveSection(options.destination);
            if (section) {
                if (!section.hasChatModule()) {
                    throw new Error("section-has-not-chat-and-file");
                }
                return section.getChatModule().createMessage(options);
            }
            let conversationId = options.destination;
            let conversation = this.sectionConversationService.conversationService.getConversation(conversationId);
            if (conversation == null) {
                throw new Error("invalid-destination");
            }
            return Q().then(() => {
                return this.sectionConversationService.hashmailResolver.getValidReceivers(conversation.getHashmails());
            })
            .then(receivers => {
                return ChatModuleService.createMessage(this.sectionConversationService.messageService, receivers, options)
            })
    
        })
    }

    sendPreparedMessage(options: section.SendMessageOptionsEx, message: privfs.message.Message): Q.Promise<section.SendMessageResult> {
        return Q().then(() => {
            let section = this.resolveSection(options.destination);
            if (section) {
                return Q().then(() => {
                    if (!section.hasChatModule()) {
                        throw new Error("section-has-not-chat-and-file");
                    }
                    return section.getChatModule().sendPreparedMessage(message)
                    .then(result => {
                        if (!result.success || result.message == null) {
                            return Q.reject({message: "send-msg-error", result: result});
                        }
                        return {
                            mailResult: result,
                            conversationResult: null,
                            sinkId: result.receiver.sink.id,
                            serverId: result.source.serverId
                        };
                    });
                })

            }

            return this.sectionConversationService.messageService.sendMessage(message).then(x => {
                return {
                    mailResult: null,
                    conversationResult: x,
                    sinkId: x.outSink.id,
                    serverId: x.outMessage.source.serverId
                };
            });
        });
    }

    resolveFileId(id: section.SectionFileId): {section: SectionService, path: string} {
        let parsed = filetree.nt.Entry.parseId(id);
        if (parsed == null) {
            throw new Error("Invalid section file id '" + id + "'");
        }
        let section = this.getSection(parsed.sectionId);
        if (section == null) {
            throw new Error("Section with id '" + parsed.sectionId + "' does not exist");
        }
        if (!section.hasFileModule()) {
            throw new Error("Section with id '" + parsed.sectionId + "' has not file module");
        }
        return {
            section: section,
            path: parsed.path
        };
    }
    
    getFileOpenableElement(id: section.SectionFileId, resolveMimetype: boolean, cache?: boolean): Q.Promise<OpenableSectionFile> {
        return Q().then(() => {
            let result = this.resolveFileId(id);
            return result.section.getFileOpenableElement(result.path, resolveMimetype, cache);
        });
    }
    
    removeFile(id: section.SectionFileId): Q.Promise<section.OperationResult> {
        return Q().then(() => {
            let result = this.resolveFileId(id);
            return result.section.removeFile(result.path);
        });
    }
    
    dumpFileSystems(): Q.Promise<void> {
        return Q.all(this.filteredCollection.list.filter(x => x.hasFileModule()).map(x => x.getFileModule().dumpFileSystem())).thenResolve(null);
    }
    
    getDescantsForModule(id: string, moduleName: string, acceptHidden?: boolean): section.DescantsInfo {
        let section = this.getSection(id);
        if (section == null) {
            return null;
        }
        let rootSection = section.getRoot();
        let descants = rootSection.getDescantsAndMe().filter(x => x.isModuleEnabled(moduleName, false, acceptHidden));
        descants.sort((a, b) => {
            return a.getDistanceFromRoot() - b.getDistanceFromRoot();
        });
        let active: SectionService;
        if (section.isModuleEnabled(moduleName, false, acceptHidden)) {
            active = section;
        }
        else {
            if (descants.length == 0) {
                return null;
            }
            active = descants[0];
        }
        return {
            active: active,
            rootSection: rootSection,
            descants: descants
        };
    }
    
    shareSection(sectionId: section.SectionId): Q.Promise<privfs.crypto.crypto.Interfaces.Bip39> {
        return Q().then(() => {
            let section = this.getSection(sectionId);
            if (section == null) {
                throw new Error("Section with given id does not exist");
            }
            return section.shareSection();
        });
    }
    
    exportFiles(zip: boolean = false): Q.Promise<privfs.lazyBuffer.Content> {
        return PromiseUtils.notify(notify => {
            let func: any = (zip ? ZipHelper.withZip : TarHelper.withTar);
            return func((pack: TarPack|ZipPack) => {
                let list = this.filteredCollection.list;
                return PromiseUtils.oneByOne(list, (i, section) => {
                    if (!section.hasFileModule()) {
                        return;
                    }
                    let iInt = parseInt(i);
                    notify({
                        type: "export-section",
                        count: iInt,
                        total: list.length,
                        percent: Math.min(100, Math.floor(iInt * 100 / list.length))
                    });
                    return Q().then(() => {
                        return section.getFileSystem();
                    })
                    .then(fileSystem => {
                        let path = Utils.safePathName(section.getName() || section.getId());
                        if (zip) {
                            return ZipFileExporter.exportFileSystemT(fileSystem, <ZipPack>pack, path);
                        }
                        else {
                            return FileExporter.exportFileSystemT(fileSystem, <TarPack>pack, path);
                        }
                    });
                });
            });
        });
    }

    isSectionsLimitReached(useCache: boolean = true): Q.Promise<boolean> {
        return Q().then(() => {
            if (useCache && this.sectionsCount && this.sectionsLimit) {
                return this.sectionsCount == this.sectionsLimit;
            }
            return this.sectionApi.isSectionsLimitReached();
        })
    }
}