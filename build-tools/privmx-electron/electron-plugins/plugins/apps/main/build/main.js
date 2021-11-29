"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AppsWindowController_1 = require("../window/apps/AppsWindowController");
var AppsPlugin_1 = require("../main/AppsPlugin");
var Plugin = (function () {
    function Plugin() {
    }
    Plugin.prototype.register = function (mail, app) {
        var appsPlugin = app.addComponent("apps-plugin", new AppsPlugin_1.AppsPlugin(app));
        appsPlugin.registerTexts(app.localeService);
        AppsWindowController_1.AppsWindowController.registerTexts(app.localeService);
        app.addEventListener("afterlogin", function (event) {
            var cnt = app.windows.container;
            var entry = cnt.registerAppWindow({
                id: "apps",
                label: "",
                icon: "",
                controllerClass: AppsWindowController_1.AppsWindowController,
                visible: false,
                historyPath: "/apps"
            });
            cnt.initApp = entry.id;
            cnt.activateLogoAction = entry.id;
        }, "apps", "ethernal");
        app.addEventListener("afterlogout", function () {
            appsPlugin.reset();
        }, "tasks", "ethernal");
    };
    return Plugin;
}());
exports.Plugin = Plugin;
Plugin.prototype.className = "com.privmx.plugin.apps.build.Plugin";

//# sourceMappingURL=main.js.map
