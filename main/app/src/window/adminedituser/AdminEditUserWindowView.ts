import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model} from "./AdminEditUserWindowController";
import {func as passwordTemplate} from "./template/password.html";
import {app} from "../../Types";
import { ProgressViewContainer } from "../../component/channel/ProgressViewContainer";

@WindowView
export class AdminEditUserWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.$main.on("click", "[data-action=save-changes]", this.onSaveChangesClick.bind(this));
        this.$main.on("click", "[data-action=remove-user]", this.onRemoveUserClick.bind(this));
        this.$main.on("click", "[data-action=reset-password]", this.onResetPasswordClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-trigger=send-link]", this.sendActivationData.bind(this));
        this.$main.on("click", "[data-action='block-user']", this.onBlockUserClick.bind(this));
        this.$main.on("click", "[data-action='unblock-user']", this.onUnblockUserClick.bind(this));
        this.$main.on("change", ".contact-form-enabled-field select", this.onContactFormEnabledSelectChange.bind(this))
        this.$main.on("click", ".password-show", () => {
            this.$main.find(".password-holder input").attr("type", "text");
            this.$main.find(".password-holder").addClass("show-pass");
        });
        this.$main.on("click", ".password-hide", () => {
            this.$main.find(".password-holder input").attr("type", "password");
            this.$main.find(".password-holder").removeClass("show-pass");
        });
        this.$main.on("click", "[data-copy]", (e: Event) => this.helper.onCopyClick(<MouseEvent>e));
        this.refreshWindowHeight();
    }
    

    sendActivationData(): void {
        this.triggerEvent("sendEmail")
    }

    onSaveChangesClick(): void {
        this.lockSaveButton();
        let data: {[name: string]: any} = {};
        this.$main.closest("form").serializeArray().forEach(e => {
            data[e.name] = e.value;
        });
        if (data.admin) {
            data.admin = data.admin == "true" ? true : false;
        }
        if (data.privateSectionAllowed) {
            data.privateSectionAllowed = data.privateSectionAllowed == "on" ? true : false;
        }
        this.triggerEvent("saveChanges", JSON.stringify(data));
    }
    
    onResetPasswordClick(): void {
        this.triggerEvent("resetPassword");
    }
    
    renderPasswordSection(password: string): void {
        let $ps = this.$main.find(".password-section");
        this.helper.createTemplate(passwordTemplate).renderToJQ(password).insertAfter($ps);
        $ps.remove();
    }
    
    lockButton($btn: JQuery): void {
        let $icon = $btn.find("i");
        $icon.attr("class", $icon.data("proc"));
        $btn.prop("disabled", true);
    }
    
    unlockButton($btn: JQuery): void {
        setTimeout(() => {
            let $icon = $btn.find("i");
            $icon.attr("class", $icon.data("org"));
            $btn.prop("disabled", false);
        }, 300);
    }
    
    lockSaveButton(): void {
        this.lockButton(this.$main.find('[data-action=save-changes]'));
    }
    
    unlockSaveButton(): void {
        this.unlockButton(this.$main.find('[data-action=save-changes]'));
    }
    
    lockRemoveButton(): void {
        this.lockButton(this.$main.find('[data-action=remove-user]'));
    }
    
    unlockRemoveButton(): void {
        this.unlockButton(this.$main.find('[data-action=remove-user]'));
    }
    
    onRemoveUserClick(): void {
        this.triggerEvent("removeUser");
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onContactFormEnabledSelectChange(): void {
        var val = (<string>this.$main.find(".contact-form-enabled-field select").val()) == "true";
        this.$main.find(".contact-form-enabled-field .sub-info").toggleClass("hide", !val);
    }

    onBlockUserClick(e: Event): void {
        this.triggerEvent("blockUser");
    }

    onUnblockUserClick(e: Event): void {
        this.triggerEvent("unblockUser");
    }
}
