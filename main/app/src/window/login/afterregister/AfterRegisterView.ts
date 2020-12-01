import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {PasswordStrengthMeter} from "../../../utils/PasswordStrengthMeter";
import {Model} from "./AfterRegisterController";
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

export class AfterRegisterView extends BaseView<Model> {
    
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
        this.$main.on("click", "[data-action=login]", this.onLoginClick.bind(this));
        this.$main.on("click", "[data-action=download]", this.onDownloadClick.bind(this));
        this.$error = this.$main.find(".error");
        this.$form = this.$main.find(".form");
    }
    
    onLoginClick() {
        this.triggerEvent("login");
    }
    
    onDownloadClick() {
        this.triggerEvent("download");
    }
    
    onUpdateLogin(login: string): void {
        this.$main.find(".login-placeholder").html(login);
    }
}
