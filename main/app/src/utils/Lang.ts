import {utils} from "../Types";

export class Lang {
    
    constructor() {
    }
    
    static map<T, U>(array: T[], func: utils.ArrayMapper<T, U>): U[] {
        let res = [];
        for (let i = 0; i < array.length; i++) {
            res.push(func(array[i], i, array));
        }
        return res;
    }
    
    static find<T>(array: T[], func: utils.ArrayFinder<T>): T {
        let index = Lang.indexOf(array, func);
        return index == -1 ? null : array[index];
    }
    
    static findAll<T>(array: T[], func: utils.ArrayFinder<T>): T[] {
        let res: T[] = [];
        for (let i = 0; i < array.length; i++) {
            if (func(array[i], i, array)) {
                res.push(array[i]);
            }
        }
        return res;
    }
    
    static indexOf<T>(array: T[], func: utils.ArrayFinder<T>): number {
        for (let i = 0; i < array.length; i++) {
            if (func(array[i], i, array)) {
                return i;
            }
        }
        return -1;
    }
    
    static findByProperty<T>(array: T[], propertyName: string, propertyValue: any): T {
        let index = Lang.indexOfByProperty(array, propertyName, propertyValue);
        return index == -1 ? null : array[index];
    }
    
    static indexOfByProperty<T>(array: T[], propertyName: string, propertyValue: any): number {
        for (let i = 0; i < array.length; i++) {
            if ((<any>array[i])[propertyName] === propertyValue) {
                return i;
            }
        }
        return -1;
    }
    
    static containsFunc<T>(array: T[], func: utils.ArrayFinder<T>): boolean {
        for (let i = 0; i < array.length; i++) {
            if (func(array[i], i, array)) {
                return true;
            }
        }
        return false;
    }
    
    static contains<T>(array: T[], val: T): boolean {
        return array.indexOf(val) != -1;
    }
    
    static forEach<T>(array: T[], func: utils.ArrayAction<T>): void {
        for (let i = 0; i < array.length; i++) {
            func(array[i], i, array);
        }
    }
    
    static startsWith(str: string, searchString: string, position?: number): boolean {
        if (typeof((<any>str).startsWith) == "function") {
            return (<any>str).startsWith(searchString, position);
        }
        position = position || 0;
        return str.indexOf(searchString, position) === position;
    }
    
    static endsWith(str: string, searchString: string, position?: number): boolean {
        if (typeof((<any>str).endsWith) == "function") {
            return (<any>str).endsWith(searchString, position);
        }
        let subjectString = str;
        if (typeof(position) !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        let lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    }
    
    static insertSort<T>(array: T[], element: T, comparator: utils.Comparator<T>): void {
        for (let i = 0; i < array.length; i++) {
            if (comparator(array[i], element) > 0) {
                array.splice(i, 0, element);
                return;
            }
        }
        array.push(element);
    }
    
    static addKeys<T>(dest: utils.Map<T>, src: utils.Map<T>): void {
        for (var key in src) {
            dest[key] = src[key];
        }
    }
    
    static extendPrototype(destClass: Function, srcClass: Function): void {
        Lang.addKeys(destClass.prototype, srcClass.prototype);
    }
    
    static getValues<T>(map: {[key: string]: T}): T[] {
        let result: T[] = [];
        for (let key in map) {
            result.push(map[key]);
        }
        return result;
    }
    
    static getEntries<T>(map: {[key: string]: T}): {key: string, value: T}[] {
        let result: {key: string, value: T}[] = [];
        for (let key in map) {
            result.push({key: key, value: map[key]});
        }
        return result;
    }
    
    static shallowCopy<T>(obj: T): T {
        let copy: {[key: string]: any} = {};
        for (let key in obj) {
            copy[key] = obj[key];
        }
        return <T>copy;
    }
    
    static simpleDeepCopy<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }
    
    static upperFirstLetter(str: string) {
        return str[0].toUpperCase() + str.substr(1);
    }
    
    static uniqueAdd<T>(list: T[], entry: T): boolean {
        let index = list.indexOf(entry);
        if (index == -1) {
            list.push(entry);
            return true;
        }
        return false;
    }
    
    static removeFromList<T>(list: T[], entry: T): number {
        let index = list.indexOf(entry);
        if (index != -1) {
            list.splice(index, 1);
        }
        return index;
    }
    
    static removeBy<T>(list: T[], func: utils.ArrayFinder<T>): number {
        let index = Lang.indexOf(list, func);
        if (index != -1) {
            list.splice(index, 1);
        }
        return index;
    }
    
    static isDeepEqual(a: any, b: any): boolean {
        if (a === b) {
            return true;
        }
        if (typeof(a) == "object" && typeof(b) == "object" && a != null && b != null) {
            if (Array.isArray(a) && Array.isArray(b)) {
                if (a.length != b.length) {
                    return false;
                }
                for (let i = 0; i < a.length; i++) {
                    if (!Lang.isDeepEqual(a[i], b[i])) {
                        return false;
                    }
                }
                return true;
            }
            if (Array.isArray(a) || Array.isArray(b)) {
                return false;
            }
            for (var key in a) {
                if (!Lang.isDeepEqual(a[key], b[key])) {
                    return false;
                }
            }
            for (var key in b) {
                if (!Lang.isDeepEqual(a[key], b[key])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
    
    static safeJsonParse<T = any>(json: string): T {
        try {
            return <T>JSON.parse(json);
        }
        catch (e) {
            return null;
        }
    }
    
    static replaceArrayElement<T>(array: T[], original: T, newElement: T): boolean {
        let index = array.indexOf(original);
        if (index == -1) {
            return false;
        }
        array[index] = newElement;
        return true;
    }
    
    static getTrimmedString(str: string): string {
        return str ? str.trim() : "";
    }
    
    static addAt<T>(list: T[], index: number, element: T): void {
        if (index < list.length) {
            list.splice(index, 0, element);
        }
        else if (index == list.length) {
            list.push(element);
        }
        else {
            list[index] = element;
        }
    }
    
    static getListDiff<T>(baseList: T[], newList: T[]) {
        let newElements: T[] = [];
        let removedElements: T[] = [];
        newList.forEach(x => {
            if (baseList.indexOf(x) == -1) {
                newElements.push(x);
            }
        });
        baseList.forEach(x => {
            if (newList.indexOf(x) == -1) {
                removedElements.push(x);
            }
        });
        return {
            newElements: newElements,
            removedElements: removedElements
        };
    }
    
    static createCleanCopy<T>(data: T): T {
        if (typeof(data) == "function") {
            return null;
        }
        if (typeof(data) == "object") {
            if (data == null) {
                return null;
            }
            if (Array.isArray(data)) {
                let newArray: any[] = [];
                for (let i = 0; i < data.length; i++) {
                    newArray[i] = Lang.createCleanCopy(data[i]);
                }
                return <any>newArray;
            }
            let newObj = <any>{};
            for (let key in data) {
                newObj[key] = Lang.createCleanCopy(data[key]);
            }
            return newObj;
        }
        return data;
    }
    
    static unique<T>(list: T[]): T[] {
        let res: T[] = [];
        list.forEach(x => {
            if (res.indexOf(x) == -1) {
                res.push(x);
            }
        });
        return res;
    }
    
    static arraysEqual<T>(arr0: T[], arr1: T[]): boolean {
        if (arr0.length != arr1.length) {
            return false;
        }
        for (let i = 0; i < arr0.length; ++i) {
            if (arr1.indexOf(arr0[i]) < 0) {
                return false;
            }
        }
        return true;
    }
}
