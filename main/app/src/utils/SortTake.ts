import {utils} from "../Types";

export class SortTake<T> {
    
    count: number;
    list: T[];
    comparator: utils.Comparator<T>;
    
    constructor(count: number, comparator: utils.Comparator<T>) {
        this.count = count;
        this.comparator = comparator;
        this.list = [];
    }
    
    add(element: T): void {
        if (this.list.length == 0) {
            this.list.push(element);
            return;
        }
        for (let i = this.list.length - 1; i >= 0; i--) {
            if (this.comparator(element, this.list[i]) < 0) {
                if (i + 1 < this.count) {
                    this.list[i + 1] = this.list[i];
                }
                this.list[i] = element;
            }
            else {
                if (i == this.list.length - 1 && this.list.length < this.count) {
                    this.list.push(element);
                }
            }
        }
    }
}

