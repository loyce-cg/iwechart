import {BaseWindowController} from "../base/BaseWindowController";
import * as Utils from "simplito-utils";
import * as Q from "q";
import {app, webUtils} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Window } from "../../app/common/window";

export interface MsgBoxActionOptions {
    type?: string;
    result?: string;
    timeout?: number;
}

export interface MsgBoxAction {
    action?: MsgBoxActionOptions;
}

export interface MsgBoxButtonOptions extends MsgBoxAction {
    visible?: boolean;
    label?: string;
    faIcon?: string;
    btnClass?: string;
    btnSize?: string;
    order?: number;
    link?: {
        attrs?: {
            href?: string;
            download?: string;
            target?: string;
        }
    };
}

export interface MsgBoxInputOptions extends MsgBoxAction {
    preHtml?: string;
    visible?: boolean;
    multiline?: boolean;
    continous?: boolean;
    type?: string;
    readonly?: boolean;
    placeholder?: string;
    value?: string;
    height?: number;
}

export interface MsgBoxCheckBoxOptions {
    label?: string;
    checked?: boolean;
    visible?: boolean;
}

export interface MsgBoxOptions {
    showInactive?: boolean;
    alwaysOnTop?: boolean;
    width?: number;
    height?: number;
    closeResult?: string;
    message?: string;
    messageAsTemplateFunc?: webUtils.MailTemplateDefinition<MsgBoxOptions>;
    contentTemplate?: {templateId: string, model: any};
    info?: string;
    infoBelowButtons?: boolean;
    title?: string;
    focusOn?: string;
    selectionMode?: "all"|"filename";
    btnSize?: string;
    bodyClass?: string;
    ok?: MsgBoxButtonOptions;
    yes?: MsgBoxButtonOptions;
    no?: MsgBoxButtonOptions;
    cancel?: MsgBoxButtonOptions;
    input?: MsgBoxInputOptions;
    checkbox?: MsgBoxCheckBoxOptions;
    processing?: string;
    onClose?: (result: app.InteractiveModal) => void;
    bodyStyle?: string;
    autoHeight?: boolean;
    disableIPC?: boolean;
    onWindowCreated?: (nwin: Window) => void,
    extraHandlers?: { [key: string]: (() => void) },
}

export interface MsgBoxResult {
    result: string;
    value?: string;
    checked?: boolean;
}

export interface ViewResult {
    value: string;
    checked: boolean;
}

export class MsgBoxWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.msgbox.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    options: MsgBoxOptions;
    deferred: Q.Deferred<MsgBoxResult>;
    result: string;
    preventClose: boolean;
    
    constructor(parent: app.WindowParent, options: MsgBoxOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = !options.disableIPC;
        this.setViewBasicFonts();
        this.options = Utils.fillByDefaults(options, {
            width: 400,
            height: 215,
            closeResult: "close",
            message: "",
            title: "PrivMX",
            focusOn: "",
            btnSize: "",
            bodyClass: "",
            showInactive: false,
            ok: {
                visible: false,
                label: this.i18n("core.button.ok.label"),
                faIcon: "check",
                btnClass: "btn-default",
                action: {
                    type: "close",
                    result: "ok"
                }
            },
            yes: {
                visible: false,
                label: this.i18n("core.button.yes.label"),
                faIcon: "check",
                btnClass: "btn-default",
                action: {
                    type: "close",
                    result: "yes"
                }
            },
            no: {
                visible: false,
                label: this.i18n("core.button.no.label"),
                faIcon: "times",
                btnClass: "btn-default",
                action: {
                    type: "close",
                    result: "no"
                }
            },
            cancel: {
                visible: false,
                label: this.i18n("core.button.cancel.label"),
                faIcon: "ban",
                btnClass: "btn-default",
                action: {
                    type: "close",
                    result: "cancel"
                }
            },
            input: {
                visible: false,
                multiline: false,
                continous: false,
                type: "text",
                readonly: false,
                placeholder: "",
                value: "",
                height: 62,
                action: {
                    type: "close",
                    result: "input"
                }
            },
            checkbox: {
                label: "",
                checked: false,
                visible: false
            },
            processing: "bottom"
        });
        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = this.options.width;
        this.openWindowOptions.height = this.options.height;
        this.openWindowOptions.modal = true;
        this.openWindowOptions.alwaysOnTop = this.options.alwaysOnTop;
        this.openWindowOptions.showInactive = this.options.showInactive;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.title = this.options.title;
        (<app.WindowLoadOptionsRender>this.loadWindowOptions).bodyClass = this.options.bodyClass;
        this.deferred = Q.defer<MsgBoxResult>();
    }
    
    getModel(): MsgBoxOptions {
        if (this.options.disableIPC) {
            return this.options;
        }
        let options: any = {};
        for (let key in options) {
            let value = (<any>options)[key];
            if (typeof(value) != "function") {
                options[key] = value;
            }
        }
        return this.options;
    }
    
    onViewAction(name: string): void {
        let opt = <MsgBoxAction>(<any>this.options)[name];
        if (!opt) {
            if (this.options.extraHandlers && this.options.extraHandlers[name]) {
                this.options.extraHandlers[name]();
            }
            return;
        }
        this.result = opt.action.result;
        if (this.options.onClose) {
            this.retrieveFromView<ViewResult>("getValue")
            .then(value => {
                this.options.onClose({
                    result: this.result,
                    value: value.value,
                    checked: value.checked,
                    close: BaseWindowController.prototype.close.bind(this),
                    startProcessing: this.startProcessing.bind(this),
                    updateProcessing: this.updateProcessing.bind(this),
                    stopProcessing: this.stopProcessing.bind(this),
                    showInputError: this.showInputError.bind(this),
                    hideInputError: this.hideInputError.bind(this)
                });
            });
        }
        else if (opt.action.type == "close") {
            this.closeCore();
        }
        else if (opt.action.type == "hideAndClose") {
            setTimeout(() => {
                this.nwin.minimize();
                setTimeout(this.closeCore.bind(this), opt.action.timeout);
            }, 100);
        }
    }
    
    onViewEscape(): void {
        this.closeCore();
    }
    
    startProcessing(label: string): void {
        this.preventClose = true;
        this.callViewMethod("showProcessing", label);
    }
    
    updateProcessing(label: string): void {
        this.callViewMethod("updateProcessing", label);
    }
    
    stopProcessing(): void {
        this.preventClose = false;
        this.callViewMethod("hideProcessing");
    }
    
    showInputError(error: string): void {
        this.callViewMethod("showInputError", error);
    }
    
    hideInputError(): void {
        this.callViewMethod("hideInputError");
    }
    
    close(force?: boolean): void {
        if (this.preventClose) {
            return;
        }
        this.result = this.options.closeResult;
        if (this.options.onClose) {
            this.retrieveFromView<ViewResult>("getValue")
            .then(value => {
                this.options.onClose({
                    result: this.result,
                    value: value.value,
                    checked: value.checked,
                    close: BaseWindowController.prototype.close.bind(this),
                    startProcessing: this.startProcessing.bind(this),
                    updateProcessing: this.updateProcessing.bind(this),
                    stopProcessing: this.stopProcessing.bind(this),
                    showInputError: this.showInputError.bind(this),
                    hideInputError: this.hideInputError.bind(this)
                });
            });
        }
        else {
            this.closeCore();
        }
    }
    
    closeCore(): Q.Promise<void> {
        if (typeof(this.result) == "undefined") {
            this.result = this.options.closeResult;
        }
        let controller = this, value: ViewResult;
        return Q().then(() => {
            return controller.retrieveFromView<ViewResult>("getValue");
        })
        .then(v => {
            value = v;
            return BaseWindowController.prototype.close.call(controller);
        })
        .then(() => {
            controller.deferred.resolve({
                result: controller.result,
                value: value.value,
                checked: value.checked
            });
        });
    }
    
    getPromise(): Q.Promise<MsgBoxResult> {
        return this.deferred.promise;
    }
}
