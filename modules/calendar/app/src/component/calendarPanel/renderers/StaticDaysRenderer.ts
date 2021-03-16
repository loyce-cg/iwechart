import { JQuery as $, Q } from "pmc-web";
import { Renderer, SearchFilter } from "./Renderer";
import { TaskModel, FileModel } from "../CalendarPanelController";
import { DateUtils } from "../../../main/DateUtils";
import { WeekRenderer } from "./WeekRenderer";
import { VirtualScrollZoom } from "../VirtualScrollZoom";
import { Modes } from "../../../main/Types";
import { TaskGroupIcon } from "privfs-mail-client-tasks-plugin/src/main/Types";

export interface EntryModel {
    day: DayData;
    start: Date;
    end: Date;
}

export interface DayData {
    date: Date;
    tasks: TaskData[];
    isToday: boolean;
    startTimestamp: number;
    dateStr: string;
    dayId: string;
    dayOfWeek: string;
}

export interface TaskData {
    text: string;
    model: TaskModel;
    fileModel: FileModel;
    width: number;
    left: number;
    maxNumOfSimultTasks: number;
    dayTaskStart: number;
    dayTaskEnd: number;
    topContinues: boolean;
    bottomContinues: boolean;
    wholeDay: boolean;
    taskGroupIcons: TaskGroupIcon[];
}

export abstract class StaticDaysRenderer extends Renderer<EntryModel> {
    
    static readonly FILE_DURATION_MS: number = 30 * 60 * 1000;
    static readonly FILE_ROUND_START_MS: number = 15 * 60 * 1000;
    
    $container: JQuery = null;
    $fixedTasksContainer: JQuery = null;
    $secondContainer: JQuery = null;
    $entriesContainer: JQuery = null;
    selectedDate: Date = null;
    vsz: VirtualScrollZoom = null;
    
    abstract getRendererName(): string;
    abstract getVisibleDays(): Date[];
    
    init(): void {
        if (!this.selectedDate) {
            this.selectedDate = new Date();
        }
        this.$container = this.view.$container.find(".mode.mode-" + this.getRendererName());
        this.$fixedTasksContainer = this.$container.find(".fixed-tasks-container");
        this.$secondContainer = this.$container.find(".second-container");
        this.$entriesContainer = this.$container.find(".entries-container");
        (<any>this.$fixedTasksContainer.find(".entry-tasks")).pfScroll();
        if ((<any>window).ResizeObserver) {
            let resizeObserver = new (<any>window).ResizeObserver(this.onContainerResize.bind(this));
            resizeObserver.observe(this.$secondContainer[0]);
        }
        
        let vsz = new VirtualScrollZoom();
        vsz.afterZoomChanged = () => {
            Q().then(() => {
                this.updateTasksLineClamp();
            });
        };
        vsz.$container = this.$container;
        this.$secondContainer.find(".entry-tasks").each((idx, el) => {
            vsz.elements.push({
                $element: $(el),
                $viewport: $(el).closest(".entry.day"),
            });
        });
        let $hci = this.$container.find(".hours-container-inner");
        vsz.elements.push({
            $element: $hci,
            $viewport: $hci.closest(".hours-container"),
        });
        vsz.init();
        this.vsz = vsz;
        
        this.$container.on("mousewheel", this.onMouseWheel.bind(this));
    }
    
    onMouseWheel(e: MouseWheelEvent): void {
        if (e.shiftKey) {
            let d = 0;
            if (e.deltaY < 0) {
                d = this.getPrevNextAbsDelta();
            }
            else if (e.deltaY > 0) {
                d = -this.getPrevNextAbsDelta();
            }
            if (d != 0) {
                this.goToDate(this.selectedDate.getDate() + d, this.selectedDate.getMonth(), this.selectedDate.getFullYear(), true);
            }
        }
    }
    
    zoomInOut(zoomIn: boolean, midPtY: number = null, yPos: number = null): void {
    }
    
    goToDate(d: number, m: number, y: number, dispatchEvents: boolean = false): void {
        this.selectedDate = new Date(y, m, d);
        this.view.setSelectedDate(this.selectedDate.getDate(), this.selectedDate.getMonth(), this.selectedDate.getFullYear(), false);
        this.repaint();
        if (dispatchEvents) {
            this.view.triggerEvent("updateLeftCalendarFromDayPreview", d, m, y);
        }
    }
    
    repaint(): void {
        if (!this.view.isVisible) {
            return;
        }
        let entries = this.getEntries();
        this.fillEntries(entries);
        this.updateFixedTasksContainerHeight();
        this.updateTasksLineClamp();
        this.view.updateSelection();
    }
    
    getEntries(): EntryModel[] {
        let rect = this.$entriesContainer[0].getBoundingClientRect();
        let now = new Date();
        let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
        let daysTr: string[] = [];
        for (let i = 0; i < 7; ++i) {
            daysTr.push(this.view.parent.i18n("plugin.calendar.component.calendarPanel.daysOfWeek.short." + i));
        }
        this.adjustHoursSeparators(rect.height);
        
        let entries: EntryModel[] = [];
        let days = this.getVisibleDays();
        for (let day of days) {
            let start: Date = new Date(day.getFullYear(), day.getMonth(), day.getDate());
            let end: Date = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
            let dayStartTimestamp = start.getTime();
            
            // Add tasks
            let tasks: TaskData[] = [];
            for (let taskId in this.view.model.tasks) {
                let task = this.view.model.tasks[taskId];
                if (task.endTimestamp <= dayStartTimestamp || task.startTimestamp >= dayStartTimestamp + 86400000) {
                    continue;
                }
                if (!this.taskMatchesSearchString(taskId, task.title)) {
                    continue;
                }
                if (!this.taskMatchesFilter(taskId)) {
                    continue;
                }
                let dayTaskStart = Math.max(task.startTimestamp, dayStartTimestamp) - dayStartTimestamp;
                let dayTaskEnd = Math.min(task.endTimestamp, dayStartTimestamp + 86400000) - dayStartTimestamp;
                let wholeDays = task.wholeDays;
                if (task.startTimestamp <= dayStartTimestamp && task.endTimestamp >= dayStartTimestamp + 86400000) {
                    wholeDays = true;
                }
                let dt0 = new Date(dayTaskStart + dayStartTimestamp);
                let taskData: TaskData = {
                    text: task.title + (task.startTimestamp >= dayStartTimestamp && !wholeDays ? " (" + pad0s(dt0.getHours()) + ":" + pad0s(dt0.getMinutes()) + ")" : ""),
                    model: task,
                    fileModel: null,
                    width: 100,
                    left: 0,
                    maxNumOfSimultTasks: 0,
                    dayTaskStart: dayTaskStart,
                    dayTaskEnd: dayTaskEnd,
                    topContinues: task.startTimestamp < dayStartTimestamp,
                    bottomContinues: task.endTimestamp > dayStartTimestamp + 86400000,
                    wholeDay: wholeDays,
                    taskGroupIcons: task.taskGroupIcons,
                };
                tasks.push(taskData);
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
                    let startTimestamp = this.getRoundedFileStartTimestamp(file);
                    if (startTimestamp <= dayStartTimestamp || startTimestamp >= dayStartTimestamp + 86400000) {
                        continue;
                    }
                    let endTimestamp = startTimestamp + StaticDaysRenderer.FILE_DURATION_MS;
                    let dayTaskStart = Math.max(startTimestamp, dayStartTimestamp) - dayStartTimestamp;
                    let dayTaskEnd = Math.min(endTimestamp, dayStartTimestamp + 86400000) - dayStartTimestamp;
                    let fileData: TaskData = {
                        text: file.fileName,
                        model: null,
                        fileModel: file,
                        width: 100,
                        left: 0,
                        maxNumOfSimultTasks: 0,
                        dayTaskStart: dayTaskStart,
                        dayTaskEnd: dayTaskEnd,
                        topContinues: false,
                        bottomContinues: false,
                        wholeDay: false,
                        taskGroupIcons: [],
                    };
                    tasks.push(fileData);
                }
            }
            
            // Arrange tasks
            this.arrangeTasks(tasks);
            
            // Create day data
            let dayData: DayData = {
                date: start,
                tasks: tasks,
                isToday: DateUtils.isToday(start, now),
                startTimestamp: start.getTime(),
                dateStr: daysTr[(start.getDay() + 6) % 7] + ", " + pad0s(start.getDate()) + "." + pad0s(start.getMonth() + 1) + "." + start.getFullYear(),
                dayId: start.getDate() + "." + start.getMonth() + "." + start.getFullYear(),
                dayOfWeek: start.toLocaleDateString("en", { weekday: "long" }).toLowerCase(),
            };
            
            // Create entry
            let entry: EntryModel = {
                day: dayData,
                start: start,
                end: end,
            };
            entries.push(entry);
        }
        
        return entries;
    }
    
    arrangeTasks(tasks: TaskData[], maxTaskWidth: number = 100): void {
        // Sort tasks by start timestamp
        tasks.sort((a, b) => {
            let aStart = a.model ? a.model.startTimestamp : a.fileModel.createdAt;
            let bStart = b.model ? b.model.startTimestamp : b.fileModel.createdAt;
            return aStart - bStart;
        });
        
        // Collect task start/end points, sort them, then calculate tasks widths and positions
        let points: { at: number, task: TaskData, start: boolean }[] = [];
        for (let task of tasks) {
            if (task.wholeDay) {
                continue;
            }
            let startTimestamp = task.model ? task.model.startTimestamp : this.getRoundedFileStartTimestamp(task.fileModel);
            let endTimestamp = task.model ? task.model.endTimestamp : (startTimestamp + StaticDaysRenderer.FILE_DURATION_MS);
            points.push({ at: startTimestamp, task: task, start: true });
            points.push({ at: endTimestamp, task: task, start: false });
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
            let itemId = pt.task.model ? pt.task.model.id : pt.task.fileModel.identifier;
            if (pt.start) {
                ++nSimultTasks;
                for (let id in nSimultTasksMap) {
                    nSimultTasksMap[id] = Math.max(nSimultTasksMap[id], nSimultTasks);
                }
                nSimultTasksMap[itemId] = nSimultTasks;
            }
            else {
                --nSimultTasks;
                pt.task.maxNumOfSimultTasks = nSimultTasksMap[itemId];
                delete nSimultTasksMap[itemId];
            }
        }
        
        // Increase simult tasks count for tasks that are affected by non-overlapping tasks (via an intermediary task)
        // Fixes following scenario:
        //     Task 1: 08:00 - 12:00
        //     Task 2: 12:00 - 16:00
        //     Task 3: 08:00 - 16:00
        //     Task 4: 12:00 - 16:00
        // Algorithm: find groups of tasks that are overlapping (inc. via intermediary tasks) and set their simultTasksCount to the same max value
        nSimultTasks = 0;
        let overlappingTaskGroups: TaskData[][] = [];
        let currentGroup: TaskData[] = [];
        for (let pt of points) {
            if (pt.start) {
                ++nSimultTasks;
                currentGroup.push(pt.task);
            }
            else {
                --nSimultTasks;
            }
            if (nSimultTasks == 0 && currentGroup.length > 0) {
                overlappingTaskGroups.push(currentGroup);
                currentGroup = [];
            }
        }
        for (let group of overlappingTaskGroups) {
            let maxSimultTasks = 0;
            for (let taskData of group) {
                maxSimultTasks = Math.max(maxSimultTasks, taskData.maxNumOfSimultTasks);
            }
            for (let taskData of group) {
                taskData.maxNumOfSimultTasks = maxSimultTasks;
            }
        }
        
        // Set task sizes
        for (let task of tasks) {
            if (task.wholeDay) {
                continue;
            }
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
    
    fillEntries(entries: EntryModel[]): void {
        let $entries = this.$entriesContainer.children();
        let $entries2 = this.$fixedTasksContainer.find(".entry");
        
        for (let i = 0; i < entries.length; ++i) {
            let entry = entries[i];
            let $entry = $entries.eq(i);
            let $entry2 = $entries2.eq(i);
            let $cont = $entry.find(".entry-tasks");
            let $cont2 = $entry2.find(".entry-tasks").find(".pf-content");
            $cont.html("");
            $cont2.html("");
            $entry2.find(".entry-header").prop("title", entry.day.dateStr).text(entry.day.dateStr);
            $entry[0].setAttribute("data-day", entry.day.dayId);
            $entry2[0].setAttribute("data-day", entry.day.dayId);
            $entry.toggleClass("today", entry.day.isToday);
            $entry2.toggleClass("today", entry.day.isToday);
            $entry2[0].setAttribute("data-day-of-week", entry.day.dayOfWeek);
            for (let task of entry.day.tasks) {
                let el = document.createElement("div");
                el.setAttribute("draggable", "true");
                el.setAttribute("data-task-id", task.model ? task.model.id : "");
                el.setAttribute("data-file-id", task.fileModel ? task.fileModel.identifier : "");
                if (task.model) {
                    el.className = "task is-task task-status-" + task.model.status + (task.width < 100 ? " narrow" : "") + " has-task-tooltip";
                }
                else {
                    el.className = "task is-file" + (task.width < 100 ? " narrow" : "") + " has-file-tooltip";
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
                
                if (!task.wholeDay) {
                    el.style.top = (task.dayTaskStart / 864000) + "%";
                    el.style.bottom = (100.0 - task.dayTaskEnd / 864000) + "%";
                    el.style.left = task.left + "%";
                    el.style.width = task.width + "%";
                }
                let el2 = document.createElement("div");
                el2.className = "task-inner";
                el2.innerText = task.text;
                if (task.taskGroupIcons && task.taskGroupIcons.length > 0) {
                    for (let tgIcon of task.taskGroupIcons) {
                        let tpl = this.view.emptyTgIconTemplates[this.view.getIconId(tgIcon)];
                        let el = <HTMLElement>tpl.cloneNode(true);
                        el.style.color = tgIcon.color;
                        $(el2).prepend(el);
                    }
                }
                else if (task.fileModel && task.fileModel.icon) {
                    let span = document.createElement("span");
                    span.className = "file-icon " + task.fileModel.icon;
                    $(el2).prepend(span);
                }
                el.appendChild(el2);
                if (task.wholeDay) {
                    $cont2[0].appendChild(el);
                }
                else {
                    $cont[0].appendChild(el);                    
                }
            }
        }
    }
    
    updateFixedTasksContainerHeight(): void {
        let maxNumOfTasks = 0;
        this.$fixedTasksContainer.find(".entry").each((idx, el) => {
            maxNumOfTasks = Math.max(maxNumOfTasks, $(el).find(".task").length);
        });
        this.$fixedTasksContainer.css("height", maxNumOfTasks * 19 + 23);
    }
    
    updateTasksLineClamp(): boolean {
        if (!this.$entriesContainer.is(":visible")) {
            return true;
        }
        let $tasks = this.$entriesContainer.find(".task");
        if ($tasks.length == 0) {
            return true;
        }
        
        let nonZeroHeights: boolean = false;
        let lineClamps: { $el: JQuery, lc: number }[] = [];
        $tasks.each((idx, el) => {
            let $el = $(el);
            let taskHeightPx = $el.height();
            if (taskHeightPx > 0) {
                nonZeroHeights = true;
            }
            let maxNumOfTextLines = Math.floor((taskHeightPx - WeekRenderer.TASK_PADDING_TOP_PLUS_BOTTOM) / WeekRenderer.TASK_LINE_HEIGHT);
            lineClamps.push({ $el, lc: Math.max(1, maxNumOfTextLines) });
        });
        lineClamps.forEach(spec => {
            (<any>spec.$el.find(".task-inner")[0].style).webkitLineClamp = spec.lc;
        });
        return nonZeroHeights;
    }
    
    adjustHoursSeparators(availHeight: number): void {
        let minCellHeight = 40;
        let availModes = [1, 2, 3, 4, 6];
        let dstMode = availModes[availModes.length - 1];
        for (let mode of availModes) {
            let h = 24 / mode * minCellHeight;
            if (h < availHeight) {
                dstMode = mode;
                break;
            }
        }
        for (let mode of availModes) {
            this.$container.toggleClass("hour-separators-1_" + mode, mode == dstMode);
        }
    }
    
    onContainerResize(): void {
        let rect = this.$entriesContainer[0].getBoundingClientRect();
        this.adjustHoursSeparators(rect.height);
        if (!this.updateTasksLineClamp()) {
            Q().then(() => {
                let rect = this.$entriesContainer[0].getBoundingClientRect();
                this.adjustHoursSeparators(rect.height);
                this.updateTasksLineClamp();
            });
        }
    }
    
    taskMatchesSearchString(taskId: string, str: string): boolean {
        str = SearchFilter.prepareHaystack(str).replace(/<(?:.|\n)*?>/gm, '');
        let searchStr = this.view.searchStr;
        if (searchStr.length > 0 && searchStr[0] == "#") {
            return taskId.indexOf(searchStr.substr(1)) == 0;
        }
        return str.indexOf(searchStr) >= 0;
    }
    
    getRoundedFileStartTimestamp(file: FileModel): number {
        let ts = file.createdAt;
        if (StaticDaysRenderer.FILE_ROUND_START_MS) {
            ts = Math.round(ts / StaticDaysRenderer.FILE_ROUND_START_MS) * StaticDaysRenderer.FILE_ROUND_START_MS;
        }
        return ts;
    }
    
}
