import {BaseWindowController} from "../base/BaseWindowController";
import {app, event} from "../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators";
import { TaskChooserController, TaskChooserOptions, TaskChooserCloseEvent } from "../../component/taskchooser/main";
import { CommonApplication } from "../../app/common";
import { SectionService, OpenableSectionFile } from "../../mail/section";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { OpenableElement } from "../../app/common/shell/ShellTypes";
import { NotificationController } from "../../component/notification/main";
import { Session } from "../../mail/session/SessionManager";

export interface TaskChooserWindowOptions extends TaskChooserOptions {
}

export interface Model {
}

@Dependencies(["taskchooser"])
export class TaskChooserWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.taskChooser.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    taskChooser: TaskChooserController;
    
    constructor(parent: app.WindowParent, public options: TaskChooserWindowOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 530;
        this.openWindowOptions.height = 300;
        this.openWindowOptions.title = this.i18n("window.taskChooser.title");
        this.openWindowOptions.icon = "fa fa-tasks";
        this.openWindowOptions.modal = true;
        this.openWindowOptions.keepSpinnerUntilViewLoaded = true;
        
        this.taskChooser = this.addComponent("taskChooser", this.componentFactory.createComponent("taskchooser", [this, this.app, this.options]));
        this.taskChooser.addEventListener("task-chooser-close", this.onTaskChooserClose.bind(this));
        
        this.enableTaskBadgeAutoUpdater();
    }
    
    init() {
        return Q().then(() => {
            this.taskChooser.init();
        });
    }
    
    getModel(): Model {
        return {
        };
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onTaskChooserClose(): void {
        this.close();
    }
    
    static attachFileToTask(parent: BaseWindowController, session: Session, tasksPlugin: any, section: SectionService, file: OpenableSectionFile, handle: privfs.fs.descriptor.Handle, allowOnlyTasksFromGivenSection?: boolean): void {
        parent.app.ioc.create(TaskChooserWindowController, [parent, { session: session, createTaskButton: true, onlyFromSectionIds: allowOnlyTasksFromGivenSection ? [section.getId()] : null }]).then(win => {
            parent.openChildWindow(win);
            win.taskChooser.addEventListener<TaskChooserCloseEvent>("task-chooser-close", e => {
                let taskId = e.taskId;
                if (taskId) {
                    tasksPlugin.attachToTask(session, taskId, file, handle);
                }
                else if (e.requestNewTask) {
                    (<any>tasksPlugin).openNewTaskWindow(session, section, [file], handle);
                }
            });
        });
    }
    
    static attachLocalFileToTask(parent: BaseWindowController, session: Session, tasksPlugin: any, file: OpenableElement, notifications: NotificationController): void {
        parent.app.ioc.create(TaskChooserWindowController, [parent, { session: session, createTaskButton: true }]).then(win => {
            parent.openChildWindow(win);
            let i18nUploading = win.i18n("window.taskChooser.uploading");
            win.taskChooser.addEventListener<TaskChooserCloseEvent>("task-chooser-close", e => {
                let taskId = e.taskId;
                if (taskId) {
                    let notificationId = notifications.showNotification(i18nUploading, { autoHide: false, progress: true });
                    tasksPlugin.uploadAsAttachment(session, file, taskId).then(() => {
                        
                    })
                    .fin(() => {
                        notifications.hideNotification(notificationId);
                    });
                }
                else if (e.requestNewTask) {
                    let section: SectionService = tasksPlugin.privateSection;
                    let notificationId = notifications.showNotification(i18nUploading, { autoHide: false, progress: true });
                    Q().then(() => {
                        return file.getContent();
                    })
                    .then(cnt => {
                        return section.uploadFile({
                            data: cnt,
                            path: "/",
                        });
                    })
                    .then(result => {
                        (<any>tasksPlugin).openNewTaskWindow(session, section, [result.openableElement]);
                    })
                    .fin(() => {
                        notifications.hideNotification(notificationId);
                    });
                }
            });
        });
    }

}
