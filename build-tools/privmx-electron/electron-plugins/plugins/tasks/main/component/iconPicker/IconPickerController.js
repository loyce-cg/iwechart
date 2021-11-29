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
var pmc_mail_1 = require("pmc-mail");
var IconPickerData_1 = require("./IconPickerData");
var index_1 = require("./i18n/index");
var IconPickerController = (function (_super) {
    __extends(IconPickerController, _super);
    function IconPickerController(parent) {
        var _this = _super.call(this, parent) || this;
        _this.selectedItemIndex = 0;
        _this.selectedColorIndex = 0;
        _this.onChangeHandler = null;
        _this.ipcMode = true;
        return _this;
    }
    IconPickerController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    IconPickerController.prototype.init = function () {
        return pmc_mail_1.Q.resolve();
    };
    IconPickerController.prototype.getModel = function () {
        return {
            items: IconPickerData_1.IconPickerData.items,
            colors: IconPickerData_1.IconPickerData.colors,
            selectedItemIndex: this.selectedItemIndex,
            selectedColorIndex: this.selectedColorIndex,
        };
    };
    IconPickerController.prototype.setData = function (selectedItemIndex, selectedColorIndex) {
        this.selectedItemIndex = selectedItemIndex;
        this.selectedColorIndex = selectedColorIndex;
        this.callViewMethod("setModel", this.getModel());
    };
    IconPickerController.prototype.onViewSelectedItemIndexChanged = function (selectedItemIndex) {
        this.selectedItemIndex = selectedItemIndex;
        this.emitChanged();
    };
    IconPickerController.prototype.onViewSelectedColorIndexChanged = function (selectedColorIndex) {
        this.selectedColorIndex = selectedColorIndex;
        this.emitChanged();
    };
    IconPickerController.prototype.setIcon = function (icon) {
        if (!icon) {
            this.setData(0, 0);
            return;
        }
        var str = icon.type == "shape" ? '{"type":"shape","shape":"' + icon.shape + '"}' : '{"type":"fa","fa":"' + icon.fa + '"}';
        var selectedItemIndex = IconPickerData_1.IconPickerData.items.indexOf(str);
        var selectedColorIndex = IconPickerData_1.IconPickerData.colors.indexOf(icon.color);
        selectedItemIndex = selectedItemIndex < 0 ? 0 : selectedItemIndex;
        selectedColorIndex = selectedColorIndex < 0 ? 0 : selectedColorIndex;
        this.setData(selectedItemIndex, selectedColorIndex);
    };
    IconPickerController.prototype.getIcon = function () {
        var item = JSON.parse(IconPickerData_1.IconPickerData.items[this.selectedItemIndex]);
        if (!item) {
            return null;
        }
        var color = IconPickerData_1.IconPickerData.colors[this.selectedColorIndex];
        var icon = {
            type: item.type,
            shape: item.shape,
            fa: item.fa,
            color: color,
        };
        return icon;
    };
    IconPickerController.prototype.onChanged = function (handler) {
        this.onChangeHandler = handler;
    };
    IconPickerController.prototype.emitChanged = function () {
        if (this.onChangeHandler) {
            this.onChangeHandler();
        }
    };
    IconPickerController.textsPrefix = "plugin.tasks.component.iconPicker.";
    return IconPickerController;
}(pmc_mail_1.component.base.ComponentController));
exports.IconPickerController = IconPickerController;
IconPickerController.prototype.className = "com.privmx.plugin.tasks.component.iconPicker.IconPickerController";

//# sourceMappingURL=IconPickerController.js.map
