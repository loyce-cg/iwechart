import {BaseWindowController} from "../base/BaseWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import {app} from "../../Types";
import {MutableCollection} from "../../utils/collection/MutableCollection";
import {SinkIndexEntry} from "../../mail/SinkIndexEntry";
import {Inject} from "../../utils/Decorators"
import { CosignerService } from "../../mail/CosignerService";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
let VerifyStatus = SinkIndexEntry.VerifyStatus;
export type Cosigner = privfs.types.core.Cosigner&{domain: string, fingerprint: string, published: boolean, toPublish: boolean};

export interface VerifyResult {
    valid: boolean;
    domains: {[domain: string]: boolean};
}

export type VerifyInfoModel = string|{
    fetch: {
        result: privfs.pki.messages.VerifyResult,
        fingerprint: string,
        timestamp: number,
    },
    verified: {
        status: number,
        fetchId: any
    },
    error: boolean
    domain: string
}

export interface VerifyErrorModel {
    type: string;
    domain: string;
}

export interface Model {}

export class VerifyDomainWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.admin.verifydomain.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject cosignerService: CosignerService;
    entriesBase: MutableCollection<Cosigner>;
    published: privfs.pki.Types.messages.CosignersKeys;
    original: privfs.types.core.Cosigners;
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.minimizable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 400;
        this.openWindowOptions.height = 175;
        this.openWindowOptions.title = this.i18n("window.admin.verifydomain.title");
        this.openWindowOptions.icon = "icon fa fa-certificate";
        this.msgBoxBaseOptions = {bodyClass: "admin-alert"};
        
        this.entriesBase = this.addComponent("entriesBase", new MutableCollection<Cosigner>());
        this.loadCosigners();
    }
    
    init(): Q.Promise<void> {
        return;
    }
    
    getModel(): Model {
        return null;
    }
        
    onViewVerify(inputData: string): Q.Promise<void> {
        if (!inputData) {
            return;
        }
        let windowController = this;
        this.callViewMethod("onVerifyDomainResults", "loading");
        
        return windowController.addTaskEx("Wait...", true, () => {

            return this.verifySingle2(inputData).then(data => {
                this.callViewMethod("onVerifyDomainResults", data);
            })
            .catch(e => {
                this.getLogger().error("Error during verifing domain", e);
                let result: VerifyErrorModel = {
                    type: e == "Connection Broken" ? "connect" : "any",
                    domain: inputData
                };
                this.callViewMethod("onVerifyDomainError", result);
            })
        });
    }
    
    private verifySingle2(domain: string) {
        let cosigners: privfs.pki.Types.messages.CosignersKeys = {};
        this.entriesBase.forEach(entry => {
            cosigners[entry.domain] = entry.keystore;
        });
        
        let pkiOptions = {
            domain: domain,
            noCache: true
        }
        
        return Q().then(() => {
            return this.srpSecure.privmxPKI.getServerKeyStore({
                pkiOptions,
                treeOptions: {cosigners: cosigners},
                cacheLoad: false,
                cacheSave: false,
                fetchSave: false
            })
            .fail(function(e) {
                if (e && e.errorType == "invalid-tree-signature") {
                    e.pkiResult.error = true;
                    return e.pkiResult;
                }
                if (e && e.errorType == "invalid-server-keystore") {
                    e.result.error = true;
                    e.result.errorType = "invalid-server-keystore";
                    return e.result;
                }
                return Q.reject(e);
            });
        })
        .then((data:privfs.pki.Types.pki.KeyStoreEntry&{errorType?: string, error?: boolean})  => {
            let status = null;
            if (data.errorType == "invalid-server-keystore") {
                status = VerifyStatus.INVALID_SERVER_KEYSTORE;
            }
            else if (data.result.status == 0) {
                status = data.keystore == null ? VerifyStatus.KEY_DOESNT_EXISTS : VerifyStatus.OK;
            }
            else if (data.result.status == 1) {
                status = VerifyStatus.INVALID_SIGNATURE;
            }
            else if (data.result.status == 2) {
                status = VerifyStatus.INVALID_NET_STATE;
            }
            else if (data.result.status == 3) {
                status = VerifyStatus.NO_QUORUM;
            }
            return {
                fetch: {
                    result: data.result,
                    fingerprint: data.keyStoreMsg.getTree().getHash().toString("hex").substring(0, 8),
                    timestamp: data.timestamp,
                },
                verified: {
                    status: status,
                    fetchId: data.fetchId
                },
                error: data.error,
                domain: domain
            };
        });
    }
    
    private loadCosigners(): Q.Promise<void> {
        return Q().then(() => {
            return this.cosignerService.loadAllCosigners();
        })
        .then(result => {
            this.published = result.pkiCosigners;
            return this.setCosigners(result.adminCosigners);
        });
    }
    
    private setCosigners(cosigners: privfs.types.core.Cosigners): void {
        this.original = cosigners;
        this.entriesBase.clear();
        
        for (let domain in cosigners) {
            let data = <Cosigner>cosigners[domain];
            data.domain = domain;
            data.fingerprint = data.keystore.getPrimaryKey().keyPair.getFingerprint().toString("hex");
            data.published = domain in this.published;
            data.toPublish = (!data.published && data.state == "ACTIVE") || (data.published && data.state == "DELETED");
            
            if (data.state != "DELETED" || data.published) {
                this.entriesBase.add(data);
            }
        }
    }
    
    onViewClose(): void {
        this.close();
    }
}
