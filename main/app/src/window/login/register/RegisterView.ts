import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {PasswordStrengthMeter} from "../../../utils/PasswordStrengthMeter";
import {Model} from "./RegisterController";
import {LoginWindowView} from "../LoginWindowView";

export type RegisterForm = HTMLFormElement&{
    hashmail: HTMLInputElement;
    email: HTMLInputElement;
    password: HTMLInputElement;
    password2: HTMLInputElement;
    pin: HTMLInputElement;
    token: HTMLInputElement;
    terms: HTMLInputElement;
};

export class RegisterView extends BaseView<Model> {
    
    form: RegisterForm;
    $info: JQuery;
    $pacInputField: JQuery;
    $pacInput: JQuery;
    passwordStrengthMeter: PasswordStrengthMeter;
    $passwordField: JQuery;
    $passwordMeter: JQuery;
    
    constructor(parent: LoginWindowView) {
        super(parent, mainTemplate);
    }
    
    render(model: Model): void {
        this.$main = this.mainTemplate.renderToJQ(model);
        this.$form = this.$main.find("form");
        this.$form.on("submit", this.onSubmitRegister.bind(this));
        this.form = <RegisterForm>this.$form.get(0);
        this.$info = this.$main.find(".register-info-box");
        this.$error = this.$main.find(".error");
        this.$pacInputField = this.$form.find(".pac-input");
        this.$pacInput = this.$pacInputField.find("input");
        this.$pacInput.on("change", this.onPacInputChange.bind(this));
        this.passwordStrengthMeter = this.helper.createPasswordStrengthMeter();
        this.$passwordField = this.$form.find("[name=password]");
        this.$passwordField.on("input", this.onPasswordFieldChange.bind(this));
        this.$passwordMeter = this.$form.find(".password-meter");
        this.$main.find("addition").html(model.domain.replace(/\./g, '.<wbr>'));
    }
    
    showError(error: any): void {
        if (error) {
            this.$error.html(error);
            this.form.password.value = "";
            this.form.password2.value = "";
            this.form.pin.value = "";
        }
        this.$main.find("button[type=submit] .icon-holder").html("");
        this.enableForm();
        this.focus();
    }
    
    onPacInputChange(event: Event): void {
        let checkbox = <HTMLInputElement>event.currentTarget;
        if (checkbox.checked) {
            this.$pacInput.val("");
            this.$pacInputField.show();
            this.$pacInput.focus();
        }
        else {
            this.$pacInputField.hide();
        }
    }
    
    onPasswordFieldChange(event: Event): void {
        let password = <string>this.$passwordField.val();
        if (password) {
            let result = this.passwordStrengthMeter.check(password);
            this.$passwordMeter.attr("data-score", result.score);
            this.$passwordMeter.find(".score-text").html(this.helper.text(result.scoreText + "\n(" + (result.score + 1) + "/5)"));
            let feedback = [];
            if (result.warning) {
                feedback.push(result.warning);
            }
            if (result.suggestions) {
                feedback = feedback.concat(result.suggestions);
            }
            if (feedback.length) {
                this.$passwordMeter.attr("title", feedback.join("\n"));
            }
            else {
                this.$passwordMeter.removeAttr("title");
            }
        }
        else {
            this.$passwordMeter.removeAttr("data-score");
            this.$passwordMeter.find(".score-text").html(this.helper.text(this.helper.i18n("passwordStrengthMeter.info")));
        }
    }
    
    onSubmitRegister(): void {
        this.disableForm();
        let hashmail = this.form.hashmail.value.trim().toLowerCase();
        let email = this.form.email.value.trim();
        let password = this.form.password.value;
        let password2 = this.form.password2.value;
        let pin = this.form.pin.value.trim();
        let token = this.form.token.value.trim();
        let key = this.form.key.value.trim();
        let terms = this.form.terms ? this.form.terms.checked : false;
        let weakPassword = this.passwordStrengthMeter.check(password).score < 2;
        this.$main.find("button[type=submit] .icon-holder").html('<i class="fa fa-spin fa-circle-o-notch"></i>');
        this.triggerEvent("register", hashmail, password, password2, email, pin, token, terms, weakPassword, key);
    }
    
    beforeFocus(): void {
        setTimeout(() => {
            this.$main.find(".info-box").addClass("full-viewed");
        }, 300);
    }
    
    focus(): void {
        if (!this.form.hashmail.value) {
            this.form.hashmail.focus();
        }
        else if (!this.form.password.value) {
            this.form.password.focus();
        }
        else if (!this.form.password2.value) {
            this.form.password2.focus();
        }
        else if (this.form.terms && !this.form.terms.checked) {
            this.form.terms.focus();
        }
        else {
            this.$form.find("button").focus();
        }
    }
    
    beforeBlur(): void {
        this.$main.find(".info-box").addClass("full-viewed2");
    }
    
    blur(): void {
        this.form.token.value = "";
        this.form.reset();
        this.$pacInputField.hide();
        this.$main.find(".info-box").removeClass("full-viewed").removeClass("full-viewed2");
    }
    
    updateModel(model: Model) {
        this.$main.empty();
        this.render(model);
        this.parent.$main.find(".main").remove(".window-login-register");
        this.parent.$main.find(".main").append(this.$main);
    }
}
