import {ComponentController} from "../base/ComponentController";

import {app} from "../../Types";
import { UpdatesInfo } from "../../app/electron/updater/Updater";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";



export interface UpdateNotificationOptions {
    autoHide?: boolean;
    updatesInfo: UpdatesInfo;
    progress?: number;
    click(id: number, action: string):  void;
}

export interface UpdateNotificationViewOptions {
    autoHide?: boolean;
    version: string;
    updateAvail: boolean;
    updateReadyToInstall: boolean;
    forceUpdate: boolean;
    progress?: number;
    updateVersion: string;
}

export class UpdateNotificationController extends ComponentController {
    
    static textsPrefix: string = "component.updateNotification.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    notificationId: number = 0;
    lastProgressStatus: app.UpdaterProgressStatus;
    notifications: {[id: number]: UpdateNotificationOptions} = {};
    
    
    constructor(parent: app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
    createNotification(options: UpdateNotificationOptions): number {
        let id = this.notificationId++;
        this.notifications[id] = options;
        
        let version = options.updatesInfo && options.updatesInfo.versionData && options.updatesInfo.versionData.version || null;

        let viewOptions: UpdateNotificationViewOptions = {
            autoHide: options.autoHide,
            progress: options.progress,
            version: version,
            updateAvail: version !== null,
            updateReadyToInstall: options.updatesInfo && options.updatesInfo.readyToInstall,
            forceUpdate: options.updatesInfo && options.updatesInfo.versionData && options.updatesInfo.versionData.force || false,
            updateVersion: options.updatesInfo && options.updatesInfo.versionData && options.updatesInfo.versionData ? options.updatesInfo.versionData.version : ""
        }
        this.lastProgressStatus = "done";
        this.callViewMethod("createNotification", id, viewOptions);
        return id;
    }
        
    hideNotification(id: number): void {
        this.callViewMethod("hideNotification", id);
    }

    showNotification(id: number): void {
        this.callViewMethod("showNotification", id);
    }
    
    setStatus(id: number, status: string) {
        this.callViewMethod("setUpdateStatus", id, status);
    }
    
    onUpdateProgress(id: number, status: app.UpdaterProgressStatus, downloaded: number, total: number): void {
        if (this.lastProgressStatus == status && this.lastProgressStatus != "downloading") {
            return;
        }
        this.lastProgressStatus = status;
        if (status == "downloading" && total > 0) {
            let progress = Math.round(downloaded * 100 / total);
            this.callViewMethod("setProgress", id, progress);
        }
        this.callViewMethod("setUpdateStatus", id, status);
    }
    
    setReadyToInstall(id: number): void {
        this.callViewMethod("setUpdateStatus", id, "readyToInstall");
    }
    
    onViewAction(id: number, status: string): void {
        this.notifications[id].click(id, status);
    }
}

