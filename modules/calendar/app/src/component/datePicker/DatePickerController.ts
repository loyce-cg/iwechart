import { utils, window, Q, mail, component } from "pmc-mail";
import { CalendarPlugin, CalendarComponentFactory } from "../../main/CalendarPlugin";
import { DateUtils } from "../../main/DateUtils";
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";

export interface DatePickerOptions {
    day?: boolean;
    month?: boolean;
    year?: boolean;
    
    prev?: boolean;
    next?: boolean;
    today?: boolean;
    
    popup?: boolean;
    buttons?: boolean;
    duration?: boolean;
}

export interface Model {
    options: DatePickerOptions;
    
    selectedDay: number;
    selectedMonth: number;
    selectedYear: number;
}

@Dependencies(["customselect"])
export class DatePickerController extends window.base.WindowComponentController<window.base.BaseWindowController> {
    
    static textsPrefix: string = "plugin.calendar.component.datePicker.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    calendarPlugin: CalendarPlugin;
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    customSelectDay: component.customselect.CustomSelectController;
    customSelectMonth: component.customselect.CustomSelectController;
    customSelectYear: component.customselect.CustomSelectController;
    componentFactory: CalendarComponentFactory;
    currDataModel: Model;
    _valueChangedHandler: () => void = null;
    _popupClosedHandler: (commit: boolean) => void = null;
    
    constructor(
        parent: window.base.BaseWindowController,
        public options: DatePickerOptions
    ) {
        super(parent);
        this.ipcMode = true;
        this.calendarPlugin = this.app.getComponent("calendar-plugin");
        this.correctOptions(options);
        
        this.customSelectDay = this.addComponent("customSelectDay", this.componentFactory.createComponent("customselect", [this, {
            multi: false,
            editable: true,
            firstItemIsStandalone: false,
            scrollToFirstSelected: true,
            gridColsCount: 7,
            items: [],
        }]));
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
            this.updateDateCustomSelects(true, true, true);
        });
        return Q().then(() => {
            return Q.all([
                this.customSelectDay.init(),
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
        let now = this.currDataModel ? new Date(this.currDataModel.selectedYear, this.currDataModel.selectedMonth, this.currDataModel.selectedDay) : new Date();
        let model: Model = {
            options: this.options,
            
            selectedDay: now.getDate(),
            selectedMonth: now.getMonth(),
            selectedYear: now.getFullYear(),
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    }
    
    correctOptions(options: DatePickerOptions) {
        if (options.duration === true) {
            options.year = false;
            options.month = false;
            options.prev = false;
            options.next = false;
        }
    }
    
    setOptions(options: DatePickerOptions): void {
        this.correctOptions(options);
        this.options = options;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setData", this.getDataModel());
        });
    }
    
    
    
    
    
    /****************************************
    ***************** View ******************
    *****************************************/
    correctModelSelectedDate(): void {
        if (this.currDataModel.options.day === false) {
            //this.currDataModel.selectedDay = 15;
        }
        let dt = new Date(this.currDataModel.selectedYear, this.currDataModel.selectedMonth, this.currDataModel.selectedDay);
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
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
    onViewSetTimestamp(ts: number): void {
        if (!this.currDataModel) {
            return;
        }
        let dt = new Date(ts);
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
        this.updateDateCustomSelects(true, true, true);
        this.sendSelectedDateToView();
    }
    onViewSetDuration(d: number): void {
        if (!this.currDataModel) {
            return;
        }
        d /= 1000;
        let days = Math.floor(d / 86400);
        this.currDataModel.selectedDay = days;
        this.updateDateCustomSelects(true, true, true);
        this.sendSelectedDateToView();
    }
    setDate(day: number, month: number, year: number): void {
        this.currDataModel.selectedDay = day;
        this.currDataModel.selectedMonth = month;
        this.currDataModel.selectedYear = year;
        this.updateDateCustomSelects(true, true, true);
        this.sendSelectedDateToView();
    }
    setDay(day: number, fromView: boolean = false): void {
        this.currDataModel.selectedDay = day;
        this.correctModelSelectedDate();
        this.updateDateCustomSelects(!fromView, true, true);
        if (!fromView) {
            this.sendSelectedDateToView();
        }
    }
    setMonth(month: number, fromView: boolean = false): void {
        this.currDataModel.selectedMonth = month;
        this.correctModelSelectedDate();
        this.updateDateCustomSelects(true, !fromView, true);
        if (!fromView) {
            this.sendSelectedDateToView();
        }
    }
    setYear(year: number, fromView: boolean = false): void {
        this.currDataModel.selectedYear = year;
        this.correctModelSelectedDate();
        this.updateDateCustomSelects(true, true, !fromView);
        if (!fromView) {
            this.sendSelectedDateToView();
        }
    }
    updateDateCustomSelects(updateDay: boolean = true, updateMonth: boolean = true, updateYear: boolean = true): void {
        if (this.currDataModel.selectedDay == null) {
            let now = new Date();
            this.currDataModel.selectedDay = now.getDate();
            this.currDataModel.selectedMonth = now.getMonth();
            this.currDataModel.selectedYear = now.getFullYear();
        }
        
        if (updateDay) {
            this.customSelectDay.setItems(this.getCustomSelectDayItems());
        }
        if (updateMonth) {
            this.customSelectMonth.setItems(this.getCustomSelectMonthItems());
        }
        if (updateYear) {
            this.customSelectYear.setItems(this.getCustomSelectYearItems());
        }
        this.triggerValueChanged();
    }
    
    getCustomSelectDayItems(): component.customselect.CustomSelectItem[] {
        let nowD = new Date().getDate();
        let n = DateUtils.numDaysInMonth(this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
        let arr: component.customselect.CustomSelectItem[] = [];
        let days: number[] = [];
        if (this.options.duration) {
            days.push(0);
            n = 29;
        }
        for (let i = 1; i <= n; ++i) {
            days.push(i);
        }
        for (let day of days) {
            arr.push({
                type: "item",
                value: day.toString(),
                text: day.toString(),
                textNoEscape: true,
                icon: null,
                selected: this.currDataModel.selectedDay == day,
                extraClass: nowD == day ? "now" : null,
            });
        }
        return arr;
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
                text: this.i18n("plugin.calendar.component.datePicker.month.short." + month),
                textNoEscape: true,
                icon: null,
                selected: this.currDataModel.selectedMonth == month,
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
                selected: this.currDataModel.selectedYear == year,
                extraClass: nowY == year ? "now" : null,
            });
        }
        return arr;
    }
    
    sendSelectedDateToView(): void {
        this.callViewMethod("setSelectedDate", this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
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
    
    onViewNext(absDelta: number = null): void {
        this.next(absDelta);
    }
    
    onViewPrev(absDelta: number = null): void {
        this.prev(absDelta);
    }
    
    prev(absDelta: number = null): void {
        let d = 1;
        if (absDelta !== null) {
            d = absDelta;
        }
        if (this.currDataModel.options.day !== false) {
            this.setDay(this.currDataModel.selectedDay - d);
        }
        else if (this.currDataModel.options.month !== false) {
            this.setMonth(this.currDataModel.selectedMonth - d);
        }
        else if (this.currDataModel.options.year !== false) {
            this.setYear(this.currDataModel.selectedYear - d);
        }
    }
    
    next(absDelta: number = null): void {
        let d = 1;
        if (absDelta !== null) {
            d = absDelta;
        }
        if (this.currDataModel.options.day !== false) {
            this.setDay(this.currDataModel.selectedDay + d);
        }
        else if (this.currDataModel.options.month !== false) {
            this.setMonth(this.currDataModel.selectedMonth + d);
        }
        else if (this.currDataModel.options.year !== false) {
            this.setYear(this.currDataModel.selectedYear + d);
        }
    }
    
    onViewCancelPopup(): void {
        this.triggerPopupClosed(false);
    }
    
    onViewCommitPopup(): void {
        this.triggerPopupClosed(true);
    }
    
}
