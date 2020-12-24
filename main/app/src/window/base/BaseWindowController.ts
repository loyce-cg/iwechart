import {ComponentController} from "../../component/base/ComponentController";
import {StatusBarController} from "../../component/statusbar/StatusBarController";
import {MsgBoxOptions, MsgBoxResult} from "../msgbox/MsgBoxWindowController";
import {Options as ComposeWindowOptions} from "../compose/ComposeWindowController";
import * as Q from "q";
import {SyncTaskStream} from "./../../task/SyncTaskStream";
import {Settings} from "./../../utils/Settings";
import * as RootLogger from "simplito-logger";
import {BaseWindowPath} from "./BaseWindowPath";
import * as privfs from "privfs-client";
import {Window} from "../../app/common/window/Window";
import {DockedWindow} from "../../app/common/window";
import {Lang} from "../../utils/Lang";
import {Formatter} from "../../utils/Formatter";
import {CommonApplication} from "../../app/common/CommonApplication";
import {app,  mail,  event} from '../../Types';
import {func as pageTemplate} from "./template/page.html";
import {AssetSpec, AssetSpecEx} from "../../app/common/AssetsManager";
import {IpcSender} from "./IpcSender";
import {ErrorLog} from "../../app/common/ErrorLog";
import {ComponentFactory, titletooltip} from "../../component/main";
import {Inject, Dependencies} from "../../utils/Decorators";
import { UserPreferences, UnreadBadgeClickAction, PasteAsFileAction } from '../../mail/UserPreferences';
import { Session } from "../../mail/session/SessionManager";
import { MimeType } from "../../mail/filetree";
let Logger = RootLogger.get("privfs-mail-client");


export type SimplitoLogger = typeof RootLogger;

export interface SavedWindowState extends app.WindowState {
    maximized: boolean;
}

export interface ContextSection {
    sectionId: string;
    sectionType: "section" | "conv2" | "private";
}

@Dependencies(["statusbar", "progress"])
export class BaseWindowController extends ComponentController {
    
    static USE_WEBCONTENTS_PRINT: boolean = true;
    
    @Inject componentFactory: ComponentFactory;

    enableScreenCover: boolean = true;
    manager: BaseWindowManager<BaseWindowController>;
    id: number;
    className: string;
    reflect: BaseWindowPath;
    parent: app.WindowParent;
    isMainAppWindow: boolean = false;
    childWindows: BaseWindowController[];
    app: CommonApplication;
    ioc: IOC;
    openWindowOptions: app.WindowOptions;
    loadWindowOptions: app.WindowLoadOptions;
    taskStream: SyncTaskStream;
    statusBar: StatusBarController;
    errorCallback: (e: any) => void;
    logErrorCallback: (e: any) => void;
    settingsData: app.Settings;
    settings: Settings;
    nwin: Window;
    backgroundMode: boolean;
    msgBoxBaseOptions: MsgBoxOptions;
    modulesToLoad: string[];
    _checkInitPromise: Q.Promise<void>;
    _whenReadyDefer: Q.Deferred<void>;
    errorLog: ErrorLog;
    msgBoxInstance: MsgBox;
    afterPrinted: Q.Deferred<boolean> = Q.defer();
    afterSavedAsPdf: Q.Deferred<void> = Q.defer();
    isSpellCheckerEnabled: boolean = null;
    userPreferences: UserPreferences;
    fontMetrics: FontMetricsController;
    personsComponent: PersonsController;
    unreadBadgeClickAction: UnreadBadgeClickAction = null;
    unreadBadgeUseDoubleClick: boolean = null;
    pastingInProgress: boolean = false;
    isPickerOpen: boolean = false;
    titleTooltip: titletooltip.TitleTooltipController;
    
    
    constructor(parent: app.WindowParent, filename: string, dirname: string, settings?: app.Settings, taskStream?: SyncTaskStream) {
        super(parent, false);
        PerformanceLogger.log("openingWindows.BaseWindowController.constructor().start", this.className);
        this.ipcMode = true;
        this.settingsData = settings;
        this.app = this.parent.app;
        this.ioc = this.app.ioc;
        this.id = this.app.addToObjectMap(this);
        this.ipcSender = this.createIpcSender();
        this.ipcSender.addListener(this.onIpcMessage.bind(this));
        this.reflect = new BaseWindowPath(filename, dirname);
        this.msgBoxInstance = MsgBox.create(this, this.app.localeService, this.app.ioc);
        this.errorLog = new ErrorLog(this.getLogger(), this.app, this);
        this.childWindows = [];
        this.modulesToLoad = [];
        this.loadWindowOptions = {
            type: "render",
            lang: this.app.localeService.currentLang,
            title: "",
            bodyClass: "",
            viewName: this.className.replace("WindowController", "WindowView"),
            scripts: [],
            styles: [],
            dynamicScripts: [],
            fonts: [
                {family: "FontAwesome"},
                {family: "ico"},
                {family: "privmx-icons"},
                {family: "source_sans_pro", weight: "900"},
                {family: "source_sans_pro", weight: "bold"},
                {family: "source_sans_pro", weight: "normal"},
                {family: "source_sans_pro", weight: "600"},
                {family: "source_code_pro", weight: "normal"},
                {family: "source_code_pro", weight: "600"}
            ],
            isElectron: this.app.isElectronApp(),
            extraBodyAttributes: {
                "data-auto-task-picker": (this.app.userPreferences ? this.app.userPreferences.getIsAutoTaskPickerEnabled() : false) ? "true" : "false",
                "data-auto-file-picker": (this.app.userPreferences ? this.app.userPreferences.getIsAutoFilePickerEnabled() : false) ? "true" : "false",
            },
        };
        this.addViewScript({path: "build/privmx-view.js"});
        this.addViewStyle({path: "window/" + this.reflect.dirName + "/template/main.css"});
        let os = this.app.isElectronApp() ? process.platform : "win32";
        this.addViewStyle({path: "themes/default/css/fonts-" + os.toLowerCase() + ".css"});
        
        this.loadWindowAssets();
        this.openWindowOptions = {};
        if (taskStream) {
            this.taskStream = taskStream;
        }
        else {
            this.taskStream = new SyncTaskStream();
            this.statusBar = this.addComponent("statusBar", this.componentFactory.createComponent("statusbar", [this, this.taskStream]));
        }
        this.errorCallback = this.errorLog.errorCallback;
        this.logErrorCallback = this.errorLog.logErrorCallback;
        this._whenReadyDefer = Q.defer<void>();
        this.setCurrentTheme();
        PerformanceLogger.log("openingWindows.BaseWindowController.constructor().end", this.className);
        this.fontMetrics = new FontMetricsController(this.retrieveFromView.bind(this));
        this.titleTooltip = this.addComponent("titleTooltip", this.componentFactory.createComponent("titletooltip", [this]));
    }
    
    onViewComponentViewLoaded(timeoutCall?: boolean): void {
        if (!timeoutCall && this.app.isElectronApp() && this.nwin && this.openWindowOptions && this.openWindowOptions.keepSpinnerUntilViewLoaded && !this.openWindowOptions.manualSpinnerRemoval) {
            this.nwin.removeSpinner();
        }
        if (!this.app) {
            return;
        }
        if (!this.app.isLogged() || !this.app.userPreferences) {
            setTimeout(() => {
                this.onViewComponentViewLoaded(true);
            }, 1000);
            return;
        }
          
        this.app.userPreferences.eventDispatcher.addEventListener<event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            if (this.app && this.app.isLogged() && this.app.userPreferences) {
                this.callViewMethod("setClipboardIntegration", this.getSystemClipboardIntegration());
                this.callViewMethod("setTaskPickerEnabled", this.app.userPreferences.getIsAutoTaskPickerEnabled());
                this.callViewMethod("setFilePickerEnabled", this.app.userPreferences.getIsAutoFilePickerEnabled());
            }
        });
        this.callViewMethod("setClipboardIntegration", this.getSystemClipboardIntegration());
    }
    
    skipLoadingFonts(): void {
        let opts = <any>this.loadWindowOptions;
        if (opts && opts.fonts) {
            delete opts.fonts;
        }
    }
    
    getSystemClipboardIntegration(): string {
        if (this.app.userPreferences && this.app.isLogged()) {
            return this.app.userPreferences.getSystemClipboardIntegration();
        }
        return "enabled";
    }
    
    registerWindowListeners(): void {
        this.app.addEventListener<event.AllWindowsMessage>("all-windows-message", this.onAllWindowsMessage.bind(this), this.manager.uid, this.manager.isMainWindow() ? "ethernal" : "normal");
    }
    
    
    loadWindowAssets(): void {
        this.app.ioc.getComponentDependencies(this.constructor).forEach(x => {
            let comp = <{ASSETS: AssetSpecEx[]}><any>this.app.ioc.components[x];
            if (comp.ASSETS) {
                comp.ASSETS.forEach(asset => {
                    if (asset.type == "script") {
                        this.addViewScript(asset);
                    }
                    else
                    if (asset.type == "style") {
                        this.addViewStyle(asset);
                    }
                });
            }
        });
    }
    
    createIpcSender(channelName: string = null): app.IpcSender {
        if (channelName === null) {
            channelName = this.getIpcChannelName();
        }
        return new IpcSender(this, channelName);
    }
    
    setViewBasicFonts() {
        (<app.WindowLoadOptionsRender>this.loadWindowOptions).fonts = [
            {family: "FontAwesome"},
            {family: "source_sans_pro", weight: "normal"}
        ];
    }
    
    addViewScript(spec: AssetSpec) {
        // console.log("addViewScript", spec);
        let url = this.app.assetsManager.getAssetEx(spec);
        let lopt = <app.WindowLoadOptionsRender>this.loadWindowOptions;
        Lang.uniqueAdd(lopt.scripts, url);
    }

    addDynamicScript(scriptBody: string): void {
        // console.log("addDynamicScript", scriptBody);
        let lopt = <app.WindowLoadOptionsRender>this.loadWindowOptions;
        lopt.dynamicScripts.push(scriptBody);
    }
    
    removeViewScript(spec: AssetSpec) {
        let url = this.app.assetsManager.getAssetEx(spec);
        let lopt = <app.WindowLoadOptionsRender>this.loadWindowOptions;
        Lang.removeFromList(lopt.scripts, url);
    }
    
    replaceViewScript(originalSpec: AssetSpec, newSpec: AssetSpec) {
        let originalUrl = this.app.assetsManager.getAssetEx(originalSpec);
        let newUrl = this.app.assetsManager.getAssetEx(newSpec);
        let lopt = <app.WindowLoadOptionsRender>this.loadWindowOptions;
        Lang.replaceArrayElement(lopt.scripts, originalUrl, newUrl);
    }
    
    addViewStyle(spec: AssetSpec, index?: number) {
        let url = this.app.assetsManager.getAssetEx(spec);
        let lopt = <app.WindowLoadOptionsRender>this.loadWindowOptions;
        if (index != null) {
            let oldIndex = lopt.styles.indexOf(url);
            if (oldIndex != -1) {
                lopt.styles.splice(oldIndex, 1);
            }
            lopt.styles.splice(index, 0, url);
        }
        else {
            Lang.uniqueAdd(lopt.styles, url);
        }
    }
    
    removeViewStyle(spec: AssetSpec) {
        let url = this.app.assetsManager.getAssetEx(spec);
        let lopt = <app.WindowLoadOptionsRender>this.loadWindowOptions;
        Lang.removeFromList(lopt.styles, url);
    }
    
    replaceViewStyle(originalSpec: AssetSpec, newSpec: AssetSpec) {
        let originalUrl = this.app.assetsManager.getAssetEx(originalSpec);
        let newUrl = this.app.assetsManager.getAssetEx(newSpec);
        let lopt = <app.WindowLoadOptionsRender>this.loadWindowOptions;
        Lang.replaceArrayElement(lopt.styles, originalUrl, newUrl);
    }
    
    setPluginViewAssets(pluginName: string) {
        this.addViewStyle({path: "window/base/BaseWindow.css"}, 0);
        this.replaceViewStyle(
            {path: "window/" + this.reflect.dirName + "/template/main.css"},
            {path: "window/" + this.reflect.dirName + "/template/main.css", plugin: pluginName}
        );
        this.addViewScript({path: "build/view.js", plugin: pluginName});
    }
    
    checkConnectionLost(e: any): boolean {
        return this.errorLog.checkConnectionLost(e);
    }
    
    getLogger(): SimplitoLogger {
        return Logger.get(this.reflect.qualifiedName);
    }
    
    logError(e: any): void {
        return this.errorLog.logError(e);
    }
    
    onError(e: any): Q.IWhenable<any> {
        return this.errorLog.onError(e);
    }
    
    onErrorCustom(text: string, e: any, noConnectionLostCheck?: boolean): Q.IWhenable<any> {
        return this.errorLog.onErrorCustom(text, e, noConnectionLostCheck);
    }
    
    errorAlert(text: string, e: any): Q.Promise<MsgBoxResult> {
        return this.errorLog.errorAlert(text, e);
    }
    
    prepareErrorMessage(e: any, preFn?: (error: {code: number, message: string}) => {code: number, message: string}): string {
        return this.errorLog.prepareErrorMessage(e, preFn);
    }
    
    onViewReportUnhandledError(m?:any, l?:any, s?:any, c?:any, e?:any) {
        console.log("Unhandled error: ", m,l,s,c,e);
        let errorObj = {
            type: "ViewUnhandledError",
            m, l, s, c, e
        }
        throw new Error(JSON.stringify(errorObj));
    }
    
    onViewOpenContextMenu(): void {
        this.nwin.openContextMenu();
    }
    
    loadSettings() {
        if (this.settingsData == null) {
            return Q();
        }
        return Q().then(() => {
            return this.settingsData.isPublic ? this.app.getDefaultSettings() : this.app.mailClientApi.privmxRegistry.getLocalStorage();
        })
        .then(storage => {
            this.settings = new Settings(this.reflect.controllerName, this.settingsData.defaultValue, storage, this.settingsData.subs);
            return this.settings.init();
        });
    }
    
    whenReady(): Q.Promise<void> {
        return this._whenReadyDefer.promise
    }
    
    addModuleToLoad(module: string) {
        Lang.uniqueAdd(this.modulesToLoad, module);
    }
    
    checkInit(): Q.Promise<void> {
        // console.log("checkInit")
        if (this._checkInitPromise == null) {
            this._checkInitPromise = Q().then(() => {
                return this.loadSettings();
            })
            .then(() => {
                // console.log("checkInit - after loadSettings");
                let promises: Q.Promise<any>[] = [];
                this.modulesToLoad.forEach(module => {
                    if (module == "settings") {
                        promises.push(this.app.mailClientApi.privmxRegistry.getLocalStorage());
                    }
                    else if (module == "contacts") {
                        promises.push(this.app.mailClientApi.prepareContactService());
                    }
                    else if (module == "contacts-presence") {
                        // promises.push(this.app.mailClientApi.turOnContactPresenceCheck());
                    }
                    else {
                        this.getLogger().warn("Unknown module to load '" + module + "'");
                    }
                });
                return Q.all(promises);
            })
            .then(() => {
                // console.log("checkInit - init before");
                return this.init();
            })
            .then(() => {
                this._whenReadyDefer.resolve();
            });
        }
        return this._checkInitPromise;
    }
    
    init(): Q.IWhenable<void> {
    }
    
    prepareBeforeShowing(): Q.Promise<void> {
        return null;
    }

    afterInit(): Q.IWhenable<void> {
        // console.log("afterInit")
        this.updateUnreadBadgeClickAction();
        this.updateUnreadBadgeUseDoubleClick();
    }
    
    getLoadOptions(): app.WindowLoadOptions {
        if (this.loadWindowOptions.type == "render") {
            let html = pageTemplate.func(this.loadWindowOptions, null, new Formatter());
            if (this.app.customizedTheme) {
                html = html.replace("<style type=\"text/css\"></style>", "<style type=\"text/css\">" + this.app.customizedTheme.css + "</style>");
            }
            return {
                type: "html",
                html: html,
                name: this.loadWindowOptions.viewName,
                host: this.loadWindowOptions.host
            };
        }
        return this.loadWindowOptions;
    }
    
    open(singletonName?: string): void {
        // console.log("open - parent", this && this.parent && (<any>this.parent).manager ? (<any>this.parent).manager.uid : "null");
        if (this.networkIsDown()) {
            this.showOfflineError();
            this.close(true);
            return;
        }
        
        let prep = this.prepareBeforeShowing();
        if (prep) {
            prep.then(() => {
                this.open(singletonName);
            })
            return;
        }
        
        this.parent.registerInstance(this);
        // console.log("open before")
        this.nwin = this.app.openWindow(this.getLoadOptions(), this.openWindowOptions, this, this.parent, singletonName);
        this.nwin.on("close", this.onNwinClose.bind(this));
        this.nwin.on("loaded", this.onNwinLoad.bind(this));
        this.nwin.on("initialized", this.onNwinInitialized.bind(this));
        this.nwin.on("resize", this.onNwinResize.bind(this));
        this.nwin.on("focus", this.onNwinFocus.bind(this));
        this.registerWindowListeners();
        this.checkInit();
    }
    
    openDocked(window: Window, id: number, singletonName?: string): void {
        // console.log("open docked");
        if (this.networkIsDown()) {
            this.showOfflineError();
            this.close(true);
            return;
        }
        let parentManager = (<BaseWindowController>this.parent).manager;
        if (!parentManager) {
            Logger.debug("no defined parent manager in", this.className);
        }
        let childManager = new BaseWindowManager(this, parentManager);

        this.nwin = window.createDockedWindow(id, this.getLoadOptions(), this.openWindowOptions, this.id, this.ipcChannelName, this.app);
        if (!parentManager.openChild(childManager, singletonName, id)) {
            Logger.debug("OpenDocked: this.manager.openChild returned null");
            return;
        }
        this.parent.registerInstance(this);
        this.nwin.on("close", this.onNwinClose.bind(this));
        this.nwin.on("loaded", this.onNwinLoad.bind(this));
        this.nwin.on("initialized", this.onNwinInitialized.bind(this));
        this.nwin.on("resize", this.onNwinResize.bind(this));
        this.nwin.on("focus", this.onNwinFocus.bind(this));
        this.checkInit();
    }
    
    onNwinLoad(): Q.Promise<void> {
        return Q().then(() => {
            return this.checkInit();
        })
        .then(() => {
            return this.nwin.start();
        })
        .fail(this.errorCallback);
    }
    
    onNwinInitialized(): Q.Promise<void> {
        return Q().then(() => {
            if (this.nwin.isDocked()) {
                this.parent.onDockedLoad(this);
            }
            return this.nwin.hideLoadingScreen();
        })
        .then(() => {
            return this.afterInit();
        })
        .then(() => {
            // call clearCache in interval
            if (this.app.isElectronApp()) {
                this.callViewMethod("clearCache");
            }
            return;
        })
        .fail(this.errorCallback);
    }
    
    onDockedLoad(_bwc: BaseWindowController): void {
    }
    
    onNwinResize(type: string): void {
        this.callViewMethod("setSize", type);
    }
    
    onNwinClose(): void {
        this.close();
    }
    
    onNwinFocus(): void {
        this.callViewMethod("focus");
    }
    
    focusMe(): void {
        if (!this.nwin) {
            return;
        }
        if (this.nwin.isDocked() || (<any>this.parent).focusDocked) {
            (<any>this.parent).focusDocked((<DockedWindow>this.nwin).id);
        }
        else {
            this.nwin.focus();
        }
    }
    
    focusDocked(id: number) {
        this.callViewMethod("focusDocked", id);
    }
    
    setTitle(title: string): void {
        try {
            if (!this.nwin) {
                if (this.openWindowOptions) {
                    this.openWindowOptions.title = title;
                }
            }
            else {
                this.nwin.setTitle(title);
            }
        } catch (e) {
            // supress electron error "Object has been destroyed" when acting on non-existant window
        }
    }
    
    onClose(): Q.IWhenable<void> {
        this.app.getOpenedElementsManager().remove(this.id);
        if (this.app.eventDispatcher) {
            this.app.eventDispatcher.removeEventListenerByReferrer(this.manager.uid);
        }
        this.nwin.close(true);
        this.destroy();
        // this.parent.onChildWindowClose(this);
    }
    
    close(force?: boolean): Q.IWhenable<void> {
        // return Q().then(() => {
        //     return this.beforeClose(force);
        // })
        // .then(() => {
        //     return this.closeAllChildWindows();
        // })
        // .then(() => {
        //     return this.afterChildWindowsClose(force);
        // })
        // .then(() => {
        //     return this.onClose();
        // });
        if (!this.manager) {
            return;
        }
        this.manager.close(force);
        return;
    }
    
    closeAllChildWindows(): Q.Promise<void> {
        let promises: Q.Promise<any>[] = [];
        this.childWindows.forEach(win => {
            let whenable = win.close();
            promises.push(Q().then(() => whenable));
        });
        return Q.all(promises).then(() => {});
    }
    
    beforeClose(_force?: boolean): Q.IWhenable<void> {
    }
    
    afterChildWindowsClose(_force?: boolean): Q.IWhenable<void> {
    }
    
    getClosestBaseWindowController(): BaseWindowController {
            if (this.manager) {
                return this;
            }
            else
            if (this.parent) {
                return (<BaseWindowController>this.parent).getClosestBaseWindowController();
            }
            else {
                return null;
            }
    }

    
    openChildWindow<T extends BaseWindowController>(win: T, delayedOpenDeferred?: Q.Deferred<T>): T {
        // console.log("open child window")
        if (win.networkIsDown()) {
            win.showOfflineError();
            win.close(true);
            return;
        }
        
        let prep = win.prepareBeforeShowing();
        if (prep) {
            prep.then(() => {
                this.openChildWindow(win, delayedOpenDeferred);
            })
            return;
        }
        
        if (!win.parent) {
            win.parent = win.getClosestNotDockedController();
        }
        
        this.registerInstance(win);
        win.nwin = this.app.openWindow(win.getLoadOptions(), win.openWindowOptions, win, win.parent);
        win.nwin.on("close", win.onNwinClose.bind(win));
        win.nwin.on("loaded", win.onNwinLoad.bind(win));
        win.nwin.on("initialized", win.onNwinInitialized.bind(win));
        win.nwin.on("resize", win.onNwinResize.bind(win));
        win.nwin.on("focus", win.onNwinFocus.bind(win));
        win.checkInit();
        win.registerWindowListeners();
        if (delayedOpenDeferred) {
            delayedOpenDeferred.resolve(win);
        }
        return win;
    }
    
    onChildWindowClose(win: BaseWindowController): void {
        let idx = this.childWindows.indexOf(win);
        if (idx > -1) {
            this.childWindows.splice(idx, 1);
        }
    }
    
    getChilWindowParent(): BaseWindowController {
        return this;
    }
    
    onViewFocus(): void {
        let nonDocked = this.getClosestNotDockedController();
        if (nonDocked && nonDocked.nwin) {
            nonDocked.nwin.focus();
        }
    }
    
    onViewInvite(): void {
        if (!this.app.isInviteFriendEnabled()) {
            this.alert(this.i18n("window.base.invitation.disabled"));
            return;
        }
        let controller = this;
        Q().then(() => {
            return controller.app.mailClientApi.privmxRegistry.getUtilApi();
        })
        .then(utilApi => {
            return utilApi.generateInviteToken();
        })
        .then(token => {
            return this.app.getTokenRegistrationUrl(token);
        })
        .then(link => {
            return controller.promptEx({
                message: this.i18n("window.base.invitation.prompt.text"),
                input: {
                    value: link,
                    readonly: true,
                    multiline: true
                }
            });
        })
        .fail(this.errorCallback);
    }
    
    onViewOpenUrl(url: string): void {
        this.app.openUrl(url);
    }
    
    onViewToogleDevTools(): void {
        let nonDocked = this.getClosestNotDockedController();
        if (nonDocked && nonDocked.nwin && this.app.isElectronApp()) {
            (<any>nonDocked.nwin).toogleDevTools();
        }
    }
    
    onViewSetWindowHeight(height: number): void {
        if (this.nwin) {
            this.nwin.setHeight(height);
        }
    }
    
    onViewTabSwitch(shiftKey: boolean, ctrlKey: boolean): void {
        if ((<any>this.parent).onChildTabSwitch) {
            (<any>this.parent).onChildTabSwitch(this, shiftKey, ctrlKey);
        }
    }

    onViewEnterPressed(shiftKey: boolean, ctrlKey: boolean): void {
        this.app.dispatchEvent({ type: "binded-enter-pressed", shiftKey, ctrlKey});
    }
    
    setBackgroundModeOn(): boolean {
        if (!this.isInBackgroundMode()) {
            this.backgroundMode = true;
            return true;
        }
        return false;
    }
    
    setBackgroundModeOff(): boolean {
        if (this.isInBackgroundMode()) {
            this.backgroundMode = false;
            return true;
        }
        return false;
    }
    
    isInBackgroundMode(): boolean {
        return this.backgroundMode === true;
    }
    
    addTask(text: string, blockUI: boolean, taskFunction: () => Q.IWhenable<any>): Q.Promise<void> {
        return this.taskStream.createTask(text, {blockUI: blockUI}, taskFunction).getPromise();
    }
    
    addTaskEx(text: string, blockUI: boolean, taskFunction: () => Q.IWhenable<any>): Q.Promise<void> {
        return this.addTask(text, blockUI, taskFunction)
        .fail(this.errorCallback);
    }
    
    addTaskExWithProgress(text: string, blockUI: boolean, channelId: number, taskFunction: (progress: (data?: any) => void) => Q.IWhenable<any>): Q.Promise<void> {
        let progress = this.componentFactory.createComponent("progress", [this, channelId]);
        return this.addTask(text, blockUI, () => {
            return Q().then(() => {
                progress.start();
                return taskFunction(progress.progress.bind(progress));
            })
            .progress(value => {
                progress.progress(value);
            })
            .fin(() => {
                progress.finish();
            });
        })
        .fail(this.errorCallback);
    }
    
    sendMail(options: ComposeWindowOptions): void {
        return this.app.sendMail(options);
    }
    
    sendBlankMail(): void {
        return this.app.sendBlankMail();
    }
    
    sendMailTo(receiver: string|privfs.message.MessageReceiver): void {
        return this.app.sendMailTo(receiver);
    }
    
    getClosestNotDockedController(): BaseWindowController {
        // if (!this.nwin) {
        //     return null;
        // }
        if (this.nwin && this.nwin.isDocked()) {
            if (this.parent && this.parent.getClosestNotDockedController) {
                return this.parent.getClosestNotDockedController();
            }
            return null;
        }
        if (!this.nwin) {
            return null;
        }
        return this;
    }
    
    logout(): void {
        return this.app.logout();
    }
    
    downloadAttachment(session: Session, attachment: privfs.message.MessageAttachment): Q.Promise<void> {
        if (this.networkIsDown()) {
            this.showOfflineError();
            return Q();
        }
        return this.app.downloadAttachment(session, attachment, this);
    }
    
    downloadContent(session: Session, content: privfs.lazyBuffer.IContent): Q.Promise<void> {
        if (this.networkIsDown()) {
            this.showOfflineError();
            return Q();
        }
        return this.app.downloadContent(session, content, this);
    }
    
    i18n(_key: string, ..._args: any[]): string {
        return this.app.localeService.i18n.apply(this.app.localeService, arguments);
    }
    
    deleteMessage(indexEntry: mail.MessageHandler): Q.Promise<void> {
        if (this.networkIsDown()) {
            this.showOfflineError();
            return Q<void>(null);
        }
        let controller = this;
        return this.addTask(this.i18n("window.base.task.deleteMessage.text"), true, () => {
            return Q().then(() => {
                if (indexEntry.sink.extra.type == "trash") {
                    return controller.confirm(controller.i18n("window.base.task.deleteMessage.confirm.text"));
                }
                return {result: "yes"};
            })
            .then(result => {
                if (result.result != "yes") {
                    return false;
                }
                return Q().then(() => {
                    return controller.app.mailClientApi.privmxRegistry.getSinkService();
                })
                .then(sinkService => {
                    return sinkService.deleteMessage(indexEntry);
                })
                .then(() => {
                    controller.app.playAudio("message-deleted");
                    return true;
                });
            })
            .fail(controller.onErrorCustom.bind(controller, controller.i18n("window.message.error.deleteMessage")));
        });
    }
    
    networkIsDown(): boolean {
        return this.app.networkIsDown();
    }
    
    showOfflineError(): void {
        return this.app.showOfflineError();
    }
    
    setWindowIcon(content: privfs.lazyBuffer.IContent): void {
        let icon = this.app.shellRegistry.resolveIcon(content ? content.getMimeType() : "");
        if (this.nwin) {
            this.nwin.setIcon(icon);
        }
        else {
            this.openWindowOptions.icon = icon;
        }
    }
    
    reopenWithParams(_params: any): void {
    }
    
    getWindowStateKey() {
        return this.className + ":windowState";
    }
    
    loadWindowState(): Q.Promise<void> {
        return Q().then(() => {
            return this.app.getDefaultSettings().get(this.getWindowStateKey());
        })
        .then((state: SavedWindowState) => {
            if (state) {
                if (this.nwin) {
                    this.nwin.setPosition(state.x, state.y);
                    this.nwin.setSize(state.width, state.height);
                    if (state.maximized) {
                        this.openWindowOptions.maximized = true;
                        
                        if (!this.app.hiddenMode) {
                            this.nwin.maximize();
                        }
                    }
                }
                else {
                    this.openWindowOptions.positionX = state.x;
                    this.openWindowOptions.positionY = state.y;
                    this.openWindowOptions.width = state.width;
                    this.openWindowOptions.height = state.height;
                    this.openWindowOptions.maximized = state.maximized;
                }
            }
        });
    }
    
    saveWindowState(_force?: boolean): Q.Promise<void> {
        return Q().then(() => {
            if (!this.nwin) {
                return;
            }
            let state = this.nwin.getRestoreState();
            let savedState: SavedWindowState = {
                x: state.x,
                y: state.y,
                width: state.width,
                height: state.height,
                maximized: this.openWindowOptions.maximized
            };
            return this.app.getDefaultSettings().set(this.getWindowStateKey(), savedState);
        });
    }
    
    alert(message?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxInstance.alert(message);
    }
    
    alertEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxInstance.alertEx(options);
    }
    
    confirm(message?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxInstance.confirm(message);
    }
    
    confirmEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxInstance.confirmEx(options);
    }
    
    prompt(message?: string, value?: string): Q.Promise<MsgBoxResult> {
        return this.msgBoxInstance.prompt(message, value);
    }
    
    promptEx(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxInstance.promptEx(options);
    }
    
    msgBox(options: MsgBoxOptions): Q.Promise<MsgBoxResult> {
        return this.msgBoxInstance.msgBox(options);
    }
    
    prepareToPrint(scale: boolean = false): Q.Promise<void> {
        return this.whenReady().then(() => {
            this.callViewMethod("autoIframeHeight");
        });
    }
    
    print(): void {
        this.afterPrinted = Q.defer();
        this.whenReady().then(() => {
            if (BaseWindowController.USE_WEBCONTENTS_PRINT && this.app.isElectronApp()) {
                let win = <ElectronWindow>this.nwin;
                win.window.webContents.print({}, printed => {
                    if (printed) {
                        this.onViewPrinted();
                    }
                    else {
                        this.onViewPrintCancelled();
                    }
                });
            }
            else {
                this.callViewMethod("print");
                // this.app.onCancelPrintCallback = () => {
                //     setTimeout(() => {
                //         this.onViewPrintCancelled();
                //     }, 1000);
                // };
            }
        });
    }
    
    saveAsPdf(): void {
        this.whenReady().then(() => {
            this.callViewMethod("saveAsPdf");
        });
    }
    
    onViewPrinted() {
        setTimeout(() => {
            this.close();
            this.afterPrinted.resolve(true);
        }, 1000);
    }
    
    onViewPrintCancelled() {
        setTimeout(() => {
            this.close();
            this.afterPrinted.resolve(false);
        }, 1000);
    }
    
    onViewSavedAsPdf() {
        setTimeout(() => {
            this.close();
            this.afterSavedAsPdf.resolve();
        }, 1000);
    }
    
    setCurrentTheme() {
        this.setCustomizedTheme(this.app.isUsingTemporaryCustomizedTheme ? this.app.temporaryCustomizedTheme : this.app.customizedTheme);
    }
    
    setCustomizedTheme(theme: CustomizationData) {
        if (!theme) {
            return;
        }
        this.whenReady().then(() => {
            this.callViewMethod("setCustomizedTheme", JSON.stringify(theme));
            setTimeout(() => {
                this.callViewMethod("setCustomizedTheme", JSON.stringify(theme));
            }, 1000);
        });
    }
    
    onViewToggleSearch(): void {
        this.tryToggleSearch();
    }
    
    tryToggleSearch(): void {
        if (this.app.isElectronApp()) {
            let nwin = this.nwin;
            while (nwin instanceof DockedWindow) {
                nwin = nwin.getParent();
            }
            if (nwin && nwin == this.app.windows.container.nwin) {
                this.toggleSearch();
            }
        }
    }
    
    toggleSearch(): void {
        let searchModel = this.app.searchModel.get();
        searchModel.visible = !searchModel.visible;
        this.app.searchModel.set(searchModel);
        
    }
    
    initSpellChecker(userPreferences?: UserPreferences): void {
        if (!this.app.isElectronApp()) {
            return;
        }
        if (userPreferences) {
            this.setUserPreferences(userPreferences);
        }
        else if (!this.userPreferences) {
            Logger.error("No userPreferences provided (BaseWindowController.initSpellChecker())");
            return;
        }
        
        let lang = this.app.localeService.currentLang;
        let isSpellCheckerEnabled = this.userPreferences.isSpellCheckerEnabled();
        if (isSpellCheckerEnabled === this.isSpellCheckerEnabled && SpellCheckerController.currentLang == lang) {
            return;
        }
        
        if (isSpellCheckerEnabled) {
            SpellCheckerController.init(lang, process.platform);
            this.callViewMethod("initSpellChecker", lang);
            this.isSpellCheckerEnabled = true;
        }
        else {
            this.callViewMethod("stopSpellChecker");
            this.isSpellCheckerEnabled = false;
        }
    }
    
    setUserPreferences(userPreferences?: UserPreferences) {
        this.userPreferences = userPreferences;
        this.userPreferences.eventDispatcher.addEventListener<event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this), this.manager.uid, "normal");
    }
    
    onViewCheckSpelling(channelId: number, wordsStr: string): void {
        let words: string[] = JSON.parse(wordsStr);
        let misspelled: string[] = words.filter(w => SpellCheckerController.isMisspelled(w));
        this.sendToViewChannel(channelId, JSON.stringify(misspelled));
    }
    
    onUserPreferencesChange(event: event.UserPreferencesChangeEvent): void {
        this.initSpellChecker();
        this.updateUnreadBadgeClickAction();
        this.updateUnreadBadgeUseDoubleClick();
    }
    
    updateUnreadBadgeClickAction(): void {
        if (!this.userPreferences && this.app.userPreferences) {
            this.setUserPreferences(this.app.userPreferences);
        }
        if (!this.userPreferences) {
            return;
        }
        let unreadBadgeClickAction: UnreadBadgeClickAction = this.userPreferences.getUnreadBadgeClickAction();
        if (unreadBadgeClickAction !== this.unreadBadgeClickAction) {
            this.unreadBadgeClickAction = unreadBadgeClickAction;
            this.callViewMethod("setUnreadBadgeClickAction", this.unreadBadgeClickAction);
        }
    }
    
    updateUnreadBadgeUseDoubleClick(): void {
        if (!this.userPreferences && this.app.userPreferences) {
            this.setUserPreferences(this.app.userPreferences);
        }
        if (!this.userPreferences) {
            return;
        }
        let unreadBadgeUseDoubleClick: boolean = this.userPreferences.getUnreadBadgeUseDoubleClick();
        if (unreadBadgeUseDoubleClick !== this.unreadBadgeUseDoubleClick) {
            this.unreadBadgeUseDoubleClick = unreadBadgeUseDoubleClick;
            this.callViewMethod("setUnreadBadgeUseDoubleClick", this.unreadBadgeUseDoubleClick);
        }
    }
    
    onAllWindowsMessage(e: event.AllWindowsMessage): void {
        if (this.enableScreenCover && this.nwin && (<any>this.nwin).className == "com.privmx.core.app.electron.window.ElectronWindow") {
            if (e.message == "show-screen-cover") {
                this.showScreenCover();
            }
            else if (e.message == "hide-screen-cover") {
                this.hideScreenCover();
            }
            else if (e.message == "show-no-connection-screen-cover") {
                this.showNoConnectionScreenCover();
            }
            else if (e.message == "hide-no-connection-screen-cover") {
                this.hideNoConnectionScreenCover();
            }
            else if (e.message == "set-zoom-level") {
                let zoomLevel = JSON.parse(e.extra).zoomLevel;
                this.setZoomLevel(zoomLevel);
            }
            else if (e.message == "connection-msg") {
                this.updateConnectionScreenCoverStatus(e.extra);
            }
        }
    }
    
    showScreenCover(): void {
        this.callViewMethod("toggleScreenCover", true);
    }
    
    hideScreenCover(): void {
        this.callViewMethod("toggleScreenCover", false);
    }

    showNoConnectionScreenCover(): void {
        this.callViewMethod("toggleNoConnectionScreenCover", true);
    }

    updateConnectionScreenCoverStatus(extra: string): void {
        if (extra) {
            this.callViewMethod("updateConnectionScreenCoverStatus", extra);
        }
        else {
            this.callViewMethod("resetConnectionScreenCoverStatus");
        }
    }
    
    hideNoConnectionScreenCover(): void {
        this.callViewMethod("toggleNoConnectionScreenCover", false);
    }
    
    onViewUIEvent(): void {
        this.app.getUIEventsListener()();
    }
    
    onViewScreenCoverClick(): void {
        if ((<any>this.app).screenCover) {
            (<any>this.app).screenCover.onCoverClick();
        }
    }
    
    enableTaskBadgeAutoUpdater(): void {
        this.app.addEventListener<{ type: "task-badge-changed", taskId: string, taskLabelClass: string }>("task-badge-changed", e => {
            this.callViewMethod("updateTaskBadges", e.taskId, e.taskLabelClass);
        });
    }

    center(): void {
        if (this.app.isElectronApp()) {
            (<ElectronWindow>this.nwin).center();
        }
    }
    
    tryPasteFiles(paths: string[]): Q.Promise<boolean> {
        return this.app.tryPasteFiles(paths);
    }
    
    onViewConsoleLog(...args: any[]): void {
        console.log(...args);
    }
    
    onViewCustomCopy(dataStr: string): void {
        let data: { text: string, html: string } = JSON.parse(dataStr);
        this.app.setSystemCliboardData(data);
        this.app.clipboard.set(data, new Date(), "privmx");
    }
    
    onViewCustomPaste(onlyPlainText: boolean = false): void {
        if (!this.app.isLogged() && Clipboard.LOGGED_OUT_CLIPBOARD_INTEGRATION_ENABLED) {
            this.callViewMethod("customPaste", JSON.stringify(this.app.clipboard.get("text", "system")));
            return;
        }
        this.app.getClipboardElementToPaste([Clipboard.FORMAT_TEXT, Clipboard.FORMAT_HTML, Clipboard.FORMAT_PRIVMX_FILE, Clipboard.FORMAT_PRIVMX_FILES], [Clipboard.FORMAT_TEXT, Clipboard.FORMAT_HTML, Clipboard.FORMAT_SYSTEM_FILES], onlyPlainText).then(el => {
            if (el && el.data) {
                for (let k in el.data) {
                    if (typeof(el.data[k]) == "string") {
                        el.data[k] = el.data[k];
                    }
                }
                if (Clipboard.FORMAT_PRIVMX_FILE in el.data || Clipboard.FORMAT_PRIVMX_FILES in el.data || Clipboard.FORMAT_SYSTEM_FILES in el.data) {
                    if (this.handleFilePaste(el)) {
                        return;
                    }
                }
                this.callViewMethod("customPaste", JSON.stringify(el.data));
            }
        });
    }
    
    handleFilePaste(element: ClipboardElement): boolean {
        return false;
    }
    
    copy(): void {
        this.callViewMethod("copy", true);
    }
    
    cut(): void {
        this.callViewMethod("cut", true);
    }
    
    paste(): void {
        this.callViewMethod("paste", true);
    }
    
    onViewZoomOut(): void {
        this.app.zoomOut();
    }
    
    onViewZoomIn(): void {
        this.app.zoomIn();
    }
    
    onViewResetZoom(): void {
        this.app.resetZoom();
    }
    
    setZoomLevel(zoomLevel: number): void {
        this.nwin.setZoomLevel(zoomLevel);
    }
    
    onViewRequestTaskPicker(currentTaskId: string, relatedHostHash: string, relatedSectionId: string, disableCreatingTasks: boolean): void {
        if (this.isPickerOpen) {
            return;
        }
        this.isPickerOpen = true;
        Q().then(() => {
            let initialSearchText: string = undefined;
            if (currentTaskId) {
                initialSearchText = `#${currentTaskId}`;
            }
            let parent = this.getClosestNotDockedController();
            let def = Q.defer<void>();
            let session = this.app.sessionManager.getSessionByHostHash(relatedHostHash);
            this.app.ioc.create(TaskChooserWindowController, [parent, { createTaskButton: !disableCreatingTasks, initialSearchText, session: session }]).then(win => {
                parent.openChildWindow(win);
                win.taskChooser.addEventListener<TaskChooserCloseEvent>("task-chooser-close", e => {
                    if (e.taskId) {
                        this.callViewMethod("taskPickerResult", e.taskId);
                        def.resolve();
                    }
                    else if (e.requestNewTask) {
                        let tasksPlugin: {
                            openNewTaskWindow: (session: Session, section: section.SectionService|false) => Q.Promise<string>;
                        } = this.app.getComponent("tasks-plugin");
                        this.app.mailClientApi.privmxRegistry.getSectionManager().then(sectionManager => {
                            let relatedSection = sectionManager.getSection(relatedSectionId) || false;
                            return tasksPlugin.openNewTaskWindow(session, relatedSection).then(taskId => {
                                this.callViewMethod("taskPickerResult", taskId);
                            })
                            .fail(() => {
                            })
                            .fin(() => {
                                def.resolve();
                            });
                        });
                    }
                    else {
                        def.resolve();
                    }
                });
            });
            return def.promise;
        })
        .fin(() => {
            this.isPickerOpen = false;
        });
    }
    
    onViewRequestFilePicker(currentFileId: string, relatedHostHash: string, relatedSectionId: string): void {
        if (this.isPickerOpen) {
            return;
        }
        let parsed = currentFileId ? filetree.nt.Entry.parseId(currentFileId) : null;
        this.isPickerOpen = true;
        let session = this.app.sessionManager.getSessionByHostHash(relatedHostHash);
        Q().then(() => {
            let notes2Plugin: {
                openFileChooser(
                    parentWindow: app.WindowParent,
                    session: Session,
                    section: section.SectionService,
                    context: string,
                    selectedPath?: string,
                    options?: {
                        singleSelection?: boolean;
                        hideLocalFiles?: boolean;
                        hideTrashedFiles?: boolean;
                    }
                ): Q.Promise<OpenableElement[]>;
            } = this.app.getComponent("notes2-plugin");
            let parent = this.getClosestNotDockedController();
            let def = Q.defer<void>();
            Q.all([
                session.mailClientApi.privmxRegistry.getSectionManager(),
                session.mailClientApi.privmxRegistry.getConv2Service(),
            ]).then(([sectionManager, conv2Service]) => {
                let sectionId = parsed && parsed.sectionId ? parsed.sectionId : relatedSectionId;
                let relatedSection = sectionManager.getSection(sectionId);
                if (!relatedSection) {
                    let c2s = conv2Service.collection.find(x => x.id == sectionId);
                    if (c2s) {
                        relatedSection = c2s.section;
                    }
                }
                if (!relatedSection) {
                    relatedSection = sectionManager.getMyPrivateSection();
                }
                notes2Plugin.openFileChooser(parent, session, relatedSection, "ced-picker", parsed ? parsed.path : undefined, { singleSelection: true, hideLocalFiles: true, hideTrashedFiles: true }).then(els => {
                    let el = els[0];
                    if (el instanceof section.OpenableSectionFile) {
                        const chr = ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER;
                        let fullSectionName = el.section.getFullSectionName(false, false, true);
                        let userFriendlyId = chr + "{" + ContentEditableEditorMetaData.escapeSectionName(fullSectionName) + ':' + ContentEditableEditorMetaData.escapeFilePath(el.path) + "}";
                        let did = el.handle.ref.did;
                        let elementId = el.getElementId();
                        this.callViewMethod("filePickerResult", JSON.stringify({
                            userFriendlyId: userFriendlyId,
                            did,
                            elementId,
                            icon: this.app.shellRegistry.resolveIcon(MimeType.resolve(el.path)),
                        }));
                    }
                })
                .fail(() => {
                })
                .fin(() => {
                    def.resolve();
                });
            });
            return def.promise;
        })
        .fin(() => {
            this.isPickerOpen = false;
        });
    }
    
    onViewOpenFileFromMetaData(metaDataStr: string): void {
        Q().then(() => {
            let metaData: {
                userFriendlyId: string;
                did: string;
                elementId: string;
                icon: string;
                sessionHost: string;
            } = JSON.parse(metaDataStr);
            if (!metaData) {
                return;
            }
            let session: Session = this.app.sessionManager.getLocalSession();
            if (metaData.sessionHost) {
                let sess = this.app.sessionManager.getSession(metaData.sessionHost);
                if (sess) {
                    session = sess;
                }
            }
            let parsed = filetree.nt.Entry.parseId(metaData.elementId);
            let section = session.sectionManager.getSection(parsed.sectionId);
            if (section) {
                return section.getFileTree().then(tree => {
                    let osf = tree.collection.find(x => x.ref.did == metaData.did);
                    return section.getFileOpenableElement(osf.path, true).then(osf => {
                        return this.app.shellRegistry.shellOpen({
                            element: osf,
                            action: ShellOpenAction.PREVIEW,
                            session: session
                        });
                    });
                });
            }
        })
    }


    getSectionIdFromContext(): ContextSection {
        if (this.app.viewContext) {
            let contextData = this.app.viewContext.split(":");


            if (contextData[0] == "section") {
                return <ContextSection> {
                    sectionId: contextData[1],
                    sectionType: "section"    
                }
            }
            else
            if (contextData[0] == "c2") {
                return <ContextSection> {
                    sectionId: this.app.viewContext,
                    sectionType: "conv2"
                }
            }
            else
            if (contextData[0] == "custom") {
                if (contextData[1] == "my") {
                    return <ContextSection> {
                        sectionId: null,
                        sectionType: "private"
                    }
                }
            }
            return null;
        }
    }

    onViewShareSection() {
        let context = this.getSectionIdFromContext();
        if (! context) {
            return;
        }

        let section: SectionService;
        
        let session = this.app.sessionManager.getLocalSession();
        if (context.sectionType == "private") {
            section = session.sectionManager.getMyPrivateSection();
        }
        else if (context.sectionType == "section") {
            section = session.sectionManager.getSection(context.sectionId);
        }
        else if (context.sectionType == "conv2") {
            let conv2 = session.conv2Service.collection.find(x => x.id == context.sectionId);

            if (! conv2) {
                return;
            }
            section = conv2.section;
        }

        if (! section) {
            return;
        }
        if (!section.hasAccess()) {
            this.alert(this.i18n("window.sectionEdit.shareNoAccess"));
            return;
        }
        Q().then(() => {
            return section.shareSection();
        })
        .then(bip39 => {
            this.app.ioc.create(SubIdWindowController, [this.parent, {
                mnemonic: bip39.mnemonic,
                host: session.host
            }])
            .then(win => {
                this.openChildWindow(win);
            });
        })
        .fail(this.errorCallback);
    }

    destroy(): void {
        this.app = null;
        this.ioc = null;
        this.parent = null;
        this.msgBoxInstance = null;
        this.errorLog = null;
        
        super.destroy();
    }
    
}

import {MsgBox} from "../../app/common/MsgBox";
import {BaseWindowManager} from "../../app/BaseWindowManager";
import { IOC } from "../../mail/IOC";
import { CustomizationData } from "../../app/common/customization/CustomizationData";
import { SpellCheckerController } from "../../app/electron/SpellCheckerController";
import { ElectronWindow } from "../../app/electron/window/ElectronWindow";
import { PerformanceLogger } from "../../app/common/PerformanceLogger";
import { FontMetricsController } from "../../app/common/fontMetrics/FontMetricsController";
import { PersonsController } from "../../component/persons/PersonsController";
import { MailConst } from "../../mail/MailConst";
import { Clipboard, ClipboardData, ClipboardElement } from "../../app/common/clipboard/Clipboard";
import { TaskChooserWindowController } from "../taskchooser/main";
import { TaskChooserCloseEvent } from "../../component/taskchooser/main";
import { section, filetree } from "../../mail";
import { OpenableElement, ShellOpenAction } from "../../app/common/shell/ShellTypes";
import { ContentEditableEditorMetaData } from "../../web-utils/ContentEditableEditorMetaData";
import { session } from "electron";
import { SectionService } from "../../mail/section/SectionService";
import { SubIdWindowController } from "../subid/SubIdWindowController";

