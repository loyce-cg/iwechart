import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./AlternativeLoginController";
import {LoginWindowView} from "../LoginWindowView";

export type AlternativeLoginForm = HTMLFormElement&{words: HTMLInputElement};

export class AlternativeLoginView extends BaseView<Model> {
    
    form: AlternativeLoginForm;
    
    constructor(parent: LoginWindowView) {
        super(parent, mainTemplate);
    }
    
    render(model: Model): void {
        this.$main = this.mainTemplate.renderToJQ(model);
        this.$form = this.$main.find("form");
        this.$error = this.$main.find(".error");
        this.$form.on("submit", this.onSubmit.bind(this));
        this.form = <AlternativeLoginForm>this.$form.get(0);
        this.$form.on("click", "[data-action='open-login']", this.onLoginClick.bind(this));
    }
    
    showError(error: any): void {
        if (error) {
            this.$error.html(error);
        }
        this.enableForm();
        this.focus();
    }
    
    onSubmit(): void {
        if (!this.activeView) {
            return;
        }
        this.disableForm();
        let words = this.form.words.value.trim();
        this.triggerEvent("login", words);
    }
    
    onLoginClick(): void {
        this.triggerEvent("openLogin");
    }
    
    focus(): void {
        if (!this.form.words.value) {
            this.form.words.focus();
        }
        else {
            this.$form.find("button").focus();
        }
    }
    
    blur(): void {
        this.form.reset();
    }
}
