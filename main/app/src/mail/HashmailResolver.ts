import * as privfs from "privfs-client";
import * as Q from "q";
import {mail} from "../Types";
import {Exception} from "privmx-exception";

export class HashmailResolver {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public lowUserProvider: mail.LowUserProvider
    ) {
    }
    
    resolveHashmail(hashmail: privfs.identity.Hashmail|string, includeImage?: boolean): Q.Promise<{data: privfs.types.core.UserInfo, receivers: privfs.message.MessageReceiver[]}> {
        return Q().then(() => {
            hashmail = hashmail instanceof privfs.identity.Hashmail ? hashmail : new privfs.identity.Hashmail(hashmail);
            return this.srpSecure.getUserInfo(hashmail.user, hashmail.host, includeImage ? ["info", "image"] : ["info"])
            .then(data => {
                let receivers: privfs.message.MessageReceiver[] = [];
                if (data.profile.sinks != null) {
                    for (let i = 0; i < data.profile.sinks.length; i++) {
                        receivers.push(new privfs.message.MessageReceiver(data.profile.sinks[i], data.user));
                    }
                }
                return {
                    data: data,
                    receivers: receivers
                };
            });
        });
    }
    
    resolveHashmailEx(hashmail: privfs.identity.Hashmail|string, includeImage?: boolean): Q.Promise<{data: privfs.types.core.UserInfo, receivers: privfs.message.MessageReceiver[]}> {
        return Q().then(() => {
            hashmail = hashmail instanceof privfs.identity.Hashmail ? hashmail : new privfs.identity.Hashmail(hashmail);
            return this.lowUserProvider.getLowUser(hashmail.user, hashmail.host);
        })
        .then(lowUser => {
            if (lowUser == null) {
                return this.resolveHashmail(hashmail, includeImage);
            }
            let sink = privfs.message.MessageSinkPriv.fromSerialized(lowUser.sink.wif, "", "", "public", null, null);
            let user = privfs.identity.Identity.fromSerialized(hashmail, lowUser.identity.wif, lowUser.email);
            let receiver = new privfs.message.MessageReceiver(sink, user);
            return {
                data: {
                    keystore: null,
                    keystoreMsg: null,
                    treeMsg: null,
                    user: user,
                    profile: {
                        name: lowUser.email,
                        sinks: [sink]
                    }
                },
                receivers: [receiver]
            };
        });
    }
    
    getReceivers(hashmails: string[]): Q.Promise<(privfs.message.MessageReceiver|string)[]> {
        return Q().then(() => {
            if (hashmails.length == 0) {
                return [];
            }
            let promises: Q.Promise<privfs.message.MessageReceiver|string>[] = [];
            hashmails.forEach(hashmail => {
                let promise = Q().then(() => {
                    return this.resolveHashmail(hashmail);
                })
                .then(result => {
                    return result.receivers ? result.receivers[0] : hashmail;
                })
                .fail(() => {
                    return hashmail;
                });
                promises.push(promise);
            });
            return Q.all(promises);
        });
    }
    
    getValidReceivers(hashmails: string[]):  Q.Promise<privfs.message.MessageReceiver[]> {
        return Q().then(() => {
            return this.getReceivers(hashmails);
        })
        .then(receivers => {
            let invalidReceivers: string[] = [];
            receivers.forEach(receiver => {
                if (!(receiver instanceof privfs.message.MessageReceiver)) {
                    invalidReceivers.push("" + receiver);
                }
            });
            if (invalidReceivers.length > 0) {
                throw new Exception("invalid-receivers", invalidReceivers);
            }
            return <privfs.message.MessageReceiver[]>receivers;
        });
    }
}