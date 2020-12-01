// This class should've never been created, because there is a Set<T> in JS...
// ... but we aren't using ES6 ATM :(

export class PrivmxSet<T> {
    
    protected items: T[] = [];
    
    constructor(items: T[] = null) {
        if (items) {
            this.addMany(items);
        }
    }
    
    add(item: T): boolean {
        if (this.items.indexOf(item) >= 0) {
            return false;
        }
        this.items.push(item);
        return true;
    }
    
    addMany(items: T[]): boolean[] {
        let res: boolean[] = [];
        for (let item of items) {
            res.push(this.add(item));
        }
        return res;
    }
    
    has(item: T): boolean {
        return this.items.indexOf(item) >= 0;
    }
    
    remove(item: T): boolean {
        let index: number = this.items.indexOf(item);
        if (index < 0) {
            return false;
        }
        this.items.splice(index, 1);
        return true;
    }
    
    size(): number {
        return this.items.length;
    }
    
    toArray(): T[] {
        return this.items.slice();
    }
    
}