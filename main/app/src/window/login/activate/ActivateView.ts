import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as keyInfoTemplate} from "./template/key-info.html";
import {Model} from "./ActivateController";
import {LoginWindowView} from "../LoginWindowView";

export type ActivateForm = HTMLFormElement&{words: HTMLInputElement};

export class ActivateView extends BaseView<Model> {
    
    form: ActivateForm;
    $keyInput: JQuery;
    $nextButton: JQuery;
    $keyInfo: JQuery;
    $hostInput: JQuery;
    
    constructor(parent: LoginWindowView) {
        super(parent, mainTemplate);
    }
    
    render(model: Model): void {
        this.$main = this.mainTemplate.renderToJQ(model);
        this.$form = this.$main.find("form");
        this.$error = this.$main.find(".error");
        this.$form.on("submit", this.onSubmit.bind(this));
        this.form = <ActivateForm>this.$form.get(0);
        this.$main.on("click", "[data-action='open-login']", this.onLoginClick.bind(this));
        this.$main.on("click", "[data-action='go-next']", this.onNextClick.bind(this));

        this.$keyInput = this.$form.find(".words");
        this.$nextButton = this.$main.find("[data-action=go-next]");
        this.$keyInfo = this.$main.find(".key-info");
        this.$hostInput = this.$main.find(".host-input");
        this.setNextEnabled(false);
        this.$keyInput.on('input propertychange', () => {
            this.parent.triggerEvent("keyInputChange", this.$keyInput.val());
        });
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
        this.$keyInput.val("");
        this.setNextEnabled(false);
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
    
    setNextEnabled(enabled: boolean): void {
        this.$nextButton.prop("disabled", !enabled);
    }

    onMnemonicEntered(isElectron: boolean): void {
        if (isElectron) {
            this.setKeyInfoVisible(false);
            this.setHostInputVisible(true);                
        }
        else {
            this.setKeyInfoVisible(true);
            this.$keyInfo.empty().append(this.helper.i18n("window.login.activate.mnemonic.label"))
        }
        this.setNextEnabled(true);
    }
    
    setHostInputVisible(visible: boolean): void {
        this.$hostInput.toggleClass("hide", !visible);
    }

    setKeyInfoVisible(visible: boolean): void {
        this.$keyInfo.toggleClass("hide", !visible);
    }

    onNextClick(): void {
        this.parent.triggerEvent("activateNextClick");
    }
    
    updateKeyInfo(isKeyCorrect: boolean, isAdmin: boolean, host: string): void {
        this.setHostInputVisible(false);
        this.setKeyInfoVisible(true);
        this.$keyInfo.empty();
        let inputValue = this.$keyInput.val();
        if (typeof inputValue === "string" && inputValue.length > 0) {
            let $template = this.templateManager.createTemplate(keyInfoTemplate).renderToJQ({keyCorrect: isKeyCorrect, host: host, isAdmin: isAdmin});
            this.$keyInfo.append($template);
        }
        this.setNextEnabled(isKeyCorrect);
    }

    getHost(): string {
        return (this.$hostInput.find("input").val() as string);
    }

    beforeFocus(): void {
        this.$keyInfo.empty();
        this.setHostInputVisible(false);
        this.setKeyInfoVisible(true);
    }
}
