import * as privfs from "privfs-client";
import * as Q from "q";
import {UserSettingsService} from "../UserSettingsService";
import {MessageService} from "../MessageService";

export class SharedDbAdminService {
    
    constructor(
        public identity: privfs.identity.Identity,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public userSettingsService: UserSettingsService,
        public messageService: MessageService,
        public sharedDbExtKey: privfs.crypto.ecc.ExtKey
    ) {
    }
    
    sendSharedDbKeyToAllUsers() {
        return Q().then(() => {
            return this.userSettingsService.saveSharedKvdbKeyInUserSpace(this.sharedDbExtKey);
        })
        .then(() => {
            return this.srpSecure.getUsers();
        })
        .then(users => {
            let promises: Q.Promise<any>[] = [];
            let serializedKey = this.sharedDbExtKey.getPrivatePartAsBase58();
            users.forEach(user => {
                if (user.username == this.identity.user || !user.activated) {
                    return;
                }
                promises.push(this.sendSharedDbKey(user.username, serializedKey));
            })
            return Q.all(promises);
        });
    }
    
    sendSharedDbKey(username: string, serializedKey: string) {
        return Q().then(() => {
            let data = {
                type: "grant-shared-db-key",
                extKey: serializedKey
            };
            return this.messageService.sendSimpleMessage2(username + "#" + this.identity.host, "You granted access to shared db", JSON.stringify(data), "admin-msg");
        });
    }
}