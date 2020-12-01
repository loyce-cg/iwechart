import { BaseLazyLoader } from "./BaseLazyLoader";
import * as Q from "q";

export interface LoaderOptions {
    reloadDelay?: number;
    reloadOnFail?: boolean;
    deps?: string[];
}

export class LazyLoader extends BaseLazyLoader {
    static readonly DEFAULT_DELAY: number = 100;
    static readonly DEFAULT_REQUEST_TIMEOUT: number = 10000;
    map: {[name: string]: {service: any, resolved: boolean, loadingPromise?: Q.Promise<any>, loaderOptions?: LoaderOptions, fn: () => any}};
    dependencies: {[name: string]: string[]};
    options: {[name: string]: LoaderOptions};
    constructor() {
        super();
        this.dependencies = {};
        this.options = {};
    }
    
    registerWithDeps<T>(name: string, loaderOptions: LoaderOptions, func: () => Q.IWhenable<T>): Q.Promise<T> {
        if (!(name in this.dependencies)) {
            this.dependencies[name] = loaderOptions.deps;
            this.register(name, func);
        }
        this.options[name] = loaderOptions;
        return this.safeLoad(name);
    }

    get<T>(name: string): Q.Promise<T> {
        // console.log("getting ", name, "...");
        // return LazyLoader.promiseDelay(3000)
        // .then(() => {
            return Q.timeout(Q().then(() => {
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
                        // console.log(name, "loading done.");
                        return service;
                    })
                    .fail(error => {
                        delete elem.loadingPromise;
                        return Q.reject(error);
                    });
                }
                return elem.loadingPromise;
            }), LazyLoader.DEFAULT_REQUEST_TIMEOUT) ;
        // })
    }

    static safeExec<T>(name: string, func: () => Q.IWhenable<T>): Q.Promise<T> {
        return Q.reject().catch(() => {
            // console.log("running task ", name, "...");
            let loadingPromise: Q.Promise<any>;
            return Q.timeout(Q().then(() => {
                loadingPromise = Q().then(func)
                .then(service => {
                    console.log(name, "loading done.");
                    return service;
                })
                .fail(error => {
                    return Q.reject(error);
                });
                return loadingPromise;
            }), LazyLoader.DEFAULT_REQUEST_TIMEOUT)
            .catch(() => {
                // console.log(name, "error during safe executing..");
                return this.promiseDelay(LazyLoader.DEFAULT_DELAY).then(() => this.safeExec(name, func));
            })
    
        })

    }

    safeLoad<T>(name: string): Q.Promise<T> {
        return Q.reject().catch(() => {
            return Q().then(() => {
                return this.safeLoadDeps(name);
            })
            .then(() => {
                return this.get(name);
            })
            .catch(e => {
                // console.log(name, "error during safeloading..", e);
                return LazyLoader.promiseDelay(LazyLoader.DEFAULT_DELAY).then(() => this.reload(name));
            })
        })
    }

    safeLoadDeps(name: string): Q.Promise<void> {
        // console.log("load deps for", name, "...")
        return Q().then(() => {
            let toResolve: Q.Promise<any>[] = [];

            if (this.dependencies[name]) {
                let deps = this.dependencies[name];
                deps.forEach(dep => {
                    if (! this.map[dep].resolved) {
                        toResolve.push(Q().then(() => this.safeLoad(dep)))
                    }
                })
                return Q.all(toResolve).thenResolve(null);
            }
        })
    }

    static promiseDelay(n: number): Q.Promise<void> {
        return Q.Promise(resolve => setTimeout(() => resolve(), n));
    }

    destroyService(name: string) {
        if (name in this.map) {
            let serviceEntry = this.map[name];
            if (serviceEntry.service && typeof(serviceEntry.service.destroy) == "function") {
                serviceEntry.service.destroy();
            }
        }
    }

    reload<T>(name: string):  Q.Promise<T> {
        // console.log("reload of ", name);
        this.destroyService(name);
        return this.safeLoad(name);
    }

    destroy() {
        super.destroy();
        this.dependencies = {};
        this.options = {};
    }
}