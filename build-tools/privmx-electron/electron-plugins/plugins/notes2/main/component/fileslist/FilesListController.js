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
var HistoryWindowController_1 = require("../../window/history/HistoryWindowController");
var Notes2Plugin_1 = require("../../main/Notes2Plugin");
var Notes2Utils_1 = require("../../main/Notes2Utils");
var FileConflictResolverWindowController_1 = require("../../window/fileconflictresolver/FileConflictResolverWindowController");
var FileErrorWindowController_1 = require("../../window/fileerror/FileErrorWindowController");
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var NewNoteWindowController_1 = require("../../window/newnote/NewNoteWindowController");
var Common_1 = require("../../main/Common");
var LocalFS_1 = require("../../main/LocalFS");
var ViewSettings_1 = require("../../main/ViewSettings");
var i18n_1 = require("./i18n");
var Notes2WindowController_1 = require("../../window/notes2/Notes2WindowController");
var FilesImporterWindowController_1 = require("../../window/filesimporter/FilesImporterWindowController");
var SelectionMode;
(function (SelectionMode) {
    SelectionMode[SelectionMode["SINGLE"] = 0] = "SINGLE";
    SelectionMode[SelectionMode["MULTI"] = 1] = "MULTI";
})(SelectionMode = exports.SelectionMode || (exports.SelectionMode = {}));
var FilesListType;
(function (FilesListType) {
    FilesListType[FilesListType["CONVERSATION"] = 0] = "CONVERSATION";
    FilesListType[FilesListType["CHANNEL"] = 1] = "CHANNEL";
    FilesListType[FilesListType["OTHER"] = 2] = "OTHER";
})(FilesListType = exports.FilesListType || (exports.FilesListType = {}));
var FilesFilterUpdater = (function () {
    function FilesFilterUpdater() {
        this.setFilter({ value: "", visible: false });
    }
    FilesFilterUpdater.prototype.setFilter = function (filter) {
        this.filter = filter;
        this.lastFilterChangeTime = Date.now();
    };
    FilesFilterUpdater.prototype.onDeactivateFiles = function () {
        this.deactivateTime = Date.now();
    };
    FilesFilterUpdater.prototype.needsUpdate = function () {
        if (this.deactivateTime && this.deactivateTime < this.lastFilterChangeTime && this.previousFilter && this.previousFilter.value.length > 0) {
            return true;
        }
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
    };
    FilesFilterUpdater.prototype.updateFilter = function (filter, onPanelActivate) {
        var _this = this;
        if (onPanelActivate === void 0) { onPanelActivate = false; }
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (!filter.visible) {
            this.setFilter({ value: "", visible: false });
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
            value: pmc_mail_1.app.common.SearchFilter.prepareNeedle(filter.value),
            visible: filter.visible,
        };
        var f = function () {
            _this.updateTimer = null;
            _this.setFilter(_this.toUpdate);
            if (_this.onUpdate && _this.needsUpdate()) {
                if (_this.onUpdate()) {
                    _this.previousFilter = _this.filter;
                }
            }
        };
        if (onPanelActivate) {
            f();
        }
        else {
            this.updateTimer = setTimeout(f, FilesFilterUpdater.UPDATE_DELAY);
        }
    };
    FilesFilterUpdater.UPDATE_DELAY = 500;
    FilesFilterUpdater.MIN_CHARS_NUM = 3;
    return FilesFilterUpdater;
}());
exports.FilesFilterUpdater = FilesFilterUpdater;
var FilesListController = (function (_super) {
    __extends(FilesListController, _super);
    function FilesListController(parent, personsComponent) {
        var _this = _super.call(this, parent) || this;
        _this.personsComponent = personsComponent;
        _this.reselectIndex = null;
        _this.filesLocksMap = {};
        _this.isSearchOn = false;
        _this.isActive = true;
        _this.isPrinting = false;
        _this.isSavingAsPdf = false;
        _this.context = Common_1.ViewContext.Notes2Window;
        _this.uniqueId = "";
        _this.isSelectionChanging = false;
        _this.delayMarkAsRead = true;
        _this.asFileChooser = false;
        _this.isRefreshing = false;
        _this.selectionMode = SelectionMode.MULTI;
        _this.afterViewLoadedDeferred = pmc_mail_1.Q.defer();
        _this.ipcMode = true;
        _this.uniqueId = _this.createUniqueId();
        _this.onRefresh = function () { return pmc_mail_1.Q(); };
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.mergedCollection = _this.addComponent("mergedCollection", new pmc_mail_1.utils.collection.MergedCollection());
        _this.mergedCollection.addCollection(new pmc_mail_1.utils.collection.MutableCollection([{ id: "parent" }]));
        _this.proxyCollection = _this.addComponent("proxyCollection", new pmc_mail_1.utils.collection.ProxyCollection());
        _this.mergedCollection.addCollection(_this.proxyCollection);
        _this.filteredCollection = _this.addComponent("filteredCollection", new pmc_mail_1.utils.collection.FilteredCollection(_this.mergedCollection, _this.filterEntry.bind(_this)));
        _this.transformCollection = _this.addComponent("transformCollection", new pmc_mail_1.utils.collection.TransformCollection(_this.filteredCollection, _this.convertEntry.bind(_this)));
        _this.filesFilterUpdater = new FilesFilterUpdater();
        _this.filteredByUserCollection = _this.addComponent("filteredByUserCollection", new pmc_mail_1.utils.collection.FilteredCollection(_this.transformCollection, function (entry) {
            return FilesListController_1.meetsFilter(entry, _this.filesFilterUpdater.filter.value);
        }));
        _this.basicTooltip = _this.addComponent("basicTooltip", _this.componentFactory.createComponent("tooltip", [_this]));
        _this.basicTooltip.getContent = function (id) {
            return _this.app.localeService.i18n('plugin.notes2.component.filesList.cantDeleteShared.tooltip');
        };
        _this.locksTooltip = _this.addComponent("locksTooltip", _this.componentFactory.createComponent("userslisttooltip", [_this]));
        _this.locksTooltip.getContent = function (id) {
            var entry = _this.filteredCollection.find(function (x) { return x.id == id; });
            if (entry instanceof pmc_mail_1.mail.filetree.nt.Entry) {
                var did = entry.ref.did;
                var user = _this.filesLocksMap && (did in _this.filesLocksMap) ? _this.filesLocksMap[did] : null;
                if (!user) {
                    return;
                }
                var person = _this.session.conv2Service.personService.persons.get(user + "#" + _this.session.host);
                var data = {
                    name: person.getName(),
                    description: person.getDescription(),
                    hashmail: person.hashmail,
                    present: person.isPresent()
                };
                return JSON.stringify({ persons: [data] });
            }
            else {
                return null;
            }
        };
        _this.filesFilterUpdater.onUpdate = function () {
            if (!_this.isActive) {
                return false;
            }
            if (_this.isSearchOn != _this.filesFilterUpdater.filter.visible) {
                _this.isSearchOn = _this.filesFilterUpdater.filter.visible;
            }
            _this.filteredCollection.refresh();
            _this.filteredByUserCollection.refresh();
            return true;
        };
        _this.sortedCollection = _this.addComponent("sortedCollection", new pmc_mail_1.utils.collection.SortedCollection(_this.filteredByUserCollection, _this.sortEntry.bind(_this)));
        _this.activeCollection = _this.addComponent("activeCollection", new pmc_mail_1.utils.collection.WithMultiActiveCollection(_this.sortedCollection));
        _this.files = _this.addComponent("files", _this.componentFactory.createComponent("extlist", [_this, _this.activeCollection]));
        _this.files.ipcMode = true;
        _this.app.addEventListener(pmc_mail_1.app.common.clipboard.Clipboard.CHANGE_EVENT, _this.onClipboardChange.bind(_this));
        _this.registerChangeEvent(_this.activeCollection.changeEvent, _this.onActiveCollectionChange.bind(_this));
        _this.registerChangeEvent(_this.app.searchModel.changeEvent, _this.onFilterFiles, "multi");
        _this.app.addEventListener("update-watched-file", function (event) {
            if (!_this.session || event.hostHash != _this.session.hostHash) {
                return;
            }
            if (_this.collection) {
                var elementsToUpdate_1 = [];
                _this.collection.forEach(function (x) {
                    var id = x.id + "/";
                    if (x.id == event.fileId || event.fileId.substr(0, id.length) == id) {
                        elementsToUpdate_1.push(x);
                    }
                });
                elementsToUpdate_1.forEach(function (x) {
                    _this.collection.triggerUpdateElement(x);
                });
            }
        });
        _this.app.addEventListener("update-notes2-setting", function (event) {
            if (event.sourceUniqueId == _this.uniqueId) {
                return;
            }
            if (event.sourceProjectId != _this.fileListId && _this.notes2Plugin.viewSettings.isSettingProjectIsolated(event.setting)) {
                return;
            }
            if (event.sourceContext != _this.context && _this.notes2Plugin.viewSettings.isSettingContextIsolated(event.setting)) {
                return;
            }
            _this.callViewMethod("updateSetting", event.setting, event.value == 1);
            _this.filteredCollection.refresh();
        });
        _this.app.addEventListener("file-lock-changed", _this.onFileLockChanged.bind(_this));
        _this.registerChangeEvent(_this.conv2Service.collection.changeEvent, function (event) {
            var person = _this.personService.getMe();
            if (_this.filesInfo && _this.filesInfo.type == FilesListType.CONVERSATION && _this.filesInfo.conversation.section != null && person.username.indexOf("@") >= 0) {
                _this.callViewMethod("updateCanWrite", _this.canWrite());
            }
        });
        _this.registerChangeEvent(_this.personService.persons.changeEvent, _this.onPersonChange.bind(_this));
        _this.app.userPreferences.eventDispatcher.addEventListener("userpreferenceschange", function (event) {
            if (_this.filesInfo && _this.filesInfo.conversation) {
                var customSectionName = _this.conv2Service.sectionManager.customSectionNames.getCustomSectionName(_this.filesInfo.conversation);
                _this.callViewMethod("updateCustomSectionName", customSectionName);
            }
        });
        var tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.tasksPlugin = tasksPlugin;
        _this.taskTooltip = _this.addComponent("tasktooltip", _this.componentFactory.createComponent("tasktooltip", [_this]));
        _this.taskTooltip.getContent = function (taskId) {
            var session = _this.session;
            if (!session) {
                session = _this.app.sessionManager.getLocalSession();
            }
            return tasksPlugin ? tasksPlugin.getTaskTooltipContent(session, taskId + "") : null;
        };
        return _this;
    }
    FilesListController_1 = FilesListController;
    FilesListController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    FilesListController.prototype.init = function () {
    };
    FilesListController.prototype.onViewLoad = function () {
        this.afterViewLoadedDeferred.resolve();
    };
    FilesListController.prototype.setSection = function (section) {
        var _this = this;
        if (!section.isFileModuleEnabled()) {
            return pmc_mail_1.Q(false);
        }
        return section.getFileTree().then(function (fileTree) {
            return fileTree.refreshDeep(true).thenResolve(fileTree);
        })
            .then(function (fileTree) {
            var collection = new pmc_mail_1.utils.collection.FilteredCollection(fileTree.collection, function (x) {
                return x.path.indexOf(Common_1.FilesConst.TRASH_PATH) == -1 && !pmc_mail_1.mail.thumbs.ThumbsManager.isThumb(x.path);
            });
            var prom = pmc_mail_1.Q();
            if (section.isUserGroup()) {
                var conversation = _this.conv2Service.collection.find(function (x) { return x.section == section; });
                var fileListId = Notes2WindowController_1.Notes2WindowController.getConversationId(_this.session, conversation);
                prom = _this.setComponentData(fileListId, conversation.id, collection, {
                    type: FilesListType.CONVERSATION,
                    conversation: conversation,
                    section: null
                }, true, function () {
                    return fileTree.refreshDeep(true);
                });
            }
            else {
                var fileListId = Notes2WindowController_1.Notes2WindowController.getChannelId(_this.session, section);
                prom = _this.setComponentData(fileListId, section.getId(), collection, {
                    type: FilesListType.CHANNEL,
                    conversation: null,
                    section: section
                }, true, function () {
                    return fileTree.refreshDeep(true);
                });
            }
            return prom.then(function () {
                return true;
            });
        });
    };
    FilesListController.prototype.setComponentData = function (fileListId, destination, collection, filesInfo, editable, onRefresh, localFS, viewMode, asFileChooser, viewModeChanged) {
        var _this = this;
        if (localFS === void 0) { localFS = null; }
        if (viewMode === void 0) { viewMode = null; }
        if (asFileChooser === void 0) { asFileChooser = false; }
        if (viewModeChanged === void 0) { viewModeChanged = function () { }; }
        this.isDeletedUserSection = filesInfo.type == FilesListType.CONVERSATION && filesInfo.conversation.hasDeletedUserOnly();
        return this.notes2Plugin.loadedDeferred.promise.then(function () {
            return _this.notes2Plugin.loadSettings(_this.session, fileListId);
        })
            .then(function () {
            _this.fileListId = fileListId;
            _this.isLocal = fileListId == FilesListController_1.LOCAL_FILES;
            _this.isTrash = fileListId == FilesListController_1.TRASH_FILES;
            _this.isAll = fileListId == FilesListController_1.ALL_FILES;
            _this.isDeletedUserSection = _this.isDeletedUserSection;
            _this.destination = destination;
            _this.collection = collection;
            _this.filesInfo = filesInfo;
            _this.editable = editable && !_this.isDeletedUserSection;
            _this.onRefresh = onRefresh;
            _this.localFS = localFS;
            _this.viewMode = viewMode === null ? (_this.notes2Plugin.getSetting(_this.session, ViewSettings_1.ViewSettings.VIEW_MODE, fileListId, _this.context) == 1 ? "table" : "tiles") : viewMode;
            _this.viewModeChanged = viewModeChanged;
            _this.asFileChooser = asFileChooser;
            if (localFS) {
                _this.currentPath = localFS.currentPath;
                var found = _this.collection.find(function (x) { return Notes2Utils_1.Notes2Utils.isLocalEntry(x.parent) && x.parent.isDirectory() && x.parent.path == _this.currentPath; });
                _this.currentDir = (found.parent);
            }
            else if (_this.isTrash) {
                _this.currentPath = Common_1.FilesConst.TRASH_PATH;
                _this.currentDir = null;
            }
            else {
                _this.currentPath = _this.isAll ? "" : "/";
                _this.currentDir = _this.collection.find(function (x) { return Notes2Utils_1.Notes2Utils.isFsFileEntry(x) && x.isDirectory() && x.path == _this.currentPath; });
            }
            _this.proxyCollection.setCollection(collection);
            var firstElement = _this.activeCollection.get(0);
            _this.activeCollection.setActive(firstElement);
            if (firstElement) {
                _this.activeCollection.setSelected(firstElement);
            }
            _this.sendSelectionToView();
            _this.filteredCollection.refresh();
            _this.filesFilterUpdater.updateFilter(_this.app.searchModel.get(), true);
            _this.callViewMethod("updateViewMode", viewMode);
        });
    };
    FilesListController.prototype.onPersonChange = function (person) {
        this.callViewMethod("updatePersonPresence", person.getHashmail(), person.isPresent());
    };
    FilesListController.prototype.getModel = function () {
        var _this = this;
        var model = {
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
            isElectron: this.app.isElectronApp(),
            viewMode: this.viewMode,
            hasNoPrivateSection: this.notes2Plugin.sectionManager.getMyPrivateSection() == null,
            canWrite: this.canWrite(),
            showFilePreview: this.showFilePreview(),
            showUrlFiles: this.showUrlFiles(),
            showHiddenFiles: this.showHiddenFiles(),
            selectedIdsStr: JSON.stringify(this.getSelectedIds()),
            asFileChooser: this.asFileChooser,
            isDeletedUserSection: this.isDeletedUserSection,
        };
        if (this.filesInfo.type == FilesListType.CONVERSATION) {
            var active = this.filesInfo.conversation;
            model.hasChat = this.notes2Plugin.isChatPluginPresent();
            model.hasTasks = this.notes2Plugin.isTasksPluginPresent();
            model.persons = active.persons.map(function (x) { return Notes2Plugin_1.Notes2Plugin.getPersonModel(_this.session, x); });
        }
        else if (this.filesInfo.type == FilesListType.CHANNEL) {
            var active = this.filesInfo.section;
            model.hasChat = active && this.notes2Plugin.isChatPluginPresent() && active.isChatModuleEnabled();
            model.hasTasks = active && this.notes2Plugin.isTasksPluginPresent() && active.isKvdbModuleEnabled();
            model.channelName = active.getName();
            model.channelScope = active.getScope();
        }
        else if (this.filesInfo.type == FilesListType.OTHER) {
            var active = this.filesInfo.section;
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
            model.computerLocalName = this.app.getComputerName();
            model.systemLabel = this.app.getSystemLabel();
            if (model.computerLocalName.length == 0) {
                model.computerLocalName = this.i18n("plugin.notes2.component.filesList.filter.local");
            }
        }
        return model;
    };
    FilesListController.prototype.onViewViewModeChanged = function (viewMode) {
        this.viewMode = viewMode;
        this.notes2Plugin.saveSetting(this.session, ViewSettings_1.ViewSettings.VIEW_MODE, viewMode == "tiles" ? 0 : 1, this.fileListId, this.context);
        if (this.viewModeChanged) {
            this.viewModeChanged(this.viewMode);
        }
    };
    FilesListController.prototype.onViewAddDirToPlaylist = function () {
        if (this.fileListId == FilesListController_1.TRASH_FILES) {
            return;
        }
        var filesToAdd = [];
        var mimes = [];
        var mgr = this.app.getPlayerManager();
        var entries = [];
        entries = this.filteredCollection.list;
        for (var k in entries) {
            var entry = entries[k];
            if (entry instanceof pmc_mail_1.mail.filetree.nt.File) {
                var file = entry;
                if (file.meta.mimeType.indexOf("audio/") == 0 && !mgr.has(file.id)) {
                    filesToAdd.push({ id: file.id, name: file.name, mime: file.meta.mimeType });
                    if (mimes.indexOf(file.meta.mimeType) < 0) {
                        mimes.push(file.meta.mimeType);
                    }
                }
            }
        }
        mgr.canPlayTypes(mimes).then(function (canPlay) {
            for (var _i = 0, filesToAdd_1 = filesToAdd; _i < filesToAdd_1.length; _i++) {
                var file = filesToAdd_1[_i];
                if (canPlay[file.mime]) {
                    mgr.addToPlaylistById(file.id, file.name);
                }
            }
        });
    };
    FilesListController.prototype.onViewMarkAllAsRead = function () {
        var _this = this;
        var entries = [];
        entries = this.proxyCollection.list;
        var entriesToMark = entries.filter(function (x) { return Notes2Utils_1.Notes2Utils.isFsFileEntry(x) && _this.notes2Plugin.wasUnread(_this.session, x); });
        var sectionIds = [];
        var trash = false;
        var id = this.getSectionId();
        if (id && id != FilesListController_1.LOCAL_FILES) {
            if (id == FilesListController_1.ALL_FILES || id == FilesListController_1.TRASH_FILES) {
                this.notes2Plugin.filesSections[this.session.hostHash].forEach(function (x) {
                    sectionIds.push(x.getId());
                });
                trash = id == FilesListController_1.TRASH_FILES;
            }
            else {
                sectionIds.push(id);
            }
        }
        this.notes2Plugin.markFilesAsWatched(this.session, entriesToMark, sectionIds, trash);
    };
    FilesListController.prototype.getSectionId = function () {
        if (this.fileListId == FilesListController_1.TRASH_FILES || this.fileListId == FilesListController_1.ALL_FILES || this.fileListId == FilesListController_1.LOCAL_FILES) {
            return this.fileListId;
        }
        if (this.filesInfo.section) {
            return this.filesInfo.section.getId();
        }
        if (this.filesInfo.conversation && this.filesInfo.conversation.section) {
            return this.filesInfo.conversation.section.getId();
        }
        return null;
    };
    FilesListController.prototype.isInCurrentPath = function (x) {
        if (this.currentDir != null) {
            return x.parent == this.currentDir;
        }
        return x.parent != null && x.parent.path == this.currentPath;
    };
    FilesListController.prototype.isInCurrentPathOrDeeper = function (x) {
        if (this.currentDir != null) {
            var el = x;
            var lim = 100;
            while (el.parent && el.parent != el && --lim > 0) {
                if (el.parent == this.currentDir) {
                    return true;
                }
                el = el.parent;
            }
            return false;
        }
        return x.parent != null && x.path.indexOf(this.currentPath) == 0;
    };
    FilesListController.prototype.selectPath = function (path) {
        var _this = this;
        var entry = this.mergedCollection.find(function (x) { return x.path == path; });
        if (!entry) {
            return;
        }
        var dirPath = path.substr(0, path.lastIndexOf("/")) || "/";
        var dir = this.mergedCollection.find(function (x) { return x.path == dirPath; });
        if (!dir) {
            return;
        }
        this.moveToDirectory(dir.id);
        pmc_mail_1.Q().then(function () {
            _this.goToId(entry.id);
        });
    };
    FilesListController.prototype.filterEntry = function (x) {
        if (x.id != "parent" && !this.showUrlFiles() && this.isUrlFile(x)) {
            return false;
        }
        if (Notes2Utils_1.Notes2Utils.isLocalEntry(x) && x.hidden && !this.showHiddenFiles()) {
            return false;
        }
        if (Notes2Utils_1.Notes2Utils.isLocalEntry(x)) {
            return true;
        }
        if (Notes2Utils_1.Notes2Utils.isParentEntry(x)) {
            if (this.localFS) {
                return !this.currentDir || this.currentDir.path != "/";
            }
            return this.currentDir != null && this.currentDir.parent != null;
        }
        if (this.currentPath == "") {
            return true;
        }
        if (Notes2Utils_1.Notes2Utils.isAttachmentEntry(x)) {
            return this.currentPath == "/";
        }
        if (x == this.currentDir) {
            return false;
        }
        return this.isSearchOn ? this.isInCurrentPathOrDeeper(x) : this.isInCurrentPath(x);
    };
    FilesListController.prototype.isUrlFile = function (x) {
        if (Notes2Utils_1.Notes2Utils.isParentEntry(x)) {
            return false;
        }
        if (Notes2Utils_1.Notes2Utils.isLocalEntry(x) || Notes2Utils_1.Notes2Utils.isAttachmentEntry(x)) {
            return x.id.substr(-4) == ".url";
        }
        return x.meta && (x.meta.mimeType == "application/internet-shortcut" || x.meta.mimeType == "application/x-mswinurl");
    };
    FilesListController.prototype.hasSthToPaste = function () {
        var availableFormats = this.isAll || !this.editable ? ["file"] : ["file", "directory", "files", "directories"];
        return !this.isTrash && this.app.clipboard.hasOneOfFormats(availableFormats);
    };
    FilesListController.prototype.convertEntry = function (x) {
        if (Notes2Utils_1.Notes2Utils.isAttachmentEntry(x)) {
            var mimeType = pmc_mail_1.mail.filetree.MimeType.resolve2(x.attachment.getName(), x.attachment.getMimeType());
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
        if (Notes2Utils_1.Notes2Utils.isParentEntry(x)) {
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
        if (Notes2Utils_1.Notes2Utils.isLocalEntry(x)) {
            if (x.type == "directory") {
                return {
                    id: x.id,
                    type: x.type,
                    name: x.name,
                    mimeType: "",
                    size: x.size,
                    icon: "fa-folder",
                    modificationDate: x.mtime.getTime(),
                    renamable: LocalFS_1.LocalFS.isRenamable(x.id),
                    deletable: LocalFS_1.LocalFS.isDeletable(x.id),
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
                renamable: LocalFS_1.LocalFS.isRenamable(x.id),
                deletable: LocalFS_1.LocalFS.isDeletable(x.id),
                hasHistory: false,
                printable: this.isPrintable(x.mime),
                canSaveAsPdf: this.canSaveAsPdf(x.mime),
                modifier: null,
                unread: false,
            };
        }
        else {
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
            var bindedData = JSON.parse(this.tasksPlugin.convertBindedTaskId(x.meta.bindedElementId));
            var bindedTaskIds = bindedData.taskIds;
            var bindedTasks = [];
            for (var _i = 0, bindedTaskIds_1 = bindedTaskIds; _i < bindedTaskIds_1.length; _i++) {
                var taskId = bindedTaskIds_1[_i];
                if (this.tasksPlugin.taskExists(this.session, taskId)) {
                    bindedTasks.push({
                        taskId: taskId,
                        labelClass: this.tasksPlugin.getTaskLabelClassByTaskId(this.session, taskId),
                    });
                }
            }
            if (bindedTasks.length > 0) {
                var taskIdsStr = bindedTasks.map(function (x) { return x.taskId; }).join(",");
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
    };
    FilesListController.prototype.isPrintable = function (mime) {
        return this.app.isPrintable(mime);
    };
    FilesListController.prototype.canSaveAsPdf = function (mime) {
        return this.app.canSaveAsPdf(mime);
    };
    FilesListController.prototype.isDeletable = function (tree) {
        return tree != null && tree.section == tree.section.manager.getMyPrivateSection();
    };
    FilesListController.prototype.sortEntry = function (a, b) {
        if (a.type != b.type) {
            return a.type == "directory" ? -1 : 1;
        }
        if (a.id == "parent") {
            return -1;
        }
        if (b.id == "parent") {
            return 1;
        }
        var res = (b.modificationDate || 0) - (a.modificationDate || 0);
        return res == 0 ? b.id.localeCompare(a.id) : res;
    };
    FilesListController.prototype.getById = function (id) {
        return this.mergedCollection.find(function (x) { return x.id == id; });
    };
    FilesListController.prototype.getTreeEntry = function (id) {
        if (id == "parent") {
            var entry_1 = this.currentDir ? this.currentDir.parent : null;
            if (entry_1 == null && Notes2Utils_1.Notes2Utils.isLocalEntry(this.currentDir)) {
                return LocalFS_1.LocalFS.getParentEntry(this.currentDir);
            }
            return entry_1;
        }
        var entry = this.getById(id);
        return Notes2Utils_1.Notes2Utils.isFsFileEntry(entry) || Notes2Utils_1.Notes2Utils.isLocalEntry(entry) ? entry : null;
    };
    FilesListController.prototype.getOpenableElement = function (id) {
        if (!id) {
            return null;
        }
        if (this.localFS) {
            if (id == "parent") {
                return null;
            }
            return LocalFS_1.LocalOpenableElement.create(id);
        }
        var parsed = pmc_mail_1.mail.filetree.nt.Entry.parseId(id);
        if (parsed != null) {
            return this.sectionManager.getFileOpenableElement(id, true);
        }
        else {
            var splitted = id.split("/");
            var sinkIndex = this.sinkIndexManager.getSinkIndexById(splitted[0]);
            if (sinkIndex == null) {
                return null;
            }
            var entry = sinkIndex.getEntry(parseInt(splitted[1]));
            if (entry == null) {
                return null;
            }
            var message = entry.getMessage();
            var attachmentIndex = parseInt(splitted[2]);
            var attachment = message.attachments[attachmentIndex];
            if (attachment == null) {
                return null;
            }
            return pmc_mail_1.app.common.shelltypes.OpenableAttachment.create(attachment, true, true);
        }
    };
    FilesListController.prototype.withOpenableElement = function (id, func, endAtNull) {
        var _this = this;
        new Promise(function () { return __awaiter(_this, void 0, void 0, function () {
            var element, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.getOpenableElement(id)];
                    case 1:
                        element = _a.sent();
                        if (endAtNull !== false && element == null) {
                            return [2];
                        }
                        func(element);
                        return [3, 3];
                    case 2:
                        e_1 = _a.sent();
                        this.logErrorCallback(e_1);
                        return [3, 3];
                    case 3: return [2];
                }
            });
        }); });
    };
    FilesListController.prototype.onViewSetActiveFile = function (id) {
        this.clearSelection();
        var el = this.activeCollection.find(function (x) { return x.id == id; });
        this.activeCollection.setActive(el);
        if (el) {
            this.activeCollection.setSelected(el);
        }
        this.updateLockUnlockButtons();
        this.sendSelectionToView();
    };
    FilesListController.prototype.onViewCtrlClickFile = function (id) {
        var el = this.activeCollection.find(function (x) { return x.id == id; });
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
    };
    FilesListController.prototype.onViewSelectEntries = function (idsStr, activeId) {
        var ids = JSON.parse(idsStr);
        if (this.selectionMode == SelectionMode.SINGLE) {
            this.clearSelection();
            ids = [activeId];
        }
        var _loop_1 = function (id) {
            var idx = this_1.activeCollection.indexOfBy(function (x) { return x.id == id; });
            if (idx >= 0 && !this_1.activeCollection.isSelected(idx)) {
                var el = this_1.activeCollection.get(idx);
                if (el) {
                    this_1.activeCollection.setSelected(el);
                }
            }
        };
        var this_1 = this;
        for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
            var id = ids_1[_i];
            _loop_1(id);
        }
        var active = this.activeCollection.getBy("id", activeId);
        if (active) {
            this.activeCollection.setActive(active);
        }
        this.sendSelectionToView();
    };
    FilesListController.prototype.onViewMenuAction = function (id) {
        var _this = this;
        var newNoteIds = [
            "new-text-note-window",
            "new-mindmap-window",
            "new-audioAndVideo-note-window",
            "new-audio-note-window",
            "new-photo-note-window",
        ];
        if (newNoteIds.indexOf(id) >= 0) {
            pmc_mail_1.Q().then(function () {
                if (_this.fileListId == FilesListController_1.LOCAL_FILES) {
                    return FilesListController_1.LOCAL_FILES;
                }
                else {
                    return _this.resolveSection().then(function (section) {
                        if (section) {
                            return section.getId();
                        }
                        else {
                            return _this.fileListId;
                        }
                    });
                }
            })
                .then(function (fileListId) {
                if (id == "new-text-note-window") {
                    _this.notes2Plugin.openNewTextNoteWindow(_this.session, fileListId, _this.currentPath);
                }
                else if (id == "new-mindmap-window") {
                    _this.notes2Plugin.openNewMindmapWindow(_this.session, fileListId, _this.currentPath);
                }
                else if (id == "new-audioAndVideo-note-window") {
                    _this.notes2Plugin.openNewAudioAndVideoNoteWindow(_this.session, fileListId, _this.currentPath);
                }
                else if (id == "new-audio-note-window") {
                    _this.notes2Plugin.openNewAudioNoteWindow(_this.session, fileListId, _this.currentPath);
                }
                else if (id == "new-photo-note-window") {
                    _this.notes2Plugin.openNewPhotoNoteWindow(_this.session, fileListId, _this.currentPath);
                }
            });
        }
        else if (id == "new-directory") {
            this.createNewDirectory();
        }
        else if (id == "upload") {
            if (!this.isLocal) {
                if (this.app.isElectronApp()) {
                    this.uploadThroughImporterWindow();
                    return;
                }
                this.upload(this.currentPath);
            }
        }
    };
    FilesListController.prototype.onViewFileAction = function (action, viewMode, rowSize, selectionChangeMode) {
        if (viewMode === void 0) { viewMode = "tiles"; }
        if (rowSize === void 0) { rowSize = 5; }
        if (selectionChangeMode === void 0) { selectionChangeMode = Common_1.SelectionChangeMode.CHANGE; }
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
        else if (action == "importFiles") {
            this.openFilesImporter();
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
    };
    FilesListController.prototype.onViewOpenTask = function (entryId, taskIdsStr) {
        var _this = this;
        taskIdsStr += "";
        var resolved = this.sectionManager.resolveFileId(entryId);
        var taskId = "";
        if (taskIdsStr.indexOf(",") >= 0) {
            this.taskChooser.options.onlyTaskIds = taskIdsStr.split(",");
            this.taskChooser.refreshTasks();
            this.taskChooser.showPopup().then(function (result) {
                if (result.taskId) {
                    _this.notes2Plugin.openTask(_this.session, resolved.section.getId(), result.taskId);
                }
            });
        }
        else {
            taskId = taskIdsStr;
            this.notes2Plugin.openTask(this.session, resolved.section.getId(), taskId);
        }
    };
    FilesListController.prototype.getSection = function () {
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
    };
    FilesListController.prototype.resolveSection = function () {
        var _this = this;
        if (this.filesInfo.type == FilesListType.CONVERSATION) {
            if (this.filesInfo.conversation.section) {
                return pmc_mail_1.Q(this.filesInfo.conversation.section);
            }
            return this.conv2Service.createUserGroup(this.filesInfo.conversation.users).then(function (ss) {
                if (_this.isActive) {
                    _this.notes2Plugin.activeSinkId = _this.filesInfo.conversation.sinkIndex ? _this.filesInfo.conversation.sinkIndex.sink.id : null;
                    _this.notes2Plugin.activeSinkHostHash = _this.session.hostHash;
                }
                return ss;
            });
        }
        return pmc_mail_1.Q(this.filesInfo.section);
    };
    FilesListController.prototype.uploadFile = function (options) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.resolveSection();
        })
            .then(function (section) {
            if (section == null) {
                throw new Error("Cannot upload file, current fileList has not assigned section");
            }
            return section.uploadFile(options);
        });
    };
    FilesListController.prototype.openNewNoteWindow = function (path) {
        var _this = this;
        this.app.ioc.create(NewNoteWindowController_1.NewNoteWindowController, [this.parent, { defaultDestination: this.destination }]).then(function (win) {
            win.parent = _this.parent.getClosestNotDockedController();
            return _this.parent.openChildWindow(win).getResult().then(function (result) {
                var notificationId = _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.creatingFile"), { autoHide: false, progress: true });
                return pmc_mail_1.Q().then(function () {
                    var openAfterCreate = result.openAfterCreate;
                    if (_this.isLocal) {
                        var fullPath_1 = LocalFS_1.LocalFS.joinPath(path, result.content.getName());
                        return LocalFS_1.LocalFS.createFile(fullPath_1).then(function () {
                            return LocalFS_1.LocalOpenableElement.create(fullPath_1).then(function (el) {
                                el.save(result.content);
                                return el;
                            })
                                .then(function (el) {
                                if (openAfterCreate) {
                                    _this.app.shellRegistry.shellOpen({
                                        action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.EXTERNAL,
                                        element: el,
                                        session: _this.session
                                    });
                                }
                            });
                        });
                    }
                    else {
                        return _this.uploadFile({
                            data: result.content,
                            path: path
                        })
                            .then(function (result) {
                            if (openAfterCreate) {
                                _this.app.shellRegistry.shellOpen({
                                    action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.EXTERNAL,
                                    element: result.openableElement,
                                    session: _this.session
                                });
                            }
                        });
                    }
                })
                    .progress(function (progress) {
                    _this.notifications.progressNotification(notificationId, progress);
                })
                    .fin(function () {
                    _this.notifications.hideNotification(notificationId);
                });
            });
        })
            .fail(this.errorCallback);
    };
    FilesListController.prototype.uploadThroughImporterWindow = function () {
        this.openFilesImporter();
    };
    FilesListController.prototype.upload = function (path, content, fileNamesDeferred) {
        var _this = this;
        if (content === void 0) { content = null; }
        if (fileNamesDeferred === void 0) { fileNamesDeferred = null; }
        var getCnt;
        if (content) {
            getCnt = pmc_mail_1.Q(Array.isArray(content) ? content : [content]);
        }
        else {
            getCnt = this.app.shellRegistry.callAppMultiAction("core.upload-multi", null, this.parent.getClosestNotDockedController().nwin);
        }
        return getCnt.then(function (contents) {
            for (var _i = 0, contents_1 = contents; _i < contents_1.length; _i++) {
                var content_1 = contents_1[_i];
                _this.app.uploadService.addFile({ content: content_1, session: _this.session, destination: _this.getSectionId(), path: _this.currentPath });
            }
        });
    };
    FilesListController.prototype.processDragDrop = function (fileHandle) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var filesActions = [];
            fileHandle.forEach(function (x) {
                filesActions.push(_this.onDragDropSingle(x));
            });
            return pmc_mail_1.Q.all(filesActions);
        })
            .fail(this.errorCallback);
    };
    FilesListController.prototype.onDragDropSingle = function (fileHandle) {
        var _this = this;
        var formatter = new pmc_mail_1.utils.Formatter();
        var notificationId;
        return pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q().then(function () {
                var content = _this.app.createContent(fileHandle);
                var limit = _this.app.getMaxFileSizeLimit();
                if (content.getSize() > limit) {
                    return pmc_mail_1.Q.reject(_this.i18n("plugin.notes2.component.filesList.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit))).thenResolve(null);
                }
                else {
                    notificationId = _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.creatingFile"), { autoHide: false, progress: true });
                    return _this.uploadFile({
                        data: content,
                        path: _this.currentPath
                    });
                }
            })
                .progress(function (progress) {
                _this.notifications.progressNotification(notificationId, progress);
            })
                .fin(function () {
                _this.notifications.hideNotification(notificationId);
                _this.parent.focusMe();
            });
        })
            .fail(this.errorCallback);
    };
    FilesListController.prototype.refreshTree = function (withoutNotification, fullRefresh) {
        var _this = this;
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;
        pmc_mail_1.Q().then(function () {
            var notificationId;
            if (withoutNotification !== true) {
                notificationId = _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.actions.refreshing"), { autoHide: false, progress: true });
            }
            pmc_mail_1.Q().then(function () {
                return _this.onRefresh();
            })
                .then(function () {
                if (fullRefresh) {
                    _this.transformCollection.rebuild();
                }
            })
                .fail(_this.logErrorCallback)
                .fin(function () {
                if (withoutNotification !== true) {
                    _this.notifications.hideNotification(notificationId);
                }
            });
        }).fin(function () {
            setTimeout(function () {
                _this.isRefreshing = false;
            }, 800);
        });
    };
    FilesListController.prototype.send = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        this.withOpenableElement(active.id, function (openableElement) {
            var sourceSectionId = null;
            var sourcePath = null;
            var sourceDid = null;
            if ((openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile) && openableElement.section) {
                sourceSectionId = openableElement.section.getId();
                sourcePath = openableElement.path;
                sourceDid = openableElement.handle.ref.did;
            }
            _this.app.sendFile({
                getData: function () { return openableElement; },
                notifications: _this.notifications,
                parent: _this.parent.getClosestNotDockedController(),
                sourceSectionId: sourceSectionId,
                sourcePath: sourcePath,
                sourceDid: sourceDid,
            });
        });
    };
    FilesListController.prototype.attachToTask = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        if (active) {
            this.withOpenableElement(active.id, function (openableElement) {
                if (openableElement instanceof LocalFS_1.LocalOpenableElement) {
                    var tasksPlugin = _this.app.getComponent("tasks-plugin");
                    pmc_mail_1.window.taskchooser.TaskChooserWindowController.attachLocalFileToTask(_this.parent.getClosestNotDockedController(), _this.session, tasksPlugin, openableElement, _this.notifications);
                }
                else {
                    _this.sectionManager.getFileOpenableElement(openableElement.getElementId(), false).then(function (file) {
                        var resolved = _this.session.sectionManager.resolveFileId(file.getElementId());
                        var section = resolved.section;
                        var tasksModule = section.getKvdbModule();
                        var tasksPlugin = _this.app.getComponent("tasks-plugin");
                        if (!tasksModule || !tasksPlugin) {
                            return null;
                        }
                        pmc_mail_1.window.taskchooser.TaskChooserWindowController.attachFileToTask(_this.parent.getClosestNotDockedController(), _this.session, tasksPlugin, section, file, null);
                    });
                }
            });
        }
    };
    FilesListController.prototype.copy = function () {
        var _this = this;
        var activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        var proms = [];
        var filesToCopy = [];
        var directoriesToCopy = [];
        var _loop_2 = function (activeEntry) {
            if (activeEntry.id == "parent") {
                return "continue";
            }
            var entry = this_2.getTreeEntry(activeEntry.id);
            var local = Notes2Utils_1.Notes2Utils.isLocalEntry(entry);
            if (entry && entry.isDirectory()) {
                var clipboardEntry = {
                    entryId: entry.id,
                    cut: false,
                    local: local,
                    hostHash: local ? null : this_2.session.hostHash,
                };
                directoriesToCopy.push(clipboardEntry);
            }
            else if (entry && entry.isFile()) {
                var getEl = void 0;
                if (local) {
                    getEl = LocalFS_1.LocalOpenableElement.create(entry);
                }
                else {
                    getEl = this_2.sectionManager.getFileOpenableElement(entry.id, true);
                }
                proms.push(getEl.then(function (element) {
                    var clipboardEntry = {
                        element: element,
                        entryId: entry.id,
                        cut: false,
                        local: local,
                        hostHash: local ? null : _this.session.hostHash,
                    };
                    filesToCopy.push(clipboardEntry);
                }));
            }
            else {
                this_2.withOpenableElement(activeEntry.id, function (element) {
                    var clipboardEntry = {
                        element: element,
                        cut: false,
                        local: local,
                        hostHash: local ? null : _this.session.hostHash,
                    };
                    filesToCopy.push(clipboardEntry);
                });
            }
        };
        var this_2 = this;
        for (var _i = 0, activeEntries_1 = activeEntries; _i < activeEntries_1.length; _i++) {
            var activeEntry = activeEntries_1[_i];
            _loop_2(activeEntry);
        }
        pmc_mail_1.Q.all(proms)
            .then(function () {
            if (filesToCopy.length + directoriesToCopy.length == 0) {
                return;
            }
            if (activeEntries.length == 1) {
                if (filesToCopy.length > 0) {
                    _this.app.clipboard.set({ file: filesToCopy[0] });
                }
                else if (directoriesToCopy.length > 0) {
                    _this.app.clipboard.set({ directory: directoriesToCopy[0] });
                }
            }
            else {
                var data = {};
                if (filesToCopy.length > 0) {
                    data.files = filesToCopy;
                }
                if (directoriesToCopy.length > 0) {
                    data.directories = directoriesToCopy;
                }
                _this.app.clipboard.set(data);
            }
            _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.copied-to-clipboard"));
        })
            .fail(this.logErrorCallback);
    };
    FilesListController.prototype.cut = function () {
        var _this = this;
        var activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        var proms = [];
        var filesToCopy = [];
        var directoriesToCopy = [];
        var _loop_3 = function (activeEntry) {
            if (activeEntry.id == "parent") {
                return "continue";
            }
            var entry = this_3.getTreeEntry(activeEntry.id);
            var local = Notes2Utils_1.Notes2Utils.isLocalEntry(entry);
            if (!entry) {
                this_3.notifications.showNotification(this_3.i18n("plugin.notes2.component.filesList.notifier.cannot-cut"));
                return { value: void 0 };
            }
            if (entry.isDirectory()) {
                var clipboardEntry = {
                    entryId: entry.id,
                    cut: true,
                    local: local,
                    hostHash: local ? null : this_3.session.hostHash,
                };
                directoriesToCopy.push(clipboardEntry);
            }
            else if (entry.isFile()) {
                var getEl = void 0;
                if (local) {
                    getEl = LocalFS_1.LocalOpenableElement.create(entry);
                }
                else {
                    getEl = this_3.sectionManager.getFileOpenableElement(entry.id, true);
                }
                proms.push(getEl.then(function (element) {
                    var clipboardEntry = {
                        element: element,
                        entryId: entry.id,
                        cut: true,
                        local: local,
                        hostHash: local ? null : _this.session.hostHash,
                    };
                    filesToCopy.push(clipboardEntry);
                }));
            }
        };
        var this_3 = this;
        for (var _i = 0, activeEntries_2 = activeEntries; _i < activeEntries_2.length; _i++) {
            var activeEntry = activeEntries_2[_i];
            var state_1 = _loop_3(activeEntry);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        pmc_mail_1.Q.all(proms)
            .then(function () {
            if (filesToCopy.length + directoriesToCopy.length == 0) {
                return;
            }
            if (activeEntries.length == 1) {
                if (filesToCopy.length > 0) {
                    _this.app.clipboard.set({ file: filesToCopy[0] });
                }
                else if (directoriesToCopy.length > 0) {
                    _this.app.clipboard.set({ directory: directoriesToCopy[0] });
                }
            }
            else {
                var data = {};
                if (filesToCopy.length > 0) {
                    data.files = filesToCopy;
                }
                if (directoriesToCopy.length > 0) {
                    data.directories = directoriesToCopy;
                }
                _this.app.clipboard.set(data);
            }
            _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.cut-to-clipboard"));
        })
            .fail(this.logErrorCallback);
    };
    FilesListController.prototype.createNewDirectory = function () {
        var _this = this;
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
            .then(function (result) {
            if (result.result != "ok" || !result.value) {
                return;
            }
            return _this.createNewDirectoryWithName(result.value);
        });
    };
    FilesListController.prototype.createNewDirectoryWithName = function (dirName, notificationId) {
        var _this = this;
        if (!this.currentDir && this.filesInfo.type != FilesListType.CONVERSATION) {
            return;
        }
        if (!this.currentDir) {
            return pmc_mail_1.Q().then(function () {
                return _this.tryCreateConversation(function () { return _this.createNewDirectoryWithName(dirName, notificationId); });
            })
                .fail(this.errorCallback)
                .fin(function () {
                _this.notifications.hideNotification(notificationId);
            });
        }
        var exists = false;
        if (Notes2Utils_1.Notes2Utils.isLocalEntry(this.currentDir)) {
            var path_1 = LocalFS_1.LocalFS.joinPath(this.currentDir.path, dirName);
            if (LocalFS_1.LocalFS.exists(path_1)) {
                exists = true;
            }
        }
        else {
            for (var name_1 in this.currentDir.entries) {
                if (name_1 == dirName) {
                    exists = true;
                }
            }
        }
        if (exists) {
            this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.dirAlreadyExists", dirName));
            return;
        }
        notificationId = notificationId != null ? notificationId : this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.creating-directory"), { autoHide: false, progress: true });
        var path = pmc_mail_1.mail.filetree.nt.Helper.resolvePath(this.currentDir.path, dirName);
        return pmc_mail_1.Q().then(function () {
            if (Notes2Utils_1.Notes2Utils.isLocalEntry(_this.currentDir)) {
                return LocalFS_1.LocalFS.createDir(LocalFS_1.LocalFS.joinPath(_this.currentDir.path, dirName));
            }
            else {
                return _this.currentDir.tree.fileSystem.mkdir(path);
            }
        })
            .then(function () {
            pmc_mail_1.Q().then(function () {
                if (Notes2Utils_1.Notes2Utils.isLocalEntry(_this.currentDir)) {
                    return;
                }
                var section = _this.currentDir.tree.section;
                if (section == null || section.isPrivate() || !section.hasChatModule()) {
                    return;
                }
                var chatModule = _this.currentDir.tree.section.getChatModule();
                return chatModule.sendCreateDirectoryMessage(path);
            }).fail(function (e) {
                _this.logError(e);
            });
        })
            .progress(function (progress) {
            _this.notifications.progressNotification(notificationId, progress);
        })
            .fail(this.errorCallback)
            .fin(function () {
            _this.notifications.hideNotification(notificationId);
        });
    };
    FilesListController.prototype.resolveUploadResultToId = function (result) {
        if (result.fileResult) {
            return result.fileResult.entryId;
        }
        else if (result.mailResult) {
            return pmc_mail_1.app.common.shelltypes.OpenableAttachment.getElementId(result.mailResult.receiver.sink.id, result.mailResult.source.serverId, 0);
        }
        return null;
    };
    FilesListController.prototype.goToResult = function (result) {
        this.goToIdEx(this.resolveUploadResultToId(result));
    };
    FilesListController.prototype.goToIdEx = function (id) {
        var _this = this;
        if (!this.goToId(id)) {
            setTimeout(function () {
                _this.goToId(id);
            }, 200);
        }
    };
    FilesListController.prototype.goToId = function (id) {
        var ele = this.activeCollection.find(function (x) { return x.id == id; });
        if (ele) {
            this.clearSelection();
            this.activeCollection.setActive(ele);
            this.activeCollection.setSelected(ele);
            this.sendSelectionToView();
            return true;
        }
        return false;
    };
    FilesListController.prototype.paste = function () {
        var _this = this;
        if (this.isTrash) {
            return;
        }
        pmc_mail_1.Q().then(function () {
            return _this.app.getClipboardElementToPaste([
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE,
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES,
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORY,
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORIES,
            ], [
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES,
            ]);
        }).then(function (elementToPaste) {
            if (!elementToPaste) {
                return;
            }
            if (elementToPaste.source == "system") {
                var pasteFromOsStr = elementToPaste.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES];
                var pasteFromOs = JSON.parse(pasteFromOsStr).map(function (x) {
                    if (x.data && x.data.type == "Buffer" && x.data.data) {
                        x.data = new Buffer(x.data.data);
                    }
                    return x;
                });
                var fileElements_1 = pasteFromOs.filter(function (x) { return !!x.path; });
                var imgElements_1 = pasteFromOs.filter(function (x) { return !!x.data; });
                pmc_mail_1.Q().then(function () {
                    var prom = pmc_mail_1.Q();
                    if (fileElements_1.length > 0) {
                        var _loop_4 = function (file) {
                            var fileName = file.path;
                            if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                                fileName = fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                            }
                            var data = file.data ? file.data : require("fs").readFileSync(file.path);
                            prom = prom.then(function () { return _this.upload(_this.currentPath, pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)); });
                        };
                        for (var _i = 0, fileElements_2 = fileElements_1; _i < fileElements_2.length; _i++) {
                            var file = fileElements_2[_i];
                            _loop_4(file);
                        }
                    }
                    else {
                        var file_1 = imgElements_1[0];
                        var formatNum = function (x) {
                            var p = x < 10 ? "0" : "";
                            return "" + p + x;
                        };
                        var now = new Date();
                        var y = now.getFullYear();
                        var m = formatNum(now.getMonth() + 1);
                        var d = formatNum(now.getDate());
                        var h = formatNum(now.getHours());
                        var i = formatNum(now.getMinutes());
                        var s = formatNum(now.getSeconds());
                        var r = Math.floor(Math.random() * 10000);
                        var ext = file_1.mime.split("/")[1];
                        var fileName_1 = "" + y + m + d + "-" + h + i + s + "-" + r + "." + ext;
                        prom = prom.then(function () { return _this.upload(_this.currentPath, pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(file_1.data, file_1.mime, fileName_1)); });
                    }
                    return prom;
                });
            }
            else if (elementToPaste.source == "privmx" && pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE in elementToPaste.data) {
                _this.pasteFile(_this.app.clipboard.getFormat("file"));
            }
            else if (elementToPaste.source == "privmx" && pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORY in elementToPaste.data) {
                _this.pasteDirectory(_this.app.clipboard.getFormat("directory"));
            }
            else if (elementToPaste.source == "privmx" && (pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES in elementToPaste.data || pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORIES in elementToPaste.data)) {
                var notificationId_1;
                var prom_1 = pmc_mail_1.Q();
                return pmc_mail_1.Q().then(function () {
                    notificationId_1 = _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.pasting-from-clipboard"), { autoHide: false, progress: true });
                    if (pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES in elementToPaste.data) {
                        var files = _this.app.clipboard.getFormat("files");
                        var _loop_5 = function (file) {
                            prom_1 = prom_1.then(function () {
                                return _this.pasteFile(file, false);
                            });
                        };
                        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
                            var file = files_1[_i];
                            _loop_5(file);
                        }
                    }
                    if (pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_DIRECTORIES in elementToPaste.data) {
                        var directories = _this.app.clipboard.getFormat("directories");
                        var _loop_6 = function (directory) {
                            prom_1 = prom_1.then(function () {
                                return _this.pasteDirectory(directory, null, false);
                            });
                        };
                        for (var _a = 0, directories_1 = directories; _a < directories_1.length; _a++) {
                            var directory = directories_1[_a];
                            _loop_6(directory);
                        }
                    }
                    return prom_1;
                })
                    .fin(function () {
                    _this.notifications.hideNotification(notificationId_1);
                });
            }
        });
    };
    FilesListController.prototype.uploadFiles = function (files) {
        var contents = files.map(function (x) { return pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(x.buffer, x.mime, x.fileName); });
        return this.upload(this.currentPath, contents);
    };
    FilesListController.prototype.pasteFile = function (data, showNotifications) {
        var _this = this;
        if (showNotifications === void 0) { showNotifications = true; }
        if (!data || !data.element) {
            return pmc_mail_1.Q();
        }
        if (data.cut) {
            this.app.clipboard.clear();
        }
        var fromLocal = data.local;
        var toLocal = Notes2Utils_1.Notes2Utils.isLocalEntry(this.currentDir);
        var notificationId = (showNotifications && fromLocal == toLocal) ? this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.pasting-from-clipboard"), { autoHide: false, progress: true }) : null;
        var prom = pmc_mail_1.Q();
        if (fromLocal && toLocal) {
            var el = data.element;
            prom = this.copyFileLocalToLocal(el.entry.id, this.currentPath, data.cut).then(function (id) {
                _this.goToIdEx(id);
            });
        }
        if (fromLocal && !toLocal) {
            var el_1 = data.element;
            var def_1 = pmc_mail_1.Q.defer();
            prom = this.upload(this.currentPath, el_1.content, def_1).then(function () {
                def_1.promise.then(function (ids) {
                    if (ids.length > 0) {
                        _this.goToIdEx(ids[0]);
                    }
                });
                if (data.cut) {
                    return LocalFS_1.LocalFS.deleteFile(el_1.getElementId());
                }
            });
        }
        if (!fromLocal && toLocal) {
            prom = this.copyFileRemoteToLocal(data.element, this.currentPath, data.cut).then(function (id) {
                _this.goToIdEx(id);
            });
        }
        if (!fromLocal && !toLocal) {
            prom = prom.then(function () {
                if (data.entryId && data.cut) {
                    var resolved_1 = _this.sectionManager.resolveFileId(data.entryId);
                    return _this.uploadFile({
                        data: data.element,
                        path: _this.currentPath,
                        noMessage: _this.currentDir != null && resolved_1 && resolved_1.section == _this.currentDir.tree.section,
                        elementToMove: data.entryId,
                        statusCallback: _this.onMultiStatus.bind(_this)
                    })
                        .then(function (result) {
                        if (!result.moveResult || !result.moveResult.success) {
                            _this.parent.alert(_this.i18n("plugin.notes2.component.filesList.notifier.copied-but-not-moved"));
                            _this.logError(result.moveResult.error);
                        }
                        return result;
                    })
                        .then(function (result) {
                        var destinationSection = _this.getSection();
                        var sourceSection = resolved_1.section;
                        var fName = resolved_1.path.split("/").slice(-1)[0];
                        var newPath = pmc_mail_1.mail.filetree.nt.Helper.resolvePath(_this.currentPath, fName);
                        return pmc_mail_1.Q.all([
                            _this.notes2Plugin.sendMoveFileMessage(sourceSection, resolved_1.path, newPath, sourceSection, destinationSection),
                            _this.notes2Plugin.sendMoveFileMessage(destinationSection, resolved_1.path, newPath, sourceSection, destinationSection),
                        ])
                            .thenResolve(result);
                    });
                }
                return _this.uploadFile({
                    data: data.element,
                    path: _this.currentPath,
                    copyFrom: data.entryId,
                    statusCallback: _this.onMultiStatus.bind(_this),
                    fileOptions: {
                        metaUpdater: data.entryId ? undefined : function (meta) {
                            meta.createDate = new Date().getTime(),
                                meta.modifiedDate = new Date().getTime();
                        }
                    }
                });
            })
                .then(function (res) {
                _this.goToResult(res);
            })
                .progress(function (progress) {
                if (notificationId !== null) {
                    _this.notifications.progressNotification(notificationId, progress);
                }
            });
        }
        return prom.fail(function (e) {
            if (data.cut) {
                _this.app.clipboard.set(data);
            }
            if (e != "not-performed") {
                _this.errorCallback(e);
            }
        })
            .fin(function () {
            if (notificationId !== null) {
                _this.notifications.hideNotification(notificationId);
            }
        });
    };
    FilesListController.prototype.copyFileLocalToLocal = function (srcPath, dstDir, cut) {
        if (cut === void 0) { cut = false; }
        var fileName = LocalFS_1.LocalFS.getFileName(srcPath);
        if (cut && srcPath == LocalFS_1.LocalFS.joinPath(dstDir, fileName)) {
            cut = false;
        }
        var dstPath = LocalFS_1.LocalFS.getAltPath(dstDir, fileName);
        if (cut) {
            return LocalFS_1.LocalFS.move(srcPath, dstPath, false).then(function () {
                return dstPath;
            });
        }
        return LocalFS_1.LocalFS.copyFile(srcPath, dstPath, false).then(function () {
            return dstPath;
        });
    };
    FilesListController.prototype.copyDirLocalToLocal = function (srcPath, dstDir, cut) {
        if (cut === void 0) { cut = false; }
        if ((dstDir + "/").indexOf(srcPath + "/") >= 0) {
            return pmc_mail_1.Q.reject("Recursion is not allowed");
        }
        var dirName = LocalFS_1.LocalFS.getFileName(srcPath);
        if (cut && srcPath == LocalFS_1.LocalFS.joinPath(dstDir, dirName)) {
            cut = false;
        }
        var dstPath = LocalFS_1.LocalFS.getAltPath(dstDir, dirName);
        if (cut) {
            return LocalFS_1.LocalFS.move(srcPath, dstPath, false).then(function () {
                return dstPath;
            });
        }
        return LocalFS_1.LocalFS.copyDir(srcPath, dstPath, false).then(function () {
            return dstPath;
        });
    };
    FilesListController.prototype.copyFileRemoteToLocal = function (srcEl, dstDir, cut) {
        var _this = this;
        if (cut === void 0) { cut = false; }
        var fileName = LocalFS_1.LocalFS.getFileName(srcEl.getName());
        var dstPath = LocalFS_1.LocalFS.getAltPath(dstDir, fileName);
        var deferred = pmc_mail_1.Q.defer();
        LocalFS_1.LocalFS.createFile(dstPath).then(function () {
            _this.withOpenableElement(dstPath, function (dst) {
                dst.save(srcEl.content).then(function () {
                    if (cut) {
                        pmc_mail_1.Q().then(function () {
                            return _this.dispatchEventResult({ type: "fileremoved" });
                        })
                            .then(function () {
                            if (srcEl instanceof pmc_mail_1.app.common.shelltypes.OpenableFile) {
                                srcEl.fileSystem.removeFile(srcEl.path);
                            }
                        })
                            .then(function () {
                            deferred.resolve(dstPath);
                        })
                            .fail(function (e) {
                            _this.logError(e);
                        });
                    }
                    else {
                        deferred.resolve(dstPath);
                    }
                }).fail(function (err) { deferred.reject(err); });
            });
        }).fail(function (err) { deferred.reject(err); });
        return deferred.promise;
    };
    FilesListController.prototype.onMultiStatus = function (result, multi) {
        var _this = this;
        if (result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.DESTINATION_CANNOT_BE_CHILD_OF_SOURCE) {
            this.parent.alert(this.i18n("plugin.notes2.component.filesList.error.destinationChildOfSource"));
            multi.finish();
            return;
        }
        if (result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.SOURCE_EQUALS_DESTINATION) {
            if (result.operation.type == pmc_mail_1.privfs.fs.file.multi.OperationType.MOVE) {
                multi.finish();
                return;
            }
            var nr = new pmc_mail_1.privfs.fs.file.entry.SimpleNameResolver(result.source.type == "file", result.source.name);
            var newName = nr.getCurrentName();
            while (result.source.elementsInDir.indexOf(newName) != -1) {
                newName = nr.getNextName();
            }
            result.operation.destination.path = pmc_mail_1.mail.filetree.nt.Helper.resolvePath(result.source.dirPath, newName);
            multi.addOperation(result.operation);
            return;
        }
        if (result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE ||
            result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORIES_MERGE ||
            result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORY_OVERWRITE_BY_FILE ||
            result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE_BY_DIRECTORY) {
            return this.app.ioc.create(FileConflictResolverWindowController_1.FileConflictResolverWindowController, [this.parent, FileConflictResolverWindowController_1.FileConflictResolverWindowController.convertModel(result, this.app)]).then(function (win) {
                win.parent = _this.parent.getClosestNotDockedController();
                return _this.parent.openChildWindow(win).getPromise().then(function (r) {
                    if (r.abort) {
                        return multi.finish();
                    }
                    result.operation.conflictBehavior = result.operation.conflictBehavior || {};
                    var cb = r.forAll ? multi.conflictBehavior : result.operation.conflictBehavior;
                    if (result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE) {
                        cb.overwriteFile = r.behaviour;
                    }
                    else if (result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORIES_MERGE) {
                        cb.mergeDirectories = r.behaviour;
                    }
                    else if (result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORY_OVERWRITE_BY_FILE) {
                        cb.overwriteDirectoryByFile = r.behaviour;
                    }
                    else if (result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE_BY_DIRECTORY) {
                        cb.overwriteFileByDirectory = r.behaviour;
                    }
                    multi.addOperation(result.operation);
                });
            });
        }
        var logStates = [
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.START,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.FILE_CREATE_SUCCESS,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.DIRECTORY_CREATE_SUCCESS,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.FILE_MOVE_SUCCESS,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.DIRECTORY_MOVE_SUCCESS,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.FILE_REMOVE_SUCCESS,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.DIRECTORY_REMOVE_SUCCESS,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.FILE_OMITTED,
            pmc_mail_1.privfs.fs.file.multi.OperationStatus.DIRECTORY_OMITTED
        ];
        if (logStates.indexOf(result.status) == -1) {
            if (result.error) {
                this.logError(result.error);
            }
            return this.app.ioc.create(FileErrorWindowController_1.FileErrorWindowController, [this.parent, FileErrorWindowController_1.FileErrorWindowController.convertModel(result)]).then(function (win) {
                return _this.parent.openChildWindow(win).getPromise().then(function (r) {
                    if (r.abort) {
                        return multi.finish();
                    }
                    if (r.retry) {
                        multi.addOperation(result.operation);
                    }
                    else {
                        return _this.onMultiStatus({
                            status: pmc_mail_1.privfs.fs.file.multi.OperationStatus.FILE_OMITTED,
                            operation: result.operation,
                            error: result.error,
                            removed: result.removed,
                            data: result.data
                        }, multi);
                    }
                });
            });
        }
    };
    FilesListController.prototype.tryCreateConversation = function (onCreate) {
        var _this = this;
        if (this.filesInfo.type != FilesListType.CONVERSATION) {
            return pmc_mail_1.Q(null);
        }
        return pmc_mail_1.Q().then(function () {
            if (_this.filesInfo.conversation.section) {
                return _this.filesInfo.conversation.section;
            }
            return _this.conv2Service.createUserGroup(_this.filesInfo.conversation.users);
        })
            .then(function () {
            if (_this.isActive) {
                _this.notes2Plugin.activeSinkId = _this.filesInfo.conversation.sinkIndex ? _this.filesInfo.conversation.sinkIndex.sink.id : null;
                _this.notes2Plugin.activeSinkHostHash = _this.session.hostHash;
            }
            if (!_this.filesInfo.conversation.section) {
                return;
            }
            return _this.filesInfo.conversation.prepareFilesCollection().then(function () {
                if (_this.filesInfo.conversation.fileTree) {
                    _this.currentPath = "/";
                    _this.currentDir = _this.filesInfo.conversation.fileTree.root;
                    return onCreate();
                }
            });
        });
    };
    FilesListController.prototype.pasteDirectory = function (data, notificationId, showNotifications) {
        var _this = this;
        if (showNotifications === void 0) { showNotifications = true; }
        if (!data || !data.entryId) {
            return;
        }
        if (!this.currentDir && this.filesInfo.type != FilesListType.CONVERSATION) {
            return;
        }
        if (showNotifications) {
            notificationId = notificationId != null ? notificationId : this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.pasting-from-clipboard"), { autoHide: false, progress: true });
        }
        if (!this.currentDir) {
            return pmc_mail_1.Q().then(function () {
                return _this.tryCreateConversation(function () { return _this.pasteDirectory(data, notificationId); });
            })
                .fail(this.errorCallback)
                .fin(function () {
                _this.notifications.hideNotification(notificationId);
            });
        }
        var fromLocal = data.local;
        var toLocal = Notes2Utils_1.Notes2Utils.isLocalEntry(this.currentDir);
        if (fromLocal && toLocal) {
            return this.copyDirLocalToLocal(data.entryId, this.currentPath, data.cut).then(function (id) {
                _this.goToIdEx(id);
            })
                .fail(this.errorCallback)
                .fin(function () {
                _this.notifications.hideNotification(notificationId);
            });
        }
        var isUpload = fromLocal && !toLocal;
        var isDownload = !fromLocal && toLocal;
        var isRemoteCopy = !fromLocal && !toLocal;
        var mgr = this.app.sessionManager;
        var fromSession = (fromLocal || !mgr.isSessionExistsByHostHash(data.hostHash) ? mgr.getLocalSession() : mgr.getSessionByHostHash(data.hostHash)) || mgr.getLocalSession();
        var toSession = (toLocal ? mgr.getLocalSession() : this.session) || mgr.getLocalSession();
        var isCrossSessionCopy = isRemoteCopy && fromSession.host != toSession.host;
        var toResolve = isUpload ? this.currentDir.id : data.entryId;
        var toResolveSession = isUpload ? toSession : fromSession;
        var resolved = toResolveSession.sectionManager.resolveFileId(toResolve);
        return pmc_mail_1.Q().then(function () {
            return resolved.section.getFileSystem();
        })
            .then(function (srcFs) {
            if (fromLocal || toLocal) {
                return pmc_mail_1.Q().then(function () {
                    return resolved.section.getFileSystem();
                }).then(function (srcFs) {
                    if (toLocal) {
                        return _this.downloadDir(srcFs, resolved.path, _this.currentPath);
                    }
                    else {
                        return _this.uploadDir(srcFs, data.entryId, resolved.path);
                    }
                }).then(function (name) {
                    _this.goToIdEx(toLocal ? name : (_this.currentDir.id.split("/")[0] + name));
                    if (data.cut) {
                        if (toLocal) {
                            return srcFs.shell.remove(resolved.path);
                        }
                        else {
                            return LocalFS_1.LocalFS.deleteDir(data.entryId);
                        }
                    }
                });
            }
            else if (!isCrossSessionCopy) {
                var srcName = pmc_mail_1.mail.filetree.Path.parsePath(resolved.path).name.original;
                var dstPath = pmc_mail_1.mail.filetree.nt.Helper.resolvePath(_this.currentDir.path, srcName);
                if (data.cut) {
                    return srcFs.shell.move(resolved.path, dstPath, null, null, _this.onMultiStatus.bind(_this), _this.currentDir.tree.fileSystem.shell);
                }
                return srcFs.shell.copy(resolved.path, dstPath, null, null, _this.onMultiStatus.bind(_this), _this.currentDir.tree.fileSystem.shell);
            }
            else {
                var srcPath_1 = pmc_mail_1.mail.filetree.Path.parsePath(resolved.path);
                var dstPath_1 = _this.currentDir.path;
                return _this.getSection().getFileSystem().then(function (dstFs) {
                    return _this.copyDirBetweenFileSystems(srcFs, dstFs, srcPath_1.path, dstPath_1);
                })
                    .then(function () {
                    if (data.cut) {
                        return srcFs.shell.remove(resolved.path);
                    }
                });
            }
        })
            .progress(function (progress) {
            _this.notifications.progressNotification(notificationId, progress);
        })
            .fail(this.errorCallback)
            .fin(function () {
            _this.notifications.hideNotification(notificationId);
        });
    };
    FilesListController.prototype.downloadDir = function (fs, src, dst) {
        var _this = this;
        var dirName = LocalFS_1.LocalFS.getFileName(src);
        var finalPath = "";
        dst = LocalFS_1.LocalFS.getAltPath(dst, dirName);
        finalPath = dst;
        return LocalFS_1.LocalFS.createDir(dst).then(function () {
            return fs.list(src).then(function (entries) {
                var prom = pmc_mail_1.Q("");
                entries.forEach(function (entry) {
                    if (entry.isDirectory()) {
                        prom = prom.then(function () {
                            return _this.downloadDir(fs, LocalFS_1.LocalFS.joinPath(src, entry.name), dst);
                        });
                    }
                    else if (entry.isFile()) {
                        prom = prom.then(function () {
                            return LocalFS_1.LocalFS.createFile(LocalFS_1.LocalFS.joinPath(dst, entry.name));
                        })
                            .then(function () {
                            return fs.read(LocalFS_1.LocalFS.joinPath(src, entry.name));
                        }).then(function (cnt) {
                            return LocalFS_1.LocalOpenableElement.create(LocalFS_1.LocalFS.joinPath(dst, entry.name)).then(function (el) {
                                el.save(cnt);
                                return "";
                            });
                        });
                    }
                });
                return prom;
            });
        }).then(function () {
            return finalPath;
        });
    };
    FilesListController.prototype.uploadDir = function (fs, src, dst) {
        var _this = this;
        var dirName = LocalFS_1.LocalFS.getFileName(src);
        var finalPath = "";
        return pmc_mail_1.Q().then(function () {
            return _this.safeMkdirRemote(dst, dirName, fs);
        })
            .then(function (dst) {
            finalPath = dst;
            return LocalFS_1.LocalFS.listEntries(src).then(function (entries) {
                var prom = pmc_mail_1.Q("");
                entries.forEach(function (entryName) {
                    var entry = LocalFS_1.LocalFS.getEntry(entryName);
                    if (entry) {
                        if (entry.isDirectory()) {
                            prom = prom.then(function () {
                                return _this.uploadDir(fs, LocalFS_1.LocalFS.joinPath(src, entry.name), dst);
                            });
                        }
                        else if (entry.isFile()) {
                            prom = prom.then(function () {
                                return LocalFS_1.LocalOpenableElement.create(entry.path);
                            }).then(function (el) {
                                return fs.write(LocalFS_1.LocalFS.joinPath(dst, entry.name), pmc_mail_1.privfs.fs.file.Mode.READ_WRITE_CREATE, el.content).then(function () {
                                    return "";
                                });
                            });
                        }
                    }
                });
                return prom;
            });
        }).then(function () {
            return finalPath;
        });
    };
    FilesListController.prototype.copyDirBetweenFileSystems = function (srcFs, dstFs, srcPath, dstPath) {
        var _this = this;
        var dirName = srcPath.replace(/\\/g, "/").split("/").filter(function (x) { return !!x; }).reverse()[0];
        var finalPath = "";
        return pmc_mail_1.Q().then(function () {
            return _this.safeMkdirRemote(dstPath, dirName, dstFs);
        })
            .then(function (dst) {
            finalPath = dst;
            return srcFs.list(srcPath).then(function (entries) {
                var prom = pmc_mail_1.Q("");
                entries.forEach(function (entry) {
                    if (entry.isDirectory()) {
                        prom = prom.then(function () {
                            return _this.copyDirBetweenFileSystems(srcFs, dstFs, srcPath + "/" + entry.name, dst);
                        });
                    }
                    else if (entry.isFile()) {
                        prom = prom.then(function () {
                            return srcFs.read(srcPath + "/" + entry.name);
                        }).then(function (el) {
                            return dstFs.write(dst + "/" + entry.name, pmc_mail_1.privfs.fs.file.Mode.READ_WRITE_CREATE, el);
                        })
                            .thenResolve("");
                    }
                });
                return prom;
            });
        })
            .then(function () {
            return finalPath;
        });
    };
    FilesListController.prototype.safeMkdirRemote = function (dstDir, fileName, fs) {
        var dstPath = LocalFS_1.LocalFS.joinPath(dstDir, fileName);
        var ext = LocalFS_1.LocalFS.getExt(fileName);
        var bn = LocalFS_1.LocalFS.getFileName(fileName, ext);
        var deferred = pmc_mail_1.Q.defer();
        var f = function (id) {
            if (id > 999) {
                return;
            }
            fs.mkdir(dstPath).then(function (x) {
                if (x) {
                    deferred.resolve(dstPath);
                }
                else {
                    dstPath = LocalFS_1.LocalFS.joinPath(dstDir, bn + "(" + (id) + ")" + ext);
                    f(id + 1);
                }
            });
        };
        f(1);
        return deferred.promise;
    };
    FilesListController.prototype.moveCursorUp = function (viewMode, rowSize, selectionChangeMode) {
        if (viewMode === void 0) { viewMode = "tiles"; }
        if (rowSize === void 0) { rowSize = 5; }
        if (selectionChangeMode === void 0) { selectionChangeMode = Common_1.SelectionChangeMode.CHANGE; }
        this.moveCursorByDelta(viewMode == "table" ? -1 : -rowSize, selectionChangeMode);
    };
    FilesListController.prototype.moveCursorDown = function (viewMode, rowSize, selectionChangeMode) {
        if (viewMode === void 0) { viewMode = "tiles"; }
        if (rowSize === void 0) { rowSize = 5; }
        if (selectionChangeMode === void 0) { selectionChangeMode = Common_1.SelectionChangeMode.CHANGE; }
        this.moveCursorByDelta(viewMode == "table" ? 1 : rowSize, selectionChangeMode);
    };
    FilesListController.prototype.moveCursorLeft = function (viewMode, _rowSize, selectionChangeMode) {
        if (viewMode === void 0) { viewMode = "tiles"; }
        if (_rowSize === void 0) { _rowSize = 5; }
        if (selectionChangeMode === void 0) { selectionChangeMode = Common_1.SelectionChangeMode.CHANGE; }
        if (viewMode != "tiles") {
            return;
        }
        this.moveCursorByDelta(-1, selectionChangeMode);
    };
    FilesListController.prototype.moveCursorRight = function (viewMode, _rowSize, selectionChangeMode) {
        if (viewMode === void 0) { viewMode = "tiles"; }
        if (_rowSize === void 0) { _rowSize = 5; }
        if (selectionChangeMode === void 0) { selectionChangeMode = Common_1.SelectionChangeMode.CHANGE; }
        if (viewMode != "tiles") {
            return;
        }
        this.moveCursorByDelta(1, selectionChangeMode);
    };
    FilesListController.prototype.moveCursorByDelta = function (delta, selectionChangeMode) {
        if (selectionChangeMode === void 0) { selectionChangeMode = Common_1.SelectionChangeMode.CHANGE; }
        if (selectionChangeMode == Common_1.SelectionChangeMode.CHANGE || this.activeCollection.selectedIndexes.length == 0) {
            var index = this.activeCollection.active ? (this.activeCollection.active.index + delta) : 0;
            index = Math.min(Math.max(index, 0), this.activeCollection.size() - 1);
            this.clearSelection();
            var el = this.activeCollection.get(index);
            if (el) {
                this.activeCollection.setSelected(el);
            }
            this.activeCollection.setActive(this.activeCollection.get(index));
        }
        else if (selectionChangeMode == Common_1.SelectionChangeMode.SHRINK && this.activeCollection.selectedIndexes.length == 1) {
        }
        else {
            var shrink = selectionChangeMode == Common_1.SelectionChangeMode.SHRINK;
            var selectedIndexes = this.activeCollection.selectedIndexes.slice().sort(function (a, b) { return a - b; });
            var indexes = [];
            var firstIndex = selectedIndexes[0];
            var lastIndex = selectedIndexes[selectedIndexes.length - 1];
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
                    for (var i = delta; i < 0; ++i) {
                        indexes.push(shrink ? (lastIndex + i + 1) : (firstIndex + i));
                    }
                }
                else if (delta > 0) {
                    for (var i = delta; i > 0; --i) {
                        indexes.push(shrink ? (firstIndex + i - 1) : (lastIndex + i));
                    }
                }
            }
            for (var _i = 0, indexes_1 = indexes; _i < indexes_1.length; _i++) {
                var idx = indexes_1[_i];
                var el = this.activeCollection.get(idx);
                if (el) {
                    if (selectionChangeMode == Common_1.SelectionChangeMode.EXTEND) {
                        this.activeCollection.setSelected(el);
                    }
                    else {
                        this.activeCollection.deselect(el);
                    }
                }
            }
            var newSelectedIndexes = this.activeCollection.selectedIndexes.slice().sort(function (a, b) { return a - b; });
            var newFirstIndex = newSelectedIndexes[0];
            var newLastIndex = newSelectedIndexes[newSelectedIndexes.length - 1];
            var activeIndex = ((delta < 0 && !shrink) || (delta > 0 && shrink)) ? newFirstIndex : newLastIndex;
            var activeEl = this.activeCollection.get(activeIndex);
            if (activeEl) {
                this.activeCollection.setActive(activeEl);
            }
        }
        this.sendSelectionToView();
    };
    FilesListController.prototype.moveToDirectory = function (id) {
        var _this = this;
        var entry = this.getTreeEntry(id);
        if (!entry || !entry.isDirectory()) {
            return;
        }
        var toSelectId = id == "parent" ? (this.currentDir ? this.currentDir.id : null) : "parent";
        this.currentPath = entry.path;
        this.currentDir = this.isTrash && this.currentPath == Common_1.FilesConst.TRASH_PATH ? null : entry;
        this.preventReselect = true;
        var prom = pmc_mail_1.Q();
        if (Notes2Utils_1.Notes2Utils.isLocalEntry(entry)) {
            this.mergedCollection.removeCollection(this.proxyCollection);
            prom = this.localFS.browse(entry.path);
        }
        prom.then(function () {
            if (Notes2Utils_1.Notes2Utils.isLocalEntry(entry)) {
                _this.mergedCollection.addCollection(_this.proxyCollection);
            }
            _this.filteredCollection.refresh();
            _this.preventReselect = false;
            _this.clearSelection();
            var el = _this.activeCollection.find(function (x) { return x.id == toSelectId; });
            if (el) {
                _this.activeCollection.setSelected(el);
            }
            _this.activeCollection.setActive(el);
            _this.sendSelectionToView();
            _this.callViewMethod("refreshPath", _this.currentPath);
        });
    };
    FilesListController.prototype.chooseFile = function () {
        var _this = this;
        var entries = this.getSelectedEntries();
        var formatter = new pmc_mail_1.utils.Formatter();
        if (!entries) {
            return;
        }
        if (entries.length == 1 && entries[0].type == "directory") {
            this.moveToDirectory(entries[0].id);
            return;
        }
        var elements = [];
        entries.forEach(function (entry) {
            var func = pmc_mail_1.Q().then(function () { return _this.withOpenableElementPromise(entry); });
            elements.push(func);
        });
        pmc_mail_1.Q.all(elements)
            .then(function (res) {
            var limit = _this.app.getMaxFileSizeLimit();
            var cancelUpload = false;
            res.forEach(function (f) {
                if (f.size > limit) {
                    cancelUpload = true;
                }
            });
            if (cancelUpload) {
                _this.app.msgBox.alert(_this.i18n("plugin.notes2.component.filesList.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit)));
                return;
            }
            if (typeof _this.onFilesChoosen == "function") {
                _this.onFilesChoosen(res);
            }
            else {
                throw Error("You must implement onFilesChoosen method when in FileChooser mode");
            }
        });
    };
    FilesListController.prototype.withOpenableElementPromise = function (entry) {
        var defer = pmc_mail_1.Q.defer();
        this.withOpenableElement(entry.id, function (element) {
            return defer.resolve(element);
        });
        return defer.promise;
    };
    FilesListController.prototype.openExternalFile = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        if (active.type == "directory") {
            this.moveToDirectory(active.id);
        }
        else {
            this.withOpenableElement(active.id, function (element) {
                var appHandle = _this.app.shellRegistry.resolveApplicationByElement({ element: element, session: _this.session });
                _this.app.shellRegistry.shellOpen({
                    element: element,
                    action: appHandle == null || appHandle.id == "core.unsupported" ? pmc_mail_1.app.common.shelltypes.ShellOpenAction.EXTERNAL : pmc_mail_1.app.common.shelltypes.ShellOpenAction.OPEN,
                    parent: _this.parent.getClosestNotDockedController(),
                    session: _this.session
                });
            });
        }
    };
    FilesListController.prototype.goToRoot = function () {
        this.moveToDirectory("parent");
    };
    FilesListController.prototype.reselect = function (currentIndex) {
        var length = this.activeCollection.size();
        if (currentIndex < length) {
            this.activeCollection.setActive(this.activeCollection.get(currentIndex));
        }
        else if (length > 0) {
            this.activeCollection.setActive(this.activeCollection.get(length - 1));
        }
        var newSelectedIndexes = [];
        for (var _i = 0, _a = this.activeCollection.selectedIndexes; _i < _a.length; _i++) {
            var idx = _a[_i];
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
    };
    FilesListController.prototype.exportFile = function () {
        var _this = this;
        var activeEntries = this.getSelectedEntries().filter(function (x) { return !x.isParentDir; });
        if (activeEntries.length > 1 || (activeEntries.length == 1 && activeEntries[0].type == "directory")) {
            var controller = this.parent ? this.parent.getClosestNotDockedController() : null;
            var parentWindow = controller ? controller.nwin : null;
            var exportSuccess_1 = false;
            this.app.chooseDirectory(parentWindow).then(function (exportPath) {
                var directoryIdsToExport = [];
                var fileIdsToExport = activeEntries.filter(function (x) { return x.type == "file"; }).map(function (x) { return x.id; });
                var directoryIdsToProcess = activeEntries.filter(function (x) { return x.type == "directory"; }).map(function (x) { return x.id; });
                while (directoryIdsToProcess.length > 0) {
                    var dirId = directoryIdsToProcess.pop();
                    directoryIdsToExport.push(dirId);
                    var entry = _this.getTreeEntry(dirId);
                    var childEntries = entry.entries;
                    for (var childEntryKey in childEntries) {
                        var childEntry = childEntries[childEntryKey];
                        if (childEntry.type == "file") {
                            fileIdsToExport.push(childEntry.id);
                        }
                        else if (childEntry.type == "directory") {
                            directoryIdsToProcess.push(childEntry.id);
                        }
                    }
                }
                var getDestinationNameFn;
                if (_this.currentDir) {
                    var baseStr = _this.currentDir ? _this.currentDir.id : "";
                    if (baseStr[baseStr.length - 1] == "/") {
                        baseStr = baseStr.substr(0, baseStr.length - 1);
                    }
                    var baseStrLength_1 = baseStr.length;
                    getDestinationNameFn = function (x) { return exportPath + x.substr(baseStrLength_1); };
                }
                else {
                    getDestinationNameFn = function (x) { return exportPath + x.substr(x.lastIndexOf("/")); };
                }
                var exportDirectories = directoryIdsToExport.map(function (x) { return ({ source: x, destination: getDestinationNameFn(x) }); });
                var exportFiles = fileIdsToExport.map(function (x) { return ({ source: x, destination: getDestinationNameFn(x) }); });
                var notificationId = _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.exportingFiles"), { autoHide: false, progress: true });
                return pmc_mail_1.Q().then(function () {
                    var prom = pmc_mail_1.Q();
                    var _loop_7 = function (dirExport) {
                        prom = prom.then(function () { return LocalFS_1.LocalFS.createDir(dirExport.destination).thenResolve(null); });
                    };
                    for (var _i = 0, exportDirectories_1 = exportDirectories; _i < exportDirectories_1.length; _i++) {
                        var dirExport = exportDirectories_1[_i];
                        _loop_7(dirExport);
                    }
                })
                    .then(function () {
                    var prom = pmc_mail_1.Q();
                    var _loop_8 = function (fileExport) {
                        prom = prom.then(function () {
                            return pmc_mail_1.Q().then(function () {
                                return _this.getOpenableElement(fileExport.source);
                            })
                                .then(function (openableElement) {
                                return openableElement.content.getBuffer();
                            })
                                .then(function (buffer) {
                                return LocalFS_1.LocalFS.writeFileEx(fileExport.destination, buffer);
                            });
                        });
                    };
                    for (var _i = 0, exportFiles_1 = exportFiles; _i < exportFiles_1.length; _i++) {
                        var fileExport = exportFiles_1[_i];
                        _loop_8(fileExport);
                    }
                    return prom;
                })
                    .then(function () {
                    exportSuccess_1 = true;
                })
                    .fin(function () {
                    _this.notifications.hideNotification(notificationId);
                });
            })
                .then(function () {
                if (exportSuccess_1) {
                    setTimeout(function () {
                        _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.exportedFiles"));
                    }, 800);
                }
            })
                .fail(function (e) {
                if (e != "no-choose") {
                    _this.errorCallback(e);
                }
            });
        }
        else {
            var active = this.getSelectedEntry();
            if (!active) {
                return;
            }
            this.withOpenableElement(active.id, function (openableElement) {
                _this.app.shellRegistry.shellOpen({
                    element: openableElement,
                    action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.DIRECT_DOWNLOAD,
                    parent: _this.parent.getClosestNotDockedController(),
                    session: _this.session
                });
            });
        }
    };
    FilesListController.prototype.askExportFiles = function () {
        var _this = this;
        this.parent.confirm(this.i18n("plugin.notes2.component.filesList.actions.export.confirm")).then(function (result) {
            if (result.result == "yes") {
                _this.exportFiles();
            }
        });
    };
    FilesListController.prototype.exportFiles = function () {
        var _this = this;
        if (this.fileListId == FilesListController_1.LOCAL_FILES || this.fileListId == FilesListController_1.TRASH_FILES) {
            return;
        }
        var section = this.getSection();
        if (this.fileListId != FilesListController_1.ALL_FILES && section == null) {
            return;
        }
        var notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.exporting"), { autoHide: false });
        pmc_mail_1.Q().then(function () {
            if (_this.fileListId == FilesListController_1.ALL_FILES) {
                return _this.sectionManager.exportFiles(true);
            }
            return section.exportFiles(true);
        })
            .progress(function (progress) {
            if (progress.type == "export-section") {
                _this.notifications.progressNotification(notificationId, progress);
            }
        })
            .then(function (content) {
            content.name = "privmx-files.zip";
            return _this.app.directSaveContent(content, _this.session, _this.parent.getClosestNotDockedController());
        })
            .fail(function (e) {
            if (e != "no-choose") {
                _this.errorCallback(e);
            }
        })
            .fin(function () {
            _this.notifications.hideNotification(notificationId);
        });
    };
    FilesListController.prototype.showHistory = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        this.withOpenableElement(active.id, function (openableElement) {
            if (openableElement instanceof pmc_mail_1.app.common.shelltypes.OpenableFile) {
                _this.app.ioc.create(HistoryWindowController_1.HistoryWindowController, [_this.parent, _this.session, openableElement.fileSystem, openableElement.path]).then(function (win) {
                    _this.parent.openChildWindow(win);
                });
            }
        });
    };
    FilesListController.prototype.openFilesImporter = function () {
        var _this = this;
        this.app.ioc.create(FilesImporterWindowController_1.FilesImporterWindowController, [this.parent, this.getSection(), this.currentPath]).then(function (win) {
            _this.parent.openChildWindow(win);
        });
    };
    FilesListController.prototype.print = function () {
        var _this = this;
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        var active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        var app = this.app;
        if (app.isPrintable(active.mimeType)) {
            var notificationId_2 = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.printing"), { autoHide: false, progress: true });
            this.isPrinting = true;
            pmc_mail_1.Q().then(function () {
                return _this.getOpenableElement(active.id);
            })
                .then(function (element) {
                if (!element) {
                    throw new Error("No element");
                }
                return app.print(_this.session, element, _this.parent.getClosestNotDockedController());
            })
                .then(function (printed) {
                if (printed) {
                    setTimeout(function () {
                        _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.printed"));
                    }, 500);
                }
            })
                .fin(function () {
                _this.notifications.hideNotification(notificationId_2);
                _this.isPrinting = false;
            });
        }
    };
    FilesListController.prototype.saveAsPdf = function () {
        var _this = this;
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        var active = this.getSelectedEntry();
        if (!active) {
            return;
        }
        var app = this.app;
        if (app.canSaveAsPdf(active.mimeType)) {
            var notificationId_3 = this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.saving-as-pdf"), { autoHide: false, progress: true });
            this.isSavingAsPdf = true;
            pmc_mail_1.Q().then(function () {
                return _this.getOpenableElement(active.id);
            })
                .then(function (element) {
                if (!element) {
                    throw new Error("No element");
                }
                var ctrl = _this.parent.getClosestNotDockedController();
                return app.saveAsPdf(_this.session, element, ctrl ? ctrl.nwin : null);
            })
                .then(function () {
                setTimeout(function () {
                    _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.saved-as-pdf"));
                }, 500);
            })
                .fin(function () {
                _this.notifications.hideNotification(notificationId_3);
                _this.isSavingAsPdf = false;
            })
                .fail(function () {
            });
        }
    };
    FilesListController.prototype.getDidOfFile = function (section, path) {
        return pmc_mail_1.Q().then(function () {
            if (section && !section.isPrivate() && section.hasChatModule()) {
                return section.getFileOpenableElement(path, false).then(function (osf) {
                    return osf.handle.descriptor.ref.did;
                });
            }
            else {
                return "";
            }
        });
    };
    FilesListController.prototype.deleteFile = function () {
        var _this = this;
        var activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        var selectedIndexes = this.activeCollection.selectedIndexes.slice();
        var confirmOptions = {
            width: 400,
            height: 140,
            title: this.i18n("plugin.notes2.component.filesList.actions.delete"),
            message: this.i18n("plugin.notes2.component.filesList.actions.delete.info"),
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
        var prom = pmc_mail_1.Q();
        var confirmDeferred = null;
        var confirm = function () {
            if (confirmDeferred == null) {
                confirmDeferred = pmc_mail_1.Q.defer();
                _this.parent.confirmEx(confirmOptions).then(function (res) {
                    if (res.result == "yes") {
                        confirmDeferred.resolve();
                    }
                });
            }
            return confirmDeferred.promise;
        };
        var cannotDelete = false;
        var cannotDeleteShared = false;
        var sthDeleted = false;
        var _loop_9 = function (activeEntry) {
            if (activeEntry.id == "parent") {
                return "continue";
            }
            var _entry = this_4.getTreeEntry(activeEntry.id);
            if (Notes2Utils_1.Notes2Utils.isLocalEntry(_entry)) {
                var entry_2 = _entry;
                prom = prom.then(function () {
                    return pmc_mail_1.Q().then(function () {
                        if (entry_2 == null || !LocalFS_1.LocalFS.isDeletable(entry_2.path)) {
                            return pmc_mail_1.Q.reject();
                        }
                        return confirm();
                    }).then(function () {
                        if (entry_2.isDirectory()) {
                            return LocalFS_1.LocalFS.deleteDir(entry_2.path, false);
                        }
                        return LocalFS_1.LocalFS.deleteFile(entry_2.path, false);
                    }).then(function () {
                        sthDeleted = true;
                        return _this.dispatchEventResult({ type: "fileremoved" });
                    }).fail(function () {
                        cannotDelete = true;
                    });
                });
                return "continue";
            }
            var entry = _entry;
            if (entry == null || !this_4.isDeletable(entry.tree)) {
                cannotDelete = true;
                cannotDeleteShared = true;
                return "continue";
            }
            prom = prom.then(function () {
                return confirm().then(function () {
                    return _this.deleteEntry(entry).then(function (result) {
                        if (result.sthDeleted !== null) {
                            sthDeleted = result.sthDeleted;
                        }
                        if (result.cannotDelete !== null) {
                            cannotDelete = result.cannotDelete;
                        }
                    });
                });
            });
        };
        var this_4 = this;
        for (var _i = 0, activeEntries_3 = activeEntries; _i < activeEntries_3.length; _i++) {
            var activeEntry = activeEntries_3[_i];
            _loop_9(activeEntry);
        }
        return prom.then(function () {
            if (sthDeleted) {
                if (selectedIndexes.length > 0) {
                    _this.reselectIndex = selectedIndexes[0];
                }
            }
            else if (cannotDelete) {
                _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.cannot-delete" + (cannotDeleteShared ? "-shared-file" : "")));
            }
        });
    };
    FilesListController.prototype.deleteEntry = function (entry) {
        var _this = this;
        var fileDid;
        var sthDeleted = null;
        var cannotDelete = null;
        return pmc_mail_1.Q()
            .then(function () {
            return pmc_mail_1.Q().then(function () {
                return entry.isFile() ? _this.getDidOfFile(entry.tree.section, entry.path).then(function (did) {
                    fileDid = did;
                }) : null;
            })
                .then(function () {
                sthDeleted = true;
                return _this.dispatchEventResult({ type: "fileremoved" });
            })
                .then(function () {
                return entry.tree.fileSystem.shell.remove(entry.path, _this.onMultiStatus.bind(_this));
            })
                .then(function () {
                var section = entry.tree.section;
                if (section == null || section.isPrivate() || !section.hasChatModule()) {
                    return;
                }
                var chatModule = section.getChatModule();
                return pmc_mail_1.Q().then(function () {
                    if (entry.isDirectory()) {
                        return chatModule.sendDeleteDirectoryMessage(entry.path);
                    }
                    else {
                        return chatModule.sendDeleteFileMessage(entry.path, entry.meta.mimeType, fileDid);
                    }
                }).fail(function (e) {
                    _this.logError(e);
                });
            })
                .fail(function (e) {
                _this.logError(e);
                cannotDelete = true;
            });
        })
            .then(function () {
            return {
                sthDeleted: sthDeleted,
                cannotDelete: cannotDelete,
            };
        });
    };
    FilesListController.prototype.tryEmptyTrash = function () {
        var _this = this;
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
        }).then(function (res) {
            if (res.result == "yes") {
                _this.emptyTrash();
            }
        });
    };
    FilesListController.prototype.emptyTrash = function () {
        var _this = this;
        if (this.fileListId != FilesListController_1.TRASH_FILES) {
            return;
        }
        var prom = pmc_mail_1.Q();
        var sthDeleted = false;
        var _loop_10 = function (entry) {
            var _entry = this_5.getTreeEntry(entry.id);
            if (!Notes2Utils_1.Notes2Utils.isLocalEntry(_entry)) {
                var treeEntry_1 = _entry;
                if (this_5.isDeletable(treeEntry_1.tree)) {
                    prom = prom.then(function () { return _this.deleteEntry(treeEntry_1); }).then(function (result) {
                        if (result.sthDeleted) {
                            sthDeleted = result.sthDeleted;
                        }
                    });
                }
            }
        };
        var this_5 = this;
        for (var _i = 0, _a = this.filteredCollection.list; _i < _a.length; _i++) {
            var entry = _a[_i];
            _loop_10(entry);
        }
        prom.then(function () {
            if (sthDeleted) {
                _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.emptied-trash"));
            }
        });
    };
    FilesListController.prototype.trashFile = function () {
        var _this = this;
        var activeEntries = this.getSelectedEntries();
        if (!activeEntries || activeEntries.length == 0) {
            return;
        }
        var selectedIndexes = this.activeCollection.selectedIndexes.slice();
        var confirmOptions = {
            width: 400,
            height: 140,
            title: this.i18n("plugin.notes2.component.filesList.actions.delete"),
            message: this.i18n("plugin.notes2.component.filesList.actions.delete-trash.info"),
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
        var confirmDeferred = null;
        var confirm = function () {
            if (confirmDeferred == null) {
                confirmDeferred = pmc_mail_1.Q.defer();
                _this.parent.confirmEx(confirmOptions).then(function (res) {
                    if (res.result == "yes") {
                        confirmDeferred.resolve();
                    }
                });
            }
            return confirmDeferred.promise;
        };
        var prom = pmc_mail_1.Q();
        var cannotMoveToTrash = false;
        var sthMovedToTrash = false;
        var _loop_11 = function (activeEntry) {
            if (activeEntry.id == "parent") {
                return "continue";
            }
            var _entry = this_6.getTreeEntry(activeEntry.id);
            if (Notes2Utils_1.Notes2Utils.isLocalEntry(_entry)) {
                var entry_3 = _entry;
                prom = prom.then(function () {
                    return pmc_mail_1.Q().then(function () {
                        if (entry_3 == null || !LocalFS_1.LocalFS.isDeletable(entry_3.path)) {
                            return pmc_mail_1.Q.reject();
                        }
                        else {
                            return;
                        }
                    })
                        .then(function () {
                        if (entry_3.isDirectory()) {
                            return LocalFS_1.LocalFS.deleteDir(entry_3.path, true);
                        }
                        return LocalFS_1.LocalFS.deleteFile(entry_3.path, true);
                    }).then(function () {
                        sthMovedToTrash = true;
                        return _this.dispatchEventResult({ type: "fileremoved" });
                    }).fail(function () {
                        cannotMoveToTrash = true;
                    });
                });
                return "continue";
            }
            var entry = _entry;
            if (entry == null) {
                cannotMoveToTrash = true;
                return "continue";
            }
            prom = prom.then(function () {
                var fileDid = "";
                return pmc_mail_1.Q().then(function () {
                    return entry.isFile() ? _this.getDidOfFile(entry.tree.section, entry.path).then(function (did) {
                        fileDid = did;
                    }) : null;
                })
                    .then(function () {
                    sthMovedToTrash = true;
                    return _this.dispatchEventResult({ type: "fileremoved" });
                })
                    .then(function () {
                    var srcName = pmc_mail_1.mail.filetree.Path.parsePath(entry.path).name.original;
                    var dstPath = pmc_mail_1.mail.filetree.nt.Helper.resolvePath(Common_1.FilesConst.TRASH_PATH + "/", srcName);
                    return entry.tree.fileSystem.move(entry.path, dstPath, true).thenResolve(dstPath);
                })
                    .then(function (dstPath) {
                    return entry.tree.fileSystem.updateMeta(dstPath, function (meta) {
                        meta.trashedInfo = {
                            who: _this.identity.user,
                            when: new Date().getTime(),
                        };
                    })
                        .thenResolve(dstPath);
                })
                    .then(function (dstPath) {
                    var section = entry.tree.section;
                    if (section == null || section.isPrivate() || !section.hasChatModule()) {
                        return;
                    }
                    var chatModule = section.getChatModule();
                    pmc_mail_1.Q().then(function () {
                        if (entry.isDirectory()) {
                            return chatModule.sendTrashDirectoryMessage(entry.path, null);
                        }
                        else {
                            return chatModule.sendTrashFileMessage(entry.path, null, entry.meta.mimeType, fileDid);
                        }
                    }).fail(function (e) {
                        _this.logError(e);
                    });
                })
                    .fail(function (e) {
                    _this.logError(e);
                    cannotMoveToTrash = true;
                });
            });
        };
        var this_6 = this;
        for (var _i = 0, activeEntries_4 = activeEntries; _i < activeEntries_4.length; _i++) {
            var activeEntry = activeEntries_4[_i];
            _loop_11(activeEntry);
        }
        return prom.then(function () {
            if (sthMovedToTrash) {
                if (selectedIndexes.length > 0) {
                    _this.reselectIndex = selectedIndexes[0];
                }
            }
            else if (cannotMoveToTrash) {
                _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.cannot-move-to-trash"));
            }
        });
    };
    FilesListController.prototype.renameFile = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        if (!active || active.id == "parent") {
            return;
        }
        var _entry = this.getTreeEntry(active.id);
        if (Notes2Utils_1.Notes2Utils.isLocalEntry(_entry)) {
            var entry_4 = _entry;
            return this.parent.promptEx({
                width: 400,
                height: 140,
                title: this.i18n("plugin.notes2.component.filesList.actions.rename"),
                input: {
                    placeholder: this.i18n("plugin.notes2.component.filesList.actions.rename.placeholder"),
                    multiline: false,
                    value: entry_4.name
                },
                selectionMode: entry_4.isDirectory() ? "all" : "filename",
            })
                .then(function (result) {
                if (result.result != "ok" || !result.value) {
                    return;
                }
                if (!LocalFS_1.LocalFS.isNameValid(result.value)) {
                    _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.invalid-name"));
                    return;
                }
                return LocalFS_1.LocalFS.rename(entry_4.path, result.value)
                    .then(function () {
                    var fileName = result.value;
                    var oldPath = entry_4.path;
                    var newPath = oldPath.substr(0, oldPath.lastIndexOf("/") + 1) + fileName;
                    _this.app.fileRenameObserver.dispatchLocalFileRenamedEvent(newPath, oldPath);
                })
                    .fail(function (e) {
                    _this.errorCallback(e);
                });
            });
        }
        var entry = _entry;
        if (entry == null) {
            this.notifications.showNotification(this.i18n("plugin.notes2.component.filesList.notifier.cannot-rename"));
            return;
        }
        var oldPath = entry.path;
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
            .then(function (result) {
            var fileDid;
            if (result.result != "ok" || !result.value) {
                return;
            }
            if (result.value.indexOf("/") != -1) {
                _this.notifications.showNotification(_this.i18n("plugin.notes2.component.filesList.notifier.invalid-name"));
                return;
            }
            var newPath = pmc_mail_1.mail.filetree.nt.Helper.resolvePath(entry.parent.path, result.value);
            return pmc_mail_1.Q().then(function () {
                return entry.isFile() ? _this.getDidOfFile(entry.tree.section, entry.path).then(function (did) {
                    fileDid = did;
                }) : null;
            })
                .then(function () {
                return entry.tree.fileSystem.rename(entry.path, result.value);
            })
                .then(function () {
                if (_this.activeCollection.selectedIndexes.length == 1 && _this.activeCollection.get(_this.activeCollection.selectedIndexes[0]).id == entry.id) {
                    _this.reselectIndex = _this.activeCollection.selectedIndexes[0];
                }
                _this.callViewMethod("setActiveById", entry.id);
                var section = entry.tree.section;
                if (section == null || section.isPrivate() || !section.hasChatModule()) {
                    _this.app.fileRenameObserver.dispatchFileRenamedEvent(fileDid ? fileDid : entry.ref.did, newPath, oldPath, _this.session.hostHash);
                    return;
                }
                var chatModule = section.getChatModule();
                pmc_mail_1.Q().then(function () {
                    if (entry.isDirectory()) {
                        return chatModule.sendRenameDirectoryMessage(oldPath, newPath);
                    }
                    else if (entry.isFile()) {
                        _this.app.fileRenameObserver.dispatchFileRenamedEvent(fileDid, newPath, oldPath, _this.session.hostHash);
                        return chatModule.sendRenameFileMessage(oldPath, newPath, entry.meta.mimeType, fileDid);
                    }
                }).fail(function (e) {
                    _this.logError(e);
                });
            })
                .fail(function (e) {
                _this.errorCallback(e);
            });
        });
    };
    FilesListController.prototype.onClipboardChange = function () {
        this.callViewMethod("onClipboardChange", this.hasSthToPaste());
    };
    FilesListController.prototype.onActiveCollectionChange = function (event) {
        var _this = this;
        if (this.currentDir == null && this.currentPath) {
            this.currentDir = this.collection.find(function (x) { return Notes2Utils_1.Notes2Utils.isFsFileEntry(x) && x.isDirectory() && x.path == _this.currentPath; });
        }
        if (this.preventReselect) {
            return;
        }
        if (event.type == "selection") {
            if (this.isActive && !this.isSelectionChanging) {
                pmc_mail_1.Q().then(function () {
                    _this.loadFilePreview();
                });
            }
            if (event.causeType == "remove") {
                if (event.indicies.length == 0 && this.reselectIndex !== null) {
                    this.reselectIndex = Math.min(this.reselectIndex, this.activeCollection.size() - 1);
                    var entry = this.activeCollection.get(this.reselectIndex);
                    if (entry) {
                        this.activeCollection.setSelected(entry);
                        this.activeCollection.setActive(entry);
                        this.sendSelectionToView();
                    }
                    this.reselectIndex = null;
                }
            }
            else if (event.causeType == "selected") {
                var el0_1 = this.activeCollection.get(event.index);
                if (!el0_1) {
                    return;
                }
                var idx = this.collection.indexOfBy(function (x) { return x.id == el0_1.id; });
                var el_2 = this.collection.get(idx);
                if (!el_2) {
                    return;
                }
                if (el_2 && this.notes2Plugin.wasUnread(this.session, el_2) && this.app.userPreferences.getAutoMarkAsRead()) {
                    if (this.delayMarkAsRead) {
                        setTimeout(function () {
                            _this.notes2Plugin.markFileAsWatched(_this.session, el_2);
                        }, FilesListController_1.MARK_ALREADY_SELECTED_AS_READ_DELAY);
                    }
                    else {
                        this.notes2Plugin.markFileAsWatched(this.session, el_2);
                    }
                }
                if (el_2) {
                    this.delayMarkAsRead = false;
                }
            }
        }
    };
    FilesListController.prototype.loadFilePreview = function () {
        var _this = this;
        var selected = this.getSelectedEntries();
        if (selected.length > 1) {
            this.dispatchEvent({
                type: "previewrequest",
                elementType: "multi",
                selectedCount: selected.length,
                hostHash: this.session.hostHash
            });
            return;
        }
        var active = this.getSelectedEntry();
        var entry = active && active.id != "parent" ? this.getTreeEntry(active.id) : null;
        if (entry && entry.isDirectory()) {
            this.dispatchEvent({
                type: "previewrequest",
                elementType: "directory",
                directory: entry,
                hostHash: this.session.hostHash
            });
            return;
        }
        this.withOpenableElement(active ? active.id : null, function (element) {
            if (element) {
                _this.dispatchEvent({
                    type: "previewrequest",
                    elementType: "file",
                    openableElement: element,
                    hostHash: _this.session.hostHash
                });
            }
            else if (entry && entry.isDirectory()) {
                _this.dispatchEvent({
                    type: "previewrequest",
                    elementType: "directory",
                    directory: entry,
                    hostHash: _this.session.hostHash
                });
            }
            else {
                _this.dispatchEvent({
                    type: "previewrequest",
                    elementType: "clear",
                    hostHash: _this.session.hostHash
                });
            }
        }, false);
    };
    FilesListController.prototype.onFilterFiles = function () {
        this.filesFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    FilesListController.prototype.activate = function () {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.filesFilterUpdater.updateFilter(this.app.searchModel.get(), true);
    };
    FilesListController.prototype.deactivate = function () {
        if (!this.isActive) {
            return;
        }
        this.isActive = false;
        this.filesFilterUpdater.onDeactivateFiles();
    };
    FilesListController.prototype.canWrite = function () {
        var person = this.personService.getMe();
        return !(this.filesInfo && this.filesInfo.type == FilesListType.CONVERSATION && this.filesInfo.conversation.section == null && person.username.indexOf("@") >= 0);
    };
    FilesListController.prototype.onViewUpdateCanWrite = function () {
        this.callViewMethod("updateCanWrite", this.canWrite());
        this.updateLockUnlockButtons();
    };
    FilesListController.prototype.showFilePreview = function () {
        return this.notes2Plugin.getSetting(this.session, ViewSettings_1.ViewSettings.SHOW_FILE_PREVIEW, this.fileListId, this.context) == 1;
    };
    FilesListController.prototype.showUrlFiles = function () {
        return this.notes2Plugin.getSetting(this.session, ViewSettings_1.ViewSettings.SHOW_URL_FILES, this.fileListId, this.context) == 1;
    };
    FilesListController.prototype.showHiddenFiles = function () {
        return this.notes2Plugin.getSetting(this.session, ViewSettings_1.ViewSettings.SHOW_HIDDEN_FILES, this.fileListId, this.context) == 1;
    };
    FilesListController.prototype.onViewToggleSetting = function (setting) {
        var currState;
        if (setting == ViewSettings_1.ViewSettings.SHOW_FILE_PREVIEW) {
            currState = this.showFilePreview();
        }
        else if (setting == ViewSettings_1.ViewSettings.SHOW_URL_FILES) {
            currState = this.showUrlFiles();
        }
        else if (setting == ViewSettings_1.ViewSettings.SHOW_HIDDEN_FILES) {
            currState = this.showHiddenFiles();
        }
        else {
            return;
        }
        var newState = !currState;
        this.notes2Plugin.saveSetting(this.session, setting, newState ? 1 : 0, this.fileListId, this.context);
        this.callViewMethod("updateSetting", setting, newState);
        this.filteredCollection.refresh();
        this.app.dispatchEvent({
            type: "update-notes2-setting",
            setting: setting,
            value: newState ? 1 : 0,
            sourceProjectId: this.fileListId,
            sourceContext: this.context,
            sourceUniqueId: this.uniqueId,
        });
    };
    FilesListController.prototype.createUniqueId = function () {
        var n = 1000;
        while (n-- > 0) {
            var id = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
            if (FilesListController_1.usedIds.indexOf(id) < 0) {
                FilesListController_1.usedIds.push(id);
                return id;
            }
        }
    };
    FilesListController.prototype.getSelectedIds = function () {
        var ids = [];
        for (var _i = 0, _a = this.activeCollection.selectedIndexes; _i < _a.length; _i++) {
            var idx = _a[_i];
            var el = this.activeCollection.get(idx);
            if (el) {
                ids.push(el.id);
            }
        }
        return ids;
    };
    FilesListController.prototype.verifySelectedIndices = function () {
        var ok = true;
        for (var _i = 0, _a = this.activeCollection.selectedIndexes; _i < _a.length; _i++) {
            var idx = _a[_i];
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
    };
    FilesListController.prototype.sendSelectionToView = function () {
        this.callViewMethod("setSelectedIds", JSON.stringify(this.getSelectedIds()));
    };
    FilesListController.prototype.getSelectedEntry = function () {
        if (this.activeCollection.selectedIndexes.length == 1) {
            return this.activeCollection.get(this.activeCollection.selectedIndexes[0]);
        }
        return null;
    };
    FilesListController.prototype.getSelectedEntries = function () {
        var entries = [];
        for (var _i = 0, _a = this.activeCollection.selectedIndexes; _i < _a.length; _i++) {
            var idx = _a[_i];
            var el = this.activeCollection.get(idx);
            if (el) {
                entries.push(el);
            }
        }
        return entries;
    };
    FilesListController.prototype.clearSelection = function (setIsChanging) {
        if (setIsChanging === void 0) { setIsChanging = true; }
        if (setIsChanging) {
            this.isSelectionChanging = true;
        }
        var indexes = this.activeCollection.selectedIndexes.slice();
        for (var _i = 0, indexes_2 = indexes; _i < indexes_2.length; _i++) {
            var idx = indexes_2[_i];
            var el = this.activeCollection.get(idx);
            if (el) {
                this.activeCollection.deselect(el);
            }
        }
        if (setIsChanging) {
            this.isSelectionChanging = false;
        }
    };
    FilesListController.prototype.setSelectionMode = function (selectionMode) {
        this.selectionMode = selectionMode;
        if (selectionMode == SelectionMode.SINGLE && this.getSelectedEntries().length > 1) {
            var active = this.activeCollection.getActive();
            this.clearSelection();
            if (active) {
                this.onViewSelectEntries(JSON.stringify([active.id]), active.id);
            }
        }
    };
    FilesListController.prototype.isConversationWithDeletedUserOnly = function () {
        if (this.filesInfo.type == FilesListType.CONVERSATION) {
            if (this.filesInfo.conversation.isSingleContact()) {
                var userName = this.filesInfo.conversation.getFirstPerson().contact.getUsername();
                if (this.filesInfo.conversation.conv2Service.contactService.isUserDeleted(userName)) {
                    return true;
                }
            }
        }
        return false;
    };
    FilesListController.prototype.onViewAddPerson = function () {
        if (this.isConversationWithDeletedUserOnly()) {
            return;
        }
        var hashmails = this.filesInfo.conversation.persons.map(function (p) { return p.hashmail; });
        this.app.dispatchEvent({
            type: "requestopenfiles",
            showContactsWindow: true,
            hashmails: hashmails,
        });
    };
    FilesListController.prototype.onViewRemovePerson = function (hashmail) {
        var hashmails = this.filesInfo.conversation.persons.map(function (p) { return p.hashmail; }).filter(function (h) { return h != hashmail; });
        this.app.dispatchEvent({
            type: "requestopenfiles",
            hashmails: hashmails,
        });
    };
    FilesListController.meetsFilter = function (entry, word) {
        if (!entry) {
            return false;
        }
        return Notes2Utils_1.Notes2Utils.isParentEntry(entry) || pmc_mail_1.app.common.SearchFilter.matches(word, entry.name);
    };
    FilesListController.prototype.setSession = function (session) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.session = session;
            return pmc_mail_1.Q.all([
                _this.session.mailClientApi.privmxRegistry.getIdentity(),
                _this.session.mailClientApi.privmxRegistry.getSinkIndexManager(),
                _this.session.mailClientApi.privmxRegistry.getConv2Service(),
                _this.session.mailClientApi.privmxRegistry.getPersonService(),
                _this.session.mailClientApi.privmxRegistry.getSectionManager().then(function (sm) {
                    return sm.load().thenResolve(sm);
                })
            ])
                .then(function (res) {
                _this.identity = res[0];
                _this.sinkIndexManager = res[1];
                _this.conv2Service = res[2];
                _this.personService = res[3];
                _this.sectionManager = res[4];
                _this.taskTooltip.getContent = function (taskId) {
                    return _this.tasksPlugin ? _this.tasksPlugin.getTaskTooltipContent(_this.session, taskId + "") : null;
                };
                _this.taskChooser = _this.addComponent("taskchooser-" + session.hostHash, _this.componentFactory.createComponent("taskchooser", [_this, _this.app, {
                        createTaskButton: false,
                        includeTrashed: false,
                        popup: true,
                        session: _this.session,
                    }]));
                _this.afterViewLoadedDeferred.promise.then(function () {
                    _this.callViewMethod("initViewAfterSessionSet", session.hostHash);
                });
            })
                .then(function () {
                return _this.refreshLocksInfo(session);
            })
                .then(function () {
                _this.updateLockUnlockButtons();
            });
        });
    };
    FilesListController.prototype.getSession = function () {
        return this.session;
    };
    FilesListController.prototype.lockFile = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        pmc_mail_1.Q().then(function () {
            return _this.getOpenableElement(active.id);
        })
            .then(function (element) {
            _this.app.filesLockingService.manualLockFile(_this.session, element);
        })
            .then(function () {
            _this.updateLockUnlockButtons();
        });
    };
    FilesListController.prototype.unlockFile = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        pmc_mail_1.Q().then(function () {
            return _this.getOpenableElement(active.id);
        })
            .then(function (element) {
            _this.app.filesLockingService.manualUnlockFile(_this.session, element);
        })
            .then(function () {
            _this.updateLockUnlockButtons();
        });
    };
    FilesListController.prototype.canUnlockFile = function (openableElement) {
        if (openableElement) {
            return this.app.filesLockingService.canUnlockFile(this.session, openableElement);
        }
    };
    FilesListController.prototype.refreshLocksInfo = function (session) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return session.sectionManager.client.descriptorManager.getLockedDescriptor()
                .then(function (result) {
                _this.filesLocksMap = {};
                if (result && Array.isArray(result)) {
                    result.forEach(function (x) {
                        _this.filesLocksMap[x.did] = x.lock.user;
                    });
                }
            });
        });
    };
    FilesListController.prototype.isFileLocked = function (did) {
        return this.filesLocksMap && (did in this.filesLocksMap);
    };
    FilesListController.prototype.onFileLockChanged = function (event) {
        if (!this.collection) {
            return;
        }
        var entry = this.collection.find(function (x) { return Notes2Utils_1.Notes2Utils.isFsFileEntry(x) && x.ref.did == event.did; });
        if (entry) {
            if (event.lockReleased) {
                delete this.filesLocksMap[event.did];
                this.collection.triggerUpdateElement(entry);
            }
            else if (event.locked) {
                this.filesLocksMap[event.did] = event.user;
                this.collection.triggerUpdateElement(entry);
            }
        }
    };
    FilesListController.prototype.updateLockUnlockButtons = function () {
        var _this = this;
        var active = this.getSelectedEntry();
        if (!active) {
            return pmc_mail_1.Q();
        }
        if (active.type == "directory") {
            this.hideLockUnlockButtons();
            return pmc_mail_1.Q();
        }
        return pmc_mail_1.Q().then(function () {
            return _this.getOpenableElement(active.id);
        })
            .then(function (element) {
            return _this.canUnlockFile(element);
        })
            .then(function (canUnlock) {
            _this.updateLockInfoOnActionButtons(active.locked, canUnlock);
        });
    };
    FilesListController.prototype.updateLockInfoOnActionButtons = function (locked, canUnlock) {
        this.callViewMethod("updateLockInfoOnActionButtons", locked, canUnlock);
    };
    FilesListController.prototype.hideLockUnlockButtons = function () {
        this.callViewMethod("hideLockUnlockButtons");
    };
    var FilesListController_1;
    FilesListController.textsPrefix = "plugin.notes2.component.filesList.";
    FilesListController.MY_FILES = "my";
    FilesListController.ALL_FILES = "all";
    FilesListController.LOCAL_FILES = "local";
    FilesListController.TRASH_FILES = "trash";
    FilesListController.MARK_ALREADY_SELECTED_AS_READ_DELAY = 3000;
    FilesListController.usedIds = [];
    __decorate([
        Inject
    ], FilesListController.prototype, "identity", void 0);
    __decorate([
        Inject
    ], FilesListController.prototype, "sinkIndexManager", void 0);
    __decorate([
        Inject
    ], FilesListController.prototype, "conv2Service", void 0);
    __decorate([
        Inject
    ], FilesListController.prototype, "personService", void 0);
    FilesListController = FilesListController_1 = __decorate([
        Dependencies(["extlist", "persons", "notification"])
    ], FilesListController);
    return FilesListController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.FilesListController = FilesListController;
FilesFilterUpdater.prototype.className = "com.privmx.plugin.notes2.component.fileslist.FilesFilterUpdater";
FilesListController.prototype.className = "com.privmx.plugin.notes2.component.fileslist.FilesListController";

//# sourceMappingURL=FilesListController.js.map
