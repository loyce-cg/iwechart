import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./SecureFormsController";
import * as $ from "jquery";

export class SecureFormsView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "secureForms",
            priority: 200,
            groupId: "forms",
            icon: "list-alt",
            labelKey: "window.settings.menu.item.secureForms.label"
        };
    }
    
    initTab() {
        this.$main.on("click", "[data-action=new-secure-form]", this.onNewSecureFormButtonClick.bind(this));
        this.$main.on("click", "[data-action=show-secure-form-test]", this.onShowSecureFormTestButtonClick.bind(this));
        this.$main.on("click", "[data-action=delete-secure-form]", this.onDeleteSecureFormButtonClick.bind(this));
        this.$main.on("click", "[data-action=show-secure-form-dev]", this.onShowSecureFormDevButtonClick.bind(this));
        this.$main.on("click", "[data-action=switch-verify-email-secure-form]", this.onSwitchVerifyEmailSecureForm.bind(this));
    }
    
    setVerifyEmailSecureForm(id: string, mode: boolean) {
        this.$main.find("[data-sid='" + id + "'] [data-action=switch-verify-email-secure-form]").toggleClass("active", mode);
    }
    
    onNewSecureFormButtonClick(): void {
        this.triggerEvent("createSecureForm");
    }
    
    onShowSecureFormTestButtonClick(event: Event): void {
        let id = $(event.currentTarget).data("id");
        this.triggerEventInTheSameTick("showSecureFormTest", id);
    }
    
    onDeleteSecureFormButtonClick(event: Event): void {
        let id = $(event.currentTarget).data("id");
        this.triggerEvent("deleteSecureForm", id);
    }
    
    onShowSecureFormDevButtonClick(event: Event): void {
        let id = $(event.currentTarget).data("id");
        this.triggerEvent("openSecureFormDev", id);
    }
    
    onSwitchVerifyEmailSecureForm(e: MouseEvent) {
        let $e = $(e.target).closest("[data-sid]");
        let sid = $e.data("sid");
        let mode = !$e.find("[data-action=switch-verify-email-secure-form]").hasClass("active");
        this.triggerEvent("switchVerifyEmailSecureForm", sid, mode);
    }
}
