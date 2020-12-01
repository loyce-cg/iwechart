import {WindowManager} from "./window/WindowManager";
import {ElectronWindow} from "./window/ElectronWindow";
import {CommonApplication} from "../common/CommonApplication";
import {LocaleService} from "../../mail/LocaleService";
import {HddStorage} from "../../utils/HddStorage";
import {DownloadWindowController} from "../../window/download/DownloadWindowController";
import {HelperWindowController} from "../../window/helper/HelperWindowController";
import {PlayerHelperWindowController} from "../../window/playerhelper/PlayerHelperWindowController";
import {File} from "./File";
import {Version} from "../../utils/Version";
import electron = require("electron");
import os = require("os");
import path = require("path");
import events = require("events");
import {Model} from "../../utils/Model";
import {app, event, mail, utils, ipc} from "../../Types";
import {AssetsManager} from "../common/AssetsManager";
import {Lang, Formatter} from "../../utils";
import {InitializerOptions} from "../browser/Initializer";
import * as nodeFs from "fs";
import * as fsExtra from "fs-extra";
import * as RootLogger from "simplito-logger";
import {Starter, GlobalShortcutConfigItem, ProfilesManager} from "./starter/Starter";
import {ContainerWindowController} from "../../window/container/ContainerWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {SinkIndexEntry} from "../../mail/SinkIndexEntry";
import fs = require("fs");
import {MailClientApi} from "../../mail/MailClientApi";
import ObjectMapModule = require("./ObjectMap");
import {i18n} from "../../i18n";
import { ContextMenuHelper } from "./ContextMenuHelper";
import { NotificationsService } from "./notifications/NotificationsService";
import { ShellOpenOptions, ShellOpenAction, OpenableElement, SimpleOpenableElement, OpenableFile } from "../common/shell/ShellTypes";
import { TrayMenu } from "./traymenu/TrayMenu";
import { OpenExternalWindowController, Result } from "../../window/openexternal/OpenExternalWindowController";
import { ImageEditorWindowController, ScreenshotResult } from "../../window/imageeditor/ImageEditorWindowController";
import { MailResourceLoader, UrlResourceLoader } from "./ResourceLoaderCompat";
import { ClipboardData, Clipboard as PrivMxClipboard, ClipboardElement } from "../common/clipboard/Clipboard";
import { BaseWindowManager } from "../BaseWindowManager";
import { BaseWindowController } from "../../window/base/BaseWindowController";
import { PlayerManager } from "../common/musicPlayer/PlayerManager";
import { Updater, UpdaterState, ConfigData } from "./updater/Updater";
import { PollingItem } from "../../mail/SinkIndex";
import { CustomizationData } from "../common/customization/CustomizationData";
import { SqlStorage } from "../../utils/SqlStorage";
import {DiskUtils} from "./DiskUtils";
import { ElectronScreenCover } from "./ElectronScreenCover";
import { UserPreferences, PasteAsFileAction, SystemClipboardIntegration } from "../../mail/UserPreferences";
import { Window as AppWindow } from "../common/window/Window";
import { ConnectionStatusCheckerElectron } from "../common/ConnectionStatusCheckerElectron";
import { ConnectionStatusChecker } from "../common/ConnectionStatusChecker";
import { PerformanceLogger, PerformanceLoggerConfig } from "../common/PerformanceLogger";
import { ExternalFilesService } from "./ExternalFilesService";
import { MsgBoxResult } from "../../window/msgbox/MsgBoxWindowController";
import { ProfilesManagerIPC } from "./profiles/ProfilesManagerIPC";
import { LicenseVendorsWindowController } from "../../window/licensevendors/LicenseVendorsWindowController";
import * as Types from "../../Types";
import { ErrorWindowController } from "../../window/error/main";
import { ErrorReporter } from "../common/ErrorReporter";
import * as mime from "mime-types";
import { MindmapEditorWindowController } from "../../window/mindmapeditor/MindmapEditorWindowController";
import { MacKeyboardShortcuts } from "./keyboardShortcuts/MacKeyboardShortcuts";
import { LinuxKeyboardShortcuts } from "./keyboardShortcuts/LinuxKeyboardShortcuts";
import { WindowsKeyboardShortcuts } from "./keyboardShortcuts/WindowsKeyboardShortcuts";
import { MailConst } from "../../mail";
import { MimeType } from "../../mail/filetree";
import { Session } from "../../mail/session/SessionManager";
import { WindowUrl } from "./WindowUrl";

let Logger = RootLogger.get("privfs-mail-client.app.electron.ElectronApplication");
let ipc = electron.ipcMain;

export interface ElectronInitializerOptions extends InitializerOptions {
    app?: ElectronApplication | any,
    init?: any
}

let optionsSource = <ElectronInitializerOptions>{
    options: {
        assets: {
            CUSTOM_LOGO_127X112: "",
            CUSTOM_LOGO_127X112_WH: "",
            CUSTOM_LOGO_87X22: "",
            CUSTOM_LOGO_87X22_WH: "",
            CUSTOM_LOGO_CUSTOM_FORM: ""
        },
        plugins: []
    }
};

export interface LastLoginInfo {
    username: string;
    host: string;
    lastTime: number;
    key: string;
}

export interface ProcessVersionsElectron extends NodeJS.ProcessVersions {
    electron: string;
    chrome: string;
}

export interface ProfileEx {
    name: string;
    absolutePath: string;
    storageAbsolutePath: string;
    tmpAbsolutePath: string;
    getLanguage(): string;
    setLanguage(lang: string): void;
    isLicenceAccepted(): boolean;
    getCcApiEndpoint(): string;
    setLicenceAccepted(): void;
    isLoginInfoVisible(): boolean;
    setLoginInfoHidden(): void;
    isAutostartEnabled(): boolean;
    setAutostartEnabled(enabled: boolean): void;
}

export interface ChannelSetting {
    id: string;
    muted: boolean;
}

export class ElectronApplication extends CommonApplication {
    static readonly RELATIVE_PLUGINS_DIRECTORY: string = "electron-plugins";
    static readonly APP_MAX_NOTIFICATION_TITLE_LEN: number = 40;
    static readonly APP_NOTIFICATION_ELIPSIS: string = " ...";
    static readonly UI_OPEN_FILE_DIALOG_PATH_KEY: string = "ui.openFileDialogPath";
    static readonly HAS_SOMETHING_NEW_CHECKING: boolean = false;

    screenCover: ElectronScreenCover;
    connectionStatusCheckerElectron: ConnectionStatusCheckerElectron;
    autoUpdateStatusModel: app.AutoUpdateStatusModel;
    windowManager: WindowManager;
    version: utils.ProjectInfo;
    autoUpdateIntervalID: NodeJS.Timer;
    assetsManager: AssetsManager;
    url: string;
    domainFromLogin: string;
    notificationsEntries: SinkIndexEntry[] = [];
    notificationsLastUpdate: number;
    notificationsSomethingNew: boolean;
    lastLoginInfo: LastLoginInfo;
    sessionNotificationKey: string;
    logoutSaveLoginInfoPromise: Q.Promise<void>;
    changeIndicatorOnNewCount: boolean;
    hasInternetConnection: boolean;
    hasServerConnection:boolean = true;
    notifsLoggedIn: boolean = false;
    loggedOutConnectionCheckerTimeout: number = null;
    
    lastNotifTimeoutHandle: any = null;
    lastNotifShowedTime: number = 0;
    userLoginWithHost: string;
    userAvatar: electron.NativeImage;
    userRights: string[];
    state: {
        startedInHiddenMode: boolean,
        startedInUpdateMode: boolean,
        updateAsSudo: boolean;
        startedInRevertMode: boolean,
        autoLoginAfterStart: boolean,
        autoLoginAttemptPerformed: boolean,
        sthNewAtLoginFail: boolean,
        signingIn: boolean,
        appFocused?: boolean
    }
    
    trayMenu: TrayMenu;
    notificationsService: NotificationsService;
    additionalMenuItems: Electron.MenuItemConstructorOptions[];
    externalOpenedFilesSyncIntervals: {mtime: Date, intervalId: NodeJS.Timer}[];
    defaultHost: string;
    updater: Updater;
    internetMonitorTimer: any;
    hasSearchFocus: boolean = false;
    updaterStatus: UpdaterState;
    notificationsReferences: Electron.Notification[] = [];
    forceRefreshLanguageOnLogout: boolean = false;
    externalFilesService: ExternalFilesService;
    hasNetworkConnectionDeferred: Q.Deferred<boolean> = null;
    processingLogout: boolean = false;
    profilesIPC: ProfilesManagerIPC;
    registerTokenInfo: utils.RegisterTokenInfo;
    errorReporter: ErrorReporter;
    pastingInProgress: boolean = false;
    askingSystemClipboardIntegrationPromise: Q.Promise<boolean> = null;
    askingSystemClipboardIntegrationWindow: AppWindow = null;
    connectionRestoredDeferred: Q.Deferred<void> = null;
    
    static create(starter: Starter, profile: ProfileEx, profilesManager: ProfilesManager): ElectronApplication {
        let version = Version.get();
        let electronUserAgent = "privfs-mail-client-electron-" + os.platform() + "@" + version.str;
        privfs.core.PrivFsRpcManager.setAgent(electronUserAgent);
        privfs.core.PrivFsRpcManager.setGatewayProperties({
            appVersion: electronUserAgent,
            sysVersion: "electron-" + os.platform() + "@" + (<ProcessVersionsElectron>process.versions).electron,
            deviceId: profilesManager.deviceId,
            osName: os.hostname()
        });
        privfs.core.PrivFsRpcManager.setMaxMessagesNumber(10);
        let electronPath = electron.app.getAppPath();
        let execPath = electron.app.getPath("exe");
        let appDir = "";
        let resourcesPath = "";
        let pluginsDir = "";
        let isRunningInDevMode = execPath.replace(/\\/g, "/").split("/").indexOf("node_modules") > -1;
        
        // Setting up PerformanceLogger
        PerformanceLogger.configure({
            enabled: starter.getIsPerformanceLoggerEnabled(),
            scheduledOpDelay: starter.getPerformanceLoggerScheduledOpDelay(),
            captureKeyPatterns: starter.getPerformanceLoggerCaptureKeyPatterns(),
            outputFileName: starter.getPerformanceLoggerOutputFilename(),
        });
        
        //setting up loglevel
        let forcedLogLevel = starter.getForcedLogLevel();
        if (forcedLogLevel) {
            RootLogger.setLevel(forcedLogLevel, true);
            Logger.setLevel(forcedLogLevel, true);
            console.log("LogLevel set (forced): ", forcedLogLevel.name);
        }
        if (! isRunningInDevMode && ! forcedLogLevel) {
            RootLogger.setLevel(Logger.ERROR, true);
            Logger.setLevel(Logger.ERROR, true);
        }

        
        Logger.debug("execPath: ", execPath);
        Logger.debug("Electron path: ", electronPath);
        
        if (isRunningInDevMode) {
            Logger.debug("Starting from dev env..");
            let execParts = execPath.replace(/\\/g, "/").split("/");
            
            if (process.platform == "darwin") {
                execParts.splice(-7);
            } else {
                execParts.splice(-4);
            }
            
            appDir = execParts.join("/");
            resourcesPath = path.resolve(appDir, "electron-dist");
            if (!fs.existsSync(resourcesPath)) {
                resourcesPath = path.resolve(appDir, "dist");
            }
            pluginsDir = path.resolve(appDir, ElectronApplication.RELATIVE_PLUGINS_DIRECTORY) + "/";
        }
        else {
            Logger.debug("Starting from prepared package...");
            let execParts = execPath.replace(/\\/g, "/").split("/");
            execParts.splice(-1);
            appDir = execParts.join("/");
            
            resourcesPath = electronPath;
            pluginsDir = path.resolve(resourcesPath, ElectronApplication.RELATIVE_PLUGINS_DIRECTORY) + "/";
            
        }
        Logger.debug("AppDir: ", appDir);
        // this.pluginsDir = path.resolve(this.appDir, ElectronApplication.RELATIVE_PLUGINS_DIRECTORY) + "/";
        let assetsManager = new AssetsManager(
            "file://" + path.resolve(resourcesPath, "dist") + "/",
            "file://" + pluginsDir,
            {
                getPluginConfig: (name: string): app.PluginConfig =>  {
                    return Lang.find(optionsSource.options.plugins, x => x.name == name);
                }
            }
        );
        let file = path.resolve(profile.absolutePath, Starter.CUSTOMIZATION_FILE);
        let customizedTheme: CustomizationData;
        if (fs.existsSync(file)) {
            customizedTheme = JSON.parse(fs.readFileSync(file).toString());
            if (customizedTheme) {
                if (customizedTheme.logoHeader) {
                    optionsSource.options.assets.CUSTOM_LOGO_87X22 = customizedTheme.logoHeader;
                }
                if (customizedTheme.logoHeaderWh) {
                    optionsSource.options.assets.CUSTOM_LOGO_87X22_WH = customizedTheme.logoHeaderWh;
                }
                if (customizedTheme.logoLoginScreen) {
                    optionsSource.options.assets.CUSTOM_LOGO_127X112 = customizedTheme.logoLoginScreen;
                }
            }
        }
        assetsManager.init(optionsSource.options.assets);
        let mailResourceLoader = new MailResourceLoader(new UrlResourceLoader(assetsManager));
        return new ElectronApplication(
            electronPath,
            execPath,
            appDir,
            resourcesPath,
            pluginsDir,
            isRunningInDevMode,
            starter,
            profile,
            mailResourceLoader,
            assetsManager,
            customizedTheme,
            profilesManager
        );
    }
    
    constructor(
        public electronPath: string,
        public execPath: string,
        public appDir: string,
        public resourcesPath: string,
        public pluginsDir: string,
        public inDevMode: boolean,
        public starter: Starter,
        public profile: ProfileEx,
        mailResourceLoader: mail.MailResourceLoader,
        assetsManager: AssetsManager,
        customizedTheme: CustomizationData,
        public profilesManager: ProfilesManager

    ) {
        super(electron.ipcMain, new SqlStorage(profile.storageAbsolutePath), LocaleService.create(i18n, profile.getLanguage()), mailResourceLoader, assetsManager);
        this.customizedTheme = customizedTheme;
        
        this.screenCover = new ElectronScreenCover({
            timeout: 180000,
            timeoutCheck: 180000,
            showCover: this.showScreenCover.bind(this),
            hideCover: this.hideScreenCover.bind(this),
        });
        this.manager = new BaseWindowManager(null, null);
        Logger.debug("Electron version", (<ProcessVersionsElectron>process.versions).electron);
        this.externalOpenedFilesSyncIntervals = [];
        this.additionalMenuItems = [];
        this.options.forcedPublishPresenceType.value = "all";
        this.changeIndicatorOnNewCount = false;
        this.version = Version.get();
        let startedInHiddenMode = process.argv && process.argv.indexOf("--hidden") != -1;
        let startedInUpdateMode = process.argv && process.argv.indexOf("--update") != -1;
        let startedInRevertMode = process.argv && process.argv.indexOf("--revert") != -1;
        let updateAsSudo = process.argv && process.argv.indexOf("--sudo") != -1;
        this.state = {
            startedInHiddenMode: startedInHiddenMode,
            startedInUpdateMode: startedInUpdateMode,
            updateAsSudo: updateAsSudo,
            startedInRevertMode: startedInRevertMode,
            autoLoginAfterStart: startedInHiddenMode && !startedInUpdateMode,
            autoLoginAttemptPerformed: false,
            sthNewAtLoginFail: null,
            signingIn: false
        }
        this.hiddenMode = startedInHiddenMode;
        this.localeService.setLang(this.profile.getLanguage());
        
        this.windowManager = new WindowManager(
            this.onWindowClose.bind(this),
            this.onChangeFocus.bind(this),
            this.onMaximizeToggle.bind(this),
            this.onGetMenu.bind(this),
            this,
            this.assetsManager,
            this
        );
        this.errorReporter = new ErrorReporter(this);
        this.errorLogFile = path.resolve(profile.absolutePath, "logs/error.log");
        this.updater = new Updater(this, path.resolve(os.homedir(), ".privmx"), this.profile.absolutePath);
        if (process.platform == "darwin") {
            this.keyboardShortcuts = new MacKeyboardShortcuts(this);
        }
        else if (process.platform == "linux") {
            this.keyboardShortcuts = new LinuxKeyboardShortcuts(this);
        }
        else if (process.platform == "win32") {
            this.keyboardShortcuts = new WindowsKeyboardShortcuts(this);
        }
        if (this.keyboardShortcuts) {
            this.keyboardShortcuts.on("global.showHide", this.onShowHideClick.bind(this));
            this.keyboardShortcuts.on("global.newTextNote", this.onNewTextNoteClick.bind(this));
            this.keyboardShortcuts.on("global.newMindmap", this.onNewMindmapClick.bind(this));
            this.keyboardShortcuts.on("global.newTask", this.onNewTaskClick.bind(this));
            this.keyboardShortcuts.on("global.takeScreenshot", this.onTakeScreenshotClick.bind(this));
            this.keyboardShortcuts.on("global.recentFiles", this.onRecentFilesClick.bind(this));
        }
        ipc.on("docked", this.windowManager.onDocked.bind(this.windowManager));
        Q().then(() => {
            return this.hasNetworkConnection()
        })
        .then(hasConnection => {
            this.hasInternetConnection = hasConnection;
            (<SqlStorage>this.storage).initBaseLevel().then(() => {
                if (this.state.startedInUpdateMode || this.state.startedInRevertMode) {
                    // this.startAsUpdate();
                    this.startAsUpdate();
                } else {
                    this.startAsNormal();
                }
            });
            this.startLoggedOutConnectionChecker();
        });
        
        this.profilesIPC = new ProfilesManagerIPC(this);
    }
    
    startAsUpdate() {
        Updater.onAfterUpdate = () => {
            setTimeout(() => {
                this.updater.restartAfterUpdate();
            }, 5000);
        }
        
        super.startUpdateMode();
        if (this.state.startedInUpdateMode) {
            this.updater.installUpdate();
        }
        else
        if (this.state.startedInRevertMode) {
            if (this.updater.isAppStartedFromItsInstallPath()) {
                // if app was started with --revert and it was an app from install dir, then
                // it will close itself and run an reverter separate process to avoid files write collisions. After that reverted app will start automatically
                this.updater.startRevert();
            }
            else {
                // if (from the other hand) app was started with --revert but from old-version dir - then it will start revert process automatically without starting
                // yet another instance
                this.updater.performRevert();
            }
        }
    }
    
    switchFromUpdateToNormalMode(): void {
        this.state.startedInUpdateMode = false;
        let containerWindow = <ContainerWindowController>this.windows.container;
        containerWindow.loginMode = true;
        this.startAsNormal(true);
        containerWindow.selectWindowToLoad();
    }
    
    startAsNormal(afterUpdate?: boolean) {
        if (this.updater.isAppStartedFromExtractUpdatePath()) {
            this.app.exitApp();
        }
        
        this.domainFromLogin = "";
        this.ioc.create(HelperWindowController, [this]).then(helperWindow => {
            this.windows.helper = this.registerInstance(helperWindow);
            this.windows.helper.open();
        });
        // todo: do przywrocenia i poprawy - wylaczone tylko do testów remote sekcji
        // this.starter.bindErrorEvent("USER_DOESNT_EXISTS", "ElectronApplication", () => {
        //     this.logoutOnError();
        // });

        this.starter.bindErrorEvent("USER_BLOCKED", "ElectronApplication", () => {
            this.logoutOnError("USER_BLOCKED");
        });

        this.starter.bindErrorEvent("DEVICE_BLOCKED", "ElectronApplication", () => {
            this.logoutOnError("DEVICE_BLOCKED");
        });


        this.unclosableWindowsName.push("helper");
        this.unclosableWindowsName.push("playerHelper");
        
        this.notificationsLastUpdate = 0;
        // implementacja notificationsService
        this.notificationsService = new NotificationsService(this, this.app);

        Q().then(() => {
            return this.defaultSettings.get("lastLogin");
        })
        .then(lastLoginInfo => {
            this.lastLoginInfo = lastLoginInfo;
            if (this.lastLoginInfo) {
                this.sessionNotificationKey = this.lastLoginInfo.key;
            }
            this.checkUserNotifications();
        })
        .fail(e => {
            Logger.error("Error during getting lastLoginInfo", e);
        });
        this.trayMenu = new TrayMenu(this);
        this.trayMenu.globalOnShowWindow = () => {
            this.onTryMenuShowClick();
        };
        
        this.keyboardShortcuts.readStoredShortcuts();
        this.keyboardShortcuts.bindGlobalShortcuts();
        this.buildBaseWindowMenu();

        this.updater.checkForUpdate().catch((e) => {});
        this.monitorForUpdates();
        
        
        this.loadPlugins();
        this.start(afterUpdate);
    }

    logoutOnError(reason?: string): Q.Promise<void> {
        return Q().then(() => {
            if (this.processingLogout || !this.isLogged()) {
                return;
            }
            this.processingLogout = true;
            if (this.mailClientApi) {
                return this.mailClientApi.privmxRegistry.getGateway()
                .then(gateway => {
                    gateway.rpc = null;
                })
            }
        })
        .fin(() => {
            this.beforeLogout();
            this.logout();
            this.afterLogout();
            this.processingLogout = false;
        });

    }
    
    addToObjectMap(obj: any): number {
        return ObjectMapModule.add(obj);
    }
    
    getFromObjectMap<T = any>(id: number): T {
        return ObjectMapModule.get(id);
    }
    
    getMailClientViewHelperModel(): app.MailClientViewHelperModel {
        return {
            localeService: {
                instance: null,
                currentLang: this.localeService.currentLang,
                serializedTexts: this.localeService.getSerializedTexts(this.localeService.currentLang),
                availableLanguages: JSON.stringify(LocaleService.AVAILABLE_LANGS),
            },
            assetsManager: {
                instance: null,
                assets: this.assetsManager.assets,
                rootUrl: this.assetsManager.rootUrl,
                pluginRootUrl: this.assetsManager.pluginRootUrl,
                pluginConfigProvider: this.getPluginConfigData()
            },
            version: this.getVersion().str,
            isDemo: this.isDemo(),
            defaultHost: this.getDefaultHost(),
            isContextMenuBlocked: this.isContextMenuBlocked(),
            openLinksByController: this.openLinksByController(),
            uiEventsListener: null,
        };
    }
    
    start(afterUpdate?: boolean): void {
            this.defaultSettings.get("ui.windowTitleBarButtonsPosition").then(position => {
                let isMac = process.platform == "darwin";
                if (position == "left" || position == "right") {
                    this.windowManager.setWindowsTitleBarButtonsPosition(position);
                }
                else {
                    this.windowManager.setWindowsTitleBarButtonsPosition(isMac ? "left" : "right");
                }
            })
            .fail(e => {
                Logger.error("Error during getting windowTitleBarButtonsPosition", e);
            })
            .fin(() => {
                // if (! this.profile.isLicenceAccepted()) {
                //     this.openLicenceWindow(true, afterUpdate);
                // }
                // else {
                    this.refreshTrayMenu();
                    super.start(afterUpdate);
                // }
            });
    }
    
    getNodeModulesDir(): string {
        return path.resolve(this.appDir, "node_modules");
    }
    
    checkUserNotifications() {
        if (ElectronApplication.HAS_SOMETHING_NEW_CHECKING == false || this.mailClientApi || !this.lastLoginInfo || !this.lastLoginInfo.key) {
            return;
        }
        Q().then(() => {
            return this.mcaFactory.getGateway(this.lastLoginInfo.host);
        })
        .then(srp => {
            return srp.request<{sthNew: boolean}>("hasUserSthNew", {
                username: this.lastLoginInfo.username,
                lastTime: this.lastLoginInfo.lastTime.toString(),
                key: this.lastLoginInfo.key
            });
        })
        .then(result => {
            if (this.state.signingIn || (this.state.autoLoginAfterStart && !this.state.autoLoginAttemptPerformed)) {
                this.state.sthNewAtLoginFail = result.sthNew;
            }
            else {
                this.updateNotifications(result.sthNew);
            }
        })
        .fail(e => {
            Logger.debug("Error during hasUserSthNew", e);
        });
        setTimeout(this.checkUserNotifications.bind(this), 10 * 1000);
    }

    isQuitting(): boolean {
        return this.starter.quitting;
    }
    
    onChangeFocus(focused: boolean): void {
        let w = this.manager.getFocusedWindow();
        if (w && w.isMainWindow()) {
            this.hiddenMode = w.controller.nwin && w.controller.nwin ? w.controller.nwin.hidden : false;
        
            if (focused && !this.state.appFocused) {
                this.app.dispatchEvent({type: "focusChanged", windowId: "main-window"});
            }
        }
        else if (focused) {
            this.app.dispatchEvent({type: "focusChanged", windowId: "focus-restored"});
        }
        
        if (!focused) {
            this.app.dispatchEvent({type: "focusLost"});
            if (this.trayMenu) {
                this.trayMenu.updateMainAppLastFocusLostTime();
            }
        }
        
        let oldState = this.state.appFocused;
        this.state.appFocused = focused;
        if (this.trayMenu && oldState != focused) {
            setTimeout(() => {
                this.refreshTrayMenu();
            }, 1);
        }
        let registerLocal = w && w.isMainWindow() && focused && w.controller && w.controller.nwin && !w.controller.nwin.isMinimized();
        if (registerLocal) {
            this.hasSearchFocus = true;
        }
    }
    
    onPrintCancelled(): void {
        if (this.onCancelPrintCallback) {
            let cb = this.onCancelPrintCallback;
            this.onCancelPrintCallback = null;
            cb();
        }
    }
    
    isRunningInDevMode():boolean {
        return this.inDevMode;
    }
    
    addIpcListener(channel: string, listener: ipc.IpcMainListener): void {
        electron.ipcMain.addListener(channel, listener);
    }
    
    removeAllIpcListeners(channel: string): void {
        electron.ipcMain.removeAllListeners(channel);
    }
    
    loadPlugins() {
        let pluginsDir2 = path.resolve(this.pluginsDir,"plugins");
        nodeFs.readdirSync(pluginsDir2).forEach(dirName => {
            let dirPath = path.resolve(pluginsDir2, dirName);
            if (dirName == "." || dirName == ".." || dirName == ".DS_Store" || !nodeFs.statSync(dirPath).isDirectory()) {
                return;
            }
            let clientDirPath = path.resolve(dirPath, "client");
            let buildIds = nodeFs.readdirSync(clientDirPath );
            let newestBuildIdx: number = 0;
            let newestBuildTimestamp: number = 0;
            
            for (let i=0;i< buildIds.length;i++) {
                let dateString = buildIds[i];
                if (dateString.length >= 14) {
                    let mTimestamp = new Date(dateString.substr(0,4)+"-"+dateString.substr(4,2)+"-"+dateString.substr(6,2)+" "+dateString.substr(8,2)+":"+dateString.substr(10,2)+":"+dateString.substr(12,2)+":").getTime();
                    if (mTimestamp !==NaN && mTimestamp > newestBuildTimestamp) {
                        newestBuildTimestamp = mTimestamp;
                        newestBuildIdx = i;
                    }
                }
                
            }
            Logger.debug("Using: " + buildIds[newestBuildIdx]);
            optionsSource.options.plugins.push({
                name: dirName,
                buildId: buildIds[newestBuildIdx]
            });
            let pluginModule = <any>require(dirPath + "/main/build/main.js");
            (new pluginModule.Plugin()).register(null, this);
        });
    }
    
    getPluginConfig(name: string): app.PluginConfig {
        return Lang.find(optionsSource.options.plugins, x => x.name == name);
    }
    
    getPluginConfigData(): app.PluginConfig[] {
        return optionsSource.options.plugins;
    }
    
    loadCustomizationAsset(name: string): string {
        let customizationDir = path.resolve(this.profile.absolutePath, "custom");
        let customizationFilePath = path.resolve(customizationDir, name);
        return fs.existsSync(customizationFilePath) ? fs.readFileSync(customizationFilePath, "utf8") : "";
    }
        
    onUserPreferencesChange(event: event.UserPreferencesChangeEvent): void {
        super.onUserPreferencesChange(event);
        let avatarDataUrl = event.userPreferences.getProfileImage();
        this.userAvatar = this.getAvatarFromDataUrl(avatarDataUrl);
        this.app.assetsManager.setAssetDataUriByName("MY_AVATAR", avatarDataUrl);
        const lang = event.userPreferences.getValue<string>("ui.lang");
        if (this.profile.getLanguage() != lang) {
            this.profile.setLanguage(lang);
            this.forceRefreshLanguageOnLogout = true;
        }
        this.refreshTrayMenu();
        
        for (let soundsCategory of this.soundsLibrary.categories) {
            (<HelperWindowController>this.windows.helper).setSound(soundsCategory.name, this.userPreferences.getSoundName(soundsCategory.name));
        }
    }
    
    getAvatarFromDataUrl(avatarDataUrl: string, size: number = 24) {
        const {nativeImage} = require("electron");
        if (avatarDataUrl.length > 0) {
            let avatarImage = nativeImage.createFromDataURL(avatarDataUrl);
            if (avatarImage.isEmpty()) {
                return null;
            }
            return avatarImage.resize({width: size});
        }
        else {
            let avatarImage = nativeImage.createFromPath(this.assetsManager.getAsset("icons/user-default.png", true));
            if (avatarImage.isEmpty()) {
                return null;
            }
            return avatarImage.resize({width: size});
        }
    }

    getAvatarFromPath(path: string, size: number = 24) {
        const {nativeImage} = require("electron");
        if (fs.existsSync(path)) {
            let avatarImage = nativeImage.createFromPath(path);
            if (avatarImage.isEmpty()) {
                return null;
            }
            return avatarImage.resize({width: size});
        }
        else {
            let avatarImage = nativeImage.createFromPath(this.assetsManager.getAsset("icons/user-default.png", true));
            if (avatarImage.isEmpty()) {
                return null;
            }
            return avatarImage.resize({width: size});
        }
    }

    
    setUiLang(_lang: string): void {
        // this.changeLang(lang);
    }
    
    startWithAutoLogin(): boolean {
        return this.state.autoLoginAfterStart && !this.state.autoLoginAttemptPerformed;
    }
    
    onWindowClose(): void {
        if (this.windowManager.windows.length == 1) {
            this.quit();
        }
    }
    
    isElectronApp(): boolean {
        return true;
    }
    
    isWebApp(): boolean {
        return false;
    }
    
    openLinksByController() {
        return true;
    }
    
    isAutoUpdateSupport(): boolean {
        return process.platform === 'win32' || process.platform === 'darwin';
    }
    
    getAutoUpdateStatusModel(): app.AutoUpdateStatusModel {
        if (this.isAutoUpdateSupport()) {
            return this.autoUpdateStatusModel;
        }
        throw new Error("AutoUpdate is not supported on this platform");
    }
    
    openWindow(load: app.WindowLoadOptions, options: app.WindowOptions, controller: BaseWindowController, parentWindow: app.WindowParent, singletonName?: string): ElectronWindow {
        let pWin = parentWindow != null && (<any>parentWindow).nwin != null ? (<ElectronWindow>(<any>parentWindow).nwin) : null
        let manager = (<BaseWindowController>parentWindow).manager ? (<BaseWindowController>parentWindow).manager : this.manager;
        let childManager = new BaseWindowManager(controller, manager);
        if (! manager.openChild(childManager, singletonName)) {
            return null;
        }
        let window = this.windowManager.open(load, options, controller, pWin);
        return window;
    }

    
    beforeLogout(): void {
        if (this.mailClientApi && this.sessionNotificationKey) {
            if (this.connectionStatusCheckerElectron) {
                this.connectionStatusCheckerElectron.onLogout();
            }
            this.logoutSaveLoginInfoPromise = this.saveLastLoginInfo().fail(e => {
                Logger.error("Error during saving last logged user", e);
            });
        }
        else {
            this.logoutSaveLoginInfoPromise = Q();
        }
        this.externalFilesService.cleanup();
        this.externalOpenedFilesSyncIntervals.forEach(x => {
            clearInterval(x.intervalId);
        });
        this.externalOpenedFilesSyncIntervals = [];
        super.beforeLogout();
    }
    
    logout(): Q.Promise<void> {
        let hashmail: string;
        return Q().then(() => {
            return this.mailClientApi.privmxRegistry.getIdentity();
        })
        .then(identity => {
            hashmail = identity.hashmail;
        })
        .then(() => {
            return this.manager.killAppWindows().fail(() => {
                return Q.reject();
            })
        })
        .then(() => {
            return this.app.unregisterProfile(hashmail);
        })
        .then(() => {
            this.eventDispatcher.removeListenersOnLogout();
            this.personService.stopSynchronizationTimer();
        
            // resume tasbar notifications for login screen
            let container = (<ContainerWindowController>this.windows.container);
            if (container) {
                container.cleanView();
                container.statusBarMain.resume();
            }

            return (<SqlStorage>this.storage).initBaseLevel()
            .then(() => {
                super.logout();
            })
        })
        .fail(e => {
            Logger.warn("something went wrong during logout..",e);
        })

    }
    
    afterLogout(): void {
        if (this.connectionStatusCheckerElectron && this.connectionStatusCheckerElectron.networkStatusService) {
            this.connectionStatusCheckerElectron.networkStatusService.stopCommunication();
            this.connectionStatusCheckerElectron.stopReconnectChecker();
            this.connectionStatusCheckerElectron = null;
        }
        this.stopMonitorInternetAccess();
        this.startLoggedOutConnectionChecker();

        this.changeIndicatorOnNewCount = false;
        this.updateNotifications(false);
        this.logoutSaveLoginInfoPromise.then(() => {
            this.checkUserNotifications();
        });
        this.defaultHost = null;
        this.userLoginWithHost = null;
        this.userAvatar = null;
        this.userRights = null;
        if (this.screenCover) {
            this.screenCover.stop();
        }
        if (this.forceRefreshLanguageOnLogout) {
            this.forceRefreshLanguageOnLogout = false;
            this.changeLang(this.profile.getLanguage());
        }
        this.hasInternetConnection = true;
        this.hasServerConnection = true;
        this.hideScreenCover();
        this.hideNoConnectionScreenCover();
        this.trayMenu.setNoInternet(false);
        

        super.afterLogout();
        this.refreshTrayMenu();
    }
    
    changeLang(lang: string): void {
        this.localeService.setLang(lang);
        this.profile.setLanguage(lang);
        this.windowManager.reloadAllWindows();
        this.trayMenu.onLanguageChange();
        this.refreshTrayMenu();
    }
    
    openExternalUrl(url: string): void {
        electron.shell.openExternal(url);
    }
    
    isSupportedHashmail(_hashmail: string): boolean {
        return true;
    }
    
    getTokenRegistrationUrl(_token: string): string {
        return null;
    }
    
    getToken(): string {
        if (this.registerTokenInfo) {
            return this.registerTokenInfo.token;
        }
        return null;
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
    
    getDesktopDownloadUrl(): string {
        return "https://privmx.com/cc/download";
    }
    
    getTermsUrl(): string {
        return "https://privmx.com/terms?lang=" + this.localeService.currentLang;
    }
    
    getPrivacyPolicyUrl(): string {
        return "https://privmx.com/privacy?lang=" + this.localeService.currentLang;
    }
    
    getDesktopAppUrls(): any {
        return {win32: "", darwin: "", linux: ""};
    }
    
    isWebAccessEnabled(): boolean {
        return false;
    }
    
    createContent(file: app.FileHandle): privfs.lazyBuffer.IContent {
        let eFile = <app.ElectronFileHandle>file;
        return File.createNodeFileLazyBuffer(eFile.path, eFile.type);
    }
    
    openFile(parentWindow: AppWindow): Q.Promise<privfs.lazyBuffer.IContent> {
        return File.chooseFile(parentWindow);
    }
    
    openFiles(parentWindow: AppWindow): Q.Promise<privfs.lazyBuffer.IContent[]> {
        let userPrefs: UserPreferences;
        let formatter = new Formatter();

        return Q().then(() => {
              return this.app.mailClientApi.privmxRegistry.getUserPreferences();
        })
        .then(preferences => {
            userPrefs = preferences;
            return File.chooseFiles(parentWindow, preferences.getValue(ElectronApplication.UI_OPEN_FILE_DIALOG_PATH_KEY, undefined));
        })
        .then(content => {
            return content.length > 0 ? userPrefs.set(ElectronApplication.UI_OPEN_FILE_DIALOG_PATH_KEY, content[0].filePath, true).thenResolve(content) : Q.resolve(content);
        })
        .then(content2 => {
            let limit = this.getMaxFileSizeLimit();
            let cancelUpload: boolean = false;
            content2.forEach(f => {
                if (f.size > limit) {
                    cancelUpload = true;
                }
            });
            return cancelUpload ? Q.reject(this.localeService.i18n("core.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit))) : content2;
        })
    }
    
    chooseDirectory(parentWindow: AppWindow): Q.Promise<string> {
        let userPrefs: UserPreferences;
        return Q().then(() => {
              return this.app.mailClientApi.privmxRegistry.getUserPreferences();
        })
        .then(preferences => {
            userPrefs = preferences;
            return File.chooseDir(parentWindow, preferences.getValue(ElectronApplication.UI_OPEN_FILE_DIALOG_PATH_KEY, undefined));
        })
        .then(path => {
            if (!path) {
                return Q.reject("no-choose");
            }
            return userPrefs.set(ElectronApplication.UI_OPEN_FILE_DIALOG_PATH_KEY, path, true).thenResolve(path);
        })
    }
    
    directSaveContent(content: privfs.lazyBuffer.IContent, session: Session, _parent?: app.WindowParentEx): Q.Promise<void> {
        return this.saveToHddWithChoose(content, session, _parent ? (<any>_parent).nwin : null);
    }
    
    saveContent(content: privfs.lazyBuffer.IContent, session: Session, parent?: app.WindowParentEx): Q.Promise<void> {
        let openable = content instanceof OpenableElement ? content : new SimpleOpenableElement(content);
        return this.ioc.create(DownloadWindowController, [parent || this, openable, session]).then(downloadWindow => {
            this.registerInstance(downloadWindow);
            downloadWindow.open();
            downloadWindow.nwin.focus();
        });
    }
    
    getScreenResolution(currentInsteadOfPrimary: boolean = false): {width: number, height: number} {
        if (currentInsteadOfPrimary) {
            let screenBounds = electron.screen.getDisplayNearestPoint(electron.screen.getCursorScreenPoint()).bounds;
            return {
                width: screenBounds.width,
                height: screenBounds.height,
            };
        }
        return electron.screen.getPrimaryDisplay().workAreaSize;
    }
    
    getScreenResolutionString(): string {
        let size = electron.screen.getPrimaryDisplay().workAreaSize;
        return size.width + "x" + size.height;
    }
    
    getVersion(): utils.ProjectInfo {
        return this.version;
    }
    
    playAudio(soundName: string, force: boolean = false) {
        (<HelperWindowController>this.windows.helper).playAudio(soundName, force);
    }

    setAudioEnabled(enabled: boolean) {
        (<HelperWindowController>this.windows.helper).setAudioEnabled(enabled);
    }
    
    networkIsDown():boolean {
        this.log("Electron app - networkIsDown: " + !this.hasInternetConnection);
        return !this.hasInternetConnection && !this.hasServerConnection;
        // return false;
    }
    
    getRegisterDomain(): string {
        if (this.registerTokenInfo) {
            return this.registerTokenInfo.domain;
        }
        return this.domainFromLogin;
    }
    
    getAdminRegistration(): boolean {
        if (this.registerTokenInfo) {
            return this.registerTokenInfo.isAdmin;
        }
        return null;
    }
    
    setDomainFromLogin(hashmail:string) {
        // get host from login string
        if (! hashmail) {
            return;
        }
        let host:string = hashmail.substring(hashmail.indexOf("#")+1, hashmail.length);
        this.domainFromLogin = host;
        this.defaultHost = host;
    }
    
    isHostAvailable(addressOrHost: string, servicePort?: number): Q.Promise<boolean> {
        const dns = require("dns");
        let defer = Q.defer<boolean>();
        
        if (servicePort) {
            dns.lookupService(addressOrHost, servicePort, (err: any, data: any) => {
                defer.resolve(!err);
            })
        }
        else {
            dns.lookup(addressOrHost, (err: any, data: any) => {
                defer.resolve(!err);
            });
        }
        return defer.promise;
    }
    
    hasNetworkConnection():boolean | Q.Promise<boolean> {
        if (this.hasNetworkConnectionDeferred) {
            return this.hasNetworkConnectionDeferred.promise;
        }
        this.hasNetworkConnectionDeferred = Q.defer();
        // this.log("checking hasNetworkConnection for 8.8.8.8 and ", this.defaultHost);
        let prom = Q().then(() => {
            let promises = [];
            promises.push(Q().then(() => this.isHostAvailable("8.8.8.8", 53)));
            if (this.defaultHost) {
                promises.push(Q().then(() => this.isHostAvailable(this.defaultHost)));
            }
            return Q.all(promises)
            .then(res => {
                if (res.length > 0) {
                    // this.log("inet connection: " + res[0]);
                }
                if (res.length > 1) {
                    // this.log("local server connection: " + res[1]);
                }
                return res.filter(x => x == true).length > 0;
            })
        })
        .then(res => {
            this.hasNetworkConnectionDeferred.resolve(res);
            this.hasNetworkConnectionDeferred = null;
            return res;
        });
        prom.catch(() => {
            this.hasNetworkConnectionDeferred.reject();
            this.hasNetworkConnectionDeferred = null;
        });
        return prom;
    }
    
    saveToHdd(content: privfs.lazyBuffer.IContent, filePath: string): Q.Promise<void> {
        return File.saveFile(content, filePath);
    }
    
    saveToHddWithChoose(content: privfs.lazyBuffer.IContent, session: Session, parentWindow?: AppWindow): Q.Promise<void> {
        return File.saveFileWithChoose(content, session, parentWindow);
    }
    
    electronShellOpen(filePath: string): void {
        electron.shell.openItem(filePath);
    }
    
    addTrayMenuEntry(options: Electron.MenuItemConstructorOptions) {
        this.additionalMenuItems.push(options);
    }
    
    registerTrayMenus() {
        if (process.platform != "win32") {
            this.trayMenu.registerMenuItem( {
                options: {
                    label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                    type: "normal",
                    click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                },
                onUpdate: (_options: Electron.MenuItemConstructorOptions) => {
                    return {
                        label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                        type: "normal",
                        click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                    }
                },
                
                id: "showHide",
                menuId: "loggedIn",
                order: 0,
                shortcutId: "global.showHide",
            });
        }
        
        this.trayMenu.registerMenuItem( {
            options: {
                type: "separator"
            },
            id: "silentModeSeparator",
            menuId: "loggedIn",
            order: 4,
        });

        this.trayMenu.registerMenuItem( {
            options: {
                label: this.localeService.i18n("app.try.menu.silentmode"),
                type: "checkbox",
                click: this.onToggleSilentMode.bind(this),
                checked: this.getSilentMode()
            },
            onUpdate: (_options: Electron.MenuItemConstructorOptions) => {
                return {
                    label: this.localeService.i18n("app.try.menu.silentmode"),
                    type: "checkbox",
                    click: this.onToggleSilentMode.bind(this),
                    checked: this.getSilentMode()
                }
            },
            onLanguageChange: () => this.localeService.i18n("app.try.menu.silentmode"),
            id: "silentmode",
            menuId: "loggedIn",
            order: 5,
        });
        
        this.trayMenu.registerMenuItem( {
            options: {
                type: "separator"
            },
            id: "separator",
            order: 10
        });
        
        this.trayMenu.registerMenuItem( {
            options: {
                type: "separator"
            },
            id: "secondSeparator",
            menuId: "loggedIn",
            order: 96
        });


        this.trayMenu.registerMenuItem( {
            options: {
                type: "separator"
            },
            id: "thirdSeparator",
            menuId: "loggedIn",
            order: 45
        });
        
        this.trayMenu.registerMenuItem( {
            options: {
                label: this.localeService.i18n("app.try.menu.settings"),
                type: "normal",
                click: this.onTryMenuSettingsClick.bind(this)
            },
            onLanguageChange: () => this.localeService.i18n("app.try.menu.settings"),
            id: "settings",
            menuId: "loggedIn",
            order: 50
        });
        
        if (this.userRights && this.userRights.indexOf("normal") > -1) {
            this.trayMenu.registerMenuItem( {
                options: {
                    label: this.localeService.i18n("app.try.menu.sections"),
                    type: "normal",
                    click: this.onTryMenuSectionsClick.bind(this)
                },
                onLanguageChange: () => this.localeService.i18n("app.try.menu.sections"),
                id: "sections",
                menuId: "loggedIn",
                order: 51
            });
        }
        
        // this.trayMenu.registerMenuItem( {
        //     options: {
        //         label: this.localeService.i18n("app.try.menu.notifications"),
        //         type: "normal",
        //         click: this.onTryMenuNotificationsClick.bind(this)
        //     },
        //     onLanguageChange: () => this.localeService.i18n("app.try.menu.notifications"),
        //     id: "notifications",
        //     menuId: "loggedIn",
        //     order: 55
        // });
        
        this.trayMenu.registerMenuItem( {
            options: {
                label: this.localeService.i18n("app.try.menu.logout"),
                type: "normal",
                click: this.onTryMenuLogoutClick.bind(this)
            },
            onLanguageChange: () => this.localeService.i18n("app.try.menu.logout"),
            id: "logout",
            menuId: "loggedIn",
            order: 85
        });
        

        this.trayMenu.registerMenuItem( {
            options: {
                label: this.localeService.i18n("app.try.menu.about"),
                type: "normal",
                click: this.onTryMenuAboutClick.bind(this)
            },
            onLanguageChange: () => this.localeService.i18n("app.try.menu.about"),
            id: "about",
            order: 115
        });
        
        this.trayMenu.registerMenuItem( {
            options: {
                label: this.localeService.i18n("app.try.menu.exit"),
                type: "normal",
                click: this.onTryMenuExitClick.bind(this)
            },
            onLanguageChange: () => this.localeService.i18n("app.try.menu.exit"),
            id: "exit",
            order: 120
        });

        this.trayMenu.registerMenuItem( {
            options: {
                label: this.localeService.i18n("app.try.menu.no-internet"),
                type: "normal",
                enabled: false,
            },
            onLanguageChange: () => this.localeService.i18n("app.try.menu.no-internet"),
            id: "noInternet",
            menuId:"noInternet",
            order: 0
        });
        
        this.trayMenu.registerMenuItem({
            options: {
                label: this.localeService.i18n("app.try.menu.server-error"),
                type: "normal",
                enabled: false,
            },
            onLanguageChange: () => this.localeService.i18n("app.try.menu.server-error"),
            id: "serverError",
            menuId: "serverError",
            order: 0
        });

        if (process.platform != "win32") {
            this.trayMenu.registerMenuItem( {
                options: {
                    label: this.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.login" : "app.try.menu.hide"),
                    type: "normal",
                    click: this.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this) : this.onTryMenuHideClick.bind(this)
                },
                onUpdate: (_options: Electron.MenuItemConstructorOptions) => {
                    return {
                        label: this.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.login" : "app.try.menu.hide"),
                        type: "normal",
                        click: this.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this) : this.onTryMenuHideClick.bind(this)
                    }
                },
                id: "login",
                menuId: "loggedOut",
                order: 0
            });

            this.trayMenu.registerMenuItem( {
                options: {
                    label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                    type: "normal",
                    click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                },
                onUpdate: (_options: Electron.MenuItemConstructorOptions) => {
                    return {
                        label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                        type: "normal",
                        click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                    }
                },
                
                id: "showHide",
                menuId: "loggedIn",
                order: 0,
                shortcutId: "global.showHide",
            });

            this.trayMenu.registerMenuItem( {
                options: {
                    label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                    type: "normal",
                    click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                },
                onUpdate: (_options: Electron.MenuItemConstructorOptions) => {
                    return {
                        label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                        type: "normal",
                        click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                    }
                },
                
                id: "showHide-noInternet",
                menuId: "noInternet",
                order: 0,
                shortcutId: "global.showHide",
            });

            this.trayMenu.registerMenuItem( {
                options: {
                    label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                    type: "normal",
                    click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                },
                onUpdate: (_options: Electron.MenuItemConstructorOptions) => {
                    return {
                        label: this.app.localeService.i18n(this.hiddenMode || !this.state.appFocused ? "app.try.menu.show" : "app.try.menu.hide"),
                        type: "normal",
                        click: this.app.hiddenMode || !this.state.appFocused ? this.onTryMenuShowClick.bind(this.app) : this.onTryMenuHideClick.bind(this)
                    }
                },
                
                id: "showHide-serverError",
                menuId: "serverError",
                order: 0,
                shortcutId: "global.showHide",
            });


        }
        

        this.trayMenu.registerMenuItem( {
            options: {
                label: this.userLoginWithHost || "",
                type: "normal",
                enabled: false,
                icon: this.userAvatar ? this.userAvatar : null
            },
            onUpdate: (_options: Electron.MenuItemConstructorOptions) => {
                return {
                  label: this.userLoginWithHost || "",
                  type: "normal",
                  enabled: false,
                  icon: this.userAvatar ? this.userAvatar : null
                }
            },
            id: "userInfo",
            menuId: "loggedIn",
            order: 10
        });
        
        this.trayMenu.registerMenu("loggedIn");
        this.trayMenu.registerMenu("noInternet");
        this.trayMenu.registerMenu("serverError");
        this.trayMenu.registerMenu("loggedOut");
    }
    
    onTryRestartClick() {
        electron.app.relaunch();
        electron.app.exit(0);
    }
    
    screenCapture(): Q.Promise<ImageEditorWindowController> {

        return Q().then(() => {
            return this.takeScreenshot()
            .then(data => {
                this.playAudio("screenshot");
                return this.ioc.create(ImageEditorWindowController, [this, this.app.sessionManager.getLocalSession(), {docked: false, imageBuffers: data}]).then(win => {
                    return this.openChildWindow(win);
                });
            });
        })
    }
    

    refreshTrayMenu() {
        this.registerTrayMenus();
        if (this.isLogged() && this.hasServerConnection && this.hasInternetConnection) {
            this.trayMenu.setActive("loggedIn");
        }
        else
        if (! this.hasInternetConnection) {
            this.trayMenu.setActive("noInternet");
        }
        else
        if (! this.hasServerConnection) {
            this.trayMenu.setActive("serverError");
        }
        else {
            this.trayMenu.setActive("loggedOut");
        }
    }
        
    onContainerHide() {
        this.hiddenMode = true;
        this.refreshTrayMenu();
    }
    
    onShowHideClick(): void {
        if (this.hiddenMode || !this.state.appFocused) {
            this.onTryMenuShowClick();
            this.app.dispatchEvent({type: "focusChanged", windowId: "main-window"});
        }
        else {
          this.onTryMenuHideClick();
        }
    }

    bringMainWindowToTop(): void {
          this.onTryMenuShowClick();
          this.app.dispatchEvent({type: "focusChanged", windowId: "main-window"});
    }
    
    allowMultipleInstances(): boolean {
        return this.starter.allowMultipleInstances();
    }
    
    onNewTextNoteClick(): void {
        if (this.trayMenu) {
            let action: Function = this.trayMenu.getRegisteredItemAction("newTextNote");
            if (action) {
                action();
            }
        }
    }
    
    onNewMindmapClick(): void {
        if (this.trayMenu) {
            let action: Function = this.trayMenu.getRegisteredItemAction("newMindmap");
            if (action) {
                action();
            }
        }
    }
    
    onNewTaskClick(): void {
        if (this.trayMenu) {
            let action: Function = this.trayMenu.getRegisteredItemAction("newTask");
            if (action) {
                action();
            }
        }
    }

    onTakeScreenshotClick(): void {
        if (this.trayMenu) {
            let action: Function = this.trayMenu.getRegisteredItemAction("takeScreenshot");
            if (action) {
                action();
            }
        }
    }
    
    onOpenLastFileClick(): void {
        this.app.dispatchEvent<event.CustomActionEvent>({type: "customaction", target: null, actionType: "open-last-file"});
    }
    
    onRecentFilesClick(): void {
        if (this.trayMenu && this.app.isLogged()) {
            let action: Function = this.trayMenu.getRegisteredItemAction("recentFiles");
            if (action) {
                action();
            }
        }
    }
    
    onToggleSearchClick(): void {
        if (this.state.appFocused) {
            let w = this.manager.getFocusedWindow();
            if (w && w.isMainWindow()) {
                let searchModel = this.searchModel.get();
                searchModel.visible = !searchModel.visible;
                this.app.searchModel.set(searchModel);
            }
        }
    }
    
    onTryMenuHideClick() {
        this.windows.container.onNwinClose();
    }
    
    onTryMenuShowClick() {
        this.showMainWindow();
        this.refreshTrayMenu();
    }
    
    onTryMenuAboutClick() {
        this.openAbout();
    }
    
    onTryMenuSettingsClick() {
        this.openSettings();
    }

    onTryMenuSectionsClick() {
        this.openSections();
    }

    onTryMenuNotificationsClick() {
        this.openNotifications();
    }
    
    onTryMenuLogoutClick() {
        this.logout();
    }
    
    onTryMenuExitClick() {
        this.keyboardShortcuts.unbindGlobalShortcuts();
        this.quit();
    }
    
    getInstanceInfo() {
        let versions = <ProcessVersionsElectron>process.versions;
        return this.version.str + " - " + os.type() + " " + os.release() + " Electron: " + versions.electron + " NodeJs: " + versions.node + " v8: " + versions.v8 + " Chrome: " + versions.chrome;
    }
    
    onLoginStart(): void {
        this.state.signingIn = true;
        super.onLoginStart();
    }
    
    onLoginFail(): void {
        this.state.signingIn = false;
        this.state.autoLoginAttemptPerformed = true;
        if (this.state.sthNewAtLoginFail != null) {
            this.updateNotifications(this.state.sthNewAtLoginFail);
        }
        super.onLoginFail();
    }
    
    onAutoLoginNotPerformed(): void {
        this.state.autoLoginAttemptPerformed = true;
        if (this.state.sthNewAtLoginFail != null) {
            this.updateNotifications(this.state.sthNewAtLoginFail);
        }
        super.onAutoLoginNotPerformed();
    }
    
    onLogin(mailClientApi: MailClientApi, userCredentials: app.UserCredentials): void {
        this.state.signingIn = false;
        this.state.autoLoginAttemptPerformed = true;
        this.state.sthNewAtLoginFail = null;
        this.connectionStatusCheckerElectron = new ConnectionStatusCheckerElectron(this, userCredentials);
        
        super.onLogin(mailClientApi, userCredentials);
    }
    
    afterLoginBefore() {
        return Q.all([
            this.mailClientApi.privmxRegistry.getIdentity(),
            this.mailClientApi.privmxRegistry.getIdentityProvider(),
            this.mailClientApi.privmxRegistry.getMessageManager(),
        ])
        .then(res => {
            let [identity, identityProvider, messageManager] = res;
            this.defaultHost = identity.host;
            let serverDataId: string = (<any>messageManager.storage.config).serverDataId;
            this.userLoginWithHost = identityProvider.getLogin() + "#" + identity.host;
            this.userRights = identityProvider.getRights();
            return (<SqlStorage>this.storage).switchToUserLevel(identityProvider.getLogin(), identity.host, serverDataId);
        })
    }
    
    afterLogin(): void {
        let key: string;
        Q.all([
            this.mailClientApi.privmxRegistry.getSrpSecure(),
            this.mailClientApi.privmxRegistry.getPersons(),
            this.mailClientApi.privmxRegistry.getIdentity()
        ])
        .then(res => {
            this.stopLoggedOutConnectionChecker();
            this.refreshTrayMenu();
            let [srpSecure, persons, identity] = res;
            key = this.sessionNotificationKey || privfs.crypto.service.randomBytes(16).toString("hex");
            return srpSecure.request("addNotificationKey", {
                key: key,
                info: this.getInstanceInfo()
            })
            .then(() => Q.resolve(identity));
        })
        .then(identity => {
            this.externalFilesService = ExternalFilesService.create(this, identity, this.filesLockingService);
        })
        .then(() => {
            return this.connectionStatusCheckerElectron.afterLogin()
        })
        .then(() => {
            this.sessionNotificationKey = key;
            return this.saveLastLoginInfo();
        })
        .then(() => {
            let updaterConfig = this.updater.readConfigFile();
            if (! updaterConfig) {
                let updateLink = this.lastLoginInfo.host + "/" + Updater.DEFAULT_SERVER_UPDATES_LOCATION;
                let configData: ConfigData = {link: updateLink};
                this.updater.writeConfigFile(configData);
                this.updater.setConfigData(configData);
            }
        })
        .then(() => {
            this.setSilentMode(this.userPreferences.getValue<boolean>(MailConst.UI_APP_SILENT_MODE));
        })
        .then(() => {
            this.monitorInternetAccess();
            this.screenCover.start();
            
            // suspend taskbar notifications to prevent rendering view on every poll
            let container = (<ContainerWindowController>this.windows.container);
            if (container) {
                container.statusBarMain.suspend();
            }
        })
        .fail(e => {
            Logger.error("Cannot add notification key", e);
        });
    }
    
    saveLastLoginInfo() {
        if (this.dataCleared) {
            this.dataCleared = false;
            return Q();
        }
        return Q().then(() => {
            return this.mailClientApi.privmxRegistry.getIdentity();
        })
        .then(identity => {
            let lastLoginInfo: LastLoginInfo = {
                username: identity.user,
                host: identity.host,
                lastTime: new Date().getTime(),
                key: this.sessionNotificationKey
            };
            return this.defaultSettings.set("lastLogin", lastLoginInfo).then(() => {
                this.lastLoginInfo = lastLoginInfo;
            });
        });
    }
    
    quit() {
        if (this.mailClientApi && this.sessionNotificationKey) {
            return Q().then(() => {
                return this.saveLastLoginInfo();
            })
            .fail(e => {
                Logger.error("Error during saving last logged user", e);
            })
            .fin(() => {
                this.quitCore();
            });
        }
        else {
            this.quitCore();
        }
    }
    
    quitCore() {
        this.cleanupTempFiles();
        let container = (<ContainerWindowController>this.windows.container);
        if (container) {
            this.closeAllWindows().then(() => {
                // container.hide().then(() => {
                    electron.app.quit();
                // });
            });
        }
        else {
            electron.app.quit();
        }
    }
    
    cleanupTempFiles(): void {
        if (fs.existsSync(this.profile.tmpAbsolutePath)) {
            try {
                let tmpDirs = fs.readdirSync(this.profile.tmpAbsolutePath);
                tmpDirs.forEach(dir => {
                    if (dir != "." && dir != "..") {
                        fsExtra.removeSync(path.join(this.profile.tmpAbsolutePath, dir));
                        
                    }
                })
            } catch (e) {}
        }
    }
    
    getTmpAbsolutePath(): string {
        return this.profile.tmpAbsolutePath;
    }

    getDiskUtils(): DiskUtils {
        return DiskUtils;
    }
    
    getUIEventsListener(): () => void {
        return this.screenCover.onEventBinded;
    }
    
    updateNotifications(withNotif: boolean) {
        let nowTime = (new Date()).getTime();
        if(!this.notifsLoggedIn && withNotif && this.lastNotifShowedTime + 5*60*1000 < nowTime) {
            //showing simple notif - no data as we are not logged-in
            // every 5 min if not logged in
            this.lastNotifShowedTime = nowTime;
            this.showBaloonNotification();
        }
        
        if (!this.notifsLoggedIn && withNotif) {
            this.trayMenu.showNotificationDot();
        }
    }
    
    setNewCount(count: number) {
        let title = (count > 0 ? "(" + count + ") " : "") + this.getAppTitle();
        let container = (<ContainerWindowController>this.windows.container);
        if (container) {
            container.setTitle(title);
        }
        this.trayMenu.updateUnreadCount(count);
    }
    
    showMainWindow(): void {
        this.hiddenMode = false;

        if (this.windows.container.openWindowOptions && this.windows.container.openWindowOptions.maximized) {
            (<ElectronWindow>this.windows.container.nwin).window.show();
            (<ElectronWindow>this.windows.container.nwin).window.maximize();
            (<ElectronWindow>this.windows.container.nwin).window.focus();
        }
        else {
            (<ElectronWindow>this.windows.container.nwin).window.show();
            (<ElectronWindow>this.windows.container.nwin).window.focus();
        }
        this.state.appFocused = (<ElectronWindow>this.windows.container.nwin).window.isFocused();
    }
    
    showBaloonNotification(title?: string, elements?: string[], customIcon?: electron.NativeImage, context?: event.NotificationContext) {
        if (this.getSilentMode()) {
            return;
        }

        // Notification of something new (when we are logged out)
        if (elements === undefined) {
            let myNotification = new electron.Notification({
                title: this.localeService.i18n("app.notifications.new"),
                body: this.localeService.i18n("app.notifications.new.body"),
                icon: this.notificationsService.getNotificationIcon(),
            });
            myNotification.on("click", this.onNotificationClick.bind(this));
            myNotification.show();
            return;
        }
        
        let notifBody:string = "";
        elements.forEach( element => {
            notifBody += element+"\n";
        })
                
        // Notification (when we are logged in to PrivMX)
        const titleLen = ElectronApplication.APP_MAX_NOTIFICATION_TITLE_LEN;
        const elipsis = ElectronApplication.APP_NOTIFICATION_ELIPSIS;
        
        let myNotification = new electron.Notification({
            title: title && title.length > titleLen ? title.substr(0, titleLen - elipsis.length) + elipsis : title,
            body: notifBody,
            icon: customIcon ? customIcon : this.notificationsService.getNotificationIcon(),
            silent: true //bypass OS sound - we do not want to play those sounds - we will play our sounds
        });
        myNotification.on('click', this.onTooltipClick.bind(this, context));
        
        // musimy trzymac obiekt notyfikacji w pamieci (na potrzeby sidebara w mac os) bo w innym wypadku system po wyswietleniu tooltipa zniszczy obiekt
        // i zgubimy referencje do niego - pasek powiadomien na mac os przestanie dzialac
        this.notificationsReferences.push(myNotification);
        
        // play sound notification only when NOT in voicechat
        if (! this.app.voiceChatService.isInVoiceChat() ) {
            this.playAudio("notification");
        }
        myNotification.show();
    }
    
    onNotificationClick(context: any) {
        this.onShowHideClick();
    }
    
    
    onTooltipClick(context: event.NotificationContext): void   {
        this.showMainWindow();
        let wndToOpen: ContainerWindowController;
        for (let wndId in this.windows) {
            if (this.windows[wndId] instanceof ContainerWindowController) {
                this.app.viewContext = context.sinkId;
                wndToOpen = (<ContainerWindowController>this.windows[wndId]);
                break;
            }
        }
        if (wndToOpen) {
            wndToOpen.redirectToAppWindow(context.module, context.sinkId);
        }
        this.refreshTrayMenu();
    }
    
    getApps() {
        return [
            "mail",
            "chat"
        ]
    }
    
    getInitApp() {
        return "apps";
    }
    
    getDefaultHost(): string {
        if (this.registerTokenInfo) {
            return this.registerTokenInfo.domain;
        }
        return this.defaultHost;
    }
    
    onPollingResult(entries: PollingItem[]) {
        super.onPollingResult(entries);
        let unread = 0;
        for (let wndId in this.windows) {
            if (this.windows[wndId] instanceof ContainerWindowController) {
                (<ContainerWindowController>this.windows[wndId]).appWindows.forEach( appWnd => {
                    if (appWnd.count) {
                        unread += appWnd.count.get()
                    }
                });
            }
        }
        this.setNewCount(unread);
    }
    
    monitorInternetAccess() {
        if (this.internetMonitorTimer) {
            return;
        }

        let func = () => {
            Q().then(() => {
                if (this.connectionStatusCheckerElectron) {
                    return this.connectionStatusCheckerElectron.getServerConnectedStatus()
                    .then(serverConnection => {
                        if (! serverConnection) {
                            this.onServerConnectionError();
                        }
                    })
                }
            })
            .then(() => {
                return this.hasNetworkConnection();
            })
            .then((isConnected: boolean) => {
                this.hasInternetConnection = isConnected;
            })
        }
        this.internetMonitorTimer = setInterval( () => func(),  5 * 1000);
    }

    stopMonitorInternetAccess(): void {
        if (this.internetMonitorTimer) {
            clearInterval(this.internetMonitorTimer);
            this.internetMonitorTimer = null;
        }
    }


    
    // onNoInternetAccess() {
    //     this.log("Electron app - onNoInternetAccess")
    //     this.showNoConnectionScreenCover();
    //     this.hasInternetConnection = false;
    //     this.trayMenu.setNoInternet(! this.hasInternetConnection);
    //     this.refreshTrayMenu();
    //
    //     this.connectionStatusCheckerElectron.tryReconnect();
    // }
    //
    // onGetInternetConnectionBack() {
    //     this.log("Electron app - onGetInternetConnectionBack")
    //
    //     this.hideNoConnectionScreenCover();
    //     this.hasInternetConnection = true;
    //     this.trayMenu.setNoInternet(! this.hasInternetConnection);
    //     this.refreshTrayMenu();
    // }
    
    onServerConnectionError() {
        this.log("Electron app - onServerConnectionError")

        this.showNoConnectionScreenCover();
        this.voiceChatService.onServerConnectionLost();
        this.hasServerConnection = false;
        this.trayMenu.setNoInternet(! this.hasServerConnection);
        this.refreshTrayMenu();
        
        // this.connectionStatusCheckerElectron.tryReconnect();
        this.connectionStatusCheckerElectron.startReconnectChecker();
    }
    
    onServerConnectionRestored() {
        this.log("Electron app - onServerConnectionRestored")

        this.hideNoConnectionScreenCover();
        this.hasInternetConnection = true;
        this.hasServerConnection = true;
        this.trayMenu.setNoInternet(false);
        this.refreshTrayMenu();
        if (this.connectionRestoredDeferred) {
            this.connectionRestoredDeferred.resolve();
            this.connectionRestoredDeferred = null;
        }
    }
    
    waitForConnection(): Q.Promise<void> {
        if (!this.connectionRestoredDeferred) {
            this.connectionRestoredDeferred = Q.defer<void>();
        }
        return this.connectionRestoredDeferred.promise;
    }
    
    setWindowsTitleBarButtonsPosition(position: string) {
        if (position == "left" || position == "right") {
            this.windowManager.setWindowsTitleBarButtonsPosition(position);
            this.defaultSettings.set("ui.windowTitleBarButtonsPosition", position).fail(e => {
                Logger.error("Error during saving windowTitleBarButtonsPosition", e);
            });
        }
    }
    
    preventLinkOpenageInView(): boolean {
        return true;
    }
    
    getLocaleServiceData(): string {
        return JSON.stringify({
            currentLang: this.localeService.currentLang,
            texts: this.localeService.texts
        });
    }
    
    getResourcesPath(): string {
        return this.resourcesPath;
    }
    
    onGetMenu(type: string) {
        let menuHelper = new ContextMenuHelper(this);
        return electron.Menu.buildFromTemplate(menuHelper.getMenuTemplate(type));
    }
    
    buildBaseWindowMenu() {
        // set global menu
        let menuHelper = new ContextMenuHelper(this);
        if (process.platform == "darwin") {
            electron.Menu.setApplicationMenu( electron.Menu.buildFromTemplate(menuHelper.getMenuTemplate("mac-osx-main-menu")) );
            
            const dockMenu = electron.Menu.buildFromTemplate([]);
            electron.app.dock.setMenu(dockMenu);
        }
        else {
            electron.Menu.setApplicationMenu( electron.Menu.buildFromTemplate(menuHelper.getMenuTemplate("empty")) );
            this.bindExtraShortcuts();
        }
        

    }

    bindExtraShortcuts(): void {
        let menuHelper = new ContextMenuHelper(this);
        let shortcut = this.keyboardShortcuts.getShortcut("closeCurrentWindow");
        if (shortcut) {
            if (shortcut.length > 0) {
                electron.Menu.setApplicationMenu( electron.Menu.buildFromTemplate(menuHelper.getMenuTemplate("extraClose", shortcut)) );
            }
        }
    }
    
    monitorForUpdates() {
        if (! this.updaterStatus) {
            this.updaterStatus = new UpdaterState();
        }
        clearTimeout(this.updaterStatus.updatesCheckTimer);
        this.updaterStatus.updatesCheckTimer = setTimeout(() => {
            this.monitorForUpdates();
            this.updater.checkForUpdate().catch(e => {});
        }, 10 * 60 * 1000);
    }
        
    registerViewersEditors() {
        super.registerViewersEditors();
        
        this.shellRegistry.registerApp({
            id: "core.electron.external",
            open: (options: ShellOpenOptions): any => {
                Q().then(() => {
                    return this.saveToHddAndOpen(options.session, options.element, options.parent);
                })
                .then(() => {
                    this.app.dispatchEvent({type: "file-opened-external", element: options.element});
                })
                .fail(e => {
                    Logger.error("Error during downloading", e);
                });
            }
        });
        
        this.shellRegistry.registerApplicationBinding({applicationId: "core.electron.external", mimeType: "*", action: ShellOpenAction.EXTERNAL});
    }
    
    openFromHdd(session: Session, content: privfs.lazyBuffer.IContent): Q.Promise<void> {
        return Q().then(() => {
            return this.externalFilesService.saveAndOpenFile(session, content);
        });
    }
    

    
    saveToHddAndOpen(session: Session, content: privfs.lazyBuffer.IContent, parent?: app.WindowParentEx): Q.Promise<void> {
        return Q().then(() => {
            return this.app.mailClientApi.privmxRegistry.getUserPreferences();
        })
        .then(userPreferences => {
            let showWarning = userPreferences.getValue("ui.showOpenExternalWarning", false);
            if (!showWarning && (<any>content).openableElementType != "LocalOpenableElement") {
                return this.ioc.create(OpenExternalWindowController, [parent || this, {
                    name: content.getName(),
                    mimeType: content.getMimeType()
                }])
                .then(openExternalWindowController => {
                    let defer = Q.defer<void>();
                    openExternalWindowController.showModal(result => {
                        if (result == Result.OK) {
                            this.openFromHdd(session, content).then(defer.resolve, defer.reject);
                        }
                        else {
                            defer.reject("cancelled");
                        }
                    });
                    return defer.promise;
                });
            }
            else {
                return this.openFromHdd(session, content);
            }
        })
    }
    
    createTrayIcon(icon: string): electron.Tray {
        return new electron.Tray(icon);
    }
    
    getSystemClipboard(): electron.Clipboard {
        return electron.clipboard;
    }
    
    getDesktopCapturer(): electron.DesktopCapturer {
        return electron.desktopCapturer;
    }

    getPowerMonitor(): electron.PowerMonitor {
        return electron.powerMonitor;
    }
    
    buildMenuFromTemplate(options: Electron.MenuItemConstructorOptions[]): electron.Menu {
        return electron.Menu.buildFromTemplate(options);
    }
    
    onMaximizeToggle(): void {
        this.app.dispatchEvent({type: "onToggleMaximize-notify"});
    }
    
    takeScreenshot() {
        let result = Q.defer<Buffer[]>();
        const screenshot = require("screenshot-desktop");

        let execPath: string = null;
        if (process.platform == "win32") {
            let scriptDir = screenshot.getScriptDir();
    
            //replace for extracted dir
            execPath = scriptDir.replace("app.asar", "app.asar.unpacked");
            screenshot.setExecPath(execPath);
        }

        let data: Buffer[] = [];
        screenshot.listDisplays().then((displays: { id: string, name: string }[]) => {
            let takeFunc = (screenId: string, screenName: string, fileId: string) => {
                return Q().then(() => {
                    let fname = path.join(this.profile.tmpAbsolutePath, "screen-" + fileId + "-" + (new Date().getTime()).toString() + ".jpg");
                    return screenshot({ filename: fname, screen: screenId })
                        .then((filename: string) => {
                            return filename;
                        });
                })
            };
            let actions: Q.Promise<string>[] = [];
            displays.forEach((disp, _i) => {
                actions.push(takeFunc(disp.id, disp.name, _i.toString()));
            });
            return Q.all(actions)
                .then(res => {
                    res.forEach(f => {
                        let buffer = nodeFs.readFileSync(f);
                        data.push(buffer);
                        fs.unlinkSync(f);
                    })
                });
        })
            .then(() => {
                result.resolve(data);
            });

        return result.promise;
    }
    
    getSystemCliboardData(skipCheck: boolean = false): ClipboardData {
        if (!skipCheck && !this.clipboard.isSystemIntegrationEnabled()) {
            return null;
        }
        let formats: string[] = this.getSystemClipboard().availableFormats();
        let data: ClipboardData = {};
        (formats || []).forEach(x => {
            if (x == "text" || x == "text/plain") {
                data["text"] = this.getSystemClipboard().readText();
            }
            else if (x == "html" || x == "text/html") {
                data["html"] = this.getSystemClipboard().readHTML();
            }
        });
        let files = this.getSystemClipboardFiles(false);
        if (files && files.length > 0) {
            data[PrivMxClipboard.FORMAT_SYSTEM_FILES] = JSON.stringify(files);
        }
        return data;
    }
    
    setSystemCliboardData(element: ClipboardData, askForIntegration: boolean = true): Q.Promise<boolean> {
        if (this.clipboard.isSystemIntegrationEnabled()) {
            this._setSystemClipboardDataForced(element);
            return Q(true);
        }
        else {
            if (askForIntegration) {
                return this.tryAskSystemClipboardIntegration().then(integrationEnabled => {
                    if (integrationEnabled) {
                        this._setSystemClipboardDataForced(element);
                    }
                    return !!integrationEnabled;
                });
            }
            return Q(false);
        }
    }
    
    _setSystemClipboardDataForced(element: ClipboardData): void {
        let data: {[format: string]: any} = {};
        if (element["text"]) {
            data["text"] = element["text"];
        }
        if (element["html"]) {
            data["html"] = element["html"];
        }
        if (Object.keys(data).length > 0) {
            this.getSystemClipboard().write(data);
        }
        else {
            this.getSystemClipboard().write({ text: "" });
        }
    }
    
    getSystemClipboardFiles(includeContents: boolean = true): { mime: string, data: Buffer, path?: string }[] {
        if (process.platform == "darwin" || process.platform == "win32") {
            const clipboardFiles = require("clipboard-files");
            let files: { mime: string, data: Buffer, path?: string }[] = [];
            
            let filePaths = (<string[]>clipboardFiles.readFiles()).map(x => decodeURI(x));
            if (process.platform == "darwin") {
                for (let filePath of filePaths) {
                    let p = filePath.replace("file://", "");
                    if (fs.lstatSync(p).isFile()) {
                        files.push({ mime: MimeType.resolve(p), data: includeContents ? fs.readFileSync(p) : null, path: p })
                    }
                }
            }
            else {
                for (let filePath of filePaths) {
                    if (fs.lstatSync(filePath).isFile()) {
                        files.push({ mime: MimeType.resolve(filePath), data: includeContents ? fs.readFileSync(filePath) : null, path: filePath })
                    }
                }
            }
            if (files.length > 0) {
                return files;
            }
        }
        
        let formats: string[] = this.getSystemClipboard().availableFormats();
        for (let format of formats) {
            if (format == "image/png") {
                let buf = this.getSystemClipboard().readImage();
                return [{ mime: format, data: buf.toPNG() }];
            }
            else if (format == "image/jpeg") {
                let buf = this.getSystemClipboard().readImage();
                return [{ mime: format, data: buf.toJPEG(90) }];
            }
            else if (format == "text" || format == "text/plain") {
                let str = this.getSystemClipboard().readText();
                let fileNames: string[] = null;
                
                if (str.indexOf("file:///") == 0 && str.split("\n").filter(x => !(<any>x).startsWith("file:///")).length == 0 && str.trim() == str) {
                    // Linux/Dolphin
                    fileNames = str.split("\n").map(x => x.substr("file://".length).trim());
                }
                else if (str.indexOf("/") == 0 && str.trim() == str) {
                    // Linux/Nemo
                    fileNames = str.split("\n").map(x => x.trim());
                }
                else if (str.trim().indexOf("x-special/nautilus-clipboard") == 0 && str.trim().split("\n")[2] && str.trim().split("\n")[2].trim().indexOf("file:///") == 0) {
                    // Linux/Nautilus
                    fileNames = str.trim().split("\n").slice(2).map(x => x.substr("file://".length).trim());
                }
                
                if (fileNames && fileNames.length > 0) {
                    fileNames = fileNames.map(x => decodeURI(x));
                    if (fileNames.filter(x => !fs.existsSync(x)).length == 0) {
                        return fileNames
                            .filter(x => fs.lstatSync(x).isFile())
                            .map(x => ({ mime: MimeType.resolve(x), data: includeContents ? fs.readFileSync(x) : null, path: x }));
                    }
                }
            }
        }
        
        return [];
    }
    
    getClipboardElementToPaste(allowedPrivMxFormats: string[], allowedSystemFormats: string[], onlyPlainText: boolean = false): Q.Promise<ClipboardElement> {
        let elementPrivMx: ClipboardElement = null;
        let elementSystem: ClipboardElement = null;
        let elementPrivMxId: number = null;
        let elementSystemId: number = null;
        for (let i = this.clipboard.storedElements.length - 1; i >= 0 && (elementPrivMx === null || elementSystem === null); --i) {
            let el = this.clipboard.storedElements[i];
            if (el.source == "privmx" && elementPrivMx === null) {
                for (let format of allowedPrivMxFormats) {
                    if (this.clipboard.elementMatches(el, format, "privmx")) {
                        elementPrivMx = el;
                        elementPrivMxId = i;
                        break;
                    }
                }
            }
            if (el.source == "system" && elementSystem === null) {
                for (let format of allowedSystemFormats) {
                    if (this.clipboard.elementMatches(el, format, "system")) {
                        elementSystem = el;
                        elementSystemId = i;
                        break;
                    }
                }
            }
        }
        if (elementPrivMx === null && elementSystem === null) {
            return Q(null);
        }
        let element: ClipboardElement = null;
        // let integrationEnabled: boolean = false;
        return Q().then(() => {
            if (elementSystem && (!elementPrivMx || elementSystemId > elementPrivMxId)) {
                // return this.tryAskSystemClipboardIntegration().then(integration => {
                //     integrationEnabled = integration;
                //     if (integration) {
                //         return elementSystem;
                //     }
                //     else {
                //         return elementPrivMx;
                //     }
                // });
                return elementSystem;
            }
            else {
                return elementPrivMx;
            }
        }).then(_element => {
            if (!_element) {
                return null;
            }
            element = _element;
            let filesStr: string = element.data[PrivMxClipboard.FORMAT_SYSTEM_FILES];
            if (filesStr && !onlyPlainText) {
                let files: { path?: string, mime: string }[] = JSON.parse(filesStr);
                if (files.filter(x => !x.path).length == 0) {
                    return this.app.tryPasteFiles(files.map(x => x.path));
                }
                else if (files.length == 1 && (<any>files[0].mime).startsWith("image/")) {
                    return this.app.tryPasteImageData();
                }
            }
            return true;
        })
        .then(paste => {
            if (paste === null) {
                return null;
            }
            if (paste === false) {
                let el = JSON.parse(JSON.stringify(element));
                el.data = {
                    text: el.data.text,
                };
                return el.data.text ? el : null;
            }
            return element;
        });
    }
    
    tryPasteFiles(paths: string[]): Q.Promise<boolean> {
        if (this.pastingInProgress || !this.userPreferences || !paths || paths.length == 0) {
            return Q(false);
        }
        this.pastingInProgress = true;
        let pasteAsFile: boolean = false;
        return Q().then(() => {
            paths = paths
                .map(x => (<any>x).startsWith("file://") ? x.substr("file://".length) : x)
                .filter(x => this.canPasteFile(x));
            if (paths.length == 0) {
                pasteAsFile = false;
                return;
            }
            return Q().then(() => {
                let action = this.userPreferences.getPasteAsFileAction();
                let wndWidth = Math.max(300, Math.min(800, (paths.map(x => x.length).reduce((prev, curr) => Math.max(prev, curr))) * 10));
                let wndHeight = Math.min(300, 190 + (paths.length - 1) * 20);
                if (action == PasteAsFileAction.ASK) {
                    let osLabel: string = this.getSystemLabel();
                    let focused = this.manager.getFocusedWindow();
                    let owner = focused && focused.controller ? focused.controller : this.msgBox;
                    return owner.confirmEx({
                        message: this.localeService.i18n(paths.length == 1 ? "app.pasteAsFile.question" : "app.pasteAsFileMulti.question", paths.join("\n"), osLabel),
                        width: wndWidth,
                        height: wndHeight,
                        yes: {
                            visible: true,
                        },
                        no: {
                            visible: true,
                        },
                        checkbox: {
                            label: this.app.localeService.i18n("app.pasteAsFile.checkbox.label"),
                            checked: false,
                            visible: true,
                        },
                    }).then(result => {
                        pasteAsFile = result.result == "yes";
                        if (result.checked) {
                            this.userPreferences.set(MailConst.UI_PASTE_AS_FILE_ACTION, pasteAsFile ? PasteAsFileAction.PASTE_AS_FILE : PasteAsFileAction.PASTE_AS_TEXT, true);
                        }
                    });
                }
                else if (action == PasteAsFileAction.PASTE_AS_FILE) {
                    pasteAsFile = true;
                }
                else if (action == PasteAsFileAction.PASTE_AS_TEXT) {
                    pasteAsFile = false;
                }
            });
        })
        .fin(() => {
            this.pastingInProgress = false;
        })
        .then(() => {
            return pasteAsFile;
        });
    }
    
    tryPasteImageData(): Q.Promise<boolean> {
        if (this.pastingInProgress || !this.userPreferences) {
            return Q(false);
        }
        this.pastingInProgress = true;
        let pasteAsFile: boolean = false;
        return Q().then(() => {
            return Q().then(() => {
                let action = this.userPreferences.getPasteAsFileAction();
                if (action == PasteAsFileAction.ASK) {
                    let focused = this.manager.getFocusedWindow();
                    let owner = focused && focused.controller ? focused.controller : this.msgBox;
                    return owner.confirmEx({
                        message: this.localeService.i18n("app.pasteImageAsFile.question", path),
                        height: 170,
                        yes: {
                            visible: true,
                        },
                        no: {
                            visible: true,
                        },
                        checkbox: {
                            label: this.app.localeService.i18n("app.pasteAsFile.checkbox.label"),
                            checked: false,
                            visible: true,
                        },
                    }).then(result => {
                        pasteAsFile = result.result == "yes";
                        if (result.checked) {
                            this.userPreferences.set(MailConst.UI_PASTE_AS_FILE_ACTION, pasteAsFile ? PasteAsFileAction.PASTE_AS_FILE : PasteAsFileAction.PASTE_AS_TEXT, true);
                        }
                    });
                }
                else if (action == PasteAsFileAction.PASTE_AS_FILE) {
                    pasteAsFile = true;
                }
                else if (action == PasteAsFileAction.PASTE_AS_TEXT) {
                    pasteAsFile = false;
                }
            });
        })
        .fin(() => {
            this.pastingInProgress = false;
        })
        .then(() => {
            return pasteAsFile;
        });
    }
    
    tryAskSystemClipboardIntegration(): Q.Promise<boolean> {
        if (this.askingSystemClipboardIntegrationPromise) {
            if (this.askingSystemClipboardIntegrationWindow) {
                this.askingSystemClipboardIntegrationWindow.focus();
            }
            return this.askingSystemClipboardIntegrationPromise;
        }
        this.askingSystemClipboardIntegrationPromise = Q().then(() => {
            let settingValue = this.userPreferences.getSystemClipboardIntegration();
            if (settingValue == SystemClipboardIntegration.ASK) {
                let focused = this.manager.getFocusedWindow();
                let owner = focused && focused.controller ? focused.controller : this.msgBox;
                return owner.confirmEx({
                    message: this.localeService.i18n("app.systemClipboardIntegration.question", path),
                    height: 210,
                    width: 500,
                    yes: {
                        visible: true,
                    },
                    no: {
                        visible: true,
                    },
                    checkbox: {
                        label: this.app.localeService.i18n("app.systemClipboardIntegration.checkbox.label"),
                        checked: false,
                        visible: true,
                    },
                    onWindowCreated: nwin => {
                        this.askingSystemClipboardIntegrationWindow = nwin;
                    },
                }).then(result => {
                    let integration = result.result == "yes";
                    if (result.checked) {
                        this.userPreferences.set(MailConst.UI_SYSTEM_CLIPBOARD_INTEGRATION, integration ? SystemClipboardIntegration.ENABLED : SystemClipboardIntegration.DISABLED, true);
                    }
                    return integration;
                });
            }
            else if (settingValue == SystemClipboardIntegration.DISABLED) {
                return false;
            }
            else if (settingValue == SystemClipboardIntegration.ENABLED) {
                return true;
            }
            return false;
        });
        this.askingSystemClipboardIntegrationPromise.fin(() => {
            this.askingSystemClipboardIntegrationPromise = null;
            this.askingSystemClipboardIntegrationWindow = null;
        });
        return this.askingSystemClipboardIntegrationPromise;
    }
    
    showOfflineError(): void {
    }
    
    getSupportedHosts(): string[] {
        return [];
    }
    
    getNetworkStatus(): string {
        return null;
    }
    
    onStorageEvent(event: privfs.types.core.SPMEvent): void {
        this.trayMenu.onStorageEvent(event);
    }
    
    getComputerName(): string {
        return os.hostname();
    }
    
    getSystemUserName(): string {
        return os.userInfo().username;
    }
    
    getPlayerManager(): PlayerManager {
        return (<PlayerHelperWindowController>this.windows.playerHelper).playerManager;
    }
    
    saveAsPdf(session: Session, file: OpenableElement, parentWindow?: AppWindow): Q.Promise<void> {
        return this.shellRegistry.shellOpen({
            element: file,
            action: ShellOpenAction.PRINT,
            session: session
        }).then(wnd => {
            let def = Q.defer<void>();
            return wnd.prepareToPrint(true).then(() => {
                let nwin = <ElectronWindow>wnd.nwin;
                setTimeout(() => {
                    nwin.window.webContents.printToPDF({
                        landscape: false,
                        marginsType: 0,
                        pageSize: "A4",
                        printBackground: false,
                    }, (err, data) => {
                        if (err) {
                            Logger.debug("Error while converting to PDF:");
                            Logger.debug(err);
                        }
                        else {
                            let cnt = privfs.lazyBuffer.Content.createFromBuffer(data, "application/pdf", file.name.substr(0, file.name.lastIndexOf(".")) + ".pdf");
                            File.saveFileWithChoose(cnt, session, parentWindow).then(() => {
                                wnd.close();
                                def.resolve();
                            }).catch(() => {
                                wnd.close();
                                def.reject();
                            });
                        }
                    });
                }, 600);
                return def.promise;
            });
        });
    }
    
    readCustomTheme(): void {
        let file = path.resolve(this.profile.absolutePath, Starter.CUSTOMIZATION_FILE);
        if (fs.existsSync(file)) {
            this.customizedTheme = JSON.parse(fs.readFileSync(file).toString());
        }
    }
    
    saveCustomTheme(): void {
        let file = path.resolve(this.profile.absolutePath, Starter.CUSTOMIZATION_FILE);
        fs.writeFileSync(file, JSON.stringify(this.customizedTheme));
    }
    
    showScreenCover(): void {
        this.app.dispatchEvent<event.AllWindowsMessage>({
            type: "all-windows-message",
            message: "show-screen-cover",
        });
    }
    
    hideScreenCover(): void {
        this.app.dispatchEvent<event.AllWindowsMessage>({
            type: "all-windows-message",
            message: "hide-screen-cover",
        });
    }

    showNoConnectionScreenCover(): void {
        this.app.dispatchEvent<event.AllWindowsMessage>({
            type: "all-windows-message",
            message: "show-no-connection-screen-cover",
        });
    }
    
    hideNoConnectionScreenCover(): void {
        this.app.dispatchEvent<event.AllWindowsMessage>({
            type: "all-windows-message",
            message: "hide-no-connection-screen-cover",
        });
    }

    
    getSystemLabel(): string {
        if (process.platform == "darwin") {
            return "MacOS";
        }
        if (process.platform == "linux") {
            return "Linux";
        }
        if (process.platform == "win32") {
            return "Windows";
        }
    }

    getSystemPlatform(): string {
        return process.platform;
    }
    
    getOs(): string {
        return `${this.getSystemLabel()} ${os.release()}`;
    }
    
    getMaxFileSizeLimit(): number {
        return 25 * 1000 * 1000;
    }
    
    canPasteFile(path: string): boolean {
        if (fs.existsSync(path)) {
            let stat = fs.lstatSync(path);
            if (stat.isFile() && stat.size <= this.getMaxFileSizeLimit()) {
                return true;
            }
        }
        return false;
    }
    
    getFileBuffer(path: string): Buffer {
        if (!fs.lstatSync(path).isFile()) {
            return null;
        }
        return fs.readFileSync(path);
    }
    
    getFileName(filePath: string): string {
        return path.basename(filePath);
    }
    
    getFileMimeType(filePath: string): string {
        return mime.lookup(filePath) || null;
    }
    
    
    static readonly FILE_LOGGING: boolean = true;
    getConnectionLogPath(): string {
        return path.join(path.resolve(os.homedir(), ".privmx"), "connection.log");
        // return path.join(process.env.USERPROFILE || process.env.HOME, "privmx-desktop-client.log")
    }
    
    log(...entry: any[]): void {
        if (! ElectronApplication.FILE_LOGGING) {
            return;
        }
        let logPath = this.getConnectionLogPath();
        let newLine = process.platform === 'win32' ? "\r\n" : "\n";
        try {
            nodeFs.appendFileSync(logPath, "[" + (new Date().toLocaleString()) + "] " + entry.join(" ") + newLine);
        }
        catch(e) {
            console.log("cannot access log file");
        }
    }
    
    exitApp(): void {
        this.quit();
    }
    
    acceptLicence(afterUpdate?: boolean): void {
        this.profile.setLicenceAccepted();
        super.start(afterUpdate);
    }

    isAutostartEnabled(): boolean {
        return this.profile.isAutostartEnabled();
    }

    setAutostartEnabled(enabled: boolean): void {
        this.profile.setAutostartEnabled(enabled);
        this.starter.setupAutoStart(! enabled);
    }
    
    setLoginInfoHidden(): void {
        this.profile.setLoginInfoHidden();
    }
    
    isLoginInfoVisible(): boolean {
        return this.profile.isLoginInfoVisible();
    }
    
    isProfileUsed(profile: string): Q.Promise<boolean> {
        return this.profilesIPC.isProfileUsed(profile);
    }
    
    registerProfile(profile: string): Q.Promise<void> {
        return this.profilesIPC.registerProfile(profile);
    }

    unregisterProfile(profile: string): Q.Promise<void> {
        return this.profilesIPC.unregisterProfile(profile);
    }

    
    toMBString(bytes: number): string {
        return (bytes / (1000.0 * 1000)).toFixed(2) + " MB";
    }
    
    getMemUsage(): void {
        setTimeout(() => {
            this.getMemUsage();
        }, 10000);
        let memObj = process.memoryUsage();
        console.log(this.toMBString(memObj.external));
        console.log(this.toMBString(memObj.heapUsed));
    }
    
    openLicenseVendorsWindow(): void {
        let lang = this.localeService.currentLang;
        
        if (!lang) {
            lang = this.localeService.defaultLang;
        }
        
        let vendorsBasePath = this.app.assetsManager.getAsset("assets/vendors", true);
        if (! nodeFs.existsSync(vendorsBasePath)) {
            Logger.error("Cannot find vendors licenses path.");
            return;
        }
        
        let vendorsPaths = nodeFs.readdirSync(vendorsBasePath).filter(x => nodeFs.lstatSync(path.join(vendorsBasePath, x)).isDirectory());
        let licenses: app.VendorLicenseAsset[] = [];
        vendorsPaths.forEach(vendorPath => {
            let files = nodeFs.readdirSync(path.join(vendorsBasePath, vendorPath));
            files.forEach(file => {
                let fullFilePath = path.join(vendorsBasePath, vendorPath, file);
                let fileHandle: any;
                if (this.isElectronApp()) {
                    fileHandle = {path: fullFilePath, handleType: "electron", mimeType: null};
                }
                else {
                    fileHandle = {file: {path: fullFilePath}, handleType: "browser"};
                }

                let asset: app.VendorLicenseAsset = {
                    assetName: vendorPath.replace(vendorsBasePath, "") + " > " + path.basename(file),
                    openableElement: new SimpleOpenableElement(this.app.createContent(fileHandle)),
                    assetPath: path.join(vendorPath, file)
                }
                licenses.push(asset);
            })
        })

        Q().then(() => {
            this.app.ioc.create(LicenseVendorsWindowController, [this, {
                entries: licenses,
                docked: false
            }]).then(win => {
                return this.openChildWindow(win);
            });
        })
    }
    
    openErrorWindow(error: Types.app.Error): void {
        let errorReport = this.errorReporter.createReport(error);
        this.app.ioc.create(ErrorWindowController, [this, { error: error, errorLog: errorReport.errorLog, systemInformation: errorReport.systemInformation }]).then(win => {
            win.getPromise().then(userAction => {
                if (userAction.sendReport) {
                    this.errorReporter.send(error, userAction.includeErrorLog, userAction.includeSystemInformation).then(() => {
                        win.afterReportSent();
                    })
                    .fail(() => {
                        win.close();
                    });
                }
            });
            return this.openChildWindow(win);
        });
    }
    
    getCcApiEndpoint(): string {
        return this.profile.getCcApiEndpoint();
    }
    
    loggedOutCheckConnection(): void {
        Q(this.hasNetworkConnection()).then(isConnected => {
            if (this.loggedOutConnectionCheckerTimeout == null) {
                return;
            }
            if (this.hasInternetConnection != isConnected) {
                this.hasInternetConnection = isConnected;
                this.refreshTrayMenu();
            }
            this.loggedOutConnectionCheckerTimeout = <number><any>setTimeout(() => {
                this.loggedOutCheckConnection();
            }, 5000);
        })
    }
    
    startLoggedOutConnectionChecker(): void {
        if (this.loggedOutConnectionCheckerTimeout != null) {
            return;
        }
        this.loggedOutConnectionCheckerTimeout = <number><any>setTimeout(() => {
            this.loggedOutCheckConnection();
        }, 5000);
    }
    
    stopLoggedOutConnectionChecker(): void {
        if (this.loggedOutConnectionCheckerTimeout == null) {
            return;
        }
        clearTimeout(this.loggedOutConnectionCheckerTimeout);
        this.loggedOutConnectionCheckerTimeout = null;
    }

    getPlatform(): string {
        return process.platform;
    }

    onToggleSilentMode(): void {
        let menuItem = this.trayMenu.registeredMenusItems.get("silentmode");
        let newValue = ! menuItem.options.checked;
        this.trayMenu.registeredMenusItems.get("silentmode").options.checked = newValue;
        this.setSilentMode(newValue);
        this.trayMenu.refreshTrayMenu();
    }

    startScreenCover(): void {
        this.screenCover.start();
    }

    stopScreenCover(): void {
        this.screenCover.stop();
    }
    
    listLocalFiles(path: string): string[] {
        return fs.readdirSync(path);
    }
    
    sendActivationData(username: string, temporaryPassword: string, email?: string, newAccount: boolean = true): void {
        let i18nBaseKey = newAccount ? "activationInfoEmail." : "activationInfoEmail.edit.";
        let title = encodeURIComponent(this.localeService.i18n(i18nBaseKey + "title"));
        let text = encodeURIComponent(this.localeService.i18n(i18nBaseKey + "text", this.defaultHost, username + `#${this.defaultHost}`, temporaryPassword));
        this.openExternalUrl(`mailto:${email?email:''}?subject=${title}&body=${text}`);
    }
    
    getNotificationTitleMaxLength(): number {
        return ElectronApplication.APP_MAX_NOTIFICATION_TITLE_LEN;
    }
    
    getNotificationTitleEllipsis(): string {
        return ElectronApplication.APP_NOTIFICATION_ELIPSIS;
    }

    refreshProfile(): ProfileEx {
        this.profile = this.profilesManager.getCurrentProfile();
        return this.profile;
    }

    writeTemplateFile(name: string, html: string): void {
        if (! fs.existsSync(this.getTmpAbsolutePath())) {
            fsExtra.mkdirsSync(this.getTmpAbsolutePath());
        }
        fs.writeFileSync(path.join(this.getTmpAbsolutePath(), name), html);
    }

    readTemplateFile(name: string): string {
        return fs.readFileSync(path.join(this.getTmpAbsolutePath()), name).toString()
    }

    getRenderedTemplateUrl(name: string): string {
        let ret = path.join(this.getTmpAbsolutePath(), name);
        // console.log("template path: ", ret);
        return ret;
    }

    askForMicrophoneAccess(): Q.Promise<boolean> {
        // console.log("electron chrome version", process.versions['chrome']);
        if (process.platform == "darwin") {
            return (<any>electron.systemPreferences).askForMediaAccess("microphone");

        }
        else {
            return Q.resolve(true);
        }
    }
    
    getAssetSafeUrl(path: string) {
        let assetPath = this.assetsManager.getAsset(path);
        if (!assetPath.startsWith("file://")) {
            return assetPath;
        }
        let content = fs.readFileSync(assetPath.substr(7));
        return WindowUrl.buildUrl("dektop-assets", MimeType.resolve(path), content);
    }
}
