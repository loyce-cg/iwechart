import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import * as Q from "q";
import {BrowserDetection} from "../../../web-utils/BrowserDetection";
import {PromiseUtils} from "simplito-promise";
import {SinkIndexManager} from "../../../mail/SinkIndexManager";
import {Inject} from "../../../utils/Decorators";
import {utils} from "../../../Types";
import {EncryptedStorage} from "../../../utils/EncryptedStorage";
import { ElectronApplication } from "../../../app/electron/ElectronApplication";
import { SqlStorage } from "../../../utils/SqlStorage";
import { DiskUtils } from "../../../app/electron/DiskUtils";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    browser: {
        nameWithVersion: string;
        os: string;
    };
    screenResolution: string;
    electronSysInfo: {
        chromeVersion: string,
        electronVersion: string,
        nodeVersion: string,
        v8Version: string,
        
        arch: string,
        hostname: string,
        platform: string,
        osType: string,
        osRelease: string,
        
        totalMem: number,
        cpus: string[],
        
        deviceId: string,
    };
    storageType: string;
    messagesCount: number;
    storageUsage: number;
    tempFilesInfo: {
        size: number;
        count: number;
    }
}

export class SysInfoController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "sysInfo";
    
    @Inject sinkIndexManager: SinkIndexManager;
    @Inject localStorage: utils.IStorage;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.sinkIndexManager = this.parent.sinkIndexManager;
        this.localStorage = this.parent.localStorage;
    }
    
    countMessages(): number {
        let count = 0;
        this.sinkIndexManager.indexes.forEach(index => {
            count += index.entries.size();
        });
        return count;
    }
    
    calculateStorageUsage(): Q.Promise<number> {
        let size = 0;
        return Q().then(() => {
            let keys: string[] = [];
            let storage = <EncryptedStorage>this.sinkIndexManager.storage;
            this.sinkIndexManager.indexes.forEach(index => {
                index.entries.forEach(entry => {
                    let key = index.getEntryStorageKey(entry);
                    keys.push(key);
                });
            });
            return PromiseUtils.oneByOne(keys, (_i, key) => {
                return Q().then(() => {
                    return storage.hashKey(key);
                })
                .then(hash => {
                    size += hash.length;
                    return storage.map.getItem(hash);
                })
                .then(value => {
                    size += value.length;
                });
            });
        })
        .then(() => {
            return size;
        });
    }
    
    calculateTotalStorageUsage(): Q.Promise<number> {
        let size = 0;
        return Q().then(() => {
            let storage = (<EncryptedStorage>this.sinkIndexManager.storage).map;
            return storage.iterate((value, key) => {
                size += value.length + key.length;
            });
        })
        .then(() => {
            return size;
        });
    }
    
    prepare(): Q.Promise<void> {
        let model: Model;
        return Q().then(() => {
            const os = this.app.isElectronApp() ? require("os") : null;
            let browser = this.app.getBrowser();
            model = {
                browser: browser ? {
                    nameWithVersion: browser.nameWithVersion(true),
                    os: browser.os().toString(),
                } : null,
                screenResolution: this.app.getScreenResolutionString(),
                electronSysInfo: this.app.isElectronApp() ? {
                    chromeVersion: process.versions.chrome,
                    electronVersion: process.versions.electron,
                    nodeVersion: process.versions.node,
                    v8Version: process.versions.v8,
                    
                    arch: os.arch(),
                    hostname: os.hostname(),
                    platform: os.platform(),
                    osType: os.type(),
                    osRelease: os.release(),
                    
                    totalMem: os.totalmem(),
                    cpus: this.getCpus(os),
                    
                    deviceId: (<any>this.app).profilesManager.deviceId,
                } : null,
                storageType: (<EncryptedStorage>this.localStorage).map.getStorageType(),
                messagesCount: this.countMessages(),
                storageUsage: 0,
                tempFilesInfo: this.app.isElectronApp() ? {
                    count: (<any>this.app).getDiskUtils().getFilesCount((<any>this.app).profile.tmpAbsolutePath),
                    size: (<any>this.app).getDiskUtils().getDirectorySize((<any>this.app).profile.tmpAbsolutePath)
                } : null
            };
            return this.calculateStorageUsage();
        })
        .then(size => {
            model.storageUsage = size;
            this.callViewMethod("renderContent", model);
        });
    }
    
    onViewClearCacheAndLogout(): void {
        Q().then(() => {
            return this.parent.confirm();
        })
        .then(choice => {
            if (choice.result != "yes") {
                return;
            }
            return Q().then(() => {
                if (this.app.isElectronApp()) {
                    return Q().then(() => {
                        return (<SqlStorage>(<ElectronApplication>this.app).storage).closeDb();
                    })
                    .then(() => {
                        return (<ElectronApplication>this.app).profilesManager.deleteCurrentProfile();
                    })
                    .then(() => {
                        let electronApp = (<ElectronApplication>this.app);
                        let profile = electronApp.refreshProfile();
                        electronApp.starter.errorCatcher.updatePath(profile.absolutePath);
                        // return (<SqlStorage>this.app.storage).init();
                    })
                }
                else {
                    return Q().then(() => {
                        return this.app.storage.clear();
                    });
                }
            })
            .then(() => {
                this.app.dataCleared = true;
                this.parent.logout();
                this.parent.close();
            });
        });
    }
    
    onViewClearTempFiles(): void {
        if (this.app.isElectronApp()) {
            (<any>this.app).cleanupTempFiles();
            this.prepare();
        }
    }
    
    getCpus(os: any): string[] {
        let cpus: string[] = [];
        for (let cpu of os.cpus()) {
            if (cpus.indexOf(cpu.model) < 0) {
                cpus.push(cpu.model);
            }
        }
        return cpus;
    }
}
