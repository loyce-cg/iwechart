import {component, Types, webUtils, window as wnd, JQuery as $} from "pmc-web";
import { func as sectionTemplate } from "./template/section.html";
import { BaseItemsPanelView } from "./BaseItemsPanelView";

export class SectionsPickerPanelView<SectionEntryModel> extends BaseItemsPanelView<SectionEntryModel> {
    items: component.extlist.ExtListView<SectionEntryModel>;
    $container: JQuery;
    
    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent, personsComponent);
    }

    public setupListOptionsBeforeInit(): void {
        this.listOptions = {
            template: sectionTemplate,
        }
    }

    protected onAfterInit(): void {

    }
}