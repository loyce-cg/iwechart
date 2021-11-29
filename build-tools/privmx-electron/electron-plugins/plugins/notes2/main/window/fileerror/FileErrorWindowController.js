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
var Helper_1 = require("../../main/Helper");
var i18n_1 = require("./i18n");
var FileErrorWindowController = (function (_super) {
    __extends(FileErrorWindowController, _super);
    function FileErrorWindowController(parentWindow, model) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.model = model;
        _this.ipcMode = true;
        _this.setPluginViewAssets("notes2");
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.openWindowOptions = {
            modal: true,
            toolbar: false,
            show: false,
            position: "center",
            width: 440,
            height: 350,
            widget: false,
            draggable: false,
            resizable: false,
            title: _this.i18n("plugin.notes2.window.fileerror.title")
        };
        _this.defer = pmc_mail_1.Q.defer();
        return _this;
    }
    FileErrorWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    FileErrorWindowController.prototype.getPromise = function () {
        return this.defer.promise;
    };
    FileErrorWindowController.prototype.getModel = function () {
        return this.model;
    };
    FileErrorWindowController.prototype.beforeClose = function () {
        this.defer.resolve({
            abort: true,
            retry: false
        });
    };
    FileErrorWindowController.prototype.onViewAbort = function () {
        this.close();
    };
    FileErrorWindowController.prototype.onViewOmit = function () {
        this.defer.resolve({
            abort: false,
            retry: false
        });
        this.close();
    };
    FileErrorWindowController.prototype.onViewRetry = function () {
        this.defer.resolve({
            abort: false,
            retry: true
        });
        this.close();
    };
    FileErrorWindowController.convertModel = function (result) {
        var model = {
            operationType: Helper_1.Helper.convertOperationType(result.operation.type),
            error: result.status,
            dirNotEmptyError: result.status == pmc_mail_1.privfs.fs.file.multi.OperationStatus.DIRECTORY_NOT_EMPTY,
            source: {
                name: pmc_mail_1.mail.filetree.Path.parsePath(result.operation.source.path).name.original,
                path: result.operation.source.path
            },
            destination: result.operation.destination ? {
                name: pmc_mail_1.mail.filetree.Path.parsePath(result.operation.destination.path).name.original,
                path: result.operation.destination.path
            } : null
        };
        return model;
    };
    FileErrorWindowController.textsPrefix = "plugin.notes2.window.fileerror.";
    return FileErrorWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.FileErrorWindowController = FileErrorWindowController;
FileErrorWindowController.prototype.className = "com.privmx.plugin.notes2.window.fileerror.FileErrorWindowController";

//# sourceMappingURL=FileErrorWindowController.js.map
