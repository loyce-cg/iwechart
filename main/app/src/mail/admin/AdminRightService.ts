import * as privfs from "privfs-client";
import { AdminKeySender } from "../../mail/admin/AdminKeySender";

export class AdminRightService {

    constructor(
        private srpSecure: privfs.core.PrivFsSrpSecure,
        private adminKeySender: AdminKeySender,
        private identity: privfs.identity.Identity
    ) {
    }
    
    async grantAdminRights(username: string, userIdentityKey: privfs.crypto.ecc.PrivateKey): Promise<void> {
        await this.srpSecure.changeIsAdmin(
            this.identity.priv,
            username,
            true,
            userIdentityKey.getPublicKey()
        );
        await this.adminKeySender.sendAdminKey(username);
    }
}
