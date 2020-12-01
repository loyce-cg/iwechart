import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model, ModuleEntry, State, SectionUpdateResult} from "./SectionNewWindowController";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import {Scope} from "../../web-utils/Scope";
import {section} from "../../Types";
import {Lang} from "../../utils/Lang";

// export interface AclEntry {
//     admins: boolean;
//     users: boolean;
//     all: boolean;
//     usernames: string[];
//     editMode: boolean;
//     getLabel(): string;
//     getUsers(): string;
// }
//
// export interface GroupEntry {
//     allIsAvailable: boolean;
//     type: string;
//     users: string[];
//     editMode: boolean;
//     getLabel(): string;
//     getUsers(): string;
// }

export interface AclGroupsEntry {
    groups: string[],
    users: string[],
    editMode: boolean;
    getLabel(): string;
    getUsers(): string;
    getGroups(): string;
}


export interface ScopeData {
    id: string;
    empty: boolean;
    editable: boolean;
    mode: string;
    parentId: string;
    parentName: string;
    parentScope: string;
    name: string;
    modules: ModuleEntry[];
    group: AclGroupsEntry;
    state: section.SectionState;
    acl: {
        manage: AclGroupsEntry;
        createSubsections: AclGroupsEntry;
    };
    userSettings: {
        visible: boolean;
        mutedModules: section.NotificationSettings;
    };
    isPrivate: string;
    loading: boolean;
    saving: boolean;
    removing: boolean;
    chooseUsers: (type: string) => void;
    confirm: () => void;
    close: () => void;
    move: () => void;
}

@WindowView
export class SectionNewWindowView extends BaseWindowView<Model> {
    
    $aclInner: JQuery;
    scope: Scope<ScopeData>;
    initData: ScopeData;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        $(document).on("keydown", this.onKeyDown.bind(this));
        this.setState(model.state);
    }
    
    setState(state: State): void {
        if (state == null) {
            if (this.scope != null) {
                this.scope.data.empty = true;
            }
            this.$main.addClass("hide");
            return;
        }
        this.$main.removeClass("hide");
        let data: ScopeData = {
            id: state.id,
            empty: false,
            editable: state.editable,
            mode: state.id ? "update" : "create",
            parentId: state.parentId,
            parentName: state.parentName,
            parentScope: state.parentScope,
            name: "",
            modules: state.modules,
            group: this.getGroupEntry(state.group),
            acl: {
                manage: this.getAclEntry(state.acl.manage),
                createSubsections: this.getAclEntry(state.acl.createSubsections)
            },
            state: state.state,
            userSettings: {
                visible: state.userSettings.visible,
                mutedModules: state.userSettings.mutedModules
            },
            isPrivate: state.isPrivate ? "true" : "false",
            loading: false,
            saving: false,
            removing: false,
            chooseUsers: this.onChooseUsers.bind(this),
            confirm: this.onConfirmClick.bind(this),
            close: this.onCloseClick.bind(this),
            move: this.onMoveClick.bind(this),
        };
        
        this.initData = Lang.createCleanCopy(data);
        if (this.scope) {
            this.scope.setData(data);
        }
        else {
            this.scope = new Scope(this.$main, data);
        }
        this.refreshWindowHeight();
    }
    
    setParent(id: string, name: string, parentScope?: string): void {
        this.scope.data.parentId = id;
        this.scope.data.parentName = name;
        this.scope.data.parentScope = parentScope;
        this.scope.onChange();
        this.refreshWindowHeight();
    }
    
    getGroupEntry(group: section.SectionBasicGroup): AclGroupsEntry {
        let entry: AclGroupsEntry = {
            users: group.users,
            groups: group.groups,
            editMode: false,
            getLabel: null,
            getUsers: null,
            getGroups: null
        };
        entry.getLabel = () => {
            // if (entry.type == "local") {
            //     return this.helper.i18n("window.sectionNew.acl.all");
            // }
            // return this.getUsersLabel(entry.users);
            return this.getGroupsLabel(entry.groups) + (entry.users && entry.users.length > 0 ? ',<span class="space"></span>' + this.getUsersLabel(entry.users) : "");
        };
        entry.getUsers = () => {
            return this.getUsersLabel(entry.users);
        };
        return entry;
    }
    
    getAclEntry(acl: section.AclEntry): AclGroupsEntry {
        let entry: AclGroupsEntry = {
            users: acl.users.filter(x => x.indexOf("<") == -1),
            groups: acl.users.filter(x => x.indexOf("<") == 0),
            editMode: false,
            getLabel: null,
            getUsers: null,
            getGroups: null
        };
        entry.getLabel = () => {
            // if (entry.admins) {
            //     return this.helper.i18n("window.sectionNew.acl.admins") + (entry.users ? ", " + this.getUsersLabel(entry.usernames) : "");
            // }
            // return this.getUsersLabel(entry.usernames)
            return this.getGroupsLabel(entry.groups) + (entry.users && entry.users.length > 0 ? ',<span class="space"></span>' + this.getUsersLabel(entry.users) : "");

        };
        entry.getUsers = () => {
            return this.getGroupsLabel(entry.groups) + (entry.users && entry.users.length > 0 ? ',<span class="space"></span>' + this.getUsersLabel(entry.users) : "");
        };
        return entry;
    }
    
    getUsersLabel(users: string[]): string {
        if (users.length == 0) {
            return this.helper.i18n("window.sectionNew.acl.noone");
        }
        return users.join(", ");
    }
    
    getGroupsLabel(groups: string[]): string {
        if (groups.length == 0) {
            return "";
        }
        let html = "";
        groups.forEach((group, i) => {
            let name = this.i18n("core.usersgroup." + group.substring(1, group.length - 1));
            html += i == 0 ? '' : '<span class="space"></span>';
            html += '<span class="user"><i class="fa fa-group"></i> ';
            html += '<span class="name">' + name + '</span>';
            html += (i < groups.length - 1 ? ',' : '') + '</span>';
        });
        return html;
    }
        
    onChooseUsers(type: string): void {
        this.triggerEvent("chooseUsers", type);
    }
    
    // updateUsers(type: string, users: string[]): void {
    //     if (type == "group") {
    //         this.scope.data.group.users = users;
    //     }
    //     else if (type == "manage") {
    //         this.scope.data.acl.manage.usernames = users;
    //     }
    //     else if (type == "createSubsections") {
    //         this.scope.data.acl.createSubsections.usernames = users;
    //     }
    //     this.scope.onChange();
    // }
    
    updateUsers(type: string, users: string[], groups: string[]): void {
        if (type == "group") {
            this.scope.data.group.users = users;
            this.scope.data.group.groups = groups;
            // if (groups.indexOf("<admins>") != -1) {
            //     this.scope.data.group.type = "admin";
            // }
        }
        else if (type == "manage") {
            this.scope.data.acl.manage.users = users;
            this.scope.data.acl.manage.groups = groups;
            // this.scope.data.acl.manage.admins = groups.indexOf("<admins>") != -1;
        }
        else if (type == "createSubsections") {
            this.scope.data.acl.createSubsections.users = users;
            this.scope.data.acl.createSubsections.groups = groups;
            // this.scope.data.acl.createSubsections.admins = groups.indexOf("<admins>") != -1;
        }
        this.scope.onChange();
    }
    
    
    getResult(): SectionUpdateResult {
        if (this.scope == null || this.scope.data.empty) {
            return null;
        }
        let result: SectionUpdateResult = {
            id: this.scope.data.id,
            parentId: this.scope.data.parentId,
            name: this.scope.data.name.trim(),
            modules: this.scope.data.modules.map(x => {
                return {name: x.id, enabled: x.selected};
            }),
            group: {
                // type: this.scope.data.group.type,
                users: this.scope.data.group.users,
                groups: this.scope.data.group.groups
            },
            state: this.scope.data.state,
            acl: {
                createSubsections: {
                    admins: this.scope.data.acl.createSubsections.groups.indexOf("<admins>") > -1,
                    all: this.scope.data.acl.createSubsections.groups.indexOf("<local>") > -1,
                    // users: this.scope.data.acl.createSubsections.users ? this.scope.data.acl.createSubsections.usernames : []
                    users: this.scope.data.acl.createSubsections.users.concat(this.scope.data.acl.createSubsections.groups),
                },
                manage: {
                    admins: this.scope.data.acl.manage.groups.indexOf("<admins>") > -1,
                    all: this.scope.data.acl.manage.groups.indexOf("<local>") > -1,
                    users: this.scope.data.acl.manage.users.concat(this.scope.data.acl.manage.groups),
                }
            },
            userSettings: {
                visible: this.scope.data.userSettings.visible,
                mutedModules: this.scope.data.userSettings.mutedModules,
            },
            isPrivate: this.scope.data.isPrivate == "true"
        };
        return result;
    }
    
    confirmSave(): void {
        this.initData = this.scope ? Lang.createCleanCopy(this.scope.data) : null;
    }
    
    isDirty(): boolean {
        if (this.initData == null || this.scope == null || this.scope.data.empty) {
            return false;
        }
        return JSON.stringify(Lang.createCleanCopy(this.scope.data)) != JSON.stringify(this.initData);
    }
    
    onConfirmClick(): void {
        this.triggerEvent("confirm", this.getResult());
    }
    
    onMoveClick(): void {
        this.triggerEvent("move");
    }
    
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.keyCode == KEY_CODES.escape) {
            e.preventDefault();
            this.onCloseClick();
        }
    }
    
    startSaving(): void {
        this.scope.data.loading = true;
        this.scope.data.saving = true;
        this.scope.onChange();
    }
    
    stopSaving(): void {
        this.scope.data.loading = false;
        this.scope.data.saving = false;
        this.scope.onChange();
        let $si = this.$main.find(".saved-indicator");
        $si.removeClass("hide").fadeIn(200, () => {
            setTimeout(() => {
                $si.fadeOut(600, () => {
                    $si.addClass("hide");
                });
            }, 600);
        });
    }
    
    stopRemoving(): void {
        this.scope.data.loading = false;
        this.scope.data.removing = false;
        this.scope.onChange();
    }
}
