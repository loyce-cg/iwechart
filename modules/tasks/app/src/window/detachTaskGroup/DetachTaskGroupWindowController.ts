import { window, utils, Q, mail, component } from "pmc-mail";
import { Types } from "pmc-mail";
import { TasksPlugin } from "../../main/TasksPlugin";
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";

export interface Result {
    detached: boolean;
}

export interface Model {
}

@Dependencies(["extlist"])
export class DetachTaskGroupWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.tasks.window.detachTaskGroup.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    deferred: Q.Deferred<Result> = Q.defer();
    tasksPlugin: TasksPlugin;
    notifications: component.notification.NotificationController;
    
    constructor(parentWindow: Types.app.WindowParent, public session: mail.session.Session, public taskGroupId: string) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.setPluginViewAssets("tasks");
        this.openWindowOptions.modal = true;
        this.openWindowOptions.title = this.i18n("plugin.tasks.window.detachTaskGroup.title");
        this.openWindowOptions.icon = "icon fa fa-tasks";
        this.openWindowOptions.width = 400;
        this.openWindowOptions.height = 170;
        
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
    }

    
    getPromise(): Q.Promise<Result> {
        return this.deferred.promise;
    }
    
    resolve(detached: boolean) {
        this.deferred.resolve({
            detached: detached,
        });
    }
    
    getModel(): Model {
        return {
        };
    }
    
    onViewClose(): void {
        this.cancel();
    }
    
    onViewCancel(): void {
        this.cancel();
    }
    
    onViewDetach(): void {
        this.detach();
    }
    
    cancel(): void {
        this.resolve(false);
        this.close();
    }
    
    detach(): void {
        this.confirm(this.i18n("plugin.tasks.window.detachTaskGroup.detachConfirm")).then(result => {
            if (result.result == "yes") {
                this.callViewMethod("onAfterDetached");
                let projectId = this.tasksPlugin.getTaskGroup(this.session, this.taskGroupId).getProjectId();
                this.notifications.showNotification(this.i18n("plugin.tasks.window.detachTaskGroup.notifications.taskGroupDetaching"), { autoHide: false, progress: true });
                this.tasksPlugin.detachTaskGroup(this.session, this.taskGroupId).then(() => {
                    this.resolve(true);
                })
                .fail(() => {
                    this.resolve(false);
                })
                .fin(() => {
                    this.close();
                })
            }
            else {
                this.callViewMethod("toggleButtonsEnabled", true);
            }
        })
        .fail(() => {
            this.callViewMethod("toggleButtonsEnabled", true);
        });
    }
    
}