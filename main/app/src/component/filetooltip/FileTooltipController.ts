import {ComponentController} from "../base/ComponentController";
import * as Types from "../../Types";
import { TooltipController } from "../tooltip/main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { SectionModel } from "../sectiontooltip/main";
import { Inject } from "../../utils/Decorators";
import { SectionManager } from "../../mail/section";

export interface Model {
    fileId: string;
    filePath: string;
    fileName: string;
    isPrivateSection: boolean;
    sectionName: string;
}

export class FileTooltipController extends TooltipController {
    
    static textsPrefix: string = "component.fileTooltip.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject sectionManager: SectionManager;
    
    isEnabled: () => boolean = () => true;
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
    onViewRequestContent(fileId: string): void {
        if (!this.isEnabled()) {
            return;
        }
        let idx = fileId.indexOf(":/");
        let sectionId = fileId.substr(0, idx);
        let section = this.sectionManager.getSection(sectionId);
        let path = fileId.substr(idx + 1);
        this.callViewMethod("setContent", fileId, JSON.stringify({
            fileId: fileId,
            filePath: path,
            fileName: fileId.substr(fileId.lastIndexOf("/") + 1),
            isPrivateSection: section ? section.isPrivate() : false,
            sectionName: section ? section.getFullSectionName() : "",
        }));
    }
    
}