import {BaseCollection} from "./BaseCollection";
import {Event} from "../Event";
import {utils} from "../../Types";
import collection = utils.collection;
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.utils.collection.TakeCollection");

export class TakeCollection<T> extends BaseCollection<T> {
    
    collection: BaseCollection<T>;
    collectionChangeId: number;
    bindedEvents: (events: collection.CollectionEventArgs<T>[]) => void;
    bindedOnChangeEvent: (event: collection.CollectionEvent<T>) => void;
    toLoad: number;
    startIndex: number;
    
    constructor(collection: BaseCollection<T>|false, toLoad: number) {
        super();
        this.toLoad = toLoad;
        this.bindedOnChangeEvent = this.onChangeEvent.bind(this);
        if (collection !== false) {
            this.setCollectionSafe(collection);
        }
    }
    
    setCollectionSafe(collection: BaseCollection<T>): void {
        if (collection == null) {
            this.setEmptyCollection();
        }
        else {
            this.setCollection(collection);
        }
    }
    
    setEmptyCollection(): void {
        this.setCollection(new BaseCollection<T>());
    }
    
    setCollection(collection: BaseCollection<T>): void {
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
        this.startIndex = Math.max(0, this.collection.size() - this.toLoad);
        let orgList = this.collection.getEnumerable();
        this.list = orgList.slice(this.startIndex);
        this.changeEvent.trigger({type: "rebuild", changeId: ++this.changeId});
    }
    
    onChangeEvents(events: collection.CollectionEventArgs<T>[]): void {
        this.changeEvent.hold();
        Event.applyEvents(events, this.bindedOnChangeEvent);
        this.changeEvent.release();
    }
    
    onChangeEvent(event: collection.CollectionEvent<T>): void {
        if (event.changeId <= this.collectionChangeId) {
            return;
        }
        if (event.type == "add") {
            if (event.index < this.startIndex) {
                this.startIndex++;
                return;
            }
            let index = event.index - this.startIndex;
            this.list.splice(index, 0, event.element);
            this.changeEvent.trigger({
                type: "add",
                changeId: ++this.changeId,
                index: index,
                element: event.element
            });
            return;
        }
        else if (event.type == "remove") {
            if (event.index < this.startIndex) {
                this.startIndex--;
                return;
            }
            let index = event.index - this.startIndex;
            this.list.splice(index, 1);
            this.changeEvent.trigger({
                type: "remove",
                changeId: ++this.changeId,
                index: index,
                element: event.element
            });
            return;
        }
        else if (event.type == "clear") {
            this.list = [];
            this.changeEvent.trigger({
                type: "clear",
                changeId: ++this.changeId
            });
            return;
        }
        else if (event.type == "reorganize") {
            this.rebuild();
            return;
        }
        else if (event.type == "move") {
            if (event.oldIndex < this.startIndex && event.newIndex < this.startIndex) {
                return;
            }
            if (event.oldIndex < this.startIndex) {
                let index = event.index - this.startIndex;
                this.list.splice(index, 0, event.element);
                this.changeEvent.trigger({
                    type: "add",
                    changeId: ++this.changeId,
                    index: index,
                    element: event.element
                });
                return;
            }
            if (event.newIndex < this.startIndex) {
                let index = event.index - this.startIndex;
                this.list.splice(index, 1);
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: index,
                    element: event.element
                });
                return;
            }
            let oldIndex = event.oldIndex - this.startIndex;
            let newIndex = event.newIndex - this.startIndex;
            this.list.splice(oldIndex, 1);
            this.list.splice(newIndex, 0, event.element);
            this.changeEvent.trigger({
                type: "move",
                changeId: ++this.changeId,
                oldIndex: oldIndex,
                newIndex: newIndex,
                element: event.element
            });
            return;
        }
        else if (event.type == "rebuild") {
            this.rebuild();
            return;
        }
        else if (event.type == "update") {
            if (event.index < this.startIndex) {
                return;
            }
            let index = event.index - this.startIndex;
            this.list[index] = event.element;
            this.changeEvent.trigger({
                type: "update",
                changeId: ++this.changeId,
                index: index,
                element: event.element
            });
            return;
        }
        else if (event.type == "active") {
            if ((event.oldActive == null || event.oldActive.index < this.startIndex) && (event.newActive == null || event.newActive.index < this.startIndex)) {
                return;
            }
            this.changeEvent.trigger({
                type: "active",
                changeId: ++this.changeId,
                oldActive: event.oldActive && event.oldActive.index >= this.startIndex ? {
                    index: event.oldActive.index - this.startIndex,
                    obj: event.oldActive.obj
                } : null,
                newActive: event.newActive && event.newActive.index >= this.startIndex ? {
                    index: event.newActive.index - this.startIndex,
                    obj: event.newActive.obj
                } : null,
                causeType: event.type
            });
            return;
        }
        else {
            Logger.warn("Unknown event type: " + event.type);
        }
    }
    
    getActiveIndex(): number {
        return this.collection && (<any>this.collection).getActiveIndex ? Math.max(-1, (<any>this.collection).getActiveIndex() - this.startIndex) : -1;
    }
    
    isActive(e: T): boolean {
        return this.list[this.getActiveIndex()] == e;
    }
    
    increaseToLoad(value: number): void {
        this.toLoad = Math.max(0, this.toLoad + value);
        if (value < 0) {
            let removed = this.list.splice(0, -value);
            for (let i = 0; i < removed.length; i++) {
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: 0,
                    element: removed[i]
                });
            }
            this.startIndex -= value;
        }
        else {
            value = value > this.startIndex ? this.startIndex : value;
            if (value == 0) {
                return;
            }
            let params: any[] = new Array(value + 2);
            let toAdd: T[] = new Array(value);
            params[0] = 0;
            params[1] = 0;
            for (let i = 0; i < value; i++) {
                params[i + 2] = this.collection.list[this.startIndex - value + i];
                toAdd[i] = this.collection.list[this.startIndex - i - 1];
            }
            this.list.splice.apply(this.list, params);
            this.startIndex -= value;
            for (let i = 0; i < toAdd.length; i++) {
                this.changeEvent.trigger({
                    type: "add",
                    changeId: ++this.changeId,
                    index: 0,
                    element: toAdd[i]
                });
            }
        }
    }
}