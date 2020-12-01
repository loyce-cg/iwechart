import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model} from "./WayChooserController";
import {LoginWindowView} from "../LoginWindowView";

export class WayChooserView extends BaseView<Model> { 
    constructor(parent: LoginWindowView) {
        super(parent, mainTemplate);
    }
    
    render(model: Model): void {
        this.$main = this.mainTemplate.renderToJQ(model);
        this.$main.on("click","[trigger-action]", this.onActionClick.bind(this));
    }

    onActionClick(event: Event): void {
        let $e = $(event.target);
        this.triggerEvent("action", $e.closest("[trigger-action]").attr("trigger-action"));
    }
    
    focus(): void {
        setTimeout(() => {
            this.$main.find(".fade:not(.fade-in)").addClass("fade-in");
        }, 1);
    }
}
