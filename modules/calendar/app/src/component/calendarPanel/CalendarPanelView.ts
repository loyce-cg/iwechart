import { component, window as wnd, JQuery as $, Q, Starter } from "pmc-web";
import { Model, TaskModel, FileModel } from "./CalendarPanelController";
import { func as mainTemplate } from "./template/main.html";
import { RequestCustomSelectViewEvent, TaskGroupIcon } from "privfs-mail-client-tasks-plugin/src/main/Types";
import { CustomSelectView } from "privfs-mail-client-tasks-plugin/src/component/customSelect/CustomSelectView";
import { Modes } from "../../main/Types";
import { DatePickerView } from "../datePicker/DatePickerView";
import { Renderer } from "./renderers/Renderer";
import { MonthRenderer } from "./renderers/MonthRenderer";
import { WeekRenderer } from "./renderers/WeekRenderer";
import { FastListCreator } from "privfs-mail-client-tasks-plugin/src/main/FastListCreator";
import { DateUtils } from "../../main/DateUtils";
import { SingleWeekRenderer } from "./renderers/SingleWeekRenderer";
import { SingleDayRenderer } from "./renderers/SingleDayRenderer";
import { func as iconTemplate } from "./template/icon.html";
import {func as actionsMenuTemplate} from "./template/actions-menu.html";


export interface ActionItemModel {
    id?: string;
    labelKey?: string;
    icon?: string;
    hidden?: boolean;
    isSeparator?: boolean;
}

export interface ActionsModel {
    items: ActionItemModel[];
}

interface IconPickerData {
    items: string[];
    colors: string[];
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export class CalendarPanelView extends component.base.ComponentView {
    
    static USE_CUSTOM_DOUBLE_CLICK = false;
    static DOUBLE_CLICK_TIME = 400;
    static ENABLE_PREVIEW_IN_WEEK_MODE: boolean = false;
    
    $container: JQuery;
    $settingsMenu: JQuery;
    $goToChat: JQuery;
    $goToNotes: JQuery;
    $goToTasks: JQuery;
    $modeSwitch: JQuery;
    $dragDropHintText: JQuery;
    $dragDropHintRects: JQuery;
    $calendars: JQuery;
    $top: JQuery;
    $topLeft: JQuery;
    $topDatePickerContainer: JQuery;
    $topButtonContainer: JQuery;
    $topNewTask: JQuery;
    $topFilterContainer: JQuery;
    $topModeContainer: JQuery;
    $topExtraCalendarsContainer: JQuery;
    
    parent: wnd.base.BaseWindowView<any>;
    model: Model;
    isActive: boolean = false;
    isVisible: boolean = true;
    customSelectMode: CustomSelectView;
    customSelectFilter: CustomSelectView;
    datePicker: DatePickerView;
    customSelectExtraCalendars: CustomSelectView;
    // personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    notifications: component.notification.NotificationView;
    taskTooltip: component.tasktooltip.TaskTooltipView;
    fileTooltip: component.filetooltip.FileTooltipView;
    fragmentsContainers: { [key: string]: HTMLElement } = {};
    renderers: { [key: string]: Renderer<any> } = {};
    selectedDay: string = null;
    selectedTask: string = null;
    fastListCreator: FastListCreator;
    mouseX: number = 0;
    mouseY: number = 0;
    tasks: { [key: string]: TaskModel } = {};
    _overrideMode: Modes = null;
    lastClickTid: any;
    lastClickId: string;
    emptyTgIconTemplates: { [key: string]: HTMLElement } = null;
    iconPickerData: IconPickerData;
    dropdown: component.dropdown.Dropdown<ActionsModel>;
    order: number = 50;
    
    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent);
        // this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.parent.helper));
        this.personTooltip = new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.taskTooltip = this.addComponent("tasktooltip", new component.tasktooltip.TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); };
        this.fileTooltip = this.addComponent("filetooltip", new component.filetooltip.FileTooltipView(this));
        this.fileTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); };
        this.datePicker = this.addComponent("datePicker", new DatePickerView(this));
        
        for (let csName of ["customSelectMode", "customSelectFilter", "customSelectExtraCalendars"]) {
            Starter.dispatchEvent<RequestCustomSelectViewEvent>({
                type: "request-custom-select-view",
                parent: this,
                name: csName,
            });
        }
        Starter.dispatchEvent({
            type: "request-fast-list-creator",
            parent: this,
            name: "fastListCreator",
        });
        Starter.dispatchEvent({
            type: "request-icon-picker-data",
            parent: this,
            name: "iconPickerData",
        });
    }
    
    init(modelStr: string): any {
        let tpl = this.templateManager.createTemplate(iconTemplate);
        this.emptyTgIconTemplates = {};
        for (let iconStr of this.iconPickerData.items) {
            if (!iconStr) {
                continue;
            }
            let icon: TaskGroupIcon = JSON.parse(iconStr);
            this.emptyTgIconTemplates[this.getIconId(icon)] = tpl.renderToJQ(iconStr)[0];
        }
        
        let model: Model = JSON.parse(modelStr);
        this.setModel(model);
        
        this.$container.on("click", ".btn.settings", this.onSettingsButtonClick.bind(this));
        this.$container.on("click", ".btn.refresh", this.onRefreshButtonClick.bind(this));
        this.$container.on("click", ".context-menu-backdrop2", this.onSettingsMenuBackdropClick.bind(this));
        this.$container.on("change", "input[data-setting]", this.onSettingChanged.bind(this));
        this.$container.on("click", "button[data-setting]", this.onSettingChanged.bind(this));
        this.$container.on("click", "li.option-chooser-option:not(.active)", this.onOptionChooserOptionClick.bind(this));
        this.$container.on("click", "[data-action=\"task-new\"]", this.onNewTaskClick.bind(this));
        $(document.body).on("click", ".actions-menu [data-action-id]", this.onActionsMenuClick.bind(this));
        this.$container.on("click", "[data-task-id]", this.onTaskClick.bind(this));
        this.$container.on("dblclick", "[data-task-id]", this.onDoubleTaskClick.bind(this));
        this.$container.on("click", "[data-day]", this.onDayClick.bind(this));
        this.$container.on("dblclick", "[data-day]", this.onDayDoubleClick.bind(this));
        this.$container.on("mouseover", "[data-task-id]", this.onTaskMouseOver.bind(this));
        this.$container.on("mouseout", "[data-task-id]", this.onTaskMouseOut.bind(this));
        this.$container.on("dragstart", "[data-task-id]", this.onTaskDragStart.bind(this));
        this.$container.on("dragend", "[data-task-id]", this.onTaskDragEnd.bind(this));
        this.$container.on("dragover", "[data-day]", this.onDragOverDay.bind(this));
        this.$container.on("drop", "[data-day]", this.onDropOnDay.bind(this));
        this.$container.on("click", "[data-action=open-chat]", this.onOpenChatClick.bind(this));
        this.$container.on("click", "[data-action=open-notes]", this.onOpenNotesClick.bind(this));
        this.$container.on("click", "[data-action=open-tasks]", this.onOpenTasksClick.bind(this));
        this.$container.on("click", ".today-btn", this.onGoToTodayClick.bind(this));
        this.$container.on("click", "[data-action=zoom-in]", this.onZoomInClick.bind(this));
        this.$container.on("click", "[data-action=zoom-out]", this.onZoomOutClick.bind(this));
        this.$container.on("mousemove", (e: any) => {
            this.mouseX = e.pageX;
            this.mouseY = e.pageY;
        });
        
        this.customSelectMode.onChange(str => {
            this.settingChanged("mode", str);
        });
        this.customSelectFilter.onChange(str => {
            if (str) {
                this.settingChanged("filter", str);
            }
        });
        this.customSelectExtraCalendars.onChange(str => {
            if (!this.model || !this.model.canChooseExtraCalendars) {
                return;
            }
            this.triggerEvent("setExtraCalendars", str);
            this.model.extraCalendars = str.split(",").filter(x => !!x);
        });
        
        // this.personsComponent.$main = this.$container;
        this.personTooltip.init(this.$container);
        this.notifications.$container = this.$container.find(".notifications-container-wrapper");
        this.datePicker.$container = this.$container.find(".datepicker-container");
        this.taskTooltip.$container = this.$container;
        this.fileTooltip.$container = this.$container;
        this.datePicker.overridePrevNextAbsDelta = this.getPrevNextAbsDelta.bind(this);
        return <any>Q.all([
            // this.personsComponent.triggerInit(),
            this.notifications.triggerInit(),
        ])
        .then(() => {
            this.personsComponent.refreshAvatars();
            this.customSelectExtraCalendars.updateMainSelectedItem = this.updateMainSelectedItem.bind(this);
            return Q.all([
                this.taskTooltip.triggerInit(),
                this.fileTooltip.triggerInit(),
                this.customSelectMode.triggerInit(),
                this.customSelectFilter.triggerInit(),
                this.datePicker.triggerInit(),
                this.customSelectExtraCalendars.triggerInit(),
            ]);
        });
    }
    
    getIconId(icon: TaskGroupIcon) {
        return icon.type + "--" + (icon.type == "fa" ? icon.fa : icon.shape);
    }
    
    registerCustomSelectView(csName: string, view: CustomSelectView): void {
        if (csName == "customSelectMode") {
            this.customSelectMode = this.addComponent("customSelectMode", view);
        }
        else if (csName == "customSelectFilter") {
            this.customSelectFilter = this.addComponent("customSelectFilter", view);
        }
        else if (csName == "customSelectExtraCalendars") {
            this.customSelectExtraCalendars = this.addComponent("customSelectExtraCalendars", view);
        }
    }
    
    registerFastListCreator(csName: string, fastListCreator: FastListCreator): void {
        if (csName == "fastListCreator") {
            this.fastListCreator = fastListCreator;
        }
    }
    
    registerIconPickerData(csName: string, iconPickerData: IconPickerData): void {
        if (csName == "iconPickerData") {
            this.iconPickerData = iconPickerData;
        }
    }
    
    setModel(model: Model) {
        this.model = model;
        if (model) {
            let now = new Date();
            this.selectDay(now.getDate() + "." + now.getMonth() + "." + now.getFullYear());
            Q().then(() => {
                for (let tId in model.tasks) {
                    this.parent.fontMetrics.add(model.tasks[tId].title);
                }
                for (let fId in model.files) {
                    this.parent.fontMetrics.add(model.files[fId].fileName);
                }
                this.parent.fontMetrics.add("0123456789:↳");
                this.parent.fontMetrics.measure();
            });
            this.searchStr = model.searchStr;
        }
        this.render();
    }
    
    setData(modelStr: string): void {
        this.setModel(JSON.parse(modelStr));
    }
    
    render(): void {
        let $oldNotifCont = this.$container.find(".notifications-container-wrapper");
        let $oldDatePickerCont = this.$container.find(".datepicker-container");
        let $oldTaskPopupCont = this.$container.find(".tooltip-component");
        this.$container.empty();
        if (this.model) {
            let convTemplate = this.templateManager.createTemplate(component.template.conversation);
            this.$container.append(this.templateManager.createTemplate(mainTemplate).renderToJQ(this.model, convTemplate));
            this.fragmentsContainers[Modes.MONTH] = this.$container.find(".mode.mode-month")[0];
            this.fragmentsContainers[Modes.WEEK] = this.$container.find(".mode.mode-week")[0];
            this.fragmentsContainers[Modes.SINGLE_WEEK] = this.$container.find(".mode.mode-singleweek")[0];
            this.fragmentsContainers[Modes.SINGLE_DAY] = this.$container.find(".mode.mode-singleday")[0];
            if ($oldNotifCont.length > 0) {
                this.$container.find(".notifications-container-wrapper").replaceWith($oldNotifCont);
            }
            if ($oldDatePickerCont.length > 0) {
                this.$container.find(".datepicker-container").replaceWith($oldDatePickerCont);
            }
            if ($oldTaskPopupCont.length > 0) {
                this.$container.append($oldTaskPopupCont);
            }
            this.personsComponent.refreshAvatars();
            this.$settingsMenu = this.$container.find(".context-menu-settings");
            
            this.$top = this.$container.find(".top");
            if ((<any>window).ResizeObserver) {
                let resizeObserver = new (<any>window).ResizeObserver(this.onTopResize.bind(this));
                resizeObserver.observe(this.$top[0]);
            }
            if ((<any>window).ResizeObserver) {
                let resizeObserver = new (<any>window).ResizeObserver(() => {
                    this.updateSettingsMenuRight();
                    this.updateActionsMenuPosition();
                });
                resizeObserver.observe(this.$container[0]);
            }
            
            this.$topLeft = this.$top.children(".left");
            this.$topDatePickerContainer = this.$top.children(".datepicker-container");
            this.$topButtonContainer = this.$top.children(".button-container");
            this.$topNewTask = this.$top.find("[data-action='task-new']");
            this.$topFilterContainer = this.$top.find(".filter-container");
            this.$topModeContainer = this.$top.find(".mode-container");
            this.$topExtraCalendarsContainer = this.$top.find(".extra-calendars-container");
            
            // Dragdrop hint
            let $calendars = this.$container.closest(".calendars");
            this.$dragDropHintText = $calendars.find(".dragdrop-hint-text");
            this.$dragDropHintRects = $calendars.find(".dragdrop-hint-rects");
            if (this.$dragDropHintText.length == 0) {
                this.$dragDropHintText = $("<div class='dragdrop-hint-text'></div>");
                $calendars.append(this.$dragDropHintText);
            }
            if (this.$dragDropHintRects.length == 0) {
                this.$dragDropHintRects = $("<div class='dragdrop-hint-rects'></div>");
                $calendars.append(this.$dragDropHintRects);
            }
            this.$calendars = $calendars;
            
            this.customSelectMode.setContainer(this.$container.find(".mode-container"));
            this.customSelectFilter.setContainer(this.$container.find(".filter-container"));
            this.customSelectExtraCalendars.setContainer(this.$container.find(".extra-calendars-container"));
            this.customSelectExtraCalendars.$container.find(".component-custom-select-main").addClass("with-wide-dropdown");
            this.$goToChat = this.$container.find(".go-to-chat");
            this.$goToNotes = this.$container.find(".go-to-notes");
            this.$goToTasks = this.$container.find(".go-to-tasks");
            this.$goToChat.toggleClass("hidden", !this.model.otherPluginsAvailability.chat);
            this.$goToNotes.toggleClass("hidden", !this.model.otherPluginsAvailability.notes);
            this.$goToTasks.toggleClass("hidden", !this.model.otherPluginsAvailability.tasks);
            
            this.updateClasses();
            this.updateSettingsMenu();
        }
        else {
            this.$container.append("<div class=\"notifications-container-wrapper\"></div>");
            this.$container.append("<div class=\"datepicker-container\"></div>");
        }
    }
    
    settingChanged(setting: string, value: boolean|string, dispatchEvent: boolean = true): void {
        if (!this.model || !this.model.projectId) {
            return;
        }
        
        this.triggerEvent("settingChanged", setting, value, dispatchEvent);
        
        if (this.model && this.model.settings) {
            this.model.settings[setting] = value;
            let rendererName = this.getRenderer().getRendererName();
            if (setting.indexOf("renderer-settings-") != 0 || setting == "renderer-settings-" + rendererName || setting == "show-files") {
                this.updateClasses();
                this.repaint();
            }
        }
        this.updateSettingsMenu();
    }
    
    getSetting(name: string): boolean|string {
        return this.model.settings[name];
    }
    
    setSetting(name: string, value: boolean): void {
        this.model.settings[name] = value;
    }
    
    updateSettingsMenu(): void {
        let safeId = this.model.projectId.replace(/:/g, "---").replace(/\|/g, "___");
        for (let k in this.model.settings) {
            this.$container.find("input#calendar-settings-" + k + "-" + safeId + "-" + this.model.calendarId).prop("checked", this.getSetting(k));
        }
        
        let isParentEnabled = true;
        let $items =  this.$container.find(".panel.calendar-panel-component").children(".context-menu-settings").find(".context-menu-content").children("li");
        for (let i = 0; i < $items.length; ++i) {
            let $li = $items.eq(i);
            if ($li.is(".subitem")) {
                $li.toggleClass("disabled", !isParentEnabled);
                $li.find("input").prop("disabled", !isParentEnabled);
            }
            else {
                isParentEnabled = $li.find("input").is(":checked");
            }
        }
        
        let sortFilesBy = this.getSetting("sort-files-by");
        let $sortFilesByUl = this.$container.find(`.settings-item--sort-files-by ul.option-chooser[data-setting="sort-files-by"]`);
        let $selectedSortFilesByLis = $sortFilesByUl.find(`li.option-chooser-option[data-option]`);
        let $selectedSortFilesByLiActive = $selectedSortFilesByLis.filter(".active");
        if ($selectedSortFilesByLiActive.attr("data-option") != sortFilesBy) {
            $selectedSortFilesByLiActive.removeClass("active");
            $selectedSortFilesByLis.filter(`[data-option="${sortFilesBy}"]`).addClass("active");
        }
    }
    
    updateSettingsMenuRight(): void {
        let dr = parseInt(this.$settingsMenu.parent().children(".top").css("right"));
        this.$settingsMenu.children(".context-menu-content").css("right", Math.round(this.$topNewTask.outerWidth(true)) - 30 + dr);
    }
    
    updateCustomSelectMode(mode: string): void {
        let oldSelectedItem = this.customSelectMode.items.find(x => x.selected);
        let newSelectedItem = this.customSelectMode.items.find(x => x.val == mode);
        oldSelectedItem.selected = false;
        newSelectedItem.selected = true;
        this.customSelectMode.updateItems();
    }
    
    updateCustomSelectFilter(filter: string): void {
        let oldSelectedItem = this.customSelectFilter.items.find(x => x.selected);
        let newSelectedItem = this.customSelectFilter.items.find(x => x.val == filter);
        oldSelectedItem.selected = false;
        newSelectedItem.selected = true;
        this.customSelectFilter.updateItems();
    }
    
    setSelectedDate(d: number, m: number, y: number, goToDate: boolean = true): void {
        this.model.selectedDay = d;
        this.model.selectedMonth = m;
        this.model.selectedYear = y;
        if (goToDate) {
            this.getRenderer().goToDate(d, m, y);
        }
        else {
            this.triggerEvent("setSelectedDate", d, m, y);
        }
    }
    
    updateClasses(): void {
        let mode = this.getMode();
        this.$container.toggleClass("with-mode-month", mode == Modes.MONTH);
        this.$container.toggleClass("with-mode-week", mode == Modes.WEEK);
        this.$container.toggleClass("with-mode-singleweek", mode == Modes.SINGLE_WEEK);
        this.$container.toggleClass("with-mode-singleday", mode == Modes.SINGLE_DAY);
        this.$container.toggleClass("no-creating-new-tasks", !this.model.canCreateNewTasks);
        this.$container.toggleClass("can-choose-extra-calendars", !!this.model.canChooseExtraCalendars);
        this.$container.toggleClass("cant-choose-extra-calendars", !this.model.canChooseExtraCalendars);
    }
    
    setIsVisible(isVisible: boolean,x:any): void {
        if (this.isVisible == isVisible) {
            return;
        }
        // console.log("set",x, this.model?this.model.projectName:"unk", isVisible)
        this.isVisible = isVisible;
    }
    
    
    
    
    
    
    /****************************************
    **************** Events *****************
    *****************************************/
    onSettingsButtonClick(e: MouseEvent): void {
        this.updateSettingsMenuRight();
        this.$settingsMenu.addClass("visible");
    }
    
    onRefreshButtonClick(): void {
        this.triggerEvent("refresh");
    }
    
    onSettingsMenuBackdropClick(): void {
        this.$settingsMenu.removeClass("visible");
    }
    
    onSettingChanged(e: Event): void {
        let $cb = $(e.currentTarget);
        let setting = $cb.data("setting");
        let value = !this.model.settings[setting];
        this.settingChanged(setting, value);
    }
    
    onOptionChooserOptionClick(e: MouseEvent): void {
        let $li = $(e.currentTarget);
        let $ul = $(e.currentTarget).parent();
        let setting = $ul.data("setting");
        let value = $li.data("option");
        this.settingChanged(setting, value);
    }
    
    onNewTaskClick(): void {
        let model: ActionsModel = {
            items: [
                {
                    id: "new-timeframe",
                    labelKey: "plugin.calendar.component.calendarPanel.new-timeframe",
                    icon: "fa fa-clock-o"
                },
                {
                    id: "new-whole-day",
                    labelKey: "plugin.calendar.component.calendarPanel.new-whole-day",
                    icon: "fa fa-calendar"
                },
            ]
        };
        this.dropdown = new component.dropdown.Dropdown({
            model: model,
            template: this.templateManager.createTemplate(actionsMenuTemplate),
            $container: $(document.body),
            templateManager: this.templateManager,
        });
        if (this.$container.closest(".window-sectionsummary").length > 0) {
            $(document.body).addClass("for-window-sectionsummary");
        }
        this.updateActionsMenuPosition();
    }
    
    updateActionsMenuPosition(): void {
        if (!this.dropdown) {
            return;
        }
        let $dd = $(document.body).find(".component-dropdown");
        let $btn = this.$container.find(".btn[data-action='task-new']");
        let btnRect = $btn[0].getBoundingClientRect();
        $dd.css({
            position: "fixed",
            left: `${btnRect.left + btnRect.width / 2 - 180 / 2 - 60}px`,
            top: `${btnRect.top + btnRect.height}px`,
            zIndex: 9999,
            margin: "8px 0 0 0",
        });
        $dd.addClass("to-right");
        $dd.find(".inner").css("height", "auto");
        $dd.find(".pf-content").css("position", "static");
    }
    
    onActionsMenuClick(event: MouseEvent) {
        if (!this.isActive || !this.model || this.model.calendarId != 1) {
            return;
        }
        event.stopPropagation();
        let $trigger = $(event.target).closest("[data-action-id]");
        let actionId = $trigger.data("action-id");
        if (this.dropdown) {
            this.dropdown.destroy();
            this.dropdown = null;
        }
        let ts: number = null;
        if (this.selectedDay && this.$container.closest(".two-calendars").length > 0) {
            let [d, m, y] = this.selectedDay.split(".").map(x => parseInt(x));
            let now = new Date();
            ts = new Date(y, m, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).getTime();
        }
        this.triggerEvent("newTask", ts, actionId);
    }
    
    onTaskClick(e: MouseEvent): void {
        e.stopImmediatePropagation();
        let taskId = (<HTMLElement>e.currentTarget).getAttribute("data-task-id");
        if (taskId) {
            if (this.getSetting("show-task-preview-panel")) {
                this.selectTask(e.ctrlKey ? null : taskId);
            }
            else {
                this.triggerEvent("openTask", taskId);
            }
        }
        else {
            let fileId = (<HTMLElement>e.currentTarget).getAttribute("data-file-id");
            this.triggerEvent("openFile", fileId);
        }
    }
    
    onDoubleTaskClick(e: MouseEvent): void {
        let taskId = (<HTMLElement>e.currentTarget).getAttribute("data-task-id");
        if (taskId) {
            this.triggerEvent("openTask", taskId);
        }
        else {
            let fileId = (<HTMLElement>e.currentTarget).getAttribute("data-file-id");
            this.triggerEvent("openFile", fileId);
        }
    }
    
    onDayClick(e: MouseEvent): void {
        let day = (<HTMLElement>e.currentTarget).getAttribute("data-day");
        if (!CalendarPanelView.USE_CUSTOM_DOUBLE_CLICK) {
            this.selectDay(day);
        }
        else {
            if (this.lastClickTid && this.lastClickId == day) {
                clearTimeout(this.lastClickTid);
                this.lastClickTid = null;
                this.lastClickId = null;
                
                // Double click
                let now = new Date();
                let [d, m, y] = day.split(".").map(x => parseInt(x));
                this.triggerEvent("newTask", new Date(y, m, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).getTime());
            }
            else {
                this.lastClickId = day;
                this.lastClickTid = setTimeout(() => {
                    this.lastClickTid = null;
                    this.lastClickId = null;
                    
                    // Single click
                    this.selectDay(day);
                }, CalendarPanelView.DOUBLE_CLICK_TIME);
            }
        }
    }
    
    onDayDoubleClick(e: MouseEvent): void {
        if (!CalendarPanelView.USE_CUSTOM_DOUBLE_CLICK) {
            let $t = $(e.target);
            if (!$t.is(".tasks") && !$t.is(".entry-tasks") && ($t.closest(".tasks").length > 0 || $t.closest(".entry-tasks").length > 0)) {
                return;
            }
            let day = (<HTMLElement>e.currentTarget).getAttribute("data-day");
            let now = new Date();
            let [d, m, y] = day.split(".").map(x => parseInt(x));
            this.triggerEvent("newTask", new Date(y, m, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).getTime());
        }
    }
    
    onTaskMouseOver(e: MouseEvent): void {
        let taskId = (<HTMLElement>e.currentTarget).getAttribute("data-task-id");
        this.$container.find(".hover").removeClass("hover");
        this.$container.find("[data-task-id='" + taskId + "']").addClass("hover");
    }
    
    onTaskMouseOut(e: MouseEvent): void {
        this.$container.find(".hover").removeClass("hover");
    }
    
    onOpenChatClick(): void {
        this.triggerEvent("openChat");
    }
    
    onOpenNotesClick(): void {
        this.triggerEvent("openNotes");
    }
    
    onOpenTasksClick(): void {
        this.triggerEvent("openTasks");
    }
    
    onGoToTodayClick(): void {
        let dt = new Date();
        this.setSelectedDate(dt.getDate(), dt.getMonth(), dt.getFullYear());
        this.triggerEvent("goToToday");
    }
    
    onZoomInClick(): void {
        this.getRenderer().zoomIn();
    }
    
    onZoomOutClick(): void {
        this.getRenderer().zoomOut();
    }
    
    onTopResize(entry: any): void {
        let availWidth = entry[0].contentRect.width;
        let tdpcw = this.$topDatePickerContainer.data("cached-width") ? this.$topDatePickerContainer.data("cached-width") : this.$topDatePickerContainer.outerWidth();
        this.$topDatePickerContainer.data("cached-width", tdpcw);
        let reqWidth = Math.max(this.$top.data("orig-width") || 0, this.$topLeft.outerWidth() + tdpcw + this.$topButtonContainer.outerWidth());
        this.$top.data("orig-width", reqWidth);
        this.$top.toggleClass("multiline", reqWidth >= availWidth);
        this.$calendars.toggleClass("multiline-header", reqWidth >= availWidth);
        if (reqWidth >= availWidth) {
            reqWidth -= tdpcw;
        }
        let narrow = reqWidth >= availWidth;
        this.$topFilterContainer.toggleClass("narrow", narrow);
        this.$topModeContainer.toggleClass("narrow", narrow);
        // this.$topDatePickerContainer.children().toggleClass("narrow", narrow && (reqWidth - availWidth) >= 120);
        this.$topNewTask.toggleClass("narrow", narrow && (reqWidth - availWidth) >= 120);
        this.$topLeft.children().eq(0).toggleClass("narrow", narrow && (reqWidth - availWidth) >= 120);
        this.updateSettingsMenuRight();
    }
    
    
    
    
    
    
    /****************************************
    ******** Activation/deactivation ********
    *****************************************/
    activate() {
        this.isActive = true;
        Q().then(() => {
            this.repaint();
        });
    }
    
    deactivate() {
        this.isActive = false;
    }
    
    
    
    
    
    
    /****************************************
    **************** Repaint ****************
    *****************************************/
    getRenderer(): Renderer<any> {
        let mode = this.getModeStr();
        if (!(mode in this.renderers)) {
            if (mode == Modes.MONTH) {
                this.renderers[mode] = new MonthRenderer(this, this.fastListCreator);
                this.renderers[mode].init();
            }
            else if (mode == Modes.WEEK) {
                this.renderers[mode] = new WeekRenderer(this, this.fastListCreator);
                this.renderers[mode].init();
            }
            else if (mode == Modes.SINGLE_WEEK) {
                this.renderers[mode] = new SingleWeekRenderer(this);
                this.renderers[mode].init();
            }
            else if (mode == Modes.SINGLE_DAY) {
                this.renderers[mode] = new SingleDayRenderer(this);
                this.renderers[mode].init();
            }
        }
        return this.renderers[mode];
    }
    
    repaint(): void {
        this.getRenderer().repaint();
    }
    
    taskInRange(visibleRangeStart: number, visibleRangeEnd: number, taskStart: number, taskEnd: number) {
        return taskStart < visibleRangeEnd && taskEnd > visibleRangeStart;
    }
    
    getFragmentsContainerRect(): Rect {
        let mode = this.getMode();
        let el = this.fragmentsContainers[<string>mode];
        if (!el) {
            return { x:0, y:0, w:0, h:0 };
        }
        if (mode == Modes.MONTH) {
            let rect = el.getBoundingClientRect();
            return {
                x: rect.left,
                y: rect.top,
                w: rect.width - MonthRenderer.LEFT_HEADERS_WIDTH,
                h: rect.height - 23,
            };
        }
        else if (mode == Modes.WEEK) {
            let rect = el.getBoundingClientRect();
            return {
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height,
            };
        }
        else if (mode == Modes.SINGLE_WEEK) {
            let rect = el.getBoundingClientRect();
            return {
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height,
            };
        }
        else if (mode == Modes.SINGLE_DAY) {
            let rect = el.getBoundingClientRect();
            return {
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height,
            };
        }
        return { x:0, y:0, w:0, h:0 };
    }
    
    
    
    
    
    
    /****************************************
    ***************** "Mode"s *****************
    *****************************************/
    overrideMode(mode: Modes): void {
        this._overrideMode = mode;
        if (this.model) {
            this.updateClasses();
            this.repaint();
        }
    }
    getMode(): Modes {
        let mode = <Modes>this.getSetting("mode");
        if (this._overrideMode) {
            mode = this._overrideMode;
        }
        return mode;
    }
    getModeStr(): string {
        return <string>this.getMode();
    }
    
    
    
    
    
    /****************************************
    ***************** Data ******************
    *****************************************/
    setTasks(taskModelsStr: string, removeExistingTasks: boolean): void {
        if (removeExistingTasks) {
            this.model.tasks = {};
        }
        let taskModels: { [id: string]: TaskModel } = JSON.parse(taskModelsStr);
        for (let id in taskModels) {
            let taskModel = taskModels[id];
            this.model.tasks[taskModel.id] = taskModel;
            this.parent.fontMetrics.add(taskModel.title);
            this.parent.fontMetrics.measure();
        }
        this.repaint();
    }
    
    setTask(taskModelStr: string): void {
        let taskModel: TaskModel = JSON.parse(taskModelStr);
        this.model.tasks[taskModel.id] = taskModel;
        this.parent.fontMetrics.add(taskModel.title);
        this.parent.fontMetrics.measure();
        this.repaint();
    }
    
    delTask(taskId: string): void {
        delete this.model.tasks[taskId];
        this.repaint();
    }
    
    
    
    
    
    
    /****************************************
    *************** Selection ***************
    *****************************************/
    updateSelection(): void {
        this.$container.find(".selected-day").removeClass("selected-day");
        this.$container.find(".selected-task").removeClass("selected-task");
        if (this.selectedDay) {
            this.$container.find(".day[data-day='" + this.selectedDay + "']").addClass("selected-day");
        }
        if (this.selectedTask) {
            this.$container.find(".task[data-task-id='" + this.selectedTask + "']").addClass("selected-task");
        }
    }
    
    selectDay(day: string): void {
        let mode = this.getMode();
        let canSelectDays = mode == Modes.MONTH || ((mode == Modes.WEEK || mode == Modes.SINGLE_WEEK) && CalendarPanelView.ENABLE_PREVIEW_IN_WEEK_MODE);
        if (day && !canSelectDays) {
            day = null;
        }
        this.selectedDay = day;
        this.updateSelection();
        if (canSelectDays) {
            this.triggerEvent("requestDayPreview", this.selectedDay);
            if (!this.getSetting("enable-day-preview-panel")) {
                this.selectTask(null);
            }
        }
    }
    
    selectTask(task: string): void {
        if (this.selectedTask != task) {
            this.selectedTask = task;
            this.updateSelection();
            this.triggerEvent("requestTaskPreview", this.selectedTask);
        }
    }
    
    markTaskAsSelected(taskId: string): void {
        if (this.selectedTask != taskId) {
            this.selectedTask = taskId;
            this.updateSelection();
        }
    }
    
    
    
    
    
    
    
    /****************************************
    *************** Selection ***************
    *****************************************/
    searchStr: string = null;
    applySearchFilter(searchStr: string): void {
        this.searchStr = searchStr;
        if (!this.isActive) {
            return;
        }
        this.repaint();
    }
    
    
    
    
    
    
    /****************************************
    **************** DragDrop ***************
    *****************************************/
    onTaskDragStart(e: DragEvent): void {
        e.stopPropagation();
        (<DragEvent>(<any>e).originalEvent).dataTransfer.setData("text/plain", "123"); // Fix firefox bug
        let taskId = (<HTMLElement>e.currentTarget).getAttribute("data-task-id");
        (<any>window)._dragTaskId = taskId;
        this.taskTooltip.hide();
        this.$calendars.addClass("dragdrop-on");
    }
    
    onTaskDragEnd(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.$calendars.removeClass("dragdrop-on");
    }
    
    onDragOverDay(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.handleDragOverAndDrop(e, false);
    }
    
    onDropOnDay(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.handleDragOverAndDrop(e, true);
    }
    
    handleDragOverAndDrop(e: DragEvent, drop: boolean): void {
        let $el = $(<HTMLElement>e.currentTarget);
        let off = $el.offset();
        let x = e.pageX - off.left;
        let y = e.pageY - off.top;
        let targetMode: Modes = $el.hasClass("entry") ? Modes.WEEK : Modes.MONTH;
        let preciseDragDrop = !!this.getSetting("precise-dragdrop") || targetMode == Modes.WEEK;
        this.$calendars.toggleClass("dragdrop-with-hints", preciseDragDrop);
        
        // Calc day rect
        let rect = $el[0].getBoundingClientRect();
        let width = rect.width;
        let height = rect.height;
        if (targetMode == Modes.MONTH) {
            width -= 1;
            height -=1;
        }
        else {
            height -= MonthRenderer.TOP_HEADERS_HEIGHT;
            y -= MonthRenderer.TOP_HEADERS_HEIGHT;
        }
        
        // Get dragged task info
        let taskId = (<any>window)._dragTaskId;
        let task = this.model.tasks[taskId];
        let draggedTaskIsWholeDay = task.wholeDays;
        
        // Calc start and end dates
        this.$container.find(".dragdrop-current-target").removeClass("dragdrop-current-target");
        if (!drop && targetMode == Modes.MONTH) {
            $(<HTMLElement>e.currentTarget).addClass("dragdrop-current-target");
        }
        let [day, month, year] = (<HTMLElement>e.currentTarget).getAttribute("data-day").split(".").map(x => parseInt(x));
        let visibleT0 = 0;
        let visibleDuration = 86400000;
        if (targetMode == Modes.WEEK) {
            let renderer = (<WeekRenderer>this.getRenderer());
            let scaleFactor = renderer.vsz.calcScaleFactor();
            visibleT0 = renderer.vsz.totalVirtualHeight ? Math.round(renderer.vsz.virtualScrollTop / renderer.vsz.totalVirtualHeight * 24) : 0;
            visibleDuration = scaleFactor ? Math.round(24 / scaleFactor) : 24;
            visibleT0 *= 3600000;
            visibleDuration *= 3600000;
        }
        let msecs = draggedTaskIsWholeDay ? 0 : (visibleT0 + y / height * visibleDuration);
        if (preciseDragDrop) {
            let rounding = 15 * 60 * 1000;
            msecs = Math.round(msecs / rounding) * rounding;
            msecs = Math.min(86400000 - rounding, Math.max(0, msecs));
        }
        else {
            let dt = new Date(task.startTimestamp);
            msecs = DateUtils.getDayMsecs(dt);
        }
        let duration = task.endTimestamp - task.startTimestamp;
        let startDate =  new Date(year, month, day, 0, 0, 0, msecs);
        let endDate = new Date(year, month, day, 0, 0, 0, msecs + (draggedTaskIsWholeDay ? 86400000 : duration));
        
        // Perform drop (if drop == true)
        if (drop) {
            this.triggerEvent("setTaskStartTimestamp", taskId, startDate.getTime());
            return;
        }
        
        // Get drop hint text
        if (preciseDragDrop) {
            let hintText = "";
            if (draggedTaskIsWholeDay) {
                let s = this.formatDate(startDate);
                hintText = s.substr(0, s.length - 6);
            }
            else {
                hintText = this.formatDate(startDate) + " - " + this.formatDate(endDate);
            }
            this.$dragDropHintText.text(hintText);
            this.$dragDropHintText.css({
                transform: "translate(" + e.pageX + "px, " + e.pageY + "px)"
            });
        }
    }
    
    pad0s(n: number): string {
        return n < 10 ? ("0" + n) : n.toString();
    }
    
    formatDate(dt: Date): string {
        return this.pad0s(dt.getDate()) + "." + this.pad0s(dt.getMonth() + 1) + "." + dt.getFullYear() + " " + this.pad0s(dt.getHours()) + ":" + this.pad0s(dt.getMinutes());
    }
    
    getPrevNextAbsDelta(): number {
        if (this.getRenderer().getRendererName() == "week") {
            return null;
        }
        return this.getRenderer().getPrevNextAbsDelta();
    }

    updatePersonPresence(hashmail: string, present: boolean): void {
        this.$container.find("[data-person-hashmail='" + hashmail + "']").toggleClass("present", present);
    }
    
    
    
    
    
    
    /****************************************
    ************ Extra calendars ************
    *****************************************/
    updateMainSelectedItem(): void {
        let cs = this.customSelectExtraCalendars;
        let $cont = cs.$selectedItemsContainer;
        let selectedItems = cs.items.filter(it => it.selected);
        let nSelectedItems = selectedItems.length;
        
        let $li = $cont.children("li.counter-item");
        if ($li.length == 0) {
            $cont.append(`<li class="item counter-item"><span class="plus">+</span><span class="count"></span><i class="privmx-icon privmx-icon-calendar"></i></li>`);
            $li = $cont.children("li.counter-item");
        }
        
        $li.find(".count").text(nSelectedItems).toggleClass("zero", nSelectedItems == 0);
    }
    
    
    
    
    
    /****************************************
    *********** Files in calendar ***********
    *****************************************/
    setFileModels(fileModelsStr: string, removeExistingFileModels: boolean): void {
        if (removeExistingFileModels) {
            this.model.files = {};
        }
        let fileModels: { [id: string]: FileModel } = JSON.parse(fileModelsStr);
        for (let identifier in fileModels) {
            let fileModel = fileModels[identifier];
            this.model.files[identifier] = fileModel;
            this.parent.fontMetrics.add(fileModel.path);
            this.parent.fontMetrics.measure();
        }
        this.repaint();
    }
    
    setFileModel(fileModelStr: string): void {
        let fileModel: FileModel = JSON.parse(fileModelStr);
        this.model.files[fileModel.identifier] = fileModel;
        this.parent.fontMetrics.add(fileModel.path);
        this.parent.fontMetrics.measure();
        this.repaint();
    }
    
    delFileModel(identifier: string): void {
        delete this.model.files[identifier];
        this.repaint();
    }
    
}
