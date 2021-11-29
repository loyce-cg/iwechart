"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var index_1 = require("./i18n/index");
var DetachTaskGroupWindowController_1 = require("../detachTaskGroup/DetachTaskGroupWindowController");
var IconPickerWindowController_1 = require("../iconPicker/IconPickerWindowController");
var SearchFilter_1 = require("../../main/SearchFilter");
var TaskGroupFormWindowController = (function (_super) {
    __extends(TaskGroupFormWindowController, _super);
    function TaskGroupFormWindowController(parentWindow, session, projectId, data, modal) {
        if (modal === void 0) { modal = false; }
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.session = session;
        _this.projectId = projectId;
        _this.data = data;
        _this.modal = modal;
        _this.dirty = false;
        _this.hasNewIcon = false;
        _this.ipcMode = true;
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        if (typeof (_this.data) == "object") {
            _this.taskGroupId = _this.data.id;
        }
        else {
            _this.taskGroupId = null;
        }
        _this.projectId = projectId;
        _this.deferred = pmc_mail_1.Q.defer();
        _this.setPluginViewAssets("tasks");
        _this.openWindowOptions.title = _this.i18n("plugin.tasks.window.taskGroupForm.title");
        _this.openWindowOptions.icon = "icon fa fa-tasks";
        _this.openWindowOptions.width = 500;
        _this.openWindowOptions.height = 135;
        _this.openWindowOptions.modal = _this.modal;
        _this.projectListener = _this.onProjectChanged.bind(_this);
        _this.tasksPlugin.watch(_this.session, "project", projectId, "*", _this.projectListener);
        var availProjects = _this.tasksPlugin.getAvailableProjects(_this.session);
        var projects = [];
        for (var k in availProjects) {
            var proj = availProjects[k];
            projects.push({
                type: "item",
                icon: {
                    type: "asset",
                    assetName: "DEFAULT_PRIVMX_ICON",
                },
                value: k,
                text: proj.getName(),
                selected: k == projectId,
            });
        }
        _this.tasksPlugin.registerWindow(_this.getWindowId(), _this);
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        return _this;
    }
    TaskGroupFormWindowController_1 = TaskGroupFormWindowController;
    TaskGroupFormWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    TaskGroupFormWindowController.prototype.getWindowId = function () {
        return TaskGroupFormWindowController_1.getWindowId(this.session, this.taskGroupId);
    };
    TaskGroupFormWindowController.getWindowId = function (session, taskGroupId) {
        return "taskgroup-" + session.hostHash + "-" + (taskGroupId ? taskGroupId : "");
    };
    TaskGroupFormWindowController.prototype.getPromise = function () {
        return this.deferred.promise;
    };
    TaskGroupFormWindowController.prototype.getModel = function () {
        var tg = this.tasksPlugin.taskGroups[this.session.hostHash][this.taskGroupId];
        var detached = tg ? tg.getDetached() : false;
        if (typeof (this.data) == "object") {
            this.data.detached = detached;
            return this.data;
        }
        else {
            return {
                id: null,
                name: "",
                dueDate: "",
                projectName: this.data,
                detached: detached,
                icon: null,
            };
        }
    };
    TaskGroupFormWindowController.prototype.onViewClose = function () {
        this.close();
    };
    TaskGroupFormWindowController.prototype.onViewOk = function (resultStr) {
        var result = JSON.parse(resultStr);
        var tg = this.tasksPlugin.taskGroups[this.session.hostHash][this.taskGroupId];
        result.icon = this.hasNewIcon ? this.newIcon : (tg ? tg.getIcon() : null);
        if (!this.isNameAvailable(result.name)) {
            this.alert(this.i18n("plugin.tasks.window.taskGroupForm.nameTaken"));
            return;
        }
        result.deleted = false;
        this.deferred.resolve(result);
        this.close();
    };
    TaskGroupFormWindowController.prototype.beforeClose = function () {
        this.tasksPlugin.unregisterWindow(this.getWindowId());
        this.tasksPlugin.unWatch(this.session, "project", this.projectId, "*", this.projectListener);
        this.deferred.reject();
    };
    TaskGroupFormWindowController.prototype.onViewDeleteTaskGroup = function () {
        var _this = this;
        if (!this.taskGroupId) {
            return;
        }
        this.confirm(this.i18n("plugin.tasks.window.taskGroupForm.deleteConfirm")).then(function (result) {
            if (result.result == "yes") {
                var tg = _this.tasksPlugin.getTaskGroup(_this.session, _this.taskGroupId);
                _this.tasksPlugin.deleteTaskGroup(_this.session, tg, true, false);
                _this.deferred.resolve({
                    deleted: true,
                    dueDate: null,
                    name: null,
                    icon: null,
                });
                _this.close();
            }
        });
    };
    TaskGroupFormWindowController.prototype.onProjectChanged = function (type, id, action) {
        if (action == "deleted") {
            this.close();
        }
        else if (action == "modified") {
            this.callViewMethod("setProjectName", this.tasksPlugin.getProject(this.session, this.projectId).getName());
        }
    };
    TaskGroupFormWindowController.prototype.onViewDetach = function () {
        var _this = this;
        this.app.ioc.create(DetachTaskGroupWindowController_1.DetachTaskGroupWindowController, [this, this.session, this.taskGroupId]).then(function (win) {
            _this.openChildWindow(win).getPromise().then(function (result) {
                if (result.detached) {
                    _this.callViewMethod("onAfterCloseList");
                    _this.notifications.showNotification(_this.i18n("plugin.tasks.window.taskGroupForm.notifications.taskGroupDetached"));
                    setTimeout(function () {
                        _this.close();
                    }, 1000);
                }
            });
        });
    };
    TaskGroupFormWindowController.prototype.onViewDirtyChanged = function (dirty) {
        this.dirty = dirty;
    };
    TaskGroupFormWindowController.prototype.isNameAvailable = function (name) {
        for (var i in this.tasksPlugin.taskGroups[this.session.hostHash]) {
            var tg = this.tasksPlugin.taskGroups[this.session.hostHash][i];
            var name1 = SearchFilter_1.SearchFilter.prepareNeedle(tg.getName().trim());
            var name2 = SearchFilter_1.SearchFilter.prepareNeedle(name.trim());
            if (tg && tg.getId() != this.taskGroupId && this.projectId == tg.getProjectId() && name1 == name2) {
                return false;
            }
        }
        return true;
    };
    TaskGroupFormWindowController.prototype.onViewChangeIcon = function () {
        var _this = this;
        var tg = this.tasksPlugin.taskGroups[this.session.hostHash][this.taskGroupId];
        var icon = this.hasNewIcon ? this.newIcon : (tg ? tg.getIcon() : null);
        this.app.ioc.create(IconPickerWindowController_1.IconPickerWindowController, [this, icon]).then(function (win) {
            _this.openChildWindow(win).getPromise().then(function (result) {
                if (!result.cancelled) {
                    _this.setIcon(result.iconStr);
                }
            });
        });
    };
    TaskGroupFormWindowController.prototype.setIcon = function (iconStr) {
        this.hasNewIcon = true;
        this.newIcon = iconStr;
        this.callViewMethod("renderIcon", iconStr);
    };
    var TaskGroupFormWindowController_1;
    TaskGroupFormWindowController.textsPrefix = "plugin.tasks.window.taskGroupForm.";
    TaskGroupFormWindowController = TaskGroupFormWindowController_1 = __decorate([
        Dependencies(["notification"])
    ], TaskGroupFormWindowController);
    return TaskGroupFormWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.TaskGroupFormWindowController = TaskGroupFormWindowController;
TaskGroupFormWindowController.prototype.className = "com.privmx.plugin.tasks.window.taskGroupForm.TaskGroupFormWindowController";

//# sourceMappingURL=TaskGroupFormWindowController.js.map
