import {Event} from "../Event";
import {utils} from "../../Types";
import collection = utils.collection;

export class BaseCollection<T> {
    
    list: T[];
    changeEvent: Event<collection.CollectionEvent<T>, any, any>;
    changeId: number;
    
    constructor (list?: T[]) {
        this.list = list ? [].concat(list) : [];
        this.changeEvent = new Event<collection.CollectionEvent<T>, any, any>();
        this.changeId = 0;
    }
    
    get(index: number): T {
        return this.list[index];
    }
    
    getFirst(): T {
        return this.list.length > 0 ? this.list[0] : null;
    }
    
    getLast(): T {
        return this.list.length > 0 ? this.list[this.list.length - 1] : null;
    }
    
    getBy(propertyName: string, value: any): T {
        for (let i = 0; i < this.list.length; i++) {
            if ((<any>this.list[i])[propertyName] == value) {
                return this.list[i];
            }
        }
        return null;
    }
    
    getAllBy(propertyName: string, value: any): T[] {
        let result: T[] = [];
        for (let i = 0; i < this.list.length; i++) {
            if ((<any>this.list[i])[propertyName] == value) {
                result.push(this.list[i]);
            }
        }
        return result;
    }
    
    find(func: (v: T, i: number) => boolean): T {
        for (let i = 0; i < this.list.length; i++) {
            if (func(this.list[i], i)) {
                return this.list[i];
            }
        }
        return null;
    }
    
    findAll(func: (v: T, i: number) => boolean): T[] {
        let results: T[] = [];
        for (let i = 0; i < this.list.length; i++) {
            if (func(this.list[i], i)) {
                results.push(this.list[i]);
            }
        }
        return results;
    }
    
    countBy(propertyName: string, value: any): number {
        return this.getAllBy(propertyName, value).length;
    }
    
    indexOf(element: T): number {
        return this.list.indexOf(element);
    }
    
    indexOfBy(func: (v: T, i: number) => boolean): number {
        for (let i = 0; i < this.list.length; i++) {
            if (func(this.list[i], i)) {
                return i;
            }
        }
        return -1;
    }
    
    contains(element: T): boolean {
        return this.list.indexOf(element) != -1;
    }
    
    getEnumerable(): T[] {
        return this.list;
    }
    
    forEach(func: (v: T, i: number) => void): void {
        this.list.forEach((element, index) => {
            return func(element, index);
        });
    }
    
    size(): number {
        return this.list.length;
    }
    
    isEmpty(): boolean {
        return this.list.length == 0;
    }
    
    getListCopy(): T[] {
        return this.list.slice(0, this.list.length);
    }
    
    reductEvents(): void {
        let events = this.changeEvent.lockedEvents;
        if (events.length <= 1) {
            return;
        }
        let tmp: {created: boolean, event: collection.CollectionEventArgs<T>}[] = [];
        let newList: [collection.CollectionEvent<T>, any, any][] = [];
        for (let i = 0; i < events.length; i++) {
            let eventArgs = events[i];
            let event = eventArgs[0];
            if (event.type == "add") {
                if (tmp.length < event.index) {
                    tmp.length = event.index;
                }
                tmp.splice(event.index, 0, {
                    created: true,
                    event: eventArgs
                });
            }
            else if (event.type == "remove") {
                if (event.index < tmp.length) {
                    let removed = tmp.splice(event.index, 1);
                    if (removed[0] && !removed[0].created) {
                        let index = newList.indexOf(removed[0].event);
                        if (index != -1) {
                            newList.splice(index, 1);
                        }
                    }
                }
            }
            else if (event.type == "update") {
                if (tmp[event.index]) {
                    continue;
                }
                else {
                    tmp[event.index] = {
                        created: false,
                        event: eventArgs
                    };
                }
            }
            else if (event.type == "clear") {
                newList = [];
                tmp = [];
            }
            else if (event.type == "reorganize") {
                let oldList = tmp;
                tmp = [];
                for (let i = 0; i < event.indicies.length; i++) {
                    tmp[i] = oldList[event.indicies[i]];
                }
            }
            else if (event.type == "move") {
                if (tmp.length < event.oldIndex) {
                    tmp.length = event.oldIndex;
                }
                if (tmp.length < event.newIndex) {
                    tmp.length = event.newIndex;
                }
                let removed = tmp.splice(event.oldIndex, 1);
                tmp.splice(event.newIndex, 0, removed[0]);
            }
            else if (event.type == "rebuild") {
                newList = [];
                tmp = [];
            }
            newList.push(eventArgs);
        }
        this.changeEvent.lockedEvents = newList;
    }
    
    destroy(): void {
        this.changeEvent.clear();
    }
    
    triggerUpdateElement(element: T): void {
        let idx = this.indexOf(element);
        if (idx != -1) {
            this.triggerUpdateAt(idx);
        }
    }
    
    triggerUpdateAt(index: number): void {
        if (index >= 0 && index < this.list.length) {
            this.changeEvent.trigger({
                type: "update",
                changeId: ++this.changeId,
                index: index,
                element: this.list[index]
            });
        }
    }
}
