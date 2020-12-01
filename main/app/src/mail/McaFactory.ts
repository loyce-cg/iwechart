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
import {Lang} from "../utils/Lang";
import { CommonApplication } from "../app/common/CommonApplication";

let Logger = RootLogger.get("privfs-mail-client.mail.McaFactory");

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
    
    getGateway(host: string): Q.Promise<privfs.gateway.RpcGateway> {
        return Q().then(() => {
            return privfs.core.PrivFsRpcManager.getHttpGatewayByHost(host).fail(e => {
                if (this.cachedUrls) {
                    this.cachedUrls = false;
                    privfs.core.PrivFsRpcManager.urlMap = {};
                    return this.getGateway(host);
                }
                return Q.reject<privfs.gateway.RpcGateway>(e);
            });
        })
        .then(gateway => {
            this.eventDispatcher.dispatchEventResult(<event.EndpointResolvedEvent>{
                type: "endpointresolved",
                host: host,
                url: privfs.core.PrivFsRpcManager.urlMap[host],
                urlMap: privfs.core.PrivFsRpcManager.urlMap
            });
            return gateway;
        });
    }
    
    getSrp(host: string): Q.Promise<privfs.core.PrivFsSrpEx> {
        return Q().then(() => {
            return privfs.core.PrivFsRpcManager.getHttpSrpExByHost(MailConst.IDENTITY_INDEX, host).fail(e => {
                if (this.cachedUrls) {
                    this.cachedUrls = false;
                    privfs.core.PrivFsRpcManager.urlMap = {};
                    return this.getSrp(host);
                }
                return Q.reject<privfs.core.PrivFsSrpEx>(e);
            });
        })
        .then(srp => {
            this.eventDispatcher.dispatchEventResult(<event.EndpointResolvedEvent>{
                type: "endpointresolved",
                host: host,
                url: privfs.core.PrivFsRpcManager.urlMap[host],
                urlMap: privfs.core.PrivFsRpcManager.urlMap
            });
            srp.privFsSrp.additionalLoginStepCallback = this.resolveAdditionalLoginStep.bind(this);
            return srp;
        });
    }
    
    getKeyLogin(host: string): Q.Promise<privfs.core.PrivFsKeyLogin> {
        return Q().then(() => {
            return privfs.core.PrivFsRpcManager.getKeyLoginByHost(MailConst.IDENTITY_INDEX, host).fail(e => {
                if (this.cachedUrls) {
                    this.cachedUrls = false;
                    privfs.core.PrivFsRpcManager.urlMap = {};
                    return this.getKeyLogin(host);
                }
                return Q.reject<privfs.core.PrivFsKeyLogin>(e);
            });
        })
        .then(keyLogin => {
            this.eventDispatcher.dispatchEventResult(<event.EndpointResolvedEvent>{
                type: "endpointresolved",
                host: host,
                url: privfs.core.PrivFsRpcManager.urlMap[host],
                urlMap: privfs.core.PrivFsRpcManager.urlMap
            });
            keyLogin.additionalLoginStepCallback = this.resolveAdditionalLoginStep.bind(this);
            return keyLogin;
        });
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
                return this.getSrp(host);
            })
            .then(srp => {
                if (unregisteredSession) {
                    let gateway = srp.privFsSrp.rpcGateway;
                    gateway.properties = Lang.shallowCopy(gateway.properties);
                    gateway.properties.unregisteredSession = unregisteredSession;
                }
                // console.log("mcaFactory.login - srp.login");
                return srp.login(login, host, password, false, true)
            });
        })
        .then(authData => {

            return MailClientApi.create(this.app, authData, this.ioc);
        });
    }
    
    resolveAdditionalLoginStep(basicLoginResult: privfs.types.core.BasicLoginResult, data?: any): Q.Promise<void> {
        return Q().then(() => {
            let result = this.eventDispatcher.dispatchEventResult(<event.AdditionalLoginStepEvent>{
                type: "additionalloginstep",
                basicLoginResult: basicLoginResult,
                data: data
            });
            if (result == null) {
                throw new Error("Cannot login. There is no additional login step handler for given data " + JSON.stringify(data));
            }
            this.eventDispatcher.dispatchEventResult(<event.AdditionalLoginStepActionEvent>{
                type: "additionalloginstepaction"
            });
            return result;
        });
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

    registerFirstUser(username: string, host: string, login: string, password: string, email: string, pin: string, token: string,
         weakPassword: boolean, registerKey: string, creatorHashmail? : string): Q.Promise<privfs.types.core.RegisterDataEx> {
        let registerData: privfs.types.core.RegisterDataEx, mca: MailClientApi;
            return Q().then(() => {
                return this.getSrp(host)
                .then(srp => {
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
                })
        });
    }
    


    // registerExternal(username: string, host: string, email: string, password: string, pin: string, token: string, weakPassword: boolean, registerKey: string): Q.Promise<RegisterResult> {
    //     let registerData: privfs.types.core.RegisterDataEx, mca: MailClientApi;
    //     return PromiseUtils.notify(notify => {
    //         return Q().then(() => {
    //             notify("code.loadConfig");
    //             return this.getSrp(host);
    //         })
    //         .then(srp => {
    //             notify("code.register");
    //             return srp.register({
    //                 username: username,
    //                 host: host,
    //                 password: password,
    //                 email: email,
    //                 language: this.localeService.currentLang,
    //                 pin: pin,
    //                 token: token,
    //                 weakPassword: weakPassword
    //             });
    //         })
    //         .then(rd => {
    //             registerData = rd;
    //             return Q().then(() => {
    //                 notify("code.prepareSession");
    //                 return this.login(email, password);
    //             })
    //             .then(m => {
    //                 mca = m;
    //                 return mca.registrationSession(registerKey).progress(x => notify(x));
    //             })
    //             .fail(e => {
    //                 Logger.error(e, e.stack);
    //             });
    //         })
    //         .then(() => {
    //             return {
    //                 registerData: registerData,
    //                 mailClientApi: mca
    //             };
    //         });
    //     });
    // }
}
