import * as privfs from "privfs-client";
import * as Q from "q";
import {EventDispatcher} from "../../utils/EventDispatcher";
import {event} from "../../Types";

export class AdminKeyHolder {
    
    adminKey: privfs.crypto.ecc.ExtKey;
    
    constructor(
        public authData: privfs.types.core.UserDataEx,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public eventDispatcher: EventDispatcher
    ) {
    }
    
    setAdminKey(adminKey: privfs.crypto.ecc.ExtKey) {
        this.adminKey = adminKey;
        this.eventDispatcher.dispatchEvent<event.GrantAccessToAdminKeyEvent>({
            type: "grantaccesstoadminkey"
        });
    }
    
    saveAdminKey(extKey: privfs.crypto.ecc.ExtKey): Q.Promise<void> {
        if (this.adminKey) {
            return Q();
        }
        return Q().then(() => {
            this.authData.masterRecordLevel2.data.adminKey = extKey.getPrivatePartAsBase58();
            return this.srpSecure.setMasterRecordLevel2(this.authData.masterRecordLevel2.key, this.authData.masterRecordLevel2.data);
        })
        .then(() => {
            this.setAdminKey(extKey);
        });
    }
}