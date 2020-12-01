import * as Types from "../../Types";
import * as $ from "jquery";
import * as Q from "q";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./DisabledSectionController";
import { ComponentView } from "../base/ComponentView";
import { BaseWindowView } from "../../window/base/BaseWindowView";

export class DisabledSectionView extends ComponentView {
    parent: BaseWindowView<any>;
    $container: JQuery;
    constructor(parent: BaseWindowView<any>) {
        super(parent);
    }
    
    init(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.$container.append(this.templateManager.createTemplate(mainTemplate).renderToJQ(model));
            this.$container.attr("tabindex", "-1");
            
            this.$container.on("click", "[data-action]", this.onActionClick.bind(this));
            this.$container.on("click", "input[name=hideAllSections]", this.onCheckboxClick.bind(this));
            return;
        });
    }
    onActionClick(e: MouseEvent): void {
        let action = $(e.target).closest("[data-action]").data("action");
        this.triggerEvent("action", action);
    }
    
    onCheckboxClick(e: MouseEvent): void {
        let value = $(e.target).is(":checked");
        this.triggerEvent("hideAllSections", value);
    }
    
    updateModel(model: Model): void {
        this.$container.empty().append(this.templateManager.createTemplate(mainTemplate).renderToJQ(model));
    }
    
    onDeactivate(): void {}
    onActivate(): void {}
    blurInputFocus(): void {}
}