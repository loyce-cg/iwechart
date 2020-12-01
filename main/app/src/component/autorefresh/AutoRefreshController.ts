import {ComponentController} from "../base/ComponentController";
import {WithActiveCollection} from "../../utils/collection/WithActiveCollection";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {Model} from "../../utils/Model";
import {app} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export type ModelType<T> = T|WithActiveCollection<T>|Model<T>|BaseCollection<any>;

export interface Options<T, U> {
    model?: ModelType<T>;
    isRaw?: boolean;
    isActiveCollection?: boolean;
    isCollectionSize?: boolean;
    context?: U;
}

export class AutoRefreshController<T, U = void> extends ComponentController {
    
    static textsPrefix: string = "component.autoRefresh.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    model: ModelType<T>;
    isRaw: boolean;
    isActiveCollection: boolean;
    isCollectionSize: boolean;
    context: U;
    
    constructor(parent: app.IpcContainer, options: Options<T, U>) {
        super(parent);
        this.model = options.model;
        this.isRaw = options.isRaw;
        this.isActiveCollection = options.isActiveCollection;
        this.isCollectionSize = options.isCollectionSize;
        this.context = options.context;
        if (this.model && "changeEvent" in <any>this.model) {
            this.registerChangeEvent((<any>this.model).changeEvent, this.onChange, "multi");
        }
    }
    
    getModel(): T {
        if (this.isRaw) {
            return <T>this.model;
        }
        else if (this.isCollectionSize) {
            return <T><any>(<BaseCollection<any>>this.model).size();
        }
        else if (this.isActiveCollection) {
            return (<WithActiveCollection<T>>this.model).getActive();
        }
        return (<Model<T>>this.model).get();
    }
    
    onChange(): void {
        this.callViewMethod("render", JSON.stringify(this.getModel()));
    }
}
