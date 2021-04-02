import {TemplateManager} from "../../web-utils/template/Manager";
import {ProgressViewContainer} from "../channel/ProgressViewContainer";
import * as Q from "q";
import {Container} from "../../utils/Container";
import {app, event} from "../../Types";
import {ViewManager} from "../../app/common/ViewManager";
import * as RootLogger from "simplito-logger";

enum ViewState {
    NOT_LOADED,
    LOADING,
    LOADED
}

interface MethodCalls {
    lastId: number;
    list: MethodCall[];
    binded: () => void;
    promise: Q.Promise<void>;
}

interface MethodCall {
    loggedProblems?: boolean;
    id: number;
    name: string;
    args: any[];
}

export class ComponentView extends Container {
    
    static LOG_TRIGGER_INIT_ERRORS: boolean = true;
    
    logger: typeof RootLogger;
    className: string;
    viewManager: ViewManager;
    parent: app.ViewParent;
    templateManager: TemplateManager;
    private methodCalls: MethodCalls;
    channelId: number;
    channels: {[id: number]: Function};
    performingControllerCalls: boolean;
    private loadingState: ViewState = ViewState.NOT_LOADED;
    _triggerInitPromise: Q.Promise<void>;
    ipcCallback: Function;
    ipcChannelName: string = null;
    ipcMode: boolean;
    _model: any;
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this.logger = RootLogger.get(this.constructor.name);
        this.ipcMode = true;
        this.viewManager = this.parent.viewManager;
        this.templateManager = this.viewManager.getTemplateManager();
        this.methodCalls = {
            lastId: 0,
            list: [],
            binded: this.callMethods.bind(this),
            promise: null
        };
        this.channelId = 0;
        this.channels = {};
    }
    
    addIpcListener(channel: string, callback: Function): void {
        this.parent.addIpcListener(channel, callback);
    }
    
    removeIpcListener(channel: string, callback: Function): void {
        this.parent.removeIpcListener(channel, callback);
    }
    
    sendIpcMessage(channel: string, message: any): void {
        this.parent.sendIpcMessage(channel, message);
    }
    
    getMyComponentId(): string {
        return this.parent ? this.parent.getComponentId(this) : null;
    }
    
    isViewLoaded(): boolean {
        return this.loadingState == ViewState.LOADED;
    }
    
    isViewLoading(): boolean {
        return this.loadingState == ViewState.LOADING;
    }
    
    bindToController(): boolean {
        if (this.ipcChannelName == null && this.parent instanceof ComponentView && this.parent.ipcChannelName != null) {
            let id = this.getMyComponentId();
            if (id == null) {
                this.logger.warn("View is not child of its parent", this);
                return false;
            }
            this.ipcChannelName = this.parent.ipcChannelName + "-" + id;
        }
        if (this.ipcChannelName != null) {
            this.ipcCallback = this.onIpcMessage.bind(this);
            this.addIpcListener(this.ipcChannelName, this.ipcCallback);
            return true;
        }
        this.logger.warn("Cannot bind view with controller - ipc channel name not present", this.getMyComponentId(), this);
        return false;
    }
    
    onIpcMessage(sender: any, data: any[][]) {
        this.performingControllerCalls = true;
        for (let i = 0; i < data.length; i++) {
            try {
                this.onCallMethod.apply(this, data[i]);
            }
            catch (e) {
                this.logger.error("Error during processing IPC message", data[i], e);
            }
        }
        this.performingControllerCalls = false;
        this.finalizeControllerCall();
    }
    
    triggerEvent(name: string, ...args: any[]): void {
        let call = Array.prototype.slice.call(arguments);
        this.sendIpcMessage(this.ipcChannelName, call);
    }
    
    triggerEventInTheSameTick(name: string, ...args: any[]): void {
        let call = Array.prototype.slice.call(arguments);
        this.sendIpcMessage(this.ipcChannelName, call);
    }
    
    onCallMethod(methodName: string, ...args: any[]): void {
        try {
            if (methodName in this) {
                this.methodCalls.list.push({
                    id: this.methodCalls.lastId++,
                    name: methodName,
                    args: Array.prototype.slice.call(arguments, 1)
                });
                this.flushPendingCalls();
            }
            else {
                this.logger.warn("ComponentView - no method", methodName, "in ", this.constructor.name);
            }
        }
        catch (e) {
            if (e.name != "NS_ERROR_NOT_INITIALIZED") {
                throw e;
            }
        }
    }
    
    flushPendingCalls() {
        if (this.methodCalls.promise == null) {
            this.methodCalls.promise = Q().then(this.methodCalls.binded);
        }
    }
    
    callMethods() {
        try {
            this.methodCalls.promise = null;
            this.performingControllerCalls = true;
            const pendingCalls: MethodCall[] = []
            for (let i = 0; i < this.methodCalls.list.length; i++) {
                let methodCall = this.methodCalls.list[i];
                try {
                    if (this.isViewLoaded() || methodCall.name == "channelMessage") {
                        (<Function>(<any>this)[methodCall.name]).apply(this, methodCall.args);
                    }
                    else if (this.isViewLoading()) {
                        if (!methodCall.loggedProblems) {
                            this.logger.warn("Calling method " + methodCall.name + " (id=" + methodCall.id + ") on view in loading state (not ready)");
                        }
                        methodCall.loggedProblems = true;
                        pendingCalls.push(methodCall);
                    }
                    else {
                        this.logger.warn("Calling method " + methodCall.name + " (id=" + methodCall.id + ") on non existant view");
                    }
                }
                catch (e) {
                    this.logger.error("callViewMethod error", e, e ? e.stack : null);
                }
            }
            this.methodCalls.list = pendingCalls;
            this.performingControllerCalls = false;
            this.finalizeControllerCall();
        }
        catch (e) {
            this.logger.error("callMethods error", e, e ? e.stack : null);
        }
    }
    
    finalizeControllerCall(): void {
    }
    
    onRequest(requestId: number, methodName: string): void {
        if (!(methodName in this)) {
            return;
        }
        let result = (<Function>(<any>this)[methodName]).apply(this, Array.prototype.slice.call(arguments, 2));
        if (typeof(result) == "object" && result && typeof(result.then) == "function") {
            result.then((promiseResult: any) => {
                this.triggerEvent("response", requestId, promiseResult);
            });
            return;
        }
        this.triggerEvent("response", requestId, result);
    }
    
    newChannel(callback: Function): number {
        let channelId = this.channelId++;
        this.channels[channelId] = callback;
        return channelId;
    }
    
    destroyChannel(channelId: number): void {
        delete this.channels[channelId];
    }
    
    channelMessage(id: number, ...args: any[]): void {
        if (id in this.channels) {
            this.channels[id].apply(this, Array.prototype.slice.call(arguments, 1));
        }
    }
    
    channelPromise<T = void>(name: string, ...args: any[]): Q.Promise<T> {
        let defer = Q.defer<T>();
        let id = this.newChannel((result: T) => {
            this.destroyChannel(id);
            defer.resolve(result);
        });
        let eventArgs = [name, id].concat(Array.prototype.slice.call(arguments, 1));
        this.triggerEvent.apply(this, eventArgs);
        return defer.promise;
    }
    
    addComponentAndInitBefore<T extends ComponentView>(id: string, component: T): T {
        this.addComponent(id, component);
        this.addEventListener<event.ComponentViewInitEvent>("beforeinit", event => {
            if (event.target == component.parent) {
                event.result = component.triggerInit();
            }
        });
        return component;
    }
    
    addComponentAndInitAfter<T extends ComponentView>(id: string, component: T): T {
        this.addComponent(id, component);
        this.addEventListener<event.ComponentViewInitEvent>("afterinit", event => {
            if (event.target == component.parent) {
                event.result = component.triggerInit();
            }
        });
        return component;
    }
    
    triggerInit(): Q.Promise<void> {
        if (this._triggerInitPromise == null) {
            if (!this.bindToController()) {
                this.logger.warn("Cannot triggerInit - view is not binded with controller", this);
                this._triggerInitPromise = Q();
            }
            else {
                this._triggerInitPromise = Q().then(() => {
                    return Q.all(this.dispatchEventGather(<event.ComponentViewInitEvent>{
                        type: "beforeinit",
                        target: this,
                        bubbleable: false
                    }).filter(x => !!x));
                })
                .then(() => {
                    this.loadingState = ViewState.LOADING;
                    return this.channelPromise<any>("init")
                    .then(model => {
                        this._model = model;
                    });
                })
                .then(() => {
                    return this.init(this._model);
                })
                .then(() => {
                    return Q.all(this.dispatchEventGather(<event.ComponentViewInitEvent>{
                        type: "afterinit",
                        target: this,
                        bubbleable: false
                    }).filter(x => !!x));
                })
                .then(() => {
                    this.loadingState = ViewState.LOADED;
                    this.flushPendingCalls();
                    this.triggerEvent("load");
                    this.triggerEvent("componentViewLoaded");
                })
                .fail(e => {
                    if (ComponentView.LOG_TRIGGER_INIT_ERRORS) {
                        this.logger.error("Error during triggerInit", this, e)
                    }
                    return Q.reject(e);
                });
            }
        }
        return this._triggerInitPromise;
    }
    
    init(model: any): Q.IWhenable<void> {
    }
    
    triggerEventWithProgressContainer(name: string, ...argsArg: any[]): ProgressViewContainer {
        let progress = new ProgressViewContainer(this);
        let args = [name, progress.id].concat(Array.prototype.slice.call(arguments, 1));
        this.triggerEvent.apply(this, args);
        return progress;
    }
    
    destroy() {
        super.destroy();
        if (this.ipcChannelName && this.ipcCallback) {
            this.removeIpcListener(this.ipcChannelName, this.ipcCallback);
        }
    }
}
