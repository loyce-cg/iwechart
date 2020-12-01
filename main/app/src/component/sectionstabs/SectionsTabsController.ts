import {ComponentController} from "../base/ComponentController";
import * as Types from "../../Types";
import {SectionService} from "../../mail/section/SectionService";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    tabs: SectionTab[];
}

export interface Options {
    onSelectTab: (sectionId: Types.section.SectionId) => void;
    getBadge?: (sectionId: Types.section.SectionId) => number;
}

export interface SectionTab {
    name: string;
    active?: boolean;
    id: string;
    badge?: number;
}

export class SectionsTabsController extends ComponentController {
    
    static textsPrefix: string = "component.sectionsTabs.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    descantsInfo: Types.section.DescantsInfo;
    
    constructor(parent: Types.app.IpcContainer, public options: Options) {
        super(parent);
        this.ipcMode = true;
    }
    
    getModel(): Model {
        return {
            tabs: this.descantsInfo ? this.descantsInfo.descants.map(section => this.convertSection(section)) : []
        };
    }
    
    convertSection(section: SectionService): SectionTab {
        let model: SectionTab = {
            name: section.getName(),
            
            id: section.getId(),
            active: this.descantsInfo ? section == this.descantsInfo.active : false,
            badge: this.options.getBadge ? this.options.getBadge(section.getId()) : null
        };
        return model;
    }
    
    onViewSelectTab(id: string): void {
        if (this.options.onSelectTab) {
            this.options.onSelectTab(id);
        }
    }
    
    setState(descantsInfo: Types.section.DescantsInfo): void {
        this.descantsInfo = descantsInfo;
        this.callViewMethod("render", this.getModel());
    }
    
    hide(): void {
        this.callViewMethod("setTabsVisible", false);
    }
    
    refreshTab(section: SectionService): void {
        let model = this.convertSection(section);
        this.callViewMethod("refreshTab", model);
    }
}

