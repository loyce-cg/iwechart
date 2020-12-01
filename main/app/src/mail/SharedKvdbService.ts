import * as Q from "q";
import {utils} from "../Types";
import {KvdbSettingEntry} from "./kvdb/KvdbUtils";

export class SharedKvdbService {
    
    constructor(
        public sharedKvdb: utils.IKeyValueDb<KvdbSettingEntry>
    ) {
    }
    
    getFromSharedKvdb(key: string): Q.Promise<string> {
        return Q().then(() => {
            return this.sharedKvdb.get(key);
        })
        .then(entry => {
            return entry ? entry.secured.value : null;
        });
    }
}