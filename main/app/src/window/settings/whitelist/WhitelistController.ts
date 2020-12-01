import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {MailFilterEntry, MailFilter} from "../../../mail/MailFilter";
import {ExtListController} from "../../../component/extlist/ExtListController";
import {MutableCollection} from "../../../utils/collection/MutableCollection";
import {SortedCollection} from "../../../utils/collection/SortedCollection";
import {FilterMode} from "../../../mail/FilterMode";
import {SinkIndexEntry} from "../../../mail/SinkIndexEntry";
import {Lang} from "../../../utils/Lang";
import {SinkIndexManager} from "../../../mail/SinkIndexManager";
import {Inject, Dependencies} from "../../../utils/Decorators"
import {Person} from "../../../mail/person/Person";
import { PersonService } from "../../../mail/person/PersonService";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
}

export interface MessageInfo {
    title: string;
    special: boolean;
}

export interface LastMessagesModel {
    domain: string;
    messages: {
        info: MessageInfo;
        sinkType: string;
        sourceServerDate: number;
        sinkName: string;
        isAnon: boolean;
        nameWithHashmailA: string;
        senderAvatar: string;
        senderHasAvatar: boolean;
    }[];
}

export interface WhiteListEntry {
    domain: string;
    count: number;
    lastDate: number;
    data: MailFilterEntry;
    newOne?: boolean;
}

export type MessageInfoGetter = (sinkIndexEntry: SinkIndexEntry) => MessageInfo;

@Dependencies(["extlist"])
export class WhitelistController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "whitelist";
    
    @Inject mailFilter: MailFilter;
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject sinkIndexManager: SinkIndexManager;
    @Inject personService: PersonService;
    
    whitelistBase: MutableCollection<WhiteListEntry>;
    whitelistSorted: SortedCollection<WhiteListEntry>;
    whitelist: ExtListController<WhiteListEntry>;
    messageInfoGetters: MessageInfoGetter[];
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.mailFilter = this.parent.mailFilter;
        this.srpSecure = this.parent.srpSecure;
        this.sinkIndexManager = this.parent.sinkIndexManager;
        this.personService = this.parent.personService;
        this.messageInfoGetters = [];
        this.whitelistBase = this.addComponent("whitelistBase", new MutableCollection<WhiteListEntry>());
        this.whitelistSorted = this.addComponent("whitelistSorted", new SortedCollection(this.whitelistBase, (a, b) => {
            if (a.newOne != b.newOne) {
                if (a.newOne) {
                    return -1;
                }
                if (b.newOne) {
                    return 1;
                }
            }
            return a.domain.localeCompare(b.domain);
        }));
        this.whitelist = this.addComponent("whitelist", this.componentFactory.createComponent("extlist", [this, this.whitelistSorted]));
        this.whitelist.ipcMode = true;
    }
    
    addMessageInfoGetter(getter: MessageInfoGetter): void {
        this.messageInfoGetters.push(getter);
    }
    
    prepare(): void {
        let data: WhiteListEntry[] = [];
        let summary = this.sinkIndexManager.getMessagesSummaryByDomain();
        let unknownDomains = this.mailFilter.unknownDomains.domains;
        for (var domain in unknownDomains) {
            let entry = summary[domain];
            data.push({
                domain: domain,
                count: entry ? entry.count : 0,
                lastDate: entry ? entry.lastDate : null,
                data: {mode: FilterMode.DENY},
                newOne: true
            });
        }
        let domains = this.mailFilter.kvdb.getEntries();
        for (var domain in domains) {
            let entry = summary[domain];
            data.push({
                domain: domain,
                count: entry ? entry.count : 0,
                lastDate: entry ? entry.lastDate : null,
                data: domains[domain]
            });
        }
        this.whitelistBase.rebuild(data);
        this.mailFilter.denyUnknownDomains();
        let model: Model = {};
        this.callViewMethod("renderContent", model);
    }
    
    onViewWhitelistSetDomainMode(domain: string, mode: FilterMode): void {
        let oldMode = this.whitelistBase.getBy("domain", domain).data.mode;
        this.addTaskEx("", true, () => {
            return Q().then(() => {
                this.whitelistBase.updateBy("domain", domain, {data: {mode: mode}});
                return this.mailFilter.setDomain(domain, mode);
            })
            .fail(e => {
                this.whitelistBase.updateBy("domain", domain, {data: {mode: oldMode}});
                return Q.reject(e);
            });
        });
    }
    
    onViewWhitelistDeleteDomain(domain: string): void {
        this.addTaskEx("", true, () => {
            return Q().then(() => {
                return this.mailFilter.removeDomain(domain);
            })
            .then(() => {
                this.whitelistBase.updateBy("domain", domain, {data: {mode: FilterMode.DENY}});
            });
        });
    }
    
    onViewWhitelistSuggestBlacklist(domain: string): void {
        let msg = this.i18n("window.settings.section.whitelist.report.confirm.msg", "<b>" + domain + "</b>");
        this.parent.confirmEx({
            message: msg,
            yes: {
                label: this.i18n("window.settings.section.whitelist.report.confirm.yes")
            }
        })
        .then(result => {
            if (result.result != "yes") {
                return;
            }
            this.addTaskEx("", true, () => {
                return Q().then(() => {
                    return this.srpSecure.suggestBlacklistEntry(domain);
                })
                .then(() => {
                    this.parent.alert(this.i18n("window.settings.section.whitelist.report.success"));
                });
            });
        });
    }
    
    getMessageInfo(indexEntry: SinkIndexEntry): MessageInfo {
        let info: MessageInfo;
        let found = Lang.containsFunc(this.messageInfoGetters, getter => {
            info = getter(indexEntry);
            return info != null;
        });
        return found ? info : {
            special: true,
            title: this.i18n("window.settings.section.whitelist.table.lastMessage.systemMsg")
        };
    }
    
    onViewWhitelistShowLastMessages(domain: string, count: number): void {
        let lastMessages = this.sinkIndexManager.getLastUnfilteredMessagesFromDomain(domain, count);
        let model: LastMessagesModel = {
            domain: domain,
            messages: lastMessages.map(x => {
                let sink = x.getOriginalSink();
                let sender = this.personService.getPerson(x.getMessage().sender.hashmail);
                return {
                    info: this.getMessageInfo(x),
                    sinkType: x.getOriginalSinkType(),
                    sourceServerDate: x.source.serverDate,
                    sinkName: sink ? sink.name : x.getOriginalSinkId(),
                    isAnon: sender.isAnonymous(),
                    nameWithHashmailA: sender.getNameWithHashmailA(),
                    senderAvatar: sender.getAvatar(),
                    senderHasAvatar: sender.hasAvatar(),
                };
            }),
        };
        this.callViewMethod("whitelistShowLastMessages", model);
    }
}
