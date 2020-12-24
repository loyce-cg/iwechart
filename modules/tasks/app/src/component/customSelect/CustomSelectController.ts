import { Q, component, mail, Types } from "pmc-mail";
import app = Types.app;
import { i18n } from "./i18n/index";

export class CustomSelectOptions {
    multi?: boolean;
    editable?: boolean;
    firstItemIsStandalone?: boolean;
    noSelectionText?: string;
    noSelectionPersonCanvas?: boolean;
    noSelectionValue?: string;
    collapseCanvases?: boolean;
    scrollToFirstSelected?: boolean;
    gridColsCount?: number;
    taskGroupCreator?: () => void;
    headerText?: string;
}

export interface CustomSelectItem {
    val: string;
    text: string;
    icon: string; // @fa-* | @asset-* | @json-* | src (of img) | null
    selected: boolean;
    extraClass?: string;
    extraStyle?: string;
    extraArg?: any;
    isTaskGroupCreator?: boolean;
    textNoEscape?: boolean;
    extraAttributes?: { [key: string]: string };
}

export interface Model {
    itemsStr: string;
    optionsStr: string;
    headerText: string;
}

export interface ItemModel {
    item: CustomSelectItem;
    multi: boolean;
    extraClass?: string;
    extraStyle?: string;
    textNoEscape?: boolean;
}

export class CustomSelectController extends component.base.ComponentController {
    
    static textsPrefix: string = "plugin.tasks.component.customSelect.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    value: string;
    options: CustomSelectOptions = {};
    
    constructor(parent: app.IpcContainer, public items: Array<CustomSelectItem>, options: CustomSelectOptions) {
        super(parent);
        this.ipcMode = true;
        this.options = options;
    }
    
    init(): Q.Promise<any> {
        return Q.resolve();
    }
    
    setItems(items: Array<CustomSelectItem>): void {
        this.items = items;
        this.callViewMethod("updateItems", JSON.stringify(items));
    }
    
    setEditable(editable: boolean) {
        this.options.editable = editable;
        this.callViewMethod("updateEditable", editable);
    }
    
    getModel(): Model {
        return {
            itemsStr: JSON.stringify(this.items),
            optionsStr: JSON.stringify(this.options),
            headerText: this.options.headerText,
        };
    }
    
    onViewValueChanged(newVal: string) {
        this.value = newVal;
    }
    
    onViewCreateTaskGroupRequest(): void {
        if (this.options.taskGroupCreator) {
            this.options.taskGroupCreator();
        }
    }
    
    grabFocus(highlightFirstItem: boolean = false) {
        this.callViewMethod("grabFocus", highlightFirstItem);
    }

}