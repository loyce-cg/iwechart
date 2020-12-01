import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import {app} from "../../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import {UserAdminService} from "../../../mail/UserAdminService";
import {Inject} from "../../../utils/Decorators";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";
import { WebCCApi } from "../../../mail/WebCCApi";
import { Identity } from "../../../../node_modules/privfs-client/out/identity";
export type Model = app.TrialStatus & {config: privfs.types.core.ConfigEx};



export class PaymentsController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.payments.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "payments";
    
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
        let user = this.parent.identity.user;
        return Q().then(() => {
            return Q.all([
                this.parent.utilApi.getFullPaymentStatus(),
                this.srpSecure.getConfigEx(),
            ])
        })
        .then(res => {
            let [ps, config] = res;
            let model: Model = {
                config: config,
                isAdmin: this.parent.identityProvider.isAdmin(),
                subscriptionEnding: ps.subscriptionEnding,
                trial: ps.free,  // free znaczy tutaj czy server jest na trialowym okresie.. troche nieszczesna ta nazwa schodzi z serwera
                startDate: Number(ps.startDate),
                endDate: Number(ps.endDate),
                expired: ps.expired,
                hasExtendOrder: ps.hasExtendOrder,
                maxUsers: (ps.serverParams.users as number),
                totalStorage: (ps.serverParams.storage as string),
                orderId: (ps.order as string)
            };
            return model;
        })
        .then(model => {
            this.callViewMethod("renderContent", model);
        });
    }

    onViewOpenControlCenter(orderId: string): void {
        Q().then(() => {
        //     return this.adminPasswordAuthentication();
        // })
        // .then(() => {
            return WebCCApi.getControlCenterToken(this.srpSecure.gateway, orderId)   
        })
        .then(res => {
            // console.log(res);
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
}
