"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DayOfWeek;
(function (DayOfWeek) {
    DayOfWeek[DayOfWeek["MON"] = 0] = "MON";
    DayOfWeek[DayOfWeek["TUE"] = 1] = "TUE";
    DayOfWeek[DayOfWeek["WED"] = 2] = "WED";
    DayOfWeek[DayOfWeek["THU"] = 3] = "THU";
    DayOfWeek[DayOfWeek["FRI"] = 4] = "FRI";
    DayOfWeek[DayOfWeek["SAT"] = 5] = "SAT";
    DayOfWeek[DayOfWeek["SUN"] = 6] = "SUN";
})(DayOfWeek = exports.DayOfWeek || (exports.DayOfWeek = {}));
var Month;
(function (Month) {
    Month[Month["JAN"] = 0] = "JAN";
    Month[Month["FEB"] = 1] = "FEB";
    Month[Month["MAR"] = 2] = "MAR";
    Month[Month["APR"] = 3] = "APR";
    Month[Month["MAY"] = 4] = "MAY";
    Month[Month["JUN"] = 5] = "JUN";
    Month[Month["JUL"] = 6] = "JUL";
    Month[Month["AUG"] = 7] = "AUG";
    Month[Month["SEP"] = 8] = "SEP";
    Month[Month["OCT"] = 9] = "OCT";
    Month[Month["NOV"] = 10] = "NOV";
    Month[Month["DEC"] = 11] = "DEC";
})(Month = exports.Month || (exports.Month = {}));
var DateUtils = (function () {
    function DateUtils() {
    }
    DateUtils.numDaysInMonth = function (month, year) {
        var n = this._daysInMonth[month];
        if (month == Month.FEB && this.isLeapYear(year)) {
            ++n;
        }
        return n;
    };
    DateUtils.firstDayOfWeekInMonth = function (month, year) {
        var t = new Date(year, month, 1);
        return (t.getDay() + 6) % 7;
    };
    DateUtils.lastDayOfWeekInMonth = function (month, year) {
        return this.firstDayOfWeekInMonth(month, year) + this.numDaysInMonth(month, year) - 1;
    };
    DateUtils.isLeapYear = function (year) {
        return ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0);
    };
    DateUtils.prevMonth = function (month, year) {
        --month;
        if (month < 0) {
            month += 12;
            year--;
        }
        return [month, year];
    };
    DateUtils.nextMonth = function (month, year) {
        ++month;
        if (month > 11) {
            month = 0;
            year++;
        }
        return [month, year];
    };
    DateUtils.weekNumber = function (dt, _fixLastWeekOfYear) {
        if (_fixLastWeekOfYear === void 0) { _fixLastWeekOfYear = false; }
        var d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };
    DateUtils.numWeeksInYear = function (year) {
        var lastDay = new Date(year, 11, 31);
        return this.weekNumber(lastDay);
    };
    DateUtils.numWeeksBetween = function (t1, t2) {
        return Math.abs((t2 - t1) / (7 * 86400 * 1000));
    };
    DateUtils.weekStartDate = function (dt) {
        var dayOfWeek = (dt.getDay() + 6) % 7;
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dayOfWeek);
    };
    DateUtils.isToday = function (dt, now) {
        return dt.getDate() == now.getDate() && dt.getMonth() == now.getMonth() && dt.getFullYear() == now.getFullYear();
    };
    DateUtils.getDayMsecs = function (dt) {
        var h = dt.getHours();
        var m = dt.getMinutes() + h * 60;
        var s = dt.getSeconds() + m * 60;
        var ms = dt.getMilliseconds() + s * 1000;
        return ms;
    };
    DateUtils.getWeekStart = function (dt) {
        var dow = (dt.getDay() + 6) % 7;
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dow);
    };
    DateUtils.getWeekEnd = function (dt) {
        var dow = (dt.getDay() + 6) % 7;
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dow + 7);
    };
    DateUtils._daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return DateUtils;
}());
exports.DateUtils = DateUtils;
DateUtils.prototype.className = "com.privmx.plugin.calendar.main.DateUtils";

//# sourceMappingURL=DateUtils.js.map
