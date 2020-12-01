import {SinkIndexEntry} from "./SinkIndexEntry";
import {MessageFlagsUpdater} from "./MessageFlagsUpdater";
import * as privfs from "privfs-client";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.PkiEventHandler");

export class PkiEventHandler {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public messageFlagsUpdater: MessageFlagsUpdater
    ) {
    }
    
    handlePkiEvent(entry: SinkIndexEntry): Q.Promise<void> {
        return Q().then(() => {
            if (entry.source.data.type !== "pki-event") {
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
            Logger.debug("pki event", event);
            let promise: Q.Promise<privfs.types.core.Cosigners>;
            switch (event.type) {
                case "invite": {
                    let data = {
                        state: "INVITED",
                        uuid: event.uuid,
                        hashmail: event.hashmail,
                        keystore: privfs.pki.Helper.decodeKeystore(event.keystore)
                    };
                    let domain = event.hashmail.split("#")[1];
                    promise = this.srpSecure.setCosigner(domain, data);
                    break;
                }
                case "accepted": {
                    promise = this.srpSecure.getCosigners()
                    .then(cosigners => {
                        for (var domain in cosigners) {
                            let cosigner = cosigners[domain];
                            if (cosigner.uuid === event.uuid && cosigner.state !== "ACTIVE") {
                                return this.srpSecure.setCosigner(domain, {
                                    state: "ACTIVE",
                                    hashmail: cosigner.hashmail,
                                    keystore: cosigner.keystore,
                                    uuid: cosigner.uuid
                                });
                            }
                        }
                    });
                    break;
                }
                case "removed": {
                    promise = this.srpSecure.getCosigners()
                    .then(cosigners => {
                        for (let domain in cosigners) {
                            if (cosigners[domain].uuid === event.uuid) {
                                return this.srpSecure.removeCosigner(domain, event.uuid);
                            }
                        }
                    });
                    break;
                }
                default:
                    Logger.warn("Unexpected pki event type", event);
            }
            if (promise !== null) {
                return promise
                .then(() => {
                    return this.messageFlagsUpdater.updateMessageFlag(entry, "processed", true);
                });
            }
            return this.messageFlagsUpdater.updateMessageFlag(entry, "processed", true);
        })
        .fail(e => {
            Logger.error("Error during processing pki-event", e);
        });
    }
}