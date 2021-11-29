"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Common_1 = require("./Common");
var Helper = (function () {
    function Helper() {
    }
    Helper.convertConflictType = function (status) {
        if (status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE) {
            return Common_1.ConflictType.FILE_OVERWRITE;
        }
        if (status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORIES_MERGE) {
            return Common_1.ConflictType.DIRECTORIES_MERGE;
        }
        if (status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_FILE_OVERWRITE_BY_DIRECTORY) {
            return Common_1.ConflictType.FILE_OVERWRITE_BY_DIRECTORY;
        }
        if (status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.CONFLICT_DIRECTORY_OVERWRITE_BY_FILE) {
            return Common_1.ConflictType.DIRECTORY_OVERWRITE_BY_FILE;
        }
        throw new Error("Invalid status " + status);
    };
    Helper.convertOperationType = function (type) {
        if (type == pmc_mail_1.privfs.fs.file.multi.OperationType.COPY) {
            return Common_1.OperationType.COPY;
        }
        if (type == pmc_mail_1.privfs.fs.file.multi.OperationType.MOVE) {
            return Common_1.OperationType.MOVE;
        }
        if (type == pmc_mail_1.privfs.fs.file.multi.OperationType.REMOVE) {
            return Common_1.OperationType.REMOVE;
        }
        if (type == pmc_mail_1.privfs.fs.file.multi.OperationType.REMOVE_EMPTY_DIR) {
            return Common_1.OperationType.REMOVE;
        }
        throw new Error("Invalid operation type " + type);
    };
    return Helper;
}());
exports.Helper = Helper;
Helper.prototype.className = "com.privmx.plugin.notes2.main.Helper";

//# sourceMappingURL=Helper.js.map
