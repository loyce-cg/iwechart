import {window,mail} from "pmc-mail";
import {EditorPlugin, NotesPreferences} from "../../main/EditorPlugin";
import {i18n} from "./i18n/index";

export interface Model {
    notes: NotesPreferences;
}

export class SettingsNotesController extends window.settings.BaseController {
    
    static textsPrefix: string = "plugin.editor.window.settings.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    editorPlugin: EditorPlugin;
    
    constructor(windowController: window.settings.SettingsWindowController) {
        super(windowController);
        this.ipcMode = true;
        this.editorPlugin = this.app.getComponent("editor-plugin");
        this.parent.registerTab({id: "plugin-editor", tab: this});
        this.parent.addViewScript({path: "build/view.js", plugin: "editor"});
        this.parent.addViewStyle({path: "window/settingsnotes/template/main.css", plugin: "editor"});
    }
    
    prepare(): Q.Promise<void> {
        return this.editorPlugin.getNotesPreferences().then(notes => {
            let model: Model = {
                notes: notes
            };
            this.callViewMethod("renderContent", model);
        });
    }
}
