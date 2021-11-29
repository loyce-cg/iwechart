"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TwofaService_1 = require("../main/TwofaService");
var SettingsTwofaWindowController_1 = require("../window/settingstwofa/SettingsTwofaWindowController");
var CodeWindowController_1 = require("../window/code/CodeWindowController");
var TwofaApi_1 = require("../main/TwofaApi");
var Plugin = (function () {
    function Plugin() {
    }
    Plugin.prototype.register = function (_mail, app) {
        var twofaService = new TwofaService_1.TwofaService(app);
        twofaService.registerTexts(app.localeService);
        CodeWindowController_1.CodeWindowController.registerTexts(app.localeService);
        SettingsTwofaWindowController_1.SettingsTwofaWindowController.registerTexts(app.localeService);
        app.addComponent("twofa-plugin", twofaService);
        app.addEventListener("afterlogin", function () {
            twofaService.onLogin();
        }, "twofa", "ethernal");
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.settings.SettingsWindowController") {
                new SettingsTwofaWindowController_1.SettingsTwofaWindowController(event.instance);
            }
        }, "twofa", "ethernal");
        app.addEventListener("additionalloginstep", function (event) {
            if (event.data && event.data.reason == "twofa" && CodeWindowController_1.CodeWindowController.isSupported(event.data)) {
                var host = event.basicLoginResult.gateway.getHost();
                var login = event.data.webauthnLogin;
                event.result = app.ioc.create(CodeWindowController_1.CodeWindowController, [app, {
                        data: event.data,
                        api: new TwofaApi_1.TwofaApi(event.basicLoginResult.gateway),
                        cancellable: false,
                        host: host,
                        u2f: { register: null, login: login }
                    }]).then(function (win) {
                    app.openSingletonWindow("twofa-window", win);
                    return win.getPromise();
                });
            }
        }, "twofa", "ethernal");
    };
    return Plugin;
}());
exports.Plugin = Plugin;
Plugin.prototype.className = "com.privmx.plugin.twofa.build.Plugin";

//# sourceMappingURL=main.js.map
