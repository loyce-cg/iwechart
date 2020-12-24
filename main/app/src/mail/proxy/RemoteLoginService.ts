import * as privfs from "privfs-client";

export class RemoteLoginService {
    
    constructor(
        public gateway: privfs.gateway.RpcGateway,
        public identityIndex: number
    ) {
    }
    
    async login(priv: privfs.crypto.ecc.PrivateKey, lbkDataKey: Buffer, defaultPKI: boolean): Promise<privfs.types.core.UserDataEx> {
        await this.gateway.rpc.keyHandshake(priv, this.gateway.properties);
        await this.gateway.checkAdditionalLoginStep();
        const model = await this.gateway.getMasterRecord();
        const decryptedMasterRecord = await privfs.core.MasterRecordUtils.decrypt(model, lbkDataKey, privfs.types.core.LoginMode.LBK);
        const srpSecure = privfs.core.PrivFsSrpSecure.create(this.gateway, defaultPKI);
        return privfs.core.LoginUtils.loginLastStep(srpSecure, decryptedMasterRecord.masterRecord, this.identityIndex);
    }
}