import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./OpenExternalWindowController";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import * as $ from "jquery";

@WindowView
export class OpenExternalWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.$main.on("click", "[data-action=dont-show-again]", this.onDontShowAgainClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-action=ok]", this.onOkClick.bind(this));
        this.$main.find("[data-action=check]").on("change", this.onCheckboxChange.bind(this));
        this.bindKeyPresses();
        this.focus();
    }
    
    setName(name: string): void {
        this.$main.find(".name .text").html(name);
    }
    
    onDontShowAgainClick(): void {
        this.triggerEvent("dontShowAgain");
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    focus() {
        this.$main.find("[data-action='ok']").focus();
    }
    onOkClick(): void {
        this.triggerEvent("ok");
    }
    
    onCheckboxChange() {
      this.triggerEvent("checkboxChange");
    }
    
    bindKeyPresses(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == KEY_CODES.enter) {
                e.preventDefault();
                this.onOkClick();
            } else
            if (e.keyCode == KEY_CODES.escape) {
                e.preventDefault();
                this.onCloseClick();
            }
        });
    }
    
    // focus() {
    //   let $ele = this.$main.find("input.focus");
    //   $ele.focus();
    // }
    
}
