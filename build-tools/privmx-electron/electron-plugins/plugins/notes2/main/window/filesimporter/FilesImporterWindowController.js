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
var i18n_1 = require("./i18n");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var LocalFS_1 = require("../../main/LocalFS");
var FilesTree_1 = require("./FilesTree");
var FilesImporterUtils_1 = require("./FilesImporterUtils");
var ProcessingQueue_1 = require("./ProcessingQueue");
var SectionsPickerPanelController_1 = require("./pickerpanel/SectionsPickerPanelController");
var FilesPickerPanelController_1 = require("./pickerpanel/FilesPickerPanelController");
var FilesToImportPanelController_1 = require("./pickerpanel/FilesToImportPanelController");
var Logger = pmc_mail_1.Logger.get("notes2.FilesImporterWindowController");
var FilesImporterWindowController = (function (_super) {
    __extends(FilesImporterWindowController, _super);
    function FilesImporterWindowController(parentWindow, section, sectionDestinationDir, browsingDir) {
        var _this = _super.call(this, parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "panels-splitter": {
                    defaultValue: Math.round(FilesImporterWindowController_1.DEFAULT_WINDOW_WIDTH / 2),
                }
            }
        }) || this;
        _this.section = section;
        _this.currentBrowsingDir = null;
        _this.showHiddenFiles = false;
        _this.ipcMode = true;
        _this.setPluginViewAssets("notes2");
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
        _this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            minWidth: 600,
            width: FilesImporterWindowController_1.DEFAULT_WINDOW_WIDTH,
            height: 400,
            resizable: true,
            icon: "icon fa fa-upload",
            title: _this.i18n("plugin.notes2.window.filesimporter.title")
        };
        _this.importerUtils = new FilesImporterUtils_1.FilesImporterUtils(_this.app);
        _this.sectionDestinationDir = sectionDestinationDir;
        _this.currentFsDirCollection = _this.addComponent("currentFsDirCollection", new pmc_mail_1.utils.collection.MutableCollection());
        _this.filesTree = new FilesTree_1.FilesTree();
        _this.treeProcessingQueue = new ProcessingQueue_1.ProcessingQueue();
        return _this;
    }
    FilesImporterWindowController_1 = FilesImporterWindowController;
    FilesImporterWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    FilesImporterWindowController.prototype.setSession = function (session) {
        this.session = session;
    };
    FilesImporterWindowController.prototype.getSession = function () {
        return this.session ? this.session : this.app.sessionManager.getLocalSession();
    };
    FilesImporterWindowController.prototype.init = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.loadSettings();
        })
            .then(function () {
            _this.localFS = new LocalFS_1.LocalFS(_this.currentFsDirCollection, "", function (newPath) {
                _this.setCurrentDir(newPath);
                _this.processNewPath(newPath, _this.localFS.currentFileNamesCollection);
            });
            _this.initComponents();
            _this.localFS.browseWithParent(LocalFS_1.LocalFS.getHomeDir());
        });
    };
    FilesImporterWindowController.prototype.initComponents = function () {
        var _this = this;
        this.sectionsPicker = this.addComponent("sectionsPicker", new SectionsPickerPanelController_1.SectionsPickerPanelController(this, null, this.app.sessionManager.getLocalSession().sectionManager.sectionsCollection));
        this.filesPicker = this.addComponent("filesPicker", new FilesPickerPanelController_1.FilesPickerPanelController(this, null, this.currentFsDirCollection, function (path, parentPath) {
            _this.setCurrentDir(path);
            _this.updateCurrentDirInView(path);
            _this.localFS.browseWithParent(_this.getCurrentDir());
        }, function (mimeType) {
            return _this.app.shellRegistry.resolveIcon(mimeType);
        }));
        this.choosenFilesCollection = this.addComponent("choosenFilesCollection", new pmc_mail_1.utils.collection.MutableCollection());
        this.choosenFiles = this.addComponent("choosenFiles", new FilesToImportPanelController_1.FilesToImportPanelController(this, null, this.choosenFilesCollection));
        var settings = this.settings.create("panels-splitter");
        settings.currentValue = Math.round(FilesImporterWindowController_1.DEFAULT_WINDOW_WIDTH / 2);
        this.panelsSplitter = this.addComponent("panelsSplitter", this.componentFactory.createComponent("splitter", [this, settings]));
        this.filesPicker.bindEvent(this.filesPicker, "add-item", this.onItemAddClick.bind(this));
        this.choosenFiles.bindEvent(this.choosenFiles, "remove-item", this.onItemRemoveClick.bind(this));
    };
    FilesImporterWindowController.prototype.onViewLoad = function () {
        this.updateCurrentDirInView(this.getCurrentDir());
        this.updateFilesTotalSize();
    };
    FilesImporterWindowController.prototype.updateCurrentDirInView = function (dir) {
        this.callViewMethod("updateCurrentDir", dir);
    };
    FilesImporterWindowController.prototype.onItemAddClick = function (event) {
        var item = this.filesPicker.getItem(event.id, event.basePath);
        var alreadyChoosen = this.choosenFiles.getItem(event.id, event.basePath);
        if (item && !alreadyChoosen) {
            this.choosenFilesCollection.add(item);
            this.updateItemSelection(item.getId(), true);
        }
    };
    FilesImporterWindowController.prototype.onItemRemoveClick = function (event) {
        var item = this.choosenFiles.itemsMergedCollection.find(function (x) { return x.getId() == event.id && x.getBasePath() == event.basePath; });
        if (item) {
            var itemIndex = this.choosenFilesCollection.indexOf(item);
            if (itemIndex > -1) {
                this.choosenFilesCollection.removeAt(itemIndex);
                this.updateItemSelection(item.getId(), false);
            }
        }
    };
    FilesImporterWindowController.prototype.getRootEntry = function () {
        return {
            id: "/",
            parent: null,
            type: "directory",
            path: "/",
            name: "/",
            size: 0,
            ctime: new Date(),
            mtime: new Date(),
            isDirectory: function () { return true; },
            isFile: function () { return false; },
        };
    };
    FilesImporterWindowController.prototype.processNewPath = function (path, collection, asChecked) {
        if (asChecked === void 0) { asChecked = false; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2, new Promise(function () {
                        _this.filesTree.addFileToTree({
                            id: path,
                            parentId: path.split("/").slice(0, -1).join("/"),
                            type: "directory",
                            checked: asChecked
                        });
                        collection.forEach(function (child) { return __awaiter(_this, void 0, void 0, function () {
                            var entry, parentId;
                            return __generator(this, function (_a) {
                                entry = child;
                                if (entry.id == "/") {
                                    parentId = "root";
                                }
                                else {
                                    parentId = entry.parent ? entry.parent.id : null;
                                }
                                this.filesTree.addFileToTree({
                                    id: entry.id,
                                    parentId: parentId,
                                    type: entry.type,
                                    checked: asChecked
                                });
                                if (entry.type == "file") {
                                    this.filesTree.setFileSize(entry.id, entry.size);
                                }
                                return [2];
                            });
                        }); });
                    })];
            });
        });
    };
    FilesImporterWindowController.prototype.onViewHiddenChanged = function (checked) {
        this.filesPicker.setShowHidden(checked);
    };
    FilesImporterWindowController.prototype.resetSizeCountrInView = function () {
        this.callViewMethod("resetSizeCounter");
    };
    FilesImporterWindowController.prototype.updateSizeCounterInView = function (addSize) {
        this.callViewMethod("addSizeToCounter", addSize);
    };
    FilesImporterWindowController.prototype.setCurrentDir = function (dir) {
        this.currentBrowsingDir = dir;
    };
    FilesImporterWindowController.prototype.getCurrentDir = function () {
        return this.currentBrowsingDir;
    };
    FilesImporterWindowController.prototype.getModel = function () {
        var sectionName;
        var convModel;
        var sectionId = this.section.getId();
        if (this.section.getId().indexOf("usergroup:") == 0) {
            var conv = this.getSession().conv2Service.collection.find(function (x) { return x.section && (x.section.getId() == sectionId || x.id == sectionId); });
            convModel = pmc_mail_1.utils.Converter.convertConv2(conv, 0, 0, 0, true, 0, false, false, false, null);
            sectionName = null;
        }
        else {
            if (this.section.getId() == "private:" + this.section.manager.identity.user) {
                sectionName = this.app.localeService.i18n("plugin.notes2.component.filesList.filter.my");
            }
            else if (this.section.getId() == "all") {
                this.app.localeService.i18n("plugin.notes2.component.filesList.filter.all");
            }
            else {
                sectionName = this.section.getName();
            }
        }
        return {
            sectionName: sectionName,
            sectionType: this.section.isPrivate() ? "private" : "public",
            destDirectory: this.sectionDestinationDir,
            showHiddenFiles: this.showHiddenFiles,
            computerName: this.app.getComputerName(),
            currentPath: this.getCurrentDir(),
            conversationModel: convModel
        };
    };
    FilesImporterWindowController.prototype.updateItemSelection = function (itemId, checked) {
        this.filesTree.setFileChecked(itemId, checked);
        var leaf = this.filesTree.findLeaf(itemId);
        if (checked && leaf) {
            if (leaf.visited) {
                this.callViewDoneProcessing(itemId);
            }
            else {
                this.browseFilesTreeDeep();
            }
        }
        else if (!checked) {
            if (leaf) {
                this.cancelProcessing(itemId);
            }
        }
        this.updateFilesTotalSize();
    };
    FilesImporterWindowController.prototype.cancelProcessing = function (id) {
        this.app.cancelFileTreeBrowseWorker(id);
        var leafToRemove = this.filesTree.findLeaf(id);
        if (leafToRemove.type == "directory") {
            this.filesTree.deleteLeaf(id);
            this.filesTree.addFileToTree({
                id: id,
                parentId: leafToRemove.parentId,
                type: leafToRemove.type,
                checked: false
            });
        }
    };
    FilesImporterWindowController.prototype.callViewDoneProcessing = function (id) {
        this.callViewMethod("doneProcessing", id);
    };
    FilesImporterWindowController.prototype.onViewClose = function () {
        this.close();
    };
    FilesImporterWindowController.prototype.onViewImportFiles = function () {
        var _this = this;
        new Promise(function () { return __awaiter(_this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.uploadFiles()];
                    case 1:
                        _a.sent();
                        return [3, 3];
                    case 2:
                        e_1 = _a.sent();
                        Logger.error("error in uploadFiles", e_1);
                        return [3, 3];
                    case 3:
                        this.close();
                        return [2];
                }
            });
        }); });
    };
    FilesImporterWindowController.prototype.addLeafToUpload = function (leaf, baseDir) {
        return __awaiter(this, void 0, void 0, function () {
            var sectionTree, relative, entry, content, resolvedBaseDir, baseDirExists, _a, _b, _c, _i, child;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4, this.section.getFileTree()];
                    case 1:
                        sectionTree = _d.sent();
                        relative = FilesTree_1.Leaf.getIdLastPart(leaf.id);
                        if (leaf.type == "file") {
                            entry = LocalFS_1.LocalFS.getEntry(leaf.id);
                            content = this.app.createContent({
                                path: leaf.id,
                                type: entry.mime
                            });
                            this.app.uploadService.addFile({ content: content, session: this.app.sessionManager.getLocalSession(), destination: this.section.getId(), path: baseDir });
                        }
                        if (!(leaf.type == "directory")) return [3, 10];
                        resolvedBaseDir = baseDir == "/" ? baseDir + relative : baseDir + "/" + relative;
                        if (!(resolvedBaseDir == "/")) return [3, 2];
                        _a = true;
                        return [3, 4];
                    case 2: return [4, sectionTree.fileSystem.exists(resolvedBaseDir)];
                    case 3:
                        _a = _d.sent();
                        _d.label = 4;
                    case 4:
                        baseDirExists = _a;
                        if (!!baseDirExists) return [3, 6];
                        return [4, sectionTree.fileSystem.mkdirs(resolvedBaseDir)];
                    case 5:
                        _d.sent();
                        _d.label = 6;
                    case 6:
                        _b = [];
                        for (_c in leaf.children)
                            _b.push(_c);
                        _i = 0;
                        _d.label = 7;
                    case 7:
                        if (!(_i < _b.length)) return [3, 10];
                        child = _b[_i];
                        return [4, this.addLeafToUpload(leaf.children[child], resolvedBaseDir)];
                    case 8:
                        _d.sent();
                        _d.label = 9;
                    case 9:
                        _i++;
                        return [3, 7];
                    case 10: return [2];
                }
            });
        });
    };
    FilesImporterWindowController.prototype.uploadFiles = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, p, leaf, baseDir;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = this.choosenFiles.items.collection.list;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3, 4];
                        p = _a[_i];
                        leaf = this.filesTree.findLeaf(p.id);
                        baseDir = this.sectionDestinationDir;
                        return [4, this.addLeafToUpload(leaf, baseDir)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3, 1];
                    case 4: return [2];
                }
            });
        });
    };
    FilesImporterWindowController.prototype.browseFilesTreeDeep = function () {
        var dirs = this.filesTree.getDirectoriesToVisit();
        this.addDirsToProcessingQueue(dirs);
    };
    FilesImporterWindowController.prototype.updateFilesTotalSize = function () {
        var totalCount = this.filesTree.getCheckedCount();
        var totalSize = this.filesTree.getCheckedTotalSize();
        this.callViewMethod("updateFilesTotal", totalCount, totalSize);
    };
    FilesImporterWindowController.prototype.addDirsToProcessingQueue = function (dirs) {
        for (var _i = 0, dirs_1 = dirs; _i < dirs_1.length; _i++) {
            var dir = dirs_1[_i];
            this.addSingleDirToProcessingQueue(dir);
        }
    };
    FilesImporterWindowController.prototype.addSingleDirToProcessingQueue = function (dir) {
        var _this = this;
        this.app.fireFileTreeBrowseWorker(dir, function (progress) {
            if (progress.finished) {
                if (progress.hasError) {
                    throw new Error("error in worker" + progress.err);
                }
            }
            if (progress.files) {
                _this.addListToTreeFromWorker(progress);
                _this.updateFilesTotalSize();
            }
        });
    };
    FilesImporterWindowController.prototype.addDirToTree = function (path) {
        this.filesTree.addFileToTree({
            id: path,
            parentId: path.split("/").slice(0, -1).join("/"),
            type: "directory",
            checked: true
        });
    };
    FilesImporterWindowController.prototype.addListToTree = function (list) {
        for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
            var element = list_1[_i];
            var entry = element;
            var parentId = void 0;
            if (entry.id == "/") {
                parentId = "root";
            }
            else {
                parentId = entry.parent ? entry.parent.id : null;
            }
            this.filesTree.addFileToTree({
                id: entry.id,
                parentId: parentId,
                type: entry.type,
                checked: true,
            });
            if (entry.type == "file") {
                this.filesTree.setFileSize(entry.id, entry.size);
            }
        }
    };
    FilesImporterWindowController.prototype.addListToTreeFromWorker = function (scanResult) {
        this.filesTree.setFileVisited(scanResult.path);
        for (var _i = 0, _a = scanResult.files; _i < _a.length; _i++) {
            var element = _a[_i];
            this.filesTree.addFileToTree({
                id: element.path,
                parentId: scanResult.path,
                type: element.fileType,
                checked: true
            });
            if (element.fileType == "file") {
                this.filesTree.setFileSize(element.path, element.size);
            }
        }
    };
    FilesImporterWindowController.prototype.getAllSelectedFiles = function () {
        var list = this.filesTree.getSelectedFiles();
        return list;
    };
    var FilesImporterWindowController_1;
    FilesImporterWindowController.DEFAULT_WINDOW_WIDTH = 800;
    FilesImporterWindowController.textsPrefix = "plugin.notes2.window.filesimporter.";
    FilesImporterWindowController.rootId = "/";
    FilesImporterWindowController = FilesImporterWindowController_1 = __decorate([
        Dependencies(["tree", "extlist", "splitter"])
    ], FilesImporterWindowController);
    return FilesImporterWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.FilesImporterWindowController = FilesImporterWindowController;
FilesImporterWindowController.prototype.className = "com.privmx.plugin.notes2.window.filesimporter.FilesImporterWindowController";

//# sourceMappingURL=FilesImporterWindowController.js.map
