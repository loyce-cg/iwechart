import {ComponentInitializer} from "../../component/base/ComponentInitializer";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import * as Q from "q";
import * as Types from "../../Types";
import {PromiseUtils} from "simplito-promise";
import * as $ from "jquery";
import {ObjectFactory} from "../../utils/ObjectFactory";
import {Container} from "../../utils/Container";
import {ViewManager} from "../../app/common/ViewManager";
import {CommonApplication} from "../../app/common/CommonApplication";
import {BaseWindowView} from "./BaseWindowView";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.window.base.Starter");
RootLogger.setLevel(RootLogger.ERROR);

export interface Holder {
    initView: () => void;
    require: (name: string) => any;
    electronRequire: (name: string) => any;
    privmxViewRequire(name: "Starter"): {Starter: Starter};
    privmxViewRequire(name: "simplito-logger"): typeof RootLogger;
    privmxViewRequire(name: string): any;
    installDevTron: () => void;
}

export interface ControllerInitData {
    nodeModulesDir: string;
    servicesDefinitions: Types.ipc.IpcServicesDefinitions;
    viewLogLevel: string;
    preventLinkOpenageInView: boolean;
    controllerId: number;
    ipcChannelName: string;
    helperModel: Types.app.MailClientViewHelperModel;
    viewModel: any;
}

let holder: Holder = <any>window;

export class Starter extends Container {
    
    docked: {[id: string]: {load: Types.app.WindowLoadOptions, iframe: HTMLIFrameElement}};
    className: string;
    pluginName: string;
    viewInstance: any;
    parentStarter: Starter;
    dockedId: string;
    viewInitDefer: Q.Deferred<void>;
    fontsLoadedDefer: Q.Deferred<void>;
    objectFactory: ObjectFactory;
    viewManager: ViewManager;
    nodeModulesDir: string;
    ipc: Types.ipc.IpcRenderer;
    fontsCount: number;
    
    constructor() {
        super();
        this.docked = {};
        this.viewInitDefer = Q.defer();
        this.fontsLoadedDefer = Q.defer();
        this.objectFactory = new ObjectFactory();
        this.components = {};
        this.viewManager = new ViewManager(this);
        holder.installDevTron = this.installDevTron.bind(this);
    }
    
    installDevTron() {
        if (this.nodeModulesDir) {
            holder.require = holder.electronRequire;
            let module = holder.electronRequire("module");
            module.Module.globalPaths.push(this.nodeModulesDir);
            holder.electronRequire("devtron").install()
        }
        else {
            Logger.error("Cannot install dev tron app is not present");
        }
    }
    
    onViewInitialized(callback: () => void): void {
        this.viewInitDefer.promise.then(callback);
    }
    
    loadScript(src: string) {
        // console.log("loadScript", src);
        let defer = Q.defer<void>();
        let script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        
        script.setAttribute("src", src);
        script.async = true;
        script.addEventListener("load", () => {
            defer.resolve();
        }, false);
        script.addEventListener("error", e => {
            defer.reject({msg: "Cannot load script", src: src, e: e});
        });
        document.getElementsByTagName("head")[0].appendChild(script);
        return defer.promise;
    }

    createScript(scriptBody: string) {
        // console.log("createScript", scriptBody);
        let s = document.createElement('script');
        s.type = 'text/javascript';
        try {
          s.appendChild(document.createTextNode(scriptBody));
          document.body.appendChild(s);
        } catch (e) {
          s.text = scriptBody;
          document.body.appendChild(s);
        }
    }
    
    loadStyle(src: string) {
        let defer = Q.defer<void>();
        let style = document.createElement("link");
        style.setAttribute("media", "all");
        style.setAttribute("rel", "stylesheet");
        style.setAttribute("href", src);
        style.addEventListener("load", () => {
            defer.resolve();
        }, false);
        style.addEventListener("error", e => {
            defer.reject({msg: "Cannot load style", src: src, e: e});
        });
        document.getElementsByTagName("head")[0].appendChild(style);
        return defer.promise;
    }
    
    initBase(load: Types.app.WindowLoadOptionsBase): Q.Promise<void> {
        // console.log("init base")
        return Q().then(x => {
            return PromiseUtils.oneByOne(load.styles, (i, src) => {
                return this.loadStyle(src);
            });
        })
        .then(() => {
            // console.log("load dynamic scripts of ", load.dynamicScripts.length);
            load.dynamicScripts.forEach(s => this.createScript(s));
        })

        .then(() => {
            return PromiseUtils.oneByOne(load.scripts, (i, src) => {
                return this.loadScript(src);
            });
        })
        .then(() => {
            this.init(load.viewName);
        });
    }
    
    getParameterByName(name: string, url?: string): string {
        if (!url) {
            url = window.location.href;
        }
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'), results = regex.exec(url);
        if (!results) {
            return null;
        }
        if (!results[2]) {
            return '';
        }
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }
    
    checkFonts() {
        if ((<any>document).fonts && this.fontsCount > 0) {
            let timeoutId = setTimeout(() => {
                this.fontsLoadedDefer.resolve();
            }, 10 * 1000);
            let loadedFonts = 0;
            (<any>document).fonts.onloadingdone = (fontFaceSetEvent: any) => {
                loadedFonts += fontFaceSetEvent.fontfaces.length;
                if (loadedFonts >= this.fontsCount) {
                    clearTimeout(timeoutId);
                    this.fontsLoadedDefer.resolve();
                }
            };
        }
        else {
            this.fontsLoadedDefer.resolve();
        }
    }
    
    init(className: string, pluginName?: string, fontsCount?: number): void {
        this.dispatchEvent<Types.event.StarterLoadEvent>({type: "load", target: this});
        this.fontsCount = fontsCount == null ? 8 : fontsCount;
        this.checkFonts();
        this.className = className;
        this.pluginName = pluginName;
        if (holder.require) {
            holder.electronRequire = holder.require;
            delete holder.require;
            return this.initAfterRequire();
        }
        holder.initView = this.initAfterRequire.bind(this);
    }

    initAfterRequire(): void {
        this.ipc = holder.electronRequire("electron").ipcRenderer;
        
        this.ipc.on("controller-start", this.onControllerStart.bind(this));
        this.ipc.on("docked", this.onDocked.bind(this));
    }
    
    onControllerStart(_evt: Types.ipc.IpcRendererEvent, data: ControllerInitData): void {
        this.fontsLoadedDefer.promise.then(() => {
            $("#font-loader").remove();
            
            try {
                this.viewManager.controllerId = data.controllerId;
                this.viewManager.servicesDefinitions = data.servicesDefinitions;
                this.viewManager.preventLinkOpenage = data.preventLinkOpenageInView;
                let Logger = holder.privmxViewRequire("simplito-logger");
                Logger.setLevel((<any>Logger)[data.viewLogLevel]);
                let templateManager = this.viewManager.getTemplateManager();
                let k = new Date().getTime().toString()
                templateManager.registerHelper(new MailClientViewHelper(templateManager, data.helperModel));
                this.dispatchEvent<Types.event.TemplateManagerCreatedEvent>({
                    type: "templatemanagercreated",
                    templateManager: templateManager,
                    helperModel: data.helperModel,
                });
                holder.privmxViewRequire("privmx-view");
                let result = ComponentInitializer.init(
                    this.objectFactory.createByName<BaseWindowView<any>>(this.className, this.viewManager),
                    data.ipcChannelName
                );
                this.registerInstance(result.view);
                result.initPromise.then(() => {
                    this.viewInitDefer.resolve();
                })
                .fail(e => {
                    Logger.error("View init error", e, (e ? e.stack : null));
                });
                this.viewInstance = result.view;
                window.addEventListener("unload", () => {
                    this.viewInstance.destroy();
                });
            }
            catch (e) {
                Logger.error("Starter error", e, (e ? e.stack : null));
            }
        });
    }
    
    onDocked(evt: Types.ipc.IpcRendererEvent, data: {route: string[], name: string, data: any}): void {
        data = {route: data.route.slice(), name: data.name, data: data.data};
        let id = data.route.pop();
        if (id in this.docked) {
            if (data.route.length == 0) {
                if (data.name == "controller-start") {
                    (<Holder><any>this.docked[id].iframe.contentWindow).privmxViewRequire("Starter").Starter.onControllerStart(evt, data.data);
                }
            }
            else {
                (<Holder><any>this.docked[id].iframe.contentWindow).privmxViewRequire("Starter").Starter.onDocked(evt, data);
            }
        }
    }
    
    registerDockedWindow(id: number, load: Types.app.WindowLoadOptions, parent: HTMLElement): HTMLIFrameElement {
        let iframe = document.createElement("iframe");
        if (parent) {
            parent.appendChild(iframe);
        }
        if (load.type == "html") {
            iframe.setAttribute("data-name", load.name);
            let url = URL.createObjectURL(new Blob([load.html], {type : "text/html"}));
            iframe.setAttribute("src", url);
        }
        else if (load.type == "url") {
            iframe.src = load.url;
        }
        else if (load.type == "base") {
            iframe.src = load.baseUrl + "?id=" + id;
        }
        let idStr = id.toString();
        this.docked[idStr] = {load: load, iframe: iframe};
        iframe.onload = () => this.onDockedLoad(idStr);
        return iframe;
    }
    
    onDockedLoad(id: string): void {
        let w = this.docked[id];
        
        if (w.load.type == "base") {
            (<Holder><any>w.iframe.contentWindow).privmxViewRequire("Starter").Starter.initBase(w.load).then(() => {
                this.onDockedLoad2(id);
            })
            .fail((e: any) => {
                Logger.error("Error during init docked base view", e);
                alert("Error during init docked base view");
            });
        }
        else {
            this.onDockedLoad2(id);
        }
    }
    
    onDockedLoad2(id: string): void {
        let w = <Holder><any>this.docked[id].iframe.contentWindow;
        w.electronRequire = holder.electronRequire;
        let wl = w.privmxViewRequire("simplito-logger");
        wl.setLevel(wl.WARN);
        let starter = <Starter>w.privmxViewRequire("Starter").Starter;
        starter.ipc = this.ipc;
        starter.dockedId = id;
        starter.parentStarter = this;
        this.informFromDocked([id], "loaded");
        starter.onViewInitialized(() => {
            this.informFromDocked([id], "initialized");
        });
    }
    
    informFromDocked(route: string[], name: string): void {
        if (this.parentStarter == null) {
            this.ipc.send("docked", {
                route: route,
                name: name
            });
        }
        else {
            route.push(this.dockedId);
            this.parentStarter.informFromDocked(route, name);
        }
    }
    
    findDockedFrame(route: string[]): HTMLIFrameElement {
        route = route.slice();
        let id = route.pop();
        if (id in this.docked) {
            if (route.length == 0) {
                return this.docked[id].iframe;
            }
            else {
                return (<Holder><any>this.docked[id].iframe.contentWindow).privmxViewRequire("Starter").Starter.findDockedFrame(route);
            }
        }
    }
    
    triggerJQEvent(name: string): void {
        if (this.viewInstance) {
            this.viewInstance.triggerJQEvent(name);
        }
    }
}
