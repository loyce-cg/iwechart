import {ProxyCollection} from "./ProxyCollection";
import {BaseCollection} from "./BaseCollection";
import {Event} from "../Event";
import {utils} from "../../Types";
import collection = utils.collection;

export class WithActiveCollection<T> extends ProxyCollection<T> {
    
    active: collection.Entry<T>;
    
    constructor(collection?: BaseCollection<T>) {
        super(collection);
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
                else if (event.oldIndex < this.active.index && this.active.index <= event.newIndex) {
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
    }
    
    getActive(): T {
        return this.active == null ? null : this.active.obj;
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
    
    isActive(element: T): boolean {
        return this.active != null && this.active.obj == element;
    }
    
    getActiveIndex(): number {
        return this.active ? this.active.index : -1;
    }
}
