"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var TwofaApi_1 = require("./TwofaApi");
var index_1 = require("../i18n/index");
var Logger = pmc_mail_1.Logger.get("privfs-twofa-plugin.TwofaService");
var TwofaService = (function () {
    function TwofaService(app) {
        this.app = app;
    }
    TwofaService.prototype.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, "plugin.twofa.");
    };
    TwofaService.prototype.onLogin = function () {
        var _this = this;
        this.app.mailClientApi.privmxRegistry.getGateway().then(function (gateway) {
            _this.api = new TwofaApi_1.TwofaApi(gateway);
        })
            .fail(function (e) {
            Logger.error("Error during creating 2FA api", e);
        });
    };
    return TwofaService;
}());
exports.TwofaService = TwofaService;
TwofaService.prototype.className = "com.privmx.plugin.twofa.main.TwofaService";

//# sourceMappingURL=TwofaService.js.map
