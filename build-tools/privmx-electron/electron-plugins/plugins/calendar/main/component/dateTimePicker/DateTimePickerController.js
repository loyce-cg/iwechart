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
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var index_1 = require("./i18n/index");
var DateTimePickerController = (function (_super) {
    __extends(DateTimePickerController, _super);
    function DateTimePickerController(parent, options) {
        var _this = _super.call(this, parent) || this;
        _this.options = options;
        _this.afterViewLoaded = pmc_mail_1.Q.defer();
        _this._valueChangedHandler = null;
        _this._popupClosedHandler = null;
        _this.ipcMode = true;
        _this.calendarPlugin = _this.app.getComponent("calendar-plugin");
        _this.correctOptions(options);
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
    DateTimePickerController_1 = DateTimePickerController;
    DateTimePickerController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    DateTimePickerController.prototype.init = function () {
        var _this = this;
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("setData", _this.getDataModel());
            _this.updateDateCustomSelects(true, true, true, true);
        });
        return pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.customSelectMonth.init(),
                _this.customSelectYear.init(),
            ]);
        });
    };
    DateTimePickerController.prototype.onViewLoad = function () {
        this.afterViewLoaded.resolve();
    };
    DateTimePickerController.prototype.getModel = function () {
        return null;
    };
    DateTimePickerController.prototype.getDataModel = function () {
        var now = this.currDataModel ? new Date(this.currDataModel.visibleYear, this.currDataModel.visibleMonth, this.currDataModel.visibleDay, this.currDataModel.selectedTime) : new Date();
        var model = {
            options: this.options,
            visibleDay: now.getDate(),
            visibleMonth: now.getMonth(),
            visibleYear: now.getFullYear(),
            selectedDay: now.getDate(),
            selectedMonth: now.getMonth(),
            selectedYear: now.getFullYear(),
            selectedTime: DateTimePickerController_1.getMsecsFromDate(now),
        };
        this.currDataModel = model;
        return JSON.stringify(model);
    };
    DateTimePickerController.prototype.correctOptions = function (options) {
    };
    DateTimePickerController.prototype.setOptions = function (options) {
        var _this = this;
        this.correctOptions(options);
        this.options = options;
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("setData", _this.getDataModel());
        });
    };
    DateTimePickerController.prototype.correctModelVisibleDate = function () {
        var dt = new Date(this.currDataModel.visibleYear, this.currDataModel.visibleMonth, this.currDataModel.visibleDay, 0, 0, 0, 0);
        this.currDataModel.visibleDay = dt.getDate();
        this.currDataModel.visibleMonth = dt.getMonth();
        this.currDataModel.visibleYear = dt.getFullYear();
        var currY = new Date().getFullYear();
        var dY = 10;
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
    };
    DateTimePickerController.prototype.correctModelSelectedDate = function () {
        var dt = new Date(this.currDataModel.selectedYear, this.currDataModel.selectedMonth, this.currDataModel.selectedDay, 0, 0, 0, this.currDataModel.selectedTime);
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
        this.currDataModel.selectedTime = DateTimePickerController_1.getMsecsFromDate(dt);
    };
    DateTimePickerController.prototype.onViewChangeDay = function (day) {
        this.setDay(day, true);
    };
    DateTimePickerController.prototype.onViewChangeMonth = function (month) {
        this.setMonth(month, true);
    };
    DateTimePickerController.prototype.onViewChangeYear = function (year) {
        this.setYear(year, true);
    };
    DateTimePickerController.prototype.onViewChangeTime = function (msecs) {
        this.setTime(msecs, true);
        this.callViewMethod("updateTimeItems", JSON.stringify(this.getCustomSelectTimeItems()));
    };
    DateTimePickerController.prototype.onViewSetTimestamp = function (ts) {
        if (!this.currDataModel) {
            return;
        }
        var dt = new Date(ts);
        this.currDataModel.visibleDay = dt.getDate();
        this.currDataModel.visibleMonth = dt.getMonth();
        this.currDataModel.visibleYear = dt.getFullYear();
        this.correctModelVisibleDate();
        this.currDataModel.selectedDay = dt.getDate();
        this.currDataModel.selectedMonth = dt.getMonth();
        this.currDataModel.selectedYear = dt.getFullYear();
        this.currDataModel.selectedTime = DateTimePickerController_1.getMsecsFromDate(dt);
        this.updateDateCustomSelects(true, true, true, true);
        this.sendDateTimesToView();
    };
    DateTimePickerController.prototype.setDateTime = function (day, month, year, time) {
        this.currDataModel.visibleDay = day;
        this.currDataModel.visibleMonth = month;
        this.currDataModel.visibleYear = year;
        this.currDataModel.selectedTime = time;
        this.updateDateCustomSelects(true, true, true, true);
        this.sendDateTimesToView();
    };
    DateTimePickerController.prototype.setDay = function (day, fromView) {
        if (fromView === void 0) { fromView = false; }
        this.currDataModel.visibleDay = day;
        this.correctModelVisibleDate();
        this.updateDateCustomSelects(!fromView, true, true, true);
        this.sendDateTimesToView();
    };
    DateTimePickerController.prototype.setMonth = function (month, fromView) {
        if (fromView === void 0) { fromView = false; }
        this.currDataModel.visibleMonth = month;
        this.correctModelVisibleDate();
        this.updateDateCustomSelects(true, !fromView, true, true);
        this.sendDateTimesToView();
    };
    DateTimePickerController.prototype.setYear = function (year, fromView) {
        if (fromView === void 0) { fromView = false; }
        this.currDataModel.visibleYear = year;
        this.correctModelVisibleDate();
        this.updateDateCustomSelects(true, true, !fromView, true);
        this.sendDateTimesToView();
    };
    DateTimePickerController.prototype.setTime = function (msecs, fromView) {
        if (fromView === void 0) { fromView = false; }
        this.currDataModel.selectedTime = msecs;
        this.updateDateCustomSelects(true, true, true, !fromView);
        this.sendDateTimesToView();
    };
    DateTimePickerController.prototype.updateDateCustomSelects = function (updateDay, updateMonth, updateYear, updateTime) {
        if (updateDay === void 0) { updateDay = true; }
        if (updateMonth === void 0) { updateMonth = true; }
        if (updateYear === void 0) { updateYear = true; }
        if (updateTime === void 0) { updateTime = true; }
        if (this.currDataModel.visibleDay == null) {
            var now = new Date();
            this.currDataModel.visibleDay = now.getDate();
            this.currDataModel.visibleMonth = now.getMonth();
            this.currDataModel.visibleYear = now.getFullYear();
            this.currDataModel.selectedDay = now.getDate();
            this.currDataModel.selectedMonth = now.getMonth();
            this.currDataModel.selectedYear = now.getFullYear();
            this.currDataModel.selectedTime = DateTimePickerController_1.getMsecsFromDate(now);
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
    };
    DateTimePickerController.prototype.getCustomSelectMonthItems = function () {
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
                text: this.i18n("plugin.calendar.component.dateTimePicker.month." + month),
                textNoEscape: true,
                icon: null,
                selected: this.currDataModel.visibleMonth == month,
                extraClass: nowM == month ? "now" : null,
            });
        }
        return arr;
    };
    DateTimePickerController.prototype.getCustomSelectYearItems = function () {
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
                selected: this.currDataModel.visibleYear == year,
                extraClass: nowY == year ? "now" : null,
            });
        }
        return arr;
    };
    DateTimePickerController.prototype.getCustomSelectTimeItems = function () {
        var pad0s = function (x) { return (x < 10 ? "0" : "") + x; };
        var arr = [];
        for (var hs = 0; hs <= 24; hs++) {
            for (var ms = 0; ms <= 45; ms += 15) {
                if ((hs == 24 && ms > 0)) {
                    continue;
                }
                var str = pad0s(hs) + ":" + pad0s(ms);
                var msecs = (hs * 3600 + ms * 60) * 1000;
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
    };
    DateTimePickerController.prototype.sendDateTimesToView = function () {
        this.callViewMethod("setDateTimes", this.currDataModel.visibleDay, this.currDataModel.visibleMonth, this.currDataModel.visibleYear, this.currDataModel.selectedDay, this.currDataModel.selectedMonth, this.currDataModel.selectedYear, this.currDataModel.selectedTime);
    };
    DateTimePickerController.prototype.onValueChanged = function (handler) {
        this._valueChangedHandler = handler;
    };
    DateTimePickerController.prototype.onPopupClosed = function (handler) {
        this._popupClosedHandler = handler;
    };
    DateTimePickerController.prototype.triggerValueChanged = function () {
        if (this._valueChangedHandler) {
            this._valueChangedHandler();
        }
    };
    DateTimePickerController.prototype.triggerPopupClosed = function (commit) {
        if (this._popupClosedHandler) {
            this._popupClosedHandler(commit);
        }
    };
    DateTimePickerController.prototype.onViewNext = function () {
        this.next();
    };
    DateTimePickerController.prototype.onViewPrev = function () {
        this.prev();
    };
    DateTimePickerController.prototype.prev = function () {
        this.setMonth(this.currDataModel.visibleMonth - 1);
    };
    DateTimePickerController.prototype.next = function () {
        this.setMonth(this.currDataModel.visibleMonth + 1);
    };
    DateTimePickerController.prototype.onViewCancelPopup = function () {
        this.triggerPopupClosed(false);
    };
    DateTimePickerController.prototype.onViewCommitPopup = function () {
        this.triggerPopupClosed(true);
    };
    DateTimePickerController.prototype.getSelectedDate = function () {
        var day = this.currDataModel.selectedDay;
        var month = this.currDataModel.selectedMonth;
        var year = this.currDataModel.selectedYear;
        var time = this.currDataModel.selectedTime;
        return new Date(year, month, day, 0, 0, 0, time);
    };
    DateTimePickerController.formatTime = function (msecs) {
        if (msecs === null) {
            return "";
        }
        var seconds = msecs / 1000;
        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor((seconds - hours * 3600) / 60);
        var pad0s = function (x) { return (x < 10 ? "0" : "") + x; };
        var str = pad0s(hours) + ":" + pad0s(minutes);
        return str;
    };
    DateTimePickerController.getMsecsFromString = function (str) {
        if (str === "") {
            return null;
        }
        var _a = str.split(":").map(function (x) { return parseInt(x); }), hs = _a[0], ms = _a[1];
        var msecs = (hs * 3600 + ms * 60) * 1000;
        return msecs;
    };
    DateTimePickerController.getMsecsFromDate = function (dt) {
        var hs = dt.getHours();
        var ms = dt.getMinutes();
        var msecs = (hs * 3600 + ms * 60) * 1000;
        var rounding = 15 * 60 * 1000;
        return Math.round(msecs / rounding) * rounding;
    };
    var DateTimePickerController_1;
    DateTimePickerController.textsPrefix = "plugin.calendar.component.dateTimePicker.";
    DateTimePickerController = DateTimePickerController_1 = __decorate([
        Dependencies(["customselect"])
    ], DateTimePickerController);
    return DateTimePickerController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.DateTimePickerController = DateTimePickerController;
DateTimePickerController.prototype.className = "com.privmx.plugin.calendar.component.dateTimePicker.DateTimePickerController";

//# sourceMappingURL=DateTimePickerController.js.map
