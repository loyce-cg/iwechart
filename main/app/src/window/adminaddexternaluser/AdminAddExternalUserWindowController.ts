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
import { ContactService } from "../../mail/contact/ContactService";
import { LocaleService, HashmailResolver } from "../../mail";
import { ServerProxyService, types as proxyTypes, ServerProxyApi, RemoteServerApi, UserLbkAlterService, ProxyUtils } from "../../mail/proxy";
import { i18n } from "./i18n";
import { WindowUtils } from "./WindowUtils";
import { IdentityProfile } from "../../mail/person/IdentityProfile";
import { Profile } from "../../mail/UserPreferences";
import { PersonService } from "../../mail/person/PersonService";

export interface Model {
    showSendActivationLink: boolean;
}

export interface AddUserModel {
    login: string;
    description: string;
    privateSectionAllowed: boolean;
    privmxaddress: string;
    userType: string;
}

export class AdminAddExternalUserWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.admin.userExternalAdd.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static SHARE_COMMON_KVDB_KEY: boolean = true;
    
    sharedKvdbExtKey: privfs.crypto.ecc.ExtKey;
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject utilApi: UtilApi;
    @Inject identity: privfs.identity.Identity;
    @Inject gateway: privfs.gateway.RpcGateway;
    @Inject adminDataCreatorService: AdminDataCreatorService;
    @Inject userAdminService: UserAdminService;
    @Inject contactService: ContactService;
    @Inject personService: PersonService;
    @Inject serverProxyService: ServerProxyService;
    @Inject identityProfile: IdentityProfile;
    @Inject identityProvider: utils.IdentityProvider;
    @Inject hashmailResolver: HashmailResolver;
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 800;
        this.openWindowOptions.height = 285;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.minimizable = true;
        this.openWindowOptions.maximizable = false;
        this.openWindowOptions.title = this.i18n("window.admin.userExternalAdd.title");
        this.openWindowOptions.icon = "icon fa fa-user-plus";
        this.msgBoxBaseOptions = {bodyClass: "admin-alert"};
    }
    
    init() {
        return Q().then(() => {
            return this.app.mailClientApi.privmxRegistry.getServerProxyService();
        })
        .then(() => {
            return this.app.mailClientApi.privmxRegistry.getSharedKvdbFromAdminDb();
        })
        .then(kvdb => {
            this.sharedKvdbExtKey = kvdb.extKey;
            return;
        });
    }
    
    getModel(): Model {
        return {
            showSendActivationLink: !AdminAddExternalUserWindowController.SHARE_COMMON_KVDB_KEY
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
    
    createExternalPrivMXUser(data: AddUserModel): void {
        // console.log("createExternalPrivMXUser...")
        let language: string, password: string, host: string, registerResult: RegisterResult;
        let username: string;
        let [remoteUser, remoteHost] = data.privmxaddress.split("#");
        let proxyApi = new ServerProxyApi(this.gateway);
        let remoteProxyApi = new RemoteServerApi(this.srpSecure, remoteHost);
        let remoteProfile: Profile;
        let lbkDataKeyHex: string;
        
        this.addTaskEx("", true, () => {
            let mcaFactory = this.createMcaFactory();
            return Q().then(() => {
                // console.log("helperCheckCurrentProxies before");
                return this.helperCheckCurrentProxies(proxyApi, remoteHost)
                .fail(() => {
                    console.log("no proxy fail - checkRemoteServerProxy")
                    return Q.reject("no-remote-proxy");
                });
            })
            .then(() => {
                return remoteProxyApi.getUserInfo(remoteUser)
                .fail(e => {
                    if (e && e.msg && (<string>e.msg).indexOf("Cannot login") == 0) {
                        return Q.reject("no-remote-proxy");
                    }
                    if (e && e.msg && (<string>e.msg).indexOf("Non-existant user") == 0) {
                        return Q.reject("no-user");
                    }
                    return Q.reject(e);
                });
            })
            .then((proxyUserInfo: proxyTypes.ProxyUserInfo) => {
                // console.log("--------------------------- proxyUserInfo", proxyUserInfo);
                remoteProfile = this.contactService.convertProfile(proxyUserInfo.userInfo.profile);
                // console.log("--------------------------- remoteProfile", remoteProfile);
                return this.utilApi.getForbiddenUsernames()
                .then(usernames => {
                    do {
                        username = this.generateUsername();
                    }
                    while(usernames.indexOf(username) !== -1)
                });
            })
            .then(() => {
                language = this.app.localeService.currentLang;
                password = Utils.randomTemporaryPassword(6);
                host = this.gateway.getHost();
                // console.log("============================== adding external user", this.identity.user, username, data.privmxaddress, data.description);
                return this.srpSecure.addExternalPrivmxUser(
                    this.identity.user, // creator
                    username, // username
                    data.privmxaddress, //display name
                    "", //email
                    data.description, //description
                    true, //notifications enabled
                    language, // language
                    data.privateSectionAllowed //privateSectionALlowed
                );
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
                        unregisteredSession: unregisteredSession,
                        overrideWithProfile: remoteProfile
                    });
                });
            })
            .then(rr => {
                registerResult = rr;
                let adminData: mail.AdminData = {
                    masterSeed: registerResult.registerData.masterRecord.l1.masterSeed,
                    recovery: registerResult.registerData.masterRecord.l1.recovery,
                    generatedPassword: password
                };
                return this.adminDataCreatorService.setAdminData(username, adminData);
            })
            .then(() => {
                return UserLbkAlterService.create(this.app.mailClientApi.privmxRegistry)
                .then(ulas =>
                    ulas.loginToUserAndSetLbk(username, remoteUser, remoteHost)
                )
                .then(x => {
                    // console.log("x as raw buffer", x);
                    // console.log("lbkDataKeyHex", x.toString("hex"));
                    lbkDataKeyHex = x.toString("hex");
                })
                .catch(e => console.log("Error", e))
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
                .then(() => {
                    return this.serverProxyService.sendProxyAccessKeyMessage(remoteUser, remoteHost, lbkDataKeyHex);
                })
            })
            .then(() => {
                this.userAdminService.refreshUsersCollection();
                return;
            })
            .then(() => {
                this.close();
            })
            .fail(e => {
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
                if (e == "no-local-proxy") {
                    return WindowUtils.getErrorNoLocalProxy(this);
                }
                if (e == "no-remote-proxy") {
                    return WindowUtils.getErrorNoRemoteProxy(this);
                }
                if (e == "no-user") {
                    return WindowUtils.getErrorNoUser(this);
                }
                return Q.reject(e);
            })
            .fin(() => {
                this.cleanUI(mcaFactory);
            });
        });
    }
    
    generateUsername(): string {
        return privfs.crypto.service.randomBytes(10).toString("hex");
    }
    
    helperIsProxyExists(proxyApi: ServerProxyApi, host: string): Q.Promise<proxyTypes.ServerProxy> {
        return Q().then(() => {
            return proxyApi.getAllServerProxy();
        })
        .then(proxies => {
            let found: proxyTypes.ServerProxy = null;
            proxies.forEach(proxy => {
                if (proxy.host == host) {
                    found = proxy;
                    return;
                }
            })
            return found;
        })
    }
    
    helperCheckCurrentProxies(api: ServerProxyApi, remoteHost: string): Q.Promise<proxyTypes.ServerProxy> {
        let proxy: proxyTypes.ServerProxy = null;
        return Q().then(() => {
            return this.serverProxyService.checkRemoteServerProxy(remoteHost)
            .fail(() => {
                return Q.reject("no-remote-proxy-after-auto-init");
            })
        })
        .then(() => {
            return api.getAllServerProxy();
        })
        .then(proxies => {
            proxies.forEach(p => {
                if (p.host == remoteHost) {
                    proxy = p;
                    return;
                }
            });
            if (!proxy) {
                return Q.reject("no-proxy");
            }
            if (! proxy.enabled || !proxy.inEnabled || !proxy.outEnabled) {
                return Q.reject("proxy-to-modify");
            }
            let proxyAcl = ProxyUtils.deserializeAcl(proxy.acl);
            if (proxyAcl.indexOf(this.identity.user) == -1) {
                return Q.reject("proxy-to-modify");
            }
            return proxy;
        })
        .catch((err: string) => {
            if (err == "no-proxy") {
                return this.serverProxyService.fetchServerKeyAndAddServerProxy(remoteHost, true, true, true, this.identity.user);
            }
            if (err == "proxy-to-modify") {
                    return api.modifyServerProxy({
                        host: proxy.host,
                        enabled: true,
                        inEnabled: true,
                        outEnabled: true,
                        acl: this.identity.user
                    })
            }
        })
    }

    cleanUI(mcaFactory: McaFactory): void {
        mcaFactory.ioc.clearDeps();
        this.callViewMethod("unlockForm");
    }

    onViewAddUser(data: AddUserModel): void {
        // data.userType == "email" ? this.createExternalUser(data) : this.createExternalPrivMXUser(data);
        this.createExternalPrivMXUser(data);
    }

    onViewClose(): void {
        this.close();
    }

}
