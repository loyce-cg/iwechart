import { app, window, Q, mail } from "pmc-mail";
import { CalendarWindowController } from "../calendar/CalendarWindowController";
import { CalendarPlugin } from "../../main/CalendarPlugin";
import { i18n } from "./i18n/index";

export class MainWindowController extends window.base.BaseAppWindowController {
    
    static textsPrefix: string = "plugin.calendar.window.main.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    calendarWindow: CalendarWindowController;
    calendarPlugin: CalendarPlugin;
    
    constructor(parentWindow: window.container.ContainerWindowController) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.setPluginViewAssets("calendar");
        this.openWindowOptions.fullscreen = true;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = this.i18n("plugin.calendar.window.main.title");
        this.openWindowOptions.icon = "icon fa fa-calendar";
        
        this.calendarPlugin = this.app.getComponent("calendar-plugin");
    }
    
    init(): any {
        return Q().then(() => {
            return <any>this.app.mailClientApi.checkLoginCore();
        })
        .then(() => {
            return <any>this.app.mailClientApi.privmxRegistry.getSystemFs();
        })
        .then(() => {
            return <any>this.calendarPlugin.checkInit().then(() => this.calendarPlugin.tasksPlugin.projectsReady);
        })
        .then(() => {
            return this.app.ioc.create(CalendarWindowController, [this, true]);
        })
        .then(win => {
            this.calendarWindow = win;
        });
    }
    
    onViewLoad(): void {
        if (this.calendarWindow.nwin == null) {
            this.calendarWindow.openDocked(this.nwin, 1);
        }
        let dockedNwin = <app.common.window.DockedWindow>this.calendarWindow.nwin;
        this.callViewMethod("openIframe", dockedNwin.id, dockedNwin.load);
    }
    
    applyHistoryState(processed: boolean, state: string) {
        this.checkInit().then(() => {
            this.calendarWindow.applyHistoryState(processed, state);
        });
    }
    
}
