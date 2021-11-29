"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var DateUtils_1 = require("../../main/DateUtils");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var index_1 = require("./i18n/index");
var DatePickerController = (function (_super) {
    __extends(DatePickerController, _super);
    function DatePickerController(parent, options) {
        var _this = _super.call(this, parent) || this;
        _this.options = options;
        _this.afterViewLoaded = pmc_mail_1.Q.defer();
        _this._valueChangedHandler = null;
        _this._popupClosedHandler = null;
        _this.ipcMode = true;
        _this.calendarPlugin = _this.app.getComponent("calendar-plugin");
        _this.correctOptions(options);
        _this.customSelectDay = _this.addComponent("customSelectDay", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: true,
                firstItemIsStandalone: false,
                scrollToFirstSelected: true,
                gridColsCount: 7,
                items: [],
            }]));
        _this.customSelectMonth = _this.addComponent("customSelectMonth", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: true,
                firstItemIsStandalone: false,
                scrollToFirstSelected: true,
                gridColsCount: 3,
                items: [],
            }]));
        _this.customSelectYear = _this.addComponent("customSelectYear", _this.componentFactory.createComponent("customselect", [_this, {
                multi: false,
                editable: true,
                firstItemIsStandalone: false,
                scrollToFirstSelected: true,
                gridColsCount: 5,
                items: [],
            }]));
        return _this;
    }
    DatePickerController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    DatePickerController.prototype.init = function () {
        var _this = this;
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("setData", _this.getDataModel());
            _this.updateDateCustomSelects(true, true, true);
        });
        return pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.customSelectDay.init(),
                _this.customSelectMonth.init(),
                _this.customSelectYear.init(),
            ]);
        });
    };
    DatePickerController.prototype.onViewLoad = function () {
        this.afterViewLoaded.resolve();
    };
    DatePickerController.prototype.getModel = function () {
        return null;
    };
    DatePickerController.prototype.getDataModel = function () {
        var now = this.currDataModel ? new Date(this.currDataModel.selectedYear, this.currDataModel.selectedMonth, this.currDataModel.selectedDay) : new Date();
        var model = {
            options: this.options,
            selectedDay: now.getDate(),
            selectedMonth: now.getMonth(),
            selectedYear: now.getFullYear(),
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    };
    DatePickerController.prototype.correctOptions = function (options) {
        if (options.duration === true) {
            options.year = false;
            options.month = false;
            options.prev = false;
            options.next = false;
        }
    };
    DatePickerController.prototype.setOptions = function (options) {
        var _this = this;
        this.correctOptions(options);
        this.options = options;
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("setData", _this.getDataModel());
        });
    };
    DatePickerController.prototype.correctModelSelectedDate = function () {
        if (this.currDataModel.options.day === false) {
        }
        var dt = new Date(this.currDataModel.selectedYear, this.currDataModel.selectedMonth, this.currDataModel.selectedDay);
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
    };
    DatePickerController.prototype.onViewChangeDay = function (day) {
        this.setDay(day, true);
    };
    DatePickerController.prototype.onViewChangeMonth = function (month) {
        this.setMonth(month, true);
    };
    DatePickerController.prototype.onViewChangeYear = function (year) {
        this.setYear(year, true);
    };
    DatePickerController.prototype.onViewSetTimestamp = function (ts) {
        if (!this.currDataModel) {
            return;
        }
        var dt = new Date(ts);
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
        this.updateDateCustomSelects(true, true, true);
        this.sendSelectedDateToView();
    };
    DatePickerController.prototype.onViewSetDuration = function (d) {
        if (!this.currDataModel) {
            return;
        }
        d /= 1000;
        var days = Math.floor(d / 86400);
        this.currDataModel.selectedDay = days;
        this.updateDateCustomSelects(true, true, true);
        this.sendSelectedDateToView();
    };
    DatePickerController.prototype.setDate = function (day, month, year) {
        this.currDataModel.selectedDay = day;
        this.currDataModel.selectedMonth = month;
        this.currDataModel.selectedYear = year;
        this.updateDateCustomSelects(true, true, true);
        this.sendSelectedDateToView();
    };
    DatePickerController.prototype.setDay = function (day, fromView) {
        if (fromView === void 0) { fromView = false; }
        this.currDataModel.selectedDay = day;
        this.correctModelSelectedDate();
        this.updateDateCustomSelects(!fromView, true, true);
        if (!fromView) {
            this.sendSelectedDateToView();
        }
    };
    DatePickerController.prototype.setMonth = function (month, fromView) {
        if (fromView === void 0) { fromView = false; }
        this.currDataModel.selectedMonth = month;
        this.correctModelSelectedDate();
        this.updateDateCustomSelects(true, !fromView, true);
        if (!fromView) {
            this.sendSelectedDateToView();
        }
    };
    DatePickerController.prototype.setYear = function (year, fromView) {
        if (fromView === void 0) { fromView = false; }
        this.currDataModel.selectedYear = year;
        this.correctModelSelectedDate();
        this.updateDateCustomSelects(true, true, !fromView);
        if (!fromView) {
            this.sendSelectedDateToView();
        }
    };
    DatePickerController.prototype.updateDateCustomSelects = function (updateDay, updateMonth, updateYear) {
        if (updateDay === void 0) { updateDay = true; }
        if (updateMonth === void 0) { updateMonth = true; }
        if (updateYear === void 0) { updateYear = true; }
        if (this.currDataModel.selectedDay == null) {
            var now = new Date();
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
    };
    DatePickerController.prototype.getCustomSelectDayItems = function () {
        var nowD = new Date().getDate();
        var n = DateUtils_1.DateUtils.numDaysInMonth(this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
        var arr = [];
        var days = [];
        if (this.options.duration) {
            days.push(0);
            n = 29;
        }
        for (var i = 1; i <= n; ++i) {
            days.push(i);
        }
        for (var _i = 0, days_1 = days; _i < days_1.length; _i++) {
            var day = days_1[_i];
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
    };
    DatePickerController.prototype.getCustomSelectMonthItems = function () {
        var nowM = new Date().getMonth();
        var arr = [];
        var months = [];
        for (var i = 0; i < 12; ++i) {
            months.push(i);
        }
        for (var _i = 0, months_1 = months; _i < months_1.length; _i++) {
            var month = months_1[_i];
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
    };
    DatePickerController.prototype.getCustomSelectYearItems = function () {
        var nowY = new Date().getFullYear();
        var diff = 10;
        var arr = [];
        var years = [];
        for (var i = nowY - diff; i < nowY + diff; ++i) {
            years.push(i);
        }
        for (var _i = 0, years_1 = years; _i < years_1.length; _i++) {
            var year = years_1[_i];
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
    };
    DatePickerController.prototype.sendSelectedDateToView = function () {
        this.callViewMethod("setSelectedDate", this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear);
    };
    DatePickerController.prototype.onValueChanged = function (handler) {
        this._valueChangedHandler = handler;
    };
    DatePickerController.prototype.onPopupClosed = function (handler) {
        this._popupClosedHandler = handler;
    };
    DatePickerController.prototype.triggerValueChanged = function () {
        if (this._valueChangedHandler) {
            this._valueChangedHandler();
        }
    };
    DatePickerController.prototype.triggerPopupClosed = function (commit) {
        if (this._popupClosedHandler) {
            this._popupClosedHandler(commit);
        }
    };
    DatePickerController.prototype.onViewNext = function (absDelta) {
        if (absDelta === void 0) { absDelta = null; }
        this.next(absDelta);
    };
    DatePickerController.prototype.onViewPrev = function (absDelta) {
        if (absDelta === void 0) { absDelta = null; }
        this.prev(absDelta);
    };
    DatePickerController.prototype.prev = function (absDelta) {
        if (absDelta === void 0) { absDelta = null; }
        var d = 1;
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
    };
    DatePickerController.prototype.next = function (absDelta) {
        if (absDelta === void 0) { absDelta = null; }
        var d = 1;
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
    };
    DatePickerController.prototype.onViewCancelPopup = function () {
        this.triggerPopupClosed(false);
    };
    DatePickerController.prototype.onViewCommitPopup = function () {
        this.triggerPopupClosed(true);
    };
    DatePickerController.textsPrefix = "plugin.calendar.component.datePicker.";
    DatePickerController = __decorate([
        Dependencies(["customselect"])
    ], DatePickerController);
    return DatePickerController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.DatePickerController = DatePickerController;
DatePickerController.prototype.className = "com.privmx.plugin.calendar.component.datePicker.DatePickerController";

//# sourceMappingURL=DatePickerController.js.map
