import { ComponentController } from "../base/main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n/index";
import * as Types from "../../Types";
import Q = require("q");
import { CustomSelectItem, CustomSelectOptions, CustomSelectSeparator, Model } from "./Types";
export * from "./Types";

export class CustomSelectController extends ComponentController {
    
    static textsPrefix: string = "component.customselect.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    value: string;
    options: CustomSelectOptions = { items: [] };
    items: Array<CustomSelectItem | CustomSelectSeparator> = [];
    
    constructor(parent: Types.app.IpcContainer, options: CustomSelectOptions) {
        super(parent);
        this.ipcMode = true;
        this.options = options;
        this.items = options.items;
    }
    
    init(): Q.Promise<any> {
        return Q.resolve();
    }
    
    setItems(items: Array<CustomSelectItem | CustomSelectSeparator>, suppressSelectionChangedEvent: boolean = false): void {
        this.items = items;
        this.callViewMethod("updateItems", JSON.stringify(items), suppressSelectionChangedEvent);
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
    
    onViewCallActionHandler(actionId: string): void {
        if (this.options.actionHandler) {
            this.options.actionHandler(actionId);
        }
    }
    
    grabFocus(highlightFirstItem: boolean = false) {
        this.callViewMethod("grabFocus", highlightFirstItem);
    }

}