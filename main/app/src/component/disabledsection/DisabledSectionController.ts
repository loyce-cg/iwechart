import * as Types from "../../Types";
import * as Q from "q";
import {Inject} from "../../utils/Decorators";
import { WindowComponentController } from "../../window/base/WindowComponentController";
import { BaseWindowController } from "../../window/base/BaseWindowController";
import { SectionService } from "../../mail/section/SectionService";
import { UserPreferences } from "../../mail/UserPreferences";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    sectionName: string;
    moduleName: string;
    editable: boolean;
}

export interface ReopenSectionEvent extends Types.event.Event<boolean> {
    type: "reopen-section";
    element: SectionService;
}

export class DisabledSectionController extends WindowComponentController<BaseWindowController> {
    
    static textsPrefix: string = "component.disabledsection.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    @Inject userPreferences: UserPreferences;
    convMap: {[name: string]: string} = {["notes2"]: "file", ["chat"]: "chat", ["tasks"]: "kvdb", ["calendar"]: "calendar"};
    section: SectionService;
    editable: boolean;
    
    constructor(parent: BaseWindowController, public moduleName: string) {
        super(parent);
        this.ipcMode = true;
    }
        
    init() {
        
    }
    
    setSection(section: SectionService): void {
        this.section = section;
        this.editable = this.section.isEditableByMe();
        this.callViewMethod("updateModel", this.getModel());
    }
    
    activateModule(): void {
        if (! this.section.isModuleEnabled(this.convMap[this.moduleName])) {
            this.section.updateEx((decrypted) => {
                let changed = decrypted;
                changed.data.modules[this.convMap[this.moduleName]].enabled = true;
                return changed;
            })
            .then(() => {
                this.app.dispatchEvent<ReopenSectionEvent>({
                    type: "reopen-section",
                    element: this.section
                });
                return;
            })
            .fail(e => this.errorCallback);
        }
    }
    
    onViewAction(action: string): void {
        if (action == "activate") {
            this.activateModule();
        }
    }
    
    onViewHideAllSections(value: boolean): void {
        Q().then(() => {
            this.userPreferences.set("ui.showAllSections", !value, true)
            .fail(this.errorCallback);
        })
    }
    
    getModel(): Model {
        return {
            sectionName: this.section ? this.section.getName() : null,
            moduleName: this.moduleName,
            editable: this.editable
        }
    }
}
