export function ApiService(constructor: any) {
    //Empty decorator it only mark ApiService to be generated
}
export function Dependencies(dependencies: string[]) {
    return function(constructor: any) {
        if (constructor.prototype.__dependencies == null) {
            constructor.prototype.__dependencies = dependencies;
        }
        else {
            constructor.prototype.__dependencies = constructor.prototype.__dependencies.concat(dependencies);
        }
        return constructor;
    }
}
export function ApiMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (target.__exportedMethods == null) {
        target.__exportedMethods = []
    }
    target.__exportedMethods.push(propertyKey);
}
export interface PropertyToInject {
    propertyKey: string;
    dependencyName: string;
}
export interface WithInjectInfo {
    __propertiesToInject: PropertyToInject[];
    __dependencies: string[];
}
export function InjectCore(t: any, property: PropertyToInject) {
    let target = <WithInjectInfo>t;
    if (target.__propertiesToInject == null) {
        target.__propertiesToInject = [];
        (<any>target.__propertiesToInject).__for = target;
    }
    else {
        if ((<any>target.__propertiesToInject).__for != target) {
            target.__propertiesToInject = target.__propertiesToInject.concat([]);
            (<any>target.__propertiesToInject).__for = target;
        }
    }
    target.__propertiesToInject.push(property);
}
export function Inject(t: any, propertyKey: string) {
    InjectCore(t, {propertyKey: propertyKey, dependencyName: propertyKey});
}
export function InjectNamed(dependencyName?: string) {
    return (t: any, propertyKey: string) => {
        InjectCore(t, {propertyKey: propertyKey, dependencyName: dependencyName});
    };
}

export function measure() {
    return (
        target: Object,
        propertyKey: string,
        descriptor: PropertyDescriptor
      ) => {
        const originalMethod = descriptor.value;
      
        descriptor.value = function (...args: any[]) {
            const start = Date.now();
            const result = originalMethod.apply(this, args);
            if (result != null && typeof result.fin == "function") {
                result.fin(() => {
                    const finish = Date.now();
                    console.log(`Promise execution time of ${propertyKey}: ${finish - start} milliseconds`);
                } )
            }
            else {
                const finish = Date.now();
                console.log(`Sync execution time of ${propertyKey}: ${finish - start} milliseconds`);  
            }
            return result;
        };
        return descriptor;
    };
}
