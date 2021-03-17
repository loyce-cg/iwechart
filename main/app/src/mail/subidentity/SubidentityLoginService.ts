import * as privfs from "privfs-client";
import * as Q from "q";
import {subidentity} from "../../Types";
import {SectionUtils} from "../section/SectionUtils";
import {PrivmxRegistry} from "../PrivmxRegistry";
import {IOC} from "../IOC";
import {EventDispatcher} from "../../utils/EventDispatcher";
import {LocaleService } from "../LocaleService";
import {ParallelTaskStream } from "../../task/ParallelTaskStream";
import {InMemoryStorage} from "../../utils/InMemoryStorage";
import { InMemoryKvdbCollection } from "../kvdb/InMemoryKvdbCollection";
import { InMemoryKeyValueFile } from "../../utils/InMemoryKeyValueFile";
import { FilterMode } from "../FilterMode";
import { MailFilter } from "../MailFilter";
import { InMemoryKvdbMap } from "../../utils/InMemoryKvdbMap";

export class SubidentityLoginService {
    
    getPrivmxRegistry() {
        let privmxRegistry = new PrivmxRegistry(new IOC());
        privmxRegistry.registerByValue(x => x.getLocaleService(), new LocaleService({}, "en", ["en"]));
        privmxRegistry.registerByValue(x => x.getTaskStream(), new ParallelTaskStream());
        privmxRegistry.registerByValue(x => x.getLocalStorage(), new InMemoryStorage());
        privmxRegistry.registerByValue(x => x.getEventDispatcher(), new EventDispatcher());
        privmxRegistry.registerByValue(x => x.getStickersProvider(), {getStickers: () => <string[]>[]});
        privmxRegistry.registerByValue(x => x.getSinkFilter(), {value: null});
        privmxRegistry.registerByValue(x => x.getNotifications(), {value: []});
        privmxRegistry.registerByValue(x => x.getForcedPublishPresenceType(), {value: null})
        privmxRegistry.registerByValue(x => x.getMaxFileSize(), {value: null});
        privmxRegistry.registerByValue(x => x.getKvdbPollInterval(), {value: 10000});
        privmxRegistry.registerByValue(x => x.getSectionManagerOptions(), {fetchAllSection: true});
        privmxRegistry.registerByValue(x => x.getSectionKeyManagerOptions(), {readAdminSink: false});
        privmxRegistry.registerByValue(x => x.getUserSettingsKvdb(), new InMemoryKvdbCollection("", null, false));
        privmxRegistry.registerByValue(x => x.getAdminSinkReceiver(), null);
        privmxRegistry.registerByValue(x => x.getPublicSectionsKey(), null);
        privmxRegistry.registerByValue(x => x.getSubidentityService(), <any>{getSubidentities: () => Q({})});
        privmxRegistry.registerByValue(x => x.getTagProvider(), new privfs.message.TagStorage(<any>new InMemoryKeyValueFile({})));
        privmxRegistry.registerByFactory(x => x.getMailFilter(), () => {
            return privmxRegistry.getIdentity().then(identity => {
                let map: {[domain: string]: {mode: FilterMode}} = {};
                map[identity.host] = {mode: FilterMode.ALLOW};
                return new MailFilter(new InMemoryKvdbMap(map), identity.host);
            });
        });
        privmxRegistry.registerServices();
        return privmxRegistry;
    }
    
    setSrpSecure(privmxRegistry: PrivmxRegistry, srpSecure: privfs.core.PrivFsSrpSecure) {
        privmxRegistry.registerByValue(x => x.getSrpSecure(), srpSecure);
        privmxRegistry.registerByValue(x => x.getGateway(), srpSecure.gateway);
    }
    
    assignDeviceToSubidentity(host: string, recovery: Buffer|string, deviceId: string, deviceName: string) {
        let bip39: privfs.crypto.crypto.Interfaces.Bip39;
        let privmxRegistry = this.getPrivmxRegistry();
        return Q().then(() => {
            return typeof(recovery) == "string" ? privfs.crypto.service.bip39FromMnemonic(<string>recovery) : privfs.crypto.service.bip39FromEntropy(<Buffer>recovery);
        })
        .then(b39 => {
            bip39 = b39;
            return privfs.core.PrivFsRpcManager.getHttpGatewayByHost({host});
        })
        .then(gateway => {
            privmxRegistry.setGateway(gateway);
            return privmxRegistry.getSubidentityApi();
        })
        .then(subidentityApi => {
            let pub58 = bip39.extKey.getPublicKey().toBase58DER();
            return subidentityApi.assignDeviceToSubidentity(pub58, deviceId, deviceName);
        });
    }
    
    login(host: string, recovery: Buffer|string, deviceId: string, defaultPKI?: boolean): Q.Promise<subidentity.LoginResult> {
        let bip39: privfs.crypto.crypto.Interfaces.Bip39;
        let srpSecure: privfs.core.PrivFsSrpSecure;
        let subidentityRawData: subidentity.SubidentyRawData;
        let res: subidentity.LoginResult;
        let privmxRegistry = this.getPrivmxRegistry();
        return Q().then(() => {
            return privfs.core.LoginByKeyUtils.getBip39(recovery);
        })
        .then(b39 => {
            bip39 = b39;
            return privfs.core.PrivFsRpcManager.getHttpGatewayByHost({host});
        })
        .then(gateway => {
            gateway.properties.deviceId = deviceId;
            srpSecure = privfs.core.PrivFsSrpSecure.create(gateway, defaultPKI);
            privmxRegistry.setSrpSecure(srpSecure);
            return gateway.rpc.keyHandshake(bip39.extKey.getPrivateKey(), gateway.properties);
        })
        .then(() => {
            return privmxRegistry.getSubidentityApi();
        })
        .then(subidentityApi => {
            return subidentityApi.getSubidentityData();
        })
        .then(srd => {
            subidentityRawData = srd;
            const dataKey = privfs.core.LoginByKeyUtils.getMasterRecordKeyFromBip39(bip39);
            return privfs.crypto.service.sha256(Buffer.concat([dataKey, Buffer.from(subidentityRawData.key, "base64")]));
        })
        .then(dataKey => {
            return privfs.crypto.service.privmxDecrypt(privfs.crypto.service.privmxOptSignedCipher(), Buffer.from(subidentityRawData.data, "base64"), dataKey);
        })
        .then(plain => {
            let data = <subidentity.SubidentyData>JSON.parse(plain.toString("utf8"));
            let identity = data.identity ? privfs.identity.Identity.fromSerialized({user: data.identity.username, host: host}, data.identity.wif) : null;
            if (identity) {
                privmxRegistry.setIdentityProvider(identity, false, null, null, null);
                privmxRegistry.registerByValue(x => x.getAuthData(), null);
                privmxRegistry.registerByValue(x => x.getMasterExtKey(), null);
            }
            res = {
                data: data,
                createDate: subidentityRawData.createDate,
                deviceId: subidentityRawData.deviceId,
                deviceName: subidentityRawData.deviceName,
                deviceIdRequired: subidentityRawData.deviceIdRequired,
                deviceAssigmentDate: subidentityRawData.deviceAssigmentDate,
                lastLoginDate: subidentityRawData.lastLoginDate,
                acl: subidentityRawData.acl,
                srpSecure: srpSecure,
                bip39: bip39,
                identity: identity,
                sectionId: data.sectionId,
                sectionKey: {
                    sectionId: data.sectionId,
                    keyId: data.sectionKeyId,
                    key: Buffer.from(data.sectionKey, "base64")
                },
                sectionPubKey: data.pubKey ? {
                    sectionId: data.sectionId,
                    keyId: SectionUtils.PUBLIC_KEY_ID,
                    key: Buffer.from(data.pubKey, "base64")
                } : null,
                section: null,
                privmxRegistry: privmxRegistry
            };
            return privmxRegistry.getSectionManager();
        })
        .then(sectionManager => {
            sectionManager.sectionKeyManager.storeKey(res.sectionKey, Date.now());
            if (res.sectionPubKey) {
                sectionManager.sectionKeyManager.storeKey(res.sectionPubKey, Date.now());
            }
            return sectionManager.addSection(res.sectionId);
        })
        .then(section => {
            res.section = section;
            return res;
        });
    }
}