import {ProxyCollection} from "./ProxyCollection";
import {BaseCollection} from "./BaseCollection";
import {utils} from "../../Types";
import collection = utils.collection;
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.utils.collection.SortedCollection");

export class SortedCollection<T> extends ProxyCollection<T> {
    
    sorter: utils.Comparator<T>;
    indexMap: number[] = [];
    
    constructor(collection: BaseCollection<T>, sorter: utils.Comparator<T>) {
        super(false);
        this.sorter = sorter;
        this.setCollectionSafe(collection);
    }
    
    rebuild(): void {
        let source = this.collection.getEnumerable();
        let tmp: number[] = [];
        for (let i = 0; i < source.length; i++) {
            tmp[i] = i;
        }
        tmp.sort((a, b) => {
            return this.sorter(source[a], source[b]);
        });
        this.list = [];
        this.indexMap = [];
        for (let i = 0; i < tmp.length; i++) {
            this.list[i] = source[tmp[i]];
            this.indexMap[tmp[i]] = i;
        }
        this.changeEvent.trigger({type: "rebuild", changeId: ++this.changeId});
    }
    
    onChangeEvent(event: collection.CollectionEvent<T>): void {
        if (event.changeId <= this.collectionChangeId) {
            return;
        }
        if (event.type == "add") {
            let index = this.list.length;
            for (let i = 0; i < this.list.length; i++) {
                if (this.sorter(event.element, this.list[i]) < 0) {
                    index = i;
                    break;
                }
            }
            this.list.splice(index, 0, event.element);
            for (let i = 0; i < this.indexMap.length; i++) {
                if (this.indexMap[i] >= index) {
                    this.indexMap[i]++;
                }
            }
            this.indexMap.splice(event.index, 0, index);
            this.changeEvent.trigger({
                type: "add",
                changeId: ++this.changeId,
                index: index,
                element: event.element
            });
        }
        else if (event.type == "remove") {
            let index = this.indexMap[event.index];
            this.list.splice(index, 1);
            this.indexMap.splice(event.index, 1);
            for (let i = 0; i < this.indexMap.length; i++) {
                if (this.indexMap[i] > index) {
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
        else if (event.type == "update") {
            let index = this.indexMap[event.index];
            let newIndex = index;
            this.list[index] = event.element;
            if ((index > 0 && this.sorter(this.list[index - 1], this.list[index]) > 0) || (index < this.list.length - 1 && this.sorter(this.list[index], this.list[index + 1]) > 0)) {
                this.list.splice(index, 1);
                this.indexMap.splice(event.index, 1);
                for (let i = 0; i < this.indexMap.length; i++) {
                    if (this.indexMap[i] > index) {
                        this.indexMap[i]--;
                    }
                }
                newIndex = this.list.length;
                for (let i = 0; i < this.list.length; i++) {
                    if (this.sorter(event.element, this.list[i]) < 0) {
                        newIndex = i;
                        break;
                    }
                }
                this.list.splice(newIndex, 0, event.element);
                for (let i = 0; i < this.indexMap.length; i++) {
                    if (this.indexMap[i] >= newIndex) {
                        this.indexMap[i]++;
                    }
                }
                this.indexMap.splice(event.index, 0, newIndex);
                this.changeEvent.trigger({
                    type: "move",
                    changeId: ++this.changeId,
                    oldIndex: index,
                    newIndex: newIndex,
                    element: event.element
                });
            }
            this.changeEvent.trigger({
                type: "update",
                changeId: ++this.changeId,
                index: newIndex,
                element: event.element
            });
        }
        else if (event.type == "clear") {
            this.list = [];
            this.indexMap = [];
            this.changeEvent.trigger({
                type: "clear",
                changeId: ++this.changeId
            });
        }
        else if (event.type == "rebuild") {
            this.rebuild();
        }
        else {
            Logger.warn("Unknown event type: " + event.type);
        }
    }
    
    setSorter(sorter: utils.Comparator<T>): void {
        this.sorter = sorter;
        this.refresh();
    }
    
    refresh(): void {
        let oldIndexMap = this.indexMap;
        let source = this.collection.getEnumerable();
        let tmp: number[] = [];
        for (let i = 0; i < source.length; i++) {
            tmp[i] = i;
        }
        tmp.sort((a, b) => {
            return this.sorter(source[a], source[b]);
        });
        this.list = [];
        this.indexMap = [];
        for (let i = 0; i < tmp.length; i++) {
            this.list[i] = source[tmp[i]];
            this.indexMap[tmp[i]] = i;
        }
        let indicies: number[] = [];
        for (let i = 0; i < oldIndexMap.length; i++) {
            indicies[i] = oldIndexMap[tmp[i]];
        }
        this.changeEvent.trigger({
            type: "reorganize",
            changeId: ++this.changeId,
            indicies: indicies
        });
    }
    
    static getPropertyGetter<T, U>(getter: utils.GetterArg<T, U>): utils.Getter<T, U>  {
        if (typeof(getter) == "function") {
            return getter;
        }
        return (obj: T) => {
            return (<any>obj)[<string>getter];
        };
    }
    
    static nullableDateComparator<T>(getterArg: utils.GetterArg<T, Date>, orderArg: string, alternative: utils.Comparator<T>): utils.Comparator<T> {
        let getter = SortedCollection.getPropertyGetter(getterArg);
        let order = orderArg == "desc" ? -1 : 1;
        return (a, b) => {
            let dateA = getter(a);
            let dateB = getter(b);
            if (dateA == null && dateB == null) {
                return alternative(a, b);
            }
            if (dateA == null) {
                return -1;
            }
            if (dateB == null) {
                return 1;
            }
            let valA = dateA.getTime();
            let valB = dateB.getTime();
            let cmp = valA - valB;
            return order * cmp;
        };
    }
    
    static dateComparator<T>(getterArg: utils.GetterArg<T, Date>, orderArg?: string): utils.Comparator<T> {
        let getter = SortedCollection.getPropertyGetter(getterArg);
        let order = orderArg == "desc" ? -1 : 1;
        return (a, b) => {
            let valA = getter(a).getTime();
            let valB = getter(b).getTime();
            let cmp = valA - valB;
            return order * cmp;
        };
    }
    
    static stringComparator<T>(getterArg: utils.GetterArg<T, string>, orderArg?: string): utils.Comparator<T> {
        let getter = SortedCollection.getPropertyGetter(getterArg);
        let order = orderArg == "desc" ? -1 : 1;
        return (a, b) => {
            let valA = getter(a);
            let valB = getter(b);
            let cmp = valA.localeCompare(valB);
            return order * cmp;
        };
    }
    
    static stringNumericComparator<T>(getterArg: utils.GetterArg<T, string>, orderArg?: string): utils.Comparator<T> {
        let getter = SortedCollection.getPropertyGetter(getterArg);
        let order = orderArg == "desc" ? -1 : 1;
        return (a, b) => {
            let valA = getter(a);
            let valB = getter(b);
            if (valA.length != valB.length) {
                return valA.length - valB.length;
            }
            let cmp = valA.localeCompare(valB);
            return order * cmp;
        };
    }
    
    static stringNullableNumericComparator<T>(getterArg: utils.GetterArg<T, string>, orderArg: string, alternative: utils.Comparator<T>): utils.Comparator<T> {
        let getter = SortedCollection.getPropertyGetter(getterArg);
        let order = orderArg == "desc" ? -1 : 1;
        return (a, b) => {
            let valA = getter(a);
            let valB = getter(b);
            if (valA == null && valB == null) {
                return alternative(a, b);
            }
            if (valA == null) {
                return -1;
            }
            if (valB == null) {
                return 1;
            }
            if (valA.length != valB.length) {
                return valA.length - valB.length;
            }
            let cmp = valA.localeCompare(valB);
            return order * cmp;
        };
    }
    
    static numericComparator<T>(getterArg: utils.GetterArg<T, number>, orderArg?: string): utils.Comparator<T> {
        let getter = SortedCollection.getPropertyGetter(getterArg);
        let order = orderArg == "desc" ? -1 : 1;
        return (a, b) => {
            let valA = getter(a);
            let valB = getter(b);
            let cmp = valA - valB;
            return order * cmp;
        };
    }
}
