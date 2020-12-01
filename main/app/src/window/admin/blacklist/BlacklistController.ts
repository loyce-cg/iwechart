import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import {ExtListController} from "../../../component/extlist/ExtListController";
import {MutableCollection} from "../../../utils/collection/MutableCollection";
import {SortedCollection} from "../../../utils/collection/SortedCollection";
import {Lang} from "../../../utils/Lang";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../../utils/Decorators";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";

export interface Entry {
    domain: string;
    data: {
        mode: string;
        history: privfs.types.core.BlacklistSingleEntry[];
        count: number;
        last: privfs.types.core.BlacklistSingleEntry;
    };
}

export interface Model {
    todo: boolean;
}

@Dependencies(["extlist"])
export class BlacklistController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.blacklist.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "blacklist";
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    
    blacklistBase: MutableCollection<Entry>;
    sorted: SortedCollection<Entry>;
    blacklist: ExtListController<Entry>;
    todo: boolean;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.srpSecure = this.parent.srpSecure;
        this.identity = this.parent.identity;
        this.blacklistBase = this.addComponent("blacklistBase", new MutableCollection<Entry>());
        this.sorted = this.addComponent("sorted", new SortedCollection(this.blacklistBase, (a, b) => {
            if (a.data.mode != b.data.mode) {
                if (a.data.mode == "SUGGEST") {
                    return -1;
                }
                if (b.data.mode == "SUGGEST") {
                    return 1;
                }
            }
            return a.domain.localeCompare(b.domain);
        }));
        this.blacklist = this.addComponent("blacklist", this.componentFactory.createComponent("extlist", [this, this.sorted]));
        this.blacklist.ipcMode = true;
        this.registerChangeEvent(this.blacklistBase.changeEvent, this.onCollectionChange, "multi");
        this.checkBlacklist();
    }
    
    getModel(): Model {
        return {
            todo: this.todo
        };
    }
    
    onViewAddDomain(): void {
        let windowController = this.parent;
        this.addTaskEx("", true, () => {
            let options = {
                message: this.i18n("window.admin.blacklist.addRule.header"),
                input: {placeholder: this.i18n("window.admin.blacklist.addRule.domain.placeholder")},
                bodyClass: "admin-alert",
                width: 500,
                ok: {
                    label: this.i18n("window.admin.blacklist.addRule.confirm")
                }
            };
            return windowController.promptEx(options)
            .then(result => {
                if (result.result != "ok" || !result.value) {
                    return;
                }
                return Q().then(() => {
                    let domain = result.value;
                    let mode = "DENY";
                    return this.srpSecure.setBlacklistEntry(domain, mode)
                    .then(() => {
                        let entry = this.blacklistBase.find(x => {
                            return x.domain == domain;
                        });
                        let blEntry = {
                            mode: mode,
                            username: this.identity.user,
                            time: Math.floor(new Date().getTime() / 1000)
                        };
                        if (entry == null) {
                            this.blacklistBase.add({
                                domain: domain,
                                data: {
                                    mode: mode,
                                    history: [blEntry],
                                    count: 1,
                                    last: blEntry
                                }
                            });
                        }
                        else {
                            entry.data.mode = mode;
                            entry.data.history.push(blEntry);
                            if (entry.data.last == null) {
                                entry.data.count = 1;
                                entry.data.last = blEntry;
                            }
                            this.blacklistBase.updateElement(entry);
                        }
                    })
                    .fail(e => {
                        windowController.onErrorCustom(this.i18n("window.admin.blacklist.addRule.error.invalid"), e);
                    });
                });
            });
        });
    }
    
    onViewSetDomain(channelId: number, domain: string, mode: string): void {
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            return this.srpSecure.setBlacklistEntry(domain, mode)
            .then(() => {
                let entry = this.blacklistBase.find(x => {
                    return x.domain == domain;
                });
                if (entry == null) {
                    let blEntry = {
                        mode: mode,
                        username: this.identity.user,
                        time: Math.floor(new Date().getTime() / 1000)
                    };
                    this.blacklistBase.add({
                        domain: domain,
                        data: {
                            mode: mode,
                            history: [blEntry],
                            count: 1,
                            last: blEntry
                        }
                    });
                }
                else {
                    entry.data.mode = mode;
                    this.blacklistBase.updateElement(entry);
                }
            });
        });
    }
    
    onViewDeleteDomain(channelId: number, domain: string): void {
        this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
            return this.parent.confirm()
            .then(data => {
                if (data.result == "yes") {
                    return Q().then(() => {
                        return this.srpSecure.deleteBlacklistEntry(domain);
                    })
                    .then(() => {
                        this.blacklistBase.removeBy("domain", domain);
                    });
                }
            });
        });
    }
    
    prepare(): Q.Promise<void> {
        return Q().then(() => {
            return this.srpSecure.getBlacklist();
        })
        .then(domains => {
            let list: Entry[] = [];
            for (var domain in domains) {
                let data = domains[domain];
                let entry: Entry = {
                    domain: domain,
                    data: {
                        mode: data.mode,
                        history: data.history,
                        count: 0,
                        last: null
                    }
                };
                if (data.mode != "DELETED") {
                    data.history.sort((a, b) => {
                        return a.time - b.time;
                    });
                    data.history.forEach(x => {
                        if (x.mode == "DELETED") {
                            entry.data.last = null;
                            entry.data.count = 0;
                        }
                        else if (entry.data.last == null || x.mode == "SUGGEST") {
                            entry.data.last = x;
                            entry.data.count++;
                        }
                    });
                    list.push(entry);
                }
            }
            this.blacklistBase.rebuild(list);
            this.callViewMethod("refreshContent");
        });
    }
    
    checkBlacklist() {
        this.srpSecure.getBlacklist().then(domains => {
            this.todo = Lang.containsFunc(Lang.getValues(domains), x => x.mode == "SUGGEST");
            this.callViewMethod("refreshToDo", this.todo);
        });
    }
    
    onCollectionChange() {
        this.todo = this.blacklistBase.find(x => x.data.mode == "SUGGEST") != null;
        this.callViewMethod("refreshToDo", this.todo);
    }
}
