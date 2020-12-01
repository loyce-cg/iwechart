import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import {ExtListController} from "../../../component/extlist/ExtListController";
import {AutoRefreshController} from "../../../component/autorefresh/AutoRefreshController";
import {MutableCollection} from "../../../utils/collection/MutableCollection";
import * as privfs from "privfs-client";
import {VerifyDomainWindowController} from "../../verifydomain/VerifyDomainWindowController";
import {ClearCacheWindowController} from "../../clearcache/ClearCacheWindowController";
import {CosignerService} from "../../../mail/CosignerService";
import {Inject, Dependencies} from "../../../utils/Decorators";
import { TransformCollection } from "../../../utils/collection";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";
export type Cosigner = privfs.types.core.Cosigner&{domain: string, fingerprint: string, published: boolean, toPublish: boolean};
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type CosignerPartial = Omit<Cosigner, "keystore">;

export interface VerifyResult {
    valid: boolean;
    domains: {[domain: string]: boolean};
}

export interface Model {
    hasEntriesToPublish: boolean;
}

@Dependencies(["autorefresh", "extlist"])
export class TrustedController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.trusted.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "trusted";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    @Inject cosignerService: CosignerService;
    
    entriesBase: MutableCollection<Cosigner>;
    entriesTransformed: TransformCollection<CosignerPartial, Cosigner>;
    entries: ExtListController<CosignerPartial>;
    published: privfs.pki.Types.messages.CosignersKeys;
    original: privfs.types.core.Cosigners;
    entriesSize: AutoRefreshController<number>;
    hasEntriesToPublish: boolean;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.identity = this.parent.identity;
        this.cosignerService = this.parent.cosignerService;
        this.entriesBase = this.addComponent("entriesBase", new MutableCollection<Cosigner>());
        this.entriesTransformed = this.addComponent("entriesTransformed", new TransformCollection<CosignerPartial, Cosigner>(this.entriesBase, c => {
            let cp: any = {};
            for (let k in c) {
                if (k != "keystore") {
                    cp[k] = (<any>c)[k];
                }
            }
            return <CosignerPartial>cp;
        }));
        this.entries = this.addComponent("entries", this.componentFactory.createComponent("extlist", [this, this.entriesTransformed]));
        this.entries.ipcMode = true;
        this.entriesSize = this.addComponent("entriesSize", this.componentFactory.createComponent<number, void>("autorefresh", [this, {model: this.entriesTransformed, isCollectionSize: true}]));
        this.entriesSize.ipcMode = true;
        this.loadCosigners();
    }
    
    getModel(): Model {
        return {
            hasEntriesToPublish: this.hasEntriesToPublish
        };
    }
    
    onViewAddDomain(): void {
        let windowController = this.parent;
        windowController.promptEx({
            title: this.i18n("window.admin.trusted.add.title"),
            message: this.i18n("window.admin.trusted.add.header"),
            info: this.i18n("window.admin.trusted.add.info"),
            input: {placeholder: this.i18n("window.admin.trusted.add.domain.placeholder")},
            processing: "ok",
            width: 500,
            height: 230,
            ok: {
                label: this.i18n("window.admin.trusted.add.confirm")
            },
            onClose: result => {
                if (result.result != "ok") {
                    result.close();
                    return;
                }
                if (!result.value) {
                    return;
                }
                let hashmail = result.value;
                let domain = hashmail.split("#")[1];
                if (this.entriesBase.getBy("domain", domain)) {
                    windowController.alert(this.i18n("window.admin.trusted.add.error.exist"));
                    return;
                }
                result.startProcessing();
                this.cosignerService.inviteCosigner(hashmail)
                .then(cosigners => {
                    this.setCosigners(cosigners);
                    this.callViewMethod("afterAddDomain", domain);
                })
                .then(() => {
                    result.close();
                })
                .fail(e => {
                    let msg = "Error";
                    if (e && e.msg == "cannot-resolve-hasmail") {
                        if (privfs.core.ApiErrorCodes.is(e.couse, "USER_DOESNT_EXIST") || (e.couse && e.couse.message == "user-does-not-exists")) {
                            msg = this.i18n("window.admin.trusted.add.error.userNotFound");
                        }
                        else if (e.couse && e.couse.msg && e.couse.msg.indexOf("Cannot resolve endpoint for") == 0) {
                            msg = this.i18n("window.admin.trusted.add.error.incompatible");
                        }
                        else {
                            msg = this.i18n("window.admin.trusted.add.error.cannotResolveHashmail");
                        }
                    }
                    else {
                        msg = this.i18n("window.admin.trusted.add.error.incompatible");
                    }
                    windowController.onErrorCustom(msg, e);
                })
                .fin(() => {
                    result.stopProcessing();
                });
            }
        });
    }
    
    onViewVerifyDomain() {
        this.app.ioc.create(VerifyDomainWindowController, [this.parent]).then(win => {
            this.parent.openChildWindow(win);
        });
    }
    
    onViewClearDomainCache() {
        this.app.ioc.create(ClearCacheWindowController, [this.parent]).then(win => {
            this.parent.openChildWindow(win);
        });
    }
    
    onViewDeleteDomain(channelId: number, domain: string): void {
        let windowController = this.parent;
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            if (domain == this.app.getDefaultHost()) {
                return;
            }
            return windowController.confirm()
            .then(result => {
                if (result.result != "yes") {
                    return;
                }
                return this.cosignerService.removeCosigner(domain, this.entriesBase.getBy("domain", domain))
                .then(cosigners => {
                    this.setCosigners(cosigners);
                    this.callViewMethod("afterRemoveDomain", domain);
                });
            });
        });
    }
    
    onViewAcceptDomain(channelId: number, domain: string): void {
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            return this.cosignerService.acceptCosigner(domain, this.entriesBase.getBy("domain", domain))
            .then(cosigners => {
                this.setCosigners(cosigners);
            });
        });
    }
    
    onViewPublish(channelId: number): void {
        let cosigners: privfs.pki.Types.messages.CosignersKeys = {};
        this.entriesBase.forEach(entry => {
            if (entry.state !== "ACTIVE") {
                return;
            }
            cosigners[entry.domain] = entry.keystore;
        });
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            return Q().then(() => {
                return this.verify(cosigners);
            })
            .then(result => {
                if (!result.valid) {
                    this.parent.alert(this.i18n("window.admin.trusted.verifyError"));
                    return;
                }
                return Q().then(() => {
                    return this.srpSecure.publishCosigners(this.identity.priv, cosigners);
                })
                .then(() => {
                    this.published = cosigners;
                    if (this.cosignerService.trustedServers) {
                        this.cosignerService.trustedServers.cosigners = cosigners;
                    }
                    this.setCosigners(this.original);
                    this.parent.alert(this.i18n("window.admin.trusted.summary"));
                });
            });
        });
    }
    
    onViewRefreshDomains(channelId: number): void {
        this.addTaskExWithProgress("", true, channelId, () => {
            return this.loadCosigners();
        });
    }
    
    loadCosigners(): Q.Promise<void> {
        return Q().then(() => {
            return this.cosignerService.loadAllCosigners();
        })
        .then(result => {
            this.published = result.pkiCosigners;
            return this.setCosigners(result.adminCosigners);
        });
    }
    
    setCosigners(cosigners: privfs.types.core.Cosigners): void {
        this.original = cosigners;
        this.entriesBase.clear();
        this.hasEntriesToPublish = false;
        for (let domain in cosigners) {
            let data = <Cosigner>cosigners[domain];
            data.domain = domain;
            data.fingerprint = data.keystore.getPrimaryKey().keyPair.getFingerprint().toString("hex");
            data.published = domain in this.published;
            data.toPublish = (!data.published && data.state == "ACTIVE") || (data.published && data.state == "DELETED");
            if (data.toPublish) {
                this.hasEntriesToPublish = true;
            }
            if (data.state != "DELETED" || data.published) {
                this.entriesBase.add(data);
            }
        }
        this.callViewMethod("refreshToPublish", this.hasEntriesToPublish);
    }
    
    prepare(): Q.Promise<void> {
        return this.loadCosigners();
    }
    
    hasMissing(result: privfs.pki.messages.VerifyResult): boolean {
        for (let i = 0; i < result.cosigners.length; i++) {
            if (result.cosigners[i].status != 0) {
                return true;
            }
        }
        return false;
    }
    
    verify(cosigners: privfs.pki.Types.messages.CosignersKeys): Q.Promise<VerifyResult> {
        let result: VerifyResult = {
            valid: true,
            domains: {}
        };
        let responses: {[domain: string]: any} = {};
        let domains = [];
        for (var domain in cosigners) {
            domains.push(domain);
        }
        return Q.all(domains.map(domain => {
            return this.srpSecure.privmxPKI.getServerKeyStore({
                pkiOptions: {
                    domain: domain,
                    noCache: true
                },
                treeOptions: {cosigners: cosigners},
                cacheLoad: false,
                cacheSave: false,
                fetchSave: false
            })
            .then(response => {
                responses[domain] = response;
                if (this.hasMissing(response.result)) {
                    result.domains[domain] = false;
                    result.valid = false;
                }
                else {
                    result.domains[domain] = true;
                }
            })
            .fail(e => {
                responses[domain] = e;
                result.domains[domain] = false;
                result.valid = false;
            });
        }))
        .then(() => {
            this.parent.getLogger().info("Trusted verify", result, responses);
            return result;
        });
    }


}
