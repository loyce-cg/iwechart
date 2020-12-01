import { mail } from "../Types";
import * as Q from "q";
import {service as CryptoService} from "privmx-crypto";
import { KvdbMap } from "./kvdb/KvdbMap";

export class TagProvider implements mail.TagProvider {
    
    constructor(
        public kvdb: KvdbMap<string>
    ) {
    }
    
    getTag(tagName: string): Q.Promise<string> {
        return Q().then(() => {
            let entry = this.kvdb.get(tagName);
            if (entry != null) {
                return entry;
            }
            let value = CryptoService.randomBytes(32).toString("hex");
            return this.kvdb.set(tagName, value).thenResolve(value);
        });
    }
}