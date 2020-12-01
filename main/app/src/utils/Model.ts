import {Event} from "./Event";

export class Model<T> {
    
    data: T;
    changeEvent: Event<any, any, any>;
    
    constructor(data: T) {
        this.data = data;
        this.changeEvent = new Event();
    }
    
    set(data: T): void {
        this.data = data;
        this.changeEvent.trigger("set", data);
    }
    
    setWithCheck(data: T): void {
        if (this.data != data) {
            this.set(data);
        }
    }
    
    get(): T {
        return this.data;
    }
    
    trigger(...args: any[]): void {
        this.changeEvent.trigger.apply(this.changeEvent, arguments);
    }
    
    destroy(): void {
        this.changeEvent.clear();
    }
    
    static proxy<T>(source: Model<T>, destination: Model<T>) {
        source.changeEvent.add(() => {
            destination.setWithCheck(source.get());
        });
    }
}

