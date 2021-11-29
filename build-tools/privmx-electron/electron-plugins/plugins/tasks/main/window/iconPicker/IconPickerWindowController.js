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
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var index_1 = require("./i18n/index");
var IconPickerData_1 = require("../../component/iconPicker/IconPickerData");
var IconPickerWindowController = (function (_super) {
    __extends(IconPickerWindowController, _super);
    function IconPickerWindowController(parentWindow, iconStr) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.iconStr = iconStr;
        _this.deferred = pmc_mail_1.Q.defer();
        _this.ipcMode = true;
        _this.setPluginViewAssets("tasks");
        _this.openWindowOptions.modal = true;
        _this.openWindowOptions.title = _this.i18n("plugin.tasks.window.iconPicker.title");
        _this.openWindowOptions.icon = "icon fa fa-tasks";
        _this.openWindowOptions.width = 550;
        _this.openWindowOptions.height = 160;
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.mutableIconsCollection = _this.addComponent("mutableIconsCollection", new pmc_mail_1.utils.collection.MutableCollection());
        _this.transformIconsCollection = _this.addComponent("transformIconsCollection", new pmc_mail_1.utils.collection.TransformCollection(_this.mutableIconsCollection, _this.addIconColor.bind(_this)));
        _this.activeIconsCollection = _this.addComponent("activeIconsCollection", new pmc_mail_1.utils.collection.WithActiveCollection(_this.transformIconsCollection));
        _this.iconsExtList = _this.addComponent("iconsExtList", _this.componentFactory.createComponent("extlist", [_this, _this.activeIconsCollection]));
        _this.mutableColorsCollection = _this.addComponent("mutableColorsCollection", new pmc_mail_1.utils.collection.MutableCollection());
        _this.transformColorsCollection = _this.addComponent("transformColorsCollection", new pmc_mail_1.utils.collection.TransformCollection(_this.mutableColorsCollection, _this.colorToIcon.bind(_this)));
        _this.activeColorsCollection = _this.addComponent("activeColorsCollection", new pmc_mail_1.utils.collection.WithActiveCollection(_this.transformColorsCollection));
        _this.colorsExtList = _this.addComponent("colorsExtList", _this.componentFactory.createComponent("extlist", [_this, _this.activeColorsCollection]));
        _this.mutableColorsCollection.addAll(IconPickerData_1.IconPickerData.colors);
        _this.mutableIconsCollection.addAll(IconPickerData_1.IconPickerData.items);
        _this.setActiveColor(0);
        _this.setActiveIcon(0);
        if (_this.iconStr) {
            var icon = _this.iconStr ? IconPickerData_1.IconPickerData.splitIconStr(_this.iconStr) : null;
            if (icon) {
                _this.activeColorsCollection.setActive(_this.colorToIcon(icon.color));
                _this.transformIconsCollection.rebuild();
                _this.activeIconsCollection.setActive(_this.addIconColor(icon.icon));
            }
        }
        return _this;
    }
    IconPickerWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    IconPickerWindowController.prototype.addIconColor = function (iconStr) {
        var icon = JSON.parse(iconStr);
        if (!icon) {
            return null;
        }
        icon.color = this.mutableColorsCollection.get(this.getActiveColorIndex());
        return JSON.stringify(icon);
    };
    IconPickerWindowController.prototype.colorToIcon = function (color) {
        return '{"type":"fa","fa":"tint","color":"' + color + '"}';
    };
    IconPickerWindowController.prototype.getPromise = function () {
        return this.deferred.promise;
    };
    IconPickerWindowController.prototype.resolve = function (cancelled) {
        var idx = this.getActiveIconIndex();
        var activeIcon = this.mutableIconsCollection.get(idx);
        this.deferred.resolve({
            cancelled: cancelled,
            iconStr: activeIcon == "none" ? null : this.addIconColor(activeIcon),
        });
    };
    IconPickerWindowController.prototype.getModel = function () {
        return {};
    };
    IconPickerWindowController.prototype.onViewClose = function () {
        this.cancel();
    };
    IconPickerWindowController.prototype.onViewCancel = function () {
        this.cancel();
    };
    IconPickerWindowController.prototype.onViewSave = function () {
        this.save();
    };
    IconPickerWindowController.prototype.cancel = function () {
        this.resolve(true);
        this.close();
    };
    IconPickerWindowController.prototype.save = function () {
        this.resolve(false);
        this.close();
    };
    IconPickerWindowController.prototype.onViewChangeIcon = function (idx) {
        this.setActiveIcon(idx);
    };
    IconPickerWindowController.prototype.onViewChangeColor = function (idx) {
        this.setActiveColor(idx);
        var iconIdx = this.getActiveIconIndex();
        this.transformIconsCollection.rebuild();
        this.setActiveIcon(iconIdx);
    };
    IconPickerWindowController.prototype.getActiveIconIndex = function () {
        var idx = this.activeIconsCollection.getActiveIndex();
        return idx < 0 ? 0 : idx;
    };
    IconPickerWindowController.prototype.getActiveColorIndex = function () {
        var idx = this.activeColorsCollection.getActiveIndex();
        return idx < 0 ? 0 : idx;
    };
    IconPickerWindowController.prototype.setActiveIcon = function (idx) {
        this.activeIconsCollection.setActive(this.activeIconsCollection.get(idx == 0 ? 1 : 0));
        this.activeIconsCollection.setActive(this.activeIconsCollection.get(idx));
    };
    IconPickerWindowController.prototype.setActiveColor = function (idx) {
        this.activeColorsCollection.setActive(this.activeColorsCollection.get(idx));
    };
    IconPickerWindowController.textsPrefix = "plugin.tasks.window.iconPicker.";
    IconPickerWindowController = __decorate([
        Dependencies(["extlist"])
    ], IconPickerWindowController);
    return IconPickerWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.IconPickerWindowController = IconPickerWindowController;
IconPickerWindowController.prototype.className = "com.privmx.plugin.tasks.window.iconPicker.IconPickerWindowController";

//# sourceMappingURL=IconPickerWindowController.js.map
