import * as privfs from "privfs-client";
import * as Q from "q";
import {UserSettingsService} from "../UserSettingsService";
import {app} from "../../Types";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.admin.AdminDataReceiverService");

export class AdminDataReceiverService {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public userSettingsService: UserSettingsService
    ) {
    }
    
    processAdminDataForUser(registerKey: string): Q.Promise<void> {
        if (!registerKey) {
            return Q();
        }
        return Q().then(() => {
            return this.srpSecure.request<{data: string}>("getAdminDataForUser", {});
        })
        .then(result => {
            if (!result || !result.data) {
                return;
            }
            let info = <app.AdminDataForUser>JSON.parse(result.data);
            return Q().then(() => {
                let res = new Buffer(registerKey + info.key, "utf8");
                return privfs.crypto.service.sha256(res);
            })
            .then(aesKey => {
                let cipher = new Buffer(info.cipher, "base64");
                return privfs.crypto.service.privmxDecrypt(cipher, aesKey);
            })
            .then(plainText => {
                let decoded = <app.AdminDataForUserCore>JSON.parse(plainText.toString("utf8"));
                if (!decoded && !decoded.sharedDb) {
                    return;
                }
                return this.userSettingsService.saveSharedKvdbKeyInUserSpace(privfs.crypto.ecc.ExtKey.fromBase58(decoded.sharedDb));
            })
            .then(() => {
                return this.srpSecure.request("clearAdminDataForUser", {});
            });
        })
        .fail(e => {
            Logger.error("Error during processing admin data for user", e);
        });
    }
}