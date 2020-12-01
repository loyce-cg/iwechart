import * as Q from "q";
import * as RootLogger from "simplito-logger";
import * as privfs from "privfs-client";
import {PromiseUtils} from "simplito-promise";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {MessageFlagsUpdater} from "./MessageFlagsUpdater";
import {ContactService} from "./contact/ContactService";
import {mail} from "../Types";
let Logger = RootLogger.get("privfs-mail-client.mail.MessageSenderVierfier");
let VerifyStatus = SinkIndexEntry.VerifyStatus;

export interface VerifyResult {
    anonymous?: boolean;
    low?: boolean;
    fetch?: privfs.pki.Types.pki.KeyStoreEntry;
    verified: {
        status: number;
        fetchId: string;
    }
    error?: any;
}

export class MessageSenderVerifier {
    
    queue: SinkIndexEntry[];
    isRunning: boolean;
    destroyed: boolean;
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public messageFlagsUpdater: MessageFlagsUpdater,
        public lowUserProvider: mail.LowUserProvider,
        public contactService: ContactService
    ) {
        this.queue = [];
        this.isRunning = false;
    }
    
    destroy(): void {
        this.destroyed = true;
        this.queue = [];
        this.isRunning = false;
    }
    
    getVerifyInfo(indexEntry: SinkIndexEntry): Q.Promise<privfs.pki.Types.pki.KeyStoreEntry> {
        return Q().then(() => {
            if (indexEntry.hasSavedVerifiedInformation()) {
                return this.srpSecure.getKeyStoreFetch(indexEntry.data.verified.fetchId);
            }
            return indexEntry.verified ? indexEntry.verified.fetch : null;
        });
    }
    
    verify(indexEntry: SinkIndexEntry): void {
        if (this.destroyed) {
            throw new Error("Cannot use destroyed instance");
        }
        if (!indexEntry.needToRefreshVerified()) {
            return;
        }
        Logger.debug("Updating verified flag for", indexEntry.id, indexEntry);
        this.queue.push(indexEntry);
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        PromiseUtils.queue(this.queue, indexEntry => {
            if (!indexEntry.needToRefreshVerified()) {
                return;
            }
            return Q().then(() => {
                return this.verifyMessageCore(indexEntry);
            })
            .then(data => {
                if (this.destroyed) {
                    return;
                }
                if (data.error || !SinkIndexEntry.isStatusValidToSave(data.verified.status)) {
                    indexEntry.verified = {status: data.verified.status, fetch: data.fetch};
                    return;
                 }
                Logger.debug("Saving verified flag for", indexEntry.id, data.verified, indexEntry);
                if (data.verified.status == VerifyStatus.OK) {
                    this.contactService.addSenderToContacts(indexEntry, true, false);
                }
                return this.messageFlagsUpdater.updateMessageFlag(indexEntry, "verified", data.verified)
                .fail(e => {
                    Logger.error("Cannot save verfied flag", e);
                });
            })
            .fail(e => {
                Logger.error("Unexpected error during processing", indexEntry.id, indexEntry, e);
            });
        })
        .fail(e => {
            Logger.error("Unexpected error", e);
        }).fin(() => {
            this.isRunning = false;
        });
    }
    
    verifyMessageCore(indexEntry: SinkIndexEntry, forceRefresh?: boolean): Q.Promise<VerifyResult> {
        let message = indexEntry.getMessage();
        return this.verifyMessageCore2(message.sender, message.serverDate, forceRefresh);
    }
    
    verifyMessageCore2(sender: privfs.identity.User, serverDate: Date, forceRefresh?: boolean): Q.Promise<VerifyResult> {
        if (sender.user == "anonymous" || this.lowUserProvider.isLowUser(sender)) {
            return Q({
                anonymous: true,
                verified: {
                    status: VerifyStatus.OK,
                    fetchId: ""
                }
            });
        }
        return Q().then(() => {
            return this.srpSecure.privmxPKI.getKeyStore(this.srpSecure.getUserKeystoreName(sender.user, sender.host), {
                pkiOptions: {
                    domain: sender.host
                },
                cacheLoad: forceRefresh !== true
            })
            .fail(function(e) {
                if (e && e.errorType == "invalid-tree-signature") {
                    e.pkiResult.error = true;
                    return e.pkiResult;
                }
                if (e && e.errorType == "invalid-server-keystore") {
                    e.result.error = true;
                    e.result.errorType = "invalid-server-keystore";
                    return e.result;
                }
                return Q.reject(e);
            });
        })
        .then((data:privfs.pki.Types.pki.KeyStoreEntry&{errorType?: string, error?: boolean})  => {
            let status = null;
            if (data.errorType == "invalid-server-keystore") {
                status = VerifyStatus.INVALID_SERVER_KEYSTORE;
            }
            else if (data.result.status == 0) {
                if (data.keystore == null) {
                    status = VerifyStatus.KEY_DOESNT_EXISTS;
                }
                else {
                    let time = serverDate ? Math.floor(serverDate.getTime() / 1000) : 0;
                    let key = this.srpSecure.getPrimaryKeyFromKeystoreAtTime(<privfs.pki.Types.keystore.IKeyStore2>data.keystore, time);
                    status = key.toBase58DER() == sender.pub58 ? VerifyStatus.OK : VerifyStatus.INVALID_KEY;
                }
            }
            else if (data.result.status == 1) {
                status = VerifyStatus.INVALID_SIGNATURE;
            }
            else if (data.result.status == 2) {
                status = VerifyStatus.INVALID_NET_STATE;
            }
            else if (data.result.status == 3) {
                status = VerifyStatus.NO_QUORUM;
            }
            return {
                fetch: data,
                verified: {
                    status: status,
                    fetchId: data.fetchId
                },
                error: data.error
            };
        });
    }
    
    renewMessageVerify(indexEntry: SinkIndexEntry, forceRefresh?: boolean): Q.Promise<VerifyResult> {
        return Q().then(() => {
            return this.verifyMessageCore(indexEntry, forceRefresh);
        })
        .then(data => {
            var verified = data.verified;
            if (data.error || !SinkIndexEntry.isStatusValidToSave(data.verified.status)) {
                indexEntry.verified = {status: data.verified.status, fetch: data.fetch};
                verified = null;
            }
            return this.messageFlagsUpdater.updateMessageFlag(indexEntry, "verified", verified).thenResolve(data);
        });
    }
    
    scheduleRetry(indexEntry: SinkIndexEntry): void {
        let delay = 30 * 1000;
        let verifier = this;
        if (verifier.destroyed) {
            return;
        }
        setTimeout(() => {
            if (verifier.destroyed) {
                return;
            }
            verifier.verify(indexEntry);
        }, delay);
    }
}
