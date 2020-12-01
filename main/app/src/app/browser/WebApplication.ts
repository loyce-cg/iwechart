import {ContainerWindowController} from "../../window/container/ContainerWindowController";
import {MsgBoxWindowController} from "../../window/msgbox/MsgBoxWindowController";
import {CommonApplication} from "../common/CommonApplication";
import {WebStorage} from "../../utils/WebStorage";
import {AudioPlayer} from "../../web-utils/AudioPlayer";
import {BrowserDetection} from "../../web-utils/BrowserDetection";
import {ScreenCover} from "../../web-utils/ScreenCover";
import {Fullscreen} from "../../web-utils/Fullscreen";
import {UrlOpener} from "../../web-utils/UrlOpener";
import {window} from "../../web-utils/Window";
import {ComponentInitializer} from "../../component/base/ComponentInitializer";
import {StatusBarMainController} from "../../component/statusbarmain/StatusBarMainController";
import {StatusBarMainView} from "../../component/statusbarmain/StatusBarMainView";
import {WindowManager} from "./window/WindowManager";
import {WebWindow} from "./window/WebWindow";
import history = require("history");
import is = require("is_js");
import * as $ from "jquery";
import * as Q from "q";
import * as Utils from "simplito-utils";
import {WebMonitor} from "../../web-utils/WebMonitor";
import {Initializer} from "./Initializer";
import {HttpRequest} from "simplito-net";
import {func as offlineErrorTemplate} from "../common/window/template/offline-error.html";
import {app, ipc, utils} from "../../Types";
import {UrlResourceLoader, MailResourceLoader} from "./ResourceLoader";
import {IpcSender} from "./electron/IpcSender";
import {FileUtils} from "./FileUtils";
import * as RootLogger from "simplito-logger";
import {ApplicationBinding, ShellOpenAction, ShellOpenOptions, OpenableElement} from "../common/shell/ShellTypes";
import {BaseWindowManager} from "../BaseWindowManager";
import {BaseWindowController} from "../../window/base/BaseWindowController";
import * as privfs from "privfs-client";
import { MusicPlayer } from "../common/musicPlayer/MusicPlayer";
import { PlayerManager } from "../common/musicPlayer/PlayerManager";
import { Window as AppWindow } from "../common/window/Window";
import { CssVariables, CssParser } from "../common/customization/CssParser";
import { CustomizationData } from "../common/customization/CustomizationData";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { Session } from "../../mail/session/SessionManager"; 

let Logger = RootLogger.get("privfs-mail-client.app.common.CommonApplication");

export class WebApplication extends CommonApplication {
    
    screenCover: ScreenCover;
    windowManager: WindowManager;
    webMonitor: WebMonitor;
    audioPlayer: AudioPlayer;
    statusBarController: StatusBarMainController;
    statusBarView: StatusBarMainView;
    tokenUsed: boolean;
    registerKeyUsed: boolean;
    originalUrl: string;
    supportedHosts: string[];
    newCount: number;
    history: history.History;
    $offlineIndicator: JQuery;
    $offlineIndicatorParent: JQuery;
    musicPlayer: MusicPlayer;
    playerManager: PlayerManager;
    usedIpcChannelNames: { [key: string]: boolean } = {};
    registerTokenInfo: utils.RegisterTokenInfo;
    connectionRestoredDeferred: Q.Deferred<void> = null;
    
    
    constructor(public initializer: Initializer) {
        super(initializer.electronModule.ipcMain, new WebStorage(), initializer.localeService, new MailResourceLoader(new UrlResourceLoader(initializer.rootUrl)), initializer.assetsManager);
        this.options.maxFileSize.value = 25 * 1024 * 1024;
        this.options.forcedPublishPresenceType.value = "all";
        
        this.customizedTheme = (<any>window).options.customizedTheme;
        this.customizedTheme.cssVariables = CssParser.parseVariables(this.customizedTheme.css).cssVars;
        
        this.screenCover = new ScreenCover({
            timeout: 180000,
            timeoutCheck: 180000,
            $toCover: $("#main"),
            $cover: $("#screen-cover")
        });
        this.initAudio();
        this.initPlayer();
        this.initHistory();
        this.setNewCount(0);
        this.windowManager = new WindowManager(this.initializer.rootUrl, Fullscreen, this.getWindowsTitleBarButtonsPosition(), this.initializer.electronModule, this);
        this.initializer.electronModule.ipcMain.addIpcListener("docked", this.windowManager.onDocked.bind(this.windowManager));
        this.hideOfflineIndicator();
        let app = this;
        this.webMonitor = new WebMonitor();
        this.webMonitor.addEventListener("network-status-change", event => {
            switch (event.data) {
                case "offline":
                    if (!this.networkStatusService.networkActivityIsPaused()) {
                        this.networkStatusService.pauseNetworkActivity();
                    }
                    $('body').addClass('offline');
                    app.showOfflineIndicator();
                    break;
                case "online":
                    if (this.networkStatusService.networkActivityIsPaused()) {
                        this.networkStatusService.restoreNetworkActivity();
                    }
                    $('body').removeClass('offline');
                    app.hideOfflineIndicator();
                    break;
            }
        });
        let tryAgainInTheNextLoop = false;
        let checkNetworkStatusByMakingHttpRequest = () => {
            tryAgainInTheNextLoop = false;
            HttpRequest.start({
                url: app.getCurrentUrlWithParam("t", new Date().getTime().toString()),
                success: () => {
                    app.webMonitor.updateNetworkStatus('online');
                },
                error: () => {
                    app.webMonitor.updateNetworkStatus('offline');
                    setTimeout(() => {
                        tryAgainInTheNextLoop = true;
                    }, 10000);
                }
            });
        };
        this.webMonitor.addEventListener("wakeup", () => {
            checkNetworkStatusByMakingHttpRequest();
        });
        this.webMonitor.addEventListener("loop", () => {
            if (tryAgainInTheNextLoop && app.webMonitor.getNetworkStatus() === 'offline') {
                checkNetworkStatusByMakingHttpRequest();
            }
            else {
                tryAgainInTheNextLoop = false;
            }
        });
        this.webMonitor.start();
        this.keyboardShortcuts = new KeyboardShortcuts(this);
    }
    
    addToObjectMap(obj: any): number {
        return this.initializer.electronModule.objectMap.add(obj);
    }
    
    getFromObjectMap<T = any>(id: number): T {
        return this.initializer.electronModule.objectMap.get(id);
    }
    
    getMailClientViewHelperModel(): app.MailClientViewHelperModel {
        return {
            localeService: {
                instance: this.localeService,
                currentLang: null,
                serializedTexts: null,
                availableLanguages: "[]",
            },
            assetsManager: {
                instance: this.assetsManager,
                assets: null,
                rootUrl: null,
                pluginRootUrl: null,
                pluginConfigProvider: null
            },
            version: this.getVersion().str,
            isDemo: this.isDemo(),
            defaultHost: this.getDefaultHost(),
            isContextMenuBlocked: this.isContextMenuBlocked(),
            openLinksByController: this.openLinksByController(),
            uiEventsListener: this.getUIEventsListener()
        };
    }
    
    createIpcSender(channelId: string = null): app.IpcSender {
        if (!channelId) {
            channelId = this.createIpcChannelId();
        }
        if (channelId in this.usedIpcChannelNames) {
            throw new Error("IPC channel already exists: " + channelId);
        }
        this.usedIpcChannelNames[channelId] = true;
        return new IpcSender(channelId, this.initializer.require.electron.ipcRenderer);
    }
    
    addIpcListener(channel: string, listener: ipc.IpcMainListener): void {
        this.initializer.electronModule.ipcMain.addIpcListener(channel, listener);
    }
    
    removeAllIpcListeners(channel: string): void {
        this.initializer.electronModule.ipcMain.removeAllIpcListeners(channel);
    }
    
    getCurrentUrlWithParam(name: string, value: string): string {
        let url = document.location.origin;
        url += document.location.pathname == "" ? "/" : document.location.pathname;
        url += document.location.search;
        url += document.location.search == "" ? "?" : "&";
        url += name + "=" + encodeURIComponent(value);
        return url;
    }
    
    isElectronApp(): boolean {
        return false;
    }
    
    isWebApp(): boolean {
        return true;
    }
    
    isAutoUpdateSupport(): boolean {
        return false;
    }
    
    isTestMode(): boolean {
        return this.initializer.testMode;
    }
    
    isDemo(): boolean {
        return this.initializer.isDemo();
    }
    
    supportsSecureForms(): boolean {
        return this.initializer.supportsSecureForms();
    }
    
    isSearchEnabled(): boolean {
        return this.initializer.isSearchEnabled();
    }
    
    getInitApp(): string {
        return this.initializer.options.options.initApp;
    }
    
    getLogoApp(): string {
        return this.initializer.options.options.logoApp;
    }
    
    getApps(): string[] {
        return this.initializer.options.options.apps;
    }
    
    getAutoUpdateStatusModel(): app.AutoUpdateStatusModel {
        throw new Error("AutoUpdate is not supported on this platform");
    }
    
    initAudio(): void {
        this.audioPlayer = new AudioPlayer();
        this.audioPlayer.add("notification", this.assetsManager.getAsset("sounds/new-messages.wav"));
        this.audioPlayer.add("message-sent", this.assetsManager.getAsset("sounds/message-sent.wav"));
        this.audioPlayer.add("message-deleted", this.assetsManager.getAsset("sounds/message-deleted.wav"));
    }
    
    initPlayer(): void {
        this.musicPlayer = new MusicPlayer();
        this.musicPlayer.initPlayer(<HTMLAudioElement>$("#main-music-player").get(0));
        this.playerManager = new PlayerManager(this, this.musicPlayer);
    }
    
    openWindow(load: app.WindowLoadOptions, options: app.WindowOptions, controller: BaseWindowController, _parentWindow: app.WindowParent, singletonName?: string): WebWindow {
        let manager = controller.manager ? controller.manager : this.manager;
        let childManager = new BaseWindowManager(controller, manager);
        if (!this.manager.openChild(childManager, singletonName)) {
            return null;
        }
        let window = this.windowManager.open(load, options, controller.id, controller.getIpcChannelName());
        return window;
    }
    
    afterLogin(): void {
        let controller = this.registerInstance(this.ioc.createSync(StatusBarMainController, [this, (<ContainerWindowController>this.windows.container).mainTaskStream]));
        let result = ComponentInitializer.initAndSetContainer(
            this.registerInstance(new StatusBarMainView(this.initializer.viewManager)),
            controller.getIpcChannelName(),
            $("#opened-windows-bar .current-tasks-info")
        );
        this.statusBarView = result.view;
        this.statusBarController = controller;
        result.initPromise.fail(e => {
            Logger.error("Error during initializing StatusBarMain", e);
        });
        this.screenCover.start();
    }
    
    logout(): void {
        for (let i = 0; i < this.onLogoutCallback.length; i++) {
            try {
                if (this.onLogoutCallback[i]() === true) {
                    return;
                }
            }
            catch (e) {
                Logger.error("Error during calling onLogout", e)
            }
        }
        window.location.href = window.location.pathname + window.location.search;
    }
    
    forceRestart(): void {
        if (window.onbeforeunload) {
            window.onbeforeunload = null;
        }
        window.location.href = window.location.pathname + window.location.search;
    }
    
    getUIEventsListener(): () => void {
        return this.screenCover.onEventBinded;
    }
    
    getFullscreenModel(): app.FullscreenModel {
        return Fullscreen.getFullscreenModel();
    }
    
    getBrowser(): BrowserDetection {
        return this.initializer.browser;
    }
    
    getVersion(): utils.ProjectInfo {
        return this.initializer.version;
    }
    
    isContextMenuBlocked(): boolean {
        return !this.isInDevMode();
    }
    
    isInDevMode(): boolean {
        return !!this.initializer.query.devmode;
    }
    
    // getToken(): string {
    //     if (this.tokenUsed) {
    //         return null;
    //     }
    //     return this.token;
    // }
    //
    // getRegisterKey(): string {
    //     if (this.registerKeyUsed) {
    //         return null;
    //     }
    //     return this.registerKey;
    // }
    //
    // getAdminRegistration(): boolean {
    //     return this.adminRegistration;
    // }
    //
    // getPredefinedUsername(): string {
    //     return this.predefinedUsername;
    // }
    
    getOriginalUrl(): string {
        return this.originalUrl;
    }
    
    getDesktopDownloadUrl(): string {
        return this.initializer.options.options.desktopDownloadUrl;
    }
    
    getTermsUrl(): string {
        return this.initializer.options.options.termsUrl + "?lang=" + this.localeService.currentLang;
    }
    
    getPrivacyPolicyUrl(): string {
        return this.initializer.options.options.privacyPolicyUrl + "?lang=" + this.localeService.currentLang;
    }
    
    getDesktopAppUrls() {
        if (this.initializer.options.options.desktopAppUrls == undefined) {
            return {win32: "", linux: "", darwin: ""};
        }
        return this.initializer.options.options.desktopAppUrls;
    }
    
    isWebAccessEnabled(): boolean {
        return this.initializer.options.options.webAccessEnabled;
    }
    
    setRegisterTokenInfo(tokenInfo: utils.RegisterTokenInfo): void {
        this.registerTokenInfo = tokenInfo;
    }
    
    getRegisterTokenInfo(): utils.RegisterTokenInfo {
        if (this.registerTokenInfo == null) {
            this.registerTokenInfo = {
                domain: "",
                isAdmin: undefined,
                key: undefined,
                username: undefined,
                token: ""
            }
        }

        return this.registerTokenInfo;
    }
    
    getInstanceName(): string {
        return this.initializer.options.options.instanceName;
    }
    
    markTokenAsUsed(_token: string): void {
        this.tokenUsed = true;
    }
    
    markRegisterKeyAsUsed(_key: string): void {
        this.registerKeyUsed = true;
    }
    
    changeLang(lang: string): void {
        this.localeService.setLang(lang);
        let t = new Date().getTime();
        let href = "?t=" + t;
        let registerTokenInfo = this.getRegisterTokenInfo();
        let token = registerTokenInfo.token;
        if (token) {
            href += "#token=" + token;
            if (registerTokenInfo.key) {
                href += "&k=" + encodeURIComponent(registerTokenInfo.key);
            }
            if (registerTokenInfo.username) {
                href += "&u=" + encodeURIComponent(registerTokenInfo.username);
            }
            if (registerTokenInfo.isAdmin) {
                href += "&a=1";
            }
        }
        let url = this.getAbsoluteUrl(href);
        window.location.href = url;
    }
    
    getAbsoluteUrl(href: string): string {
        let a = document.createElement("a");
        a.href = href;
        return a.href;
    }
    
    getDefaultHost(): string {
        return window.location.hostname;
    }
    
    openExternalUrl(url: string): void {
        UrlOpener.open(url);
    }
    
    isSupportedHashmail(hashmail: string): boolean {
        if (this.supportedHosts == null) {
            return true;
        }
        for (let i = 0; i < this.supportedHosts.length; i++) {
            if (Utils.endsWith(hashmail, "#" + this.supportedHosts[i])) {
                return true;
            }
        }
        return false;
    }
    
    getSupportedHosts(): string[] {
        return this.supportedHosts || [];
    }
    
    getTokenRegistrationUrl(token: string): string {
        return window.location.origin + window.location.pathname + "#token=" + token;
    }
    
    setNewCount(newCount: number): void {
        this.newCount = newCount;
        this.refreshAppTitle();
    }
    
    refreshAppTitle(): void {
        let title = (this.newCount > 0 ? "(" + this.newCount + ") " : "") + this.getAppTitle();
        if (this.onSetAppTitle) {
            title = this.onSetAppTitle(title);
        }
        window.document.title = title;
    }
    
    playAudio(soundName: string, force: boolean = false) {
        this.audioPlayer.play(soundName, force);
    }
    
    getWindowsTitleBarButtonsPosition(): string {
        let position = this.initializer.settings.getItem("windowsTitleBarButtonsPosition");
        return position == "left" || position == "right" ? position : "right";
    }
    
    setWindowsTitleBarButtonsPosition(position: string) {
        if (position == "left" || position == "right") {
            this.initializer.settings.setItem("windowsTitleBarButtonsPosition", position);
            this.windowManager.setWindowsTitleBarButtonsPosition(position);
        }
    }
    
    setAudioEnabled(enabled: boolean) {
        if (enabled) {
            this.audioPlayer.enable();
        }
        else {
            this.audioPlayer.disable();
        }
    }
    
    setUiLang(lang: string) {
        if (this.localeService.isValidLang(lang)) {
            this.initializer.saveLang(lang);
        }
    }
    
    createContent(file: app.FileHandle): privfs.lazyBuffer.IContent {
        return FileUtils.createBrowserLazyBuffer((<app.BrowserFileHandle>file).file);
    }
    
    openFile(): Q.Promise<privfs.lazyBuffer.IContent> {
        return FileUtils.openFile(this.isTestMode());
    }
    
    openFiles(): Q.Promise<privfs.lazyBuffer.IContent[]> {
        return FileUtils.openFiles(this.isTestMode());
    }
    
    directSaveContent(content: privfs.lazyBuffer.IContent, session: Session, _parent?: app.WindowParentEx): Q.Promise<void> {
        return this.saveContent(content, session, _parent);
    }
    
    saveContent(content: privfs.lazyBuffer.IContent, session: Session, parent?: app.WindowParentEx): Q.Promise<void> {
        return Q().then(() => {
            return content.getContent();
        })
        .then(content => {
            if (is.safari()) {
                this.ioc.create(MsgBoxWindowController, [parent || this, {
                    message: this.localeService.i18n("app.saveBlob.text"),
                    focusOn: "ok",
                    ok: {
                        visible: true,
                        btnClass: "btn-success",
                        label: this.localeService.i18n("app.saveBlob.button.download.label"),
                        action: {
                            type: "hideAndClose",
                            timeout: 10000
                        },
                        link: {
                            attrs: {
                                href: content.getDataUrl(),
                                download: name,
                                target: "_blank"
                            }
                        }
                    },
                    cancel: {
                        visible: true,
                        label: this.localeService.i18n("app.saveBlob.button.cancel.label")
                    }
                }])
                .then(msgBox => {
                    this.registerInstance(msgBox).open();
                });
            }
            else {
                return FileUtils.saveContent(content, this.isTestMode());
            }
        });
    }
    
    parseHash(): {[name: string]: any} {
        if (!this.originalUrl) {
            this.originalUrl = window.location.toString();
        }
        let hash = window.location.hash;
        hash = hash.indexOf("#") == 0 ? hash.substring(1) : hash;
        return this.initializer.parseQueryString(hash);
    }
    
    initHistory(): void {
        let parsedHash = this.parseHash();
        let registerTokenInfo: utils.RegisterTokenInfo = {
            domain: location.host,
            token: parsedHash.token,
            key: parsedHash.token && parsedHash.k ? parsedHash.k : undefined,
            isAdmin: parsedHash.token && parsedHash.a,
            username: parsedHash.token && parsedHash.u ? parsedHash.u : undefined
        }
        this.setRegisterTokenInfo(registerTokenInfo);
        // this.token = parsedHash.token;
        // this.registerKey = this.token && parsedHash.k;
        // this.adminRegistration = this.token && parsedHash.a;
        // this.predefinedUsername = this.token && parsedHash.u;
        window.addEventListener("hashchange", event => {
            let parsedHash = this.parseHash();
            if (parsedHash.token) {
                event.stopImmediatePropagation();
                document.location.reload();
                return false;
            }
        });
        this.history = history.createHashHistory();
        this.history.replace({pathname: "/"});
        this.history.listen(this.onHistoryChange.bind(this));
    }
    
    setContainerWindowHistoryEntry(entry: app.HistoryEntry, replace: boolean): void {
        if (replace) {
            this.history.replace(entry);
        }
        else {
            this.history.push(entry);
        }
    }
    
    onHistoryChange(historyEntry: history.Location): void {
        if (this.windows.container) {
            (<ContainerWindowController>this.windows.container).onHistoryChange(historyEntry);
        }
    }
    
    getScreenResolution(): {width: number, height: number} {
        return {
            width: window.screen.availWidth,
            height: window.screen.availHeight
        };
    }
    
    getScreenResolutionString(): string {
        return window.screen.availWidth + "x" + window.screen.availHeight;
    }
    
    getOs(): string {
        let os = this.initializer.browser.os();
        return `${os.family} ${os.version} (${navigator.userAgent})`;
    }
    
    getNetworkStatus(): string {
        return this.webMonitor.getNetworkStatus();
    }
    
    networkIsDown(): boolean {
        return this.getNetworkStatus() === "offline";
    }
    
    goBack(): void {
        this.history.goBack();
    }
    
    showOfflineIndicator(): void {
        if (this.$offlineIndicator) {
            this.$offlineIndicatorParent.prepend(this.$offlineIndicator);
        }
    }
    
    hideOfflineIndicator() {
        if (!this.$offlineIndicator) {
            this.$offlineIndicator = $('#offline-indicator');
            this.$offlineIndicatorParent = this.$offlineIndicator.parent();
        }
        this.$offlineIndicator.detach();
        this.$offlineIndicator.removeClass('hidden');
    }
    
    hasNetworkConnection(): boolean {
        if (this.networkIsDown()) {
            this.showOfflineError();
            return false;
        }
        return true;
    }
    
    waitForConnection(): Q.Promise<void> {
        if (!this.connectionRestoredDeferred) {
            this.connectionRestoredDeferred = Q.defer<void>();
            let interval = setInterval(() => {
                if (this.hasNetworkConnection()) {
                    clearInterval(interval);
                    this.connectionRestoredDeferred.resolve();
                    this.connectionRestoredDeferred = null;
                }
            }, 5000);
        }
        return this.connectionRestoredDeferred.promise;
    }
    
    openHtmlWindow(html: string, options: object, name?: string): WebWindow {
        let nwin = this.windowManager.open({type: "html", html: html, name: name}, options, null, null);
        nwin.on("close", () => {
            nwin.close(true);
        });
        let iframeDocument = nwin.iframe.contentWindow.document;
        iframeDocument.getElementById('close-button').addEventListener('click', () => {
            nwin.close(true);
        });
        return nwin;
    }
    
    showOfflineError(): void {
        let html = offlineErrorTemplate.func({
            message1: this.localeService.i18n('core.error.offline.message1'),
            message2: this.localeService.i18n('core.error.offline.message2'),
            assetsManager: this.assetsManager
        });
        let win = this.openHtmlWindow(html, {
            title: "PrivMX",
            width: 400,
            height: 200,
            position: 'center',
            draggable: true,
            resizable: false,
            modal: true
        });
        win.hideLoadingScreen();
    }
    
    getDefaultApplications(): ApplicationBinding[] {
        return (this.initializer.options.options.defaultApplication || []).map(x => {
            return {
                applicationId: x.applicationId,
                mimeType: x.mimeType,
                action: this.convertAppAction(x.action)
            };
        });
    }
    
    convertAppAction(action: string): ShellOpenAction {
        if (action == "open") {
            return ShellOpenAction.OPEN;
        }
        if (action == "preview") {
            return ShellOpenAction.PREVIEW;
        }
        return null;
    }
    
    registerViewersEditors() {
        super.registerViewersEditors();
        
        this.shellRegistry.registerApp({
            id: "core.web.external",
            open: (options: ShellOpenOptions): any => {
                Q().then(() => {
                    return options.element.getContent();
                })
                .then(content => {
                    return this.saveContent(content, options.session);
                })
                .fail(e => {
                    Logger.error("Error during downloading", e);
                });
            }
        });
        
        this.shellRegistry.registerApplicationBinding({applicationId: "core.web.external", mimeType: "*", action: ShellOpenAction.EXTERNAL});
    }
    
    getPlayerManager(): PlayerManager {
        return this.playerManager;
    }
    
    saveAsPdf(session: Session, file: OpenableElement, parentWindow?: AppWindow): Q.Promise<void> {
        return this.shellRegistry.shellOpen({
            element: file,
            action: ShellOpenAction.PRINT,
            session: session
        }).then(wnd => {
            return wnd.prepareToPrint(true).then(() => {
                wnd.saveAsPdf();
            }).then(() => {
                return wnd.afterSavedAsPdf.promise;
            });
        });
    }
    
    propagateCustomizedTheme(theme: CustomizationData): void {
        super.propagateCustomizedTheme(theme);
        for (let varName in theme) {
            document.documentElement.style.setProperty(varName, theme.cssVariables[varName]);
        }
    }
    
    getAppTitle(): string {
        return this.customizedTheme.title ? this.customizedTheme.title : location.hostname;
    }

    startScreenCover(): void {
        // console.log("starting screencover in web");
        if (this.screenCover) {
            this.screenCover.start();
        }
    }

    stopScreenCover(): void {

        if (this.screenCover) {
            this.screenCover.stop();
        }
    }
}
