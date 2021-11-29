"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SendingFileLocksManager = (function () {
    function SendingFileLocksManager() {
        this.locks = [];
    }
    SendingFileLocksManager.prototype.lock = function (file) {
        if (this.isLocked(file)) {
            return false;
        }
        var lock = this.getSendingFileLockFromFile(file);
        this.locks.push(lock);
    };
    SendingFileLocksManager.prototype.lockMany = function (files) {
        if (this.isAnyLocked(files)) {
            return false;
        }
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            this.lock(file);
        }
        return true;
    };
    SendingFileLocksManager.prototype.unlock = function (file) {
        if (!this.isLocked(file)) {
            return;
        }
        var idx = this.indexOfLock(file);
        this.locks.splice(idx, 1);
    };
    SendingFileLocksManager.prototype.unlockMany = function (files) {
        for (var _i = 0, files_2 = files; _i < files_2.length; _i++) {
            var file = files_2[_i];
            this.unlock(file);
        }
    };
    SendingFileLocksManager.prototype.indexOfLock = function (file) {
        for (var i = 0; i < this.locks.length; ++i) {
            if (this.locks[i].file == file) {
                return i;
            }
        }
        return -1;
    };
    SendingFileLocksManager.prototype.isLocked = function (file) {
        return this.indexOfLock(file) >= 0;
    };
    SendingFileLocksManager.prototype.isAnyLocked = function (files) {
        for (var _i = 0, files_3 = files; _i < files_3.length; _i++) {
            var file = files_3[_i];
            if (this.isLocked(file)) {
                return true;
            }
        }
        return false;
    };
    SendingFileLocksManager.prototype.filterOutLocked = function (files) {
        var newFiles = [];
        for (var _i = 0, files_4 = files; _i < files_4.length; _i++) {
            var file = files_4[_i];
            if (!this.isLocked(file)) {
                newFiles.push(file);
            }
        }
        return newFiles;
    };
    SendingFileLocksManager.prototype.getSendingFileLockFromFile = function (file) {
        return {
            file: file,
        };
    };
    return SendingFileLocksManager;
}());
exports.SendingFileLocksManager = SendingFileLocksManager;
SendingFileLocksManager.prototype.className = "com.privmx.plugin.chat.component.chatmessages.SendingFileLocksManager";

//# sourceMappingURL=SendingFileLocksManager.js.map
