import {app, component, mail, utils, window, Types, Q, privfs} from "pmc-mail";
import {Notes2Plugin, Notes2ComponentFactory, RemoveFileEvent, PreviewRequestEvent, UpdateFilesSectionBadgeEvent, UpdateNotes2SettingEvent, UpdateNotes2SidebarSpinnersEvent, RequestOpenFilesEvent} from "../../main/Notes2Plugin";
import {FileEntryBase, Notes2Utils} from "../../main/Notes2Utils";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import {FilesListController, FilesListType, FilesInfo, FilesFilterUpdater} from "../../component/fileslist/FilesListController";
import {FilesConst, ViewContext} from "../../main/Common";
import {LocalFS} from "../../main/LocalFS";
import {Entry, TrashedInfo} from "pmc-mail/out/mail/filetree/NewTree";
import { i18n } from "./i18n";
import { ViewSettings } from "../../main/ViewSettings";
import { FileConflictResolverWindowController } from "../fileconflictresolver/FileConflictResolverWindowController";
import { FileStyleResolver } from "pmc-mail/out/app/common/FileStyleResolver";
import { session } from "pmc-mail/out/mail";

export interface Model {
    activeId: string;
    hashmail: string;
    iframeId: number;
    iframeLoad: Types.app.WindowLoadOptions;
    directory: DirectoryPreviewModel;
    showLocalFS: boolean;
    showFilePreview: boolean;
}

export interface SessionInfo {
    sessionType: "local" | "remote";
    hostHash?: string;
}

export interface TrashedInfoModel {
    who: string;
    when: number;
    sectionId: string;
    sectionName: string;
    fullSectionName: string;
}

export type ReusableOpener = window.base.BaseWindowController&
    app.common.shelltypes.ShellReusableOpener&
    {hasOpenedEntry(ele: app.common.shelltypes.OpenableElement): boolean};

export interface ReusableOpenerEntry {
    appId: string;
    iframeId: number;
    win: ReusableOpener;
    load: Types.app.WindowLoadOptions;
}

export interface NotificationEntryOptions {
    autoHide?: boolean;
    progress?: boolean;
}

export interface DirectoryPreviewModel {
    path: string;
    name: string;
    lastModifiedDate: number;
    size: number;
    fileCount: number;
};

interface SearchResults {
    [key: string]: number;
}

export class FsManagerEntry {
    
    fs: privfs.fs.file.FileSystem;
    tree: mail.filetree.nt.Tree;
    
    constructor(
        public section: mail.section.SectionService
    ) {
    }
    
    setTree(tree: mail.filetree.nt.Tree) {
        this.tree = tree;
        this.fs = this.tree.fileSystem;
    }
    
    checkTrash() {
        return Q().then(() => {
            if (!this.fs.root.entries.hasName(FilesConst.TRASH_ENTRY)) {
                return this.fs.mkdir(FilesConst.TRASH_PATH).thenResolve(null);
            }
        });
    }
    
    refresh() {
        return Q().then(() => {
            return this.tree.refreshDeep(true);
        });
    }
}

export class FsManager {
    
    specialDirectory: privfs.fs.file.entry.SpecialDirectory;
    sections: {[sectionId: string]: FsManagerEntry};
    
    constructor(public manager: privfs.fs.descriptor.Manager) {
        this.specialDirectory = new privfs.fs.file.entry.SpecialDirectory(manager);
        this.sections = {};
    }
    
    addSection(section: mail.section.SectionService, session: mail.session.Session): void {
        if (section == null || !section.hasFileModule()) {
            return;
        }
        let collectionId = Notes2WindowController.getChannelId(session, section);
        if (this.sections[collectionId] == null) {
            this.sections[collectionId] = new FsManagerEntry(section);
        }
    }
    
    addSectionAndInit(section: mail.section.SectionService, session: mail.session.Session): Q.Promise<FsManagerEntry> {
        if (section == null || !section.hasFileModule()) {
            return Q(null);
        }
        let collectionId = Notes2WindowController.getChannelId(session, section);
        let sec = this.sections[collectionId];
        if (sec != null) {
            return Q(null);
        }
        sec = this.sections[collectionId] = new FsManagerEntry(section);
        return Q().then(() => {
            return sec.section.getFileModule().getFileTree();
        })
        .then(ft => {
            this.specialDirectory.directories.push(sec.section.getFileModule().fileSystem.root);
            sec.setTree(ft);
            return ft.refreshDeep(true);
        })
        .then(() => {
            return sec.checkTrash();
        })
        .thenResolve(sec);
    }
    
    addConversation(c2s: mail.section.Conv2Section, session: mail.session.Session): void {
        if (c2s == null || !c2s.section || !c2s.section.hasFileModule()) {
            return;
        }
        let collectionId = Notes2WindowController.getConversationId(session, c2s);
        if (this.sections[collectionId] == null) {
            this.sections[collectionId] = new FsManagerEntry(c2s.section);
        }
    }
    
    addConversationAndInit(c2s: mail.section.Conv2Section, session: mail.session.Session): Q.Promise<FsManagerEntry> {
        if (c2s == null || !c2s.section || !c2s.section.hasFileModule()) {
            return Q(null);
        }
        let collectionId = Notes2WindowController.getConversationId(session, c2s);

        let sec = this.sections[collectionId];
        if (sec != null) {
            return Q(null);
        }
        sec = this.sections[collectionId] = new FsManagerEntry(c2s.section);
        return Q().then(() => {
            return sec.section.getFileModule().getFileTree();
        })
        .then(ft => {
            this.specialDirectory.directories.push(sec.section.getFileModule().fileSystem.root);
            sec.setTree(ft);
            return ft.refreshDeep(true);
        })
        .then(() => {
            return sec.checkTrash();
        })
        .thenResolve(sec);
    }
    
    init(): Q.Promise<void> {
        let sections = utils.Lang.getValues(this.sections);
        return Q().then(() => {
            return new privfs.fs.descriptor.DescriptorMultiGet(this.manager).perform(
                sections.map(sec => sec.section.getFileModule().getFileSystemZ())
            );
        })
        .then(() => {
            sections.forEach(sec => {
                this.specialDirectory.directories.push(sec.section.getFileModule().fileSystem.root);
            });
            return this.specialDirectory.refreshDeep(true);
        })
        .then(() => {
            return Q.all(sections.map(sec => sec.section.getFileModule().getFileTree().then(ft => {
                sec.setTree(ft);
            })));
        })
        .then(() => {
            return Q.all(utils.Lang.getValues(this.sections).map(x => x.checkTrash()));
        })
        .thenResolve(null);
    }
    
    refresh() {
        return Q().then(() => {
            utils.Lang.getValues(this.sections).forEach(x => {
                x.tree.processLastVersionEvents = false;
            });
            return this.specialDirectory.refreshDeep(true);
        })
        .fin(() => {
            utils.Lang.getValues(this.sections).forEach(x => {
                x.tree.sync();
                x.tree.processLastVersionEvents = true;
            });
        })
    }
}

@Dependencies(["notes2filelist", "persons", "splitter", "extlist", "notification", "conv2list", "sectionlist", "sectionstabs"])
export class Notes2WindowController extends window.base.BaseAppWindowController {
    
    static textsPrefix: string = "plugin.notes2.window.notes2.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    @Inject conv2Service: mail.section.Conv2Service;
    @Inject collectionFactory: mail.CollectionFactory;
    @Inject messagesCollection: utils.collection.BaseCollection<mail.SinkIndexEntry>;
    @Inject client: privfs.core.Client;
    @Inject sectionManager: mail.section.SectionManager;
    @Inject personService: mail.person.PersonService;
    
    componentFactory: Notes2ComponentFactory;
    personsComponent: component.persons.PersonsController;
    verticalSplitter: component.splitter.SplitterController;
    filesVerticalSplitter: component.splitter.SplitterController;
    notifications: component.notification.NotificationController;
    notes2Plugin: Notes2Plugin;
    filesLists: {[id: string]: FilesListController};
    remoteServers: {[hostHash: string]: component.remotehostlist.HostEntry};
    activeFilesList: FilesListController;
    filesBaseCollection: utils.collection.MergedCollection<FileEntryBase>;
    localFilesBaseCollection: utils.collection.MutableCollection<FileEntryBase>;
    localFS: LocalFS;
    dockedEditor: window.base.BaseWindowController;
    reusableOpener: ReusableOpenerEntry;
    editorsId: number = 0;
    reusableEditors: {[id: string]: ReusableOpenerEntry} = {};
    myFileTreeManager: mail.filetree.nt.Tree;
    channelsTrees: {[id: string]: mail.filetree.nt.Tree};
    trees: {[rootRefId: string]: mail.filetree.nt.Tree};
    elementToPreview: app.common.shelltypes.OpenableElement;
    previewElement: app.common.shelltypes.OpenableElement|mail.filetree.nt.Directory;
    directoryToPreview: mail.filetree.nt.Directory;
    directoryModel: DirectoryPreviewModel;
    previewLoadTid: NodeJS.Timer;
    notificationId: number;
    fsManager: FsManager;
    sidebarOptions: component.sidebar.SidebarOptions;
    sidebar: component.sidebar.SidebarController;
    collections: { [key: string]: utils.collection.FilteredCollection<FileEntryBase> } = {};
    searchCounts: { [hostHash: string]: SearchResults } = {};
    searchCountFilterUpdater: FilesFilterUpdater;
    isSearchOn: boolean = false;
    sectionTooltip: component.sectiontooltip.SectionTooltipController;
    disabledSection: component.disabledsection.DisabledSectionController;
    loading: component.loading.LoadingController;
    lastPreviewRequestEvent: PreviewRequestEvent;
    currPreviewTrashedInfoModelStr: string = null;
    pendingGetOrCreateFilesList: { [key: string]: Q.Promise<FilesListController> } = {};
    sessionsByCollectionName: { [collectionName: string]: mail.session.Session} = {};
    isHostLoaded: { [hostHash: string]: boolean } = {};
    
    constructor(parentWindow: window.container.ContainerWindowController) {
        super(parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "splitter-vertical": {defaultValue: 340},
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({handlePos:250,totalSize:1000}) },
                "left-panel-people-splitter": {defaultValue: 500},
                "files-vertical-splitter": {defaultValue: 500},
                "local-fs-initial-path": {defaultValue: ""}
            }
        });
        this.ipcMode = true;
        this.notificationId = 0;
        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.setPluginViewAssets("notes2");
        this.openWindowOptions.fullscreen = true;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = this.i18n("plugin.notes2.window.notes2.title");
        this.filesLists = {};
        this.channelsTrees = {};
        this.trees = {};
        this.ipcMode = true;
        this.sectionTooltip = this.addComponent("sectiontooltip", this.componentFactory.createComponent("sectiontooltip", [this]));
        this.enableTaskBadgeAutoUpdater();
    }
    
    init(): Q.IWhenable<void> {
        let localSession = this.app.sessionManager.getLocalSession();
        // console.log("on notes2windowController init..")
        return this.app.mailClientApi.checkLoginCore().then(() => {
            let tasksPlugin = this.app.getComponent("tasks-plugin");
            if (tasksPlugin) {
                // console.log("notes2windowController check for projects ready...")
                return tasksPlugin.projectsReady;
            }
        }).then(() => {
            // console.log("notes2windowController check for notes2 loadedDeferred...")
            return this.notes2Plugin.loadedDeferred.promise;
        }).then(() => {
            // console.log("notes2windowController tasks promise resolved");
            this.fsManager = new FsManager(this.client.descriptorManager);
            this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
            this.filesBaseCollection = this.addComponent("filesBaseCollection", new utils.collection.MergedCollection<FileEntryBase>());
            this.filesBaseCollection.addCollection(this.collectionFactory.getAttachmentsCollectionByBaseCollection("all-messages", this.messagesCollection));
            this.localFilesBaseCollection = this.addComponent("localFilesBaseCollection", new utils.collection.MutableCollection<FileEntryBase>());
            
            if (this.app.isElectronApp()) {
                let localFsInitialPath = this.settings.create("local-fs-initial-path");
                LocalFS.staticConstructor(this.app);
                this.localFS = new LocalFS(this.localFilesBaseCollection, localFsInitialPath.get(), newPath => {
                    localFsInitialPath.set(newPath);
                });
            }
            
            this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
            this.verticalSplitter = this.addComponent("verticalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("splitter-vertical")]));
            this.verticalSplitter.ipcMode = true;
            this.filesVerticalSplitter = this.addComponent("filesVerticalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("files-vertical-splitter")]));
            this.disabledSection = this.addComponent("disabled-section", this.componentFactory.createComponent("disabledsection", [this, Types.section.NotificationModule.NOTES2]));
            this.loading = this.addComponent("loading", this.componentFactory.createComponent("loading", [this]));
            
            this.filesVerticalSplitter.ipcMode = true;
            this.notes2Plugin.filesSections[localSession.hostHash].forEach(x => {
                this.fsManager.addSection(x, localSession);
            });
            this.registerChangeEvent(this.notes2Plugin.filesSections[localSession.hostHash].changeEvent, event => this.onFilesSectionChange(localSession, event));
            return this.fsManager.init().then(() => {
                return Q.all(utils.Lang.getValues(this.fsManager.sections).map(x => {
                    this.finishFileTreePreparation(x, localSession.hostHash);
                }));
            });
        })
        .then(() => {
            return Q.all([
                this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                this.sectionManager.isSectionsLimitReached()
            ])
        })
        .then(res => {
            let [identityProvider, isSectionsLimitReached] = res;

            this.notes2Plugin.sectionManager.dumpFileSystems().fail(this.errorCallback);
            let intervalId = setInterval(() => {
                if (this.notes2Plugin.sectionManager) {
                    this.notes2Plugin.sectionManager.dumpFileSystems().fail(this.errorCallback);
                }
            }, 5 * 60 * 1000);
            this.notes2Plugin.onReset.promise.then(() => {
                clearInterval(intervalId);
            });
            
            
            let priv = this.notes2Plugin.sectionManager.getMyPrivateSection();
            let filteredRootsCollection = this.addComponent("filteredRootsCollection", new utils.collection.FilteredCollection(this.notes2Plugin.files2Sections[localSession.hostHash], x => x != priv && x.isVisible() && x.hasAccess()));
            
            let customElements: component.customelementlist.CustomElement[] = [];
            
            if (priv != null) {
                customElements.push(
                    {
                        id: FilesListController.MY_FILES,
                        icon: {
                            type: "hashmail",
                            value: this.identity.hashmail
                        },
                        label: this.i18n("plugin.notes2.window.notes2.filter.my"),
                        private: true
                    }
                );
            }
            customElements.push(
                {
                    id: FilesListController.ALL_FILES,
                    icon: {
                        type: "fa",
                        value: "fa-file-o"
                    },
                    label: this.i18n("plugin.notes2.window.notes2.filter.all"),
                    private: false
                },
                {
                    id: FilesListController.TRASH_FILES,
                    icon: {
                        type: "fa",
                        value: "ico-bin"
                    },
                    label: this.i18n("plugin.notes2.window.notes2.filter.trash"),
                    private: false
                }
            );
            let customElementCollection = this.addComponent("cEleColl", new utils.collection.MutableCollection<component.customelementlist.CustomElement>(customElements));
            
            
            if (this.app.isElectronApp()) {
                // let userName = (<any>this.app).getSystemUserName();
                // let computerName: string;
                // if (userName.length == 0) {
                //     computerName = this.i18n("plugin.notes2.window.notes2.filter.local");
                // }
                // else {
                //     computerName = this.i18n("plugin.notes2.window.notes2.filter.local") + " (" + userName + ")";
                // }
                let computerName = this.i18n("plugin.notes2.window.notes2.filter.local", (<any>this.app).getSystemLabel());
                customElementCollection.addAt(2, {
                    id: FilesListController.LOCAL_FILES,
                    icon: {
                        type: "fa",
                        value: "fa-desktop"
                    },
                    label: computerName,
                    private: false
                });
            }
            let sidebarOptions: component.sidebar.SidebarOptions = {
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: customElementCollection,
                    unreadProvider: ce => this.getCustomElementUnread(ce),
                    elementsCountProvider: ce => this.getCustomElementElementsCount(ce),
                    searchCountProvider: ce => this.getCustomElementSearchCount(ce),
                    withSpinnerProvider: ce => this.getCustomElementWithSpinner(ce),
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    searchCountProvider: c2s => this.getConv2ListSearchCount(localSession, c2s),
                    searchAllSearchedProvider: null,
                    unreadProvider: c2s => this.getConversationUnread(localSession, c2s),
                    elementsCountProvider: c2s => this.getConv2ElementsCount(localSession, c2s),
                    withSpinnerProvider: c2s => this.getConv2WithSpinner(localSession, c2s),
                    sorter: (a, b) => {
                        return b.getFileMessageLastDate() - a.getFileMessageLastDate();
                    },
                },
                sectionList: {
                    baseCollection: filteredRootsCollection,
                    unreadProvider: section => this.getSectionUnread(localSession, section),
                    elementsCountProvider: section => this.getSectionElementsCount(localSession, section),
                    searchCountProvider: section => this.getSectionSearchCount(localSession, section),
                    withSpinnerProvider: section => this.getSectionWithSpinner(localSession, section),
                    searchAllSearchedProvider: null,
                    moduleName: Types.section.NotificationModule.NOTES2,
                    sorter: (a, b) => {
                        let res = b.getFileMessageLastDate() - a.getFileMessageLastDate();
                        return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    },
                },
                customSectionList: {
                    baseCollection: null,
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    moduleName: Types.section.NotificationModule.NOTES2,
                    sorter: null,
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: component.remotehostlist.ElementCountsAggregationStrategy.SECTIONS | component.remotehostlist.ElementCountsAggregationStrategy.CONVERSATIONS,
                },
                
                conv2ListEnabled: true,
                conv2Splitter: this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: []
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push(
                    {
                        id: "new-section",
                        label: this.i18n("plugin.notes2.window.notes2.sidebar.newsection"),
                        title: this.i18n("plugin.notes2.window.notes2.sidebar.newsection"),
                        icon: "ico-comment",
                        windowOpener: true,
                        onSectionList: true
                    }
                );
            }
            this.sidebarOptions = sidebarOptions;
            this.sidebar = this.addComponent("sidebar", this.componentFactory.createComponent("sidebar", [this, sidebarOptions]));
            this.sidebar.addEventListener("elementbeforeactivate", this.onBeforeActivateSidebarElement.bind(this));
            this.sidebar.addEventListener("sidebarbuttonaction", this.onSidebarButtonAction.bind(this));
            
            this.sidebar.usersListTooltip.getContent = (sectionId: string): string => {
                return this.app.getUsersListTooltipContent(this.app.sessionManager.getLocalSession(), sectionId);
            }

            this.app.addEventListener<Types.event.SectionsLimitReachedEvent>("sectionsLimitReached", event => {
                this.sidebar.onSectionsLimitReached(event.reached);
            });

            this.sectionManager.sectionAccessManager.eventDispatcher.addEventListener<Types.event.SectionStateChangedEvent>("section-state-changed", event => {
                if (this.activeFilesList && this.activeFilesList.filesInfo && this.activeFilesList.filesInfo.type == FilesListType.CHANNEL && this.activeFilesList.filesInfo.section.getId() == event.sectionId) {
                    Q().then(() => {
                        return this.sectionManager.load();
                    })
                    .then(() => {
                        let section = this.sectionManager.getSection(event.sectionId);
                        let moduleEnabled = section.isChatModuleEnabled();
                        if (! moduleEnabled) {
                            this.openDisabledSectionView(section);
                        }
                        else {
                            this.openChannel(event.sectionId);
                        }
                    })
                }
            }, "chat");
            
            this.app.addEventListener("reopen-section", (event: component.disabledsection.ReopenSectionEvent) => {
                this.openChannel(event.element.getId());
            });
            
            this.app.addEventListener("focusChanged", (event) => {
                let windowId = (<any>event).windowId;
                this.notes2Plugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? this.parent.activeModel.get() : windowId;
                if (windowId == "notes2" || (windowId == "main-window" && this.parent.activeModel.get() == "notes2") ) {
                    setTimeout(() => {
                        this.callViewMethod("grabFocus", true);
                    }, 200);
                }
            });
            this.app.addEventListener("focusLost", (event) => {
                this.notes2Plugin.activeWindowFocused = null;
            });


            this.app.addEventListener("onToggleMaximize-notify", () => {
                setTimeout(() => {
                    this.callViewMethod("grabFocus", false);
                }, 10);
            });
            this.app.addEventListener("binded-enter-pressed", () => {
                if (this.parent.activeModel.get() == "notes2") {
                    this.activeFilesList.openExternalFile();
                }
            });
            this.app.addEventListener<UpdateNotes2SidebarSpinnersEvent>("update-notes2-sidebar-spinners", e => {
                this.sidebar.updateSidebarSpinners({
                    conv2SectionId: e.conv2SectionId,
                    customElementId: e.customElementId,
                    sectionId: e.sectionId,
                    hosts: e.hostHash ? [this.app.sessionManager.getSessionByHostHash(e.hostHash).host] : Object.values(this.app.sessionManager.sessions).map(x => x.host),
                });
            }, "notes2");

            this.app.addEventListener("requestopenfiles", (event: RequestOpenFilesEvent) => {
                let hashmails = event.hashmails.filter(x => this.personService.getPerson(x) != null && this.personService.getPerson(x).contact != null);
                if (hashmails.length == 0) {
                    this.alert(this.i18n("plugin.notes2.window.notes2.cantCreateConversationWithoutUsers"));
                    return;
                }
                if (event.showContactsWindow) {
                    this.openNewFiles(hashmails);
                }
                else {
                    this.openConversationViewFromHashmails(hashmails);
                }
            }, "chat");
            
            this.createCollections();
            this.searchCountFilterUpdater = new FilesFilterUpdater();
            this.searchCountFilterUpdater.onUpdate = this.updateSearchCounts.bind(this);
            this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterFiles.bind(this), "multi");
            if (this.app.searchModel.data.visible && this.app.searchModel.data.value != "") {
                this.onFilterFiles();
            }
            this.app.addEventListener<UpdateFilesSectionBadgeEvent>("update-files-section-badge", event => {
                if (event.sectionId == FilesListController.TRASH_FILES || event.sectionId == FilesListController.ALL_FILES) {
                    let idx = this.sidebarOptions.customElementList.baseCollection.indexOfBy(el => el.id == event.sectionId);
                    if (idx >= 0) {
                        this.sidebarOptions.customElementList.baseCollection.triggerUpdateAt(idx);
                    }
                }
                else if (!event.hostHash || event.hostHash == localSession.hostHash) {
                    let idx = this.sidebar.sectionList.sectionsCollection.indexOfBy(el => el.getId() == event.sectionId);
                    if (idx >= 0) {
                        this.sidebar.sectionList.sectionsCollection.triggerBaseUpdateAt(idx);
                    }
                    else {
                        let idx = this.sidebar.conv2List.sortedCollection.indexOfBy(el => el.section && el.section.getId() == event.sectionId);
                        if (idx >= 0) {
                            this.sidebar.conv2List.sortedCollection.triggerBaseUpdateElement(this.sidebar.conv2List.sortedCollection.get(idx));
                        }
                    }
                }
                else {
                    let remoteSectionsList = this.sidebar.remoteSectionsLists[event.hostHash];
                    let remoteConversationList = this.sidebar.remoteConv2Lists[event.hostHash];
                    let idx = remoteSectionsList ? remoteSectionsList.sectionsCollection.indexOfBy(el => el.getId() == event.sectionId) : -1;
                    if (idx >= 0) {
                        remoteSectionsList.sectionsCollection.triggerBaseUpdateAt(idx);
                    }
                    else {
                        let idx = remoteConversationList ? remoteConversationList.sortedCollection.indexOfBy(el => el.section && el.section.getId() == event.sectionId) : -1;
                        if (idx >= 0) {
                            remoteConversationList.sortedCollection.triggerBaseUpdateElement(remoteConversationList.sortedCollection.get(idx));
                        }
                    }
                    let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
                    this.updateSidebarHostElement(session);
                }
            });
            this.app.addEventListener<UpdateNotes2SettingEvent>("update-notes2-setting", event => {
                if (event.setting == ViewSettings.SHOW_FILE_PREVIEW && this.lastPreviewRequestEvent) {
                    this.processPreviewRequestEvent(this.lastPreviewRequestEvent).fin(() => {
                        this.callViewMethod("updateSetting", event.setting, event.value == 1);
                    });
                }
                else {
                    this.callViewMethod("updateSetting", event.setting, event.value == 1);
                }
            });
            this.openDefaultSection();
            this.app.dispatchEvent({type: "focusChanged",windowId: "notes2"});
        });
    }
    
    openDefaultSection(): string {
        let firstLoginSectionId: string;
        if (this.notes2Plugin.isFirstLogin()) {
            this.notes2Plugin.sectionManager.sectionsCollection.list.forEach(section => {
                if (section.secured && section.secured.extraOptions && section.secured.extraOptions.openOnFirstLogin) {
                    firstLoginSectionId = section.getId();
                    this.notes2Plugin.setFirstLoginDone();
                    return;
                }
            })
        }
        let priv = this.notes2Plugin.sectionManager.getMyPrivateSection();
        if (firstLoginSectionId && this.notes2Plugin.sectionManager.getSection(firstLoginSectionId)) {
            this.openChannel(firstLoginSectionId)
            .then(() => {
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.SECTION,
                    section: this.notes2Plugin.sectionManager.getSection(firstLoginSectionId),
                }, true);
                this.activateFiles(firstLoginSectionId);
                this.activeFilesList.loadFilePreview();    
            });        
            return;
        }
        else if (priv) {
            this.openMy();
            return;
        }
        this.openAll();
    }
    
    openNewFiles(hashmails: string[] = []): void {
        this.app.ioc.create(window.selectcontacts.SelectContactsWindowController, [this, {
            message: this.i18n("plugin.notes2.window.notes2.selectContacts.header.newChat.text"),
            editable: true,
            hashmails: hashmails,
            fromServerUsers: true
        }])
        .then(win => {
            let singletonSuffix = !hashmails || hashmails.length == 0 || !this.activeFilesList ? "new-conv2" : this.activeFilesList.fileListId;
            this.app.openSingletonWindow("selectContacts-" + singletonSuffix , win);
            win.getPromise().then(hashmails => {
                this.openConversationViewFromHashmails(hashmails);
            });
        });
    }
    

    onFilesSectionChange(session: mail.session.Session, event: Types.utils.collection.CollectionEvent<mail.section.SectionService>) {
        if (event.element != null) {
            if (event.element.hasFileModule()) {
                this.fsManager.addSectionAndInit(event.element, session).then(sec => {
                    if (sec != null) {
                        return this.finishFileTreePreparation(sec, session.hostHash);
                    }
                })
                .fail(this.errorCallback);
            }
            if (event.type == "remove") {
                if (this.activeFilesList && this.activeFilesList.destination == event.element.getId()) {
                    this.clearActive();
                }
            }
        }
    }
    
    finishFileTreePreparation(fsMgrEntry: FsManagerEntry, hostHash: string, isConversation?: boolean): Q.Promise<void> {
        return Q().then(() => {
            let ntree = fsMgrEntry.tree;
            let section = fsMgrEntry.section;
            let manager = this.trees[ntree.root.ref.id];
            if (manager == null) {
                this.trees[ntree.root.ref.id] = manager = this.addComponent("fileTreeManager/" + ntree.root.ref.id, ntree);
                this.filesBaseCollection.addCollection(ntree.collection);
            }
            if (section == this.notes2Plugin.sectionManager.getMyPrivateSection()) {
                this.myFileTreeManager = manager;
            }
            let collectionId: string;
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            if (isConversation) {
                let conversation = session ? session.conv2Service.collection.find(x => x.section == section) : null;
                if (!conversation) {
                    return;
                }
                collectionId = Notes2WindowController.getConversationId(session, conversation); 
                return conversation.prepareFilesCollection().then(() => {
                    if (conversation.section) {
                        this.channelsTrees[collectionId] = manager;
                        this.sessionsByCollectionName[collectionId] = session;
                        if (this.collections[collectionId]) {
                            this.collections[collectionId].refresh();
                        }
                    }
                });
            }
            else {
                collectionId = Notes2WindowController.getChannelId(session, section); 
                this.channelsTrees[collectionId] = manager;
                this.sessionsByCollectionName[collectionId] = session;
                if (this.collections[collectionId]) {
                    this.collections[collectionId].refresh();
                }
            }
        });
    }
    
    getModel(): Model {
        return {
            activeId: this.getActiveId(),
            hashmail: this.identity.hashmail,
            iframeId: this.dockedEditor && this.reusableOpener ? this.reusableOpener.iframeId : null,
            iframeLoad: this.dockedEditor && this.reusableOpener ? this.reusableOpener.load : null,
            directory: this.directoryModel,
            showLocalFS: this.app.isElectronApp(),
            showFilePreview: this.showFilePreview(),
        };
    }
    
    getActiveId(): string {
        return this.activeFilesList ? this.activeFilesList.fileListId : null;
    }
    
    showFilePreview(): boolean {
        let fileListId = this.activeFilesList ? this.activeFilesList.fileListId : null;
        return this.notes2Plugin.getSetting(this.app.sessionManager.getLocalSession(), ViewSettings.SHOW_FILE_PREVIEW, fileListId, ViewContext.Notes2Window) == 1;
    }
    
    //===========================
    //       VIEW EVENTS
    //===========================
    
    onViewLoad(): void {
        let activeId = this.getActiveId();
        if (activeId) {
            this.activateFiles(this.getActiveId());
        }
        if (this.dockedEditor && this.reusableOpener) {
            this.callViewMethod("showIframe", this.reusableOpener.iframeId, this.reusableOpener.load);
        }
        else if (this.directoryModel) {
            this.callViewMethod("showDirectoryPreview", this.directoryModel);
        }
        this.callViewMethod("changeIsSearchOn", this.isSearchOn);
    }
    
    onViewActivatePreview(): void {
        if (this.dockedEditor) {
            this.dockedEditor.onNwinFocus();
        }
    }
    
    onViewDragDrop(fileHandle: Types.app.FileHandle[]) {
        if (this.activeFilesList.filesInfo.type == FilesListType.CONVERSATION) {
            let conversation = this.activeFilesList.filesInfo.conversation;
            if (conversation.hasDeletedUserOnly()) {
                return;
            }
        }
        this.activeFilesList.processDragDrop(fileHandle);
    }
    
    onViewRefresh(): void {
        if (this.activeFilesList) {
            this.activeFilesList.refreshTree(undefined, true);
        }
    }
    
    //===========================
    //          MISC
    //===========================
    
    reloadAll(): Q.Promise<void> {
        return this.fsManager.refresh();
    }
    
    applyHistoryState(processed: boolean, state: string) {
        if (this.app.viewContext) {
            let contextData = this.app.viewContext.split(":");
            let oldActive = this.activeFilesList;
            let handled = false;
              
            if (this.app.switchModuleWithContext()) {
                if (contextData[0] == "section") {
                    let contextSection = this.notes2Plugin.sectionManager.getSection(contextData[1]);
                    if (contextSection && contextSection.isFileModuleEnabled()) {
                        this.openChannel(contextSection.getId());
                        handled = true;
                    }
                }
                else if (contextData[0] == "c2") {
                    this.openConversationView(this.app.viewContext);
                    handled = true;
                }
                else if (contextData[0] == "custom") {
                    if (contextData[1] == "my") {
                        this.openMy();
                        handled = true;
                    }
                }
            }
            this.app.resetModuleSwitchingModifier();

            if (oldActive != this.activeFilesList) {
                if (oldActive) {
                    oldActive.deactivate();
                }
                if (this.activeFilesList) {
                    this.activeFilesList.activate();
                }
            }
            if (handled) {
                return;
            }
        }
        
        if (!processed && state) {
            if (state == FilesListController.MY_FILES) {
                this.openMy();
            }
            else if (state == FilesListController.ALL_FILES) {
                this.openAll();
            }
            else if (state == FilesListController.LOCAL_FILES) {
                this.openLocal();
            }
            else if (state == FilesListController.TRASH_FILES) {
                this.openTrash();
            }
            else {
                let section = this.notes2Plugin.sectionManager.getSection(state);
                if (section && section.isFileModuleEnabled()) {
                    this.openChannel(section.getId());
                }
                else {
                    this.openConversationView(state);
                }
            }
        }
    }
    
    onChildTabSwitch(child: window.base.BaseWindowController, shiftKey: boolean, ctrlKey: boolean): void {
        super.onChildTabSwitch(child, shiftKey, ctrlKey);
        if (!ctrlKey) {
            this.focusMe();
            this.callViewMethod("switchPanelFromPreview", shiftKey);
        }
    }

    onSidebarButtonAction(event: component.sidebar.SidebarButtonActionEvent) {
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }
    }
    
    openSectionsWindow(): void {
        // this.app.openSingletonWindow("sections", window.sections.SectionsWindowController);
        this.app.openNewSectionDialogFromSidebar();
    }

    //===========================
    //       FILES VIEWS
    //===========================
    
    addFilesListComponent(sessionInfo: SessionInfo, id: string, destination: string, collection: utils.collection.BaseCollection<FileEntryBase>,
        filesInfo: FilesInfo, editable: boolean, onRefresh: () => Q.Promise<void>): Q.Promise<FilesListController> {
        let filesList = this.filesLists[id] = this.addComponent(id, this.componentFactory.createComponent("notes2filelist", [this]));
        let localFS = id == FilesListController.LOCAL_FILES ? this.localFS : null;
        let session = sessionInfo.sessionType == "local" ? this.app.sessionManager.getLocalSession() : this.app.sessionManager.getSessionByHostHash(sessionInfo.hostHash);
        return Q().then(() => {
            return this.app.sessionManager.init(session.hostHash)
        })
        .then(() => {
            return filesList.setSession(session);
        })
        .then(() => {
            return filesList.setComponentData(id, destination, collection, filesInfo, editable, onRefresh, localFS);
        })
        .then(() => {
            filesList.addEventListener<RemoveFileEvent>("fileremoved", event => {
                event.result = this.closeDockedEditor().thenResolve(null);
            });
            filesList.addEventListener<PreviewRequestEvent>("previewrequest", event => {
                this.lastPreviewRequestEvent = event;
                if (!this.showFilePreview()) {
                    return;
                }
                this.processPreviewRequestEvent(event);
            });
            return filesList;
    
        })
    }
    
    singletonGetOrCreateFilesList(key: string, creatorFunc: () => Q.Promise<FilesListController>): Q.Promise<FilesListController> {
        if (!(key in this.pendingGetOrCreateFilesList)) {
            this.pendingGetOrCreateFilesList[key] = creatorFunc();
        }
        return this.pendingGetOrCreateFilesList[key];
    }
    
    processPreviewRequestEvent(event: PreviewRequestEvent): Q.Promise<void> {
        let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
        if (event.elementType == "file") {
            return this.loadFilePreview(session, event.openableElement);
        }
        else if (event.elementType == "directory") {
            return this.loadDirectoryPreview(session, event.directory);
        }
        else if (event.elementType == "clear") {
            return this.clearPreview();
        }
        else if (event.elementType == "multi") {
            return this.clearPreview(event.selectedCount);
        }
        return Q();
    }
    
    getOrCreateMy(): Q.Promise<FilesListController> {
        return Q().then(() => {
            let id = FilesListController.MY_FILES;
            if (!(id in this.filesLists)) {
                let tree = this.myFileTreeManager;
                let collection = this.getOrCreateCollectionMy();
                return this.addFilesListComponent({sessionType: "local"}, id, id, collection, {
                    type: FilesListType.OTHER,
                    conversation: null,
                    section: this.notes2Plugin.sectionManager.getMyPrivateSection()
                }, true, () => {
                    return tree.refreshDeep(true);
                })
                .then(() => {
                    return this.filesLists[id];
                })
            }
            return this.filesLists[id];    
        })
    }
    
    getOrCreateCollectionMy(): utils.collection.FilteredCollection<FileEntryBase> {
        if (this.collections[FilesListController.MY_FILES]) {
            return this.collections[FilesListController.MY_FILES];
        }
        let tree = this.myFileTreeManager;
        this.sessionsByCollectionName[FilesListController.MY_FILES] = this.app.sessionManager.getLocalSession();
        let collection = this.collections[FilesListController.MY_FILES] = new utils.collection.FilteredCollection(this.filesBaseCollection, x => {
            return Notes2Utils.isFsFileEntry(x) && x.tree == tree && x.path.indexOf(FilesConst.TRASH_PATH) == -1 && !mail.thumbs.ThumbsManager.isThumb(x.path);
        });
        collection.changeEvent.add(() => {
            let index = this.sidebar.customElementList.customElementsCollection.indexOfBy(x => x.id == FilesListController.MY_FILES);
            if (index != -1) {
                this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
            }
        }, "multi");
        return collection;
    }
    
    openMy(): Q.Promise<void> {
        let id = FilesListController.MY_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        return Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateMy());
        })
        .then(my => {
            this.activeFilesList = my;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.activateFiles(id);
            this.activeFilesList.loadFilePreview();
    
        })
    }
    
    getOrCreateAll(): Q.Promise<FilesListController> {
        let id = FilesListController.ALL_FILES;
        return Q().then(() => {
            if (!(id in this.filesLists)) {
                let collection = this.getOrCreateCollectionAll();
                return this.addFilesListComponent({sessionType: "local"}, id, id, collection, {
                    type: FilesListType.OTHER,
                    conversation: null,
                    section: this.notes2Plugin.sectionManager.getMyPrivateSection()
                }, true, () => {
                    return this.reloadAll();
                })
                .then(() => {
                    return this.filesLists[id];
                })
            }
            return this.filesLists[id];
        })
    }
    
    getOrCreateCollectionAll(): utils.collection.FilteredCollection<FileEntryBase> {
        if (this.collections[FilesListController.ALL_FILES]) {
            return this.collections[FilesListController.ALL_FILES];
        }
        this.sessionsByCollectionName[FilesListController.ALL_FILES] = this.app.sessionManager.getLocalSession();
        let collection = this.collections[FilesListController.ALL_FILES] = new utils.collection.FilteredCollection(this.filesBaseCollection, (x: Entry|Types.mail.AttachmentEntry) => {
            return Notes2Utils.isAttachmentEntry(x) || (x.isFile() && x.path.indexOf(FilesConst.TRASH_PATH) == -1) && !mail.thumbs.ThumbsManager.isThumb(x.path) && this.isLocalEntry(x);
        });
        collection.changeEvent.add(() => {
            let index = this.sidebar.customElementList.customElementsCollection.indexOfBy(x => x.id == FilesListController.ALL_FILES);
            if (index != -1) {
                this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
            }
        }, "multi");
        return collection;
    }
    
    openAll(): Q.Promise<void> {
        let id = FilesListController.ALL_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        return Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateAll());
        })
        .then(list => {
            this.activeFilesList = list;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.activateFiles(id);
            this.activeFilesList.loadFilePreview();
        })
    }
    
    getOrCreateLocal(): Q.Promise<FilesListController> {
        let id = FilesListController.LOCAL_FILES;
        return Q().then(() => {
            if (!(id in this.filesLists)) {
                let collection = this.localFilesBaseCollection;
                return this.addFilesListComponent({sessionType: "local"}, id, id, collection, {
                    type: FilesListType.OTHER,
                    conversation: null,
                    section: null
                }, true, () => {
                    return this.reloadAll();
                })
                .then(() => {
                    return this.filesLists[id];
                })
            }
            return this.filesLists[id];
        })        
    }
    
    openLocal(): Q.Promise<void> {
        let id = FilesListController.LOCAL_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        return Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateLocal());
        })
        .then(list => {
            this.activeFilesList = list;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.activateFiles(id);
            this.activeFilesList.loadFilePreview();    
        })
    }
    
    getOrCreateChannel(id: string, sectionId: string, section: mail.section.SectionService): Q.Promise<FilesListController> {
        let collectionId = Notes2WindowController.getChannelId(this.app.sessionManager.getLocalSession(), section);
        return Q().then(() => {
            if (!(id in this.filesLists)) {
                let collection = this.getOrCreateCollectionChannel(section);
                return this.addFilesListComponent({sessionType: "local"}, id, sectionId, collection, {
                    type: FilesListType.CHANNEL,
                    conversation: null,
                    section: section
                }, this.channelsTrees[collectionId] != null, () => {
                    return this.channelsTrees[collectionId] ? this.channelsTrees[collectionId].refreshDeep(true) : Q();
                })
                .then(() => {
                    return section.getChatSinkIndex().then(() => {
                        section.getChatModule().filesMessagesCollection.changeEvent.add(() => {
                            this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
                        }, "multi");                        
                    })
                    .then(() => {
                        return this.filesLists[id];  
                    })
  
                })
            }
            return this.filesLists[id];    
        })
        .then(() => {
            return this.filesLists[id];
        })
    }
    
    getOrCreateCollectionChannel(section: mail.section.SectionService): utils.collection.FilteredCollection<FileEntryBase> {
        let collectionId = Notes2WindowController.getChannelId(this.app.sessionManager.getLocalSession(), section);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        let sink = section.isChatModuleEnabled() ? section.getChatSink() : null;
        let sinkId = sink ? sink.id : null;
        this.sessionsByCollectionName[collectionId] = this.app.sessionManager.getLocalSession();
        let collection = this.collections[collectionId] = new utils.collection.FilteredCollection(this.filesBaseCollection, (x: Entry|Types.mail.AttachmentEntry) => {
            if (Notes2Utils.isFsFileEntry(x)) {
                return x.tree == this.channelsTrees[collectionId] && x.path.indexOf(FilesConst.TRASH_PATH) == -1 && !mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index.sink.id == sinkId;
        });
        collection.changeEvent.add(() => {
            this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
        }, "multi");
        return collection;
    }
    
    openChannel(sectionId: string): Q.Promise<void> {
        let section = this.notes2Plugin.sectionManager.getSection(sectionId);
        let filesId = Notes2WindowController.getChannelId(this.app.sessionManager.getLocalSession(), section);
        if (this.getActiveId() == filesId) {
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.SECTION,
                section: section
            }, false);
            this.callViewMethod("toggleDisabledSection", !section.isFileModuleEnabled());
            return Q();
        }

        if (section == null) {
            return Q();
        }
        this.notes2Plugin.activeSinkId = section.getChatSink().id;
        this.notes2Plugin.activeSinkHostHash = this.app.sessionManager.getLocalSession().hostHash;
        if (! section.isFileModuleEnabled()) {
            this.openDisabledSectionView(section);
            return Q();
        }
        return Q().then(() => {
            return this.singletonGetOrCreateFilesList(filesId, () => this.getOrCreateChannel(filesId, sectionId, section));
        })
        .then(list => {
            this.activeFilesList = list;
            this.notes2Plugin.activeFilesList = this.activeFilesList;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.SECTION,
                section: section
            }, false);
            this.activateFiles(filesId);
            this.activeFilesList.loadFilePreview();
        });
    }
    
    openDisabledSectionView(section: mail.section.SectionService) {
        this.disabledSection.setSection(section);
        this.sidebar.setActive({
            type: component.sidebar.SidebarElementType.SECTION,
            section: section
        }, false);
        this.callViewMethod("toggleDisabledSection", true);
    }
    
    getOrCreateTrash(): Q.Promise<FilesListController> {
        let id = FilesListController.TRASH_FILES;
        return Q().then(() => {
            if (!(id in this.filesLists)) {
                let collection = this.getOrCreateCollectionTrash();
                return this.addFilesListComponent({sessionType: "local"}, id, id, collection, {
                    type: FilesListType.OTHER,
                    conversation: null,
                    section: null
                }, true, () => {
                    return this.reloadAll();
                })
                .then(() => {
                    return this.filesLists[id];
                })
            }
            return this.filesLists[id];
    
        })
    }
    
    getOrCreateCollectionTrash(): utils.collection.FilteredCollection<FileEntryBase> {
        if (this.collections[FilesListController.TRASH_FILES]) {
            return this.collections[FilesListController.TRASH_FILES];
        }
        this.sessionsByCollectionName[FilesListController.TRASH_FILES] = this.app.sessionManager.getLocalSession();
        let collection = this.collections[FilesListController.TRASH_FILES] = new utils.collection.FilteredCollection(this.filesBaseCollection, x => {
            return Notes2Utils.isFsFileEntry(x) && x.path.indexOf(FilesConst.TRASH_PATH + "/") == 0 && !mail.thumbs.ThumbsManager.isThumb(x.path) && this.isLocalEntry(x);
        });
        collection.changeEvent.add(() => {
            let index = this.sidebar.customElementList.customElementsCollection.indexOfBy(x => x.id == FilesListController.TRASH_FILES);
            if (index != -1) {
                this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
            }
        }, "multi");
        return collection;
    }
    
    openTrash(): Q.Promise<void> {
        let id = FilesListController.TRASH_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        return Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateTrash());
        })
        .then(list => {
            this.activeFilesList = list;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.activateFiles(id);
            this.activeFilesList.loadFilePreview();    
        })
    }
    
    openConversationViewFromHashmails(hashmails: string[]): Q.Promise<void> {
        let conversationId = this.conv2Service.getConvIdFromHashmails(hashmails);
        this.app.viewContext = conversationId;
        return this.openConversationView(conversationId);
    }
    
    openConversationView(conversationId: string): Q.Promise<void> {
        let users = this.conv2Service.getUsersFromConvId(conversationId);
        let conversation = this.conv2Service.collection.find(x => x.id == conversationId);
        if (conversation == null) {
            conversation = this.conv2Service.getOrCreateConv(users, false);
            if (conversation == null) {
                return Q();
            }
        }
        let filesId = Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.getActiveId() == filesId) {
            return Q();
        }
        this.notes2Plugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
        this.notes2Plugin.activeSinkHostHash = this.app.sessionManager.getLocalSession().hostHash;
        return Q().then(() => {
            return this.singletonGetOrCreateFilesList(filesId, () => this.getOrCreateConversation(conversation));    
        })
        .then(list => {
            this.activeFilesList = list;
            this.notes2Plugin.activeFilesList = this.activeFilesList;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CONVERSATION,
                conv2: conversation
            }, false);
            this.activateFiles(filesId);
            this.activeFilesList.loadFilePreview();
        });
    }
    
    getOrCreateConversation(conversation: mail.section.Conv2Section): Q.Promise<FilesListController> {
        let filesId = Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        return Q().then(() => {
            if (!(filesId in this.filesLists)) {
                let collection = this.getOrCreateCollectionConversation(conversation);
                return this.addFilesListComponent({sessionType: "local"}, filesId, conversation.id, collection, {
                    type: FilesListType.CONVERSATION,
                    conversation: conversation,
                    section: null
                }, true, () => {
                    return conversation.fileTree ? conversation.fileTree.refreshDeep(true) : Q();
                })
                .then(() => {
                    return conversation.prepareFilesCollection().then(() => {
                        if (conversation.section) {
                            collection.refresh();
                        }
                    })
                    .fail(e => {
                        this.getLogger().error("Error during preparing files", e);
                    });
                })
                .then(() => {
                    return this.filesLists[filesId];
                })
            }
            return this.filesLists[filesId];
        })
    }
    
    getOrCreateCollectionConversation(conversation: mail.section.Conv2Section): utils.collection.FilteredCollection<FileEntryBase> {
        let collectionId = Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        this.sessionsByCollectionName[collectionId] = this.app.sessionManager.getLocalSession();
        let collection = this.collections[collectionId] = new utils.collection.FilteredCollection(this.filesBaseCollection, (x: Entry|Types.mail.AttachmentEntry) => {
            if (Notes2Utils.isFsFileEntry(x)) {
                return x.tree == conversation.fileTree && x.path.indexOf(FilesConst.TRASH_PATH) == -1 && !mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index == conversation.sinkIndex;
        });
        conversation.prepareFilesCollection().then(() => {
            if (conversation.section) {
                collection.refresh();
            }
        });
        collection.changeEvent.add(() => {
            this.sidebar.conv2List.sortedCollection.triggerBaseUpdateElement(conversation);
        }, "multi");
        return collection;
    }
    
    clearActive() {
        this.activeFilesList = null;
        this.activateFiles(null);
    }
    
    activateFiles(id: string): void {
        this.activateList(this.activeFilesList);
        this.callViewMethod("activateFiles", id);
    }

    onLoading(): void {
        this.loading.callViewMethod("onStartLoading");
    }
    
    //===========================
    //      SIDEBAR EVENTS
    //===========================
    
    onBeforeActivateSidebarElement(event: component.sidebar.ElementBeforeActivateEvent) {
        let prevActive = this.activeFilesList;
        event.result = false;
        Q().then(() => {
            event.result = false;
            if (event.element.type == component.sidebar.SidebarElementType.HOST) {
                return this.expandRemoteSectionsList(event.element.host);
            }
            else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
                this.app.viewContext = "section:" + event.element.section.getId();
                // console.log("opening remote channel...");
                return this.openRemoteChannel(event.element.hostHash, event.element.section.getId());
            }
            else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
                this.app.viewContext = event.element.conv2.id;
                return this.openRemoteConversationView(event.element.hostHash, event.element.conv2.id);
            }
            else if (event.element.type == component.sidebar.SidebarElementType.CONVERSATION) {
                this.onLoading();
                this.app.viewContext = event.element.conv2.id;
                return this.openConversationView(event.element.conv2.id);
            }
            else if (event.element.type == component.sidebar.SidebarElementType.SECTION) {
                this.onLoading();
                // console.log("opening channel..");
                this.app.viewContext = "section:" + event.element.section.getId();
                return this.openChannel(event.element.section.getId());

            }
            else if (event.element.type == component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
                this.onLoading();
                this.notes2Plugin.activeSinkId = null;
                this.notes2Plugin.activeSinkHostHash = null;
                this.app.viewContext = "custom:" + event.element.customElement.id;

                if (event.element.customElement.id == FilesListController.MY_FILES) {
                    return this.openMy();
                }
                if (event.element.customElement.id == FilesListController.ALL_FILES) {
                    return this.openAll();
                }
                if (event.element.customElement.id == FilesListController.LOCAL_FILES) {
                    return this.openLocal();
                }
                if (event.element.customElement.id == FilesListController.TRASH_FILES) {
                    return this.openTrash();
                }
            }    
        })
        .then(() => {
            this.deactivateList(prevActive);
        })
        .fail(e => console.log(e));

    }

    activateList(filesList: FilesListController): void {
        this.notes2Plugin.activeFilesList = this.activeFilesList;
        this.activeFilesList.activate();
    }

    deactivateList(filesList: FilesListController): void {
        if (filesList && filesList != this.activeFilesList) {
            filesList.deactivate();
        }
    }
    
    //===========================
    //         PREVIEW
    //===========================
    
    openDirectoryPreview(dir: mail.filetree.nt.Directory) {
        return Q().then(() => {
            return this.dockedEditor && this.reusableOpener ? true : this.closeDockedEditor();
        })
        .then(closed => {
            if (!closed) {
                return;
            }
            if (this.dockedEditor && this.reusableOpener) {
                this.callViewMethod("hideIframe", this.reusableOpener.iframeId);
            }
            this.stopPreviewPlayback();
            this.reusableOpener = null;
            this.dockedEditor = null;
            this.directoryModel = {
                path: dir.path,
                name: dir.name,
                lastModifiedDate: dir.dirStats.modifiedDate,
                size: dir.dirStats.filesSize,
                fileCount: dir.dirStats.filesCount
            };
            this.callViewMethod("showDirectoryPreview", this.directoryModel);
        })
        .fail(this.errorCallback);
    }
    
    onViewAfterShowIframe(id: number): void {
        if (this.reusableOpener && this.reusableOpener.iframeId == id) {
            if ("afterShowIframe" in this.reusableOpener.win) {
                (<any>this.reusableOpener.win).afterShowIframe();
            }
        }
    }
    
    openDockedEditorFor(session: mail.session.Session, oft: app.common.shelltypes.OpenableElement) {
        let fileTree: mail.filetree.nt.Tree;
        return Q().then(() => {
            if (oft instanceof mail.section.OpenableSectionFile && oft.section) {
                return oft.section.getFileTree();
            }
        }).then(sectionTree => {
            fileTree = sectionTree ? sectionTree : null;
            return this.dockedEditor && this.reusableOpener ? true : this.closeDockedEditor();
        })
        .then(closed => {
            if (!closed) {
                return;
            }
            
            let options: app.common.shelltypes.ShellOpenOptions = {
                element: oft,
                action: app.common.shelltypes.ShellOpenAction.PREVIEW,
                parent: this,
                docked: true,
                session: session
            };
            let appHandle = this.app.shellRegistry.resolveApplicationByElement(options);
            if (appHandle == null) {
                throw new Error("Cannot perform shell open at given parameter");
            }
            let creatingNewEditor = !(appHandle.id in this.reusableEditors);
            this.directoryModel = null;
            this.stopPreviewPlayback();
            let dockedEditor = this.dockedEditor;
            let reusableOpener = this.reusableOpener;
            if (!creatingNewEditor) {
                let entry = this.reusableEditors[appHandle.id];
                if (!entry.win.hasOpenedEntry || !entry.win.hasOpenedEntry(oft)) {
                    entry.win.release();
                    entry.win.reopen(options.element);
                }
                this.reusableOpener = entry;
                this.dockedEditor = entry.win;
                this.callViewMethod("showIframe", entry.iframeId, entry.load);
                if ("afterIframeShow" in this.dockedEditor) {
                    (<any>this.dockedEditor).afterIframeShow();
                }
                return Q().then(() => {
                    let def: Q.Deferred<void> = Q.defer();
                    setTimeout(() => {
                        if (dockedEditor && dockedEditor.id != entry.iframeId && reusableOpener && reusableOpener.appId != this.reusableOpener.appId) {
                            this.hideIframe(dockedEditor, reusableOpener);
                        }
                        def.resolve();
                    }, 50);
                    return def.promise;
                });
            }
            else {
                return Q().then(() => {
                    if (fileTree && oft instanceof mail.section.OpenableSectionFile) {
                        let entry = fileTree.collection.list.filter(x => x.path == oft.path)[0];
                        if (entry) {
                            return this.app.fileStyleResolver.getStyle(entry);
                        }
                    }
                })
                .then(style => {
                    this.callViewMethod("showEditorLoader", style ? style.styleName : "default");
                    if (this.dockedEditor && this.reusableOpener) {
                        this.hideIframe(dockedEditor, reusableOpener);
                    }
                    return appHandle.open(options).then(win => {
                        let rwin = <ReusableOpener><any>win;
                        let iframeId = this.editorsId++;
                        if (rwin.release && rwin.reopen) {
                            this.reusableOpener = this.reusableEditors[appHandle.id] = {
                                appId: appHandle.id,
                                iframeId: iframeId,
                                win: rwin,
                                load: null
                            };
                        }
                        else {
                            this.reusableOpener = null;
                        }
                        this.dockedEditor = win;
                        this.registerInstance(win);
                        win.onClose = () => {
                            if (this.reusableEditors[appHandle.id]) {
                                delete this.reusableEditors[appHandle.id];
                            }
                            win.destroy();
                            win.nwin.close(true);
                            this.callViewMethod("removeIframe", iframeId);
                            this.stopPreviewPlayback();
                            this.dockedEditor = null;
                        };
                        win.openDocked(this.nwin, iframeId);
                        let docked = <app.common.window.DockedWindow>win.nwin;
                        this.callViewMethod("showIframe", docked.id, docked.load);
                        if (this.reusableOpener) {
                            this.reusableOpener.load = docked.load;
                        }
                    });
                });
            }
        })
        .fail(this.errorCallback);
    }
    
    hideIframe(dockedEditor: window.base.BaseWindowController, reusableOpener: ReusableOpenerEntry): void {
        this.callViewMethod("hideIframe", reusableOpener.iframeId);
        if ("afterIframeHide" in dockedEditor) {
            (<any>dockedEditor).afterIframeHide();
        }
    }
    
    onDockedLoad(): void {
        this.callViewMethod("hideEditorLoader");
    }
    
    closeDockedEditor(): Q.Promise<boolean> {
        return Q().then(() => {
            if (this.dockedEditor) {
                return Q().then(() => {
                    return this.dockedEditor.close();
                })
                .then(() => {
                    return true;
                })
                .fail(e => {
                    return e ? Q.reject<boolean>(e) : false;
                });
            }
            return true;
        });
    }
    
    stopPreviewPlayback(): void {
        if (this.dockedEditor && "stopPlayback" in this.dockedEditor) {
            (<any>this.dockedEditor).stopPlayback();
        }
    }
    
    loadFilePreview(session: mail.session.Session, element: app.common.shelltypes.OpenableElement): Q.Promise<void> {
        let deferred = Q.defer<void>();
        this.elementToPreview = element;
        this.previewElement = element;
        clearTimeout(this.previewLoadTid);
        this.previewLoadTid = setTimeout(() => {
            if (this.elementToPreview) {
                this.openDockedEditorFor(session, this.elementToPreview).then(deferred.resolve, deferred.reject);
                this.elementToPreview = null;
            }
            else {
                deferred.reject();
            }
        }, 100);
        if (element instanceof mail.section.OpenableSectionFile && element.section) {
            let oft = element;
            Q.all([element.section.getFileTree(), deferred.promise]).then(([tree]) => {
                if (this.previewElement != oft) {
                    this.clearPreviewTrashedInfo();
                    return;
                }
                let entry = tree.collection.list.filter(x => x.id == oft.id)[0];
                if (entry) {
                    this.updatePreviewTrashedInfo(session, entry.getTrashedInfo(), tree.section);
                }
            });
            deferred.promise.fail(() => {
                this.clearPreviewTrashedInfo();
            });
        }
        else {
            this.clearPreviewTrashedInfo();
        }
        return deferred.promise;
    }
    
    loadDirectoryPreview(session: mail.session.Session, element: mail.filetree.nt.Directory): Q.Promise<void> {
        let deferred = Q.defer<void>();
        this.directoryToPreview = element;
        this.previewElement = element;
        clearTimeout(this.previewLoadTid);
        this.previewLoadTid = setTimeout(() => {
            if (this.directoryToPreview) {
                this.openDirectoryPreview(this.directoryToPreview).then(deferred.resolve, deferred.reject);
                this.directoryToPreview = null;
            }
            else {
                deferred.reject();
            }
        }, 100);
        if (element instanceof mail.filetree.nt.Directory && element.tree) {
            let dir = element;
            Q([deferred.promise]).then(() => {
                let tree = element.tree;
                if (this.previewElement != dir) {
                    this.clearPreviewTrashedInfo();
                    return;
                }
                let entry = tree.collection.list.filter(x => x.id == dir.id)[0];
                if (entry) {
                    this.updatePreviewTrashedInfo(session, entry.getTrashedInfo(), tree.section);
                }
            });
            deferred.promise.fail(() => {
                this.clearPreviewTrashedInfo();
            });
        }
        else {
            this.clearPreviewTrashedInfo();
        }
        return deferred.promise;
    }
    
    updatePreviewTrashedInfo(session: mail.session.Session, info: TrashedInfo, section: mail.section.SectionService): void {
        if (!info || !section) {
            this.clearPreviewTrashedInfo();
            return;
        }
        let user = session.conv2Service.contactService.contactCollection.find(x => x.user && x.user.user == info.who);
        let trashedInfoModel: TrashedInfoModel = {
            when: info.when,
            who: user ? user.getDisplayName() : info.who,
            sectionName: section.getName(),
            sectionId: section.getId(),
            fullSectionName: section.getFullSectionName(),
        };
        let trashedInfoModelStr = JSON.stringify(trashedInfoModel);
        if (trashedInfoModelStr != this.currPreviewTrashedInfoModelStr) {
            this.callViewMethod("setPreviewTrashedInfo", trashedInfoModelStr);
            this.currPreviewTrashedInfoModelStr = trashedInfoModelStr;
        }
    }
    
    clearPreviewTrashedInfo(): void {
        let trashedInfoModelStr: string = null;
        if (trashedInfoModelStr != this.currPreviewTrashedInfoModelStr) {
            this.callViewMethod("setPreviewTrashedInfo", trashedInfoModelStr);
            this.currPreviewTrashedInfoModelStr = trashedInfoModelStr;
        }
    }
    
    clearPreview(selectedItemsCount: number = 0): Q.Promise<void> {
        this.callViewMethod("hideDirectoryPreview", selectedItemsCount);
        this.clearPreviewTrashedInfo();
        if (this.dockedEditor && this.reusableOpener) {
            this.reusableOpener.win.release();
            this.callViewMethod("hideIframe", this.reusableOpener.iframeId);
            this.stopPreviewPlayback();
            this.dockedEditor = null;
            this.reusableOpener = null;
            return Q();
        }
        else {
            return this.closeDockedEditor().thenResolve(null);
        }
    }
    
    createCollections(): void {
        let localSession = this.app.sessionManager.getLocalSession();
        this.getOrCreateCollectionMy();
        this.getOrCreateCollectionAll();
        this.getOrCreateCollectionTrash();
        this.notes2Plugin.files2Sections[localSession.hostHash].list.forEach(section => {
            this.getOrCreateCollectionChannel(section);
        });
        this.conv2Service.collection.list.forEach(conv2Section => {
            this.getOrCreateCollectionConversation(conv2Section);
        });
    }
    
    getCustomElementSearchCount(customElement: component.customelementlist.CustomElement): number {
        let session = this.app.sessionManager.getLocalSession();
        let searchResults = this.getSearchResults(session);
        if (!searchResults) {
            return 0;
        }
        if (customElement.id == FilesListController.MY_FILES) {
            return searchResults[FilesListController.MY_FILES] || 0;
        }
        else if (customElement.id == FilesListController.ALL_FILES) {
            return searchResults[FilesListController.ALL_FILES] || 0;
        }
        else if (customElement.id == FilesListController.TRASH_FILES) {
            return searchResults[FilesListController.TRASH_FILES] || 0;
        }
        return 0;
    }
    
    getConv2ListSearchCount(session: mail.session.Session, conv2Section: mail.section.Conv2Section): number {
        let searchResults = this.getSearchResults(session);
        if (!searchResults) {
            return 0;
        }
        let collectionId = Notes2WindowController.getConversationId(session, conv2Section);
        return searchResults[collectionId] || 0;
    }
    
    getSectionSearchCount(session: mail.session.Session, section: mail.section.SectionService): number {
        let searchResults = this.getSearchResults(session);
        if (!searchResults) {
            return 0;
        }
        let collectionId = Notes2WindowController.getChannelId(session, section);
        return searchResults[collectionId] || 0;
    }
    
    getCustomElementWithSpinner(customElement: component.customelementlist.CustomElement): boolean {
        let localSession = this.app.sessionManager.getLocalSession();
        if (!this.notes2Plugin.sectionsWithSpinner[localSession.hostHash]) {
            return false;
        }
        if (this.notes2Plugin.sectionsWithSpinner[localSession.hostHash]["__all__"]) {
            return true;
        }
        return !!this.notes2Plugin.sectionsWithSpinner[localSession.hostHash][customElement.id];
    }
    
    getConv2WithSpinner(session: mail.session.Session, conv2Section: mail.section.Conv2Section): boolean {
        if (!this.notes2Plugin.sectionsWithSpinner[session.hostHash]) {
            return false;
        }
        if (this.notes2Plugin.sectionsWithSpinner[session.hostHash]["__all__"]) {
            return true;
        }
        return !!this.notes2Plugin.sectionsWithSpinner[session.hostHash][conv2Section.id];
    }
    
    getSectionWithSpinner(session: mail.session.Session, section: mail.section.SectionService): boolean {
        if (!this.notes2Plugin.sectionsWithSpinner[session.hostHash]) {
            return false;
        }
        if (this.notes2Plugin.sectionsWithSpinner[session.hostHash]["__all__"]) {
            return true;
        }
        return !!this.notes2Plugin.sectionsWithSpinner[session.hostHash][section.getId()];
    }
    
    onFilterFiles(): void {
        this.searchCountFilterUpdater.updateFilter(this.app.searchModel.get());
    }
    
    updateSearchCounts(): boolean {
        let data = this.app.searchModel.get();
        let searchStr = data.visible ? app.common.SearchFilter.prepareNeedle(data.value) : "";
        let localSession = this.app.sessionManager.getLocalSession();
        for (let collectionName in this.collections) {
            let collection = this.collections[collectionName];
            let session = this.sessionsByCollectionName[collectionName];
            let searchCount = 0;
            if (searchStr != "") {
                collection.list.forEach(f => {
                    if (!f || Notes2Utils.isLocalEntry(f) || Notes2Utils.isParentEntry(f)) {
                        return;
                    }
                    let name = Notes2Utils.isAttachmentEntry(f) ? f.attachment.getName() : f.name;
                    if (app.common.SearchFilter.matches(searchStr, name)) {
                        ++searchCount;
                    }
                });
            }
            let searchResults = this.getSearchResults(session);
            if (searchResults[collectionName] != searchCount) {
                searchResults[collectionName] = searchCount;
                let parsedId = Notes2WindowController.parseChannelOrConversationId(collectionName);
                if (collectionName == FilesListController.MY_FILES || collectionName == FilesListController.ALL_FILES || collectionName == FilesListController.TRASH_FILES) {
                    let idx = this.sidebarOptions.customElementList.baseCollection.indexOfBy(el => el.id == collectionName);
                    if (idx != -1) {
                        this.sidebarOptions.customElementList.baseCollection.triggerUpdateAt(idx);
                    }
                }
                else if (parsedId && parsedId.type == "conversation") {
                    let collection = parsedId.hostHash == localSession.hostHash ? this.sidebar.conv2List.sortedCollection : (this.sidebar.remoteConv2Lists[parsedId.hostHash] ? this.sidebar.remoteConv2Lists[parsedId.hostHash].sortedCollection : null);
                    if (collection) {
                        let idx = collection.indexOfBy(el => el.id == parsedId.id);
                        if (idx != -1) {
                            collection.triggerUpdateAt(idx);
                        }
                    }
                }
                else if (parsedId && parsedId.type == "channel") {
                    let collection = parsedId.hostHash == localSession.hostHash ? this.sidebar.sectionList.sortedCollection : (this.sidebar.remoteSectionsLists[parsedId.hostHash] ? this.sidebar.remoteSectionsLists[parsedId.hostHash].sortedCollection : null);
                    if (collection) {
                        let idx = collection.indexOfBy(el => el.getId() == parsedId.id);
                        if (idx != -1) {
                            collection.triggerUpdateAt(idx);
                        }
                    }
                }
            }
        }
        for (let session of this.notes2Plugin.getReadySessions()) {
            if (session.hostHash != localSession.hostHash) {
                this.sidebar.remoteSectionsLists[session.hostHash].sortedCollection.refresh();
                this.sidebar.remoteConv2Lists[session.hostHash].sortedCollection.refresh();
                this.updateSidebarHostElement(session);
            }
        }
        this.sidebar.sectionList.sortedCollection.refresh();
        this.sidebar.conv2List.sortedCollection.refresh();
        this.isSearchOn = searchStr != "";
        this.callViewMethod("changeIsSearchOn", this.isSearchOn);
        return true;
    }
    
    getSearchResults(session: mail.session.Session): SearchResults {
        if (!this.searchCounts[session.hostHash]) {
            this.searchCounts[session.hostHash] = {};
        }
        return this.searchCounts[session.hostHash];
    }
    
    getCustomElementUnread(customElement: component.customelementlist.CustomElement): number {
        let localSession = this.app.sessionManager.getLocalSession();
        if (customElement.id == FilesListController.MY_FILES) {
            let privateSection = this.notes2Plugin.sectionManager.getMyPrivateSection();
            let ufbs = this.notes2Plugin.unreadFilesBySection[localSession.hostHash];
            return privateSection && ufbs ? ufbs[privateSection.getId()] || 0 : 0;
        }
        else if (customElement.id == FilesListController.ALL_FILES) {
            //return (this.notes2Plugin.unreadFiles - this.notes2Plugin.unreadFilesBySection[FilesListController.TRASH_FILES]) || 0;
            return null;
        }
        else if (customElement.id == FilesListController.TRASH_FILES) {
            let ufbs = this.notes2Plugin.unreadFilesBySection[localSession.hostHash];
            return ufbs ? ufbs[FilesListController.TRASH_FILES] || 0 : 0;
        }
        return 0;
    }
    
    getElementsCountWithoutRoot(count: number): number {
        //Have to remove one element couse some collection contains root directory, which should not be included
        return count > 0 ? count - 1 : 0;
    }
    
    getCustomElementElementsCount(customElement: component.customelementlist.CustomElement): number {
        if (customElement.id == "my") {
            return this.getElementsCountWithoutRoot(this.getOrCreateCollectionMy().size());
        }
        if (customElement.id == "all") {
            return this.getOrCreateCollectionAll().size();
        }
        if (customElement.id == "trash") {
            return this.getOrCreateCollectionTrash().size();
        }
        return null;
    }
    
    getSectionUnread(session: mail.session.Session, section: mail.section.SectionService): number {
        let ufbs = this.notes2Plugin.unreadFilesBySection[session.hostHash];
        return (ufbs ? ufbs[section.getId()] : 0) || 0;
    }
    
    getSectionElementsCount(session: mail.session.Session, section: mail.section.SectionService): number {
        let localSession = this.app.sessionManager.getLocalSession();
        let count = session.host == localSession.host ? this.getOrCreateCollectionChannel(section).size() : this.getOrCreateRemoteCollectionChannel(session.hostHash, section).size();
        return this.getElementsCountWithoutRoot(count);
    }
    
    getConversationUnread(session: mail.session.Session, conv2Section: mail.section.Conv2Section): number {
        if (!conv2Section.section) {
            return 0;
        }
        return this.getSectionUnread(session, conv2Section.section);
    }
    
    getConv2ElementsCount(session: mail.session.Session, conv2Section: mail.section.Conv2Section): number {
        let localSession = this.app.sessionManager.getLocalSession();
        let count = session.host == localSession.host ? this.getOrCreateCollectionConversation(conv2Section).size() : this.getOrCreateRemoteCollectionConversation(session.hostHash, conv2Section).size();
        return this.getElementsCountWithoutRoot(count);
    }

    /////////////////////////////
    //// REMOTE SECTIONS ////////
    /////////////////////////////

    expandRemoteSectionsList(hostEntry: component.remotehostlist.HostEntry): void {
        let session: mail.session.Session;
        let hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        let checkSessionExists: boolean = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if (checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        
        Q().then(() => {
            this.sidebar.callViewMethod("showHostLoading", hostHash, true);
            if (!checkSessionExists) {
                return this.app.sessionManager.createRemoteSession(hostEntry.host)
                .then(() => {
                    return this.app.sessionManager.init(hostHash);
                })
                .fail(() => {
                    this.sidebar.callViewMethod("showHostLoading", hostHash, false);
                    return this.errorCallback;
                });
            }
        })
        .then(() => {
            session = this.app.sessionManager.getSessionByHostHash(hostHash);
            let tasksPlugin = this.app.getComponent("tasks-plugin");
            return Q.all([
                Q.all(session.sectionManager.sectionsCollection.list
                    .filter(x => !x.isPrivateOrUserGroup())
                    .map(x => this.fsManager.addSectionAndInit(x, session).then(y => y ? this.finishFileTreePreparation(y, hostHash) : null))),
                Q.all(session.conv2Service.collection.list
                    .map(x => this.fsManager.addConversationAndInit(x, session).then(y => y ? this.finishFileTreePreparation(y, hostHash, true) : null))),
                tasksPlugin ? tasksPlugin.ensureSessionProjectsInitialized(session) : Q(),
            ]);
        })
        .then(() => {
            return this.notes2Plugin.initializeSessionCollectionsAndTrees(session);
        })
        .then(() => {
            if (! this.remoteServers) {
                this.remoteServers = {};
            }
                
            this.initRemoteHostComponents(hostEntry, session);
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            this.isHostLoaded[hostHash] = true;
        })
        .then(() => {
            this.updateSidebarHostElement(session);
        })
        .fail(e => {
            console.log(e);
        });
    }

    checkRemoteHostComponentsInitialized(hostHash: string): boolean {
        let ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    }

    initRemoteHostComponents(hostEntry: component.remotehostlist.HostEntry, session: mail.session.Session): void {
        let hostHash = session.hostHash;
        if (this.checkRemoteHostComponentsInitialized(hostHash)) {
            return;
        }

        let sectionsListOptions: component.remotesectionlist.RemoteSectionListOptions = {
            baseCollection: session.sectionManager.filteredCollection,
            unreadProvider: section => this.getSectionUnread(session, section),
            elementsCountProvider: section => this.getRemoteSectionElementsCount(hostHash, section),
            searchCountProvider: section => this.getSectionSearchCount(session, section),
            searchAllSearchedProvider: null,
            sorter: (a, b) => {
                let res = b.getFileMessageLastDate() - a.getFileMessageLastDate();
                return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: Types.section.NotificationModule.NOTES2,
            checkShowAllAvailSections: false,
            session: session
        }

        let conv2ListOptions: component.remoteconv2list.RemoteConv2ListOptions = {
            unreadProvider: c2s => this.getConversationUnread(session, c2s),
            elementsCountProvider: c2s => this.getRemoteConv2ElementsCount(hostHash, c2s),
            searchCountProvider: c2s => this.getConv2ListSearchCount(session, c2s),
            searchAllSearchedProvider: null,
            withSpinnerProvider: c2s => this.getConv2WithSpinner(session, c2s),
            session: session
        };
        let hostList = hostEntry;
        hostList.sectionList = this.addComponent("remoteSectionsList-" + hostHash, this.componentFactory.createComponent("remotesectionlist", [this, sectionsListOptions]));
        hostList.sectionList.ipcMode = true;
        hostList.conv2List = this.addComponent("remoteConv2List-" + hostHash, this.componentFactory.createComponent("remoteconv2list", [this, conv2ListOptions]));
        hostList.conv2List.ipcMode = true;
        this.remoteServers[hostHash] = hostList;
        this.sidebar.registerRemoteSectionsList(hostHash, hostList.sectionList);
        this.sidebar.registerRemoteConv2List(hostHash, hostList.conv2List);
    }


    openRemoteChannel(hostHash: string, sectionId: string): Q.Promise<void> {
        return Q().then(() => {
            return this.app.sessionManager.init(hostHash);
        })
        .then(() => {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            let section = session.sectionManager.getSection(sectionId);
            let filesId = Notes2WindowController.getChannelId(session, section);

            if (this.getActiveId() == filesId) {
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.REMOTE_SECTION,
                    section: section,
                    hostHash: hostHash,
                }, false);
                this.callViewMethod("toggleDisabledSection", !section.isFileModuleEnabled());
                return;
            }
    
            if (section == null) {
                return;
            }
            this.notes2Plugin.activeSinkId = section.getChatSink().id;
            this.notes2Plugin.activeSinkHostHash = session.hostHash;
            
            if (! section.isFileModuleEnabled()) {
                this.openDisabledSectionView(section);
                return;
            }
            
            return this.singletonGetOrCreateFilesList(filesId, () => this.getOrCreateRemoteChannel(hostHash, filesId, sectionId, section))
            .then(newList => {
                this.activeFilesList = newList;
                
                this.notes2Plugin.activeFilesList = this.activeFilesList;
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.REMOTE_SECTION,
                    section: section,
                    hostHash: hostHash
                }, false);
                this.activateFiles(filesId);
                this.activeFilesList.loadFilePreview();
            })
        })
    }

    getOrCreateRemoteChannel(hostHash: string, id: string, sectionId: string, section: mail.section.SectionService): Q.Promise<FilesListController> {   
        let session = this.app.sessionManager.getSessionByHostHash(hostHash); 
        let collectionId = Notes2WindowController.getChannelId(session, section); 
        
        return Q().then(() => {
            if (!(id in this.filesLists)) {
                return this.fsManager.addSectionAndInit(section, session).then(sec => {
                    if (sec != null) {
                        return this.finishFileTreePreparation(sec, hostHash);
                    }
                })
                .then(() => {
                    let collection = this.getOrCreateRemoteCollectionChannel(hostHash, section);
                    return this.addFilesListComponent({sessionType: "remote", hostHash: hostHash}, id, sectionId, collection, {
                        type: FilesListType.CHANNEL,
                        conversation: null,
                        section: section
                    }, this.channelsTrees[collectionId] != null, () => {
                        return this.channelsTrees[collectionId] ? this.channelsTrees[collectionId].refreshDeep(true) : Q();
                    })        
                })
                .then(() => {
                    return section.getChatSinkIndex().then(() => {
                        section.getChatModule().filesMessagesCollection.changeEvent.add(() => {
                            this.sidebar.remoteSectionsLists[hostHash].sortedCollection.triggerBaseUpdateElement(section);
                            this.updateSidebarHostElement(this.app.sessionManager.getSessionByHostHash(hostHash));
                        }, "multi");
                    });    
                })
                .then(() => {
                    return this.filesLists[id];
                })
            }
            return this.filesLists[id];    
        })
    }
    
    getOrCreateRemoteCollectionChannel(hostHash: string, section: mail.section.SectionService): utils.collection.FilteredCollection<FileEntryBase> {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        let collectionId = Notes2WindowController.getChannelId(session, section);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        let sink = section.isChatModuleEnabled() ? section.getChatSink() : null;
        let sinkId = sink ? sink.id : null;
        this.sessionsByCollectionName[collectionId] = session;
        let collection = this.collections[collectionId] = new utils.collection.FilteredCollection(this.filesBaseCollection, (x: Entry|Types.mail.AttachmentEntry) => {
            if (Notes2Utils.isFsFileEntry(x)) {
                return x.tree == this.channelsTrees[collectionId] && x.path.indexOf(FilesConst.TRASH_PATH) == -1 && !mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index.sink.id == sinkId;
        });
        collection.changeEvent.add(() => {
            this.sidebar.remoteSectionsLists[hostHash].sortedCollection.triggerBaseUpdateElement(section);
            this.updateSidebarHostElement(this.app.sessionManager.getSessionByHostHash(hostHash));
        }, "multi");
        return collection;
    }
    
    openRemoteConversationView(hostHash: string, conversationId: string): Q.Promise<void> {
        return Q().then(() => {
            return this.app.sessionManager.init(hostHash);
        })
        .then(() => {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            let users = session.conv2Service.getUsersFromConvId(conversationId);
            let conversation = session.conv2Service.collection.find(x => x.id == conversationId);
            if (conversation == null) {
                conversation = session.conv2Service.getOrCreateConv(users, true);
                if (conversation == null) {
                    return Q();
                }
            }
            let filesId = Notes2WindowController.getConversationId(session, conversation);
            if (this.getActiveId() == filesId) {
                return;
            }
            this.notes2Plugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
            this.notes2Plugin.activeSinkHostHash = session.hostHash;
            
            return Q().then(() => {
                return this.singletonGetOrCreateFilesList(filesId, () => this.getOrCreateRemoteConversation(hostHash, conversation));    
            })
            .then(list => {
                this.activeFilesList = list;
                this.notes2Plugin.activeFilesList = this.activeFilesList;
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                    conv2: conversation,
                    hostHash: hostHash,
                }, false);
                this.activateFiles(filesId);
                this.activeFilesList.loadFilePreview();
            });
        });
    }

    getOrCreateRemoteConversation(hostHash: string, conversation: mail.section.Conv2Section): Q.Promise<FilesListController> {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        return Q().then(() => {
            let id = Notes2WindowController.getConversationId(session, conversation);
            // console.log("getOrCreateRemoteConversation id", id);
            if (!(id in this.filesLists)) {
                let collection: utils.collection.FilteredCollection<FileEntryBase> = null;
                return this.fsManager.addConversationAndInit(conversation, session).then(sec => {
                    if (sec != null) {
                        return this.finishFileTreePreparation(sec, hostHash);
                    }
                })
                .then(() => {
                    collection = this.getOrCreateRemoteCollectionConversation(hostHash, conversation);
                    return this.addFilesListComponent({ sessionType: "remote", hostHash: hostHash }, id, conversation.id, collection, {
                        type: FilesListType.CONVERSATION,
                        conversation: conversation,
                        section: null,
                    }, true, () => {
                        return conversation.fileTree ? conversation.fileTree.refreshDeep(true) : Q();
                    })
                })
                .then(() => {
                    return conversation.prepareFilesCollection().then(() => {
                        if (conversation.section) {
                            collection.refresh();
                        }
                    })
                    .fail(e => {
                        this.getLogger().error("Error during preparing files", e);
                    });
                })
                .then(() => {
                    return this.filesLists[id];
                });
            }
            return this.filesLists[id];
    
        })
    }
    
    getOrCreateRemoteCollectionConversation(hostHash: string, conversation: mail.section.Conv2Section): utils.collection.FilteredCollection<FileEntryBase> {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        let id = Notes2WindowController.getConversationId(session, conversation);
        if (this.collections[id]) {
            return this.collections[id];
        }
        this.sessionsByCollectionName[id] = session;
        let collection = this.collections[id] = new utils.collection.FilteredCollection(this.filesBaseCollection, (x: Entry|Types.mail.AttachmentEntry) => {
            if (Notes2Utils.isFsFileEntry(x)) {
                return x.tree == conversation.fileTree && x.path.indexOf(FilesConst.TRASH_PATH) == -1 && !mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index == conversation.sinkIndex;
        });
        conversation.prepareFilesCollection().then(() => {
            if (conversation.section) {
                collection.refresh();
            }
        });
        collection.changeEvent.add(() => {
            this.sidebar.remoteConv2Lists[hostHash].sortedCollection.triggerBaseUpdateElement(conversation);
            this.updateSidebarHostElement(this.app.sessionManager.getSessionByHostHash(hostHash));
        }, "multi");
        return collection;
    }
    
    updateSidebarHostElement(session: mail.session.Session): void {
        if (this.app.sessionManager.getLocalSession() == session) {
            return;
        }
        if (!this.isHostLoaded[session.hostHash]) {
            return;
        }
        let element = this.sidebar.hostList.hostsSortedCollection.find(x => x.host == session.host);
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    }
    
    getRemoteSectionElementsCount(hostHash: string, section: mail.section.SectionService): number {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionChannel(hostHash, section).size());
    }
    
    getRemoteConv2ElementsCount(hostHash: string, conv2Section: mail.section.Conv2Section): number {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionConversation(hostHash, conv2Section).size());
    }
    
    isLocalEntry(entry: mail.filetree.nt.Entry): boolean {
        return Notes2Utils.isEntryFromSession(entry, this.app.sessionManager.getLocalSession());
    }
    
    static getChannelId(session: mail.session.Session, section: mail.section.SectionService): string {
        return `channel-${session.hostHash}-${section.getId()}`;
    }
    
    static getConversationId(session: mail.session.Session, conversation: mail.section.Conv2Section): string {
        return `conversation-${session.hostHash}-${conversation.id}`;
    }
    
    static parseChannelOrConversationId(id: string): { type: "channel" | "conversation", hostHash: string, id: string } {
        if (!id) {
            return null;
        }
        let parts = id.split("-");
        if (parts.length < 3) {
            return null;
        }
        return {
            type: parts[0] == "channel" ? "channel" : "conversation",
            hostHash: parts[1],
            id: parts.slice(2).join("-"),
        };
    }
    
}
