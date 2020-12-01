import {section, utils} from "../../Types";
import {KvdbSettingEntry} from "../kvdb/KvdbUtils";
import {SinkIndexEntry} from "../SinkIndexEntry";
import {Lang} from "../../utils/Lang";
import {EventDispatcher} from "../../utils/EventDispatcher";
import {SectionUtils} from "./SectionUtils";
import * as Q from "q";
import * as privfs from "privfs-client";
import * as RootLogger from "simplito-logger";
import {SectionAdminSink} from "./SectionAdminSink";
import {PromiseUtils} from "simplito-promise";
import {MessageService} from "../MessageService";
import {HashmailResolver} from "../HashmailResolver";
import {MessageFlagsUpdater} from "../MessageFlagsUpdater";
let Logger = RootLogger.get("privfs-mail-client.mail.section.SectionKeyManager");

export interface SectionKeyManagerOptions {
    readAdminSink: boolean;
}

export class SectionKeyManager {
    
    static SECTION_MSG_TYPE = "section-msg";
    static SHARE_SECTION_KEY = "share-section-key";
    static SETTINGS_PREFIX = "SectionKey/";
    keysMap: {[keyMapId: string]: section.SectionKey};
    eventDispatcher: EventDispatcher;
    adminSinkToLoad: boolean;
    
    constructor(
        public publicSectionsKey: privfs.crypto.ecc.ExtKey,
        public settingsKvdb: utils.IKeyValueDbCollection<KvdbSettingEntry>,
        public messageService: MessageService,
        public hashmailResolver: HashmailResolver,
        public messageFlagsUpdater: MessageFlagsUpdater,
        public identity: privfs.identity.Identity,
        public adminSinkReceiver: privfs.message.MessageReceiver,
        public sectionAdminSink: SectionAdminSink,
        public options: SectionKeyManagerOptions
    ) {
        this.keysMap = {};
        this.eventDispatcher = new EventDispatcher();
        this.settingsKvdb.collection.changeEvent.add(event => {
            if (event.element) {
                this.processKvdbSettingEntry(event.element);
                if (event.type == "add") {
                    this.eventDispatcher.dispatchEvent({type: "add", key: event.element, source: "kvdb"});
                }
            }
        });
        this.settingsKvdb.collection.forEach(x => {
            this.processKvdbSettingEntry(x);
        });
    }
    
    //==================
    //      LOAD
    //==================
    
    loadKeys(): Q.Promise<void> {
        if (!this.options.readAdminSink) {
            return Q();
        }
        if (this.sectionAdminSink == null) {
            this.adminSinkToLoad = true;
            Logger.warn("Admin sink is empty, assign admin sink first then try to load keys");
            return Q();
        }
        this.adminSinkToLoad = false;
        return this.sectionAdminSink.loadAdminSink().then(sinkIndex => {
            return PromiseUtils.oneByOne(sinkIndex.entries.list, (_i ,entry) => {
                if (entry.source.data.type !== SectionKeyManager.SECTION_MSG_TYPE) {
                    return;
                }
                let event = <section.SectionMessage>entry.getContentAsJson();
                if (event === null || event.type != SectionKeyManager.SHARE_SECTION_KEY) {
                    return;
                }
                let eventT = <section.SectionShareKeyMessage>event;
                return this.createKey(eventT.sectionId, new Buffer(eventT.key, "base64")).then(key => {
                    return this.storeKey(key, false);
                });
            });
        })
        .then(() => {
            this.eventDispatcher.dispatchEvent({type: "load", manager: this});
        });
    }
    
    setSectionAdminSink(sectionAdminSink: SectionAdminSink) {
        this.sectionAdminSink = sectionAdminSink;
        if (this.adminSinkToLoad) {
            this.loadKeys().fail(e => {
                Logger.error("Error during loading keys from admin sink", e);
            });
        }
    }
    
    processKvdbSettingEntry(entry: KvdbSettingEntry): void {
        let sec = entry.secured;
        if (Lang.startsWith(sec.key, SectionKeyManager.SETTINGS_PREFIX)) {
            let splitted = sec.key.split("/");
            let key: section.SectionKey = {
                sectionId: splitted[1],
                keyId: splitted[2],
                key: new Buffer(sec.value, "base64")
            };
            this.keysMap[SectionKeyManager.getKeyMapId(key)] = key;
        }
    }
    
    //==================
    //      UTILS
    //==================
    
    static isPublicKey(key: section.SectionKey): boolean {
        return SectionKeyManager.isPublicKeyId(key.keyId);
    }
    
    static isPublicKeyId(keyId: section.SectionKeyId): boolean {
        return keyId == SectionUtils.PUBLIC_KEY_ID;
    }
    
    static getKeyMapId(key: section.SectionKey): string {
        return SectionKeyManager.getKeyMapIdEx(key.sectionId, key.keyId);
    }
    
    static getKeyMapIdEx(sectionId: section.SectionId, keyId: section.SectionKeyId): string {
        return sectionId + "/" + keyId;
    }
    
    //==================
    //   GET & CREATE
    //==================
    
    getKeyId(sectionId: section.SectionId, key: Buffer): Q.Promise<section.SectionKeyId> {
        return Q().then(() => {
            return privfs.crypto.service.sha256(new Buffer("SectionKeyId/" + sectionId + "/" + key.toString("hex")));
        })
        .then(hash => {
            return hash.toString("hex").substring(0, 30);
        });
    }
    
    isKeyValid(key: section.SectionKey): Q.Promise<boolean> {
        return Q().then(() => {
            if (key.keyId == SectionUtils.PUBLIC_KEY_ID) {
                return Q().then(() => {
                    return this.getPublicKey(key.sectionId);
                })
                .then(publicKey => {
                    return publicKey.key.equals(key.key);
                });
            }
            return Q().then(() => {
                return this.getKeyId(key.sectionId, key.key);
            })
            .then(keyId => {
                return key.keyId == keyId;
            });
        });
    }
    
    validateKey(key: section.SectionKey): Q.Promise<void> {
        return Q().then(() => {
            return this.isKeyValid(key);
        })
        .then(res => {
            if (!res) {
                throw new Error("Invalid section key");
            }
        });
    }
    
    getPublicKey(sectionId: section.SectionId): Q.Promise<section.SectionKey> {
        return Q().then(() => {
            if (this.publicSectionsKey == null) {
                // throw new Error("No access to public sections");
                return null;
            }
            return privfs.crypto.service.sha256(new Buffer(sectionId + "-" + this.publicSectionsKey.getChainCode().toString("hex"), "utf8"));
        })
        .then(key => {
            if (key == null) {
                // try read public section key from users keys map
                let mapId = SectionKeyManager.getKeyMapIdEx(sectionId, SectionUtils.PUBLIC_KEY_ID);
                if (mapId in this.keysMap) {
                    return this.keysMap[mapId];
                }
                else {
                    return null;
                }
            }
            return {
                keyId: SectionUtils.PUBLIC_KEY_ID,
                sectionId: sectionId,
                key: key
            };
            
        });
    }
    
    generateKey(sectionId: section.SectionId): Q.Promise<section.SectionKey> {
        let key: Buffer;
        return Q().then(() => {
            key = privfs.crypto.service.randomBytes(32);
            return this.getKeyId(sectionId, key);
        })
        .then(keyId => {
            return {
                keyId: keyId,
                sectionId: sectionId,
                key: key
            };
        });
    }
    
    createKey(sectionId: string, key: Buffer): Q.Promise<section.SectionKey> {
        return Q().then(() => {
            return this.getKeyId(sectionId, key);
        })
        .then(keyId => {
            return {
                keyId: keyId,
                sectionId: sectionId,
                key: key
            };
        });
    }

    createKeyPublic(sectionId: string, key: Buffer): Q.Promise<section.SectionKey> {
        return Q().then(() => {
            return {
                keyId: "public",
                sectionId: sectionId,
                key: key
            };
        });
    }

    
    getKey(sectionId: section.SectionId, keyId: section.SectionKeyId): Q.Promise<section.SectionKey> {
        return Q().then(() => {
            let mapId = SectionKeyManager.getKeyMapIdEx(sectionId, keyId);
            if (mapId in this.keysMap) {
                return this.keysMap[mapId];
            }
            if (SectionKeyManager.isPublicKeyId(keyId)) {
                return this.getPublicKey(sectionId);
            }
            return null;
        })
    }
    
    storeKey(key: section.SectionKey, save?: boolean, source?: string): Q.Promise<void> {
        return Q().then(() => {
            let mapId = SectionKeyManager.getKeyMapId(key);
            if (mapId in this.keysMap) {
                return;
            }
            this.keysMap[mapId] = key;
            this.eventDispatcher.dispatchEvent({type: "add", key: key, source: source});
            if (save === false || this.settingsKvdb == null) {
                return;
            }
            return this.settingsKvdb.set(SectionKeyManager.SETTINGS_PREFIX + SectionKeyManager.getKeyMapId(key), {
                secured: {
                    value: key.key.toString("base64")
                }
            });
        });
    }
    
    //=====================
    //  SHARE KEY MESSAGES
    //=====================
    
    createShareSectionKeyMessage(receiver: privfs.message.MessageReceiver, key: section.SectionKey, isPublic: boolean): privfs.message.Message {
        let messageData: section.SectionShareKeyMessage = {
            type: SectionKeyManager.SHARE_SECTION_KEY,
            sectionId: key.sectionId,
            key: key.key.toString("base64"),
            isPublic: isPublic
        }
        let message = this.messageService.createMessage(receiver, "", JSON.stringify(messageData));
        message.type = SectionKeyManager.SECTION_MSG_TYPE;
        return message;
    }
    
    handleSectionMsg(entry: SinkIndexEntry): Q.Promise<void> {
        return Q().then(() => {
            if (entry.source.data.type !== SectionKeyManager.SECTION_MSG_TYPE) {
                return;
            }
            if (entry.isProcessed() || entry.proceeding) {
                return;
            }
            let event = <section.SectionMessage>entry.getContentAsJson();
            if (event === null) {
                return;
            }
            entry.proceeding = true;
            return Q().then(() => {
                switch (event.type) {
                    case SectionKeyManager.SHARE_SECTION_KEY: {
                        let eventT = <section.SectionShareKeyMessage>event;
                        if (eventT.isPublic) {
                            return this.createKeyPublic(eventT.sectionId, new Buffer(eventT.key, "base64")).then(key => {
                                return this.storeKey(key, true, "mail");
                            });
                        }
                        else {
                            return this.createKey(eventT.sectionId, new Buffer(eventT.key, "base64")).then(key => {
                                return this.storeKey(key, true, "mail");
                            });
                        }
                    }
                }
            })
            .then(() => {
                return this.messageFlagsUpdater.updateMessageFlag(entry, "processed", true);
            });
        })
        .fail(e => {
            Logger.error("Error during processing section message", e);
        });
    }
    
    sendKey(key: section.SectionKey, users: string[], sendToAdminDb: boolean): void {
        if (sendToAdminDb || SectionUtils.hasUsersGroup(users, SectionUtils.ADMINS_GROUP)) {
            this.sendKeyToAdmins(key, SectionKeyManager.isPublicKey(key));
        }
        this.sendKeyToUsers(key, users, SectionKeyManager.isPublicKey(key));
    }
    
    sendKeyToAdmins(key: section.SectionKey, isPublic: boolean) {
        return Q().then(() => {
            let message = this.createShareSectionKeyMessage(this.adminSinkReceiver, key, isPublic);
            return this.messageService.sendSimpleMessage(message);
        })
        .fail(e => {
            Logger.error("Error during sending key to admin sink", e);
        });
    }
    
    sendKeyToUsers(key: section.SectionKey, users: string[], isPublic: boolean) {
        // remove admins group from users list if exists
        return PromiseUtils.oneByOne(users.filter(x => x != SectionUtils.ADMINS_GROUP), (_i, username) => {
            if (username == this.identity.user) {
                return;
            }
            return Q().then(() => {
                return this.hashmailResolver.resolveHashmail(username + "#" + this.identity.host);
            })
            .then(resolved => {
                if (resolved.receivers.length == 0) {
                    throw new Error("User has not sink");
                }
                let message = this.createShareSectionKeyMessage(resolved.receivers[0], key, isPublic);
                return this.messageService.sendSimpleMessage(message);
            })
            .fail(e => {
                Logger.error("Cannot send section key to '" + username + "'", e);
            });
        });
    }
}