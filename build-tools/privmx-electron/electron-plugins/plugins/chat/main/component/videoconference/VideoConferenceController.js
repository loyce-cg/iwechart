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
var index_1 = require("./i18n/index");
var Logger = pmc_mail_1.Logger.get("chat-plugin.window.videoConference.VideoConferenceWindowController");
var VideoConferenceController = (function (_super) {
    __extends(VideoConferenceController, _super);
    function VideoConferenceController(parent, roomMetadata) {
        var _this = _super.call(this, parent) || this;
        _this.roomMetadata = roomMetadata;
        _this.conferenceId = null;
        _this.currentSection = null;
        _this.connected = false;
        _this.talkingWhenMutedNotificationId = null;
        _this.ipcMode = true;
        _this.chatPlugin = _this.app.getComponent("chat-plugin");
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.desktopPicker = _this.addComponent("desktopPicker", _this.componentFactory.createComponent("desktoppicker", [_this]));
        _this.resolutionCustomSelect = _this.addComponent("resolutionCustomSelect", _this.componentFactory.createComponent("customselect", [_this, {
                items: [],
                editable: true,
                size: "small",
                noSelectionItem: {
                    type: "item",
                    icon: null,
                    text: _this.i18n("window.videorecorder.resolutionCustomSelect.noSelection.text"),
                    selected: false,
                    value: null,
                },
            }]));
        _this.connectionStatsTooltip = _this.addComponent("connectionStatsTooltip", _this.componentFactory.createComponent("connectionstatstooltip", [_this]));
        return _this;
    }
    VideoConferenceController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    VideoConferenceController.prototype.init = function () {
        return pmc_mail_1.Q();
    };
    VideoConferenceController.prototype.getModel = function () {
        return {
            roomMetadata: this.roomMetadata,
        };
    };
    VideoConferenceController.prototype.obtainConnectionOptions = function (section, roomMetadata) {
        var _this = this;
        if (!this.session) {
            return pmc_mail_1.Q.reject("VideoConferenceController.obtainConfiguration(): no session");
        }
        var hashmail = null;
        if (this.session.userData && this.session.userData.identity) {
            hashmail = this.session.userData.identity.hashmail;
        }
        return pmc_mail_1.Q().then(function () {
            return _this.app.videoConferencesService.joinConference(_this.session, section, function (data) {
                var connectionOptions = {
                    configuration: {
                        domain: data.domain,
                        appId: null,
                        token: null,
                        hashmail: hashmail,
                        conferenceId: data.roomName,
                        conferencePassword: data.conferencePassword,
                        conferenceEncryptionKey: null,
                        conferenceEncryptionIV: null,
                    },
                    tmpUserName: data.tmpUser.username,
                    tmpUserPassword: data.tmpUser.password,
                    options: {
                        title: roomMetadata.title,
                        experimentalH264: roomMetadata.experimentalH264,
                    },
                };
                return _this.retrieveFromView("connectAndCreateConference", JSON.stringify(connectionOptions))
                    .then(function (resultStr) {
                    var result = JSON.parse(resultStr);
                    if (result.status == "error") {
                        throw "could not connect: " + result.errorStr;
                    }
                    if (result.status == "cancelled") {
                        throw "cancelled by user";
                    }
                    _this.connected = result.status == "ok";
                    if (result.status == "ok") {
                        return {
                            encryptionKey: result.data.key,
                            encryptionIV: result.data.iv,
                            roomMetadata: roomMetadata,
                        };
                    }
                    return {
                        encryptionKey: null,
                        encryptionIV: null,
                        roomMetadata: roomMetadata,
                    };
                });
            });
        })
            .then(function (conference) {
            _this.conferenceId = conference.id;
            _this.currentSection = section;
            return {
                configuration: {
                    domain: conference.jitsiDomain,
                    appId: null,
                    token: null,
                    hashmail: hashmail,
                    conferenceId: conference.id,
                    conferencePassword: conference.password,
                    conferenceEncryptionKey: conference.encryptionKey,
                    conferenceEncryptionIV: conference.encryptionIV,
                },
                options: {
                    title: conference.roomMetadata.title,
                    experimentalH264: conference.roomMetadata.experimentalH264,
                },
            };
        });
    };
    VideoConferenceController.prototype.onViewLeaveVideoConference = function (cause) {
        this.onConnectionError(cause);
        this.connected = false;
        this.app.dispatchEvent({
            type: "leave-video-conference",
        });
        this.app.videoConferencesService.leaveConference(this.session, this.currentSection, this.conferenceId);
        this.conferenceId = null;
        this.currentSection = null;
    };
    VideoConferenceController.prototype.disconnect = function () {
        return this.retrieveFromView("disconnect").thenResolve(null);
    };
    VideoConferenceController.prototype.connect = function (session, section, roomMetadata) {
        var _this = this;
        if (this.connected) {
            return pmc_mail_1.Q();
        }
        this.session = session;
        this.currentSection = section;
        this.showLoadingOverlay();
        return this.obtainConnectionOptions(section, roomMetadata).then(function (options) {
            if (!_this.connected) {
                _this.callViewMethod("connect", JSON.stringify(options));
            }
        })
            .catch(function (e) {
            _this.onConnectionError("" + e);
            throw e;
        });
    };
    VideoConferenceController.prototype.onConnectionError = function (info) {
        if (info.includes(".disconnect()")) {
            console.log("VideoConference disconnected: " + info);
        }
        else {
            console.error("VideoConference error: " + info);
            this.onError("VideoConference error: " + info);
        }
    };
    VideoConferenceController.prototype.onViewConnected = function () {
        this.hideLoadingOverlay();
        this.callViewMethod("setVideoFrameSignatureVerificationRatioInverse", this.app.userPreferences.getVideoFrameSignatureVerificationRatioInverse());
    };
    VideoConferenceController.prototype.onViewConnectCancelled = function () {
        this.hideLoadingOverlay();
        this.onViewLeaveVideoConference(JSON.stringify({ reason: "connectinCancelledByUser", extraInfo: "VideoConferenceController.onViewConnectCancelled()" }));
    };
    VideoConferenceController.prototype.onViewUnsupportedBrowser = function () {
        this.parent.app.msgBox.alert(this.i18n("plugin.chat.component.videoconference.error.unsupportedBrowser"));
    };
    VideoConferenceController.prototype.showLoadingOverlay = function () {
        this.callViewMethod("showLoadingOverlay");
    };
    VideoConferenceController.prototype.hideLoadingOverlay = function () {
        this.callViewMethod("hideLoadingOverlay");
    };
    VideoConferenceController.prototype.onViewShowTalkingWhenMutedNotification = function () {
        if (this.talkingWhenMutedNotificationId === null) {
            var text = this.i18n("plugin.chat.component.videoconference.talkingWhenMutedNotification");
            this.talkingWhenMutedNotificationId = this.notifications.showNotification(text, {
                autoHide: false,
                progress: false,
                extraCssClass: "talking-when-muted-notification",
            });
        }
    };
    VideoConferenceController.prototype.onViewHideTalkingWhenMutedNotification = function () {
        if (this.talkingWhenMutedNotificationId !== null) {
            this.notifications.hideNotification(this.talkingWhenMutedNotificationId);
            this.talkingWhenMutedNotificationId = null;
        }
    };
    VideoConferenceController.prototype.onViewGong = function (message) {
        this.chatPlugin.gong(this.session, this.currentSection, message);
    };
    VideoConferenceController.prototype.onViewSetAlwaysOnTop = function (alwaysOnTop) {
        this.parent.setAlwaysOnTop(!!alwaysOnTop);
    };
    VideoConferenceController.prototype.onViewSetAvailableResolutions = function (resolutions) {
        var horizontalResolutions = resolutions.filter(function (resolution) { return resolution.width >= resolution.height; });
        var verticalResolutions = resolutions.filter(function (resolution) { return resolution.width < resolution.height; });
        var hasSeparator = horizontalResolutions.length > 0 && verticalResolutions.length > 0;
        var separator = hasSeparator ? ["separator"] : [];
        var resolutionsWithSeparators = horizontalResolutions.concat(separator, verticalResolutions);
        var items = resolutionsWithSeparators.map(function (resolutionOrSeparator) {
            if (typeof (resolutionOrSeparator) == "string") {
                return {
                    type: "separator",
                };
            }
            else {
                var resolution = resolutionOrSeparator;
                return {
                    type: "item",
                    icon: null,
                    selected: resolution.isCurrent,
                    text: resolution.width + " x " + resolution.height,
                    value: resolution.width + "x" + resolution.height,
                };
            }
        });
        this.resolutionCustomSelect.setItems(items);
    };
    VideoConferenceController.prototype.onViewParticipantConnectionStatsUpdated = function (participantId, statsStr) {
        if (statsStr === null) {
            this.connectionStatsTooltip.removeStats(participantId);
        }
        else {
            var stats = JSON.parse(statsStr);
            this.connectionStatsTooltip.setStats(participantId, stats);
        }
    };
    VideoConferenceController.textsPrefix = "plugin.chat.component.videoconference.";
    return VideoConferenceController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.VideoConferenceController = VideoConferenceController;
VideoConferenceController.prototype.className = "com.privmx.plugin.chat.component.videoconference.VideoConferenceController";

//# sourceMappingURL=VideoConferenceController.js.map
