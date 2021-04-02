import {ComponentView} from "../base/ComponentView";
import {ExtListView, Options as ExtListOptions} from "../extlist/ExtListView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {func as listElementTemplate} from "../template/section.html";
import * as Types from "../../Types";

import { InfoTooltip } from "../infotooltip/InfoTooltip";
import * as $ from "jquery";
import { SidebarView } from "../sidebar/SidebarView";

export interface SectionListOptions {
    extList: ExtListOptions<Types.webUtils.SectionListElementModel, void, MailClientViewHelper>;
}

export interface SectionClickEvent extends Types.event.Event<boolean> {
    type: "sectionclick";
    sectionId: string;
}

export class SectionListView extends ComponentView {
    
    static readonly SINGLE_CLICK_DELAY: number = 300;
    // static readonly DOUBLE_CLICK_FAST: number = 250;

    sections: ExtListView<Types.webUtils.SectionListElementModel>;
    personsTooltip: InfoTooltip;

    protected _delayedClickTimeout: number = null;
    protected _dblClickTimeout: NodeJS.Timer = null;
    doubleClickEvents: {[id: string]: number} = {};

    constructor(
        parent: Types.app.ViewParent,
        public options: SectionListOptions
    ) {
        super(parent);
        this.options.extList.template = this.options.extList.template || listElementTemplate;
        this.sections = this.addComponent("sections", new ExtListView(this, this.options.extList));
        this.personsTooltip = this.addComponent("infoTooltip", new InfoTooltip(this));
        let origOnAfterListRender = this.options.extList.onAfterListRender;
        this.options.extList.onAfterListRender = view => {
            if (origOnAfterListRender) {
                origOnAfterListRender(view);
            }
            this.onAfterRenderContactList();
        };
    }
    
    init(): Q.Promise<void> {
        this.sections.$container.on("click", "[data-section-id]", this.onSectionClick.bind(this));

        return this.sections.triggerInit();
    }
    
    onAfterRenderContactList(): void {
        this.personsTooltip.init(this.sections.$container);
    }

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

    resetDblClick(id: string): void {
        if (id in this.doubleClickEvents) {
            delete this.doubleClickEvents[id];
        }
        clearTimeout(this._dblClickTimeout);
        this._dblClickTimeout = null;
    }

    onSectionClick(event: MouseEvent): void {
        
        if (event.ctrlKey || event.metaKey) {
            if (this.parent instanceof SidebarView) {
                this.parent.handleSectionOrConversationCtrlClick(event);
            }
            return;
        }

        this.clearDelayedClickTimeout();
        let sectionId = $(event.target).closest("[data-section-id]").data("section-id");
        
        // if(this.checkDblClick(sectionId)) {
        //     this.resetDblClick(sectionId);
        //     return;
        // }

        let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (unreadBadgeClickAction != "ignore" && $(event.target).closest(".wi-element-badge.number").length > 0) {
            if (unreadBadgeUseDoubleClick) {
                this._delayedClickTimeout = <any>setTimeout(() => {
                    this.activateSection(sectionId);
                }, SectionListView.SINGLE_CLICK_DELAY);
            }
            return;
        }
        // if (!this._dblClickTimeout) {
        //     this._dblClickTimeout = setTimeout(() => {
        //         if (this.checkDblClick(sectionId)) {
        //             this.resetDblClick(sectionId);
        //             return;
        //         }
        //         this.resetDblClick(sectionId);
        //         this.activateSection(sectionId);
        //     }, SectionListView.DOUBLE_CLICK_FAST);    
        // }


        if ($(event.target).closest(".settings-button.active").length > 0) {
            this.triggerEvent("openSettings", sectionId);
            return;
        }
        if ($(event.target).closest(".pin-button.active").length > 0) {
            this.triggerEvent("togglePinned", sectionId, !$(event.target).closest(".pin-button.active").hasClass("pinned"));
            return;
        }
        if ($(event.target).closest(".videoconf-button").length > 0) {
            return;
        }
        this.activateSection(sectionId);
    }
    
    activateSection(sectionId: string): void {
        let result = this.dispatchEventResult(<SectionClickEvent>{
            type: "sectionclick",
            sectionId: sectionId,
        });
        if (result !== false) {
            this.triggerEvent("activateSection", sectionId);
        }
    }
    
    clearDelayedClickTimeout(): void {
        if (this._delayedClickTimeout) {
            clearTimeout(this._delayedClickTimeout);
            this._delayedClickTimeout = null;
        }
    }
    
    getContainer(): JQuery {
        return this.sections.$container;
    }
    
    isElement($ele: JQuery): boolean {
        return $ele.parent().get(0) == this.sections.$container.get(0);
    }
    
    activateElement($ele: JQuery): boolean {
        if (!this.isElement($ele)) {
            return false;
        }
        let sectionId = $ele.data("section-id");
        this.triggerEvent("activateSection", sectionId);
        return true;
    }
    
    updateSidebarSpinners(statesStr: string): void {
        let states: { [id: string]: boolean } = JSON.parse(statesStr);
        for (let id in states) {
            let state = states[id];
            let $badge: JQuery;
            let width: string;
            $badge = this.sections.$container.children(`.section-element[data-section-id="${id}"]`).find(".wi-element-badge.number");
            width = state ? ($badge.outerWidth() || 0).toString() : "initial";
            $badge.css("width", width).toggleClass("with-spinner", state);
        }
    }
    
    setPinned(sectionId: string, pinned: boolean): void {
        this.sections.$container.children(`.section-element[data-section-id="${sectionId}"]`)
            .find(".pin-button").toggleClass("pinned", pinned).toggleClass("not-pinned", !pinned);
    }
    
    toggleBellState(sectionId: string, isRinging: boolean): void {
        this.sections.$container.children(`.section-element[data-section-id="${sectionId}"]`)
            .toggleClass("with-voice-chat-active", !isRinging).toggleClass("with-bell-ringing", !!isRinging);
    }

    toggleVoiceChatActive(sectionId: string, active: boolean, usersStr: string): void {
        let $element = this.sections.$container.children(`.section-element[data-section-id="${sectionId}"]`);


        $element.toggleClass("with-voice-chat-active", active);


    }

}