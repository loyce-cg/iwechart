import {app, component, mail, utils, window, Q, Types, privfs} from "pmc-mail";
import {HistoryWindowController} from "../../window/history/HistoryWindowController";
import {ClipboardFileEntry, ClipboardDirectoryEntry, Notes2Plugin, RemoveFileEvent, PreviewRequestEvent, UpdateWatchedFileEvent, UpdateNotes2SettingEvent, PersonModel, RequestOpenFilesEvent} from "../../main/Notes2Plugin";
import {FileEntryBaseEx, FileEntryBase, ParentDirEntry, Notes2Utils} from "../../main/Notes2Utils";
import {FileConflictResolverWindowController} from "../../window/fileconflictresolver/FileConflictResolverWindowController";
import {FileErrorWindowController} from "../../window/fileerror/FileErrorWindowController";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { NewNoteWindowController } from "../../window/newnote/NewNoteWindowController";
import { FilesConst, ViewMode, ViewContext, SelectionChangeMode } from "../../main/Common";
import { Entry, Directory } from "pmc-mail/out/mail/filetree/NewTree";
import { LocalEntry, LocalFS, LocalOpenableElement } from "../../main/LocalFS";
import { MsgBoxOptions, MsgBoxResult } from "pmc-mail/out/window/msgbox/MsgBoxWindowController";
import { IContent } from "simplito-lazybuffer/out/common/IContent";
import { OpenableElement } from "pmc-mail/out/app/common/shell/ShellTypes";
import { ViewSettings } from "../../main/ViewSettings";
import { i18n } from "./i18n";
import { SectionManager, SectionService } from "pmc-mail/out/mail/section";
import { Notes2WindowController } from "../../window/notes2/Notes2WindowController";

export enum SelectionMode {
    SINGLE,
    MULTI,
}

export interface FileEntry {
    id: string;
    type: string;
    name: string;
    mimeType: string;
    size: number;
    icon: string;
    modificationDate: number;
    renamable: boolean;
    deletable: boolean;
    hasHistory: boolean;
    printable: boolean;
    canSaveAsPdf: boolean;
    modifier: string;
    locked?: boolean;
    bindedTasksStr?: string;
    unread: boolean;
    isParentDir?: boolean;
}

export interface PreviewItem {
    id: string;
    added: number;
}

export interface Model {
    id: string;
    channelName?: string;
    channelScope?: string;
    hashmail?: string;
    persons?: PersonModel[];
    hasChat: boolean;
    hasTasks: boolean;
    editable: boolean;
    clipboard: boolean;
    isTrash: boolean;
    isAll: boolean;
    isLocal: boolean;
    currentPath: string;
    viewMode: ViewMode;
    computerLocalName?: string;
    systemLabel?: string;
    hasNoPrivateSection: boolean;
    canWrite: boolean;
    showFilePreview: boolean;
    showUrlFiles: boolean;
    selectedIdsStr: string;
    asFileChooser: boolean;
    isDeletedUserSection: boolean;
}

export interface FilesFilterData {
    value: string;
    visible: boolean;
}

export enum FilesListType {
    CONVERSATION,
    CHANNEL,
    OTHER
}

export interface FilesInfo {
    type: FilesListType;
    conversation: mail.section.Conv2Section;
    section: mail.section.SectionService;
}

export class FilesFilterUpdater {
    static UPDATE_DELAY: number = 200;
    static MIN_CHARS_NUM: number = 2;
    toUpdate: FilesFilterData;
    previousFilter: FilesFilterData;
    filter: FilesFilterData;
    updateTimer: NodeJS.Timer;
    onUpdate: () => boolean;
    
    constructor() {
        this.setFilter({value: "", visible: false});
    }
    
    setFilter(filter: FilesFilterData): void {
        this.filter = filter;
    }
    
    needsUpdate(): boolean {
        if (!this.previousFilter || !this.filter) {
            return true;
        }
        
        if (this.previousFilter.visible != this.filter.visible) {
            return true;
        }
        
        if (!this.previousFilter.visible && !this.filter.visible) {
            return false;
        }
        
        return this.previousFilter.value != this.filter.value;
    }
    
    updateFilter(filter: FilesFilterData, onPanelActivate: boolean = false) {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (! filter.visible) {
            this.setFilter({value: "", visible: false});
            if (this.onUpdate && this.needsUpdate()) {
                if (this.onUpdate()) {
                    this.previousFilter = this.filter;
                }
            }
            return;
        }
        if (filter.value.length < FilesFilterUpdater.MIN_CHARS_NUM && filter.value.length != 0) {
            return;
        }
        this.toUpdate = {
            value: app.common.SearchFilter.prepareNeedle(filter.value),
            visible: filter.visible,
        };
        
        let f = () => {
            this.updateTimer = null;
            this.setFilter(this.toUpdate);
            if (this.onUpdate && this.needsUpdate()) {
                if (this.onUpdate()) {
                    this.previousFilter = this.filter;
                }
            }
        };
        if (onPanelActivate) {
            f();
        }
        else {
            this.updateTimer = setTimeout(f, FilesFilterUpdater.UPDATE_DELAY);
        }
    }
}

type DescriptorLockUser = string & {__username: never};

@Dependencies(["extlist", "persons", "notification"])
export class FilesListController extends window.base.WindowComponentController<window.base.BaseWindowController> {
    
    static textsPrefix: string = "plugin.notes2.component.filesList.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static MY_FILES: string = "my";
    static ALL_FILES: string = "all";
    static LOCAL_FILES: string = "local";
    static TRASH_FILES: string = "trash";
    
    static MARK_ALREADY_SELECTED_AS_READ_DELAY: number = 3000;

    static usedIds: string[] = [];
    
    @Inject identity: privfs.identity.Identity;
    @Inject sinkIndexManager: mail.SinkIndexManager;
    @Inject conv2Service: mail.section.Conv2Service;
    @Inject personService: mail.person.PersonService;
    
    mergedCollection: utils.collection.MergedCollection<FileEntryBaseEx>;
    proxyCollection: utils.collection.ProxyCollection<FileEntryBaseEx>;
    filteredCollection: utils.collection.FilteredCollection<FileEntryBaseEx>;
    filteredByUserCollection: utils.collection.FilteredCollection<FileEntry>;
    transformCollection: utils.collection.TransformCollection<FileEntry, FileEntryBaseEx>;
    sortedCollection: utils.collection.SortedCollection<FileEntry>;
    activeCollection: utils.collection.WithMultiActiveCollection<FileEntry>;
    files: component.extlist.ExtListController<FileEntry>;
    currentPath: string;
    currentDir: mail.filetree.nt.Directory;
    preventReselect: boolean;
    reselectIndex: number = null;
    filesFilterUpdater: FilesFilterUpdater;
    // personsComponent: component.persons.PersonsController;
    notes2Plugin: Notes2Plugin;
    tasksPlugin: any;
    notifications: component.notification.NotificationController;
    taskTooltip: component.tasktooltip.TaskTooltipController;
    taskChooser: component.taskchooser.TaskChooserController;
    basicTooltip: component.tooltip.TooltipController;
    locksTooltip: component.userslisttooltip.UsersListTooltipController;
    
    fileListId: string;
    destination: string; //id for newNoteWindow and chat plugin
    collection: utils.collection.BaseCollection<FileEntryBase>;
    filesInfo: FilesInfo;
    editable: boolean;
    filesLocksMap: {[did: string]: DescriptorLockUser} = {};
    onRefresh: () => Q.Promise<void>;
    
    localFS: LocalFS;
    isTrash: boolean;
    isAll: boolean;
    isLocal: boolean;
    isDeletedUserSection: boolean;
    viewMode: ViewMode;
    viewModeChanged: (viewMode: ViewMode) => void;
    isSearchOn: boolean = false;
    isActive: boolean = true;
    isPrinting: boolean = false;
    isSavingAsPdf: boolean = false;
    context: ViewContext = ViewContext.Notes2Window;
    uniqueId: string = "";
    currentSection: mail.section.SectionService;
    isSelectionChanging: boolean = false;
    delayMarkAsRead: boolean = true;
    asFileChooser: boolean = false;
    onFilesChoosen: (elements: OpenableElement[]) => void;
    isRefreshing: boolean = false;
    selectionMode: SelectionMode = SelectionMode.MULTI;
    
    session: mail.session.Session;
    sectionManager: SectionManager;
    afterViewLoadedDeferred: Q.Deferred<void> = Q.defer<void>();

    constructor(
        parent: window.base.BaseWindowController,
        public personsComponent:  component.persons.PersonsController
    ) {
        super(parent);
        this.ipcMode = true;
        this.uniqueId = this.createUniqueId();
        this.onRefresh = () => Q();
        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        // this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        
        this.mergedCollection = this.addComponent("mergedCollection", new utils.collection.MergedCollection());
        this.mergedCollection.addCollection(new utils.collection.MutableCollection<ParentDirEntry>([{id: "parent"}]));
        this.proxyCollection = this.addComponent("proxyCollection", new utils.collection.ProxyCollection());
        this.mergedCollection.addCollection(this.proxyCollection);
        this.filteredCollection = this.addComponent("filteredCollection", new utils.collection.FilteredCollection(this.mergedCollection, this.filterEntry.bind(this)));
        this.transformCollection = this.addComponent("transformCollection", new utils.collection.TransformCollection<FileEntry, FileEntryBaseEx>(this.filteredCollection, this.convertEntry.bind(this)));

        this.filesFilterUpdater = new FilesFilterUpdater();
        this.filteredByUserCollection = this.addComponent("filteredByUserCollection", new utils.collection.FilteredCollection<FileEntry>(this.transformCollection, (entry) => {
            return FilesListController.meetsFilter(entry, this.filesFilterUpdater.filter.value);
        }));
        
        this.basicTooltip = this.addComponent("basicTooltip", this.componentFactory.createComponent("tooltip", [this]));
        this.basicTooltip.getContent = (id: string) => {
            return this.app.localeService.i18n('plugin.notes2.component.filesList.cantDeleteShared.tooltip');
        };

        this.locksTooltip = this.addComponent("locksTooltip", this.componentFactory.createComponent("userslisttooltip", [this]));
        this.locksTooltip.getContent = (id: string) => {
            let entry = this.filteredCollection.find(x => x.id == id);
            if (entry instanceof mail.filetree.nt.Entry) {
                let did = entry.ref.did;
                let user = this.filesLocksMap && (did in this.filesLocksMap) ? this.filesLocksMap[did] : null;
                if (!user) {
                    return;
                }
    
                let person = this.session.conv2Service.personService.persons.get(user + "#" + this.session.host);
                let data = {
                    name: person.getName(),
                    description: person.getDescription(),
                    hashmail: person.hashmail,
                    present: person.isPresent()
                };
                return JSON.stringify({persons: [data]}); 
            }
            else {
                return null;
            }
        };


        this.filesFilterUpdater.onUpdate = () => {
            if (!this.isActive) {
                return false;
            }
            if (this.isSearchOn != this.filesFilterUpdater.filter.visible) {
                this.isSearchOn = this.filesFilterUpdater.filter.visible;
            }
            this.filteredCollection.refresh();
            this.filteredByUserCollection.refresh();
            return true;
        }

        this.sortedCollection = this.addComponent("sortedCollection", new utils.collection.SortedCollection(this.filteredByUserCollection, this.sortEntry.bind(this)));
        this.activeCollection = this.addComponent("activeCollection", new utils.collection.WithMultiActiveCollection(this.sortedCollection));
        this.files = this.addComponent("files", this.componentFactory.createComponent("extlist", [this, this.activeCollection]));
        this.files.ipcMode = true;
        this.app.addEventListener(app.common.clipboard.Clipboard.CHANGE_EVENT, this.onClipboardChange.bind(this));
        this.registerChangeEvent(this.activeCollection.changeEvent, this.onActiveCollectionChange.bind(this));
        this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterFiles, "multi");
        this.app.addEventListener<UpdateWatchedFileEvent>("update-watched-file", event => {
            if (!this.session || event.hostHash != this.session.hostHash) {
                return;
            }
            if (this.collection) {
                let elementsToUpdate: FileEntryBase[] = [];
                this.collection.forEach(x => {
                    let id = x.id + "/";
                    if (x.id == event.fileId || event.fileId.substr(0, id.length) == id) {
                        elementsToUpdate.push(x);
                    }
                });
                elementsToUpdate.forEach(x => {
                    this.collection.triggerUpdateElement(x);
                });
            }
        });

        this.app.addEventListener<UpdateNotes2SettingEvent>("update-notes2-setting", event => {
            if (event.sourceUniqueId == this.uniqueId) {
                return;
            }
            if (event.sourceProjectId != this.fileListId && this.notes2Plugin.viewSettings.isSettingProjectIsolated(event.setting)) {
                return;
            }
            if (event.sourceContext != this.context && this.notes2Plugin.viewSettings.isSettingContextIsolated(event.setting)) {
                return;
            }
            this.callViewMethod("updateSetting", event.setting, event.value == 1);
            this.filteredCollection.refresh();
        });

        this.app.addEventListener<Types.event.FileLockChangedEvent>("file-lock-changed", this.onFileLockChanged.bind(this));

        this.registerChangeEvent(this.conv2Service.collection.changeEvent, event => {
            let person = this.personService.getMe();
            if (this.filesInfo && this.filesInfo.type == FilesListType.CONVERSATION && this.filesInfo.conversation.section != null && person.username.indexOf("@") >= 0) {
                this.callViewMethod("updateCanWrite", this.canWrite());
            }
        });

        
        this.registerChangeEvent(this.personService.persons.changeEvent, this.onPersonChange.bind(this));
        this.app.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            if (this.filesInfo && this.filesInfo.conversation) {
                let customSectionName = this.conv2Service.sectionManager.customSectionNames.getCustomSectionName(this.filesInfo.conversation);
                this.callViewMethod("updateCustomSectionName", customSectionName);
            }
        });

        let tasksPlugin = this.app.getComponent("tasks-plugin");
        this.tasksPlugin = tasksPlugin;
        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            let session = this.session;
            if (!session) {
                session = this.app.sessionManager.getLocalSession();
            }
            return tasksPlugin ? tasksPlugin.getTaskTooltipContent(session, taskId + "") : null;
        };
        // this.taskChooser = this.addComponent("taskchooser", this.componentFactory.createComponent("taskchooser", [this, this.app, {
        //     createTaskButton: false,
        //     includeTrashed: false,
        //     popup: true,
        //     session: this.app.sessionManager.getLocalSession(),
        // }]));
        // console.log("after adding taskchooser");
        
    }
    
    init() {
    }
    
    onViewLoad(): void {
        this.afterViewLoadedDeferred.resolve();
    }
    
    setSection(section: mail.section.SectionService): Q.Promise<boolean> {
        if (!section.isFileModuleEnabled()) {
            return Q(false);
        }
        return section.getFileTree().then(fileTree => {
            return fileTree.refreshDeep(true).thenResolve(fileTree);
        })
        .then(fileTree => {
            let collection = new utils.collection.FilteredCollection(fileTree.collection, x => {
                return x.path.indexOf(FilesConst.TRASH_PATH) == -1 && !mail.thumbs.ThumbsManager.isThumb(x.path);
            });
            let prom = Q();
            if (section.isUserGroup()) {
                let conversation = this.conv2Service.collection.find(x => x.section == section);
                let fileListId = Notes2WindowController.getConversationId(this.session, conversation);
                prom = this.setComponentData(fileListId, conversation.id, collection, {
                    type: FilesListType.CONVERSATION,
                    conversation: conversation,
                    section: null
                }, true, () => {
                    return fileTree.refreshDeep(true)
                });
            }
            else {
                let fileListId = Notes2WindowController.getChannelId(this.session, section);
                prom = this.setComponentData(fileListId, section.getId(), collection, {
                    type: FilesListType.CHANNEL,
                    conversation: null,
                    section: section
                }, true, () => {
                    return fileTree.refreshDeep(true)
                });
            }
            return prom.then(() => {
                return true;
            })
        });
    }
    
    
    setComponentData(fileListId: string, destination: string, collection: utils.collection.BaseCollection<FileEntryBase>,
        filesInfo: FilesInfo, editable: boolean, onRefresh: () => Q.Promise<void>,
        localFS: LocalFS = null, viewMode: ViewMode = null, asFileChooser: boolean = false, viewModeChanged: (viewMode: ViewMode) => void = () => {}
    ): Q.Promise<void> {
        this.isDeletedUserSection = filesInfo.type == FilesListType.CONVERSATION && filesInfo.conversation.hasDeletedUserOnly();
        return this.notes2Plugin.loadedDeferred.promise.then(() => {
            return this.notes2Plugin.loadSettings(this.session, fileListId);
        })
        .then(() => {
            this.fileListId = fileListId;
            this.isLocal = fileListId == FilesListController.LOCAL_FILES;
            this.isTrash = fileListId == FilesListController.TRASH_FILES;
            this.isAll = fileListId == FilesListController.ALL_FILES;
            this.isDeletedUserSection = this.isDeletedUserSection;
            this.destination = destination;
            this.collection = collection;
            this.filesInfo = filesInfo;
            this.editable = editable && !this.isDeletedUserSection;
            this.onRefresh = onRefresh;
            this.localFS = localFS;
            this.viewMode = viewMode === null ? (this.notes2Plugin.getSetting(this.session, ViewSettings.VIEW_MODE, fileListId, this.context) == 1 ? "table" : "tiles") : viewMode;
            this.viewModeChanged = viewModeChanged;
            this.asFileChooser = asFileChooser;
            if (localFS) {
                this.currentPath = localFS.currentPath;
                let found: any = this.collection.find((x: LocalEntry) => Notes2Utils.isLocalEntry(x.parent) && x.parent.isDirectory() && x.parent.path == this.currentPath);
                this.currentDir = <mail.filetree.nt.Directory>(found.parent);
            }
            else if (this.isTrash) {
                this.currentPath = FilesConst.TRASH_PATH;
                this.currentDir = null;
            }
            else {
                this.currentPath = this.isAll ? "" : "/";
                this.currentDir = <mail.filetree.nt.Directory>this.collection.find(x => Notes2Utils.isFsFileEntry(x) && x.isDirectory() && x.path == this.currentPath);
            }
            this.proxyCollection.setCollection(collection);
            let firstElement = this.activeCollection.get(0);
            this.activeCollection.setActive(firstElement);
            if (firstElement) {
                this.activeCollection.setSelected(firstElement);
            }
            this.sendSelectionToView();
            this.filteredCollection.refresh();
            
            this.filesFilterUpdater.updateFilter(this.app.searchModel.get(), true);
            
            this.callViewMethod("updateViewMode", viewMode);
        });
    }
    
    onPersonChange(person: mail.person.Person): void {
        this.callViewMethod("updatePersonPresence", person.getHashmail(), person.isPresent());
    }

    getModel(): Model {
        let model: Model = {
            id: this.fileListId,
            persons: [],
            hasChat: false,
            hasTasks: false,
            editable: this.editable && !this.isDeletedUserSection,
            clipboard: this.hasSthToPaste(),
            currentPath: this.currentPath,
            isTrash: this.isTrash,
            isAll: this.isAll,
            isLocal: this.isLocal,
            viewMode: this.viewMode,
            hasNoPrivateSection: this.notes2Plugin.sectionManager.getMyPrivateSection() == null,
            canWrite: this.canWrite(),
            showFilePreview: this.showFilePreview(),
            showUrlFiles: this.showUrlFiles(),
            selectedIdsStr: JSON.stringify(this.getSelectedIds()),
            asFileChooser: this.asFileChooser,
            isDeletedUserSection: this.isDeletedUserSection,
        };
                
        if (this.filesInfo.type == FilesListType.CONVERSATION) {
            let active = this.filesInfo.conversation;
            model.hasChat = this.notes2Plugin.isChatPluginPresent();
            model.hasTasks = this.notes2Plugin.isTasksPluginPresent();
            //model.convModel = utils.Converter.convertConv2(active, 0, null, 0, true, 0, false, false, false);
            model.persons = active.persons.map(x => Notes2Plugin.getPersonModel(this.session, x));
        }
        else if (this.filesInfo.type == FilesListType.CHANNEL) {
            let active = this.filesInfo.section;
            model.hasChat = active && this.notes2Plugin.isChatPluginPresent() && active.isChatModuleEnabled();
            model.hasTasks = active && this.notes2Plugin.isTasksPluginPresent() && active.isKvdbModuleEnabled();
            model.channelName = active.getName();
            model.channelScope = active.getScope();
        }
        else if (this.filesInfo.type == FilesListType.OTHER) {
            let active = this.filesInfo.section;
            if (this.destination == "my") {
                model.hasChat = active && this.notes2Plugin.isChatPluginPresent();
                model.hasTasks = active && this.notes2Plugin.isTasksPluginPresent();
            }
            else if (this.destination == "all") {
                model.hasTasks = active && this.notes2Plugin.isTasksPluginPresent();
            }
            model.hashmail = this.identity.hashmail;
        }
        else {
            model.hashmail = this.identity.hashmail;
        }

        if (this.app.isElectronApp()) {
            model.computerLocalName = (<any>this.app).getComputerName();
            model.systemLabel = (<any>this.app).getSystemLabel();
            if (model.computerLocalName.length == 0) {
                model.computerLocalName = this.i18n("plugin.notes2.component.filesList.filter.local");
            }
        }
        return model;
    }
    
    onViewViewModeChanged(viewMode: ViewMode) {
        this.viewMode = viewMode;
        this.notes2Plugin.saveSetting(this.session, ViewSettings.VIEW_MODE, viewMode == "tiles" ? 0 : 1, this.fileListId, this.context);
        if (this.viewModeChanged) {
            this.viewModeChanged(this.viewMode);
        }
    }
    
    onViewAddDirToPlaylist(): void {
        if (this.fileListId == FilesListController.TRASH_FILES) {
            return;
        }
        let filesToAdd: { id: string, name: string, mime: string }[] = [];
        let mimes: string[] = [];
        let mgr = this.app.getPlayerManager();
        let entries: FileEntryBaseEx[] = [];
        entries = this.filteredCollection.list;
        for (let k in entries) {
            let entry = entries[k];
            if (entry instanceof mail.filetree.nt.File) {
                let file = <mail.filetree.nt.File>entry;
                if (file.meta.mimeType.indexOf("audio/") == 0 && !mgr.has(file.id)) {
                    filesToAdd.push({ id: file.id, name: file.name, mime: file.meta.mimeType });
                    if (mimes.indexOf(file.meta.mimeType) < 0) {
                        mimes.push(file.meta.mimeType);
                    }
                }
            }
        }
        mgr.canPlayTypes(mimes).then(canPlay => {
            for (let file of filesToAdd) {
                if (canPlay[file.mime]) {
                    mgr.addToPlaylistById(file.id, file.name);
                }
            }
        });
    }
    
    onViewMarkAllAsRead(): void {
        let entries: FileEntryBaseEx[] = [];
        entries = this.proxyCollection.list;
        let entriesToMark = <FileEntryBase[]>entries.filter(x => Notes2Utils.isFsFileEntry(x) && this.notes2Plugin.wasUnread(this.session, x));
        
        let sectionIds: string[] = [];
        let trash: boolean = false;
        let id = this.getSectionId();
        if (id && id != FilesListController.LOCAL_FILES) {
            if (id == FilesListController.ALL_FILES || id == FilesListController.TRASH_FILES) {
                this.notes2Plugin.filesSections[this.session.hostHash].forEach(x => {
                    sectionIds.push(x.getId());
                });
                trash = id == FilesListController.TRASH_FILES;
            }
            else {
                sectionIds.push(id);
            }
        }
        this.notes2Plugin.markFilesAsWatched(this.session, entriesToMark, sectionIds, trash);
    }
    
    getSectionId(): string {
        if (this.fileListId == FilesListController.TRASH_FILES || this.fileListId == FilesListController.ALL_FILES || this.fileListId == FilesListController.LOCAL_FILES) {
            return this.fileListId;
        }
        if (this.filesInfo.section) {
            return this.filesInfo.section.getId();
        }
        if (this.filesInfo.conversation && this.filesInfo.conversation.section) {
            return this.filesInfo.conversation.section.getId();
        }
        return null;
    }
    
    isInCurrentPath(x: mail.filetree.nt.Entry): boolean {
        if (this.currentDir != null) {
            return x.parent == this.currentDir;
        }
        return x.parent != null && x.parent.path == this.currentPath;
    }
    
    isInCurrentPathOrDeeper(x: mail.filetree.nt.Entry): boolean {
        if (this.currentDir != null) {
            let el = x;
            let lim = 100;
            while (el.parent && el.parent != el && --lim > 0) {
                if (el.parent == this.currentDir) {
                    return true;
                }
                el = el.parent;
            }
            return false;
        }
        return x.parent != null && x.path.indexOf(this.currentPath) == 0;
    }
    
    selectPath(path: string): void {
        let entry = this.mergedCollection.find(x => (<any>x).path == path);
        if (!entry) {
            return;
        }
        let dirPath = path.substr(0, path.lastIndexOf("/")) || "/";
        let dir = this.mergedCollection.find(x => (<any>x).path == dirPath);
        if (!dir) {
            return;
        }
        this.moveToDirectory(dir.id);
        Q().then(() => {
            this.goToId(entry.id);
        });
    }
    
    filterEntry(x: FileEntryBaseEx): boolean {
        if (x.id != "parent" && !this.showUrlFiles() && this.isUrlFile(x)) {
            return false;
        }
        if (Notes2Utils.isLocalEntry(x)) {
            return true;
        }
        if (Notes2Utils.isParentEntry(x)) {
            if (this.localFS) {
                return !this.currentDir || this.currentDir.path != "/";
            }
            return this.currentDir != null && this.currentDir.parent != null;
        }
        if (this.currentPath == "") {
            return true;
        }
        if (Notes2Utils.isAttachmentEntry(x)) {
            return this.currentPath == "/";
        }
        if (x == this.currentDir) {
            return false;
        }
        return this.isSearchOn ? this.isInCurrentPathOrDeeper(x) : this.isInCurrentPath(x);
    }
    
    isUrlFile(x: FileEntryBaseEx): boolean {
        if (Notes2Utils.isParentEntry(x)) {
            return false;
        }
        if (Notes2Utils.isLocalEntry(x) || Notes2Utils.isAttachmentEntry(x)) {
            return x.id.substr(-4) == ".url";
        }
        return x.meta && (x.meta.mimeType == "application/internet-shortcut" || x.meta.mimeType == "application/x-mswinurl");
    }
    
    hasSthToPaste(): boolean {
        let availableFormats = this.isAll || !this.editable ? ["file"] : ["file", "directory", "files", "directories"];
        return !this.isTrash && this.app.clipboard.hasOneOfFormats(availableFormats);
    }
    
    convertEntry(x: FileEntryBaseEx): FileEntry {
        if (Notes2Utils.isAttachmentEntry(x)) {
            let mimeType = mail.filetree.MimeType.resolve2(x.attachment.getName(), x.attachment.getMimeType());
            return {
                id: x.id,
                type: "file",
                name: x.attachment.getName(),
                mimeType: mimeType,
                size: x.attachment.getSize(),
                icon: this.app.shellRegistry.resolveIcon(mimeType),
                modificationDate: x.entry.source.serverDate,
                renamable: false,
                deletable: false,
                hasHistory: false,
                printable: this.isPrintable(mimeType),
                canSaveAsPdf: this.canSaveAsPdf(mimeType),
                modifier: x.entry.source.data.sender.hashmail,
                unread: false
            };
        }
        if (Notes2Utils.isParentEntry(x)) {
            return {
                id: x.id,
                type: "directory",
                name: "..",
                mimeType: "",
                size: 0,
                icon: "fa-folder",
                modificationDate: null,
                renamable: false,
                deletable: false,
                hasHistory: false,
                printable: false,
                canSaveAsPdf: false,
                modifier: null,
                unread: false,
                isParentDir: true
            };
        }
        
        if (Notes2Utils.isLocalEntry(x)) {
            if (x.type == "directory") {
                return {
                    id: x.id,
                    type: x.type,
                    name: x.name,
                    mimeType: "",
                    size: x.size,
                    icon: "fa-folder",
                    modificationDate: x.mtime.getTime(),
                    renamable: LocalFS.isRenamable(x.id),
                    deletable: LocalFS.isDeletable(x.id),
                    hasHistory: false,
                    printable: false,
                    canSaveAsPdf: false,
                    modifier: null,
                    unread: false,
                };
            }
            
            return {
                id: x.id,
                type: x.type,
                name: x.name,
                mimeType: x.mime,
                size: x.size,
                icon: this.app.shellRegistry.resolveIcon(x.mime),
                modificationDate: x.mtime.getTime(),
                renamable: LocalFS.isRenamable(x.id),
                deletable: LocalFS.isDeletable(x.id),
                hasHistory: false,
                printable: this.isPrintable(x.mime),
                canSaveAsPdf: this.canSaveAsPdf(x.mime),
                modifier: null,
                unread: false,
            };
        }
        else {  // not local
            if (x.isDirectory()) {
                return {
                    id: x.id,
                    type: x.type,
                    name: x.name,
                    mimeType: "",
                    size: x.dirStats.filesSize,
                    icon: "fa-folder",
                    modificationDate: x.dirStats.modifiedDate,
                    renamable: true,
                    deletable: x.parent && x.parent.ref.hasWriteRights() && (!this.isTrash || this.isDeletable(x.tree)),
                    hasHistory: false,
                    printable: false,
                    canSaveAsPdf: false,
                    modifier: null,
                    unread: this.notes2Plugin.wasDirUnread(this.session, x),
                };
            }
            
            let bindedData: { taskIds: string[] } = JSON.parse(this.tasksPlugin.convertBindedTaskId(x.meta.bindedElementId));
            let bindedTaskIds: string[] = bindedData.taskIds;
            let bindedTasks: { taskId: string, labelClass: string }[] = [];
            for (let taskId of bindedTaskIds) {
                if (this.tasksPlugin.taskExists(this.session, taskId)) {
                    bindedTasks.push({
                        taskId: taskId,
                        labelClass: this.tasksPlugin.getTaskLabelClassByTaskId(this.session, taskId),
                    });
                }
            }
            if (bindedTasks.length > 0) {
                let taskIdsStr = bindedTasks.map(x => x.taskId).join(",");
                bindedTasks.splice(0, 0, {
                    taskId: taskIdsStr,
                    labelClass: this.tasksPlugin.getTaskLabelClassByTaskId(this.session, taskIdsStr),
                });
            }
            
            return {
                id: x.id,
                type: x.type,
                name: x.name,
                mimeType: x.meta.mimeType,
                size: x.meta.size,
                icon: this.app.shellRegistry.resolveIcon(x.meta.mimeType),
                modificationDate: x.meta.modifiedDate,
                renamable: true,
                deletable: x.parent && x.parent.ref.hasWriteRights() && (!this.isTrash || this.isDeletable(x.tree)),
                hasHistory: true,
                printable: this.isPrintable(x.meta.mimeType),
                canSaveAsPdf: this.canSaveAsPdf(x.meta.mimeType),
                modifier: x.meta.modifier && x.meta.modifier != "guest" ? x.meta.modifier + "#" + this.identity.host : "",
                bindedTasksStr: JSON.stringify(bindedTasks),
                unread: this.notes2Plugin.wasUnread(this.session, x),
                locked: this.isFileLocked(x.ref.did),
            };
        }
    }
    
    isPrintable(mime: string) {
        return this.app.isPrintable(mime);
    }
    
    canSaveAsPdf(mime: string) {
        return this.app.canSaveAsPdf(mime);
    }
    
    isDeletable(tree: mail.filetree.nt.Tree): boolean {
        return tree != null && tree.section == tree.section.manager.getMyPrivateSection();
    }
    
    sortEntry(a: FileEntry, b: FileEntry): number {
        if (a.type != b.type) {
            return a.type == "directory" ? -1 : 1;
        }
        if (a.id == "parent") {
            return -1;
        }
        if (b.id == "parent") {
            return 1;
        }
        //console.log(a.id, a.modificationDate, b.id, b.modificationDate)
        let res = (b.modificationDate || 0) - (a.modificationDate || 0);
        return res == 0 ? b.id.localeCompare(a.id) : res;
    }
    
    getById(id: string): FileEntryBaseEx {
        return this.mergedCollection.find(x => x.id == id);
    }
    
    getTreeEntry(id: string): mail.filetree.nt.Entry|LocalEntry {
        if (id == "parent") {
            let entry = this.currentDir ? this.currentDir.parent : null;
            if (entry == null && Notes2Utils.isLocalEntry(this.currentDir)) {
                return LocalFS.getParentEntry(this.currentDir);
            }
            return entry;
        }
        let entry = this.getById(id);
        return Notes2Utils.isFsFileEntry(entry) || Notes2Utils.isLocalEntry(entry) ? entry : null;
    }
    
    getOpenableElement(id: string): Q.IWhenable<app.common.shelltypes.OpenableElement> {
        if (!id) {
            return null;
        }
        if (this.localFS) {
            if (id == "parent") {
                return null;
            }
            return LocalOpenableElement.create(id);
        }
        let parsed = mail.filetree.nt.Entry.parseId(id);
        if (parsed != null) {
            return this.sectionManager.getFileOpenableElement(id, true);
        }
        else {
            let splitted = id.split("/");
            let sinkIndex = this.sinkIndexManager.getSinkIndexById(splitted[0]);
            if (sinkIndex == null) {
                return null;
            }
            let entry = sinkIndex.getEntry(parseInt(splitted[1]));
            if (entry == null) {
                return null;
            }
            let message = entry.getMessage();
            let attachmentIndex = parseInt(splitted[2]);
            let attachment = message.attachments[attachmentIndex];
            if (attachment == null) {
                return null;
            }
            return app.common.shelltypes.OpenableAttachment.create(attachment, true, true);
        }
    }
    
    withOpenableElement(id: string, func: (element: app.common.shelltypes.OpenableElement) => void, endAtNull?: boolean) {
        Q().then(() => {
            return this.getOpenableElement(id);
        })
        .then(element => {
            if (endAtNull !== false && element == null) {
                return;
            }
            func(element);
        })
        .fail(this.logErrorCallback);
    }
    
    onViewSetActiveFile(id: string): void {
        this.clearSelection();
        let el = this.activeCollection.find(x => x.id == id);
        this.activeCollection.setActive(el);
        if (el) {
            this.activeCollection.setSelected(el);
        }
        this.updateLockUnlockButtons();
        this.sendSelectionToView();
    }
    
    onViewCtrlClickFile(id: string): void {
        let el = this.activeCollection.find(x => x.id == id);
        this.activeCollection.setActive(el);
        if (this.selectionMode == SelectionMode.SINGLE) {
            this.clearSelection();
        }
        if (el) {
            if (this.activeCollection.selectedIndexes.length != 1 || this.activeCollection.selectedIndexes[0] != this.activeCollection.indexOf(el)) {
                this.activeCollection.setSelected(el);
            }
        }
        this.sendSelectionToView();
    }
    
    onViewSelectEntries(idsStr: string, activeId: string): void {
        let ids = JSON.parse(idsStr);
        if (this.selectionMode == SelectionMode.SINGLE) {
            this.clearSelection();
            ids = [activeId];
        }
        for (let id of ids) {
            let idx = this.activeCollection.indexOfBy(x => x.id == id);
            if (idx >= 0 && !this.activeCollection.isSelected(idx)) {
                let el = this.activeCollection.get(idx);
                if (el) {
                    this.activeCollection.setSelected(el);
                }
            }
        }
        let active = this.activeCollection.getBy("id", activeId);
        if (active) {
            this.activeCollection.setActive(active);
        }
        this.sendSelectionToView();
    }
    
    onViewOpenChat(): void {
        let cnt = <window.container.ContainerWindowController>this.app.windows.container;
        cnt.redirectToAppWindow("chat", this.destination);
    }
    
    onViewOpenTasks(): void {
        let cnt = <window.container.ContainerWindowController>this.app.windows.container;
        let dst = this.destination;
        if (dst == "my") {
            dst = this.notes2Plugin.sectionManager.getMyPrivateSection().getId();
        }
        else if (dst == "all") {
            dst = "all-tasks";
        }
        cnt.redirectToAppWindow("tasks", dst);
    }
    
    onViewMenuAction(id: string) {
        if (id == "new-text-note-window" || id == "new-mindmap-window") {
            Q().then(() => {
                if (this.fileListId == FilesListController.LOCAL_FILES) {
                    return FilesListController.LOCAL_FILES;
                }
                else {
                    return this.resolveSection().then(section => {
                        if (section) {
                            return section.getId();
                        }
                        else {
                            return this.fileListId;
                        }
                    });
                }
            })
            .then(fileListId => {
                if (id == "new-text-note-window") {
                    this.notes2Plugin.openNewTextNoteWindow(this.session, fileListId, this.currentPath);
                }
                else if (id == "new-mindmap-window") {
                    this.notes2Plugin.openNewMindmapWindow(this.session, fileListId, this.currentPath);
                }
            });
        }
        else if (id == "new-directory") {
            this.createNewDirectory();
        }
        else if (id == "upload") {
            if (!this.isLocal) {
                this.upload(this.currentPath);
            }
        }
    }
    
    onViewFileAction(action: string, viewMode: ViewMode = "tiles", rowSize: number = 5, selectionChangeMode: SelectionChangeMode = SelectionChangeMode.CHANGE) {
        if (action == "paste") {
            this.paste();
        }
        else if (action == "copy") {
            this.copy();
        }
        else if (action == "cut") {
            this.cut();
        }
        else if (action == "rename") {
            this.renameFile();
        }
        else if (action == "delete") {
            if (this.isTrash) {
                this.deleteFile();
            }
            else {
                this.trashFile();
            }
        }
        else if (action == "up") {
            this.moveCursorUp(viewMode, rowSize, selectionChangeMode);
        }
        else if (action == "down") {
            this.moveCursorDown(viewMode, rowSize, selectionChangeMode);
        }
        else if (action == "left") {
            this.moveCursorLeft(viewMode, rowSize, selectionChangeMode);
        }
        else if (action == "right") {
            this.moveCursorRight(viewMode, rowSize, selectionChangeMode);
        }
        else if (action == "openExternal") {
            if (this.asFileChooser) {
                this.chooseFile();
                return;
            }
            this.openExternalFile();
        }
        else if (action == "goToRoot") {
            this.goToRoot();
        }
        else if (action == "export") {
            this.exportFile();
        }
        else if (action == "exportFiles") {
            this.askExportFiles();
        }
        else if (action == "history") {
            this.showHistory();
        }
        else if (action == "print") {
            this.print();
        }
        else if (action == "saveAsPdf") {
            this.saveAsPdf();
        }
        else if (action == "refresh") {
            this.refreshTree(undefined, true);
        }
        else if (action == "send") {
            this.send();
        }
        else if (action == "attach-to-task") {
            this.attachToTask();
        }
        else if (action == "empty-trash") {
            this.tryEmptyTrash();
        }
        else if (action == "lock") {
            this.lockFile();
        }
        else if (action == "unlock") {
            this.unlockFile();
        }
    }
    
    onViewOpenTask(entryId: string, taskIdsStr: string): void {
        taskIdsStr += "";
        let resolved = this.sectionManager.resolveFileId(entryId);
        
        let taskId: string = "";
        if (taskIdsStr.indexOf(",") >= 0) {
            this.taskChooser.options.onlyTaskIds = taskIdsStr.split(",");
            this.taskChooser.refreshTasks();
            this.taskChooser.showPopup().then(result => {
                if (result.taskId) {
                    this.notes2Plugin.openTask(this.session, resolved.section.getId(), result.taskId);
                }
            });
        }
        else {
            taskId = taskIdsStr;
            this.notes2Plugin.openTask(this.session, resolved.section.getId(), taskId);
        }
    }
    
    getSection(): mail.section.SectionService {
        if (this.filesInfo.type == FilesListType.CHANNEL) {
            return this.filesInfo.section;
        }
        if (this.filesInfo.type == FilesListType.OTHER) {
            return this.filesInfo.section;
        }
        if (this.filesInfo.type == FilesListType.CONVERSATION) {
            return this.filesInfo.conversation.section;
        }
        return null;
    }
    
    resolveSection(): Q.Promise<mail.section.SectionService> {
        if (this.filesInfo.type == FilesListType.CONVERSATION) {
            if (this.filesInfo.conversation.section) {
                return Q(this.filesInfo.conversation.section);
            }
            return this.conv2Service.createUserGroup(this.filesInfo.conversation.users).then(ss => {
                if (this.isActive) {
                    this.notes2Plugin.activeSinkId = this.filesInfo.conversation.sinkIndex ? this.filesInfo.conversation.sinkIndex.sink.id : null;
                    this.notes2Plugin.activeSinkHostHash = this.session.hostHash;
                }
                return ss;
            });
        }
        return Q(this.filesInfo.section);
    }
    
    uploadFile(options: Types.section.UploadFileOptions): Q.Promise<Types.section.UploadFileResult> {
        return Q().then(() => {
            return this.resolveSection();
        })
        .then(section => {
            if (section == null) {
                throw new Error("Cannot upload file, current fileList has not assigned section");
            }
            return section.uploadFile(options);
        });
    }
    
    openNewNoteWindow(path: string) {
        //NewNote always returns the same destaintion as given
        this.app.ioc.create(NewNoteWindowController, [this.parent, {defaultDestination: this.destination}]).then(win => {
            win.parent = this.parent.getClosestNotDockedController();
            return this.parent.openChildWindow(win).getResult().then(result => {
                let notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.creatingFile"), {autoHide: false, progress: true});
                return Q().then(() => {
                    let openAfterCreate = result.openAfterCreate;
                    if (this.isLocal) {
                        let fullPath = LocalFS.joinPath(path, result.content.getName());
                        return LocalFS.createFile(fullPath).then(() => {
                            return LocalOpenableElement.create(fullPath).then(el => {
                                el.save(result.content);
                                return el;
                            })
                            .then(el => {
                                if (openAfterCreate) {
                                    this.app.shellRegistry.shellOpen({
                                        action: app.common.shelltypes.ShellOpenAction.EXTERNAL,
                                        element: el,
                                        session: this.session
                                    });
                                }
                            });
                        });
                    }
                    else {
                        return this.uploadFile({
                            data: result.content,
                            path: path
                        })
                        .then(result => {
                            if (openAfterCreate) {
                                this.app.shellRegistry.shellOpen({
                                    action: app.common.shelltypes.ShellOpenAction.EXTERNAL,
                                    element: result.openableElement,
                                    session: this.session
                                });
                            }
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
    
    upload(path: string, content: IContent|IContent[] = null, fileNamesDeferred: Q.Deferred<string[]> = null) {
        let getCnt: Q.Promise<IContent[]>;
        if (content) {
            getCnt = Q(Array.isArray(content) ? content : [content]);
        }
        else {
            getCnt = this.app.shellRegistry.callAppMultiAction("core.upload-multi", null, this.parent.getClosestNotDockedController().nwin);
        }
        return getCnt.then(contents => {
            if (!contents || (contents && contents.length == 0)) {
                return;
            }
            let notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.importingFile"), {autoHide: false, progress: true});
            let ids: string[] = [];
            let prom = Q();
            for (let content of contents) {
                prom = prom.then(() => {
                    return this.uploadFile({
                        data: content,
                        path: path
                    })
                    .then(result => {
                        ids.push(result.fileResult.entryId);
                    });
                });
            }
            return prom.then(result => {
                if (fileNamesDeferred) {
                    fileNamesDeferred.resolve(ids);
                }
            })
            .progress(progress => {
                this.notifications.progressNotification(notificationId, progress);
            })
            .fin(() => {
                this.notifications.hideNotification(notificationId);
            });
        })
        .fail(this.errorCallback);
    }
    
    processDragDrop(fileHandle: Types.app.FileHandle[])  {
        return Q().then(() => {
            let filesActions: Q.Promise<any>[] = [];
            fileHandle.forEach(x => {
                filesActions.push(this.onDragDropSingle(x));
            })
            return Q.all(filesActions);
        })
        .fail(this.errorCallback);
    }
    onDragDropSingle(fileHandle: Types.app.FileHandle) {
        let formatter = new utils.Formatter();
        let notificationId: number;
        return Q().then(() => {
            return Q().then(() => {
                let content = this.app.createContent(fileHandle);
                let limit = this.app.getMaxFileSizeLimit();
                if (content.getSize() > limit) {
                    return Q.reject<void>(this.i18n("plugin.notes2.component.filesList.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit))).thenResolve(null);
                }
                else {
                    notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.creatingFile"), {autoHide: false, progress: true});
                    return this.uploadFile({
                        data: content,
                        path: this.currentPath
                    });
                }
            })
            .progress(progress => {
                this.notifications.progressNotification(notificationId, progress);
            })
            .fin(() => {
                this.notifications.hideNotification(notificationId);
                this.parent.focusMe();
            });
        })
        .fail(this.errorCallback);
    }
    
    refreshTree(withoutNotification?: boolean, fullRefresh?: boolean) {
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;
        Q().then(() => {
            let notificationId: number;
            if (withoutNotification !== true) {
                notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.actions.refreshing"), { autoHide: false, progress: true });
            }
            Q().then(() => {
                return this.onRefresh();
            })
            .then(() => {
                if (fullRefresh) {
                    this.transformCollection.rebuild();
                }
            })
            .fail(this.logErrorCallback)
            .fin(() => {
                if (withoutNotification !== true) {
                    this.notifications.hideNotification(notificationId);
                }
            });
        }).fin(() => {
            setTimeout(() => {
                this.isRefreshing = false;
            },  800);
        })
    }
    
    send() {
        let active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        this.withOpenableElement(active.id, openableElement => {
            this.app.sendFile({
                getData: () => openableElement,
                notifications: this.notifications,
                parent: this.parent.getClosestNotDockedController(),
            });
        });
    }
    
    attachToTask(): void {
        let active = this.getSelectedEntry();
        if (active) {
            this.withOpenableElement(active.id, openableElement => {
                if (openableElement instanceof LocalOpenableElement) {
                    let tasksPlugin = this.app.getComponent("tasks-plugin");
                    window.taskchooser.TaskChooserWindowController.attachLocalFileToTask(this.parent.getClosestNotDockedController(), this.session, tasksPlugin, openableElement, this.notifications);
                }
                else {
                    this.sectionManager.getFileOpenableElement(openableElement.getElementId(), false).then(file => {
                        let resolved = this.session.sectionManager.resolveFileId(file.getElementId());
                        let section = resolved.section;
                        let tasksModule = section.getKvdbModule();
                        let tasksPlugin = this.app.getComponent("tasks-plugin");
                        if (!tasksModule || !tasksPlugin) {
                            return null;
                        }
                        window.taskchooser.TaskChooserWindowController.attachFileToTask(this.parent.getClosestNotDockedController(), this.session, tasksPlugin, section, file, null);
                    });
                }
            });
        }
    }
    
    copy() {
        let activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        let proms: Q.Promise<void>[] = [];
        let filesToCopy: ClipboardFileEntry[] = [];
        let directoriesToCopy: ClipboardDirectoryEntry[] = [];
        for (let activeEntry of activeEntries) {
            if (activeEntry.id == "parent") {
                continue;
            }
            let entry = this.getTreeEntry(activeEntry.id);
            let local = Notes2Utils.isLocalEntry(entry);
            if (entry && entry.isDirectory()) {
                let clipboardEntry: ClipboardDirectoryEntry = {
                    entryId: entry.id,
                    cut: false,
                    local: local,
                    hostHash: local ? null : this.session.hostHash,
                };
                directoriesToCopy.push(clipboardEntry);
            }
            else if (entry && entry.isFile()) {
                let getEl: Q.Promise<app.common.shelltypes.OpenableElement>;
                if (local) {
                    getEl = LocalOpenableElement.create(<any>entry);
                }
                else {
                    getEl = this.sectionManager.getFileOpenableElement(entry.id, true);
                }
                proms.push(getEl.then(element => {
                    let clipboardEntry: ClipboardFileEntry = {
                        element: element,
                        entryId: entry.id,
                        cut: false,
                        local: local,
                        hostHash: local ? null : this.session.hostHash,
                    };
                    filesToCopy.push(clipboardEntry);
                }));
            }
            else {
                this.withOpenableElement(activeEntry.id, element => {
                    let clipboardEntry: ClipboardFileEntry = {
                        element: element,
                        cut: false,
                        local: local,
                        hostHash: local ? null : this.session.hostHash,
                    };
                    filesToCopy.push(clipboardEntry);
                });
            }
        }
        
        Q.all(proms)
        .then(() => {
            if (filesToCopy.length + directoriesToCopy.length == 0) {
                return;
            }
            if (activeEntries.length == 1) {
                if (filesToCopy.length > 0) {
                    this.app.clipboard.set({ file: filesToCopy[0] });
                }
                else if (directoriesToCopy.length > 0) {
                    this.app.clipboard.set({ directory: directoriesToCopy[0] });
                }
            }
            else {
                let data: app.common.clipboard.ClipboardData = {};
                if (filesToCopy.length > 0) {
                    data.files = filesToCopy;
                }
                if (directoriesToCopy.length > 0) {
                    data.directories = directoriesToCopy;
                }
                this.app.clipboard.set(data);
            }
            this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.copied-to-clipboard"));
        })
        .fail(this.logErrorCallback);
    }
    
    cut() {
        let activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        let proms: Q.Promise<void>[] = [];
        let filesToCopy: ClipboardFileEntry[] = [];
        let directoriesToCopy: ClipboardDirectoryEntry[] = [];
        for (let activeEntry of activeEntries) {
            if (activeEntry.id == "parent") {
                continue;
            }
            let entry = this.getTreeEntry(activeEntry.id);
            let local = Notes2Utils.isLocalEntry(entry);
            if (!entry) {
                this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.cannot-cut"));
                return;
            }
            if (entry.isDirectory()) {
                let clipboardEntry: ClipboardDirectoryEntry = {
                    entryId: entry.id,
                    cut: true,
                    local: local,
                    hostHash: local ? null : this.session.hostHash,
                };
                directoriesToCopy.push(clipboardEntry);
            }
            else if (entry.isFile()) {
                let getEl: Q.Promise<app.common.shelltypes.OpenableElement>;
                if (local) {
                    getEl = LocalOpenableElement.create(<any>entry);
                }
                else {
                    getEl = this.sectionManager.getFileOpenableElement(entry.id, true);
                }
                proms.push(getEl.then(element => {
                    let clipboardEntry: ClipboardFileEntry = {
                        element: element,
                        entryId: entry.id,
                        cut: true,
                        local: local,
                        hostHash: local ? null : this.session.hostHash,
                    };
                    filesToCopy.push(clipboardEntry);
                }));
            }
        }
        
        Q.all(proms)
        .then(() => {
            if (filesToCopy.length + directoriesToCopy.length == 0) {
                return;
            }
            if (activeEntries.length == 1) {
                if (filesToCopy.length > 0) {
                    this.app.clipboard.set({ file: filesToCopy[0] });
                }
                else if (directoriesToCopy.length > 0) {
                    this.app.clipboard.set({ directory: directoriesToCopy[0] });
                }
            }
            else {
                let data: app.common.clipboard.ClipboardData = {};
                if (filesToCopy.length > 0) {
                    data.files = filesToCopy;
                }
                if (directoriesToCopy.length > 0) {
                    data.directories = directoriesToCopy;
                }
                this.app.clipboard.set(data);
            }
            this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.cut-to-clipboard"));
        })
        .fail(this.logErrorCallback);
    }
    
    createNewDirectory(): Q.IWhenable<void> {
        if (!this.currentDir && this.filesInfo.type != FilesListType.CONVERSATION) {
            return;
        }
        this.parent.promptEx({
            title: this.i18n("plugin.notes2.component.filesList.newDirectory.title"),
            message: this.i18n("plugin.notes2.component.filesList.newDirectory.message"),
            input: {
                value: "new-directory"
            }
        })
        .then(result => {
            if (result.result != "ok" || !result.value) {
                return;
            }
            return this.createNewDirectoryWithName(result.value);
        });
    }
    
    createNewDirectoryWithName(dirName: string, notificationId?: number): Q.IWhenable<void> {
        if (!this.currentDir && this.filesInfo.type != FilesListType.CONVERSATION) {
            return;
        }
        if (!this.currentDir) {
            return Q().then(() => {
                return this.tryCreateConversation(() => this.createNewDirectoryWithName(dirName, notificationId));
            })
            .fail(this.errorCallback)
            .fin(() => {
                this.notifications.hideNotification(notificationId);
            });
        }
        let exists = false;
        if (Notes2Utils.isLocalEntry(this.currentDir)) {
            let path = LocalFS.joinPath(this.currentDir.path, dirName);
            if (LocalFS.exists(path)) {
                exists = true;
            }
        }
        else {
            for (let name in this.currentDir.entries) {
                if (name == dirName) {
                    exists = true;
                }
            }
        }
        if (exists) {
            this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.dirAlreadyExists", dirName));
            return;
        }
        notificationId = notificationId != null ? notificationId : this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.creating-directory"), {autoHide: false, progress: true});
        let path = mail.filetree.nt.Helper.resolvePath(this.currentDir.path, dirName)
        return Q().then(() => {
            if (Notes2Utils.isLocalEntry(this.currentDir)) {
                return LocalFS.createDir(LocalFS.joinPath(this.currentDir.path, dirName));
            }
            else {
                return this.currentDir.tree.fileSystem.mkdir(path);
            }
        })
        .then(() => {
            Q().then(() => {
                if (Notes2Utils.isLocalEntry(this.currentDir)) {
                    return;
                }
                let section = this.currentDir.tree.section;
                if (section == null || section.isPrivate() || !section.hasChatModule()) {
                    return;
                }
                let chatModule = this.currentDir.tree.section.getChatModule();
                return chatModule.sendCreateDirectoryMessage(path);
            }).fail(e => {
                this.logError(e);
            });
        })
        .progress(progress => {
            this.notifications.progressNotification(notificationId, progress);
        })
        .fail(this.errorCallback)
        .fin(() => {
            this.notifications.hideNotification(notificationId);
        });
    }
    
    resolveUploadResultToId(result: Types.section.UploadFileResult): string {
        if (result.fileResult) {
            return result.fileResult.entryId;
        }
        else if (result.mailResult) {
            return app.common.shelltypes.OpenableAttachment.getElementId(result.mailResult.receiver.sink.id, result.mailResult.source.serverId, 0);
        }
        return null;
    }
    
    goToResult(result: Types.section.UploadFileResult): void {
        this.goToIdEx(this.resolveUploadResultToId(result));
    }
    
    goToIdEx(id: string): void {
        if (!this.goToId(id)) {
            setTimeout(() => {
                this.goToId(id)
            }, 200);
        }
    }
    
    goToId(id: string): boolean {
        let ele = this.activeCollection.find(x => x.id == id);
        if (ele) {
            this.clearSelection();
            this.activeCollection.setActive(ele);
            this.activeCollection.setSelected(ele);
            this.sendSelectionToView();
            return true;
        }
        return false;
    }
    
    paste() {
        if (this.isTrash) {
            return;
        }
        Q().then(() => {
            return this.app.getClipboardElementToPaste(
                [
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE,
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES,
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORY,
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORIES,
                ], [
                    app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES,
                ]
            );
        }).then(elementToPaste => {
            if (!elementToPaste) {
                return;
            }
            if (elementToPaste.source == "system") {
                let pasteFromOsStr = elementToPaste.data[app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES];
                let pasteFromOs: { mime: string, path?: string, data?: Buffer }[] = JSON.parse(pasteFromOsStr).map((x: { mime: string, path?: string, data?: any }) => {
                    if (x.data && x.data.type == "Buffer" && x.data.data) {
                        x.data = new Buffer(x.data.data);
                    }
                    return x;
                });
                let fileElements = pasteFromOs.filter(x => !!x.path);
                let imgElements = pasteFromOs.filter(x => !!x.data);
                Q().then(() => {
                    let prom = Q();
                    if (fileElements.length > 0) {
                        for (let file of fileElements) {
                            let fileName = file.path;
                            if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                                fileName = fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                            }
                            let data: Buffer = file.data ? file.data : require("fs").readFileSync(file.path);
                            prom = prom.then(() => this.upload(this.currentPath, privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)));
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
                        prom = prom.then(() => this.upload(this.currentPath, privfs.lazyBuffer.Content.createFromBuffer(file.data, file.mime, fileName)));
                    }
                    return prom;
                });
            }
            else if (elementToPaste.source == "privmx" && app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE in elementToPaste.data) {
                this.pasteFile(this.app.clipboard.getFormat<ClipboardFileEntry>("file"));
            }
            else if (elementToPaste.source == "privmx" && app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORY in elementToPaste.data) {
                this.pasteDirectory(this.app.clipboard.getFormat<ClipboardDirectoryEntry>("directory"));
            }
            else if (elementToPaste.source == "privmx" && (app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES in elementToPaste.data || app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORIES in elementToPaste.data)) {
                let notificationId: number;
                let prom: Q.Promise<void> = Q();
                return Q().then(() => {
                    notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.pasting-from-clipboard"), {autoHide: false, progress: true});
                    if (app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES in elementToPaste.data) {
                        let files = this.app.clipboard.getFormat<ClipboardFileEntry[]>("files");
                        for (let file of files) {
                            prom = prom.then(() => {
                                return this.pasteFile(file, false);
                            });
                        }
                    }
                    if (app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORIES in elementToPaste.data) {
                        let directories = this.app.clipboard.getFormat<ClipboardDirectoryEntry[]>("directories");
                        for (let directory of directories) {
                            prom = prom.then(() => {
                                return this.pasteDirectory(directory, null, false);
                            });
                        }
                    }
                    return prom;
                })
                .fin(() => {
                    this.notifications.hideNotification(notificationId);
                })
            }
        });
        // format files, directories
    }
    
    uploadFiles(files: { buffer: Buffer, fileName: string, mime: string }[]): Q.Promise<void> {
        let contents = files.map(x => privfs.lazyBuffer.Content.createFromBuffer(x.buffer, x.mime, x.fileName));
        return this.upload(this.currentPath, contents);
    }
    
    pasteFile(data: ClipboardFileEntry, showNotifications: boolean = true): Q.Promise<void> {
        if (!data || !data.element) {
            return Q();
        }
        if (data.cut) {
            this.app.clipboard.clear();
        }
        let fromLocal = data.local;
        let toLocal = Notes2Utils.isLocalEntry(this.currentDir);
        let notificationId = (showNotifications && fromLocal == toLocal) ? this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.pasting-from-clipboard"), {autoHide: false, progress: true}) : null;
        
        let prom = Q();
        
        // Local copy
        if (fromLocal && toLocal) {
            let el: LocalOpenableElement = <any>data.element;
            prom = this.copyFileLocalToLocal(el.entry.id, this.currentPath, data.cut).then(id => {
                this.goToIdEx(id);
            });
        }
        
        // Upload
        if (fromLocal && !toLocal) {
            let el: LocalOpenableElement = <any>data.element;
            let def = Q.defer<string[]>();
            prom = this.upload(this.currentPath, el.content, def).then(() => {
                def.promise.then(ids => {
                    if (ids.length > 0) {
                        this.goToIdEx(ids[0]);
                    }
                });
                if (data.cut) {
                    return LocalFS.deleteFile(el.getElementId());
                }
            });
        }
        
        // Download
        if (!fromLocal && toLocal) {
            prom = this.copyFileRemoteToLocal(data.element, this.currentPath, data.cut).then(id => {
                this.goToIdEx(id);
            });
        }
        
        // Remote copy
        if (!fromLocal && !toLocal) {
            prom = prom.then(() => {
                if (data.entryId && data.cut) {
                    // Move if possible (elementToMove parameter)
                    let resolved = this.sectionManager.resolveFileId(data.entryId);
                    return this.uploadFile({
                        data: data.element,
                        path: this.currentPath,
                        noMessage: this.currentDir != null && resolved && resolved.section == this.currentDir.tree.section,
                        elementToMove: data.entryId,
                        statusCallback: this.onMultiStatus.bind(this)
                    })
                    .then(result => {
                        if (!result.moveResult || !result.moveResult.success) {
                            this.parent.alert(this.i18n("plugin.notes2.component.filesList.notifier.copied-but-not-moved"));
                            this.logError(result.moveResult.error);
                        }
                        return result;
                    })
                    .then(result => {
                        let destinationSection = this.getSection();
                        let sourceSection = resolved.section;
                        let fName = resolved.path.split("/").slice(-1)[0];
                        let newPath = mail.filetree.nt.Helper.resolvePath(this.currentPath, fName);
                        
                        return Q.all([
                            this.notes2Plugin.sendMoveFileMessage(sourceSection, resolved.path, newPath, sourceSection, destinationSection),
                            this.notes2Plugin.sendMoveFileMessage(destinationSection, resolved.path, newPath, sourceSection, destinationSection),
                        ])
                        .thenResolve(result);
                    });
                }
                
                // When you try cut not entry element then cut is ommited and regular copy is performed
                // Copy with version if possible (copyFrom parameter)
                // When copy not by copyFrom, set create and modify dates to now
                return this.uploadFile({
                    data: data.element,
                    path: this.currentPath,
                    copyFrom: data.entryId,
                    statusCallback: this.onMultiStatus.bind(this),
                    fileOptions: {
                        metaUpdater: data.entryId ? undefined : meta => {
                            meta.createDate = new Date().getTime(),
                            meta.modifiedDate = new Date().getTime()
                        }
                    }
                });
            })
            .then(res => {
                this.goToResult(res);
            })
            .progress(progress => {
                if (notificationId !== null) {
                    this.notifications.progressNotification(notificationId, progress);
                }
            });
        }
        return prom.fail(e => {
            if (data.cut) {
                this.app.clipboard.set(data);
            }
            if (e != "not-performed") {
                this.errorCallback(e);
            }
        })
        .fin(() => {
            if (notificationId !== null) {
                this.notifications.hideNotification(notificationId);
            }
        });
    }
    
    copyFileLocalToLocal(srcPath: string, dstDir: string, cut: boolean = false): Q.Promise<string> {
        let fileName = LocalFS.getFileName(srcPath);
        
        if (cut && srcPath == LocalFS.joinPath(dstDir, fileName)) {
            cut = false;
        }
        
        let dstPath = LocalFS.getAltPath(dstDir, fileName);
        if (cut) {
            return LocalFS.move(srcPath, dstPath, false).then(() => {
                return dstPath;
            })
        }
        return LocalFS.copyFile(srcPath, dstPath, false).then(() => {
            return dstPath;
        });
    }
    
    copyDirLocalToLocal(srcPath: string, dstDir: string, cut: boolean = false): Q.Promise<string> {
        if ((dstDir + "/").indexOf(srcPath + "/") >= 0) {
            return Q.reject("Recursion is not allowed");
        }
        let dirName = LocalFS.getFileName(srcPath);
        if (cut && srcPath == LocalFS.joinPath(dstDir, dirName)) {
            cut = false;
        }
        let dstPath = LocalFS.getAltPath(dstDir, dirName);
        
        if (cut) {
            return LocalFS.move(srcPath, dstPath, false).then(() => {
                return dstPath;
            })
        }
        return LocalFS.copyDir(srcPath, dstPath, false).then(() => {
            return dstPath;
        });
    }
    
    copyFileRemoteToLocal(srcEl: OpenableElement, dstDir: string, cut: boolean = false): Q.Promise<string> {
        let fileName = LocalFS.getFileName(srcEl.getName());
        let dstPath = LocalFS.getAltPath(dstDir, fileName);
        let deferred = Q.defer<string>();
        LocalFS.createFile(dstPath).then(() => {
            this.withOpenableElement(dstPath, dst => {
                dst.save(srcEl.content).then(() => {
                    if (cut) {
                        Q().then(() => {
                            return this.dispatchEventResult(<RemoveFileEvent>{type: "fileremoved"});
                        })
                        .then(() => {
                            if (srcEl instanceof app.common.shelltypes.OpenableFile) {
                                srcEl.fileSystem.removeFile(srcEl.path);
                            }
                        })
                        .then(() => {
                            deferred.resolve(dstPath);
                        })
                        .fail(e => {
                            this.logError(e);
                        });
                    }
                    else {
                        deferred.resolve(dstPath);
                    }
                }).fail(err => { deferred.reject(err); });
            });
        }).fail(err => { deferred.reject(err); });
        return deferred.promise;
    }
    
    onMultiStatus(result: privfs.fs.file.multi.OperationResult, multi: privfs.fs.file.multi.MultiOperation): Q.IWhenable<void> {
        if (result.status == privfs.fs.file.multi.OperationStatus.DESTINATION_CANNOT_BE_CHILD_OF_SOURCE) {
            this.parent.alert(this.i18n("plugin.notes2.component.filesList.error.destinationChildOfSource"));
            multi.finish();
            return;
        }
        if (result.status == privfs.fs.file.multi.OperationStatus.SOURCE_EQUALS_DESTINATION) {
            if (result.operation.type == privfs.fs.file.multi.OperationType.MOVE) {
                multi.finish();
                return;
            }
            let nr = new privfs.fs.file.entry.SimpleNameResolver(result.source.type == "file", result.source.name);
            let newName = nr.getCurrentName();
            while (result.source.elementsInDir.indexOf(newName) != -1) {
                newName = nr.getNextName();
            }
            result.operation.destination.path = mail.filetree.nt.Helper.resolvePath(result.source.dirPath, newName);
            multi.addOperation(result.operation);
            return;
        }
        if (result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE ||
            result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORIES_MERGE ||
            result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORY_OVERWRITE_BY_FILE ||
            result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE_BY_DIRECTORY) {

            return this.app.ioc.create(FileConflictResolverWindowController, [this.parent, FileConflictResolverWindowController.convertModel(result, this.app)]).then(win => {
                win.parent = this.parent.getClosestNotDockedController();
                return this.parent.openChildWindow(win).getPromise().then(r => {
                    if (r.abort) {
                        return multi.finish();
                    }
                    result.operation.conflictBehavior = result.operation.conflictBehavior || {};
                    let cb = r.forAll ? multi.conflictBehavior : result.operation.conflictBehavior;
                    if (result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE) {
                        cb.overwriteFile = r.behaviour;
                    }
                    else if (result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORIES_MERGE) {
                        cb.mergeDirectories = r.behaviour;
                    }
                    else if (result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORY_OVERWRITE_BY_FILE) {
                        cb.overwriteDirectoryByFile = r.behaviour;
                    }
                    else if (result.status == privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE_BY_DIRECTORY) {
                        cb.overwriteFileByDirectory = r.behaviour;
                    }
                    multi.addOperation(result.operation);
                });
            });
        }
        let logStates = [
            privfs.fs.file.multi.OperationStatus.START,
            privfs.fs.file.multi.OperationStatus.FILE_CREATE_SUCCESS,
            privfs.fs.file.multi.OperationStatus.DIRECTORY_CREATE_SUCCESS,
            privfs.fs.file.multi.OperationStatus.FILE_MOVE_SUCCESS,
            privfs.fs.file.multi.OperationStatus.DIRECTORY_MOVE_SUCCESS,
            privfs.fs.file.multi.OperationStatus.FILE_REMOVE_SUCCESS,
            privfs.fs.file.multi.OperationStatus.DIRECTORY_REMOVE_SUCCESS,
            privfs.fs.file.multi.OperationStatus.FILE_OMITTED,
            privfs.fs.file.multi.OperationStatus.DIRECTORY_OMITTED
        ];
        if (logStates.indexOf(result.status) == -1) {
            if (result.error) {
                this.logError(result.error);
            }
            return this.app.ioc.create(FileErrorWindowController, [this.parent, FileErrorWindowController.convertModel(result)]).then(win => {
                return this.parent.openChildWindow(win).getPromise().then(r => {
                    if (r.abort) {
                        return multi.finish();
                    }
                    if (r.retry) {
                        multi.addOperation(result.operation);
                    }
                    else {
                        return this.onMultiStatus({
                            status: privfs.fs.file.multi.OperationStatus.FILE_OMITTED,
                            operation: result.operation,
                            error: result.error,
                            removed: result.removed,
                            data: result.data
                        }, multi);
                    }
                });
            });
        }
    }
    
    tryCreateConversation<T>(onCreate: () => Q.IWhenable<T>): Q.Promise<T> {
        if (this.filesInfo.type != FilesListType.CONVERSATION) {
            return Q<T>(null);
        }
        return Q().then(() => {
            if (this.filesInfo.conversation.section) {
                return this.filesInfo.conversation.section;
            }
            return this.conv2Service.createUserGroup(this.filesInfo.conversation.users);
        })
        .then(() => {
            if (this.isActive) {
                this.notes2Plugin.activeSinkId = this.filesInfo.conversation.sinkIndex ? this.filesInfo.conversation.sinkIndex.sink.id : null;
                this.notes2Plugin.activeSinkHostHash = this.session.hostHash;
            }
            if (!this.filesInfo.conversation.section) {
                return;
            }
            return this.filesInfo.conversation.prepareFilesCollection().then(() => {
                if (this.filesInfo.conversation.fileTree) {
                    this.currentPath = "/";
                    this.currentDir = this.filesInfo.conversation.fileTree.root;
                    return onCreate();
                }
            });
        });
    }
    
    pasteDirectory(data: ClipboardDirectoryEntry, notificationId?: number, showNotifications: boolean = true): Q.IWhenable<void> {
        if (!data || !data.entryId) {
            return;
        }
        if (!this.currentDir && this.filesInfo.type != FilesListType.CONVERSATION) {
            return;
        }
        if (showNotifications) {
            notificationId = notificationId != null ? notificationId : this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.pasting-from-clipboard"), {autoHide: false, progress: true});
        }
        if (!this.currentDir) {
            return Q().then(() => {
                return this.tryCreateConversation(() => this.pasteDirectory(data, notificationId));
            })
            .fail(this.errorCallback)
            .fin(() => {
                this.notifications.hideNotification(notificationId);
            });
        }
        
        let fromLocal = data.local;
        let toLocal = Notes2Utils.isLocalEntry(this.currentDir);
        
        // Local copy
        if (fromLocal && toLocal) {
            return this.copyDirLocalToLocal(data.entryId, this.currentPath, data.cut).then(id => {
                this.goToIdEx(id);
            })
            .fail(this.errorCallback)
            .fin(() => {
                this.notifications.hideNotification(notificationId);
            });
        }
        
        // Download or Upload or Remote copy
        let isUpload = fromLocal && !toLocal;
        let isDownload = !fromLocal && toLocal;
        let isRemoteCopy = !fromLocal && !toLocal;
        let mgr = this.app.sessionManager;
        let fromSession = (fromLocal || !mgr.isSessionExistsByHostHash(data.hostHash) ? mgr.getLocalSession() : mgr.getSessionByHostHash(data.hostHash)) || mgr.getLocalSession();
        let toSession = (toLocal ? mgr.getLocalSession() : this.session) || mgr.getLocalSession();
        let isCrossSessionCopy = isRemoteCopy && fromSession.host != toSession.host;
        let toResolve = isUpload ? this.currentDir.id : data.entryId;
        let toResolveSession = isUpload ? toSession : fromSession;
        let resolved = toResolveSession.sectionManager.resolveFileId(toResolve);
        return Q().then(() => {
            return resolved.section.getFileSystem();
        })
        .then(srcFs => {
            if (fromLocal || toLocal) {
                // Download or Upload
                return Q().then(() => {
                    return resolved.section.getFileSystem();
                }).then(srcFs => {
                    if (toLocal) {
                        return this.downloadDir(srcFs, resolved.path, this.currentPath);
                    }
                    else {
                        return this.uploadDir(srcFs, data.entryId, resolved.path);
                    }
                }).then(name => {
                    this.goToIdEx(toLocal ? name : (this.currentDir.id.split("/")[0] + name));
                    if (data.cut) {
                        if (toLocal) {
                            return srcFs.shell.remove(resolved.path);
                        }
                        else {
                            return LocalFS.deleteDir(data.entryId);
                        }
                    }
                });
            }
            else if (!isCrossSessionCopy) {
                // Remote copy
                let srcName = mail.filetree.Path.parsePath(resolved.path).name.original;
                let dstPath = mail.filetree.nt.Helper.resolvePath(this.currentDir.path, srcName);
                if (data.cut) {
                    return srcFs.shell.move(resolved.path, dstPath, null, null, this.onMultiStatus.bind(this), this.currentDir.tree.fileSystem.shell);
                }
                return srcFs.shell.copy(resolved.path, dstPath, null, null, this.onMultiStatus.bind(this), this.currentDir.tree.fileSystem.shell);
            }
            else {
                // Remote copy, sections in two different sessions
                let srcPath = mail.filetree.Path.parsePath(resolved.path);
                let dstPath = this.currentDir.path;
                return this.getSection().getFileSystem().then(dstFs => {
                    // console.log(`copyDirBetweenFileSystems(${resolved.section.getName()}, ${this.getSection().getName()}, ${srcPath.path}, ${dstPath})`);
                    return this.copyDirBetweenFileSystems(srcFs, dstFs, srcPath.path, dstPath);
                })
                .then(() => {
                    if (data.cut) {
                        return srcFs.shell.remove(resolved.path);
                    }
                });
            }
        })
        .progress(progress => {
            this.notifications.progressNotification(notificationId, progress);
        })
        .fail(this.errorCallback)
        .fin(() => {
            this.notifications.hideNotification(notificationId);
        });
    }
    
    downloadDir(fs: privfs.fs.file.FileSystem, src: string, dst: string) {
        let dirName = LocalFS.getFileName(src);
        let finalPath = "";
        dst = LocalFS.getAltPath(dst, dirName);
        finalPath = dst;
        return LocalFS.createDir(dst).then(() => {
            return fs.list(src).then(entries => {
                let prom = Q("");
                entries.forEach(entry => {
                    if (entry.isDirectory()) {
                        prom = prom.then(()=> {
                            return this.downloadDir(fs, LocalFS.joinPath(src, entry.name), dst);
                        });
                    }
                    else if (entry.isFile()) {
                        prom = prom.then(() => {
                            return LocalFS.createFile(LocalFS.joinPath(dst, entry.name));
                        })
                        .then(() => {
                            return fs.read(LocalFS.joinPath(src, entry.name));
                        }).then(cnt => {
                            return LocalOpenableElement.create(LocalFS.joinPath(dst, entry.name)).then(el => {
                                el.save(cnt);
                                return "";
                            });
                        });
                    }
                });
                return prom;
            });
        }).then(() => {
            return finalPath;
        });
    }
    
    uploadDir(fs: privfs.fs.file.FileSystem, src: string, dst: string) {
        let dirName = LocalFS.getFileName(src);
        let finalPath = "";
        return Q().then(() => {
            return this.safeMkdirRemote(dst, dirName, fs);
        })
        .then(dst => {
            finalPath = dst;
            return LocalFS.listEntries(src).then(entries => {
                let prom = Q("");
                entries.forEach(entryName => {
                    let entry = LocalFS.getEntry(entryName);
                    if (entry) {
                        if (entry.isDirectory()) {
                            prom = prom.then(()=> {
                                return this.uploadDir(fs, LocalFS.joinPath(src, entry.name), dst);
                            });
                        }
                        else if (entry.isFile()) {
                            prom = prom.then(() => {
                                return LocalOpenableElement.create(entry.path);
                            }).then(el => {
                                return fs.write(LocalFS.joinPath(dst, entry.name), privfs.fs.file.Mode.READ_WRITE_CREATE, el.content).then(() => {
                                    return "";
                                });
                            });
                        }
                    }
                });
                return prom;
            });
        }).then(() => {
            return finalPath;
        });
    }
    
    copyDirBetweenFileSystems(srcFs: privfs.fs.file.FileSystem, dstFs: privfs.fs.file.FileSystem, srcPath: string, dstPath: string): Q.Promise<string> {
        let dirName = srcPath.replace(/\\/g, "/").split("/").filter(x => !!x).reverse()[0];
        // console.log({dirName})
        let finalPath = "";
        return Q().then(() => {
            // console.log(`safeMkdirRemote(${dstPath}, ${dirName}, _)`);
            
            return this.safeMkdirRemote(dstPath, dirName, dstFs);
            // return dstPath + "/" + dirName;
        })
        .then(dst => {
            finalPath = dst;
            // console.log({finalPath})
            return srcFs.list(srcPath).then(entries => {
                //console.log("entries:", entries.map(x=>x.name));
                let prom = Q("");
                entries.forEach(entry => {
                    if (entry.isDirectory()) {
                        prom = prom.then(()=> {
                            //console.log(`copyDirBetweenFileSystems(${srcPath + "/" + entry.name}, ${dst})`);
                            return this.copyDirBetweenFileSystems(srcFs, dstFs, srcPath + "/" + entry.name, dst);
                        });
                    }
                    else if (entry.isFile()) {
                        prom = prom.then(() => {
                            //console.log(`srcFs.read(${srcPath + "/" + entry.name})`);
                            return srcFs.read(srcPath + "/" + entry.name);
                        }).then(el => {
                            //console.log(`dstFs.write(${dst + "/" + entry.name})`);
                            return dstFs.write(dst + "/" + entry.name, privfs.fs.file.Mode.READ_WRITE_CREATE, el);
                        })
                        .thenResolve("");
                        // prom = prom.then(() => {
                        //     return LocalFS.createFile(LocalFS.joinPath(dst, entry.name));
                        // })
                        // .then(() => {
                        //     return fs.read(LocalFS.joinPath(src, entry.name));
                        // }).then(cnt => {
                        //     return LocalOpenableElement.create(LocalFS.joinPath(dst, entry.name)).then(el => {
                        //         el.save(cnt);
                        //         return "";
                        //     });
                        // });
                    }
                //     let entry = LocalFS.getEntry(entryName);
                //     if (entry) {
                //         if (entry.isDirectory()) {
                //             prom = prom.then(()=> {
                //                 return this.uploadDir(fs, LocalFS.joinPath(src, entry.name), dst);
                //             });
                //         }
                //         else if (entry.isFile()) {
                //             prom = prom.then(() => {
                //                 return LocalOpenableElement.create(entry.path);
                //             }).then(el => {
                //                 return fs.write(LocalFS.joinPath(dst, entry.name), privfs.fs.file.Mode.READ_WRITE_CREATE, el.content).then(() => {
                //                     return "";
                //                 });
                //             });
                //         }
                //     }
                });
                return prom;
            });
        })
        .then(() => {
            return finalPath;
        });
    }
    
    safeMkdirRemote(dstDir: string, fileName: string, fs: privfs.fs.file.FileSystem): Q.Promise<string> {
        let dstPath = LocalFS.joinPath(dstDir, fileName);
        let ext = LocalFS.getExt(fileName);
        let bn = LocalFS.getFileName(fileName, ext);
        let deferred = Q.defer<string>();
        
        let f = (id: number) => {
            if (id > 999) {
                return;
            }
            fs.mkdir(dstPath).then(x => {
                if (x) {
                    deferred.resolve(dstPath);
                }
                else {
                    dstPath = LocalFS.joinPath(dstDir, bn + "(" + (id) + ")" + ext);
                    f(id + 1);
                }
            });
        };
        f(1);
            
        return deferred.promise;
    }
    
    moveCursorUp(viewMode: ViewMode = "tiles", rowSize: number = 5, selectionChangeMode: SelectionChangeMode = SelectionChangeMode.CHANGE) {
        this.moveCursorByDelta(viewMode == "table" ? -1 : -rowSize, selectionChangeMode);
    }
    
    moveCursorDown(viewMode: ViewMode = "tiles", rowSize: number = 5, selectionChangeMode: SelectionChangeMode = SelectionChangeMode.CHANGE) {
        this.moveCursorByDelta(viewMode == "table" ? 1 : rowSize, selectionChangeMode);
    }
    
    moveCursorLeft(viewMode: ViewMode = "tiles", _rowSize: number = 5, selectionChangeMode: SelectionChangeMode = SelectionChangeMode.CHANGE) {
        if (viewMode != "tiles") {
            return;
        }
        this.moveCursorByDelta(-1, selectionChangeMode);
    }
    
    moveCursorRight(viewMode: ViewMode = "tiles", _rowSize: number = 5, selectionChangeMode: SelectionChangeMode = SelectionChangeMode.CHANGE) {
        if (viewMode != "tiles") {
            return;
        }
        this.moveCursorByDelta(1, selectionChangeMode);
    }
    
    moveCursorByDelta(delta: number, selectionChangeMode: SelectionChangeMode = SelectionChangeMode.CHANGE) {
        if (selectionChangeMode == SelectionChangeMode.CHANGE || this.activeCollection.selectedIndexes.length == 0) {
            let index = this.activeCollection.active ? (this.activeCollection.active.index + delta) : 0;
            index = Math.min(Math.max(index, 0), this.activeCollection.size() - 1);
            this.clearSelection();
            let el = this.activeCollection.get(index);
            if (el) {
                this.activeCollection.setSelected(el);
            }
            this.activeCollection.setActive(el);
        }
        else if (selectionChangeMode == SelectionChangeMode.SHRINK && this.activeCollection.selectedIndexes.length == 1) {
        }
        else {
            let shrink = selectionChangeMode == SelectionChangeMode.SHRINK;
            let selectedIndexes = this.activeCollection.selectedIndexes.slice().sort((a, b) => a - b);
            let indexes: number[] = [];
            let firstIndex = selectedIndexes[0];
            let lastIndex = selectedIndexes[selectedIndexes.length - 1];
            if (this.viewMode == "table") {
                if (delta < 0) {
                    indexes.push(shrink ? lastIndex : (firstIndex - 1));
                }
                else if (delta > 0) {
                    indexes.push(shrink ? firstIndex : (lastIndex + 1));
                }
            }
            else if (this.viewMode == "tiles") {
                if (delta < 0) {
                    for (let i = delta; i < 0; ++i) {
                        indexes.push(shrink ? (lastIndex + i + 1) : (firstIndex + i));
                    }
                }
                else if (delta > 0) {
                    for (let i = delta; i > 0; --i) {
                        indexes.push(shrink ? (firstIndex + i - 1) : (lastIndex + i));
                    }
                }
            }
            for (let idx of indexes) {
                let el = this.activeCollection.get(idx);
                if (el) {
                    if (selectionChangeMode == SelectionChangeMode.EXTEND) {
                        this.activeCollection.setSelected(el);
                    }
                    else {
                        this.activeCollection.deselect(el);
                    }
                }
            }
            
            let newSelectedIndexes = this.activeCollection.selectedIndexes.slice().sort((a, b) => a - b);
            let newFirstIndex = newSelectedIndexes[0];
            let newLastIndex = newSelectedIndexes[newSelectedIndexes.length - 1];
            let activeIndex = ((delta < 0 && !shrink) || (delta > 0 && shrink)) ? newFirstIndex : newLastIndex;
            let activeEl = this.activeCollection.get(activeIndex);
            if (activeEl) {
                this.activeCollection.setActive(activeEl);
            }
        }
        this.sendSelectionToView();
    }
    
    moveToDirectory(id: string) {
        let entry = this.getTreeEntry(id);
        if (!entry || !entry.isDirectory()) {
            return;
        }
        let toSelectId = id == "parent" ? (this.currentDir ? this.currentDir.id : null) : "parent";
        this.currentPath = entry.path;
        this.currentDir = this.isTrash && this.currentPath == FilesConst.TRASH_PATH ? null : entry;
        this.preventReselect = true;
        let prom = Q();
        if (Notes2Utils.isLocalEntry(entry)) {
            this.mergedCollection.removeCollection(this.proxyCollection);
            prom = this.localFS.browse(entry.path);
        }
        prom.then(() => {
            if (Notes2Utils.isLocalEntry(entry)) {
                this.mergedCollection.addCollection(this.proxyCollection);
            }
            this.filteredCollection.refresh();
            this.preventReselect = false;
            this.clearSelection();
            let el = this.activeCollection.find(x => x.id == toSelectId);
            if (el) {
                this.activeCollection.setSelected(el);
            }
            this.activeCollection.setActive(el);
            this.sendSelectionToView();
            this.callViewMethod("refreshPath", this.currentPath);
        });
    }
    
    chooseFile() {
        let entries = this.getSelectedEntries();
        let formatter = new utils.Formatter();
        if (!entries) {
            return;
        }
        
        if (entries.length == 1 && entries[0].type == "directory") {
            this.moveToDirectory(entries[0].id);
            return;
        }
        
        let elements: Q.Promise<OpenableElement>[] = [];
        entries.forEach(entry => {
            let func = Q().then(() => this.withOpenableElementPromise(entry));
            elements.push(func);
        })
        
        Q.all(elements)
        .then(res => {
            let limit = this.app.getMaxFileSizeLimit();
            let cancelUpload: boolean = false;
            res.forEach(f => {
                if (f.size > limit) {
                    cancelUpload = true;
                }
            });
            if (cancelUpload) {
                this.app.msgBox.alert(this.i18n("plugin.notes2.component.filesList.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit)));
                return;
            }

            if (typeof this.onFilesChoosen == "function") {
                this.onFilesChoosen(res);
            }
            else {
                throw Error("You must implement onFilesChoosen method when in FileChooser mode");
            }
        })
    }
    
    withOpenableElementPromise(entry: FileEntry): Q.Promise<OpenableElement> {
        let defer = Q.defer<OpenableElement>();
        this.withOpenableElement(entry.id, element => {
            return defer.resolve(element);
        })
        return defer.promise;
    }
    
    openExternalFile() {
        let active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        if (active.type == "directory") {
            this.moveToDirectory(active.id);
        }
        else {
            this.withOpenableElement(active.id, element => {
                let appHandle = this.app.shellRegistry.resolveApplicationByElement({element: element, session: this.session});
                this.app.shellRegistry.shellOpen({
                    element: element,
                    action: appHandle == null || appHandle.id == "core.unsupported" ? app.common.shelltypes.ShellOpenAction.EXTERNAL : app.common.shelltypes.ShellOpenAction.OPEN,
                    parent: this.parent.getClosestNotDockedController(),
                    session: this.session
                });
            });
        }
    }
    
    goToRoot() {
        this.moveToDirectory("parent");
    }
    
    reselect(currentIndex: number) {
        let length = this.activeCollection.size();
        if (currentIndex < length) {
            this.activeCollection.setActive(this.activeCollection.get(currentIndex));
        }
        else if (length > 0) {
            this.activeCollection.setActive(this.activeCollection.get(length - 1));
        }
        
        let newSelectedIndexes: number[] = [];
        for (let idx of this.activeCollection.selectedIndexes) {
            if (idx < length) {
                if (newSelectedIndexes.indexOf(idx) < 0) {
                    newSelectedIndexes.push(idx);
                }
            }
            else if (length > 0) {
                if (newSelectedIndexes.indexOf(length - 1) < 0) {
                    newSelectedIndexes.push(length - 1);
                }
            }
        }
    }
    
    exportFile() {
        let activeEntries = this.getSelectedEntries().filter(x => !x.isParentDir);
        if (activeEntries.length > 1 || (activeEntries.length == 1 && activeEntries[0].type == "directory")) {
            // Multi export
            let controller = this.parent ? this.parent.getClosestNotDockedController() : null;
            let parentWindow = controller ? controller.nwin : null;
            let exportSuccess: boolean = false;
            this.app.chooseDirectory(parentWindow).then(exportPath => {
                // Get lists of directories and files
                let directoryIdsToExport: string[] = [];
                let fileIdsToExport: string[] = activeEntries.filter(x => x.type == "file").map(x => x.id);
                let directoryIdsToProcess: string[] = activeEntries.filter(x => x.type == "directory").map(x => x.id);
                while (directoryIdsToProcess.length > 0) {
                    let dirId = directoryIdsToProcess.pop();
                    directoryIdsToExport.push(dirId);
                    let entry = <Directory>this.getTreeEntry(dirId);
                    let childEntries = entry.entries;
                    for (let childEntryKey in childEntries) {
                        let childEntry = childEntries[childEntryKey];
                        if (childEntry.type == "file") {
                            fileIdsToExport.push(childEntry.id);
                        }
                        else if (childEntry.type == "directory") {
                            directoryIdsToProcess.push(childEntry.id);
                        }
                    }
                }
                
                // Generate [remote source, local destination] pairs
                let getDestinationNameFn: (x: string) => string;
                if (this.currentDir) {
                    let baseStr = this.currentDir ? this.currentDir.id : "";
                    if (baseStr[baseStr.length - 1] == "/") {
                        baseStr = baseStr.substr(0, baseStr.length - 1);
                    }
                    let baseStrLength = baseStr.length;
                    getDestinationNameFn = (x: string) => exportPath + x.substr(baseStrLength);
                }
                else {
                    getDestinationNameFn = (x: string) => exportPath + x.substr(x.lastIndexOf("/"));
                }
                let exportDirectories: { source: string, destination: string }[] = directoryIdsToExport.map(x => ({source: x, destination: getDestinationNameFn(x) }));
                let exportFiles: { source: string, destination: string }[] = fileIdsToExport.map(x => ({source: x, destination: getDestinationNameFn(x) }));
                
                // Export
                let notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.exportingFiles"), {autoHide: false, progress: true});
                return Q().then(() => {
                    // Create directories
                    let prom = Q();
                    for (let dirExport of exportDirectories) {
                        prom = prom.then(() => LocalFS.createDir(dirExport.destination).thenResolve(null) );
                    }
                })
                .then(() => {
                    // Export files
                    let prom = Q();
                    for (let fileExport of exportFiles) {
                        prom = prom.then(() => {
                            return Q().then(() => {
                                return this.getOpenableElement(fileExport.source)
                            })
                            .then(openableElement => {
                                return openableElement.content.getBuffer();
                            })
                            .then(buffer => {
                                return LocalFS.writeFileEx(fileExport.destination, buffer);
                            });
                        });
                    }
                    return prom;
                })
                .then(() => {
                    exportSuccess = true;
                })
                .fin(() => {
                    this.notifications.hideNotification(notificationId);
                });
            })
            .then(() => {
                if (exportSuccess) {
                    setTimeout(() => {
                        this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.exportedFiles"));
                    }, 800);
                }
            })
            .fail(e => {
                if (e != "no-choose") {
                    this.errorCallback(e);
                }
            });
        }
        else {
            // Single file export
            let active = this.getSelectedEntry();
            if (!active) {
                return;
            }
            this.withOpenableElement(active.id, openableElement => {
                this.app.shellRegistry.shellOpen({
                    element: openableElement,
                    action: app.common.shelltypes.ShellOpenAction.DIRECT_DOWNLOAD,
                    parent: this.parent.getClosestNotDockedController(),
                    session: this.session
                });
            });
        }
    }
    
    askExportFiles() {
        this.parent.confirm(this.i18n("plugin.notes2.component.filesList.actions.export.confirm")).then(result => {
            if (result.result == "yes") {
                this.exportFiles();
            }
        })
    }
    
    exportFiles() {
        if (this.fileListId == FilesListController.LOCAL_FILES || this.fileListId == FilesListController.TRASH_FILES) {
            return;
        }
        let section = this.getSection();
        if (this.fileListId != FilesListController.ALL_FILES && section == null) {
            return;
        }
        let notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.exporting"), {autoHide: false});
        Q().then(() => {
            if (this.fileListId == FilesListController.ALL_FILES) {
                return this.sectionManager.exportFiles(true);
            }
            return section.exportFiles(true);
        })
        .progress(progress => {
            if (progress.type == "export-section") {
                this.notifications.progressNotification(notificationId, progress);
            }
        })
        .then(content => {
            content.name = "privmx-files.zip";
            return this.app.directSaveContent(content, this.session, this.parent.getClosestNotDockedController());
        })
        .fail(e => {
            if (e != "no-choose") {
                this.errorCallback(e);
            }
        })
        .fin(() => {
            this.notifications.hideNotification(notificationId);
        });
    }
    
    showHistory() {
        let active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        this.withOpenableElement(active.id, openableElement => {
            if (openableElement instanceof app.common.shelltypes.OpenableFile) {
                this.app.ioc.create(HistoryWindowController, [this.parent, this.session, openableElement.fileSystem, openableElement.path]).then(win => {
                    this.parent.openChildWindow(win);
                });
            }
        });
    }
    
    print() {
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        let active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        let app = this.app;
        if (app.isPrintable(active.mimeType)) {
            let notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.printing"), {autoHide: false, progress: true});
            this.isPrinting = true;
            Q().then(() => {
                return this.getOpenableElement(active.id);
            })
            .then(element => {
                if (!element) {
                    throw new Error("No element");
                }
                return app.print(this.session, element, this.parent.getClosestNotDockedController());
            })
            .then(printed => {
                if (printed) {
                    setTimeout(() => {
                        this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.printed"));
                    }, 500);
                }
            })
            .fin(() => {
                this.notifications.hideNotification(notificationId);
                this.isPrinting = false;
            });
        }
    }
    
    saveAsPdf() {
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        let active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        let app = this.app;
        if (app.canSaveAsPdf(active.mimeType)) {
            let notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.saving-as-pdf"), {autoHide: false, progress: true});
            this.isSavingAsPdf = true;
            
            Q().then(() => {
                return this.getOpenableElement(active.id);
            })
            .then(element => {
                if (!element) {
                    throw new Error("No element");
                }
                let ctrl = this.parent.getClosestNotDockedController();
                return app.saveAsPdf(this.session, element, ctrl ? ctrl.nwin : null);
            })
            .then(() => {
                setTimeout(() => {
                    this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.saved-as-pdf"));
                }, 500);
            })
            .fin(() => {
                this.notifications.hideNotification(notificationId);
                this.isSavingAsPdf = false;
            })
            .fail(() => {
                // Cancelled by user
            });
        }
    }

    getDidOfFile(section: mail.section.SectionService, path: string): Q.Promise<string> {
        return Q().then(() => {
            if (section && !section.isPrivate() && section.hasChatModule()) {
                return section.getFileOpenableElement(path, false).then(osf => { 
                    return osf.handle.descriptor.ref.did;
                })
            }
            else {
                return "";
            }
        })
    }
    
    deleteFile() {
        let activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        let selectedIndexes = this.activeCollection.selectedIndexes.slice();
        
        let confirmOptions: MsgBoxOptions = {
            width: 400,
            height: 140,
            title: this.i18n("plugin.notes2.component.filesList.actions.delete"),
            message: this.i18n("plugin.notes2.component.filesList.actions.delete.info"),
            //info: entry.tree.shared ? this.i18n("plugin.notes2.component.filesList.actions.delete-shared.info") : "",
            yes: {
                label: this.i18n("plugin.notes2.component.filesList.actions.button.delete-permanent"),
                faIcon: "trash",
                btnClass: "btn-warning",
            },
            no: {
                faIcon: "",
                btnClass: "btn-default",
                label: this.i18n("plugin.notes2.component.filesList.button.cancel.label")
            }
        };
        
        let prom = Q();
        let confirmDeferred: Q.Deferred<window.msgbox.MsgBoxResult> = null;
        let confirm = () => {
            if (confirmDeferred == null) {
                confirmDeferred = Q.defer();
                this.parent.confirmEx(confirmOptions).then(res => {
                    if (res.result == "yes") {
                        confirmDeferred.resolve();
                    }
                });
            }
            return confirmDeferred.promise;
        };
        
        let cannotDelete: boolean = false;
        let cannotDeleteShared: boolean = false;
        let sthDeleted: boolean = false;
        for (let activeEntry of activeEntries) {
            if (activeEntry.id == "parent") {
                continue;
            }
            let _entry = this.getTreeEntry(activeEntry.id);
            if (Notes2Utils.isLocalEntry(_entry)) {
                let entry: LocalEntry = _entry;
                prom = prom.then(() => {
                    return Q().then(() => {
                        if (entry == null || !LocalFS.isDeletable(entry.path)) {
                            return Q.reject<MsgBoxResult>();
                        }
                        return confirm();
                    }).then(() => {
                        if (entry.isDirectory()) {
                            return LocalFS.deleteDir(entry.path, false);
                        }
                        return LocalFS.deleteFile(entry.path, false);
                    }).then(() => {
                        sthDeleted = true;
                        return this.dispatchEventResult(<RemoveFileEvent>{type: "fileremoved"});
                    }).fail(() => {
                        cannotDelete = true;
                    });
                });
                continue;
            }
            
            let entry: Entry = _entry;
            if (entry == null || !this.isDeletable(entry.tree)) {
                cannotDelete = true;
                cannotDeleteShared = true;
                continue;
            }
            
            prom = prom.then(() => {
                return confirm().then(() => {
                    return this.deleteEntry(entry).then(result => {
                        if (result.sthDeleted !== null) {
                            sthDeleted = result.sthDeleted;
                        }
                        if (result.cannotDelete !== null) {
                            cannotDelete = result.cannotDelete;
                        }
                    });
                });
            });
        }
        
        return prom.then(() => {
            if (sthDeleted) {
                if (selectedIndexes.length > 0) {
                    this.reselectIndex = selectedIndexes[0];
                }
            }
            else if (cannotDelete) {
                this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.cannot-delete" + (cannotDeleteShared ? "-shared-file" : "")));
            }
        });
    }
    
    deleteEntry(entry: mail.filetree.nt.Entry): Q.Promise<{ sthDeleted: boolean, cannotDelete: boolean }> {
        let fileDid: string;
        let sthDeleted: boolean = null;
        let cannotDelete: boolean = null;
        return Q()
        .then(() => {
            return Q().then(() => {
                return entry.isFile() ? this.getDidOfFile(entry.tree.section, entry.path).then(did => {
                    fileDid = did;
                }) : null
            })
            .then(() => {
                sthDeleted = true;
                return this.dispatchEventResult(<RemoveFileEvent>{type: "fileremoved"});
            })
            .then(() => {
                return entry.tree.fileSystem.shell.remove(entry.path, this.onMultiStatus.bind(this));
            })
            .then(() => {
                let section = entry.tree.section;
                if (section == null || section.isPrivate() || !section.hasChatModule()) {
                    return;
                }
                let chatModule = section.getChatModule();
                return Q().then(() => {
                    if (entry.isDirectory()) {
                        return chatModule.sendDeleteDirectoryMessage(entry.path);
                    }
                    else {
                        return chatModule.sendDeleteFileMessage(entry.path, entry.meta.mimeType, fileDid);
                    }
                }).fail(e => {
                    this.logError(e);
                });
            })
            .fail(e => {
                this.logError(e);
                cannotDelete = true;
            });
        })
        .then(() => {
            return {
                sthDeleted: sthDeleted,
                cannotDelete: cannotDelete,
            }
        });
    }
    
    tryEmptyTrash(): void {
        this.parent.confirmEx({
            width: 400,
            height: 140,
            title: this.i18n("plugin.notes2.component.filesList.actions.emptyTrash.title"),
            message: this.i18n("plugin.notes2.component.filesList.actions.emptyTrash.message"),
            info: this.i18n("plugin.notes2.component.filesList.actions.emptyTrash.info"),
            yes: {
                label: this.i18n("plugin.notes2.component.filesList.actions.button.delete-permanent"),
                faIcon: "trash",
                btnClass: "btn-warning",
            },
            no: {
                faIcon: "",
                btnClass: "btn-default",
                label: this.i18n("plugin.notes2.component.filesList.button.cancel.label")
            }
        }).then(res => {
            if (res.result == "yes") {
                this.emptyTrash();
            }
        });
    }
    
    emptyTrash(): void {
        if (this.fileListId != FilesListController.TRASH_FILES) {
            return;
        }
        let prom = Q();
        let sthDeleted: boolean = false;
        for (let entry of this.filteredCollection.list) {
            let _entry = this.getTreeEntry(entry.id);
            if (!Notes2Utils.isLocalEntry(_entry)) {
                let treeEntry = <mail.filetree.nt.Entry>_entry;
                if (this.isDeletable(treeEntry.tree)) {
                    prom = prom.then(() => this.deleteEntry(treeEntry)).then(result => {
                        if (result.sthDeleted) {
                            sthDeleted = result.sthDeleted;
                        }
                    });
                }
            }
        }
        prom.then(() => {
            if (sthDeleted) {
                this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.emptied-trash"));
            }
        });
    }
    
    trashFile() {
        let activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        let selectedIndexes = this.activeCollection.selectedIndexes.slice();

        let confirmOptions: MsgBoxOptions = {
            width: 400,
            height: 140,
            title: this.i18n("plugin.notes2.component.filesList.actions.delete"),
            message: this.i18n("plugin.notes2.component.filesList.actions.delete-trash.info"),
            //info: entry.tree.shared ? this.i18n("plugin.notes2.component.filesList.actions.delete-shared.info") : "",
            yes: {
                label: this.i18n("plugin.notes2.component.filesList.actions.button.delete-trash"),
                faIcon: "trash",
                btnClass: "btn-warning",
            },
            no: {
                faIcon: "",
                btnClass: "btn-default",
                label: this.i18n("plugin.notes2.component.filesList.button.cancel.label")
            }
        };

        let confirmDeferred: Q.Deferred<window.msgbox.MsgBoxResult> = null;
        let confirm = () => {
            if (confirmDeferred == null) {
                confirmDeferred = Q.defer();
                this.parent.confirmEx(confirmOptions).then(res => {
                    if (res.result == "yes") {
                        confirmDeferred.resolve();
                    }
                });
            }
            return confirmDeferred.promise;
        };
        
        let prom = Q();
        let cannotMoveToTrash: boolean = false;
        let sthMovedToTrash: boolean = false;
        for (let activeEntry of activeEntries) {
            if (activeEntry.id == "parent") {
                continue;
            }
            let _entry = this.getTreeEntry(activeEntry.id);
            if (Notes2Utils.isLocalEntry(_entry)) {
                let entry: LocalEntry = _entry;
                prom = prom.then(() => {
                    return Q().then(() => {
                        if (entry == null || !LocalFS.isDeletable(entry.path)) {
                            return Q.reject<void>();
                        }
                        else {
                            // return confirm().thenResolve(null);
                            return;
                        }
                    })
                    .then(() => {
                        if (entry.isDirectory()) {
                            return LocalFS.deleteDir(entry.path, true);
                        }
                        return LocalFS.deleteFile(entry.path, true);
                    }).then(() => {
                        sthMovedToTrash = true;
                        return this.dispatchEventResult(<RemoveFileEvent>{type: "fileremoved"});
                    }).fail(() => {
                        cannotMoveToTrash = true;
                    });
                });
                continue;
            }
            let entry: Entry = _entry;
            if (entry == null) {
                cannotMoveToTrash = true;
                continue;
            }
            prom = prom.then(() => {
                let fileDid: string = "";
                // return Q().then(() => {
                //     return confirm();
                // })
                // .then(() => {
                return Q().then(() => {
                    return entry.isFile() ? this.getDidOfFile(entry.tree.section, entry.path).then(did => {
                        fileDid = did;
                    }) : null
                })
                .then(() => {
                    sthMovedToTrash = true;
                    return this.dispatchEventResult(<RemoveFileEvent>{type: "fileremoved"});
                })
                .then(() => {
                    let srcName = mail.filetree.Path.parsePath(entry.path).name.original;
                    let dstPath = mail.filetree.nt.Helper.resolvePath(FilesConst.TRASH_PATH + "/", srcName);
                    return entry.tree.fileSystem.move(entry.path, dstPath, true).thenResolve(dstPath);
                })
                .then(dstPath => {
                    return entry.tree.fileSystem.updateMeta(dstPath, meta => {
                        (<any>meta).trashedInfo = {
                            who: this.identity.user,
                            when: new Date().getTime(),
                        };
                    })
                    .thenResolve(dstPath);
                })
                .then(dstPath => {
                    let section = entry.tree.section;
                    if (section == null || section.isPrivate() || !section.hasChatModule()) {
                        return;
                    }
                    let chatModule = section.getChatModule();
                    Q().then(() => {
                        if (entry.isDirectory()) {
                            return chatModule.sendTrashDirectoryMessage(entry.path, null);//@todo 2nd arg trashPath, requires privfs-client-js changes: entry.tree.fileSystem.move(entry.path, dstPath, true)
                        }
                        else {
                            return chatModule.sendTrashFileMessage(entry.path, null, entry.meta.mimeType, fileDid);//@todo 2nd arg trashPath, requires privfs-client-js changes: entry.tree.fileSystem.move(entry.path, dstPath, true)
                        }
                    }).fail(e => {
                        this.logError(e);
                    });
                })
                .fail(e => {
                    this.logError(e);
                    cannotMoveToTrash = true;
                });
            });
        }
        
        return prom.then(() => {
            if (sthMovedToTrash) {
                if (selectedIndexes.length > 0) {
                    this.reselectIndex = selectedIndexes[0];
                }
            }
            else if (cannotMoveToTrash) {
                this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.cannot-move-to-trash"));
            }
        });
    }
    
    renameFile() {
        let active = this.getSelectedEntry();
        if (!active || active.id == "parent") {
            return;
        }
        let _entry = this.getTreeEntry(active.id);
        if (Notes2Utils.isLocalEntry(_entry)) {
            let entry: LocalEntry = _entry;
            return this.parent.promptEx({
                width: 400,
                height: 140,
                title: this.i18n("plugin.notes2.component.filesList.actions.rename"),
                input: {
                    placeholder: this.i18n("plugin.notes2.component.filesList.actions.rename.placeholder"),
                    multiline: false,
                    value: entry.name
                },
                selectionMode: entry.isDirectory() ? "all" : "filename",
            })
            .then(result => {
                if (result.result != "ok" || !result.value) {
                    return;
                }
                if (!LocalFS.isNameValid(result.value)) {
                    this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.invalid-name"));
                    return;
                }
                return LocalFS.rename(entry.path, result.value)
                .then(() => {
                    let fileName = result.value;
                    let oldPath = entry.path;
                    let newPath = oldPath.substr(0, oldPath.lastIndexOf("/") + 1) + fileName;
                    this.app.fileRenameObserver.dispatchLocalFileRenamedEvent(newPath, oldPath);
                })
                .fail(e => {
                    this.errorCallback(e);
                });
            });
        }
        let entry: Entry = _entry;
        if (entry == null) {
            this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.cannot-rename"));
            return;
        }
        let oldPath = entry.path;
        return this.parent.promptEx({
            width: 400,
            height: 140,
            title: this.i18n("plugin.notes2.component.filesList.actions.rename"),
            input: {
                placeholder: this.i18n("plugin.notes2.component.filesList.actions.rename.placeholder"),
                multiline: false,
                value: entry.name
            },
            selectionMode: entry.isDirectory() ? "all" : "filename",
        })
        .then(result => {
            let fileDid: string;
            if (result.result != "ok" || !result.value) {
                return;
            }
            if (result.value.indexOf("/") != -1) {
                this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.invalid-name"));
                return;
            }
            let newPath = mail.filetree.nt.Helper.resolvePath(entry.parent.path, result.value);
            return Q().then(() => {
                return entry.isFile() ? this.getDidOfFile(entry.tree.section, entry.path).then(did => {
                    fileDid = did;
                }) : null
            })
            .then(() => {
                return entry.tree.fileSystem.rename(entry.path, result.value);
            })
            .then(() => {
                if (this.activeCollection.selectedIndexes.length == 1 && this.activeCollection.get(this.activeCollection.selectedIndexes[0]).id == entry.id) {
                    this.reselectIndex = this.activeCollection.selectedIndexes[0];
                }
                this.callViewMethod("setActiveById", entry.id);
                let section = entry.tree.section;
                if (section == null || section.isPrivate() || !section.hasChatModule()) {
                    this.app.fileRenameObserver.dispatchFileRenamedEvent(fileDid ? fileDid : entry.ref.did, newPath, oldPath, this.session.hostHash);
                    return;
                }
                let chatModule = section.getChatModule();
                Q().then(() => {
                    if (entry.isDirectory()) {
                        return chatModule.sendRenameDirectoryMessage(oldPath, newPath);
                    }
                    else if (entry.isFile()) {
                        this.app.fileRenameObserver.dispatchFileRenamedEvent(fileDid, newPath, oldPath, this.session.hostHash);
                        return chatModule.sendRenameFileMessage(oldPath, newPath, entry.meta.mimeType, fileDid);
                    }
                }).fail(e => {
                    this.logError(e);
                });
            })
            .fail(e => {
                this.errorCallback(e);
            });
        });
    }
    
    onClipboardChange(): void {
        this.callViewMethod("onClipboardChange", this.hasSthToPaste());
    }
    
    onActiveCollectionChange(event: Types.utils.collection.CollectionEvent<FileEntry>): void {
        if (this.currentDir == null && this.currentPath) {
            this.currentDir = <mail.filetree.nt.Directory>this.collection.find(x => Notes2Utils.isFsFileEntry(x) && x.isDirectory() && x.path == this.currentPath);
        }
        if (this.preventReselect) {
            return;
        }
        if (event.type == "selection") {
            if (this.isActive && !this.isSelectionChanging) {
                Q().then(() => {
                    this.loadFilePreview();
                });
            }
            if (event.causeType == "remove") {
                if (event.indicies.length == 0 && this.reselectIndex !== null) {
                    this.reselectIndex = Math.min(this.reselectIndex, this.activeCollection.size() - 1);
                    let entry = this.activeCollection.get(this.reselectIndex);
                    if (entry) {
                        this.activeCollection.setSelected(entry);
                        this.activeCollection.setActive(entry);
                        this.sendSelectionToView();
                    }
                    this.reselectIndex = null;
                }
            }
            else if (event.causeType == "selected") {
                let el0 = this.activeCollection.get(event.index);
                if (!el0) {
                    return;
                }
                let idx = this.collection.indexOfBy(x => x.id == el0.id);
                let el = this.collection.get(idx);
                if (!el) {
                    return;
                }
                if (el && this.notes2Plugin.wasUnread(this.session, el) && this.app.userPreferences.getAutoMarkAsRead()) {
                    if (this.delayMarkAsRead) {
                        setTimeout(() => {
                            this.notes2Plugin.markFileAsWatched(this.session, el);
                        }, FilesListController.MARK_ALREADY_SELECTED_AS_READ_DELAY);
                    }
                    else {
                        this.notes2Plugin.markFileAsWatched(this.session, el);
                    }
                }
                if (el) {
                    this.delayMarkAsRead = false;
                }
            }
        }
    }
    
    
    
    loadFilePreview() {
        let selected = this.getSelectedEntries();
        if (selected.length > 1) {
            this.dispatchEvent<PreviewRequestEvent>({
                type: "previewrequest",
                elementType: "multi",
                selectedCount: selected.length,
                hostHash: this.session.hostHash
            });
            return;
        }
        let active = this.getSelectedEntry();
        let entry = active && active.id != "parent" ? this.getTreeEntry(active.id) : null;
        if (entry && entry.isDirectory()) {
            this.dispatchEvent<PreviewRequestEvent>({
                type: "previewrequest",
                elementType: "directory",
                directory: entry,
                hostHash: this.session.hostHash
            });
            return;
        }
        this.withOpenableElement(active ? active.id : null, element => {
            if (element) {
                this.dispatchEvent<PreviewRequestEvent>({
                    type: "previewrequest",
                    elementType: "file",
                    openableElement: element,
                    hostHash: this.session.hostHash
                });
            }
            else if (entry && entry.isDirectory()) {
                this.dispatchEvent<PreviewRequestEvent>({
                    type: "previewrequest",
                    elementType: "directory",
                    directory: entry,
                    hostHash: this.session.hostHash
                });
            }
            else {
                this.dispatchEvent<PreviewRequestEvent>({
                    type: "previewrequest",
                    elementType: "clear",
                    hostHash: this.session.hostHash
                });
            }
        }, false);
    }
    
    onFilterFiles() {
        this.filesFilterUpdater.updateFilter(this.app.searchModel.get());
    }
    
    activate(): void {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.filesFilterUpdater.updateFilter(this.app.searchModel.get(), true);
    }
    
    deactivate(): void {
        if (!this.isActive) {
            return;
        }
        this.isActive = false;
    }
    
    canWrite(): boolean {
        let person = this.personService.getMe();
        return !(this.filesInfo && this.filesInfo.type == FilesListType.CONVERSATION && this.filesInfo.conversation.section == null && person.username.indexOf("@") >= 0);
    }
    
    onViewUpdateCanWrite(): void {
        this.callViewMethod("updateCanWrite", this.canWrite());
        this.updateLockUnlockButtons();
    }

    showFilePreview(): boolean {
        return this.notes2Plugin.getSetting(this.session, ViewSettings.SHOW_FILE_PREVIEW, this.fileListId, this.context) == 1;
    }

    showUrlFiles(): boolean {
        return this.notes2Plugin.getSetting(this.session, ViewSettings.SHOW_URL_FILES, this.fileListId, this.context) == 1;
    }
    
    onViewToggleSetting(setting: string): void {
        let currState: boolean;
        if (setting == ViewSettings.SHOW_FILE_PREVIEW) {
            currState = this.showFilePreview();
        }
        else if (setting == ViewSettings.SHOW_URL_FILES) {
            currState = this.showUrlFiles();
        }
        else {
            return;
        }
        let newState = !currState;
        this.notes2Plugin.saveSetting(this.session, setting, newState ? 1 : 0, this.fileListId, this.context);
        this.callViewMethod("updateSetting", setting, newState);
        this.filteredCollection.refresh();
        this.app.dispatchEvent<UpdateNotes2SettingEvent>({
            type: "update-notes2-setting",
            setting: setting,
            value: newState ? 1 : 0,
            sourceProjectId: this.fileListId,
            sourceContext: this.context,
            sourceUniqueId: this.uniqueId,
        })
    }
    
    createUniqueId(): string {
        let n = 1000;
        while (n-- > 0) {
            let id = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
            if (FilesListController.usedIds.indexOf(id) < 0) {
                FilesListController.usedIds.push(id);
                return id;
            }
        }
    }
    
    getSelectedIds(): string[] {
        let ids: string[] = [];
        for (let idx of this.activeCollection.selectedIndexes) {
            let el = this.activeCollection.get(idx);
            if (el) {
                ids.push(el.id);
            }
        }
        return ids;
    }
    
    verifySelectedIndices(): void {
        let ok = true;
        for (let idx of this.activeCollection.selectedIndexes) {
            if (!this.activeCollection.get(idx)) {
                console.error("FAIL", {
                    selectedIndexes: JSON.parse(JSON.stringify(this.activeCollection.selectedIndexes)),
                    wrongIndex: idx,
                    collectionSize: this.activeCollection.size(),
                });
                ok = false;
            }
        }
        if (ok) {
            console.log("verified - ok");
        }
    }
    
    sendSelectionToView(): void {
        // this.verifySelectedIndices();
        this.callViewMethod("setSelectedIds", JSON.stringify(this.getSelectedIds()));
    }
    
    getSelectedEntry(): FileEntry {
        if (this.activeCollection.selectedIndexes.length == 1) {
            return this.activeCollection.get(this.activeCollection.selectedIndexes[0]);
        }
        return null;
    }
    
    getSelectedEntries(): FileEntry[] {
        let entries: FileEntry[] = [];
        for (let idx of this.activeCollection.selectedIndexes) {
            let el = this.activeCollection.get(idx);
            if (el) {
                entries.push(el);
            }
        }
        return entries;
    }
    
    clearSelection(setIsChanging: boolean = true): void {
        if (setIsChanging) {
            this.isSelectionChanging = true;
        }
        let indexes = this.activeCollection.selectedIndexes.slice();
        for (let idx of indexes) {
            let el = this.activeCollection.get(idx);
            if (el) {
                this.activeCollection.deselect(el);
            }
        }
        if (setIsChanging) {
            this.isSelectionChanging = false;
        }
    }
    
    setSelectionMode(selectionMode: SelectionMode): void {
        this.selectionMode = selectionMode;
        if (selectionMode == SelectionMode.SINGLE && this.getSelectedEntries().length > 1) {
            let active = this.activeCollection.getActive();
            this.clearSelection();
            if (active) {
                this.onViewSelectEntries(JSON.stringify([active.id]), active.id);
            }
        }
    }
    
    isConversationWithDeletedUserOnly(): boolean {
        if (this.filesInfo.type == FilesListType.CONVERSATION) {
            if (this.filesInfo.conversation.isSingleContact()) {
                let userName = this.filesInfo.conversation.getFirstPerson().contact.getUsername();
                if (this.filesInfo.conversation.conv2Service.contactService.isUserDeleted(userName)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    onViewAddPerson(): void {
        if (this.isConversationWithDeletedUserOnly()) {
            return;
        }
        let hashmails: string[] = this.filesInfo.conversation.persons.map(p => p.hashmail);
        this.app.dispatchEvent<RequestOpenFilesEvent>({
            type: "requestopenfiles",
            showContactsWindow: true,
            hashmails: hashmails,
        });
    }
    
    onViewRemovePerson(hashmail: string): void {
        let hashmails: string[] = this.filesInfo.conversation.persons.map(p => p.hashmail).filter(h => h != hashmail);
        this.app.dispatchEvent<RequestOpenFilesEvent>({
            type: "requestopenfiles",
            hashmails: hashmails,
        });
    }
    
    static meetsFilter(entry: FileEntry, word: string): boolean {
        if (!entry) {
            return false;
        }
        return Notes2Utils.isParentEntry(<any>entry) || app.common.SearchFilter.matches(word, entry.name);
    }

    setSession(session: mail.session.Session): Q.Promise<void> {
        return Q().then(() => {
            this.session = session;
            //override services
            return Q.all([
                this.session.mailClientApi.privmxRegistry.getIdentity(),
                this.session.mailClientApi.privmxRegistry.getSinkIndexManager(),
                this.session.mailClientApi.privmxRegistry.getConv2Service(),
                this.session.mailClientApi.privmxRegistry.getPersonService(),
                this.session.mailClientApi.privmxRegistry.getSectionManager().then(sm => {
                    return sm.load().thenResolve(sm);
                })
            ])
            .then(res => {
                this.identity = res[0];
                this.sinkIndexManager = res[1];
                this.conv2Service = res[2];
                this.personService = res[3];
                this.sectionManager = res[4];

                this.taskTooltip.getContent = (taskId: string): string => {
                    return this.tasksPlugin ? this.tasksPlugin.getTaskTooltipContent(this.session, taskId + "") : null;
                };
                this.taskChooser = this.addComponent("taskchooser-" + session.hostHash, this.componentFactory.createComponent("taskchooser", [this, this.app, {
                    createTaskButton: false,
                    includeTrashed: false,
                    popup: true,
                    session: this.session,
                }]));
                this.afterViewLoadedDeferred.promise.then(() => {
                    this.callViewMethod("initViewAfterSessionSet", session.hostHash);
                });
            })
            .then(() => {
                return this.refreshLocksInfo(session);
            })
            .then(() => {
                this.updateLockUnlockButtons();
            })
        })
    }

    getSession(): mail.session.Session {
        return this.session;
    }

    lockFile(): void {
        let active = this.getSelectedEntry();
        Q().then(() => {
            return this.getOpenableElement(active.id);
        })
        .then(element => {
            this.app.filesLockingService.manualLockFile(this.session, element);
        })
        .then(() => {
            this.updateLockUnlockButtons();
        })
    }

    unlockFile(): void {
        let active = this.getSelectedEntry();
        Q().then(() => {
            return this.getOpenableElement(active.id);
        })
        .then(element => {
            this.app.filesLockingService.manualUnlockFile(this.session, element);
        })
        .then(() => {
            this.updateLockUnlockButtons();
        })
    }


    canUnlockFile(openableElement: app.common.shelltypes.OpenableElement): Q.Promise<boolean> {
        if (openableElement) {
            return this.app.filesLockingService.canUnlockFile(this.session, openableElement);
        }
    }

    
    refreshLocksInfo(session: mail.session.Session): Q.Promise<void> {
        return Q().then(() => {
            return session.sectionManager.client.descriptorManager.getLockedDescriptor()
            .then(result => {
                this.filesLocksMap = {};
                if (result && Array.isArray(result)) {
                    result.forEach(x => {
                        this.filesLocksMap[x.did] = x.lock.user as DescriptorLockUser;
                    })
                }
            })
        })
    }

    isFileLocked(did: string): boolean {
        return this.filesLocksMap && (did in this.filesLocksMap);
    }

    onFileLockChanged(event: Types.event.FileLockChangedEvent): void {
        if (! this.collection) {
            return;
        }
        let entry = this.collection.find(x => Notes2Utils.isFsFileEntry(x) && x.ref.did == event.did);
        if (entry) {
            if (event.lockReleased) {
                delete this.filesLocksMap[event.did];
                this.collection.triggerUpdateElement(entry);                
            }
            else
            if (event.locked) {
                this.filesLocksMap[event.did] = event.user as DescriptorLockUser;                    
                this.collection.triggerUpdateElement(entry);                
            }

        }
    }
    

    updateLockUnlockButtons(): Q.Promise<void> {
        // update actions buttons
        let active = this.getSelectedEntry();
        if (! active) {
            return;
        }
        return Q().then(() => {
            return this.getOpenableElement(active.id);
        })
        .then(element => {
            return this.canUnlockFile(element)
        })
        .then(canUnlock => {
            this.updateLockInfoOnActionButtons(active.locked, canUnlock);
        })        
    }

    updateLockInfoOnActionButtons(locked: boolean, canUnlock: boolean) {
        this.callViewMethod("updateLockInfoOnActionButtons", locked, canUnlock);
    }
}
