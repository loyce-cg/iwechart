import { app, Q, privfs, Logger as RootLogger, mail, Types } from "pmc-mail";
import * as Mail from "pmc-mail";
import { TasksPlugin, TasksComponentFactory } from "privfs-mail-client-tasks-plugin/src/main/TasksPlugin";
import { Task } from "privfs-mail-client-tasks-plugin/src/main/data/Task";
import { ViewSettings } from "./ViewSettings";
import { ViewContext, CustomTasksElements } from "./Types";
import { CalendarPanelController, FileModel } from "../component/calendarPanel/CalendarPanelController";
import { DatePickerController, DatePickerOptions } from "../component/datePicker/DatePickerController";
import { DateTimePickerController, DateTimePickerOptions } from "../component/dateTimePicker/DateTimePickerController";
import { TasksFilterUpdater, TasksFilterData } from "privfs-mail-client-tasks-plugin/src/component/taskGroupsPanel/TaskGroupsPanelController";
import { i18n } from "../i18n/index";
import { SearchFilter } from "./SearchFilter";
let Logger = RootLogger.get("privfs-calendar-plugin.CalendarPlugin");

export interface CalendarDayPreviewRequestEvent extends Mail.Types.event.Event {
    type: "calendar-day-preview-request";
    day: string;
}

export interface CalendarTaskPreviewRequestEvent extends Mail.Types.event.Event {
    type: "calendar-task-preview-request";
    task: string;
    hostHash: string;
}

export interface CalendarPreviewUpdateRequestEvent extends Mail.Types.event.Event {
    type: "calendar-preview-update-request";
}

export interface CalendarBadgesUpdateRequestEvent extends Mail.Types.event.Event {
    type: "calendar-badges-update-request";
}

export interface CalendarTaskPreviewChangeVisibilityRequestEvent extends Mail.Types.event.Event {
    type: "calendar-task-preview-change-visibility-request";
    show: boolean;
}

export interface CalendarDayPreviewChangeVisibilityRequestEvent extends Mail.Types.event.Event {
    type: "calendar-day-preview-change-visibility-request";
    show: boolean;
}
export interface HorizontalCalendarTaskPreviewWindowLayoutChangeRequestEvent extends Mail.Types.event.Event {
    type: "horizontal-calendar-task-preview-window-layout-change-request";
    horizontalLayout: boolean;
}

export interface CalendarSearchUpdateEvent extends Mail.Types.event.Event {
    type: "calendar-search-update";
    searchString: string;
    searchTotalCount: number;
}

export interface CalendarsRefresh extends Mail.Types.event.Event {
    type: "calendars-refresh";
    hard: boolean;
    showNotifications: boolean;
}

export interface CalendarsFileAdded extends Mail.Types.event.Event {
    type: "calendars-file-added";
    identifier: string;
    hostHash: string;
}

export interface CalendarsFileRemoved extends Mail.Types.event.Event {
    type: "calendars-file-removed";
    identifier: string;
    hostHash: string;
}

export interface ExtraCalendarsChanged extends Mail.Types.event.Event {
    type: "extra-calendars-changed";
    mainProjectId: string;
    hostHash: string;
    senderId: string;
}

export type CalendarComponentFactory = Mail.component.ComponentFactory&TasksComponentFactory&{
    createComponent(componentName: "calendarPanel", args: [Mail.window.base.BaseWindowController, Mail.component.persons.PersonsController]): CalendarPanelController;
    createComponent(componentName: "datePicker", args: [Mail.Types.app.IpcContainer, DatePickerOptions]): DatePickerController;
    createComponent(componentName: "dateTimePicker", args: [Mail.Types.app.IpcContainer, DateTimePickerOptions]): DateTimePickerController;
}

export interface CalendarSettingChanged extends Mail.Types.event.Event {
    type: "calendar-setting-changed";
    setting: string;
    value: boolean|string|number;
    sourceProjectId: string;
    sourceContext: string;
    sourceUniqueId: string;
}

export class CalendarPlugin {
    
    static VIEW_SETTINGS: string = "plugin.calendar.viewSettings";
    
    tasksPluginLoaded: Q.Deferred<void> = Q.defer();
    initPromise: Q.Promise<void>;
    tasksPlugin: TasksPlugin;
    viewSettings: ViewSettings;
    activeWindowFocused: string;
    activeSinkId: string;
    activeSinkHostHash: string;
    
    sectionManager: Mail.mail.section.SectionManager;
    utilApi: Mail.mail.UtilApi;
    identity: privfs.identity.Identity;
    personService: Mail.mail.person.PersonService;
    conv2Service: Mail.mail.section.Conv2Service;
    userPreferences: Mail.mail.UserPreferences.UserPreferences;
    localStorage: Mail.Types.utils.IStorage;
    tasksFilterUpdater: TasksFilterUpdater;
    sidebarSectionsCollection: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService>;
    calendarPrimarySections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    mergableSections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    fileModels: { [hostHash: string]: { [path: string]: FileModel } } = {};
    calendarUnreadCountFullyLoadedModel = new Mail.utils.Model(false);
    sessionInitPromises: { [hostHash: string]: Q.Promise<void> } = {};
    
    session: Mail.mail.session.Session;

    constructor(public app: app.common.CommonApplication) {
        this.app.addEventListener("tasks-plugin-loaded", () => {
            this.tasksPlugin = app.getComponent("tasks-plugin");
            this.tasksPluginLoaded.resolve();
        }, "calendar", "ethernal");
        this.tasksPlugin = app.getComponent("tasks-plugin");
        if (this.tasksPlugin) {
            this.tasksPluginLoaded.resolve();
        }
        this.tasksPluginLoaded.promise.then(() => {
            this.tasksPlugin.tasksUnreadCountFullyLoadedModel.changeEvent.add(() => {
                this.calendarUnreadCountFullyLoadedModel.set(this.tasksPlugin.tasksUnreadCountFullyLoadedModel.get());
            }, "multi");
        });
    }
    
    registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, "plugin.calendar.");
    }
    
    checkInit(): Q.Promise<void> {
        if (this.initPromise == null) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    }
    
    init(): Q.Promise<void> {
        return Q().then(() => {
            return (<any>this.app.sessionManager).initAfterLogin();
        })
        .then(() => {
            this.session = this.app.sessionManager.getLocalSession();
        })
        .then(() => {
            if (this.app.mailClientApi == null) {
                return Q();
            }
            let localSession = this.app.sessionManager.getLocalSession();
            return this.tasksPluginLoaded.promise.then(() => {
                return this.tasksPlugin.checkInit();
            })
            .then(() => {
                this.tasksPlugin.ensureSessionInit(this.session);
                this.sectionManager = this.session.sectionManager;
                this.utilApi = this.tasksPlugin.utilApi;
                this.identity = this.tasksPlugin.identity;
                this.personService = this.tasksPlugin.personService;
                this.conv2Service = this.tasksPlugin.conv2Service;
                this.userPreferences = this.tasksPlugin.userPreferences;
                this.localStorage = this.tasksPlugin.localStorage;
                
                this.tasksPlugin.ensureInitSessionCollections(this.session);

                this.sidebarSectionsCollection = new Mail.utils.collection.FilteredCollection(this.sectionManager.filteredCollection, x => {
                    return !x.isUserGroup() && x != this.sectionManager.getMyPrivateSection() && x.isVisible() && x.hasAccess();
                });
                return this.initSession(localSession);
            })
            .then(() => {
                return this.app.mailClientApi.privmxRegistry.getUserSettingsKvdb();
            })
            .then(kvdb => {
                this.viewSettings = new ViewSettings(CalendarPlugin.VIEW_SETTINGS, <any>kvdb);
            })
            .then(() => {
                return Q.all([
                    this.loadSettings(localSession, "__global__"),
                    this.loadSettings(localSession, CustomTasksElements.ALL_TASKS_ID),
                    this.loadSettings(localSession, CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID),
                    this.loadSettings(localSession, CustomTasksElements.TASKS_CREATED_BY_ME_ID),
                    this.loadSettings(localSession, CustomTasksElements.TRASH_ID),
                    this.loadSettings(localSession, this.getPrivateSectionId()),
                    this.loadSettings(localSession, "private-tasks"),
                    Q.all(this.sidebarSectionsCollection.list.map(x => this.loadSettings(localSession, x.getId()))).thenResolve(null)
                ]);
            })
            .then(() => {
                this.setupSearch();
                this.app.addEventListener<Mail.Types.event.HostSessionCreatedEvent>("hostSessionCreated", event => {
                    // console.log("XX - On hostSessionCreated event fired..");
                    let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
                    this.initSession(session);
                });
            })
            .thenResolve(null);
    
        })
    }
    
    initSession(session: mail.session.Session): Q.Promise<void> {
        if (this.sessionInitPromises[session.hostHash]) {
            return this.sessionInitPromises[session.hostHash];
        }
        let initDeferred = Q.defer<void>();
        this.sessionInitPromises[session.hostHash] = initDeferred.promise;
        return Q().then(() => {
            this.fileModels[session.hostHash] = {};
            this.calendarPrimarySections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && (<any>x.sectionData).primary);
            this.mergableSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => {
                return !x.isUserGroup() && x.isVisible() && x.hasAccess() && x.hasCalendarModule() && x.isCalendarModuleEnabled();
            });
            this.mergableSections[session.hostHash].changeEvent.add(event => {
                if (event.type == "add") {
                    event.element.getFileTree().then(fileTree => {
                        fileTree.collection.changeEvent.add(event => this.onFileTreeCollectionEvent(session, event));
                        this.addFilesFromFileTree(session, fileTree);
                    });
                }
                else if (event.type == "remove") {
                    let prefix = event.element.getId();
                    let identifiersToRemove: string[] = [];
                    if (!this.fileModels[session.hostHash]) {
                        this.fileModels[session.hostHash] = {};
                    }
                    for (let identifier in this.fileModels[session.hostHash]) {
                        if ((<any>identifier).startsWith(prefix)) {
                            identifiersToRemove.push(identifier);
                        }
                    }
                    for (let identifier of identifiersToRemove) {
                        delete this.fileModels[session.hostHash][identifier];
                        this.emitFileRemoved(session, identifier);
                    }
                }
            });
            return this.loadFileTrees(session);
        })
        .then(() => {
            initDeferred.resolve();
        });
    }
    
    getPrivateSectionId(): string {
        return this.tasksPlugin.getPrivateSectionId();
    }
    
    getPrivateSection(): Mail.mail.section.SectionService {
        return this.tasksPlugin.getPrivateSection();
    }
    
    getMyId(session: mail.session.Session): string {
        return this.tasksPlugin.getMyId(session);
    }
    
    reset(): void {
        this.initPromise = null;
        this.sidebarSectionsCollection = null;
        this.calendarPrimarySections = {};
        this.mergableSections = {};
        this.fileModels = {};
        this.sessionInitPromises = {};
    }
    
    
    
    
    
    
    
    
    /****************************************
    *************** Settings ****************
    *****************************************/
    loadSettings(session?: mail.session.Session, projectId: string = "__global__"): Q.Promise<void> {
        return this.viewSettings.loadSettings(session, projectId);
    }
    
    saveSetting(session: mail.session.Session, name: string, value: number|string, projectId: string, context: ViewContext): void {
        let res = this.viewSettings.saveSetting(session, name, value, projectId, context);
        if (name == "show-files" && this.searchStr) {
            this.updateSearch(this.searchStr);
        }
        return res;
    }
    
    getSetting(session: mail.session.Session, name: string, projectId: string, context: ViewContext): number|string {
        return this.viewSettings.getSetting(session, name, projectId, context);
    }
    
    
    
    
    
    
    
    
    /****************************************
    **************** Unread *****************
    *****************************************/
    wasTaskUnread(session: mail.session.Session, t: Task, sectionId: string): boolean {
        return this.tasksPlugin.wasTaskUnread(session, t, sectionId);
    }
    
    getUnread(session: mail.session.Session, assignedToMe: boolean = false, createdByMe: boolean = false, skipMuted: boolean = false, trashed: boolean = false): number {
        return this.tasksPlugin.getUnread(session, assignedToMe, createdByMe, skipMuted, trashed);
    }
    
    getUnreadForSection(session: mail.session.Session, sectionId: string, assignedToMe: boolean = false, createdByMe: boolean = false, trashed: boolean = false): number {
        return this.tasksPlugin.getUnreadForSection(session, sectionId, assignedToMe, createdByMe, trashed);
    }
    
    getUnreadForConv2Section(session: mail.session.Session, sectionId: string, skipMuted: boolean = false): number {
        return this.tasksPlugin.getUnreadForConv2Section(session, sectionId, skipMuted);
    }
    
    markTaskAsWatched(session: mail.session.Session, taskId: string, sectionId: string) {
        return this.tasksPlugin.markTaskAsWatched(session, taskId, sectionId);
    }
        
    markTasksAsWatched(session: mail.session.Session, taskIds: Array<string>): Q.Promise<void> {
        return this.tasksPlugin.markTasksAsWatched(session, taskIds);
    }
    
    
    
    
    
    
    
    /****************************************
    **************** Search *****************
    *****************************************/
    searchStr: string = "";
    searchTotalCount: number;
    searchCounts: { [hostHash: string]: { [key: string]: number } };
    searchCountsModified: { [hostHash: string]: { [key: string]: boolean } };
    
    setupSearch() {
        this.searchCounts = this._makeZeroSearchCountsObject();
        this.tasksFilterUpdater = this.tasksPlugin.newTasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = () => {
            this.updateSearchFilter(this.tasksFilterUpdater.filter);
        };
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
        this.searchStr = searchStr;
        let sessions = this.getReadySessions();
        let newSearchCounts: { [hostHash: string]: { [key: string]: number } } = this._makeZeroSearchCountsObject();
        if (searchStr != "") {
            // C2S users cache
            let usersCache: { [hostHash: string]: { [id: string]: string[] } } = {};
            for (let session of sessions) {
                usersCache[session.hostHash] = {};
                for (let c2s of session.conv2Service.collection.list) {
                    usersCache[session.hostHash][c2s.id] = this.tasksPlugin.getConv2Users(session, c2s, true);
                }
            }
            
            // Search
            for (let session of sessions) {
                // Tasks
                if (this.tasksPlugin.tasks[session.hostHash]) {
                    for (let taskId in this.tasksPlugin.tasks[session.hostHash]) {
                        let task = this.tasksPlugin.tasks[session.hostHash][taskId];
                        if (task.getStartTimestamp() == null) {
                            continue;
                        }
                        if (task.getProjectId() in newSearchCounts[session.hostHash]) {
                            let matches = this.tasksPlugin.tasks[session.hostHash][taskId].matchesSearchString(searchStr);
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
                                    if (this.tasksPlugin.isAssignedToUsers(task, usersCache[session.hostHash][c2s.id])) {
                                        newSearchCounts[session.hostHash][c2s.id]++;
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Files
                if (this.getSetting(session, "show-files", null, null)) {
                    let projects: (string|mail.section.SectionService)[] = Object.keys(this.tasksPlugin.projects[session.hostHash])
                        .map(id => session.sectionManager.getSection(id))
                        .filter(x => !!x);
                    projects.push(CustomTasksElements.TRASH_ID);
                    projects.push(CustomTasksElements.ALL_TASKS_ID);
                    projects.push(CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID);
                    projects.push(CustomTasksElements.TASKS_CREATED_BY_ME_ID);
                    for (let project of projects) {
                        if (!(newSearchCounts[session.hostHash])) {
                            newSearchCounts[session.hostHash] = {};
                        }
                        let projectId = (project instanceof mail.section.SectionService) ? project.getId() : project;
                        if (!newSearchCounts[session.hostHash][projectId]) {
                            newSearchCounts[session.hostHash][projectId] = 0;
                        }
                        newSearchCounts[session.hostHash][projectId] += this.getMatchingFilesCount(session, projectId, searchStr);
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
        this.app.dispatchEvent<CalendarSearchUpdateEvent>({
            type: "calendar-search-update",
            searchString: searchStr,
            searchTotalCount: this.searchTotalCount,
        });
    }
    
    getSearchCount(session: mail.session.Session, x: Mail.mail.section.SectionService|Mail.mail.section.Conv2Section|Mail.component.customelementlist.CustomElement): number {
        // console.log("GET")
        // console.log(session.host)
        if (!this.searchCounts) {
            return 0;
        }
        if (!this.searchCounts[session.hostHash]) {
            return 0;
        }
        if (x instanceof Mail.mail.section.SectionService) {
            return this.searchCounts[session.hostHash][x.getId()] || 0;
        }
        else if (x instanceof Mail.mail.section.Conv2Section ) {
            return this.searchCounts[session.hostHash][x.id] || 0;
        }
        else {
            return this.searchCounts[session.hostHash][x.id] || 0;
        }
    }
    
    fileMatchesSearchString(str: string, searchStr: string): boolean {
        str = SearchFilter.prepareHaystack(str).replace(/<(?:.|\n)*?>/gm, '');
        return str.indexOf(searchStr) >= 0;
    }
    
    getMatchingFilesCount(session: mail.session.Session, projectId: string, searchStr: string): number {
        let n = 0;
        let extraCalendars = this.getExtraCalendars(this.session, projectId);
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        for (let identifier in this.fileModels[session.hostHash]) {
            if (this.isFileRelevant(session, projectId, identifier, extraCalendars)) {
                let fileName = this.fileModels[session.hostHash][identifier].fileName;
                if (this.fileMatchesSearchString(fileName, searchStr)) {
                    n++;
                }
            }
        }
        return n;
    }
    
    isFileRelevant(session: mail.session.Session, projectId: string, identifier: string, cachedExtraCalendars: string[] = null): boolean {
        if (cachedExtraCalendars === null) {
            cachedExtraCalendars = this.getExtraCalendars(session, projectId);;
        }
        if (!cachedExtraCalendars || !Array.isArray(cachedExtraCalendars)) {
            cachedExtraCalendars = [];
        }
        let all = projectId == CustomTasksElements.ALL_TASKS_ID || projectId == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || projectId == CustomTasksElements.TASKS_CREATED_BY_ME_ID || projectId == CustomTasksElements.TRASH_ID;
        let isTrash = projectId == CustomTasksElements.TRASH_ID;
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        let fileProjectId = this.fileModels[session.hostHash][identifier].sectionId;
        if (all || fileProjectId == projectId || cachedExtraCalendars.indexOf(fileProjectId) >= 0) {
            let fileModel = this.fileModels[session.hostHash][identifier];
            let isTrashed = fileModel.trashed;
            if (isTrash != isTrashed) {
                return false;
            }
            if (!fileModel.createdAt) {
                return false;
            }
            if (fileModel
                && (projectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.isFileCreatedByMe(session, identifier))
                && (projectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.isFileAssignedToMe(session, identifier))
            ) {
                return true;
            }
        }
        return false;
    }
    
    isFileAssignedToMe(session: mail.session.Session, identifier: string): boolean {
        return false;
    }
    
    isFileCreatedByMe(session: mail.session.Session, identifier: string): boolean {
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        let createdBy = this.fileModels[session.hostHash][identifier].createdBy;
        return createdBy == this.tasksPlugin.getMyId(this.session);
    }
    
    private _makeZeroSearchCountsObject(): { [hostHash: string]: { [key: string]: number } } {
        let searchCounts: { [hostHash: string]: { [key: string]: number } } = {};
        for (let session of this.getReadySessions()) {
            searchCounts[session.hostHash] = {};
            for (let pId in this.tasksPlugin.projects[session.hostHash]) {
                searchCounts[session.hostHash][pId] = 0;
            }
            for (let c2s of session.conv2Service.collection.list) {
                searchCounts[session.hostHash][c2s.id] = 0;
            }
            searchCounts[session.hostHash][CustomTasksElements.ALL_TASKS_ID] = 0;
            searchCounts[session.hostHash][CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID] = 0;
            searchCounts[session.hostHash][CustomTasksElements.TASKS_CREATED_BY_ME_ID] = 0;
            searchCounts[session.hostHash][CustomTasksElements.TRASH_ID] = 0;
        }
        return searchCounts;
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
    
    
    
    
    
    
    
    /****************************************
    ************ Extra calendars ************
    *****************************************/
    getExtraCalendars(session: Mail.mail.session.Session, mainProjectId: string): string[] {
        if (this.app.sessionManager.getLocalSession() != session) {
            return [];
        }
        if (!this.viewSettings.hasProject(session, mainProjectId)) {
            return [];
        }
        let extraCalendars: string[] = JSON.parse(<string>this.getSetting(session, "extra-calendars", mainProjectId, ViewContext.Global));
        if (extraCalendars && Array.isArray(extraCalendars)) {
            return extraCalendars.slice();
        }
        return [];
    }
    
    setExtraCalendars(session: Mail.mail.session.Session, mainProjectId: string, extraCalendars: string[], senderId: string): void {
        this.saveSetting(session, "extra-calendars", JSON.stringify(extraCalendars), mainProjectId, ViewContext.Global);
        this.emitExtraCalendarsChanged(session, mainProjectId, senderId);
    }
    
    getSectionsForWhichIsExtra(session: Mail.mail.session.Session, extraProjectId: string): string[] {
        if (!this.mergableSections[session.hostHash]) {
            return [];
        }
        return this.mergableSections[session.hostHash].list
            .filter(x => this.getExtraCalendars(session, x.getId()).indexOf(extraProjectId) >= 0)
            .map(x => x.getId())
            .filter(x => x != extraProjectId);
    }
    
    
    
    
    
    
    
    /****************************************
    *********** Files in calendar ***********
    *****************************************/
    getFileIdentifier(entry: mail.filetree.nt.Entry): string {
        return entry.tree.section.getId() + ":" + entry.path;
    }

    splitFileIdentifier(identifier: string): { sectionId: string, path: string } {
        let idx = identifier.indexOf(":");
        return {
            sectionId: identifier.substr(0, idx),
            path: identifier.substr(idx + 1),
        };
    }
    
    onFileTreeCollectionEvent(session: mail.session.Session, event: Types.utils.collection.CollectionEvent<mail.filetree.nt.Entry>): void {
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        if (event && event.type == "add" && event.element && event.element.meta && event.element.isFile()) {
            let identifier = this.getFileIdentifier(event.element);
            if (identifier in this.fileModels[session.hostHash]) {
                return;
            }
            let converted = this.convertFile(event.element);
            if (!converted) {
                return;
            }
            this.fileModels[session.hostHash][identifier] = converted;
            if (event.element.meta.createDate) {
                this.emitFileAdded(session, identifier);
            }
            else {
                event.element.tree.refreshDeep(true).then(() => {
                    let converted = this.convertFile(event.element);
                    if (converted) {
                        this.fileModels[session.hostHash][identifier] = converted;
                        this.emitFileAdded(session, identifier);
                    }
                });
            }
        }
        else if (event && event.type == "update" && event.element && event.element.meta && event.element.isFile()) {
            let identifier = this.getFileIdentifier(event.element);
            if (!(identifier in this.fileModels[session.hostHash])) {
                return;
            }
            let converted = this.convertFile(event.element);
            if (!converted) {
                return;
            }
            this.fileModels[session.hostHash][identifier] = converted;
            if (event.element.meta.createDate) {
                this.emitFileAdded(session, identifier);
            }
            else {
                event.element.tree.refreshDeep(true).then(() => {
                    let converted = this.convertFile(event.element);
                    if (converted) {
                        this.fileModels[session.hostHash][identifier] = converted;
                        this.emitFileAdded(session, identifier);
                    }
                });
            }
        }
        else if (event && event.type == "remove" && event.element && event.element.meta && event.element.isFile()) {
            let identifier = this.getFileIdentifier(event.element);
            if (!(identifier in this.fileModels[session.hostHash])) {
                return;
            }
            delete this.fileModels[session.hostHash][identifier];
            this.emitFileRemoved(session, identifier);
        }
        // else if (event && event.type == "update" && event.element && event.element.meta && event.element.isFile()) {
        //     let identifier = this.getFileIdentifier(event.element);
        //     if (!(identifier in this.fileModels[session.hostHash])) {
        //         return;
        //     }
        //     delete this.fileModels[session.hostHash][identifier];
        //     this.emitFileRemoved(session, identifier);
        // }
    }
    
    convertFile(entry: mail.filetree.nt.Entry): FileModel {
        if (mail.thumbs.ThumbsManager.isThumb(entry.path)) {
            return null;
        }
        return {
            createdAt: entry.meta.createDate || (entry.meta.serverCreateDate ? entry.meta.serverCreateDate.getTime() : 0),
            createdBy: entry.meta.owner + "#" + this.identity.host,
            modifiedAt: entry.meta.modifiedDate || 0,
            modifiedBy: entry.meta.modifier + "#" + this.identity.host,
            fileName: entry.name,
            icon: this.resolveFileIcon(entry),
            identifier: this.getFileIdentifier(entry),
            path: entry.path,
            sectionId: entry.tree.section.getId(),
            trashed: entry.path.indexOf("/.trash/") >= 0,
        };
    }
    
    loadFileTrees(session: mail.session.Session): Q.Promise<void> {
        if (!this.mergableSections[session.hostHash]) {
            return Q();
        }
        return Q.all(this.mergableSections[session.hostHash].list.map(x => x.getFileTree())).then(fileTrees => {
            return Q.all(fileTrees.map(x => x.refreshDeep(true))).thenResolve(fileTrees);
        })
        .then(fileTrees => {
            fileTrees.forEach(fileTree => {
                fileTree.collection.changeEvent.add(event => this.onFileTreeCollectionEvent(session, event));
                this.addFilesFromFileTree(session, fileTree, false);
            });
        });
    }
    
    addFilesFromFileTree(session: mail.session.Session, fileTree: mail.filetree.nt.Tree, emit: boolean = true): void {
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        fileTree.collection.forEach(x => {
            if (!x.isFile()) {
                return;
            }
            let identifier = this.getFileIdentifier(x);
            let converted = this.convertFile(x);
            if (converted) {
                this.fileModels[session.hostHash][identifier] = converted;
                if (emit) {
                    this.emitFileAdded(session, identifier)
                }
            }
        });
    }
    
    emitFileAdded(session: mail.session.Session, identifier: string): void {
        this.app.dispatchEvent<CalendarsFileAdded>({
            type: "calendars-file-added",
            identifier: identifier,
            hostHash: session.hostHash,
        });
    }
    
    emitFileRemoved(session: mail.session.Session, identifier: string): void {
        this.app.dispatchEvent<CalendarsFileRemoved>({
            type: "calendars-file-removed",
            identifier: identifier,
            hostHash: session.hostHash,
        });
    }
    
    emitExtraCalendarsChanged(session: mail.session.Session, mainProjectId: string, senderId: string): void {
        this.app.dispatchEvent<ExtraCalendarsChanged>({
            type: "extra-calendars-changed",
            mainProjectId: mainProjectId,
            hostHash: session.hostHash,
            senderId: senderId,
        });
    }
    
    resolveFileIcon(entry: mail.filetree.nt.Entry): string {
        return this.app.shellRegistry.resolveIcon(entry.meta.mimeType);
    }
    
}
