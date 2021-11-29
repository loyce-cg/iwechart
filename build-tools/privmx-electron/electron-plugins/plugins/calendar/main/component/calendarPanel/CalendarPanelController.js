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
var index_1 = require("./i18n/index");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var CalendarPanelController = (function (_super) {
    __extends(CalendarPanelController, _super);
    function CalendarPanelController(parent, personsComponent) {
        var _this = _super.call(this, parent) || this;
        _this.personsComponent = personsComponent;
        _this.wasDataSet = false;
        _this.isActive = false;
        _this.previewDay = null;
        _this.previewTask = null;
        _this.afterViewLoaded = pmc_mail_1.Q.defer();
        _this.context = Types_1.ViewContext.CalendarWindow;
        _this.isRefreshing = false;
        _this.afterUserPreviewDayChange = null;
        _this.afterUserGoToToday = null;
        _this.ign = false;
        _this.currMode = null;
        _this._overrideMode = null;
        _this.modeChanged = null;
        _this.ipcMode = true;
        _this.calendarPlugin = _this.app.getComponent("calendar-plugin");
        _this.uniqueId = _this.calendarPlugin.tasksPlugin.nextUniqueId();
        _this.session = _this.app.sessionManager.getLocalSession();
        _this.customSelectMode = _this.addComponent("customSelectMode", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: true,
                firstItemIsStandalone: false,
                items: [],
            }]));
        _this.customSelectFilter = _this.addComponent("customSelectFilter", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: true,
                firstItemIsStandalone: false,
                items: [],
            }]));
        _this.customSelectExtraCalendars = _this.addComponent("customSelectExtraCalendars", _this.componentFactory.createComponent("customselect", [_this, {
                multi: true,
                editable: true,
                firstItemIsStandalone: false,
                headerText: _this.i18n("plugin.calendar.component.calendarPanel.extraCalendars.dropdown.header"),
                items: [],
            }]));
        _this.datePicker = _this.addComponent("datePicker", _this.componentFactory.createComponent("datePicker", [_this, {}]));
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.taskTooltip = _this.addComponent("tasktooltip", _this.componentFactory.createComponent("tasktooltip", [_this]));
        _this.taskTooltip.getContent = function (taskId) {
            if (!_this.getSetting("show-task-tooltip")) {
                return null;
            }
            return _this.calendarPlugin.tasksPlugin.getTaskTooltipContent(_this.session, taskId);
        };
        _this.fileTooltip = _this.addComponent("filetooltip", _this.componentFactory.createComponent("filetooltip", [_this]));
        _this.fileTooltip.isEnabled = function () {
            return !!_this.getSetting("show-task-tooltip");
        };
        _this.datePicker.onValueChanged(_this.onDatePickerValueChanged.bind(_this));
        _this.bindEvent(_this.app, "calendars-refresh", function (event) {
            if (_this.isActive) {
                _this.refresh(event.hard, event.showNotifications);
            }
        });
        _this.bindEvent(_this.app, "calendars-file-added", function (e) {
            if (e.hostHash != _this.session.hostHash) {
                return;
            }
            if (!_this.calendarPlugin.fileModels[_this.session.hostHash]) {
                _this.calendarPlugin.fileModels[_this.session.hostHash] = {};
            }
            var isTrash = _this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID;
            var model = _this.calendarPlugin.fileModels[_this.session.hostHash][e.identifier];
            if (model && model.trashed == isTrash) {
                _this.sendFileToView(model.identifier);
            }
        });
        _this.bindEvent(_this.app, "calendars-file-removed", function (e) {
            if (e.hostHash != _this.session.hostHash) {
                return;
            }
            _this.delFileFromView(e.identifier);
        });
        _this.bindEvent(_this.app, "extra-calendars-changed", function (e) {
            if (e.hostHash != _this.session.hostHash) {
                return;
            }
            if (_this.uniqueId != e.senderId && _this.activeProjectId == e.mainProjectId) {
                _this.customSelectExtraCalendars.setItems(_this.getCustomSelectExtraCalendarsItems(), true);
                _this.resendTasksToView();
                _this.resendFilesToView();
            }
        });
        return _this;
    }
    CalendarPanelController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    CalendarPanelController.prototype.init = function () {
        var _this = this;
        this.watchSettingsChanges();
        this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterTasks, "multi");
        this.registerChangeEvent(this.calendarPlugin.personService.persons.changeEvent, function (person) { return _this.onPersonChange(_this.app.sessionManager.getLocalSession(), person); });
        this.tasksFilterUpdater = this.calendarPlugin.tasksPlugin.newTasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = function () {
            _this.updateSearchFilter(_this.tasksFilterUpdater.filter);
        };
        return pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.customSelectMode.init(),
                _this.customSelectFilter.init(),
                _this.datePicker.init(),
                _this.customSelectExtraCalendars.init(),
            ]);
        })
            .thenResolve(null);
    };
    CalendarPanelController.prototype.onPersonChange = function (session, person) {
        this.callViewMethod("updatePersonPresence", person.getHashmail(), person.isPresent());
    };
    CalendarPanelController.prototype.onViewLoad = function () {
        this.afterViewLoaded.resolve();
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    CalendarPanelController.prototype.getModel = function () {
        return null;
    };
    CalendarPanelController.prototype.getDataModel = function () {
        this.currDataModel = null;
        if (!this.activeProjectId) {
            return null;
        }
        this.customSelectMode.setItems(this.getCustomSelectModeItems());
        this.customSelectFilter.setItems(this.getCustomSelectFilterItems());
        var projectId = this.activeProjectId;
        var section = this.getActiveSection();
        var projectName = this.getActiveSectionName();
        var relevantTasks = this.getRelevantTasks();
        var tasksModels = this.convertTasks(relevantTasks);
        this.currMode = this.getSetting("mode");
        var extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, projectId);
        var relevantFileModels = this.getRelevantFileModels();
        this.customSelectExtraCalendars.setItems(this.getCustomSelectExtraCalendarsItems());
        var now = new Date();
        var model = {
            calendarId: this.calendarId,
            projectId: projectId,
            projectName: projectName,
            privateSectionId: this.calendarPlugin.getPrivateSectionId(),
            uniqueSafeId: this._getUniqueSafeId(),
            conv2Model: this.isConv2Section() ? pmc_mail_1.utils.Converter.convertConv2(this.getActiveConv2Section(), 0, null, 0, true, 0, false, false, false, null) : null,
            settings: this.getSettings(),
            taskStatuses: this.calendarPlugin.tasksPlugin.getTaskStatuses(),
            canCreateNewTasks: this.isConv2Section() ? !this.getActiveConv2Section().hasDeletedUserOnly() : true,
            searchStr: this.calendarPlugin.searchStr,
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
            isInSummaryWindow: false,
            otherPluginsAvailability: this.getOtherPluginsAvailability(),
            tasks: tasksModels,
            files: relevantFileModels,
            myHashmail: this.calendarPlugin.getMyId(this.session),
            selectedDay: now.getDate(),
            selectedMonth: now.getMonth(),
            selectedYear: now.getFullYear(),
            extraCalendars: extraCalendars,
            canChooseExtraCalendars: !!this.calendarPlugin.mergableSections[this.session.hostHash].find(function (x) { return x.getId() == projectId; }),
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    };
    CalendarPanelController.prototype._getUniqueSafeId = function () {
        return "calendar" + this.uniqueId;
    };
    CalendarPanelController.prototype.getCustomSelectModeItems = function () {
        var arr = [];
        var modes = [
            Types_1.Modes.MONTH,
            Types_1.Modes.SINGLE_WEEK,
            Types_1.Modes.SINGLE_DAY,
        ];
        var curr = this.getSetting("mode");
        for (var _i = 0, modes_1 = modes; _i < modes_1.length; _i++) {
            var mode = modes_1[_i];
            arr.push({
                type: "item",
                value: mode,
                text: this.i18n("plugin.calendar.component.calendarPanel.mode." + mode),
                textNoEscape: true,
                icon: null,
                selected: curr == mode,
            });
        }
        return arr;
    };
    CalendarPanelController.prototype.beforeClose = function () {
        if (this.dataChangedListener) {
            this.calendarPlugin.tasksPlugin.unWatch(this.session, "*", "*", "*", this.dataChangedListener);
        }
    };
    CalendarPanelController.prototype.updateSearchFilter = function (data) {
        var searchStr = data.visible ? data.value : "";
        this.callViewMethod("applySearchFilter", searchStr);
    };
    CalendarPanelController.prototype.onFilterTasks = function () {
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    CalendarPanelController.prototype.getOtherPluginsAvailability = function () {
        return { chat: false, notes: false, tasks: false };
    };
    CalendarPanelController.prototype.onViewRefresh = function (hard, showNotification) {
        if (hard === void 0) { hard = true; }
        if (showNotification === void 0) { showNotification = true; }
        if (this.calendarId == 1) {
            this.app.dispatchEvent({
                type: "calendars-refresh",
                hard: hard,
                showNotifications: showNotification,
            });
        }
    };
    CalendarPanelController.prototype.refresh = function (hard, showNotification) {
        var _this = this;
        if (hard === void 0) { hard = true; }
        if (showNotification === void 0) { showNotification = true; }
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;
        var str = this.i18n("plugin.calendar.component.calendarPanel.notifications.refreshing");
        var notificationId;
        if (showNotification) {
            notificationId = this.notifications.showNotification(str, {
                autoHide: false,
                progress: true,
            });
        }
        var prom = pmc_mail_1.Q();
        if (hard) {
            prom = prom.then(function () { return _this.calendarPlugin.tasksPlugin.refreshCollections(); });
        }
        prom.then(function () {
        }).fin(function () {
            if (showNotification) {
                _this.notifications.hideNotification(notificationId);
            }
            _this.callViewMethod("repaint");
            setTimeout(function () {
                _this.isRefreshing = false;
            }, 800);
        });
    };
    CalendarPanelController.prototype.setSection = function (section) {
        var _this = this;
        if (!section.isCalendarModuleEnabled() && !this.isValidCalendarConv2Section(section)) {
            return pmc_mail_1.Q(false);
        }
        return pmc_mail_1.Q().then(function () {
            return _this.setSectionData(section, false);
        })
            .thenResolve(true);
    };
    CalendarPanelController.prototype.setSectionData = function (section, waitForViewLoaded) {
        var _this = this;
        if (waitForViewLoaded === void 0) { waitForViewLoaded = true; }
        if (section instanceof pmc_mail_1.mail.section.SectionService && this.isValidCalendarConv2Section(section)) {
            var id_1 = section.getId();
            var c2s = this.session.conv2Service.collection.find(function (x) { return x.section.getId() == id_1; });
            if (c2s) {
                section = c2s;
            }
        }
        this.wasDataSet = true;
        this.requestTaskPreview(null);
        this.requestDayPreview(null);
        if (!this.dataChangedListener) {
            this.dataChangedListener = this.onDataChanged.bind(this);
            this.calendarPlugin.tasksPlugin.watch(this.session, "*", "*", "*", this.dataChangedListener);
        }
        if (typeof (section) == "string") {
            this.activeProjectId = section;
        }
        else if (section instanceof pmc_mail_1.mail.section.Conv2Section) {
            this.activeProjectId = section.id;
        }
        else {
            this.activeProjectId = section.getId();
        }
        return pmc_mail_1.Q().then(function () {
            return _this.calendarPlugin.loadSettings(_this.session, _this.activeProjectId);
        })
            .then(function () {
            var prom = _this.afterViewLoaded.promise.then(function () {
                _this.callViewMethod("setData", _this.getDataModel());
                _this.updateDatePicker();
            })
                .fail(console.error);
            return waitForViewLoaded ? prom : null;
        })
            .fail(console.error).
            thenResolve(true);
    };
    CalendarPanelController.prototype.isValidCalendarConv2Section = function (section) {
        if (section.isUserGroup() && section.sectionData && section.sectionData.group && section.sectionData.group.type == "usernames" && section.sectionData.group.users.length == 2) {
            return true;
        }
        return false;
    };
    CalendarPanelController.prototype.getActiveSectionName = function () {
        if (this.isConv2Section()) {
            return this.calendarPlugin.tasksPlugin.getConv2SectionName(this.session, this.getActiveConv2Section());
        }
        else if (this.isPrivateSection()) {
            return this.i18n("plugin.calendar.component.calendarPanel.sidebar.private");
        }
        else if (this.isAllTasks()) {
            return this.i18n("plugin.calendar.component.calendarPanel.sidebar.all");
        }
        else if (this.isTasksAssignedToMe()) {
            return this.i18n("plugin.calendar.component.calendarPanel.sidebar.assigned-to-me");
        }
        else if (this.isTasksCreatedByMe()) {
            return this.i18n("plugin.calendar.component.calendarPanel.sidebar.created-by-me");
        }
        else if (this.isTrash()) {
            return this.i18n("plugin.calendar.component.calendarPanel.sidebar.trash");
        }
        else {
            return this.getActiveProject().getName();
        }
    };
    CalendarPanelController.prototype.getActiveProject = function () {
        return this.calendarPlugin.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
    };
    CalendarPanelController.prototype.getActiveSection = function () {
        return this.session.sectionManager.getSection(this.activeProjectId);
    };
    CalendarPanelController.prototype.getActiveConv2Section = function () {
        return this.calendarPlugin.tasksPlugin.getConv2Section(this.session, this.activeProjectId);
    };
    CalendarPanelController.prototype.getActiveConv2Users = function () {
        return this.calendarPlugin.tasksPlugin.getConv2Users(this.session, this.activeProjectId, true);
    };
    CalendarPanelController.prototype.getActiveSectionService = function () {
        if (this.isConv2Section()) {
            var conv2Section = this.getActiveConv2Section();
            if (conv2Section && conv2Section.section) {
                return conv2Section.section;
            }
        }
        else if (this.isRegularSection()) {
            return this.getActiveSection();
        }
        return null;
    };
    CalendarPanelController.prototype.isAllTasks = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID;
    };
    CalendarPanelController.prototype.isTasksAssignedToMe = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
    };
    CalendarPanelController.prototype.isTasksCreatedByMe = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID;
    };
    CalendarPanelController.prototype.isTrash = function () {
        return this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID;
    };
    CalendarPanelController.prototype.isFixedSection = function () {
        return this.isAllTasks() || this.isTasksAssignedToMe() || this.isTasksCreatedByMe() || this.isTrash();
    };
    CalendarPanelController.prototype.combinesMultipleSections = function () {
        return this.isFixedSection() || this.isConv2Section();
    };
    CalendarPanelController.prototype.isRegularSection = function () {
        return !this.isFixedSection() && !this.isConv2Section();
    };
    CalendarPanelController.prototype.isConv2Section = function () {
        return this.calendarPlugin.tasksPlugin.isConv2Project(this.activeProjectId);
    };
    CalendarPanelController.prototype.isPrivateSection = function () {
        return this.activeProjectId == this.calendarPlugin.tasksPlugin.getPrivateSectionId();
    };
    CalendarPanelController.prototype.beforeActivate = function () {
        this.requestDayPreview(this.previewDay);
        this.requestTaskPreview(this.previewTask);
    };
    CalendarPanelController.prototype.activate = function () {
        this.isActive = true;
        this.callViewMethod("activate");
        this.updatePreview();
    };
    CalendarPanelController.prototype.deactivate = function () {
        this.isActive = false;
        this.callViewMethod("deactivate");
    };
    CalendarPanelController.prototype.onViewRequestDayPreview = function (day) {
        this.requestDayPreview(day);
    };
    CalendarPanelController.prototype.requestDayPreview = function (day) {
        this.previewDay = day;
        this.dispatchEvent({
            type: "calendar-day-preview-request",
            day: day,
        });
    };
    CalendarPanelController.prototype.updateDayPreview = function () {
        this.requestDayPreview(this.previewDay);
    };
    CalendarPanelController.prototype.onViewRequestTaskPreview = function (task) {
        this.requestTaskPreview(task);
    };
    CalendarPanelController.prototype.requestTaskPreview = function (task) {
        this.previewTask = task;
        this.dispatchEvent({
            type: "calendar-task-preview-request",
            task: task,
            hostHash: this.session.hostHash,
        });
    };
    CalendarPanelController.prototype.updateTaskPreview = function () {
        this.requestTaskPreview(this.previewTask);
    };
    CalendarPanelController.prototype.markTaskAsSelected = function (taskId) {
        var _this = this;
        this.previewTask = taskId;
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("markTaskAsSelected", taskId);
        });
    };
    CalendarPanelController.prototype.updatePreview = function () {
        this.updateDayPreview();
        this.updateTaskPreview();
    };
    CalendarPanelController.prototype.setSelectedDate = function (d, m, y) {
        this.callViewMethod("selectDay", d + "." + m + "." + y);
        this.goToDate(d, m, y);
    };
    CalendarPanelController.prototype.onDataChanged = function (type, id, action) {
        if (type == "task") {
            var task = null;
            if (action == "added" || action == "modified" || action == "section-changed") {
                task = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][id];
            }
            else if (action == "deleted") {
                task = null;
                if (this.previewTask == id) {
                    this.requestTaskPreview(null);
                }
            }
            var isTrash = this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID;
            if (task && isTrash == task.getIsTrashed()) {
                this.sendTaskToView(task);
            }
            else {
                this.delTaskFromView(id);
                if (this.previewTask == id) {
                    this.requestTaskPreview(null);
                }
            }
        }
    };
    CalendarPanelController.prototype.resendTasksToView = function () {
        if (!this.currDataModel) {
            return;
        }
        var relevantTasks = this.getRelevantTasks();
        var tasksModels = this.convertTasks(relevantTasks);
        this.currDataModel.tasks = tasksModels;
        this.callViewMethod("setTasks", JSON.stringify(tasksModels), true);
    };
    CalendarPanelController.prototype.sendTaskToView = function (task) {
        if (this.isTaskRelevant(task.getId())) {
            var m = this.convertTask(task);
            this.currDataModel.tasks[task.getId()] = m;
            this.callViewMethod("setTask", JSON.stringify(m));
        }
        else if (task.getId() in this.currDataModel.tasks) {
            this.delTaskFromView(task.getId());
        }
    };
    CalendarPanelController.prototype.delTaskFromView = function (taskId) {
        delete this.currDataModel.tasks[taskId];
        this.callViewMethod("delTask", taskId);
    };
    CalendarPanelController.prototype.convertTask = function (task) {
        var _this = this;
        var start = task.getStartTimestamp();
        var end = task.getEndTimestamp();
        var td = this.getTaskTitleAndDescriptionText(task);
        return {
            id: task.getId(),
            title: td.title + " " + td.description,
            status: task.getStatus(),
            labelClass: task.getLabelClass(),
            startTimestamp: start,
            endTimestamp: end,
            wholeDays: task.getWholeDays(),
            taskGroupIcons: task.getTaskGroupIds()
                .map(function (tgId) { return _this.calendarPlugin.tasksPlugin.taskGroups[_this.session.hostHash][tgId]; })
                .filter(function (tg) { return tg != null; })
                .map(function (tg) { return tg.getIcon(); })
                .filter(function (iconStr) { return iconStr != null; })
                .map(function (iconStr) { return JSON.parse(iconStr); }),
        };
    };
    CalendarPanelController.prototype.convertTasks = function (tasks) {
        var res = {};
        for (var id in tasks) {
            res[id] = this.convertTask(tasks[id]);
        }
        return res;
    };
    CalendarPanelController.prototype.getRelevantTasks = function () {
        var extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);
        ;
        var tasks = {};
        for (var tId in this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash]) {
            if (this.isTaskRelevant(tId, extraCalendars)) {
                tasks[tId] = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][tId];
            }
        }
        return tasks;
    };
    CalendarPanelController.prototype.isTaskRelevant = function (tId, cachedExtraCalendars) {
        if (cachedExtraCalendars === void 0) { cachedExtraCalendars = null; }
        if (cachedExtraCalendars === null) {
            cachedExtraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);
            ;
        }
        if (!cachedExtraCalendars || !Array.isArray(cachedExtraCalendars)) {
            cachedExtraCalendars = [];
        }
        var myId = this.calendarPlugin.tasksPlugin.getMyId(this.session);
        var all = this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        var isTrash = this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID;
        var isConv2Section = !!this.getActiveConv2Section();
        var taskProjectId = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][tId].getProjectId();
        if (all || taskProjectId == this.activeProjectId || cachedExtraCalendars.indexOf(taskProjectId) >= 0) {
            var task = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][tId];
            if (isTrash != task.getIsTrashed()) {
                return false;
            }
            if (!task.getStartTimestamp()) {
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
    CalendarPanelController.prototype.isAssignedToCurrConv2Section = function (task) {
        var arr = task.getAssignedTo();
        for (var _i = 0, _a = this.getActiveConv2Users(); _i < _a.length; _i++) {
            var u = _a[_i];
            if (arr.indexOf(u) < 0) {
                return false;
            }
        }
        return true;
    };
    CalendarPanelController.prototype.getTaskTitleAndDescriptionText = function (task) {
        var str = task.getDescription();
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
    CalendarPanelController.prototype.fixHtmlString = function (str) {
        return str.replace(/<[^>]*>?/gm, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
    };
    CalendarPanelController.prototype.onViewSetTaskStartTimestamp = function (taskId, dtStart) {
        var task = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][taskId];
        if (task) {
            var prevDtStart = task.getStartTimestamp();
            var prevDtEnd = task.getEndTimestamp();
            if (prevDtStart == dtStart) {
                return;
            }
            var dtEnd = null;
            if (prevDtEnd) {
                dtEnd = (prevDtEnd - prevDtStart) + dtStart;
            }
            var now = new Date().getTime();
            var myId = this.calendarPlugin.tasksPlugin.getMyId(this.session);
            task.addHistory({
                when: now,
                who: myId,
                what: "modified",
                arg: "startTimestamp",
                oldVal: task.getStartTimestamp(),
                newVal: dtStart,
            });
            task.addHistory({
                when: now,
                who: myId,
                what: "modified",
                arg: "endTimestamp",
                oldVal: task.getEndTimestamp(),
                newVal: dtEnd,
            });
            task.setStartTimestamp(dtStart);
            task.setEndTimestamp(dtEnd);
            task.setModifiedBy(myId);
            task.setModifiedDateTime(now);
            this.calendarPlugin.tasksPlugin.saveTask(this.session, task);
        }
    };
    CalendarPanelController.prototype.getSettings = function () {
        var settings = {};
        for (var name_1 in this.calendarPlugin.viewSettings.settingsInfo) {
            settings[name_1] = this.getSetting(name_1);
        }
        return settings;
    };
    CalendarPanelController.prototype.getSetting = function (name) {
        var val = this.calendarPlugin.getSetting(this.session, name, this.activeProjectId, this.context);
        return typeof (val) == "string" ? val : val == 1;
    };
    CalendarPanelController.prototype.getIntSetting = function (name) {
        return this.calendarPlugin.getSetting(this.session, name, this.activeProjectId, this.context);
    };
    CalendarPanelController.prototype.setSetting = function (name, value) {
        this.calendarPlugin.saveSetting(this.session, name, typeof (value) == "string" ? value : (value ? 1 : 0), this.activeProjectId, this.context);
    };
    CalendarPanelController.prototype.setIntSetting = function (name, value) {
        this.calendarPlugin.saveSetting(this.session, name, value, this.activeProjectId, this.context);
    };
    CalendarPanelController.prototype.onViewSettingChanged = function (name, value, dispatchEvent) {
        if (this.activeProjectId == null || !this.calendarPlugin.viewSettings.hasProject(this.session, this.activeProjectId)) {
            return;
        }
        if (this.calendarPlugin.viewSettings.hasSetting(this.session, name, this.activeProjectId, this.context)) {
            if (typeof (value) == "boolean") {
                value = value ? 1 : 0;
            }
            this.setSetting(name, value);
        }
        if (name == "mode") {
            this.onModeChange();
            this.updateDatePicker();
        }
        if (name == "filter") {
            this.callViewMethod("updateCustomSelectFilter", value);
        }
        if (dispatchEvent) {
            this.app.dispatchEvent({
                type: "calendar-setting-changed",
                setting: name,
                value: value,
                sourceProjectId: this.activeProjectId,
                sourceContext: this.context,
                sourceUniqueId: this.uniqueId,
            });
            if (name == "enable-day-preview-panel") {
                this.setEnableDayPreviewPanel(!!value);
            }
            else if (name == "show-task-preview-panel") {
                this.setShowTaskPreviewPanel(!!value);
            }
            else if (name == "horizontal-task-preview-window-layout") {
                this.setTaskPreviewPanelLayout(!!value);
            }
        }
    };
    CalendarPanelController.prototype.watchSettingsChanges = function () {
        var _this = this;
        this.bindEvent(this.app, "calendar-setting-changed", function (event) {
            if (event.sourceUniqueId != _this.uniqueId) {
                if (event.sourceProjectId != _this.activeProjectId && _this.calendarPlugin.viewSettings.isSettingProjectIsolated(event.setting)) {
                    return;
                }
                if (event.sourceContext != _this.context && _this.calendarPlugin.viewSettings.isSettingContextIsolated(event.setting)) {
                    return;
                }
                _this.callViewMethod("settingChanged", event.setting, event.value, false);
            }
        });
    };
    CalendarPanelController.prototype.setEnableDayPreviewPanel = function (value) {
        this.dispatchEvent({
            type: "calendar-day-preview-change-visibility-request",
            show: value,
        });
    };
    CalendarPanelController.prototype.setShowTaskPreviewPanel = function (value) {
        this.dispatchEvent({
            type: "calendar-task-preview-change-visibility-request",
            show: value,
        });
    };
    CalendarPanelController.prototype.setTaskPreviewPanelLayout = function (horizontal) {
        this.dispatchEvent({
            type: "horizontal-calendar-task-preview-window-layout-change-request",
            horizontalLayout: horizontal,
        });
    };
    CalendarPanelController.prototype.updateTaskPreviewPanel = function () {
        this.dispatchEvent({
            type: "calendar-preview-update-request",
        });
    };
    CalendarPanelController.prototype.updateDatePicker = function () {
        if (!this.currDataModel) {
            return;
        }
        this.datePicker.currDataModel.selectedDay = this.currDataModel.selectedDay;
        this.datePicker.currDataModel.selectedMonth = this.currDataModel.selectedMonth;
        this.datePicker.currDataModel.selectedYear = this.currDataModel.selectedYear;
        this.datePicker.setOptions(this.getDatePickerOptions());
    };
    CalendarPanelController.prototype.onDatePickerValueChanged = function (force) {
        if (force === void 0) { force = false; }
        if (!this.currDataModel || this.ign) {
            this.ign = false;
            return;
        }
        if (!force) {
            if (this.currDataModel.selectedDay == this.datePicker.currDataModel.selectedDay
                && this.currDataModel.selectedMonth == this.datePicker.currDataModel.selectedMonth
                && this.currDataModel.selectedYear == this.datePicker.currDataModel.selectedYear) {
                return;
            }
        }
        this.currDataModel.selectedDay = this.datePicker.currDataModel.selectedDay;
        this.currDataModel.selectedMonth = this.datePicker.currDataModel.selectedMonth;
        this.currDataModel.selectedYear = this.datePicker.currDataModel.selectedYear;
        this.callViewMethod("setSelectedDate", this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
    };
    CalendarPanelController.prototype.onViewSetSelectedDate = function (d, m, y) {
        if (!this.currDataModel) {
            return;
        }
        if (this.datePicker.currDataModel.selectedDay == d
            && this.datePicker.currDataModel.selectedMonth == m
            && this.datePicker.currDataModel.selectedYear == y) {
            return;
        }
        this.ign = true;
        this.datePicker.currDataModel.selectedDay = d;
        this.datePicker.currDataModel.selectedMonth = m;
        this.datePicker.currDataModel.selectedYear = y;
        this.currDataModel.selectedDay = this.datePicker.currDataModel.selectedDay;
        this.currDataModel.selectedMonth = this.datePicker.currDataModel.selectedMonth;
        this.currDataModel.selectedYear = this.datePicker.currDataModel.selectedYear;
        this.datePicker.setDate(d, m, y);
    };
    CalendarPanelController.prototype.goToDate = function (d, m, y) {
        if (!this.currDataModel) {
            return;
        }
        this.currDataModel.selectedDay = d;
        this.currDataModel.selectedMonth = m;
        this.currDataModel.selectedYear = y;
        this.updateDatePicker();
        this.datePicker.updateDateCustomSelects();
        this.onDatePickerValueChanged(true);
    };
    CalendarPanelController.prototype.getDatePickerOptions = function () {
        var mode = this.getSetting("mode");
        if (this._overrideMode) {
            mode = this._overrideMode;
        }
        if (mode == Types_1.Modes.MONTH) {
            return {
                day: false,
                buttons: false,
                today: true,
            };
        }
        if (mode == Types_1.Modes.WEEK || mode == Types_1.Modes.SINGLE_WEEK || mode == Types_1.Modes.SINGLE_DAY) {
            return {
                day: true,
                month: true,
                buttons: false,
                today: true,
            };
        }
    };
    CalendarPanelController.prototype.onViewPrev = function () {
        this.datePicker.prev();
    };
    CalendarPanelController.prototype.onViewNext = function () {
        this.datePicker.next();
    };
    CalendarPanelController.prototype.getOtherPluginTarget = function (id) {
        if (id == this.calendarPlugin.getPrivateSectionId()) {
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
    CalendarPanelController.prototype.onViewNewTask = function (ts, actionId) {
        if (ts === void 0) { ts = null; }
        if (actionId === void 0) { actionId = null; }
        var section = null;
        var assignTo = [];
        if (this.combinesMultipleSections()) {
            if (this.isConv2Section()) {
                section = false;
                assignTo = this.getActiveConv2Users();
            }
            else {
                section = this.calendarPlugin.getPrivateSection();
            }
        }
        else {
            section = this.getActiveSection();
        }
        var dt = ts ? new Date(ts) : new Date();
        var msecs = (dt.getHours() * 3600 + dt.getMinutes() * 60) * 1000;
        var rounding = 60 * 60 * 1000;
        msecs = Math.round(msecs / rounding) * rounding;
        var hs = Math.floor(msecs / 3600000);
        var ms = Math.floor((msecs - hs * 3600000) / 60000);
        dt.setHours(hs);
        dt.setMinutes(ms);
        dt.setSeconds(0);
        dt.setMilliseconds(0);
        this.calendarPlugin.tasksPlugin.openNewTaskWindow(this.session, section, [], null, dt, assignTo, actionId == "new-whole-day");
    };
    CalendarPanelController.prototype.onViewOpenTask = function (taskId) {
        this.calendarPlugin.tasksPlugin.openEditTaskWindow(this.session, taskId, true, true);
    };
    CalendarPanelController.prototype.onViewUpdateLeftCalendarFromDayPreview = function (d, m, y) {
        var currMode = this._overrideMode ? this._overrideMode : this.currMode;
        if (currMode == Types_1.Modes.SINGLE_DAY && this.calendarId == 2 && this.afterUserPreviewDayChange) {
            this.afterUserPreviewDayChange(d, m, y);
        }
    };
    CalendarPanelController.prototype.onViewGoToToday = function () {
        if (this.afterUserGoToToday) {
            this.afterUserGoToToday();
        }
    };
    CalendarPanelController.prototype.overrideMode = function (mode) {
        var _this = this;
        this._overrideMode = mode;
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("overrideMode", mode);
        });
    };
    CalendarPanelController.prototype.onModeChange = function () {
        var mode = this.getSetting("mode");
        if (this.currMode != mode) {
            this.currMode = mode;
            this.callViewMethod("updateCustomSelectMode", mode);
            this.callViewMethod("setSelectedDate", this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
            if (this.modeChanged) {
                this.modeChanged(this.currMode);
            }
        }
    };
    CalendarPanelController.prototype.getCustomSelectFilterItems = function () {
        var arr = [];
        var filters = [
            "all-tasks",
            "only-idea",
            "only-todo",
            "only-in-progress",
            "only-done",
            "only-not-done",
        ];
        var curr = this.getSetting("filter");
        for (var _i = 0, filters_1 = filters; _i < filters_1.length; _i++) {
            var filter = filters_1[_i];
            arr.push({
                type: "item",
                value: filter,
                text: this.i18n("plugin.calendar.component.calendarPanel.filter.show-" + filter),
                textNoEscape: true,
                icon: null,
                selected: curr == filter,
                extraClass: "filter-show-" + filter,
            });
        }
        return arr;
    };
    CalendarPanelController.prototype.getCustomSelectExtraCalendarsItems = function () {
        var arr = [];
        var extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);
        for (var _i = 0, _a = this.calendarPlugin.mergableSections[this.session.hostHash].list; _i < _a.length; _i++) {
            var section = _a[_i];
            var project = this.calendarPlugin.tasksPlugin.getProject(this.session, section.getId());
            if (!project || project.getId() == this.activeProjectId) {
                continue;
            }
            arr.push({
                type: "item",
                value: project.getId(),
                text: this.getFullProjectName(project),
                icon: null,
                selected: extraCalendars.indexOf(project.getId()) >= 0,
            });
        }
        return arr.sort(function (a, b) { return a.text.localeCompare(b.text); });
    };
    CalendarPanelController.prototype.onViewSetExtraCalendars = function (str) {
        var projectIds = str.split(",").filter(function (x) { return !!x; });
        this.calendarPlugin.setExtraCalendars(this.session, this.activeProjectId, projectIds, this.uniqueId);
        this.resendTasksToView();
        this.resendFilesToView();
    };
    CalendarPanelController.prototype.getFullProjectName = function (project) {
        var section = this.session.sectionManager.getSection(project.getId());
        var projectNames = [];
        while (section) {
            var project_1 = this.calendarPlugin.tasksPlugin.getProject(this.session, section.getId());
            var projectName = project_1 ? project_1.getName() : section.getName();
            projectNames.push(projectName);
            section = section.getParent();
        }
        return projectNames.reverse().join(" / ");
    };
    CalendarPanelController.prototype.getRelevantFileModels = function () {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        var extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);
        var relevantFileModels = {};
        for (var identifier in this.calendarPlugin.fileModels[this.session.hostHash]) {
            if (this.isFileRelevant(identifier, extraCalendars)) {
                relevantFileModels[identifier] = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
            }
        }
        return relevantFileModels;
    };
    CalendarPanelController.prototype.isFileRelevant = function (identifier, cachedExtraCalendars) {
        if (cachedExtraCalendars === void 0) { cachedExtraCalendars = null; }
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        if (cachedExtraCalendars === null) {
            cachedExtraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);
            ;
        }
        if (!cachedExtraCalendars || !Array.isArray(cachedExtraCalendars)) {
            cachedExtraCalendars = [];
        }
        var all = this.activeProjectId == Types_1.CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        var isTrash = this.activeProjectId == Types_1.CustomTasksElements.TRASH_ID;
        var isConv2Section = !!this.getActiveConv2Section();
        var fileProjectId = this.calendarPlugin.fileModels[this.session.hostHash][identifier].sectionId;
        if (all || fileProjectId == this.activeProjectId || cachedExtraCalendars.indexOf(fileProjectId) >= 0) {
            var fileModel = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
            var isTrashed = fileModel.trashed;
            if (isTrash != isTrashed) {
                return false;
            }
            if (!fileModel.createdAt) {
                return false;
            }
            if (fileModel
                && (!isConv2Section || this.isFileInCurrConv2Section(identifier))
                && (this.activeProjectId != Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.isFileCreatedByMe(identifier))
                && (this.activeProjectId != Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.isFileAssignedToMe(identifier))) {
                return true;
            }
        }
        return false;
    };
    CalendarPanelController.prototype.isFileInCurrConv2Section = function (identifier) {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        var createdBy = this.calendarPlugin.fileModels[this.session.hostHash][identifier].createdBy;
        return this.getActiveConv2Users().indexOf(createdBy) >= 0;
    };
    CalendarPanelController.prototype.isFileAssignedToMe = function (identifier) {
        return false;
    };
    CalendarPanelController.prototype.isFileCreatedByMe = function (identifier) {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        var createdBy = this.calendarPlugin.fileModels[this.session.hostHash][identifier].createdBy;
        return createdBy == this.calendarPlugin.tasksPlugin.getMyId(this.session);
    };
    CalendarPanelController.prototype.convertFile = function (entry) {
        return this.calendarPlugin.convertFile(entry);
    };
    CalendarPanelController.prototype.resendFilesToView = function () {
        if (!this.currDataModel) {
            return;
        }
        var relevantFileModels = this.getRelevantFileModels();
        this.currDataModel.files = relevantFileModels;
        this.callViewMethod("setFileModels", JSON.stringify(relevantFileModels), true);
    };
    CalendarPanelController.prototype.sendFileToView = function (identifier) {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        if (!this.currDataModel) {
            return;
        }
        if (this.isFileRelevant(identifier)) {
            var m = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
            this.currDataModel.files[identifier] = m;
            this.callViewMethod("setFileModel", JSON.stringify(m));
        }
        else if (identifier in this.currDataModel.files) {
            this.delFileFromView(identifier);
        }
    };
    CalendarPanelController.prototype.delFileFromView = function (identifier) {
        if (!this.currDataModel) {
            return;
        }
        delete this.currDataModel.files[identifier];
        this.callViewMethod("delFileModel", identifier);
    };
    CalendarPanelController.prototype.getFileIdentifier = function (entry) {
        return this.calendarPlugin.getFileIdentifier(entry);
    };
    CalendarPanelController.prototype.splitFileIdentifier = function (identifier) {
        return this.calendarPlugin.splitFileIdentifier(identifier);
    };
    CalendarPanelController.prototype.onViewOpenFile = function (identifier) {
        var _this = this;
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        var fileModel = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
        if (!fileModel) {
            return;
        }
        var section = this.session.sectionManager.getSection(fileModel.sectionId);
        if (!section) {
            return;
        }
        section.getFileOpenableElement(fileModel.path, false).then(function (osf) {
            _this.actionOpenableElement(osf);
        });
    };
    CalendarPanelController.prototype.actionOpenableElement = function (element) {
        var resolvedApp = this.app.shellRegistry.resolveApplicationByElement({ element: element, session: this.session });
        if (resolvedApp.id == "core.unsupported") {
            this.app.shellRegistry.shellOpen({
                session: this.session,
                action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.DOWNLOAD,
                element: element,
            });
            return;
        }
        if (resolvedApp.id == "plugin.editor") {
            this.app.shellRegistry.shellOpen({
                session: this.session,
                element: element,
                action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW,
            });
            return;
        }
        this.app.shellRegistry.shellOpen({
            session: this.session,
            element: element,
            action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW,
        });
    };
    CalendarPanelController.prototype.setSession = function (session) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.session = session;
            _this.registerChangeEvent(session.conv2Service.personService.persons.changeEvent, function (person) { return _this.onPersonChange(session, person); });
            _this.calendarPlugin.mergableSections[_this.session.hostHash].changeEvent.add(function () {
                _this.customSelectExtraCalendars.setItems(_this.getCustomSelectExtraCalendarsItems());
            });
        });
    };
    CalendarPanelController.textsPrefix = "plugin.calendar.component.calendarPanel.";
    CalendarPanelController = __decorate([
        Dependencies(["persons", "notification", "customselect"])
    ], CalendarPanelController);
    return CalendarPanelController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.CalendarPanelController = CalendarPanelController;
CalendarPanelController.prototype.className = "com.privmx.plugin.calendar.component.calendarPanel.CalendarPanelController";

//# sourceMappingURL=CalendarPanelController.js.map
