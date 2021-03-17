import {PrivmxRegistry} from "./PrivmxRegistry";
import {event, section, utils} from "../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import * as pki from "privmx-pki";
import {SectionManager} from "./section/SectionManager";
import {SectionUtils} from "./section/SectionUtils";
import {PromiseUtils} from "simplito-promise";
import {LazyLoader} from "./LazyLoader";
import {MailConst} from "./MailConst";
import * as RootLogger from "simplito-logger";
import {MessageTagsFactory} from "./MessageTagsFactory";
import {IOC} from "./IOC";
import {ChatModuleService} from "./section/ModuleService";
import {Path} from "./filetree/Path";
import {Lang} from "../utils/Lang";
import { CommonApplication } from "../app/common";
import { SectionService } from "./section/SectionService";

import { Directory } from "./filetree/NewTree";
import { RegisterParams } from "./McaFactory";
import { SerializedContactsFile, SerializedContact } from "./contact/Contact";
import { UUID } from "../utils/UUID";
let Logger = RootLogger.get("privfs-mail-client.mail.MailClientApi");

export class MailClientApi {
    
    static IMPORTED_DEMO_CONTENT_PATH = "/importedDemoContent.json";
    
    lazyLoader: LazyLoader;
    
    constructor(
        public app: CommonApplication,
        public privmxRegistry: PrivmxRegistry
    ) {
        this.lazyLoader = new LazyLoader();
    }
    
    static create(
        app: CommonApplication,
        authData: privfs.types.core.UserDataEx,
        ioc: IOC
    ): Q.Promise<MailClientApi> {
        if (authData && authData.myData.presence) {
            authData.myData.presence.extra = "all";
        }
        let isAdmin = authData.myData.raw.isAdmin === true;
        let privmxRegistry = new PrivmxRegistry(ioc);
        privmxRegistry.registerLoginData(authData.identity, authData.srpSecure, authData.masterExtKey, authData);
        privmxRegistry.registerByValue(x => x.getIdentityProvider(), {
            getIdentity: () => authData.identity,
            isAdmin: () => isAdmin,
            getLogin: () => authData.myData.raw.login,
            getType: () => authData.myData.raw.type,
            getRights: () => authData.myData.raw.rights
        });
        privmxRegistry.registerByValue(x => x.getSectionManagerOptions(), {fetchAllSection: true});
        privmxRegistry.registerByValue(x => x.getSectionKeyManagerOptions(), {readAdminSink: isAdmin});
        privmxRegistry.registerServices();
        let mca = new MailClientApi(app, privmxRegistry);
        return mca.adminCheck().thenResolve(mca);
    }
    
    destroy() {
        this.lazyLoader.destroy();
    }
    
    prepareSession(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("prepareSession", {}, () => {
            return Q().then(() => {
                return this.overwritePki();
            })
            .then(() => {
                return this.loadUserPreferences();
            })
            .then(() => {
                return this.bindMailFilterChangeWithUserEntryPublish();
            })
            .then(() => {
                return this.prepareContactService();
            })
            .then(() => {
                return this.adminCheck();
            })
            .then(() => {
                return this.prepareMessages();
            })
            .then(() => {
                return this.prepareSectionManager();
            })
            .then(() => {
                return this.checkInitData();
            })
            .then(() => {
                return this.publishStatusAndTurnOnPolling();
            })
        });
    }
    
    checkLoginCore() {
        return this.prepareSession();
    }
    
    registrationSession(registerKey: string, customName?: string, extra?: RegisterParams): Q.Promise<void> {
        let creatorHashmail = extra && extra.creatorHashmail ? extra.creatorHashmail : undefined;
        
        return PromiseUtils.notify(notify => {
            return Q().then(() => {
                notify("code.initClient");
                return this.adminCheck();
            })
            .then(() => {
                return this.privmxRegistry.getAdminDataReceiverService().then(adminDataReceiverService => {
                    return adminDataReceiverService.processAdminDataForUser(registerKey);
                });
            })
            .then(() => {
                notify("code.createSinks");
                return this.privmxRegistry.getSinkService().then(sinkService => {
                    return sinkService.loadSinks()
                });
            })
            .then(() => {
                notify("code.createFiles");
                return Q.all([
                    this.overwritePki(),
                    this.prepareContactService(),
                    this.privmxRegistry.getMailFilter(),
                    this.privmxRegistry.getLowUserService()
                ]);
            })
            .then(() => {
                return Q.all([
                    this.privmxRegistry.getUserPreferences(),
                    this.privmxRegistry.getLocaleService(),
                    this.privmxRegistry.getAuthData(),
                    this.privmxRegistry.getNotifications(),
                ])
                .then(res => {
                    let [userPreferences, localeService, authData, notifications] = res;
                    let settings: {[name: string]: any} = {"ui.lang": localeService.currentLang};
                    if (authData.myData.raw.notificationsEntry && authData.myData.raw.notificationsEntry.email) {
                        notifications.value.forEach(x => {
                            settings["notifications." + x.userPreferencesKey] = x.defaultValue;
                        });
                        settings["notifications.enabled"] = true;
                        settings["notifications.email"] = authData.myData.raw.notificationsEntry.email;
                    }
                    if (customName) {
                        settings["profile.name"] = customName;
                    }

                    if (extra && extra.overrideWithProfile) {
                        settings["profile.name"] = extra.overrideWithProfile.name;
                        settings["profile.image"] = extra.overrideWithProfile.image;
                        settings["profile.description"] = extra.overrideWithProfile.description;
                    }
                    
                    return userPreferences.setMany(settings, true);
                });
            })
            .then(() => {
                notify("code.publishEntry");
                return this.privmxRegistry.getUserEntryService().then(userEntryService => {
                    return userEntryService.publishUserEntry();
                });
            })
            // .then(() => {
            //     notify("code.createInitData");
            //     return this.processInitData();
            // })
            .then(() => {
                return this.privmxRegistry.getContactService().then(contactService => {
                    return creatorHashmail ? contactService.createContact(creatorHashmail).then(() => contactService.getContactsDb()) : Q.resolve(null)
                });
            })
            .then(() => {
                return this.prepareSectionManager();
            })
            .fail(e => {
                Logger.error(e, e.stack);
            });
        });
    }
    
    initUserPreferencesForFirstUser(): Q.Promise<void> {
        return Q.all([
            this.privmxRegistry.getUserPreferences(),
            this.privmxRegistry.getLocaleService(),
            this.privmxRegistry.getAuthData(),
            this.privmxRegistry.getNotifications(),
        ])
        .then(res => {
            let [userPreferences, localeService, authData, notifications] = res;
            let settings: {[name: string]: any} = {"ui.lang": localeService.currentLang};
            if (authData.myData.raw.notificationsEntry && authData.myData.raw.notificationsEntry.email) {
                notifications.value.forEach(x => {
                    settings["notifications." + x.userPreferencesKey] = x.defaultValue;
                });
                settings["notifications.enabled"] = true;
                settings["notifications.email"] = authData.myData.raw.notificationsEntry.email;
            }
            return userPreferences.setMany(settings, true);
        });
    }

    processInitData() {
        return Q.all([
            Q.all([
                this.privmxRegistry.getSrpSecure(),
                this.privmxRegistry.getSinkService(),
                this.privmxRegistry.getMessageManager(),
                this.privmxRegistry.getContactService(),
                this.privmxRegistry.getPrivateFs(),
                this.privmxRegistry.getMessageService()
            ]),
            Q.all([
                this.privmxRegistry.getIdentity(),
                this.privmxRegistry.getMailResourceLoader(),
                this.privmxRegistry.getSinkEncryptor(),
                this.privmxRegistry.getUserPreferences()
            ])
        ])
        .then(res => {
            let [srpSecure, sinkService, messageManager, contactService, privateFs, messageService] = res[0];
            let [identity, mailResourceLoader, sinkEncryptor, userPreferences] = res[1];
            
            return Q().then(() => {
                return userPreferences.set("actions.initDataProcessed", true, true);
            })
            .then(() => {
                return srpSecure.getInitData();
            })
            .then(initData => {
                let counts: {[name: string]: number} = {};
                initData.forEach(task => {
                    if (counts[task.type]) {
                        counts[task.type]++;
                    }
                    else {
                        counts[task.type] = 1;
                    }
                });
                return Q().then(() => {
                    if (counts["sendMail"]) {
                        let inbox = sinkService.findFirstPublicInbox();
                        return messageManager.sinkSetLastSeenSeq(inbox.id, counts["sendMail"]);
                    }
                })
                .then(() => {
                    return PromiseUtils.oneByOne(initData, (_i, task) => {
                        return Q().then((): any => {
                            if (task.type == "addContact") {
                                return contactService.createContact((<privfs.types.core.InitDataAddContact>task).hashmail);
                            }
                            if (task.type == "addFile") {
                                let t = <privfs.types.core.InitDataAddFile>task;
                                return privateFs.create("/" + t.name, privfs.lazyBuffer.Content.createFromBase64(t.content, t.mimetype));
                            }
                            if (task.type == "sendMail") {
                                let t = <privfs.types.core.InitDataSendMail>task;
                                return Q().then(() => {
                                    if (!t.attachments || t.attachments.length == 0) {
                                        return mailResourceLoader.getResourceSafe("welcomeMailPic").then(r => {
                                            return r ? [{
                                                name: r.name,
                                                mimetype: r.mimetype,
                                                content: r.content.toString("base64")
                                            }] : [];
                                        });
                                    }
                                    return t.attachments
                                })
                                .then(attachments => {
                                    let inbox = sinkService.findFirstPublicInbox();
                                    let receiver = new privfs.message.MessageReceiver(inbox, identity);
                                    let message = messageService.createMessage(receiver, t.subject, new Buffer(t.content, "base64").toString("utf8"));
                                    message.contentType = "html";
                                    attachments.forEach(attachment => {
                                        message.addAttachment(privfs.lazyBuffer.Content.createFromBase64(attachment.content, attachment.mimetype, attachment.name));
                                    });
                                    return messageManager.messagePost(message, MessageTagsFactory.getMessageTags(message));
                                });
                            }
                            if (task.type == "addSink") {
                                let t = <privfs.types.core.InitDataAddSink>task;
                                if (t.sinkType == "anonymous") {
                                    return messageManager.sinkCreate(t.name, "", "anonymous", {type: "form"}, sinkEncryptor, t.options);
                                }
                            }
                            if (task.type == "importSections") {
                                let t = <ImportSectionsTask><any>task;
                                return this.importSections(t.data, t.customElementsSettings);
                            }
                        })
                        .fail(e => {
                            Logger.error("Cannot perform init data task", task, e, e.stack);
                        });
                    });
                })
            });
        })
    }
    
    adminCheck(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("adminCheck",{}, () => {
            return this.privmxRegistry.getIdentityProvider().then(ip => {
                if (!ip.isAdmin()) {
                    return;
                }
                return this.checkAdminKey().then(success => {
                    return success ? this.checkSharedDb() : null;
                });
            })
        });
    }
    
    checkInitData(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("checkInitData", {}, () => {
            return this.privmxRegistry.getUserPreferences().then(userPreferences => {
                let initDataProcessed = userPreferences.getValue("actions.initDataProcessed");
                if (initDataProcessed === false) {
                    return this.processInitData();
                }
                if (initDataProcessed === true) {
                    //do nothing
                    return;
                }
                // old version set true
                return userPreferences.set("actions.initDataProcessed", true, true);
            })
        });
    }
        
    publishStatusAndTurnOnPolling(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("publishStatusAndTurnOnPolling",{}, () => {
            return Q.all([
                Q.all([
                    this.privmxRegistry.getSinkIndexManager(),
                    this.privmxRegistry.getKvdbCollectionManager(),
                    this.privmxRegistry.getNetworkStatusService(),
                    this.privmxRegistry.getUserEntryService()
                ]),
                this.privmxRegistry.getGateway()
            ])
            .then(res => {
                let [sinkIndexManager, kvdbCollectionManager, networkStatusService, userEntryService] = res[0];
                let gateway = res[1];
                networkStatusService.gateway = gateway;
                networkStatusService.registerService({
                    restore: () => sinkIndexManager.startSinkPolling(),
                    pause: () => sinkIndexManager.stopSinkPolling()
                });
                networkStatusService.registerService({
                    restore: () => kvdbCollectionManager.startPolling(),
                    pause: () => kvdbCollectionManager.stopPolling()
                });
                if (networkStatusService.networkActivityIsPaused()) {
                    return;
                }
                sinkIndexManager.startSinkPolling();
                kvdbCollectionManager.poll();
                return userEntryService.publishUserEntry();
            })
        });
    }
    
    prepareMessages(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("prepareMessages",{}, () => {
            return Q.all([
                this.privmxRegistry.getSinkIndexManager(),
                this.privmxRegistry.getSinkService(),
                this.privmxRegistry.getEventDispatcher(),
                this.privmxRegistry.getSinkIndexChangeListener()
            ])
            .then(res => {
                let [sinkIndexManager, sinkService, eventDispatcher, sinkIndexChangeListener] = res;
                sinkIndexManager.changeEvent.add(sinkIndexChangeListener.onSinkIndexManagerChange.bind(sinkIndexChangeListener), "multi");
                return sinkService.loadSinks().then(() => {
                    let promises = eventDispatcher.dispatchEventGather(<event.SinkIndexManagerReady>{type: "sinkindexmanagerready"});
                    return Q.all(promises.filter(x => !!x)).thenResolve(null);
                })
            });
        });
    }
    
    checkAdminKey(): Q.Promise<boolean> {
        return this.lazyLoader.registerWithDeps("checkAdminKey",{}, () => {
            return this.privmxRegistry.getAdminKeyChecker().then(adminKeyChecker => {
                return adminKeyChecker.checkAdminKey();
            });
        });
    }
    
    checkSharedDb(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("checkSharedDb",{}, () => {
            return this.privmxRegistry.getSharedDbChecker().then(sharedDbChecker => {
                return sharedDbChecker.checkSharedDb();
            });
        });
    }
    
    prepareContactService(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("contactService",{}, () => {
            return Q.all([
                this.privmxRegistry.getContactService(),
                this.privmxRegistry.getKvdbCollectionManager(),
                this.privmxRegistry.getSystemFs(),
                this.privmxRegistry.getPersons()
            ])
            .then(res => {
                let [contactService, kvdbCollectionManager, systemFs, persons] = res;
                return Q().then(() => {
                    return kvdbCollectionManager.getOrCreateMapByIndex<SerializedContact>(MailConst.CONTACTS_KVDB_INDEX, {})
                })
                .then(kvdb => {
                    if (kvdb.newlyCreated) {
                        return Q().then(() => {
                            return systemFs.optRead(MailConst.CONTACTS_FILENAME);
                        })
                        .then(content => {
                            if (content == null) {
                                return;
                            }
                            let data: SerializedContactsFile;
                            try {
                                data = content.getJson();
                            }
                            catch (e) {
                                return;
                            }
                            if (typeof(data) != "object" || data == null || !Array.isArray(data.items)) {
                                return;
                            }
                            let map: {[hashmail: string]: SerializedContact} = {};
                            data.items.forEach(x => {
                                if (x && x.user && x.user.hashmail) {
                                    map[x.user.hashmail] = x;
                                }
                            });
                            return kvdb.setMany(map);
                        })
                        .thenResolve(kvdb);
                    }
                    return kvdb;
                })
                .then(kvdb => {
                    return contactService.init(kvdb);
                })
                .then(() => {
                    persons.refreshIdentityContactCore();
                });
            });
        });
    }
    
    bindMailFilterChangeWithUserEntryPublish(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("bindMailFilterChangeWithUserEntryPublish",{}, () => {
            return Q.all([
                this.privmxRegistry.getMailFilter(),
                this.privmxRegistry.getUserEntryService()
            ])
            .then(res => {
                let [mailFilter, userEntryService] = res;
                mailFilter.listChangeEvent.add(() => {
                    userEntryService.publishUserEntry();
                });
            })
        });
    }
    
    loadUserPreferences() {
        return this.lazyLoader.registerWithDeps("loadUserPreferences",{}, () => {
            return Q().then(() => {
                return this.turnOnUserPreferencesSynchronizer();
            })
            .then(() => {
                return this.synchronizeLocaleServiceWithUserPreferences();
            })
        })
    }
    
    turnOnUserPreferencesSynchronizer(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("turnOnUserPreferencesSynchronizer", {}, () => {
            return Q().then(() => {
                return this.privmxRegistry.getEventDispatcher();
            })
            .then(eventDispatcher => {
                eventDispatcher.addEventListener<event.UserPreferencesChangeEvent>("userpreferenceschange", event => {
                    this.privmxRegistry.getUserPreferencesSynchronizer().then(ups => {
                        ups.onUserPreferencesChange(event);
                    });
                });
            });
        });
    }
    
    synchronizeLocaleServiceWithUserPreferences(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("synchronizeLocaleServiceWithUserPreferences",{}, () => {
            return Q.all([
                this.privmxRegistry.getUserPreferences(),
                this.privmxRegistry.getLocaleService()
            ])
            .then(res => {
                let [userPreferences, localeService] = res;
                let lang = userPreferences.getValue<string>("ui.lang");
                if (lang != localeService.currentLang) {
                    return userPreferences.set("ui.lang", localeService.currentLang, true);
                }
            });
        });
    }
    
    prepareSectionManager(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("prepareSectionManager", {}, () => {
            let manager: SectionManager, identity: privfs.identity.Identity, privateSectionId: section.SectionId, identityProvider: utils.IdentityProvider;
            return Q.all([
                this.privmxRegistry.getSectionManager(),
                this.privmxRegistry.getIdentity(),
                this.privmxRegistry.getIdentityProvider(),
            ])
            .then(res => {
                manager = res[0];
                identity = res[1];
                identityProvider = res[2];
                privateSectionId = SectionUtils.getPrivateSectionId(identity.user);
                return manager.load()
            })
            .then(() => {
                let rights = identityProvider.getRights();
                if (rights.indexOf("private_section_allowed") == -1) {
                    return null;
                }
                let privateSectionService = manager.getSection(privateSectionId);
                if (privateSectionService != null) {
                    return privateSectionService;
                }
                return Q().then(() => {
                    return this.privmxRegistry.getPrivateFs();
                })
                .then(fs => {
                    return manager.createSection({
                        id: privateSectionId,
                        data: {
                            name: "<my>",
                            modules: {
                                file: {
                                    enabled: true,
                                    data: fs.rootRef.extPriv58
                                }
                            },
                            description: null,
                            extraOptions: null
                        },
                        group: {
                            type: "usernames",
                            users: [identity.user]
                        },
                        state: "enabled",
                        acl: {
                            createSubsections: {admins: false, all: false, users: [identity.user]},
                            manage: {admins: false, all: false, users: [identity.user]}
                        },
                        primary: false
                    }, false);
                });
            })
            .then(privateSection => {
                if (! privateSection) {
                    return;
                }
                let modules: section.ModuleInfo[] = [
                    {name: "chat", enabled: false},
                    {name: "file", enabled: true},
                    {name: "kvdb", enabled: true},
                    {name: "calendar", enabled: true},
                ];
                return PromiseUtils.oneByOne(modules, (_i, entry) => {
                    return privateSection.getAndCreateModule(entry.name, entry.enabled)
                    .fail(e => {
                        Logger.error("ERROR during adding module to private section", entry.name, e);
                    });
                });
            })
        });
    }
    
    prepareAndGetSectionManager(): Q.Promise<SectionManager> {
        return this.prepareSectionManager().then(() => {
            return this.privmxRegistry.getSectionManager()});
    }
    
    getServerKeystoreWithoutCosigners(srpSecure: privfs.core.PrivFsSrpSecure, domain: string): Q.Promise<pki.Types.keystore.IKeyStore2> {
        return Q().then(() => {
            let privmxPKI = privfs.core.PrivFsSrpSecure.createDefaultPki(srpSecure.gateway);
            return privmxPKI.setOptions({domain: domain})
            .then(() => {
                return privmxPKI.getServerKeyStore();
            })
        })
        .then(result => {
            return <pki.Types.keystore.IKeyStore2>result.keystore;
        });
    }
    
    overwritePki(): Q.Promise<void> {
        return this.lazyLoader.registerWithDeps("overwritePki", {}, () => {
            return Q.all([
                this.privmxRegistry.getSrpSecure(),
                this.privmxRegistry.getServerConfig(),
                this.privmxRegistry.getGateway(),
                this.privmxRegistry.getPkiCache(),
                this.privmxRegistry.getIdentityProvider(),
                this.privmxRegistry.getCosignerService()
            ])
            .then(res => {
                let [srpSecure, serverConfig, gateway, pkiCache, identityProvider, cosignersService] = res;
                srpSecure.privmxPKI = new privfs.pki.PrivmxPKI(gateway, gateway.getHost());
                let maxCosigners = serverConfig.maxCosigners;
                if (maxCosigners <= 0 || maxCosigners >= MailConst.MAX_COSIGNERS) {
                    maxCosigners = MailConst.MAX_COSIGNERS;
                }
                srpSecure.privmxPKI.setOptions({domain: gateway.getHost()})
                .then(() => {
                    return Q().then(() => {
                        return Q().then(() => {
                            return srpSecure.getPublishedCosigners();
                        })
                        .then(cosigners => {
                            if (Object.keys(cosigners).length == 0) {
                                throw new Error("Empty cosigners list");
                            }
                            return cosigners;
                        })
                        .fail(e => {
                            Logger.debug("Cannot load cosigners, fixing...", e, (e ? e.stack : null));
                            let cosigners: {[domain: string]: privfs.pki.Types.keystore.IKeyStore2} = {};
                            return Q().then(() => {
                                return this.getServerKeystoreWithoutCosigners(srpSecure, gateway.getHost());
                            })
                            .then(keystore => {
                                cosigners[gateway.getHost()] = keystore;
                                if (identityProvider.isAdmin()) {
                                    var data = {
                                        state: "ACTIVE",
                                        uuid: UUID.generateUUID(),
                                        hashmail: identityProvider.getIdentity().hashmail,
                                        keystore: keystore
                                    };
                                    Q.all([
                                        srpSecure.publishCosigners(identityProvider.getIdentity().priv, cosigners),
                                        srpSecure.setCosigner(gateway.getHost(), data)
                                    ])
                                    .fail((e) => {
                                        Logger.error("Cannot publish cosigner", e, (e ? e.stack: null));
                                    });
                                }

                                return cosigners;
                            });
                        })
                    })
                })

                .then(cosigners => {
                    cosignersService.trustedServers = new privfs.pki.CosignersProvider.CosignersProvider(cosigners, maxCosigners);
                    srpSecure.privmxPKI = new privfs.pki.PrivmxPKI(gateway, gateway.getHost(), cosignersService.trustedServers, pkiCache, pkiCache);
                    return srpSecure.privmxPKI.getHead();
                });
            });
        })
    }
    
    exportSections(app: CommonApplication): Q.Promise<ExportedData> {
        let result: ExportedData;
        let localSession = this.app.sessionManager.getLocalSession();

        return Q.all([
            this.privmxRegistry.getSectionManager(),
            this.privmxRegistry.ioc.resolve("tasksPlugin"),
            this.privmxRegistry.ioc.resolve("notes2Plugin"),
            this.privmxRegistry.getIdentity(),
            this.privmxRegistry.getIdentityProvider(),
            this.privmxRegistry.getSrpSecure(),
        ])
        .then(res => {
            let [sectionManager, tasksPlugin, notes2Plugin, identity, identityProvider, srpSecure] = res;
            let myHashmail = identity.hashmail;
            return (identityProvider.isAdmin() ? srpSecure.getConfigEx() : Q(null)).then(serverConfigEx => {
                result = {
                    date: new Date().getTime(),
                    hostname: identity.host,
                    user: identity.user,
                    os: app.getOs(),
                    appVersion: app.getVersion().str,
                    serverVersion: serverConfigEx ? serverConfigEx.serverVersion : null,
                    sections: [],
                    customElementsSettings: {},
                };
                return PromiseUtils.oneByOne(sectionManager.filteredCollection.list.filter(x => x.hasAccess()), (_i, section) => {
                    if (section.isUserGroup()) {
                        return;
                    }
                    let didToPathMap: {[did: string]: string} = {};
                    let parent = section.getParent();
                    let readAccess: ExportedSectionAccess = "all";
                    if (section.sectionData.group.type == SectionUtils.GROUP_TYPE_ADMIN) {
                        readAccess = "admins";
                    }
                    else if (section.sectionData.group.type == SectionUtils.GROUP_TYPE_ALL_LOCAL_USERS) {
                        readAccess = "all";
                    }
                    else if (section.sectionData.group.type == SectionUtils.GROUP_TYPE_SELECTED_USERS) {
                        if (section.sectionData.group.users.indexOf(identity.user) != -1) {
                            readAccess = "me";
                        }
                    }
                    let getSectionAccess = (acl: section.AclEntry): ExportedSectionAccess => {
                        if (acl && acl.admins) {
                            return "admins";
                        }
                        if (acl && acl.all) {
                            return "all";
                        }
                        if (acl && acl.users && acl.users.indexOf(identity.user) != -1) {
                            return "me";
                        }
                        return "admins";
                    };
                    let acl = section.getAcl();
                    let exported: ExportedSection = {
                        // General
                        name: section.getName(),
                        originalId: section.getId(),
                        parentOriginalId: parent ? parent.getId() : null,
                        primary: section.sectionData.primary,
                        extraOptions: section.secured.extraOptions,
                        description: section.secured.description,
                        modules: [],
                        acl: {
                            read: readAccess,
                            manage: getSectionAccess(acl.manage),
                            createSubsections: getSectionAccess(acl.createSubsections)
                        },
                        
                        // Chat
                        messages: [],
                        
                        // Files
                        directories: [],
                        files: [],
                        filesSettings: {
                            viewMode: null,
                        },
                        
                        // Tasks
                        taskGroups: [],
                        tasks: [],
                        tasksSettings: {
                            viewMode: tasksPlugin ? tasksPlugin.getViewMode(localSession, section.getId()) : null,
                            kanban: tasksPlugin ? tasksPlugin.getIsKanban(localSession, section.getId()) : null,
                            horizontalLayout: tasksPlugin ? tasksPlugin.getIsHorizontalLayout(localSession, section.getId()) : null,
                        },
                    };
                    for (let name in section.secured.modules) {
                        exported.modules.push({
                            name: name,
                            enabled: section.secured.modules[name].enabled
                        });
                    }
                    result.sections.push(exported);
                    Logger.debug("Section", exported.name);
                    return Q().then(() => {
                        if (!section.hasChatModule()) {
                            return;
                        }
                        return Q().then(() => {
                            return section.getChatSinkIndex();
                        })
                        .then(sinkIndex => {
                            sinkIndex.entries.forEach(x => {
                                if (x.source.data.type == ChatModuleService.CHAT_MESSAGE_TYPE
                                    && x.source.data.contentType != "application/json"
                                    && x.source.data.sender
                                    && x.source.data.sender.hashmail == myHashmail
                                    && x.source.data.text) {
                                    exported.messages.push({
                                        text: x.source.data.text,
                                        type: x.source.data.contentType
                                    });
                                }
                            });
                        });
                    })
                    .then(() => {
                        if (!section.hasFileModule()) {
                            return;
                        }
                        return Q().then(() => {
                            if (notes2Plugin) {
                                let id = this.getSectionIdForNotes2Settings(section);
                                return notes2Plugin.loadSettings(localSession, id).then(() => {
                                    exported.filesSettings.viewMode = notes2Plugin.getSetting(localSession, "view-mode", id, "notes2");
                                });
                            }
                        }).then(() => {
                            Logger.debug("Reading files tree", exported.name);
                            return section.getFileTree();
                        })
                        .then(fileTree => {
                            Logger.debug("Refreshing files tree", exported.name);
                            return fileTree.refreshDeep(true).thenResolve(fileTree);
                        })
                        .then(fileTree => {
                            return PromiseUtils.oneByOne(fileTree.collection.list, (_i, entry) => {
                                Logger.debug("File tree element", exported.name, entry.path);
                                if (entry.path.indexOf("/.trash") == 0) {
                                    return;
                                }
                                if (entry.isDirectory()) {
                                    exported.directories.push({path: entry.path});
                                    return;
                                }
                                // if (entry.meta && entry.meta.size > 50000) {
                                //     return;
                                // }
                                return Q.all([
                                    fileTree.fileSystem.read(entry.path),
                                    fileTree.fileSystem.fsd.manager.getDescriptorVersions(entry.ref),
                                ]).then(res => {
                                    let [content, descriptor] = res;
                                    return Q.all([
                                        Q.all(descriptor.versions.map(x => x.getExtra((<privfs.fs.descriptor.ref.DescriptorRefRead>entry.ref).readKey))),
                                        Q.all(descriptor.versions.map(x => x.getContent((<privfs.fs.descriptor.ref.DescriptorRefRead>entry.ref).readKey))),
                                    ])
                                    .then(data => {
                                        let [extras, contents] = data;
                                        didToPathMap[entry.ref.did] = entry.path;
                                        exported.files.push({
                                            path: entry.path,
                                            mimetype: content.getMimeType(),
                                            content: content.getBase64(),
                                            history: descriptor.versions.map((x, i) => {
                                                let extra = extras[i];
                                                let cnt = contents[i];
                                                return {
                                                    date: extra.meta.modifiedDate,
                                                    user: x.raw.modifier && x.raw.modifier != "guest" ? x.raw.modifier + "#" + identity.host : "",
                                                    content: cnt.getBase64(),
                                                };
                                            }),
                                        });
                                    });
                                })
                                .fail(() => {
                                        Logger.debug("Could not export", exported.name, entry.path);
                                    });
                            });
                        });
                    })
                    .then(() => {
                        if (!section.hasKvdbModule()) {
                            return;
                        }
                        Logger.debug("Reading tasks", exported.name);
                        if (tasksPlugin == null || tasksPlugin.taskGroups[localSession.hostHash] == null) {
                            return;
                        }
                        for (let id in tasksPlugin.taskGroups[localSession.hostHash]) {
                            let group = tasksPlugin.taskGroups[localSession.hostHash][id];
                            if (group.projectId == section.getId()) {
                                exported.taskGroups.push({
                                    id: group.id,
                                    name: group.name,
                                    icon: group.icon,
                                });
                            }
                        }
                        for (let id in tasksPlugin.tasks[localSession.hostHash]) {
                            let task = tasksPlugin.tasks[localSession.hostHash][id];
                            if (task.getProjectId() == section.getId() && !task.getIsTrashed()) {
                                let sTask: ExportedSectionTask = {
                                    description: task.getDescription(),
                                    status: task.getStatus(),
                                    groupIds: task.getTaskGroupIds(),
                                    attachments: (<string[]>task.getAttachments()).map(x => {
                                        let data = JSON.parse(x);
                                        return didToPathMap[data.did];
                                    }).filter(x => !!x),
                                    comments: tasksPlugin.getTaskCommentsForExport(localSession, task.getId()),
                                };
                                if (task.getStartTimestamp() && task.getEndTimestamp()) {
                                    sTask.calendar = {
                                        hour: task.getStartTimestamp() % (24 * 60 * 60 * 1000),
                                        timeSpan: task.getEndTimestamp() - task.getStartTimestamp(),
                                        wholeDays: task.getWholeDays()
                                    };
                                }
                                exported.tasks.push(sTask);
                            }
                        }
                        Logger.debug("Section exported", exported.name);
                    })
                })
                .then(() => {
                    let proms: Q.Promise<void>[] = [];
                    
                    // Export custom element settings - tasks
                    if (tasksPlugin) {
                        for (let id of ["all-tasks", "tasks-assigned-to-me", "tasks-created-by-me", "trash"]) {
                            proms.push((<Q.Promise<void>>tasksPlugin.loadSettings(localSession, id)).then(() => {
                                if (!(id in result.customElementsSettings)) {
                                    result.customElementsSettings[id] = { id, files: { viewMode: null }, tasks: { kanban: null, viewMode: null } };
                                }
                                result.customElementsSettings[id].tasks.viewMode = tasksPlugin.getViewMode(localSession, id);
                                result.customElementsSettings[id].tasks.kanban = tasksPlugin.getIsKanban(localSession, id);
                            }));
                        }
                    }
                    
                    // Export custom element settings - notes2
                    if (notes2Plugin) {
                        for (let id of ["all", "local", "trash"]) {
                            proms.push((<Q.Promise<void>>notes2Plugin.loadSettings(localSession, id)).then(() => {
                                if (!(id in result.customElementsSettings)) {
                                    result.customElementsSettings[id] = { id, files: { viewMode: null }, tasks: { kanban: null, viewMode: null } };
                                }
                                result.customElementsSettings[id].files.viewMode = notes2Plugin.getSetting(localSession, "view-mode", id, "notes2");
                            }));
                        }
                    }
                    
                    return Q.all(proms).thenResolve(null);
                });
            });
        })
        .then(() => {
            return result;
        });
    }
    
    importSections(exportedSectionsOrData: ExportedData|ExportedSection[], customElementsSettings: CustomElementsSettings): Q.Promise<void> {
        let exported: ExportedSection[];
        let localSession = this.app.sessionManager.getLocalSession();
        if (!Array.isArray(exportedSectionsOrData)) {
            // New version
            exported = exportedSectionsOrData.sections;
        }
        else {
            // Backwards compatibility
            exported = exportedSectionsOrData;
        }
        return Q.all([
            localSession.sectionManager,
            this.privmxRegistry.ioc.resolve("tasksPlugin"),
            this.privmxRegistry.ioc.resolve("tasksPlugin").then(x => x ? x.createSimpleTaskService(this.privmxRegistry) : null),
            this.privmxRegistry.getIdentity(),
            this.privmxRegistry.ioc.resolve("notes2Plugin")
            .then(notes => {
                return this.privmxRegistry.getUserSettingsKvdb()
                .then(settingsKvdb => {
                    return notes.loadUserSettingsForImport(settingsKvdb).thenResolve(notes);
                })
            })
        ])
        .then(res => {
            let [sectionManager, taskPlugin, simpleTaskService, identity, notes2Plugin] = res;
            let sorted = this.sortExportedSectionsForImport(exported);
            let sectionIdsMap: { [originalId: string]: string } = {}; // originalId => newId
            let importedDemoContent: ImportedDemoContent = {
                sections: [],
                importStartDate: new Date().getTime(),
                importEndDate: 0,
            };

            return PromiseUtils.oneByOne(sorted, (_i, eSection) => {
                let importedSection: ImportedSection = {
                    id: null,
                    name: null,
                    isPrivateSection: null,
                    lastChatMessageId: null,
                    dirs: [],
                    files: [],
                    tasks: [],
                    taskGroups: [],
                };
                importedDemoContent.sections.push(importedSection);
                return Q().then(() => {
                    if (eSection.name == "<my>") {
                        return sectionManager.getMyPrivateSection();
                    }
                    Logger.debug("Section creating", eSection.name);
                    let group = {type: SectionUtils.GROUP_TYPE_ALL_LOCAL_USERS, users: <string[]>[identity.user]};
                    if (eSection.acl) {
                        if (eSection.acl.read == "me") {
                            group = {type: SectionUtils.GROUP_TYPE_SELECTED_USERS, users: [identity.user]};
                        }
                        else if (eSection.acl.read == "all") {
                            group = {type: SectionUtils.GROUP_TYPE_ALL_LOCAL_USERS, users: []};
                        }
                        else if (eSection.acl.read == "admins") {
                            group = {type: SectionUtils.GROUP_TYPE_ADMIN, users: []};
                        }
                    }
                    let getAcl = function(access: ExportedSectionAccess): section.AclEntry {
                        if (access == "me") {
                            return {
                                admins: false,
                                all: false,
                                users: [identity.user]
                            };
                        }
                        if (access == "all") {
                            return {
                                admins: false,
                                all: true,
                                users: []
                            };
                        }
                        if (access == "admins") {
                            return {
                                admins: true,
                                all: false,
                                users: []
                            };
                        }
                        return {
                            admins: true,
                            all: false,
                            users: []
                        };
                    }
                    let calendar = Lang.find(eSection.modules, x => x.name == "calendar");
                    return sectionManager.createSectionWithModules({
                        id: null,
                        parentId: eSection.parentOriginalId && sectionIdsMap[eSection.parentOriginalId],
                        data: {
                            name: eSection.name,
                            modules: calendar && calendar.enabled == false ? {calendar: {enabled: false, data: null}} : {},
                            description: eSection.description,
                            extraOptions: eSection.extraOptions? eSection.extraOptions : null
                            
                        },
                        group: group,
                        state: "enabled",
                        acl: {
                            manage: getAcl(eSection.acl ? eSection.acl.manage : null),
                            createSubsections: getAcl(eSection.acl ? eSection.acl.createSubsections : null),
                        },
                        primary: !!eSection.primary,
                    }, eSection.modules, true);
                })
                .then(section => {
                    importedSection.id = section.getId();
                    importedSection.name = section.getName();
                    importedSection.isPrivateSection = section.isPrivate();
                    sectionIdsMap[eSection.originalId] = section.getId();
                    let pathToFileMap: {[path: string]: privfs.types.descriptor.VersionSnapshot} = {};
                    let fileSystem: privfs.fs.file.FileSystem;
                    return Q().then(() => {
                        Logger.debug("Sending messages", eSection.name);
                        if (!section.hasChatModule() || eSection.messages == null) {
                            return;
                        }
                        let chatModules = section.getChatModule();
                        let maxMsgId: number = -99999;
                        return PromiseUtils.oneByOne(eSection.messages, (_i, message) => {
                            Logger.debug("Send message", _i);
                            return chatModules.sendMessage(message)
                            .then(msg => {
                                if (msg && msg.message && msg.message.msgId) {
                                    maxMsgId = Math.max(maxMsgId, msg.message.id);
                                }
                            });
                        })
                        .then(() => {
                            importedSection.lastChatMessageId = maxMsgId;
                        });
                    })
                    .then(() => {
                        Logger.debug("File uploading", eSection.name);
                        if (!section.hasFileModule() || (eSection.directories.length == 0 && eSection.files.length == 0) ){
                            return;
                        }
                        let id = this.getSectionIdForNotes2Settings(section);
                        return (<Q.Promise<void>>notes2Plugin.loadSettings(localSession, id)).then(() => {
                            for (let context of ["notes2", "summary", "filechooser"]) {
                                notes2Plugin.saveSetting(localSession, "view-mode", eSection.filesSettings ? eSection.filesSettings.viewMode : 1, id, context);
                            }
                        })
                        .then(() => {
                            return section.getFileTree();
                        })
                        .then(tree => {
                            fileSystem = tree.fileSystem;
                            return Q().then(() => {
                                return PromiseUtils.oneByOne(eSection.directories.sort((a, b) => a.path.localeCompare(b.path)), (_i, dir) => {
                                    Logger.debug("Create directory", eSection.name, dir.path);
                                    if (dir.path == "/") {
                                        return;
                                    }
                                    importedSection.dirs.push({
                                        path: dir.path,
                                    });
                                    return tree.fileSystem.mkdir(dir.path);
                                });
                            })
                            .then(() => {
                                return PromiseUtils.oneByOne(eSection.files, (_i, file) => {
                                    Logger.debug("Create file", eSection.name, file.path);
                                    let contents: string[] = file.history ? file.history.map(x => x.content) : [];
                                    if (contents.length > 0 && contents[0].length == 0) {
                                        contents.splice(0, 1);
                                    }
                                    if (contents[contents.length - 1] != file.content) {
                                        contents.push(file.content);
                                    }
                                    return PromiseUtils.oneByOne(contents, (_j, content) => {
                                        return tree.fileSystem.save(file.path, privfs.lazyBuffer.Content.createFromBase64(content, file.mimetype)).then(x => {
                                            pathToFileMap[file.path] = x;
                                            importedSection.files.push({
                                                path: file.path,
                                                lastModificationDate: x.meta.modifiedDate,
                                            });
                                        });
                                    });
                                });
                            })
                        });
                    })
                    .then(() => {
                        Logger.debug("Creating tasks", eSection.name);
                        if (!section.hasKvdbModule() || simpleTaskService == null) {
                            return;
                        }
                        let tasksIdMap: {[id: string]: string} = {"__orphans": "__orphans"};
                        return Q().then(() => {
                            if ((!eSection.tasksSettings || !eSection.tasksSettings.viewMode) && !eSection.taskDefaultViewMode) {
                                return;
                            }
                            let viewMode = eSection.tasksSettings && eSection.tasksSettings.viewMode ? eSection.tasksSettings.viewMode : eSection.taskDefaultViewMode;
                            return simpleTaskService.createProject(
                                section.getId(), eSection.name, viewMode,
                                eSection.tasksSettings ? eSection.tasksSettings.kanban : false,
                                eSection.tasksSettings ? eSection.tasksSettings.horizontalLayout : false
                            );
                        })
                        .then(() => {
                            return PromiseUtils.oneByOne(eSection.taskGroups, (_i, group) => {
                                Logger.debug("Task group creating", eSection.name, group.name);
                                return simpleTaskService.createTaskGroup(section.getId(), group.name, group.icon).then((id: string) => {
                                    tasksIdMap[group.id] = id;
                                    importedSection.taskGroups.push({
                                        id: id,
                                    });
                                });
                            });
                        })
                        .then(() => {
                            let day = 24 * 60 * 60 * 1000;
                            return PromiseUtils.oneByOne(eSection.tasks, (_i, task) => {
                                Logger.debug("Task creating", eSection.name, task.description);
                                let groupIds = (task.groupIds || []).map(x => tasksIdMap[x]);
                                let calendarInfo = null;
                                if (task.calendar) {
                                    let now = Date.now();
                                    let start = Math.floor(now / day) * day + task.calendar.hour;
                                    calendarInfo = {
                                        startTimestamp: start,
                                        endTimestamp: start + task.calendar.timeSpan,
                                        wholeDays: task.calendar.wholeDays
                                    };
                                }
                                let attachmentsPaths: string[] = [];
                                let attachments: string[] = [];
                                (task.attachments || []).forEach(path => {
                                    let entry = pathToFileMap[path];
                                    if (entry == null) {
                                        return;
                                    }
                                    let pPath = Path.parsePath(path);
                                    attachmentsPaths.push(path);
                                    attachments.push(simpleTaskService.createAttachmentInfo(entry.ref.did, pPath.name.original));
                                });
                                return simpleTaskService.createTask(section.getId(), groupIds, task.description, task.status, calendarInfo, attachments, task.comments).then((taskId: string) => {
                                    importedSection.tasks.push({
                                        id: taskId,
                                    });
                                    if (fileSystem == null) {
                                        return;
                                    }
                                    return Q.all(attachmentsPaths.map(path => {
                                        return taskPlugin.addMetaBindedTaskId(fileSystem, path, taskId);
                                    }));
                                });
                            });
                        })
                        .then(() => {
                            return simpleTaskService.afterImport(section.getId());
                        });
                    })
                    .then(() => {
                        Logger.debug("Section imported", eSection.name)
                    });
                });
            })
            .then(() => {
                if (!customElementsSettings) {
                    return;
                }
                let data = customElementsSettings;
                
                let proms: Q.Promise<void>[] = [];
                
                // Import custom element settings - tasks
                if (taskPlugin) {
                    for (let id in data) {
                        let entry = data[id];
                        if (entry.tasks && (entry.tasks.kanban !== null || entry.tasks.viewMode !== null)) {
                            proms.push((<Q.Promise<void>>taskPlugin.loadSettings(localSession, entry.id)).then(() => {
                                for (let context of ["tasks", "summary"]) {
                                    if (entry.tasks.kanban !== null) {
                                        taskPlugin.saveSetting(localSession, "kanban-mode", entry.tasks.kanban ? 1 : 0, entry.id, context);
                                    }
                                    if (entry.tasks.viewMode !== null) {
                                        taskPlugin.saveSetting(localSession, "show-recently-modified", entry.tasks.viewMode == "rm" ? 1 : 0, entry.id, context);
                                    }
                                }
                            }));
                        }
                    }
                }
                
                // Import custom element settings - notes2
                if (notes2Plugin) {
                    for (let id in data) {
                        let entry = data[id];
                        if (entry.files && (entry.files.viewMode !== null)) {
                            proms.push((<Q.Promise<void>>notes2Plugin.loadSettings(localSession, entry.id)).then(() => {
                                for (let context of ["notes2", "summary", "filechooser"]) {
                                    if (entry.files.viewMode !== null) {
                                        notes2Plugin.saveSetting(localSession, "view-mode", entry.files.viewMode, entry.id, context);
                                    }
                                }
                            }));
                        }
                    }
                }
                
                return Q.all(proms);
            })
            .then(() => {
                importedDemoContent.importEndDate = new Date().getTime();
                return this.saveImportedDemoContent(importedDemoContent);
            });
        });
    }
    
    saveImportedDemoContent(importedDemoContent: ImportedDemoContent): Q.Promise<void> {
        return this.privmxRegistry.getSystemFs()
        .then(systemFs => {
            let text = JSON.stringify(importedDemoContent);
            let content: privfs.lazyBuffer.Content = privfs.lazyBuffer.Content.createFromText(text);
            return systemFs.write(MailClientApi.IMPORTED_DEMO_CONTENT_PATH, privfs.fs.file.Mode.READ_WRITE_CREATE, content);
        })
        .thenResolve(null);
    }
    
    readImportedDemoContent(): Q.Promise<ImportedDemoContent> {
        return this.privmxRegistry.getSystemFs()
        .then(systemFs => {
            return systemFs.read(MailClientApi.IMPORTED_DEMO_CONTENT_PATH);
        })
        .then(content => {
            let importedDemoContent: ImportedDemoContent = JSON.parse(content.getText());
            return importedDemoContent;
        });
    }
    
    removeImportedDemoContentFile(): Q.Promise<void> {
        return this.privmxRegistry.getSystemFs()
        .then(systemFs => {
            return systemFs.removeFile(MailClientApi.IMPORTED_DEMO_CONTENT_PATH);
        })
        .thenResolve(null);
    }
    
    hasImportedDemoContent(): Q.Promise<boolean> {
        let fileExists: boolean = null;
        return this.privmxRegistry.getSystemFs()
        .then(systemFs => {
            return systemFs.stat(MailClientApi.IMPORTED_DEMO_CONTENT_PATH);
        })
        .then(() => {
            fileExists = true;
        })
        .fail(e => {
            if (e && e.errorName == "FILE_DOES_NOT_EXIST") {
                fileExists = false;
            }
        })
        .then(() => {
            return fileExists;
        });
    }
    
    deleteDemoContent(progressFunc: (done: number, total: number) => void): Q.Promise<void> {
        let localSession = this.app.sessionManager.getLocalSession();
        return Q.all([this.readImportedDemoContent()])
        .then(([importedDemoContent]) => {
            let done: number = 0;
            let total: number = 0;
            total = 1;
            importedDemoContent.sections.map(x => {
                total += x.dirs.length + x.files.length;
                total += x.tasks.length + x.taskGroups.length;
            });
            progressFunc(done, total);
            let proms: Q.Promise<void>[] = [];
            for (let importedSection of importedDemoContent.sections) {
                let allMessages: boolean = false;
                let allFs: boolean = false;
                let allTasks: boolean = false;
                let allTaskGroups: boolean = false;
                let section = localSession.sectionManager.getSection(importedSection.id);
                if (!section) {
                    continue;
                }
                
                // msgIds
                let defMsgIds: Q.Deferred<void> = Q.defer();
                proms.push(defMsgIds.promise);
                section.getChatModule().getSinkIndex().then(sinkIndex => {
                    return sinkIndex.loadLastMessages();
                })
                .then(() => {
                    let maxId: number = -99999;
                    section.getChatModule().chatMessagesCollection.collection.list.forEach(x => {
                        if (x && x.source && x.source.data && x.source.data.contentType != "application/json" && x.source.data.type == "chat-message" && x.source.serverId) {
                            maxId = Math.max(maxId, x.source.serverId);
                        }
                    });
                    if (maxId < 0 || maxId == importedSection.lastChatMessageId) {
                        allMessages = true;
                    }
                })
                .then(() => {
                    defMsgIds.resolve();
                })
                .fail(() => {
                    defMsgIds.reject();
                });
                
                // files, dirs
                let defFs: Q.Deferred<void> = Q.defer();
                proms.push(defFs.promise);
                section.getFileTree().then(tree => {
                    // files
                    let prom = Q();
                    let filesToDelete = tree.collection.list.filter(x => importedSection.files.filter(y => x.path == y.path).length > 0);
                    let skippedFiles = importedSection.files.length - filesToDelete.length;
                    for (let file of filesToDelete) {
                        prom = prom.then(() => {
                            return tree.fileSystem.removeFile(file.path);
                        })
                        .then(() => {
                            progressFunc(++done, total);
                        });
                    }
                    prom = prom.then(() => {
                        if (skippedFiles > 0) {
                            done += skippedFiles;
                            progressFunc(done, total);
                        }
                    });
                    
                    // dirs
                    prom = prom.then(() => {
                        let dirsToDeleteIfEmpty = tree.collection.list.filter(x => x.isDirectory() && importedSection.dirs.filter(y => x.path == y.path).length > 0);
                        let skippedDirs = importedSection.dirs.length - dirsToDeleteIfEmpty.length;
                        for (let entry of dirsToDeleteIfEmpty) {
                            let dir = <Directory>entry;
                            prom = prom.then(() => {
                                return dir.refreshDirStats();
                            }).then(() => {
                                if (dir.dirStats && dir.dirStats.directoriesCount == 0 && dir.dirStats.filesCount == 0) {
                                    return tree.fileSystem.removeEmptyDir(dir.path).thenResolve(null);
                                }
                            })
                            .then(() => {
                                progressFunc(++done, total);
                            });
                        }
                        prom = prom.then(() => {
                            if (skippedDirs > 0) {
                                done += skippedDirs;
                                progressFunc(done, total);
                            }
                        });
                    });
                    
                    // all?
                    prom = prom.then(() => {
                        allFs = tree.collection.list.filter(x => x && x.path != "/" && x.path != "/.trash").length == 0;
                    });
                    
                    return prom;
                })
                .then(() => {
                    defFs.resolve();
                })
                .fail(() => {
                    defFs.reject();
                });
                
                
                // taskIds, taskGroups
                let defTasks: Q.Deferred<void> = Q.defer();
                proms.push(defTasks.promise);
                this.privmxRegistry.ioc.resolve("tasksPlugin").then(tasksPlugin => {
                    let prom = Q();
                    
                    // tasks
                    let tasksToDelete: any[] = [];
                    for (let taskData of importedSection.tasks) {
                        if (tasksPlugin.tasks[localSession.hostHash, taskData.id]) {
                            tasksToDelete.push(tasksPlugin.tasks[localSession.hostHash, taskData.id]);
                        }
                    }
                    let skippedTasks: number = importedSection.tasks.length - tasksToDelete.length;
                    for (let task of tasksToDelete) {
                        prom = prom.then(() => {
                            return tasksPlugin.deleteTask(localSession, task);
                        })
                        .then(() => {
                            progressFunc(++done, total);
                        });
                    }
                    prom = prom.then(() => {
                        if (skippedTasks > 0) {
                            done += skippedTasks;
                            progressFunc(done, total);
                        }
                    });
                    
                    // taskGroups
                    let taskGroupsToDelete: any[] = [];
                    for (let taskGroupData of importedSection.taskGroups) {
                        if (tasksPlugin.taskGroups[localSession.hostHash][taskGroupData.id]) {
                            let hasTasks: boolean = false;
                            for (let taskId in tasksPlugin.tasks[localSession.hostHash]) {
                                let t = tasksPlugin.tasks[localSession.hostHash][taskId];
                                if (t && t.getTaskGroupIds().indexOf(taskGroupData.id) >= 0) {
                                    hasTasks = true;
                                    break;
                                }
                            }
                            if (!hasTasks) {
                                taskGroupsToDelete.push(tasksPlugin.taskGroups[localSession.hostHash][taskGroupData.id]);
                            }
                        }
                    }
                    let skippedTaskGroups: number = importedSection.taskGroups.length - taskGroupsToDelete.length;
                    for (let task of taskGroupsToDelete) {
                        prom = prom.then(() => {
                            return tasksPlugin.deleteTaskGroup(localSession, task);
                        })
                        .then(() => {
                            progressFunc(++done, total);
                        });
                    }
                    prom = prom.then(() => {
                        if (skippedTaskGroups > 0) {
                            done += skippedTaskGroups;
                            progressFunc(done, total);
                        }
                    });
                    
                    // all?
                    prom = prom.then(() => {
                        allTasks = Object.keys(tasksPlugin.tasks[localSession.hostHash]).length == 0;
                        allTaskGroups = Object.keys(tasksPlugin.taskGroups[localSession.hostHash]).length == 0;
                    })
                    
                    return prom;
                })
                .then(() => {
                    defTasks.resolve();
                })
                .fail(() => {
                    defTasks.reject();
                });
                
                // section
                let defSection: Q.Deferred<void> = Q.defer();
                proms.push(defSection.promise);
                Q.all([defMsgIds.promise, defFs.promise, defTasks.promise]).then(() => {
                    if (section.isPrivate()) {
                        defSection.resolve();
                        return;
                    }
                    if (allMessages && allFs && allTasks && allTaskGroups) {
                        return section.updateEx(x => {
                            x.state = "removed";
                            return x;
                        })
                        .then(() => {
                            defSection.resolve();
                        })
                        .fail(() => {
                            defSection.reject();
                        });
                    }
                    else {
                        defSection.resolve();
                    }
                });
            }
            return Q.all(proms).then(() => {
                return this.removeImportedDemoContentFile();
            })
            .then(() => {
                done = total;
                progressFunc(done, total);
            })
        });
    }
    
    sortExportedSectionsForImport(sections: ExportedSection[]): ExportedSection[] {
        let q = sections.slice();
        
        // Set parent id to null if there is no section with that id
        let addedIds: { [key: string]: boolean } = {};
        for (let s of q) {
            if (s.parentOriginalId && q.filter(x => x.originalId == s.parentOriginalId).length == 0) {
                s.parentOriginalId = null;
            }
            addedIds[s.originalId] = false;
        }

        // Order sections to make parent sections appear before their children
        let res: ExportedSection[] = [];
        let lim = 100000;
        while (q.length > 0 && lim-- > 0) {
            let s = q.shift();
            if (!s.parentOriginalId || addedIds[s.parentOriginalId]) {
                addedIds[s.originalId] = true;
                res.push(s);
            }
            else {
                q.push(s);
            }
        }

        return res;
    }
    
    getSectionIdForNotes2Settings(section: SectionService): string {
        return section.isPrivate() ? "my" : ((section.isUserGroup() ? "files-conversation-" : "channel/") + section.getId());
    }
    
}

export interface CustomElementsSettings {
    [key: string]: {
        id: string;
        tasks: {
            viewMode: string;
            kanban: boolean;
        },
        files: {
            viewMode: boolean;
        },
    }
}

export interface ImportSectionsTask {
    type: string;
    data: ExportedSection[];
    customElementsSettings: CustomElementsSettings;
}

export interface ExportedSectionTaskGroup {
    id: string;
    name: string;
    icon: string;
}

export interface ExportedSectionTask {
    description: string;
    status: string;
    groupIds: string[];
    attachments: string[];
    calendar?: {
        hour: number;
        timeSpan: number;
        wholeDays: boolean;
    };
    comments: {
        message: string;
        user: string;
        date: number;
    }[];
}

export type ExportedSectionAccess = "me"|"admins"|"all";

export interface ExportedSection {
    // General
    name: string;
    originalId: string;
    parentOriginalId: string;
    primary?: boolean;
    description: string;
    extraOptions?: section.SectionExtra,
    modules: {name: string, enabled: boolean}[];
    acl: {
        read: ExportedSectionAccess;
        manage: ExportedSectionAccess;
        createSubsections: ExportedSectionAccess;
    };
    
    // Chat
    messages: {text: string; type: string;}[];
    
    // Files
    directories: {path: string}[];
    files: {
        path: string,
        mimetype: string,
        content: string,
        history: {
            date: number,
            user: string,
            content: string,
        }[],
    }[];
    filesSettings: {
        viewMode: number;
    };
    
    // Tasks
    taskGroups: ExportedSectionTaskGroup[];
    tasks: ExportedSectionTask[];
    taskDefaultViewMode?: string; // @deprecated, use tasksSettings.viewMode
    tasksSettings: {
        viewMode: string;
        kanban: boolean;
        horizontalLayout: boolean;
    };
}

export interface ExportedData {
    date: number,
    hostname: string,
    user: string,
    os: string,
    appVersion: string,
    serverVersion: string,
    sections: ExportedSection[];
    customElementsSettings: CustomElementsSettings;
}

export interface ImportedTask {
    id: string;
}

export interface ImportedTaskGroup {
    id: string;
}

export interface ImportedFile {
    path: string;
    lastModificationDate: number;
}

export interface ImportedDir {
    path: string;
}

export interface ImportedSection {
    id: string;
    name: string;
    isPrivateSection: boolean;
    lastChatMessageId: number;
    dirs: ImportedDir[];
    files: ImportedFile[];
    tasks: ImportedTask[];
    taskGroups: ImportedTaskGroup[];
}

export interface ImportedDemoContent {
    sections: ImportedSection[];
    importStartDate: number;
    importEndDate: number;
}

export interface DeletableDemoContentSection {
    deleteSection: boolean;
    msgIds: string[];
    dirs: string[];
    files: string[];
    taskIds: string[];
    taskGroupIds: string[];
}

export interface DeletableDemoContent {
    sections: DeletableDemoContentSection[];
}
