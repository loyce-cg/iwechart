"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Types_1 = require("../../main/Types");
var TasksCountManager = (function () {
    function TasksCountManager(session, privateSection, tasksPlugin, sidebar, isRemote) {
        if (isRemote === void 0) { isRemote = false; }
        this.session = session;
        this.privateSection = privateSection;
        this.tasksPlugin = tasksPlugin;
        this.sidebar = sidebar;
        this.isRemote = isRemote;
        this.refresh();
    }
    TasksCountManager.prototype.refresh = function () {
        this.customsCount = {};
        this.sectionsCount = {};
        this.conv2Count = {};
    };
    TasksCountManager.prototype.getSectionElementsCount = function (section) {
        return this.getSectionTasksSummary(section.getId()).count;
    };
    TasksCountManager.prototype.getConv2ElementsCount = function (conv2section) {
        return this.getConv2TasksSummary(conv2section.id).count;
    };
    TasksCountManager.prototype.getCustomElementElementsCount = function (customElement) {
        return this.getCustomTasksSummary(customElement.id).count;
    };
    TasksCountManager.prototype.getSectionLastDate = function (section) {
        return this.getSectionTasksSummary(section.getId()).lastDate;
    };
    TasksCountManager.prototype.getConv2LastDate = function (conv2section) {
        return this.getConv2TasksSummary(conv2section.id).lastDate;
    };
    TasksCountManager.prototype.getCustomElementLastDate = function (customElement) {
        return this.getCustomTasksSummary(customElement.id).lastDate;
    };
    TasksCountManager.prototype.getSectionTasksSummary = function (id) {
        if (!(id in this.sectionsCount)) {
            this.sectionsCount[id] = this.getTasksSummaryInSection(id);
        }
        return this.sectionsCount[id];
    };
    TasksCountManager.prototype.getCustomTasksSummary = function (id) {
        if (!(id in this.customsCount)) {
            if (id == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID) {
                var myId_1 = this.tasksPlugin.getMyId(this.session);
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return task.isAssignedTo(myId_1) && !task.getIsTrashed(); });
            }
            else if (id == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
                var myId_2 = this.tasksPlugin.getMyId(this.session);
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return task.getCreatedBy() == myId_2 && !task.getIsTrashed(); });
            }
            else if (id == Types_1.CustomTasksElements.ALL_TASKS_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return !task.getIsTrashed(); });
            }
            else if (id == Types_1.CustomTasksElements.TRASH_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(function (task) { return task.getIsTrashed(); });
            }
            else if (id == this.tasksPlugin.getPrivateSectionId()) {
                this.customsCount[id] = this.getTasksSummaryInSection(id);
            }
            else {
                this.customsCount[id] = {
                    tasks: {},
                    count: 0,
                    lastDate: 0
                };
            }
        }
        return this.customsCount[id];
    };
    TasksCountManager.prototype.getConv2TasksSummary = function (id) {
        var _this = this;
        if (!(id in this.conv2Count)) {
            var users_1 = this.tasksPlugin.getConv2Users(this.session, id, true);
            this.conv2Count[id] = this.getTasksSummaryBy(function (task) { return _this.tasksPlugin.isAssignedToUsers(task, users_1) && !task.getIsTrashed(); });
        }
        return this.conv2Count[id];
    };
    TasksCountManager.prototype.getTasksSummaryBy = function (filter) {
        var summary = {
            tasks: {},
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
        return summary;
    };
    TasksCountManager.prototype.getTasksSummaryInSection = function (sectionId) {
        return this.getTasksSummaryBy(function (task) { return task.getProjectId() == sectionId && !task.getIsTrashed(); });
    };
    TasksCountManager.prototype.addTaskToSummary = function (taskId, summary) {
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
    TasksCountManager.prototype.removeTaskFromSummary = function (taskId, summary) {
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
    TasksCountManager.prototype.addTaskToCustomElement = function (id, taskId) {
        if (this.addTaskToSummary(taskId, this.getCustomTasksSummary(id))) {
            this.updateSidebarCustomElement(id);
        }
    };
    TasksCountManager.prototype.removeTaskFromCustomElement = function (id, taskId) {
        if (this.removeTaskFromSummary(taskId, this.getCustomTasksSummary(id))) {
            this.updateSidebarCustomElement(id);
        }
    };
    TasksCountManager.prototype.updateSidebarCustomElement = function (id) {
        if (this.isRemote) {
            return;
        }
        if (!this.sidebar) {
            return;
        }
        var element = this.sidebar ? this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; }) : null;
        if (element) {
            this.sidebar.customElementList.customElementsCollection.triggerBaseUpdateElement(element);
        }
    };
    TasksCountManager.prototype.addTaskToSection = function (sectionId, taskId) {
        if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
    };
    TasksCountManager.prototype.removeTaskFromSection = function (sectionId, taskId) {
        if (this.removeTaskFromSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
    };
    TasksCountManager.prototype.updateSidebarSection = function (sectionId) {
        if (!this.sidebar) {
            return;
        }
        var collection = this.sidebar.sectionList.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteSectionsLists[this.session.hostHash].sortedCollection;
        }
        var element = this.sidebar ? collection.find(function (x) { return x.getId() == sectionId; }) : null;
        if (element) {
            collection.triggerBaseUpdateElement(element);
        }
        this.updateSidebarHostElement();
    };
    TasksCountManager.prototype.addTaskToConv2 = function (id, taskId) {
        if (this.addTaskToSummary(taskId, this.getConv2TasksSummary(id))) {
            this.updateSidebarConv2(id);
        }
    };
    TasksCountManager.prototype.removeTaskFromConv2 = function (id, taskId) {
        if (this.removeTaskFromSummary(taskId, this.getConv2TasksSummary(id))) {
            this.updateSidebarConv2(id);
        }
    };
    TasksCountManager.prototype.updateSidebarConv2 = function (c2sId) {
        if (!this.sidebar) {
            return;
        }
        var collection = this.sidebar.conv2List.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteConv2Lists[this.session.hostHash].sortedCollection;
        }
        var element = this.sidebar ? collection.find(function (x) { return x.id == c2sId; }) : null;
        if (element) {
            collection.triggerBaseUpdateElement(element);
        }
        this.updateSidebarHostElement();
    };
    TasksCountManager.prototype.updateTasksCount = function (taskId, action) {
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
    TasksCountManager.prototype.addTask = function (taskId) {
        var task = this.tasksPlugin.getTask(this.session, taskId);
        if (task == null) {
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
    TasksCountManager.prototype.deleteTask = function (taskId) {
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
    TasksCountManager.prototype.modifyTask = function (taskId) {
        this.deleteTask(taskId);
        this.addTask(taskId);
    };
    TasksCountManager.prototype.updateSidebarHostElement = function () {
        var _this = this;
        if (!this.isRemote) {
            return;
        }
        var element = this.sidebar.hostList.hostsSortedCollection.find(function (x) { return x.host == _this.session.host; });
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    };
    return TasksCountManager;
}());
exports.TasksCountManager = TasksCountManager;
TasksCountManager.prototype.className = "com.privmx.plugin.tasks.window.tasks.TasksCountManager";

//# sourceMappingURL=TasksCountManager.js.map
