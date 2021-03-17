import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app, utils, section, event} from "../../Types";
import { SectionService } from "../../mail/section/SectionService";
import {SectionManager} from "../../mail/section/SectionManager";
import {SelectContactsWindowController} from "../selectcontacts/SelectContactsWindowController";
import { Lang } from "../../utils/Lang";
import { BaseWindowManager } from "../../app/BaseWindowManager";
import { SectionPickerWindowController } from "../sectionpicker/SectionPickerWindowController";
import { SubIdWindowController } from "../subid/SubIdWindowController";
import {Inject, Dependencies} from "../../utils/Decorators"
import { PersonsController } from "../../component/persons/PersonsController";
import { UtilApi } from "../../mail/UtilApi";
import { SectionUtils } from "../../mail/section/SectionUtils";
import { ContactService } from "../../mail/contact";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { ReopenSectionEvent } from "../../component/disabledsection/main";
import { Window as AppWindow } from "../../app/common/window/Window";
import { SectionsWindowController } from "../sections/SectionsWindowController";
export interface Model {
    host: string;
    modules: string[];
    docked: boolean;
    state: State;
    hashmail: string;
}

export interface SectionChangeLockEvent {
    type: "section-change-lock",
    lock: boolean
}

export interface State {
    id: string;
    parentId: section.SectionId;
    parentName: string;
    sectionName: string;
    modules: ModuleEntry[];
    canCreateSubsection: boolean;
    group: section.SectionBasicGroup;
    acl: section.SectionAcl;
    state: section.SectionState;
    userSettings: section.UserSettings;
    editable: boolean;
    primary: boolean;
    description: string;
    isAdmin: boolean;
    empty: boolean;
    parentScope: string;
    userSettingsEditable: boolean;
}

export interface ModuleEntry {
    id: string;
    selected: boolean;
    notifications: boolean;
}

export interface SectionUpdateResult {
    id: string;
    parentId: section.SectionId;
    name: string;
    modules: (section.ModuleInfo & { notifications: boolean })[];
    group: section.SectionBasicGroup;
    acl: section.SectionAcl;
    state: section.SectionState;
    userSettings: section.UserSettings;
    primary: boolean;
    description: string;
}

export interface Options {
    section?: SectionService;
    parentId?: section.SectionId;
    manager: SectionManager;
    docked?: boolean;
    empty?: boolean;
    onlyReturnResult?: boolean;
}

export interface ResultEvent {
    type: "result";
    result: SectionUpdateResult;
}

export interface RemoveEvent {
    type: "remove";
    section: SectionService;
    parentId: section.SectionId;
}

export interface AddSectionEvent {
    type: "add",
    section: SectionService,
    parentId: section.SectionId
}

@Dependencies(["persons"])
export class SectionEditWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.sectionEdit.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identityProvider: utils.IdentityProvider;
    @Inject utilApi: UtilApi;
    @Inject contactService: ContactService;
    personsComponent: PersonsController;
    deferred: Q.Deferred<SectionUpdateResult>;
    deferredSection: Q.Deferred<SectionService>;
    sectionManager: SectionManager;
    modules: string[];
    state: State;
    docked: boolean;
    onlyReturnResult: boolean;
    activeSection: SectionService;
    wasParentClosable: boolean = true;
    wasIClosable: boolean = true;
    
    constructor(parent: app.WindowParent, public options: Options) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.deferred = Q.defer();
        this.deferredSection = Q.defer();
        this.sectionManager = options.manager;
        this.docked = !!options.docked;
        this.onlyReturnResult = !!options.onlyReturnResult;
        
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 560,
            height: 450,
            title: options.section ? this.i18n("window.sectionEdit.title") : this.i18n("window.sectionEdit.new.title")
        };
        this.modules = this.sectionManager.getSupportedModules();
        this.modules.sort((a, b) => a.localeCompare(b));
        this.setState(options.section, options.parentId, options.empty);
    }
    
    init() {
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
    }
    
    getSectionName(sectionId: string): string {
        let section = sectionId ? this.sectionManager.getSection(sectionId): null;
        return section ? section.getName() : this.i18n("window.sectionEdit.no_parent.label");
    }
    
    populateGroupsFromSectionModel(model: section.SectionUpdateModelDecrypted): string[] {
        let groups: string[] = [];
        if (model.group.type == "admin") {
            groups.push("<admins>");
        }
        else if (model.group.type == "local") {
            groups.push("<local>");
        }
        return groups;
    }
    
    getAvailableUsers(sectionUsers: string[], model: section.SectionUpdateModelDecrypted): string[] {
        let host = this.identityProvider.getIdentity().host;
        let ret: string[] = [];
        let availGroups = SectionUtils.getPredefinedGroups();

        sectionUsers.forEach(x => {
            if (availGroups.indexOf(x) != -1) {
                ret.push(x);
            }
            else
            if (x.indexOf("<") == -1) {
                ret.push(x);
            }
            else 
            if(this.contactService.getContactByHashmail(x + "#" + host) != null) {
                ret.push(x);
            }
        });
        let reduced = ret.filter(item => {
            return this.contactService.deletedUsers.indexOf(item) == -1; 
        })
        return reduced;
    }

    // getAvailableUsers_old(sectionUsers: string[], model: section.SectionUpdateModelDecrypted): string[] {
    //     console.log("availUsers", sectionUsers);
    //     let host = this.identityProvider.getIdentity().host;
    //     return sectionUsers
    //     .filter(x => x.indexOf("<") == -1)
    //     .filter(x => this.contactService.getContactByHashmail(x + "#" + host) != null)
    //     .filter(x => this.contactService.deletedUsers.indexOf(x) == -1)
    // }



    setState(section: SectionService, parentId: section.SectionId, empty: boolean): void {
        let user = this.identityProvider.getIdentity().user;
        if (empty) {
            this.state = null;
        }
        else if (section) {
            let host = this.identityProvider.getIdentity().host;
            this.activeSection = section;
            let model = section.getSectionUpdateModelDecrypted();
            let modules = section.getEnabledModules();
            
            this.state = {
                id: model.id,
                empty: false,
                parentId: model.parentId,
                parentName: this.getSectionName(model.parentId),
                sectionName: model.data.name,
                modules: this.modules.map(x => {
                    return {id: x, selected: Lang.contains(modules, x), notifications: this.areNotificationsEnabled(section, x)};
                }),
                group: {
                    // users: model.group.users.filter(x => x.indexOf("<") == -1).filter(x => this.contactService.getContactByHashmail(x + "#" + host) != null),
                    users: this.getAvailableUsers(model.group.users, model),
                    groups: model.group.users.filter(x => x.indexOf("<") == 0).concat(this.populateGroupsFromSectionModel(model))
                },
                state: model.state,
                primary: section.sectionData.primary,
                description: model.data.description,
                canCreateSubsection: model.acl.createSubsections.all || this.identityProvider.isAdmin() || model.acl.createSubsections.users.indexOf(user) > -1,
                acl: {
                    manage: {
                        admins: model.acl.manage.admins,
                        all: model.acl.manage.all,
                        users: this.getAvailableUsers(model.acl.manage.users, model)
                        // users: model.acl.manage.users.filter(x => x.indexOf("<") == 0 || this.contactService.getContactByHashmail(x + "#" + host) != null),
                    },
                    createSubsections: {
                        admins: model.acl.createSubsections.admins,
                        all: model.acl.createSubsections.all,
                        users: this.getAvailableUsers(model.acl.createSubsections.users, model)
                        // users: model.acl.createSubsections.users.filter(x => x.indexOf("<") == 0 || this.contactService.getContactByHashmail(x + "#" + host) != null),
                    },
                },
                userSettings: section.userSettings,
                editable: section.isEditableByMe(),
                isAdmin: this.identityProvider.isAdmin(),
                parentScope: section.getParent() ? section.getParent().getScope() : "",
                userSettingsEditable: section.getEnabledModules().length > 0
            };
        }
        else {
            this.state = {
                id: null,
                empty: false,
                parentId: parentId,
                parentName: this.getSectionName(parentId),
                sectionName: "",
                modules: this.modules.map(x => {
                    return {id: x, selected: true, notifications: this.areNotificationsEnabled(section, x)};
                }),
                group: {users: [user], groups: []},
                state: "enabled",
                primary: section.sectionData.primary,
                description: "",
                canCreateSubsection: false,
                parentScope: "",
                acl: {
                    createSubsections: {admins: true, all: false, users: ["<admins>"]},
                    manage: {admins: true, all: false, users: ["<admins>"]}
                },
                userSettings: {
                    visible: true,
                    mutedModules: { chat: true, notes2: true, tasks: true }
                },
                editable: true,
                userSettingsEditable: true,
                isAdmin: this.identityProvider.isAdmin()
            };
        }
        this.callViewMethod("setState", this.state);
    }
    
    getModel(): Model {
        return {
            host: this.identityProvider.getIdentity().host,
            modules: this.modules,
            docked: this.docked,
            state: this.state,
            hashmail: this.identityProvider.getIdentity().hashmail,
        };
    }
    
    getPromise(): Q.Promise<SectionUpdateResult> {
        return this.deferred.promise;
    }
    
    getSectionPromise(): Q.Promise<SectionService> {
        return this.deferredSection.promise;
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewMove(): void {
        this.app.ioc.create(SectionPickerWindowController, [this, this.activeSection]).then(win => {
            win.parent = this.getClosestNotDockedController();
            win.openWindowOptions.modal = true;
            this.openChildWindow(win).getSectionPromise().then(section => {
                let returnedId = (section.getId() == SectionPickerWindowController.ROOT_ID ? null : section.getId());
                this.callViewMethod("setParent", returnedId, this.getSectionName(returnedId));
            });
        });
    }
    
    onViewConfirm(result: SectionUpdateResult): void {
        this.confirmForm(result);
    }
    
    onViewRemove(): void {
        this.confirm(this.i18n("window.sectionEdit.removeMessage")).then(result => {
            if (result.result == "yes") {
                this.removeSection();
            }
        })
    }
    
    removeSection(): void {
        let section = this.activeSection;
        if (section == null) {
            return;
        }
        let parent = section.getParent();
        let parentId = parent ? parent.getId() : null;
        this.callViewMethod("startRemoving");
        Q().then(() => {
            return section.updateEx(x => {
                x.state = "removed";
                return x;
            });
        })
        .then(() => {
            this.callViewMethod("stopRemoving");
            this.dispatchEvent<RemoveEvent>({
                type: "remove",
                section: section,
                parentId: parentId
            });
        })
        .fail(e => {
            this.callViewMethod("stopRemoving");
            this.onError(e);
        });
    }

    onViewAddSection(): void {
        let section = this.activeSection;
        if (section == null) {
            return;
        }
        let parent = section.getParent();
        let parentId = parent ? parent.getId() : null;
        
        this.dispatchEvent<AddSectionEvent>({
            type: "add",
            section: section,
            parentId: parentId
        });
    }
    
    confirmForm(updateResult: SectionUpdateResult) {
        let section = updateResult.id ? this.sectionManager.getSection(updateResult.id) : null;
        if (updateResult.id != null && section == null) {
            this.alert(this.i18n("window.sectionEdit.error.unexpected"));
            return;
        }
        if (updateResult.id == null || section.isEditableByMe()) {
            if (!updateResult.name) {
                this.alert(this.i18n("window.sectionEdit.error.nameRequired"));
                return;
            }
            // cannot change rights to all if you have no admin rights
            if (!this.state.isAdmin && SectionUtils.hasUsersGroup(updateResult.group.groups, "<local>") && !SectionUtils.hasUsersGroup(this.state.group.groups, "<local>")) {
                this.alert(this.i18n("window.sectionEdit.error.aclToAll"));
                return;
            }
            if (!(this.state.isAdmin || updateResult.acl.manage.admins) && updateResult.acl.manage.users.indexOf(this.identityProvider.getIdentity().user) == -1
                && !updateResult.acl.manage.all) {
                this.alert(this.i18n("window.sectionEdit.error.manageWithoutUser"));
                return;
            }
        }
        if (updateResult.id == null) {
            let parent = updateResult.parentId ? this.sectionManager.getSection(updateResult.parentId) : null;
            if (updateResult.parentId != null && parent == null) {
                this.alert(this.i18n("window.sectionEdit.error.unknownParent"));
                return;
            }
            if ((parent == null && !this.identityProvider.isAdmin()) || (parent != null && !parent.canCreateSubsection())) {
                this.alert(this.i18n("window.sectionEdit.error.cannotCreateSubsection"));
                return;
            }
        }
        if (this.onlyReturnResult) {
            if (this.docked) {
                this.dispatchEvent<ResultEvent>({type: "result", result: updateResult});
            }
            else {
                this.deferred.resolve(updateResult);
                this.close();
            }
            return;
        }
        this.callViewMethod("startSaving");
        

        return Q().then(() => {
            this.setWindowCloseLock(true);
            this.parent.dispatchEvent<SectionChangeLockEvent>({type: "section-change-lock", lock: true});
            if (updateResult.id == null) {
                // create new section
                let newSection: section.SectionCreateModelDecrypted = {
                    id: null,
                    parentId: updateResult.parentId,
                    data: {
                        name: updateResult.name, 
                        modules: {}, extraOptions: null, 
                        description: updateResult.description
                    },
                    group: {type: SectionUtils.getProperGroupType(updateResult.group.groups), users: SectionUtils.filterUsers(updateResult.group.users)},
                    state: updateResult.state,
                    acl: updateResult.acl,
                    primary: updateResult.primary
                };
                return this.sectionManager.createSectionWithModules(newSection, updateResult.modules, false);
            }
            else {
                // update existing section
                if (!section.isEditableByMe()) {
                    return section;
                }
                return section.updateWithModules(this.getUpdater(updateResult), updateResult.modules).thenResolve(section);
            }
        })
        .then(section => {
            return section.sectionData.primary ? this.refreshSections().thenResolve(section) : section;
        })
        .then(section => {
            // console.log("onUpdate - section.userSettings", section.userSettings, "result userSettings", updateResult.userSettings)
            // mute all modules if section not visible in sidebar
            // let settingsToUpdate = JSON.parse(JSON.stringify(section.userSettings));
            let settingsToUpdate = updateResult.userSettings;
            // console.log("settingsToUpdate", settingsToUpdate);
            updateResult.modules.forEach(x => settingsToUpdate.mutedModules[this.convertModuleName(x.name)] = !x.notifications);
            if (! updateResult.userSettings.visible) {
                settingsToUpdate.mutedModules.chat = true;
                settingsToUpdate.mutedModules.notes2 = true;
                settingsToUpdate.mutedModules.tasks = true;
            }
            return section.updateUserSettings(settingsToUpdate).fail(e => {
                this.logError(e);
                this.alert(this.i18n("window.sectionEdit.error.errorSavingUserPref"));
            }).thenResolve(section);
        })
        .then(section => {
            this.callViewMethod("confirmSave");
            this.callViewMethod("stopSaving");
            this.setWindowCloseLock(false);
            this.parent.dispatchEvent({type: "section-change-lock", lock: false});
            if (!this.docked) {
                this.deferredSection.resolve(section);
                this.close();
            }
            this.app.dispatchEvent<ReopenSectionEvent>({
                type: "reopen-section",
                element: section,
            });
            (<SectionsWindowController>this.parent).setActive(section);

        })
        .fail(e => {
            this.setWindowCloseLock(false);
            this.parent.dispatchEvent({type: "section-change-lock", lock: false});
            this.callViewMethod("stopSaving");
            this.onError(e);
        })
    }
    
    setWindowCloseLock(lock: boolean): void {
        // if (lock) {
        //     this.wasParentClosable = this.getClosestNotDockedController().nwin.getClosable();
        //     this.wasIClosable = this.nwin.getClosable();
        //     this.nwin.setClosable(false);
        //     this.getClosestNotDockedController().nwin.setClosable(false);
        // }
        // else {
        //     this.nwin.setClosable(this.wasIClosable);
        //     this.getClosestNotDockedController().nwin.setClosable(this.wasParentClosable);
        // }
        this.nwin.setClosable(!lock);
        this.getClosestNotDockedController().nwin.setClosable(!lock);
    }
    
    getUpdater(updateResult: SectionUpdateResult): (model: section.SectionUpdateModelDecrypted) => section.SectionUpdateModelDecrypted {
        return data => {
            let updated = data;
            updated.parentId = updateResult.parentId;
            updated.group = { type: SectionUtils.getProperGroupType(updateResult.group.groups), users: SectionUtils.filterUsers(updateResult.group.users)};
            updated.data.name = updateResult.name;
            updated.acl = updateResult.acl;
            updated.state = updateResult.state;
            updated.primary = updateResult.primary;
            updated.data.description = updateResult.description;
            return updated;
        };
    }
    
    refreshSections(): Q.Promise<void> {
        return this.sectionManager.load()
        .then(() => {
            this.sectionManager.sectionAccessManager.eventDispatcher.dispatchEvent({type: "refresh-sections"});
        })
    }
    
    getUsers(type: string): string[] {
        if (type == "group") {
            return this.state.group.users;
        }
        if (type == "manage") {
            return this.state.acl.manage.users;
        }
        if (type == "createSubsections") {
            return this.state.acl.createSubsections.users;
        }
    }
    
    getGroups(type: string): string[] {
        if (type == "group") {
            return this.state.group.groups;
        }
        if (type == "manage") {
            return this.state.acl.manage.users.filter(x => x.indexOf("<") == 0);
        }
        if (type == "createSubsections") {
            return this.state.acl.createSubsections.users.filter(x => x.indexOf("<") == 0);
        }
    }
        
    setUsersAndGroups(type: string, users: string[], groups: string[]): void {
        if (type == "group") {
            
            this.state.group.users = users;
            this.state.group.groups = groups;
        }
        else if (type == "manage") {
            this.state.acl.manage.users = users.concat(groups);
        }
        else if (type == "createSubsections") {
            this.state.acl.createSubsections.users = users.concat(groups);
        }
    }
    
    onViewChooseUsers(type: string) {
        let allowExternals = type != "createSubsections";
        this.app.ioc.create(SelectContactsWindowController, [this.parent, {
            editable: true,
            hashmails: Lang.unique(this.getUsers(type).concat(this.getGroups(type)).map(x => {
                let groups = SectionUtils.getPredefinedGroups(this.identityProvider.getRights());
                if (groups.indexOf(x) > -1) {
                    return x;
                }
                else {
                    return x + "#" + this.identityProvider.getIdentity().host;
                }
                
            })),
            fromServerUsers: true,
            allowMyself: true,
            allowGroups: true,
            allowEmpty: true,
            message: this.i18n("window.sectionEdit.chooseUsers"),
            allowExternalUsers: allowExternals
        }])
        .then(win => {
            this.openChildWindow(win).getPromise().then(hashmails => {
                let availGroups = SectionUtils.getPredefinedGroups(this.identityProvider.getRights());
                let groups = hashmails.filter(x => availGroups.indexOf(x) > -1);
                let leftHashmails = hashmails.filter(x => groups.indexOf(x) == -1);
                let users = leftHashmails.map(x => x.split("#")[0]);
                            
                this.setUsersAndGroups(type, users, groups);
                this.callViewMethod("updateUsers", type, users, groups);
            });
            
        });
    }
    
    onViewShare() {
        if (!this.activeSection) {
            return;
        }
        if (!this.activeSection.hasAccess()) {
            this.alert(this.i18n("window.sectionEdit.shareNoAccess"));
            return;
        }
        Q().then(() => {
            return this.activeSection.shareSection();
        })
        .then(bip39 => {
            this.app.ioc.create(SubIdWindowController, [this.parent, {
                mnemonic: bip39.mnemonic,
                host: this.identityProvider.getIdentity().host
            }])
            .then(win => {
                this.openChildWindow(win);
            });
        })
        .fail(this.errorCallback);
    }
    
    isDirty(): Q.Promise<boolean> {
        return this.retrieveFromView<boolean>("isDirty").then(dirty => {
            return dirty == null ? false : dirty;
        });
    }
    
    closeConfirm(): Q.IWhenable<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            return this.confirmEx({
                message: this.i18n("window.sectionEdit.unsavedChanges"),
                yes: {
                    faIcon: "trash",
                    btnClass: "btn-warning",
                    label: this.i18n("window.sectionEdit.unsavedChanges.discard")
                },
                no: {
                    faIcon: "",
                    btnClass: "btn-default",
                    label: this.i18n("core.button.cancel.label")
                }
            })
            .then(result => {
                defer.resolve(result.result != "yes");
            });

        });
        return defer.promise;
    }
    
    // beforeClose(_force: boolean): Q.IWhenable<void> {
    //     console.log("sectionEdit beforeClose");
    //     this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
    //     let defer = Q.defer<void>();
    //     Q().then(() => {
    //         return this.isDirty()
    //         .then(dirty =>{
    //             if (dirty) {
    //                 console.log("window is dirty");
    //                 this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
    //                 return this.closeConfirm();
    //             } else {
    //                 this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
    //                 return false;
    //             }
    //         })
    //         .then(needSave => {
    //             console.log("needSave", needSave);
    //             if (!needSave) {
    //                 this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
    //                 defer.resolve();
    //             }
    //             else {
    //                 this.manager.cancelClosing();
    //             }
                
    //         })
    //     });
    //     return defer.promise;
    // }

    beforeClose(_force: boolean): Q.IWhenable<void> {
        if (_force) {
            this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
            return;
        }
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
        return Q().then(() => {
            return this.isDirty()
            .then(dirty => {
                if (dirty) {
                    this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
                } else {
                    this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                }
            })
        })
    }
    
    onViewCloseMyParent(): void {
        this.manager.parent.close();
    }
    
    areNotificationsEnabled(section: SectionService, moduleName: string): boolean {
        moduleName = this.convertModuleName(moduleName);
        return section && section.userSettings && section.userSettings.mutedModules ? !section.userSettings.mutedModules[moduleName] : true;
    }
    
    convertModuleName(name: string): string {
        let map: { [key: string]: string }  = {
            chat: section.NotificationModule.CHAT,
            file: section.NotificationModule.NOTES2,
            kvdb: section.NotificationModule.TASKS,
            calendar: section.NotificationModule.CALENDAR,
        }
        return name in map ? map[name] : name;
    }
    
}
