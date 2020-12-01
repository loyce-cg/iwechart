import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model, ModuleEntry, State, SectionUpdateResult} from "./SectionEditWindowController";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import {Scope} from "../../web-utils/Scope";
import {section} from "../../Types";
import {Lang} from "../../utils/Lang";
import {PersonsView} from "../../component/persons/PersonsView";
import * as Q from "q";

export interface AclGroupsEntry {
    groups: string[];
    users: string[];
    editMode: boolean;
    isPrivate?: boolean;
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
    name: string;
    modules: ModuleEntry[];
    group: AclGroupsEntry;
    enabled: boolean;
    canCreateSubsection: boolean;
    acl: {
        manage: AclGroupsEntry;
        createSubsections: AclGroupsEntry;
    };
    userSettings: {
        visible: boolean;
        mutedModules: section.NotificationSettings;
    };
    userSettingsEditable: boolean;
    loading: boolean;
    saving: boolean;
    primary: boolean;
    isAdmin: boolean;
    removing: boolean;
    parentScope: string;
    primaryEditable: boolean;
    chooseUsers: (type: string) => void;
    confirm: () => void;
    close: () => void;
    move: () => void;
    remove: () => void;
    share: () => void;
    addSection: () => void;
    isDirty: () => void;
    isPrimaryEditable: () => boolean;
}

@WindowView
export class SectionEditWindowView extends BaseWindowView<Model> {
    
    $aclInner: JQuery;
    scope: Scope<ScopeData>;
    host: string;
    initData: SectionUpdateResult;
    personsComponent: PersonsView;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.helper));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q().then(() => {
            $(document).on("keydown", this.onKeyDown.bind(this));
            this.host = model.host;
            this.personsComponent.$main = this.$main;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this.setState(model.state);
            this.$main.removeClass("hide");
            this.$main.find(".module-checked[data-id]").change(this.onModuleVisibilityChange.bind(this));
            this.$main.find("input[data-type=manage]").change(this.onManageChange.bind(this));
        });
    }
    
    onModuleVisibilityChange(e: MouseEvent) {
        let $e = $(e.target);
        let data = this.scope.data;
        data.modules.forEach(x => {
            if (x.id == $e.data("id")) {
                x.selected = $e.prop("checked");
            }
        });
        if (data.modules.filter(x => x.selected == true).length == 0) {
            data.userSettingsEditable = false;
        }
        else {
            data.userSettingsEditable = true;
        }
        if (this.scope) {
            this.scope.setData(data);
        }
    }

    onManageChange(e: MouseEvent) {
        // let $e = $(e.target);
        // let value = $e.val();
        // let data = this.scope.data;
        // if (value == "all") {
        //     data.acl.manage.all = true;
        //     data.acl.manage.users = false;
        // }
        // else
        // if (value == "users") {
        //     data.acl.manage.all = false;
        //     data.acl.manage.users = true;
        // }
        //
        // if (this.scope) {
        //     this.scope.setData(data);
        // }
        // $e.prop("checked", true);
        //
    }
    
    
    setState(state: State): void {
        if (state == null) {
            if (this.scope != null) {
                this.scope.data.empty = true;
            }
            this.$main.find(".with-data").addClass("hide");
            this.$main.find(".empty").removeClass("hide");
            return;
        }
        this.$main.find(".with-data").removeClass("hide");
        this.$main.find(".empty").addClass("hide");
        let data: ScopeData = {
            id: state.id,
            empty: false,
            editable: state.editable,
            mode: state.id ? "update" : "create",
            parentId: state.parentId,
            isAdmin: state.isAdmin,
            parentName: state.parentName,
            name: state.sectionName,
            modules: state.modules,
            primaryEditable: state.parentId == null && state.editable && state.isAdmin,
            group: this.getGroupEntry(state.group),
            canCreateSubsection: state.canCreateSubsection,
            acl: {
                manage: this.getAclEntry(state.acl.manage),
                createSubsections: this.getAclEntry(state.acl.createSubsections)
            },
            enabled: state.state == "enabled",
            userSettings: {
                visible: state.userSettings.visible,
                mutedModules: state.userSettings.mutedModules,
            },
            primary: state.primary,
            loading: false,
            saving: false,
            removing: false,
            parentScope: state.parentScope,
            userSettingsEditable: state.userSettingsEditable,
            chooseUsers: this.onChooseUsers.bind(this),
            confirm: this.onConfirmClick.bind(this),
            close: this.onCloseClick.bind(this),
            move: this.onMoveClick.bind(this),
            remove: this.onRemoveClick.bind(this),
            share: this.onShareClick.bind(this),
            addSection: this.onAddSectionClick.bind(this),
            isDirty: this.isDirty.bind(this),
            isPrimaryEditable: this.isPrimaryEditable.bind(this),

        };
        
        if (this.scope) {
            this.scope.setData(data);
        }
        else {
            this.scope = new Scope(this.$main, data, () => {
                this.personsComponent.refreshAvatars();
            });
        }
        this.initData = Lang.createCleanCopy(this.getResult());
    }
    
    setParent(id: string, name: string): void {
        this.scope.data.parentId = id;
        this.scope.data.parentName = name;
        this.scope.onChange();
    }
    
    isPrimaryEditable(): boolean {
        if (this.scope && this.scope.data) {
            return this.scope.data.parentId == null && this.scope.data.editable && this.scope.data.isAdmin;
        }
        return false;
    }

    getGroupEntry(group: section.SectionBasicGroup): AclGroupsEntry {
        let entry: AclGroupsEntry = {
            // allIsAvailable: group.type == "local" || isAdmin,
            // type: group.type,
            groups: group.groups,
            users: group.users,
            editMode: false,
            getLabel: null,
            getUsers: null,
            getGroups: null
        };
        entry.getLabel = () => {
            return this.renderGroupsAndUsersLabel(entry.groups, entry.users);
        };
        entry.getUsers = () => {
            return this.getUsersLabel(entry.users);
        };
        return entry;
    }
    
    renderGroupsAndUsersLabel(groups: string[], users: string[]): string {
        if (users.length == 0 && groups.length == 0) {
            return this.helper.i18n("window.sectionEdit.acl.noone");
        }
        let toRender = this.getGroupsLabel(groups);
        if (groups.length && users.length) {
            toRender += ',<span class="space"></span>';
        }
        return toRender + this.getUsersLabel(users);
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
        entry.isPrivate = entry.groups.indexOf("<admins>") == -1 && entry.groups.indexOf("<local>") == -1,

        entry.getLabel = () => {
            return this.renderGroupsAndUsersLabel(entry.groups, entry.users);
        };
        entry.getUsers = () => {
            return this.getUsersLabel(entry.users);
        };
        return entry;
    }
    
    getUsersLabel(users: string[]): string {
        let html = "";
        users.forEach((user, i) => {
            let hashmail = user + "#" + this.host;
            let person = this.personsComponent.getPerson(hashmail);
            html += i == 0 ? '' : '<span class="space"></span>';
            html += '<span class="user"><canvas class="not-rendered" data-width="16" data-height="16" data-auto-size="true" data-hashmail-image="' + hashmail + '" data-auto-refresh="true"></canvas> ';
            html += '<span data-hashmail-name="' + hashmail + '" data-auto-refresh="true" data-hashmail-default-name="' + user + '">' + this.personsComponent.getPersonName(hashmail, person && person.username ? person.username : user) + '</span>';
            html += (i < users.length - 1 ? ',' : '') + '</span>';
        });
        return html;
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
    
    updateUsers(type: string, users: string[], groups: string[]): void {
        if (type == "group") {
            this.scope.data.group.users = users;
            this.scope.data.group.groups = groups;
        }
        else if (type == "manage") {
            this.scope.data.acl.manage.users = users;
            this.scope.data.acl.manage.groups = groups;
        }
        else if (type == "createSubsections") {
            this.scope.data.acl.createSubsections.users = users;
            this.scope.data.acl.createSubsections.groups = groups;
        }
        this.scope.onChange();
    }
    
    getResult(): SectionUpdateResult {
        if (this.scope == null || this.scope.data.empty) {
            return null;
        }
        
        this.scope.data.modules.forEach(x => {
            this.scope.data.userSettings.mutedModules[this.convertModuleName(x.id)] = !x.notifications;
        });
        let result: SectionUpdateResult = {
            id: this.scope.data.id,
            parentId: this.scope.data.parentId,
            name: this.scope.data.name.trim(),
            modules: this.scope.data.modules.map(x => {
                return {name: x.id, enabled: x.selected, notifications: x.notifications};
            }),
            group: {
                users: this.scope.data.group.users,
                groups: this.scope.data.group.groups,
            },
            state: this.scope.data.enabled ? "enabled" : "disabled",
            acl: {
                createSubsections: {
                    admins: this.scope.data.acl.createSubsections.groups.indexOf("<admins>") > -1,
                    all: this.scope.data.acl.createSubsections.groups.indexOf("<local>") > -1,
                    users: this.scope.data.acl.createSubsections.users.concat(this.scope.data.acl.createSubsections.groups),
                },
                manage: {
                    admins: this.scope.data.acl.manage.groups.indexOf("<admins>") > -1,
                    all: this.scope.data.acl.manage.groups.indexOf("<local>") > -1,
                    users: this.scope.data.acl.manage.users.concat(this.scope.data.acl.manage.groups),
                }
            },
            primary: this.scope.data.primary,
            userSettings: {
                visible: this.scope.data.userSettings.visible,
                mutedModules: this.scope.data.userSettings.mutedModules,
            }
        };
        return result;
    }
    
    confirmSave(): void {
        this.initData = this.scope ? Lang.createCleanCopy(this.getResult()) : null;
    }
    
    isDirty(): boolean {
        if (this.initData == null || this.scope == null || this.scope.data.empty) {
            return false;
        }
        let isDirty = JSON.stringify(Lang.createCleanCopy(this.getResult())) != JSON.stringify(this.initData) && this.initData.id == Lang.createCleanCopy(this.getResult()).id;
        return isDirty;
    }
    
    
    onConfirmClick(): void {
        this.triggerEvent("confirm", this.getResult());
    }
    
    onMoveClick(): void {
        this.triggerEvent("move");
    }
    
    onRemoveClick(): void {
        this.triggerEvent("remove");
    }
    
    onAddSectionClick(): void {
        this.triggerEvent("addSection");
    }
    
    onShareClick(): void {
        this.triggerEvent("share");
    }
    
    onCloseClick(): void {
        this.triggerEvent("closeMyParent");
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.keyCode == KEY_CODES.escape) {
            e.preventDefault();
            this.onCloseClick();
        }
        if (e.keyCode == KEY_CODES.key8 && e.ctrlKey) {
            e.preventDefault();
            this.triggerEvent("share");
        }
    }
    
    startSaving(): void {
        this.scope.data.loading = true;
        this.scope.data.saving = true;
        this.scope.onChange();
    }
    
    startRemoving(): void {
        this.scope.data.loading = true;
        this.scope.data.removing = true;
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
