import {component, Types, webUtils, window as wnd, JQuery as $} from "pmc-web";
import { func as template } from "./template/choosen-file.html";
import { BaseItemsPanelView } from "./BaseItemsPanelView";
import { ViewTreeItem } from "../TreeItem";

export class FilesToImportPanelView<FileEntryModel> extends BaseItemsPanelView<FileEntryModel> {
    items: component.extlist.ExtListView<FileEntryModel>;
    $container: JQuery;
    
    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent, personsComponent, );
    }

    public setupListOptionsBeforeInit(): void {
        this.listOptions = {
            template: template,
        }
    }

    onRemoveClick(event: MouseEvent): void {     
        event.stopPropagation();
        let element = ViewTreeItem.fromEvent(event);
        this.triggerEvent("removeItemClick", element.id);
    }

    protected onAfterInit(): void {
        this.$container.on("click", ".file-entry .add-remove-btn", this.onRemoveClick.bind(this));

    }

}