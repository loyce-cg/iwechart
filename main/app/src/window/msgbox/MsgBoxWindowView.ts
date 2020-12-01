import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {MsgBoxOptions, MsgBoxButtonOptions, ViewResult} from "./MsgBoxWindowController";
import {app} from "../../Types";

@WindowView
export class MsgBoxWindowView extends BaseWindowView<MsgBoxOptions> {
    
    options: MsgBoxOptions;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: MsgBoxOptions): void {
        this.options = model;
        this.fillLink($("[data-trigger=ok]"), this.options.ok);
        this.fillLink($("[data-trigger=yes]"), this.options.yes);
        this.fillLink($("[data-trigger=no]"), this.options.no);
        this.fillLink($("[data-trigger=cancel]"), this.options.cancel);
        this.$main.on("click", "[data-trigger]", this.onDataTriggerClick.bind(this));
        this.$main.on("keydown", "[data-input]", this.onInputKeyDown.bind(this));
        this.$main.on("click", "[data-copy]", (e: Event) => this.helper.onCopyClick(<MouseEvent>e));
        this.$main.on("click", "[data-copy-textarea-id]", (e: Event) => this.helper.onTextAreaCopyClick(<MouseEvent>e));
        
        this.focus();
        if (this.options.bodyClass) {
            $("body").addClass(this.options.bodyClass);
        }
        if (this.options.bodyStyle) {
            $("body").attr("style", this.options.bodyStyle);
        }
        if (model.autoHeight) {
            let $content = this.$main.find(".content");
            let newHeight = $("body").outerHeight() - $content.outerHeight() + $content[0].scrollHeight;
            this.triggerEventInTheSameTick("setWindowHeight", Math.ceil(newHeight));
        }
    }
    
    fillLink($ele: JQuery, options: MsgBoxButtonOptions): void {
        if ($ele.length > 0 && options.link && options.link.attrs) {
            let ele = <HTMLLinkElement>$ele[0];
            if (options.link.attrs.href) {
                ele.setAttribute("href", options.link.attrs.href);
            }
            if (options.link.attrs.download) {
                ele.setAttribute("download", options.link.attrs.download);
            }
            if (options.link.attrs.target) {
                ele.setAttribute("target", options.link.attrs.target);
            }
        }
    }

    focus(): void {
        if (this.options.focusOn == "input") {
            let $ele = this.$main.find("[data-input]");
            if (window.document.activeElement != $ele[0]) {
                let filename:string = (<HTMLInputElement>$ele.get(0)).value;
                if (filename.indexOf(".") != -1) {
                    $ele.focus();
                    let selectionEnd = this.options.selectionMode == "filename" ? filename.lastIndexOf(".") : filename.length;
                    (<HTMLInputElement>$ele.get(0)).setSelectionRange(0, selectionEnd);
                }
                else {
                    $ele.focus().select();
                }
            }
        }
        else if (this.options.focusOn) {
            let $ele = this.$main.find("[data-trigger=" + this.options.focusOn + "]");
            if (window.document.activeElement != $ele[0]) {
                $ele.focus();
            }
        }
    }
    
    onDataTriggerClick(event: MouseEvent): void {
        this.triggerEvent("action", $(event.target).closest("[data-trigger]").data("trigger"));
    }
    
    onInputKeyDown(event: KeyboardEvent): void {
        if (this.options.input.multiline == false && event.keyCode == 13) {
            event.preventDefault();
            this.triggerEvent("action", "input");
        }
    }
    
    onBodyKeydown(event: KeyboardEvent): void {
        if (event.keyCode == 27) {
            event.preventDefault();
            this.triggerEvent("escape");
        }
    }
    
    getValue(): ViewResult {
        return {
            value: this.options.input.visible ? <string>this.$main.find("[data-input]").val() : null,
            checked: this.options.checkbox.visible ? <boolean>this.$main.find("[data-checkbox]").is(":checked") : null
        };
    }
    
    showProcessing(label: string): void {
        let $processing = this.$main.find(".processing").addClass("active");
        if (this.options.processing == "bottom") {
            $processing.find(".process-label").html('<i class="fa fa-spin fa-circle-o-notch"></i> ' + label);
        }
        else {
            this.$main.find("[data-trigger='" + this.options.processing + "'] i").removeClass().addClass("fa fa-spin fa-circle-o-notch");
        }
    }
    
    updateProcessing(label: string): void {
        if (this.options.processing == "bottom") {
            this.$main.find(".processing").find(".process-label").html('<i class="fa fa-spin fa-circle-o-notch"></i> ' + label);
        }
    }
    
    hideProcessing(): void {
        let $processing = this.$main.find(".processing").removeClass("active");
        if (this.options.processing == "bottom") {
            $processing.find(".process-label").html("");
        }
        else {
            let opt = <MsgBoxButtonOptions>(<any>this.options)[this.options.processing];
            this.$main.find("[data-trigger='" + this.options.processing + "'] i").removeClass().addClass("fa fa-" + opt.faIcon);
        }
    }
    
    showInputError(error: string): void {
        this.$main.find(".input-error").addClass("active").html(error);
    }
    
    hideInputError(): void {
        this.$main.find(".input-error").removeClass("active").html("");
    }
}
