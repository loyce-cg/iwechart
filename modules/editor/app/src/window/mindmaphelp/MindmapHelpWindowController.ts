import {window, Types, mail} from "pmc-mail";
import {i18n} from "./i18n/index";

export class MindmapHelpWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.editor.window.mindmapHelp.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parentWindow: Types.app.WindowParent) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.setPluginViewAssets("editor");
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 600;
        this.openWindowOptions.height = 365;
        this.openWindowOptions.resizable = true;
        this.openWindowOptions.title = this.i18n("plugin.editor.window.mindmapHelp.title");
    }
}
