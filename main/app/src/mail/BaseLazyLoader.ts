import * as Q from "q";

export class BaseLazyLoader {
    
    map: {[name: string]: {service: any, resolved: boolean, loadingPromise?: Q.Promise<any>, fn: () => any}};
    
    constructor() {
        this.map = {};
    }
    
    registerEx<T>(name: string, func: () => Q.IWhenable<T>): Q.Promise<T> {
        if (!(name in this.map)) {
            this.register(name, func);
        }
        return this.get(name);
    }
    
    register(name: string, fn: () => any): void {
        if (this.map[name]) {
            throw new Error("Name in use");
        }
        this.map[name] = {
            service: null,
            resolved: false,
            fn: fn
        };
    }
    
    get<T>(name: string): Q.Promise<T> {
        return Q().then(() => {
            if (!this.map[name]) {
                throw new Error("Unknown service " + name);
            }
            let elem = this.map[name];
            if (elem.resolved) {
                return elem.service;
            }
            if (!elem.loadingPromise) {
                elem.loadingPromise = Q().then(elem.fn)
                .then(service => {
                    elem.resolved = true;
                    elem.service = service;
                    return service;
                })
                .fail(error => {
                    delete elem.loadingPromise;
                    return Q.reject(error);
                });
            }
            return elem.loadingPromise;
        });
    }
    
    destroy() {
        for (let serviceName in this.map) {
            let serviceEntry = this.map[serviceName];
            if (serviceEntry.service && typeof(serviceEntry.service.destroy) == "function") {
                serviceEntry.service.destroy();
            }
        }
        this.map = {};
    }
}

