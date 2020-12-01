import * as privfs from "privfs-client";
import * as Q from "q";
import {MessageService} from "../MessageService";
import {AdminKeyHolder} from "./AdminKeyHolder";

export class AdminKeySender {
    
    constructor(
        public messageService: MessageService,
        public adminKeyHolder: AdminKeyHolder,
        public identity: privfs.identity.Identity
    ) {
    }
    
    sendAdminKey(username: string): Q.Promise<privfs.types.message.ReceiverData[]> {
        return Q().then(() => {
            if (this.adminKeyHolder.adminKey == null) {
                throw new Error("Admin key is not present");
            }
            let data = {
                type: "grant-admin-key",
                extKey: this.adminKeyHolder.adminKey.getPrivatePartAsBase58()
            };
            return this.messageService.sendSimpleMessage2(username + "#" + this.identity.host, "You granted access to admin group", JSON.stringify(data), "admin-msg");
        });
    }
}