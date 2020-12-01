import {UI} from "../../web-utils/UI";
import {func as buttonsTemplate} from "../../component/template/buttons.html";
import {ButtonsState} from "./EditorButtonsController";
import {ComponentView} from "../../component/base/ComponentView";
import {app} from "../../Types";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";

export class EditorButtonsView extends ComponentView {
    
    $main: JQuery;
    $container: JQuery;
    $buttons: JQuery;
    helper: MailClientViewHelper;
    _containerSizeChangedHandler: () => void = null;
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this.helper = this.templateManager.getHelperByClass(MailClientViewHelper);
    }
    
    init(model: ButtonsState) {
        this.$buttons = this.templateManager.createTemplate(buttonsTemplate).renderToJQ({
            enabled: model.enabled,
            buttons: [
                {
                    action: "edit",
                    enabled: model.edit,
                    icon: "fa-edit",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.edit.label")
                },
                {
                    action: "print",
                    enabled: model.print,
                    icon: "fa-print",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.print.label")
                },
                {
                    action: "save-as-pdf",
                    enabled: model.saveAsPdf,
                    icon: "privmx-icon privmx-icon-pdf",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.saveAsPdf.label")
                },
                {
                    action: "send",
                    enabled: model.send,
                    icon: "ico-paper-airplane left",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.send.label")
                },
                {
                    action: "export",
                    enabled: model.export,
                    icon: "fa-download",
                    label: model.systemLabel ? this.helper.i18n("component.editorButtons.toolbar.button.export.label.osSpecific", model.systemLabel) : this.helper.i18n("component.editorButtons.toolbar.button.export.label")
                },
                {
                    action: "attach-to-task",
                    enabled: model.attachToTask,
                    icon: "privmx-icon privmx-icon-tasks",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.attachToTask.label")
                },
                {
                    action: "open-external",
                    enabled: model.openExternal,
                    icon: "fa-folder-open-o",
                    label: model.systemLabel ? this.helper.i18n("component.editorButtons.toolbar.button.openExternal.label.osSpecific", model.systemLabel) : this.helper.i18n("component.editorButtons.toolbar.button.openExternal.label")
                },
                {
                    action: "lock",
                    enabled: model.lock,
                    icon: "fa-lock",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.lock.label")
                },

                {
                    action: "unlock",
                    enabled: model.unlock,
                    icon: "fa-unlock",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.unlock.label")
                },
                {
                    action: "close",
                    enabled: model.close,
                    icon: "fa-times",
                    label: this.helper.i18n("component.editorButtons.toolbar.button.close.label")
                }
            ]
        });
        this.$container.append(this.$buttons);
        UI.fadingDiv(this.$main, this.$buttons, false);
        this.$buttons.on("click", "[data-action='close']", this.onCloseClick.bind(this));
        this.$buttons.on("click", "[data-action='export']", this.onExportClick.bind(this));
        this.$buttons.on("click", "[data-action='edit']", this.onEditClick.bind(this));
        this.$buttons.on("click", "[data-action='send']", this.onSendClick.bind(this));
        this.$buttons.on("click", "[data-action='attach-to-task']", this.onAttachToTaskClick.bind(this));
        this.$buttons.on("click", "[data-action='open-external']", this.onOpenExternalClick.bind(this));
        this.$buttons.on("click", "[data-action='print']", this.onPrintClick.bind(this));
        this.$buttons.on("click", "[data-action='save-as-pdf']", this.onSaveAsPdfClick.bind(this));
        this.$buttons.on("click", "[data-action='lock']", this.onLockClick.bind(this));
        this.$buttons.on("click", "[data-action='unlock']", this.onUnlockClick.bind(this));
        if ((<any>window).ResizeObserver && !(<any>this.parent).printMode) {
            let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                this.triggerContainerSizeChanged();
            });
            resizeObserver.observe(this.$container[0]);
        }
    }
    
    setButtonsState(buttonsState: ButtonsState): void {
        this.$buttons.toggleClass("hidden-buttons", !buttonsState.enabled);
        this.$buttons.find("[data-action=edit]").toggleClass("hide", !buttonsState.edit);
        this.$buttons.find("[data-action=export]").toggleClass("hide", !buttonsState.export);
        this.$buttons.find("[data-action=send]").toggleClass("hide", !buttonsState.send);
        this.$buttons.find("[data-action=attach-to-task]").toggleClass("hide", !buttonsState.attachToTask);
        this.$buttons.find("[data-action=open-external]").toggleClass("hide", !buttonsState.openExternal);
        this.$buttons.find("[data-action=close]").toggleClass("hide", !buttonsState.close);
        this.$buttons.find("[data-action=print]").toggleClass("hide", !buttonsState.print);
        this.$buttons.find("[data-action=save-as-pdf]").toggleClass("hide", !buttonsState.saveAsPdf);
        this.$buttons.find("[data-action=unlock]").toggleClass("hide", !buttonsState.unlock);
        this.$buttons.find("[data-action=lock]").toggleClass("hide", !buttonsState.lock);
    }

    updateLockState(locked: boolean, canUnlock: boolean): void {
        let unlockAvail = locked && canUnlock;
        this.$buttons.find("[data-action=unlock]").toggleClass("hide", !unlockAvail);
        this.$buttons.find("[data-action=lock]").toggleClass("hide", locked);
    }
    
    setModel(buttonsStateStr: string): void {
        let buttonsState: ButtonsState = JSON.parse(buttonsStateStr);
        this.setButtonsState(buttonsState);
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onExportClick(): void {
        this.triggerEvent("export");
    }
    
    onEditClick(): void {
        this.triggerEvent("edit");
    }
    
    onSendClick(): void {
        this.triggerEvent("send");
    }
    
    onAttachToTaskClick(): void {
        this.triggerEvent("attachToTask");
    }
    
    onOpenExternalClick(): void {
        this.triggerEvent("openExternal");
    }
    
    onPrintClick(): void {
        this.triggerEvent("print");
    }
    
    onSaveAsPdfClick(): void {
        this.triggerEvent("saveAsPdf");
    }
    
    onUnlockClick(): void {
        this.triggerEvent("unlock");
    }

    onLockClick(): void {
        this.triggerEvent("lock");
    }
    
    getButtonsHeight(): number {
        let hidden = this.$buttons.hasClass("hide");
        if (hidden) {
            this.$buttons.addClass("hidden-for-height-calculations").removeClass("hide");
        }
        let height = this.$buttons.outerHeight(true);
        if (hidden) {
            this.$buttons.addClass("hide").removeClass("hidden-for-height-calculations");
        }
        return height;
    }
    
    triggerContainerSizeChanged(): void {
        if (this._containerSizeChangedHandler) {
            this._containerSizeChangedHandler();
        }
    }
    
    onContainerSizeChangedHandler(handler: () => void): void {
        this._containerSizeChangedHandler = handler;
    }
    
}