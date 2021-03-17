import {utils, component, privfs, window, Q, Types, mail, app} from "pmc-mail";
import {Notes2Plugin, Notes2ComponentFactory} from "../../main/Notes2Plugin";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { FilesListController, FilesInfo, FilesListType, SelectionMode } from "../../component/fileslist/FilesListController";
import { FileEntryBase, Notes2Utils } from "../../main/Notes2Utils";
import {LocalFS} from "../../main/LocalFS";
import { FsManager, FsManagerEntry, SessionInfo, Notes2WindowController } from "../notes2/Notes2WindowController";
import Entry = mail.filetree.nt.Entry;
import { FilesConst } from "../../main/Common";
import {Model} from "../notes2/Notes2WindowController";
import { i18n } from "./i18n";

export interface FileChooserOptions {
    singleSelection?: boolean;
    hideLocalFiles?: boolean;
    hideTrashedFiles?: boolean;
}

@Dependencies(["notes2filelist", "persons", "splitter", "extlist", "notification", "conv2list", "sectionlist"])
export class FileChooserWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.notes2.window.filechooser.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    // @Inject identity: privfs.identity.Identity;
    // @Inject conv2Service: mail.section.Conv2Service;
    @Inject collectionFactory: mail.CollectionFactory;
    @Inject messagesCollection: utils.collection.BaseCollection<mail.SinkIndexEntry>;
    // @Inject client: privfs.core.Client;

    identity: privfs.identity.Identity;
    conv2Service: mail.section.Conv2Service;
    client: privfs.core.Client;

    componentFactory: Notes2ComponentFactory;
    personsComponent: component.persons.PersonsController;
    sidebarOptions: component.sidebar.SidebarOptions;
    sidebar: component.sidebar.SidebarController;
    splitter: component.splitter.SplitterController;
    deferred: Q.Deferred<app.common.shelltypes.OpenableElement[]>;
    filesLists: {[id: string]: FilesListController};
    notes2Plugin: Notes2Plugin;

    notifications: component.notification.NotificationController;
    filesBaseCollection: utils.collection.MergedCollection<FileEntryBase>;
    localFilesBaseCollection: utils.collection.MutableCollection<FileEntryBase>;
    fsManager: FsManager;
    onModalClose: () => void;
    
    collections: { [key: string]: utils.collection.FilteredCollection<FileEntryBase> } = {};
    channelsTrees: {[id: string]: mail.filetree.nt.Tree};
    trees: {[rootRefId: string]: mail.filetree.nt.Tree};
    myFileTreeManager: mail.filetree.nt.Tree;
        
    localFS: LocalFS;
    activeFilesList: FilesListController;
    prevActive: FilesListController;
    pendingGetOrCreateFilesList: { [key: string]: Q.Promise<FilesListController> } = {};
    // sessionsByCollectionName: { [collectionName: string]: mail.session.Session} = {};
    remoteServers: {[hostHash: string]: component.remotehostlist.HostEntry};
    
    constructor(parent: Types.app.WindowParent, public session: mail.session.Session, public section: mail.section.SectionService, public initialPath?: string, public options: FileChooserOptions = {}) {
        super(parent, __filename, __dirname, {
            isPublic: false,
            subs: {
                "splitter": {defaultValue: "320"},
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({handlePos:250,totalSize:1000}) },
                "local-fs-initial-path": {defaultValue: ""}
            }
        });
        this.parent = parent;
        
        this.client = session.sectionManager.client;
        this.identity = session.sectionManager.identity;
        this.conv2Service = session.conv2Service;
        

        this.filesLists = {};
        this.channelsTrees = {};
        this.trees = {};
        this.ipcMode = true;

        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.setPluginViewAssets("notes2");
        
        this.openWindowOptions = {
            modal: true,
            alwaysOnTop: false,
            showInactive: false,
            toolbar: false,
            maximized: false,
            maximizable: true,
            minimizable: true,
            show: false,
            minWidth: 400,
            minHeight: 515,
            width: 1200,
            height: 750,
            draggable: true,
            resizable: true,
            title: this.i18n("plugin.notes2.window.filechooser.title"),
            icon: "",
            keepSpinnerUntilViewLoaded: true,
        };
        this.deferred = Q.defer();
        this.filesLists = {};
        
        // this.registerChangeEvent(this.section.manager.filteredCollection.changeEvent, event => {
        //     if (event.type == "remove" && event.element && event.element.getId() == this.section.getId()) {
        //         // on section remove
        //         // this.close();
        //     }
        // });
    }
    
    getModel(): Model {
        return {
            activeId: this.getActiveId() || "my",
            hashmail: this.session.sectionManager.identity.hashmail,
            iframeId: null,
            iframeLoad: null,
            directory: null,
            showLocalFS: this.app.isElectronApp(),
            showFilePreview: false,
        };
    }
    
    getNameWithBreadcrumb(section: mail.section.SectionService): string {
        let breadcrumb = "";
        if (section == null) {
            return "";
        }
        if (section.getParent() == null) {
            return section.getName();
        }
        let parents: mail.section.SectionService[] = [];
        let lastParent = section.getParent();
        while (lastParent) {
          parents.unshift(lastParent);
          lastParent = lastParent.getParent();
        }
        parents.forEach(p => {
          breadcrumb += p.getName() + " / ";
        });
        return breadcrumb + section.getName();
    }
    
    init(): Q.IWhenable<void> {
        let localSession = this.app.sessionManager.getLocalSession();
        return this.app.mailClientApi.checkLoginCore().then(() => {
            
            this.fsManager = new FsManager(this.session.sectionManager.client.descriptorManager);
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
            let promises: Q.Promise<void>[] = [];
            for (let id in this.filesLists) {
                promises.push(Q().then(() => {
                    return this.filesLists[id].init ? this.filesLists[id].init() : null;
                }));
            }
            return Q.all(promises);
        })
        .then(() => {
            this.splitter = this.addComponent("splitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("splitter")]));
        })
        .then(() => {
            // Initializing sidebar
            return this.initSidebar();
        });

        // .then(() => {
        //     this.filesSections.forEach(x => {
        //         this.fsManager.addSection(x);
        //     });
        //     this.registerChangeEvent(this.filesSections.changeEvent, this.onFilesSectionChange);
        //     return this.fsManager.init().then(() => {
        //         return Q.all(Lang.getValues(this.fsManager.sections).map(x => this.finishFileTreePreparation(x)));
        //     });
        // })

    }

    onViewOpen(): void {
    }
    
    onViewLoad(): void {
        let opened: boolean = false;
        if (this.section && !this.section.isPrivate()) {
            if (this.section.isUserGroup()) {
                let conv2 = this.conv2Service.collection.find(x => x.section && x.section.getId() == this.section.getId());
                if (conv2.id) {
                    this.openConversationView(conv2.id);
                    opened = true;
                }
            }
            else {
                this.openChannel(this.section.getId());
                opened = true;
            }
        }
        
        if (!opened) {
            this.openMy();
            opened = true;
        }
        
        if (this.initialPath) {
            this.callViewMethod("switchFocusToFilesList", true);
        }
        else {
            this.callViewMethod("switchFocusToSidebar", true);
        }
    }

    
    showModal(onModalClose: () => void) {
        this.onModalClose = onModalClose;
        this.open();
        this.nwin.focus();
    }

    onViewClose() {
        if (this.onModalClose) {
            this.onModalClose();
        }
        this.close();
    }
    
    getPromise(): Q.Promise<app.common.shelltypes.OpenableElement[]> {
        return this.deferred.promise;
    }
    
    beforeClose(_force?: boolean): Q.IWhenable<void> {
        if (this.deferred && this.deferred.promise.isPending()) {
            this.deferred.resolve([]);
        }
        return super.beforeClose(_force);
    }
    
    
    /////////////////////////
    // SIDEBAR HELPERS
    /////////////////////////
    initSidebar(): Q.Promise<void> {
        let localSession = this.app.sessionManager.getLocalSession();
        return Q().then(() => {
            let priv = this.notes2Plugin.sectionManager.getMyPrivateSection();
            let filteredRootsCollection = this.addComponent("filteredRootsCollection", new utils.collection.FilteredCollection(this.notes2Plugin.files2Sections[localSession.hostHash], x => x != priv && x.isVisible()));
            let customElements: component.customelementlist.CustomElement[] = [];

            if (priv != null) {
                customElements.push(
                    {
                        id: FilesListController.MY_FILES,
                        icon: {
                            type: "hashmail",
                            value: this.notes2Plugin.identity.hashmail
                        },
                        label: this.i18n("plugin.notes2.window.filechooser.filter.my"),
                        private: true,
                        emphasized: true,
                    }
                );
            }
            customElements.push(
                {
                    id: FilesListController.ALL_FILES,
                    icon: {
                        type: "fa",
                        value: "privmx-icon privmx-icon-notes2",
                    },
                    label: this.i18n("plugin.notes2.window.filechooser.filter.all"),
                    private: false
                }
            );
            if (!this.options || !this.options.hideTrashedFiles) {
                customElements.push(
                    {
                        id: FilesListController.TRASH_FILES,
                        icon: {
                            type: "fa",
                            value: "ico-bin"
                        },
                        label: this.i18n("plugin.notes2.window.filechooser.filter.trash"),
                        private: false
                    }
                );
            }

            let customElementCollection = this.addComponent("cEleColl", new utils.collection.MutableCollection<component.customelementlist.CustomElement>(customElements));

            if (this.app.isElectronApp() && (!this.options || !this.options.hideLocalFiles)) {
                // let userName = (<any>this.app).getSystemUserName();
                // let computerName: string;
                // if (userName.length == 0) {
                //     computerName = this.i18n("plugin.notes2.window.filechooser.filter.local");
                // }
                // else {
                //     computerName = this.i18n("plugin.notes2.window.filechooser.filter.local") + " (" + userName + ")";
                // }
                let computerName = this.i18n("plugin.notes2.window.filechooser.filter.local", (<any>this.app).getSystemLabel());
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
                sectionsLimitReached: false,
                customElementList: {
                    baseCollection: customElementCollection,
                    unreadProvider: ce => this.getCustomElementUnread(ce),
                    elementsCountProvider: ce => this.getCustomElementElementsCount(ce),
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    unreadProvider: c2s => this.getConversationUnread(localSession, c2s),
                    elementsCountProvider: c2s => this.getConv2ElementsCount(localSession, c2s),
                    sorter: (a, b) => {
                        return b.getFileMessageLastDate() - a.getFileMessageLastDate();
                    },
                },
                sectionList: {
                    baseCollection: filteredRootsCollection,
                    unreadProvider: section => this.getSectionUnread(localSession, section),
                    elementsCountProvider: section => this.getSectionElementsCount(localSession, section),
                    searchCountProvider: null,
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
                    sorter: null
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: component.remotehostlist.ElementCountsAggregationStrategy.ALL,
                },

                conv2ListEnabled: true,
                conv2Splitter: this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: []
            };
            this.sidebarOptions = sidebarOptions;
            this.sidebar = this.addComponent("sidebar", this.componentFactory.createComponent("sidebar", [this, sidebarOptions]));
            this.sidebar.addEventListener("elementbeforeactivate", this.onBeforeActivateSidebarElement.bind(this));
            return;
        })

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
            return filesList.setComponentData(id, destination, collection, filesInfo, editable, onRefresh, localFS, "table", true).then(() => {
                if (this.initialPath) {
                    if (this.activeFilesList) {
                        this.activeFilesList.selectPath(this.initialPath);
                    }
                    else {
                        filesList.selectPath(this.initialPath);
                    }
                }
            });
        })
        .then(() => {
            filesList.setSelectionMode(this.options && this.options.singleSelection ? SelectionMode.SINGLE : SelectionMode.MULTI);
            filesList.onFilesChoosen = (elements: app.common.shelltypes.OpenableElement[]) => {
                this.deferred.resolve(elements);
                this.close();
            }
            return filesList;
        });
    }
    
    singletonGetOrCreateFilesList(key: string, creatorFunc: () => Q.Promise<FilesListController>): Q.Promise<FilesListController> {
        if (!(key in this.pendingGetOrCreateFilesList)) {
            this.pendingGetOrCreateFilesList[key] = creatorFunc();
        }
        return this.pendingGetOrCreateFilesList[key];
    }

    getOrCreateCollectionConversation(conversation: mail.section.Conv2Section): utils.collection.FilteredCollection<FileEntryBase> {
        let collectionId = Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        // this.sessionsByCollectionName[collectionId] = this.app.sessionManager.getLocalSession();
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
    
    
    getOrCreateCollectionChannel(section: mail.section.SectionService): utils.collection.FilteredCollection<FileEntryBase> {
        let sectionId = section.getId();
        let collectionId = Notes2WindowController.getChannelId(this.session, section);

        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        let sink = section.isChatModuleEnabled() ? section.getChatSink() : null;

        let sinkId = sink ? sink.id : null;

        // this.sessionsByCollectionName[collectionId] = this.app.sessionManager.getLocalSession();
        let collection = this.collections[collectionId] = new utils.collection.FilteredCollection(this.filesBaseCollection, (x: Entry|Types.mail.AttachmentEntry) => {
            if (Notes2Utils.isFsFileEntry(x)) {
                let res = x.tree == this.channelsTrees[collectionId] && x.path.indexOf(FilesConst.TRASH_PATH) == -1 && !mail.thumbs.ThumbsManager.isThumb(x.path);
                
                return res;
            }
            return x.entry.index.sink.id == sinkId;
        });
        collection.changeEvent.add(() => {
            this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
        }, "multi");
        return collection;
    }
    
    
    getOrCreateCollectionTrash(): utils.collection.FilteredCollection<FileEntryBase> {
        if (this.collections[FilesListController.TRASH_FILES]) {
            return this.collections[FilesListController.TRASH_FILES];
        }
        // this.sessionsByCollectionName[FilesListController.TRASH_FILES] = this.app.sessionManager.getLocalSession();
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
    
    getOrCreateCollectionAll(): utils.collection.FilteredCollection<FileEntryBase> {
        if (this.collections[FilesListController.ALL_FILES]) {
            return this.collections[FilesListController.ALL_FILES];
        }
        // this.sessionsByCollectionName[FilesListController.ALL_FILES] = this.app.sessionManager.getLocalSession();
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
    
    getOrCreateCollectionMy(): utils.collection.FilteredCollection<FileEntryBase> {
        if (this.collections[FilesListController.MY_FILES]) {
            return this.collections[FilesListController.MY_FILES];
        }
        let tree = this.myFileTreeManager;
        // this.sessionsByCollectionName[FilesListController.MY_FILES] = this.app.sessionManager.getLocalSession();
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

    openChannel(sectionId: string): Q.Promise<void> {
        let section = this.session.sectionManager.getSection(sectionId);
        let filesId = Notes2WindowController.getChannelId(this.session, section);
        if (this.getActiveId() == filesId) {
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.SECTION,
                section: section
            }, false);
            this.callViewMethod("toggleDisabledSection", !section.isFileModuleEnabled());
            if (filesId) {
                this.callViewMethod("hideLoading");
            }
            return Q();
        }

        if (section == null) {
            return Q();
        }
        this.notes2Plugin.activeSinkId = section.getChatSink().id;
        this.notes2Plugin.activeSinkHostHash = this.session.hostHash;
        if (! section.isFileModuleEnabled()) {
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
    
    getOrCreateChannel(id: string, sectionId: string, section: mail.section.SectionService): Q.Promise<FilesListController> {
        let collectionId = Notes2WindowController.getChannelId(this.session, section);
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
    
    openMy(): Q.Promise<void> {
        let id = FilesListController.MY_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateMy());
        })
        .then(list => {
            this.activeFilesList = list;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.callViewMethod("activateFiles", id, id);
        });
    }

    openAll(): Q.Promise<void> {
        let id = FilesListController.ALL_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateAll());
        })
        .then(list => {
            this.activeFilesList = list;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.callViewMethod("activateFiles", id, id);
        });
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

    openLocal(): Q.Promise<void> {
        let id = FilesListController.LOCAL_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateLocal());
        })
        .then(list => {
            this.activeFilesList = list;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.callViewMethod("activateFiles", id, id);
            this.activeFilesList.loadFilePreview();
        });
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
    
                
    onBeforeActivateSidebarElement(event: component.sidebar.ElementBeforeActivateEvent) {
        let prevActive = this.activeFilesList;
        event.result = false;
        Q().then(() => {
            event.result = false;
            if (event.element.type == component.sidebar.SidebarElementType.HOST) {
                return this.expandRemoteSectionsList(event.element.host);
            }
            else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
                return this.openRemoteChannel(event.element.hostHash, event.element.section.getId());
            }
            else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
                return this.openRemoteConversationView(event.element.hostHash, event.element.conv2.id);
            }
            else if (event.element.type == component.sidebar.SidebarElementType.CONVERSATION) {
                return this.openConversationView(event.element.conv2.id);
            }
            else if (event.element.type == component.sidebar.SidebarElementType.SECTION) {
                return this.openChannel(event.element.section.getId());

            }
            else if (event.element.type == component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
                this.notes2Plugin.activeSinkId = null;
                this.notes2Plugin.activeSinkHostHash = null;

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
    
    openTrash(): Q.Promise<void> {
        let id = FilesListController.TRASH_FILES;
        if (this.getActiveId() == id) {
            return Q();
        }
        Q().then(() => {
            return this.singletonGetOrCreateFilesList(id, () => this.getOrCreateTrash());
        })
        .then(list => {
            this.activeFilesList = list;
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == id)
            }, false);
            this.callViewMethod("activateFiles", id, id);
            this.activeFilesList.loadFilePreview();
        });
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
        
    
    //////////////////
    /// navigation methods
    ///////////////////
    
    openConversationView(conversationId: string): Q.Promise<void> {
        let conversation = this.conv2Service.collection.find(x => x.id == conversationId);
        let filesId = Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.getActiveId() == filesId) {
            return Q();
        }
        let users = this.conv2Service.getUsersFromConvId(conversationId);
        if (conversation == null) {
            conversation = this.conv2Service.getOrCreateConv(users, false);
            if (conversation == null) {
                return Q();
            }
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
    
    getActiveId(): string {
        return this.activeFilesList ? this.activeFilesList.fileListId : null;
    }

    reloadAll(): Q.Promise<void> {
        return this.fsManager.refresh();
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
    
    clearActive() {
        this.activeFilesList = null;
        this.callViewMethod("activateFiles", null, null);
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
                        // this.sessionsByCollectionName[collectionId] = session;
                        if (this.collections[collectionId]) {
                            this.collections[collectionId].refresh();
                        }
                    }
                });
            }
            else {
                collectionId = Notes2WindowController.getChannelId(session, section);
                this.channelsTrees[collectionId] = manager;
                // this.sessionsByCollectionName[collectionId] = session;
                if (this.collections[collectionId]) {
                    this.collections[collectionId].refresh();
                }
            }
        });
    }
    
    onViewSelect() {
        this.activeFilesList.chooseFile();
    }
    
    activateFiles(id: string): void {
        this.activateList(this.activeFilesList);
        this.callViewMethod("activateFiles", id);
    }

    expandRemoteSectionsList(hostEntry: component.remotehostlist.HostEntry): void {
        let session: mail.session.Session;
        let hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        let checkSessionExists: boolean = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if ( checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        
        
        Q().then(() => {
            if (! checkSessionExists) {
                this.sidebar.callViewMethod("showHostLoading", hostHash, true);
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
            if (! this.remoteServers) {
                this.remoteServers = {};
            }
                
            this.initRemoteHostComponents(hostEntry, session);
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
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
            searchCountProvider: null,
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
            searchCountProvider: null,
            searchAllSearchedProvider: null,
            withSpinnerProvider: null,
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
    
    getRemoteSectionElementsCount(hostHash: string, section: mail.section.SectionService): number {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionChannel(hostHash, section).size());
    }
    
    getRemoteConv2ElementsCount(hostHash: string, conv2Section: mail.section.Conv2Section): number {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionConversation(hostHash, conv2Section).size());
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
        // this.sessionsByCollectionName[collectionId] = session;
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
                return Q();
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
        // this.sessionsByCollectionName[id] = session;
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
        let element = this.sidebar.hostList.hostsSortedCollection.find(x => x.host == session.host);
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    }
    
    isLocalEntry(entry: mail.filetree.nt.Entry): boolean {
        return Notes2Utils.isEntryFromSession(entry, this.app.sessionManager.getLocalSession());
    }
    
}
