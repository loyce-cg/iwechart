import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import * as Q from "q";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { TextViewerWindowController } from "../textviewer/main";
import { Dependencies } from "../../utils/Decorators";
import { NotificationController } from "../../component/notification/NotificationController";

export interface UserAction {
    sendReport: boolean;
    includeErrorLog?: boolean;
    includeSystemInformation?: boolean;
}

export interface Model {
    error: app.Error;
    helpCenterUrl: string;
}

export interface ErrorWindowOptions {
    error: app.Error;
    errorLog?: string;
    systemInformation?: string;
}

@Dependencies(["notification"])
export class ErrorWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.error.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    protected options: ErrorWindowOptions;
    protected resultDeferred: Q.Deferred<UserAction> = Q.defer<UserAction>();
    protected notifications: NotificationController;
    protected sendingNotificationId: number = null;
    
    constructor(parent: app.WindowParent, options: ErrorWindowOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.options = options;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = this.guessWindowWidth();
        this.openWindowOptions.height = this.guessWindowHeight();
        this.openWindowOptions.title = this.i18n("window.error.title");
        this.openWindowOptions.icon = "fa fa-exclamation-triangle";
        this.openWindowOptions.resizable = true;
    }
    
    init() {
        return Q().then(() => {
        });
    }
    
    getModel(): Model {
        return {
            error: this.options.error,
            helpCenterUrl: this.options.error.helpCenterCode ? this.app.getHelpCenterUrl(this.options.error.helpCenterCode) : null,
        };
    }
    
    getPromise(): Q.Promise<UserAction> {
        return this.resultDeferred.promise;
    }
    
    onViewSetWindowHeight(height: number): void {
        super.onViewSetWindowHeight(height);
        this.nwin.setResizable(false);
    }
    
    onViewSend(includeErrorLog: boolean, includeSystemInformation: boolean): void {
        this.sendingNotificationId = this.notifications.showNotification(this.i18n("window.error.notifications.sending"), {autoHide: false, progress: true});
        this.resultDeferred.resolve({
            sendReport: true,
            includeErrorLog: includeErrorLog,
            includeSystemInformation: includeSystemInformation,
        });
    }
    
    onViewDontSend(): void {
        this.resultDeferred.resolve({
            sendReport: false,
        });
        this.close();
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewShowErrorLog(): void {
        this.app.ioc.create(TextViewerWindowController, [this, { title: this.i18n("window.error.errorLog.window.title"), text: this.options.errorLog }]).then(win => {
            return this.openChildWindow(win);
        });
    }
    
    onViewShowSystemInformation(): void {
        let systemInformation = JSON.stringify(JSON.parse(this.options.systemInformation), null, 4);
        this.app.ioc.create(TextViewerWindowController, [this, { title: this.i18n("window.error.systemInformation.window.title"), text: systemInformation }]).then(win => {
            return this.openChildWindow(win);
        });
    }
    
    afterReportSent(): void {
        this.notifications.hideNotification(this.sendingNotificationId);
        setTimeout(() => {
            this.notifications.showNotification(this.i18n("window.error.notifications.sent"), {autoHide: false, progress: false});
            setTimeout(() => {
                this.close();
            }, 2000);
        }, 800);
    }
    
    guessWindowWidth(): number {
        if (this.options.error.askToReport && this.options.error.helpCenterCode) {
            return 500;
        }
        else if (this.options.error.askToReport && !this.options.error.helpCenterCode) {
            return 500;
        }
        else if (!this.options.error.askToReport && this.options.error.helpCenterCode) {
            return 400;
        }
        else if (!this.options.error.askToReport && !this.options.error.helpCenterCode) {
            return 350;
        }
    }
    
    guessWindowHeight(): number {
        if (this.options.error.askToReport && this.options.error.helpCenterCode) {
            return 207;
        }
        else if (this.options.error.askToReport && !this.options.error.helpCenterCode) {
            return 207;
        }
        else if (!this.options.error.askToReport && this.options.error.helpCenterCode) {
            return 127;
        }
        else if (!this.options.error.askToReport && !this.options.error.helpCenterCode) {
            return 97;
        }
    }

}
