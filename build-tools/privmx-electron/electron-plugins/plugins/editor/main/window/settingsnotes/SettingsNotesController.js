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
var SettingsNotesController = (function (_super) {
    __extends(SettingsNotesController, _super);
    function SettingsNotesController(windowController) {
        var _this = _super.call(this, windowController) || this;
        _this.ipcMode = true;
        _this.editorPlugin = _this.app.getComponent("editor-plugin");
        _this.parent.registerTab({ id: "plugin-editor", tab: _this });
        _this.parent.addViewScript({ path: "build/view.js", plugin: "editor" });
        _this.parent.addViewStyle({ path: "window/settingsnotes/template/main.css", plugin: "editor" });
        return _this;
    }
    SettingsNotesController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    SettingsNotesController.prototype.prepare = function () {
        var _this = this;
        return this.editorPlugin.getNotesPreferences().then(function (notes) {
            var model = {
                notes: notes
            };
            _this.callViewMethod("renderContent", model);
        });
    };
    SettingsNotesController.textsPrefix = "plugin.editor.window.settings.";
    return SettingsNotesController;
}(pmc_mail_1.window.settings.BaseController));
exports.SettingsNotesController = SettingsNotesController;
SettingsNotesController.prototype.className = "com.privmx.plugin.editor.window.settingsnotes.SettingsNotesController";

//# sourceMappingURL=SettingsNotesController.js.map
