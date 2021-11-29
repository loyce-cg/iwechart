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
var MindmapHelpWindowController = (function (_super) {
    __extends(MindmapHelpWindowController, _super);
    function MindmapHelpWindowController(parentWindow) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.ipcMode = true;
        _this.setPluginViewAssets("editor");
        _this.openWindowOptions.position = "center";
        _this.openWindowOptions.width = 600;
        _this.openWindowOptions.height = 365;
        _this.openWindowOptions.resizable = true;
        _this.openWindowOptions.title = _this.i18n("plugin.editor.window.mindmapHelp.title");
        return _this;
    }
    MindmapHelpWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    MindmapHelpWindowController.textsPrefix = "plugin.editor.window.mindmapHelp.";
    return MindmapHelpWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.MindmapHelpWindowController = MindmapHelpWindowController;
MindmapHelpWindowController.prototype.className = "com.privmx.plugin.editor.window.mindmaphelp.MindmapHelpWindowController";

//# sourceMappingURL=MindmapHelpWindowController.js.map
