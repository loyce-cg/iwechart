import {ComponentView} from "../base/ComponentView";
import {ExtListView, Options as ExtListOptions} from "../extlist/ExtListView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {func as listElementTemplate} from "../template/section.html";
import * as Types from "../../Types";
import * as $ from "jquery";
import { SectionListView } from "../sectionlist/SectionListView";

export interface SectionListOptions {
    extList: ExtListOptions<Types.webUtils.SectionListElementModel, void, MailClientViewHelper>;
}

export interface RemoteSectionClickEvent extends Types.event.Event<boolean> {
    type: "remotesectionclick";
    sectionId: string;
}

export class RemoteSectionListView extends ComponentView {
    
    sections: ExtListView<Types.webUtils.SectionListElementModel>;
    protected _delayedClickTimeout: number = null;
    
    constructor(
        parent: Types.app.ViewParent,
        public options: SectionListOptions
    ) {
        super(parent);
        this.options.extList.template = this.options.extList.template || listElementTemplate;
        this.sections = this.addComponent("sections", new ExtListView(this, this.options.extList));
    }
    
    init(): Q.Promise<void> {
        this.sections.$container.on("click", "[data-section-id]", this.onSectionClick.bind(this));
        return this.sections.triggerInit();
    }
    
    onSectionClick(event: MouseEvent): void {
        this.clearDelayedClickTimeout();
        //event.stopPropagation();
        let sectionId = $(event.target).closest("[data-section-id]").data("section-id");
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
        // console.log("remote section clicked", sectionId);
        this.activateSection(sectionId);
    }
    
    activateSection(sectionId: string): void {
        let result = this.dispatchEventResult(<RemoteSectionClickEvent>{
            type: "remotesectionclick",
            sectionId: sectionId
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
    
}