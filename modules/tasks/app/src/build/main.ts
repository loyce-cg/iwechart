import * as Mail from "pmc-mail";
import { MainWindowController } from "../window/main/MainWindowController";
import { TasksPlugin } from "../main/TasksPlugin";
import { CustomSelectController } from "../component/customSelect/CustomSelectController";
import { IconPickerController } from "../component/iconPicker/IconPickerController";
import { TaskPanelController } from "../component/taskPanel/TaskPanelController";
import { TaskGroupsPanelController } from "../component/taskGroupsPanel/TaskGroupsPanelController";
import { ViewContext } from "../main/Types";
import { TaskWindowController } from "../window/task/TaskWindowController";
import { TaskGroupFormWindowController } from "../window/taskGroupForm/TaskGroupFormWindowController";
import { TaskGroupSelectorWindowController } from "../window/taskGroupSelector/TaskGroupSelectorWindowController";
import { TasksWindowController } from "../window/tasks/TasksWindowController";
import { DetachTaskGroupWindowController } from "../window/detachTaskGroup/DetachTaskGroupWindowController";
import { IconPickerWindowController } from "../window/iconPicker/IconPickerWindowController";
let Logger = Mail.Logger.get("privfs-tasks-plugin.main");

export class Plugin {
    
    register(mail: typeof Mail, app: Mail.app.common.CommonApplication) {
        let tasksPlugin = app.addComponent("tasks-plugin", new TasksPlugin(app));
        
        // i18n: main
        tasksPlugin.registerTexts(app.localeService);
        
        // i18n: components
        CustomSelectController.registerTexts(app.localeService);
        IconPickerController.registerTexts(app.localeService);
        TaskGroupsPanelController.registerTexts(app.localeService);
        TaskPanelController.registerTexts(app.localeService);
        
        // i18n: windows
        DetachTaskGroupWindowController.registerTexts(app.localeService);
        IconPickerWindowController.registerTexts(app.localeService);
        MainWindowController.registerTexts(app.localeService);
        TaskWindowController.registerTexts(app.localeService);
        TaskGroupFormWindowController.registerTexts(app.localeService);
        TaskGroupSelectorWindowController.registerTexts(app.localeService);
        TasksWindowController.registerTexts(app.localeService);
        
        app.ioc.registerComponent("taskscustomselect", CustomSelectController);
        app.ioc.registerComponent("iconpicker", IconPickerController);
        app.ioc.registerComponent("taskpanel", TaskPanelController);
        app.ioc.registerComponent("taskGroupsPanel", TaskGroupsPanelController);
        
        app.addEventListener<Mail.Types.event.AfterLoginEvent>("afterlogin", () => {
            app.addCountModel(tasksPlugin.tasksUnreadCountModel);
            let cnt = <Mail.window.container.ContainerWindowController>app.windows.container;
            let entry = cnt.registerAppWindow({
                id: "tasks",
                label: app.localeService.i18n("plugin.tasks.app.navbar.label"),
                controllerClass: MainWindowController,
                icon: "privmx-icon-tasks",
                historyPath: "/tasks",
                count: tasksPlugin.tasksUnreadCountModel,
                countFullyLoaded: tasksPlugin.tasksUnreadCountFullyLoadedModel,
            });
            cnt.initApp = entry.id;
            app.mailClientApi.loadUserPreferences()
        }, "tasks", "ethernal");
        
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.sectionsummary.SectionSummaryWindowController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({path: "window/component/taskGroupsPanel/template/main.css", plugin: "tasks"});
                event.instance.addViewScript({path: "build/view.js", plugin: "tasks"});
                app.ioc.create(TaskGroupsPanelController, [event.instance, event.instance.personsComponent]).then(ele => {
                    ele.context = event.instance.loadSingleModule ? ViewContext.TasksWindow : ViewContext.SummaryWindow;
                    event.instance.registerModule("tasks", ele);
                    ele.afterViewLoaded.promise.then(() => {
                        ele.activate();
                    });
                    let origBeforeClose = event.instance.beforeClose;
                    event.instance.beforeClose = force => {
                        origBeforeClose(force);
                        Mail.Q().then(() => {
                            ele.beforeClose();
                        });
                    };
                });
            }
        }, "tasks", "ethernal");
        
        
        app.addEventListener<Mail.Types.event.SinkIndexManagerReady>("sinkindexmanagerready", () => {
            tasksPlugin.checkInit().fail(e => {
                Logger.error("error init tasks plugin", e);
            });
        }, "tasks", "ethernal");
        
        app.addEventListener<Mail.Types.event.SinkPollingResultEvent>("sinkpollingresult", event => {
            tasksPlugin.onPollingResult(event.entries);
        }, "tasks", "ethernal");
        
        app.addEventListener<Mail.Types.event.AfterLogoutPlugin>("afterlogout", () => {
            tasksPlugin.reset();
        }, "tasks", "ethernal");
        
        if (app.isElectronApp()) {
            let newTaskMenuItem: Mail.app.electronTray.TrayMenuItem = {
                id: "newTask",
                menuId: "loggedIn",
                order: 30,
                onLanguageChange: () => app.localeService.i18n("plugin.tasks.app.tray.newTask"),
                shortcutId: "global.newTask",
                options: {
                    label: app.localeService.i18n("plugin.tasks.app.tray.newTask"),
                    type: "normal",
                    click: () => {
                        tasksPlugin.openNewTaskWindow(app.sessionManager.getLocalSession(), null);
                    }
                }
            };
            (<any>app).trayMenu.registerMenuItem(newTaskMenuItem);
        }
        
    }
    
}
