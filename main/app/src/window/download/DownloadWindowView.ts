import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model} from "./DownloadWindowController";
import {app} from "../../Types";

@WindowView
export class DownloadWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.$main.on("click", "[data-action]", this.onButtonClick.bind(this));
    }
    
    onButtonClick(e: MouseEvent): void {
        let $el = $(e.target).closest("[data-action]");
        this.triggerEvent($el.data("action"));
    }
}
