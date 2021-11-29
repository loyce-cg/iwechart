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
var Types_1 = require("../../main/Types");
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var TasksCountManager_1 = require("./TasksCountManager");
var index_1 = require("./i18n/index");
var TasksWindowController = (function (_super) {
    __extends(TasksWindowController, _super);
    function TasksWindowController(parentWindow, docked) {
        var _this = _super.call(this, parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "tasks-splitter-vertical": { defaultValue: 340 },
                "tasks-splitter-vertical2-proportional": { defaultValue: JSON.stringify({ handlePos: 600, totalSize: 1600 }) },
                "tasks-splitter-horizontal-proportional": { defaultValue: JSON.stringify({ handlePos: 300, totalSize: 1000 }) },
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({ handlePos: 250, totalSize: 1000 }) },
                "active-project-id": { defaultValue: "" },
            }
        }) || this;
        _this.subSettings = {};
        _this.remoteDataChangedListeners = {};
        _this.remoteTasksCountManagers = {};
        _this.afterViewLoaded = pmc_mail_1.Q.defer();
        _this.taskGroupsPanelPromises = {};
        _this.activePanel = null;
        _this.remoteServers = {};
        _this.initWithProject = null;
        _this.dirty = false;
        _this.panelId = 1;
        _this.ipcMode = true;
        var localSession = _this.app.sessionManager.getLocalSession();
        _this.docked = docked;
        _this.setPluginViewAssets("tasks");
        _this.openWindowOptions.position = "center";
        _this.openWindowOptions.width = 900;
        _this.openWindowOptions.height = 500;
        _this.openWindowOptions.cssClass = "app-window";
        _this.openWindowOptions.title = _this.i18n("plugin.tasks.window.tasks.title");
        _this.openWindowOptions.icon = "icon fa fa-tasks";
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.taskPanel = _this.addComponent("taskPanel", _this.componentFactory.createComponent("taskpanel", [_this, localSession, _this.personsComponent, {
                close: function () { return _this.close(); },
                alert: function (msg) { return _this.alert(msg); },
                confirm: function (msg) { return _this.confirm(msg); },
                confirmEx: _this.confirmEx.bind(_this),
                openWindowParent: _this,
                openChildWindow: _this.openChildWindow.bind(_this),
                updateDirty: _this.updateDirty.bind(_this),
            }, true, false, []]));
        _this.taskPanel.onDirtyChanged = function () {
            var dirty = _this.taskPanel.editable && _this.taskPanel.dirty;
            if (_this.activePanel) {
                _this.activePanel.setPreviewDirty(dirty);
            }
        };
        _this.dataChangedListener = _this.onDataChanged.bind(_this);
        _this.tasksPlugin.watch(localSession, "*", "*", "*", _this.dataChangedListener);
        _this.tasksPlugin.activeTasksWindowController = _this;
        _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.sectionTooltip = _this.addComponent("sectiontooltip", _this.componentFactory.createComponent("sectiontooltip", [_this]));
        return _this;
    }
    TasksWindowController_1 = TasksWindowController;
    TasksWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    TasksWindowController.prototype.onViewLoad = function () {
        this.afterViewLoaded.resolve();
        var data = this.app.searchModel.get();
        var isSearchOn = data.visible && data.value.length > 1;
        this.callViewMethod("onSearchChanged", isSearchOn, false);
        this.initSpellChecker();
    };
    TasksWindowController.prototype.beforeClose = function () {
        this.tasksPlugin.unWatch(this.app.sessionManager.getLocalSession(), "*", "*", "*", this.dataChangedListener);
        for (var hostHash in this.remoteDataChangedListeners) {
            this.tasksPlugin.unWatch(this.app.sessionManager.sessions[hostHash], "*", "*", "*", this.remoteDataChangedListeners[hostHash]);
        }
        this.taskPanel.beforeClose();
    };
    TasksWindowController.prototype.init = function () {
        var _this = this;
        var localSession = this.app.sessionManager.getLocalSession();
        this.privateSection = localSession.sectionManager.getMyPrivateSection();
        this.tasksCountManager = new TasksCountManager_1.TasksCountManager(localSession, this.privateSection, this.tasksPlugin, null);
        this.bindEvent(this.app, "update-section-badge", this.onUpdateSectionBadge.bind(this));
        this.bindEvent(this.app, "update-tasks-sidebar-spinners", function (e) {
            _this.sidebar.updateSidebarSpinners({
                conv2SectionId: e.conv2SectionId,
                customElementId: e.customElementId,
                sectionId: e.sectionId,
                hosts: e.hostHash ? [_this.app.sessionManager.getSessionByHostHash(e.hostHash).host] : Object.values(_this.app.sessionManager.sessions).map(function (x) { return x.host; }),
            });
        });
        this.verticalSplitter = this.addComponent("verticalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("tasks-splitter-vertical")]));
        this.verticalSplitter2 = this.addComponent("verticalSplitter2", this.componentFactory.createComponent("splitter", [this, this.settings.create("tasks-splitter-vertical2-proportional")]));
        this.horizontalSplitter = this.addComponent("horizontalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("tasks-splitter-horizontal-proportional")]));
        this.verticalSplitter.ipcMode = true;
        this.verticalSplitter2.ipcMode = true;
        this.horizontalSplitter.ipcMode = true;
        this.disabledSection = this.addComponent("disabled-section", this.componentFactory.createComponent("disabledsection", [this, pmc_mail_1.Types.section.NotificationModule.TASKS]));
        this.subSettings["active-project-id"] = this.settings.create("active-project-id");
        this.initWithProject = this.initWithProject || this.tasksPlugin.getPrivateSectionId();
        this.activeProjectId = this.initWithProject ? this.initWithProject : this.subSettings["active-project-id"].get();
        this.activeProjectHostHash = localSession.hostHash;
        if (!this.activeProjectId) {
            this.activeProjectId = TasksWindowController_1.getProjectId(this.tasksPlugin.getPrivateSectionId() ? this.tasksPlugin.getPrivateSectionId() : Types_1.CustomTasksElements.ALL_TASKS_ID);
        }
        this.tasksPlugin.projectsReady.then(function () {
            _this.selectProject(localSession, _this.activeProjectId);
        });
        var promProjectCreator = pmc_mail_1.Q();
        var prevUpdate = null;
        this.registerChangeEvent(this.tasksPlugin.tasksSectionsCollection[localSession.hostHash].changeEvent, function (event) {
            if (event.type == "add") {
                promProjectCreator = promProjectCreator.then(function () { return _this.tasksPlugin.ensureProjectExists(event.element.getId(), event.element.getName(), localSession); }).then(function () {
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
                        return pmc_mail_1.Q.resolve();
                    });
                }, 100);
            }
        });
        var _loop_1 = function (element) {
            var id = element.getId();
            var name_1 = element.getName();
            if (id == this_1.tasksPlugin.getPrivateSectionId()) {
                name_1 = this_1.i18n("plugin.tasks.window.tasks.sidebar.privateTasks");
            }
            promProjectCreator = promProjectCreator.then(function () { return _this.tasksPlugin.ensureProjectExists(id, name_1, localSession); });
        };
        var this_1 = this;
        for (var _i = 0, _a = this.tasksPlugin.tasksSectionsCollection[localSession.hostHash].list; _i < _a.length; _i++) {
            var element = _a[_i];
            _loop_1(element);
        }
        this.bindEvent(this.app, "focusChanged", function (event) {
            var windowId = event.windowId;
            _this.tasksPlugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? _this.parent.parent.activeModel.get() : windowId;
            if (windowId == "tasks" || (windowId == "main-window" && _this.parent.parent.activeModel.get() == "tasks")) {
                setTimeout(function () {
                    _this.callViewMethod("grabFocus", true);
                }, 200);
            }
        });
        this.bindEvent(this.app, "focusLost", function (event) {
            _this.tasksPlugin.activeWindowFocused = null;
        });
        this.bindEvent(this.app, "badges-update-request", function (event) {
            _this.updateBadges();
        });
        this.bindEvent(this.app, "marked-tasks-as-read", function (event) {
            _this.updateBadges();
        });
        this.bindEvent(this.app, "focusLost", function () {
            _this.callViewMethod("pauseTimeAgoRefresher");
        });
        this.bindEvent(this.app, "focusChanged", function (event) {
            if (event.windowId == "main-window") {
                _this.callViewMethod("resumeTimeAgoRefresher");
            }
        });
        this.bindEvent(this.app, "onToggleMaximize-notify", function () {
            setTimeout(function () {
                _this.callViewMethod("grabFocus", false);
            }, 10);
        });
        return pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                _this.tasksPlugin.sectionManager.isSectionsLimitReached(),
            ]);
        })
            .then(function (res) {
            var identityProvider = res[0], isSectionsLimitReached = res[1];
            var customElements = [];
            if (_this.tasksPlugin.getPrivateSectionId()) {
                customElements.push({
                    id: _this.tasksPlugin.getPrivateSectionId(),
                    icon: {
                        type: "hashmail",
                        value: _this.identity.hashmail
                    },
                    label: _this.i18n("plugin.tasks.window.tasks.sidebar.privateTasks"),
                    private: true,
                    emphasized: true,
                });
            }
            customElements.push({
                id: Types_1.CustomTasksElements.ALL_TASKS_ID,
                icon: {
                    type: "fa",
                    value: "privmx-icon privmx-icon-tasks",
                },
                label: _this.i18n("plugin.tasks.window.tasks.sidebar.allTasks"),
                private: false,
            }, {
                id: Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                icon: {
                    type: "hashmail",
                    value: _this.identity.hashmail,
                },
                label: _this.i18n("plugin.tasks.window.tasks.sidebar.tasksCreatedByMe"),
                private: false,
            }, {
                id: Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                icon: {
                    type: "hashmail",
                    value: _this.identity.hashmail,
                },
                label: _this.i18n("plugin.tasks.window.tasks.sidebar.tasksAssignedToMe"),
                private: false,
                alternative: true,
                emphasized: true,
            }, {
                id: Types_1.CustomTasksElements.TRASH_ID,
                icon: {
                    type: "fa",
                    value: "ico-bin",
                },
                label: _this.i18n("plugin.tasks.window.tasks.sidebar.trash"),
                private: false,
            });
            var sidebarOptions = {
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: new pmc_mail_1.utils.collection.MutableCollection(customElements),
                    elementsCountProvider: function (ce) { return _this.tasksCountManager.getCustomElementElementsCount(ce); },
                    unreadProvider: function (ce) { return _this.getUnread(localSession, ce); },
                    searchCountProvider: function (ce) { return _this.tasksPlugin.getSearchCount(localSession, ce); },
                    unmutedUnreadProvider: function (ce) { return _this.getUnread(localSession, ce, true); },
                    withSpinnerProvider: function (ce) { return _this.getWithSpinner(localSession, ce); },
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    elementsCountProvider: function (c2s) { return _this.tasksCountManager.getConv2ElementsCount(c2s); },
                    unreadProvider: function (c2s) { return _this.getUnread(localSession, c2s); },
                    searchCountProvider: function (ce) { return _this.tasksPlugin.getSearchCount(localSession, ce); },
                    searchAllSearchedProvider: null,
                    unmutedUnreadProvider: function (c2s) { return _this.getUnread(localSession, c2s, true); },
                    withSpinnerProvider: function (c2s) { return _this.getWithSpinner(localSession, c2s); },
                    sorter: function (a, b) {
                        return _this.tasksCountManager.getConv2LastDate(b) - _this.tasksCountManager.getConv2LastDate(a);
                    },
                    hideConversations: true,
                    assignedTo: true,
                },
                sectionList: {
                    baseCollection: _this.tasksPlugin.sidebarSectionsCollection,
                    elementsCountProvider: function (section) { return _this.tasksCountManager.getSectionElementsCount(section); },
                    unreadProvider: function (section) { return _this.getUnread(localSession, section); },
                    searchCountProvider: function (section) { return _this.tasksPlugin.getSearchCount(localSession, section); },
                    searchAllSearchedProvider: null,
                    withSpinnerProvider: function (section) { return _this.getWithSpinner(localSession, section); },
                    moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                    sorter: function (a, b) {
                        var res = _this.tasksCountManager.getSectionLastDate(b) - _this.tasksCountManager.getSectionLastDate(a);
                        return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: pmc_mail_1.component.remotehostlist.ElementCountsAggregationStrategy.SECTIONS,
                },
                customSectionList: {
                    baseCollection: null,
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                    sorter: null
                },
                conv2ListEnabled: true,
                conv2Splitter: _this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: [],
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push({
                    id: "new-section",
                    label: _this.i18n("plugin.tasks.window.tasks.sidebar.newSection"),
                    title: _this.i18n("plugin.tasks.window.tasks.sidebar.newSection"),
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
            _this.initSessionEvents(localSession);
            _this.tasksCountManager.sidebar = _this.sidebar;
            _this.setSidebarActiveItem(localSession, _this.activeProjectId);
            _this.bindEvent(_this.app, "tasks-search-update", function (event) {
                var refreshAvatars = _this.updateSidebarCustomElements(localSession, _this.sidebar.customElementList.customElementsCollection);
                _this.updateBadges();
                _this.callViewMethod("onSearchChanged", event.searchString.length > 0, refreshAvatars);
            });
            _this.app.dispatchEvent({ type: "focusChanged", windowId: "tasks" });
            return _this.tasksPlugin.checkInit().then(function () { return _this.tasksPlugin.projectsReady; }).then(function () {
                return _this.taskPanel.init();
            })
                .then(function () {
                _this.selectProject(localSession, _this.activeProjectId);
            });
        });
    };
    TasksWindowController.prototype.isSectionPrimary = function (session, section) {
        return this.tasksPlugin.tasksPrimarySections[session.hostHash].contains(section);
    };
    TasksWindowController.prototype.openDisabledSectionView = function (session, section) {
        this.sidebar.setActive({
            type: this.isSectionPrimary(session, section) ? pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION : pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
            section: section,
        }, false);
        this.tasksPlugin.activeSinkId = section.getChatSink().id;
        this.tasksPlugin.activeSinkHostHash = session.hostHash;
        this.disabledSection.setSection(section);
        this.callViewMethod("toggleDisabledSection", true);
    };
    TasksWindowController.prototype.refreshTaskCounts = function () {
        this.tasksCountManager.refresh();
        for (var hostHash in this.remoteTasksCountManagers) {
            this.remoteTasksCountManagers[hostHash].refresh();
        }
        this.sidebar.refresh();
    };
    TasksWindowController.prototype.updateSidebarCustomElements = function (session, collection, all) {
        if (all === void 0) { all = false; }
        var hostHash = session.hostHash;
        var refreshAvatars = false;
        var len = collection.size();
        for (var i = 0; i < len; ++i) {
            var el = collection.get(i);
            if (all || (this.tasksPlugin.searchCountsModified[hostHash] && this.tasksPlugin.searchCountsModified[hostHash][el.id])) {
                collection.triggerUpdateAt(i);
                if (el.icon.type == "hashmail") {
                    refreshAvatars = true;
                }
            }
        }
        return refreshAvatars;
    };
    TasksWindowController.prototype.updateSidebarSections = function (session, collection, all) {
        if (all === void 0) { all = false; }
        var hostHash = session.hostHash;
        var len = collection.size();
        for (var i = 0; i < len; ++i) {
            var id = collection.get(i).getId();
            if (all || (this.tasksPlugin.searchCountsModified[hostHash] && this.tasksPlugin.searchCountsModified[hostHash][id])) {
                collection.triggerUpdateAt(i);
            }
        }
    };
    TasksWindowController.prototype.updateConv2Sections = function (session, collection, all) {
        if (all === void 0) { all = false; }
        var hostHash = session.hostHash;
        var len = collection.size();
        for (var i = 0; i < len; ++i) {
            var id = collection.get(i).id;
            if (all || (this.tasksPlugin.searchCountsModified[hostHash] && this.tasksPlugin.searchCountsModified[hostHash][id])) {
                collection.triggerUpdateAt(i);
            }
        }
    };
    TasksWindowController.prototype.onBeforeActivateSidebarElement = function (event) {
        var localSession = this.app.sessionManager.getLocalSession();
        event.result = false;
        if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.HOST) {
            this.expandRemoteSectionsList(event.element.host);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
            var session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "remote-section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: event.element.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(session, event.element.section.getId());
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: localSession.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.section.getId());
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "custom",
                contextId: event.element.customElement.id,
                hostHash: localSession.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.customElement.id);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "conversation",
                contextId: event.element.conv2.id,
                hostHash: localSession.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.conv2.id);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            var session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "remote-conversation",
                contextId: event.element.conv2.id,
                hostHash: event.element.hostHash
            });
            this.contextHistory.append(context);
            this.selectProject(session, event.element.conv2.id);
        }
    };
    TasksWindowController.prototype.onSidebarButtonAction = function (event) {
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }
    };
    TasksWindowController.prototype.openSectionsWindow = function () {
        this.app.openNewSectionDialogFromSidebar();
    };
    TasksWindowController.prototype.onActivatedSidebarElement = function (event) {
    };
    TasksWindowController.prototype.onSinkChange = function (session, event) {
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
    TasksWindowController.prototype.getUnread = function (session, section, skipMuted) {
        if (skipMuted === void 0) { skipMuted = false; }
        if (!section) {
            return 0;
        }
        else if (section instanceof pmc_mail_1.mail.section.SectionService) {
            return this.tasksPlugin.getUnreadForSection(session, section.getId());
        }
        else if (section instanceof pmc_mail_1.mail.section.Conv2Section) {
            return this.tasksPlugin.getUnreadForConv2Section(session, section.id, skipMuted);
        }
        else if (section.id == Types_1.CustomTasksElements.ALL_TASKS_ID) {
            return null;
        }
        else if (section.id == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID) {
            return this.tasksPlugin.getUnread(session, true, false);
        }
        else if (section.id == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
            return this.tasksPlugin.getUnread(session, false, true, skipMuted);
        }
        else if (section.id == Types_1.CustomTasksElements.TRASH_ID) {
            return this.tasksPlugin.getUnread(session, false, false, false, true);
        }
        return 0;
    };
    TasksWindowController.prototype.getWithSpinner = function (session, section) {
        if (this.tasksPlugin.sectionsWithSpinner[session.hostHash]["__all__"]) {
            return true;
        }
        if (section instanceof pmc_mail_1.mail.section.SectionService) {
            return this.tasksPlugin.sectionsWithSpinner[session.hostHash][section.getId()];
        }
        else if (section instanceof pmc_mail_1.mail.section.Conv2Section) {
            return this.tasksPlugin.sectionsWithSpinner[session.hostHash][section.id];
        }
        else {
            return this.tasksPlugin.sectionsWithSpinner[session.hostHash][section.id];
        }
    };
    TasksWindowController.prototype.applyHistoryState = function (processed, state) {
        var usedState = state;
        var localSession = this.app.sessionManager.getLocalSession();
        var context = this.contextHistory.getCurrent();
        if (context) {
            if (this.app.switchModuleWithContext() || state) {
                if (context.getType() == "section") {
                    var contextSection = localSession.sectionManager.getSection(context.getSectionIdFromContextId());
                    if (contextSection && contextSection.isKvdbModuleEnabled()) {
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
            var newActiveProjectId = usedState.startsWith("section:") ? usedState.substring("section:".length) : usedState;
            this.initWithProject = newActiveProjectId;
            if (this.activeProjectId !== newActiveProjectId && this.activeProjectHostHash !== localSession.hostHash) {
                this.activeProjectId = newActiveProjectId;
                this.activeProjectHostHash = localSession.hostHash;
                this.selectProject(localSession, newActiveProjectId);
            }
        }
    };
    TasksWindowController.prototype.onUpdateSectionBadge = function (event) {
        this.updateBadges();
    };
    TasksWindowController.prototype.updateBadges = function () {
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
        for (var hostHash in this.remoteTasksCountManagers) {
            this.remoteTasksCountManagers[hostHash].updateSidebarHostElement();
        }
    };
    TasksWindowController.prototype.getModel = function () {
        var allAvailMembers = {};
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.getSessionByHostHash(hostHash);
            if (session.loadingPromise.isFulfilled()) {
                allAvailMembers[hostHash] = this.tasksPlugin.getAllPeople(session);
            }
        }
        return {
            docked: this.docked,
            activeProjectId: this.activeProjectId,
            membersStr: JSON.stringify(allAvailMembers),
            myId: this.tasksPlugin.getMyId(this.app.sessionManager.getLocalSession()),
            privateSectionId: this.tasksPlugin.getPrivateSectionId(),
            horizontalTaskLayout: this.tasksPlugin.getSetting(null, "horizontal-task-window-layout", null, null) ? true : false,
        };
    };
    TasksWindowController.prototype.onDataChanged = function (type, id, action) {
        if (this.activeProjectHostHash != this.app.sessionManager.getLocalSession().hostHash) {
            return;
        }
        if (type == "project") {
            var proj = this.tasksPlugin.getProject(this.app.sessionManager.getLocalSession(), id);
            if (!proj && action != "deleted") {
                return;
            }
            if (action == "added") {
            }
            else if (action == "deleted") {
                if (this.activeProjectId == id) {
                    this.activeProjectId = "";
                    this.onViewSettingChanged("active-project-id", "");
                    this.callViewMethod("hideContainer", id);
                }
            }
            else if (action == "modified") {
            }
        }
        if (type == "task" && this.tasksCountManager != null) {
            this.tasksCountManager.updateTasksCount(id, action);
        }
    };
    TasksWindowController.prototype.onRemoteDataChanged = function (type, id, action, hostHash) {
        if (type == "task") {
            this.getOrCreateRemoteTasksCountManager(hostHash).updateTasksCount(id, action);
        }
    };
    TasksWindowController.prototype.onViewSettingChanged = function (setting, value) {
        if (setting in this.subSettings) {
            if (typeof (value) == "boolean") {
                value = value ? 1 : 0;
            }
            var fixedSectionsNames = [
                Types_1.CustomTasksElements.ALL_TASKS_ID,
                Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                Types_1.CustomTasksElements.TRASH_ID,
                this.tasksPlugin.getPrivateSectionId(),
            ];
            this.subSettings[setting].set(value);
        }
    };
    TasksWindowController.prototype.onViewSelectProject = function (projectId) {
        this.selectProject(this.app.sessionManager.getLocalSession(), projectId);
    };
    TasksWindowController.prototype.setSidebarActiveItem = function (session, projectId) {
        var _this = this;
        var fixedSectionsNames = [
            Types_1.CustomTasksElements.ALL_TASKS_ID,
            Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            Types_1.CustomTasksElements.TRASH_ID,
            this.tasksPlugin.getPrivateSectionId(),
        ];
        if (fixedSectionsNames.indexOf(projectId) >= 0) {
            this.sidebar.setActive({
                type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.options.customElementList.baseCollection.find(function (x) { return x.id == projectId; }),
            }, false);
            this.tasksPlugin.activeSinkId = null;
            this.tasksPlugin.activeSinkHostHash = null;
        }
        else {
            if (session.sessionType == "local") {
                if (this.tasksPlugin.isConv2Project(projectId)) {
                    pmc_mail_1.Q().then(function () {
                        return session.mailClientApi.privmxRegistry.getConv2Service();
                    })
                        .then(function (conv2service) {
                        var conv2 = conv2service.collection.find(function (c2s) { return c2s.id == projectId; });
                        _this.sidebar.setActive({
                            type: pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION,
                            conv2: conv2,
                        }, false);
                        _this.tasksPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                        _this.tasksPlugin.activeSinkHostHash = session.hostHash;
                    });
                }
                else if (session.sectionManager.getSection(projectId)) {
                    this.sidebar.setActive({
                        type: pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
                        section: session.sectionManager.getSection(projectId),
                    }, false);
                    this.tasksPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                    this.tasksPlugin.activeSinkHostHash = session.hostHash;
                }
            }
            if (session.sessionType == "remote") {
                if (this.tasksPlugin.isConv2Project(projectId)) {
                    pmc_mail_1.Q().then(function () {
                        return session.mailClientApi.privmxRegistry.getConv2Service();
                    })
                        .then(function (conv2service) {
                        var conv2 = conv2service.collection.find(function (c2s) { return c2s.id == projectId; });
                        _this.sidebar.setActive({
                            type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                            conv2: conv2,
                            hostHash: session.hostHash,
                        }, false);
                        _this.tasksPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                        _this.tasksPlugin.activeSinkHostHash = session.hostHash;
                    });
                }
                else if (session.sectionManager.getSection(projectId)) {
                    this.sidebar.setActive({
                        type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION,
                        section: session.sectionManager.getSection(projectId),
                        hostHash: session.hostHash,
                    }, false);
                    this.tasksPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                    this.tasksPlugin.activeSinkHostHash = session.hostHash;
                }
            }
        }
    };
    TasksWindowController.prototype.selectProject = function (session, projectId) {
        var _this = this;
        if (!this.sidebar) {
            return;
        }
        var isRemote = session.hostHash != this.app.sessionManager.getLocalSession().hostHash;
        var fixedSectionsNames = [
            Types_1.CustomTasksElements.ALL_TASKS_ID,
            Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            Types_1.CustomTasksElements.TRASH_ID,
            this.tasksPlugin.getPrivateSectionId(),
        ];
        this.setSidebarActiveItem(session, projectId);
        var activeId;
        var rootId;
        this.callViewMethod("toggleDisabledSection", false);
        if (fixedSectionsNames.indexOf(projectId) >= 0) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "custom",
                contextId: projectId,
                hostHash: session.hostHash
            });
            this.contextHistory.append(context);
            activeId = projectId;
            rootId = projectId;
            if (projectId == this.tasksPlugin.getPrivateSectionId()) {
                if (this.privateSection) {
                    this.openTaskGroupsPanel(session, this.privateSection);
                }
            }
            else {
                this.openTaskGroupsPanel(session, projectId);
            }
        }
        else if (this.tasksPlugin.isConv2Project(projectId)) {
            var c2s_1 = this.tasksPlugin.getConv2Section(session, projectId);
            if (!c2s_1) {
                return;
            }
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "conversation",
                contextId: projectId,
                hostHash: session.hostHash
            });
            this.contextHistory.append(context);
            this.afterViewLoaded.promise.then(function () {
                _this.openTaskGroupsPanel(session, c2s_1);
            });
            activeId = c2s_1.id;
            rootId = c2s_1.id;
        }
        else {
            var section = session.sectionManager.getSection(projectId);
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
                contextType: "section",
                contextId: "section:" + projectId,
                hostHash: session.hostHash
            });
            this.contextHistory.append(context);
            if (section instanceof pmc_mail_1.mail.section.SectionService && !section.isKvdbModuleEnabled()) {
                this.disabledSection.setSection(section);
                this.callViewMethod("toggleDisabledSection", true);
                return;
            }
            var state_1 = session.sectionManager.getDescantsForModule(projectId, "kvdb");
            if (state_1 == null) {
                return;
            }
            this.afterViewLoaded.promise.then(function () {
                _this.openTaskGroupsPanel(session, state_1.active);
            });
            activeId = state_1.active.getId();
            rootId = state_1.active.getId();
        }
    };
    TasksWindowController.prototype.onSectionsCollectionChange = function (session, event) {
        var countsManager = null;
        var customElementList = null;
        var sectionList = null;
        var conv2List = null;
        if (session.hostHash == this.app.sessionManager.getLocalSession().hostHash) {
            countsManager = this.tasksCountManager;
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
    };
    TasksWindowController.prototype.setActiveProjectId = function (hostHash, value) {
        this.activeProjectId = value;
        this.activeProjectHostHash = hostHash;
    };
    TasksWindowController.prototype.getTaskGroupsPanel = function (session, section, hostHash) {
        return this.createTaskGroupsPanel(session, TasksWindowController_1.getProjectId(section));
    };
    TasksWindowController.prototype.createTaskGroupsPanel = function (session, projectId) {
        var _this = this;
        var tgPanelKey = this.getTaskGroupsPanelKey(session.hostHash, projectId);
        if (tgPanelKey in this.taskGroupsPanelPromises) {
            return this.taskGroupsPanelPromises[tgPanelKey];
        }
        var panel = this.addComponent("taskGroupsPanel-" + tgPanelKey, this.componentFactory.createComponent("taskGroupsPanel", [this]));
        return this.taskGroupsPanelPromises[tgPanelKey] = pmc_mail_1.Q().then(function () {
            var mergedSectionsNames = [
                Types_1.CustomTasksElements.ALL_TASKS_ID,
                Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                Types_1.CustomTasksElements.TRASH_ID,
            ];
            return panel.setSession(session, mergedSectionsNames.indexOf(projectId) >= 0 ? undefined : projectId);
        })
            .then(function () {
            panel.onViewConfirmPreviewExit = function () {
                _this.taskPanel.closeConfirm().then(function (close) {
                    if (close) {
                        panel.callViewMethod("confirmPreviewExit");
                    }
                });
            };
            panel.init();
            _this.bindEvent(panel, "task-preview-request", function (event) {
                return pmc_mail_1.Q().then(function () {
                    return _this.taskPanel.setSession(_this.app.sessionManager.getSessionByHostHash(event.hostHash));
                })
                    .then(function () {
                    if (_this.activeProjectId != projectId || _this.activeProjectHostHash != event.hostHash) {
                        return;
                    }
                    _this.afterViewLoaded.promise.then(function () {
                        var session = _this.app.sessionManager.getSessionByHostHash(event.hostHash);
                        _this.taskPanel.setTaskId(session, event.taskId);
                        if (!event.taskId) {
                            return;
                        }
                        var task = _this.tasksPlugin.tasks[session.hostHash][event.taskId];
                        if (task && _this.tasksPlugin.wasTaskUnread(session, task, task.getProjectId()) && _this.app.userPreferences.getAutoMarkAsRead()) {
                            _this.tasksPlugin.markTaskAsWatched(session, task.getId(), task.getProjectId());
                            _this.updateBadges();
                        }
                    });
                });
            });
            _this.bindEvent(panel, "taskpanel-update-request", function () {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.taskPanel.updateView();
                });
            });
            _this.bindEvent(panel, "taskpanel-change-visibility-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("changeTaskPanelVisibility", event.show);
                });
            });
            _this.bindEvent(panel, "horizontal-task-window-layout-change-request", function (event) {
                if (_this.activeProjectId != projectId || _this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("updatePreviewLocation", event.horizontalLayout);
                });
            });
            _this.bindEvent(panel, "badges-update-request", function (event) {
                _this.afterViewLoaded.promise.then(function () {
                    _this.updateBadges();
                });
            });
            _this.afterViewLoaded.promise.then(function () {
                _this.afterViewLoaded.promise.then(function () {
                    _this.callViewMethod("createTaskGroupsPanel", session.hostHash, projectId);
                });
            });
            return pmc_mail_1.Q(panel);
        });
    };
    TasksWindowController.prototype.openTaskGroupsPanel = function (session, section) {
        this.openRemoteTaskGroupsPanel(session.hostHash, section);
    };
    TasksWindowController.prototype.onViewOpenedTaskGroupsPanel = function (hostHash, projectId) {
        if (projectId != this.activeProjectId || hostHash != this.activeProjectHostHash) {
            return;
        }
        var tgPanelKey = this.getTaskGroupsPanelKey(hostHash, projectId);
        var panelPromise = this.taskGroupsPanelPromises[tgPanelKey];
        if (panelPromise) {
            panelPromise.then(function (panel) { return panel.activate(); });
        }
    };
    TasksWindowController.prototype.updateDirty = function (dirty) {
        this.dirty = dirty;
    };
    TasksWindowController.prototype.onViewRefresh = function () {
        if (this.activePanel) {
            this.activePanel.onViewFullRefresh(true, true);
        }
    };
    TasksWindowController.prototype.onViewSwitchToPanel = function (id) {
        this.panelId = id;
    };
    TasksWindowController.prototype.handleFilePaste = function (element) {
        if (this.panelId == 2) {
            if ((pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES in element.data && this.taskPanel)
                || (element.data.file && element.data.file.element instanceof pmc_mail_1.mail.section.OpenableSectionFile)
                || (element.data.files && element.data.files.filter(function (x) { return !x || !(x.element instanceof pmc_mail_1.mail.section.OpenableSectionFile); }).length == 0)) {
                this.taskPanel.tryPaste(element, "text" in element.data ? element.data.text : null);
                return true;
            }
        }
        return false;
    };
    TasksWindowController.prototype.expandRemoteSectionsList = function (hostEntry) {
        var _this = this;
        var session;
        var hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        var checkSessionExists = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if (checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        var bindChangedListener = false;
        if (!this.remoteDataChangedListeners[hostHash]) {
            bindChangedListener = true;
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
            if (bindChangedListener) {
                _this.tasksPlugin.watch(session, "*", "*", "*", _this.remoteDataChangedListeners[hostHash]);
            }
            return _this.tasksPlugin.ensureSessionProjectsInitialized(session);
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
        });
    };
    TasksWindowController.prototype.initSessionEvents = function (session) {
        var _this = this;
        this.bindEvent(session.sectionManager.sectionAccessManager.eventDispatcher, "section-state-changed", function (event) {
            if (_this.activePanel && _this.activeProjectId == event.sectionId && _this.activeProjectHostHash == session.hostHash) {
                pmc_mail_1.Q().then(function () {
                    return session.sectionManager.load();
                })
                    .then(function () {
                    var section = session.sectionManager.getSection(event.sectionId);
                    var moduleEnabled = section.isKvdbModuleEnabled();
                    if (!moduleEnabled) {
                        _this.openDisabledSectionView(session, section);
                    }
                    else {
                        _this.selectProject(session, section.getId());
                    }
                });
            }
        });
        this.registerChangeEvent(this.tasksPlugin.tasksSectionsCollectionNoPrivate[session.hostHash].changeEvent, function (event) { return _this.onSectionsCollectionChange(session, event); });
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.sinkIndexCollection.changeEvent, function (event) { return _this.onSinkChange(session, event); });
    };
    TasksWindowController.prototype.checkRemoteHostComponentsInitialized = function (hostHash) {
        var ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    };
    TasksWindowController.prototype.initRemoteHostComponents = function (hostEntry, session) {
        var _this = this;
        var hostHash = session.hostHash;
        if (this.checkRemoteHostComponentsInitialized(hostHash)) {
            return;
        }
        var sectionsListOptions = {
            baseCollection: session.sectionManager.filteredCollection,
            unreadProvider: function (section) { return _this.getUnread(session, section); },
            elementsCountProvider: function (section) { return _this.getRemoteSectionElementsCount(hostHash, section); },
            searchCountProvider: function (section) { return _this.tasksPlugin.getSearchCount(session, section); },
            withSpinnerProvider: function (section) { return _this.getWithSpinner(session, section); },
            searchAllSearchedProvider: null,
            sorter: function (a, b) {
                var res = _this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(b) - _this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(a);
                return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: pmc_mail_1.Types.section.NotificationModule.TASKS,
            checkShowAllAvailSections: false,
            session: session,
        };
        var conv2ListOptions = {
            elementsCountProvider: function (conversation) { return _this.getRemoteConversationElementsCount(hostHash, conversation); },
            unreadProvider: function (c2s) { return _this.getUnread(session, c2s); },
            searchCountProvider: function (c2s) { return _this.tasksPlugin.getSearchCount(session, c2s); },
            searchAllSearchedProvider: null,
            withSpinnerProvider: function (c2s) { return _this.getWithSpinner(session, c2s); },
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
    TasksWindowController.prototype.openRemoteTaskGroupsPanel = function (hostHash, section) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.init(hostHash);
        })
            .then(function () {
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            _this.tasksPlugin.ensureSessionInit(session);
            _this.tasksPlugin.ensureInitSessionCollections(session);
            return _this.afterViewLoaded.promise.then(function () {
                var projectId = typeof section == "string" ? section : TasksWindowController_1.getProjectId(section);
                var sectionName = (section instanceof pmc_mail_1.mail.section.SectionService) ? section.getName() : (typeof section == "string" ? "" : section.getFirstPerson().getName());
                if (section instanceof pmc_mail_1.mail.section.SectionService) {
                    return _this.tasksPlugin.ensureProjectExists(projectId, sectionName, session);
                }
            })
                .then(function () {
                return _this.getTaskGroupsPanel(session, section, hostHash).then(function (panel) {
                    if (!panel.wasDataSet) {
                        return panel.setSectionData(section).then(function () { return pmc_mail_1.Q(panel); });
                    }
                    return panel;
                }).then(function (panel) {
                    _this.activeProjectId = TasksWindowController_1.getProjectId(section);
                    _this.activeProjectHostHash = hostHash;
                    if (_this.activePanel) {
                        _this.activePanel.deactivate();
                    }
                    panel.beforeActivate();
                    _this.activePanel = panel;
                    _this.tasksPlugin.activeTaskGroupsPanel = panel;
                    _this.afterViewLoaded.promise.then(function () {
                        _this.callViewMethod("openTaskGroupsPanel", session.hostHash, TasksWindowController_1.getProjectId(section));
                    });
                });
            });
        });
    };
    TasksWindowController.prototype.getOrCreateRemoteTasksCountManager = function (hostHash) {
        if (!(hostHash in this.remoteTasksCountManagers)) {
            var session = this.app.sessionManager.getSessionByHostHash(hostHash);
            this.remoteTasksCountManagers[hostHash] = new TasksCountManager_1.TasksCountManager(session, null, this.tasksPlugin, this.sidebar, true);
        }
        return this.remoteTasksCountManagers[hostHash];
    };
    TasksWindowController.prototype.getRemoteSectionElementsCount = function (hostHash, section) {
        var rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getSectionElementsCount(section);
    };
    TasksWindowController.prototype.getRemoteConversationElementsCount = function (hostHash, conversation) {
        var rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getConv2ElementsCount(conversation);
    };
    TasksWindowController.prototype.getRemoteSectionUnreadElementsCount = function (hostHash, section) {
        var rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getSectionElementsCount(section);
    };
    TasksWindowController.prototype.getRemoteConversationUnreadElementsCount = function (hostHash, conversation) {
        var rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getConv2ElementsCount(conversation);
    };
    TasksWindowController.prototype.getTaskGroupsPanelKey = function (hostHash, projectId) {
        return hostHash + "--" + projectId;
    };
    TasksWindowController.prototype.onViewHistoryArrowLeft = function () {
        this.router.goPrev();
    };
    TasksWindowController.prototype.onViewHistoryArrowRight = function () {
        this.router.goNext();
    };
    TasksWindowController.getProjectId = function (section) {
        if (section instanceof pmc_mail_1.mail.section.Conv2Section) {
            return section.id;
        }
        return typeof (section) == "string" ? section : section.getId();
    };
    var TasksWindowController_1;
    TasksWindowController.textsPrefix = "plugin.tasks.window.tasks.";
    __decorate([
        Inject
    ], TasksWindowController.prototype, "identity", void 0);
    __decorate([
        Inject
    ], TasksWindowController.prototype, "router", void 0);
    TasksWindowController = TasksWindowController_1 = __decorate([
        Dependencies(["splitter", "extlist", "persons", "notification", "taskGroupsPanel", "sidebar"])
    ], TasksWindowController);
    return TasksWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.TasksWindowController = TasksWindowController;
TasksWindowController.prototype.className = "com.privmx.plugin.tasks.window.tasks.TasksWindowController";

//# sourceMappingURL=TasksWindowController.js.map
