import {SinkIndexEntry} from "./SinkIndexEntry";
import {MessageTagsFactory} from "./MessageTagsFactory";
import * as Q from "q";
import * as privfs from "privfs-client";
import { SinkService } from "./SinkService";
import { ContactService } from "./contact/ContactService";
import { MailConst } from "./MailConst";
import { KvdbMap } from "./kvdb/KvdbMap";

export interface LowUser {
    source: string;
    username: string;
    host: string;
    password: string;
    hint: string;
    email: string;
    language: string;
    masterSeed: string;
    identity: {
        wif: string;
    };
    recovery: string;
    sink: {
        wif: string;
    };
    deleted: boolean;
    blocked?: boolean;
}

export interface LowUserEx {
    user: LowUser;
    identity: privfs.identity.Identity;
    sink: privfs.message.MessageSinkPriv;
    receiver: privfs.message.MessageReceiver;
}

export interface IdentityResult {
    masterSeed: Buffer;
    masterExtKey: privfs.crypto.ecc.ExtKey;
    identityExt: privfs.crypto.ecc.ExtKey;
    identityKey: privfs.crypto.ecc.PrivateKey;
}

export interface LowUserPrivData extends privfs.types.core.PrivDataL1 {
    identity: {
        wif: string;
        name: string;
    };
    sink: {
        wif: string;
    };
    recovery: string;
    receiver: {
        name: string;
        hashmail: string;
        pub58: string;
    };
}

export interface LowUserPrivDataEx {
    privData: LowUserPrivData;
    identity: privfs.identity.Identity;
    sink: privfs.message.MessageSinkPriv;
    receiver: privfs.identity.User;
}

export interface LowUserProps {
    owner: string;
    username: string;
    email: string;
    language: string;
    activated: boolean;
    identityKey: string;
    privData: string;
    privDataL2: string;
    dataVersion: string;
    passwordType: string;
    notifier: any;
    hosts: string[];
    registrationDate: number;
    srpSalt: string;
    srpVerifier: string;
    loginData: string;
    srpData: string;
    weakPassword: boolean;
    recoveryData: {pub: string, data: string};
    lbkData: string;
}

export class LowUserRegistry {
    
    kvdb: KvdbMap<LowUser>;
    emailCache: {[email: string]: LowUser};
    hashmailCache: {[hashmail: string]: LowUser};
    sourceCache: {[hashmail: string]: LowUser};
    
    constructor(kvdb: KvdbMap<LowUser>) {
        this.kvdb = kvdb;
        this.emailCache = {};
        this.hashmailCache = {};
        this.sourceCache = {};
        this.kvdb.forEach((_key, value) => {
            this.applyUserChanges(value);
        });
    }
    
    getUser(username: string): LowUser {
        return this.kvdb.get(username);
    }
    
    getLowUserByHashmail(hashmail: string): LowUser {
        return this.hashmailCache[hashmail];
    }
    
    getLowUserByEmail(email: string): LowUser {
        return this.emailCache[email];
    }
    
    getLowUserBySource(source: string): LowUser {
        return this.sourceCache[source];
    }
    
    applyUserChanges(user: LowUser) {
        if (user.deleted) {
            delete this.emailCache[user.email];
            delete this.hashmailCache[user.username + "#" + user.host];
            delete this.sourceCache[user.source];
        }
        else {
            this.emailCache[user.email] = user;
            this.hashmailCache[user.username + "#" + user.host] = user;
            this.sourceCache[user.source] = user;
        }
    }
    
    addUser(user: LowUser): Q.Promise<boolean> {
        return Q().then(() => {
            return this.kvdb.set(user.username, user).then(() => {
                this.applyUserChanges(user);
                return true;
            });
        });
    }
}

export class LowUserService {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public messageManager: privfs.message.MessageManager,
        public identity: privfs.identity.Identity,
        public sinkEncryptor: privfs.crypto.utils.ObjectEncryptor,
        public sinkService: SinkService,
        public contactService: ContactService,
        public registry: LowUserRegistry
    ) {
    }
    
    generateIdentity(identityIndex: number): Q.Promise<IdentityResult> {
        let masterSeed: Buffer, masterExtKey: privfs.crypto.ecc.ExtKey;
        
        return Q().then(() => {
            masterSeed = privfs.crypto.service.randomBytes(64);
            return privfs.crypto.service.eccExtFromSeed(masterSeed);
        })
        .then(mek => {
            masterExtKey = mek;
            return privfs.crypto.service.deriveHardened(masterExtKey, identityIndex);
        })
        .then(identityExt => {
            return {
                masterSeed: masterSeed,
                masterExtKey: masterExtKey,
                identityExt: identityExt,
                identityKey: identityExt.getPrivateKey()
            };
        });
    }
    
    deleteLowUser(username: string): Q.Promise<void> {
        let user: LowUser, sink: privfs.message.MessageSinkPriv;
        
        return Q().then(() => {
            return this.registry.getUser(username);
        })
        .then(user => {
            if (user == null || user.deleted) {
                throw new Error("User does not exists");
            }
            sink = privfs.message.MessageSinkPriv.fromSerialized(user.sink ? user.sink.wif : (<any>user).sinkWif, "", "", "public", null, null);
            return this.messageManager.sinkDelete(sink);
        })
        .then(() => {
            return this.srpSecure.request("deleteLowUser", {
                username: username
            });
        })
        .then(() => {
            user.deleted = true;
            return this.registry.kvdb.set(username, user);
        })
        .then(() => {
            this.registry.applyUserChanges(user);
        });
    }
    
    static getSink(data: {wif: string}): privfs.message.MessageSinkPriv {
        return privfs.message.MessageSinkPriv.fromSerialized(data.wif, "", "", "public", null, null);
    }
    
    static getLowUserEx(lowUser: LowUser): LowUserEx {
        let sink = LowUserService.getSink(lowUser.sink);
        let identity = privfs.identity.Identity.fromSerialized({user: lowUser.username, host: lowUser.host}, lowUser.identity.wif, lowUser.email);
        return {
            user: lowUser,
            sink: sink,
            identity: identity,
            receiver: new privfs.message.MessageReceiver(sink, identity)
        }
    }
    
    static getPrivDataEx(hashmail: string|{user: string, host: string}, privData: LowUserPrivData): LowUserPrivDataEx {
        return {
            privData: privData,
            identity: privfs.identity.Identity.fromSerialized(hashmail, privData.identity.wif, privData.identity.name),
            sink: LowUserService.getSink(privData.sink),
            receiver: privfs.identity.User.fromSerialized(privData.receiver.hashmail, privData.receiver.pub58, privData.receiver.name)
        };
    }
    
    createLowUserWithMessage(password: string, hint: string, email: string, language: string, indexEntry: SinkIndexEntry): Q.Promise<LowUser> {
        return Q().then(() => {
            let source = indexEntry == null ? "" : indexEntry.getCfmId();
            return this.createLowUser(password, hint, email, language, source);
        })
        .then(lowUser => {
            let lowUserEx = LowUserService.getLowUserEx(lowUser);
            let msg = new privfs.message.Message();
            let srcMsg = indexEntry.getMessage();
            msg.msgId = srcMsg.msgId;
            msg.createDate = srcMsg.createDate;
            msg.title = srcMsg.title;
            msg.text = indexEntry.getContentAsJson().text;
            msg.setSender(lowUserEx.identity);
            msg.addReceiver(this.sinkService.getMeAsReceiver());
            msg.attachments = srcMsg.getAttachmentSources(false);
            return this.messageManager.messageCreate(msg, null, MessageTagsFactory.getMessageTags(msg), lowUserEx.sink).thenResolve(lowUser);
        });
    }
    
    createLowUser(password: string, hint: string, email: string, language: string, source: string): Q.Promise<LowUser> {
        let user: LowUser;
        let hashmail: string;
        let identityRes: IdentityResult;
        let identity: privfs.identity.Identity;
        let bip39: privfs.crypto.crypto.Interfaces.Bip39
        let privData: LowUserPrivData;
        let sink: privfs.message.MessageSinkPriv;
        let acls: privfs.types.core.AclList;
        let privDataL1Key: Buffer;
        let mainSink = this.sinkService.findFirstPublicInbox();
        
        return Q().then(() => {
            user = {
               source: source,
               username: null,
               host: this.identity.host,
               password: password,
               hint: hint,
               email: email,
               language: language,
               masterSeed: null,
               identity: null,
               recovery: null,
               sink: null,
               deleted: false
            };
            return this.srpSecure.request<string>("createLowUser", {
                host: user.host
            });
        })
        .then(username => {
            user.username = username;
            hashmail = user.username + "#" + user.host;
            return this.generateIdentity(MailConst.IDENTITY_INDEX);
        })
        .then(r => {
            identityRes = r;
            user.masterSeed = identityRes.masterSeed.toString("base64");
            identity = new privfs.identity.Identity(hashmail, identityRes.identityKey, user.email);
            user.identity = {
                wif: identity.privWif
            };
            acls = [{
                type: privfs.types.core.AclType.WHITE_LIST,
                property: "senderPub58",
                list: [identity.pub58]
            }];
            sink = new privfs.message.MessageSinkPriv(privfs.crypto.serviceSync.eccPrivRandom(), "", "", "public", null, {
                lowUsers: [user.username],
                proxyTo: {
                    defaultAcls: acls,
                    list: [mainSink.id]
                }
            });
            user.sink = {
                wif: sink.privWif
            };
            return this.messageManager.storage.sinkCreate(sink.id, sink.acl, "", sink.options)
        })
        .then(() => {
            mainSink.addToProxyFrom({value: sink.id, acls: acls});
            return this.messageManager.sinkSave(mainSink, this.sinkEncryptor);
        })
        .then(() => {
            return Q.all([
                privfs.crypto.service.bip39Generate(256),
                privfs.crypto.service.randomBytes(32),
                privfs.crypto.service.randomBytes(32)
            ]);
        })
        .then(r => {
            bip39 = r[0];
            privDataL1Key = r[1];
            user.recovery = bip39.entropy.toString("base64");
            privData = {
                dataVersion: privfs.core.PrivFsSrp.DATA_VERSION,
                masterSeed: identityRes.masterSeed.toString("base64"),
                identity: {
                    wif: user.identity.wif,
                    name: user.email
                },
                sink: {
                    wif: user.sink.wif
                },
                recovery: bip39.entropy.toString("base64"),
                receiver: {
                    hashmail: this.identity.hashmail,
                    name: this.identity.name,
                    pub58: this.identity.pub58
                },
                l2Key: r[2].toString("base64")
            };
            return this.srpSecure.privFsSrp.initUser(user.username, user.username, user.password || "<empty>", privDataL1Key, {l1: privData, l2: {}}, bip39);
        })
        .then(registerData => {
            let loginData = JSON.parse(registerData.srp.params);
            loginData.hint = hint;
            registerData.srp.params = JSON.stringify(loginData);
            return this.srpSecure.request("modifyLowUser", {
                username: user.username,
                email: user.email,
                language: user.language,
                activated: true,
                identityKey: identity.pub58,
                privDataL1: registerData.privData.encryptedL1.toString("base64"),
                privDataL2: registerData.privData.encryptedL2.toString("base64"),
                dataVersion: privfs.core.PrivFsSrp.DATA_VERSION,
                passwordType: user.password ? "normal" : "empty",
                srp: {
                    salt: registerData.srp.salt.toString("hex"),
                    verifier: registerData.srp.verifier.toString("hex"),
                    params: registerData.srp.params,
                    data: registerData.srp.data.encrypted.toString("base64"),
                    weakPassword: false
                },
                lbk: {
                    pub: registerData.lbk.bip39.extKey.getPublicKey().toBase58DER(),
                    data: registerData.lbk.data.encrypted.toString("base64")
                },
                notifier: {
                    enabled: true,
                    email: user.email,
                    tags: [MessageTagsFactory.getMessageTypeTag("mail")],
                    ignoredDomains: []
                }
            });
        })
        .then(() => {
            return this.registry.addUser(user);
        })
        .then(() => {
            return this.contactService.addEmailToContacts(user.email);
        })
        .then(() => {
            return user;
        });
    }
    
    static getPrivDataL1Key(bip39: privfs.crypto.crypto.Interfaces.Bip39, lu: LowUserProps) {
        return Q().then(() => {
            let lbkKey = privfs.core.PrivFsKeyLogin.getLbkDataKeyFromBip39(bip39);
            return privfs.crypto.service.privmxDecrypt(new Buffer(lu.lbkData, "base64"), lbkKey);
        })
    };
    
    // migrateLowUserToPrivData2(bip39: privfs.crypto.crypto.Interfaces.Bip39, lu: LowUserProps, password: string, weakPassword: boolean): Q.Promise<privfs.types.core.RegisterData> {
    //     return Q().then(() => {
    //         let lbkKey = privfs.core.PrivFsKeyLogin.getLbkDataKeyFromBip39(bip39);
    //         return privfs.crypto.service.getObjectEncryptor(lbkKey).decrypt<LowUserPrivData>(new Buffer(lu.recoveryData.data, "base64"));
    //     })
    //     .then(priv => {
    //         return this.srpSecure.migrateToPrivData2AndChangePasswordCore({l1: priv, l2: {}}, lu.username, password);
    //     })
    //     .then(registerData => {
    //         return this.srpSecure.request("modifyLowUser", {
    //             username: lu.username,
    //             privDataL1: registerData.privData.encryptedL1.toString("base64"),
    //             privDataL2: registerData.privData.encryptedL2.toString("base64"),
    //             dataVersion: privfs.core.PrivFsSrp.DATA_VERSION,
    //             passwordType: password ? "normal" : "empty",
    //             srp: {
    //                 salt: registerData.srp.salt.toString("hex"),
    //                 verifier: registerData.srp.verifier.toString("hex"),
    //                 params: registerData.srp.params,
    //                 data: registerData.srp.data.encrypted.toString("base64"),
    //                 weakPassword: weakPassword
    //             },
    //             lbk: {
    //                 pub: registerData.lbk.bip39.extKey.getPublicKey().toBase58DER(),
    //                 data: registerData.lbk.data.encrypted.toString("base64")
    //             }
    //         })
    //         .thenResolve(registerData);
    //     });
    // }
    
    editUser(lowUser: LowUser, password: string, hint: string, language: string) {
        let bip39: privfs.crypto.crypto.Interfaces.Bip39;
        return Q().then(() => {
            return privfs.crypto.service.bip39FromEntropy(new Buffer(lowUser.recovery, "base64"));
        })
        .then(b39 => {
            bip39 = b39;
            return this.srpSecure.request<LowUserProps>("getLowUser", {
                username: lowUser.username
            });
        })
        .then(luProps => {
            if (luProps.dataVersion != "2.0") {
                throw new Error("Unsupported dataVersion");
                // return this.migrateLowUserToPrivData2(bip39, luProps, lowUser.password || "<empty>", false).then(x => {
                //     return x.privData.key;
                // });
            }
            return LowUserService.getPrivDataL1Key(bip39, luProps);
        })
        .then(privDataL1Key => {
            return this.srpSecure.privFsSrp.initUser(lowUser.username, lowUser.username, password || "<empty>", privDataL1Key);
        })
        .then(registerData => {
            let loginData = JSON.parse(registerData.srp.params);
            loginData.hint = hint;
            registerData.srp.params = JSON.stringify(loginData);
            return this.srpSecure.request("modifyLowUser", {
                username: lowUser.username,
                language: language,
                dataVersion: privfs.core.PrivFsSrp.DATA_VERSION,
                passwordType: password ? "normal" : "empty",
                srp: {
                    salt: registerData.srp.salt.toString("hex"),
                    verifier: registerData.srp.verifier.toString("hex"),
                    params: registerData.srp.params,
                    data: registerData.srp.data.encrypted.toString("base64"),
                    weakPassword: false
                }
            });
        })
        .then(() => {
            lowUser.password = password;
            lowUser.hint = hint;
            lowUser.language = language;
            return this.registry.addUser(lowUser);
        });
    }
    
    modifyUserBlocked(lowUser: LowUser, blocked: boolean) {
        return Q().then(() => {
            return this.srpSecure.request("modifyLowUser", {
                username: lowUser.username,
                blocked: blocked
            });
        })
        .then(() => {
            lowUser.blocked = blocked;
            return this.registry.addUser(lowUser);
        });
    }
    
    modifyPrivDataL2(lowUser: LowUser, modifier: (privDataL2: privfs.types.core.PrivDataL2) => Q.IWhenable<privfs.types.core.PrivDataL2>) {
        return LowUserService.modifyPrivDataL2(this.srpSecure, lowUser, modifier);
    }
    
    static modifyPrivDataL2(srpSecure: privfs.core.PrivFsSrpSecure, lowUser: LowUser, modifier: (privDataL2: privfs.types.core.PrivDataL2) => Q.IWhenable<privfs.types.core.PrivDataL2>) {
        let luProps: LowUserProps, l2Encryptor: privfs.crypto.utils.ObjectEncryptor;
        return Q().then(() => {
            return Q.all([
                privfs.crypto.service.bip39FromEntropy(new Buffer(lowUser.recovery, "base64")),
                srpSecure.request<LowUserProps>("getLowUser", {
                    username: lowUser.username
                })
            ]);
        })
        .then(res => {
            luProps = res[1];
            return LowUserService.getPrivDataL1Key(res[0], luProps);
        })
        .then(l1Key => {
            return privfs.crypto.service.getObjectEncryptor(l1Key).decrypt<privfs.types.core.PrivDataL1>(new Buffer(luProps.privData, "base64"));
        })
        .then(privData => {
            let privDataL2Key = new Buffer(privData.l2Key, "base64");
            l2Encryptor = privfs.crypto.service.getObjectEncryptor(privDataL2Key)
            return l2Encryptor.decrypt<privfs.types.core.PrivDataL2>(new Buffer(luProps.privDataL2, "base64"));
        })
        .then(privDataL2 => {
            return modifier(privDataL2);
        })
        .then(privDataL2 => {
            return l2Encryptor.encrypt(privDataL2);
        })
        .then(encrypted => {
            return srpSecure.request("modifyLowUser", {
                username: lowUser.username,
                privDataL2: encrypted.toString("base64"),
            });
        });
    }
}