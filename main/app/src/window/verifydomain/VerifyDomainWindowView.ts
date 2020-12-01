import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model, VerifyInfoModel} from "./VerifyDomainWindowController";
import {func as verifyInfoTemplate} from "./template/verifyInfo.html";
import {func as verifyNonExistsTemplate} from "./template/verifyNonExists.html";
import {VerifyErrorModel} from "./VerifyDomainWindowController";
import {app} from "../../Types";

@WindowView
export class VerifyDomainWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.$main.on("click", "[data-action=verify]", this.onVerifyClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("keydown", ".input-container input", this.onInputKeyDown.bind(this));
        this.$main.find(".input-container input").focus();
        this.refreshWindowHeight();
    }
    
    
    onVerifyClick(e: Event): void {
        this.$main.find("button[data-action=verify]").prop("disabled", true);
        this.verify();
    }
    
    onVerifyDomainResults(data: string|VerifyInfoModel) {
        let $result = this.templateManager.createTemplate(verifyInfoTemplate).renderToJQ(data);
        this.$main.find(".verify-results").content($result);
        if (typeof data !== "string") {
            this.$main.find("button[data-action=verify]").prop("disabled", false);
        }
        this.refreshWindowHeight();
    }
    
    onVerifyDomainError(model: VerifyErrorModel) {
        let $errResult = this.templateManager.createTemplate(verifyNonExistsTemplate).renderToJQ(model);
        this.$main.find(".verify-results").content($errResult);
        this.refreshWindowHeight();
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onInputKeyDown(event: KeyboardEvent): void {
        if (event.keyCode == 13) {
            event.preventDefault();
            this.verify();
        }
    }
    
    verify(): void {
        let domain = <string>this.$main.find("[data-control=domain-input]").val();
        this.triggerEvent("verify", domain);
    }
}
