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
var Types_1 = require("../../main/Types");
var UniqueId_1 = require("../../main/UniqueId");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var TaskGroup_1 = require("../../main/data/TaskGroup");
var Task_1 = require("../../main/data/Task");
var TaskGroupFormWindowController_1 = require("../../window/taskGroupForm/TaskGroupFormWindowController");
var DataMigration_1 = require("../../main/DataMigration");
var TaskWindowController_1 = require("../../window/task/TaskWindowController");
var TaskGroupSelectorWindowController_1 = require("../../window/taskGroupSelector/TaskGroupSelectorWindowController");
var index_1 = require("./i18n/index");
var Utils_1 = require("../../main/utils/Utils");
var striptags = require("striptags");
var TasksWindowController_1 = require("../../window/tasks/TasksWindowController");
var SearchFilter_1 = require("../../main/SearchFilter");
var Model = (function () {
    function Model() {
    }
    return Model;
}());
exports.Model = Model;
var ProjectModel = (function () {
    function ProjectModel() {
    }
    return ProjectModel;
}());
exports.ProjectModel = ProjectModel;
var TaskGroupModel = (function () {
    function TaskGroupModel() {
    }
    return TaskGroupModel;
}());
exports.TaskGroupModel = TaskGroupModel;
var TaskModel = (function () {
    function TaskModel() {
    }
    return TaskModel;
}());
exports.TaskModel = TaskModel;
var TasksFilterUpdater = (function () {
    function TasksFilterUpdater() {
        this.setFilter({ value: "", visible: false });
    }
    TasksFilterUpdater.prototype.setFilter = function (filter) {
        this.filter = filter;
    };
    TasksFilterUpdater.prototype.updateFilter = function (filter) {
        var _this = this;
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (!filter.visible) {
            this.setFilter({ value: "", visible: false });
            if (this.onUpdate) {
                this.onUpdate();
            }
            return;
        }
        if (filter.value.length < TasksFilterUpdater.MIN_CHARS_NUM && filter.value.length != 0) {
            return;
        }
        this.toUpdate = {
            value: SearchFilter_1.SearchFilter.prepareNeedle(filter.value),
            visible: filter.visible,
        };
        this.updateTimer = setTimeout(function () {
            _this.updateTimer = null;
            _this.setFilter(_this.toUpdate);
            if (_this.onUpdate) {
                _this.onUpdate();
            }
        }, TasksFilterUpdater.UPDATE_DELAY);
    };
    TasksFilterUpdater.UPDATE_DELAY = 500;
    TasksFilterUpdater.MIN_CHARS_NUM = 3;
    return TasksFilterUpdater;
}());
exports.TasksFilterUpdater = TasksFilterUpdater;
var TaskGroupsPanelController = (function (_super) {
    __extends(TaskGroupsPanelController, _super);
    function TaskGroupsPanelController(parent, personsComponent) {
        var _this = _super.call(this, parent) || this;
        _this.personsComponent = personsComponent;
        _this.context = Types_1.ViewContext.TasksWindow;
        _this.uniqueId = "";
        _this.afterViewLoaded = pmc_mail_1.Q.defer();
        _this.wasDataSet = false;
        _this.isActive = false;
        _this.previewTaskId = null;
        _this.collapsedTaskGroups = [];
        _this.selectedTasks = [];
        _this.colWidths = {};
        _this.currDataModel = null;
        _this.taskLineWidth = 100;
        _this.isRefreshing = false;
        _this.mostRecentTasksClipboardElement = null;
        _this.ipcMode = true;
        _this.uniqueId = UniqueId_1.UniqueId.next();
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.customSelectFilter = _this.addComponent("customSelectFilter", _this.componentFactory.createComponent("customselect", [_this, {
                items: [],
                size: "small",
                multi: false,
                editable: true,
                firstItemIsStandalone: false,
            }]));
        _this.taskTooltip = _this.addComponent("tasktooltip", _this.componentFactory.createComponent("tasktooltip", [_this]));
        _this.taskTooltip.getContent = function (taskId) {
            return _this.tasksPlugin.getTaskTooltipContent(_this.session, taskId);
        };
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.tasksPlugin.onWatchedTasksHistoryRebuild(_this.onWatchedTasksHistoryRebuild.bind(_this));
        _this.tasksPlugin.onWatchedTasksHistorySet(_this.onWatchedTasksHistorySet.bind(_this));
        return _this;
    }
    TaskGroupsPanelController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    TaskGroupsPanelController.prototype.init = function () {
        var _this = this;
        this.tasksFilterUpdater = new TasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = function () {
            _this.updateSearchFilter(_this.tasksFilterUpdater.filter);
        };
        this.watchSettingsChanges();
        this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterTasks, "multi");
        this.bindEvent(this.app, "tasks-col-widths-changed", function (event) {
            if (event.key == _this.activeProjectId + "-" + _this.context && event.sender != _this.uniqueId) {
                _this.getColWidths().then(function (widths) {
                    _this.colWidths = widths;
                    _this.callViewMethod("setColWidths", JSON.stringify(widths));
                });
            }
        });
        this.bindEvent(this.app, pmc_mail_1.app.common.clipboard.Clipboard.CHANGE_EVENT, function (event) {
            _this.updateFromClipboard();
        });
        this.updateFromClipboard();
        this.bindEvent(this.app, "active-app-window-changed", function (e) {
            if (e.appWindowId == "tasks" && _this.isActive) {
                _this.callViewMethod("activate");
            }
        });
        this.registerChangeEvent(this.personService.persons.changeEvent, this.onPersonChange.bind(this));
        return this.tasksPlugin.checkInit().then(function () { return _this.tasksPlugin.projectsReady; }).then(function () {
            _this.setShowTaskPanel(!!_this.getSetting("show-task-panel"));
            _this.setTaskPanelLayout(!!_this.getSetting("horizontal-task-window-layout"));
            _this.colWidths = _this.getDefaultColWidths();
            return _this.getColWidths().then(function (widths) {
                Object.assign(_this.colWidths, widths);
                _this.callViewMethod("setColWidths", JSON.stringify(_this.colWidths));
            });
        });
    };
    TaskGroupsPanelController.prototype.onPersonChange = function (person) {
        this.callViewMethod("updatePersonPresence", person.getHashmail(), person.isPresent());
    };
    TaskGroupsPanelController.prototype.getModel = function () {
        return null;
    };
    TaskGroupsPanelController.prototype.getDataModel = function () {
        this.currDataModel = null;
        if (!this.activeProjectId) {
            return null;
        }
        this.customSelectFilter.setItems(this.getCustomSelectFilterItems());
        var projectId = this.activeProjectId;
        var projectName = this.getActiveSectionName();
        var section = this.getActiveSection();
        this.updateCollapsedTaskGroupsArray(true);
        var relevantProjects = this.getRelevantProjects();
        var relevantTaskGroups = this.getRelevantTaskGroups();
        var relevantTasks = this.getRelevantTasks();
        var projectsModels = this.convertProjects(relevantProjects);
        var taskGroupsModels = this.convertTaskGroups(relevantTaskGroups);
        var tasksModels = this.convertTasks(relevantTasks);
        for (var projectId_1 in projectsModels) {
            taskGroupsModels[projectId_1 + "/__orphans__"] = (this.getOrphansTaskGroupModel(projectId_1));
        }
        if (this.getSetting("show-full-task-descriptions")) {
            this.parent.fontMetrics.add(" ");
            for (var id in relevantTasks) {
                this.parent.fontMetrics.add(relevantTasks[id].getDescription());
            }
        }
        var defaultTaskLabelClasses = {};
        var arr = Task_1.Task.getStatuses();
        for (var i = arr.length - 1; i >= 0; --i) {
            defaultTaskLabelClasses[arr[i]] = Task_1.Task.getLabelClass(arr[i]);
        }
        var model = {
            context: this.context,
            projectId: projectId,
            hostHash: this.session.hostHash,
            projectName: projectName,
            privateSectionId: this.tasksPlugin.getPrivateSectionId(),
            uniqueSafeId: this._getUniqueSafeId(),
            conv2Model: this.isConv2Section() ? pmc_mail_1.utils.Converter.convertConv2(this.getActiveConv2Section(), 0, null, 0, true, 0, false, false, false, null) : null,
            settings: this.getSettings(),
            isActive: this.isActive,
            colWidths: this.colWidths,
            defaultTaskLabelClasses: defaultTaskLabelClasses,
            canCreateNewTasks: this.isConv2Section() ? !this.getActiveConv2Section().hasDeletedUserOnly() : true,
            isPublic: section ? section.getScope() == "public" : false,
            isConv2Section: this.isConv2Section(),
            isAllTasks: this.isAllTasks(),
            isTasksAssignedToMe: this.isTasksAssignedToMe(),
            isTasksCreatedByMe: this.isTasksCreatedByMe(),
            isTrash: this.isTrash(),
            isFixedSection: this.isFixedSection(),
            isRegularSection: this.isRegularSection(),
            isPrivateSection: this.isPrivateSection(),
            combinesMultipleSections: this.combinesMultipleSections(),
            showsEmptyTaskGroups: this.showsEmptyTaskGroups(),
            isInSummaryWindow: this.isInSummaryWindow(),
            otherPluginsAvailability: this.getOtherPluginsAvailability(),
            projects: projectsModels,
            taskGroups: taskGroupsModels,
            tasks: tasksModels,
            emptyTaskGroupModel: this.convertTaskGroup(new TaskGroup_1.TaskGroup({
                projectId: projectId,
            })),
            myHashmail: this.tasksPlugin.getMyId(this.session),
            debug: this.tasksPlugin.debug,
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    };
    TaskGroupsPanelController.prototype._getUniqueSafeId = function () {
        return "tasks" + this.uniqueId;
    };
    TaskGroupsPanelController.prototype.updateCollapsedTaskGroupsArray = function (collapseDetached) {
        if (collapseDetached === void 0) { collapseDetached = false; }
        this.collapsedTaskGroups = JSON.parse(this.getSetting("collapsed-taskgroups"));
        if (collapseDetached) {
            var nCollapsedBefore = this.collapsedTaskGroups.length;
            for (var tgId in this.tasksPlugin.taskGroups[this.session.hostHash]) {
                var tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
                var fullId = tg.getProjectId() + "/" + tg.getId();
                if (tg.getDetached() && this.collapsedTaskGroups.indexOf(fullId) < 0) {
                    this.collapsedTaskGroups.push(fullId);
                }
            }
            var nCollapsedAfter = this.collapsedTaskGroups.length;
            if (nCollapsedAfter != nCollapsedBefore) {
                this.setSetting("collapsed-taskgroups", JSON.stringify(this.collapsedTaskGroups));
            }
        }
    };
    TaskGroupsPanelController.prototype.onViewLoad = function () {
        this.afterViewLoaded.resolve();
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    TaskGroupsPanelController.prototype.beforeClose = function () {
        if (this.dataChangedListener) {
            this.tasksPlugin.unWatch(this.session, "*", "*", "*", this.dataChangedListener);
        }
    };
    TaskGroupsPanelController.prototype.onFilterTasks = function () {
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    TaskGroupsPanelController.prototype.updateSearchFilter = function (data) {
        var searchStr = data.visible ? data.value : "";
        this.callViewMethod("applySearchFilter", searchStr);
    };
    TaskGroupsPanelController.prototype.isInSummaryWindow = function () {
        return this.context == Types_1.ViewContext.SummaryWindow;
    };
    TaskGroupsPanelController.prototype.getOtherPluginsAvailability = function () {
        var active = this.getActiveSection();
        var chatPresent = this.tasksPlugin.isChatPluginPresent();
        var notesPresent = this.tasksPlugin.isNotes2PluginPresent();
        var hasChat = active && chatPresent && active.isChatModuleEnabled();
        var hasNotes = active && notesPresent && active.isFileModuleEnabled();
        var hasCalendar = !!active;
        if (this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID) {
            hasChat = false;
            hasNotes = notesPresent;
        }
        else if (this.activeProjectId == this.tasksPlugin.getPrivateSectionId()) {
            hasChat = chatPresent;
            hasNotes = notesPresent;
        }
        else if (this.isConv2Section()) {
            hasChat = chatPresent;
            hasNotes = notesPresent;
        }
        return {
            chat: hasChat,
            notes: hasNotes,
            calendar: hasCalendar,
        };
    };
    TaskGroupsPanelController.prototype.onWatchedTasksHistoryRebuild = function (hostHash, pId) {
        if (pId != this.activeProjectId && this.activeProjectId != Types_1.CustomTasksElements.ALL_TASKS_ID && this.activeProjectId != Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.activeProjectId != Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID && this.activeProjectId != Types_1.CustomTasksElements.TRASH_ID && !this.tasksPlugin.isConv2Project(this.activeProjectId)) {
            return;
        }
        this.updateUnread();
    };
    TaskGroupsPanelController.prototype.onWatchedTasksHistorySet = function (hostHash, pId, tId, it) {
        if (pId != this.activeProjectId && this.activeProjectId != Types_1.CustomTasksElements.ALL_TASKS_ID && this.activeProjectId != Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.activeProjectId != Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID && this.activeProjectId != Types_1.CustomTasksElements.TRASH_ID && !this.tasksPlugin.isConv2Project(this.activeProjectId)) {
            return;
        }
        this.updateUnread();
    };
    TaskGroupsPanelController.prototype.updateUnread = function () {
        var _this = this;
        var unreadTaskIds = {};
        var unreadTaskGroupIds = {};
        for (var tId in this.currDataModel.tasks) {
            var t = this.currDataModel.tasks[tId];
            var tt = this.tasksPlugin.tasks[this.session.hostHash][tId];
            if (!tt) {
                continue;
            }
            if (t.unread != this.tasksPlugin.wasTaskUnread(this.session, tt, tt.getProjectId())) {
                t.unread = !t.unread;
                unreadTaskIds[tId] = t.unread;
            }
            var tgIds = tt.getTaskGroupIds();
            if (tgIds.length == 0) {
                unreadTaskGroupIds[tt.getProjectId() + "/__orphans__"] = this.isTaskGroupUnread(tt.getProjectId(), null);
            }
            else {
                for (var _i = 0, tgIds_1 = tgIds; _i < tgIds_1.length; _i++) {
                    var tgId = tgIds_1[_i];
                    var key = tgId == "__orphans__" ? tt.getProjectId() + "/__orphans__" : tgId;
                    unreadTaskGroupIds[key] = this.isTaskGroupUnread(tt.getProjectId(), tgId);
                }
            }
        }
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("updateUnread", JSON.stringify(unreadTaskIds), JSON.stringify(unreadTaskGroupIds));
        });
    };
    TaskGroupsPanelController.prototype.getCustomSelectFilterItems = function () {
        var arr = [];
        var i18nFilters;
        var filters;
        if (this.isKanban()) {
            i18nFilters = [
                "AllTasks",
                "OnlyUnread",
                "OnlyNotDone",
            ];
            filters = [
                "all-tasks",
                "only-unread",
                "only-not-done",
            ];
        }
        else {
            i18nFilters = [
                "AllTasks",
                "OnlyUnread",
                "OnlyIdea",
                "OnlyTodo",
                "OnlyInProgress",
                "OnlyDone",
                "OnlyNotDone",
            ];
            filters = [
                "all-tasks",
                "only-unread",
                "only-idea",
                "only-todo",
                "only-in-progress",
                "only-done",
                "only-not-done",
            ];
        }
        var curr = this.getSetting(this.isKanban() ? "kanban-filter" : "filter");
        var i = 0;
        for (var _i = 0, filters_1 = filters; _i < filters_1.length; _i++) {
            var filter = filters_1[_i];
            arr.push({
                type: "item",
                value: filter,
                text: this.i18n("plugin.tasks.component.taskGroupsPanel.filter.show" + i18nFilters[i]),
                textNoEscape: true,
                icon: null,
                selected: curr == filter,
                extraClass: "filter-show-" + filter,
            });
            ++i;
        }
        return arr;
    };
    TaskGroupsPanelController.prototype.setSection = function (section) {
        var _this = this;
        if (!section.isKvdbModuleEnabled() && !this.isValidTasksConv2Section(section)) {
            return pmc_mail_1.Q(false);
        }
        return pmc_mail_1.Q().then(function () {
            _this.setSectionData(section);
            return true;
        });
    };
    TaskGroupsPanelController.prototype.setSectionData = function (section) {
        var _this = this;
        if (section instanceof pmc_mail_1.mail.section.SectionService && this.isValidTasksConv2Section(section)) {
            var id_1 = section.getId();
            var c2s = this.session.conv2Service.collection.find(function (x) { return x.section.getId() == id_1; });
            if (c2s) {
                section = c2s;
            }
        }
        this.wasDataSet = true;
        this.requestPreview(null);
        if (!this.dataChangedListener) {
            this.dataChangedListener = this.onDataChanged.bind(this);
            this.tasksPlugin.watch(this.session, "*", "*", "*", this.dataChangedListener);
        }
        this.activeProjectId = TasksWindowController_1.TasksWindowController.getProjectId(section);
        return pmc_mail_1.Q().then(function () {
            if (_this.isConv2Section()) {
                return _this.tasksPlugin.loadSettings(_this.session, _this.activeProjectId);
            }
        }).then(function () {
            return _this.loadFromLocalStorage();
        }).then(function () {
            return _this.afterViewLoaded.promise;
        }).then(function () {
            _this.callViewMethod("setData", _this.getDataModel());
            return true;
        });
    };
    TaskGroupsPanelController.prototype.isValidTasksConv2Section = function (section) {
        if (section.isUserGroup() && section.sectionData && section.sectionData.group && section.sectionData.group.type == "usernames" && section.sectionData.group.users.length == 2) {
            return true;
        }
        return false;
    };
    TaskGroupsPanelController.prototype.getActiveSectionName = function () {
        if (this.isConv2Section()) {
            return this.tasksPlugin.getConv2SectionName(this.session, this.getActiveConv2Section());
        }
        else if (this.isPrivateSection()) {
            return this.i18n("plugin.tasks.component.taskGroupsPanel.privateTasks");
        }
        else if (this.isAllTasks()) {
            return this.i18n("plugin.tasks.component.taskGroupsPanel.allTasks");
        }
        else if (this.isTasksAssignedToMe()) {
            return this.i18n("plugin.tasks.component.taskGroupsPanel.tasksAssignedToMe");
        }
        else if (this.isTasksCreatedByMe()) {
            return this.i18n("plugin.tasks.component.taskGroupsPanel.tasksCreatedByMe");
        }
        else if (this.isTrash()) {
            return this.i18n("plugin.tasks.component.taskGroupsPanel.trash");
        }
        else {
            return this.getActiveProject().getName();
        }
    };
    TaskGroupsPanelController.prototype.getConv2Section = function (id) {
        if (!this.session) {
            return;
        }
        if (!this.session.conv2Service) {
            return;
        }
        if (!this.session.conv2Service.collection) {
            return;
        }
        var ret = this.session.conv2Service.collection.find(function (c2s) {
            return c2s.id == id;
        });
        return ret;
    };
    TaskGroupsPanelController.prototype.getConv2Users = function (c2s, excludeMe) {
        if (excludeMe === void 0) { excludeMe = false; }
        if (!c2s) {
            return [];
        }
        var hashmail = this.identity.hashmail;
        var hash = hashmail.substr(hashmail.indexOf("#"));
        var users = c2s.users.map(function (u) { return u + hash; });
        if (excludeMe) {
            var myId_1 = this.getMyself().id;
            users = users.filter(function (id) { return id != myId_1; });
        }
        return users;
    };
    TaskGroupsPanelController.prototype.getMyself = function () {
        var person = this.session.conv2Service.personService.getPerson(this.identity.hashmail);
        var contact = person ? person.getContact() : null;
        return {
            id: this.identity.hashmail,
            name: this.identity.user,
            avatar: this.app.assetsManager.getAssetByName("DEFAULT_USER_AVATAR"),
            isBasic: contact ? contact.basicUser : false,
        };
    };
    TaskGroupsPanelController.prototype.getActiveProject = function () {
        var res = this.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
        return res;
    };
    TaskGroupsPanelController.prototype.getActiveSection = function () {
        return this.session.sectionManager.getSection(this.activeProjectId);
    };
    TaskGroupsPanelController.prototype.getActiveConv2Section = function () {
        var ret = this.getConv2Section(this.activeProjectId);
        return ret;
    };
    TaskGroupsPanelController.prototype.getActiveConv2Users = function () {
        return this.tasksPlugin.getConv2Users(this.session, this.activeProjectId, true);
    };
    TaskGroupsPanelController.prototype.isAllTasks = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID;
    };
    TaskGroupsPanelController.prototype.isTasksAssignedToMe = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
    };
    TaskGroupsPanelController.prototype.isTasksCreatedByMe = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID;
    };
    TaskGroupsPanelController.prototype.isTrash = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID;
    };
    TaskGroupsPanelController.prototype.isFixedSection = function () {
        return this.isAllTasks() || this.isTasksAssignedToMe() || this.isTasksCreatedByMe() || this.isTrash();
    };
    TaskGroupsPanelController.prototype.isFixedSectionId = function (id) {
        var fixedSectionIds = [Types_1.CustomTasksElements.ALL_TASKS_ID, Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID, Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID, Types_1.CustomTasksElements.TRASH_ID];
        return fixedSectionIds.indexOf(id) >= 0;
    };
    TaskGroupsPanelController.prototype.combinesMultipleSections = function () {
        return this.isFixedSection() || this.isConv2Section();
    };
    TaskGroupsPanelController.prototype.showsEmptyTaskGroups = function () {
        return !this.combinesMultipleSections();
    };
    TaskGroupsPanelController.prototype.isRegularSection = function () {
        return !this.isFixedSection() && !this.isConv2Section();
    };
    TaskGroupsPanelController.prototype.isConv2Section = function () {
        return this.tasksPlugin.isConv2Project(this.activeProjectId);
    };
    TaskGroupsPanelController.prototype.isPrivateSection = function () {
        return this.activeProjectId == this.tasksPlugin.getPrivateSectionId();
    };
    TaskGroupsPanelController.prototype.getSettings = function () {
        var settings = {};
        for (var name_1 in this.tasksPlugin.viewSettings.settingsInfo) {
            settings[name_1] = this.getSetting(name_1);
        }
        return settings;
    };
    TaskGroupsPanelController.prototype.getSetting = function (name) {
        var val = this.tasksPlugin.getSetting(this.session, name, this.activeProjectId, this.context);
        return typeof (val) == "string" ? val : val == 1;
    };
    TaskGroupsPanelController.prototype.setSetting = function (name, value) {
        this.tasksPlugin.saveSetting(this.session, name, typeof (value) == "string" ? value : (value ? 1 : 0), this.activeProjectId, this.context);
    };
    TaskGroupsPanelController.prototype.onViewSettingChanged = function (name, value, dispatchEvent) {
        var _this = this;
        if (this.activeProjectId == null || !this.tasksPlugin.viewSettings.hasProject(this.session, this.activeProjectId)) {
            return;
        }
        if (this.tasksPlugin.viewSettings.hasSetting(this.session, name, this.activeProjectId, this.context)) {
            if (typeof (value) == "boolean") {
                value = value ? 1 : 0;
            }
            this.setSetting(name, value);
            if (name == "kanban-mode") {
                this.customSelectFilter.setItems(this.getCustomSelectFilterItems());
            }
        }
        if (dispatchEvent) {
            this.app.dispatchEvent({
                type: "tasks-setting-changed",
                setting: name,
                value: value,
                sourceProjectId: this.activeProjectId,
                sourceContext: this.context,
                sourceUniqueId: this.uniqueId,
            });
            if (name == "show-task-panel") {
                this.setShowTaskPanel(!!value);
            }
            else if (name == "horizontal-task-window-layout") {
                this.setTaskPanelLayout(!!value);
            }
        }
        if ((name == "show-full-task-descriptions" && value) || name == "show-task-numbers") {
            for (var id in this.currDataModel.tasks) {
                this.parent.fontMetrics.add(this.currDataModel.tasks[id].title + " " + this.currDataModel.tasks[id].description);
            }
            this.parent.fontMetrics.measure().then(function () {
                _this.callViewMethod("updateTaskHeights");
            });
        }
        if (name == "collapsed-taskgroups") {
            this.updateCollapsedTaskGroupsArray(false);
        }
    };
    TaskGroupsPanelController.prototype.watchSettingsChanges = function () {
        var _this = this;
        this.bindEvent(this.app, "tasks-setting-changed", function (event) {
            if (event.sourceUniqueId != _this.uniqueId) {
                if (event.sourceProjectId != _this.activeProjectId && _this.tasksPlugin.viewSettings.isSettingProjectIsolated(event.setting)) {
                    return;
                }
                if (event.sourceContext != _this.context && _this.tasksPlugin.viewSettings.isSettingContextIsolated(event.setting)) {
                    return;
                }
                _this.callViewMethod("settingChanged", event.setting, event.value, false);
            }
        });
    };
    TaskGroupsPanelController.prototype.beforeActivate = function () {
        this.requestPreview(this.previewTaskId);
    };
    TaskGroupsPanelController.prototype.activate = function () {
        this.isActive = true;
        this.callViewMethod("activate");
        this.updatePreview();
    };
    TaskGroupsPanelController.prototype.deactivate = function () {
        this.isActive = false;
        this.callViewMethod("deactivate");
    };
    TaskGroupsPanelController.prototype.requestPreview = function (taskId) {
        this.previewTaskId = taskId;
        this.dispatchEvent({
            type: "task-preview-request",
            taskId: taskId,
            hostHash: this.session.hostHash
        });
    };
    TaskGroupsPanelController.prototype.getTaskTitleAndDescriptionText = function (task) {
        var str = task.getDescription().split("</privmx-ced-meta-data>").pop();
        var idx = str.indexOf("<br>");
        var title = "";
        var description = "";
        if (idx < 0) {
            title = this.fixHtmlString(str);
        }
        else {
            title = this.fixHtmlString(str.substr(0, idx).replace(/<br>/g, " "));
            description = this.fixHtmlString(str.substr(idx + 4).replace(/<br>/g, " "));
        }
        return {
            title: title,
            description: description,
        };
    };
    TaskGroupsPanelController.prototype.fixHtmlString = function (str) {
        return str.replace(/<[^>]*>?/gm, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
    };
    TaskGroupsPanelController.prototype.getRelevantProjects = function () {
        var projects = {};
        var all = this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        if (all) {
            for (var pId in this.tasksPlugin.projects[this.session.hostHash]) {
                if (this.tasksPlugin.projectSectionExists(this.session, pId)) {
                    projects[pId] = this.tasksPlugin.projects[this.session.hostHash][pId];
                }
            }
        }
        else {
            if (!this.tasksPlugin.projectSectionExists(this.session, this.activeProjectId)) {
                return {};
            }
            projects[this.activeProjectId] = this.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
        }
        return projects;
    };
    TaskGroupsPanelController.prototype.getRelevantTaskGroups = function () {
        var taskGroups = {};
        var all = this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        for (var tgId in this.tasksPlugin.taskGroups[this.session.hostHash]) {
            if (all || this.tasksPlugin.taskGroups[this.session.hostHash][tgId].getProjectId() == this.activeProjectId) {
                taskGroups[tgId] = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
            }
        }
        return taskGroups;
    };
    TaskGroupsPanelController.prototype.getRelevantTasks = function () {
        var tasksMap = {};
        for (var tId in this.tasksPlugin.tasks[this.session.hostHash]) {
            if (this.isTaskRelevant(tId)) {
                tasksMap[tId] = this.tasksPlugin.tasks[this.session.hostHash][tId];
            }
        }
        return tasksMap;
    };
    TaskGroupsPanelController.prototype.isTaskRelevant = function (tId) {
        var myId = this.tasksPlugin.getMyId(this.session);
        var all = this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        var isTrash = this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID;
        var isConv2Section = !!this.getActiveConv2Section();
        if (all || this.tasksPlugin.tasks[this.session.hostHash][tId].getProjectId() == this.activeProjectId) {
            var task = this.tasksPlugin.tasks[this.session.hostHash][tId];
            if (isTrash != task.getIsTrashed()) {
                return false;
            }
            if (task
                && (!isConv2Section || this.isAssignedToCurrConv2Section(task))
                && (this.activeProjectId != Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || task.getCreatedBy() == myId)
                && (this.activeProjectId != Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || task.isAssignedTo(myId))) {
                return true;
            }
        }
        return false;
    };
    TaskGroupsPanelController.prototype.getOrphansTaskGroupModel = function (projectId) {
        var project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        return {
            id: "__orphans__",
            name: this.i18n("plugin.tasks.component.taskGroupsPanel.orphansModifiedGroup"),
            projectId: projectId,
            taskLabelClasses: project.taskLabelClasses,
            isCollapsed: this.collapsedTaskGroups.indexOf(projectId + "/__orphans__") >= 0,
            isDetached: false,
            isOrphans: true,
            nTasksByStatus: this.calcTasksByStatus(projectId, null),
            isClosed: false,
            icon: null,
            withUnread: this.isTaskGroupUnread(projectId, null),
        };
    };
    TaskGroupsPanelController.prototype.setOrphansTaskGroupModels = function (onlyProjectId) {
        if (onlyProjectId === void 0) { onlyProjectId = null; }
        var models = {};
        for (var projectId in this.getRelevantProjects()) {
            if (onlyProjectId && (projectId != onlyProjectId)) {
                continue;
            }
            models[projectId] = this.getOrphansTaskGroupModel(projectId);
        }
        this.callViewMethod("setOrphansTaskGroupModels", JSON.stringify(models));
    };
    TaskGroupsPanelController.prototype.isAssignedToCurrConv2Section = function (task) {
        var arr = task.getAssignedTo();
        for (var _i = 0, _a = this.getActiveConv2Users(); _i < _a.length; _i++) {
            var u = _a[_i];
            if (arr.indexOf(u) < 0) {
                return false;
            }
        }
        return true;
    };
    TaskGroupsPanelController.prototype.hasTasksAssignedToMe = function (taskGroup) {
        var myId = this.tasksPlugin.getMyId(this.session);
        for (var _i = 0, _a = taskGroup.getTaskIds(); _i < _a.length; _i++) {
            var id = _a[_i];
            if (id in this.tasksPlugin.tasks[this.session.hostHash] && this.tasksPlugin.tasks[this.session.hostHash][id].isAssignedTo(myId)) {
                return true;
            }
        }
        return false;
    };
    TaskGroupsPanelController.prototype.hasTasksCreatedByMe = function (taskGroup) {
        var myId = this.tasksPlugin.getMyId(this.session);
        for (var _i = 0, _a = taskGroup.getTaskIds(); _i < _a.length; _i++) {
            var id = _a[_i];
            if (id in this.tasksPlugin.tasks[this.session.hostHash] && this.tasksPlugin.tasks[this.session.hostHash][id].getCreatedBy() == myId) {
                return true;
            }
        }
        return false;
    };
    TaskGroupsPanelController.prototype.hasTasksAssignedToConv2Users = function (taskGroup) {
        for (var _i = 0, _a = taskGroup.getTaskIds(); _i < _a.length; _i++) {
            var id = _a[_i];
            if (id in this.tasksPlugin.tasks[this.session.hostHash] && this.isAssignedToCurrConv2Section(this.tasksPlugin.tasks[this.session.hostHash][id])) {
                return true;
            }
        }
        return false;
    };
    TaskGroupsPanelController.prototype.onDataChanged = function (type, id, action) {
        if (type == "task") {
            var task = null;
            if (action == "added" || action == "modified") {
                task = this.tasksPlugin.tasks[this.session.hostHash][id];
            }
            else if (action == "deleted" || action == "section-changed") {
                task = null;
            }
            if (task) {
                this.sendTaskToView(task);
            }
            else {
                this.delTaskFromView(id);
            }
        }
        else if (type == "taskGroup") {
            var taskGroup = null;
            if (action == "added" || action == "modified" || action == "section-changed") {
                taskGroup = this.tasksPlugin.taskGroups[this.session.hostHash][id];
            }
            else if (action == "deleted") {
                taskGroup = null;
            }
            if (taskGroup) {
                this.sendTaskGroupToView(taskGroup);
            }
            else {
                this.delTaskGroupFromView(id);
            }
        }
        else if (type == "project") {
            var project = null;
            if (action == "added" || action == "modified" || action == "section-changed") {
                project = this.tasksPlugin.projects[this.session.hostHash][id];
            }
            else if (action == "deleted") {
                project = null;
                if (this.activeProjectId == id) {
                    this.activeProjectId = null;
                    if (this.dataChangedListener) {
                        this.tasksPlugin.unWatch(this.session, "*", "*", "*", this.dataChangedListener);
                    }
                }
                else if (this.combinesMultipleSections()) {
                    this.callViewMethod("setData", this.getDataModel());
                    return;
                }
            }
            if (project) {
                this.sendProjectToView(project);
            }
            else {
                this.delProjectFromView(id);
            }
        }
    };
    TaskGroupsPanelController.prototype.sendTaskToView = function (task) {
        var _this = this;
        if (this.combinesMultipleSections() || task.getProjectId() == this.activeProjectId) {
            if (!this.isTaskRelevant(task.getId())) {
                this.delTaskFromView(task.getId());
                return;
            }
            var m_1 = this.convertTask(task);
            this.currDataModel.tasks[task.getId()] = m_1;
            if (this.getSetting("show-full-task-descriptions") && this.parent.fontMetrics.add(task.getDescription())) {
                this.parent.fontMetrics.measure().then(function () {
                    _this._sendTaskToView(m_1);
                });
            }
            else {
                this._sendTaskToView(m_1);
            }
        }
        this.setOrphansTaskGroupModels();
    };
    TaskGroupsPanelController.prototype._sendTaskToView = function (m) {
        var h = this.getSetting("show-full-task-descriptions") ? this.parent.fontMetrics.countLines(m.title + " " + m.description, this.taskLineWidth, m.title.length) : null;
        this.callViewMethod("setTask", JSON.stringify(m), h);
    };
    TaskGroupsPanelController.prototype.sendTaskGroupToView = function (taskGroup) {
        if (this.combinesMultipleSections() || taskGroup.getProjectId() == this.activeProjectId) {
            var m = this.convertTaskGroup(taskGroup);
            this.currDataModel.taskGroups[taskGroup.getId()] = m;
            this.callViewMethod("setTaskGroup", JSON.stringify(m));
        }
    };
    TaskGroupsPanelController.prototype.sendProjectToView = function (project) {
        if (this.combinesMultipleSections() || project.getId() == this.activeProjectId) {
            var m = this.convertProject(project);
            this.currDataModel.projects[project.getId()] = m;
            this.callViewMethod("setProject", JSON.stringify(m));
        }
    };
    TaskGroupsPanelController.prototype.delTaskFromView = function (taskId) {
        delete this.currDataModel.tasks[taskId];
        this.callViewMethod("delTask", taskId);
        this.setOrphansTaskGroupModels();
    };
    TaskGroupsPanelController.prototype.delTaskGroupFromView = function (taskGroupId) {
        delete this.currDataModel.taskGroups[taskGroupId];
        this.callViewMethod("delTaskGroup", taskGroupId);
    };
    TaskGroupsPanelController.prototype.delProjectFromView = function (projectId) {
        delete this.currDataModel.projects[projectId];
        this.callViewMethod("delProject", projectId);
    };
    TaskGroupsPanelController.prototype.convertTask = function (task) {
        var td = this.getTaskTitleAndDescriptionText(task);
        var overdueDate = new Date(task.getEndTimestamp());
        return {
            id: task.getId(),
            title: td.title,
            description: td.description,
            status: task.getStatus(),
            projectId: task.getProjectId(),
            assignedTo: task.getAssignedTo(),
            attachments: task.getAttachments(),
            createdBy: task.getCreatedBy(),
            createdAt: task.getCreatedDateTime(),
            modifiedBy: task.getModifiedBy(),
            modifiedAt: task.getModifiedDateTime(),
            taskGroupIds: task.getTaskGroupIds(),
            unread: this.tasksPlugin.wasTaskUnread(this.session, task, task.getProjectId()),
            trashed: task.getIsTrashed(),
            cachedSearchString: task.getCachedSearchString(),
            nComments: task.getCommentTags().length,
            startTimestamp: task.getStartTimestamp(),
            endTimestamp: task.getEndTimestamp(),
            wholeDays: task.getWholeDays(),
            overdueInfo: {
                timestamp: overdueDate.getTime(),
                day: overdueDate.getDate(),
                month: overdueDate.getMonth(),
                year: overdueDate.getFullYear(),
            },
            labelClass: task.getLabelClass(),
            pinnedInTaskGroupIds: task.getPinnedInTaskGroupIds(),
        };
    };
    TaskGroupsPanelController.prototype.convertTaskGroup = function (taskGroup) {
        var project = this.tasksPlugin.projects[this.session.hostHash][taskGroup.getProjectId()];
        if (!project) {
            var keys = Object.keys(this.tasksPlugin.projects[this.session.hostHash]);
            for (var i = 0; i < keys.length && !project; ++i) {
                if (this.tasksPlugin.projectSectionExists(this.session, keys[i])) {
                    project = this.tasksPlugin.projects[this.session.hostHash][keys[i]];
                }
            }
        }
        var taskLabelClasses = {};
        if (project) {
            var arr = Task_1.Task.getStatuses();
            for (var i = arr.length - 1; i >= 0; --i) {
                taskLabelClasses[arr[i]] = Task_1.Task.getLabelClass(arr[i]);
            }
        }
        return {
            id: taskGroup.getId(),
            name: taskGroup.getName(),
            projectId: taskGroup.getProjectId(),
            taskLabelClasses: taskLabelClasses,
            isCollapsed: this.collapsedTaskGroups.indexOf(taskGroup.getProjectId() + "/" + taskGroup.getId()) >= 0,
            isDetached: taskGroup.getDetached(),
            isOrphans: false,
            nTasksByStatus: this.calcTasksByStatus(taskGroup.getProjectId(), taskGroup.getId()),
            isClosed: taskGroup.getDetached(),
            icon: taskGroup.getIcon() ? JSON.parse(taskGroup.getIcon()) : null,
            withUnread: this.isTaskGroupUnread(taskGroup.getProjectId(), taskGroup.getId()),
        };
    };
    TaskGroupsPanelController.prototype.convertProject = function (project) {
        var taskLabelClasses = {};
        if (project) {
            var arr = Task_1.Task.getStatuses();
            for (var i = arr.length - 1; i >= 0; --i) {
                taskLabelClasses[arr[i]] = Task_1.Task.getLabelClass(arr[i]);
            }
        }
        return {
            id: project.getId(),
            name: project.getName(),
            statuses: Task_1.Task.getStatuses(),
            pinnedTaskGroupIds: project.getPinnedTaskGroupIds(),
            taskGroupsOrder: project.getTaskGroupsOrder(),
            taskLabelClasses: taskLabelClasses,
        };
    };
    TaskGroupsPanelController.prototype.convertTasks = function (tasksMap) {
        var res = {};
        for (var id in tasksMap) {
            res[id] = this.convertTask(tasksMap[id]);
        }
        return res;
    };
    TaskGroupsPanelController.prototype.convertTaskGroups = function (taskGroupsMap) {
        var res = {};
        for (var id in taskGroupsMap) {
            res[id] = this.convertTaskGroup(taskGroupsMap[id]);
        }
        return res;
    };
    TaskGroupsPanelController.prototype.convertProjects = function (projectsMap) {
        var res = {};
        for (var id in projectsMap) {
            res[id] = this.convertProject(projectsMap[id]);
        }
        return res;
    };
    TaskGroupsPanelController.prototype.calcTasksByStatus = function (projectId, taskGroupId) {
        var project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        var tg = this.tasksPlugin.taskGroups[this.session.hostHash][taskGroupId];
        var tasks = tg ? tg.getTaskIds() : (project ? project.getOrphanedTaskIds() : []);
        var counts = {};
        for (var _i = 0, _a = Task_1.Task.getStatuses(); _i < _a.length; _i++) {
            var status_1 = _a[_i];
            counts[status_1] = 0;
        }
        for (var _b = 0, tasks_1 = tasks; _b < tasks_1.length; _b++) {
            var taskId = tasks_1[_b];
            var task = this.tasksPlugin.tasks[this.session.hostHash][taskId];
            if (task && this.isTaskRelevant(taskId)) {
                var st = task.getStatus();
                ++counts[st];
            }
        }
        return counts;
    };
    TaskGroupsPanelController.prototype.onViewCountTaskLines = function (channelId, taskIdsStr, width) {
        var _this = this;
        this.taskLineWidth = width;
        var taskIds = JSON.parse(taskIdsStr);
        this.countTaskLines(taskIds, width).then(function (lines) {
            _this.sendToViewChannel(channelId, JSON.stringify(lines));
        });
    };
    TaskGroupsPanelController.prototype.countTaskLines = function (taskIds, width) {
        var _this = this;
        return this.parent.fontMetrics.measure().then(function () {
            var lines = {};
            if (taskIds) {
                for (var _i = 0, taskIds_1 = taskIds; _i < taskIds_1.length; _i++) {
                    var id = taskIds_1[_i];
                    var t = _this.currDataModel.tasks[id];
                    lines[id] = _this.parent.fontMetrics.countLines(t.title + " " + t.description, width, t.title.length);
                }
            }
            else {
                for (var id in _this.currDataModel.tasks) {
                    var t = _this.currDataModel.tasks[id];
                    lines[id] = _this.parent.fontMetrics.countLines(t.title + " " + t.description, width, t.title.length);
                }
            }
            return lines;
        });
    };
    TaskGroupsPanelController.prototype.isTaskGroupUnread = function (projectId, taskGroupId) {
        var _this = this;
        var project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        var tg = this.tasksPlugin.taskGroups[this.session.hostHash][taskGroupId];
        var taskIds = tg ? tg.getTaskIds() : (project ? project.getOrphanedTaskIds() : []);
        var firstUnreadTaskId = taskIds.find(function (x) {
            var task = _this.tasksPlugin.tasks[_this.session.hostHash][x];
            if (_this.isTrash() != task.getIsTrashed()) {
                return false;
            }
            return _this.tasksPlugin.wasTaskUnread(_this.session, task, task.getProjectId());
        });
        return !!firstUnreadTaskId;
    };
    TaskGroupsPanelController.prototype.setShowTaskPanel = function (value) {
        this.dispatchEvent({
            type: "taskpanel-change-visibility-request",
            show: value,
        });
    };
    TaskGroupsPanelController.prototype.setTaskPanelLayout = function (horizontal) {
        this.dispatchEvent({
            type: "horizontal-task-window-layout-change-request",
            horizontalLayout: horizontal,
        });
    };
    TaskGroupsPanelController.prototype.updateTaskPanel = function () {
        this.dispatchEvent({
            type: "taskpanel-update-request",
        });
    };
    TaskGroupsPanelController.prototype.onViewMarkAllAsRead = function () {
        this.tasksPlugin.markAllAsRead(this.session, this.activeProjectId);
        this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.markedAllAsRead"));
        this.app.dispatchEvent({
            type: "marked-tasks-as-read",
            projectId: this.activeProjectId,
            hostHash: this.session.hostHash,
        });
    };
    TaskGroupsPanelController.prototype.onViewNewTaskGroup = function (projectId) {
        var _this = this;
        var project = this.tasksPlugin.getProject(this.session, projectId);
        if (project == null) {
            this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.projectDoesNotExist"));
            return;
        }
        if (!this.tasksPlugin.bringWindowToFront(TaskGroupFormWindowController_1.TaskGroupFormWindowController.getWindowId(this.session, null))) {
            this.app.ioc.create(TaskGroupFormWindowController_1.TaskGroupFormWindowController, [this, this.session, projectId, project.getName()]).then(function (win) {
                _this.parent.openChildWindow(win).getPromise().then(function (result) {
                    var tg = new TaskGroup_1.TaskGroup();
                    DataMigration_1.DataMigration.setVersion(tg);
                    tg.setName(result.name);
                    tg.setDueDate(result.dueDate);
                    tg.setProjectId(projectId);
                    tg.setIcon(result.icon);
                    _this.tasksPlugin.nextTaskGroupId(_this.session).then(function (id) {
                        tg.setId(id);
                        _this.tasksPlugin.saveTaskGroup(_this.session, tg).then(function () {
                            _this.tasksPlugin.saveProject(_this.session, project);
                        });
                        _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupCreated"));
                    });
                }, function () {
                });
            });
        }
    };
    TaskGroupsPanelController.prototype.onViewEditTaskGroup = function (projectId, taskGroupId) {
        var _this = this;
        var taskGroup = this.tasksPlugin.getTaskGroup(this.session, taskGroupId);
        if (taskGroup == null) {
            this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.taskGroupDoesNotExist"));
            return;
        }
        var project = this.tasksPlugin.getProject(this.session, projectId);
        if (project == null) {
            this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.projectDoesNotExist"));
            return;
        }
        var model = {
            id: taskGroupId,
            name: taskGroup.getName(),
            dueDate: taskGroup.getDueDate(),
            projectName: project.getName(),
            icon: taskGroup.getIcon(),
        };
        if (!this.tasksPlugin.bringWindowToFront(TaskGroupFormWindowController_1.TaskGroupFormWindowController.getWindowId(this.session, taskGroupId))) {
            this.app.ioc.create(TaskGroupFormWindowController_1.TaskGroupFormWindowController, [this, this.session, projectId, model]).then(function (win) {
                _this.parent.openChildWindow(win).getPromise().then(function (result) {
                    if (result.deleted) {
                        _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupDeleted"));
                        return;
                    }
                    var tg = taskGroup;
                    tg.setName(result.name);
                    tg.setDueDate(result.dueDate);
                    tg.setIcon(result.icon);
                    _this.tasksPlugin.saveTaskGroup(_this.session, tg)
                        .then(function () {
                        _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupModified"));
                    }).fail(function (e) {
                        if (e == "conflict") {
                            _this.parent.alert(_this.i18n("plugin.tasks.component.taskGroupsPanel.taskGroupConflict"));
                        }
                    });
                }, function () {
                });
            });
        }
    };
    TaskGroupsPanelController.prototype.onViewNewTask = function (projectId, taskGroupId) {
        var _this = this;
        if (projectId == undefined) {
            projectId = this.tasksPlugin.getPrivateSectionId();
        }
        else if (this.isFixedSection() && !projectId) {
            projectId = this.tasksPlugin.getPrivateSectionId();
        }
        else if (projectId && this.isFixedSectionId(projectId)) {
            projectId = this.tasksPlugin.getPrivateSectionId();
        }
        if (taskGroupId == undefined) {
            taskGroupId = "__orphans__";
        }
        var project = null;
        if (projectId == "conv2") {
            projectId = this.tasksPlugin.findCommonProject(this.session, this.getActiveConv2Section());
            project = this.tasksPlugin.getProject(this.session, projectId);
        }
        else if (projectId !== false) {
            project = this.tasksPlugin.getProject(this.session, projectId);
            if (project == null) {
                this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.projectDoesNotExist"));
                return;
            }
        }
        var assignToMe = projectId == this.tasksPlugin.getPrivateSectionId() || this.activeProjectId == this.tasksPlugin.getPrivateSectionId()
            || projectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
        var assignTo = assignToMe ? [this.tasksPlugin.getMyId(this.session)] : [];
        if (this.isConv2Section()) {
            assignTo = this.getActiveConv2Users();
        }
        if (!this.tasksPlugin.bringWindowToFront(TaskWindowController_1.TaskWindowController.getWindowId(this.session, null))) {
            this.app.ioc.create(TaskWindowController_1.TaskWindowController, [this, this.session, null, true, project, [taskGroupId], [], assignTo, false, true]).then(function (win) {
                _this.parent.openChildWindow(win).getPromise().then(function (result) {
                    if (result.saved) {
                        _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskCreated"));
                    }
                });
            });
        }
    };
    TaskGroupsPanelController.prototype.onViewDeleteTasks = function (taskIdsStr) {
        var _this = this;
        var taskIds = JSON.parse(taskIdsStr);
        this.stripProjectFromFullTaskIds(taskIds);
        var notifId = null;
        this.tasksPlugin.askDeleteTasks(this.session, taskIds, this.activeProjectId != Types_1.CustomTasksElements.TRASH_ID, this.parent.confirmEx.bind(this.parent)).progress(function (_n) {
            if (_n == 0) {
                return;
            }
            var op = _this.isTrash() ? "deleting" : "trashing";
            notifId = _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications." + op + "Task" + (_n > 1 ? "s" : "")));
        }).then(function (result) {
            if (result.deleted) {
                _this.callViewMethod("deleteSelectedRows", result.fullDelete);
            }
        }).fin(function () {
            _this.callViewMethod("unLockSelection");
            if (notifId) {
                _this.notifications.hideNotification(notifId);
            }
        });
    };
    TaskGroupsPanelController.prototype.onViewRestoreTasks = function (taskIdsStr) {
        var _this = this;
        var taskIds = JSON.parse(taskIdsStr);
        this.stripProjectAndTaskGroupFromFullTaskIds(taskIds);
        var notifId = null;
        var _n = taskIds.length;
        notifId = this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.restoringTask" + (_n > 1 ? "s" : "")));
        this.tasksPlugin.restoreFromTrash(this.session, taskIds)
            .then(function () {
            _this.callViewMethod("deleteSelectedRows", false);
        })
            .fin(function () {
            _this.callViewMethod("unLockSelection");
            if (notifId) {
                _this.notifications.hideNotification(notifId);
            }
        });
    };
    TaskGroupsPanelController.prototype.onViewChangeTasksParent = function (fullTaskIdsStr, taskGroupId, projectId) {
        if (taskGroupId == "null") {
            taskGroupId = null;
        }
        var fullTaskIds = JSON.parse(fullTaskIdsStr);
        this.stripProjectFromFullTaskIds(fullTaskIds);
        if (!this.tasksPlugin.projectsMatch(this.session, fullTaskIds, taskGroupId, projectId)) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.crossProjectMoveDisabled"));
            return;
        }
        this.tasksPlugin.moveTasks(this.session, fullTaskIds, [taskGroupId]);
    };
    TaskGroupsPanelController.prototype.onViewDuplicateTasks = function (fullTaskIdsStr, taskGroupId, projectId) {
        var _this = this;
        if (taskGroupId == "null") {
            taskGroupId = null;
        }
        var fullTaskIds = JSON.parse(fullTaskIdsStr);
        this.stripProjectFromFullTaskIds(fullTaskIds);
        if (!this.tasksPlugin.projectsMatch(this.session, fullTaskIds, taskGroupId, projectId)) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.crossProjectCopydisable"));
            return;
        }
        var notifId = this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.pastingTasks"));
        this.tasksPlugin.duplicateTasks(this.session, fullTaskIds, taskGroupId).fin(function () {
            _this.notifications.hideNotification(notifId);
        });
    };
    TaskGroupsPanelController.prototype.onViewMoveTasks = function (fullTaskIdsStr) {
        var _this = this;
        var fullTaskIds = JSON.parse(fullTaskIdsStr);
        var taskTgs = {};
        var tgIds = [];
        for (var _i = 0, fullTaskIds_1 = fullTaskIds; _i < fullTaskIds_1.length; _i++) {
            var fId = fullTaskIds_1[_i];
            var _a = fId.split("/"), pId = _a[0], tgId = _a[1], tId = _a[2];
            if (!(tId in taskTgs)) {
                taskTgs[tId] = [];
            }
            taskTgs[tId].push(tgId);
            if (tgIds.indexOf(tgId) < 0) {
                tgIds.push(tgId);
            }
        }
        var commonTgIds = [];
        for (var _b = 0, tgIds_2 = tgIds; _b < tgIds_2.length; _b++) {
            var tgId = tgIds_2[_b];
            var inAll = true;
            for (var t in taskTgs) {
                if (taskTgs[t].indexOf(tgId) < 0) {
                    inAll = false;
                    break;
                }
            }
            if (inAll) {
                commonTgIds.push(tgId);
            }
        }
        if (Object.keys(taskTgs).length == 1) {
            var tId = Object.keys(taskTgs)[0];
            commonTgIds = this.tasksPlugin.tasks[this.session.hostHash][tId].getTaskGroupIds().slice();
        }
        this.stripProjectFromFullTaskIds(fullTaskIds);
        this.app.ioc.create(TaskGroupSelectorWindowController_1.TaskGroupSelectorWindowController, [this.parent, this.session, this.activeProjectId, commonTgIds]).then(function (win) {
            win.parent = _this.parent.getClosestNotDockedController();
            _this.parent.openChildWindow(win).getPromise().then(function (result) {
                var taskGroupIds = result.taskGroupIds;
                var notifId = null;
                _this.tasksPlugin.moveTasks(_this.session, fullTaskIds, taskGroupIds, true, function (numTasksToSave) {
                    if (numTasksToSave > 0) {
                        notifId = _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.movingTasks"));
                    }
                }).fin(function () {
                    if (notifId !== null) {
                        _this.notifications.hideNotification(notifId);
                    }
                });
            });
        });
    };
    TaskGroupsPanelController.prototype.onViewMoveTaskGroup = function (tgId, posDelta) {
        var _this = this;
        if (tgId != "__orphans__" && !(tgId in this.tasksPlugin.taskGroups[this.session.hostHash])) {
            return;
        }
        var proj;
        if (tgId == "__orphans__") {
            proj = this.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
        }
        else {
            var tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
            if (!(tg.getProjectId() in this.tasksPlugin.projects[this.session.hostHash])) {
                return;
            }
            proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
        }
        proj.syncTaskGroupsIdsOrder(this.tasksPlugin.taskGroups[this.session.hostHash]);
        var projTgIds = proj.getTaskGroupsOrder().slice();
        var currPos = projTgIds.indexOf(tgId);
        var pinnedGroups = proj.getPinnedTaskGroupIds();
        var pinnedMode = pinnedGroups.indexOf(tgId) >= 0;
        var maxPos = projTgIds.filter(function (id) { return id == "__orphans__" || (_this.tasksPlugin.taskGroups[_this.session.hostHash][id] && !_this.tasksPlugin.taskGroups[_this.session.hostHash][id].getDetached()); }).length - 1;
        var newPos = 0;
        if (pinnedMode) {
            if (Math.abs(posDelta) == 1) {
                var mul = 1;
                var pos = currPos + posDelta;
                while (projTgIds[pos] && pinnedGroups.indexOf(projTgIds[pos]) < 0) {
                    pos += posDelta;
                    ++mul;
                }
                posDelta *= mul;
            }
            newPos = Math.min(Math.max(currPos + posDelta, 0), maxPos);
        }
        else {
            if (Math.abs(posDelta) == 1) {
                var mul = 1;
                var pos = currPos + posDelta;
                while (projTgIds[pos] && pinnedGroups.indexOf(projTgIds[pos]) >= 0) {
                    pos += posDelta;
                    ++mul;
                }
                posDelta *= mul;
            }
            newPos = Math.min(Math.max(currPos + posDelta, 0), maxPos);
        }
        if (newPos == currPos) {
            return;
        }
        projTgIds.splice(newPos, 0, projTgIds.splice(currPos, 1)[0]);
        proj.setTaskGroupsOrder(projTgIds.slice());
        this.tasksPlugin.saveProject(this.session, proj);
    };
    TaskGroupsPanelController.prototype.onViewToggleTaskGroupPinned = function (taskGroupId, pinned) {
        this.tasksPlugin.changeTaskGroupPinned(this.session, this.activeProjectId, taskGroupId, pinned);
        if (pinned) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupPinned"));
        }
        else {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupUnpinned"));
        }
    };
    TaskGroupsPanelController.prototype.onViewToggleTaskPinned = function (taskId, taskGroupId, pinned) {
        this.tasksPlugin.changeTaskPinned(this.session, taskId, taskGroupId, pinned);
        if (pinned) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskPinned"));
        }
        else {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskUnpinned"));
        }
    };
    TaskGroupsPanelController.prototype.onViewOpenTaskWindow = function (taskId, editMode) {
        var _this = this;
        if (editMode === void 0) { editMode = false; }
        if (!this.tasksPlugin.bringWindowToFront(TaskWindowController_1.TaskWindowController.getWindowId(this.session, taskId))) {
            this.app.ioc.create(TaskWindowController_1.TaskWindowController, [this, this.session, taskId, editMode]).then(function (win) {
                _this.parent.openChildWindow(win).getPromise().then(function (result) {
                    if (result.saved) {
                        _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskModified"));
                    }
                    else if (result.deleted) {
                        _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskDeleted"));
                    }
                    _this.callViewMethod("grabFocus");
                });
            });
        }
    };
    TaskGroupsPanelController.prototype.stripProjectFromFullTaskIds = function (ids) {
        for (var i = 0, len = ids.length; i < len; ++i) {
            ids[i] = ids[i].substr(ids[i].indexOf("/") + 1);
        }
    };
    TaskGroupsPanelController.prototype.stripProjectAndTaskGroupFromFullTaskIds = function (ids) {
        for (var i = 0, len = ids.length; i < len; ++i) {
            ids[i] = ids[i].substr(ids[i].lastIndexOf("/") + 1);
        }
    };
    TaskGroupsPanelController.prototype.getOtherPluginTarget = function (id) {
        if (id == this.tasksPlugin.getPrivateSectionId()) {
            return "my";
        }
        if (id == Types_1.CustomTasksElements.ALL_TASKS_ID) {
            return "all";
        }
        if (id == Types_1.CustomTasksElements.TRASH_ID) {
            return "trash";
        }
        return id;
    };
    TaskGroupsPanelController.prototype.onViewFullRefresh = function (hard, showNotification) {
        var _this = this;
        if (hard === void 0) { hard = true; }
        if (showNotification === void 0) { showNotification = false; }
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;
        pmc_mail_1.Q().then(function () {
            var str = _this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.refreshing");
            var notificationId;
            if (showNotification) {
                notificationId = _this.notifications.showNotification(str, {
                    autoHide: false,
                    progress: true,
                });
            }
            var prom = pmc_mail_1.Q();
            if (hard) {
                prom = prom.then(function () { return _this.tasksPlugin.refreshCollections(); });
            }
            prom.then(function () {
            }).fin(function () {
                if (showNotification) {
                    _this.notifications.hideNotification(notificationId);
                }
                _this.callViewMethod("repaint");
            });
        })
            .fin(function () {
            setTimeout(function () {
                _this.isRefreshing = false;
            }, 800);
        });
    };
    TaskGroupsPanelController.prototype.updatePreview = function () {
        var n = this.selectedTasks.length;
        this.requestPreview(n == 1 ? this.selectedTasks[0].split("/")[2] : (n == 0 ? null : false));
    };
    TaskGroupsPanelController.prototype.onViewSelectionChanged = function (fullTaskIdsStr) {
        this.selectedTasks = JSON.parse(fullTaskIdsStr);
        this.updatePreview();
        if (this.selectedTasks.length == 1) {
            var task = this.tasksPlugin.tasks[this.session.hostHash][this.selectedTasks[0].split("/")[2]];
            if (task && this.tasksPlugin.wasTaskUnread(this.session, task, task.getProjectId()) && this.app.userPreferences.getAutoMarkAsRead()) {
                this.tasksPlugin.markTaskAsWatched(this.session, task.getId(), task.getProjectId());
                this.updateBadges(task.getProjectId());
            }
        }
    };
    TaskGroupsPanelController.prototype.updateBadges = function (sectionId) {
        this.dispatchEvent({
            type: "badges-update-request",
        });
    };
    TaskGroupsPanelController.prototype.loadFromLocalStorage = function () {
        var _this = this;
        return this.getColWidths().then(function (widths) {
            _this.colWidths = widths;
        });
    };
    TaskGroupsPanelController.prototype.getColWidths = function () {
        var _this = this;
        var key = "tasks-cols-widths-" + this.context + "-" + this.activeProjectId;
        return this.tasksPlugin.localStorage.get(key).then(function (dataStr) {
            var data = JSON.parse(dataStr);
            var defaults = _this.getDefaultColWidths();
            Object.assign(defaults, data);
            return defaults;
        });
    };
    TaskGroupsPanelController.prototype.onViewSetColWidths = function (dataStr) {
        var data = JSON.parse(dataStr);
        var curr = this.colWidths;
        var newData = {};
        Object.assign(newData, curr);
        Object.assign(newData, data);
        this.colWidths = newData;
        var newDataStr = JSON.stringify(newData);
        var key = "tasks-cols-widths-" + this.context + "-" + this.activeProjectId;
        this.tasksPlugin.localStorage.set(key, newDataStr);
        this.app.dispatchEvent({
            type: "tasks-col-widths-changed",
            key: this.activeProjectId + "-" + this.context,
            sender: this.uniqueId,
        });
    };
    TaskGroupsPanelController.prototype.getDefaultColWidths = function () {
        return {
            "hash-id": Types_1.DefaultColWidths.HASH_ID,
            "status": Types_1.DefaultColWidths.STATUS,
            "assigned-to": Types_1.DefaultColWidths.ASSIGNED_TO,
            "attachments": Types_1.DefaultColWidths.ATTACHMENTS,
            "created": Types_1.DefaultColWidths.CREATED,
            "modified": Types_1.DefaultColWidths.MODIFIED,
        };
    };
    TaskGroupsPanelController.prototype.setPreviewDirty = function (dirty) {
        this.callViewMethod("setPreviewDirty", dirty);
    };
    TaskGroupsPanelController.prototype.onViewConfirmPreviewExit = function () {
        this.callViewMethod("confirmPreviewExit");
    };
    TaskGroupsPanelController.prototype.isKanban = function () {
        return !!this.getSetting("kanban-mode");
    };
    TaskGroupsPanelController.prototype.onViewDropTasks = function (fullTaskIds, status, newProjectId, newTaskGroupId) {
        var _this = this;
        var toSave = { tasks: [], taskGroups: [], projects: [] };
        for (var _i = 0, fullTaskIds_2 = fullTaskIds; _i < fullTaskIds_2.length; _i++) {
            var fullTaskId = fullTaskIds_2[_i];
            var _a = fullTaskId.split("/"), pId = _a[0], tgId = _a[1], tId = _a[2];
            var toSave2 = this.dropTask(tId, status, newProjectId, newTaskGroupId, tgId);
            if (toSave2) {
                Utils_1.Utils.uniqueArrayMerge(toSave.tasks, toSave2.tasks);
                Utils_1.Utils.uniqueArrayMerge(toSave.taskGroups, toSave2.taskGroups);
                Utils_1.Utils.uniqueArrayMerge(toSave.projects, toSave2.projects);
            }
        }
        pmc_mail_1.Q.all(toSave.tasks.map(function (task) {
            return _this.tasksPlugin.sendTaskMessage(_this.session, task, "modify-task")
                .then(function (dt) {
                if (dt) {
                    task.updateModifiedServerDateTime(dt);
                }
            });
        }))
            .then(function () {
            return _this.saveAll(toSave);
        });
    };
    TaskGroupsPanelController.prototype.onViewDropTask = function (taskId, status, newProjectId, newTaskGroupId, currTaskGroupId) {
        var _this = this;
        var toSave = this.dropTask(taskId, status, newProjectId, newTaskGroupId, currTaskGroupId);
        pmc_mail_1.Q.all(toSave.tasks.map(function (task) {
            return _this.tasksPlugin.sendTaskMessage(_this.session, task, "modify-task")
                .then(function (dt) {
                if (dt) {
                    task.updateModifiedServerDateTime(dt);
                }
            });
        }))
            .then(function () {
            return _this.saveAll(toSave);
        });
    };
    TaskGroupsPanelController.prototype.saveAll = function (toSave) {
        var proms = [];
        for (var _i = 0, _a = toSave.tasks; _i < _a.length; _i++) {
            var task = _a[_i];
            proms.push(this.tasksPlugin.saveTask(this.session, task));
        }
        for (var _b = 0, _c = toSave.projects; _b < _c.length; _b++) {
            var proj = _c[_b];
            proms.push(this.tasksPlugin.saveProject(this.session, proj));
        }
        for (var _d = 0, _e = toSave.taskGroups; _d < _e.length; _d++) {
            var tg = _e[_d];
            proms.push(this.tasksPlugin.saveTaskGroup(this.session, tg));
        }
        return pmc_mail_1.Q.all(proms).then(function () {
        }).fail(function (e) {
        });
    };
    TaskGroupsPanelController.prototype.dropTask = function (taskId, status, newProjectId, newTaskGroupId, currTaskGroupId) {
        var task = this.tasksPlugin.tasks[this.session.hostHash][taskId];
        var tgsToSave = [];
        var projsToSave = [];
        if (!task) {
            return null;
        }
        if (task.getProjectId() == newProjectId) {
            newProjectId = null;
        }
        if (newTaskGroupId == currTaskGroupId) {
            newTaskGroupId = null;
        }
        if (!newProjectId && !newTaskGroupId && !status) {
            return null;
        }
        var myId = this.tasksPlugin.getMyId(this.session);
        var now = new Date().getTime();
        if (status) {
            var prevStatus = task.getStatus();
            if (status != prevStatus) {
                task.setStatus(status);
                task.addHistory({
                    what: "modified",
                    who: myId,
                    when: now,
                    arg: "status",
                    oldVal: prevStatus,
                    newVal: task.getStatus(),
                });
            }
        }
        if (newProjectId) {
            var newProject = this.tasksPlugin.projects[this.session.hostHash][newProjectId];
            var currProject = this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()];
            for (var _i = 0, _a = task.getTaskGroupIds(); _i < _a.length; _i++) {
                var tgId = _a[_i];
                if (tgId == "__orphans__") {
                    currProject.removeOrphanedTasksId(taskId);
                    if (projsToSave.indexOf(currProject) < 0) {
                        projsToSave.push(currProject);
                    }
                }
                var tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
                if (tg) {
                    tg.removeTaskId(taskId);
                    if (tgsToSave.indexOf(tg) < 0) {
                        tgsToSave.push(tg);
                    }
                }
            }
            if (newTaskGroupId == "__orphans__" || (!newTaskGroupId && currTaskGroupId == "__orphans__")) {
                newProject.addOrphanedTasksId(taskId, true);
                if (projsToSave.indexOf(newProject) < 0) {
                    projsToSave.push(newProject);
                }
            }
            else {
                var tg = this.tasksPlugin.taskGroups[this.session.hostHash][newTaskGroupId];
                tg.addTaskId(taskId, true);
                if (tgsToSave.indexOf(tg) < 0) {
                    tgsToSave.push(tg);
                }
            }
            task.setTaskGroupIds([newTaskGroupId]);
            task.setProjectId(newProjectId);
            task.addHistory({
                what: "modified",
                who: myId,
                when: now,
                arg: "projectId",
                oldVal: currProject.getId(),
                newVal: newProject.getId(),
            });
        }
        else if (newTaskGroupId) {
            if (newTaskGroupId == "__orphans__") {
                var project = this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()];
                project.addOrphanedTasksId(taskId, true);
                if (projsToSave.indexOf(project) < 0) {
                    projsToSave.push(project);
                }
            }
            else {
                var newTaskGroup = this.tasksPlugin.taskGroups[this.session.hostHash][newTaskGroupId];
                newTaskGroup.addTaskId(taskId, true);
                if (tgsToSave.indexOf(newTaskGroup) < 0) {
                    tgsToSave.push(newTaskGroup);
                }
            }
            if (currTaskGroupId == "__orphans__") {
                var project = this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()];
                project.removeOrphanedTasksId(taskId);
                if (projsToSave.indexOf(project) < 0) {
                    projsToSave.push(project);
                }
            }
            else {
                var currTaskGroup = this.tasksPlugin.taskGroups[this.session.hostHash][currTaskGroupId];
                currTaskGroup.removeTaskId(taskId);
                if (tgsToSave.indexOf(currTaskGroup) < 0) {
                    tgsToSave.push(currTaskGroup);
                }
            }
            task.removeTaskGroupId(currTaskGroupId);
            task.addTaskGroupId(newTaskGroupId, true);
            task.addHistory({
                what: "moved",
                who: myId,
                when: now,
                arg: "projectId",
                oldVal: [currTaskGroupId],
                newVal: [newTaskGroupId],
            });
        }
        task.setModifiedBy(myId);
        task.setModifiedDateTime(now);
        return { tasks: [task], taskGroups: tgsToSave, projects: projsToSave };
    };
    TaskGroupsPanelController.prototype.onViewCopyTasksToClipboard = function (fullTaskIdsStr) {
        var fullTaskIds = JSON.parse(fullTaskIdsStr);
        var text = this.getTasksCopiedString(fullTaskIds);
        this.app.setSystemCliboardData({
            text: text,
        });
    };
    TaskGroupsPanelController.prototype.getTasksCopiedString = function (fullTaskIds) {
        var _this = this;
        return fullTaskIds
            .map(function (x) { return x.split("/")[2]; })
            .map(function (x) { return _this.tasksPlugin.tasks[_this.session.hostHash][x]; })
            .filter(function (x) { return x; })
            .map(function (x) { return striptags(x.getDescription().replace(/<br\s*\/?>/gi, ' ')); })
            .join("\n");
    };
    TaskGroupsPanelController.prototype.onViewAddToClipboard = function (elementStr, addedAtTs) {
        var data = JSON.parse(elementStr);
        var addedAt = new Date(addedAtTs);
        if (this.mostRecentTasksClipboardElement && this.mostRecentTasksClipboardElement.data) {
            this.mostRecentTasksClipboardElement.data.isCut = false;
        }
        var str = this.getTasksCopiedString(data.fullTaskIds);
        this.app.clipboard.add(this.wrapTaskClipboardData(data, str), addedAt);
    };
    TaskGroupsPanelController.prototype.onViewUpdateClipboard = function (dataStr, addedAtTs) {
        var data = JSON.parse(dataStr);
        var addedAt = new Date(addedAtTs);
        var element = this.mostRecentTasksClipboardElement;
        if (element && element.addedAt == addedAt) {
            this.app.clipboard.update(element, this.wrapTaskClipboardData(data));
        }
    };
    TaskGroupsPanelController.prototype.wrapTaskClipboardData = function (data, str) {
        if (str === void 0) { str = null; }
        var obj = {};
        obj[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS] = data;
        if (str) {
            obj["text"] = str;
        }
        return obj;
    };
    TaskGroupsPanelController.prototype.updateFromClipboard = function (paste) {
        if (paste === void 0) { paste = false; }
        var element = this.app.clipboard.findMatchingElement(pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS);
        if (element) {
            if (!this.mostRecentTasksClipboardElement || element.data != this.mostRecentTasksClipboardElement.data || element.modifiedAt != this.mostRecentTasksClipboardElement.modifiedAt) {
                var data = element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS];
                this.callViewMethod("updateFromClipboard", JSON.stringify(data), element.addedAt.getTime(), paste);
            }
        }
    };
    TaskGroupsPanelController.prototype.onViewPaste = function () {
        var _this = this;
        pmc_mail_1.Q().then(function () {
            return _this.app.getClipboardElementToPaste([
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE,
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES,
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS,
            ], [
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES,
            ]);
        })
            .then(function (element) {
            if (!element) {
                return;
            }
            if (pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS in element.data) {
                _this.updateFromClipboard(true);
            }
            else if (element.source == "system" || element.source == "privmx") {
                var pasteFromOsStr = element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES];
                var pasteFromOs = pasteFromOsStr ? JSON.parse(pasteFromOsStr).map(function (x) {
                    if (x.data && x.data.type == "Buffer" && x.data.data) {
                        x.data = new Buffer(x.data.data);
                    }
                    return x;
                }) : [];
                var fileElements_1 = pasteFromOs.filter(function (x) { return !!x.path; });
                var imgElements_1 = pasteFromOs.filter(function (x) { return !!x.data; });
                var pmxFiles_1 = [];
                if (element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE]) {
                    pmxFiles_1.push(element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE].element);
                }
                else if (element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES]) {
                    for (var _i = 0, _a = element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES]; _i < _a.length; _i++) {
                        var el = _a[_i];
                        pmxFiles_1.push(el.element);
                    }
                }
                pmc_mail_1.Q().then(function () {
                    var proms = [];
                    if (fileElements_1.length > 0) {
                        for (var _i = 0, fileElements_2 = fileElements_1; _i < fileElements_2.length; _i++) {
                            var file = fileElements_2[_i];
                            var fileName = file.path;
                            if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                                fileName = fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                            }
                            var data = file.data ? file.data : require("fs").readFileSync(file.path);
                            proms.push(_this.upload(pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)));
                        }
                    }
                    else if (pmxFiles_1.length > 0) {
                        var _loop_1 = function (osf) {
                            proms.push(osf.getBuffer().then(function (buff) {
                                return _this.upload(pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(buff, osf.mimeType, osf.name));
                            }));
                        };
                        for (var _a = 0, pmxFiles_2 = pmxFiles_1; _a < pmxFiles_2.length; _a++) {
                            var osf = pmxFiles_2[_a];
                            _loop_1(osf);
                        }
                    }
                    else {
                        var file = imgElements_1[0];
                        var formatNum = function (x) {
                            var p = x < 10 ? "0" : "";
                            return "" + p + x;
                        };
                        var now = new Date();
                        var y = now.getFullYear();
                        var m = formatNum(now.getMonth() + 1);
                        var d = formatNum(now.getDate());
                        var h = formatNum(now.getHours());
                        var i = formatNum(now.getMinutes());
                        var s = formatNum(now.getSeconds());
                        var r = Math.floor(Math.random() * 10000);
                        var ext = file.mime.split("/")[1];
                        var fileName = "" + y + m + d + "-" + h + i + s + "-" + r + "." + ext;
                        proms.push(_this.upload(pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(file.data, file.mime, fileName)));
                    }
                    return pmc_mail_1.Q.all(proms);
                })
                    .then(function (osfs) {
                    return _this.tasksPlugin.openNewTaskWindow(_this.session, _this.getActiveSection(), osfs);
                });
            }
        });
    };
    TaskGroupsPanelController.prototype.upload = function (content) {
        return this.getActiveSection().uploadFile({
            data: content,
        })
            .then(function (result) {
            return result.openableElement;
        });
    };
    TaskGroupsPanelController.prototype.setSession = function (session, onlyProjectId) {
        var _this = this;
        if (onlyProjectId === void 0) { onlyProjectId = null; }
        return pmc_mail_1.Q().then(function () {
            _this.session = session;
            return pmc_mail_1.Q.all([
                _this.session.mailClientApi.privmxRegistry.getIdentity(),
                _this.session.mailClientApi.privmxRegistry.getPersonService()
            ])
                .then(function (res) {
                _this.identity = res[0];
                _this.personService = res[1];
                _this.conv2Service = _this.session.conv2Service;
                _this.sectionManager = _this.session.sectionManager;
                return _this.tasksPlugin.checkInit();
            })
                .then(function () {
                return pmc_mail_1.Q.all(_this.tasksPlugin.tasksSectionsCollection[_this.session.hostHash].list.map(function (x) {
                    if (onlyProjectId && onlyProjectId != x.getId()) {
                        return;
                    }
                    return _this.tasksPlugin.ensureProjectExists(x.getId(), x.getName(), _this.session);
                }))
                    .thenResolve(null);
            });
        });
    };
    TaskGroupsPanelController.textsPrefix = "plugin.tasks.component.taskGroupsPanel.";
    TaskGroupsPanelController = __decorate([
        Dependencies(["customselect", "persons", "notification", "taskpanel"])
    ], TaskGroupsPanelController);
    return TaskGroupsPanelController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.TaskGroupsPanelController = TaskGroupsPanelController;
Model.prototype.className = "com.privmx.plugin.tasks.component.taskGroupsPanel.Model";
ProjectModel.prototype.className = "com.privmx.plugin.tasks.component.taskGroupsPanel.ProjectModel";
TaskGroupModel.prototype.className = "com.privmx.plugin.tasks.component.taskGroupsPanel.TaskGroupModel";
TaskModel.prototype.className = "com.privmx.plugin.tasks.component.taskGroupsPanel.TaskModel";
TasksFilterUpdater.prototype.className = "com.privmx.plugin.tasks.component.taskGroupsPanel.TasksFilterUpdater";
TaskGroupsPanelController.prototype.className = "com.privmx.plugin.tasks.component.taskGroupsPanel.TaskGroupsPanelController";

//# sourceMappingURL=TaskGroupsPanelController.js.map
