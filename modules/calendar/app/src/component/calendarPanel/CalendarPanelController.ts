import { component, mail, utils, window, Q, Types, app } from "pmc-mail";
import { CalendarDayPreviewRequestEvent, CalendarTaskPreviewRequestEvent, CalendarPlugin, HorizontalCalendarTaskPreviewWindowLayoutChangeRequestEvent, CalendarTaskPreviewChangeVisibilityRequestEvent, CalendarPreviewUpdateRequestEvent, CalendarSettingChanged, CalendarComponentFactory, CalendarDayPreviewChangeVisibilityRequestEvent, CalendarsRefresh, CalendarsFileAdded, CalendarsFileRemoved, ExtraCalendarsChanged } from "../../main/CalendarPlugin";
import { Watchable, Action, TasksMap, TaskGroupIcon } from "privfs-mail-client-tasks-plugin/src/main/Types";
import { Project } from "privfs-mail-client-tasks-plugin/src/main/data/Project";
import { TasksFilterUpdater, TasksFilterData } from "privfs-mail-client-tasks-plugin/src/component/taskGroupsPanel/TaskGroupsPanelController";
import { CustomTasksElements, ViewContext, Modes } from "../../main/Types";
import { Task, TaskStatus } from "privfs-mail-client-tasks-plugin/src/main/data/Task";
import { DatePickerController, DatePickerOptions } from "../datePicker/DatePickerController";
import { i18n } from "./i18n/index";
import Dependencies = utils.decorators.Dependencies;

export interface Model {
    calendarId: number;
    projectId: string;
    projectName: string;
    privateSectionId: string;
    uniqueSafeId: string;
    conv2Model: Types.webUtils.ConversationModel;
    settings: { [name: string]: boolean|string };
    taskStatuses: string[];
    canCreateNewTasks: boolean;
    searchStr: string;
    
    isPublic: boolean;
    isConv2Section: boolean;
    isAllTasks: boolean;
    isTasksAssignedToMe: boolean;
    isTasksCreatedByMe: boolean;
    isTrash: boolean;
    isFixedSection: boolean;
    isRegularSection: boolean;
    isPrivateSection: boolean;
    combinesMultipleSections: boolean;
    
    isInSummaryWindow: boolean;
    otherPluginsAvailability: { chat: boolean, notes: boolean, tasks: boolean };
    
    tasks: { [id: string]: TaskModel };
    files: { [path: string]: FileModel };
    
    myHashmail: string;
    
    selectedDay: number;
    selectedMonth: number;
    selectedYear: number;
    
    extraCalendars: string[];
    canChooseExtraCalendars: boolean;
}

export interface TaskModel {
    id: string;
    title: string;
    status: TaskStatus;
    labelClass: string;
    startTimestamp: number;
    endTimestamp: number;
    wholeDays: boolean;
    taskGroupIcons: TaskGroupIcon[];
}

export interface FileModel {
    path: string;
    sectionId: string;
    createdAt: number;
    createdBy: string;
    modifiedAt: number;
    modifiedBy: string;
    identifier: string;
    fileName: string;
    icon: string;
    trashed: boolean;
}

@Dependencies(["persons", "notification", "customselect"])
export class CalendarPanelController extends window.base.WindowComponentController<window.base.BaseWindowController> {
    
    static textsPrefix: string = "plugin.calendar.component.calendarPanel.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    // @Inject client: privfs.core.Client;
    
    calendarPlugin: CalendarPlugin;
    uniqueId: string;
    calendarId: number;
    dataChangedListener: (type: Watchable, id: string, action: Action) => void;
    activeProjectId: string;
    wasDataSet: boolean = false;
    currDataModel: Model;
    isActive: boolean = false;
    previewDay: string = null;
    previewTask: string = null;
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    tasksFilterUpdater: TasksFilterUpdater;
    context: ViewContext = ViewContext.CalendarWindow;
    customSelectMode: component.customselect.CustomSelectController;
    customSelectFilter: component.customselect.CustomSelectController;
    customSelectExtraCalendars: component.customselect.CustomSelectController;
    datePicker: DatePickerController;
    // personsComponent: component.persons.PersonsController;
    notifications: component.notification.NotificationController;
    taskTooltip: component.tasktooltip.TaskTooltipController;
    fileTooltip: component.filetooltip.FileTooltipController;
    componentFactory: CalendarComponentFactory;
    isRefreshing: boolean = false;
    afterUserPreviewDayChange: (d: number, m: number, y: number) => void = null;
    afterUserGoToToday: () => void = null;
    
    session: mail.session.Session;
    
    constructor(
        parent: window.base.BaseWindowController,
        public personsComponent: component.persons.PersonsController
    ) {
        super(parent);
        this.ipcMode = true;
        this.calendarPlugin = this.app.getComponent("calendar-plugin");
        this.uniqueId = this.calendarPlugin.tasksPlugin.nextUniqueId();
        this.session = this.app.sessionManager.getLocalSession();
        
        this.customSelectMode = this.addComponent("customSelectMode", this.componentFactory.createComponent("customselect", [this, {
            multi: false,
            editable: true,
            firstItemIsStandalone: false,
            items: [],
        }]));
        this.customSelectFilter = this.addComponent("customSelectFilter", this.componentFactory.createComponent("customselect", [this, {
            multi: false,
            editable: true,
            firstItemIsStandalone: false,
            items: [],
        }]));
        this.customSelectExtraCalendars = this.addComponent("customSelectExtraCalendars", this.componentFactory.createComponent("customselect", [this, {
            multi: true,
            editable: true,
            firstItemIsStandalone: false,
            headerText: this.i18n("plugin.calendar.component.calendarPanel.extraCalendars.dropdown.header"),
            items: [],
        }]));
        this.datePicker = this.addComponent("datePicker", this.componentFactory.createComponent("datePicker", [this, { }]));
        // this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            if (!this.getSetting("show-task-tooltip")) {
                return null;
            }
            return this.calendarPlugin.tasksPlugin.getTaskTooltipContent(this.session, taskId);
        };
        this.fileTooltip = this.addComponent("filetooltip", this.componentFactory.createComponent("filetooltip", [this]));
        this.fileTooltip.isEnabled = (): boolean => {
            return !!this.getSetting("show-task-tooltip");
        };
        this.datePicker.onValueChanged(this.onDatePickerValueChanged.bind(this));
        this.bindEvent<CalendarsRefresh>(this.app, "calendars-refresh", event => {
            if (this.isActive) {
                this.refresh(event.hard, event.showNotifications);
            }
        });
        
        this.bindEvent<CalendarsFileAdded>(this.app, "calendars-file-added", e => {
            if (e.hostHash != this.session.hostHash) {
                return;
            }
            if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
                this.calendarPlugin.fileModels[this.session.hostHash] = {};
            }
            let isTrash = this.activeProjectId == CustomTasksElements.TRASH_ID;
            let model = this.calendarPlugin.fileModels[this.session.hostHash][e.identifier];
            if (model && model.trashed == isTrash) {
                this.sendFileToView(model.identifier);
            }
        });
        this.bindEvent<CalendarsFileRemoved>(this.app, "calendars-file-removed", e => {
            if (e.hostHash != this.session.hostHash) {
                return;
            }
            this.delFileFromView(e.identifier);
        });
        this.bindEvent<ExtraCalendarsChanged>(this.app, "extra-calendars-changed", e => {
            if (e.hostHash != this.session.hostHash) {
                return;
            }
            if (this.uniqueId != e.senderId && this.activeProjectId == e.mainProjectId) {
                (this.customSelectExtraCalendars as any).setItems(this.getCustomSelectExtraCalendarsItems(), true);
                this.resendTasksToView();
                this.resendFilesToView();
            }
        });
    }
    
    init(): Q.Promise<void> {
        this.watchSettingsChanges();
        this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterTasks, "multi");
        this.registerChangeEvent(this.calendarPlugin.personService.persons.changeEvent, person => this.onPersonChange(this.app.sessionManager.getLocalSession(), person));
        this.tasksFilterUpdater = this.calendarPlugin.tasksPlugin.newTasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = () => {
            this.updateSearchFilter(this.tasksFilterUpdater.filter);
        };
        return Q().then(() => {
            return Q.all([
                this.customSelectMode.init(),
                this.customSelectFilter.init(),
                this.datePicker.init(),
                this.customSelectExtraCalendars.init(),
            ]);
        })
        .thenResolve(null);
    }
    
    onPersonChange(session: mail.session.Session, person: mail.person.Person): void {
        this.callViewMethod("updatePersonPresence", person.getHashmail(), person.isPresent());
    }

    onViewLoad(): void {
        this.afterViewLoaded.resolve();
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    }
    
    getModel(): string {
        return null;
    }
    
    getDataModel(): string {
        this.currDataModel = null;
        if (!this.activeProjectId) {
            return null;
        }
        this.customSelectMode.setItems(this.getCustomSelectModeItems());
        this.customSelectFilter.setItems(this.getCustomSelectFilterItems());
        let projectId = this.activeProjectId;
        let section = this.getActiveSection();
        // console.log("getActiveSection vs getActiveProject", this.getActiveSection(), this.getActiveProject())
        // console.log("getDataModel - section", section);
        let projectName = this.getActiveSectionName();
        // console.log("projectName", projectName);
        let relevantTasks = this.getRelevantTasks();
        // console.log("getDataModel - relevant tasks", relevantTasks);
        let tasksModels = this.convertTasks(relevantTasks);
        // console.log("getDataModel - tasksModels", tasksModels);
        this.currMode = this.getSetting("mode");
        let extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, projectId);
        let relevantFileModels = this.getRelevantFileModels();
        this.customSelectExtraCalendars.setItems(this.getCustomSelectExtraCalendarsItems());
        
        let now = new Date();
        let model: Model = {
            calendarId: this.calendarId,
            projectId: projectId,
            projectName: projectName,
            privateSectionId: this.calendarPlugin.getPrivateSectionId(),
            uniqueSafeId: this._getUniqueSafeId(),
            conv2Model: this.isConv2Section() ? utils.Converter.convertConv2(this.getActiveConv2Section(), 0, null, 0, true, 0, false, false, false, null) : null,
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
            selectedYear:  now.getFullYear(),
            
            extraCalendars: extraCalendars,
            canChooseExtraCalendars: !!this.calendarPlugin.mergableSections[this.session.hostHash].find(x => x.getId() == projectId),
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    }
    
    private _getUniqueSafeId(): string {
        return `calendar${this.uniqueId}`;
    }
    
    getCustomSelectModeItems(): component.customselect.CustomSelectItem[] {
        let arr: component.customselect.CustomSelectItem[] = [];
        let modes = [
            Modes.MONTH,
            // Modes.WEEK,
            Modes.SINGLE_WEEK,
            Modes.SINGLE_DAY,
        ];
        let curr = this.getSetting("mode");
        for (let mode of modes) {
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
    }
    
    beforeClose(): void {
        if (this.dataChangedListener) {
            this.calendarPlugin.tasksPlugin.unWatch(this.session, "*", "*", "*", this.dataChangedListener);
        }
    }
    
    updateSearchFilter(data: TasksFilterData): void {
        let searchStr = data.visible ? data.value : "";
        this.callViewMethod("applySearchFilter", searchStr);
    }
    
    onFilterTasks() {
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    }
    
    getOtherPluginsAvailability(): { chat: boolean, notes: boolean, tasks: boolean } {
        return { chat: false, notes: false, tasks: false };
        // let active = this.getActiveSection();
        // let chatPresent = this.calendarPlugin.tasksPlugin.isChatPluginPresent();
        // let notesPresent = this.calendarPlugin.tasksPlugin.isNotes2PluginPresent();
        // let hasChat = active && chatPresent && active.isChatModuleEnabled();
        // let hasNotes = active && notesPresent && active.isFileModuleEnabled();
        // let hasTasks = !!active;
        // if (this.activeProjectId == CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == CustomTasksElements.TRASH_ID) {
        //     hasChat = false;
        //     hasNotes = notesPresent;
        // }
        // else if (this.activeProjectId == this.calendarPlugin.tasksPlugin.getPrivateSectionId()) {
        //     hasChat = chatPresent;
        //     hasNotes = notesPresent;
        // }
        // else if (this.isConv2Section()) {
        //     hasChat = chatPresent;
        //     hasNotes = notesPresent;
        // }
        // return {
        //     chat: hasChat,
        //     notes: hasNotes,
        //     tasks: hasTasks,
        // };
    }
    
    onViewRefresh(hard: boolean = true, showNotification: boolean = true): void {
        if (this.calendarId == 1) {
            this.app.dispatchEvent<CalendarsRefresh>({
                type: "calendars-refresh",
                hard: hard,
                showNotifications: showNotification,
            });
        }
    }
    
    refresh(hard: boolean = true, showNotification: boolean = true): void {
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;
        let str = this.i18n("plugin.calendar.component.calendarPanel.notifications.refreshing");
        let notificationId: number;
        if (showNotification) {
            notificationId = this.notifications.showNotification(str, {
                autoHide: false,
                progress: true,
            });
        }
        let prom = Q();
        if (hard) {
            prom = prom.then(() => <any>this.calendarPlugin.tasksPlugin.refreshCollections());
        }
        prom.then(() => {
        }).fin(() => {
            if (showNotification) {
                this.notifications.hideNotification(notificationId);
            }
            this.callViewMethod("repaint");
            setTimeout(() => {
                this.isRefreshing = false;
            }, 800);
        });
    }
    
    
    
    
    
    
    
    /****************************************
    ************ Section/Project ************
    *****************************************/
    setSection(section: mail.section.SectionService): Q.Promise<boolean> {
        if (!section.isCalendarModuleEnabled() && !this.isValidCalendarConv2Section(section)) {
            return Q(false);
        }
        return Q().then(() => {
            return this.setSectionData(section, false);
        })
        .thenResolve(true);
    }
    
    setSectionData(section: mail.section.SectionService|mail.section.Conv2Section|string, waitForViewLoaded: boolean = true): Q.Promise<boolean> {
        if (section instanceof mail.section.SectionService && this.isValidCalendarConv2Section(section)) {
            let id = section.getId();
            let c2s = this.session.conv2Service.collection.find(x => x.section.getId() == id);
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
        
        if (typeof(section) == "string") {
            this.activeProjectId = section;
        }
        else if (section instanceof mail.section.Conv2Section) {
            this.activeProjectId = section.id;
        }
        else {
            this.activeProjectId = section.getId();
        }
        
        return Q().then(() => {
            return this.calendarPlugin.loadSettings(this.session, this.activeProjectId);
        })
        .then(() => {
            let prom = this.afterViewLoaded.promise.then(() => {
                this.callViewMethod("setData", this.getDataModel());
                this.updateDatePicker();
            })
            .fail(console.error);
            return waitForViewLoaded ? prom : null;
        })
        .fail(console.error).
        thenResolve(true);
    }
    
    isValidCalendarConv2Section(section: mail.section.SectionService): boolean {
        if (section.isUserGroup() && section.sectionData && section.sectionData.group && section.sectionData.group.type == "usernames" && section.sectionData.group.users.length == 2) {
            return true;
        }
        return false;
    }
    
    getActiveSectionName(): string {
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
    }
    
    getActiveProject(): Project {
        return this.calendarPlugin.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
    }
    
    getActiveSection(): mail.section.SectionService {
        return this.session.sectionManager.getSection(this.activeProjectId);
    }
    
    getActiveConv2Section(): mail.section.Conv2Section {
        return this.calendarPlugin.tasksPlugin.getConv2Section(this.session, this.activeProjectId);
    }
    
    getActiveConv2Users(): string[] {
        return this.calendarPlugin.tasksPlugin.getConv2Users(this.session, this.activeProjectId, true);
    }
    
    getActiveSectionService(): mail.section.SectionService {
        if (this.isConv2Section()) {
            let conv2Section = this.getActiveConv2Section();
            if (conv2Section && conv2Section.section) {
                return conv2Section.section;
            }
        }
        else if (this.isRegularSection()) {
            return this.getActiveSection();
        }
        return null;
    }
    
    isAllTasks(): boolean {
        return this.activeProjectId == CustomTasksElements.ALL_TASKS_ID;
    }
    
    isTasksAssignedToMe(): boolean {
        return this.activeProjectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
    }
    
    isTasksCreatedByMe(): boolean {
        return this.activeProjectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID;
    }
    
    isTrash(): boolean {
        return this.activeProjectId == CustomTasksElements.TRASH_ID;
    }
    
    isFixedSection(): boolean {
        return this.isAllTasks() || this.isTasksAssignedToMe() || this.isTasksCreatedByMe() || this.isTrash();
    }
    
    combinesMultipleSections(): boolean {
        return this.isFixedSection() || this.isConv2Section();
    }
    
    isRegularSection(): boolean {
        return !this.isFixedSection() && !this.isConv2Section();
    }
    
    isConv2Section(): boolean {
        return this.calendarPlugin.tasksPlugin.isConv2Project(this.activeProjectId);
    }
    
    isPrivateSection(): boolean {
        return this.activeProjectId == this.calendarPlugin.tasksPlugin.getPrivateSectionId();
    }
    
    
    
    
    
    
    /****************************************
    ******** Activation/deactivation ********
    *****************************************/
    beforeActivate(): void {
        this.requestDayPreview(this.previewDay);
        this.requestTaskPreview(this.previewTask);
    }
    activate(): void {
        this.isActive = true;
        this.callViewMethod("activate");
        this.updatePreview();
    }
    deactivate(): void {
        this.isActive = false;
        this.callViewMethod("deactivate");
    }
   
    
    
    
    
    
    /****************************************
    **************** Preview ****************
    *****************************************/
    onViewRequestDayPreview(day: string): void {
        this.requestDayPreview(day);
    }
    
    requestDayPreview(day: string): void {
        // let activeName = this.currDataModel ? this.currDataModel.projectName : null;
        // console.log(`requestDayPreview(${day}) in ${activeName}}/${this.calendarId}, ${this.previewDay}`)
        this.previewDay = day;
        this.dispatchEvent<CalendarDayPreviewRequestEvent>({
            type: "calendar-day-preview-request",
            day: day,
        });
    }
    
    updateDayPreview(): void {
        this.requestDayPreview(this.previewDay);
    }
    
    onViewRequestTaskPreview(task: string): void {
        this.requestTaskPreview(task);
    }
    
    requestTaskPreview(task: string): void {
        this.previewTask = task;
        this.dispatchEvent<CalendarTaskPreviewRequestEvent>({
            type: "calendar-task-preview-request",
            task: task,
            hostHash: this.session.hostHash,
        });
    }
    
    updateTaskPreview(): void {
        this.requestTaskPreview(this.previewTask);
    }
    
    markTaskAsSelected(taskId: string): void {
        this.previewTask = taskId;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("markTaskAsSelected", taskId);
        });
    }
    
    updatePreview(): void {
        this.updateDayPreview();
        this.updateTaskPreview();
    }
    
    setSelectedDate(d: number, m: number, y: number): void {
        this.callViewMethod("selectDay", d + "." + m + "." + y);
        this.goToDate(d, m, y);
    }
   
    
    
    
    
    
    /****************************************
    ***************** Data ******************
    *****************************************/
    onDataChanged(type: Watchable, id: string, action: Action): void {
        if (type == "task") {
            let task = null;
            if (action == "added" || action == "modified" || action == "section-changed") {
                task = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][id];
            }
            else if (action == "deleted") {
                task = null;
                if (this.previewTask == id) {
                    this.requestTaskPreview(null);
                }
            }
            let isTrash = this.activeProjectId == CustomTasksElements.TRASH_ID;
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
    }
    
    resendTasksToView(): void {
        if (!this.currDataModel) {
            return;
        }
        let relevantTasks = this.getRelevantTasks();
        let tasksModels = this.convertTasks(relevantTasks);
        this.currDataModel.tasks = tasksModels;
        this.callViewMethod("setTasks", JSON.stringify(tasksModels), true);
    }
    
    sendTaskToView(task: Task): void {
        if (this.isTaskRelevant(task.getId())) {
            let m = this.convertTask(task);
            this.currDataModel.tasks[task.getId()] = m;
            this.callViewMethod("setTask", JSON.stringify(m));
        }
        else if (task.getId() in this.currDataModel.tasks) {
            this.delTaskFromView(task.getId());
        }
    }
    
    delTaskFromView(taskId: string): void {
        delete this.currDataModel.tasks[taskId];
        this.callViewMethod("delTask", taskId);
    }
    
    convertTask(task: Task): TaskModel {
        let start = task.getStartTimestamp();
        let end = task.getEndTimestamp();
        
        let td = this.getTaskTitleAndDescriptionText(task);
        return {
            id: task.getId(),
            title: td.title + " " + td.description,
            status: task.getStatus(),
            labelClass: task.getLabelClass(),
            startTimestamp: start,
            endTimestamp: end,
            wholeDays: task.getWholeDays(),
            taskGroupIcons: task.getTaskGroupIds()
                .map(tgId => this.calendarPlugin.tasksPlugin.taskGroups[this.session.hostHash][tgId])
                .filter(tg => tg != null)
                .map(tg => tg.getIcon())
                .filter(iconStr => iconStr != null)
                .map(iconStr => JSON.parse(iconStr)),
        };
    }
    
    convertTasks(tasks: TasksMap): { [id: string]: TaskModel } {
        let res: { [id: string]: TaskModel } = {};
        for (let id in tasks) {
            res[id] = this.convertTask(tasks[id]);
        }
        return res;
    }
    
    getRelevantTasks(): TasksMap {
        let extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);;
        let tasks: TasksMap = {};
        for (let tId in this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash]) {
            if (this.isTaskRelevant(tId, extraCalendars)) {
                tasks[tId] = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][tId];
            }
        }
        return tasks;
    }
    
    isTaskRelevant(tId: string, cachedExtraCalendars: string[] = null): boolean {
        if (cachedExtraCalendars === null) {
            cachedExtraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);;
        }
        if (!cachedExtraCalendars || !Array.isArray(cachedExtraCalendars)) {
            cachedExtraCalendars = [];
        }
        let myId = this.calendarPlugin.tasksPlugin.getMyId(this.session);
        let all = this.activeProjectId == CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        let isTrash = this.activeProjectId == CustomTasksElements.TRASH_ID;
        let isConv2Section = !!this.getActiveConv2Section();
        let taskProjectId = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][tId].getProjectId();
        if (all || taskProjectId == this.activeProjectId || cachedExtraCalendars.indexOf(taskProjectId) >= 0) {
            let task = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][tId];
            if (isTrash != task.getIsTrashed()) {
                return false;
            }
            if (!task.getStartTimestamp()) {
                return false;
            }
            if (task
                && (!isConv2Section || this.isAssignedToCurrConv2Section(task))
                && (this.activeProjectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID || task.getCreatedBy() == myId)
                && (this.activeProjectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || task.isAssignedTo(myId))
            ) {
                return true;
            }
        }
        return false;
    }
    
    isAssignedToCurrConv2Section(task: Task): boolean {
        let arr = task.getAssignedTo();
        for (let u of this.getActiveConv2Users()) {
            if (arr.indexOf(u) < 0) {
                return false;
            }
        }
        return true;
    }
    
    getTaskTitleAndDescriptionText(task: Task): { title: string, description: string } {
        let str = task.getDescription();
        let idx = str.indexOf("<br>");
        let title: string = "";
        let description: string = "";
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
    }
    
    fixHtmlString(str: string): string {
        return str.replace(/<[^>]*>?/gm, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
    }
    
    onViewSetTaskStartTimestamp(taskId: string, dtStart: number): void {
        let task = this.calendarPlugin.tasksPlugin.tasks[this.session.hostHash][taskId];
        if (task) {
            let prevDtStart = task.getStartTimestamp();
            let prevDtEnd = task.getEndTimestamp();
            if (prevDtStart == dtStart) {
                return;
            }
            let dtEnd = null;
            if (prevDtEnd) {
                dtEnd = (prevDtEnd - prevDtStart) + dtStart;
            }
            let now = new Date().getTime();
            let myId = this.calendarPlugin.tasksPlugin.getMyId(this.session);
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
    }
    
    
    
    
    
    
    /****************************************
    *************** Settings ****************
    *****************************************/
    getSettings(): { [name: string]: boolean|string } {
        let settings: { [name: string]: boolean|string } = {};
        for (let name in this.calendarPlugin.viewSettings.settingsInfo) {
            settings[name] = this.getSetting(name);
        }
        return settings;
    }
    getSetting(name: string): boolean|string {
        let val = this.calendarPlugin.getSetting(this.session, name, this.activeProjectId, this.context);
        return typeof(val) == "string" ? val : val == 1;
    }
    getIntSetting(name: string): number {
        return <number>this.calendarPlugin.getSetting(this.session, name, this.activeProjectId, this.context);
    }
    setSetting(name: string, value: boolean|string|number) {
        this.calendarPlugin.saveSetting(this.session, name, typeof(value) == "string" ? value : (value ? 1 : 0), this.activeProjectId, this.context);
    }
    setIntSetting(name: string, value: number) {
        this.calendarPlugin.saveSetting(this.session, name, value, this.activeProjectId, this.context);
    }
    onViewSettingChanged(name: string, value: boolean|string|number, dispatchEvent: boolean) {
        if (this.activeProjectId == null || !this.calendarPlugin.viewSettings.hasProject(this.session, this.activeProjectId)) {
            return;
        }
        if (this.calendarPlugin.viewSettings.hasSetting(this.session, name, this.activeProjectId, this.context)) {
            if (typeof(value) == "boolean") {
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
            this.app.dispatchEvent<CalendarSettingChanged>({
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
    }
    watchSettingsChanges(): void {
        this.bindEvent<CalendarSettingChanged>(this.app, "calendar-setting-changed", event => {
            if (event.sourceUniqueId != this.uniqueId) {
                if (event.sourceProjectId != this.activeProjectId && this.calendarPlugin.viewSettings.isSettingProjectIsolated(event.setting)) {
                    return;
                }
                if (event.sourceContext != this.context && this.calendarPlugin.viewSettings.isSettingContextIsolated(event.setting)) {
                    return;
                }
                this.callViewMethod("settingChanged", event.setting, event.value, false);
            }
        });
    }
    
    
    
    
    
    
    
    /****************************************
    ************** PreviewPanel *************
    *****************************************/
    setEnableDayPreviewPanel(value: boolean): void {
        this.dispatchEvent<CalendarDayPreviewChangeVisibilityRequestEvent>({
            type: "calendar-day-preview-change-visibility-request",
            show: value,
        });
    }
    
    setShowTaskPreviewPanel(value: boolean): void {
        this.dispatchEvent<CalendarTaskPreviewChangeVisibilityRequestEvent>({
            type: "calendar-task-preview-change-visibility-request",
            show: value,
        });
    }
    
    setTaskPreviewPanelLayout(horizontal: boolean): void {
        this.dispatchEvent<HorizontalCalendarTaskPreviewWindowLayoutChangeRequestEvent>({
            type: "horizontal-calendar-task-preview-window-layout-change-request",
            horizontalLayout: horizontal,
        });
    }
    
    updateTaskPreviewPanel(): void {
        this.dispatchEvent<CalendarPreviewUpdateRequestEvent>({
            type: "calendar-preview-update-request",
        });
    }
    
    
    
    
    
    
    /****************************************
    ************** DatePicker ***************
    *****************************************/
    ign: boolean = false;
    updateDatePicker(): void {
        if (!this.currDataModel) {
            return;
        }
        this.datePicker.currDataModel.selectedDay = this.currDataModel.selectedDay;
        this.datePicker.currDataModel.selectedMonth = this.currDataModel.selectedMonth;
        this.datePicker.currDataModel.selectedYear = this.currDataModel.selectedYear;
        this.datePicker.setOptions(this.getDatePickerOptions());
    }
    
    onDatePickerValueChanged(force: boolean = false): void {
        if (!this.currDataModel || this.ign) {
            this.ign = false;
            return;
        }
        if (!force) {
            if (this.currDataModel.selectedDay == this.datePicker.currDataModel.selectedDay
                && this.currDataModel.selectedMonth == this.datePicker.currDataModel.selectedMonth
                && this.currDataModel.selectedYear == this.datePicker.currDataModel.selectedYear
            ) {
                return;
            }
        }
        this.currDataModel.selectedDay = this.datePicker.currDataModel.selectedDay;
        this.currDataModel.selectedMonth = this.datePicker.currDataModel.selectedMonth;
        this.currDataModel.selectedYear = this.datePicker.currDataModel.selectedYear;
        this.callViewMethod("setSelectedDate", this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
    }
    
    onViewSetSelectedDate(d: number, m: number, y: number): void {
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
    }
    
    goToDate(d: number, m: number, y: number): void {
        if (!this.currDataModel) {
            return;
        }
        // let activeName = this.currDataModel ? this.currDataModel.projectName : null;
        // console.log(`goToDate(${d},${m},${y}) in ${activeName}}/${this.calendarId}, ${this.previewDay}`);
        this.currDataModel.selectedDay = d;
        this.currDataModel.selectedMonth = m;
        this.currDataModel.selectedYear = y;
        this.updateDatePicker();
        this.datePicker.updateDateCustomSelects();
        this.onDatePickerValueChanged(true);
    }
    
    getDatePickerOptions(): DatePickerOptions {
        let mode = <Modes>this.getSetting("mode");
        if (this._overrideMode) {
            mode = this._overrideMode;
        }
        if (mode == Modes.MONTH) {
            return {
                day: false,
                buttons: false,
                today: true,
            };
        }
        if (mode == Modes.WEEK || mode == Modes.SINGLE_WEEK || mode == Modes.SINGLE_DAY) {
            return {
                day: true,
                month: true,
                buttons: false,
                today: true,
            };
        }
    }
    
    onViewPrev(): void {
        this.datePicker.prev();
    }
    
    onViewNext(): void {
        this.datePicker.next();
    }
    
    
    
    
    
    
    /****************************************
    *********** Misc view events ************
    *****************************************/
    getOtherPluginTarget(id: string): string {
        if (id == this.calendarPlugin.getPrivateSectionId()) {
            return "my";
        }
        if (id == CustomTasksElements.ALL_TASKS_ID) {
            return "all";
        }
        if (id == CustomTasksElements.TRASH_ID) {
            return "trash";
        }
        return id;
    }
    
    onViewNewTask(ts: number = null, actionId: "new-timeframe" | "new-whole-day" = null): void {
        let section: mail.section.SectionService|boolean = null;
        let assignTo: string[] = [];
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
        
        let dt = ts ? new Date(ts) : new Date();
        
        let msecs = (dt.getHours() * 3600 + dt.getMinutes() * 60) * 1000;
        let rounding = 60 * 60 * 1000;
        msecs = Math.round(msecs / rounding) * rounding;
        let hs = Math.floor(msecs / 3600000);
        let ms = Math.floor((msecs - hs * 3600000) / 60000);
        dt.setHours(hs);
        dt.setMinutes(ms);
        dt.setSeconds(0);
        dt.setMilliseconds(0);
        
        this.calendarPlugin.tasksPlugin.openNewTaskWindow(this.session, section, [], null, dt, assignTo, actionId == "new-whole-day");
    }
    
    onViewOpenTask(taskId: string): void {
        this.calendarPlugin.tasksPlugin.openEditTaskWindow(this.session, taskId, true, true);
    }
    
    onViewUpdateLeftCalendarFromDayPreview(d: number, m: number, y: number): void {
        let currMode = this._overrideMode ? this._overrideMode : this.currMode;
        if (currMode == Modes.SINGLE_DAY && this.calendarId == 2 && this.afterUserPreviewDayChange) {
            this.afterUserPreviewDayChange(d, m, y);
        }
    }
    
    onViewGoToToday(): void {
        if (this.afterUserGoToToday) {
            this.afterUserGoToToday();
        }
    }
    
    
    
    
    
    
    /****************************************
    ***************** Modes *****************
    *****************************************/
    currMode: Modes = null;
    _overrideMode: Modes = null;
    modeChanged: (mode: Modes) => Promise<void> = null;
    overrideMode(mode: Modes): void {
        this._overrideMode = mode;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("overrideMode", mode);
        });
    }
    onModeChange(): void {
        let mode = this.getSetting("mode");
        if (this.currMode != mode) {
            this.currMode = mode;
            this.callViewMethod("updateCustomSelectMode", mode);
            this.callViewMethod("setSelectedDate", this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
            if (this.modeChanged) {
                this.modeChanged(this.currMode);
            }
        }
    }
    
    
    
    
    
    
    /****************************************
    **************** Filters ****************
    *****************************************/
    getCustomSelectFilterItems(): component.customselect.CustomSelectItem[] {
        let arr: component.customselect.CustomSelectItem[] = [];
        let filters = [
            "all-tasks",
            "only-idea",
            "only-todo",
            "only-in-progress",
            "only-done",
            "only-not-done",
        ];
        let curr = this.getSetting("filter");
        for (let filter of filters) {
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
    }
    
    
    
    
    
    
    /****************************************
    ************ Extra calendars ************
    *****************************************/
    getCustomSelectExtraCalendarsItems(): component.customselect.CustomSelectItem[] {
        let arr: component.customselect.CustomSelectItem[] = [];
        let extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);
        for (let section of this.calendarPlugin.mergableSections[this.session.hostHash].list) {
            let project = this.calendarPlugin.tasksPlugin.getProject(this.session, section.getId());
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
        return arr.sort((a, b) => a.text.localeCompare(b.text));
    }
    
    onViewSetExtraCalendars(str: string): void {
        let projectIds: string[] = str.split(",").filter(x => !!x);
        this.calendarPlugin.setExtraCalendars(this.session, this.activeProjectId, projectIds, this.uniqueId);
        this.resendTasksToView();
        this.resendFilesToView();
    }
    
    getFullProjectName(project: Project): string {
        let section = this.session.sectionManager.getSection(project.getId());
        let projectNames: string[] = [];
        while (section) {
            let project = this.calendarPlugin.tasksPlugin.getProject(this.session, section.getId());
            let projectName = project ? project.getName() : section.getName();
            projectNames.push(projectName);
            section = section.getParent();
        }
        return projectNames.reverse().join(" / ");
    }
    
    
    
    
    
    
    
    /****************************************
    *********** Files in calendar ***********
    *****************************************/
    getRelevantFileModels(): { [identifier: string]: FileModel } {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        let extraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);
        let relevantFileModels: { [identifier: string]: FileModel } = {};
        for (let identifier in this.calendarPlugin.fileModels[this.session.hostHash]) {
            if (this.isFileRelevant(identifier, extraCalendars)) {
                relevantFileModels[identifier] = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
            }
        }
        return relevantFileModels;
    }
    
    isFileRelevant(identifier: string, cachedExtraCalendars: string[] = null): boolean {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        if (cachedExtraCalendars === null) {
            cachedExtraCalendars = this.calendarPlugin.getExtraCalendars(this.session, this.activeProjectId);;
        }
        if (!cachedExtraCalendars || !Array.isArray(cachedExtraCalendars)) {
            cachedExtraCalendars = [];
        }
        let all = this.activeProjectId == CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        let isTrash = this.activeProjectId == CustomTasksElements.TRASH_ID;
        let isConv2Section = !!this.getActiveConv2Section();
        let fileProjectId = this.calendarPlugin.fileModels[this.session.hostHash][identifier].sectionId;
        if (all || fileProjectId == this.activeProjectId || cachedExtraCalendars.indexOf(fileProjectId) >= 0) {
            let fileModel = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
            let isTrashed = fileModel.trashed;
            if (isTrash != isTrashed) {
                return false;
            }
            if (!fileModel.createdAt) {
                return false;
            }
            if (fileModel
                && (!isConv2Section || this.isFileInCurrConv2Section(identifier))
                && (this.activeProjectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.isFileCreatedByMe(identifier))
                && (this.activeProjectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.isFileAssignedToMe(identifier))
            ) {
                return true;
            }
        }
        return false;
    }
    
    isFileInCurrConv2Section(identifier: string): boolean {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        let createdBy = this.calendarPlugin.fileModels[this.session.hostHash][identifier].createdBy;
        return this.getActiveConv2Users().indexOf(createdBy) >= 0;
    }
    
    isFileAssignedToMe(identifier: string): boolean {
        return false;
    }
    
    isFileCreatedByMe(identifier: string): boolean {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        let createdBy = this.calendarPlugin.fileModels[this.session.hostHash][identifier].createdBy;
        return createdBy == this.calendarPlugin.tasksPlugin.getMyId(this.session);
    }
    
    convertFile(entry: mail.filetree.nt.Entry): FileModel {
        return this.calendarPlugin.convertFile(entry);
    }
    
    resendFilesToView(): void {
        if (!this.currDataModel) {
            return;
        }
        let relevantFileModels = this.getRelevantFileModels();
        this.currDataModel.files = relevantFileModels;
        this.callViewMethod("setFileModels", JSON.stringify(relevantFileModels), true);
    }
    
    sendFileToView(identifier: string): void {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        if (!this.currDataModel) {
            return;
        }
        if (this.isFileRelevant(identifier)) {
            let m = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
            this.currDataModel.files[identifier] = m;
            this.callViewMethod("setFileModel", JSON.stringify(m));
        }
        else if (identifier in this.currDataModel.files) {
            this.delFileFromView(identifier);
        }
    }
    
    delFileFromView(identifier: string): void {
        if (!this.currDataModel) {
            return;
        }
        delete this.currDataModel.files[identifier];
        this.callViewMethod("delFileModel", identifier);
    }
    
    getFileIdentifier(entry: mail.filetree.nt.Entry): string {
        return this.calendarPlugin.getFileIdentifier(entry);
    }
    
    splitFileIdentifier(identifier: string): { sectionId: string, path: string } {
        return this.calendarPlugin.splitFileIdentifier(identifier);
    }
    
    onViewOpenFile(identifier: string): void {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        let fileModel = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
        if (!fileModel) {
            return;
        }
        let section = this.session.sectionManager.getSection(fileModel.sectionId);
        if (!section) {
            return;
        }
        section.getFileOpenableElement(fileModel.path, false).then(osf => {
            this.actionOpenableElement(osf);
        });
    }
    
    actionOpenableElement(element: app.common.shelltypes.OpenableElement) {
        let resolvedApp = this.app.shellRegistry.resolveApplicationByElement({ element: element, session: this.session });
        if (resolvedApp.id == "core.unsupported") {
            this.app.shellRegistry.shellOpen({
                session: this.session,
                action: app.common.shelltypes.ShellOpenAction.DOWNLOAD,
                element: element,
            });
            return;
        }
        if (resolvedApp.id == "plugin.editor") {
            this.app.shellRegistry.shellOpen({
                session: this.session,
                element: element,
                action: app.common.shelltypes.ShellOpenAction.PREVIEW,
            });
            return;
        }
        this.app.shellRegistry.shellOpen({
            session: this.session,
            element: element,
            action: app.common.shelltypes.ShellOpenAction.PREVIEW,
        });
    }


    /////////////////////////////
    ///////// REMOTE SECTIONS ///
    /////////////////////////////

    setSession(session: mail.session.Session): Q.Promise<void> {
        // console.log("on setSession")
        return Q().then(() => {
            this.session = session;
            this.registerChangeEvent(session.conv2Service.personService.persons.changeEvent, person => this.onPersonChange(session, person));
            
            this.calendarPlugin.mergableSections[this.session.hostHash].changeEvent.add(() => {
                this.customSelectExtraCalendars.setItems(this.getCustomSelectExtraCalendarsItems());
            });
        });
    }
    
}
