import {Window} from "../../common/window/Window";
import {WindowManager} from "./WindowManager";
import electron = require("electron");
import {app} from "../../../Types";
import ObjectMapModule = require("../ObjectMap");
import {func as pageTemplate} from "../template/page.html";
import {Formatter} from "../../../utils/Formatter";
import * as Utils from "simplito-utils";
import * as RootLogger from "simplito-logger";
import { PerformanceLogger } from "../../common/PerformanceLogger";
import { WindowUrl } from "../WindowUrl";
import { ElectronPartitions } from "../ElectronPartitions";
const os = require("os");

let Logger = RootLogger.get("privfs-mail-client.app.electron.window.ElectronWindow");

export interface CopyPasteHandler {
    copy: () => void;
    cut: () => void;
    paste: () => void;
}

export class ElectronWindow extends Window {
    static readonly TOP_BAR_HEIGHT: number = 24 + 1; //topbar height + bottom border height
    static readonly USE_LINUX_WINDOW_OPEN_HACK: boolean = true; // Electron hack: fixes 1s delay before showing windows
    
    manager: WindowManager;
    options: app.WindowOptions;
    controllerId: number;
    parent: ElectronWindow;
    parentWindow: Electron.BrowserWindow;
    window: Electron.BrowserWindow;
    forceClose: boolean;
    windowUID: string;
    restoreState: app.WindowState;
    windowId: number;
    ignoreMarkUnmaximize: boolean = false;
    ipcChannelName: string;
    isModal: boolean;
    openOpt: Electron.BrowserWindowConstructorOptions;
    
    constructor(manager: WindowManager, dataOrUrl: app.WindowLoadOptions, options: app.WindowOptions, controllerId: number, ipcChannelName: string, parent: ElectronWindow, public copyPasteHandler: CopyPasteHandler) {
        super();

        PerformanceLogger.log("openingWindows.ElectronWindow.constructor().start");
        this.ipcChannelName = ipcChannelName;
        options = Utils.fillByDefaults(options, {
            decoration: true,
            widget: true,
            resizable: true,
            draggable: true,
        });
        // console.log(1);
        this.isModal = options.modal && !options.showInactive && parent && parent.window ? true : false;
        options.closable = options.closable !== false;
        if (options.minimizable === undefined) {
            options.minimizable = options.resizable;
        }
        if (options.maximizable === undefined) {
            options.maximizable = options.resizable;
        }
        if (this.isModal) {
            options.minimizable = false;
            options.maximizable = false;
        }
        this.windowId = ObjectMapModule.add(this);
        this.manager = manager;
        this.options = options;

        let webPreferences = {

        }

        this.controllerId = controllerId;
        this.parent = parent;
        this.parentWindow = parent ? parent.window : null;
        let openOpt: Electron.BrowserWindowConstructorOptions = {
            maximizable: options.maximizable,
            closable: options.closable,
            minimizable: options.minimizable,
            show: false,
            title: options.title,
            icon: this.manager.assetsManager.getAsset("icons/app-icon.png", true),
            resizable: options.resizable !== false,
            backgroundColor: options.backgroundColor,
            useContentSize: false,
            acceptFirstMouse: true,
            webPreferences: {
                allowRunningInsecureContent: dataOrUrl.type == "url" && dataOrUrl.secureContent ? false : true,
                webSecurity: dataOrUrl.type == "url" && dataOrUrl.secureContent ? true : false,
                nodeIntegration: true,
            }
        };
        let partition = this.options.electronPartition;
        if (partition) {
            openOpt.webPreferences.partition = partition;
        }
        // console.log(3);

        this.openOpt = openOpt;
        if (process.platform == "darwin") {
            openOpt.titleBarStyle = "hidden";
        }
        
        if (options.width != null && typeof(options.width) == "number") {
            openOpt.width = options.width;
        }
        if (options.height != null && typeof(options.height) == "number") {
            openOpt.height = options.height + ElectronWindow.TOP_BAR_HEIGHT;
            if (process.platform == "darwin" && this.isModal == true) {
                openOpt.height = openOpt.height + ElectronWindow.TOP_BAR_HEIGHT - 4;
            }
        }
        if (options.minWidth != null) {
            openOpt.minWidth = options.minWidth;
        }
        if (options.minHeight != null) {
            openOpt.minHeight = options.minHeight;
        }
        if (options.maxWidth != null) {
            openOpt.maxWidth = options.maxWidth;
        }
        if (options.maxHeight != null) {
            openOpt.maxHeight = options.maxHeight + ElectronWindow.TOP_BAR_HEIGHT;
        }
        if (options.frame != null) {
            openOpt.frame = options.frame;
        }
        if (options.positionX != null) {
            openOpt.x = options.positionX;
        }
        if (options.positionY != null) {
            openOpt.y = options.positionY;
        }
        // console.log(4);

        if (this.isModal) {
            openOpt.alwaysOnTop = true;
            openOpt.focusable = true;
            openOpt.skipTaskbar = true;
            openOpt.minimizable = false;
            openOpt.maximizable = false;
            openOpt.modal = true;
            openOpt.parent = this.parentWindow || this.manager.getMainBrowserWindow();
            openOpt.show = false;
            
            if (options.showInactive) {
                openOpt.modal = false;
                openOpt.parent = this.manager.getMainBrowserWindow();
            }
        }
        openOpt.frame = false;
        // console.log(5);

        // Electron hack: fixes 1s delay before showing windows
        // if (ElectronWindow.USE_LINUX_WINDOW_OPEN_HACK && os.platform() == "linux" && this.openOpt.height) {
        //     this.openOpt.height -= 2;
        // }
        if (ElectronWindow.USE_LINUX_WINDOW_OPEN_HACK && os.platform() == "linux" && !options.hidden) {
            openOpt.show = true;
        }
        
        PerformanceLogger.log("openingWindows.ElectronWindow.constructor().newBrowserWindow.start");
        // console.log("creating window");
        this.window = new electron.BrowserWindow(openOpt);
        // console.log("creating window - after");
        PerformanceLogger.log("openingWindows.ElectronWindow.constructor().newBrowserWindow.end");
        
        // this.toogleDevTools();

        if (options.maximized) {
            this.manager.center(this);
            this.maximize();
        }
        
        if (this.window.isModal()) {
            if (this.parentWindow) {
                this.manager.centerInsideParent(this, this.parent);
            }
            else {
                Logger.error("Opening a modal window that has no parent BrowserWindow");
            }
        }
        else if (options.position == null || options.position == "center" || options.position == "center-always") {
            this.manager.center(this);
        }
        
        this.window.setResizable(openOpt.resizable);
        if (this.isModal) {
            this.window.setMinimizable(false);
            this.window.setMaximizable(false);
        }
        if (dataOrUrl.type === "url") {
            // console.log("load window data as url");
            // this.window.loadURL('file://' + dataOrUrl.url.substring(1).replace("/window/", "/dist/window/"));
            this.window.loadURL(dataOrUrl.url);
        }
        else if (dataOrUrl.type === "html") {
            // console.log("load window data as html")
            let host = dataOrUrl.host || "privmx-desktop-view";
            let iframeDataUrl = ElectronPartitions.getUrlFromHtml(partition, host, dataOrUrl.html);
            let iframeHtml = pageTemplate.func({
                assetsManager: this.manager.assetsManager,
                title: openOpt.title,
                iframeDataUrl: iframeDataUrl,
                barPosition: this.manager.defaultBarPosition,
                closable: options.closable,
                minimizable: options.minimizable,
                maximizable: options.maximizable,
                platform: process.platform,
                preTitleIcon: options.preTitleIcon,
                icon: options.icon,
                keepSpinnerUntilViewLoaded: !!options.keepSpinnerUntilViewLoaded,
                hideLoadingSpinner: options.hideLoadingSpinner,
            }, null, new Formatter());
            this.window.loadURL(ElectronPartitions.getUrlFromHtml(partition, host, iframeHtml));
        }
        this.window.webContents.on("did-finish-load", this.onDidFinishLoad.bind(this));
        this.window.webContents.on("new-window", this.onNewWindow.bind(this));
        this.window.on("closed", this.manager.onClosed.bind(this.manager, this));
        this.window.on("close", this.onClose.bind(this));
        this.window.on("minimize", this.onMinimize.bind(this));
        this.window.on("unmaximize", this.markUnmaximized.bind(this));
        this.window.on("maximize", this.onMaximizeToggle.bind(this));
        this.window.on("blur", this.onBlur.bind(this));
        this.window.on("focus", this.onFocus.bind(this));
        this.window.on("show", this.onShow.bind(this));
        this.window.on("hide", this.onHide.bind(this));
        this.window.on(<any>"privmx-copy", this.onCopy.bind(this));
        this.window.on(<any>"privmx-cut", this.onCut.bind(this));
        this.window.on(<any>"privmx-paste", this.onPaste.bind(this));
        this.window.webContents.on("context-menu", this.onContextMenu.bind(this));
        PerformanceLogger.log("openingWindows.ElectronWindow.constructor().end");
    }
    
    onMaximizeToggle(): void {
        if (this.windowId == this.manager.getMainAppWindowId()) {
            this.manager.onMaximizeToggle();
        }
    }
    
    onShow() {
        this.hidden = false;
    }
    
    onHide() {
        this.hidden = true;
    }
    
    onNewWindow(event: any, url: string) {
        event.preventDefault();
        electron.shell.openExternal(url);
    }
    
    sendIpc(channel: string, data: any): void {
        try {
            this.window.webContents.send(channel, data);
        }
        catch (e) {
            Logger.error("Cannot send ipc message", e);
        }
    }
    
    setTitle(title: string): void {
        if (this.window.getTitle() == title) {
            return;
        }
        this.window.setTitle(title);
        this.window.webContents.send("set-title", title);
    }
    
    updatePreTitleIcon(icon: app.PreTitleIcon): void {
        this.window.webContents.send("set-pre-title-icon", icon);
    }
    
    focus(): void {
        this.window.focus();
    }
    
    isFocused(): boolean {
        try {
            if (this && this.window) {
                return this.window.isFocused();
            }
            return false;
        } catch (e) {
            return false;
        }
    }
    
    onMinimize(): void {
        if (this.isModal) {
            this.close();
        }
        this.manager.onChangeFocus();
    }
    
    onBlur(): void {
        this.manager.onChangeFocus();
    }
    
    onFocus(): void {
        this.manager.onFocus();
        this.manager.onChangeFocus();
    }
    
    onClose(event: Electron.Event): void {
        if (!this.forceClose) {
            if (event) {
                event.preventDefault();
            }
            this.events.trigger("close");
        }
    }
    
    close(force?: boolean): void {
        this.forceClose = force;
        try {
            if (this && this.window) {
                this.window.close();
            }
        } catch (e) {
            Logger.debug("Trying to close non-existant window..");
        }
    }
    
    onDidFinishLoad(): void {
        PerformanceLogger.log("openingWindows.ElectronWindow.onDidFinishLoad().start");
        this.events.trigger("loaded");
        if (!this.options.hidden) {
            if (this.options.showInactive) {
                this.window.setParentWindow(this.manager.getMainWindow().window);
                this.window.showInactive();
            }
            else {
                this.show(true);
            }
        }
        PerformanceLogger.log("openingWindows.ElectronWindow.onDidFinishLoad().end");
    }
    
    setWindowsTitleBarButtonsPosition(position: string) {
        try {
            this.window.webContents.send("set-buttons-position", position);
        }
        catch (e) {
        }
    }
    
    removeSpinner() {
        try {
            this.window.webContents.send("remove-spinner");
        }
        catch (e) {
        }
    }
    
    start(): void {
        PerformanceLogger.log("openingWindows.ElectronWindow.start().start");
        var ipc = require("electron").ipcMain;
        ipc.on(this.ipcChannelName + "/wnd", (sender: any, data: any, ...extra: any[]) => {
            if (data == "close") {
                this.onClose(null);
            }
            else if (data == "maximizeToggle") {
                this.maximizeToggle();
            }
            else if (data == "minimize") {
                this.minimize();
            }
            else if (data == "performanceLog") {
                PerformanceLogger.getInstance().log(extra[0], extra[1], extra[2]);
            }
        });
        
        this.window.webContents.send("window-id", this.windowId);
        let app = this.manager.app;
        this.window.webContents.send("controller-start", {
            nodeModulesDir: app.getNodeModulesDir(),
            servicesDefinitions: app.ipcHolder.getServicesDefinitions(),
            viewLogLevel: app.getViewLogLevel(),
            preventLinkOpenageInView: app.preventLinkOpenageInView(),
            controllerId: this.controllerId,
            ipcChannelName: this.ipcChannelName,
            helperModel: app.getMailClientViewHelperModel(),
        });
        PerformanceLogger.log("openingWindows.ElectronWindow.start().end");
    }
    
    hideLoadingScreen(): void {
    }
    
    toggleDistractionFreeMode(): void {
    }
    
    toggleDistractionFreeModeFromDocked(route: string[]): void {
    }
    
    sendFromDocked(route: string[], name: string, data: any): void {
        this.window.webContents.send("docked", {
            route: route,
            name: name,
            data: data
        });
    }
    
    toogleDevTools(): void {
        if (this.window && this.window.webContents) {
            if (this.window.webContents.isDevToolsOpened()) {
                this.window.webContents.closeDevTools();
            }
            else {
                this.window.webContents.openDevTools();
            }
        }
    }
    
    getWindowUID(): string {
        return this.windowUID;
    }
    
    setWindowUID(windowName: string) {
        this.windowUID = windowName;
    }
    
    setDirty(dirty: boolean): void {
        this.sendIpc("set-dirty", dirty);
    }
    
    setIcon(icon: string): void {
    }
    
    getPosition(): app.Position {
        let pos = this.window.getPosition();
        return {x: pos[0], y: pos[1]};
    }
    
    setPosition(x: number, y: number) {
        let isValidPosition: boolean = false;
        electron.screen.getAllDisplays().forEach(screen => {
            if (this.isWindowOnScreen(screen.bounds, x, y)) {
                isValidPosition = true;
            }
        });
        if (! isValidPosition) {
            let screenBounds = electron.screen.getPrimaryDisplay().bounds;
            this.window.setPosition(this.validateAndFixWindowPositionX(screenBounds, x), this.validateAndFixWindowPositionY(screenBounds, y), true);
            return;
        }
        this.window.setPosition(x, y, true);
    }
    
    getPositionX(): number {
        return this.window.getPosition()[0];
    }
    
    getPositionY(): number {
        return this.window.getPosition()[1];
    }
    
    setPositionX(x: number): void {
        this.window.setPosition(x, this.getPositionY(), true);
    }
    
    setPositionY(y: number): void {
        this.window.setPosition(this.getPositionX(), y, true);
    }
    
    getSize(): app.Size {
        let size = this.window.getSize();
        return {width: size[0], height: size[1]};
    }
    
    setSize(width: number, height: number): void {
        this.window.setSize(width, height);
    }
    
    setInnerSize(width: number, height: number): void {
        this.window.setSize(width, height + ElectronWindow.TOP_BAR_HEIGHT);
    }
    
    getWidth(): number {
        return this.window.getSize()[0];
    }
    
    getHeight(): number {
        return this.window.getSize()[1] - ElectronWindow.TOP_BAR_HEIGHT;
    }
    
    setHeight(height: number): void {
        this.window.setSize(this.getWidth(), height + ElectronWindow.TOP_BAR_HEIGHT);
    }
    
    setWidth(width: number): void {
        this.window.setSize(width, this.getHeight());
    }
    
    setFullHeight(height: number): void {
        this.window.setSize(this.getWidth(), height);
    }
    
    setFullWidth(width: number): void {
        this.setWidth(width);
    }
    
    getFullHeight(): number {
        return this.window.getSize()[1];
    }
    
    getFullWidth(): number {
        return this.getWidth();
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
    
    isWindowOnScreen(screenBounds: electron.Rectangle, x: number, y: number): boolean {
        return (x >= screenBounds.x && y >= screenBounds.y && x < screenBounds.x + screenBounds.width && y < screenBounds.y + screenBounds.height);
    }
    
    validateAndFixWindowPositionX(screenBounds: electron.Rectangle, x: number): number {
        let validX = x;
        if (x >= screenBounds.x + screenBounds.width) {
            validX = screenBounds.x;
        }
        return validX;
    }
    
    validateAndFixWindowPositionY(screenBounds: electron.Rectangle, y: number): number {
        let validY = y;
        if (y >= screenBounds.y + screenBounds.height) {
            validY = screenBounds.y;
        }
        return validY;
    }
    
    getRestoreState(): app.WindowState {
        return this.options.maximized && this.restoreState ? this.restoreState : this.getWindowState();
    }
    
    getFullscreen(): boolean {
        return this.window.isFullScreen();
    }
    
    setFullscreen(isFullscreen: boolean) {
        this.window.setFullScreen(isFullscreen);
    }
    
    minimize(): void {
        this.window.minimize();
    }
    
    minimizeToggle(): void {
        if (this.window.isMinimized()) {
            this.window.restore();
        }
        else {
            this.window.minimize();
        }
    }
    
    isMinimized(): boolean {
        return this.window.isMinimized();
    }
    
    maximize(): void {
        if (! this.options.maximizable) {
            return;
        }
        if (!this.isMaximized()) {
            this.restoreState = this.getWindowState();
        }
        if (process.platform == "darwin") {
            this.window.setFullScreen(true);
        }
        else {
            this.window.maximize();
        }
        this.options.maximized = true;
    }
    
    maximizeToggle(): void {
        if (this.isMaximized()) {
            this.unmaximize();
        }
        else {
            this.maximize();
        }
    }
    
    unmaximize(): void {
        if (process.platform == "darwin") {
            this.window.setFullScreen(false);
        }
        else {
            this.window.unmaximize();
        }
        this.options.maximized = false;
    }
    
    markUnmaximized(): void {
        if (!this.ignoreMarkUnmaximize) {
            this.options.maximized = false;
        }
        this.ignoreMarkUnmaximize = false;
        this.onMaximizeToggle();
    }
    
    
    isMaximized(): boolean {
        return this.window.isMaximized();
    }
    
    show(firstOpen: boolean = false) {
        // Electron hack: fixes 1s delay before showing windows
        let size: number[] = null;
        if (!firstOpen && ElectronWindow.USE_LINUX_WINDOW_OPEN_HACK && os.platform() == "linux" && this.openOpt.height && !this.options.hidden) {
            size = this.window.getSize();
            this.window.setSize(size[0], size[1] - 1);
        }
        
        this.window.show();
        
        // Electron hack: fixes system UI freeze if mouse is pressed while a modal is opening
        if (this.window.isModal() && this.parentWindow && os.platform() == "linux") {
            // this.parentWindow.blur();
            // this.parentWindow.focus();
        }
        
        // Electron hack: fixes 1s delay before showing windows
        if (!firstOpen && ElectronWindow.USE_LINUX_WINDOW_OPEN_HACK && os.platform() == "linux" && this.openOpt.height && !this.options.hidden) {
            this.window.setSize(size[0], size[1]);
        }
        
    }
    
    setClosable(closable: boolean): void {
        this.options.closable = closable;
        this.window.setClosable(closable);
    }
    getClosable(): boolean {
        return this.window.isClosable();
    }
    
    hide() {
        if(this.options.maximized) {
            this.ignoreMarkUnmaximize = true;
        }
        if(this.window) {
            if(this.window.isFullScreen()){
                this.window.once('leave-full-screen', () => {
                    if (process.platform != "darwin") {
                        this.window.blur();
                    }
                    this.window.hide();
                })
                this.window.setFullScreen(false);
            }
            else{
                if (process.platform != "darwin") {
                    this.window.blur();
                }
                this.window.hide();
            }
        }
    }
    
    openContextMenu(): void {
        //this.manager.onGetMenuCallback("context").popup({});
        // electron.Menu.getApplicationMenu().popup({});
    }
    
    onContextMenu(): void {
        this.manager.onGetMenuCallback("context").popup({});
    }
    
    clearCache(): void {
        setTimeout(() => { this.clearCache(); }, 10000);
        this.manager.windows.forEach(w => {
                w.window.webContents.clearHistory();
                w.window.webContents.session.clearCache(() => {});
                w.window.webContents.session.clearStorageData();
        })
    }

    center(): void {
        this.window.center();
    }
    
    getResizable(): boolean {
        return this.window.isResizable();
    }
    
    setResizable(resizable: boolean): void {
        this.window.setResizable(resizable);
    }
    
    getParent(): Window {
        return this.parent;
    }
    
    onCopy(): void {
        if (this.window && this.window.webContents && this.window.webContents.isDevToolsOpened() && this.window.webContents.isDevToolsFocused()) {
            this.window.webContents.devToolsWebContents.copy();
            return;
        }
        if (!this.manager.app.isLogged()) {
            this.window.webContents.copy();
            return;
        }
        this.copyPasteHandler.copy();
    }
    
    onCut(): void {
        if (this.window && this.window.webContents && this.window.webContents.isDevToolsOpened() && this.window.webContents.isDevToolsFocused()) {
            this.window.webContents.devToolsWebContents.cut();
            return;
        }
        if (!this.manager.app.isLogged()) {
            this.window.webContents.cut();
            return;
        }
        this.copyPasteHandler.cut();
    }
    
    onPaste(): void {
        if (this.window && this.window.webContents && this.window.webContents.isDevToolsOpened() && this.window.webContents.isDevToolsFocused()) {
            this.window.webContents.devToolsWebContents.paste();
            return;
        }
        if (!this.manager.app.isLogged()) {
            this.window.webContents.paste();
            return;
        }
        this.copyPasteHandler.paste();
    }
    
    setZoomLevel(zoomLevel: number): void {
        this.window.webContents.setZoomFactor(zoomLevel);
    }
    
}
