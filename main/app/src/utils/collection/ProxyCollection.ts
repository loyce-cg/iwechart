import {BaseCollection} from "./BaseCollection";
import {Event} from "../Event";
import {utils} from "../../Types";
import collection = utils.collection;
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.utils.collection.ProxyCollection");

export class ProxyCollection<T, U = T> extends BaseCollection<T> {
    
    collection: BaseCollection<U>;
    collectionChangeId: number;
    bindedEvents: (events: collection.CollectionEventArgs<U>[]) => void;
    bindedOnChangeEvent: (event: collection.CollectionEvent<U>) => void;
    
    constructor (collection?: BaseCollection<U>|false) {
        super();
        this.bindedOnChangeEvent = this.onChangeEvent.bind(this);
        if (collection !== false) {
            this.setCollectionSafe(collection);
        }
    }
    
    setCollectionSafe(collection: BaseCollection<U>): void {
        if (collection == null) {
            this.setEmptyCollection();
        }
        else {
            this.setCollection(collection);
        }
    }
    
    setEmptyCollection(): void {
        this.setCollection(new BaseCollection<U>());
    }
    
    setCollection(collection: BaseCollection<U>): void {
        this.unbind();
        this.collection = collection;
        this.collectionChangeId = collection.changeId;
        this.bindedEvents = this.onChangeEvents.bind(this);
        this.collection.changeEvent.add(this.bindedEvents, "multi");
        this.rebuild();
    }
    
    unbind(): void {
        if (this.bindedEvents != null) {
            this.collection.changeEvent.remove(this.bindedEvents, "multi");
        }
    }
    
    destroy(): void {
        this.unbind();
        super.destroy();
    }
    
    rebuild(): void {
        let orgList = this.collection.getEnumerable();
        this.list = new Array(orgList.length);
        for (let i = 0; i < orgList.length; i++) {
            this.list[i] = this.convert(orgList[i], i, this)
        }
        this.changeEvent.trigger({type: "rebuild", changeId: ++this.changeId});
    }
    
    onChangeEvents(events: collection.CollectionEventArgs<U>[]): void {
        this.changeEvent.hold();
        Event.applyEvents(events, this.bindedOnChangeEvent);
        this.changeEvent.release();
    }
    
    convert(org: U, _index: number, _collection: ProxyCollection<T, U>): T {
        return <any>org;
    }
    
    onChangeEvent(event: collection.CollectionEvent<U>): void {
        if (event.changeId <= this.collectionChangeId) {
            return;
        }
        if (event.type == "add") {
            this.list.splice(event.index, 0, null);
            let newEle = this.convert(event.element, event.index, this);
            this.list[event.index] = newEle;
            this.changeEvent.trigger({
                type: "add",
                changeId: ++this.changeId,
                index: event.index,
                element: newEle
            });
        }
        else if (event.type == "remove") {
            let removed = this.list.splice(event.index, 1)[0];
            this.changeEvent.trigger({
                type: "remove",
                changeId: ++this.changeId,
                index: event.index,
                element: removed
            });
        }
        else if (event.type == "clear") {
            this.list = [];
            this.changeEvent.trigger({
                type: "clear",
                changeId: ++this.changeId
            });
        }
        else if (event.type == "reorganize") {
            let oldList = this.list;
            this.list = [];
            for (let i = 0; i < event.indicies.length; i++) {
                this.list[i] = oldList[event.indicies[i]];
            }
            this.changeEvent.trigger({
                type: "reorganize",
                changeId: ++this.changeId,
                indicies: event.indicies
            });
        }
        else if (event.type == "move") {
            let ele = this.list.splice(event.oldIndex, 1)[0];
            this.list.splice(event.newIndex, 0, ele);
            this.changeEvent.trigger({
                type: "move",
                changeId: ++this.changeId,
                oldIndex: event.oldIndex,
                newIndex: event.newIndex,
                element: ele
            });
        }
        else if (event.type == "rebuild") {
            this.rebuild();
            return;
        }
        else if (event.type == "update") {
            this.list[event.index] = null;
            let ele = this.convert(event.element, event.index, this);
            this.list[event.index] = ele;
            this.changeEvent.trigger({
                type: "update",
                changeId: ++this.changeId,
                index: event.index,
                element: ele
            });
        }
        else if (event.type == "active") {
            this.changeEvent.trigger({
                type: "active",
                changeId: ++this.changeId,
                oldActive: event.oldActive ? {
                    index: event.oldActive.index,
                    obj: this.list[event.oldActive.index]
                } : null,
                newActive: event.newActive ? {
                    index: event.newActive.index,
                    obj: this.list[event.newActive.index]
                } : null,
                causeType: event.type
            });
        }
        else if (event.type == "selection") {
            this.changeEvent.trigger({
                type: "selection",
                changeId: ++this.changeId,
                index: event.index,
                indicies: event.indicies,
                causeType: event.type,
            });
        }
        else {
            Logger.warn("Unknown event type: " + event.type);
        }
    }
    
    getActiveIndex(): number {
        return this.collection && (<any>this.collection).getActiveIndex ? (<any>this.collection).getActiveIndex() : -1;
    }
    
    isActive(e: T): boolean {
        return this.list[this.getActiveIndex()] == e;
    }
    
    triggerBaseUpdateElement(element: U): void {
        let idx = this.collection.indexOf(element);
        if (idx != -1) {
            this.triggerBaseUpdateAt(idx);
        }
    }
    
    triggerBaseUpdateAt(index: number): void {
        if (index >= 0 && index < this.list.length) {
            this.onChangeEvent({
                type: "update",
                changeId: this.collectionChangeId + 1,
                index: index,
                element: this.collection.get(index)
            });
        }
    }
}