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
var Common_1 = require("../../main/Common");
var Helper_1 = require("../../main/Helper");
var i18n_1 = require("./i18n");
var FileConflictResolverWindowController = (function (_super) {
    __extends(FileConflictResolverWindowController, _super);
    function FileConflictResolverWindowController(parentWindow, model) {
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
            width: 500,
            height: 400,
            widget: false,
            draggable: false,
            resizable: false,
            title: _this.i18n("plugin.notes2.window.fileconflictresolver.title")
        };
        _this.defer = pmc_mail_1.Q.defer();
        return _this;
    }
    FileConflictResolverWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    FileConflictResolverWindowController.prototype.getPromise = function () {
        return this.defer.promise;
    };
    FileConflictResolverWindowController.prototype.getModel = function () {
        return this.model;
    };
    FileConflictResolverWindowController.prototype.beforeClose = function () {
        this.defer.resolve({
            abort: true,
            behaviour: null,
            forAll: false
        });
    };
    FileConflictResolverWindowController.prototype.onViewAbort = function () {
        this.close();
    };
    FileConflictResolverWindowController.prototype.onViewOmit = function (forAll) {
        this.defer.resolve({
            abort: false,
            behaviour: false,
            forAll: forAll
        });
        this.close();
    };
    FileConflictResolverWindowController.prototype.onViewOverwrite = function (forAll) {
        this.defer.resolve({
            abort: false,
            behaviour: true,
            forAll: forAll
        });
        this.close();
    };
    FileConflictResolverWindowController.convertModel = function (result, app) {
        var conflictType = Helper_1.Helper.convertConflictType(result.status);
        var dstIsFolder = conflictType == Common_1.ConflictType.DIRECTORIES_MERGE || conflictType == Common_1.ConflictType.DIRECTORY_OVERWRITE_BY_FILE;
        var srcIsFolder = conflictType == Common_1.ConflictType.DIRECTORIES_MERGE || conflictType == Common_1.ConflictType.FILE_OVERWRITE_BY_DIRECTORY;
        var model = {
            conflictType: conflictType,
            operationType: Helper_1.Helper.convertOperationType(result.operation.type),
            source: {
                name: pmc_mail_1.mail.filetree.Path.parsePath(result.operation.source.path).name.original,
                path: result.operation.source.path,
                icon: srcIsFolder ? "fa fa-folder" : app.shellRegistry.resolveIcon(pmc_mail_1.mail.filetree.MimeType.resolve(result.operation.source.path)),
            },
            destination: {
                name: pmc_mail_1.mail.filetree.Path.parsePath(result.operation.destination.path).name.original,
                path: result.operation.destination.path,
                icon: dstIsFolder ? "fa fa-folder" : app.shellRegistry.resolveIcon(pmc_mail_1.mail.filetree.MimeType.resolve(result.operation.destination.path)),
            }
        };
        return model;
    };
    FileConflictResolverWindowController.textsPrefix = "plugin.notes2.window.fileconflictresolver.";
    return FileConflictResolverWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.FileConflictResolverWindowController = FileConflictResolverWindowController;
FileConflictResolverWindowController.prototype.className = "com.privmx.plugin.notes2.window.fileconflictresolver.FileConflictResolverWindowController";

//# sourceMappingURL=FileConflictResolverWindowController.js.map
