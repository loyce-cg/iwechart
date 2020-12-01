import * as Web from "pmc-web";
import { MainWindowView } from "../window/main/MainWindowView";
import { CalendarWindowView } from "../window/calendar/CalendarWindowView";
import { DatePickerView } from "../component/datePicker/DatePickerView";
import { DateTimePickerView } from "../component/dateTimePicker/DateTimePickerView";
import { CalendarPanelView } from "../component/calendarPanel/CalendarPanelView";

Web.Starter.objectFactory.register(MainWindowView);
Web.Starter.objectFactory.register(CalendarWindowView);

Web.Starter.addEventListener<Web.Types.event.InstanceRegisteredEvent<Web.window.sectionsummary.SectionSummaryWindowView>>("instanceregistered", event => {
    if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowView") {
        let calendarPanel = new CalendarPanelView(event.instance, event.instance.personsComponent);
        calendarPanel.$container = Web.JQuery('<div class="calendar-component"></div>');
        event.instance.registerModule("calendar", calendarPanel);
    }
}, "calendar", "ethernal");

Web.Starter.addEventListener("request-date-picker-view", (event: any) => {
    let view = new DatePickerView(event.parent);
    (<any>event.parent).registerDatePickerView(event.name, view);
}, "calendar", "ethernal");

Web.Starter.addEventListener("request-date-time-picker-view", (event: any) => {
    let view = new DateTimePickerView(event.parent);
    (<any>event.parent).registerDateTimePickerView(event.name, view);
}, "calendar", "ethernal");
