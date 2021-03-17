import { JQuery as $, Q } from "pmc-web";
import { FastListEntry } from "privfs-mail-client-tasks-plugin/src/main/FastList";
import { DateUtils } from "../../../main/DateUtils";
import { TaskModel, FileModel } from "../CalendarPanelController";
import { FastListRenderer } from "./FastListRenderer";
import { func as emptyEntryTemplate } from "../template/entry-month.html";
import { TaskGroupIcon } from "privfs-mail-client-tasks-plugin/src/main/Types";
import { SortFilesBy } from "../../../main/Types";

export interface EntryModel {
    weeks: WeekData[];
    monthStr: string;
    start: Date;
    end: Date;
}

export interface WeekData {
    date: Date;
    days: DayData[];
}

export interface DayData {
    date: Date;
    tasks: TaskData[];
    dayNumber: number;
    isToday: boolean;
    isMonthEven: boolean;
    usedDayIndexes: boolean[];
    startTimestamp: number;
    dayId: string;
}

export interface TaskData {
    model: TaskModel;
    fileModel: FileModel;
    text: string;
    leftContinues: boolean;
    rightContinues: boolean;
    dayIndex: number;
    width: number;
    marginLeft: number;
    taskGroupIcons: TaskGroupIcon[];
}

export class MonthRenderer extends FastListRenderer<EntryModel> {
    
    static VISIBLE_RANGE_DELTA_Y = 10;
    static HORIZONTAL_TASK_PADDING = 8;
    static LEFT_HEADERS_WIDTH = 30;
    static TOP_HEADERS_HEIGHT = 23;
    static ZOOM_FACTOR = 1.1;
    
    $container: JQuery = null;
    firstVisibleDate: Date;
    lastVisibleDate: Date;
    firstValidDate: Date;
    lastValidDate: Date;
    weekHeight: number = 100;
    taskHeight: number = 16;
    cachedWeekData: WeekData[] = null;
    cachedDaysByName: { [day: string]: DayData } = null;
    centerAfterRenderArgs: { entryId: number, delta: number } = null;
    expandedDay: string = null;
    $expandedDay: JQuery = null;
    
    init(): Q.Promise<void> {
        if (!this.firstVisibleDate) {
            let thisWeek = DateUtils.weekStartDate(new Date());
            this.firstValidDate = new Date(thisWeek.getFullYear() - MonthRenderer.VISIBLE_RANGE_DELTA_Y, 0, 1);
            this.lastValidDate = new Date(thisWeek.getFullYear() + MonthRenderer.VISIBLE_RANGE_DELTA_Y, 0, 0);
            this.firstVisibleDate = DateUtils.getWeekStart(this.firstValidDate);
            this.lastVisibleDate = DateUtils.getWeekEnd(this.lastValidDate);
        }
        
        this.emptyEntryTemplate = this.view.templateManager.createTemplate(emptyEntryTemplate).renderToJQ()[0];
        
        let $modeContainer = this.view.$container.find(".mode.mode-month");
        this.$container = $modeContainer;
        let container = $modeContainer.find(".fl-container")[0];
        (<any>$(container)).pfScroll();
        container = <HTMLElement>container.childNodes[0];
        let paddingContainer = $modeContainer.find(".fl-padding-container")[0];
        let entriesContainer = $modeContainer.find(".fl-entries-container")[0];
        $(entriesContainer).on("mousewheel", this.onMouseWheel.bind(this));
        $(entriesContainer).on("click", ".more-tasks-info", this.onMoreClick.bind(this));
        $modeContainer.on("click", ".expanded-day-backdrop", this.onExpandedDayBackdropClick.bind(this));
        this.fastList = this.fastListCreator.create(container, paddingContainer, entriesContainer);
        this.fastList.setEmptyElementCreator(this.createFastListEmptyElement.bind(this));
        this.fastList.setElementFiller(this.fillFastListElement.bind(this));
        this.fastList.setAfterRender(this.afterFastListRender.bind(this));
        this.fastList.setAfterContainerResize(this.afterFastListResize.bind(this));
        this.applySettings(false);
        return Q().then(() => {
            let now = new Date();
            this.updateFastListEntries();
            this.goToDate(now.getDate(), now.getMonth(), now.getFullYear());
            this.fastList.init();
        });
    }
    
    getRendererName(): string {
        return "month";
    }
    
    renderFastList(causedByContainerEvent: boolean = false): void {
        let dayWidth = (this.fastList.container.getBoundingClientRect().width - MonthRenderer.LEFT_HEADERS_WIDTH) / 7;
        let dayHeight = this.weekHeight * this.zoom;
        let k = Math.min(dayHeight, dayWidth / 2);
        let fontSize = k * 0.8;
        
        let t = 30;
        if (k > t) {
            fontSize = (30 + (k - t) * 0.4) * 0.8;
        }
        
        this.fastList.render(causedByContainerEvent);
        this.fastList.container.style.fontSize = fontSize + "px";
    }
    
    afterFastListRender(range: [number, number], causedByContainerEvent: boolean): void {
        if (causedByContainerEvent) {
            let activeDate = this.getActiveDate();
            if (activeDate) {
                this.view.setSelectedDate(activeDate.getDate(), activeDate.getMonth(), activeDate.getFullYear(), false);
            }
        }
        else {
            this.goToDate(this.view.model.selectedDay, this.view.model.selectedMonth, this.view.model.selectedYear);
        }
        this.view.updateSelection();
        if (this.centerAfterRenderArgs) {
            if (this.fastList.center(this.centerAfterRenderArgs.entryId, this.centerAfterRenderArgs.delta)) {
                this.centerAfterRenderArgs = null;
            }
        }
    }
    
    onMouseWheel(e: MouseWheelEvent): void {
        if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            let offset = $(this.fastList.container).offset().top;
            let yPos = e.pageY - offset;
            let top = this.fastList.container.scrollTop;
            let midPtY = top + yPos;
            let dy = e.deltaY;
            if (dy < 0) {
                this.zoomIn(midPtY, yPos);
            }
            else if (dy > 0) {
                this.zoomOut(midPtY, yPos);
            }
        }
    }
    
    zoomInOut(zoomIn: boolean, midPtY: number = null, yPos: number = null): void {
        if (yPos === null) {
            yPos = $(this.fastList.container).height() / 2;
        }
        if (midPtY === null) {
            midPtY = this.fastList.container.scrollTop + yPos;
        }
        
        let minZoom = 0.25;
        let maxZoom = 4;
        if (zoomIn) {
            if (this.zoom * MonthRenderer.ZOOM_FACTOR <= maxZoom) {
                this.zoom *= MonthRenderer.ZOOM_FACTOR;
                midPtY *= MonthRenderer.ZOOM_FACTOR;
            }
        }
        else {
            if (this.zoom / MonthRenderer.ZOOM_FACTOR >= minZoom) {
                this.zoom /= MonthRenderer.ZOOM_FACTOR;
                midPtY /= MonthRenderer.ZOOM_FACTOR;
            }
        }
        let top = midPtY - yPos;
        this.fastList.container.scrollTo(0, Math.round(top));
        this.updateZoom();
    }
    
    goToDate(d: number, m: number, y: number): void {
        let entryId = -1;
        let dt = new Date(y, m, d);
        for (let id in this.fastList.entries) {
            let entry = this.fastList.entries[id];
            if (entry.data.start <= dt && entry.data.end > dt) {
                entryId = parseInt(id);
                break;
            }
        }
        if (entryId >= 0) {
            let entry = this.fastList.entries[entryId];
            let id = -1;
            let i = 0;
            for (let week of entry.data.weeks) {
                let dt2 = week.date;
                let dt3 = new Date(week.date.getTime() + 86400000 * 7);
                if (dt >= dt2 && dt < dt3) {
                    id = i;
                    break;
                }
                ++i;
            }
            let delta = id >= 0 ? ((id + 0.5) * this.weekHeight * this.zoom - entry.height / 2) : 0;
            if (!this.fastList.center(entryId, delta)) {
                this.centerAfterRenderArgs = { entryId, delta };
            }
        }
    }
    
    getActiveDate(): Date {
        let viewportHeight = this.fastList.prevContainerInfo ? this.fastList.prevContainerInfo[1] : this.fastList.container.clientHeight;
        let scrollTop = this.fastList.prevContainerInfo ? this.fastList.prevContainerInfo[0] : this.fastList.container.scrollTop;
        let midPt = scrollTop + viewportHeight / 2;
        let weekHeight = this.weekHeight * this.zoom;
        for (let entry of this.fastList.entries) {
            if (entry.startsAt < midPt && entry.startsAt + entry.height >= midPt) {
                let pt = entry.startsAt;
                for (let i = 0; i < entry.data.weeks.length; ++i) {
                    if (pt < midPt && pt + weekHeight >= midPt) {
                        let dt = entry.data.weeks[i].date;
                        if (dt < this.firstValidDate) {
                            dt = new Date(this.firstValidDate.getTime());
                        }
                        else if (dt > this.lastValidDate) {
                            dt = new Date(this.lastValidDate.getTime());
                        }
                        return dt;
                    }
                    pt += weekHeight;
                }
            }
        }
        return null;
    }
    
    getPrevNextAbsDelta(): number {
        return 1;
    }
    
    updateFastListEntries(): void {
        let entries: FastListEntry<EntryModel>[] = [];
        let weeks: WeekData[] = [];
        let firstVisibleYear = this.firstVisibleDate.getFullYear();
        let firstVisibleMonth = this.firstVisibleDate.getMonth();
        let firstVisibleDay = this.firstVisibleDate.getDate();
        let nWeeks = Math.round((this.lastVisibleDate.getTime() - this.firstVisibleDate.getTime()) / (86400 * 7 * 1000));
        let now = new Date();
        let daysByName: { [day: string]: DayData } = {};
        
        // Create data
        if (this.cachedWeekData) {
            let nowTs = now.getTime();
            weeks = this.cachedWeekData;
            daysByName = this.cachedDaysByName;
            for (let k in daysByName) {
                let day = daysByName[k];
                day.tasks = [];
                day.isToday = nowTs >= day.startTimestamp && nowTs < (day.startTimestamp + 86400000);
                (<any>day.usedDayIndexes).fill(false);
            }
        }
        else {
            for (let i = 0; i < nWeeks; ++i) {
                let weekStart = new Date(firstVisibleYear, firstVisibleMonth, firstVisibleDay + i * 7);
                
                let days: DayData[] = [];
                for (let j = 0; j < 7; ++j) {
                    let dayStart = new Date(firstVisibleYear, firstVisibleMonth, firstVisibleDay + i * 7 + j);
                    let day: DayData = {
                        date: dayStart,
                        tasks: [],
                        dayNumber: dayStart.getDate(),
                        isToday: DateUtils.isToday(dayStart, now),
                        isMonthEven: dayStart.getMonth() % 2 == 0,
                        usedDayIndexes: (<any>Array(40)).fill(false),
                        startTimestamp: dayStart.getTime(),
                        dayId: dayStart.getDate() + "." + dayStart.getMonth() + "." + dayStart.getFullYear(),
                    };
                    days.push(day);
                    let dayStr = dayStart.getDate() + "." + dayStart.getMonth() + "." + dayStart.getFullYear();
                    daysByName[dayStr] = day;
                }
                
                weeks.push({
                    date: weekStart,
                    days: days,
                });
            }
            this.cachedWeekData = weeks;
            this.cachedDaysByName = daysByName;
        }

        // Add tasks
        let weekMs = 7 * 86400000;
        let ellipsisLength = this.getEllipsisLength();
        let availWidthDelta = -ellipsisLength - MonthRenderer.HORIZONTAL_TASK_PADDING;
        let rect = this.view.getFragmentsContainerRect();
        let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
        for (let taskId in this.view.model.tasks) {
            let task = this.view.model.tasks[taskId];
            if (!this.taskMatchesSearchString(taskId, task.title)) {
                continue;
            }
            if (!this.taskMatchesFilter(taskId)) {
                continue;
            }
            let start = task.startTimestamp;
            let end = task.endTimestamp;
            let dt0 = new Date(task.startTimestamp);
            let wholeDays = task.wholeDays;
            let origText = task.title.trim() + (wholeDays ? "" : " (" + pad0s(dt0.getHours()) + ":" + pad0s(dt0.getMinutes()) + ")");
            let text = origText;
            let duration = (task.endTimestamp - task.startTimestamp);
            if (wholeDays) {
                let dt1 = new Date(task.endTimestamp);
                let t0 = new Date(dt0.getFullYear(), dt0.getMonth(), dt0.getDate());
                let t1 = new Date(dt1.getFullYear(), dt1.getMonth(), dt1.getDate() + 1);
                duration = <any>t1 - <any>t0;
                start = t0.getTime();
                dt0 = t0;
            }
            let n = Math.ceil((duration + (((((dt0.getHours() * 60) + dt0.getMinutes()) * 60) + dt0.getSeconds()) * 1000)) / 86400000);
            let prevWeek = -999999;
            for (let i = 0; i < n; ++i) {
                let dt = new Date(start + i * 86400000);
                let dayStr = dt.getDate() + "." + dt.getMonth() + "." + dt.getFullYear();
                if (dayStr in daysByName) {
                    let isDayExpanded = this.expandedDay == dayStr;
                    let dt2 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                    let week = DateUtils.weekNumber(dt2);
                    let rangeStart = dt2.getTime();
                    let rangeEnd = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1).getTime();
                    let fragmentText = "";
                    let fragmentWidth = 0;
                    let nFragments = 0;
                    if (prevWeek != week || isDayExpanded) {
                        prevWeek = week;
                        fragmentWidth = (rangeEnd - rangeStart) / weekMs * rect.w;
                        let dow = (dt2.getDay() + 6) % 7;
                        nFragments = prevWeek != week && isDayExpanded ? 1 : Math.min(n - i, 7 - dow);
                        let shrinkByIcons = 0;
                        if (i == 0 && task.taskGroupIcons.length > 0) {
                            shrinkByIcons = task.taskGroupIcons.length * 13;
                        }
                        let currText = isDayExpanded ? origText : text;
                        let breakAt = this.view.parent.fontMetrics.getMaxTextLength(currText, fragmentWidth * nFragments + availWidthDelta - shrinkByIcons, true);
                        fragmentText = currText.substr(0, breakAt) + (breakAt == currText.length ? "" : "...");
                        text = text.substr(breakAt);
                        if (text.length > 0) {
                            text = "..." + text.trim();
                        }
                        else if (dow == 0 && i > 0) {
                            let taskTitle = "↳" + task.title.trim();
                            let breakAt = this.view.parent.fontMetrics.getMaxTextLength(taskTitle, fragmentWidth * nFragments + availWidthDelta - shrinkByIcons, true);
                            fragmentText = taskTitle.substr(0, breakAt) + (breakAt == taskTitle.length ? "" : "...");
                        }
                    }
                    let endsThisWeek = week == DateUtils.weekNumber(new Date(task.endTimestamp));
                    // let isDayExpanded = this.expandedDay == dayStr;
                    // let isPlaceholder = fragmentText === null || (fragmentText === "" && fragmentWidth * nFragments == 0);
                    // if (isDayExpanded && isPlaceholder) {
                    //     fragmentText = task.text
                    // }
                    let taskData: TaskData = {
                        model: task,
                        fileModel: null,
                        text: fragmentText,
                        leftContinues: start < rangeStart,
                        rightContinues: end > rangeEnd && !endsThisWeek,
                        dayIndex: null,
                        width: fragmentWidth * nFragments,
                        marginLeft: null,
                        taskGroupIcons: i == 0 ? task.taskGroupIcons : [],
                    };
                    if (isDayExpanded && taskData.leftContinues) {
                        taskData.width += 9;
                        if (taskData.rightContinues) {
                            taskData.width += 9;
                        }
                        taskData.marginLeft = -9;
                    }
                    daysByName[dayStr].tasks.push(taskData);
                }
            }
        }
        
        // Add files
        if (this.view.model.settings["show-files"]) {
            for (let identifier in this.view.model.files) {
                let file = this.view.model.files[identifier];
                if (!this.fileMatchesSearchString(file.fileName)) {
                    continue;
                }
                if (!this.fileMatchesFilter(identifier)) {
                    continue;
                }
                let dt = new Date(file.createdAt);
                let dayStr = dt.getDate() + "." + dt.getMonth() + "." + dt.getFullYear();
                let day = daysByName[dayStr];
                if (day) {
                    let fragmentWidth = rect.w / 7;
                    let shrinkByIcons = 13 + 5;
                    let text = file.fileName;
                    let breakAt = this.view.parent.fontMetrics.getMaxTextLength(text, fragmentWidth + availWidthDelta - shrinkByIcons, false);
                    let fragmentText = text.substr(0, breakAt) + (breakAt == text.length ? "" : "...");
                    day.tasks.push({
                        model: null,
                        fileModel: file,
                        text: fragmentText,
                        leftContinues: false,
                        rightContinues: false,
                        dayIndex: null,
                        width: rect.w / 7,
                        marginLeft: null,
                        taskGroupIcons: [],
                    });
                }
            }
        }
        
        // Sort tasks by start timestamp in each day
        let sortFilesBy = <SortFilesBy>this.view.getSetting("sort-files-by");
        let sortFilesByCreated = sortFilesBy == SortFilesBy.CREATED;
        for (let dayName in daysByName) {
            daysByName[dayName].tasks.sort((a, b) => {
                // Tasks appear before files
                if ((a.fileModel && !b.fileModel) || (!a.fileModel && b.fileModel)) {
                    return a.fileModel ? 1 : -1;
                }
                
                // Compare dates
                let aStart = a.model ? a.model.startTimestamp : (sortFilesByCreated ? a.fileModel.createdAt : a.fileModel.modifiedAt);
                let bStart = b.model ? b.model.startTimestamp : (sortFilesByCreated ? b.fileModel.createdAt : b.fileModel.modifiedAt);
                return sortFilesByCreated ? (aStart - bStart) : (bStart - aStart);
            });
        }
        
        // Arrange tasks vertically
        for (let i = 0; i < weeks.length; ++i) {
            let week = weeks[i];
            for (let j = 0; j < week.days.length; ++j) {
                let day = week.days[j];
                for (let k = 0; k < day.tasks.length; ++k) {
                    let task = day.tasks[k];
                    if (task.dayIndex === null) {
                        task.dayIndex = day.usedDayIndexes.indexOf(false);
                        if (task.dayIndex >= 0 && task.dayIndex < 40) {
                            day.usedDayIndexes[task.dayIndex] = true;
                        }
                    }
                    if (j + 1 < week.days.length) {
                        for (let task2 of week.days[j + 1].tasks) {
                            if (task2.model && task.model && task2.model.id == task.model.id) {
                                task2.dayIndex = task.dayIndex;
                                if (task.dayIndex >= 0 && task.dayIndex < 40) {
                                    week.days[j + 1].usedDayIndexes[task.dayIndex] = true;
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        // Sort tasks by day index in each day
        for (let dayName in daysByName) {
            daysByName[dayName].tasks.sort((a, b) => a.dayIndex - b.dayIndex);
        }
        
        // Create entries
        for (let i = 0; i < weeks.length; ++i) {
            let dt = weeks[i].date;
            let end = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 7);
            let monthStr = this.view.parent.i18n("plugin.calendar.component.calendarPanel.month." + dt.getMonth()) + " " + dt.getFullYear();
            if (entries.length < 1 || entries[entries.length - 1].data.monthStr != monthStr) {
                entries.push({
                    data: {
                        weeks: [],
                        monthStr: monthStr,
                        start: dt,
                        end: end,
                    },
                    height: 0,
                    startsAt: 0,
                });
            }
            let entry = entries[entries.length - 1];
            entry.data.weeks.push(weeks[i]);
            entry.height += this.weekHeight * this.zoom;
            entry.data.end = end;
        }
        this.fastList.setEntries(entries);
    }
    
    fillFastListElement(element: HTMLElement, entry: FastListEntry<EntryModel>): void {
        let maxNumOfTasks = Math.floor(this.weekHeight * this.zoom / this.taskHeight) - 1;
        element.style.height = entry.height + "px";
        element.children[0].textContent = entry.data.monthStr;
        element.children[0].classList.toggle("even", entry.data.weeks[0].days[0].isMonthEven);
        let statuses = this.view.model.taskStatuses;
        for (let weekId = 0; weekId < entry.data.weeks.length; ++weekId) {
            let week = entry.data.weeks[weekId];
            element.children[1].children[weekId].classList.remove("hidden");
            (<HTMLElement>element.children[1].children[weekId]).style.height = (this.weekHeight * this.zoom) + "px";
            for (let dayId in week.days) {
                let day = week.days[dayId];
                let dayEl = element.children[1].children[weekId].children[dayId];
                let isDayExpanded = this.expandedDay == day.dayId;
                dayEl.setAttribute("data-day", day.dayId);
                dayEl.children[0].textContent = day.dayNumber.toString();
                dayEl.children[1].innerHTML = "";
                dayEl.classList.toggle("today", day.isToday);
                dayEl.classList.toggle("even", day.isMonthEven);
                dayEl.classList.toggle("expanded-day", isDayExpanded);
                
                let numOfTasks = day.tasks.length;
                let maxVisibleDayIndex = -1;
                let numOfVisibleTasks = 0;
                let currMaxNumOfTasks = maxNumOfTasks;
                if (isDayExpanded) {
                    currMaxNumOfTasks = 99999;
                }
                for (let i = 0; i < numOfTasks; ++i) {
                    let task = day.tasks[i];
                    if (task.dayIndex === null) {
                        continue;
                    }
                    // Use if below instead of the lower one to prevent more tasks message from showing and hiding task when not necessary (buggy).
                    // if (task.dayIndex > maxNumOfTasks || (task.dayIndex == maxNumOfTasks && i < numOfTasks - 1)) {
                    //     break;
                    // }
                    if (task.dayIndex >= currMaxNumOfTasks) {
                        break;
                    }
                    ++numOfVisibleTasks;
                    maxVisibleDayIndex = Math.max(maxVisibleDayIndex, task.dayIndex);
                    if (task) {
                        let taskEl = document.createElement("div");
                        taskEl.setAttribute("draggable", task.model ? "true" : "false");
                        if (task.model) {
                            taskEl.className = "task has-task-tooltip";
                        }
                        else {
                            taskEl.className = "task has-file-tooltip";
                        }
                        dayEl.children[1].appendChild(taskEl);
                        let isPlaceholder = task.text === null || (task.text === "" && task.width == 0);
                        taskEl.classList.add("visible");
                        taskEl.textContent = task.text;
                        if (task.taskGroupIcons && task.taskGroupIcons.length > 0) {
                            for (let tgIcon of task.taskGroupIcons) {
                                let tpl = this.view.emptyTgIconTemplates[this.view.getIconId(tgIcon)];
                                let el = <HTMLElement>tpl.cloneNode(true);
                                el.style.color = tgIcon.color;
                                $(taskEl).prepend(el);
                            }
                        }
                        else if (task.fileModel && task.fileModel.icon) {
                            let el = document.createElement("span");
                            el.className = "file-icon " + task.fileModel.icon;
                            $(taskEl).prepend(el);
                        }
                        taskEl.classList.toggle("placeholder", isPlaceholder);
                        if (!isPlaceholder) {
                            (<HTMLElement>taskEl).style.width = task.width + "px";
                            if (task.marginLeft !== null) {
                                (<HTMLElement>taskEl).style.marginLeft = task.marginLeft + "px";
                                (<HTMLElement>taskEl).style.paddingLeft = (-task.marginLeft + 4) + "px";
                            }
                            taskEl.setAttribute("data-task-id", task.model ? task.model.id : "");
                            taskEl.setAttribute("data-file-id", task.fileModel ? task.fileModel.identifier : "");
                            for (let status of statuses) {
                                taskEl.classList.remove("task-status-" + status);
                            }
                            taskEl.classList.toggle("is-task", !!task.model);
                            taskEl.classList.toggle("is-file", !!task.fileModel);
                            if (task.model) {
                                taskEl.classList.add("task-status-" + task.model.status);
                            }
                            taskEl.classList.toggle("left-continues", task.leftContinues);
                            taskEl.classList.toggle("right-continues", task.rightContinues);
                        }
                    }
                }
                let maxIdx = maxVisibleDayIndex;
                for (let i = 0; i < 1000; ++i) {
                    let taskEl = dayEl.children[1].children[i];
                    if (taskEl) {
                        taskEl.classList.toggle("visible", i <= maxVisibleDayIndex);
                        if (day.tasks[i]) {
                            maxIdx = Math.max(maxIdx, day.tasks[i].dayIndex);
                        }
                    }
                    else {
                        break;
                    }
                }
                numOfVisibleTasks = Math.min(numOfVisibleTasks, maxVisibleDayIndex + 1);
                let hasMoreTasks = numOfTasks > numOfVisibleTasks;
                let lastTaskBottom = numOfVisibleTasks * this.taskHeight;
                (<HTMLElement>dayEl.children[2]).style.top = (lastTaskBottom + 2) + "px";
                let numMoreThings = numOfTasks - numOfVisibleTasks;
                let i18nKey = "plugin.calendar.component.calendarPanel.more-tasks-info." + (numMoreThings == 1 ? "one" : "many");
                dayEl.children[2].textContent = hasMoreTasks ? this.view.parent.i18n(i18nKey, numMoreThings) : "";
                if (hasMoreTasks) {
                    dayEl.children[2].innerHTML += '<i class="fa fa-caret-down"></i>';
                }
            }
        }
        for (let weekId = entry.data.weeks.length; weekId < 6; ++weekId) {
            element.children[1].children[weekId].classList.add("hidden");
        }
    }
    
    onMoreClick(e: MouseEvent): void {
        let $day = <JQuery>$(e.currentTarget).closest("[data-day]");
        let day = $day.data("day");
        if (!day) {
            return;
        }
        this.expandedDay = day;
        this.$expandedDay = $day;
        this.repaint();
        this.$expandedDay.addClass("expanded-day");
        this.$container.addClass("with-expanded-day");
        this.view.onDayClick(e);
    }
    
    onExpandedDayBackdropClick(): void {
        if (this.expandedDay) {
            this.$container.removeClass("with-expanded-day");
            this.$expandedDay.removeClass("expanded-day");
            this.expandedDay = null;
            this.$expandedDay = null;
            this.repaint();
        }
    }
    
}
