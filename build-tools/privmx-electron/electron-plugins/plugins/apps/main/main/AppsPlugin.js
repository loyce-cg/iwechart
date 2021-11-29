"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("../i18n/index");
var AppsPlugin = (function () {
    function AppsPlugin(app) {
        var _this = this;
        this.app = app;
        this.sectionsWithSpinner = {};
        this.pluginsWithSpinner = {};
        this.app.addEventListener("set-bubbles-state", function (e) {
            var newState = e.markingAsRead;
            var id = e.scope.sectionId || "__all__";
            var moduleName = e.scope.moduleName || "__all__";
            _this.sectionsWithSpinner[id] = newState;
            _this.pluginsWithSpinner[moduleName] = newState;
            _this.app.dispatchEvent({
                type: "update-apps-spinners",
                state: e.markingAsRead,
                sectionId: e.scope.sectionId || undefined,
                moduleName: moduleName || undefined,
            });
        }, "apps", "ethernal");
    }
    AppsPlugin.prototype.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, "plugin.apps.");
    };
    AppsPlugin.prototype.reset = function () {
        this.sectionsWithSpinner = {};
        this.pluginsWithSpinner = {};
    };
    return AppsPlugin;
}());
exports.AppsPlugin = AppsPlugin;
AppsPlugin.prototype.className = "com.privmx.plugin.apps.main.AppsPlugin";

//# sourceMappingURL=AppsPlugin.js.map
