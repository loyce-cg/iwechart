export abstract class DataObject {
    [key: string]: any;
    
    constructor(obj: any = null) {
        if (typeof(obj) == "object") {
            for (let k in obj) {
                if (typeof(obj[k]) != "function") {
                    this[k] = obj[k];
                }
            }
        }
    }
    
    ensureFieldIsArray(fieldName: string): void {
        if (!Array.isArray(this[fieldName])) {
            this[fieldName] = [];
        }
    }
    
    ensureFieldsAreArrays(fieldNames: Array<string>): void {
        for (let fieldName of fieldNames) {
            this.ensureFieldIsArray(fieldName);
        }
    }
    
    addToProperty<T>(property: Array<T>, newMember: T, ensureUnique: boolean, first: boolean = false): boolean {
        if (!ensureUnique || property.indexOf(newMember) == -1) {
            if (first) {
                property.splice(0, 0, newMember);
            } else {
                property.push(newMember);
            }
            return true;
        }
        return false;
    }
    
    removeFromProperty<T>(property: Array<T>, member: T): boolean {
        let idx = property.indexOf(member);
        if (idx >= 0) {
            property.splice(idx, 1);
            return true;
        }
        return false;
    }
    
    isFieldSerializable(fieldName: string): boolean {
        return fieldName == "__version__" || fieldName == "__data_version__" || fieldName.length == 0 || fieldName[0] != "_";
    }
    
    toJSON(): any {
        let res: any = {};
        for (let k in this) {
            if (this.isFieldSerializable(k)) {
                res[k] = this[k];
            }
        }
        return res;
    }
    
    updateObjectProperties<T extends this>(other: T, hooks: {[key: string]: (val: any)=>void} = {}) {
        if (this == other) {
            return;
        }
        for (let prop of Object.getOwnPropertyNames(other)) {
            if (this[prop] != other[prop]) {
                this[prop] = other[prop];
                if (prop in hooks) {
                    hooks[prop](this[prop]);
                }
            }
        }
    }
    
    abstract diff(other: any): string[];
    
}
