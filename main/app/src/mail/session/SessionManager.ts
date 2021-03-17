import * as privfs from "privfs-client";

import { MailClientApi } from "../MailClientApi";
import * as Q from "q";
import { ServerProxyService } from "../proxy/ServerProxyService";
import { IOC, Lifecycle } from "../IOC";
import * as RootLogger from "simplito-logger";
import { ProxyServerKey } from "../proxy/Types";
import * as crypto from "crypto";
import { LocaleService } from "../LocaleService";
import { ParallelTaskStream } from "../../task/ParallelTaskStream";
import { utils, event, mail } from "../../Types";
import { EventDispatcher } from "../../utils/EventDispatcher";
import { NetworkStatusService } from "../NetworkStatusService";
import { SectionManager } from "../section/SectionManager";
import { Conv2Service } from "../section";
import { WebSocketNotifier } from "./WebSocketNotifier";
import { VoiceChatServiceApi } from "../voicechat/VoiceChatServiceApi";
import { VideoConferencesServiceApi } from "../videoconferences/VideoConferencesServiceApi";
import { AssetsManager } from "../../app/common/AssetsManager";
import { MailStats } from "..";
import { CommonApplication } from "../../app/common/CommonApplication";


let Logger = RootLogger.get("app.mail.SessionManager");

export type SessionType = "local" | "remote";
export interface Session {
    manager: SessionManager;
    host: string;
    hostHash: string;
    userData: privfs.types.core.UserDataEx;
    mailClientApi: MailClientApi;
    sessionType: SessionType;
    ioc: IOC;
    services?: SessionServices;
    sectionManager?: SectionManager;
    conv2Service?: Conv2Service;
    webSocketNotifier?: WebSocketNotifier;
    loadingPromise: Q.Promise<void>;
    initPromise?: Q.Promise<void>;
}

export interface SessionServices {
    networkStatusService: NetworkStatusService;
    taskStream: ParallelTaskStream;
    voiceChatServiceApi?: VoiceChatServiceApi;
    videoConferencesServiceApi?: VideoConferencesServiceApi;
}

export class SessionManager {
    sessions: {[hostHash: string]: Session};
    defaultHost: string;

    constructor(
        public globalIOC: IOC,
        public serverProxyService: ServerProxyService,
        public localeService: LocaleService,
        public storage: utils.IStorage,
        public unencryptedStorage: utils.IStorage,
        public eventDispatcher: EventDispatcher,
        public mailResourceLoader: mail.MailResourceLoader,
        public app: CommonApplication
    ) {
        // console.log("sessionManager: constructor");
        this.sessions = {};
    }
    
    // register services

    initServicesObject(hostHash: string): void {
        if (this.sessions[hostHash].services) {
            return;
        }

        let sess: SessionServices = {
            networkStatusService: null,
            taskStream: null,
            voiceChatServiceApi: null
        }
        this.sessions[hostHash].services = sess;
    }

    registerServices(hostHash: string): Q.Promise<void> {
        return Q().then(() => {
            this.sessions[hostHash].ioc.registerByValue("localeService", this.localeService, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("eventDispatcher", this.eventDispatcher, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("sinkFilter", {value: null}, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("notifications", {value: []}, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("kvdbPollInterval", {value: 10000}, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("forcedPublishPresenceType", {value: null}, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("stickersProvider", {getStickers: () => ["1f600", "1f606", "1f604", "1f44c", "1f91e", "1f44d", "1f44e", "1f44f", "1f91d"]}, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("maxFileSize", {value: null}, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("defaultPki", {value: false}, Lifecycle.ETERNAL);
            this.sessions[hostHash].ioc.registerByValue("mailResourceLoader", this.mailResourceLoader, Lifecycle.ETERNAL);

            this.initServicesObject(hostHash);
            this.sessions[hostHash].services.networkStatusService = this.sessions[hostHash].ioc.registerByValue("networkStatusService", new NetworkStatusService(), Lifecycle.ETERNAL);
            this.sessions[hostHash].services.taskStream = this.sessions[hostHash].ioc.registerByValue("taskStream", new ParallelTaskStream(), Lifecycle.ETERNAL);

            return this.globalIOC.resolve("unecryptedLocalStorage")
            .then((unecryptedStorage: utils.Storage<string, string>) => {
                this.sessions[hostHash].ioc.registerByValue("unecryptedLocalStorage", unecryptedStorage, Lifecycle.ETERNAL);
                return this.globalIOC.resolve("localStorage");
            })
            .then((localStorage: utils.IStorage) => {
                this.sessions[hostHash].ioc.registerByValue("wellKnownEncryptedLocalStorage", localStorage, Lifecycle.ETERNAL);
            })    
        });
    }
    
    registerVoiceChatService(hostHash: string): void {
        this.initServicesObject(hostHash);
        if (! this.sessions[hostHash].services.voiceChatServiceApi) {
            this.sessions[hostHash].services.voiceChatServiceApi = new VoiceChatServiceApi(this.sessions[hostHash].userData.srpSecure)
        }
    }
    
    registerVideoConferencesService(hostHash: string): void {
        this.initServicesObject(hostHash);
        if (!this.sessions[hostHash].services.videoConferencesServiceApi) {
            this.sessions[hostHash].services.videoConferencesServiceApi = new VideoConferencesServiceApi(this.sessions[hostHash].userData.srpSecure, this.sessions[hostHash].userData.identity.host);
        }
        this.app.videoConferencesService.polling.start(this.sessions[hostHash]);
    }

    /// API METHODS
    
    createRemoteSession(host: string): Q.Promise<void> {
        for (let hostHash in this.sessions) {
            // console.log("session: ", hostHash, this.sessions[hostHash].host);
        }
        
        let userData: privfs.types.core.UserDataEx;
        let hostHash = this.getHashFromHost(host);

        let newSession: Session;
        let loadingDeferred = Q.defer<void>();

        return Q().then(() => {
            if (hostHash in this.sessions) {
                // console.log("session already exists", host);
                return Q.reject<ProxyServerKey>("Session for host " + host + "already exists.");
            }
            return this.serverProxyService.getKey(host);
            
        })
        .then(loginInfo => {
            // console.log("key before conv", loginInfo.lbkKeyHex);
            // console.log("key after conv to buffer", Buffer.from(loginInfo.lbkKeyHex, "hex"));
            return this.serverProxyService.loginToHost(loginInfo.host, Buffer.from(loginInfo.lbkKeyHex, "hex"), false);
        })
        .then(data => {
            userData = data;
            // console.log("logged in", userData);

            let newSession: Session = {
                hostHash: this.getHashFromHost(host),
                sessionType: "remote",
                userData: userData,
                host: host,
                ioc: new IOC(),
                mailClientApi: null,
                services: {
                   networkStatusService: null,
                   taskStream: null
                },
                manager: this,
                loadingPromise: loadingDeferred.promise,
            };
            this.sessions[hostHash] = newSession;
            this.registerVoiceChatService(hostHash);
            this.registerVideoConferencesService(hostHash);

            // console.log("session - registerServices before");
            return this.registerServices(hostHash);
        })
        .then(() => {
            // console.log("session - registerServices after")
            return MailClientApi.create(this.app, userData, this.sessions[hostHash].ioc);
        })
        .then(clientApi => {
            this.sessions[hostHash].mailClientApi = clientApi;
            return clientApi.prepareSession();
        })
        .then(() => {
            return this.sessions[hostHash].ioc.resolve("mailStats");
        })
        .then((mailStats: MailStats) => {
            mailStats.setHostHash(this.sessions[hostHash]);
        })
        .then(() => {
            return this.sessions[hostHash].mailClientApi.prepareAndGetSectionManager();
        })
        .then(sm => {
            this.sessions[hostHash].sectionManager = sm;
            return sm.load();
        })
        .then(() => {
            loadingDeferred.resolve();
            this.eventDispatcher.dispatchEvent<event.HostSessionCreatedEvent>({type: "hostSessionCreated", hostHash: hostHash, host: host});
        })
        .fail(e => Logger.warn("Cannot create session", e));
    }
    
    
    getSession(host: string): Session {
        let hostHash = this.getHashFromHost(host);
        if ( !(hostHash in this.sessions)) {
            throw new Error("There is no remote sessions with given host: " + host);
        }
        return this.sessions[hostHash];
    }
    
    getSessionByHostHash(hostHash: string): Session {
        if ( !(hostHash in this.sessions)) {
            throw new Error("There is no remote sessions with given hostHash: " + hostHash);
        }
        return this.sessions[hostHash];
    }

    closeRemoteSession(host: string): void {
        let hostHash = this.getHashFromHost(host);
        if ( !(hostHash in this.sessions)) {
            throw new Error("There is no remote sessions with given host: " + host);
        }
        this.app.videoConferencesService.polling.stop(this.sessions[hostHash]);
        this.sessions[hostHash].userData.srpSecure.gateway.rpc.disconnect();
        this.sessions[hostHash].mailClientApi.destroy();
        this.sessions[hostHash].webSocketNotifier.closeConnection();
        this.sessions[hostHash].mailClientApi.destroy();
        this.sessions[hostHash].mailClientApi = null;
        delete this.sessions[hostHash];
    }
    

    addLocalSession(userData: privfs.types.core.UserDataEx, mailClientApi: MailClientApi): Q.Promise<void> {
        this.defaultHost = userData.srpSecure.gateway.getHost();
        
        let hostHash = this.getHashFromHost(this.defaultHost);
        return Q().then(() => {
            if ( hostHash in this.sessions) {
                throw new Error("Session for host " + this.defaultHost + "already exists.");
            }
            let newSession: Session = {
                hostHash: this.getHashFromHost(this.defaultHost),
                host: this.defaultHost,
                userData: userData,
                mailClientApi: mailClientApi,
                sessionType: "local",
                ioc: this.globalIOC,
                manager: this,
                loadingPromise: Q.resolve(),
            };

            this.sessions[hostHash] = newSession;
            this.sessions[hostHash].initPromise = null;
        })
        .then(() => {
            // console.log("localSession added");
            this.eventDispatcher.dispatchEvent<event.HostSessionCreatedEvent>({type: "hostSessionCreated", hostHash: hostHash, host: this.defaultHost});
        })
        .then(() => {
            return this.globalIOC.resolve("mailStats");
        })
        .then((mailStats: MailStats) => {
            mailStats.setHostHash(this.sessions[hostHash]);
        });
    }

    init(hostHash: string): Q.Promise<void> {
        if (this.sessions[hostHash].initPromise) {
            return this.sessions[hostHash].initPromise;
        }
        let initDeferred: Q.Deferred<void> = Q.defer();
        this.sessions[hostHash].initPromise = initDeferred.promise;
        return Q().then(() => {
            return this.sessions[hostHash].mailClientApi.prepareAndGetSectionManager()
        })
        .then(sm => {
            // console.log("sessionmanager - sm prepared")
            this.sessions[hostHash].sectionManager = sm;
            return sm.load();
        })
        .then(() => {
            return this.sessions[hostHash].mailClientApi.privmxRegistry.getConv2Service();
        })
        .then(c2s => {
            this.sessions[hostHash].conv2Service = c2s;

            if (hostHash == this.getLocalSession().hostHash) {
                this.registerVoiceChatService(hostHash);
                this.registerVideoConferencesService(hostHash);

                // tymczasowo websock wylaczony dla sekcji zdalnych
                this.sessions[hostHash].webSocketNotifier = new WebSocketNotifier(this.eventDispatcher, this.sessions[hostHash], this.localeService, this.app);
                return this.sessions[hostHash].webSocketNotifier.init();    
    
            }
        })
        .then(() => {
            initDeferred.resolve();
        });
    }
    
    initAfterLogin(): Q.Promise<void> {
        let hostHash = this.getHashFromHost(this.defaultHost);
        return this.init(hostHash);
    }
    
    hasLocalSession(): boolean {
        return this.isSessionExistsByHost(this.defaultHost);
    }

    getLocalSession(): Session {
        return this.getSession(this.defaultHost);
    }

    closeLocalSession(): void {
        if (this.isSessionExistsByHost(this.defaultHost)) {
            this.closeRemoteSession(this.defaultHost);
        }
    }

    getHashFromHost(host: string): string {
        let shasum = crypto.createHash('sha1');
        return shasum.update(host).digest("hex");
    }

    getVoiceChatServiceApi(hostHash: string): VoiceChatServiceApi {
        if (this.sessions[hostHash].services && (this.sessions[hostHash]).services.voiceChatServiceApi) {
            return this.sessions[hostHash].services.voiceChatServiceApi;
        } else {
            throw new Error("Voice chat not initialized.");
        }
    }

    getVideoConferencesServiceApi(hostHash: string): VideoConferencesServiceApi {
        if (this.sessions[hostHash].services && (this.sessions[hostHash]).services.videoConferencesServiceApi) {
            return this.sessions[hostHash].services.videoConferencesServiceApi;
        }
        else {
            throw new Error("VideConferencesServiceApi not initialized.");
        }
    }
    
    isSessionExistsByHost(host: string): boolean {
        let hostHash = this.getHashFromHost(host);
        return hostHash in this.sessions;
    }

    isSessionExistsByHostHash(hostHash: string): boolean {
        return hostHash in this.sessions;
    }

    closeAllRemoteSessions(): void {
        let sessionsToClose: string[] = [];
        for (let hostHash in this.sessions) {
            if (this.sessions[hostHash].host == this.defaultHost) {
                // console.log("skip local session");
                continue;
            }
            sessionsToClose.push(hostHash);
            // console.log("sessions to close: ", this.sessions[hostHash].host);
        }
        sessionsToClose.forEach(hostHash => this.closeRemoteSession(hostHash));
    }
}