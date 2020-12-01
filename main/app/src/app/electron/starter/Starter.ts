import electron = require("electron");
import path = require("path");
import fs = require("fs");
import fse = require("fs-extra");
import * as privfs from "privfs-client";
import * as LoggerModule from "simplito-logger";
import AutoLaunch = require("auto-launch");
import os = require("os");
import * as Q from "q";
import { HddStorage } from "../../../utils/HddStorage";
import { SqlStorage } from "../../../utils/SqlStorage";
import * as systeminformation from "systeminformation";
import { ElectronApplication, ProfileEx } from "../ElectronApplication";
//import i18nifyModule = require("../../../gulp/i18nify");
import * as RootLogger from "simplito-logger";
import { KeyboardShortcuts } from "../../common/KeyboardShortcuts";
import { Updater } from "../updater/Updater";
import { LocaleService } from "../../../mail";
import { WindowUrl } from "../WindowUrl";
import { ElectronPartitions } from "../ElectronPartitions";
import * as PrivmxCrypto from "privmx-crypto";
import { WorkerManager } from "../crypto/WorkerManager";
import { CryptoService } from "../crypto/CryptoService";

(<any>global).privmxCoreModulePath = path.resolve(__dirname, "../../../build/core-electron.js");

export interface Logger {
    level: string;
    log: (level: string, ...args: any[]) => void;
}

export interface Profile {
    name: string;
    path: string;
    pathIsRelative: boolean;
    lang?: string;
    licenceAccepted?: boolean;
    loginInfoVisible?: boolean;
    ccApiEndpoint?: string;
    autostartEnabled?: boolean;
}

export interface Profiles {
    initProfile: string;
    devInitProfile: string;
    deviceIdSeed: string;
    profiles: { [name: string]: Profile }
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
    errorCatcher: UnhandledErrorsCatcher;
    workerManager: WorkerManager;

    constructor() {
        this.electron = electron;
        this.app = electron.app;
        process.noDeprecation = true;
        this.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
        this.app.commandLine.appendSwitch("disable-smooth-scrolling");
        this.app.commandLine.appendSwitch("disable-gpu");
        this.app.commandLine.appendSwitch('disable-renderer-backgrounding');
        this.app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')

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

    isHelp(): boolean {
        return process.argv && process.argv.indexOf("--help") != -1;
    }

    showHelp(): void {
        console.log("--no-autostart\t\t\t\t\tdo not add PrivMX to system autostart");
        console.log("--allow-multiple-instances\t\t\tallow to start more then one instance of PrivMX in the same time");
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
        if (this.isInDevMode() || this.isInUpdateMode() || this.isNoAutostart()) {
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
                if (isEnabled) {
                    return;
                }
                return autoLauncher.enable()
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
    
    onUrl(request: electron.RegisterBufferProtocolRequest, callback: (buffer?: Buffer | electron.MimeTypedBuffer) => void) {
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
            
            if (process.platform == "win32" && !this.isInUpdateMode()) {
                let shortcutPath = process.env.APPDATA + "\\Microsoft\\Windows\\Start Menu\\Programs\\" + (this.isInDevMode() ? "PrivMX Dev" : "PrivMX") + ".lnk";
                let scRes = electron.shell.writeShortcutLink(shortcutPath, {
                    target: process.execPath
                });
                this.app.setAppUserModelId(process.execPath);
            }
            else if (process.platform == "linux" && !this.isInDevMode() && !this.isInUpdateMode()) {
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
                ElectronApplication.create(this, profile, profilesManager);
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
        this.errorCatcher = new UnhandledErrorsCatcher(profile.absolutePath);
        this.errorCatcher.onErrorEvent = this.onErrorEvent.bind(this);
    }
}

export class ProfilesManager {
    basePath: string;
    profilesPath: string;
    profilesConfigPath: string;
    profiles: Profiles;
    onNewProfileHandlers: ((absPath: string) => void)[] = [];
    deviceId: string;

    constructor(
        public isInDevMode: boolean
    ) {
        this.basePath = path.resolve(os.homedir(), ".privmx");
        this.profilesPath = path.resolve(this.basePath, "profiles");
        this.profilesConfigPath = path.resolve(this.basePath, "profiles.json");
        fse.mkdirsSync(this.basePath);
        fse.mkdirsSync(this.profilesPath);
        if (fs.existsSync(this.profilesConfigPath)) {
            this.profiles = JSON.parse(fs.readFileSync(this.profilesConfigPath, "utf8"));
            if (!this.profiles.deviceIdSeed) {
                this.profiles.deviceIdSeed = this.generateDeviceIsSeed();
                this.dumpProfiles();
            }

            if (isInDevMode && !this.profiles.initProfile) {
                let devProfile: Profile;
                devProfile = this.createProfile();
                this.profiles.profiles[devProfile.name] = devProfile;
                this.profiles.devInitProfile = devProfile.name;
                this.dumpProfiles();
            }

            if (!this.isProfileLanguageSet()) {
                this.setProfileLanguage();
            }
        }
        else {
            // let oldPrivmxStoragePath = path.resolve(os.homedir(), ".privmx-storage");
            // let oldDevPrivmxStoragePath = path.resolve(os.homedir(), ".privmx-dev-storage");
            this.profiles = {
                devInitProfile: null,
                initProfile: null,
                deviceIdSeed: this.generateDeviceIsSeed(),
                profiles: {}
            };
            let initProfile = this.createProfile();
            this.profiles.profiles[initProfile.name] = initProfile;
            this.profiles.initProfile = initProfile.name;
            // let devProfile: Profile;
            // if (fs.existsSync(oldDevPrivmxStoragePath)) {
            //     devProfile = this.createProfile();
            //     this.profiles.profiles[devProfile.name] = devProfile;
            //     this.profiles.devInitProfile = devProfile.name;
            // }
            this.dumpProfiles();
            // this.copyOldStorage(initProfile, oldPrivmxStoragePath);
            // this.copyOldStorage(devProfile, oldDevPrivmxStoragePath);
        }

    }

    isProfileLanguageSet(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].lang != null;
    }

    isLicenceAccepted(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].licenceAccepted == true;
    }

    isAutostartEnabled(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].autostartEnabled == true;
    }

    getCcApiEndpoint(): string {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].ccApiEndpoint ? this.profiles.profiles[profileName].ccApiEndpoint : null;
    }


    setLicenceAccepted(): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (profileName) {
            this.profiles.profiles[profileName].licenceAccepted = true;
        }
        this.dumpProfiles();
    }

    setAutostartEnabled(enabled: boolean): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (profileName) {
            this.profiles.profiles[profileName].autostartEnabled = enabled;
        }
        this.dumpProfiles();
    }


    isLoginInfoVisible(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].loginInfoVisible !== false;
    }

    setLoginInfoHidden(): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (profileName) {
            this.profiles.profiles[profileName].loginInfoVisible = false;
        }
        this.dumpProfiles();
    }



    setProfileLanguage(lang?: string): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;

        if (profileName) {
            this.profiles.profiles[profileName].lang = lang ? lang : this.getDefaultLangCode();
        }

        this.dumpProfiles();
    }

    getLangCode(locale: string): string {
        let sep: number = locale.indexOf("-");
        if (sep >= 0) {
            return locale.substr(0, sep);
        }
        return locale;
    }

    getProfileLanguage(): string {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (!(profileName in this.profiles.profiles)) {
            console.log("Trying to read profile language but given profile ", profileName, "does not exists. Fallback to system locale.");
            return this.getDefaultLangCode();
        }
        return this.profiles.profiles[profileName].lang;
    }
    
    getDefaultLangCode(): string {
        let langCode = this.getLangCode(electron.app.getLocale());
        if (LocaleService.canUseAsDefaultLanguage(langCode)) {
            return langCode;
        }
        return LocaleService.DEFAULT_LANG_CODE;
    }

    static create(isInDevMode: boolean): Q.Promise<ProfilesManager> {
        let profilesManager: ProfilesManager;
        return Q().then(() => {
            profilesManager = new ProfilesManager(isInDevMode);
            return ProfilesManager.getDeviceId(profilesManager.profiles.deviceIdSeed);
        })
            .then(deviceId => {
                profilesManager.deviceId = deviceId;
                return profilesManager
            });
    }

    generateDeviceIsSeed(): string {
        return privfs.crypto.serviceSync.randomBytes(10).toString("hex");
    }

    static getDeviceId(deviceIdSeed: string): Q.Promise<string> {
        return Q().then(() => {
            return systeminformation.uuid();
        })
            .then(uuid => {
                let cpus = os.cpus();
                let hardwareInfo = deviceIdSeed + ":" + cpus.length + ":" + (cpus.length == 0 ? "" : cpus[0].model) + ":" + uuid.os;
                return privfs.crypto.service.sha256(Buffer.from(hardwareInfo, "utf8"));
            })
            .then(hash => {
                return hash.slice(0, 16).toString("hex");
            });
    }

    onNewProfile(handler: (absPath: string) => void) {
        this.onNewProfileHandlers.push(handler);
    }

    // copyOldStorage(profile: Profile, oldStoragePath: string) {
    //     if (profile != null && fs.existsSync(oldStoragePath)) {
    //         let profileEx = this.prepareProfile(profile);
    //         fse.copySync(oldStoragePath, profileEx.storageAbsolutePath, {overwrite: true});
    //     }
    // }

    createProfile(): Profile {
        let profileName: string;
        let profilePath: string;
        do {
            profileName = privfs.crypto.serviceSync.randomBytes(10).toString("hex");
            profilePath = path.resolve(this.profilesPath, profileName);
        }
        while (fs.existsSync(profilePath));
        fse.mkdirsSync(profilePath);
        let profile = {
            name: profileName,
            path: profileName,
            pathIsRelative: true,
            lang: this.getDefaultLangCode(),
        };
        return profile;
    }

    getCurrentProfile(): ProfileEx {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        let profile = this.profiles.profiles[profileName];
        if (profile == null) {
            profile = this.createProfile();
            this.profiles.profiles[profile.name] = profile;
            if (this.isInDevMode) {
                this.profiles.devInitProfile = profile.name;
            }
            else {
                this.profiles.initProfile = profile.name;
            }
            this.dumpProfiles();
        }
        return this.prepareProfile(profile);
    }

    prepareProfile(profile: Profile): ProfileEx {
        let absolutePath = profile.pathIsRelative ? path.resolve(this.profilesPath, profile.path) : profile.path;
        fse.mkdirsSync(absolutePath);
        let storageAbsolutePath = path.resolve(absolutePath, "storage");
        fse.mkdirsSync(storageAbsolutePath);
        let tmpAbsolutePath = path.resolve(absolutePath, "tmp");
        if (fse.existsSync(tmpAbsolutePath)) {
            try {
                fse.removeSync(tmpAbsolutePath);
            }
            catch (e) { }
        }
        fse.mkdirsSync(tmpAbsolutePath);

        let tmpShortcuts = KeyboardShortcuts.defaultShortcuts;
        if (fse.existsSync(path.resolve(absolutePath, "shortcuts-example.json"))) {
            fse.unlinkSync(path.resolve(absolutePath, "shortcuts-example.json"));
        }
        fse.writeFileSync(path.resolve(absolutePath, "shortcuts-example.json"), JSON.stringify(tmpShortcuts, null, 2), "utf8");


        return {
            name: profile.name,
            absolutePath: absolutePath,
            storageAbsolutePath: storageAbsolutePath,
            tmpAbsolutePath: tmpAbsolutePath,
            getLanguage: () => this.getProfileLanguage(),
            setLanguage: (lang: string) => {
                this.setProfileLanguage(lang);
            },
            isLicenceAccepted: () => this.isLicenceAccepted(),
            getCcApiEndpoint: () => this.getCcApiEndpoint(),
            setLicenceAccepted: () => this.setLicenceAccepted(),
            isLoginInfoVisible: () => this.isLoginInfoVisible(),
            setLoginInfoHidden: () => this.setLoginInfoHidden(),
            isAutostartEnabled: () => this.isAutostartEnabled(),
            setAutostartEnabled: (enabled: boolean) => this.setAutostartEnabled(enabled)
        };
    }

    dumpProfiles() {
        fs.writeFileSync(this.profilesConfigPath, JSON.stringify(this.profiles, null, 2), "utf8");
    }

    deleteCurrentProfile() {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        let profile = this.profiles.profiles[profileName];
        if (profile != null) {
            let absolutePath = profile.pathIsRelative ? path.resolve(this.profilesPath, profile.path) : profile.path;
            fse.removeSync(absolutePath);
            delete this.profiles.profiles[profile.name];
            if (this.isInDevMode) {
                this.profiles.devInitProfile = null;
            }
            else {
                this.profiles.initProfile = null;
            }
            this.dumpProfiles();
            let profile2 = this.getCurrentProfile();

            let basePath = profile2.storageAbsolutePath;
            for (let handler of this.onNewProfileHandlers) {
                handler(basePath);
            }
        }
    }
}

export class UnhandledErrorsCatcher {

    static readonly F_NAME: string = "error.log"
    onErrorEvent: (type: string) => void;
    logsPath: string;
    unhandledRes = require("electron-unhandled");

    constructor(basePath: string, public silentMode: boolean = true) {
        this.logsPath = this.getLogsPath(basePath);
        if (!fse.existsSync(this.logsPath)) {
            fse.mkdirsSync(this.logsPath);
            fs.writeFileSync(path.resolve(this.logsPath, UnhandledErrorsCatcher.F_NAME), "[" + new Date().toUTCString() + "] PrivMX errorlog file created.\n\n", 'utf8');
        }
        this.unhandledRes({ logger: (args: any) => {
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
