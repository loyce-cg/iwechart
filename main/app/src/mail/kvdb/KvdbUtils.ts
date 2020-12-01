import * as privfs from "privfs-client";

export interface KvdbSettingEntry extends privfs.types.db.KvdbEntry {
    secured: {
        key?: string;
        value: string;
    }
}

export class KvdbUtils {
    
    static createKvdbSettingEntry(value: string): KvdbSettingEntry {
        let entry: KvdbSettingEntry = {
            secured: {
                value: value
            }
        };
        return entry;
    }
}