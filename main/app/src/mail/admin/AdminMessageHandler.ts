import * as privfs from "privfs-client";
import * as Q from "q";
import {UserSettingsService} from "../UserSettingsService";
import {MessageFlagsUpdater} from "../MessageFlagsUpdater";
import {AdminKeyHolder} from "./AdminKeyHolder";
import {SinkIndexEntry} from "../SinkIndexEntry";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.admin.AdminMessageHandler");

export class AdminMessageHandler {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public userSettingsService: UserSettingsService,
        public messageFlagsUpdater: MessageFlagsUpdater,
        public adminKeyHolder: AdminKeyHolder
    ) {
    }
    
    handleAdminMsg(entry: SinkIndexEntry): Q.Promise<void> {
        return Q().then(() => {
            if (entry.source.data.type !== "admin-msg") {
                return;
            }
            let event = entry.getContentAsJson();
            if (event === null) {
                return;
            }
            if (entry.isProcessed() || entry.proceeding) {
                return;
            }
            entry.proceeding = true;
            return Q().then(() => {
                return this.srpSecure.isAdminKey(entry.getMessage().sender.pub);
            })
            .then(msgFromAdmin => {
                if (!msgFromAdmin) {
                    return;
                }
                switch (event.type) {
                    case "grant-admin-key": {
                        return this.adminKeyHolder.saveAdminKey(privfs.crypto.ecc.ExtKey.fromBase58(event.extKey));
                    }
                    case "grant-shared-db-key": {
                        return this.userSettingsService.saveSharedKvdbKeyInUserSpace(privfs.crypto.ecc.ExtKey.fromBase58(event.extKey));
                    }
                }
            })
            .then(() => {
                return this.messageFlagsUpdater.updateMessageFlag(entry, "processed", true);
            });
        })
        .fail(e => {
            Logger.error("Error during processing admin-msg", e);
        });
    }
}