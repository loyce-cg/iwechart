import * as privfs from "privfs-client";
import * as Q from "q";
import {mail, app} from "../../Types";

export class AdminDataCreatorService {
    
    constructor(
        public adminKey: privfs.crypto.ecc.ExtKey,
        public srpSecure: privfs.core.PrivFsSrpSecure
    ) {
    }
    
    getAdminKeyForUser(username: string) {
        return Q().then(() => {
            let keyData = Buffer.concat([this.adminKey.getChainCode(), new Buffer(username, "utf8")]);
            return privfs.crypto.service.sha256(keyData);
        });
    }
    
    setAdminData(username: string, adminData: mail.AdminData) {
        return Q().then(() => {
            return this.encryptAdminData(username, adminData);
        })
        .then(cipher => {
            // return this.srpSecure.request("modifyUser", {
            //     username: username,
            //     properties: {
            //         adminData: cipher.toString("base64"),
            //         generatedPassword: true
            //     }
            // });

            return this.srpSecure.modifyUser(username, {
                    adminData: cipher.toString("base64"),
                    generatedPassword: true
            })
        })
    }
    
    encryptAdminData(username: string, adminData: mail.AdminData) {
        return Q().then(() => {
            return this.getAdminKeyForUser(username);
        })
        .then(encKey => {
            let data = new Buffer(JSON.stringify(adminData), "utf8");
            return privfs.crypto.service.privmxEncrypt(privfs.crypto.service.privmxOptAesWithSignature(), data, encKey)
        })
    }
    
    decryptAdminData(username: string, adminData: string) {
        return Q().then(() => {
            return this.getAdminKeyForUser(username);
        })
        .then(encKey => {
            return privfs.crypto.service.privmxDecrypt(new Buffer(adminData, "base64"), encKey)
        })
        .then(buf => {
            return <mail.AdminData>JSON.parse(buf.toString("utf8"));
        })
    }
    
    encryptSharedKeyInAdminDataForUser(sharedDbExtKey: privfs.crypto.ecc.ExtKey): Q.Promise<app.AdminDataForUserEncryptResult> {
        let model: app.AdminDataForUserCore = {sharedDb: sharedDbExtKey.getPrivatePartAsBase58()}
        return this.encryptAdminDataForUser(model);
    }
    
    encryptAdminDataForUser(adminDataForUser: any): Q.Promise<app.AdminDataForUserEncryptResult> {
        let key1: string, key2: string
        return Q().then(() => {
            key1 = privfs.crypto.service.randomBytes(16).toString("hex");
            key2 = privfs.crypto.service.randomBytes(16).toString("hex");
            let res = new Buffer(key1 + key2, "utf8");
            return privfs.crypto.service.sha256(res);
        })
        .then(aesKey => {
            let plainText = new Buffer(JSON.stringify(adminDataForUser), "utf8");
            return privfs.crypto.service.privmxEncrypt(privfs.crypto.service.privmxOptAesWithSignature(), plainText, aesKey);
        })
        .then(cipher => {
            let res: app.AdminDataForUser = {
                key: key2,
                cipher: cipher.toString("base64")
            };
            return {
                serverData: JSON.stringify(res),
                key: key1
            }
        });
    }
    
    createUnregisterSessionSignature(identity: privfs.identity.Identity, forUsername: string): Q.Promise<string> {
        return Q().then(() => {
            let nonce = privfs.crypto.service.randomBytes(32).toString("base64");
            let timestamp = new Date().getTime().toString();
            let dataStr = "unregisteredSession;" + identity.user + ";" + forUsername + ";" + nonce + ";" + timestamp;
            return privfs.crypto.service.signToCompactSignatureWithHash(identity.priv, Buffer.from(dataStr, "utf8")).then(signature => {
                return dataStr + ";" + identity.pub58 + ";" + signature.toString("base64");
            });
        });
    }
}