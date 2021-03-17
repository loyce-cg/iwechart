export class DataEncoder {
    
    static encode<T>(obj: T): T {
        if (typeof(obj) == "object") {
            if (obj == null) {
                return obj;
            }
            if (Array.isArray(obj)) {
                let res: any[] = [];
                for (let x of obj) {
                    res.push(DataEncoder.encode(x));
                }
                return <any>res;
            }
            if (obj.constructor.name == "Uint8Array" || obj.toString() == "[object ArrayBuffer]") {
                return <any>Buffer.from(<any>obj);
            }
            let res: any = {};
            for (let name in obj) {
                res[name] = DataEncoder.encode(obj[name]);
            }
            return res;
        }
        return obj;
    }
    
    static decode<T>(obj: T): T {
        if (typeof(obj) == "object") {
            if (obj == null) {
                return obj;
            }
            if (Array.isArray(obj)) {
                let res: any[] = [];
                for (let x of obj) {
                    res.push(DataEncoder.decode(x));
                }
                return <any>res;
            }
            if (typeof((<any>obj).toArrayBuffer) == "function") {
                return <any>new Uint8Array((<any>obj).toArrayBuffer());
            }
            let res: any = {};
            for (let name in obj) {
                res[name] = DataEncoder.decode(obj[name]);
            }
            return res;
        }
        return obj;
    }
}