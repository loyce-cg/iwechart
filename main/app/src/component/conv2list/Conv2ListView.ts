import {ComponentView} from "../base/ComponentView";
import {ExtListView, Options as ExtListOptions} from "../extlist/ExtListView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {PersonsView} from "../persons/PersonsView";
import {func as listElementTemplate} from "../template/conversation.html";
import * as Types from "../../Types";
import {webUtils} from "../../Types";
import * as $ from "jquery";
import { SectionListView } from "../sectionlist/SectionListView";
import { InfoTooltip } from "../infotooltip/InfoTooltip";
import { SidebarView } from "../sidebar/SidebarView";

export interface Conv2ListOptions {
    personsView: PersonsView;
    extList: ExtListOptions<Types.webUtils.ConversationModel, void, MailClientViewHelper>;
    
}

export interface Conv2ClickEvent extends Types.event.Event<boolean> {
    type: "conv2click";
    conv2Id: string;
}

export class Conv2ListView extends ComponentView {
    
    conversations: ExtListView<Types.webUtils.ConversationModel>;
    baseOnAfterRenderContactList: Function;
    personsTooltip: InfoTooltip;
    protected _delayedClickTimeout: number = null;

    doubleClickEvents: {[id: string]: number} = {};

    constructor(
        parent: Types.app.ViewParent,
        public options: Conv2ListOptions
    ) {
        super(parent);
        this.baseOnAfterRenderContactList = this.options.extList.onAfterListRender;
        let origOnAfterListRender = this.options.extList.onAfterListRender;
        this.options.extList.onAfterListRender = view => {
            if (origOnAfterListRender) {
                origOnAfterListRender(view);
            }
            this.onAfterRenderContactList();
        };
        this.options.extList.template = this.options.extList.template || listElementTemplate;
        this.conversations = this.addComponent("conversations", new ExtListView(this, this.options.extList));
        this.personsTooltip = this.addComponent("infoTooltip", new InfoTooltip(this));
        PersonsView.fixAvatarRenderInExtListUpdate(this.conversations);
    }
    
    init(): Q.Promise<void> {
        this.conversations.$container.on("click", "[data-conversation-id]", this.onConv2Click.bind(this));
        // this.conversations.$container.on("dblclick", "[data-conversation-id]", this.onConv2DblClick.bind(this));

        return this.conversations.triggerInit();
    }
    
    onAfterRenderContactList(): void {
        this.personsTooltip.init(this.conversations.$container);
        this.options.personsView.refreshAvatars();
        if (this.baseOnAfterRenderContactList) {
            this.baseOnAfterRenderContactList();
        }
    }
    
    // onConv2DblClick(event: MouseEvent) {
    //     console.log("dblCLick performed");
    //     this.doubleClickPerformed = true;
    //     this.clearDelayedClickTimeout();
    // }

    // checkDblClick(id: string): boolean {
    //     if ((id in this.doubleClickEvents) && this.doubleClickEvents[id] > 1) {
    //         this.resetDblClick(id);
    //         return true;
    //     } else {
    //         if (!(id in this.doubleClickEvents)) {
    //             this.doubleClickEvents[id] = 1;
    //         }
    //         else {
    //             this.doubleClickEvents[id]++;
    //         }
    //         return false;
    //     }
    // }

    // resetDblClick(id: string): void {
    //     if (id in this.doubleClickEvents) {
    //         delete this.doubleClickEvents[id];
    //     }
    //     clearTimeout(this._dblClickTimeout);
    //     this._dblClickTimeout = null;
    // }


    onConv2Click(event: MouseEvent): void {
        this.clearDelayedClickTimeout();
        let conv2Id = $(event.target).closest("[data-conversation-id]").data("conversation-id");

        if (event.ctrlKey || event.metaKey) {
            if (this.parent instanceof SidebarView) {
                this.parent.handleSectionOrConversationCtrlClick(event);
            }
            return;
        }
        
        // if(this.checkDblClick(conv2Id)) {
        //     this.resetDblClick(conv2Id);
        //     return;
        // }


        let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (unreadBadgeClickAction != "ignore" && $(event.target).closest(".unread-count.number").length > 0) {
            if (unreadBadgeUseDoubleClick) {
                this._delayedClickTimeout = <any>setTimeout(() => {
                    this.activateConv2(conv2Id);
                }, SectionListView.SINGLE_CLICK_DELAY);
            }
            return;
        }

        // if (!this._dblClickTimeout) {
        //     this._dblClickTimeout = setTimeout(() => {
        //         if (this.checkDblClick(conv2Id)) {
        //             this.resetDblClick(conv2Id);
        //             return;
        //         }
        //         this.resetDblClick(conv2Id);
        //         this.activateConv2(conv2Id)
        //     }, SectionListView.DOUBLE_CLICK_FAST);    
        // }


        if ($(event.target).closest(".settings-button.active").length > 0) {
            this.triggerEvent("openSettings", conv2Id);
            return;
        }
        if ($(event.target).closest(".pin-button.active").length > 0) {
            this.triggerEvent("togglePinned", conv2Id, !$(event.target).closest(".pin-button.active").hasClass("pinned"));
            return;
        }
        this.activateConv2(conv2Id);
    }
    
    activateConv2(conv2Id: string): void {
        let result = this.dispatchEventResult(<Conv2ClickEvent>{
            type: "conv2click",
            conv2Id: conv2Id,
        });
        if (result !== false) {
            this.triggerEvent("activateConv2", conv2Id);
        }
    }
    
    clearDelayedClickTimeout(): void {
        if (this._delayedClickTimeout) {
            clearTimeout(this._delayedClickTimeout);
            this._delayedClickTimeout = null;
        }
    }
    
    getContainer(): JQuery {
        return this.conversations.$container;
    }
    
    isElement($ele: JQuery): boolean {
        return $ele.parent().get(0) == this.conversations.$container.get(0);
    }
    
    activateElement($ele: JQuery): boolean {
        if (!this.isElement($ele)) {
            return false;
        }
        let conv2Id = $ele.data("conversation-id");
        this.triggerEvent("activateConv2", conv2Id);
        return true;
    }
    
    updateSidebarSpinners(statesStr: string): void {
        let states: { [id: string]: boolean } = JSON.parse(statesStr);
        for (let id in states) {
            let state = states[id];
            let $badge: JQuery;
            let width: string;
            $badge = this.conversations.$container.children(`.conversation-element[data-conversation-id="${id}"]`).find(".unread-count.number");
            width = state ? ($badge.outerWidth() || 0).toString() : "initial";
            $badge.css("width", width).toggleClass("with-spinner", state);
        }
    }
    
    setPinned(conversationId: string, pinned: boolean): void {
        this.conversations.$container.children(`.conversation-element[data-conversation-id="${conversationId}"]`)
            .find(".pin-button").toggleClass("pinned", pinned).toggleClass("not-pinned", !pinned);
    }
    
    toggleBellState(conversationId: string, isRinging: boolean): void {
        this.conversations.$container.children(`.conversation-element[data-conversation-id="${conversationId}"]`)
            .toggleClass("with-voice-chat-active", !isRinging).toggleClass("with-bell-ringing", !!isRinging)
    }
    
    toggleVoiceChatActive(conversationId: string, active: boolean, usersStr: string): void {
        
        let $element = this.conversations.$container.children(`.conversation-element[data-conversation-id="${conversationId}"]`);
        $element.toggleClass("with-voice-chat-active", active);


    }
}