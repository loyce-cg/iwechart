import * as privfs from "privfs-client";
import * as Q from "q";

export class RemoteLoginService {
    constructor(
        public privFsKeyLogin: privfs.core.PrivFsKeyLogin
    ) {
    }
    
    login(priv: privfs.crypto.ecc.PrivateKey, lbkDataKey: Buffer, defaultPKI: boolean) {
        return Q().then(() => {
            return this.loginStep1(priv, lbkDataKey, defaultPKI);
        })
        .then(info => {
            return this.privFsKeyLogin.loginStep2(info);
        })
        .then(info => {
            return this.privFsKeyLogin.loginStep3(info);
        })
        .then(result => {
            return privfs.core.PrivFsSrpEx.loginLastStep(result.srpSecure, result.privDataInfo.privData, this.privFsKeyLogin.identityIndex);
        });
    }
    
    loginStep1(priv: privfs.crypto.ecc.PrivateKey, lbkDataKey: Buffer, defaultPKI: boolean): Q.Promise<privfs.types.core.BasicLoginResult> {
        return Q().then(() => {
            return this.privFsKeyLogin.rpcGateway.rpc.keyHandshake(priv, this.privFsKeyLogin.rpcGateway.properties);
        })
        .then(() => {
            let privmxPKI = defaultPKI === false ? null : this.privFsKeyLogin.privFsSrp.createDefaultPki();
            let srpSecure = new privfs.core.PrivFsSrpSecure(this.privFsKeyLogin.rpcGateway, this.privFsKeyLogin.privFsSrp, privmxPKI);
            return {
                srpSecure: srpSecure,
                dataKey: lbkDataKey
            };
        });
    }
}