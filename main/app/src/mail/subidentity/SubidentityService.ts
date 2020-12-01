import * as privfs from "privfs-client";
import * as Q from "q";
import {PromiseUtils} from "simplito-promise";
import {Lang} from "../../utils/Lang";
import {subidentity, section} from "../../Types";
import {SubidentityApi} from "./SubidentityApi";

export class SubidentityService {
     
    constructor(public subidentityApi: SubidentityApi, public encKey: Buffer) {
    }
    
    getSubidentities(): Q.Promise<subidentity.SubidentitiesPriv> {
        return Q().then(() => {
            return this.subidentityApi.getSubidentities();
        })
        .then(subidentities => {
            let result: subidentity.SubidentitiesPriv = {};
            return PromiseUtils.oneByOne(subidentities, (pub, data) => {
                return Q().then(() => {
                    return privfs.crypto.service.privmxDecrypt(privfs.crypto.service.privmxOptSignedCipher(), Buffer.from(data.priv, "base64"), this.encKey);
                })
                .then(dec => {
                    result[pub] = <subidentity.SubidentyPrivDataEx>JSON.parse(dec.toString("utf8"));
                    result[pub].createDate = data.createDate;
                    result[pub].deviceId = data.deviceId;
                    result[pub].deviceName = data.deviceName;
                    result[pub].deviceIdRequired = data.deviceIdRequired;
                    result[pub].deviceAssigmentDate = data.deviceAssigmentDate;
                    result[pub].lastLoginDate = data.lastLoginDate;
                    result[pub].acl = data.acl;
                });
            })
            .thenResolve(result);
        })
    }
    
    createSubidentity(data: subidentity.SubidentyData, groupId: string): Q.Promise<privfs.crypto.crypto.Interfaces.Bip39> {
        return Q().then(() => {
            return privfs.crypto.service.bip39Generate(256);
        })
        .then(bip39 => {
            return this.setSubidentity(bip39, data, groupId).thenResolve(bip39);
        });
    }
    
    updateSubidentity(recovery: Buffer|string, data: subidentity.SubidentyData, groupId: string): Q.Promise<void> {
        return Q().then(() => {
            return typeof(recovery) == "string" ? privfs.crypto.service.bip39FromMnemonic(<string>recovery) : privfs.crypto.service.bip39FromEntropy(<Buffer>recovery);
        })
        .then(bip39 => {
            return this.setSubidentity(bip39, data, groupId);
        });
    }
    
    updateSubidentityKey(sub: subidentity.SubidentyPrivDataEx, key: section.SectionKey): Q.Promise<void> {
        return this.updateSubidentity(sub.bip39Mnemonic, {
            identity: sub.identity,
            pubKey: sub.pubKey,
            sectionId: sub.sectionId,
            sectionKeyId: key.keyId,
            sectionKey: key.key.toString("base64")
        }, sub.acl.group)
    }
    
    setSubidentity(bip39: privfs.crypto.crypto.Interfaces.Bip39, data: subidentity.SubidentyData, groupId: string): Q.Promise<void> {
        let key: Buffer;
        return Q().then(() => {
            key = privfs.crypto.service.randomBytes(16);
            return privfs.crypto.service.sha256(Buffer.concat([bip39.extKey.getChainCode(), key]));
        })
        .then(dataKey => {
            let opts = privfs.crypto.service.privmxOptAesWithSignature();
            let privData = <subidentity.SubidentyPrivData>Lang.shallowCopy(data);
            privData.bip39Mnemonic = bip39.mnemonic;
            return Q.all([
                privfs.crypto.service.privmxEncrypt(opts, Buffer.from(JSON.stringify(data), "utf8"), dataKey),
                privfs.crypto.service.privmxEncrypt(opts, Buffer.from(JSON.stringify(privData), "utf8"), this.encKey)
            ]);
        })
        .then(res => {
            return this.subidentityApi.setSubidentity(bip39.extKey.getPublicKey().toBase58DER(), {
                data: res[0].toString("base64"),
                priv: res[1].toString("base64"),
                key: key.toString("base64"),
                deviceIdRequired: true,
                acl: {
                    group: groupId
                }
            });
        });
    }
    
    removeSubidentity(pub58: string): Q.Promise<void> {
        return this.subidentityApi.removeSubidentity(pub58);
    }
}