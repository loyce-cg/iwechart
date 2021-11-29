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
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var index_1 = require("./i18n/index");
var VideoConferenceWindowController = (function (_super) {
    __extends(VideoConferenceWindowController, _super);
    function VideoConferenceWindowController(parentWindow, joinVideoConferenceEvent) {
        var _this = _super.call(this, parentWindow, __filename, __dirname, {
            isPublic: false
        }) || this;
        _this.joinVideoConferenceEvent = joinVideoConferenceEvent;
        _this.leftVideoConference = false;
        _this.onLeaveVideoConferenceBound = _this.onLeaveVideoConference.bind(_this);
        _this.closeDeferred = pmc_mail_1.Q.defer();
        _this.ipcMode = true;
        var screenSize = _this.app.getScreenResolution();
        var minInitialWindowWidth = 900;
        var minInitialWindowHeight = 400;
        var maxInitialWindowWidth = 1800;
        var maxInitialWindowHeight = 800;
        var percentInitialWindowWidth = 0.8;
        var percentInitialWindowHeight = 0.8;
        var initialWindowWidth = Math.max(minInitialWindowWidth, Math.min(maxInitialWindowWidth, percentInitialWindowWidth * screenSize.width));
        var initialWindowHeight = Math.max(minInitialWindowHeight, Math.min(maxInitialWindowHeight, percentInitialWindowHeight * screenSize.height));
        _this.openWindowOptions.width = Math.floor(initialWindowWidth);
        _this.openWindowOptions.height = Math.floor(initialWindowHeight);
        _this.openWindowOptions.electronPartition = pmc_mail_1.app.ElectronPartitions.HTTPS_SECURE_CONTEXT;
        _this.openWindowOptions.backgroundColor = "#1b1d1d";
        _this.openWindowOptions.minWidth = 250;
        _this.openWindowOptions.minHeight = 220;
        _this.openWindowOptions.icon = "privmx-icon privmx-icon-videocall";
        _this.chatPlugin = _this.app.getComponent("chat-plugin");
        _this.chatPlugin.currentVideoConferenceWindowController = _this;
        _this.setPluginViewAssets("chat");
        _this.openWindowOptions.title = _this.i18n("plugin.chat.window.videoconference.title");
        _this.addViewScript({ path: "build/jitsi/lib-jitsi-meet.min.js", plugin: "chat" });
        return _this;
    }
    VideoConferenceWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    VideoConferenceWindowController.prototype.init = function () {
        var _this = this;
        return this.app.mailClientApi.checkLoginCore().then(function () {
            return _this.app.mailClientApi.prepareSectionManager();
        })
            .then(function () {
            _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
            _this.videoConference = _this.addComponent("videoConference", _this.componentFactory.createComponent("videoconference", [_this, _this.joinVideoConferenceEvent.roomMetadata]));
            _this.bindEvent(_this.app, "leave-video-conference", _this.onLeaveVideoConferenceBound);
        });
    };
    VideoConferenceWindowController.prototype.onViewLoad = function () {
        this.joinVideoConference(this.joinVideoConferenceEvent);
    };
    VideoConferenceWindowController.prototype.getModel = function () {
        return {};
    };
    VideoConferenceWindowController.prototype.joinVideoConference = function (event) {
        var _this = this;
        var session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
        var section = event.section ? event.section : (event.conversation ? event.conversation.section : null);
        if (session && section) {
            return this.videoConference.connect(session, section, event.roomMetadata)
                .fail(function (e) {
                _this.videoConference.disconnect();
            });
        }
        return pmc_mail_1.Q();
    };
    VideoConferenceWindowController.prototype.leaveVideoConference = function () {
        return this.videoConference.disconnect();
    };
    VideoConferenceWindowController.prototype.onLeaveVideoConference = function (event) {
        if (this.app) {
            this.unbindEvent(this.app, "leave-video-conference", this.onLeaveVideoConferenceBound);
        }
        this.leftVideoConference = true;
        if (this.manager && this.manager.stateListeners) {
            this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_IDLE);
        }
        this.close();
    };
    VideoConferenceWindowController.prototype.beforeClose = function (_force) {
        var _this = this;
        if (!this.leftVideoConference) {
            this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_CLOSE_CANCELLED);
            return this.leaveVideoConference()
                .fin(function () {
                _this.chatPlugin.currentVideoConferenceWindowController = null;
                _this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_IDLE);
            });
        }
        else {
            this.chatPlugin.currentVideoConferenceWindowController = null;
            this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_IDLE);
        }
    };
    VideoConferenceWindowController.prototype.onClose = function () {
        _super.prototype.onClose.call(this);
        this.closeDeferred.resolve();
    };
    VideoConferenceWindowController.textsPrefix = "plugin.chat.window.videoconference.";
    VideoConferenceWindowController = __decorate([
        Dependencies(["videoconference"])
    ], VideoConferenceWindowController);
    return VideoConferenceWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.VideoConferenceWindowController = VideoConferenceWindowController;
VideoConferenceWindowController.prototype.className = "com.privmx.plugin.chat.window.videoConference.VideoConferenceWindowController";

//# sourceMappingURL=VideoConferenceWindowController.js.map
