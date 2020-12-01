import {ComponentController} from "../base/ComponentController";
import * as Types from "../../Types";
import * as Q from "q";
import {Inject, Dependencies} from "../../utils/Decorators";
import {Conv2ListController, Conv2ListOptions, Conv2BeforeActivateEvent, Conv2ActivatedEvent} from "../conv2list/Conv2ListController";
import {SectionListController, SectionListOptions, SectionBeforeActivateEvent, SectionActivatedEvent} from "../sectionlist/SectionListController";
import {ComponentFactory} from "../main";
import {SectionService} from "../../mail/section/SectionService";
import {Conv2Section, Conv2Service} from "../../mail/section/Conv2Service";
import {Settings} from "../../utils/Settings";
import {CustomElementListController, CustomElement, CustomElementListOptions, CustomElementBeforeActivateEvent, CustomElementActivatedEvent} from "../customelementlist/CustomElementListController";
import {SplitterController} from "../splitter/SplitterController";
import { Lang } from "../../utils/Lang";
import { LocaleService, MailConst } from "../../mail";
import { i18n } from "./i18n";
import { HostEntry, RemoteHostListController, RemoteHostListControllerOptions } from "../remotehostlist/RemoteHostListController";
import { RemoteSectionListController, RemoteSectionActivatedEvent, RemoteSectionBeforeActivateEvent } from "../remotesectionlist/main";
import { UserPreferences } from "../../mail/UserPreferences";
import { TooltipController } from "../tooltip/main";
import { RemoteConv2ListController, RemoteConv2BeforeActivateEvent, RemoteConv2ActivatedEvent } from "../remoteconv2list/RemoteConv2ListController";
import { CommonApplication } from "../../app/common";
import { UsersListTooltipController } from "../userslisttooltip/main";
import { Session } from "../../mail/session/SessionManager";
import { SectionSummaryWindowController } from "../../window/sectionsummary/SectionSummaryWindowController";
import { SectionUtils } from "../../mail/section/SectionUtils";

export interface SidebarButton {
    id: string;
    label: string;
    title: string;
    icon: string;
    onSectionList?: boolean;
    windowOpener: boolean;
}

export interface SidebarOptions {
    customElementList: CustomElementListOptions;
    customSectionList: SectionListOptions;
    conv2List: Conv2ListOptions;
    sectionList: SectionListOptions;
    conv2ListEnabled: boolean;
    conv2Splitter: Settings;
    sidebarButtons: SidebarButton[];
    sectionsLimitReached: boolean;
    remoteHostList: RemoteHostListControllerOptions;
}

export enum SidebarElementType {
    CUSTOM_ELEMENT,
    SECTION,
    CUSTOM_SECTION,
    CONVERSATION,
    HOST,
    REMOTE_SECTION,
    REMOTE_CONVERSATION
}

export interface SidebarElement {
    type: SidebarElementType;
    customElement?: CustomElement;
    section?: SectionService;
    conv2?: Conv2Section;
    host?: HostEntry;
    hostHash?: string;
}

export interface HostBeforeActivateEvent extends Types.event.Event<boolean> {
    type: "hostbeforeactivate";
    host: HostEntry;
}

export interface HostActivatedEvent extends Types.event.Event {
    type: "hostactivated";
    host: HostEntry;
}

export interface ElementBeforeActivateEvent extends Types.event.Event<boolean> {
    type: "elementbeforeactivate";
    element: SidebarElement;
}

export interface ElementActivatedEvent extends Types.event.Event {
    type: "elementactivated";
    element: SidebarElement;
}

export interface SidebarButtonActionEvent extends Types.event.Event {
    type: "sidebarbuttonaction"
    sidebarButton: SidebarButton;
}

export interface Model {
    conv2ListEnabled: boolean;
    conv2ListWithAssignedToPrefixes: boolean;
    sidebarButtons: SidebarButton[];
    onlineFirst: boolean;
    sectionsLimitReached: boolean;
}

@Dependencies(["conv2list", "sectionlist", "remotehostlist", "customelementlist", "splitter"])
export class SidebarController extends ComponentController {
    
    static textsPrefix: string = "component.sidebar.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject componentFactory: ComponentFactory;
    @Inject userPreferences: UserPreferences;
    
    conv2List: Conv2ListController;
    sectionList: SectionListController;
    hostList: RemoteHostListController;
    customSectionList: SectionListController;
    customElementList: CustomElementListController;
    conv2Splitter: SplitterController;
    remoteSectionsLists: {[hostHash: string]: RemoteSectionListController} = {};
    remoteConv2Lists: {[hostHash: string]: RemoteConv2ListController} = {};

    basicTooltip: TooltipController;
    usersListTooltip: UsersListTooltipController;
    app: CommonApplication;

    constructor(
        parent: Types.app.IpcContainer,
        public options: SidebarOptions
    ) {
        super(parent);
        this.options.sectionList.checkShowAllAvailSections = true;
        this.sectionList = this.addComponent("sectionList", this.componentFactory.createComponent("sectionlist", [this, this.options.sectionList]));
        this.sectionList.addEventListener("sectionbeforeactivate", this.onSectionListBeforeActivate.bind(this));
        this.sectionList.addEventListener("sectionactivated", this.onSectionListActivated.bind(this));
        this.sectionList.ipcMode = true;

        this.hostList = this.addComponent("hostList", this.componentFactory.createComponent("remotehostlist", [this, this.options.remoteHostList]));
        this.hostList.addEventListener("hostbeforeactivate", this.onHostListBeforeActivate.bind(this));
        this.hostList.addEventListener("hostactivated", this.onHostListActivated.bind(this));
        this.hostList.ipcMode = true;

        this.customSectionList = this.addComponent("customSectionList", this.componentFactory.createComponent("sectionlist", [this, this.options.customSectionList]));
        this.customSectionList.addEventListener("sectionbeforeactivate", this.onCustomSectionListBeforeActivate.bind(this));
        this.customSectionList.addEventListener("sectionactivated", this.onCustomSectionListActivated.bind(this));
        this.customSectionList.ipcMode = true;

        this.customElementList = this.addComponent("customElementList", this.componentFactory.createComponent("customelementlist", [this, this.options.customElementList]));
        this.customElementList.addEventListener("customelementbeforeactivate", this.onCustomElementListBeforeActivate.bind(this));
        this.customElementList.addEventListener("customelementactivated", this.onCustomElementListActivated.bind(this));
        this.customElementList.ipcMode = true;
        if (this.options.conv2ListEnabled) {
            this.options.conv2List.onlineFirst = this.getOnlineFirst();
            this.conv2List = this.addComponent("conv2List", this.componentFactory.createComponent("conv2list", [this, this.options.conv2List]));
            this.conv2List.addEventListener("conv2beforeactivate", this.onConv2ListBeforeActivate.bind(this));
            this.conv2List.addEventListener("conv2activated", this.onConv2ListActivated.bind(this));
            this.conv2List.ipcMode = true;
            this.conv2Splitter = this.addComponent("conv2Splitter", this.componentFactory.createComponent("splitter", [this, this.options.conv2Splitter]));
        }
        this.basicTooltip = this.addComponent("basicTooltip", this.componentFactory.createComponent("tooltip", [this]));
        this.basicTooltip.getContent = (id: string) => {
            if (id == "scroll-to-bubbles-up" || id == "scroll-to-bubbles-down") {
                return `component.sidebar.scrollToBubbles.tooltip`;
            }
            let dblClick: boolean = this.userPreferences.getUnreadBadgeUseDoubleClick();
            return `markAllAsRead.tooltip.${dblClick?'double':'single'}Click`;
        };

        this.usersListTooltip = this.addComponent("userslisttooltip", this.componentFactory.createComponent("userslisttooltip", [this]));
        
        this.ipcMode = true;
        
        this.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this));
        // this.app.addEventListener("sectionsLimitExceeded", this.onSectionsLimitExceeded.bind(this));
        let app: CommonApplication = null;
        let parentObj: any = this.parent;
        while (app == null && parentObj) {
            app = parentObj.app;
            parentObj = parentObj.parent;
        }
        if (app) {
            this.app = app;
            app.addEventListener<Types.event.ToggleSidebarBellStateEvent>("toggleSidebarBellState", event => {
                this.toggleBellState(event.sectionId, event.conversationId, event.isRinging);
            });
            app.addEventListener<Types.event.ToggleSidebarVoiceChatActiveEvent>("toggleSidebarVoiceChatActive", event => {
                this.toggleVoiceChatActive(event.sectionId, event.conversationSectionId, event.active, event.users);
            });

        }
    }
    
    init(): Q.Promise<void> {
        return this.hostList.init();
    }
    
    getModel(): Model {
        return {
            conv2ListEnabled: this.options.conv2ListEnabled,
            conv2ListWithAssignedToPrefixes: this.options.conv2List && !!this.options.conv2List.assignedTo,
            sidebarButtons: this.options.sidebarButtons,
            onlineFirst: this.getOnlineFirst(),
            sectionsLimitReached: this.options.sectionsLimitReached
        };
    }
    
    onConv2ListBeforeActivate(event: Conv2BeforeActivateEvent) {
        let result = this.setActive({
            type: SidebarElementType.CONVERSATION,
            conv2: event.conv2
        }, true);
        if (result === false) {
            event.result = false;
        }
    }
    
    onSectionListBeforeActivate(event: SectionBeforeActivateEvent) {
        let result = this.setActive({
            type: SidebarElementType.SECTION,
            section: event.section
        }, true);
        if (result === false) {
            event.result = false;
        }
    }

    onRemoteSectionListBeforeActivate(event: RemoteSectionBeforeActivateEvent) {
        // console.log("sidebarController - onRemoteSectionListBeforeActivate");
        let result = this.setActive({
            type: SidebarElementType.REMOTE_SECTION,
            section: event.section,
            hostHash: event.hostHash
        }, true);
        // console.log("sidebarController - onRemoteSectionListBeforeActivate result: ", result);
        if (result === false) {
            event.result = false;
        }

    }

    onRemoteConv2ListBeforeActivate(event: RemoteConv2BeforeActivateEvent) {
        let result = this.setActive({
            type: SidebarElementType.REMOTE_CONVERSATION,
            conv2: event.conv2,
            hostHash: event.hostHash
        }, true);
        if (result === false) {
            event.result = false;
        }

    }


    onHostListBeforeActivate(event: HostBeforeActivateEvent) {
        let result = this.setActive({
            type: SidebarElementType.HOST,
            host: event.host
        }, true);
        if (result === false) {
            event.result = false;
        }
    }


    onCustomSectionListBeforeActivate(event: SectionBeforeActivateEvent) {
        let result = this.setActive({
            type: SidebarElementType.CUSTOM_SECTION,
            section: event.section
        }, true);
        if (result === false) {
            event.result = false;
        }
    }

    
    onCustomElementListBeforeActivate(event: CustomElementBeforeActivateEvent) {
        let result = this.setActive({
            type: SidebarElementType.CUSTOM_ELEMENT,
            customElement: event.customElement
        }, true);
        if (result === false) {
            event.result = false;
        }
    }

    
    getActive(): SidebarElement {
        // console.log("sidebarController - getActive");
        let section = this.sectionList.getActive();
        if (section) {

            // console.log("sidebarController - getActive: section");
            return {
                type: SidebarElementType.SECTION,
                section: section
            };
        }
        else {
            section = this.customSectionList.getActive();
            if (section) {
                // console.log("sidebarController - getActive: customSection");
                return {
                    type: SidebarElementType.CUSTOM_SECTION,
                    section: section
                };
            }
        }
        let conv2 = this.conv2List ? this.conv2List.getActive() : null;
        if (conv2) {
            // console.log("sidebarController - getActive: conversation");
            return {
                type: SidebarElementType.CONVERSATION,
                conv2: conv2
            };
        }
        let customElement = this.customElementList.getActive();
        if (customElement) {
            // console.log("sidebarController - getActive: customElement");
            return {
                type: SidebarElementType.CUSTOM_ELEMENT,
                customElement: customElement
            };
        }
        let host = this.hostList.getActive();
        if (host) {
            // console.log("sidebarController - getActive: host");
            return {
                type: SidebarElementType.HOST,
                host: host
            }
        }

        // remote section

        if (this.remoteSectionsLists) {
            // console.log("sidebarController - getActive - clearing hash and section");
            let foundHash: string = null;
            let foundSection: SectionService = null;
    
            for (let hostHash in this.remoteSectionsLists) {
                let active = this.remoteSectionsLists[hostHash].getActive();
                
                if (active) {
                    // console.log("found active remote section", hostHash, active);
                    foundHash = hostHash;
                    foundSection = active;
                    break;
                }
            }
            if (foundHash && foundSection) {
                // console.log("sidebarController - getActive: remoteSection");
                return {
                    type: SidebarElementType.REMOTE_SECTION,
                    section: foundSection,
                    hostHash: foundHash
                }
            }
            else {
                // console.log("sidebarController - getActive: did not find active remoteSectoin");
            }
        }
        // remote conv2list

        if (this.remoteConv2Lists) {

            let foundHash: string = null;
            let foundSection: Conv2Section = null;
    
            for (let hostHash in this.remoteConv2Lists) {
                let active = this.remoteConv2Lists[hostHash].getActive();
                
                if (active) {
                    foundHash = hostHash;
                    foundSection = active;
                    break;
                }
            }
            if (foundHash && foundSection) {
                return {
                    type: SidebarElementType.REMOTE_CONVERSATION,
                    conv2: foundSection,
                    hostHash: foundHash
                }
            }
        }

    }
    

    deactivateRemoteSections(): void {
        for (let hostHash in this.remoteSectionsLists) {
            this.remoteSectionsLists[hostHash].setActive(null, false);
        }
    }

    deactivateRemoteConversations(): void {
        for (let hostHash in this.remoteConv2Lists) {
            this.remoteConv2Lists[hostHash].setActive(null, false);
        }
    }


    setActive(element: SidebarElement, dispatchBeforeEvent: boolean): boolean {
        // console.log("sidebarController - setActive", element);
        let result = true;
        if (dispatchBeforeEvent) {
            let id: string;
            if (element.conv2) {
                id = element.conv2.id;
            }
            else
            if (element.section) {
                id = element.section.getId();
            }

            if (id) {
                this.callViewMethod("preActivate", element.type, id);
            }

            result = this.dispatchEventResult(<ElementBeforeActivateEvent>{
                type: "elementbeforeactivate",
                element: element
            });
        }
        if (result === false) {
            return false;
        }
        if (element.type == SidebarElementType.CONVERSATION) {
            // console.log("sidebarController - setActive: conversation");
            this.sectionList.setActive(null, false);
            this.customSectionList.setActive(null, false);
            this.customElementList.setActive(null, false);
            this.hostList.setActive(null, false);
            this.deactivateRemoteSections();
            this.deactivateRemoteConversations();
            if (this.conv2List) {
                this.conv2List.setActive(element.conv2, false);
            }

        }
        else if (element.type == SidebarElementType.SECTION) {
            // console.log("sidebarController - setActive: section");

            if (this.conv2List) {
                this.conv2List.setActive(null, false);
            }
            this.customElementList.setActive(null, false);
            this.customSectionList.setActive(null, false);
            this.hostList.setActive(null, false);
            this.deactivateRemoteSections();
            this.deactivateRemoteConversations();
            this.sectionList.setActive(element.section, false);
        }
        else if (element.type == SidebarElementType.CUSTOM_SECTION) {
            // console.log("sidebarController - setActive: customSection");

            if (this.conv2List) {
                this.conv2List.setActive(null, false);
            }
            this.customElementList.setActive(null, false);
            this.sectionList.setActive(null, false);
            this.hostList.setActive(null, false);
            this.deactivateRemoteSections();
            this.deactivateRemoteConversations();
            this.customSectionList.setActive(element.section, false);
        }

        else if (element.type == SidebarElementType.CUSTOM_ELEMENT) {
            // console.log("sidebarController - setActive: customElement");

            if (this.conv2List) {
                this.conv2List.setActive(null, false);
            }
            this.sectionList.setActive(null, false);
            this.customSectionList.setActive(null, false);
            this.hostList.setActive(null, false);
            this.deactivateRemoteSections();
            this.deactivateRemoteConversations();
            this.customElementList.setActive(element.customElement, false);
        }
        else if (element.type == SidebarElementType.HOST) {
            // console.log("sidebarController - setActive: host");

            if (this.conv2List) {
                this.conv2List.setActive(null, false);
            }
            this.sectionList.setActive(null, false);
            this.customSectionList.setActive(null, false);
            this.customElementList.setActive(null, false);
            this.deactivateRemoteSections();
            this.deactivateRemoteConversations();
            this.hostList.setActive(element.host, false);
        }
        else if (element.type == SidebarElementType.REMOTE_SECTION) {
            // console.log("sidebarController - setActive: remoeSection");
            // console.log('remote_section: ', element.hostHash, element.section);
            if (this.conv2List) {
                this.conv2List.setActive(null, false);
            }
            this.sectionList.setActive(null, false);
            this.customSectionList.setActive(null, false);
            this.customElementList.setActive(null, false);
            this.hostList.setActive(null, false);
            this.deactivateRemoteConversations();
            this.remoteSectionsLists[element.hostHash].setActive(element.section, false);
        }
        else if (element.type == SidebarElementType.REMOTE_CONVERSATION) {
            if (! element.hostHash) {
                try {
                    throw Error("hostHash missing in element: ");
                }
                catch (e) {
                    console.log(e, element);
                }
            }

            if (this.conv2List) {
                this.conv2List.setActive(null, false);
            }
            this.sectionList.setActive(null, false);
            this.customSectionList.setActive(null, false);
            this.customElementList.setActive(null, false);
            this.hostList.setActive(null, false);
            this.deactivateRemoteSections();

            this.remoteConv2Lists[element.hostHash].setActive(element.conv2, false);
        }


        return true;
    }
    
    onConv2ListActivated(event: Conv2ActivatedEvent) {
        this.dispatchEvent<ElementActivatedEvent>({
            type: "elementactivated",
            element: {
                type: SidebarElementType.CONVERSATION,
                conv2: event.conv2
            }
        });
        this.callViewMethod("moveSelectionToActive");
    }
    
    onSectionListActivated(event: SectionActivatedEvent) {
        this.dispatchEvent<ElementActivatedEvent>({
            type: "elementactivated",
            element: {
                type: SidebarElementType.SECTION,
                section: event.section
            }
        });
        this.callViewMethod("moveSelectionToActive");
    }


    onRemoteSectionListActivated(event: RemoteSectionActivatedEvent) {
        this.dispatchEvent<ElementActivatedEvent>({
            type: "elementactivated",
            element: {
                type: SidebarElementType.REMOTE_SECTION,
                section: event.section,
                hostHash: event.hostHash
            }
        });
        this.callViewMethod("moveSelectionToActive");
    }

    onRemoteConv2ListActivated(event: RemoteConv2ActivatedEvent) {
        this.dispatchEvent<ElementActivatedEvent>({
            type: "elementactivated",
            element: {
                type: SidebarElementType.REMOTE_CONVERSATION,
                conv2: event.conv2,
                hostHash: event.hostHash
            }
        });
        this.callViewMethod("moveSelectionToActive");
    }


    onHostListActivated(event: HostActivatedEvent) {
        this.dispatchEvent<ElementActivatedEvent>({
            type: "elementactivated",
            element: {
                type: SidebarElementType.HOST,
                host: event.host
            }
        });
        this.callViewMethod("moveSelectionToActive");
    }


    onCustomSectionListActivated(event: SectionActivatedEvent) {
        this.dispatchEvent<ElementActivatedEvent>({
            type: "elementactivated",
            element: {
                type: SidebarElementType.CUSTOM_SECTION,
                section: event.section
            }
        });
        this.callViewMethod("moveSelectionToActive");
    }

    
    onCustomElementListActivated(event: CustomElementActivatedEvent) {
        this.dispatchEvent<ElementActivatedEvent>({
            type: "elementactivated",
            element: {
                type: SidebarElementType.CUSTOM_ELEMENT,
                customElement: event.customElement
            }
        });
        this.callViewMethod("moveSelectionToActive");
    }
    
    onViewSidebarButtonAction(sidebarButtonId: string) {
        let sidebarButton = Lang.find(this.options.sidebarButtons || [], x => x.id == sidebarButtonId);
        if (sidebarButton == null) {
            return;
        }
        this.dispatchEvent<SidebarButtonActionEvent>({
            type: "sidebarbuttonaction",
            sidebarButton: sidebarButton
        });
    }
    
    refresh() {
        if (this.conv2List) {
            this.conv2List.refresh();
        }
        this.sectionList.refresh();
        this.customElementList.refresh();
        if (this.customSectionList) {
            this.customSectionList.refresh();
        }
    }
    
    toggleCustomElements(toggle: boolean): void {
        this.callViewMethod("toggleCustomElements", toggle);
    }
    
    onViewBadgeClick(type: "section"|"conversation"|"customElement"|"host", id: string, hostId: string): void {
        let localSession = this.hostList.sessionManager.getLocalSession();
        this.dispatchEvent<Types.event.TryMarkAsReadEvent>({
            type: "try-mark-as-read",
            sectionId: type == "section" ? id : null,
            conversationId: type == "conversation" ? id : null,
            customElementId: type == "customElement" ? id : null,
            moduleName: <"chat"|"notes2"|"tasks">this.options.customSectionList.moduleName,
            hostHash: type == "host" ? id : (type == "customElement" ? localSession.hostHash : (hostId || localSession.hostHash)), 
        });
    }
    
    registerRemoteSectionsList(hostHash: string, list: RemoteSectionListController): void {
        if (hostHash in this.remoteSectionsLists) {
            return;
        }
        this.remoteSectionsLists[hostHash] = list;
        list.addEventListener("remotesectionbeforeactivate", this.onRemoteSectionListBeforeActivate.bind(this));
        list.addEventListener("remotesectionactivated", this.onRemoteSectionListActivated.bind(this));
    }

    registerRemoteConv2List(hostHash: string, list: RemoteConv2ListController): void {
        if (hostHash in this.remoteConv2Lists) {
            return;
        }
        this.remoteConv2Lists[hostHash] = list;
        list.addEventListener("remoteconv2beforeactivate", this.onRemoteConv2ListBeforeActivate.bind(this));
        list.addEventListener("remoteconv2activated", this.onRemoteConv2ListActivated.bind(this));
    }
    

    updateSidebarSpinners(elements: { conv2SectionId?: string, customElementId?: string, sectionId?: string, hosts?: string[] }): void {
        let localSession = this.hostList.sessionManager.getLocalSession();
        let all = !elements.conv2SectionId && !elements.customElementId && !elements.sectionId;
        let hosts = elements.hosts || [];
        let remoteHosts = hosts.filter(x => x != localSession.host);
        
        let updateLocal = hosts.length == 0 || hosts.indexOf(localSession.host) >= 0;
        if (updateLocal) {
            if (all || elements.conv2SectionId) {
                this.conv2List.updateSidebarSpinners(elements.conv2SectionId);
            }
            if (all || elements.customElementId) {
                this.customElementList.updateSidebarSpinners(elements.customElementId);
            }
            if (all || elements.sectionId) {
                this.sectionList.updateSidebarSpinners(elements.sectionId);
                this.customSectionList.updateSidebarSpinners(elements.sectionId);
            }
        }
        
        if (this.hostList) {
            this.hostList.hostsCollection.forEach(hostEntry => {
                if (remoteHosts.indexOf(hostEntry.host) >= 0) {
                    this.updateSidebarSpinnersRemoteHost(hostEntry, elements);
                }
            });
        }
    }
    
    updateSidebarSpinnersRemoteHost(elem: HostEntry, elements: { conv2SectionId?: string, customElementId?: string, sectionId?: string }): void {
        let all = !elements.conv2SectionId && !elements.customElementId && !elements.sectionId;
        if ((all || elements.conv2SectionId) && elem && elem.conv2List) {
            elem.conv2List.updateSidebarSpinners(elements.conv2SectionId);
        }
        if ((all || elements.sectionId) && elem && elem.sectionList) {
            elem.sectionList.updateSidebarSpinners(elements.sectionId);
        }
        this.hostList.updateSidebarSpinners(elem.host);
    }

    onViewToggleSortByOnline(): void {
        let on: boolean = !this.getOnlineFirst();
        this.setOnlineFirst(on);
        this.callViewMethod("setSortByOnlineButtonState", on);
        this.conv2List.setOnlineFirst(on);
    }
    
    getOnlineFirst(): boolean {
        return this.userPreferences.getValue(MailConst.UI_ONLINE_FIRST, false);
    }
    
    setOnlineFirst(onlineFirst: boolean): Q.Promise<void> {
        return this.userPreferences.set(MailConst.UI_ONLINE_FIRST, onlineFirst, true);
    }
    
    onUserPreferencesChange(): void {
        let on = this.getOnlineFirst();
        this.callViewMethod("setSortByOnlineButtonState", on);
        this.conv2List.setOnlineFirst(on);
    }
    
    onSectionsLimitReached(reached: boolean): void {
        this.callViewMethod("setSectionsLimitReached", reached);
    }
    
    toggleBellState(sectionId: string, conversationId: string, isRinging: boolean): void {
        if (sectionId) {
            this.sectionList.toggleBellState(sectionId, isRinging);
            this.customSectionList.toggleBellState(sectionId, isRinging);
        }
        if (conversationId) {
            this.conv2List.toggleBellState(conversationId, isRinging);
        }
    }

    toggleVoiceChatActive(sectionId: string, conversationSectionId: string, active: boolean, users: Types.webUtils.PersonSimpleModel[]): void {
        if (sectionId) {
            this.sectionList.toggleVoiceChatActive(sectionId, active, users);
            this.customSectionList.toggleVoiceChatActive(sectionId, active, users);
        }
        if (conversationSectionId) {
            this.conv2List.toggleVoiceChatActive(conversationSectionId, active, users);
        }
    }

    getVoiceChatSectionsStates(): Q.Promise<void> {
        let localSession = this.app.sessionManager.getLocalSession();
        let api = this.app.sessionManager.getVoiceChatServiceApi(localSession.hostHash);
        return Q().then(() => {
            return api.getRoomsInfo().then(data => {
                let sections = (data.sections as {users: string[], sectionId: string, roomId: string}[]);
                if (sections.length > 0) {
                    sections.forEach(s => {
                        localSession.webSocketNotifier._notifyVoiceChatUsersChange(localSession, s.users, s.sectionId);
                    })
                }
            })            
        })

    }

    onViewLoad(): void {
        Q().then(() => {
            this.getVoiceChatSectionsStates();
        })
    }

    onViewSectionOrConversationDoubleClick(elementType: "section"| "conversation", id: string, hostId: string) {
        let moduleName = this.options.customSectionList.moduleName;
        let session: Session = hostId ? this.app.sessionManager.getSessionByHostHash(hostId) : this.app.sessionManager.getLocalSession();

        let selected: SectionService;

        if (elementType == "conversation") {
            session.conv2Service.collection.list.forEach(x => {
                if (x && x.id == id && x.section) {
                    selected = x.section;
                    return;
                }
            });            
        }
        else
        if (elementType == "section") {
            selected = session.sectionManager.getSection(id);
        }             
        if (selected) {
            let singletonId = "sectionsummarywindow-"+moduleName+"-"+session.hostHash+"-"+id;
            let registered = this.app.manager.getSingleton(singletonId);
    
            if (registered) {
                registered.controller.nwin.focus();
                registered.controller.reopenWithParams([this, selected]);
                return;
            }

            // passing main window width to the opening sectionSummaryWindow
            let mainWindow = this.app.manager.getMainWindow();
            let mainWidth: number = mainWindow.controller && mainWindow.controller.nwin ? mainWindow.controller.nwin.getWidth() : undefined;
            this.app.ioc.create(SectionSummaryWindowController, [this.parent, session, selected, moduleName, mainWidth]).then(win => {
                this.app.openChildWindow(win);
                this.app.manager.registerSingleton(singletonId, win.manager);
            });    
        }


}
    
}