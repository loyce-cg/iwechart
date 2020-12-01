import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model} from "./ClearCacheWindowController";
import {func as resultTemplate} from "./template/result.html";
import {app} from "../../Types";

@WindowView
export class ClearCacheWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.$main.on("click", "[data-action=clear]", this.onClearCacheClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("keydown", ".input-container input", this.onInputKeyDown.bind(this));
        this.$main.find(".input-container input").focus();
        this.refreshWindowHeight();
    }
    
    onClearCacheClick(e: Event): void {
        this.clearCache();
    }
    
    onClearCacheResults(result: boolean, domain:string) {
        let $result = this.templateManager.createTemplate(resultTemplate).renderToJQ({result,domain});
        this.$main.find(".clear-cache-results").content($result);
        this.refreshWindowHeight();
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onInputKeyDown(event: KeyboardEvent): void {
        if (event.keyCode == 13) {
            event.preventDefault();
            this.clearCache();
        }
    }
    
    clearCache(): void {
        let domain = <string>this.$main.find("[data-control=domain-input]").val();
        this.triggerEvent("clearCache", domain);
    }
}
