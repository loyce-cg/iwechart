"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var MainWindowController_1 = require("../window/main/MainWindowController");
var CalendarPlugin_1 = require("../main/CalendarPlugin");
var CalendarPanelController_1 = require("../component/calendarPanel/CalendarPanelController");
var DatePickerController_1 = require("../component/datePicker/DatePickerController");
var DateTimePickerController_1 = require("../component/dateTimePicker/DateTimePickerController");
var CalendarWindowController_1 = require("../window/calendar/CalendarWindowController");
var Types_1 = require("../main/Types");
var Logger = Mail.Logger.get("privfs-calendar-plugin.main");
var Plugin = (function () {
    function Plugin() {
    }
    Plugin.prototype.register = function (mail, app) {
        var calendarPlugin = app.addComponent("calendar-plugin", new CalendarPlugin_1.CalendarPlugin(app));
        calendarPlugin.registerTexts(app.localeService);
        CalendarPanelController_1.CalendarPanelController.registerTexts(app.localeService);
        DatePickerController_1.DatePickerController.registerTexts(app.localeService);
        DateTimePickerController_1.DateTimePickerController.registerTexts(app.localeService);
        CalendarWindowController_1.CalendarWindowController.registerTexts(app.localeService);
        MainWindowController_1.MainWindowController.registerTexts(app.localeService);
        app.ioc.registerComponent("calendarPanel", CalendarPanelController_1.CalendarPanelController);
        app.ioc.registerComponent("datePicker", DatePickerController_1.DatePickerController);
        app.ioc.registerComponent("dateTimePicker", DateTimePickerController_1.DateTimePickerController);
        app.addEventListener("afterlogin", function (event) {
            var cnt = app.windows.container;
            var entry = cnt.registerAppWindow({
                id: "calendar",
                label: app.localeService.i18n("plugin.calendar.app.navbar.label"),
                controllerClass: MainWindowController_1.MainWindowController,
                icon: "privmx-icon-calendar",
                historyPath: "/calendar",
                order: 40,
                countFullyLoaded: calendarPlugin.calendarUnreadCountFullyLoadedModel,
            });
        }, "calendar", "ethernal");
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({ path: "window/component/calendarPanel/template/main.css", plugin: "calendar" });
                event.instance.addViewScript({ path: "build/view.js", plugin: "calendar" });
                app.ioc.create(CalendarPanelController_1.CalendarPanelController, [event.instance, event.instance.personsComponent]).then(function (ele) {
                    ele.context = event.instance.loadSingleModule ? Types_1.ViewContext.CalendarWindow : Types_1.ViewContext.SummaryWindow;
                    ele.calendarId = 1;
                    event.instance.registerModule("calendar", ele);
                    ele.afterViewLoaded.promise.then(function () {
                        ele.activate();
                    });
                    var origBeforeClose = event.instance.beforeClose;
                    event.instance.beforeClose = function (force) {
                        origBeforeClose(force);
                        Mail.Q().then(function () {
                            ele.beforeClose();
                        });
                    };
                });
            }
        }, "calendar", "ethernal");
        app.addEventListener("sinkindexmanagerready", function () {
            calendarPlugin.checkInit().fail(function (e) {
                Logger.error("error init tasks plugin", e);
            });
        }, "calendar", "ethernal");
        app.addEventListener("afterlogout", function () {
            calendarPlugin.reset();
        }, "calendar", "ethernal");
    };
    return Plugin;
}());
exports.Plugin = Plugin;
Plugin.prototype.className = "com.privmx.plugin.calendar.build.Plugin";

//# sourceMappingURL=main.js.map
