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
Object.defineProperty(exports, "__esModule", { value: true });
var BaseItemsPanelController_1 = require("./BaseItemsPanelController");
var pmc_mail_1 = require("pmc-mail");
var EntryFromLocalFileEntry = (function () {
    function EntryFromLocalFileEntry(f, basePath, iconsResolver) {
        var localFile = f;
        this.id = localFile.id;
        this.path = localFile.path;
        this.fileType = localFile.type;
        this.icon = localFile.type == "directory" ? "fa-folder" : iconsResolver(localFile.mime);
        this.modificationDate = localFile.mtime.getTime(),
            this.name = localFile.name;
        this.size = localFile.size;
        this.basePath = basePath;
        this.hidden = localFile.hidden;
    }
    EntryFromLocalFileEntry.prototype.getFileType = function () {
        return this.fileType;
    };
    EntryFromLocalFileEntry.prototype.getId = function () {
        return this.id;
    };
    EntryFromLocalFileEntry.prototype.getPath = function () {
        return this.path;
    };
    EntryFromLocalFileEntry.prototype.getIcon = function () {
        return this.icon;
    };
    EntryFromLocalFileEntry.prototype.getIsParentDir = function () {
        return this.isParentDir;
    };
    EntryFromLocalFileEntry.prototype.getModificationDate = function () {
        return this.modificationDate;
    };
    EntryFromLocalFileEntry.prototype.getName = function () {
        return this.name;
    };
    EntryFromLocalFileEntry.prototype.getSize = function () {
        return this.size;
    };
    EntryFromLocalFileEntry.prototype.getBasePath = function () {
        return this.basePath;
    };
    EntryFromLocalFileEntry.prototype.isHidden = function () {
        return this.hidden;
    };
    return EntryFromLocalFileEntry;
}());
var FilesPickerPanelController = (function (_super) {
    __extends(FilesPickerPanelController, _super);
    function FilesPickerPanelController(parent, personsComponent, sourceCollection, onUpdateCollection, iconsResolver) {
        var _this = _super.call(this, parent, personsComponent) || this;
        _this.personsComponent = personsComponent;
        _this.sourceCollection = sourceCollection;
        _this.onUpdateCollection = onUpdateCollection;
        _this.iconsResolver = iconsResolver;
        _this.showHidden = false;
        _this.ipcMode = true;
        _this.entriesCollection = _this.addComponent("transformCollection-" + _this.constructor.name, new pmc_mail_1.utils.collection.TransformCollection(_this.sourceCollection, function (entry) {
            return _this.convertLocalEntryToFileEntry(entry, _this.iconsResolver);
        }));
        _super.prototype.addBaseCollection.call(_this, _this.entriesCollection);
        return _this;
    }
    FilesPickerPanelController.prototype.filterEntry = function (entry) {
        if (entry.isHidden() && !this.showHidden) {
            return false;
        }
        return true;
    };
    FilesPickerPanelController.prototype.convertEntry = function (entry) {
        return {
            fileType: entry.getFileType(),
            id: entry.getId(),
            path: entry.getPath(),
            icon: entry.getIcon(),
            isParentDir: entry.getIsParentDir(),
            modificationDate: entry.getModificationDate(),
            name: entry.getName(),
            size: entry.getSize(),
            basePath: entry.getBasePath(),
            hidden: entry.isHidden()
        };
    };
    FilesPickerPanelController.prototype.sortEntry = function (a, b) {
        if (a.fileType != b.fileType) {
            return a.fileType == "directory" ? -1 : 1;
        }
        return a.path.localeCompare(b.path);
    };
    FilesPickerPanelController.prototype.convertLocalEntryToFileEntry = function (entry, iconsResolver) {
        return new EntryFromLocalFileEntry(entry, this.getCurrentDir(), iconsResolver);
    };
    FilesPickerPanelController.prototype.onViewDirectoryClick = function (id, parentId) {
        if (id == "parent") {
            var parentItem = this.itemsTransformCollection.find(function (x) { return x.id == "parent"; });
            this.setCurrentDir(parentItem.path);
            this.onUpdateCollection(parentItem.path, parentId);
        }
        else {
            this.setCurrentDir(id);
            this.onUpdateCollection(id, parentId);
        }
    };
    FilesPickerPanelController.prototype.onViewAddItemClick = function (id) {
        var item = this.itemsMergedCollection.find(function (x) { return x.getId() == id; });
        this.dispatchEvent({
            type: "add-item",
            id: item.getId(),
            basePath: item.getBasePath()
        });
    };
    FilesPickerPanelController.prototype.onActiveCollectionChange = function (event) {
    };
    FilesPickerPanelController.prototype.setCurrentDir = function (dir) {
        this.currentDir = dir;
    };
    FilesPickerPanelController.prototype.getCurrentDir = function () {
        return this.currentDir;
    };
    FilesPickerPanelController.prototype.setShowHidden = function (showHidden) {
        this.showHidden = showHidden;
        this.itemsFilteredCollection.refresh();
    };
    FilesPickerPanelController.prototype.getItem = function (id, basePath) {
        return this.itemsMergedCollection.find(function (x) { return x.getId() == id && x.getBasePath() == basePath; });
    };
    return FilesPickerPanelController;
}(BaseItemsPanelController_1.BaseItemsPanelController));
exports.FilesPickerPanelController = FilesPickerPanelController;
FilesPickerPanelController.prototype.className = "com.privmx.plugin.notes2.window.filesimporter.pickerpanel.FilesPickerPanelController";

//# sourceMappingURL=FilesPickerPanelController.js.map
