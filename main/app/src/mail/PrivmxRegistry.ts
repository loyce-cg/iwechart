import {IOC} from "./IOC";
import * as privfs from "privfs-client";
import * as Q from "q";
import { MessageSenderVerifier } from "./MessageSenderVerifier";
import { HashmailResolver } from "./HashmailResolver";
import { MessageService } from "./MessageService";
import { MessageTagsFactory } from "./MessageTagsFactory";
import { MessageTagger } from "./MessageTagger";
import { MessageFlagsUpdater } from "./MessageFlagsUpdater";
import { KvdbCollectionManager } from "./kvdb/KvdbCollectionManager";
import { KvdbUtils, KvdbSettingEntry } from "./kvdb/KvdbUtils";
import { KvdbSettingsStorage } from "./KvdbSettingsStorage";
import { KvdbCollection } from "./kvdb/KvdbCollection";
import { SubidentityKeyUpdater } from "./section/SubidentityKeyUpdater";
import { SectionConversationService } from "./section/SectionConversationService";
import { FileSizeChecker } from "./FileSizeChecker";
import { ConversationService } from "./conversation/ConversationService";
import { ContactService } from "./contact/ContactService";
import { PersonService } from "./person/PersonService";
import { Persons } from "./person/Persons";
import { IdentityProfile } from "./person/IdentityProfile";
import { SectionKeyManager, SectionKeyManagerOptions } from "./section/SectionKeyManager";
import { SinkIndexManager } from "./SinkIndexManager";
import { SectionAdminSink } from "./section/SectionAdminSink";
import { SectionApi } from "./section/SectionApi";
import { SectionManager, SectionManagerOptions } from "./section/SectionManager";
import { SinkService } from "./SinkService";
import { NetworkStatusService } from "./NetworkStatusService";
import { UserAdminService } from "./UserAdminService";
import { MailQueryService } from "./MailQueryService";
import { LowUserRegistry, LowUserService, LowUser } from "./LowUser";
import { LowUserService2 } from "./LowUserService2";
import { app, mail, utils, event, section } from "../Types";
import { BaseCollection } from "../utils/collection/BaseCollection";
import { SinkIndexEntry } from "./SinkIndexEntry";
import { ParallelTaskStream } from "../task/ParallelTaskStream";
import { UserPreferences, PreferencesKvdbEntry } from "./UserPreferences";
import { LocaleService } from "./LocaleService";
import { CosignerService } from "./CosignerService";
import { UserSettingsService } from "./UserSettingsService";
import { EventDispatcher } from "../utils/EventDispatcher";
import { MailConst } from "./MailConst";
import { UserPreferencesSynchronizer } from "./UserPreferencesSynchronizer";
import { PkiCache } from "./PkiCache";
import { UserEntryService } from "./person/UserEntryService";
import { MailFilter, MailFilterEntry } from "./MailFilter";
import { FilterMode } from "./FilterMode";
import { AdminKeyChecker } from "./admin/AdminKeyChecker";
import { SharedDbChecker } from "./admin/SharedDbChecker";
import { MailFilterCollection } from "./MailFilterCollection";
import { MailStats } from "./MailStats";
import { SinkIndexChangeListener } from "./SinkIndexChangeListener";
import { AdminDataReceiverService } from "./admin/AdminDataReceiverService";
import { AdminMessageHandler } from "./admin/AdminMessageHandler";
import { PkiEventHandler } from "./PkiEventHandler";
import { ExportMessagesService } from "./ExportMessagesService";
import { LastMessagesService } from "./LastMessagesService";
import { UtilApi } from "./UtilApi";
import { CollectionFactory } from "./CollectionFactory";
import { SinkProvider } from "./SinkProvider";
import { AdminKeySender } from "./admin/AdminKeySender";
import { AdminKeyHolder } from "./admin/AdminKeyHolder";
import { SharedDbAdminService } from "./admin/SharedDbAdminService";
import { AdminDataCreatorService } from "./admin/AdminDataCreatorService";
import { ChatModuleService, KvdbModuleService, FileSystemModuleService, CalendarModuleService } from "./section/ModuleService";
import { EncryptedStorage } from "../utils/EncryptedStorage";
import { SubidentityApi } from "./subidentity/SubidentityApi";
import { CustomizationApi } from "./CustomizationApi";
import { SubidentityService } from "./subidentity/SubidentityService";
import { Conv2Service } from "./section/Conv2Service";
import { SectionAccessManager } from "./section/SectionAccessManager";
import { ServerProxyService } from "./proxy";
import { SessionManager } from "./session/SessionManager";
import { CommonApplication } from "../app/common/CommonApplication";
import { TagProvider } from "./TagProvider";
import { MigrationUtils } from "./misc/MigrationUtils";
import { KvdbMap } from "./kvdb/KvdbMap";
import { UserCreationService } from "./admin/userCreation/UserCreationService";
import { UserCreationApi } from "./admin/userCreation/api/UserCreationApi";
import { AddUserModelBuilder } from "./admin/userCreation/api/AddUserModelBuilder";
import { ApiSerializer } from "./admin/userCreation/api/ApiSerializer";
import { UserCreationContextBuilder } from "./admin/userCreation/UserCreationContextBuilder";
import { PrivateUserCreator } from "./admin/userCreation/PrivateUserCreator";
import { AdminRightService } from "./admin/AdminRightService";
import { UserGroupCreatorService } from "./section/UserGroupCreatorService";
import { ManagableUserCreator } from "./admin/userCreation/ManagableUserCreator";

class FakeIoc {
    
    entryName: string;
    
    resolve(entryName: string): void {
        this.entryName = entryName;
    }
}

class FakeRegistry {
    
    ioc: FakeIoc;
    
    constructor() {
        this.ioc = new FakeIoc();
    }
    
    getEntryName<T = any>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>): string {
        forMethod(<any>this);
        return this.ioc.entryName;
    }
    
    static getEntryName<T = any>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>): string {
        //let fakeRegstry = new FakeRegistry();
        //return fakeRegstry.getEntryName(forMethod);
        let ioc = new FakeIoc();
        let fakeRegistry = new PrivmxRegistry((<any>ioc));
        forMethod(fakeRegistry);
        return ioc.entryName;
    }
}

export class PrivmxRegistry {
    
    constructor(public ioc: IOC) {
    }
    
    registerByValue<T = any>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, value: T): void {
        let entryName = FakeRegistry.getEntryName(forMethod);
        if (!(entryName in this.ioc.map)) {
            this.ioc.registerByValue(entryName, value);
        }
    }
    
    registerByFactory<T = any>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, factory: () => Q.IWhenable<T>): void {
        let entryName = FakeRegistry.getEntryName(forMethod);
        if (!(entryName in this.ioc.map)) {
            this.ioc.registerByFactory(entryName, factory);
        }
    }
    
    registerByConstructor<T = any>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(...args: any[]): T}, dependencies: string[]): void {
        let entryName = FakeRegistry.getEntryName(forMethod);
        if (!(entryName in this.ioc.map)) {
            this.ioc.registerByConstructor(entryName, constructorFunc, dependencies);
        }
    }
    
    registerByConstructor2<A, B, C, D, E, F, G, H, I, J, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I, j: J): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>, Q.Promise<D>, Q.Promise<E>, Q.Promise<F>, Q.Promise<G>, Q.Promise<H>, Q.Promise<I>, Q.Promise<J>]): void
    registerByConstructor2<A, B, C, D, E, F, G, H, I, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>, Q.Promise<D>, Q.Promise<E>, Q.Promise<F>, Q.Promise<G>, Q.Promise<H>, Q.Promise<I>]): void
    registerByConstructor2<A, B, C, D, E, F, G, H, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>, Q.Promise<D>, Q.Promise<E>, Q.Promise<F>, Q.Promise<G>, Q.Promise<H>]): void
    registerByConstructor2<A, B, C, D, E, F, G, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C, d: D, e: E, f: F, g: G): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>, Q.Promise<D>, Q.Promise<E>, Q.Promise<F>, Q.Promise<G>]): void
    registerByConstructor2<A, B, C, D, E, F, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C, d: D, e: E, f: F): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>, Q.Promise<D>, Q.Promise<E>, Q.Promise<F>]): void
    registerByConstructor2<A, B, C, D, E, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C, d: D, e: E): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>, Q.Promise<D>, Q.Promise<E>]): void
    registerByConstructor2<A, B, C, D, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C, d: D): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>, Q.Promise<D>]): void
    registerByConstructor2<A, B, C, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B, c: C): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>, Q.Promise<C>]): void
    registerByConstructor2<A, B, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A, b: B): T}, depsGetter: () => [Q.Promise<A>, Q.Promise<B>]): void
    registerByConstructor2<A, T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(a: A): T}, depsGetter: () => [Q.Promise<A>]): void
    registerByConstructor2<T>(forMethod: (registry: PrivmxRegistry) => Q.Promise<T>, constructorFunc: {new(...args: any[]): T}, depsGetter: () => Q.Promise<any>[]): void {
        let entryName = FakeRegistry.getEntryName(forMethod);
        if (!(entryName in this.ioc.map)) {
            this.ioc.registerByFactory(entryName, () => {
                return Q.all(depsGetter()).then(deps => {
                    let value = <T>Object.create(constructorFunc.prototype);
                    constructorFunc.apply(value, deps);
                    return value;
                });
            });
        }
    }
    
    registerLoginData(identity: privfs.identity.Identity, srpSecure: privfs.core.PrivFsSrpSecure, masterExtKey: privfs.crypto.ecc.ExtKey, authData: privfs.types.core.UserDataEx) {
        this.setIdentity(identity);
        this.setSrpSecure(srpSecure);
        this.registerByValue(x => x.getMasterExtKey(), masterExtKey);
        this.registerByValue(x => x.getAuthData(), authData);
    }
    
    setGateway(gateway: privfs.gateway.RpcGateway) {
        this.registerByValue(x => x.getGateway(), gateway);
    }
    
    setSrpSecure(srpSecure: privfs.core.PrivFsSrpSecure) {
        this.registerByValue(x => x.getSrpSecure(), srpSecure);
        this.setGateway(srpSecure.gateway);
    }
    
    setIdentity(identity: privfs.identity.Identity) {
        this.registerByValue(x => x.getIdentity(), identity);
    }
    
    setIdentityProvider(identity: privfs.identity.Identity, isAdmin: boolean, login: string, rights: string[], type: string) {
        this.setIdentity(identity);
        this.registerByValue(x => x.getIdentityProvider(), {
            getIdentity: () => identity,
            isAdmin: () => isAdmin,
            getLogin: () => login,
            getType: () => type,
            getRights: () => rights,
        });
    }
    
    registerUserPreferencesWitMigration() {
        this.registerByFactory(x => x.getUserPreferences(), () => {
            return Q.all([
                this.getEventDispatcher(),
                (<Q.Promise<utils.IKeyValueDbCollection<PreferencesKvdbEntry>>>this.getUserSettingsKvdb()),
                this.getNotifications()
            ]).then(res => {
                let [eventDispatcher, kvdb, notifications] = res;
                return Q().then(() => {
                    if (!kvdb.hasSync(MailConst.USER_PREFERENCES_KVDB_KEY)) {
                        return Q().then(() => {
                            return this.getSystemFs();
                        })
                        .then(storage => {
                            return storage.optRead(MailConst.USER_PREFERENCES_FILENAME);
                        })
                        .then(value => {
                            if (value == null) {
                                return;
                            }
                            return kvdb.set(MailConst.USER_PREFERENCES_KVDB_KEY, {secured: {value: value.getJson<PreferencesKvdbEntry>()}});
                        })
                    }
                })
                .then(() => {
                    let userPreferences = new UserPreferences(kvdb, MailConst.USER_PREFERENCES_KVDB_KEY, eventDispatcher);
                    notifications.value.forEach(x => {
                        userPreferences.defaults.notifications[x.userPreferencesKey] = x.defaultValue;
                    });
                    return userPreferences.load().thenResolve(userPreferences);
                });
            });
        });
    }
    
    getKvdbMapWithMigration<T>(kvdbIndex: number, oldFilePath: string, defaultData: {[key: string]: T}): Q.Promise<KvdbMap<T>> {
        return this.getKvdbCollectionManager().then(kvdbCollectionManager => {
            return kvdbCollectionManager.getOrCreateMapByIndex<T>(kvdbIndex, {});
        })
        .then(kvdb => {
            if (kvdb.newlyCreated) {
                return Q().then(() => {
                    return this.getSystemFs();
                })
                .then(fs => {
                    return MigrationUtils.migrateKeyValueFileToKvdbMap(fs, oldFilePath, kvdb);
                })
                .then(performed => {
                    if (!performed) {
                        return kvdb.setMany(defaultData);
                    }
                })
                .thenResolve(kvdb);
            }
            return kvdb;
        });
    }
    
    registerServices() {
        // console.log("registering mailClientApi services..");
        //lowUserProvider
        //sinkIndexProvider
        //na zewnątrz dodatkowo getSettings
        //tagProvider domyślnie jest przez plik
        //subidentityService wymaga derive tak samo jak storage i filesStorage
        //kvdbPollInterval
        //adminKey
        //profileProvider
        //sinkProvider
        //localeStorage
        //taskStream
        //adminKey
        //sectionKeyManagerOptions
        //userPreferences
        //identityProvider
        //sectionManagerOptions
        this.registerByFactory(x => x.getClient(), () => {
            return Q.all([this.getGateway(), this.getIdentity(), this.getMasterExtKey()]).then(res => {
                let [gateway, identity, masterExtKey] = res;
                let client = new privfs.core.Client(gateway, identity, masterExtKey);
                client.storageProviderManager.blockCache.maxSize = 100 * 1024 * 1024;
                return client.init().thenResolve(client);
            })
        });
        this.registerByFactory(x => x.getSystemFs(), () => {
            return this.getClient().then(client => {
                return client.getFileSystemByIndexAndInit(MailConst.MESSAGES_INDEX);
            });
        });
        this.registerByFactory(x => x.getPrivateFs(), () => {
            return this.getClient().then(client => {
                return client.getFileSystemByIndexAndInit(MailConst.FILES_INDEX);
            });
        });
        this.registerByConstructor2(x => x.getMessageSenderVerifier(), MessageSenderVerifier, () => [
            this.getSrpSecure(),
            this.getMessageFlagsUpdater(),
            this.getLowUserProvider(),
            this.getContactService()
        ]);
        this.registerByConstructor2(x => x.getHashmailResolver(), HashmailResolver, () => [this.getSrpSecure(), this.getLowUserProvider()]);
        this.registerByConstructor2(x => x.getMessageService(), MessageService, () => [this.getMessageManager(), this.getMessageSenderVerifier(), this.getMessageTagsFactory(), this.getIdentity(), this.getSrpSecure(), this.getHashmailResolver(), this.getSinkIndexProvider(), this.getSinkProvider(), this.getLocaleService()]);
        this.registerByFactory(x => x.getTagService(), () => {
            return this.getMessageManager().then(messageManager => {
                return messageManager.tagService;
            });
        });
        this.registerByFactory(x => x.getTagProvider(), () => {
            return this.getKvdbMapWithMigration<string>(MailConst.TAG_PROVIDER_KVDB_INDEX, MailConst.TAGS_FILENAME, {}).then(kvdb => {
                return new TagProvider(kvdb);
            });
        });
        this.registerByConstructor2(x => x.getMessageTagsFactory(), MessageTagsFactory, () => [this.getTagProvider()]);
        this.registerByConstructor2(x => x.getMessageTagger(), MessageTagger, () => [this.getMessageFlagsUpdater()]);
        this.registerByConstructor2(x => x.getMessageFlagsUpdater(), MessageFlagsUpdater, () => [this.getIdentity(), this.getMessageTagsFactory(), this.getTagService(), this.getSinkIndexProvider(), this.getSinkIndexManager()]);
        this.registerByConstructor2(x => x.getSubidentityApi(), SubidentityApi, () => [this.getGateway()]);
        this.registerByConstructor2(x => x.getCustomizationApi(), CustomizationApi, () => [this.getGateway()]);
        this.registerByFactory(x => x.getSubidentityExtKey(), () => {
            return this.getClient().then(client => {
                return client.deriveKey(MailConst.SUBIDENTITIES_INDEX);
            });
        });
        this.registerByFactory(x => x.getSubidentityService(), () => {
            return Q.all([this.getSubidentityApi(), this.getSubidentityExtKey()]).then(res => {
                let [subidentityApi, extKey] = res;
                return new SubidentityService(subidentityApi, extKey.getChainCode());
            });
        });
        this.registerByConstructor2(x => x.getSubidentityKeyUpdater(), SubidentityKeyUpdater, () => [this.getSubidentityService()]);
        this.registerByFactory(x => x.getMessageManager(), () => {
            return this.getClient().then(client => {
                return client.getMessageManager();
            });
        });
        this.registerByFactory(x => x.getSettingsExtKey(), () => {
            return this.getClient().then(client => {
                return client.deriveKey(MailConst.SETTINGS_ENCRYPTOR_INDEX);
            });
        });
        this.registerByConstructor2(x => x.getKeyValueDbManager(), privfs.db.KeyValueDbManager, () => [this.getClient()]);
        this.registerByConstructor2(x => x.getKvdbCollectionManager(), KvdbCollectionManager, () => [this.getKeyValueDbManager(), this.getKvdbPollInterval()]);
        this.registerByFactory(x => x.getUserSettingsKvdb(), () => {
            return this.getKvdbCollectionManager().then(kvdbCollectionManager => {
                return kvdbCollectionManager.getOrCreateByIndex<KvdbSettingEntry>(MailConst.SETTINGS_KVDB_INDEX, {});
            });
        });
        this.registerByConstructor2(x => x.getUserSettingsKvdbStorage(), KvdbSettingsStorage, () => [this.getUserSettingsKvdb()]);
        this.registerByConstructor2(x => x.getUserSettingsService(), UserSettingsService, () => [this.getUserSettingsKvdb(), this.getEventDispatcher()]);
        this.registerByFactory(x => x.getSharedKvdbExtKey(), () => {
            return this.getUserSettingsService().then(userSettingsService => {
                return userSettingsService.getSharedKvdbExtKey();
            });
        });
        this.registerByFactory(x => x.getSharedKvdb(), () => {
            return Q.all([this.getSharedKvdbExtKey(), this.getKvdbCollectionManager()]).then(res => {
                let [extKey, kvdbCollectionManager] = res;
                return extKey ? kvdbCollectionManager.getByExtKey<KvdbSettingEntry>(extKey) : null;
            });
        });
        this.registerByFactory(x => x.getAdminKvdb(), () => {
            return Q.all([this.getAdminKey(), this.getKvdbCollectionManager()]).then(res => {
                let [adminKey, kvdbCollectionManager] = res;
                return privfs.crypto.service.deriveHardened(adminKey, MailConst.ADMIN_KVDB_INDEX).then(extKey => {
                    return kvdbCollectionManager.getOrCreateByExtKey<KvdbSettingEntry>(extKey, {
                        acl: {
                            manage: "<admin>",
                            read: "<admin>",
                            write: "<admin>"
                        }
                    });
                });
            });
        });
        this.registerByFactory(x => x.getSharedKvdbFromAdminDb(), () => {
            return Q.all([this.getAdminKvdb(), this.getKvdbCollectionManager()]).then(res => {
                let [adminKvdb, kvdbCollectionManager] = res;
                return Q().then(() => {
                    return adminKvdb.opt(MailConst.SHARED_KVDB_KEY_IN_ADMIN_DB, null);
                })
                .then(entry => {
                    if (entry != null) {
                        return privfs.crypto.ecc.ExtKey.fromBase58(entry.secured.value);
                    }
                    let extKey = privfs.crypto.serviceSync.eccExtRandom();
                    return Q().then(() => {
                        return adminKvdb.set(MailConst.SHARED_KVDB_KEY_IN_ADMIN_DB, KvdbUtils.createKvdbSettingEntry(extKey.getPrivatePartAsBase58()));
                    })
                    .thenResolve(extKey);
                })
                .then(extKey => {
                    return kvdbCollectionManager.getOrCreateByExtKey<KvdbSettingEntry>(extKey, {
                        acl: {
                            manage: "<admin>",
                            write: "<admin>",
                            read: "<local>"
                        }
                    });
                });
            });
        });
        this.registerByFactory(x => x.getUserConfig(), () => {
            return this.getSrpSecure().then(srpSecure => {
                return srpSecure.getUserConfig();
            });
        });
        this.registerByConstructor2(x => x.getFileSizeChecker(), FileSizeChecker, () => [this.getMaxFileSize()]);
        this.registerByConstructor2(x => x.getConversationService(), ConversationService, () => [this.getIdentity(), this.getContactService(), this.getPersonService(), this.getMessagesCollection()]);
        this.registerByConstructor2(x => x.getContactService(), ContactService, () => [this.getIdentity(), this.getSrpSecure(), this.getLowUserProvider(), this.getHashmailResolver(), this.getUtilApi()]);
        this.registerByConstructor2(x => x.getPersonService(), PersonService, () => [this.getIdentity(), this.getPersons(), this.getLowUserProvider()]);
        this.registerByConstructor2(x => x.getPersons(), Persons, () => [this.getIdentity(), this.getContactService(), this.getIdentityProfile()]);
        this.registerByConstructor2(x => x.getIdentityProfile(), IdentityProfile, () => [this.getProfileProvider(), this.getSinkProvider()]);
        this.registerByConstructor2(x => x.getSectionConversationService(), SectionConversationService, () => [this.getMessageService(), this.getHashmailResolver(), this.getConversationService(), this.getFileSizeChecker()]);
        // this.registerByConstructor2(x => x.getContactPresenceCheck(), ContactPresenceCheck, () => [this.getContactService()]);
        this.registerByFactory(x => x.getPublicSectionsKey(), () => {
            return this.getSharedKvdb().then(sharedKvdb => {
                if (sharedKvdb == null) {
                    return null;
                }
                return sharedKvdb.opt(MailConst.PUBLIC_SECTIONS_KEY, null);
            })
            .then(key => {
                if (!key) {
                    return null;
                }
                return privfs.crypto.ecc.ExtKey.fromBase58(key.secured.value);
            });
        });
        this.registerByFactory(x => x.getAdminSinkReceiver(), () => {
            return Q.all([this.getIdentity(), this.getSharedKvdb()]).then(res => {
                let [identity, sharedKvdb] = res;
                if (sharedKvdb == null) {
                    return null;
                }
                return sharedKvdb.opt(MailConst.ADMIN_SINK_KEY, null).then(pub58 => {
                    if (!pub58) {
                        return null;
                    }
                    let sink = privfs.message.MessageSink.fromSerialized(pub58.secured.value);
                    let user = new privfs.identity.User("server-admins-" + sink.id + "#" + identity.host, sink.pub);
                    return new privfs.message.MessageReceiver(sink, user);
                });
            });
        });
        this.registerByConstructor2(x => x.getSinkIndexManager(), SinkIndexManager, () => [this.getLocalStorage(), this.getMessageManager(), this.getTaskStream(), this.getIdentity(), this.getEventDispatcher()]);
        this.registerByFactory(x => x.getAdminSink(), () => {
            return this.getAdminKvdb().then(adminKvdb => {
                return adminKvdb.opt(MailConst.ADMIN_SINK_KEY, null).then(sinkWif => {
                    if (!sinkWif) {
                        return null;
                    }
                    return privfs.message.MessageSinkPriv.fromSerialized(sinkWif.secured.value, "", "", "public", {type: "admin-sink"}, null);
                });
            });
        });
        this.registerByConstructor2(x => x.getSectionAdminSink(), SectionAdminSink, () => [this.getAdminSink(), this.getSinkIndexManager()]);
        this.registerByFactory(x => x.getSectionKeyManager(), () => {
            return Q.all([this.getIdentityProvider(), this.getAdminKeyHolder(), this.getEventDispatcher()]).then(res => {
                let [identityProvider, adminKeyHolder, eventDispatcher] = res;
                let sectionKeyManager: SectionKeyManager;
                let sectionAdminSink: SectionAdminSink;
                let hasKey = identityProvider.isAdmin() && adminKeyHolder.adminKey != null;
                if (!hasKey && identityProvider.isAdmin()) {
                    eventDispatcher.addEventListener<event.GrantAccessToAdminKeyEvent>("grantaccesstoadminkey", () => {
                        this.getSectionAdminSink().then(sas => {
                            sectionAdminSink = sas;
                            if (sectionKeyManager) {
                                sectionKeyManager.setSectionAdminSink(sas);
                            }
                        });
                    });
                }
                return Q.all([
                    Q.all([
                        this.getPublicSectionsKey(),
                        this.getUserSettingsKvdb(),
                        this.getMessageService(),
                        this.getHashmailResolver(),
                        this.getMessageFlagsUpdater(),
                        this.getIdentity(),
                    ]),
                    Q.all([
                        this.getAdminSinkReceiver(),
                        hasKey ? this.getSectionAdminSink() : Q<SectionAdminSink>(null),
                        this.getSectionKeyManagerOptions()
                    ])
                ]).then(res => {
                    let [publicSectionsKey, userSettingsKvdb, messageService, hashmailResolver, messageFlagsUpdater, identity] = res[0];
                    let [adminSinkReceiver, sectionAdminSinkFromPromise, sectionKeyManagerOptions] = res[1];
                    return sectionKeyManager = new SectionKeyManager(publicSectionsKey, userSettingsKvdb, messageService, hashmailResolver, messageFlagsUpdater,
                        identity, adminSinkReceiver, sectionAdminSink || sectionAdminSinkFromPromise, sectionKeyManagerOptions);
                });
            });
        });
        this.registerByFactory(x => x.getSectionAccessManager(), () => {
            return Q().then(() => {
                let sectionAccessManager: SectionAccessManager;
                return Q.all([
                    this.getMessageService(),
                    this.getHashmailResolver(),
                    this.getMessageFlagsUpdater(),
                    this.getIdentity(),
                ]).then(res => {
                    let [messageService, hashmailResolver, messageFlagsUpdater, identity] = res;
                    return sectionAccessManager = new SectionAccessManager(messageFlagsUpdater, messageService, hashmailResolver, identity);
                });
            });
        });
        this.registerByFactory(x => x.getServerProxyService(), () => {
            return Q().then(() => {
                let serverProxyService: ServerProxyService;
                return Q.all([
                    this.getSrpSecure(),
                    this.getIdentity(),
                    this.getHashmailResolver(),
                    this.getIdentityProvider(),
                    this.getMessageFlagsUpdater(),
                    this.getMessageService(),
                ]).then(res => {
                    return Q.all([res, this.getUserSettingsKvdb()])
                })
                .then(res => {
                    let [res0, userSettingsKvdb] = res;
                    let [srpSecure, identity, hashmailResolver, identityProvider, messageFlagsUpdater, messageService] = res0;
                    return serverProxyService = new ServerProxyService(srpSecure, identity, hashmailResolver, identityProvider, messageFlagsUpdater, messageService, userSettingsKvdb);
                })
            });
        });

        this.registerByFactory(x => x.getSessionManager(), () => {
            return Q().then(() => {
                let sessionManager: SessionManager;
                return Q.all([
                    this.getWellKnownEncryptedLocalStorage(),
                    this.getLocalStorage(),
                    this.getServerProxyService(),
                    this.getEventDispatcher(),
                    this.getLocaleService(),
                    this.getMailResourceLoader(),
                ])
                .then(res => {
                    let [storage, unencryptedStorage, serverProxyService, eventDispatcher, localeService, mailResourceLoader] = res;
                    // console.log("creating sessionManager");
                    return sessionManager = new SessionManager(this.ioc, serverProxyService, localeService, storage, unencryptedStorage, eventDispatcher, mailResourceLoader, eventDispatcher as CommonApplication);
                })
            });
        });
        
        //this.registerByConstructor2(x => x.getSectionKeyManager(), SectionKeyManager, () => [this.getPublicSectionsKey(), this.getUserSettingsKvdb(), this.getMessageService(), this.getHashmailResolver(), this.getMessageFlagsUpdater(), this.getIdentity(), this.getAdminSinkReceiver(), this.getSectionAdminSink(), this.getSectionKeyManagerOptions()]);
        this.registerByConstructor2(x => x.getSectionApi(), SectionApi, () => [this.getGateway()]);
        this.registerByFactory(x => x.getSectionManager(), () => {
            return Q.all([
                Q.all([
                    this.getSectionApi(),
                    this.getSectionKeyManager(),
                    this.getClient(),
                    this.getLocalStorage(),
                    this.getUserSettingsKvdbStorage(),
                    this.getKvdbCollectionManager()
                ]),
                Q.all([
                    this.getIdentity(),
                    this.getSinkIndexManager(),
                    this.getMessageSender(),
                    this.getSubidentityService(),
                    this.getSubidentityKeyUpdater(),
                    this.getUserPreferences()
                ]),
                Q.all([
                    this.getSectionConversationService(),
                    this.getIdentityProvider(),
                    this.getFileSizeChecker(),
                    this.getMessageManager(),
                    this.getSectionManagerOptions(),
                    this.getStickersProvider(),

                ]),
                Q.all([
                    this.getPersonService(),
                    this.getContactService(),
                    this.getHashmailResolver(),
                    this.getSectionAccessManager(),
                    this.getLocaleService(),
                    this.getEventDispatcher(),
                ])
            ])
            .then(res => {
                let [sectionApi, sectionKeyManager, client, localeStorage, kvdbSettingsStorage, kvdbCollectionManager] = res[0];
                let [identity, sinkIndexManager, messageSender, subidentityService, subidentityKeyUpdater, userPreferences] = res[1];
                let [sectionConversationService, identityProvider, fileSizeChecker, messageManager, sectionManagerOptions, stickersProvider] = res[2];
                let [personService, contactService, hashmailResolver, sectionAccessManager, localeService, eventDispatcher] = res[3];
                
                let sectionManager = new SectionManager(
                    sectionApi, sectionKeyManager, sectionAccessManager, client, localeStorage, kvdbSettingsStorage, kvdbCollectionManager,
                    identity, sinkIndexManager, messageSender, subidentityService, subidentityKeyUpdater, userPreferences,
                    sectionConversationService, identityProvider, fileSizeChecker, messageManager, sectionManagerOptions, stickersProvider,
                    personService, contactService, hashmailResolver, localeService, eventDispatcher
                );
                sectionManager.registryModuleEx(ChatModuleService);
                sectionManager.registryModuleEx(KvdbModuleService);
                sectionManager.registryModuleEx(FileSystemModuleService);
                sectionManager.registryModuleEx(CalendarModuleService);
                return sectionManager;
            });
        });
        this.registerByFactory(x => x.getSinkEncryptor(), () => {
            return this.getClient().then(client => {
                return client.deriveKey(MailConst.SINK_ENCRYPTOR_INDEX);
            })
            .then(extKey => {
                return privfs.crypto.service.getObjectEncryptor(extKey.getChainCode());
            });
        });
        this.registerByFactory(x => x.getSinkService(), () => {
            return Q.all([
                Q.all([
                    this.getIdentityProvider(),
                    this.getSrpSecure(),
                    this.getSinkIndexManager(),
                    this.getMessageManager(),
                    this.getSinkEncryptor(),
                    this.getUserConfig()
                ]),
                Q.all([
                    this.getSinkFilter(),
                    this.getLowUserService2(),
                    this.getAuthData(),
                    this.getUserEntryService(),
                    this.getSinkProvider()
                ])
            ])
            .then(res => {
                let [p1, p2] = res;
                return new SinkService(p1[0], p1[1], p1[2], p1[3], p1[4], p1[5], p2[0], p2[1], p2[2], p2[3], p2[4]);
            });
        });
        this.registerByConstructor2(x => x.getUserAdminService(), UserAdminService, () => [this.getSrpSecure()]);
        this.registerByConstructor2(x => x.getMailQueryService(), MailQueryService, () => [this.getIdentity(), this.getMessageManager(), this.getTagProvider(), this.getSinkService()]);
        this.registerByFactory(x => x.getLowUserRegistry(), () => {
            return this.getKvdbMapWithMigration<LowUser>(MailConst.LOW_USERS_KVDB_INDEX, MailConst.LOW_USERS_FILENAME, {}).then(kvdb => {
                return new LowUserRegistry(kvdb);
            });
        });
        this.registerByValue(x => x.getLowUserService(), null);
        this.registerByConstructor2(x => x.getLowUserService2(), LowUserService2, () => [this.getLowUserService(), this.getSinkIndexManager()]);
        this.registerByConstructor2(x => x.getCosignerService(), CosignerService, () => [this.getSrpSecure(), this.getIdentity(), this.getMessageManager(), this.getMessageService(), this.getHashmailResolver(), this.getLocaleService()]);
        this.registerByFactory(x => x.getUserPreferences(), () => {
            return Q.all([
                this.getEventDispatcher(),
                (<Q.Promise<utils.IKeyValueDbCollection<PreferencesKvdbEntry>>>this.getUserSettingsKvdb()),
                this.getNotifications()
            ]).then(res => {
                let [eventDispatcher, kvdb, notifications] = res;
                let userPreferences = new UserPreferences(kvdb, MailConst.USER_PREFERENCES_KVDB_KEY, eventDispatcher);
                notifications.value.forEach(x => {
                    userPreferences.defaults.notifications[x.userPreferencesKey] = x.defaultValue;
                });
                return userPreferences.load().thenResolve(userPreferences);
            });
        });
        this.registerByConstructor2(x => x.getUserPreferencesSynchronizer(), UserPreferencesSynchronizer, () => [this.getUserPreferences(), this.getIdentity(), this.getUserEntryService(), this.getPersons()]);
        this.registerByFactory(x => x.getPkiCache(), () => {
            return this.getKvdbMapWithMigration<any>(MailConst.PKI_CACHE_KVDB_INDEX, MailConst.PKI_CACHE_FILENAME, {}).then(kvdb => {
                return new PkiCache(kvdb);
            });
        });
        this.registerByFactory(x => x.getServerConfig(), () => {
            return this.getClient().then(client => {
                return client.getConfig();
            });
        });
        this.registerByFactory(x => x.getMailFilter(), () => {
            return this.getIdentity().then(identity => {
                let defaultData: {[domain: string]: {mode: FilterMode}} = {};
                defaultData[identity.host] = {mode: FilterMode.ALLOW};
                return this.getKvdbMapWithMigration<MailFilterEntry>(MailConst.MAIL_FILTER_KVDB_INDEX, MailConst.MAIL_FILTER_FILENAME, defaultData).then(kvdb => {
                    return new MailFilter(kvdb);
                });
            });
        });
        this.registerByConstructor2(x => x.getMailFilterCollection(), MailFilterCollection, () => [this.getMailFilter(), this.getSinkIndexManager()]);
        this.registerByFactory(x => x.getMailStats(), () => {
            return Q.all([this.getSinkIndexManager(), this.getMailFilterCollection(), this.getEventDispatcher()]).then(res => {
                let [sinkIndexManager, mailFilterCollection, eventDispatcher] = res;
                return new MailStats(sinkIndexManager.sinkIndexCollection, mailFilterCollection, eventDispatcher);
            });
        });
        this.registerByConstructor2(x => x.getSinkIndexChangeListener(), SinkIndexChangeListener, () => [this.getMessageSenderVerifier(), this.getMessageTagger(), this.getSectionKeyManager(), this.getSectionAccessManager(), this.getServerProxyService(), this.getAdminMessageHandler(), this.getPkiEventHandler(), this.getEventDispatcher()]);
        this.registerByConstructor2(x => x.getAdminDataReceiverService(), AdminDataReceiverService, () => [this.getSrpSecure(), this.getUserSettingsService()]);
        this.registerByValue(x => x.getExportMessagesService(), new ExportMessagesService());
        this.registerByConstructor2(x => x.getLastMessagesService(), LastMessagesService, () => [this.getSinkIndexManager(), this.getCollectionFactory()]);
        this.registerByConstructor2(x => x.getUtilApi(), UtilApi, () => [this.getSrpSecure()]);
        this.registerByConstructor2(x => x.getCollectionFactory(), CollectionFactory, () => [this.getMailFilterCollection(), this.getConversationService()]);
        this.registerByFactory(x => x.getLowUserProvider(), () => {
            return this.getLowUserService2();
        });
        this.registerByFactory(x => x.getUserEntryService(), () => {
            return Q.all([
                Q.all([
                    this.getLocaleService(),
                    this.getUserPreferences(),
                    this.getSinkIndexManager(),
                    this.getSrpSecure(),
                    this.getIdentityProfile(),
                    this.getAuthData()
                ]),
                Q.all([
                    this.getIdentity(),
                    this.getTagService(),
                    this.getMailFilter(),
                    this.getNotifications(),
                    this.getSinkProvider()
                ])
            ]).then(res => {
                let [a, b] = res;
                return new UserEntryService(a[0], a[1], a[2], a[3], a[4], a[5], b[0], b[1], b[2], b[3], b[4]);
            })
        });
        this.registerByFactory(x => x.getProfileProvider(), () => {
            return this.getUserPreferences().then(userPreferences => {
                return {
                    getProfile: () => {
                        return userPreferences.getValue("profile");
                    }
                };
            });
        });
        this.registerByConstructor2(x => x.getSinkProvider(), SinkProvider, () => [this.getSinkIndexManager()]);
        this.registerByFactory(x => x.getSinkIndexProvider(), () => {
            return this.getSinkIndexManager();
        });
        this.registerByConstructor2(x => x.getAdminKeyChecker(), AdminKeyChecker, () => [this.getAuthData(), this.getSrpSecure(), this.getAdminKeySender(), this.getAdminKeyHolder(), this.getIdentityProvider()]);
        this.registerByConstructor2(x => x.getAdminKeySender(), AdminKeySender, () => [this.getMessageService(), this.getAdminKeyHolder(), this.getIdentity()]);
        this.registerByConstructor2(x => x.getAdminKeyHolder(), AdminKeyHolder, () => [this.getAuthData(), this.getSrpSecure(), this.getEventDispatcher()]);
        this.registerByConstructor2(x => x.getSharedDbChecker(), SharedDbChecker, () => [
            this.getSharedKvdbFromAdminDb(),
            this.getAuthData(),
            this.getAdminKvdb(),
            this.getMessageManager(),
            this.getSharedDbAdminService(),
            this.getIdentityProvider()
        ]);
        this.registerByConstructor2(x => x.getSharedDbAdminService(), SharedDbAdminService, () => [
            this.getIdentity(),
            this.getSrpSecure(),
            this.getUserSettingsService(),
            this.getMessageService(),
            this.getSharedKvdbExtKeyFromAdminDb()
        ]);
        this.registerByFactory(x => x.getSharedKvdbExtKeyFromAdminDb(), () => {
            return this.getSharedKvdbFromAdminDb().then(x => x.extKey);
        });
        this.registerByConstructor2(x => x.getAdminDataCreatorService(), AdminDataCreatorService, () => [
            this.getAdminKey(),
            this.getSrpSecure(),
            this.getIdentity()
        ]);
        this.registerByFactory(x => x.getAdminKey(), () => {
            return this.getAdminKeyHolder().then(holder => {
                if (holder.adminKey == null) {
                    throw new Error("Empty admin key");
                }
                return holder.adminKey;
            });
        });
        this.registerByConstructor2(x => x.getAdminMessageHandler(), AdminMessageHandler, () => [
            this.getSrpSecure(),
            this.getUserSettingsService(),
            this.getMessageFlagsUpdater(),
            this.getAdminKeyHolder()
        ]);
        this.registerByConstructor2(x => x.getPkiEventHandler(), PkiEventHandler, () => [
            this.getSrpSecure(),
            this.getMessageFlagsUpdater()
        ]);
        this.registerByFactory(x => x.getMessageSender(), () => {
            return this.getMessageService();
        });
        this.registerByFactory(x => x.getMessagesCollection(), () => {
            return this.getMailFilterCollection().then(mailFilterCollection => mailFilterCollection.messagesCollection);
        });
        this.registerByFactory(x => x.getLocalStorage(), () => {
            return Q.all([this.getSettingsExtKey(), this.getUnecryptedLocalStorage()]).then(res => {
                let [settingsExtKey, unecryptedLocalStorage] = res;
                return new EncryptedStorage(settingsExtKey.getChainCode(), unecryptedLocalStorage);
            });
        });
        this.registerByConstructor2(x => x.getConv2Service(), Conv2Service, () => [
            this.getSectionManager(),
            this.getContactService(),
            this.getPersonService(),
            this.getIdentity(),
            this.getMailStats()
        ]);
        this.registerByFactory(x => x.getUserCreationContextBuilder(), () => {
            return Q.all([this.getSrpSecure(), this.getAdminDataCreatorService(), this.getSharedKvdbExtKey()]).then(res => {
                let [srpSecure, adminDataCreatorService, sharedKvdbExtKey] = res;
                return new UserCreationContextBuilder(srpSecure.gateway, srpSecure.privmxPKI, adminDataCreatorService, sharedKvdbExtKey);
            });
        });
        this.registerByFactory(x => x.getApiSerializer(), () => new ApiSerializer());
        this.registerByConstructor2(x => x.getAddUserModelBuilder(), AddUserModelBuilder, () => [this.getApiSerializer()]);
        this.registerByConstructor2(x => x.getUserCreationApi(), UserCreationApi, () => [this.getGateway()]);
        this.registerByConstructor2(x => x.getUserCreationService(), UserCreationService, () => [
            this.getUserCreationContextBuilder(),
            this.getAddUserModelBuilder(),
            this.getUserCreationApi()
        ]);
        this.registerByConstructor2(x => x.getPrivateUserCreator(), PrivateUserCreator, () => [
            this.getAdminDataCreatorService(),
            this.getSharedKvdbExtKey(),
            this.getSrpSecure()
        ]);
        this.registerByConstructor2(x => x.getAdminRightService(), AdminRightService, () => [
            this.getSrpSecure(),
            this.getAdminKeySender(),
            this.getIdentity()
        ]);
        this.registerByConstructor2(x => x.getUserGroupCreatorService(), UserGroupCreatorService, () => [
            this.getContactService(),
            this.getPersonService(),
            this.getLocaleService(),
            this.getConv2Service(),
            this.getIdentity()
        ]);
        this.registerByConstructor2(x => x.getManagableUserCreator(), ManagableUserCreator, () => [
            this.getUserCreationService(),
            this.getAdminRightService(),
            this.getUserGroupCreatorService()
        ]);
    }
    
    getStickersProvider(): Q.Promise<section.StickersProvider> {
        return this.ioc.resolve("stickersProvider");
    }
    
    getConv2Service(): Q.Promise<Conv2Service> {
        return this.ioc.resolve("conv2Service");
    }
    
    getAdminDataCreatorService(): Q.Promise<AdminDataCreatorService> {
        return this.ioc.resolve("adminDataCreatorService");
    }
    
    getSharedKvdbExtKey(): Q.Promise<privfs.crypto.ecc.ExtKey> {
        return this.ioc.resolve("sharedKvdbExtKey");
    }
    
    getSharedKvdbExtKeyFromAdminDb(): Q.Promise<privfs.crypto.ecc.ExtKey> {
        return this.ioc.resolve("sharedKvdbExtKeyFromAdminDb");
    }
    
    getSharedDbAdminService(): Q.Promise<SharedDbAdminService> {
        return this.ioc.resolve("sharedDbAdminService");
    }
    
    getAdminKeySender(): Q.Promise<AdminKeySender> {
        return this.ioc.resolve("adminKeySender");
    }
    
    getAdminKeyHolder(): Q.Promise<AdminKeyHolder> {
        return this.ioc.resolve("adminKeyHolder");
    }
    
    getIdentity(): Q.Promise<privfs.identity.Identity> {
        return this.ioc.resolve("identity");
    }
    
    getIdentityProvider(): Q.Promise<utils.IdentityProvider> {
        return this.ioc.resolve("identityProvider");
    }
    
    getSrpSecure(): Q.Promise<privfs.core.PrivFsSrpSecure> {
        return this.ioc.resolve("srpSecure");
    }
    
    getGateway(): Q.Promise<privfs.gateway.RpcGateway> {
        return this.ioc.resolve("gateway");
    }
    
    getMasterExtKey(): Q.Promise<privfs.crypto.ecc.ExtKey> {
        return this.ioc.resolve("masterExtKey");
    }
    
    getAuthData(): Q.Promise<privfs.types.core.UserDataEx> {
        return this.ioc.resolve("authData");
    }
    
    getSystemFs(): Q.Promise<privfs.fs.file.FileSystem> {
        return this.ioc.resolve("systemFs");
    }
    
    getPrivateFs(): Q.Promise<privfs.fs.file.FileSystem> {
        return this.ioc.resolve("privateFs");
    }
    
    getClient(): Q.Promise<privfs.core.Client> {
        return this.ioc.resolve("client");
    }
    
    getMessageSenderVerifier(): Q.Promise<MessageSenderVerifier> {
        return this.ioc.resolve("messageSenderVerifier");
    }
    
    getHashmailResolver(): Q.Promise<HashmailResolver> {
        return this.ioc.resolve("hashmailResolver");
    }
    
    getMessageService(): Q.Promise<MessageService> {
        return this.ioc.resolve("messageService");
    }
    
    getTagService(): Q.Promise<privfs.message.TagService> {
        return this.ioc.resolve("tagService");
    }
    
    getTagProvider(): Q.Promise<mail.TagProvider> {
        return this.ioc.resolve("tagProvider");
    }
    
    getMessageTagsFactory(): Q.Promise<MessageTagsFactory> {
        return this.ioc.resolve("messageTagsFactory");
    }
    
    getMessageTagger(): Q.Promise<MessageTagger> {
        return this.ioc.resolve("messageTagger");
    }
    
    getMessageFlagsUpdater(): Q.Promise<MessageFlagsUpdater> {
        return this.ioc.resolve("messageFlagsUpdater");
    }
    
    getSubidentityApi(): Q.Promise<SubidentityApi> {
        return this.ioc.resolve("subidentityApi");
    }
    
    getCustomizationApi(): Q.Promise<CustomizationApi> {
        return this.ioc.resolve("customizationApi");
    }
    
    getSubidentityExtKey(): Q.Promise<privfs.crypto.ecc.ExtKey> {
        return this.ioc.resolve("subidentityExtKey");
    }
    
    getSubidentityService(): Q.Promise<SubidentityService> {
        return this.ioc.resolve("subidentityService");
    }
    
    getMessageManager(): Q.Promise<privfs.message.MessageManager> {
        return this.ioc.resolve("messageManager");
    }
    
    getLocalStorage(): Q.Promise<utils.IStorage> {
        return this.ioc.resolve("localStorage");
    }
    
    getWellKnownEncryptedLocalStorage(): Q.Promise<utils.IStorage> {
        return this.ioc.resolve("wellKnownEncryptedLocalStorage");
    }
    
    getUnecryptedLocalStorage(): Q.Promise<utils.Storage<string, string>> {
        return this.ioc.resolve("unecryptedLocalStorage");
    }
    
    getKeyValueDbManager(): Q.Promise<privfs.db.KeyValueDbManager> {
        return this.ioc.resolve("keyValueDbManager");
    }
    
    getKvdbCollectionManager(): Q.Promise<KvdbCollectionManager> {
        return this.ioc.resolve("kvdbCollectionManager");
    }
    
    getSettingsExtKey(): Q.Promise<privfs.crypto.ecc.ExtKey> {
        return this.ioc.resolve("settingsExtKey");
    }
    
    getUserSettingsKvdb(): Q.Promise<utils.IKeyValueDbCollection<KvdbSettingEntry>> {
        return this.ioc.resolve("userSettingsKvdb");
    }
    
    getUserSettingsKvdbStorage(): Q.Promise<KvdbSettingsStorage> {
        return this.ioc.resolve("userSettingsKvdbStorage");
    }
    
    getSharedKvdb(): Q.Promise<utils.IKeyValueDbCollection<KvdbSettingEntry>> {
        return this.ioc.resolve("sharedKvdb");
    }
    
    getSharedKvdbFromAdminDb(): Q.Promise<KvdbCollection<KvdbSettingEntry>> {
        return this.ioc.resolve("sharedKvdbFromAdminDb");
    }
    
    getAdminKey(): Q.Promise<privfs.crypto.ecc.ExtKey> {
        return this.ioc.resolve("adminKey");
    }
    
    getAdminKvdb(): Q.Promise<KvdbCollection<KvdbSettingEntry>> {
        return this.ioc.resolve("adminKvdb");
    }
    
    getUserConfig(): Q.Promise<app.ConfigEx> {
        return this.ioc.resolve("userConfig");
    }
    
    getSubidentityKeyUpdater(): Q.Promise<SubidentityKeyUpdater> {
        return this.ioc.resolve("subidentityKeyUpdater");
    }
    
    getFileSizeChecker(): Q.Promise<FileSizeChecker> {
        return this.ioc.resolve("fileSizeChecker");
    }
    
    getConversationService(): Q.Promise<ConversationService> {
        return this.ioc.resolve("conversationService");
    }
    
    getSectionManager(): Q.Promise<SectionManager> {
        return this.ioc.resolve("sectionManager");
    }
    
    getSectionConversationService(): Q.Promise<SectionConversationService> {
        return this.ioc.resolve("sectionConversationService");
    }
    
    getSectionApi(): Q.Promise<SectionApi> {
        return this.ioc.resolve("sectionApi");
    }
    
    getSectionKeyManager(): Q.Promise<SectionKeyManager> {
        return this.ioc.resolve("sectionKeyManager");
    }
    
    getSectionAccessManager(): Q.Promise<SectionAccessManager> {
        return this.ioc.resolve("sectionAccessManager");
    }
        
    
    getSectionAdminSink(): Q.Promise<SectionAdminSink> {
        return this.ioc.resolve("sectionAdminSink");
    }
    
    getContactService(): Q.Promise<ContactService> {
        return this.ioc.resolve("contactService");
    }
    
    // getContactPresenceCheck(): Q.Promise<ContactPresenceCheck> {
    //     return this.ioc.resolve("contactPresenceCheck");
    // }
    
    getPersons(): Q.Promise<Persons> {
        return this.ioc.resolve("persons");
    }
    
    getServerProxyService(): Q.Promise<ServerProxyService> {
        return this.ioc.resolve("serverProxyService");
    }

    getSessionManager(): Q.Promise<SessionManager> {
        return this.ioc.resolve("sessionManager");
    }
    
    getPersonService(): Q.Promise<PersonService> {
        return this.ioc.resolve("personService");
    }
    
    getIdentityProfile(): Q.Promise<IdentityProfile> {
        return this.ioc.resolve("identityProfile");
    }
    
    getSinkIndexManager(): Q.Promise<SinkIndexManager> {
        return this.ioc.resolve("sinkIndexManager");
    }
    
    getPublicSectionsKey(): Q.Promise<privfs.crypto.ecc.ExtKey> {
        return this.ioc.resolve("publicSectionsKey");
    }
    
    getAdminSinkReceiver(): Q.Promise<privfs.message.MessageReceiver> {
        return this.ioc.resolve("adminSinkReceiver");
    }
    
    getAdminSink(): Q.Promise<privfs.message.MessageSinkPriv> {
        return this.ioc.resolve("adminSink");
    }
    
    getSinkEncryptor(): Q.Promise<privfs.crypto.utils.ObjectEncryptor> {
        return this.ioc.resolve("sinkEncryptor");
    }
    
    getSinkService(): Q.Promise<SinkService> {
        return this.ioc.resolve("sinkService");
    }
    
    getNetworkStatusService(): Q.Promise<NetworkStatusService> {
        return this.ioc.resolve("networkStatusService");
    }
    
    getUserAdminService(): Q.Promise<UserAdminService> {
        return this.ioc.resolve("userAdminService");
    }
    
    getMailQueryService(): Q.Promise<MailQueryService> {
        return this.ioc.resolve("mailQueryService");
    }
    
    getLowUserProvider(): Q.Promise<mail.LowUserProvider> {
        return this.ioc.resolve("lowUserProvider");
    }
    
    getLowUserRegistry(): Q.Promise<LowUserRegistry> {
        return this.ioc.resolve("lowUserRegistry");
    }
    
    getLowUserService(): Q.Promise<LowUserService> {
        return this.ioc.resolve("lowUserService");
    }
    
    getLowUserService2(): Q.Promise<LowUserService2> {
        return this.ioc.resolve("lowUserService2");
    }
    
    getSinkIndexProvider(): Q.Promise<mail.SinkIndexProvider> {
        return this.ioc.resolve("sinkIndexProvider");
    }
    
    getSinkProvider(): Q.Promise<SinkProvider> {
        return this.ioc.resolve("sinkProvider");
    }
    
    getKvdbPollInterval(): Q.Promise<utils.Option<number>> {
        return this.ioc.resolve("kvdbPollInterval");
    }
    
    getMaxFileSize(): Q.Promise<utils.Option<number>> {
        return this.ioc.resolve("maxFileSize");
    }
    
    getProfileProvider(): Q.Promise<mail.ProfileProvider> {
        return this.ioc.resolve("profileProvider");
    }
    
    getMessagesCollection(): Q.Promise<BaseCollection<SinkIndexEntry>> {
        return this.ioc.resolve("messagesCollection");
    }
    
    getTaskStream(): Q.Promise<ParallelTaskStream> {
        return this.ioc.resolve("taskStream");
    }
    
    getSectionKeyManagerOptions(): Q.Promise<SectionKeyManagerOptions> {
        return this.ioc.resolve("sectionKeyManagerOptions");
    }
    
    getUserPreferences(): Q.Promise<UserPreferences> {
        return this.ioc.resolve("userPreferences");
    }
    
    getForcedPublishPresenceType(): Q.Promise<utils.Option<string>> {
        return this.ioc.resolve("forcedPublishPresenceType");
    }
    
    getSinkFilter(): Q.Promise<utils.Option<mail.SinkFilter>> {
        return this.ioc.resolve("sinkFilter");
    }
    
    getMessageSender(): Q.Promise<utils.MessageSender> {
        return this.ioc.resolve("messageSender");
    }
    
    getSectionManagerOptions(): Q.Promise<SectionManagerOptions> {
        return this.ioc.resolve("sectionManagerOptions");
    }
    
    getCosignerService(): Q.Promise<CosignerService> {
        return this.ioc.resolve("cosignerService");
    }
    
    getLocaleService(): Q.Promise<LocaleService> {
        return this.ioc.resolve("localeService");
    }
    
    getUserSettingsService(): Q.Promise<UserSettingsService> {
        return this.ioc.resolve("userSettingsService");
    }
    
    getEventDispatcher(): Q.Promise<EventDispatcher> {
        return this.ioc.resolve("eventDispatcher");
    }
    
    getUserPreferencesSynchronizer(): Q.Promise<UserPreferencesSynchronizer> {
        return this.ioc.resolve("userPreferencesSynchronizer");
    }
    
    getPkiCache(): Q.Promise<PkiCache> {
        return this.ioc.resolve("pkiCache");
    }
    
    getUserEntryService(): Q.Promise<UserEntryService> {
        return this.ioc.resolve("userEntryService");
    }
    
    getNotifications(): Q.Promise<utils.Option<mail.NotificationEntry[]>> {
        return this.ioc.resolve("notifications");
    }
    
    getServerConfig(): Q.Promise<privfs.types.core.ServerConfig> {
        return this.ioc.resolve("serverConfig");
    }
    
    getMailFilter(): Q.Promise<MailFilter> {
        return this.ioc.resolve("mailFilter");
    }
    
    getMailFilterCollection(): Q.Promise<MailFilterCollection> {
        return this.ioc.resolve("mailFilterCollection");
    }
    
    getMailStats(): Q.Promise<MailStats> {
        return this.ioc.resolve("mailStats");
    }
    
    getAdminKeyChecker(): Q.Promise<AdminKeyChecker> {
        return this.ioc.resolve("adminKeyChecker");
    }
    
    getSharedDbChecker(): Q.Promise<SharedDbChecker> {
        return this.ioc.resolve("sharedDbChecker");
    }
    
    getSinkIndexChangeListener(): Q.Promise<SinkIndexChangeListener> {
        return this.ioc.resolve("sinkIndexChangeListener");
    }
    
    getAdminDataReceiverService(): Q.Promise<AdminDataReceiverService> {
        return this.ioc.resolve("adminDataReceiverService");
    }
    
    getMailResourceLoader(): Q.Promise<mail.MailResourceLoader> {
        return this.ioc.resolve("mailResourceLoader");
    }
    
    getAdminMessageHandler(): Q.Promise<AdminMessageHandler> {
        return this.ioc.resolve("adminMessageHandler");
    }
    
    getPkiEventHandler(): Q.Promise<PkiEventHandler> {
        return this.ioc.resolve("pkiEventHandler");
    }
    
    getExportMessagesService(): Q.Promise<ExportMessagesService> {
        return this.ioc.resolve("exportMessagesService");
    }
    
    getLastMessagesService(): Q.Promise<LastMessagesService> {
        return this.ioc.resolve("lastMessagesService");
    }
    
    getUtilApi(): Q.Promise<UtilApi> {
        return this.ioc.resolve("utilApi");
    }
    
    getCollectionFactory(): Q.Promise<CollectionFactory> {
        return this.ioc.resolve("collectionFactory");
    }
    
    getUserCreationContextBuilder(): Q.Promise<UserCreationContextBuilder> {
        return this.ioc.resolve("userCreationContextBuilder");
    }
    
    getApiSerializer(): Q.Promise<ApiSerializer> {
        return this.ioc.resolve("apiSerializer");
    }
    
    getAddUserModelBuilder(): Q.Promise<AddUserModelBuilder> {
        return this.ioc.resolve("addUserModelBuilder");
    }
    
    getUserCreationService(): Q.Promise<UserCreationService> {
        return this.ioc.resolve("userCreationService");
    }
    
    getUserCreationApi(): Q.Promise<UserCreationApi> {
        return this.ioc.resolve("userCreationApi");
    }
    
    getPrivateUserCreator(): Q.Promise<PrivateUserCreator> {
        return this.ioc.resolve("privateUserCreator");
    }
    
    getAdminRightService(): Q.Promise<AdminRightService> {
        return this.ioc.resolve("adminRightService");
    }
    
    getUserGroupCreatorService(): Q.Promise<UserGroupCreatorService> {
        return this.ioc.resolve("userGroupCreatorService");
    }
    
    getManagableUserCreator(): Q.Promise<ManagableUserCreator> {
        return this.ioc.resolve("managableUserCreator");
    }
}
