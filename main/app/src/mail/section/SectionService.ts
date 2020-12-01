import {SectionManager, SectionMapEntry} from "./SectionManager";
import {ModuleService, CalendarModuleService} from "./ModuleService";
import {section, subidentity, utils} from "../../Types";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import * as privfs from "privfs-client";
import * as SimplitoPromise from "simplito-promise";
import {Lang} from "../../utils/Lang";
import {SectionUtils} from "./SectionUtils";
import {SinkIndex} from "../SinkIndex";
import * as filetree from "../filetree";
import {KvdbCollection} from "../kvdb/KvdbCollection";
import {ChatModuleService, KvdbModuleService, FileSystemModuleService, OpenableSectionFile} from "./ModuleService";
import {LinkFileCreator} from "./LinkFileCreator";
import {StickersService} from "./StickersService";
import { PromiseUtils } from "simplito-promise";
import { HashmailResolver } from "../HashmailResolver";
import { OpenableElement } from "../../app/common/shell/ShellTypes";
import { Contact } from "../contact/Contact";
import { Hashmail } from "../../../node_modules/privfs-client/out/identity";
import { ThumbsManager } from "../thumbs";

let Logger = RootLogger.get("privfs-mail-client.mail.section.SectionService");

export class SectionService {
    
    secured: section.SectionSecuredData;
    key: section.SectionKey;
    modules: {[moduleName: string]: ModuleService};
    linkFileCreator: LinkFileCreator;
    mapEntry: SectionMapEntry;
    stickersService: StickersService;
    initStickersServicePromise: Q.Promise<void>;
    
    constructor(
        public manager: SectionManager,
        public sectionData: section.SectionData,
        public userSettings: section.UserSettings,
        public identityProvider: utils.IdentityProvider,
        public hashmailResolver: HashmailResolver
    ) {
        this.modules = {};
        this.linkFileCreator = new LinkFileCreator(this);
        this.stickersService = new StickersService(null, this.manager ? this.manager.stickersProvider : null);
        this.setSectionDataAndValidate(sectionData);
    }
    
    static create(manager: SectionManager, sectionData: section.SectionData, userSettings: section.UserSettings, identityProvider: utils.IdentityProvider, key: section.SectionKey, hashmailResolver: HashmailResolver): Q.Promise<SectionService> {
        let section = new SectionService(manager, sectionData, userSettings, identityProvider, hashmailResolver);
        return section.setKey(key).thenResolve(section);
    }
    
    //==================
    //   BASIC PROPS
    //==================
    
    getParent(): SectionService {
        return this.mapEntry.parent ? this.mapEntry.parent.section : null;
    }
    
    isRoot(): boolean {
        return this.mapEntry.parent == null || this.mapEntry.parent.section == null;
    }
    
    getRoot(): SectionService {
        if (this.isRoot()) {
            return this;
        }
        return this.mapEntry.parent.section.getRoot();
    }
    
    getDistanceFromRoot(): number {
        let distance = 0;
        let current = this.mapEntry;
        while (current.parent && current.parent.section) {
            distance++;
            current = current.parent;
        }
        return distance;
    }
    
    isPrivate() {
        return Lang.startsWith(this.sectionData.id, "private:");
    }
    
    isUserGroup() {
        return Lang.startsWith(this.sectionData.id, "usergroup:");
    }
    
    isPrivateOrUserGroup() {
        return this.isPrivate() || this.isUserGroup();
    }
    
    getId(): section.SectionId {
        return this.sectionData.id;
    }
    
    getName(): string {
        return this.secured != null ? this.secured.name : null;
    }
    
    isDecrypted(): boolean {
        return this.secured != null;
    }
    
    isValid(onlyEnabled?: boolean): boolean {
        return this.isDecrypted() && (onlyEnabled === false ? this.sectionData.state != "removed" : this.sectionData.state == "enabled");
    }
    
    getScope(): string {
        return SectionUtils.isGroupTypePublic(this.sectionData.group.type) || SectionUtils.hasAnyPublicUsersGroupsIn(this.sectionData.group.users) ? "public" : "private";
    }
    
    getAcl(): section.SectionAcl {
        return this.sectionData ? SectionUtils.deserializeAcl(this.sectionData.acl) : null;
    }
    
    getEnabledModules(): string[] {
        if (!this.secured) {
            return [];
        }
        let modules: string[] = [];
        for (let id in this.secured.modules) {
            if (this.secured.modules[id].enabled) {
                modules.push(id);
            }
        }
        return modules;
    }
    
    isEditableByMe(): boolean {
        let acl = this.getAcl();
        if (acl == null) {
            return false;
        }
        return (acl.manage.admins && this.manager.identityProvider.isAdmin()) || acl.manage.all || acl.manage.users.indexOf(this.manager.identityProvider.getIdentity().user) != -1;
    }
    
    canCreateSubsection(): boolean {
        let acl = this.getAcl();
        if (acl == null) {
            return false;
        }
        return (acl.createSubsections.admins && this.manager.identityProvider.isAdmin()) || acl.createSubsections.all || acl.createSubsections.users.indexOf(this.manager.identityProvider.getIdentity().user) != -1;
    }
    
    hasAccess(): boolean {
        if (this.sectionData.group.type == SectionUtils.GROUP_TYPE_ALL_LOCAL_USERS) {
            return true;
        }
        if (this.sectionData.group.type == SectionUtils.GROUP_TYPE_ADMIN && this.identityProvider.isAdmin()) {
            return true;
        }
        return this.sectionData.group.users.indexOf(this.manager.identityProvider.getIdentity().user) != -1;
    }
    
    getDescantsAndMe(list?: SectionService[]): SectionService[] {
        list = list || [];
        list.push(this);
        this.mapEntry.children.forEach(child => {
            child.section.getDescantsAndMe(list);
        });
        return list;
    }
    
    isVisible(): boolean {
        return this.userSettings && this.userSettings.visible;
    }
    
    getFullSectionName(spacesAroundSlashes: boolean = false, excludeProjectName: boolean = false, escapeSlashes: boolean = false): string {
        let sectionName: string = "";
        if (this.isPrivate()) {
            sectionName = this.manager.localeService.i18n("core.section.my-private-files");
        }
        else if (this.isUserGroup()) {
            let users = this.sectionData.group.users
                .filter(x => x + "#" + this.manager.identity.host != this.manager.identity.hashmail)
                .map(x => this.manager.contactService.getContactByHashmail(x + "#" + this.manager.identity.host))
                .filter(x => x != null)
                .map(x => x.getDisplayName().split("#")[0]);
            sectionName = users.join(", ");
        }
        else {
            let fEscape = escapeSlashes ? (str: string) => str.replace(/(\/|\\)/g, "\\$1") : (str: string) => str;
            let separator = spacesAroundSlashes ? " / " : "/";
            let parents: SectionService[] = [];
            let lastParent = this.getParent();
            while (lastParent) {
                parents.unshift(lastParent);
                lastParent = lastParent.getParent();
            }
            let breadcrumb = "";
            parents.forEach(p => {
                breadcrumb += fEscape(p.getName()) + separator;
            });
            sectionName = breadcrumb + (excludeProjectName ? "" : fEscape(this.getName()));
        }
        return sectionName;
    }
    
    //==================
    //      UPDATE
    //==================
    
    getSectionUpdateModelDecrypted(): section.SectionUpdateModelDecrypted {
        if (!this.secured) {
            return null;
        }
        return Lang.simpleDeepCopy({
            id: this.getId(),
            parentId: this.sectionData.parentId,
            data: this.secured,
            version: this.sectionData.version,
            group: {
                type: this.sectionData.group.type,
                users: this.sectionData.group.users.concat([])
            },
            state: this.sectionData.state,
            acl: this.getAcl(),
            primary: this.sectionData.primary
        });
    }
    
    isModelDirty(updater: (data: section.SectionUpdateModelDecrypted) => section.SectionUpdateModelDecrypted, modules: string[]): boolean {
        let model = this.getSectionUpdateModelDecrypted();
        let oldSerialized = JSON.stringify(model);
        if (!model.data.modules) {
            model.data.modules = {};
        }
        for (let moduleName in model.data.modules) {
            model.data.modules[moduleName].enabled = modules.indexOf(moduleName) != -1;
        }
        let params = updater(model);
        return oldSerialized != JSON.stringify(params);
    }
        
    updateEx(updater: (data: section.SectionUpdateModelDecrypted) => section.SectionUpdateModelDecrypted): Q.Promise<void> {
        let params: section.SectionUpdateModelDecrypted;
        let key: section.SectionKey;
        let usersToSend: string[];
        let modulesStateChanged: boolean = false;
        let sendKeyToAdmins: boolean;
        let oldType: string;
        return Q().then(() => {
            let tryUpdate = () => {
                if (!this.isDecrypted()) {
                    throw new Error("Cannot update unecrypted element");
                }
                let model = this.getSectionUpdateModelDecrypted();
                let oldSerialized = JSON.stringify(model);
                oldType = model.group.type;
                let oldGroupUsers = model.group.users.concat();
                let oldManageUsers = model.acl.manage.users.concat();
                let oldVersion = this.sectionData.version;
                let oldAdminsInManage = model.acl.manage.admins;
                params = updater(model);
                params.id = this.getId();
                params.version = oldVersion;
                if (oldSerialized == JSON.stringify(params)) {
                    return Q(null);
                }
                for (let moduleId in model.data.modules) {
                    if (model.data.modules[moduleId].enabled != params.data.modules[moduleId].enabled) {
                        modulesStateChanged = true;
                        return;
                    }
                }
                return Q().then(() => {
                    let diff = Lang.getListDiff(oldGroupUsers, params.group.users);
                    let manageDiff = Lang.getListDiff(oldManageUsers, params.acl.manage.users);
                    
                    if (diff.removedElements.length > 0 || manageDiff.removedElements.length > 0 || (oldAdminsInManage && !params.acl.manage.admins)) {
                        //Some users have been removed from acl or admins lost rights to manage - generate new key, send key to all users from acl and admins if they can manage
                        usersToSend = SectionUtils.filterUsers(params.group.users.concat(params.acl.manage.users));
                        sendKeyToAdmins = params.acl.manage.admins || params.group.type == SectionUtils.GROUP_TYPE_ADMIN;
                        this.sendRevokeMessage(diff.removedElements);
                    }

                    if (SectionUtils.isGroupTypePublic(params.group.type) || SectionUtils.hasAnyPublicUsersGroupsIn(params.group.users)) {
                        usersToSend = SectionUtils.filterUsers(params.group.users.concat(params.acl.manage.users));
                        sendKeyToAdmins = false;
                        return this.manager.sectionKeyManager.getPublicKey(this.getId());
                    }
                    if (SectionUtils.isGroupTypePublic(oldType) || SectionUtils.hasAnyPublicUsersGroupsIn(oldGroupUsers)) {
                        //Old type was public, new is private - generate new key, send key to all users from acl and admins if they can manage
                        usersToSend = SectionUtils.filterUsers(params.group.users.concat(params.acl.manage.users));
                        //sendKeyToAdmins if admins are in read list too
                        sendKeyToAdmins = params.acl.manage.admins || params.group.type == SectionUtils.GROUP_TYPE_ADMIN;
                        
                        return this.manager.contactService.utilApi.getUsernames().then(usernames => {
                            let diff = Lang.getListDiff(usernames, params.group.users);
                            if (diff.removedElements.length > 0) {
                                return this.sendRevokeMessage(diff.removedElements);
                            }
                            return;
                        })
                        .then(() => {
                            return this.manager.sectionKeyManager.generateKey(this.getId());
                        })
                        
                    }

                    if (diff.removedElements.length > 0 || manageDiff.removedElements.length > 0 || (oldAdminsInManage && !params.acl.manage.admins)) {
                        //Some users have been removed from acl or admins lost rights to manage - generate new key, send key to all users from acl and admins if they can manage
                        usersToSend = SectionUtils.filterUsers(params.group.users.concat(params.acl.manage.users));
                        sendKeyToAdmins = params.acl.manage.admins || params.group.type == SectionUtils.GROUP_TYPE_ADMIN;
                        
                        //send revoke message to removed users
                        return this.sendRevokeMessage(diff.removedElements)
                        .then(() => {
                            return this.manager.sectionKeyManager.generateKey(this.getId());
                        })
                    }
                    
                    //Nothing change or users have been added to acl - left old key and send key only to added users and admins if they gain manage rights
                    usersToSend = SectionUtils.filterUsers(diff.newElements.concat(manageDiff.newElements));
                    sendKeyToAdmins = (!oldAdminsInManage && params.acl.manage.admins) || params.group.type == SectionUtils.GROUP_TYPE_ADMIN;
                    return this.key;
                })
                .then(k => {
                    key = k;
                    return this.manager.sectionKeyManager.storeKey(key);
                })
                .then(() => {
                    return SectionService.encode(params.data, key.key);
                })
                .then(encrypted => {
                    return this.manager.sectionApi.sectionUpdate({
                        id: this.getId(),
                        parentId: params.parentId,
                        version: params.version,
                        keyId: key.keyId,
                        data: encrypted,
                        group: params.group,
                        state: params.state,
                        acl: SectionUtils.serializeAcl(params.acl),
                        primary: params.primary
                    });
                })
            };
            return tryUpdate().fail(e => {
                if (!privfs.core.ApiErrorCodes.is(e, "INVALID_VERSION")) {
                    return Q.reject<section.SectionData>(e);
                }
                return Q().then(() => {
                    return this.manager.sectionApi.sectionGet(this.getId());
                })
                .then(sectionData => {
                    return this.manager.processSectionData(sectionData);
                })
                .then(() => {
                    return tryUpdate();
                });
            });
        })
        .then(sectionData => {
            if (!sectionData) {
                return;
            }
            this.manager.sectionKeyManager.sendKey(key, usersToSend, sendKeyToAdmins);
            return this.manager.processSectionData(sectionData).thenResolve(null);
        })
        .then(() => {
                return this.manager.contactService.utilApi.getUsernamesEx(false);
        })
        .then(allUsers => {
            let users = SectionUtils.filterUsers(params.group.users.concat(params.acl.manage.users));
            if (SectionUtils.isGroupTypePublic(params.group.type) || SectionUtils.hasAnyPublicUsersGroupsIn(params.group.users)) {
                // if section acl has any public groups then we should send to all local users on server
                let extUsers = allUsers.map(u => {
                    if(!u.deleted && u.type != "basic") {
                        return u.username;
                    }
                })
                users = SectionUtils.filterUsers(users.concat(extUsers));
            }
            return this.sendSectionStateChangedMessage(users);
        })
    }
    
    updateWithModules(updater: (data: section.SectionUpdateModelDecrypted) => section.SectionUpdateModelDecrypted, modules: section.ModuleInfo[]): Q.Promise<void> {
        if (Lang.containsFunc(modules, x => !this.manager.hasModuleService(x.name))) {
            return Q.reject("module-not-registered");
        }
        return Q().then(() => {
            return this.updateEx(data => {
                if (!data.data.modules) {
                    data.data.modules = {};
                }
                for (let moduleName in data.data.modules) {
                    let mdl = Lang.find(modules, x => x.name == moduleName);
                    data.data.modules[moduleName].enabled = mdl && mdl.enabled;
                }
                return updater(data);
            });
        })
        .then(() => {
            return SimplitoPromise.PromiseUtils.oneByOne(modules, (_i, mdl) => {
                return this.getAndCreateModule(mdl.name, mdl.enabled);
            });
        });
    }
    
    isUserSettingsChanged(userSettings: section.UserSettings): boolean {
        let changed = this.userSettings != null && this.userSettings.visible != userSettings.visible;
        if (this.userSettings.mutedModules && userSettings.mutedModules) {
            for (let k in section.NotificationModule) {
                let kk = section.NotificationModule[k];
                if (this.userSettings.mutedModules[kk] != userSettings.mutedModules[kk]) {
                    changed = true;
                }
            }
        }
        else if (this.userSettings.mutedModules != userSettings.mutedModules) {
            changed = true;
        }
        return changed;
    }
    
    updateUserSettings(userSettings: section.UserSettings): Q.Promise<void> {
        return Q().then(() => {
            if (!this.isUserSettingsChanged(userSettings)) {
                return;
            }
            return this.manager.userPreferencesService.saveUserSettingsEntry({
                id: this.getId(),
                mutedModules: userSettings.mutedModules,
                visible: userSettings.visible
            });
        });
    }
    
    //==================
    //  SET KEY & DATA
    //==================
    
    setSectionDataAndValidate(sectionData: section.SectionData) {
        this.sectionData = sectionData;
        if (this.sectionData) {
            this.sectionData.state = this.sectionData.state || "enabled";
        }
    }
    
    setSectionData(sectionData: section.SectionData) {
        this.setSectionDataAndValidate(sectionData);
        return this.decode();
    }
    
    setKey(key: section.SectionKey): Q.Promise<boolean> {
        if (key && key.sectionId != this.getId()) {
            return Q().then(() => {
                throw new Error("Cannot assign key from another section");
            });
        }
        if (key && key.keyId != this.sectionData.keyId) {
            return Q().then(() => {
                throw new Error("Invalid key id");
            });
        }
        let keyChanged = (this.key != null && key == null) || (this.key == null && key != null) || (this.key != null && key != null && this.key.keyId != key.keyId);
        this.key = key;
        return this.decode().then(c => c || keyChanged);
    }
    
    setKeyAndSectionData(key: section.SectionKey, sectionData: section.SectionData): Q.Promise<boolean> {
        let hasChanges = !Lang.isDeepEqual(sectionData, this.sectionData);
        this.setSectionDataAndValidate(sectionData);
        return this.setKey(key).then(c => c || hasChanges);
    }
    
    decode(): Q.Promise<boolean> {
        let oldSecured = this.secured;
        this.secured = null;
        if (this.key == null) {
            return Q(oldSecured != null);
        }
        return Q().then(() => {
            return privfs.crypto.service.privmxDecrypt(privfs.crypto.service.privmxOptSignedCipher(), new Buffer(this.sectionData.data, "base64"), this.key.key);
        })
        .then(decrypted => {
            let newValue = JSON.parse(decrypted.toString("utf8"));
            // if (!this.isPrivateOrUserGroup()) {
            //     if (!(CalendarModuleService.MODULE_NAME in newValue.modules)) {
            //         newValue.modules[CalendarModuleService.MODULE_NAME] = { enabled: true, data: null };
            //     }
            // }
            let hasChanges = !Lang.isDeepEqual(newValue, oldSecured);
            this.secured = newValue;
            return hasChanges;
        })
        .fail(e => {
            Logger.error("Error during decoding", e);
            return oldSecured != null;
        });
    }
    
    static encode(data: section.SectionSecuredData, key: Buffer): Q.Promise<string> {
        return Q().then(() => {
            return privfs.crypto.service.privmxEncrypt(privfs.crypto.service.privmxOptAesWithSignature(), new Buffer(JSON.stringify(data), "utf8"), key);
        })
        .then(cipher => {
            return cipher.toString("base64");
        });
    }
    
    //==================
    //      MODULE
    //==================
    
    hasModule(moduleName: string, checkDescants?: boolean): boolean {
        let moduleService = this.getModule(moduleName);
        if (moduleService != null && moduleService.hasModule()) {
            return true;
        }
        return checkDescants && Lang.containsFunc(this.mapEntry.children, x => x.section.hasModule(moduleName, checkDescants));
    }
    
    isModuleEnabled(moduleName: string, checkDescants?: boolean, acceptHidden?: boolean): boolean {
        if (!this.isValid(true)) {
            return false;
        }
        let moduleService = this.getModule(moduleName);
        if (moduleService != null && moduleService.isEnabled()) {
            return acceptHidden ? true : this.isVisible();
        }
        return checkDescants && Lang.containsFunc(this.mapEntry.children, x => x.section.isModuleEnabled(moduleName, checkDescants, acceptHidden));
    }
    
    createModule(moduleName: string): Q.Promise<void> {
        let moduleService = this.getModule(moduleName);
        if (moduleService == null) {
            return Q.reject("module-not-registered");
        }
        return moduleService.createModule();
    }
    
    getModule<T extends ModuleService = ModuleService>(moduleName: string): T {
        if (!(moduleName in this.modules)) {
            this.modules[moduleName] = this.manager.createModuleService(moduleName, this);
        }
        return <T>this.modules[moduleName];
    }
    
    getAndCreateModule<T extends ModuleService = ModuleService>(moduleName: string, enabled?: boolean): Q.Promise<T> {
        let moduleService = this.getModule(moduleName);
        if (moduleService == null) {
            return Q.reject("module-not-registered");
        }
        return Q().then(() => {
            return moduleService.hasModule() ? <T>moduleService : moduleService.createModule(enabled).thenResolve(<T>moduleService);
        });
    }
    
    //==================
    //      CHAT
    //==================
    
    hasChatModule(checkDescants?: boolean): boolean {
        return this.hasModule("chat", checkDescants);
    }
    
    isChatModuleEnabled(checkDescants?: boolean, acceptHidden?: boolean): boolean {
        return this.isModuleEnabled("chat", checkDescants, acceptHidden);
    }
    
    createChatModule(): Q.Promise<void> {
        return this.createModule("chat");
    }
    
    getChatModule(): ChatModuleService {
        return this.getModule("chat");
    }
    
    getAndCreateChatModule(): Q.Promise<ChatModuleService> {
        return this.getAndCreateModule("chat");
    }
    
    getChatSink(): privfs.message.MessageSinkPriv {
        return this.getChatModule().getSink();
    }
    
    createChatReceiver(): privfs.message.MessageReceiver {
        return this.getChatModule().createReceiver();
    }
    
    getChatSinkIndex(): Q.Promise<SinkIndex> {
        return this.getChatModule().getSinkIndex();
    }
    
    getChatLastDate(): number {
        if (!this.hasChatModule()) {
            return 0;
        }
        let fColl = this.getChatModule().chatMessagesCollection;
        if (!fColl) {
            return 0;
        }
        let last = fColl.getLast();
        return last ? last.source.serverDate : 0;
    }
    
    getFileMessageLastDate(): number {
        if (!this.hasChatModule()) {
            return 0;
        }
        let fColl = this.getChatModule().filesMessagesCollection;
        if (!fColl) {
            return 0;
        }
        let last = fColl.getLast();
        return last ? last.source.serverDate : 0;
    }
    
    //==================
    //      FILE
    //==================
    
    hasFileModule(checkDescants?: boolean): boolean {
        return this.hasModule("file", checkDescants);
    }
    
    isFileModuleEnabled(checkDescants?: boolean, acceptHidden?: boolean): boolean {
        return this.isModuleEnabled("file", checkDescants, acceptHidden);
    }
    
    createFileModule(): Q.Promise<void> {
        return this.createModule("file");
    }
    
    getFileModule(): FileSystemModuleService {
        return this.getModule("file");
    }
    
    getAndCreateFileModule(): Q.Promise<FileSystemModuleService> {
        return this.getAndCreateModule("file");
    }
    
    getFileRootRef(): privfs.fs.descriptor.ref.DescriptorRefWrite {
        return this.getFileModule().getRootRef();
    }
    
    getFileAcl(): privfs.types.descriptor.DescriptorAcl {
        return this.getFileModule().getDescriptorAcl();
    }
    
    getFileSystem(): Q.Promise<privfs.fs.file.FileSystem> {
        return this.getFileModule().getFileSystem();
    }
    
    getFileTree(): Q.Promise<filetree.nt.Tree> {
        return this.getFileModule().getFileTree();
    }
    
    getFileOpenableElement(path: string, resolveMimetype: boolean, cache?: boolean): Q.Promise<OpenableSectionFile> {
        return this.getFileModule().getOpenableElement(path, resolveMimetype, cache);
    }
    
    removeFile(path: string): Q.Promise<section.OperationResult> {
        return this.getFileModule().removeFile(path);
    }
    
    saveFile(path: string, content: privfs.lazyBuffer.IContent, handle?: privfs.fs.descriptor.Handle, openableElement?: OpenableElement, releaseLock?: boolean) {
        return Q().then(() => {
            // if (handle) {
            //     return handle.write(content, {releaseLock: releaseLock ? releaseLock : false}).thenResolve(null)
            // }
            if (openableElement) {
                return openableElement.save(content)
            }
        })
        .then(() => {
            return this.getChatModule().sendSaveFileMessage(this.getId(), path)
        })

    }
    
    //==================
    //      KVDB
    //==================
    
    hasKvdbModule(checkDescants?: boolean): boolean {
        return this.hasModule("kvdb", checkDescants);
    }
    
    isKvdbModuleEnabled(checkDescants?: boolean, acceptHidden?: boolean): boolean {
        return this.isModuleEnabled("kvdb", checkDescants, acceptHidden);
    }
    
    createKvdbModule(): Q.Promise<void> {
        return this.createModule("kvdb");
    }
    
    getKvdbModule(): KvdbModuleService {
        return this.getModule("kvdb");
    }
    
    getAndCreateKvdbModule(): Q.Promise<KvdbModuleService> {
        return this.getAndCreateModule("kvdb");
    }
    
    getKvdbExtKey(): privfs.crypto.ecc.ExtKey {
        return this.getKvdbModule().getExtKey();
    }
    
    getKvdb<T = any>(): Q.Promise<privfs.db.KeyValueDb<T>> {
        return this.getKvdbModule().getKvdb<T>();
    }
    
    getKvdbCollection<T = any>(): Q.Promise<KvdbCollection<T>> {
        return this.getKvdbModule().getKvdbCollection<T>();
    }
    
    //==================
    //     Calendar
    //==================
    
    hasCalendarModule(checkDescants?: boolean): boolean {
        return this.hasModule("calendar", checkDescants);
    }
    
    isCalendarModuleEnabled(checkDescants?: boolean, acceptHidden?: boolean): boolean {
        return this.isModuleEnabled("calendar", checkDescants, acceptHidden);
    }
    
    createCalendarModule(): Q.Promise<void> {
        return this.createModule("calendar");
    }
    
    getCalendarModule(): CalendarModuleService {
        return this.getModule("calendar");
    }
    
    getAndCreateCalendarModule(): Q.Promise<CalendarModuleService> {
        return this.getAndCreateModule("calendar");
    }
    
    
    //==================
    //      SHARE
    //==================
    
    getSubidentityData(): Q.Promise<subidentity.SubidentyData> {
        return Q().then(() => {
            if (!this.key) {
                throw new Error("Section key is empty");
            }
            return this.manager.sectionKeyManager.getPublicKey(this.getId());
        })
        .then(pubKey => {
            let identity = this.manager.identityProvider.getIdentity();
            return {
                identity: {
                    username: identity.user,
                    wif: identity.privWif
                },
                pubKey: pubKey.key.toString("base64"),
                sectionId: this.getId(),
                sectionKeyId: this.key.keyId,
                sectionKey: this.key.key.toString("base64")
            }
        });
    }
    
    updateSubidentity(bip39Mnemonic: string): Q.Promise<void> {
        return Q().then(() => {
            return this.getSubidentityData();
        })
        .then(subIdData => {
            return this.manager.subidentityService.updateSubidentity(bip39Mnemonic, subIdData, this.sectionData.group.id);
        });
    }
    
    shareSection(): Q.Promise<privfs.crypto.crypto.Interfaces.Bip39> {
        return Q().then(() => {
            return this.getSubidentityData();
        })
        .then(subIdData => {
            return this.manager.subidentityService.createSubidentity(subIdData, this.sectionData.group.id);
        });
    }
    
    //==================
    //     HELPERS
    //==================
    
    initStickers(): Q.Promise<void> {
        if (this.initStickersServicePromise == null) {
            this.initStickersServicePromise = Q().then(() => {
                let chatModule = this.getChatModule();
                return privfs.crypto.service.sha256(chatModule.getSink().priv.getPrivateEncKey());
            })
            .then(key => {
                this.stickersService.key = key;
                return this.stickersService.init();
            });
        }
        return this.initStickersServicePromise;
    }
    
    setStickersAtChatMessage(mid: number, stickers: string[], replace: boolean): Q.Promise<void> {
        return Q().then(() => {
            return this.getChatSinkIndex();
        })
        .then(sinkIndex => {
            return this.stickersService.encodeStickers(stickers).then(encoded => {
                return sinkIndex.setStickers(mid, encoded, replace);
            });
        });
    }
    
    decodeSticker(sticker: string): string {
        return this.stickersService.decodeSticker(sticker);
    }
    
    decodeStickers(stickers: string[]): string[] {
        return this.stickersService.decodeStickers(stickers);
    }
    
    exportFiles(zip: boolean = false): Q.Promise<privfs.lazyBuffer.Content> {
        return this.getFileModule().exportFiles(zip);
    }
    
    uploadFile(options: section.UploadFileOptions): Q.Promise<section.UploadFileResult> {
        let fileUploadResult: section.UploadFileTreeResult;
        let isThumb = options && options.path && ThumbsManager.isThumb(options.path, true);
        return Q().then(() => {
            this.manager.fileSizeChecker.checkFileSize(options.data.getSize());
            if (this.hasFileModule()) {
                return Q().then(() => {
                    return this.getFileModule().uploadFile(options);
                })
                .then(res => {
                    fileUploadResult = res;
                    if (!isThumb) {
                        return this.getFileTree().then(tree => {
                            return tree.refreshDeep(true);
                        })
                        .then(() => {
                            return ThumbsManager.getInstance().createThumb(this, fileUploadResult.path).fail(e => null);
                        });
                    }
                }).then(thumbPath => {
                    if (!this.hasChatModule() || options.noMessage) {
                        return null;
                    }
                    return this.getFileOpenableElement(fileUploadResult.path,false)
                    .then(osf => {
                        return this.getChatModule().sendCreateFileMessage(fileUploadResult.path, options.data.getSize(), options.data.getMimeType(), osf.handle.descriptor.ref.did);
                    })
                })
                .then(mailResult => {
                    return {
                        fileResult: fileUploadResult,
                        mailWithFileInfoResult: mailResult,
                        mailResult: null,
                        openableElement: fileUploadResult.openableElement,
                        moveResult: fileUploadResult.elementMoved ? {
                            success: true,
                            error: null
                        } : null
                    };
                });
            }
            else if (this.hasChatModule()) {
                let mailResult: section.SendAttachmentResult;
                return Q().then(() => {
                    return this.getChatModule().sendMessageWithAttachment(options.data);
                })
                .then(res => {
                    mailResult = res;
                    return options.elementToMove ? this.manager.removeFile(options.elementToMove) : null;
                })
                .then(moveResult => {
                    return {
                        fileResult: null,
                        mailWithFileInfoResult: null,
                        mailResult: mailResult.result,
                        openableElement: mailResult.openableElement,
                        moveResult: moveResult
                    };
                });
            }
            else {
                throw new Error("section-has-not-chat-and-file");
            }
        });
    }

    sendRevokeMessage(users: string[]) {
        return PromiseUtils.oneByOne(users, (_i, username) => {
            if (username == this.identityProvider.getIdentity().user) {
                return;
            }
            return Q().then(() => {
                return this.hashmailResolver.resolveHashmail(username + "#" + this.identityProvider.getIdentity().host);
            })
            .then(resolved => {
                if (resolved.receivers.length == 0) {
                    throw new Error("User has not sink");
                }
                let message = this.manager.sectionAccessManager.createSectionRevokeMessage(resolved.receivers[0], this)
                return this.manager.sectionAccessManager.messageService.sendSimpleMessage(message);
            })
            .fail(e => {
                Logger.error("Cannot send revoke message to '" + username + "'", e);
            });
        });
    }

    sendSectionStateChangedMessage_old(users: string[]) {
        return PromiseUtils.oneByOne(users, (_i, username) => {
            if (username == this.identityProvider.getIdentity().user) {
                return;
            }
            return Q().then(() => {
                return this.hashmailResolver.resolveHashmail(username + "#" + this.identityProvider.getIdentity().host);
            })
            .then(resolved => {
                if (resolved.receivers.length == 0) {
                    throw new Error("User has not sink");
                }
                let message = this.manager.sectionAccessManager.createSectionStateChangedMessage(resolved.receivers[0], this)
                return this.manager.sectionAccessManager.messageService.sendSimpleMessage(message);
            })
            .fail(e => {
                Logger.error("Cannot send state change message to '" + username + "'", e);
            });
        });
    }

    sendSectionStateChangedMessage(users: string[]) {
        let actionList: Q.Promise<void>[] = [];
        users.forEach((username, _i) => {
            actionList.push(Q().then(() => {
                if (username == this.identityProvider.getIdentity().user) {
                    return;
                }
                return Q().then(() => {
                    return this.hashmailResolver.resolveHashmail(username + "#" + this.identityProvider.getIdentity().host);
                })
                .then(resolved => {
                    if (resolved.receivers.length == 0) {
                        throw new Error("User has not sink");
                    }
                    let message = this.manager.sectionAccessManager.createSectionStateChangedMessage(resolved.receivers[0], this)
                    return this.manager.sectionAccessManager.messageService.sendSimpleMessage(message);
                })
                .fail(e => {
                    Logger.error("Cannot send state change message to '" + username + "'", e);
                });
            }));
        })
        return Q.all(actionList)
        .then(() => {
            return;
        })
    }


    sendMessage(options: section.SendMessageOptions): Q.Promise<privfs.types.message.ReceiverData> {
        return Q().then(() => {
            if (!this.hasChatModule()) {
                throw new Error("section-has-not-chat-and-file");
            }
            return this.getChatModule().sendMessage(options);
        })
        .then(res => {
            if (!res.success || res.message == null) {
                return Q.reject({message: "send-msg-error", result: res});
            }
            return res;
        });
    }
    
    editMessage(originalMessageId: number, options: section.SendMessageOptions): Q.Promise<privfs.message.SentMessage> {
        return Q().then(() => {
            if (!this.hasChatModule()) {
                throw new Error("section-has-not-chat-and-file");
            }
            return this.getChatModule().editMessage(originalMessageId, options);
        });
    }

    getContactsWithAccess(sort: boolean = false): Contact[] {
        let data = this.getSectionUpdateModelDecrypted();
        let usernamesArrs = [data.acl.createSubsections.users, data.acl.manage.users, data.group.users];
        let hash = "#" + this.identityProvider.getIdentity().host;
        let contactsWithAccess: Contact[] = [];
        let allContacts: Contact[] = this.manager.contactService.contactCollection.list;
        if (data.group.type == SectionUtils.GROUP_TYPE_ADMIN) {
            usernamesArrs.push(allContacts.filter(x => x.isAdmin).map(x => x.getUsername()));
        }
        else if (data.group.type == SectionUtils.GROUP_TYPE_ALL_LOCAL_USERS) {
            usernamesArrs.push(allContacts.map(x => x.getUsername()));
        }
        for (let arr of usernamesArrs) {
            let contactsArr = arr.map(x => this.manager.contactService.getContactByHashmail(x + hash))
            .filter(x => this.contactHasAccess(x));
            
            for (let contact of contactsArr) {
                if (contactsWithAccess.indexOf(contact) < 0) {
                    contactsWithAccess.push(contact);
                }
            }
        }
        if (sort) {
            contactsWithAccess.sort((a, b) => {
                let aIsExternal: number = (a.basicName || "").indexOf("@") >= 0 ? 1 : 0;
                let bIsExternal: number = (b.basicName || "").indexOf("@") >= 0 ? 1 : 0;
                if (aIsExternal != bIsExternal) {
                    return aIsExternal - bIsExternal;
                }
                
                let aName = a.getDisplayName();
                let bName = b.getDisplayName();
                if (aName !== null && bName !== null) {
                    return aName.localeCompare(bName);
                }
                
                return 0;
            });
        }
        return contactsWithAccess;
    }
    
    contactHasAccess(contact: Contact): boolean {
        if (contact != null && this.manager.contactService.deletedUsers.indexOf(contact.getUsername()) < 0 && (!contact.basicUser || (contact.basicUser && this.sectionData.group.users.indexOf(contact.getUsername()) > -1))) {
            return true;
        }
        return false;
    }
    
    contactCanCreateSubsections(contact: Contact): boolean {
        let acl = this.getAcl();
        if (contact != null && this.manager.contactService.deletedUsers.indexOf(contact.getUsername()) < 0 && (!contact.basicUser || (contact.basicUser && acl.createSubsections.users.indexOf(contact.getUsername()) > -1))) {
            return true;
        }
        return false;
    }
    
    contactCanManage(contact: Contact): boolean {
        let acl = this.getAcl();
        if (contact != null && this.manager.contactService.deletedUsers.indexOf(contact.getUsername()) < 0 && (!contact.basicUser || (contact.basicUser && acl.manage.users.indexOf(contact.getUsername()) > -1))) {
            return true;
        }
        return false;
    }
    
    getVoiceChatEncryptionKey() {
        return Q().then(() => {
            let chatModule = this.getChatModule();
            if (chatModule == null || !chatModule.hasModule()) {
                throw new Error("Cannot obtain voice chat encryption key");
            }
            let sink = chatModule.getSink();
            let priv = sink.priv.getPrivateEncKey();
            let buffer = Buffer.concat([Buffer.from("voice-chat-encryption-key"), priv.slice(0, 24)]);
            return privfs.crypto.service.sha256(buffer);
        });
    }
}

export class VirtualSectionService extends SectionService {
    
    constructor(
        public props: {
            parent?: SectionService,
            root?: SectionService,
            isPrivate?: boolean,
            id: section.SectionId,
            name: string,
            valid?: boolean,
            scope?: string,
            acl?: section.SectionAcl,
            enabledModules?: string[],
            editableMyBe?: boolean,
            canCreateSubsection?: boolean
        },
        manager?: SectionManager,
        sectionData?: section.SectionData,
        userSettings?: section.UserSettings,
        identityProvider?: utils.IdentityProvider,
        hashmailResolver?: HashmailResolver
    ) {
        super(manager, sectionData, userSettings, identityProvider, hashmailResolver);
    }
    
    //==================
    //   BASIC PROPS
    //==================
    
    getParent(): SectionService {
        return this.props.parent;
    }
    
    getRoot(): SectionService {
        return this.props.root;
    }
    
    isPrivate() {
        return !!this.props.isPrivate;
    }
    
    getId(): section.SectionId {
        return this.props.id;
    }
    
    getName(): string {
        return this.props.name;
    }
    
    isValid(): boolean {
        return !!this.props.valid;
    }
    
    getScope(): string {
        return this.props.scope || "public";
    }
    
    getAcl(): section.SectionAcl {
        return this.props.acl;
    }
    
    getEnabledModules(): string[] {
        return this.props.enabledModules || [];
    }
    
    isEditableByMe(): boolean {
        return !!this.props.editableMyBe;
    }
    
    canCreateSubsection(): boolean {
        return !!this.props.canCreateSubsection;
    }
    
    //==================
    //      MODULE
    //==================
    
    getModule<T extends ModuleService = ModuleService>(_moduleName: string): T {
        return null;
    }
}