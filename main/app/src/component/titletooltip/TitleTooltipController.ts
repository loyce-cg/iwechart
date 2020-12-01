import * as Types from "../../Types";
import { TooltipController } from "../tooltip/main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    fileId: string;
    filePath: string;
    fileName: string;
    isPrivateSection: boolean;
    sectionName: string;
}

export class TitleTooltipController extends TooltipController {
    
    static textsPrefix: string = "component.titleTooltip.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    isEnabled: () => boolean = () => true;
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
    onViewRequestContent(title: string): void {
        if (!this.isEnabled()) {
            return;
        }
        this.callViewMethod("setContent", title, title);
    }
    
}