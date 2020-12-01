import {ProxyCollection} from "./ProxyCollection";
import {BaseCollection} from "./BaseCollection";
import {utils} from "../../Types";
import collection = utils.collection;
import {Lang} from "../Lang";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.utils.collection.FilteredCollection");

export class FilteredCollection<T> extends ProxyCollection<T> {
    
    filter: (v: T) => boolean;
    indexMap: number[];
    
    constructor(collection: BaseCollection<T>, filter: (v: T) => boolean) {
        super(false);
        this.filter = filter;
        this.setCollectionSafe(collection);
    }
    
    rebuild(): void {
        let source = this.collection.getEnumerable();
        this.list = [];
        this.indexMap = [];
        for (let i = 0; i < source.length; i++) {
            if (this.filter(source[i])) {
                this.indexMap[i] = this.list.length;
                this.list.push(source[i]);
            }
            else {
                this.indexMap[i] = null;
            }
        }
        this.changeEvent.trigger({type: "rebuild", changeId: ++this.changeId});
    }
    
    getInsertIndex(eventIndex: number): number {
        let index = null;
        for (let i = eventIndex; i < this.indexMap.length; i++) {
            if (this.indexMap[i] != null) {
                if (index == null) {
                    index = this.indexMap[i];
                }
                this.indexMap[i]++;
            }
        }
        if (index == null) {
            for (let i = eventIndex; i >= 0; i--) {
                if (this.indexMap[i] != null) {
                    index = this.indexMap[i] + 1;
                    break;
                }
            }
        }
        if (index == null) {
            index = 0;
        }
        return index;
    }
    
    onChangeEvent(event: collection.CollectionEvent<T>): void {
        if (event.changeId <= this.collectionChangeId) {
            return;
        }
        if (event.type == "add") {
            if (this.filter(event.element)) {
                let index = this.getInsertIndex(event.index);
                Lang.addAt(this.indexMap, event.index, index);
                Lang.addAt(this.list, index, event.element);
                this.changeEvent.trigger({
                    type: "add",
                    changeId: ++this.changeId,
                    index: index,
                    element: event.element
                });
            }
            else {
                Lang.addAt(this.indexMap, event.index, null);
            }
        }
        else if (event.type == "remove") {
            let index = this.indexMap[event.index];
            if (index == null) {
                this.indexMap.splice(event.index, 1);
            }
            else {
                this.list.splice(index, 1);
                this.indexMap.splice(event.index, 1);
                for (let i = event.index; i < this.indexMap.length; i++) {
                    if (this.indexMap[i] != null) {
                        this.indexMap[i]--;
                    }
                }
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: index,
                    element: event.element
                });
            }
        }
        else if (event.type == "update") {
            let present = this.indexMap[event.index] != null;
            let filtered = !!this.filter(event.element);
            if (present == filtered) {
                if (present) {
                    this.list[this.indexMap[event.index]] = event.element;
                    this.changeEvent.trigger({
                        type: "update",
                        changeId: ++this.changeId,
                        index: this.indexMap[event.index],
                        element: event.element
                    });
                }
            }
            else {
                if (filtered) {
                    let index = this.getInsertIndex(event.index);
                    this.indexMap[event.index] = index;
                    Lang.addAt(this.list, index, event.element);
                    this.changeEvent.trigger({
                        type: "add",
                        changeId: ++this.changeId,
                        index: index,
                        element: event.element
                    });
                }
                else {
                    let index = this.indexMap[event.index];
                    let res = this.list.splice(index, 1);
                    this.indexMap[event.index] = null;
                    for (let i = event.index; i < this.indexMap.length; i++) {
                        if (this.indexMap[i] != null) {
                            this.indexMap[i]--;
                        }
                    }
                    this.changeEvent.trigger({
                        type: "remove",
                        changeId: ++this.changeId,
                        index: index,
                        element: res[0]
                    });
                }
            }
        }
        else if (event.type == "clear") {
            this.list = [];
            this.indexMap = [];
            this.changeEvent.trigger({
                type: "clear",
                changeId: ++this.changeId
            });
        }
        else if (event.type == "reorganize") {
            let oldList = this.list;
            let oldMap = this.indexMap;
            let indicies = [];
            this.list = [];
            this.indexMap = [];
            for (let i = 0; i < event.indicies.length; i++) {
                let oldIndex = oldMap[event.indicies[i]];
                if (oldIndex == null) {
                    this.indexMap[i] = null;
                }
                else {
                    this.indexMap[i] = this.list.length;
                    indicies.push(oldIndex);
                    this.list.push(oldList[oldIndex]);
                }
            }
            this.changeEvent.trigger({
                type: "reorganize",
                changeId: ++this.changeId,
                indicies: indicies
            });
        }
        else if (event.type == "move") {
            let index = this.indexMap[event.oldIndex];
            if (index == null) {
                this.indexMap.splice(event.oldIndex, 1);
                Lang.addAt(this.indexMap, event.newIndex, null);
            }
            else {
                this.indexMap.splice(event.oldIndex, 1);
                Lang.addAt(this.indexMap, event.newIndex, 1);
                let ii = 0;
                for (let i = 0; i < this.indexMap.length; i++) {
                    if (this.indexMap[i] != null) {
                        this.indexMap[i] = ii;
                        ii++;
                    }
                }
                let newIndex = this.indexMap[event.newIndex];
                this.list.splice(index, 1);
                Lang.addAt(this.list, newIndex, event.element);
                this.changeEvent.trigger({
                    type: "move",
                    changeId: ++this.changeId,
                    oldIndex: index,
                    newIndex: newIndex,
                    element: event.element
                });
            }
        }
        else if (event.type == "rebuild") {
            this.rebuild();
        }
        else if (event.type == "active") {
            this.changeEvent.trigger({
                type: "active",
                changeId: ++this.changeId,
                oldActive: event.oldActive && this.indexMap[event.oldActive.index] != null ? {
                    index: this.indexMap[event.oldActive.index],
                    obj: event.oldActive.obj
                } : null,
                newActive: event.newActive && this.indexMap[event.newActive.index] != null ? {
                    index: this.indexMap[event.newActive.index],
                    obj: event.newActive.obj
                } : null,
                causeType: event.type
            });
        }
        else {
            Logger.warn("Unknown event type: " + event.type);
        }
    }
    
    setFilter(filter: (v: T) => boolean): void {
        this.filter = filter;
        this.refresh();
    }
    
    refresh(): void {
        this.changeEvent.hold();
        let source = this.collection.getEnumerable();
        this.list = [];
        for (let i = 0; i < source.length; i++) {
            let element = source[i];
            let present = this.indexMap[i] != null;
            let index = this.list.length;
            if (this.filter(element)) {
                this.indexMap[i] = index;
                this.list.push(element);
                if (!present) {
                    this.changeEvent.trigger({
                        type: "add",
                        changeId: ++this.changeId,
                        index: index,
                        element: element
                    });
                }
            }
            else {
                this.indexMap[i] = null;
                if (present) {
                    this.changeEvent.trigger({
                        type: "remove",
                        changeId: ++this.changeId,
                        index: index,
                        element: element
                    });
                }
            }
        }
        this.changeEvent.release();
    }
    
    getActiveIndex(): number {
        if (this.collection && (<any>this.collection).getActiveIndex) {
            let index = this.indexMap[(<any>this.collection).getActiveIndex()];
            return index == null ? -1 : index;
        }
        return -1;
    }
}
