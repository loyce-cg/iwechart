import * as $ from "jquery";
import { ComponentView } from "../base/ComponentView";
import * as Types from "../../Types";
import Q = require("q");

interface FieldState {
    contentEditable: boolean;
    wordBreak: string;
    focused: boolean;
    isButtonEnabled: boolean;
}

export class EncryptionEffectView extends ComponentView {
    static readonly EFFECT_DURATION_MS = 300;

    $field: JQuery;
    $button: JQuery;
    initialState: FieldState = null;
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
    }
    
    init(): Q.Promise<void> {
        return Q.resolve();
    }

    randomInt(min: number, max: number) {
        return min + Math.floor((max - min) * Math.random());
    }
    
    show(encryptedText: string): void {
        this.initialState = this.getState();
        this.applyState({
            contentEditable: false,
            wordBreak: "break-all",
            focused: false,
            isButtonEnabled: false,
        });
        this.setText(encryptedText);
    }

    customShowForChat(textLen: number): void {
        let elapsed = new Date().getTime();
        let rawBytes = new Uint8Array(textLen + Math.floor(textLen * 10 / 100));
        for (let i = 0; i < rawBytes.length; i++) {
            rawBytes[i] = this.randomInt(0, 255);
        }
        let encryptedText = Buffer.from(rawBytes.toString()).toString("base64");
        this.$field.parent().append($("<div class='effect-overlay'>" + encryptedText + "</div>"));
        let $overlay = this.$field.find(".effect-overlay");
        $overlay.css("position", "absolute");
        $overlay.css("z-index", "99999");
        this.$field.css("visibility", "hidden");
        setTimeout(() => {
            this.customHideForChat();
        }, EncryptionEffectView.EFFECT_DURATION_MS);
    }

    customHideForChat(): void {
        this.$field.css("visibility", "visible");
        this.$field.parent().find(".effect-overlay").remove();
        this.$field.focus();
    }

    hide(text: string): void {
        if (text !== null) {
            this.setText(text);
        }
        this.applyState(this.initialState);
    }
    
    setText(encryptedText: string): void {
        this.$field.text(encryptedText);
    }
    
    getState(): FieldState {
        return {
            contentEditable: this.$field.attr("contenteditable") == "true",
            wordBreak: this.$field.css("wordBreak"),
            focused: this.$field.is(":focus"),
            isButtonEnabled: !this.$button.prop("disabled"),
        };
    }
    
    applyState(state: FieldState): void {
        this.$field.attr("contenteditable", state.contentEditable ? "true" : "false");
        this.$field.css("wordBreak", state.wordBreak);
        if (state.focused) {
            this.$field.focus();
        }
        this.$button.prop("disabled", !state.isButtonEnabled);
    }

}