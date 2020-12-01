import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as scriptSrcTemplate} from "./template/script-src.html";
import {func as scriptSendTemplate} from "./template/script-send.html";
import {ExternalLibs} from "../../web-utils/ExternalLibs";
import * as $ from "jquery";
import {Model} from "./SecureFormDevWindowController";
import {app} from "../../Types";

@WindowView
export class SecureFormDevWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        [{
            name: "script-src",
            template: scriptSrcTemplate
        }, {
            name: "script-send",
            template: scriptSendTemplate
        }].forEach(spec => {
            let rawResult = this.templateManager.createTemplate(spec.template).render(model);
            let colorResult = ExternalLibs.getHighlight().highlight("html", rawResult);
            this.$main.find("[data-source='" + spec.name + "']").html(colorResult.value);
        });
        this.$main.on("click", "[data-url]", this.onLinkClick.bind(this));
        this.$main.on("click", "[data-action=open-formtest]", () => {
            this.triggerEventInTheSameTick("openFormTest");
        });
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", $(event.currentTarget).data("url"));
    }
}
