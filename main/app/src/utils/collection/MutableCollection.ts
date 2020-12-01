import {BaseCollection} from "./BaseCollection";
import {Lang} from "../Lang";

export class MutableCollection<T> extends BaseCollection<T> {
    
    constructor(list?: T[]) {
        super(list);
        this.changeId = 0;
    }
    
    add(element: T): void {
        this.addAt(this.list.length, element);
    }
    
    addAt(index: number, element: T): void {
        Lang.addAt(this.list, index, element);
        this.changeEvent.trigger({
            type: "add",
            changeId: ++this.changeId,
            index: index,
            element: element
        });
    }
    
    addAll(elements: T[]): void {
        this.addAllAt(this.list.length, elements);
    }
    
    addAllAt(index: number, elements: T[]): void {
        let args: any[] = [index, 0];
        for (let i = 0; i < elements.length; i++) {
            args.push(elements[i]);
        }
        this.list.splice.apply(this.list, args);
        let changeId = this.changeId + 1;
        this.changeId += elements.length;
        for (let i = 0; i < elements.length; i++) {
            this.changeEvent.trigger({
                type: "add",
                changeId: changeId + i,
                index: index + i,
                element: elements[i]
            });
        }
    }
    
    remove(element: T): void {
        for (let i = 0; i < this.list.length; i++) {
            if (this.list[i] == element) {
                this.list.splice(i, 1);
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: i,
                    element: element
                });
            }
        }
    }
    
    removeAt(index: number): void {
        let removed = this.list.splice(index, 1);
        this.changeEvent.trigger({
            type: "remove",
            changeId: ++this.changeId,
            index: index,
            element: removed[0]
        });
    }
    
    removeBy(propertyName: string, value: any): void {
        let i = 0;
        while (i < this.list.length) {
            if ((<any>this.list[i])[propertyName] == value) {
                let removed = this.list.splice(i, 1);
                this.changeEvent.trigger({
                    type: "remove",
                    changeId: ++this.changeId,
                    index: i,
                    element: removed[0]
                });
            }
            else {
                i++;
            }
        }
    }
    
    clear(): void {
        this.list = [];
        this.changeEvent.trigger({type: "clear", changeId: ++this.changeId});
    }
    
    rebuild(list: T[]): void {
        this.list = [].concat(list);
        this.changeEvent.trigger({type: "rebuild", changeId: ++this.changeId});
    }
    
    setAt(index: number, element: T): void {
        if (index < this.list.length) {
            this.list[index] = element;
            this.changeEvent.trigger({
                type: "update",
                changeId: ++this.changeId,
                index: index,
                element: element
            });
        }
        else {
            this.list[index] = element;
            this.changeEvent.trigger({
                type: "add",
                changeId: ++this.changeId,
                index: index,
                element: element
            });
        }
    }
    
    updateElement(element: T): void {
        let idx = this.indexOf(element);
        if (idx != -1) {
            this.updateAt(idx);
        }
    }
    
    replaceElement(oldElement: T, newElement: T): void {
        let idx = this.indexOf(oldElement);
        if (idx != -1) {
            this.list[idx] = newElement;
            this.updateAt(idx);
        }
    }
    
    updateAt(index: number): void {
        if (index >= 0 && index < this.list.length) {
            this.changeEvent.trigger({
                type: "update",
                changeId: ++this.changeId,
                index: index,
                element: this.list[index]
            });
        }
    }
    
    updateBy(propertyName: string, propertyValue: any, changes: {[name: string]: any}): void {
        for (let i = 0; i < this.list.length; i++) {
            let element = <any>this.list[i];
            if (element[propertyName] == propertyValue) {
                for (var key in changes) {
                    element[key] = changes[key];
                }
                this.changeEvent.trigger({
                    type: "update",
                    changeId: ++this.changeId,
                    index: i,
                    element: element
                });
            }
        }
    }
    
    move(element: T, index: number): number {
        let idx = this.list.indexOf(element);
        if (idx == -1) {
            return;
        }
        this.list.splice(idx, 1);
        if (this.list.length < index) {
            this.list.length = index;
        }
        this.list.splice(index, 0, element);
        this.changeEvent.trigger({
            type: "move",
            changeId: ++this.changeId,
            oldIndex: idx,
            newIndex: index
        });
    }
}
