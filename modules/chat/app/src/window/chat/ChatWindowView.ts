import {component, webUtils, window as wnd, Q, JQuery as $, Types, Logger as RootLogger} from "pmc-web";
import {ChatMessagesView} from "../../component/chatmessages/ChatMessagesView";
import {func as mainTemplate} from "./template/main.html";
import {Model, ActiveElementInfo} from "./ChatWindowController";
import { PrivateConversationsView } from "../../component/privateconversations/PrivateConversationsView";
import { NoSectionsView } from "../../component/nosections/NoSectionsView";
let Logger = RootLogger.get("chat-plugin.window.chat.ChatWindowView");

export enum FocusedElement {
    SIDEBAR,
    MESSAGES
}

export interface HostEntryModel {
    host: string;
    sectionsList: component.remotesectionlist.RemoteSectionListView;
    conv2List: component.remoteconv2list.RemoteConv2ListView;
}

export class ChatWindowView extends wnd.base.BaseAppWindowView<Model> {
    static readonly SIDEBAR_MIN_WIDTH = 100;
    static readonly MESSAGESLIST_MIN_WIDTH = 400;

    sidebar: component.sidebar.SidebarView;
    loading: component.loading.LoadingView;
    sectionsSplitter: component.splitter.SplitterView;
    messages: {[id: string]: ChatMessagesView};
    remoteServers: {[hostHash: string]: HostEntryModel};
    active: ChatMessagesView | PrivateConversationsView | component.disabledsection.DisabledSectionView | NoSectionsView;
    personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    isCtrlKeyDown: boolean = false;
    dragDrop: component.dragdrop.DragDrop;
    lastAction: ActiveElementInfo;
    $chatMessagesContainer: JQuery;
    privateConversations: PrivateConversationsView;
    noSections: NoSectionsView;
    $privateConversationsContainer: JQuery;
    $noSectionsContainer: JQuery;

    disabledSection: component.disabledsection.DisabledSectionView;
    $disabledSectionContainer: JQuery;

    isSearchOn: boolean = false;
    sectionTooltip: component.sectiontooltip.SectionTooltipView;
    userActionTimer: any;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        
        this.sectionsSplitter = this.addComponent("sectionsSplitter", new component.splitter.SplitterView(this, {
          firstPanelMinSize: ChatWindowView.SIDEBAR_MIN_WIDTH,
          secondPanelMinSize: () => {
              return ChatWindowView.MESSAGESLIST_MIN_WIDTH
          },
            type: "vertical",
            handlePlacement: "right",
            handleDot: true,
        }));
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));
        this.personTooltip = new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        this.messages = {};
        this.sidebar = this.addComponent("sidebar", new component.sidebar.SidebarView(this, {
            conv2List: {
                personsView: this.personsComponent,
                extList: {
                    template: null
                }
            },
            conv2Splitter: null,
            customElementList: {
                extList: {
                    template: null
                }
            },
            sectionList: {
                extList: {
                    template: null
                }
            },
            customSectionList: {
                extList: {
                    template: null
                }
            }
        }));
        this.privateConversations = this.addComponent("private-conversations", new PrivateConversationsView(this));
        this.disabledSection = this.addComponent("disabled-section", new component.disabledsection.DisabledSectionView(this));
        this.noSections = this.addComponent("no-sections", new NoSectionsView(this));

        this.sectionTooltip = this.addComponent("sectiontooltip", new component.sectiontooltip.SectionTooltipView(this));
        this.loading = this.addComponent("loading", new component.loading.LoadingView(this));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.turnTimeAgoRefresher();
            this.$body.on("mousemove click keydown", this.onUserAction.bind(this));
            this.$body.on("keydown", this.onKeydown.bind(this));
            this.$body.on("click", ":not(.emoji-btn)", this.hideEmojiPicker.bind(this));
            $(window).on("resize", this.onResize.bind(this));
            this.personsComponent.$main = this.$main;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this.sectionsSplitter.$container = this.$mainContainer;
            return this.sectionsSplitter.triggerInit();
        })
        .then(() => {
            this.$chatMessagesContainer = $("<div class='section-chats'></div>");
            this.$privateConversationsContainer = $("<div class='messages-container private' style='" + this.getDefaultHideStyle(false) + "'></div>");
            this.$noSectionsContainer = $("<div class='messages-container no-sections' style='" + this.getDefaultHideStyle(false) + "'></div>");
            this.$disabledSectionContainer = $("<div class='messages-container disabled-section' style='" + this.getDefaultHideStyle(false) + "'></div>");
            this.$chatMessagesContainer.append(this.$privateConversationsContainer);
            this.$chatMessagesContainer.append(this.$noSectionsContainer);
            this.$chatMessagesContainer.append(this.$disabledSectionContainer);
            this.sectionsSplitter.$right.append(this.$chatMessagesContainer);
            this.sectionsSplitter.$left.addClass("sidebar-container");
            this.sidebar.$container = this.sectionsSplitter.$left;
            return this.sidebar.triggerInit();
        })
        .then(() => {
            this.privateConversations.$container = this.$privateConversationsContainer;
            return this.privateConversations.triggerInit();
        })
        .then(() => {
            this.noSections.$container = this.$noSectionsContainer;
            return this.noSections.triggerInit();
        })
        .then(() => {
            this.disabledSection.$container = this.$disabledSectionContainer;
            return this.disabledSection.triggerInit();
        })
        .then(() => {
            this.personTooltip.init(this.$main);
            return this.activateMessages(model.activeElementInfo);
        })
        .then(() => {
            this.loading.$container = this.$chatMessagesContainer;
            return this.loading.triggerInit();
        })
        .then(() => {
            this.personsComponent.refreshAvatars();
            this.refreshFocus();

            this.sectionTooltip.refreshAvatars = this.refreshAvatars.bind(this);
            this.sidebar.usersListTooltip.refreshAvatars = this.refreshAvatars.bind(this);
            this.sectionTooltip.$container = this.$main;
            return this.sectionTooltip.triggerInit();
        })

    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    getDefaultHideStyle(toggle: boolean): string {
        const HIDE_TYPE: string = "display";
        if (HIDE_TYPE == "visibility") {
            return toggle ? "visibility: visible": "visibility: hidden;";
        }
        else
        if (HIDE_TYPE == "display") {
            return toggle ? "display: block" : "display: none;";
        }
    }
    
    toggleContainer($container:  JQuery<HTMLElement>, toggle: boolean): void {
        const HIDE_TYPE: string = "display";
        let value: string;
        if (HIDE_TYPE == "visibility") {
            value = toggle ? "visible": "hidden";
        }
        else
        if (HIDE_TYPE == "display") {
            value = toggle ? "block" : "none";
        }
        $container.css(HIDE_TYPE, value);
    }
    
    openPrivateConversations(): void {
        if (this.active) {
            this.toggleContainer(this.active.$container, false);
            this.active.onDeactivate();
        }
        this.active = this.privateConversations;
        this.toggleContainer(this.active.$container, true);
    }

    openNoSections(): void {
        if (this.active) {
            this.toggleContainer(this.active.$container, false);
            this.active.onDeactivate();
        }
        this.active = this.noSections;
        this.toggleContainer(this.active.$container, true);
    }


    openDisabledSectionView(): void {
        if (this.active) {
            this.toggleContainer(this.active.$container, false);
            this.active.onDeactivate();
        }
        this.active = this.disabledSection;
        this.toggleContainer(this.active.$container, true);

    }

    
    activateMessages(element: ActiveElementInfo): Q.Promise<void> {
        this.loading.onStartLoading();
        this.lastAction = element;
        if (!element || !element.elementId) {
            this.loading.hideLoading();
            return;
        }
        let id = element.conversationId || element.channelId;
        if (id == null) {
            if (this.active) {
                // this.active.$container.css("visibility", "hidden");
                this.toggleContainer(this.active.$container, false);
                this.active.onDeactivate();
                this.active = null;
            }
            return;
        }
        if (!(id in this.messages)) {
            this.messages[id] = this.addComponent(id, new ChatMessagesView(this, this.personsComponent));
            this.messages[id].userActionsEnabled = false;
            this.messages[id].$container = $('<div class="messages-container chat-messages-component" style="' + this.getDefaultHideStyle(false) + '"></div>');
            this.$chatMessagesContainer.append(this.messages[id].$container);
        }
        
        return this.messages[id].triggerInit().then(() => {
            if (this.lastAction != element) {
                return;
            }
            if (this.active) {
                // this.active.$container.css("visibility", "hidden");
                this.toggleContainer(this.active.$container, false);
                this.active.onDeactivate();
            }
            this.active = this.messages[id];
            this.dragDrop = new component.dragdrop.DragDrop(this, this.active.$container.find(".chat").parent().parent());
            // this.active.$container.css("visibility", "visible");
            this.toggleContainer(this.active.$container, true);
            
            this.active.rewind();
            this.active.updateSettinsMenu(element.guiSettings);
            this.active.updateViewSettingsMenu(element.viewSettings);
            this.active.onActivate();
            this.refreshFocus();
        })
        .fail(e => {
            Logger.error("Cannot create messsages", e);
        })
        .fin(() => {
            this.loading.hideLoading();
        })
    }
    
    onResize(): void {
        this.sectionsSplitter.redraw();
    }
    
    onUserAction() {
        // onUserAction podpiety jest do eventa mousemove, wiec dodany jest debouncer (1000 ms)
        if (this.userActionTimer == null) {
            this.userActionTimer = setTimeout(() => {
                this.triggerEvent("userAction");
                clearTimeout(this.userActionTimer);
                this.userActionTimer = null;
            }, 1000);
        }
    }
    
    getFocusedElement(): FocusedElement {
        let $ae = $(document.activeElement);
        if ($ae.closest(".sidebar-container").length > 0) {
            return FocusedElement.SIDEBAR;
        }
        if ($ae.closest(".section-chats").length > 0) {
            return FocusedElement.MESSAGES;
        }
        return null;
    }
    
    refreshFocus() {
        let fe = this.getFocusedElement();
        if (fe == FocusedElement.MESSAGES) {
            if ($(document.activeElement).closest(".messages-container").get(0) != this.active.$container.get(0)) {
                this.focusMessages();
            }
        }
        else if (fe == null) {
            this.sidebar.$container.focus();
        }
    }
    
    focusMessages() {
        this.active.$container.focus();
        setTimeout(() => {
            let $el = this.active.$container.find(".reply-field");
            $el.focus();
            this.helper.placeInputCaretAtEnd($el.get(0), document);
        }, 0);
    }
    
    onKeydown(event: KeyboardEvent): void {
        if (event.keyCode == webUtils.KEY_CODES.tab && !(event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            let fe = this.getFocusedElement();
            if (fe == FocusedElement.SIDEBAR) {
                this.switchToPanel(FocusedElement.MESSAGES, true);
            }
            else {
                this.switchToPanel(FocusedElement.SIDEBAR, true);
            }
        }
    }
    
    grabFocus(highlight: boolean = true): void {
        let fe = this.getFocusedElement();
        this.switchToPanel(fe == null ? FocusedElement.SIDEBAR : fe, highlight);
    }
    
    switchToPanel(fe: FocusedElement, showHighlight: boolean) {
        this.$main.find(".focus-hightlight").remove();
        let $highlight = $('<div class="focus-hightlight"></div>');
        let currentFe = this.getFocusedElement();
        
        if (showHighlight && currentFe != fe) {
            if (fe == FocusedElement.SIDEBAR) {
                if (this.active) {
                    this.active.blurInputFocus();
                }
                this.sidebar.$container.focus();
                this.$main.find(".sidebar-container").append($highlight);
                //TODO: If there is no selected element in sidebar then select first one
            }
            else if (fe == FocusedElement.MESSAGES) {
                this.active.$container.find(".chat").parent().parent().append($highlight);
                this.focusMessages();
            }
        }
        setTimeout(() => {
            $highlight.remove();
        }, 500);
    }
    
    hideEmojiPicker(e: MouseEvent): void {
        e.stopPropagation();
        if (this.active instanceof component.disabledsection.DisabledSectionView) {
            return;
        }
        if (this.active instanceof PrivateConversationsView) {
            return;
        }
        if ($(e.target).hasClass("emoji-btn")) {
            return;
        }
        this.dispatchEvent({type: "hide-emoji-picker"});
    }
    
    changeIsSearchOn(isOn: boolean): void {
        this.isSearchOn = isOn;
        this.sidebar.$container.toggleClass("search-on", isOn);
        this.sidebar.refreshInfoTooltips();
    }
    
    expandRemoteSectionsList(host: string, hostHash: string): void {
        if (this.isRemoteHostVisible(hostHash)) {
            this.toggleRemoteHost(hostHash, false);
            return;
        }
        let $hostElement: JQuery<HTMLElement>;
        this.sidebar.showHostLoading(hostHash, false);
        Q().then(() => {
            if (! this.remoteServers) {
                this.remoteServers = {};
            }
            if (hostHash in this.remoteServers) {
                return;
            }
            $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");

            if (! this.remoteListsExists(hostHash)) {
                return Q().then(() => {
                    $hostElement.parent().append($("<div class='remote-sections' data-host-id='" + hostHash + "'></div>"));
                    $hostElement.parent().append($("<div class='remote-conversations' data-host-id='" + hostHash + "'></div>"));
        
                    let hostModel: HostEntryModel = {
                        host: host,
                        sectionsList: this.addComponent("remoteSectionsList-" + hostHash, new component.remotesectionlist.RemoteSectionListView(this, {
                            extList: {template: null}
                        })),
                        conv2List: this.addComponent("remoteConv2List-" + hostHash, new component.remoteconv2list.RemoteConv2ListView(this, {
                            personsView: this.personsComponent,
                            extList: {template: null}
                        }))
                    };
                    hostModel.sectionsList.sections.$container = $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']");
                    hostModel.conv2List.conversations.$container = $hostElement.parent().find(".remote-conversations[data-host-id='" + hostHash + "']");
                    
                    this.sidebar.remoteSectionLists[hostHash] = hostModel.sectionsList;
                    this.sidebar.remoteConv2Lists[hostHash] = hostModel.conv2List;
                    
                    this.remoteServers[hostHash] = hostModel;
                    return Q.all([
                        hostModel.sectionsList.triggerInit(),
                        hostModel.conv2List.triggerInit()
                    ]);
                })
            }
        })
        .then(() => {
            this.toggleRemoteHost(hostHash, true);
        })
    }

    toggleRemoteHost(hostHash: string, visible: boolean) {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']").toggleClass("hide", !visible);
        $hostElement.parent().find(".remote-conversations[data-host-id='" + hostHash + "']").toggleClass("hide", !visible);
        this.sidebar.hostList.toggleHostElementIsExpanded(hostHash, visible);
    }

    isRemoteHostVisible(hostHash: string): boolean {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        return ! $hostElement.find(".fa.expanded").hasClass("hide");
    }

    remoteListsExists(hostHash: string): boolean {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        let remoteSectionsExists = $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']").length > 0;
        return remoteSectionsExists;
    }
}
