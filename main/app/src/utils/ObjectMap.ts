export class ObjectMap<T = any> {
    
    id: number;
    map: {[key: string]: T};
    
    constructor() {
        this.id = 0;
        this.map = {};
    }
    
    add(obj: T): number {
        this.map[++this.id] = obj;
        return this.id;
    }
    
    get(id: number): T {
        return this.map[id];
    }

    remove(id: number): void {
        if (id in this.map) {
            delete this.map[id];
        }
    }
}
