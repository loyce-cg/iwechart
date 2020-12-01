import {ComponentController} from "../base/ComponentController";
import {Event} from "../../utils/Event";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {utils} from "../../Types";
import {app} from "../../Types";
import * as RootLogger from "simplito-logger";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
let Logger = RootLogger.get("privfs-mail-client.component.extlist.ExtListController");

export interface Model<T> {
    activeIndex: number;
    list: T[];
}

export class ExtListController<T> extends ComponentController {
    
    static textsPrefix: string = "component.extList.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    collection: BaseCollection<T>;
    onCollectionChangeBinded: utils.collection.CollectionEventCallback<T>;
    collectionWithActive: {getActiveIndex(): number, isActive(e: T): boolean};
    isFrozen: boolean = false;
    frozenEvents: utils.collection.CollectionEvent<T>[] = [];
    
    constructor(parent: app.IpcContainer, collection: BaseCollection<T>) {
        super(parent);
        this.ipcMode = true;
        this.collection = collection;
        this.collectionWithActive = (<any>collection).getActiveIndex && (<any>collection).isActive ? <any>collection : null;
        this.onCollectionChangeBinded = this.onCollectionChange.bind(this);
        this.registerChangeEvent(this.collection.changeEvent, this.onCollectionChanges, "multi");
    }
    
    getModel(): Model<T> {
        return {
            activeIndex: this.collectionWithActive ? this.collectionWithActive.getActiveIndex() : -1,
            list: this.collection.list
        };
    }
    
    freeze(): void {
        if (this.isFrozen) {
            return;
        }
        this.isFrozen = true;
        this.frozenEvents = [];
    }
    
    unfreeze(): void {
        if (!this.isFrozen) {
            return;
        }
        this.isFrozen = false;
        for (let event of this.frozenEvents) {
            this.onCollectionChange(event);
        }
        this.frozenEvents = [];
    }
    
    onCollectionChanges(events: utils.collection.CollectionEventArgs<T>[]): void {
        Event.applyEvents(events, this.onCollectionChangeBinded);
    }
    
    onCollectionChange(event: utils.collection.CollectionEvent<T>) {
        if (this.isFrozen) {
            this.frozenEvents.push(event);
            return;
        }
        if (event.type == "selection") {
            if (event.causeType == "add") {
                this.callViewMethod("updateSelected", event.indicies);
            }
            else if (event.causeType == "remove") {
                this.callViewMethod("updateSelected", event.indicies);
            }
            else if (event.causeType == "move") {
                this.callViewMethod("updateSelected", event.indicies);
            }
            else if (event.causeType == "clear") {
                this.callViewMethod("deselect", event.index, event.indicies);
            }
            else if (event.causeType == "selected") {
                this.callViewMethod("select", event.index, event.indicies);
            }
            
            return;
        }
        if (event.type == "add") {
            this.callViewMethod("add", event.index, this.collectionWithActive ? this.collectionWithActive.isActive(event.element) : false, event.element);
        }
        else if (event.type == "remove") {
            this.callViewMethod("remove", event.index, event.element);
        }
        else if (event.type == "update") {
            this.callViewMethod("update", event.index, this.collectionWithActive ? this.collectionWithActive.isActive(event.element) : false, event.element);
        }
        else if (event.type == "clear") {
            this.callViewMethod("clear");
        }
        else if (event.type == "active") {
            this.callViewMethod("active", event.oldActive, event.newActive);
        }
        else if (event.type == "reorganize") {
            this.callViewMethod("reorganize", event.indicies);
        }
        else if (event.type == "move") {
            this.callViewMethod("move", event.oldIndex, event.newIndex);
        }
        else if (event.type == "rebuild") {
            this.callViewMethod("render", this.getModel());
        }
        else {
            Logger.error("ExtListController unknown event type: " + (event == null ? '' : event.type), event);
        }
    }
}

