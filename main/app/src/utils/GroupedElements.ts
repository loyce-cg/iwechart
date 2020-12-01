import {Lang} from "./Lang";

export interface GroupedElement {
    id?: string;
    priority: number;
    groupId: string;
}

export interface Group<T extends GroupedElement> {
    id: string;
    priority: number;
    elements: T[];
}

export class GroupedElements<T extends GroupedElement> {
    
    static PRIORITY_SORTER = (a: {priority: number}, b: {priority: number}) => a.priority - b.priority;
    
    groups: Group<T>[];
    elements: {[id: string]: T};
    idIndex: number;
    
    constructor() {
        this.groups = [];
        this.elements = {};
        this.idIndex = 0;
    }
    
    addGroup(id: string, priority: number): boolean {
        if (this.getGroup(id) != null) {
            return false;
        }
        let group: Group<T> = {
            id: id,
            priority: priority,
            elements: []
        };
        Lang.insertSort(this.groups, group, GroupedElements.PRIORITY_SORTER);
        return true;
    }
    
    getGroup(id: string) {
        return Lang.find(this.groups, x => x.id == id);
    }
    
    getElements(): T[] {
        return Lang.getValues(this.elements);
    }
    
    getElement(id: string): T {
        return this.elements[id];
    }
    
    addElement(element: T): void {
        if (!element.id) {
            element.id = "ele-" + this.idIndex++;
        }
        if (element.id in this.elements) {
            throw new Error("Element with id '" + element.id + "' already exist");
        }
        let group = this.getGroup(element.groupId);
        if (group == null) {
            throw new Error("Group '" + element.groupId + "' does not exist");
        }
        Lang.insertSort(group.elements, element, GroupedElements.PRIORITY_SORTER);
        this.elements[element.id] = element;
    }
    
    removeElement(id: string): T {
        if (!(id in this.elements)) {
            return null;
        }
        let element = this.elements[id];
        let group = this.getGroup(element.groupId);
        Lang.removeFromList(group.elements, element);
        delete this.elements[id];
        return element;
    }
}