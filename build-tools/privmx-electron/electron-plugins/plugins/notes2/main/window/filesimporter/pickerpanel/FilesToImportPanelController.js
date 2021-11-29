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
var FilesToImportPanelController = (function (_super) {
    __extends(FilesToImportPanelController, _super);
    function FilesToImportPanelController(parent, personsComponent, sourceCollection) {
        var _this = _super.call(this, parent, personsComponent) || this;
        _this.personsComponent = personsComponent;
        _this.sourceCollection = sourceCollection;
        _this.ipcMode = true;
        _super.prototype.addBaseCollection.call(_this, _this.sourceCollection);
        return _this;
    }
    FilesToImportPanelController.prototype.filterEntry = function (entry) {
        return true;
    };
    FilesToImportPanelController.prototype.convertEntry = function (entry) {
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
    FilesToImportPanelController.prototype.sortEntry = function (a, b) {
        return 0;
    };
    FilesToImportPanelController.prototype.onActiveCollectionChange = function (event) {
    };
    FilesToImportPanelController.prototype.onViewRemoveItemClick = function (id) {
        var item = this.itemsMergedCollection.find(function (x) { return x.getId() == id; });
        this.dispatchEvent({
            type: "remove-item",
            id: item.getId(),
            basePath: item.getBasePath()
        });
    };
    FilesToImportPanelController.prototype.getItem = function (id, basePath) {
        return this.itemsMergedCollection.find(function (x) { return x.getId() == id && x.getBasePath() == basePath; });
    };
    return FilesToImportPanelController;
}(BaseItemsPanelController_1.BaseItemsPanelController));
exports.FilesToImportPanelController = FilesToImportPanelController;
FilesToImportPanelController.prototype.className = "com.privmx.plugin.notes2.window.filesimporter.pickerpanel.FilesToImportPanelController";

//# sourceMappingURL=FilesToImportPanelController.js.map
