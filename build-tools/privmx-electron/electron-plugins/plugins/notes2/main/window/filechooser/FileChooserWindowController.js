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
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var FilesListController_1 = require("../../component/fileslist/FilesListController");
var Notes2Utils_1 = require("../../main/Notes2Utils");
var LocalFS_1 = require("../../main/LocalFS");
var Notes2WindowController_1 = require("../notes2/Notes2WindowController");
var Common_1 = require("../../main/Common");
var i18n_1 = require("./i18n");
var FileChooserWindowController = (function (_super) {
    __extends(FileChooserWindowController, _super);
    function FileChooserWindowController(parent, session, section, initialPath, options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this, parent, __filename, __dirname, {
            isPublic: false,
            subs: {
                "splitter": { defaultValue: "320" },
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({ handlePos: 250, totalSize: 1000 }) },
                "local-fs-initial-path": { defaultValue: "" }
            }
        }) || this;
        _this.session = session;
        _this.section = section;
        _this.initialPath = initialPath;
        _this.options = options;
        _this.collections = {};
        _this.pendingGetOrCreateFilesList = {};
        _this.parent = parent;
        _this.client = session.sectionManager.client;
        _this.identity = session.sectionManager.identity;
        _this.conv2Service = session.conv2Service;
        _this.filesLists = {};
        _this.channelsTrees = {};
        _this.trees = {};
        _this.ipcMode = true;
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.setPluginViewAssets("notes2");
        _this.openWindowOptions = {
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
            title: _this.i18n("plugin.notes2.window.filechooser.title"),
            icon: "",
            keepSpinnerUntilViewLoaded: true,
        };
        _this.deferred = pmc_mail_1.Q.defer();
        _this.filesLists = {};
        return _this;
    }
    FileChooserWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    FileChooserWindowController.prototype.getModel = function () {
        return {
            activeId: this.getActiveId() || "my",
            hashmail: this.session.sectionManager.identity.hashmail,
            iframeId: null,
            iframeLoad: null,
            directory: null,
            showLocalFS: this.app.isElectronApp(),
            showFilePreview: false,
        };
    };
    FileChooserWindowController.prototype.getNameWithBreadcrumb = function (section) {
        var breadcrumb = "";
        if (section == null) {
            return "";
        }
        if (section.getParent() == null) {
            return section.getName();
        }
        var parents = [];
        var lastParent = section.getParent();
        while (lastParent) {
            parents.unshift(lastParent);
            lastParent = lastParent.getParent();
        }
        parents.forEach(function (p) {
            breadcrumb += p.getName() + " / ";
        });
        return breadcrumb + section.getName();
    };
    FileChooserWindowController.prototype.init = function () {
        var _this = this;
        var localSession = this.app.sessionManager.getLocalSession();
        return this.app.mailClientApi.checkLoginCore().then(function () {
            _this.fsManager = new Notes2WindowController_1.FsManager(_this.session.sectionManager.client.descriptorManager);
            _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
            _this.filesBaseCollection = _this.addComponent("filesBaseCollection", new pmc_mail_1.utils.collection.MergedCollection());
            _this.filesBaseCollection.addCollection(_this.collectionFactory.getAttachmentsCollectionByBaseCollection("all-messages", _this.messagesCollection));
            _this.localFilesBaseCollection = _this.addComponent("localFilesBaseCollection", new pmc_mail_1.utils.collection.MutableCollection());
            if (_this.app.isElectronApp()) {
                var localFsInitialPath_1 = _this.settings.create("local-fs-initial-path");
                LocalFS_1.LocalFS.staticConstructor(_this.app);
                _this.localFS = new LocalFS_1.LocalFS(_this.localFilesBaseCollection, localFsInitialPath_1.get(), function (newPath) {
                    localFsInitialPath_1.set(newPath);
                });
            }
            _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
            _this.notes2Plugin.filesSections[localSession.hostHash].forEach(function (x) {
                _this.fsManager.addSection(x, localSession);
            });
            _this.registerChangeEvent(_this.notes2Plugin.filesSections[localSession.hostHash].changeEvent, function (event) { return _this.onFilesSectionChange(localSession, event); });
            return _this.fsManager.init().then(function () {
                return pmc_mail_1.Q.all(pmc_mail_1.utils.Lang.getValues(_this.fsManager.sections).map(function (x) {
                    _this.finishFileTreePreparation(x, localSession.hostHash);
                }));
            });
        })
            .then(function () {
            var promises = [];
            var _loop_1 = function (id) {
                promises.push(pmc_mail_1.Q().then(function () {
                    return _this.filesLists[id].init ? _this.filesLists[id].init() : null;
                }));
            };
            for (var id in _this.filesLists) {
                _loop_1(id);
            }
            return pmc_mail_1.Q.all(promises);
        })
            .then(function () {
            _this.splitter = _this.addComponent("splitter", _this.componentFactory.createComponent("splitter", [_this, _this.settings.create("splitter")]));
        })
            .then(function () {
            return _this.initSidebar();
        });
    };
    FileChooserWindowController.prototype.onViewOpen = function () {
    };
    FileChooserWindowController.prototype.onViewLoad = function () {
        var _this = this;
        var opened = false;
        if (this.section && !this.section.isPrivate()) {
            if (this.section.isUserGroup()) {
                var conv2 = this.conv2Service.collection.find(function (x) { return x.section && x.section.getId() == _this.section.getId(); });
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
    };
    FileChooserWindowController.prototype.showModal = function (onModalClose) {
        this.onModalClose = onModalClose;
        this.open();
        this.nwin.focus();
    };
    FileChooserWindowController.prototype.onViewClose = function () {
        if (this.onModalClose) {
            this.onModalClose();
        }
        this.close();
    };
    FileChooserWindowController.prototype.getPromise = function () {
        return this.deferred.promise;
    };
    FileChooserWindowController.prototype.beforeClose = function (_force) {
        if (this.deferred && this.deferred.promise.isPending()) {
            this.deferred.resolve([]);
        }
        return _super.prototype.beforeClose.call(this, _force);
    };
    FileChooserWindowController.prototype.initSidebar = function () {
        var _this = this;
        var localSession = this.app.sessionManager.getLocalSession();
        return pmc_mail_1.Q().then(function () {
            var priv = _this.notes2Plugin.sectionManager.getMyPrivateSection();
            var filteredRootsCollection = _this.addComponent("filteredRootsCollection", new pmc_mail_1.utils.collection.FilteredCollection(_this.notes2Plugin.files2Sections[localSession.hostHash], function (x) { return x != priv && x.isVisible(); }));
            var customElements = [];
            if (priv != null) {
                customElements.push({
                    id: FilesListController_1.FilesListController.MY_FILES,
                    icon: {
                        type: "hashmail",
                        value: _this.notes2Plugin.identity.hashmail
                    },
                    label: _this.i18n("plugin.notes2.window.filechooser.filter.my"),
                    private: true,
                    emphasized: true,
                });
            }
            customElements.push({
                id: FilesListController_1.FilesListController.ALL_FILES,
                icon: {
                    type: "fa",
                    value: "privmx-icon privmx-icon-notes2",
                },
                label: _this.i18n("plugin.notes2.window.filechooser.filter.all"),
                private: false
            });
            if (!_this.options || !_this.options.hideTrashedFiles) {
                customElements.push({
                    id: FilesListController_1.FilesListController.TRASH_FILES,
                    icon: {
                        type: "fa",
                        value: "ico-bin"
                    },
                    label: _this.i18n("plugin.notes2.window.filechooser.filter.trash"),
                    private: false
                });
            }
            var customElementCollection = _this.addComponent("cEleColl", new pmc_mail_1.utils.collection.MutableCollection(customElements));
            if (_this.app.isElectronApp() && (!_this.options || !_this.options.hideLocalFiles)) {
                var computerName = _this.i18n("plugin.notes2.window.filechooser.filter.local", _this.app.getSystemLabel());
                customElementCollection.addAt(2, {
                    id: FilesListController_1.FilesListController.LOCAL_FILES,
                    icon: {
                        type: "fa",
                        value: "fa-desktop"
                    },
                    label: computerName,
                    private: false
                });
            }
            var sidebarOptions = {
                sectionsLimitReached: false,
                customElementList: {
                    baseCollection: customElementCollection,
                    unreadProvider: function (ce) { return _this.getCustomElementUnread(ce); },
                    elementsCountProvider: function (ce) { return _this.getCustomElementElementsCount(ce); },
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    unreadProvider: function (c2s) { return _this.getConversationUnread(localSession, c2s); },
                    elementsCountProvider: function (c2s) { return _this.getConv2ElementsCount(localSession, c2s); },
                    sorter: function (a, b) {
                        return b.getFileMessageLastDate() - a.getFileMessageLastDate();
                    },
                },
                sectionList: {
                    baseCollection: filteredRootsCollection,
                    unreadProvider: function (section) { return _this.getSectionUnread(localSession, section); },
                    elementsCountProvider: function (section) { return _this.getSectionElementsCount(localSession, section); },
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                    sorter: function (a, b) {
                        var res = b.getFileMessageLastDate() - a.getFileMessageLastDate();
                        return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    },
                },
                customSectionList: {
                    baseCollection: null,
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                    sorter: null
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: pmc_mail_1.component.remotehostlist.ElementCountsAggregationStrategy.ALL,
                },
                conv2ListEnabled: true,
                conv2Splitter: _this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: []
            };
            _this.sidebarOptions = sidebarOptions;
            _this.sidebar = _this.addComponent("sidebar", _this.componentFactory.createComponent("sidebar", [_this, sidebarOptions]));
            _this.sidebar.addEventListener("elementbeforeactivate", _this.onBeforeActivateSidebarElement.bind(_this));
            return;
        });
    };
    FileChooserWindowController.prototype.getCustomElementUnread = function (customElement) {
        var localSession = this.app.sessionManager.getLocalSession();
        if (customElement.id == FilesListController_1.FilesListController.MY_FILES) {
            var privateSection = this.notes2Plugin.sectionManager.getMyPrivateSection();
            var ufbs = this.notes2Plugin.unreadFilesBySection[localSession.hostHash];
            return privateSection && ufbs ? ufbs[privateSection.getId()] || 0 : 0;
        }
        else if (customElement.id == FilesListController_1.FilesListController.ALL_FILES) {
            return null;
        }
        else if (customElement.id == FilesListController_1.FilesListController.TRASH_FILES) {
            var ufbs = this.notes2Plugin.unreadFilesBySection[localSession.hostHash];
            return ufbs ? ufbs[FilesListController_1.FilesListController.TRASH_FILES] || 0 : 0;
        }
    };
    FileChooserWindowController.prototype.getElementsCountWithoutRoot = function (count) {
        return count > 0 ? count - 1 : 0;
    };
    FileChooserWindowController.prototype.getCustomElementElementsCount = function (customElement) {
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
    };
    FileChooserWindowController.prototype.getSectionUnread = function (session, section) {
        var ufbs = this.notes2Plugin.unreadFilesBySection[session.hostHash];
        return (ufbs ? ufbs[section.getId()] : 0) || 0;
    };
    FileChooserWindowController.prototype.getSectionElementsCount = function (session, section) {
        var localSession = this.app.sessionManager.getLocalSession();
        var count = session.host == localSession.host ? this.getOrCreateCollectionChannel(section).size() : this.getOrCreateRemoteCollectionChannel(session.hostHash, section).size();
        return this.getElementsCountWithoutRoot(count);
    };
    FileChooserWindowController.prototype.getConversationUnread = function (session, conv2Section) {
        if (!conv2Section.section) {
            return 0;
        }
        return this.getSectionUnread(session, conv2Section.section);
    };
    FileChooserWindowController.prototype.getConv2ElementsCount = function (session, conv2Section) {
        var localSession = this.app.sessionManager.getLocalSession();
        var count = session.host == localSession.host ? this.getOrCreateCollectionConversation(conv2Section).size() : this.getOrCreateRemoteCollectionConversation(session.hostHash, conv2Section).size();
        return this.getElementsCountWithoutRoot(count);
    };
    FileChooserWindowController.prototype.addFilesListComponent = function (sessionInfo, id, destination, collection, filesInfo, editable, onRefresh) {
        var _this = this;
        var filesList = this.filesLists[id] = this.addComponent(id, this.componentFactory.createComponent("notes2filelist", [this]));
        var localFS = id == FilesListController_1.FilesListController.LOCAL_FILES ? this.localFS : null;
        var session = sessionInfo.sessionType == "local" ? this.app.sessionManager.getLocalSession() : this.app.sessionManager.getSessionByHostHash(sessionInfo.hostHash);
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.init(session.hostHash);
        })
            .then(function () {
            return filesList.setSession(session);
        })
            .then(function () {
            return filesList.setComponentData(id, destination, collection, filesInfo, editable, onRefresh, localFS, "table", true).then(function () {
                if (_this.initialPath) {
                    if (_this.activeFilesList) {
                        _this.activeFilesList.selectPath(_this.initialPath);
                    }
                    else {
                        filesList.selectPath(_this.initialPath);
                    }
                }
            });
        })
            .then(function () {
            filesList.setSelectionMode(_this.options && _this.options.singleSelection ? FilesListController_1.SelectionMode.SINGLE : FilesListController_1.SelectionMode.MULTI);
            filesList.onFilesChoosen = function (elements) {
                _this.deferred.resolve(elements);
                _this.close();
            };
            return filesList;
        });
    };
    FileChooserWindowController.prototype.singletonGetOrCreateFilesList = function (key, creatorFunc) {
        if (!(key in this.pendingGetOrCreateFilesList)) {
            this.pendingGetOrCreateFilesList[key] = creatorFunc();
        }
        return this.pendingGetOrCreateFilesList[key];
    };
    FileChooserWindowController.prototype.getOrCreateCollectionConversation = function (conversation) {
        var _this = this;
        var collectionId = Notes2WindowController_1.Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        var collection = this.collections[collectionId] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            if (Notes2Utils_1.Notes2Utils.isFsFileEntry(x)) {
                return x.tree == conversation.fileTree && x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index == conversation.sinkIndex;
        });
        conversation.prepareFilesCollection().then(function () {
            if (conversation.section) {
                collection.refresh();
            }
        });
        collection.changeEvent.add(function () {
            _this.sidebar.conv2List.sortedCollection.triggerBaseUpdateElement(conversation);
        }, "multi");
        return collection;
    };
    FileChooserWindowController.prototype.getOrCreateCollectionChannel = function (section) {
        var _this = this;
        var sectionId = section.getId();
        var collectionId = Notes2WindowController_1.Notes2WindowController.getChannelId(this.session, section);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        var sink = section.isChatModuleEnabled() ? section.getChatSink() : null;
        var sinkId = sink ? sink.id : null;
        var collection = this.collections[collectionId] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            if (Notes2Utils_1.Notes2Utils.isFsFileEntry(x)) {
                var res = x.tree == _this.channelsTrees[collectionId] && x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path);
                return res;
            }
            return x.entry.index.sink.id == sinkId;
        });
        collection.changeEvent.add(function () {
            _this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
        }, "multi");
        return collection;
    };
    FileChooserWindowController.prototype.getOrCreateCollectionTrash = function () {
        var _this = this;
        if (this.collections[FilesListController_1.FilesListController.TRASH_FILES]) {
            return this.collections[FilesListController_1.FilesListController.TRASH_FILES];
        }
        var collection = this.collections[FilesListController_1.FilesListController.TRASH_FILES] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            return Notes2Utils_1.Notes2Utils.isFsFileEntry(x) && x.path.indexOf(Common_1.FilesConst.TRASH_PATH + "/") == 0 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path) && _this.isLocalEntry(x);
        });
        collection.changeEvent.add(function () {
            var index = _this.sidebar.customElementList.customElementsCollection.indexOfBy(function (x) { return x.id == FilesListController_1.FilesListController.TRASH_FILES; });
            if (index != -1) {
                _this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
            }
        }, "multi");
        return collection;
    };
    FileChooserWindowController.prototype.getOrCreateMy = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var id = FilesListController_1.FilesListController.MY_FILES;
            if (!(id in _this.filesLists)) {
                var tree_1 = _this.myFileTreeManager;
                var collection = _this.getOrCreateCollectionMy();
                return _this.addFilesListComponent({ sessionType: "local" }, id, id, collection, {
                    type: FilesListController_1.FilesListType.OTHER,
                    conversation: null,
                    section: _this.notes2Plugin.sectionManager.getMyPrivateSection()
                }, true, function () {
                    return tree_1.refreshDeep(true);
                })
                    .then(function () {
                    return _this.filesLists[id];
                });
            }
            return _this.filesLists[id];
        });
    };
    FileChooserWindowController.prototype.getOrCreateCollectionAll = function () {
        var _this = this;
        if (this.collections[FilesListController_1.FilesListController.ALL_FILES]) {
            return this.collections[FilesListController_1.FilesListController.ALL_FILES];
        }
        var collection = this.collections[FilesListController_1.FilesListController.ALL_FILES] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            return Notes2Utils_1.Notes2Utils.isAttachmentEntry(x) || (x.isFile() && x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1) && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path) && _this.isLocalEntry(x);
        });
        collection.changeEvent.add(function () {
            var index = _this.sidebar.customElementList.customElementsCollection.indexOfBy(function (x) { return x.id == FilesListController_1.FilesListController.ALL_FILES; });
            if (index != -1) {
                _this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
            }
        }, "multi");
        return collection;
    };
    FileChooserWindowController.prototype.getOrCreateCollectionMy = function () {
        var _this = this;
        if (this.collections[FilesListController_1.FilesListController.MY_FILES]) {
            return this.collections[FilesListController_1.FilesListController.MY_FILES];
        }
        var tree = this.myFileTreeManager;
        var collection = this.collections[FilesListController_1.FilesListController.MY_FILES] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            return Notes2Utils_1.Notes2Utils.isFsFileEntry(x) && x.tree == tree && x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path);
        });
        collection.changeEvent.add(function () {
            var index = _this.sidebar.customElementList.customElementsCollection.indexOfBy(function (x) { return x.id == FilesListController_1.FilesListController.MY_FILES; });
            if (index != -1) {
                _this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
            }
        }, "multi");
        return collection;
    };
    FileChooserWindowController.prototype.openChannel = function (sectionId) {
        var _this = this;
        var section = this.session.sectionManager.getSection(sectionId);
        var filesId = Notes2WindowController_1.Notes2WindowController.getChannelId(this.session, section);
        if (this.getActiveId() == filesId) {
            this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
                section: section
            }, false);
            this.callViewMethod("toggleDisabledSection", !section.isFileModuleEnabled());
            if (filesId) {
                this.callViewMethod("hideLoading");
            }
            return pmc_mail_1.Q();
        }
        if (section == null) {
            return pmc_mail_1.Q();
        }
        this.notes2Plugin.activeSinkId = section.getChatSink().id;
        this.notes2Plugin.activeSinkHostHash = this.session.hostHash;
        if (!section.isFileModuleEnabled()) {
            return pmc_mail_1.Q();
        }
        return pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(filesId, function () { return _this.getOrCreateChannel(filesId, sectionId, section); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.notes2Plugin.activeFilesList = _this.activeFilesList;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
                section: section
            }, false);
            _this.activateFiles(filesId);
            _this.activeFilesList.loadFilePreview();
        });
    };
    FileChooserWindowController.prototype.getOrCreateChannel = function (id, sectionId, section) {
        var _this = this;
        var collectionId = Notes2WindowController_1.Notes2WindowController.getChannelId(this.session, section);
        return pmc_mail_1.Q().then(function () {
            if (!(id in _this.filesLists)) {
                var collection = _this.getOrCreateCollectionChannel(section);
                return _this.addFilesListComponent({ sessionType: "local" }, id, sectionId, collection, {
                    type: FilesListController_1.FilesListType.CHANNEL,
                    conversation: null,
                    section: section
                }, _this.channelsTrees[collectionId] != null, function () {
                    return _this.channelsTrees[collectionId] ? _this.channelsTrees[collectionId].refreshDeep(true) : pmc_mail_1.Q();
                })
                    .then(function () {
                    return section.getChatSinkIndex().then(function () {
                        section.getChatModule().filesMessagesCollection.changeEvent.add(function () {
                            _this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
                        }, "multi");
                    })
                        .then(function () {
                        return _this.filesLists[id];
                    });
                });
            }
            return _this.filesLists[id];
        })
            .then(function () {
            return _this.filesLists[id];
        });
    };
    FileChooserWindowController.prototype.openMy = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.MY_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateMy(); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.callViewMethod("activateFiles", id, id);
        });
    };
    FileChooserWindowController.prototype.openAll = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.ALL_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateAll(); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.callViewMethod("activateFiles", id, id);
        });
    };
    FileChooserWindowController.prototype.getOrCreateAll = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.ALL_FILES;
        return pmc_mail_1.Q().then(function () {
            if (!(id in _this.filesLists)) {
                var collection = _this.getOrCreateCollectionAll();
                return _this.addFilesListComponent({ sessionType: "local" }, id, id, collection, {
                    type: FilesListController_1.FilesListType.OTHER,
                    conversation: null,
                    section: _this.notes2Plugin.sectionManager.getMyPrivateSection()
                }, true, function () {
                    return _this.reloadAll();
                })
                    .then(function () {
                    return _this.filesLists[id];
                });
            }
            return _this.filesLists[id];
        });
    };
    FileChooserWindowController.prototype.openLocal = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.LOCAL_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateLocal(); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.callViewMethod("activateFiles", id, id);
            _this.activeFilesList.loadFilePreview();
        });
    };
    FileChooserWindowController.prototype.getOrCreateLocal = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.LOCAL_FILES;
        return pmc_mail_1.Q().then(function () {
            if (!(id in _this.filesLists)) {
                var collection = _this.localFilesBaseCollection;
                return _this.addFilesListComponent({ sessionType: "local" }, id, id, collection, {
                    type: FilesListController_1.FilesListType.OTHER,
                    conversation: null,
                    section: null
                }, true, function () {
                    return _this.reloadAll();
                })
                    .then(function () {
                    return _this.filesLists[id];
                });
            }
            return _this.filesLists[id];
        });
    };
    FileChooserWindowController.prototype.onBeforeActivateSidebarElement = function (event) {
        var _this = this;
        var prevActive = this.activeFilesList;
        event.result = false;
        pmc_mail_1.Q().then(function () {
            event.result = false;
            if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.HOST) {
                return _this.expandRemoteSectionsList(event.element.host);
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
                return _this.openRemoteChannel(event.element.hostHash, event.element.section.getId());
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
                return _this.openRemoteConversationView(event.element.hostHash, event.element.conv2.id);
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
                return _this.openConversationView(event.element.conv2.id);
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
                return _this.openChannel(event.element.section.getId());
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
                _this.notes2Plugin.activeSinkId = null;
                _this.notes2Plugin.activeSinkHostHash = null;
                if (event.element.customElement.id == FilesListController_1.FilesListController.MY_FILES) {
                    return _this.openMy();
                }
                if (event.element.customElement.id == FilesListController_1.FilesListController.ALL_FILES) {
                    return _this.openAll();
                }
                if (event.element.customElement.id == FilesListController_1.FilesListController.LOCAL_FILES) {
                    return _this.openLocal();
                }
                if (event.element.customElement.id == FilesListController_1.FilesListController.TRASH_FILES) {
                    return _this.openTrash();
                }
            }
        })
            .then(function () {
            _this.deactivateList(prevActive);
        })
            .fail(function (e) { return console.log(e); });
    };
    FileChooserWindowController.prototype.activateList = function (filesList) {
        this.notes2Plugin.activeFilesList = this.activeFilesList;
        this.activeFilesList.activate();
    };
    FileChooserWindowController.prototype.deactivateList = function (filesList) {
        if (filesList && filesList != this.activeFilesList) {
            filesList.deactivate();
        }
    };
    FileChooserWindowController.prototype.openTrash = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.TRASH_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateTrash(); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.callViewMethod("activateFiles", id, id);
            _this.activeFilesList.loadFilePreview();
        });
    };
    FileChooserWindowController.prototype.getOrCreateTrash = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.TRASH_FILES;
        return pmc_mail_1.Q().then(function () {
            if (!(id in _this.filesLists)) {
                var collection = _this.getOrCreateCollectionTrash();
                return _this.addFilesListComponent({ sessionType: "local" }, id, id, collection, {
                    type: FilesListController_1.FilesListType.OTHER,
                    conversation: null,
                    section: null
                }, true, function () {
                    return _this.reloadAll();
                })
                    .then(function () {
                    return _this.filesLists[id];
                });
            }
            return _this.filesLists[id];
        });
    };
    FileChooserWindowController.prototype.openConversationView = function (conversationId) {
        var _this = this;
        var conversation = this.conv2Service.collection.find(function (x) { return x.id == conversationId; });
        var filesId = Notes2WindowController_1.Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.getActiveId() == filesId) {
            return pmc_mail_1.Q();
        }
        var users = this.conv2Service.getUsersFromConvId(conversationId);
        if (conversation == null) {
            conversation = this.conv2Service.getOrCreateConv(users, false);
            if (conversation == null) {
                return pmc_mail_1.Q();
            }
        }
        this.notes2Plugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
        this.notes2Plugin.activeSinkHostHash = this.app.sessionManager.getLocalSession().hostHash;
        return pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(filesId, function () { return _this.getOrCreateConversation(conversation); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.notes2Plugin.activeFilesList = _this.activeFilesList;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION,
                conv2: conversation
            }, false);
            _this.activateFiles(filesId);
            _this.activeFilesList.loadFilePreview();
        });
    };
    FileChooserWindowController.prototype.getActiveId = function () {
        return this.activeFilesList ? this.activeFilesList.fileListId : null;
    };
    FileChooserWindowController.prototype.reloadAll = function () {
        return this.fsManager.refresh();
    };
    FileChooserWindowController.prototype.getOrCreateConversation = function (conversation) {
        var _this = this;
        var filesId = Notes2WindowController_1.Notes2WindowController.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        return pmc_mail_1.Q().then(function () {
            if (!(filesId in _this.filesLists)) {
                var collection_1 = _this.getOrCreateCollectionConversation(conversation);
                return _this.addFilesListComponent({ sessionType: "local" }, filesId, conversation.id, collection_1, {
                    type: FilesListController_1.FilesListType.CONVERSATION,
                    conversation: conversation,
                    section: null
                }, true, function () {
                    return conversation.fileTree ? conversation.fileTree.refreshDeep(true) : pmc_mail_1.Q();
                })
                    .then(function () {
                    return conversation.prepareFilesCollection().then(function () {
                        if (conversation.section) {
                            collection_1.refresh();
                        }
                    })
                        .fail(function (e) {
                        _this.getLogger().error("Error during preparing files", e);
                    });
                })
                    .then(function () {
                    return _this.filesLists[filesId];
                });
            }
            return _this.filesLists[filesId];
        });
    };
    FileChooserWindowController.prototype.onFilesSectionChange = function (session, event) {
        var _this = this;
        if (event.element != null) {
            if (event.element.hasFileModule()) {
                this.fsManager.addSectionAndInit(event.element, session).then(function (sec) {
                    if (sec != null) {
                        return _this.finishFileTreePreparation(sec, session.hostHash);
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
    };
    FileChooserWindowController.prototype.clearActive = function () {
        this.activeFilesList = null;
        this.callViewMethod("activateFiles", null, null);
    };
    FileChooserWindowController.prototype.finishFileTreePreparation = function (fsMgrEntry, hostHash, isConversation) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var ntree = fsMgrEntry.tree;
            var section = fsMgrEntry.section;
            var manager = _this.trees[ntree.root.ref.id];
            if (manager == null) {
                _this.trees[ntree.root.ref.id] = manager = _this.addComponent("fileTreeManager/" + ntree.root.ref.id, ntree);
                _this.filesBaseCollection.addCollection(ntree.collection);
            }
            if (section == _this.notes2Plugin.sectionManager.getMyPrivateSection()) {
                _this.myFileTreeManager = manager;
            }
            var collectionId;
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            if (isConversation) {
                var conversation_1 = session ? session.conv2Service.collection.find(function (x) { return x.section == section; }) : null;
                if (!conversation_1) {
                    return;
                }
                collectionId = Notes2WindowController_1.Notes2WindowController.getConversationId(session, conversation_1);
                return conversation_1.prepareFilesCollection().then(function () {
                    if (conversation_1.section) {
                        _this.channelsTrees[collectionId] = manager;
                        if (_this.collections[collectionId]) {
                            _this.collections[collectionId].refresh();
                        }
                    }
                });
            }
            else {
                collectionId = Notes2WindowController_1.Notes2WindowController.getChannelId(session, section);
                _this.channelsTrees[collectionId] = manager;
                if (_this.collections[collectionId]) {
                    _this.collections[collectionId].refresh();
                }
            }
        });
    };
    FileChooserWindowController.prototype.onViewSelect = function () {
        this.activeFilesList.chooseFile();
    };
    FileChooserWindowController.prototype.activateFiles = function (id) {
        this.activateList(this.activeFilesList);
        this.callViewMethod("activateFiles", id);
    };
    FileChooserWindowController.prototype.expandRemoteSectionsList = function (hostEntry) {
        var _this = this;
        var session;
        var hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        var checkSessionExists = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if (checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        pmc_mail_1.Q().then(function () {
            if (!checkSessionExists) {
                _this.sidebar.callViewMethod("showHostLoading", hostHash, true);
                return _this.app.sessionManager.createRemoteSession(hostEntry.host)
                    .then(function () {
                    return _this.app.sessionManager.init(hostHash);
                })
                    .fail(function () {
                    _this.sidebar.callViewMethod("showHostLoading", hostHash, false);
                    return _this.errorCallback;
                });
            }
        })
            .then(function () {
            session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            var tasksPlugin = _this.app.getComponent("tasks-plugin");
            return pmc_mail_1.Q.all([
                pmc_mail_1.Q.all(session.sectionManager.sectionsCollection.list
                    .filter(function (x) { return !x.isPrivateOrUserGroup(); })
                    .map(function (x) { return _this.fsManager.addSectionAndInit(x, session).then(function (y) { return y ? _this.finishFileTreePreparation(y, hostHash) : null; }); })),
                pmc_mail_1.Q.all(session.conv2Service.collection.list
                    .map(function (x) { return _this.fsManager.addConversationAndInit(x, session).then(function (y) { return y ? _this.finishFileTreePreparation(y, hostHash, true) : null; }); })),
                tasksPlugin ? tasksPlugin.ensureSessionProjectsInitialized(session) : pmc_mail_1.Q(),
            ]);
        })
            .then(function () {
            if (!_this.remoteServers) {
                _this.remoteServers = {};
            }
            _this.initRemoteHostComponents(hostEntry, session);
            _this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
        })
            .then(function () {
            _this.updateSidebarHostElement(session);
        })
            .fail(function (e) {
            console.log(e);
        });
    };
    FileChooserWindowController.prototype.checkRemoteHostComponentsInitialized = function (hostHash) {
        var ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    };
    FileChooserWindowController.prototype.initRemoteHostComponents = function (hostEntry, session) {
        var _this = this;
        var hostHash = session.hostHash;
        if (this.checkRemoteHostComponentsInitialized(hostHash)) {
            return;
        }
        var sectionsListOptions = {
            baseCollection: session.sectionManager.filteredCollection,
            unreadProvider: function (section) { return _this.getSectionUnread(session, section); },
            elementsCountProvider: function (section) { return _this.getRemoteSectionElementsCount(hostHash, section); },
            searchCountProvider: null,
            searchAllSearchedProvider: null,
            sorter: function (a, b) {
                var res = b.getFileMessageLastDate() - a.getFileMessageLastDate();
                return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            checkShowAllAvailSections: false,
            session: session
        };
        var conv2ListOptions = {
            unreadProvider: function (c2s) { return _this.getConversationUnread(session, c2s); },
            elementsCountProvider: function (c2s) { return _this.getRemoteConv2ElementsCount(hostHash, c2s); },
            searchCountProvider: null,
            searchAllSearchedProvider: null,
            withSpinnerProvider: null,
            session: session
        };
        var hostList = hostEntry;
        hostList.sectionList = this.addComponent("remoteSectionsList-" + hostHash, this.componentFactory.createComponent("remotesectionlist", [this, sectionsListOptions]));
        hostList.sectionList.ipcMode = true;
        hostList.conv2List = this.addComponent("remoteConv2List-" + hostHash, this.componentFactory.createComponent("remoteconv2list", [this, conv2ListOptions]));
        hostList.conv2List.ipcMode = true;
        this.remoteServers[hostHash] = hostList;
        this.sidebar.registerRemoteSectionsList(hostHash, hostList.sectionList);
        this.sidebar.registerRemoteConv2List(hostHash, hostList.conv2List);
    };
    FileChooserWindowController.prototype.getRemoteSectionElementsCount = function (hostHash, section) {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionChannel(hostHash, section).size());
    };
    FileChooserWindowController.prototype.getRemoteConv2ElementsCount = function (hostHash, conv2Section) {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionConversation(hostHash, conv2Section).size());
    };
    FileChooserWindowController.prototype.openRemoteChannel = function (hostHash, sectionId) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.init(hostHash);
        })
            .then(function () {
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            var section = session.sectionManager.getSection(sectionId);
            var filesId = Notes2WindowController_1.Notes2WindowController.getChannelId(session, section);
            if (_this.getActiveId() == filesId) {
                _this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION,
                    section: section,
                    hostHash: hostHash,
                }, false);
                _this.callViewMethod("toggleDisabledSection", !section.isFileModuleEnabled());
                return;
            }
            if (section == null) {
                return;
            }
            _this.notes2Plugin.activeSinkId = section.getChatSink().id;
            _this.notes2Plugin.activeSinkHostHash = session.hostHash;
            if (!section.isFileModuleEnabled()) {
                return;
            }
            return _this.singletonGetOrCreateFilesList(filesId, function () { return _this.getOrCreateRemoteChannel(hostHash, filesId, sectionId, section); })
                .then(function (newList) {
                _this.activeFilesList = newList;
                _this.notes2Plugin.activeFilesList = _this.activeFilesList;
                _this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION,
                    section: section,
                    hostHash: hostHash
                }, false);
                _this.activateFiles(filesId);
                _this.activeFilesList.loadFilePreview();
            });
        });
    };
    FileChooserWindowController.prototype.getOrCreateRemoteChannel = function (hostHash, id, sectionId, section) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var collectionId = Notes2WindowController_1.Notes2WindowController.getChannelId(session, section);
        return pmc_mail_1.Q().then(function () {
            if (!(id in _this.filesLists)) {
                return _this.fsManager.addSectionAndInit(section, session).then(function (sec) {
                    if (sec != null) {
                        return _this.finishFileTreePreparation(sec, hostHash);
                    }
                })
                    .then(function () {
                    var collection = _this.getOrCreateRemoteCollectionChannel(hostHash, section);
                    return _this.addFilesListComponent({ sessionType: "remote", hostHash: hostHash }, id, sectionId, collection, {
                        type: FilesListController_1.FilesListType.CHANNEL,
                        conversation: null,
                        section: section
                    }, _this.channelsTrees[collectionId] != null, function () {
                        return _this.channelsTrees[collectionId] ? _this.channelsTrees[collectionId].refreshDeep(true) : pmc_mail_1.Q();
                    });
                })
                    .then(function () {
                    return section.getChatSinkIndex().then(function () {
                        section.getChatModule().filesMessagesCollection.changeEvent.add(function () {
                            _this.sidebar.remoteSectionsLists[hostHash].sortedCollection.triggerBaseUpdateElement(section);
                            _this.updateSidebarHostElement(_this.app.sessionManager.getSessionByHostHash(hostHash));
                        }, "multi");
                    });
                })
                    .then(function () {
                    return _this.filesLists[id];
                });
            }
            return _this.filesLists[id];
        });
    };
    FileChooserWindowController.prototype.getOrCreateRemoteCollectionChannel = function (hostHash, section) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var collectionId = Notes2WindowController_1.Notes2WindowController.getChannelId(session, section);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        var sink = section.isChatModuleEnabled() ? section.getChatSink() : null;
        var sinkId = sink ? sink.id : null;
        var collection = this.collections[collectionId] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            if (Notes2Utils_1.Notes2Utils.isFsFileEntry(x)) {
                return x.tree == _this.channelsTrees[collectionId] && x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index.sink.id == sinkId;
        });
        collection.changeEvent.add(function () {
            _this.sidebar.remoteSectionsLists[hostHash].sortedCollection.triggerBaseUpdateElement(section);
            _this.updateSidebarHostElement(_this.app.sessionManager.getSessionByHostHash(hostHash));
        }, "multi");
        return collection;
    };
    FileChooserWindowController.prototype.openRemoteConversationView = function (hostHash, conversationId) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.init(hostHash);
        })
            .then(function () {
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            var users = session.conv2Service.getUsersFromConvId(conversationId);
            var conversation = session.conv2Service.collection.find(function (x) { return x.id == conversationId; });
            if (conversation == null) {
                conversation = session.conv2Service.getOrCreateConv(users, true);
                if (conversation == null) {
                    return pmc_mail_1.Q();
                }
            }
            var filesId = Notes2WindowController_1.Notes2WindowController.getConversationId(session, conversation);
            if (_this.getActiveId() == filesId) {
                return pmc_mail_1.Q();
            }
            _this.notes2Plugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
            _this.notes2Plugin.activeSinkHostHash = session.hostHash;
            return pmc_mail_1.Q().then(function () {
                return _this.singletonGetOrCreateFilesList(filesId, function () { return _this.getOrCreateRemoteConversation(hostHash, conversation); });
            })
                .then(function (list) {
                _this.activeFilesList = list;
                _this.notes2Plugin.activeFilesList = _this.activeFilesList;
                _this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                    conv2: conversation,
                    hostHash: hostHash,
                }, false);
                _this.activateFiles(filesId);
                _this.activeFilesList.loadFilePreview();
            });
        });
    };
    FileChooserWindowController.prototype.getOrCreateRemoteConversation = function (hostHash, conversation) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        return pmc_mail_1.Q().then(function () {
            var id = Notes2WindowController_1.Notes2WindowController.getConversationId(session, conversation);
            if (!(id in _this.filesLists)) {
                var collection_2 = null;
                return _this.fsManager.addConversationAndInit(conversation, session).then(function (sec) {
                    if (sec != null) {
                        return _this.finishFileTreePreparation(sec, hostHash);
                    }
                })
                    .then(function () {
                    collection_2 = _this.getOrCreateRemoteCollectionConversation(hostHash, conversation);
                    return _this.addFilesListComponent({ sessionType: "remote", hostHash: hostHash }, id, conversation.id, collection_2, {
                        type: FilesListController_1.FilesListType.CONVERSATION,
                        conversation: conversation,
                        section: null,
                    }, true, function () {
                        return conversation.fileTree ? conversation.fileTree.refreshDeep(true) : pmc_mail_1.Q();
                    });
                })
                    .then(function () {
                    return conversation.prepareFilesCollection().then(function () {
                        if (conversation.section) {
                            collection_2.refresh();
                        }
                    })
                        .fail(function (e) {
                        _this.getLogger().error("Error during preparing files", e);
                    });
                })
                    .then(function () {
                    return _this.filesLists[id];
                });
            }
            return _this.filesLists[id];
        });
    };
    FileChooserWindowController.prototype.getOrCreateRemoteCollectionConversation = function (hostHash, conversation) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var id = Notes2WindowController_1.Notes2WindowController.getConversationId(session, conversation);
        if (this.collections[id]) {
            return this.collections[id];
        }
        var collection = this.collections[id] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            if (Notes2Utils_1.Notes2Utils.isFsFileEntry(x)) {
                return x.tree == conversation.fileTree && x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index == conversation.sinkIndex;
        });
        conversation.prepareFilesCollection().then(function () {
            if (conversation.section) {
                collection.refresh();
            }
        });
        collection.changeEvent.add(function () {
            _this.sidebar.remoteConv2Lists[hostHash].sortedCollection.triggerBaseUpdateElement(conversation);
            _this.updateSidebarHostElement(_this.app.sessionManager.getSessionByHostHash(hostHash));
        }, "multi");
        return collection;
    };
    FileChooserWindowController.prototype.updateSidebarHostElement = function (session) {
        if (this.app.sessionManager.getLocalSession() == session) {
            return;
        }
        var element = this.sidebar.hostList.hostsSortedCollection.find(function (x) { return x.host == session.host; });
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    };
    FileChooserWindowController.prototype.isLocalEntry = function (entry) {
        return Notes2Utils_1.Notes2Utils.isEntryFromSession(entry, this.app.sessionManager.getLocalSession());
    };
    FileChooserWindowController.textsPrefix = "plugin.notes2.window.filechooser.";
    __decorate([
        Inject
    ], FileChooserWindowController.prototype, "collectionFactory", void 0);
    __decorate([
        Inject
    ], FileChooserWindowController.prototype, "messagesCollection", void 0);
    FileChooserWindowController = __decorate([
        Dependencies(["notes2filelist", "persons", "splitter", "extlist", "notification", "conv2list", "sectionlist"])
    ], FileChooserWindowController);
    return FileChooserWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.FileChooserWindowController = FileChooserWindowController;
FileChooserWindowController.prototype.className = "com.privmx.plugin.notes2.window.filechooser.FileChooserWindowController";

//# sourceMappingURL=FileChooserWindowController.js.map
