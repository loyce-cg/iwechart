"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Mail = require("pmc-mail");
var Q = Mail.Q;
var index_1 = require("../i18n/index");
var MindmapElementSpec = (function () {
    function MindmapElementSpec() {
    }
    return MindmapElementSpec;
}());
exports.MindmapElementSpec = MindmapElementSpec;
var EditorPlugin = (function () {
    function EditorPlugin(app) {
        this.app = app;
    }
    EditorPlugin.prototype.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, "plugin.editor.");
    };
    EditorPlugin.prototype.logout = function () {
        this.initPromise = null;
    };
    EditorPlugin.prototype.checkInit = function () {
        if (this.initPromise == null) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    };
    EditorPlugin.prototype.init = function () {
        var _this = this;
        return Q().then(function () {
            return _this.app.mailClientApi.loadUserPreferences();
        });
    };
    EditorPlugin.prototype.getNotesPreferences = function () {
        var _this = this;
        return this.app.mailClientApi.privmxRegistry.getUserPreferences().then(function (userPreferences) {
            _this.userPreferences = userPreferences;
            return _this.getNotesPreferencesC(userPreferences);
        });
    };
    EditorPlugin.prototype.getNotesPreferencesC = function (userPreferences) {
        return userPreferences.getValue("notes");
    };
    EditorPlugin.prototype.getNewMindmapContent = function (fileName) {
        var _this = this;
        return this.getNotesPreferences().then(function (notesPreferences) { return _this.getNewMindmapContentC(fileName, notesPreferences); });
    };
    EditorPlugin.prototype.getNewMindmapContentC = function (fileName, notesPreferences) {
        var mindmapName = fileName || "new-mindmap";
        if (pmc_mail_1.utils.Lang.endsWith(mindmapName, ".smm")) {
            mindmapName = mindmapName.substring(0, mindmapName.length - 4);
        }
        if (pmc_mail_1.utils.Lang.endsWith(mindmapName, ".pmxmm")) {
            mindmapName = mindmapName.substring(0, mindmapName.length - 6);
        }
        var spec = {
            elements: [
                {
                    klass: "MindMapElement",
                    spec: {
                        label: mindmapName,
                        nodes: [
                            {
                                label: "first",
                                nodes: []
                            },
                            {
                                label: "second",
                                nodes: [
                                    {
                                        label: "second-first",
                                        nodes: []
                                    },
                                    {
                                        label: "second-second",
                                        nodes: []
                                    }
                                ]
                            }
                        ]
                    }
                }
            ],
            version: 1,
            style: undefined
        };
        if (notesPreferences && notesPreferences.style) {
            spec.style = { name: notesPreferences.style };
        }
        return Mail.privfs.lazyBuffer.Content.createFromJson(spec, "application/x-smm", mindmapName + ".pmxmm");
    };
    EditorPlugin.prototype.getNewTextNoteContent = function (fileName) {
        var _this = this;
        return this.getNotesPreferences().then(function (notesPreferences) { return _this.getNewTextNoteContentC(fileName, notesPreferences); });
    };
    EditorPlugin.prototype.getNewTextNoteContentC = function (fileName, notesPreferences) {
        var textNoteName = fileName || "new-note-file";
        if (pmc_mail_1.utils.Lang.endsWith(textNoteName, ".stt")) {
            textNoteName = textNoteName.substring(0, textNoteName.length - 4);
        }
        if (pmc_mail_1.utils.Lang.endsWith(textNoteName, ".pmxtt")) {
            textNoteName = textNoteName.substring(0, textNoteName.length - 6);
        }
        var spec = { content: "", style: undefined };
        if (notesPreferences && notesPreferences.style) {
            spec.style = { name: notesPreferences.style };
        }
        return Mail.privfs.lazyBuffer.Content.createFromJson(spec, "application/x-stt", textNoteName + ".pmxtt");
    };
    EditorPlugin.prototype.openTask = function (session, _sectionId, id) {
        var tasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksPlugin) {
            return;
        }
        tasksPlugin.openEditTaskWindow(session, id, true);
    };
    return EditorPlugin;
}());
exports.EditorPlugin = EditorPlugin;
MindmapElementSpec.prototype.className = "com.privmx.plugin.editor.main.MindmapElementSpec";
EditorPlugin.prototype.className = "com.privmx.plugin.editor.main.EditorPlugin";

//# sourceMappingURL=EditorPlugin.js.map
