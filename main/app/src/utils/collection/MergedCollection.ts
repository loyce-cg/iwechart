import {BaseCollection} from "./BaseCollection";
import {Event} from "../Event";
import {Lang} from "../Lang";
import {utils} from "../../Types";
import collection = utils.collection;
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.utils.collection.MergedCollection");

export class MergedCollection<T> extends BaseCollection<T> {
    
    collections: {
        length: number,
        collection: BaseCollection<T>,
        collectionChangeId: number;
        event: collection.CollectionEventsCallback<T>
    }[];
    
    constructor() {
        super();
        this.collections = [];
    }
    
    addCollection(collection: BaseCollection<T>): void {
        let list = collection.getEnumerable();
        let collectionIndex = this.collections.length;
        let event = this.onChangeEvents.bind(this, collectionIndex);
        this.collections.push({
            length: list.length,
            collection: collection,
            collectionChangeId: collection.changeId,
            event: event
        });
        collection.changeEvent.add(event, "multi");
        this.list = this.list.concat(list);
        let startIndex = this.getCollectionStartIndex(collectionIndex);
        this.changeEvent.hold();
        for (let i = 0; i < list.length; i++) {
            this.changeEvent.trigger({
                type: "add",
                changeId: ++this.changeId,
                index: startIndex + i,
                element: list[i]
            });
        }
        this.changeEvent.release();
    }
    
    removeCollection(collection: BaseCollection<T>): void {
        let index = Lang.indexOf(this.collections, x => {
            return x != null && x.collection == collection;
        });
        if (index == -1) {
            return;
        }
        let colEntry = this.collections[index];
        this.collections[index] = null;
        collection.changeEvent.remove(colEntry.event, "multi");
        let colList = collection.getEnumerable();
        this.changeEvent.hold();
        let i = 0;
        while (i < this.list.length) {
            let element = this.list[i];
            if (colList.indexOf(element) != -1) {
                this.list.splice(i, 1);
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: i,
                    element: element
                });
            }
            else {
                i++;
            }
        }
        this.changeEvent.release();
    }
    
    destroy(): void {
        this.collections.forEach(c => {
            if (c != null) {
                c.collection.changeEvent.remove(c.event);
            }
        });
        BaseCollection.prototype.destroy.call(this);
    }
    
    getCollectionStartIndex(collectionIndex: number): number {
        let index = 0;
        for (let i = 0; i < collectionIndex; i++) {
            if (this.collections[i] != null) {
                index += this.collections[i].length;
            }
        }
        return index;
    }
    
    onChangeEvents(collectionIndex: number, events: collection.CollectionEventArgs<T>[]): void {
        this.changeEvent.hold();
        Event.applyEvents(events, this.onChangeEvent.bind(this, collectionIndex));
        this.changeEvent.release();
    }
    
    onChangeEvent(collectionIndex: number, event: collection.CollectionEvent<T>) {
        if (event.changeId <= this.collections[collectionIndex].collectionChangeId) {
            return;
        }
        let startIndex = this.getCollectionStartIndex(collectionIndex);
        let index = startIndex + (event.index == null ? 0 : event.index);
        if (event.type == "add") {
            this.list.splice(index, 0, event.element);
            this.collections[collectionIndex].length++;
            this.changeEvent.trigger({
                type: "add",
                changeId: ++this.changeId,
                index: index,
                element: event.element
            });
        }
        else if (event.type == "remove") {
            this.list.splice(index, 1);
            this.collections[collectionIndex].length--;
            this.changeEvent.trigger({
                type: "remove",
                changeId: ++this.changeId,
                index: index,
                element: event.element
            });
        }
        else if (event.type == "clear") {
            let removed = this.list.splice(index, this.collections[collectionIndex].length);
            this.collections[collectionIndex].length = 0;
            for (let i = removed.length - 1; i >= 0; i--) {
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: index + i,
                    element: removed[i]
                });
            }
        }
        else if (event.type == "update") {
            this.list[index] = event.element;
            this.changeEvent.trigger({
                type: "update",
                changeId: ++this.changeId,
                index: index,
                element: event.element
            });
        }
        else if (event.type == "rebuild") {
            let removed = this.list.splice(index, this.collections[collectionIndex].length);
            for (let i = removed.length - 1; i >= 0; i--) {
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: index + i,
                    element: removed[i]
                });
            }
            let list = this.collections[collectionIndex].collection.getEnumerable();
            this.list.splice.apply(this.list, [].concat([index, 0], list));
            for (let i = 0; i < list.length; i++) {
                this.changeEvent.trigger({
                    type: "add",
                    changeId: ++this.changeId,
                    index: index + i,
                    element: list[i]
                });
            }
        }
        else {
            Logger.warn("Unknown event type: " + event.type);
        }
    }
}
