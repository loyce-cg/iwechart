import * as privfs from "privfs-client";
import * as Q from "q";
import {AdminKeySender} from "./AdminKeySender";
import {AdminKeyHolder} from "./AdminKeyHolder";
import * as RootLogger from "simplito-logger";
import {utils} from "../../Types";
let Logger = RootLogger.get("privfs-mail-client.mail.admin.AdminKeyChecker");

export class AdminKeyChecker {
    
    constructor(
        public authData: privfs.types.core.UserDataEx,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public adminKeySender: AdminKeySender,
        public adminKeyHolder: AdminKeyHolder,
        public identityProvider: utils.IdentityProvider
    ) {
    }
    
    checkAdminKey(): Q.Promise<boolean> {
        if (!this.identityProvider.isAdmin()) {
            return Q(false);
        }
        return Q().then(() => {
            if (this.authData.privDataL2.data.adminKey) {
                this.adminKeyHolder.setAdminKey(privfs.crypto.ecc.ExtKey.fromBase58(this.authData.privDataL2.data.adminKey));
                return true;
            }
            return Q().then(() => {
                return this.srpSecure.request<boolean>("amIAdminKeyOwner", {});
            })
            .then(res => {
                if (!res) {
                    return false;
                }
                return Q().then(() => {
                    return this.adminKeyHolder.saveAdminKey(privfs.crypto.serviceSync.eccExtRandom());
                })
                .then(() => {
                    this.srpSecure.getUsers().then(users => {
                        let promises: Q.Promise<any>[] = [];
                        users.forEach(user => {
                            if (user.username == this.identityProvider.getIdentity().user || !user.isAdmin) {
                                return;
                            }
                            promises.push(this.adminKeySender.sendAdminKey(user.username));
                        })
                        return Q.all(promises);
                    })
                    .fail(e => {
                        Logger.error("Error during sending adminKey to other admins", e);
                    });
                    return true;
                });
            });
        });
    }
}