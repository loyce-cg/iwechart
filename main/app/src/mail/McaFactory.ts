import * as privfs from "privfs-client";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import {PromiseUtils} from "simplito-promise";
import {LocaleService} from "./LocaleService";
import {event} from "../Types";
import {MailClientApi} from "./MailClientApi";
import {EventDispatcher} from "../utils/EventDispatcher";
import {MailConst} from "./MailConst";
import {IOC} from "./IOC";
import { Profile } from "./UserPreferences";
import { CommonApplication } from "../app/common/CommonApplication";

const Logger = RootLogger.get("privfs-mail-client.mail.McaFactory");

export interface RegisterResult {
    registerData: privfs.types.core.RegisterDataEx;
    mailClientApi: MailClientApi;
}

export interface RegisterParams {
    username: string;
    host: string;
    login: string;
    password: string;
    email: string;
    pin: string;
    token: string;
    weakPassword: boolean;
    registerKey: string;
    creatorHashmail?: string;
    overrideWithProfile?: Profile;
    unregisteredSession?: string;
}

export class McaFactory {
    
    cachedUrls: boolean;
    app: CommonApplication;
    
    constructor(
        public localeService: LocaleService,
        public eventDispatcher: EventDispatcher,
        public ioc: IOC
    ) {
        this.app = (eventDispatcher as CommonApplication);
    }
    
    setCachedUrls(urls: {[host: string]: string}): void {
        for (let host in urls) {
            privfs.core.PrivFsRpcManager.urlMap[host] = urls[host];
        }
        this.cachedUrls = true;
    }
    
    async getGateway(host: string): Promise<privfs.gateway.RpcGateway> {
        try {
            const gateway = await privfs.core.PrivFsRpcManager.getHttpGatewayByHost({host: host});
            this.eventDispatcher.dispatchEventResult(<event.EndpointResolvedEvent>{
                type: "endpointresolved",
                host: host,
                url: privfs.core.PrivFsRpcManager.urlMap[host],
                urlMap: privfs.core.PrivFsRpcManager.urlMap
            });
            return gateway;
        }
        catch (e) {
            if (this.cachedUrls) {
                this.cachedUrls = false;
                privfs.core.PrivFsRpcManager.urlMap = {};
                return this.getGateway(host);
            }
            throw e;
        }
    }
    
    async getSrp(host: string, unregisteredSession?: string): Promise<privfs.core.PrivFsSrpEx> {
        try {
            const srp = await privfs.core.PrivFsRpcManager.getHttpSrpExByHost({
                identityIndex: MailConst.IDENTITY_INDEX,
                host: host,
                additionalLoginStepCallback: this.resolveAdditionalLoginStep.bind(this),
                extraGatewatProperties: {
                    unregisteredSession: unregisteredSession
                }
            });
            this.eventDispatcher.dispatchEventResult(<event.EndpointResolvedEvent>{
                type: "endpointresolved",
                host: host,
                url: privfs.core.PrivFsRpcManager.urlMap[host],
                urlMap: privfs.core.PrivFsRpcManager.urlMap
            });
            return srp;
        }
        catch (e) {
            if (this.cachedUrls) {
                this.cachedUrls = false;
                privfs.core.PrivFsRpcManager.urlMap = {};
                return this.getSrp(host);
            }
            throw e;
        }
    }
    
    async getKeyLogin(host: string): Promise<privfs.core.PrivFsKeyLogin> {
        try {
            const keyLogin = await privfs.core.PrivFsRpcManager.getKeyLoginByHost({
                identityIndex: MailConst.IDENTITY_INDEX,
                host: host,
                additionalLoginStepCallback: this.resolveAdditionalLoginStep.bind(this)
            });
            this.eventDispatcher.dispatchEventResult(<event.EndpointResolvedEvent>{
                type: "endpointresolved",
                host: host,
                url: privfs.core.PrivFsRpcManager.urlMap[host],
                urlMap: privfs.core.PrivFsRpcManager.urlMap
            });
            return keyLogin;
        }
        catch (e) {
            if (this.cachedUrls) {
                this.cachedUrls = false;
                privfs.core.PrivFsRpcManager.urlMap = {};
                return this.getKeyLogin(host);
            }
            throw e;
        }
    }
    
    alternativeLogin(host: string, words: string): Q.Promise<MailClientApi> {
        return PromiseUtils.notify(notify => {
            return Q().then(() => {
                notify("code.loadConfig");
                return this.getKeyLogin(host);
            })
            .then(keyLogin => {
                notify("code.prepareSession");
                return keyLogin.login(words, false);
            });
        })
        .then(authData => {
            return MailClientApi.create(this.app, authData, this.ioc);
        });
    }
    
    login(login: string, host: string, password: string, unregisteredSession?: string): Q.Promise<MailClientApi> {
        return PromiseUtils.notify(notify => {
            return Q().then(() => {
                notify("code.loadConfig");
                return this.getSrp(host, unregisteredSession);
            })
            .then(srp => {
                return srp.login(login, host, password, false, true)
            });
        })
        .then(authData => {
            return MailClientApi.create(this.app, authData, this.ioc);
        });
    }
    
    async resolveAdditionalLoginStep(context: privfs.types.core.AdditionalLoginContext, data?: any): Promise<void> {
        const result = this.eventDispatcher.dispatchEventResult(<event.AdditionalLoginStepEvent>{
            type: "additionalloginstep",
            basicLoginResult: {srpSecure: new privfs.core.PrivFsSrpSecure(context.gateway, null)},
            data: data
        });
        if (result == null) {
            throw new Error("Cannot login. There is no additional login step handler for given data " + JSON.stringify(data));
        }
        this.eventDispatcher.dispatchEventResult(<event.AdditionalLoginStepActionEvent>{
            type: "additionalloginstepaction"
        });
        return result;
    }
    
    register(params: RegisterParams): Q.Promise<RegisterResult> {
        let registerData: privfs.types.core.RegisterDataEx, mca: MailClientApi;
        
        return PromiseUtils.notify(notify => {
            return Q().then(() => {
                notify("code.loadConfig");
                return this.getSrp(params.host);
            })
            .then(srp => {
                notify("code.register");
                return srp.register({
                    username: params.username,
                    host: params.host,
                    login: params.login,
                    password: params.password,
                    email: params.email,
                    language: this.localeService.currentLang,
                    pin: params.pin,
                    token: params.token,
                    weakPassword: params.weakPassword
                });
            })
            .then(rd => {
                registerData = rd;
                return Q().then(() => {
                    notify("code.prepareSession");
                    return this.login(params.login, params.host, params.password, params.unregisteredSession);
                })
                .then(m => {
                    mca = m;
                    return mca.registrationSession(params.registerKey, params.username != params.login ? params.login : undefined, params).progress(x => notify(x));
                })
                .fail(e => {
                    Logger.error(e, e.stack);
                });
            })
            .then(() => {
                return {
                    registerData: registerData,
                    mailClientApi: mca
                };
            });
        });
    }
    
    async registerFirstUser(username: string, host: string, login: string, password: string, email: string, pin: string, token: string,
         weakPassword: boolean, registerKey: string, creatorHashmail? : string): Promise<privfs.types.core.RegisterDataEx> {
        
        const srp = await this.getSrp(host);
        return srp.register({
            username: username,
            host: host,
            login: login,
            password: password,
            email: email,
            language: this.localeService.currentLang,
            pin: pin,
            token: token,
            weakPassword: weakPassword
        });
    }
}
