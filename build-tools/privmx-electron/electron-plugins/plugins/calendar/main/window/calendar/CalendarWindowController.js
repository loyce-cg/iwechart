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
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var CalendarTasksCountManager_1 = require("../../main/CalendarTasksCountManager");
var Types_1 = require("../../main/Types");
var index_1 = require("./i18n/index");
var Inject = pmc_mail_1.utils.decorators.Inject;
var CalendarWindowController = (function (_super) {
    __extends(CalendarWindowController, _super);
    function CalendarWindowController(parentWindow, docked) {
        var _this = _super.call(this, parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "calendar-splitter-vertical": { defaultValue: 340 },
                "calendar-splitter-vertical2-proportional": { defaultValue: JSON.stringify({ handlePos: 600, totalSize: 1600 }) },
                "calendar-splitter-horizontal-proportional": { defaultValue: JSON.stringify({ handlePos: 300, totalSize: 1000 }) },
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({ handlePos: 250, totalSize: 1000 }) },
                "calendar-splitter-calendars-proportional": { defaultValue: JSON.stringify({ handlePos: 800, totalSize: 1600 }) },
            }
        }) || this;
        _this.subSettings = {};
        _this.afterViewLoaded = pmc_mail_1.Q.defer();
        _this.dirty = false;
        _this.remoteCalendarTasksCountManagers = {};
        _this.calendar1PanelPromises = {};
        _this.calendar2PanelPromises = {};
        _this.remoteDataChangedListeners = {};
        _this.remoteServers = {};
        _this.ipcMode = true;
        _this.docked = docked;
        var localSession = _this.app.sessionManager.getLocalSession();
        _this.setPluginViewAssets("calendar");
        _this.addViewStyle({ path: "window/component/taskPanel/template/main.css", plugin: "tasks" });
        _this.addViewScript({ path: "build/view.js", plugin: "tasks" });
        _this.openWindowOptions.position = "center";
        _this.openWindowOptions.width = 900;
        _this.openWindowOptions.height = 500;
        _this.openWindowOptions.cssClass = "app-window";
        _this.openWindowOptions.title = _this.i18n("plugin.calendar.window.calendar.title");
        _this.openWindowOptions.icon = "icon fa fa-calendar";
        _this.calendarPlugin = _this.app.getComponent("calendar-plugin");
        _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.sectionTooltip = _this.addComponent("sectiontooltip", _this.componentFactory.createComponent("sectiontooltip", [_this]));
        _this.datePicker = _this.addComponent("datePicker", _this.componentFactory.createComponent("datePicker", [_this, {
                prev: true,
                next: true,
                day: true,
                month: true,
                year: true,
                buttons: false,
            }]));
        _this.disabledSection = _this.addComponent("disabled-section", _this.componentFactory.createComponent("disabledsection", [_this, pmc_mail_1.Types.section.NotificationModule.CALENDAR]));
        _this.bindEvent(_this.app, "calendar-setting-changed", function (event) { return __awaiter(_this, void 0, void 0, function () {
            var showFiles, refreshSidebarCounts, hostHash;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(event.setting == "enable-day-preview-panel")) return [3, 2];
                        return [4, this.onToggleDayPreviewPanel(!!event.value)];
                    case 1:
                        _a.sent();
                        return [3, 3];
                    case 2:
                        if (event.setting == "horizontal-task-preview-window-layout") {
                            this.previewPanel.overrideIsHorizontalLayout = !!this.calendarPlugin.getSetting(localSession, "horizontal-task-preview-window-layout", null, null);
                            this.previewPanel.refreshIsHorizontalLayout();
                        }
                        else if (event.setting == "show-files") {
                            showFiles = !!this.calendarPlugin.getSetting(localSession, "show-files", null, null);
                            refreshSidebarCounts = false;
                            if (this.calendarTasksCountManager && this.calendarTasksCountManager.countFiles != showFiles) {
                                this.calendarTasksCountManager.countFiles = showFiles;
                                refreshSidebarCounts = true;
                            }
                            for (hostHash in this.remoteCalendarTasksCountManagers) {
                                if (this.remoteCalendarTasksCountManagers[hostHash].countFiles != showFiles) {
                                    this.remoteCalendarTasksCountManagers[hostHash].countFiles = showFiles;
                                    refreshSidebarCounts = true;
                                }
                            }
                            if (refreshSidebarCounts) {
                                this.refreshSidebarCounts();
                            }
                        }
                        _a.label = 3;
                    case 3: return [2];
                }
            });
        }); });
        _this.bindEvent(_this.app, "active-app-window-changed", function (e) {
            _this.callViewMethod("setIsCalendarTabOpen", e.appWindowId == "calendar");
        });
        _this.dataChangedListener = _this.onDataChanged.bind(_this);
        _this.calendarPlugin.tasksPlugin.watch(localSession, "*", "*", "*", _this.dataChangedListener);
        return _this;
    }
    CalendarWindowController_1 = CalendarWindowController;
    CalendarWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    CalendarWindowController.prototype.onViewLoad = function () {
        this.afterViewLoaded.resolve();
        var data = this.app.searchModel.get();
        var isSearchOn = data.visible && data.value.length > 1;
        this.callViewMethod("onSearchChanged", isSearchOn, false);
        this.initSpellChecker();
    };
    CalendarWindowController.prototype.beforeClose = function () {
        this.calendarPlugin.tasksPlugin.unWatch(this.app.sessionManager.getLocalSession(), "*", "*", "*", this.dataChangedListener);
        for (var hostHash in this.remoteDataChangedListeners) {
            this.calendarPlugin.tasksPlugin.unWatch(this.app.sessionManager.sessions[hostHash], "*", "*", "*", this.remoteDataChangedListeners[hostHash]);
        }
        for (var id in this.calendar1PanelPromises) {
            this.calendar1PanelPromises[id].then(function (panel) { return panel.beforeClose(); });
        }
        for (var id in this.calendar2PanelPromises) {
            this.calendar2PanelPromises[id].then(function (panel) { return panel.beforeClose(); });
        }
        this.previewPanel.beforeClose();
    };
    CalendarWindowController.prototype.init = function () {
        var _this = this;
        var localSession = this.app.sessionManager.getLocalSession();
        this.privateSection = localSession.sectionManager.getMyPrivateSection();
        this.calendarTasksCountManager = new CalendarTasksCountManager_1.CalendarTasksCountManager(localSession, this.privateSection, this.calendarPlugin, this.calendarPlugin.tasksPlugin, this.sidebar, !!this.calendarPlugin.getSetting(localSession, "show-files", null, null));
        this.previewPanel = this.addComponent("previewPanel", this.componentFactory.createComponent("taskpanel", [this, localSession, this.personsComponent, {
                close: function () { return _this.close(); },
                confirm: function (msg) { return _this.confirm(msg); },
                confirmEx: this.confirmEx.bind(this),
                openWindowParent: this,
                openChildWindow: this.openChildWindow.bind(this),
                updateDirty: this.updateDirty.bind(this),
            }, true, false, []]));
        this.previewPanel.overrideIsHorizontalLayout = !!this.calendarPlugin.getSetting(localSession, "horizontal-task-preview-window-layout", null, null);
        this.verticalSplitter = this.addComponent("verticalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-vertical")]));
        this.verticalSplitter2 = this.addComponent("verticalSplitter2", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-vertical2-proportional")]));
        this.horizontalSplitter = this.addComponent("horizontalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-horizontal-proportional")]));
        this.calendarsSplitter = this.addComponent("calendarsSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-calendars-proportional")]));
        this.verticalSplitter.ipcMode = true;
        this.verticalSplitter2.ipcMode = true;
        this.horizontalSplitter.ipcMode = true;
        this.calendarsSplitter.ipcMode = true;
        this.subSettings["active-project-id"] = this.settings.create("active-project-id");
        this.activeProjectId = this.historyStateProjectId ? this.historyStateProjectId : this.calendarPlugin.getPrivateSectionId();
        this.activeProjectHostHash = localSession.hostHash;
        this.calendarPlugin.tasksPlugin.projectsReady.then(function () {
            _this.selectProject(_this.getActiveSession(), _this.activeProjectId ? _this.activeProjectId : _this.calendarPlugin.getPrivateSectionId());
        });
        var promProjectCreator = pmc_mail_1.Q();
        var prevUpdate = null;
        this.registerChangeEvent(this.calendarPlugin.tasksPlugin.tasksSectionsCollection[localSession.hostHash].changeEvent, function (event) {
            if (event.type == "add") {
                promProjectCreator = promProjectCreator.then(function () { return _this.calendarPlugin.tasksPlugin.ensureProjectExists(event.element.getId(), event.element.getName(), localSession); }).then(function () {
                    return pmc_mail_1.Q.resolve();
                })
                    .fail(function (e) {
                    _this.getLogger().error("Error during adding project", e);
                });
            }
            else if (event.type == "update") {
                var now = new Date();
                if (prevUpdate != null) {
                    if (now - prevUpdate < 5) {
                        prevUpdate = now;
                        return;
                    }
                }
                prevUpdate = now;
                setTimeout(function () {
                    promProjectCreator = promProjectCreator.then(function () {
                        _this.callViewMethod("renderProjectsPanel");
                        return pmc_mail_1.Q.resolve();
                    });
                }, 100);
            }
        });
        var _loop_1 = function (element) {
            var id = element.getId();
            var name_1 = element.getName();
            if (id == this_1.calendarPlugin.getPrivateSectionId()) {
                name_1 = this_1.i18n("plugin.calendar.window.calendar.sidebar.private");
            }
            promProjectCreator = promProjectCreator.then(function () { return _this.calendarPlugin.tasksPlugin.ensureProjectExists(id, name_1, localSession); });
        };
        var this_1 = this;
        for (var _i = 0, _a = this.calendarPlugin.tasksPlugin.tasksSectionsCollection[localSession.hostHash].list; _i < _a.length; _i++) {
            var element = _a[_i];
            _loop_1(element);
        }
        this.bindEvent(this.app, "calendars-file-added", function (e) {
            if (e.hostHash == localSession.hostHash) {
                _this.calendarTasksCountManager.addFile(e.identifier);
            }
            else {
                _this.getOrCreateRemoteTasksCountManager(e.hostHash).addFile(e.identifier);
            }
        });
        this.bindEvent(this.app, "calendars-file-removed", function (e) {
            if (e.hostHash == localSession.hostHash) {
                _this.calendarTasksCountManager.removeFile(e.identifier);
            }
            else {
                _this.getOrCreateRemoteTasksCountManager(e.hostHash).removeFile(e.identifier);
            }
        });
        this.bindEvent(this.app, "extra-calendars-changed", function (e) {
            _this.refreshSidebarCounts();
        });
        this.bindEvent(this.app, "focusChanged", function (event) {
            var windowId = event.windowId;
            _this.calendarPlugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? _this.parent.parent.activeModel.get() : windowId;
            if (windowId == "tasks" || (windowId == "main-window" && _this.parent.parent.activeModel.get() == "tasks")) {
                setTimeout(function () {
                    _this.callViewMethod("grabFocus", true);
                }, 200);
            }
        });
        this.bindEvent(this.app, "focusLost", function (event) {
            _this.calendarPlugin.activeWindowFocused = null;
        });
        this.bindEvent(this.app, "onToggleMaximize-notify", function () {
            setTimeout(function () {
                _this.callViewMethod("grabFocus", false);
            }, 10);
        });
        this.bindEvent(this.app, "focusLost", function () {
            _this.callViewMethod("pauseTimeAgoRefresher");
        });
        this.bindEvent(this.app, "focusChanged", function (event) {
            if (event.windowId == "main-window") {
                _this.callViewMethod("resumeTimeAgoRefresher");
            }
        });
        return pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                _this.calendarPlugin.sectionManager.isSectionsLimitReached()
            ]);
        })
            .then(function (res) {
            var identityProvider = res[0], isSectionsLimitReached = res[1];
            var customElements = [];
            if (_this.calendarPlugin.getPrivateSectionId()) {
                customElements.push({
                    id: _this.calendarPlugin.getPrivateSectionId(),
                    icon: {
                        type: "hashmail",
                        value: _this.calendarPlugin.identity.hashmail,
                    },
                    label: _this.i18n("plugin.calendar.window.calendar.sidebar.private"),
                    private: true,
                    emphasized: true,
                });
            }
            customElements.push({
                id: Types_1.CustomTasksElements.ALL_TASKS_ID,
                icon: {
                    type: "fa",
                    value: "privmx-icon privmx-icon-calendar",
                },
                label: _this.i18n("plugin.calendar.window.calendar.sidebar.all"),
                private: false,
            }, {
                id: Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                icon: {
                    type: "hashmail",
                    value: _this.calendarPlugin.identity.hashmail,
                },
                label: _this.i18n("plugin.calendar.window.calendar.sidebar.created-by-me"),
                private: false,
            }, {
                id: Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                icon: {
                    type: "hashmail",
                    value: _this.calendarPlugin.identity.hashmail,
                },
                label: _this.i18n("plugin.calendar.window.calendar.sidebar.assigned-to-me"),
                private: false,
                alternative: true,
                emphasized: true,
            }, {
                id: Types_1.CustomTasksElements.TRASH_ID,
                icon: {
                    type: "fa",
                    value: "ico-bin",
                },
                label: _this.i18n("plugin.calendar.window.calendar.sidebar.trash"),
                private: false,
            });
            var sidebarOptions = {
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: new pmc_mail_1.utils.collection.MutableCollection(customElements),
                    elementsCountProvider: function (ce) { return _this.calendarTasksCountManager.getCustomElementElementsCount(ce); },
                    unreadProvider: function (ce) { return _this.getUnread(localSession, ce); },
                    searchCountProvider: function (ce) { return _this.calendarPlugin.getSearchCount(localSession, ce); },
                    unmutedUnreadProvider: function (ce) { return _this.getUnread(localSession, ce, true); },
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    elementsCountProvider: function (c2s) { return _this.calendarTasksCountManager.getConv2ElementsCount(c2s); },
                    unreadProvider: function (c2s) { return _this.getUnread(localSession, c2s); },
                    searchCountProvider: function (c2s) { return _this.calendarPlugin.getSearchCount(localSession, c2s); },
                    searchAllSearchedProvider: null,
                    unmutedUnreadProvider: function (c2s) { return _this.getUnread(localSession, c2s, true); },
                    sorter: function (a, b) {
                        return _this.calendarTasksCountManager.getConv2LastDate(b) - _this.calendarTasksCountManager.getConv2LastDate(a);
                    },
                    hideConversations: true,
                    assignedTo: true,
                },
                sectionList: {
                    baseCollection: _this.calendarPlugin.sidebarSectionsCollection,
                    elementsCountProvider: function (section) { return _this.calendarTasksCountManager.getSectionElementsCount(section); },
                    unreadProvider: function (section) { return _this.getUnread(localSession, section); },
                    searchCountProvider: function (section) { return _this.calendarPlugin.getSearchCount(localSession, section); },
                    searchAllSearchedProvider: null,
                    moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                    sorter: function (a, b) {
                        var res = _this.calendarTasksCountManager.getSectionLastDate(b) - _this.calendarTasksCountManager.getSectionLastDate(a);
                        return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                customSectionList: {
                    baseCollection: null,
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                    sorter: null
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: pmc_mail_1.component.remotehostlist.ElementCountsAggregationStrategy.SECTIONS,
                },
                conv2ListEnabled: true,
                conv2Splitter: _this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: [],
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push({
                    id: "new-section",
                    label: _this.i18n("plugin.calendar.window.calendar.sidebar.newsection"),
                    title: _this.i18n("plugin.calendar.window.calendar.sidebar.newsection"),
                    icon: "ico-comment",
                    windowOpener: true,
                    onSectionList: true
                });
            }
            _this.sidebar = _this.addComponent("sidebar", _this.componentFactory.createComponent("sidebar", [_this, sidebarOptions]));
            _this.bindEvent(_this.sidebar, "elementbeforeactivate", _this.onBeforeActivateSidebarElement.bind(_this));
            _this.bindEvent(_this.sidebar, "elementactivated", _this.onActivatedSidebarElement.bind(_this));
            _this.bindEvent(_this.sidebar, "sidebarbuttonaction", _this.onSidebarButtonAction.bind(_this));
            _this.sidebar.usersListTooltip.getContent = function (sectionId) {
                return _this.app.getUsersListTooltipContent(_this.app.sessionManager.getLocalSession(), sectionId);
            };
            _this.bindEvent(_this.app, "reopen-section", function (event) {
                _this.selectProject(localSession, event.element.getId());
            });
            _this.bindEvent(_this.app, "sectionsLimitReached", function (event) {
                _this.sidebar.onSectionsLimitReached(event.reached);
            });
            _this.calendarTasksCountManager.sidebar = _this.sidebar;
            _this.initSessionEvents(localSession);
            _this.setSidebarActiveItem(_this.getActiveSession(), _this.activeProjectId);
            _this.bindEvent(_this.app, "calendar-search-update", function (event) {
                var refreshAvatars = _this.updateSidebarCustomElements(_this.app.sessionManager.getLocalSession(), _this.sidebar.customElementList.customElementsCollection);
                _this.updateBadges();
                _this.callViewMethod("onSearchChanged", event.searchString.length > 0, refreshAvatars);
            });
            _this.app.dispatchEvent({ type: "focusChanged", windowId: "tasks" });
            return _this.calendarPlugin.checkInit().then(function () { return _this.calendarPlugin.tasksPlugin.projectsReady; }).then(function () {
                return _this.datePicker.init();
            }).then(function () {
                return _this.previewPanel.init();
            })
                .then(function () {
                _this.selectProject(_this.getActiveSession(), _this.activeProjectId);
            });
        });
    };
    CalendarWindowController.prototype.getActiveSession = function () {
        if (this.activeProjectHostHash && this.app.sessionManager.isSessionExistsByHostHash(this.activeProjectHostHash)) {
            return this.app.sessionManager.getSessionByHostHash(this.activeProjectHostHash);
        }
        return this.app.sessionManager.getLocalSession();
    };
    CalendarWindowController.prototype.isSectionPrimary = function (session, section) {
        var cps = this.calendarPlugin.calendarPrimarySections;
        return cps && cps[session.hostHash].contains(section);
    };
    CalendarWindowController.prototype.openDisabledSectionView = function (session, section) {
        this.sidebar.setActive({
            type: this.isSectionPrimary(session, section) ? pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION : pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
            section: section,
        }, false);
        this.calendarPlugin.activeSinkId = section.getChatSink().id;
        this.calendarPlugin.activeSinkHostHash = session.hostHash;
        this.disabledSection.setSection(section);
        this.callViewMethod("toggleDisabledSection", true);
    };
    CalendarWindowController.prototype.updateSidebarCustomElements = function (session, collection, all) {
        if (all === void 0) { all = false; }
        var hostHash = session.hostHash;
        var refreshAvatars = false;
        var len = collection.size();
        for (var i = 0; i < len; ++i) {
            var el = collection.get(i);
            if (all || this.calendarPlugin.searchCountsModified[hostHash][el.id]) {
                collection.triggerUpdateAt(i);
                if (el.icon.type == "hashmail") {
                    refreshAvatars = true;
                }
            }
        }
        return refreshAvatars;
    };
    CalendarWindowController.prototype.updateSidebarSections = function (session, collection, all) {
        if (all === void 0) { all = false; }
        var hostHash = session.hostHash;
        var len = collection.size();
        for (var i = 0; i < len; ++i) {
            if (all || this.calendarPlugin.searchCountsModified[hostHash][collection.get(i).getId()]) {
                collection.triggerUpdateAt(i);
            }
        }
    };
    CalendarWindowController.prototype.updateConv2Sections = function (session, collection, all) {
        if (all === void 0) { all = false; }
        var hostHash = session.hostHash;
        var len = collection.size();
        for (var i = 0; i < len; ++i) {
            if (all || this.calendarPlugin.searchCountsModified[hostHash][collection.get(i).id]) {
                collection.triggerUpdateAt(i);
            }
        }
    };
    CalendarWindowController.prototype.onBeforeActivateSidebarElement = function (event) {
        var localSession = this.app.sessionManager.getLocalSession();
        event.result = false;
        if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.HOST) {
            this.expandRemoteSectionsList(event.element.host);
        }
        if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                contextType: "section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: localSession.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.section.getId());
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
            var session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                contextType: "remote-section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: event.element.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(session, event.element.section.getId());
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            var session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                contextType: "remote-conversation",
                contextId: event.element.conv2.id,
                hostHash: event.element.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(session, event.element.conv2.id);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                contextType: "custom",
                contextId: event.element.customElement.id,
                hostHash: localSession.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.customElement.id);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                contextType: "conversation",
                contextId: event.element.conv2.id,
                hostHash: localSession.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.conv2.id);
        }
    };
    CalendarWindowController.prototype.onSidebarButtonAction = function (event) {
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }
    };
    CalendarWindowController.prototype.openSectionsWindow = function () {
        this.app.openNewSectionDialogFromSidebar();
    };
    CalendarWindowController.prototype.onActivatedSidebarElement = function (event) {
    };
    CalendarWindowController.prototype.onSinkChange = function (session, event) {
        if (event.element == null) {
            return;
        }
        var section = session.sectionManager.getSectionBySinkIndex(event.element);
        if (section == null) {
            return;
        }
        if (session.hostHash == this.app.sessionManager.getLocalSession().hostHash) {
            this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
        }
        else {
            var list = this.sidebar.remoteSectionsLists[session.hostHash];
            if (list) {
                list.sortedCollection.triggerBaseUpdateElement(section);
            }
        }
    };
    CalendarWindowController.prototype.getUnread = function (session, section, skipMuted) {
        if (skipMuted === void 0) { skipMuted = false; }
        return 0;
    };
    CalendarWindowController.prototype.applyHistoryState = function (processed, state) {
        var usedState = state;
        var localSession = this.app.sessionManager.getLocalSession();
        var context = this.contextHistory.getCurrent();
        if (context) {
            if (this.app.switchModuleWithContext() || state) {
                if (context.getType() == "section") {
                    var contextSection = localSession.sectionManager.getSection(context.getSectionIdFromContextId());
                    if (contextSection && contextSection.isCalendarModuleEnabled()) {
                        usedState = context.getSectionIdFromContextId();
                    }
                }
                else if (context.getType() == "conversation") {
                    var contextData = context.getContextId().split(":");
                    if (contextData[2].split("|").length < 3) {
                        usedState = context.getContextId();
                    }
                }
                else if (context.getType() == "custom") {
                    var subId = context.getContextId();
                    if (subId == "private") {
                        var privateSection = localSession.sectionManager.getMyPrivateSection();
                        if (privateSection) {
                            usedState = privateSection.getId();
                        }
                    }
                    else {
                        usedState = subId;
                    }
                }
            }
        }
        this.app.resetModuleSwitchingModifier();
        if (usedState != null) {
            this.historyStateProjectId = usedState;
            if (this.activeProjectId !== usedState && this.activeProjectHostHash !== localSession.hostHash) {
                this.activeProjectId = usedState;
                this.activeProjectHostHash = localSession.hostHash;
                this.selectProject(localSession, usedState);
            }
        }
    };
    CalendarWindowController.prototype.updateBadges = function () {
        this.updateSidebarCustomElements(this.app.sessionManager.getLocalSession(), this.sidebar.customElementList.customElementsCollection, true);
        this.updateSidebarSections(this.app.sessionManager.getLocalSession(), this.sidebar.sectionList.sortedCollection, true);
        this.updateConv2Sections(this.app.sessionManager.getLocalSession(), this.sidebar.conv2List.sortedCollection, true);
        this.sidebar.conv2List.sortedCollection.refresh();
        this.sidebar.sectionList.sortedCollection.refresh();
        for (var hostHash in this.sidebar.remoteSectionsLists) {
            var rsl = this.sidebar.remoteSectionsLists[hostHash];
            this.updateSidebarSections(this.app.sessionManager.getSessionByHostHash(hostHash), rsl.sortedCollection, true);
            rsl.sortedCollection.refresh();
        }
        for (var hostHash in this.sidebar.remoteConv2Lists) {
            var rsl = this.sidebar.remoteConv2Lists[hostHash];
            this.updateConv2Sections(this.app.sessionManager.getSessionByHostHash(hostHash), rsl.sortedCollection, true);
            rsl.sortedCollection.refresh();
        }
        for (var hostHash in this.remoteCalendarTasksCountManagers) {
            this.remoteCalendarTasksCountManagers[hostHash].updateSidebarHostElement();
        }
    };
    CalendarWindowController.prototype.getModel = function () {
        var localSession = this.app.sessionManager.getLocalSession();
        return {
            docked: this.docked,
            myId: this.calendarPlugin.getMyId(this.app.sessionManager.getLocalSession()),
            activeProjectId: this.activeProjectId,
            privateSectionId: this.calendarPlugin.getPrivateSectionId(),
            horizontalTaskLayout: this.calendarPlugin.getSetting(localSession, "horizontal-task-preview-window-layout", null, null) ? true : false,
            enableDayPreviewPanel: this.calendarPlugin.getSetting(localSession, "enable-day-preview-panel", null, null) ? true : false,
            showTaskPreviewPanel: this.calendarPlugin.getSetting(localSession, "show-task-preview-panel", null, null) ? true : false,
            showTaskTooltip: this.calendarPlugin.getSetting(localSession, "show-task-tooltip", null, null) ? true : false,
        };
    };
    CalendarWindowController.prototype.setSidebarActiveItem = function (session, projectId) {
        var fixedSectionsNames = [
            Types_1.CustomTasksElements.ALL_TASKS_ID,
            Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            Types_1.CustomTasksElements.TRASH_ID,
            this.calendarPlugin.getPrivateSectionId(),
        ];
        if (session.sessionType == "local") {
            if (fixedSectionsNames.indexOf(projectId) >= 0) {
                this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                    customElement: this.sidebar.options.customElementList.baseCollection.find(function (x) { return x.id == projectId; }),
                }, false);
                this.calendarPlugin.activeSinkId = null;
                this.calendarPlugin.activeSinkHostHash = null;
            }
            else if (this.calendarPlugin.tasksPlugin.isConv2Project(projectId)) {
                var conv2 = this.calendarPlugin.conv2Service.collection.find(function (c2s) { return c2s.id == projectId; });
                this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION,
                    conv2: conv2,
                }, false);
                this.calendarPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
            else if (session.sectionManager.getSection(projectId)) {
                this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
                    section: session.sectionManager.getSection(projectId),
                }, false);
                this.calendarPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
        }
        else if (session.sessionType == "remote") {
            if (this.calendarPlugin.tasksPlugin.isConv2Project(projectId)) {
                var conv2 = session.conv2Service.collection.find(function (c2s) { return c2s.id == projectId; });
                this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                    conv2: conv2,
                    hostHash: session.hostHash,
                }, false);
                this.calendarPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
            else if (session.sectionManager.getSection(projectId)) {
                this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION,
                    section: session.sectionManager.getSection(projectId),
                    hostHash: session.hostHash,
                }, false);
                this.calendarPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
        }
    };
    CalendarWindowController.prototype.selectProject = function (session, projectId) {
        var _this = this;
        if (!this.sidebar) {
            return;
        }
        var fixedSectionsNames = [
            Types_1.CustomTasksElements.ALL_TASKS_ID,
            Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            Types_1.CustomTasksElements.TRASH_ID,
            this.calendarPlugin.getPrivateSectionId(),
        ];
        this.setSidebarActiveItem(session, projectId);
        var activeId;
        var rootId;
        this.callViewMethod("toggleDisabledSection", false);
        var prom1 = pmc_mail_1.Q();
        var prom2 = pmc_mail_1.Q();
        if (fixedSectionsNames.indexOf(projectId) >= 0) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                contextType: "custom",
                contextId: projectId,
                hostHash: session.hostHash
            });
            this.contextHistory.append(context);
            activeId = projectId;
            rootId = projectId;
            if (projectId == this.calendarPlugin.getPrivateSectionId()) {
                if (this.privateSection) {
                    prom1 = this.openCalendar1Panel(session, this.privateSection);
                    prom2 = this.openCalendar2Panel(session, this.privateSection);
                }
            }
            else {
                prom1 = this.openCalendar1Panel(session, projectId);
                prom2 = this.openCalendar2Panel(session, projectId);
            }
        }
        else if (this.calendarPlugin.tasksPlugin.isConv2Project(projectId)) {
            var c2s_1 = this.calendarPlugin.tasksPlugin.getConv2Section(session, projectId);
            if (c2s_1) {
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                    contextType: "conversation",
                    contextId: projectId,
                    hostHash: session.hostHash
                });
                this.contextHistory.append(context);
                this.afterViewLoaded.promise.then(function () {
                    prom1 = _this.openCalendar1Panel(session, c2s_1);
                    prom2 = _this.openCalendar2Panel(session, c2s_1);
                });
                activeId = c2s_1.id;
                rootId = c2s_1.id;
            }
        }
        else {
            var section = session.sectionManager.getSection(projectId);
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
                contextType: "section",
                contextId: "section:" + projectId,
                hostHash: session.hostHash
            });
            this.contextHistory.append(context);
            if (section instanceof pmc_mail_1.mail.section.SectionService && !section.isCalendarModuleEnabled()) {
                this.disabledSection.setSection(section);
                this.callViewMethod("toggleDisabledSection", true);
                return;
            }
            var state_1 = session.sectionManager.getDescantsForModule(projectId, "calendar");
            if (state_1 == null) {
                return;
            }
            this.afterViewLoaded.promise.then(function () {
                prom1 = _this.openCalendar1Panel(session, state_1.active);
                prom2 = _this.openCalendar2Panel(session, state_1.active);
            });
            activeId = state_1.active.getId();
            rootId = state_1.active.getId();
        }
        var enableDayPreview = !!this.calendarPlugin.getSetting(this.getActiveSession(), "enable-day-preview-panel", this.activeProjectId, Types_1.ViewContext.CalendarWindow);
        this.afterViewLoaded.promise.then(function () {
            pmc_mail_1.Q.all([prom1, prom2]).then(function () {
                return _this.onToggleDayPreviewPanel(enableDayPreview, activeId, session);
            });
        });
    };
    CalendarWindowController.prototype.onSectionsCollectionChange = function (session, event) {
        if (event.type == "remove" && event.element) {
            var countsManager = null;
            var customElementList = null;
            var sectionList = null;
            var conv2List = null;
            if (session.hostHash == this.app.sessionManager.getLocalSession().hostHash) {
                countsManager = this.calendarTasksCountManager;
                customElementList = this.sidebar.customElementList;
                sectionList = this.sidebar.sectionList;
                conv2List = this.sidebar.conv2List;
            }
            else {
                countsManager = this.getOrCreateRemoteTasksCountManager(session.hostHash);
                customElementList = null;
                sectionList = this.sidebar.remoteSectionsLists[session.hostHash];
                conv2List = this.sidebar.remoteConv2Lists[session.hostHash];
            }
            if (countsManager) {
                countsManager.conv2Count = {};
                countsManager.customsCount = {};
                countsManager.sectionsCount = {};
            }
            if (customElementList) {
                this.updateSidebarCustomElements(session, customElementList.customElementsCollection, true);
            }
            if (sectionList) {
                this.updateSidebarSections(session, sectionList.sortedCollection, true);
            }
            if (conv2List) {
                this.updateConv2Sections(session, conv2List.sortedCollection, true);
            }
        }
    };
    CalendarWindowController.prototype.setActiveProjectId = function (session, value) {
        this.activeProjectId = value;
        this.activeProjectHostHash = session.hostHash;
    };
    CalendarWindowController.prototype.getProjectId = function (section) {
        if (section instanceof pmc_mail_1.mail.section.Conv2Section) {
            return section.id;
        }
        return typeof (section) == "string" ? section : (section ? section.getId() : null);
    };
    CalendarWindowController.prototype.getCalendar1Panel = function (session, section) {
        return this.createCalendar1Panel(session, this.getProjectId(section));
    };
    CalendarWindowController.prototype.createCalendar1Panel = function (session, projectId) {
        var _this = this;
        var calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
        if (calendarPanelKey in this.calendar1PanelPromises) {
            return this.calendar1PanelPromises[calendarPanelKey];
        }
        var panel = this.addComponent("calendar1Panel-" + calendarPanelKey, this.componentFactory.createComponent("calendarPanel", [this, this.personsComponent]));
        return this.calendar1PanelPromises[calendarPanelKey] = pmc_mail_1.Q().then(function () {
            return _this.calendarPlugin.initSession(session);
        })
            .then(function () {
            return panel.setSession(session);
        })
            .then(function () {
            panel.calendarId = 1;
            panel.init();
            _this.bindEvent(panel, "calendar-task-preview-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.previewPanel.setTaskId(session, event.task);
                    var calendarPanelKey = _this.getCalendarPanelKey(session.hostHash, projectId);
                    var otherPanelPromise = _this.calendar2PanelPromises[calendarPanelKey];
                    if (otherPanelPromise) {
                        otherPanelPromise.then(function (otherPanel) { return otherPanel.markTaskAsSelected(event.task); });
                    }
                    if (!event.task) {
                        return;
                    }
                    var task = _this.calendarPlugin.tasksPlugin.tasks[session.hostHash][event.task];
                    if (task && _this.calendarPlugin.wasTaskUnread(session, task, task.getProjectId())) {
                        _this.calendarPlugin.markTaskAsWatched(session, task.getId(), task.getProjectId());
                        _this.updateBadges();
                    }
                });
            });
            _this.bindEvent(panel, "calendar-day-preview-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.previewDay(event.day);
                });
            });
            _this.bindEvent(panel, "calendar-preview-update-request", function () {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.previewPanel.updateView();
                });
            });
            _this.bindEvent(panel, "calendar-day-preview-change-visibility-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () { return __awaiter(_this, void 0, void 0, function () {
                    var canFirstCalendarShowPreview;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4, this.canFirstCalendarShowPreview(session)];
                            case 1:
                                canFirstCalendarShowPreview = _a.sent();
                                this.callViewMethod("changeDayPreviewPanelVisibility", !canFirstCalendarShowPreview && event.show);
                                return [2];
                        }
                    });
                }); });
            });
            _this.bindEvent(panel, "calendar-task-preview-change-visibility-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("changeTaskPreviewPanelVisibility", event.show);
                });
            });
            _this.bindEvent(panel, "horizontal-calendar-task-preview-window-layout-change-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("updatePreviewLocation", event.horizontalLayout);
                });
            });
            _this.bindEvent(panel, "calendar-badges-update-request", function (event) {
                _this.afterViewLoaded.promise.then(function () {
                    _this.updateBadges();
                });
            });
            _this.afterViewLoaded.promise.then(function () {
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("createCalendar1Panel", session.hostHash, projectId);
                });
            });
            return pmc_mail_1.Q(panel);
        });
    };
    CalendarWindowController.prototype.openCalendar1Panel = function (session, section) {
        return this.openRemoteCalendar1Panel(session.hostHash, section);
    };
    CalendarWindowController.prototype.openRemoteCalendar1Panel = function (hostHash, section) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.init(hostHash);
        })
            .then(function () {
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            _this.calendarPlugin.tasksPlugin.ensureSessionInit(session);
            _this.calendarPlugin.tasksPlugin.ensureInitSessionCollections(session);
            return _this.afterViewLoaded.promise.then(function () {
                var projectId = typeof section == "string" ? section : _this.getProjectId(section);
                if (section instanceof pmc_mail_1.mail.section.SectionService) {
                    return _this.calendarPlugin.tasksPlugin.ensureProjectExists(projectId, section.getName(), session);
                }
            })
                .then(function () {
                return _this.getCalendar1Panel(session, section).then(function (panel) {
                    if (!panel.wasDataSet) {
                        return panel.setSectionData(section).then(function () { return pmc_mail_1.Q(panel); });
                    }
                    return panel;
                })
                    .then(function (panel) {
                    _this.activeProjectId = _this.getProjectId(section);
                    _this.activeProjectHostHash = hostHash;
                    if (_this.activePanel1) {
                        _this.activePanel1.deactivate();
                    }
                    panel.beforeActivate();
                    _this.activePanel1 = panel;
                    panel.activate();
                    _this.afterViewLoaded.promise.then(function () {
                        _this.callViewMethod("openCalendar1Panel", session.hostHash, _this.getProjectId(section));
                    });
                });
            });
        });
    };
    CalendarWindowController.prototype.getCalendar2Panel = function (session, section) {
        return this.createCalendar2Panel(session, this.getProjectId(section));
    };
    CalendarWindowController.prototype.createCalendar2Panel = function (session, projectId) {
        var _this = this;
        var calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
        if (calendarPanelKey in this.calendar2PanelPromises) {
            return this.calendar2PanelPromises[calendarPanelKey];
        }
        var panel = this.addComponent("calendar2Panel-" + calendarPanelKey, this.componentFactory.createComponent("calendarPanel", [this, this.personsComponent]));
        return this.calendar2PanelPromises[calendarPanelKey] = pmc_mail_1.Q().then(function () {
            return _this.calendarPlugin.initSession(session);
        })
            .then(function () {
            return panel.setSession(session);
        })
            .then(function () {
            panel.calendarId = 2;
            panel.init();
            _this.bindEvent(panel, "calendar-task-preview-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                var sess = _this.app.sessionManager.getSessionByHostHash(event.hostHash);
                _this.afterViewLoaded.promise.then(function () {
                    _this.previewPanel.setTaskId(sess, event.task);
                    var calendarPanelKey = _this.getCalendarPanelKey(session.hostHash, projectId);
                    var otherPanelPromise = _this.calendar1PanelPromises[calendarPanelKey];
                    if (otherPanelPromise) {
                        otherPanelPromise.then(function (otherPanel) { return otherPanel.markTaskAsSelected(event.task); });
                    }
                    if (!event.task) {
                        return;
                    }
                    var task = _this.calendarPlugin.tasksPlugin.tasks[sess.hostHash][event.task];
                    if (task && _this.calendarPlugin.wasTaskUnread(sess, task, task.getProjectId())) {
                        _this.calendarPlugin.markTaskAsWatched(sess, task.getId(), task.getProjectId());
                        _this.updateBadges();
                    }
                });
            });
            _this.bindEvent(panel, "calendar-preview-update-request", function () {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.previewPanel.updateView();
                });
            });
            _this.bindEvent(panel, "calendar-day-preview-change-visibility-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () { return __awaiter(_this, void 0, void 0, function () {
                    var canFirstCalendarShowPreview;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4, this.canFirstCalendarShowPreview(session)];
                            case 1:
                                canFirstCalendarShowPreview = _a.sent();
                                this.callViewMethod("changeDayPreviewPanelVisibility", !canFirstCalendarShowPreview && event.show);
                                return [2];
                        }
                    });
                }); });
            });
            _this.bindEvent(panel, "calendar-task-preview-change-visibility-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("changeTaskPreviewPanelVisibility", event.show);
                });
            });
            _this.bindEvent(panel, "horizontal-calendar-task-preview-window-layout-change-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("updatePreviewLocation", event.horizontalLayout);
                });
            });
            _this.bindEvent(panel, "calendar-badges-update-request", function (event) {
                _this.afterViewLoaded.promise.then(function () {
                    _this.updateBadges();
                });
            });
            _this.afterViewLoaded.promise.then(function () {
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("createCalendar2Panel", session.hostHash, projectId);
                });
            });
            return pmc_mail_1.Q(panel);
        });
    };
    CalendarWindowController.prototype.openCalendar2Panel = function (session, section) {
        return this.openRemoteCalendar2Panel(session.hostHash, section);
    };
    CalendarWindowController.prototype.openRemoteCalendar2Panel = function (hostHash, section) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.init(hostHash);
        })
            .then(function () {
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            _this.calendarPlugin.tasksPlugin.ensureSessionInit(session);
            _this.calendarPlugin.tasksPlugin.ensureInitSessionCollections(session);
            return _this.afterViewLoaded.promise.then(function () {
                var projectId = typeof section == "string" ? section : _this.getProjectId(section);
                if (section instanceof pmc_mail_1.mail.section.SectionService) {
                    return _this.calendarPlugin.tasksPlugin.ensureProjectExists(projectId, section.getName(), session);
                }
            })
                .then(function () {
                return _this.getCalendar2Panel(session, section).then(function (panel) {
                    if (!panel.wasDataSet) {
                        return panel.setSectionData(section).then(function () { return pmc_mail_1.Q(panel); });
                    }
                    return panel;
                })
                    .then(function (panel) {
                    _this.activeProjectId = _this.getProjectId(section);
                    _this.activeProjectHostHash = hostHash;
                    if (_this.activePanel2) {
                        _this.activePanel2.deactivate();
                    }
                    panel.beforeActivate();
                    _this.activePanel2 = panel;
                    panel.activate();
                    _this.afterViewLoaded.promise.then(function () {
                        _this.callViewMethod("openCalendar2Panel", session.hostHash, _this.getProjectId(section));
                    });
                });
            });
        });
    };
    CalendarWindowController.prototype.updateDirty = function (dirty) {
        this.dirty = dirty;
    };
    CalendarWindowController.prototype.onToggleDayPreviewPanel = function (show, projectId, session) {
        if (projectId === void 0) { projectId = null; }
        if (session === void 0) { session = null; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (projectId === null) {
                    projectId = this.activeProjectId;
                }
                if (session === null) {
                    session = this.getActiveSession();
                }
                if (show) {
                    return [2, this.onEnableDayPreviewPanel(session, projectId)];
                }
                else {
                    return [2, this.onHideDayPreviewPanel(session, projectId)];
                }
                return [2];
            });
        });
    };
    CalendarWindowController.prototype.onEnableDayPreviewPanel = function (session, projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, calendarPanelKey, panel1Promise, panel2Promise, panel1, panel2, d, m, y, now;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
                        panel1Promise = this.calendar1PanelPromises[calendarPanelKey];
                        panel2Promise = this.calendar2PanelPromises[calendarPanelKey];
                        if (!panel1Promise || !panel2Promise) {
                            return [2, false];
                        }
                        return [4, panel1Promise];
                    case 1:
                        panel1 = _b.sent();
                        return [4, panel2Promise];
                    case 2:
                        panel2 = _b.sent();
                        if (!panel1 || !panel2) {
                            return [2, false];
                        }
                        if (!panel1.afterUserGoToToday) {
                            panel1.afterUserGoToToday = function () {
                                var now = new Date();
                                panel1.setSelectedDate(now.getDate(), now.getMonth(), now.getFullYear());
                                panel2.setSelectedDate(now.getDate(), now.getMonth(), now.getFullYear());
                            };
                        }
                        if (!panel2.afterUserPreviewDayChange) {
                            panel2.afterUserPreviewDayChange = function (d, m, y) {
                                panel1.setSelectedDate(d, m, y);
                            };
                        }
                        if (!panel1.modeChanged) {
                            panel1.modeChanged = function (mode) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(mode == Types_1.Modes.SINGLE_DAY || (!CalendarWindowController_1.ENABLE_PREVIEW_IN_WEEK_MODE && (mode == Types_1.Modes.SINGLE_WEEK || mode == Types_1.Modes.WEEK)))) return [3, 2];
                                            return [4, this.ensureDayPreviewState(session, false)];
                                        case 1:
                                            _a.sent();
                                            return [3, 4];
                                        case 2: return [4, this.ensureDayPreviewState(session, true)];
                                        case 3:
                                            _a.sent();
                                            _a.label = 4;
                                        case 4: return [2];
                                    }
                                });
                            }); };
                        }
                        panel2.overrideMode(Types_1.Modes.SINGLE_DAY);
                        if (panel1.previewDay) {
                            _a = panel1.previewDay.split(".").map(function (x) { return parseInt(x); }), d = _a[0], m = _a[1], y = _a[2];
                        }
                        else if (panel1.currDataModel) {
                            d = panel1.currDataModel.selectedDay;
                            m = panel1.currDataModel.selectedMonth;
                            y = panel1.currDataModel.selectedYear;
                        }
                        else {
                            now = new Date();
                            d = now.getDate();
                            m = now.getMonth();
                            y = now.getFullYear();
                        }
                        panel2.goToDate(d, m, y);
                        return [2, true];
                }
            });
        });
    };
    CalendarWindowController.prototype.onHideDayPreviewPanel = function (session, projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var calendarPanelKey, panel1Promise, panel2Promise, panel1, panel2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
                        panel1Promise = this.calendar1PanelPromises[calendarPanelKey];
                        panel2Promise = this.calendar2PanelPromises[calendarPanelKey];
                        if (!panel1Promise || !panel2Promise) {
                            return [2, false];
                        }
                        return [4, panel1Promise];
                    case 1:
                        panel1 = _a.sent();
                        return [4, panel2Promise];
                    case 2:
                        panel2 = _a.sent();
                        if (!panel1 || !panel2) {
                            return [2, false];
                        }
                        panel1.overrideMode(null);
                        panel2.overrideMode(null);
                        return [2, true];
                }
            });
        });
    };
    CalendarWindowController.prototype.previewDay = function (day) {
        return __awaiter(this, void 0, void 0, function () {
            var projectId, session, calendarPanelKey, panel2Promise, panel2, _a, d, m, y;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        projectId = this.activeProjectId;
                        session = this.getActiveSession();
                        calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
                        panel2Promise = this.calendar2PanelPromises[calendarPanelKey];
                        return [4, this.ensureDayPreviewState(session, true)];
                    case 1:
                        _b.sent();
                        if (!panel2Promise) {
                            return [2];
                        }
                        return [4, panel2Promise];
                    case 2:
                        panel2 = _b.sent();
                        if (panel2 && panel2.currDataModel && day) {
                            _a = day.split(".").map(function (x) { return parseInt(x); }), d = _a[0], m = _a[1], y = _a[2];
                            panel2.goToDate(d, m, y);
                        }
                        return [2];
                }
            });
        });
    };
    CalendarWindowController.prototype.onDataChanged = function (type, id, action) {
        if (type == "task" && this.calendarTasksCountManager != null) {
            this.calendarTasksCountManager.updateTasksCount(id, action);
        }
    };
    CalendarWindowController.prototype.onRemoteDataChanged = function (type, id, action, hostHash) {
        if (type == "task") {
            this.getOrCreateRemoteTasksCountManager(hostHash).updateTasksCount(id, action);
        }
    };
    CalendarWindowController.prototype.closeDayPreview = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.ensureDayPreviewState(session, false)];
                    case 1:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    CalendarWindowController.prototype.onViewCloseDayPreview = function () {
        this.closeDayPreview(this.getActiveSession());
    };
    CalendarWindowController.prototype.ensureDayPreviewState = function (session, enabled) {
        return __awaiter(this, void 0, void 0, function () {
            var canFirstCalendarShowPreview;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.canFirstCalendarShowPreview(session)];
                    case 1:
                        canFirstCalendarShowPreview = _a.sent();
                        if (canFirstCalendarShowPreview) {
                            enabled = false;
                        }
                        if (this.calendarPlugin.getSetting(session, "enable-day-preview-panel", null, null)) {
                            this.callViewMethod("changeDayPreviewPanelVisibility", enabled);
                        }
                        return [2];
                }
            });
        });
    };
    CalendarWindowController.prototype.canFirstCalendarShowPreview = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            var calendarPanelKey, panel1Promise, panel1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calendarPanelKey = this.getCalendarPanelKey(session.hostHash, this.activeProjectId);
                        panel1Promise = this.calendar1PanelPromises[calendarPanelKey];
                        if (!panel1Promise) {
                            return [2, false];
                        }
                        return [4, panel1Promise];
                    case 1:
                        panel1 = _a.sent();
                        return [2, panel1 && (panel1.currMode == Types_1.Modes.SINGLE_DAY || (!CalendarWindowController_1.ENABLE_PREVIEW_IN_WEEK_MODE && (panel1.currMode == Types_1.Modes.SINGLE_WEEK || panel1.currMode == Types_1.Modes.WEEK)))];
                }
            });
        });
    };
    CalendarWindowController.prototype.onViewRefresh = function () {
        if (this.activePanel1) {
            this.activePanel1.onViewRefresh(true, true);
        }
        if (this.activePanel2) {
            this.activePanel2.onViewRefresh(true, true);
        }
    };
    CalendarWindowController.prototype.refreshSidebarCounts = function () {
        this.calendarTasksCountManager.refresh();
        for (var hostHash in this.remoteCalendarTasksCountManagers) {
            this.remoteCalendarTasksCountManagers[hostHash].refresh();
        }
        this.sidebar.refresh();
        for (var hostHash in this.remoteCalendarTasksCountManagers) {
            this.sidebar.remoteSectionsLists[hostHash].refresh();
            this.sidebar.remoteConv2Lists[hostHash].refresh();
            this.remoteCalendarTasksCountManagers[hostHash].updateSidebarHostElement();
        }
    };
    CalendarWindowController.prototype.expandRemoteSectionsList = function (hostEntry) {
        var _this = this;
        var session;
        var hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        var checkSessionExists = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if (checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        var watchEvents = false;
        if (!this.remoteDataChangedListeners[hostHash]) {
            watchEvents = true;
            this.remoteDataChangedListeners[hostHash] = function (t, i, a) { return _this.onRemoteDataChanged(t, i, a, hostHash); };
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
            if (watchEvents) {
                _this.calendarPlugin.tasksPlugin.watch(session, "*", "*", "*", _this.remoteDataChangedListeners[hostHash]);
            }
            return pmc_mail_1.Q.all(_this.calendarPlugin.tasksPlugin.tasksSectionsCollection[session.hostHash].list.map(function (x) { return _this.calendarPlugin.tasksPlugin.ensureProjectExists(x.getId(), x.getName(), session); }));
        })
            .then(function () {
            return _this.calendarPlugin.initSession(session);
        })
            .then(function () {
            _this.initSessionEvents(session);
            if (!_this.remoteServers) {
                _this.remoteServers = {};
            }
            _this.initRemoteHostComponents(hostEntry, session);
            _this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
        })
            .then(function () {
            var rtcm = _this.getOrCreateRemoteTasksCountManager(hostHash);
            rtcm.updateSidebarHostElement();
            _this.refreshSidebarCounts();
        });
    };
    CalendarWindowController.prototype.initSessionEvents = function (session) {
        var _this = this;
        this.bindEvent(session.sectionManager.sectionAccessManager.eventDispatcher, "section-state-changed", function (event) {
            if (_this.activePanel1 && _this.activeProjectId == event.sectionId && _this.activeProjectHostHash == session.hostHash) {
                pmc_mail_1.Q().then(function () {
                    return session.sectionManager.load();
                })
                    .then(function () {
                    var section = session.sectionManager.getSection(event.sectionId);
                    var moduleEnabled = section.isCalendarModuleEnabled();
                    if (!moduleEnabled) {
                        _this.openDisabledSectionView(session, section);
                    }
                    else {
                        _this.selectProject(session, section.getId());
                    }
                });
            }
        });
        this.registerChangeEvent(this.calendarPlugin.tasksPlugin.tasksSectionsCollectionNoPrivate[session.hostHash].changeEvent, function (event) { return _this.onSectionsCollectionChange(session, event); });
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.sinkIndexCollection.changeEvent, function (event) { return _this.onSinkChange(session, event); });
    };
    CalendarWindowController.prototype.initRemoteHostComponents = function (hostEntry, session) {
        var _this = this;
        var hostHash = session.hostHash;
        if (this.checkRemoteHostComponentsInitialized(hostHash)) {
            return;
        }
        var sectionsListOptions = {
            baseCollection: session.sectionManager.filteredCollection,
            unreadProvider: function (section) { return _this.getUnread(session, section); },
            elementsCountProvider: function (section) { return _this.getRemoteSectionElementsCount(hostHash, section); },
            searchCountProvider: function (section) { return _this.calendarPlugin.getSearchCount(session, section); },
            searchAllSearchedProvider: null,
            sorter: function (a, b) {
                var res = _this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(b) - _this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(a);
                return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: pmc_mail_1.Types.section.NotificationModule.CALENDAR,
            checkShowAllAvailSections: false,
            session: session,
        };
        var conv2ListOptions = {
            elementsCountProvider: function (conversation) { return _this.getRemoteConversationElementsCount(hostHash, conversation); },
            unreadProvider: function (conversation) { return _this.getUnread(session, conversation); },
            searchCountProvider: function (conversation) { return _this.calendarPlugin.getSearchCount(session, conversation); },
            searchAllSearchedProvider: null,
            sorter: function (a, b) {
                return _this.getOrCreateRemoteTasksCountManager(hostHash).getConv2LastDate(b) - _this.getOrCreateRemoteTasksCountManager(hostHash).getConv2LastDate(a);
            },
            hideConversations: true,
            assignedTo: true,
            session: session,
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
    CalendarWindowController.prototype.checkRemoteHostComponentsInitialized = function (hostHash) {
        var ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    };
    CalendarWindowController.prototype.getOrCreateRemoteTasksCountManager = function (hostHash) {
        if (!(hostHash in this.remoteCalendarTasksCountManagers)) {
            var session = this.app.sessionManager.getSessionByHostHash(hostHash);
            this.remoteCalendarTasksCountManagers[hostHash] = new CalendarTasksCountManager_1.CalendarTasksCountManager(session, null, this.calendarPlugin, this.calendarPlugin.tasksPlugin, this.sidebar, !!this.calendarPlugin.getSetting(session, "show-files", null, null), true);
        }
        return this.remoteCalendarTasksCountManagers[hostHash];
    };
    CalendarWindowController.prototype.getRemoteSectionElementsCount = function (hostHash, section) {
        var rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getSectionElementsCount(section);
    };
    CalendarWindowController.prototype.getRemoteConversationElementsCount = function (hostHash, conversation) {
        var rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getConv2ElementsCount(conversation);
    };
    CalendarWindowController.prototype.getCalendarPanelKey = function (hostHash, projectId) {
        return hostHash + "--" + projectId;
    };
    CalendarWindowController.prototype.onViewHistoryArrowLeft = function () {
        this.router.goPrev();
    };
    CalendarWindowController.prototype.onViewHistoryArrowRight = function () {
        this.router.goNext();
    };
    var CalendarWindowController_1;
    CalendarWindowController.textsPrefix = "plugin.calendar.window.calendar.";
    CalendarWindowController.ENABLE_PREVIEW_IN_WEEK_MODE = false;
    __decorate([
        Inject
    ], CalendarWindowController.prototype, "router", void 0);
    CalendarWindowController = CalendarWindowController_1 = __decorate([
        Dependencies(["splitter", "extlist", "persons", "notification", "calendarPanel", "sidebar"])
    ], CalendarWindowController);
    return CalendarWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.CalendarWindowController = CalendarWindowController;
CalendarWindowController.prototype.className = "com.privmx.plugin.calendar.window.calendar.CalendarWindowController";

//# sourceMappingURL=CalendarWindowController.js.map
