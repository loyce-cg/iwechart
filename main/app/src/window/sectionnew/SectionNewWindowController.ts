import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app, utils, section} from "../../Types";
import { SectionService } from "../../mail/section/SectionService";
import {SectionManager} from "../../mail/section/SectionManager";
import {SelectContactsWindowController} from "../selectcontacts/SelectContactsWindowController";
import { BaseWindowManager } from "../../app/BaseWindowManager";
import { SectionPickerWindowController } from "../sectionpicker/SectionPickerWindowController";
import {Inject} from "../../utils/Decorators"
import { SectionsWindowController } from "../sections/SectionsWindowController";
import { UtilApi } from "../../mail/UtilApi";
import { SectionUtils } from "../../mail/section/SectionUtils";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { PersonsController } from "../../component/persons/PersonsController";
import { ContactService } from "../../mail/contact/ContactService";
import { Lang } from "../../utils/Lang";

export interface Model {
    host: string;
    modules: string[];
    docked: boolean;
    state: State;
}

export interface State {
    id: string;
    parentId: section.SectionId;
    parentName: string;
    sectionName: string;
    modules: ModuleEntry[];
    group: section.SectionBasicGroup;
    acl: section.SectionAcl;
    state: section.SectionState;
    userSettings: section.UserSettings;
    editable: boolean;
    isAdmin: boolean;
    empty: boolean;
    isPrivate: boolean;
    parentScope: string;
}

export interface ModuleEntry {
    id: string;
    selected: boolean;
}

export interface SectionUpdateResult {
    id: string;
    parentId: section.SectionId;
    name: string;
    modules: section.ModuleInfo[];
    group: section.SectionBasicGroup;
    acl: section.SectionAcl;
    state: section.SectionState;
    userSettings: section.UserSettings;
    isPrivate: boolean;
    description: string;
}

export interface Options {
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

export class SectionNewWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.sectionNew.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identityProvider: utils.IdentityProvider;
    @Inject utilApi: UtilApi;
    @Inject contactService: ContactService;
    deferred: Q.Deferred<SectionUpdateResult>;
    deferredSection: Q.Deferred<SectionService>;
    sectionManager: SectionManager;
    modules: string[];
    state: State;
    docked: boolean;
    onlyReturnResult: boolean;
    activeSection: SectionService;
    personsComponent: PersonsController;
    
    constructor(parent: app.WindowParent, public options: Options) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.deferred = Q.defer();
        this.deferredSection = Q.defer();
        this.sectionManager = options.manager;
        this.docked = !!options.docked;
        this.onlyReturnResult = !!options.onlyReturnResult;
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 560,
            height: 325,
            title: this.i18n("window.sectionNew.title")
        };
        this.modules = this.sectionManager.getSupportedModules();
        this.setState(options.parentId, options.empty);
    }
    
    getSectionName(sectionId: string): string {
        if (sectionId == SectionsWindowController.NOT_SELECTED) {
            return this.i18n("window.sectionNew.not_selected.label");
        }
        let section = sectionId ? this.sectionManager.getSection(sectionId): null;
        return section ? section.getName() : this.i18n("window.sectionNew.no_parent.label");
    }

    getParentScope(sectionId: string): string {
        if (sectionId == SectionsWindowController.NOT_SELECTED) {
            return "";
        }
        let section = sectionId ? this.sectionManager.getSection(sectionId): null;
        return section ? section.getScope() : "";
    }

    
    setState(parentId: section.SectionId, empty: boolean): void {
        if (empty) {
            this.state = null;
        }
        else {
            let user = this.identityProvider.getIdentity().user;
            this.state = {
                id: null,
                empty: false,
                parentId: parentId,
                parentName: this.getSectionName(parentId),
                sectionName: "",
                modules: this.modules.map(x => {
                    return {id: x, selected: true};
                }),
                // group: {users: [user], groups: []},
                group: {
                    users: [], groups: [SectionUtils.LOCAL_USERS_GROUP]
                },
                state: "enabled",
                acl: {
                    createSubsections: {admins: false, all: false, users: [user]},
                    manage: {admins: false, all: false, users: [user]}
                },
                userSettings: {
                    visible: true,
                    mutedModules: { chat: false, notes2: false, tasks: false }
                },
                editable: true,
                isAdmin: this.identityProvider.isAdmin(),
                isPrivate: false,
                parentScope: this.getParentScope(parentId)
            };
        }
        this.callViewMethod("setState", this.state);
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

    getModel(): Model {
        return {
            host: this.identityProvider.getIdentity().host,
            modules: this.modules,
            docked: this.docked,
            state: this.state
        };
    }
    
    getPromise(): Q.Promise<SectionUpdateResult> {
        return this.deferred.promise;
    }
    
    getSectionPromise(): Q.Promise<SectionService> {
        return this.deferredSection.promise;
    }
    
    onViewClose(): void {
        this.close(true);
    }
    
    onViewMove(): void {
        this.app.ioc.create(SectionPickerWindowController, [this, this.activeSection]).then(win => {
            this.openChildWindow(win).getSectionPromise().then(section => {
                let returnedId = (section.getId() == SectionPickerWindowController.ROOT_ID ? null : section.getId());
                this.callViewMethod("setParent", returnedId, this.getSectionName(returnedId), this.getParentScope(returnedId));
            });
        });
    }
    
    onViewConfirm(result: SectionUpdateResult): void {
        this.confirmForm(result);
    }
    
    
    confirmForm(updateResult: SectionUpdateResult) {
        let section = updateResult.id ? this.sectionManager.getSection(updateResult.id) : null;
        if (updateResult.id != null && section == null) {
            this.alert(this.i18n("window.sectionNew.error.unexpected"));
            return;
        }
        
        if (updateResult.id == null || section.isEditableByMe()) {
            if (!updateResult.name) {
                this.alert(this.i18n("window.sectionNew.error.nameRequired"));
                return;
            }
            
            if (!this.state.isAdmin && SectionUtils.hasUsersGroup(updateResult.group.groups, "<local>") && !SectionUtils.hasUsersGroup(this.state.group.groups, "<local>")) {
                this.alert(this.i18n("window.sectionNew.error.aclToAll"));
                return;
            }
            if (!(this.state.isAdmin && updateResult.acl.manage.admins) && updateResult.acl.manage.users.indexOf(this.identityProvider.getIdentity().user) == -1) {
                this.alert(this.i18n("window.sectionNew.error.manageWithoutUser"));
                return;
            }

        }
        if (updateResult.id == null) {
            let parent = updateResult.parentId ? this.sectionManager.getSection(updateResult.parentId) : null;

            // checking of existance ot sections with same name as given name
            if (parent) {
                let sameLevelSameNameSections = parent.getDescantsAndMe().filter(x => {
                    let xParent = x.getParent();
                    return xParent && xParent.getId() == parent.getId();
                }).filter(x => x.getName() == updateResult.name);
                
                if (sameLevelSameNameSections.length > 0) {
                    this.alert(this.i18n("window.sectionNew.error.wrongName"));
                    return;
                }
            }
            else {
                let sameLevelSameNameSections = this.sectionManager.filteredCollection.list.filter(x => {
                    let xParent = x.getParent();
                    return xParent == null && x.getName() == updateResult.name
                });
                
                if (sameLevelSameNameSections.length > 0) {
                    this.alert(this.i18n("window.sectionNew.error.wrongName"));
                    return;
                }
            }
                        
            if (updateResult.parentId != null && updateResult.parentId != SectionsWindowController.ROOT_ID && parent == null) {
                this.alert(this.i18n("window.sectionNew.error.unknownParent"));
                return;
            }
            if ((parent == null && !this.identityProvider.isAdmin()) || (parent != null && !parent.canCreateSubsection())) {
                this.alert(this.i18n("window.sectionNew.error.cannotCreateSubsection"));
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
            if (updateResult.id == null) {
                // create new section
                let newSection: section.SectionCreateModelDecrypted = {
                    id: null,
                    parentId: updateResult.parentId != SectionsWindowController.ROOT_ID ? updateResult.parentId : null,
                    data: {
                        name: updateResult.name, 
                        modules: {}, 
                        extraOptions: null,
                        description: updateResult.description
                    },
                    group: {
                        type: SectionUtils.getProperGroupType(updateResult.group.groups),
                        users: SectionUtils.filterUsers(updateResult.group.users)
                    },
                    state: updateResult.state,
                    acl: updateResult.isPrivate ? {
                        manage: {admins: false, all: false, users: [this.identityProvider.getIdentity().user]},
                        createSubsections: {admins: false, all: false, users: [this.identityProvider.getIdentity().user]}
                    } : updateResult.acl,
                    primary: false
                };
                return this.sectionManager.createSectionWithModules(newSection, updateResult.modules, false);
            }
        })
        .then(section => {
            return section.updateUserSettings(updateResult.userSettings).fail(e => {
                this.logError(e);
                this.alert(this.i18n("window.sectionNew.error.errorSavingUserPref"));
            }).thenResolve(section);
        })
        .then(section => {
            this.callViewMethod("stopSaving");
            this.callViewMethod("confirmSave");
            if (!this.docked) {
                this.deferredSection.resolve(section);
                this.close();
            }
        })
        .fail(e => {
            this.callViewMethod("stopSaving");
            this.onError(e);
        });
    }
    
    getUpdater(updateResult: SectionUpdateResult): (model: section.SectionUpdateModelDecrypted) => section.SectionUpdateModelDecrypted {
        return data => {
            let updated = data;
            updated.parentId = updateResult.parentId;
            updated.group = { type: SectionUtils.getProperGroupType(updateResult.group.groups), users: SectionUtils.filterUsers(updateResult.group.users) };
            updated.data.name = updateResult.name;
            updated.acl = updateResult.acl;
            return updated;
        };
    }
    
    getUsers(type: string): string[] {
        if (type == "group") {
            // if (this.state.group.type == "admin") {
            //     return ["<admins>"].concat(this.state.group.users);
            // }
            return this.state.group.users;
        }
        if (type == "manage") {
            // if (this.state.acl.manage.admins) {
            //     return ["<admins>"].concat(this.state.acl.manage.users);
            // }
            return this.state.acl.manage.users;
        }
        if (type == "createSubsections") {
            // if (this.state.acl.createSubsections.admins) {
            //     return ["<admins>"].concat(this.state.acl.createSubsections.users);
            // }
            return this.state.acl.createSubsections.users;
        }
    }

    getGroups(type: string): string[] {
        if (type == "group") {
            // if (this.state.group.type == "admin") {
            //     return ["<admins>"].concat(this.state.group.users);
            // }
            return this.state.group.groups;
        }
        if (type == "manage") {
            // if (this.state.acl.manage.admins) {
            //     return ["<admins>"].concat(this.state.acl.manage.users);
            // }
            return this.state.acl.manage.users.filter(x => x.indexOf("<") == 0);
        }
        if (type == "createSubsections") {
            // if (this.state.acl.createSubsections.admins) {
            //     return ["<admins>"].concat(this.state.acl.createSubsections.users);
            // }
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

    setUsers(type: string, users: string[], groups: string[]): void {
        if (type == "group") {
            this.state.group.users = users;
            // if (groups.indexOf("<admins>") != -1) {
            //     this.state.group.type = "admin";
            // }
            this.state.group.groups = groups;
        }
        else if (type == "manage") {
            // if (users.length > 0 || groups.length > 0) {
            //     this.state.acl.manage.all = false;
            // }
            //
            this.state.acl.manage.users = users.concat(groups);
            // this.state.acl.manage.admins = groups.indexOf("<admins>") != -1;
        }
        else if (type == "createSubsections") {
            // if (users.length > 0 || groups.length > 0) {
            //     this.state.acl.createSubsections.all = false;
            // }
            //
            this.state.acl.createSubsections.users = users.concat(groups);
            // this.state.acl.createSubsections.admins = groups.indexOf("<admins>") != -1;
        }
    }
    
    onViewChooseUsers(type: string) {
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
            message: this.i18n("window.sectionNew.chooseUsers")
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

    
    isDirty(): Q.Promise<boolean> {
        return this.retrieveFromView<boolean>("isDirty").then(dirty => {
            return dirty == null ? false : dirty;
        });
    }
    
    closeConfirm(): Q.IWhenable<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            return this.confirmEx({
                message: this.i18n("window.sectionNew.unsavedChanges"),
                yes: {
                    faIcon: "trash",
                    btnClass: "btn-warning",
                    label: this.i18n("window.sectionNew.unsavedChanges.discard")
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
    
    beforeClose(_force: boolean): Q.IWhenable<void> {
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
        let defer = Q.defer<void>();
        Q().then(() => {
            if (_force) {
                this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                return defer.resolve();
            }
    
            return this.isDirty()
            .then(dirty =>{
                if (dirty) {
                    this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
                    return this.closeConfirm();
                } else {
                    return false;
                }
            })
            .then(needSave => {
                if (!needSave) {
                    this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                    defer.resolve();
                }
                else {
                    this.manager.cancelClosing();
                }
                
            })
        });
        return defer.promise;
    }
    
}
