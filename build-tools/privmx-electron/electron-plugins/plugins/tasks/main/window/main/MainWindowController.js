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
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var TasksWindowController_1 = require("../tasks/TasksWindowController");
var index_1 = require("./i18n/index");
var MainWindowController = (function (_super) {
    __extends(MainWindowController, _super);
    function MainWindowController(parentWindow) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.parentWindow = parentWindow;
        _this.ipcMode = true;
        _this.setPluginViewAssets("tasks");
        _this.openWindowOptions.fullscreen = true;
        _this.openWindowOptions.cssClass = "app-window";
        _this.openWindowOptions.title = _this.i18n("plugin.tasks.window.main.title");
        _this.openWindowOptions.icon = "icon fa fa-tasks";
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        return _this;
    }
    MainWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    MainWindowController.prototype.init = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.mailClientApi.checkLoginCore();
        })
            .then(function () {
            return _this.app.mailClientApi.privmxRegistry.getSystemFs();
        })
            .then(function () {
            return _this.tasksPlugin.checkInit().then(function () { return _this.tasksPlugin.projectsReady; });
        })
            .then(function () {
            return _this.app.ioc.create(TasksWindowController_1.TasksWindowController, [_this, true]);
        })
            .then(function (win) {
            win.parent = _this;
            _this.tasksWindow = win;
        });
    };
    MainWindowController.prototype.onViewLoad = function () {
        if (this.tasksWindow.nwin == null) {
            this.tasksWindow.openDocked(this.nwin, 1);
        }
        var dockedNwin = this.tasksWindow.nwin;
        this.callViewMethod("openIframe", dockedNwin.id, dockedNwin.load);
    };
    MainWindowController.prototype.applyHistoryState = function (processed, state) {
        var _this = this;
        this.checkInit().then(function () {
            _this.tasksWindow.applyHistoryState(processed, state);
        });
    };
    MainWindowController.textsPrefix = "plugin.tasks.window.main.";
    return MainWindowController;
}(pmc_mail_1.window.base.BaseAppWindowController));
exports.MainWindowController = MainWindowController;
MainWindowController.prototype.className = "com.privmx.plugin.tasks.window.main.MainWindowController";

//# sourceMappingURL=MainWindowController.js.map
