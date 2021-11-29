"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var Q = Mail.Q;
var LocalFS_1 = require("./LocalFS");
var Logger = Mail.Logger.get("privfs-notes2-plugin.RecentFiles");
var RecentService = (function () {
    function RecentService(app, sectionManager, userPreferences, sinkIndexManager, notes2Plugin) {
        this.app = app;
        this.sectionManager = sectionManager;
        this.userPreferences = userPreferences;
        this.sinkIndexManager = sinkIndexManager;
        this.notes2Plugin = notes2Plugin;
        this.recentOpenFiles = null;
    }
    RecentService.prototype.saveRecentFilesToPreferences = function (items) {
        var itemsToSave = items.slice(0, RecentService.RECENT_FILES_LIMIT);
        return this.userPreferences.set(RecentService.RECENT_FILES_PREFERENCES_KEY, JSON.stringify(itemsToSave), true);
    };
    RecentService.prototype.getRecentFilesFromPreferences = function () {
        var _this = this;
        return Q().then(function () {
            if (_this.app.mailClientApi == null || _this.userPreferences == null) {
                return [];
            }
            return Q().then(function () {
                return _this.userPreferences.get(RecentService.RECENT_FILES_PREFERENCES_KEY, null);
            })
                .then(function (data) {
                return data ? JSON.parse(data) : [];
            });
        });
    };
    RecentService.prototype.addRecentOpenedFile = function (event) {
        var _this = this;
        if (event.hostHash != this.app.sessionManager.getLocalSession().hostHash) {
            return Q();
        }
        return Q().then(function () {
            return _this.getRecentOpenedFiles();
        }).then(function () {
            if (!event.element.hasElementId() || !event.element.isEditable() || event.docked || event.action == Mail.app.common.shelltypes.ShellOpenAction.PREVIEW) {
                return;
            }
            var item = {
                id: event.element.getElementId(),
                name: event.element.getName(),
                action: event.action,
                isLocal: event.element instanceof LocalFS_1.LocalOpenableElement,
                did: event.element instanceof Mail.mail.section.OpenableSectionFile ? event.element.handle.ref.did : null,
            };
            var fileIndex = -1;
            do {
                fileIndex = -1;
                for (var i = 0; i < _this.recentOpenFiles.length; i++) {
                    if ((item.did && _this.recentOpenFiles[i].did == item.did) || (!item.did && _this.recentOpenFiles[i].id == item.id)) {
                        fileIndex = i;
                        break;
                    }
                }
                if (fileIndex > -1) {
                    _this.recentOpenFiles.splice(fileIndex, 1);
                }
            } while (fileIndex > -1);
            _this.recentOpenFiles.unshift(item);
            return _this.saveRecentFilesToPreferences(_this.recentOpenFiles);
        });
    };
    RecentService.prototype.removeRecentOpenedFile = function (fileId, did) {
        if (!this.recentOpenFiles) {
            return Q();
        }
        var fileIndex = -1;
        for (var i = 0; i < this.recentOpenFiles.length; i++) {
            if ((did && this.recentOpenFiles[i].did == did) || (!did && this.recentOpenFiles[i].id == fileId)) {
                fileIndex = i;
                break;
            }
        }
        if (fileIndex > -1) {
            this.recentOpenFiles.splice(fileIndex, 1);
        }
        return this.saveRecentFilesToPreferences(this.recentOpenFiles);
    };
    RecentService.prototype.saveCurrentList = function () {
        return this.saveRecentFilesToPreferences(this.recentOpenFiles);
    };
    RecentService.prototype.getRecentOpenedFiles = function () {
        var _this = this;
        return this.getRecentFilesFromPreferences()
            .then(function (list) {
            _this.recentOpenFiles = list;
            var maxFiles = _this.recentOpenFiles.length >= RecentService.RECENT_FILES_LIMIT ? RecentService.RECENT_FILES_LIMIT : _this.recentOpenFiles.length;
            return _this.recentOpenFiles.slice(0, maxFiles);
        });
    };
    RecentService.prototype.openLastFileFromRecent = function (session) {
        var _this = this;
        return Q(null).then(function () {
            return _this.getRecentOpenedFiles()
                .then(function (list) {
                if (list.length > 0) {
                    var fileItem_1 = list[0];
                    return _this.getRecentFileToOpen(fileItem_1.id, fileItem_1.did)
                        .then(function (element) {
                        var action = fileItem_1.action || Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL;
                        _this.app.shellRegistry.shellOpen({
                            action: action,
                            element: element,
                            session: session
                        });
                    });
                }
                else {
                    return null;
                }
            });
        });
    };
    RecentService.prototype.getRecentFileToOpen = function (id, did) {
        var _this = this;
        var localRecentOpenedFile = this.recentOpenFiles && this.recentOpenFiles.filter(function (x) { return x.id == id && x.isLocal; });
        if (localRecentOpenedFile.length > 0) {
            if (!LocalFS_1.LocalFS.exists(id)) {
                return Q(null);
            }
            return LocalFS_1.LocalOpenableElement.create(id);
        }
        return Q().then(function () {
            var parsed = Mail.mail.filetree.nt.Entry.parseId(id);
            var isRef = id.indexOf("ref://") == 0;
            if (parsed || isRef) {
                var sectionId_1;
                var path_1;
                return Q().then(function () {
                    if (isRef) {
                        var index = id.indexOf("/", 6);
                        sectionId_1 = id.substring(6, index);
                        path_1 = id.substring(index);
                    }
                    else {
                        sectionId_1 = parsed.sectionId;
                        path_1 = parsed.path;
                    }
                    var section = _this.sectionManager.filteredCollection.find(function (x) { return x.getId() == sectionId_1; });
                    if (section) {
                        return section.getFileTree();
                    }
                    return null;
                })
                    .then(function (tree) {
                    if (tree == null) {
                        return;
                    }
                    if (did) {
                        var fileByDid = tree.collection.find(function (x) { return x.ref.did == did; });
                        if (!fileByDid) {
                            return;
                        }
                        path_1 = fileByDid.path;
                    }
                    if (tree.collection.indexOfBy(function (x) { return x.path == path_1; }) < 0) {
                        return;
                    }
                    return tree.section.getFileOpenableElement(path_1, true)
                        .then(function (openableElement) {
                        if (!openableElement) {
                            return tree.refreshDeep(true).then(function () {
                                return tree.section.getFileOpenableElement(path_1, true);
                            });
                        }
                        return openableElement;
                    });
                });
            }
            else {
                var splitted = id.split("/");
                var sinkIndex = _this.sinkIndexManager.getSinkIndexById(splitted[0]);
                if (sinkIndex == null) {
                    return;
                }
                var entry = sinkIndex.getEntry(parseInt(splitted[1]));
                if (entry == null) {
                    return;
                }
                var message = entry.getMessage();
                var attachmentIndex = parseInt(splitted[2]);
                var attachment = message.attachments[attachmentIndex];
                if (attachment == null) {
                    return;
                }
                return Mail.app.common.shelltypes.OpenableAttachment.create(attachment, true, true);
            }
        });
    };
    RecentService.prototype.clearRecentFiles = function () {
        return this.userPreferences.set(RecentService.RECENT_FILES_PREFERENCES_KEY, null, true);
    };
    RecentService.prototype.onFileRenamed = function (did, oldPath, newPath) {
        if (!this.recentOpenFiles) {
            return;
        }
        var elem = this.recentOpenFiles.filter(function (x) { return x.did == did; })[0];
        if (!elem || !elem.id.startsWith("section|file|")) {
            return;
        }
        var pathStartIdx = elem.id.indexOf("|/");
        var sectionPrefix = elem.id.substr(0, pathStartIdx + 1);
        var newId = sectionPrefix + newPath;
        var newName = newPath.substr(newPath.lastIndexOf("/") + 1);
        elem.id = newId;
        elem.name = newName;
        this.notes2Plugin.afterRecentFileRenamed(elem);
        this.saveCurrentList();
    };
    RecentService.prototype.onLocalFileRenamed = function (oldPath, newPath) {
        if (!this.recentOpenFiles) {
            return;
        }
        var elem = this.recentOpenFiles.filter(function (x) { return x.id == oldPath; })[0];
        if (!elem) {
            return;
        }
        var newName = newPath.substr(newPath.lastIndexOf("/") + 1);
        elem.id = newPath;
        elem.name = newName;
        this.notes2Plugin.afterRecentFileRenamed(elem);
        this.saveCurrentList();
    };
    RecentService.prototype.getDid = function () {
    };
    RecentService.RECENT_FILES_PREFERENCES_KEY = "notes2-plugin.recentFiles";
    RecentService.RECENT_FILES_LIMIT = 100;
    return RecentService;
}());
exports.RecentService = RecentService;
RecentService.prototype.className = "com.privmx.plugin.notes2.main.RecentService";

//# sourceMappingURL=RecentService.js.map
