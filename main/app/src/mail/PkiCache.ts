import * as Q from "q";
import { KvdbMap } from "./kvdb/KvdbMap";
import * as privfs from "privfs-client";

export class PkiCache {
    
    kvdb: KvdbMap<any>;
    encoder: privfs.pki.StaticPair;
    
    constructor(kvdb: KvdbMap<any>) {
        this.kvdb = kvdb;
        this.encoder = new privfs.pki.StaticPair();
    }
    
    load(key: string): Q.Promise<any> {
        return Q().then(() => {
            let value = this.kvdb.get(key);
            if (value == null) {
                return null;
            }
            let decoded = this.encoder.decode(new Buffer(value, "base64"));
            return decoded;
        });
    }
    
    save(key: string, data: any): Q.Promise<boolean> {
        return Q().then(() => {
            let raw = new Buffer(this.encoder.encode(data).toBinary(), "binary").toString("base64");
            return this.kvdb.set(key, raw).thenResolve(true);
        });
    }
}

