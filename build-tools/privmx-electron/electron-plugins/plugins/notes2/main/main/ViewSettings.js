"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ViewSettingsStorage_1 = require("./ViewSettingsStorage");
var Common_1 = require("./Common");
var ViewSettingIsolation;
(function (ViewSettingIsolation) {
    ViewSettingIsolation[ViewSettingIsolation["NONE"] = 0] = "NONE";
    ViewSettingIsolation[ViewSettingIsolation["PROJECT"] = 1] = "PROJECT";
    ViewSettingIsolation[ViewSettingIsolation["CONTEXT"] = 2] = "CONTEXT";
})(ViewSettingIsolation = exports.ViewSettingIsolation || (exports.ViewSettingIsolation = {}));
var ViewSetting = (function () {
    function ViewSetting() {
    }
    return ViewSetting;
}());
exports.ViewSetting = ViewSetting;
var ViewSettings = (function () {
    function ViewSettings(prefix, kvdb) {
        this.settingsCache = {};
        this.settingsInfo = {
            "view-mode": { defaults: { "notes2": 0, "summary": 0, "filechooser": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-file-preview": { defaults: { "global": 1 }, isolation: ViewSettingIsolation.NONE },
            "show-url-files": { defaults: { "global": 1 }, isolation: ViewSettingIsolation.NONE },
            "show-hidden-files": { defaults: { "global": 0 }, isolation: ViewSettingIsolation.NONE },
        };
        this.settingsStorage = new ViewSettingsStorage_1.ViewSettingsStorage(prefix, kvdb);
    }
    ViewSettings.prototype.isSettingProjectIsolated = function (name) {
        return (this.settingsInfo[name].isolation & ViewSettingIsolation.PROJECT) == ViewSettingIsolation.PROJECT;
    };
    ViewSettings.prototype.isSettingContextIsolated = function (name) {
        return (this.settingsInfo[name].isolation & ViewSettingIsolation.CONTEXT) == ViewSettingIsolation.CONTEXT;
    };
    ViewSettings.prototype.isSettingIsolated = function (name) {
        return !this.isSettingProjectIsolated(name) && !this.isSettingContextIsolated(name);
    };
    ViewSettings.prototype.loadSettings = function (session, projectId, overrideDefaults) {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!(projectId in this.settingsCache)) {
            this.settingsCache[projectId] = {};
        }
        if (!overrideDefaults) {
            overrideDefaults = {};
        }
        var projectSettings = this.settingsCache[projectId];
        for (var name_1 in this.settingsInfo) {
            var data = this.settingsInfo[name_1];
            for (var ctx in data.defaults) {
                if (!projectSettings[ctx]) {
                    projectSettings[ctx] = {};
                }
                projectSettings[ctx][name_1] = (name_1 in overrideDefaults) ? overrideDefaults[name_1] : data.defaults[ctx];
            }
        }
        return this.settingsStorage.getArray(projectId).then(function (arr) {
            if (!arr) {
                return;
            }
            arr.forEach(function (x) {
                var key = JSON.parse(x.key);
                projectSettings[key.context][key.name] = x.value;
            });
        });
    };
    ViewSettings.prototype.saveSetting = function (session, name, value, projectId, context) {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = Common_1.ViewContext.Global;
        }
        this.settingsCache[projectId][context][name] = value;
        var now = new Date().getTime();
        this.settingsStorage.setValue(projectId, [{
                key: this.getKey(name, projectId, context),
                value: value,
                setDT: now,
            }]);
    };
    ViewSettings.prototype.getSetting = function (session, name, projectId, context) {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = Common_1.ViewContext.Global;
        }
        var val = this.settingsCache[projectId][context][name];
        if (val === 0 || val === 1) {
            return val;
        }
        return this.settingsInfo[name].defaults[context];
    };
    ViewSettings.prototype.hasProject = function (session, projectId) {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        return projectId in this.settingsCache;
    };
    ViewSettings.prototype.hasSetting = function (session, name, projectId, context) {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = Common_1.ViewContext.Global;
        }
        return (projectId in this.settingsCache) && (context in this.settingsCache[projectId]) && (name in this.settingsCache[projectId][context]);
    };
    ViewSettings.prototype.getKey = function (name, finalProjectId, context) {
        var key = {
            name: name,
            project: finalProjectId,
            context: context,
        };
        return JSON.stringify(key);
    };
    ViewSettings.getSettingFullProjectId = function (session, projectId) {
        if (!session || !projectId) {
            return projectId;
        }
        var isRemoteSession = session.sessionType == "remote";
        var fullProjectId = isRemoteSession ? session.hostHash + "--" + projectId : projectId;
        return fullProjectId;
    };
    ViewSettings.VIEW_MODE = "view-mode";
    ViewSettings.SHOW_FILE_PREVIEW = "show-file-preview";
    ViewSettings.SHOW_URL_FILES = "show-url-files";
    ViewSettings.SHOW_HIDDEN_FILES = "show-hidden-files";
    return ViewSettings;
}());
exports.ViewSettings = ViewSettings;
ViewSetting.prototype.className = "com.privmx.plugin.notes2.main.ViewSetting";
ViewSettings.prototype.className = "com.privmx.plugin.notes2.main.ViewSettings";

//# sourceMappingURL=ViewSettings.js.map
