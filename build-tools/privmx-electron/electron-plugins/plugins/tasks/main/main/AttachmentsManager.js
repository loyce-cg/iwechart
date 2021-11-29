"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Attachment = (function () {
    function Attachment(attachmentInfo, currentSectionId) {
        this.justAdded = false;
        this.justRemoved = false;
        this.attachmentInfo = attachmentInfo;
        this.currentSectionId = currentSectionId;
    }
    return Attachment;
}());
exports.Attachment = Attachment;
var AttachmentsManager = (function () {
    function AttachmentsManager(session, tasksPlugin, historyManager) {
        this.session = session;
        this.tasksPlugin = tasksPlugin;
        this.historyManager = historyManager;
    }
    AttachmentsManager.prototype.reset = function (task, session) {
        if (task === void 0) { task = null; }
        if (session === void 0) { session = null; }
        this.attachments = [];
        if (session) {
            this.session = session;
        }
        if (task) {
            for (var _i = 0, _a = task.getAttachments(); _i < _a.length; _i++) {
                var attachmentInfoString = _a[_i];
                var attachmentInfo = JSON.parse(attachmentInfoString);
                this.add(attachmentInfo.did, attachmentInfo.name, task.getProjectId(), true);
            }
        }
    };
    AttachmentsManager.prototype.resetFromOpenableSectionFiles = function (openableSectionFiles) {
        this.reset();
        for (var _i = 0, openableSectionFiles_1 = openableSectionFiles; _i < openableSectionFiles_1.length; _i++) {
            var openableSectionFile = openableSectionFiles_1[_i];
            this.add(openableSectionFile.handle.ref.did, openableSectionFile.name, openableSectionFile.section.getId(), false);
        }
    };
    AttachmentsManager.prototype.add = function (did, fileName, sectionId, addAsExisting) {
        var currIndex = this.indexOf(did);
        if (currIndex >= 0) {
            var attachment_1 = this.at(currIndex);
            if (attachment_1.justRemoved) {
                this.attachments.splice(currIndex, 1);
                this.attachments.push(attachment_1);
                attachment_1.justRemoved = false;
            }
            return;
        }
        var attachment = new Attachment(AttachmentsManager.createAttachmentInfo(did, fileName), sectionId);
        attachment.justAdded = !addAsExisting;
        this.attachments.push(attachment);
    };
    AttachmentsManager.prototype.addOpenableSectionFile = function (openableSectionFile, addAsExisting) {
        this.add(openableSectionFile.handle.ref.did, openableSectionFile.name, openableSectionFile.section.getId(), addAsExisting);
    };
    AttachmentsManager.prototype.remove = function (did) {
        var attachment = this.find(did);
        if (attachment) {
            attachment.justRemoved = true;
        }
    };
    AttachmentsManager.prototype.find = function (did) {
        for (var _i = 0, _a = this.attachments; _i < _a.length; _i++) {
            var attachment = _a[_i];
            if (attachment.attachmentInfo.did == did) {
                return attachment;
            }
        }
        return null;
    };
    AttachmentsManager.prototype.indexOf = function (did) {
        for (var i = 0; i < this.attachments.length; ++i) {
            if (this.attachments[i].attachmentInfo.did == did) {
                return i;
            }
        }
        return -1;
    };
    AttachmentsManager.prototype.at = function (index) {
        return this.attachments[index];
    };
    AttachmentsManager.prototype.has = function (did) {
        return this.find(did) != null;
    };
    AttachmentsManager.prototype.update = function (oldDid, newDid) {
        var attachment = this.find(oldDid);
        if (attachment) {
            attachment.attachmentInfo.did = newDid;
            return true;
        }
        return false;
    };
    AttachmentsManager.prototype.isModified = function () {
        for (var _i = 0, _a = this.attachments; _i < _a.length; _i++) {
            var attachment = _a[_i];
            if (attachment.justAdded || attachment.justRemoved) {
                return true;
            }
        }
        return false;
    };
    AttachmentsManager.prototype.commit = function (destinationSection, task, handles) {
        var _this = this;
        var destinationSectionId = destinationSection.getId();
        var openableSectionFilesToBind = [];
        var openableSectionFilesToUnbind = [];
        var suppressAttachmentAddedHistory = [];
        var suppressAttachmentRemovedHistory = [];
        return pmc_mail_1.Q().then(function () {
            var openableSectionFilesToMovePromises = [];
            for (var _i = 0, _a = _this.attachments; _i < _a.length; _i++) {
                var attachment = _a[_i];
                if (attachment.currentSectionId != destinationSectionId) {
                    var section = _this.session.sectionManager.getSection(attachment.currentSectionId);
                    openableSectionFilesToMovePromises.push(_this.getOpenableSectionFileFromDid(attachment.attachmentInfo.did, section));
                }
            }
            return pmc_mail_1.Q.all(openableSectionFilesToMovePromises);
        })
            .then(function (openableSectionFilesToMove) {
            var uploadPromises = [];
            var _loop_1 = function (openableSectionFile) {
                var oldDid = openableSectionFile.handle.ref.did;
                uploadPromises.push(_this.session.sectionManager.uploadFile({
                    data: openableSectionFile.content,
                    destination: destinationSectionId,
                    path: "/",
                    noMessage: true,
                    copyFrom: openableSectionFile.id,
                    conflictBehavior: {
                        overwriteFile: true,
                    },
                })
                    .then(function (result) {
                    return { oldDid: oldDid, osf: result.fileResult.openableElement };
                }));
            };
            for (var _i = 0, openableSectionFilesToMove_1 = openableSectionFilesToMove; _i < openableSectionFilesToMove_1.length; _i++) {
                var openableSectionFile = openableSectionFilesToMove_1[_i];
                _loop_1(openableSectionFile);
            }
            return pmc_mail_1.Q.all(uploadPromises);
        })
            .then(function (movedOpenableSectionFiles) {
            for (var _i = 0, movedOpenableSectionFiles_1 = movedOpenableSectionFiles; _i < movedOpenableSectionFiles_1.length; _i++) {
                var movedFile = movedOpenableSectionFiles_1[_i];
                suppressAttachmentRemovedHistory.push(movedFile.oldDid);
                suppressAttachmentAddedHistory.push(movedFile.osf.handle.ref.did);
                _this.update(movedFile.oldDid, movedFile.osf.handle.ref.did);
                openableSectionFilesToBind.push(movedFile.osf);
            }
        })
            .then(function () {
            var openableSectionFilesToBindPromises = [];
            var openableSectionFilesToUnbindPromises = [];
            var _loop_2 = function (attachment) {
                if (attachment.justAdded) {
                    if (openableSectionFilesToBind.filter(function (x) { return x.handle.ref.did == attachment.attachmentInfo.did; }).length == 0) {
                        openableSectionFilesToBindPromises.push(_this.getOpenableSectionFileFromDid(attachment.attachmentInfo.did, destinationSection));
                    }
                }
                else if (attachment.justRemoved) {
                    if (openableSectionFilesToUnbind.filter(function (x) { return x.handle.ref.did == attachment.attachmentInfo.did; }).length == 0) {
                        openableSectionFilesToUnbindPromises.push(_this.getOpenableSectionFileFromDid(attachment.attachmentInfo.did, destinationSection));
                    }
                }
            };
            for (var _i = 0, _a = _this.attachments; _i < _a.length; _i++) {
                var attachment = _a[_i];
                _loop_2(attachment);
            }
            return pmc_mail_1.Q.all([pmc_mail_1.Q.all(openableSectionFilesToBindPromises), pmc_mail_1.Q.all(openableSectionFilesToUnbindPromises)]);
        })
            .then(function (data) {
            var _loop_3 = function (openableSectionFile) {
                if (openableSectionFilesToBind.filter(function (x) { return x.handle.ref.did == openableSectionFile.handle.ref.did; }).length == 0) {
                    openableSectionFilesToBind.push(openableSectionFile);
                }
            };
            for (var _i = 0, _a = data[0]; _i < _a.length; _i++) {
                var openableSectionFile = _a[_i];
                _loop_3(openableSectionFile);
            }
            var _loop_4 = function (openableSectionFile) {
                if (openableSectionFilesToUnbind.filter(function (x) { return x.handle.ref.did == openableSectionFile.handle.ref.did; }).length == 0) {
                    openableSectionFilesToUnbind.push(openableSectionFile);
                }
            };
            for (var _b = 0, _c = data[1]; _b < _c.length; _b++) {
                var openableSectionFile = _c[_b];
                _loop_4(openableSectionFile);
            }
        })
            .then(function () {
            var operationPromises = [];
            for (var _i = 0, openableSectionFilesToBind_1 = openableSectionFilesToBind; _i < openableSectionFilesToBind_1.length; _i++) {
                var openableSectionFile = openableSectionFilesToBind_1[_i];
                if (!openableSectionFile) {
                    continue;
                }
                var handle = _this.resolveFileHandle(openableSectionFile, handles);
                operationPromises.push(_this.bindFileToTask(openableSectionFile, task.getId(), handle));
            }
            for (var _a = 0, openableSectionFilesToUnbind_1 = openableSectionFilesToUnbind; _a < openableSectionFilesToUnbind_1.length; _a++) {
                var openableSectionFile = openableSectionFilesToUnbind_1[_a];
                if (!openableSectionFile) {
                    continue;
                }
                var handle = _this.resolveFileHandle(openableSectionFile, handles);
                operationPromises.push(_this.unbindFileFromTask(openableSectionFile, task.getId(), handle));
            }
            return pmc_mail_1.Q.all(operationPromises);
        })
            .then(function () {
            var attachments = _this.getAttachmentInfoStrings();
            var prevAttachments = task.getAttachments().slice();
            var newAttachments = attachments.slice();
            _this.historyManager.addFromAttachmentArrays(task, prevAttachments, newAttachments, suppressAttachmentAddedHistory, suppressAttachmentRemovedHistory);
            task.setAttachments(attachments);
            for (var _i = 0, openableSectionFilesToBind_2 = openableSectionFilesToBind; _i < openableSectionFilesToBind_2.length; _i++) {
                var openableSectionFile = openableSectionFilesToBind_2[_i];
                if (openableSectionFile) {
                    _this.tasksPlugin.triggerFileAttached(_this.session, openableSectionFile.handle.ref.did, task.getId());
                }
            }
            for (var _a = 0, openableSectionFilesToUnbind_2 = openableSectionFilesToUnbind; _a < openableSectionFilesToUnbind_2.length; _a++) {
                var openableSectionFile = openableSectionFilesToUnbind_2[_a];
                if (openableSectionFile) {
                    _this.tasksPlugin.triggerFileDetached(_this.session, openableSectionFile.handle.ref.did, task.getId());
                }
            }
        })
            .then(function () {
            for (var i = _this.attachments.length - 1; i >= 0; --i) {
                var attachment = _this.attachments[i];
                if (attachment.justRemoved) {
                    _this.attachments.splice(i, 1);
                    continue;
                }
                attachment.justAdded = false;
            }
        });
    };
    AttachmentsManager.prototype.getOpenableSectionFile = function (fileId) {
        return this.session.sectionManager.getFileOpenableElement(fileId, false, true);
    };
    AttachmentsManager.prototype.getOpenableSectionFileFromDid = function (did, section) {
        return pmc_mail_1.Q().then(function () {
            return section.getFileTree();
        })
            .then(function (tree) {
            var entry = tree.collection.find(function (x) { return x.ref.did == did; });
            if (!entry) {
                return tree.refreshDeep(false).then(function () {
                    entry = tree.collection.find(function (x) { return x.ref.did == did; });
                    return entry ? tree : null;
                });
            }
            return tree;
        })
            .then(function (tree) {
            if (!tree) {
                return null;
            }
            return tree.getPathFromDescriptor(did);
        })
            .then(function (path) {
            if (!path) {
                return null;
            }
            return section.getFileOpenableElement(path, false);
        });
    };
    AttachmentsManager.prototype.bindFileToTask = function (openableSectionFile, taskId, handle) {
        return this.tasksPlugin.addMetaBindedTaskIdOSF(openableSectionFile, taskId, handle).fail(function (e) {
            console.log("bindFileToTask:", e);
        });
    };
    AttachmentsManager.prototype.unbindFileFromTask = function (openableSectionFile, taskId, handle) {
        return this.tasksPlugin.removeMetaBindedTaskIdOSF(openableSectionFile, taskId, handle).fail(function (e) {
            console.log("unbindFileFromTask:", e);
        });
    };
    AttachmentsManager.prototype.resolveFileHandle = function (openableSectionFile, handles) {
        var handle = openableSectionFile.handle;
        if (handles && handle && handle.descriptor && handle.descriptor.ref) {
            var did_1 = handle.descriptor.ref.did;
            var handle2 = handles.filter(function (x) { return x && x.ref && x.ref.did == did_1; })[0];
            if (handle2) {
                handle = handle2;
            }
        }
        return handle;
    };
    AttachmentsManager.createAttachmentInfo = function (did, fileName) {
        var attachmentInfo = {
            did: did,
            name: fileName,
            trashed: false,
        };
        return attachmentInfo;
    };
    AttachmentsManager.createAttachmentInfoString = function (did, fileName) {
        return JSON.stringify(this.createAttachmentInfo(did, fileName));
    };
    AttachmentsManager.createAttachmentInfoFromOpenableSectionFile = function (openableSectionFile) {
        return this.createAttachmentInfo(openableSectionFile.handle.descriptor.ref.did, openableSectionFile.getName());
    };
    AttachmentsManager.createAttachmentInfoStringFromOpenableSectionFile = function (openableSectionFile) {
        return this.createAttachmentInfoString(openableSectionFile.handle.descriptor.ref.did, openableSectionFile.getName());
    };
    AttachmentsManager.prototype.createAttachmentInfoFromFileId = function (fileId) {
        return this.getOpenableSectionFile(fileId).then(function (osf) {
            return AttachmentsManager.createAttachmentInfoFromOpenableSectionFile(osf);
        });
    };
    AttachmentsManager.prototype.createAttachmentInfoStringFromFileId = function (fileId) {
        return this.getOpenableSectionFile(fileId).then(function (osf) {
            return AttachmentsManager.createAttachmentInfoStringFromOpenableSectionFile(osf);
        });
    };
    AttachmentsManager.prototype.getAttachmentInfoStrings = function () {
        return this.attachments.map(function (attachment) {
            if (attachment.justRemoved) {
                return null;
            }
            return JSON.stringify(attachment.attachmentInfo);
        }).filter(function (str) { return str != null; });
    };
    return AttachmentsManager;
}());
exports.AttachmentsManager = AttachmentsManager;
Attachment.prototype.className = "com.privmx.plugin.tasks.main.Attachment";
AttachmentsManager.prototype.className = "com.privmx.plugin.tasks.main.AttachmentsManager";

//# sourceMappingURL=AttachmentsManager.js.map
