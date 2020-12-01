import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import {ExtListController} from "../../../component/extlist/ExtListController";
import {MutableCollection} from "../../../utils/collection/MutableCollection";
import {SortedCollection} from "../../../utils/collection/SortedCollection";
import {Lang} from "../../../utils/Lang";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../../utils/Decorators";
import { LocaleService, UtilApi } from "../../../mail";
import { i18n } from "./i18n";
import { ServerProxyService, ServerProxyApi, ProxyUtils, types as proxyTypes } from "../../../mail/proxy";
import { SelectContactsWindowController } from "../../selectcontacts/SelectContactsWindowController";
import { SectionUtils } from "../../../mail/section/SectionUtils";


export interface Entry {
    data: proxyTypes.ServerProxy,
    id: number
}

export interface Model {
    todo: boolean;
}

@Dependencies(["extlist"])
export class ProxyWhitelistController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.proxywhitelist.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "proxywhitelist";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    @Inject serverProxyService: ServerProxyService;
    @Inject utilApi: UtilApi;
    
    api: ServerProxyApi;
    
    proxyWhitelistBase: MutableCollection<Entry>;
    sorted: SortedCollection<Entry>;
    proxyWhitelist: ExtListController<Entry>;
    todo: boolean;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        // console.log("constr")
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.identity = this.parent.identity;
        this.serverProxyService = this.parent.serverProxyService;
        this.utilApi = this.parent.utilApi;
        this.api = new ServerProxyApi(this.serverProxyService.gateway);
        
        this.proxyWhitelistBase = this.addComponent("proxyWhitelistBase", new MutableCollection<Entry>());
        this.sorted = this.addComponent("sorted", new SortedCollection(this.proxyWhitelistBase, (a, b) => {
            return a.data.host.localeCompare(b.data.host);
        }));
        this.proxyWhitelist = this.addComponent("proxywhitelist", this.componentFactory.createComponent("extlist", [this, this.sorted]));
        this.proxyWhitelist.ipcMode = true;
    }
    
    getModel(): Model {
        return {
            todo: this.todo,
        };
    }
    
    onViewAddDomain(): void {
        let windowController = this.parent;
        this.addTaskEx("", true, () => {
            let options = {
                message: this.i18n("window.admin.proxywhitelist.addRule.header"),
                input: {placeholder: this.i18n("window.admin.proxywhitelist.addRule.domain.placeholder")},
                bodyClass: "admin-alert",
                width: 500,
                ok: {
                    label: this.i18n("window.admin.proxywhitelist.addRule.confirm")
                }
            };
            return windowController.promptEx(options)
            .then(result => {
                if (result.result != "ok" || !result.value) {
                    return;
                }
                return Q().then(() => {
                    let domain = result.value;
                    return Q().then(() => {
                        let entry = this.proxyWhitelistBase.find(x => {
                            return x.data.host == domain;
                        });
                        if (entry) {
                            return Q.reject<proxyTypes.ServerProxy>();
                        }
                        return this.serverProxyService.fetchServerKeyAndAddServerProxy(domain, false, true, true, "admin");
                    })
                    .then(proxy => {
                        let maxId: number = -1;
                        this.proxyWhitelistBase.forEach(x => {
                            if (x.id > maxId) {
                                maxId = x.id;
                            }
                        });
                        this.proxyWhitelistBase.add({id: (maxId + 1), data: proxy});
                    })
                    .fail(e => {
                        windowController.onErrorCustom(this.i18n("window.admin.blacklist.addRule.error.invalid"), e);
                    });
                });
            });
        });
    }
    
    onViewSetDomain(channelId: number, id: number, action: string, prevValue: boolean): void {
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            return Q().then(() => {
                let entry = this.proxyWhitelistBase.find(x => {
                    return x.id == id;
                });
                if (entry) {
                    if (action == "enabled") {
                        entry.data.enabled = !prevValue;
                    }
                    // DISABLED IN CURRENT VERSION
                    // if (action == "in-enabled") {
                    //     entry.data.inEnabled = !prevValue;
                    // }
                    // if (action == "out-enabled") {
                    //     entry.data.outEnabled = !prevValue;
                    // }
                    this.proxyWhitelistBase.updateElement(entry);
                    return this.api.modifyServerProxy({
                        host: entry.data.host,
                        enabled: entry.data.enabled,
                        inEnabled: entry.data.inEnabled,
                        outEnabled: entry.data.outEnabled,
                        acl: entry.data.acl
                    })
                    // .then(() => {
                    //     this.callViewMethod("refreshContent");
                    // })
                }
            });
        });
    }

    onViewChangeAcl(channelId: number, id: number): void {
        // DISABLED IN CURRENT VERSION
        // this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
        //     return Q().then(() => {
        //         let entry = this.proxyWhitelistBase.find(x => {
        //             return x.id == id;
        //         });
        //         if (entry) {
        //             return this.app.ioc.create(SelectContactsWindowController, [this.parent.parent, {
        //                 editable: true,
        //                 hashmails: this.getAclEntries(entry.data.acl),
        //                 fromServerUsers: true,
        //                 allowMyself: true,
        //                 allowGroups: true,
        //                 allowEmpty: true,
        //                 message: this.i18n("window.admin.proxywhitelist.table.acl.message"),
        //                 allowExternalUsers: false
        //             }])
        //             .then(win => {
        //                 this.app.openChildWindow(win).getPromise().then(hashmails => {
        //                     let availGroups = SectionUtils.getPredefinedGroups();
        //                     let groups = hashmails.filter(x => availGroups.indexOf(x) > -1);
        //                     let leftHashmails = hashmails.filter(x => groups.indexOf(x) == -1);
        //                     let users = leftHashmails.map(x => x.split("#")[0]);
                            
        //                     return this.api.modifyServerProxy({
        //                         host: entry.data.host,
        //                         enabled: entry.data.enabled,
        //                         inEnabled: entry.data.inEnabled,
        //                         outEnabled: entry.data.outEnabled,
        //                         acl: users.concat(groups).join("|")
        //                     })
        //                 });
        //             });
        //         }
        //     });
        // });
    }

    
    getAclEntries(acl: string): string[] {
        return Lang.unique(ProxyUtils.deserializeAcl(acl).map(x => {
            let groups = SectionUtils.getPredefinedGroups();
            if (groups.indexOf(x) > -1) {
                return x;
            }
            else {
                return x + "#" + this.identity.host;
            }
        }))
    }
    
    onViewDeleteDomain(channelId: number, id: number): void {
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            return Q().then(() => {
                let entry = this.proxyWhitelistBase.find(x => {
                    return x.id == id;
                });
                if (entry) {
                    return this.parent.confirm()
                    .then(data => {
                        if (data.result == "yes") {
                            return Q().then(() => {
                                return this.api.removeServerProxy({host: entry.data.host});
                            })
                            .then(() => {
                                this.proxyWhitelistBase.removeBy("id", entry.id);
                            });
                        }
                    });
                }
                else {
                    return;
                }

            })
        });
    }
    
    prepare(): Q.Promise<void> {
        return Q().then(() => {
            return this.api.getAllServerProxy();
        })
        .then(proxies => {
            let list: Entry[] = [];
            proxies.forEach((p, _i) => {
                list.push({id: _i, data: p});
            })
            this.proxyWhitelistBase.rebuild(list);
            this.callViewMethod("refreshContent", this.identity.host);
        });
    }
}
