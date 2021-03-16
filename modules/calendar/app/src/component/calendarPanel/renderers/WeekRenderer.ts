import { JQuery as $, Q } from "pmc-web";
import { FastListEntry } from "privfs-mail-client-tasks-plugin/src/main/FastList";
import { DateUtils } from "../../../main/DateUtils";
import { TaskModel, FileModel } from "../CalendarPanelController";
import { FastListRenderer, ZoomMode } from "./FastListRenderer";
import { func as emptyEntryTemplate } from "../template/entry-week.html";
import { VirtualScrollZoom } from "../VirtualScrollZoom";

export interface EntryModel {
    day: DayData;
    start: Date;
    end: Date;
    containerRectWidth: number;
    containerRectHeight: number;
    containerRectLeft: number;
    containerRectTop: number;
}

export interface DayData {
    date: Date;
    tasks: TaskData[];
    dayNumber: number;
    isToday: boolean;
    startTimestamp: number;
    dateStr: string;
    dayId: string;
}

export interface TaskData {
    model: TaskModel;
    fileModel: FileModel;
    text: string;
    width: number;
    left: number;
    maxNumOfSimultTasks: number;
    dayTaskStart: number;
    dayTaskEnd: number;
    topContinues: boolean;
    bottomContinues: boolean;
    wholeDay: boolean;
}

export class WeekRenderer extends FastListRenderer<EntryModel> {
    
    static VISIBLE_RANGE_DELTA_W = 500;
    static HORIZONTAL_TASK_PADDING = 8;
    static HEADERS_HEIGHT = 23;
    static TASK_PADDING_TOP_PLUS_BOTTOM = 4;
    static TASK_LINE_HEIGHT = 15;
    static LEFT_HEADERS_WIDTH = 40;
    static ZOOM_FACTOR = 1.1;
    
    firstVisibleWeek: Date;
    lastVisibleWeek: Date;
    dayWidth: number = 400;
    cachedDays: DayData[] = null;
    cachedDaysByName: { [day: string]: DayData } = null;
    rects: { x1: number, x2: number, y1: number, y2: number, el: HTMLElement, taskId: string }[] = [];
    vsz: VirtualScrollZoom;
    centerAfterRenderArgs: { entryId: number, delta: number } = null;
    
    init(): Q.Promise<void> {
        if (!this.firstVisibleWeek) {
            let thisWeek = DateUtils.weekStartDate(new Date());
            this.firstVisibleWeek = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - WeekRenderer.VISIBLE_RANGE_DELTA_W * 7);
            this.lastVisibleWeek = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() + WeekRenderer.VISIBLE_RANGE_DELTA_W * 7);
        }
        
        this.emptyEntryTemplate = this.view.templateManager.createTemplate(emptyEntryTemplate).renderToJQ()[0];
        
        let $modeContainer = this.view.$container.find(".mode.mode-week");
        let container = $modeContainer.find(".fl-container")[0];
        (<any>$(container)).pfScroll();
        container = <HTMLElement>container.childNodes[0];
        let paddingContainer = $modeContainer.find(".fl-padding-container")[0];
        let entriesContainer = $modeContainer.find(".fl-entries-container")[0];
        $(entriesContainer).on("mousewheel", this.onMouseWheel.bind(this));
        this.fastList = this.fastListCreator.create(container, paddingContainer, entriesContainer);
        this.fastList.setEmptyElementCreator(this.createFastListEmptyElement.bind(this));
        this.fastList.setElementFiller(this.fillFastListElement.bind(this));
        this.fastList.setBeforeRender(this.beforeFastListRender.bind(this));
        this.fastList.setAfterRender(this.afterFastListRender.bind(this));
        this.fastList.setAfterContainerResize(this.afterFastListResize.bind(this), false, $modeContainer[0]);
        
        let vsz = new VirtualScrollZoom(-WeekRenderer.HEADERS_HEIGHT);
        this.vsz = vsz;
        vsz.$container = $(entriesContainer);
        this.updateVszElements();
        vsz.init();
        
        this.applySettings(false);
        return Q().then(() => {
            this.updateFastListEntries();
            this.centerFastList();
            this.fastList.init();
        });
    }
    
    updateVszElements(): void {
        this.vsz.elements = [];
        
        $(this.fastList.entriesContainer).find(".entry-tasks").each((idx, el) => {
            this.vsz.elements.push({
                $element: $(el),
                $viewport: $(el).closest(".entry.day"),
            });
        });
        let $hci = $(this.fastList.entriesContainer).closest(".mode.mode-week").find(".hours-container-inner");
        this.vsz.elements.push({
            $element: $hci,
            $viewport: $hci.closest(".hours-container"),
        });
    }
    
    getRendererName(): string {
        return "week";
    }
    
    renderFastList(causedByContainerEvent: boolean = false): void {
        this.fastList.render(causedByContainerEvent);
    }
    
    beforeFastListRender(): void {
        this.rects = [];
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
        
        // Find hover task id
        let hoverTaskId: string = null;
        let x = this.view.mouseX;
        let y = this.view.mouseY;
        for (let r of this.rects) {
            if (x >= r.x1 && x < r.x2 && y >= r.y1 && y < r.y2) {
                hoverTaskId = r.taskId;
                break;
            }
        }
        
        // Mark the task as hover
        if (hoverTaskId !== null) {
            for (let r of this.rects) {
                if (r.taskId == hoverTaskId) {
                    r.el.classList.add("hover");
                }
            }
        }
        
        this.updateVszElements();
        this.vsz.repaint();
        
        if (this.centerAfterRenderArgs) {
            if (this.fastList.center(this.centerAfterRenderArgs.entryId, this.centerAfterRenderArgs.delta)) {
                this.centerAfterRenderArgs = null;
            }
        }
    }
    
    onMouseWheel(e: MouseWheelEvent): void {
        if (this.zoomMode == ZoomMode.FIXED) {
            return;
        }
        if (e.shiftKey && !e.ctrlKey && !e.altKey) {
            return;
        }
        if (e.ctrlKey && e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            let offset = $(this.fastList.container).offset().left;
            let yPos = e.pageX - offset;
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
            yPos = $(this.fastList.container).width() / 2;
        }
        if (midPtY === null) {
            midPtY = this.fastList.container.scrollTop + yPos;
        }
        
        let minZoom = 0.25;
        let maxZoom = 4;
        if (zoomIn) {
            if (this.zoom * WeekRenderer.ZOOM_FACTOR <= maxZoom) {
                this.zoom *= WeekRenderer.ZOOM_FACTOR;
                midPtY *= WeekRenderer.ZOOM_FACTOR;
            }
        }
        else {
            if (this.zoom / WeekRenderer.ZOOM_FACTOR >= minZoom) {
                this.zoom /= WeekRenderer.ZOOM_FACTOR;
                midPtY /= WeekRenderer.ZOOM_FACTOR;
            }
        }
        let top = midPtY - yPos;
        this.fastList.container.scrollTo(0, Math.round(top));
        this.updateZoom();
    }
    
    goToDate(d: number, m: number, y: number): void {
        let entryId = -1;
        let dt = new Date(y, m, d, 12);
        for (let id in this.fastList.entries) {
            let entry = this.fastList.entries[id];
            if (entry.data.start <= dt && entry.data.end >= dt) {
                entryId = parseInt(id);
                break;
            }
        }
        if (entryId >= 0) {
            if (!this.fastList.center(entryId)) {
                this.centerAfterRenderArgs = { entryId, delta: null };
            }
        }
    }
    
    getActiveDate(): Date {
        let viewportHeight = this.fastList.prevContainerInfo ? this.fastList.prevContainerInfo[1] : this.fastList.container.clientHeight;
        let scrollTop = this.fastList.prevContainerInfo ? this.fastList.prevContainerInfo[0] : this.fastList.container.scrollTop;
        let midPt = scrollTop + viewportHeight / 2;
        for (let entry of this.fastList.entries) {
            if (entry.startsAt < midPt && entry.startsAt + entry.height >= midPt) {
                return entry.data.day.date;
            }
        }
        return null;
    }
    
    adjustHoursSeparators(availHeight: number): void {
        let minCellHeight = 40;
        let availModes = [1, 2, 3, 4];
        let dstMode = availModes[availModes.length - 1];
        for (let mode of availModes) {
            let h = 24 / mode * minCellHeight;
            if (h < availHeight) {
                dstMode = mode;
                break;
            }
        }
        for (let mode of availModes) {
            $(this.fastList.container).closest(".mode-week").toggleClass("hour-separators-1_" + mode, mode == dstMode);
        }
    }
    
    getPrevNextAbsDelta(): number {
        return 1;
    }
    
    updateFastListEntries(): void {
        let entries: FastListEntry<EntryModel>[] = [];
        let nDays = (WeekRenderer.VISIBLE_RANGE_DELTA_W * 2 + 1) * 7;
        let firstVisibleYear = this.firstVisibleWeek.getFullYear();
        let firstVisibleMonth = this.firstVisibleWeek.getMonth();
        let firstVisibleDay = this.firstVisibleWeek.getDate();
        let now = new Date();
        let daysByName: { [day: string]: DayData } = {};
        let days: DayData[] = [];
        
        // Get rect
        let el = <HTMLElement>this.fastList.container.parentElement.parentElement;
        let r = el.getBoundingClientRect();
        this.fastList.container.parentElement.style.width = r.height + "px";
        this.fastList.container.parentElement.style.height = r.width + "px";
        let rect = this.view.getFragmentsContainerRect();
        this.adjustHoursSeparators(rect.h);
        
        // Create data
        if (this.cachedDays) {
            let nowTs = now.getTime();
            days = this.cachedDays;
            daysByName = this.cachedDaysByName;
            for (let k in daysByName) {
                let day = daysByName[k];
                day.tasks = [];
                day.isToday = nowTs >= day.startTimestamp && nowTs < (day.startTimestamp + 86400000);
            }
        }
        else {
            let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
            let daysTr: string[] = [];
            for (let i = 0; i < 7; ++i) {
                daysTr.push(this.view.parent.i18n("plugin.calendar.component.calendarPanel.daysOfWeek.short." + i));
            }
            for (let i = 0; i < nDays; ++i) {
                let dayStart = new Date(firstVisibleYear, firstVisibleMonth, firstVisibleDay + i);
                let dayStr = dayStart.getDate() + "." + dayStart.getMonth() + "." + dayStart.getFullYear();
                let day: DayData = {
                    date: dayStart,
                    tasks: [],
                    dayNumber: dayStart.getDate(),
                    isToday: DateUtils.isToday(dayStart, now),
                    startTimestamp: dayStart.getTime(),
                    dateStr: daysTr[(dayStart.getDay() + 6) % 7] + ", " + pad0s(dayStart.getDate()) + "." + pad0s(dayStart.getMonth() + 1) + "." + dayStart.getFullYear(),
                    dayId: dayStart.getDate() + "." + dayStart.getMonth() + "." + dayStart.getFullYear(),
                };
                days.push(day);
                daysByName[dayStr] = day;
            }
            this.cachedDays = days;
            this.cachedDaysByName = daysByName;
        }
        
        // Add tasks
        let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
        let maxTaskWidth: number = this.dayWidth * this.zoom;
        for (let taskId in this.view.model.tasks) {
            let task = this.view.model.tasks[taskId];
            if (!this.taskMatchesSearchString(taskId, task.title)) {
                continue;
            }
            if (!this.taskMatchesFilter(taskId)) {
                continue;
            }
            let wholeDays = task.wholeDays;
            let dt0 = new Date(task.startTimestamp);
            let duration = wholeDays ? 86400000 : (task.endTimestamp - task.startTimestamp);
            let n = Math.ceil((duration + (((((dt0.getHours() * 60) + dt0.getMinutes()) * 60) + dt0.getSeconds()) * 1000)) / 86400000);
            for (let i = 0; i < n; ++i) {
                let dt = new Date(task.startTimestamp + i * 86400000);
                let dayStr = dt.getDate() + "." + dt.getMonth() + "." + dt.getFullYear();
                let day = daysByName[dayStr];
                if (day) {
                    let dayTaskStart = Math.max(task.startTimestamp, day.startTimestamp) - day.startTimestamp;
                    let dayTaskEnd = Math.min(task.endTimestamp, day.startTimestamp + 86400000) - day.startTimestamp;
                    day.tasks.push({
                        model: task,
                        fileModel: null,
                        text: task.title.trim() + (task.startTimestamp >= day.startTimestamp && !wholeDays ? " (" + pad0s(dt0.getHours()) + ":" + pad0s(dt0.getMinutes()) + ")" : ""),
                        width: maxTaskWidth,
                        left: 0,
                        maxNumOfSimultTasks: 0,
                        dayTaskStart: dayTaskStart,
                        dayTaskEnd: dayTaskEnd,
                        topContinues: task.startTimestamp < day.startTimestamp,
                        bottomContinues: task.endTimestamp > day.startTimestamp + 86400000,
                        wholeDay: wholeDays || task.startTimestamp <= day.startTimestamp && task.endTimestamp >= day.startTimestamp + 86400000,
                    });
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
                    let dayTaskStart = Math.max(file.createdAt, day.startTimestamp) - day.startTimestamp;
                    let dayTaskEnd = dayTaskStart;
                    day.tasks.push({
                        model: null,
                        fileModel: file,
                        text: file.fileName,
                        width: maxTaskWidth,
                        left: 0,
                        maxNumOfSimultTasks: 0,
                        dayTaskStart: dayTaskStart,
                        dayTaskEnd: dayTaskEnd,
                        topContinues: false,
                        bottomContinues: false,
                        wholeDay: false,
                    });
                }
            }
        }
        
        // Sort tasks by start timestamp in each day
        for (let day of days) {
            day.tasks.sort((a, b) => {
                let aStart = a.model ? a.model.startTimestamp : a.fileModel.createdAt;
                let bStart = b.model ? b.model.startTimestamp : b.fileModel.createdAt;
                return aStart - bStart;
            });
        }
        
        // Collect task start/end points, sort them, then calculate tasks widths and positions
        for (let day of days) {
            let points: { at: number, task: TaskData, start: boolean }[] = [];
            for (let task of day.tasks) {
                let startTs = task.model ? task.model.startTimestamp : task.fileModel.createdAt;
                let endTs = task.model ? task.model.endTimestamp : task.fileModel.createdAt;
                points.push({ at: startTs, task: task, start: true });
                points.push({ at: endTs, task: task, start: false });
            }
            points.sort((a, b) => {
                if (a.at != b.at) {
                    return a.at - b.at;
                }
                return (a.start ? 1 : 0) - (b.start ? 1 : 0);
            });
            
            // Count simult tasks
            let nSimultTasks: number = 0;
            let nSimultTasksMap: { [taskId: string]: number } = {};
            for (let pt of points) {
                let taskOrFileId = pt.task.model ? pt.task.model.id : pt.task.fileModel.identifier;
                if (pt.start) {
                    ++nSimultTasks;
                    for (let id in nSimultTasksMap) {
                        nSimultTasksMap[id] = Math.max(nSimultTasksMap[id], nSimultTasks);
                    }
                    nSimultTasksMap[taskOrFileId] = nSimultTasks;
                }
                else {
                    --nSimultTasks;
                    pt.task.maxNumOfSimultTasks = nSimultTasksMap[taskOrFileId];
                    delete nSimultTasksMap[taskOrFileId];
                }
            }
            
            // Set task sizes
            let maxTaskWidth: number = this.dayWidth * this.zoom;
            for (let task of day.tasks) {
                task.width = maxTaskWidth / task.maxNumOfSimultTasks;
            }
            
            // Set task positions
            let currTasks: TaskData[] = [];
            for (let pt of points) {
                if (pt.start) {
                    currTasks.sort((a, b) => a.left - b.left);
                    let left = 0;
                    for (let t of currTasks) {
                        if (t.left - left >= pt.task.width) {
                            break;
                        }
                        left = t.left + t.width;
                    }
                    pt.task.left = left;
                    currTasks.push(pt.task);
                }
                else {
                    let idx = currTasks.indexOf(pt.task);
                    if (idx >= 0) {
                        currTasks.splice(idx, 1);
                    }
                }
            }
        }
        
        // // Left gravity algorithm
        // for (let day of days) {
        //     // Sort tasks by duration DESC (in that day), then start time ASC
        //     day.tasks.sort((a, b) => {
        //         let ad = a.dayTaskEnd - a.dayTaskStart;
        //         let bd = b.dayTaskEnd - b.dayTaskStart;
        //         if (ad != bd) {
        //             return bd - ad;
        //         }
        //         return a.dayTaskStart - b.dayTaskStart;
        //     });
            
        //     // For each task, check if it collides with any previous task. If so, move the task.
        //     for (let i = 1, n = day.tasks.length; i < n; ++i) {
        //         let t = day.tasks[i];
        //         for (let j = 0; j < i; ++j) {
        //             let t2 = day.tasks[j];
        //         }
        //     }
        // }
        
        // Create entries
        for (let i = 0; i < days.length; ++i) {
            let dt = days[i].date;
            let end = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1);
            entries.push({
                data: {
                    day: days[i],
                    start: dt,
                    end: end,
                    containerRectWidth: rect.w,
                    containerRectHeight: rect.h,
                    containerRectLeft: rect.x,
                    containerRectTop: rect.y,
                },
                height: this.dayWidth * this.zoom,
                startsAt: 0,
            });
        }
        
        // Set entries
        this.fastList.setEntries(entries);
    }
    
    fillFastListElement(element: HTMLElement, entry: FastListEntry<EntryModel>, entryId: number): void {
        element.style.width = entry.data.containerRectHeight + "px";
        element.style.height = entry.height + "px";
        element.classList.add("day");
        element.classList.toggle("today", entry.data.day.isToday);
        element.setAttribute("data-day", entry.data.day.dayId);
        
        let inner = <HTMLElement>element.children[0];
        inner.style.width = entry.height + "px";
        inner.style.height = entry.data.containerRectHeight + "px";
        
        let header = <HTMLElement>inner.children[0];
        header.textContent = entry.data.day.dateStr;
        header.title = entry.data.day.dateStr;
        
        let tasksContainer = <HTMLElement>inner.children[1];
        tasksContainer.innerHTML = "";
        let _scrollTop = this.fastList.getScrollTop();
        let deltaLeft = entry.data.containerRectLeft + WeekRenderer.LEFT_HEADERS_WIDTH + this.dayWidth * this.zoom * entryId - _scrollTop;
        let deltaTop = WeekRenderer.HEADERS_HEIGHT + entry.data.containerRectTop;
        let availHeight = entry.data.containerRectHeight - WeekRenderer.HEADERS_HEIGHT;
        for (let task of entry.data.day.tasks) {
            let taskDayFragment = (task.dayTaskEnd - task.dayTaskStart) / 86400000;
            let taskHeightPx = taskDayFragment * availHeight;
            let maxNumOfTextLines = Math.floor((taskHeightPx - WeekRenderer.TASK_PADDING_TOP_PLUS_BOTTOM) / WeekRenderer.TASK_LINE_HEIGHT);
            let el = document.createElement("div");
            el.setAttribute("draggable", "true");
            el.setAttribute("data-task-id", task.model ? task.model.id : null);
            el.setAttribute("data-file-id", task.fileModel ? task.fileModel.identifier : null);
            if (task.model) {
                el.className = "task task-status-" + task.model.status + (task.width < 100 ? " narrow" : "") + " has-task-tooltip";
            }
            else {
                el.className = "task task-file" + (task.width < 100 ? " narrow" : "") + " has-file-tooltip";
            }
            if (task.topContinues) {
                el.className += " top-continues";
            }
            if (task.bottomContinues) {
                el.className += " bottom-continues";
            }
            if (!task.wholeDay && task.dayTaskEnd - task.dayTaskStart <= 15 * 60 * 1000) {
                el.className += " compact";
            }
            
            let left = task.left + deltaLeft;
            let top = (task.dayTaskStart / 86400000) * availHeight + deltaTop;
            let width = task.width;
            let height = (task.dayTaskEnd - task.dayTaskStart) / 86400000 * availHeight;
            let bottom = top + height;
            let right = left + width;
            this.rects.push({
                x1: left, y1: top,
                x2: right, y2: bottom,
                el: el,
                taskId: task.model ? task.model.id : task.fileModel.identifier,
            });
            
            el.style.top = (task.dayTaskStart / 864000) + "%";
            el.style.bottom = (100.0 - task.dayTaskEnd / 864000) + "%";
            el.style.left = task.left + "px";
            el.style.width = task.width + "px";
            let el2 = document.createElement("div");
            el2.className = "task-inner";
            el2.innerText = task.text;
            (<any>el2.style).webkitLineClamp = Math.max(1, maxNumOfTextLines);
            el.appendChild(el2);
            tasksContainer.appendChild(el);
        }
    }
    
    getZoomForDaysNum(nDays: number, refreshValue: boolean = false): number {
        let availWidth = refreshValue ? this.fastList.container.clientHeight : this.fastList.getClientHeight();
        let widthPerDay = availWidth / nDays;
        let zoom = widthPerDay / this.dayWidth;
        return zoom;
    }
    
}
