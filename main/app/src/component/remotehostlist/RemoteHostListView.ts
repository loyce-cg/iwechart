import {ComponentView} from "../base/ComponentView";
import {ExtListView, Options as ExtListOptions} from "../extlist/ExtListView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {func as listElementTemplate} from "../template/remotehost.html";
import * as Types from "../../Types";
import * as $ from "jquery";
import { SectionListView } from "../sectionlist/SectionListView";

export interface HostListOptions {
    extList: ExtListOptions<Types.webUtils.HostListElementModel, void, MailClientViewHelper>;
}

export interface HostClickEvent extends Types.event.Event<boolean> {
    type: "hostclick";
    hostId: string;
}

export class RemoteHostListView extends ComponentView {
    
    hosts: ExtListView<Types.webUtils.HostListElementModel>;
    protected _delayedClickTimeout: number = null;
    
    constructor(
        parent: Types.app.ViewParent
    ) {
        super(parent);
        this.hosts = this.addComponent("hosts", new ExtListView(this, {
            template: listElementTemplate,
            onAfterListRender: () => {},
        }));
    }
    
    init(): Q.Promise<void> {
        // console.log("init remoteHostList view");
        this.hosts.$container.on("click", "[data-host-id]", this.onHostClick.bind(this));
        return this.hosts.triggerInit()
        .then(() => {
            // console.log("hosts view initialized");
            // console.log(this.hosts.$container);
            return;
        })
    }
    
    onHostClick(event: MouseEvent): void {
        this.clearDelayedClickTimeout();
        let sectionId = $(event.target).closest("[data-section-id]").data("section-id");
        let conv2Id = $(event.target).closest("[data-conversation-id]").data("conversation-id");
        if (sectionId || conv2Id) {
            return;
        }
        let $el = $(event.target).closest("[data-host-id]");
        let hostId = $el.data("host-id");
        let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (unreadBadgeClickAction != "ignore" && $(event.target).closest(".wi-element-badge.number").length > 0) {
            if (unreadBadgeUseDoubleClick) {
                this._delayedClickTimeout = <any>setTimeout(() => {
                    this.activateHost(hostId);
                }, SectionListView.SINGLE_CLICK_DELAY);
            }
            return;
        }
        this.activateHost(hostId);
    }
    
    activateHost(hostId: string): void {
        let result = this.dispatchEventResult(<HostClickEvent>{
            type: "hostclick",
            hostId: hostId
        });
        if (result !== false) {
            this.triggerEvent("activateHost", hostId);
        }
    }
    
    clearDelayedClickTimeout(): void {
        if (this._delayedClickTimeout) {
            clearTimeout(this._delayedClickTimeout);
            this._delayedClickTimeout = null;
        }
    }
    
    getContainer(): JQuery {
        return this.hosts.$container;
    }
    
    isElement($ele: JQuery): boolean {
        return $ele.parent().get(0) == this.hosts.$container.get(0);
    }
    
    activateElement($ele: JQuery): boolean {
        // console.log("activate element called", $ele);
        if (!this.isElement($ele)) {
            return false;
        }
        let hostId = $ele.data("host-id");
        this.triggerEvent("activateHost", hostId);
        return true;
    }
    
    toggleHostElementIsExpanded(hostId: string, isExpanded: boolean): void {
        this.triggerEvent("toggleHostElementIsExpanded", hostId, isExpanded);
        let $hostElement = this.hosts.$container.find(".host-element[data-host-id='" + hostId + "']");
        $hostElement.find(".fa.collapsed").toggleClass("hide", isExpanded);
        $hostElement.find(".fa.expanded").toggleClass("hide", !isExpanded);
    }
    
    updateSidebarSpinners(statesStr: string): void {
        let states: { [hostId: string]: boolean } = JSON.parse(statesStr);
        for (let id in states) {
            let state = states[id];
            let $badge: JQuery;
            let width: string;
            $badge = this.hosts.$container.children(`[data-host-id="${id}"]`).find(".wi-element-badge.number");
            width = state ? ($badge.outerWidth() || 0).toString() : "initial";
            $badge.css("width", width).toggleClass("with-spinner", state);
        }
    }
    
}