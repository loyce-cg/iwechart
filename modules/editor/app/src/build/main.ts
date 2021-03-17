import * as Mail from "pmc-mail";
import {EditorPlugin} from "../main/EditorPlugin";
import {EditorWindowController} from "../window/editor/EditorWindowController";
import {SettingsNotesController} from "../window/settingsnotes/SettingsNotesController";
import {MindmapHelpWindowController} from "../window/mindmaphelp/MindmapHelpWindowController";

export class Plugin {
    
    register(_mail: typeof Mail, app: Mail.app.common.CommonApplication) {
        let editorPlugin = new EditorPlugin(app);
        
        // i18n: main
        editorPlugin.registerTexts(app.localeService);
        
        // i18n: components
        
        // i18n: windows
        EditorWindowController.registerTexts(app.localeService);
        SettingsNotesController.registerTexts(app.localeService);
        MindmapHelpWindowController.registerTexts(app.localeService);
        
        app.addComponent("editor-plugin", editorPlugin);
        
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.settings.SettingsWindowController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.settings.SettingsWindowController") {
                new SettingsNotesController(event.instance);
            }
        }, "editor", "ethernal");
        
        app.addEventListener<Mail.Types.event.OpenMindmapHelpEvent>("open-mindmap-help", event => {
            app.ioc.create(MindmapHelpWindowController, [app]).then(win => {
                app.openSingletonWindow("mindmap-help", win);
            });
        }, "editor", "ethernal");
        
        app.addEventListener("file-opened-external", () => {
            // TODO: lapanie okien zewnetrznych
        }, "editor", "ethernal")
        
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
            open: options => {
                let newFile: boolean = (<any>options).editorOptions && (<any>options).editorOptions.newFile ? (<any>options).editorOptions.newFile : false;
                return app.ioc.create(EditorWindowController, [options.parent, options.session, {
                    entry: options.element,
                    docked: options.docked,
                    editMode: options.action != Mail.app.common.shelltypes.ShellOpenAction.PREVIEW && options.action != Mail.app.common.shelltypes.ShellOpenAction.PRINT,
                    newFile: newFile,
                    preview: options.action == Mail.app.common.shelltypes.ShellOpenAction.PREVIEW,
                    action: options.action
                }]);
            }
        });
        
        app.shellRegistry.registerApplicationBinding({applicationId: "plugin.editor", mimeType: "text/*"});//, action: Mail.app.common.shelltypes.ShellOpenAction.PREVIEW});
        // app.shellRegistry.registerApplicationBinding({applicationId: "plugin.editor", mimeType: "application/x-smm"});
        // app.shellRegistry.registerApplicationBinding({applicationId: "plugin.editor", mimeType: "application/x-smm", action: Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL});
        app.shellRegistry.registerApplicationBinding({applicationId: "plugin.editor", mimeType: "application/x-stt"});
        app.shellRegistry.registerApplicationBinding({applicationId: "plugin.editor", mimeType: "application/x-stt", action: Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL});
        
        app.shellRegistry.registerAppAction({
            id: "plugin.editor.new-mindmap",
            type: Mail.app.common.shelltypes.ShellActionType.CREATE,
            labelKey: "plugin.editor.actions.newMindmap",
            icon: "fa privmx-icon privmx-icon-mindmap",
            defaultName: "new-mindmap",
            onCall: (filename?: string) => {
                return editorPlugin.getNewMindmapContent(filename);
            }
        });
        
        app.shellRegistry.registerAppAction({
            id: "plugin.editor.new-text-note",
            type: Mail.app.common.shelltypes.ShellActionType.CREATE,
            labelKey: "plugin.editor.actions.newNote",
            icon: "fa fa-font",
            defaultName: "new-note-file",
            onCall: (filename?: string) => {
                return editorPlugin.getNewTextNoteContent(filename);
            }
        });
        
        let askBeforeLogout = true;
        app.onLogoutCallback.push(() => {
            let dfm = EditorWindowController.DirtyWindowsModel;
            let data = dfm.get();
            if (askBeforeLogout && data && data.length) {
                let msgBox = new Mail.window.msgbox.MsgBoxWindowController(app, {
                    message: app.localeService.i18n("plugin.editor.app.logout.dirtyNotes.text"),
                    focusOn: "ok",
                    ok: {
                        visible: true,
                        btnClass: "btn-success",
                        label: app.localeService.i18n("plugin.editor.app.logout.dirtyNotes.button.ok.label")
                    },
                    cancel: {visible: true}
                });
                msgBox.open();
                msgBox.getPromise().then(data => {
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
        app.addEventListener<Mail.Types.event.AfterLogoutPlugin>("afterlogout", () => {
            editorPlugin.logout();
        }, "editor", "ethernal");
    }
}