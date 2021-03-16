import {component, Types, webUtils, window as wnd, JQuery as $} from "pmc-web";
import { func as sectionTemplate } from "./template/file-entry.html";
import { BaseItemsPanelView } from "./BaseItemsPanelView";
import { ViewTreeItem } from "../TreeItem";

export class FilesPickerPanelView<FileEntryModel> extends BaseItemsPanelView<FileEntryModel> {
    private static readonly DOUBLE_CLICK_TIME: number = 250;
    items: component.extlist.ExtListView<FileEntryModel>;
    $container: JQuery;
    lastClickTid: NodeJS.Timer;
    lastClickId: string;

    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent, personsComponent);
    }

    public setupListOptionsBeforeInit(): void {
        this.listOptions = {
            template: sectionTemplate,
        }
    }

    onDirectoryClick(event: MouseEvent): void {      
        event.stopPropagation();
        let element = ViewTreeItem.fromEvent(event);
        if (element.type != "directory") {
            return;
        }

        if (this.lastClickTid && this.lastClickId == element.id) {
            clearTimeout(this.lastClickTid);
            this.lastClickTid = null;
            this.lastClickId = null;
            this.triggerEvent("directoryClick", element.id, element.parentId);
        }
        else {
            this.lastClickId = element.id;
            this.lastClickTid = setTimeout(() => {
                this.lastClickTid = null;
                this.lastClickId = null;
                //Single click - do nothing, active already selected
            }, FilesPickerPanelView.DOUBLE_CLICK_TIME);
        }
    }

    onAddClick(event: MouseEvent): void {      
        event.stopPropagation();
        let element = ViewTreeItem.fromEvent(event);
        this.triggerEvent("addItemClick", element.id);
    }

    protected onAfterInit(): void {
        this.$container.on("click", ".file-entry[data-type='directory'] .file-name", this.onDirectoryClick.bind(this));
        this.$container.on("click", ".file-entry .add-remove-btn", this.onAddClick.bind(this));
    }
}