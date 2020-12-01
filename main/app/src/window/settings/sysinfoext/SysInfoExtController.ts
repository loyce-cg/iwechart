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
    };
}

export class SysInfoExtController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "sysInfoExt";
    
    @Inject sinkIndexManager: SinkIndexManager;
    @Inject localStorage: utils.IStorage;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.sinkIndexManager = this.parent.sinkIndexManager;
        this.localStorage = this.parent.localStorage;
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
                } : null,
            };
        })
        .then(() => {
            this.callViewMethod("renderContent", model);
        });
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
