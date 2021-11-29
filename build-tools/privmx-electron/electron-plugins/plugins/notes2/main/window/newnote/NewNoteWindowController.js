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
var i18n_1 = require("./i18n");
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var NewNoteWindowController = (function (_super) {
    __extends(NewNoteWindowController, _super);
    function NewNoteWindowController(parentWindow, options) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.uploadAction = null;
        _this.ipcMode = true;
        _this.defaultDestination = options ? options.defaultDestination : "";
        _this.actions = _this.app.shellRegistry.getActions(pmc_mail_1.app.common.shelltypes.ShellActionType.CREATE);
        _this.actions.forEach(function (action) {
            if (action.id.indexOf("text") > -1) {
                action.order = 0;
                action.labelKey = "plugin.notes2.window.newNote.fileType.text.label";
            }
            else if (action.id.indexOf("mind") > -1) {
                action.order = 1;
                action.labelKey = "plugin.notes2.window.newNote.fileType.mindmap.label";
            }
            else {
                action.order = 2;
            }
        });
        _this.actions = _this.actions.filter(function (x) { return x.id != "core.upload" && x.id != "core.upload-multi"; });
        _this.defered = pmc_mail_1.Q.defer();
        _this.setPluginViewAssets("notes2");
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.openWindowOptions = {
            modal: true,
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 496,
            height: 400,
            resizable: false,
            title: _this.i18n("plugin.notes2.window.newNote.title")
        };
        return _this;
    }
    NewNoteWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    NewNoteWindowController.prototype.init = function () {
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.conversations = this.addComponent("conversations", this.componentFactory.createComponent("conv2list", [this, {}]));
    };
    NewNoteWindowController.prototype.getResult = function () {
        return this.defered.promise;
    };
    NewNoteWindowController.prototype.getModel = function () {
        return {
            defaultDestination: this.defaultDestination,
            hashmail: this.identity.hashmail,
            channels: this.notes2Plugin.sectionManager.filteredCollection.findAll(function (x) { return x.isChatModuleEnabled() || x.isFileModuleEnabled(); }).map(function (x) {
                return {
                    id: x.getId(),
                    name: x.getName(),
                    scope: x.getScope()
                };
            }),
            actions: this.actions.sort(function (a, b) { return a.order - b.order; }).map(function (x) {
                return {
                    id: x.id,
                    labelKey: x.labelKey,
                    icon: x.icon,
                    defaultName: x.defaultName
                };
            })
        };
    };
    NewNoteWindowController.prototype.onViewCreateFile = function (actionId, destination, fileName, openAfterCreate) {
        var _this = this;
        if (this.content) {
            this.content = this.content.create(null, fileName);
            this.defered.resolve({ destination: destination, content: this.content, openAfterCreate: openAfterCreate });
            this.close();
        }
        else {
            this.app.shellRegistry.callAppAction(actionId, fileName).then(function (content) {
                _this.defered.resolve({ destination: destination, content: content, openAfterCreate: openAfterCreate });
                _this.close();
            })
                .fail(this.errorCallback);
        }
    };
    NewNoteWindowController.prototype.onViewChooseAction = function (actionId, fileName, fromClick) {
        var _this = this;
        this.uploadAction = null;
        if (actionId.indexOf("upload") > -1 && !fromClick) {
            this.uploadAction = { actionId: actionId, fileName: fileName };
            return;
        }
        var appAction = this.app.shellRegistry.getAppAction(actionId);
        if (appAction.overwritesName) {
            this.app.shellRegistry.callAppAction(actionId, fileName).then(function (content) {
                _this.content = content;
                _this.callViewMethod("setName", _this.content.getName());
            })
                .fail(this.errorCallback);
        }
        else {
            this.content = null;
        }
    };
    NewNoteWindowController.prototype.onViewUploadActionConfirmed = function () {
        var _this = this;
        if (this.uploadAction && !this.content) {
            var appAction = this.app.shellRegistry.getAppAction(this.uploadAction.actionId);
            if (appAction.overwritesName) {
                this.app.shellRegistry.callAppAction(this.uploadAction.actionId, this.uploadAction.fileName).then(function (content) {
                    _this.content = content;
                    _this.callViewMethod("setName", _this.content.getName());
                })
                    .fail(this.errorCallback);
            }
            else {
                this.content = null;
            }
        }
    };
    NewNoteWindowController.prototype.onViewCancel = function () {
        this.close();
    };
    NewNoteWindowController.textsPrefix = "plugin.notes2.window.newNote.";
    __decorate([
        Inject
    ], NewNoteWindowController.prototype, "identity", void 0);
    NewNoteWindowController = __decorate([
        Dependencies(["persons", "conversationlist"])
    ], NewNoteWindowController);
    return NewNoteWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.NewNoteWindowController = NewNoteWindowController;
NewNoteWindowController.prototype.className = "com.privmx.plugin.notes2.window.newnote.NewNoteWindowController";

//# sourceMappingURL=NewNoteWindowController.js.map
