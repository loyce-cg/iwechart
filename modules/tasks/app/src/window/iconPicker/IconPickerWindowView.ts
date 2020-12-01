import * as web from "pmc-web";
import { func as mainTemplate }  from "./template/main.html";
import { func as iconTemplate }  from "./template/icon.html";
import { Model } from "./IconPickerWindowController";
import $ = web.JQuery;
import Q = web.Q;

export class IconPickerWindowView extends web.window.base.BaseWindowView<Model> {
    
    iconsExtList: web.component.extlist.ExtListView<string>;
    colorsExtList: web.component.extlist.ExtListView<string>;
    
    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.setModel(model);
        
        this.$main.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        this.$main.on("click", "[data-action=cancel]", this.onCancelClick.bind(this));
        this.$main.on("click", ".taskgroup-icon", this.onIconClick.bind(this));
        
        this.iconsExtList = this.addComponent("iconsExtList", new web.component.extlist.ExtListView<string>(this, {
            template: iconTemplate,
        }));
        this.colorsExtList = this.addComponent("colorsExtList", new web.component.extlist.ExtListView<string>(this, {
            template: iconTemplate,
        }));
        
        this.iconsExtList.$container = this.$main.find(".icons-extlist-container");
        this.colorsExtList.$container = this.$main.find(".colors-extlist-container");
        
        return Q()
        .then(() => {
            return this.iconsExtList.triggerInit();
        })
        .then(() => {
            return this.colorsExtList.triggerInit();
        })
        .then(() => {
            (<any>this.$main.find(".scrollable-content")).pfScroll();
        });
    }
    
    setModel(model: Model): void {
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", (<HTMLAnchorElement>event.currentTarget).href);
    }
    
    onCloseClick(): void {
        this.toggleButtonsEnabled(false);
        this.triggerEvent("close");
    }
    
    onSaveClick(): void {
        this.toggleButtonsEnabled(false);
        this.triggerEvent("save");
    }
    
    onCancelClick(): void {
        this.toggleButtonsEnabled(false);
        this.triggerEvent("cancel");
    }
    
    toggleButtonsEnabled(enabled: boolean): void {
        this.$main.find("[data-action=save]").prop("disabled", !enabled);
        this.$main.find("[data-action=cancel]").prop("disabled", !enabled);
    }
    
    onIconClick(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget);
        let $parent = $el.parent();
        let idx = $parent.children().index($el);
        if ($parent.hasClass("icons-extlist-container")) {
            this.triggerEvent("changeIcon", idx);
        }
        else if ($parent.hasClass("colors-extlist-container")) {
            this.triggerEvent("changeColor", idx);
        }
    }

}