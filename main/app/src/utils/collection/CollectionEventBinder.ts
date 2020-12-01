import {BaseCollection} from "./BaseCollection";
import {utils} from "../../Types";

export interface Bindable<T> {
    
    onAdd(element: T): void;
    onRemove(element: T): void;
    onUpdate(element: T): void;
}

export class CollectionEventBinder<T> {
    
    constructor(
        public collection: BaseCollection<T>,
        public bindable: Bindable<T>,
        public callback: (event: utils.collection.CollectionEvent<T>) => void
    ) {
    }
    
    static bindWithCollection<T>(collection: BaseCollection<T>, bindable: Bindable<T>) {
        collection.forEach(x => {
            bindable.onAdd(x);
        });
        let callback = (event: utils.collection.CollectionEvent<T>) => {
            if (event.type == "add") {
                bindable.onAdd(event.element);
            }
            else if (event.type == "remove") {
                bindable.onRemove(event.element);
            }
            else if (event.type == "update") {
                bindable.onUpdate(event.element);
            }
        };
        collection.changeEvent.add(callback);
        return new CollectionEventBinder(collection, bindable, callback);
    }
    
    detach() {
        this.collection.changeEvent.remove(this.callback);
    }
}