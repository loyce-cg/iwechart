import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {UserAdminService} from "../../../mail/UserAdminService";
import {Inject} from "../../../utils/Decorators";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";
import { WebCCApi } from "../../../mail/WebCCApi";
import * as PmxApi from "privmx-server-api";

export type ServerInfo = privfs.types.core.ConfigEx&{clientVersion: string, serviceDiscoveryUrl: string, lastBackupDate: string};

export interface Model {
    currentUsers: {internal: number, external: number, maxUsers: number};
    appVersion: string;
    instanceName: string;
    config: ServerInfo;
    canDeleteDemoContent: boolean;
    dataCenterUser: {id: string, login: string};
    lastBackup: number;
    dataCenterLocation: {dcName: string, locationName: string};
    expireDate: number;
    totalStorage: string;
}

export class SysInfoController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.sysinfo.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "sysinfo";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject userAdminService: UserAdminService;

    modelTransformer: (model: Model) => Q.IWhenable<Model>;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.userAdminService = this.parent.userAdminService;
    }
    
    prepare(): Q.Promise<void> {
        let config: ServerInfo;
        let user = this.parent.identity.user;
        return Q().then(() => {
            return Q.all([
                this.srpSecure.getConfigEx()
                .catch(e => {
                    let dummyCfg: {instanceUrl: string, hosts: string[]} = {
                        instanceUrl: "localhost/server", 
                        hosts: ["localhost"]
                    } 
                    return Q.resolve(dummyCfg);
                }),
                this.srpSecure.getUser(this.parent.identity.user).catch(e => Q.resolve(null)),
                this.parent.utilApi.getDataCenterLocationInfo(),
                this.parent.utilApi.getFullPaymentStatus(),
                this.userAdminService.refreshUsersCollection()
            ])
        })
        .then(res => {
            let [cfg, user, locationInfo, paymentInfo] = res;
            config = <ServerInfo>cfg;
            config.clientVersion = this.app.getVersion().ver;
            config.serviceDiscoveryUrl = config.instanceUrl.replace(/server\/{0,1}$/, "privmx-configuration.json");
            return this.userAdminService.refreshUsersCollection()
            .then(() => {
                return this.app.mailClientApi.hasImportedDemoContent();
            })
            .then(hasImportedDemoContent => {
                let lastBackupDate: number = cfg && (<any>cfg).lastBackupDate ? Number((<any>cfg).lastBackupDate) : null;
                let dcUser: {id: string, login: string} = (<any>user).dataCenterUser ? (<any>user).dataCenterUser : null;
                
                let maxUsers = paymentInfo.serverParams ? paymentInfo.serverParams.users : null;
                let totalStorage = paymentInfo.serverParams ? paymentInfo.serverParams.storage : null;
                
                let model: Model = {
                    currentUsers: {
                        internal: this.userAdminService.usersCollection.list.filter(u => u.rights.indexOf("normal") > -1).length,
                        external: this.userAdminService.usersCollection.list.filter(u => u.rights.indexOf("normal") == -1).length,
                        maxUsers: maxUsers,
                    },
                    config: config,
                    appVersion: this.app.getVersion().str,
                    instanceName: this.parent.userConfig.instanceName || this.app.getInstanceName(),
                    canDeleteDemoContent: hasImportedDemoContent,
                    lastBackup: lastBackupDate,
                    dataCenterUser: dcUser,
                    dataCenterLocation: {dcName: locationInfo.dcName, locationName: locationInfo.displayName},
                    expireDate: paymentInfo.endDate ? Number(paymentInfo.endDate) : -1,
                    totalStorage: totalStorage,
                };
                return typeof(this.modelTransformer) == "function" ? this.modelTransformer(model) : model;
            })
            .then(model => {
                this.callViewMethod("renderContent", model);
            });
        });
    }

    onViewOpenControlCenter(): void {
        Q().then(() => {
            return this.adminPasswordAuthentication();
        })
        .then(() => {
            return WebCCApi.getControlCenterToken(this.srpSecure.gateway);    
        })
        .then(res => {
            this.parent.app.openUrl(res.url);
        })
        .fail(e => {
            this.parent.errorCallback(e);
        });
    }

    delayPromise(): Q.Promise<void> {
        let defer = Q.defer<void>();
        setTimeout(() => defer.resolve(), 1000);
        return defer.promise;
    }

    adminPasswordAuthentication(): Q.Promise<void> {
        return Q().then(() => {
            let options = {
                message: this.i18n("window.admin.sysinfo.authenticate.header"),
                info: this.i18n("window.admin.sysinfo.authenticate.info"),
                input: {placeholder: this.i18n("window.admin.sysinfo.authenticate.placeholder"), type: "password"},
                bodyClass: "admin-alert",
                width: 500,
                ok: {
                    label: this.i18n("window.admin.sysinfo.authenticate.confirm")
                }
            }
            return this.parent.promptEx(options)
        })
        .then(result => {
            return this.delayPromise().thenResolve(result);
        })
        .then(result => {
            if (result.result != "ok" || !result.value || result.value != this.app.userCredentials.password) {
                return Q.reject<any>("No access");
            }
            return;
        });
    }
    
    onViewDeleteDemoContent(): void {
        this.parent.confirmEx({
            message: this.i18n("window.admin.sysinfo.deleteDemoContent.confirm.message"),
            yes: {
                visible: true,
            },
            no: {
                visible: true,
            },
        }).then(result => {
            if (result.result == "yes") {
                this.updateDeleteDemoContentProgress(0, 0);
                this.app.mailClientApi.deleteDemoContent(this.updateDeleteDemoContentProgress.bind(this));
            }
        });
    }
    
    updateDeleteDemoContentProgress(done: number, total: number): void {
        this.callViewMethod("updateDeleteDemoContentProgress", done, total);
    }
    
}
