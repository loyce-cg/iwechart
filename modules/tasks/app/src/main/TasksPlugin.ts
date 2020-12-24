import { component, app, mail, window, Q, privfs, Types, Logger as RootLogger } from "pmc-mail";
import * as Mail from "pmc-mail";
import { ProjectsMap, TaskGroupsMap, TasksMap, ProjectId, TaskGroupId, TaskId, TaskGroupNamesMap, PersonId, PeopleMap, PeopleNamesMap, Watchable, Action, EventHandler, Person, WatchedTasksMap, WatchedTaskItem, StoredObjectTypes, ViewContext, CustomTasksElements, HostHash } from "./Types";
import { Project } from "./data/Project";
import { TaskGroup } from "./data/TaskGroup";
import { Task, TaskStatus } from "./data/Task";
import { SettingsStorage } from "./SettingsStorage";
import { TaskWindowController } from "../window/task/TaskWindowController";
import MsgBoxResult = window.msgbox.MsgBoxResult;
import MsgBoxOptions = window.msgbox.MsgBoxOptions;
import { CustomSelectController, CustomSelectItem, CustomSelectOptions } from "../component/customSelect/CustomSelectController";
import { TaskPanelController, ActionHandlers } from "../component/taskPanel/TaskPanelController";
import { TaskGroupsPanelController, TasksFilterData, TasksFilterUpdater } from "../component/taskGroupsPanel/TaskGroupsPanelController";
import { ViewSettings } from "./ViewSettings";
import { TaskGroupFormWindowController } from "../window/taskGroupForm/TaskGroupFormWindowController";
import { SimpleTaskService } from "./SimpleTaskService";
import { DataMigration } from "./DataMigration";
import { UniqueId } from "./UniqueId";
import { TasksWindowController } from "../window/tasks/TasksWindowController";
import { TaskGroupConflictResolver } from "./data/TaskGroupConflictResolver";
import { ConflictResolver, ConflictResolutionStatus } from "./data/ConflictResolver";
import { ProjectConflictResolver } from "./data/ProjectConflictResolver";
import { TaskConflictResolver } from "./data/TaskConflictResolver";
import { IconPickerController } from "../component/iconPicker/IconPickerController";
import { i18n } from "../i18n/index";
import { AttachmentsManager } from "./AttachmentsManager";
let Logger = RootLogger.get("privfs-tasks-plugin.TasksPlugin");

interface EventWatcher {
    [key: string]: Array<EventHandler>;
}

export interface TaskPreviewRequestEvent extends Mail.Types.event.Event {
    type: "task-preview-request";
    taskId: TaskId | false;
    hostHash: HostHash;
}

export interface TaskPanelUpdateRequestEvent extends Mail.Types.event.Event {
    type: "taskpanel-update-request";
}

export interface BadgesUpdateRequestEvent extends Mail.Types.event.Event {
    type: "badges-update-request";
}

export interface TaskPanelChangeVisibilityRequestEvent extends Mail.Types.event.Event {
    type: "taskpanel-change-visibility-request";
    show: boolean;
}
export interface HorizontalTaskWindowLayoutChangeRequestEvent extends Mail.Types.event.Event {
    type: "horizontal-task-window-layout-change-request";
    horizontalLayout: boolean;
}
export interface TasksSettingChanged extends Mail.Types.event.Event {
    type: "tasks-setting-changed";
    setting: string;
    value: boolean | string | number;
    sourceProjectId: string;
    sourceContext: string;
    sourceUniqueId: string;
}
export interface TasksSearchUpdateEvent extends Mail.Types.event.Event {
    type: "tasks-search-update";
    searchString: string;
    searchTotalCount: number;
}

export interface MarkedTasksAsReadEvent extends Mail.Types.event.Event {
    type: "marked-tasks-as-read";
    projectId: string;
    hostHash: string;
}

export interface UpdateSectionBadgeEvent {
    type: "update-section-badge";
    sectionId: string;
    hostHash: HostHash;
}

export interface UpdatePinnedTaskGroupsEvent {
    type: "update-pinned-taskgroups";
    sectionId: string;
    listId: string;
    pinned: boolean;
    hostHash: HostHash;
}
export interface TasksColWidthsChangedEvent {
    type: "tasks-col-widths-changed";
    key: string;
    sender: string;
}
export interface TaskBadgeChangedEvent {
    type: "task-badge-changed";
    taskId: string;
    taskLabelClass: string;
    hostHash: string;
}

export interface UpdateTasksSidebarSpinnersEvent extends Mail.Types.event.Event {
    type: "update-tasks-sidebar-spinners";
    customElementId?: string;
    conv2SectionId?: string;
    sectionId?: string;
    hostHash?: string;
}

export interface FileAttachedToTaskEvent {
    type: "file-attached-to-task";
    did: string;
    taskId: string;
    hostHash: string;
}

export interface FileDetachedFromTaskEvent {
    type: "file-detached-from-task";
    did: string;
    taskId: string;
    hostHash: string;
}

export type TasksComponentFactory = Mail.component.ComponentFactory & {
    createComponent(componentName: "taskscustomselect", args: [Mail.Types.app.IpcContainer, CustomSelectItem[], CustomSelectOptions]): CustomSelectController;
    createComponent(componentName: "iconpicker", args: [Mail.Types.app.IpcContainer]): IconPickerController;
    createComponent(componentName: "taskGroupsPanel", args: [Mail.window.base.BaseWindowController]): TaskGroupsPanelController;
    createComponent<T extends Mail.window.base.BaseWindowController = Mail.window.base.BaseWindowController>(componentName: "taskpanel", args: [T, mail.session.Session, component.persons.PersonsController, ActionHandlers, boolean, boolean, mail.section.OpenableSectionFile[]]): TaskPanelController<T>;
}

export interface TaskKvdbEntry extends privfs.types.db.KvdbEntry {
    secured: {
        key: string;
        payload: Task | Project | TaskGroup;
    }
}

export class TasksPlugin {
    
    static REJECT_REASON_DOES_NOT_EXIST: string = "does not exist";
    static WATCHED_TASKS_HISTORY: string = "plugin.tasks.watchedTasksHistory";
    static VIEW_SETTINGS: string = "plugin.tasks.viewSettings";
    static ERR_INVALID_VERSION: number = 0x0063;
    
    initPromise: Q.Promise<void>;
    
    projects: { [hostHash: string]: ProjectsMap } = {};
    taskGroups: { [hostHash: string]: TaskGroupsMap } = {};
    tasks: { [hostHash: string]: TasksMap } = {};
    origProjects: { [hostHash: string]: ProjectsMap } = {};
    origTaskGroups: { [hostHash: string]: TaskGroupsMap } = {};
    origTasks: { [hostHash: string]: TasksMap } = {};
    watched: { [hostHash: string]: EventWatcher } = {};
    taskTitleCache: { [hostHash: string]: { [taskId: string]: string } } = {};
    
    watchedTasksHistory: { [hostHash: string]: { [sectionId: string]: WatchedTasksMap } } = {};
    settingsStorage: SettingsStorage;
    viewSettings: ViewSettings;
    onWatchedTasksHistoryRebuildHandlers: Array<(hostHash: HostHash, pId: ProjectId) => void> = [];
    onWatchedTasksHistorySetHandlers: Array<(hostHash: HostHash, pId: ProjectId, tId: TaskId, it: WatchedTaskItem) => void> = [];
    
    
    sectionManager: Mail.mail.section.SectionManager;
    sidebarSectionsCollection: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService>;
    
    tasksSectionsCollection: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    tasksSectionsCollectionNoPrivate: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    tasksRootSections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    
    kvdbProjectId: string = null;
    kvdbProjectDeferred: Q.Deferred<void> = Q.defer();
    kvdbAnyProjectDeferred: Q.Deferred<string> = Q.defer();
    ensureKvdbCExistsDeferreds: { [hostHash: string]: { [id: string]: Q.Deferred<void> } } = {};
    
    tasksUnreadCountModel = new Mail.utils.Model(0);
    tasksUnreadCountFullyLoadedModel = new Mail.utils.Model(false);
    unreadTasks: number;
    
    recentlyUsedTaskProperties: { type: number, status: number, priority: number } = null;
    utilApi: Mail.mail.UtilApi;
    identity: privfs.identity.Identity;
    personService: Mail.mail.person.PersonService;
    conv2Service: Mail.mail.section.Conv2Service;
    userPreferences: Mail.mail.UserPreferences.UserPreferences;
    localStorage: Mail.Types.utils.IStorage;
    client: privfs.core.Client;
    sinkIndexManager: Mail.mail.SinkIndexManager;
    
    taskGroupsBacklog: { [hostHash: string]: { [id: string]: Array<TaskId> } } = {};
    projectsBacklog: { [hostHash: string]: { [id: string]: Array<TaskId> } } = {};
    preventFireDelete: { [hostHash: string]: Array<string> } = {};
    
    debug: boolean = false;
    
    projectsReady: Q.Promise<void>;
    fireLocks: number = 0;
    tasksFilterUpdater: TasksFilterUpdater;
    lockedAttachmentModificationMessages: { [hostHash: string]: TaskId[] } = {};
    
    taskPriorities: string[] = ["Critical", "High", "[Normal]", "Low"];
    taskStatuses: string[] = ["Idea", "[Todo]", "In progress", "Done"];
    taskTypes: string[] = ["Bug", "Feature", "[Other]"];
    
    openedWindows: { [key: string]: TaskWindowController | TaskGroupFormWindowController } = {};
    privateSection: mail.section.SectionService;
    activeWindowFocused: string;
    activeTaskGroupsPanel: TaskGroupsPanelController;
    activeSinkId: string;
    activeSinkHostHash: string;
    onReset: Q.Deferred<void> = Q.defer();
    activeTasksWindowController: TasksWindowController = null;
    
    tasksPrimarySections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService>} = {};
    sectionsWithSpinner: { [hostHash: string]: { [id: string]: boolean } } = {};
    preventRefreshWatched: boolean = false;
    savingLocks: { [hostHash: string]: { [key: string]: Q.Deferred<number> } } = {};
    
    session: mail.session.Session;
    
    constructor(public app: app.common.CommonApplication) {
        if (process && process.argv && process.argv.indexOf("--debug-tasks") >= 0) {
            this.debug = true;
        }
    }

    registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, "plugin.tasks.");
    }

    isChatPluginPresent(): boolean {
        return this.app.getComponent("chat-plugin") != null;
    }

    isNotes2PluginPresent(): boolean {
        return this.app.getComponent("notes2-plugin") != null;
    }

    checkInit(): Q.Promise<void> {
        if (this.initPromise == null) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    }

    ensureSessionInit(session: mail.session.Session): void {
        // console.log("on ensureSessionInit", session.hostHash);

        if (!this.kvdbCs) {
            this.kvdbCs = {};
        }
        if (!this.kvdbCs[session.hostHash]) {
            this.kvdbCs[session.hostHash] = {};
        }

        if (!this.projects) {
            this.projects = {};
        }
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }

        if (!this.taskGroups) {
            this.taskGroups = {};
        }
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }

        if (!this.tasks) {
            this.tasks = {};
        }
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }

        if (!this.origProjects) {
            this.origProjects = {};
        }
        if (!this.origProjects[session.hostHash]) {
            this.origProjects[session.hostHash] = {};
        }

        if (!this.origTaskGroups) {
            this.origTaskGroups = {};
        }
        if (!this.origTaskGroups[session.hostHash]) {
            this.origTaskGroups[session.hostHash] = {};
        }

        if (!this.origTasks) {
            this.origTasks = {};
        }
        if (!this.origTasks[session.hostHash]) {
            this.origTasks[session.hostHash] = {};
        }

        if (!this.watched) {
            this.watched = {};
        }
        if (!this.watched[session.hostHash]) {
            this.watched[session.hostHash] = {};
        }

        if (!this.taskTitleCache) {
            this.taskTitleCache = {};
        }
        if (!this.taskTitleCache[session.hostHash]) {
            this.taskTitleCache[session.hostHash] = {};
        }

        if (!this.watchedTasksHistory) {
            this.watchedTasksHistory = {};
        }
        if (!this.watchedTasksHistory[session.hostHash]) {
            this.watchedTasksHistory[session.hostHash] = {};
        }

        if (!this.ensureKvdbCExistsDeferreds) {
            this.ensureKvdbCExistsDeferreds = {};
        }
        if (!this.ensureKvdbCExistsDeferreds[session.hostHash]) {
            this.ensureKvdbCExistsDeferreds[session.hostHash] = {};
        }

        if (!this.taskGroupsBacklog) {
            this.taskGroupsBacklog = {};
        }
        if (!this.taskGroupsBacklog[session.hostHash]) {
            this.taskGroupsBacklog[session.hostHash] = {};
        }

        if (!this.projectsBacklog) {
            this.projectsBacklog = {};
        }
        if (!this.projectsBacklog[session.hostHash]) {
            this.projectsBacklog[session.hostHash] = {};
        }

        if (!this.sectionsWithSpinner) {
            this.sectionsWithSpinner = {};
        }
        if (!this.sectionsWithSpinner[session.hostHash]) {
            this.sectionsWithSpinner[session.hostHash] = {};
        }
        
        if (!this.savingLocks[session.hostHash]) {
            this.savingLocks[session.hostHash] = {};
        }
        
        if (!this.preventFireDelete) {
            this.preventFireDelete = {};
        }
        if (!this.preventFireDelete[session.hostHash]) {
            this.preventFireDelete[session.hostHash] = [];
        }
        
        if (!this.userNames) {
            this.userNames = {};
        }
        if (!this.userNames[session.hostHash]) {
            this.userNames[session.hostHash] = [];
        }
    }

    init(): Q.Promise<void> {
        if (this.app.mailClientApi == null) {
            return Q();
        }
        this.app.dispatchEvent({
            type: "tasks-plugin-loaded",
        });
        this.unreadTasks = 0;

        // return Q().then(() => {
        //     return (<any>this.app.sessionManager).initAfterLogin();
        // })
        return Q().then(() => {
            this.session = this.app.sessionManager.getLocalSession();
            this.ensureSessionInit(this.session);
            return <any>this.app.mailClientApi.privmxRegistry.getUserSettingsKvdb();
        })
        .then(kvdb => {
            this.settingsStorage = new SettingsStorage(this.app.sessionManager.getLocalSession(), TasksPlugin.WATCHED_TASKS_HISTORY, kvdb, this);
            this.viewSettings = new ViewSettings(TasksPlugin.VIEW_SETTINGS, kvdb);
            return;
        })
        .then(() => {
            return <any>Q.all(<any>[
                this.app.mailClientApi.prepareAndGetSectionManager(),
                this.app.mailClientApi.privmxRegistry.getUtilApi(),
                this.app.mailClientApi.privmxRegistry.getIdentity(),
                this.app.mailClientApi.privmxRegistry.getPersonService(),
                this.app.mailClientApi.privmxRegistry.getConv2Service(),
                this.app.mailClientApi.privmxRegistry.getUserPreferences(),
                this.app.mailClientApi.privmxRegistry.getLocalStorage(),
                this.app.mailClientApi.privmxRegistry.getClient(),
                this.app.mailClientApi.privmxRegistry.getSinkIndexManager(),
            ]);
        })
        .then(res => {
            this.sectionManager = res[0];
            this.utilApi = res[1];
            this.identity = res[2];
            this.personService = res[3];
            this.conv2Service = res[4];
            this.userPreferences = res[5];
            this.localStorage = res[6];
            this.client = res[7];
            this.sinkIndexManager = res[8];
            this.userPreferences.eventDispatcher.addEventListener<Mail.Types.event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this));
            this.app.registerPmxEvent(this.client.storageProviderManager.event, (event: any) => this.onStorageEvent(localSession, event));
            this.sidebarSectionsCollection = new Mail.utils.collection.FilteredCollection(this.sectionManager.filteredCollection, x => {
                return !x.isUserGroup() && x != this.sectionManager.getMyPrivateSection() && x.isVisible() && x.hasAccess();
            });
            
            this.ensureInitSessionCollections(this.session);
            
            let projectsPromise: Q.Promise<void> = Q(null);
            this.fireLocks++;
            projectsPromise = projectsPromise.then(() => {
                // console.time("Tasks kvdb");
                return this.ensureSessionProjectsInitialized(this.session);
            }).then(() => {
                // console.timeEnd("Tasks kvdb");
                this.fireLocks--;
                this.fireAllAdded(this.session);
            }).then(() => {
                this.tasksUnreadCountFullyLoadedModel.setWithCheck(true);
            }).fail(e => {
                Logger.error("error ensuring projects", e);
            });
            this.projectsReady = projectsPromise;

            // setTimeout(() => {
            //     projectsPromise.then(() => {
            //         let fixtures = new FixturesGenerator(this);
            //         Q().then(() => {
            //             return fixtures.createPerformanceTestsTasks("446f71050041cf3eded99194dc85ea", 1000);
            //         })
            //         .then(() => {
            //             return fixtures.createPerformanceTestsTasks("7bb8a07eab9a006b3f0d9382dfc0ee", 1000);
            //         });
            //     });
            // }, 5000);

            this.setupSearch();
            
            let localSession = this.app.sessionManager.getLocalSession();
            return projectsPromise.then(() => {
                return <any>Q.all(<any>[
                    this.loadSettings(localSession, "__global__"),
                    this.loadSettings(localSession, CustomTasksElements.ALL_TASKS_ID),
                    this.loadSettings(localSession, CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID),
                    this.loadSettings(localSession, CustomTasksElements.TASKS_CREATED_BY_ME_ID),
                    this.loadSettings(localSession, CustomTasksElements.TRASH_ID),
                    this.loadSettings(localSession, "private-tasks"),
                    this.fetchAllProjects(),
                    this.fetchAllTaskGroups(),
                    this.fetchAllTasks(),
                    this.fetchAllUsers(localSession),
                ]);
            });
        })
        .then(() => {
            // console.log("lala");
            this.app.addEventListener<Types.event.MarkAsReadEvent>("mark-as-read", event => {
                let sessions: mail.session.Session[] = event.hostHash ? [this.app.sessionManager.getSessionByHostHash(event.hostHash)] : this.getReadySessions();
                //event.hostHash = session.hostHash;
                // this.log(event.hostHash, session.host, session.hostHash, event.moduleName)
                if (event.moduleName == "tasks" || !event.moduleName) {
                    let projectId = event.sectionId || event.conversationId || event.customElementId || CustomTasksElements.ALL_TASKS_INC_TRASHED_ID;
                    // this.log(projectId)
                    Q().then(() => {
                        this.preventRefreshWatched = true;
                        this.app.dispatchEvent<Types.event.SetBubblesState>({
                            type: "set-bubbles-state",
                            markingAsRead: true,
                            scope: event,
                        });
                        let def = Q.defer();
                        setTimeout(() => def.resolve(), 300);
                        return def.promise;
                    }).then(() => {
                        return Q.all([sessions.map(session => this.markAllAsRead(session, projectId))]);
                    })
                    .fin(() => {
                        this.preventRefreshWatched = false;
                        this.refreshWatched();
                        this.app.dispatchEvent<Types.event.SetBubblesState>({
                            type: "set-bubbles-state",
                            markingAsRead: false,
                            scope: event,
                        });
                        this.app.dispatchEvent<MarkedTasksAsReadEvent>({
                            type: "marked-tasks-as-read",
                            projectId: projectId,
                            hostHash: event.hostHash,
                        });
                    });
                }
            });
            this.app.addEventListener<Types.event.SetBubblesState>("set-bubbles-state", e => {
                if (e.scope.moduleName && e.scope.moduleName != "tasks") {
                    return;
                }
                // this.log("got evt", e.markingAsRead, e.scope.conversationId, e.scope.customElementId, e.scope.sectionId)
                let newState = e.markingAsRead;
                let id = e.scope.conversationId || e.scope.customElementId || e.scope.sectionId || "__all__";
                // this.log("rslved evt",id,e.scope.hostHash)
                
                if (e.scope.hostHash) {
                    this.sectionsWithSpinner[e.scope.hostHash][id] = newState;
                }
                else {
                    for (let session of this.getReadySessions()) {
                        this.sectionsWithSpinner[session.hostHash][id] = newState;
                    }
                }
                this.app.dispatchEvent<UpdateTasksSidebarSpinnersEvent>({
                    type: "update-tasks-sidebar-spinners",
                    conv2SectionId: e.scope.conversationId || undefined,
                    customElementId: e.scope.customElementId || undefined,
                    sectionId: e.scope.sectionId || undefined,
                    hostHash: e.scope.hostHash || undefined,
                });
            });
            
            this.app.addEventListener<Types.event.HostSessionCreatedEvent>("hostSessionCreated", event => {
                // console.log("XX - On hostSessionCreated event fired..");
                let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
                this.ensureSessionInit(session);
                this.ensureInitSessionCollections(session);
            });
        })
        .fail(reason => Logger.error("error initializing tasks", reason));
    }
    
    getSessions(): mail.session.Session[] {
        let sessions: mail.session.Session[] = [];
        for (let hostHash in this.app.sessionManager.sessions) {
            let session = this.app.sessionManager.sessions[hostHash];
            sessions.push(session);
        }
        return sessions;
    }
    
    getReadySessions(): mail.session.Session[] {
        let sessions: mail.session.Session[] = [];
        for (let hostHash in this.app.sessionManager.sessions) {
            let session = this.app.sessionManager.sessions[hostHash];
            if ((!session.initPromise || session.initPromise.isFulfilled()) && (!session.loadingPromise || session.loadingPromise.isFulfilled())) {
                sessions.push(session);
            }
        }
        return sessions;
    }

    ensureInitSessionCollections(session: mail.session.Session): void {
        // console.log("XX - on ensureInitSessionCollections...");
        if (!(session.hostHash in this.tasksSectionsCollection)) {
            this.tasksSectionsCollection[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => {
                return !x.isUserGroup() && x.getKvdbModule().hasModule() && (x.isKvdbModuleEnabled() || x.isCalendarModuleEnabled());
            });
            this.tasksSectionsCollection[session.hostHash].changeEvent.add(() => {
                this.refreshWatched();
            });
        }

        // console.log("XX - check noPrivate Collection...")
        if (!(session.hostHash in this.tasksSectionsCollectionNoPrivate)) {
            // console.log("XX - initializing noPrivate for hostHash", session.hostHash);
            this.tasksSectionsCollectionNoPrivate[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => {
                return !x.isPrivateOrUserGroup() && x.getKvdbModule().hasModule() && (x.isKvdbModuleEnabled() || x.isCalendarModuleEnabled());
            });
            this.tasksSectionsCollectionNoPrivate[session.hostHash].changeEvent.add((event: Types.utils.collection.CollectionEvent<mail.section.SectionService>) => {
                if (event.type == "update" && event.element) {
                    let id = event.element.getId();
                    let name = event.element.getName();
                    let proj = this.projects[session.hostHash][id];
                    if (proj) {
                        if (proj.getName() != name) {
                            proj.setName(name);
                            this.fire(session, "project", id, "modified");
                        }
                    }
                }
                else if (event.type == "remove" && event.element) {
                    let id = event.element.getId();
                    if (id in this.projects[session.hostHash]) {
                        delete this.projects[session.hostHash][id];
                        for (let tId in this.tasks[session.hostHash]) {
                            let t = this.tasks[session.hostHash][tId];
                            if (t && t.getProjectId() == id) {
                                delete this.tasks[session.hostHash][tId];
                            }
                        }
                        for (let tgId in this.taskGroups[session.hostHash]) {
                            let tg = this.taskGroups[session.hostHash][tgId];
                            if (tg && tg.getProjectId() == id) {
                                delete this.taskGroups[session.hostHash][tgId];
                            }
                        }
                        this.fire(session, "project", id, "deleted");
                    }
                }
                else if (event.type == "add" && event.element) {
                    this.ensureProjectExists(event.element.getId(), event.element.getName(), session).then(() => {
                        if (this.activeTasksWindowController) {
                            this.activeTasksWindowController.refreshTaskCounts();
                        }
                    });
                }
            });
    
        }
        if (!this.tasksRootSections) {
            this.tasksRootSections = {};
        }
        if (!(session.hostHash in this.tasksRootSections) && session.sectionManager.sectionsCollection) {
            this.tasksRootSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.sectionsCollection, x => (x.isKvdbModuleEnabled(true) || x.isCalendarModuleEnabled(true)));
        }

        if (!this.tasksPrimarySections) {
            this.tasksPrimarySections = {};
        }
        if (!(session.hostHash in this.tasksPrimarySections) && session.sectionManager.filteredCollection) {
            this.tasksPrimarySections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && (<any>x.sectionData).primary);
        }

        // let tasksAllSectionsCollection = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => x.isUserGroup());
        // tasksAllSectionsCollection.changeEvent.add(this.onTasksSectionChange.bind(this));
    }


    reset(): void {
        this.onReset.resolve();
        this.onReset = Q.defer();
        this.initPromise = null;
        this.kvdbProjectDeferred = Q.defer();
        this.kvdbAnyProjectDeferred = Q.defer();
        this.ensureKvdbCExistsDeferreds = {};
        this.projects = {};
        this.taskGroups = {};
        this.tasks = {};
        this.taskTitleCache = {};
        this.origProjects = {};
        this.origTaskGroups = {};
        this.origTasks = {};
        this.watched = {};
        this.watchedTasksHistory = {};
        this.onWatchedTasksHistoryRebuildHandlers = [];
        this.onWatchedTasksHistorySetHandlers = [];
        this.kvdbProjectId = null;
        this.recentlyUsedTaskProperties = null;
        this.taskGroupsBacklog = {};
        this.projectsBacklog = {};
        this.preventFireDelete = {};
        this.fireLocks = 0;
        this.openedWindows = {};
        this.kvdbCs = {};
        this.tasksPrimarySections = null;
        this.tasksUnreadCountFullyLoadedModel.setWithCheck(false);
        this.sectionsWithSpinner = {};
        this.savingLocks = {};
        this.tasksSectionsCollection = {};
        this.tasksSectionsCollectionNoPrivate = {};
        this.userNames = {};
    }


    loadUserSettingsForImport(settingsKvdb: any): Q.Promise<void> {
        return Q().then(() => {
            this.viewSettings = new ViewSettings(TasksPlugin.VIEW_SETTINGS, <any>settingsKvdb);
            return this.loadSettings(null, "__global__");
        })
    }

    loadSettings(session?: mail.session.Session, projectId: string = "__global__", extra?: { defaultViewMode?: string, defaultIsKanban?: boolean, defaultIsHorizontal?: boolean }): Q.Promise<void> {
        let overrideDefauls: { [key: string]: number | string } = {};
        if (extra) {
            if ("defaultViewMode" in extra) {
                overrideDefauls["show-recently-modified"] = extra.defaultViewMode == "rm" ? 1 : 0;
            }
            if ("defaultIsKanban" in extra) {
                overrideDefauls["kanban-mode"] = extra.defaultIsKanban ? 1 : 0;
            }
            if ("defaultIsHorizontal" in extra) {
                this.viewSettings.overrideDefaultGlobalSetting("horizontal-task-window-layout", extra.defaultIsHorizontal ? 1 : 0);
            }
        }
        return this.viewSettings.loadSettings(session, projectId, overrideDefauls);
    }

    saveSetting(session: mail.session.Session, name: string, value: number | string, projectId: string, context: ViewContext): void {
        return this.viewSettings.saveSetting(session, name, value, projectId, context);
    }

    getSetting(session: mail.session.Session, name: string, projectId: string, context: ViewContext): number | string {
        return this.viewSettings.getSetting(session, name, projectId, context);
    }
    
    // getSettingFullProjectId(session: mail.session.Session, projectId: string): string {
    //     if (!session || !projectId) {
    //         return projectId;
    //     }
    //     let isRemoteSession = session.host != this.app.sessionManager.getLocalSession().host;
    //     let fullProjectId = isRemoteSession ? `${session.hostHash}--${projectId}` : projectId;
    //     return fullProjectId;
    // }

    getViewMode(session: mail.session.Session, projectId: string): string {
        let mode = this.getSetting(session, "show-recently-modified", projectId, ViewContext.TasksWindow);
        if (mode == 0) {
            return "groupped";
        }
        if (mode == 1) {
            return "rm";
        }
        return null;
    }

    getIsKanban(session: mail.session.Session, projectId: string): boolean {
        return !!this.getSetting(session, "kanban-mode", projectId, ViewContext.TasksWindow);
    }

    getIsHorizontalLayout(session: mail.session.Session, projectId: string): boolean {
        return !!this.getSetting(session, "horizontal-task-window-layout", projectId, ViewContext.TasksWindow);
    }

    getTaskCommentsForExport(session: mail.session.Session, taskId: string): { message: string, user: string, date: number }[] {
        let task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return [];
        }
        let comments: { message: string, user: string, date: number }[] = [];
        let commentTags = task.getCommentTags();
        for (let tag of commentTags) {
            let msgData = tag.split("/");
            if (msgData.length < 2) {
                continue;
            }

            let sinkId: string = msgData[0];
            let msgId: number = Number(msgData[1]);

            let index = session.sectionManager.sinkIndexManager.getIndexBySinkId(sinkId);
            if (!index) {
                continue;
            }
            let entry = index.getEntry(msgId);
            if (!entry) {
                continue;
            }

            let message = entry.getMessage();
            let commentMessage = JSON.parse(entry.source.data.text);
            comments.push({
                message: commentMessage.comment,
                user: commentMessage.who,
                date: message.createDate.getTime(),
            });
        }
        return comments;
    }
    
    onTasksSectionChange(event: Mail.Types.utils.collection.CollectionEvent<Mail.mail.section.SectionService>): void {
        if (event.element != null) {
            if (event.element.hasChatModule()) {
                event.element.getChatSinkIndex().then(() => {
                    if (this.activeTaskGroupsPanel) {
                        let conv2Section = this.activeTaskGroupsPanel.getActiveConv2Section();
                        if (this.activeTaskGroupsPanel && conv2Section && conv2Section.section && conv2Section.section.getId() == event.element.getId()) {
                            this.activeSinkId = event.element.getChatSink().id;
                            this.activeSinkHostHash = (this.activeTaskGroupsPanel && this.activeTaskGroupsPanel.session ? this.activeTaskGroupsPanel.session.hostHash : null) || this.app.sessionManager.getLocalSession().hostHash;
                        }
                    }
                });
            }
        }
    }
    
    /****************************************
    ***************** KVDB ******************
    ****************************************/
    kvdbCs: { [hostHash: string]: { [id: string]: Mail.mail.kvdb.KvdbCollection<any> } } = {};
    addKvdbCollection(id: string, kvdbc: Mail.mail.kvdb.KvdbCollection<TaskKvdbEntry>, session: mail.session.Session): Q.Promise<void> {
        this.kvdbCs[session.hostHash][id] = kvdbc;
        kvdbc.collection.changeEvent.add(event => {
            if ((event.type == "add" || event.type == "update") && event.element.secured) {
                let section = session.sectionManager.getSection(id);
                if (section && !(section.isKvdbModuleEnabled() || section.isCalendarModuleEnabled())) {
                    return;
                }
                let key = event.element.secured.key;
                if (key[1] == "_") {
                    let origKey = key;
                    let type = key[0];
                    let typeStr: Watchable = (type == "p" ? "project" : (type == "g" ? "taskGroup" : "task"));
                    let action: Action = event.element.secured.payload ? (event.type == "add" ? "added" : "modified") : "deleted";
                    key = key.substr(2);

                    if (action == "modified") {
                        let src = (type == "p" ? this.projects[session.hostHash] : (type == "g" ? this.taskGroups[session.hostHash] : this.tasks[session.hostHash]));
                        if (key in src) {
                            if (src[key].__version__ == event.element.secured.payload.__version__) {
                                return;
                            }
                        }
                    }

                    this.addElementFromKvdb(session, id, event.element.secured, action == "modified").then(() => {
                        if (action == "deleted") {
                            if (!this.preventFireDelete[session.hostHash]) {
                                this.preventFireDelete[session.hostHash] = [];
                            }
                            let idx = this.preventFireDelete[session.hostHash].indexOf(id + "___" + origKey);
                            if (idx >= 0) {
                                return;
                            }
                            this.refreshWatched();
                        }

                        this.fire(session, typeStr, key, action);
                    });
                }
            }
        });
        let prom = Q();
        this.fireLocks++;
        for (let el of kvdbc.collection.list) {
            prom = prom.then(() => {
                let res = this.addElementFromKvdb(session, id, el.secured, true);
                let key = el.secured.key;
                key = key.substr(2);
                return res;
            });
        }
        prom.then(() => {
            this.fireLocks--;
            this.fireAllAdded(session, id);
        });
        return prom;
    }
    
    ensureKvdbCExists(id: string, session: mail.session.Session): Q.Promise<void> {
        if (id in this.ensureKvdbCExistsDeferreds[session.hostHash]) {
            return this.ensureKvdbCExistsDeferreds[session.hostHash][id].promise;
        }
        if (id in this.kvdbCs[session.hostHash]) {
            return <any>Q.resolve();
        }
        let section = session.sectionManager.getSection(id);
        let mod = section.getKvdbModule();
        if (!mod) {
            return Q().thenReject();
        }
        this.ensureKvdbCExistsDeferreds[session.hostHash][id] = Q.defer();
        return Q().then(() => {
            if (!mod.hasModule() && mod.creatingPromise) {
                return mod.creatingPromise;
            }
        })
        .then(() => {
            return this.getSectionKvdbCollection(section).then(kvdbC => {
                if (!kvdbC) {
                    return Q().thenReject();
                }
                return <any>this.addKvdbCollection(id, kvdbC, session);
            }).fail(e => {
                throw e;
            });
        })
        .then(() => {
            if (this.ensureKvdbCExistsDeferreds[session.hostHash][id]) {
                // console.log("ensureKvdbCExistsDeferreds resolve");
                this.ensureKvdbCExistsDeferreds[session.hostHash][id].resolve();
                delete this.ensureKvdbCExistsDeferreds[session.hostHash][id];
            }
        })
        .fail(() => {
            if (this.ensureKvdbCExistsDeferreds[session.hostHash][id]) {
                this.ensureKvdbCExistsDeferreds[session.hostHash][id].reject("kvdb reject");
                delete this.ensureKvdbCExistsDeferreds[session.hostHash][id];
            }
        });
    }
    
    getSectionKvdbCollection(section: mail.section.SectionService): Q.Promise<mail.kvdb.KvdbCollection<any>> {
        return Q().then(() => {
            section.getKvdbModule().kvdbPromise = null;
            section.getKvdbModule().kvdbCollectionPromise = null;
            return section.getKvdbCollection();
        })
        .then(x => {
            return x;
        })
        .fail(e => {
            if (e == "Connection Broken") {
                return Q().then(() => {
                    return this.app.waitForConnection();
                })
                .then(() => {
                    return this.getSectionKvdbCollection(section);
                });
            }
            return this.getSectionKvdbCollection(section);
        });
    }

    refreshCollections(): Q.Promise<void> {
        let prom = Q();
        for (let hostHash in this.kvdbCs) {
            for (let id in this.kvdbCs[hostHash]) {
                prom = prom.then(() => <any>this.kvdbCs[hostHash][id].refresh())
            }

        }
        return prom;
    }

    addElementFromKvdb(session: mail.session.Session, kvdbId: string, el: { key: string, payload: Project | TaskGroup | Task }, modified: boolean): Q.Promise<void> {
        let payload = el.payload;
        if (!payload) {
            let id = el.key.substr(2);
            if (el.key[0] == "p") {
                delete this.projects[session.hostHash][id];
                delete this.origProjects[session.hostHash][id];
            }
            else if (el.key[0] == "g") {
                delete this.taskGroups[session.hostHash][id];
                delete this.origTaskGroups[session.hostHash][id];
            }
            else if (el.key[0] == "t") {
                if (this.tasks[session.hostHash][id] && this.tasks[session.hostHash][id].getProjectId() == kvdbId) {
                    delete this.tasks[session.hostHash][id];
                    delete this.origTasks[session.hostHash][id];
                }
            }
            return Q.resolve();
        }
        let key = el.key;
        if (key[1] != "_") {
            return Q.resolve();
        }
        let type = key[0];
        key = key.substr(2);
        if (type == "p") {
            DataMigration.migrateProject(payload);
            let sp = this.loadSettings(session, key, <any>payload);
            payload.taskGroupIds = key in this.projects[session.hostHash] ? this.projects[session.hostHash][key].getTaskGroupIds() : [];
            payload.orphanedTaskIds = key in this.projects[session.hostHash] ? this.projects[session.hostHash][key].getOrphanedTaskIds() : [];
            let p = new Project(payload);
            let old = this.projects[session.hostHash][key];
            let updatePinned: { [key: string]: boolean } = {};
            this.projects[session.hostHash][key] = p;
            this.origProjects[session.hostHash][key] = new Project(JSON.parse(JSON.stringify(payload)));
            if (old) {
                let a = old.getPinnedTaskGroupIds();
                let b = p.getPinnedTaskGroupIds();
                for (let i = a.length - 1; i >= 0; --i) {
                    if (b.indexOf(a[i]) < 0) {
                        updatePinned[a[i]] = false;
                    }
                }
                for (let i = b.length - 1; i >= 0; --i) {
                    if (a.indexOf(b[i]) < 0) {
                        updatePinned[b[i]] = true;
                    }
                }
                if (this.fireLocks == 0) {
                    for (let k in updatePinned) {
                        let pinned = updatePinned[k];
                        this.app.dispatchEvent<UpdatePinnedTaskGroupsEvent>({
                            type: "update-pinned-taskgroups",
                            sectionId: key,
                            listId: k,
                            pinned: pinned,
                            hostHash: session.hostHash,
                        });
                    }
                }
            }
            
            if (key in this.projectsBacklog[session.hostHash]) {
                for (let tId of this.projectsBacklog[session.hostHash][key]) {
                    p.addOrphanedTasksId(tId, true);
                }
                delete this.projectsBacklog[session.hostHash][key];
            }
            
            for (let tgId in this.taskGroups[session.hostHash]) {
                let tg = this.taskGroups[session.hostHash][tgId];
                if (tg.getProjectId() == key) {
                    this.projects[session.hostHash][key].addTaskGroupId(tg.getId(), true);
                }
            }
            
            let df = Q.defer<void>();
            sp.then(() => {
                if (key == this.kvdbProjectId) {
                    this.kvdbProjectDeferred.resolve();
                }
                this.kvdbAnyProjectDeferred.resolve(key);
                df.resolve();
            });
            return df.promise;
        }
        else if (type == "g") {
            DataMigration.migrateTaskGroup(payload);
            payload.taskIds = key in this.taskGroups[session.hostHash] ? this.taskGroups[session.hostHash][key].getTaskIds() : [];
            let tg = new TaskGroup(payload);
            this.taskGroups[session.hostHash][key] = tg;
            this.origTaskGroups[session.hostHash][key] = new TaskGroup(JSON.parse(JSON.stringify(payload)));

            if (key in this.taskGroupsBacklog[session.hostHash]) {
                for (let tId of this.taskGroupsBacklog[session.hostHash][key]) {
                    tg.addTaskId(tId, true);
                }
                delete this.taskGroupsBacklog[session.hostHash][key];
            }

            let pk = tg.getProjectId();
            if (pk in this.projects[session.hostHash]) {
                this.projects[session.hostHash][pk].addTaskGroupId(tg.getId(), true);
                this.fire(session, "project", pk, "modified");
            }
        }
        else if (type == "t") {
            DataMigration.migrateTask(payload);
            let t = new Task(payload);
            let oldTask = this.tasks[session.hostHash][key];
            let oldTask2 = this.origTasks[session.hostHash][key];
            if (t.getProjectId() != kvdbId) {
                return Q.resolve();
            }
            this.taskTitleCache[session.hostHash][t.getId()] = t.getName();
            Q().then(() => {
                let differentLabelClass = false;
                if (oldTask && oldTask.getLabelClass() != t.getLabelClass()) {
                    differentLabelClass = true;
                }
                else if (oldTask2 && oldTask2.getLabelClass() != t.getLabelClass()) {
                    differentLabelClass = true;
                }
                if (differentLabelClass) {
                    this.app.dispatchEvent<TaskBadgeChangedEvent>({
                        type: "task-badge-changed",
                        taskId: t.getId(),
                        taskLabelClass: t.getLabelClass(),
                        hostHash: session.hostHash,
                    });
                }
            })
                .fail(err => {
                    Logger.error("Error while dispatching task-badge-changed event", err);
                });
            if (oldTask) {
                if (oldTask.getProjectId() != t.getProjectId()) {
                    this.fire(session, "task", key, "section-changed");
                    if (!this.preventFireDelete[session.hostHash]) {
                        this.preventFireDelete[session.hostHash] = [];
                    }
                    this.preventFireDelete[session.hostHash].push(oldTask.getProjectId() + "___t_" + key);
                }
            }
            this.tasks[session.hostHash][key] = t;
            this.origTasks[session.hostHash][key] = new Task(JSON.parse(JSON.stringify(payload)));

            let tgks = t.getTaskGroupIds();
            if (t.taskGroupId) {
                if (payload.taskGroupIds) {
                    delete t.taskGroupId;
                }
                else {
                    tgks.push(t.taskGroupId);
                }
            }

            // global unread count
            let muted = this.getMutedInfoSingleSession(session);
            if (this.wasTaskUnread(session, t, t.getProjectId())) {
                // hack na nie zliczanie starych tasków których nawet ni widać w UI
                let realId = Number(t.getId());
                if (realId > 0) {
                    if (!muted[t.getProjectId()]) {
                        if (this.fireLocks == 0) {
                            this.refreshWatched();
                        }
                        else {
                            let section = session.sectionManager.getSection(t.getProjectId());
                            if (!section || section.isKvdbModuleEnabled()) {
                                this.addUnreadTaskToCount();
                            }
                        }
                    }
                    this.app.dispatchEvent<UpdateSectionBadgeEvent>({
                        type: "update-section-badge",
                        sectionId: t.getProjectId(),
                        hostHash: session.hostHash,
                    });
                }
            }

            // Make sure the task is an orphan or belongs to a taskgroup (1+)
            if (tgks.length == 0) {
                tgks.push("__orphans__");
            }
            else {
                // Use correct orphan indicator
                let notOrphan = false;
                for (let k in tgks) {
                    let v = tgks[k];
                    if (v == undefined || v == "") {
                        tgks[k] = "__orphans__";
                    }
                    if (tgks[k] != "__orphans__") {// && tgks[k] in this.taskGroups) {
                        notOrphan = true;
                    }
                }

                // If it's an orphan, remove it from non-existing taskgroups
                if (!notOrphan) {
                    tgks.length = 0;
                    tgks.push("__orphans__");
                }

                // If it's not an orphan, remove all "__orphans__" tg ids
                if (notOrphan) {
                    tgks = tgks.filter(s => s != "__orphans__");
                    t.setTaskGroupIds(tgks);
                }
            }

            // Add to taskgroups/projects
            if (tgks[0] != "__orphans__") {
                for (let tgk of tgks) {
                    if (tgk in this.taskGroups[session.hostHash]) {
                        this.taskGroups[session.hostHash][tgk].addTaskId(t.getId(), true);
                        //if (this.taskGroups[tgk].addTaskId(t.getId(), true)) {
                        this.fire(session, "taskGroup", tgk, "modified");
                        //}
                    }
                    else {
                        if (!this.taskGroupsBacklog[session.hostHash][tgk]) {
                            this.taskGroupsBacklog[session.hostHash][tgk] = [];
                        }
                        this.taskGroupsBacklog[session.hostHash][tgk].push(t.getId());
                    }
                }
            }
            else {
                let pk = t.getProjectId();
                if (pk in this.projects[session.hostHash]) {
                    this.projects[session.hostHash][pk].addOrphanedTasksId(t.getId(), true);
                    //if (this.projects[pk].addOrphanedTasksId(t.getId(), true)) {
                    this.fire(session, "project", pk, "modified");
                    //}
                }
                else {
                    if (!this.projectsBacklog[session.hostHash][pk]) {
                        this.projectsBacklog[session.hostHash][pk] = [];
                    }
                    this.projectsBacklog[session.hostHash][pk].push(t.getId());
                }
            }
            if (oldTask) {
                let newTgIds: TaskGroupId[] = t.getTaskGroupIds();
                let removeFrom: TaskGroupId[] = oldTask.getTaskGroupIds(true).filter(x => newTgIds.indexOf(x) < 0);
                for (let id of removeFrom) {
                    if (id == "__orphans__") {
                        let p = this.projects[session.hostHash][oldTask.getProjectId()];
                        if (p) {
                            p.removeOrphanedTasksId(t.getId());
                            this.fire(session, "project", p.getId(), "modified");
                        }
                    }
                    else {
                        let tg = this.taskGroups[session.hostHash][id];
                        if (tg) {
                            tg.removeTaskId(t.getId());
                            this.fire(session, "taskGroup", id, "modified");
                        }
                    }
                }
            }
            this.fire(session, "task", key, modified ? "modified" : "added");
            if (modified && oldTask) {
                this.checkAttachmentChanges(session, oldTask, t);
            }
        }
        return Q.resolve();
    }
    
    lockSaving(hostHash: HostHash, key: string): boolean {
        if ((hostHash in this.savingLocks) && (key in this.savingLocks[hostHash])) {
            return false;
        }
        if (!(hostHash in this.savingLocks)) {
            this.savingLocks[hostHash] = {};
        }
        this.savingLocks[hostHash][key] = Q.defer();
        return true;
    }
    
    unlockSaving(hostHash: HostHash, key: string, version: number): void {
        if ((hostHash in this.savingLocks) && (key in this.savingLocks[hostHash])) {
            this.savingLocks[hostHash][key].resolve(version);
            delete this.savingLocks[hostHash][key];
        }
    }
    
    setKvdbElement(session: mail.session.Session, collectionId: string, key: string, element: Project | TaskGroup | Task, version?: number, origElement?: Project | TaskGroup | Task): Q.Promise<void> {
        return Q().then(() => {
            if (this.lockSaving(session.hostHash, key)) {
                return this.setKvdbElementCore(session, collectionId, key, element, version, origElement)
                .then(newVersion => {
                    this.unlockSaving(session.hostHash, key, newVersion || version);
                })
                .fail(() => {
                    this.unlockSaving(session.hostHash, key, version);
                });
            }
            else {
                return this.savingLocks[session.hostHash][key].promise.then(newVersion => {
                    return this.setKvdbElement(session, collectionId, key, element, newVersion || version, origElement);
                });
            }
        });
    }
    
    setKvdbElementCore(session: mail.session.Session, collectionId: string, key: string, element: Project | TaskGroup | Task, version?: number, origElement?: Project | TaskGroup | Task): Q.Promise<number> {
        this.prepareForSave(key, element);
        let element2 = JSON.parse(JSON.stringify(element));
        if ("taskGroupIds" in element2 && element2.className == "com.privmx.plugin.tasks.main.data.Project") {
            element2.taskGroupIds = [];
        }
        if ("orphanedTaskIds" in element2) {
            element2.orphanedTaskIds = [];
        }
        if ("taskIds" in element2) {
            element2.taskIds = [];
        }

        let entry = this.kvdbCs[session.hostHash][collectionId].getSync(key);
        if (entry && entry.secured.payload) {
            element2.__version__ = entry.secured.payload.__version__ + 1;
        }
        else if ("__version__" in element2) {
            element2.__version__++;
        }
        else {
            element2.__version__ = 1;
        }
        let el = JSON.parse(JSON.stringify(this.kvdbCs[session.hostHash][collectionId].getSync(key)));
        if (typeof (version) != "number" && el) {
            version = el.version;
        }
        if (!origElement) {
            if (key[1] == "_") {
                if (key[0] == "p") {
                    origElement = this.origProjects[session.hostHash][element.getId()];
                }
                else if (key[0] == "g") {
                    origElement = this.origTaskGroups[session.hostHash][element.getId()];
                }
                else if (key[0] == "t") {
                    origElement = this.origTasks[session.hostHash][element.getId()];
                }
            }
            if (!origElement && entry) {
                origElement = this.createObject(session, entry.secured);
            }
        }
        return this.kvdbCs[session.hostHash][collectionId].set(key, { secured: { payload: element2 }, version: version }, typeof (version) == "number")
        .then(() => {
            let entry2 = { secured: { payload: element2, key }, version: version };
            if (key[1] == "_") {
                if (key[0] == "p") {
                    this.origProjects[session.hostHash][element.getId()] = <Project>this.createObject(session, JSON.parse(JSON.stringify(entry2.secured)));
                }
                else if (key[0] == "g") {
                    this.origTaskGroups[session.hostHash][element.getId()] = <TaskGroup>this.createObject(session, JSON.parse(JSON.stringify(entry2.secured)));
                }
                else if (key[0] == "t") {
                    let oldTask = origElement;
                    let newTask = <Task>this.createObject(session, JSON.parse(JSON.stringify(entry2.secured)));
                    this.origTasks[session.hostHash][element.getId()] = newTask;
                    if (oldTask && newTask && oldTask.getStatus() != newTask.getStatus()) {
                        this.app.dispatchEvent<TaskBadgeChangedEvent>({
                            type: "task-badge-changed",
                            taskId: newTask.getId(),
                            taskLabelClass: newTask.getLabelClass(),
                            hostHash: session.hostHash,
                        });
                    }
                }
            }
            if (entry && entry.secured.payload) {
                entry.secured.payload.__version__++;
            }
            return version + 1;
        })
        .fail(e => {
            if (e && e.data && e.data.error && e.data.error.code == TasksPlugin.ERR_INVALID_VERSION) {
                return this.kvdbCs[session.hostHash][collectionId].refresh().then(() => {
                    let oldObject = this.prepareForSave(key, origElement);
                    let myObject = element;
                    el = JSON.parse(JSON.stringify(this.kvdbCs[session.hostHash][collectionId].getSync(key)));
                    if (!el) {
                        for (let id in this.kvdbCs[session.hostHash]) {
                            let x = this.kvdbCs[session.hostHash][id];
                            let el2 = x.getSync(key);
                            if (el2) {
                                el = JSON.parse(JSON.stringify(el2));
                            }
                        }
                    }
                    if (!el || !el.secured || !el.secured.payload) {
                        return this.setKvdbElementCore(session, collectionId, key, myObject);
                    }
                    let othersObject = this.prepareForSave(key, this.createObject(session, el.secured));
                    let newObject = null;
                    if (othersObject.modifiedBy == this.getMyId(this.session)) {
                        return this.setKvdbElementCore(session, collectionId, key, myObject);
                    }
                    let resolver: ConflictResolver<any>;
                    if (myObject instanceof Project) {
                        resolver = new ProjectConflictResolver(oldObject, myObject, othersObject);
                    }
                    else if (myObject instanceof TaskGroup) {
                        resolver = new TaskGroupConflictResolver(oldObject, myObject, othersObject);
                    }
                    else if (myObject instanceof Task) {
                        resolver = new TaskConflictResolver(oldObject, myObject, othersObject);
                    }
                    if (resolver) {
                        let result = resolver.resolve();
                        if (result.status == ConflictResolutionStatus.RESOLVED) {
                            newObject = result.resolvedObject;
                        }
                        else if (result.status == ConflictResolutionStatus.IDENTICAL) {
                            newObject = element;
                        }
                        if (newObject) {
                            newObject.__version__ = othersObject.__version__;
                            return this.setKvdbElementCore(session, collectionId, key, newObject);
                        }
                    }
                    return Q.reject("conflict");
                });
            }
            return version;
        });
    }
    
    getTaskVersion(session: mail.session.Session, taskId: string): number {
        let task = this.tasks[session.hostHash][taskId];
        if (task) {
            let el = this.kvdbCs[session.hostHash][task.getProjectId()].getSync("t_" + taskId);
            if (el) {
                return el.version;
            }
        }
        return null;
    }
    
    getKvdbElement(session: mail.session.Session, collectionId: string, key: string): Project | TaskGroup | Task {
        return this.kvdbCs[session.hostHash][collectionId].getSync(key).secured.payload;
    }
    
    deleteKvdbElement(session: mail.session.Session, collectionId: string, key: string, preventFire: boolean = false): Q.Promise<void> {
        let type = key[0];
        let typeStr: Watchable = (type == "p" ? "project" : (type == "g" ? "taskGroup" : "task"));
        if (preventFire) {
            if (!this.preventFireDelete[session.hostHash]) {
                this.preventFireDelete[session.hostHash] = [];
            }
            this.preventFireDelete[session.hostHash].push(collectionId + "___" + key);
            if (type == "t") {
                this.fire(session, typeStr, key.substr(2), "section-changed");
            }
        }
        else {
            this.fire(session, typeStr, key.substr(2), "deleted");
        }
        let el = this.kvdbCs[session.hostHash][collectionId].getSync(key);
        return this.kvdbCs[session.hostHash][collectionId].set(key, { secured: { payload: null }, version: el ? el.version : null });
    }
    
    createObject(session: mail.session.Session, data: any): Project | TaskGroup | Task {
        let key = data.key;
        let payload = data.payload;
        if (!payload) {
            return null;
        }
        if (key[1] == "_") {
            if (key[0] == "p") {
                DataMigration.migrateProject(payload);
                let p = new Project(payload);
                for (let tgId in this.taskGroups[session.hostHash]) {
                    let tg = this.taskGroups[session.hostHash][tgId];
                    if (tg.getProjectId() == p.getId()) {
                        p.addTaskGroupId(tg.getId(), true);
                    }
                }
                for (let tId in this.tasks[session.hostHash]) {
                    let t = this.tasks[session.hostHash][tId];
                    let tgIds = t.getTaskGroupIds();
                    if (t.getProjectId() == p.getId() && (tgIds.length == 0 || (tgIds.length == 1 && tgIds[0] == "__orphans__"))) {
                        p.addOrphanedTasksId(t.getId(), true);
                    }
                }
                return p;
            }
            else if (key[0] == "g") {
                DataMigration.migrateTaskGroup(payload);
                let tg = new TaskGroup(payload);
                return tg;
            }
            else if (key[0] == "t") {
                DataMigration.migrateTask(payload);
                let t = new Task(payload);
                return t;
            }
        }
        return null;
    }
    
    prepareForSave(key: string, data: any) {
        if (key[0] == "p") {
            let idx = data.taskGroupIds.indexOf("__orphans__");
            if (idx >= 0) {
                data.taskGroupIds.splice(idx, 1);
            }
        }
        else if (key[0] == "g") {
        }
        else if (key[0] == "t") {
            if (data.taskGroupIds.length == 1 && data.taskGroupIds[0] == "") {
                data.taskGroupIds[0] = "__orphans__";
            }
        }
        return data;
    }
    
    projectLoaded(session: mail.session.Session, id: string): Q.Promise<void> {
        this.kvdbProjectId = id;
        if (id in this.projects[session.hostHash]) {
            this.kvdbProjectDeferred.resolve();
        }
        return this.kvdbProjectDeferred.promise;
    }
    
    anyProjectLoaded(session: mail.session.Session): Q.Promise<string> {
        for (let k in this.projects[session.hostHash]) {
            this.kvdbAnyProjectDeferred.resolve(k);
            break;
        }
        return this.kvdbAnyProjectDeferred.promise;
    }
    
    nextId(session: mail.session.Session, key: string): Q.Promise<string> {
        return Q().then(() => {
            return <any>session.mailClientApi.privmxRegistry.getSrpSecure();
        })
            .then(srpSecure => {
                return srpSecure.request("nextUniqueId", { key: key });
            })
            .then(x => {
                let s = "" + x;
                while (s.length < 3) {
                    s = "0" + s;
                }
                return s;
            });
    }




    /****************************************
    **************** Events *****************
    ****************************************/
    watch(session: mail.session.Session, type: Watchable, id: string, action: Action, handler: EventHandler): void {
        try {
            let key = type + "-" + id + "-" + action;
            if (!session) {
                throw Error("Cannnot add watcher with empty session - id: " + id)
            }
            // console.log("add watcher for ", session.hostHash);
            if (!this.watched[session.hostHash]) {
                this.watched[session.hostHash] = {};
            }
            
            if (!this.watched[session.hostHash][key]) {
                this.watched[session.hostHash][key] = [];
            }
            this.watched[session.hostHash][key].push(handler);
        } catch (e) {
            console.error(e);
        }
    }
    
    unWatch(session: mail.session.Session, type: Watchable, id: string, action: Action, handler: EventHandler): void {
        let key = type + "-" + id + "-" + action;
        if (!this.watched[session.hostHash]) {
            this.watched[session.hostHash] = {};
        }
        if (!this.watched[session.hostHash][key]) {
            return;
        }
        let idx = this.watched[session.hostHash][key].indexOf(handler);
        if (idx >= 0) {
            this.watched[session.hostHash][key].splice(idx, 1);
        }
    }
    
    fire(session: mail.session.Session, type: Watchable, id: string, action: Action): void {
        // this.log("fire", type,id,action,session.hostHash)
        if (this.fireLocks > 0) { return; }
        if (!this.watched[session.hostHash]) {
            this.watched[session.hostHash] = {};
        }
        for (let key in this.watched[session.hostHash]) {
            let [t, i, a] = key.split("-");
            if ((t == type || t == "*") && (i == id || i == "*") && (a == action || a == "*")) {
                for (let handler of this.watched[session.hostHash][key]) {
                    handler(type, id, action);
                }
            }
        }
        if (this.searchStr != "") {
            this.updateSearch(this.searchStr);
        }
    }
    
    fireAllAdded(session: mail.session.Session, filterSectionId: string = null) {
        if (this.fireLocks > 0) { return; }
        let doFilter = filterSectionId !== null;
        for (let k in this.projects[session.hostHash]) {
            if (doFilter && k != filterSectionId) {
                continue;
            }
            this.fire(session, "project", k, "added");
        }
        for (let k in this.taskGroups[session.hostHash]) {
            if (doFilter && this.taskGroups[session.hostHash][k] && this.taskGroups[session.hostHash][k].getProjectId() != filterSectionId) {
                continue;
            }
            this.fire(session, "taskGroup", k, "added");
        }
        for (let k in this.tasks[session.hostHash]) {
            if (doFilter && this.tasks[session.hostHash][k] && this.tasks[session.hostHash][k].getProjectId() != filterSectionId) {
                continue;
            }
            this.fire(session, "task", k, "added");
        }
    }





    /****************************************
    **************** People *****************
    ****************************************/
    userNames: { [hostHash: string]: Array<string> } = {};
    fetchAllUsers(session: mail.session.Session): Q.Promise<void> {
        if (!this.userNames[session.hostHash]) {
            this.userNames[session.hostHash] = [];
        }
        return this.utilApi.getUsernames()
        .then((arr) => {
            if (this.userNames[session.hostHash]) {
                this.userNames[session.hostHash] = arr;
            }
        })
        .fail(() => {
            if (this.userNames[session.hostHash]) {
                this.userNames[session.hostHash] = <string[]>[];
                
            }
        });
    }
    
    getMyself(session: mail.session.Session): Person {
        let person = session.conv2Service.personService.getPerson(session.sectionManager.identity.hashmail);
        let contact = person ? person.getContact() : null;
        return {
            id: session.sectionManager.identity.hashmail,
            name: session.sectionManager.identity.user,
            avatar: this.app.assetsManager.getAssetByName("DEFAULT_USER_AVATAR"),
            isBasic: contact ? contact.basicUser : false,
        };
    }
    
    personExists(session: mail.session.Session, personId: PersonId): boolean {
        return session.conv2Service.personService.persons.contactCollection.find(x => x.getHashmail() == personId) != null;
    }
    
    getPerson(session: mail.session.Session, personId: PersonId): Person {
        let person = session.conv2Service.personService.getPerson(personId);
        if (!person) {
            // console.log("could not find person", personId);
            let av = this.app.assetsManager.getAssetByName("DEFAULT_USER_AVATAR");
            return { id: "anonymous", name: "Anonymous", avatar: av, isBasic: false };
        }
        if (person.getHashmail() == "bot#simplito.com") {
            return null;
        }
        let profile = session.conv2Service.personService.getPerson(person.getHashmail());
        let contact = profile.getContact();
        return {
            id: profile.getHashmail(),
            name: profile.getName(),
            avatar: profile.getHashmail(),
            isBasic: contact ? contact.basicUser : false,
        };
    }
    
    getMyId(session: mail.session.Session): PersonId {
        return this.getMyself(session).id;
    }
    
    getPeople(session: mail.session.Session, names: string[]): Person[] {
        let arr: Person[] = [];
        for (let name of names) {
            arr.push(this.getPerson(session, name));
        }
        return arr;
    }
    
    getAllPeople(session: mail.session.Session): PeopleMap {
        let ret: PeopleMap = {};
        // console.log("getAllPeople");
        for (let person of session.conv2Service.personService.persons.contactCollection.list) {
            if (person.getHashmail() == "bot#simplito.com") {
                continue;
            }
            let profile = session.conv2Service.personService.getPerson(person.getHashmail());
            let contact = profile.getContact();
            ret[profile.getHashmail()] = {
                id: profile.getHashmail(),
                name: profile.getName(),
                avatar: profile.getHashmail(),
                isBasic: contact ? contact.basicUser : false,
                deleted: session.conv2Service.contactService.deletedUsers.indexOf(profile.usernameCore) >= 0,
            };
        }
        return ret;
    }
    
    getProjectMemberIds(session: mail.session.Session, projectId: ProjectId): Array<PersonId> {
        let arr: Array<PersonId> = [];
        let people = this.getProjectMembers(session, projectId);
        for (let k in people) {
            arr.push(people[k].id);
        }
        return arr;
    }
    
    getProjectMembers(session: mail.session.Session, _projectId: ProjectId): PeopleMap {
        return this.getAllPeople(session);
    }
    
    getProjectMemberNames(session: mail.session.Session, projectId: ProjectId): PeopleNamesMap {
        let map: PeopleNamesMap = {};
        let people = this.getProjectMembers(session, projectId);
        for (let k in people) {
            map[people[k].id] = people[k].name;
        }
        return map;
    }
    
    getMembers(session: mail.session.Session, memberIds: Array<PersonId>): PeopleMap {
        let people = this.getAllPeople(session);
        let res: PeopleMap = {};
        for (var id of memberIds) {
            if (id in people) {
                res[id] = people[id];
            }
        }
        return res;
    }
    
    getMembersArray(session: mail.session.Session, memberIds: Array<PersonId>): Array<Person> {
        let people = this.getAllPeople(session);
        let res: Array<Person> = [];
        for (var id of memberIds) {
            if (id in people) {
                res.push(people[id]);
            }
        }
        return res;
    }
    
    getMemberNames(session: mail.session.Session, memberIds: Array<PersonId>): Array<string> {
        let members = this.getMembers(session, memberIds);
        let res: Array<string> = [];
        for (let id of memberIds) {
            if (id in members) {
                res.push(members[id].name);
            }
        }
        return res;
    }





    /****************************************
    *************** Projects ****************
    ****************************************/
    ensureSessionProjectsInitialized(session: mail.session.Session): Q.Promise<void> {
        return Q.all(
            this.tasksSectionsCollection[session.hostHash].list.map(
                x => this.ensureProjectExists(x.getId(), x.getName(), session)
                    .fail(e => Logger.error("ensureProjectExists", e, "section", x, this.projects))
            ),
        )
        .thenResolve(null);
    }
    
    ensureProjectExists(id: ProjectId, name: string, session: mail.session.Session): Q.Promise<void> {
        if (this.projects[session.hostHash] && this.projects[session.hostHash][id] && (this.projects[session.hostHash][id].getName() == name || this.getPrivateSectionId() == id)) {
            if (this.kvdbCs[session.hostHash] && this.kvdbCs[session.hostHash][id]) {
                return Q();
            }
        }
        return Q().then(() => {
            // console.log("on ensureProjectExists", "hostHash: ", session.hostHash, "projectId: ", id);
            return this.readWatchedTasksHistory(session, id).then(() => {
                // console.log("readWatchedTasksHistory after", "hostHash: ", session.hostHash, "projectId: ", id)
                return this.ensureKvdbCExists(id, session).then(() => {
                    // console.log("ensureKvdbCExists after", "hostHash: ", session.hostHash, "projectId: ", id);
                    if (!(id in this.projects[session.hostHash])) {
                        let proj = new Project();
                        // console.log("on setVersion ", "hostHash: ", session.hostHash, "projectId: ", id)
                        DataMigration.setVersion(proj);
                        // console.log("setVersion after", "hostHash: ", session.hostHash, "projectId: ", id);
                        proj.setId(id);
                        // console.log("setting project name", name);
                        proj.setName(name);
                        proj.setTaskPriorities(["Critical", "High", "[Normal]", "Low"]);
                        proj.setTaskStatuses(["Idea", "[Todo]", "In progress", "Done"]);
                        proj.setTaskTypes(["Bug", "Feature", "[Other]"]);
                        return this.saveProject(session, proj);
                            // .then(() => console.log("saveProject after", "hostHash: ", session.hostHash, "projectId: ", id));
                    }
                    else {
                        if (this.projects[session.hostHash][id].getName() != name) {
                            if (this.getPrivateSectionId() != id) {
                                this.projects[session.hostHash][id].setName(name);
                            }
                            else {
                                this.projects[session.hostHash][id].setName(this.app.localeService.i18n("plugin.tasks.privateTasks"));
                            }
                        }
                    }
                    return <any>Q.resolve();
                });
            });
        })
        .fail(e => {
            console.log("on ensureProjectExists fail for - hosthash: ", session.hostHash, "projectId: ", id, e);
        })
    }
    
    getAvailableProjects(session: mail.session.Session): ProjectsMap {
        // console.log("getAvailableProjects")
        let res: ProjectsMap = {};
        for (let el of this.tasksSectionsCollection[session.hostHash].list) {
            if (el.getId() in this.projects[session.hostHash]) {
                res[el.getId()] = this.projects[session.hostHash][el.getId()];
            }
        }
        return res;
    }
    
    fetchAllProjects(): Q.Promise<ProjectsMap> {
        return Q.resolve();
    }

    taskExists(session: mail.session.Session, taskId: string): boolean {
        return taskId in this.tasks[session.hostHash];
    }

    getTaskLabelClassByTaskId(session: mail.session.Session, taskId: string) {
        if (!taskId) {
            return;
        }
        let task = this.getTask(session, taskId);
        if (!task) {
            return;
        }
        return this.getLabelClassFor(session, task.getProjectId(), task.getStatus());
    }

    getLabelClassFor(_session: mail.session.Session, _projectId: ProjectId, status: TaskStatus) {
        if (typeof(status) == "number") {
            status = Task.convertStatus(status, false);
        }
        return Task.getLabelClass(status);
    }

    getProjects(session: mail.session.Session, projectIds: Array<ProjectId>): ProjectsMap {
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        if (!projectIds) {
            return this.projects[session.hostHash];
        }
        let res: ProjectsMap = {};
        for (let projectId of projectIds) {
            res[projectId] = (projectId in this.projects[session.hostHash] ? this.projects[session.hostHash][projectId] : null);
        }
        return res;
    }
    
    getProject(session: mail.session.Session, projectId: ProjectId): Project {
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        if (projectId in this.projects[session.hostHash]) {
            return this.projects[session.hostHash][projectId];
        }
        return null;
    }
    
    saveProject(session: mail.session.Session, project: Project, version?: number, origElement?: Project): Q.Promise<void> {
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        this.projects[session.hostHash][project.getId()] = project;
        return this.ensureKvdbCExists(project.getId(), session).then(
            () => <any>this.setKvdbElement(session, project.getId(), "p_" + project.getId(), project, version, origElement)
        );
    }
    
    deleteProject(session: mail.session.Session, project: Project, save: boolean = true): Q.Promise<void> {
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        if (project.getId() in this.projects[session.hostHash]) {
            let pId = project.getId();
            delete this.projects[session.hostHash][project.getId()];
            if (save) {
                return this.deleteKvdbElement(session, pId, "p_" + pId);
            }
            else {
                return Q.resolve();
            }
        }
        return Q.reject(TasksPlugin.REJECT_REASON_DOES_NOT_EXIST);
    }
    
    nextProjectId(session: mail.session.Session): Q.Promise<ProjectId> {
        return this.nextId(session, StoredObjectTypes.tasksSection);
    }
    
    projectSectionExists(session: mail.session.Session, projectId: string): boolean {
        // console.log("on projectSectionExists");
        
        let ret = !!this.tasksSectionsCollection[session.hostHash].find(x => x && x.getId() == projectId);
        
        return ret;
    }





    /****************************************
    ************** TaskGroups ***************
    ****************************************/
    fetchAllTaskGroups(): Q.Promise<TaskGroupsMap> {
        return Q.resolve();
    }
    
    getTaskGroups(session: mail.session.Session, taskGroupIds: Array<TaskGroupId>): TaskGroupsMap {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (!taskGroupIds) {
            return this.taskGroups[session.hostHash];
        }
        let res: TaskGroupsMap = {};
        for (let taskGroupId of taskGroupIds) {
            res[taskGroupId] = (taskGroupId in this.taskGroups[session.hostHash] ? this.taskGroups[session.hostHash][taskGroupId] : null);
        }
        return res;
    }
    
    getAllTaskGroupNames(session: mail.session.Session): TaskGroupNamesMap {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        let res: TaskGroupNamesMap = {};
        let taskGroups = this.taskGroups;
        for (let taskGroupId in taskGroups[session.hostHash]) {
            res[taskGroupId] = taskGroups[session.hostHash][taskGroupId].getName();
        }
        return res;
    }
    
    getTaskGroupNames(session: mail.session.Session, taskGroupIds: Array<TaskGroupId>, skipNulls: boolean = false): TaskGroupNamesMap {
        let res: TaskGroupNamesMap = {};
        let taskGroups = this.getTaskGroups(session, taskGroupIds);
        for (let taskGroupId in taskGroups) {
            if (taskGroups[taskGroupId] !== null || !skipNulls) {
                res[taskGroupId] = taskGroups[taskGroupId] !== null ? taskGroups[taskGroupId].getName() : null;
            }
        }
        return res;
    }
    
    getTaskGroup(session: mail.session.Session, taskGroupId: TaskGroupId): TaskGroup {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (taskGroupId in this.taskGroups[session.hostHash]) {
            return this.taskGroups[session.hostHash][taskGroupId];
        }
        return null;
    }
    
    saveTaskGroup(session: mail.session.Session, taskGroup: TaskGroup, version?: number, origElement?: TaskGroup): Q.Promise<void> {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        this.taskGroups[session.hostHash][taskGroup.getId()] = taskGroup;
        return this.ensureKvdbCExists(taskGroup.getProjectId(), session).then(
            () => <any>this.setKvdbElement(session, taskGroup.getProjectId(), "g_" + taskGroup.getId(), taskGroup, version, origElement)
        );
    }
    
    deleteTaskGroup(session: mail.session.Session, taskGroup: TaskGroup, save: boolean = true, onlyTaskGroup: boolean = true): Q.Promise<void> {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (taskGroup.getId() in this.taskGroups[session.hostHash]) {
            let proj = this.getProject(session, taskGroup.getProjectId());
            let tasksToSave: TasksMap = {};
            if (!onlyTaskGroup) {
                // Remove id from project
                if (proj != null) {
                    proj.removeTaskGroupId(taskGroup.getId());
                }

                // Orphanize tasks
                let tasks = this.getTasks(session, taskGroup.getTaskIds());
                for (let taskId in tasks) {
                    let task = tasks[taskId];
                    if (task) {
                        tasksToSave[taskId] = task;
                        if (task.getTaskGroupIds().length == 1) {
                            task.setTaskGroupIds(["__orphans__"]);
                            if (proj != null) {
                                proj.addOrphanedTasksId(task.getId(), true);
                            }
                        }
                        else {
                            task.setTaskGroupIds(task.getTaskGroupIds().filter(id => id != taskGroup.getId()));
                        }
                    }
                }
            }
            delete this.taskGroups[session.hostHash][taskGroup.getId()];
            if (save) {
                let prom = Q();
                prom = prom.then(() => <any>this.ensureKvdbCExists(taskGroup.getProjectId(), session));
                let f0 = () => this.deleteKvdbElement(session, taskGroup.getProjectId(), "g_" + taskGroup.getId());
                prom = prom.then(<any>f0);
                if (!onlyTaskGroup) {
                    let f1 = (): any => this.saveProject(session, proj);
                    prom = prom.then(f1);
                    for (let id in tasksToSave) {
                        let f2 = () => this.saveTask(session, tasksToSave[id]);
                        prom = prom.then(<any>f2);
                    }
                }
                return prom;
            } else {
                return Q.resolve();
            }
        }
        return Q.reject(TasksPlugin.REJECT_REASON_DOES_NOT_EXIST);
    }
    
    nextTaskGroupId(session: mail.session.Session): Q.Promise<TaskGroupId> {
        return this.nextId(session, StoredObjectTypes.tasksList);
    }





    /****************************************
    ***************** Tasks *****************
    ****************************************/
    fetchAllTasks(): Q.Promise<TasksMap> {
        return Q.resolve();
    }
    
    getTasks(session: mail.session.Session, taskIds: Array<TaskId>): TasksMap {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (!taskIds) {
            return this.tasks[session.hostHash];
        }
        let res: TasksMap = {};
        for (let taskId of taskIds) {
            res[taskId] = (taskId in this.tasks[session.hostHash] ? this.tasks[session.hostHash][taskId] : null);
        }
        return res;
    }
    
    getTask(session: mail.session.Session, taskId: TaskId): Task {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (taskId in this.tasks[session.hostHash]) {
            return this.tasks[session.hostHash][taskId];
        }
        return null;
    }
    
    addTask(session: mail.session.Session, task: Task): void {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (!(task.getId() in this.tasks[session.hostHash])) {
            this.tasks[session.hostHash][task.getId()] = task;
        }
        this.sendTaskMessage(session, task, "create-task");
    }
    
    saveTask(session: mail.session.Session, task: Task, version?: number, origElement?: Task): Q.Promise<void> {
        return this.ensureKvdbCExists(task.getProjectId(), session).then(
            () => <any>this.setKvdbElement(session, task.getProjectId(), "t_" + task.getId(), task, version, origElement)
        )
        .then(() => {
            if (!this.app.userPreferences.getAutoMarkAsRead()) {
                this.refreshWatched();
            }
        });
    }
    
    isTaskDone(session: mail.session.Session, taskData: Task | TaskId): boolean {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        let task = typeof (taskData) == "object" ? taskData : this.tasks[session.hostHash][taskData];
        if (task) {
            return task.getStatus() == TaskStatus.DONE;
        }
        return false;
    }
    
    OLDdeleteTask(session: mail.session.Session, task: Task, save: boolean = true): Q.Promise<void> {
        this.sendTaskMessage(session, task, "delete-task");
        if (task.getId() in this.tasks[session.hostHash]) {
            delete this.tasks[session.hostHash][task.getId()];
            if (save) {
                return this.deleteKvdbElement(session, task.getProjectId(), "t_" + task.getId());
            }
            else {
                return Q.resolve();
            }
        }
        return Q.reject(TasksPlugin.REJECT_REASON_DOES_NOT_EXIST);
    }
    
    moveToTrash(session: mail.session.Session, tasks: string[]): Q.Promise<void> {
        return this.toggleTrashed(session, tasks, true);
    }
    
    restoreFromTrash(session: mail.session.Session, tasks: string[]): Q.Promise<void> {
        return this.toggleTrashed(session, tasks, false);
    }
    
    toggleTrashed(session: mail.session.Session, tasks: string[], trashed: boolean): Q.Promise<void> {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        let tasksToSave: Array<TaskId> = [];

        for (let tId of tasks) {
            let t = this.tasks[session.hostHash][tId];
            if (!t) {
                continue;
            }
            tasksToSave.push(t.getId());
            t.setIsTrashed(trashed);
            t.addHistory({
                when: new Date().getTime(),
                who: this.getMyId(session),
                what: trashed ? "trashed" : "restored",
            });
            t.setModifiedBy(this.getMyId(session));
            t.setModifiedDateTime(new Date().getTime());
        }
        return this.saveModified(session, tasksToSave, [], []);
    }
    
    deleteTasks(session: mail.session.Session, tasks: { [key: string]: Array<TaskGroupId> }): Q.Promise<void> {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        let tasksToSave: Array<TaskId> = [];
        let taskGroupsToSave: Array<TaskGroupId> = [];
        let projectsToSave: Array<ProjectId> = [];
        let tasksToDelete: Array<TaskId> = [];
        
        for (let tId in tasks) {
            let fromTaskGroupIds = tasks[tId];
            let t = this.tasks[session.hostHash][tId];
            if (!t) {
                continue;
            }
            
            // Modify task's list of taskgroups, remove from taskgroups/project
            let tgIds = t.getTaskGroupIds();
            fromTaskGroupIds.forEach(tgId => {
                let idx = tgIds.indexOf(tgId);
                if (idx >= 0) {
                    tgIds.splice(idx, 1);
                    if (tgId == "__orphans__") {
                        let pId = t.getProjectId();
                        if (pId in this.projects[session.hostHash]) {
                            this.projects[session.hostHash][pId].removeOrphanedTasksId(tId);
                            if (projectsToSave.indexOf(pId) < 0) {
                                projectsToSave.push(pId);
                            }
                        }
                    }
                    else {
                        if (tgId in this.taskGroups[session.hostHash]) {
                            this.taskGroups[session.hostHash][tgId].removeTaskId(tId);
                            if (taskGroupsToSave.indexOf(tgId) < 0) {
                                taskGroupsToSave.push(tgId);
                            }
                        }
                    }
                }
            });

            // Check if task belongs to any groups
            let fullDelete = tgIds.length == 0;

            // Delete or remove from taskgroups
            if (fullDelete) {
                // Delete
                this.sendTaskMessage(session, t, "delete-task");
                if (tasksToDelete.indexOf(tId) < 0) {
                    tasksToDelete.push(tId);
                }
            }
            else {
                // Remove from taskgroups
                t.setTaskGroupIds(tgIds);
                if (tasksToSave.indexOf(tId) < 0) {
                    tasksToSave.push(tId);
                }
            }
        }

        // Save changes
        return this.saveModified(session, tasksToSave, taskGroupsToSave, projectsToSave).then(() => {
            let prom = Q();
            for (let tId of tasksToDelete) {
                if (!(tId in this.tasks[session.hostHash])) {
                    continue;
                }
                let f = () => {
                    let pId = this.tasks[session.hostHash][tId].getProjectId();
                    delete this.tasks[session.hostHash][tId];
                    return this.deleteKvdbElement(session, pId, "t_" + tId);
                };
                prom = prom.then(<any>f);
            }
            return <any>prom;
        });
    }
    
    deleteTask(session: mail.session.Session, task: Task, fromTaskGroupIds: Array<TaskGroupId> = null): Q.Promise<void> {
        if (!task) {
            return Q.resolve();
        }
        if (fromTaskGroupIds === null) {
            fromTaskGroupIds = task.getTaskGroupIds(true);
        }
        let obj: { [key: string]: Array<TaskGroupId> } = {};
        obj[task.getId()] = fromTaskGroupIds;
        return this.deleteTasks(session, obj);
    }
    
    nextTaskId(session: mail.session.Session): Q.Promise<TaskId> {
        return this.nextId(session, StoredObjectTypes.tasksTask);
    }

    sendTaskMessage(session: mail.session.Session, task: Task, type: "create-task" | "delete-task" | "modify-task"): void {
        let chatModule = session.sectionManager.getSection(task.getProjectId()).getChatModule();
        if (!chatModule) {
            return;
        }
        chatModule.sendTaskMessage(
            type,
            this.getMyId(session),
            task.getId(),
            "#" + task.getId().substr(0, 5),
            task.getName(),
            task.getDescription(),
            <string>task.getStatus(),
            this.app.localeService.i18n("plugin.tasks.status-" + task.getStatus()),
            Task.getStatuses().length,
            Task.getLabelClass(task.getStatus()),
            task.getPriority(),
            task.getAssignedTo(),
        )
        .then(() => {
            return;
        })
        .fail((err: any) => Logger.error("Error sending task message", err));
    }

    sendTaskCommentMessage(session: mail.session.Session, task: Task, comment: string, metaDataStr?: string): Q.Promise<privfs.types.message.ReceiverData> {
        let chatModule = session.sectionManager.getSection(task.getProjectId()).getChatModule();
        if (!chatModule) {
            return;
        }
        return Q().then(() => {
            return (<any>chatModule).sendTaggedJsonMessage(
                {
                    data: {
                        type: "task-comment",
                        who: this.getMyId(session),
                        id: task.getId(),
                        label: "#" + task.getId().substr(0, 5),
                        comment: comment,
                        status: task.getStatus(),
                        statusLocaleName: this.app.localeService.i18n("plugin.tasks.status-" + task.getStatus()),
                        numOfStatuses: Task.getStatuses().length,
                        statusColor: Task.getLabelClass(task.getStatus()),
                        metaDataStr: metaDataStr,
                    }
                },
                ["taskid:" + task.getId()]
            )
            .then((result: Q.Promise<privfs.types.message.ReceiverData>) => {
                return result;
            })
            .fail((err: any) => Logger.error("Error sending task comment message", err));
        })

    }

    setUnreadTasksCount(value: number): void {
        //this.log("setUnreadTasksCount",value);
        this.unreadTasks = value;
        this.tasksUnreadCountModel.setWithCheck(this.unreadTasks);
    }
    
    // log(...args: any[]): void {
    //     require("fs").appendFileSync("/home/wp/privmx-log.txt", "\n" + JSON.stringify(args) + "\n");
    // }
    
    getUnreadTasksCount(): number {
        return this.unreadTasks;
    }

    addUnreadTaskToCount(): void {
        this.unreadTasks++;
        this.tasksUnreadCountModel.setWithCheck(this.unreadTasks);
    }
    delUnreadTaskFromCount(): void {
        this.unreadTasks--;
        this.tasksUnreadCountModel.setWithCheck(this.unreadTasks);
    }

    markTaskAsWatched(session: mail.session.Session, taskId: TaskId, _sectionId: string) {
        this.markTasksAsWatched(session, [taskId]);
    }

    markTasksAsWatched(session: mail.session.Session, taskIds: Array<TaskId>): Q.Promise<void> {
        // this.log("mark", session.hostHash, taskIds)
        // console.log("markTasksAsWatched")
        for (let taskId of taskIds) {
            if (!taskId) {
                continue;
            }
            let t = this.tasks[session.hostHash][taskId];
            let sectionId = t.getProjectId();
            if (!(sectionId in this.watchedTasksHistory[session.hostHash])) {
                this.watchedTasksHistory[session.hostHash][sectionId] = {};
            }
            let tFromHistory = this.watchedTasksHistory[session.hostHash][sectionId][taskId];
            if ((t && tFromHistory && t.getModifiedDateTime() > tFromHistory.lastWatched) || !tFromHistory) {
                let watchedElement = { id: taskId, sectionId: sectionId, lastWatched: new Date().getTime() };
                this.watchedTasksHistory[session.hostHash][sectionId][taskId] = watchedElement;
                for (let handler of this.onWatchedTasksHistorySetHandlers) {
                    handler(session.hostHash, sectionId, taskId, watchedElement);
                }
                this.writeWatchedTasksHistory(session, sectionId, watchedElement);
            }
        }
        this.refreshWatched();
        return Q();
    }
    
    markTaskAsNotWatched(session: mail.session.Session, taskId: TaskId, _sectionId: string) {
        this.markTasksAsNotWatched(session, [taskId]);
    }
    
    markTasksAsNotWatched(session: mail.session.Session, taskIds: Array<TaskId>): Q.Promise<void> {
        for (let taskId of taskIds) {
            if (!taskId) {
                continue;
            }
            let t = this.tasks[session.hostHash][taskId];
            let sectionId = t.getProjectId();
            if (!(sectionId in this.watchedTasksHistory[session.hostHash])) {
                this.watchedTasksHistory[session.hostHash][sectionId] = {};
            }
            if (sectionId in this.watchedTasksHistory[session.hostHash] && this.watchedTasksHistory[session.hostHash][sectionId][taskId]) {
                let watchedElement = {id: taskId, sectionId: sectionId, lastWatched: 0};
                this.watchedTasksHistory[session.hostHash][sectionId][taskId] = watchedElement;
                for (let handler of this.onWatchedTasksHistorySetHandlers) {
                    handler(session.hostHash, sectionId, taskId, watchedElement);
                }
                this.writeWatchedTasksHistory(session, sectionId, watchedElement);
            }
        }
        this.refreshWatched();
        return Q();
    }
    
    updateWatchedStatus(session: mail.session.Session, entry: WatchedTaskItem): void {
        let taskId = entry.id;
        let sectionId = entry.sectionId;
        let lastWatched = entry.lastWatched;
        let t = this.tasks[session.hostHash][taskId];

        if (t) {
            // console.log("task exists");
            if (!(sectionId in this.watchedTasksHistory[session.hostHash])) {
                this.watchedTasksHistory[session.hostHash][sectionId] = {};
            }
            let old = this.watchedTasksHistory[session.hostHash][sectionId][taskId];
            if (old && old.id == taskId && old.sectionId == sectionId && old.lastWatched >= lastWatched) {
                return;
            }
            this.watchedTasksHistory[session.hostHash][sectionId][taskId] = entry;
            this.refreshWatched();
            this.app.dispatchEvent<UpdateSectionBadgeEvent>({
                type: "update-section-badge",
                sectionId: sectionId,
                hostHash: session.hostHash,
            });
            for (let handler of this.onWatchedTasksHistorySetHandlers) {
                handler(session.hostHash, sectionId, taskId, this.watchedTasksHistory[session.hostHash][sectionId][taskId]);
            }
        }
    }

    readWatchedTasksHistory(session: mail.session.Session, sectionId: string): Q.Promise<void> {
        return Q().then(() => {
            let localSession = this.app.sessionManager.getLocalSession();
            let proms = [
                session.hostHash == localSession.hostHash ? this.settingsStorage.getArray(sectionId) : Q([]),
                this.settingsStorage.getArray(session.hostHash + "-" + sectionId),
            ];
            return Q.all(proms);
        })
        .then(([backCompatHistory, newHistory]) => {
            // Backwards compatibility: merge histories
            let historyByTaskId: { [taskId: string]: WatchedTaskItem } = {};
            for (let _arr of [backCompatHistory, newHistory]) {
                let arr = <WatchedTaskItem[]>_arr;
                for (let it of arr) {
                    if (!(it.id in historyByTaskId) || it.lastWatched > historyByTaskId[it.id].lastWatched) {
                        historyByTaskId[it.id] = it;
                    }
                }
            }
            let history: WatchedTaskItem[] = [];
            for (let tId in historyByTaskId) {
                history.push(historyByTaskId[tId]);
            }
            
            if (!this.watchedTasksHistory[session.hostHash]) {
                this.watchedTasksHistory[session.hostHash] = {};
            }
            this.watchedTasksHistory[session.hostHash][sectionId] = {};
            history.forEach((x: any) => this.watchedTasksHistory[session.hostHash][sectionId][x.id] = x);
            for (let handler of this.onWatchedTasksHistoryRebuildHandlers) {
                handler(session.hostHash, sectionId);
            }
            return;
        });
    }

    writeWatchedTasksHistory(session: mail.session.Session, sectionId: string, task: WatchedTaskItem): Q.Promise<void> {
        return Q().then(() => {
            return this.settingsStorage.setValue(session.hostHash + "-" + sectionId, [task]);
        })
        .then(() => {
            // Version pre-18 compatibility
            if (session.sessionType == "local") {
                return this.settingsStorage.setValue(sectionId, [task]);
            }

        })
    }

    refreshWatched(): void {
        if (this.preventRefreshWatched) {
            return;
        }
        let unreadCount: number = 0;
        for (let session of this.getReadySessions()) {
            let muted = this.getMutedInfoSingleSession(session);
            for (let tId in this.tasks[session.hostHash]) {
                let t = this.tasks[session.hostHash][tId];
                let section = session.sectionManager.getSection(t.getProjectId());
                if (!section) {
                    continue;
                }
                let isDisabled = section && !section.isKvdbModuleEnabled();
                if ((!muted[t.getProjectId()]) && !isDisabled && this.wasTaskUnread(session, t, t.getProjectId())) {
                    unreadCount++;
                }
                else if ((!muted[t.getProjectId()]) && !section && this.wasTaskUnread(session, t, t.getProjectId())) {
                    unreadCount++;
                }

            }
        }
        this.setUnreadTasksCount(unreadCount);
    }
    
    wasTaskUnread(session: mail.session.Session, t: Task, sectionId: string): boolean {
        return t.wasUnread(sectionId, this.watchedTasksHistory[session.hostHash], this.getMyId(session));
    }
    
    isUnread(session: mail.session.Session, taskId: TaskId): boolean {
        let task = this.tasks[session.hostHash][taskId];
        return task && this.wasTaskUnread(session, task, task.getProjectId());
    }
    
    toggleRead(session: mail.session.Session, taskId: TaskId): void {
        let task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return;
        }
        if (this.isUnread(session, taskId)) {
            this.markTaskAsWatched(session, task.getId(), task.getProjectId());
        }
        else {
            this.markTaskAsNotWatched(session, task.getId(), task.getProjectId());
        }
    }
    
    getUnread(session: mail.session.Session, assignedToMe: boolean = false, createdByMe: boolean = false, skipMuted: boolean = false, trashed: boolean = false): number {
        let unread = 0;
        let muted = this.getMutedInfoSingleSession(session);
        for (let pId in this.projects[session.hostHash]) {
            if (skipMuted && muted[pId]) {
                continue;
            }
            unread += this.getUnreadForSection(session, pId, assignedToMe, createdByMe, trashed);
        }
        return unread;
    }

    getUnreadForSection(session: mail.session.Session, sectionId: string, assignedToMe: boolean = false, createdByMe: boolean = false, trashed: boolean = false): number {
        let unread: number = 0;

        for (let tId in this.tasks[session.hostHash]) {
            let t = this.tasks[session.hostHash][tId];
            if (trashed != t.getIsTrashed()) {
                continue;
            }
            if (t && assignedToMe && !t.isAssignedTo(this.getMyId(session))) {
                continue;
            }
            if (t && createdByMe && t.getCreatedBy() != this.getMyId(session)) {
                continue;
            }
            if (this.wasTaskUnread(session, t, sectionId)) {
                unread++;
            }
        }

        return unread;
    }

    getUnreadForConv2Section(session: mail.session.Session, sectionId: string, skipMuted: boolean = false): number {
        let unread: number = 0;
        let users = this.getConv2Users(session, sectionId, true);
        let muted = this.getMutedInfo(session);
        
        for (let tId in this.tasks[session.hostHash]) {
            let t = this.tasks[session.hostHash][tId];
            if (!t || !this.isAssignedToUsers(t, users) || t.getIsTrashed()) {
                continue;
            }
            if ((!skipMuted || !muted[session.hostHash][t.getProjectId()]) && this.wasTaskUnread(session, t, t.getProjectId())) {
                unread++;
            }
        }
        return unread;
    }

    getMutedInfo(session: mail.session.Session): { [hostHash: string]: { [id: string]: boolean } } {
        let info: { [hostHash: string]: { [id: string]: boolean } } = {};
        for (let hostHash in this.app.sessionManager.sessions) {
            info[hostHash] = {};
        }
        if (this.tasksSectionsCollectionNoPrivate && session.hostHash in this.tasksSectionsCollectionNoPrivate) {
            for (let section of this.tasksSectionsCollectionNoPrivate[session.hostHash].list) {
                info[session.hostHash][section.getId()] = section.userSettings.mutedModules.tasks;
            }
        }
        return info;
    }
    
    getMutedInfoSingleSession(session: mail.session.Session): { [id: string]: boolean } {
        let muted = this.getMutedInfo(session);
        if (session.hostHash in muted) {
            return muted[session.hostHash];
        }
        return {};
    }

    isMuted(session: mail.session.Session, id: string): boolean {
        let section = this.tasksSectionsCollectionNoPrivate[session.hostHash].find(x => x.getId() == id);
        if (section && section.userSettings.mutedModules.tasks) {
            return true;
        }
        return false;
    }

    isAssignedToUsers(task: Task, users: string[]): boolean {
        let arr = task.getAssignedTo();
        for (let u of users) {
            if (arr.indexOf(u) < 0) {
                return false;
            }
        }
        return true;
    }

    markAllAsRead(session: mail.session.Session, projectId: string = CustomTasksElements.ALL_TASKS_ID): Q.Promise<void> {
        let isConv2 = this.isConv2Project(projectId);
        let allProjects = projectId == CustomTasksElements.ALL_TASKS_ID || projectId == CustomTasksElements.TRASH_ID || projectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || projectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID || isConv2 || projectId == CustomTasksElements.ALL_TASKS_INC_TRASHED_ID;
        let tasksAssignedToMe = projectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
        let tasksCreatedByMe = projectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID;
        let isTrashed = projectId == CustomTasksElements.TRASH_ID;
        let users = isConv2 ? this.getConv2Users(session, projectId, true) : [];
        let skipTrashedCheck = projectId == CustomTasksElements.ALL_TASKS_INC_TRASHED_ID;

        let ids: Array<TaskId> = [];
        for (let tId in this.tasks[session.hostHash]) {
            let t = this.tasks[session.hostHash][tId];
            if (t) {
                if (!allProjects && t.getProjectId() != projectId) {
                    continue;
                }
                if (tasksAssignedToMe && !t.isAssignedTo(this.getMyId(session))) {
                    continue;
                }
                if (tasksCreatedByMe && t.getCreatedBy() != this.getMyId(session)) {
                    continue;
                }
                if (isConv2 && !this.isAssignedToUsers(t, users)) {
                    continue;
                }
                if (!skipTrashedCheck && isTrashed != t.getIsTrashed()) {
                    continue;
                }
            }
            ids.push(tId);
        }
        return this.markTasksAsWatched(session, ids);
    }

    onWatchedTasksHistoryRebuild(handler: (hostHash: HostHash, pId: ProjectId) => void): void {
        this.onWatchedTasksHistoryRebuildHandlers.push(handler);
    }

    onWatchedTasksHistorySet(handler: (hostHash: HostHash, pId: ProjectId, tId: TaskId, it: WatchedTaskItem) => void): void {
        this.onWatchedTasksHistorySetHandlers.push(handler);
    }
    
    offWatchedTasksHistoryRebuild(handler: (hostHash: string, pId: ProjectId) => void): void {
        let idx = this.onWatchedTasksHistoryRebuildHandlers.indexOf(handler);
        if (idx >= 0) {
            this.onWatchedTasksHistoryRebuildHandlers.splice(idx, 1);
        }
    }
    
    offWatchedTasksHistorySet(handler: (hostHash: string, pId: ProjectId, tId: TaskId, it: WatchedTaskItem) => void): void {
        let idx = this.onWatchedTasksHistorySetHandlers.indexOf(handler);
        if (idx >= 0) {
            this.onWatchedTasksHistorySetHandlers.splice(idx, 1);
        }
    }
    
    openEditTaskWindow(session: mail.session.Session, taskId: TaskId, editMode: boolean = false, scrollToComments: boolean = false) : void {
        if (!this.bringWindowToFront(TaskWindowController.getWindowId(session, taskId))) {
            this.app.ioc.create(TaskWindowController, <any>[this.app, session, taskId, editMode, null, [], [], [], scrollToComments]).then(win => {
                this.app.openChildWindow(win);
            });
        }
    }

    openNewTaskWindow(session: mail.session.Session, section: Mail.mail.section.SectionService | false, attachments: Mail.mail.section.OpenableSectionFile[] = [], handle: privfs.fs.descriptor.Handle = null, dateTime: Date = null, assignTo: string[] = [], wholeDay?: boolean) {
        let project = section != null && section != false ? this.projects[session.hostHash][section.getId()] : null;
        if (project == null && section !== false) {
            let privateSection = session.sectionManager.getMyPrivateSection();
            if (privateSection) {
                project = this.projects[session.hostHash][privateSection.getId()];
                project.setName(this.app.localeService.i18n("plugin.tasks.privateTasks"));
            }
        }
        let def = Q.defer<string>();
        if (!this.bringWindowToFront(TaskWindowController.getWindowId(session, null))) {
            this.app.ioc.create(<any>TaskWindowController, <any>[this.app, session, null, true, project, ["__orphans__"], attachments, assignTo, false, true, dateTime, wholeDay]).then((win: any) => {
                win.setHandle(handle);
                this.app.openChildWindow(win);
                win.onTaskCreated((taskId: string) => {
                    def.resolve(taskId);
                });
                win.onCancelled(() => {
                    def.reject();
                });
            });
        }
        else {
            let wnd = this.openedWindows[TaskWindowController.getWindowId(session, null)];
            if (wnd instanceof TaskWindowController) {
                wnd.ensureHasDateTime(dateTime)
                wnd.onTaskCreated((taskId: string) => {
                    def.resolve(taskId);
                });
                wnd.onCancelled(() => {
                    def.reject();
                });
            }
        }
        return def.promise;
    }

    attachToTask(session: mail.session.Session, taskId: string, file: mail.section.OpenableSectionFile, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        let task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return;
        }
        let did = file.handle.descriptor.ref.did;
        for (let attStr of task.getAttachments()) {
            let att = JSON.parse(attStr);
            if (att.did == did) {
                return;
            }
        }
        if (file && file.section && file.section.getId() != task.getProjectId()) {
            return this.uploadAsAttachment(session, file, taskId);
        }
        let now = new Date().getTime();
        let newAtt = AttachmentsManager.createAttachmentInfoStringFromOpenableSectionFile(file);
        task.addAttachment(newAtt);
        task.setModifiedBy(this.getMyId(session));
        task.setModifiedDateTime(now);
        task.addHistory({
            when: now,
            who: this.getMyId(session),
            what: "added",
            arg: "attachment",
            newVal: newAtt,
        })
        return Q.all([
            this.saveTask(session, task),
            this.addMetaBindedTaskId(file.fileSystem, file.path, taskId, handle),
        ])
        .then(() => {
            this.triggerFileAttached(session, file.handle.ref.did, taskId);
        });
    }

    uploadAsAttachment(session: mail.session.Session, file: app.common.shelltypes.OpenableElement, taskId: string): Q.Promise<void> {
        let task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return Q();
        }
        let section = session.sectionManager.getSection(task.getProjectId());
        if (!section) {
            return Q();
        }
        return Q().then(() => {
            return file.getContent();
        })
            .then(cnt => {
                return section.uploadFile({
                    data: cnt,
                    path: "/",
                });
            })
            .then(result => {
                if (result && result.openableElement) {
                    this.attachToTask(session, taskId, <mail.section.OpenableSectionFile>result.openableElement, null);
                }
            });
    }

    updateMeta(fileSystem: privfs.fs.file.FileSystem, path: string, handle: privfs.fs.descriptor.Handle, func: any): Q.Promise<void> {
        if (handle && handle.canWrite) {
            return handle.updateMeta({
                metaUpdater: func,
            }).thenResolve(null);
        }
        else {
            return fileSystem.updateMeta(path, func).thenResolve(null);
        }
    }

    addMetaBindedTaskId(fileSystem: privfs.fs.file.FileSystem, path: string, taskId: string, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        return this.updateMeta(fileSystem, path, handle, (meta: any) => this._metaUpdaterAdder(meta, taskId));
    }

    removeMetaBindedTaskId(fileSystem: privfs.fs.file.FileSystem, path: string, taskId: string, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        return this.updateMeta(fileSystem, path, handle, (meta: any) => this._metaUpdaterRemover(meta, taskId));
    }

    addMetaBindedTaskIdOSF(file: mail.section.OpenableSectionFile, taskId: string, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        return this.addMetaBindedTaskId(file.fileSystem, file.path, taskId, handle);
    }

    removeMetaBindedTaskIdOSF(file: mail.section.OpenableSectionFile, taskId: string, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        return this.removeMetaBindedTaskId(file.fileSystem, file.path, taskId, handle);
    }

    _metaUpdaterAdder(meta: privfs.types.descriptor.Meta, taskId: string): void {
        let bindedData: { taskIds: string[] } = JSON.parse(this.convertBindedTaskId(meta.bindedElementId));
        let bindedTaskIds: string[] = bindedData.taskIds;
        if (bindedTaskIds.indexOf(taskId) < 0) {
            bindedTaskIds.push(taskId);
        }
        meta.bindedElementId = JSON.stringify(bindedData);
    }

    _metaUpdaterRemover(meta: privfs.types.descriptor.Meta, taskId: string): void {
        let bindedData: { taskIds: string[] } = JSON.parse(this.convertBindedTaskId(meta.bindedElementId));
        let bindedTaskIds: string[] = bindedData.taskIds;
        let idx = bindedTaskIds.indexOf(taskId);
        if (idx >= 0) {
            bindedTaskIds.splice(idx, 1);
        }
        meta.bindedElementId = JSON.stringify(bindedData);
    }












    removeTaskFromTaskGroup(session: mail.session.Session, task: Task, taskGroupId: TaskGroupId, tasksToSave: Array<TaskId> = null, taskGroupsToSave: Array<TaskGroupId> = null, projectsToSave: Array<ProjectId> = null) {
        let taskId = task.getId();
        let projectId = task.getProjectId();
        let orph = taskGroupId == "__orphans__";
        if (taskGroupId in this.taskGroups[session.hostHash] || (orph && projectId in this.projects[session.hostHash])) {
            task.removeTaskGroupId(taskGroupId);
            if (orph) {
                this.projects[session.hostHash][projectId].removeOrphanedTasksId(taskId);
            }
            else {
                this.taskGroups[session.hostHash][taskGroupId].removeTaskId(taskId);
            }

            if (orph && projectId && projectsToSave && projectsToSave.indexOf(projectId) < 0) {
                projectsToSave.push(projectId);
            }
            if (!orph && taskGroupsToSave && taskGroupsToSave.indexOf(taskGroupId) < 0) {
                taskGroupsToSave.push(taskGroupId);
            }
            if (tasksToSave && tasksToSave.indexOf(taskId) < 0) {
                tasksToSave.push(taskId);
            }
        }
    }

    addTaskToTaskGroup(session: mail.session.Session, task: Task, taskGroupId: TaskGroupId, tasksToSave: Array<TaskId> = null, taskGroupsToSave: Array<TaskGroupId> = null, projectsToSave: Array<ProjectId> = null) {
        let taskId = task.getId();
        let projectId = task.getProjectId();
        let orph = taskGroupId == "__orphans__";
        if (taskGroupId in this.taskGroups[session.hostHash] || (orph && projectId in this.projects[session.hostHash])) {
            task.addTaskGroupId(taskGroupId, true);
            if (orph) {
                this.projects[session.hostHash][projectId].addOrphanedTasksId(taskId, true);
            }
            else {
                this.taskGroups[session.hostHash][taskGroupId].addTaskId(taskId, true);
            }

            if (orph && projectId && projectsToSave && projectsToSave.indexOf(projectId) < 0) {
                projectsToSave.push(projectId);
            }
            if (!orph && taskGroupsToSave && taskGroupsToSave.indexOf(taskGroupId) < 0) {
                taskGroupsToSave.push(taskGroupId);
            }
            if (tasksToSave && tasksToSave.indexOf(taskId) < 0) {
                tasksToSave.push(taskId);
            }
        }
    }

    moveTasks(session: mail.session.Session, fullTaskIdsRaw: Array<string>, dstTaskGroupIdsRaw: TaskGroupId[], rmFromAllCurrent: boolean = false, onGotCountsToUpdate: (numTasksToSave: number, numTaskGroupsToSave: number, numProjectsToSave: number) => void = null): Q.Promise<void> {
        let fullTaskIds = this.parseFullTaskIds(fullTaskIdsRaw);
        let dstTaskGroupIds = dstTaskGroupIdsRaw && dstTaskGroupIdsRaw.length > 0 ? dstTaskGroupIdsRaw : ["__orphans__"];
        dstTaskGroupIds = dstTaskGroupIds.map(x => x ? x : "__orphans__");
        let orphanizedBlackList: Array<TaskId> = [];
        let tasksToSave: Array<TaskId> = [];
        let taskGroupsToSave: Array<TaskGroupId> = [];
        let projectsToSave: Array<ProjectId> = [];
        let now = new Date().getTime();
        let myId = this.getMyId(session);
        let toOrphans = dstTaskGroupIds.indexOf("__orphans__") >= 0;

        // For each task to move
        for (let [srcTaskGroupId, taskId] of fullTaskIds) {
            if (!(taskId in this.tasks[session.hostHash]) || orphanizedBlackList.indexOf(taskId) >= 0) {
                continue;
            }

            // If orphanizing, make sure actions in this loop are executed only once for each task
            if (toOrphans) {
                orphanizedBlackList.push(taskId);
            }

            let task = this.tasks[session.hostHash][taskId];
            let task_tgIds = this.sanitizeTaskGroupIds(task.getTaskGroupIds());
            let modified = false;

            // Check if the task is being moved to orphans
            if (toOrphans) {
                // Moving to orphans - remove the task from all non-orphan groups
                for (let tgId of task_tgIds) {
                    if (tgId != "__orphans__") {
                        this.removeTaskFromTaskGroup(session, task, tgId, tasksToSave, taskGroupsToSave, projectsToSave);
                    }
                }
            }

            // Remove from src if required
            if (dstTaskGroupIds.indexOf(srcTaskGroupId) < 0) {
                this.removeTaskFromTaskGroup(session, task, srcTaskGroupId, tasksToSave, taskGroupsToSave, projectsToSave);
                modified = true;
            }
            if (rmFromAllCurrent) {
                for (let tgId of task.getTaskGroupIds()) {
                    if (dstTaskGroupIds.indexOf(tgId) < 0) {
                        this.removeTaskFromTaskGroup(session, task, tgId, tasksToSave, taskGroupsToSave, projectsToSave);
                        modified = true;
                    }
                }
            }

            for (let dstTaskGroupId of dstTaskGroupIds) {
                let alreadyInDst = task_tgIds.indexOf(dstTaskGroupId) >= 0;

                // If the task is not in the dst group, add it
                if (!alreadyInDst) {
                    this.addTaskToTaskGroup(session, task, dstTaskGroupId, tasksToSave, taskGroupsToSave, projectsToSave);
                    modified = true;
                }
            }

            // If modified, add history entry
            if (modified) {
                task.addHistory({
                    when: now,
                    who: myId,
                    what: "moved",
                    oldVal: task_tgIds,
                    newVal: task.getTaskGroupIds(true),
                });
                task.setModifiedBy(myId);
                task.setModifiedDateTime(now);
            }
        }

        if (onGotCountsToUpdate) {
            onGotCountsToUpdate(tasksToSave.length, taskGroupsToSave.length, projectsToSave.length);
        }

        // Save
        return this.saveModified(session, tasksToSave, taskGroupsToSave, projectsToSave);
    }

    duplicateTasks(session: mail.session.Session, fullTaskIdsRaw: Array<string>, dstTaskGroupIdRaw: TaskGroupId): Q.Promise<void> {
        let fullTaskIds = this.parseFullTaskIds(fullTaskIdsRaw);
        let dstTaskGroupId = dstTaskGroupIdRaw ? dstTaskGroupIdRaw : "__orphans__";
        let tasksToSave: Array<TaskId> = [];
        let taskGroupsToSave: Array<TaskGroupId> = [];
        let projectsToSave: Array<ProjectId> = [];
        let now = new Date().getTime();
        let myId = this.getMyId(session);
        let prom = Q();

        // For each task to duplicate
        for (let [, taskId] of fullTaskIds) {
            if (!(taskId in this.tasks[session.hostHash])) {
                continue;
            }

            // Get task, duplicate it, clean history, add "created" history entry, clear taskgroup ids
            let task = this.tasks[session.hostHash][taskId];
            let task2 = new Task(JSON.parse(JSON.stringify(task)));
            DataMigration.setVersion(task2);
            task2.setHistory([]);
            task2.addHistory({
                when: now,
                who: myId,
                what: "created",
            });
            task2.setTaskGroupIds([]);
            task2.setCreatedBy(myId);
            task2.setCreatedDateTime(now);
            task2.setModifiedBy(myId);
            task2.setModifiedDateTime(now);

            // Obtain new task id and save the new task
            prom = prom.then(() => <any>this.nextTaskId(session).then(
                id => {
                    task2.setId(id);
                    this.addTask(session, task2);
                    this.addTaskToTaskGroup(session, task2, dstTaskGroupId, tasksToSave, taskGroupsToSave, projectsToSave);
                }
            ));
        }

        // Save
        return prom.then(() => {
            this.saveModified(session, tasksToSave, taskGroupsToSave, projectsToSave);
        });
    }

    projectsMatch(session: mail.session.Session, fullTaskIdsRaw: Array<string>, taskGroupId: TaskGroupId, altProjectId: string): boolean {
        let fullTaskIds = this.parseFullTaskIds(fullTaskIdsRaw);
        let pId = altProjectId;
        if (taskGroupId && taskGroupId != "__orphans__" && taskGroupId != "null") {
            if (!(taskGroupId in this.taskGroups[session.hostHash])) {
                return false;
            }
            pId = this.taskGroups[session.hostHash][taskGroupId].getProjectId();
        }
        for (let [, tId] of fullTaskIds) {
            if (!(tId in this.tasks[session.hostHash]) || this.tasks[session.hostHash][tId].getProjectId() != pId) {
                return false;
            }
        }
        return true;
    }

    askDeleteTasks(session: mail.session.Session, fullTaskIdsRaw: Array<string>, moveToTrash: boolean, confirmExFunc: (options: MsgBoxOptions) => Q.Promise<MsgBoxResult>): Q.Promise<{ deleted: boolean, fullDelete: boolean }> {
        let unknownSelection = fullTaskIdsRaw.length == 1 && (fullTaskIdsRaw[0].indexOf("/") < 0);
        let fullTaskIds = unknownSelection ? [[null, fullTaskIdsRaw[0]]] : this.parseFullTaskIds(fullTaskIdsRaw);
        if (fullTaskIdsRaw.length >= 1 && fullTaskIdsRaw[0].substr(0, 21) == "__recently_modified__") {
            unknownSelection = true;
        }
        let def = Q.defer<{ deleted: boolean, fullDelete: boolean }>();
        let op = moveToTrash ? "moveToTrash" : "delete";
        confirmExFunc({
            height: 170,
            message: this.app.localeService.i18n("plugin.tasks.confirm." + op + (fullTaskIdsRaw.length > 1 ? ".multi" : "")),
            yes: {
                visible: true,
                label: this.app.localeService.i18n("plugin.tasks.button.yes"),
                btnClass: "btn-warning",
                faIcon: "trash",
            },
            no: {
                visible: true,
                label: this.app.localeService.i18n("plugin.tasks.button.no"),
                faIcon: "check",
            },
        }).then(result => {
            if (result.result != "yes") {
                def.resolve({ deleted: false, fullDelete: false });
                return;
            }

            // let delAll: boolean = unknownSelection ? true : result.checked;
            let delAll: boolean = true;

            // Collect taskgroups for each task
            let nDel = 0;
            let data: { [key: string]: Array<TaskGroupId> } = {};
            if (delAll) {
                // All taskgroups that contain the task
                for (let [, tId] of fullTaskIds) {
                    if (!(tId in data) && tId in this.tasks[session.hostHash]) {
                        data[tId] = this.tasks[session.hostHash][tId].getTaskGroupIds(true);
                        nDel++;
                    }
                }
            }
            else {
                // Only taskgroups in fullTaskIdsRaw
                for (let [tgId, tId] of fullTaskIds) {
                    if (tId in this.tasks[session.hostHash]) {
                        if (!(tId in data)) {
                            data[tId] = [];
                        }
                        if (data[tId].indexOf(tgId) < 0) {
                            data[tId].push(tgId);
                            nDel++;
                        }
                    }
                }
            }

            def.notify(nDel);

            // Perform deletion
            if (moveToTrash) {
                let dataArr = [];
                for (let tId in data) {
                    dataArr.push(tId);
                }
                this.moveToTrash(session, dataArr);
            }
            else {
                this.deleteTasks(session, data);
            }

            def.resolve({ deleted: true, fullDelete: delAll });
        });
        return def.promise;
    }

    sanitizeTaskGroupIds(ids: Array<TaskGroupId>): Array<TaskGroupId> {
        let res: Array<TaskGroupId> = [];
        let inOrphans = (ids.filter(id => (id == "" || id == null || id == undefined || id == "__orphans__")).length > 0);
        for (let id of ids) {
            if (inOrphans && id && id != "__orphans__") {

            }
            res.push(id ? id : "__orphans__");
        }
        return res;
    }

    saveModified(session: mail.session.Session, tasks: Array<TaskId>, taskGroups: Array<TaskGroupId>, projects: Array<ProjectId>): Q.Promise<void> {
        let prom = Q();
        for (let id of projects) {
            let f = () => this.saveProject(session, this.projects[session.hostHash][id]);
            prom = prom.then(<any>f);
        }
        for (let id of taskGroups) {
            let f = () => this.saveTaskGroup(session, this.taskGroups[session.hostHash][id]);
            prom = prom.then(<any>f);
        }
        for (let id of tasks) {
            let f = () => this.saveTask(session, this.tasks[session.hostHash][id]);
            prom = prom.then(<any>f);
        }
        return prom;
    }

    changeTaskGroupPinned(session: mail.session.Session, projectId: ProjectId, taskGroupId: TaskGroupId, pinned: boolean): void {
        let proj = this.projects[session.hostHash][projectId];
        if (!proj) {
            return;
        }
        if (pinned) {
            proj.addPinnedTaskGroupId(taskGroupId, true);
        }
        else {
            proj.removePinnedTaskGroupId(taskGroupId);
        }
        this.app.dispatchEvent<UpdatePinnedTaskGroupsEvent>({
            type: "update-pinned-taskgroups",
            sectionId: projectId,
            listId: taskGroupId,
            pinned: pinned,
            hostHash: session.hostHash,
        });
        this.saveProject(session, proj);
    }

    changeTaskPinned(session: mail.session.Session, taskId: TaskId, taskGroupId: TaskGroupId, pinned: boolean): Q.Promise<void> {
        let t = this.tasks[session.hostHash][taskId];
        if (!t) {
            return Q();
        }
        if (pinned) {
            t.addPinnedInTaskGroupId(taskGroupId, true);
        }
        else {
            t.removePinnedInTaskGroupId(taskGroupId);
        }
        return this.saveTask(session, t);
    }

    protected parseFullTaskIds(fullTaskIds: Array<string>): Array<[TaskGroupId, TaskId]> {
        let ret: Array<[TaskGroupId, TaskId]> = [];
        for (let fullTaskId of fullTaskIds) {
            let [srcTaskGroupId, taskId] = fullTaskId.split("/");
            ret.push([srcTaskGroupId, taskId ? taskId : "__orphans__"]);
        }
        return ret;
    }


    searchStr: string = "";
    searchTotalCount: number;
    searchCounts: { [hostHash: string]: { [key: string]: number } } = {};
    searchCountsModified: { [hostHash: string]: { [key: string]: boolean } } = {};

    setupSearch() {
        this.searchCounts = this._makeZeroSearchCountsObject();
        this.tasksFilterUpdater = new TasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = () => {
            this.updateSearchFilter(this.tasksFilterUpdater.filter);
        }
        this.app.searchModel.changeEvent.add(this.onFilterTasks.bind(this), "multi");
    }

    onFilterTasks() {
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    }

    updateSearchFilter(data: TasksFilterData): void {
        let searchStr = data.visible ? data.value : "";
        this.updateSearch(searchStr);
    }

    updateSearch(searchStr: string) {
        let sessions: mail.session.Session[] = this.getReadySessions();
        this.searchStr = searchStr;
        let newSearchCounts: { [hostHash: string]: { [key: string]: number } } = this._makeZeroSearchCountsObject();
        if (searchStr != "") {
            // C2S users cache
            let usersCache: { [hostHash: string]: { [id: string]: string[] } } = {};
            for (let session of sessions) {
                usersCache[session.hostHash] = {};
                for (let c2s of session.conv2Service.collection.list) {
                    usersCache[session.hostHash][c2s.id] = this.getConv2Users(session, c2s, true);
                }
            }

            // Search
            for (let session of sessions) {
                if (!(this.tasks[session.hostHash])) {
                    continue;
                }
                for (let taskId in this.tasks[session.hostHash]) {
                    let task = this.tasks[session.hostHash][taskId];
                    if (task.getProjectId() in newSearchCounts[session.hostHash]) {
                        let matches = this.tasks[session.hostHash][taskId].matchesSearchString(searchStr);
                        if (matches) {
                            newSearchCounts[session.hostHash][task.getProjectId()]++;
                            if (task.getIsTrashed()) {
                                newSearchCounts[session.hostHash][CustomTasksElements.TRASH_ID]++;
                            }
                            else {
                                newSearchCounts[session.hostHash][CustomTasksElements.ALL_TASKS_ID]++;
                            }
                            if (task.isAssignedTo(this.getMyId(session))) {
                                newSearchCounts[session.hostHash][CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID]++;
                            }
                            if (task.getCreatedBy() == this.getMyId(session)) {
                                newSearchCounts[session.hostHash][CustomTasksElements.TASKS_CREATED_BY_ME_ID]++;
                            }
                            for (let c2s of session.conv2Service.collection.list) {
                                if (this.isAssignedToUsers(task, usersCache[session.hostHash][c2s.id])) {
                                    newSearchCounts[session.hostHash][c2s.id]++;
                                }
                            }
                        }
                    }
                }
            }

        }
        
        // Count total
        let searchTotalCount: number = 0;
        for (let hostHash in newSearchCounts) {
            for (let id in newSearchCounts[hostHash]) {
                searchTotalCount += newSearchCounts[hostHash][id];
            }
        }
        this.searchTotalCount = searchTotalCount;

        // Find differences in search counts
        if (!this.searchCounts) {
            this.searchCounts = this._makeZeroSearchCountsObject();
        }
        this.searchCountsModified = {};
        for (let hostHash in newSearchCounts) {
            for (let k in newSearchCounts[hostHash]) {
                if (!(hostHash in this.searchCountsModified)) {
                    this.searchCountsModified[hostHash] = {};
                }
                if (!this.searchCounts[hostHash]) {
                    this.searchCounts[hostHash] = {};
                }
                this.searchCountsModified[hostHash][k] = newSearchCounts[hostHash][k] != this.searchCounts[hostHash][k];
            }
        }
        this.searchCounts = newSearchCounts;


        // Dispatch
        this.app.dispatchEvent<TasksSearchUpdateEvent>({
            type: "tasks-search-update",
            searchString: searchStr,
            searchTotalCount: this.searchTotalCount,
        });
    }

    getSearchCount(session: mail.session.Session, x: Mail.mail.section.SectionService | Mail.mail.section.Conv2Section | Mail.component.customelementlist.CustomElement): number {
        if (!this.searchCounts) {
            return 0;
        }
        if (!this.searchCounts[session.hostHash]) {
            return 0;
        }
        if (x instanceof Mail.mail.section.SectionService) {
            return this.searchCounts[session.hostHash][x.getId()] || 0;
        }
        else if (x instanceof Mail.mail.section.Conv2Section) {
            return this.searchCounts[session.hostHash][x.id] || 0;
        }
        else {
            return this.searchCounts[session.hostHash][x.id] || 0;
        }
    }

    getTaskTooltipContent(session: mail.session.Session, taskIdsStr: string): string {
        taskIdsStr += "";
        let taskIds: string[] = taskIdsStr.split(",");
        let data: any[] = [];

        let tasks: Task[] = [];

        for (let taskId of taskIds) {
            let task = this.tasks[session.hostHash][taskId];
            if (task && this.projects[session.hostHash][task.getProjectId()]) {
                tasks.push(task);
            }
        }

        tasks.sort((a, b) => b.getModifiedDateTime() - a.getModifiedDateTime());

        for (let task of tasks) {
            let proj = this.projects[session.hostHash][task.getProjectId()];
            let pinnedTGs = proj.getPinnedTaskGroupIds();
            let section = session.sectionManager.getSection(proj.getId());
            let fileNamesByDid: { [did: string]: string } = null;
            if (section && section.getFileModule() && section.getFileModule().fileTree) {
                let fileTree = section.getFileModule().fileTree;
                fileNamesByDid = {};
                fileTree.collection.list.forEach(x => fileNamesByDid[x.ref.did] = x.name);
            }
            data.push({
                myHashmail: this.getMyId(session),
                id: task.getId(),
                description: task.getDescription(),
                labelClass: task.getLabelClass(),
                statusStr: Task.getStatusText(task.getStatus()),
                projectId: proj.getId(),
                projectPublic: section ? section.getScope() == "public" : true,
                projectName: this.getPrivateSectionId() == proj.getId() ? this.app.localeService.i18n("plugin.tasks.privateTasks") : proj.getName(),
                projectIsPrivateSection: this.getPrivateSectionId() == proj.getId(),
                taskGroups: task.getTaskGroupIds().map(tgId => {
                    let tg = this.taskGroups[session.hostHash][tgId];
                    if (!tg) {
                        return null;
                    }
                    return {
                        id: tgId,
                        name: tg.getName(),
                        pinned: pinnedTGs.indexOf(tgId) >= 0,
                        icon: tg.getIcon(),
                    };
                }).filter(x => x != null),
                //TODO: fix
                assignedTo: task.getAssignedTo().map(personId => {
                    return this.getPerson(session, personId)
                }).filter(x => x != null),
                attachments: task.getAttachments().map(x => JSON.parse(x)).filter(x => x != null).map(x => fileNamesByDid && x.did in fileNamesByDid ? fileNamesByDid[x.did] : x.name),
                startTimestamp: task.getStartTimestamp(),
                endTimestamp: task.getEndTimestamp(),
                wholeDays: task.getWholeDays(),
            });
        }

        return JSON.stringify(data);
    }

    private _makeZeroSearchCountsObject(): { [hoshHash: string]: { [key: string]: number } } {
        let searchCounts: { [hoshHash: string]: { [key: string]: number } } = {};
        for (let hostHash in this.projects) {
            for (let pId in this.projects[hostHash]) {
                if (!searchCounts[hostHash]) {
                    searchCounts[hostHash] = {};
                }
                searchCounts[hostHash][pId] = 0;
            }
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            for (let c2s of session.conv2Service.collection.list) {
                if (!searchCounts[hostHash]) {
                    searchCounts[hostHash] = {};
                }
                searchCounts[hostHash][c2s.id] = 0;
            }

        }
        for (let hostHash in this.app.sessionManager.sessions) {
            if (!(hostHash in searchCounts)) {
                searchCounts[hostHash] = {};
            }
        }
        let localHostHash = this.app.sessionManager.getLocalSession().hostHash;
        if (!searchCounts[localHostHash]) {
            searchCounts[localHostHash] = {};
        }
        searchCounts[localHostHash][CustomTasksElements.ALL_TASKS_ID] = 0;
        searchCounts[localHostHash][CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID] = 0;
        searchCounts[localHostHash][CustomTasksElements.TASKS_CREATED_BY_ME_ID] = 0;
        searchCounts[localHostHash][CustomTasksElements.TRASH_ID] = 0;
        return searchCounts;
    }

    isConv2Project(sectionId: string): boolean {
        // console.log("isConv2Project", sectionId);
        return sectionId && sectionId.substr(0, 3) == "c2:";
    }

    getConv2Section(session: mail.session.Session, id: string): Mail.mail.section.Conv2Section {
        return session.conv2Service.collection.find(c2s => c2s.id == id);
    }

    getConv2Users(session: mail.session.Session, x: string | Mail.mail.section.Conv2Section, excludeMe: boolean = false): string[] {
        let c2s = (x instanceof Mail.mail.section.Conv2Section) ? x : this.getConv2Section(session, x);
        if (!c2s) {
            return [];
        }
        let hashmail = session.userData.identity.hashmail;
        let hash = hashmail.substr(hashmail.indexOf("#"));
        let users = c2s.users.map(u => u + hash);
        if (excludeMe) {
            let myId = this.getMyId(session);
            users = users.filter(id => id != myId);
        }
        return users;
    }

    getConv2SectionName(session: mail.session.Session, x: string | Mail.mail.section.Conv2Section): string {
        return this.getConv2Users(session, x, true).join(", ");
    }

    findCommonProject(session: mail.session.Session, c: Mail.mail.section.Conv2Section): string {
        let pubProjId: string = null;
        let privProjIds: string[] = [];
        let conv2Users = c.users;
        for (let pId in this.projects[session.hostHash]) {
            if (pId.substr(0, 8) == "private:") {
                continue;
            }
            let p = this.projects[session.hostHash][pId];
            if (p) {
                let section = session.sectionManager.getSection(pId);
                if (section) {
                    if (section.getScope() == "public") {
                        pubProjId = pubProjId ? pubProjId : pId;
                    }
                    else {
                        let users = section.sectionData.group.users;
                        let common = true;
                        for (let user of conv2Users) {
                            if (users.indexOf(user) < 0) {
                                common = false;
                                break;
                            }
                        }
                        if (common) {
                            privProjIds.push(pId);
                        }
                    }
                }
            }
        }
        return privProjIds.length == 1 ? privProjIds[0] : null;
    }

    getTaskPriorities(): string[] {
        return this._getProjOptsStripped(this.taskPriorities);
    }

    getTaskStatuses(): string[] {
        return Task.getStatuses();
    }

    static getTaskStatuses(): string[] {
        return Task.getStatuses();
    }

    getTaskTypes(): string[] {
        return this._getProjOptsStripped(this.taskTypes);
    }

    private _getProjOptsStripped(arr: string[]): string[] {
        let arr2: string[] = [];
        for (let s of arr) {
            arr2.push(s.length > 2 && s[0] == "[" && s[s.length - 1] == "]" ? s.substr(1, s.length - 2) : s);
        }
        return arr2;
    }

    bringWindowToFront(id: string): boolean {
        let win = this.openedWindows[id];
        if (!win) {
            return false;
        }
        if (win.nwin.isMinimized()) {
            win.nwin.minimizeToggle();
        }
        win.nwin.focus();
        return true;
    }

    registerWindow(id: string, window: TaskWindowController | TaskGroupFormWindowController): void {
        this.openedWindows[id] = window;
    }

    unregisterWindow(id: string): void {
        delete this.openedWindows[id];
    }


    detachTaskGroup(session: mail.session.Session, tgId: string): Q.Promise<void> {
        let tgsToSave: Array<TaskGroup> = [];
        let tsToSave: Array<Task> = [];
        let addToSave = <T>(it: T, arr: Array<T>) => {
            if (arr.indexOf(it) < 0) {
                arr.push(it);
            }
        };

        // Unpin, move down (above first detached)
        let tg = this.taskGroups[session.hostHash][tgId];
        let p = tg ? this.projects[session.hostHash][tg.getProjectId()] : null;
        if (p) {
            p.removePinnedTaskGroupId(tgId);
            p.removeTaskGroupsOrder(tgId);

            let arr = p.getTaskGroupsOrder();
            let idx = -1;
            for (let i in arr) {
                let it = this.taskGroups[session.hostHash][arr[i]];
                if (it) {
                    if (it.getDetached()) {
                        idx = parseInt(i);
                        break;
                    }
                }
            }
            arr.splice(idx < 0 ? arr.length : idx, 0, tgId);

        }

        // Detach
        addToSave(tg, tgsToSave);
        if (tg) {
            tg.setDetached(true);
            for (let tId of tg.getTaskIds()) {
                let t = this.tasks[session.hostHash][tId];
                if (t) {
                    for (let tgId2 of t.getTaskGroupIds()) {
                        if (tgId2 == tgId) {
                            continue;
                        }
                        let tg2 = this.taskGroups[session.hostHash][tgId2];
                        if (tg2) {
                            tg2.removeTaskId(tId);
                            addToSave(tg2, tgsToSave);
                        }
                    }
                    let tgsPrefix = t.getTaskGroupIds(true).filter(x => x != tgId && this.taskGroups[session.hostHash][tgId]).map(x => "[" + this.taskGroups[session.hostHash][x].getName() + "] ").join("");
                    t.setPreDetachTaskGroupIds(t.getTaskGroupIds(true));
                    t.setTaskGroupIds([tgId]);
                    t.setDescription(tgsPrefix + t.getDescription());
                    addToSave(t, tsToSave);
                }
            }
        }

        // Save
        return Q().then(() => {
            if (p) {
                return this.saveProject(session, p);
            }
            return Q();
        }).then(() => {
            return Mail.Promise.PromiseUtils.oneByOne(tsToSave, (_idx, t) => {
                return this.saveTask(session, t);
            });
        }).then(() => {
            return Mail.Promise.PromiseUtils.oneByOne(tgsToSave, (_idx, tg) => {
                return this.saveTaskGroup(session, tg);
            });
        });
    }

    //onUserPreferencesChange(session: mail.session.Session): void {
    onUserPreferencesChange(): void {
        let session = this.session;
        this.refreshWatched();
        this.app.dispatchEvent<UpdateSectionBadgeEvent>({ type: "update-section-badge", sectionId: "conv2", hostHash: session.hostHash });
    }

    getAppVersion(): string {
        return this.app.getVersion().str;
    }

    getPrivateSectionId() {
        this.privateSection = this.session.sectionManager.getMyPrivateSection();
        return this.privateSection ? this.privateSection.getId() : null;
    }

    getPrivateSection() {
        this.privateSection = this.session.sectionManager.getMyPrivateSection();
        return this.privateSection;
    }

    onPollingResult(entries: Mail.mail.PollingItem[]) {
        if (entries) {
            entries.forEach(entry => {
                this.notifyUser(entry);
            });
        }
    }

    isPollingItemComingFromMe(item: Mail.mail.PollingItem): boolean {
        if (item.entry) {
            if (this.app.sessionManager.isSessionExistsByHost(item.entry.host)) {
                let session = this.app.sessionManager.getSession(item.entry.host);
                let message = item.entry.getMessage();
                if (message.sender.pub58 == session.userData.identity.pub58) {
                    return true;
                }
            }
        }
        return false;
    }

    getContextFromSinkId(session: mail.session.Session, sinkId: string): string {
        let section: Mail.mail.section.SectionService = null;
        session.sectionManager.filteredCollection.list.forEach(x => {
            if (sinkId == x.getChatSink().id) {
                section = x;
                return;
            }
        });
        if (section) {
            let sectionId = section.getId();
            let conv2Id: string;
            if (sectionId.indexOf("usergroup") >= 0) {
                session.conv2Service.collection.list.forEach(x => {
                    if (x.section && x.section.getId() == sectionId) {
                        conv2Id = x.id;
                        return;
                    }
                });
                return conv2Id;
            }

            return "section:" + sectionId;
        }
        return null;
    }
    
    notifyUser(sinkIndexEntry: Mail.mail.PollingItem): void {
        if (!sinkIndexEntry.entry || !sinkIndexEntry.entry.source) {
            return;
        }

        if (this.isPollingItemComingFromMe(sinkIndexEntry)) {
            return;
        }
        // console.log("sinkindexentry.entry.host", sinkIndexEntry.entry.host);
        if (!this.app.sessionManager.isSessionExistsByHost(sinkIndexEntry.entry.host)) {
            return;
        }

        let session = this.app.sessionManager.getSession(sinkIndexEntry.entry.host);
        if (!session.loadingPromise.isFulfilled()) {
            return;
        }

        if (this.isModuleFiltered(session, sinkIndexEntry.entry.index.sink.id)) {
            return;
        }
        // session.sectionManager.filteredCollection.forEach(x => {
        //     if (!x) {
        //         console.log("ERR: x is null", session.host);
        //     }
        //     else if (!x.getChatSink()) {
        //         console.log("ERR: x.getChatSink() is null", x.getName());
        //     }
        // });
        let sinkId = sinkIndexEntry.entry.sink.id;
        let section: Mail.mail.section.SectionService = session.sectionManager.getSectionBySinkId(sinkId);
        if (section && !section.isKvdbModuleEnabled()) {
            return;
        }

        if (sinkIndexEntry.entry.source.data.contentType == "application/json") {
            let data = sinkIndexEntry.entry.getContentAsJson();
            if (!data || data.type != "create-task" && data.type != "modify-task" && data.type != "delete-task" && data.type != "task-comment") {
                return;
            }
            let context = this.getContextFromSinkId(session, sinkIndexEntry.entry.sink.id);
            if (!(data.id in this.taskTitleCache[session.hostHash])) {
                this.taskTitleCache[session.hostHash][data.id] = data.name;
            }


            this.createTaskNotification(session, data.type, sinkIndexEntry.entry.source.data.sender.hashmail, data.label, context);
        }
    }

    createTaskNotification(session: mail.session.Session, type: string, sender: string, taskLabel: string, context: string) {
        let text: string;
        if (type == "create-task") {
            text = this.getNotificationText(session, "plugin.tasks.app.notification.newTask", taskLabel);
        }
        else if (type == "modify-task") {
            text = this.getNotificationText(session, "plugin.tasks.app.notification.modifyTask", taskLabel);
        }
        else if (type == "delete-task") {
            if (taskLabel.substr(1) in this.taskTitleCache[session.hostHash]) {
                text = this.getNotificationText(session, "plugin.tasks.app.notification.deleteTask", taskLabel);
            }
            else {
                text = this.app.localeService.i18n("plugin.tasks.app.notification.deleteTask.unknown", taskLabel);
            }
        }
        else if (type == "task-comment") {
            text = this.getNotificationText(session, "plugin.tasks.app.notification.commentTask", taskLabel);
        }

        let event: Mail.Types.event.NotificationServiceEvent = {
            type: "notifyUser",
            options: {
                sender: sender,
                tray: true,
                sound: true,
                tooltip: true,
                tooltipOptions: {
                    title: "",
                    text: text,
                    sender: sender,
                    withAvatar: true,
                    withUserName: true
                },
                context: {
                    module: Mail.Types.section.NotificationModule.TASKS,
                    sinkId: context,
                    hostHash: session.hostHash,
                },
            },
        };
        this.app.dispatchEvent<Mail.Types.event.NotificationServiceEvent>(event);
    }

    isModuleFiltered(session: mail.session.Session, sinkId: string): boolean {
        let filtered = this.isModuleMuted(session, sinkId) || ((this.activeSinkId === sinkId) && (this.activeSinkHostHash === session.hostHash) && this.activeWindowFocused === Mail.Types.section.NotificationModule.TASKS);
        return filtered;
    }

    isModuleMuted(session: mail.session.Session, sinkId: string): boolean {
        if (this.userPreferences == null) {
            return true;
        }

        let muted: boolean = false;
        for (let section of this.tasksSectionsCollectionNoPrivate[session.hostHash].list) {
            let sink = section.getChatSink();
            if (sink && sink.id == sinkId) {
                muted = section.userSettings.mutedModules.tasks;
                break;
            }
        }
        return muted;
    }


    createTaskGroup(session: mail.session.Session, projectId: string, name: string): Q.Promise<TaskGroupId> {
        return this.nextTaskGroupId(session)
            .then(id => {
                let tg = new TaskGroup();
                DataMigration.setVersion(tg);
                tg.setId(id);
                tg.setName(name);
                tg.setProjectId(projectId);
                return this.saveTaskGroup(session, tg)
                    .then(() => {
                        if (projectId in this.projects[session.hostHash]) {
                            let p = this.projects[session.hostHash][projectId];
                            p.addTaskGroupId(id);
                            return this.saveProject(session, p)
                                .then(() => {
                                    return id;
                                });
                        }
                    });
            });
    }

    createTask(session: mail.session.Session, projectId: string, taskGroupIds: string[], description: string, status: TaskStatus, onBeforeSave: (task: Task) => void = null): Q.Promise<TaskId> {
        return this.nextTaskId(session)
            .then(id => {
                let nowTimestamp = new Date().getTime();
                let t = new Task();
                DataMigration.setVersion(t);
                t.setId(id);
                t.setDescription(description);
                t.setStatus(status);
                t.setProjectId(projectId);
                t.setTaskGroupIds(taskGroupIds);
                t.setCreatedBy(this.getMyId(session));
                t.setCreatedDateTime(nowTimestamp);
                t.setModifiedBy(this.getMyId(session));
                t.setModifiedDateTime(nowTimestamp);
                t.addHistory({
                    when: nowTimestamp,
                    who: this.getMyId(session),
                    what: "created",
                });
                if (onBeforeSave) {
                    onBeforeSave(t);
                }

                return this.saveTask(session, t)
                    .then(() => {
                        let prom = Q();
                        if ((!taskGroupIds || taskGroupIds.length == 0) && (projectId in this.projects[session.hostHash])) {
                            let p = this.projects[session.hostHash][projectId];
                            p.addOrphanedTasksId(id);
                            prom = prom.then(() => { return this.saveProject(session, p); });
                        }
                        for (let taskGroupId of taskGroupIds) {
                            if (taskGroupId && (taskGroupId in this.taskGroups[session.hostHash])) {
                                let tg = this.taskGroups[session.hostHash][taskGroupId];
                                tg.addTaskId(id);
                                prom = prom.then(() => { return this.saveTaskGroup(session, tg); });
                            }
                        }
                        return prom;
                    }).then(() => {
                        return id;
                    })
            });
    }

    createSimpleTaskService(privmxRegistry: mail.PrivmxRegistry): Q.Promise<SimpleTaskService> {
        return Q.all([
            privmxRegistry.getSrpSecure(),
            privmxRegistry.getSectionManager(),
            privmxRegistry.getIdentity(),
            privmxRegistry.getLocaleService()
        ])
        .then(res => {
            return new SimpleTaskService(res[0], res[1], res[2], res[3]);
        });
    }

    nextUniqueId(): string {
        return UniqueId.next();
    }

    newTasksFilterUpdater(): TasksFilterUpdater {
        return new TasksFilterUpdater();
    }

    addTaskStatusesFromMessage(session: mail.session.Session, statuses: { [taskId: string]: string }, text: string): void {
        let matches = text.match(/\B#[0-9]{3,}\b/g);
        if (!matches) {
            return;
        }
        for (let taskHashId of matches) {
            let taskId = taskHashId.substr(1);
            if (!(taskId in statuses)) {
                let t = this.tasks[session.hostHash][taskId];
                if (t) {
                    statuses[taskId] = this.tasks[session.hostHash][taskId].getStatus();
                }
            }
        }
    }
    
    addTaskStatusesFromTaskIds(session: mail.session.Session, statuses: { [taskId: string]: string }, taskIds: string[]): void {
        for (let taskId of taskIds) {
            if (!(taskId in statuses)) {
                let t = this.tasks[session.hostHash][taskId];
                if (t) {
                    statuses[taskId] = this.tasks[session.hostHash][taskId].getStatus();
                }
            }
        }
    }
    
    getTaskIdsFromMessage(text: string): string[] {
        let matches = text.match(/\B#[0-9]{3,}\b/g);
        if (!matches) {
            return [];
        }
        let taskIds: string[] = [];
        for (let taskHashId of matches) {
            let taskId = taskHashId.substr(1);
            if (taskIds.indexOf(taskId) < 0) {
                taskIds.push(taskId);
            }
        }
        return taskIds;
    }
    
    convertBindedTaskId(data: string|null|undefined|number): string {
        if (!data || (typeof(data) == "string" && data.length == 0)) {
            data = '{"taskIds":[]}';
        }
        else if (typeof (data) == "number") {
            data = "" + data;
        }
        if (data[0] == "[") {
            data = '{"taskIds":' + data + '}';
        }
        if (data[0] != "{") {
            data = '{"taskIds":["' + data + '"]}';
        }
        return data;
    }

    getBindedTasksData(session: mail.session.Session, metaBindedElementId: string | null | undefined | number): { taskId: string, labelClass: string }[] {
        let bindedData: { taskIds: string[] } = JSON.parse(this.convertBindedTaskId(metaBindedElementId));
        let bindedTaskIds: string[] = bindedData.taskIds;
        let bindedTasks: { taskId: string, labelClass: string }[] = [];
        for (let taskId of bindedTaskIds) {
            if (this.taskExists(session, taskId)) {
                bindedTasks.push({
                    taskId: taskId,
                    labelClass: this.getTaskLabelClassByTaskId(session, taskId),
                });
            }
        }
        if (bindedTasks.length > 0) {
            let taskIdsStr = bindedTasks.map(x => x.taskId).join(",");
            bindedTasks.splice(0, 0, {
                taskId: taskIdsStr,
                labelClass: this.getTaskLabelClassByTaskId(session, taskIdsStr),
            });
        }
        return bindedTasks;
    }

    isTasksPluginEnabledInSection(session: mail.session.Session, sectionId: string): boolean {
        let section = session.sectionManager.getSection(sectionId);
        if (!section) {
            return false;
        }
        return !!section.isKvdbModuleEnabled();
    }

    openTask(session: mail.session.Session, _sectionId: string, id: string): void {
        this.openEditTaskWindow(session, id, true);
    }

    onStorageEvent(session: mail.session.Session, event: privfs.types.descriptor.DescriptorNewVersionEvent): void {
        if (event.type == "descriptor-new-version") {
            //TODO: supports only local sections - should support all
            if (event.descriptor && event.descriptor.lastVersion && event.descriptor.lastVersion.extra && event.descriptor.lastVersion.extra.meta) {
                let meta = event.descriptor.lastVersion.extra.meta;
                let data = JSON.parse(this.convertBindedTaskId(meta.bindedElementId));
                if (data && data.taskIds) {
                    for (let taskId of data.taskIds) {
                        let task = this.tasks[session.hostHash][taskId];
                        if (task) {
                            let did = event.descriptor.ref.did;
                            let att = task.getAttachments().map(x => JSON.parse(x)).filter(x => x.did == did);
                            if (att.length > 0 && att[0]) {
                                if (event.version && event.version.raw && event.version.raw.modifier == this.getMyId(session).split("#")[0]) {
                                    this.tryAddTaskHistoryAttachmentModificationEntry(this.session, task, did, att[0].name, meta.modifiedDate);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    tryAddTaskHistoryAttachmentModificationEntry(session: mail.session.Session, task: Task, did: string, fileName: string, fileModDate: number): void {
        if (task && this.areAttachmentModificationMessagesLocked(session, task.getId())) {
            return;
        }
        let history = task.getHistory();
        let lastEntry = history.length > 0 ? history[history.length - 1] : null;
        let addEntry = true;
        if (task.getModifiedDateTime() >= fileModDate) {
            return;
        }
        if (lastEntry) {
            if (lastEntry.what == "modified" && lastEntry.arg == "attachment" && lastEntry.who == this.getMyId(session)) {
                let attachment = JSON.parse(<string>lastEntry.newVal);
                if (attachment && attachment.did == did) {
                    // Increase counter
                    attachment.modsCount++;
                    lastEntry.when = fileModDate;
                    addEntry = false;
                }
                lastEntry.newVal = JSON.stringify(attachment);
                history[history.length - 1] = lastEntry;
            }
        }
        if (addEntry) {
            let entry: string = JSON.stringify({
                did: did,
                name: fileName,
                modsCount: 1,
            });
            task.addHistory({
                what: "modified",
                when: fileModDate,
                who: this.getMyId(session),
                arg: "attachment",
                newVal: entry,
            });
        }
        task.setModifiedBy(this.getMyId(session));
        task.setModifiedDateTime(fileModDate);
        this.saveTask(session, task);
        this.sendTaskMessage(session, task, "modify-task");
    }

    lockAttachmentModificationMessages(session: mail.session.Session, taskId: TaskId): void {
        if (!this.lockedAttachmentModificationMessages[session.hostHash]) {
            this.lockedAttachmentModificationMessages[session.hostHash] = [];
        }
        if (!this.areAttachmentModificationMessagesLocked(session, taskId)) {
            this.lockedAttachmentModificationMessages[session.hostHash].push(taskId);
        }
    }

    unlockAttachmentModificationMessages(session: mail.session.Session, taskId: TaskId): void {
        if (!this.lockedAttachmentModificationMessages[session.hostHash]) {
            this.lockedAttachmentModificationMessages[session.hostHash] = [];
        }
        let idx = this.lockedAttachmentModificationMessages[session.hostHash].indexOf(taskId);
        if (idx >= 0) {
            this.lockedAttachmentModificationMessages[session.hostHash].splice(idx, 1);
        }
    }

    areAttachmentModificationMessagesLocked(session: mail.session.Session, taskId: TaskId): boolean {
        if (!this.lockedAttachmentModificationMessages[session.hostHash]) {
            this.lockedAttachmentModificationMessages[session.hostHash] = [];
        }
        return this.lockedAttachmentModificationMessages[session.hostHash].indexOf(taskId) >= 0;
    }

    getNotificationText(session: mail.session.Session, i18nKey: string, taskLabel: string): string {
        let taskId = taskLabel[0] == "#" ? taskLabel.substr(1) : taskLabel;
        let maxLength = this.app.getNotificationTitleMaxLength();
        let ellipsis = this.app.getNotificationTitleEllipsis().trim();

        let basicText = this.app.localeService.i18n(i18nKey, "{0}");
        let basicTextLength = basicText.length - 3; // -3 for the {0}

        let msgTextMaxLength = maxLength - basicTextLength;

        let msgText = this.tasks[session.hostHash][taskId] ? this.tasks[session.hostHash][taskId].getName() : this.taskTitleCache[session.hostHash][taskId];
        msgText = msgText.replace(/<[^>]+>/g, "");
        if (msgText.length > msgTextMaxLength) {
            msgText = msgText.substr(0, msgTextMaxLength - ellipsis.length) + ellipsis;
        }

        return basicText.replace("{0}", msgText);
    }


    // getSessionByProjectId(projectId: ProjectId): mail.session.Session {
    //     let availSessions = this.app.sessionManager.sessions;
    //     let session: mail.session.Session = null;
    //     for (let hostHash in availSessions) {
    //         if (projectId.indexOf(hostHash) == 0) {
    //             session = availSessions[hostHash];
    //             break;
    //         }
    //     }
    //     return session || this.app.sessionManager.getLocalSession();
    // }

    projectIdToSectionId(session: mail.session.Session, projectId: ProjectId): string {
        let hostHash = this.app.sessionManager.getHashFromHost(session.host);
        if (projectId.indexOf(hostHash) == 0) {
            return projectId.split("-")[1];
        }
        return projectId;
    }

    sectionIdToProjectId(session: mail.session.Session, sectionId: string): string {
        let hostHash = this.app.sessionManager.getHashFromHost(session.host);
        return hostHash + "-" + sectionId;

    }
    
    triggerFileAttached(session: mail.session.Session, did: string, taskId: string): void {
        this.app.dispatchEvent<FileAttachedToTaskEvent>({
            type: "file-attached-to-task",
            did: did,
            taskId: taskId,
            hostHash: session.hostHash,
        });
    }
    
    triggerFileDetached(session: mail.session.Session, did: string, taskId: string): void {
        this.app.dispatchEvent<FileDetachedFromTaskEvent>({
            type: "file-detached-from-task",
            did: did,
            taskId: taskId,
            hostHash: session.hostHash,
        });
    }
    
    checkAttachmentChanges(session: mail.session.Session, oldTask: Task, newTask: Task): void {
        let oldDids = oldTask.getAttachments().map(x => JSON.parse(x).did);
        let newDids = newTask.getAttachments().map(x => JSON.parse(x).did);
        for (let did of newDids) {
            if (oldDids.indexOf(did) < 0) {
                this.triggerFileAttached(session, did, newTask.getId());
            }
        }
        for (let did of oldDids) {
            if (newDids.indexOf(did) < 0) {
                this.triggerFileDetached(session, did, oldTask.getId());
            }
        }
    }
    
}

