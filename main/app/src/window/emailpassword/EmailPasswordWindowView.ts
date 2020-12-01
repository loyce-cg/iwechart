import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {EmailPasswordModel} from "./EmailPasswordWindowController";
import {app} from "../../Types";

@WindowView
export class EmailPasswordWindowView extends BaseWindowView<EmailPasswordModel> {
    
    model: EmailPasswordModel;
    withPassword: boolean;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: EmailPasswordModel): void {
        this.model = model;
        this.withPassword = this.model.withPassword;
        this.$main.on("click", "[data-trigger]", this.onDataTriggerClick.bind(this));
        this.$main.find("[data-input='password']").focus().select();
    }
    
    onDataTriggerClick(event: MouseEvent): void {
        let action = $(event.target).closest("[data-trigger]").data("trigger");
        if (action == "ok") {
            this.triggerEvent("action", "ok", this.getValue());
        }
        else if (action == "cancel") {
            this.triggerEvent("action", "cancel");
        }
        else if (action == "show-password") {
            this.togglePasswordInput(true);
        }
        else if (action == "hide-password") {
            this.togglePasswordInput(false);
        }
        else if (action == "generate-password") {
            this.triggerEvent("generatePassword");
        }
        else if (action == "with-password") {
            this.withPassword = true;
        }
        else if (action == "without-password") {
            this.withPassword = false;
        }
    }
    
    togglePasswordInput(visible: boolean) {
        this.$main.find("[data-input='password']").attr("type", visible ? "text" : "password");
        this.$main.find("[data-trigger='show-password']").toggleClass("hide", visible);
        this.$main.find("[data-trigger='hide-password']").toggleClass("hide", !visible);
    }
    
    onBodyKeydown(event: KeyboardEvent): void {
        if (event.keyCode == 27) {
            event.preventDefault();
            this.triggerEvent("action", "escape");
        }
    }
    
    setGeneratedPassword(value:string) {
        this.togglePasswordInput(true);
        this.$main.find("[data-input='password']").val(value);
    }
    
    getValue(): EmailPasswordModel {
        return {
            email: this.model.email,
            password: (this.withPassword ? <string>this.$main.find("[data-input='password']").val() : ""),
            hint: (this.withPassword ? <string>this.$main.find("[data-input='hint']").val() : ""),
            lang: <string>this.$main.find("[data-input='lang']").val(),
            withPassword: this.withPassword
        };
    }
    
    startProcessing() {
        this.$main.find("input,textarea,button").prop("disabled", true);
        this.$main.find("[data-trigger='ok'] i").attr("class", "fa fa-spin fa-circle-o-notch");
    }
    
    stopProcessing() {
        this.$main.find("input,textarea,button").prop("disabled", false);
        this.$main.find("[data-trigger='ok'] i").attr("class", "fa fa-check");
    }
}
