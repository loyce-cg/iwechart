import * as Q from "q";
import * as privfs from "privfs-client";
import * as RootLogger from "simplito-logger";
import {utils} from "../Types";
let Logger = RootLogger.get("privfs-mail-client.utils.EncryptedPromiseMap");

export class EncryptedStorage implements utils.IStorage {
    
    encKey: Buffer;
    keyHashMap: {[key: string]: string};
    map: utils.Storage<string, string>;
    
    constructor(encKey: Buffer, map: utils.Storage<string, string>) {
        this.encKey = encKey;
        this.keyHashMap = {};
        this.map = map;
    }
    
    reset(): Q.Promise<void> {
        return Q().then(() => {
            this.encKey = null;
            this.keyHashMap = {};
        });
    }
    
    hashKey(key: string): Q.Promise<string> {
        return Q().then(() => {
            if (key in this.keyHashMap) {
                return this.keyHashMap[key];
            }
            let buffer = new Buffer(key, "utf8");
            return privfs.crypto.service.hmacSha256(this.encKey, buffer)
            .then(hash => {
                let binary = hash.toString("binary");
                this.keyHashMap[key] = binary;
                return binary;
            });
        });
    }
    
    get<T = any>(key: string): Q.Promise<T> {
        Logger.debug("get", key);
        return this.hashKey(key)
        .then(hash => {
            return this.map.getItem(hash);
        })
        .then(value => {
            if (!value) {
                return null;
            }
            if (this.encKey == null) {
                throw new Error("Cannot decrypt! Encryption key is not present");
            }
            let buffer = new Buffer(value, "binary");
            return privfs.crypto.service.ctDecrypt(buffer, this.encKey)
            .then(decrypted => {
                let item = JSON.parse(decrypted.toString("utf8"));
                Logger.debug("get result", key, item);
                return item;
            });
        });
    }
    
    set<T = any>(key: string, item: T): Q.Promise<void> {
        Logger.debug("set", key, item);
        return this.hashKey(key)
        .then(hash => {
            if (this.encKey == null) {
                throw new Error("Cannot encrypt! Encryption key is not present");
            }
            let buffer = new Buffer(JSON.stringify(item), "utf8");
            return privfs.crypto.service.ctAes256CbcPkcs7WithRandomIv(buffer, this.encKey)
            .then(encrypted => {
                return this.map.setItem(hash, encrypted.toString("binary"));
            });
        });
    }
    
    remove(key: string): Q.Promise<void> {
        Logger.debug("remove", key);
        return this.hashKey(key)
        .then(hash => {
            return this.map.removeItem(hash);
        });
    }
}
