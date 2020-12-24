import * as privfs from "privfs-client";
import * as Q from "q";
import * as crypto from "crypto";
import {MailConst} from "../MailConst";
import {PrivmxRegistry} from "../PrivmxRegistry";
import { HashmailResolver } from "../HashmailResolver";
import { utils, section } from "../../Types";
import { SinkIndexEntry } from "../SinkIndexEntry";
import { MessageFlagsUpdater } from "../MessageFlagsUpdater";
import * as RootLogger from "simplito-logger";
import { MessageService } from "../MessageService";
import { KvdbSettingEntry } from "../kvdb/KvdbUtils";
import { Lang } from "../../utils";
import { ProxyServerKey, ProxyAccessKeyMessage, ServerProxy, ServerProxyInfo } from "./Types";
import { UserLbkService } from "./UserLbkService";
import { RemoteServerApi } from "./RemoteServerApi";
import { ServerProxyApi } from "./ServerProxyApi";
import { RemoteLoginManager } from "./RemoteLoginManager";
import { MutableCollection } from "../../utils/collection/MutableCollection";

let Logger = RootLogger.get("privfs-mail-client.ServerProxyService");

export class ServerProxyService {
    
    static PROXY_ACCESS_KEY_MESSAGE_TYPE: string = "proxy-access-key-message";
    static SETTINGS_PREFIX: string = "ServerProxyService-proxy-keys";
    
    gateway: privfs.gateway.RpcGateway;
    keysMap: {[id: string]: ProxyServerKey} = {};
    // hosts: MutableCollection<ServerProxy>;
    hosts: MutableCollection<string>;
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public identity: privfs.identity.Identity,
        public hashmailResolver: HashmailResolver,
        public identityProvider: utils.IdentityProvider,
        public messageFlagsUpdater: MessageFlagsUpdater,
        public messageService: MessageService,
        public settingsKvdb: utils.IKeyValueDbCollection<KvdbSettingEntry>,
    ) {
        this.gateway = srpSecure.gateway;
        
        this.keysMap = {};
        this.settingsKvdb.collection.changeEvent.add(event => {
            if (event.element) {
                this.processKvdbSettingEntry(event.element);
            }
        });
        this.settingsKvdb.collection.forEach(x => {
            this.processKvdbSettingEntry(x);
        });
    }
    
    static create(privmxRegistry: PrivmxRegistry) {
        return Q.all([
            privmxRegistry.getSrpSecure(),
            privmxRegistry.getIdentity(),
            privmxRegistry.getHashmailResolver(),
            privmxRegistry.getIdentityProvider(),
            privmxRegistry.getMessageFlagsUpdater(),
            privmxRegistry.getMessageService()
        ])
        .then(r => {
            return Q.all([r, privmxRegistry.getUserSettingsKvdb()]);
        })
        .then(resp => {
            let res = resp[0];
            return new ServerProxyService(res[0], res[1], res[2], res[3], res[4], res[5], resp[1]);
        });
    }
    
    static getStorageKeyFromHost(host: string): string {
        let shasum = crypto.createHash('sha1');
        shasum.update(host);
        return shasum.digest("hex");
    }
    
    //returns lbkDataKey which should be sent to user
    setUserLbk(masterRecordL1Key: Buffer, localUsername: string, remoteUsername: string, remoteHost: string): Q.Promise<Buffer> {
        let lbkDataKey: Buffer;
        return Q().then(() => {
            lbkDataKey = privfs.crypto.service.randomBytes(32);
            return UserLbkService.encryptedLbkFromRegisterData(masterRecordL1Key, lbkDataKey);
        })
        .then(encryptedLbk => {
            return new UserLbkService(this.srpSecure).fetchKeyAndSetUserLbk(remoteHost, encryptedLbk, remoteUsername, localUsername);
        })
        .then(() => {
            return lbkDataKey;
        });
    }
    
    fetchServerKeyAndAddServerProxy(host: string, enabled: boolean, inEnabled: boolean, outEnabled: boolean, acl: string) {
        return Q().then(() => {
            return new RemoteServerApi(this.srpSecure, host).getServerPubKey();
        })
        .then(serverKey => {
            return new ServerProxyApi(this.gateway).addServerProxy({
                acl: acl,
                enabled: enabled,
                host: host,
                inEnabled: inEnabled,
                outEnabled: outEnabled,
                serverKey: serverKey.toBase58DER()
            });
        });
    }
    
    loginToHost(host: string, lbkDataKey: Buffer, defaultPKI: boolean) {
        return Q().then(() => {
            return new RemoteLoginManager(this.gateway).getRemoteLoginServiceForHost(MailConst.IDENTITY_INDEX, host);
        })
        .then(remoteLoginService => {
            // console.log("remoteLoginService", remoteLoginService);
            return remoteLoginService.login(this.identity.priv, lbkDataKey, defaultPKI);
        });
    }
    
    sendProxyAccessKeyMessage(remoteUser: string, remoteHost: string, lbkDataKey: string) {
        let remoteApi = new RemoteServerApi(this.srpSecure, remoteHost);
        // return this.hashmailResolver.resolveHashmail(remoteUser + "#" + remoteHost + "#" + this.identityProvider.getIdentity().host)
        return Q().then(() => {
            return remoteApi.getUserInfo(remoteUser);
        })
        .then(data => {
            let receiver: privfs.message.MessageReceiver;
            if (data.userInfo.profile.sinks == null) {
                throw new Error("User has no sink");
            }
            receiver = new privfs.message.MessageReceiver(data.userInfo.profile.sinks[0], data.userInfo.user);
            let messageData: ProxyAccessKeyMessage = {
                type: ServerProxyService.PROXY_ACCESS_KEY_MESSAGE_TYPE,
                host: this.identity.host,
                lbkDataKey: lbkDataKey
            }
            let message = this.messageService.createMessage(receiver, "", JSON.stringify(messageData));
            
            // let message = section.manager.messageSender.createMessage(receiver, "", JSON.stringify(messageData));
            message.type = ServerProxyService.PROXY_ACCESS_KEY_MESSAGE_TYPE;
            return this.messageService.sendSimpleMessage(message);
        })
    }
    
    handleProxyServiceMsg(entry: SinkIndexEntry): Q.Promise<void> {
        return Q().then(() => {
            if (entry.source.data.type !== ServerProxyService.PROXY_ACCESS_KEY_MESSAGE_TYPE) {
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
                    case ServerProxyService.PROXY_ACCESS_KEY_MESSAGE_TYPE: {
                        let data = entry.getContentAsJson();
                        let key = <any>data.lbkDataKey;
                        let host = <any>data.host;
                        this.storeKey({lbkKeyHex: key, host: host}, host);
                        this.prepareCollection();
                        break;
                    }
                }
            })
            .then(() => {
                return this.messageFlagsUpdater.updateMessageFlag(entry, "processed", true);
            });
        })
        .fail(e => {
            Logger.error("Error during processing proxy key message", e);
        });
    }
    
    getKey(host: string): Q.Promise<ProxyServerKey> {
        return Q().then(() => {
            let mapId = ServerProxyService.getStorageKeyFromHost(host);
            if (mapId in this.keysMap) {
                return this.keysMap[mapId];
            }
            return null;
        })
    }
        
    storeKey(key: ProxyServerKey, host: string): Q.Promise<void> {
        return Q().then(() => {
            let mapId = ServerProxyService.getStorageKeyFromHost(host);
            if (mapId in this.keysMap) {
                return;
            }
            this.keysMap[mapId] = key;
            return this.settingsKvdb.set(ServerProxyService.SETTINGS_PREFIX, {
                secured: {
                    value: JSON.stringify(this.keysMap)
                }
            });
        });
    }

    getKeysAsList(): Q.Promise<ProxyServerKey[]> {
        return Q().then(() => {
            let list: ProxyServerKey[] = [];
            if (this.keysMap) {
                for (let id in this.keysMap) {
                    list.push(this.keysMap[id]);
                }
            }
            return list;
        })
    }
    
    getHosts(): Q.Promise<string[]> {
        return this.getKeysAsList().then(x => x.map(element => element.host));
    }
    
    processKvdbSettingEntry(entry: KvdbSettingEntry): void {
        let sec = entry.secured;
        if (Lang.startsWith(sec.key, ServerProxyService.SETTINGS_PREFIX)) {
            this.keysMap = JSON.parse(sec.value);
        }
    }
    
    getAllServerProxy(): Q.Promise<ServerProxy[]> {
        let proxyApi = new ServerProxyApi(this.gateway);
        return proxyApi.getAllServerProxy()
    }
    
    // prepareCollection(): Q.Promise<void> {
    //     this.hosts = new MutableCollection<ServerProxy>();
    //     return Q().then(() => {
    //         return Q.all([
    //             this.getHosts(),
    //             this.getAllServerProxy()
    //         ])
    //         .then(res => {
    //             let [hosts, proxies] = res;
    //             let list = proxies.filter(proxy => hosts.indexOf(proxy.host) > -1 && proxy.enabled);
    //             this.hosts.rebuild(list);
    //         })
    //     })
    // }

    prepareCollection(): Q.Promise<void> {
        this.hosts = new MutableCollection<string>();
        return Q().then(() => {
            return Q.all([
                this.getHosts(),
                // this.getAllServerProxy()
            ])
            .then(res => {
                let [hosts] = res;
                // let list = proxies.filter(proxy => hosts.indexOf(proxy.host) > -1 && proxy.enabled);
                this.hosts.rebuild(hosts);
            })
        })
    }

    
    // getCollection(): MutableCollection<ServerProxy> {
    //     if (! this.hosts) {
    //         throw new Error("ServerProxyService - collection not initialized. Call prepareCollection() first.");
    //     }
    //     return this.hosts;
    // }
    getCollection(): MutableCollection<string> {
        if (! this.hosts) {
            throw new Error("ServerProxyService - collection not initialized. Call prepareCollection() first.");
        }
        return this.hosts;
    }

    checkRemoteServerProxy(host: string): Q.Promise<ServerProxyInfo> {
        let proxyApi = new ServerProxyApi(this.gateway);
        return proxyApi.checkRemoteServerProxy(host);
    }

}
