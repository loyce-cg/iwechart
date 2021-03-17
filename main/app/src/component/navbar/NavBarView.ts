import {ComponentView} from "../base/ComponentView";
import {ContextMenu} from "../../web-utils/ContextMenu";
import {func as mainTemplate} from "./template/main.html";
import {func as searchTemplate} from "./template/search.html";
import {func as trialStatusTemplate} from "./template/trial-status.html";
import {func as trialStatusDropdownTemplate} from "./template/trial-status-dropdown.html";

import {Model, UserModel} from "./NavBarController";
import * as $ from "jquery";
import {func as userTemplate} from "./template/user.html";
import {func as userNameTemplate} from "./template/user-name.html";
import {func as firstLoginInfoTemplate} from "./template/first-login-info.html";
import {webUtils} from "../../Types";
import {UI} from "../../web-utils/UI";
import * as Q from "q";
import {Lang} from "../../utils/Lang";
import {EventDispatcher} from "../../utils/EventDispatcher";
import {app, event} from "../../Types";
import {BaseAppWindowView} from "../../window/base/BaseAppWindowView";
import {KEY_CODES} from "../../web-utils/UI";
import { PlayerControlsView } from "../playercontrols/web";
import { WebUtils } from "../../web-utils";
import { SectionListView } from "../sectionlist/SectionListView";
import {Dropdown} from "../../component/dropdown/Dropdown";

export type TrialModel = app.TrialStatus;
import { TooltipView } from "../tooltip/web";
import { VoiceChatControlsView } from "../voicechatcontrols/web";
import { func as conversationTemplate } from "../template/conversation.html";
import { func as sectionTemplate } from "../template/section.html";
import { PersonsView } from "../persons/PersonsView";

export interface Focusable {
    windowFocusable: boolean;
    focusWindow(): void;
}
interface CssRect {
    top?: number;
    left?: number;
    width?: number;
    height?: number;
    pointerRight?: number;
}
export interface NavBarCustomActionEvent extends event.Event<boolean> {
    type: "navbarcustomaction";
    customAction: string;
    event: Event;
}

export class NavBarView extends ComponentView {
    
    parent: BaseAppWindowView<any>;
    $container: JQuery;
    mainTemplate: webUtils.MailTemplate<Model>;
    sectionTemplate: webUtils.MailTemplate<webUtils.SectionListElementModel>;
    conversationTemplate: webUtils.MailTemplate<webUtils.ConversationModel>;
    $containerInner: JQuery;
    $fullscreen: JQuery;
    $searchBar: JQuery;
    $searchBarButtonInner: JQuery;
    showWindowControls: boolean;
    isCtrlKeyDown: boolean = false;
    playerControls: PlayerControlsView;
    voiceChatControls: VoiceChatControlsView;
    trialStatus: app.TrialStatus;
    dropdown: Dropdown<app.TrialStatus>;
    $trialItem: JQuery;
    personsComponent: PersonsView;
    basicTooltip: TooltipView;
    protected _delayedClickTimeout: number = null;
    isUserInAnyConference: boolean = false;
    isVideoConferenceActive: boolean = false;
    
    constructor(parent: BaseAppWindowView<any>) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.sectionTemplate = this.templateManager.createTemplate(sectionTemplate);
        this.conversationTemplate = this.templateManager.createTemplate(conversationTemplate);
        this.playerControls = this.addComponent("playercontrols", new PlayerControlsView(this));
        this.voiceChatControls = this.addComponent("voicechatcontrols", new VoiceChatControlsView(this));
        this.basicTooltip = this.addComponent("basicTooltip", new TooltipView(this));
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.mainTemplate.helper));
    }
    
    init(model: Model) {
        this.showWindowControls = model.showWindowControls;
        this.$container.on("click", "[data-trigger]", this.onTriggerClick.bind(this));
        this.$container.on("click", ".login-data", this.onLoginDataClick.bind(this));
        this.$container.on("click", "[data-action='open-video-conference']", this.onOpenVideoConferenceClick.bind(this));
        $("body").on("click", ".first-login-info [data-action=close-info]", this.closeFirstLoginInfo.bind(this));
        $("body").on("click", ".first-login-info-hole", this.closeFirstLoginInfo.bind(this));
        this.render(model);
        this.$searchBarButtonInner = this.$container.find(".search-button-inner");
        this.$searchBar = this.templateManager.createTemplate(searchTemplate).renderToJQ();
        this.$searchBar.appendTo(this.$container.find(".action-panel").find(".search-item"));
        this.setSearchState(model.searchVisible, model.searchValue, model.isActive);
        this.$searchBar.find("input").on("input", this.onSearchInput.bind(this));
        this.$searchBar.find("input").on("keydown", this.onSearchKeyDown.bind(this));
        let $actionPanel = this.$container.find(".action-panel");
        $actionPanel.on("click", ".number.badge", this.onBadgeClick.bind(this));
        $actionPanel.on("dblclick", ".number.badge", this.onBadgeDoubleClick.bind(this));
        $actionPanel.on("mouseenter", ".number.badge", this.onBadgeMouseEnter.bind(this));
        $actionPanel.on("mouseleave", ".number.badge", this.onBadgeMouseLeave.bind(this));
        
        let $input = this.$searchBar.find("input");
        $input.on("keydown", e => {
            if (e.keyCode != KEY_CODES.tab) {
                e.stopPropagation();
            }
        });
        
        this.bindKeyPresses();
        this.$trialItem =  this.$container.find(".trial-status-item");
        return Q().then(() => {
           this.playerControls.$container = this.$container.find(".player-container");
           return this.playerControls.triggerInit();
        })
        .then(() => {
            this.voiceChatControls.$container = this.$container.find(".voice-chat-controls-container");
            return this.voiceChatControls.triggerInit();
        })
        .then(() => {
            this.basicTooltip.$container = this.$container;
            this.basicTooltip.isEnabled = (e: MouseEvent) => {
                let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
                return unreadBadgeClickAction != "ignore";
            };
            return this.basicTooltip.triggerInit();
        })
        .then(() => {
            this.personsComponent.$main = this.$container;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this.personsComponent.refreshAvatars();
        });
    }
    
    render(model: Model): void {
        this.dispatchEvent<event.ComponentViewEvent>({type: "beforerender", target: this});
        this.$container.content(this.mainTemplate.renderToJQ(model));
        this.$containerInner = this.$container.find(".component-nav-bar:first");
        this.$fullscreen = this.$container.find("[data-trigger=toggle-fullscreen]");
        this.renderTrialStatus();
        this.updateNavButtonsState(model.navNextButtonState, model.navPrevButtonState);
        this.dispatchEvent<event.ComponentViewEvent>({type: "afterrender", target: this});
    }
    
    triggerCustomAction(action: string, event: Event) {
        return !!this.dispatchEventResult(<NavBarCustomActionEvent>{
            type: "navbarcustomaction",
            customAction: action,
            event: event
        });
    }
    
    onTriggerClick(event: MouseEvent): void {
        let $elem = $(event.currentTarget).closest("[data-trigger]");
        let action = $elem.data("trigger");

        if (action == "history-prev") {
            this.triggerEvent("historyPrev");
            return;
        }

        if (action == "history-next") {
            this.triggerEvent("historyNext");
            return;
        }

        if (action == "open-trial-dropdown") {
            this.showTrialDropdown();
            return;
        }

        if (action == "open-order-info") {
            this.triggerEvent("OpenOrderInfo");
            return;
        }

        if ($elem.hasClass("window-header-button") && (action === "windowClose" || action === "windowMinimize" || action === "windowToggleMaximize")) {
            this.triggerEvent(action);
            return;
        }
        if (this.triggerCustomAction(action, event)) {
            return;
        }
        if (action != "toggle-search" && $elem.hasClass("active")) {
            return;
        }
        switch (action) {
            case "activate-logo":
                this.triggerEvent("activateLogo");
                break;
            case "toggle-fullscreen":
                this.triggerEventInTheSameTick("toggleFullscreen");
                break;
            case "open-mail-filter":
                this.triggerEvent("openMailFilter");
                break;
            case "launch-app-window":
                this.clearDelayedClickTimeout();
                let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
                let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
                if (unreadBadgeClickAction == "ignore" || $(event.target).closest(".number.badge").length == 0) {
                    this.triggerEvent("showAppWindow", $elem.data("app-window"), event.shiftKey);
                }
                else {
                    if (unreadBadgeUseDoubleClick) {
                        this._delayedClickTimeout = <any>setTimeout(() => {
                            this.triggerEvent("showAppWindow", $elem.data("app-window"), event.shiftKey);
                        }, SectionListView.SINGLE_CLICK_DELAY);
                    }
                }
                break;
            case "toggle-search":
                if (!this.$searchBar.data("animInProgess")) {
                    this.triggerEvent("toggleSearch");
                }
                break;
        }
    }
    
    setSearchState(visible: boolean, value: string, isActive: boolean) {
        this.$searchBar.find("input").val(value);
        if (visible == !this.$searchBar.hasClass("search-off")) {
            return;
        }
        this.updateShortState();
        let $searchItem = this.$searchBar.parents("li.search-item");
        // if ($searchItem.css("position") != "absolute") {
        //     let rect = $searchItem[0].getBoundingClientRect();
        //     $searchItem.css("position", "absolute");
        //     $searchItem.css("left", rect.left + "px");
        //     $searchItem.css("z-index", "9");
        // }
        this.$container.find("[data-trigger='toggle-search']").toggleClass("active", visible);
        this.$searchBar.toggleClass("search-off", !visible);
        $searchItem.toggleClass("open", visible);
        this.$searchBarButtonInner.toggleClass("with-bg", visible);
        if (visible && isActive) {
            this.$searchBar.find("input").focus();
        }
        // setTimeout(() => {
        //     this.voiceChatControls.updateNarrowState();
        // }, 200);
    }
    
    updateShortState(): void {
        let hasVoiceChat = $(".component-voice-chat-controls.is-in-voice-chat").length > 0;
        this.$searchBar.toggleClass("short", hasVoiceChat);
    }
    
    onSearchInput() {
        this.triggerEvent("setSearchValue", <string>this.$searchBar.find("input").val());
    }
    
    onSearchKeyDown(e: KeyboardEvent): void {
        if (e.key == "Escape") {
            e.stopPropagation();
            this.triggerEvent("hideSearch");
        }
        else if (e.key == "f" && WebUtils.hasCtrlModifier(e)) {
            e.preventDefault();
            e.stopPropagation();
            this.triggerEvent("toggleSearch");
        }
    }
    
    setBadge($badge: JQuery, value: number): void {
        $badge.text(value);
        if (value) {
            if (!$badge.hasClass("visible")) {
                $badge.addClass("visible");
            }
        }
        else {
            if ($badge.hasClass("visible")) {
                $badge.removeClass("visible");
            }
        }
    }
    
    getActive() {
      return this.$container.find("li > .active");
    }
    
    setActive(appWindowId: string): void {
        this.$container.find("li > .active:not([data-trigger=toggle-search])").removeClass("active");
        this.$container.find("li > [data-app-window='" + appWindowId + "']").addClass("active");
    }
    
    setAppWindowBadge(appWindowId: string, count: number): void {
        let $badge = this.$container.find("li > [data-app-window='" + appWindowId + "'] .badge");
        this.setBadge($badge, count);
    }
    
    setAppWindowBadgeSpinner(appWindowId: string, spinner: boolean): void {
        let $badge = this.$container.find("li > [data-app-window='" + appWindowId + "'] .badge");
        let width: string = spinner ? ($badge.outerWidth() || 0).toString() : "initial";
        $badge.css("width", width).toggleClass("with-spinner", spinner);
    }
    
    setAppWindowDirty(appWindowId: string, visible: boolean): void {
        let $elem = this.$container.find("li > [data-app-window='" + appWindowId + "'] .dirty-marker");
        if (visible) {
            $elem.addClass("visible");
        }
        else {
            $elem.removeClass("visible");
        }
    }
    
    setUnknownDomainsIndicator(count: number): void {
        let $indicator = this.$container.find(".unknown-domains-indicator");
        $indicator.toggleClass("hide", count == 0);
    }
    
    setUnknownDomainsMessagesCount(count: number): void {
        this.$container.find(".unknown-domains-indicator-badge").text(count);
    }
    
    onLoginDataClick(): boolean {
        ContextMenu.show({
            $element: true,
            $contextMenu: this.$container.find(".login-data .context-menu-nav-bar").clone().addClass("context-menu"),
            handler: this.onMenuAction.bind(this)
        });
        return false;
    }
    
    onMenuAction(action: string, event: Event): void {
        if (this.triggerCustomAction(action, event)) {
            return;
        }
        this.triggerEvent("menuAction", action);
    }
    
    setUserState(model: UserModel): void {
        this.$container.find(".nav-bar-user-name").replaceWith(this.templateManager.createTemplate(userNameTemplate).renderToJQ(model));
    }
    
    setFullscreenState(enabled: boolean): void {
        if (enabled) {
            $(".fullscreen span").removeClass("fa-expand").addClass("fa-compress");
        }
        else {
            $(".fullscreen span").addClass("fa-expand").removeClass("fa-compress");
        }
    }
    
    showFirstLoginInfo(): void {
        let $info = this.templateManager.createTemplate(firstLoginInfoTemplate).renderToJQ();
        let holeWidth = this.$container.find(".login-data").outerWidth() + 10;
        $info.toggleClass("first-login-narrow-mode", this.showWindowControls);
        $info.find(".first-login-info-hole").css("width", holeWidth);
        $info.find(".first-login-info").css("width", holeWidth + (this.showWindowControls ? 20 : 130));
        this.parent.windowFocusable = false;
        $("body").append($info);
    }
    
    closeFirstLoginInfo(event: Event): void {
        this.parent.windowFocusable = true;
        $(event.currentTarget).closest(".first-login-info-wrapper").remove();
        this.triggerEvent("onCloseFirstLoginInfo");
    }
    
    onFirstLoginInfoMenuClick(event: Event): void {
        this.parent.windowFocusable = true;
        this.parent.focusWindow();
        $(event.currentTarget).closest(".first-login-info-wrapper").remove();
        this.onLoginDataClick();
    }
    
    bindKeyPresses(): void {
        $(document).on("keyup", e => {
            if (e.keyCode == KEY_CODES.ctrl || e.keyCode == KEY_CODES.command) {
                this.isCtrlKeyDown = false;
            }
        });
        $(document).on("keydown", e => {
            if (e.keyCode == KEY_CODES.ctrl || e.keyCode == KEY_CODES.command) {
                this.isCtrlKeyDown = true;
            }
            if (e.keyCode == KEY_CODES.tab && e.ctrlKey) {
                e.preventDefault();
                this.switchToNextModule(e.shiftKey);
            }
            if (e.keyCode == KEY_CODES.leftArrow && (e.metaKey || e.ctrlKey) && e.altKey) {
                e.preventDefault();
                this.triggerEvent("historyPrev");
            }
            if (e.keyCode == KEY_CODES.rightArrow && (e.metaKey || e.ctrlKey) && e.altKey) {
                e.preventDefault();
                this.triggerEvent("historyNext");
            }
        });
    }
    
    switchToNextModule(reverse: boolean = false) {
        let $elem = this.getActive();
        let $list = this.$container.find("li:not(.search-item) > .action-link");
        let index = $list.index($elem);
        
        let next = index + (reverse ? -1 : 1);
        next = (next + $list.length) % $list.length;
        let $elemToSwitch = $($list.get(next));
        this.triggerEvent("showAppWindow", $elemToSwitch.data("app-window"));
    }
    
    onBadgeClick(e: MouseEvent): void {
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (!unreadBadgeUseDoubleClick) {
            this.handleBadgeSingleOrDoubleClick(e);
        }
    }
    
    onBadgeDoubleClick(e: MouseEvent): void {
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (unreadBadgeUseDoubleClick) {
            this.handleBadgeSingleOrDoubleClick(e);
        }
    }
    
    handleBadgeSingleOrDoubleClick(e: MouseEvent): void {
        this.clearDelayedClickTimeout();
        let moduleName = $(e.target).closest("[data-app-window]").data("app-window");
        if (moduleName && ["chat", "notes2", "tasks"].indexOf(moduleName) >= 0) {
            this.triggerEvent("badgeClick", moduleName);
        }
    }
    
    onBadgeMouseEnter(e: MouseEvent): void {
        this.toggleBadgeParentHover(e, true);
    }
    
    onBadgeMouseLeave(e: MouseEvent): void {
        this.toggleBadgeParentHover(e, false);
    }
    
    toggleBadgeParentHover(e: MouseEvent, isBadgeHover: boolean): void {
        let $parent = $(e.target).closest("[data-trigger=launch-app-window]");
        $parent.toggleClass("with-badge-hover", isBadgeHover);
    }
    
    clearDelayedClickTimeout(): void {
        if (this._delayedClickTimeout) {
            clearTimeout(this._delayedClickTimeout);
            this._delayedClickTimeout = null;
        }
    }
    updateTrialStatus(serializedModel: string): void {
        this.trialStatus = <app.TrialStatus>JSON.parse(serializedModel);
        this.renderTrialStatus();
    }
    
    renderTrialStatus(): void {
        if (! this.trialStatus) {
            return;
        }
        if (this.dropdown && this.dropdown.$rendered) {
            return;
        }

        this.$trialItem.empty();
        let $template = this.templateManager.createTemplate(trialStatusTemplate).renderToJQ(this.trialStatus);
        $template.appendTo(this.$trialItem);
        this.$trialItem.toggleClass("trial-alert", this.trialStatus.subscriptionEnding);
    }

    showTrialDropdown(): void {
        if (this.dropdown && this.dropdown.$rendered) {
            setTimeout(() => {
                this.dropdown.destroy();
            },1);
            return;
        }
        let $parentItem = this.$container.find(".trial-status-item");
        let dropdownPos = this.calculateTrialDropdownDimensions($parentItem);

        this.dropdown = new Dropdown({
            model: this.trialStatus,
            template: this.templateManager.createTemplate(trialStatusDropdownTemplate),
            $container: this.$container.find(".trial-dropdown"),
            templateManager: this.templateManager
        });
        this.$trialItem.find(".component-dropdown").css("left", dropdownPos.left + "px");
        this.dropdown.$backdrop.remove();
        this.dropdown.$rendered.on("click", event => {
            setTimeout(() => {
                this.dropdown.destroy();
            },1);
        });
    }

    calculateTrialDropdownDimensions($parent: JQuery): CssRect {
        let containerRect = $parent[0].getBoundingClientRect();
        return {
            left: containerRect.left + containerRect.width / 2
        }
    }
    
    updateVideoConferenceState(active: boolean, type: "section"|"conversation", modelStr: string): void {
        this.isVideoConferenceActive = active;
        this.updateVideoConferencePanelVisibility();
        if (!active) {
            return;
        }
        
        let $container = this.$container.find(".video-conference-controls-container");
        let $section = $container.find(".video-conference-section");
        let $conversation = $container.find(".video-conference-conversation");
        $section.toggleClass("is-visible", type == "section");
        $conversation.toggleClass("is-visible", type == "conversation");
        if (type == "section") {
            let $rendered = this.sectionTemplate.renderToJQ(JSON.parse(modelStr), { isActive: false });
            $section.empty();
            $section.append($rendered);
        }
        else if (type == "conversation") {
            let conv2Model = JSON.parse(modelStr);
            let $rendered = this.conversationTemplate.renderToJQ(conv2Model, { isActive: false });
            $conversation.empty();
            $conversation.append($rendered);
            $conversation.toggleClass("multi-person", !!conv2Model.persons);
            this.refreshAvatars();
        }
    }
    
    updateInAnyVideoConferenceState(isUserInAnyConference: boolean): void {
        this.isUserInAnyConference = isUserInAnyConference;
        this.updateVideoConferencePanelVisibility();
    }
    
    updateVideoConferencePanelVisibility(): void {
        const isVideoConferencePanelVisible = this.isUserInAnyConference && this.isVideoConferenceActive;
        const $container = this.$container.find(".video-conference-controls-container");
        $container.toggleClass("is-visible", isVideoConferencePanelVisible);
    }
    
    onOpenVideoConferenceClick(): void {
        this.triggerEvent("openVideoConference");
    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    updateNavButtonsState(nextEnabled: boolean, prevEnabled: boolean): void {
        this.$container.find("[data-trigger=history-next]").toggleClass("disabled", nextEnabled ? false : true);
        this.$container.find("[data-trigger=history-prev]").toggleClass("disabled", prevEnabled ? false : true);
    }
}
