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
var TaskGroupSelectorWindowController = (function (_super) {
    __extends(TaskGroupSelectorWindowController, _super);
    function TaskGroupSelectorWindowController(parentWindow, session, projectId, defaultSelectedTaskGroupIds) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.session = session;
        _this.projectId = projectId;
        _this.defaultSelectedTaskGroupIds = defaultSelectedTaskGroupIds;
        _this.deferred = pmc_mail_1.Q.defer();
        _this.ipcMode = true;
        _this.setPluginViewAssets("tasks");
        _this.openWindowOptions.modal = true;
        _this.openWindowOptions.title = _this.i18n("plugin.tasks.window.taskGroupSelector.title");
        _this.openWindowOptions.icon = "icon fa fa-tasks";
        _this.openWindowOptions.width = 300;
        _this.openWindowOptions.height = 400;
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.mutableTaskGroupsCollection = _this.addComponent("mutableTaskGroupsCollection", new pmc_mail_1.utils.collection.MutableCollection());
        _this.sortedTaskGroupsCollection = _this.addComponent("sortedTaskGroupsCollection", new pmc_mail_1.utils.collection.SortedCollection(_this.mutableTaskGroupsCollection, _this.taskGroupComparator.bind(_this)));
        _this.activeTaskGroupsCollection = _this.addComponent("activeTaskGroupsCollection", new pmc_mail_1.utils.collection.WithMultiActiveCollection(_this.sortedTaskGroupsCollection));
        _this.transformTaskGroupsCollection = _this.addComponent("transformTaskGroupsCollection", new pmc_mail_1.utils.collection.TransformCollection(_this.activeTaskGroupsCollection, _this.transformTaskGroupModel.bind(_this)));
        _this.taskGroupsExtList = _this.addComponent("taskGroupsExtList", _this.componentFactory.createComponent("extlist", [_this, _this.transformTaskGroupsCollection]));
        _this.taskGroupsExtList.ipcMode = true;
        var project = _this.tasksPlugin.projects[_this.session.hostHash][_this.projectId];
        if (project) {
            var tgs = project.getTaskGroupIds()
                .map(function (x) { return _this.tasksPlugin.taskGroups[_this.session.hostHash][x]; })
                .filter(function (x) { return x != null; })
                .map(function (x) { return ({ id: x.getId(), name: x.getName(), isSelected: false, iconStr: x.getIcon() }); });
            _this.mutableTaskGroupsCollection.addAll(tgs);
            var _loop_1 = function (tgId) {
                this_1.activeTaskGroupsCollection.setSelected(this_1.activeTaskGroupsCollection.getBy("id", tgId));
                this_1.activeTaskGroupsCollection.triggerUpdateAt(this_1.activeTaskGroupsCollection.indexOfBy(function (x) { return x.id == tgId; }));
            };
            var this_1 = this;
            for (var _i = 0, _a = _this.defaultSelectedTaskGroupIds; _i < _a.length; _i++) {
                var tgId = _a[_i];
                _loop_1(tgId);
            }
        }
        return _this;
    }
    TaskGroupSelectorWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    TaskGroupSelectorWindowController.prototype.transformTaskGroupModel = function (tgm, idx) {
        tgm.isSelected = this.activeTaskGroupsCollection.isSelected(idx);
        return tgm;
    };
    TaskGroupSelectorWindowController.prototype.taskGroupComparator = function (a, b) {
        return a.name.localeCompare(b.name);
    };
    TaskGroupSelectorWindowController.prototype.setSelected = function (idx, isSelected) {
        var el = this.activeTaskGroupsCollection.get(idx);
        if (isSelected) {
            this.activeTaskGroupsCollection.setSelected(el);
        }
        else {
            this.activeTaskGroupsCollection.deselect(el);
        }
        this.activeTaskGroupsCollection.triggerUpdateAt(idx);
    };
    TaskGroupSelectorWindowController.prototype.isSelected = function (idx) {
        return this.activeTaskGroupsCollection.isSelected(idx);
    };
    TaskGroupSelectorWindowController.prototype.getPromise = function () {
        return this.deferred.promise;
    };
    TaskGroupSelectorWindowController.prototype.getModel = function () {
        return {};
    };
    TaskGroupSelectorWindowController.prototype.onViewClose = function () {
        this.close();
    };
    TaskGroupSelectorWindowController.prototype.onViewSave = function () {
        var _this = this;
        var activeIds = this.activeTaskGroupsCollection.getSelectedIndexes().filter(function (x) { return x >= 0; }).map(function (x) { return _this.activeTaskGroupsCollection.get(x).id; });
        this.deferred.resolve({ taskGroupIds: activeIds });
        this.close();
    };
    TaskGroupSelectorWindowController.prototype.onViewToggleSelected = function (id) {
        var idx = this.activeTaskGroupsCollection.indexOfBy(function (x) { return x.id == id; });
        if (idx >= 0) {
            this.setSelected(idx, !this.isSelected(idx));
        }
    };
    TaskGroupSelectorWindowController.textsPrefix = "plugin.tasks.window.taskGroupSelector.";
    TaskGroupSelectorWindowController = __decorate([
        Dependencies(["extlist"])
    ], TaskGroupSelectorWindowController);
    return TaskGroupSelectorWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.TaskGroupSelectorWindowController = TaskGroupSelectorWindowController;
TaskGroupSelectorWindowController.prototype.className = "com.privmx.plugin.tasks.window.taskGroupSelector.TaskGroupSelectorWindowController";

//# sourceMappingURL=TaskGroupSelectorWindowController.js.map
