import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import {SecureFormDevWindowController} from "../../secureformdev/SecureFormDevWindowController";
import {SinkService} from "../../../mail/SinkService";
import {SinkIndexManager} from "../../../mail/SinkIndexManager";
import {MailStats} from "../../../mail/MailStats";
import {Inject} from "../../../utils/Decorators"
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export type ServerInfo = privfs.types.core.ConfigEx&{clientVersion: string, serviceDiscoveryUrl: string};

export interface Model {
    forms: {
        id: string;
        name: string;
        verifyEmail: boolean;
        removable: boolean;
        subtype: string;
        stats: {
            total: number;
            unread: number;
        }
    }[];
}

export class SecureFormsController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "secureForms";
    
    @Inject sinkService: SinkService;
    @Inject sinkIndexManager: SinkIndexManager;
    @Inject mailStats: MailStats;
    @Inject identity: privfs.identity.Identity;
    @Inject messageManager: privfs.message.MessageManager;
    @Inject sinkEncryptor: privfs.crypto.utils.ObjectEncryptor;
    
    hostConfiguration: privfs.serviceDiscovery.Config;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.sinkService = this.parent.sinkService;
        this.sinkIndexManager = this.parent.sinkIndexManager;
        this.mailStats = this.parent.mailStats;
        this.identity = this.parent.identity;
        this.messageManager = this.parent.messageManager;
        this.sinkEncryptor = this.parent.sinkEncryptor;
    }
    
    getSecureFormsModel(): Model {
        let model: Model = {
            forms: []
        };
        model.forms = this.sinkService.getAllSecureFormInboxes().map(sink => {
            let index = this.sinkIndexManager.getIndexBySinkId(sink.id);
            let stats = this.mailStats.getStats(index.sink.id);
            return {
                id: sink.id,
                name: sink.name,
                verifyEmail: sink.options.verify == "email",
                removable: sink.options.removable,
                subtype: sink.extra.subtype,
                stats: {
                    total: index.entries.size(),
                    unread: stats ? stats.unread : 0
                }
            };
        });
        return model;
    }
    
    prepare(): Q.IWhenable<void> {
        return Q().then(() => {
            let host = this.identity.host;
            return privfs.core.PrivFsRpcManager.discoverHostConfiguration(host);
        })
        .then(config => {
            this.hostConfiguration = config;
            let model = this.getSecureFormsModel();
            this.callViewMethod("renderContent", model);
        });
    }
    
    onViewCreateSecureForm(): void {
        this.addTaskEx("", true, () => {
            let options = {
                message: this.i18n("window.settings.section.secureForms.create.prompt.text"),
                ok: {
                    label: this.i18n("window.settings.section.secureForms.create.prompt.confirm")
                },
                input: {
                    placeholder: this.i18n("window.settings.section.secureForms.create.prompt.placeholder", this.app.getDefaultHost())
                }
            };
            return this.parent.promptEx(options)
            .then(result => {
                if (result.result != "ok" || !result.value) {
                    return;
                }
                return Q().then(() => {
                    return this.sinkService.createSecureFormInbox(result.value);
                })
                .then(() => {
                    this.callViewMethod("renderContent", this.getSecureFormsModel());
                });
            });
        });
    }
    
    onViewShowSecureFormTest(id: string): void {
        this.openFormTest(id);
    }
    
    onViewDeleteSecureForm(id: string): void {
        this.addTaskEx("", true, () => {
            return this.parent.confirm(this.i18n("window.settings.section.secureForms.delete.question"))
            .then(result => {
                if (result.result != "yes") {
                    return;
                }
                return Q().then(() => {
                    return this.sinkService.deleteSecureFormInbox(id);
                })
                .then(() => {
                    this.callViewMethod("renderContent", this.getSecureFormsModel());
                });
            });
        });
    }
    
    onViewSwitchVerifyEmailSecureForm(sid: string, mode: boolean) {
        this.addTaskEx("", true, () => {
            let sink = this.sinkIndexManager.getSinkById(sid);
            if (!sink) {
                return;
            }
            if (mode) {
                sink.options.verify = "email";
            }
            else {
                delete sink.options.verify;
            }
            return Q().then(() => {
                return this.messageManager.sinkSave(sink, this.sinkEncryptor);
            })
            .then(() => {
                this.callViewMethod("setVerifyEmailSecureForm", sid, mode);
            });
        });
    }
    
    openFormTest(sinkID: string): void {
        this.sinkService.createSecureFormToken(sinkID)
        .then(token => {
            let url = this.hostConfiguration.defaultEndpoint + "/secure-form/example.php?token=" + token + "&lang=" + this.app.localeService.currentLang;
            this.parent.alertEx({
                message: this.i18n("window.settings.section.secureForms.testInfo"),
                ok: {
                    link: {
                        attrs: {
                            href: url,
                            target: "_blank"
                        }
                    }
                }
            });
        })
        .catch(error => {
            this.onError(error);
        });
    }
    
    onViewOpenSecureFormDev(sid: string): void {
        this.app.ioc.create(SecureFormDevWindowController, [this.parent, {
            sid: sid,
            testOpener: this
        }])
        .then(win => {
            this.parent.openChildWindow(win);
        });
    }
}
