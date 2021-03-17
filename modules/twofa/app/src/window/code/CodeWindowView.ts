import {webUtils, window, Types, JQuery as $} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {func as messageTemplate} from "./template/messageTemplate.html";
import {Model} from "./CodeWindowController";
import { ChallengeModel } from "../../main/TwofaApi";

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
        // Typings for navigator.credentials are available from typescript@3.6 DOM lib
        // navigator.credentials is available is only available in secure context,
        // in browser its https, in electron you have to set secure context on you own
        try {
            if (model.u2f && model.u2f.login) {
                (<any>navigator).credentials.get({publicKey: model.u2f.login}).then((res: any) => {
                    let model: ChallengeModel = {
                        u2fLogin: {
                            id: res.id,
                            rawId: <any>new Uint8Array(res.rawId),
                            type: res.type,
                            response: {
                                authenticatorData: <any>new Uint8Array(res.response.authenticatorData),
                                clientDataJSON: <any>new Uint8Array(res.response.clientDataJSON),
                                signature: <any>new Uint8Array(res.response.signature),
                                userHandle: res.response.userHandle ? <any>new Uint8Array(res.response.userHandle) : res.response.userHandle
                            }
                        },
                        rememberDeviceId: this.getRemeberDeviceIdValue()
                    };
                    this.triggerEvent("submit", model);
                })
                .catch((e: any) => {
                    this.showMessage("Error", "error");
                    console.error("Error", e, e ? e.message : null, e ? e.stack : null);
                });
            }
            else if (model.u2f && model.u2f.register) {
                (<any>navigator).credentials.create({publicKey: model.u2f.register}).then((res: any) => {
                    let model: ChallengeModel = {
                        u2fRegister: {
                            id: res.id,
                            rawId: <any>new Uint8Array(res.rawId),
                            type: res.type,
                            response: {
                                attestationObject: <any>new Uint8Array(res.response.attestationObject),
                                clientDataJSON: <any>new Uint8Array(res.response.clientDataJSON)
                            }
                        },
                        rememberDeviceId: this.getRemeberDeviceIdValue()
                    };
                    this.triggerEvent("submit", model);
                })
                .catch((e: any) => {
                    this.showMessage("Error", "error");
                    console.error("Error", e, e ? e.message : null, e ? e.stack : null);
                });
            }
        }
        catch (e) {
            console.log("Error", e);
            this.showMessage("Error", "error");
        }
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
    
    getRemeberDeviceIdValue() {
        return this.$main.find(".remember-device-id").is(":checked");
    }
    
    submit() {
        let value = "";
        let invalidElement: HTMLInputElement;
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
        let model: ChallengeModel = {
            code: value,
            rememberDeviceId: this.getRemeberDeviceIdValue()
        };
        this.triggerEvent("submit", model);
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
