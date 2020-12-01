import * as web from "pmc-web";
import { func as mainTemplate } from "./template/main.html";
import { Model, CalendarWindowController } from "./CalendarWindowController";
import Q = web.Q;
import $ = web.JQuery;
import { CalendarPanelView } from "../../component/calendarPanel/CalendarPanelView";
import { TaskPanelView } from "privfs-mail-client-tasks-plugin/src/component/taskPanel/TaskPanelView";
import { DatePickerView } from "../../component/datePicker/DatePickerView";
import { WebRequest } from "electron";
const ResizeObserverPolyfill = require("resize-observer-polyfill");

const enum ACTIVE_PANEL {
    sidebar = 0,
    calendar1 = 1,
    calendar2 = 2,
    preview = 3,
}

export interface HostEntryModel {
    host: string;
    sectionsList: web.component.remotesectionlist.RemoteSectionListView;
    conv2List: web.component.remoteconv2list.RemoteConv2ListView;
}

export class CalendarWindowView extends web.window.base.BaseWindowView<Model> {
    
    static readonly SIDEBAR_MIN_WIDTH = 100;
    static readonly CALENDAR1_MIN_WIDTH = 340;
    static readonly CALENDAR1_MIN_HEIGHT = 100;
    static readonly CALENDAR2_MIN_WIDTH = 100;
    static readonly CALENDAR2_MIN_HEIGHT = 100;
    static readonly PREVIEW_MIN_WIDTH = 100;
    static readonly PREVIEW_MIN_HEIGHT = 50;
    
    verticalSplitter: web.component.splitter.SplitterView;
    verticalSplitter2: web.component.splitter.SplitterView;
    horizontalSplitter: web.component.splitter.SplitterView;
    calendarsSplitter: web.component.splitter.SplitterView;
    $settingsMenu: JQuery;
    $sidebar: JQuery;
    $calendars: JQuery;
    $calendar1: JQuery;
    $calendar2: JQuery;
    $preview: JQuery;
    $disabledSectionContainer: JQuery;
    calendar1Panels: { [key: string]: CalendarPanelView } = {};
    calendar2Panels: { [key: string]: CalendarPanelView } = {};
    previewPanel: TaskPanelView;
    sectionsList: web.component.sectionlist.SectionListView;
    sidebar: web.component.sidebar.SidebarView;
    personsComponent: web.component.persons.PersonsView;
    personTooltip: web.component.persontooltip.PersonTooltipView;
    notifications: web.component.notification.NotificationView;
    infoTooltip: web.component.infotooltip.InfoTooltip;
    sectionTooltip: web.component.sectiontooltip.SectionTooltipView;
    datePicker: DatePickerView;
    disabledSection: web.component.disabledsection.DisabledSectionView;
    initializedDeferred: Q.Deferred<void> = Q.defer();
    activeProjectId1: string = null;
    activeProjectId2: string = null;
    activeProjectHostHash1: string = null;
    activeProjectHostHash2: string = null;
    pendingEnsureCorrectPanelSizes: boolean = false;
    
    _showPreviewPanel: boolean;
    _horizontalTaskLayout: boolean;
    _showDayPreviewPanel: boolean;
    
    remoteServers: {[hostHash: string]: HostEntryModel} = {};

    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
        if (!(<any>window).ResizeObserver) {
            (<any>window).ResizeObserver = ResizeObserverPolyfill;
        }
        
        this.verticalSplitter = this.addComponent("verticalSplitter", new web.component.splitter.SplitterView(this, {
            type: "vertical",
            handlePlacement: "right",
            handleDot: true,
            firstPanelMinSize: CalendarWindowView.SIDEBAR_MIN_WIDTH,
            secondPanelMinSize: () => {
                let taken = 0;
                taken += CalendarWindowView.CALENDAR1_MIN_WIDTH;
                if (this.verticalSplitter2 && this.verticalSplitter2.$right && this.verticalSplitter2.$right.children().length > 0 && this._showPreviewPanel) {
                    taken += this.verticalSplitter2.$right.outerWidth();
                }
                if (this.$calendars.hasClass("two-calendars")) {
                    taken += this.calendarsSplitter.$right.outerWidth();
                }
                return taken;
            },
        }));
        this.verticalSplitter2 = this.addComponent("verticalSplitter2", new web.component.splitter.SplitterView(this, {
            type: "vertical",
            handlePlacement: "right",
            handleDot: true,
            flip: true,
            firstPanelMinSize: () => {
                if (this._showDayPreviewPanel) {
                    return CalendarWindowView.CALENDAR2_MIN_WIDTH + this.calendarsSplitter.$left.outerWidth();
                }
                else {
                    return CalendarWindowView.CALENDAR2_MIN_WIDTH;
                }
            },
            secondPanelMinSize: CalendarWindowView.PREVIEW_MIN_WIDTH,
        }));
        this.horizontalSplitter = this.addComponent("horizontalSplitter", new web.component.splitter.SplitterView(this, {
            type: "horizontal",
            handlePlacement: "bottom",
            handleDot: true,
            flip: true,
            firstPanelMinSize: () => {
                return Math.max(CalendarWindowView.CALENDAR1_MIN_HEIGHT, this.$calendars.hasClass("two-calendars") ? CalendarWindowView.CALENDAR2_MIN_HEIGHT : 0);
            },
            secondPanelMinSize: CalendarWindowView.PREVIEW_MIN_HEIGHT,
        }));
        this.calendarsSplitter = this.addComponent("calendarsSplitter", new web.component.splitter.SplitterView(this, {
            type: "vertical",
            handlePlacement: "right",
            handleDot: true,
            flip: false,
            firstPanelMinSize: CalendarWindowView.CALENDAR1_MIN_WIDTH,
            secondPanelMinSize: CalendarWindowView.CALENDAR2_MIN_WIDTH,
        }));
        this.personsComponent = this.addComponent("personsComponent", new web.component.persons.PersonsView(this, this.helper));
        this.personTooltip = new web.component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        this.sectionTooltip = this.addComponent("sectiontooltip", new web.component.sectiontooltip.SectionTooltipView(this));
        this.notifications = this.addComponent("notifications", new web.component.notification.NotificationView(this, {xs: true}));
        this.disabledSection = this.addComponent("disabled-section", new web.component.disabledsection.DisabledSectionView(this));
        this.sidebar = this.addComponent("sidebar", new web.component.sidebar.SidebarView(this, {
            conv2List: {
                personsView: this.personsComponent,
                extList: {
                    template: null
                }
            },
            conv2Splitter: null,
            customElementList: {
                extList: {
                    template: null,
                    onAfterListRender: this.onAfterRenderCustomList.bind(this)
                }
            },
            sectionList: {
                extList: {
                    template: null
                }
            },
            customSectionList: {
                extList: {
                    template: null
                }
            },
        }));
        this.datePicker = this.addComponent("datePicker", new DatePickerView(this));
        this.sidebar.customElementList.customElements.addEventListener("ext-list-change", this.personsComponent.refreshAvatars.bind(this.personsComponent));
        this.sidebar.customElementList.customElementsA.addEventListener("ext-list-change", this.personsComponent.refreshAvatars.bind(this.personsComponent));
        this.turnTimeAgoRefresher(5 * 60 * 1000);
        
        web.Starter.dispatchEvent<any>({
            type: "request-task-panel-view",
            parent: this,
            name: "task-panel-view",
        });
    }
    
    registerPreview(name: string, el: TaskPanelView): void {
        this.previewPanel = this.addComponent("previewPanel", el);
    }
    
    onAfterRenderCustomList(): void {
        this.personsComponent.refreshAvatars();
    }
    
    initWindow(model: Model): any {
        this.setModel(model);
        
        this.$settingsMenu = this.$main.find(".context-menu-settings");
        this.$sidebar = this.$main.find(".panel-sidebar");
        this.$calendar1 = this.$main.find(".panel-calendar1");
        this.$calendar2 = this.$main.find(".panel-calendar2");
        this.$preview = this.$main.find(".panel-preview");
        
        this.$calendar1.on("click", this.onCalendar1PanelClick.bind(this));
        this.$calendar2.on("click", this.onCalendar2PanelClick.bind(this));
        this.$preview.on("click", this.onPreviewPanelClick.bind(this));
        this.$body.on("click", ".close-day-preview-btn", this.onCloseDayPreviewClick.bind(this));
        this.bindKeyboardEvents();
        
        if ((<any>window).ResizeObserver) {
            let resizeObserver = new (<any>window).ResizeObserver(() => {
                this.updateCalendar1HeaderRight();
            });
            resizeObserver.observe(this.$calendar2[0]);
        }
        
        if (this._showPreviewPanel) {
            this.$main.children(".right-buttons").children().addClass("gray");
        }
        else {
            this.$main.children(".right-buttons").children().removeClass("gray");
        }
        
        this.notifications.$container = this.$main.find(".notifications-container-wrapper");
        return Q().then(() => {
            this.verticalSplitter.$container = this.$main.find(".panels");
            return this.verticalSplitter.triggerInit();
        })
        .then(() => {
            let $container = $("<div class=\"calendar-container\"></div>");
            this.verticalSplitter.$right.append($container);
            this.verticalSplitter2.$container = $container;
            return this.verticalSplitter2.triggerInit();
        })
        .then(() => {
            this.horizontalSplitter.$container = this.verticalSplitter2.$left;
            return this.horizontalSplitter.triggerInit();
        })
        .then(() => {
            this.$calendars = $("<div class='calendars one-calendar'></div>");
            this.horizontalSplitter.$top.append(this.$calendars);
            this.horizontalSplitter.$top.css("overflow", "hidden");
            if (!this._showPreviewPanel) {
                this.hideTaskPreviewPanel();
            }
            this.updatePreviewLocation(model.horizontalTaskLayout);
            this.sidebar.$container = this.verticalSplitter.$left;
            this.sidebar.$container.addClass("sidebar-container");
            this.personsComponent.$main = this.$main;
            return Q.all([
                this.personsComponent.triggerInit(),
                this.notifications.triggerInit(),
            ]);
        })
        .then(() => {
            this.calendarsSplitter.$container = this.$calendars;
            return this.calendarsSplitter.triggerInit();
        })
        .then(() => {
            this.calendarsSplitter.$left.append(this.$calendar1);
            this.calendarsSplitter.$right.append(this.$calendar2);
            this.sidebar.$container.on("click", this.onSidebarClick.bind(this));
            return this.sidebar.triggerInit();
        })
        .then(() => {
            this.verticalSplitter.$handle.on("mousedown", () => {
                this.setFirstPanelResizable(true);
            });
            this.verticalSplitter2.$handle.on("mousedown", () => {
                this.setFirstPanelResizable(false);
            });
        })
        .then(() => {
            this.$main.focus();
            this.grabFocus();
            this.personTooltip.init(this.sidebar.$container);
            this.personsComponent.refreshAvatars();
            this.makeCustomScroll(this.verticalSplitter.$left.find(".sidebar"));
            this.initializedDeferred.resolve();
        })
        .then(() => {
            this.$disabledSectionContainer = $("<div class='disabled-section hidden'></div>");
            this.verticalSplitter.$right.append(this.$disabledSectionContainer);
            this.disabledSection.$container = this.$disabledSectionContainer;
            this.disabledSection.triggerInit();
        })
        .then(() => {
            this.previewPanel.$container = this.$preview;
            return this.previewPanel.triggerInit();
        })
        .then(() => {
            this.sectionTooltip.refreshAvatars = this.personsComponent.refreshAvatars.bind(this.personsComponent);
            this.sidebar.usersListTooltip.refreshAvatars = this.personsComponent.refreshAvatars.bind(this.personsComponent);
            this.sectionTooltip.$container = this.$main;
            return this.sectionTooltip.triggerInit();
        }).then(() => {
            this.changeTaskPreviewPanelVisibility(this._showPreviewPanel);
            this.updatePreviewLocation(this._horizontalTaskLayout);
            this.calendarsSplitter.updateRelativeHandlePosition();
        }).then(() => {
            let $cont = $("<div class='common-datepicker-container'></div>");
            this.$body.find(".calendars").append($cont);
            this.datePicker.$container = $cont;
            return this.datePicker.triggerInit();
        });
    }
    
    checkInit(): Q.Promise<void> {
        return this.initializedDeferred.promise;
    }
    
    setModel(model: Model) {
        this._showPreviewPanel = model.showTaskPreviewPanel;
        this._horizontalTaskLayout = model.horizontalTaskLayout;
    }
    
    onSearchChanged(searchOn: boolean, refreshAvatars: boolean) {
        if (refreshAvatars) {
            this.personsComponent.refreshAvatars();
        }
        this.$main.toggleClass("search-on", searchOn);
        this.sidebar.refreshInfoTooltips();
    }
    
    toggleDisabledSection(show: boolean): void {
        this.verticalSplitter.$right.children(".calendar-container").toggleClass("hidden", show);
        this.$disabledSectionContainer.toggleClass("hidden", !show);
    }
    
    setFirstPanelResizable(resizable: boolean): void {
        if (this.calendarsSplitter.flip == resizable) {
            return;
        }
        this.calendarsSplitter.flip = resizable;
        let size = !this.calendarsSplitter.flip ? this.calendarsSplitter.$component.outerWidth() - this.calendarsSplitter.relativeHandlePosition - 10 : this.calendarsSplitter.relativeHandlePosition + 10;
        size = Math.max(size, typeof(this.calendarsSplitter.firstPanelMinSize) == "function" ? this.calendarsSplitter.firstPanelMinSize() : this.calendarsSplitter.firstPanelMinSize);
        this.calendarsSplitter.setFirstElementSize(size);
    }
    
    fixPanelsArrangement(): void {
    }
    
    
    
    
    
    
    /****************************************
    ************* Preview panel *************
    ****************************************/
    enableDayPreviewPanel(): void {
        this._showDayPreviewPanel = true;
        this.$calendars.removeClass("one-calendar");
        this.$calendars.addClass("two-calendars");
        this.updateCalendar1HeaderRight();
        this.fixPanelsArrangement();
        this.ensureCorrectPanelIsFocused();
        this.updateCalendarPanelsVisibility(2);
    }
    
    hideDayPreviewPanel(): void {
        this._showDayPreviewPanel = false;
        this.$calendars.addClass("one-calendar");
        this.$calendars.removeClass("two-calendars");
        this.$calendar1.find(".mode").css("width", "auto").css("width", "100%"); // Fix Chrome bug
        this.updateCalendar1HeaderRight();
        this.ensureCorrectPanelIsFocused();
        this.updateCalendarPanelsVisibility(2);
    }
    
    changeDayPreviewPanelVisibility(show: boolean) {
        if (this._showDayPreviewPanel == show) {
            return;
        }
        if (show) {
            this.enableDayPreviewPanel();
        }
        else {
            this.hideDayPreviewPanel();
        }
        this.ensureCorrectPanelSizes();
    }
    
    showTaskPreviewPanel(): void {
        this._showPreviewPanel = true;
        let $el = this.$calendar1.closest(".component-splitter-panel-top");
        $el.addClass("show-task-preview-panel");
        $el.removeClass("hide-task-preview-panel");
        $el.closest(".component-splitter-panel-left").addClass("show-task-preview-panel");
        $el.closest(".component-splitter-panel-left").removeClass("hide-task-preview-panel");
        this.fixPanelsArrangement();
        this.ensureCorrectPanelIsFocused();
    }
    
    hideTaskPreviewPanel(): void {
        this._showPreviewPanel = false;
        let $el = this.$calendar1.closest(".component-splitter-panel-top");
        $el.removeClass("show-task-preview-panel");
        $el.addClass("hide-task-preview-panel");
        $el.closest(".component-splitter-panel-left").removeClass("show-task-preview-panel");
        $el.closest(".component-splitter-panel-left").addClass("hide-task-preview-panel");
        this.ensureCorrectPanelIsFocused();
    }
    
    changeTaskPreviewPanelVisibility(show: boolean) {
        if (show) {
            this.showTaskPreviewPanel();
        }
        else {
            this.hideTaskPreviewPanel();
        }
    }
    
    updatePreviewLocation(horizontalLayout: boolean): void {
        let $horizontalSplitter = this.$calendar1.closest(".component-splitter-panel-top");
        let $verticalSplitter = $horizontalSplitter.closest(".component-splitter-panel-left");
        $horizontalSplitter.toggleClass("show-preview", horizontalLayout);
        $horizontalSplitter.toggleClass("hide-preview", !horizontalLayout);
        $verticalSplitter.toggleClass("show-preview", !horizontalLayout);
        $verticalSplitter.toggleClass("hide-preview", horizontalLayout);
        if (horizontalLayout) {
            this.horizontalSplitter.$bottom.append(this.$preview);
        }
        else {
            this.verticalSplitter2.$right.append(this.$preview);
        }
        this.fixPanelsArrangement();
    }
    
    updateCalendar1HeaderRight(): void {
        // if (!this.$calendars) {
        //     return;
        // }
        // let twoCalendars = this.$calendars.hasClass("two-calendars");
        // let right = twoCalendars ? this.$calendar2.width() : 0;
        // this.$calendar1.find(".top").css("right", -Math.ceil(right));
        // if (!twoCalendars) {
        //     Q().then(() => {
        //         this.setFirstPanelResizable(true);
        //     });
        // }
    }
    
    ensureCorrectPanelSizes(onTabOpen: boolean = false): void {
        if (this.calendarsSplitter.$component.is(":visible")) {
            let size = this.calendarsSplitter.flip ? this.calendarsSplitter.$component.outerWidth() - this.calendarsSplitter.relativeHandlePosition - 10 : this.calendarsSplitter.relativeHandlePosition + 10;
            if (onTabOpen) {
                size = !this.calendarsSplitter.flip ? this.calendarsSplitter.$component.outerWidth() - this.calendarsSplitter.relativeHandlePosition - 10 : this.calendarsSplitter.relativeHandlePosition + 10;
            }
            size = Math.max(size, typeof(this.calendarsSplitter.firstPanelMinSize) == "function" ? this.calendarsSplitter.firstPanelMinSize() : this.calendarsSplitter.firstPanelMinSize);
            this.calendarsSplitter.setFirstElementSize(size);
        }
        else {
            this.pendingEnsureCorrectPanelSizes = true;
        }
    }
    
    setIsCalendarTabOpen(isOpen: boolean): void {
        if (this.pendingEnsureCorrectPanelSizes && isOpen) {
            this.pendingEnsureCorrectPanelSizes = false;
            this.ensureCorrectPanelSizes(true);
        }
    }
    
    updateCalendarPanelsVisibility(onlyCalendar: 1|2 = null): void {
        if (onlyCalendar !== 2) {
            let activeId = this.getCalendarPanelKey(this.activeProjectHostHash1, this.activeProjectId1);
            for (let id in this.calendar1Panels) {
                let cpc = this.calendar1Panels[id];
                cpc.setIsVisible(id == activeId,"left");
            }
        }
        if (onlyCalendar !== 1) {
            let activeId = this.getCalendarPanelKey(this.activeProjectHostHash2, this.activeProjectId2);
            for (let id in this.calendar2Panels) {
                let cpc = this.calendar2Panels[id];
                cpc.setIsVisible(this._showDayPreviewPanel && id == activeId,"right");
            }
        }
    }
    
    
    
    
    
    /****************************************
    *************** Keyboard ****************
    ****************************************/
    bindKeyboardEvents(): void {
        $(document).on("keydown", this.keyboardHandler.bind(this));
    }
    
    keyboardHandler(e: KeyboardEvent): void {
        if (e.key == "Tab") {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                // Tab
                if (!e.shiftKey) {
                    this.focusNextPanel();
                }
                else {
                    this.focusPrevPanel();
                }
            }
            else {
                e.preventDefault();
                e.stopImmediatePropagation();
                var newEvent = new KeyboardEvent("keydown", <any>{
                    key: "Tab",
                    keyCode: 9,
                    ctrlKey: true,
                    shiftKey: e.shiftKey,
                    bubbles: true,
                });
                (<any>parent.frameElement).contentDocument.dispatchEvent(newEvent);
            }
        }
        else if ((e.key == "r" && e.ctrlKey) || e.key == "F5") {
            e.preventDefault();
            this.triggerEvent("refresh");
        }
    }
    
    
    
    
    
    /****************************************
    *********** Focus management ************
    ****************************************/
    activePanelId: ACTIVE_PANEL = ACTIVE_PANEL.sidebar;
        
    focusNextPanel(): void {
        this.switchToPanel(this.activePanelId + 1, true, 1);
    }
    
    focusPrevPanel(): void {
        this.switchToPanel(this.activePanelId - 1, true, -1);
    }
    
    switchToPanel(id: number, showHighlight: boolean, direction: number) {
        let max = 4;
        let newId = (id + max) % max;
        
        this.$main.find(".focus-highlight").remove();
        let $highlight = $('<div class="focus-highlight"></div>');
        
        let oldPanelId = this.activePanelId;
        this.activePanelId = newId < 0 ? newId + max : newId;
        for (let i = 0; i < 4; ++i) {
            if ((this.activePanelId == ACTIVE_PANEL.calendar2 && !this._showDayPreviewPanel) || (this.activePanelId == ACTIVE_PANEL.preview && !this._showPreviewPanel)) {
                this.activePanelId = (this.activePanelId + direction + max) % max;
            }
        }
        if (showHighlight && oldPanelId != this.activePanelId) {
            let $neigh: JQuery = $();
            let $toFocus: JQuery = $();
            if (this.activePanelId == ACTIVE_PANEL.sidebar) {
                $toFocus = this.$main.find(".sidebar-container");
                $neigh = $toFocus.children(".sidebar").first();
            }
            else if (this.activePanelId == ACTIVE_PANEL.calendar1) {
                $neigh = this.$calendar1.children(".calendarpanel-container.active");
                $toFocus = $neigh.children(".panel");
            }
            else if (this.activePanelId == ACTIVE_PANEL.calendar2) {
                $neigh = this.$calendar2.children(".calendarpanel-container.active");
                $toFocus = $neigh.children(".panel");
            }
            else if (this.activePanelId == ACTIVE_PANEL.preview) {
                $neigh = this.$preview.children(".component-task-panel-main");
                $toFocus = $neigh;
            }
            $highlight.insertAfter($neigh);
            $toFocus.focus();
        }
        setTimeout(() => {
            $highlight.remove();
        }, 500);
    }
    
    ensureCorrectPanelIsFocused(): void {
        this.switchToPanel(this.activePanelId, false, 1);
    }
    
    grabFocus(highlight: boolean = true): void {
        let activePanel = this.activePanelId;
        this.activePanelId = activePanel == 0 ? activePanel + 1 : activePanel - 1;
        this.switchToPanel(activePanel, highlight, activePanel == 0 ? 1 : -1);
    }
    
    onSidebarClick(): void {
        this.switchToPanel(ACTIVE_PANEL.sidebar, false, 0);
    }
    
    onCalendar1PanelClick(): void {
        this.switchToPanel(ACTIVE_PANEL.calendar1, false, 0);
    }
    
    onCalendar2PanelClick(): void {
        this.switchToPanel(ACTIVE_PANEL.calendar2, false, 0);
    }
    
    onPreviewPanelClick(): void {
        this.switchToPanel(ACTIVE_PANEL.preview, false, 0);
    }
    
    onCloseDayPreviewClick(): void {
        this.triggerEvent("closeDayPreview");
    }
    
    
    
    
    
    /****************************************
    ************* CalendarPanel *************
    ****************************************/
    createCalendar1Panel(hostHash: string, projectId: string): CalendarPanelView {
        // console.log("createCalendar1Panel", {hostHash,projectId})
        let calendarPanelKey = this.getCalendarPanelKey(hostHash, projectId);
        if (calendarPanelKey in this.calendar1Panels) {
            return this.calendar1Panels[calendarPanelKey];
        }
        let panel = this.addComponent("calendar1Panel-" + calendarPanelKey, new CalendarPanelView(this, this.personsComponent));
        let $container = $("<div class='calendarpanel-container' data-id='" + projectId + "' data-host-hash='" + hostHash + "'></div>");
        this.$calendar1.append($container);
        panel.$container = $container;
        panel.triggerInit();
        this.calendar1Panels[calendarPanelKey] = panel;
    }
    
    openCalendar1Panel(hostHash: string, projectId: string): void {
        // console.log("openCalendar1Panel", {hostHash,projectId})
        let needsCustomSelectsFlashing: boolean = false;
        if (this.activeProjectId1 != null && this.activeProjectId1 != projectId) {
            needsCustomSelectsFlashing = true;
        }
        this.activeProjectId1 = projectId;
        this.activeProjectHostHash1 = hostHash;
        
        let $containers = this.$calendar1.find(".calendarpanel-container");
        let $container = $containers.filter("[data-id='" + projectId + "'][data-host-hash='" + hostHash + "']");
        $containers.removeClass("active");
        $container.addClass("active");
        this.$main.find(".panels").children().children(".component-splitter-panel-right").toggleClass("hidden", this.$main.find(".calendarpanel-container.active").length == 0);
        
        if (needsCustomSelectsFlashing) {
            this.flashCustomSelects($container);
        }
        
        this.updateCalendarPanelsVisibility(1);
    }
    
    createCalendar2Panel(hostHash: string, projectId: string): CalendarPanelView {
        // console.log("createCalendar2Panel", {hostHash,projectId})
        let calendarPanelKey = this.getCalendarPanelKey(hostHash, projectId);
        if (calendarPanelKey in this.calendar2Panels) {
            return this.calendar2Panels[calendarPanelKey];
        }
        let panel = this.addComponent("calendar2Panel-" + calendarPanelKey, new CalendarPanelView(this, this.personsComponent));
        let $container = $("<div class='calendarpanel-container' data-id='" + projectId + "' data-host-hash='" + hostHash + "'></div>");
        this.$calendar2.append($container);
        panel.$container = $container;
        panel.triggerInit();
        this.calendar2Panels[calendarPanelKey] = panel;
    }
    
    openCalendar2Panel(hostHash: string, projectId: string): void {
        // console.log("openCalendar2Panel", {hostHash,projectId})
        this.activeProjectId2 = projectId;
        this.activeProjectHostHash2 = hostHash;
        
        let $containers = this.$calendar2.find(".calendarpanel-container");
        let $container = $containers.filter("[data-id='" + projectId + "'][data-host-hash='" + hostHash + "']");
        $containers.removeClass("active");
        $container.addClass("active");
        this.$main.find(".panels").children().children(".component-splitter-panel-right").toggleClass("hidden", this.$main.find(".calendarpanel-container.active").length == 0);
        
        this.updateCalendarPanelsVisibility(2);
    }
    
    flashCustomSelects($container: JQuery): void {
        if ($container && $container.length > 0) {
            $container.find(".top .component-custom-select-main, .top .prev-btn, .top .next-btn, .top .today-btn").fadeOut(150).fadeIn(300);
        }
    }
    
    expandRemoteSectionsList(host: string, hostHash: string): void {
        if (this.isRemoteHostVisible(hostHash)) {
            this.toggleRemoteHost(hostHash, false);
            return;
        }
        let $hostElement: JQuery<HTMLElement>;
        this.sidebar.showHostLoading(hostHash, false);
        Q().then(() => {
            if (! this.remoteServers) {
                this.remoteServers = {};
            }
            if (hostHash in this.remoteServers) {
                return;
            }
            $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");

            if (! this.remoteListsExists(hostHash)) {
                return Q().then(() => {
                    $hostElement.parent().append($("<div class='remote-sections' data-host-id='" + hostHash + "'></div>"));
                    $hostElement.parent().append($("<div class='remote-conversations' data-host-id='" + hostHash + "'></div>"));

                    let hostModel: HostEntryModel = {
                        host: host,
                        sectionsList: this.addComponent("remoteSectionsList-" + hostHash, new web.component.remotesectionlist.RemoteSectionListView(this, {
                            extList: {template: null}
                        })),
                        conv2List: this.addComponent("remoteConv2List-" + hostHash, new web.component.remoteconv2list.RemoteConv2ListView(this, {
                            personsView: this.personsComponent,
                            extList: {template: null}
                        }))
                    };

                    hostModel.sectionsList.sections.$container = $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']");
                    hostModel.conv2List.conversations.$container = $hostElement.parent().find(".remote-conversations[data-host-id='" + hostHash + "']");
                    
                    this.sidebar.remoteSectionLists[hostHash] = hostModel.sectionsList;
                    this.sidebar.remoteConv2Lists[hostHash] = hostModel.conv2List;
                    
                    hostModel.conv2List.conversations.$container.addClass("with-assigned-to-prefixes");
                    
                    this.remoteServers[hostHash] = hostModel;
                    return Q.all([
                        hostModel.sectionsList.triggerInit(),
                        hostModel.conv2List.triggerInit()
                    ])        
                })
            }
        })
        .then(() => {
            this.toggleRemoteHost(hostHash, true);
        })
    }
    
    toggleRemoteHost(hostHash: string, visible: boolean) {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']").toggleClass("hide", !visible);
        $hostElement.parent().find(".remote-conversations[data-host-id='" + hostHash + "']").toggleClass("hide", !visible);
        this.sidebar.hostList.toggleHostElementIsExpanded(hostHash, visible);
    }

    isRemoteHostVisible(hostHash: string): boolean {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        return ! $hostElement.find(".fa.expanded").hasClass("hide");
    }

    remoteListsExists(hostHash: string): boolean {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        let remoteSectionsExists = $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']").length > 0;
        return remoteSectionsExists;
    }
    
    getCalendarPanelKey(hostHash: string, projectId: string): string {
        return `${hostHash}--${projectId}`;
    }

}
