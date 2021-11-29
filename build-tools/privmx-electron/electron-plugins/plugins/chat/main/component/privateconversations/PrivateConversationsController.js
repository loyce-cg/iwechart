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
var Inject = pmc_mail_1.utils.decorators.Inject;
var index_1 = require("./i18n/index");
var PrivateConversationsController = (function (_super) {
    __extends(PrivateConversationsController, _super);
    function PrivateConversationsController(parent) {
        var _this = _super.call(this, parent) || this;
        _this.isSectionSet = false;
        _this.ipcMode = true;
        _this.chatPlugin = _this.app.getComponent("chat-plugin");
        return _this;
    }
    PrivateConversationsController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    PrivateConversationsController.prototype.init = function () {
    };
    PrivateConversationsController.prototype.getModel = function () {
        return { data: null };
    };
    PrivateConversationsController.textsPrefix = "plugin.chat.component.privateConversations.";
    __decorate([
        Inject
    ], PrivateConversationsController.prototype, "identity", void 0);
    __decorate([
        Inject
    ], PrivateConversationsController.prototype, "hashmailResolver", void 0);
    __decorate([
        Inject
    ], PrivateConversationsController.prototype, "personService", void 0);
    __decorate([
        Inject
    ], PrivateConversationsController.prototype, "sinkIndexManager", void 0);
    __decorate([
        Inject
    ], PrivateConversationsController.prototype, "messageService", void 0);
    __decorate([
        Inject
    ], PrivateConversationsController.prototype, "conv2Service", void 0);
    return PrivateConversationsController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.PrivateConversationsController = PrivateConversationsController;
PrivateConversationsController.prototype.className = "com.privmx.plugin.chat.component.privateconversations.PrivateConversationsController";

//# sourceMappingURL=PrivateConversationsController.js.map
