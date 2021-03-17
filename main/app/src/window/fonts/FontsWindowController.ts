import {BaseWindowController} from "../base/BaseWindowController";
import {app, event} from "../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    txt: string;
}

export class FontsWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.fonts.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    config: app.ConfigEx;
    identity: privfs.identity.Identity;
    lastProgressStatus: app.UpdaterProgressStatus;
    txt: string = "My private calendar0123456789@";
        
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 1200;
        this.openWindowOptions.height = 860;
        this.openWindowOptions.title = "Fonts";
        this.openWindowOptions.icon = "icon ico-question-mark";
        this.openWindowOptions.resizable = true;
    }
    
    init() {
        return Q().then(() => {
            this.bindEvent<event.UpdateStatusChangeEvent>(this.app, "update-status-change", event => {
                if (event.status == "downloading") {
                    this.callViewMethod("setDownloadProgress", Math.round(event.downloaded * 100 / event.total));
                    if (this.lastProgressStatus != event.status) {
                        this.lastProgressStatus = event.status;
                        this.callViewMethod("setUpdateStatus", event.status);
                    }
                }
                else
                if (event.status != "new-version-info") {
                    this.callViewMethod("setUpdateStatus", event.status);
                }
            });

            if (!this.app.mailClientApi) {
                return null;
            }
            return Q.all([
                this.app.mailClientApi.privmxRegistry.getUserConfig(),
                this.app.mailClientApi.privmxRegistry.getIdentity()
            ]);
        })
        .then(res => {
            this.config = res ? res[0] : <any>{};
            this.identity = res ? res[1] : null;
        });
    }
    
    getModel(): Model {
        let updateAvail: boolean = false;
        let updateReadyToInstall: boolean = false;
        let updateVersion: string = "";
        if (this.app.isElectronApp()) {
            if ((<any>this.app).updater) {
                let updatesInfo = (<any>this.app).updater.getUpdatesInfo();
                let versionData = updatesInfo && updatesInfo.versionData || null;
                updateAvail = versionData && versionData.version !== null;
                updateReadyToInstall = updatesInfo && updatesInfo.readyToInstall;
                updateVersion = versionData ? versionData.version : "";
            }
        }
        return {
            txt: this.txt,
        };
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewSetText(): void {
        this.prompt("New text", this.txt).then(res => {
            if (res.result == "ok") {
                this.txt = res.value;
                this.callViewMethod("setModel", JSON.stringify(this.getModel()));
            }
        });
    }
    

}
