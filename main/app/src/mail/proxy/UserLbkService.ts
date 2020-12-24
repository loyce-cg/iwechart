import * as privfs from "privfs-client";
import * as Q from "q";
import { RemoteServerApi } from "./RemoteServerApi";
import { AdminApi } from "./AdminApi";

export class UserLbkService {
    
    gateway: privfs.gateway.RpcGateway;
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure
    ) {
        this.gateway = srpSecure.gateway;
    }
    
    fetchKeyAndSetUserLbk(host: string, encryptedLbk: Buffer, remoteUsername: string, localUsername: string) {
        return Q().then(() => {
            return new RemoteServerApi(this.srpSecure, host).getUserInfo(remoteUsername);
        })
        .then(info => {
            return this.setUserLbkCore(host, encryptedLbk, info.key.toBase58DER(), localUsername);
        });
    }
    
    setUserLbkCore(host: string, encryptedLbk: Buffer, remoteUserPub58: string, localUsername: string) {
        return new AdminApi(this.gateway).setUserLbk({
            data: encryptedLbk.toString("base64"),
            loginByProxy: host,
            pub: remoteUserPub58,
            username: localUsername
        });
    }
    
    static encryptedLbkFromRegisterData(masterRecordL1Key: Buffer, lbkDataKey: Buffer): Q.Promise<Buffer> {
        return UserLbkService.encryptedLbk(masterRecordL1Key, lbkDataKey)
    }
    
    static encryptedLbk(lPrivDataKey: Buffer, lbkDataKey: Buffer): Q.Promise<Buffer> {
        return privfs.crypto.service.privmxEncrypt(privfs.crypto.service.privmxOptAesWithSignature(), lPrivDataKey, lbkDataKey);
    }
}
