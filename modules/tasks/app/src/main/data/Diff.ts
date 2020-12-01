export abstract class Diff<T> {
    
    constructor(public original: T, public newObject: T) {
        
    }
    
    abstract diff(): {
        
    }
    
}