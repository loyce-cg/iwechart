import * as Mail from "pmc-mail";
import Q = Mail.Q;
import {HistoryWindowController} from "../window/history/HistoryWindowController";
import {RecentFilesWindowController} from "../window/recentfiles/RecentFilesWindowController";
import {FileChooserWindowController, FileChooserOptions} from "../window/filechooser/FileChooserWindowController";
import {RecentService, RecentOpenedFile} from "./RecentService";
import {LocationService} from "./LocationService";
import {FilesListController} from "../component/fileslist/FilesListController";
import { SettingsStorage } from "./SettingsStorage";
import { WatchedFilesMap, WatchedFileItem, FilesConst, ViewContext } from "./Common";
import { FileEntryBase, Notes2Utils } from "./Notes2Utils";
import { ViewSettings } from "./ViewSettings";
import {i18n} from "../i18n";
import { LocalFS, LocalOpenableElement } from "./LocalFS";

export interface PersonModel {
    hashmail: string;
    username: string;
    name: string;
    present: boolean;
    description: string;
    deleted?: boolean;
}

export interface RequestOpenFilesEvent extends Mail.Types.event.Event {
    type: "requestopenfiles";
    hashmails: string[];
    showContactsWindow?: boolean;
}

export interface ClipboardFileEntry {
    element: Mail.app.common.shelltypes.OpenableElement;
    entryId?: string;
    cut: boolean;
    local?: boolean;
    hostHash?: string;
}

export interface ClipboardDirectoryEntry {
    entryId: string;
    cut: boolean;
    local?: boolean;
    hostHash?: string;
}

export type Notes2ComponentFactory = Mail.component.ComponentFactory&{
    createComponent(componentName: "notes2filelist", args: [Mail.window.base.BaseWindowController]): FilesListController;
}

export interface RemoveFileEvent extends Mail.Types.event.Event<Q.Promise<void>> {
    type: "fileremoved";
}

export interface PreviewRequestEvent extends Mail.Types.event.Event {
    type: "previewrequest";
    elementType: "directory"|"file"|"clear"|"multi";
    openableElement?: Mail.app.common.shelltypes.OpenableElement;
    directory?: Mail.mail.filetree.nt.Directory;
    selectedCount?: number;
    hostHash: string;
}

export interface UpdateFilesSectionBadgeEvent {
    type: "update-files-section-badge";
    sectionId: string;
    hostHash: string;
}

export interface UpdateWatchedFileEvent {
    type: "update-watched-file";
    fileId: string;
    hostHash: string;
}

export interface UpdateNotes2SettingEvent {
    type: "update-notes2-setting";
    setting: string;
    value: number;
    sourceProjectId: string;
    sourceContext: ViewContext;
    sourceUniqueId: string;
}

export interface UpdateNotes2SidebarSpinnersEvent extends Mail.Types.event.Event {
    type: "update-notes2-sidebar-spinners";
    customElementId?: string;
    conv2SectionId?: string;
    sectionId?: string;
    hostHash?: string;
}

export class Notes2Plugin {
    
    static WATCHED_FILES_HISTORY: string = "plugin.notes2.watchedFilesHistory";
    static VIEW_SETTINGS: string = "plugin.notes2.viewSettings";
    static MARKED_ALL_AS_READ_ENTRY: string = "plugin.notes2.markedAllAsReadEntry";
    
    static contactService: Mail.mail.contact.ContactService;
    
    identity: Mail.privfs.identity.Identity;
    
    errorCallback: (e: any) => any;
    submenu: Mail.app.electronTray.TrayMenuItem;
    sectionManager: Mail.mail.section.SectionManager;
    recentService: RecentService;
    locationService: LocationService;
    filesSections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    files2Sections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    filesRootSections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    
    userPreferences: Mail.mail.UserPreferences.UserPreferences;
    sinkIndexManager: Mail.mail.SinkIndexManager;
    conversationService: Mail.mail.conversation.ConversationService;
    conv2Service: Mail.mail.section.Conv2Service;
    contactService: Mail.mail.contact.ContactService;
    settingsStorage: SettingsStorage;
    watchedFilesHistory: { [hostHash: string]: { [sectionId: string]: WatchedFilesMap } } = {};
    filesUnreadCountModel: Mail.utils.Model<number> = new Mail.utils.Model(0);
    filesUnreadCountFullyLoadedModel: Mail.utils.Model<boolean> = new Mail.utils.Model(false);
    unreadFilesBySection: { [hostHash: string]: { [sectionId: string]: number } } = {};
    unreadFileIds: { [hostHash: string]: { [fileId: string]: boolean } } = {};
    lastProcessedIds: { [hostHash: string]: { [sectionId: string]: number } } = {};
    activeWindowFocused: string;
    activeFilesList: FilesListController;
    activeSinkId: string;
    activeSinkHostHash: string;
    viewSettings: ViewSettings;
    onReset: Q.Deferred<void> = Q.defer();
    recentFilesWindowController: RecentFilesWindowController;
    loadedDeferred: Q.Deferred<void> = Q.defer();
    sectionsWithSpinner: { [hostHash: string]: { [id: string]: boolean } } = {};
    sessionInitPromises: { [hostHash: string]: Q.Promise<void> } = {};
    
    constructor(public app: Mail.app.common.CommonApplication) {
    }
    
    registerTexts(localeService: Mail.mail.LocaleService): void {
        localeService.registerTexts(i18n, "plugin.notes2.");
    }
    
    isChatPluginPresent(): boolean {
        return this.app.getComponent("chat-plugin") != null;
    }
    
    isTasksPluginPresent(): boolean {
        return this.app.getComponent("tasks-plugin") != null;
    }
    
    loadUserSettingsForImport(settingsKvdb: any): Q.Promise<void> {
        return Q().then(() => {
            this.viewSettings = new ViewSettings(Notes2Plugin.VIEW_SETTINGS, <any>settingsKvdb);
            return this.loadSettings(null, "__global__");
        })
    }
    
    initializeSessionCollectionsAndTrees(session: Mail.mail.session.Session): Q.Promise<void> {
        if (this.sessionInitPromises[session.hostHash]) {
            return this.sessionInitPromises[session.hostHash];
        }
        let initDeferred = Q.defer<void>();
        this.sessionInitPromises[session.hostHash] = initDeferred.promise;
        this.watchedFilesHistory[session.hostHash] = {};
        this.unreadFilesBySection[session.hostHash] = {};
        this.unreadFileIds[session.hostHash] = {};
        this.sectionsWithSpinner[session.hostHash] = {};
        this.filesSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => true);
        this.files2Sections[session.hostHash] = new Mail.utils.collection.FilteredCollection(this.filesSections[session.hostHash], x => !x.isPrivateOrUserGroup());
        this.filesRootSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.rootSectionsCollection, x => x.isFileModuleEnabled(true));
        this.filesSections[session.hostHash].changeEvent.add(event => this.onFilesSectionChange(session, event));
        let promises: Q.Promise<Mail.mail.SinkIndex>[] = [];
        this.filesSections[session.hostHash].forEach(section => {
            if (section.hasChatModule()) {
                promises.push(section.getChatSinkIndex());
            }
            section.getFileTree().then(tree => {
                if (tree) {
                    tree.refreshDeep(true);
                }
            });
        });
        return Q.all(promises)
        .then(() => {
            this.unreadFilesBySection[session.hostHash][FilesListController.TRASH_FILES] = 0;
            let promises: Q.Promise<void>[] = [];
            let delayedUnreadSections: Mail.mail.section.SectionService[] = [];
            this.filesSections[session.hostHash].forEach(section => {
                promises.push(this.readWatchedFilesHistory(session, section.getId()).then(() => {
                    return section.getChatSinkIndex();
                })
                .then(sinkIndex => {
                    if (sinkIndex) {
                        this.processSectionUnread(session, section, sinkIndex);
                    }
                    else {
                        delayedUnreadSections.push(section);
                    }
                }));
            });
            return Q.all(promises).then(() => {
                this.updateTotalUnreadFilesCount();
                this.updateTrashBadge();
                this.updateAllFilesBadge();
                this.filesUnreadCountFullyLoadedModel.setWithCheck(true);
                if (delayedUnreadSections.length > 0) {
                    this.loadedDeferred.promise.then(() => {
                        setTimeout(() => {
                            Q.all(delayedUnreadSections.map(section => {
                                return section.getChatSinkIndex().then(sinkIndex => {
                                    if (sinkIndex) {
                                        this.processSectionUnread(session, section, sinkIndex);
                                    }
                                });
                            }))
                            .then(() => {
                                this.updateTotalUnreadFilesCount();
                                this.updateTrashBadge();
                                this.updateAllFilesBadge();
                            });
                        }, 1000);
                    });
                }
            });
        })
        .then(() => {
            initDeferred.resolve();
        });
    }

    load(): Q.Promise<void> {
        if (this.app.mailClientApi == null) {
            return Q();
        }
        // return Q().then(() => {
        //     return (<any>this.app.sessionManager).initAfterLogin();
        // })
        return Q().then(() => {
            return Q.all([
                Q.all([
                    this.app.mailClientApi.prepareAndGetSectionManager(),
                    this.app.mailClientApi.privmxRegistry.getUserPreferences(),
                    this.app.mailClientApi.privmxRegistry.getSinkIndexManager(),
                    this.app.mailClientApi.privmxRegistry.getConversationService(),
                    this.app.mailClientApi.privmxRegistry.getIdentity(),
                    this.app.mailClientApi.privmxRegistry.getConv2Service(),
                ]), 
                Q.all([
                    this.app.mailClientApi.privmxRegistry.getUserSettingsKvdb(),
                    this.app.mailClientApi.privmxRegistry.getContactService(),
                ]),
            ]);
        })
        .then(res => {
            let localSession = this.app.sessionManager.getLocalSession();
            this.sectionManager = res[0][0];
            this.userPreferences = res[0][1];
            this.sinkIndexManager = res[0][2];
            this.conversationService = res[0][3];
            this.identity = res[0][4];
            this.conv2Service = res[0][5];
            this.contactService = res[1][1];
            this.settingsStorage = new SettingsStorage(Notes2Plugin.WATCHED_FILES_HISTORY, <any>res[1][0]);
            this.viewSettings = new ViewSettings(Notes2Plugin.VIEW_SETTINGS, <any>res[1][0]);
            this.userPreferences.eventDispatcher.addEventListener<Mail.Types.event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this));
            this.recentService = new RecentService(this.app, this.sectionManager, this.userPreferences, this.sinkIndexManager, this);
            this.locationService = new LocationService(this.app, this.sectionManager, this.sinkIndexManager, this.conversationService);
            Notes2Plugin.contactService = this.contactService;
            return this.initializeSessionCollectionsAndTrees(localSession);
        }).then(() => {
            return this.loadSettings(null, "__global__");
        }).then(() => {
            this.app.eventDispatcher.dispatchEvent<Mail.Types.event.PluginModuleReadyEvent>({type: "plugin-module-ready", name: Mail.Types.section.NotificationModule.NOTES2});

            this.app.addEventListener<Mail.Types.event.MarkAsReadEvent>("mark-as-read", event => {
                let sessions: Mail.mail.session.Session[] = event.hostHash ? [this.app.sessionManager.getSessionByHostHash(event.hostHash)] : this.getReadySessions();
                if (event.moduleName == "notes2" || !event.moduleName) {
                    let projectId = event.sectionId || event.conversationId || event.customElementId;
                    Q().then(() => {
                        this.app.dispatchEvent<Mail.Types.event.SetBubblesState>({
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
                        this.app.dispatchEvent<Mail.Types.event.SetBubblesState>({
                            type: "set-bubbles-state",
                            markingAsRead: false,
                            scope: event,
                        });
                    });
                }
            });
            this.app.addEventListener<Mail.Types.event.SetBubblesState>("set-bubbles-state", e => {
                if (e.scope.moduleName && e.scope.moduleName != "notes2") {
                    return;
                }
                let newState = e.markingAsRead;
                let hostHash: string = e.scope.hostHash;
                let id = e.scope.conversationId || e.scope.customElementId || e.scope.sectionId || "__all__";
                
                if (hostHash) {
                    if (!this.sectionsWithSpinner[hostHash]) {
                        this.sectionsWithSpinner[hostHash] = {};
                    }
                    this.sectionsWithSpinner[hostHash][id] = newState;
                }
                else {
                    for (let session of this.getReadySessions()) {
                        this.sectionsWithSpinner[session.hostHash][id] = newState;
                    }
                }
                
                this.app.dispatchEvent<UpdateNotes2SidebarSpinnersEvent>({
                    type: "update-notes2-sidebar-spinners",
                    conv2SectionId: e.scope.conversationId || undefined,
                    customElementId: e.scope.customElementId || undefined,
                    sectionId: e.scope.sectionId || undefined,
                    hostHash: e.scope.hostHash || undefined,
                });
            });
            
            this.app.addEventListener<Mail.Types.event.HostSessionCreatedEvent>("hostSessionCreated", event => {
                // console.log("XX - On hostSessionCreated event fired..");
                let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
                this.initializeSessionCollectionsAndTrees(session);
            });
        }).then(() => {
            this.loadedDeferred.resolve();
        });
    }

    isFirstLogin(): boolean {
        return ! this.userPreferences.getValue<boolean>("ui.seenFirstLoginInfo-notes2", false);
    }

    setFirstLoginDone(): void {
        this.userPreferences.set("ui.seenFirstLoginInfo-notes2", 1, true);
    }
    
    onFilesSectionChange(session: Mail.mail.session.Session, event: Mail.Types.utils.collection.CollectionEvent<Mail.mail.section.SectionService>) {
        if (event.element != null) {
            if (event.element.hasChatModule()) {
                event.element.getChatSinkIndex().then(sinkIndex => {
                    if (event.type == "add") {
                        let section = event.element;
                        this.processSectionUnread(session, section, sinkIndex);
                        this.updateTotalUnreadFilesCount();
                    }
                    if (
                        this.activeFilesList
                        && this.activeFilesList.session && this.activeFilesList.session.hostHash == session.hostHash
                        && this.activeFilesList.filesInfo && this.activeFilesList.filesInfo.conversation && this.activeFilesList.filesInfo.conversation.section && this.activeFilesList.filesInfo.conversation.section.getId() == event.element.getId()
                    ) {
                        this.activeSinkId = event.element.getChatSink().id;
                        this.activeSinkHostHash = (this.activeFilesList && this.activeFilesList.session ? this.activeFilesList.session.hostHash : null) || this.app.sessionManager.getLocalSession().hostHash;
                    }
                });
            }
            this.updateTotalUnreadFilesCount();
        }
    }
    
    processSectionUnread(session: Mail.mail.session.Session, section: Mail.mail.section.SectionService, sinkIndex: Mail.mail.SinkIndex) {
        sinkIndex.changeEvent.add((_event, _sinkIndex, sinkIndexEntry) => {
            if (_event == "new" || _event == "update") {
                this.processMessage(session, section.getId(), sinkIndexEntry, true);
            }
            if (_event == "new" && sinkIndexEntry && sinkIndexEntry.source.data.contentType == "application/json") {
                let obj = sinkIndexEntry.getContentAsJson();
                if (obj && (obj.type == "create-file" || obj.type == "delete-file" || obj.type == "rename-file" || obj.type == "move-file")) {
                    section.getFileTree().then(tree => {
                        if (tree) {
                            tree.refreshDeep(true);
                        }
                    });
                }
            }
        });
    
        let sectionId = section.getId();
        if (!this.unreadFilesBySection[session.hostHash]) {
            this.unreadFilesBySection[session.hostHash] = {};
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        this.unreadFilesBySection[session.hostHash][sectionId] = 0;
        let x = sinkIndex.entries.indexMap.lastIndexOf(null);
        let startIndex = x >= 0 ? (x + 1) : 0;
        for (let k in this.unreadFileIds[session.hostHash]) {
            if (k.indexOf("section|file|" + sectionId + "|") >= 0) {
                this.unreadFilesBySection[session.hostHash][sectionId]++;
            }
        }
        for (let i = startIndex, len = sinkIndex.entries.indexMap.length; i < len; ++i) {
            this.processMessage(session, sectionId, sinkIndex.entries.list[sinkIndex.entries.indexMap[i]], false);
        }
        this.updateSectionBadge(session, section.getId());
    }
    
    reset() {
        this.onReset.resolve();
        this.onReset = Q.defer();
        this.loadedDeferred = Q.defer();
        this.sectionManager = null;
        this.userPreferences = null;
        this.sinkIndexManager = null;
        this.conversationService = null;
        this.recentService = null;
        this.locationService = null;
        this.identity = null;
        this.conv2Service = null;
        this.settingsStorage = null;
        this.viewSettings = null;
        this.files2Sections = {};
        this.filesSections = {};
        this.filesRootSections = {};
        this.filesUnreadCountModel.setWithCheck(0);
        this.filesUnreadCountFullyLoadedModel.setWithCheck(false);
        this.unreadFilesBySection = {};
        this.unreadFileIds = {};
        this.lastProcessedIds = {};
        this.sectionsWithSpinner = {};
        this.sessionInitPromises = {};
        if (this.app.isElectronApp() && this.recentFilesWindowController) {
            this.recentFilesWindowController.allowClose = true;
            if (this.recentFilesWindowController.nwin) {
                this.recentFilesWindowController.nwin.close();
            }
            this.recentFilesWindowController = null;
        }
    }
    
    afterRecentFileRenamed(file: RecentOpenedFile): void {
        if (this.app.isElectronApp() && this.recentFilesWindowController) {
            this.recentFilesWindowController.afterRecentFileRenamed(file);
        }
    }


    openHistory(fromEvent: Mail.Types.event.OpenHistoryViewEvent): void {
        let session = this.app.sessionManager.getSessionByHostHash(fromEvent.hostHash);
        this.app.ioc.create(HistoryWindowController, [fromEvent.parent, session, fromEvent.fileSystem, fromEvent.path]).then(win => {
            fromEvent.parent.openChildWindow(win);
        });
    }
    
    openTask(session: Mail.mail.session.Session, _sectionId: string, id: string): void {
        let tasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksPlugin) {
            return;
        }
        (<any>tasksPlugin).openEditTaskWindow(session, id, true);
    }
    
    openRecent() {
        if (this.app.isElectronApp() && this.recentFilesWindowController && this.recentFilesWindowController.nwin) {
            this.recentFilesWindowController.nwin.show();
            this.recentFilesWindowController.createNewDeferred();
            return this.recentFilesWindowController.getPromise();
        }
        return this.app.ioc.create(RecentFilesWindowController, [this.app]).then(win => {
            this.recentFilesWindowController = win;
            return this.app.openChildWindow(win).getPromise();
        });
    }
    
    openFileChooser(parentWindow: Mail.Types.app.WindowParent, session: Mail.mail.session.Session, section: Mail.mail.section.SectionService, context: string, selectedPath?: string, options: FileChooserOptions = {}) {
        return this.app.ioc.create(FileChooserWindowController, [this.app, session, section, selectedPath, options])
        .then(win => {
            win.parent = parentWindow.getClosestNotDockedController();
            this.app.openSingletonWindow("fileChooser-" + context, <Mail.window.base.BaseWindowController>win);
            return win.getPromise().then(res => {
                return res;
            });
        });
    }
    
    readWatchedFilesHistory(session: Mail.mail.session.Session, sectionId: string): Q.Promise<void> {
        let key = this.getWatchedFilesHistoryKey(session, sectionId);
        return Q().then(() => {
            return this.settingsStorage.getArray(key);
        }).then(history => {
            this.watchedFilesHistory[session.hostHash][sectionId] = {};
            history.forEach((x: any) => this.watchedFilesHistory[session.hostHash][sectionId][x.id] = x);
            return;
        });
    }
    
    getLastMarkedAllAsRead(session: Mail.mail.session.Session, sectionId: string): number {
        if (!this.watchedFilesHistory || !this.watchedFilesHistory[session.hostHash] || !this.watchedFilesHistory[session.hostHash][sectionId]) {
            return null;
        }
        let hist = this.watchedFilesHistory[session.hostHash][sectionId];
        return hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY] ? hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY].lastWatched : null;
    }
    
    setLastMarkedAllAsRead(session: Mail.mail.session.Session, sectionId: string): void {
        if (!this.watchedFilesHistory) {
            this.watchedFilesHistory = {};
        }
        if (!this.watchedFilesHistory[session.hostHash]) {
            this.watchedFilesHistory[session.hostHash] = {};
        }
        if (!this.watchedFilesHistory[session.hostHash][sectionId]) {
            this.watchedFilesHistory[session.hostHash][sectionId] = {};
        }
        let hist = this.watchedFilesHistory[session.hostHash][sectionId];
        hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY] = {
            id: Notes2Plugin.MARKED_ALL_AS_READ_ENTRY,
            lastWatched: new Date().getTime(),
            sectionId: sectionId,
        }
        let key = this.getWatchedFilesHistoryKey(session, sectionId);
        this.settingsStorage.setValue(key, [hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY]]);
    }

    writeWatchedFilesHistory(session: Mail.mail.session.Session, sectionId: string, fileItem: WatchedFileItem) {
        let key = this.getWatchedFilesHistoryKey(session, sectionId);
        this.settingsStorage.setValue(key, [fileItem]);
    }
    
    getWatchedFilesHistoryKey(session: Mail.mail.session.Session, sectionId: string): string {
        if (session.host == this.app.sessionManager.getLocalSession().host) {
            return sectionId;
        }
        return `${session.hostHash}--${sectionId}`;
    }
    
    markFilesAsWatched(session: Mail.mail.session.Session, files: FileEntryBase[], markSectionsAsRead: string[], trash: boolean): Q.Promise<void> {
        let filesSections: { [sectionId: string]: WatchedFileItem[]} = {};
        let updateTrash = false;
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        for (let i = 0, l = files.length; i < l; ++i) {
            let file = files[i];
            if (!Notes2Utils.isFsFileEntry(file) || !this.wasUnread(session, file)) {
                return Q();
            }
            let sectionId = file.tree.section.getId();
            if (!(session.hostHash in this.watchedFilesHistory)) {
                this.watchedFilesHistory[session.hostHash] = {};
            }
            if (!(sectionId in this.watchedFilesHistory[session.hostHash])) {
                this.watchedFilesHistory[session.hostHash][sectionId] = {};
            }
            if (!(sectionId in filesSections)) {
                filesSections[sectionId] = [];
            }
            if (this.wasUnread(session, file)) {
                let watchedElement = {id: file.id, sectionId: sectionId, lastWatched: new Date().getTime()};
                this.watchedFilesHistory[session.hostHash][sectionId][file.id] = watchedElement;
                filesSections[sectionId].push(watchedElement);
            }
            delete this.unreadFileIds[session.hostHash][file.id];
            if (file.path.indexOf(FilesConst.TRASH_PATH) >= 0) {
                this.unreadFilesBySection[session.hostHash][FilesListController.TRASH_FILES] = Math.max(0, this.unreadFilesBySection[session.hostHash][FilesListController.TRASH_FILES] - 1);
                updateTrash = true;
            }
            else {
                this.unreadFilesBySection[session.hostHash][sectionId] = Math.max(0, this.unreadFilesBySection[session.hostHash][sectionId] - 1);
            }
            this.app.dispatchEvent<UpdateWatchedFileEvent>({
                type: "update-watched-file",
                fileId: file.id,
                hostHash: session.hostHash,
            });
        }
        this.updateTotalUnreadFilesCount();
        this.updateAllFilesBadge();
        if (updateTrash) {
            this.updateTrashBadge();
        }
        for (let sectionId in filesSections) {
            let key = this.getWatchedFilesHistoryKey(session, sectionId);
            this.settingsStorage.setValue(key, filesSections[sectionId]);
            this.updateSectionBadge(session, sectionId);
        }
        for (let sectionId of markSectionsAsRead) {
            this.setLastMarkedAllAsRead(session, sectionId);
            this.unreadFilesBySection[session.hostHash][sectionId] = 0;
            let str = this.getSectionPrefix(sectionId);
            for (let id in this.unreadFileIds[session.hostHash]) {
                let trashed = id.indexOf(FilesConst.TRASH_PATH + "/") >= 0;
                if (id.indexOf(str) == 0 && trashed == trash) {
                    this.delFromUnread(session, id, id, sectionId, false);
                }
            }
            if (!trash) {
                this.updateSectionBadge(session, sectionId);
            }
        }
        this.updateAllFilesBadge();
        if (markSectionsAsRead.length > 0 && trash) {
            this.updateTrashBadge();
        }
        this.updateTotalUnreadFilesCount();
        return Q();
    }
    
    updateSectionBadge(session: Mail.mail.session.Session, sectionId: string): void {
        this.app.dispatchEvent<UpdateFilesSectionBadgeEvent>({
            type: "update-files-section-badge",
            sectionId: sectionId,
            hostHash: session.hostHash,
        });
    }
    
    updateAllFilesBadge(): void {
        this.updateSectionBadge(this.app.sessionManager.getLocalSession(), FilesListController.ALL_FILES);
    }
    
    updateTrashBadge(): void {
        this.updateSectionBadge(this.app.sessionManager.getLocalSession(), FilesListController.TRASH_FILES);
    }
        
    markFileAsWatched(session: Mail.mail.session.Session, file: FileEntryBase) {
        this.markFilesAsWatched(session, [file], [], false);
    }
    
    markFileAsWatchedById(session: Mail.mail.session.Session, fileId: string, sectionId: string) {
        if (!this.unreadFileIds[session.hostHash] || !this.unreadFileIds[session.hostHash][fileId]) {
            return;
        }
        session.sectionManager.getSection(sectionId).getFileTree().then(tree => {
            let file = tree.collection.find(x => x.id == fileId);
            if (file) {
                this.markFileAsWatched(session, file);
            }
        });
    }
    
    wasUnread(session: Mail.mail.session.Session, file: FileEntryBase): boolean {
        if (!Notes2Utils.isFsFileEntry(file)) {
            return false;
        }
        return (session.hostHash in this.unreadFileIds) && (file.id in this.unreadFileIds[session.hostHash]);
    }
    
    wasDirUnread(session: Mail.mail.session.Session, dir: Mail.mail.filetree.nt.Directory): boolean {
        let id = dir.id;
        if (id.length > 1 && id[id.length - 1] != "/") {
            id += "/";
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        for (let fileId in this.unreadFileIds[session.hostHash]) {
            if (fileId.indexOf(id) == 0 && this.unreadFileIds[session.hostHash][fileId]) {
                return true;
            }
        }
        return false;
    }
    
    wasUnread2(session: Mail.mail.session.Session, fileId: string, sectionId: string, modifiedBy: string, modifiedDate: number): boolean {
        let unread: boolean = false;
        let inHistory = this.watchedFilesHistory[session.hostHash][sectionId] ? this.watchedFilesHistory[session.hostHash][sectionId][fileId] : null;
        if (modifiedBy != session.userData.identity.hashmail && modifiedBy != session.userData.identity.user) {
            if (!inHistory || inHistory.lastWatched < modifiedDate) {
                let lastAllMarked = this.getLastMarkedAllAsRead(session, sectionId);
                if (!lastAllMarked || lastAllMarked < modifiedDate) {
                    unread = true;
                }
            }
        }
        return unread;
    }
    
    updateTotalUnreadFilesCount(): void {
        this.filesUnreadCountModel.setWithCheck(this.getUnreadFilesCount());
    }
    
    getUnreadFilesCount(): number {
        if (this.userPreferences == null) {
            return 0;
        }
        let unreadFiles = 0;
        for (let session of this.getReadySessions()) {
            for (let section of this.filesSections[session.hostHash].list) {
                if (!section.userSettings.mutedModules.notes2 && section.isFileModuleEnabled()) {
                    unreadFiles += this.unreadFilesBySection[session.hostHash][section.getId()] || 0;
                }
            }
        }
        return unreadFiles;
    }
    
    processMessage(session: Mail.mail.session.Session, sectionId: string, sinkIndexEntry: Mail.mail.SinkIndexEntry, dispatchEvents: boolean): void {
        if (!sinkIndexEntry || !sinkIndexEntry.source) {
            return;
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        if (sinkIndexEntry.source.data.contentType == "application/json") {
            let data = sinkIndexEntry.getContentAsJson();
            if (!data) {
                return;
            }
            let allowedTypes = [
                "create-file",
                "rename-file",
                "delete-file",
                "move-file",
                "save-file",
                "delete-file-permanent",
                "create-directory",
                "rename-directory",
                "delete-directory",
                "delete-directory-permanent",
            ];
            if (allowedTypes.indexOf(data.type) < 0) {
                return;
            }
            if (!this.lastProcessedIds[session.hostHash]) {
                this.lastProcessedIds[session.hostHash] = {};
            }
            if (sinkIndexEntry.id <= this.lastProcessedIds[session.hostHash][sectionId]) {
                return;
            }
            this.lastProcessedIds[session.hostHash][sectionId] = sinkIndexEntry.id;
            let fileId = data.path ? Mail.mail.filetree.nt.Entry.getId(sectionId, data.path) : "";

            if (this.activeFilesList) {
                this.activeFilesList.refreshTree(true);
            }
            
            if (data.type == "move-file") {
                let oldSectionId = data.oldSectionId;
                let newSectionId = data.newSectionId;
                if (!oldSectionId && !newSectionId) {
                    // Old message - no section information
                    // Delete old and new file id from unread in all sections
                    for (let section of this.sectionManager.sectionsCollection.list) {
                        let oldFileId = data.oldPath ? Mail.mail.filetree.nt.Entry.getId(section.getId(), data.oldPath) : "";
                        let newFileId = data.newPath ? Mail.mail.filetree.nt.Entry.getId(section.getId(), data.newPath) : "";
                        this.delFromUnread(session, data.oldPath, oldFileId, section.getId(), dispatchEvents);
                        this.delFromUnread(session, data.newPath, newFileId, section.getId(), dispatchEvents);
                    }
                }
                else {
                    // New move-file message (has section information)
                    let oldFileId = data.oldPath ? Mail.mail.filetree.nt.Entry.getId(oldSectionId, data.oldPath) : "";
                    let newFileId = data.newPath ? Mail.mail.filetree.nt.Entry.getId(newSectionId, data.newPath) : "";
                    this.delFromUnread(session, data.oldPath, oldFileId, oldSectionId, dispatchEvents);
                    this.addToUnread(session, data.newPath, newFileId, sinkIndexEntry, newSectionId, dispatchEvents);
                }
            }
            if (data.type == "create-file") {
                this.addToUnread(session, data.path, fileId, sinkIndexEntry, sectionId, dispatchEvents);
            }
            
            
            if (data.type == "save-file") {
                if (this.activeFilesList && this.activeFilesList.activeCollection) {
                    let active = this.activeFilesList.activeCollection.active;
                    if (active) {
                        let parsedId = Mail.mail.filetree.nt.Entry.parseId(active.obj.id);
                        if (parsedId && parsedId.sectionId == data.sectionId && parsedId.path == data.path && this.activeFilesList.session.hostHash == session.hostHash) {
                            this.activeFilesList.loadFilePreview();
                        }
                    }
                }
                
                if (this.recentFilesWindowController && dispatchEvents && fileId) {
                    this.recentFilesWindowController.invalidateCache(fileId);
                }
            }
            else if (data.type == "rename-file") {
                let oldFileId = data.oldPath ? Mail.mail.filetree.nt.Entry.getId(sectionId, data.oldPath) : "";
                let newFileId = data.newPath ? Mail.mail.filetree.nt.Entry.getId(sectionId, data.newPath) : "";
                this.delFromUnread(session, data.oldPath, oldFileId, sectionId, dispatchEvents);
                this.addToUnread(session, data.newPath, newFileId, sinkIndexEntry, sectionId, dispatchEvents);
            }
            else if (data.type == "delete-file") {
                if (data.trashPath && (fileId in this.unreadFileIds[session.hostHash])) {
                    //@todo untested (trashPath null ATM, requires privfs-client-js changes)
                    let trashFileId = this.fixTrashPath(Mail.mail.filetree.nt.Entry.getId(sectionId, FilesConst.TRASH_PATH + data.trashPath));
                    this.addToUnread(session, data.trashPath, trashFileId, sinkIndexEntry, FilesListController.TRASH_FILES, dispatchEvents);
                }
                this.delFromUnread(session, data.path, fileId, sectionId, dispatchEvents);
            }
            else if (data.type == "delete-file-permanent") {
                this.delFromUnread(session, data.path, fileId, sectionId, dispatchEvents);
            }
            else if (data.type == "rename-directory") {
                this.forEachUnreadMatching(session, sectionId, data.oldPath, (id, prefix) => {
                    let len = (prefix + data.oldPath).length;
                    let newId = prefix + data.newPath + id.substr(len);
                    this.delFromUnread(session, id, id, sectionId, dispatchEvents);
                    this.addToUnread(session, newId, newId, sinkIndexEntry, sectionId, dispatchEvents);
                });
            }
            else if (data.type == "delete-directory") {
                this.forEachUnreadMatching(session, sectionId, data.path, (id, prefix) => {
                    this.delFromUnread(session, id, id, sectionId, dispatchEvents);
                    if (data.trashPath) {
                        //@todo untested (trashPath null ATM, requires privfs-client-js changes)
                        let len = (prefix + data.path).length;
                        let newPath = data.trashPath + id.substr(len);
                        let trashFileId = Mail.mail.filetree.nt.Entry.getId(sectionId, FilesConst.TRASH_PATH + newPath);
                        this.addToUnread(session, trashFileId, trashFileId, sinkIndexEntry, sectionId, dispatchEvents);
                    }
                });
            }
            else if (data.type == "delete-directory-permanent") {
                //@todo untested (deleting from trash is disabled ATM)
                this.forEachUnreadMatching(session, sectionId, data.path, id => {
                    this.delFromUnread(session, id, id, sectionId, dispatchEvents);
                });
            }
            if (dispatchEvents) {
                this.updateAllFilesBadge();
                this.updateTotalUnreadFilesCount();
            }
        }
    }
    
    forEachUnreadMatching(session: Mail.mail.session.Session, sectionId: string, path: string, func: (id: string, prefix: string) => void) {
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        let str = this.getSectionPrefix(sectionId);
        for (let id in this.unreadFileIds[session.hostHash]) {
            if (id.indexOf(str + path + "/") == 0) {
                func(id, str);
            }
        }
    }
    
    getSectionPrefix(sectionId: string): string {
        return "section|file|" + sectionId + "|";
    }
    
    addToUnread(session: Mail.mail.session.Session, path: string, fileId: string, sinkIndexEntry: Mail.mail.SinkIndexEntry, sectionId: string, dispatchEvents: boolean): void {
        if (Mail.mail.thumbs.ThumbsManager.isThumb(path)) {
            return;
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        if (!(fileId in this.unreadFileIds[session.hostHash]) && this.wasUnread2(session, fileId, sectionId, sinkIndexEntry.source.data.sender.hashmail, sinkIndexEntry.source.data.createDate)) {
            this.unreadFileIds[session.hostHash][fileId] = true;
            let targetId = path.indexOf(FilesConst.TRASH_PATH) < 0 ? sectionId : FilesListController.TRASH_FILES;
            this.unreadFilesBySection[session.hostHash][targetId]++;
            this.unreadFilesBySection[session.hostHash][FilesListController.TRASH_FILES] = 0; //@todo remove while doing #1093
            if (dispatchEvents) {
                this.updateSectionBadge(session, targetId);
                this.app.dispatchEvent<UpdateWatchedFileEvent>({
                    type: "update-watched-file",
                    fileId: fileId,
                    hostHash: session.hostHash,
                });
            }
        }
    }
    
    delFromUnread(session: Mail.mail.session.Session, path: string, fileId: string, sectionId: string, dispatchEvents: boolean): void {
        if (Mail.mail.thumbs.ThumbsManager.isThumb(path)) {
            return;
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        if (fileId in this.unreadFileIds[session.hostHash]) {
            delete this.unreadFileIds[session.hostHash][fileId];
            let targetId = path.indexOf(FilesConst.TRASH_PATH) < 0 ? sectionId : FilesListController.TRASH_FILES;
            this.unreadFilesBySection[session.hostHash][targetId] = Math.max(0, this.unreadFilesBySection[session.hostHash][targetId] - 1);
            if (dispatchEvents) {
                this.updateSectionBadge(session, targetId);
            }
        }
    }
    
    onUserPreferencesChange(): void {
        this.updateTotalUnreadFilesCount();
    }
    
    onPollingResult(entries: Mail.mail.PollingItem[]) {
        if (entries) {
            entries.forEach(entry => {
                this.notifyUser(entry);
            })
        }
    }

    isPollingItemComingFromMe(item: Mail.mail.PollingItem): boolean {
        if (item.entry) {
            let session = this.app.sessionManager.getSession(item.entry.host);
            let message = item.entry.getMessage();
            if (message.sender.pub58 == session.userData.identity.pub58) {
                return true;
            }
        }
        return false;
    }
    
    getContextFromSinkId(session: Mail.mail.session.Session, sinkId: string): string {
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
        if (!sinkIndexEntry || !sinkIndexEntry.entry || !sinkIndexEntry.entry.source) {
            return;
        }
        if (!this.app.sessionManager.isSessionExistsByHost(sinkIndexEntry.entry.host)) {
            return;
        }
        let session = this.app.sessionManager.getSession(sinkIndexEntry.entry.host);
        
        if (this.isModuleFiltered(session, sinkIndexEntry.entry.index.sink.id)) {
            return;
        }
        
        if (this.isPollingItemComingFromMe(sinkIndexEntry)) {
            return;
        }
        
        let section = session.sectionManager.filteredCollection.list.find(x => x.getChatSink() && x.getChatSink().id == sinkIndexEntry.entry.sink.id);
        if (!section) {
            return;
        }
        if (!section.isFileModuleEnabled()) {
            return;
        }
                
        if (sinkIndexEntry.entry.source.data.contentType == "application/json") {
            if (sinkIndexEntry.newStickers && sinkIndexEntry.newStickers.length > 0) {
                return;
            }
            let data = sinkIndexEntry.entry.getContentAsJson();
            if (!data || data.type != "create-file" && data.type != "rename-file" && data.type != "delete-file") {
                return;
            }
            let context = this.getContextFromSinkId(session, sinkIndexEntry.entry.sink.id);
            this.createFileNotification(session, data.type, sinkIndexEntry.entry.source.data.sender.hashmail, context, data.type == "create-file" || data.type == "delete-file"? data.path : data.oldPath, data.newPath);
        }
    }
    
    createFileNotification(session: Mail.mail.session.Session, type: string, sender: string, context: string, path: string, path2?: string) {
        let text: string;
        let fileName = path.substring(path.lastIndexOf("/") + 1);
        if (type == "create-file") {
            text = this.app.localeService.i18n("plugin.notes2.notification.createFile") + " " + fileName;
        }
        else if (type == "delete-file") {
            text = this.app.localeService.i18n("plugin.notes2.notification.deleteFile") + " " + fileName;
        }
        else if (type == "rename-file") {
            let oldPath = path || "";
            let newPath = path2 || "";
            let oldName = oldPath.substring(oldPath.lastIndexOf("/") + 1);
            let newName = newPath.substring(newPath.lastIndexOf("/") + 1);
            text = this.app.localeService.i18n("plugin.notes2.notification.renameFile") + " " + oldName + " " + this.app.localeService.i18n("plugin.notes2.notification.renameFile.to") + " " + newName;
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
                    module: Mail.Types.section.NotificationModule.NOTES2,
                    sinkId: context,
                    hostHash: session.hostHash,
                },
            }
        };
        this.app.dispatchEvent<Mail.Types.event.NotificationServiceEvent>(event);
    }
    
    isModuleFiltered(session: Mail.mail.session.Session, sinkId: string): boolean {
        let filtered = this.isModuleMuted(session, sinkId) || ((this.activeSinkId === sinkId) && (this.activeSinkHostHash === session.hostHash) && this.activeWindowFocused === Mail.Types.section.NotificationModule.NOTES2);
        return filtered;
    }

    isModuleMuted(session: Mail.mail.session.Session, sinkId: string): boolean {
        if (this.userPreferences == null) {
            return true;
        }
        let muted: boolean = false;
        for (let section of session.sectionManager.filteredCollection.list) {
            let sink = section.getChatSink();
            if (sink && sink.id == sinkId) {
                muted = section.userSettings.mutedModules.notes2 || false;
                break;
            }
        }
        return muted;
    }
    
    loadSettings(session: Mail.mail.session.Session, sectionId: string = "__global__"): Q.Promise<void> {
        return this.viewSettings.loadSettings(session, sectionId);
    }
    
    saveSetting(session: Mail.mail.session.Session, name: string, value: number, sectionId: string, context: ViewContext): void {
        return this.viewSettings.saveSetting(session, name, value, sectionId, context);
    }
    
    getSetting(session: Mail.mail.session.Session, name: string, sectionId: string, context: ViewContext): number {
        return this.viewSettings.getSetting(session, name, sectionId, context);
    }
    
    getSettingFullSectionId(session: Mail.mail.session.Session, sectionId: string): string {
        if (!session || !sectionId) {
            return sectionId;
        }
        let isRemoteSession = session.host != this.app.sessionManager.getLocalSession().host;
        let fullSectionId = isRemoteSession ? `${session.hostHash}--${sectionId}` : sectionId;
        return fullSectionId;
    }
    
    fixTrashPath(path: string): string {
        if (path.indexOf(FilesConst.TRASH_PATH) >= 0) {
            let parts = path.split(FilesConst.TRASH_PATH + "/");
            let f = parts[1];
            let arr = f.split("/");
            f = arr[arr.length - 1];
            path = parts[0] + FilesConst.TRASH_PATH + "/" + f;
        }
        return path;
    }
    
    markAllAsRead(session: Mail.mail.session.Session, projectId: string): Q.Promise<void> {
        let sectionId: string = null;
        if (projectId) {
            if (projectId.indexOf("c2:") == 0) {
                let conversation = session.conv2Service.collection.find(x => x.id == projectId);
                if (conversation && conversation.section) {
                    sectionId = conversation.section.getId();
                }
            }
            else {
                sectionId = projectId;
            }
        }
        
        let sections: Mail.mail.section.SectionService[];
        if (sectionId) {
            sections = [session.sectionManager.getSection(sectionId)];
        }
        else {
            sections = session.sectionManager.sectionsCollection.list.filter(x => x.hasAccess());
        }
        
        let fileTrees: { [sectionId: string]: Mail.mail.filetree.nt.Tree } = {};
        let promises: Q.Promise<void>[] = [];
        for (let section of sections) {
            promises.push(section.getFileTree().then(tree => {
                if (tree) {
                    fileTrees[section.getId()] = tree;
                }
            }));
        }
        return Q.all(promises).then(() => {
            let prefix = "section|file|" + (sectionId ? sectionId : "");
            let unreadFiles: FileEntryBase[] = [];
            if (!this.unreadFileIds[session.hostHash]) {
                this.unreadFileIds[session.hostHash] = {};
            }
            for (let id in this.unreadFileIds[session.hostHash]) {
                if (this.unreadFileIds[session.hostHash][id] && id.substr(0, prefix.length) == prefix) {
                    let tree = fileTrees[id.split("|")[2]];
                    if (tree) {
                        let fileEntry = tree.collection.find(x => x.id == id);
                        if (fileEntry) {
                            unreadFiles.push(fileEntry);
                        }
                    }
                }
            }
            return this.markFilesAsWatched(session, unreadFiles, sections.map(x => x.getId()), projectId == FilesListController.TRASH_FILES);
        });
    }
    
    sendMoveFileMessage(receiverSection: Mail.mail.section.SectionService, oldPath: string, newPath: string, oldSection: Mail.mail.section.SectionService, newSection: Mail.mail.section.SectionService): Q.Promise<void> {
        if (receiverSection == null || receiverSection.isPrivate() || !receiverSection.hasChatModule()) {
            return Q();
        }
        let chatModule = receiverSection.getChatModule();
        chatModule.sendMoveFileMessage(oldPath, newPath, oldSection.getId(), newSection.getId(), null, null);
    }
    
    openNewTextNoteWindow(session: Mail.mail.session.Session, sectionId: string = null, path: string = "/"): void {
        this.openNewNoteWindow(session, "text", sectionId, path);
    }
    
    openNewMindmapWindow(session: Mail.mail.session.Session, sectionId: string = null, path: string = "/"): void {
        this.openNewNoteWindow(session, "mindmap", sectionId, path);
    }
    
    openNewNoteWindow(session: Mail.mail.session.Session, type: "text"|"mindmap", sectionId: string = null, path: string = "/"): void {
        let ext: string;
        let appAction: string;
        let applicationId: string;
        if (type == "text") {
            ext = "pmxtt";
            appAction = "plugin.editor.new-text-note";
            applicationId = "plugin.editor";
        }
        else if (type == "mindmap") {
            ext = "pmxmm";
            appAction = "plugin.editor.new-mindmap";
            applicationId = "core.mindmap.editor";
        }
        else {
            return;
        }
        if (sectionId == null) {
            let priv = this.sectionManager.getMyPrivateSection();
            if (!priv) {
                return;
            }
            sectionId = priv.getId();
            session = this.app.sessionManager.getLocalSession();
        }
        let wnd: Mail.window.base.BaseWindowController = null;
        Q().then(() => {
            return this.app.shellRegistry.shellOpen(<any>{
                action: Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL,
                element: null,
                session: session,
                editorOptions: {newFile: true},
                applicationId: applicationId,
            });
        })
        .then(_wnd => {
            wnd = _wnd;
            if (sectionId == FilesListController.LOCAL_FILES) {
                return this.app.generateUniqueFileName("local", path, ext);
            }
            else {
                let section = session.sectionManager.getSection(sectionId);
                return this.app.generateUniqueFileName(section, path, ext);
            }
        })
        .then(fileName => {
            this.app.shellRegistry.callAppAction(appAction, fileName).then(content => {
                if (sectionId == FilesListController.LOCAL_FILES) {
                    let fullPath = LocalFS.joinPath(path, fileName);
                    return LocalFS.createFile(fullPath).then(() => {
                        return LocalOpenableElement.create(fullPath).then(el => {
                            el.save(content);
                            return el;
                        });
                    });
                }
                else {
                    let section = session.sectionManager.getSection(sectionId);
                    if (section) {
                        return section.uploadFile({
                            data: content,
                            path: path,
                        })
                        .then(result => {
                            return result.openableElement;
                        });
                    }
                }
            })
            .then(el => {
                return Q.delay(0).thenResolve(el);
            })
            .then(el => {
                if (!el) {
                    return;
                }
                let _wnd = <any>wnd;
                if (_wnd.reopen) {
                    _wnd.reopen(el, true).then(() => {
                        return Q.delay(0);
                    })
                    .then(() => {
                        _wnd.enterEditMode();
                    });
                }
            });
        })
        .catch(console.error);
    }
    
    openNewAudioAndVideoNoteWindow(session: Mail.mail.session.Session, sectionId: string = null, path: string = "/"): void {
        this.openVideoRecorderWindow(session, sectionId, path, Mail.window.videorecorder.VideoRecorderMode.AUDIO_AND_VIDEO);
    }
    
    openNewAudioNoteWindow(session: Mail.mail.session.Session, sectionId: string = null, path: string = "/"): void {
        this.openVideoRecorderWindow(session, sectionId, path, Mail.window.videorecorder.VideoRecorderMode.AUDIO);
    }
    
    openNewPhotoNoteWindow(session: Mail.mail.session.Session, sectionId: string = null, path: string = "/"): void {
        this.openVideoRecorderWindow(session, sectionId, path, Mail.window.videorecorder.VideoRecorderMode.PHOTO);
    }
    
    openVideoRecorderWindow(session: Mail.mail.session.Session, sectionId: string, path: string, mode: Mail.window.videorecorder.VideoRecorderMode): void {
        let videoRecorderOptions: Mail.window.videorecorder.VideoRecorderOptions = {
            saveModel: <Mail.window.videorecorder.VideoRecorderSectionFileSaveModel>{
                type: "sectionFile",
                session: session,
                sectionId: sectionId,
                path: path,
            },
            mode: mode,
            closeAfterSaved: true,
        };
        this.app.ioc.create(Mail.window.videorecorder.VideoRecorderWindowController, [this.app, videoRecorderOptions]).then(win => {
            const winName = mode == Mail.window.videorecorder.VideoRecorderMode.AUDIO ? "audio-recorder" : "video-recorder";
            this.app.openSingletonWindow(winName, win);
        });
    }
    
    getSessions(): Mail.mail.session.Session[] {
        let sessions: Mail.mail.session.Session[] = [];
        for (let hostHash in this.app.sessionManager.sessions) {
            let session = this.app.sessionManager.sessions[hostHash];
            sessions.push(session);
        }
        return sessions;
    }
    
    getReadySessions(): Mail.mail.session.Session[] {
        let sessions: Mail.mail.session.Session[] = [];
        for (let hostHash in this.app.sessionManager.sessions) {
            let session = this.app.sessionManager.sessions[hostHash];
            if ((!session.initPromise || session.initPromise.isFulfilled()) && (!session.loadingPromise || session.loadingPromise.isFulfilled())) {
                sessions.push(session);
            }
        }
        return sessions;
    }
    
    static getPersonModel(session: Mail.mail.session.Session, person: Mail.mail.person.Person): PersonModel {
        return {
            hashmail: person.getHashmail(),
            username: person.username,
            name: person.hasContact() && person.contact.hasName() ? person.contact.getDisplayName() : "",
            description: person.getDescription(),
            present: person.isPresent(),
            deleted: session.conv2Service.contactService.deletedUsers.indexOf(person.usernameCore) >= 0,
        };
    }
    
}
