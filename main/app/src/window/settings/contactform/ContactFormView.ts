import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./ContactFormController";

export class ContactFormView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "contactForm",
            priority: 100,
            groupId: "forms",
            icon: "list-alt",
            labelKey: "window.settings.menu.item.contactForm.label"
        };
    }
    
    initTab() {
        this.$main.on("click", "[data-action=switch-activate-contact-form]", this.onSwitchActivateContactForm.bind(this));
        this.$main.on("click", "[data-action=switch-verify-email-contact-form]", this.onSwitchVerifyEmailContactForm.bind(this));
        this.$main.on("click", "[data-action=switch-require-pass-contact-form]", this.onSwitchRequirePassContactForm.bind(this));
    }
    
    onSwitchActivateContactForm() {
        let mode = !this.$main.find("[data-action=switch-activate-contact-form]").hasClass("active");
        this.triggerEvent("switchActivateContactForm", mode);
    }
    
    onSwitchVerifyEmailContactForm() {
        let mode = !this.$main.find("[data-action=switch-verify-email-contact-form]").hasClass("active");
        this.triggerEvent("switchVerifyEmailContactForm", mode);
    }
    
    onSwitchRequirePassContactForm() {
        let mode = !this.$main.find("[data-action=switch-require-pass-contact-form]").hasClass("active");
        this.triggerEvent("switchRequirePassContactForm", mode);
    }
    
    setActivateContactForm(mode: boolean) {
        this.$main.find(".contact-form-section .sub-options").toggleClass("activated", mode);
        this.$main.find("[data-action=switch-activate-contact-form]").toggleClass("active", mode);
    }
    
    setVerifyEmailContactForm(mode: boolean) {
        this.$main.find("[data-action=switch-verify-email-contact-form]").toggleClass("active", mode);
    }
    
    setRequirePassContactForm(mode: boolean) {
        this.$main.find("[data-action=switch-require-pass-contact-form]").toggleClass("active", mode);
    }
}
