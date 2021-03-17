import {BaseWindowController} from "../base/BaseWindowController";
import {app, event} from "../../Types";
import * as Q from "q";
import { LocaleService, MailConst } from "../../mail";
import { i18n } from "./i18n";
import { TextViewerWindowController } from "../textviewer/main";
import { Dependencies } from "../../utils/Decorators";
import { NotificationController } from "../../component/notification/NotificationController";
import { UserProfileSettingChangeEvent } from "../../app/electron/profiles/Types";

export interface UserAction {
    sendReport: boolean;
    includeErrorLog?: boolean;
    includeSystemInformation?: boolean;
}


export interface Model {
    error: app.Error;
    helpCenterUrl: string;
    errorsLoggingEnabled: boolean;
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
    protected errorsLoggingEnabled: boolean = false;


    constructor(parent: app.WindowParent, options: ErrorWindowOptions) {
        super(parent, __filename, __dirname, null, null, "basic");
        this.ipcMode = true;
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.options = options;
        //override helpCenter option (as not implemented yet)
        this.options.error.helpCenterCode = undefined;
        
        this.openWindowOptions.position = "center";
        this.openWindowOptions.title = this.i18n("window.error.title");
        this.openWindowOptions.icon = "fa fa-exclamation-triangle";
        this.openWindowOptions.resizable = true;
        this.openWindowOptions.minHeight = 270;
        this.openWindowOptions.minWidth = 570;
        this.openWindowOptions.height = 250;
        this.openWindowOptions.width = 570;
    }
    
    init() {
        return Q().then(() => {
            this.bindErrorsLoggingChangeEvent();
            return (<any>this.app).isErrorsLoggingEnabled();
        })
        .then(loggingEnabled => {
            this.errorsLoggingEnabled = loggingEnabled;
        })
    }
    
    getModel(): Model {
        return {
            error: {
                askToReport: this.options.error.askToReport,
                e: JSON.stringify(this.options.error.e, null, 2),
                message: this.app.errorLog.prepareErrorMessage(this.options.error).split("\n")[0]
            },
            helpCenterUrl: this.options.error.helpCenterCode ? this.app.getHelpCenterUrl(this.options.error.helpCenterCode) : null,
            errorsLoggingEnabled: this.errorsLoggingEnabled      
        };
    }
    
    getPromise(): Q.Promise<UserAction> {
        return this.resultDeferred.promise;
    }
    
    bindErrorsLoggingChangeEvent(): void {
        this.bindEvent<UserProfileSettingChangeEvent>(this.app, "userprofilesettingchange", (event) => {
            if (event.name == MailConst.ERRORS_LOGGING_ENABLED) {
                let errorsLoggingEnabled = (event.value as boolean);
                if (errorsLoggingEnabled != this.errorsLoggingEnabled) {
                    this.errorsLoggingEnabled = errorsLoggingEnabled;    
                    this.updateErrorsLoggingEnabledInView(errorsLoggingEnabled);
                }
            }
        });  
    }

    updateErrorsLoggingEnabledInView(enabled: boolean): void {
        this.callViewMethod("onUpdateErrorsLoggingEnabled", enabled);
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
        if (this.errorsLoggingEnabled) {
            this.resultDeferred.resolve({
                sendReport: true,
                includeErrorLog: false,
                includeSystemInformation: false,
            });
    
        }
        this.close();
    }

    onViewErrorsLoggingEnabled(enabled: boolean): void {
        if (this.errorsLoggingEnabled != enabled) {
            this.errorsLoggingEnabled = enabled;
            (<any>this.app).setErrorsLoggingEnabled(enabled);
        }
    }

    onViewShowFullReport(): void {
        new Promise<void>(async () => {
            const win = await this.app.ioc.create(
                TextViewerWindowController, 
                [this, { 
                    title: this.i18n("window.error.fullReport.title"), 
                    text: JSON.stringify(this.options.error.e, null, 2), 
                    fontSize: "--font-size-xs",
                    useTextArea: true
                }]);
            this.openChildWindow(win);     
        })
    }
}
