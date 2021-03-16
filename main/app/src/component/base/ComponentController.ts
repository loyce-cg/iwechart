import * as Q from "q";
import {Container, IComponent} from "../../utils/Container";
import {app} from "../../Types";
import * as RootLogger from "simplito-logger";
import { NonReportableError } from "../../utils/error/NonReportableError";
let Logger = RootLogger.get("privfs-mail-client.component.base.ComponentController");

export class ComponentController extends Container {
    
    static textsPrefix: string = "";
    
    className: string;
    parent: app.IpcContainer;
    requestId: number
    requests: {[id: number]: {id: number, defer: Q.Deferred<any>}};
    ipcSender: app.IpcSender;
    ipcMode: boolean;
    ipcSendPromise: Q.Promise<void>;
    ipcQueue: any[][];
    ipcChannelName: string;
    flushIpcQueueBinded: () => void;
        
    constructor(parent: app.IpcContainer, initIpc: boolean = true) {
        super(parent);
        this.ipcMode = true;
        this.requestId = 0;
        this.requests = {};
        this.ipcMode = false;
        this.flushIpcQueueBinded = this.flushIpcQueue.bind(this);
        if (initIpc) {
            this.ipcSender = this.createIpcSender(this.getIpcChannelName());
            this.ipcSender.addListener(this.onIpcMessage.bind(this));
        }
    }
    
    getIpcChannelName(): string {
        if (!this.ipcChannelName) {
            //this.ipcChannelName = window.performance.now() + "-" + Math.random();
            this.ipcChannelName = new Date().getTime() + "-" + Math.random();
        }
        return this.ipcChannelName;
    }
    
    createIpcSender(channelName: string): app.IpcSender {
        if (this.isDestroyed()) {
            throw new NonReportableError("Cannot create IpcSender on destroyed component");
        }
        return this.parent.createIpcSender(channelName);
    }
    
    getMyComponentId(): string {
        return this.parent ? this.parent.getComponentId(this) : null;
    }
    
    onIpcMessage(sender: any, data: any[]): void {
        this.onViewEventNextTick.apply(this, data);
    }
    
    onViewInit(channelId: number): void {
        this.sendToViewChannel(channelId, this.getModel());
    }
    
    getModel(): any {
        return null;
    }
    
    callViewMethod(method: string, ...args: any[]): void {
        if (this.isDestroyed()) {
            Logger.warn("Cannot call view method (" + method + ") on destroyed component");
            return;
        }
        let call = Array.prototype.slice.call(arguments);
        if (this.ipcSendPromise == null) {
            this.ipcQueue = [];
            this.ipcSendPromise = Q().then(this.flushIpcQueue.bind(this));
        }
        this.ipcQueue.push(call);
    }
    
    private flushIpcQueue() {
        try {
            this.ipcSendPromise = null;
            if (this.ipcSender) {
                this.ipcSender.send(this.ipcQueue);
                this.ipcQueue = null;
            }
        }
        catch (e) {
            Logger.error("flushIpcQueue error", e, e ? e.stack : null);
        }
    }
    
    sendToViewChannel(id: number, ...args: any[]): void {
        this.callViewMethod.apply(this, ["channelMessage"].concat(Array.prototype.slice.call(arguments, 0)));
    }
    
    retrieveFromView<T>(method: string, ...argss: any[]): Q.Promise<T> {
        if (this.isDestroyed()) {
            return Q().then(() => {
                throw new NonReportableError("Cannot retrieveFromView (" + method + ") from destroyed component");
            });
        }
        let request = {
            id: ++this.requestId,
            defer: Q.defer<any>()
        };
        this.requests[request.id] = request;
        let args = [request.id].concat(Array.prototype.slice.call(arguments, 0));
        this.callViewMethod("onRequest", ...args);
        return request.defer.promise;
    }
    
    onViewEventNextTick(name: string, ...args: any[]): void {
        this.onViewEvent(true, name, Array.prototype.slice.call(arguments, 1));
    }
    
    onViewEventTheSameTick(name: string, ...args: any[]): void {
        this.onViewEvent(false, name, Array.prototype.slice.call(arguments, 1));
    }
    
    onViewEvent(inNextTick: boolean, name: string, args: any[]): void {
        let methodName = "onView" + name.charAt(0).toUpperCase() + name.substring(1);
        if (methodName in this) {
            let func = <Function>(<any>this)[methodName];
            let context = this;
            if (inNextTick) {
                Q().then(() => {
                    try {
                        func.apply(context, args);
                    }
                    catch (e) {
                        Logger.error("onViewEvent error", e, e ? e.stack : null);
                    }
                });
            }
            else {
                func.apply(context, args);
            }
        }
    }
    
    onViewResponse(requestId: number, result: any): void {
        if (!(requestId in this.requests)) {
            return;
        }
        this.requests[requestId].defer.resolve(result);
        delete this.requests[requestId];
    }
    
    addComponent<T extends IComponent>(id: string, component: T): T {
        super.addComponent(id, component);
        if (component instanceof ComponentController) {
            component.setIpcChannelId(this.ipcChannelName + "-" + id);
        }
        return component;
    }
    
    setIpcChannelId(ipcChannelId: string): void {
        if (this.isDestroyed()) {
            throw new NonReportableError("Cannot setIpcChannelId on destroyed component");
        }
        this.ipcChannelName = ipcChannelId;
        this.ipcSender = this.createIpcSender(this.getIpcChannelName());
        this.ipcSender.addListener(this.onIpcMessage.bind(this));
        for (let id in this.components) {
            if (this.components[id] instanceof ComponentController) {
                this.components[id].setIpcChannelId(this.ipcChannelName + "-" + id);
            }
        }
    }
    
    destroy() {
        try {
            if (this.ipcSender) {
                this.ipcSender.destroy();
                this.ipcSender = null;
            }
        } catch (e) {}
        super.destroy();
    }
    
    
    
    
    // File logger:
    // * uncomment here and optionally in ComponentView
    // * change const fileName = "..."
    // * add isLogToFileEnabled: boolean = true in view/controller classes that should be logged
    // * log file will be overwritten after restarting app
    // * use tail -fn 100 (or similar)
    // * make sure that this code is commented out before commiting
    //
    // static isFirstLogToFileCall: boolean = true;
    // isLogToFileEnabled: boolean = false;
    // logToFile(...args: any[]): void {
    //     this._logToFile(new Date().getTime(), this.className, ...args);
    // }
    // _logToFile(timeStamp: number, sourceName: string, ...args: any[]): void {
    //     if (!this.isLogToFileEnabled) {
    //         return;
    //     }
    //     const fileName = "/home/wp/privmx-log.txt";
    //     const fn = require;
    //     const fs = fn("fs");
    //     if (ComponentController.isFirstLogToFileCall) {
    //         fs.writeFileSync(fileName, "\n\n");
    //         ComponentController.isFirstLogToFileCall = false;
    //     }
    //     let formatNumber = (num: number, len: number) => (<any>num.toString()).padStart(len, "0");
    //     let dt = new Date(timeStamp);
    //     let d = formatNumber(dt.getDate(), 2);
    //     let m = formatNumber(dt.getMonth(), 2);
    //     let Y = formatNumber(dt.getFullYear(), 4);
    //     let H = formatNumber(dt.getHours(), 2);
    //     let i = formatNumber(dt.getMinutes(), 2);
    //     let s = formatNumber(dt.getSeconds(), 2);
    //     let v = formatNumber(dt.getMilliseconds(), 3);
    //     let dtStr = `${d}.${m}.${Y} ${H}:${i}:${s}.${v}`;
    //     let msg: string = "";
    //     if (args && args.length == 1 && typeof(args[0]) == "string") {
    //         msg = args[0];
    //     }
    //     else if (args) {
    //         msg = "\n"
    //         msg += JSON.stringify(args, null, "\t")
    //             .split("\n")
    //             .map(x => `\t${x}`)
    //             .join("\n");
    //     }
    //     fs.appendFileSync(fileName, `[${dtStr}]    ${sourceName}    ${msg}\n`);
    // }
    // onViewLogToFile(timeStamp: number, className: string, dataStr: string): void {
    //     this._logToFile(timeStamp, className, ...JSON.parse(dataStr));
    // }
    
}
