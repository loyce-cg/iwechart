import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class UpdateWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.update.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            modal: true,
            position: "center",
            width: 1000,
            height: 520,
            minWidth: 600,
            minHeight: 450,
            icon: "icon fa fa-update",
            title: this.i18n("window.update.title")
        };
    }
}

