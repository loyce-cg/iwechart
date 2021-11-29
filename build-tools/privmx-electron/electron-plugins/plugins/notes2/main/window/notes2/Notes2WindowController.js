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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Notes2Utils_1 = require("../../main/Notes2Utils");
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var FilesListController_1 = require("../../component/fileslist/FilesListController");
var Common_1 = require("../../main/Common");
var LocalFS_1 = require("../../main/LocalFS");
var i18n_1 = require("./i18n");
var ViewSettings_1 = require("../../main/ViewSettings");
;
var FsManagerEntry = (function () {
    function FsManagerEntry(section) {
        this.section = section;
    }
    FsManagerEntry.prototype.setTree = function (tree) {
        this.tree = tree;
        this.fs = this.tree.fileSystem;
    };
    FsManagerEntry.prototype.checkTrash = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (!_this.fs.root.entries.hasName(Common_1.FilesConst.TRASH_ENTRY)) {
                return _this.fs.mkdir(Common_1.FilesConst.TRASH_PATH).thenResolve(null);
            }
        });
    };
    FsManagerEntry.prototype.refresh = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.tree.refreshDeep(true);
        });
    };
    return FsManagerEntry;
}());
exports.FsManagerEntry = FsManagerEntry;
var FsManager = (function () {
    function FsManager(manager) {
        this.manager = manager;
        this.specialDirectory = new pmc_mail_1.privfs.fs.file.entry.SpecialDirectory(manager);
        this.sections = {};
    }
    FsManager.prototype.addSection = function (section, session) {
        if (section == null || !section.hasFileModule()) {
            return;
        }
        var collectionId = Notes2WindowController.getChannelId(session, section);
        if (this.sections[collectionId] == null) {
            this.sections[collectionId] = new FsManagerEntry(section);
        }
    };
    FsManager.prototype.addSectionAndInit = function (section, session) {
        var _this = this;
        if (section == null || !section.hasFileModule()) {
            return pmc_mail_1.Q(null);
        }
        var collectionId = Notes2WindowController.getChannelId(session, section);
        var sec = this.sections[collectionId];
        if (sec != null) {
            return pmc_mail_1.Q(null);
        }
        sec = this.sections[collectionId] = new FsManagerEntry(section);
        return pmc_mail_1.Q().then(function () {
            return sec.section.getFileModule().getFileTree();
        })
            .then(function (ft) {
            _this.specialDirectory.directories.push(sec.section.getFileModule().fileSystem.root);
            sec.setTree(ft);
            return ft.refreshDeep(true);
        })
            .then(function () {
            return sec.checkTrash();
        })
            .thenResolve(sec);
    };
    FsManager.prototype.addConversation = function (c2s, session) {
        if (c2s == null || !c2s.section || !c2s.section.hasFileModule()) {
            return;
        }
        var collectionId = Notes2WindowController.getConversationId(session, c2s);
        if (this.sections[collectionId] == null) {
            this.sections[collectionId] = new FsManagerEntry(c2s.section);
        }
    };
    FsManager.prototype.addConversationAndInit = function (c2s, session) {
        var _this = this;
        if (c2s == null || !c2s.section || !c2s.section.hasFileModule()) {
            return pmc_mail_1.Q(null);
        }
        var collectionId = Notes2WindowController.getConversationId(session, c2s);
        var sec = this.sections[collectionId];
        if (sec != null) {
            return pmc_mail_1.Q(null);
        }
        sec = this.sections[collectionId] = new FsManagerEntry(c2s.section);
        return pmc_mail_1.Q().then(function () {
            return sec.section.getFileModule().getFileTree();
        })
            .then(function (ft) {
            _this.specialDirectory.directories.push(sec.section.getFileModule().fileSystem.root);
            sec.setTree(ft);
            return ft.refreshDeep(true);
        })
            .then(function () {
            return sec.checkTrash();
        })
            .thenResolve(sec);
    };
    FsManager.prototype.init = function () {
        var _this = this;
        var sections = pmc_mail_1.utils.Lang.getValues(this.sections);
        return pmc_mail_1.Q().then(function () {
            return new pmc_mail_1.privfs.fs.descriptor.DescriptorMultiGet(_this.manager).perform(sections.map(function (sec) { return sec.section.getFileModule().getFileSystemZ(); }));
        })
            .then(function () {
            sections.forEach(function (sec) {
                _this.specialDirectory.directories.push(sec.section.getFileModule().fileSystem.root);
            });
            return _this.specialDirectory.refreshDeep(true);
        })
            .then(function () {
            return pmc_mail_1.Q.all(sections.map(function (sec) { return sec.section.getFileModule().getFileTree().then(function (ft) {
                sec.setTree(ft);
            }); }));
        })
            .then(function () {
            return pmc_mail_1.Q.all(pmc_mail_1.utils.Lang.getValues(_this.sections).map(function (x) { return x.checkTrash(); }));
        })
            .thenResolve(null);
    };
    FsManager.prototype.refresh = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            pmc_mail_1.utils.Lang.getValues(_this.sections).forEach(function (x) {
                x.tree.processLastVersionEvents = false;
            });
            return _this.specialDirectory.refreshDeep(true);
        })
            .fin(function () {
            pmc_mail_1.utils.Lang.getValues(_this.sections).forEach(function (x) {
                x.tree.sync();
                x.tree.processLastVersionEvents = true;
            });
        });
    };
    return FsManager;
}());
exports.FsManager = FsManager;
var Notes2WindowController = (function (_super) {
    __extends(Notes2WindowController, _super);
    function Notes2WindowController(parentWindow) {
        var _this = _super.call(this, parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "splitter-vertical": { defaultValue: 340 },
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({ handlePos: 250, totalSize: 1000 }) },
                "left-panel-people-splitter": { defaultValue: 500 },
                "files-vertical-splitter": { defaultValue: 500 },
                "local-fs-initial-path": { defaultValue: "" }
            }
        }) || this;
        _this.editorsId = 0;
        _this.reusableEditors = {};
        _this.collections = {};
        _this.searchCounts = {};
        _this.isSearchOn = false;
        _this.currPreviewTrashedInfoModelStr = null;
        _this.pendingGetOrCreateFilesList = {};
        _this.sessionsByCollectionName = {};
        _this.isHostLoaded = {};
        _this.ipcMode = true;
        _this.notificationId = 0;
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.setPluginViewAssets("notes2");
        _this.openWindowOptions.fullscreen = true;
        _this.openWindowOptions.cssClass = "app-window";
        _this.openWindowOptions.title = _this.i18n("plugin.notes2.window.notes2.title");
        _this.filesLists = {};
        _this.channelsTrees = {};
        _this.trees = {};
        _this.ipcMode = true;
        _this.sectionTooltip = _this.addComponent("sectiontooltip", _this.componentFactory.createComponent("sectiontooltip", [_this]));
        _this.enableTaskBadgeAutoUpdater();
        return _this;
    }
    Notes2WindowController_1 = Notes2WindowController;
    Notes2WindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    Notes2WindowController.prototype.init = function () {
        var _this = this;
        var localSession = this.app.sessionManager.getLocalSession();
        return this.app.mailClientApi.checkLoginCore().then(function () {
            var tasksPlugin = _this.app.getComponent("tasks-plugin");
            if (tasksPlugin) {
                return tasksPlugin.projectsReady;
            }
        }).then(function () {
            return _this.notes2Plugin.loadedDeferred.promise;
        }).then(function () {
            _this.fsManager = new FsManager(_this.client.descriptorManager);
            _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
            _this.filesBaseCollection = _this.addComponent("filesBaseCollection", new pmc_mail_1.utils.collection.MergedCollection());
            _this.filesBaseCollection.addCollection(_this.collectionFactory.getAttachmentsCollectionByBaseCollection("all-messages", _this.messagesCollection));
            _this.localFilesBaseCollection = _this.addComponent("localFilesBaseCollection", new pmc_mail_1.utils.collection.MutableCollection());
            if (_this.app.isElectronApp()) {
                _this.localFsInitialPathSetting = _this.settings.create("local-fs-initial-path");
                LocalFS_1.LocalFS.staticConstructor(_this.app);
            }
            _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
            _this.verticalSplitter = _this.addComponent("verticalSplitter", _this.componentFactory.createComponent("splitter", [_this, _this.settings.create("splitter-vertical")]));
            _this.verticalSplitter.ipcMode = true;
            _this.filesVerticalSplitter = _this.addComponent("filesVerticalSplitter", _this.componentFactory.createComponent("splitter", [_this, _this.settings.create("files-vertical-splitter")]));
            _this.disabledSection = _this.addComponent("disabled-section", _this.componentFactory.createComponent("disabledsection", [_this, pmc_mail_1.Types.section.NotificationModule.NOTES2]));
            _this.loading = _this.addComponent("loading", _this.componentFactory.createComponent("loading", [_this]));
            _this.filesVerticalSplitter.ipcMode = true;
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
            return pmc_mail_1.Q.all([
                _this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                _this.sectionManager.isSectionsLimitReached()
            ]);
        })
            .then(function (res) {
            var identityProvider = res[0], isSectionsLimitReached = res[1];
            _this.notes2Plugin.sectionManager.dumpFileSystems().fail(_this.errorCallback);
            var intervalId = setInterval(function () {
                if (_this.notes2Plugin.sectionManager) {
                    _this.notes2Plugin.sectionManager.dumpFileSystems().fail(_this.errorCallback);
                }
            }, 5 * 60 * 1000);
            _this.notes2Plugin.onReset.promise.then(function () {
                clearInterval(intervalId);
            });
            var priv = _this.notes2Plugin.sectionManager.getMyPrivateSection();
            var filteredRootsCollection = _this.addComponent("filteredRootsCollection", new pmc_mail_1.utils.collection.FilteredCollection(_this.notes2Plugin.files2Sections[localSession.hostHash], function (x) { return x != priv && x.isVisible() && x.hasAccess(); }));
            var customElements = [];
            if (priv != null) {
                customElements.push({
                    id: FilesListController_1.FilesListController.MY_FILES,
                    icon: {
                        type: "hashmail",
                        value: _this.identity.hashmail
                    },
                    label: _this.i18n("plugin.notes2.window.notes2.filter.my"),
                    private: true
                });
            }
            customElements.push({
                id: FilesListController_1.FilesListController.ALL_FILES,
                icon: {
                    type: "fa",
                    value: "privmx-icon privmx-icon-notes2",
                },
                label: _this.i18n("plugin.notes2.window.notes2.filter.all"),
                private: false
            }, {
                id: FilesListController_1.FilesListController.TRASH_FILES,
                icon: {
                    type: "fa",
                    value: "ico-bin"
                },
                label: _this.i18n("plugin.notes2.window.notes2.filter.trash"),
                private: false
            });
            var customElementCollection = _this.addComponent("cEleColl", new pmc_mail_1.utils.collection.MutableCollection(customElements));
            if (_this.app.isElectronApp()) {
                var computerName = _this.i18n("plugin.notes2.window.notes2.filter.local", _this.app.getSystemLabel());
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
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: customElementCollection,
                    unreadProvider: function (ce) { return _this.getCustomElementUnread(ce); },
                    elementsCountProvider: function (ce) { return _this.getCustomElementElementsCount(ce); },
                    searchCountProvider: function (ce) { return _this.getCustomElementSearchCount(ce); },
                    withSpinnerProvider: function (ce) { return _this.getCustomElementWithSpinner(ce); },
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    searchCountProvider: function (c2s) { return _this.getConv2ListSearchCount(localSession, c2s); },
                    searchAllSearchedProvider: null,
                    unreadProvider: function (c2s) { return _this.getConversationUnread(localSession, c2s); },
                    elementsCountProvider: function (c2s) { return _this.getConv2ElementsCount(localSession, c2s); },
                    withSpinnerProvider: function (c2s) { return _this.getConv2WithSpinner(localSession, c2s); },
                    sorter: function (a, b) {
                        return b.getFileMessageLastDate() - a.getFileMessageLastDate();
                    },
                },
                sectionList: {
                    baseCollection: filteredRootsCollection,
                    unreadProvider: function (section) { return _this.getSectionUnread(localSession, section); },
                    elementsCountProvider: function (section) { return _this.getSectionElementsCount(localSession, section); },
                    searchCountProvider: function (section) { return _this.getSectionSearchCount(localSession, section); },
                    withSpinnerProvider: function (section) { return _this.getSectionWithSpinner(localSession, section); },
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
                    sorter: null,
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: pmc_mail_1.component.remotehostlist.ElementCountsAggregationStrategy.SECTIONS | pmc_mail_1.component.remotehostlist.ElementCountsAggregationStrategy.CONVERSATIONS,
                },
                conv2ListEnabled: true,
                conv2Splitter: _this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: []
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push({
                    id: "new-section",
                    label: _this.i18n("plugin.notes2.window.notes2.sidebar.newsection"),
                    title: _this.i18n("plugin.notes2.window.notes2.sidebar.newsection"),
                    icon: "ico-comment",
                    windowOpener: true,
                    onSectionList: true
                });
            }
            _this.sidebarOptions = sidebarOptions;
            _this.sidebar = _this.addComponent("sidebar", _this.componentFactory.createComponent("sidebar", [_this, sidebarOptions]));
            _this.sidebar.addEventListener("elementbeforeactivate", _this.onBeforeActivateSidebarElement.bind(_this));
            _this.sidebar.addEventListener("sidebarbuttonaction", _this.onSidebarButtonAction.bind(_this));
            _this.sidebar.usersListTooltip.getContent = function (sectionId) {
                return _this.app.getUsersListTooltipContent(_this.app.sessionManager.getLocalSession(), sectionId);
            };
            _this.app.addEventListener("sectionsLimitReached", function (event) {
                _this.sidebar.onSectionsLimitReached(event.reached);
            });
            _this.sectionManager.sectionAccessManager.eventDispatcher.addEventListener("section-state-changed", function (event) {
                if (_this.activeFilesList && _this.activeFilesList.filesInfo && _this.activeFilesList.filesInfo.type == FilesListController_1.FilesListType.CHANNEL && _this.activeFilesList.filesInfo.section.getId() == event.sectionId) {
                    pmc_mail_1.Q().then(function () {
                        return _this.sectionManager.load();
                    })
                        .then(function () {
                        var section = _this.sectionManager.getSection(event.sectionId);
                        var moduleEnabled = section.isChatModuleEnabled();
                        if (!moduleEnabled) {
                            _this.openDisabledSectionView(section);
                        }
                        else {
                            _this.openChannel(event.sectionId);
                        }
                    });
                }
            }, "chat");
            _this.app.addEventListener("reopen-section", function (event) {
                _this.openChannel(event.element.getId());
            });
            _this.app.addEventListener("focusChanged", function (event) {
                var windowId = event.windowId;
                _this.notes2Plugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? _this.parent.activeModel.get() : windowId;
                if (windowId == "notes2" || (windowId == "main-window" && _this.parent.activeModel.get() == "notes2")) {
                    setTimeout(function () {
                        _this.callViewMethod("grabFocus", true);
                    }, 200);
                }
            });
            _this.app.addEventListener("focusLost", function (event) {
                _this.notes2Plugin.activeWindowFocused = null;
            });
            _this.app.addEventListener("onToggleMaximize-notify", function () {
                setTimeout(function () {
                    _this.callViewMethod("grabFocus", false);
                }, 10);
            });
            _this.app.addEventListener("binded-enter-pressed", function () {
                if (_this.parent.activeModel.get() == "notes2") {
                    _this.activeFilesList.openExternalFile();
                }
            });
            _this.app.addEventListener("update-notes2-sidebar-spinners", function (e) {
                _this.sidebar.updateSidebarSpinners({
                    conv2SectionId: e.conv2SectionId,
                    customElementId: e.customElementId,
                    sectionId: e.sectionId,
                    hosts: e.hostHash ? [_this.app.sessionManager.getSessionByHostHash(e.hostHash).host] : Object.values(_this.app.sessionManager.sessions).map(function (x) { return x.host; }),
                });
            }, "notes2");
            _this.app.addEventListener("requestopenfiles", function (event) {
                var hashmails = event.hashmails.filter(function (x) { return _this.personService.getPerson(x) != null && _this.personService.getPerson(x).contact != null; });
                if (hashmails.length == 0) {
                    _this.alert(_this.i18n("plugin.notes2.window.notes2.cantCreateConversationWithoutUsers"));
                    return;
                }
                if (event.showContactsWindow) {
                    _this.openNewFiles(hashmails);
                }
                else {
                    _this.openConversationViewFromHashmails(hashmails);
                }
            }, "chat");
            _this.createCollections();
            _this.searchCountFilterUpdater = new FilesListController_1.FilesFilterUpdater();
            _this.searchCountFilterUpdater.onUpdate = _this.updateSearchCounts.bind(_this);
            _this.registerChangeEvent(_this.app.searchModel.changeEvent, _this.onFilterFiles.bind(_this), "multi");
            if (_this.app.searchModel.data.visible && _this.app.searchModel.data.value != "") {
                _this.onFilterFiles();
            }
            _this.app.addEventListener("update-files-section-badge", function (event) {
                if (event.sectionId == FilesListController_1.FilesListController.TRASH_FILES || event.sectionId == FilesListController_1.FilesListController.ALL_FILES) {
                    var idx = _this.sidebarOptions.customElementList.baseCollection.indexOfBy(function (el) { return el.id == event.sectionId; });
                    if (idx >= 0) {
                        _this.sidebarOptions.customElementList.baseCollection.triggerUpdateAt(idx);
                    }
                }
                else if (!event.hostHash || event.hostHash == localSession.hostHash) {
                    var idx = _this.sidebar.sectionList.sectionsCollection.indexOfBy(function (el) { return el.getId() == event.sectionId; });
                    if (idx >= 0) {
                        _this.sidebar.sectionList.sectionsCollection.triggerBaseUpdateAt(idx);
                    }
                    else {
                        var idx_1 = _this.sidebar.conv2List.sortedCollection.indexOfBy(function (el) { return el.section && el.section.getId() == event.sectionId; });
                        if (idx_1 >= 0) {
                            _this.sidebar.conv2List.sortedCollection.triggerBaseUpdateElement(_this.sidebar.conv2List.sortedCollection.get(idx_1));
                        }
                    }
                }
                else {
                    var remoteSectionsList = _this.sidebar.remoteSectionsLists[event.hostHash];
                    var remoteConversationList = _this.sidebar.remoteConv2Lists[event.hostHash];
                    var idx = remoteSectionsList ? remoteSectionsList.sectionsCollection.indexOfBy(function (el) { return el.getId() == event.sectionId; }) : -1;
                    if (idx >= 0) {
                        remoteSectionsList.sectionsCollection.triggerBaseUpdateAt(idx);
                    }
                    else {
                        var idx_2 = remoteConversationList ? remoteConversationList.sortedCollection.indexOfBy(function (el) { return el.section && el.section.getId() == event.sectionId; }) : -1;
                        if (idx_2 >= 0) {
                            remoteConversationList.sortedCollection.triggerBaseUpdateElement(remoteConversationList.sortedCollection.get(idx_2));
                        }
                    }
                    var session = _this.app.sessionManager.getSessionByHostHash(event.hostHash);
                    _this.updateSidebarHostElement(session);
                }
            });
            _this.app.addEventListener("update-notes2-setting", function (event) {
                if (event.setting == ViewSettings_1.ViewSettings.SHOW_FILE_PREVIEW && _this.lastPreviewRequestEvent) {
                    _this.processPreviewRequestEvent(_this.lastPreviewRequestEvent).fin(function () {
                        _this.callViewMethod("updateSetting", event.setting, event.value == 1);
                    });
                }
                else {
                    _this.callViewMethod("updateSetting", event.setting, event.value == 1);
                }
                if (event.setting == ViewSettings_1.ViewSettings.SHOW_FILE_PREVIEW) {
                    if (event.value == 1) {
                        if (_this.reusableOpener && _this.reusableOpener.win && ("afterShowIframe" in _this.reusableOpener.win)) {
                            _this.reusableOpener.win.afterShowIframe();
                        }
                    }
                    else {
                        if (_this.dockedEditor && ("afterIframeHide" in _this.dockedEditor)) {
                            _this.dockedEditor.afterIframeHide();
                        }
                    }
                }
            });
            _this.app.dispatchEvent({ type: "focusChanged", windowId: "notes2" });
        });
    };
    Notes2WindowController.prototype.openDefaultSection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var firstLoginSectionId, handled, priv;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        handled = false;
                        priv = this.notes2Plugin.sectionManager.getMyPrivateSection();
                        if (!this.notes2Plugin.isFirstLogin()) return [3, 2];
                        this.notes2Plugin.setFirstLoginDone();
                        this.notes2Plugin.sectionManager.sectionsCollection.list.forEach(function (section) {
                            if (section.secured && section.secured.extraOptions && section.secured.extraOptions.openOnFirstLogin) {
                                firstLoginSectionId = section.getId();
                                return;
                            }
                        });
                        if (!(firstLoginSectionId && this.notes2Plugin.sectionManager.getSection(firstLoginSectionId))) return [3, 2];
                        return [4, this.openChannel(firstLoginSectionId)];
                    case 1:
                        _a.sent();
                        this.sidebar.setActive({
                            type: pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
                            section: this.notes2Plugin.sectionManager.getSection(firstLoginSectionId),
                        }, true);
                        this.activateFiles(firstLoginSectionId);
                        this.activeFilesList.loadFilePreview();
                        handled = true;
                        _a.label = 2;
                    case 2:
                        if (handled) {
                            return [2];
                        }
                        if (!priv) return [3, 4];
                        return [4, this.openMy()];
                    case 3:
                        _a.sent();
                        return [3, 6];
                    case 4: return [4, this.openAll()];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [2];
                }
            });
        });
    };
    Notes2WindowController.prototype.openNewFiles = function (hashmails) {
        var _this = this;
        if (hashmails === void 0) { hashmails = []; }
        this.app.ioc.create(pmc_mail_1.window.selectcontacts.SelectContactsWindowController, [this, {
                message: this.i18n("plugin.notes2.window.notes2.selectContacts.header.newChat.text"),
                editable: true,
                hashmails: hashmails,
                fromServerUsers: true
            }])
            .then(function (win) {
            var singletonSuffix = !hashmails || hashmails.length == 0 || !_this.activeFilesList ? "new-conv2" : _this.activeFilesList.fileListId;
            _this.app.openSingletonWindow("selectContacts-" + singletonSuffix, win);
            win.getPromise().then(function (hashmails) {
                _this.openConversationViewFromHashmails(hashmails);
            });
        });
    };
    Notes2WindowController.prototype.onFilesSectionChange = function (session, event) {
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
    Notes2WindowController.prototype.finishFileTreePreparation = function (fsMgrEntry, hostHash, isConversation) {
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
                collectionId = Notes2WindowController_1.getConversationId(session, conversation_1);
                return conversation_1.prepareFilesCollection().then(function () {
                    if (conversation_1.section) {
                        _this.channelsTrees[collectionId] = manager;
                        _this.sessionsByCollectionName[collectionId] = session;
                        if (_this.collections[collectionId]) {
                            _this.collections[collectionId].refresh();
                        }
                    }
                });
            }
            else {
                collectionId = Notes2WindowController_1.getChannelId(session, section);
                _this.channelsTrees[collectionId] = manager;
                _this.sessionsByCollectionName[collectionId] = session;
                if (_this.collections[collectionId]) {
                    _this.collections[collectionId].refresh();
                }
            }
        });
    };
    Notes2WindowController.prototype.getModel = function () {
        return {
            activeId: this.getActiveId(),
            hashmail: this.identity.hashmail,
            iframeId: this.dockedEditor && this.reusableOpener ? this.reusableOpener.iframeId : null,
            iframeLoad: this.dockedEditor && this.reusableOpener ? this.reusableOpener.load : null,
            directory: this.directoryModel,
            showLocalFS: this.app.isElectronApp(),
            showFilePreview: this.showFilePreview(),
        };
    };
    Notes2WindowController.prototype.getActiveId = function () {
        return this.activeFilesList ? this.activeFilesList.fileListId : null;
    };
    Notes2WindowController.prototype.showFilePreview = function () {
        var fileListId = this.activeFilesList ? this.activeFilesList.fileListId : null;
        return this.notes2Plugin.getSetting(this.app.sessionManager.getLocalSession(), ViewSettings_1.ViewSettings.SHOW_FILE_PREVIEW, fileListId, Common_1.ViewContext.Notes2Window) == 1;
    };
    Notes2WindowController.prototype.onViewLoad = function () {
        var activeId = this.getActiveId();
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
    };
    Notes2WindowController.prototype.onViewActivatePreview = function () {
        if (this.dockedEditor) {
            this.dockedEditor.onNwinFocus();
        }
    };
    Notes2WindowController.prototype.onViewDragDrop = function (fileHandle) {
        if (this.activeFilesList.filesInfo.type == FilesListController_1.FilesListType.CONVERSATION) {
            var conversation = this.activeFilesList.filesInfo.conversation;
            if (conversation.hasDeletedUserOnly()) {
                return;
            }
        }
        this.activeFilesList.processDragDrop(fileHandle);
    };
    Notes2WindowController.prototype.onViewRefresh = function () {
        if (this.activeFilesList) {
            this.activeFilesList.refreshTree(undefined, true);
        }
    };
    Notes2WindowController.prototype.reloadAll = function () {
        return this.fsManager.refresh();
    };
    Notes2WindowController.prototype.applyHistoryState = function (processed, state) {
        var context = this.contextHistory.getCurrent();
        var oldActive = this.activeFilesList;
        var handled = false;
        if (context) {
            if (this.app.switchModuleWithContext() || state) {
                if (context.getType() == "section") {
                    var contextSection = this.notes2Plugin.sectionManager.getSection(context.getSectionIdFromContextId());
                    if (contextSection && contextSection.isFileModuleEnabled()) {
                        this.openChannel(contextSection.getId());
                        handled = true;
                    }
                }
                else if (context.getType() == "conversation") {
                    this.openConversationView(context.getContextId());
                    handled = true;
                }
                else if (context.getType() == "custom") {
                    if (context.getContextId() == FilesListController_1.FilesListController.MY_FILES) {
                        this.openMy();
                        handled = true;
                    }
                    else if (context.getContextId() == FilesListController_1.FilesListController.LOCAL_FILES) {
                        this.openLocal();
                        handled = true;
                    }
                    else if (context.getContextId() == FilesListController_1.FilesListController.ALL_FILES) {
                        this.openAll();
                        handled = true;
                    }
                    else if (context.getContextId() == FilesListController_1.FilesListController.TRASH_FILES) {
                        this.openTrash();
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
        }
        if (handled) {
            return;
        }
        this.openDefaultSection();
    };
    Notes2WindowController.prototype.onChildTabSwitch = function (child, shiftKey, ctrlKey) {
        _super.prototype.onChildTabSwitch.call(this, child, shiftKey, ctrlKey);
        if (!ctrlKey) {
            this.focusMe();
            this.callViewMethod("switchPanelFromPreview", shiftKey);
        }
    };
    Notes2WindowController.prototype.onSidebarButtonAction = function (event) {
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }
    };
    Notes2WindowController.prototype.openSectionsWindow = function () {
        this.app.openNewSectionDialogFromSidebar();
    };
    Notes2WindowController.prototype.addFilesListComponent = function (sessionInfo, id, destination, collection, filesInfo, editable, onRefresh) {
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
            return filesList.setComponentData(id, destination, collection, filesInfo, editable, onRefresh, localFS);
        })
            .then(function () {
            filesList.addEventListener("fileremoved", function (event) {
                event.result = _this.closeDockedEditor().thenResolve(null);
            });
            filesList.addEventListener("previewrequest", function (event) {
                _this.lastPreviewRequestEvent = event;
                if (!_this.showFilePreview()) {
                    return;
                }
                _this.processPreviewRequestEvent(event);
            });
            return filesList;
        });
    };
    Notes2WindowController.prototype.singletonGetOrCreateFilesList = function (key, creatorFunc) {
        if (!(key in this.pendingGetOrCreateFilesList)) {
            this.pendingGetOrCreateFilesList[key] = creatorFunc();
        }
        return this.pendingGetOrCreateFilesList[key];
    };
    Notes2WindowController.prototype.processPreviewRequestEvent = function (event) {
        var session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
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
        return pmc_mail_1.Q();
    };
    Notes2WindowController.prototype.getOrCreateMy = function () {
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
    Notes2WindowController.prototype.getOrCreateCollectionMy = function () {
        var _this = this;
        if (this.collections[FilesListController_1.FilesListController.MY_FILES]) {
            return this.collections[FilesListController_1.FilesListController.MY_FILES];
        }
        var tree = this.myFileTreeManager;
        this.sessionsByCollectionName[FilesListController_1.FilesListController.MY_FILES] = this.app.sessionManager.getLocalSession();
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
    Notes2WindowController.prototype.openMy = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.MY_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        return pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateMy(); });
        })
            .then(function (my) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                contextType: "custom",
                contextId: id,
                hostHash: _this.app.sessionManager.getLocalSession().hostHash
            });
            _this.contextHistory.append(context);
            _this.activeFilesList = my;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.activateFiles(id);
            _this.activeFilesList.loadFilePreview();
        });
    };
    Notes2WindowController.prototype.getOrCreateAll = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.ALL_FILES;
        var context = pmc_mail_1.app.common.Context.create({
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            contextType: "custom",
            contextId: id,
            hostHash: this.app.sessionManager.getLocalSession().hostHash
        });
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
    Notes2WindowController.prototype.getOrCreateCollectionAll = function () {
        var _this = this;
        if (this.collections[FilesListController_1.FilesListController.ALL_FILES]) {
            return this.collections[FilesListController_1.FilesListController.ALL_FILES];
        }
        this.sessionsByCollectionName[FilesListController_1.FilesListController.ALL_FILES] = this.app.sessionManager.getLocalSession();
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
    Notes2WindowController.prototype.openAll = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.ALL_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        var context = pmc_mail_1.app.common.Context.create({
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            contextType: "custom",
            contextId: id,
            hostHash: this.app.sessionManager.getLocalSession().hostHash
        });
        return pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateAll(); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.activateFiles(id);
            _this.activeFilesList.loadFilePreview();
        });
    };
    Notes2WindowController.prototype.getOrCreateLocal = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.LOCAL_FILES;
        var context = pmc_mail_1.app.common.Context.create({
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            contextType: "custom",
            contextId: id,
            hostHash: this.app.sessionManager.getLocalSession().hostHash
        });
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
    Notes2WindowController.prototype.openLocal = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.LOCAL_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        var context = pmc_mail_1.app.common.Context.create({
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            contextType: "custom",
            contextId: id,
            hostHash: this.app.sessionManager.getLocalSession().hostHash
        });
        return pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateLocal(); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.activateFiles(id);
            _this.activeFilesList.loadFilePreview();
        });
    };
    Notes2WindowController.prototype.getOrCreateChannel = function (id, sectionId, section) {
        var _this = this;
        var collectionId = Notes2WindowController_1.getChannelId(this.app.sessionManager.getLocalSession(), section);
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
    Notes2WindowController.prototype.getOrCreateCollectionChannel = function (section) {
        var _this = this;
        var collectionId = Notes2WindowController_1.getChannelId(this.app.sessionManager.getLocalSession(), section);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        var sink = section.isChatModuleEnabled() ? section.getChatSink() : null;
        var sinkId = sink ? sink.id : null;
        this.sessionsByCollectionName[collectionId] = this.app.sessionManager.getLocalSession();
        var collection = this.collections[collectionId] = new pmc_mail_1.utils.collection.FilteredCollection(this.filesBaseCollection, function (x) {
            if (Notes2Utils_1.Notes2Utils.isFsFileEntry(x)) {
                return x.tree == _this.channelsTrees[collectionId] && x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path);
            }
            return x.entry.index.sink.id == sinkId;
        });
        collection.changeEvent.add(function () {
            _this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
        }, "multi");
        return collection;
    };
    Notes2WindowController.prototype.openChannel = function (sectionId) {
        var _this = this;
        var section = this.notes2Plugin.sectionManager.getSection(sectionId);
        var filesId = Notes2WindowController_1.getChannelId(this.app.sessionManager.getLocalSession(), section);
        var context = pmc_mail_1.app.common.Context.create({
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            contextType: "section",
            contextId: "section:" + sectionId,
            hostHash: this.app.sessionManager.getLocalSession().hostHash
        });
        this.contextHistory.append(context);
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
        this.notes2Plugin.activeSinkHostHash = this.app.sessionManager.getLocalSession().hostHash;
        if (!section.isFileModuleEnabled()) {
            this.openDisabledSectionView(section);
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
    Notes2WindowController.prototype.openDisabledSectionView = function (section) {
        this.disabledSection.setSection(section);
        this.sidebar.setActive({
            type: pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
            section: section
        }, false);
        this.callViewMethod("toggleDisabledSection", true);
    };
    Notes2WindowController.prototype.getOrCreateTrash = function () {
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
    Notes2WindowController.prototype.getOrCreateCollectionTrash = function () {
        var _this = this;
        if (this.collections[FilesListController_1.FilesListController.TRASH_FILES]) {
            return this.collections[FilesListController_1.FilesListController.TRASH_FILES];
        }
        this.sessionsByCollectionName[FilesListController_1.FilesListController.TRASH_FILES] = this.app.sessionManager.getLocalSession();
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
    Notes2WindowController.prototype.openTrash = function () {
        var _this = this;
        var id = FilesListController_1.FilesListController.TRASH_FILES;
        if (this.getActiveId() == id) {
            return pmc_mail_1.Q();
        }
        var context = pmc_mail_1.app.common.Context.create({
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            contextType: "custom",
            contextId: id,
            hostHash: this.app.sessionManager.getLocalSession().hostHash
        });
        return pmc_mail_1.Q().then(function () {
            return _this.singletonGetOrCreateFilesList(id, function () { return _this.getOrCreateTrash(); });
        })
            .then(function (list) {
            _this.activeFilesList = list;
            _this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: _this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == id; })
            }, false);
            _this.activateFiles(id);
            _this.activeFilesList.loadFilePreview();
        });
    };
    Notes2WindowController.prototype.openConversationViewFromHashmails = function (hashmails) {
        var conversationId = this.conv2Service.getConvIdFromHashmails(hashmails);
        var context = pmc_mail_1.app.common.Context.create({
            moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
            contextType: "conversation",
            contextId: conversationId,
            hostHash: this.app.sessionManager.getLocalSession().hostHash
        });
        this.contextHistory.append(context);
        return this.openConversationView(conversationId);
    };
    Notes2WindowController.prototype.openConversationView = function (conversationId) {
        var _this = this;
        var users = this.conv2Service.getUsersFromConvId(conversationId);
        var conversation = this.conv2Service.collection.find(function (x) { return x.id == conversationId; });
        if (conversation == null) {
            conversation = this.conv2Service.getOrCreateConv(users, false);
            if (conversation == null) {
                return pmc_mail_1.Q();
            }
        }
        var filesId = Notes2WindowController_1.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.getActiveId() == filesId) {
            return pmc_mail_1.Q();
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
    Notes2WindowController.prototype.getOrCreateConversation = function (conversation) {
        var _this = this;
        var filesId = Notes2WindowController_1.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
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
    Notes2WindowController.prototype.getOrCreateCollectionConversation = function (conversation) {
        var _this = this;
        var collectionId = Notes2WindowController_1.getConversationId(this.app.sessionManager.getLocalSession(), conversation);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        this.sessionsByCollectionName[collectionId] = this.app.sessionManager.getLocalSession();
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
    Notes2WindowController.prototype.clearActive = function () {
        this.activeFilesList = null;
        this.activateFiles(null);
    };
    Notes2WindowController.prototype.activateFiles = function (id) {
        this.activateList(this.activeFilesList);
        this.callViewMethod("activateFiles", id);
    };
    Notes2WindowController.prototype.onLoading = function () {
        this.loading.callViewMethod("onStartLoading");
    };
    Notes2WindowController.prototype.onBeforeActivateSidebarElement = function (event) {
        var _this = this;
        var prevActive = this.activeFilesList;
        event.result = false;
        pmc_mail_1.Q().then(function () {
            event.result = false;
            if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.HOST) {
                return _this.expandRemoteSectionsList(event.element.host);
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                    contextType: "remote-section",
                    contextId: "section:" + event.element.section.getId(),
                    hostHash: event.element.hostHash
                });
                _this.contextHistory.append(context);
                return _this.openRemoteChannel(event.element.hostHash, event.element.section.getId());
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                    contextType: "remote-conversation",
                    contextId: event.element.conv2.id,
                    hostHash: event.element.hostHash
                });
                _this.contextHistory.append(context);
                return _this.openRemoteConversationView(event.element.hostHash, event.element.conv2.id);
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
                _this.onLoading();
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                    contextType: "conversation",
                    contextId: event.element.conv2.id,
                    hostHash: _this.app.sessionManager.getLocalSession().hostHash
                });
                _this.contextHistory.append(context);
                return _this.openConversationView(event.element.conv2.id);
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
                _this.onLoading();
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                    contextType: "section",
                    contextId: "section:" + event.element.section.getId(),
                    hostHash: _this.app.sessionManager.getLocalSession().hostHash
                });
                _this.contextHistory.append(context);
                return _this.openChannel(event.element.section.getId());
            }
            else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
                _this.onLoading();
                _this.notes2Plugin.activeSinkId = null;
                _this.notes2Plugin.activeSinkHostHash = null;
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: pmc_mail_1.Types.section.NotificationModule.NOTES2,
                    contextType: "custom",
                    contextId: event.element.customElement.id,
                    hostHash: _this.app.sessionManager.getLocalSession().hostHash
                });
                _this.contextHistory.append(context);
                if (event.element.customElement.id == FilesListController_1.FilesListController.MY_FILES) {
                    return _this.openMy();
                }
                if (event.element.customElement.id == FilesListController_1.FilesListController.ALL_FILES) {
                    return _this.openAll();
                }
                if (event.element.customElement.id == FilesListController_1.FilesListController.LOCAL_FILES) {
                    _this.localFS = new LocalFS_1.LocalFS(_this.localFilesBaseCollection, _this.localFsInitialPathSetting.get(), function (newPath) {
                        _this.localFsInitialPathSetting.set(newPath);
                    });
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
    Notes2WindowController.prototype.activateList = function (filesList) {
        this.notes2Plugin.activeFilesList = this.activeFilesList;
        this.activeFilesList.activate();
    };
    Notes2WindowController.prototype.deactivateList = function (filesList) {
        if (filesList && filesList != this.activeFilesList) {
            filesList.deactivate();
        }
    };
    Notes2WindowController.prototype.openDirectoryPreview = function (dir) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.dockedEditor && _this.reusableOpener ? true : _this.closeDockedEditor();
        })
            .then(function (closed) {
            if (!closed) {
                return;
            }
            if (_this.dockedEditor && _this.reusableOpener) {
                _this.hideIframe(_this.dockedEditor, _this.reusableOpener);
            }
            _this.stopPreviewPlayback();
            _this.reusableOpener = null;
            _this.dockedEditor = null;
            _this.directoryModel = {
                path: dir.path,
                name: dir.name,
                lastModifiedDate: dir.dirStats.modifiedDate,
                size: dir.dirStats.filesSize,
                fileCount: dir.dirStats.filesCount
            };
            _this.callViewMethod("showDirectoryPreview", _this.directoryModel);
        })
            .fail(this.errorCallback);
    };
    Notes2WindowController.prototype.onViewAfterShowIframe = function (id) {
        if (this.reusableOpener && this.reusableOpener.iframeId == id) {
            if ("afterShowIframe" in this.reusableOpener.win) {
                this.reusableOpener.win.afterShowIframe();
            }
        }
    };
    Notes2WindowController.prototype.openDockedEditorFor = function (session, oft) {
        var _this = this;
        var fileTree;
        return pmc_mail_1.Q().then(function () {
            if (oft instanceof pmc_mail_1.mail.section.OpenableSectionFile && oft.section) {
                return oft.section.getFileTree();
            }
        }).then(function (sectionTree) {
            fileTree = sectionTree ? sectionTree : null;
            return _this.dockedEditor && _this.reusableOpener ? true : _this.closeDockedEditor();
        })
            .then(function (closed) {
            if (!closed) {
                return;
            }
            var options = {
                element: oft,
                action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW,
                parent: _this,
                docked: true,
                session: session
            };
            var appHandle = _this.app.shellRegistry.resolveApplicationByElement(options);
            if (appHandle == null) {
                throw new Error("Cannot perform shell open at given parameter");
            }
            var creatingNewEditor = !(appHandle.id in _this.reusableEditors);
            _this.directoryModel = null;
            _this.stopPreviewPlayback();
            var dockedEditor = _this.dockedEditor;
            var reusableOpener = _this.reusableOpener;
            if (!creatingNewEditor) {
                var entry_1 = _this.reusableEditors[appHandle.id];
                if (!entry_1.win.hasOpenedEntry || !entry_1.win.hasOpenedEntry(oft)) {
                    entry_1.win.release();
                    entry_1.win.reopen(options.element);
                }
                _this.reusableOpener = entry_1;
                _this.dockedEditor = entry_1.win;
                _this.callViewMethod("showIframe", entry_1.iframeId, entry_1.load);
                if ("afterIframeShow" in _this.dockedEditor) {
                    _this.dockedEditor.afterIframeShow();
                }
                return pmc_mail_1.Q().then(function () {
                    var def = pmc_mail_1.Q.defer();
                    setTimeout(function () {
                        if (dockedEditor && dockedEditor.id != entry_1.iframeId && reusableOpener && reusableOpener.appId != _this.reusableOpener.appId) {
                            _this.hideIframe(dockedEditor, reusableOpener);
                        }
                        def.resolve();
                    }, 50);
                    return def.promise;
                });
            }
            else {
                return pmc_mail_1.Q().then(function () {
                    if (fileTree && oft instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
                        var entry = fileTree.collection.list.filter(function (x) { return x.path == oft.path; })[0];
                        if (entry) {
                            return _this.app.fileStyleResolver.getStyle(entry);
                        }
                    }
                })
                    .then(function (style) {
                    _this.callViewMethod("showEditorLoader", style ? style.styleName : "default");
                    if (_this.dockedEditor && _this.reusableOpener) {
                        _this.hideIframe(dockedEditor, reusableOpener);
                    }
                    return appHandle.open(options).then(function (win) {
                        var rwin = win;
                        var iframeId = _this.editorsId++;
                        if (rwin.release && rwin.reopen) {
                            _this.reusableOpener = _this.reusableEditors[appHandle.id] = {
                                appId: appHandle.id,
                                iframeId: iframeId,
                                win: rwin,
                                load: null
                            };
                        }
                        else {
                            _this.reusableOpener = null;
                        }
                        _this.dockedEditor = win;
                        _this.registerInstance(win);
                        win.onClose = function () {
                            if (_this.reusableEditors[appHandle.id]) {
                                delete _this.reusableEditors[appHandle.id];
                            }
                            win.destroy();
                            win.nwin.close(true);
                            _this.callViewMethod("removeIframe", iframeId);
                            _this.stopPreviewPlayback();
                            _this.dockedEditor = null;
                        };
                        win.openDocked(_this.nwin, iframeId);
                        var docked = win.nwin;
                        _this.callViewMethod("showIframe", docked.id, docked.load);
                        if (_this.reusableOpener) {
                            _this.reusableOpener.load = docked.load;
                        }
                    });
                });
            }
        })
            .fail(this.errorCallback);
    };
    Notes2WindowController.prototype.hideIframe = function (dockedEditor, reusableOpener) {
        this.callViewMethod("hideIframe", reusableOpener.iframeId);
        if ("afterIframeHide" in dockedEditor) {
            dockedEditor.afterIframeHide();
        }
    };
    Notes2WindowController.prototype.onDockedLoad = function () {
        this.callViewMethod("hideEditorLoader");
    };
    Notes2WindowController.prototype.closeDockedEditor = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (_this.dockedEditor) {
                return pmc_mail_1.Q().then(function () {
                    return _this.dockedEditor.close();
                })
                    .then(function () {
                    return true;
                })
                    .fail(function (e) {
                    return e ? pmc_mail_1.Q.reject(e) : false;
                });
            }
            return true;
        });
    };
    Notes2WindowController.prototype.stopPreviewPlayback = function () {
        if (this.dockedEditor && "stopPlayback" in this.dockedEditor) {
            this.dockedEditor.stopPlayback();
        }
    };
    Notes2WindowController.prototype.loadFilePreview = function (session, element) {
        var _this = this;
        var deferred = pmc_mail_1.Q.defer();
        this.elementToPreview = element;
        this.previewElement = element;
        clearTimeout(this.previewLoadTid);
        this.previewLoadTid = setTimeout(function () {
            if (_this.elementToPreview) {
                _this.openDockedEditorFor(session, _this.elementToPreview).then(deferred.resolve, deferred.reject);
                _this.elementToPreview = null;
            }
            else {
                deferred.reject();
            }
        }, 100);
        if (element instanceof pmc_mail_1.mail.section.OpenableSectionFile && element.section) {
            var oft_1 = element;
            pmc_mail_1.Q.all([element.section.getFileTree(), deferred.promise]).then(function (_a) {
                var tree = _a[0];
                if (_this.previewElement != oft_1) {
                    _this.clearPreviewTrashedInfo();
                    return;
                }
                var entry = tree.collection.list.filter(function (x) { return x.id == oft_1.id; })[0];
                if (entry) {
                    _this.updatePreviewTrashedInfo(session, entry.getTrashedInfo(), tree.section);
                }
            });
            deferred.promise.fail(function () {
                _this.clearPreviewTrashedInfo();
            });
        }
        else {
            this.clearPreviewTrashedInfo();
        }
        return deferred.promise;
    };
    Notes2WindowController.prototype.loadDirectoryPreview = function (session, element) {
        var _this = this;
        var deferred = pmc_mail_1.Q.defer();
        this.directoryToPreview = element;
        this.previewElement = element;
        clearTimeout(this.previewLoadTid);
        this.previewLoadTid = setTimeout(function () {
            if (_this.directoryToPreview) {
                _this.openDirectoryPreview(_this.directoryToPreview).then(deferred.resolve, deferred.reject);
                _this.directoryToPreview = null;
            }
            else {
                deferred.reject();
            }
        }, 100);
        if (element instanceof pmc_mail_1.mail.filetree.nt.Directory && element.tree) {
            var dir_1 = element;
            pmc_mail_1.Q([deferred.promise]).then(function () {
                var tree = element.tree;
                if (_this.previewElement != dir_1) {
                    _this.clearPreviewTrashedInfo();
                    return;
                }
                var entry = tree.collection.list.filter(function (x) { return x.id == dir_1.id; })[0];
                if (entry) {
                    _this.updatePreviewTrashedInfo(session, entry.getTrashedInfo(), tree.section);
                }
            });
            deferred.promise.fail(function () {
                _this.clearPreviewTrashedInfo();
            });
        }
        else {
            this.clearPreviewTrashedInfo();
        }
        return deferred.promise;
    };
    Notes2WindowController.prototype.updatePreviewTrashedInfo = function (session, info, section) {
        if (!info || !section) {
            this.clearPreviewTrashedInfo();
            return;
        }
        var user = session.conv2Service.contactService.contactCollection.find(function (x) { return x.user && x.user.user == info.who; });
        var trashedInfoModel = {
            when: info.when,
            who: user ? user.getDisplayName() : info.who,
            sectionName: section.getName(),
            sectionId: section.getId(),
            fullSectionName: section.getFullSectionName(),
        };
        var trashedInfoModelStr = JSON.stringify(trashedInfoModel);
        if (trashedInfoModelStr != this.currPreviewTrashedInfoModelStr) {
            this.callViewMethod("setPreviewTrashedInfo", trashedInfoModelStr);
            this.currPreviewTrashedInfoModelStr = trashedInfoModelStr;
        }
    };
    Notes2WindowController.prototype.clearPreviewTrashedInfo = function () {
        var trashedInfoModelStr = null;
        if (trashedInfoModelStr != this.currPreviewTrashedInfoModelStr) {
            this.callViewMethod("setPreviewTrashedInfo", trashedInfoModelStr);
            this.currPreviewTrashedInfoModelStr = trashedInfoModelStr;
        }
    };
    Notes2WindowController.prototype.clearPreview = function (selectedItemsCount) {
        if (selectedItemsCount === void 0) { selectedItemsCount = 0; }
        this.callViewMethod("hideDirectoryPreview", selectedItemsCount);
        this.clearPreviewTrashedInfo();
        if (this.dockedEditor && this.reusableOpener) {
            this.reusableOpener.win.release();
            this.hideIframe(this.dockedEditor, this.reusableOpener);
            this.stopPreviewPlayback();
            this.dockedEditor = null;
            this.reusableOpener = null;
            return pmc_mail_1.Q();
        }
        else {
            return this.closeDockedEditor().thenResolve(null);
        }
    };
    Notes2WindowController.prototype.createCollections = function () {
        var _this = this;
        var localSession = this.app.sessionManager.getLocalSession();
        this.getOrCreateCollectionMy();
        this.getOrCreateCollectionAll();
        this.getOrCreateCollectionTrash();
        this.notes2Plugin.files2Sections[localSession.hostHash].list.forEach(function (section) {
            _this.getOrCreateCollectionChannel(section);
        });
        this.conv2Service.collection.list.forEach(function (conv2Section) {
            _this.getOrCreateCollectionConversation(conv2Section);
        });
    };
    Notes2WindowController.prototype.getCustomElementSearchCount = function (customElement) {
        var session = this.app.sessionManager.getLocalSession();
        var searchResults = this.getSearchResults(session);
        if (!searchResults) {
            return 0;
        }
        if (customElement.id == FilesListController_1.FilesListController.MY_FILES) {
            return searchResults[FilesListController_1.FilesListController.MY_FILES] || 0;
        }
        else if (customElement.id == FilesListController_1.FilesListController.ALL_FILES) {
            return searchResults[FilesListController_1.FilesListController.ALL_FILES] || 0;
        }
        else if (customElement.id == FilesListController_1.FilesListController.TRASH_FILES) {
            return searchResults[FilesListController_1.FilesListController.TRASH_FILES] || 0;
        }
        return 0;
    };
    Notes2WindowController.prototype.getConv2ListSearchCount = function (session, conv2Section) {
        var searchResults = this.getSearchResults(session);
        if (!searchResults) {
            return 0;
        }
        var collectionId = Notes2WindowController_1.getConversationId(session, conv2Section);
        return searchResults[collectionId] || 0;
    };
    Notes2WindowController.prototype.getSectionSearchCount = function (session, section) {
        var searchResults = this.getSearchResults(session);
        if (!searchResults) {
            return 0;
        }
        var collectionId = Notes2WindowController_1.getChannelId(session, section);
        return searchResults[collectionId] || 0;
    };
    Notes2WindowController.prototype.getCustomElementWithSpinner = function (customElement) {
        var localSession = this.app.sessionManager.getLocalSession();
        if (!this.notes2Plugin.sectionsWithSpinner[localSession.hostHash]) {
            return false;
        }
        if (this.notes2Plugin.sectionsWithSpinner[localSession.hostHash]["__all__"]) {
            return true;
        }
        return !!this.notes2Plugin.sectionsWithSpinner[localSession.hostHash][customElement.id];
    };
    Notes2WindowController.prototype.getConv2WithSpinner = function (session, conv2Section) {
        if (!this.notes2Plugin.sectionsWithSpinner[session.hostHash]) {
            return false;
        }
        if (this.notes2Plugin.sectionsWithSpinner[session.hostHash]["__all__"]) {
            return true;
        }
        return !!this.notes2Plugin.sectionsWithSpinner[session.hostHash][conv2Section.id];
    };
    Notes2WindowController.prototype.getSectionWithSpinner = function (session, section) {
        if (!this.notes2Plugin.sectionsWithSpinner[session.hostHash]) {
            return false;
        }
        if (this.notes2Plugin.sectionsWithSpinner[session.hostHash]["__all__"]) {
            return true;
        }
        return !!this.notes2Plugin.sectionsWithSpinner[session.hostHash][section.getId()];
    };
    Notes2WindowController.prototype.onFilterFiles = function () {
        this.searchCountFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    Notes2WindowController.prototype.updateSearchCounts = function () {
        var data = this.app.searchModel.get();
        var searchStr = data.visible ? pmc_mail_1.app.common.SearchFilter.prepareNeedle(data.value) : "";
        var localSession = this.app.sessionManager.getLocalSession();
        var _loop_1 = function (collectionName) {
            var collection = this_1.collections[collectionName];
            var session = this_1.sessionsByCollectionName[collectionName];
            var searchCount = 0;
            if (searchStr != "") {
                collection.list.forEach(function (f) {
                    if (!f || Notes2Utils_1.Notes2Utils.isLocalEntry(f) || Notes2Utils_1.Notes2Utils.isParentEntry(f)) {
                        return;
                    }
                    var name = Notes2Utils_1.Notes2Utils.isAttachmentEntry(f) ? f.attachment.getName() : f.name;
                    if (pmc_mail_1.app.common.SearchFilter.matches(searchStr, name)) {
                        ++searchCount;
                    }
                });
            }
            var searchResults = this_1.getSearchResults(session);
            if (searchResults[collectionName] != searchCount) {
                searchResults[collectionName] = searchCount;
                var parsedId_1 = Notes2WindowController_1.parseChannelOrConversationId(collectionName);
                if (collectionName == FilesListController_1.FilesListController.MY_FILES || collectionName == FilesListController_1.FilesListController.ALL_FILES || collectionName == FilesListController_1.FilesListController.TRASH_FILES) {
                    var idx = this_1.sidebarOptions.customElementList.baseCollection.indexOfBy(function (el) { return el.id == collectionName; });
                    if (idx != -1) {
                        this_1.sidebarOptions.customElementList.baseCollection.triggerUpdateAt(idx);
                    }
                }
                else if (parsedId_1 && parsedId_1.type == "conversation") {
                    var collection_2 = parsedId_1.hostHash == localSession.hostHash ? this_1.sidebar.conv2List.sortedCollection : (this_1.sidebar.remoteConv2Lists[parsedId_1.hostHash] ? this_1.sidebar.remoteConv2Lists[parsedId_1.hostHash].sortedCollection : null);
                    if (collection_2) {
                        var idx = collection_2.indexOfBy(function (el) { return el.id == parsedId_1.id; });
                        if (idx != -1) {
                            collection_2.triggerUpdateAt(idx);
                        }
                    }
                }
                else if (parsedId_1 && parsedId_1.type == "channel") {
                    var collection_3 = parsedId_1.hostHash == localSession.hostHash ? this_1.sidebar.sectionList.sortedCollection : (this_1.sidebar.remoteSectionsLists[parsedId_1.hostHash] ? this_1.sidebar.remoteSectionsLists[parsedId_1.hostHash].sortedCollection : null);
                    if (collection_3) {
                        var idx = collection_3.indexOfBy(function (el) { return el.getId() == parsedId_1.id; });
                        if (idx != -1) {
                            collection_3.triggerUpdateAt(idx);
                        }
                    }
                }
            }
        };
        var this_1 = this;
        for (var collectionName in this.collections) {
            _loop_1(collectionName);
        }
        for (var _i = 0, _a = this.notes2Plugin.getReadySessions(); _i < _a.length; _i++) {
            var session = _a[_i];
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
    };
    Notes2WindowController.prototype.getSearchResults = function (session) {
        if (!this.searchCounts[session.hostHash]) {
            this.searchCounts[session.hostHash] = {};
        }
        return this.searchCounts[session.hostHash];
    };
    Notes2WindowController.prototype.getCustomElementUnread = function (customElement) {
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
        return 0;
    };
    Notes2WindowController.prototype.getElementsCountWithoutRoot = function (count) {
        return count > 0 ? count - 1 : 0;
    };
    Notes2WindowController.prototype.getCustomElementElementsCount = function (customElement) {
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
    Notes2WindowController.prototype.getSectionUnread = function (session, section) {
        var ufbs = this.notes2Plugin.unreadFilesBySection[session.hostHash];
        return (ufbs ? ufbs[section.getId()] : 0) || 0;
    };
    Notes2WindowController.prototype.getSectionElementsCount = function (session, section) {
        var localSession = this.app.sessionManager.getLocalSession();
        var count = session.host == localSession.host ? this.getOrCreateCollectionChannel(section).size() : this.getOrCreateRemoteCollectionChannel(session.hostHash, section).size();
        return this.getElementsCountWithoutRoot(count);
    };
    Notes2WindowController.prototype.getConversationUnread = function (session, conv2Section) {
        if (!conv2Section.section) {
            return 0;
        }
        return this.getSectionUnread(session, conv2Section.section);
    };
    Notes2WindowController.prototype.getConv2ElementsCount = function (session, conv2Section) {
        var localSession = this.app.sessionManager.getLocalSession();
        var count = session.host == localSession.host ? this.getOrCreateCollectionConversation(conv2Section).size() : this.getOrCreateRemoteCollectionConversation(session.hostHash, conv2Section).size();
        return this.getElementsCountWithoutRoot(count);
    };
    Notes2WindowController.prototype.expandRemoteSectionsList = function (hostEntry) {
        var _this = this;
        var session;
        var hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        var checkSessionExists = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if (checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        pmc_mail_1.Q().then(function () {
            _this.sidebar.callViewMethod("showHostLoading", hostHash, true);
            if (!checkSessionExists) {
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
            return _this.notes2Plugin.initializeSessionCollectionsAndTrees(session);
        })
            .then(function () {
            if (!_this.remoteServers) {
                _this.remoteServers = {};
            }
            _this.initRemoteHostComponents(hostEntry, session);
            _this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            _this.isHostLoaded[hostHash] = true;
        })
            .then(function () {
            _this.updateSidebarHostElement(session);
        })
            .fail(function (e) {
            console.log(e);
        });
    };
    Notes2WindowController.prototype.checkRemoteHostComponentsInitialized = function (hostHash) {
        var ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    };
    Notes2WindowController.prototype.initRemoteHostComponents = function (hostEntry, session) {
        var _this = this;
        var hostHash = session.hostHash;
        if (this.checkRemoteHostComponentsInitialized(hostHash)) {
            return;
        }
        var sectionsListOptions = {
            baseCollection: session.sectionManager.filteredCollection,
            unreadProvider: function (section) { return _this.getSectionUnread(session, section); },
            elementsCountProvider: function (section) { return _this.getRemoteSectionElementsCount(hostHash, section); },
            searchCountProvider: function (section) { return _this.getSectionSearchCount(session, section); },
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
            searchCountProvider: function (c2s) { return _this.getConv2ListSearchCount(session, c2s); },
            searchAllSearchedProvider: null,
            withSpinnerProvider: function (c2s) { return _this.getConv2WithSpinner(session, c2s); },
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
    Notes2WindowController.prototype.openRemoteChannel = function (hostHash, sectionId) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.init(hostHash);
        })
            .then(function () {
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            var section = session.sectionManager.getSection(sectionId);
            var filesId = Notes2WindowController_1.getChannelId(session, section);
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
                _this.openDisabledSectionView(section);
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
    Notes2WindowController.prototype.getOrCreateRemoteChannel = function (hostHash, id, sectionId, section) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var collectionId = Notes2WindowController_1.getChannelId(session, section);
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
    Notes2WindowController.prototype.getOrCreateRemoteCollectionChannel = function (hostHash, section) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var collectionId = Notes2WindowController_1.getChannelId(session, section);
        if (this.collections[collectionId]) {
            return this.collections[collectionId];
        }
        var sink = section.isChatModuleEnabled() ? section.getChatSink() : null;
        var sinkId = sink ? sink.id : null;
        this.sessionsByCollectionName[collectionId] = session;
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
    Notes2WindowController.prototype.openRemoteConversationView = function (hostHash, conversationId) {
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
            var filesId = Notes2WindowController_1.getConversationId(session, conversation);
            if (_this.getActiveId() == filesId) {
                return;
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
    Notes2WindowController.prototype.getOrCreateRemoteConversation = function (hostHash, conversation) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        return pmc_mail_1.Q().then(function () {
            var id = Notes2WindowController_1.getConversationId(session, conversation);
            if (!(id in _this.filesLists)) {
                var collection_4 = null;
                return _this.fsManager.addConversationAndInit(conversation, session).then(function (sec) {
                    if (sec != null) {
                        return _this.finishFileTreePreparation(sec, hostHash);
                    }
                })
                    .then(function () {
                    collection_4 = _this.getOrCreateRemoteCollectionConversation(hostHash, conversation);
                    return _this.addFilesListComponent({ sessionType: "remote", hostHash: hostHash }, id, conversation.id, collection_4, {
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
                            collection_4.refresh();
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
    Notes2WindowController.prototype.getOrCreateRemoteCollectionConversation = function (hostHash, conversation) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var id = Notes2WindowController_1.getConversationId(session, conversation);
        if (this.collections[id]) {
            return this.collections[id];
        }
        this.sessionsByCollectionName[id] = session;
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
    Notes2WindowController.prototype.updateSidebarHostElement = function (session) {
        if (this.app.sessionManager.getLocalSession() == session) {
            return;
        }
        if (!this.isHostLoaded[session.hostHash]) {
            return;
        }
        var element = this.sidebar.hostList.hostsSortedCollection.find(function (x) { return x.host == session.host; });
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    };
    Notes2WindowController.prototype.getRemoteSectionElementsCount = function (hostHash, section) {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionChannel(hostHash, section).size());
    };
    Notes2WindowController.prototype.getRemoteConv2ElementsCount = function (hostHash, conv2Section) {
        return this.getElementsCountWithoutRoot(this.getOrCreateRemoteCollectionConversation(hostHash, conv2Section).size());
    };
    Notes2WindowController.prototype.isLocalEntry = function (entry) {
        return Notes2Utils_1.Notes2Utils.isEntryFromSession(entry, this.app.sessionManager.getLocalSession());
    };
    Notes2WindowController.getChannelId = function (session, section) {
        return "channel-" + session.hostHash + "-" + section.getId();
    };
    Notes2WindowController.getConversationId = function (session, conversation) {
        return "conversation-" + session.hostHash + "-" + conversation.id;
    };
    Notes2WindowController.parseChannelOrConversationId = function (id) {
        if (!id) {
            return null;
        }
        var parts = id.split("-");
        if (parts.length < 3) {
            return null;
        }
        return {
            type: parts[0] == "channel" ? "channel" : "conversation",
            hostHash: parts[1],
            id: parts.slice(2).join("-"),
        };
    };
    var Notes2WindowController_1;
    Notes2WindowController.textsPrefix = "plugin.notes2.window.notes2.";
    __decorate([
        Inject
    ], Notes2WindowController.prototype, "identity", void 0);
    __decorate([
        Inject
    ], Notes2WindowController.prototype, "conv2Service", void 0);
    __decorate([
        Inject
    ], Notes2WindowController.prototype, "collectionFactory", void 0);
    __decorate([
        Inject
    ], Notes2WindowController.prototype, "messagesCollection", void 0);
    __decorate([
        Inject
    ], Notes2WindowController.prototype, "client", void 0);
    __decorate([
        Inject
    ], Notes2WindowController.prototype, "sectionManager", void 0);
    __decorate([
        Inject
    ], Notes2WindowController.prototype, "personService", void 0);
    Notes2WindowController = Notes2WindowController_1 = __decorate([
        Dependencies(["notes2filelist", "persons", "splitter", "extlist", "notification", "conv2list", "sectionlist", "sectionstabs"])
    ], Notes2WindowController);
    return Notes2WindowController;
}(pmc_mail_1.window.base.BaseAppWindowController));
exports.Notes2WindowController = Notes2WindowController;
FsManagerEntry.prototype.className = "com.privmx.plugin.notes2.window.notes2.FsManagerEntry";
FsManager.prototype.className = "com.privmx.plugin.notes2.window.notes2.FsManager";
Notes2WindowController.prototype.className = "com.privmx.plugin.notes2.window.notes2.Notes2WindowController";

//# sourceMappingURL=Notes2WindowController.js.map
