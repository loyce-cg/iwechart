import * as Q from "q";
import { WithInjectInfo } from "../utils/Decorators";
import * as RootLogger from "simplito-logger";
import { Lang } from "../utils/Lang";
let Logger = RootLogger.get("privfs-mail-client.mail.IOC");

export enum Lifecycle {
    NORMAL,
    ETERNAL
}

export interface IocEntry<T> {
    value: T;
    resolved: boolean;
    loadPromise: Q.Promise<T>;
    constructorFunc: {new(...args: any[]): T};
    dependencies: string[];
    factory: () => Q.IWhenable<T>;
    lifecycle: Lifecycle
}

export class IOC {
    
    map: {[entryName: string]: IocEntry<any>};
    components: {[componentName: string]: {new(...args: any[]): any}};
    
    constructor() {
        this.map = {};
        this.components = {};
    }
    
    registerByValue<T = any>(entryName: string, value: T, lifecycle?: Lifecycle): T {
        if (entryName in this.map) {
            throw new Error("Element with name '" + entryName + "' already register");
        }
        this.map[entryName] = {
            value: value,
            resolved: true,
            loadPromise: null,
            constructorFunc: null,
            dependencies: null,
            factory: null,
            lifecycle: lifecycle == null ? Lifecycle.NORMAL : lifecycle
        };
        return value;
    }
    
    registerByConstructor<T = any>(entryName: string, constructorFunc: {new(...args: any[]): T}, dependencies: string[], lifecycle?: Lifecycle): void {
        if (entryName in this.map) {
            throw new Error("Element with name '" + entryName + "' already register");
        }
        this.map[entryName] = {
            value: null,
            resolved: false,
            loadPromise: null,
            constructorFunc: constructorFunc,
            dependencies: dependencies,
            factory: null,
            lifecycle: lifecycle == null ? Lifecycle.NORMAL : lifecycle
        };
    }
    
    registerByFactory<T = any>(entryName: string, factory: () => Q.IWhenable<T>, lifecycle?: Lifecycle): void {
        if (entryName in this.map) {
            throw new Error("Element with name '" + entryName + "' already register");
        }
        this.map[entryName] = {
            value: null,
            resolved: false,
            loadPromise: null,
            constructorFunc: null,
            dependencies: null,
            factory: factory,
            lifecycle: lifecycle == null ? Lifecycle.NORMAL : lifecycle
        };
    }
    
    resolve<T = any>(entryName: string): Q.Promise<T> {
        return Q().then(() => {
            if (!this.map[entryName]) {
                throw new Error("Entry with name '" + entryName + "' is not registered");
            }
            let entry = <IocEntry<T>>this.map[entryName];
            if (entry.resolved) {
                return entry.value;
            }
            if (entry.loadPromise == null) {
                entry.loadPromise = Q().then(() => {
                    if (entry.factory) {
                        return entry.factory();
                    }
                    if (entry.constructorFunc) {
                        return this.resolveMany(entry.dependencies).then(deps => {
                            let value = <T>Object.create(entry.constructorFunc.prototype);
                            entry.constructorFunc.apply(value, deps);
                            return value;
                        });
                    }
                    throw new Error("Unsupported IOC entry '" + entryName + "'");
                })
                .then(value => {
                    entry.value = value;
                    entry.resolved = true;
                    delete entry.loadPromise;
                    return value;
                })
                .fail(error => {
                    Logger.error("Error during resolving", entryName, error);
                    delete entry.loadPromise;
                    return Q.reject(error);
                });
            }
            return entry.loadPromise;
        });
    }
    
    resolveMany<A = any, B = any, C = any, D = any, E = any, F = any>(entriesNames: [string, string, string, string, string, string]): Q.Promise<[A, B, C, D, E, F]>;
    resolveMany<A = any, B = any, C = any, D = any, E = any>(entriesNames: [string, string, string, string, string]): Q.Promise<[A, B, C, D, E]>;
    resolveMany<A = any, B = any, C = any, D = any>(entriesNames: [string, string, string, string]): Q.Promise<[A, B, C, D]>;
    resolveMany<A = any, B = any, C = any>(entriesNames: [string, string, string]): Q.Promise<[A, B, C]>;
    resolveMany<A = any, B = any>(entriesNames: [string, string]): Q.Promise<[A, B]>;
    resolveMany<T>(entriesNames: string[]): Q.Promise<T[]>;
    resolveMany(entriesNames: string[]): Q.Promise<Q.Promise<any>[]> {
        return Q.all(entriesNames.map(x => this.resolve(x)));
    }
    
    clearDeps() {
        let newMap: {[entryName: string]: IocEntry<any>} = {};
        for (let entryName in this.map) {
            let entry = this.map[entryName];
            if (entry.lifecycle == Lifecycle.ETERNAL) {
                newMap[entryName] = entry;
                if (entry.value != this && entry.value && typeof(entry.value.clearDeps) == "function") {
                    entry.value.clearDeps();
                }
            }
            else {
                if (entry.value && typeof(entry.value.destroy) == "function") {
                    entry.value.destroy();
                }
            }
        }
        this.map = newMap;
    }
    
    getDependencies(constructorFunc: Function): string[] {
        let propertiesToInject = (<WithInjectInfo>constructorFunc.prototype).__propertiesToInject || [];
        let result = propertiesToInject.map(x => x.dependencyName);
        let deps = (<WithInjectInfo>constructorFunc.prototype).__dependencies || [];
        deps.forEach(x => {
            let component = this.components[x];
            if (component == null) {
                throw new Error("Unknown dependency '" + x + "'");
            }
            result = result.concat(this.getDependencies(component));
        });
        return result;
    }
    
    getComponentDependencies(constructorFunc: Function): string[] {
        let result: string[] = [];
        let deps = (<WithInjectInfo>constructorFunc.prototype).__dependencies || [];
        deps.forEach(x => {
            let component = this.components[x];
            if (component == null) {
                throw new Error("Unknown dependency '" + x + "'");
            }
            result.push(x);
            result = result.concat(this.getComponentDependencies(component));
        });
        return Lang.unique(result);
    }
    
    create<A, B, C, D, E, T>(constructorFunc: {new(a: A, b: B, c: C, d: D, e: E): T}, args: [A, B, C, D, E]): Q.Promise<T>
    create<A, B, C, D, T>(constructorFunc: {new(a: A, b: B, c: C, d: D): T}, args: [A, B, C, D]): Q.Promise<T>
    create<A, B, C, T>(constructorFunc: {new(a: A, b: B, c: C): T}, args: [A, B, C]): Q.Promise<T>
    create<A, B, T>(constructorFunc: {new(a: A, b: B): T}, args: [A, B]): Q.Promise<T>
    create<A, T>(constructorFunc: {new(a: A): T}, args: [A]): Q.Promise<T>
    create<T>(constructorFunc: {new(...args: any[]): T}, args: any[]): Q.Promise<T> {
        let deps = this.getDependencies(constructorFunc);
        
        // @todo i18n-per-window: use following line (and more) to determine which texts windows require
        // let textDeps = this.getTextDependencies(constructorFunc);
        // ...
        
        return this.resolveMany(deps).then(() => {
            return this.createSync(constructorFunc, <any>args);
        })
        .fail(e => {
            Logger.error("Error creating element", constructorFunc, e);
            return Q.reject<T>(e);
        });
    }
    
    createSync<A, B, C, D, E, T>(constructorFunc: {new(a: A, b: B, c: C, d: D, e: E): T}, args: [A, B, C, D, E]): T
    createSync<A, B, C, D, T>(constructorFunc: {new(a: A, b: B, c: C, d: D): T}, args: [A, B, C, D]): T
    createSync<A, B, C, T>(constructorFunc: {new(a: A, b: B, c: C): T}, args: [A, B, C]): T
    createSync<A, B, T>(constructorFunc: {new(a: A, b: B): T}, args: [A, B]): T
    createSync<A, T>(constructorFunc: {new(a: A): T}, args: [A]): T
    createSync<T>(constructorFunc: {new(...args: any[]): T}, args: any[]): T {
        let propertiesToInject = (<WithInjectInfo>constructorFunc.prototype).__propertiesToInject || [];
        let result = Object.create(constructorFunc.prototype);
        propertiesToInject.map(propertyToInject => {
            let entry = this.map[propertyToInject.dependencyName];
            if (!entry.resolved) {
                throw new Error("Entry with name '" + propertyToInject.dependencyName + "' is not resolved yet");
            }
            result[propertyToInject.propertyKey] = entry.value;
        });
        constructorFunc.apply(result, args);
        return result;
    }
    
    registerComponent(componentName: string, constructorFunc: {new(...args: any[]): any}): void {
        if (componentName in this.components) {
            throw new Error("Element with name '" + componentName + "' already register");
        }
        this.components[componentName] = constructorFunc;
    }
    
    createComponent<A, B, C, D, E, T = any>(componentName: string, args: [A, B, C, D, E]): T
    createComponent<A, B, C, D, T = any>(componentName: string, args: [A, B, C, D]): T
    createComponent<A, B, C, T = any>(componentName: string, args: [A, B, C]): T
    createComponent<A, B, T = any>(componentName: string, args: [A, B]): T
    createComponent<A, T = any>(componentName: string, args: [A]): T
    createComponent<T = any>(componentName: string, args: any[]): T {
        if (!this.components[componentName]) {
            throw new Error("Entry with name '" + componentName + "' is not registered");
        }
        return this.createSync(this.components[componentName], <any>args);
    }
    
    getTextDependencies<T>(constructorFunc: {new(...args: any[]): T}): {new(...args: any[]): T}[] {
        let textDeps = [constructorFunc];
        this.getComponentDependencies(constructorFunc).forEach(x => textDeps.push(this.components[x]));
        textDeps = textDeps.filter(x => x && (<any>x).textsPrefix && (<any>x).textsPrefix.length);
        return textDeps;
    }
    
}