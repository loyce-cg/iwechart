import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./ChangePasswordController";
import {Scope} from "../../../web-utils/Scope";
import {PasswordStrengthMeter} from "../../../utils/PasswordStrengthMeter";

export class ChangePasswordView extends BaseView<Model> {
    
    accountScope: Scope<{
        type: string;
        currentPassword: string;
        secretIdWords: string;
        newPassword: string;
        repeatedPassword: string;
        changePassword: () => void;
    }>;
    passwordStrengthMeter: PasswordStrengthMeter;
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "changePassword",
            priority: 200,
            groupId: "account",
            icon: "ellipsis-h",
            labelKey: "window.settings.menu.item.changePassword.label"
        };
        this.passwordStrengthMeter = this.helper.createPasswordStrengthMeter();
    }
    
    initTab() {
        this.$main.on("input", ".new-password-fields [name=newPassword]", this.onNewPasswordFieldChange.bind(this));
    }
    
    afterRenderContent(model: Model) {
        this.accountScope = new Scope(this.$main.find(".section"), {
            type: "oldPassword",
            currentPassword: "",
            secretIdWords: "",
            newPassword: "",
            repeatedPassword: "",
            changePassword: this.onChangePasswordButtonClick.bind(this)
        });
    }
    
    onChangePasswordButtonClick(): void {
        this.toggleSaveButtonState();
        let data = this.accountScope.data;
        let secret = data.type == "oldPassword" ? data.currentPassword : data.secretIdWords;
        let weakPassword = this.passwordStrengthMeter.check(data.newPassword).score < 2;
        this.triggerEvent("changePassword", data.type, secret, data.newPassword, data.repeatedPassword, weakPassword);
    }
    
    clearChangePasswordForm(clearFields: boolean = true): void {
        this.toggleSaveButtonState();
        if (clearFields) {
            let data = this.accountScope.data;
            data.currentPassword = "";
            data.secretIdWords = "";
            data.newPassword = "";
            data.repeatedPassword = "";
            this.accountScope.onChange();
            this.onNewPasswordFieldChange();
        }
        this.updateDirty();
    }
    
    onNewPasswordFieldChange(): void {
        let $passwordField = this.$main.find(".new-password-fields [name=newPassword]");
        let $passwordMeter = $passwordField.closest(".section").find(".password-meter");
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
}
