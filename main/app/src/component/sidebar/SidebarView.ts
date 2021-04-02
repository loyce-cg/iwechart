import {ComponentView} from "../base/ComponentView";
import * as Types from "../../Types";
import {Conv2ListView, Conv2ListOptions} from "../conv2list/Conv2ListView";
import {SectionListView, SectionListOptions} from "../sectionlist/SectionListView";
import * as Q from "q";
import {CustomElementListView, CustomElementListOptions} from "../customelementlist/CustomElementListView";
import {Model, ActiveVideoConferencesInfo} from "./SidebarController";
import {SplitterView, Options as SplitterOptions} from "../splitter/SplitterView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import { InfoTooltip } from "../infotooltip/InfoTooltip";
import { MailClientViewHelper } from "../../web-utils/MailClientViewHelper";
import { KEY_CODES, UI } from "../../web-utils/UI";
import { Lang } from "../../utils/Lang";
import { RemoteHostListView, HostListOptions } from "../remotehostlist/RemoteHostListView";
import { TooltipView } from "../tooltip/web";
import { RemoteSectionListView } from "../remotesectionlist/web";
import { RemoteConv2ListView } from "../remoteconv2list/web";
import { UsersListTooltipView } from "../userslisttooltip/web";
import { SidebarElementType } from "./Types";
import { PfScrollExperimental } from "../../web-utils/PfScrollExperimental";
import { VisibilityObserver } from "../../web-utils/VisibilityObserver";
import { Debouncer } from "../../web-utils/Debouncer";
export * from "./Types";

export interface SidebarOptions {
    conv2List: Conv2ListOptions;
    sectionList: SectionListOptions;
    customSectionList: SectionListOptions;
    customElementList: CustomElementListOptions;
    conv2Splitter: SplitterOptions;
}

export interface SidebarButtonClickEvent extends Types.event.Event<boolean> {
    type: "sidebarbuttonclick";
    sidebarButtonId: string;
}

export interface SidebarComponent {
    isElement($ele: JQuery): boolean;
    activateElement($ele: JQuery): boolean;
    clearDelayedClickTimeout(): void;
}

interface BubbleElement {
    $sidebarElement: JQuery;
    at: number;
    isMuted: boolean;
}

export class SidebarView extends ComponentView {
    
    static DYNAMIC_SHADOW: boolean = true;
    static EXTRA_BUTTONS_ACTIVATION_DELAY: number = 500;
    
    mainTemplate: Types.webUtils.MailTemplate<Model>;
    helper: MailClientViewHelper;
    $container: JQuery;
    $splitterTopContent: JQuery;
    $extraStyle: JQuery;
    conv2Splitter: SplitterView;
    conv2List: Conv2ListView;
    sectionList: SectionListView;
    hostList: RemoteHostListView;
    customSectionList: SectionListView;
    customElementList: CustomElementListView;
    sidebarComponents: SidebarComponent[];
    sidebarContainers: JQuery[];
    remoteSectionLists: { [hostHash: string]: RemoteSectionListView } = {};
    remoteConv2Lists: { [hostHash: string]: RemoteConv2ListView } = {};
    infoTooltip: InfoTooltip;
    basicTooltip: TooltipView;
    usersListTooltip: UsersListTooltipView;
    extraButtonsActivationTimeout: number = null;
    $activeSettingsButton: JQuery = null;
    $activePinButton: JQuery = null;
    sectionScrollableBubbleElements: BubbleElement[] = [];
    conv2ScrollableBubbleElements: BubbleElement[] = [];
    $sectionScrollable: JQuery = null;
    $conv2Scrollable: JQuery = null;
    sectionPfScroll: PfScrollExperimental = null;
    conv2PfScroll: PfScrollExperimental = null;
    sectionVisibilityObserver: VisibilityObserver = null;
    conv2VisibilityObserver: VisibilityObserver = null;
    
    constructor(
        parent: Types.app.ViewParent,
        public options: SidebarOptions
    ) {
        super(parent);
        this.helper = this.templateManager.getHelperByClass(MailClientViewHelper);
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.basicTooltip = this.addComponent("basicTooltip", new TooltipView(this));
        this.usersListTooltip = this.addComponent("userslisttooltip", new UsersListTooltipView(this));
        let origFuncSectionList = this.options.sectionList.extList.onAfterListRender;
        this.options.sectionList.extList.onAfterListRender = view => {
            if (origFuncSectionList) {
                origFuncSectionList(view);
            }
            this.updateSectionScrollableBubbleElementsCache();
            this.updateSectionScrollableBubbleElements();
        };
        this.sectionList = this.addComponent("sectionList", new SectionListView(this, this.options.sectionList));
        this.hostList = this.addComponent("hostList", new RemoteHostListView(this));
        
        
        let origFuncCustomSectionList = this.options.customSectionList.extList.onAfterListRender;
        this.options.customSectionList.extList.onAfterListRender = view => {
            if (origFuncCustomSectionList) {
                origFuncCustomSectionList(view);
            }
            this.updateSectionScrollableBubbleElementsCache();
            this.updateSectionScrollableBubbleElements();
        };
        this.customSectionList = this.addComponent("customSectionList", new SectionListView(this, this.options.customSectionList));
        
        let origFuncCustomElementList = this.options.customElementList.extList.onAfterListRender;
        this.options.customElementList.extList.onAfterListRender = view => {
            if (origFuncCustomElementList) {
                origFuncCustomElementList(view);
            }
            this.updateSectionScrollableBubbleElementsCache();
            this.updateSectionScrollableBubbleElements();
        };
        this.customElementList = this.addComponent("customElementList", new CustomElementListView(this, this.options.customElementList));
        
        this.sidebarComponents = [
            this.customElementList,
            this.sectionList,
            this.customSectionList,
        ];
        this.sidebarContainers = [];
    }
    
    init(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.$container.content(this.mainTemplate.renderToJQ(model));
            this.$container.attr("tabindex", "-1");
            this.$container.on("click", "[data-sidebar-button-id]", this.onSidebarButtonClick.bind(this));
            this.$container.on("keydown", this.onKeydown.bind(this));
            this.$container.on("click", ".wi-element-badge.number, .unread-count.number", this.onBadgeClick.bind(this));
            this.$container.on("dblclick", ".section-element, .conversation-element", this.handleSectionOrConversationCtrlClick.bind(this));
            this.$container.on("dblclick", ".wi-element-badge.number, .unread-count.number", this.onBadgeDoubleClick.bind(this));
            this.$container.on("mouseenter", ".wi-element-badge.number, .unread-count.number", this.onBadgeMouseEnter.bind(this));
            this.$container.on("mouseleave", ".wi-element-badge.number, .unread-count.number", this.onBadgeMouseLeave.bind(this));
            this.$container.on("mouseenter", ".wi-element, .conversation-element", this.onItemMouseEnter.bind(this));
            this.$container.on("mouseleave", ".wi-element, .conversation-element", this.onItemMouseLeave.bind(this));
            this.$container.on("click", ".sort-by-online-button", this.onSortByOnlineButtonClick.bind(this));
            this.$container.on("click", ".videoconf-button", this.onVideoConfButtonClick.bind(this));
            if (!model.conv2ListEnabled) {
                return;
            }
            if (this.options.conv2List && this.options.conv2List.extList) {
                let origFunc = this.options.conv2List.extList.onAfterListRender;
                this.options.conv2List.extList.onAfterListRender = view => {
                    if (origFunc) {
                        origFunc(view);
                    }
                    this.updateSortByOnlineButtonDisabledState();
                    this.updateConv2ScrollableBubbleElementsCache();
                    this.updateConv2ScrollableBubbleElements();
                }
            }
            this.conv2List = this.addComponent("conv2List", new Conv2ListView(this, this.options.conv2List));
            this.sidebarComponents.push(this.conv2List);
            this.conv2Splitter = this.addComponent("conv2Splitter", new SplitterView(this, this.options.conv2Splitter || {
                type: "horizontal",
                handlePlacement: "bottom",
                flip: true,
                handleDot: true,
                firstPanelMinSize: 64,
                secondPanelMinSize: 60,
            }));
            let $customElementList = this.$container.find(".custom-element-list").detach();
            let $sectionList = this.$container.find(".section-list").detach();
            let $hostList = this.$container.find(".host-list").detach();
            let $customSectionList = this.$container.find(".custom-section-list").detach();
            let $customElementListA = this.$container.find(".custom-element-list-a").detach();
            let $conv2List = this.$container.find(".conv2-list").detach();
            let $sidebarButtons = this.$container.find(".sidebar-buttons").detach();
            let $sidebarButtonsOnSections = this.$container.find(".sidebar-buttons-sections").detach();
            this.conv2Splitter.$container = this.$container.find(".sidebar");
            $conv2List.toggleClass("with-assigned-to-prefixes", model.conv2ListWithAssignedToPrefixes);
            return this.conv2Splitter.triggerInit().then(() => {
                this.conv2Splitter.$top.append($customSectionList);
                this.conv2Splitter.$top.append($customElementList);
                this.conv2Splitter.$top.append($sectionList);
                this.conv2Splitter.$top.append($sidebarButtonsOnSections);
                this.conv2Splitter.$bottom.append($customElementListA);
                this.conv2Splitter.$bottom.append($conv2List);
                this.conv2Splitter.$bottom.append($sidebarButtons);
                this.conv2Splitter.$top.append($hostList);
            });
        })
        .then(() => {
            this.customElementList.customElements.$container = this.$container.find(".custom-element-list");
            this.customElementList.customElementsA.$container = this.$container.find(".custom-element-list-a");
            this.sectionList.sections.$container = this.$container.find(".section-list");
            this.hostList.hosts.$container = this.$container.find(".host-list");
            this.customSectionList.sections.$container = this.$container.find(".custom-section-list");
            let promises = [
                this.sectionList.triggerInit(),
                this.hostList.triggerInit(),
                this.customElementList.triggerInit(),
                this.customSectionList.triggerInit(),
            ];
            if (model.conv2ListEnabled) {
                this.conv2List.conversations.$container = this.$container.find(".conv2-list");
                promises.push(this.conv2List.triggerInit());
            }
            this.sidebarContainers = [
                this.$container.find(".custom-element-list"),
                this.$container.find(".section-list"),
                this.$container.find(".host-list"),
                this.$container.find(".custom-element-list-a"),
                this.$container.find(".conv2-list"),
                this.$container.find(".custom-section-list")
            ];
            return Q.all(promises);
        })
        .then(() => {
            // console.log("hosts container", this.hostList.hosts.$container);

            this.infoTooltip = this.addComponent("infoTooltip", new InfoTooltip(this));
            this.infoTooltip.init(this.$container);
            this.moveSelectionToActive();
            let $verticalSplitters = this.$container.find(".component-splitter-panel-top, .component-splitter-panel-bottom");
            $verticalSplitters.each((_i, el) => {
                $(el).pfScrollExperimental();
            });
            if (this.options.conv2List) {
                this.conv2Splitter.$bottom.prepend(`<div class="sort-by-online-button"><div class="infotooltip not-rendered" data-tooltip-theme="dark" data-tooltip-message="${this.helper.i18n("component.sidebar.sortByOnlineButton.tooltip")}"></div></div>`);
                this.setSortByOnlineButtonState(model.onlineFirst);
            }
            let $splitterTopContent = $verticalSplitters.filter(".component-splitter-panel-top").children(".pf-content");
            this.$splitterTopContent = $splitterTopContent;
            $splitterTopContent.on("scroll", () => this.updateShadowPosition());
            if ((<any>window).ResizeObserver) {
                let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                    this.updateShadowPosition();
                });
                resizeObserver.observe($splitterTopContent[0]);
            }
            this.$extraStyle = $("<style type='text/css'></style>");
            this.$container.append(this.$extraStyle);
            this.$container.siblings(".component-splitter-handle").addClass("sidebar-handle");
        })
        .then(() => {
            this.basicTooltip.$container = this.$container;
            this.basicTooltip.convertContent = (cnt: string) => {
                return this.helper.i18n(cnt);
            };
            this.basicTooltip.isEnabled = (e: MouseEvent) => {
                let $el = <JQuery>$(e.currentTarget);
                if ($el.data("basic-id") == "scroll-to-bubbles-up" || $el.data("basic-id") == "scroll-to-bubbles-down") {
                    return true;
                }
                let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
                return unreadBadgeClickAction != "ignore";
            };
            this.$sectionScrollable = this.$container.find(".section-list").closest(".pf-content");
            this.$conv2Scrollable = this.$container.find(".conv2-list").closest(".pf-content");
            this.sectionPfScroll = this.$sectionScrollable.parent().pfScrollExperimental() as PfScrollExperimental;
            this.conv2PfScroll = this.$conv2Scrollable.parent().pfScrollExperimental() as PfScrollExperimental;
            this.sectionVisibilityObserver = new VisibilityObserver(this.$sectionScrollable.parent()[0] as HTMLElement);
            this.conv2VisibilityObserver = new VisibilityObserver(this.$conv2Scrollable.parent()[0] as HTMLElement);
            this.attachBubblesHint(this.$sectionScrollable, "section");
            this.attachBubblesHint(this.$conv2Scrollable, "conv2");
            return this.basicTooltip.triggerInit();
        })
        .then(() => {
            this.usersListTooltip.$container = this.$container;
            return this.usersListTooltip.triggerInit();
        })
        .then(() => {
            this.updateSectionScrollableBubbleElementsCache();
            this.updateConv2ScrollableBubbleElementsCache();
            this.updateSectionScrollableBubbleElements();
            this.updateConv2ScrollableBubbleElements();
            setTimeout(() => {
                this.updateSectionScrollableBubbleElementsCache();
                this.updateConv2ScrollableBubbleElementsCache();
                this.updateSectionScrollableBubbleElements();
                this.updateConv2ScrollableBubbleElements();
            }, 500);
            this.setSectionsLimitReached(model.sectionsLimitReached);
        });
    }
    
    updateShadowPosition(): void {
        if (!SidebarView.DYNAMIC_SHADOW) {
            return;
        }
        let splitterTopContent = this.$splitterTopContent[0];
        let contentHeight = splitterTopContent.scrollHeight;
        let visibleContentHeight = splitterTopContent.clientHeight;
        let scrollTop = splitterTopContent.scrollTop;
        let bottom = contentHeight - visibleContentHeight - scrollTop;
        let shadowHeight = 16;
        let shadowPos = -Math.max(0, shadowHeight - Math.max(0, bottom));
        this.$extraStyle.html("");
        this.$extraStyle.append(".sidebar .component-splitter-horizontal .component-splitter-panel-top:after { bottom:" + shadowPos + "px !important; }");
        this.$extraStyle.append(".sidebar .component-splitter-horizontal .component-splitter-panel-bottom:before { opacity:" + ((shadowHeight + shadowPos) / shadowHeight) + " !important; }");
    }
        
    onSidebarButtonClick(event: MouseEvent): void {
        let sidebarButtonId = $(event.target).closest("[data-sidebar-button-id]").data("sidebar-button-id");
        let result = this.dispatchEventResult(<SidebarButtonClickEvent>{
            type: "sidebarbuttonclick",
            sidebarButtonId: sidebarButtonId
        });
        if (result !== false) {
            this.triggerEvent("sidebarButtonAction", sidebarButtonId);
        }
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
        if ($(e.currentTarget).closest(".window-filechooser").length > 0) {
            return;
        }
        for (let component of this.sidebarComponents) {
            component.clearDelayedClickTimeout();
        }
        this.hostList.clearDelayedClickTimeout();
        for (let rsl of Object.values(this.remoteSectionLists)) {
            rsl.clearDelayedClickTimeout();
        }
        for (let rcl of Object.values(this.remoteConv2Lists)) {
            rcl.clearDelayedClickTimeout();
        }
        let sectionId = $(e.target).closest("[data-section-id]").data("section-id");
        let hostId = $(e.target).closest("[data-host-id]").data("host-id");
        let conversationId = $(e.target).closest("[data-conversation-id]").data("conversation-id");
        let customElementId = $(e.target).closest("[data-custom-element-id]").data("custom-element-id");
        if (sectionId) {
            this.triggerEvent("badgeClick", "section", sectionId, hostId);
        }
        else if (conversationId) {
            this.triggerEvent("badgeClick", "conversation", conversationId, hostId);
        }
        else if (customElementId) {
            this.triggerEvent("badgeClick", "customElement", customElementId);
        }
        else if (hostId) {
            this.triggerEvent("badgeClick", "host", hostId, hostId);
        }
    }
    
    onVideoConfButtonClick(e: MouseEvent): void {
        e.stopPropagation();
        let sectionId = $(e.target).closest("[data-section-id]").data("section-id");
        let hostId = $(e.target).closest("[data-host-id]").data("host-id");
        let conversationId = $(e.target).closest("[data-conversation-id]").data("conversation-id");
        let customElementId = $(e.target).closest("[data-custom-element-id]").data("custom-element-id");
        if (sectionId) {
            this.triggerEvent("videoConfClick", "section", sectionId, hostId);
        }
        else if (conversationId) {
            this.triggerEvent("videoConfClick", "conversation", conversationId, hostId);
        }
        else if (customElementId) {
            this.triggerEvent("videoConfClick", "customElement", customElementId);
        }
    }

    handleSectionOrConversationCtrlClick(e: MouseEvent): void {
        if ($(e.currentTarget).closest(".window-filechooser").length > 0) {
            return;
        }
        for (let component of this.sidebarComponents) {
            component.clearDelayedClickTimeout();
        }
        this.hostList.clearDelayedClickTimeout();
        for (let rsl of Object.values(this.remoteSectionLists)) {
            rsl.clearDelayedClickTimeout();
        }
        for (let rcl of Object.values(this.remoteConv2Lists)) {
            rcl.clearDelayedClickTimeout();
        }
        let sectionId = $(e.target).closest("[data-section-id]").data("section-id");
        let hostId = $(e.target).closest("[data-host-id]").data("host-id");
        let conversationId = $(e.target).closest("[data-conversation-id]").data("conversation-id");

        let customElementId = $(e.target).closest("[data-custom-element-id]").data("custom-element-id");
        if (sectionId) {
            let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
            let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
            if (unreadBadgeClickAction != "ignore" && $(event.target).closest(".wi-element-badge.number").length > 0) {
                return;
            }
            this.triggerEvent("sectionOrConversationDoubleClick", "section", sectionId, hostId);
        }
        else if (conversationId) {
            let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
            let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
            if (unreadBadgeClickAction != "ignore" && $(event.target).closest(".unread-count.number").length > 0) {
                return;
            }

            this.triggerEvent("sectionOrConversationDoubleClick", "conversation", conversationId, hostId);
        }
    }
    
    onBadgeMouseEnter(e: MouseEvent): void {
        this.toggleBadgeParentHover(e, true);
    }
    
    onBadgeMouseLeave(e: MouseEvent): void {
        this.toggleBadgeParentHover(e, false);
    }
    
    onItemMouseEnter(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget).closest(".wi-element, .conversation-element");
        let $settingsBtn = $el.find(".settings-button");
        let $pinBtn = $el.find(".pin-button");
        this.clearExtraButtonsActivationTimeout();
        this.deactivateExtraButtons();
        this.extraButtonsActivationTimeout = <any>setTimeout(() => {
            this.$activeSettingsButton = $settingsBtn;
            $settingsBtn.addClass("active");
            this.$activePinButton = $pinBtn;
            $pinBtn.addClass("active");
        }, SidebarView.EXTRA_BUTTONS_ACTIVATION_DELAY);
    }
    
    onItemMouseLeave(): void {
        this.clearExtraButtonsActivationTimeout();
        this.deactivateExtraButtons();
    }
    
    clearExtraButtonsActivationTimeout(): void {
        if (this.extraButtonsActivationTimeout) {
            clearTimeout(this.extraButtonsActivationTimeout);
            this.extraButtonsActivationTimeout = null;
        }
    }
    
    deactivateExtraButtons(): void {
        if (this.$activeSettingsButton) {
            this.$activeSettingsButton.removeClass("active");
            this.$activeSettingsButton = null;
        }
        if (this.$activePinButton) {
            this.$activePinButton.removeClass("active");
            this.$activePinButton = null;
        }
    }
    
    onSortByOnlineButtonClick(): void {
        this.updateSortByOnlineButtonDisabledState();
        if (this.$container.find(".sort-by-online-button").hasClass("disabled")) {
            return;
        }
        this.triggerEvent("toggleSortByOnline");
    }
    
    updateSortByOnlineButtonDisabledState(): void {
        // let disabled = this.$container.find(".conv2-list").children(".present").length == 0;
        // this.$container.find(".sort-by-online-button").toggleClass("disabled", disabled);
    }
    
    setSortByOnlineButtonState(on: boolean): void {
        this.$container.find(".sort-by-online-button").toggleClass("on", on);
    }
    
    toggleBadgeParentHover(e: MouseEvent, isBadgeHover: boolean): void {
        let $parent = $(e.target).closest("[data-section-id], [data-conversation-id], [data-custom-element-id]");
        $parent.toggleClass("with-badge-hover", isBadgeHover);
    }
    
    onKeydown(event: KeyboardEvent): void {
        if (event.keyCode === KEY_CODES.upArrow) {
            this.moveCursorUp();
        }
        else if (event.keyCode === KEY_CODES.downArrow) {
            this.moveCursorDown();
        }
        else if (event.keyCode === KEY_CODES.enter) {
            this.cursorAction();
        }
    }
    
    getSelected(): JQuery {
        let $selected = this.$container.find(".selected");
        if ($selected.length > 0) {
            return $selected;
        }
        return this.$container.find(".active");
    }
    
    moveCursorUp() {
        let $selected = this.getSelected();
        let $parent = $selected.parent();
        let $children = $parent.children();
        let selectedIndex = $children.index($selected);
        let $newSelected = null;
        if (selectedIndex == 0) {
            let containers = this.sidebarContainers.map(x => x.get(0));
            let containerIndex = containers.indexOf($parent.get(0));
            while (containerIndex > 0) {
                $parent = $(containers[containerIndex - 1]);
                $children = $parent.children();
                if ($children.length == 0) {
                    containerIndex--;
                    continue;
                }
                selectedIndex = $children.length - 1;
                $newSelected = $($children.get(selectedIndex));
                break;
            }
        }
        else if (selectedIndex > 0) {
            $newSelected = $($children.get(selectedIndex - 1));
        }
        if ($newSelected != null) {
            $selected.removeClass("selected");
            $newSelected.addClass("selected");
            UI.scrollViewIfNeeded($parent.closest(".pf-content").get(0), $newSelected.get(0));
        }
    }
    
    moveCursorDown() {
        let $selected = this.getSelected();
        let $parent = $selected.parent();
        let $children = $parent.children();
        let selectedIndex = $children.index($selected);
        let $newSelected = null;
        if (selectedIndex == $children.length - 1) {
            let containers = this.sidebarContainers.map(x => x.get(0));
            let containerIndex = containers.indexOf($parent.get(0));
            while (containerIndex < containers.length - 1) {
                $parent = $(containers[containerIndex + 1]);
                $children = $parent.children();
                if ($children.length == 0) {
                    containerIndex++;
                    continue;
                }
                selectedIndex = 0;
                $newSelected = $($children.get(selectedIndex));
                break;
            }
        }
        else if (selectedIndex < $children.length - 1) {
            $newSelected = $($children.get(selectedIndex + 1));
        }
        if ($newSelected != null && $newSelected.length > 0) {
            $selected.removeClass("selected");
            $newSelected.addClass("selected");
            UI.scrollViewIfNeeded($parent.closest(".pf-content").get(0), $newSelected.get(0));
        }
    }
    
    cursorAction() {
        let $selected = this.getSelected();
        Lang.find(this.sidebarComponents, x => {
            return x.activateElement($selected);
        });
    }
    
    moveSelectionToActive() {
        this.$container.find(".pre-deactivate").removeClass("pre-deactivate");
        this.$container.find(".pre-activate").removeClass("pre-activate");
        this.$container.find(".selected").removeClass("selected");
        setTimeout(() => {
            this.$container.find(".selected").removeClass("selected");
            let $active = this.$container.find(".active");
            if ($active.length > 0) {
                $active.addClass("selected");
                UI.scrollViewIfNeeded($active.closest(".pf-content").get(0), $active.get(0));
            }
        }, 10);
    }

    preActivate(elementType: number, id: string): void {
        let elBaseClass: string;
        let elIdPlaceholder: string;

        if (elementType == SidebarElementType.SECTION || elementType == SidebarElementType.REMOTE_SECTION) {
            elBaseClass = ".section-element";
            elIdPlaceholder = "section-id";
        }
        else
        if (elementType == SidebarElementType.CONVERSATION || elementType == SidebarElementType.REMOTE_CONVERSATION) {
            elBaseClass = ".conversation-element";
            elIdPlaceholder = "conversation-id";
        }
        else {
            return;
        }

        let $clickedElement = this.$container.find(elBaseClass + "[data-" + elIdPlaceholder + "='"+id+"']");
        let $activeElement = this.$container.find(".active");

        if ($clickedElement.data(elIdPlaceholder) == $activeElement.data(elIdPlaceholder)) {
            return;
        }

        $activeElement.addClass("pre-deactivate");
        $clickedElement.addClass("pre-activate");
    }
    
    refreshInfoTooltips(): void {
        if (this.infoTooltip) {
            this.infoTooltip.init(this.$container);
        }
    }
    
    toggleCustomElements(toggle: boolean): void {
        this.$container.find(".custom-element-list").css("display", toggle ? "none" : "block");
        this.$container.find(".custom-section-list").css("display", toggle ? "block" : "none");
    }
    
    attachBubblesHint($el: JQuery, area: "section"|"conv2"): void {
        let $hintUp = $('<div class="bubbles-hint bubbles-hint-up has-basic-tooltip" data-basic-id="scroll-to-bubbles-up"><i class="fa fa-caret-up"></i></div>');
        let $hintDown = $('<div class="bubbles-hint bubbles-hint-down has-basic-tooltip" data-basic-id="scroll-to-bubbles-down"><i class="fa fa-caret-down"></i></div>');
        $hintUp.on("click", () => this.onBubblesHintClick($el, "up"));
        $hintDown.on("click", () => this.onBubblesHintClick($el, "down"));
        if (area == "section") {
            $el.on("scroll", () => this.updateSectionScrollableBubbleElements());
        }
        else {
            $el.on("scroll", () => this.updateConv2ScrollableBubbleElements());
        }
        if ((<any>window).ResizeObserver) {
            const debouncer = new Debouncer(() => {
                if (area == "section") {
                    this.updateSectionScrollableBubbleElements();
                }
                else {
                    this.updateConv2ScrollableBubbleElements();
                }
            }, 100);
            let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                debouncer.trigger();
            });
            resizeObserver.observe($el[0]);
        }
        $el.data("scroll-area", area);
        $el.prepend($hintUp).append($hintDown);
    }
    
    updateBubblesHint($el: JQuery, pfScroll: PfScrollExperimental): void {
        let $hintUp = $el.children(".bubbles-hint-up");
        let $hintDown = $el.children(".bubbles-hint-down");
        let showHintUp = false;
        let showHintDown = false;
        let hasBubblesInView = this.hasBubbles($el, "visible", pfScroll);
        if (!hasBubblesInView) {
            showHintUp = this.hasBubbles($el, "up", pfScroll);
            showHintDown = this.hasBubbles($el, "down", pfScroll);
        }
        $hintUp[0].style.opacity = showHintUp ? "1" : "0";
        $hintUp[0].style.pointerEvents = showHintUp ? "auto" : "none";
        $hintDown[0].style.opacity = showHintDown ? "1" : "0";
        $hintDown[0].style.pointerEvents = showHintDown ? "auto" : "none";
    }
    
    onBubblesHintClick($el: JQuery, dir: "up"|"down"): void {
        let scrollArea = $el.data("scroll-area");
        let arr = scrollArea == "conv2" ? this.conv2ScrollableBubbleElements : this.sectionScrollableBubbleElements;
        arr = dir == "up" ? arr.slice().reverse() : arr.slice();
        let el: BubbleElement = null;
        for (let it of arr) {
            if (!it.isMuted) {
                el = it;
                break;
            }
        }
        if (el) {
            let margin = -50;
            let top = el.at + margin;
            top = Math.max(0, top);
            top = Math.min($el[0].scrollHeight - $el[0].clientHeight, top);
            $el[0].scrollTo(undefined, top);
        }
    }
    
    hasBubbles($el: JQuery, area: "up"|"down"|"visible", pfScroll: PfScrollExperimental): boolean {
        return !!this.findClosestBubbleElement($el, area, pfScroll);
    }
    
    findClosestBubbleElement($el: JQuery, area: "up"|"down"|"visible", pfScroll: PfScrollExperimental): BubbleElement {
        let scrollArea = $el.data("scroll-area");
        let els = scrollArea == "conv2" ? this.conv2ScrollableBubbleElements : this.sectionScrollableBubbleElements;
        if (area == "down") {
            els = els.slice().reverse();
        }
        let visibleRange = pfScroll.visibleRange;
        let range: number[] = [];
        if (area == "up") {
            range = [-9999999, visibleRange[0]];
        }
        else if (area == "down") {
            range = [visibleRange[1], 9999999];
        }
        else {
            range = visibleRange;
        }
        for (let el of els) {
            if (el.isMuted) {
                continue;
            }
            if (el.at >= (range[0] - 8) && el.at <= (range[1] + 8)) {
                return el;
            }
        }
        return null;
    }
    
    updateSectionScrollableBubbleElements(): void {
        this.updateScrollableBubbleElements(this.$sectionScrollable, this.sectionPfScroll, this.sectionVisibilityObserver);
    }
    
    updateConv2ScrollableBubbleElements(): void {
        this.updateScrollableBubbleElements(this.$conv2Scrollable, this.conv2PfScroll, this.conv2VisibilityObserver);
    }
    
    updateScrollableBubbleElements($el: JQuery, pfScroll: PfScrollExperimental, visibilityObserver: VisibilityObserver): void {
        if (!$el) {
            return;
        }
        if (!visibilityObserver.isTargetVisible) {
            visibilityObserver.addSingleShotCallback((visible: boolean) => {
                if (visible) {
                    this.updateScrollableBubbleElements($el, pfScroll, visibilityObserver);
                }
            });
            return;
        }
        this.updateBubblesHint($el, pfScroll);
    }
    
    updateSectionScrollableBubbleElementsCache(): void {
        this.updateScrollableBubbleElementsCache(this.$sectionScrollable, this.sectionPfScroll, this.sectionVisibilityObserver);
    }
    
    updateConv2ScrollableBubbleElementsCache(): void {
        this.updateScrollableBubbleElementsCache(this.$conv2Scrollable, this.conv2PfScroll, this.conv2VisibilityObserver);
    }
    
    updateScrollableBubbleElementsCache($el: JQuery, pfScroll: PfScrollExperimental, visibilityObserver: VisibilityObserver): void {
        if (!$el) {
            return;
        }
        if (!visibilityObserver.isTargetVisible) {
            visibilityObserver.addSingleShotCallback((visible: boolean) => {
                if (visible) {
                    this.updateScrollableBubbleElements($el, pfScroll, visibilityObserver);
                }
            });
            return;
        }
        let arr: BubbleElement[] = [];
        let $els = $el.find(".wi-element.with-badge, .conversation-element.unread");
        $els.each((_, el) => {
            let $el = $(el);
            let badgeEl = $el.find(".wi-element-badge.number, .unread-count.number")[0];
            if (badgeEl) {
                arr.push({
                    $sidebarElement: $el,
                    at: el.offsetTop + badgeEl.offsetTop + badgeEl.clientHeight / 2,
                    isMuted: $el.hasClass("muted"),
                });
            }
        });
        
        let scrollArea = $el.data("scroll-area");
        if (scrollArea == "conv2") {
            this.conv2ScrollableBubbleElements = arr;
        }
        else {
            this.sectionScrollableBubbleElements = arr;
        }
    }

    setSectionsLimitReached(value: boolean) {
        this.$container.find("[data-sidebar-button-id=new-section]").toggleClass("hide", value);
    }

    showHostLoading(hostHash: string, visible: boolean): void {
        let $hostElement = this.$container.find(".host-element[data-host-id='" + hostHash + "']");
        let $loading = $hostElement.find(".loading");
        $loading.toggleClass("hide", !visible);
        $loading.children("i").toggleClass("fa-spin", visible);
    }
    
    toggleBellState(sectionId: string, converationId: string, isRinging: boolean): void {
        let $el: JQuery;
        if (sectionId) {
            $el = this.$container.find(`[data-section-id="${sectionId}"]`);
        }
        else {
            $el = this.$container.find(`[data-conversation-id="${converationId}"]`);
        }
        $el.toggleClass("ringing", isRinging);
    }
    
    updateActiveConferences(conferencesStr: string, localHostHash: string): void {
        let conferences: ActiveVideoConferencesInfo = JSON.parse(conferencesStr);
        
        this.$container.find(".with-active-video-conference").removeClass("with-active-video-conference");
        
        for (let hostHash in conferences) {
            let conference = conferences[hostHash];
            let isLocal = hostHash == localHostHash;
            for (let sectId of conference.sectionIds) {
                if (isLocal) {
                    this.sectionList.sections.$container.find(`.section-element[data-section-id="${sectId}"]`).addClass("with-active-video-conference");
                    this.customSectionList.sections.$container.find(`.section-element[data-section-id="${sectId}"]`).addClass("with-active-video-conference");
                }
                else {
                    let sectionList = this.remoteSectionLists[hostHash];
                    if (sectionList) {
                        sectionList.sections.$container.find(`.section-element[data-section-id="${sectId}"]`).addClass("with-active-video-conference");
                    }
                }
            }
            for (let convId of conference.conversationIds) {
                if (isLocal) {
                    this.conv2List.conversations.$container.find(`.conversation-element[data-conversation-id="${convId}"]`).addClass("with-active-video-conference");
                }
                else {
                    let conv2List = this.remoteConv2Lists[hostHash];
                    if (conv2List) {
                        conv2List.conversations.$container.find(`.conversation-element[data-conversation-id="${convId}"]`).addClass("with-active-video-conference");
                    }
                }
            }
        }
    }
    
}
