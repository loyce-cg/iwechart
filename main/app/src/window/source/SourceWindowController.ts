import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import {SinkIndexEntry} from "../../mail/SinkIndexEntry";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    source: string;
}

export class SourceWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.source.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    message: SinkIndexEntry;
    
    constructor(parent: app.WindowParent, message: SinkIndexEntry) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.message = message;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 800;
        this.openWindowOptions.height = 565;
        this.openWindowOptions.title = this.i18n("window.source.title", [this.message.id]);
        this.openWindowOptions.icon = "icon ico-source";
    }
    
    getModel(): Model {
        return {
            source: JSON.stringify(this.message.source, null, 2)
        };
    }
}
