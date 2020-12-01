import * as RootLogger from "simplito-logger";
import * as privfs from "privfs-client";
import * as Q from "q";
import { PromiseUtils } from "simplito-promise";
import { Utils } from "../utils/Utils";
import { MessageTagsFactory } from "./MessageTagsFactory";
import { MessageService } from "./MessageService";
import { HashmailResolver } from "./HashmailResolver";
import { LocaleService } from "./LocaleService";
let Logger = RootLogger.get("privfs-mail-client.mail.CosignerService");

export class CosignerService {
    
    trustedServers: privfs.pki.CosignersProvider.CosignersProvider;
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public identity: privfs.identity.Identity,
        public messageManager: privfs.message.MessageManager,
        public messageService: MessageService,
        public hashmailResolver: HashmailResolver,
        public localeService: LocaleService
    ) {
    }
    
    loadAllCosigners(): Q.Promise<{adminCosigners: privfs.types.core.Cosigners, pkiCosigners: privfs.types.core.KeyStoreMap}> {
        let pkiCosigners: privfs.types.core.KeyStoreMap;
        return Q.all([this.srpSecure.getCosigners(), this.srpSecure.getPublishedCosigners()
        .fail(e => {
            Logger.debug("Error during reading published cosigners", e, (e ? e.stack : null));
            return {};
        })])
        .then(result => {
            let notAddedDomains: {domain: string, keystore: privfs.pki.Types.keystore.IKeyStore2}[] = [];
            let adminCosigners = result[0];
            pkiCosigners = result[1];
            for (var domain in pkiCosigners) {
                if ((domain in adminCosigners)) {
                    if (adminCosigners[domain].state != "ACTIVE" && adminCosigners[domain].state != "DELETED") {
                        adminCosigners[domain].state = "ACTIVE";
                    }
                }
                else {
                    notAddedDomains.push({
                        domain: domain,
                        keystore: pkiCosigners[domain]
                    });
                }
            }
            return PromiseUtils.oneByOne(notAddedDomains, (_i, entry) => {
                return this.srpSecure.setCosigner(entry.domain, {
                    state: "ACTIVE",
                    uuid: Utils.generateUUID(),
                    hashmail: "unknown#" + entry.domain,
                    keystore: entry.keystore
                })
                .then(cosigners => {
                    adminCosigners = cosigners;
                });
            })
            .then(() => {
                return adminCosigners;
            });
        })
        .then(adminCosigners => {
            return {
                adminCosigners: adminCosigners,
                pkiCosigners: pkiCosigners
            };
        });
    }
    
    inviteCosigner(hashmail: string): Q.Promise<privfs.types.core.Cosigners> {
        let domain = hashmail.split("#")[1];
        return Q.all([
            this.srpSecure.privmxPKI.getServerKeyStore(),
            this.srpSecure.privmxPKI.getServerKeyStore({pkiOptions: {domain: domain}}),
            this.hashmailResolver.resolveHashmail(hashmail).fail(e => {
                return Q.reject<{data: privfs.types.core.UserInfo, receivers: privfs.message.MessageReceiver[]}>({
                    msg: "cannot-resolve-hasmail",
                    couse: e
                });
            })
        ])
        .then(results => {
            let localKeystore = results[0].keystore;
            let remoteKeystore = <privfs.pki.Types.keystore.IKeyStore2>results[1].keystore;
            let info = results[2];
            if (!info.receivers.length) {
                throw new Error("Cannot send message to " + hashmail);
            }
            let uuid = Utils.generateUUID();
            let data = {
                state: "PENDING",
                uuid: uuid,
                hashmail: hashmail,
                keystore: remoteKeystore
            };
            let message = this.messageService.createMessage(info.receivers[0], this.localeService.i18n("api.cosigners.invite.header"), JSON.stringify({
                hashmail: this.identity.hashmail,
                uuid: uuid,
                keystore: localKeystore.serialize().toString("base64"),
                content: this.localeService.i18n("api.cosigners.invite.content", [this.identity.hashmail]),
                type: "invite"
            }));
            message.setType("pki-event");
            return Q().then(() => {
                return this.srpSecure.setCosigner(domain, data);
            })
            .then(cosigners => {
                return Q().then(() => {
                    return this.messageManager.messagePost(message, MessageTagsFactory.getMessageTags(message));
                })
                .then((result: privfs.types.message.ReceiverData[]) => {
                    if (result.filter(x => !x.success).length > 0) {
                        throw result;
                    }
                    return cosigners;
                })
                .fail(error => {
                    return this.srpSecure.removeCosigner(domain, uuid)
                    .then(() => {
                        return Q.reject<privfs.types.core.Cosigners>(error);
                    });
                });
            });
        });
    }
    
    acceptCosigner(domain: string, cosigner: privfs.types.core.Cosigner): Q.Promise<privfs.types.core.Cosigners> {
        let data = {
            state: "ACTIVE",
            hashmail: cosigner.hashmail,
            uuid: cosigner.uuid,
            keystore: cosigner.keystore
        };
        return Q.all([
            this.hashmailResolver.resolveHashmail(cosigner.hashmail),
            this.srpSecure.setCosigner(domain, data)
        ])
        .then(res => {
            let [info, cos] = res;
            if (!info.receivers.length)
            throw new Error("Cannot send message to " + cosigner.hashmail);
            let message = this.messageService.createMessage(info.receivers[0], this.localeService.i18n("api.cosigners.accept.header"), JSON.stringify({
                uuid: cosigner.uuid,
                content: this.localeService.i18n("api.cosigners.accept.content", [this.identity.hashmail]),
                type: "accepted"
            }));
            message.setType("pki-event");
            return Q().then(() => {
                return this.messageManager.messagePost(message, MessageTagsFactory.getMessageTags(message));
            })
            .then((result: privfs.types.message.ReceiverData[]) => {
                if (result.filter(x => !x.success).length > 0) {
                    throw result;
                }
                return cos;
            });
        });
    }
    
    removeCosigner(domain: string, data: privfs.types.core.Cosigner): Q.Promise<privfs.types.core.Cosigners> {
        if (data.hashmail === "") {
            return this.srpSecure.removeCosigner(domain, data.uuid);
        }
        let mca = this;
        return Q().then(() => {
            return this.hashmailResolver.resolveHashmail(data.hashmail);
        })
        .then(info => {
            if (!info.receivers.length) {
                throw new Error("Cannot send message to " + data.hashmail);
            }
            let msg = "";
            if (data.state === "PENDING") {
                msg = mca.localeService.i18n("api.cosigners.canceled.content", [mca.identity.hashmail]);
            }
            else if (data.state === "INVITED") {
                msg = mca.localeService.i18n("api.cosigners.rejected.content", [mca.identity.hashmail]);
            }
            else {
                msg = mca.localeService.i18n("api.cosigners.removed.content", [mca.identity.hashmail]);
            }
            let message = mca.messageService.createMessage(info.receivers[0], mca.localeService.i18n("api.cosigners.removed.header"), JSON.stringify({
                uuid: data.uuid,
                content: msg,
                type: "removed"
            }));
            message.setType("pki-event");
            return Q().then(() => {
                return this.messageManager.messagePost(message, MessageTagsFactory.getMessageTags(message));
            })
            .then((result: privfs.types.message.ReceiverData[]) => {
                if (result.filter(x => !x.success).length > 0) {
                    throw result;
                }
            });
        })
        .fail(e => {
            Logger.error("Cannot send message about removing from web of trust", e, (e ? e.stack : null));
        })
        .then(() => {
            return mca.srpSecure.removeCosigner(domain, data.uuid);
        });
    }
}