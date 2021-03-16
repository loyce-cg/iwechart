import { BaseItemsPanelController } from "./BaseItemsPanelController";
import { utils, window, component, mail } from "pmc-mail";
import { SectionEntry, SectionEntryModel } from "./Types";

class EntryFromSectionService implements SectionEntry {
    name: string;
    id: string;
    breadcrumbs: string;
    root: boolean;
    visible: boolean;
    enabled: boolean;
    scope: string;
    descripion: string;
    primary: boolean;
    constructor(section: mail.section.SectionService) {
        this.name = section.getName();
        this.id = section.getId();
        this.breadcrumbs = "";
        this.root = section.isRoot();
        this.visible = section.isVisible();
        this.enabled = section.isValid();
        this.scope = section.getScope();
        this.descripion = section.getDescription();
        this.primary = section.isPrimary();
    }
    getName(): string {
        return this.name;
    }    
    getId(): string {
        return this.id;
    }
    isRoot(): boolean {
        return this.root;
    }
    isVisible(): boolean {
        return this.visible;
    }
    getBreadcrumb(): string {
        return this.breadcrumbs;
    }
    getScope(): string {
        return this.scope;
    }
    isEnabled(): boolean {
        return this.enabled;
    }
    getDescription(): string {
        return this.descripion;
    }
    isPrimary(): boolean {
        return this.primary;
    }
}

export class SectionsPickerPanelController extends BaseItemsPanelController<SectionEntry, SectionEntryModel> {
    entriesCollection: utils.collection.TransformCollection<SectionEntry, mail.section.SectionService>;
    
    constructor (
        parent: window.base.BaseWindowController, 
        public personsComponent: component.persons.PersonsController, 
        public sourceCollection: utils.collection.BaseCollection<mail.section.SectionService>) {
        
        super(parent, personsComponent);

        this.entriesCollection = this.addComponent("transformCollection-" + this.constructor.name, new utils.collection.TransformCollection<SectionEntry, mail.section.SectionService>(this.sourceCollection, this.convertSectionServiceToSectionEntry.bind(this)));
        super.addBaseCollection(this.entriesCollection);
    }
    
    protected filterEntry(entry: SectionEntry): boolean {
        return true;
    }    
    
    protected convertEntry(entry: SectionEntry): SectionEntryModel {
        return {
            name: entry.getName(),
            id: entry.getId(),
            isRoot: entry.isRoot(),
            breadcrumb: entry.getBreadcrumb(),
            visible: entry.isVisible(),
            scope: entry.getScope(),
            enabled: entry.isEnabled(),
            description: entry.getDescription(),
            primary: entry.isPrimary()
        }
    }
    
    protected sortEntry(a: SectionEntryModel, b: SectionEntryModel): number {
        return 0;
    }

    private convertSectionServiceToSectionEntry(entry: mail.section.SectionService): SectionEntry {
        return new EntryFromSectionService(entry);
    }

    protected onActiveCollectionChange(event: any): void {
        
    }
}