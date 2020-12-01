import {BaseWindowController} from "../base/BaseWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import {app, mail, utils} from "../../Types";
import {Utils} from "../../utils/Utils";
import {RegisterResult, McaFactory} from "../../mail/McaFactory";
import {Inject} from "../../utils/Decorators"
import {UtilApi } from "../../mail/UtilApi";
import {AdminDataCreatorService} from "../../mail/admin/AdminDataCreatorService";
import {UserAdminService} from "../../mail/UserAdminService";
import {IOC} from "../../mail/IOC";
import {EventDispatcher} from "../../utils/EventDispatcher";
import {ParallelTaskStream} from "../../task/ParallelTaskStream";
import {InMemoryStorage} from "../../utils/InMemoryStorage";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { ContactService } from "../../mail/contact/ContactService";
import * as PmxApi from "privmx-server-api";
import { AdminKeySender } from "../../mail/admin/AdminKeySender";
import { PersonService } from "../../mail/person/PersonService";

export interface Model {
    showSendActivationLink: boolean;
    config: privfs.types.core.ConfigEx;
}

export type UserType = "keeper" | "regular" | "basic";

export interface AddUserModel {
    username: string;
    email: string;
    description: string;
    sendActivationLink: boolean;
    notificationEnabled: boolean;
    privateSectionAllowed?: boolean;
    userType: UserType;
}

export interface FastCreationObject {
    mcaFactory: McaFactory;
    usernames: Q.Promise<string[]>;
    adminDataForUserEncryptResult: Q.Promise<app.AdminDataForUserEncryptResult>;
    lazyNotify: (username: string) => Q.Promise<any>;
}

export class AdminAddUserWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.admin.userAdd.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static SHARE_COMMON_KVDB_KEY: boolean = true;
    static ON_AFER_CREATE_MANAGABLE: (registerResult: RegisterResult) => any;
    static HEIGHT_FULL: number = 550;
    static HEIGHT_COLLAPSED = 390;
    sharedKvdbExtKey: privfs.crypto.ecc.ExtKey;
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject utilApi: UtilApi;
    @Inject identity: privfs.identity.Identity;
    @Inject gateway: privfs.gateway.RpcGateway;
    @Inject adminDataCreatorService: AdminDataCreatorService;
    @Inject userAdminService: UserAdminService;
    @Inject personService: PersonService;
    @Inject contactService: ContactService;
    @Inject adminKeySender: AdminKeySender;
    serverConfig: privfs.types.core.ConfigEx;

    fastCreationObject: FastCreationObject;
    fastCreationObjectPreloadPromise: Q.Promise<void>;
    fastCreationLazyNotifyPromise: Q.Promise<void>;

    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 800;
        this.openWindowOptions.height = AdminAddUserWindowController.HEIGHT_COLLAPSED;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.minimizable = true;
        this.openWindowOptions.maximizable = false;
        this.openWindowOptions.title = this.i18n("window.admin.userAdd.title");
        this.openWindowOptions.icon = "icon fa fa-user-plus";
        this.msgBoxBaseOptions = {bodyClass: "admin-alert"};
    }
    
    init() {
        return Q().then(() => {
            return this.app.serverConfigPromise;
        })
        .then(cfg => {
            this.serverConfig = cfg;
            this.fastCreationObjectPreloadPromise = this.prepareFastUserCreation();
        })
    }
    
    getModel(): Model {
        return {
            showSendActivationLink: !AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY,
            config: this.serverConfig
        }
    }
    
    onViewAddUser(data: AddUserModel, managable: boolean): void {
        if (data.userType == "regular") {
            if (managable) {
                // this.createManagableUser(data);
                this.createManagableUserFast(data);
            }
            else {
                this.createPrivateUser(data);
            }
        }
        else
        if (data.userType == "basic") {
            this.createExternalUser(data);
        }
        else
        if (data.userType == "keeper") {
            this.createManagableUserFast(data, true);
        }
    }
    
    createMcaFactory(): McaFactory {
        let ioc = new IOC();
        let localeService = ioc.registerByValue("localeService", this.app.localeService);
        let eventDispatcher = ioc.registerByValue("eventDispatcher", new EventDispatcher());
        ioc.registerByValue("assetsManager", this.app.assetsManager);
        ioc.registerByValue("networkStatusService", this.app.networkStatusService);
        ioc.registerByValue("mailResourceLoader", this.app.mailResourceLoader);
        ioc.registerByValue("taskStream", new ParallelTaskStream());
        ioc.registerByValue("unecryptedLocalStorage", new InMemoryStorage());
        ioc.registerByValue("componentFactory", ioc);
        ioc.registerByValue("stickersProvider", {getStickers: () => []});
        ioc.registerByValue("sinkFilter", {value: null}),
        ioc.registerByValue("defaultPki", {value: false}),
        ioc.registerByValue("notifications", {value: []}),
        ioc.registerByValue("forcedPublishPresenceType", {value: null}),
        ioc.registerByValue("maxFileSize", {value: null}),
        ioc.registerByValue("kvdbPollInterval", {value: 10000})
        return new McaFactory(localeService, eventDispatcher, ioc);
    }
    
    prepareFastUserCreation(): Q.Promise<void> {
        return Q().then(() => {
            return this.app.mailClientApi.privmxRegistry.getSharedKvdbFromAdminDb();
        })
        .then(kvdb => {
            this.sharedKvdbExtKey = kvdb.extKey;
        })
        .then(() => {
            this.fastCreationObject = <any>{};
            this.fastCreationObject.mcaFactory = this.createMcaFactory();
            this.fastCreationObject.usernames = this.utilApi.getForbiddenUsernames();
            this.fastCreationObject.adminDataForUserEncryptResult = this.adminDataCreatorService.encryptSharedKeyInAdminDataForUser(this.sharedKvdbExtKey);
            this.fastCreationObject.lazyNotify = (username: string) => {
                return Q().then(() => {
                        return this.app.mailClientApi.privmxRegistry.getConv2Service()
                    .then(conv2Service => {
                        return conv2Service.createUserGroup([this.identity.user, username]);
                    })
                    .then(sectionService => {
                        return Q.all([
                          sectionService.sendMessage({text: this.app.localeService.i18n("core.createuser.admin_message")}),
                          this.personService.synchronizeWithUsernames()
                        ])
                    })
                })
            }
        })
    }

    fastUserCreationResetMcaFactory(): void {
        this.fastCreationObject.mcaFactory = this.createMcaFactory();
    }

    createManagableUserFast(data: AddUserModel, asAdmin: boolean = false): void {
        this.setLockAgainstClosing();
        let language: string, password: string, host: string, registerResult: RegisterResult;
        let addUserResult: privfs.types.core.AddUserResult, adminDataForUser: app.AdminDataForUserEncryptResult;
        this.addTaskEx("", true, () => {
            let mcaFactory = this.fastCreationObject.mcaFactory;
            return Q().then(() => {
                if (!data.username) {
                    throw "__no_username__";
                }
                return this.fastCreationObjectPreloadPromise
                .then(() => {
                    return this.fastCreationObject.usernames
                })
                .then(usernames => {
                    if (usernames.indexOf(data.username) !== -1) {
                        throw "__forbidden_username__";
                    }
                });
            })
            .then(() => {
                language = this.app.localeService.currentLang;
                password = Utils.randomTemporaryPassword(6);
                host = this.gateway.getHost();
                
                return this.srpSecure.addUserWithToken(
                        this.identity.user,
                        data.username,
                        data.email,
                        data.description,
                        false,
                        true,
                        language,
                        "",
                        "managed"
                    );
            })
            .then(aur => {
                // console.log("addUserWithToken result", aur)
                addUserResult = aur;
                if (!AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY) {
                    return;
                }
                return Q().then(() => {
                    return this.fastCreationObject.adminDataForUserEncryptResult;
                })
                .then(adfu => {
                    // console.log("adfu", adfu);
                    adminDataForUser = adfu;
                    return this.srpSecure.request("modifyUser", {
                        username: data.username,
                        properties: {
                            adminDataForUser: adminDataForUser.serverData
                        }
                    });
                });
            })
            .then(() => {
                // console.log("after modify user");
                return this.adminDataCreatorService.createUnregisterSessionSignature(this.identity, data.username);
            })
            .then(unregisteredSession => {
                return mcaFactory.register({
                    username: data.username,
                    host: host,
                    login: data.username,
                    password: password,
                    email: data.email,
                    pin: "",
                    token: addUserResult.token,
                    weakPassword: false,
                    registerKey: adminDataForUser ? adminDataForUser.key : "",
                    unregisteredSession: unregisteredSession
                });
            })
            .then(rr => {
                // console.log("after createUnregisteredSessionSignature...");
                registerResult = rr;
                let adminData: mail.AdminData = {
                    masterSeed: registerResult.registerData.privData.l1.masterSeed,
                    recovery: registerResult.registerData.privData.l1.recovery,
                    generatedPassword: password
                };
                return this.adminDataCreatorService.setAdminData(data.username, adminData);
            })
            .then(() => {
                // console.log("check if admin");
                if (asAdmin) {
                    return this.srpSecure.changeIsAdmin(
                        this.identity.priv,
                        data.username,
                        true,
                        registerResult.registerData.identityKey.getPublicKey()
                    )
                    .then(() => {
                        return this.adminKeySender.sendAdminKey(data.username).thenResolve(null);
                    })
                
                }
                else {
                    return;
                }
            })
            .then(() => {
                if (AdminAddUserWindowController.ON_AFER_CREATE_MANAGABLE) {
                    return Q().then(() => {
                        return AdminAddUserWindowController.ON_AFER_CREATE_MANAGABLE(registerResult);
                    })
                    .fail(e => {
                        this.logError(e);
                    });
                }
            })
            .then(() => {
                this.fastCreationLazyNotifyPromise = this.fastCreationObject.lazyNotify(data.username).then(() => this.userAdminService.refreshUsersCollection());
            })
            .then(() => {
                this.alertEx({
                    width: 560,
                    height: 260,
                    focusOn: "",
                    contentTemplate: {
                        templateId: "adminEditUserResetSummaryTemplate",
                        model: {
                            username: data.username,
                            hashmail: data.username + "#" + this.identity.host,
                            password: password,
                            createMode: true,
                            isExternalUser: false,
                        }
                    },
                    extraHandlers: {
                        "send-link": () => this.sendActivationData(data.username, password),
                    },
                })
                .then(() => {
                    // this.userAdminService.refreshUsersCollection();
                    this.fastCreationLazyNotifyPromise = this.fastCreationLazyNotifyPromise.then(() => this.close());
                });
            })
            .fail(e => {
                this.callViewMethod("unlockForm");
                if (privfs.core.ApiErrorCodes.is(e, "USER_ALREADY_EXISTS")) {
                    return this.alert(this.i18n("window.admin.userAdd.error.userAlreadyExists"));
                }
                if (privfs.core.ApiErrorCodes.is(e, "INVALID_EMAIL")) {
                    return this.alert(this.i18n("window.admin.userAdd.error.invalidEmail"));
                }
                if (e === "__forbidden_username__" || privfs.core.ApiErrorCodes.is(e, "INVALID_USERNAME")) {
                    return this.alert(this.i18n("window.admin.userAdd.error.invalidUsername"));
                }
                if (e === "__no_username__") {
                    return this.alert(this.i18n("window.admin.userAdd.error.noUsername"));
                }
                if (e === "__no_email__") {
                    return this.alert(this.i18n("window.admin.userAdd.error.noEmail"));
                }
                return Q.reject(e);
            })
            .fin(() => {
                mcaFactory.ioc.clearDeps();
                this.fastUserCreationResetMcaFactory();
                this.resetLockAgainstClosing();
            });
        });
    }
    

    createPrivateUser(data: AddUserModel): void {
        this.setLockAgainstClosing();
        let addUserResult: privfs.types.core.AddUserResult, adminDataForUser: app.AdminDataForUserEncryptResult;
        let linkPattern: string;
        let activationToken: string;
        
        this.addTaskEx("", true, () => {
            return Q().then(() => {
                return this.app.mailClientApi.privmxRegistry.getSharedKvdbFromAdminDb();
            })
            .then(kvdb => {
                this.sharedKvdbExtKey = kvdb.extKey;
            })
            .then(() => {
                if (!data.email && (data.notificationEnabled || data.sendActivationLink)) {
                    throw "__no_email__";
                }
                return this.utilApi.getForbiddenUsernames()
                .then(usernames => {
                    if (usernames.indexOf(data.username) !== -1) {
                        throw "__forbidden_username__";
                    }
                    return this.srpSecure.getConfigEx();
                });
            })
            .then(config => {
                let sendActivationLink = data.sendActivationLink && !AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY;
                linkPattern = config.defaultInvitationLinkPattern;
                if (data.username) {
                    linkPattern = linkPattern.replace("{token}", "{token}&u=" + data.username);
                }
                return this.srpSecure.addUserWithToken(
                        this.identity.user,
                        data.username,
                        data.email,
                        data.description,
                        sendActivationLink,
                        data.notificationEnabled,
                        this.app.localeService.currentLang,
                        AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY ? "" : linkPattern,
                        "private"
                    );
            })
            .then(aur => {
                addUserResult = aur;
                if (!AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY) {
                    return;
                }
                return Q().then(() => {
                    return this.adminDataCreatorService.encryptSharedKeyInAdminDataForUser(this.sharedKvdbExtKey);
                })
                .then(adfu => {
                    adminDataForUser = adfu;
                    let link = linkPattern.replace("{token}", addUserResult.token) + "&k=" + adminDataForUser.key;
                    let tokenInfo: utils.RegisterTokenInfo = {
                        domain: this.identity.host,
                        token: addUserResult.token,
                        isAdmin: false,
                        username: data.username,
                        key: adminDataForUser.key
                    }
                    activationToken = AdminAddUserWindowController.createActivationToken(tokenInfo);
                    return this.adminDataCreatorService.encryptAdminData(data.username || addUserResult.token, {
                        key: adminDataForUser.key,
                        link: link,
                        activateToken: activationToken
                    });
                })
                .then(adminDataBuffer => {
                    return this.srpSecure.request("modifyUser", {
                        username: data.username || addUserResult.token,
                        properties: {
                            adminDataForUser: adminDataForUser.serverData,
                            adminData: adminDataBuffer.toString("base64")
                        }
                    });
                });
            })
            .then(() => {
                let moreInfo = "";
                let info = this.i18n("window.admin.userAdd.info2");
                let link = addUserResult.link;
                if (AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY) {
                    moreInfo = this.i18n("window.admin.userAdd.info.send", data.email);
                    info = "";//this.i18n("window.admin.userAdd.info.shared");
                    link = linkPattern.replace("{token}", addUserResult.token) + "&k=" + adminDataForUser.key;
                }
                else {
                    if (addUserResult.linkSent == privfs.core.LinkSentStatus.ERROR) {
                        moreInfo = this.i18n("window.admin.userAdd.info.unknownError", data.email);
                    }
                    else if (addUserResult.linkSent == privfs.core.LinkSentStatus.INVALID_CONFIG) {
                        moreInfo = this.i18n("window.admin.userAdd.info.invalidConfigError", data.email);
                    }
                    else if (addUserResult.linkSent == privfs.core.LinkSentStatus.NOT_WANTED) {
                        moreInfo = this.i18n("window.admin.userAdd.info.send");
                    }
                    else if (addUserResult.linkSent == privfs.core.LinkSentStatus.SENT) {
                        moreInfo = this.i18n("window.admin.userAdd.info.sent", data.email);
                    }
                }
                
                this.promptEx({
                    message: this.i18n("window.admin.userAdd.info") + " " + moreInfo,
                    info: info,
                    height: 220,
                    autoHeight: true,
                    width: 600,
                    input: {
                        value: activationToken,
                        multiline: true,
                        readonly: true,
                        continous: true,
                        height: 83
                    },
                    cancel: {visible: false}
                })
                .then(() => {
                    this.userAdminService.refreshUsersCollection();
                    this.close();
                });
                return;
            })
            .fail(e => {
                this.callViewMethod("unlockForm");
                if (privfs.core.ApiErrorCodes.is(e, "USER_ALREADY_EXISTS")) {
                    return this.alert(this.i18n("window.admin.userAdd.error.userAlreadyExists"));
                }
                if (privfs.core.ApiErrorCodes.is(e, "INVALID_EMAIL")) {
                    return this.alert(data.notificationEnabled || data.sendActivationLink ? this.i18n("window.admin.userAdd.error.invalidEmailOptions") : this.i18n("window.admin.userAdd.error.invalidEmail"));
                }
                if (e === "__forbidden_username__" || privfs.core.ApiErrorCodes.is(e, "INVALID_USERNAME")) {
                    return this.alert(this.i18n("window.admin.userAdd.error.invalidUsername"));
                }
                if (e === "__no_email__") {
                    return this.alert(this.i18n("window.admin.userAdd.error.invalidEmailOptions"));
                }
                return Q.reject(e);
            });
        })
        .fin(() => {
            this.resetLockAgainstClosing();
        })
    }
    
    onViewClose(): void {
        this.close();
    }

    onViewSetWindowHeightForMode(mode: string) {
        this.nwin.setHeight(mode == "collapse" ? AdminAddUserWindowController.HEIGHT_COLLAPSED : AdminAddUserWindowController.HEIGHT_FULL);
        //this.center();
    }
    
    sendActivationData(username: string, password: string): void {
        this.app.sendActivationData(username, password);
    }

    createExternalUser(data: AddUserModel): void {
        this.setLockAgainstClosing();
        let language: string, password: string, host: string, registerResult: RegisterResult;
        let username: string = data.username;
        
        this.addTaskEx("", true, () => {
            let mcaFactory = this.createMcaFactory();
            return Q().then(() => {
                return this.utilApi.getForbiddenUsernames()
                .then(usernames => {
                    if (usernames.indexOf(username) !== -1) {
                        throw "__forbidden_username__";
                    }
                });
            })
            .then(() => {
                language = this.app.localeService.currentLang;
                password = Utils.randomTemporaryPassword(6);
                host = this.gateway.getHost();
                return this.utilApi.addBasicUser({
                    creator:  <PmxApi.api.core.Username>this.identity.user,
                    username: <PmxApi.api.core.Username>username,
                    email: <PmxApi.api.core.Email>"",
                    description: <PmxApi.api.user.UserDescription>data.description,
                    notificationsEnabled: true,
                    language: <PmxApi.api.core.Language>language,
                    privateSectionAllowed: data.privateSectionAllowed || false
                })

            //     return this.srpSecure.addExternalUser(this.identity.user, data.login, "", data.description,
            //         true, language, data.privateSectionAllowed);
            })
            .then(addUserResult => {
                return this.adminDataCreatorService.createUnregisterSessionSignature(this.identity, username).then(unregisteredSession => {
                    return mcaFactory.register({
                        username: username,
                        host: host,
                        login: username,
                        password: password,
                        email: "",
                        pin: "",
                        token: addUserResult.token,
                        weakPassword: false,
                        registerKey: "",
                        creatorHashmail: this.identity.hashmail,
                        unregisteredSession: unregisteredSession
                    });
                });
            })
            .then(rr => {
                registerResult = rr;
                let adminData: mail.AdminData = {
                    masterSeed: registerResult.registerData.privData.l1.masterSeed,
                    recovery: registerResult.registerData.privData.l1.recovery,
                    generatedPassword: password
                };
                return this.adminDataCreatorService.setAdminData(username, adminData);
            })
            .then(() => {
                if (AdminAddUserWindowController.ON_AFER_CREATE_MANAGABLE) {
                    return Q().then(() => {
                        return AdminAddUserWindowController.ON_AFER_CREATE_MANAGABLE(registerResult);
                    })
                    .fail(e => {
                        this.logError(e);
                    });
                }
            })

            .then(() => {
                return this.contactService.getContactsDb();
            })
            .then(() => {
                return this.app.mailClientApi.privmxRegistry.getConv2Service()
            })
            .then(conv2Service => {
                return conv2Service.createUserGroup([this.identity.user, username]);
            })
            .then(sectionService => {
                return Q.all([
                    sectionService.sendMessage({text: this.app.localeService.i18n("core.createuser.admin_message")}),
                    this.personService.synchronizeWithUsernames()
                ])
            })
            .then(() => {
                this.alertEx({
                    width: 560,
                    height: 290,
                    focusOn: "",
                    contentTemplate: {
                        templateId: "adminEditUserResetSummaryTemplate",
                        model: {
                            username: username,
                            hashmail: data.username + "#" + this.identity.host,
                            password: password,
                            createMode: true,
                            isExternalUser: true,
                        }
                    },
                    extraHandlers: {
                        "send-link": () => this.sendActivationData(username, password),
                    },
                })
                .then(() => {
                    this.userAdminService.refreshUsersCollection();
                    return;
                })
                .then(() => {
                    this.close();
                });
            })
            .fail(e => {
                this.callViewMethod("unlockForm");
                if (privfs.core.ApiErrorCodes.is(e, "USER_ALREADY_EXISTS")) {
                    return this.alert(this.i18n("window.admin.userExternalAdd.error.userAlreadyExists"));
                }
                if (privfs.core.ApiErrorCodes.is(e, "INVALID_EMAIL")) {
                    return this.alert(this.i18n("window.admin.userExternalAdd.error.invalidEmail"));
                }
                if (e === "__forbidden_username__" || privfs.core.ApiErrorCodes.is(e, "INVALID_USERNAME")) {
                    return this.alert(this.i18n("window.admin.userExternalAdd.error.invalidUsername"));
                }
                if (e === "__no_username__") {
                    return this.alert(this.i18n("window.admin.userExternalAdd.error.noUsername"));
                }
                if (e === "__no_email__") {
                    return this.alert(this.i18n("window.admin.userExternalAdd.error.noEmail"));
                }
                return Q.reject(e);
            })
            .fin(() => {
                mcaFactory.ioc.clearDeps();
                this.resetLockAgainstClosing();
            });
        });
    }

    setLockAgainstClosing(): void {
        this.nwin.setClosable(false);
    }

    resetLockAgainstClosing(): void {
        this.nwin.setClosable(true);
    }
    
    static createActivationToken(tokenInfo: utils.RegisterTokenInfo): string {
        let buffer = Buffer.from(JSON.stringify(tokenInfo), "utf-8");
        return "activate:" + privfs.bs58.encode(buffer);
    }
}
