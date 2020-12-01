import {Event} from "./Event";

export class Events {
    
    map: {[name: string]: Event<any, any, any>};
    
    constructor() {
        this.map = {};
    }
    
    on(name: string, callback: Function, type?: string): void {
        if (typeof(name) != "string") {
            throw new Error("Invalid name");
        }
        if (!(name in this.map)) {
            this.map[name] = new Event();
        }
        this.map[name].add(<any>callback, <any>type);
    }
    
    off(name: string, callback: Function, type?: string): void {
        if (typeof(name) != "string") {
            throw new Error("Invalid name");
        }
        if (name in this.map) {
            this.map[name].remove(<any>callback, <any>type);
        }
    }
    
    trigger(name: string, ...args: any[]): void {
        if (typeof(name) != "string") {
            throw new Error("Invalid name");
        }
        if (!(name in this.map)) {
            this.map[name] = new Event();
        }
        let event = this.map[name];
        event.trigger.apply(event, Array.prototype.slice.call(arguments, 1));
    }
    
    clear(): void {
        for (var name in this.map) {
            this.map[name].clear();
        }
    }
    
    hold(): void {
        for (var name in this.map) {
            this.map[name].hold();
        }
    }
    
    release(): void {
        for (var name in this.map) {
            this.map[name].release();
        }
    }
}

