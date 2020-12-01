export class AsyncHelper {
    
    _id = 1;
    _calls: {[id: string]: any} = {};
    
    send(sendFun: Function, timeout?: number): Promise<any> {
        if (timeout === undefined) {
            timeout = 1000;
        }
        
        const id = this._id++;
        return new Promise((resolve, reject) => {
            sendFun(id);
            var timer = setTimeout(() => {
                reject({code: -1, message: "timeout"});
                delete this._calls[id];
            }, timeout);
            this._calls[id] = {
                resolve: (result: any) => {
                    resolve(result);
                    clearTimeout(timer);
                    delete this._calls[id];
                },
                reject: (error: any) => {
                    reject(error);
                    clearTimeout(timer);
                    delete this._calls[id];
                }
            };
        })
    }
    
    receive(msg: any) {
        if (msg.id && this._calls[msg.id]) {
            if (msg.error) {
                this._calls[msg.id].reject(msg.error);
            }
            else {
                this._calls[msg.id].resolve(msg.result);
            }
            return true;
        }
        return false;
    }
}
