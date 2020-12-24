import * as privfs from "privfs-client";
import * as Q from "q";
import {mail} from "../../Types";
import { AdminDataCreatorService } from "../admin/AdminDataCreatorService";
import { PrivmxRegistry } from "../PrivmxRegistry";
import { UserLbkService } from "./UserLbkService";
import { Lang } from "../../utils/Lang";

export class UserLbkAlterService {
    constructor(
        public adminDataCreatorService: AdminDataCreatorService,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public identity: privfs.identity.Identity
    ) {
    }
    
    static create(privmxRegistry: PrivmxRegistry) {
        return Q.all([
            privmxRegistry.getAdminDataCreatorService(),
            privmxRegistry.getSrpSecure(),
            privmxRegistry.getIdentity()
        ]).then(res => {
            return new UserLbkAlterService(res[0], res[1], res[2]);
        });
    }
    
    loginToUserAndSetLbk(localUsername: string, remoteUsername: string, remoteHost: string) {
        return Q().then(() => {
            return this.srpSecure.getUser(localUsername);
        })
        .then(user => {
            if (!user.adminData) {
                throw new Error("Admin cannot login to user without adminData");
            }
            return this.adminDataCreatorService.decryptAdminData(localUsername, user.adminData);
        })
        .then(adminData => {
            let recoveryEntropy = new Buffer((<mail.AdminDataManagable>adminData).recovery, "base64");
            let unregisteredSession: string;
            return Q().then(() => {
                return this.adminDataCreatorService.createUnregisterSessionSignature(this.identity, localUsername);
            })
            .then(us => {
                unregisteredSession = us;
                return privfs.core.PrivFsRpcManager.getHttpGatewayByHost({host: this.identity.host});
            })
            .then(gateway => {
                gateway.properties = Lang.shallowCopy(gateway.properties);
                gateway.properties.unregisteredSession = unregisteredSession;
                const bip39Authorizer = new privfs.core.login.Bip39Authorizer(gateway);
                return bip39Authorizer.loginByRecovery(recoveryEntropy);
            });
        })
        .then(masterRecord => {
            let lbkDataKey: Buffer;
            return Q().then(() => {
                lbkDataKey = privfs.crypto.service.randomBytes(32);
                return UserLbkService.encryptedLbk(masterRecord.l1Key, lbkDataKey);
            })
            .then(encryptedLbk => {
                return new UserLbkService(this.srpSecure).fetchKeyAndSetUserLbk(remoteHost, encryptedLbk, remoteUsername, localUsername);
            })
            .then(() => {
                return lbkDataKey;
            });
        });
    }
}
