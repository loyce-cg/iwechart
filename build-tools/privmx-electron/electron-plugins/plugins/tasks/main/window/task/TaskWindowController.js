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
var TaskWindowController = (function (_super) {
    __extends(TaskWindowController, _super);
    function TaskWindowController(parentWindow, session, taskId, editable, project, taskGroupIds, attachments, assignTo, scrollToComments, newTask, dateTime, wholeDay) {
        if (editable === void 0) { editable = false; }
        if (project === void 0) { project = null; }
        if (taskGroupIds === void 0) { taskGroupIds = []; }
        if (attachments === void 0) { attachments = []; }
        if (assignTo === void 0) { assignTo = []; }
        if (scrollToComments === void 0) { scrollToComments = false; }
        if (newTask === void 0) { newTask = false; }
        if (dateTime === void 0) { dateTime = null; }
        if (wholeDay === void 0) { wholeDay = false; }
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.project = null;
        _this.taskGroupIds = [];
        _this.dirty = false;
        _this.ipcMode = true;
        if (taskGroupIds.length == 1 && taskGroupIds[0] == "__orphans__") {
            taskGroupIds = [];
        }
        _this.assignTo = assignTo;
        _this.scrollToComments = scrollToComments;
        _this.newTask = newTask;
        _this.dateTime = dateTime;
        _this.wholeDay = wholeDay;
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        var screenSize = _this.app.getScreenResolution(true);
        var minWindowWidth;
        var minWindowHeight;
        var maxWindowWidth;
        var maxWindowHeight;
        var percentWindowWidth;
        var percentWindowHeight;
        if (taskId) {
            minWindowWidth = 900;
            minWindowHeight = 438;
            maxWindowWidth = 1500;
            maxWindowHeight = 650;
            percentWindowWidth = 0.8;
            percentWindowHeight = 0.8;
        }
        else {
            minWindowWidth = 550;
            minWindowHeight = 413;
            maxWindowWidth = 900;
            maxWindowHeight = 650;
            percentWindowWidth = 0.5;
            percentWindowHeight = 0.8;
        }
        var windowWidth = Math.max(minWindowWidth, Math.min(maxWindowWidth, percentWindowWidth * screenSize.width));
        var windowHeight = Math.max(minWindowHeight, Math.min(maxWindowHeight, percentWindowHeight * screenSize.height));
        _this.deferred = pmc_mail_1.Q.defer();
        _this.taskId = taskId;
        _this.session = session;
        _this.project = project;
        _this.taskGroupIds = taskGroupIds;
        _this.setPluginViewAssets("tasks");
        _this.openWindowOptions.title = _this.i18n("plugin.tasks.window.task.title");
        _this.openWindowOptions.icon = "icon fa fa-tasks";
        _this.openWindowOptions.width = windowWidth;
        _this.openWindowOptions.height = windowHeight;
        _this.openWindowOptions.minWidth = taskId ? 600 : 350;
        _this.openWindowOptions.minHeight = 400;
        _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
        _this.taskPanel = _this.addComponent("taskPanel", _this.componentFactory.createComponent("taskpanel", [_this, _this.session, _this.personsComponent, {
                close: function () { return _this.close(); },
                alert: function (msg) { return _this.alert(msg); },
                confirm: function (msg) { return _this.confirm(msg); },
                confirmEx: _this.confirmEx.bind(_this),
                openWindowParent: _this,
                openChildWindow: _this.openChildWindow.bind(_this),
                updateDirty: _this.updateDirty.bind(_this),
            }, false, editable, attachments]));
        _this.tasksPlugin.registerWindow(_this.getWindowId(), _this);
        return _this;
    }
    TaskWindowController_1 = TaskWindowController;
    TaskWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    TaskWindowController.prototype.init = function () {
        var _this = this;
        this.taskPanel.init().then(function () {
            return _this.taskPanel.setSession(_this.session);
        })
            .then(function () {
            _this.taskPanel.setTaskId(_this.session, _this.taskId, _this.project, _this.taskGroupIds, _this.assignTo, _this.scrollToComments, _this.newTask, _this.dateTime, _this.wholeDay);
        });
    };
    TaskWindowController.prototype.onViewLoad = function () {
        this.initSpellChecker();
    };
    TaskWindowController.prototype.setHandle = function (handle) {
        this.taskPanel.setHandle(handle);
    };
    TaskWindowController.prototype.getWindowId = function () {
        return TaskWindowController_1.getWindowId(this.session, this.taskId);
    };
    TaskWindowController.getWindowId = function (session, taskId) {
        return "task-" + session.hostHash + "-" + (taskId ? taskId : "");
    };
    TaskWindowController.prototype.getPromise = function () {
        return this.deferred.promise;
    };
    TaskWindowController.prototype.getModel = function () {
        return {};
    };
    TaskWindowController.prototype.onViewClose = function () {
        this.close();
    };
    TaskWindowController.prototype.close = function (force) {
        var _this = this;
        this.taskPanel.beforeClose().then(function (close) {
            if (close) {
                _super.prototype.close.call(_this);
            }
        });
    };
    TaskWindowController.prototype.beforeClose = function (_force) {
        this.tasksPlugin.unregisterWindow(this.getWindowId());
        this.deferred.resolve({ saved: this.taskPanel.saved, deleted: this.taskPanel.deleted });
        return pmc_mail_1.Q();
    };
    TaskWindowController.prototype.updateDirty = function (dirty) {
        this.dirty = dirty;
    };
    TaskWindowController.prototype.ensureHasDateTime = function (dt) {
        this.taskPanel.ensureHasDateTime(dt);
    };
    TaskWindowController.prototype.handleFilePaste = function (element) {
        if ((pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES in element.data && this.taskPanel)
            || (element.data.file && element.data.file.element instanceof pmc_mail_1.mail.section.OpenableSectionFile)
            || (element.data.files && element.data.files.filter(function (x) { return !x || !(x.element instanceof pmc_mail_1.mail.section.OpenableSectionFile); }).length == 0)) {
            this.taskPanel.tryPaste(element, "text" in element.data ? element.data.text : null);
            return true;
        }
        return false;
    };
    TaskWindowController.prototype.onTaskCreated = function (handler) {
        this.taskPanel.onTaskCreated(handler);
    };
    TaskWindowController.prototype.onCancelled = function (handler) {
        this.taskPanel.onCancelled(handler);
    };
    var TaskWindowController_1;
    TaskWindowController.textsPrefix = "plugin.tasks.window.task.";
    TaskWindowController = TaskWindowController_1 = __decorate([
        Dependencies(["taskpanel"])
    ], TaskWindowController);
    return TaskWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.TaskWindowController = TaskWindowController;
TaskWindowController.prototype.className = "com.privmx.plugin.tasks.window.task.TaskWindowController";

//# sourceMappingURL=TaskWindowController.js.map
