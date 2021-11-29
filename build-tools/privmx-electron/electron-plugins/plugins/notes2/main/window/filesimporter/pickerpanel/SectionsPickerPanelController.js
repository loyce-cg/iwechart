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
var EntryFromSectionService = (function () {
    function EntryFromSectionService(section) {
        this.name = section.getName();
        this.id = section.getId();
        this.breadcrumbs = "";
        this.root = section.isRoot();
        this.visible = section.isVisible();
        this.enabled = section.isValid();
        this.scope = section.getScope();
        this.descripion = section.getDescription();
        this.primary = section.isPrimary();
    }
    EntryFromSectionService.prototype.getName = function () {
        return this.name;
    };
    EntryFromSectionService.prototype.getId = function () {
        return this.id;
    };
    EntryFromSectionService.prototype.isRoot = function () {
        return this.root;
    };
    EntryFromSectionService.prototype.isVisible = function () {
        return this.visible;
    };
    EntryFromSectionService.prototype.getBreadcrumb = function () {
        return this.breadcrumbs;
    };
    EntryFromSectionService.prototype.getScope = function () {
        return this.scope;
    };
    EntryFromSectionService.prototype.isEnabled = function () {
        return this.enabled;
    };
    EntryFromSectionService.prototype.getDescription = function () {
        return this.descripion;
    };
    EntryFromSectionService.prototype.isPrimary = function () {
        return this.primary;
    };
    return EntryFromSectionService;
}());
var SectionsPickerPanelController = (function (_super) {
    __extends(SectionsPickerPanelController, _super);
    function SectionsPickerPanelController(parent, personsComponent, sourceCollection) {
        var _this = _super.call(this, parent, personsComponent) || this;
        _this.personsComponent = personsComponent;
        _this.sourceCollection = sourceCollection;
        _this.entriesCollection = _this.addComponent("transformCollection-" + _this.constructor.name, new pmc_mail_1.utils.collection.TransformCollection(_this.sourceCollection, _this.convertSectionServiceToSectionEntry.bind(_this)));
        _super.prototype.addBaseCollection.call(_this, _this.entriesCollection);
        return _this;
    }
    SectionsPickerPanelController.prototype.filterEntry = function (entry) {
        return true;
    };
    SectionsPickerPanelController.prototype.convertEntry = function (entry) {
        return {
            name: entry.getName(),
            id: entry.getId(),
            isRoot: entry.isRoot(),
            breadcrumb: entry.getBreadcrumb(),
            visible: entry.isVisible(),
            scope: entry.getScope(),
            enabled: entry.isEnabled(),
            description: entry.getDescription(),
            primary: entry.isPrimary()
        };
    };
    SectionsPickerPanelController.prototype.sortEntry = function (a, b) {
        return 0;
    };
    SectionsPickerPanelController.prototype.convertSectionServiceToSectionEntry = function (entry) {
        return new EntryFromSectionService(entry);
    };
    SectionsPickerPanelController.prototype.onActiveCollectionChange = function (event) {
    };
    return SectionsPickerPanelController;
}(BaseItemsPanelController_1.BaseItemsPanelController));
exports.SectionsPickerPanelController = SectionsPickerPanelController;
SectionsPickerPanelController.prototype.className = "com.privmx.plugin.notes2.window.filesimporter.pickerpanel.SectionsPickerPanelController";

//# sourceMappingURL=SectionsPickerPanelController.js.map
