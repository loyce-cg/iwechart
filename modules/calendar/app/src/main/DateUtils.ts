
export enum DayOfWeek {
    MON = 0,
    TUE = 1,
    WED = 2,
    THU = 3,
    FRI = 4,
    SAT = 5,
    SUN = 6,
}

export enum Month {
    JAN = 0,
    FEB = 1,
    MAR = 2,
    APR = 3,
    MAY = 4,
    JUN = 5,
    JUL = 6,
    AUG = 7,
    SEP = 8,
    OCT = 9,
    NOV = 10,
    DEC = 11,
}

export class DateUtils {
    
    private static _daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    static numDaysInMonth(month: number, year: number): number {
        let n = this._daysInMonth[month];
        if (month == Month.FEB && this.isLeapYear(year)) {
            ++n;
        }
        return n;
    }
    
    static firstDayOfWeekInMonth(month: number, year: number): DayOfWeek {
        let t = new Date(year, month, 1);
        return (t.getDay() + 6) % 7;
    }
    
    static lastDayOfWeekInMonth(month: number, year: number): DayOfWeek {
        return this.firstDayOfWeekInMonth(month, year) + this.numDaysInMonth(month, year) - 1;
    }
    
    static isLeapYear(year: number): boolean {
        return ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0);
    }
    
    static prevMonth(month: number, year: number): [number, number] {
        --month;
        if (month < 0) {
            month += 12;
            year--;
        }
        return [month, year];
    }
    
    static nextMonth(month: number, year: number): [number, number] {
        ++month;
        if (month > 11) {
            month = 0;
            year++;
        }
        return [month, year];
    }
    
    static weekNumber(dt: Date, _fixLastWeekOfYear: boolean = false): number {
        // https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
        var d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7)
    }
    
    // static weekNumber(dt: Date, _fixLastWeekOfYear: boolean = false): number {
    //     // https://weeknumber.net/how-to/javascript
    //     let date = new Date(dt.getTime() - (_fixLastWeekOfYear ? 86400000 * 7 : 0));
    //     date.setHours(0, 0, 0, 0);
    //     date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    //     let week1 = new Date(date.getFullYear(), 0, 4);
    //     let wn = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    //     if (!_fixLastWeekOfYear && dt.getMonth() == 11 && wn < 50) {
    //         return this.weekNumber(dt, true);
    //     }
    //     return wn;
    // }
    
    static numWeeksInYear(year: number): number {
        let lastDay = new Date(year, 11, 31);
        return this.weekNumber(lastDay);
    }
    
    static numWeeksBetween(t1: Date, t2: Date): number {
        return Math.abs((<any>t2 - <any>t1) / (7 * 86400 * 1000));
    }
    
    static weekStartDate(dt: Date): Date {
        let dayOfWeek = (dt.getDay() + 6) % 7;
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dayOfWeek);
    }
    
    static isToday(dt: Date, now: Date): boolean {
        return dt.getDate() == now.getDate() && dt.getMonth() == now.getMonth()  && dt.getFullYear() == now.getFullYear();
    }
    
    static getDayMsecs(dt: Date): number {
        let h = dt.getHours();
        let m = dt.getMinutes() + h * 60;
        let s = dt.getSeconds() + m * 60;
        let ms = dt.getMilliseconds() + s * 1000;
        return ms;
    }
    
    static getWeekStart(dt: Date): Date {
        let dow = (dt.getDay() + 6) % 7;
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dow);
    }
    
    static getWeekEnd(dt: Date): Date {
        let dow = (dt.getDay() + 6) % 7;
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dow + 7);
    }
    
}
