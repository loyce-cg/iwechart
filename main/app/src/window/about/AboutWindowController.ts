import {BaseWindowController} from "../base/BaseWindowController";
import {app, event} from "../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    version: string;
    updateVersion: string;
    config: app.ConfigEx;
    updateAvailable: boolean;
    updateReadyToInstall: boolean;
    isElectron: boolean;
}

export class AboutWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.about.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    config: app.ConfigEx;
    identity: privfs.identity.Identity;
    lastProgressStatus: app.UpdaterProgressStatus;
        
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname, null, null, "basic");
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 600;
        this.openWindowOptions.height = 430;
        this.openWindowOptions.title = this.i18n("window.about.title");
        this.openWindowOptions.icon = "icon ico-question-mark";
        this.openWindowOptions.resizable = false;
        // this.openWindowOptions.backgroundColor = "#292929";
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
            version: this.app.getVersion().str,
            updateVersion: updateVersion,
            config: this.config,
            updateAvailable: updateAvail,
            updateReadyToInstall: updateReadyToInstall,
            isElectron: this.app.isElectronApp(),
        };
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewDownloadDesktop(): void {
        this.app.openUrl(this.config.desktopDownloadUrl);
    }
    
    onViewFeedback(): void {
        let version = this.app.getVersion();
        let data = {
            host: this.identity.host ? this.identity.host : "",
            user: this.identity ? this.identity.user : "",
            engine: this.app.isElectronApp() ? "electron" : this.app.getBrowser().nameWithVersion(),
            version: version ? version.str : ""
        };
        this.app.openUrl(this.config.feedbackUrl + "?data=" + Buffer.from(JSON.stringify(data)).toString("hex"));
    }
    
    onViewUpdateAction(action: string): void {
        setTimeout(() => {
            if (action == "download-updates") {
                if (this.app.isElectronApp()) {
                    if ((<any>this.app).updater) {
                        this.lastProgressStatus = "checking";
                        (<any>this.app).updater.downloadUpdate(this.onUpdateProgress.bind(this))
                        .then(() => {
                            this.callViewMethod("setUpdateStatus", "readyToInstall");
                        })
                        .fail((e: any) => console.log(e));
                    }
                }
            }
            else if (action == "install-updates") {
                if (this.app.isElectronApp()) {
                    if ((<any>this.app).updater) {
                        (<any>this.app).updater.startUpdate();
                    }
                }
                
            }
            else if (action == "check-for-update") {
                if (this.app.isElectronApp()) {
                    if ((<any>this.app).updater) {
                        (<any>this.app).updater.checkForUpdate().fin(() => {
                            this.redrawView();
                        });
                    }
                }
            }
        }, 100);
    }
    
    onUpdateProgress(status: app.UpdaterProgressStatus, downloaded: number, total: number): void {
        if (this.lastProgressStatus == status && this.lastProgressStatus != "downloading") {
            return;
        }
        this.lastProgressStatus = status;
        if (status == "downloading" && total > 0) {
            this.callViewMethod("setDownloadProgress", Math.round(downloaded * 100 / total));
            
        }
        this.callViewMethod("setUpdateStatus", status);
    }
    
    redrawView(): void {
        this.callViewMethod("redraw", JSON.stringify(this.getModel()));
    }
    
    onViewPerformRevert(): void {
        if (this.app.isElectronApp()) {
            Q().then(() => {
                return this.revertConfirm()
            })
            .then(revertConfirmed => {
                if (revertConfirmed && (<any>this.app).updater) {
                    (<any>this.app).updater.startRevert();
                }
                return;

            })
        }
    }
    
    revertConfirm(): Q.IWhenable<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            return this.confirmEx({
                message: this.i18n("window.about.performRevert"),
                yes: {
                    faIcon: "trash",
                    btnClass: "btn-warning",
                    label: this.i18n("window.about.performRevert.confirm")
                },
                no: {
                    faIcon: "",
                    btnClass: "btn-default",
                    label: this.i18n("core.button.cancel.label")
                }
            })
            .then(result => {
                defer.resolve(result.result == "yes");
            });
        });
        return defer.promise;
    }
    
    onViewShowLicence(): void {
        this.app.openLicenceWindow();
    }

}
