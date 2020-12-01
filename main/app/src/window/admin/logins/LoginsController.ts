import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {Inject} from "../../../utils/Decorators";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";

export type ServerInfo = privfs.types.core.ConfigEx&{clientVersion: string, serviceDiscoveryUrl: string};

export interface Model {
    logins: LoginEntry[];
    pages: number;
    pageNo: number;
}

export interface LoginEntry {
    success: boolean;
    error: string;
    deviceId: string;
    deviceName: string;
    time: number;
    username: string;
    ip: string;
}

export interface LoginsResult {
    count: number;
    entries: LoginEntry[];
}

export class LoginsApi {
    
    constructor(public gateway: privfs.gateway.RpcGateway) {
    }
    
    getLastLoginsAttempts(count: number): Q.Promise<LoginsResult> {
        return this.gateway.request("getLastLoginsAttempts", {count: count});
    }
    
    getLoginsAttemptsPage(beg: number, end: number): Q.Promise<LoginsResult> {
        return this.gateway.request("getLoginsAttemptsPage", {beg: beg, end: end});
    }
}

export class LoginsController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.logins.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "logins";
    static PAGE_COUNT: number = 100;
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    loginsApi: LoginsApi;
    count: number;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.loginsApi = new LoginsApi(this.srpSecure.gateway);
    }
    
    prepare(): Q.Promise<void> {
        return Q().then(() => {
            return this.loginsApi.getLastLoginsAttempts(LoginsController.PAGE_COUNT);
        })
        .then(result => {
            this.count = result.count;
            let model: Model = {
                logins: result.entries.sort((a, b) => b.time - a.time),
                pages: Math.ceil(result.count / LoginsController.PAGE_COUNT),
                pageNo: 0
            };
            this.callViewMethod("renderContent", model);
            this.callViewMethod("renderGrid", model);
        });
    }
    
    onViewGetPage(pageNo: number) {
        this.addTaskEx(this.i18n(""), true, () => {
            return Q().then(() => {
                return this.loginsApi.getLoginsAttemptsPage(Math.max(0, this.count - (pageNo + 1) * LoginsController.PAGE_COUNT), this.count - pageNo * LoginsController.PAGE_COUNT);
            })
            .then(result => {
                this.count = result.count;
                let model: Model = {
                    logins: result.entries.sort((a, b) => b.time - a.time),
                    pages: Math.ceil(result.count / LoginsController.PAGE_COUNT),
                    pageNo: pageNo
                };
                this.callViewMethod("renderPage", model);
            });
        });
    }
}
