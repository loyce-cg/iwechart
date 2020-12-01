import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    name: string;
    size: number;
}

export class DownloadAttachmentWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.downloadAttachment.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parent: app.WindowParent, public model: Model) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 500;
        this.openWindowOptions.height = 230;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.minimizable = true;
        this.openWindowOptions.title = this.i18n("window.downloadAttachment.title", [this.model.name]);
    }
    
    getModel(): Model {
        return this.model;
    }
    
    setDownloadProgress(percent: number): void {
        this.callViewMethod("setDownloadProgress", percent);
    }
    
    onNwinClose(): void {
    }
}
