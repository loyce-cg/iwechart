"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ConflictType;
(function (ConflictType) {
    ConflictType[ConflictType["FILE_OVERWRITE"] = 0] = "FILE_OVERWRITE";
    ConflictType[ConflictType["DIRECTORIES_MERGE"] = 1] = "DIRECTORIES_MERGE";
    ConflictType[ConflictType["DIRECTORY_OVERWRITE_BY_FILE"] = 2] = "DIRECTORY_OVERWRITE_BY_FILE";
    ConflictType[ConflictType["FILE_OVERWRITE_BY_DIRECTORY"] = 3] = "FILE_OVERWRITE_BY_DIRECTORY";
})(ConflictType = exports.ConflictType || (exports.ConflictType = {}));
var OperationType;
(function (OperationType) {
    OperationType[OperationType["MOVE"] = 0] = "MOVE";
    OperationType[OperationType["COPY"] = 1] = "COPY";
    OperationType[OperationType["REMOVE"] = 2] = "REMOVE";
})(OperationType = exports.OperationType || (exports.OperationType = {}));
var FilesConst = (function () {
    function FilesConst() {
    }
    FilesConst.TRASH_ENTRY = ".trash";
    FilesConst.TRASH_PATH = "/" + FilesConst.TRASH_ENTRY;
    return FilesConst;
}());
exports.FilesConst = FilesConst;
var ViewContext;
(function (ViewContext) {
    ViewContext["Global"] = "global";
    ViewContext["Notes2Window"] = "notes2";
    ViewContext["SummaryWindow"] = "summary";
    ViewContext["FileChooser"] = "filechooser";
})(ViewContext = exports.ViewContext || (exports.ViewContext = {}));
var SelectionChangeMode;
(function (SelectionChangeMode) {
    SelectionChangeMode[SelectionChangeMode["CHANGE"] = 0] = "CHANGE";
    SelectionChangeMode[SelectionChangeMode["EXTEND"] = 1] = "EXTEND";
    SelectionChangeMode[SelectionChangeMode["SHRINK"] = 2] = "SHRINK";
})(SelectionChangeMode = exports.SelectionChangeMode || (exports.SelectionChangeMode = {}));
FilesConst.prototype.className = "com.privmx.plugin.notes2.main.FilesConst";

//# sourceMappingURL=Common.js.map
