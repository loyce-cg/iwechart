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
var CodeWindowController_1 = require("../code/CodeWindowController");
var index_1 = require("./i18n/index");
var base32 = require("thirty-two");
var Inject = pmc_mail_1.utils.decorators.Inject;
var SettingsTwofaWindowController = (function (_super) {
    __extends(SettingsTwofaWindowController, _super);
    function SettingsTwofaWindowController(parent) {
        var _this = _super.call(this, parent) || this;
        _this.is2faEnabled = null;
        _this.ipcMode = true;
        _this.identity = _this.parent.identity;
        _this.twofaService = _this.app.getComponent("twofa-plugin");
        _this.parent.registerTab({ id: "plugin-twofa", tab: _this });
        _this.parent.addViewScript({ path: "build/view.js", plugin: "twofa" });
        _this.parent.addViewStyle({ path: "window/settingstwofa/template/main.css", plugin: "twofa" });
        return _this;
    }
    SettingsTwofaWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    SettingsTwofaWindowController.prototype.prepare = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.twofaService.api.getData();
        })
            .then(function (result) {
            var data = result.data || {};
            var model = {
                methods: result.methods,
                enabled: "enabled" in data ? data.enabled : false,
                type: data.type || "googleAuthenticator",
                googleAuthenticatorKey: data.googleAuthenticatorKey || _this.generateGoogleAuthenticatorKey(),
                googleAuthenticatorKeyUri: "",
                email: data.email || "",
                mobile: data.mobile || ""
            };
            if (model.methods.indexOf(model.type) == -1) {
                model.enabled = false;
                model.type = model.methods[0];
            }
            model.googleAuthenticatorKeyUri = _this.getGoogleAuthenticatorKeyUri(model.googleAuthenticatorKey);
            _this.is2faEnabled = model.enabled;
            _this.callViewMethod("renderContent", model);
        });
    };
    SettingsTwofaWindowController.prototype.onViewEnable = function (data) {
        var _this = this;
        if (data.type == "email" && (!data.email || !/^[a-z0-9_\.\+-]+@[a-z0-9_\.-]+$/.test(data.email))) {
            this.callViewMethod("finishSaving");
            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.error.email"));
            return;
        }
        if (data.type == "sms" && (!data.mobile || !/^[0-9\+ ]{3,18}$/.test(data.mobile))) {
            this.callViewMethod("finishSaving");
            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.error.mobile"));
            return;
        }
        if (data.type == "googleAuthenticator" && (!data.googleAuthenticatorKey || !/^[234567a-z ]{32,39}$/.test(data.googleAuthenticatorKey))) {
            this.callViewMethod("finishSaving");
            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.error.googleAuthenticatorKey"));
            return;
        }
        this.addTaskEx("", true, function () {
            var saved = false;
            return pmc_mail_1.Q().then(function () {
                return _this.twofaService.api.enable(data);
            })
                .then(function (res) {
                var als = {
                    reason: "twofa",
                    type: data.type,
                    mobile: data.mobile,
                    email: data.email
                };
                if (!CodeWindowController_1.CodeWindowController.isSupported(als)) {
                    return pmc_mail_1.Q.reject("Unsupported 2FA type " + data.type);
                }
                return _this.ioc.create(CodeWindowController_1.CodeWindowController, [_this.parent, {
                        data: als,
                        api: _this.twofaService.api,
                        cancellable: true,
                        host: _this.identity.host,
                        u2f: { register: res.webauthnRegister, login: null }
                    }]).then(function (win) {
                    win.open();
                    return win.getPromise().then(function () {
                        _this.parent.alert(_this.i18n("plugin.twofa.window.settingstwofa.successEnable"));
                        _this.is2faEnabled = true;
                        _this.callViewMethod("resetDirty");
                        saved = true;
                    })
                        .fail(function (e) {
                        _this.logError(e);
                        if (e === "additional-login-step-fail") {
                            _this.parent.alert(_this.i18n("plugin.twofa.window.settingstwofa.additionalLoginStepFail"));
                        }
                        else if (e !== "additional-login-step-cancel") {
                            _this.parent.alert(_this.i18n("plugin.twofa.window.settingstwofa.unknown"));
                        }
                    });
                });
            })
                .fin(function () {
                _this.callViewMethod("finishSaving", saved);
            });
        });
    };
    SettingsTwofaWindowController.prototype.onViewDisable = function () {
        var _this = this;
        if (!this.is2faEnabled) {
            this.callViewMethod("setEnabled", false);
            return;
        }
        this.parent.confirmEx({
            message: this.i18n("plugin.twofa.window.settingstwofa.confirm.disable"),
            yes: {
                visible: true,
            },
            no: {
                visible: true,
            },
        }).then(function (result) {
            if (result.result == "yes") {
                return _this.twofaService.api.disable()
                    .then(function () {
                    _this.is2faEnabled = false;
                    _this.callViewMethod("setEnabled", false);
                });
            }
        })
            .fail(this.errorCallback);
    };
    SettingsTwofaWindowController.prototype.onViewGenerateGoogleAuthenticatorKey = function () {
        var key = this.generateGoogleAuthenticatorKey();
        var uri = this.getGoogleAuthenticatorKeyUri(key);
        this.callViewMethod("setGoogleAuthenticatorKey", key, uri);
    };
    SettingsTwofaWindowController.prototype.generateGoogleAuthenticatorKey = function () {
        var key = pmc_mail_1.privfs.crypto.service.randomBytes(20);
        var encoded = base32.encode(key);
        return this.formatGoogleAuthenticatorKey(encoded.toString("utf8").replace(/=/g, ""));
    };
    SettingsTwofaWindowController.prototype.formatGoogleAuthenticatorKey = function (key) {
        return key.toLowerCase().replace(/\W+/g, "").replace(/=/g, "").replace(/(\w{4})/g, "$1 ").trim();
    };
    SettingsTwofaWindowController.prototype.getGoogleAuthenticatorKeyUri = function (key) {
        var encodedKey = key.toUpperCase().replace(/\W+/g, "");
        return "otpauth://totp/" + this.app.userCredentials.hashmail.host + ":" + this.app.userCredentials.hashmail.user + "?secret=" + encodedKey + "&issuer=" + this.app.userCredentials.hashmail.host + "&algorithm=SHA1&digits=6&period=30";
    };
    SettingsTwofaWindowController.textsPrefix = "plugin.twofa.window.settingstwofa.";
    __decorate([
        Inject
    ], SettingsTwofaWindowController.prototype, "identity", void 0);
    return SettingsTwofaWindowController;
}(pmc_mail_1.window.settings.BaseController));
exports.SettingsTwofaWindowController = SettingsTwofaWindowController;
SettingsTwofaWindowController.prototype.className = "com.privmx.plugin.twofa.window.settingstwofa.SettingsTwofaWindowController";

//# sourceMappingURL=SettingsTwofaWindowController.js.map
