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
var TwofaApi_1 = require("../../main/TwofaApi");
var index_1 = require("./i18n/index");
var DataEncoder_1 = require("../../main/DataEncoder");
var CodeWindowController = (function (_super) {
    __extends(CodeWindowController, _super);
    function CodeWindowController(parent, options) {
        var _this = _super.call(this, parent, __filename, __dirname) || this;
        _this.ipcMode = true;
        _this.data = options.data;
        _this.cancellable = !!options.cancellable;
        _this.setPluginViewAssets("twofa");
        _this.openWindowOptions.position = "center-always";
        _this.openWindowOptions.width = 400;
        _this.openWindowOptions.height = 200;
        _this.openWindowOptions.modal = true;
        _this.openWindowOptions.widget = false;
        _this.openWindowOptions.draggable = false;
        _this.openWindowOptions.resizable = false;
        _this.openWindowOptions.title = _this.i18n("plugin.twofa.window.code.title");
        _this.openWindowOptions.electronPartition = pmc_mail_1.app.ElectronPartitions.HTTPS_SECURE_CONTEXT;
        _this.loadWindowOptions.host = options.host;
        _this.api = options.api;
        _this.u2f = options.u2f;
        _this.defer = pmc_mail_1.Q.defer();
        return _this;
    }
    CodeWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    CodeWindowController.isSupported = function (data) {
        return data.type == "googleAuthenticator" || data.type == "email" || data.type == "sms" || data.type == "u2f";
    };
    CodeWindowController.prototype.getModel = function () {
        return {
            data: this.data,
            cancellable: this.cancellable,
            u2f: DataEncoder_1.DataEncoder.decode(this.u2f)
        };
    };
    CodeWindowController.prototype.getPromise = function () {
        return this.defer.promise;
    };
    CodeWindowController.prototype.onViewSubmit = function (model) {
        var _this = this;
        pmc_mail_1.Q().then(function () {
            return _this.api.challenge(DataEncoder_1.DataEncoder.encode(model));
        })
            .then(function () {
            _this.callViewMethod("clearState");
            _this.defer.resolve();
            _this.close();
        })
            .fail(function (e) {
            _this.logError(e);
            if (e && e.data && e.data.error && e.data.error.code == TwofaApi_1.TwofaApi.TWOFA_INVALID_CODE) {
                _this.callViewMethod("clearState");
                _this.callViewMethod("showMessage", "error", _this.i18n("plugin.twofa.window.code.invalid", e.data.error.data));
            }
            else if (e && e.data && e.data.error && e.data.error.code == TwofaApi_1.TwofaApi.TWOFA_VERIFICATION_FAILED) {
                _this.callViewMethod("clearState");
                _this.defer.reject("additional-login-step-fail");
                _this.close();
            }
            else {
                _this.callViewMethod("clearState");
                _this.callViewMethod("showMessage", "error", _this.i18n("plugin.twofa.window.code.error.unexpected"));
            }
        });
    };
    CodeWindowController.prototype.onViewCancel = function () {
        if (this.cancellable) {
            this.close();
        }
    };
    CodeWindowController.prototype.onViewResend = function () {
        var _this = this;
        pmc_mail_1.Q().then(function () {
            return _this.api.resendCode();
        })
            .then(function () {
            _this.callViewMethod("showMessage", "success", _this.i18n("plugin.twofa.window.code.resend.success"));
            _this.callViewMethod("clearState");
        })
            .fail(function (e) {
            _this.logError(e);
            if (e && e.data && e.data.error && e.data.error.code == TwofaApi_1.TwofaApi.TWOFA_CODE_ALREADY_RESEND) {
                _this.callViewMethod("showMessage", "info", _this.i18n("plugin.twofa.window.code.resend.alreadyResent"));
            }
            else {
                _this.callViewMethod("showMessage", "error", _this.i18n("plugin.twofa.window.code.resend.error"));
            }
            _this.callViewMethod("clearState");
        });
    };
    CodeWindowController.prototype.close = function (force) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _super.prototype.close.call(_this, force);
        })
            .then(function () {
            _this.defer.reject("additional-login-step-cancel");
        });
    };
    CodeWindowController.textsPrefix = "plugin.twofa.window.code.";
    return CodeWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.CodeWindowController = CodeWindowController;
CodeWindowController.prototype.className = "com.privmx.plugin.twofa.window.code.CodeWindowController";

//# sourceMappingURL=CodeWindowController.js.map
