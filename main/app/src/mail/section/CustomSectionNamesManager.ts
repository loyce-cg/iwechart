import { UserPreferences } from "../UserPreferences";
import { Conv2Section, Conv2Service } from ".";
import { SectionService } from "./SectionService";
import { MailConst } from "..";
import Q = require("q");

export class CustomSectionNamesManager {
    
    conv2Service: Conv2Service;
    
    constructor(public userPreferences: UserPreferences) {
    }
    
    getCustomSectionNames(): { [key: string]: string } {
        return this.userPreferences.getCustomSectionNames();
    }
    
    getCustomSectionName(section: Conv2Section|SectionService): string {
        let conv2Section = this.resolveConv2Section(section);
        if (conv2Section != null) {
            let customName = this.userPreferences.getCustomSectionNames()[conv2Section.id];
            return customName;
        }
        return null;
    }
    
    setCustomSectionName(section: Conv2Section|SectionService, newName: string = null): Q.Promise<void> {
        let conv2Section = this.resolveConv2Section(section);
        if (conv2Section != null) {
            let names = this.userPreferences.getCustomSectionNames();
            if (newName) {
                names[conv2Section.id] = newName;
            }
            else if (conv2Section.id in names) {
                delete names[conv2Section.id];
            }
            return this.userPreferences.set(MailConst.CUSTOM_SECTION_NAMES, names, true);
        }
        return Q();
    }
    
    resolveConv2Section(section: Conv2Section|SectionService): Conv2Section {
        let conv2Section: Conv2Section = null;
        if (section instanceof SectionService) {
            if (section.isUserGroup() && this.conv2Service) {
                conv2Section = this.conv2Service.collection.find(x => x.section && x.section.getId() == section.getId());
            }
        }
        else if (section instanceof Conv2Section) {
            conv2Section = section;
        }
        return conv2Section;
    }
    
}
