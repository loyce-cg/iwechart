import {ComponentController} from "../base/ComponentController";
import {ExtListController} from "../extlist/ExtListController";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {Settings} from "../../utils/Settings";
import {utils} from "../../Types";
import {app} from "../../Types";
import {Inject, Dependencies} from "../../utils/Decorators";
import {ComponentFactory} from "../main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Column {
    index: number;
    type: string;
    min: number;
    value: number;
    $header?: JQuery;
    width?: number;
}

@Dependencies(["extlist"])
export class ExtTableController<T> extends ComponentController {
    
    static textsPrefix: string = "component.extTable.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject componentFactory: ComponentFactory;
    
    columns: utils.Column[];
    list: ExtListController<T>;
    model: Column[];
    
    constructor(parent: app.IpcContainer, columns: utils.Column[], collection: BaseCollection<T>) {
        super(parent);
        this.ipcMode = true;
        this.columns = columns;
        this.list = this.addComponent("list", this.componentFactory.createComponent("extlist", [this, collection]));
        this.list.ipcMode = true;
        this.model = this.calculateModel();
    }
    
    getModel(): Column[] {
        return this.model;
    }
    
    calculateModel(): Column[] {
        let columns: Column[] = [];
        this.columns.forEach((column, i) => {
            columns.push({
                index: i,
                type: column.type,
                min: column.min,
                value: column.type == "fixed" ? column.value : (<Settings>column.value).get("float")
            });
        });
        return columns;
    }
    
    onViewColumnValueChange(index: number, value: number): void {
        this.model[index].value = value;
        (<Settings>this.columns[index].value).set(value);
    }
}
