import {ComponentController} from "../base/ComponentController";
import {ContainerWindowController} from "../../window/container/ContainerWindowController";
import {CommonApplication} from "../../app/common/CommonApplication";
import {Person} from "../../mail/person/Person";
import {app, event, utils, webUtils, section as sectionTypes} from "../../Types";
import {GroupedElements} from "../../utils/GroupedElements";
import {Inject, Dependencies} from "../../utils/Decorators";
import {BaseAppWindowController} from "../../window/base/BaseAppWindowController";
import {Persons} from "../../mail/person/Persons";
import {PersonService} from "../../mail/person/PersonService";
import {MailFilter} from "../../mail/MailFilter";
import {UserPreferences} from "../../mail/UserPreferences";
import * as RootLogger from "simplito-logger";
import { PlayerControlsController } from "../playercontrols/main";
import { ComponentFactory } from "../main";
import { LocaleService, UtilApi } from "../../mail";
import { i18n } from "./i18n";
import { TooltipController } from "../tooltip/main";
import { VoiceChatControlsController } from "../voicechatcontrols/main";
import { Conv2Section, SectionService } from "../../mail/section";
import { Converter } from "../../utils/Converter";
import { SectionListController } from "../sectionlist/SectionListController";
import { PersonsController } from "../persons/PersonsController";
import { ContextHistory, NewContextAddedToHistoryEvent, ContextHistoryChangeEvent } from "../../app/common/contexthistory/ContextHistory";
import { Router } from "../../app/common/router/Router";
import { InAnyVideoConferenceStateChanged } from "../../app/common/videoconferences/VideoConferencesService";
let Logger = RootLogger.get("privfs-mail-client.component.navbar.NavBarController");

export interface PersonModel {
    avatar: string;
    description: string;
    hashmail: string;
    name: string;
}

export interface UserModel {
    person: PersonModel;
    menu: GroupedElements<MenuEntry>;
    showWindowControls: boolean;
    isAdmin: boolean;
}

export interface Model extends UserModel {
    activeApp: string;
    unknownDomainsCount: number;
    unknownDomainsMessagesCount: number;
    inFullscreen: boolean;
    appWindows: {
        id: string,
        icon: string,
        count: number,
        dirty: boolean,
        action: string
    }[];
    searchEnabled: boolean;
    searchVisible: boolean;
    searchValue: string;
    isActive: boolean;
    activeLogo: boolean;
    showWindowControls: boolean;
    showNavigation: boolean;
    navPrevButtonState: boolean;
    navNextButtonState: boolean;
};

export interface MenuEntry {
    id: string;
    priority: number;
    groupId: string;
    icon: string|string[];
    label: string;
    action: string;
}

export interface NavBarMenuActionEvent extends event.Event<boolean> {
    type: "navbarmenuaction";
    action: string;
}

@Dependencies(["playercontrols", "voicechatcontrols", "persons"])
export class NavBarController extends ComponentController {
    
    static textsPrefix: string = "component.navbar.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identityProvider: utils.IdentityProvider;
    @Inject persons: Persons;
    @Inject personService: PersonService;
    @Inject mailFilter: MailFilter
    @Inject userPreferences: UserPreferences;
    @Inject componentFactory: ComponentFactory;
    @Inject contextHistory: ContextHistory;
    @Inject router: Router;
    
    app: CommonApplication;
    parent: BaseAppWindowController;
    containerController: ContainerWindowController;
    fullscreenModel: app.FullscreenModel;
    activeLogo: boolean;
    menu: GroupedElements<MenuEntry>;
    playerControls: PlayerControlsController;
    voiceChatControls: VoiceChatControlsController;
    basicTooltip: TooltipController;
    personsComponent: PersonsController;
    videoConferenceState: { hostHash: string, section: SectionService, conversation: Conv2Section } = null;
    
    constructor(
        parent: BaseAppWindowController
    ) {
        super(parent);
        this.ipcMode = true;
        this.containerController = this.parent.parent;
        this.app = this.parent.app;
        this.menu = new GroupedElements();
        this.menu.addGroup("custom", 100);
        this.menu.addGroup("admin", 200);
        this.menu.addGroup("settings", 300);
        this.menu.addGroup("logout", 400);
        this.app.customMenuItems.forEach((x, i) => {
            this.menu.addElement({
                id: "custom-" + i,
                priority: i * 100,
                groupId: "custom",
                icon: x.icon,
                label: x.title,
                action: x.action
            });
        });
        if (this.identityProvider.isAdmin()) {
            this.menu.addElement({
                id: "admin",
                priority: 100,
                groupId: "admin",
                icon: ["fa fa-users", "fa fa-cog"],
                label: this.app.localeService.i18n("component.navbar.userMenu.admin"),
                action: "open-admin"
            });
        }
        if (this.identityProvider.getRights().indexOf("normal") != -1) {
            this.menu.addElement({
                id: "sections",
                priority: 200,
                groupId: "admin",
                icon: "privmx-icon privmx-icon-logo",
                label: this.app.localeService.i18n("component.navbar.userMenu.sections"),
                action: "open-sections"
            });
        }
        this.menu.addElement({
            id: "settings",
            priority: 100,
            groupId: "settings",
            icon: "ico-settings",
            label: this.app.localeService.i18n("component.navbar.userMenu.settings"),
            action: "open-settings"
        });

        // this.menu.addElement({
        //     id: "notifications",
        //     priority: 110,
        //     groupId: "settings",
        //     icon: "fa fa-bell-o",
        //     label: this.app.localeService.i18n("component.navbar.userMenu.notifications"),
        //     action: "open-notifications"
        // });
        this.menu.addElement({
            id: "about",
            priority: 200,
            groupId: "settings",
            icon: "ico-question-mark",
            label: this.app.localeService.i18n("component.navbar.userMenu.about"),
            action: "open-about"
        });
        this.menu.addElement({
            id: "support",
            priority: 190,
            groupId: "settings",
            icon: "fa fa-medkit",
            label: this.app.localeService.i18n("component.navbar.userMenu.support"),
            action: "open-support"
        });

        // this.menu.addElement({
        //     id: "fonts",
        //     priority: 201,
        //     groupId: "settings",
        //     icon: "fa fa-text",
        //     label: "Fonts",
        //     action: "open-fonts"
        // });

        this.menu.addElement({
            id: "logout",
            priority: 100,
            groupId: "logout",
            icon: "ico-upload",
            label: this.app.localeService.i18n("component.navbar.userMenu.logout"),
            action: "logout"
        });
        this.registerChangeEvent(this.containerController.activeModel.changeEvent, this.onActiveChange, "multi");
        this.registerChangeEvent(this.persons.changeEvent, this.onPersonsChange);
        // Nie obslugujemy whitelisty ani wiadomosci mailowych pomiedzy serwerami wiec powiadomienia o nich tez wylaczamy
        // this.registerChangeEvent(this.mailFilter.unknownDomains.count.changeEvent, this.onUnknownDomainsCountModelChange, "multi");
        // this.registerChangeEvent(this.mailFilter.unknownDomains.messagesCount.changeEvent, this.onUnknownDomainsMessagesCountModelChange, "multi");
        this.registerChangeEvent(this.app.searchModel.changeEvent, this.onSearchChange, "multi");
        this.fullscreenModel = this.app.getFullscreenModel();
        this.activeLogo = !!this.containerController.activateLogoAction;
        if (this.fullscreenModel) {
            this.registerChangeEvent(this.fullscreenModel.changeEvent, this.onFullscreenChange, "multi");
        }
        this.containerController.appWindows.forEach(x => {
            if (x.count) {
                this.registerChangeEvent(x.count.changeEvent, () => {
                    this.callViewMethod("setAppWindowBadge", x.id, x.count.get());
                }, "multi");
            }
            if (x.dirty) {
                this.registerChangeEvent(x.dirty.changeEvent, () => {
                    this.callViewMethod("setAppWindowDirty", x.id, x.dirty.get());
                }, "multi");
            }
        });
        this.app.addEventListener<event.TrialStatusUpdateEvent>("trial-status-update", this.onTrialStatusChange.bind(this));
        this.playerControls = this.addComponent("playercontrols", this.componentFactory.createComponent("playercontrols", [this, false]));
        this.playerControls.setApp(this.app);
        this.voiceChatControls = this.addComponent("voicechatcontrols", this.componentFactory.createComponent("voicechatcontrols", [this, this.app]));
        this.app.addEventListener<event.SetBubblesState>("set-bubbles-state", e => {
            let newState = e.markingAsRead;
            if (e.scope.moduleName) {
                this.callViewMethod("setAppWindowBadgeSpinner", e.scope.moduleName, newState);
            }
            else {
                this.containerController.appWindows.forEach(x => {
                    this.callViewMethod("setAppWindowBadgeSpinner", x.id, newState);
                });
            }
        });
        this.app.addEventListener<event.JoinedVoiceChatTalkingEvent>("joinedVoiceChat", _event => {
            this.callViewMethod("updateShortState");
        });
        this.app.addEventListener<event.LeftVoiceChatTalkingEvent>("leftVoiceChat", _event => {
            this.callViewMethod("updateShortState");
        });
        this.app.addEventListener<event.JoinVideoConferenceEvent>("join-video-conference", event => {
            this.updateVideoConferenceState(event.hostHash, event.section, event.conversation);
        });
        this.app.addEventListener<event.LeaveVideoConferenceEvent>("leave-video-conference", _event => {
            this.updateVideoConferenceState();
        });
        this.app.addEventListener<InAnyVideoConferenceStateChanged>("in-any-video-conference-state-changed", () => {
            this.updateInAnyVideoConferenceState();
        });
        this.app.addEventListener<ContextHistoryChangeEvent>("context-history-change", (_event) => {
            this.updateNavButtonsState();
        })

        this.basicTooltip = this.addComponent("basicTooltip", this.componentFactory.createComponent("tooltip", [this]));
        this.basicTooltip.getContent = (_id: string) => {
            let dblClick: boolean = this.userPreferences.getUnreadBadgeUseDoubleClick();
            return this.app.localeService.i18n(`markAllAsRead.tooltip.${dblClick?'double':'single'}Click`);
        };
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
    }
    
    onTrialStatusChange(event: event.TrialStatusUpdateEvent): void {
        let trialModel: app.TrialStatus = event;
        this.callViewMethod("updateTrialStatus", JSON.stringify(trialModel));
    }
    
    getModel(): Model {
        let person = this.personService.getPerson(this.identityProvider.getIdentity().hashmail);
        return {
            activeApp: this.containerController.activeModel.get(),
            person: {
                avatar: person.getAvatar(),
                description: person.getDescription(),
                hashmail: person.getHashmail(),
                name: person.getName(),
            },
            // wylaczamy powiadomienia o wiadomosciach z zewnatrz
            unknownDomainsCount: 0, //this.mailFilter.unknownDomains.count.get(),
            unknownDomainsMessagesCount: 0, //this.mailFilter.unknownDomains.messagesCount.get(),
            inFullscreen: this.fullscreenModel ? this.fullscreenModel.get() : false,
            menu: this.menu,
            appWindows: this.getAppWindows(),
            searchEnabled: this.app.isSearchEnabled(),
            searchVisible: this.app.searchModel.data.visible,
            searchValue: this.app.searchModel.data.value,
            isActive: this.isActive(),
            activeLogo: this.activeLogo,
            showWindowControls: this.getShowWindowControl(),
            showNavigation: this.app.isElectronApp(),
            isAdmin: this.identityProvider.isAdmin(),
            navPrevButtonState: this.contextHistory.hasPrev(),
            navNextButtonState: this.contextHistory.hasNext()
        };
    }
    
    getShowWindowControl() {
        return this.app.isElectronApp();
    }
    
    getAppWindows() {
        return this.containerController.appWindows
            .filter(x => x.visible !== false)
            .map(x => {
                if (!x.order) {
                    x.order = 0;
                }
                return x;
            })
            .sort((a, b) => a.order == b.order ? 0 : a.order - b.order)
            .map(x => {
                return {
                    id: x.id,
                    icon: x.icon,
                    count: x.count ? x.count.get() : 0,
                    dirty: x.dirty ? x.dirty.get() : false,
                    action: x.action
                };
            });
    }
    
    isActive(): boolean {
        return this.containerController.active instanceof BaseAppWindowController && this == this.containerController.active.navBar;
    }
    
    triggerMenuActionEvent(action: string) {
        return !!this.dispatchEventResult(<NavBarMenuActionEvent>{
            type: "navbarmenuaction",
            action: action
        });
    }
    
    onViewMenuAction(action: string) {
        if (this.triggerMenuActionEvent(action)) {
            return;
        }
        if (action.indexOf("http") == 0) {
            this.app.openUrl(action);
        }
        else if (action == "logout") {
            this.app.logout();
        }
        else if (action == "upload-service") {
            this.app.uploadService.bringUploadWindow();
        }
        else if (action == "open-settings") {
            this.app.openSettings();
        }
        else if (action == "send-feedback") {
            let teamAddress = this.app.isDemo() ? "team#demo.privmx.com" : "team#privmx.com";
            this.app.sendMail({
                type: "predefined",
                receivers: [teamAddress],
                title: "Feedback..."
            });
        }
        else if (action == "open-admin") {
            this.app.openAdmin();
        }
        else if (action == "open-about") {
            this.app.openAbout();
        }
        else if (action == "open-fonts") {
            this.app.openFonts();
        }
        else if (action == "open-sections") {
            this.app.openSections();
        }
        else if (action == "open-notifications") {
            this.app.openNotifications();
        }
        else if (action == "open-support") {
            this.app.openSupport();
        }
        else {
            Logger.warn("Unhandled menu action '" + action + "'");
        }
    }
    
    onViewActivateLogo(): void {
        this.containerController.activateLogo();
    }
    
    onViewShowAppWindow(appWindowId: string, withShiftKey: boolean): void {
        let active = this.containerController.activeModel.get();
        if (active == "notes2") {
            this.app.eventDispatcher.dispatchEvent({type: "clear-previews"});
        }
        this.app.contextModifierPresent = withShiftKey;
        this.containerController.redirectToAppWindow(appWindowId);
    }
    
    switchToNextApp(): void {
        let active = this.containerController.activeModel.get();
        let windows = this.getAppWindows();
        let currentAppIndex = null;
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].id == active) {
                currentAppIndex = i;
                break;
            }
        }
        if (! currentAppIndex)  {
          return;
        }
        currentAppIndex = currentAppIndex < windows.length - 1 ? currentAppIndex + 1 : 0;
        this.containerController.redirectToAppWindow(windows[currentAppIndex].id);
    }
    
    onViewToggleFullscreen(): void {
        if (this.fullscreenModel) {
            this.fullscreenModel.toggle();
        }
    }
    
    
    onViewOpenMailFilter() {
        this.app.openSettings("whitelist");
    }
    
    onViewOpenUrl(url: string): void {
        this.app.openUrl(url);
    }
    
    onViewLoad(): void {
        let seen = this.userPreferences.getValue("ui.seenFirstLoginInfo", 0);
        if (!seen) {
            this.userPreferences.set("ui.seenFirstLoginInfo", 1, true);

            // zostawiamy info dla innych modulow
            this.userPreferences.set("ui.seenFirstLoginInfo-notes2", 0, true);
            this.userPreferences.set("ui.seenFirstLoginInfo-chat", 0, true);
            this.userPreferences.set("ui.seenFirstLoginInfo-tasks", 0, true);
            this.userPreferences.set("ui.seenFirstLoginInfo-calendar", 0, true);

            // this.app.openAbout();
            this.callViewMethod("showFirstLoginInfo");
        }
        this.app.updatePaymentStatus();
        
        let chatPlugin = this.app.getComponent("chat-plugin");
        let wnd = chatPlugin.currentVideoConferenceWindowController;
        if (wnd && wnd.joinVideoConferenceEvent) {
            let evt: event.JoinVideoConferenceEvent = wnd.joinVideoConferenceEvent;
            this.updateVideoConferenceState(evt.hostHash, evt.section, evt.conversation);
        }
    }
    
    onActiveChange(): void {
        this.callViewMethod("setActive", this.containerController.activeModel.get());
    }
    
    onUnknownDomainsCountModelChange(): void {
        this.callViewMethod("setUnknownDomainsIndicator", this.mailFilter.unknownDomains.count.get());
    }
    
    onUnknownDomainsMessagesCountModelChange(): void {
        this.callViewMethod("setUnknownDomainsMessagesCount", this.mailFilter.unknownDomains.messagesCount.get());
    }
    
    onPersonsChange(person: Person): void {
        if (this.videoConferenceState) {
            this.updateVideoConferenceState(this.videoConferenceState.hostHash, this.videoConferenceState.section, this.videoConferenceState.conversation);
        }
        else {
            this.updateVideoConferenceState();
        }
        if (person.hashmail != this.identityProvider.getIdentity().hashmail) {
            return;
        }
        let model: UserModel = {
            person: {
                avatar: person.getAvatar(),
                description: person.getDescription(),
                hashmail: person.getHashmail(),
                name: person.getName()
            },
            menu: this.menu,
            showWindowControls: this.getShowWindowControl(),
            isAdmin: this.identityProvider.isAdmin(),
        };
        this.callViewMethod("setUserState", model);
    }
    
    onFullscreenChange(): void {
        this.callViewMethod("setFullscreenState", this.fullscreenModel ? this.fullscreenModel.get() : false);
    }
    
    onSearchChange(): void {
        this.callViewMethod("setSearchState", this.app.searchModel.data.visible, this.app.searchModel.data.value, this.isActive());
    }
    
    onViewSwitchToNextApp(): void {
        this.switchToNextApp();
    }
    
    onViewToggleSearch(): void {
        let data = this.app.searchModel.get();
        data.visible = !data.visible;
        this.app.searchModel.set(data);
    }
    
    onViewHideSearch() {
        let data = this.app.searchModel.get();
        if (data.visible) {
            data.visible = false;
            this.app.searchModel.set(data);
        }
    }
    
    onViewSetSearchValue(value: string) {
        let data = this.app.searchModel.get();
        data.value = value;
        this.app.searchModel.set(data);
    }
    
    onViewWindowClose() {
        this.containerController.hide();
    }
    
    onViewWindowMinimize() {
        this.containerController.nwin.minimize();
    }
    
    onViewWindowToggleMaximize() {
        this.containerController.nwin.maximizeToggle();
    }
    
    onTabSwitch(_shiftKey: boolean, ctrlKey: boolean) {
        if (ctrlKey) {
            // this.callViewMethod("switchToNextModule");
            this.switchToNextApp();
        }
    }

    onViewOnCloseFirstLoginInfo(): void {
        this.app.eventDispatcher.dispatchEvent({type:"first-login-info-closed"});
    }
    
    onViewBadgeClick(moduleName: "chat"|"notes2"|"tasks"): void {
        this.dispatchEvent<event.TryMarkAsReadEvent>({
            type: "try-mark-as-read",
            moduleName: moduleName
        });
    }

    onViewOpenOrderInfo(): void {
        this.app.openOrderInfo();
    }
    
    updateVideoConferenceState(hostHash?: string, section?: SectionService, conversation?: Conv2Section): void {
        let active: boolean = hostHash && !!(section || conversation);
        if (!active) {
            this.videoConferenceState = null;
            this.callViewMethod("updateVideoConferenceState", false);
            return;
        }
        this.videoConferenceState = { hostHash, section, conversation };
        let type: "section"|"conversation" = section ? "section" : "conversation";
        let model = conversation ? this.getConv2Model(conversation) : this.getSectionModel(section);
        let modelStr = model ? JSON.stringify(model) : null;
        this.callViewMethod("updateVideoConferenceState", active, type, modelStr);
    }
    
    updateInAnyVideoConferenceState(): void {
        const isUserInAnyConference = this.app.videoConferencesService.isUserInAnyConference();
        this.callViewMethod("updateInAnyVideoConferenceState", isUserInAnyConference);
    }
    
    getConv2Model(c2s: Conv2Section): webUtils.ConversationModel {
        return Converter.convertConv2(c2s, 0, 0, 0, true, 0, false, false, false, null);
    }
    
    getSectionModel(section: SectionService): webUtils.SectionListElementModel {
        return SectionListController.convertSection(section, 0, 0, 0, true, false, false, sectionTypes.NotificationModule.CHAT, null, true);
    }
    
    onViewOpenVideoConference(): void {
        let chatPlugin = this.app.getComponent("chat-plugin");
        chatPlugin.bringVideoConferenceWindowToFront();
    }

    onViewHistoryPrev(): void {
        if (this.app.isElectronApp()) {
            this.router.goPrev();
        }
    }

    onViewHistoryNext(): void {
        if (this.app.isElectronApp()) {
            this.router.goNext();
        }
    }
    
    updateNavButtonsState() {
        this.callViewMethod("updateNavButtonsState", this.contextHistory.hasNext(), this.contextHistory.hasPrev());
    }
}
