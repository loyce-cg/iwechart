import {ComponentView} from "../base/ComponentView";
import {ExtListView, Options as ExtListOptions} from "../extlist/ExtListView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {func as listElementTemplate} from "../template/custom-element.html";
import * as Types from "../../Types";
import * as $ from "jquery";
import * as Q from "q";
import { SectionListView } from "../sectionlist/SectionListView";

export interface CustomElementListOptions {
    extList: ExtListOptions<Types.webUtils.CustomElementModel, void, MailClientViewHelper>;
    extListA?: ExtListOptions<Types.webUtils.CustomElementModel, void, MailClientViewHelper>;
}

export interface CustomElementClickEvent extends Types.event.Event<boolean> {
    type: "customelementclick";
    customElementId: string;
}

export class CustomElementListView extends ComponentView {
    
    customElements: ExtListView<Types.webUtils.CustomElementModel>;
    customElementsA: ExtListView<Types.webUtils.CustomElementModel>;
    protected _delayedClickTimeout: number = null;
    
    constructor(
        parent: Types.app.ViewParent,
        public options: CustomElementListOptions
    ) {
        super(parent);
        this.options.extList.template = this.options.extList.template || listElementTemplate;
        this.customElements = this.addComponent("customElements", new ExtListView(this, this.options.extList));
        
        this.options.extListA = this.options.extListA || {template: null};
        this.options.extListA.template = this.options.extListA.template || listElementTemplate;
        this.customElementsA = this.addComponent("customElementsA", new ExtListView(this, this.options.extListA));
    }
    
    init(): Q.Promise<void> {
        if (!this.customElementsA.$container) {
            this.customElementsA.$container = $("<div></div>")
        }
        this.customElements.$container.on("click", "[data-custom-element-id]", this.onCustomElementsClick.bind(this));
        this.customElementsA.$container.on("click", "[data-custom-element-id]", this.onCustomElementsClick.bind(this));
        return Q.all([
            this.customElements.triggerInit(),
            this.customElementsA.triggerInit(),
        ]).thenResolve(null);
    }
    
    onCustomElementsClick(event: MouseEvent): void {
        this.clearDelayedClickTimeout();
        let customElementId = $(event.target).closest("[data-custom-element-id]").data("custom-element-id");
        let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (unreadBadgeClickAction != "ignore" && $(event.target).closest(".wi-element-badge.number").length > 0) {
            if (unreadBadgeUseDoubleClick) {
                this._delayedClickTimeout = <any>setTimeout(() => {
                    this.activateCustomElement(customElementId);
                }, SectionListView.SINGLE_CLICK_DELAY);
            }
            return;
        }
        if ($(event.target).closest(".settings-button.active").length > 0) {
            this.triggerEvent("openSettings", customElementId);
            return;
        }
        this.activateCustomElement(customElementId);
    }
    
    activateCustomElement(customElementId: string): void {
        let result = this.dispatchEventResult(<CustomElementClickEvent>{
            type: "customelementclick",
            customElementId: customElementId,
        });
        if (result !== false) {
            this.triggerEvent("activateCustomElement", customElementId);
        }
    }
    
    clearDelayedClickTimeout(): void {
        if (this._delayedClickTimeout) {
            clearTimeout(this._delayedClickTimeout);
            this._delayedClickTimeout = null;
        }
    }
    
    getContainer(): JQuery {
        return this.customElements.$container;
    }
    
    isElement($ele: JQuery): boolean {
        return $ele.parent().get(0) == this.customElements.$container.get(0) ||
            $ele.parent().get(0) == this.customElementsA.$container.get(0);
    }
    
    activateElement($ele: JQuery): boolean {
        if (!this.isElement($ele)) {
            return false;
        }
        let customElementId = $ele.data("custom-element-id");
        this.triggerEvent("activateCustomElement", customElementId);
        return true;
    }
    
    updateSidebarSpinners(statesStr: string): void {
        let states: { [id: string]: boolean } = JSON.parse(statesStr);
        for (let id in states) {
            let state = states[id];
            let $badge: JQuery;
            let width: string;
            $badge = this.customElements.$container.children(`.custom-element[data-custom-element-id="${id}"]`).find(".wi-element-badge.number");
            width = state ? ($badge.outerWidth() || 0).toString() : "initial";
            $badge.css("width", width).toggleClass("with-spinner", state);
            $badge = this.customElementsA.$container.children(`.custom-element[data-custom-element-id="${id}"]`).find(".wi-element-badge.number");
            width = state ? ($badge.outerWidth() || 0).toString() : "initial";
            $badge.css("width", width).toggleClass("with-spinner", state);
        }
    }
    
}