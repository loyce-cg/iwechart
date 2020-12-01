import { app, window, Q, mail } from "pmc-mail";
import { TasksWindowController } from "../tasks/TasksWindowController";
import { TasksPlugin } from "../../main/TasksPlugin";
import { i18n } from "./i18n/index";

export class MainWindowController extends window.base.BaseAppWindowController {
    
    static textsPrefix: string = "plugin.tasks.window.main.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    tasksWindow: TasksWindowController;
    tasksPlugin: TasksPlugin;
    
    constructor(public parentWindow: window.container.ContainerWindowController) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.setPluginViewAssets("tasks");
        this.openWindowOptions.fullscreen = true;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = this.i18n("plugin.tasks.window.main.title");
        this.openWindowOptions.icon = "icon fa fa-tasks";
        
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
    }
    
    init(): any {
        return Q().then(() => {
            return <any>this.app.mailClientApi.checkLoginCore();
        })
        .then(() => {
            return <any>this.app.mailClientApi.privmxRegistry.getSystemFs();
        })
        .then(() => {
            return <any>this.tasksPlugin.checkInit().then(() => this.tasksPlugin.projectsReady);
        })
        .then(() => {
            return this.app.ioc.create(TasksWindowController, [this, true]);
        })
        .then(win => {
            win.parent = this;
            this.tasksWindow = win;
            
        });
    }
    
    onViewLoad(): void {
        if (this.tasksWindow.nwin == null) {
            this.tasksWindow.openDocked(this.nwin, 1);
        }
        let dockedNwin = <app.common.window.DockedWindow>this.tasksWindow.nwin;
        this.callViewMethod("openIframe", dockedNwin.id, dockedNwin.load);
    }
    
    applyHistoryState(processed: boolean, state: string) {
        this.checkInit().then(() => {
            this.tasksWindow.applyHistoryState(processed, state);
        });
    }
    
}
