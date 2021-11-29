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
var index_1 = require("./i18n/index");
var DesktopPickerController = (function (_super) {
    __extends(DesktopPickerController, _super);
    function DesktopPickerController(parent) {
        var _this = _super.call(this, parent) || this;
        _this.parent = parent;
        _this.ipcMode = true;
        return _this;
    }
    DesktopPickerController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    DesktopPickerController.prototype.init = function () {
    };
    DesktopPickerController.prototype.getModel = function () {
        return {
            tabs: [
                {
                    id: "screen",
                    header: this.i18n("plugin.chat.component.desktoppicker.tab.screen.label"),
                    canShareDesktopAudio: false,
                },
                {
                    id: "window",
                    header: this.i18n("plugin.chat.component.desktoppicker.tab.window.label"),
                    canShareDesktopAudio: false,
                },
            ],
        };
    };
    DesktopPickerController.prototype.i18n = function (key) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var _a;
        return (_a = this.parent).i18n.apply(_a, [key].concat(args));
    };
    DesktopPickerController.textsPrefix = "plugin.chat.component.desktoppicker.";
    return DesktopPickerController;
}(pmc_mail_1.component.base.ComponentController));
exports.DesktopPickerController = DesktopPickerController;
DesktopPickerController.prototype.className = "com.privmx.plugin.chat.component.desktoppicker.DesktopPickerController";

//# sourceMappingURL=DesktopPickerController.js.map
