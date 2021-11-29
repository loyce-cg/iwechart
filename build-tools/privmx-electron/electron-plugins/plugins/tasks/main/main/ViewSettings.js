"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ViewSettingsStorage_1 = require("./ViewSettingsStorage");
var Types_1 = require("./Types");
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
        this.globalSettingsUsingDefault = {};
        this.settingsInfo = {
            "show-task-panel": { defaults: { "global": 1 }, isolation: ViewSettingIsolation.NONE },
            "enter-saves-task": { defaults: { "global": 0 }, isolation: ViewSettingIsolation.NONE },
            "enter-adds-comment": { defaults: { "global": 0 }, isolation: ViewSettingIsolation.NONE },
            "horizontal-task-window-layout": { defaults: { "global": 1 }, isolation: ViewSettingIsolation.NONE },
            "show-only-unread": { defaults: { "global": 0 }, isolation: ViewSettingIsolation.NONE },
            "narrow-issue-rows": { defaults: { "global": 0 }, isolation: ViewSettingIsolation.NONE },
            "show-orphans": { defaults: { "global": 1 }, isolation: ViewSettingIsolation.PROJECT },
            "show-header-per-list": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.CONTEXT },
            "show-list-progress": { defaults: { "tasks": 1, "summary": 0 }, isolation: ViewSettingIsolation.CONTEXT },
            "show-task-numbers": { defaults: { "tasks": 1, "summary": 0 }, isolation: ViewSettingIsolation.CONTEXT },
            "show-all-other-list-names": { defaults: { "tasks": 1, "summary": 0 }, isolation: ViewSettingIsolation.CONTEXT },
            "show-hash-id-column": { defaults: { "tasks": 1, "summary": 1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-task-column": { defaults: { "tasks": 1, "summary": 1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-type-column": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-status-column": { defaults: { "tasks": 1, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-priority-column": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-assigned-to-column": { defaults: { "tasks": 1, "summary": 1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-attachments-column": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-created-column": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-modified-column": { defaults: { "tasks": 1, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-recently-modified": { defaults: { "tasks": 1, "summary": 1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "kanban-mode": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "hide-done": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-full-task-descriptions": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "collapsed-taskgroups": { defaults: { "tasks": "[]", "summary": "[]" }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "filter": { defaults: { "tasks": "all-tasks", "summary": "all-tasks" }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "kanban-filter": { defaults: { "tasks": "all-tasks", "summary": "all-tasks" }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "texts-with-status-color": { defaults: { "tasks": 0, "summary": 0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
        };
        this.settingsStorage = new ViewSettingsStorage_1.ViewSettingsStorage(prefix, kvdb);
    }
    ViewSettings.prototype.isSettingProjectIsolated = function (name) {
        return (this.settingsInfo && (name in this.settingsInfo) && this.settingsInfo[name].isolation & ViewSettingIsolation.PROJECT) == ViewSettingIsolation.PROJECT;
    };
    ViewSettings.prototype.isSettingContextIsolated = function (name) {
        return (this.settingsInfo && (name in this.settingsInfo) && this.settingsInfo[name].isolation & ViewSettingIsolation.CONTEXT) == ViewSettingIsolation.CONTEXT;
    };
    ViewSettings.prototype.isSettingIsolated = function (name) {
        return !this.isSettingProjectIsolated(name) && !this.isSettingContextIsolated(name);
    };
    ViewSettings.prototype.isSettingGlobal = function (name) {
        return this.settingsInfo && (name in this.settingsInfo) && this.settingsInfo[name].isolation == ViewSettingIsolation.NONE;
    };
    ViewSettings.prototype.loadSettings = function (session, projectId, overrideDefaults) {
        var _this = this;
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
                if (this.isSettingGlobal(name_1)) {
                    this.globalSettingsUsingDefault[name_1] = true;
                }
            }
        }
        return this.settingsStorage.getArray(projectId).then(function (arr) {
            if (!arr) {
                return;
            }
            arr.forEach(function (x) {
                var key = JSON.parse(x.key);
                projectSettings[key.context][key.name] = x.value;
                if (_this.isSettingGlobal(key.name)) {
                    _this.globalSettingsUsingDefault[key.name] = false;
                }
            });
        });
    };
    ViewSettings.prototype.saveSetting = function (session, name, value, projectId, context) {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = Types_1.ViewContext.Global;
        }
        if (this.isSettingGlobal(name)) {
            this.globalSettingsUsingDefault[name] = false;
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
            context = Types_1.ViewContext.Global;
        }
        var val = this.settingsCache[projectId] && this.settingsCache[projectId][context] ? this.settingsCache[projectId][context][name] : null;
        if (val === 0 || val === 1 || (typeof (val) == "string" && typeof (this.settingsInfo[name].defaults[context]) == "string")) {
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
            context = Types_1.ViewContext.Global;
        }
        return (projectId in this.settingsCache) && (context in this.settingsCache[projectId]) && (name in this.settingsCache[projectId][context]);
    };
    ViewSettings.prototype.overrideDefaultGlobalSetting = function (name, value) {
        if (!(name in this.settingsInfo) || this.isSettingProjectIsolated(name)) {
            return;
        }
        var defaults = this.settingsInfo[name].defaults;
        for (var ctx in defaults) {
            defaults[ctx] = value;
        }
        if (this.isSettingGlobal(name) && this.globalSettingsUsingDefault[name] && this.settingsCache && this.settingsCache["__global__"] && this.settingsCache["__global__"][Types_1.ViewContext.Global]) {
            this.settingsCache["__global__"][Types_1.ViewContext.Global][name] = value;
        }
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
    return ViewSettings;
}());
exports.ViewSettings = ViewSettings;
ViewSetting.prototype.className = "com.privmx.plugin.tasks.main.ViewSetting";
ViewSettings.prototype.className = "com.privmx.plugin.tasks.main.ViewSettings";

//# sourceMappingURL=ViewSettings.js.map
