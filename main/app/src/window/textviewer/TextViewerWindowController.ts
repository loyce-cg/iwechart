import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import * as Q from "q";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    title: string;
    text: string;
}

export interface TextViewerWindowOptions {
    title: string;
    text: string;
}

export class TextViewerWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.textviewer.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    protected options: TextViewerWindowOptions;
    
    constructor(parent: app.WindowParent, options: TextViewerWindowOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.options = options;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 600;
        this.openWindowOptions.height = 400;
        this.openWindowOptions.title = this.options.title;
        this.openWindowOptions.icon = "fa fa-align-justify";
        this.openWindowOptions.resizable = true;
    }
    
    init() {
        return Q().then(() => {
        });
    }
    
    getModel(): Model {
        return {
            title: this.options.title,
            text: this.options.text,
        };
    }
    
    onViewClose(): void {
        this.close();
    }
    
}
