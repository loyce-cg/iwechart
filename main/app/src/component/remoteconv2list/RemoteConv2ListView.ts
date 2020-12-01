import {ComponentView} from "../base/ComponentView";
import {ExtListView, Options as ExtListOptions} from "../extlist/ExtListView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {PersonsView} from "../persons/PersonsView";
import {func as listElementTemplate} from "../template/conversation.html";
import * as Types from "../../Types";
import * as $ from "jquery";
import { SectionListView } from "../sectionlist/SectionListView";
import { Conv2ListView } from "../conv2list/Conv2ListView";

export interface Conv2ListOptions {
    personsView: PersonsView;
    extList: ExtListOptions<Types.webUtils.ConversationModel, void, MailClientViewHelper>;
}

export interface RemoteConv2ClickEvent extends Types.event.Event<boolean> {
    type: "remoteconv2click";
    conv2Id: string;
}

export class RemoteConv2ListView extends ComponentView {
    
    conversations: ExtListView<Types.webUtils.ConversationModel>;
    baseOnAfterRenderContactList: Function;
    protected _delayedClickTimeout: number = null;
    
    
    activateConv2(conv2Id: string): void {
        let result = this.dispatchEventResult(<RemoteConv2ClickEvent>{
            type: "remoteconv2click",
            conv2Id: conv2Id,
        });
        if (result !== false) {
            this.triggerEvent("activateConv2", conv2Id);
        }
    }

    constructor(
        parent: Types.app.ViewParent,
        public options: Conv2ListOptions
    ) {
        super(parent);
        this.baseOnAfterRenderContactList = this.options.extList.onAfterListRender;
        this.options.extList.onAfterListRender = this.onAfterRenderContactList.bind(this);
        this.options.extList.template = this.options.extList.template || listElementTemplate;
        this.conversations = this.addComponent("conversations", new ExtListView(this, this.options.extList));
        
        PersonsView.fixAvatarRenderInExtListUpdate(this.conversations);
    }
    
    init(): Q.Promise<void> {
        this.conversations.$container.on("click", "[data-conversation-id]", this.onConv2Click.bind(this));
        return this.conversations.triggerInit();
    }
    
    onAfterRenderContactList(): void {
        this.options.personsView.refreshAvatars();
        if (this.baseOnAfterRenderContactList) {
            this.baseOnAfterRenderContactList();
        }
    }
    
    onConv2Click(event: MouseEvent): void {
        //event.stopPropagation();
        this.clearDelayedClickTimeout();
        let conv2Id = $(event.target).closest("[data-conversation-id]").data("conversation-id");
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
    
    setPinned(sectionId: string, pinned: boolean): void {
        this.conversations.$container.children(`.conversation-element[data-conversation-id="${sectionId}"]`)
            .find(".pin-button").toggleClass("pinned", pinned).toggleClass("not-pinned", !pinned);
    }
}