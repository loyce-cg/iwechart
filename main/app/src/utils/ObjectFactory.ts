import {EventDispatcher} from "./EventDispatcher";
import * as Types from "../Types";

export type Constructor = {new(...args: any[]): any;};

export class ObjectFactory {
    
    named: {[name: string]: Constructor};
    
    constructor() {
        this.named = {};
    }
    
    register(constructor: Constructor): void {
        if (!constructor.prototype.className) {
            throw new Error("Cannot register class without className property in prototype");
        }
        this.registerByName(constructor.prototype.className, constructor);
    }
    
    registerByName(name: string, constructor: Constructor): void {
        if (name in this.named) {
            throw new Error("Constructor with name '" + name + "' already registered");
        }
        this.named[name] = constructor;
    }
    
    create<T>(clazz: {new (): T}): T;
    create<T, A1>(clazz: {new (a1: A1): T}, a1: A1): T;
    create<T, A1, A2>(clazz: {new (a1: A1, a2: A2): T}, a1: A1, a2: A2): T;
    create<T, A1, A2, A3>(clazz: {new (a1: A1, a2: A2, a3: A3): T}, a1: A1, a2: A2, a3: A3): T;
    create<T, A1, A2, A3, A4>(clazz: {new (a1: A1, a2: A2, a3: A3, a4: A4): T}, a1: A1, a2: A2, a3: A3, a4: A4): T;
    create<T, A1, A2, A3, A4>(clazz: {new (a1?: A1, a2?: A2, a3?: A3, a4?: A4): T}, a1?: A1, a2?: A2, a3?: A3, a4?: A4): T {
        return new clazz(a1, a2, a3, a4);
    }
    
    createByName<T = any>(name: string, a1?: any, a2?: any, a3?: any, a4?: any): T {
        if (!(name in this.named)) {
            throw new Error("Constructor with name '" + name + "' is not registered");
        }
        return <T>this.create(this.named[name], a1, a2, a3, a4);
    }
}