export enum ConflictResolutionStatus {
    UNRESOLVED,
    RESOLVED,
    IDENTICAL,
    DIFFERENT_OBJECT,
}

export interface ConflictResolutionResult<T> {
    status: ConflictResolutionStatus;
    resolvedObject?: T;
}

export abstract class ConflictResolver<T> {
    
    constructor(public original: T, public first: T, public second: T) {
    }
    
    abstract resolve(): ConflictResolutionResult<T>;
    
    tryResolveSimplePropertyConflict(propertyName: string, resolved: any, aDiffs: string[], bDiffs: string[], abDiffs: string[]): ConflictResolutionStatus {
        if (abDiffs.indexOf(propertyName) >= 0 && aDiffs.indexOf(propertyName) >= 0 && bDiffs.indexOf(propertyName) >= 0) {
            return ConflictResolutionStatus.UNRESOLVED;
        }
        if (abDiffs.indexOf(propertyName) >= 0) {
            if (aDiffs.indexOf(propertyName) >= 0 && bDiffs.indexOf(propertyName) >= 0) {
                return ConflictResolutionStatus.UNRESOLVED;
            }
            let PropertyName = propertyName[0].toUpperCase() + propertyName.substr(1);
            if (aDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName]((<any>this.first)["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
            if (bDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName]((<any>this.second)["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
        }
        return ConflictResolutionStatus.IDENTICAL;
    }
    
    tryResolveSimpleArrayPropertyConflict(propertyName: string, resolved: any, aDiffs: string[], bDiffs: string[], abDiffs: string[]): ConflictResolutionStatus {
        let PropertyName = propertyName[0].toUpperCase() + propertyName.substr(1);
        if (aDiffs.indexOf(propertyName) >= 0 && bDiffs.indexOf(propertyName) >= 0 && abDiffs.indexOf(propertyName) >= 0) {
            let orig: any[] = (<any>this.original)["get" + PropertyName]();
            let a: any[] = (<any>this.first)["get" + PropertyName]();
            let b: any[] = (<any>this.second)["get" + PropertyName]();
            let c: any[] = orig.slice();
            
            // If something was removed, remove it
            for (let i = 0; i < orig.length; ++i) {
                if (a.indexOf(orig[i]) < 0 || b.indexOf(orig[i]) < 0) {
                    let idx = c.indexOf(orig[i]);
                    if (idx >= 0) {
                        c.splice(idx, 1);
                    }
                }
            }
            
            // If something was added, add it
            for (let i = 0; i < a.length; ++i) {
                if (orig.indexOf(a[i]) < 0) {
                    c.push(a[i]);
                }
            }
            for (let i = 0; i < b.length; ++i) {
                if (orig.indexOf(b[i]) < 0) {
                    c.push(b[i]);
                }
            }
            
            resolved["set" + PropertyName](c);
            return ConflictResolutionStatus.RESOLVED;
        }
        if (abDiffs.indexOf(propertyName) >= 0) {
            if (aDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName]((<any>this.first)["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
            if (bDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName]((<any>this.second)["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
        }
        return ConflictResolutionStatus.IDENTICAL;
    }
    
    tryResolveSimpleOrderedArrayPropertyConflict(propertyName: string, resolved: any, aDiffs: string[], bDiffs: string[], abDiffs: string[]): ConflictResolutionStatus {
        let PropertyName = propertyName[0].toUpperCase() + propertyName.substr(1);
        let aDiff = aDiffs.indexOf(propertyName) >= 0;
        let bDiff = bDiffs.indexOf(propertyName) >= 0;
        let abDiff = abDiffs.indexOf(propertyName) >= 0;
        if (!abDiff) {
            return ConflictResolutionStatus.IDENTICAL;
        }
        if (aDiff && bDiff) {
            return ConflictResolutionStatus.UNRESOLVED;
        }
        
        let orig: any[] = (<any>this.original)["get" + PropertyName]();
        let a: any[] = (<any>this.first)["get" + PropertyName]();
        let b: any[] = (<any>this.second)["get" + PropertyName]();
        let c: any[] = [];
        if (!aDiff) {
            c = b.slice();
        }
        else if (!bDiff) {
            c = a.slice();
        }
        resolved["set" + PropertyName](c);
        return ConflictResolutionStatus.RESOLVED;
    }
}
