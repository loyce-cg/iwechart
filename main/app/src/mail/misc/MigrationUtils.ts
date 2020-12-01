import * as privfs from "privfs-client";
import { KvdbMap } from "../kvdb/KvdbMap";
import * as Q from "q";

export class MigrationUtils {
    
    static getMapFromKeyValueFile(systemFs: privfs.fs.file.FileSystem, filePath: string) {
        return Q().then(() => {
            return systemFs.optRead(filePath);
        })
        .then(content => {
            if (content == null) {
                return null;
            }
            let map: {[key: string]: any};
            try {
                map = content.getJson();
            }
            catch (e) {
                return null;
            }
            if (typeof(map) != "object" || map == null) {
                return null;
            }
            return map;
        });
    }
    
    static migrateKeyValueFileToKvdbMap(fs: privfs.fs.file.FileSystem, filePath: string, kvdb: KvdbMap<any>) {
        return Q().then(() => {
            return MigrationUtils.getMapFromKeyValueFile(fs, filePath);
        })
        .then(map => {
            if (!map) {
                return false;
            }
            return kvdb.setMany(map).thenResolve(true);
        });
    }
}