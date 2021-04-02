import electron = require("electron");
import path = require("path");
import fs = require("fs");
import fse = require("fs-extra");
import * as LoggerModule from "simplito-logger";
import AutoLaunch = require("auto-launch");
import os = require("os");
import * as Q from "q";
import { HddStorage } from "../../../utils/HddStorage";
import { SqlStorage } from "../../../utils/SqlStorage";
import { ElectronApplication } from "../ElectronApplication";
import * as RootLogger from "simplito-logger";
import { Updater } from "../updater/Updater";
import { WindowUrl } from "../WindowUrl";
import { ElectronPartitions } from "../ElectronPartitions";
import * as PrivmxCrypto from "privmx-crypto";
import { WorkerManager } from "../crypto/WorkerManager";
import { CryptoService } from "../crypto/CryptoService";
import { ProfileEx } from "../profiles/Types";
import { ProfilesManager } from "../profiles/ProfilesManager";
import { SentryService } from "../sentry/SentryService";

(<any>global).privmxCoreModulePath = path.resolve(__dirname, "../../../build/core-electron.js");

export interface Logger {
    level: string;
    log: (level: string, ...args: any[]) => void;
}

export interface BaseConfig {
    devMode: boolean;
}

export interface GlobalShortcutConfigItem {
    actionName: string, accelerator: string;
}

export interface BindedErrorEvents {
    type: string;
    events: ErrorEvent[];
}

export interface ErrorEvent {
    referrer: string;
    action: Function;
}

export interface IUnhandledErrorsCatcher {
    updatePath(p: string): void
}
export class Starter {

    static readonly BASE_CONFIG_FILE: string = "devmode.json";
    static readonly BASE_SHORTCUTS_FILE: string = "shortcuts.json";
    static readonly CUSTOMIZATION_FILE: string = "customization.json";
    electron: typeof electron;
    app: Electron.App;
    logger: Logger;
    quitting: boolean;
    baseConfig: BaseConfig = { devMode: false };
    bindedErrorsEvents: { [type: string]: BindedErrorEvents } = {};
    errorCatcher: IUnhandledErrorsCatcher;
    workerManager: WorkerManager;
    instance: ElectronApplication;
    constructor() {
        this.electron = electron;
        this.app = electron.app;
        process.noDeprecation = true;
        this.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
        this.app.commandLine.appendSwitch("disable-smooth-scrolling");
        if (this.isDisableGPUAccelerationSet()) {
            this.app.commandLine.appendSwitch("disable-gpu");
        }
        this.app.commandLine.appendSwitch('disable-renderer-backgrounding');
        this.app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096 --expose_gc');
        this.app.commandLine.appendSwitch("ignore-certificate-errors");
        this.app.commandLine.appendSwitch('disable-site-isolation-trials');

        this.logger = createSimpleLogger("info");
        this.logger.log("debug", "creating starter", process.platform);
    }

    bindErrorEvent(type: string, referrer: string, action: Function): void {
        let list;
        if (type in this.bindedErrorsEvents) {
            list = this.bindedErrorsEvents[type];
            list.events.push({ referrer: referrer, action: action });
        }
        else {
            this.bindedErrorsEvents[type] = { type: type, events: [{ referrer: referrer, action: action }] };
        }
    }

    onErrorEvent(type: string): void {
        if (type in this.bindedErrorsEvents) {
            this.bindedErrorsEvents[type].events.forEach(x => {
                x.action();
            });
        }
    }


    fireCacheMigration(profile: ProfileEx): Q.Promise<void> {
        return Q().then(() => {
            //check for cache migration
            let sqlCacheFile = path.resolve(profile.storageAbsolutePath, "cache.db");
            if (fs.existsSync(sqlCacheFile)) {
                return Q.resolve();
            }
            else {
                let hddStorage: HddStorage = new HddStorage(profile.storageAbsolutePath);
                let sqlStorage: SqlStorage = new SqlStorage(profile.storageAbsolutePath);
                let insertPromise = Q.resolve<void>();
                let elements: Q.Promise<void>[] = [];

                return sqlStorage.init().then(() => {
                    return hddStorage.iterate((key, value) => {
                        let promise = Q(sqlStorage.setItemToDb(key, value));
                        elements.push(promise);
                    })
                        .then(() => {
                            elements.forEach(el => {
                                insertPromise = insertPromise.then(() => {
                                    return el;
                                })
                            });
                            return insertPromise;
                        })
                        .then(() => {
                            return hddStorage.iterate((key, value) => {
                                if (key.indexOf("cache.db") == -1) {
                                    let pathStr = path.resolve(profile.storageAbsolutePath, key);
                                    fs.unlinkSync(pathStr);
                                }
                            })
                        })
                })
            }
        })
    }


    isInDevMode() {
        let configFile = path.resolve(this.app.getPath("exe").replace(/\\/g, "/").split("/").slice(0, -1).join("/"), Starter.BASE_CONFIG_FILE);
        return process.execPath.replace(/\\/g, "/").split("/").indexOf("node_modules") != -1 || fs.existsSync(configFile);
    }

    isInUpdateMode(): boolean {
        return process.argv && process.argv.indexOf("--update") != -1;
    }

    isNoAutostart(): boolean {
        return process.argv && process.argv.indexOf("--no-autostart") != -1;
    }

    isNoMenuEntry(): boolean {
        return process.argv && process.argv.indexOf("--no-menu-entry") != -1;
    }

    isExpert(): boolean {
        return process.argv && process.argv.indexOf("--expert") != -1;
    }

    isDisableGPUAccelerationSet(): boolean {
        return process.argv && process.argv.indexOf("--no-gpu") != -1;
    }

    isLocalUpdateOnly(): boolean {
        return process.argv && process.argv.indexOf("--local-update") != -1;
    }

    isHelp(): boolean {
        return process.argv && process.argv.indexOf("--help") != -1;
    }

    showHelp(): void {
        console.log("--no-autostart\t\t\t\t\tdo not add PrivMX to system autostart");
        console.log("--allow-multiple-instances\t\t\tallow to start more then one instance of PrivMX in the same time");
        console.log("--no-menu-entry\t\t\tdo not add/update Applications menu entry");
        console.log("--no-gpu\t\t\tdisable GPU acceleration");
        console.log("--expert\t\t\talias for: --no-autostart and --allow-multiple-instances and --no-menu-entry");

    }

    allowMultipleInstances(): boolean {
        const paramName = "--allow-multiple-instances";
        return process.argv && process.argv.indexOf(paramName) != -1;
    }

    getForcedLogLevel(): any {
        const paramName = "--log-level";
        let matchingParams = process.argv.filter(x => x.indexOf(paramName) > -1);

        if (matchingParams) {
            let param = matchingParams[0];
            if (param) {
                let levelString = param.substring(param.indexOf("=") + 1);
                if (levelString.toUpperCase() == "DEBUG") {
                    return RootLogger.DEBUG;
                }
                if (levelString.toUpperCase() == "INFO") {
                    return RootLogger.INFO;
                }
                if (levelString.toUpperCase() == "WARN") {
                    return RootLogger.WARN;
                }
                if (levelString.toUpperCase() == "ERROR") {
                    return RootLogger.ERROR;
                }
                if (levelString.toUpperCase() == "OFF") {
                    return RootLogger.OFF;
                }
                return null;
            }

        }
    }

    getIsPerformanceLoggerEnabled(): boolean {
        let val = this.getCommandLineParam("perflog");
        return val === null ? null : (val == "1" || val == "true" || val == "on");
    }

    getPerformanceLoggerScheduledOpDelay(): number {
        let val = this.getCommandLineParam("perflog-opdelay");
        let delay = parseInt(val);
        return isNaN(delay) ? null : delay;
    }

    getPerformanceLoggerCaptureKeyPatterns(): string[] {
        let val = this.getCommandLineParam("perflog-patterns");
        return val ? val.split(",") : null;
    }

    getPerformanceLoggerOutputFilename(): string {
        return this.getCommandLineParam("perflog-file");
    }

    getCommandLineParam(paramName: string): string {
        let matchingParams = process.argv.filter(x => x.indexOf(paramName + "=") > -1);

        if (matchingParams) {
            let param = matchingParams[0];
            if (param) {
                return param.substr(param.indexOf("=") + 1);
            }
        }

        return null;
    }

    disableAutoStart() {
        return this.setupAutoStart(true);
    }

    setupAutoStart(disable?: boolean) {
        if (this.isInDevMode() || this.isInUpdateMode() || this.isNoAutostart() || this.isExpert()) {
            return;
        }
        let appName: string = process.platform != "darwin" ? "PrivMX Desktop Client" : Updater.DARWIN_APP_DIR.split(".")[0];
        let autoLauncher = new AutoLaunch({ name: appName, isHidden: true});
        if ((<any>autoLauncher).opts) {
            (<any>autoLauncher).opts.appName = appName;
            if (process.platform == "darwin") {
                (<any>autoLauncher).opts.mac = {useLaunchAgent: false};
            }
        }

        autoLauncher.isEnabled()
            .then(isEnabled => {
                if (isEnabled && disable === true) {
                    return autoLauncher.disable();
                }
                else if (isEnabled == false && disable == false) {
                    return autoLauncher.enable();
                }
            })
            .catch(err => {
                this.logger.log("error", "Error during setup auto launcher: ", err);
            });
    }

    run(): void {
        if (this.isHelp()) {
            this.showHelp();
            process.exit(0);
        }
    }
    
    onUrl(request: electron.ProtocolRequest, callback: (response: Buffer | electron.ProtocolResponse) => void) {
        //console.log("onURL", request.url?request.url.substr(0, 100):undefined)
        let vidConfService = ElectronApplication.instance ? ElectronApplication.instance.videoConferencesService : null;
        if (vidConfService && vidConfService.isUrlInKnownDomain(request.url)) {
            const netRequest = electron.net.request({
                method: request.method,
                protocol: "https:",
                hostname: request.url.split("://")[1].split("/")[0],
                port: 443,
                path: "/" + request.url.replace("https://", "").split("/").splice(1).join("/"),
            });
            for (let h in request.headers) {
                netRequest.setHeader(h, request.headers[h]);
            }
            netRequest.on("response", (response) => {
                let respBuff = new Buffer("");
                response.on("data", data => {
                    respBuff = Buffer.concat([respBuff, data])
                })
                response.on("end", () => {
                    callback(respBuff);
                });
            });
            netRequest.write(request.uploadData[0].bytes);
            netRequest.end();
            return;
        }
        if (request.url.endsWith(".js.map")) {
            callback({mimeType: "application/json", data: Buffer.from("{}", "utf8")});
            return 
        }
        let u = WindowUrl.parseUrl(request.url);
        // console.log("Load url from custom protocol", request.url.substr(0, 60) + "...", {
        //     protocol: u.protocol,
        //     host: u.host,
        //     path: u.path,
        //     m: u.m,
        //     d: u.d.substr(0, 30) + "..."
        // });
        callback({mimeType: u.m, data: Buffer.from(u.d, "base64")});
    }
    
    onFile(request: electron.ProtocolRequest, callback: (response: string | electron.ProtocolResponse) => void): void {
        //console.log("onFile", request.url?request.url.substr(0, 100):undefined)
        callback(unescape(request.url.replace("file:///", "").split("?")[0]));
    }
    
    initCrypto() {
        this.workerManager = new WorkerManager(path.resolve(__dirname, "../crypto/CryptoWorker.js"));
        this.workerManager.addWorkers(os.cpus().length);
        let cryptoService = new CryptoService(this.workerManager);
        PrivmxCrypto.service.init();
        PrivmxCrypto.service.handlers.splice(6, 0, cryptoService)
    }

    startApp(): void {
        this.logger.log("debug", "starting app");
        
        if (WindowUrl.PROTOCOL != "https" && WindowUrl.PROTOCOL != "http") {
            (<any>electron.protocol).registerSchemesAsPrivileged([
                {
                    scheme: WindowUrl.PROTOCOL,
                    privileges: {
                        standard: true,
                        secure: true,
                        bypassCSP: true,
                        allowServiceWorkers: true,
                        supportFetchAPI: true,
                        corsEnabled: true
                    }
                }
            ]);
        }
        
        //this.initCrypto();

        this.app.on('window-all-closed', () => {
            this.app.quit();
        });

        this.app.on('before-quit', () => {
            this.quitting = true;
        });
        
        this.app.on('will-quit', () => {
            if (this.workerManager) {
                this.workerManager.stop();
            }
        });

        this.app.on("ready", () => {
            
            let httpsSecureContextPartition = electron.session.fromPartition(ElectronPartitions.HTTPS_SECURE_CONTEXT);
            
            if (WindowUrl.PROTOCOL == "https" || WindowUrl.PROTOCOL == "http") {
                httpsSecureContextPartition.protocol.interceptBufferProtocol(WindowUrl.PROTOCOL, this.onUrl.bind(this));
            }
            else {
                httpsSecureContextPartition.protocol.registerBufferProtocol(WindowUrl.PROTOCOL, this.onUrl.bind(this));
            }
            electron.protocol.registerFileProtocol("file", this.onFile.bind(this));
            httpsSecureContextPartition.protocol.registerFileProtocol("file", this.onFile.bind(this));
            
            if (process.platform == "win32" && !this.isInUpdateMode()) {
                let shortcutPath = process.env.APPDATA + "\\Microsoft\\Windows\\Start Menu\\Programs\\" + (this.isInDevMode() ? "PrivMX Dev" : "PrivMX") + ".lnk";
                let scRes = electron.shell.writeShortcutLink(shortcutPath, {
                    target: process.execPath
                });
                this.app.setAppUserModelId(process.execPath);
            }
            else if (process.platform == "linux" && !this.isInDevMode() && !this.isInUpdateMode() && !this.isNoMenuEntry() && !this.isExpert()) {
                const appsPath = require("os").homedir() + "/.local/share/applications/";
                const executablePath = this.app.getPath("exe");
                const executableDir = path.resolve(executablePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/"));
                const resourcePath = path.join(executableDir, "resources");
                const iconPath = path.join(resourcePath, "app-icon.png");
                // const privMxDir = process.execPath.substr(0, process.execPath.length - 7);
                const privMxAppFileName = "privmx.desktop";
                try {
                    fse.ensureDirSync(appsPath);
                    if (fs.existsSync(appsPath)) {
                        let cnt = fs.readFileSync(path.join(resourcePath, privMxAppFileName), "utf8");
                        cnt = cnt.replace(/{{APP_PATH}}/g, executablePath).replace(/{{ICON_PATH}}/g, iconPath);
                        fs.writeFileSync(path.join(appsPath, privMxAppFileName), cnt);
                        fs.chmodSync(path.join(appsPath, privMxAppFileName), 0o755);
                    }
                }
                catch (e) {
                    console.error(e);
                }
            }

            // let ElectronApplication = require("../ElectronApplication");

            let Logger = <typeof LoggerModule>require("simplito-logger");
            //let i18nify = <typeof i18nifyModule>require('../../../gulp/i18nify');

            Logger.setLevel(Logger.WARN);

            Logger.get("simplito-net").setLevel(Logger.WARN);
            Logger.get("privfs-mail-client.utils.Event").setLevel(Logger.WARN);
            Logger.get("privfs-mail-client.utils.EncryptedPromiseMap").setLevel(Logger.WARN);
            Logger.get("privfs-mail-client.utils.WebStorage").setLevel(Logger.WARN);
            Logger.get("privfs-client.gateway.PrivFsSessionGateway").setLevel(Logger.DEBUG);
            Logger.get("privfs-mail-client.app.electron.ElectronApplication").setLevel(Logger.DEBUG);

            //i18nify.i18nify.nodeRegistryExtension();

            //privfs.crypto.Service.init();
            ProfilesManager.create(this.isInDevMode()).then(profilesManager => {
                let profile = profilesManager.getCurrentProfile();
                this.bindErrorCatcher(profile);
                // this.fireCacheMigration(profile)
                this.instance = ElectronApplication.create(this, profile, profilesManager);
                return profile;
            })
            .then(profile => {
                let autostartEnabled = profile.isAutostartEnabled();
                this.setupAutoStart(! autostartEnabled);
            })
            .catch(err => {
                this.logger.log("error", "Error during creating profiles manager", err);
            });
        });
    }

    bindErrorCatcher(profile: ProfileEx): void {
        this.errorCatcher = null;  
        let errorCatcher = new UnhandledErrorsCatcher(profile, this.isInDevMode());
        errorCatcher.onErrorEvent = this.onErrorEvent.bind(this);
        this.errorCatcher = errorCatcher;
    }
}


class UnhandledErrorsCatcher implements IUnhandledErrorsCatcher{
    static readonly F_NAME: string = "error.log"
    onErrorEvent: (type: string) => void;
    logsPath: string;
    unhandledRes = require("electron-unhandled");

    constructor(public profile: ProfileEx, devMode: boolean, public silentMode: boolean = true) {
        this.logsPath = this.getLogsPath(profile.absolutePath);
        if (!fse.existsSync(this.logsPath)) {
            fse.mkdirsSync(this.logsPath);
            fs.writeFileSync(path.resolve(this.logsPath, UnhandledErrorsCatcher.F_NAME), "[" + new Date().toUTCString() + "] PrivMX errorlog file created.\n\n", 'utf8');
        }
        
        SentryService.initSentry(
            devMode, 
            this.profile.isErrorsLoggingEnabled()
        );

        this.unhandledRes({ logger: (args: any) => {
            SentryService.captureException(args);
            this.catchUnhandledErrors(args);
        }, showDialog: !this.silentMode });
    }

    getLogsPath(basePath: string) {
        return path.join(basePath, "logs");
    }

    updatePath(p: string): void {
        this.logsPath = this.getLogsPath(p);
        if (!fse.existsSync(this.logsPath)) {
            fse.mkdirsSync(this.logsPath);
        }
    }

    catchUnhandledErrors(args: any) {
        if (args.stack.indexOf("User doesn\'t exist") > -1 && this.onErrorEvent) {
            this.onErrorEvent("USER_DOESNT_EXISTS");
            return;
        }

        if (args.stack.indexOf("User blocked") > -1 && this.onErrorEvent) {
            this.onErrorEvent("USER_BLOCKED");
            return;
        }


        let errTime = (new Date()).toLocaleString();
        try {
            fs.appendFileSync(path.resolve(this.logsPath, UnhandledErrorsCatcher.F_NAME), "\n[" + errTime + "] " + args.stack + "\n", 'utf8');
        }
        catch (e) {
            console.log("error in catchUnhandledError", e);
        }
    }

}

function debugLog(...entry: any[]): void {

    let logPath = path.join(path.resolve(os.homedir(), ".privmx"), "debug.log");
    let newLine = process.platform === 'win32' ? "\r\n" : "\n";
    try {
        fs.appendFileSync(logPath, "[" + (new Date().toLocaleString()) + "] " + entry.map(x => x.toString()).join(" ") + newLine);
    }
    catch(e) {
        console.log("cannot access log file");
    }
}


function createSimpleLogger(level?: string): Logger {
    let logPath = path.join(process.env.USERPROFILE || process.env.HOME, "privmx-desktop-client.log");
    let newLine = process.platform === 'win32' ? "\r\n" : "\n";
    let levels = ["debug", "info", "warn", "error"];
    return {
        level: level || "error",
        log: function (level: string) {
            if (levels.indexOf(level) < levels.indexOf(this.level)) {
                return;
            }
            let msg = Array.prototype.slice.call(arguments, 1).join(" ");
            let entry = [level.toUpperCase(), new Date().toLocaleString(), msg].join(" - ");
            fs.appendFileSync(logPath, entry + newLine);
        }
    };
}
