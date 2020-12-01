import * as Mail from "pmc-mail";
import { MainWindowController } from "../window/main/MainWindowController";
import { CalendarPlugin } from "../main/CalendarPlugin";
import { CalendarPanelController } from "../component/calendarPanel/CalendarPanelController";
import { DatePickerController } from "../component/datePicker/DatePickerController";
import { DateTimePickerController } from "../component/dateTimePicker/DateTimePickerController";
import { CalendarWindowController } from "../window/calendar/CalendarWindowController";
import { ViewContext } from "../main/Types";
let Logger = Mail.Logger.get("privfs-calendar-plugin.main");

export class Plugin {
    
    register(mail: typeof Mail, app: Mail.app.common.CommonApplication) {
        let calendarPlugin = app.addComponent("calendar-plugin", new CalendarPlugin(app));
        
        // i18n: main
        calendarPlugin.registerTexts(app.localeService);
        
        // i18n: components
        CalendarPanelController.registerTexts(app.localeService);
        DatePickerController.registerTexts(app.localeService);
        DateTimePickerController.registerTexts(app.localeService);
        
        // i18n: windows
        CalendarWindowController.registerTexts(app.localeService);
        MainWindowController.registerTexts(app.localeService);
        
        app.ioc.registerComponent("calendarPanel", CalendarPanelController);
        app.ioc.registerComponent("datePicker", DatePickerController);
        app.ioc.registerComponent("dateTimePicker", DateTimePickerController);
        
        app.addEventListener<Mail.Types.event.AfterLoginEvent>("afterlogin", event => {
            let cnt = <Mail.window.container.ContainerWindowController>app.windows.container;
            let entry = cnt.registerAppWindow(<any>{
                id: "calendar",
                label: app.localeService.i18n("plugin.calendar.app.navbar.label"),
                controllerClass: MainWindowController,
                icon: "privmx-icon-calendar",
                historyPath: "/calendar",
                order: 40,
                countFullyLoaded: calendarPlugin.calendarUnreadCountFullyLoadedModel,
            });
        }, "calendar", "ethernal");
        
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.sectionsummary.SectionSummaryWindowController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({path: "window/component/calendarPanel/template/main.css", plugin: "calendar"});
                event.instance.addViewScript({path: "build/view.js", plugin: "calendar"});
                app.ioc.create(CalendarPanelController, [event.instance, event.instance.personsComponent]).then(ele => {
                    ele.context = event.instance.loadSingleModule ? ViewContext.CalendarWindow : ViewContext.SummaryWindow;
                    ele.calendarId = 1;
                    event.instance.registerModule("calendar", ele);
                    ele.afterViewLoaded.promise.then(() => {
                        ele.activate();
                    });
                    let origBeforeClose = event.instance.beforeClose;
                    event.instance.beforeClose = force => {
                        origBeforeClose(force);
                        Mail.Q().then(() => {
                            ele.beforeClose();
                        });
                    };
                });
            }
        }, "calendar", "ethernal");
        
        app.addEventListener<Mail.Types.event.SinkIndexManagerReady>("sinkindexmanagerready", () => {
            calendarPlugin.checkInit().fail(e => {
                Logger.error("error init tasks plugin", e);
            });
        }, "calendar", "ethernal");
        
        app.addEventListener<Mail.Types.event.AfterLogoutPlugin>("afterlogout", () => {
            calendarPlugin.reset();
        }, "calendar", "ethernal");
    }
}
