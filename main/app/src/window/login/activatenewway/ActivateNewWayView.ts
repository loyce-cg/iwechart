import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as keyInfoTemplate} from "./template/key-info.html";
import {Model} from "./ActivateNewWayController";
import {LoginWindowView} from "../LoginWindowView";

export type ActivateForm = HTMLFormElement&{words: HTMLInputElement};

interface MaskOptions {
    separatorPos: number;
    separator: string;
    maxInputLength: number;
}
class MaskInput {
    lastProcessedKey: number;
    constructor(public options: MaskOptions) {}
    
    onKeyPressed(keyCode: number) {
        this.lastProcessedKey = keyCode;
    }
    mask(valueIn: string): string {
        let value = valueIn;
        if (value.length > this.options.separatorPos) {
            let parts = value.split("-");
            value = parts.join();
        }
        let retValue: string = "";
        for (let i=0;i<value.length;i++) {
            if (this._isAllowed(value[i], i) && retValue.length < this.options.maxInputLength) {
                retValue += value[i];
            }
            if (i == this.options.separatorPos - 1) {
                // add separator
                retValue += this.options.separator;
            }
        }
        if (value.length == this.options.separatorPos) {
            if (this.lastProcessedKey == 8) {
                retValue = retValue.slice(0, -1);
            }
        }
        return retValue;
    }

    _isSeparator(str: string): boolean {
        return str.length == 1 && str == this.options.separator;
    }

    _isAllowed(str: string, atPos: number) {
        return (str.length == 1 && str.match(/[A-Za-z0-9]/i)) || (this._isSeparator(str) && atPos == this.options.separatorPos);
    }    
}

export class ActivateNewWayView extends BaseView<Model> {
    static maxInputLength: number = 9;
    form: ActivateForm;
    $keyInput: JQuery;
    $nextButton: JQuery;
    $keyInfo: JQuery;

    maskInput: MaskInput = new MaskInput({separator: "-",maxInputLength: ActivateNewWayView.maxInputLength, separatorPos: 4});

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

        this.$keyInput = this.$form.find(".keycode");
        this.$nextButton = this.$main.find("[data-action=go-next]");
        this.$keyInfo = this.$main.find(".key-info");
        this.setNextEnabled(false);

        this.$keyInput.on("keydown", event => {
            this.maskInput.onKeyPressed(event.keyCode);
        });

        this.$keyInput.on('input propertychange', () => {
            this.$keyInput.val(this.maskInput.mask(this.$keyInput.val().toString()));
            this.setNextEnabled(this.$keyInput.val().toString().length == ActivateNewWayView.maxInputLength);
        });

        this.fillWithTestData();
    }

    fillWithTestData(): void {
        this.$keyInput.val("LFYR-dJqK");
        this.setNextEnabled(true);
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
    
    onNextClick(): void {
        let key = this.$keyInput.val().toString().replace("-", "");
        // console.log("gethered key", key);
        this.parent.triggerEvent("activateNewWayNextClick", key);
    }

    keyError(): void {
        console.log("error in view");
        this.showError(this.parent.i18n("window.login.activatenewway.error.invalidkey"));
    }
}
