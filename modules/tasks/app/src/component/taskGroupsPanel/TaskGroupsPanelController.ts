import { component, mail, utils, window, Q, Types, app, privfs } from "pmc-mail";
import { Watchable, Action, ViewContext, CustomTasksElements, ProjectsMap, TaskGroupsMap, TasksMap, DefaultColWidths, WatchedTaskItem, TaskGroupIcon, TasksClipboardData, Person, HostHash } from "../../main/Types";
import { TasksPlugin, TasksComponentFactory, TaskPreviewRequestEvent, TasksSettingChanged, TaskPanelChangeVisibilityRequestEvent, HorizontalTaskWindowLayoutChangeRequestEvent, TaskPanelUpdateRequestEvent, MarkedTasksAsReadEvent, BadgesUpdateRequestEvent, TasksColWidthsChangedEvent } from "../../main/TasksPlugin";
import { Project } from "../../main/data/Project";
import { UniqueId } from "../../main/UniqueId";
import Dependencies = utils.decorators.Dependencies;
import { TaskGroup } from "../../main/data/TaskGroup";
import { Task, TaskStatus } from "../../main/data/Task";
import { TaskGroupFormWindowController } from "../../window/taskGroupForm/TaskGroupFormWindowController";
import { DataMigration } from "../../main/DataMigration";
import { TaskWindowController } from "../../window/task/TaskWindowController";
import { TaskGroupSelectorWindowController } from "../../window/taskGroupSelector/TaskGroupSelectorWindowController";
import { CustomSelectController, CustomSelectItem } from "../customSelect/CustomSelectController";
import { i18n } from "./i18n/index";
import { Utils } from "../../main/utils/Utils";
import * as striptags from "striptags";
import { SectionManager, Conv2Service } from "pmc-mail/out/mail/section";
import { TasksWindowController } from "../../window/tasks/TasksWindowController";
import { PersonService } from "pmc-mail/out/mail/person";
import { ViewSettings } from "../../main/ViewSettings";
import { SearchFilter } from "../../main/SearchFilter";

export class Model {
    context: ViewContext;
    projectId: string;
    hostHash: HostHash;
    projectName: string;
    privateSectionId: string;
    safeProjectId: string;
    conv2Model: Types.webUtils.ConversationModel;
    settings: { [name: string]: boolean | string };
    isActive: boolean;
    colWidths: { [key: string]: number };
    defaultTaskLabelClasses: { [key: string]: string };
    canCreateNewTasks: boolean;

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
    showsEmptyTaskGroups: boolean;

    isInSummaryWindow: boolean;
    otherPluginsAvailability: { chat: boolean, notes: boolean, calendar: boolean };

    projects: { [id: string]: ProjectModel };
    taskGroups: { [id: string]: TaskGroupModel };
    tasks: { [id: string]: TaskModel };

    emptyTaskGroupModel: TaskGroupModel;

    myHashmail: string;

    debug: boolean;

}

export class ProjectModel {
    id: string;
    name: string;
    statuses: string[];
    pinnedTaskGroupIds: string[];
    taskGroupsOrder: string[];
    taskLabelClasses: { [key: string]: string };
}

export class TaskGroupModel {
    id: string;
    name: string;
    projectId: string;
    taskLabelClasses: { [key: string]: string };
    isCollapsed: boolean;
    isDetached: boolean;
    isOrphans: boolean;
    nTasksByStatus: { [key: string]: number };
    isClosed: boolean;
    icon: TaskGroupIcon;
    withUnread: boolean;
}

export class TaskModel {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    projectId: string;
    assignedTo: string[];
    attachments: string[];
    createdBy: string;
    createdAt: number;
    modifiedBy: string;
    modifiedAt: number;
    taskGroupIds: string[];
    unread: boolean;
    trashed: boolean;
    cachedSearchString: string;
    nComments: number;
    startTimestamp: number;
    endTimestamp: number;
    wholeDays: boolean;
    overdueInfo: {
        timestamp?: number,
        day?: number,
        month?: number,
        year?: number,
    };

    labelClass: string;
    pinnedInTaskGroupIds: string[];
}

export interface TasksFilterData {
    value: string;
    visible: boolean;
}

export class TasksFilterUpdater {
    static UPDATE_DELAY: number = 200;
    static MIN_CHARS_NUM: number = 2;
    toUpdate: TasksFilterData;
    filter: TasksFilterData;
    updateTimer: NodeJS.Timer;
    onUpdate: () => void;

    constructor() {
        this.setFilter({ value: "", visible: false });
    }

    setFilter(filter: TasksFilterData): void {
        this.filter = filter;
    }

    updateFilter(filter: TasksFilterData) {
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
            value: SearchFilter.prepareNeedle(filter.value),
            visible: filter.visible,
        };
        this.updateTimer = setTimeout(() => {
            this.updateTimer = null;
            this.setFilter(this.toUpdate);
            if (this.onUpdate) {
                this.onUpdate();
            }
        }, TasksFilterUpdater.UPDATE_DELAY);
    }
}

@Dependencies(["taskscustomselect", "persons", "notification", "taskpanel"])
export class TaskGroupsPanelController extends window.base.WindowComponentController<window.base.BaseWindowController> {

    static textsPrefix: string = "plugin.tasks.component.taskGroupsPanel.";


    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }

    tasksPlugin: TasksPlugin;
    context: ViewContext = ViewContext.TasksWindow;
    uniqueId: string = "";
    dataChangedListener: (type: Watchable, id: string, action: Action) => void;
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    tasksFilterUpdater: TasksFilterUpdater;
    activeProjectId: string;
    wasDataSet: boolean = false;
    isActive: boolean = false;
    previewTaskId: string | false = null;
    componentFactory: TasksComponentFactory;

    customSelectFilter: CustomSelectController;
    taskTooltip: component.tasktooltip.TaskTooltipController;
    // personsComponent: component.persons.PersonsController;
    notifications: component.notification.NotificationController;
    
    collapsedTaskGroups: string[] = [];
    selectedTasks: string[] = [];
    colWidths: { [tgIdkey: string]: number } = {};
    
    currDataModel: Model = null;
    taskLineWidth: number = 100;
    isRefreshing: boolean = false;
    
    
    // session properties
    conv2Service: Conv2Service;
    identity: privfs.identity.Identity
    session: mail.session.Session;
    sectionManager: SectionManager;
    personService: PersonService;

    constructor(
        parent: window.base.BaseWindowController,
        public personsComponent: component.persons.PersonsController
    ) {
        super(parent);
        this.ipcMode = true;
        this.uniqueId = UniqueId.next();

        this.tasksPlugin = this.app.getComponent("tasks-plugin");

        this.customSelectFilter = this.addComponent("customSelectFilter", this.componentFactory.createComponent("taskscustomselect", [this, [], { multi: false, editable: true, firstItemIsStandalone: false }]));
        // this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            return this.tasksPlugin.getTaskTooltipContent(this.session, taskId);
        };
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.tasksPlugin.onWatchedTasksHistoryRebuild(this.onWatchedTasksHistoryRebuild.bind(this));
        this.tasksPlugin.onWatchedTasksHistorySet(this.onWatchedTasksHistorySet.bind(this));
    }

    init() {
        this.tasksFilterUpdater = new TasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = () => {
            this.updateSearchFilter(this.tasksFilterUpdater.filter);
        }
        this.watchSettingsChanges();
        this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterTasks, "multi");
        this.app.addEventListener<TasksColWidthsChangedEvent>("tasks-col-widths-changed", event => {
            if (event.key == this.activeProjectId + "-" + this.context && event.sender != this.uniqueId) {
                this.getColWidths().then(widths => {
                    this.colWidths = widths;
                    this.callViewMethod("setColWidths", JSON.stringify(widths));
                });
            }
        });
        this.app.addEventListener(app.common.clipboard.Clipboard.CHANGE_EVENT, event => {
            this.updateFromClipboard();
        });
        this.updateFromClipboard();
        this.app.addEventListener<Types.event.ActiveAppWindowChangedEvent>("active-app-window-changed", e => {
            if (e.appWindowId == "tasks" && this.isActive) {
                this.callViewMethod("activate");
            }
        });
        this.registerChangeEvent(this.personService.persons.changeEvent, this.onPersonChange.bind(this));

        return <any>this.tasksPlugin.checkInit().then(() => this.tasksPlugin.projectsReady).then(() => {
            this.setShowTaskPanel(!!this.getSetting("show-task-panel"));
            this.setTaskPanelLayout(!!this.getSetting("horizontal-task-window-layout"));

            this.colWidths = this.getDefaultColWidths();
            return this.getColWidths().then(widths => {
                (<any>Object).assign(this.colWidths, widths);
                this.callViewMethod("setColWidths", JSON.stringify(this.colWidths));
            });
        }).then(() => {
            return this.customSelectFilter.init();
        });
    }

    onPersonChange(person: mail.person.Person): void {
        this.callViewMethod("updatePersonPresence", person.getHashmail(), person.isPresent());
    }

    getModel(): string {
        return null;
    }

    getDataModel(): string {
        // console.log("on getDataModel");
        this.currDataModel = null;
        if (!this.activeProjectId) {
            return null;
        }
        this.customSelectFilter.setItems(this.getCustomSelectFilterItems());
        let projectId = this.activeProjectId;
        let projectName = this.getActiveSectionName();
        let section = this.getActiveSection();
        this.updateCollapsedTaskGroupsArray(true);
        let relevantProjects = this.getRelevantProjects();
        let relevantTaskGroups = this.getRelevantTaskGroups();
        let relevantTasks = this.getRelevantTasks();
        let projectsModels = this.convertProjects(relevantProjects);
        let taskGroupsModels = this.convertTaskGroups(relevantTaskGroups);
        let tasksModels = this.convertTasks(relevantTasks);
        for (let projectId in projectsModels) {
            taskGroupsModels[projectId + "/__orphans__"] = (this.getOrphansTaskGroupModel(projectId));
        }

        if (this.getSetting("show-full-task-descriptions")) {
            this.parent.fontMetrics.add(" ");
            for (let id in relevantTasks) {
                this.parent.fontMetrics.add(relevantTasks[id].getDescription());
            }
        }

        let defaultTaskLabelClasses: { [key: string]: string } = {};
        let arr = Task.getStatuses();
        for (let i = arr.length - 1; i >= 0; --i) {
            defaultTaskLabelClasses[arr[i]] = Task.getLabelClass(arr[i]);
        }

        let model: Model = {
            context: this.context,
            projectId: projectId,
            hostHash: this.session.hostHash,
            projectName: projectName,
            privateSectionId: this.tasksPlugin.getPrivateSectionId(),
            safeProjectId: projectId.replace(/:/g, "---").replace(/\|/g, "___"),
            conv2Model: this.isConv2Section() ? utils.Converter.convertConv2(this.getActiveConv2Section(), 0, null, 0, true, 0, false, false, false, null) : null,
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

            emptyTaskGroupModel: this.convertTaskGroup(new TaskGroup({
                projectId: projectId,
            })),

            myHashmail: this.tasksPlugin.getMyId(this.session),

            debug: this.tasksPlugin.debug,
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    }

    updateCollapsedTaskGroupsArray(collapseDetached: boolean = false): void {
        this.collapsedTaskGroups = JSON.parse(<string>this.getSetting("collapsed-taskgroups"));

        if (collapseDetached) {
            let nCollapsedBefore = this.collapsedTaskGroups.length;
            for (let tgId in this.tasksPlugin.taskGroups[this.session.hostHash]) {
                let tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
                let fullId = tg.getProjectId() + "/" + tg.getId();
                if (tg.getDetached() && this.collapsedTaskGroups.indexOf(fullId) < 0) {
                    this.collapsedTaskGroups.push(fullId);
                }
            }
            let nCollapsedAfter = this.collapsedTaskGroups.length;
            if (nCollapsedAfter != nCollapsedBefore) {
                this.setSetting("collapsed-taskgroups", JSON.stringify(this.collapsedTaskGroups));
            }
        }
    }

    onViewLoad(): void {
        this.afterViewLoaded.resolve();
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    }

    beforeClose(): void {
        if (this.dataChangedListener) {
            this.tasksPlugin.unWatch(this.session, "*", "*", "*", this.dataChangedListener);
        }
    }

    onFilterTasks() {
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    }

    updateSearchFilter(data: TasksFilterData): void {
        let searchStr = data.visible ? data.value : "";
        this.callViewMethod("applySearchFilter", searchStr);
    }

    isInSummaryWindow(): boolean {
        return this.context == ViewContext.SummaryWindow;
    }

    getOtherPluginsAvailability(): { chat: boolean, notes: boolean, calendar: boolean } {
        let active = this.getActiveSection();
        let chatPresent = this.tasksPlugin.isChatPluginPresent();
        let notesPresent = this.tasksPlugin.isNotes2PluginPresent();
        let hasChat = active && chatPresent && active.isChatModuleEnabled();
        let hasNotes = active && notesPresent && active.isFileModuleEnabled();
        let hasCalendar = !!active;
        if (this.activeProjectId == CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == CustomTasksElements.TRASH_ID) {
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
    }

    onWatchedTasksHistoryRebuild(hostHash: HostHash, pId: string): void {
        if (pId != this.activeProjectId && this.activeProjectId != CustomTasksElements.ALL_TASKS_ID && this.activeProjectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.activeProjectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID && this.activeProjectId != CustomTasksElements.TRASH_ID && !this.tasksPlugin.isConv2Project(this.activeProjectId)) {
            return;
        }
        this.updateUnread();
    }

    onWatchedTasksHistorySet(hostHash: HostHash, pId: string, tId: string, it: WatchedTaskItem): void {
        // this.tasksPlugin.log("onWatchedTasksHistorySet", pId,tId,it,this.activeProjectId);
        if (pId != this.activeProjectId && this.activeProjectId != CustomTasksElements.ALL_TASKS_ID && this.activeProjectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.activeProjectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID && this.activeProjectId != CustomTasksElements.TRASH_ID && !this.tasksPlugin.isConv2Project(this.activeProjectId)) {
            // this.tasksPlugin.log("exiting")
            return;
        }
        this.updateUnread();
    }

    updateUnread(): void {
        // this.tasksPlugin.log("updateUnread", Object.keys(this.currDataModel.tasks));
        let unreadTaskIds: { [id: string]: boolean } = {};
        let unreadTaskGroupIds: { [id: string]: boolean } = {};
        for (let tId in this.currDataModel.tasks) {
            // let d = tId == "076";
            let t = this.currDataModel.tasks[tId];
            let tt = this.tasksPlugin.tasks[this.session.hostHash][tId];
            if (!tt) {
                // if (d)this.tasksPlugin.log("ERR 1");
                continue;
            }
            // if (d)this.tasksPlugin.log("OK 1",t.unread,this.tasksPlugin.wasTaskUnread(this.session, tt, tt.getProjectId()));
            if (t.unread != this.tasksPlugin.wasTaskUnread(this.session, tt, tt.getProjectId())) {
                t.unread = !t.unread;
                unreadTaskIds[tId] = t.unread;
            }
            
            let tgIds = tt.getTaskGroupIds();
            if (tgIds.length == 0) {
                unreadTaskGroupIds[`${tt.getProjectId()}/__orphans__`] = this.isTaskGroupUnread(tt.getProjectId(), null);
            }
            else {
                for (let tgId of tgIds) {
                    let key = tgId == "__orphans__" ? `${tt.getProjectId()}/__orphans__` : tgId;
                    unreadTaskGroupIds[key] = this.isTaskGroupUnread(tt.getProjectId(), tgId);
                }
            }
        }
        // if (Object.keys(unread).length == 0) {
        //     return;
        // }
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("updateUnread", JSON.stringify(unreadTaskIds), JSON.stringify(unreadTaskGroupIds));
        });
    }

    getCustomSelectFilterItems(): CustomSelectItem[] {
        let arr: CustomSelectItem[] = [];
        let i18nFilters: string[];
        let filters: string[];
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
        let curr = this.getSetting(this.isKanban() ? "kanban-filter" : "filter");
        let i = 0;
        for (let filter of filters) {
            arr.push({
                val: filter,
                text: this.i18n("plugin.tasks.component.taskGroupsPanel.filter.show" + i18nFilters[i]),
                textNoEscape: true,
                icon: null,
                selected: curr == filter,
                extraClass: "filter-show-" + filter,
            });
            ++i;
        }
        return arr;
    }






    /****************************************
    ************ Section/Project ************
    *****************************************/
    setSection(section: mail.section.SectionService): Q.Promise<boolean> {
        if (!section.isKvdbModuleEnabled() && !this.isValidTasksConv2Section(section)) {
            return Q(false);
        }
        return Q().then(() => {
            this.setSectionData(section);
            return true;
        });
    }

    setSectionData(section: mail.section.SectionService | mail.section.Conv2Section | string): Q.Promise<boolean> {
        if (section instanceof mail.section.SectionService && this.isValidTasksConv2Section(section)) {
            let id = section.getId();
            let c2s = this.session.conv2Service.collection.find(x => x.section.getId() == id);
            if (c2s) {
                section = c2s;
            }
        }
        this.wasDataSet = true;
        this.requestPreview(null);
        if (!this.dataChangedListener) {
            this.dataChangedListener = this.onDataChanged.bind(this);
            // this.tasksPlugin.log("watch", this.session.hostHash,this.tasksPlugin.session.hostHash);
            this.tasksPlugin.watch(this.session, "*", "*", "*", this.dataChangedListener);
        }

        this.activeProjectId = TasksWindowController.getProjectId(section);

        return Q().then(() => {
            if (this.isConv2Section()) {
                return this.tasksPlugin.loadSettings(this.session, this.activeProjectId);
            }
        }).then(() => {
            return this.loadFromLocalStorage();
        }).then(() => {
            return this.afterViewLoaded.promise;
        }).then(() => {
            // console.log("call view with setData");
            this.callViewMethod("setData", this.getDataModel());
            return true;
        });
    }
    
    isValidTasksConv2Section(section: mail.section.SectionService): boolean {
        if (section.isUserGroup() && section.sectionData && section.sectionData.group && section.sectionData.group.type == "usernames" && section.sectionData.group.users.length == 2) {
            return true;
        }
        return false;
    }

    getActiveSectionName(): string {
        // console.log("on getActiveSectionName");
        if (this.isConv2Section()) {
            // console.log(1);
            return this.tasksPlugin.getConv2SectionName(this.session, this.getActiveConv2Section());
        }
        else if (this.isPrivateSection()) {
            // console.log(2);
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
            // console.log("getActiveSectionName before");
            return this.getActiveProject().getName();
        }
    }

    getConv2Section(id: string): mail.section.Conv2Section {
        // console.log("getConv2Section", id);
        if (! this.session) {
            // console.log("no session");
            return;
        }
        if (! this.session.conv2Service) {
            // console.log("no conv2service");
            return;
        }

        if (! this.session.conv2Service.collection) {
            // console.log("no collection");
            return;
        }

        let ret = this.session.conv2Service.collection.find(c2s => {
            return c2s.id == id
        });
        return ret;
    }

    getConv2Users(c2s: mail.section.Conv2Section, excludeMe: boolean = false): string[] {
        if (!c2s) {
            return [];
        }
        let hashmail = this.identity.hashmail;
        let hash = hashmail.substr(hashmail.indexOf("#"));
        let users = c2s.users.map(u => u + hash);
        if (excludeMe) {
            let myId = this.getMyself().id;
            users = users.filter(id => id != myId);
        }
        return users;
    }

    getMyself(): Person {
        let person = this.session.conv2Service.personService.getPerson(this.identity.hashmail);
        let contact = person ? person.getContact() : null;
        return {
            id: this.identity.hashmail,
            name: this.identity.user,
            avatar: this.app.assetsManager.getAssetByName("DEFAULT_USER_AVATAR"),
            isBasic: contact ? contact.basicUser : false,
        };
    }



    getActiveProject(): Project {
        let res = this.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
        return res;

    }

    getActiveSection(): mail.section.SectionService {
        return this.session.sectionManager.getSection(this.activeProjectId);
    }

    getActiveConv2Section(): mail.section.Conv2Section {
        let ret = this.getConv2Section(this.activeProjectId);
        return ret;
    }

    getActiveConv2Users(): string[] {
        return this.tasksPlugin.getConv2Users(this.session, this.activeProjectId, true);
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

    isFixedSectionId(id: string): boolean {
        let fixedSectionIds = [CustomTasksElements.ALL_TASKS_ID, CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID, CustomTasksElements.TASKS_CREATED_BY_ME_ID, CustomTasksElements.TRASH_ID];
        return fixedSectionIds.indexOf(id) >= 0;
    }

    combinesMultipleSections(): boolean {
        return this.isFixedSection() || this.isConv2Section();
    }

    showsEmptyTaskGroups(): boolean {
        return !this.combinesMultipleSections();
    }

    isRegularSection(): boolean {
        return !this.isFixedSection() && !this.isConv2Section();
    }

    isConv2Section(): boolean {
        // console.log("on isConv2Section")
        return this.tasksPlugin.isConv2Project(this.activeProjectId);
    }

    isPrivateSection(): boolean {
        return this.activeProjectId == this.tasksPlugin.getPrivateSectionId();
    }





    /****************************************
    *************** Settings ****************
    *****************************************/
    getSettings(): { [name: string]: boolean | string } {
        let settings: { [name: string]: boolean | string } = {};
        for (let name in this.tasksPlugin.viewSettings.settingsInfo) {
            settings[name] = this.getSetting(name);
        }
        return settings;
    }
    getSetting(name: string): boolean | string {
        let val = this.tasksPlugin.getSetting(this.session, name, this.activeProjectId, this.context);
        return typeof (val) == "string" ? val : val == 1;
    }
    setSetting(name: string, value: boolean | string | number) {
        this.tasksPlugin.saveSetting(this.session, name, typeof (value) == "string" ? value : (value ? 1 : 0), this.activeProjectId, this.context);
    }
    onViewSettingChanged(name: string, value: boolean | string | number, dispatchEvent: boolean) {
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
            this.app.dispatchEvent<TasksSettingChanged>({
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
            for (let id in this.currDataModel.tasks) {
                this.parent.fontMetrics.add(this.currDataModel.tasks[id].title + " " + this.currDataModel.tasks[id].description);
            }
            this.parent.fontMetrics.measure().then(() => {
                this.callViewMethod("updateTaskHeights");
            });
        }
        if (name == "collapsed-taskgroups") {
            this.updateCollapsedTaskGroupsArray(false);
        }
    }
    watchSettingsChanges(): void {
        this.app.addEventListener<TasksSettingChanged>("tasks-setting-changed", event => {
            if (event.sourceUniqueId != this.uniqueId) {
                if (event.sourceProjectId != this.activeProjectId && this.tasksPlugin.viewSettings.isSettingProjectIsolated(event.setting)) {
                    return;
                }
                if (event.sourceContext != this.context && this.tasksPlugin.viewSettings.isSettingContextIsolated(event.setting)) {
                    return;
                }
                this.callViewMethod("settingChanged", event.setting, event.value, false);
            }
        });
    }





    /****************************************
    ******** Activation/deactivation ********
    *****************************************/
    beforeActivate(): void {
        // console.log("on beforeActivate - previewTaskId", this.previewTaskId);
        this.requestPreview(this.previewTaskId);
    }
    activate(): void {
        // console.log("panel on activate");
        this.isActive = true;
        this.callViewMethod("activate");
        this.updatePreview();
    }
    deactivate(): void {
        this.isActive = false;
        this.callViewMethod("deactivate");
    }






    /****************************************
    **************** Events *****************
    *****************************************/
    requestPreview(taskId: string | false): void {
        // console.log("on requestPreview - taskId", taskId);
        this.previewTaskId = taskId;
        this.dispatchEvent<TaskPreviewRequestEvent>({
            type: "task-preview-request",
            taskId: taskId,
            hostHash: this.session.hostHash
        });
    }






    /****************************************
    ***************** Data ******************
    *****************************************/
    getTaskTitleAndDescriptionText(task: Task): { title: string, description: string } {
        let str = task.getDescription().split("</privmx-ced-meta-data>").pop();
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

    getRelevantProjects(): ProjectsMap {
        // console.log("on getRelevantProjects - activeProjectId", this.activeProjectId);
        let projects: ProjectsMap = {};
        let all = this.activeProjectId == CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        if (all) {
            // console.log("all");
            for (let pId in this.tasksPlugin.projects[this.session.hostHash]) {
                // console.log("pId", pId);
                if (this.tasksPlugin.projectSectionExists(this.session, pId)) {
                    projects[pId] = this.tasksPlugin.projects[this.session.hostHash][pId];
                }
            }
        }
        else {
            // console.log("getRelevantProjects else - activeProjectId", this.activeProjectId)
            if (!this.tasksPlugin.projectSectionExists(this.session, this.activeProjectId)) {
                // console.log("returning {}");
                return {};
            }
            // console.log("returning projects");
            projects[this.activeProjectId] = this.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
        }
        return projects;
    }

    getRelevantTaskGroups(): TaskGroupsMap {
        let taskGroups: TaskGroupsMap = {};
        let all = this.activeProjectId == CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        for (let tgId in this.tasksPlugin.taskGroups[this.session.hostHash]) {
            if (all || this.tasksPlugin.taskGroups[this.session.hostHash][tgId].getProjectId() == this.activeProjectId) {
                taskGroups[tgId] = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
            }
        }
        return taskGroups;
    }

    getRelevantTasks(): TasksMap {
        let tasksMap: TasksMap = {};
        for (let tId in this.tasksPlugin.tasks[this.session.hostHash]) {
            if (this.isTaskRelevant(tId)) {
                tasksMap[tId] = this.tasksPlugin.tasks[this.session.hostHash][tId];
            }
        }
        return tasksMap;
    }

    isTaskRelevant(tId: string): boolean {
        let myId = this.tasksPlugin.getMyId(this.session);
        let all = this.activeProjectId == CustomTasksElements.ALL_TASKS_ID || this.activeProjectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.activeProjectId == CustomTasksElements.TRASH_ID || this.getActiveConv2Section();
        let isTrash = this.activeProjectId == CustomTasksElements.TRASH_ID;
        let isConv2Section = !!this.getActiveConv2Section();
        if (all || this.tasksPlugin.tasks[this.session.hostHash][tId].getProjectId() == this.activeProjectId) {
            let task = this.tasksPlugin.tasks[this.session.hostHash][tId];
            if (isTrash != task.getIsTrashed()) {
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

    getOrphansTaskGroupModel(projectId: string): TaskGroupModel {
        let project = this.tasksPlugin.projects[this.session.hostHash][projectId];
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
    }

    setOrphansTaskGroupModels(onlyProjectId: string = null): void {
        let models: { [projectId: string]: TaskGroupModel } = {};
        for (let projectId in this.getRelevantProjects()) {
            if (onlyProjectId && (projectId != onlyProjectId)) {
                continue;
            }
            models[projectId] = this.getOrphansTaskGroupModel(projectId);
        }
        this.callViewMethod("setOrphansTaskGroupModels", JSON.stringify(models));
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

    hasTasksAssignedToMe(taskGroup: TaskGroup): boolean {
        let myId = this.tasksPlugin.getMyId(this.session);
        for (let id of taskGroup.getTaskIds()) {
            if (id in this.tasksPlugin.tasks[this.session.hostHash] && this.tasksPlugin.tasks[this.session.hostHash][id].isAssignedTo(myId)) {
                return true;
            }
        }
        return false;
    }

    hasTasksCreatedByMe(taskGroup: TaskGroup): boolean {
        let myId = this.tasksPlugin.getMyId(this.session);
        for (let id of taskGroup.getTaskIds()) {
            if (id in this.tasksPlugin.tasks[this.session.hostHash] && this.tasksPlugin.tasks[this.session.hostHash][id].getCreatedBy() == myId) {
                return true;
            }
        }
        return false;
    }

    hasTasksAssignedToConv2Users(taskGroup: TaskGroup): boolean {
        for (let id of taskGroup.getTaskIds()) {
            if (id in this.tasksPlugin.tasks[this.session.hostHash] && this.isAssignedToCurrConv2Section(this.tasksPlugin.tasks[this.session.hostHash][id])) {
                return true;
            }
        }
        return false;
    }

    onDataChanged(type: Watchable, id: string, action: Action): void {
        if (type == "task") {
            let task = null;
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
            let taskGroup = null;
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
            let project = null;
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
    }

    sendTaskToView(task: Task): void {
        if (this.combinesMultipleSections() || task.getProjectId() == this.activeProjectId) {
            if (!this.isTaskRelevant(task.getId())) {
                this.delTaskFromView(task.getId());
                return;
            }
            let m = this.convertTask(task);
            this.currDataModel.tasks[task.getId()] = m;
            if (this.getSetting("show-full-task-descriptions") && this.parent.fontMetrics.add(task.getDescription())) {
                this.parent.fontMetrics.measure().then(() => {
                    this._sendTaskToView(m);
                });
            }
            else {
                this._sendTaskToView(m);
            }
        }
        this.setOrphansTaskGroupModels();
    }

    _sendTaskToView(m: TaskModel) {
        let h = this.getSetting("show-full-task-descriptions") ? this.parent.fontMetrics.countLines(m.title + " " + m.description, this.taskLineWidth, m.title.length) : null;
        this.callViewMethod("setTask", JSON.stringify(m), h);
    }

    sendTaskGroupToView(taskGroup: TaskGroup): void {
        if (this.combinesMultipleSections() || taskGroup.getProjectId() == this.activeProjectId) {
            let m = this.convertTaskGroup(taskGroup);
            this.currDataModel.taskGroups[taskGroup.getId()] = m;
            this.callViewMethod("setTaskGroup", JSON.stringify(m));
        }
    }

    sendProjectToView(project: Project): void {
        if (this.combinesMultipleSections() || project.getId() == this.activeProjectId) {
            let m = this.convertProject(project);
            this.currDataModel.projects[project.getId()] = m;
            this.callViewMethod("setProject", JSON.stringify(m));
        }
    }

    delTaskFromView(taskId: string): void {
        delete this.currDataModel.tasks[taskId];
        this.callViewMethod("delTask", taskId);
        this.setOrphansTaskGroupModels();
    }

    delTaskGroupFromView(taskGroupId: string): void {
        delete this.currDataModel.taskGroups[taskGroupId];
        this.callViewMethod("delTaskGroup", taskGroupId);
    }

    delProjectFromView(projectId: string): void {
        delete this.currDataModel.projects[projectId];
        this.callViewMethod("delProject", projectId);
    }

    convertTask(task: Task): TaskModel {
        let td = this.getTaskTitleAndDescriptionText(task);
        let overdueDate = new Date(task.getEndTimestamp());
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
    }

    convertTaskGroup(taskGroup: TaskGroup): TaskGroupModel {
        let project = this.tasksPlugin.projects[this.session.hostHash][taskGroup.getProjectId()];
        if (!project) {
            let keys = Object.keys(this.tasksPlugin.projects[this.session.hostHash]);
            for (let i = 0; i < keys.length && !project; ++i) {
                if (this.tasksPlugin.projectSectionExists(this.session, keys[i])) {
                    project = this.tasksPlugin.projects[this.session.hostHash][keys[i]];
                }
            }
        }

        let taskLabelClasses: { [key: string]: string } = {};
        if (project) {
            let arr = Task.getStatuses();
            for (let i = arr.length - 1; i >= 0; --i) {
                taskLabelClasses[arr[i]] = Task.getLabelClass(arr[i]);
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
    }

    convertProject(project: Project): ProjectModel {
        let taskLabelClasses: { [key: string]: string } = {};
        if (project) {
            let arr = Task.getStatuses();
            for (let i = arr.length - 1; i >= 0; --i) {
                taskLabelClasses[arr[i]] = Task.getLabelClass(arr[i]);
            }
        }

        return {
            id: project.getId(),
            name: project.getName(),
            statuses: Task.getStatuses(),
            pinnedTaskGroupIds: project.getPinnedTaskGroupIds(),
            taskGroupsOrder: project.getTaskGroupsOrder(),
            taskLabelClasses: taskLabelClasses,
        };
    }

    convertTasks(tasksMap: TasksMap): { [id: string]: TaskModel } {
        let res: { [id: string]: TaskModel } = {};
        for (let id in tasksMap) {
            res[id] = this.convertTask(tasksMap[id]);
        }
        return res;
    }

    convertTaskGroups(taskGroupsMap: TaskGroupsMap): { [id: string]: TaskGroupModel } {
        let res: { [id: string]: TaskGroupModel } = {};
        for (let id in taskGroupsMap) {
            res[id] = this.convertTaskGroup(taskGroupsMap[id]);
        }
        return res;
    }

    convertProjects(projectsMap: ProjectsMap): { [id: string]: ProjectModel } {
        let res: { [id: string]: ProjectModel } = {};
        for (let id in projectsMap) {
            res[id] = this.convertProject(projectsMap[id]);
        }
        return res;
    }

    calcTasksByStatus(projectId: string, taskGroupId: string): { [key: string]: number } {
        let project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        let tg = this.tasksPlugin.taskGroups[this.session.hostHash][taskGroupId];
        let tasks = tg ? tg.getTaskIds() : (project ? project.getOrphanedTaskIds() : []);
        let counts: { [key: string]: number } = {};
        for (let status of Task.getStatuses()) {
            counts[status] = 0;
        }
        for (let taskId of tasks) {
            let task = this.tasksPlugin.tasks[this.session.hostHash][taskId];
            if (task && this.isTaskRelevant(taskId)) {
                let st = task.getStatus();
                ++counts[st];
            }
        }
        return counts;
    }

    onViewCountTaskLines(channelId: number, taskIdsStr: string, width: number): void {
        this.taskLineWidth = width;
        let taskIds = JSON.parse(taskIdsStr);
        this.countTaskLines(taskIds, width).then(lines => {
            this.sendToViewChannel(channelId, JSON.stringify(lines));
        });
    }

    countTaskLines(taskIds: string[], width: number): Q.Promise<{ [id: string]: number }> {
        return this.parent.fontMetrics.measure().then(() => {
            let lines: { [id: string]: number } = {};
            if (taskIds) {
                for (let id of taskIds) {
                    let t = this.currDataModel.tasks[id];
                    lines[id] = this.parent.fontMetrics.countLines(t.title + " " + t.description, width, t.title.length);
                }
            }
            else {
                for (let id in this.currDataModel.tasks) {
                    let t = this.currDataModel.tasks[id];
                    lines[id] = this.parent.fontMetrics.countLines(t.title + " " + t.description, width, t.title.length);
                }
            }
            return lines;
        });
    }
    
    isTaskGroupUnread(projectId: string, taskGroupId: string): boolean {
        let project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        let tg = this.tasksPlugin.taskGroups[this.session.hostHash][taskGroupId];
        let taskIds = tg ? tg.getTaskIds() : (project ? project.getOrphanedTaskIds() : []);
        let firstUnreadTaskId = taskIds.find(x => {
            let task = this.tasksPlugin.tasks[this.session.hostHash][x];
            if (this.isTrash() != task.getIsTrashed()) {
                return false;
            }
            return this.tasksPlugin.wasTaskUnread(this.session, task, task.getProjectId());
        });
        return !!firstUnreadTaskId;
    }





    /****************************************
    *************** TaskPanel ***************
    *****************************************/
    setShowTaskPanel(value: boolean): void {
        this.dispatchEvent<TaskPanelChangeVisibilityRequestEvent>({
            type: "taskpanel-change-visibility-request",
            show: value,
        });
    }

    setTaskPanelLayout(horizontal: boolean): void {
        this.dispatchEvent<HorizontalTaskWindowLayoutChangeRequestEvent>({
            type: "horizontal-task-window-layout-change-request",
            horizontalLayout: horizontal,
        });
    }

    updateTaskPanel(): void {
        this.dispatchEvent<TaskPanelUpdateRequestEvent>({
            type: "taskpanel-update-request",
        });
    }





    /****************************************
    **************** Unreads ****************
    *****************************************/
    onViewMarkAllAsRead(): void {
        this.tasksPlugin.markAllAsRead(this.session, this.activeProjectId);
        this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.markedAllAsRead"));
        this.app.dispatchEvent<MarkedTasksAsReadEvent>({
            type: "marked-tasks-as-read",
            projectId: this.activeProjectId,
            hostHash: this.session.hostHash,
        });
    }






    /****************************************
    ******* Task/taskgroup management *******
    *****************************************/
    onViewNewTaskGroup(projectId: string): void {
        let project = this.tasksPlugin.getProject(this.session, projectId);
        if (project == null) {
            this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.projectDoesNotExist"));
            return;
        }

        if (!this.tasksPlugin.bringWindowToFront(TaskGroupFormWindowController.getWindowId(this.session, null))) {
            this.app.ioc.create(<any>TaskGroupFormWindowController, [this, this.session, projectId, project.getName()]).then(win => {
                this.parent.openChildWindow(<any>win).getPromise().then(
                    (result: any) => {
                        let tg = new TaskGroup();
                        DataMigration.setVersion(tg);
                        tg.setName(result.name);
                        tg.setDueDate(result.dueDate);
                        tg.setProjectId(projectId);
                        tg.setIcon(result.icon);
                        this.tasksPlugin.nextTaskGroupId(this.session).then(id => {
                            tg.setId(id);
                            this.tasksPlugin.saveTaskGroup(this.session, tg).then(() => {
                                this.tasksPlugin.saveProject(this.session, project);
                            });
                            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupCreated"));
                        });
                    },
                    () => {
                        // Cancelled
                    }
                );
            });
        }
    }

    onViewEditTaskGroup(projectId: string, taskGroupId: string): void {
        let taskGroup = this.tasksPlugin.getTaskGroup(this.session, taskGroupId);
        if (taskGroup == null) {
            this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.taskGroupDoesNotExist"));
            return;
        }
        let project = this.tasksPlugin.getProject(this.session, projectId);
        if (project == null) {
            this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.projectDoesNotExist"));
            return;
        }

        let model = {
            id: taskGroupId,
            name: taskGroup.getName(),
            dueDate: taskGroup.getDueDate(),
            projectName: project.getName(),
            icon: taskGroup.getIcon(),
        };
        if (!this.tasksPlugin.bringWindowToFront(TaskGroupFormWindowController.getWindowId(this.session, taskGroupId))) {
            this.app.ioc.create(<any>TaskGroupFormWindowController, [this, this.session, projectId, model]).then(win => {
                this.parent.openChildWindow(<any>win).getPromise().then(
                    (result: any) => {
                        if (result.deleted) {
                            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupDeleted"));
                            return;
                        }
                        let tg = taskGroup;
                        tg.setName(result.name);
                        tg.setDueDate(result.dueDate);
                        tg.setIcon(result.icon);
                        this.tasksPlugin.saveTaskGroup(this.session, tg)
                            .then(() => {
                                this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupModified"));
                            }).fail(e => {
                                if (e == "conflict") {
                                    this.parent.alert(this.i18n("plugin.tasks.component.taskGroupsPanel.taskGroupConflict"));
                                }
                            });
                    },
                    () => {
                        // Cancelled
                    }
                );
            });
        }
    }

    onViewNewTask(projectId: string | false, taskGroupId: string): void {
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
        let project: Project = null;
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

        let assignToMe = projectId == this.tasksPlugin.getPrivateSectionId() || this.activeProjectId == this.tasksPlugin.getPrivateSectionId()
            || projectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.activeProjectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
        let assignTo: string[] = assignToMe ? [this.tasksPlugin.getMyId(this.session)] : [];
        if (this.isConv2Section()) {
            assignTo = this.getActiveConv2Users();
        }

        if (!this.tasksPlugin.bringWindowToFront(TaskWindowController.getWindowId(this.session, null))) {
            this.app.ioc.create(<any>TaskWindowController, <any>[this, this.session, null, true, project, [taskGroupId], [], assignTo, false, true]).then(win => {
                this.parent.openChildWindow(<any>win).getPromise().then(
                    (result: any) => {
                        if (result.saved) {
                            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskCreated"));
                        }
                    }
                );
            });
        }
    }

    onViewDeleteTasks(taskIdsStr: string): void {
        let taskIds: Array<string> = JSON.parse(taskIdsStr);
        this.stripProjectFromFullTaskIds(taskIds);
        let notifId: number = null;
        this.tasksPlugin.askDeleteTasks(this.session, taskIds, this.activeProjectId != CustomTasksElements.TRASH_ID, this.parent.confirmEx.bind(this.parent)).progress((_n) => {
            if (_n == 0) {
                return;
            }
            let op = this.isTrash() ? "deleting" : "trashing";
            notifId = this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications." + op + "Task" + (_n > 1 ? "s" : "")));
        }).then(result => {
            if (result.deleted) {
                this.callViewMethod("deleteSelectedRows", result.fullDelete);
            }
        }).fin(() => {
            this.callViewMethod("unLockSelection");
            if (notifId) {
                this.notifications.hideNotification(notifId);
            }
        });
    }

    onViewRestoreTasks(taskIdsStr: string): void {
        let taskIds: Array<string> = JSON.parse(taskIdsStr);
        this.stripProjectAndTaskGroupFromFullTaskIds(taskIds);
        let notifId: number = null;
        let _n = taskIds.length;
        notifId = this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.restoringTask" + (_n > 1 ? "s" : "")));
        this.tasksPlugin.restoreFromTrash(this.session, taskIds)
            .then(() => {
                this.callViewMethod("deleteSelectedRows", false);
            })
            .fin(() => {
                this.callViewMethod("unLockSelection");
                if (notifId) {
                    this.notifications.hideNotification(notifId);
                }
            });
    }

    onViewChangeTasksParent(fullTaskIdsStr: string, taskGroupId: string, projectId: string) {
        if (taskGroupId == "null") {
            taskGroupId = null;
        }
        let fullTaskIds: Array<string> = JSON.parse(fullTaskIdsStr);
        this.stripProjectFromFullTaskIds(fullTaskIds);
        if (!this.tasksPlugin.projectsMatch(this.session, fullTaskIds, taskGroupId, projectId)) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.crossProjectMoveDisabled"));
            return;
        }
        this.tasksPlugin.moveTasks(this.session, fullTaskIds, [taskGroupId]);
    }

    onViewDuplicateTasks(fullTaskIdsStr: string, taskGroupId: string, projectId: string): void {
        if (taskGroupId == "null") {
            taskGroupId = null;
        }
        let fullTaskIds: Array<string> = JSON.parse(fullTaskIdsStr);
        this.stripProjectFromFullTaskIds(fullTaskIds);
        if (!this.tasksPlugin.projectsMatch(this.session, fullTaskIds, taskGroupId, projectId)) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.crossProjectCopydisable"));
            return;
        }
        let notifId = this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.pastingTasks"));
        this.tasksPlugin.duplicateTasks(this.session, fullTaskIds, taskGroupId).fin(() => {
            this.notifications.hideNotification(notifId);
        });
    }

    onViewMoveTasks(fullTaskIdsStr: string): void {
        let fullTaskIds: string[] = JSON.parse(fullTaskIdsStr);

        let taskTgs: { [tId: string]: string[] } = {};
        let tgIds: string[] = [];
        for (let fId of fullTaskIds) {
            let [pId, tgId, tId] = fId.split("/");
            if (!(tId in taskTgs)) {
                taskTgs[tId] = [];
            }
            taskTgs[tId].push(tgId);
            if (tgIds.indexOf(tgId) < 0) {
                tgIds.push(tgId);
            }
        }
        let commonTgIds: string[] = [];
        for (let tgId of tgIds) {
            let inAll = true;
            for (let t in taskTgs) {
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
            let tId = Object.keys(taskTgs)[0];
            commonTgIds = this.tasksPlugin.tasks[this.session.hostHash][tId].getTaskGroupIds().slice();
        }

        this.stripProjectFromFullTaskIds(fullTaskIds);
        this.app.ioc.create(TaskGroupSelectorWindowController, [this.parent, this.session, this.activeProjectId, commonTgIds]).then(win => {
            win.parent = this.parent.getClosestNotDockedController();
            this.parent.openChildWindow(win).getPromise().then(
                result => {
                    let taskGroupIds: string[] = result.taskGroupIds;
                    let notifId: number = null;
                    this.tasksPlugin.moveTasks(this.session, fullTaskIds, taskGroupIds, true, (numTasksToSave) => {
                        if (numTasksToSave > 0) {
                            notifId = this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.movingTasks"));
                        }
                    }).fin(() => {
                        if (notifId !== null) {
                            this.notifications.hideNotification(notifId);
                        }
                    });
                }
            );
        });
    }

    onViewMoveTaskGroup(tgId: string, posDelta: number): void {
        // Get TaskGroup and Project
        if (tgId != "__orphans__" && !(tgId in this.tasksPlugin.taskGroups[this.session.hostHash])) {
            return;
        }
        let proj: Project;
        if (tgId == "__orphans__") {
            proj = this.tasksPlugin.projects[this.session.hostHash][this.activeProjectId];
        }
        else {
            let tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
            if (!(tg.getProjectId() in this.tasksPlugin.projects[this.session.hostHash])) {
                return;
            }
            proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
        }

        // Calc new position
        proj.syncTaskGroupsIdsOrder(this.tasksPlugin.taskGroups[this.session.hostHash]);
        let projTgIds = proj.getTaskGroupsOrder().slice();
        let currPos = projTgIds.indexOf(tgId);
        let pinnedGroups = proj.getPinnedTaskGroupIds();
        let pinnedMode = pinnedGroups.indexOf(tgId) >= 0;
        let maxPos = projTgIds.filter(id => id == "__orphans__" || (this.tasksPlugin.taskGroups[this.session.hostHash][id] && !this.tasksPlugin.taskGroups[this.session.hostHash][id].getDetached())).length - 1;
        let newPos = 0;
        if (pinnedMode) {
            if (Math.abs(posDelta) == 1) {
                let mul = 1;
                let pos = currPos + posDelta;
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
                let mul = 1;
                let pos = currPos + posDelta;
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

        // Update project's list of taskgroups
        projTgIds.splice(newPos, 0, projTgIds.splice(currPos, 1)[0]);
        proj.setTaskGroupsOrder(projTgIds.slice());
        this.tasksPlugin.saveProject(this.session, proj);
    }

    onViewToggleTaskGroupPinned(taskGroupId: string, pinned: boolean): void {
        this.tasksPlugin.changeTaskGroupPinned(this.session, this.activeProjectId, taskGroupId, pinned);
        if (pinned) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupPinned"));
        }
        else {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskGroupUnpinned"));
        }
    }

    onViewToggleTaskPinned(taskId: string, taskGroupId: string, pinned: boolean): void {
        this.tasksPlugin.changeTaskPinned(this.session, taskId, taskGroupId, pinned);
        if (pinned) {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskPinned"));
        }
        else {
            this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskUnpinned"));
        }
    }

    onViewOpenTaskWindow(taskId: string, editMode: boolean = false): void {
        if (!this.tasksPlugin.bringWindowToFront(TaskWindowController.getWindowId(this.session, taskId))) {
            this.app.ioc.create(<any>TaskWindowController, [this, this.session, taskId, editMode]).then((win: any) => {
                this.parent.openChildWindow(win).getPromise().then((result: any) => {
                    if (result.saved) {
                        this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskModified"));
                    }
                    else if (result.deleted) {
                        this.notifications.showNotification(this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.taskDeleted"));
                    }
                    this.callViewMethod("grabFocus");
                });
            });
        }
    }

    stripProjectFromFullTaskIds(ids: string[]): void {
        for (let i = 0, len = ids.length; i < len; ++i) {
            ids[i] = ids[i].substr(ids[i].indexOf("/") + 1);
        }
    }

    stripProjectAndTaskGroupFromFullTaskIds(ids: string[]): void {
        for (let i = 0, len = ids.length; i < len; ++i) {
            ids[i] = ids[i].substr(ids[i].lastIndexOf("/") + 1);
        }
    }







    /****************************************
    ***************** Misc ******************
    *****************************************/
    onViewOpenChat(): void {
        let cnt = <window.container.ContainerWindowController>this.app.windows.container;
        if (this.activeProjectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.activeProjectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
            cnt.redirectToAppWindow("chat", this.getOtherPluginTarget(this.activeProjectId));
        }
    }

    onViewOpenNotes(): void {
        let cnt = <window.container.ContainerWindowController>this.app.windows.container;
        if (this.activeProjectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.activeProjectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
            cnt.redirectToAppWindow("notes2", this.getOtherPluginTarget(this.activeProjectId));
        }
    }

    onViewOpenCalendar(): void {
        let cnt = <window.container.ContainerWindowController>this.app.windows.container;
        if (this.activeProjectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.activeProjectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
            cnt.redirectToAppWindow("calendar", this.activeProjectId);
        }
    }

    getOtherPluginTarget(id: string): string {
        if (id == this.tasksPlugin.getPrivateSectionId()) {
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

    onViewFullRefresh(hard: boolean = true, showNotification: boolean = false): void {
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;
        Q().then(() => {
            let str = this.i18n("plugin.tasks.component.taskGroupsPanel.notifications.refreshing");
            let notificationId: number;
            if (showNotification) {
                notificationId = this.notifications.showNotification(str, {
                    autoHide: false,
                    progress: true,
                });
            }
            let prom = Q();
            if (hard) {
                prom = prom.then(() => <any>this.tasksPlugin.refreshCollections());
            }
            prom.then(() => {
            }).fin(() => {
                if (showNotification) {
                    this.notifications.hideNotification(notificationId);
                }
                this.callViewMethod("repaint");
            });
        })
            .fin(() => {
                setTimeout(() => {
                    this.isRefreshing = false;
                }, 800);
            });
    }

    updatePreview(): void {
        let n = this.selectedTasks.length;
        this.requestPreview(n == 1 ? this.selectedTasks[0].split("/")[2] : (n == 0 ? null : false));
    }

    onViewSelectionChanged(fullTaskIdsStr: string): void {
        // console.log("selected tasks");
        this.selectedTasks = JSON.parse(fullTaskIdsStr);

        this.updatePreview();
        if (this.selectedTasks.length == 1) {
            let task = this.tasksPlugin.tasks[this.session.hostHash][this.selectedTasks[0].split("/")[2]];
            if (task && this.tasksPlugin.wasTaskUnread(this.session, task, task.getProjectId()) && this.app.userPreferences.getAutoMarkAsRead()) {
                this.tasksPlugin.markTaskAsWatched(this.session, task.getId(), task.getProjectId());
                this.updateBadges(task.getProjectId());
            }
        }
    }

    updateBadges(sectionId: string): void {
        this.dispatchEvent<BadgesUpdateRequestEvent>({
            type: "badges-update-request",
        });
    }

    loadFromLocalStorage(): Q.Promise<void> {
        return this.getColWidths().then(widths => {
            this.colWidths = widths;
        });
    }

    getColWidths(): Q.Promise<{ [key: string]: number }> {
        let key = "tasks-cols-widths-" + this.context + "-" + this.activeProjectId;
        return this.tasksPlugin.localStorage.get(key).then(dataStr => {
            let data: { [key: string]: number } = JSON.parse(dataStr);
            let defaults = this.getDefaultColWidths();
            (<any>Object).assign(defaults, data);
            return defaults;
        });
    }

    onViewSetColWidths(dataStr: string): void {
        let data: { [key: string]: number } = JSON.parse(dataStr);
        let curr = this.colWidths;
        let newData: { [key: string]: number } = {};
        (<any>Object).assign(newData, curr);
        (<any>Object).assign(newData, data);
        this.colWidths = newData;
        let newDataStr = JSON.stringify(newData);
        let key = "tasks-cols-widths-" + this.context + "-" + this.activeProjectId;
        this.tasksPlugin.localStorage.set(key, newDataStr);
        this.app.dispatchEvent<TasksColWidthsChangedEvent>({
            type: "tasks-col-widths-changed",
            key: this.activeProjectId + "-" + this.context,
            sender: this.uniqueId,
        });
    }

    getDefaultColWidths(): { [key: string]: number } {
        return {
            "hash-id": DefaultColWidths.HASH_ID,
            "status": DefaultColWidths.STATUS,
            "assigned-to": DefaultColWidths.ASSIGNED_TO,
            "attachments": DefaultColWidths.ATTACHMENTS,
            "created": DefaultColWidths.CREATED,
            "modified": DefaultColWidths.MODIFIED,
        };
    }

    setPreviewDirty(dirty: boolean): void {
        this.callViewMethod("setPreviewDirty", dirty);
    }

    onViewConfirmPreviewExit(): void {
        this.callViewMethod("confirmPreviewExit");
    }






    /****************************************
    **************** Kanban *****************
    *****************************************/
    isKanban(): boolean {
        return !!this.getSetting("kanban-mode");
    }

    onViewDropTasks(fullTaskIds: string[], status: TaskStatus, newProjectId: string, newTaskGroupId: string): void {
        let toSave: { tasks: Task[], taskGroups: TaskGroup[], projects: Project[] } = { tasks: [], taskGroups: [], projects: [] };
        for (let fullTaskId of fullTaskIds) {
            let [pId, tgId, tId] = fullTaskId.split("/");
            let toSave2 = this.dropTask(tId, status, newProjectId, newTaskGroupId, tgId);
            if (toSave2) {
                // return this.tasksPlugin.sendTaskMessage(task, "modify-task");
                Utils.uniqueArrayMerge(toSave.tasks, toSave2.tasks);
                Utils.uniqueArrayMerge(toSave.taskGroups, toSave2.taskGroups);
                Utils.uniqueArrayMerge(toSave.projects, toSave2.projects);
            }
        }
        this.saveAll(toSave)
            .then(() => {
                return Q.all(toSave.tasks.map(task => this.tasksPlugin.sendTaskMessage(this.session, task, "modify-task")));
            })
    }

    onViewDropTask(taskId: string, status: TaskStatus, newProjectId: string, newTaskGroupId: string, currTaskGroupId: string): void {
        let toSave = this.dropTask(taskId, status, newProjectId, newTaskGroupId, currTaskGroupId);
        this.saveAll(toSave);
    }

    saveAll(toSave: { tasks: Task[], taskGroups: TaskGroup[], projects: Project[] }): Q.Promise<void> {
        let proms: Q.Promise<void>[] = [];
        for (let task of toSave.tasks) {
            proms.push(this.tasksPlugin.saveTask(this.session, task));
        }
        for (let proj of toSave.projects) {
            proms.push(this.tasksPlugin.saveProject(this.session, proj));
        }
        for (let tg of toSave.taskGroups) {
            proms.push(this.tasksPlugin.saveTaskGroup(this.session, tg));
        }
        return Q.all(proms).then(() => {
            // console.log("saved");
        }).fail(e => {
            // console.error("rej", e);
        });
    }

    dropTask(taskId: string, status: TaskStatus, newProjectId: string, newTaskGroupId: string, currTaskGroupId: string): { tasks: Task[], taskGroups: TaskGroup[], projects: Project[] } {
        let task = this.tasksPlugin.tasks[this.session.hostHash][taskId];
        let tgsToSave: TaskGroup[] = [];
        let projsToSave: Project[] = [];
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
        let myId = this.tasksPlugin.getMyId(this.session);
        let now = new Date().getTime();
        if (status) {
            let prevStatus = task.getStatus();
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
            let newProject = this.tasksPlugin.projects[this.session.hostHash][newProjectId];
            let currProject = this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()];
            for (let tgId of task.getTaskGroupIds()) {
                if (tgId == "__orphans__") {
                    currProject.removeOrphanedTasksId(taskId);
                    if (projsToSave.indexOf(currProject) < 0) {
                        projsToSave.push(currProject);
                    }
                }
                let tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
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
                let tg = this.tasksPlugin.taskGroups[this.session.hostHash][newTaskGroupId];
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
                let project = this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()];
                project.addOrphanedTasksId(taskId, true);
                if (projsToSave.indexOf(project) < 0) {
                    projsToSave.push(project);
                }
            }
            else {
                let newTaskGroup = this.tasksPlugin.taskGroups[this.session.hostHash][newTaskGroupId];
                newTaskGroup.addTaskId(taskId, true);
                if (tgsToSave.indexOf(newTaskGroup) < 0) {
                    tgsToSave.push(newTaskGroup);
                }
            }
            if (currTaskGroupId == "__orphans__") {
                let project = this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()];
                project.removeOrphanedTasksId(taskId);
                if (projsToSave.indexOf(project) < 0) {
                    projsToSave.push(project);
                }
            }
            else {
                let currTaskGroup = this.tasksPlugin.taskGroups[this.session.hostHash][currTaskGroupId];
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
    }

    onViewCopyTasksToClipboard(fullTaskIdsStr: string): void {
        let fullTaskIds: string[] = JSON.parse(fullTaskIdsStr);
        let text = this.getTasksCopiedString(fullTaskIds);
        this.app.setSystemCliboardData({
            text: text,
        });
    }

    getTasksCopiedString(fullTaskIds: string[]): string {
        return fullTaskIds
            .map(x => x.split("/")[2])
            .map(x => this.tasksPlugin.tasks[this.session.hostHash][x])
            .filter(x => x)
            .map(x => striptags(x.getDescription().replace(/<br\s*\/?>/gi, ' ')))
            .join("\n");
    }





    /****************************************
    *************** Clipboard ***************
    *****************************************/
    mostRecentTasksClipboardElement: app.common.clipboard.ClipboardElement = null;

    onViewAddToClipboard(elementStr: string, addedAtTs: number): void {
        let data: TasksClipboardData = JSON.parse(elementStr);
        let addedAt = new Date(addedAtTs);
        if (this.mostRecentTasksClipboardElement && this.mostRecentTasksClipboardElement.data) {
            (<TasksClipboardData>this.mostRecentTasksClipboardElement.data).isCut = false;
        }
        let str = this.getTasksCopiedString(data.fullTaskIds);
        this.app.clipboard.add(this.wrapTaskClipboardData(data, str), addedAt);
    }

    onViewUpdateClipboard(dataStr: string, addedAtTs: number): void {
        let data: TasksClipboardData = JSON.parse(dataStr);
        let addedAt = new Date(addedAtTs);
        let element = this.mostRecentTasksClipboardElement;
        if (element && element.addedAt == addedAt) {
            this.app.clipboard.update(element, this.wrapTaskClipboardData(data));
        }
    }

    wrapTaskClipboardData(data: TasksClipboardData, str: string = null): any {
        let obj: any = {};
        obj[app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS] = data;
        if (str) {
            obj["text"] = str;
        }
        return obj;
    }

    updateFromClipboard(paste: boolean = false): void {
        let element = this.app.clipboard.findMatchingElement(app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS);
        if (element) {
            if (!this.mostRecentTasksClipboardElement || element.data != this.mostRecentTasksClipboardElement.data || element.modifiedAt != this.mostRecentTasksClipboardElement.modifiedAt) {
                let data: TasksClipboardData = element.data[app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS];
                this.callViewMethod("updateFromClipboard", JSON.stringify(data), element.addedAt.getTime(), paste);
            }
        }
    }

    onViewPaste(): void {
        Q().then(() => {
            return this.app.getClipboardElementToPaste(
                [
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE,
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES,
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS,
                ], [
                app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES,
            ]
            );
        })
            .then(element => {
                if (!element) {
                    return;
                }
                if (app.common.clipboard.Clipboard.FORMAT_PRIVMX_TASKS in element.data) {
                    this.updateFromClipboard(true);
                }
                else if (element.source == "system" || element.source == "privmx") {
                    let pasteFromOsStr = element.data[app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES];
                    let pasteFromOs: { mime: string, path?: string, data?: Buffer }[] = pasteFromOsStr ? JSON.parse(pasteFromOsStr).map((x: { mime: string, path?: string, data?: any }) => {
                        if (x.data && x.data.type == "Buffer" && x.data.data) {
                            x.data = new Buffer(x.data.data);
                        }
                        return x;
                    }) : [];
                    let fileElements = pasteFromOs.filter(x => !!x.path);
                    let imgElements = pasteFromOs.filter(x => !!x.data);
                    let pmxFiles: mail.section.OpenableSectionFile[] = [];
                    if (element.data[app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE]) {
                        pmxFiles.push(element.data[app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE].element);
                    }
                    else if (element.data[app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES]) {
                        for (let el of element.data[app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES]) {
                            pmxFiles.push(el.element);
                        }
                    }
                    Q().then(() => {
                        let proms: Q.Promise<mail.section.OpenableSectionFile>[] = [];
                        if (fileElements.length > 0) {
                            for (let file of fileElements) {
                                let fileName = file.path;
                                if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                                    fileName = fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                                }
                                let data: Buffer = file.data ? file.data : require("fs").readFileSync(file.path);
                                proms.push(this.upload(privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)));
                            }
                        }
                        else if (pmxFiles.length > 0) {
                            for (let osf of pmxFiles) {
                                proms.push(osf.getBuffer().then(buff => {
                                    return this.upload(privfs.lazyBuffer.Content.createFromBuffer(buff, osf.mimeType, osf.name))
                                }));
                            }
                        }
                        else {
                            let file = imgElements[0];
                            let formatNum = (x: number) => {
                                let p = x < 10 ? "0" : "";
                                return `${p}${x}`;
                            };
                            let now = new Date();
                            let y = now.getFullYear();
                            let m = formatNum(now.getMonth() + 1);
                            let d = formatNum(now.getDate());
                            let h = formatNum(now.getHours());
                            let i = formatNum(now.getMinutes());
                            let s = formatNum(now.getSeconds());
                            let r = Math.floor(Math.random() * 10000);
                            let ext = file.mime.split("/")[1];
                            let fileName = `${y}${m}${d}-${h}${i}${s}-${r}.${ext}`;
                            proms.push(this.upload(privfs.lazyBuffer.Content.createFromBuffer(file.data, file.mime, fileName)));
                        }
                        return Q.all(proms);
                    })
                        .then((osfs: mail.section.OpenableSectionFile[]) => {
                            return this.tasksPlugin.openNewTaskWindow(this.session, this.getActiveSection(), osfs);
                        });
                }
            });
    }

    upload(content: privfs.lazyBuffer.IContent): Q.Promise<mail.section.OpenableSectionFile> {
        return this.getActiveSection().uploadFile({
            data: content,
        })
            .then(result => {
                return <any>result.openableElement;
            });
    }

    ///////////////////////////
    //// REMOTE SECTIONS //////
    //////////////////////////

    setSession(session: mail.session.Session, onlyProjectId: string = null): Q.Promise<void> {
        // console.log("on setSession")
        return Q().then(() => {
            this.session = session;

            //override services
            return Q.all([
                this.session.mailClientApi.privmxRegistry.getIdentity(),
                this.session.mailClientApi.privmxRegistry.getPersonService()
            ])
            .then(res => {
                this.identity = res[0];
                this.personService = res[1];
                this.conv2Service = this.session.conv2Service;
                this.sectionManager = this.session.sectionManager;
                return this.tasksPlugin.checkInit();
            })
            .then(() => {
                return Q.all(this.tasksPlugin.tasksSectionsCollection[this.session.hostHash].list.map(x => {
                    if (onlyProjectId && onlyProjectId != x.getId()) {
                        return;
                    }
                    return this.tasksPlugin.ensureProjectExists(x.getId(), x.getName(), this.session);
                }))
                .thenResolve(null);
            });
        })
    }
    
}
