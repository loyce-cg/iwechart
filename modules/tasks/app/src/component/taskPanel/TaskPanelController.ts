import { window, Q, component, Logger as RootLogger, mail, utils, app, privfs, Promise as SimplitoPromise, Types } from "pmc-mail";
import { TasksPlugin, TasksComponentFactory, UpdatePinnedTaskGroupsEvent, TasksSettingChanged, HorizontalTaskWindowLayoutChangeRequestEvent, BadgesUpdateRequestEvent } from "../../main/TasksPlugin";
import { EventHandler, Action, Watchable, TaskId, AttachmentId, ProjectId, TaskGroupId, TaskHistoryEntry, PersonId, Person, PeopleMap, ProjectsMap, TaskGroupsMap, TaskCommentTag, CommentBody, WatchedTaskItem, HostHash } from "../../main/Types";
import { Task, TaskStatus } from "../../main/data/Task";
import { CustomSelectController, CustomSelectItem } from "../customSelect/CustomSelectController";
import { TaskWindowController } from "../../window/task/TaskWindowController";
import { Project } from "../../main/data/Project";
import MsgBoxResult = window.msgbox.MsgBoxResult;
import MsgBoxOptions = window.msgbox.MsgBoxOptions;
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { TaskGroup } from "../../main/data/TaskGroup";
import { TaskGroupFormWindowController } from "../../window/taskGroupForm/TaskGroupFormWindowController";
import { DataMigration } from "../../main/DataMigration";
import { i18n } from "./i18n/index";
import { AttachmentsManager } from "../../main/AttachmentsManager";
import { HistoryManager } from "../../main/HistoryManager";
import { Utils } from "../../main/utils/Utils";

const Logger = RootLogger.get("privfs-tasks-plugin.TaskPanelController");

export interface Result {
    name: string;
    description: string;
    type: number;
    status: number;
    priority: number;
    attachments: Array<AttachmentId>;
    assignedTo: Array<PersonId>;
    taskGroupIds: Array<TaskGroupId>;
    projectId: ProjectId;
    startTimestamp: number;
    endTimestamp: number;
    wholeDays: boolean;
}

export interface Model {
    docked: boolean;
    newTask: boolean;
    taskExists: boolean;
    isEditTaskWindow: boolean;
    canRemoveFromCalendar: boolean;
    
    hasTask: boolean;
    taskId: TaskId|false;
    taskDone: boolean;
    taskName: string;
    taskLabelClass: string;
    taskDescription: string;
    taskType: string;
    taskStatus: string;
    taskPriority: string;
    taskAttachmentsStr: string;
    taskAssignedToStr: string;
    taskAssignedToArrayStr: string;
    taskHistoryStr: string;
    taskGroupIdsStr: string;
    taskGroupNamesStr: string;
    taskGroupsPinnedStr: string;
    taskGroupsIconsStr: string;
    taskCommentsStr: string;
    taskIsTrashed: boolean;
    taskStartTimestamp: number;
    taskEndTimestamp: number;
    taskWholeDays: boolean;
    projectId: ProjectId;
    projectName: string;
    projectPrefix: string;
    projectPublic: boolean;
    editable: boolean;
    scrollToComments: boolean;
    myAvatar: string;
    enterSavesTask: boolean;
    enterAddsComment: boolean;
    horizontalLayout: boolean;
    
    resolvedTaskHistoryStr?: string;
    taskStatusesStr: string;
    
    isRead: boolean
    autoMarkAsRead: boolean;
    
    hostHash: string;
}

export interface InternalModel {
    docked: boolean;
    newTask: boolean;
    taskExists: boolean;
    isEditTaskWindow: boolean;
    canRemoveFromCalendar: boolean;
    
    hasTask: boolean;
    taskId: TaskId|false;
    taskDone: boolean;
    taskName: string;
    taskLabelClass: string;
    taskDescription: string;
    taskType: string;
    taskStatus: string;
    taskPriority: string;
    taskAttachments: Array<AttachmentId>;
    taskAssignedTo: PeopleMap;
    taskAssignedToArray: Array<Person>;
    taskHistory: Array<TaskHistoryEntry>;
    taskGroupIds: Array<TaskGroupId>;
    taskGroupNames: Array<string>;
    taskGroupsPinned: Array<string>;
    taskGroupsIcons: Array<string>;
    taskComments: Array<ResolvedTaskComment>;
    taskIsTrashed: boolean;
    taskStartTimestamp: number;
    taskEndTimestamp: number;
    taskWholeDays: boolean;
    projectId: ProjectId;
    projectName: string;
    projectPrefix: string;
    projectPublic: boolean;
    editable: boolean;
    scrollToComments: boolean;
    myAvatar: string;
    enterSavesTask: boolean;
    enterAddsComment: boolean;
    horizontalLayout: boolean;
    
    resolvedTaskHistory?: Array<ResolvedTaskHistoryEntry>;
    taskStatuses: { [taskId: string]: string };
    
    isRead: boolean
    autoMarkAsRead: boolean;
    
    hostHash: string;
}

interface ResolvedTaskHistoryEntry {
    when: number;
    who: Person;
    what: "created"|"moved"|"modified"|"added"|"removed"|"trashed"|"restored";
    message?: string;
    arg?: "name"|"description"|"type"|"status"|"priority"|"attachment"|"person"|"projectId"|"startTimestamp"|"duration"|"endTimestamp"|"wholeDays";
    oldString?: string;
    newString?: string;
    oldAttachment?: AttachmentId;
    newAttachment?: AttachmentId;
    oldPerson?: Person;
    newPerson?: Person;
    isAttachmentTrashed?: boolean;
}

interface ResolvedTaskComment {
    dateTime: number;
    message: string;
    userAvatar: string;
    userName: string;
    userHashmail: string;
    relatedCommentTag?: string;
}

export interface ActionHandlers {
    close: () => void,
    alert: (msg: string) => Q.Promise<MsgBoxResult>,
    confirm: (msg: string) => Q.Promise<MsgBoxResult>,
    confirmEx: (options: MsgBoxOptions) => Q.Promise<MsgBoxResult>,
    openWindowParent: any,
    openChildWindow: <T extends window.base.BaseWindowController>(win: T) => T,
    updateDirty: (dirty: boolean) => void,
}

export interface TaskOutOfSync {
    isTrashed: boolean;
}

@Dependencies(["taskscustomselect", "persons", "notification"])
export class TaskPanelController<T extends window.base.BaseWindowController = window.base.BaseWindowController> extends window.base.WindowComponentController<T> {
    
    static textsPrefix: string = "plugin.tasks.component.taskPanel.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject sinkIndexManager: mail.SinkIndexManager;
    
    handlers: ActionHandlers;
    docked: boolean;
    handle: privfs.fs.descriptor.Handle;
    
    tasksPlugin: TasksPlugin;
    internalModel: InternalModel;
    result: Result;
    dataChangedListener: EventHandler;
    onTaskGroupChangedListener: EventHandler;
    onTaskChangedListener: EventHandler;
    
    taskId: TaskId|false;
    obtainedTaskId: TaskId = null;
    
    customSelectProject: CustomSelectController;
    customSelectTaskGroup: CustomSelectController;
    customSelectAssignedTo: CustomSelectController;
    customSelectType: CustomSelectController;
    customSelectStatus: CustomSelectController;
    customSelectPriority: CustomSelectController;
    dateTimePicker: any;
    dateTimePicker2: any;
    
    editable: boolean;
    
    newTask: boolean = false;
    newTaskProject: Project = null;
    newTaskTaskGroupIds: Array<TaskGroupId> = null;

    openedAsEditable: boolean = false;
    
    // personsComponent: component.persons.PersonsController;
    notifications: component.notification.NotificationController;
    taskTooltip: component.tasktooltip.TaskTooltipController;
    sectionTooltip: component.sectiontooltip.SectionTooltipController;
    encryptionEffectTaskText: component.encryptioneffect.EncryptionEffectController;
    encryptionEffectCommentText: component.encryptioneffect.EncryptionEffectController;
    
    saved: boolean = false;
    deleted: boolean = false;
    componentFactory: TasksComponentFactory;
    assignTo: string[] = [];
    scrollToComments: boolean = false;
    dirty: boolean = false;
    origHistoryLength: number = 0;
    defaultDateTime: Date = null;
    overrideIsHorizontalLayout: boolean = null;
    confirmExit: boolean = true;
    onDirtyChanged: () => void;
    sectionFileTreeDeferreds: { [sectionId: string]: Q.Deferred<mail.filetree.nt.Tree> } = {};
    
    lastTreeWatcherOpId: number = 0;
    currFileTree: mail.filetree.nt.Tree = null;
    onFileTreeCollectionChangedBound: () => void = null;
    
    initialAttachments: mail.section.OpenableSectionFile[] = null;
    attachmentsManager: AttachmentsManager;
    historyManager: HistoryManager;
    modifiedPropertyNames: string[] = [];

    watchedTasksHistoryRebuildHandlerBound: (hostHash: string, pId: ProjectId) => void;
    watchedTasksHistorySetHandlerBound: (hostHash: string, pId: ProjectId, tId: TaskId, it: WatchedTaskItem) => void;
    onTaskCreatedHandlers: ((taskId: string) => void)[] = [];
    onCancelledHandlers: (() => void)[] = [];
    
    constructor(
        parent: T,
        public session: mail.session.Session,
        public personsComponent: component.persons.PersonsController,
        handlers: ActionHandlers, docked: boolean = true, editable: boolean = false,
        attachments: mail.section.OpenableSectionFile[] = []
    ) {
        super(parent);
        this.app.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            this.onUserPreferencesChange(event);
        });
        this.initialAttachments = attachments && attachments.length > 0 ? attachments : null;
        this.onFileTreeCollectionChangedBound = this.onFileTreeCollectionChanged.bind(this);
        this.ipcMode = true;
        this.handlers = handlers;
        this.openedAsEditable = editable;
        this.editable = editable;
        this.docked = docked;
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        this.watchedTasksHistoryRebuildHandlerBound = this.watchedTasksHistoryRebuildHandler.bind(this);
        this.watchedTasksHistorySetHandlerBound = this.watchedTasksHistorySetHandler.bind(this);
        this.tasksPlugin.onWatchedTasksHistoryRebuild(this.watchedTasksHistoryRebuildHandlerBound);
        this.tasksPlugin.onWatchedTasksHistorySet(this.watchedTasksHistorySetHandlerBound);
        this.historyManager = new HistoryManager(this.app.sessionManager.getLocalSession(), this.tasksPlugin);
        this.attachmentsManager = new AttachmentsManager(this.app.sessionManager.getLocalSession(), this.tasksPlugin, this.historyManager);
        this.parent.addViewStyle({path: "window/component/dateTimePicker/template/main.css", plugin: "calendar"});
        this.parent.addViewScript({path: "build/view.js", plugin: "calendar"});
        this.dataChangedListener = this.onDataChanged.bind(this);
        this.onTaskGroupChangedListener = this.onTaskGroupChanged.bind(this);
        this.onTaskChangedListener = this.onTaskChanged.bind(this);
        let items: Array<CustomSelectItem> = [];
        this.customSelectProject = this.addComponent("customSelectProject", this.componentFactory.createComponent("taskscustomselect", [this, items, { multi:false, editable:editable, firstItemIsStandalone:false }]));
        this.customSelectTaskGroup = this.addComponent("customSelectTaskGroup", this.componentFactory.createComponent("taskscustomselect", [this, items, { multi:true, editable:editable, firstItemIsStandalone:false, noSelectionText:this.i18n("plugin.tasks.component.taskPanel.task.taskGroup.noneSelected"), taskGroupCreator:this.newTaskGroup.bind(this) }]));
        this.customSelectAssignedTo = this.addComponent("customSelectAssignedTo", this.componentFactory.createComponent("taskscustomselect", [this, items, { multi:true, editable:editable, firstItemIsStandalone:false, noSelectionText:this.i18n("plugin.tasks.component.taskPanel.task.assignedTo.nooneSelected"), noSelectionPersonCanvas:true, collapseCanvases:true }]));
        this.customSelectType = this.addComponent("customSelectType", this.componentFactory.createComponent("taskscustomselect", [this, items, { multi:false, editable:editable, firstItemIsStandalone:false }]));
        this.customSelectStatus = this.addComponent("customSelectStatus", this.componentFactory.createComponent("taskscustomselect", [this, items, { multi:false, editable:editable, firstItemIsStandalone:false }]));
        this.customSelectPriority = this.addComponent("customSelectPriority", this.componentFactory.createComponent("taskscustomselect", [this, items, { multi:false, editable:editable, firstItemIsStandalone:false }]));
        this.dateTimePicker = this.addComponent("dateTimePicker", this.componentFactory.createComponent(<any>"dateTimePicker", [this, <any>{
            popup: true,
            week: false,
        }]));
        this.dateTimePicker2 = this.addComponent("dateTimePicker2", this.componentFactory.createComponent(<any>"dateTimePicker", [this, <any>{
            popup: true,
            week: false,
        }]));
        this.result = {
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
        // this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.sectionTooltip = this.addComponent("sectiontooltip", this.componentFactory.createComponent("sectiontooltip", [this]));
        this.encryptionEffectTaskText = this.addComponent("encryptionEffectTaskText", this.componentFactory.createComponent("encryptioneffect", [this]));
        this.encryptionEffectCommentText = this.addComponent("encryptionEffectCommentText", this.componentFactory.createComponent("encryptioneffect", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            return this.tasksPlugin ? this.tasksPlugin.getTaskTooltipContent(this.session, taskId) : null;
        };
        this.internalModel = {
            docked: this.docked,
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
            editable: this.editable,
            scrollToComments: this.scrollToComments,
            myAvatar: this.tasksPlugin.getMyself(this.app.sessionManager.getLocalSession()).id,
            enterSavesTask: this.getEnterSavesTask(),
            enterAddsComment: this.getEnterAddsComment(),
            horizontalLayout: this.getIsHorizontalLayout(),
            autoMarkAsRead: this.app.userPreferences.getAutoMarkAsRead(),
            isRead: false,
            hostHash: this.session ? this.session.hostHash : null,
        };
        
        this.dateTimePicker.onPopupClosed(this.onDatePickerPopupClosed.bind(this));
        this.dateTimePicker2.onPopupClosed(this.onDatePicker2PopupClosed.bind(this));
        
        this.resetAttachmentsUsingInitial();
        
        this.app.addEventListener<UpdatePinnedTaskGroupsEvent>("update-pinned-taskgroups", event => {
            if (this.internalModel.projectId == event.sectionId && this.internalModel.taskGroupIds && this.internalModel.taskGroupIds.indexOf(event.listId) >= 0) {
                let tgp = this.internalModel.taskGroupsPinned;
                let wasPinned = tgp.indexOf(event.listId) >= 0;
                let isPinned = event.pinned;
                if (wasPinned == isPinned) {
                    return;
                }
                if (isPinned) {
                    tgp.push(event.listId);
                }
                else {
                    tgp = this.internalModel.taskGroupsPinned = tgp.splice(tgp.indexOf(event.listId), 1);
                }
                this.callViewMethod("updatePinnedBadges", event.listId, event.pinned);
            }
        });
        this.app.addEventListener<TasksSettingChanged>("tasks-setting-changed", event => {
            if (event.setting == "enter-saves-task") {
                this.setEnterSavesTask(<boolean>event.value);
            }
            else if (event.setting == "enter-adds-comment") {
                this.setEnterAddsComment(<boolean>event.value);
            }
            else if (event.setting == "horizontal-task-window-layout") {
                this.refreshIsHorizontalLayout();
            }
        });
        this.tasksPlugin.watch(this.session, "taskGroup", "*", "modified", this.onTaskGroupChangedListener);
        this.tasksPlugin.watch(this.session, "task", "*", "modified", this.onTaskChangedListener);
        this.watchTreeCollection();
    }

    setSession(session: mail.session.Session): Q.Promise<void> {
        return Q().then(() => {
            // console.log("on taskPanel setSession");
            this.tasksPlugin.unWatch(this.session, "taskGroup", "*", "modified", this.onTaskGroupChangedListener);
            this.tasksPlugin.unWatch(this.session, "task", "*", "modified", this.onTaskChangedListener);
            this.session = session;

            // load sinkIndex of selected section
            return this.session.mailClientApi.privmxRegistry.getSinkIndexManager()
            .then(indexManager => indexManager.waitForInit().thenResolve(indexManager));
        })
        .then(indexManager => {
            this.sinkIndexManager = indexManager;
            let indexes = this.sinkIndexManager.getAllIndexes();
            this.historyManager = new HistoryManager(session, this.tasksPlugin);
            this.attachmentsManager = new AttachmentsManager(session, this.tasksPlugin, this.historyManager);
            
            this.taskTooltip.getContent = (taskId: string): string => {
                return this.tasksPlugin ? this.tasksPlugin.getTaskTooltipContent(this.session, taskId) : null;
            };

            this.tasksPlugin.watch(this.session, "taskGroup", "*", "modified", this.onTaskGroupChangedListener);
            this.tasksPlugin.watch(this.session, "task", "*", "modified", this.onTaskChangedListener);
        })
        .then(() => {
            this.callViewMethod("setHostHash", this.session.hostHash);
        });
    }
    
    watchedTasksHistoryRebuildHandler(hostHash: HostHash, pId: ProjectId): void {
        if (this.internalModel.projectId == pId && this.session.hostHash == hostHash) {
            this.updateIsRead();
        }
    }
    watchedTasksHistorySetHandler(hostHash: HostHash, pId: ProjectId, tId: TaskId, it: WatchedTaskItem): void {
        if (this.taskId == tId && this.session.hostHash == hostHash) {
            this.updateIsRead();
        }
    }
    updateIsRead(): void {
        if (this.taskId && this.internalModel) {
            let isRead = !this.tasksPlugin.isUnread(this.session, this.taskId);
            this.internalModel.isRead = isRead;
            this.callViewMethod("setIsRead", isRead);
        }
    }
    
    resetAttachmentsUsingInitial(): void {
        if (this.initialAttachments) {
            this.attachmentsManager.resetFromOpenableSectionFiles(this.initialAttachments);
        }
        else {
            this.attachmentsManager.reset();
        }
    }
    
    init(): Q.Promise<any> {
        return Q()
            .then(() => this.customSelectProject.init())
            .then(() => this.customSelectTaskGroup.init())
            .then(() => this.customSelectAssignedTo.init())
            .then(() => this.customSelectType.init())
            .then(() => this.customSelectStatus.init())
            .then(() => this.customSelectPriority.init())
            .then(() => this.dateTimePicker.init())
            .then(() => this.dateTimePicker2.init());
    }
    
    getModel(): Model {
        let trashedAttachments = this.internalModel.taskAttachments.map(x => JSON.parse(x)).filter(x => x.trashed).map(x => x.did);
        let attachments = this.attachmentsManager.getAttachmentInfoStrings().map(x => {
            let att = JSON.parse(x);
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
    }
    
    setHandle(handle: privfs.fs.descriptor.Handle): void {
        this.handle = handle;
    }
    
    getIsHorizontalLayout(): boolean {
        if (this.overrideIsHorizontalLayout !== null) {
            return this.overrideIsHorizontalLayout;
        }
        return this.newTask ? false : (this.docked ? (this.tasksPlugin.getSetting(this.session, "horizontal-task-window-layout", null, null) ? true : false) : true);
    }
    
    refreshIsHorizontalLayout(): void {
        this.setHorizontalLayout(this.getIsHorizontalLayout());
    }
    
    notify(key: string) {
        let str = this.i18n("plugin.tasks.component.taskPanel.notifications." + key);
        this.notifications.showNotification(str);
    }
    
    requestParentClose(confirmExit: boolean = true): void {
        this.confirmExit = confirmExit;
        if (!this.docked) {
            this.handlers.close();
        }
    }
    
    requestParentConfirm(msg: string): Q.Promise<MsgBoxResult> {
        return this.handlers.confirm(msg);
    }
    
    requestParentAlert(msg: string): Q.Promise<MsgBoxResult> {
        return this.handlers.alert(msg);
    }
    
    requestParentOpenChildWindow<T extends window.base.BaseWindowController>(wnd: T): T {
        return this.handlers.openChildWindow(wnd);
    }
    
    requestParentUpdateDirty(dirty: boolean) {
        return this.handlers.updateDirty(dirty);
    }
    
    updateView(dontDisturb: boolean = false, skipEditableCheck: boolean = false, comment: string = null, noViewCall: boolean = false, dataChanged: boolean = false): void {
        // console.log("on taskPanelController updateView");
        if (!skipEditableCheck && this.editable) {
            let data: TaskOutOfSync = {
                isTrashed: this.tasksPlugin.tasks[this.session.hostHash][<string>this.taskId] && this.tasksPlugin.tasks[this.session.hostHash][<string>this.taskId].getIsTrashed(),
            };
            if (!(this.taskId in this.tasksPlugin.tasks[this.session.hostHash])) {
                this.updateView(false, true, null, false, dataChanged);
                return;
            }
            if (this.internalModel && this.internalModel.hasTask && this.tasksPlugin.tasks[this.session.hostHash][<any>this.internalModel.taskId]) {
                let task = this.tasksPlugin.tasks[this.session.hostHash][<any>this.internalModel.taskId];
                let differentProperties: string[] = [];
                /*
    assignedTo: "[]"
    attachments: "["17tfP1W37dLfktSWsTAAou36wmoQZuadQA"]"
comment: ""
    description: "bbbbbbbbbbbf"
    endDateStr: "1970-01-01 01:00"
    project: "private:001"
    startDateStr: "1970-01-01 01:00"
    status: 1
    taskGroups: "[]" */
                if (this.internalModel.taskStatus != Task.getStatusText(task.getStatus())) {
                    differentProperties.push("status");
                }

                if (this.internalModel.taskStartTimestamp != task.getStartTimestamp()) {
                    differentProperties.push("startDateStr");
                }
                if (this.internalModel.taskStartTimestamp != task.getStartTimestamp() || this.internalModel.taskEndTimestamp != task.getEndTimestamp()) {
                    differentProperties.push("endDateStr");
                }
                if (this.internalModel.projectId != task.getProjectId()) {
                    differentProperties.push("project");
                }
                if (this.internalModel.taskDescription != task.getDescription()) {
                    differentProperties.push("description");
                }
                if (!Utils.arraysEqual(this.internalModel.taskAssignedToArray, this.tasksPlugin.getMembersArray(this.session, task.getAssignedTo()))) {
                    differentProperties.push("assignedTo");
                }

                let atts1 = this.internalModel.taskAttachments.map(x => JSON.parse(x).did);
                let atts2 = task.getAttachments().map(x => JSON.parse(x).did);
                if (!Utils.arraysEqual(atts1, atts2)) {
                    differentProperties.push("attachments");
                }
                if (!Utils.arraysEqual(this.internalModel.taskGroupIds, task.getTaskGroupIds())) {
                    differentProperties.push("taskGroups");
                }
                let canUpdate: boolean = true;
                for (let k in differentProperties) {
                    if (this.modifiedPropertyNames.indexOf(k) >= 0) {
                        canUpdate = false;
                    }
                }
                for (let k in this.modifiedPropertyNames) {
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
        let allCommentsLoaded = true;
        let task: Task;
        let wantedTaskId = this.taskId;
        this.internalModel.newTask = this.newTask;
        this.internalModel.hasTask = this.taskId ? (this.taskId in this.tasksPlugin.tasks[this.session.hostHash]) : false;
        this.internalModel.taskExists = this.tasksPlugin.tasks[this.session.hostHash][<string>this.taskId] ? true : this.newTask;
        this.internalModel.isEditTaskWindow = !this.internalModel.newTask && this.getIsHorizontalLayout();
        this.internalModel.enterSavesTask = this.getEnterSavesTask();
        this.internalModel.enterAddsComment = this.getEnterAddsComment();
        let fileTreePromise: Q.Promise<void> = null;
        if (this.internalModel.hasTask) {
            task = this.tasksPlugin.tasks[this.session.hostHash][<any>this.taskId];
            let taskGroupsIds = task.getTaskGroupIds(true).filter(id => id in this.tasksPlugin.taskGroups[this.session.hostHash]);
            let taskGroups = taskGroupsIds.map(id => this.tasksPlugin.taskGroups[this.session.hostHash][id]);
            let project = task.getProjectId() in this.tasksPlugin.projects[this.session.hostHash] ? this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()] : null;
            if (project == null) {
                return;
            }
            let types =  project.getTaskTypes(true, true);
            let statuses =  Task.getStatuses();
            let priorities =  project.getTaskPriorities(true, true);
            
            let resolveResult = this.resolveTaskComments(this.session, task);
            let comments = resolveResult.comments;
            allCommentsLoaded = resolveResult.allLoaded;
            let taskDescription: string = task.getDescription();
            if (task.getMetaDataStr()) {
                let metaData = utils.ContentEditableEditorMetaData.fromString(task.getMetaDataStr());
                taskDescription = metaData.attach(taskDescription);
            }
            this.internalModel.canRemoveFromCalendar = this.tasksPlugin.isTasksPluginEnabledInSection(this.session, task.getProjectId());
            this.internalModel.taskId = task.getId();
            this.internalModel.taskDone = task.getStatus() == TaskStatus.DONE;
            this.internalModel.taskName = task.getName();
            this.internalModel.taskLabelClass = task.getLabelClass();
            this.internalModel.taskDescription = taskDescription;
            this.internalModel.taskType = types[task.getType()];
            this.internalModel.taskStatus = Task.getStatusText(task.getStatus())
            this.internalModel.taskPriority = priorities[task.getPriority()];
            this.internalModel.taskAttachments = task.getAttachments();
            this.internalModel.taskAssignedToArray = this.tasksPlugin.getMembersArray(this.session, task.getAssignedTo());
            this.internalModel.taskHistory = task.getHistory();
            this.internalModel.taskGroupIds = task.getTaskGroupIds();
            this.internalModel.taskGroupNames = taskGroups.map(tg => tg.getName());
            this.internalModel.taskGroupsPinned = taskGroups.filter(tg => this.isTgPinned(tg)).map(tg => tg.getId());
            this.internalModel.taskGroupsIcons = taskGroups.map(tg => tg.getIcon());
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
                let section = this.internalModel.taskId ? this.session.sectionManager.getSection(this.internalModel.projectId) : null;
                if (section) {
                    if (!(section.getId() in this.sectionFileTreeDeferreds)) {
                        this.sectionFileTreeDeferreds[section.getId()] = Q.defer();
                        Q().then(() => {
                            return section.getFileTree();
                        }).then(tree => {
                            this.sectionFileTreeDeferreds[section.getId()].resolve(tree);
                        });
                    }
                    fileTreePromise = this.sectionFileTreeDeferreds[section.getId()].promise.then(tree => {
                        if (this.internalModel.taskId == wantedTaskId) {
                            let updateNames: { [did: string]: string } = {};
                            for (let idx in this.internalModel.taskAttachments) {
                                let attStr = this.internalModel.taskAttachments[idx];
                                let att = JSON.parse(attStr);
                                let entry = tree.collection.find(x => x.ref.did == att.did);
                                if (entry && entry.path && mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                                    continue;
                                }
                                att.trashed = !entry || entry.path.indexOf("/.trash/") >= 0;
                                if (entry && entry.name != att.name) {
                                    att.name = entry.name;
                                    updateNames[att.did] = att.name;
                                }
                                this.internalModel.taskAttachments[idx] = JSON.stringify(att);
                            }
                            for (let idx in this.internalModel.resolvedTaskHistory) {
                                let data: any = this.internalModel.resolvedTaskHistory[idx];
                                if (data.arg != "attachment" || (!data.newAttachment && !data.oldAttachment)) {
                                    continue;
                                }
                                let key = data.newAttachment ? "newAttachment" : "oldAttachment";
                                let att = JSON.parse(data[key]);
                                let entry = tree.collection.find(x => x.ref.did == att.did);
                                if (entry && entry.path && mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                                    continue;
                                }
                                data.isAttachmentTrashed = !entry || entry.path.indexOf("/.trash/") >= 0;
                            }
                            let updateNamesStr = JSON.stringify(updateNames);
                            if (updateNamesStr != "{}") {
                                this.callViewMethod("updateAttachmentNames", updateNamesStr);
                            }
                        }
                    });
                }
            }
            this.updateCustomSelects(task.getProjectId(), taskGroupsIds, task.getAssignedTo(), task.getType(), Task.getStatuses().indexOf(task.getStatus()), task.getPriority());
        }
        else if (this.taskId === false) {
            this.internalModel.taskId = false;
            this.internalModel.taskGroupIds = [];
            this.internalModel.taskGroupNames = [];
            this.internalModel.taskGroupsPinned = [];
            this.internalModel.taskGroupsIcons = []
            this.internalModel.myAvatar = this.tasksPlugin.getMyself(this.session).id;
            this.internalModel.taskIsTrashed = false;
            this.internalModel.taskStartTimestamp = this.defaultDateTime ? this.defaultDateTime.getTime() : null;
            this.internalModel.taskEndTimestamp = this.defaultDateTime ? (this.defaultDateTime.getTime() + 3600000) : null;
            this.internalModel.taskWholeDays = false;
        }
        else if (this.newTask) {
            let taskGroupsIds = this.newTaskTaskGroupIds.filter(id => id in this.tasksPlugin.taskGroups[this.session.hostHash]);
            let taskGroups = taskGroupsIds.map(id => this.tasksPlugin.taskGroups[this.session.hostHash][id]);
            let project = this.newTaskProject;
            
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
            this.internalModel.taskGroupNames = taskGroups.map(tg => tg.getName());
            this.internalModel.taskGroupsPinned = taskGroups.filter(tg => this.isTgPinned(tg)).map(tg => tg.getId());
            this.internalModel.taskGroupsIcons = taskGroups.map(tg => tg.getIcon());
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
                    status: Task.getStatuses().indexOf(Task.getDefaultStatus()),
                    priority: project ? project.getDefaultTaskPriorityId() : 2,
                };
            }
            let defaults = this.tasksPlugin.recentlyUsedTaskProperties;
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
        let prom = allCommentsLoaded ? Q() : this.fetchTaskComments(task);
        if (fileTreePromise) {
            prom = prom.then(() => fileTreePromise);
        }
        
        prom.then(() => {
            if (this.taskId != wantedTaskId) {
                return;
            }
            if (!allCommentsLoaded) {
                this.internalModel.taskComments = this.resolveTaskComments(this.session, task).comments;
            }
            if (!noViewCall) {
                this.callViewMethod("update", JSON.stringify(this.getModel()), dontDisturb, comment, dataChanged);
            }
        });
    }
    
    updateInternalModelAttachmentNames(): void {
        if (!this.internalModel || !this.internalModel.taskAttachments) {
            return;
        }
        
        let section = this.internalModel.taskId ? this.session.sectionManager.getSection(this.internalModel.projectId) : null;
        if (!section || !section.getFileModule() || !section.getFileModule().fileTree) {
            return;
        }
        let fileTree = section.getFileModule().fileTree;
        let fileNamesByDid: { [did: string]: string } = {};
        fileTree.collection.list.forEach(x => fileNamesByDid[x.ref.did] = x.name);
        
        let atts = this.internalModel.taskAttachments;
        for (let i = 0; i < atts.length; ++i) {
            let att = JSON.parse(atts[i]);
            if (att.did in fileNamesByDid && fileNamesByDid[att.did] != att.name) {
                att.name = fileNamesByDid[att.did];
                atts[i] = JSON.stringify(att);
            }
        }
    }
    
    isTgPinned(tg: TaskGroup): boolean {
        let proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
        if (proj) {
            return proj.getPinnedTaskGroupIds().indexOf(tg.getId()) >= 0;
        }
        return false;
    }
    
    updateCustomSelectsKeepSelection(projectId: ProjectId): void {
        // console.log("on updateCustomSelectsKeepSelection");
        if (!(projectId in this.tasksPlugin.projects[this.session.hostHash])) {
            return;
        }
        let proj = this.tasksPlugin.projects[this.session.hostHash][projectId];
        let tgs = proj.getTaskGroupIds();
        let taskGroupIds: Array<TaskGroupId> = this.customSelectTaskGroup.items.filter(it => it.selected && tgs.indexOf(it.val) >= 0).map(it => it.val);
        let assignedTo: Array<PersonId> = this.customSelectAssignedTo.items.filter(it => it.selected).map(it => it.val);
        let type: number = parseInt(this.customSelectType.items.filter(it => it.selected).map(it => it.val)[0]);
        let status: number = parseInt(this.customSelectStatus.items.filter(it => it.selected).map(it => it.val)[0]);
        let priority: number = parseInt(this.customSelectPriority.items.filter(it => it.selected).map(it => it.val)[0]);
        
        this.updateCustomSelects(projectId, taskGroupIds, assignedTo, type, status, priority);
    }
    
    updateCustomSelects(projectId: ProjectId, taskGroupIds: Array<TaskGroupId>, assignedTo: Array<PersonId>, type: number, status: number, priority: number): void {
        this.updateCustomSelectProjectItems(projectId);
        // console.log('b');
        this.updateCustomSelectTaskGroupItems(projectId, taskGroupIds);
        // console.log('c');
        this.updateCustomSelectAssignedToItems(projectId, assignedTo);
        // console.log('d');
        this.updateCustomSelectTaskTypeItems(projectId, type);
        // console.log('e');
        this.updateCustomSelectTaskStatusItems(projectId, status);
        // console.log('f');
        this.updateCustomSelectTaskPriorityItems(projectId, priority);
        // console.log('g');
        this.callViewMethod("updateAddAttachmentButton");
    }
    
    updateCustomSelectProjectItems(selectedProjectId: ProjectId): void {
        // console.log("on updateCustomSelectItems");
        let items: Array<CustomSelectItem> = [];
        let availProjects = this.tasksPlugin.getAvailableProjects(this.session);
        for (let k in availProjects) {
            let proj = availProjects[k];
            let icon = "@asset-DEFAULT_PRIVMX_ICON";
            if (proj.getId().substr(0, 8) == "private:") {
                let id = this.tasksPlugin.getMyId(this.session);
                icon = "!" + id;
            }
            let pubSection = false;
            let section: mail.section.SectionService = null;
            for (let entry of this.tasksPlugin.tasksSectionsCollection[this.session.hostHash].list) {
                if (entry.key.sectionId == proj.getId()) {
                    pubSection = entry.getScope() == "public";
                    section = entry;
                    break;
                }
            }
            let extraClasses: string[] = [];
            let extraAttributes: { [key: string]: string } = {};
            if (!pubSection) {
                extraClasses.push("tr-icon");
            }
            if (section && !section.isPrivateOrUserGroup()) {
                extraAttributes["data-section-id"] = section.getId();
            }
            
            let projectPrefix = null;
            let projectName = this.escapeHtml(proj.getName());
            if (section && !section.isPrivate()) {
                projectPrefix = this.escapeHtml(section.getFullSectionName(true, true));
            }
            // console.log("create item")
            items.push({
                icon: icon,
                val: k,
                text: projectPrefix ? ("<span class='project-full-name'><span class='project-prefix'>" + projectPrefix + "</span><span class='project-name'>" + projectName + "</span></span>") : projectName,
                selected: k == selectedProjectId,
                extraClass: extraClasses.join(" "),
                extraAttributes: extraAttributes,
                textNoEscape: true,
            });
        }
        this.customSelectProject.setItems(items);
    }
    
    updateCustomSelectTaskGroupItems(projectId: ProjectId, taskGroupsIds: Array<TaskGroupId>): void {
        // console.log("on updateCustomSelectTaskGroupItems");
        if (!projectId) {
            this.customSelectTaskGroup.setItems([]);
            return;
        }
        let taskGroups = taskGroupsIds.map(id => this.tasksPlugin.taskGroups[this.session.hostHash][id]);
        let project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        let items: Array<CustomSelectItem> = [];
        let isOrph = taskGroups.length == 0 || (taskGroups.length == 1 && taskGroups[0].getId() == "__orphans__");
        if (isOrph) {
            this.customSelectTaskGroup.value = "__orphans__";
            this.result.taskGroupIds = ["__orphans__"];
        }
        let noDetachedTgs = true;
        for (let tgId of taskGroupsIds) {
            let tg = this.tasksPlugin.taskGroups[this.session.hostHash][tgId];
            if (tg && tg.getDetached()) {
                noDetachedTgs = false;
                break;
            }
        }
        let tgs = project.getTaskGroupIds()
            .map(k => this.tasksPlugin.getTaskGroup(this.session, k))
            .filter(tg => tg && (!noDetachedTgs || !tg.getDetached()))
            .sort(this.taskGroupComparator.bind(this));
        for (let tg of tgs) {
            let tgId = tg.getId();
            if (tg && (!noDetachedTgs || !tg.getDetached())) {
                let proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
                let pinned = (proj ? proj.getPinnedTaskGroupIds().indexOf(tg.getId()) >= 0 : false);
                items.push({icon:tg.getIcon()?"@json-"+tg.getIcon():null, val:tgId, text:tg.getName(), selected:taskGroupsIds.indexOf(tgId) >= 0, extraClass:"taskgroup-label" + (pinned ? " pinned" : "")});
            }
        }
        items.push({icon:null, val:"__new_taskgroup__", text:null, selected:null, isTaskGroupCreator:true});
        this.customSelectTaskGroup.setItems(items);
    }
    
    escapeHtml(str: string|number|boolean): string {
        if (str == null) {
            return "";
        }
        
        let entityMap: {[name: string]: string} = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        let ss = typeof(str) == "string" ? str : str.toString();
        return ss.replace(/[&<>"'`=\/]/g, s => {
            return entityMap[s];
        });
    }
    
    secondComparator(a: TaskGroup, b: TaskGroup, firstVal: number) {
        if (firstVal != 0) {
            return firstVal;
        }
        return parseInt(b.getId()) - parseInt(a.getId());
    }
    
    taskGroupComparator(a: TaskGroup, b: TaskGroup): number {
        if ((a.getId() != "__orphans__" && !this.tasksPlugin.taskGroups[this.session.hostHash][a.getId()]) || (b.getId() != "__orphans__" && !this.tasksPlugin.taskGroups[this.session.hostHash][b.getId()])) {
            return (parseInt(b.getId()) - parseInt(a.getId()));
        }
        
        if (a.getDetached() && !b.getDetached()) {
            return 1;
        }
        if (!a.getDetached() && b.getDetached()) {
            return -1;
        }
        
        let proj = this.tasksPlugin.projects[this.session.hostHash][a.getProjectId()];
        let ap = (proj ? proj.getPinnedTaskGroupIds().indexOf(a.getId()) >= 0 : false) ? 1 : 0;
        let bp = (proj ? proj.getPinnedTaskGroupIds().indexOf(b.getId()) >= 0 : false) ? 1 : 0;
        if ((ap && !bp) || !ap && bp){
            return bp - ap;
        }
        
        if (proj) {
            let order = proj.getTaskGroupsOrder();
            let ai = order.indexOf(a.getId());
            let bi = order.indexOf(b.getId());
            if (ai == -1 || bi == -1) {
                proj.syncTaskGroupsIdsOrder(this.tasksPlugin.taskGroups[this.session.hostHash]);
                order = proj.getTaskGroupsOrder();
                ai = order.indexOf(a.getId());
                bi = order.indexOf(b.getId());
            }
            return this.secondComparator(a, b, ai - bi);
        }
        return parseInt(b.getId()) - parseInt(a.getId());
    }
    
    updateCustomSelectAssignedToItems(projectId: ProjectId, assignedTo: Array<PersonId>): void {
        // console.log("on updateCusotomSelectToItems")
        let items: Array<CustomSelectItem> = [];
        let members = this.tasksPlugin.getProjectMembers(this.session, projectId);
        let section = this.session.sectionManager.getSection(projectId);
        let limitToUsers: string[] = null;
        if (! this.session.conv2Service) {
            // console.log("no conv2service");
        }
        if (section) {
            limitToUsers = section.sectionData.group.users.slice();
            if (section.sectionData.group.type == "local") {
                for (let key in this.session.conv2Service.personService.persons.map) {
                    let person = this.session.conv2Service.personService.persons.map[key];
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
            for (let id of assignedTo) {
                let id2 = id.split("#")[0];
                if (limitToUsers.indexOf(id2) < 0) {
                    limitToUsers.push(id2);
                }
            }
        }
        for (let k in members) {
            let p = members[k];
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
            items.push({icon:"!"+p.id, val:k, text:p.name, selected:assignedTo.indexOf(p.id) >= 0});
        }
        this.customSelectAssignedTo.setItems(items);
    }
    
    updateCustomSelectSimpleItems(cs: CustomSelectController, data: Array<string>, selectedIdx: number, extraClass: string = ""): void {
        let items: Array<CustomSelectItem> = [];
        let taskId = this.taskId ? this.taskId : "";
        let isStatus = cs == this.customSelectStatus;
        for (let k in data) {
            let extraArg = extraClass == "task-label" ? [Task.getLabelClass(<TaskStatus>data[k]), taskId] : null;
            items.push({icon:null, val:k, text:isStatus?Task.getStatusText(<TaskStatus>data[k]):data[k], selected:<any>k == selectedIdx, extraClass:extraClass, extraArg:extraArg});
        }
        cs.setItems(items);
    }
    
    updateCustomSelectTaskTypeItems(projectId: ProjectId, selectedIdx: number): void {
        let project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        this.updateCustomSelectSimpleItems(this.customSelectType, project ? project.getTaskTypes(true, true) : this.tasksPlugin.getTaskTypes(), selectedIdx);
    }
    
    updateCustomSelectTaskStatusItems(projectId: ProjectId, selectedIdx: number): void {
        this.updateCustomSelectSimpleItems(this.customSelectStatus, Task.getStatuses(), selectedIdx, "task-label");
    }
    
    updateCustomSelectTaskPriorityItems(projectId: ProjectId, selectedIdx: number): void {
        let project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        this.updateCustomSelectSimpleItems(this.customSelectPriority, project ? project.getTaskPriorities(true, true) : this.tasksPlugin.getTaskPriorities(), selectedIdx);
    }
    
    fetchTaskComments(task: Task): Q.Promise<void> {
        // console.log("fetch task comments")
        //TODO: check whether sinkIndexManager is binding to session
        
        let toLoad: { [sinkId: string]: number[] } = { };
        let msgs: number[] = [];
        task.getCommentTags().forEach(x => {
            let msgData = x.split("/");
            if (msgData.length < 2) {
                return;
            }
            let sinkId: string = msgData[0];
            let msgId: number = Number(msgData[1]);
            if (!(sinkId in toLoad)) {
                toLoad[sinkId] = [];
            }
            toLoad[sinkId].push(msgId);
            msgs.push(msgId);
        });
        // return SimplitoPromise.PromiseUtils.oneByOne(toLoad, (sinkId, msgIds) => {
        //     let index = this.sinkIndexManager.getIndexBySinkId(sinkId);
        //     console.log("loaded index", index);
        //     if (index) {
        //         return index.loadMessages(msgIds);
        //     }
        // });

        return Q().then(() => {
            let section = this.session.sectionManager.getSection(task.getProjectId());
            return section.getChatModule().getSinkIndex().then(index => index.loadMessages(msgs))
        })
    }
    
    getMessageEntryById(id: number, sinkId: string): mail.SinkIndexEntry {
        let index = this.sinkIndexManager.getIndexBySinkId(sinkId);
        
        // console.log("getMessageEntryID", id);
        return index ? index.getEntry(id) : null;
    }

        
    resolveTaskCommentsPreVersion18(session: mail.session.Session, task: Task): ResolvedTaskComment[] {
        // console.log("resolveTaskCommentsPreVersion18")
        let comments: ResolvedTaskComment[] = [];
        let msgIds = task.getCommentTags();
        let allLoaded = true;
        
        msgIds.forEach( x => {
            let commentTag = x;
            let msgData = x.split("/");
            if (msgData.length < 2) {
                return;
            }
            let sinkId: string = msgData[0];
            let msgId: number = Number(msgData[1]);
            
            // console.log("getting messageEntryById", msgId, sinkId);
            
            let entry = this.getMessageEntryById(msgId, sinkId);
            if (!entry) {
                allLoaded = false;
                return;
            }
            
            let message = entry.getMessage();
            let commentMessage = JSON.parse(entry.source.data.text);
            let person = this.tasksPlugin.getPerson(session, commentMessage.who);
            let commentText = commentMessage.comment;
            if (commentMessage.metaDataStr) {
                let metaData = utils.ContentEditableEditorMetaData.fromString(commentMessage.metaDataStr);
                commentText = metaData.attach(commentText);
            }

            let comment: ResolvedTaskComment = {
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
    }

    resolveTaskComments(session: mail.session.Session, task: Task): { allLoaded: boolean, comments: ResolvedTaskComment[] } {
        let comments: ResolvedTaskComment[] = [];

        let fromSerialized = task.getComments();
        for (let t of fromSerialized) {
            let person = this.tasksPlugin.getPerson(session, t.userHashmail);
            
            let commentText = t.body.comment;
            if (t.body.metaDataStr) {
                let metaData = utils.ContentEditableEditorMetaData.fromString(t.body.metaDataStr);
                commentText = metaData.attach(commentText);
            }
            let comment: ResolvedTaskComment = {
                dateTime: t.dateTime,
                message: commentText,
                userAvatar: t.userHashmail,
                userName: person.name,
                userHashmail: t.userHashmail,
                relatedCommentTag: t.relatedCommentTag,
            };
            comments.push(comment);
        }

        let oldComments = this.resolveTaskCommentsPreVersion18(this.session, task);
        Utils.uniqueArrayMerge(comments, oldComments, (a, b) => {
            return a.relatedCommentTag && b.relatedCommentTag && a.relatedCommentTag == b.relatedCommentTag;
        });

        return {allLoaded: true, comments: comments};
    }
    

    resolveTaskHistory(task: Task, types: Array<string>, statuses: Array<string>, priorities: Array<string>): Array<ResolvedTaskHistoryEntry> {
        let arr: Array<ResolvedTaskHistoryEntry> = [];
        
        let i18nOrphansL = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.moved.orphansL");
        let i18nOrphansR = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.moved.orphansR");
        let i18nUnknown = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.moved.unknown");
        
        let fMakePerson = (person: Person): string => {
            return "{!{BEGIN_PERSON}!}" + person.avatar + "|||" + person.name + "|||" + person.id + "{!{END_PERSON}!}";
        };
        let fMakeAtt = (attStr: string): string => {
            let att = JSON.parse(attStr);
            return "{!{BEGIN_ATTACHMENT}!}" + att.did + "|||" + att.name + "{!{END_ATTACHMENT}!}";
        };
        let fMakeStartTimestamp = (ts: string|number): string => {
            if (!ts) {
                return this.i18n("plugin.tasks.component.taskPanel.task.startTimestamp.none");
            }
            return "{!{BEGIN_STARTTS}!}" + ts.toString() + "{!{END_STARTTS}!}";
        };
        let fMakeDuration = (ts: string|number): string => {
            if (!ts) {
                return this.i18n("plugin.tasks.component.taskPanel.task.duration.none");
            }
            return "{!{BEGIN_DURATION}!}" + ts.toString() + "{!{END_DURATION}!}";
        };
        
        for (let entry of task.getHistory()) {
            let who = this.tasksPlugin.getPerson(this.session, entry.who);
            let newEntry: ResolvedTaskHistoryEntry = {
                when: entry.when,
                who: who,
                what: entry.what,
                arg: entry.arg,
            };
            if (entry.what == "moved") {
                let fMakeLabel = (tg: TaskGroup): string => {
                    let proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
                    let pinned = (proj ? proj.getPinnedTaskGroupIds().indexOf(tg.getId()) >= 0 : false);
                    return "{!{BEGIN_TG_LABEL}!}" + tg.getId() + "|||" + tg.getName() + "|||" + (pinned ? 1 : 0) + "|||" + tg.getIcon() +  "{!{END_TG_LABEL}!}";
                };
                let fGetStr = (obj: string|number|Array<string>): string => {
                    if (!obj) {
                        return null;
                    }
                    if (typeof(obj) == "object") {
                        return obj
                        .filter(id => id in this.tasksPlugin.taskGroups[this.session.hostHash])
                        .map(id => this.tasksPlugin.taskGroups[this.session.hostHash][id])
                        .map(fMakeLabel).join("");
                    }
                    else {
                        return (obj in this.tasksPlugin.taskGroups[this.session.hostHash] ? this.tasksPlugin.taskGroups[this.session.hostHash][obj].getName() : null);
                    }
                };
                newEntry.oldString = fGetStr(entry.oldVal);
                newEntry.newString = fGetStr(entry.newVal);
                if (!newEntry.oldString) {
                    newEntry.message = this.i18n(
                        "plugin.tasks.component.taskPanel.task.history.entry.movedAdded",
                        fMakePerson(who),
                        newEntry.newString ? newEntry.newString : i18nOrphansR
                    );
                }
                else {
                    newEntry.message = this.i18n(
                        "plugin.tasks.component.taskPanel.task.history.entry.moved",
                        fMakePerson(who),
                        newEntry.oldString ? newEntry.oldString : i18nOrphansL,
                        newEntry.newString ? newEntry.newString : i18nOrphansR
                    );
                    if (newEntry.oldString === newEntry.newString) {
                        newEntry = null;
                    }
                }
            }
            else if (entry.what == "modified") {
                if (entry.arg == "priority" || entry.arg == "type") {
                    continue;
                }
                if (entry.arg == "description") {
                    newEntry.oldString = <string>entry.oldVal;
                    newEntry.newString = <string>entry.newVal;
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedDescription", fMakePerson(who));
                }
                else if (entry.arg == "name") {
                    newEntry.oldString = <string>entry.oldVal;
                    newEntry.newString = <string>entry.newVal;
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedName", fMakePerson(who), newEntry.oldString, newEntry.newString);
                }
                else if (entry.arg == "startTimestamp") {
                    newEntry.oldString = <string>entry.oldVal;
                    newEntry.newString = <string>entry.newVal;
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedStartTimestamp", fMakePerson(who), fMakeStartTimestamp(newEntry.oldString), fMakeStartTimestamp(newEntry.newString));
                }
                else if (entry.arg == "duration") {
                    continue;
                }
                else if (entry.arg == "endTimestamp") {
                    newEntry.oldString = <string>entry.oldVal;
                    newEntry.newString = <string>entry.newVal;
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedEndTimestamp", fMakePerson(who), fMakeStartTimestamp(newEntry.oldString), fMakeStartTimestamp(newEntry.newString));
                }
                else if (entry.arg == "wholeDays") {
                    continue;
                }
                else if (entry.arg == "attachment") {
                    newEntry.newAttachment = <AttachmentId>entry.newVal;
                    let modsCount = <number>JSON.parse(newEntry.newAttachment).modsCount;
                    if (modsCount == 1) {
                        newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedAttachment", fMakePerson(who), fMakeAtt(newEntry.newAttachment));
                    }
                    else {
                        newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedAttachmentMulti", fMakePerson(who), fMakeAtt(newEntry.newAttachment), modsCount);
                    }
                }
                else if (entry.arg == "projectId") {
                    newEntry.oldString = <string>entry.oldVal;
                    newEntry.newString = <string>entry.newVal;
                    let f = (id: string) => {
                        if (id in this.tasksPlugin.projects[this.session.hostHash]) {
                            let name = this.tasksPlugin.projects[this.session.hostHash][id].getName();
                            let isPublic = this.session.sectionManager.getSection(id).getScope() == "public";
                            if (id.substr(0, 8) == "private:") {
                                let me = this.tasksPlugin.getMyself(this.session);
                                return fMakePerson({
                                    avatar: me.id,
                                    name: name,
                                    id: me.id,
                                    isBasic: me.isBasic,
                                });
                            }
                            return "{!{BEGIN_SECTION}!}" + name + "|||" + (isPublic ? "public" : "") + "|||" + id + "{!{END_SECTION}!}";
                        }
                        return "<unknown>";
                    };
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modifiedProject", fMakePerson(who), f(newEntry.oldString), f(newEntry.newString));
                }
                else {
                    if (entry.arg == "status") {
                        let fMkStatus = (id: string|number): string => {
                            let s = typeof(id) == "number" ? Task.convertStatus(id, true) : id;
                            let cls = Task.getLabelClass(<TaskStatus>s);
                            return "{!{BEGIN_STATUS}!}" + Task.getStatusText(<TaskStatus>s) + "|||" + cls + "{!{END_STATUS}!}";
                        };
                        let fHas = (id: string|number): boolean => {
                            let s = typeof(id) == "number" ? Task.convertStatus(id, true) : id;
                            return statuses.indexOf(s) >= 0;
                        };
                        newEntry.oldString = fHas(<string|number>entry.oldVal) ? fMkStatus(<string|number>entry.oldVal) : i18nUnknown;
                        newEntry.newString = fHas(<string|number>entry.newVal) ? fMkStatus(<string|number>entry.newVal) : i18nUnknown;
                    }
                    let entryArg = entry.arg[0].toUpperCase() + entry.arg.substr(1);
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.modified" + entryArg, fMakePerson(who), newEntry.oldString, newEntry.newString);
                }
            }
            else if (entry.what == "added") {
                if (entry.arg == "attachment") {
                    newEntry.newAttachment = <AttachmentId>entry.newVal;
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.addedAttachment", fMakePerson(who), fMakeAtt(newEntry.newAttachment));
                }
                else if (entry.arg == "person") {
                    newEntry.newPerson = this.tasksPlugin.getPerson(this.session, <PersonId>entry.newVal);
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.addedPerson", fMakePerson(who), fMakePerson(newEntry.newPerson));
                }
            }
            else if (entry.what == "removed") {
                if (entry.arg == "attachment") {
                    newEntry.oldAttachment = <AttachmentId>entry.oldVal;
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.removedAttachment", fMakePerson(who), fMakeAtt(newEntry.oldAttachment));
                }
                else if (entry.arg == "person") {
                    //TODO: taskPlugin.getPerson should be session specific
                    newEntry.oldPerson = this.tasksPlugin.getPerson(this.session, <PersonId>entry.oldVal);
                    newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.removedPerson", fMakePerson(who), fMakePerson(newEntry.oldPerson));
                }
            }
            else if (entry.what == "created") {
                newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.created", fMakePerson(who));
            }
            else if (entry.what == "trashed") {
                newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.trashed", fMakePerson(who));
            }
            else if (entry.what == "restored") {
                newEntry.message = this.i18n("plugin.tasks.component.taskPanel.task.history.entry.restored", fMakePerson(who));
            }
            if (newEntry !== null) {
                arr.push(newEntry);
            }
        }
        
        return arr;
    }
    
    setTaskId(session: mail.session.Session, taskId: TaskId|false, project: Project = null, taskGroupIds: Array<TaskGroupId> = [], assignTo: string[] = [], scrollToComments: boolean = false, newTask: boolean = false, dateTime: Date = null, wholeDay: boolean = false): void {
        // console.log("on setTaskId", taskId);
        this.session = session;
        this.confirmExit = true;
        this.defaultDateTime = dateTime;
        if (dateTime) {
            this.result.startTimestamp = dateTime.getTime();
            this.result.endTimestamp = this.result.startTimestamp + 3600000;
        }
        this.result.wholeDays = !!wholeDay;
        
        let _task = this.tasksPlugin.tasks[session.hostHash][<string>taskId];
        let section = _task ? session.sectionManager.getSection(_task.getProjectId()) : null;
        if (section && !(section.getId() in this.sectionFileTreeDeferreds)) {
            this.sectionFileTreeDeferreds[section.getId()] = Q.defer();
            
            Q().then(() => {
                return section.getFileTree();
            }).then(tree => {
                this.sectionFileTreeDeferreds[section.getId()].resolve(tree);
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
            let task = this.tasksPlugin.tasks[session.hostHash][<TaskId>taskId];
            this.origHistoryLength = task.getHistory().length;
            if (this.tasksPlugin.wasTaskUnread(session, task, task.getProjectId()) && this.app.userPreferences.getAutoMarkAsRead()) {
                this.tasksPlugin.markTaskAsWatched(session, taskId, task.getProjectId());
                this.app.dispatchEvent<BadgesUpdateRequestEvent>({
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
            //this.filesToAttach.forEach( x => this.result.attachments.push(this.createAttachmentInfo(x)) );
            this.result.description = "";
            this.result.name = "";
            this.result.priority = project ? project.getDefaultTaskPriorityId() : 2;
            this.result.status = Task.getStatuses().indexOf(Task.getDefaultStatus());
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
    }
    
    updateResultFromTask(): void {
        if (this.taskId) {
            let task = this.tasksPlugin.getTask(this.session, this.taskId);
            if (task) {
                this.attachmentsManager.reset(task, this.session);
                this.result = {
                    assignedTo: task.getAssignedTo(),
                    attachments: task.getAttachments(),
                    description: task.getDescription(),
                    name: task.getName(),
                    priority: task.getPriority(),
                    status: Task.getStatuses().indexOf(task.getStatus()),
                    taskGroupIds: task.getTaskGroupIds(),
                    type: task.getType(),
                    projectId: task.getProjectId(),
                    startTimestamp: task.getStartTimestamp(),
                    endTimestamp: task.getEndTimestamp(),
                    wholeDays: task.getWholeDays(),
                };
            }
        }
    }
    
    onDataChanged(type: Watchable, id: string, action: Action): void {
        if (action == "deleted") {
            this.deleted = true;
            if (!this.docked) {
                this.requestParentClose();
            }
            return;
        }
        //this.updateView(this.editable);
        this.updateView(false, false, null, false, true);
    }
    
    onTaskGroupChanged(type: Watchable, id: string, action: Action): void {
        let task = this.tasksPlugin.tasks[this.session.hostHash][<string>this.taskId];
        if (task) {
            let tgIds = task.getTaskGroupIds();
            if (tgIds.indexOf(id) >= 0) {
                let tg = this.tasksPlugin.taskGroups[this.session.hostHash][id];
                if (tg) {
                    let proj = this.tasksPlugin.projects[this.session.hostHash][tg.getProjectId()];
                    let pinned: boolean = false;
                    if (proj) {
                        pinned = proj.getPinnedTaskGroupIds().indexOf(id) >= 0;
                    }
                    this.callViewMethod("updateTaskGroupBadge", tg.getId(), tg.getName(), tg.getIcon(), pinned);
                }
            }
        }
    }
    
    onTaskChanged(type: Watchable, id: string, action: Action): void {
        let task = this.tasksPlugin.tasks[this.session.hostHash][id];
        if (task) {
            this.callViewMethod("updateTaskBadge", task.getId(), Task.getLabelClass(task.getStatus()));
        }
    }
    
    beforeClose(): Q.Promise<boolean> {
        return Q().then(() => {
            if (this.confirmExit && this.dirty) {
                return this.closeConfirm();
            }
            return true;
        })
        .then(close => {
            if (close) {
                this.tasksPlugin.offWatchedTasksHistoryRebuild(this.watchedTasksHistoryRebuildHandlerBound);
                this.tasksPlugin.offWatchedTasksHistorySet(this.watchedTasksHistorySetHandlerBound);
                if (this.taskId) {
                    this.tasksPlugin.unWatch(this.session, "task", <any>this.taskId, "*", this.dataChangedListener);
                    this.tasksPlugin.unWatch(this.session, "taskGroup", "*", "modified", this.onTaskGroupChangedListener);
                    this.tasksPlugin.unWatch(this.session, "task", "*", "modified", this.onTaskChangedListener);
                    this.clearTreeCollectionWatcher();
                }
            }
            return close;
        });
    }
    
    closeConfirm(): Q.Promise<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            return this.handlers.confirmEx({
                message: this.i18n("plugin.tasks.component.taskPanel.unsavedChanges.message"),
                yes: {
                    faIcon: "trash",
                    btnClass: "btn-warning",
                    label: this.i18n("plugin.tasks.component.taskPanel.unsavedChanges.discard")
                },
                no: {
                    faIcon: "",
                    btnClass: "btn-default",
                    label: this.i18n("plugin.tasks.component.taskPanel.unsavedChanges.cancel")
                }
            })
            .then(result => {
                defer.resolve(result.result == "yes");
            });

        });
        return defer.promise;
    }
    
    onViewEditClick(comment: string): void {
        if (this.internalModel.docked) {
            //this.openEditWindow();
            this.toggleEditable();
            //this.updateView();
        }
        else {
            //this.toggleEditable();
        }
        this.updateView(false, true, comment);
    }
    
    onViewOpenAttachment(did: string, editable: boolean): void {
        let section: mail.section.SectionService;
        if (!(this.taskId in this.tasksPlugin.tasks[this.session.hostHash]) || this.taskId == false) {
            let att = this.attachmentsManager.find(did);
            section = this.session.sectionManager.getSection(att.currentSectionId);
            if (!section) {
                return;
            }
        }
        else {
            let t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
            section = this.session.sectionManager.getSection(t.getProjectId());
        }
        
        if (!section.hasFileModule()) {
            return;
        }
        Q().then(() => {
            return section.getFileTree();
        })
        .then(tree => {
            if (tree.collection.list.filter(x => x.ref.did == did).length == 0) {
                throw "File doesn't exist";
            }
            return tree.getPathFromDescriptor(did);
        })
        .then(path => {
            if (path.indexOf("/.trash/") >= 0 || mail.thumbs.ThumbsManager.isThumb(path)) {
                throw "File doesn't exist";
            }
            return section.getFileOpenableElement(path, false)
        })
        .then(openableFile => {
            this.app.shellRegistry.shellOpen({
                session: this.session,
                element: openableFile,
                action: editable ? app.common.shelltypes.ShellOpenAction.OPEN : app.common.shelltypes.ShellOpenAction.PREVIEW
            })
        }).fail(() => {
            this.handlers.alert(this.parent.i18n("plugin.tasks.component.taskPanel.fileDoesntExist"));
        });

    }
    
    onViewSaveEditClick(description: string, comment: string, closeAfterSaving: boolean): void {
        this.modifiedPropertyNames = [];
        this.onViewDirtyChanged(false, "[]");
        if (description.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
            return;
        }
        if (!this.result.projectId) {
            return;
        }
        
        this.result.description = description;
        Q().then(() => {
            return Q.all([
                this.encryptionEffectTaskText.show(description, this.getEncryptedTaskText.bind(this)),
                comment ? this.encryptionEffectCommentText.show(comment, this.getEncryptedCommentText.bind(this)) : Q.resolve(),
            ]);
        }).then(() => {
            return this.saveChanges();
        }).then(() => {
            if (comment) {
                return this.addComment(comment);
            }
        }).then(() => {
            if (this.docked) {
                this.toggleEditable();
                this.updateView(false, true);
                // @todo is this necessary?
                // this.attachmentsToAdd = [];
                // this.attachmentsToDelete = [];
                // this.tmpAttachments = [];
                // this.filesToAttach = [];
                // this.uploadedFileIds = [];
                
                // if (this.taskId && this.taskId in this.tasksPlugin.tasks) {
                //     this.tmpAttachments = this.tasksPlugin.tasks[this.taskId].getAttachments().slice();
                // }
                
                return;
            }
            if (this.openedAsEditable && closeAfterSaving) {
                this.requestParentClose(false);
            }
            else {
                this.updateView(false, true);
                this.notify("taskModified");
            }
        }).fail(e => {
            this.callViewMethod("restoreTexts", description, comment);
            if (e == "conflict") {
                this.requestParentAlert(this.i18n("plugin.tasks.component.taskPanel.conflictDuringSaving"));
            }
        });
    }
    
    onViewCancelEditClick(): void {
        this.triggerCancelled();
        this.attachmentsManager.reset(this.tasksPlugin.tasks[this.session.hostHash][<string>this.taskId], this.session);
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
        //this.toggleEditable();
        this.updateResultFromTask();
        if (this.openedAsEditable) {
            this.requestParentClose(false);
        }
        else {
            this.updateView(false, true);
        }
    }
    
    toggleEditable(): void {
        let editable = !this.editable;
        this.customSelectProject.setEditable(editable);
        this.customSelectTaskGroup.setEditable(editable);
        this.customSelectAssignedTo.setEditable(editable);
        this.customSelectType.setEditable(editable);
        this.customSelectStatus.setEditable(editable);
        this.customSelectPriority.setEditable(editable);
        this.editable = editable;
        this.internalModel.editable = editable;
    }
    
    openEditWindow(): void {
        let task = this.tasksPlugin.tasks[this.session.hostHash][<any>this.taskId];
        let project = task.getProjectId() in this.tasksPlugin.projects[this.session.hostHash] ? this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()] : null;
        if (project == null) {
            return;
        }
        
        if (!this.tasksPlugin.bringWindowToFront(TaskWindowController.getWindowId(this.session, task.getId()))) {
            this.app.ioc.create(TaskWindowController, [this.handlers.openWindowParent, this.session, task.getId(), true]).then(win => {
                this.requestParentOpenChildWindow(<any>win);
            });
        }
    }
    
    onViewDataChanged(key: string, value: string) {
        if (key == "taskGroupIds") {
            this.result.taskGroupIds = JSON.parse(value);
        }
        else if (key == "assignedTo") {
            let arrStr = value.split(",");
            this.result.assignedTo = arrStr.map(x => (x)).filter(x => x != "");
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
                //this.moveAttachments(null, value);
            }
            this.updateCustomSelectsKeepSelection(value);
            this.callViewMethod("refreshAvatars");
        }
    }
    
    commitAttachments(destinationSection: mail.section.SectionService, task: Task): Q.Promise<void> {
        return Q().then(() => {
            this.tasksPlugin.lockAttachmentModificationMessages(this.session, task.getId());
            return this.attachmentsManager.commit(destinationSection, task, this.handle ? [this.handle] : []);
        })
        .fin(() => {
            this.tasksPlugin.unlockAttachmentModificationMessages(this.session, task.getId());
        });
    }
    
    saveChanges(): Q.Promise<void> {
        if (this.result.description.trim().length == 0) {
            return Q();
        }
        
        this.saved = true;
        let task = this.tasksPlugin.tasks[this.session.hostHash][<any>this.taskId];
        let origTask = task ? <Task>this.tasksPlugin.createObject(this.session, {key:"t_"+task.getId(),payload:JSON.parse(JSON.stringify(task))}) : undefined;
        let taskVersion = task ? this.tasksPlugin.getTaskVersion(this.session, <any>this.taskId) : undefined;
        let project: Project;
        project = this.tasksPlugin.projects[this.session.hostHash][this.result.projectId];
        if (project == null) {
            return Q();
        }
        let destinationSection = this.session.sectionManager.getSection(project.getId());
        let result: Result = JSON.parse(JSON.stringify(this.result));
        result.assignedTo = this.customSelectAssignedTo.value.split(",").filter(x => x.length > 0);
        result.status = parseInt(this.customSelectStatus.value);
        result.projectId = this.customSelectProject.value;
        result.taskGroupIds = this.customSelectTaskGroup.value.split(",").filter(x => x.length > 0);
        let oldProject: Project = null;
        let metaDataStr: string = "";
        return Q().then(() => {
            if (!this.newTask && task.getProjectId() != result.projectId) {
                oldProject = this.tasksPlugin.projects[this.session.hostHash][task.getProjectId()];
                return this.tasksPlugin.deleteKvdbElement(this.session, oldProject.getId(), "t_" + task.getId(), true);
            }
        })
        .then(() => {
            return this.app.prepareHtmlMessageBeforeSending(result.description, this.session).then(newText => {
                let { metaData, html } = utils.ContentEditableEditorMetaData.extractMetaFromHtml(newText);
                metaDataStr = JSON.stringify(metaData);
                result.description = html;
            });
        })
        .then(() => {
            if (this.newTask) {
                this.tasksPlugin.recentlyUsedTaskProperties = {
                    type: result.type,
                    status: result.status,
                    priority: result.priority,
                };
                
                if (result.taskGroupIds.length == 0) {
                    result.taskGroupIds = ["__orphans__"];
                }
                for (let k in result.taskGroupIds) {
                    let v = result.taskGroupIds[k];
                    if (v == undefined || v == "") {
                        result.taskGroupIds[k] = "__orphans__";
                    }
                }
                let nowTimestamp = new Date().getTime();
                let t = new Task();
                DataMigration.setVersion(t);
                t.setDescription(result.description);
                t.setAssignedTo(result.assignedTo);
                t.setType(result.type);
                t.setStatus(Task.getStatuses()[result.status]);
                t.setPriority(result.priority);
                t.setProjectId(project.getId());
                t.setTaskGroupIds(result.taskGroupIds);
                t.setCreatedBy(this.tasksPlugin.getMyId(this.session));
                t.setCreatedDateTime(nowTimestamp);
                t.setModifiedBy(this.tasksPlugin.getMyId(this.session));
                t.setModifiedDateTime(nowTimestamp);
                t.setStartTimestamp(result.startTimestamp);
                t.setEndTimestamp(result.endTimestamp);
                t.setWholeDays(result.wholeDays);
                t.setMetaDataStr(metaDataStr);
                t.addHistory({
                    when: nowTimestamp,
                    who: this.tasksPlugin.getMyId(this.session),
                    what: "created",
                });
                
                let prom = this.obtainedTaskId ? Q(this.obtainedTaskId) : this.tasksPlugin.nextTaskId(this.session);
                prom.then(id => {
                    t.setId(id);
                    return this.commitAttachments(destinationSection, t)
                    .then(() => {
                        return id;
                    });
                })
                .then(id => {
                    let prom = Q();
                    this.tasksPlugin.addTask(this.session, t);
                    let added = false;
                    for (let k of result.taskGroupIds) {
                        if (k != "__orphans__") {
                            let taskGroup = this.tasksPlugin.getTaskGroup(this.session, k);
                            if (taskGroup.getProjectId() != project.getId()) {
                                continue;
                            }
                            added = true;
                            taskGroup.addTaskId(id, true);
                            let f = () => this.tasksPlugin.saveTaskGroup(this.session, taskGroup);
                            prom = prom.then(<any>f);
                        }
                        else {
                            added = true;
                            project.addOrphanedTasksId(id, true);
                            let f = () => this.tasksPlugin.saveProject(this.session, project);
                            prom = prom.then(<any>f);
                        }
                    }
                    if (!added) {
                        project.addOrphanedTasksId(id, true);
                        let f = () => this.tasksPlugin.saveProject(this.session, project);
                        prom = prom.then(<any>f);
                    }
                    prom = prom.then(() => <any>this.tasksPlugin.saveTask(this.session, t));
                    prom = prom.then(() => {
                        this.triggerTaskCreated(id);
                    });
                    return prom;
                })
                .fail(e => {
                    console.log(e);
                });
                this.requestParentClose(false);
            }
            else {
                let now = new Date().getTime();
                let n0 = this.origHistoryLength;
                this.addTaskHistory(task, result, now);
                let n1 = task.getHistory().length;
                if (n1 != n0 || oldProject || this.attachmentsManager.isModified()) {
                    let prevTaskGroupIds = task.getTaskGroupIds(true);
                    task.setAssignedTo(result.assignedTo);
                    task.setDescription(result.description);
                    task.setPriority(result.priority);
                    task.setStatus(Task.getStatuses()[result.status]);
                    task.setType(result.type);
                    task.setTaskGroupIds(JSON.parse(JSON.stringify(result.taskGroupIds)));
                    task.setModifiedDateTime(now);
                    task.setModifiedBy(this.tasksPlugin.getMyId(this.session));
                    task.setProjectId(project.getId());
                    task.setStartTimestamp(result.startTimestamp);
                    task.setEndTimestamp(result.endTimestamp);
                    task.setWholeDays(result.wholeDays);
                    task.setMetaDataStr(metaDataStr);
                    
                    let saveProject = false;
                    let saveTgs = [];
                    for (let id of prevTaskGroupIds) {
                        if (result.taskGroupIds.indexOf(id) < 0) {
                            if (!id || id == "__orphans__") {
                                (oldProject ? oldProject : project).removeOrphanedTasksId(task.getId());
                            }
                            else {
                                if (id in this.tasksPlugin.taskGroups[this.session.hostHash]) {
                                    let tg = this.tasksPlugin.taskGroups[this.session.hostHash][id];
                                    tg.removeTaskId(task.getId());
                                    saveTgs.push(tg);
                                }
                            }
                        }
                    }
                    for (let id of result.taskGroupIds) {
                        if (prevTaskGroupIds.indexOf(id) < 0) {
                            if (!id || id == "__orphans__") {
                                project.addOrphanedTasksId(task.getId(), true);
                                saveProject = true;
                            }
                            else {
                                if (id in this.tasksPlugin.taskGroups[this.session.hostHash]) {
                                    let tg = this.tasksPlugin.taskGroups[this.session.hostHash][id];
                                    if (tg.getProjectId() != project.getId()) {
                                        continue;
                                    }
                                    tg.addTaskId(task.getId(), true);
                                    saveTgs.push(tg);
                                }
                            }
                        }
                    }
                    
                    let prom = this.commitAttachments(destinationSection, task);
                    if (oldProject) {
                        prom = prom.then(() => <any>this.tasksPlugin.saveProject(this.session, oldProject));
                    }
                    if (saveProject) {
                        prom = prom.then(() => <any>this.tasksPlugin.saveProject(this.session, project));
                    }
                    for (let tg of saveTgs) {
                        prom = prom.then(() => <any>this.tasksPlugin.saveTaskGroup(this.session, tg));
                    }
                    prom = prom.then(() => <any>this.tasksPlugin.saveTask(this.session, task, taskVersion, origTask))
                    .then(() => {
                        return this.tasksPlugin.sendTaskMessage(this.session, task, "modify-task");
                    }).fail(e => {
                        console.log(e);
                    });
                    return prom;
                }
            }
        }).then(() => {
            this.initialAttachments = null;
        });
    }
    
    onViewDeleteClick(): void {
        if (this.taskId === false) {
            return;
        }
        let taskIds: Array<string> = [this.taskId];
        let t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];

        this.tasksPlugin.askDeleteTasks(this.session, taskIds, t ? !t.getIsTrashed() : true, <any>this.handlers.confirmEx)
        .then(() => {
            this.updateView(false, true);
        })
    }
    
    onViewRestoreFromTrash(): void {
        if (this.taskId === false) {
            return;
        }
        let taskIds: Array<string> = [this.taskId];

        this.tasksPlugin.restoreFromTrash(this.session, taskIds).then(() => {
            this.updateView(false, true);
        });
    }
    
    onViewRevertClick(entryId: number): void {
        if (!(entryId in this.internalModel.resolvedTaskHistory) || this.taskId === false) {
            return;
        }
        this.requestParentConfirm(this.i18n("plugin.tasks.component.taskPanel.task.history.revert.confirm")).then(result => {
            let data: Partial<Result> = {};
            let task = this.tasksPlugin.tasks[this.session.hostHash][<TaskId>this.taskId];

            if (result.result == "yes") {
                let projectsToSave: ProjectsMap = {};
                let taskGroupsToSave: TaskGroupsMap = {};
                
                let entry = this.internalModel.taskHistory[entryId];
                if (entry.what == "moved") {
                    data.taskGroupIds = <Array<TaskGroupId>>entry.oldVal;
                    this.addTaskHistory(task, data);
                    
                    let from = task.getTaskGroupIds();
                    let to = data.taskGroupIds;
                    for (let id of from) {
                        if (to.indexOf(id) < 0) {
                            if (id && id != "__orphans__") {
                                let tg = this.tasksPlugin.getTaskGroup(this.session, id);
                                if (tg) {
                                    tg.removeTaskId(<TaskId>this.taskId);
                                    taskGroupsToSave[id] = tg;
                                }
                            }
                            else {
                                let pId = task.getProjectId();
                                let proj = this.tasksPlugin.getProject(this.session, pId);
                                if (proj) {
                                    proj.removeOrphanedTasksId(<TaskId>this.taskId);
                                    projectsToSave[pId] = proj;
                                }
                            }
                        }
                    }
                    for (let id of to) {
                        if (from.indexOf(id) < 0) {
                            if (id && id != "__orphans__") {
                                let tg = this.tasksPlugin.getTaskGroup(this.session, id);
                                if (tg) {
                                    tg.addTaskId(<TaskId>this.taskId, true);
                                    taskGroupsToSave[id] = tg;
                                }
                            }
                            else {
                                let pId = task.getProjectId();
                                let proj = this.tasksPlugin.getProject(this.session, pId);
                                if (proj) {
                                    proj.addOrphanedTasksId(<TaskId>this.taskId, true);
                                    projectsToSave[pId] = proj;
                                }
                            }
                        }
                    }
                    task.setTaskGroupIds(data.taskGroupIds);
                }
                else if (entry.what == "modified") {
                    (<any>data)[entry.arg] = entry.oldVal;
                    this.addTaskHistory(task, data);
                    task["set" + entry.arg.charAt(0).toUpperCase() + entry.arg.substr(1)](entry.oldVal);
                }
                else if (entry.what == "added") {
                    if (entry.arg == "attachment") {
                        let atts = task.getAttachments(true);
                        let idx = atts.indexOf(<AttachmentId>entry.newVal);
                        if (idx >= 0) {
                            task.addHistory({
                                when: new Date().getTime(),
                                who: this.tasksPlugin.getMyId(this.session),
                                what: "removed",
                                arg: "attachment",
                                oldVal: entry.newVal,
                            });
                            atts.splice(idx, 1);
                            data.attachments = atts;
                            task.removeAttachment(<AttachmentId>entry.newVal);
                        }
                    }
                    else if (entry.arg == "person") {
                        let atts = task.getAssignedTo(true);
                        let idx = atts.indexOf(<PersonId>entry.newVal);
                        if (idx >= 0) {
                            atts.splice(idx, 1);
                            data.assignedTo = atts;
                            this.addTaskHistory(task, data);
                            task.removeAssignedTo(<PersonId>entry.newVal);
                        }
                    }
                }
                else if (entry.what == "removed") {
                    if (entry.arg == "attachment") {
                        let atts = task.getAttachments(true);
                        let idx = atts.indexOf(<AttachmentId>entry.oldVal);
                        if (idx < 0) {
                            task.addHistory({
                                when: new Date().getTime(),
                                who: this.tasksPlugin.getMyId(this.session),
                                what: "added",
                                arg: "attachment",
                                newVal: entry.oldVal,
                            });
                            atts.push(<AttachmentId>entry.oldVal);
                            data.attachments = atts;
                            task.addAttachment(<AttachmentId>entry.oldVal);
                        }
                    }
                    else if (entry.arg == "person") {
                        let atts = task.getAssignedTo(true);
                        let idx = atts.indexOf(<PersonId>entry.oldVal);
                        if (idx < 0) {
                            atts.push(<PersonId>entry.oldVal);
                            data.assignedTo = atts;
                            this.addTaskHistory(task, data);
                            task.addAssignedTo(<PersonId>entry.oldVal);
                        }
                    }
                }
                
                let prom = Q();

                for (let id in projectsToSave) {
                    let f = () => this.tasksPlugin.saveProject(this.session, projectsToSave[id]);
                    prom = prom.then(<any>f);
                }
                for (let id in taskGroupsToSave) {
                    let f = () => this.tasksPlugin.saveTaskGroup(this.session, taskGroupsToSave[id]);
                    prom = prom.then(<any>f);
                }
                let f = () => this.tasksPlugin.saveTask(this.session, task);
                prom = prom.then(<any>f);
            }
        });
    }
    
    // Compares task with new data and puts changes into task's history
    addTaskHistory(task: Task, newData: Partial<Result>, nowTimestamp: number = null) {
        let now = nowTimestamp ? nowTimestamp : new Date().getTime();
        let myId = this.tasksPlugin.getMyId(this.session);
        let tgHist: TaskHistoryEntry = null;
        let projChanged = false;
        for (let key in newData) {
            let oldValue = task["get" + key.charAt(0).toUpperCase() + key.substr(1)]();
            let newValue = (<any>newData)[key];
            
            let different: boolean = false;
            if (typeof(oldValue) == "object" && typeof(newValue) == "object" && oldValue != null && newValue != null) {
                if (oldValue.length == newValue.length) {
                    for (let k in oldValue) {
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
                    newValue = Task.getStatuses()[newValue];
                }
                different = oldValue != newValue;
            }
            if (different) {
                if (key == "assignedTo") {
                    for (let el of this._getAddedElements(oldValue, newValue)) {
                        task.addHistory({
                            when: now,
                            who: myId,
                            what: "added",
                            arg: "person",
                            newVal: el,
                        });
                    }
                    for (let el of this._getAddedElements(newValue, oldValue)) {
                        task.addHistory({
                            when: now,
                            who: myId,
                            what: "removed",
                            arg: "person",
                            oldVal: el,
                        });
                    }
                }
                else if (key == "name" || key == "description" || key == "status" || key == "startTimestamp" || key == "duration" || key == "endTimestamp" || key == "wholeDays") {//} || key == "type" || key == "priority") {
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
    }
    
    private _getAddedElements(arr1: Array<number>, arr2: Array<number>): Array<number> {
        let added: Array<number> = [];
        
        for (let el of arr2) {
            if (arr1.indexOf(el) < 0) {
                added.push(el);
            }
        }
        
        return added;
    }
    
    addCommentPreVersion18BackCompat(text: string): Q.Promise<string> {
        if (this.taskId == false || text.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
            return Q().thenResolve(null);
        }
        else {
            let t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
            let commentTag: string = null;
            return this.tasksPlugin.sendTaskCommentMessage(this.session, t, text)
            .then(result => {
                commentTag = result.message.mainReceiver.sink.id + "/" + result.message.id;
                t.addCommentTag(commentTag);
                //t.setModifiedDateTime(new Date().getTime());
                //t.setModifiedBy(this.tasksPlugin.getMyId(this.session));
                //return <any>this.tasksPlugin.saveTask(this.session, t, version, origTask);
                return commentTag;
            })
            .fail(e => {
                Logger.error("Error during saving task comment", e);
                return null;
            });
        }
    }

    // addCommentOrig(text: string): Q.Promise<boolean> {
    //     let metaDataStr: string = null;
    //     return Q().then(() => {
    //         return this.app.prepareHtmlMessageBeforeSending(text).then(newText => {
    //             let { metaData, html } = utils.ContentEditableEditorMetaData.extractMetaFromHtml(newText);
    //             text = html;
    //             metaDataStr = JSON.stringify(metaData);
    //         });
    //     })
    //     .then(() => {
    //         if (this.taskId == false || text.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
    //             return Q().thenResolve(false);
    //         }
    //         else {
    //             let t = this.tasksPlugin.tasks[this.taskId];
    //             let version = this.tasksPlugin.getTaskVersion(t.getId());
    //             let origTask = <Task>this.tasksPlugin.createObject({key:"t_"+t.getId(),payload:JSON.parse(JSON.stringify(t))});
    //             return this.tasksPlugin.sendTaskCommentMessage(t, text, metaDataStr)
    //             .then(result => {
    //                 t.addCommentTag(result.message.mainReceiver.sink.id + "/" + result.message.id);
    //                 t.setModifiedDateTime(new Date().getTime());
    //                 t.setModifiedBy(this.tasksPlugin.getMyId());
    //                 return <any>this.tasksPlugin.saveTask(t, version, origTask);
    //             })
    //             .fail(e => Logger.error("Error during saving task comment", e))
    //             .thenResolve(true);
    //         }
    //     });
    // }

    // addCommentMy(text: string): Q.Promise<boolean> {
    //     if (this.taskId == false || text.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
    //         return Q().thenResolve(false);
    //     }
    //     else {
    //         let t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
    //         let version = this.tasksPlugin.getTaskVersion(this.session, t.getId());
    //         let origTask = <Task>this.tasksPlugin.createObject(this.session, {key:"t_"+t.getId(),payload:JSON.parse(JSON.stringify(t))});

    //         return Q().then(result => {
    //             // t.addCommentTag(result.message.mainReceiver.sink.id + "/" + result.message.id);
    //             let currTime = Date.now();
    //             t.setModifiedDateTime(currTime);
    //             t.setModifiedBy(this.tasksPlugin.getMyId(this.session));
    //             let comments = t.getComments();
    //             comments.push({
    //                 dateTime: currTime,
    //                 message: text,
    //                 userHashmail: this.session.sectionManager.identity.hashmail,
    //                 body: this.prepareCommentBody(t, text)
    //             });
    //             t.setComments(comments);
    //             return <any>this.tasksPlugin.saveTask(this.session, t, version, origTask);
    //         })
    //         .fail(e => Logger.error("Error during saving task comment", e))
    //         .thenResolve(true);
    //     }
    // }

    addComment(text: string): Q.Promise<boolean> {
        let metaDataStr: string = null;
        return Q().then(() => {
            return this.app.prepareHtmlMessageBeforeSending(text, this.session).then(newText => {
                let { metaData, html } = utils.ContentEditableEditorMetaData.extractMetaFromHtml(newText);
                text = html;
                metaDataStr = JSON.stringify(metaData);
            });
        })
        .then(() => {
            if (this.taskId == false || text.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length == 0) {
                return Q().thenResolve(false);
            }
            else {
                let t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
                let version = this.tasksPlugin.getTaskVersion(this.session, t.getId());
                let origTask = <Task>this.tasksPlugin.createObject(this.session, {key:"t_"+t.getId(),payload:JSON.parse(JSON.stringify(t))});
    
                return Q().then(() => {
                    return this.addCommentPreVersion18BackCompat(text);
                })
                .then(commentTag => {
                    // t.addCommentTag(result.message.mainReceiver.sink.id + "/" + result.message.id);
                    let currTime = Date.now();
                    t.setModifiedDateTime(currTime);
                    t.setModifiedBy(this.tasksPlugin.getMyId(this.session));
                    let comments = t.getComments();
                    comments.push({
                        dateTime: currTime,
                        message: text,
                        userHashmail: this.session.sectionManager.identity.hashmail,
                        body: this.prepareCommentBody(t, text, metaDataStr),
                        relatedCommentTag: commentTag,
                    });
                    t.setComments(comments);
                    return <any>this.tasksPlugin.saveTask(this.session, t, version, origTask);
                })
                .fail(e => Logger.error("Error during saving task comment", e))
                .thenResolve(true);
            }
    
        });
    }


    prepareCommentBody(t: Task, comment: string, metaDataStr?: string): CommentBody {
        return {
            type: "task-comment",
            who: this.tasksPlugin.getMyId(this.session),
            id: t.getId(),
            label: "#" + t.getId().substr(0,5),
            comment: comment,
            status: t.getStatus(),
            statusLocaleName: this.app.localeService.i18n("plugin.tasks.status-" + t.getStatus()),
            numOfStatuses: Task.getStatuses().length,
            statusColor: Task.getLabelClass(t.getStatus()),
            metaDataStr: metaDataStr
        }
    }
    
    onViewAddComment(text: string): void {
        if (!text || text.trim().length == 0) {
            return;
        }
        this.encryptionEffectCommentText.show(text, this.getEncryptedCommentText.bind(this)).then(() => {
            return this.addComment(text);
        }).then(added => {
            if (added) {
                this.notify("addedComment");
            }
        });
    }
    
    onViewAddAttachment(): void {
        if (this.taskId == false) {
            return;
        }
        else {
            let t = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
            Q().then(() => {
                return <any>this.uploadAttachment(t)
            })
            .fail(e => Logger.error(e))
        }
    }
    
    onViewAddCalendar(mode: "timeframe" | "wholeDay"): void {
        let now = new Date();
        let day = now.getDate();
        let month = now.getMonth();
        let year = now.getFullYear();
        let time = (now.getHours() * 3600 + now.getMinutes() * 60) * 1000;
        let rounding = 15 * 60 * 1000;
        time = Math.round(time / rounding) * rounding;
        this.defaultDateTime = new Date(year, month, day, 0, 0, 0, time);
        let prevDuration = (this.result.endTimestamp && this.result.startTimestamp) ? (this.result.endTimestamp - this.result.startTimestamp) : null;
        this.result.startTimestamp = this.defaultDateTime.getTime();
        this.result.endTimestamp = this.result.startTimestamp + (prevDuration ? prevDuration : 3600000);
        this.result.wholeDays = mode == "wholeDay";
        this.callViewMethod("setEndDateTime", this.result.endTimestamp);
        this.callViewMethod("setStartDateTime", this.defaultDateTime.getTime());
        this.callViewMethod("setWholeDays", this.result.wholeDays);
    }
    
    onViewDelAttachment(did: string): void {
        this.attachmentsManager.remove(did);
        this.callViewMethod("removeAttachment", did);
    }
    
    addUploadedAttachment(sectionFile: mail.section.OpenableSectionFile): Q.Promise<void> {
        this.attachmentsManager.addOpenableSectionFile(sectionFile, false);
        this.callViewMethod("setAttachments", this.attachmentsManager.getAttachmentInfoStrings());
        return Q.resolve<void>();
    }
    
    uploadAttachment(task: Task): void {
        let projId: ProjectId = this.customSelectProject.value;
        let taskId: TaskId = this.newTask || !this.taskId ? null : this.taskId;
        let section = this.session.sectionManager.getSection(projId);
        let contents: privfs.lazyBuffer.IContent[];
        let notificationId: number;
        if (!section.getModule("file")) {
            return;
        }
        
        let notes2Module = section.getFileModule();
        let notes2Plugin = this.app.getComponent("notes2-plugin");
        if (!notes2Module || !notes2Plugin) {
            return null;
        }
        Q().then(() => {
            (<any>notes2Plugin).openFileChooser(this.parent, this.session, section, "tasks-" + this.session.hostHash + "-" + taskId).then((result: app.common.shelltypes.OpenableElement[]) => {
                if (result.length == 0) {
                    return;
                }
                contents = result.map(element => element.content);
                notificationId = this.notifications.showNotification(this.i18n("plugin.tasks.component.taskPanel.notifications.addingAttachment"), {autoHide: false, progress: true});
                
                let prom = taskId ? Q(taskId) : this.tasksPlugin.nextTaskId(this.session);
                return prom
                .then((tId: string) => {
                    if (! taskId) {
                        taskId = tId;
                        this.obtainedTaskId = taskId;
                        this.callViewMethod("setObtainedTaskId", this.obtainedTaskId);
                    }
                    let prom = Q();
                    for (let contentId in contents) {
                        let content = contents[contentId];
                        let res = result[contentId];
                        if (res instanceof mail.section.OpenableSectionFile) {
                            if (res.section && res.section.getId() == section.getId()) {
                                prom = prom.then(() => {
                                    return this.addUploadedAttachment(<mail.section.OpenableSectionFile>res);
                                });
                                continue;
                            }
                        }
                        prom = prom.then(() => {
                            section.uploadFile({
                                data: content,
                                fileOptions: {
                                    metaUpdater: meta => this.tasksPlugin._metaUpdaterAdder(meta, taskId)
                                }
                            })
                            .then(fileResult => {
                                return this.session.sectionManager.getFileOpenableElement(fileResult.fileResult.entryId, false, true)
                                .then(sectionFile => {
                                    return this.addUploadedAttachment(sectionFile);
                                }).then(() => {
                                    return fileResult;
                                });
                            });
                        });
                    }
                })
                .progress(progress => {
                    this.notifications.progressNotification(notificationId, progress);
                })
                .fin(() => {
                    this.notifications.hideNotification(notificationId);
                });

            })
        })
        .fail(this.errorCallback);
    }
    
    getEnterSavesTask(): boolean {
        return this.tasksPlugin.getSetting(this.session, "enter-saves-task", null, null) == 1;
    }
    
    getEnterAddsComment(): boolean {
        return true;
        // return this.tasksPlugin.getSetting("enter-adds-comment", null, null) == 1;
    }
    
    setEnterSavesTask(value: boolean): void {
        if (value != this.internalModel.enterSavesTask) {
            this.internalModel.enterSavesTask = value;
            this.callViewMethod("setEnterSavesTask", value);
        }
        if (value != this.getEnterSavesTask()) {
            this.tasksPlugin.saveSetting(this.session, "enter-saves-task", value ? 1 : 0, null, null);
            this.app.dispatchEvent<TasksSettingChanged>({
                type: "tasks-setting-changed",
                setting: "enter-saves-task",
                value: value,
                sourceProjectId: null,
                sourceContext: null,
                sourceUniqueId: null,
            });
        }
    }
    
    setEnterAddsComment(value: boolean): void {
        if (value != this.internalModel.enterAddsComment) {
            this.internalModel.enterAddsComment = value;
            this.callViewMethod("setEnterAddsComment", value);
        }
        if (value != this.getEnterAddsComment()) {
            this.tasksPlugin.saveSetting(this.session, "enter-adds-comment", value ? 1 : 0, null, null);
            this.app.dispatchEvent<TasksSettingChanged>({
                type: "tasks-setting-changed",
                setting: "enter-adds-comment",
                value: value,
                sourceProjectId: null,
                sourceContext: null,
                sourceUniqueId: null,
            });
        }
    }
    
    setHorizontalLayout(value: boolean) {
        if (this.newTask) {
            value = false;
        }
        this.internalModel.horizontalLayout = value;
        this.internalModel.isEditTaskWindow = !this.internalModel.newTask && this.getIsHorizontalLayout();
        this.callViewMethod("setIsEditTaskWindow", this.internalModel.isEditTaskWindow);
        this.callViewMethod("setHorizontalLayout", value);
    }
    
    onViewSetEnterSavesTask(value: boolean): void {
        this.setEnterSavesTask(value);
    }
    
    onViewSetEnterAddsComment(value: boolean): void {
        this.setEnterAddsComment(value);
    }
    
    newTaskGroup(): void {
        let projectId = this.result.projectId;
        let project = this.tasksPlugin.projects[this.session.hostHash][projectId];
        if (!project) {
            return;
        }
        let projectName = project.getName();
        
        if (!this.tasksPlugin.bringWindowToFront(TaskGroupFormWindowController.getWindowId(this.session, null))) {
            this.app.ioc.create(<any>TaskGroupFormWindowController, [this.parent, this.session, projectId, projectName, true]).then((win: TaskGroupFormWindowController) => {
                win.parent = this.parent.getClosestNotDockedController();
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
                                this.notify("taskGroupCreated");
                                let selection = this.result.taskGroupIds.slice(0);
                                if (selection.indexOf(id) < 0) {
                                    selection.push(id);
                                }
                                this.updateCustomSelectTaskGroupItems(projectId, selection);
                                this.result.taskGroupIds = selection;
                                this.customSelectTaskGroup.grabFocus(true);
                            });
                        });
                    },
                    () => {
                        this.customSelectTaskGroup.grabFocus();
                    }
                );
            });
        }
    }
    
    onViewDirtyChanged(dirty: boolean, differentPropNamesStr: string): void {
        this.modifiedPropertyNames = dirty ? (JSON.parse(differentPropNamesStr) || []) : [];
        this.dirty = dirty;
        this.requestParentUpdateDirty(dirty);
        if (this.onDirtyChanged) {
            this.onDirtyChanged();
        }
    }
    
    onViewDirtyPropsChanged(dirty: boolean, differentPropNamesStr: string): void {
        this.modifiedPropertyNames = dirty ? (JSON.parse(differentPropNamesStr) || []) : [];
    }
    
    ensureHasDateTime(dt: Date): void {
        this.defaultDateTime = dt;
        this.updateView(false, true);
    }
    
    onDatePickerPopupClosed(commit: boolean): void {
        if (!commit) {
            return;
        }
        let day = this.dateTimePicker.currDataModel.selectedDay;
        let month = this.dateTimePicker.currDataModel.selectedMonth;
        let year = this.dateTimePicker.currDataModel.selectedYear;
        let time = this.dateTimePicker.currDataModel.selectedTime;
        this.defaultDateTime = new Date(year, month, day, 0, 0, 0, time);
        let prevDuration = (this.result.endTimestamp && this.result.startTimestamp) ? (this.result.endTimestamp - this.result.startTimestamp) : null;
        this.result.startTimestamp = this.defaultDateTime.getTime();
        this.result.endTimestamp = this.result.startTimestamp + (prevDuration ? prevDuration : 3600000);
        this.callViewMethod("setEndDateTime", this.result.endTimestamp);
        this.callViewMethod("setStartDateTime", this.defaultDateTime.getTime());
    }
    
    onDatePicker2PopupClosed(commit: boolean): void {
        if (!commit) {
            return;
        }
        let day = this.dateTimePicker2.currDataModel.selectedDay;
        let month = this.dateTimePicker2.currDataModel.selectedMonth;
        let year = this.dateTimePicker2.currDataModel.selectedYear;
        let time = this.dateTimePicker2.currDataModel.selectedTime;
        let ts = new Date(year, month, day, 0, 0, 0, time).getTime()
        this.result.endTimestamp = Math.max(ts, this.result.startTimestamp + 900000);
        this.callViewMethod("setEndDateTime", this.result.endTimestamp);
    }
    
    onViewRemoveFromCalendar(): void {
        let task: Task = null;
        if (this.taskId && this.session && this.tasksPlugin.tasks[this.session.hostHash] && this.tasksPlugin.tasks[this.session.hostHash][this.taskId]) {
            task = this.tasksPlugin.tasks[this.session.hostHash][this.taskId];
        }
        let now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth();
        let day = now.getDate();
        let time = (now.getHours() * 3600 + now.getMinutes() * 60) * 1000;
        let rounding = 15 * 60 * 1000;
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
    }
    
    onViewToggleWholeDays(wholeDays: boolean): void {
        this.result.wholeDays = wholeDays;
    }
    
    getTaskStatusesFromInternalModel(): { [taskId: string]: string } {
        let statuses: { [taskId: string]: string } = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, statuses, this.internalModel.taskDescription);
        for (let comment of this.internalModel.taskComments) {
            this.tasksPlugin.addTaskStatusesFromMessage(this.session, statuses, comment.message);
        }
        return statuses;
    }
    
    onViewOpenTask(taskId: string): void {
        this.tasksPlugin.openEditTaskWindow(this.session, taskId, true, true);
    }
    
    getEncryptedTaskText(text: string): Q.Promise<string> {
        return Q().then(() => {
            let kvdbC = this.tasksPlugin.kvdbCs[this.session.hostHash][this.result.projectId];
            if (!kvdbC || !kvdbC.kvdb) {
                return text;
            }
            return kvdbC.kvdb.encryptBuffer(new Buffer(text, "utf8")).then(cipher => {
                return cipher.toString("base64");
            });
        });
    }
    
    getEncryptedCommentText(text: string): Q.Promise<string> {
        return Q().then(() => {
            let section = this.session.sectionManager.getSection(this.result.projectId);
            if (!section) {
                return text;
            }
            let receiver = section.getChatModule().createReceiver();
            let extraBuffer = new Buffer(text, "utf8");
            return privfs.crypto.service.eciesEncrypt(this.tasksPlugin.identity.priv, receiver.sink.pub, extraBuffer).then(encrypted => {
                return encrypted.toString("base64");
            });
        });
    }
    
    getProjectPrefix(project: Project): string {
        if (!project) {
            return null;
        }
        let section: mail.section.SectionService = null;
        for (let entry of this.tasksPlugin.tasksSectionsCollection[this.session.hostHash].list) {
            if (entry.key.sectionId == project.getId()) {
                section = entry;
                break;
            }
        }
        if (!section) {
            return null;
        }
        return section.getFullSectionName(true, true);
    }
    
    watchTreeCollection(): void {
        let opId = ++this.lastTreeWatcherOpId;
        let section = this.internalModel.taskId ? this.session.sectionManager.getSection(this.internalModel.projectId) : null;
        if (section) {
            if (!(section.getId() in this.sectionFileTreeDeferreds)) {
                this.sectionFileTreeDeferreds[section.getId()] = Q.defer();
                Q().then(() => {
                    return section.getFileTree();
                }).then(tree => {
                    this.sectionFileTreeDeferreds[section.getId()].resolve(tree);
                });
            }
            this.sectionFileTreeDeferreds[section.getId()].promise.then(tree => {
                if (opId == this.lastTreeWatcherOpId) {
                    this.currFileTree = tree;
                    this.currFileTree.collection.changeEvent.add(this.onFileTreeCollectionChangedBound);
                }
            });
        }
    }
    
    clearTreeCollectionWatcher(): void {
        this.lastTreeWatcherOpId++;
        if (this.currFileTree) {
            this.currFileTree.collection.changeEvent.remove(this.onFileTreeCollectionChangedBound);
            this.currFileTree = null;
        }
    }
    
    onFileTreeCollectionChanged(): void {
        let attIsTrashed: { [did: string]: boolean } = {};
        for (let idx in this.internalModel.taskAttachments) {
            let attStr = this.internalModel.taskAttachments[idx];
            let att = JSON.parse(attStr);
            let entry = this.currFileTree.collection.find(x => x.ref.did == att.did);
            if (this.internalModel.taskAttachments[idx]) {
                let att = JSON.parse(this.internalModel.taskAttachments[idx]);
                if (entry && entry.path && mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                    continue;
                }
                if (att.trashed != (!entry || entry.path.indexOf("/.trash/") >= 0)) {
                    att.trashed = !att.trashed;
                    attIsTrashed[att.did] = att.trashed;
                }
                this.internalModel.taskAttachments[idx] = JSON.stringify(att);
            }
        }
        for (let idx in this.internalModel.resolvedTaskHistory) {
            let data: any = this.internalModel.resolvedTaskHistory[idx];
            if (data.arg != "attachment" || (!data.newAttachment && !data.oldAttachment)) {
                continue;
            }
            let key = data.newAttachment ? "newAttachment" : "oldAttachment";
            let att = JSON.parse(data[key]);
            let entry = this.currFileTree.collection.find(x => x.ref.did == att.did);
            if (entry && entry.path && mail.thumbs.ThumbsManager.isThumb(entry.path)) {
                continue;
            }
            if (data.isAttachmentTrashed != (!entry || entry.path.indexOf("/.trash/") >= 0)) {
                data.isAttachmentTrashed = !data.isAttachmentTrashed;
                attIsTrashed[att.did] = data.isAttachmentTrashed;
            }
        }
        
        if (Object.keys(attIsTrashed).length > 0) {
            this.callViewMethod("updateAttIsTrashed", JSON.stringify(attIsTrashed));
        }
    }
    
    onViewPaste(originalText: string = null): void {
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
            return this.tryPaste(element, originalText);
        });
    }
    
    tryPaste(element: app.common.clipboard.ClipboardElement, originalText: string): Q.Promise<void> {
        if (element === null && originalText !== null) {
            this.callViewMethod("pastePlainText", originalText);
        }
        if (!element) {
            return Q();
        }
        else if (element.source == "system" || element.source == "privmx") {
            if (!this.editable) {
                this.onViewEditClick("");
            }
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
            return Q().then(() => {
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
            });
        }
    }
    
    upload(content: privfs.lazyBuffer.IContent): Q.Promise<mail.section.OpenableSectionFile> {
        return this.getActiveSection().uploadFile({
            data: content,
        })
        .then(result => {
            let osf = <mail.section.OpenableSectionFile>result.openableElement;
            return this.addUploadedAttachment(osf).thenResolve(osf);
        });
    }
    
    getActiveSection(): mail.section.SectionService {
        return this.session.sectionManager.getSection(this.internalModel.projectId);
    }
    
    onUserPreferencesChange(event: Types.event.UserPreferencesChangeEvent): void {
        let autoMarkAsRead = this.app.userPreferences.getAutoMarkAsRead();
        if (this.internalModel) {
            this.internalModel.autoMarkAsRead = autoMarkAsRead;
        }
        this.callViewMethod("setAutoMarkAsRead", autoMarkAsRead);
    }
    
    onViewToggleMarkedAsRead(): void {
        this.tasksPlugin.toggleRead(this.session, this.taskId || "");
    }
    
    onTaskCreated(handler: (taskId: string) => void): void {
        this.onTaskCreatedHandlers.push(handler);
    }
    
    onCancelled(handler: () => void): void {
        this.onCancelledHandlers.push(handler);
    }
    
    triggerTaskCreated(taskId: string): void {
        for (let handler of this.onTaskCreatedHandlers) {
            handler(taskId);
        }
    }
    
    triggerCancelled(): void {
        for (let handler of this.onCancelledHandlers) {
            handler();
        }
    }
    
}
