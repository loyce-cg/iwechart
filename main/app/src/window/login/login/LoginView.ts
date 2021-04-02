import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model, RemeberModel} from "./LoginController";
import {LoginWindowView} from "../LoginWindowView";
import { webUtils } from "../../../build/view";

export type LoginForm = HTMLFormElement&{hashmail: HTMLInputElement, password: HTMLInputElement};

export class LoginView extends BaseView<Model> {
    
    form: LoginForm;
    autoLogin: boolean;
    
    constructor(parent: LoginWindowView) {
        super(parent, mainTemplate);
    }
    
    render(model: Model): void {
        this.autoLogin = model.autoLogin;
        this.$main = this.mainTemplate.renderToJQ(model);
        this.$form = this.$main.find("form");
        this.$form.on("click", "[data-action='submit']", this.onSubmitLogin.bind(this));
        this.$error = this.$main.find(".error");
        this.form = <LoginForm>this.$form.get(0);
        this.form.hashmail.value = model.remember.hashmail.value;
        this.form.password.value = model.remember.password.value;
        this.$form.find("[data-remember]").on("change", this.onRememberChange.bind(this));
        this.refreshRemember(model.remember);
        $(this.form.hashmail).on("input", this.onHashmailChange.bind(this));
        this.$form.on("click", "[data-action='open-alternative-login']", this.onAlternativeLoginClick.bind(this));
        this.$main.on("click", "[trigger-action=managers-zone]", this.onManagersZoneClick.bind(this));
        // this.toggleLoginInfo(model.isLoginInfoVisible);
        this.$main.on("keydown", this.onKeydown.bind(this));
    }
    

    onKeydown(e: KeyboardEvent): void {
        if (e.keyCode === webUtils.KEY_CODES.enter) {
            if (this.activeView && this.form) {
                this.onSubmitLogin();
            }
        }
    }

    refreshRemember(remember: RemeberModel): void {
        this.$form.find("[data-remember=hashmail]").prop("checked", remember.hashmail.checked);
        if (remember.hashmail.checked) {
            this.$form.find("[data-remember=password]").prop("checked", remember.password.checked).prop("disabled", false).parent().removeClass("disabled");
        }
        else {
            this.$form.find("[data-remember=password]").prop("checked", false).prop("disabled", true).parent().addClass("disabled");
        }
    }
    
    showError(error: any): void {
        if (error) {
            this.$error.html("<span class='error-text'>" + error + "</span>");
            this.form.password.value = "";
        }
        this.$main.find("[data-action='submit'] .icon-holder").html("");
        this.enableForm();
        this.focus();
    }
    
    reinit(remember: RemeberModel, isLoginInfoVisible: boolean): void {
        this.refreshRemember(remember);
        this.form.hashmail.value = remember.hashmail.value;
        this.form.password.value = remember.password.value;
        this.toggleLoginInfo(isLoginInfoVisible);
    }
    
    toggleLoginInfo(isLoginInfoVisible: boolean): void {
        this.$main.find(".section-header").css("display", isLoginInfoVisible ? "inline-block": "none");
    }
                 
    onAfterActivate() {
        if (this.autoLogin) {
            this.autoLogin = false;
            this.onSubmitLogin();
        }
    }
    
    onSubmitLogin(): void {
        if (!this.activeView) {
            return;
        }
        this.$error.html("");
        this.disableForm();
        this.parent.disableLangChooser();
        let hashmail = this.form.hashmail.value.trim().toLowerCase();
        let password = this.form.password.value;
        this.$main.find("[data-action='submit'] .icon-holder").html('<i class="fa fa-spin fa-circle-o-notch"></i>');
        this.triggerEvent("login", hashmail, password);
    }
    
    onHashmailChange(): void {
        this.triggerEvent("hashmailChange", this.form.hashmail.value.trim().toLowerCase());
    }
    
    onRememberChange(event: Event): void {
        let type = $(event.target).data("remember");
        if (type == "hashmail") {
            this.triggerEvent("hashmailRememberChange", (<HTMLInputElement>event.target).checked);
            this.onHashmailChange();
        }
        else if (type == "password") {
            this.triggerEvent("passwordRememberChange", (<HTMLInputElement>event.target).checked);
        }
    }
    
    onAlternativeLoginClick(): void {
        this.triggerEvent("openAlternativeLogin");
    }

    focus(): void {
        setTimeout(() => {
            this.$main.find(".fade:not(.fade-in)").addClass("fade-in");
        }, 1);
        if (!this.form.hashmail.value) {
            this.form.hashmail.focus();
        }
        else if (!this.form.password.value) {
            this.form.password.focus();
        }
        else {
            this.$form.find("button").focus();
        }
    }

    onManagersZoneClick(event: Event): void {
        this.parent.triggerEvent("openManagersZone");
    }

    onControlCenterLoad(active: boolean): void {
        this.$main.find(".login-btn[trigger-action='managers-zone']").prop("disabled", active);
        if (active) {
            this.$main.find(".ccLoader").append($('<i class="fa fa-circle-o-notch fa-spin"></i>'));
        }
        else {
            this.$main.find(".ccLoader").children("i").remove();

        }
    }

    lockControls(lock: boolean): void {
        this.$main.find("[data-action=submit]").prop("disabled", lock);
    }

    setLoginField(login: string): void {
        this.form.hashmail.value = login;
        this.form.password.value = "";
    }
}
