"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var MainWindowController_1 = require("../window/main/MainWindowController");
var TasksPlugin_1 = require("../main/TasksPlugin");
var IconPickerController_1 = require("../component/iconPicker/IconPickerController");
var TaskPanelController_1 = require("../component/taskPanel/TaskPanelController");
var TaskGroupsPanelController_1 = require("../component/taskGroupsPanel/TaskGroupsPanelController");
var Types_1 = require("../main/Types");
var TaskWindowController_1 = require("../window/task/TaskWindowController");
var TaskGroupFormWindowController_1 = require("../window/taskGroupForm/TaskGroupFormWindowController");
var TaskGroupSelectorWindowController_1 = require("../window/taskGroupSelector/TaskGroupSelectorWindowController");
var TasksWindowController_1 = require("../window/tasks/TasksWindowController");
var DetachTaskGroupWindowController_1 = require("../window/detachTaskGroup/DetachTaskGroupWindowController");
var IconPickerWindowController_1 = require("../window/iconPicker/IconPickerWindowController");
var Logger = Mail.Logger.get("privfs-tasks-plugin.main");
var Plugin = (function () {
    function Plugin() {
    }
    Plugin.prototype.register = function (mail, app) {
        var tasksPlugin = app.addComponent("tasks-plugin", new TasksPlugin_1.TasksPlugin(app));
        tasksPlugin.registerTexts(app.localeService);
        IconPickerController_1.IconPickerController.registerTexts(app.localeService);
        TaskGroupsPanelController_1.TaskGroupsPanelController.registerTexts(app.localeService);
        TaskPanelController_1.TaskPanelController.registerTexts(app.localeService);
        DetachTaskGroupWindowController_1.DetachTaskGroupWindowController.registerTexts(app.localeService);
        IconPickerWindowController_1.IconPickerWindowController.registerTexts(app.localeService);
        MainWindowController_1.MainWindowController.registerTexts(app.localeService);
        TaskWindowController_1.TaskWindowController.registerTexts(app.localeService);
        TaskGroupFormWindowController_1.TaskGroupFormWindowController.registerTexts(app.localeService);
        TaskGroupSelectorWindowController_1.TaskGroupSelectorWindowController.registerTexts(app.localeService);
        TasksWindowController_1.TasksWindowController.registerTexts(app.localeService);
        app.ioc.registerComponent("iconpicker", IconPickerController_1.IconPickerController);
        app.ioc.registerComponent("taskpanel", TaskPanelController_1.TaskPanelController);
        app.ioc.registerComponent("taskGroupsPanel", TaskGroupsPanelController_1.TaskGroupsPanelController);
        app.addEventListener("afterlogin", function () {
            app.addCountModel(tasksPlugin.tasksUnreadCountModel);
            var cnt = app.windows.container;
            var entry = cnt.registerAppWindow({
                id: "tasks",
                label: app.localeService.i18n("plugin.tasks.app.navbar.label"),
                controllerClass: MainWindowController_1.MainWindowController,
                icon: "privmx-icon-tasks",
                historyPath: "/tasks",
                count: tasksPlugin.tasksUnreadCountModel,
                countFullyLoaded: tasksPlugin.tasksUnreadCountFullyLoadedModel,
            });
            cnt.initApp = entry.id;
            app.mailClientApi.loadUserPreferences();
        }, "tasks", "ethernal");
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({ path: "window/component/taskGroupsPanel/template/main.css", plugin: "tasks" });
                event.instance.addViewScript({ path: "build/view.js", plugin: "tasks" });
                app.ioc.create(TaskGroupsPanelController_1.TaskGroupsPanelController, [event.instance, event.instance.personsComponent]).then(function (ele) {
                    ele.context = event.instance.loadSingleModule ? Types_1.ViewContext.TasksWindow : Types_1.ViewContext.SummaryWindow;
                    event.instance.registerModule("tasks", ele);
                    ele.afterViewLoaded.promise.then(function () {
                        ele.activate();
                    });
                    var origBeforeClose = event.instance.beforeClose;
                    event.instance.beforeClose = function (force) {
                        origBeforeClose(force);
                        Mail.Q().then(function () {
                            ele.beforeClose();
                        });
                    };
                });
            }
        }, "tasks", "ethernal");
        app.addEventListener("sinkindexmanagerready", function () {
            tasksPlugin.checkInit().fail(function (e) {
                Logger.error("error init tasks plugin", e);
            });
        }, "tasks", "ethernal");
        app.addEventListener("sinkpollingresult", function (event) {
            tasksPlugin.onPollingResult(event.entries);
        }, "tasks", "ethernal");
        app.addEventListener("afterlogout", function () {
            tasksPlugin.reset();
        }, "tasks", "ethernal");
        if (app.isElectronApp()) {
            var newTaskMenuItem = {
                id: "newTask",
                menuId: "loggedIn",
                order: 30,
                onLanguageChange: function () { return app.localeService.i18n("plugin.tasks.app.tray.newTask"); },
                shortcutId: "global.newTask",
                options: {
                    label: app.localeService.i18n("plugin.tasks.app.tray.newTask"),
                    type: "normal",
                    click: function () {
                        tasksPlugin.openNewTaskWindow(app.sessionManager.getLocalSession(), null);
                    }
                }
            };
            app.trayMenu.registerMenuItem(newTaskMenuItem);
        }
    };
    return Plugin;
}());
exports.Plugin = Plugin;
Plugin.prototype.className = "com.privmx.plugin.tasks.build.Plugin";

//# sourceMappingURL=main.js.map
