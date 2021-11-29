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
var fs = require("fs");
var origFs = require("original-fs");
var ncp = require("ncp");
var pathUtils = require("path");
var os = require("os");
var pmc_mail_1 = require("pmc-mail");
var hidefile = require("hidefile");
var LocalEntry = (function () {
    function LocalEntry(obj) {
        for (var key in obj) {
            this[key] = obj[key];
        }
    }
    LocalEntry.prototype.isDirectory = function () {
        return this.type == "directory";
    };
    LocalEntry.prototype.isFile = function () {
        return this.type == "file";
    };
    return LocalEntry;
}());
exports.LocalEntry = LocalEntry;
var LocalOpenableElement = (function (_super) {
    __extends(LocalOpenableElement, _super);
    function LocalOpenableElement(entry, content) {
        var _this = _super.call(this, content) || this;
        _this.openableElementType = "LocalOpenableElement";
        _this.entry = entry;
        return _this;
    }
    LocalOpenableElement.createSync = function (data) {
        var entry = data instanceof LocalEntry ? data : LocalFS.getEntry(data);
        if (!entry.isFile()) {
            throw new Error("Entry is not a file");
        }
        return new LocalOpenableElement(entry, new pmc_mail_1.privfs.lazyBuffer.NodeFileLazyContent(entry.path, entry.mime));
    };
    LocalOpenableElement.create = function (data) {
        return pmc_mail_1.Q().then(function () { return LocalOpenableElement.createSync(data); });
    };
    LocalOpenableElement.prototype.isEditable = function () {
        return LocalFS.isWritable(this.entry.path, false);
    };
    LocalOpenableElement.prototype.isLocalFile = function () {
        return true;
    };
    LocalOpenableElement.prototype.save = function (data) {
        var _this = this;
        return pmc_mail_1.Q(data.getBuffer()).then(function (buff) {
            return LocalFS.writeFile(_this.entry.path, buff);
        });
    };
    LocalOpenableElement.prototype.equals = function (ele) {
        if (!(ele instanceof LocalOpenableElement)) {
            return false;
        }
        return ele.entry.id == this.entry.id;
    };
    LocalOpenableElement.prototype.getCreateDate = function () {
        return this.entry.ctime;
    };
    LocalOpenableElement.prototype.getModifiedDate = function () {
        return this.entry.mtime;
    };
    LocalOpenableElement.prototype.hasElementId = function () {
        return true;
    };
    LocalOpenableElement.prototype.getElementId = function () {
        return this.entry.id;
    };
    LocalOpenableElement.prototype.reopenRenamed = function (newName) {
        var newPath = this.entry.path.substr(0, this.entry.path.lastIndexOf("/") + 1) + newName;
        var el = LocalOpenableElement.createSync(newPath);
        this.entry = el.entry;
        this.name = newName;
    };
    LocalOpenableElement.prototype.rename = function (newName) {
        return LocalFS.rename(this.entry.path, newName);
    };
    return LocalOpenableElement;
}(pmc_mail_1.app.common.shelltypes.OpenableElement));
exports.LocalOpenableElement = LocalOpenableElement;
var LocalFS = (function () {
    function LocalFS(collection, path, onPathChange) {
        this.onPathChange = onPathChange;
        this.currentPath = null;
        this.currentFileNamesCollection = collection;
        this.browse(path);
    }
    LocalFS.staticConstructor = function (app) {
        if (app.isElectronApp()) {
            LocalFS.prepareSpecialFoldersList();
            if (LocalFS.trash == null) {
                LocalFS.trash = require("trash");
            }
        }
        this.isWindows = process.platform == "win32";
    };
    LocalFS.prototype.browse = function (path) {
        var _this = this;
        if (path == "" || !LocalFS.exists(path) || !LocalFS.isDir(path) || !LocalFS.isReadable(path, true)) {
            path = LocalFS.getHomeDir();
        }
        this.currentPath = path;
        return LocalFS.listEntries(path).then(function (fileNames) {
            _this.watch(path);
            var arr = [];
            var parentEntry = LocalFS.getEntry(path);
            fileNames.forEach(function (fn) {
                var entry = LocalFS.getEntry(fn, parentEntry);
                if (!entry) {
                    return;
                }
                if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                    arr.push(entry);
                }
            });
            _this.currentFileNamesCollection.clear();
            _this.currentFileNamesCollection.addAll(arr);
            _this.onPathChange(_this.currentPath);
        });
    };
    LocalFS.prototype.browseWithParent = function (path) {
        var _this = this;
        if (path == "" || !LocalFS.exists(path) || !LocalFS.isDir(path) || !LocalFS.isReadable(path, true)) {
            path = LocalFS.getHomeDir();
        }
        this.currentPath = path;
        return LocalFS.listEntries(path).then(function (fileNames) {
            var arr = [];
            var currentEntry = LocalFS.getEntry(path);
            var parentEntry = LocalFS.getEntry(pathUtils.join(path, ".."));
            fileNames.forEach(function (fn) {
                var entry = LocalFS.getEntry(fn, currentEntry);
                if (!entry) {
                    return;
                }
                if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                    if (LocalFS.isWindows && entry.path.endsWith(":\\")) {
                        entry.name = entry.path;
                    }
                    arr.push(entry);
                }
            });
            if (parentEntry && _this.currentPath != "/") {
                var isWindowsTopDriveDir = LocalFS.isWindows && path.endsWith(":\\");
                if (isWindowsTopDriveDir) {
                    parentEntry.path = "/";
                }
                parentEntry.name = "..";
                parentEntry.id = "parent";
                arr = [parentEntry].concat(arr);
            }
            _this.currentFileNamesCollection.clear();
            _this.currentFileNamesCollection.addAll(arr);
            _this.onPathChange(_this.currentPath);
        });
    };
    LocalFS.prototype.browseEx = function (path) {
        if (path == "" || !LocalFS.exists(path) || !LocalFS.isDir(path) || !LocalFS.isReadable(path, true)) {
            path = LocalFS.getHomeDir();
        }
        this.currentPath = path;
        return LocalFS.listEntries(path).then(function (fileNames) {
            var arr = [];
            var parentEntry = LocalFS.getEntry(path);
            fileNames.forEach(function (fn) {
                var entry = LocalFS.getEntry(fn, parentEntry);
                if (!entry) {
                    return;
                }
                if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                    arr.push(entry);
                }
            });
            return arr;
        });
    };
    LocalFS.listEntries = function (path) {
        if (path != "/") {
            if (!LocalFS.isReadable(path, true)) {
                return pmc_mail_1.Q([]);
            }
        }
        var deferred = pmc_mail_1.Q.defer();
        if (path == "/" && LocalFS.isWindows) {
            LocalFS.importDiskModule().then(function (nodeDiskInfo) {
                nodeDiskInfo.getDiskInfo()
                    .then(function (drivesInfo) {
                    var driveNamesList = drivesInfo.map(function (x) { return x.mounted + "\\"; });
                    deferred.resolve(driveNamesList);
                });
            });
        }
        else {
            fs.readdir(path, function (err, fileNames) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(fileNames.map(function (fn) { return pathUtils.join(path, fn); }));
                }
            });
        }
        return deferred.promise;
    };
    LocalFS.moveToTrash = function (path) {
        return pmc_mail_1.Q(LocalFS.trash(path, { glob: false }));
    };
    LocalFS.isHomeSpecialFolder = function (parentEntry, path) {
        var specialFolders = LocalFS.getSpecialFoldersList();
        if (process.platform == "darwin") {
            if (parentEntry && parentEntry.path == os.homedir() && specialFolders.includes(pathUtils.resolve(parentEntry.path, path))) {
                return true;
            }
            if (!parentEntry && specialFolders.includes(path)) {
                return true;
            }
        }
        return false;
    };
    LocalFS.getSpecialFoldersList = function () {
        return LocalFS.specialFolders;
    };
    LocalFS.prepareSpecialFoldersList = function () {
        var homedir = LocalFS.getHomeDir();
        LocalFS.specialFolders = [
            pathUtils.resolve(homedir, "Desktop"),
            pathUtils.resolve(homedir, "Application"),
            pathUtils.resolve(homedir, "Documents"),
            pathUtils.resolve(homedir, "Downloads"),
            pathUtils.resolve(homedir, "Movies"),
            pathUtils.resolve(homedir, "Music"),
        ];
    };
    LocalFS.getEntry = function (path, parentEntry) {
        if (parentEntry === void 0) { parentEntry = null; }
        var stat;
        var isHidden;
        try {
            stat = origFs.lstatSync(path);
            try {
                isHidden = hidefile.isHiddenSync(path);
            }
            catch (e) {
                isHidden = true;
            }
        }
        catch (e) {
            return null;
        }
        var type = null;
        var dirStats = null;
        var mime = "";
        if (stat.isDirectory()) {
            type = "directory";
            var counts = { directories: 0, files: 0 };
            if (!LocalFS.isHomeSpecialFolder(parentEntry, path)) {
                counts = LocalFS.countChildren(path);
            }
            dirStats = {
                directoriesCount: counts.directories,
                filesCount: counts.files,
                filesSize: stat.size,
                modifiedDate: stat.mtime.getTime(),
            };
        }
        else if (stat.isFile()) {
            type = "file";
            mime = pmc_mail_1.mail.filetree.MimeType.resolve(pathUtils.basename(path));
        }
        else {
            return null;
        }
        return new LocalEntry({
            id: path,
            path: path,
            name: pathUtils.basename(path),
            parent: parentEntry,
            type: type,
            size: stat.size,
            mtime: stat.mtime,
            ctime: stat.ctime,
            mime: mime,
            dirStats: dirStats,
            hidden: isHidden
        });
    };
    LocalFS.getParentEntry = function (entry) {
        var path = pathUtils.dirname(entry.path);
        return LocalFS.getEntry(path);
    };
    LocalFS.getDirName = function (path) {
        return pathUtils.dirname(path);
    };
    LocalFS.countChildren = function (path) {
        var nFiles = 0;
        var nDirectories = 0;
        try {
            fs.readdirSync(path).forEach(function (fn) {
                var fullPath = pathUtils.join(path, fn);
                var stat = fs.lstatSync(fullPath);
                if (stat.isFile()) {
                    nFiles++;
                }
                else if (stat.isDirectory()) {
                    nDirectories++;
                }
            });
        }
        catch (e) { }
        return { directories: nDirectories, files: nFiles };
    };
    LocalFS.isDir = function (path) {
        return fs.lstatSync(path).isDirectory();
    };
    LocalFS.createDir = function (path) {
        var deferred = pmc_mail_1.Q.defer();
        if (LocalFS.exists(path)) {
            deferred.resolve(false);
        }
        else {
            fs.mkdir(path, function (err) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(true);
                }
            });
        }
        return deferred.promise;
    };
    LocalFS.deleteDir = function (path, moveToTrash) {
        if (moveToTrash === void 0) { moveToTrash = true; }
        var deferred = pmc_mail_1.Q.defer();
        LocalFS.listEntries(path).then(function (entries) {
            if (!moveToTrash && entries.length > 0) {
                deferred.reject(LocalFS.REJECT_DIR_NOT_EMPTY);
            }
            else {
                if (moveToTrash) {
                    LocalFS.moveToTrash(path).then(function () {
                        deferred.resolve();
                    }).catch(function (err) {
                        deferred.reject(err);
                    });
                }
                else {
                    fs.rmdir(path, function (err) {
                        if (err) {
                            deferred.reject(err);
                        }
                        else {
                            deferred.resolve();
                        }
                    });
                }
            }
        });
        return deferred.promise;
    };
    LocalFS.copyDir = function (srcFilePath, dstFilePath, overwriteExisting) {
        var deferred = pmc_mail_1.Q.defer();
        ncp.ncp(srcFilePath, dstFilePath, { clobber: overwriteExisting }, function (err) {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    LocalFS.readFile = function (path, buff) {
        if (buff === void 0) { buff = false; }
        var deferred = pmc_mail_1.Q.defer();
        var encoding = buff ? null : "utf8";
        fs.readFile(path, encoding, function (err, data) {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(buff ? data : data.toString());
            }
        });
        return deferred.promise;
    };
    LocalFS.writeFile = function (path, content) {
        var deferred = pmc_mail_1.Q.defer();
        fs.writeFile(path, content, function (err) {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    LocalFS.writeFileEx = function (path, content) {
        var _this = this;
        if (this.exists(path)) {
            return this.readFile(path).then(function (data) {
                var currStr = data;
                var newStr = content instanceof Buffer ? content.toString() : content;
                if (newStr == currStr) {
                    return;
                }
                else {
                    path = _this.getAltPath2(path);
                    return _this.writeFile(path, content);
                }
            });
        }
        else {
            return this.writeFile(path, content);
        }
    };
    LocalFS.createFile = function (path) {
        if (LocalFS.exists(path)) {
            return pmc_mail_1.Q.reject("File already exists");
        }
        return LocalFS.writeFile(path, "");
    };
    LocalFS.deleteFile = function (path, moveToTrash) {
        if (moveToTrash === void 0) { moveToTrash = true; }
        if (moveToTrash) {
            return LocalFS.moveToTrash(path);
        }
        else {
            var deferred_1 = pmc_mail_1.Q.defer();
            fs.unlink(path, function (err) {
                if (err) {
                    deferred_1.reject(err);
                }
                else {
                    deferred_1.resolve();
                }
            });
            return deferred_1.promise;
        }
    };
    LocalFS.copyFile = function (srcFilePath, dstFilePath, allowOverwrite) {
        var deferred = pmc_mail_1.Q.defer();
        if (!allowOverwrite && LocalFS.exists(dstFilePath)) {
            deferred.resolve(false);
        }
        else {
            var rs = fs.createReadStream(srcFilePath);
            var ws = fs.createWriteStream(dstFilePath);
            rs.on("error", function (err) { deferred.reject(err); });
            ws.on("error", function (err) { deferred.reject(err); });
            ws.on("close", function () { deferred.resolve(true); });
            rs.pipe(ws);
        }
        return deferred.promise;
    };
    LocalFS.prototype.watch = function (path) {
        var _this = this;
        this.unwatch();
        var parentEntry = LocalFS.getEntry(path);
        return this.watched = fs.watch(path, function (evt, fn) {
            var fnPath = pathUtils.join(path, fn);
            var entry = LocalFS.getEntry(fnPath, parentEntry);
            if (!entry) {
                _this.currentFileNamesCollection.removeBy("name", fn);
                return;
            }
            if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                var idx = _this.currentFileNamesCollection.indexOfBy(function (it) { return it.id == entry.id; });
                if (idx >= 0) {
                    _this.currentFileNamesCollection.triggerUpdateAt(idx);
                }
                else {
                    _this.currentFileNamesCollection.add(entry);
                }
            }
        });
    };
    LocalFS.prototype.unwatch = function () {
        if (this.watched) {
            this.watched.close();
        }
    };
    LocalFS.importDiskModule = function () {
        return __awaiter(this, void 0, void 0, function () {
            var importedModule;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, Promise.resolve().then(function () { return require("node-disk-info"); })];
                    case 1:
                        importedModule = _a.sent();
                        return [2, importedModule];
                }
            });
        });
    };
    LocalFS.isReadable = function (path, isDir) {
        if (isDir === void 0) { isDir = false; }
        try {
            fs.accessSync(path, isDir ? (fs.constants.R_OK | fs.constants.X_OK) : fs.constants.W_OK);
        }
        catch (e) {
            return false;
        }
        return true;
    };
    LocalFS.isWritable = function (path, isDir) {
        if (isDir === void 0) { isDir = false; }
        try {
            fs.accessSync(path, isDir ? (fs.constants.W_OK | fs.constants.X_OK) : fs.constants.W_OK);
        }
        catch (e) {
            return false;
        }
        return true;
    };
    LocalFS.exists = function (path) {
        try {
            fs.accessSync(path, fs.constants.F_OK);
        }
        catch (e) {
            return false;
        }
        return true;
    };
    LocalFS.isDeletable = function (path) {
        return LocalFS.isWritable(pathUtils.dirname(path), true);
    };
    LocalFS.isRenamable = function (path) {
        return LocalFS.isWritable(pathUtils.dirname(path), true);
    };
    LocalFS.rename = function (oldPath, newName) {
        var deferred = pmc_mail_1.Q.defer();
        var newPath = pathUtils.join(pathUtils.dirname(oldPath), newName);
        fs.rename(oldPath, newPath, function (err) {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    LocalFS.move = function (oldPath, newPath, allowOverwrite) {
        var deferred = pmc_mail_1.Q.defer();
        if (!allowOverwrite && LocalFS.exists(newPath)) {
            deferred.resolve(false);
        }
        else {
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(true);
                }
            });
        }
        return deferred.promise;
    };
    LocalFS.isNameValid = function (name) {
        var valid = true;
        var forbiddenCharacters = (LocalFS.isWindows ? "<>:\"/\\|?*" : "/").split("");
        forbiddenCharacters.forEach(function (c) {
            if (name.indexOf(c) >= 0) {
                valid = false;
            }
        });
        return valid;
    };
    LocalFS.joinPath = function (path, name) {
        return pathUtils.join(path, name);
    };
    LocalFS.getFileName = function (path, ext) {
        if (ext === void 0) { ext = null; }
        return pathUtils.basename(path, ext ? ext : "");
    };
    LocalFS.getExt = function (path) {
        return pathUtils.extname(path);
    };
    LocalFS.getAltPath = function (dstDir, fileName) {
        var dstPath = LocalFS.joinPath(dstDir, fileName);
        var id = 1;
        var ext = LocalFS.getExt(fileName);
        var bn = LocalFS.getFileName(fileName, ext);
        while (id < 1000 && LocalFS.exists(dstPath)) {
            dstPath = LocalFS.joinPath(dstDir, bn + "(" + (id++) + ")" + ext);
        }
        return dstPath;
    };
    LocalFS.getAltPath2 = function (dstPath) {
        return this.getAltPath(pathUtils.dirname(dstPath), pathUtils.basename(dstPath));
    };
    LocalFS.getHomeDir = function () {
        return os.homedir();
    };
    LocalFS.REJECT_DIR_NOT_EMPTY = "dir-not-empty";
    LocalFS.specialFolders = [];
    LocalFS.isWindows = false;
    LocalFS.trash = null;
    return LocalFS;
}());
exports.LocalFS = LocalFS;
LocalEntry.prototype.className = "com.privmx.plugin.notes2.main.LocalEntry";
LocalOpenableElement.prototype.className = "com.privmx.plugin.notes2.main.LocalOpenableElement";
LocalFS.prototype.className = "com.privmx.plugin.notes2.main.LocalFS";

//# sourceMappingURL=LocalFS.js.map
