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
var fs = require("fs");
var LocalFS_1 = require("../../main/LocalFS");
var i18n_1 = require("./i18n");
var RecentFilesWindowController = (function (_super) {
    __extends(RecentFilesWindowController, _super);
    function RecentFilesWindowController(parent) {
        var _this = _super.call(this, parent, __filename, __dirname) || this;
        _this.allowClose = false;
        _this.recentOpenedFiles = [];
        _this.recentFilesLocations = [];
        _this.dataPreparedPromise = null;
        _this.metaCache = {};
        _this.ipcMode = true;
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.setPluginViewAssets("notes2");
        _this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 560,
            height: 360,
            minWidth: 400,
            minHeight: 230,
            resizable: true,
            modal: false,
            title: _this.i18n("plugin.notes2.window.recentfiles.title"),
        };
        _this.deferred = pmc_mail_1.Q.defer();
        _this.afterViewLoadedDeferred = pmc_mail_1.Q.defer();
        return _this;
    }
    RecentFilesWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    RecentFilesWindowController.prototype.init = function () {
        this.loadRecentFilesList();
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.conversations = this.addComponent("conversations", this.componentFactory.createComponent("conversationlist", [this, ""]));
        this.conv2list = this.addComponent("conv2list", this.componentFactory.createComponent("conv2list", [this, {}]));
        this.mutableCollection = this.addComponent("mutableCollection", new pmc_mail_1.utils.collection.MutableCollection([]));
        this.sortedCollection = this.addComponent("sortedCollection", new pmc_mail_1.utils.collection.SortedCollection(this.mutableCollection, function (x, y) { return y.modified - x.modified; }));
        this.activeCollection = this.addComponent("activeCollection", new pmc_mail_1.utils.collection.WithActiveCollection(this.sortedCollection));
        this.recentList = this.addComponent("recentList", this.componentFactory.createComponent("extlist", [this, this.activeCollection]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.recentList.ipcMode = true;
    };
    RecentFilesWindowController.prototype.onViewLoad = function () {
        this.afterViewLoadedDeferred.resolve();
    };
    RecentFilesWindowController.prototype.checkDataPrepared = function () {
        var _this = this;
        if (this.dataPreparedPromise) {
            return this.dataPreparedPromise;
        }
        return this.dataPreparedPromise = pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.app.mailClientApi.checkLoginCore(),
                _this.app.mailClientApi.loadUserPreferences()
            ]);
        })
            .then(function () {
            return _this.notes2Plugin.locationService.getLocationsInfo();
        })
            .then(function (res) {
            _this.locations = res;
        });
    };
    RecentFilesWindowController.prototype.loadRecentFilesList = function () {
        var _this = this;
        var allIds = [];
        var allDids = [];
        var previousLoadRecentFilesListDeferred = this.loadRecentFilesListDeferred;
        this.loadRecentFilesListDeferred = pmc_mail_1.Q.defer();
        var loadRecentFilesListDeferred = this.loadRecentFilesListDeferred;
        pmc_mail_1.Q().then(function () {
            if (previousLoadRecentFilesListDeferred && previousLoadRecentFilesListDeferred.promise.isPending()) {
                return previousLoadRecentFilesListDeferred.promise;
            }
        })
            .then(function () {
            return _this.checkDataPrepared();
        })
            .then(function () {
            _this.callViewMethod("recentFilesListLoading");
            return _this.notes2Plugin.recentService.getRecentOpenedFiles();
        })
            .then(function (res) {
            _this.recentOpenedFiles = res;
            _this.recentOpenedFiles.filter(function (x) { return !(x.id in _this.metaCache) && !x.isLocal; }).forEach(function (item) {
                allIds.push(item.id);
                allDids.push(item.did);
            });
            return _this.notes2Plugin.locationService.getFilesMetaByIds(allIds, allDids, _this.locations);
        })
            .then(function (filesMeta) {
            _this.filesMeta = filesMeta;
            for (var _i = 0, allIds_1 = allIds; _i < allIds_1.length; _i++) {
                var id = allIds_1[_i];
                if (!(id in _this.filesMeta)) {
                    _this.metaCache[id] = null;
                }
            }
            for (var id in _this.filesMeta) {
                _this.metaCache[id] = _this.filesMeta[id];
            }
            for (var id in _this.metaCache) {
                if (_this.metaCache[id]) {
                    _this.filesMeta[id] = _this.metaCache[id];
                }
            }
            var locationsToGet = [];
            _this.recentOpenedFiles.forEach(function (file) {
                if (file.isLocal && _this.app.isElectronApp() && fs.existsSync(file.id) && LocalFS_1.LocalFS.isWritable(file.id)) {
                    locationsToGet.push(pmc_mail_1.Q().then(function () {
                        var x = LocalFS_1.LocalFS.getEntry(file.id);
                        filesMeta[file.id] = {
                            icon: _this.app.shellRegistry.resolveIcon(x.mime),
                            meta: {
                                modifiedDate: x.mtime.getTime(),
                                size: x.size,
                            },
                        };
                        return {
                            id: file.id,
                            locationInfo: { type: "local", locationName: "", section: null },
                        };
                    }));
                    return;
                }
                if (!(file.id in filesMeta)) {
                    return;
                }
                var nameFromMeta = filesMeta[file.id].name;
                if (nameFromMeta && file.name != nameFromMeta) {
                    file.name = nameFromMeta;
                    var f = _this.notes2Plugin.recentService.recentOpenFiles.filter(function (x) { return x.did == file.did; })[0];
                    if (f) {
                        f.name = nameFromMeta;
                    }
                }
                var getOneFileLocation = pmc_mail_1.Q().then(function () { return _this.notes2Plugin.locationService.getLocationByEntryId(file.id, _this.locations)
                    .then(function (locationInfo) {
                    return { id: file.id, locationInfo: locationInfo };
                }); });
                locationsToGet.push(getOneFileLocation);
            });
            return pmc_mail_1.Q.all(locationsToGet);
        })
            .then(function (results) {
            _this.recentFilesLocations = results.filter(function (x) { return x.locationInfo != undefined; });
            _this.recentOpenedFiles = _this.recentOpenedFiles.filter(function (x) {
                var exists = false;
                _this.recentFilesLocations.forEach(function (location) {
                    if (location.id == x.id) {
                        exists = true;
                        return;
                    }
                });
                return exists;
            });
            var locations = {};
            _this.recentFilesLocations.forEach(function (fileInfo) {
                locations[fileInfo.id] = {
                    location: fileInfo.locationInfo,
                    locationModel: _this.getLocationModel(fileInfo.locationInfo),
                    icon: _this.filesMeta[fileInfo.id].icon,
                    meta: _this.filesMeta[fileInfo.id].meta
                };
            });
            var list = [];
            _this.recentOpenedFiles.forEach(function (file) {
                var location = locations[file.id];
                var item = {
                    id: location.locationModel.id,
                    channelName: location.locationModel.channelName,
                    channelScope: location.locationModel.channelScope,
                    hashmail: location.locationModel.hashmail,
                    convModel: location.locationModel.convModel,
                    fileName: file.name,
                    fileId: file.id,
                    icon: location.icon,
                    modified: location.meta.modifiedDate,
                    systemLabel: _this.app.isElectronApp() ? _this.app.getSystemLabel() : "",
                    did: file.did,
                };
                if (location.location && location.location.tree && location.location.tree.collection) {
                    var found = location.location.tree.collection.find(function (x) { return x.ref.did == file.did; });
                    if (!found) {
                        return;
                    }
                    item.fileName = found.name;
                }
                list.push(item);
            });
            _this.mutableCollection.clear();
            _this.mutableCollection.addAll(list);
            _this.activeCollection.setActive(_this.activeCollection.get(0));
            return _this.afterViewLoadedDeferred.promise;
        })
            .fin(function () {
            loadRecentFilesListDeferred.resolve();
            _this.callViewMethod("recentFilesListLoaded");
        });
        return loadRecentFilesListDeferred.promise;
    };
    RecentFilesWindowController.prototype.afterRecentFileRenamed = function (file) {
        var elem = this.mutableCollection.find(function (x) { return x.did == file.did; });
        if (elem) {
            elem.fileId = file.id;
            elem.fileName = file.name;
            this.mutableCollection.triggerUpdateElement(elem);
        }
    };
    RecentFilesWindowController.prototype.invalidateCache = function (fileId) {
        if (fileId in this.metaCache) {
            delete this.metaCache[fileId];
            this.loadRecentFilesList();
        }
    };
    RecentFilesWindowController.prototype.createNewDeferred = function () {
        this.deferred = pmc_mail_1.Q.defer();
    };
    RecentFilesWindowController.prototype.getPromise = function () {
        return this.deferred.promise;
    };
    RecentFilesWindowController.prototype.getLocationModel = function (location) {
        var model = {
            id: location.type,
        };
        if (location.type == "conversation") {
            var active = this.conversations.conversationCollection.getBy("id", location.locationName);
            model.convModel = pmc_mail_1.utils.Converter.convertConversation(active, null);
        }
        else if (location.type == "channel") {
            if (location.section && location.section.isUserGroup()) {
                var active = this.conv2list.conversationCollection.find(function (x) { return x.section == location.section; });
                model.id = "conversation";
                model.convModel = pmc_mail_1.utils.Converter.convertConv2(active, 0, null, 0, true, 0, false, false, false, null);
            }
            else {
                model.channelName = location.locationName;
                model.channelScope = location.scope;
            }
            if (location.section && location.section.isPrivate()) {
                model.hashmail = this.identity.hashmail;
            }
        }
        else if (location.type == "local") {
        }
        else {
            model.hashmail = this.identity.hashmail;
        }
        return model;
    };
    RecentFilesWindowController.prototype.onViewSetActive = function (fileId, did) {
        var active = this.activeCollection.find(function (x) { return x.fileId == fileId && x.did == did; });
        if (active != null) {
            this.activeCollection.setActive(active);
        }
    };
    RecentFilesWindowController.prototype.onViewOpenSelected = function () {
        var active = this.activeCollection.getActive();
        if (active == null) {
            return;
        }
        var file = pmc_mail_1.utils.Lang.find(this.recentOpenedFiles, function (x) { return x.id == active.fileId; });
        if (file == null) {
            return;
        }
        this.deferred.resolve(file);
        this.close();
    };
    RecentFilesWindowController.prototype.onViewSelectUp = function () {
        if (this.activeCollection.active) {
            var currentIndex = this.activeCollection.active.index;
            if (currentIndex > 0) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex - 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    };
    RecentFilesWindowController.prototype.onViewSelectDown = function () {
        if (this.activeCollection.active) {
            var currentIndex = this.activeCollection.active.index;
            if (currentIndex < this.activeCollection.size() - 1) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex + 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    };
    RecentFilesWindowController.prototype.onViewClearList = function () {
        var _this = this;
        if (this.notes2Plugin.recentService && this.notes2Plugin.recentService.recentOpenFiles && this.notes2Plugin.recentService.recentOpenFiles.length == 0) {
            return;
        }
        var notificationId = this.notifications.showNotification(this.i18n("plugin.notes2.window.recentfiles.notifier.clearingList"), { autoHide: false, progress: true });
        pmc_mail_1.Q().then(function () {
            return _this.loadRecentFilesListDeferred ? _this.loadRecentFilesListDeferred.promise : null;
        })
            .then(function () {
            return _this.notes2Plugin.recentService.clearRecentFiles();
        })
            .then(function () {
            return _this.loadRecentFilesList();
        })
            .fin(function () {
            _this.notifications.hideNotification(notificationId);
        });
    };
    RecentFilesWindowController.prototype.onViewRefresh = function () {
        var _this = this;
        this.dataPreparedPromise = null;
        var t0 = new Date().getTime();
        pmc_mail_1.Q().then(function () {
            _this.callViewMethod("setRefreshing", true);
            return _this.loadRecentFilesList();
        })
            .then(function () {
            var t1 = new Date().getTime();
            var dt = t1 - t0;
            var timeLeft = 500 - dt;
            if (timeLeft > 0) {
                var def_1 = pmc_mail_1.Q.defer();
                setTimeout(function () {
                    def_1.resolve();
                }, timeLeft);
                return def_1.promise;
            }
        })
            .fin(function () {
            _this.callViewMethod("setRefreshing", false);
        });
    };
    RecentFilesWindowController.prototype.onViewClose = function () {
        this.close();
    };
    RecentFilesWindowController.prototype.onNwinClose = function () {
        this.close();
    };
    RecentFilesWindowController.prototype.hide = function () {
        this.nwin.hide();
    };
    RecentFilesWindowController.textsPrefix = "plugin.notes2.window.recentfiles.";
    __decorate([
        Inject
    ], RecentFilesWindowController.prototype, "identity", void 0);
    RecentFilesWindowController = __decorate([
        Dependencies(["persons", "conversationlist", "conv2list", "extlist", "notification"])
    ], RecentFilesWindowController);
    return RecentFilesWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.RecentFilesWindowController = RecentFilesWindowController;
RecentFilesWindowController.prototype.className = "com.privmx.plugin.notes2.window.recentfiles.RecentFilesWindowController";

//# sourceMappingURL=RecentFilesWindowController.js.map
