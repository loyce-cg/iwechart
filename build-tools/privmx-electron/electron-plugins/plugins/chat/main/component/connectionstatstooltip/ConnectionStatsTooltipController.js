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
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var i18n_1 = require("./i18n");
var ConnectionStatsTooltipController = (function (_super) {
    __extends(ConnectionStatsTooltipController, _super);
    function ConnectionStatsTooltipController(parent) {
        var _this = _super.call(this, parent) || this;
        _this.statsCache = {};
        _this.modelsCache = {};
        _this.ipcMode = true;
        return _this;
    }
    ConnectionStatsTooltipController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    ConnectionStatsTooltipController.prototype.onViewRequestContent = function (participantId) {
        this.updateViewModel(participantId);
    };
    ConnectionStatsTooltipController.prototype.updateViewModel = function (participantId) {
        var model = this.getConnectionStatsModel(participantId);
        this.callViewMethod("setContent", participantId, JSON.stringify(model));
    };
    ConnectionStatsTooltipController.prototype.updateViewModelIfShowingTheParticipant = function (participantId) {
        return __awaiter(this, void 0, void 0, function () {
            var currentTargetId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.retrieveFromView("getCurrentTargetId")];
                    case 1:
                        currentTargetId = _a.sent();
                        if (currentTargetId === participantId) {
                            this.updateViewModel(participantId);
                        }
                        return [2];
                }
            });
        });
    };
    ConnectionStatsTooltipController.prototype.getConnectionStatsModel = function (participantId) {
        if (!(participantId in this.modelsCache)) {
            return this.getMissingConnectionStatsModel();
        }
        return this.modelsCache[participantId];
    };
    ConnectionStatsTooltipController.prototype.getMissingConnectionStatsModel = function () {
        return {
            bandwidthDownload: Number.NaN,
            bandwidthUpload: Number.NaN,
            videoBitrateDownload: Number.NaN,
            videoBitrateUpload: Number.NaN,
            audioBitrateDownload: Number.NaN,
            audioBitrateUpload: Number.NaN,
            totalBitrateDownload: Number.NaN,
            totalBitrateUpload: Number.NaN,
            packetLossDownload: Number.NaN,
            packetLossUpload: Number.NaN,
            ping: Number.NaN,
            e2ePing: Number.NaN,
            connectionQuality: Number.NaN,
            maxEnabledResolution: Number.NaN,
        };
    };
    ConnectionStatsTooltipController.prototype.setStats = function (participantId, stats) {
        return __awaiter(this, void 0, void 0, function () {
            var model;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.statsCache[participantId]) {
                            stats = __assign({}, this.statsCache[participantId], stats);
                        }
                        model = {
                            bandwidthDownload: this.hasNumberProperty(stats, ["bandwidth", "download"]) ? stats.bandwidth.download : Number.NaN,
                            bandwidthUpload: this.hasNumberProperty(stats, ["bandwidth", "upload"]) ? stats.bandwidth.upload : Number.NaN,
                            videoBitrateDownload: this.hasNumberProperty(stats, ["bitrate", "video", "download"]) ? stats.bitrate.video.download : Number.NaN,
                            videoBitrateUpload: this.hasNumberProperty(stats, ["bitrate", "video", "upload"]) ? stats.bitrate.video.upload : Number.NaN,
                            audioBitrateDownload: this.hasNumberProperty(stats, ["bitrate", "audio", "download"]) ? stats.bitrate.audio.download : Number.NaN,
                            audioBitrateUpload: this.hasNumberProperty(stats, ["bitrate", "audio", "upload"]) ? stats.bitrate.audio.upload : Number.NaN,
                            totalBitrateDownload: this.hasNumberProperty(stats, ["bitrate", "download"]) ? stats.bitrate.download : Number.NaN,
                            totalBitrateUpload: this.hasNumberProperty(stats, ["bitrate", "upload"]) ? stats.bitrate.upload : Number.NaN,
                            packetLossDownload: this.hasNumberProperty(stats, ["packetLoss", "download"]) ? stats.packetLoss.download : Number.NaN,
                            packetLossUpload: this.hasNumberProperty(stats, ["packetLoss", "upload"]) ? stats.packetLoss.upload : Number.NaN,
                            ping: this.hasNumberProperty(stats, ["jvbRTT"]) ? stats.jvbRTT : Number.NaN,
                            e2ePing: this.hasNumberProperty(stats, ["e2ePing"]) ? stats.e2ePing : Number.NaN,
                            connectionQuality: this.hasNumberProperty(stats, ["connectionQuality"]) ? stats.connectionQuality : Number.NaN,
                            maxEnabledResolution: this.hasNumberProperty(stats, ["maxEnabledResolution"]) ? stats.maxEnabledResolution : Number.NaN,
                        };
                        this.statsCache[participantId] = stats;
                        this.modelsCache[participantId] = model;
                        return [4, this.updateViewModelIfShowingTheParticipant(participantId)];
                    case 1:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    ConnectionStatsTooltipController.prototype.hasNumberProperty = function (object, path) {
        var currentObject = object;
        for (var _i = 0, path_1 = path; _i < path_1.length; _i++) {
            var propertyName = path_1[_i];
            if (!currentObject || !(propertyName in currentObject)) {
                return false;
            }
            currentObject = currentObject[propertyName];
        }
        return typeof (currentObject) === "number";
    };
    ConnectionStatsTooltipController.prototype.removeStats = function (participantId) {
        if (participantId in this.statsCache) {
            delete this.statsCache[participantId];
        }
        if (participantId in this.modelsCache) {
            delete this.modelsCache[participantId];
        }
    };
    ConnectionStatsTooltipController.prototype.clearStats = function () {
        this.statsCache = {};
        this.modelsCache = {};
    };
    ConnectionStatsTooltipController.textsPrefix = "plugin.chat.component.connectionStatsTooltip.";
    return ConnectionStatsTooltipController;
}(pmc_mail_1.component.tooltip.TooltipController));
exports.ConnectionStatsTooltipController = ConnectionStatsTooltipController;
ConnectionStatsTooltipController.prototype.className = "com.privmx.plugin.chat.component.connectionstatstooltip.ConnectionStatsTooltipController";

//# sourceMappingURL=ConnectionStatsTooltipController.js.map
