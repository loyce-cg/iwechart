"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var Q = Mail.Q;
var HistoryWindowController_1 = require("../window/history/HistoryWindowController");
var RecentFilesWindowController_1 = require("../window/recentfiles/RecentFilesWindowController");
var FileChooserWindowController_1 = require("../window/filechooser/FileChooserWindowController");
var RecentService_1 = require("./RecentService");
var LocationService_1 = require("./LocationService");
var FilesListController_1 = require("../component/fileslist/FilesListController");
var SettingsStorage_1 = require("./SettingsStorage");
var Common_1 = require("./Common");
var Notes2Utils_1 = require("./Notes2Utils");
var ViewSettings_1 = require("./ViewSettings");
var i18n_1 = require("../i18n");
var LocalFS_1 = require("./LocalFS");
var Notes2Plugin = (function () {
    function Notes2Plugin(app) {
        this.app = app;
        this.filesSections = {};
        this.files2Sections = {};
        this.filesRootSections = {};
        this.watchedFilesHistory = {};
        this.filesUnreadCountModel = new Mail.utils.Model(0);
        this.filesUnreadCountFullyLoadedModel = new Mail.utils.Model(false);
        this.unreadFilesBySection = {};
        this.unreadFileIds = {};
        this.lastProcessedIds = {};
        this.onReset = Q.defer();
        this.loadedDeferred = Q.defer();
        this.sectionsWithSpinner = {};
        this.sessionInitPromises = {};
    }
    Notes2Plugin.prototype.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, "plugin.notes2.");
    };
    Notes2Plugin.prototype.isChatPluginPresent = function () {
        return this.app.getComponent("chat-plugin") != null;
    };
    Notes2Plugin.prototype.isTasksPluginPresent = function () {
        return this.app.getComponent("tasks-plugin") != null;
    };
    Notes2Plugin.prototype.loadUserSettingsForImport = function (settingsKvdb) {
        var _this = this;
        return Q().then(function () {
            _this.viewSettings = new ViewSettings_1.ViewSettings(Notes2Plugin.VIEW_SETTINGS, settingsKvdb);
            return _this.loadSettings(null, "__global__");
        });
    };
    Notes2Plugin.prototype.initializeSessionCollectionsAndTrees = function (session) {
        var _this = this;
        if (this.sessionInitPromises[session.hostHash]) {
            return this.sessionInitPromises[session.hostHash];
        }
        var initDeferred = Q.defer();
        this.sessionInitPromises[session.hostHash] = initDeferred.promise;
        this.watchedFilesHistory[session.hostHash] = {};
        this.unreadFilesBySection[session.hostHash] = {};
        this.unreadFileIds[session.hostHash] = {};
        this.sectionsWithSpinner[session.hostHash] = {};
        this.filesSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) { return true; });
        this.files2Sections[session.hostHash] = new Mail.utils.collection.FilteredCollection(this.filesSections[session.hostHash], function (x) { return !x.isPrivateOrUserGroup(); });
        this.filesRootSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.rootSectionsCollection, function (x) { return x.isFileModuleEnabled(true); });
        this.filesSections[session.hostHash].changeEvent.add(function (event) { return _this.onFilesSectionChange(session, event); });
        var promises = [];
        this.filesSections[session.hostHash].forEach(function (section) {
            if (section.hasChatModule()) {
                promises.push(section.getChatSinkIndex());
            }
            section.getFileTree().then(function (tree) {
                if (tree) {
                    tree.refreshDeep(true);
                }
            });
        });
        return Q.all(promises)
            .then(function () {
            _this.unreadFilesBySection[session.hostHash][FilesListController_1.FilesListController.TRASH_FILES] = 0;
            var promises = [];
            var delayedUnreadSections = [];
            _this.filesSections[session.hostHash].forEach(function (section) {
                promises.push(_this.readWatchedFilesHistory(session, section.getId()).then(function () {
                    return section.getChatSinkIndex();
                })
                    .then(function (sinkIndex) {
                    if (sinkIndex) {
                        _this.processSectionUnread(session, section, sinkIndex);
                    }
                    else {
                        delayedUnreadSections.push(section);
                    }
                }));
            });
            return Q.all(promises).then(function () {
                _this.updateTotalUnreadFilesCount();
                _this.updateTrashBadge();
                _this.updateAllFilesBadge();
                _this.filesUnreadCountFullyLoadedModel.setWithCheck(true);
                if (delayedUnreadSections.length > 0) {
                    _this.loadedDeferred.promise.then(function () {
                        setTimeout(function () {
                            Q.all(delayedUnreadSections.map(function (section) {
                                return section.getChatSinkIndex().then(function (sinkIndex) {
                                    if (sinkIndex) {
                                        _this.processSectionUnread(session, section, sinkIndex);
                                    }
                                });
                            }))
                                .then(function () {
                                _this.updateTotalUnreadFilesCount();
                                _this.updateTrashBadge();
                                _this.updateAllFilesBadge();
                            });
                        }, 1000);
                    });
                }
            });
        })
            .then(function () {
            initDeferred.resolve();
        });
    };
    Notes2Plugin.prototype.load = function () {
        var _this = this;
        if (this.app.mailClientApi == null) {
            return Q();
        }
        return Q().then(function () {
            return Q.all([
                Q.all([
                    _this.app.mailClientApi.prepareAndGetSectionManager(),
                    _this.app.mailClientApi.privmxRegistry.getUserPreferences(),
                    _this.app.mailClientApi.privmxRegistry.getSinkIndexManager(),
                    _this.app.mailClientApi.privmxRegistry.getConversationService(),
                    _this.app.mailClientApi.privmxRegistry.getIdentity(),
                    _this.app.mailClientApi.privmxRegistry.getConv2Service(),
                ]),
                Q.all([
                    _this.app.mailClientApi.privmxRegistry.getUserSettingsKvdb(),
                    _this.app.mailClientApi.privmxRegistry.getContactService(),
                ]),
            ]);
        })
            .then(function (res) {
            var localSession = _this.app.sessionManager.getLocalSession();
            _this.sectionManager = res[0][0];
            _this.userPreferences = res[0][1];
            _this.sinkIndexManager = res[0][2];
            _this.conversationService = res[0][3];
            _this.identity = res[0][4];
            _this.conv2Service = res[0][5];
            _this.contactService = res[1][1];
            _this.settingsStorage = new SettingsStorage_1.SettingsStorage(Notes2Plugin.WATCHED_FILES_HISTORY, res[1][0]);
            _this.viewSettings = new ViewSettings_1.ViewSettings(Notes2Plugin.VIEW_SETTINGS, res[1][0]);
            _this.userPreferences.eventDispatcher.addEventListener("userpreferenceschange", _this.onUserPreferencesChange.bind(_this));
            _this.recentService = new RecentService_1.RecentService(_this.app, _this.sectionManager, _this.userPreferences, _this.sinkIndexManager, _this);
            _this.locationService = new LocationService_1.LocationService(_this.app, _this.sectionManager, _this.sinkIndexManager, _this.conversationService);
            Notes2Plugin.contactService = _this.contactService;
            return _this.initializeSessionCollectionsAndTrees(localSession);
        }).then(function () {
            return _this.loadSettings(null, "__global__");
        }).then(function () {
            _this.app.eventDispatcher.dispatchEvent({ type: "plugin-module-ready", name: Mail.Types.section.NotificationModule.NOTES2 });
            _this.app.addEventListener("mark-as-read", function (event) {
                var sessions = event.hostHash ? [_this.app.sessionManager.getSessionByHostHash(event.hostHash)] : _this.getReadySessions();
                if (event.moduleName == "notes2" || !event.moduleName) {
                    var projectId_1 = event.sectionId || event.conversationId || event.customElementId;
                    Q().then(function () {
                        _this.app.dispatchEvent({
                            type: "set-bubbles-state",
                            markingAsRead: true,
                            scope: event,
                        });
                        var def = Q.defer();
                        setTimeout(function () { return def.resolve(); }, 300);
                        return def.promise;
                    }).then(function () {
                        return Q.all([sessions.map(function (session) { return _this.markAllAsRead(session, projectId_1); })]);
                    })
                        .fin(function () {
                        _this.app.dispatchEvent({
                            type: "set-bubbles-state",
                            markingAsRead: false,
                            scope: event,
                        });
                    });
                }
            });
            _this.app.addEventListener("set-bubbles-state", function (e) {
                if (e.scope.moduleName && e.scope.moduleName != "notes2") {
                    return;
                }
                var newState = e.markingAsRead;
                var hostHash = e.scope.hostHash;
                var id = e.scope.conversationId || e.scope.customElementId || e.scope.sectionId || "__all__";
                if (hostHash) {
                    if (!_this.sectionsWithSpinner[hostHash]) {
                        _this.sectionsWithSpinner[hostHash] = {};
                    }
                    _this.sectionsWithSpinner[hostHash][id] = newState;
                }
                else {
                    for (var _i = 0, _a = _this.getReadySessions(); _i < _a.length; _i++) {
                        var session = _a[_i];
                        _this.sectionsWithSpinner[session.hostHash][id] = newState;
                    }
                }
                _this.app.dispatchEvent({
                    type: "update-notes2-sidebar-spinners",
                    conv2SectionId: e.scope.conversationId || undefined,
                    customElementId: e.scope.customElementId || undefined,
                    sectionId: e.scope.sectionId || undefined,
                    hostHash: e.scope.hostHash || undefined,
                });
            });
            _this.app.addEventListener("hostSessionCreated", function (event) {
                var session = _this.app.sessionManager.getSessionByHostHash(event.hostHash);
                _this.initializeSessionCollectionsAndTrees(session);
            });
        }).then(function () {
            _this.loadedDeferred.resolve();
        });
    };
    Notes2Plugin.prototype.isFirstLogin = function () {
        return !this.userPreferences.getValue("ui.seenFirstLoginInfo-notes2", false);
    };
    Notes2Plugin.prototype.setFirstLoginDone = function () {
        this.userPreferences.set("ui.seenFirstLoginInfo-notes2", 1, true);
    };
    Notes2Plugin.prototype.onFilesSectionChange = function (session, event) {
        var _this = this;
        if (event.element != null) {
            if (event.element.hasChatModule()) {
                event.element.getChatSinkIndex().then(function (sinkIndex) {
                    if (event.type == "add") {
                        var section = event.element;
                        _this.processSectionUnread(session, section, sinkIndex);
                        _this.updateTotalUnreadFilesCount();
                    }
                    if (_this.activeFilesList
                        && _this.activeFilesList.session && _this.activeFilesList.session.hostHash == session.hostHash
                        && _this.activeFilesList.filesInfo && _this.activeFilesList.filesInfo.conversation && _this.activeFilesList.filesInfo.conversation.section && _this.activeFilesList.filesInfo.conversation.section.getId() == event.element.getId()) {
                        _this.activeSinkId = event.element.getChatSink().id;
                        _this.activeSinkHostHash = (_this.activeFilesList && _this.activeFilesList.session ? _this.activeFilesList.session.hostHash : null) || _this.app.sessionManager.getLocalSession().hostHash;
                    }
                });
            }
            this.updateTotalUnreadFilesCount();
        }
    };
    Notes2Plugin.prototype.processSectionUnread = function (session, section, sinkIndex) {
        var _this = this;
        sinkIndex.changeEvent.add(function (_event, _sinkIndex, sinkIndexEntry) {
            if (_event == "new" || _event == "update") {
                _this.processMessage(session, section.getId(), sinkIndexEntry, true);
            }
            if (_event == "new" && sinkIndexEntry && sinkIndexEntry.source.data.contentType == "application/json") {
                var obj = sinkIndexEntry.getContentAsJson();
                if (obj && (obj.type == "create-file" || obj.type == "delete-file" || obj.type == "rename-file" || obj.type == "move-file")) {
                    section.getFileTree().then(function (tree) {
                        if (tree) {
                            tree.refreshDeep(true);
                        }
                    });
                }
            }
        });
        var sectionId = section.getId();
        if (!this.unreadFilesBySection[session.hostHash]) {
            this.unreadFilesBySection[session.hostHash] = {};
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        this.unreadFilesBySection[session.hostHash][sectionId] = 0;
        var x = sinkIndex.entries.indexMap.lastIndexOf(null);
        var startIndex = x >= 0 ? (x + 1) : 0;
        for (var k in this.unreadFileIds[session.hostHash]) {
            if (k.indexOf("section|file|" + sectionId + "|") >= 0) {
                this.unreadFilesBySection[session.hostHash][sectionId]++;
            }
        }
        for (var i = startIndex, len = sinkIndex.entries.indexMap.length; i < len; ++i) {
            this.processMessage(session, sectionId, sinkIndex.entries.list[sinkIndex.entries.indexMap[i]], false);
        }
        this.updateSectionBadge(session, section.getId());
    };
    Notes2Plugin.prototype.reset = function () {
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
    };
    Notes2Plugin.prototype.afterRecentFileRenamed = function (file) {
        if (this.app.isElectronApp() && this.recentFilesWindowController) {
            this.recentFilesWindowController.afterRecentFileRenamed(file);
        }
    };
    Notes2Plugin.prototype.openHistory = function (fromEvent) {
        var session = this.app.sessionManager.getSessionByHostHash(fromEvent.hostHash);
        this.app.ioc.create(HistoryWindowController_1.HistoryWindowController, [fromEvent.parent, session, fromEvent.fileSystem, fromEvent.path]).then(function (win) {
            fromEvent.parent.openChildWindow(win);
        });
    };
    Notes2Plugin.prototype.openTask = function (session, _sectionId, id) {
        var tasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksPlugin) {
            return;
        }
        tasksPlugin.openEditTaskWindow(session, id, true);
    };
    Notes2Plugin.prototype.openRecent = function () {
        var _this = this;
        if (this.app.isElectronApp() && this.recentFilesWindowController && this.recentFilesWindowController.nwin) {
            this.recentFilesWindowController.nwin.show();
            this.recentFilesWindowController.createNewDeferred();
            return this.recentFilesWindowController.getPromise();
        }
        return this.app.ioc.create(RecentFilesWindowController_1.RecentFilesWindowController, [this.app]).then(function (win) {
            _this.recentFilesWindowController = win;
            return _this.app.openChildWindow(win).getPromise();
        });
    };
    Notes2Plugin.prototype.openFileChooser = function (parentWindow, session, section, context, selectedPath, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        return this.app.ioc.create(FileChooserWindowController_1.FileChooserWindowController, [this.app, session, section, selectedPath, options])
            .then(function (win) {
            win.parent = parentWindow.getClosestNotDockedController();
            _this.app.openSingletonWindow("fileChooser-" + context, win);
            return win.getPromise().then(function (res) {
                return res;
            });
        });
    };
    Notes2Plugin.prototype.readWatchedFilesHistory = function (session, sectionId) {
        var _this = this;
        var key = this.getWatchedFilesHistoryKey(session, sectionId);
        return Q().then(function () {
            return _this.settingsStorage.getArray(key);
        }).then(function (history) {
            _this.watchedFilesHistory[session.hostHash][sectionId] = {};
            history.forEach(function (x) { return _this.watchedFilesHistory[session.hostHash][sectionId][x.id] = x; });
            return;
        });
    };
    Notes2Plugin.prototype.getLastMarkedAllAsRead = function (session, sectionId) {
        if (!this.watchedFilesHistory || !this.watchedFilesHistory[session.hostHash] || !this.watchedFilesHistory[session.hostHash][sectionId]) {
            return null;
        }
        var hist = this.watchedFilesHistory[session.hostHash][sectionId];
        return hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY] ? hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY].lastWatched : null;
    };
    Notes2Plugin.prototype.setLastMarkedAllAsRead = function (session, sectionId) {
        if (!this.watchedFilesHistory) {
            this.watchedFilesHistory = {};
        }
        if (!this.watchedFilesHistory[session.hostHash]) {
            this.watchedFilesHistory[session.hostHash] = {};
        }
        if (!this.watchedFilesHistory[session.hostHash][sectionId]) {
            this.watchedFilesHistory[session.hostHash][sectionId] = {};
        }
        var hist = this.watchedFilesHistory[session.hostHash][sectionId];
        hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY] = {
            id: Notes2Plugin.MARKED_ALL_AS_READ_ENTRY,
            lastWatched: new Date().getTime(),
            sectionId: sectionId,
        };
        var key = this.getWatchedFilesHistoryKey(session, sectionId);
        this.settingsStorage.setValue(key, [hist[Notes2Plugin.MARKED_ALL_AS_READ_ENTRY]]);
    };
    Notes2Plugin.prototype.writeWatchedFilesHistory = function (session, sectionId, fileItem) {
        var key = this.getWatchedFilesHistoryKey(session, sectionId);
        this.settingsStorage.setValue(key, [fileItem]);
    };
    Notes2Plugin.prototype.getWatchedFilesHistoryKey = function (session, sectionId) {
        if (session.host == this.app.sessionManager.getLocalSession().host) {
            return sectionId;
        }
        return session.hostHash + "--" + sectionId;
    };
    Notes2Plugin.prototype.markFilesAsWatched = function (session, files, markSectionsAsRead, trash) {
        var filesSections = {};
        var updateTrash = false;
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        for (var i = 0, l = files.length; i < l; ++i) {
            var file = files[i];
            if (!Notes2Utils_1.Notes2Utils.isFsFileEntry(file) || !this.wasUnread(session, file)) {
                return Q();
            }
            var sectionId = file.tree.section.getId();
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
                var watchedElement = { id: file.id, sectionId: sectionId, lastWatched: new Date().getTime() };
                this.watchedFilesHistory[session.hostHash][sectionId][file.id] = watchedElement;
                filesSections[sectionId].push(watchedElement);
            }
            delete this.unreadFileIds[session.hostHash][file.id];
            if (file.path.indexOf(Common_1.FilesConst.TRASH_PATH) >= 0) {
                this.unreadFilesBySection[session.hostHash][FilesListController_1.FilesListController.TRASH_FILES] = Math.max(0, this.unreadFilesBySection[session.hostHash][FilesListController_1.FilesListController.TRASH_FILES] - 1);
                updateTrash = true;
            }
            else {
                this.unreadFilesBySection[session.hostHash][sectionId] = Math.max(0, this.unreadFilesBySection[session.hostHash][sectionId] - 1);
            }
            this.app.dispatchEvent({
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
        for (var sectionId in filesSections) {
            var key = this.getWatchedFilesHistoryKey(session, sectionId);
            this.settingsStorage.setValue(key, filesSections[sectionId]);
            this.updateSectionBadge(session, sectionId);
        }
        for (var _i = 0, markSectionsAsRead_1 = markSectionsAsRead; _i < markSectionsAsRead_1.length; _i++) {
            var sectionId = markSectionsAsRead_1[_i];
            this.setLastMarkedAllAsRead(session, sectionId);
            this.unreadFilesBySection[session.hostHash][sectionId] = 0;
            var str = this.getSectionPrefix(sectionId);
            for (var id in this.unreadFileIds[session.hostHash]) {
                var trashed = id.indexOf(Common_1.FilesConst.TRASH_PATH + "/") >= 0;
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
    };
    Notes2Plugin.prototype.updateSectionBadge = function (session, sectionId) {
        this.app.dispatchEvent({
            type: "update-files-section-badge",
            sectionId: sectionId,
            hostHash: session.hostHash,
        });
    };
    Notes2Plugin.prototype.updateAllFilesBadge = function () {
        this.updateSectionBadge(this.app.sessionManager.getLocalSession(), FilesListController_1.FilesListController.ALL_FILES);
    };
    Notes2Plugin.prototype.updateTrashBadge = function () {
        this.updateSectionBadge(this.app.sessionManager.getLocalSession(), FilesListController_1.FilesListController.TRASH_FILES);
    };
    Notes2Plugin.prototype.markFileAsWatched = function (session, file) {
        this.markFilesAsWatched(session, [file], [], false);
    };
    Notes2Plugin.prototype.markFileAsWatchedById = function (session, fileId, sectionId) {
        var _this = this;
        if (!this.unreadFileIds[session.hostHash] || !this.unreadFileIds[session.hostHash][fileId]) {
            return;
        }
        session.sectionManager.getSection(sectionId).getFileTree().then(function (tree) {
            var file = tree.collection.find(function (x) { return x.id == fileId; });
            if (file) {
                _this.markFileAsWatched(session, file);
            }
        });
    };
    Notes2Plugin.prototype.wasUnread = function (session, file) {
        if (!Notes2Utils_1.Notes2Utils.isFsFileEntry(file)) {
            return false;
        }
        return (session.hostHash in this.unreadFileIds) && (file.id in this.unreadFileIds[session.hostHash]);
    };
    Notes2Plugin.prototype.wasDirUnread = function (session, dir) {
        var id = dir.id;
        if (id.length > 1 && id[id.length - 1] != "/") {
            id += "/";
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        for (var fileId in this.unreadFileIds[session.hostHash]) {
            if (fileId.indexOf(id) == 0 && this.unreadFileIds[session.hostHash][fileId]) {
                return true;
            }
        }
        return false;
    };
    Notes2Plugin.prototype.wasUnread2 = function (session, fileId, sectionId, modifiedBy, modifiedDate) {
        var unread = false;
        var inHistory = this.watchedFilesHistory[session.hostHash][sectionId] ? this.watchedFilesHistory[session.hostHash][sectionId][fileId] : null;
        if (modifiedBy != session.userData.identity.hashmail && modifiedBy != session.userData.identity.user) {
            if (!inHistory || inHistory.lastWatched < modifiedDate) {
                var lastAllMarked = this.getLastMarkedAllAsRead(session, sectionId);
                if (!lastAllMarked || lastAllMarked < modifiedDate) {
                    unread = true;
                }
            }
        }
        return unread;
    };
    Notes2Plugin.prototype.updateTotalUnreadFilesCount = function () {
        this.filesUnreadCountModel.setWithCheck(this.getUnreadFilesCount());
    };
    Notes2Plugin.prototype.getUnreadFilesCount = function () {
        if (this.userPreferences == null) {
            return 0;
        }
        var unreadFiles = 0;
        for (var _i = 0, _a = this.getReadySessions(); _i < _a.length; _i++) {
            var session = _a[_i];
            for (var _b = 0, _c = this.filesSections[session.hostHash].list; _b < _c.length; _b++) {
                var section = _c[_b];
                if (!section.userSettings.mutedModules.notes2 && section.isFileModuleEnabled()) {
                    unreadFiles += this.unreadFilesBySection[session.hostHash][section.getId()] || 0;
                }
            }
        }
        return unreadFiles;
    };
    Notes2Plugin.prototype.processMessage = function (session, sectionId, sinkIndexEntry, dispatchEvents) {
        var _this = this;
        if (!sinkIndexEntry || !sinkIndexEntry.source) {
            return;
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        if (sinkIndexEntry.source.data.contentType == "application/json") {
            var data_1 = sinkIndexEntry.getContentAsJson();
            if (!data_1) {
                return;
            }
            var allowedTypes = [
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
            if (allowedTypes.indexOf(data_1.type) < 0) {
                return;
            }
            if (!this.lastProcessedIds[session.hostHash]) {
                this.lastProcessedIds[session.hostHash] = {};
            }
            if (sinkIndexEntry.id <= this.lastProcessedIds[session.hostHash][sectionId]) {
                return;
            }
            this.lastProcessedIds[session.hostHash][sectionId] = sinkIndexEntry.id;
            var fileId = data_1.path ? Mail.mail.filetree.nt.Entry.getId(sectionId, data_1.path) : "";
            if (this.activeFilesList) {
                this.activeFilesList.refreshTree(true);
            }
            if (data_1.type == "move-file") {
                var oldSectionId = data_1.oldSectionId;
                var newSectionId = data_1.newSectionId;
                if (!oldSectionId && !newSectionId) {
                    for (var _i = 0, _a = this.sectionManager.sectionsCollection.list; _i < _a.length; _i++) {
                        var section = _a[_i];
                        var oldFileId = data_1.oldPath ? Mail.mail.filetree.nt.Entry.getId(section.getId(), data_1.oldPath) : "";
                        var newFileId = data_1.newPath ? Mail.mail.filetree.nt.Entry.getId(section.getId(), data_1.newPath) : "";
                        this.delFromUnread(session, data_1.oldPath, oldFileId, section.getId(), dispatchEvents);
                        this.delFromUnread(session, data_1.newPath, newFileId, section.getId(), dispatchEvents);
                    }
                }
                else {
                    var oldFileId = data_1.oldPath ? Mail.mail.filetree.nt.Entry.getId(oldSectionId, data_1.oldPath) : "";
                    var newFileId = data_1.newPath ? Mail.mail.filetree.nt.Entry.getId(newSectionId, data_1.newPath) : "";
                    this.delFromUnread(session, data_1.oldPath, oldFileId, oldSectionId, dispatchEvents);
                    this.addToUnread(session, data_1.newPath, newFileId, sinkIndexEntry, newSectionId, dispatchEvents);
                }
            }
            if (data_1.type == "create-file") {
                this.addToUnread(session, data_1.path, fileId, sinkIndexEntry, sectionId, dispatchEvents);
            }
            if (data_1.type == "save-file") {
                if (this.activeFilesList && this.activeFilesList.activeCollection) {
                    var active = this.activeFilesList.activeCollection.active;
                    if (active) {
                        var parsedId = Mail.mail.filetree.nt.Entry.parseId(active.obj.id);
                        if (parsedId && parsedId.sectionId == data_1.sectionId && parsedId.path == data_1.path && this.activeFilesList.session.hostHash == session.hostHash) {
                            this.activeFilesList.loadFilePreview();
                        }
                    }
                }
                if (this.recentFilesWindowController && dispatchEvents && fileId) {
                    this.recentFilesWindowController.invalidateCache(fileId);
                }
            }
            else if (data_1.type == "rename-file") {
                var oldFileId = data_1.oldPath ? Mail.mail.filetree.nt.Entry.getId(sectionId, data_1.oldPath) : "";
                var newFileId = data_1.newPath ? Mail.mail.filetree.nt.Entry.getId(sectionId, data_1.newPath) : "";
                this.delFromUnread(session, data_1.oldPath, oldFileId, sectionId, dispatchEvents);
                this.addToUnread(session, data_1.newPath, newFileId, sinkIndexEntry, sectionId, dispatchEvents);
            }
            else if (data_1.type == "delete-file") {
                if (data_1.trashPath && (fileId in this.unreadFileIds[session.hostHash])) {
                    var trashFileId = this.fixTrashPath(Mail.mail.filetree.nt.Entry.getId(sectionId, Common_1.FilesConst.TRASH_PATH + data_1.trashPath));
                    this.addToUnread(session, data_1.trashPath, trashFileId, sinkIndexEntry, FilesListController_1.FilesListController.TRASH_FILES, dispatchEvents);
                }
                this.delFromUnread(session, data_1.path, fileId, sectionId, dispatchEvents);
            }
            else if (data_1.type == "delete-file-permanent") {
                this.delFromUnread(session, data_1.path, fileId, sectionId, dispatchEvents);
            }
            else if (data_1.type == "rename-directory") {
                this.forEachUnreadMatching(session, sectionId, data_1.oldPath, function (id, prefix) {
                    var len = (prefix + data_1.oldPath).length;
                    var newId = prefix + data_1.newPath + id.substr(len);
                    _this.delFromUnread(session, id, id, sectionId, dispatchEvents);
                    _this.addToUnread(session, newId, newId, sinkIndexEntry, sectionId, dispatchEvents);
                });
            }
            else if (data_1.type == "delete-directory") {
                this.forEachUnreadMatching(session, sectionId, data_1.path, function (id, prefix) {
                    _this.delFromUnread(session, id, id, sectionId, dispatchEvents);
                    if (data_1.trashPath) {
                        var len = (prefix + data_1.path).length;
                        var newPath = data_1.trashPath + id.substr(len);
                        var trashFileId = Mail.mail.filetree.nt.Entry.getId(sectionId, Common_1.FilesConst.TRASH_PATH + newPath);
                        _this.addToUnread(session, trashFileId, trashFileId, sinkIndexEntry, sectionId, dispatchEvents);
                    }
                });
            }
            else if (data_1.type == "delete-directory-permanent") {
                this.forEachUnreadMatching(session, sectionId, data_1.path, function (id) {
                    _this.delFromUnread(session, id, id, sectionId, dispatchEvents);
                });
            }
            if (dispatchEvents) {
                this.updateAllFilesBadge();
                this.updateTotalUnreadFilesCount();
            }
        }
    };
    Notes2Plugin.prototype.forEachUnreadMatching = function (session, sectionId, path, func) {
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        var str = this.getSectionPrefix(sectionId);
        for (var id in this.unreadFileIds[session.hostHash]) {
            if (id.indexOf(str + path + "/") == 0) {
                func(id, str);
            }
        }
    };
    Notes2Plugin.prototype.getSectionPrefix = function (sectionId) {
        return "section|file|" + sectionId + "|";
    };
    Notes2Plugin.prototype.addToUnread = function (session, path, fileId, sinkIndexEntry, sectionId, dispatchEvents) {
        if (Mail.mail.thumbs.ThumbsManager.isThumb(path)) {
            return;
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        if (!(fileId in this.unreadFileIds[session.hostHash]) && this.wasUnread2(session, fileId, sectionId, sinkIndexEntry.source.data.sender.hashmail, sinkIndexEntry.source.data.createDate)) {
            this.unreadFileIds[session.hostHash][fileId] = true;
            var targetId = path.indexOf(Common_1.FilesConst.TRASH_PATH) < 0 ? sectionId : FilesListController_1.FilesListController.TRASH_FILES;
            this.unreadFilesBySection[session.hostHash][targetId]++;
            this.unreadFilesBySection[session.hostHash][FilesListController_1.FilesListController.TRASH_FILES] = 0;
            if (dispatchEvents) {
                this.updateSectionBadge(session, targetId);
                this.app.dispatchEvent({
                    type: "update-watched-file",
                    fileId: fileId,
                    hostHash: session.hostHash,
                });
            }
        }
    };
    Notes2Plugin.prototype.delFromUnread = function (session, path, fileId, sectionId, dispatchEvents) {
        if (Mail.mail.thumbs.ThumbsManager.isThumb(path)) {
            return;
        }
        if (!this.unreadFileIds[session.hostHash]) {
            this.unreadFileIds[session.hostHash] = {};
        }
        if (fileId in this.unreadFileIds[session.hostHash]) {
            delete this.unreadFileIds[session.hostHash][fileId];
            var targetId = path.indexOf(Common_1.FilesConst.TRASH_PATH) < 0 ? sectionId : FilesListController_1.FilesListController.TRASH_FILES;
            this.unreadFilesBySection[session.hostHash][targetId] = Math.max(0, this.unreadFilesBySection[session.hostHash][targetId] - 1);
            if (dispatchEvents) {
                this.updateSectionBadge(session, targetId);
            }
        }
    };
    Notes2Plugin.prototype.onUserPreferencesChange = function () {
        this.updateTotalUnreadFilesCount();
    };
    Notes2Plugin.prototype.onPollingResult = function (entries) {
        var _this = this;
        if (entries) {
            entries.forEach(function (entry) {
                _this.notifyUser(entry);
            });
        }
    };
    Notes2Plugin.prototype.isPollingItemComingFromMe = function (item) {
        if (item.entry) {
            var session = this.app.sessionManager.getSession(item.entry.host);
            var message = item.entry.getMessage();
            if (message.sender.pub58 == session.userData.identity.pub58) {
                return true;
            }
        }
        return false;
    };
    Notes2Plugin.prototype.getContextFromSinkId = function (session, sinkId) {
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
    Notes2Plugin.prototype.notifyUser = function (sinkIndexEntry) {
        if (!sinkIndexEntry || !sinkIndexEntry.entry || !sinkIndexEntry.entry.source) {
            return;
        }
        if (!this.app.sessionManager.isSessionExistsByHost(sinkIndexEntry.entry.host)) {
            return;
        }
        var session = this.app.sessionManager.getSession(sinkIndexEntry.entry.host);
        if (this.isModuleFiltered(session, sinkIndexEntry.entry.index.sink.id)) {
            return;
        }
        if (this.isPollingItemComingFromMe(sinkIndexEntry)) {
            return;
        }
        var section = session.sectionManager.filteredCollection.list.find(function (x) { return x.getChatSink() && x.getChatSink().id == sinkIndexEntry.entry.sink.id; });
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
            var data = sinkIndexEntry.entry.getContentAsJson();
            if (!data || data.type != "create-file" && data.type != "rename-file" && data.type != "delete-file") {
                return;
            }
            var context = this.getContextFromSinkId(session, sinkIndexEntry.entry.sink.id);
            this.createFileNotification(session, data.type, sinkIndexEntry.entry.source.data.sender.hashmail, context, data.type == "create-file" || data.type == "delete-file" ? data.path : data.oldPath, data.newPath);
        }
    };
    Notes2Plugin.prototype.createFileNotification = function (session, type, sender, context, path, path2) {
        var text;
        var fileName = path.substring(path.lastIndexOf("/") + 1);
        if (type == "create-file") {
            text = this.app.localeService.i18n("plugin.notes2.notification.createFile") + " " + fileName;
        }
        else if (type == "delete-file") {
            text = this.app.localeService.i18n("plugin.notes2.notification.deleteFile") + " " + fileName;
        }
        else if (type == "rename-file") {
            var oldPath = path || "";
            var newPath = path2 || "";
            var oldName = oldPath.substring(oldPath.lastIndexOf("/") + 1);
            var newName = newPath.substring(newPath.lastIndexOf("/") + 1);
            text = this.app.localeService.i18n("plugin.notes2.notification.renameFile") + " " + oldName + " " + this.app.localeService.i18n("plugin.notes2.notification.renameFile.to") + " " + newName;
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
                    module: Mail.Types.section.NotificationModule.NOTES2,
                    sinkId: context,
                    hostHash: session.hostHash,
                },
            }
        };
        this.app.dispatchEvent(event);
    };
    Notes2Plugin.prototype.isModuleFiltered = function (session, sinkId) {
        var filtered = this.isModuleMuted(session, sinkId) || ((this.activeSinkId === sinkId) && (this.activeSinkHostHash === session.hostHash) && this.activeWindowFocused === Mail.Types.section.NotificationModule.NOTES2);
        return filtered;
    };
    Notes2Plugin.prototype.isModuleMuted = function (session, sinkId) {
        if (this.userPreferences == null) {
            return true;
        }
        var muted = false;
        for (var _i = 0, _a = session.sectionManager.filteredCollection.list; _i < _a.length; _i++) {
            var section = _a[_i];
            var sink = section.getChatSink();
            if (sink && sink.id == sinkId) {
                muted = section.userSettings.mutedModules.notes2 || false;
                break;
            }
        }
        return muted;
    };
    Notes2Plugin.prototype.loadSettings = function (session, sectionId) {
        if (sectionId === void 0) { sectionId = "__global__"; }
        return this.viewSettings.loadSettings(session, sectionId);
    };
    Notes2Plugin.prototype.saveSetting = function (session, name, value, sectionId, context) {
        return this.viewSettings.saveSetting(session, name, value, sectionId, context);
    };
    Notes2Plugin.prototype.getSetting = function (session, name, sectionId, context) {
        return this.viewSettings.getSetting(session, name, sectionId, context);
    };
    Notes2Plugin.prototype.getSettingFullSectionId = function (session, sectionId) {
        if (!session || !sectionId) {
            return sectionId;
        }
        var isRemoteSession = session.host != this.app.sessionManager.getLocalSession().host;
        var fullSectionId = isRemoteSession ? session.hostHash + "--" + sectionId : sectionId;
        return fullSectionId;
    };
    Notes2Plugin.prototype.fixTrashPath = function (path) {
        if (path.indexOf(Common_1.FilesConst.TRASH_PATH) >= 0) {
            var parts = path.split(Common_1.FilesConst.TRASH_PATH + "/");
            var f = parts[1];
            var arr = f.split("/");
            f = arr[arr.length - 1];
            path = parts[0] + Common_1.FilesConst.TRASH_PATH + "/" + f;
        }
        return path;
    };
    Notes2Plugin.prototype.markAllAsRead = function (session, projectId) {
        var _this = this;
        var sectionId = null;
        if (projectId) {
            if (projectId.indexOf("c2:") == 0) {
                var conversation = session.conv2Service.collection.find(function (x) { return x.id == projectId; });
                if (conversation && conversation.section) {
                    sectionId = conversation.section.getId();
                }
            }
            else {
                sectionId = projectId;
            }
        }
        var sections;
        if (sectionId) {
            sections = [session.sectionManager.getSection(sectionId)];
        }
        else {
            sections = session.sectionManager.sectionsCollection.list.filter(function (x) { return x.hasAccess(); });
        }
        var fileTrees = {};
        var promises = [];
        var _loop_1 = function (section) {
            promises.push(section.getFileTree().then(function (tree) {
                if (tree) {
                    fileTrees[section.getId()] = tree;
                }
            }));
        };
        for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
            var section = sections_1[_i];
            _loop_1(section);
        }
        return Q.all(promises).then(function () {
            var prefix = "section|file|" + (sectionId ? sectionId : "");
            var unreadFiles = [];
            if (!_this.unreadFileIds[session.hostHash]) {
                _this.unreadFileIds[session.hostHash] = {};
            }
            var _loop_2 = function (id) {
                if (_this.unreadFileIds[session.hostHash][id] && id.substr(0, prefix.length) == prefix) {
                    var tree = fileTrees[id.split("|")[2]];
                    if (tree) {
                        var fileEntry = tree.collection.find(function (x) { return x.id == id; });
                        if (fileEntry) {
                            unreadFiles.push(fileEntry);
                        }
                    }
                }
            };
            for (var id in _this.unreadFileIds[session.hostHash]) {
                _loop_2(id);
            }
            return _this.markFilesAsWatched(session, unreadFiles, sections.map(function (x) { return x.getId(); }), projectId == FilesListController_1.FilesListController.TRASH_FILES);
        });
    };
    Notes2Plugin.prototype.sendMoveFileMessage = function (receiverSection, oldPath, newPath, oldSection, newSection) {
        if (receiverSection == null || receiverSection.isPrivate() || !receiverSection.hasChatModule()) {
            return Q();
        }
        var chatModule = receiverSection.getChatModule();
        chatModule.sendMoveFileMessage(oldPath, newPath, oldSection.getId(), newSection.getId(), null, null);
    };
    Notes2Plugin.prototype.openNewTextNoteWindow = function (session, sectionId, path) {
        if (sectionId === void 0) { sectionId = null; }
        if (path === void 0) { path = "/"; }
        this.openNewNoteWindow(session, "text", sectionId, path);
    };
    Notes2Plugin.prototype.openNewMindmapWindow = function (session, sectionId, path) {
        if (sectionId === void 0) { sectionId = null; }
        if (path === void 0) { path = "/"; }
        this.openNewNoteWindow(session, "mindmap", sectionId, path);
    };
    Notes2Plugin.prototype.openNewNoteWindow = function (session, type, sectionId, path) {
        var _this = this;
        if (sectionId === void 0) { sectionId = null; }
        if (path === void 0) { path = "/"; }
        var ext;
        var appAction;
        var applicationId;
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
            var priv = this.sectionManager.getMyPrivateSection();
            if (!priv) {
                return;
            }
            sectionId = priv.getId();
            session = this.app.sessionManager.getLocalSession();
        }
        var wnd = null;
        Q().then(function () {
            return _this.app.shellRegistry.shellOpen({
                action: Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL,
                element: null,
                session: session,
                editorOptions: { newFile: true },
                applicationId: applicationId,
            });
        })
            .then(function (_wnd) {
            wnd = _wnd;
            if (sectionId == FilesListController_1.FilesListController.LOCAL_FILES) {
                return _this.app.generateUniqueFileName("local", path, ext);
            }
            else {
                var section = session.sectionManager.getSection(sectionId);
                return _this.app.generateUniqueFileName(section, path, ext);
            }
        })
            .then(function (fileName) {
            _this.app.shellRegistry.callAppAction(appAction, fileName).then(function (content) {
                if (sectionId == FilesListController_1.FilesListController.LOCAL_FILES) {
                    var fullPath_1 = LocalFS_1.LocalFS.joinPath(path, fileName);
                    return LocalFS_1.LocalFS.createFile(fullPath_1).then(function () {
                        return LocalFS_1.LocalOpenableElement.create(fullPath_1).then(function (el) {
                            el.save(content);
                            return el;
                        });
                    });
                }
                else {
                    var section = session.sectionManager.getSection(sectionId);
                    if (section) {
                        return section.uploadFile({
                            data: content,
                            path: path,
                        })
                            .then(function (result) {
                            return result.openableElement;
                        });
                    }
                }
            })
                .then(function (el) {
                return Q.delay(0).thenResolve(el);
            })
                .then(function (el) {
                if (!el) {
                    return;
                }
                var _wnd = wnd;
                if (_wnd.reopen) {
                    _wnd.reopen(el, true).then(function () {
                        return Q.delay(0);
                    })
                        .then(function () {
                        _wnd.enterEditMode();
                    });
                }
            });
        })
            .catch(console.error);
    };
    Notes2Plugin.prototype.openNewAudioAndVideoNoteWindow = function (session, sectionId, path) {
        if (sectionId === void 0) { sectionId = null; }
        if (path === void 0) { path = "/"; }
        this.openVideoRecorderWindow(session, sectionId, path, Mail.window.videorecorder.VideoRecorderMode.AUDIO_AND_VIDEO);
    };
    Notes2Plugin.prototype.openNewAudioNoteWindow = function (session, sectionId, path) {
        if (sectionId === void 0) { sectionId = null; }
        if (path === void 0) { path = "/"; }
        this.openVideoRecorderWindow(session, sectionId, path, Mail.window.videorecorder.VideoRecorderMode.AUDIO);
    };
    Notes2Plugin.prototype.openNewPhotoNoteWindow = function (session, sectionId, path) {
        if (sectionId === void 0) { sectionId = null; }
        if (path === void 0) { path = "/"; }
        this.openVideoRecorderWindow(session, sectionId, path, Mail.window.videorecorder.VideoRecorderMode.PHOTO);
    };
    Notes2Plugin.prototype.openVideoRecorderWindow = function (session, sectionId, path, mode) {
        var _this = this;
        var videoRecorderOptions = {
            saveModel: {
                type: "sectionFile",
                session: session,
                sectionId: sectionId,
                path: path,
            },
            mode: mode,
            closeAfterSaved: true,
        };
        this.app.ioc.create(Mail.window.videorecorder.VideoRecorderWindowController, [this.app, videoRecorderOptions]).then(function (win) {
            var winName = mode == Mail.window.videorecorder.VideoRecorderMode.AUDIO ? "audio-recorder" : "video-recorder";
            _this.app.openSingletonWindow(winName, win);
        });
    };
    Notes2Plugin.prototype.getSessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            sessions.push(session);
        }
        return sessions;
    };
    Notes2Plugin.prototype.getReadySessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            if ((!session.initPromise || session.initPromise.isFulfilled()) && (!session.loadingPromise || session.loadingPromise.isFulfilled())) {
                sessions.push(session);
            }
        }
        return sessions;
    };
    Notes2Plugin.getPersonModel = function (session, person) {
        return {
            hashmail: person.getHashmail(),
            username: person.username,
            name: person.hasContact() && person.contact.hasName() ? person.contact.getDisplayName() : "",
            description: person.getDescription(),
            present: person.isPresent(),
            deleted: session.conv2Service.contactService.deletedUsers.indexOf(person.usernameCore) >= 0,
        };
    };
    Notes2Plugin.WATCHED_FILES_HISTORY = "plugin.notes2.watchedFilesHistory";
    Notes2Plugin.VIEW_SETTINGS = "plugin.notes2.viewSettings";
    Notes2Plugin.MARKED_ALL_AS_READ_ENTRY = "plugin.notes2.markedAllAsReadEntry";
    return Notes2Plugin;
}());
exports.Notes2Plugin = Notes2Plugin;
Notes2Plugin.prototype.className = "com.privmx.plugin.notes2.main.Notes2Plugin";

//# sourceMappingURL=Notes2Plugin.js.map
