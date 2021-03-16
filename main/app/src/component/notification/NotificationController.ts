import {ComponentController} from "../base/ComponentController";
import {app} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface NotificationEntryOptions {
    autoHide?: boolean;
    progress?: boolean;
    duration?: number;
    extraCssClass?: string;
}

export class NotificationController extends ComponentController {
    
    static textsPrefix: string = "component.notification.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    notificationId: number;
    
    constructor(parent: app.IpcContainer) {
        super(parent);
        this.notificationId = 0;
        this.ipcMode = true;
    }
    
    showNotification(label: string, options?: NotificationEntryOptions): number {
        let id = this.notificationId++;
        this.callViewMethod("showNotification", id, label, options);
        return id;
    }
    
    progressNotification(id: number, progress: any): void {
        this.callViewMethod("progressNotification", id, progress);
    }
    
    hideNotification(id: number): void {
        this.callViewMethod("hideNotification", id);
    }
    
}

