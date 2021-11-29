"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Types_1 = require("./Types");
var CalendarTasksCountManager = (function () {
    function CalendarTasksCountManager(session, privateSection, calendarPlugin, tasksPlugin, sidebar, countFiles, isRemote) {
        if (isRemote === void 0) { isRemote = false; }
        this.session = session;
        this.privateSection = privateSection;
        this.calendarPlugin = calendarPlugin;
        this.tasksPlugin = tasksPlugin;
        this.sidebar = sidebar;
        this.countFiles = countFiles;
        this.isRemote = isRemote;
        this.refresh();
    }
    CalendarTasksCountManager.prototype.refresh = function () {
        this.customsCount = {};
        this.sectionsCount = {};
        this.conv2Count = {};
    };
    CalendarTasksCountManager.prototype.getSectionElementsCount = function (section) {
        return this.getSectionTasksSummary(section.getId()).count;
    };
    CalendarTasksCountManager.prototype.getConv2ElementsCount = function (conv2section) {
        return this.getConv2TasksSummary(conv2section.id).count;
    };
    CalendarTasksCountManager.prototype.getCustomElementElementsCount = function (customElement) {
        return this.getCustomTasksSummary(customElement.id).count;
    };
    CalendarTasksCountManager.prototype.getSectionLastDate = function (section) {
        return this.getSectionTasksSummary(section.getId()).lastDate;
    };
    CalendarTasksCountManager.prototype.getConv2LastDate = function (conv2section) {
        return this.getConv2TasksSummary(conv2section.id).lastDate;
    };
    CalendarTasksCountManager.prototype.getCustomElementLastDate = function (customElement) {
        return this.getCustomTasksSummary(customElement.id).lastDate;
    };
    CalendarTasksCountManager.prototype.getSectionTasksSummary = function (id) {
        if (!(id in this.sectionsCount)) {
            this.sectionsCount[id] = this.getTasksSummaryInSection(id);
        }
        return this.sectionsCount[id];
    };
    CalendarTasksCountManager.prototype.getCustomTasksSummary = function (id) {
        var _this = this;
        if (!(id in this.customsCount)) {
            if (id == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID) {
                var myId_1 = this.tasksPlugin.getMyId(this.session);
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return _this.isCalendarTask(task) && task.isAssignedTo(myId_1) && !task.getIsTrashed(); }, function (file) { return false; });
            }
            else if (id == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
                var myId_2 = this.tasksPlugin.getMyId(this.session);
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return _this.isCalendarTask(task) && task.getCreatedBy() == myId_2 && !task.getIsTrashed(); }, function (file) { return !file.trashed && file.createdBy == _this.calendarPlugin.getMyId(_this.session); });
            }
            else if (id == Types_1.CustomTasksElements.ALL_TASKS_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return _this.isCalendarTask(task) && !task.getIsTrashed(); }, function (file) { return !file.trashed; });
            }
            else if (id == Types_1.CustomTasksElements.TRASH_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return _this.isCalendarTask(task) && task.getIsTrashed(); }, function (file) { return file.trashed; });
            }
            else if (id == this.tasksPlugin.getPrivateSectionId()) {
                this.customsCount[id] = this.getTasksSummaryInSection(id);
            }
            else {
                this.customsCount[id] = {
                    tasks: {},
                    files: {},
                    count: 0,
                    lastDate: 0
                };
            }
        }
        return this.customsCount[id];
    };
    CalendarTasksCountManager.prototype.getConv2TasksSummary = function (id) {
        var _this = this;
        if (!(id in this.conv2Count)) {
            var users_1 = this.tasksPlugin.getConv2Users(this.session, id, true);
            this.conv2Count[id] = this.getTasksSummaryBy(function (task) { return _this.isCalendarTask(task) && _this.tasksPlugin.isAssignedToUsers(task, users_1); }, function (file) { return false; });
        }
        return this.conv2Count[id];
    };
    CalendarTasksCountManager.prototype.getTasksSummaryBy = function (filter, fileFilter) {
        var summary = {
            tasks: {},
            files: {},
            count: 0,
            lastDate: 0
        };
        for (var tId in this.tasksPlugin.tasks[this.session.hostHash]) {
            var task = this.tasksPlugin.tasks[this.session.hostHash][tId];
            if (!(task.getProjectId() in this.tasksPlugin.projects[this.session.hostHash])) {
                continue;
            }
            if (filter(task)) {
                summary.tasks[tId] = task;
                summary.count++;
                summary.lastDate = Math.max(summary.lastDate, task.getModifiedDateTime() || 0);
            }
        }
        this.buildFilesSummary(summary, fileFilter);
        return summary;
    };
    CalendarTasksCountManager.prototype.getTasksSummaryInSection = function (sectionId) {
        var _this = this;
        var extraSections = this.calendarPlugin.getExtraCalendars(this.session, sectionId) || [];
        return this.getTasksSummaryBy(function (task) { return _this.isCalendarTask(task) && (task.getProjectId() == sectionId || extraSections.indexOf(task.getProjectId()) >= 0) && !task.getIsTrashed(); }, function (file) { return !file.trashed && (file.sectionId == sectionId || extraSections.indexOf(file.sectionId) >= 0); });
    };
    CalendarTasksCountManager.prototype.addTaskToSummary = function (taskId, summary) {
        if (taskId in summary.tasks) {
            return false;
        }
        var task = this.tasksPlugin.getTask(this.session, taskId);
        if (task == null) {
            return false;
        }
        summary.tasks[taskId] = task;
        summary.count++;
        summary.lastDate = Math.max(summary.lastDate, task.getModifiedDateTime() || 0);
        return true;
    };
    CalendarTasksCountManager.prototype.removeTaskFromSummary = function (taskId, summary) {
        if (!(taskId in summary.tasks)) {
            return false;
        }
        delete summary.tasks[taskId];
        summary.count--;
        summary.lastDate = 0;
        for (var id in summary.tasks) {
            var modDate = summary.tasks[id].getModifiedDateTime() || 0;
            if (modDate > summary.lastDate) {
                summary.lastDate = modDate;
            }
        }
        return true;
    };
    CalendarTasksCountManager.prototype.addTaskToCustomElement = function (id, taskId) {
        if (this.addTaskToSummary(taskId, this.getCustomTasksSummary(id))) {
            this.updateSidebarCustomElement(id);
        }
        if (id == this.calendarPlugin.getPrivateSectionId()) {
            var extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, id);
            for (var _i = 0, extraSections_1 = extraSections; _i < extraSections_1.length; _i++) {
                var extraSectionId = extraSections_1[_i];
                if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(extraSectionId))) {
                    this.updateSidebarSection(extraSectionId);
                }
            }
        }
    };
    CalendarTasksCountManager.prototype.removeTaskFromCustomElement = function (id, taskId) {
        if (this.removeTaskFromSummary(taskId, this.getCustomTasksSummary(id))) {
            this.updateSidebarCustomElement(id);
        }
    };
    CalendarTasksCountManager.prototype.updateSidebarCustomElement = function (id) {
        if (this.isRemote) {
            return;
        }
        var index = this.sidebar ? this.sidebar.customElementList.customElementsCollection.indexOfBy(function (x) { return x.id == id; }) : -1;
        if (index != -1) {
            this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
        }
    };
    CalendarTasksCountManager.prototype.addTaskToSection = function (sectionId, taskId) {
        if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
        var extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, sectionId);
        for (var _i = 0, extraSections_2 = extraSections; _i < extraSections_2.length; _i++) {
            var extraSectionId = extraSections_2[_i];
            if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(extraSectionId))) {
                this.updateSidebarSection(extraSectionId);
            }
        }
    };
    CalendarTasksCountManager.prototype.removeTaskFromSection = function (sectionId, taskId) {
        if (this.removeTaskFromSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
        var extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, sectionId);
        for (var _i = 0, extraSections_3 = extraSections; _i < extraSections_3.length; _i++) {
            var extraSectionId = extraSections_3[_i];
            if (this.removeTaskFromSummary(taskId, this.getSectionTasksSummary(extraSectionId))) {
                this.updateSidebarSection(extraSectionId);
            }
        }
    };
    CalendarTasksCountManager.prototype.updateSidebarSection = function (sectionId) {
        if (!this.sidebar) {
            return;
        }
        var collection = this.sidebar.sectionList.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteSectionsLists[this.session.hostHash].sortedCollection;
        }
        var index = this.sidebar ? collection.collection.indexOfBy(function (x) { return x.getId() == sectionId; }) : -1;
        if (index != -1) {
            collection.triggerBaseUpdateAt(index);
        }
        this.updateSidebarHostElement();
    };
    CalendarTasksCountManager.prototype.addTaskToConv2 = function (id, taskId) {
        if (this.addTaskToSummary(taskId, this.getConv2TasksSummary(id))) {
            this.updateSidebarConv2(id);
        }
    };
    CalendarTasksCountManager.prototype.removeTaskFromConv2 = function (id, taskId) {
        if (this.removeTaskFromSummary(taskId, this.getConv2TasksSummary(id))) {
            this.updateSidebarConv2(id);
        }
    };
    CalendarTasksCountManager.prototype.updateSidebarConv2 = function (c2sId) {
        if (!this.sidebar) {
            return;
        }
        var collection = this.sidebar.conv2List.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteConv2Lists[this.session.hostHash].sortedCollection;
        }
        var index = this.sidebar ? collection.collection.indexOfBy(function (x) { return x.id == c2sId; }) : -1;
        if (index != -1) {
            collection.triggerBaseUpdateAt(index);
        }
        this.updateSidebarHostElement();
    };
    CalendarTasksCountManager.prototype.updateTasksCount = function (taskId, action) {
        if (action == "added") {
            this.addTask(taskId);
        }
        else if (action == "modified") {
            this.modifyTask(taskId);
        }
        else if (action == "deleted") {
            this.deleteTask(taskId);
        }
        else if (action == "section-changed") {
            this.deleteTask(taskId);
        }
    };
    CalendarTasksCountManager.prototype.addTask = function (taskId) {
        var task = this.tasksPlugin.getTask(this.session, taskId);
        if (task == null) {
            return;
        }
        if (!this.isCalendarTask(task)) {
            return;
        }
        if (task.getIsTrashed()) {
            this.addTaskToCustomElement(Types_1.CustomTasksElements.TRASH_ID, taskId);
        }
        else {
            if (task.isAssignedTo(this.tasksPlugin.getMyId(this.session))) {
                this.addTaskToCustomElement(Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID, taskId);
            }
            if (task.getCreatedBy() == this.tasksPlugin.getMyId(this.session)) {
                this.addTaskToCustomElement(Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID, taskId);
            }
            this.addTaskToCustomElement(Types_1.CustomTasksElements.ALL_TASKS_ID, taskId);
            var sectionId = task.getProjectId();
            if (sectionId == this.tasksPlugin.getPrivateSectionId()) {
                this.addTaskToCustomElement(sectionId, taskId);
            }
            else {
                this.addTaskToSection(task.getProjectId(), taskId);
            }
            for (var c2sId in this.conv2Count) {
                var users = this.tasksPlugin.getConv2Users(this.session, c2sId, true);
                if (this.tasksPlugin.isAssignedToUsers(task, users)) {
                    this.addTaskToConv2(c2sId, taskId);
                }
            }
        }
    };
    CalendarTasksCountManager.prototype.deleteTask = function (taskId) {
        for (var id in this.customsCount) {
            this.removeTaskFromCustomElement(id, taskId);
        }
        for (var id in this.sectionsCount) {
            this.removeTaskFromSection(id, taskId);
        }
        for (var id in this.conv2Count) {
            this.removeTaskFromConv2(id, taskId);
        }
    };
    CalendarTasksCountManager.prototype.modifyTask = function (taskId) {
        this.deleteTask(taskId);
        this.addTask(taskId);
    };
    CalendarTasksCountManager.prototype.isCalendarTask = function (task) {
        return task && task.getStartTimestamp() != null;
    };
    CalendarTasksCountManager.prototype.buildFilesSummary = function (summary, filter) {
        if (!summary) {
            return;
        }
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        for (var identifier in this.calendarPlugin.fileModels[this.session.hostHash]) {
            if (filter(this.calendarPlugin.fileModels[this.session.hostHash][identifier])) {
                this.addFileToSummary(this.calendarPlugin.fileModels[this.session.hostHash][identifier], summary);
            }
        }
    };
    CalendarTasksCountManager.prototype.addFile = function (identifier) {
        var _this = this;
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        var model = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
        if (!model) {
            return;
        }
        if (model.trashed) {
            this.addFileToSummary(model, this.customsCount[Types_1.CustomTasksElements.TRASH_ID], function () { return _this.updateSidebarCustomElement(Types_1.CustomTasksElements.TRASH_ID); });
        }
        else {
            this.addFileToSummary(model, this.customsCount[Types_1.CustomTasksElements.ALL_TASKS_ID], function () { return _this.updateSidebarCustomElement(Types_1.CustomTasksElements.ALL_TASKS_ID); });
            if (model.createdBy == this.calendarPlugin.getMyId(this.session)) {
                this.addFileToSummary(model, this.customsCount[Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID], function () { return _this.updateSidebarCustomElement(Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID); });
            }
            this.addFileToSummary(model, this.getFilesSummary(model.sectionId), function () {
                _this.updateSidebarSection(model.sectionId);
                _this.updateSidebarCustomElement(model.sectionId);
            });
            var extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, model.sectionId);
            var _loop_1 = function (extraSectionId) {
                this_1.addFileToSummary(model, this_1.getFilesSummary(extraSectionId), function () {
                    _this.updateSidebarSection(extraSectionId);
                    _this.updateSidebarCustomElement(extraSectionId);
                });
            };
            var this_1 = this;
            for (var _i = 0, extraSections_4 = extraSections; _i < extraSections_4.length; _i++) {
                var extraSectionId = extraSections_4[_i];
                _loop_1(extraSectionId);
            }
        }
    };
    CalendarTasksCountManager.prototype.removeFile = function (identifier) {
        var _this = this;
        var _loop_2 = function (k) {
            this_2.removeFileFromSummary(identifier, this_2.customsCount[k], function () { return _this.updateSidebarCustomElement(k); });
        };
        var this_2 = this;
        for (var k in this.customsCount) {
            _loop_2(k);
        }
        var _loop_3 = function (k) {
            this_3.removeFileFromSummary(identifier, this_3.sectionsCount[k], function () { return _this.updateSidebarSection(k); });
        };
        var this_3 = this;
        for (var k in this.sectionsCount) {
            _loop_3(k);
        }
    };
    CalendarTasksCountManager.prototype.getFilesSummary = function (id) {
        if (id == this.calendarPlugin.getPrivateSectionId()) {
            return this.customsCount[id];
        }
        return this.sectionsCount[id];
    };
    CalendarTasksCountManager.prototype.addFileToSummary = function (model, summary, updateSidebar) {
        if (updateSidebar === void 0) { updateSidebar = function () { }; }
        if (!this.countFiles || !summary || model.identifier in summary.files) {
            return;
        }
        summary.files[model.identifier] = model;
        summary.count++;
        updateSidebar();
    };
    CalendarTasksCountManager.prototype.removeFileFromSummary = function (identifier, summary, updateSidebar) {
        if (updateSidebar === void 0) { updateSidebar = function () { }; }
        if (!this.countFiles || !summary || !(identifier in summary.files)) {
            return;
        }
        delete summary.files[identifier];
        summary.count--;
        updateSidebar();
    };
    CalendarTasksCountManager.prototype.updateSidebarHostElement = function () {
        var _this = this;
        if (!this.isRemote) {
            return;
        }
        var element = this.sidebar.hostList.hostsSortedCollection.find(function (x) { return x.host == _this.session.host; });
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    };
    return CalendarTasksCountManager;
}());
exports.CalendarTasksCountManager = CalendarTasksCountManager;
CalendarTasksCountManager.prototype.className = "com.privmx.plugin.calendar.main.CalendarTasksCountManager";

//# sourceMappingURL=CalendarTasksCountManager.js.map
