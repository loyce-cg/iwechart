"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Mail = require("pmc-mail");
var Types_1 = require("./Types");
var Project_1 = require("./data/Project");
var TaskGroup_1 = require("./data/TaskGroup");
var Task_1 = require("./data/Task");
var SettingsStorage_1 = require("./SettingsStorage");
var TaskWindowController_1 = require("../window/task/TaskWindowController");
var TaskGroupsPanelController_1 = require("../component/taskGroupsPanel/TaskGroupsPanelController");
var ViewSettings_1 = require("./ViewSettings");
var SimpleTaskService_1 = require("./SimpleTaskService");
var DataMigration_1 = require("./DataMigration");
var UniqueId_1 = require("./UniqueId");
var TaskGroupConflictResolver_1 = require("./data/TaskGroupConflictResolver");
var ConflictResolver_1 = require("./data/ConflictResolver");
var ProjectConflictResolver_1 = require("./data/ProjectConflictResolver");
var TaskConflictResolver_1 = require("./data/TaskConflictResolver");
var index_1 = require("../i18n/index");
var AttachmentsManager_1 = require("./AttachmentsManager");
var PrivateSectionIdUpdater_1 = require("./PrivateSectionIdUpdater");
var Logger = pmc_mail_1.Logger.get("privfs-tasks-plugin.TasksPlugin");
var TasksPlugin = (function () {
    function TasksPlugin(app) {
        this.app = app;
        this.projects = {};
        this.taskGroups = {};
        this.tasks = {};
        this.origProjects = {};
        this.origTaskGroups = {};
        this.origTasks = {};
        this.watched = {};
        this.taskTitleCache = {};
        this.watchedTasksHistory = {};
        this.onWatchedTasksHistoryRebuildHandlers = [];
        this.onWatchedTasksHistorySetHandlers = [];
        this.tasksSectionsCollection = {};
        this.tasksSectionsCollectionNoPrivate = {};
        this.tasksRootSections = {};
        this.kvdbProjectId = null;
        this.kvdbProjectDeferred = pmc_mail_1.Q.defer();
        this.kvdbAnyProjectDeferred = pmc_mail_1.Q.defer();
        this.ensureKvdbCExistsDeferreds = {};
        this.tasksUnreadCountModel = new Mail.utils.Model(0);
        this.tasksUnreadCountFullyLoadedModel = new Mail.utils.Model(false);
        this.recentlyUsedTaskProperties = null;
        this.taskGroupsBacklog = {};
        this.projectsBacklog = {};
        this.preventFireDelete = {};
        this.debug = false;
        this.fireLocks = 0;
        this.lockedAttachmentModificationMessages = {};
        this.taskPriorities = ["Critical", "High", "[Normal]", "Low"];
        this.taskStatuses = ["Idea", "[Todo]", "In progress", "Done"];
        this.taskTypes = ["Bug", "Feature", "[Other]"];
        this.openedWindows = {};
        this.onReset = pmc_mail_1.Q.defer();
        this.activeTasksWindowController = null;
        this.tasksPrimarySections = {};
        this.sectionsWithSpinner = {};
        this.preventRefreshWatched = false;
        this.savingLocks = {};
        this.kvdbCs = {};
        this.userNames = {};
        this.searchStr = "";
        this.searchCounts = {};
        this.searchCountsModified = {};
        if (process && process.argv && process.argv.indexOf("--debug-tasks") >= 0) {
            this.debug = true;
        }
    }
    TasksPlugin.prototype.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, "plugin.tasks.");
    };
    TasksPlugin.prototype.isChatPluginPresent = function () {
        return this.app.getComponent("chat-plugin") != null;
    };
    TasksPlugin.prototype.isNotes2PluginPresent = function () {
        return this.app.getComponent("notes2-plugin") != null;
    };
    TasksPlugin.prototype.checkInit = function () {
        if (this.initPromise == null) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    };
    TasksPlugin.prototype.ensureSessionInit = function (session) {
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
    };
    TasksPlugin.prototype.init = function () {
        var _this = this;
        if (this.app.mailClientApi == null) {
            return pmc_mail_1.Q();
        }
        this.app.dispatchEvent({
            type: "tasks-plugin-loaded",
        });
        this.unreadTasks = 0;
        return pmc_mail_1.Q().then(function () {
            _this.session = _this.app.sessionManager.getLocalSession();
            _this.ensureSessionInit(_this.session);
            return _this.app.mailClientApi.privmxRegistry.getUserSettingsKvdb();
        })
            .then(function (kvdb) {
            _this.settingsStorage = new SettingsStorage_1.SettingsStorage(_this.app.sessionManager.getLocalSession(), TasksPlugin.WATCHED_TASKS_HISTORY, kvdb, _this);
            _this.viewSettings = new ViewSettings_1.ViewSettings(TasksPlugin.VIEW_SETTINGS, kvdb);
            return;
        })
            .then(function () {
            return pmc_mail_1.Q.all([
                _this.app.mailClientApi.prepareAndGetSectionManager(),
                _this.app.mailClientApi.privmxRegistry.getUtilApi(),
                _this.app.mailClientApi.privmxRegistry.getIdentity(),
                _this.app.mailClientApi.privmxRegistry.getPersonService(),
                _this.app.mailClientApi.privmxRegistry.getConv2Service(),
                _this.app.mailClientApi.privmxRegistry.getUserPreferences(),
                _this.app.mailClientApi.privmxRegistry.getLocalStorage(),
                _this.app.mailClientApi.privmxRegistry.getClient(),
                _this.app.mailClientApi.privmxRegistry.getSinkIndexManager(),
            ]);
        })
            .then(function (res) {
            _this.sectionManager = res[0];
            _this.utilApi = res[1];
            _this.identity = res[2];
            _this.personService = res[3];
            _this.conv2Service = res[4];
            _this.userPreferences = res[5];
            _this.localStorage = res[6];
            _this.client = res[7];
            _this.sinkIndexManager = res[8];
            _this.privateSectionIdUpdater = new PrivateSectionIdUpdater_1.PrivateSectionIdUpdater(_this.sectionManager.getMyPrivateSection());
            _this.userPreferences.eventDispatcher.addEventListener("userpreferenceschange", _this.onUserPreferencesChange.bind(_this));
            _this.app.registerPmxEvent(_this.client.storageProviderManager.event, function (event) { return _this.onStorageEvent(localSession, event); });
            _this.sidebarSectionsCollection = new Mail.utils.collection.FilteredCollection(_this.sectionManager.filteredCollection, function (x) {
                return !x.isUserGroup() && x != _this.sectionManager.getMyPrivateSection() && x.isVisible() && x.hasAccess();
            });
            _this.ensureInitSessionCollections(_this.session);
            var projectsPromise = pmc_mail_1.Q(null);
            _this.fireLocks++;
            projectsPromise = projectsPromise.then(function () {
                return _this.ensureSessionProjectsInitialized(_this.session);
            }).then(function () {
                _this.fireLocks--;
                _this.fireAllAdded(_this.session);
            }).then(function () {
                _this.tasksUnreadCountFullyLoadedModel.setWithCheck(true);
            }).fail(function (e) {
                Logger.error("error ensuring projects", e);
            });
            _this.projectsReady = projectsPromise;
            _this.setupSearch();
            var localSession = _this.app.sessionManager.getLocalSession();
            return projectsPromise.then(function () {
                return pmc_mail_1.Q.all([
                    _this.loadSettings(localSession, "__global__"),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.ALL_TASKS_ID),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.TRASH_ID),
                    _this.loadSettings(localSession, "private-tasks"),
                    _this.fetchAllProjects(),
                    _this.fetchAllTaskGroups(),
                    _this.fetchAllTasks(),
                    _this.fetchAllUsers(localSession),
                ]);
            });
        })
            .then(function () {
            _this.app.eventDispatcher.dispatchEvent({ type: "plugin-module-ready", name: Mail.Types.section.NotificationModule.TASKS });
        })
            .then(function () {
            _this.app.addEventListener("mark-as-read", function (event) {
                var sessions = event.hostHash ? [_this.app.sessionManager.getSessionByHostHash(event.hostHash)] : _this.getReadySessions();
                if (event.moduleName == "tasks" || !event.moduleName) {
                    var projectId_1 = event.sectionId || event.conversationId || event.customElementId || Types_1.CustomTasksElements.ALL_TASKS_INC_TRASHED_ID;
                    pmc_mail_1.Q().then(function () {
                        _this.preventRefreshWatched = true;
                        _this.app.dispatchEvent({
                            type: "set-bubbles-state",
                            markingAsRead: true,
                            scope: event,
                        });
                        var def = pmc_mail_1.Q.defer();
                        setTimeout(function () { return def.resolve(); }, 300);
                        return def.promise;
                    }).then(function () {
                        return pmc_mail_1.Q.all([sessions.map(function (session) { return _this.markAllAsRead(session, projectId_1); })]);
                    })
                        .fin(function () {
                        _this.preventRefreshWatched = false;
                        _this.refreshWatched();
                        _this.app.dispatchEvent({
                            type: "set-bubbles-state",
                            markingAsRead: false,
                            scope: event,
                        });
                        _this.app.dispatchEvent({
                            type: "marked-tasks-as-read",
                            projectId: projectId_1,
                            hostHash: event.hostHash,
                        });
                    });
                }
            });
            _this.app.addEventListener("set-bubbles-state", function (e) {
                if (e.scope.moduleName && e.scope.moduleName != "tasks") {
                    return;
                }
                var newState = e.markingAsRead;
                var id = e.scope.conversationId || e.scope.customElementId || e.scope.sectionId || "__all__";
                if (e.scope.hostHash) {
                    _this.sectionsWithSpinner[e.scope.hostHash][id] = newState;
                }
                else {
                    for (var _i = 0, _a = _this.getReadySessions(); _i < _a.length; _i++) {
                        var session = _a[_i];
                        _this.sectionsWithSpinner[session.hostHash][id] = newState;
                    }
                }
                _this.app.dispatchEvent({
                    type: "update-tasks-sidebar-spinners",
                    conv2SectionId: e.scope.conversationId || undefined,
                    customElementId: e.scope.customElementId || undefined,
                    sectionId: e.scope.sectionId || undefined,
                    hostHash: e.scope.hostHash || undefined,
                });
            });
            _this.app.addEventListener("hostSessionCreated", function (event) {
                var session = _this.app.sessionManager.getSessionByHostHash(event.hostHash);
                _this.ensureSessionInit(session);
                _this.ensureInitSessionCollections(session);
            });
        })
            .fail(function (reason) { return Logger.error("error initializing tasks", reason); });
    };
    TasksPlugin.prototype.getSessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            sessions.push(session);
        }
        return sessions;
    };
    TasksPlugin.prototype.getReadySessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            if ((!session.initPromise || session.initPromise.isFulfilled()) && (!session.loadingPromise || session.loadingPromise.isFulfilled())) {
                sessions.push(session);
            }
        }
        return sessions;
    };
    TasksPlugin.prototype.ensureInitSessionCollections = function (session) {
        var _this = this;
        if (!(session.hostHash in this.tasksSectionsCollection)) {
            this.tasksSectionsCollection[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) {
                return !x.isUserGroup() && x.getKvdbModule().hasModule() && (x.isKvdbModuleEnabled() || x.isCalendarModuleEnabled());
            });
            this.tasksSectionsCollection[session.hostHash].changeEvent.add(function () {
                _this.refreshWatched();
            });
        }
        if (!(session.hostHash in this.tasksSectionsCollectionNoPrivate)) {
            this.tasksSectionsCollectionNoPrivate[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) {
                return !x.isPrivateOrUserGroup() && x.getKvdbModule().hasModule() && (x.isKvdbModuleEnabled() || x.isCalendarModuleEnabled());
            });
            this.tasksSectionsCollectionNoPrivate[session.hostHash].changeEvent.add(function (event) {
                if (event.type == "update" && event.element) {
                    var id = event.element.getId();
                    var name_1 = event.element.getName();
                    var proj = _this.projects[session.hostHash][id];
                    if (proj) {
                        if (proj.getName() != name_1) {
                            proj.setName(name_1);
                            _this.fire(session, "project", id, "modified");
                        }
                    }
                }
                else if (event.type == "remove" && event.element) {
                    var id = event.element.getId();
                    if (id in _this.projects[session.hostHash]) {
                        delete _this.projects[session.hostHash][id];
                        for (var tId in _this.tasks[session.hostHash]) {
                            var t = _this.tasks[session.hostHash][tId];
                            if (t && t.getProjectId() == id) {
                                delete _this.tasks[session.hostHash][tId];
                            }
                        }
                        for (var tgId in _this.taskGroups[session.hostHash]) {
                            var tg = _this.taskGroups[session.hostHash][tgId];
                            if (tg && tg.getProjectId() == id) {
                                delete _this.taskGroups[session.hostHash][tgId];
                            }
                        }
                        _this.fire(session, "project", id, "deleted");
                    }
                    if (id in _this.kvdbCs[session.hostHash]) {
                        delete _this.kvdbCs[session.hostHash][id];
                    }
                }
                else if (event.type == "add" && event.element) {
                    _this.ensureProjectExists(event.element.getId(), event.element.getName(), session).then(function () {
                        if (_this.activeTasksWindowController) {
                            _this.activeTasksWindowController.refreshTaskCounts();
                        }
                    });
                }
            });
        }
        if (!this.tasksRootSections) {
            this.tasksRootSections = {};
        }
        if (!(session.hostHash in this.tasksRootSections) && session.sectionManager.sectionsCollection) {
            this.tasksRootSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.sectionsCollection, function (x) { return (x.isKvdbModuleEnabled(true) || x.isCalendarModuleEnabled(true)); });
        }
        if (!this.tasksPrimarySections) {
            this.tasksPrimarySections = {};
        }
        if (!(session.hostHash in this.tasksPrimarySections) && session.sectionManager.filteredCollection) {
            this.tasksPrimarySections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) { return !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && x.sectionData.primary; });
        }
    };
    TasksPlugin.prototype.reset = function () {
        this.onReset.resolve();
        this.onReset = pmc_mail_1.Q.defer();
        this.initPromise = null;
        this.kvdbProjectDeferred = pmc_mail_1.Q.defer();
        this.kvdbAnyProjectDeferred = pmc_mail_1.Q.defer();
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
        this.tasksUnreadCountModel.setWithCheck(0);
        this.tasksUnreadCountFullyLoadedModel.setWithCheck(false);
        this.sectionsWithSpinner = {};
        this.savingLocks = {};
        this.tasksSectionsCollection = {};
        this.tasksSectionsCollectionNoPrivate = {};
        this.userNames = {};
        this.privateSectionIdUpdater = null;
    };
    TasksPlugin.prototype.loadUserSettingsForImport = function (settingsKvdb) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.viewSettings = new ViewSettings_1.ViewSettings(TasksPlugin.VIEW_SETTINGS, settingsKvdb);
            return _this.loadSettings(null, "__global__");
        });
    };
    TasksPlugin.prototype.loadSettings = function (session, projectId, extra) {
        if (projectId === void 0) { projectId = "__global__"; }
        var overrideDefauls = {};
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
    };
    TasksPlugin.prototype.saveSetting = function (session, name, value, projectId, context) {
        return this.viewSettings.saveSetting(session, name, value, projectId, context);
    };
    TasksPlugin.prototype.getSetting = function (session, name, projectId, context) {
        return this.viewSettings.getSetting(session, name, projectId, context);
    };
    TasksPlugin.prototype.getViewMode = function (session, projectId) {
        var mode = this.getSetting(session, "show-recently-modified", projectId, Types_1.ViewContext.TasksWindow);
        if (mode == 0) {
            return "groupped";
        }
        if (mode == 1) {
            return "rm";
        }
        return null;
    };
    TasksPlugin.prototype.getIsKanban = function (session, projectId) {
        return !!this.getSetting(session, "kanban-mode", projectId, Types_1.ViewContext.TasksWindow);
    };
    TasksPlugin.prototype.getIsHorizontalLayout = function (session, projectId) {
        return !!this.getSetting(session, "horizontal-task-window-layout", projectId, Types_1.ViewContext.TasksWindow);
    };
    TasksPlugin.prototype.getTaskCommentsForExport = function (session, taskId) {
        var task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return [];
        }
        var comments = [];
        var commentTags = task.getCommentTags();
        for (var _i = 0, commentTags_1 = commentTags; _i < commentTags_1.length; _i++) {
            var tag = commentTags_1[_i];
            var msgData = tag.split("/");
            if (msgData.length < 2) {
                continue;
            }
            var sinkId = msgData[0];
            var msgId = Number(msgData[1]);
            var index = session.sectionManager.sinkIndexManager.getIndexBySinkId(sinkId);
            if (!index) {
                continue;
            }
            var entry = index.getEntry(msgId);
            if (!entry) {
                continue;
            }
            var message = entry.getMessage();
            var commentMessage = JSON.parse(entry.source.data.text);
            comments.push({
                message: commentMessage.comment,
                user: commentMessage.who,
                date: message.createDate.getTime(),
            });
        }
        return comments;
    };
    TasksPlugin.prototype.onTasksSectionChange = function (event) {
        var _this = this;
        if (event.element != null) {
            if (event.element.hasChatModule()) {
                event.element.getChatSinkIndex().then(function () {
                    if (_this.activeTaskGroupsPanel) {
                        var conv2Section = _this.activeTaskGroupsPanel.getActiveConv2Section();
                        if (_this.activeTaskGroupsPanel && conv2Section && conv2Section.section && conv2Section.section.getId() == event.element.getId()) {
                            _this.activeSinkId = event.element.getChatSink().id;
                            _this.activeSinkHostHash = (_this.activeTaskGroupsPanel && _this.activeTaskGroupsPanel.session ? _this.activeTaskGroupsPanel.session.hostHash : null) || _this.app.sessionManager.getLocalSession().hostHash;
                        }
                    }
                });
            }
        }
    };
    TasksPlugin.prototype.addKvdbCollection = function (id, kvdbc, session) {
        var _this = this;
        this.kvdbCs[session.hostHash][id] = kvdbc;
        kvdbc.collection.changeEvent.add(function (event) {
            if ((event.type == "add" || event.type == "update") && event.element.secured) {
                var section = session.sectionManager.getSection(id);
                if (section && !(section.isKvdbModuleEnabled() || section.isCalendarModuleEnabled())) {
                    return;
                }
                var key_1 = event.element.secured.key;
                if (key_1[1] == "_") {
                    var origKey_1 = key_1;
                    var type = key_1[0];
                    var typeStr_1 = (type == "p" ? "project" : (type == "g" ? "taskGroup" : "task"));
                    var action_1 = event.element.secured.payload ? (event.type == "add" ? "added" : "modified") : "deleted";
                    key_1 = key_1.substr(2);
                    if (action_1 == "modified") {
                        var src = (type == "p" ? _this.projects[session.hostHash] : (type == "g" ? _this.taskGroups[session.hostHash] : _this.tasks[session.hostHash]));
                        if (key_1 in src) {
                            if (src[key_1].__version__ == event.element.secured.payload.__version__) {
                                return;
                            }
                        }
                    }
                    _this.addElementFromKvdb(session, id, event.element.secured, action_1 == "modified").then(function () {
                        if (action_1 == "deleted") {
                            if (!_this.preventFireDelete[session.hostHash]) {
                                _this.preventFireDelete[session.hostHash] = [];
                            }
                            var idx = _this.preventFireDelete[session.hostHash].indexOf(id + "___" + origKey_1);
                            if (idx >= 0) {
                                return;
                            }
                            _this.refreshWatched();
                        }
                        _this.fire(session, typeStr_1, key_1, action_1);
                    });
                }
            }
        });
        var prom = pmc_mail_1.Q();
        this.fireLocks++;
        var _loop_1 = function (el) {
            prom = prom.then(function () {
                var res = _this.addElementFromKvdb(session, id, el.secured, true);
                var key = el.secured.key;
                key = key.substr(2);
                return res;
            });
        };
        for (var _i = 0, _a = kvdbc.collection.list; _i < _a.length; _i++) {
            var el = _a[_i];
            _loop_1(el);
        }
        prom.then(function () {
            _this.fireLocks--;
            _this.fireAllAdded(session, id);
        });
        return prom;
    };
    TasksPlugin.prototype.ensureKvdbCExists = function (id, session) {
        var _this = this;
        if (id in this.ensureKvdbCExistsDeferreds[session.hostHash]) {
            return this.ensureKvdbCExistsDeferreds[session.hostHash][id].promise;
        }
        if (id in this.kvdbCs[session.hostHash]) {
            return pmc_mail_1.Q.resolve();
        }
        var section = session.sectionManager.getSection(id);
        var mod = section.getKvdbModule();
        if (!mod) {
            return pmc_mail_1.Q().thenReject();
        }
        this.ensureKvdbCExistsDeferreds[session.hostHash][id] = pmc_mail_1.Q.defer();
        return pmc_mail_1.Q().then(function () {
            if (!mod.hasModule() && mod.creatingPromise) {
                return mod.creatingPromise;
            }
        })
            .then(function () {
            return _this.getSectionKvdbCollection(section).then(function (kvdbC) {
                if (!kvdbC) {
                    return pmc_mail_1.Q().thenReject();
                }
                return _this.addKvdbCollection(id, kvdbC, session);
            }).fail(function (e) {
                throw e;
            });
        })
            .then(function () {
            if (_this.ensureKvdbCExistsDeferreds[session.hostHash][id]) {
                _this.ensureKvdbCExistsDeferreds[session.hostHash][id].resolve();
                delete _this.ensureKvdbCExistsDeferreds[session.hostHash][id];
            }
        })
            .fail(function () {
            if (_this.ensureKvdbCExistsDeferreds[session.hostHash][id]) {
                _this.ensureKvdbCExistsDeferreds[session.hostHash][id].reject("kvdb reject");
                delete _this.ensureKvdbCExistsDeferreds[session.hostHash][id];
            }
        });
    };
    TasksPlugin.prototype.getSectionKvdbCollection = function (section) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            section.getKvdbModule().kvdbPromise = null;
            section.getKvdbModule().kvdbCollectionPromise = null;
            return section.getKvdbCollection();
        })
            .then(function (x) {
            return x;
        })
            .fail(function (e) {
            if (e == "Connection Broken") {
                return pmc_mail_1.Q().then(function () {
                    return _this.app.waitForConnection();
                })
                    .then(function () {
                    return _this.getSectionKvdbCollection(section);
                });
            }
            return _this.getSectionKvdbCollection(section);
        });
    };
    TasksPlugin.prototype.refreshCollections = function () {
        var _this = this;
        var prom = pmc_mail_1.Q();
        var _loop_2 = function (hostHash) {
            var _loop_3 = function (id) {
                prom = prom.then(function () { return _this.kvdbCs[hostHash][id].refresh(); });
            };
            for (var id in this_1.kvdbCs[hostHash]) {
                _loop_3(id);
            }
        };
        var this_1 = this;
        for (var hostHash in this.kvdbCs) {
            _loop_2(hostHash);
        }
        return prom;
    };
    TasksPlugin.prototype.addElementFromKvdb = function (session, kvdbId, el, modified) {
        var _this = this;
        var payload = el.payload;
        if (!payload) {
            var id = el.key.substr(2);
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
            return pmc_mail_1.Q.resolve();
        }
        var key = el.key;
        if (key[1] != "_") {
            return pmc_mail_1.Q.resolve();
        }
        var type = key[0];
        key = key.substr(2);
        if (type == "p") {
            key = this.privateSectionIdUpdater.fixProjectId(key);
            DataMigration_1.DataMigration.migrateProject(payload);
            var sp = this.loadSettings(session, key, payload);
            payload.taskGroupIds = key in this.projects[session.hostHash] ? this.projects[session.hostHash][key].getTaskGroupIds() : [];
            payload.orphanedTaskIds = key in this.projects[session.hostHash] ? this.projects[session.hostHash][key].getOrphanedTaskIds() : [];
            var p = new Project_1.Project(payload);
            var old = this.projects[session.hostHash][key];
            var updatePinned = {};
            this.projects[session.hostHash][key] = p;
            this.origProjects[session.hostHash][key] = new Project_1.Project(JSON.parse(JSON.stringify(payload)));
            this.updateFixedProjectName(this.projects[session.hostHash][key]);
            this.updateFixedProjectName(this.origProjects[session.hostHash][key]);
            if (old) {
                var a = old.getPinnedTaskGroupIds();
                var b = p.getPinnedTaskGroupIds();
                for (var i = a.length - 1; i >= 0; --i) {
                    if (b.indexOf(a[i]) < 0) {
                        updatePinned[a[i]] = false;
                    }
                }
                for (var i = b.length - 1; i >= 0; --i) {
                    if (a.indexOf(b[i]) < 0) {
                        updatePinned[b[i]] = true;
                    }
                }
                if (this.fireLocks == 0) {
                    for (var k in updatePinned) {
                        var pinned = updatePinned[k];
                        this.app.dispatchEvent({
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
                for (var _i = 0, _a = this.projectsBacklog[session.hostHash][key]; _i < _a.length; _i++) {
                    var tId = _a[_i];
                    p.addOrphanedTasksId(tId, true);
                }
                delete this.projectsBacklog[session.hostHash][key];
            }
            for (var tgId in this.taskGroups[session.hostHash]) {
                var tg = this.taskGroups[session.hostHash][tgId];
                if (tg.getProjectId() == key) {
                    this.projects[session.hostHash][key].addTaskGroupId(tg.getId(), true);
                }
            }
            var df_1 = pmc_mail_1.Q.defer();
            sp.then(function () {
                if (key == _this.kvdbProjectId) {
                    _this.kvdbProjectDeferred.resolve();
                }
                _this.kvdbAnyProjectDeferred.resolve(key);
                df_1.resolve();
            });
            return df_1.promise;
        }
        else if (type == "g") {
            this.privateSectionIdUpdater.fixTaskGroup(payload);
            DataMigration_1.DataMigration.migrateTaskGroup(payload);
            payload.taskIds = key in this.taskGroups[session.hostHash] ? this.taskGroups[session.hostHash][key].getTaskIds() : [];
            var tg = new TaskGroup_1.TaskGroup(payload);
            this.taskGroups[session.hostHash][key] = tg;
            this.origTaskGroups[session.hostHash][key] = new TaskGroup_1.TaskGroup(JSON.parse(JSON.stringify(payload)));
            if (key in this.taskGroupsBacklog[session.hostHash]) {
                for (var _b = 0, _c = this.taskGroupsBacklog[session.hostHash][key]; _b < _c.length; _b++) {
                    var tId = _c[_b];
                    tg.addTaskId(tId, true);
                }
                delete this.taskGroupsBacklog[session.hostHash][key];
            }
            var pk = tg.getProjectId();
            if (pk in this.projects[session.hostHash]) {
                this.projects[session.hostHash][pk].addTaskGroupId(tg.getId(), true);
                this.fire(session, "project", pk, "modified");
            }
        }
        else if (type == "t") {
            this.privateSectionIdUpdater.fixTask(payload);
            DataMigration_1.DataMigration.migrateTask(payload);
            var t_1 = new Task_1.Task(payload);
            var oldTask_1 = this.tasks[session.hostHash][key];
            var oldTask2_1 = this.origTasks[session.hostHash][key];
            if (t_1.getProjectId() != kvdbId) {
                return pmc_mail_1.Q.resolve();
            }
            this.taskTitleCache[session.hostHash][t_1.getId()] = t_1.getName();
            pmc_mail_1.Q().then(function () {
                var differentLabelClass = false;
                if (oldTask_1 && oldTask_1.getLabelClass() != t_1.getLabelClass()) {
                    differentLabelClass = true;
                }
                else if (oldTask2_1 && oldTask2_1.getLabelClass() != t_1.getLabelClass()) {
                    differentLabelClass = true;
                }
                if (differentLabelClass) {
                    _this.app.dispatchEvent({
                        type: "task-badge-changed",
                        taskId: t_1.getId(),
                        taskLabelClass: t_1.getLabelClass(),
                        hostHash: session.hostHash,
                    });
                }
            })
                .fail(function (err) {
                Logger.error("Error while dispatching task-badge-changed event", err);
            });
            if (oldTask_1) {
                if (oldTask_1.getProjectId() != t_1.getProjectId()) {
                    this.fire(session, "task", key, "section-changed");
                    if (!this.preventFireDelete[session.hostHash]) {
                        this.preventFireDelete[session.hostHash] = [];
                    }
                    this.preventFireDelete[session.hostHash].push(oldTask_1.getProjectId() + "___t_" + key);
                }
            }
            this.tasks[session.hostHash][key] = t_1;
            this.origTasks[session.hostHash][key] = new Task_1.Task(JSON.parse(JSON.stringify(payload)));
            var tgks = t_1.getTaskGroupIds();
            if (t_1.taskGroupId) {
                if (payload.taskGroupIds) {
                    delete t_1.taskGroupId;
                }
                else {
                    tgks.push(t_1.taskGroupId);
                }
            }
            var muted = this.getMutedInfoSingleSession(session);
            if (this.wasTaskUnread(session, t_1, t_1.getProjectId())) {
                var realId = Number(t_1.getId());
                if (realId > 0) {
                    if (!muted[t_1.getProjectId()]) {
                        if (this.fireLocks == 0) {
                            this.refreshWatched();
                        }
                        else {
                            var section = session.sectionManager.getSection(t_1.getProjectId());
                            if (!section || section.isKvdbModuleEnabled()) {
                                this.addUnreadTaskToCount();
                            }
                        }
                    }
                    this.app.dispatchEvent({
                        type: "update-section-badge",
                        sectionId: t_1.getProjectId(),
                        hostHash: session.hostHash,
                    });
                }
            }
            if (tgks.length == 0) {
                tgks.push("__orphans__");
            }
            else {
                var notOrphan = false;
                for (var k in tgks) {
                    var v = tgks[k];
                    if (v == undefined || v == "") {
                        tgks[k] = "__orphans__";
                    }
                    if (tgks[k] != "__orphans__") {
                        notOrphan = true;
                    }
                }
                if (!notOrphan) {
                    tgks.length = 0;
                    tgks.push("__orphans__");
                }
                if (notOrphan) {
                    tgks = tgks.filter(function (s) { return s != "__orphans__"; });
                    t_1.setTaskGroupIds(tgks);
                }
            }
            if (tgks[0] != "__orphans__") {
                for (var _d = 0, tgks_1 = tgks; _d < tgks_1.length; _d++) {
                    var tgk = tgks_1[_d];
                    if (tgk in this.taskGroups[session.hostHash]) {
                        this.taskGroups[session.hostHash][tgk].addTaskId(t_1.getId(), true);
                        this.fire(session, "taskGroup", tgk, "modified");
                    }
                    else {
                        if (!this.taskGroupsBacklog[session.hostHash][tgk]) {
                            this.taskGroupsBacklog[session.hostHash][tgk] = [];
                        }
                        this.taskGroupsBacklog[session.hostHash][tgk].push(t_1.getId());
                    }
                }
            }
            else {
                var pk = t_1.getProjectId();
                if (pk in this.projects[session.hostHash]) {
                    this.projects[session.hostHash][pk].addOrphanedTasksId(t_1.getId(), true);
                    this.fire(session, "project", pk, "modified");
                }
                else {
                    if (!this.projectsBacklog[session.hostHash][pk]) {
                        this.projectsBacklog[session.hostHash][pk] = [];
                    }
                    this.projectsBacklog[session.hostHash][pk].push(t_1.getId());
                }
            }
            if (oldTask_1) {
                var newTgIds_1 = t_1.getTaskGroupIds();
                var removeFrom = oldTask_1.getTaskGroupIds(true).filter(function (x) { return newTgIds_1.indexOf(x) < 0; });
                for (var _e = 0, removeFrom_1 = removeFrom; _e < removeFrom_1.length; _e++) {
                    var id = removeFrom_1[_e];
                    if (id == "__orphans__") {
                        var p = this.projects[session.hostHash][oldTask_1.getProjectId()];
                        if (p) {
                            p.removeOrphanedTasksId(t_1.getId());
                            this.fire(session, "project", p.getId(), "modified");
                        }
                    }
                    else {
                        var tg = this.taskGroups[session.hostHash][id];
                        if (tg) {
                            tg.removeTaskId(t_1.getId());
                            this.fire(session, "taskGroup", id, "modified");
                        }
                    }
                }
            }
            this.fire(session, "task", key, modified ? "modified" : "added");
            if (modified && oldTask_1) {
                this.checkAttachmentChanges(session, oldTask_1, t_1);
            }
        }
        return pmc_mail_1.Q.resolve();
    };
    TasksPlugin.prototype.lockSaving = function (hostHash, key) {
        if ((hostHash in this.savingLocks) && (key in this.savingLocks[hostHash])) {
            return false;
        }
        if (!(hostHash in this.savingLocks)) {
            this.savingLocks[hostHash] = {};
        }
        this.savingLocks[hostHash][key] = pmc_mail_1.Q.defer();
        return true;
    };
    TasksPlugin.prototype.unlockSaving = function (hostHash, key, version) {
        if ((hostHash in this.savingLocks) && (key in this.savingLocks[hostHash])) {
            this.savingLocks[hostHash][key].resolve(version);
            delete this.savingLocks[hostHash][key];
        }
    };
    TasksPlugin.prototype.setKvdbElement = function (session, collectionId, key, element, version, origElement) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (_this.lockSaving(session.hostHash, key)) {
                return _this.setKvdbElementCore(session, collectionId, key, element, version, origElement)
                    .then(function (newVersion) {
                    _this.unlockSaving(session.hostHash, key, newVersion || version);
                })
                    .fail(function () {
                    _this.unlockSaving(session.hostHash, key, version);
                });
            }
            else {
                return _this.savingLocks[session.hostHash][key].promise.then(function (newVersion) {
                    return _this.setKvdbElement(session, collectionId, key, element, newVersion || version, origElement);
                });
            }
        });
    };
    TasksPlugin.prototype.setKvdbElementCore = function (session, collectionId, key, element, version, origElement) {
        var _this = this;
        this.prepareForSave(key, element);
        var element2 = JSON.parse(JSON.stringify(element));
        if ("taskGroupIds" in element2 && element2.className == "com.privmx.plugin.tasks.main.data.Project") {
            element2.taskGroupIds = [];
        }
        if ("orphanedTaskIds" in element2) {
            element2.orphanedTaskIds = [];
        }
        if ("taskIds" in element2) {
            element2.taskIds = [];
        }
        var entry = this.kvdbCs[session.hostHash][collectionId].getSync(key);
        if (entry && entry.secured.payload) {
            element2.__version__ = entry.secured.payload.__version__ + 1;
        }
        else if ("__version__" in element2) {
            element2.__version__++;
        }
        else {
            element2.__version__ = 1;
        }
        var el = JSON.parse(JSON.stringify(this.kvdbCs[session.hostHash][collectionId].getSync(key)));
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
            .then(function () {
            var entry2 = { secured: { payload: element2, key: key }, version: version };
            if (key[1] == "_") {
                if (key[0] == "p") {
                    _this.origProjects[session.hostHash][element.getId()] = _this.createObject(session, JSON.parse(JSON.stringify(entry2.secured)));
                    _this.updateFixedProjectName(_this.origProjects[session.hostHash][element.getId()]);
                }
                else if (key[0] == "g") {
                    _this.origTaskGroups[session.hostHash][element.getId()] = _this.createObject(session, JSON.parse(JSON.stringify(entry2.secured)));
                }
                else if (key[0] == "t") {
                    var oldTask = origElement;
                    var newTask = _this.createObject(session, JSON.parse(JSON.stringify(entry2.secured)));
                    _this.origTasks[session.hostHash][element.getId()] = newTask;
                    if (oldTask && newTask && oldTask.getStatus() != newTask.getStatus()) {
                        _this.app.dispatchEvent({
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
            .fail(function (e) {
            if (e && e.data && e.data.error && e.data.error.code == TasksPlugin.ERR_INVALID_VERSION) {
                return _this.kvdbCs[session.hostHash][collectionId].refresh().then(function () {
                    var oldObject = _this.prepareForSave(key, origElement);
                    var myObject = element;
                    el = JSON.parse(JSON.stringify(_this.kvdbCs[session.hostHash][collectionId].getSync(key)));
                    if (!el) {
                        for (var id in _this.kvdbCs[session.hostHash]) {
                            var x = _this.kvdbCs[session.hostHash][id];
                            var el2 = x.getSync(key);
                            if (el2) {
                                el = JSON.parse(JSON.stringify(el2));
                            }
                        }
                    }
                    if (!el || !el.secured || !el.secured.payload) {
                        return _this.setKvdbElementCore(session, collectionId, key, myObject);
                    }
                    var othersObject = _this.prepareForSave(key, _this.createObject(session, el.secured));
                    var newObject = null;
                    if (othersObject.modifiedBy == _this.getMyId(_this.session)) {
                        return _this.setKvdbElementCore(session, collectionId, key, myObject);
                    }
                    var resolver;
                    if (myObject instanceof Project_1.Project) {
                        resolver = new ProjectConflictResolver_1.ProjectConflictResolver(oldObject, myObject, othersObject);
                    }
                    else if (myObject instanceof TaskGroup_1.TaskGroup) {
                        resolver = new TaskGroupConflictResolver_1.TaskGroupConflictResolver(oldObject, myObject, othersObject);
                    }
                    else if (myObject instanceof Task_1.Task) {
                        resolver = new TaskConflictResolver_1.TaskConflictResolver(oldObject, myObject, othersObject);
                    }
                    if (resolver) {
                        var result = resolver.resolve();
                        if (result.status == ConflictResolver_1.ConflictResolutionStatus.RESOLVED) {
                            newObject = result.resolvedObject;
                        }
                        else if (result.status == ConflictResolver_1.ConflictResolutionStatus.IDENTICAL) {
                            newObject = element;
                        }
                        if (newObject) {
                            newObject.__version__ = othersObject.__version__;
                            return _this.setKvdbElementCore(session, collectionId, key, newObject);
                        }
                    }
                    return pmc_mail_1.Q.reject("conflict");
                });
            }
            return version;
        });
    };
    TasksPlugin.prototype.getTaskVersion = function (session, taskId) {
        var task = this.tasks[session.hostHash][taskId];
        if (task) {
            var el = this.kvdbCs[session.hostHash][task.getProjectId()].getSync("t_" + taskId);
            if (el) {
                return el.version;
            }
        }
        return null;
    };
    TasksPlugin.prototype.getKvdbElement = function (session, collectionId, key) {
        return this.kvdbCs[session.hostHash][collectionId].getSync(key).secured.payload;
    };
    TasksPlugin.prototype.deleteKvdbElement = function (session, collectionId, key, preventFire) {
        if (preventFire === void 0) { preventFire = false; }
        var type = key[0];
        var typeStr = (type == "p" ? "project" : (type == "g" ? "taskGroup" : "task"));
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
        var el = this.kvdbCs[session.hostHash][collectionId].getSync(key);
        return this.kvdbCs[session.hostHash][collectionId].set(key, { secured: { payload: null }, version: el ? el.version : null });
    };
    TasksPlugin.prototype.createObject = function (session, data) {
        var key = data.key;
        var payload = data.payload;
        if (!payload) {
            return null;
        }
        if (key[1] == "_") {
            if (key[0] == "p") {
                DataMigration_1.DataMigration.migrateProject(payload);
                var p = new Project_1.Project(payload);
                for (var tgId in this.taskGroups[session.hostHash]) {
                    var tg = this.taskGroups[session.hostHash][tgId];
                    if (tg.getProjectId() == p.getId()) {
                        p.addTaskGroupId(tg.getId(), true);
                    }
                }
                for (var tId in this.tasks[session.hostHash]) {
                    var t = this.tasks[session.hostHash][tId];
                    var tgIds = t.getTaskGroupIds();
                    if (t.getProjectId() == p.getId() && (tgIds.length == 0 || (tgIds.length == 1 && tgIds[0] == "__orphans__"))) {
                        p.addOrphanedTasksId(t.getId(), true);
                    }
                }
                return p;
            }
            else if (key[0] == "g") {
                DataMigration_1.DataMigration.migrateTaskGroup(payload);
                var tg = new TaskGroup_1.TaskGroup(payload);
                return tg;
            }
            else if (key[0] == "t") {
                DataMigration_1.DataMigration.migrateTask(payload);
                var t = new Task_1.Task(payload);
                return t;
            }
        }
        return null;
    };
    TasksPlugin.prototype.prepareForSave = function (key, data) {
        if (key[0] == "p") {
            var idx = data.taskGroupIds.indexOf("__orphans__");
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
    };
    TasksPlugin.prototype.projectLoaded = function (session, id) {
        this.kvdbProjectId = id;
        if (id in this.projects[session.hostHash]) {
            this.kvdbProjectDeferred.resolve();
        }
        return this.kvdbProjectDeferred.promise;
    };
    TasksPlugin.prototype.anyProjectLoaded = function (session) {
        for (var k in this.projects[session.hostHash]) {
            this.kvdbAnyProjectDeferred.resolve(k);
            break;
        }
        return this.kvdbAnyProjectDeferred.promise;
    };
    TasksPlugin.prototype.nextId = function (session, key) {
        return pmc_mail_1.Q().then(function () {
            return session.mailClientApi.privmxRegistry.getSrpSecure();
        })
            .then(function (srpSecure) {
            return srpSecure.request("nextUniqueId", { key: key });
        })
            .then(function (x) {
            var s = "" + x;
            while (s.length < 3) {
                s = "0" + s;
            }
            return s;
        });
    };
    TasksPlugin.prototype.watch = function (session, type, id, action, handler) {
        try {
            var key = type + "-" + id + "-" + action;
            if (!session) {
                throw Error("Cannnot add watcher with empty session - id: " + id);
            }
            if (!this.watched[session.hostHash]) {
                this.watched[session.hostHash] = {};
            }
            if (!this.watched[session.hostHash][key]) {
                this.watched[session.hostHash][key] = [];
            }
            this.watched[session.hostHash][key].push(handler);
        }
        catch (e) {
            console.error(e);
        }
    };
    TasksPlugin.prototype.unWatch = function (session, type, id, action, handler) {
        var key = type + "-" + id + "-" + action;
        if (!this.watched[session.hostHash]) {
            this.watched[session.hostHash] = {};
        }
        if (!this.watched[session.hostHash][key]) {
            return;
        }
        var idx = this.watched[session.hostHash][key].indexOf(handler);
        if (idx >= 0) {
            this.watched[session.hostHash][key].splice(idx, 1);
        }
    };
    TasksPlugin.prototype.fire = function (session, type, id, action) {
        if (this.fireLocks > 0) {
            return;
        }
        if (!this.watched[session.hostHash]) {
            this.watched[session.hostHash] = {};
        }
        for (var key in this.watched[session.hostHash]) {
            var _a = key.split("-"), t = _a[0], i = _a[1], a = _a[2];
            if ((t == type || t == "*") && (i == id || i == "*") && (a == action || a == "*")) {
                for (var _i = 0, _b = this.watched[session.hostHash][key]; _i < _b.length; _i++) {
                    var handler = _b[_i];
                    handler(type, id, action);
                }
            }
        }
        if (this.searchStr != "") {
            this.updateSearch(this.searchStr);
        }
    };
    TasksPlugin.prototype.fireAllAdded = function (session, filterSectionId) {
        if (filterSectionId === void 0) { filterSectionId = null; }
        if (this.fireLocks > 0) {
            return;
        }
        var doFilter = filterSectionId !== null;
        for (var k in this.projects[session.hostHash]) {
            if (doFilter && k != filterSectionId) {
                continue;
            }
            this.fire(session, "project", k, "added");
        }
        for (var k in this.taskGroups[session.hostHash]) {
            if (doFilter && this.taskGroups[session.hostHash][k] && this.taskGroups[session.hostHash][k].getProjectId() != filterSectionId) {
                continue;
            }
            this.fire(session, "taskGroup", k, "added");
        }
        for (var k in this.tasks[session.hostHash]) {
            if (doFilter && this.tasks[session.hostHash][k] && this.tasks[session.hostHash][k].getProjectId() != filterSectionId) {
                continue;
            }
            this.fire(session, "task", k, "added");
        }
    };
    TasksPlugin.prototype.fetchAllUsers = function (session) {
        var _this = this;
        if (!this.userNames[session.hostHash]) {
            this.userNames[session.hostHash] = [];
        }
        return this.utilApi.getUsernames()
            .then(function (arr) {
            if (_this.userNames[session.hostHash]) {
                _this.userNames[session.hostHash] = arr;
            }
        })
            .fail(function () {
            if (_this.userNames[session.hostHash]) {
                _this.userNames[session.hostHash] = [];
            }
        });
    };
    TasksPlugin.prototype.getMyself = function (session) {
        var person = session.conv2Service.personService.getPerson(session.sectionManager.identity.hashmail);
        var contact = person ? person.getContact() : null;
        return {
            id: session.sectionManager.identity.hashmail,
            name: session.sectionManager.identity.user,
            avatar: this.app.assetsManager.getAssetByName("DEFAULT_USER_AVATAR"),
            isBasic: contact ? contact.basicUser : false,
        };
    };
    TasksPlugin.prototype.personExists = function (session, personId) {
        return session.conv2Service.personService.persons.contactCollection.find(function (x) { return x.getHashmail() == personId; }) != null;
    };
    TasksPlugin.prototype.getPerson = function (session, personId) {
        var person = session.conv2Service.personService.getPerson(personId);
        if (!person) {
            var av = this.app.assetsManager.getAssetByName("DEFAULT_USER_AVATAR");
            return { id: "anonymous", name: "Anonymous", avatar: av, isBasic: false };
        }
        if (person.getHashmail() == "bot#simplito.com") {
            return null;
        }
        var profile = session.conv2Service.personService.getPerson(person.getHashmail());
        var contact = profile.getContact();
        return {
            id: profile.getHashmail(),
            name: profile.getName(),
            avatar: profile.getHashmail(),
            isBasic: contact ? contact.basicUser : false,
        };
    };
    TasksPlugin.prototype.getMyId = function (session) {
        return this.getMyself(session).id;
    };
    TasksPlugin.prototype.getPeople = function (session, names) {
        var arr = [];
        for (var _i = 0, names_1 = names; _i < names_1.length; _i++) {
            var name_2 = names_1[_i];
            arr.push(this.getPerson(session, name_2));
        }
        return arr;
    };
    TasksPlugin.prototype.getAllPeople = function (session) {
        var ret = {};
        for (var _i = 0, _a = session.conv2Service.personService.persons.contactCollection.list; _i < _a.length; _i++) {
            var person = _a[_i];
            if (person.getHashmail() == "bot#simplito.com") {
                continue;
            }
            var profile = session.conv2Service.personService.getPerson(person.getHashmail());
            var contact = profile.getContact();
            ret[profile.getHashmail()] = {
                id: profile.getHashmail(),
                name: profile.getName(),
                avatar: profile.getHashmail(),
                isBasic: contact ? contact.basicUser : false,
                deleted: session.conv2Service.contactService.deletedUsers.indexOf(profile.usernameCore) >= 0,
            };
        }
        return ret;
    };
    TasksPlugin.prototype.getProjectMemberIds = function (session, projectId) {
        var arr = [];
        var people = this.getProjectMembers(session, projectId);
        for (var k in people) {
            arr.push(people[k].id);
        }
        return arr;
    };
    TasksPlugin.prototype.getProjectMembers = function (session, _projectId) {
        return this.getAllPeople(session);
    };
    TasksPlugin.prototype.getProjectMemberNames = function (session, projectId) {
        var map = {};
        var people = this.getProjectMembers(session, projectId);
        for (var k in people) {
            map[people[k].id] = people[k].name;
        }
        return map;
    };
    TasksPlugin.prototype.getMembers = function (session, memberIds) {
        var people = this.getAllPeople(session);
        var res = {};
        for (var _i = 0, memberIds_1 = memberIds; _i < memberIds_1.length; _i++) {
            var id = memberIds_1[_i];
            if (id in people) {
                res[id] = people[id];
            }
        }
        return res;
    };
    TasksPlugin.prototype.getMembersArray = function (session, memberIds) {
        var people = this.getAllPeople(session);
        var res = [];
        for (var _i = 0, memberIds_2 = memberIds; _i < memberIds_2.length; _i++) {
            var id = memberIds_2[_i];
            if (id in people) {
                res.push(people[id]);
            }
        }
        return res;
    };
    TasksPlugin.prototype.getMemberNames = function (session, memberIds) {
        var members = this.getMembers(session, memberIds);
        var res = [];
        for (var _i = 0, memberIds_3 = memberIds; _i < memberIds_3.length; _i++) {
            var id = memberIds_3[_i];
            if (id in members) {
                res.push(members[id].name);
            }
        }
        return res;
    };
    TasksPlugin.prototype.ensureSessionProjectsInitialized = function (session) {
        var _this = this;
        return pmc_mail_1.Q.all(this.tasksSectionsCollection[session.hostHash].list.map(function (x) { return _this.ensureProjectExists(x.getId(), x.getName(), session)
            .fail(function (e) { return Logger.error("ensureProjectExists", e, "section", x, _this.projects); }); }))
            .thenResolve(null);
    };
    TasksPlugin.prototype.ensureProjectExists = function (id, name, session) {
        var _this = this;
        if (this.projects[session.hostHash] && this.projects[session.hostHash][id] && (this.projects[session.hostHash][id].getName() == name || this.getPrivateSectionId() == id)) {
            if (this.kvdbCs[session.hostHash] && this.kvdbCs[session.hostHash][id]) {
                return pmc_mail_1.Q();
            }
        }
        return pmc_mail_1.Q().then(function () {
            return _this.readWatchedTasksHistory(session, id).then(function () {
                return _this.ensureKvdbCExists(id, session).then(function () {
                    if (!(id in _this.projects[session.hostHash])) {
                        var proj = new Project_1.Project();
                        DataMigration_1.DataMigration.setVersion(proj);
                        proj.setId(id);
                        proj.setName(name);
                        proj.setTaskPriorities(["Critical", "High", "[Normal]", "Low"]);
                        proj.setTaskStatuses(["Idea", "[Todo]", "In progress", "Done"]);
                        proj.setTaskTypes(["Bug", "Feature", "[Other]"]);
                        return _this.saveProject(session, proj);
                    }
                    else {
                        if (_this.projects[session.hostHash][id].getName() != name) {
                            if (_this.getPrivateSectionId() != id) {
                                _this.projects[session.hostHash][id].setName(name);
                            }
                            else {
                                _this.projects[session.hostHash][id].setName(_this.app.localeService.i18n("plugin.tasks.privateTasks"));
                            }
                        }
                    }
                    return pmc_mail_1.Q.resolve();
                });
            });
        })
            .fail(function (e) {
            console.log("on ensureProjectExists fail for - hosthash: ", session.hostHash, "projectId: ", id, e);
        });
    };
    TasksPlugin.prototype.getAvailableProjects = function (session) {
        var res = {};
        for (var _i = 0, _a = this.tasksSectionsCollection[session.hostHash].list; _i < _a.length; _i++) {
            var el = _a[_i];
            if (el.getId() in this.projects[session.hostHash]) {
                res[el.getId()] = this.projects[session.hostHash][el.getId()];
            }
        }
        return res;
    };
    TasksPlugin.prototype.fetchAllProjects = function () {
        return pmc_mail_1.Q.resolve();
    };
    TasksPlugin.prototype.taskExists = function (session, taskId) {
        return taskId in this.tasks[session.hostHash];
    };
    TasksPlugin.prototype.getTaskLabelClassByTaskId = function (session, taskId) {
        if (!taskId) {
            return;
        }
        var task = this.getTask(session, taskId);
        if (!task) {
            return;
        }
        return this.getLabelClassFor(session, task.getProjectId(), task.getStatus());
    };
    TasksPlugin.prototype.getLabelClassFor = function (_session, _projectId, status) {
        if (typeof (status) == "number") {
            status = Task_1.Task.convertStatus(status, false);
        }
        return Task_1.Task.getLabelClass(status);
    };
    TasksPlugin.prototype.getProjects = function (session, projectIds) {
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        if (!projectIds) {
            return this.projects[session.hostHash];
        }
        var res = {};
        for (var _i = 0, projectIds_1 = projectIds; _i < projectIds_1.length; _i++) {
            var projectId = projectIds_1[_i];
            res[projectId] = (projectId in this.projects[session.hostHash] ? this.projects[session.hostHash][projectId] : null);
        }
        return res;
    };
    TasksPlugin.prototype.getProject = function (session, projectId) {
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        if (projectId in this.projects[session.hostHash]) {
            return this.projects[session.hostHash][projectId];
        }
        return null;
    };
    TasksPlugin.prototype.saveProject = function (session, project, version, origElement) {
        var _this = this;
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        this.projects[session.hostHash][project.getId()] = project;
        this.updateFixedProjectName(this.projects[session.hostHash][project.getId()]);
        return this.ensureKvdbCExists(project.getId(), session).then(function () { return _this.setKvdbElement(session, project.getId(), "p_" + project.getId(), project, version, origElement); });
    };
    TasksPlugin.prototype.deleteProject = function (session, project, save) {
        if (save === void 0) { save = true; }
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        if (project.getId() in this.projects[session.hostHash]) {
            var pId = project.getId();
            delete this.projects[session.hostHash][project.getId()];
            if (save) {
                return this.deleteKvdbElement(session, pId, "p_" + pId);
            }
            else {
                return pmc_mail_1.Q.resolve();
            }
        }
        return pmc_mail_1.Q.reject(TasksPlugin.REJECT_REASON_DOES_NOT_EXIST);
    };
    TasksPlugin.prototype.nextProjectId = function (session) {
        return this.nextId(session, Types_1.StoredObjectTypes.tasksSection);
    };
    TasksPlugin.prototype.projectSectionExists = function (session, projectId) {
        var ret = !!this.tasksSectionsCollection[session.hostHash].find(function (x) { return x && x.getId() == projectId; });
        return ret;
    };
    TasksPlugin.prototype.updateFixedProjectName = function (project) {
        var privateSectionId = this.getPrivateSectionId();
        if (!project || !privateSectionId) {
            return;
        }
        if (project.getId() == privateSectionId) {
            project.setName(this.app.localeService.i18n("plugin.tasks.privateTasks"));
        }
    };
    TasksPlugin.prototype.fetchAllTaskGroups = function () {
        return pmc_mail_1.Q.resolve();
    };
    TasksPlugin.prototype.getTaskGroups = function (session, taskGroupIds) {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (!taskGroupIds) {
            return this.taskGroups[session.hostHash];
        }
        var res = {};
        for (var _i = 0, taskGroupIds_1 = taskGroupIds; _i < taskGroupIds_1.length; _i++) {
            var taskGroupId = taskGroupIds_1[_i];
            res[taskGroupId] = (taskGroupId in this.taskGroups[session.hostHash] ? this.taskGroups[session.hostHash][taskGroupId] : null);
        }
        return res;
    };
    TasksPlugin.prototype.getAllTaskGroupNames = function (session) {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        var res = {};
        var taskGroups = this.taskGroups;
        for (var taskGroupId in taskGroups[session.hostHash]) {
            res[taskGroupId] = taskGroups[session.hostHash][taskGroupId].getName();
        }
        return res;
    };
    TasksPlugin.prototype.getTaskGroupNames = function (session, taskGroupIds, skipNulls) {
        if (skipNulls === void 0) { skipNulls = false; }
        var res = {};
        var taskGroups = this.getTaskGroups(session, taskGroupIds);
        for (var taskGroupId in taskGroups) {
            if (taskGroups[taskGroupId] !== null || !skipNulls) {
                res[taskGroupId] = taskGroups[taskGroupId] !== null ? taskGroups[taskGroupId].getName() : null;
            }
        }
        return res;
    };
    TasksPlugin.prototype.getTaskGroup = function (session, taskGroupId) {
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (taskGroupId in this.taskGroups[session.hostHash]) {
            return this.taskGroups[session.hostHash][taskGroupId];
        }
        return null;
    };
    TasksPlugin.prototype.saveTaskGroup = function (session, taskGroup, version, origElement) {
        var _this = this;
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        this.taskGroups[session.hostHash][taskGroup.getId()] = taskGroup;
        return this.ensureKvdbCExists(taskGroup.getProjectId(), session).then(function () { return _this.setKvdbElement(session, taskGroup.getProjectId(), "g_" + taskGroup.getId(), taskGroup, version, origElement); });
    };
    TasksPlugin.prototype.deleteTaskGroup = function (session, taskGroup, save, onlyTaskGroup) {
        var _this = this;
        if (save === void 0) { save = true; }
        if (onlyTaskGroup === void 0) { onlyTaskGroup = true; }
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (taskGroup.getId() in this.taskGroups[session.hostHash]) {
            var proj_1 = this.getProject(session, taskGroup.getProjectId());
            var tasksToSave_1 = {};
            if (!onlyTaskGroup) {
                if (proj_1 != null) {
                    proj_1.removeTaskGroupId(taskGroup.getId());
                }
                var tasks = this.getTasks(session, taskGroup.getTaskIds());
                for (var taskId in tasks) {
                    var task = tasks[taskId];
                    if (task) {
                        tasksToSave_1[taskId] = task;
                        if (task.getTaskGroupIds().length == 1) {
                            task.setTaskGroupIds(["__orphans__"]);
                            if (proj_1 != null) {
                                proj_1.addOrphanedTasksId(task.getId(), true);
                            }
                        }
                        else {
                            task.setTaskGroupIds(task.getTaskGroupIds().filter(function (id) { return id != taskGroup.getId(); }));
                        }
                    }
                }
            }
            delete this.taskGroups[session.hostHash][taskGroup.getId()];
            if (save) {
                var prom = pmc_mail_1.Q();
                prom = prom.then(function () { return _this.ensureKvdbCExists(taskGroup.getProjectId(), session); });
                var f0 = function () { return _this.deleteKvdbElement(session, taskGroup.getProjectId(), "g_" + taskGroup.getId()); };
                prom = prom.then(f0);
                if (!onlyTaskGroup) {
                    var f1 = function () { return _this.saveProject(session, proj_1); };
                    prom = prom.then(f1);
                    var _loop_4 = function (id) {
                        var f2 = function () { return _this.saveTask(session, tasksToSave_1[id]); };
                        prom = prom.then(f2);
                    };
                    for (var id in tasksToSave_1) {
                        _loop_4(id);
                    }
                }
                return prom;
            }
            else {
                return pmc_mail_1.Q.resolve();
            }
        }
        return pmc_mail_1.Q.reject(TasksPlugin.REJECT_REASON_DOES_NOT_EXIST);
    };
    TasksPlugin.prototype.nextTaskGroupId = function (session) {
        return this.nextId(session, Types_1.StoredObjectTypes.tasksList);
    };
    TasksPlugin.prototype.fetchAllTasks = function () {
        return pmc_mail_1.Q.resolve();
    };
    TasksPlugin.prototype.getTasks = function (session, taskIds) {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (!taskIds) {
            return this.tasks[session.hostHash];
        }
        var res = {};
        for (var _i = 0, taskIds_1 = taskIds; _i < taskIds_1.length; _i++) {
            var taskId = taskIds_1[_i];
            res[taskId] = (taskId in this.tasks[session.hostHash] ? this.tasks[session.hostHash][taskId] : null);
        }
        return res;
    };
    TasksPlugin.prototype.getTask = function (session, taskId) {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (taskId in this.tasks[session.hostHash]) {
            return this.tasks[session.hostHash][taskId];
        }
        return null;
    };
    TasksPlugin.prototype.addTask = function (session, task) {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (!(task.getId() in this.tasks[session.hostHash])) {
            this.tasks[session.hostHash][task.getId()] = task;
        }
        return this.sendTaskMessage(session, task, "create-task")
            .then(function (dt) {
            if (dt) {
                task.updateModifiedServerDateTime(dt);
                task.setCreatedDateTime(dt);
            }
        });
    };
    TasksPlugin.prototype.saveTask = function (session, task, version, origElement) {
        var _this = this;
        return this.ensureKvdbCExists(task.getProjectId(), session).then(function () { return _this.setKvdbElement(session, task.getProjectId(), "t_" + task.getId(), task, version, origElement); })
            .then(function () {
            if (!_this.app.userPreferences.getAutoMarkAsRead()) {
                _this.refreshWatched();
            }
        });
    };
    TasksPlugin.prototype.isTaskDone = function (session, taskData) {
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        var task = typeof (taskData) == "object" ? taskData : this.tasks[session.hostHash][taskData];
        if (task) {
            return task.getStatus() == Task_1.TaskStatus.DONE;
        }
        return false;
    };
    TasksPlugin.prototype.OLDdeleteTask = function (session, task, save) {
        if (save === void 0) { save = true; }
        this.sendTaskMessage(session, task, "delete-task");
        if (task.getId() in this.tasks[session.hostHash]) {
            delete this.tasks[session.hostHash][task.getId()];
            if (save) {
                return this.deleteKvdbElement(session, task.getProjectId(), "t_" + task.getId());
            }
            else {
                return pmc_mail_1.Q.resolve();
            }
        }
        return pmc_mail_1.Q.reject(TasksPlugin.REJECT_REASON_DOES_NOT_EXIST);
    };
    TasksPlugin.prototype.moveToTrash = function (session, tasks) {
        return this.toggleTrashed(session, tasks, true);
    };
    TasksPlugin.prototype.restoreFromTrash = function (session, tasks) {
        return this.toggleTrashed(session, tasks, false);
    };
    TasksPlugin.prototype.toggleTrashed = function (session, tasks, trashed) {
        var _this = this;
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        var tasksToSave = [];
        var prom = pmc_mail_1.Q();
        var _loop_5 = function (tId) {
            var t = this_2.tasks[session.hostHash][tId];
            if (!t) {
                return "continue";
            }
            tasksToSave.push(t.getId());
            t.setIsTrashed(trashed);
            t.addHistory({
                when: new Date().getTime(),
                who: this_2.getMyId(session),
                what: trashed ? "trashed" : "restored",
            });
            t.setModifiedBy(this_2.getMyId(session));
            t.setModifiedDateTime(new Date().getTime());
            prom = prom.then(function () {
                return _this.sendTaskMessage(session, t, "modify-task")
                    .then(function (dt) {
                    if (dt) {
                        t.updateModifiedServerDateTime(dt);
                    }
                });
            });
        };
        var this_2 = this;
        for (var _i = 0, tasks_1 = tasks; _i < tasks_1.length; _i++) {
            var tId = tasks_1[_i];
            _loop_5(tId);
        }
        prom = prom.then(function () {
            return _this.saveModified(session, tasksToSave, [], []);
        });
        return prom;
    };
    TasksPlugin.prototype.deleteTasks = function (session, tasks) {
        var _this = this;
        if (!this.tasks[session.hostHash]) {
            this.tasks[session.hostHash] = {};
        }
        if (!this.taskGroups[session.hostHash]) {
            this.taskGroups[session.hostHash] = {};
        }
        if (!this.projects[session.hostHash]) {
            this.projects[session.hostHash] = {};
        }
        var tasksToSave = [];
        var taskGroupsToSave = [];
        var projectsToSave = [];
        var tasksToDelete = [];
        var _loop_6 = function (tId) {
            var fromTaskGroupIds = tasks[tId];
            var t = this_3.tasks[session.hostHash][tId];
            if (!t) {
                return "continue";
            }
            var tgIds = t.getTaskGroupIds();
            fromTaskGroupIds.forEach(function (tgId) {
                var idx = tgIds.indexOf(tgId);
                if (idx >= 0) {
                    tgIds.splice(idx, 1);
                    if (tgId == "__orphans__") {
                        var pId = t.getProjectId();
                        if (pId in _this.projects[session.hostHash]) {
                            _this.projects[session.hostHash][pId].removeOrphanedTasksId(tId);
                            if (projectsToSave.indexOf(pId) < 0) {
                                projectsToSave.push(pId);
                            }
                        }
                    }
                    else {
                        if (tgId in _this.taskGroups[session.hostHash]) {
                            _this.taskGroups[session.hostHash][tgId].removeTaskId(tId);
                            if (taskGroupsToSave.indexOf(tgId) < 0) {
                                taskGroupsToSave.push(tgId);
                            }
                        }
                    }
                }
            });
            var fullDelete = tgIds.length == 0;
            if (fullDelete) {
                this_3.sendTaskMessage(session, t, "delete-task");
                if (tasksToDelete.indexOf(tId) < 0) {
                    tasksToDelete.push(tId);
                }
            }
            else {
                t.setTaskGroupIds(tgIds);
                if (tasksToSave.indexOf(tId) < 0) {
                    tasksToSave.push(tId);
                }
            }
        };
        var this_3 = this;
        for (var tId in tasks) {
            _loop_6(tId);
        }
        return this.saveModified(session, tasksToSave, taskGroupsToSave, projectsToSave).then(function () {
            var prom = pmc_mail_1.Q();
            var _loop_7 = function (tId) {
                if (!(tId in _this.tasks[session.hostHash])) {
                    return "continue";
                }
                var f = function () {
                    var pId = _this.tasks[session.hostHash][tId].getProjectId();
                    delete _this.tasks[session.hostHash][tId];
                    return _this.deleteKvdbElement(session, pId, "t_" + tId);
                };
                prom = prom.then(f);
            };
            for (var _i = 0, tasksToDelete_1 = tasksToDelete; _i < tasksToDelete_1.length; _i++) {
                var tId = tasksToDelete_1[_i];
                _loop_7(tId);
            }
            return prom;
        });
    };
    TasksPlugin.prototype.deleteTask = function (session, task, fromTaskGroupIds) {
        if (fromTaskGroupIds === void 0) { fromTaskGroupIds = null; }
        if (!task) {
            return pmc_mail_1.Q.resolve();
        }
        if (fromTaskGroupIds === null) {
            fromTaskGroupIds = task.getTaskGroupIds(true);
        }
        var obj = {};
        obj[task.getId()] = fromTaskGroupIds;
        return this.deleteTasks(session, obj);
    };
    TasksPlugin.prototype.nextTaskId = function (session) {
        return this.nextId(session, Types_1.StoredObjectTypes.tasksTask);
    };
    TasksPlugin.prototype.sendTaskMessage = function (session, task, type) {
        var chatModule = session.sectionManager.getSection(task.getProjectId()).getChatModule();
        if (!chatModule) {
            return pmc_mail_1.Q(null);
        }
        var dt = null;
        return chatModule.sendTaskMessage(type, this.getMyId(session), task.getId(), "#" + task.getId().substr(0, 5), task.getName(), task.getDescription(), task.getStatus(), this.app.localeService.i18n("plugin.tasks.status-" + task.getStatus()), Task_1.Task.getStatuses().length, Task_1.Task.getLabelClass(task.getStatus()), task.getPriority(), task.getAssignedTo())
            .then(function (x) {
            if (x && x.source && x.source.serverDate) {
                dt = x.source.serverDate;
            }
        })
            .fail(function (err) { return Logger.error("Error sending task message", err); })
            .then(function () {
            return dt;
        });
    };
    TasksPlugin.prototype.sendTaskCommentMessage = function (session, task, comment, metaDataStr) {
        var _this = this;
        var chatModule = session.sectionManager.getSection(task.getProjectId()).getChatModule();
        if (!chatModule) {
            return;
        }
        return pmc_mail_1.Q().then(function () {
            return chatModule.sendTaggedJsonMessage({
                data: {
                    type: "task-comment",
                    who: _this.getMyId(session),
                    id: task.getId(),
                    label: "#" + task.getId().substr(0, 5),
                    comment: comment,
                    status: task.getStatus(),
                    statusLocaleName: _this.app.localeService.i18n("plugin.tasks.status-" + task.getStatus()),
                    numOfStatuses: Task_1.Task.getStatuses().length,
                    statusColor: Task_1.Task.getLabelClass(task.getStatus()),
                    metaDataStr: metaDataStr,
                }
            }, ["taskid:" + task.getId()])
                .then(function (result) {
                return result;
            })
                .fail(function (err) { return Logger.error("Error sending task comment message", err); });
        });
    };
    TasksPlugin.prototype.setUnreadTasksCount = function (value) {
        this.unreadTasks = value;
        this.tasksUnreadCountModel.setWithCheck(this.unreadTasks);
    };
    TasksPlugin.prototype.getUnreadTasksCount = function () {
        return this.unreadTasks;
    };
    TasksPlugin.prototype.addUnreadTaskToCount = function () {
        this.unreadTasks++;
        this.tasksUnreadCountModel.setWithCheck(this.unreadTasks);
    };
    TasksPlugin.prototype.delUnreadTaskFromCount = function () {
        this.unreadTasks--;
        this.tasksUnreadCountModel.setWithCheck(this.unreadTasks);
    };
    TasksPlugin.prototype.markTaskAsWatched = function (session, taskId, _sectionId) {
        this.markTasksAsWatched(session, [taskId]);
    };
    TasksPlugin.prototype.markTasksAsWatched = function (session, taskIds) {
        for (var _i = 0, taskIds_2 = taskIds; _i < taskIds_2.length; _i++) {
            var taskId = taskIds_2[_i];
            if (!taskId) {
                continue;
            }
            var t = this.tasks[session.hostHash][taskId];
            var sectionId = t.getProjectId();
            if (!(sectionId in this.watchedTasksHistory[session.hostHash])) {
                this.watchedTasksHistory[session.hostHash][sectionId] = {};
            }
            var tFromHistory = this.watchedTasksHistory[session.hostHash][sectionId][taskId];
            if ((t && tFromHistory && t.getModifiedDateTime() > tFromHistory.lastWatched) || !tFromHistory) {
                var watchedElement = { id: taskId, sectionId: sectionId, lastWatched: new Date().getTime() };
                this.watchedTasksHistory[session.hostHash][sectionId][taskId] = watchedElement;
                for (var _a = 0, _b = this.onWatchedTasksHistorySetHandlers; _a < _b.length; _a++) {
                    var handler = _b[_a];
                    handler(session.hostHash, sectionId, taskId, watchedElement);
                }
                this.writeWatchedTasksHistory(session, sectionId, watchedElement);
            }
        }
        this.refreshWatched();
        return pmc_mail_1.Q();
    };
    TasksPlugin.prototype.markTaskAsNotWatched = function (session, taskId, _sectionId) {
        this.markTasksAsNotWatched(session, [taskId]);
    };
    TasksPlugin.prototype.markTasksAsNotWatched = function (session, taskIds) {
        for (var _i = 0, taskIds_3 = taskIds; _i < taskIds_3.length; _i++) {
            var taskId = taskIds_3[_i];
            if (!taskId) {
                continue;
            }
            var t = this.tasks[session.hostHash][taskId];
            var sectionId = t.getProjectId();
            if (!(sectionId in this.watchedTasksHistory[session.hostHash])) {
                this.watchedTasksHistory[session.hostHash][sectionId] = {};
            }
            if (sectionId in this.watchedTasksHistory[session.hostHash] && this.watchedTasksHistory[session.hostHash][sectionId][taskId]) {
                var watchedElement = { id: taskId, sectionId: sectionId, lastWatched: 0 };
                this.watchedTasksHistory[session.hostHash][sectionId][taskId] = watchedElement;
                for (var _a = 0, _b = this.onWatchedTasksHistorySetHandlers; _a < _b.length; _a++) {
                    var handler = _b[_a];
                    handler(session.hostHash, sectionId, taskId, watchedElement);
                }
                this.writeWatchedTasksHistory(session, sectionId, watchedElement);
            }
        }
        this.refreshWatched();
        return pmc_mail_1.Q();
    };
    TasksPlugin.prototype.updateWatchedStatus = function (session, entry) {
        var taskId = entry.id;
        var sectionId = entry.sectionId;
        var lastWatched = entry.lastWatched;
        var t = this.tasks[session.hostHash][taskId];
        if (t) {
            if (!(sectionId in this.watchedTasksHistory[session.hostHash])) {
                this.watchedTasksHistory[session.hostHash][sectionId] = {};
            }
            var old = this.watchedTasksHistory[session.hostHash][sectionId][taskId];
            if (old && old.id == taskId && old.sectionId == sectionId && old.lastWatched >= lastWatched) {
                return;
            }
            this.watchedTasksHistory[session.hostHash][sectionId][taskId] = entry;
            this.refreshWatched();
            this.app.dispatchEvent({
                type: "update-section-badge",
                sectionId: sectionId,
                hostHash: session.hostHash,
            });
            for (var _i = 0, _a = this.onWatchedTasksHistorySetHandlers; _i < _a.length; _i++) {
                var handler = _a[_i];
                handler(session.hostHash, sectionId, taskId, this.watchedTasksHistory[session.hostHash][sectionId][taskId]);
            }
        }
    };
    TasksPlugin.prototype.readWatchedTasksHistory = function (session, sectionId) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var localSession = _this.app.sessionManager.getLocalSession();
            var proms = [
                session.hostHash == localSession.hostHash ? _this.settingsStorage.getArray(sectionId) : pmc_mail_1.Q([]),
                _this.settingsStorage.getArray(session.hostHash + "-" + sectionId),
            ];
            return pmc_mail_1.Q.all(proms);
        })
            .then(function (_a) {
            var backCompatHistory = _a[0], newHistory = _a[1];
            var historyByTaskId = {};
            for (var _i = 0, _b = [backCompatHistory, newHistory]; _i < _b.length; _i++) {
                var _arr = _b[_i];
                var arr = _arr;
                for (var _c = 0, arr_1 = arr; _c < arr_1.length; _c++) {
                    var it = arr_1[_c];
                    if (!(it.id in historyByTaskId) || it.lastWatched > historyByTaskId[it.id].lastWatched) {
                        historyByTaskId[it.id] = it;
                    }
                }
            }
            var history = [];
            for (var tId in historyByTaskId) {
                history.push(historyByTaskId[tId]);
            }
            if (!_this.watchedTasksHistory[session.hostHash]) {
                _this.watchedTasksHistory[session.hostHash] = {};
            }
            _this.watchedTasksHistory[session.hostHash][sectionId] = {};
            history.forEach(function (x) { return _this.watchedTasksHistory[session.hostHash][sectionId][x.id] = x; });
            for (var _d = 0, _e = _this.onWatchedTasksHistoryRebuildHandlers; _d < _e.length; _d++) {
                var handler = _e[_d];
                handler(session.hostHash, sectionId);
            }
            return;
        });
    };
    TasksPlugin.prototype.writeWatchedTasksHistory = function (session, sectionId, task) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.settingsStorage.setValue(session.hostHash + "-" + sectionId, [task]);
        })
            .then(function () {
            if (session.sessionType == "local") {
                return _this.settingsStorage.setValue(sectionId, [task]);
            }
        });
    };
    TasksPlugin.prototype.refreshWatched = function () {
        if (this.preventRefreshWatched) {
            return;
        }
        var unreadCount = 0;
        for (var _i = 0, _a = this.getReadySessions(); _i < _a.length; _i++) {
            var session = _a[_i];
            var muted = this.getMutedInfoSingleSession(session);
            for (var tId in this.tasks[session.hostHash]) {
                var t = this.tasks[session.hostHash][tId];
                var section = session.sectionManager.getSection(t.getProjectId());
                if (!section) {
                    continue;
                }
                var isDisabled = section && !section.isKvdbModuleEnabled();
                if ((!muted[t.getProjectId()]) && !isDisabled && this.wasTaskUnread(session, t, t.getProjectId())) {
                    unreadCount++;
                }
                else if ((!muted[t.getProjectId()]) && !section && this.wasTaskUnread(session, t, t.getProjectId())) {
                    unreadCount++;
                }
            }
        }
        this.setUnreadTasksCount(unreadCount);
    };
    TasksPlugin.prototype.wasTaskUnread = function (session, t, sectionId) {
        return t.wasUnread(sectionId, this.watchedTasksHistory[session.hostHash], this.getMyId(session));
    };
    TasksPlugin.prototype.isUnread = function (session, taskId) {
        var task = this.tasks[session.hostHash][taskId];
        return task && this.wasTaskUnread(session, task, task.getProjectId());
    };
    TasksPlugin.prototype.toggleRead = function (session, taskId) {
        var task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return;
        }
        if (this.isUnread(session, taskId)) {
            this.markTaskAsWatched(session, task.getId(), task.getProjectId());
        }
        else {
            this.markTaskAsNotWatched(session, task.getId(), task.getProjectId());
        }
    };
    TasksPlugin.prototype.getUnread = function (session, assignedToMe, createdByMe, skipMuted, trashed) {
        if (assignedToMe === void 0) { assignedToMe = false; }
        if (createdByMe === void 0) { createdByMe = false; }
        if (skipMuted === void 0) { skipMuted = false; }
        if (trashed === void 0) { trashed = false; }
        var unread = 0;
        var muted = this.getMutedInfoSingleSession(session);
        for (var pId in this.projects[session.hostHash]) {
            if (skipMuted && muted[pId]) {
                continue;
            }
            unread += this.getUnreadForSection(session, pId, assignedToMe, createdByMe, trashed);
        }
        return unread;
    };
    TasksPlugin.prototype.getUnreadForSection = function (session, sectionId, assignedToMe, createdByMe, trashed) {
        if (assignedToMe === void 0) { assignedToMe = false; }
        if (createdByMe === void 0) { createdByMe = false; }
        if (trashed === void 0) { trashed = false; }
        var unread = 0;
        for (var tId in this.tasks[session.hostHash]) {
            var t = this.tasks[session.hostHash][tId];
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
    };
    TasksPlugin.prototype.getUnreadForConv2Section = function (session, sectionId, skipMuted) {
        if (skipMuted === void 0) { skipMuted = false; }
        var unread = 0;
        var users = this.getConv2Users(session, sectionId, true);
        var muted = this.getMutedInfo(session);
        for (var tId in this.tasks[session.hostHash]) {
            var t = this.tasks[session.hostHash][tId];
            if (!t || !this.isAssignedToUsers(t, users) || t.getIsTrashed()) {
                continue;
            }
            if ((!skipMuted || !muted[session.hostHash][t.getProjectId()]) && this.wasTaskUnread(session, t, t.getProjectId())) {
                unread++;
            }
        }
        return unread;
    };
    TasksPlugin.prototype.getMutedInfo = function (session) {
        var info = {};
        for (var hostHash in this.app.sessionManager.sessions) {
            info[hostHash] = {};
        }
        if (this.tasksSectionsCollectionNoPrivate && session.hostHash in this.tasksSectionsCollectionNoPrivate) {
            for (var _i = 0, _a = this.tasksSectionsCollectionNoPrivate[session.hostHash].list; _i < _a.length; _i++) {
                var section = _a[_i];
                info[session.hostHash][section.getId()] = section.userSettings.mutedModules.tasks;
            }
        }
        return info;
    };
    TasksPlugin.prototype.getMutedInfoSingleSession = function (session) {
        var muted = this.getMutedInfo(session);
        if (session.hostHash in muted) {
            return muted[session.hostHash];
        }
        return {};
    };
    TasksPlugin.prototype.isMuted = function (session, id) {
        var section = this.tasksSectionsCollectionNoPrivate[session.hostHash].find(function (x) { return x.getId() == id; });
        if (section && section.userSettings.mutedModules.tasks) {
            return true;
        }
        return false;
    };
    TasksPlugin.prototype.isAssignedToUsers = function (task, users) {
        var arr = task.getAssignedTo();
        for (var _i = 0, users_1 = users; _i < users_1.length; _i++) {
            var u = users_1[_i];
            if (arr.indexOf(u) < 0) {
                return false;
            }
        }
        return true;
    };
    TasksPlugin.prototype.markAllAsRead = function (session, projectId) {
        if (projectId === void 0) { projectId = Types_1.CustomTasksElements.ALL_TASKS_ID; }
        var isConv2 = this.isConv2Project(projectId);
        var allProjects = projectId == Types_1.CustomTasksElements.ALL_TASKS_ID || projectId == Types_1.CustomTasksElements.TRASH_ID || projectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || projectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || isConv2 || projectId == Types_1.CustomTasksElements.ALL_TASKS_INC_TRASHED_ID;
        var tasksAssignedToMe = projectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
        var tasksCreatedByMe = projectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID;
        var isTrashed = projectId == Types_1.CustomTasksElements.TRASH_ID;
        var users = isConv2 ? this.getConv2Users(session, projectId, true) : [];
        var skipTrashedCheck = projectId == Types_1.CustomTasksElements.ALL_TASKS_INC_TRASHED_ID;
        var ids = [];
        for (var tId in this.tasks[session.hostHash]) {
            var t = this.tasks[session.hostHash][tId];
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
    };
    TasksPlugin.prototype.onWatchedTasksHistoryRebuild = function (handler) {
        this.onWatchedTasksHistoryRebuildHandlers.push(handler);
    };
    TasksPlugin.prototype.onWatchedTasksHistorySet = function (handler) {
        this.onWatchedTasksHistorySetHandlers.push(handler);
    };
    TasksPlugin.prototype.offWatchedTasksHistoryRebuild = function (handler) {
        var idx = this.onWatchedTasksHistoryRebuildHandlers.indexOf(handler);
        if (idx >= 0) {
            this.onWatchedTasksHistoryRebuildHandlers.splice(idx, 1);
        }
    };
    TasksPlugin.prototype.offWatchedTasksHistorySet = function (handler) {
        var idx = this.onWatchedTasksHistorySetHandlers.indexOf(handler);
        if (idx >= 0) {
            this.onWatchedTasksHistorySetHandlers.splice(idx, 1);
        }
    };
    TasksPlugin.prototype.openEditTaskWindow = function (session, taskId, editMode, scrollToComments) {
        var _this = this;
        if (editMode === void 0) { editMode = false; }
        if (scrollToComments === void 0) { scrollToComments = false; }
        if (!this.bringWindowToFront(TaskWindowController_1.TaskWindowController.getWindowId(session, taskId))) {
            this.app.ioc.create(TaskWindowController_1.TaskWindowController, [this.app, session, taskId, editMode, null, [], [], [], scrollToComments]).then(function (win) {
                _this.app.openChildWindow(win);
            });
        }
    };
    TasksPlugin.prototype.openNewTaskWindow = function (session, section, attachments, handle, dateTime, assignTo, wholeDay) {
        var _this = this;
        if (attachments === void 0) { attachments = []; }
        if (handle === void 0) { handle = null; }
        if (dateTime === void 0) { dateTime = null; }
        if (assignTo === void 0) { assignTo = []; }
        var project = section != null && section != false ? this.projects[session.hostHash][section.getId()] : null;
        if (project == null && section !== false) {
            var privateSection = session.sectionManager.getMyPrivateSection();
            if (privateSection) {
                project = this.projects[session.hostHash][privateSection.getId()];
                project.setName(this.app.localeService.i18n("plugin.tasks.privateTasks"));
            }
        }
        var def = pmc_mail_1.Q.defer();
        if (!this.bringWindowToFront(TaskWindowController_1.TaskWindowController.getWindowId(session, null))) {
            this.app.ioc.create(TaskWindowController_1.TaskWindowController, [this.app, session, null, true, project, ["__orphans__"], attachments, assignTo, false, true, dateTime, wholeDay]).then(function (win) {
                win.setHandle(handle);
                _this.app.openChildWindow(win);
                win.onTaskCreated(function (taskId) {
                    def.resolve(taskId);
                });
                win.onCancelled(function () {
                    def.reject();
                });
            });
        }
        else {
            var wnd = this.openedWindows[TaskWindowController_1.TaskWindowController.getWindowId(session, null)];
            if (wnd instanceof TaskWindowController_1.TaskWindowController) {
                wnd.ensureHasDateTime(dateTime);
                wnd.onTaskCreated(function (taskId) {
                    def.resolve(taskId);
                });
                wnd.onCancelled(function () {
                    def.reject();
                });
            }
        }
        return def.promise;
    };
    TasksPlugin.prototype.attachToTask = function (session, taskId, file, handle) {
        var _this = this;
        var task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return;
        }
        var did = file.handle.descriptor.ref.did;
        for (var _i = 0, _a = task.getAttachments(); _i < _a.length; _i++) {
            var attStr = _a[_i];
            var att = JSON.parse(attStr);
            if (att.did == did) {
                return;
            }
        }
        if (file && file.section && file.section.getId() != task.getProjectId()) {
            return this.uploadAsAttachment(session, file, taskId);
        }
        var now = new Date().getTime();
        var newAtt = AttachmentsManager_1.AttachmentsManager.createAttachmentInfoStringFromOpenableSectionFile(file);
        task.addAttachment(newAtt);
        task.setModifiedBy(this.getMyId(session));
        task.setModifiedDateTime(now);
        task.addHistory({
            when: now,
            who: this.getMyId(session),
            what: "added",
            arg: "attachment",
            newVal: newAtt,
        });
        return this.sendTaskMessage(session, task, "modify-task")
            .then(function (dt) {
            if (dt) {
                task.updateModifiedServerDateTime(dt);
            }
            return _this.saveTask(session, task);
        })
            .then(function () {
            return _this.addMetaBindedTaskId(file.fileSystem, file.path, taskId, handle);
        })
            .then(function () {
            _this.triggerFileAttached(session, file.handle.ref.did, taskId);
        });
    };
    TasksPlugin.prototype.uploadAsAttachment = function (session, file, taskId) {
        var _this = this;
        var task = this.tasks[session.hostHash][taskId];
        if (!task) {
            return pmc_mail_1.Q();
        }
        var section = session.sectionManager.getSection(task.getProjectId());
        if (!section) {
            return pmc_mail_1.Q();
        }
        return pmc_mail_1.Q().then(function () {
            return file.getContent();
        })
            .then(function (cnt) {
            return section.uploadFile({
                data: cnt,
                path: "/",
            });
        })
            .then(function (result) {
            if (result && result.openableElement) {
                _this.attachToTask(session, taskId, result.openableElement, null);
            }
        });
    };
    TasksPlugin.prototype.updateMeta = function (fileSystem, path, handle, func) {
        if (handle && handle.canWrite) {
            return handle.updateMeta({
                metaUpdater: func,
            }).thenResolve(null);
        }
        else {
            return fileSystem.updateMeta(path, func).thenResolve(null);
        }
    };
    TasksPlugin.prototype.addMetaBindedTaskId = function (fileSystem, path, taskId, handle) {
        var _this = this;
        return this.updateMeta(fileSystem, path, handle, function (meta) { return _this._metaUpdaterAdder(meta, taskId); });
    };
    TasksPlugin.prototype.removeMetaBindedTaskId = function (fileSystem, path, taskId, handle) {
        var _this = this;
        return this.updateMeta(fileSystem, path, handle, function (meta) { return _this._metaUpdaterRemover(meta, taskId); });
    };
    TasksPlugin.prototype.addMetaBindedTaskIdOSF = function (file, taskId, handle) {
        return this.addMetaBindedTaskId(file.fileSystem, file.path, taskId, handle);
    };
    TasksPlugin.prototype.removeMetaBindedTaskIdOSF = function (file, taskId, handle) {
        return this.removeMetaBindedTaskId(file.fileSystem, file.path, taskId, handle);
    };
    TasksPlugin.prototype._metaUpdaterAdder = function (meta, taskId) {
        var bindedData = JSON.parse(this.convertBindedTaskId(meta.bindedElementId));
        taskId = taskId.toString();
        bindedData.taskIds = bindedData.taskIds.filter(function (x) { return !!x; }).map(function (x) { return x.toString(); });
        if (bindedData.taskIds.indexOf(taskId) < 0) {
            bindedData.taskIds.push(taskId);
        }
        meta.bindedElementId = JSON.stringify(bindedData);
    };
    TasksPlugin.prototype._metaUpdaterRemover = function (meta, taskId) {
        var bindedData = JSON.parse(this.convertBindedTaskId(meta.bindedElementId));
        taskId = taskId.toString();
        bindedData.taskIds = bindedData.taskIds.filter(function (x) { return !!x; }).map(function (x) { return x.toString(); });
        var idx = bindedData.taskIds.indexOf(taskId);
        if (idx >= 0) {
            bindedData.taskIds.splice(idx, 1);
        }
        meta.bindedElementId = JSON.stringify(bindedData);
    };
    TasksPlugin.prototype.removeTaskFromTaskGroup = function (session, task, taskGroupId, tasksToSave, taskGroupsToSave, projectsToSave) {
        if (tasksToSave === void 0) { tasksToSave = null; }
        if (taskGroupsToSave === void 0) { taskGroupsToSave = null; }
        if (projectsToSave === void 0) { projectsToSave = null; }
        var taskId = task.getId();
        var projectId = task.getProjectId();
        var orph = taskGroupId == "__orphans__";
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
    };
    TasksPlugin.prototype.addTaskToTaskGroup = function (session, task, taskGroupId, tasksToSave, taskGroupsToSave, projectsToSave) {
        if (tasksToSave === void 0) { tasksToSave = null; }
        if (taskGroupsToSave === void 0) { taskGroupsToSave = null; }
        if (projectsToSave === void 0) { projectsToSave = null; }
        var taskId = task.getId();
        var projectId = task.getProjectId();
        var orph = taskGroupId == "__orphans__";
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
    };
    TasksPlugin.prototype.moveTasks = function (session, fullTaskIdsRaw, dstTaskGroupIdsRaw, rmFromAllCurrent, onGotCountsToUpdate) {
        var _this = this;
        if (rmFromAllCurrent === void 0) { rmFromAllCurrent = false; }
        if (onGotCountsToUpdate === void 0) { onGotCountsToUpdate = null; }
        var fullTaskIds = this.parseFullTaskIds(fullTaskIdsRaw);
        var dstTaskGroupIds = dstTaskGroupIdsRaw && dstTaskGroupIdsRaw.length > 0 ? dstTaskGroupIdsRaw : ["__orphans__"];
        dstTaskGroupIds = dstTaskGroupIds.map(function (x) { return x ? x : "__orphans__"; });
        var orphanizedBlackList = [];
        var tasksToSave = [];
        var taskGroupsToSave = [];
        var projectsToSave = [];
        var now = new Date().getTime();
        var myId = this.getMyId(session);
        var toOrphans = dstTaskGroupIds.indexOf("__orphans__") >= 0;
        var prom = pmc_mail_1.Q();
        var _loop_8 = function (srcTaskGroupId, taskId) {
            if (!(taskId in this_4.tasks[session.hostHash]) || orphanizedBlackList.indexOf(taskId) >= 0) {
                return "continue";
            }
            if (toOrphans) {
                orphanizedBlackList.push(taskId);
            }
            var task = this_4.tasks[session.hostHash][taskId];
            var task_tgIds = this_4.sanitizeTaskGroupIds(task.getTaskGroupIds());
            var modified = false;
            if (toOrphans) {
                for (var _i = 0, task_tgIds_1 = task_tgIds; _i < task_tgIds_1.length; _i++) {
                    var tgId = task_tgIds_1[_i];
                    if (tgId != "__orphans__") {
                        this_4.removeTaskFromTaskGroup(session, task, tgId, tasksToSave, taskGroupsToSave, projectsToSave);
                    }
                }
            }
            if (dstTaskGroupIds.indexOf(srcTaskGroupId) < 0) {
                this_4.removeTaskFromTaskGroup(session, task, srcTaskGroupId, tasksToSave, taskGroupsToSave, projectsToSave);
                modified = true;
            }
            if (rmFromAllCurrent) {
                for (var _a = 0, _b = task.getTaskGroupIds(); _a < _b.length; _a++) {
                    var tgId = _b[_a];
                    if (dstTaskGroupIds.indexOf(tgId) < 0) {
                        this_4.removeTaskFromTaskGroup(session, task, tgId, tasksToSave, taskGroupsToSave, projectsToSave);
                        modified = true;
                    }
                }
            }
            for (var _c = 0, dstTaskGroupIds_1 = dstTaskGroupIds; _c < dstTaskGroupIds_1.length; _c++) {
                var dstTaskGroupId = dstTaskGroupIds_1[_c];
                var alreadyInDst = task_tgIds.indexOf(dstTaskGroupId) >= 0;
                if (!alreadyInDst) {
                    this_4.addTaskToTaskGroup(session, task, dstTaskGroupId, tasksToSave, taskGroupsToSave, projectsToSave);
                    modified = true;
                }
            }
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
                prom = prom.then(function () {
                    return _this.sendTaskMessage(session, task, "modify-task")
                        .then(function (dt) {
                        if (dt) {
                            task.updateModifiedServerDateTime(dt);
                        }
                    });
                });
            }
        };
        var this_4 = this;
        for (var _i = 0, fullTaskIds_1 = fullTaskIds; _i < fullTaskIds_1.length; _i++) {
            var _a = fullTaskIds_1[_i], srcTaskGroupId = _a[0], taskId = _a[1];
            _loop_8(srcTaskGroupId, taskId);
        }
        if (onGotCountsToUpdate) {
            onGotCountsToUpdate(tasksToSave.length, taskGroupsToSave.length, projectsToSave.length);
        }
        return prom.then(function () {
            return _this.saveModified(session, tasksToSave, taskGroupsToSave, projectsToSave);
        });
    };
    TasksPlugin.prototype.duplicateTasks = function (session, fullTaskIdsRaw, dstTaskGroupIdRaw) {
        var _this = this;
        var fullTaskIds = this.parseFullTaskIds(fullTaskIdsRaw);
        var dstTaskGroupId = dstTaskGroupIdRaw ? dstTaskGroupIdRaw : "__orphans__";
        var tasksToSave = [];
        var taskGroupsToSave = [];
        var projectsToSave = [];
        var now = new Date().getTime();
        var myId = this.getMyId(session);
        var prom = pmc_mail_1.Q();
        var _loop_9 = function (taskId) {
            if (!(taskId in this_5.tasks[session.hostHash])) {
                return "continue";
            }
            var task = this_5.tasks[session.hostHash][taskId];
            var task2 = new Task_1.Task(JSON.parse(JSON.stringify(task)));
            DataMigration_1.DataMigration.setVersion(task2);
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
            prom = prom.then(function () { return _this.nextTaskId(session).then(function (id) {
                task2.setId(id);
                _this.addTaskToTaskGroup(session, task2, dstTaskGroupId, tasksToSave, taskGroupsToSave, projectsToSave);
                return _this.addTask(session, task2);
            }); });
        };
        var this_5 = this;
        for (var _i = 0, fullTaskIds_2 = fullTaskIds; _i < fullTaskIds_2.length; _i++) {
            var _a = fullTaskIds_2[_i], taskId = _a[1];
            _loop_9(taskId);
        }
        return prom.then(function () {
            _this.saveModified(session, tasksToSave, taskGroupsToSave, projectsToSave);
        });
    };
    TasksPlugin.prototype.projectsMatch = function (session, fullTaskIdsRaw, taskGroupId, altProjectId) {
        var fullTaskIds = this.parseFullTaskIds(fullTaskIdsRaw);
        var pId = altProjectId;
        if (taskGroupId && taskGroupId != "__orphans__" && taskGroupId != "null") {
            if (!(taskGroupId in this.taskGroups[session.hostHash])) {
                return false;
            }
            pId = this.taskGroups[session.hostHash][taskGroupId].getProjectId();
        }
        for (var _i = 0, fullTaskIds_3 = fullTaskIds; _i < fullTaskIds_3.length; _i++) {
            var _a = fullTaskIds_3[_i], tId = _a[1];
            if (!(tId in this.tasks[session.hostHash]) || this.tasks[session.hostHash][tId].getProjectId() != pId) {
                return false;
            }
        }
        return true;
    };
    TasksPlugin.prototype.askDeleteTasks = function (session, fullTaskIdsRaw, moveToTrash, confirmExFunc) {
        var _this = this;
        var unknownSelection = fullTaskIdsRaw.length == 1 && (fullTaskIdsRaw[0].indexOf("/") < 0);
        var fullTaskIds = unknownSelection ? [[null, fullTaskIdsRaw[0]]] : this.parseFullTaskIds(fullTaskIdsRaw);
        if (fullTaskIdsRaw.length >= 1 && fullTaskIdsRaw[0].substr(0, 21) == "__recently_modified__") {
            unknownSelection = true;
        }
        var def = pmc_mail_1.Q.defer();
        var op = moveToTrash ? "moveToTrash" : "delete";
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
        }).then(function (result) {
            if (result.result != "yes") {
                def.resolve({ deleted: false, fullDelete: false });
                return;
            }
            var delAll = true;
            var nDel = 0;
            var data = {};
            if (delAll) {
                for (var _i = 0, fullTaskIds_4 = fullTaskIds; _i < fullTaskIds_4.length; _i++) {
                    var _a = fullTaskIds_4[_i], tId = _a[1];
                    if (!(tId in data) && tId in _this.tasks[session.hostHash]) {
                        data[tId] = _this.tasks[session.hostHash][tId].getTaskGroupIds(true);
                        nDel++;
                    }
                }
            }
            else {
                for (var _b = 0, fullTaskIds_5 = fullTaskIds; _b < fullTaskIds_5.length; _b++) {
                    var _c = fullTaskIds_5[_b], tgId = _c[0], tId = _c[1];
                    if (tId in _this.tasks[session.hostHash]) {
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
            if (moveToTrash) {
                var dataArr = [];
                for (var tId in data) {
                    dataArr.push(tId);
                }
                _this.moveToTrash(session, dataArr);
            }
            else {
                _this.deleteTasks(session, data);
            }
            def.resolve({ deleted: true, fullDelete: delAll });
        });
        return def.promise;
    };
    TasksPlugin.prototype.sanitizeTaskGroupIds = function (ids) {
        var res = [];
        var inOrphans = (ids.filter(function (id) { return (id == "" || id == null || id == undefined || id == "__orphans__"); }).length > 0);
        for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
            var id = ids_1[_i];
            if (inOrphans && id && id != "__orphans__") {
            }
            res.push(id ? id : "__orphans__");
        }
        return res;
    };
    TasksPlugin.prototype.saveModified = function (session, tasks, taskGroups, projects) {
        var _this = this;
        var prom = pmc_mail_1.Q();
        var _loop_10 = function (id) {
            var f = function () { return _this.saveProject(session, _this.projects[session.hostHash][id]); };
            prom = prom.then(f);
        };
        for (var _i = 0, projects_1 = projects; _i < projects_1.length; _i++) {
            var id = projects_1[_i];
            _loop_10(id);
        }
        var _loop_11 = function (id) {
            var f = function () { return _this.saveTaskGroup(session, _this.taskGroups[session.hostHash][id]); };
            prom = prom.then(f);
        };
        for (var _a = 0, taskGroups_1 = taskGroups; _a < taskGroups_1.length; _a++) {
            var id = taskGroups_1[_a];
            _loop_11(id);
        }
        var _loop_12 = function (id) {
            var f = function () { return _this.saveTask(session, _this.tasks[session.hostHash][id]); };
            prom = prom.then(f);
        };
        for (var _b = 0, tasks_2 = tasks; _b < tasks_2.length; _b++) {
            var id = tasks_2[_b];
            _loop_12(id);
        }
        return prom;
    };
    TasksPlugin.prototype.changeTaskGroupPinned = function (session, projectId, taskGroupId, pinned) {
        var proj = this.projects[session.hostHash][projectId];
        if (!proj) {
            return;
        }
        if (pinned) {
            proj.addPinnedTaskGroupId(taskGroupId, true);
        }
        else {
            proj.removePinnedTaskGroupId(taskGroupId);
        }
        this.app.dispatchEvent({
            type: "update-pinned-taskgroups",
            sectionId: projectId,
            listId: taskGroupId,
            pinned: pinned,
            hostHash: session.hostHash,
        });
        this.saveProject(session, proj);
    };
    TasksPlugin.prototype.changeTaskPinned = function (session, taskId, taskGroupId, pinned) {
        var t = this.tasks[session.hostHash][taskId];
        if (!t) {
            return pmc_mail_1.Q();
        }
        if (pinned) {
            t.addPinnedInTaskGroupId(taskGroupId, true);
        }
        else {
            t.removePinnedInTaskGroupId(taskGroupId);
        }
        return this.saveTask(session, t);
    };
    TasksPlugin.prototype.parseFullTaskIds = function (fullTaskIds) {
        var ret = [];
        for (var _i = 0, fullTaskIds_6 = fullTaskIds; _i < fullTaskIds_6.length; _i++) {
            var fullTaskId = fullTaskIds_6[_i];
            var _a = fullTaskId.split("/"), srcTaskGroupId = _a[0], taskId = _a[1];
            ret.push([srcTaskGroupId, taskId ? taskId : "__orphans__"]);
        }
        return ret;
    };
    TasksPlugin.prototype.setupSearch = function () {
        var _this = this;
        this.searchCounts = this._makeZeroSearchCountsObject();
        this.tasksFilterUpdater = new TaskGroupsPanelController_1.TasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = function () {
            _this.updateSearchFilter(_this.tasksFilterUpdater.filter);
        };
        this.app.searchModel.changeEvent.add(this.onFilterTasks.bind(this), "multi");
    };
    TasksPlugin.prototype.onFilterTasks = function () {
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    TasksPlugin.prototype.updateSearchFilter = function (data) {
        var searchStr = data.visible ? data.value : "";
        this.updateSearch(searchStr);
    };
    TasksPlugin.prototype.updateSearch = function (searchStr) {
        var sessions = this.getReadySessions();
        this.searchStr = searchStr;
        var newSearchCounts = this._makeZeroSearchCountsObject();
        if (searchStr != "") {
            var usersCache = {};
            for (var _i = 0, sessions_1 = sessions; _i < sessions_1.length; _i++) {
                var session = sessions_1[_i];
                usersCache[session.hostHash] = {};
                for (var _a = 0, _b = session.conv2Service.collection.list; _a < _b.length; _a++) {
                    var c2s = _b[_a];
                    usersCache[session.hostHash][c2s.id] = this.getConv2Users(session, c2s, true);
                }
            }
            for (var _c = 0, sessions_2 = sessions; _c < sessions_2.length; _c++) {
                var session = sessions_2[_c];
                if (!(this.tasks[session.hostHash])) {
                    continue;
                }
                for (var taskId in this.tasks[session.hostHash]) {
                    var task = this.tasks[session.hostHash][taskId];
                    if (task.getProjectId() in newSearchCounts[session.hostHash]) {
                        var matches = this.tasks[session.hostHash][taskId].matchesSearchString(searchStr);
                        if (matches) {
                            newSearchCounts[session.hostHash][task.getProjectId()]++;
                            if (task.getIsTrashed()) {
                                newSearchCounts[session.hostHash][Types_1.CustomTasksElements.TRASH_ID]++;
                            }
                            else {
                                newSearchCounts[session.hostHash][Types_1.CustomTasksElements.ALL_TASKS_ID]++;
                            }
                            if (task.isAssignedTo(this.getMyId(session))) {
                                newSearchCounts[session.hostHash][Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID]++;
                            }
                            if (task.getCreatedBy() == this.getMyId(session)) {
                                newSearchCounts[session.hostHash][Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID]++;
                            }
                            for (var _d = 0, _e = session.conv2Service.collection.list; _d < _e.length; _d++) {
                                var c2s = _e[_d];
                                if (this.isAssignedToUsers(task, usersCache[session.hostHash][c2s.id])) {
                                    newSearchCounts[session.hostHash][c2s.id]++;
                                }
                            }
                        }
                    }
                }
            }
        }
        var searchTotalCount = 0;
        for (var hostHash in newSearchCounts) {
            for (var id in newSearchCounts[hostHash]) {
                searchTotalCount += newSearchCounts[hostHash][id];
            }
        }
        this.searchTotalCount = searchTotalCount;
        if (!this.searchCounts) {
            this.searchCounts = this._makeZeroSearchCountsObject();
        }
        this.searchCountsModified = {};
        for (var hostHash in newSearchCounts) {
            for (var k in newSearchCounts[hostHash]) {
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
        this.app.dispatchEvent({
            type: "tasks-search-update",
            searchString: searchStr,
            searchTotalCount: this.searchTotalCount,
        });
    };
    TasksPlugin.prototype.getSearchCount = function (session, x) {
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
    };
    TasksPlugin.prototype.getTaskTooltipContent = function (session, taskIdsStr) {
        var _this = this;
        taskIdsStr += "";
        var taskIds = taskIdsStr.split(",");
        var data = [];
        var tasks = [];
        for (var _i = 0, taskIds_4 = taskIds; _i < taskIds_4.length; _i++) {
            var taskId = taskIds_4[_i];
            var task = this.tasks[session.hostHash][taskId];
            if (task && this.projects[session.hostHash][task.getProjectId()]) {
                tasks.push(task);
            }
        }
        tasks.sort(function (a, b) { return b.getModifiedDateTime() - a.getModifiedDateTime(); });
        var _loop_13 = function (task) {
            var proj = this_6.projects[session.hostHash][task.getProjectId()];
            var pinnedTGs = proj.getPinnedTaskGroupIds();
            var section = session.sectionManager.getSection(proj.getId());
            var fileNamesByDid = null;
            if (section && section.getFileModule() && section.getFileModule().fileTree) {
                var fileTree = section.getFileModule().fileTree;
                fileNamesByDid = {};
                fileTree.collection.list.forEach(function (x) { return fileNamesByDid[x.ref.did] = x.name; });
            }
            data.push({
                myHashmail: this_6.getMyId(session),
                id: task.getId(),
                description: task.getDescription(),
                labelClass: task.getLabelClass(),
                statusStr: Task_1.Task.getStatusText(task.getStatus()),
                projectId: proj.getId(),
                projectPublic: section ? section.getScope() == "public" : true,
                projectName: this_6.getPrivateSectionId() == proj.getId() ? this_6.app.localeService.i18n("plugin.tasks.privateTasks") : proj.getName(),
                projectIsPrivateSection: this_6.getPrivateSectionId() == proj.getId(),
                taskGroups: task.getTaskGroupIds().map(function (tgId) {
                    var tg = _this.taskGroups[session.hostHash][tgId];
                    if (!tg) {
                        return null;
                    }
                    return {
                        id: tgId,
                        name: tg.getName(),
                        pinned: pinnedTGs.indexOf(tgId) >= 0,
                        icon: tg.getIcon(),
                    };
                }).filter(function (x) { return x != null; }),
                assignedTo: task.getAssignedTo().map(function (personId) {
                    return _this.getPerson(session, personId);
                }).filter(function (x) { return x != null; }),
                attachments: task.getAttachments().map(function (x) { return JSON.parse(x); }).filter(function (x) { return x != null; }).map(function (x) { return fileNamesByDid && x.did in fileNamesByDid ? fileNamesByDid[x.did] : x.name; }),
                startTimestamp: task.getStartTimestamp(),
                endTimestamp: task.getEndTimestamp(),
                wholeDays: task.getWholeDays(),
            });
        };
        var this_6 = this;
        for (var _a = 0, tasks_3 = tasks; _a < tasks_3.length; _a++) {
            var task = tasks_3[_a];
            _loop_13(task);
        }
        return JSON.stringify(data);
    };
    TasksPlugin.prototype._makeZeroSearchCountsObject = function () {
        var searchCounts = {};
        for (var hostHash in this.projects) {
            for (var pId in this.projects[hostHash]) {
                if (!searchCounts[hostHash]) {
                    searchCounts[hostHash] = {};
                }
                searchCounts[hostHash][pId] = 0;
            }
            var session = this.app.sessionManager.getSessionByHostHash(hostHash);
            for (var _i = 0, _a = session.conv2Service.collection.list; _i < _a.length; _i++) {
                var c2s = _a[_i];
                if (!searchCounts[hostHash]) {
                    searchCounts[hostHash] = {};
                }
                searchCounts[hostHash][c2s.id] = 0;
            }
        }
        for (var hostHash in this.app.sessionManager.sessions) {
            if (!(hostHash in searchCounts)) {
                searchCounts[hostHash] = {};
            }
        }
        var localHostHash = this.app.sessionManager.getLocalSession().hostHash;
        if (!searchCounts[localHostHash]) {
            searchCounts[localHostHash] = {};
        }
        searchCounts[localHostHash][Types_1.CustomTasksElements.ALL_TASKS_ID] = 0;
        searchCounts[localHostHash][Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID] = 0;
        searchCounts[localHostHash][Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID] = 0;
        searchCounts[localHostHash][Types_1.CustomTasksElements.TRASH_ID] = 0;
        return searchCounts;
    };
    TasksPlugin.prototype.isConv2Project = function (sectionId) {
        return sectionId && sectionId.substr(0, 3) == "c2:";
    };
    TasksPlugin.prototype.getConv2Section = function (session, id) {
        return session.conv2Service.collection.find(function (c2s) { return c2s.id == id; });
    };
    TasksPlugin.prototype.getConv2Users = function (session, x, excludeMe) {
        if (excludeMe === void 0) { excludeMe = false; }
        var c2s = (x instanceof Mail.mail.section.Conv2Section) ? x : this.getConv2Section(session, x);
        if (!c2s) {
            return [];
        }
        var hashmail = session.userData.identity.hashmail;
        var hash = hashmail.substr(hashmail.indexOf("#"));
        var users = c2s.users.map(function (u) { return u + hash; });
        if (excludeMe) {
            var myId_1 = this.getMyId(session);
            users = users.filter(function (id) { return id != myId_1; });
        }
        return users;
    };
    TasksPlugin.prototype.getConv2SectionName = function (session, x) {
        return this.getConv2Users(session, x, true).join(", ");
    };
    TasksPlugin.prototype.findCommonProject = function (session, c) {
        var pubProjId = null;
        var privProjIds = [];
        var conv2Users = c.users;
        for (var pId in this.projects[session.hostHash]) {
            if (pId.substr(0, 8) == "private:") {
                continue;
            }
            var p = this.projects[session.hostHash][pId];
            if (p) {
                var section = session.sectionManager.getSection(pId);
                if (section) {
                    if (section.getScope() == "public") {
                        pubProjId = pubProjId ? pubProjId : pId;
                    }
                    else {
                        var users = section.sectionData.group.users;
                        var common = true;
                        for (var _i = 0, conv2Users_1 = conv2Users; _i < conv2Users_1.length; _i++) {
                            var user = conv2Users_1[_i];
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
    };
    TasksPlugin.prototype.getTaskPriorities = function () {
        return this._getProjOptsStripped(this.taskPriorities);
    };
    TasksPlugin.prototype.getTaskStatuses = function () {
        return Task_1.Task.getStatuses();
    };
    TasksPlugin.getTaskStatuses = function () {
        return Task_1.Task.getStatuses();
    };
    TasksPlugin.prototype.getTaskTypes = function () {
        return this._getProjOptsStripped(this.taskTypes);
    };
    TasksPlugin.prototype._getProjOptsStripped = function (arr) {
        var arr2 = [];
        for (var _i = 0, arr_2 = arr; _i < arr_2.length; _i++) {
            var s = arr_2[_i];
            arr2.push(s.length > 2 && s[0] == "[" && s[s.length - 1] == "]" ? s.substr(1, s.length - 2) : s);
        }
        return arr2;
    };
    TasksPlugin.prototype.bringWindowToFront = function (id) {
        var win = this.openedWindows[id];
        if (!win) {
            return false;
        }
        if (win.nwin.isMinimized()) {
            win.nwin.minimizeToggle();
        }
        win.nwin.focus();
        return true;
    };
    TasksPlugin.prototype.registerWindow = function (id, window) {
        this.openedWindows[id] = window;
    };
    TasksPlugin.prototype.unregisterWindow = function (id) {
        delete this.openedWindows[id];
    };
    TasksPlugin.prototype.detachTaskGroup = function (session, tgId) {
        var _this = this;
        var tgsToSave = [];
        var tsToSave = [];
        var addToSave = function (it, arr) {
            if (arr.indexOf(it) < 0) {
                arr.push(it);
            }
        };
        var tg = this.taskGroups[session.hostHash][tgId];
        var p = tg ? this.projects[session.hostHash][tg.getProjectId()] : null;
        if (p) {
            p.removePinnedTaskGroupId(tgId);
            p.removeTaskGroupsOrder(tgId);
            var arr = p.getTaskGroupsOrder();
            var idx = -1;
            for (var i in arr) {
                var it = this.taskGroups[session.hostHash][arr[i]];
                if (it) {
                    if (it.getDetached()) {
                        idx = parseInt(i);
                        break;
                    }
                }
            }
            arr.splice(idx < 0 ? arr.length : idx, 0, tgId);
        }
        addToSave(tg, tgsToSave);
        if (tg) {
            tg.setDetached(true);
            for (var _i = 0, _a = tg.getTaskIds(); _i < _a.length; _i++) {
                var tId = _a[_i];
                var t = this.tasks[session.hostHash][tId];
                if (t) {
                    for (var _b = 0, _c = t.getTaskGroupIds(); _b < _c.length; _b++) {
                        var tgId2 = _c[_b];
                        if (tgId2 == tgId) {
                            continue;
                        }
                        var tg2 = this.taskGroups[session.hostHash][tgId2];
                        if (tg2) {
                            tg2.removeTaskId(tId);
                            addToSave(tg2, tgsToSave);
                        }
                    }
                    var tgsPrefix = t.getTaskGroupIds(true).filter(function (x) { return x != tgId && _this.taskGroups[session.hostHash][tgId]; }).map(function (x) { return "[" + _this.taskGroups[session.hostHash][x].getName() + "] "; }).join("");
                    t.setPreDetachTaskGroupIds(t.getTaskGroupIds(true));
                    t.setTaskGroupIds([tgId]);
                    t.setDescription(tgsPrefix + t.getDescription());
                    addToSave(t, tsToSave);
                }
            }
        }
        return pmc_mail_1.Q().then(function () {
            if (p) {
                return _this.saveProject(session, p);
            }
            return pmc_mail_1.Q();
        }).then(function () {
            return Mail.Promise.PromiseUtils.oneByOne(tsToSave, function (_idx, t) {
                return _this.saveTask(session, t);
            });
        }).then(function () {
            return Mail.Promise.PromiseUtils.oneByOne(tgsToSave, function (_idx, tg) {
                return _this.saveTaskGroup(session, tg);
            });
        });
    };
    TasksPlugin.prototype.onUserPreferencesChange = function () {
        var session = this.session;
        this.refreshWatched();
        this.app.dispatchEvent({ type: "update-section-badge", sectionId: "conv2", hostHash: session.hostHash });
    };
    TasksPlugin.prototype.getAppVersion = function () {
        return this.app.getVersion().str;
    };
    TasksPlugin.prototype.getPrivateSectionId = function () {
        this.privateSection = this.session.sectionManager.getMyPrivateSection();
        return this.privateSection ? this.privateSection.getId() : null;
    };
    TasksPlugin.prototype.getPrivateSection = function () {
        this.privateSection = this.session.sectionManager.getMyPrivateSection();
        return this.privateSection;
    };
    TasksPlugin.prototype.onPollingResult = function (entries) {
        var _this = this;
        if (entries) {
            entries.forEach(function (entry) {
                _this.notifyUser(entry);
            });
        }
    };
    TasksPlugin.prototype.isPollingItemComingFromMe = function (item) {
        if (item.entry) {
            if (this.app.sessionManager.isSessionExistsByHost(item.entry.host)) {
                var session = this.app.sessionManager.getSession(item.entry.host);
                var message = item.entry.getMessage();
                if (message.sender.pub58 == session.userData.identity.pub58) {
                    return true;
                }
            }
        }
        return false;
    };
    TasksPlugin.prototype.getContextFromSinkId = function (session, sinkId) {
        var section = null;
        session.sectionManager.filteredCollection.list.forEach(function (x) {
            if (sinkId == x.getChatSink().id) {
                section = x;
                return;
            }
        });
        if (section) {
            var sectionId_1 = section.getId();
            var conv2Id_1;
            if (sectionId_1.indexOf("usergroup") >= 0) {
                session.conv2Service.collection.list.forEach(function (x) {
                    if (x.section && x.section.getId() == sectionId_1) {
                        conv2Id_1 = x.id;
                        return;
                    }
                });
                return conv2Id_1;
            }
            return "section:" + sectionId_1;
        }
        return null;
    };
    TasksPlugin.prototype.notifyUser = function (sinkIndexEntry) {
        if (!sinkIndexEntry.entry || !sinkIndexEntry.entry.source) {
            return;
        }
        if (this.isPollingItemComingFromMe(sinkIndexEntry)) {
            return;
        }
        if (!this.app.sessionManager.isSessionExistsByHost(sinkIndexEntry.entry.host)) {
            return;
        }
        var session = this.app.sessionManager.getSession(sinkIndexEntry.entry.host);
        if (!session.loadingPromise.isFulfilled()) {
            return;
        }
        if (this.isModuleFiltered(session, sinkIndexEntry.entry.index.sink.id)) {
            return;
        }
        var sinkId = sinkIndexEntry.entry.sink.id;
        var section = session.sectionManager.getSectionBySinkId(sinkId);
        if (section && !section.isKvdbModuleEnabled()) {
            return;
        }
        if (sinkIndexEntry.entry.source.data.contentType == "application/json") {
            var data = sinkIndexEntry.entry.getContentAsJson();
            if (!data || data.type != "create-task" && data.type != "modify-task" && data.type != "delete-task" && data.type != "task-comment") {
                return;
            }
            var context = this.getContextFromSinkId(session, sinkIndexEntry.entry.sink.id);
            if (!(data.id in this.taskTitleCache[session.hostHash])) {
                this.taskTitleCache[session.hostHash][data.id] = data.name;
            }
            this.createTaskNotification(session, data.type, sinkIndexEntry.entry.source.data.sender.hashmail, data.label, context);
        }
    };
    TasksPlugin.prototype.createTaskNotification = function (session, type, sender, taskLabel, context) {
        var text;
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
        var event = {
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
        this.app.dispatchEvent(event);
    };
    TasksPlugin.prototype.isModuleFiltered = function (session, sinkId) {
        var filtered = this.isModuleMuted(session, sinkId) || ((this.activeSinkId === sinkId) && (this.activeSinkHostHash === session.hostHash) && this.activeWindowFocused === Mail.Types.section.NotificationModule.TASKS);
        return filtered;
    };
    TasksPlugin.prototype.isModuleMuted = function (session, sinkId) {
        if (this.userPreferences == null) {
            return true;
        }
        var muted = false;
        for (var _i = 0, _a = this.tasksSectionsCollectionNoPrivate[session.hostHash].list; _i < _a.length; _i++) {
            var section = _a[_i];
            var sink = section.getChatSink();
            if (sink && sink.id == sinkId) {
                muted = section.userSettings.mutedModules.tasks;
                break;
            }
        }
        return muted;
    };
    TasksPlugin.prototype.createTaskGroup = function (session, projectId, name) {
        var _this = this;
        return this.nextTaskGroupId(session)
            .then(function (id) {
            var tg = new TaskGroup_1.TaskGroup();
            DataMigration_1.DataMigration.setVersion(tg);
            tg.setId(id);
            tg.setName(name);
            tg.setProjectId(projectId);
            return _this.saveTaskGroup(session, tg)
                .then(function () {
                if (projectId in _this.projects[session.hostHash]) {
                    var p = _this.projects[session.hostHash][projectId];
                    p.addTaskGroupId(id);
                    return _this.saveProject(session, p)
                        .then(function () {
                        return id;
                    });
                }
            });
        });
    };
    TasksPlugin.prototype.createTask = function (session, projectId, taskGroupIds, description, status, onBeforeSave) {
        var _this = this;
        if (onBeforeSave === void 0) { onBeforeSave = null; }
        return this.nextTaskId(session)
            .then(function (id) {
            var nowTimestamp = new Date().getTime();
            var t = new Task_1.Task();
            DataMigration_1.DataMigration.setVersion(t);
            t.setId(id);
            t.setDescription(description);
            t.setStatus(status);
            t.setProjectId(projectId);
            t.setTaskGroupIds(taskGroupIds);
            t.setCreatedBy(_this.getMyId(session));
            t.setCreatedDateTime(nowTimestamp);
            t.setModifiedBy(_this.getMyId(session));
            t.setModifiedDateTime(nowTimestamp);
            t.addHistory({
                when: nowTimestamp,
                who: _this.getMyId(session),
                what: "created",
            });
            if (onBeforeSave) {
                onBeforeSave(t);
            }
            return _this.saveTask(session, t)
                .then(function () {
                var prom = pmc_mail_1.Q();
                if ((!taskGroupIds || taskGroupIds.length == 0) && (projectId in _this.projects[session.hostHash])) {
                    var p_1 = _this.projects[session.hostHash][projectId];
                    p_1.addOrphanedTasksId(id);
                    prom = prom.then(function () { return _this.saveProject(session, p_1); });
                }
                var _loop_14 = function (taskGroupId) {
                    if (taskGroupId && (taskGroupId in _this.taskGroups[session.hostHash])) {
                        var tg_1 = _this.taskGroups[session.hostHash][taskGroupId];
                        tg_1.addTaskId(id);
                        prom = prom.then(function () { return _this.saveTaskGroup(session, tg_1); });
                    }
                };
                for (var _i = 0, taskGroupIds_2 = taskGroupIds; _i < taskGroupIds_2.length; _i++) {
                    var taskGroupId = taskGroupIds_2[_i];
                    _loop_14(taskGroupId);
                }
                return prom;
            }).then(function () {
                return id;
            });
        });
    };
    TasksPlugin.prototype.createSimpleTaskService = function (privmxRegistry) {
        return pmc_mail_1.Q.all([
            privmxRegistry.getSrpSecure(),
            privmxRegistry.getSectionManager(),
            privmxRegistry.getIdentity(),
            privmxRegistry.getLocaleService()
        ])
            .then(function (res) {
            return new SimpleTaskService_1.SimpleTaskService(res[0], res[1], res[2], res[3]);
        });
    };
    TasksPlugin.prototype.nextUniqueId = function () {
        return UniqueId_1.UniqueId.next();
    };
    TasksPlugin.prototype.newTasksFilterUpdater = function () {
        return new TaskGroupsPanelController_1.TasksFilterUpdater();
    };
    TasksPlugin.prototype.addTaskStatusesFromMessage = function (session, statuses, text) {
        var matches = text.match(/\B#[0-9]{3,}\b/g);
        if (!matches) {
            return;
        }
        for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
            var taskHashId = matches_1[_i];
            var taskId = taskHashId.substr(1);
            if (!(taskId in statuses)) {
                var t = this.tasks[session.hostHash][taskId];
                if (t) {
                    statuses[taskId] = this.tasks[session.hostHash][taskId].getStatus();
                }
            }
        }
    };
    TasksPlugin.prototype.addTaskStatusesFromTaskIds = function (session, statuses, taskIds) {
        for (var _i = 0, taskIds_5 = taskIds; _i < taskIds_5.length; _i++) {
            var taskId = taskIds_5[_i];
            if (!(taskId in statuses)) {
                var t = this.tasks[session.hostHash][taskId];
                if (t) {
                    statuses[taskId] = this.tasks[session.hostHash][taskId].getStatus();
                }
            }
        }
    };
    TasksPlugin.prototype.getTaskIdsFromMessage = function (text) {
        var matches = text.match(/\B#[0-9]{3,}\b/g);
        if (!matches) {
            return [];
        }
        var taskIds = [];
        for (var _i = 0, matches_2 = matches; _i < matches_2.length; _i++) {
            var taskHashId = matches_2[_i];
            var taskId = taskHashId.substr(1);
            if (taskIds.indexOf(taskId) < 0) {
                taskIds.push(taskId);
            }
        }
        return taskIds;
    };
    TasksPlugin.prototype.convertBindedTaskId = function (data) {
        if (!data || (typeof (data) == "string" && data.length == 0)) {
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
    };
    TasksPlugin.prototype.getBindedTasksData = function (session, metaBindedElementId) {
        var bindedData = JSON.parse(this.convertBindedTaskId(metaBindedElementId));
        var bindedTaskIds = bindedData.taskIds;
        var bindedTasks = [];
        for (var _i = 0, bindedTaskIds_1 = bindedTaskIds; _i < bindedTaskIds_1.length; _i++) {
            var taskId = bindedTaskIds_1[_i];
            if (this.taskExists(session, taskId)) {
                bindedTasks.push({
                    taskId: taskId,
                    labelClass: this.getTaskLabelClassByTaskId(session, taskId),
                });
            }
        }
        if (bindedTasks.length > 0) {
            var taskIdsStr = bindedTasks.map(function (x) { return x.taskId; }).join(",");
            bindedTasks.splice(0, 0, {
                taskId: taskIdsStr,
                labelClass: this.getTaskLabelClassByTaskId(session, taskIdsStr),
            });
        }
        return bindedTasks;
    };
    TasksPlugin.prototype.isTasksPluginEnabledInSection = function (session, sectionId) {
        var section = session.sectionManager.getSection(sectionId);
        if (!section) {
            return false;
        }
        return !!section.isKvdbModuleEnabled();
    };
    TasksPlugin.prototype.openTask = function (session, _sectionId, id) {
        this.openEditTaskWindow(session, id, true);
    };
    TasksPlugin.prototype.onStorageEvent = function (session, event) {
        if (event.type == "descriptor-new-version") {
            if (event.descriptor && event.descriptor.lastVersion && event.descriptor.lastVersion.extra && event.descriptor.lastVersion.extra.meta) {
                var meta = event.descriptor.lastVersion.extra.meta;
                var data = JSON.parse(this.convertBindedTaskId(meta.bindedElementId));
                if (data && data.taskIds) {
                    var _loop_15 = function (taskId) {
                        var task = this_7.tasks[session.hostHash][taskId];
                        if (task) {
                            var did_1 = event.descriptor.ref.did;
                            var att = task.getAttachments().map(function (x) { return JSON.parse(x); }).filter(function (x) { return x.did == did_1; });
                            if (att.length > 0 && att[0]) {
                                if (event.version && event.version.raw && event.version.raw.modifier == this_7.getMyId(session).split("#")[0]) {
                                    this_7.tryAddTaskHistoryAttachmentModificationEntry(this_7.session, task, did_1, att[0].name, meta.modifiedDate);
                                }
                            }
                        }
                    };
                    var this_7 = this;
                    for (var _i = 0, _a = data.taskIds; _i < _a.length; _i++) {
                        var taskId = _a[_i];
                        _loop_15(taskId);
                    }
                }
            }
        }
    };
    TasksPlugin.prototype.tryAddTaskHistoryAttachmentModificationEntry = function (session, task, did, fileName, fileModDate) {
        var _this = this;
        if (task && this.areAttachmentModificationMessagesLocked(session, task.getId())) {
            return;
        }
        var history = task.getHistory();
        var lastEntry = history.length > 0 ? history[history.length - 1] : null;
        var addEntry = true;
        if (task.getModifiedDateTime() >= fileModDate) {
            return;
        }
        if (lastEntry) {
            if (lastEntry.what == "modified" && lastEntry.arg == "attachment" && lastEntry.who == this.getMyId(session)) {
                var attachment = JSON.parse(lastEntry.newVal);
                if (attachment && attachment.did == did) {
                    attachment.modsCount++;
                    lastEntry.when = fileModDate;
                    addEntry = false;
                }
                lastEntry.newVal = JSON.stringify(attachment);
                history[history.length - 1] = lastEntry;
            }
        }
        if (addEntry) {
            var entry = JSON.stringify({
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
        this.sendTaskMessage(session, task, "modify-task")
            .then(function (dt) {
            if (dt) {
                task.updateModifiedServerDateTime(dt);
            }
            return _this.saveTask(session, task);
        });
    };
    TasksPlugin.prototype.lockAttachmentModificationMessages = function (session, taskId) {
        if (!this.lockedAttachmentModificationMessages[session.hostHash]) {
            this.lockedAttachmentModificationMessages[session.hostHash] = [];
        }
        if (!this.areAttachmentModificationMessagesLocked(session, taskId)) {
            this.lockedAttachmentModificationMessages[session.hostHash].push(taskId);
        }
    };
    TasksPlugin.prototype.unlockAttachmentModificationMessages = function (session, taskId) {
        if (!this.lockedAttachmentModificationMessages[session.hostHash]) {
            this.lockedAttachmentModificationMessages[session.hostHash] = [];
        }
        var idx = this.lockedAttachmentModificationMessages[session.hostHash].indexOf(taskId);
        if (idx >= 0) {
            this.lockedAttachmentModificationMessages[session.hostHash].splice(idx, 1);
        }
    };
    TasksPlugin.prototype.areAttachmentModificationMessagesLocked = function (session, taskId) {
        if (!this.lockedAttachmentModificationMessages[session.hostHash]) {
            this.lockedAttachmentModificationMessages[session.hostHash] = [];
        }
        return this.lockedAttachmentModificationMessages[session.hostHash].indexOf(taskId) >= 0;
    };
    TasksPlugin.prototype.getNotificationText = function (session, i18nKey, taskLabel) {
        var taskId = taskLabel[0] == "#" ? taskLabel.substr(1) : taskLabel;
        var maxLength = this.app.getNotificationTitleMaxLength();
        var ellipsis = this.app.getNotificationTitleEllipsis().trim();
        var basicText = this.app.localeService.i18n(i18nKey, "{0}");
        var basicTextLength = basicText.length - 3;
        var msgTextMaxLength = maxLength - basicTextLength;
        var msgText = this.tasks[session.hostHash][taskId] ? this.tasks[session.hostHash][taskId].getName() : this.taskTitleCache[session.hostHash][taskId];
        msgText = msgText.replace(/<[^>]+>/g, "");
        if (msgText.length > msgTextMaxLength) {
            msgText = msgText.substr(0, msgTextMaxLength - ellipsis.length) + ellipsis;
        }
        return basicText.replace("{0}", msgText);
    };
    TasksPlugin.prototype.projectIdToSectionId = function (session, projectId) {
        var hostHash = this.app.sessionManager.getHashFromHost(session.host);
        if (projectId.indexOf(hostHash) == 0) {
            return projectId.split("-")[1];
        }
        return projectId;
    };
    TasksPlugin.prototype.sectionIdToProjectId = function (session, sectionId) {
        var hostHash = this.app.sessionManager.getHashFromHost(session.host);
        return hostHash + "-" + sectionId;
    };
    TasksPlugin.prototype.triggerFileAttached = function (session, did, taskId) {
        this.app.dispatchEvent({
            type: "file-attached-to-task",
            did: did,
            taskId: taskId,
            hostHash: session.hostHash,
        });
    };
    TasksPlugin.prototype.triggerFileDetached = function (session, did, taskId) {
        this.app.dispatchEvent({
            type: "file-detached-from-task",
            did: did,
            taskId: taskId,
            hostHash: session.hostHash,
        });
    };
    TasksPlugin.prototype.checkAttachmentChanges = function (session, oldTask, newTask) {
        var oldDids = oldTask.getAttachments().map(function (x) { return JSON.parse(x).did; });
        var newDids = newTask.getAttachments().map(function (x) { return JSON.parse(x).did; });
        for (var _i = 0, newDids_1 = newDids; _i < newDids_1.length; _i++) {
            var did = newDids_1[_i];
            if (oldDids.indexOf(did) < 0) {
                this.triggerFileAttached(session, did, newTask.getId());
            }
        }
        for (var _a = 0, oldDids_1 = oldDids; _a < oldDids_1.length; _a++) {
            var did = oldDids_1[_a];
            if (newDids.indexOf(did) < 0) {
                this.triggerFileDetached(session, did, oldTask.getId());
            }
        }
    };
    TasksPlugin.REJECT_REASON_DOES_NOT_EXIST = "does not exist";
    TasksPlugin.WATCHED_TASKS_HISTORY = "plugin.tasks.watchedTasksHistory";
    TasksPlugin.VIEW_SETTINGS = "plugin.tasks.viewSettings";
    TasksPlugin.ERR_INVALID_VERSION = 0x0063;
    return TasksPlugin;
}());
exports.TasksPlugin = TasksPlugin;
TasksPlugin.prototype.className = "com.privmx.plugin.tasks.main.TasksPlugin";

//# sourceMappingURL=TasksPlugin.js.map
