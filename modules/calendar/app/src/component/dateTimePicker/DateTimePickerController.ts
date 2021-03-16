import { utils, window, Q, mail, component } from "pmc-mail";
import { CalendarPlugin, CalendarComponentFactory } from "../../main/CalendarPlugin";
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";

export interface DateTimePickerOptions {
}

export interface Model {
    options: DateTimePickerOptions;
    
    visibleDay: number;
    visibleMonth: number;
    visibleYear: number;
    
    selectedDay: number;
    selectedMonth: number;
    selectedYear: number;
    selectedTime: number;
}

@Dependencies(["customselect"])
export class DateTimePickerController extends window.base.WindowComponentController<window.base.BaseWindowController> {
    
    static textsPrefix: string = "plugin.calendar.component.dateTimePicker.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    calendarPlugin: CalendarPlugin;
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    customSelectMonth: component.customselect.CustomSelectController;
    customSelectYear: component.customselect.CustomSelectController;
    componentFactory: CalendarComponentFactory;
    currDataModel: Model;
    _valueChangedHandler: () => void = null;
    _popupClosedHandler: (commit: boolean) => void = null;
    
    constructor(
        parent: window.base.BaseWindowController,
        public options: DateTimePickerOptions
    ) {
        super(parent);
        this.ipcMode = true;
        this.calendarPlugin = this.app.getComponent("calendar-plugin");
        this.correctOptions(options);
        
        this.customSelectMonth = this.addComponent("customSelectMonth", this.componentFactory.createComponent("customselect", [this, {
            multi: false,
            editable: true,
            firstItemIsStandalone: false,
            scrollToFirstSelected: true,
            gridColsCount: 3,
            items: [],
        }]));
        this.customSelectYear = this.addComponent("customSelectYear", this.componentFactory.createComponent("customselect", [this, {
            multi: false,
            editable: true,
            firstItemIsStandalone: false,
            scrollToFirstSelected: true,
            gridColsCount: 5,
            items: [],
        }]));
    }
    
    init() {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setData", this.getDataModel());
            this.updateDateCustomSelects(true, true, true, true);
        });
        return Q().then(() => {
            return Q.all([
                this.customSelectMonth.init(),
                this.customSelectYear.init(),
            ]);
        });
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
    }
    
    getModel(): string {
        return null;
    }
    
    getDataModel(): string {
        let now = this.currDataModel ? new Date(this.currDataModel.visibleYear, this.currDataModel.visibleMonth, this.currDataModel.visibleDay, this.currDataModel.selectedTime) : new Date();
        let model: Model = {
            options: this.options,
            
            visibleDay: now.getDate(),
            visibleMonth: now.getMonth(),
            visibleYear: now.getFullYear(),
            
            selectedDay: now.getDate(),
            selectedMonth: now.getMonth(),
            selectedYear: now.getFullYear(),
            selectedTime: DateTimePickerController.getMsecsFromDate(now),
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    }
    
    correctOptions(options: DateTimePickerOptions) {
    }
    
    setOptions(options: DateTimePickerOptions): void {
        this.correctOptions(options);
        this.options = options;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setData", this.getDataModel());
        });
    }
    
    
    
    
    
    /****************************************
    ***************** View ******************
    *****************************************/
    correctModelVisibleDate(): void {
        let dt = new Date(this.currDataModel.visibleYear, this.currDataModel.visibleMonth, this.currDataModel.visibleDay, 0, 0, 0, 0);
        this.currDataModel.visibleDay = dt.getDate();
        this.currDataModel.visibleMonth = dt.getMonth();
        this.currDataModel.visibleYear = dt.getFullYear();
        
        let currY = new Date().getFullYear();
        let dY = 10;
        if (dt.getFullYear() >= currY + dY) {
            this.currDataModel.visibleDay = 31;
            this.currDataModel.visibleMonth = 11;
            this.currDataModel.visibleYear = currY + dY - 1;
        }
        else if (dt.getFullYear() < currY - dY) {
            this.currDataModel.visibleDay = 1;
            this.currDataModel.visibleMonth = 0;
            this.currDataModel.visibleYear = currY - dY;
        }
    }
    correctModelSelectedDate(): void {
        let dt = new Date(this.currDataModel.selectedYear, this.currDataModel.selectedMonth, this.currDataModel.selectedDay, 0, 0, 0, this.currDataModel.selectedTime);
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
        this.currDataModel.selectedTime = DateTimePickerController.getMsecsFromDate(dt);
    }
    onViewChangeDay(day: number): void {
        this.setDay(day, true);
    }
    onViewChangeMonth(month: number): void {
        this.setMonth(month, true);
    }
    onViewChangeYear(year: number): void {
        this.setYear(year, true);
    }
    onViewChangeTime(msecs: number): void {
        this.setTime(msecs, true);
        this.callViewMethod("updateTimeItems", JSON.stringify(this.getCustomSelectTimeItems()));
    }
    onViewSetTimestamp(ts: number): void {
        if (!this.currDataModel) {
            return;
        }
        let dt = new Date(ts);
        this.currDataModel.visibleDay = dt.getDate();
        this.currDataModel.visibleMonth = dt.getMonth();
        this.currDataModel.visibleYear = dt.getFullYear();
        this.correctModelVisibleDate();
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
        this.currDataModel.selectedTime = DateTimePickerController.getMsecsFromDate(dt);
        this.updateDateCustomSelects(true, true, true, true);
        this.sendDateTimesToView();
    }
    setDateTime(day: number, month: number, year: number, time: number): void {
        this.currDataModel.visibleDay = day;
        this.currDataModel.visibleMonth = month;
        this.currDataModel.visibleYear = year;
        this.currDataModel.selectedTime = time;
        this.updateDateCustomSelects(true, true, true, true);
        this.sendDateTimesToView();
    }
    setDay(day: number, fromView: boolean = false): void {
        this.currDataModel.visibleDay = day;
        this.correctModelVisibleDate();
        this.updateDateCustomSelects(!fromView, true, true, true);
        this.sendDateTimesToView();
    }
    setMonth(month: number, fromView: boolean = false): void {
        this.currDataModel.visibleMonth = month;
        this.correctModelVisibleDate();
        this.updateDateCustomSelects(true, !fromView, true, true);
        this.sendDateTimesToView();
    }
    setYear(year: number, fromView: boolean = false): void {
        this.currDataModel.visibleYear = year;
        this.correctModelVisibleDate();
        this.updateDateCustomSelects(true, true, !fromView, true);
        this.sendDateTimesToView();
    }
    setTime(msecs: number, fromView: boolean = false): void {
        this.currDataModel.selectedTime = msecs;
        this.updateDateCustomSelects(true, true, true, !fromView);
        this.sendDateTimesToView();
    }
    updateDateCustomSelects(updateDay: boolean = true, updateMonth: boolean = true, updateYear: boolean = true, updateTime: boolean = true): void {
        if (this.currDataModel.visibleDay == null) {
            let now = new Date();
            this.currDataModel.visibleDay = now.getDate();
            this.currDataModel.visibleMonth = now.getMonth();
            this.currDataModel.visibleYear = now.getFullYear();
            this.currDataModel.selectedDay = now.getDate();
            this.currDataModel.selectedMonth = now.getMonth();
            this.currDataModel.selectedYear = now.getFullYear();
            this.currDataModel.selectedTime = DateTimePickerController.getMsecsFromDate(now);
        }
        
        if (updateMonth) {
            this.customSelectMonth.setItems(this.getCustomSelectMonthItems());
        }
        if (updateYear) {
            this.customSelectYear.setItems(this.getCustomSelectYearItems());
        }
        if (updateTime) {
            this.callViewMethod("updateTimeItems", JSON.stringify(this.getCustomSelectTimeItems()));
        }
        this.triggerValueChanged();
    }

    getCustomSelectMonthItems(): component.customselect.CustomSelectItem[] {
        let nowM = new Date().getMonth();
        let arr: component.customselect.CustomSelectItem[] = [];
        let months: number[] = [];
        for (let i = 0; i < 12; ++i) {
            months.push(i);
        }
        for (let month of months) {
            arr.push({
                type: "item",
                value: month.toString(),
                text: this.i18n("plugin.calendar.component.dateTimePicker.month." + month),
                textNoEscape: true,
                icon: null,
                selected: this.currDataModel.visibleMonth == month,
                extraClass: nowM == month ? "now" : null,
            });
        }
        return arr;
    }

    getCustomSelectYearItems(): component.customselect.CustomSelectItem[] {
        let nowY = new Date().getFullYear();
        let diff = 10;
        let arr: component.customselect.CustomSelectItem[] = [];
        let years: number[] = [];
        for (let i = nowY - diff; i < nowY + diff; ++i) {
            years.push(i);
        }
        for (let year of years) {
            arr.push({
                type: "item",
                value: year.toString(),
                text: year.toString(),
                textNoEscape: true,
                icon: null,
                selected: this.currDataModel.visibleYear == year,
                extraClass: nowY == year ? "now" : null,
            });
        }
        return arr;
    }

    getCustomSelectTimeItems(): component.customselect.CustomSelectItem[] {
        let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
        let arr: component.customselect.CustomSelectItem[] = [];
        for (let hs = 0; hs <= 24; hs++) {
            for (let ms = 0; ms <= 45; ms += 15) {
                if ((hs == 24 && ms > 0)) {
                    continue;
                }
                let str = pad0s(hs) + ":" + pad0s(ms);
                let msecs = (hs * 3600 + ms * 60) * 1000;
                arr.push({
                    type: "item",
                    value: str,
                    text: str,
                    icon: null,
                    selected: this.currDataModel.selectedTime == msecs,
                });
            }
        }
        return arr;
    }
    
    sendDateTimesToView(): void {
        this.callViewMethod(
            "setDateTimes",
            this.currDataModel.visibleDay, this.currDataModel.visibleMonth, this.currDataModel.visibleYear,
            this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear, this.currDataModel.selectedTime
        );
    }
    
    onValueChanged(handler: () => void): void {
        this._valueChangedHandler = handler;
    }
    
    onPopupClosed(handler: (commit: boolean) => void): void {
        this._popupClosedHandler = handler;
    }
    
    triggerValueChanged(): void {
        if (this._valueChangedHandler) {
            this._valueChangedHandler();
        }
    }
    
    triggerPopupClosed(commit: boolean): void {
        if (this._popupClosedHandler) {
            this._popupClosedHandler(commit);
        }
    }
    
    onViewNext(): void {
        this.next();
    }
    
    onViewPrev(): void {
        this.prev();
    }
    
    prev(): void {
        this.setMonth(this.currDataModel.visibleMonth - 1);
    }
    
    next(): void {
        this.setMonth(this.currDataModel.visibleMonth + 1);
    }
    
    onViewCancelPopup(): void {
        this.triggerPopupClosed(false);
    }
    
    onViewCommitPopup(): void {
        this.triggerPopupClosed(true);
    }
    
    getSelectedDate(): Date {
        let day = this.currDataModel.selectedDay;
        let month = this.currDataModel.selectedMonth;
        let year = this.currDataModel.selectedYear;
        let time = this.currDataModel.selectedTime;
        return new Date(year, month, day, 0, 0, 0, time);
    }
    
    static formatTime(msecs: number): string {
        if (msecs === null) {
            return "";
        }
        let seconds = msecs / 1000;
        let hours = Math.floor(seconds / 3600);
        let minutes = Math.floor((seconds - hours * 3600) / 60);
        let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
        let str = pad0s(hours) + ":" + pad0s(minutes);
        return str;
    }
    
    static getMsecsFromString(str: string): number {
        if (str === "") {
            return null;
        }
        let [hs, ms] = str.split(":").map(x => parseInt(x));
        let msecs = (hs * 3600 + ms * 60) * 1000;
        return msecs;
    }
    
    static getMsecsFromDate(dt: Date): number {
        let hs = dt.getHours();
        let ms = dt.getMinutes();
        let msecs = (hs * 3600 + ms * 60) * 1000;
        let rounding = 15 * 60 * 1000;
        return Math.round(msecs / rounding) * rounding;
    }
    
}
