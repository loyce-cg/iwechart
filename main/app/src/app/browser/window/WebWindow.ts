import {Window as AppWindow} from "../../common/window/Window";
import {Require} from "../electron/Require";
import {WindowManager} from "./WindowManager";
import {WindowHeader} from "./WindowHeader";
import {WindowWidget} from "./WindowWidget";
import {Starter} from "../../../window/base/Starter";
import {app} from "../../../Types";
import * as $ from "jquery";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.app.browser.window.WebWindow");

export interface InjectedWindow {
    electronRequire: Function;
    initView: Function;
    privmxViewRequire(name: "Starter"): {Starter: Starter};
    privmxViewRequire(name: string): any;
}

export interface WindowPosition {
    width: string;
    height: string;
    x: string;
    y: string;
    restore: app.WindowState;
}

export class WebWindow extends AppWindow {
    manager: WindowManager;
    load: app.WindowLoadOptions;
    iframe: HTMLIFrameElement;
    container: HTMLElement;
    iframeContainer: HTMLElement;
    controllerId: number;
    ipcChannelName: string;
    require: Require;
    window: Window;
    options: app.WindowOptions;
    $loadingScreen: JQuery;
    distractionFreeMode: boolean;
    dfmIframe: HTMLIFrameElement;
    domElement: HTMLElement;
    stateBeforeMaximize: WindowPosition;
    stateBeforeMinimize: WindowPosition;
    maximized: boolean;
    minimized: boolean;
    header: WindowHeader;
    widget: WindowWidget;
    closable: boolean;
    alwaysOnTop: boolean;
    
    constructor(manager: WindowManager, load: app.WindowLoadOptions, iframe: HTMLIFrameElement, container: HTMLElement, iframeContainer: HTMLElement, controllerId: number, ipcChannelName: string) {
        super();
        this.manager = manager;
        this.load = load;
        this.iframe = iframe;
        this.container = container;
        this.iframeContainer = iframeContainer;
        this.controllerId = controllerId;
        this.ipcChannelName = ipcChannelName;
        this.require = this.manager.electronModule.createRequire();
        this.closable = this.options ? this.options.closable : true;
        this.alwaysOnTop = this.options ? !!this.options.alwaysOnTop : false;
    }
    
    start(): void {
        (<InjectedWindow><any>this.iframe.contentWindow).electronRequire = this.require.requireBinded;
        if ((<InjectedWindow><any>this.iframe.contentWindow).initView) {
            (<InjectedWindow><any>this.iframe.contentWindow).initView();
        }
        let app = this.manager.app;
        this.require.electron.ipcRenderer.dispatchEvent("controller-start", {
            nodeModulesDir: app.getNodeModulesDir(),
            servicesDefinitions: app.ipcHolder.getServicesDefinitions(),
            viewLogLevel: app.getViewLogLevel(),
            preventLinkOpenageInView: app.preventLinkOpenageInView(),
            controllerId: this.controllerId,
            ipcChannelName: this.ipcChannelName,
            helperModel: app.getMailClientViewHelperModel(),
        });
        if (this.options.hidden) {
            this.domElement.style.visibility = "hidden";
        }
    }
    
    sendIpc(channel: string, data: any): void {
        this.require.electron.ipcRenderer.dispatchEvent(channel, data);
    }
    
    sendFromDocked(route: string[], name: string, data: any): void {
        this.require.electron.ipcRenderer.dispatchEvent("docked", {
            route: route,
            name: name,
            data: data
        });
    }
    
    show() {
    }
    
    hide() {
    }
    
    close(force?: boolean): void {
        if (force === true) {
            this.destroy();
            if (this.options.modal) {
                $("#windows-overlay").addClass("hidden");
            }
            let index = this.manager.instances.indexOf(this);
            if (index != -1) {
                this.manager.instances.splice(index, 1);
                this.manager.focusOnTheMostTopWindow();
                this.manager.updateOpenedWindowsCounter();
            }
        }
        else {
            if (this.getClosable()) {
                this.events.trigger("close");
            }
        }
    }
    
    showLoadingScreen(): void {
        if (!this.$loadingScreen) {
            this.$loadingScreen = $("#templates").find(".window-loading-screen").clone();
        }
        this.$loadingScreen.prependTo(this.iframeContainer);
    }
    
    hideLoadingScreen(): void {
        if (this.$loadingScreen) {
            this.$loadingScreen.detach();
        }
    }
    
    loaded(): void {
        let iw = (<InjectedWindow><any>this.iframe.contentWindow);
        if (this.load.type == "base") {
            iw.privmxViewRequire("Starter").Starter.initBase(this.load).then(() => {
                this.loaded2();
            })
            .fail(e => {
                Logger.error(e);
                alert("Error during init base view");
            });
        }
        else {
            this.loaded2();
        }
    }
    
    loaded2(): void {
        this.focus();
        this.events.trigger("loaded");
        (<InjectedWindow><any>this.iframe.contentWindow).privmxViewRequire("Starter").Starter.onViewInitialized(() => {
            this.events.trigger("initialized");
        });
    }
    
    resized(type: string): void {
        this.events.trigger("resize", type);
    }
    
    enterDistractionFreeMode(): void {
        this.distractionFreeMode = true;
        $("#windows-container").addClass("distraction-free-mode");
        $(this.dfmIframe).addClass("distraction-free-mode");
        if (!this.manager.fullscreen.isInFullscreenMode()) {
            this.manager.fullscreen.toggleFullscreenMode();
        }
        if (this.iframe === this.dfmIframe) {
            this.maximize();
        }
        (<InjectedWindow><any>this.dfmIframe.contentWindow).privmxViewRequire("Starter").Starter.triggerJQEvent("distraction-free-mode-on");
    }
    
    exitDistractionFreeMode() {
        $("#windows-container").removeClass("distraction-free-mode");
        $(this.dfmIframe).removeClass("distraction-free-mode");
        this.distractionFreeMode = false;
        if (this.manager.fullscreen.isInFullscreenMode()) {
            this.manager.fullscreen.toggleFullscreenMode();
        }
        if (this.iframe === this.dfmIframe) {
            this.restoreMaximized();
        }
        (<InjectedWindow><any>this.dfmIframe.contentWindow).privmxViewRequire("Starter").Starter.triggerJQEvent("distraction-free-mode-off");
    }
    
    toggleDistractionFreeModeCore(): void {
        if (this.distractionFreeMode) {
            this.exitDistractionFreeMode();
        }
        else {
            this.enterDistractionFreeMode();
        }
    }
    
    toggleDistractionFreeMode(): void {
        this.dfmIframe = this.iframe;
        this.toggleDistractionFreeModeCore();
    }
    
    toggleDistractionFreeModeFromDocked(route: string[]): void {
        this.dfmIframe = (<InjectedWindow><any>this.iframe.contentWindow).privmxViewRequire("Starter").Starter.findDockedFrame(route);
        this.toggleDistractionFreeModeCore();
    }
    
    maximize(): void {
        this.stateBeforeMaximize = {
            width: this.domElement.style.width,
            height: this.domElement.style.height,
            x: this.domElement.style.left,
            y: this.domElement.style.top,
            restore: this.getWindowState()
        };
        this.domElement.style.top = "0";
        this.domElement.style.left = "0";
        this.domElement.style.bottom = "0";
        this.domElement.style.right = "0";
        this.domElement.style.width = "auto";
        this.domElement.style.height = "auto";
        this.domElement.classList.add("maximized");
        this.domElement.classList.remove("minimized");
        this.maximized = true;
        this.minimized = false;
        this.resized("maximize");
    }
    
    restoreMaximized(): void {
        let state = {
            width: "60%",
            height: "40%",
            x: "center",
            y: "center"
        };
        if (this.stateBeforeMaximize) {
            state.width = this.stateBeforeMaximize.width;
            state.height = this.stateBeforeMaximize.height;
            state.x = this.stateBeforeMaximize.x;
            state.y = this.stateBeforeMaximize.y;
        }
        this.domElement.style.bottom = "auto";
        this.domElement.style.right = "auto";
        this.setWidth(state.width);
        this.setHeight(state.height);
        this.setPosition(state.x, state.y);
        this.stateBeforeMaximize = null;
        this.domElement.classList.remove("maximized");
        this.maximized = false;
        this.resized("restore-maximized");
    }
    
    maximizeToggle(): void {
        if (this.stateBeforeMaximize) {
            this.restoreMaximized();
        }
        else {
            this.maximize();
        }
    }
    
    isMaximized(): boolean {
        return this.stateBeforeMaximize != null;
    }
    
    minimize(): void {
        if (this.options.modal) {
            $("#windows-overlay").addClass("hidden");
        }
        this.stateBeforeMinimize = {
            width: this.domElement.style.width,
            height: this.domElement.style.height,
            x: this.domElement.style.left,
            y: this.domElement.style.top,
            restore: this.getWindowState()
        };
        this.domElement.style.visibility = "hidden";
        this.setWidth(0);
        this.setHeight(0);
        this.setPosition(0, 0);
        this.domElement.classList.add("minimized");
        this.domElement.classList.remove("maximized");
        this.minimized = true;
        this.maximized = false;
        this.blur();
        this.resized("minimize");
        this.manager.focusOnTheMostTopWindow();
    }
    
    restoreMinimized(): void {
        let state = {
            width: "60%",
            height: "40%",
            x: "center",
            y: "center"
        };
        if (this.options.modal) {
            $("#windows-overlay").removeClass("hidden");
        }
        if (this.stateBeforeMinimize) {
            state.width = this.stateBeforeMinimize.width;
            state.height = this.stateBeforeMinimize.height;
            state.x = this.stateBeforeMinimize.x;
            state.y = this.stateBeforeMinimize.y;
        }
        this.domElement.style.visibility = this.options.hidden ? "hidden" : "visible";
        this.setWidth(state.width);
        this.setHeight(state.height);
        this.setPosition(state.x, state.y);
        this.stateBeforeMinimize = null;
        this.domElement.classList.remove("minimized");
        this.minimized = false;
        this.resized("restore-minimized");
        this.focus();
    }
    
    minimizeToggle(): void {
        if (this.stateBeforeMinimize) {
            this.restoreMinimized();
        }
        else {
            this.minimize();
        }
    }
    
    isMinimized(): boolean {
        return this.stateBeforeMinimize != null;
    }
    
    getPosition(): app.Position {
        let bbox = this.domElement.getBoundingClientRect();
        return {x: bbox.left, y: bbox.top};
    }
    
    setPosition(x: string|number, y: string|number): void {
        this.setPositionX(x);
        this.setPositionY(y);
    }
    
    getPositionX() {
        let bbox = this.domElement.getBoundingClientRect();
        return bbox.left;
    }
    
    getPositionY() {
        let bbox = this.domElement.getBoundingClientRect();
        return bbox.top;
    }
    
    setPositionX(x: string|number) {
        if (x == "center") {
            x = Math.max(0, ($(this.container).innerWidth() - this.getWidth()) / 2);
        }
        this.domElement.style.left = this.getMeasureForCss(x);
    }
    
    setPositionY(y: string|number) {
        if (y == "center") {
            y = Math.max(0, ($(this.container).innerHeight() - this.getHeight()) / 2);
        }
        this.domElement.style.top = this.getMeasureForCss(y);
    }
    
    getSize(): app.Size {
        return {
            width: this.domElement.offsetWidth,
            height: this.domElement.offsetHeight
        };
    }
    
    setSize(width: number, height: number): void {
        this.setWidth(width);
        this.setHeight(height);
    }
    
    setInnerSize(width: number, height: number): void {
        this.setSize(width, height);
    }
    
    getWindowState(): app.WindowState {
        let position = this.getPosition();
        let size = this.getSize();
        return {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height
        };
    }
    
    getRestoreState(): app.WindowState {
        if (this.isMaximized()) {
            return this.stateBeforeMaximize.restore;
        }
        return this.getWindowState();
    }
    
    getWidth(): number {
        return this.domElement.offsetWidth;
    }
    
    getHeight(): number {
        return this.domElement.offsetHeight;
    }
    
    setWidth(width: number|string): void {
        this.domElement.style.width = this.getMeasureForCss(width);
        let maxWidth = $(this.container).innerWidth();
        if ($(this.domElement).outerWidth() > maxWidth) {
            this.domElement.style.width = this.getMeasureForCss(maxWidth - 10);
        }
        if (this.options.position == "center-always") {
            this.setPosition("center", "center");
        }
    }
    
    setHeight(height: number|string): void {
        if (typeof(height) == "number" && this.header) {
            height += 23;
        }
        this.domElement.style.height = this.getMeasureForCss(height);
        let maxHeight = $(this.container).innerHeight();
        if ($(this.domElement).outerHeight() > maxHeight) {
            this.domElement.style.height = this.getMeasureForCss(maxHeight - 10);
        }
        if (this.options.position == "center-always") {
            this.setPosition("center", "center");
        }
    }
    
    setTitle(title: string): void {
        if (this.header) {
            this.header.setTitle(title);
        }
        if (this.widget) {
            this.widget.setTitle(title);
        }
    }
    
    destroy(): void {
        if (this.domElement.parentNode) {
            this.domElement.parentNode.removeChild(this.domElement);
        }
        if (this.widget) {
            this.widget.destroy();
        }
    }
    
    focus(): void {
        let modalWindow = $("#windows-container").children(".modal");
        let isThisWindowModal = this.domElement.classList.contains("modal");
        let doesAnyModalWindowExist = modalWindow.length > 0;
        if (doesAnyModalWindowExist && !isThisWindowModal) {
            return;
        }
        
        let currentIndex = +this.domElement.style.zIndex;
        let focusedIndex = this.manager.zIndexCounter;
        let updateView = false;
        if (currentIndex < focusedIndex) {
            this.domElement.style.zIndex = (++this.manager.zIndexCounter).toString();
            updateView = true;
        }
        if (this.minimized) {
            this.restoreMinimized();
            updateView = true;
        }
        if (updateView) {
            $(".window-wrapper.focused").removeClass("focused");
            this.domElement.classList.add("focused");
            if (this.widget) {
                this.widget.setActive();
            }
            else {
                this.manager.instances.forEach(winMgr => {
                    if (winMgr.widget) {
                        winMgr.widget.setInactive();
                    }
                });
            }
            if (this.options.modal) {
                $("#windows-overlay").removeClass("hidden").css("z-index", parseInt(this.domElement.style.zIndex) - 1);
            }
            else {
                $("#windows-overlay").addClass("hidden");
            }
        }
        this.events.trigger("focus");
    }
    
    blur(): void {
        this.domElement.style.zIndex = (parseInt(this.domElement.style.zIndex) - 2).toString();
        this.domElement.classList.remove("focused");
        if (this.widget) {
            this.widget.setInactive();
        }
    }
    
    isFocused(): boolean {
        return parseInt(this.domElement.style.zIndex) == this.manager.zIndexCounter;
    }
    
    getMeasureForCss(size: string|number): string {
        let mm = typeof(size) == "string" && size.indexOf("%") != -1 ? "%" : "px";
        let n = + size;
        if (!isNaN(n)) {
            return n + mm;
        }
        return <string>size;
    }
    
    setDirty(dirty: boolean): void {
        if (dirty) {
            this.domElement.classList.add("dirty");
        }
        else {
            this.domElement.classList.remove("dirty");
        }
        if (this.widget) {
            this.widget.setDirty(dirty);
        }
    }
    
    setIcon(icon: string): void {
        if (this.header) {
            this.header.setIcon(icon);
        }
        if (this.widget) {
            this.widget.setIcon(icon);
        }
    }
    
    openContextMenu(): void {
    }
    
    setClosable(closable: boolean): void {
        this.closable = closable;
    }
    getClosable(): boolean {
        return this.closable;
    }
    
    getResizable(): boolean {
        Logger.error("getResizable() is not implemented in WebWindow");
        return null;
    }
    
    setResizable(resizable: boolean): void {
        Logger.error("setResizable() is not implemented in WebWindow");
    }
    
    getParent(): AppWindow {
        return null;
    }
    
    setZoomLevel(zoomLevel: number): void {
        this.domElement.style.zoom = `${zoomLevel}`;
    }
    
    removeSpinner(): void {
    }
    
    updateAlwaysOnTop(): void {
        if (this.domElement) {
            this.domElement.classList.toggle("always-on-top", this.alwaysOnTop);
        }
    }
    
    isAlwaysOnTop(): boolean {
        return !!this.alwaysOnTop;
    }
    
    setAlwaysOnTop(alwaysOnTop: boolean): void {
        if (alwaysOnTop != this.alwaysOnTop) {
            this.alwaysOnTop = alwaysOnTop;
            this.updateAlwaysOnTop();
        }
    }
    
    center(): void {
        this.setPosition("center", "center");
    }
    
}
Object.defineProperty(WebWindow.prototype, "window", {
    get: function(this: WebWindow): Window {
        return this.iframe.contentWindow;
    },
    enumerable: true
});
