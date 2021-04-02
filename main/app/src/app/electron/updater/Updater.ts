import * as nodeFs from "fs";
import * as extraFs from "fs-extra";
import * as crypto from "crypto";
import * as Q from "q";
import * as request from "request";
import * as path from "path";
import * as child_process from "child_process";
import * as extractZip from "extract-zip";
import * as privfs from "privfs-client";
import * as RootLogger from "simplito-logger";
import { ElectronApplication } from "../ElectronApplication";
import { app, event } from "../../../Types";
import { Logger } from "../starter/Starter";
import { SudoUtils } from "./SudoUtils";

let Logger = RootLogger.get("electron/updater");
Logger.setLevel(RootLogger.INFO);

export interface ConfigData {
    link: string;
}

export interface VersionData {
    version: string;
    file: string;
    checksum: string;
    signature: string;
    size: number;
    force?: boolean;
    checksum256?: string;
    signature256?: string;
}

export class UpdaterState {
    updatesCheckTimer: any;
    notifyAboutUpdates: boolean = true;
    visible: boolean = false;

    setVisible(visible: boolean) {
        this.visible = visible;
    }

    setNotify(notify: boolean) {
        this.notifyAboutUpdates = notify;
    }

    getNotify(): boolean {
        return this.notifyAboutUpdates;
    }

    isVisible(): boolean {
        return this.visible;
    }
}

export interface UpdatesInfo {
    versionData: VersionData;
    readyToInstall: boolean;
}

export class Updater {
    static UPDATE_TMP_FILE: string = "update_file.zip";
    static UPDATE_EXTRACT_DIR: string = "extractedUpdate";
    static UPDATE_OLD_APP_DIR: string = "old-version";
    static UPDATE_VERSION_FILE: string = "update_version_info.json";
    static UPDATE_LOCATION_FILE: string = "update_location.json";       // location of PrivMX current installation
    static UPDATE_CONFIG_FILE: string = "updates.json";
    static DARWIN_APP_DIR: string = "PrivMX.app";
    static DEFAULT_SERVER_UPDATES_LOCATION: string = "updater/repo/main";
    static FILE_LOGGING: boolean = true;
    testBreak: boolean = true;

    static onAfterUpdate: () => void;
    updatesInfo: UpdatesInfo;
    configData: ConfigData;
    needRevertAfterFail: boolean = false;

    constructor(public app: ElectronApplication, public privmxStoragePath: string, public profilePath: string) {
        this.configData = this.readConfigFile();
    }

    setConfigData(data: ConfigData) {
        this.configData = data;
    }

    readConfigFile(): ConfigData {
        this.log("Read config file ...");
        let configFile = path.resolve(this.privmxStoragePath, Updater.UPDATE_CONFIG_FILE);

        if (! nodeFs.existsSync(configFile)) {
            return null;
        }
        let config: ConfigData = null;
        try {
            config = <ConfigData>JSON.parse(nodeFs.readFileSync(configFile).toString());
        }
        catch(e) {
            this.log(this.getFileReadErrorMsg(configFile));
        }
        finally {
            if (Object.keys(config).indexOf("link") == -1 || config.link.length == 0) {
                this.log(this.getFileReadErrorMsg(configFile));
                return null;
            }
            return config;
        }
    }

    writeConfigFile(data: ConfigData): void {
        let configFile = path.resolve(this.privmxStoragePath, Updater.UPDATE_CONFIG_FILE);
        try {
            nodeFs.writeFileSync(configFile, JSON.stringify(data), "utf8");
        }
        catch(e) {
            this.log("Cannot write config file: ", configFile);
        }
    }

    isProtocolInAddr(url: string): boolean {
        return url && url.indexOf("http") == 0 || url.indexOf("https") == 0;
    }

    getRequestLink(): string {
        if (! this.configData ) {
            return null;
        }
        if (! this.isProtocolInAddr(this.configData.link)) {
            // force http for dev mode or https otherwise
            let protocol: string = this.app.inDevMode ? "http://" : "https://";
            this.configData.link = protocol + this.configData.link;
        }
        return this.configData.link.charAt(this.configData.link.length - 1) !== "/" ? this.configData.link + "/" : this.configData.link;
    }

    getRequestParams(): string {
        return "?v=" + this.app.getVersion().str + "&p=" + process.platform + this.getDeviceIdParam();
    }

    getDeviceIdParam(): string {
        return "&id=" + this.app.profilesManager.deviceId;
    }
    getDownloadLink(version: VersionData): string {
        return this.getRequestLink() + version.file + this.getDeviceIdParam();
    }

    //////////////////////////////////
    // LOCAL PATHS METHODS
    //////////////////////////////////

    getExtractedUpdateDir(): string {
        return path.join(this.privmxStoragePath, Updater.UPDATE_EXTRACT_DIR);
    }

    getUpdateTempExecutableFileName(): string {
        if (process.platform == "win32") {
            return "PrivMX-updater.exe";
        }
        return "PrivMX-updater";
    }

    getUpdateTempExecutablePath(): string {
        if (process.platform == "darwin") {
            throw new Error("No temp executable needed for darwin platform");
        }
        else
        if (process.platform == "win32") {
            let updateExecPath = this.getExecutablePath(this.getExtractedUpdateDir());
            let parts = updateExecPath.split(path.sep);
            parts.splice(-1);
            return path.join(parts.join(path.sep), this.getUpdateTempExecutableFileName());
        }
        else
        if (process.platform == "linux") {
            let updateExecPath = this.getExecutablePath(this.getExtractedUpdateDir());
            let parts = updateExecPath.split(path.sep);
            parts.splice(-1);
            return path.join(parts.join(path.sep), this.getUpdateTempExecutableFileName());

        }
    }

    getExecutablePath(installLocation: string): string {
        if (process.platform == "darwin") {
            return this.getExecutableFullPathRecursive(installLocation, "PrivMX.app");
        }
        else
        if (process.platform == "win32") {
            return this.getExecutableFullPathRecursive(installLocation, "PrivMX.exe");
        }
        else
        if (process.platform == "linux") {
            return this.getExecutableFullPathRecursive(installLocation, "PrivMX");
        }
    }

    getExecutableFullPathRecursive(startDir: string, execName: string): string | never {
        try {
            if (process.platform == "darwin" && startDir.indexOf(execName) == startDir.length - execName.length) {
                return startDir;
            }
            let files = nodeFs.readdirSync(startDir).filter(x => x != ".." && x != ".");
            let indexOf = files.indexOf(execName);
            if (indexOf > -1 && process.platform == "darwin" && execName.indexOf(".app") > -1) {
                return path.join(startDir, execName);
            }
            else
            if (indexOf > -1 && nodeFs.lstatSync(path.join(startDir, files[indexOf])).isFile()) {
                return path.join(startDir, execName);
            }
            else {
                return this.getExecutableFullPathRecursive(path.join(startDir, files[0]), execName);
            }
        }
        catch (e) {
            // this.reportError(this.getDirectoryAccessErrorMsg(startDir));
            throw new Error(this.getDirectoryAccessErrorMsg(startDir));
        }
    }

    getDownloadedPackagePath(): string {
        return path.join(this.privmxStoragePath, Updater.UPDATE_TMP_FILE);
    }

    getUpdateVersionFilePath(): string {
        return path.join(this.privmxStoragePath, Updater.UPDATE_VERSION_FILE);
    }

    getOldVersionDir(): string {
        if (process.platform == "darwin") {
            return path.join(this.privmxStoragePath, Updater.UPDATE_OLD_APP_DIR, Updater.DARWIN_APP_DIR);
        } else {
            return path.join(this.privmxStoragePath, Updater.UPDATE_OLD_APP_DIR);
        }
    }

    getProcessOutputLogPath(): string {
        return path.join(this.privmxStoragePath, "update.log");
        // return path.join(process.env.USERPROFILE || process.env.HOME, "privmx-desktop-client.log")
    }

    getLocationFilePath(): string {
        this.log("getLocationFilePath ...");
        return path.join(this.privmxStoragePath, Updater.UPDATE_LOCATION_FILE);
    }

    getApplicationSavedPath(): string | never {
        this.log("getAppLocationSavedPath ...");
        try {
            let appInstall = <{location: string}>JSON.parse(nodeFs.readFileSync(this.getLocationFilePath(), "utf8"));
            if (Object.keys(appInstall).indexOf("location") == -1 || appInstall.location.length == 0) {
                throw new Error("getApplicationSavedPath error: no path specified");
            }
            if (process.platform == "darwin") {
                return path.join(appInstall.location, Updater.DARWIN_APP_DIR);
            } else {
                return appInstall.location;
            }
        }
        catch(e) {
            this.log("GetLocationSavedPath error", e);
            // this.reportError(this.getFileReadErrorMsg(this.getLocationFilePath()));
            throw new Error(this.getFileReadErrorMsg(this.getLocationFilePath()));
        }
    }
    
    getCurrentAppPath(): string {
        let locationParts = this.app.appDir.split(path.sep);
        locationParts.splice(-3);
        if (process.platform == "darwin") {
                return path.join(locationParts.join(path.sep), Updater.DARWIN_APP_DIR);
        }
        else {
            return locationParts.join(path.sep);
        }
    }
    
    isAppStartedFromItsInstallPath(): boolean {
        return this.getApplicationSavedPath() == this.getCurrentAppPath();
    }

    isAppStartedFromExtractUpdatePath(): boolean {
        return this.getCurrentAppPath().indexOf(this.getExtractedUpdateDir()) > -1;
    }


    isInQuarantine(): boolean {
        return process.platform == "darwin" && this.app.execPath.indexOf("AppTranslocation") > -1;
    }

    getDarwinAppDirName(): string {
        let locationParts = this.app.appDir.split(path.sep);
        return locationParts.filter(x => x.indexOf(".app") == (x.length - ".app".length) )[0];
    }

    //////////////////////////
    // FILES I/O METHODS
    //////////////////////////

    prepareFilesBeforeUpdater(): void | never {
        try {
            if (process.platform == "darwin") {
                return;
            }
            this.log("Call cpFiles on: ", this.getExecutablePath(this.getExtractedUpdateDir()), this.getUpdateTempExecutablePath());
            this.cpFiles(this.getExecutablePath(this.getExtractedUpdateDir()), this.getUpdateTempExecutablePath());
            try {
                nodeFs.chmodSync(this.getUpdateTempExecutablePath(), 0o775);
            }
            catch (ex) {
                throw new Error("Cannot set permissions for file: " + this.getUpdateTempExecutablePath());
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }
    
    makeAppCopyBeforeInstall(): void {
        let stepDesc: string = "Making app copy before install";
        this.log(stepDesc + " - removing old backup ...");
        // if (process.platform == "darwin") {
        //     let oldVersionDir = this.getOldVersionDir();
        //     this.log("oldVersionDir: ", oldVersionDir);
        //     this.log("getCurrentAppPath", this.getCurrentAppPath());
        //     let appInstallDir = this.getApplicationSavedPath();
        //     this.log("appInstallDir", appInstallDir);
        //     process.exit();
        // }
        // else {
            let oldVersionDir = this.getOldVersionDir();
            if (nodeFs.existsSync(oldVersionDir)) {
                this.removeAppFiles(oldVersionDir);
            }
            let appInstallDir = this.getApplicationSavedPath();
            this.log(stepDesc + " - creating backup of current app ...");
            this.cpFiles(appInstallDir, this.getOldVersionDir());
            
        // }
    }

    copyUpdateFilesToAppLocation(): void | never {
        let appInstallDir = this.getApplicationSavedPath();
        let keepAsar = process.noAsar;
        try {
            this.log("Copying files to app location: ");
            process.noAsar = true;
            // 1. remove old-version && copy app -> old-version
            this.makeAppCopyBeforeInstall();
            // 2. remove app && copy extracted -> app
            this.removeAppFiles(appInstallDir);
            this.needRevertAfterFail = true;

            // get parent of extracted update executable and copy from there to install dir
            let updateExecutablePath = this.getExecutablePath(this.getExtractedUpdateDir());
            this.log("updateExecutablePath", updateExecutablePath);
            this.log("extractedUpdateDir", this.getExtractedUpdateDir());
            let parentPath = process.platform == "darwin" ? updateExecutablePath : path.resolve(updateExecutablePath, "..");

            // this.cpFiles(this.getExecutablePath(this.getExtractedUpdateDir()), appInstallDir);
            this.cpFiles(parentPath, appInstallDir, [this.getUpdateTempExecutableFileName()]);
            process.noAsar = keepAsar;
        }
        catch(e) {
            process.noAsar = keepAsar;
            throw new Error(e);
        }
    }

    revertUpdate(): void | never {
        this.log("Reverting changes ...");
        let keepAsar = process.noAsar;
        try {
            process.noAsar = true;
            // 1. remove old-version && copy app -> old-version
            let oldVersionDir = this.getOldVersionDir();
            let appInstallDir = this.getApplicationSavedPath();
            this.removeAppFiles(appInstallDir);
            this.cpFiles(oldVersionDir, appInstallDir);
            process.noAsar = keepAsar;
        }
        catch(e) {
            process.noAsar = keepAsar;
            throw new Error("Cannot revert update ...");
        }
    }


    removeAppFiles(dir: string): void | never {
        let currentlyRemovingFile: string = "";
        this.log("Removing app files from " + dir + " ...");
        try {
            let files = nodeFs.readdirSync(dir).filter(x => x != ".." && x != ".");

            files.forEach(file => {
                let filePath = path.join(dir, file);
                // this.log("Removing: " + filePath);
                currentlyRemovingFile = filePath;
                extraFs.removeSync(filePath);
            })
        }
        catch(ex) {
            throw new Error("error removing app files." + currentlyRemovingFile + " | stackTrace: " + JSON.stringify(ex));
        }
    }
    

    cpFiles(src: string, dest: string, ignoreFileNames: string[] = []): void | never {
        process.noAsar = true;

        try {
            let fileStat = nodeFs.lstatSync(src);

            if (fileStat.isDirectory() && ! nodeFs.existsSync(dest)) {
                try {
                    (<any>extraFs).mkdirSync(dest, {recursive: true});
                } catch (e) {
                    // this.reportError(this.getDirectoryWriteErrorMsg(dest));
                    throw new Error(this.getDirectoryWriteErrorMsg(dest, e));
                }
            }
            else
            
            if (fileStat.isSymbolicLink()) {
                this.log("Copy link: " + src + " => " + dest);
                try {
                    extraFs.copySync(src, dest, {dereference: false});
                    return;
                } catch (e) {
                    // this.reportError("Error copying files: " + src + " => " + dest);
                    throw new Error("Error copying files: " + src + " => " + dest);
                }
            }
            else
            if (fileStat.isFile()){
                // this.log("Copy file: " + src + " => " + dest);
                try {
                    extraFs.copySync(src, dest);
                } catch (e) {
                    // this.reportError("Error copying files: " + src + " => " + dest);
                    throw new Error("Error copying files: " + src + " => " + dest);
                }
                try {
                    nodeFs.chmodSync(dest, nodeFs.lstatSync(src).mode);
                } catch (e) {
                    // this.reportError("Cannot set permissions for file: " + dest);
                    throw new Error("Cannot set permissions for file: " + dest);
                }
                return;
            }

            let dirs = nodeFs.readdirSync(src).filter(x => x != ".." && x != "." && ignoreFileNames.indexOf(x) == -1);
            dirs.forEach(file => {
                let srcPath = path.join(src, file);
                let destPath = path.join(dest, file);
                let fileStat = nodeFs.lstatSync(srcPath);

                if (fileStat.isDirectory()) {
                    try {
                        this.cpFiles(srcPath, destPath, ignoreFileNames);
                    }
                    catch(e) {
                        throw new Error("Error copying files: " + srcPath + " => " + destPath);
                    }
                }
                else
                if (fileStat.isSymbolicLink()) {
                    this.log("Copy link: " + srcPath + " => " + destPath);
                    try {
                        extraFs.copySync(srcPath, destPath, {dereference: false});
                    } catch (e) {
                        // this.reportError("Error copying files: " + srcPath + " => " + destPath);
                        throw new Error("Error copying files: " + srcPath + " => " + destPath);
                    }
                }
                else
                if(fileStat.isFile()){
                    // this.log("Copy file: " + srcPath + " => " + destPath);
                    try {
                        extraFs.copySync(srcPath, destPath);
                    } catch (e) {
                        // this.reportError("Error copying files: " + srcPath + " => " + destPath);
                        throw new Error("Error copying files: " + srcPath + " => " + destPath);
                    }
                    try {
                        nodeFs.chmodSync(destPath, fileStat.mode);
                    } catch (e) {
                        // this.reportError("error: cannot set permission for file: " + destPath);
                        throw new Error("error: cannot set permission for file: " + destPath);
                    }
                }
            })
            
        }
        catch (ex) {
            // this.reportError("Cannot copy files from: " + src + " to " + dest + ". Update aborted.");
            throw new Error(ex);
        }

    }

    
    onExtractEntry(data: any): void {}

    unlinkRecursive(fpath: string): void | never {
        try {
            if (fpath == path.sep) {
                return;
            }
            if (nodeFs.existsSync(fpath)) {
                nodeFs.readdirSync(fpath).forEach((file, index) => {
                    let curPath = path.join(fpath, file);
                    if (nodeFs.lstatSync(curPath).isDirectory()) {
                        this.unlinkRecursive(curPath);
                    }
                    else {
                        nodeFs.unlinkSync(curPath);
                    }
                });
                nodeFs.rmdirSync(fpath);
            }
        }
        catch(e) {
            throw new Error("Cannot remove files recursively: " + fpath);
        }
    }


    //////////////////////////
    // UPDATE LOGIC METHODS
    //////////////////////////

    startProcessDetached(fileName: string, args: string[]): void | never {
        let extArgs: string[] = [...args];

        let resultFilename: string = fileName;
        if (process.platform == "darwin") {
            resultFilename = "open";
            extArgs = ["-n", "-a", fileName, "--args"].concat(args);    
        }
        try {
            const out = nodeFs.openSync(this.getProcessOutputLogPath(), "a");
            const err = nodeFs.openSync(this.getProcessOutputLogPath(), "a");
            const proc = child_process.spawn(resultFilename, extArgs, {detached: true, stdio: ["ignore", out, err]});
            proc.unref();
        }
        catch(e) {
            // this.reportError("Cannot restart app. Some files are missing or app has no access to them.");
            throw new Error("Cannot restart app. Some files are missing or app has no access to them.");
        }
    }


    async checkForUpdate(onlyLocally?: boolean): Promise<VersionData> {
        let requestLink = this.getRequestLink();
        if (! requestLink) {
            Logger.warn("No update config available.");
            return null;
        }

        try {
            if (onlyLocally) {
                const downloadedVersion = this.getDownloadedVersion();
                if (downloadedVersion) {
                    this.notifyAboutNewVersion(downloadedVersion, "readyToInstall");
                    return;
                }
            }

            const versions = await this.getVersionsFromServer();
            if (! this.versionsDatasetValid(versions)) {
                this.log("Versions dataset corrupted.");
                return null;
            }
    
            let lastVersion = versions[versions.length-1];
            
            // check version on server
            const newVersionOnServer = this.hasNewVersionOnServer(lastVersion);
            if (newVersionOnServer) {
                if (this.isVersionDownloadedAlready(lastVersion)) {
                    this.notifyAboutNewVersion(lastVersion, "readyToInstall");
                }
                else {
                    this.notifyAboutNewVersion(lastVersion, "new-version-info");
                }
            }
            return newVersionOnServer ? lastVersion : null;
        }
        catch (e) {
            this.log("Error checking for update");
        }

    }

    private getCurrentVersion(): string {
        return this.app.getVersion().str;
    }

    private hasNewVersionOnServer(lastVersion: VersionData): boolean {
        if (lastVersion && lastVersion.version !== this.getCurrentVersion()) {
            this.log("found new version on update server.. " + lastVersion.version);
            return true;
        }
        return false;
    }

    private isVersionDownloadedAlready(versionFromServer: VersionData): boolean {
        const versionFile = this.getUpdateVersionFilePath();
        if (nodeFs.existsSync(versionFile)) {
            let downloadedVersion = <VersionData>JSON.parse(nodeFs.readFileSync(versionFile, "utf8"));

            if (downloadedVersion && downloadedVersion.version == versionFromServer.version) {
                this.log("Found locally downloaded version..." + downloadedVersion.version);
                return true;
            }
            return false;
        }
    }


    private getDownloadedVersion(): VersionData {
        const versionFile = this.getUpdateVersionFilePath();
        if (nodeFs.existsSync(versionFile)) {
            let downloadedVersion = <VersionData>JSON.parse(nodeFs.readFileSync(versionFile, "utf8"));

            if (downloadedVersion && downloadedVersion.version) {
                this.log("Found locally downloaded version..." + downloadedVersion.version);
                return downloadedVersion;
            }
            return null;
        }
    }


    private notifyAboutNewVersion(lastVersion: VersionData, status: "readyToInstall" | "new-version-info"): void {
        this.setUpdatesInfo(lastVersion, status == "readyToInstall");
        this.emitStatusChangeEvent(status);
    }


    private getVersionsFromServer(): Promise<VersionData[]> {
        return new Promise<VersionData[]>((resolve, reject) => {
            request.get(this.getRequestLink() + this.getRequestParams(),{json: true}, (err, res, body) => {
                const statusCode = res && res.statusCode;
                const contentType = res && res.headers['content-type'];
                let error;
                if (statusCode !== 200) {
                    error = new Error('Request Failed.\n' + `Status Code: ${statusCode}, ${res}`);
                }
                else
                if (contentType.indexOf("application/json") == -1) {
                    error = new Error('Invalid content-type.\n' + `Expected application/json but received ${contentType}`);
                }
                if (error) {
                    return reject(error);
                }
                if (err) {
                    return reject(err);
                }
                if (body) {
                    try {
                        let dataToRet: VersionData[] = [];
                        for (let v in body) {
                            dataToRet.push(<VersionData>body[v]);
                        }
                        if (this.versionsDatasetValid(dataToRet)) {
                            return resolve(dataToRet);
                        }
                        else {
                            this.log("Versions dataset corrupted.");
                            return resolve(null);
                        }
                    }
                    catch (e) {
                        reject(e)
                    }
                }
            });    
        })        
    }


    downloadUpdate(progress: (status: app.UpdaterProgressStatus, downloaded?: number, total?: number) => void, updateWithVersion?: VersionData) {
        this.log("Start downloading update ...");
        let withVersion = updateWithVersion ? updateWithVersion : this.getUpdatesInfo().versionData;
        let keepAsarValue = process.noAsar;
        process.noAsar = true;
        //*** files / dirs access validation
        const dest = this.getDownloadedPackagePath();

        if (nodeFs.existsSync(dest)) {
            try {
                nodeFs.unlinkSync(dest);
            }
            catch(e) {
                this.reportError(this.getFileAccessErrorMsg(dest));
                return Q.reject(this.getFileAccessErrorMsg(dest));
            }
        }

        let destDir = this.getExtractedUpdateDir();

        try {
            if (nodeFs.existsSync(destDir)) {
                this.unlinkRecursive(destDir);
            }
            nodeFs.mkdirSync(destDir);
        }

        catch (e) {
            this.reportError(this.getDirectoryWriteErrorMsg(destDir));
            return Q.reject(this.getDirectoryWriteErrorMsg(destDir));
        }

        this.emitStatusChangeEvent("downloading", 0, withVersion.size);
        progress("downloading", 0, withVersion.size);
        return Q().then(() => {
            let defer = Q.defer<void>();

            let file: nodeFs.WriteStream;
            try {
                file = nodeFs.createWriteStream(dest);
            }
            catch (e) {
                this.reportError(this.getFileAccessErrorMsg(dest));
                defer.reject(e);
            }
            let downloadedBytes: number = 0;
            let download = request(this.getDownloadLink(withVersion));
            download.on("data", chunk => {
                // file.write(chunk);
                downloadedBytes += chunk.length;
                this.emitStatusChangeEvent("downloading", downloadedBytes, withVersion.size);
                progress("downloading", downloadedBytes, withVersion.size);
            });
            download.on("end", () => {
                file.close();
                this.emitStatusChangeEvent("verify");
                progress("verify");
                return Q().then(() => {
                    let sum: string;
                    let sig: string;
                    let algorithm: string;
                    if (withVersion.checksum256 && withVersion.signature256) {
                        sum = withVersion.checksum256;
                        sig = withVersion.signature256;
                        algorithm = "sha256";
                    }
                    else {
                        sum = withVersion.checksum;
                        sig = withVersion.signature;
                        algorithm = "sha1";
                    }
                    return this.verifyFile(sum, sig, algorithm, this.getDownloadedPackagePath());
                })
                .then(verified => {
                    if (! verified) {
                        Logger.error("File verification failed.");
                        this.emitStatusChangeEvent("error");
                        progress("error");
                        return defer.reject("File verification failed.");
                    }
                    this.emitStatusChangeEvent("extracting");
                    progress("extracting");
                    extractZip(this.getDownloadedPackagePath(), {dir: destDir, onEntry: this.onExtractEntry.bind(this)}, (err) => {
                        if (err) {
                            this.emitStatusChangeEvent("error");
                            progress("error");
                            return defer.reject(err);
                        }
                        // keep new version info in file
                        const dest = path.resolve(this.privmxStoragePath, Updater.UPDATE_VERSION_FILE);
                        try {
                            if (nodeFs.existsSync(dest)) {
                                nodeFs.unlinkSync(dest);
                            }
                            nodeFs.writeFileSync(dest, JSON.stringify(withVersion), {encoding: "utf8"});
                            this.updatesInfo.readyToInstall = true;
                            this.emitStatusChangeEvent("readyToInstall");
                            defer.resolve();

                        }
                        catch (e) {
                            this.reportError(this.getFileAccessErrorMsg(dest));
                            defer.reject(e);
                        }
                    })
                });
            });
            download.pipe(file);
            return defer.promise;
        })
        .fin(() => {
            process.noAsar = keepAsarValue;
        })
    }

    restartAfterUpdate(): void {
        this.log("Restarting after update ...");
        try {
            const locationFile = this.getLocationFilePath();
            if (! nodeFs.existsSync(locationFile)) {
                this.log("cannot find location file path");
                // this.reportError("Cannot find app location file: " + this.getLocationFilePath());
                throw new Error("Cannot find app location file: " + this.getLocationFilePath());
            }
            // let newApp = <{location: string}>JSON.parse(nodeFs.readFileSync(locationFile, "utf8"));

            let newInstancePath = this.getExecutablePath(this.getApplicationSavedPath());
            this.log("getApplicationSavedPath", this.getApplicationSavedPath());
            this.log("newInstancePath: ", newInstancePath);
            this.startProcessDetached(newInstancePath, []);
            process.exit();
        }
        catch(e) {
            this.reportError(e.message);
        }
    }


    // Fires when user click Revert
    startRevert(): void {
        this.log("Start revert update ...");
        try {
            let newInstancePath = this.getExecutablePath(this.getOldVersionDir());
            this.log("[Revert] Starting app from ", newInstancePath, " as reverter...");
            this.startProcessDetached(newInstancePath, ["--revert"]);
            this.log("[Revert] Exiting main process", this.getCurrentAppPath());
            process.exit();
        }
        catch(ex) {
            this.reportError(ex.message);
        }
    }



    // Fires when user click Install update
    startUpdate(): void {
        this.log("Start intalling update ...");
        try {
            let keepAsarValue = process.noAsar;
            process.noAsar = true;

            // keep old version location in file
            let locationParts = this.app.appDir.split(path.sep);

            const locationFile = this.getLocationFilePath();
            if (nodeFs.existsSync(locationFile) && ! this.app.isRunningInDevMode()) {
                try {
                    nodeFs.unlinkSync(locationFile);
                }
                catch(e) {
                    throw new Error(this.getFileAccessErrorMsg(locationFile));
                }
            }

            let newInstancePath = this.getExecutablePath(this.getExtractedUpdateDir());
            if (process.platform == "darwin") {
                locationParts.splice(-3);
            }
            let myLocation = locationParts.join(path.sep);

            if (! this.app.isRunningInDevMode()) {
                try {
                    nodeFs.writeFileSync(locationFile, JSON.stringify({location: myLocation}), {encoding: "utf8"});
                }
                catch(e) {
                    throw new Error("Cannot write location file: " + locationFile);
                }
            }

            process.noAsar = keepAsarValue;

            this.log("Preparing files ...");
            this.prepareFilesBeforeUpdater();
            this.log("Starting app in update mode ... ");
            this.startProcessDetached(newInstancePath, ["--update"]);
            process.exit();    
        }
        catch(ex) {
            this.reportError(ex.message);
        }
    }

    // Fires when application start in update mode (as updater)
    installUpdate(): void {
        this.log("InstallUpdate: Start updating in update mode ...");
        let myLocation = this.getApplicationSavedPath();
        let oldVersionDir = this.getOldVersionDir();

        this.log("checking if sudo is needed..", myLocation, "and", oldVersionDir);
        let sudoUtils = new SudoUtils();
        sudoUtils.onLog = this.log.bind(this);
        sudoUtils.onErrorLog = this.log.bind(this);

        this.log("sudo check of [myLocation]: ", myLocation);
        this.log("sudo check of [oldVersionDir]: ", oldVersionDir);
        if (
            ! this.app.state.updateAsSudo
            && (
                process.platform == "win32" 
                || (! this.isDirectoryAccessibleRecursive(myLocation) || ! this.isDirectoryAccessibleRecursive(oldVersionDir) || ! this.areTopLevelFilesAccessible(myLocation))
            )
        ) {

            let newInstancePath: string;
            let args: string[] = ["--update", "--sudo"];
            if (process.platform == "darwin") {
                newInstancePath = path.join(this.getExecutablePath(this.getExtractedUpdateDir()), "Contents","MacOS", "PrivMX");
            }
            else {
                newInstancePath = this.getExecutablePath(this.getExtractedUpdateDir());
            }
            this.log("Start updater in sudo: " + [newInstancePath, ...args].join(" "));

            Q().then(() => {
            // process.platform == "linux" ? sudoUtils.runAsSudoLinux(newInstancePath, args) : sudoUtils.runAsSudo(newInstancePath, ["-n"].concat(args, "--update"))
                return process.platform == "linux" ? sudoUtils.runAsSudoLinux(newInstancePath, args, this.getProcessOutputLogPath()) : sudoUtils.runAsSudo(newInstancePath, args)
            })
            .then(() => {
                this.log("Updater finished ------------------------------------------");
                Updater.onAfterUpdate();
            })
            .fail(err => {
                this.reportError("Error. Cannot start updater in sudo mode.." + err);
            })
        }
        else {
            this.log("Start updating with full rights..");
        // Wait for old app to close and for main window to show up
            setTimeout(() => {
                try {
                    this.copyUpdateFilesToAppLocation();
                    if (this.app.state.updateAsSudo) {
                        process.exit();
                    }
                    else {
                        Updater.onAfterUpdate();
                    }
                }
                catch(e) {
                    this.log("installUpdate error", e);
                    try {
                        if (this.needRevertAfterFail) {
                            this.log("need reverting");
                            this.revertUpdate();
                        }
                        this.reportError("Update failed. All changes have been reverted. Go to www.privmx.com and install the latest version of PrivMX app from there.");
                    }
                    catch(ex) {
                        this.reportError(ex.message);
                    }
                }
            }, 5000);
        }

    }

    performRevert(): void {
        // this method should be called in a process that was started from separate folder (other than app install dir) just to perform revert operation and close afterwards.
        this.log("[Revert] Start in revert mode ...");
        // Wait for old app to close and for main window to show up
        setTimeout(() => {
            try {
                this.log("[Revert] reverting version..")
                this.revertUpdate();
                Updater.onAfterUpdate();
            }
            catch(e) {
                this.log("Revert error");
                this.reportError("Revert failed.");
            }
        }, 5000);
    }


    emitStatusChangeEvent(status: app.UpdaterProgressStatus, downloaded?: number, total?: number): void {
        this.app.dispatchEvent<event.UpdateStatusChangeEvent>({type: "update-status-change", status: status, downloaded: downloaded, total: total});
    }

    setUpdatesInfo(versionData: VersionData, readyToInstall?: boolean) {
        this.updatesInfo = {
            versionData: versionData,
            readyToInstall: readyToInstall === true
        }
    }

    getUpdatesInfo(): UpdatesInfo {
        return this.updatesInfo;
    }

    verifyFile(checksum: string, signature: string, algorithm: string, fileName: string): Q.Promise<boolean> {
        this.log("Verifying file ...");
        return Q().then(() => {
            // verify checksum
            let shasum = crypto.createHash(algorithm);
            let readStream = nodeFs.createReadStream(fileName);
            let defer = Q.defer<boolean>();

            readStream.on("error", (err: Error) => {
                Logger.error(err);
                defer.reject(err);
            });

            readStream.on("data", (chunk: any) => {
                shasum.update(chunk)
            });

            readStream.on("end", () => {
                let digest = shasum.digest("hex");
                if (digest.toString() == checksum) {
                    // verify signature
                    let pubKey = privfs.crypto.ecc.PublicKey.fromBase58DER("8aH2iJpr1b6xVd6KTLtXgyh3ShLYqGTYeFvYqwPxLNt3ojVRZx");
                    return privfs.crypto.service.verifyCompactSignature(pubKey, new Buffer(checksum, "hex"), new Buffer(signature, "hex"))
                    .then(verified => {
                        defer.resolve(verified);
                    })
                }
                else {
                    defer.reject("Incorrect checksum");
                }
            });
            return defer.promise;
        })
        .fail(e => {
            Logger.error(e);
            return false;
        });
    }

    hasFileAccess(dir: string): boolean {
        try {
            nodeFs.accessSync(dir, nodeFs.constants.W_OK);
            return true;
        }
        catch(e) {
            return false;
        }
    }

    areTopLevelFilesAccessible(dir: string): boolean {
        let accessible = true;
        if (! nodeFs.existsSync(dir)) {
            this.log("areTopLevelFilesAccessible - cannot check, dir "+dir+" does not exists.");
            return true;
        }
        let files = (<any>nodeFs).readdirSync(dir, {withFileTypes: true});
        files.filter((x: any) => x.name != ".." && x.name != ".").map((x: any) => path.join(dir, x.name)).forEach((x: string) => {
            if (! this.hasFileAccess(x)) {
                accessible = false;
                this.log("Cannot access: ", x);
                return;
            }
        })
        return accessible;
    }    


    isDirectoryAccessibleRecursive(dir: string): boolean {
        let accessible = true;
        if (! nodeFs.existsSync(dir)) {
            return true;
        }
        let files = (<any>nodeFs).readdirSync(dir, {withFileTypes: true});
        files.filter((x: any) => x.isDirectory()).map((x: any) => path.join(dir, x.name)).forEach((x: string) => {
            if (! this.hasFileAccess(x)) {
                accessible = false;
                this.log("Cannot access: ", x);
                return;
            }
            else {
                if (accessible) {
                    accessible = this.isDirectoryAccessibleRecursive(x);
                }
            }
        })
        return accessible;
    }    

    /////////////////////////////////
    // ERRORS HANDLING HELPERS
    /////////////////////////////////
    ensureFileOrAbort(fileName: string): void {
        if (! nodeFs.existsSync(fileName)) {
            this.reportError("File: " + fileName + " does not exists.");
        }
    }

    ensureDirectoryWritableOrAbort(dir: string): void {
        if (! nodeFs.existsSync(dir)) {
            this.reportError(this.getDirectoryWriteErrorMsg(dir));
        }
        let randomFile = path.join(dir, "lock" + (new Date().getTime().toString()));
        try {
            nodeFs.writeFileSync(randomFile, "x");
        }
        catch(e) {
            this.reportError(this.getDirectoryWriteErrorMsg(dir));
        }
        nodeFs.unlinkSync(randomFile);
    }

    getFileReadErrorMsg(fileName: string): string {
        return "Cannot read file: " + fileName + ". File exists but app has no rights to read it or file is corrupted.";
    }

    getFileAccessErrorMsg(fileName: string): string {
        return "Cannot access file: " + fileName + ". File exists but app has no rights to access it.";
    }

    getDirectoryWriteErrorMsg(dir: string, e?: any): string {
        let msg = "Cannot write to: " + dir + ". Directory does not exist or app has no rights to write to it. ";
        if (e) {
            msg += " (" + e + ")";
        }
        return msg;
    }

    getDirectoryAccessErrorMsg(dir: string): string {
        return "Cannot access contents of: " + dir + ". Directory does not exist or app has no rights to access it.";
    }

    versionsDatasetValid(versions: VersionData[]): boolean {
        let fields = ["version", "file", "checksum", "signature", "size"];
        if (! Array.isArray(versions)) {
            return false;
        }
        let exists = true;
        versions.forEach(x => {
            let keys = Object.keys(x);
            fields.forEach(field => {
                if (keys.indexOf(field) == -1 || ((<any>x)[field]).toString().length == 0) {
                    exists = false;
                    return;
                }
            })
        })
        return exists;
    }


    /////////////////////////////////
    // DEBUG METHODS
    /////////////////////////////////

    showPathsDebug(): void {
        console.log("packageFilePath", this.getDownloadedPackagePath());
        console.log("extractedUpdateDir", this.getExtractedUpdateDir());
        console.log("extractedExecutable", this.getExecutablePath(this.getExtractedUpdateDir()));
        console.log("oldVersionDir", this.getOldVersionDir());

    }

    lockError(msg?: string): void {
        if (msg) {
            let keepLog = Updater.FILE_LOGGING;
            Updater.FILE_LOGGING = true;
            this.log(msg);
            Updater.FILE_LOGGING = keepLog;
        }
        this.app.msgBox.alert(this.app.localeService.i18n("core.updater.error.lock")).then(() => {
            process.exit();
        })
    }

    reportError(msg: string): void {
        let keepLog = Updater.FILE_LOGGING;
        Updater.FILE_LOGGING = true;
        this.log("ERROR", msg);
        Logger.error(msg);
        Updater.FILE_LOGGING = keepLog;

        this.app.msgBox.alert(msg).then(() => {
            process.exit();
        })
    }

    log(...entry: string[]): void {
        // console.log("[" + (new Date().toLocaleString()) + "] " + entry.join(" "));
        if (! Updater.FILE_LOGGING) {
            return;
        }
        let logPath = this.getProcessOutputLogPath();
        let newLine = process.platform === 'win32' ? "\r\n" : "\n";
        try {
            nodeFs.appendFileSync(logPath, "[" + (new Date().toLocaleString()) + "] " + entry.join(" ") + newLine);
        }
        catch(e) {
            this.reportError("Cannot access log file: " + logPath);
        }
    }
}
