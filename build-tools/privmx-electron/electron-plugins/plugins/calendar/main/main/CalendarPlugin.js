"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Mail = require("pmc-mail");
var ViewSettings_1 = require("./ViewSettings");
var Types_1 = require("./Types");
var index_1 = require("../i18n/index");
var SearchFilter_1 = require("./SearchFilter");
var Logger = pmc_mail_1.Logger.get("privfs-calendar-plugin.CalendarPlugin");
var CalendarPlugin = (function () {
    function CalendarPlugin(app) {
        var _this = this;
        this.app = app;
        this.tasksPluginLoaded = pmc_mail_1.Q.defer();
        this.calendarPrimarySections = {};
        this.mergableSections = {};
        this.fileModels = {};
        this.calendarUnreadCountFullyLoadedModel = new Mail.utils.Model(false);
        this.sessionInitPromises = {};
        this.searchStr = "";
        this.app.addEventListener("tasks-plugin-loaded", function () {
            _this.tasksPlugin = app.getComponent("tasks-plugin");
            _this.tasksPluginLoaded.resolve();
        }, "calendar", "ethernal");
        this.tasksPlugin = app.getComponent("tasks-plugin");
        if (this.tasksPlugin) {
            this.tasksPluginLoaded.resolve();
        }
        this.tasksPluginLoaded.promise.then(function () {
            _this.tasksPlugin.tasksUnreadCountFullyLoadedModel.changeEvent.add(function () {
                _this.calendarUnreadCountFullyLoadedModel.set(_this.tasksPlugin.tasksUnreadCountFullyLoadedModel.get());
            }, "multi");
        });
    }
    CalendarPlugin.prototype.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, "plugin.calendar.");
    };
    CalendarPlugin.prototype.checkInit = function () {
        if (this.initPromise == null) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    };
    CalendarPlugin.prototype.init = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.app.sessionManager.initAfterLogin();
        })
            .then(function () {
            _this.session = _this.app.sessionManager.getLocalSession();
        })
            .then(function () {
            if (_this.app.mailClientApi == null) {
                return pmc_mail_1.Q();
            }
            var localSession = _this.app.sessionManager.getLocalSession();
            return _this.tasksPluginLoaded.promise.then(function () {
                return _this.tasksPlugin.checkInit();
            })
                .then(function () {
                _this.tasksPlugin.ensureSessionInit(_this.session);
                _this.sectionManager = _this.session.sectionManager;
                _this.utilApi = _this.tasksPlugin.utilApi;
                _this.identity = _this.tasksPlugin.identity;
                _this.personService = _this.tasksPlugin.personService;
                _this.conv2Service = _this.tasksPlugin.conv2Service;
                _this.userPreferences = _this.tasksPlugin.userPreferences;
                _this.localStorage = _this.tasksPlugin.localStorage;
                _this.tasksPlugin.ensureInitSessionCollections(_this.session);
                _this.sidebarSectionsCollection = new Mail.utils.collection.FilteredCollection(_this.sectionManager.filteredCollection, function (x) {
                    return !x.isUserGroup() && x != _this.sectionManager.getMyPrivateSection() && x.isVisible() && x.hasAccess();
                });
                return _this.initSession(localSession);
            })
                .then(function () {
                return _this.app.mailClientApi.privmxRegistry.getUserSettingsKvdb();
            })
                .then(function (kvdb) {
                _this.viewSettings = new ViewSettings_1.ViewSettings(CalendarPlugin.VIEW_SETTINGS, kvdb);
            })
                .then(function () {
                return pmc_mail_1.Q.all([
                    _this.loadSettings(localSession, "__global__"),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.ALL_TASKS_ID),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID),
                    _this.loadSettings(localSession, Types_1.CustomTasksElements.TRASH_ID),
                    _this.loadSettings(localSession, _this.getPrivateSectionId()),
                    _this.loadSettings(localSession, "private-tasks"),
                    pmc_mail_1.Q.all(_this.sidebarSectionsCollection.list.map(function (x) { return _this.loadSettings(localSession, x.getId()); })).thenResolve(null)
                ]);
            })
                .then(function () {
                _this.setupSearch();
                _this.app.addEventListener("hostSessionCreated", function (event) {
                    var session = _this.app.sessionManager.getSessionByHostHash(event.hostHash);
                    _this.initSession(session);
                });
            })
                .thenResolve(null);
        });
    };
    CalendarPlugin.prototype.initSession = function (session) {
        var _this = this;
        if (this.sessionInitPromises[session.hostHash]) {
            return this.sessionInitPromises[session.hostHash];
        }
        var initDeferred = pmc_mail_1.Q.defer();
        this.sessionInitPromises[session.hostHash] = initDeferred.promise;
        return pmc_mail_1.Q().then(function () {
            _this.fileModels[session.hostHash] = {};
            _this.calendarPrimarySections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) { return !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && x.sectionData.primary; });
            _this.mergableSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) {
                return !x.isUserGroup() && x.isVisible() && x.hasAccess() && x.hasCalendarModule() && x.isCalendarModuleEnabled();
            });
            _this.mergableSections[session.hostHash].changeEvent.add(function (event) {
                if (event.type == "add") {
                    event.element.getFileTree().then(function (fileTree) {
                        fileTree.collection.changeEvent.add(function (event) { return _this.onFileTreeCollectionEvent(session, event); });
                        _this.addFilesFromFileTree(session, fileTree);
                    });
                }
                else if (event.type == "remove") {
                    var prefix = event.element.getId();
                    var identifiersToRemove = [];
                    if (!_this.fileModels[session.hostHash]) {
                        _this.fileModels[session.hostHash] = {};
                    }
                    for (var identifier in _this.fileModels[session.hostHash]) {
                        if (identifier.startsWith(prefix)) {
                            identifiersToRemove.push(identifier);
                        }
                    }
                    for (var _i = 0, identifiersToRemove_1 = identifiersToRemove; _i < identifiersToRemove_1.length; _i++) {
                        var identifier = identifiersToRemove_1[_i];
                        delete _this.fileModels[session.hostHash][identifier];
                        _this.emitFileRemoved(session, identifier);
                    }
                }
            });
            return _this.loadFileTrees(session);
        })
            .then(function () {
            initDeferred.resolve();
        });
    };
    CalendarPlugin.prototype.getPrivateSectionId = function () {
        return this.tasksPlugin.getPrivateSectionId();
    };
    CalendarPlugin.prototype.getPrivateSection = function () {
        return this.tasksPlugin.getPrivateSection();
    };
    CalendarPlugin.prototype.getMyId = function (session) {
        return this.tasksPlugin.getMyId(session);
    };
    CalendarPlugin.prototype.reset = function () {
        this.initPromise = null;
        this.sidebarSectionsCollection = null;
        this.calendarPrimarySections = {};
        this.mergableSections = {};
        this.fileModels = {};
        this.sessionInitPromises = {};
    };
    CalendarPlugin.prototype.loadSettings = function (session, projectId) {
        if (projectId === void 0) { projectId = "__global__"; }
        return this.viewSettings.loadSettings(session, projectId);
    };
    CalendarPlugin.prototype.saveSetting = function (session, name, value, projectId, context) {
        var res = this.viewSettings.saveSetting(session, name, value, projectId, context);
        if (name == "show-files" && this.searchStr) {
            this.updateSearch(this.searchStr);
        }
        return res;
    };
    CalendarPlugin.prototype.getSetting = function (session, name, projectId, context) {
        return this.viewSettings.getSetting(session, name, projectId, context);
    };
    CalendarPlugin.prototype.wasTaskUnread = function (session, t, sectionId) {
        return this.tasksPlugin.wasTaskUnread(session, t, sectionId);
    };
    CalendarPlugin.prototype.getUnread = function (session, assignedToMe, createdByMe, skipMuted, trashed) {
        if (assignedToMe === void 0) { assignedToMe = false; }
        if (createdByMe === void 0) { createdByMe = false; }
        if (skipMuted === void 0) { skipMuted = false; }
        if (trashed === void 0) { trashed = false; }
        return this.tasksPlugin.getUnread(session, assignedToMe, createdByMe, skipMuted, trashed);
    };
    CalendarPlugin.prototype.getUnreadForSection = function (session, sectionId, assignedToMe, createdByMe, trashed) {
        if (assignedToMe === void 0) { assignedToMe = false; }
        if (createdByMe === void 0) { createdByMe = false; }
        if (trashed === void 0) { trashed = false; }
        return this.tasksPlugin.getUnreadForSection(session, sectionId, assignedToMe, createdByMe, trashed);
    };
    CalendarPlugin.prototype.getUnreadForConv2Section = function (session, sectionId, skipMuted) {
        if (skipMuted === void 0) { skipMuted = false; }
        return this.tasksPlugin.getUnreadForConv2Section(session, sectionId, skipMuted);
    };
    CalendarPlugin.prototype.markTaskAsWatched = function (session, taskId, sectionId) {
        return this.tasksPlugin.markTaskAsWatched(session, taskId, sectionId);
    };
    CalendarPlugin.prototype.markTasksAsWatched = function (session, taskIds) {
        return this.tasksPlugin.markTasksAsWatched(session, taskIds);
    };
    CalendarPlugin.prototype.setupSearch = function () {
        var _this = this;
        this.searchCounts = this._makeZeroSearchCountsObject();
        this.tasksFilterUpdater = this.tasksPlugin.newTasksFilterUpdater();
        this.tasksFilterUpdater.onUpdate = function () {
            _this.updateSearchFilter(_this.tasksFilterUpdater.filter);
        };
        this.app.searchModel.changeEvent.add(this.onFilterTasks.bind(this), "multi");
    };
    CalendarPlugin.prototype.onFilterTasks = function () {
        this.tasksFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    CalendarPlugin.prototype.updateSearchFilter = function (data) {
        var searchStr = data.visible ? data.value : "";
        this.updateSearch(searchStr);
    };
    CalendarPlugin.prototype.updateSearch = function (searchStr) {
        this.searchStr = searchStr;
        var sessions = this.getReadySessions();
        var newSearchCounts = this._makeZeroSearchCountsObject();
        if (searchStr != "") {
            var usersCache = {};
            for (var _i = 0, sessions_1 = sessions; _i < sessions_1.length; _i++) {
                var session = sessions_1[_i];
                usersCache[session.hostHash] = {};
                for (var _a = 0, _b = session.conv2Service.collection.list; _a < _b.length; _a++) {
                    var c2s = _b[_a];
                    usersCache[session.hostHash][c2s.id] = this.tasksPlugin.getConv2Users(session, c2s, true);
                }
            }
            var _loop_1 = function (session) {
                if (this_1.tasksPlugin.tasks[session.hostHash]) {
                    for (var taskId in this_1.tasksPlugin.tasks[session.hostHash]) {
                        var task = this_1.tasksPlugin.tasks[session.hostHash][taskId];
                        if (task.getStartTimestamp() == null) {
                            continue;
                        }
                        if (task.getProjectId() in newSearchCounts[session.hostHash]) {
                            var matches = this_1.tasksPlugin.tasks[session.hostHash][taskId].matchesSearchString(searchStr);
                            if (matches) {
                                newSearchCounts[session.hostHash][task.getProjectId()]++;
                                if (task.getIsTrashed()) {
                                    newSearchCounts[session.hostHash][Types_1.CustomTasksElements.TRASH_ID]++;
                                }
                                else {
                                    newSearchCounts[session.hostHash][Types_1.CustomTasksElements.ALL_TASKS_ID]++;
                                }
                                if (task.isAssignedTo(this_1.getMyId(session))) {
                                    newSearchCounts[session.hostHash][Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID]++;
                                }
                                if (task.getCreatedBy() == this_1.getMyId(session)) {
                                    newSearchCounts[session.hostHash][Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID]++;
                                }
                                for (var _i = 0, _a = session.conv2Service.collection.list; _i < _a.length; _i++) {
                                    var c2s = _a[_i];
                                    if (this_1.tasksPlugin.isAssignedToUsers(task, usersCache[session.hostHash][c2s.id])) {
                                        newSearchCounts[session.hostHash][c2s.id]++;
                                    }
                                }
                            }
                        }
                    }
                }
                if (this_1.getSetting(session, "show-files", null, null)) {
                    var projects = Object.keys(this_1.tasksPlugin.projects[session.hostHash])
                        .map(function (id) { return session.sectionManager.getSection(id); })
                        .filter(function (x) { return !!x; });
                    projects.push(Types_1.CustomTasksElements.TRASH_ID);
                    projects.push(Types_1.CustomTasksElements.ALL_TASKS_ID);
                    projects.push(Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID);
                    projects.push(Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID);
                    for (var _b = 0, projects_1 = projects; _b < projects_1.length; _b++) {
                        var project = projects_1[_b];
                        if (!(newSearchCounts[session.hostHash])) {
                            newSearchCounts[session.hostHash] = {};
                        }
                        var projectId = (project instanceof pmc_mail_1.mail.section.SectionService) ? project.getId() : project;
                        if (!newSearchCounts[session.hostHash][projectId]) {
                            newSearchCounts[session.hostHash][projectId] = 0;
                        }
                        newSearchCounts[session.hostHash][projectId] += this_1.getMatchingFilesCount(session, projectId, searchStr);
                    }
                }
            };
            var this_1 = this;
            for (var _c = 0, sessions_2 = sessions; _c < sessions_2.length; _c++) {
                var session = sessions_2[_c];
                _loop_1(session);
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
            type: "calendar-search-update",
            searchString: searchStr,
            searchTotalCount: this.searchTotalCount,
        });
    };
    CalendarPlugin.prototype.getSearchCount = function (session, x) {
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
    CalendarPlugin.prototype.fileMatchesSearchString = function (str, searchStr) {
        str = SearchFilter_1.SearchFilter.prepareHaystack(str).replace(/<(?:.|\n)*?>/gm, '');
        return str.indexOf(searchStr) >= 0;
    };
    CalendarPlugin.prototype.getMatchingFilesCount = function (session, projectId, searchStr) {
        var n = 0;
        var extraCalendars = this.getExtraCalendars(this.session, projectId);
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        for (var identifier in this.fileModels[session.hostHash]) {
            if (this.isFileRelevant(session, projectId, identifier, extraCalendars)) {
                var fileName = this.fileModels[session.hostHash][identifier].fileName;
                if (this.fileMatchesSearchString(fileName, searchStr)) {
                    n++;
                }
            }
        }
        return n;
    };
    CalendarPlugin.prototype.isFileRelevant = function (session, projectId, identifier, cachedExtraCalendars) {
        if (cachedExtraCalendars === void 0) { cachedExtraCalendars = null; }
        if (cachedExtraCalendars === null) {
            cachedExtraCalendars = this.getExtraCalendars(session, projectId);
            ;
        }
        if (!cachedExtraCalendars || !Array.isArray(cachedExtraCalendars)) {
            cachedExtraCalendars = [];
        }
        var all = projectId == Types_1.CustomTasksElements.ALL_TASKS_ID || projectId == Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || projectId == Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || projectId == Types_1.CustomTasksElements.TRASH_ID;
        var isTrash = projectId == Types_1.CustomTasksElements.TRASH_ID;
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        var fileProjectId = this.fileModels[session.hostHash][identifier].sectionId;
        if (all || fileProjectId == projectId || cachedExtraCalendars.indexOf(fileProjectId) >= 0) {
            var fileModel = this.fileModels[session.hostHash][identifier];
            var isTrashed = fileModel.trashed;
            if (isTrash != isTrashed) {
                return false;
            }
            if (!fileModel.createdAt) {
                return false;
            }
            if (fileModel
                && (projectId != Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID || this.isFileCreatedByMe(session, identifier))
                && (projectId != Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID || this.isFileAssignedToMe(session, identifier))) {
                return true;
            }
        }
        return false;
    };
    CalendarPlugin.prototype.isFileAssignedToMe = function (session, identifier) {
        return false;
    };
    CalendarPlugin.prototype.isFileCreatedByMe = function (session, identifier) {
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        var createdBy = this.fileModels[session.hostHash][identifier].createdBy;
        return createdBy == this.tasksPlugin.getMyId(this.session);
    };
    CalendarPlugin.prototype._makeZeroSearchCountsObject = function () {
        var searchCounts = {};
        for (var _i = 0, _a = this.getReadySessions(); _i < _a.length; _i++) {
            var session = _a[_i];
            searchCounts[session.hostHash] = {};
            for (var pId in this.tasksPlugin.projects[session.hostHash]) {
                searchCounts[session.hostHash][pId] = 0;
            }
            for (var _b = 0, _c = session.conv2Service.collection.list; _b < _c.length; _b++) {
                var c2s = _c[_b];
                searchCounts[session.hostHash][c2s.id] = 0;
            }
            searchCounts[session.hostHash][Types_1.CustomTasksElements.ALL_TASKS_ID] = 0;
            searchCounts[session.hostHash][Types_1.CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID] = 0;
            searchCounts[session.hostHash][Types_1.CustomTasksElements.TASKS_CREATED_BY_ME_ID] = 0;
            searchCounts[session.hostHash][Types_1.CustomTasksElements.TRASH_ID] = 0;
        }
        return searchCounts;
    };
    CalendarPlugin.prototype.getSessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            sessions.push(session);
        }
        return sessions;
    };
    CalendarPlugin.prototype.getReadySessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            if ((!session.initPromise || session.initPromise.isFulfilled()) && (!session.loadingPromise || session.loadingPromise.isFulfilled())) {
                sessions.push(session);
            }
        }
        return sessions;
    };
    CalendarPlugin.prototype.getExtraCalendars = function (session, mainProjectId) {
        if (this.app.sessionManager.getLocalSession() != session) {
            return [];
        }
        if (!this.viewSettings.hasProject(session, mainProjectId)) {
            return [];
        }
        var extraCalendars = JSON.parse(this.getSetting(session, "extra-calendars", mainProjectId, Types_1.ViewContext.Global));
        if (extraCalendars && Array.isArray(extraCalendars)) {
            return extraCalendars.slice();
        }
        return [];
    };
    CalendarPlugin.prototype.setExtraCalendars = function (session, mainProjectId, extraCalendars, senderId) {
        this.saveSetting(session, "extra-calendars", JSON.stringify(extraCalendars), mainProjectId, Types_1.ViewContext.Global);
        this.emitExtraCalendarsChanged(session, mainProjectId, senderId);
    };
    CalendarPlugin.prototype.getSectionsForWhichIsExtra = function (session, extraProjectId) {
        var _this = this;
        if (!this.mergableSections[session.hostHash]) {
            return [];
        }
        return this.mergableSections[session.hostHash].list
            .filter(function (x) { return _this.getExtraCalendars(session, x.getId()).indexOf(extraProjectId) >= 0; })
            .map(function (x) { return x.getId(); })
            .filter(function (x) { return x != extraProjectId; });
    };
    CalendarPlugin.prototype.getFileIdentifier = function (entry) {
        return entry.tree.section.getId() + ":" + entry.path;
    };
    CalendarPlugin.prototype.splitFileIdentifier = function (identifier) {
        var idx = identifier.indexOf(":");
        return {
            sectionId: identifier.substr(0, idx),
            path: identifier.substr(idx + 1),
        };
    };
    CalendarPlugin.prototype.onFileTreeCollectionEvent = function (session, event) {
        var _this = this;
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        if (event && event.type == "add" && event.element && event.element.meta && event.element.isFile()) {
            var identifier_1 = this.getFileIdentifier(event.element);
            if (identifier_1 in this.fileModels[session.hostHash]) {
                return;
            }
            var converted = this.convertFile(event.element);
            if (!converted) {
                return;
            }
            this.fileModels[session.hostHash][identifier_1] = converted;
            if (event.element.meta.createDate) {
                this.emitFileAdded(session, identifier_1);
            }
            else {
                event.element.tree.refreshDeep(true).then(function () {
                    var converted = _this.convertFile(event.element);
                    if (converted) {
                        _this.fileModels[session.hostHash][identifier_1] = converted;
                        _this.emitFileAdded(session, identifier_1);
                    }
                });
            }
        }
        else if (event && event.type == "update" && event.element && event.element.meta && event.element.isFile()) {
            var identifier_2 = this.getFileIdentifier(event.element);
            if (!(identifier_2 in this.fileModels[session.hostHash])) {
                return;
            }
            var converted = this.convertFile(event.element);
            if (!converted) {
                return;
            }
            this.fileModels[session.hostHash][identifier_2] = converted;
            if (event.element.meta.createDate) {
                this.emitFileAdded(session, identifier_2);
            }
            else {
                event.element.tree.refreshDeep(true).then(function () {
                    var converted = _this.convertFile(event.element);
                    if (converted) {
                        _this.fileModels[session.hostHash][identifier_2] = converted;
                        _this.emitFileAdded(session, identifier_2);
                    }
                });
            }
        }
        else if (event && event.type == "remove" && event.element && event.element.meta && event.element.isFile()) {
            var identifier = this.getFileIdentifier(event.element);
            if (!(identifier in this.fileModels[session.hostHash])) {
                return;
            }
            delete this.fileModels[session.hostHash][identifier];
            this.emitFileRemoved(session, identifier);
        }
    };
    CalendarPlugin.prototype.convertFile = function (entry) {
        if (pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(entry.path)) {
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
    };
    CalendarPlugin.prototype.loadFileTrees = function (session) {
        var _this = this;
        if (!this.mergableSections[session.hostHash]) {
            return pmc_mail_1.Q();
        }
        return pmc_mail_1.Q.all(this.mergableSections[session.hostHash].list.map(function (x) { return x.getFileTree(); })).then(function (fileTrees) {
            return pmc_mail_1.Q.all(fileTrees.map(function (x) { return x.refreshDeep(true); })).thenResolve(fileTrees);
        })
            .then(function (fileTrees) {
            fileTrees.forEach(function (fileTree) {
                fileTree.collection.changeEvent.add(function (event) { return _this.onFileTreeCollectionEvent(session, event); });
                _this.addFilesFromFileTree(session, fileTree, false);
            });
        });
    };
    CalendarPlugin.prototype.addFilesFromFileTree = function (session, fileTree, emit) {
        var _this = this;
        if (emit === void 0) { emit = true; }
        if (!this.fileModels[session.hostHash]) {
            this.fileModels[session.hostHash] = {};
        }
        fileTree.collection.forEach(function (x) {
            if (!x.isFile()) {
                return;
            }
            var identifier = _this.getFileIdentifier(x);
            var converted = _this.convertFile(x);
            if (converted) {
                _this.fileModels[session.hostHash][identifier] = converted;
                if (emit) {
                    _this.emitFileAdded(session, identifier);
                }
            }
        });
    };
    CalendarPlugin.prototype.emitFileAdded = function (session, identifier) {
        this.app.dispatchEvent({
            type: "calendars-file-added",
            identifier: identifier,
            hostHash: session.hostHash,
        });
    };
    CalendarPlugin.prototype.emitFileRemoved = function (session, identifier) {
        this.app.dispatchEvent({
            type: "calendars-file-removed",
            identifier: identifier,
            hostHash: session.hostHash,
        });
    };
    CalendarPlugin.prototype.emitExtraCalendarsChanged = function (session, mainProjectId, senderId) {
        this.app.dispatchEvent({
            type: "extra-calendars-changed",
            mainProjectId: mainProjectId,
            hostHash: session.hostHash,
            senderId: senderId,
        });
    };
    CalendarPlugin.prototype.resolveFileIcon = function (entry) {
        return this.app.shellRegistry.resolveIcon(entry.meta.mimeType);
    };
    CalendarPlugin.VIEW_SETTINGS = "plugin.calendar.viewSettings";
    return CalendarPlugin;
}());
exports.CalendarPlugin = CalendarPlugin;
CalendarPlugin.prototype.className = "com.privmx.plugin.calendar.main.CalendarPlugin";

//# sourceMappingURL=CalendarPlugin.js.map
