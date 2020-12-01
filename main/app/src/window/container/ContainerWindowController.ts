import {BaseWindowController} from "../base/BaseWindowController";
import {BaseAppWindowController} from "../base/BaseAppWindowController";
import {EmptyWindowController} from "../empty/EmptyWindowController";
import {MultiTaskStream} from "../../task/MultiTaskStream";
import {StatusBarMainController} from "../../component/statusbarmain/StatusBarMainController";
import {AutoRefreshController} from "../../component/autorefresh/AutoRefreshController";
import {DockedWindow} from "../../app/common/window/DockedWindow";
import {app} from "../../Types";
import {Lang} from "../../utils/Lang";
import {Model as ObservableModel} from "../../utils/Model";
import {LoginWindowController} from "../login/LoginWindowController";
import * as Q from "q";
import * as Types from "../../Types";
import {BaseWindowManager} from "../../app/BaseWindowManager";
import {Dependencies} from "../../utils/Decorators";
import { UpdateWindowController } from "../update/UpdateWindowController";
import { UpdateNotificationController } from "../../component/updatenotification/UpdateNotificationController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    showStatusBar: boolean;
    showAutoUpdateStatus: boolean;
    isElectronApp?: boolean;
}

export interface AppWindowData {
    id?: string;
    label: string;
    controllerClass: {new(parent: app.WindowParent): BaseWindowController};
    icon: string;
    visible?: boolean;
    count?: ObservableModel<number>;
    countFullyLoaded?: ObservableModel<boolean>;
    dirty?: ObservableModel<boolean>;
    action?: string;
    historyPath?: string;
    order?: number;
}

export interface AppWindow extends AppWindowData {
    id: string;
    index: number;
}

@Dependencies(["autorefresh", "statusbarmain"])
export class ContainerWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.container.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    mainTaskStream: MultiTaskStream;
    statusBarMain: StatusBarMainController;
    windows: {[name: string]: BaseWindowController};
    active: BaseWindowController;
    processedHistoryKeys: {[name: string]: boolean};
    autoUpdateStatus: AutoRefreshController<app.AutoUpdateStatusData>;
    appWindowsIndex: number;
    appWindows: AppWindow[];
    initApp: string;
    activeModel: ObservableModel<string>;
    activateLogoAction: string;
    loginMode: boolean;
    updateNotification: UpdateNotificationController;
    updateLastProgress: number;
    updateLastStatus: string;
    updateNotifId: number;
    updateVisible: boolean = false;
    updateHiddenByUser: boolean = false;
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.isMainAppWindow = true;
        let screenSize = this.app.getScreenResolution();
        this.openWindowOptions.maximized = this.app.isElectronApp() ? false : true;
        this.openWindowOptions.frame = false;

        let minWidth = 1024;
        let minHeight = 700;
        let windowWidth = screenSize.width * 0.8 < minWidth ? minWidth : screenSize.width * 0.8;
        let windowHeight = screenSize.height * 0.8 < minHeight ? minHeight : screenSize.height * 0.8;

        this.openWindowOptions.width = Math.floor(windowWidth);
        this.openWindowOptions.height = Math.floor(windowHeight);
        this.openWindowOptions.minHeight = minHeight;
        this.openWindowOptions.minWidth = minWidth;
        this.openWindowOptions.fullscreen = this.app.isElectronApp() ? false : true;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = "PrivMX";
        this.openWindowOptions.showLoadingScreen = true;
        this.mainTaskStream = new MultiTaskStream();
        this.mainTaskStream.addStream(this.taskStream);
        this.mainTaskStream.addStream(this.app.taskStream);
        if (this.app.isElectronApp()) {
            this.statusBarMain = this.addComponent("statusBarMain", this.componentFactory.createComponent("statusbarmain", [this, this.mainTaskStream]));
            this.updateNotification = this.addComponent("updatenotifications", this.componentFactory.createComponent("updatenotification", [this]));
        }
        this.windows = {};
        this.processedHistoryKeys = {};
        this.activeModel = new ObservableModel("");
        this.appWindowsIndex = 2;
        this.appWindows = [];
        this.loginMode = true;
    }
    
    init() {
        return this.loadWindowState();
    }
    
    prepareApps() {
        let newAppWindows: AppWindow[] = [];
        //Ordering appWindows based on CommonApplication settings
        this.app.getApps().forEach(appId => {
            let index = Lang.indexOf(this.appWindows, app => app != null && app.id == appId);
            if (index != -1) {
                newAppWindows.push(this.appWindows[index]);
                this.appWindows[index] = null;
            }
        });
        //Adding appWindows which are not at CommonApplication list
        this.appWindows.forEach(app => {
            if (app != null) {
                newAppWindows.push(app);
            }
        });
        this.appWindows = newAppWindows;
        let initApp = this.app.getInitApp();
        if (initApp) {
            this.initApp = this.hasApp(initApp) ? initApp : "";
        }
        let logoApp = this.app.getLogoApp();
        if (logoApp) {
            this.activateLogoAction = this.hasApp(logoApp) ? logoApp : "";
        }
    }
    
    onUpdateAvailable(event?: Types.event.UpdateStatusChangeEvent): void {
        if (this.app.isElectronApp() && event && this.updateVisible) {
            if (event.status == "downloading") {
                this.updateNotification.onUpdateProgress(this.updateNotifId, event.status, event.downloaded, event.total);
            }
            else
            if (event.status != "new-version-info") {
                this.updateNotification.setStatus(this.updateNotifId, event.status);
            }
            return;
        }

        if (this.app.isElectronApp()) {
            if ((<any>this.app).updater) {
                if ((<any>this.app).updater.isInQuarantine()) {
                    this.alert(this.i18n("window.login.alert.quarantine"));
                }
                else {
                    let updatesInfo = (<any>this.app).updater.getUpdatesInfo();
                    if (! updatesInfo) {
                        return;
                    }
                    if (! this.updateVisible &&  ! this.updateHiddenByUser) {
                        this.updateNotifId = this.updateNotification.createNotification({autoHide: false, updatesInfo: updatesInfo, click: this.onUpdateClick.bind(this)});
                        this.updateVisible = true;
                    }
                }
            }
        }
    }
    
    onUpdateClick(id: number, action: string): void {
        setTimeout(() => {
            if (action == "download-updates") {
                if (this.app.isElectronApp()) {
                    if ((<any>this.app).updater) {
                        this.updateLastStatus = "checking";
                        (<any>this.app).updater.downloadUpdate((status: app.UpdaterProgressStatus, downloaded?: number, total?: number) => {
                            this.updateNotification.onUpdateProgress(id, status, downloaded, total);
                        })
                        .then(() => {
                            this.updateNotification.setReadyToInstall(id);
                            this.updateNotification.showNotification(id);
                        })
                        .fail((e: any) => console.log(e));
                    }
                }
            }
            else
            if (action == "install-updates") {
                if (this.app.isElectronApp() && (<any>this.app).updater) {
                    Q().then(() => {
                        return this.app.isLogged() ? this.app.manager.killAppWindows() : Q.resolve<void>();
                    })
                    .then(() => {
                        if (this.app.manager.isWindowsTreeDirty()) {
                            return Q.reject();
                        } 
                        else {
                            (<any>this.app).updater.startUpdate();
                        }
                    })
                    .fail(() => {
                        this.updateNotification.setReadyToInstall(id);
                    })
                }
                
            }
            else
            if (action == "hide") {
                this.updateHiddenByUser = true;
                this.updateNotification.hideNotification(id);
                this.updateVisible = false;
            }
        }, 100);
        
    }
        
    hasApp(appId: string) {
        return Lang.containsFunc(this.appWindows, app => app.id == appId);
    }
    
    getModel(): Model {
        return {
            showStatusBar: this.statusBarMain != null,
            showAutoUpdateStatus: this.autoUpdateStatus != null,
            isElectronApp: this.app.isElectronApp()
        };
    }
    
    closeLoginWindow() {
        this.removeWindow("login");
    }
    
    switchToAppMode() {
        this.loginMode = false;
        this.selectWindowToLoad();
    }
    
    selectWindowToLoad() {
        if (this.app.isElectronApp() && (<any>this.app).state.startedInUpdateMode) {
            this.loginMode = false;
            this.switchTo("update", 0, UpdateWindowController);
        }
        else if (this.loginMode) {
            this.switchTo("login", 2, LoginWindowController);
        }
        else {
            if (this.initApp && this.hasApp(this.initApp)) {
                this.redirectToAppWindow(this.initApp, null, true);
            }
            else {
                this.switchTo("empty", 1, EmptyWindowController);
            }
        }
    }
    
    onViewLoad(): void {
        this.selectWindowToLoad();
        if (this.app.isElectronApp()) {
            this.app.addEventListener<Types.event.UpdateStatusChangeEvent>("update-status-change", this.onUpdateAvailable.bind(this), this.manager.uid, "normal");
            this.onUpdateAvailable();
        }
    }
    
    onDockedLoad(bwc: BaseWindowController): void {
        this.callViewMethod("hideLoading");
        this.callViewMethod("focusIframe", (<DockedWindow>bwc.nwin).id);
    }
    
    registerAppWindow(appWindow: AppWindowData) {
        let a = <AppWindow>appWindow;
        a.index = ++this.appWindowsIndex;
        if (!a.id) {
            a.id = "app-" + a.index;
        }
        if (!a.historyPath) {
            a.historyPath = "/" + a.id;
        }
        this.appWindows.push(a);
        return a;
    }
    
    activateLogo() {
        return this.redirectToAppWindow(this.activateLogoAction);
    }

    redirectToAppWindow(id: string, state?: string, replace?: boolean): void {
        let appWindow = Lang.find(this.appWindows, x => x.id == id);
        if (appWindow) {
            this.app.setContainerWindowHistoryEntry({
                pathname: appWindow.historyPath,
                state: state
            }, replace);
        }
    }
    
    onHistoryChange(historyEntry: app.HistoryEntry): void {
        let appWindow = Lang.find(this.appWindows, x => x.historyPath == historyEntry.pathname);
        if (!appWindow) {
            return;
        }
        this.app.mcaFactory.eventDispatcher.dispatchEvent<Types.event.WindowFocusEvent>({type: "focusChanged", target: this, windowId:appWindow.id});
        this.switchTo(appWindow.id, appWindow.index, appWindow.controllerClass).then(active => {
            if (!active) {
                return;
            }
            let processed = historyEntry.key in this.processedHistoryKeys;
            this.processedHistoryKeys[historyEntry.key] = true;
            active.whenReady().then(() => {
                if (active instanceof BaseAppWindowController) {
                    active.onActivate();
                    active.applyHistoryState(processed, historyEntry.state);
                }
            });
        });
    }
    
    switchTo(id: string, index: number, controllerClass: {new(parent: app.WindowParent): BaseWindowController}): Q.Promise<BaseWindowController> {
        return Q().then(() => {
            if (this.windows[id] != null) {
                return this.windows[id];
            }
            if (this.networkIsDown()) {
                this.showOfflineError();
                this.app.goBack();
                return null;
            }
            return this.app.ioc.create(controllerClass, [this]).then(win => {
                this.windows[id] = this.registerInstance(win);
                this.mainTaskStream.addStream(win.taskStream);
                win.openDocked(this.nwin, index);
                let docked = <DockedWindow>win.nwin;
                this.callViewMethod("openIframe", docked.id, docked.load);
                return win;
            });
        })
        .then(win => {
            if (win == null) {
                return null;
            }
            if (this.active != win) {
                if (this.active != null && typeof(this.active.setBackgroundModeOn) == "function") {
                    this.active.setBackgroundModeOn();
                }
                if (this.windows[id] != null && typeof(this.windows[id].setBackgroundModeOff) == "function") {
                    this.windows[id].setBackgroundModeOff();
                }
                this.active = win;
                this.activeModel.setWithCheck(id);
                this.active.onNwinFocus();
            }
            let docked = <DockedWindow>this.active.nwin;
            this.callViewMethod("showIframe", index, docked.load);
            return this.active;
        })
        .then(active => {
            this.dispatchEvent<Types.event.ActiveAppWindowChangedEvent>({
                type: "active-app-window-changed",
                appWindowId: id,
            });
            return active;
        })
        .fail(e => {
            this.onError(e);
            return Q.reject<BaseWindowController>(e);
        });
    }
    
    removeWindow(id: string) {
        if (!this.windows || this.windows[id] == null) {
            return;
        }
        let docked = <DockedWindow>this.windows[id].nwin;
        this.mainTaskStream.removeStream(this.windows[id].taskStream);
        if (docked) {
            this.callViewMethod("destroyIframe", docked.id);
        }
        this.windows[id].destroy();
        delete this.windows[id];
    }
    
    onNwinClose(): void {
        if (this.app.isQuitting()) {
            this.close();
        }
        else {
            this.hide();
        }
    }
    
    hide() {
        let promises: Q.Promise<void>[] = [];
        promises.push(this.closeAllChildWindows());
        for (let id in this.windows) {
            promises.push(this.windows[id].closeAllChildWindows());
        }
        return Q.all(promises)
        .then(() => {
            this.nwin.hide();
            this.app.onContainerHide();
            this.app.dispatchEvent({type: "focusLost"});
        });
    }
    
    beforeClose(_force?: boolean): Q.IWhenable<void> {
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
        Q().then(() => {
            return this.saveWindowState();
        })
        .then(() => {
            this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
        })
    }
    
    clean(): Q.Promise<void> {
        let promises: Q.Promise<void>[] = [];
        promises.push(this.closeAllChildWindows());
        for (let id in this.windows) {
            promises.push(this.windows[id].closeAllChildWindows());
        }
        return Q.all(promises)
        .then(() => {
            if (this.windows) {
                for (let id in this.windows) {
                    this.removeWindow(id);
                }
            }
            this.windows = {};
            this.appWindows = [];
            this.active = null;
            this.activeModel.setWithCheck("");
            this.loginMode = true;
            this.selectWindowToLoad();
        });
    }

    cleanView(): void {
        this.callViewMethod("cleanWindowsContainer");
    }

    showInitializing(): void {
        this.callViewMethod("showInitializing");
    }

    hideInitializing(): void {
        this.callViewMethod("hideInitializing");
    }
       
}
