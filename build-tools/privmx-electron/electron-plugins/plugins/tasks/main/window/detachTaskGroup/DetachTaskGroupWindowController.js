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
var DetachTaskGroupWindowController = (function (_super) {
    __extends(DetachTaskGroupWindowController, _super);
    function DetachTaskGroupWindowController(parentWindow, session, taskGroupId) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.session = session;
        _this.taskGroupId = taskGroupId;
        _this.deferred = pmc_mail_1.Q.defer();
        _this.ipcMode = true;
        _this.setPluginViewAssets("tasks");
        _this.openWindowOptions.modal = true;
        _this.openWindowOptions.title = _this.i18n("plugin.tasks.window.detachTaskGroup.title");
        _this.openWindowOptions.icon = "icon fa fa-tasks";
        _this.openWindowOptions.width = 400;
        _this.openWindowOptions.height = 170;
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        return _this;
    }
    DetachTaskGroupWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    DetachTaskGroupWindowController.prototype.getPromise = function () {
        return this.deferred.promise;
    };
    DetachTaskGroupWindowController.prototype.resolve = function (detached) {
        this.deferred.resolve({
            detached: detached,
        });
    };
    DetachTaskGroupWindowController.prototype.getModel = function () {
        return {};
    };
    DetachTaskGroupWindowController.prototype.onViewClose = function () {
        this.cancel();
    };
    DetachTaskGroupWindowController.prototype.onViewCancel = function () {
        this.cancel();
    };
    DetachTaskGroupWindowController.prototype.onViewDetach = function () {
        this.detach();
    };
    DetachTaskGroupWindowController.prototype.cancel = function () {
        this.resolve(false);
        this.close();
    };
    DetachTaskGroupWindowController.prototype.detach = function () {
        var _this = this;
        this.confirm(this.i18n("plugin.tasks.window.detachTaskGroup.detachConfirm")).then(function (result) {
            if (result.result == "yes") {
                _this.callViewMethod("onAfterDetached");
                var projectId = _this.tasksPlugin.getTaskGroup(_this.session, _this.taskGroupId).getProjectId();
                _this.notifications.showNotification(_this.i18n("plugin.tasks.window.detachTaskGroup.notifications.taskGroupDetaching"), { autoHide: false, progress: true });
                _this.tasksPlugin.detachTaskGroup(_this.session, _this.taskGroupId).then(function () {
                    _this.resolve(true);
                })
                    .fail(function () {
                    _this.resolve(false);
                })
                    .fin(function () {
                    _this.close();
                });
            }
            else {
                _this.callViewMethod("toggleButtonsEnabled", true);
            }
        })
            .fail(function () {
            _this.callViewMethod("toggleButtonsEnabled", true);
        });
    };
    DetachTaskGroupWindowController.textsPrefix = "plugin.tasks.window.detachTaskGroup.";
    DetachTaskGroupWindowController = __decorate([
        Dependencies(["extlist"])
    ], DetachTaskGroupWindowController);
    return DetachTaskGroupWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.DetachTaskGroupWindowController = DetachTaskGroupWindowController;
DetachTaskGroupWindowController.prototype.className = "com.privmx.plugin.tasks.window.detachTaskGroup.DetachTaskGroupWindowController";

//# sourceMappingURL=DetachTaskGroupWindowController.js.map
