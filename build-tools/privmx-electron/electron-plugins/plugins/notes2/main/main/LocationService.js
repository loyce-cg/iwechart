"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var Q = Mail.Q;
var LocationService = (function () {
    function LocationService(app, sectionManager, sinkIndexManager, conversationService) {
        this.app = app;
        this.sectionManager = sectionManager;
        this.sinkIndexManager = sinkIndexManager;
        this.conversationService = conversationService;
    }
    LocationService.prototype.getLocationsInfo = function () {
        var _this = this;
        var trees = {};
        return Q().then(function () {
            var privateSection = _this.sectionManager.getMyPrivateSection();
            var promises = !privateSection ? [Q()] : [privateSection.getFileTree().then(function (myTree) {
                    var locationInfo = {
                        type: "my",
                        locationName: "my",
                        tree: myTree,
                        section: privateSection
                    };
                    trees[myTree.root.ref.id] = locationInfo;
                    return myTree.refreshDeep(true);
                })];
            _this.sectionManager.filteredCollection.forEach(function (section) {
                if (section.isFileModuleEnabled()) {
                    promises.push(section.getFileTree().then(function (tree) {
                        var locationInfo = {
                            type: "channel",
                            scope: section.getScope(),
                            locationName: section.getName(),
                            tree: tree,
                            section: section
                        };
                        trees[tree.root.ref.id] = locationInfo;
                        return tree.refreshDeep(true);
                    }));
                }
            });
            return Q.all(promises);
        })
            .then(function () {
            return trees;
        });
    };
    LocationService.prototype.getLocationByEntryId = function (id, locations) {
        var _this = this;
        return Q().then(function () {
            var parsed = Mail.mail.filetree.nt.Entry.parseId(id);
            if (parsed) {
                for (var refId in locations) {
                    var loc = locations[refId];
                    if (loc.tree && loc.tree.section.getId() == parsed.sectionId) {
                        return loc;
                    }
                }
                return;
            }
            else if (id.indexOf("ref://") == 0) {
                var index = id.indexOf("/", 6);
                var rootId = id.substring(6, index);
                return locations[rootId];
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
                return {
                    type: "conversation",
                    locationName: _this.conversationService.getConversationId(entry)
                };
            }
        });
    };
    LocationService.prototype.getFilesMetaByIds = function (ids, dids, locations) {
        var _this = this;
        return Q().then(function () {
            var meta = {};
            var metaPromises = [];
            ids.forEach(function (id, idx) {
                var did = dids[idx];
                var parsed = Mail.mail.filetree.nt.Entry.parseId(id);
                var isRef = id.indexOf("ref://") == 0;
                if (parsed || isRef) {
                    var tree = void 0;
                    var path_1;
                    if (isRef) {
                        var index = id.indexOf("/", 6);
                        var rootId = id.substring(6, index);
                        path_1 = id.substring(index);
                        tree = locations[rootId].tree;
                    }
                    else {
                        for (var refId in locations) {
                            var loc = locations[refId];
                            if (loc.tree && loc.tree.section.getId() == parsed.sectionId) {
                                path_1 = parsed.path;
                                tree = loc.tree;
                                break;
                            }
                        }
                    }
                    if (tree == null) {
                        return;
                    }
                    var fileByDid = did ? tree.collection.find(function (x) { return x.ref.did == did; }) : null;
                    if (fileByDid) {
                        path_1 = fileByDid.path;
                    }
                    metaPromises.push(tree.fileSystem.stat(path_1, true).then(function (m) {
                        var mimeType = Mail.mail.filetree.MimeType.resolve2(Mail.mail.filetree.Path.parsePath(path_1).name.original, m.meta.mimeType);
                        meta[id] = {
                            icon: _this.app.shellRegistry.resolveIcon(mimeType),
                            meta: m.meta,
                            name: m.entry.name,
                        };
                    }).fail(function () {
                        return Q();
                    }));
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
                    var attachment = entry.getMessage().attachments[parseInt(splitted[2])];
                    if (attachment == null) {
                        return;
                    }
                    meta[id] = {
                        icon: _this.app.shellRegistry.resolveIcon(attachment.getMimeType()),
                        meta: {
                            modifiedDate: entry.getMessage().createDate.getTime(),
                            size: attachment.getSize()
                        },
                    };
                }
            });
            return Q.all(metaPromises).thenResolve(meta);
        });
    };
    return LocationService;
}());
exports.LocationService = LocationService;
LocationService.prototype.className = "com.privmx.plugin.notes2.main.LocationService";

//# sourceMappingURL=LocationService.js.map
