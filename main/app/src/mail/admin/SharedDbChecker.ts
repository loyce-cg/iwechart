import * as Q from "q";
import * as privfs from "privfs-client";
import {utils} from "../../Types";
import {KvdbSettingEntry} from "../kvdb/KvdbUtils";
import {SharedDbAdminService} from "./SharedDbAdminService";
import {MailConst} from "../MailConst";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.admin.SharedDbChecker");

export class SharedDbChecker {
    
    constructor(
        public sharedKvdb: utils.IKeyValueDb<KvdbSettingEntry>,
        public authData: privfs.types.core.UserDataEx,
        public adminKvdb: utils.IKeyValueDb<KvdbSettingEntry>,
        public messageManager: privfs.message.MessageManager,
        public sharedDbAdminService: SharedDbAdminService,
        public identityProvider: utils.IdentityProvider
    ) {
    }
    
    checkSharedDb() {
        if (!this.identityProvider.isAdmin()) {
            return Q();
        }
        let publicSectionsKey: KvdbSettingEntry;
        return Q().then(() => {
            return Q.all([
                this.sharedKvdb.opt(MailConst.ADMIN_SINK_KEY, null),
                this.sharedKvdb.opt(MailConst.PUBLIC_SECTIONS_KEY, null)
            ]);
        })
        .then(res => {
            let pub58 = res[0];
            publicSectionsKey = res[1];
            if (pub58) {
                return;
            }
            return Q().then(() => {
                return this.adminKvdb.opt(MailConst.ADMIN_SINK_KEY, null);
            })
            .then(sinkWif => {
                if (sinkWif) {
                    let sink = privfs.message.MessageSinkPriv.fromSerialized(sinkWif.secured.value, "", "", "public", null, null);
                    return sink.pub58;
                }
                let sink = new privfs.message.MessageSinkPriv(privfs.crypto.serviceSync.eccPrivRandom(), "", "", "public", null, {
                    acl: {
                        manage: "<admin>",
                        create: "<admin>",
                        delete: "<admin>",
                        modify: "<admin>",
                        post: "<local>",
                        read: "<admin>"
                    }
                });
                return Q().then(() => {
                    return this.messageManager.storage.sinkCreate(sink.id, "public", "", sink.options);
                })
                .then(() => {
                    return this.adminKvdb.set(MailConst.ADMIN_SINK_KEY, {secured: {value: sink.privWif}});
                })
                .then(() => {
                    return sink.pub58;
                });
            })
            .then(pub58 => {
                return this.sharedKvdb.set(MailConst.ADMIN_SINK_KEY, {secured: {value: pub58}});
            });
        })
        .then(() => {
            if (publicSectionsKey) {
                return;
            }
            return Q().then(() => {
                return this.adminKvdb.opt(MailConst.PUBLIC_SECTIONS_KEY, null);
            })
            .then(sKey => {
                let key = sKey ? privfs.crypto.ecc.ExtKey.fromBase58(sKey.secured.value) : privfs.crypto.serviceSync.eccExtRandom();
                return Q.all([
                    sKey ? Q() : this.adminKvdb.set(MailConst.PUBLIC_SECTIONS_KEY, {secured: {value: key.getPrivatePartAsBase58()}}),
                    this.sharedKvdb.set(MailConst.PUBLIC_SECTIONS_KEY, {secured: {value: key.getPublicPartAsBase58()}})
                ]);
            });
        })
        .then(() => {
            if (!this.sharedKvdb.newlyCreated) {
                return;
            }
            this.sharedDbAdminService.sendSharedDbKeyToAllUsers().fail(e => {
                Logger.error("Error during sending shared kvdb key to users", e);
            });
        });
    }
}