import {ProxyCollection} from "./ProxyCollection";
import {BaseCollection} from "./BaseCollection";
import {Event} from "../Event";
import {utils} from "../../Types";
import collection = utils.collection;

export class WithMultiActiveCollection<T> extends ProxyCollection<T> {
    
    active: collection.Entry<T>;
    selectedIndexes: number[] = [];
    
    constructor(collection?: BaseCollection<T>) {
        super(collection);
    }
    
    updateSelectedIndexes(event: collection.CollectionEvent<T>) {
        if (event.type == "add") {
            if (this.selectedIndexes.length > 0) {
                this.selectedIndexes.forEach( (selIndex, id, data) => {
                    if (selIndex >= event.index) {
                      data[id]++;
                    }
                });

            }
            this.changeEvent.trigger({
                type: "selection",
                changeId: ++this.changeId,
                causeType: event.type,
                indicies: this.selectedIndexes
            });
            
        }
        else
        if (event.type == "remove") {
            if (this.selectedIndexes.length > 0) {
                let toRemove = this.selectedIndexes.indexOf(event.index);
                if (toRemove > -1) {
                    this.selectedIndexes.splice(toRemove, 1);
                }

                this.selectedIndexes.forEach( (selIndex, id, data) => {
                    if (selIndex > event.index) {
                      data[id]--;
                    }
                });
                
                this.changeEvent.trigger({
                    type: "selection",
                    changeId: ++this.changeId,
                    indicies: this.selectedIndexes,
                    causeType: event.type
                });
            }
        }
        else
        if (event.type == "move") {
            let selectedIndexPos = this.selectedIndexes.indexOf(event.oldIndex);
            if (selectedIndexPos > -1) {
                this.selectedIndexes[selectedIndexPos] = event.newIndex;
                this.changeEvent.trigger({
                    type: "selection",
                    changeId: ++this.changeId,
                    indicies: this.selectedIndexes,
                    causeType: event.type
                });
            }
        }
        else
        if (event.type == "clear") {
            let toRemove = this.selectedIndexes.indexOf(event.oldIndex);
            if (toRemove > -1) {
                this.selectedIndexes.splice(toRemove, 1);
                this.changeEvent.trigger({
                    type: "selection",
                    changeId: ++this.changeId,
                    index: event.oldIndex,
                    causeType: event.type
                });
            }
        }
                
    }
    
    onChangeEvent(event: collection.CollectionEvent<T>): void {
        if (event.changeId <= this.collectionChangeId) {
            return;
        }
        if (this.active != null) {
            if (event.type == "add") {
                if (event.index <= this.active.index) {
                    this.active.index++;
                }
            }
            else if (event.type == "remove") {
                if (event.index == this.active.index) {
                    let oldActive = this.active;
                    this.active = null;
                    this.changeEvent.trigger({
                        type: "active",
                        changeId: ++this.changeId,
                        oldActive: oldActive,
                        newActive: this.active,
                        causeType: event.type
                    });
                }
                else if (event.index < this.active.index) {
                    this.active.index--;
                }
                
            }
            else if (event.type == "update") {
                if (event.index == this.active.index) {
                    this.active.obj = event.element;
                }
            }
            else if (event.type == "clear") {
                let oldActive = this.active;
                this.active = null;
                this.changeEvent.trigger({
                    type: "active",
                    changeId: ++this.changeId,
                    oldActive: oldActive,
                    newActive: this.active,
                    causeType: event.type
                });
            }
            else if (event.type == "reorganize") {
                this.active.index = event.indicies.indexOf(this.active.index);
            }
            else if (event.type == "move") {
                if (event.oldIndex == this.active.index) {
                    this.active.index = event.newIndex;
                }
                else if (event.newIndex <= this.active.index && this.active.index < event.oldIndex) {
                    this.active.index++;
                }
                else if (event.oldIndex < this.active.index && this.active.index < event.newIndex) {
                    this.active.index--;
                }
            }
            else if (event.type == "rebuild") {
                let oldActive = this.active;
                this.active = null;
                this.changeEvent.trigger({
                    type: "active",
                    changeId: ++this.changeId,
                    oldActive: oldActive,
                    newActive: this.active,
                    causeType: event.type
                });
            }
        }
        super.onChangeEvent(event);
        this.updateSelectedIndexes(event);
    }
    
    
    
    getActive(): T {
        return this.active == null ? null : this.active.obj;
    }
    
    getSelectedIndexes(): number[] {
        return this.selectedIndexes;
    }
    
    clearSelected(): void {
        if (this.selectedIndexes) {
            this.selectedIndexes.forEach( item => {
                this.changeEvent.trigger({
                    type: "selection",
                    changeId: ++this.changeId,
                    index: item,
                    causeType: "clear"
                });
            })
        }
    }
    
    deselect(selected: T): void {
        let index = this.indexOf(selected);
        let foundSelected = this.selectedIndexes.indexOf(index);
        if (foundSelected == -1) {
            return;
        }
        this.selectedIndexes.splice(foundSelected, 1);
        this.changeEvent.trigger({
            type: "selection",
            changeId: ++this.changeId,
            index: index,
            causeType: "clear"
        });
    }
    
    setActive(newActive: T): void {
        if ((this.active == null && newActive == null) || (this.active != null && this.active.obj == newActive)) {
            return;
        }
        let oldActive = this.active;
        let index = this.indexOf(newActive);
        this.active = index == -1 ? null : {
            index: index,
            obj: newActive
        };
        this.changeEvent.trigger({
            type: "active",
            changeId: ++this.changeId,
            oldActive: oldActive,
            newActive: this.active
        });
    }
    
    setSelected(newSelected: T): void {
        let index = this.indexOf(newSelected);
        let foundSelected = this.selectedIndexes.indexOf(index);
        if (foundSelected > -1) {
            // deselect
            this.deselect(newSelected);
            return;
        }
        this.selectedIndexes.push(index);
        this.changeEvent.trigger({
            type: "selection",
            changeId: ++this.changeId,
            index: index,
            causeType: "selected"
        });

    }
    
    
    isActive(element: T): boolean {
        return this.active != null && this.active.obj == element;
    }
    
    isSelected(index: number) {
        return this.selectedIndexes.indexOf(index) > -1;
    }
    
    getActiveIndex(): number {
        return this.active ? this.active.index : -1;
    }
}
