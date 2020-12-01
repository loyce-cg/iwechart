import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Scope} from "../../web-utils/Scope";
import {PasswordStrengthMeter} from "../../utils/PasswordStrengthMeter";
import {app} from "../../Types";

@WindowView
export class ChangePasswordWindowView extends BaseWindowView<void> {
    
    accountScope: Scope<{
        currentPassword: string;
        newPassword: string;
        repeatedPassword: string;
        changePassword: () => void;
    }>;
    passwordStrengthMeter: PasswordStrengthMeter;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: void): void {
        this.accountScope = new Scope(this.$main, {
            currentPassword: "",
            newPassword: "",
            repeatedPassword: "",
            changePassword: this.onChangePasswordButtonClick.bind(this)
        });
        this.passwordStrengthMeter = this.helper.createPasswordStrengthMeter();
        this.$main.on("input", ".new-password-fields [name=newPassword]", this.onNewPasswordFieldChange.bind(this));
        this.$main.on("keydown", "input[type=password]", this.onPasswordInput.bind(this));
        this.$main.find("[vf-model='currentPassword']").focus();
    }
    
    onPasswordInput(event: KeyboardEvent) {
        if (event.keyCode == 13) {
            this.onChangePasswordButtonClick();
        }
    }
    
    onChangePasswordButtonClick(): void {
        this.toggleSaveButtonState();
        let data = this.accountScope.data;
        let weakPassword = this.passwordStrengthMeter.check(data.newPassword).score < 2;
        this.triggerEvent("changePassword", data.currentPassword, data.newPassword, data.repeatedPassword, weakPassword);
    }
    
    focus(): void {
        this.$main.find("[data-input]").focus().select();
    }
    
    clearChangePasswordForm(clearForm:  boolean): void {
        this.toggleSaveButtonState();
        if (clearForm) {
            let data = this.accountScope.data;
            data.currentPassword = "";
            data.newPassword = "";
            data.repeatedPassword = "";
            this.accountScope.onChange();
            this.onNewPasswordFieldChange();
        }
    }
    
    onNewPasswordFieldChange(): void {
        let $passwordField = this.$main.find(".new-password-fields [name=newPassword]");
        let $passwordMeter = $passwordField.closest(".content").find(".password-meter");
        let password = <string>$passwordField.val();
        if (password) {
            let result = this.passwordStrengthMeter.check(password);
            $passwordMeter.attr("data-score", result.score);
            $passwordMeter.find(".score-text").html(this.helper.text(result.scoreText + "\n(" + (result.score + 1) + "/5)"));
            let feedback = [];
            if (result.warning) {
                feedback.push(result.warning);
            }
            if (result.suggestions) {
                feedback = feedback.concat(result.suggestions);
            }
            if (feedback.length) {
                $passwordMeter.attr("title", feedback.join("\n"));
            }
            else {
                $passwordMeter.removeAttr("title");
            }
        }
        else {
            $passwordMeter.removeAttr("data-score");
            $passwordMeter.find(".score-text").html(this.helper.text(this.helper.i18n("passwordStrengthMeter.info")));
        }
    }
    
    toggleSaveButtonState(): void {
        let $button = this.$main.find(".content .progress-button");
        let $buttonText = $button.find(".button-text");
        let workingText = $button.data("working-text") || this.helper.i18n("window.changePassword.button.save.loading");
        if (!$button.hasClass("loading")) {
            $button.addClass("loading");
            $button.data("prev-label", $buttonText.text());
            $buttonText.text(workingText);
            $button.prop("disabled", true);
        }
        else {
            $button.removeClass("loading");
            $buttonText.text($button.data("prev-label"));
            $button.prop("disabled", false);
        }
    }
}
