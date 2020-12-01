export class Utils {
    
    static arraysEqual<T>(a: T[], b: T[], equalCb?: (a: T, b: T) => boolean): boolean {
        if (a.length != b.length) {
            return false;
        }
        return this.orderedArraysEqual(a.slice().sort(), b.slice().sort(), equalCb);
    }
    
    static orderedArraysEqual<T>(a: T[], b: T[], equalCb?: (a: T, b: T) => boolean): boolean {
        if (a.length != b.length) {
            return false;
        }
        if (!equalCb) {
            equalCb = (a, b) => a == b;
        }
        for (let i = 0; i < a.length; ++i) {
            if (!equalCb(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    
    static indexOfBy<T>(arr: T[], cmp: (a: T) => boolean): number {
        for (let i = 0; i < arr.length; ++i) {
            if (cmp(arr[i])) {
                return i;
            }
        }
        return -1;
    }
    
    static uniqueArrayMerge<T>(dst: T[], src: T[], comparator: (a: T, b: T) => boolean = (a, b) => a == b): void {
        for (let el of src) {
            let found: boolean = false;
            for (let el2 of dst) {
                if (comparator(el, el2)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                dst.push(el);
            }
        }
    }
    
    static arrayDiff<T>(first: T[], second: T[]): { added: T[], removed: T[] } {
        let result: { added: T[], removed: T[] } = { added: [], removed: [] };
        
        for (let element of first) {
            if (second.indexOf(element) < 0) {
                result.removed.push(element);
            }
        }
        
        for (let element of second) {
            if (first.indexOf(element) < 0) {
                result.added.push(element);
            }
        }
        
        return result;
    }
    
}
