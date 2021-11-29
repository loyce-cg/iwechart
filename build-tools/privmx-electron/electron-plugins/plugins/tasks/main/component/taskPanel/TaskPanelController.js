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
var Task_1 = require("../../main/data/Task");
var TaskWindowController_1 = require("../../window/task/TaskWindowController");
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var TaskGroup_1 = require("../../main/data/TaskGroup");
var TaskGroupFormWindowController_1 = require("../../window/taskGroupForm/TaskGroupFormWindowController");
var DataMigration_1 = require("../../main/DataMigration");
var index_1 = require("./i18n/index");
var AttachmentsManager_1 = require("../../main/AttachmentsManager");
var HistoryManager_1 = require("../../main/HistoryManager");
var Utils_1 = require("../../main/utils/Utils");
var Types_1 = require("./Types");
var Logger = pmc_mail_1.Logger.get("privfs-tasks-plugin.TaskPanelController");
var TaskPanelController = (function (_super) {
    __extends(TaskPanelController, _super);
    function TaskPanelController(parent, session, personsComponent, handlers, docked, editable, attachments) {
        if (docked === void 0) { docked = true; }
        if (editable === void 0) { editable = false; }
        if (attachments === void 0) { attachments = []; }
        var _this = _super.call(this, parent) || this;
        _this.session = session;
        _this.personsComponent = personsComponent;
        _this.obtainedTaskId = null;
        _this.newTask = false;
        _this.newTaskProject = null;
        _this.newTaskTaskGroupIds = null;
        _this.openedAsEditable = false;
        _this.saved = false;
        _this.deleted = false;
        _this.assignTo = [];
        _this.scrollToComments = false;
        _this.dirty = false;
        _this.origHistoryLength = 0;
        _this.defaultDateTime = null;
        _this.overrideIsHorizontalLayout = null;
        _this.confirmExit = true;
        _this.sectionFileTreeDeferreds = {};
        _this.lastTreeWatcherOpId = 0;
        _this.currFileTree = null;
        _this.onFileTreeCollectionChangedBound = null;
        _this.initialAttachments = null;
        _this.modifiedPropertyNames = [];
        _this.onTaskCreatedHandlers = [];
        _this.onCancelledHandlers = [];
        _this.bindEvent(_this.app.userPreferences.eventDispatcher, "userpreferenceschange", function (event) {
            _this.onUserPreferencesChange(event);
        });
        _this.initialAttachments = attachments && attachments.length > 0 ? attachments : null;
        _this.onFileTreeCollectionChangedBound = _this.onFileTreeCollectionChanged.bind(_this);
        _this.ipcMode = true;
        _this.handlers = handlers;
        _this.openedAsEditable = editable;
        _this.editable = editable;
        _this.docked = docked;
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.watchedTasksHistoryRebuildHandlerBound = _this.watchedTasksHistoryRebuildHandler.bind(_this);
        _this.watchedTasksHistorySetHandlerBound = _this.watchedTasksHistorySetHandler.bind(_this);
        _this.tasksPlugin.onWatchedTasksHistoryRebuild(_this.watchedTasksHistoryRebuildHandlerBound);
        _this.tasksPlugin.onWatchedTasksHistorySet(_this.watchedTasksHistorySetHandlerBound);
        _this.historyManager = new HistoryManager_1.HistoryManager(_this.app.sessionManager.getLocalSession(), _this.tasksPlugin);
        _this.attachmentsManager = new AttachmentsManager_1.AttachmentsManager(_this.app.sessionManager.getLocalSession(), _this.tasksPlugin, _this.historyManager);
        _this.parent.addViewStyle({ path: "window/component/dateTimePicker/template/main.css", plugin: "calendar" });
        _this.parent.addViewScript({ path: "build/view.js", plugin: "calendar" });
        _this.dataChangedListener = _this.onDataChanged.bind(_this);
        _this.onTaskGroupChangedListener = _this.onTaskGroupChanged.bind(_this);
        _this.onTaskChangedListener = _this.onTaskChanged.bind(_this);
        _this.customSelectProject = _this.addComponent("customSelectProject", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: editable,
                firstItemIsStandalone: false,
                items: [],
            }]));
        _this.customSelectTaskGroup = _this.addComponent("customSelectTaskGroup", _this.componentFactory.createComponent("customselect", [_this, {
                multi: true,
                editable: editable,
                noSelectionItem: {
                    type: "item",
                    icon: null,
                    text: _this.i18n("plugin.tasks.component.taskPanel.task.taskGroup.noneSelected"),
                    value: null,
                    selected: false,
                },
                firstItemIsStandalone: false,
                mergeStrategy: {
                    strategyType: "take-all",
                    separator: null,
                },
                items: [],
                actionHandler: function (actionId) {
                    if (actionId == Types_1.CREATE_NEW_TASKGROUP_ACTION) {
                        _this.createNewTaskGroup();
                    }
                },
            }]));
        _this.customSelectAssignedTo = _this.addComponent("customSelectAssignedTo", _this.componentFactory.createComponent("customselect", [_this, {
                multi: true,
                editable: editable,
                firstItemIsStandalone: false,
                noSelectionItem: {
                    type: "item",
                    icon: {
                        type: "avatar",
                        hashmail: "",
                    },
                    text: _this.i18n("plugin.tasks.component.taskPanel.task.assignedTo.nooneSelected"),
                    value: null,
                    selected: false,
                },
                mergeStrategy: {
                    strategyType: "take-parts",
                    icons: "take-all",
                    texts: "take-none",
                },
                items: [],
            }]));
        _this.customSelectType = _this.addComponent("customSelectType", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: editable,
                firstItemIsStandalone: false,
                items: [],
            }]));
        _this.customSelectStatus = _this.addComponent("customSelectStatus", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: editable,
                firstItemIsStandalone: false,
                items: [],
            }]));
        _this.customSelectPriority = _this.addComponent("customSelectPriority", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: editable,
                firstItemIsStandalone: false,
                items: [],
            }]));
        _this.dateTimePicker = _this.addComponent("dateTimePicker", _this.componentFactory.createComponent("dateTimePicker", [_this, {
                popup: true,
                week: false,
            }]));
        _this.dateTimePicker2 = _this.addComponent("dateTimePicker2", _this.componentFactory.createComponent("dateTimePicker", [_this, {
                popup: true,
                week: false,
            }]));
        _this.result = {
            assignedTo: null,
            attachments: null,
            description: null,
            name: null,
            priority: null,
            status: null,
            taskGroupIds: [],
            type: null,
            projectId: null,
            startTimestamp: null,
            endTimestamp: null,
            wholeDays: false,
        };
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.taskTooltip = _this.addComponent("tasktooltip", _this.componentFactory.createComponent("tasktooltip", [_this]));
        _this.sectionTooltip = _this.addComponent("sectiontooltip", _this.componentFactory.createComponent("sectiontooltip", [_this]));
        _this.encryptionEffectTaskText = _this.addComponent("encryptionEffectTaskText", _this.componentFactory.createComponent("encryptioneffect", [_this]));
        _this.encryptionEffectCommentText = _this.addComponent("encryptionEffectCommentText", _this.componentFactory.createComponent("encryptioneffect", [_this]));
        _this.taskTooltip.getContent = function (taskId) {
            return _this.tasksPlugin ? _this.tasksPlugin.getTaskTooltipContent(_this.session, taskId) : null;
        };
        _this.internalModel = {
            docked: _this.docked,
            newTask: false,
            hasTask: false,
            isEditTaskWindow: false,
            canRemoveFromCalendar: true,
            taskExists: false,
            taskId: "",
            taskDone: false,
            taskName: "",
            taskLabelClass: "",
            taskDescription: "",
            taskType: "",
            taskStatus: "",
            taskPriority: "",
            taskAttachments: [],
            taskAssignedTo: {},
            taskAssignedToArray: [],
            taskHistory: [],
            taskGroupIds: [],
            taskGroupNames: [],
            taskGroupsPinned: [],
            taskGroupsIcons: [],
            taskComments: [],
            taskIsTrashed: false,
            taskStartTimestamp: null,
            taskEndTimestamp: null,
            taskWholeDays: false,
            projectId: null,
            projectName: "",
            projectPrefix: null,
            projectPublic: true,
            resolvedTaskHistory: [],
            taskStatuses: {},
            editable: _this.editable,
            scrollToComments: _this.scrollToComments,
            myAvatar: _this.tasksPlugin.getMyself(_this.app.sessionManager.getLocalSession()).id,
            enterSavesTask: _this.getEnterSavesTask(),
            enterAddsComment: _this.getEnterAddsComment(),
            horizontalLayout: _this.getIsHorizontalLayout(),
            autoMarkAsRead: _this.app.userPreferences.getAutoMarkAsRead(),
            isRead: false,
            hostHash: _this.session ? _this.session.hostHash : null,
        };
        _this.dateTimePicker.onPopupClosed(_this.onDatePickerPopupClosed.bind(_this));
        _this.dateTimePicker2.onPopupClosed(_this.onDatePicker2PopupClosed.bind(_this));
        _this.resetAttachmentsUsingInitial();
        _this.bindEvent(_this.app, "update-pinned-taskgroups", function (event) {
            if (_this.internalModel.projectId == event.sectionId && _this.internalModel.taskGroupIds && _this.internalModel.taskGroupIds.indexOf(event.listId) >= 0) {
                var tgp = _this.internalModel.taskGroupsPinned;
                var wasPinned = tgp.indexOf(event.listId) >= 0;
                var isPinned = event.pinned;
                if (wasPinned == isPinned) {
                    return;
                }
                if (isPinned) {
                    tgp.push(event.listId);
                }
                else {
                    tgp = _this.internalModel.taskGroupsPinned = tgp.splice(tgp.indexOf(event.listId), 1);
                }
                _this.callViewMethod("updatePinnedBadges", event.listId, event.pinned);
            }
        });
        _this.bindEvent(_this.app, "tasks-setting-changed", function (event) {
            if (event.setting == "enter-saves-task") {
                _this.setEnterSavesTask(event.value);
            }
            else if (event.setting == "enter-adds-comment") {
                _this.setEnterAddsComment(event.value);
            }
            else if (event.setting == "horizontal-task-window-layout") {
                _this.refreshIsHorizontalLayout();
            }
        });
        _this.tasksPlugin.watch(_this.session, "taskGroup", "*", "modified", _this.onTaskGroupChangedListener);
        _this.tasksPlugin.watch(_this.session, "task", "*", "modified", _this.onTaskChangedListener);
        _this.watchTreeCollection();
        return _this;
    }
    TaskPanelController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    TaskPanelController.prototype.setSession = function (session) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.tasksPlugin.unWatch(_this.session, "taskGroup", "*", "modified", _this.onTaskGroupChangedListener);
            _this.tasksPlugin.unWatch(_this.session, "task", "*", "modified", _this.onTaskChangedListener);
            _this.session = session;
            return _this.session.mailClientApi.privmxRegistry.getSinkIndexManager()
                .then(function (indexManager) { return indexManager.waitForInit().thenResolve(indexManager); });
        })
            .then(function (indexManager) {
            _this.sinkIndexManager = indexManager;
            var indexes = _this.sinkIndexManager.getAllIndexes();
            _this.historyManager = new HistoryManager_1.HistoryManager(session, _this.tasksPlugin);
            _this.attachmentsManager = new AttachmentsManager_1.AttachmentsManager(session, _this.tasksPlugin, _this.historyManager);
            _this.taskTooltip.getContent = function (taskId) {
                return _this.tasksPlugin ? _this.tasksPlugin.getTaskTooltipContent(_this.session, taskId) : null;
            };
            _this.tasksPlugin.watch(_this.session, "taskGroup", "*", "modified", _this.onTaskGroupChangedListener);
            _this.tasksPlugin.watch(_this.session, "task", "*", "modified", _this.onTaskChangedListener);
        })
            .then(function () {
            _this.callViewMethod("setHostHash", _this.session.hostHash);
        });
    };
    TaskPanelController.prototype.watchedTasksHistoryRebuildHandler = function (hostHash, pId) {
        if (this.internalModel.projectId == pId && this.session.hostHash == hostHash) {
            this.updateIsRead();
        }
    };
    TaskPanelController.prototype.watchedTasksHistorySetHandler = function (hostHash, pId, tId, it) {
        if (this.taskId == tId && this.session.hostHash == hostHash) {
            this.updateIsRead();
        }
    };
    TaskPanelController.prototype.updateIsRead = function () {
        if (this.taskId && this.internalModel) {
            var isRead = !this.tasksPlugin.isUnread(this.session, this.taskId);
            this.internalModel.isRead = isRead;
            this.callViewMethod("setIsRead", isRead);
        }
    };
    TaskPanelController.prototype.resetAttachmentsUsingInitial = function () {
        if (this.initialAttachments) {
            this.attachmentsManager.resetFromOpenableSectionFiles(this.initialAttachments);
        }
        else {
            this.attachmentsManager.reset();
        }
    };
    TaskPanelController.prototype.init = function () {
        var _this = this;
        return pmc_mail_1.Q()
            .then(function () { return _this.customSelectProject.init(); })
            .then(function () { return _this.customSelectTaskGroup.init(); })
            .then(function () { return _this.customSelectAssignedTo.init(); })
            .then(function () { return _this.customSelectType.init(); })
            .then(function () { return _this.customSelectStatus.init(); })
            .then(function () { return _this.customSelectPriority.init(); })
            .then(function () { return _this.dateTimePicker.init(); })
            .then(function () { return _this.dateTimePicker2.init(); });
    };
    TaskPanelController.prototype.getModel = function () {
        var trashedAttachments = this.internalModel.taskAttachments.map(function (x) { return JSON.parse(x); }).filter(function (x) { return x.trashed; }).map(function (x) { return x.did; });
        var attachments = this.attachmentsManager.getAttachmentInfoStrings().map(function (x) {
            var att = JSON.parse(x);
            if (trashedAttachments.indexOf(att.did) >= 0) {
                att.trashed = true;
            }
            return JSON.stringify(att);
        });
        this.updateInternalModelAttachmentNames();
        return {
            docked: this.internalModel.docked,
            newTask: this.internalModel.newTask,
            hasTask: this.internalModel.hasTask,
            isEditTaskWindow: this.internalModel.isEditTaskWindow,
            canRemoveFromCalendar: this.internalModel.canRemoveFromCalendar,
            taskExists: this.internalModel.taskExists,
            taskId: this.internalModel.taskId,
            taskDone: this.internalModel.taskDone,
            taskName: this.internalModel.taskName,
            taskLabelClass: this.internalModel.taskLabelClass,
            taskDescription: this.internalModel.taskDescription,
            taskType: this.internalModel.taskType,
            taskStatus: this.internalModel.taskStatus,
            taskPriority: this.internalModel.taskPriority,
            taskAttachmentsStr: JSON.stringify(attachments),
            taskAssignedToStr: JSON.stringify(this.internalModel.taskAssignedTo),
            taskAssignedToArrayStr: JSON.stringify(this.internalModel.taskAssignedToArray),
            taskHistoryStr: JSON.stringify(this.internalModel.taskHistory),
            taskGroupIdsStr: JSON.stringify(this.internalModel.taskGroupIds),
            taskGroupNamesStr: JSON.stringify(this.internalModel.taskGroupNames),
            taskGroupsPinnedStr: JSON.stringify(this.internalModel.taskGroupsPinned),
            taskGroupsIconsStr: JSON.stringify(this.internalModel.taskGroupsIcons),
            taskCommentsStr: JSON.stringify(this.internalModel.taskComments),
            taskIsTrashed: this.internalModel.taskIsTrashed,
            taskStartTimestamp: this.internalModel.taskStartTimestamp,
            taskEndTimestamp: this.internalModel.taskEndTimestamp,
            taskWholeDays: this.internalModel.taskWholeDays,
            projectId: this.internalModel.projectId,
            projectName: this.internalModel.projectName,
            projectPrefix: this.internalModel.projectPrefix,
            projectPublic: this.internalModel.projectPublic,
            resolvedTaskHistoryStr: JSON.stringify(this.internalModel.resolvedTaskHistory),
            taskStatusesStr: JSON.stringify(this.internalModel.taskStatuses),
            editable: this.internalModel.editable,
            scrollToComments: this.scrollToComments,
            myAvatar: this.internalModel.myAvatar,
            enterSavesTask: this.internalModel.enterSavesTask,
            enterAddsComment: this.internalModel.enterAddsComment,
            horizontalLayout: this.getIsHorizontalLayout(),
            isRead: !this.tasksPlugin.isUnread(this.session, this.internalModel.taskId || ""),
            autoMarkAsRead: this.internalModel.autoMarkAsRead,
            hostHash: this.session ? this.session.hostHash : null,
        };
    };
    TaskPanelController.prototype.setHandle = function (handle) {
        this.handle = handle;
    };
    TaskPanelController.prototype.getIsHorizontalLayout = function () {
        if (this.overrideIsHorizontalLayout !== null) {
            return this.overrideIsHorizontalLayout;
        }
        return this.newTask ? false : (this.docked ? (this.tasksPlugin.getSetting(this.session, "horizontal-task-window-layout", null, null) ? true : false) : true);
    };
    TaskPanelController.prototype.refreshIsHorizontalLayout = function () {
        this.setHorizontalLayout(this.getIsHorizontalLayout());
    };
    TaskPanelController.prototype.notify = function (key) {
        var str = this.i18n("plugin.tasks.component.taskPanel.notifications." + key);
        this.notifications.showNotification(str);
    };
    TaskPanelController.prototype.requestParentClose = function (confirmExit) {
        if (confirmExit === void 0) { confirmExit = true; }
        this.confirmExit = confirmExit;
        if (!this.docked) {
            this.handlers.close();
        }
    };
    TaskPanelController.prototype.requestParentConfirm = function (msg) {
        return this.handlers.confirm(msg);
    };
    TaskPanelController.prototype.requestParentAlert = function (msg) {
        return this.handlers.alert(msg);
    };
    TaskPanelController.prototype.requestParentOpenChildWindow = function (wnd) {
        return this.handlers.openChildWindow(wnd);
    };
    TaskPanelController.prototype.requestParentUpdateDirty = function (dirty) {
        return this.handlers.updateDirty(dirty);
    };
    TaskPanelController.prototype.updateView = function (dontDisturb, skipEditableCheck, comment, noViewCall, dataChanged) {
        var _this = this;
        if (dontDisturb === void 0) { dontDisturb = false; }
        if (skipEditableCheck === void 0) { skipEditableCheck = false; }
        if (comment === void 0) { comment = null; }
        if (noViewCall === void 0) { noViewCall = false; }
        if (dataChanged === void 0) { dataChanged = false; }
        if (!skipEditableCheck && this.editable) {
            var data = {
                isTrashed: this.tasksPlugin.tasks[this.session.hostHash][this.taskId] && this.tasksPlugin.tasks[this.session.hostHash][this.taskId].getIsTrashed(),
            };
            if (!(this.taskId in this.tasksPlugin.tasks[this.session.hostHash])) {
                this.updateView(false, true, null, false, dataChanged);
                return;
            }
            if (this.internalModel && this.internalModel.hasTask && this.tasksPlugin.tasks[this.session.hostHash][this.internalModel.taskId]) {
                var task_1 = this.tasksPlugin.tasks[this.session.hostHash][this.internalModel.taskId];
                var differentProperties = [];
                if (this.internalModel.taskStatus != Task_1.Task.getStatusText(task_1.getStatus())) {
                    differentProperties.push("status");
                }
                if (this.internalModel.taskStartTimestamp != task_1.getStartTimestamp()) {
                    differentProperties.push("startDateStr");
                }
                if (this.internalModel.taskStartTimestamp != task_1.getStartTimestamp() || this.internalModel.taskEndTimestamp != task_1.getEndTimestamp()) {
                    differentProperties.push("endDateStr");
                }
                if (this.internalModel.projectId != task_1.getProjectId()) {
                    differentProperties.push("project");
                }
                if (this.internalModel.taskDescription != task_1.getDescription()) {
                    differentProperties.push("description");
                }
                if (!Utils_1.Utils.arraysEqual(this.internalModel.taskAssignedToArray, this.tasksPlugin.getMembersArray(this.session, task_1.getAssignedTo()))) {
                    differentProperties.push("assignedTo");
                }
                var atts1 = this.internalModel.taskAttachments.map(function (x) { return JSON.parse(x).did; });
                var atts2 = task_1.getAttachments().map(function (x) { return JSON.parse(x).did; });
                if (!Utils_1.Utils.arraysEqual(atts1, atts2)) {
                    differentProperties.push("attachments");
                }
                if (!Utils_1.Utils.arraysEqual(this.internalModel.taskGroupIds, task_1.getTaskGroupIds())) {
                    differentProperties.push("taskGroups");
                }
                var canUpdate = true;
                for (var k in differentProperties) {
                    if (this.modifiedPropertyNames.indexOf(k) >= 0) {
                        canUpdate = false;
                    }
                }
                for (var k in this.modifiedPropertyNames) {
                    if (differentProperties.indexOf(k) >= 0) {
                        canUpdate = false;
                    }
                }
                if (canUpdate) {
                    this.updateView(true, true, null, true, dataChanged);
                    return;
                }
            }
            this.callViewMethod("setOutOfSync", true, JSON.stringify(data));
            return;
        }
        var allCommentsLoaded = true;
        var task;
        var wantedTaskId = this.taskId;
        this.internalModel.newTask = this.newTask;
        this.internalModel.hasTask = this.taskId ? (this.taskId in this.tasksPlugin.tasks[this.session.hostHash]) : false;
        this.internalModel.taskExists = this.tasksPlugin.tasks[this.session.hostHash][this.taskId] ? true : this.newTask;
        this.internalModel.isEditTaskWindow = !this.internalModel.newTask && this.getIsHorizontalLayout();
        this.internalModel.enterSavesTask = this.getEnterSavesTask();
        this.internalModel.enterAddsComment = this.getEnterAddsComment();
        var fileTreePromise = null;
        if (this.internalModel.hasTask) {
            task = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
            var taskGroupsIds = task.getTaskGroupIds(true).filter(function (id) { return id in _this.tasksPlugin.taskGroups[_this.session.hostHash]; });
            var taskGroups = taskGroupsIds.map(function (id) { return _this.tasksPlugin.taskGroups[_this.session.hostHash][id]; });
            var project = task.getProjectId() in this.tasksPlugin.projects[this.session.hostHash] ? this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()] : null;
            if (project == null) {
                return;
            }
            var types = project.getTaskTypes(true, true);
            var statuses = Task_1.Task.getStatuses();
            var priorities = project.getTaskPriorities(true, true);
            var resolveResult = this.resolveTaskComments(this.session, task);
            var comments = resolveResult.comments;
            allCommentsLoaded = resolveResult.allLoaded;
            var taskDescription = task.getDescription();
            if (task.getMetaDataStr()) {
                var metaData = pmc_mail_1.utils.ContentEditableEditorMetaData.fromString(task.getMetaDataStr());
                taskDescription = metaData.attach(taskDescription);
            }
            this.internalModel.canRemoveFromCalendar = this.tasksPlugin.isTasksPluginEnabledInSection(this.session, task.getProjectId());
            this.internalModel.taskId = task.getId();
            this.internalModel.taskDone = task.getStatus() == Task_1.TaskStatus.DONE;
            this.internalModel.taskName = task.getName();
            this.internalModel.taskLabelClass = task.getLabelClass();
            this.internalModel.taskDescription = taskDescription;
            this.internalModel.taskType = types[task.getType()];
            this.internalModel.taskStatus = Task_1.Task.getStatusText(task.getStatus());
            this.internalModel.taskPriority = priorities[task.getPriority()];
            this.internalModel.taskAttachments = task.getAttachments();
            this.internalModel.taskAssignedToArray = this.tasksPlugin.getMembersArray(this.session, task.getAssignedTo());
            this.internalModel.taskHistory = task.getHistory();
            this.internalModel.taskGroupIds = task.getTaskGroupIds();
            this.internalModel.taskGroupNames = taskGroups.map(function (tg) { return tg.getName(); });
            this.internalModel.taskGroupsPinned = taskGroups.filter(function (tg) { return _this.isTgPinned(tg); }).map(function (tg) { return tg.getId(); });
            this.internalModel.taskGroupsIcons = taskGroups.map(function (tg) { return tg.getIcon(); });
            this.internalModel.taskComments = comments;
            this.internalModel.taskIsTrashed = task.getIsTrashed();
            this.internalModel.taskStartTimestamp = task.getStartTimestamp();
            this.internalModel.taskEndTimestamp = task.getEndTimestamp();
            this.internalModel.taskWholeDays = task.getWholeDays();
            this.internalModel.projectId = task.getProjectId();
            this.internalModel.projectName = project.getName();
            this.internalModel.projectPrefix = this.getProjectPrefix(project);
            this.internalModel.projectPublic = this.session.sectionManager.getSection(task.getProjectId()).getScope() == "public";
            this.internalModel.resolvedTaskHistory = this.resolveTaskHistory(task, types, statuses, priorities);
            this.internalModel.taskStatuses = this.getTaskStatusesFromInternalModel();
            this.internalModel.docked = this.docked;
            this.internalModel.editable = this.editable;
            this.internalModel.myAvatar = this.tasksPlugin.getMyself(this.session).id;
            this.updateInternalModelAttachmentNames();
            this.attachmentsManager.reset(task, this.session);
            if (this.internalModel.taskAttachments && this.internalModel.taskAttachments.length > 0) {
                var section_1 = this.internalModel.taskId ? this.session.sectionManager.getSection(this.internalModel.projectId) : null;
                if (section_1) {
                    if (!(section_1.getId() in this.sectionFileTreeDeferreds)) {
                        this.sectionFileTreeDeferreds[section_1.getId()] = pmc_mail_1.Q.defer();
                        pmc_mail_1.Q().then(function () {
                            return section_1.getFileTree();
                        }).then(function (tree) {
                            _this.sectionFileTreeDeferreds[section_1.getId()].resolve(tree);
                        });
                    }
                    fileTreePromise = this.sectionFileTreeDeferreds[section_1.getId()].promise.then(function (tree) {
                        if (_this.internalModel.taskId == wantedTaskId) {
                            var updateNames = {};
                            var _loop_1 = function (idx) {
                                var attStr = _this.internalModel.taskAttachments[idx];
                                var att = JSON.parse(attStr);
                                var entry = tree.collection.find(function (x) { return x.ref.did == att.did; });
                                if (entry && entry.path && pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                                    return "continue";
                                }
                                att.trashed = !entry || entry.path.indexOf("/.trash/") >= 0;
                                if (entry && entry.name != att.name) {
                                    att.name = entry.name;
                                    updateNames[att.did] = att.name;
                                }
                                _this.internalModel.taskAttachments[idx] = JSON.stringify(att);
                            };
                            for (var idx in _this.internalModel.taskAttachments) {
                                _loop_1(idx);
                            }
                            var _loop_2 = function (idx) {
                                var data = _this.internalModel.resolvedTaskHistory[idx];
                                if (data.arg != "attachment" || (!data.newAttachment && !data.oldAttachment)) {
                                    return "continue";
                                }
                                var key = data.newAttachment ? "newAttachment" : "oldAttachment";
                                var att = JSON.parse(data[key]);
                                var entry = tree.collection.find(function (x) { return x.ref.did == att.did; });
                                if (entry && entry.path && pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                                    return "continue";
                                }
                                data.isAttachmentTrashed = !entry || entry.path.indexOf("/.trash/") >= 0;
                            };
                            for (var idx in _this.internalModel.resolvedTaskHistory) {
                                _loop_2(idx);
                            }
                            var updateNamesStr = JSON.stringify(updateNames);
                            if (updateNamesStr != "{}") {
                                _this.callViewMethod("updateAttachmentNames", updateNamesStr);
                            }
                        }
                    });
                }
            }
            this.updateCustomSelects(task.getProjectId(), taskGroupsIds, task.getAssignedTo(), task.getType(), Task_1.Task.getStatuses().indexOf(task.getStatus()), task.getPriority());
        }
        else if (this.taskId === false) {
            this.internalModel.taskId = false;
            this.internalModel.taskGroupIds = [];
            this.internalModel.taskGroupNames = [];
            this.internalModel.taskGroupsPinned = [];
            this.internalModel.taskGroupsIcons = [];
            this.internalModel.myAvatar = this.tasksPlugin.getMyself(this.session).id;
            this.internalModel.taskIsTrashed = false;
            this.internalModel.taskStartTimestamp = this.defaultDateTime ? this.defaultDateTime.getTime() : null;
            this.internalModel.taskEndTimestamp = this.defaultDateTime ? (this.defaultDateTime.getTime() + 3600000) : null;
            this.internalModel.taskWholeDays = false;
        }
        else if (this.newTask) {
            var taskGroupsIds = this.newTaskTaskGroupIds.filter(function (id) { return id in _this.tasksPlugin.taskGroups[_this.session.hostHash]; });
            var taskGroups = taskGroupsIds.map(function (id) { return _this.tasksPlugin.taskGroups[_this.session.hostHash][id]; });
            var project = this.newTaskProject;
            this.internalModel.canRemoveFromCalendar = project ? this.tasksPlugin.isTasksPluginEnabledInSection(this.session, project.getId()) : true;
            this.internalModel.taskId = "";
            this.internalModel.taskDone = false;
            this.internalModel.taskName = "";
            this.internalModel.taskLabelClass = "";
            this.internalModel.taskDescription = "";
            this.internalModel.taskType = "";
            this.internalModel.taskStatus = "";
            this.internalModel.taskPriority = "";
            this.internalModel.taskAttachments = [];
            this.internalModel.taskAssignedToArray = this.tasksPlugin.getPeople(this.session, this.assignTo);
            this.internalModel.taskHistory = [];
            this.internalModel.taskGroupIds = taskGroupsIds;
            this.internalModel.taskGroupNames = taskGroups.map(function (tg) { return tg.getName(); });
            this.internalModel.taskGroupsPinned = taskGroups.filter(function (tg) { return _this.isTgPinned(tg); }).map(function (tg) { return tg.getId(); });
            this.internalModel.taskGroupsIcons = taskGroups.map(function (tg) { return tg.getIcon(); });
            this.internalModel.taskComments = [];
            this.internalModel.taskIsTrashed = false;
            this.internalModel.taskStartTimestamp = this.defaultDateTime ? this.defaultDateTime.getTime() : null;
            this.internalModel.taskEndTimestamp = this.defaultDateTime ? (this.defaultDateTime.getTime() + 3600000) : null;
            this.internalModel.taskWholeDays = !!this.result.wholeDays;
            this.internalModel.projectId = project ? project.getId() : null;
            this.internalModel.projectName = project ? project.getName() : "";
            this.internalModel.projectPrefix = this.getProjectPrefix(project);
            this.internalModel.projectPublic = project ? this.session.sectionManager.getSection(project.getId()).getScope() == "public" : true;
            this.internalModel.resolvedTaskHistory = [];
            this.internalModel.taskStatuses = {};
            this.internalModel.docked = this.docked;
            this.internalModel.editable = this.editable;
            this.internalModel.myAvatar = this.tasksPlugin.getMyself(this.session).id;
            this.resetAttachmentsUsingInitial();
            if (!this.tasksPlugin.recentlyUsedTaskProperties) {
                this.tasksPlugin.recentlyUsedTaskProperties = {
                    type: project ? project.getDefaultTaskTypeId() : 2,
                    status: Task_1.Task.getStatuses().indexOf(Task_1.Task.getDefaultStatus()),
                    priority: project ? project.getDefaultTaskPriorityId() : 2,
                };
            }
            var defaults = this.tasksPlugin.recentlyUsedTaskProperties;
            this.result.type = defaults.type;
            this.result.status = defaults.status;
            this.result.priority = defaults.priority;
            this.updateCustomSelects(project ? project.getId() : null, taskGroupsIds, this.assignTo, defaults.type, defaults.status, defaults.priority);
            this.internalModel.hasTask = true;
        }
        else {
            this.internalModel.taskId = null;
            this.internalModel.taskGroupIds = [];
            this.internalModel.taskGroupNames = [];
            this.internalModel.taskGroupsPinned = [];
            this.internalModel.myAvatar = this.tasksPlugin.getMyself(this.session).id;
            this.internalModel.taskStartTimestamp = this.defaultDateTime ? this.defaultDateTime.getTime() : null;
            this.internalModel.taskEndTimestamp = this.defaultDateTime ? (this.defaultDateTime.getTime() + 3600000) : null;
            this.internalModel.taskWholeDays = false;
        }
        var prom = allCommentsLoaded ? pmc_mail_1.Q() : this.fetchTaskComments(task);
        if (fileTreePromise) {
            prom = prom.then(function () { return fileTreePromise; });
        }
        prom.then(function () {
            if (_this.taskId != wantedTaskId) {
                return;
            }
            if (!allCommentsLoaded) {
                _this.internalModel.taskComments = _this.resolveTaskComments(_this.session, task).comments;
            }
            if (!noViewCall) {
                _this.callViewMethod("update", JSON.stringify(_this.getModel()), dontDisturb, comment, dataChanged);
            }
        });
    };
    TaskPanelController.prototype.updateInternalModelAttachmentNames = function () {
        if (!this.internalModel || !this.internalModel.taskAttachments) {
            return;
        }
        var section = this.internalModel.taskId ? this.session.sectionManager.getSection(this.internalModel.projectId) : null;
        if (!section || !section.getFileModule() || !section.getFileModule().fileTree) {
            return;
        }
        var fileTree = section.getFileModule().fileTree;
        var fileNamesByDid = {};
        fileTree.collection.list.forEach(function (x) { return fileNamesByDid[x.ref.did] = x.name; });
        var atts = this.internalModel.taskAttachments;
        for (var i = 0; i < atts.length; ++i) {
            var att = JSON.parse(atts[i]);
            if (att.did in fileNamesByDid && fileNamesByDid[att.did] != att.name) {
                att.name = fileNamesByDid[att.did];
                atts[i] = JSON.stringify(att);
            }
        }
    };
    TaskPanelController.prototype.isTgPinned = function (tg) {
        var proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
        if (proj) {
            return proj.getPinnedTaskGroupIds().indexOf(tg.getId()) >= 0;
        }
        return false;
    };
    TaskPanelController.prototype.updateCustomSelectsKeepSelection = function (projectId) {
        if (!(projectId in this.tasksPlugin.projects[this.session.hostHash])) {
            return;
        }
        var proj = this.tasksPlugin.projects[this.session.hostHash][projectId];
        var tgs = proj.getTaskGroupIds();
        var taskGroupIds = this.customSelectTaskGroup.items.filter(function (it) { return it.type == "item" && it.selected && tgs.indexOf(it.value) >= 0; }).map(function (it) { return it.value; });
        var assignedTo = this.customSelectAssignedTo.items.filter(function (it) { return it.type == "item" && it.selected; }).map(function (it) { return it.value; });
        var type = parseInt(this.customSelectType.items.filter(function (it) { return it.type == "item" && it.selected; }).map(function (it) { return it.value; })[0]);
        var status = parseInt(this.customSelectStatus.items.filter(function (it) { return it.type == "item" && it.selected; }).map(function (it) { return it.value; })[0]);
        var priority = parseInt(this.customSelectPriority.items.filter(function (it) { return it.type == "item" && it.selected; }).map(function (it) { return it.value; })[0]);
        this.updateCustomSelects(projectId, taskGroupIds, assignedTo, type, status, priority);
    };
    TaskPanelController.prototype.updateCustomSelects = function (projectId, taskGroupIds, assignedTo, type, status, priority) {
        this.updateCustomSelectProjectItems(projectId);
        this.updateCustomSelectTaskGroupItems(projectId, taskGroupIds);
        this.updateCustomSelectAssignedToItems(projectId, assignedTo);
        this.updateCustomSelectTaskTypeItems(projectId, type);
        this.updateCustomSelectTaskStatusItems(projectId, status);
        this.updateCustomSelectTaskPriorityItems(projectId, priority);
        this.callViewMethod("updateAddAttachmentButton");
    };
    TaskPanelController.prototype.updateCustomSelectProjectItems = function (selectedProjectId) {
        var items = [];
        var availProjects = this.tasksPlugin.getAvailableProjects(this.session);
        for (var k in availProjects) {
            var proj = availProjects[k];
            var icon = void 0;
            if (proj.getId().substr(0, 8) == "private:") {
                var id = this.tasksPlugin.getMyId(this.session);
                icon = {
                    type: "avatar",
                    hashmail: id,
                };
            }
            else {
                icon = {
                    type: "asset",
                    assetName: "DEFAULT_PRIVMX_ICON",
                };
            }
            var pubSection = false;
            var section = null;
            for (var _i = 0, _a = this.tasksPlugin.tasksSectionsCollection[this.session.hostHash].list; _i < _a.length; _i++) {
                var entry = _a[_i];
                if (entry.key.sectionId == proj.getId()) {
                    pubSection = entry.getScope() == "public";
                    section = entry;
                    break;
                }
            }
            var extraClasses = [];
            var extraAttributes = {};
            if (!pubSection) {
                icon.noBackground = true;
                icon.withBorder = true;
            }
            if (section && !section.isPrivateOrUserGroup()) {
                extraAttributes["data-section-id"] = section.getId();
            }
            var projectPrefix = null;
            var projectName = this.escapeHtml(proj.getName());
            if (section && !section.isPrivate()) {
                projectPrefix = this.escapeHtml(section.getFullSectionName(true, true));
            }
            items.push({
                type: "item",
                icon: icon,
                value: k,
                text: projectPrefix ? ("<span class='project-full-name'><span class='project-prefix'>" + projectPrefix + "</span><span class='project-name'>" + projectName + "</span></span>") : projectName,
                selected: k == selectedProjectId,
                extraClass: extraClasses.join(" "),
                extraAttributes: extraAttributes,
                textNoEscape: true,
            });
        }
        this.customSelectProject.setItems(items);
    };
    TaskPanelController.prototype.updateCustomSelectTaskGroupItems = function (projectId, taskGroupsIds) {
        var _this = this;
        if (!projectId) {
            this.customSelectTaskGroup.setItems([]);
            return;
        }
        var taskGroups = taskGroupsIds.map(function (id) { return _this.tasksPlugin.taskGroups[_this.session.hostHash][id]; });
        var project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        var items = [];
        var isOrph = taskGroups.length == 0 || (taskGroups.length == 1 && taskGroups[0].getId() == "__orphans__");
        if (isOrph) {
            this.customSelectTaskGroup.value = "__orphans__";
            this.result.taskGroupIds = ["__orphans__"];
        }
        var noDetachedTgs = true;
        for (var _i = 0, taskGroupsIds_1 = taskGroupsIds; _i < taskGroupsIds_1.length; _i++) {
            var tgId = taskGroupsIds_1[_i];
            var tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
            if (tg && tg.getDetached()) {
                noDetachedTgs = false;
                break;
            }
        }
        var tgs = project.getTaskGroupIds()
            .map(function (k) { return _this.tasksPlugin.getTaskGroup(_this.session, k); })
            .filter(function (tg) { return tg && (!noDetachedTgs || !tg.getDetached()); })
            .sort(this.taskGroupComparator.bind(this));
        for (var _a = 0, tgs_1 = tgs; _a < tgs_1.length; _a++) {
            var tg = tgs_1[_a];
            var tgId = tg.getId();
            if (tg && (!noDetachedTgs || !tg.getDetached())) {
                var proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
                var pinned = (proj ? proj.getPinnedTaskGroupIds().indexOf(tg.getId()) >= 0 : false);
                var icon = null;
                var iconRaw = tg.getIcon();
                if (iconRaw) {
                    icon = {
                        type: "badgeIcon",
                        modelJsonStr: iconRaw,
                        noFixedSize: true,
                        noBackground: true,
                    };
                }
                items.push({
                    type: "item",
                    icon: icon,
                    value: tgId,
                    text: tg.getName(),
                    selected: taskGroupsIds.indexOf(tgId) >= 0,
                    extraClass: "taskgroup-label" + (pinned ? " pinned" : ""),
                });
            }
        }
        items.push({
            type: "item",
            icon: {
                type: "fontAwesome",
                iconName: "plus",
                noBackground: true,
                noFixedSize: true,
            },
            value: "__new_taskgroup__",
            text: this.i18n("plugin.tasks.component.taskPanel.newTaskGroup"),
            selected: null,
            actionId: Types_1.CREATE_NEW_TASKGROUP_ACTION,
        });
        this.customSelectTaskGroup.setItems(items);
    };
    TaskPanelController.prototype.escapeHtml = function (str) {
        if (str == null) {
            return "";
        }
        var entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        var ss = typeof (str) == "string" ? str : str.toString();
        return ss.replace(/[&<>"'`=\/]/g, function (s) {
            return entityMap[s];
        });
    };
    TaskPanelController.prototype.secondComparator = function (a, b, firstVal) {
        if (firstVal != 0) {
            return firstVal;
        }
        return parseInt(b.getId()) - parseInt(a.getId());
    };
    TaskPanelController.prototype.taskGroupComparator = function (a, b) {
        if ((a.getId() != "__orphans__" && !this.tasksPlugin.taskGroups[this.session.hostHash][a.getId()]) || (b.getId() != "__orphans__" && !this.tasksPlugin.taskGroups[this.session.hostHash][b.getId()])) {
            return (parseInt(b.getId()) - parseInt(a.getId()));
        }
        if (a.getDetached() && !b.getDetached()) {
            return 1;
        }
        if (!a.getDetached() && b.getDetached()) {
            return -1;
        }
        var proj = this.tasksPlugin.projects[this.session.hostHash][a.getProjectId()];
        var ap = (proj ? proj.getPinnedTaskGroupIds().indexOf(a.getId()) >= 0 : false) ? 1 : 0;
        var bp = (proj ? proj.getPinnedTaskGroupIds().indexOf(b.getId()) >= 0 : false) ? 1 : 0;
        if ((ap && !bp) || !ap && bp) {
            return bp - ap;
        }
        if (proj) {
            var order = proj.getTaskGroupsOrder();
            var ai = order.indexOf(a.getId());
            var bi = order.indexOf(b.getId());
            if (ai == -1 || bi == -1) {
                proj.syncTaskGroupsIdsOrder(this.tasksPlugin.taskGroups[this.session.hostHash]);
                order = proj.getTaskGroupsOrder();
                ai = order.indexOf(a.getId());
                bi = order.indexOf(b.getId());
            }
            return this.secondComparator(a, b, ai - bi);
        }
        return parseInt(b.getId()) - parseInt(a.getId());
    };
    TaskPanelController.prototype.updateCustomSelectAssignedToItems = function (projectId, assignedTo) {
        var items = [];
        var members = this.tasksPlugin.getProjectMembers(this.session, projectId);
        var section = this.session.sectionManager.getSection(projectId);
        var limitToUsers = null;
        if (!this.session.conv2Service) {
        }
        if (section) {
            limitToUsers = section.sectionData.group.users.slice();
            if (section.sectionData.group.type == "local") {
                for (var key in this.session.conv2Service.personService.persons.map) {
                    var person = this.session.conv2Service.personService.persons.map[key];
                    if (person.contact && person.username.indexOf("@") < 0) {
                        limitToUsers.push(person.username);
                    }
                }
            }
            if (limitToUsers && limitToUsers.length == 0) {
                limitToUsers = null;
            }
        }
        if (limitToUsers) {
            for (var _i = 0, assignedTo_1 = assignedTo; _i < assignedTo_1.length; _i++) {
                var id = assignedTo_1[_i];
                var id2 = id.split("#")[0];
                if (limitToUsers.indexOf(id2) < 0) {
                    limitToUsers.push(id2);
                }
            }
        }
        for (var k in members) {
            var p = members[k];
            if (p.deleted) {
                if (!this.taskId) {
                    continue;
                }
                else if (assignedTo.indexOf(p.id) < 0) {
                    continue;
                }
            }
            if (limitToUsers && limitToUsers.indexOf(p.id.split("#")[0]) < 0) {
                continue;
            }
            items.push({
                type: "item",
                icon: { type: "avatar", hashmail: p.id },
                value: k,
                text: p.name,
                selected: assignedTo.indexOf(p.id) >= 0,
            });
        }
        this.customSelectAssignedTo.setItems(items);
    };
    TaskPanelController.prototype.updateCustomSelectSimpleItems = function (cs, data, selectedIdx, extraClass) {
        if (extraClass === void 0) { extraClass = ""; }
        var items = [];
        var taskId = this.taskId ? this.taskId : "";
        var isStatus = cs == this.customSelectStatus;
        for (var k in data) {
            var item = {
                type: "item",
                icon: null,
                value: k,
                text: isStatus ? Task_1.Task.getStatusText(data[k]) : data[k],
                selected: k == selectedIdx,
                extraClass: extraClass,
            };
            if (extraClass == "task-label") {
                item.extraArg = {
                    labelClass: Task_1.Task.getLabelClass(data[k]),
                    taskId: taskId,
                };
                item.customTemplateName = Types_1.CUSTOM_SELECT_CUSTOM_TEMPLATE_TASK_STATUS;
            }
            items.push(item);
        }
        cs.setItems(items);
    };
    TaskPanelController.prototype.updateCustomSelectTaskTypeItems = function (projectId, selectedIdx) {
        var project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        this.updateCustomSelectSimpleItems(this.customSelectType, project ? project.getTaskTypes(true, true) : this.tasksPlugin.getTaskTypes(), selectedIdx);
    };
    TaskPanelController.prototype.updateCustomSelectTaskStatusItems = function (projectId, selectedIdx) {
        this.updateCustomSelectSimpleItems(this.customSelectStatus, Task_1.Task.getStatuses(), selectedIdx, "task-label");
    };
    TaskPanelController.prototype.updateCustomSelectTaskPriorityItems = function (projectId, selectedIdx) {
        var project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        this.updateCustomSelectSimpleItems(this.customSelectPriority, project ? project.getTaskPriorities(true, true) : this.tasksPlugin.getTaskPriorities(), selectedIdx);
    };
    TaskPanelController.prototype.fetchTaskComments = function (task) {
        var _this = this;
        var toLoad = {};
        var msgs = [];
        task.getCommentTags().forEach(function (x) {
            var msgData = x.split("/");
            if (msgData.length < 2) {
                return;
            }
            var sinkId = msgData[0];
            var msgId = Number(msgData[1]);
            if (!(sinkId in toLoad)) {
                toLoad[sinkId] = [];
            }
            toLoad[sinkId].push(msgId);
            msgs.push(msgId);
        });
        return pmc_mail_1.Q().then(function () {
            var section = _this.session.sectionManager.getSection(task.getProjectId());
            return section.getChatModule().getSinkIndex().then(function (index) { return index.loadMessages(msgs); });
        });
    };
    TaskPanelController.prototype.getMessageEntryById = function (id, sinkId) {
        var index = this.sinkIndexManager.getIndexBySinkId(sinkId);
        return index ? index.getEntry(id) : null;
    };
    TaskPanelController.prototype.resolveTaskCommentsPreVersion18 = function (session, task) {
        var _this = this;
        var comments = [];
        var msgIds = task.getCommentTags();
        var allLoaded = true;
        msgIds.forEach(function (x) {
            var commentTag = x;
            var msgData = x.split("/");
            if (msgData.length < 2) {
                return;
            }
            var sinkId = msgData[0];
            var msgId = Number(msgData[1]);
            var entry = _this.getMessageEntryById(msgId, sinkId);
            if (!entry) {
                allLoaded = false;
                return;
            }
            var message = entry.getMessage();
            var commentMessage = JSON.parse(entry.source.data.text);
            var person = _this.tasksPlugin.getPerson(session, commentMessage.who);
            var commentText = commentMessage.comment;
            if (commentMessage.metaDataStr) {
                var metaData = pmc_mail_1.utils.ContentEditableEditorMetaData.fromString(commentMessage.metaDataStr);
                commentText = metaData.attach(commentText);
            }
            var comment = {
                dateTime: message.createDate.getTime(),
                message: commentText,
                userAvatar: person.avatar,
                userName: person.name,
                userHashmail: person.id,
                relatedCommentTag: commentTag,
            };
            comments.push(comment);
        });
        return comments;
    };
    TaskPanelController.prototype.resolveTaskComments = function (session, task) {
        var comments = [];
        var fromSerialized = task.getComments();
        for (var _i = 0, fromSerialized_1 = fromSerialized; _i < fromSerialized_1.length; _i++) {
            var t = fromSerialized_1[_i];
            var person = this.tasksPlugin.getPerson(session, t.userHashmail);
            var commentText = t.body.comment;
            if (t.body.metaDataStr) {
                var metaData = pmc_mail_1.utils.ContentEditableEditorMetaData.fromString(t.body.metaDataStr);
                commentText = metaData.attach(commentText);
            }
            var comment = {
                dateTime: t.dateTime,
                message: commentText,
                userAvatar: t.userHashmail,
                userName: person.name,
                userHashmail: t.userHashmail,
                relatedCommentTag: t.relatedCommentTag,
            };
            comments.push(comment);
        }
        var oldComments = this.resolveTaskCommentsPreVersion18(this.session, task);
        Utils_1.Utils.uniqueArrayMerge(comments, oldComments, function (a, b) {
            return a.relatedCommentTag && b.relatedCommentTag && a.relatedCommentTag == b.relatedCommentTag;
        });
        return { allLoaded: true, comments: comments };
    };
    TaskPanelController.prototype.resolveTaskHistory = function (task, types, statuses, priorities) {
        var _this = this;
        var arr = [];
        var i18nOrphansL = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.moved.orphansL");
        var i18nOrphansR = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.moved.orphansR");
        var i18nUnknown = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.moved.unknown");
        var fMakePerson = function (person) {
            return "{!{BEGIN_PERSON}!}" + person.avatar + "|||" + person.name + "|||" + person.id + "{!{END_PERSON}!}";
        };
        var fMakeAtt = function (attStr) {
            var att = JSON.parse(attStr);
            return "{!{BEGIN_ATTACHMENT}!}" + att.did + "|||" + att.name + "{!{END_ATTACHMENT}!}";
        };
        var fMakeStartTimestamp = function (ts) {
            if (!ts) {
                return _this.i18n("plugin.tasks.component.taskPanel.task.startTimestamp.none");
            }
            return "{!{BEGIN_STARTTS}!}" + ts.toString() + "{!{END_STARTTS}!}";
        };
        var fMakeDuration = function (ts) {
            if (!ts) {
                return _this.i18n("plugin.tasks.component.taskPanel.task.duration.none");
            }
            return "{!{BEGIN_DURATION}!}" + ts.toString() + "{!{END_DURATION}!}";
        };
        var _loop_3 = function (entry) {
            var who = this_1.tasksPlugin.getPerson(this_1.session, entry.who);
            var newEntry = {
                when: entry.when,
                who: who,
                what: entry.what,
                arg: entry.arg,
            };
            if (entry.what == "moved") {
                var fMakeLabel_1 = function (tg) {
                    var proj = _this.tasksPlugin.projects[_this.session.hostHash][tg.getProjectId()];
                    var pinned = (proj ? proj.getPinnedTaskGroupIds().indexOf(tg.getId()) >= 0 : false);
                    return "{!{BEGIN_TG_LABEL}!}" + tg.getId() + "|||" + tg.getName() + "|||" + (pinned ? 1 : 0) + "|||" + tg.getIcon() + "{!{END_TG_LABEL}!}";
                };
                var fGetStr = function (obj) {
                    if (!obj) {
                        return null;
                    }
                    if (typeof (obj) == "object") {
                        return obj
                            .filter(function (id) { return id in _this.tasksPlugin.taskGroups[_this.session.hostHash]; })
                            .map(function (id) { return _this.tasksPlugin.taskGroups[_this.session.hostHash][id]; })
                            .map(fMakeLabel_1).join("");
                    }
                    else {
                        return (obj in _this.tasksPlugin.taskGroups[_this.session.hostHash] ? _this.tasksPlugin.taskGroups[_this.session.hostHash][obj].getName() : null);
                    }
                };
                newEntry.oldString = fGetStr(entry.oldVal);
                newEntry.newString = fGetStr(entry.newVal);
                if (!newEntry.oldString) {
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.movedAdded", fMakePerson(who), newEntry.newString ? newEntry.newString : i18nOrphansR);
                }
                else {
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.moved", fMakePerson(who), newEntry.oldString ? newEntry.oldString : i18nOrphansL, newEntry.newString ? newEntry.newString : i18nOrphansR);
                    if (newEntry.oldString === newEntry.newString) {
                        newEntry = null;
                    }
                }
            }
            else if (entry.what == "modified") {
                if (entry.arg == "priority" || entry.arg == "type") {
                    return "continue";
                }
                if (entry.arg == "description") {
                    newEntry.oldString = entry.oldVal;
                    newEntry.newString = entry.newVal;
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedDescription", fMakePerson(who));
                }
                else if (entry.arg == "name") {
                    newEntry.oldString = entry.oldVal;
                    newEntry.newString = entry.newVal;
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedName", fMakePerson(who), newEntry.oldString, newEntry.newString);
                }
                else if (entry.arg == "startTimestamp") {
                    newEntry.oldString = entry.oldVal;
                    newEntry.newString = entry.newVal;
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedStartTimestamp", fMakePerson(who), fMakeStartTimestamp(newEntry.oldString), fMakeStartTimestamp(newEntry.newString));
                }
                else if (entry.arg == "duration") {
                    return "continue";
                }
                else if (entry.arg == "endTimestamp") {
                    newEntry.oldString = entry.oldVal;
                    newEntry.newString = entry.newVal;
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedEndTimestamp", fMakePerson(who), fMakeStartTimestamp(newEntry.oldString), fMakeStartTimestamp(newEntry.newString));
                }
                else if (entry.arg == "wholeDays") {
                    return "continue";
                }
                else if (entry.arg == "attachment") {
                    newEntry.newAttachment = entry.newVal;
                    var modsCount = JSON.parse(newEntry.newAttachment).modsCount;
                    if (modsCount == 1) {
                        newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedAttachment", fMakePerson(who), fMakeAtt(newEntry.newAttachment));
                    }
                    else {
                        newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedAttachmentMulti", fMakePerson(who), fMakeAtt(newEntry.newAttachment), modsCount);
                    }
                }
                else if (entry.arg == "projectId") {
                    newEntry.oldString = entry.oldVal;
                    newEntry.newString = entry.newVal;
                    var f = function (id) {
                        if (id in _this.tasksPlugin.projects[_this.session.hostHash]) {
                            var name_1 = _this.tasksPlugin.projects[_this.session.hostHash][id].getName();
                            var isPublic = _this.session.sectionManager.getSection(id).getScope() == "public";
                            if (id.substr(0, 8) == "private:") {
                                var me = _this.tasksPlugin.getMyself(_this.session);
                                return fMakePerson({
                                    avatar: me.id,
                                    name: name_1,
                                    id: me.id,
                                    isBasic: me.isBasic,
                                });
                            }
                            return "{!{BEGIN_SECTION}!}" + name_1 + "|||" + (isPublic ? "public" : "") + "|||" + id + "{!{END_SECTION}!}";
                        }
                        return "<unknown>";
                    };
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedProject", fMakePerson(who), f(newEntry.oldString), f(newEntry.newString));
                }
                else {
                    if (entry.arg == "status") {
                        var fMkStatus = function (id) {
                            var s = typeof (id) == "number" ? Task_1.Task.convertStatus(id, true) : id;
                            var cls = Task_1.Task.getLabelClass(s);
                            return "{!{BEGIN_STATUS}!}" + Task_1.Task.getStatusText(s) + "|||" + cls + "{!{END_STATUS}!}";
                        };
                        var fHas = function (id) {
                            var s = typeof (id) == "number" ? Task_1.Task.convertStatus(id, true) : id;
                            return statuses.indexOf(s) >= 0;
                        };
                        newEntry.oldString = fHas(entry.oldVal) ? fMkStatus(entry.oldVal) : i18nUnknown;
                        newEntry.newString = fHas(entry.newVal) ? fMkStatus(entry.newVal) : i18nUnknown;
                    }
                    var entryArg = entry.arg[0].toUpperCase() + entry.arg.substr(1);
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.modified" + entryArg, fMakePerson(who), newEntry.oldString, newEntry.newString);
                }
            }
            else if (entry.what == "added") {
                if (entry.arg == "attachment") {
                    newEntry.newAttachment = entry.newVal;
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.addedAttachment", fMakePerson(who), fMakeAtt(newEntry.newAttachment));
                }
                else if (entry.arg == "person") {
                    newEntry.newPerson = this_1.tasksPlugin.getPerson(this_1.session, entry.newVal);
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.addedPerson", fMakePerson(who), fMakePerson(newEntry.newPerson));
                }
            }
            else if (entry.what == "removed") {
                if (entry.arg == "attachment") {
                    newEntry.oldAttachment = entry.oldVal;
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.removedAttachment", fMakePerson(who), fMakeAtt(newEntry.oldAttachment));
                }
                else if (entry.arg == "person") {
                    newEntry.oldPerson = this_1.tasksPlugin.getPerson(this_1.session, entry.oldVal);
                    newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.removedPerson", fMakePerson(who), fMakePerson(newEntry.oldPerson));
                }
            }
            else if (entry.what == "created") {
                newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.created", fMakePerson(who));
            }
            else if (entry.what == "trashed") {
                newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.trashed", fMakePerson(who));
            }
            else if (entry.what == "restored") {
                newEntry.message = this_1.i18n("plugin.tasks.component.taskPanel.task.history.entry.restored", fMakePerson(who));
            }
            if (newEntry !== null) {
                arr.push(newEntry);
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = task.getHistory(); _i < _a.length; _i++) {
            var entry = _a[_i];
            _loop_3(entry);
        }
        return arr;
    };
    TaskPanelController.prototype.setTaskId = function (session, taskId, project, taskGroupIds, assignTo, scrollToComments, newTask, dateTime, wholeDay) {
        var _this = this;
        if (project === void 0) { project = null; }
        if (taskGroupIds === void 0) { taskGroupIds = []; }
        if (assignTo === void 0) { assignTo = []; }
        if (scrollToComments === void 0) { scrollToComments = false; }
        if (newTask === void 0) { newTask = false; }
        if (dateTime === void 0) { dateTime = null; }
        if (wholeDay === void 0) { wholeDay = false; }
        this.session = session;
        this.confirmExit = true;
        this.defaultDateTime = dateTime;
        if (dateTime) {
            this.result.startTimestamp = dateTime.getTime();
            this.result.endTimestamp = this.result.startTimestamp + 3600000;
        }
        this.result.wholeDays = !!wholeDay;
        var _task = this.tasksPlugin.tasks[session.hostHash][taskId];
        var section = _task ? session.sectionManager.getSection(_task.getProjectId()) : null;
        if (section && !(section.getId() in this.sectionFileTreeDeferreds)) {
            this.sectionFileTreeDeferreds[section.getId()] = pmc_mail_1.Q.defer();
            pmc_mail_1.Q().then(function () {
                return section.getFileTree();
            }).then(function (tree) {
                _this.sectionFileTreeDeferreds[section.getId()].resolve(tree);
            });
        }
        this.dirty = false;
        this.modifiedPropertyNames = [];
        this.onViewDirtyChanged(false, "[]");
        this.callViewMethod("setDirty", false);
        if (this.taskId != taskId && this.editable && this.docked) {
            this.toggleEditable();
        }
        if (taskId && taskId in this.tasksPlugin.tasks[session.hostHash]) {
            var task = this.tasksPlugin.tasks[session.hostHash][taskId];
            this.origHistoryLength = task.getHistory().length;
            if (this.tasksPlugin.wasTaskUnread(session, task, task.getProjectId()) && this.app.userPreferences.getAutoMarkAsRead()) {
                this.tasksPlugin.markTaskAsWatched(session, taskId, task.getProjectId());
                this.app.dispatchEvent({
                    type: "badges-update-request",
                });
            }
            this.historyManager.setIsNewTask(false);
            this.attachmentsManager.reset(task, this.session);
        }
        else {
            this.historyManager.setIsNewTask(true);
            this.resetAttachmentsUsingInitial();
        }
        this.assignTo = assignTo;
        this.scrollToComments = scrollToComments;
        if (taskId === null && newTask) {
            this.taskId = null;
            this.newTask = true;
            this.newTaskProject = project;
            this.newTaskTaskGroupIds = taskGroupIds;
            this.result.assignedTo = assignTo ? [this.tasksPlugin.getMyId(this.session)] : [];
            this.result.attachments = [];
            this.result.description = "";
            this.result.name = "";
            this.result.priority = project ? project.getDefaultTaskPriorityId() : 2;
            this.result.status = Task_1.Task.getStatuses().indexOf(Task_1.Task.getDefaultStatus());
            this.result.taskGroupIds = taskGroupIds;
            this.result.type = project ? project.getDefaultTaskTypeId() : 2;
            this.result.projectId = project ? project.getId() : null;
            this.updateView(false, true);
            return;
        }
        if (taskId == this.taskId) {
            return;
        }
        if (this.taskId) {
            this.tasksPlugin.unWatch(this.session, "task", this.taskId, "*", this.dataChangedListener);
            this.clearTreeCollectionWatcher();
        }
        this.taskId = taskId;
        if (this.taskId) {
            this.tasksPlugin.watch(this.session, "task", this.taskId, "*", this.dataChangedListener);
            this.watchTreeCollection();
            this.updateResultFromTask();
        }
        this.updateView(false, true);
    };
    TaskPanelController.prototype.updateResultFromTask = function () {
        if (this.taskId) {
            var task = this.tasksPlugin.getTask(this.session, this.taskId);
            if (task) {
                this.attachmentsManager.reset(task, this.session);
                this.result = {
                    assignedTo: task.getAssignedTo(),
                    attachments: task.getAttachments(),
                    description: task.getDescription(),
                    name: task.getName(),
                    priority: task.getPriority(),
                    status: Task_1.Task.getStatuses().indexOf(task.getStatus()),
                    taskGroupIds: task.getTaskGroupIds(),
                    type: task.getType(),
                    projectId: task.getProjectId(),
                    startTimestamp: task.getStartTimestamp(),
                    endTimestamp: task.getEndTimestamp(),
                    wholeDays: task.getWholeDays(),
                };
            }
        }
    };
    TaskPanelController.prototype.onDataChanged = function (type, id, action) {
        if (action == "deleted") {
            this.deleted = true;
            if (!this.docked) {
                this.requestParentClose();
            }
            return;
        }
        this.updateView(false, false, null, false, true);
    };
    TaskPanelController.prototype.onTaskGroupChanged = function (type, id, action) {
        var task = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
        if (task) {
            var tgIds = task.getTaskGroupIds();
            if (tgIds.indexOf(id) >= 0) {
                var tg = this.tasksPlugin.taskGroups[this.session.hostHash][id];
                if (tg) {
                    var proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
                    var pinned = false;
                    if (proj) {
                        pinned = proj.getPinnedTaskGroupIds().indexOf(id) >= 0;
                    }
                    this.callViewMethod("updateTaskGroupBadge", tg.getId(), tg.getName(), tg.getIcon(), pinned);
                }
            }
        }
    };
    TaskPanelController.prototype.onTaskChanged = function (type, id, action) {
        var task = this.tasksPlugin.tasks[this.session.hostHash][id];
        if (task) {
            this.callViewMethod("updateTaskBadge", task.getId(), Task_1.Task.getLabelClass(task.getStatus()));
        }
    };
    TaskPanelController.prototype.beforeClose = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (_this.confirmExit && _this.dirty) {
                return _this.closeConfirm();
            }
            return true;
        })
            .then(function (close) {
            if (close) {
                _this.tasksPlugin.offWatchedTasksHistoryRebuild(_this.watchedTasksHistoryRebuildHandlerBound);
                _this.tasksPlugin.offWatchedTasksHistorySet(_this.watchedTasksHistorySetHandlerBound);
                if (_this.taskId) {
                    _this.tasksPlugin.unWatch(_this.session, "task", _this.taskId, "*", _this.dataChangedListener);
                    _this.tasksPlugin.unWatch(_this.session, "taskGroup", "*", "modified", _this.onTaskGroupChangedListener);
                    _this.tasksPlugin.unWatch(_this.session, "task", "*", "modified", _this.onTaskChangedListener);
                    _this.clearTreeCollectionWatcher();
                }
            }
            return close;
        });
    };
    TaskPanelController.prototype.closeConfirm = function () {
        var _this = this;
        var defer = pmc_mail_1.Q.defer();
        pmc_mail_1.Q().then(function () {
            return _this.handlers.confirmEx({
                message: _this.i18n("plugin.tasks.component.taskPanel.unsavedChanges.message"),
                yes: {
                    faIcon: "trash",
                    btnClass: "btn-warning",
                    label: _this.i18n("plugin.tasks.component.taskPanel.unsavedChanges.discard")
                },
                no: {
                    faIcon: "",
                    btnClass: "btn-default",
                    label: _this.i18n("plugin.tasks.component.taskPanel.unsavedChanges.cancel")
                }
            })
                .then(function (result) {
                defer.resolve(result.result == "yes");
            });
        });
        return defer.promise;
    };
    TaskPanelController.prototype.onViewEditClick = function (comment) {
        if (this.internalModel.docked) {
            this.toggleEditable();
        }
        else {
        }
        this.updateView(false, true, comment);
    };
    TaskPanelController.prototype.onViewOpenAttachment = function (did, editable) {
        var _this = this;
        var section;
        if (!(this.taskId in this.tasksPlugin.tasks[this.session.hostHash]) || this.taskId == false) {
            var att = this.attachmentsManager.find(did);
            section = this.session.sectionManager.getSection(att.currentSectionId);
            if (!section) {
                return;
            }
        }
        else {
            var t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
            section = this.session.sectionManager.getSection(t.getProjectId());
        }
        if (!section.hasFileModule()) {
            return;
        }
        pmc_mail_1.Q().then(function () {
            return section.getFileTree();
        })
            .then(function (tree) {
            if (tree.collection.list.filter(function (x) { return x.ref.did == did; }).length == 0) {
                throw "File doesn't exist";
            }
            return tree.getPathFromDescriptor(did);
        })
            .then(function (path) {
            if (path.indexOf("/.trash/") >= 0 || pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(path)) {
                throw "File doesn't exist";
            }
            return section.getFileOpenableElement(path, false);
        })
            .then(function (openableFile) {
            _this.app.shellRegistry.shellOpen({
                session: _this.session,
                element: openableFile,
                action: editable ? pmc_mail_1.app.common.shelltypes.ShellOpenAction.OPEN : pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW
            });
        }).fail(function () {
            _this.handlers.alert(_this.parent.i18n("plugin.tasks.component.taskPanel.fileDoesntExist"));
        });
    };
    TaskPanelController.prototype.onViewSaveEditClick = function (description, comment, closeAfterSaving) {
        var _this = this;
        this.modifiedPropertyNames = [];
        this.onViewDirtyChanged(false, "[]");
        if (description.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
            return;
        }
        if (!this.result.projectId) {
            return;
        }
        this.result.description = description;
        pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.encryptionEffectTaskText.show(description, _this.getEncryptedTaskText.bind(_this)),
                comment ? _this.encryptionEffectCommentText.show(comment, _this.getEncryptedCommentText.bind(_this)) : pmc_mail_1.Q.resolve(),
            ]);
        }).then(function () {
            return _this.saveChanges();
        }).then(function () {
            if (comment) {
                return _this.addComment(comment);
            }
        }).then(function () {
            if (_this.docked) {
                _this.toggleEditable();
                _this.updateView(false, true);
                return;
            }
            if (_this.openedAsEditable && closeAfterSaving) {
                _this.requestParentClose(false);
            }
            else {
                _this.updateView(false, true);
                _this.notify("taskModified");
            }
        }).fail(function (e) {
            _this.callViewMethod("restoreTexts", description, comment);
            if (e == "conflict") {
                _this.requestParentAlert(_this.i18n("plugin.tasks.component.taskPanel.conflictDuringSaving"));
            }
        });
    };
    TaskPanelController.prototype.onViewCancelEditClick = function () {
        this.triggerCancelled();
        this.attachmentsManager.reset(this.tasksPlugin.tasks[this.session.hostHash][this.taskId], this.session);
        if (this.docked) {
            this.setTaskId(this.session, this.taskId);
            this.updateResultFromTask();
            this.toggleEditable();
            this.updateView(false, true);
            return;
        }
        if (this.newTask) {
            this.requestParentClose(false);
            return;
        }
        this.updateResultFromTask();
        if (this.openedAsEditable) {
            this.requestParentClose(false);
        }
        else {
            this.updateView(false, true);
        }
    };
    TaskPanelController.prototype.toggleEditable = function () {
        var editable = !this.editable;
        this.customSelectProject.setEditable(editable);
        this.customSelectTaskGroup.setEditable(editable);
        this.customSelectAssignedTo.setEditable(editable);
        this.customSelectType.setEditable(editable);
        this.customSelectStatus.setEditable(editable);
        this.customSelectPriority.setEditable(editable);
        this.editable = editable;
        this.internalModel.editable = editable;
    };
    TaskPanelController.prototype.openEditWindow = function () {
        var _this = this;
        var task = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
        var project = task.getProjectId() in this.tasksPlugin.projects[this.session.hostHash] ? this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()] : null;
        if (project == null) {
            return;
        }
        if (!this.tasksPlugin.bringWindowToFront(TaskWindowController_1.TaskWindowController.getWindowId(this.session, task.getId()))) {
            this.app.ioc.create(TaskWindowController_1.TaskWindowController, [this.handlers.openWindowParent, this.session, task.getId(), true]).then(function (win) {
                _this.requestParentOpenChildWindow(win);
            });
        }
    };
    TaskPanelController.prototype.onViewDataChanged = function (key, value) {
        if (key == "taskGroupIds") {
            this.result.taskGroupIds = JSON.parse(value);
        }
        else if (key == "assignedTo") {
            var arrStr = value.split(",");
            this.result.assignedTo = arrStr.map(function (x) { return (x); }).filter(function (x) { return x != ""; });
        }
        else if (key == "type") {
            this.result.type = parseInt(value);
        }
        else if (key == "status") {
            this.result.status = parseInt(value);
        }
        else if (key == "priority") {
            this.result.priority = parseInt(value);
        }
        else if (key == "projectId") {
            this.result.projectId = value;
            if (this.newTask) {
            }
            this.updateCustomSelectsKeepSelection(value);
            this.callViewMethod("refreshAvatars");
        }
    };
    TaskPanelController.prototype.commitAttachments = function (destinationSection, task) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.tasksPlugin.lockAttachmentModificationMessages(_this.session, task.getId());
            return _this.attachmentsManager.commit(destinationSection, task, _this.handle ? [_this.handle] : []);
        })
            .fin(function () {
            _this.tasksPlugin.unlockAttachmentModificationMessages(_this.session, task.getId());
        });
    };
    TaskPanelController.prototype.saveChanges = function () {
        var _this = this;
        if (this.result.description.trim().length == 0) {
            return pmc_mail_1.Q();
        }
        this.saved = true;
        var task = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
        var origTask = task ? this.tasksPlugin.createObject(this.session, { key: "t_" + task.getId(), payload: JSON.parse(JSON.stringify(task)) }) : undefined;
        var taskVersion = task ? this.tasksPlugin.getTaskVersion(this.session, this.taskId) : undefined;
        var project;
        project = this.tasksPlugin.projects[this.session.hostHash][this.result.projectId];
        if (project == null) {
            return pmc_mail_1.Q();
        }
        var destinationSection = this.session.sectionManager.getSection(project.getId());
        var result = JSON.parse(JSON.stringify(this.result));
        result.assignedTo = this.customSelectAssignedTo.value.split(",").filter(function (x) { return x.length > 0; });
        result.status = parseInt(this.customSelectStatus.value);
        result.projectId = this.customSelectProject.value;
        result.taskGroupIds = this.customSelectTaskGroup.value.split(",").filter(function (x) { return x.length > 0; });
        var oldProject = null;
        var metaDataStr = "";
        return pmc_mail_1.Q().then(function () {
            if (!_this.newTask && task.getProjectId() != result.projectId) {
                oldProject = _this.tasksPlugin.projects[_this.session.hostHash][task.getProjectId()];
                return _this.tasksPlugin.deleteKvdbElement(_this.session, oldProject.getId(), "t_" + task.getId(), true);
            }
        })
            .then(function () {
            return _this.app.prepareHtmlMessageBeforeSending(result.description, _this.session).then(function (newText) {
                var _a = pmc_mail_1.utils.ContentEditableEditorMetaData.extractMetaFromHtml(newText), metaData = _a.metaData, html = _a.html;
                metaDataStr = JSON.stringify(metaData);
                result.description = html;
            });
        })
            .then(function () {
            if (_this.newTask) {
                _this.tasksPlugin.recentlyUsedTaskProperties = {
                    type: result.type,
                    status: result.status,
                    priority: result.priority,
                };
                if (result.taskGroupIds.length == 0) {
                    result.taskGroupIds = ["__orphans__"];
                }
                for (var k in result.taskGroupIds) {
                    var v = result.taskGroupIds[k];
                    if (v == undefined || v == "") {
                        result.taskGroupIds[k] = "__orphans__";
                    }
                }
                var nowTimestamp = new Date().getTime();
                var t_1 = new Task_1.Task();
                DataMigration_1.DataMigration.setVersion(t_1);
                t_1.setDescription(result.description);
                t_1.setAssignedTo(result.assignedTo);
                t_1.setType(result.type);
                t_1.setStatus(Task_1.Task.getStatuses()[result.status]);
                t_1.setPriority(result.priority);
                t_1.setProjectId(project.getId());
                t_1.setTaskGroupIds(result.taskGroupIds);
                t_1.setCreatedBy(_this.tasksPlugin.getMyId(_this.session));
                t_1.setCreatedDateTime(nowTimestamp);
                t_1.setModifiedBy(_this.tasksPlugin.getMyId(_this.session));
                t_1.setModifiedDateTime(nowTimestamp);
                t_1.setStartTimestamp(result.startTimestamp);
                t_1.setEndTimestamp(result.endTimestamp);
                t_1.setWholeDays(result.wholeDays);
                t_1.setMetaDataStr(metaDataStr);
                t_1.addHistory({
                    when: nowTimestamp,
                    who: _this.tasksPlugin.getMyId(_this.session),
                    what: "created",
                });
                var prom = _this.obtainedTaskId ? pmc_mail_1.Q(_this.obtainedTaskId) : _this.tasksPlugin.nextTaskId(_this.session);
                prom.then(function (id) {
                    t_1.setId(id);
                    return _this.commitAttachments(destinationSection, t_1)
                        .then(function () {
                        return id;
                    });
                })
                    .then(function (id) {
                    var prom = pmc_mail_1.Q();
                    prom = prom.then(function () { return _this.tasksPlugin.addTask(_this.session, t_1); });
                    var added = false;
                    var _loop_5 = function (k) {
                        if (k != "__orphans__") {
                            var taskGroup_1 = _this.tasksPlugin.getTaskGroup(_this.session, k);
                            if (taskGroup_1.getProjectId() != project.getId()) {
                                return "continue";
                            }
                            added = true;
                            taskGroup_1.addTaskId(id, true);
                            var f = function () { return _this.tasksPlugin.saveTaskGroup(_this.session, taskGroup_1); };
                            prom = prom.then(f);
                        }
                        else {
                            added = true;
                            project.addOrphanedTasksId(id, true);
                            var f = function () { return _this.tasksPlugin.saveProject(_this.session, project); };
                            prom = prom.then(f);
                        }
                    };
                    for (var _i = 0, _a = result.taskGroupIds; _i < _a.length; _i++) {
                        var k = _a[_i];
                        _loop_5(k);
                    }
                    if (!added) {
                        project.addOrphanedTasksId(id, true);
                        var f = function () { return _this.tasksPlugin.saveProject(_this.session, project); };
                        prom = prom.then(f);
                    }
                    prom = prom.then(function () { return _this.tasksPlugin.saveTask(_this.session, t_1); });
                    prom = prom.then(function () {
                        _this.triggerTaskCreated(id);
                    });
                    return prom;
                })
                    .fail(function (e) {
                    console.log(e);
                });
                _this.requestParentClose(false);
            }
            else {
                var now = new Date().getTime();
                var n0 = _this.origHistoryLength;
                _this.addTaskHistory(task, result, now);
                var n1 = task.getHistory().length;
                if (n1 != n0 || oldProject || _this.attachmentsManager.isModified()) {
                    var prevTaskGroupIds = task.getTaskGroupIds(true);
                    task.setAssignedTo(result.assignedTo);
                    task.setDescription(result.description);
                    task.setPriority(result.priority);
                    task.setStatus(Task_1.Task.getStatuses()[result.status]);
                    task.setType(result.type);
                    task.setTaskGroupIds(JSON.parse(JSON.stringify(result.taskGroupIds)));
                    task.setModifiedDateTime(now);
                    task.setModifiedBy(_this.tasksPlugin.getMyId(_this.session));
                    task.setProjectId(project.getId());
                    task.setStartTimestamp(result.startTimestamp);
                    task.setEndTimestamp(result.endTimestamp);
                    task.setWholeDays(result.wholeDays);
                    task.setMetaDataStr(metaDataStr);
                    var saveProject = false;
                    var saveTgs = [];
                    for (var _i = 0, prevTaskGroupIds_1 = prevTaskGroupIds; _i < prevTaskGroupIds_1.length; _i++) {
                        var id = prevTaskGroupIds_1[_i];
                        if (result.taskGroupIds.indexOf(id) < 0) {
                            if (!id || id == "__orphans__") {
                                (oldProject ? oldProject : project).removeOrphanedTasksId(task.getId());
                            }
                            else {
                                if (id in _this.tasksPlugin.taskGroups[_this.session.hostHash]) {
                                    var tg = _this.tasksPlugin.taskGroups[_this.session.hostHash][id];
                                    tg.removeTaskId(task.getId());
                                    saveTgs.push(tg);
                                }
                            }
                        }
                    }
                    for (var _a = 0, _b = result.taskGroupIds; _a < _b.length; _a++) {
                        var id = _b[_a];
                        if (prevTaskGroupIds.indexOf(id) < 0) {
                            if (!id || id == "__orphans__") {
                                project.addOrphanedTasksId(task.getId(), true);
                                saveProject = true;
                            }
                            else {
                                if (id in _this.tasksPlugin.taskGroups[_this.session.hostHash]) {
                                    var tg = _this.tasksPlugin.taskGroups[_this.session.hostHash][id];
                                    if (tg.getProjectId() != project.getId()) {
                                        continue;
                                    }
                                    tg.addTaskId(task.getId(), true);
                                    saveTgs.push(tg);
                                }
                            }
                        }
                    }
                    var prom = _this.commitAttachments(destinationSection, task);
                    if (oldProject) {
                        prom = prom.then(function () { return _this.tasksPlugin.saveProject(_this.session, oldProject); });
                    }
                    if (saveProject) {
                        prom = prom.then(function () { return _this.tasksPlugin.saveProject(_this.session, project); });
                    }
                    var _loop_4 = function (tg) {
                        prom = prom.then(function () { return _this.tasksPlugin.saveTaskGroup(_this.session, tg); });
                    };
                    for (var _c = 0, saveTgs_1 = saveTgs; _c < saveTgs_1.length; _c++) {
                        var tg = saveTgs_1[_c];
                        _loop_4(tg);
                    }
                    prom = prom.then(function () {
                        return _this.tasksPlugin.sendTaskMessage(_this.session, task, "modify-task");
                    })
                        .then(function (dt) {
                        if (dt) {
                            task.updateModifiedServerDateTime(dt);
                        }
                        return _this.tasksPlugin.saveTask(_this.session, task, taskVersion, origTask);
                    }).fail(function (e) {
                        console.log(e);
                    });
                    return prom;
                }
            }
        }).then(function () {
            _this.initialAttachments = null;
        });
    };
    TaskPanelController.prototype.onViewDeleteClick = function () {
        var _this = this;
        if (this.taskId === false) {
            return;
        }
        var taskIds = [this.taskId];
        var t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
        this.tasksPlugin.askDeleteTasks(this.session, taskIds, t ? !t.getIsTrashed() : true, this.handlers.confirmEx)
            .then(function () {
            _this.updateView(false, true);
        });
    };
    TaskPanelController.prototype.onViewRestoreFromTrash = function () {
        var _this = this;
        if (this.taskId === false) {
            return;
        }
        var taskIds = [this.taskId];
        this.tasksPlugin.restoreFromTrash(this.session, taskIds).then(function () {
            _this.updateView(false, true);
        });
    };
    TaskPanelController.prototype.onViewRevertClick = function (entryId) {
        var _this = this;
        if (!(entryId in this.internalModel.resolvedTaskHistory) || this.taskId === false) {
            return;
        }
        this.requestParentConfirm(this.i18n("plugin.tasks.component.taskPanel.task.history.revert.confirm")).then(function (result) {
            var data = {};
            var task = _this.tasksPlugin.tasks[_this.session.hostHash][_this.taskId];
            if (result.result == "yes") {
                var projectsToSave_1 = {};
                var taskGroupsToSave_1 = {};
                var entry = _this.internalModel.taskHistory[entryId];
                if (entry.what == "moved") {
                    data.taskGroupIds = entry.oldVal;
                    _this.addTaskHistory(task, data);
                    var from = task.getTaskGroupIds();
                    var to = data.taskGroupIds;
                    for (var _i = 0, from_1 = from; _i < from_1.length; _i++) {
                        var id = from_1[_i];
                        if (to.indexOf(id) < 0) {
                            if (id && id != "__orphans__") {
                                var tg = _this.tasksPlugin.getTaskGroup(_this.session, id);
                                if (tg) {
                                    tg.removeTaskId(_this.taskId);
                                    taskGroupsToSave_1[id] = tg;
                                }
                            }
                            else {
                                var pId = task.getProjectId();
                                var proj = _this.tasksPlugin.getProject(_this.session, pId);
                                if (proj) {
                                    proj.removeOrphanedTasksId(_this.taskId);
                                    projectsToSave_1[pId] = proj;
                                }
                            }
                        }
                    }
                    for (var _a = 0, to_1 = to; _a < to_1.length; _a++) {
                        var id = to_1[_a];
                        if (from.indexOf(id) < 0) {
                            if (id && id != "__orphans__") {
                                var tg = _this.tasksPlugin.getTaskGroup(_this.session, id);
                                if (tg) {
                                    tg.addTaskId(_this.taskId, true);
                                    taskGroupsToSave_1[id] = tg;
                                }
                            }
                            else {
                                var pId = task.getProjectId();
                                var proj = _this.tasksPlugin.getProject(_this.session, pId);
                                if (proj) {
                                    proj.addOrphanedTasksId(_this.taskId, true);
                                    projectsToSave_1[pId] = proj;
                                }
                            }
                        }
                    }
                    task.setTaskGroupIds(data.taskGroupIds);
                }
                else if (entry.what == "modified") {
                    data[entry.arg] = entry.oldVal;
                    _this.addTaskHistory(task, data);
                    task["set" + entry.arg.charAt(0).toUpperCase() + entry.arg.substr(1)](entry.oldVal);
                }
                else if (entry.what == "added") {
                    if (entry.arg == "attachment") {
                        var atts = task.getAttachments(true);
                        var idx = atts.indexOf(entry.newVal);
                        if (idx >= 0) {
                            task.addHistory({
                                when: new Date().getTime(),
                                who: _this.tasksPlugin.getMyId(_this.session),
                                what: "removed",
                                arg: "attachment",
                                oldVal: entry.newVal,
                            });
                            atts.splice(idx, 1);
                            data.attachments = atts;
                            task.removeAttachment(entry.newVal);
                        }
                    }
                    else if (entry.arg == "person") {
                        var atts = task.getAssignedTo(true);
                        var idx = atts.indexOf(entry.newVal);
                        if (idx >= 0) {
                            atts.splice(idx, 1);
                            data.assignedTo = atts;
                            _this.addTaskHistory(task, data);
                            task.removeAssignedTo(entry.newVal);
                        }
                    }
                }
                else if (entry.what == "removed") {
                    if (entry.arg == "attachment") {
                        var atts = task.getAttachments(true);
                        var idx = atts.indexOf(entry.oldVal);
                        if (idx < 0) {
                            task.addHistory({
                                when: new Date().getTime(),
                                who: _this.tasksPlugin.getMyId(_this.session),
                                what: "added",
                                arg: "attachment",
                                newVal: entry.oldVal,
                            });
                            atts.push(entry.oldVal);
                            data.attachments = atts;
                            task.addAttachment(entry.oldVal);
                        }
                    }
                    else if (entry.arg == "person") {
                        var atts = task.getAssignedTo(true);
                        var idx = atts.indexOf(entry.oldVal);
                        if (idx < 0) {
                            atts.push(entry.oldVal);
                            data.assignedTo = atts;
                            _this.addTaskHistory(task, data);
                            task.addAssignedTo(entry.oldVal);
                        }
                    }
                }
                var prom = pmc_mail_1.Q();
                var _loop_6 = function (id) {
                    var f_1 = function () { return _this.tasksPlugin.saveProject(_this.session, projectsToSave_1[id]); };
                    prom = prom.then(f_1);
                };
                for (var id in projectsToSave_1) {
                    _loop_6(id);
                }
                var _loop_7 = function (id) {
                    var f_2 = function () { return _this.tasksPlugin.saveTaskGroup(_this.session, taskGroupsToSave_1[id]); };
                    prom = prom.then(f_2);
                };
                for (var id in taskGroupsToSave_1) {
                    _loop_7(id);
                }
                var f = function () { return _this.tasksPlugin.saveTask(_this.session, task); };
                prom = prom.then(f);
            }
        });
    };
    TaskPanelController.prototype.addTaskHistory = function (task, newData, nowTimestamp) {
        if (nowTimestamp === void 0) { nowTimestamp = null; }
        var now = nowTimestamp ? nowTimestamp : new Date().getTime();
        var myId = this.tasksPlugin.getMyId(this.session);
        var tgHist = null;
        var projChanged = false;
        for (var key in newData) {
            var oldValue = task["get" + key.charAt(0).toUpperCase() + key.substr(1)]();
            var newValue = newData[key];
            var different = false;
            if (typeof (oldValue) == "object" && typeof (newValue) == "object" && oldValue != null && newValue != null) {
                if (oldValue.length == newValue.length) {
                    for (var k in oldValue) {
                        if (newValue.indexOf(oldValue[k]) < 0) {
                            different = true;
                            break;
                        }
                    }
                }
                else {
                    different = true;
                }
            }
            else {
                if (key == "status") {
                    newValue = Task_1.Task.getStatuses()[newValue];
                }
                different = oldValue != newValue;
            }
            if (different) {
                if (key == "assignedTo") {
                    for (var _i = 0, _a = this._getAddedElements(oldValue, newValue); _i < _a.length; _i++) {
                        var el = _a[_i];
                        task.addHistory({
                            when: now,
                            who: myId,
                            what: "added",
                            arg: "person",
                            newVal: el,
                        });
                    }
                    for (var _b = 0, _c = this._getAddedElements(newValue, oldValue); _b < _c.length; _b++) {
                        var el = _c[_b];
                        task.addHistory({
                            when: now,
                            who: myId,
                            what: "removed",
                            arg: "person",
                            oldVal: el,
                        });
                    }
                }
                else if (key == "name" || key == "description" || key == "status" || key == "startTimestamp" || key == "duration" || key == "endTimestamp" || key == "wholeDays") {
                    task.addHistory({
                        when: now,
                        who: myId,
                        what: "modified",
                        arg: key,
                        oldVal: oldValue,
                        newVal: newValue,
                    });
                }
                else if (key == "taskGroupIds") {
                    if (!((oldValue == "" || oldValue == "__orphans__") && (newValue == "" || newValue == "__orphans__"))) {
                        tgHist = {
                            when: now,
                            who: myId,
                            what: "moved",
                            oldVal: oldValue ? oldValue : null,
                            newVal: newValue ? newValue : null,
                        };
                    }
                }
                else if (key == "projectId") {
                    task.addHistory({
                        when: now,
                        who: myId,
                        what: "modified",
                        arg: key,
                        oldVal: oldValue ? oldValue : null,
                        newVal: newValue ? newValue : null,
                    });
                    projChanged = true;
                }
            }
        }
        if (!projChanged && tgHist) {
            task.addHistory(tgHist);
        }
    };
    TaskPanelController.prototype._getAddedElements = function (arr1, arr2) {
        var added = [];
        for (var _i = 0, arr2_1 = arr2; _i < arr2_1.length; _i++) {
            var el = arr2_1[_i];
            if (arr1.indexOf(el) < 0) {
                added.push(el);
            }
        }
        return added;
    };
    TaskPanelController.prototype.addCommentPreVersion18BackCompat = function (text) {
        if (this.taskId == false || text.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
            return pmc_mail_1.Q().thenResolve(null);
        }
        else {
            var t_2 = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
            var commentTag_1 = null;
            var dt_1 = null;
            return this.tasksPlugin.sendTaskCommentMessage(this.session, t_2, text)
                .then(function (result) {
                commentTag_1 = result.message.mainReceiver.sink.id + "/" + result.message.id;
                t_2.addCommentTag(commentTag_1);
                if (result.source && result.source.serverDate) {
                    dt_1 = result.source.serverDate;
                }
            })
                .fail(function (e) {
                Logger.error("Error during saving task comment", e);
                return null;
            })
                .then(function () {
                return { commentTag: commentTag_1, dt: dt_1 };
            });
        }
    };
    TaskPanelController.prototype.addComment = function (text) {
        var _this = this;
        var metaDataStr = null;
        return pmc_mail_1.Q().then(function () {
            return _this.app.prepareHtmlMessageBeforeSending(text, _this.session).then(function (newText) {
                var _a = pmc_mail_1.utils.ContentEditableEditorMetaData.extractMetaFromHtml(newText), metaData = _a.metaData, html = _a.html;
                text = html;
                metaDataStr = JSON.stringify(metaData);
            });
        })
            .then(function () {
            if (_this.taskId == false || text.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
                return pmc_mail_1.Q().thenResolve(false);
            }
            else {
                var t_3 = _this.tasksPlugin.tasks[_this.session.hostHash][_this.taskId];
                var version_1 = _this.tasksPlugin.getTaskVersion(_this.session, t_3.getId());
                var origTask_1 = _this.tasksPlugin.createObject(_this.session, { key: "t_" + t_3.getId(), payload: JSON.parse(JSON.stringify(t_3)) });
                return pmc_mail_1.Q().then(function () {
                    return _this.addCommentPreVersion18BackCompat(text);
                })
                    .then(function (_a) {
                    var commentTag = _a.commentTag, dt = _a.dt;
                    var currTime = dt ? dt : Date.now();
                    t_3.setModifiedDateTime(currTime);
                    t_3.setModifiedBy(_this.tasksPlugin.getMyId(_this.session));
                    var comments = t_3.getComments();
                    comments.push({
                        dateTime: currTime,
                        message: text,
                        userHashmail: _this.session.sectionManager.identity.hashmail,
                        body: _this.prepareCommentBody(t_3, text, metaDataStr),
                        relatedCommentTag: commentTag,
                    });
                    t_3.setComments(comments);
                    return _this.tasksPlugin.saveTask(_this.session, t_3, version_1, origTask_1);
                })
                    .fail(function (e) { return Logger.error("Error during saving task comment", e); })
                    .thenResolve(true);
            }
        });
    };
    TaskPanelController.prototype.prepareCommentBody = function (t, comment, metaDataStr) {
        return {
            type: "task-comment",
            who: this.tasksPlugin.getMyId(this.session),
            id: t.getId(),
            label: "#" + t.getId().substr(0, 5),
            comment: comment,
            status: t.getStatus(),
            statusLocaleName: this.app.localeService.i18n("plugin.tasks.status-" + t.getStatus()),
            numOfStatuses: Task_1.Task.getStatuses().length,
            statusColor: Task_1.Task.getLabelClass(t.getStatus()),
            metaDataStr: metaDataStr
        };
    };
    TaskPanelController.prototype.onViewAddComment = function (text) {
        var _this = this;
        if (!text || text.trim().length == 0) {
            return;
        }
        this.encryptionEffectCommentText.show(text, this.getEncryptedCommentText.bind(this)).then(function () {
            return _this.addComment(text);
        }).then(function (added) {
            if (added) {
                _this.notify("addedComment");
            }
        });
    };
    TaskPanelController.prototype.onViewAddAttachment = function () {
        var _this = this;
        if (this.taskId == false) {
            return;
        }
        else {
            var t_4 = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
            pmc_mail_1.Q().then(function () {
                return _this.uploadAttachment(t_4);
            })
                .fail(function (e) { return Logger.error(e); });
        }
    };
    TaskPanelController.prototype.onViewAddCalendar = function (mode) {
        var now = new Date();
        var day = now.getDate();
        var month = now.getMonth();
        var year = now.getFullYear();
        var time = (now.getHours() * 3600 + now.getMinutes() * 60) * 1000;
        var rounding = 15 * 60 * 1000;
        time = Math.round(time / rounding) * rounding;
        this.defaultDateTime = new Date(year, month, day, 0, 0, 0, time);
        var prevDuration = (this.result.endTimestamp && this.result.startTimestamp) ? (this.result.endTimestamp - this.result.startTimestamp) : null;
        this.result.startTimestamp = this.defaultDateTime.getTime();
        this.result.endTimestamp = this.result.startTimestamp + (prevDuration ? prevDuration : 3600000);
        this.result.wholeDays = mode == "wholeDay";
        this.callViewMethod("setEndDateTime", this.result.endTimestamp);
        this.callViewMethod("setStartDateTime", this.defaultDateTime.getTime());
        this.callViewMethod("setWholeDays", this.result.wholeDays);
    };
    TaskPanelController.prototype.onViewDelAttachment = function (did) {
        this.attachmentsManager.remove(did);
        this.callViewMethod("removeAttachment", did);
    };
    TaskPanelController.prototype.addUploadedAttachment = function (sectionFile) {
        this.attachmentsManager.addOpenableSectionFile(sectionFile, false);
        this.callViewMethod("setAttachments", this.attachmentsManager.getAttachmentInfoStrings());
        return pmc_mail_1.Q.resolve();
    };
    TaskPanelController.prototype.uploadAttachment = function (task) {
        var _this = this;
        var projId = this.customSelectProject.value;
        var taskId = this.newTask || !this.taskId ? null : this.taskId;
        var section = this.session.sectionManager.getSection(projId);
        var contents;
        var notificationId;
        if (!section.getModule("file")) {
            return;
        }
        var notes2Module = section.getFileModule();
        var notes2Plugin = this.app.getComponent("notes2-plugin");
        if (!notes2Module || !notes2Plugin) {
            return null;
        }
        pmc_mail_1.Q().then(function () {
            notes2Plugin.openFileChooser(_this.parent, _this.session, section, "tasks-" + _this.session.hostHash + "-" + taskId).then(function (result) {
                if (result.length == 0) {
                    return;
                }
                contents = result.map(function (element) { return element.content; });
                notificationId = _this.notifications.showNotification(_this.i18n("plugin.tasks.component.taskPanel.notifications.addingAttachment"), { autoHide: false, progress: true });
                var prom = taskId ? pmc_mail_1.Q(taskId) : _this.tasksPlugin.nextTaskId(_this.session);
                return prom
                    .then(function (tId) {
                    if (!taskId) {
                        taskId = tId;
                        _this.obtainedTaskId = taskId;
                        _this.callViewMethod("setObtainedTaskId", _this.obtainedTaskId);
                    }
                    var prom = pmc_mail_1.Q();
                    var _loop_8 = function (contentId) {
                        var content = contents[contentId];
                        var res = result[contentId];
                        if (res instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
                            if (res.section && res.section.getId() == section.getId()) {
                                prom = prom.then(function () {
                                    return _this.addUploadedAttachment(res);
                                });
                                return "continue";
                            }
                        }
                        prom = prom.then(function () {
                            section.uploadFile({
                                data: content,
                                fileOptions: {
                                    metaUpdater: function (meta) { return _this.tasksPlugin._metaUpdaterAdder(meta, taskId); }
                                }
                            })
                                .then(function (fileResult) {
                                return _this.session.sectionManager.getFileOpenableElement(fileResult.fileResult.entryId, false, true)
                                    .then(function (sectionFile) {
                                    return _this.addUploadedAttachment(sectionFile);
                                }).then(function () {
                                    return fileResult;
                                });
                            });
                        });
                    };
                    for (var contentId in contents) {
                        _loop_8(contentId);
                    }
                })
                    .progress(function (progress) {
                    _this.notifications.progressNotification(notificationId, progress);
                })
                    .fin(function () {
                    _this.notifications.hideNotification(notificationId);
                });
            });
        })
            .fail(this.errorCallback);
    };
    TaskPanelController.prototype.getEnterSavesTask = function () {
        return this.tasksPlugin.getSetting(this.session, "enter-saves-task", null, null) == 1;
    };
    TaskPanelController.prototype.getEnterAddsComment = function () {
        return true;
    };
    TaskPanelController.prototype.setEnterSavesTask = function (value) {
        if (value != this.internalModel.enterSavesTask) {
            this.internalModel.enterSavesTask = value;
            this.callViewMethod("setEnterSavesTask", value);
        }
        if (value != this.getEnterSavesTask()) {
            this.tasksPlugin.saveSetting(this.session, "enter-saves-task", value ? 1 : 0, null, null);
            this.app.dispatchEvent({
                type: "tasks-setting-changed",
                setting: "enter-saves-task",
                value: value,
                sourceProjectId: null,
                sourceContext: null,
                sourceUniqueId: null,
            });
        }
    };
    TaskPanelController.prototype.setEnterAddsComment = function (value) {
        if (value != this.internalModel.enterAddsComment) {
            this.internalModel.enterAddsComment = value;
            this.callViewMethod("setEnterAddsComment", value);
        }
        if (value != this.getEnterAddsComment()) {
            this.tasksPlugin.saveSetting(this.session, "enter-adds-comment", value ? 1 : 0, null, null);
            this.app.dispatchEvent({
                type: "tasks-setting-changed",
                setting: "enter-adds-comment",
                value: value,
                sourceProjectId: null,
                sourceContext: null,
                sourceUniqueId: null,
            });
        }
    };
    TaskPanelController.prototype.setHorizontalLayout = function (value) {
        if (this.newTask) {
            value = false;
        }
        this.internalModel.horizontalLayout = value;
        this.internalModel.isEditTaskWindow = !this.internalModel.newTask && this.getIsHorizontalLayout();
        this.callViewMethod("setIsEditTaskWindow", this.internalModel.isEditTaskWindow);
        this.callViewMethod("setHorizontalLayout", value);
    };
    TaskPanelController.prototype.onViewSetEnterSavesTask = function (value) {
        this.setEnterSavesTask(value);
    };
    TaskPanelController.prototype.onViewSetEnterAddsComment = function (value) {
        this.setEnterAddsComment(value);
    };
    TaskPanelController.prototype.createNewTaskGroup = function () {
        var _this = this;
        var projectId = this.result.projectId;
        var project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        if (!project) {
            return;
        }
        var projectName = project.getName();
        if (!this.tasksPlugin.bringWindowToFront(TaskGroupFormWindowController_1.TaskGroupFormWindowController.getWindowId(this.session, null))) {
            this.app.ioc.create(TaskGroupFormWindowController_1.TaskGroupFormWindowController, [this.parent, this.session, projectId, projectName, true]).then(function (win) {
                win.parent = _this.parent.getClosestNotDockedController();
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
                            _this.notify("taskGroupCreated");
                            var selection = _this.result.taskGroupIds.slice(0);
                            if (selection.indexOf(id) < 0) {
                                selection.push(id);
                            }
                            _this.updateCustomSelectTaskGroupItems(projectId, selection);
                            _this.result.taskGroupIds = selection;
                            _this.customSelectTaskGroup.grabFocus(true);
                        });
                    });
                }, function () {
                    _this.customSelectTaskGroup.grabFocus();
                });
            });
        }
    };
    TaskPanelController.prototype.onViewDirtyChanged = function (dirty, differentPropNamesStr) {
        this.modifiedPropertyNames = dirty ? (JSON.parse(differentPropNamesStr) || []) : [];
        this.dirty = dirty;
        this.requestParentUpdateDirty(dirty);
        if (this.onDirtyChanged) {
            this.onDirtyChanged();
        }
    };
    TaskPanelController.prototype.onViewDirtyPropsChanged = function (dirty, differentPropNamesStr) {
        this.modifiedPropertyNames = dirty ? (JSON.parse(differentPropNamesStr) || []) : [];
    };
    TaskPanelController.prototype.ensureHasDateTime = function (dt) {
        this.defaultDateTime = dt;
        this.updateView(false, true);
    };
    TaskPanelController.prototype.onDatePickerPopupClosed = function (commit) {
        if (!commit) {
            return;
        }
        var day = this.dateTimePicker.currDataModel.selectedDay;
        var month = this.dateTimePicker.currDataModel.selectedMonth;
        var year = this.dateTimePicker.currDataModel.selectedYear;
        var time = this.dateTimePicker.currDataModel.selectedTime;
        this.defaultDateTime = new Date(year, month, day, 0, 0, 0, time);
        var prevDuration = (this.result.endTimestamp && this.result.startTimestamp) ? (this.result.endTimestamp - this.result.startTimestamp) : null;
        this.result.startTimestamp = this.defaultDateTime.getTime();
        this.result.endTimestamp = this.result.startTimestamp + (prevDuration ? prevDuration : 3600000);
        this.callViewMethod("setEndDateTime", this.result.endTimestamp);
        this.callViewMethod("setStartDateTime", this.defaultDateTime.getTime());
    };
    TaskPanelController.prototype.onDatePicker2PopupClosed = function (commit) {
        if (!commit) {
            return;
        }
        var day = this.dateTimePicker2.currDataModel.selectedDay;
        var month = this.dateTimePicker2.currDataModel.selectedMonth;
        var year = this.dateTimePicker2.currDataModel.selectedYear;
        var time = this.dateTimePicker2.currDataModel.selectedTime;
        var ts = new Date(year, month, day, 0, 0, 0, time).getTime();
        this.result.endTimestamp = Math.max(ts, this.result.startTimestamp + 900000);
        this.callViewMethod("setEndDateTime", this.result.endTimestamp);
    };
    TaskPanelController.prototype.onViewRemoveFromCalendar = function () {
        var task = null;
        if (this.taskId && this.session && this.tasksPlugin.tasks[this.session.hostHash] && this.tasksPlugin.tasks[this.session.hostHash][this.taskId]) {
            task = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
        }
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth();
        var day = now.getDate();
        var time = (now.getHours() * 3600 + now.getMinutes() * 60) * 1000;
        var rounding = 15 * 60 * 1000;
        time = Math.round(time / rounding) * rounding;
        this.dateTimePicker.currDataModel.selectedDay = day;
        this.dateTimePicker.currDataModel.selectedMonth = month;
        this.dateTimePicker.currDataModel.selectedYear = year;
        this.dateTimePicker.currDataModel.selectedTime = time;
        this.defaultDateTime = null;
        this.result.startTimestamp = null;
        this.result.endTimestamp = null;
        this.result.wholeDays = task ? task.getWholeDays() : false;
        this.callViewMethod("setStartDateTime", null);
        this.callViewMethod("setEndDateTime", null);
        this.callViewMethod("setWholeDays", this.result.wholeDays);
    };
    TaskPanelController.prototype.onViewToggleWholeDays = function (wholeDays) {
        this.result.wholeDays = wholeDays;
    };
    TaskPanelController.prototype.getTaskStatusesFromInternalModel = function () {
        var statuses = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, statuses, this.internalModel.taskDescription);
        for (var _i = 0, _a = this.internalModel.taskComments; _i < _a.length; _i++) {
            var comment = _a[_i];
            this.tasksPlugin.addTaskStatusesFromMessage(this.session, statuses, comment.message);
        }
        return statuses;
    };
    TaskPanelController.prototype.onViewOpenTask = function (taskId) {
        this.tasksPlugin.openEditTaskWindow(this.session, taskId, true, true);
    };
    TaskPanelController.prototype.getEncryptedTaskText = function (text) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var kvdbC = _this.tasksPlugin.kvdbCs[_this.session.hostHash][_this.result.projectId];
            if (!kvdbC || !kvdbC.kvdb) {
                return text;
            }
            return kvdbC.kvdb.encryptBuffer(new Buffer(text, "utf8")).then(function (cipher) {
                return cipher.toString("base64");
            });
        });
    };
    TaskPanelController.prototype.getEncryptedCommentText = function (text) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var section = _this.session.sectionManager.getSection(_this.result.projectId);
            if (!section) {
                return text;
            }
            var receiver = section.getChatModule().createReceiver();
            var extraBuffer = new Buffer(text, "utf8");
            return pmc_mail_1.privfs.crypto.service.eciesEncrypt(_this.tasksPlugin.identity.priv, receiver.sink.pub, extraBuffer).then(function (encrypted) {
                return encrypted.toString("base64");
            });
        });
    };
    TaskPanelController.prototype.getProjectPrefix = function (project) {
        if (!project) {
            return null;
        }
        var section = null;
        for (var _i = 0, _a = this.tasksPlugin.tasksSectionsCollection[this.session.hostHash].list; _i < _a.length; _i++) {
            var entry = _a[_i];
            if (entry.key.sectionId == project.getId()) {
                section = entry;
                break;
            }
        }
        if (!section) {
            return null;
        }
        return section.getFullSectionName(true, true);
    };
    TaskPanelController.prototype.watchTreeCollection = function () {
        var _this = this;
        var opId = ++this.lastTreeWatcherOpId;
        var section = this.internalModel.taskId ? this.session.sectionManager.getSection(this.internalModel.projectId) : null;
        if (section) {
            if (!(section.getId() in this.sectionFileTreeDeferreds)) {
                this.sectionFileTreeDeferreds[section.getId()] = pmc_mail_1.Q.defer();
                pmc_mail_1.Q().then(function () {
                    return section.getFileTree();
                }).then(function (tree) {
                    _this.sectionFileTreeDeferreds[section.getId()].resolve(tree);
                });
            }
            this.sectionFileTreeDeferreds[section.getId()].promise.then(function (tree) {
                if (opId == _this.lastTreeWatcherOpId) {
                    _this.currFileTree = tree;
                    _this.currFileTree.collection.changeEvent.add(_this.onFileTreeCollectionChangedBound);
                }
            });
        }
    };
    TaskPanelController.prototype.clearTreeCollectionWatcher = function () {
        this.lastTreeWatcherOpId++;
        if (this.currFileTree) {
            this.currFileTree.collection.changeEvent.remove(this.onFileTreeCollectionChangedBound);
            this.currFileTree = null;
        }
    };
    TaskPanelController.prototype.onFileTreeCollectionChanged = function () {
        var attIsTrashed = {};
        var _loop_9 = function (idx) {
            var attStr = this_2.internalModel.taskAttachments[idx];
            var att = JSON.parse(attStr);
            var entry = this_2.currFileTree.collection.find(function (x) { return x.ref.did == att.did; });
            if (this_2.internalModel.taskAttachments[idx]) {
                var att_1 = JSON.parse(this_2.internalModel.taskAttachments[idx]);
                if (entry && entry.path && pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                    return "continue";
                }
                if (att_1.trashed != (!entry || entry.path.indexOf("/.trash/") >= 0)) {
                    att_1.trashed = !att_1.trashed;
                    attIsTrashed[att_1.did] = att_1.trashed;
                }
                this_2.internalModel.taskAttachments[idx] = JSON.stringify(att_1);
            }
        };
        var this_2 = this;
        for (var idx in this.internalModel.taskAttachments) {
            _loop_9(idx);
        }
        var _loop_10 = function (idx) {
            var data = this_3.internalModel.resolvedTaskHistory[idx];
            if (data.arg != "attachment" || (!data.newAttachment && !data.oldAttachment)) {
                return "continue";
            }
            var key = data.newAttachment ? "newAttachment" : "oldAttachment";
            var att = JSON.parse(data[key]);
            var entry = this_3.currFileTree.collection.find(function (x) { return x.ref.did == att.did; });
            if (entry && entry.path && pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                return "continue";
            }
            if (data.isAttachmentTrashed != (!entry || entry.path.indexOf("/.trash/") >= 0)) {
                data.isAttachmentTrashed = !data.isAttachmentTrashed;
                attIsTrashed[att.did] = data.isAttachmentTrashed;
            }
        };
        var this_3 = this;
        for (var idx in this.internalModel.resolvedTaskHistory) {
            _loop_10(idx);
        }
        if (Object.keys(attIsTrashed).length > 0) {
            this.callViewMethod("updateAttIsTrashed", JSON.stringify(attIsTrashed));
        }
    };
    TaskPanelController.prototype.onViewPaste = function (originalText) {
        var _this = this;
        if (originalText === void 0) { originalText = null; }
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
            return _this.tryPaste(element, originalText);
        });
    };
    TaskPanelController.prototype.tryPaste = function (element, originalText) {
        var _this = this;
        if (element === null && originalText !== null) {
            this.callViewMethod("pastePlainText", originalText);
        }
        if (!element) {
            return pmc_mail_1.Q();
        }
        else if (element.source == "system" || element.source == "privmx") {
            if (!this.editable) {
                this.onViewEditClick("");
            }
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
            return pmc_mail_1.Q().then(function () {
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
                    var _loop_11 = function (osf) {
                        proms.push(osf.getBuffer().then(function (buff) {
                            return _this.upload(pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(buff, osf.mimeType, osf.name));
                        }));
                    };
                    for (var _a = 0, pmxFiles_2 = pmxFiles_1; _a < pmxFiles_2.length; _a++) {
                        var osf = pmxFiles_2[_a];
                        _loop_11(osf);
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
            });
        }
    };
    TaskPanelController.prototype.upload = function (content) {
        var _this = this;
        return this.getActiveSection().uploadFile({
            data: content,
        })
            .then(function (result) {
            var osf = result.openableElement;
            return _this.addUploadedAttachment(osf).thenResolve(osf);
        });
    };
    TaskPanelController.prototype.getActiveSection = function () {
        return this.session.sectionManager.getSection(this.internalModel.projectId);
    };
    TaskPanelController.prototype.onUserPreferencesChange = function (event) {
        var autoMarkAsRead = this.app.userPreferences.getAutoMarkAsRead();
        if (this.internalModel) {
            this.internalModel.autoMarkAsRead = autoMarkAsRead;
        }
        this.callViewMethod("setAutoMarkAsRead", autoMarkAsRead);
    };
    TaskPanelController.prototype.onViewToggleMarkedAsRead = function () {
        this.tasksPlugin.toggleRead(this.session, this.taskId || "");
    };
    TaskPanelController.prototype.onTaskCreated = function (handler) {
        this.onTaskCreatedHandlers.push(handler);
    };
    TaskPanelController.prototype.onCancelled = function (handler) {
        this.onCancelledHandlers.push(handler);
    };
    TaskPanelController.prototype.triggerTaskCreated = function (taskId) {
        for (var _i = 0, _a = this.onTaskCreatedHandlers; _i < _a.length; _i++) {
            var handler = _a[_i];
            handler(taskId);
        }
    };
    TaskPanelController.prototype.triggerCancelled = function () {
        for (var _i = 0, _a = this.onCancelledHandlers; _i < _a.length; _i++) {
            var handler = _a[_i];
            handler();
        }
    };
    TaskPanelController.textsPrefix = "plugin.tasks.component.taskPanel.";
    __decorate([
        Inject
    ], TaskPanelController.prototype, "sinkIndexManager", void 0);
    TaskPanelController = __decorate([
        Dependencies(["customselect", "persons", "notification"])
    ], TaskPanelController);
    return TaskPanelController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.TaskPanelController = TaskPanelController;
TaskPanelController.prototype.className = "com.privmx.plugin.tasks.component.taskPanel.TaskPanelController";

//# sourceMappingURL=TaskPanelController.js.map
