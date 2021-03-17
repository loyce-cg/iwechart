import { window, Q, Types, mail, utils, privfs, component, app} from "pmc-mail";
import { TaskId, TaskGroupId } from "../../main/Types";
import { TaskPanelController } from "../../component/taskPanel/TaskPanelController";
import { Project } from "../../main/data/Project";
import Dependencies = utils.decorators.Dependencies;
import { TasksComponentFactory, TasksPlugin } from "../../main/TasksPlugin";
import { i18n } from "./i18n/index";

export interface Model {
}

@Dependencies(["taskpanel"])
export class TaskWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.tasks.window.task.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    taskId: TaskId;
    session: mail.session.Session;
    taskPanel: TaskPanelController;
    project: Project = null;
    taskGroupIds: Array<TaskGroupId> = [];
    deferred: Q.Deferred<{saved:boolean,deleted:boolean}>;
    componentFactory: TasksComponentFactory;
    assignTo: string[];
    scrollToComments: boolean;
    newTask: boolean;
    dateTime: Date;
    wholeDay: boolean;
    tasksPlugin: TasksPlugin;
    dirty: boolean = false;
    personsComponent: component.persons.PersonsController;
    
    constructor(parentWindow: Types.app.WindowParent, session: mail.session.Session, taskId: string, editable: boolean = false, project: Project = null, taskGroupIds: Array<TaskGroupId> = [], attachments: mail.section.OpenableSectionFile[] = [], assignTo: string[] = [], scrollToComments: boolean = false, newTask: boolean = false, dateTime: Date = null, wholeDay: boolean = false) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        if (taskGroupIds.length == 1 && taskGroupIds[0] == "__orphans__") {
            taskGroupIds = [];
        }
        this.assignTo = assignTo;
        this.scrollToComments = scrollToComments;
        this.newTask = newTask;
        this.dateTime = dateTime;
        this.wholeDay = wholeDay;
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        
        // Calculate default window width and height
        // Here min* and max* refer to the min/max DEFAULT size, not the min/max resizable by user
        let screenSize = this.app.getScreenResolution(true);
        let minWindowWidth: number;
        let minWindowHeight: number;
        let maxWindowWidth: number;
        let maxWindowHeight: number;
        let percentWindowWidth: number;
        let percentWindowHeight: number;
        if (taskId) {
            // Edit task window
            minWindowWidth = 900;
            minWindowHeight = 438;
            maxWindowWidth = 1500;
            maxWindowHeight = 650;
            percentWindowWidth = 0.8;
            percentWindowHeight = 0.8;
        }
        else {
            // New task window
            minWindowWidth = 550;
            minWindowHeight = 413;
            maxWindowWidth = 900;
            maxWindowHeight = 650;
            percentWindowWidth = 0.5;
            percentWindowHeight = 0.8;
        }
        let windowWidth: number = Math.max(minWindowWidth, Math.min(maxWindowWidth, percentWindowWidth * screenSize.width));
        let windowHeight: number = Math.max(minWindowHeight, Math.min(maxWindowHeight, percentWindowHeight * screenSize.height));
        
        this.deferred = Q.defer();
        this.taskId = taskId;
        this.session = session;
        this.project = project;
        this.taskGroupIds = taskGroupIds;
        this.setPluginViewAssets("tasks");
        this.openWindowOptions.title = this.i18n("plugin.tasks.window.task.title");
        this.openWindowOptions.icon = "icon fa fa-tasks";
        this.openWindowOptions.width = windowWidth;
        this.openWindowOptions.height = windowHeight;
        this.openWindowOptions.minWidth = taskId ? 600 : 350;
        this.openWindowOptions.minHeight = 400;
        //this.openWindowOptions.modal = true;
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.taskPanel = this.addComponent("taskPanel", this.componentFactory.createComponent("taskpanel", [this, this.session, this.personsComponent, {
            close: () => this.close(),
            alert: (msg: string) => this.alert(msg),
            confirm: (msg: string) => this.confirm(msg),
            confirmEx: this.confirmEx.bind(this),
            openWindowParent: this,
            openChildWindow: this.openChildWindow.bind(this),
            updateDirty: this.updateDirty.bind(this),
        }, false, editable, attachments]));
        
        this.tasksPlugin.registerWindow(this.getWindowId(), this);
    }
    
    init(): void {
        this.taskPanel.init().then(() => {
            return this.taskPanel.setSession(this.session);
        })
        .then(() => {
            this.taskPanel.setTaskId(this.session, this.taskId, this.project, this.taskGroupIds, this.assignTo, this.scrollToComments, this.newTask, this.dateTime, this.wholeDay);
        });
    }
    
    onViewLoad() {
        this.initSpellChecker();
    }
    
    setHandle(handle: privfs.fs.descriptor.Handle): void {
        this.taskPanel.setHandle(handle);
    }
    
    getWindowId(): string {
        return TaskWindowController.getWindowId(this.session, this.taskId);
    }
    
    static getWindowId(session: mail.session.Session, taskId: string): string {
        return "task-" + session.hostHash + "-" + (taskId ? taskId : "");
    }
    
    getPromise(): Q.Promise<{saved:boolean,deleted:boolean}> {
        return this.deferred.promise;
    }
    
    getModel(): Model {
        return {};
    }
    
    onViewClose(): void {
        this.close();
    }
    
    close(force?: boolean) {
        this.taskPanel.beforeClose().then(close => {
            if (close) {
                super.close();
            }
        })
    }
    
    beforeClose(_force: boolean): Q.IWhenable<void> {
        this.tasksPlugin.unregisterWindow(this.getWindowId());
        this.deferred.resolve({saved:this.taskPanel.saved,deleted:this.taskPanel.deleted});
        return Q();
    }
    
    updateDirty(dirty: boolean): void {
        this.dirty = dirty;
    }
    
    ensureHasDateTime(dt: Date): void {
        this.taskPanel.ensureHasDateTime(dt);
    }
    
    handleFilePaste(element: app.common.clipboard.ClipboardElement): boolean {
        if (
            (app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES in element.data && this.taskPanel)
                || (element.data.file && element.data.file.element instanceof mail.section.OpenableSectionFile)
                || (element.data.files && element.data.files.filter((x: any) => !x || !(x.element instanceof mail.section.OpenableSectionFile)).length == 0)
            ) {
            this.taskPanel.tryPaste(element, "text" in element.data ? element.data.text : null);
            return true;
        }
        return false;
    }
    
    onTaskCreated(handler: (taskId: string) => void): void {
        this.taskPanel.onTaskCreated(handler);
    }
    
    onCancelled(handler: () => void): void {
        this.taskPanel.onCancelled(handler);
    }
    
}
