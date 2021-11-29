"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var EditorPlugin_1 = require("../main/EditorPlugin");
var EditorWindowController_1 = require("../window/editor/EditorWindowController");
var SettingsNotesController_1 = require("../window/settingsnotes/SettingsNotesController");
var MindmapHelpWindowController_1 = require("../window/mindmaphelp/MindmapHelpWindowController");
var Plugin = (function () {
    function Plugin() {
    }
    Plugin.prototype.register = function (_mail, app) {
        var editorPlugin = new EditorPlugin_1.EditorPlugin(app);
        editorPlugin.registerTexts(app.localeService);
        EditorWindowController_1.EditorWindowController.registerTexts(app.localeService);
        SettingsNotesController_1.SettingsNotesController.registerTexts(app.localeService);
        MindmapHelpWindowController_1.MindmapHelpWindowController.registerTexts(app.localeService);
        app.addComponent("editor-plugin", editorPlugin);
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.settings.SettingsWindowController") {
                new SettingsNotesController_1.SettingsNotesController(event.instance);
            }
        }, "editor", "ethernal");
        app.addEventListener("open-mindmap-help", function (event) {
            app.ioc.create(MindmapHelpWindowController_1.MindmapHelpWindowController, [app]).then(function (win) {
                app.openSingletonWindow("mindmap-help", win);
            });
        }, "editor", "ethernal");
        app.addEventListener("file-opened-external", function () {
        }, "editor", "ethernal");
        Mail.mail.filetree.MimeType.add(".stx", "application/x-stt");
        Mail.mail.filetree.MimeType.add(".stt", "application/x-stt");
        Mail.mail.filetree.MimeType.add(".pmxtt", "application/x-stt");
        Mail.mail.filetree.MimeType.add(".smm", "application/x-smm");
        Mail.mail.filetree.MimeType.add(".pmxmm", "application/x-smm");
        Mail.mail.filetree.MimeType.add(".pmxvv", "video/x-svv");
        Mail.mail.filetree.MimeType.add(".pmxaa", "audio/x-saa");
        Mail.mail.filetree.MimeType.add(".sss", "application/x-sss");
        Mail.mail.filetree.Path.hiddenExts.push(".stx");
        Mail.mail.filetree.Path.hiddenExts.push(".sss");
        Mail.mail.filetree.Path.hiddenExts.push(".smm");
        Mail.mail.filetree.Path.hiddenExts.push(".stt");
        Mail.mail.filetree.Path.hiddenExts.push(".pmxmm");
        Mail.mail.filetree.Path.hiddenExts.push(".pmxtt");
        Mail.mail.filetree.Path.hiddenExts.push(".pmxvv");
        Mail.mail.filetree.Path.hiddenExts.push(".pmxaa");
        app.shellRegistry.registerMimetypeIcon("application/x-stt", "fa fa-font");
        app.shellRegistry.registerMimetypeIcon("application/x-smm", "privmx-icon privmx-icon-mindmap");
        app.shellRegistry.registerMimetypeIcon("video/x-svv", "fa fa-file-video-o");
        app.shellRegistry.registerMimetypeIcon("audio/x-saa", "fa fa-file-audio-o");
        app.shellRegistry.registerMimetypeIcon("application/x-sss", "fa fa-table");
        app.shellRegistry.registerAppEx({
            id: "plugin.editor",
            open: function (options) {
                var newFile = options.editorOptions && options.editorOptions.newFile ? options.editorOptions.newFile : false;
                return app.ioc.create(EditorWindowController_1.EditorWindowController, [options.parent, options.session, {
                        entry: options.element,
                        docked: options.docked,
                        editMode: options.action != Mail.app.common.shelltypes.ShellOpenAction.PREVIEW && options.action != Mail.app.common.shelltypes.ShellOpenAction.PRINT,
                        newFile: newFile,
                        preview: options.action == Mail.app.common.shelltypes.ShellOpenAction.PREVIEW,
                        action: options.action
                    }]);
            }
        });
        app.shellRegistry.registerApplicationBinding({ applicationId: "plugin.editor", mimeType: "text/*" });
        app.shellRegistry.registerApplicationBinding({ applicationId: "plugin.editor", mimeType: "application/x-stt" });
        app.shellRegistry.registerApplicationBinding({ applicationId: "plugin.editor", mimeType: "application/x-stt", action: Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL });
        app.shellRegistry.registerAppAction({
            id: "plugin.editor.new-mindmap",
            type: Mail.app.common.shelltypes.ShellActionType.CREATE,
            labelKey: "plugin.editor.actions.newMindmap",
            icon: "fa privmx-icon privmx-icon-mindmap",
            defaultName: "new-mindmap",
            onCall: function (filename) {
                return editorPlugin.getNewMindmapContent(filename);
            }
        });
        app.shellRegistry.registerAppAction({
            id: "plugin.editor.new-text-note",
            type: Mail.app.common.shelltypes.ShellActionType.CREATE,
            labelKey: "plugin.editor.actions.newNote",
            icon: "fa fa-font",
            defaultName: "new-note-file",
            onCall: function (filename) {
                return editorPlugin.getNewTextNoteContent(filename);
            }
        });
        var askBeforeLogout = true;
        app.onLogoutCallback.push(function () {
            var dfm = EditorWindowController_1.EditorWindowController.DirtyWindowsModel;
            var data = dfm.get();
            if (askBeforeLogout && data && data.length) {
                var msgBox = new Mail.window.msgbox.MsgBoxWindowController(app, {
                    message: app.localeService.i18n("plugin.editor.app.logout.dirtyNotes.text"),
                    focusOn: "ok",
                    ok: {
                        visible: true,
                        btnClass: "btn-success",
                        label: app.localeService.i18n("plugin.editor.app.logout.dirtyNotes.button.ok.label")
                    },
                    cancel: { visible: true }
                });
                msgBox.open();
                msgBox.getPromise().then(function (data) {
                    if (data.result == "ok") {
                        askBeforeLogout = false;
                        app.logout();
                        askBeforeLogout = true;
                    }
                });
                return true;
            }
            return false;
        });
        app.addEventListener("afterlogout", function () {
            editorPlugin.logout();
        }, "editor", "ethernal");
    };
    return Plugin;
}());
exports.Plugin = Plugin;
Plugin.prototype.className = "com.privmx.plugin.editor.build.Plugin";

//# sourceMappingURL=main.js.map
