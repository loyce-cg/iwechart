export class PromiseCache<T> {
    
    promise: Promise<T>;
    
    async go(func: () => Promise<T>): Promise<T> {
        if (this.promise) {
            return this.promise;
        }
        try {
            this.promise = func();
            return await this.promise;
        }
        finally {
            this.promise = null;
        }
    }
}