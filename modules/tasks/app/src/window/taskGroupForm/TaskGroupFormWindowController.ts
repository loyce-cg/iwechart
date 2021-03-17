import { window, component, utils, Q, mail, app } from "pmc-mail";
import { Types } from "pmc-mail";
import { TasksPlugin, TasksComponentFactory } from "../../main/TasksPlugin";
import { ProjectId, EventHandler, Action, Watchable, TaskGroupId } from "../../main/Types";
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";
import { DetachTaskGroupWindowController } from "../detachTaskGroup/DetachTaskGroupWindowController";
import { IconPickerWindowController } from "../iconPicker/IconPickerWindowController";
import { SearchFilter } from "../../main/SearchFilter";

export interface Result {
    name: string;
    dueDate: string;
    deleted: boolean;
    icon: string;
}

export interface Model {
    id: string;
    name: string;
    dueDate: string;
    projectName: string;
    detached?: boolean;
    icon: string;
}

@Dependencies(["notification"])
export class TaskGroupFormWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.tasks.window.taskGroupForm.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    taskGroupId: TaskGroupId;
    deferred: Q.Deferred<Result>;
    tasksPlugin: TasksPlugin;
    projectListener: EventHandler;
    notifications: component.notification.NotificationController;
    dirty: boolean = false;
    componentFactory: TasksComponentFactory;
    hasNewIcon: boolean = false;
    newIcon: string;
    
    constructor(parentWindow: Types.app.WindowParent, public session: mail.session.Session, public projectId: ProjectId, public data: string|Model, public modal: boolean = false) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        if (typeof(this.data) == "object") {
            this.taskGroupId = this.data.id;
        } else {
            this.taskGroupId = null;
        }
        this.projectId = projectId;
        this.deferred = Q.defer();
        this.setPluginViewAssets("tasks");
        this.openWindowOptions.title = this.i18n("plugin.tasks.window.taskGroupForm.title");
        this.openWindowOptions.icon = "icon fa fa-tasks";
        this.openWindowOptions.width = 500;
        this.openWindowOptions.height = 135;
        this.openWindowOptions.modal = this.modal;
        
        this.projectListener = this.onProjectChanged.bind(this);
        this.tasksPlugin.watch(this.session, "project", projectId, "*", this.projectListener);
        
        // Custom select: projects
        let availProjects = this.tasksPlugin.getAvailableProjects(this.session);
        let projects: Array<component.customselect.CustomSelectItem> = [];
        for (let k in availProjects) {
            let proj = availProjects[k];
            projects.push({
                type: "item",
                icon: <Types.webUtils.IconAsset>{
                    type: "asset",
                    assetName: "DEFAULT_PRIVMX_ICON",
                },
                value: k,
                text: proj.getName(),
                selected: k == projectId,
            });
        }
        this.tasksPlugin.registerWindow(this.getWindowId(), this);
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
    }
    
    getWindowId(): string {
        return TaskGroupFormWindowController.getWindowId(this.session, this.taskGroupId);
    }
    
    static getWindowId(session: mail.session.Session, taskGroupId: string): string {
        return "taskgroup-" + session.hostHash + "-" + (taskGroupId ? taskGroupId : "");
    }
    
    getPromise(): Q.Promise<Result> {
        return this.deferred.promise;
    }
    
    getModel(): Model {
        let tg = this.tasksPlugin.taskGroups[this.session.hostHash][this.taskGroupId];
        let detached = tg ? tg.getDetached() : false;
        if (typeof(this.data) == "object") {
            this.data.detached = detached;
            return this.data;
        } else {
            return {
                id: null,
                name: "",
                dueDate: "",
                projectName: this.data,
                detached: detached,
                icon: null,
            };
        }
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewOk(resultStr: string): void {
        let result = <Result>JSON.parse(resultStr);
        let tg = this.tasksPlugin.taskGroups[this.session.hostHash][this.taskGroupId];
        result.icon = this.hasNewIcon ? this.newIcon : (tg ? tg.getIcon() : null);
        if (!this.isNameAvailable(result.name)) {
            this.alert(this.i18n("plugin.tasks.window.taskGroupForm.nameTaken"));
            return;
        }
        result.deleted = false;
        this.deferred.resolve(result);
        this.close();
    }
    
    beforeClose(): void {
        this.tasksPlugin.unregisterWindow(this.getWindowId());
        this.tasksPlugin.unWatch(this.session, "project", this.projectId, "*", this.projectListener);
        this.deferred.reject();
    }
    
    onViewDeleteTaskGroup(): void {
        if (!this.taskGroupId) {
            return;
        }
        
        this.confirm(this.i18n("plugin.tasks.window.taskGroupForm.deleteConfirm")).then(result => {
            if (result.result == "yes") {
                let tg = this.tasksPlugin.getTaskGroup(this.session, this.taskGroupId);
                this.tasksPlugin.deleteTaskGroup(this.session, tg, true, false);
                this.deferred.resolve({
                    deleted: true,
                    dueDate: null,
                    name: null,
                    icon: null,
                });
                this.close();
            }
        })
    }
    
    onProjectChanged(type: Watchable, id: string, action: Action): void {
        if (action == "deleted") {
            this.close();
        }
        else if (action == "modified") {
            this.callViewMethod("setProjectName", this.tasksPlugin.getProject(this.session, this.projectId).getName());
        }
    }
    
    onViewDetach(): void {
        this.app.ioc.create(DetachTaskGroupWindowController, [this, this.session, this.taskGroupId]).then(win => {
            this.openChildWindow(win).getPromise().then(result => {
                if (result.detached) {
                    this.callViewMethod("onAfterCloseList");
                    this.notifications.showNotification(this.i18n("plugin.tasks.window.taskGroupForm.notifications.taskGroupDetached"));
                    setTimeout(() => {
                        this.close();
                    }, 1000);
                }
            });
        });
    }
    
    onViewDirtyChanged(dirty: boolean): void {
        this.dirty = dirty;
    }
    
    isNameAvailable(name: string): boolean {
        for (let i in this.tasksPlugin.taskGroups[this.session.hostHash]) {
            let tg = this.tasksPlugin.taskGroups[this.session.hostHash][i];
            let name1 = SearchFilter.prepareNeedle(tg.getName().trim());
            let name2 = SearchFilter.prepareNeedle(name.trim());
            if (tg && tg.getId() != this.taskGroupId && this.projectId == tg.getProjectId() && name1 == name2) {
                return false;
            }
        }
        return true;
    }
    
    onViewChangeIcon(): void {
        let tg = this.tasksPlugin.taskGroups[this.session.hostHash][this.taskGroupId];
        let icon = this.hasNewIcon ? this.newIcon : (tg ? tg.getIcon() : null);
        this.app.ioc.create(IconPickerWindowController, [this, icon]).then(win => {
            this.openChildWindow(win).getPromise().then(result => {
                if (!result.cancelled) {
                    this.setIcon(result.iconStr);
                }
            });
        });
    }
    
    setIcon(iconStr: string): void {
        this.hasNewIcon = true;
        this.newIcon = iconStr;
        this.callViewMethod("renderIcon", iconStr);
    }
    
}
