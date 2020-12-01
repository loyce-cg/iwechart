import {ComponentController} from "../base/ComponentController";
import {WithActiveCollection} from "../../utils/collection/WithActiveCollection";
import {SortedCollection} from "../../utils/collection/SortedCollection";
import {TransformCollection} from "../../utils/collection/TransformCollection";
import {ExtListController} from "../extlist/ExtListController";
import {ServerProxyService} from "../../mail/proxy";
import * as Types from "../../Types";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators";
import {ComponentFactory} from "../main";
import { UserPreferences } from "../../mail/UserPreferences";
import { FilteredCollection } from "../../utils/collection/FilteredCollection";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { RemoteSectionListController } from "../remotesectionlist/RemoteSectionListController";
import { HostBeforeActivateEvent, HostActivatedEvent } from "../sidebar/SidebarController";
import { SessionManager } from "../../mail/session/SessionManager";
import { ProxyCollection } from "../../utils/collection/ProxyCollection";
import { RemoteConv2ListController } from "../remoteconv2list/RemoteConv2ListController";

export enum ElementCountsAggregationStrategy {
    SECTIONS = 1,
    CONVERSATIONS = 2,
    ALL = ElementCountsAggregationStrategy.SECTIONS | ElementCountsAggregationStrategy.CONVERSATIONS,
}

export interface RemoteHostListControllerOptions {
    elementCountsAggregationStrategy: ElementCountsAggregationStrategy;
}

export interface HostEntry {
    host: string;
    sectionList: RemoteSectionListController;
    conv2List: RemoteConv2ListController;
}

@Dependencies(["extlist", "remotesectionlist"])
export class RemoteHostListController extends ComponentController {
    
    static textsPrefix: string = "component.remoteHostList.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    @Inject componentFactory: ComponentFactory;
    @Inject userPreferences: UserPreferences;
    @Inject sessionManager: SessionManager;
    
    hostsBaseCollection: ProxyCollection<string>;
    hostsBaseTransformCollection: TransformCollection<HostEntry, string>;
    hostsSortedCollection: SortedCollection<HostEntry>;
    hostsFilteredCollection: FilteredCollection<HostEntry>;
    hostsCollection: WithActiveCollection<HostEntry>;
    transformCollection: TransformCollection<Types.webUtils.HostListElementModel, HostEntry>;
    hosts: ExtListController<Types.webUtils.HostListElementModel>;
    showAllHosts: boolean;
    hostIsExpanded: { [hostId: string]: boolean } = {};
    options: RemoteHostListControllerOptions;
    
    constructor(
        parent: Types.app.IpcContainer,
        options: RemoteHostListControllerOptions
    ) {
        super(parent);
        this.options = options;
        this.hostsBaseCollection = new ProxyCollection<string>(this.sessionManager.serverProxyService.getCollection());
        this.hostsBaseTransformCollection = new TransformCollection<HostEntry, string>(this.hostsBaseCollection, this.onConvertProxyToHostEntry.bind(this));
        this.hostsSortedCollection = this.addComponent("sortedCollection", new SortedCollection(this.hostsBaseTransformCollection, RemoteHostListController.nameHostSorter));
        this.hostsFilteredCollection = this.addComponent("filteredCollection", new FilteredCollection(this.hostsSortedCollection, (x: HostEntry) => {
            return true;
        }))
        this.hostsCollection = this.addComponent("hostsCollection", new WithActiveCollection(this.hostsFilteredCollection));
        this.registerChangeEvent(this.hostsCollection.changeEvent, this.onHostsCollectionChange.bind(this));
        this.transformCollection = this.addComponent("transformCollection", new TransformCollection<Types.webUtils.HostListElementModel, HostEntry>(this.hostsCollection, this.convertHost.bind(this)))
        this.hosts = this.addComponent("hosts", this.componentFactory.createComponent("extlist", [this, this.transformCollection]));
        this.hosts.ipcMode = true;
        this.ipcMode = true;
        this.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            this.onUserPreferencesChange(event);
        });
    }
    
    getUnread(host: HostEntry): number {
        return this.aggregateChildren(host, 0, null, x => x.unread, (a, b) => (a + b));
    }
    
    getElementsCount(host: HostEntry): number {
        return this.aggregateChildren(host, 0, null, x => x.elementsCount, (a, b) => (a + b));
    }
    
    getSearchCount(host: HostEntry): number {
        return this.aggregateChildren(host, 0, null, x => x.searchCount, (a, b) => (a + b));
    }
    
    getAllSearched(host: HostEntry): boolean {
        return this.aggregateChildren(host, true, true, x => x.allSearched, (a, b) => (a && b));
    }
    
    getWithSpinner(host: HostEntry): boolean {
        return this.aggregateChildren(host, true, true, x => x.withSpinner, (a, b) => (a || b));
    }
    
    aggregateChildren<T>(
        host: HostEntry,
        initialValue: T,
        valueWhenMissing: T,
        mapper: (x: Types.webUtils.SectionListElementModel | Types.webUtils.ConversationModel) => T,
        reducer: (a: T, b: T) => T
    ): T {
        let sectionElementsResult: T = initialValue;
        let conv2ElementsResult: T = initialValue;
        if (host && host.sectionList && host.sectionList.transformCollection && host.conv2List && host.conv2List.convTransform) {
            if (this.includeSectionCounts()) {
                sectionElementsResult = host.sectionList.transformCollection.list
                    .map(x => mapper(x))
                    .reduce((prev, curr) => reducer(prev, curr), sectionElementsResult);
            }
            if (this.includeConversationCounts()) {
                conv2ElementsResult = host.conv2List.convTransform.list
                    .map(x => mapper(x))
                    .reduce((prev, curr) => reducer(prev, curr), conv2ElementsResult);
            }
        }
        else {
            return valueWhenMissing;
        }
        let result = reducer(sectionElementsResult, conv2ElementsResult);
        return result;
    }
    
    convertHost(model: HostEntry): Types.webUtils.HostListElementModel {
        return {
            id: this.getHostId(model.host),
            name: model.host,
            unread: this.getUnread(model),
            elementsCount: this.getElementsCount(model),
            searchCount: this.getSearchCount(model),
            allSearched: this.getAllSearched(model),
            scope: "",
            muted: this.userPreferences.isGloballyMuted(),
            disabled: false,
            isExpanded: this.hostIsExpanded[this.getHostId(model.host)],
        };
    }
    
    static nameHostSorter(a: HostEntry, b: HostEntry): number {
        return a.host.localeCompare(b.host);
    }
    
    hasSearchResultsSectionSorter(a: HostEntry, b: HostEntry): number {
        let ax = (this.getSearchCount(a) > 0 ? 2 : !this.getAllSearched(a)) ? 1 : 0;
        let bx = (this.getSearchCount(b) > 0 ? 2 : !this.getAllSearched(b)) ? 1 : 0;
        return bx - ax;
    }
    
    getHostId(host: string) {
        return ServerProxyService.getStorageKeyFromHost(host);
    }
    
    onViewActivateHost(hostId: string): void {
        let host = this.hostsCollection.find(x => this.getHostId(x.host) == hostId);
        // console.log("found host", hostId);
        if (host == null) {
            return;
        }
        // console.log("set host active..");
        this.setActive(host, true);
    }
    
    getActive(): HostEntry {
        return this.hostsCollection.getActive();
    }
    
    setActive(host: HostEntry, dispatchBeforeEvent: boolean) {
        let result = true;
        if (dispatchBeforeEvent) {
            result = this.dispatchEventResult(<HostBeforeActivateEvent>{
                type: "hostbeforeactivate",
                host: host
            });
        }
        if (result !== false) {
            this.hostsCollection.setActive(host);
        }
    }
    
    onHostsCollectionChange(event: Types.utils.collection.CollectionEvent<HostEntry>): void {
        if (event.type == "active" && event.newActive) {
            this.dispatchEvent<HostActivatedEvent>({
                type: "hostactivated",
                host: event.newActive.obj
            });
        }
    }
    
    refresh() {
        this.transformCollection.rebuild();
    }
    
    onUserPreferencesChange(event: Types.event.UserPreferencesChangeEvent) {
        // if (this.options.checkShowAllAvailHosts) {
        //     let showAll = event.userPreferences.data.ui.showAllHosts;
        //     if (showAll != this.showAllSections) {
        //         this.showAllSections = showAll;
        //         this.sortedCollection.rebuild();
        //     }
        // }
        // this.refresh();
    }
    
    init(): Q.Promise<void> {
        // console.log("init remoteHostList");
        // this.baseCollection.setCollection(this.options.sessionManager.serverProxyService.getCollection());
        //
        // // this.baseCollection.list.forEach(x => console.log(x.host));
        // // this.sortedCollection.rebuild();
        return;
    }
    
    onConvertProxyToHostEntry(proxyEntry: string): HostEntry {
        return {
            sectionList: null,
            conv2List: null,
            host: proxyEntry
        }
    }
    
    onViewToggleHostElementIsExpanded(hostId: string, isExpanded: boolean): void {
        this.hostIsExpanded[hostId] = isExpanded;
    }
    
    updateSidebarSpinners(host: string): void {
        let states: { [id: string]: boolean } = {};
        this.hostsCollection.forEach(x => {
            if (!host || x.host == host) {
                states[this.getHostId(x.host)] = this.getWithSpinner(x);
            }
        });
        this.callViewMethod("updateSidebarSpinners", JSON.stringify(states));
    }
    
    getElementCountsAggregationStategy(): ElementCountsAggregationStrategy {
        if (!this.options || typeof(this.options.elementCountsAggregationStrategy) != "number") {
            return ElementCountsAggregationStrategy.SECTIONS | ElementCountsAggregationStrategy.CONVERSATIONS;
        }
        return this.options.elementCountsAggregationStrategy;
    }
    
    protected includeSectionCounts(): boolean {
        return (this.getElementCountsAggregationStategy() & ElementCountsAggregationStrategy.SECTIONS) == ElementCountsAggregationStrategy.SECTIONS;
    }
    
    protected includeConversationCounts(): boolean {
        return (this.getElementCountsAggregationStategy() & ElementCountsAggregationStrategy.CONVERSATIONS) == ElementCountsAggregationStrategy.CONVERSATIONS;
    }
    
}