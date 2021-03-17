import * as Utils from "simplito-utils";
import {LocaleService} from "../../mail/LocaleService";
import {BaseWindowController} from "../../window/base/BaseWindowController";
import {app} from "../../Types";
import {IOC} from "../../mail/IOC";
import {MsgBoxWindowController, MsgBoxOptions, MsgBoxResult} from "../../window/msgbox/MsgBoxWindowController";

export interface WindowOpener {
    openChildWindow<T extends BaseWindowController>(win: T, delayedOpenDeferred?: Q.Deferred<T>): T;
    getChilWindowParent(): app.WindowParent;
}

export class MsgBoxCore {
    
    constructor(
        public optionsProvider: {msgBoxBaseOptions: MsgBoxOptions},
        public localeProvider: {i18n(key: string, ...args: any[]): string},
        public iocProvider: {getIoc(): IOC}
    ) {
    }
    
    getMsgBoxOptions(options: MsgBoxOptions, defaultOptions: MsgBoxOptions): MsgBoxOptions {
        let l1 = this.optionsProvider.msgBoxBaseOptions ? Utils.fillByDefaults(defaultOptions, this.optionsProvider.msgBoxBaseOptions) : defaultOptions;
        return Utils.fillByDefaults(options, l1);
    }
    
    alert(opener: WindowOpener, message?: string): Q.Promise<MsgBoxResult> {
        return this.alertEx(opener, {message: message});
    }
    
    alertEx(opener: WindowOpener, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBox(opener, this.getMsgBoxOptions(options, {
            focusOn: "ok",
            ok: {
                btnClass: "btn-success",
                visible: true
            }
        }));
    }
    
    confirm(opener: WindowOpener, message?: string): Q.Promise<MsgBoxResult> {
        return this.confirmEx(opener, {message: message || this.localeProvider.i18n("window.confirm.message")});
    }
    
    confirmEx(opener: WindowOpener, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBox(opener, this.getMsgBoxOptions(options, {
            message: this.localeProvider.i18n("window.confirm.message"),
            focusOn: "yes",
            yes: {
                btnClass: "btn-success",
                visible: true
            },
            no: {
                visible: true
            }
        }));
    }
    
    prompt(opener: WindowOpener, message?: string, value?: string): Q.Promise<MsgBoxResult> {
        return this.promptEx(opener, {
            message: message,
            input: {
                value: value || ""
            }
        });
    }
    
    promptEx(opener: WindowOpener, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBox(opener, this.getMsgBoxOptions(options, {
            focusOn: "input",
            selectionMode: "all",
            ok: {
                btnClass: "btn-success",
                visible: true
            },
            cancel: {
                visible: true
            },
            input: {
                visible: true,
                action: {result: "ok"}
            }
        }));
    }
    
    msgBox(opener: WindowOpener, options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.iocProvider.getIoc().create(MsgBoxWindowController, [opener.getChilWindowParent(), options]).then(controller => {
            opener.openChildWindow(controller);
            if (options.onWindowCreated) {
                options.onWindowCreated(controller.nwin);
            }
            controller.nwin.focus();
            return controller.getPromise();
        });
    }
}

export abstract class MsgBox {
    
    msgBoxCore: MsgBoxCore;
    msgBoxBaseOptions: MsgBoxOptions;
    
    constructor() {
        this.msgBoxCore = new MsgBoxCore(this, this, this);
    }
    
    static create(parent: app.WindowParentEx, localeService: LocaleService, ioc: IOC) {
        return new SimpleMsgBox(parent, localeService, ioc);
    }
    
    abstract getChilWindowParent(): app.WindowParent;
    abstract i18n(key: string, ...args: any[]): string;
    abstract openChildWindow<T extends BaseWindowController>(win: T, delayedOpenDeferred?: Q.Deferred<T>): T;
    abstract getIoc(): IOC;
    
    alert(message?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxCore.alert(this, message);
    }
    
    alertEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxCore.alertEx(this, options);
    }
    
    confirm(message?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxCore.confirm(this, message);
    }
    
    confirmEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxCore.confirmEx(this, options);
    }
    
    prompt(message?: string, value?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxCore.prompt(this, message, value);
    }
    
    promptEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxCore.promptEx(this, options);
    }
    
    msgBox(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxCore.msgBox(this, options);
    }
}

export class SimpleMsgBox extends MsgBox {
    
    constructor(
        public parent: app.WindowParentEx,
        public localeService: LocaleService,
        public ioc: IOC
    ) {
        super();
    }
    
    openChildWindow<T extends BaseWindowController>(win: T, delayedOpenDeferred?: Q.Deferred<T>): T {
        let parent = this.getChilWindowParent();
        if (!parent) {
            parent = this.parent;
        }
        return parent.openChildWindow(win);
    }
    
    getChilWindowParent(): app.WindowParentEx {
        if (!(this.parent instanceof BaseWindowController)) {
            return this.parent;
        }
        return this.parent ? this.parent.getClosestNotDockedController() : null;
    }
    
    i18n(key: string, ...args: any[]): string {
        return this.localeService.i18n.apply(this.localeService, arguments);
    }
    
    getIoc(): IOC {
        return this.ioc;
    }
}

