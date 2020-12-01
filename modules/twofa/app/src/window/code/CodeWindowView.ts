import {webUtils, window, Types, JQuery as $} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {func as messageTemplate} from "./template/messageTemplate.html";
import {Model} from "./CodeWindowController";

export class CodeWindowView extends window.base.BaseWindowView<Model> {
    
    inputSize: number;
    digitsOnly: boolean;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model) {
        this.digitsOnly = true;
        if (model.data.type == "googleAuthenticator") {
            this.inputSize = 3;
        }
        else {
            this.inputSize = 1;
        }
        this.$main.on("click", ".submit-code", this.onSubmitCodeClick.bind(this));
        this.$main.on("click", ".cancel", this.onCancelClick.bind(this));
        this.$main.on("click", ".resend-code", this.onResendCodeClick.bind(this));
        this.$main.find(".code-input").on("keydown", this.onKeydown.bind(this));
        this.$main.find(".code-input").on("input", this.onInput.bind(this));
        this.refreshWindowHeight();
        this.$main.find(".code-input").first().focus();
    }
    
    onKeydown(event: KeyboardEvent) {
        if (event.keyCode == 13) {
            this.submit();
            return;
        }
        if (event.keyCode == 8) {
            let input = (<HTMLInputElement>event.target);
            if (input.value.length == 0) {
                let $prev = $(input).prev();
                if ($prev.length) {
                    $prev.focus();
                }
            }
            return;
        }
        if (this.digitsOnly) {
            let allowed = "0123456789";
            if (event.key.length == 1 && allowed.indexOf(event.key) == -1) {
                event.preventDefault();
                return false;
            }
        }
    }
    
    onInput(event: Event) {
        let input = (<HTMLInputElement>event.target);
        if (input.value.length > this.inputSize) {
            input.value = input.value.substr(0, this.inputSize);
        }
        if (input.value.length >= this.inputSize) {
            let $next = $(input).next();
            if ($next.length) {
                $next.focus();
            }
        }
    }
    
    onSubmitCodeClick() {
        this.submit();
    }
    
    onCancelClick(): void {
        this.triggerEvent("cancel");
    }
    
    onResendCodeClick() {
        this.disableForm(this.$main.find(".resend-code"));
        this.triggerEvent("resend");
    }
    
    disableForm($button?: JQuery) {
        this.$main.find("input button").prop("disabled", true);
        if ($button) {
            $button.prepend('<i class="fa fa-spin fa-circle-o-notch"></i>');
        }
    }
    
    enableForm() {
        this.$main.find("input button").prop("disabled", false);
        this.$main.find("button i").remove();
    }
    
    submit() {
        let value = "";
        let invalidElement: HTMLInputElement;
        let rememberDeviceId = this.$main.find(".remember-device-id").is(":checked");
        this.$main.find(".code-input").each((i: number, e: HTMLInputElement) => {
            if (e.value.length != this.inputSize) {
                invalidElement = e;
                return false;
            }
            value += e.value;
        });
        if (invalidElement != null) {
            let $activeElement = $(document.activeElement);
            if (!$activeElement.hasClass(".code-input") || (<string>$activeElement.val()).length == this.inputSize) {
                invalidElement.focus();
            }
            return;
        }
        this.clearMessage();
        this.disableForm(this.$main.find(".submit-code"));
        this.triggerEvent("submit", value, rememberDeviceId);
    }
    
    clearState() {
        this.enableForm();
        this.$main.find(".code-input").first().focus();
    }
    
    showMessage(type: string, message: string): void {
        let html = this.templateManager.createTemplate(messageTemplate).renderToJQ({type: type, message: message});
        this.$main.find(".message").removeClass("hide").empty().append(html);
        this.refreshWindowHeight();
    }
    
    clearMessage(): void {
        this.$main.find(".message").addClass("hide");
        this.refreshWindowHeight();
    }
}
