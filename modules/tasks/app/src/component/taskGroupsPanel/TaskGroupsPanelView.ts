import { component, window as wnd, JQuery as $, Q } from "pmc-web";
import { Model, ProjectModel, TaskGroupModel, TaskModel } from "./TaskGroupsPanelController";
import { func as mainTemplate } from "./template/main.html";
import { func as emptyTaskGroupTemplate } from "./template/taskgroup.html";
import { func as emptyEntryTemplate } from "./template/entry.html";
import { func as emptyTgBadgeTemplate } from "./template/tg-badge.html";
import { func as emptyTgIconTemplate } from "../../window/taskGroupForm/template/icon.html";
import { CustomTasksElements, Filter, TaskGroupIcon, TasksClipboardData } from "../../main/Types";
import { FastList, FastListEntry } from "../../main/FastList";
import { TasksSorter } from "../../main/TasksSorter";
import { Task, TaskStatus } from "../../main/data/Task";
import { TaskGroupsSorter } from "../../main/TaskGroupsSorter";
import { IconPickerData } from "../iconPicker/IconPickerData";
import { DragDrop } from "../../main/utils/DragDrop";
import { LazyRenderScheduler } from "./LazyRenderScheduler";

const enum MOVE_TG_DST {
    top = -999999,
    up = -1,
    down = 1,
    bottom = 999999,
}


interface EntryContext {
    taskGroupId: string;
    projectId: string;
    isFirstPinnedTg: boolean;
    isLastPinnedTg: boolean;
    isFirstNotPinnedTg: boolean;
    isLastNotPinnedTg: boolean;
}

interface EntryModel {
    task?: TaskModel;
    taskGroup?: TaskGroupModel;
    header?: boolean;
    kanbanHeader?: boolean;
    emptyTgInfo?: boolean;
    hiddenTasksInfo?: number;
    tasksByStatus?: { [status: string]: EntryModel };
    isLastTGRow?: boolean;
    
    computedName?: string;
    taskCache?: TaskEntryCache,
    context: EntryContext;
}

interface TaskEntryCache {
    modifiedCalendarDate: string;
    modifiedDateWithHourLocal: string;
    createdCalendarDate: string;
    createdDateWithHourLocal: string;
}

interface FastListSettings {
    sortBy: "hash-id";
    sortAsc: boolean;
    hTask: number;
    hTask2ndLine: number;
    hTaskNextLines: number;
    hTaskGroup: number;
    hHeader: number;
    hKanbanHeader: number;
    hEmptyTgInfo: number;
    hKanbanEmptyTgInfo: number;
    hHiddenTasksInfo: number;
    hKanbanEntryBox: number;
    hKanbanLastEntryBox: number;
}

interface TaskPointer {
    projectId: string;
    taskGroupId: string;
    taskId: string;
    entryId: number;
}

interface DropZone {
    fullTaskGroupId: string;
    dropZoneElement: HTMLElement;
    highlightElement: HTMLElement;
}

interface KanbanDropZone {
    fullTaskGroupId: string;
    status: TaskStatus;
    dropZoneElement: HTMLElement;
    highlightElement: HTMLElement;
}

export class TaskGroupsPanelView extends component.base.ComponentView {
    
    $container: JQuery;
    $settingsMenu: JQuery;
    $goToChat: JQuery;
    $goToNotes: JQuery;
    $goToCalendar: JQuery;
    $modeSwitch: JQuery;
    $kanbanModeSwitch: JQuery;
    $dropZoneHighlightsContainer: JQuery;
    
    parent: wnd.base.BaseWindowView<any>;
    isSummaryWindow: boolean = false;
    model: Model = null;
    isActive: boolean = false;
    order: number = 40;
    currSearchFilter: string;
    preventSort: boolean = false;
    taskSelectionLocked: boolean;
    onColResizerDocumentMouseUpBound: any = this.onColResizerDocumentMouseUp.bind(this);
    onColResizerDocumentMouseMoveBound: any = this.onColResizerDocumentMouseMove.bind(this);
    colResizerPos0: number;
    colResizerPos1: number;
    colResizerClient0: number;
    colResizerPosMin: number;
    colResizerPosMax: number;
    colResizerLeftCol: string;
    colResizerRightCol: string;
    $colResizerLeftCols: JQuery;
    $colResizerRightCols: JQuery;
    fastList: FastList<EntryModel>;
    
    projects: { [key: string]: ProjectModel } = {};
    taskGroups: { [key: string]: TaskGroupModel } = {};
    tasks: { [key: string]: TaskModel } = {};
    
    emptyEntryTemplate: HTMLElement = null;
    emptyTgBadgeTemplate: HTMLElement = null;
    emptyTgIconTemplates: { [key: string]: HTMLElement } = null;
    freeAvatars: { [user: string]: HTMLElement[] } = {};
    hasAvatarsToRender: boolean = false;
    
    customSelectFilter: component.customselect.CustomSelectView;
    // personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    taskTooltip: component.tasktooltip.TaskTooltipView;
    notifications: component.notification.NotificationView;
    
    fastListSettings: FastListSettings;
    collapsedTaskGroups: string[] = [];
    nVisibleCols = 8;
    selectedTasks: string[] = [];
    
    pointer: TaskPointer = { entryId: null, projectId: null, taskGroupId: null, taskId: null };
    hoverTaskGroup: string = null;
    visibleTaskGroupElements: { [fullId: string]: HTMLElement } = {};
    tasksLines: { [id: string]: number } = {};
    hasAssignedToColumn: boolean = true;
    hasCreatedColumn: boolean = true;
    hasModifiedColumn: boolean = true;
    prevTasksHeightRecalcAvailWidth: number = null;
    previewDirty: boolean = false;
    previewExit: Q.Deferred<void> = Q.defer();
    nowTimestamp: number = null;
    nowDMY: { day: number, month: number, year: number } = null;
    _onContainerWidthChangedTO: any = null;
    _onContainerHeightChangedTO: any = null;
    _statuses: string[] = [];
    dragDrop: DragDrop;
    currDropZones: DropZone[];
    dragDropCurrFullTaskGroupId: string;
    dragDropTaskFullIds: string[] = null;
    kanbanDragDrop: DragDrop;
    currKanbanDropZones: KanbanDropZone[];
    kanbanDragDropTaskFullIds: string[] = null;
    kanbanDragDropCurrColumnId: number;
    kanbanDragDropCurrFullTaskGroupId: string;
    dragDropContainerRect: { x: number, y: number, w: number, h: number } = null;
    scrollIntoViewInterval: number = null;
    scrollIntoViewSpeed: number = null;
    lazyRenderScheduler: LazyRenderScheduler = new LazyRenderScheduler({
        rescheduleDelay: 100,
        maxWaitingTime: 1000,
        renderCallback: () => { this.repaint() },
    });
    
    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView, personTooltipInitialized: boolean = false) {
        super(parent);
        // this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.parent.helper));
        this.personTooltip = personTooltipInitialized ? null : new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        this.taskTooltip = this.addComponent("tasktooltip", new component.tasktooltip.TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); };
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.customSelectFilter = this.addComponent("customSelectFilter", new component.customselect.CustomSelectView(this, {})).onChange(this.onFilterChange.bind(this));
        this._statuses = Task.getStatuses();
    }
    
    init(modelStr: string): any {
        this.isSummaryWindow = this.parent.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowView";
        if (this.isSummaryWindow && document.querySelectorAll(".window-sectionsummary.single-mode").length > 0) {
            this.isSummaryWindow = false;
        }
        let model: Model = JSON.parse(modelStr);
        this.setModel(model);
        
        this.$container.on("click", ".btn.settings", this.onSettingsButtonClick.bind(this));
        this.$container.on("click", ".context-menu-backdrop2", this.onSettingsMenuBackdropClick.bind(this));
        this.$container.on("change", "input[data-setting]", this.onSettingChanged.bind(this));
        this.$container.on("click", "button[data-setting]", this.onSettingChanged.bind(this));
        this.$container.on("click", "span.show-recently-modified[data-setting]", this.onSettingChanged.bind(this));
        this.$container.on("click", "span.kanban-mode[data-setting]", this.onSettingChanged.bind(this));
        this.$container.on("mousedown", "tr.entry-task, .kanban-task-box-content", this.onTaskMouseDown.bind(this));
        this.$container.on("mouseup", "tr.entry-task, .kanban-task-box-content", this.onTaskMouseUp.bind(this));
        this.$container.on("dblclick", "tr.entry-task, .kanban-task-box-content", this.onTaskDoubleClick.bind(this));
        this.$container.on("click", "[data-action=\"taskgroup-new\"]", this.onNewTaskGroupClick.bind(this));
        this.$container.on("click", "[data-action=\"taskgroup-edit\"]", this.onEditTaskGroupClick.bind(this));
        this.$container.on("click", "[data-action=\"taskgroup-paste\"]", this.onPasteIntoTaskGroupClick.bind(this));
        this.$container.on("click", "[data-action=\"task-new\"]", this.onNewTaskClick.bind(this));
        this.$container.on("click", "[data-action=\"task-delete-selected\"]", this.onDeleteTaskClick.bind(this));
        this.$container.on("click", "[data-action=\"task-restore-selected\"]", this.onRestoreTaskClick.bind(this));
        this.$container.on("click", "[data-action=\"taskgroup-toggle-collapsed-all\"]", this.onToggleCollapsedAllClick.bind(this));
        this.$container.on("click", "[data-action-id=\"item-new-task\"]", this.onNewTaskClick.bind(this));
        this.$container.on("click", "[data-action-id=\"item-new-taskgroup\"]", this.onNewTaskGroupClick.bind(this));
        this.$container.on("click", "[data-action=\"tg-move-to-top\"]", this.onTaskGroupMoveToTop.bind(this));
        this.$container.on("click", "[data-action=\"tg-move-up\"]", this.onTaskGroupMoveUp.bind(this));
        this.$container.on("click", "[data-action=\"tg-move-down\"]", this.onTaskGroupMoveDown.bind(this));
        this.$container.on("click", "[data-action=\"tg-move-to-bottom\"]", this.onTaskGroupMoveToBottom.bind(this));
        this.$container.on("click", ".pin-taskgroup", this.onPinTaskGroupClick.bind(this));
        this.$container.on("click", ".pin-task", this.onPinTaskClick.bind(this));
        this.$container.on("click", ".btn.refresh", this.onFullRefreshClick.bind(this));
        this.$container.on("click", "[data-action=\"mark-all-as-read\"]", this.onMarkAllAsReadClick.bind(this));
        this.$container.on("click", ".taskgroup-header", this.onTaskGroupHeaderClick.bind(this));
        this.$container.on("click", "th[data-sort-by], td[data-sort-by]", this.onTableHeaderClick.bind(this));
        this.$container.on("mousedown", ".col-resizer", this.onColResizerMouseDown.bind(this));
        this.$container.on("click", "[data-action=task-cut-selected]", this.onCutClick.bind(this));
        this.$container.on("click", "[data-action=task-copy-selected]", this.onCopyClick.bind(this));
        this.$container.on("click", "[data-action=task-paste-selected]", this.onPasteClick.bind(this));
        this.$container.on("click", "[data-action=task-move-selected]", this.onMoveClick.bind(this));
        this.$container.on("click", "[data-action=\"show-hidden-tasks\"]", this.onShowHiddenTasksClick.bind(this));
        this.$container.on("keydown", this.onKeyDown.bind(this));
        this.$container.on("mouseenter", "li.badge-default", this.onTgBadgeMouseEnter.bind(this));
        this.$container.on("mouseleave", ".task-taskgroups-badges", this.onTgBadgeMouseLeave.bind(this));
        this.$container.on("mouseover", ".entry", this.onEntryMouseOver.bind(this));
        this.$container.on("mouseout", ".entry", this.onEntryMouseOut.bind(this));
        
        this.$dropZoneHighlightsContainer = this.$container.find(".dropzone-higlights-container");
        this.initDragDrop();
        this.initKanbanDragDrop();
        
        if ((<any>window).ResizeObserver) {
            let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                let w = entries[0].contentRect.width;
                this.onSizeChanged(w);
            });
            resizeObserver.observe(this.$container[0]);
        }
        
        // this.personsComponent.$main = this.$container;
        if (this.personTooltip) {
            this.personTooltip.init(this.$container);
        }
        this.taskTooltip.$container = this.$container;
        this.notifications.$container = this.$container.find(".notifications-container-wrapper");
        return <any>Q.all([
            // this.personsComponent.triggerInit(),
            this.taskTooltip.triggerInit(),
            this.notifications.triggerInit(),
            this.customSelectFilter.triggerInit(),
        ]).then(() => {
            this.hasAvatarsToRender = false;
            this.personsComponent.refreshAvatars();
        });
    }
    
    setModel(model: Model) {
        this.model = model;
        if (model) {
            this.fastListSettings = {
                sortBy: "hash-id",
                sortAsc: false,
                hTask: 27,
                hTask2ndLine: 16,
                hTaskNextLines: 18,
                hTaskGroup: 40,
                hHeader: 21,
                hKanbanHeader: 21,
                hEmptyTgInfo: 43,
                hKanbanEmptyTgInfo: 43 + 40,
                hHiddenTasksInfo: 43,
                hKanbanEntryBox: 68,
                hKanbanLastEntryBox: 68 + 40,
            };
            this.collapsedTaskGroups = JSON.parse(<string>this.model.settings["collapsed-taskgroups"]);
            this.updateColumnsVisibilityInfo();
        }
        this.render();
    }
    
    setData(modelStr: string): void {
        this.setModel(JSON.parse(modelStr));
    }
    
    debug(msg: string): void {
        if (!this.model) {
            console.warn("no model", performance.now(), msg);
        }
        else if (this.model.debug) {
            console.log(this.model.projectName, performance.now(), msg);
        }
    }
    
    getIconId(icon: TaskGroupIcon) {
        return icon.type + "--" + (icon.type == "fa" ? icon.fa : icon.shape);
    }
    
    isContainerReady(): boolean {
        return this.$container && this.$container.hasClass("active");
    }
    
    repaintWhenReady(): Q.Promise<void> {
        let deferred = Q.defer<void>();
        if (this.isContainerReady()) {
            this.repaint();
            deferred.resolve();
        }
        else {
            setTimeout(() => {
                this.repaintWhenReady().then(deferred.resolve, deferred.reject);
            }, 100);
        }
        return deferred.promise;
    }
    
    render(): void {
        let $oldNotifCont = this.$container.find(".notifications-container-wrapper");
        let $oldDZHCont = this.$container.find(".dropzone-higlights-container");
        let $oldTTComponent = this.$container.find(".tooltip-component");
        this.$container.empty();
        if (this.model) {
            let tpl = this.templateManager.createTemplate(emptyTgIconTemplate);
            this.emptyTgIconTemplates = {};
            for (let iconStr of IconPickerData.items) {
                if (!iconStr) {
                    continue;
                }
                let icon: TaskGroupIcon = JSON.parse(iconStr);
                this.emptyTgIconTemplates[this.getIconId(icon)] = tpl.renderToJQ(iconStr)[0];
            }
            
            this.emptyTgBadgeTemplate = this.templateManager.createTemplate(emptyTgBadgeTemplate).renderToJQ()[0];
            let emptyTaskGroupTpl = this.templateManager.createTemplate(emptyTaskGroupTemplate);
            this.emptyEntryTemplate = this.templateManager.createTemplate(emptyEntryTemplate).renderToJQ(this.model.emptyTaskGroupModel, emptyTaskGroupTpl)[0];
            this.removeTextNodes(this.emptyEntryTemplate);
            let convTemplate = this.templateManager.createTemplate(component.template.conversation);
            this.$container.append(this.templateManager.createTemplate(mainTemplate).renderToJQ(this.model, convTemplate));
            this.setColWidths(this.model.colWidths);
            this.$goToChat = this.$container.find(".go-to-chat");
            this.$goToNotes = this.$container.find(".go-to-notes");
            this.$goToCalendar = this.$container.find(".go-to-calendar");
            this.$modeSwitch = this.$container.find("[data-setting=\"show-recently-modified\"]").children(".fa");
            this.$kanbanModeSwitch = this.$container.find("[data-setting=\"kanban-mode\"]").children(".fa");
            this.$goToChat.toggleClass("hidden", !this.model.otherPluginsAvailability.chat);
            this.$goToNotes.toggleClass("hidden", !this.model.otherPluginsAvailability.notes);
            this.$goToCalendar.toggleClass("hidden", !this.model.otherPluginsAvailability.calendar);
            this.hasAvatarsToRender = false;
            this.personsComponent.refreshAvatars();
            this.customSelectFilter.setContainer(this.$container.find(".filter-container"));
            
            if ($oldNotifCont.length > 0) {
                this.$container.find(".notifications-container-wrapper").replaceWith($oldNotifCont);
            }
            if ($oldDZHCont.length > 0) {
                this.$container.find(".dropzone-higlights-container").replaceWith($oldDZHCont);
            }
            if ($oldTTComponent.length > 0) {
                this.$container.append($oldTTComponent);
            }
            
            this.$settingsMenu = this.$container.find(".context-menu-settings");
            this.updateClasses();
            this.updateSettingsMenu();
            
            let container = this.$container.find(".fl-container")[0];
            (<any>$(container)).pfScroll();
            container = <HTMLElement>container.childNodes[0];
            let paddingContainer = this.$container.find(".fl-padding-container")[0];
            let entriesContainer = this.$container.find(".fl-entries-container")[0];
            this.fastList = new FastList(container, paddingContainer, entriesContainer);
            this.fastList.debug = this.debug.bind(this);
            this.fastList.setEmptyElementCreator(this.createFastListEmptyElement.bind(this));
            this.fastList.setElementFiller(this.fillFastListElement.bind(this));
            this.fastList.setBeforeRender(this.beforeFastListRender.bind(this));
            this.fastList.setAfterRender(this.afterFastListRender.bind(this));
            this.fastList.setBeforeDelElement(this.beforeFastListDeleteElement.bind(this));
            Q().then(() => {
                return this.updateTaskHeights(null, false);
            }).then(() => {
                this.updateFastListEntries();
                this.fastList.init(this.isContainerReady());
            });
        }
        else {
            this.$container.html("<div class=\"notifications-container-wrapper\"></div><div class=\"dropzone-higlights-container\"></div>");
        }
    }
    
    repaint(): void {
        this.debug("starting repaint()");
        if (!this.model) {
            this.debug("repaint() error: no model present");
            return;
        }
        try {
            this.updateClasses();
            this.updateFastListEntries();
            this.renderFastList();
            this.debug("finished repaint()");
        }
        catch (e) {
            this.debug("repaint() error: " + e);
            console.error(e);
        }
    }
    
    showsFixedSection(): boolean {
        return this.model.isAllTasks || this.model.isTasksAssignedToMe || this.model.isTasksCreatedByMe || this.model.isTrash;
    }
    
    isInRecentlyModifiedMode(): boolean {
        return <boolean>this.getSetting("show-recently-modified");
    }
    
    isInKanbanMode(): boolean {
        return <boolean>this.getSetting("kanban-mode");
    }
    
    getHideDone(): boolean {
        return this.getSetting(this.isKanban() ? "kanban-filter" : "filter") == Filter.onlyNotDone;
    }
    
    getShowOrphans(): boolean {
        return <boolean>this.getSetting("show-orphans");
    }
    
    getSetting(name: string): boolean|string {
        return this.model.settings[name];
    }
    
    setSetting(name: string, value: boolean): void {
        this.model.settings[name] = value;
    }
    
    settingChanged(setting: string, value: boolean|string, dispatchEvent: boolean = true): void {
        if (!this.model || !this.model.projectId) {
            return;
        }
        
        this.triggerEvent("settingChanged", setting, value, dispatchEvent);
        
        if (this.model && this.model.settings) {
            this.model.settings[setting] = value;
            if (setting.substr(0, 5) == "show-" && setting.substr(setting.length - 7, 7) == "-column") {
                this.updateColumnsVisibilityInfo();
                this.updateTaskHeights(null, false).then(() => {
                    this.repaint();
                });
            }
            else {
                this.repaint();
            }
            this.updateSettingsMenu();
        }
    }
    
    updateColumnsVisibilityInfo() {
        this.hasAssignedToColumn = this.model.settings["show-assigned-to-column"] ? true : false;
        this.hasCreatedColumn = this.model.settings["show-created-column"] ? true : false;
        this.hasModifiedColumn = this.model.settings["show-modified-column"] ? true : false;
    }
    
    updateSettingsMenu(): void {
        let safeId = this.model.uniqueSafeId;
        for (let k in this.model.settings) {
            this.$container.find("#tasks-settings-" + k + "-" + safeId).prop("checked", this.getSetting(k));
        }
        
        let rmm = this.isInRecentlyModifiedMode();
        this.$container.find("#tasks-settings-show-recently-modified" + "-" + safeId)
            .data("checked", rmm)
            .children(".fa")
                .toggleClass("fa-list-alt", rmm)
                .toggleClass("fa-th-list", !rmm)
                .end()
            .attr("title", this.parent.i18n("plugin.tasks.component.taskGroupsPanel.viewMode" + (rmm?"MultipleLists":"SingleList")));
            
        let km = this.isInKanbanMode();
        this.$container.find("#tasks-settings-kanban-mode" + "-" + safeId)
            .data("checked", km)
            .toggleClass("kanban-on", km)
            .toggleClass("kanban-off", !km)
            .attr("title", this.parent.i18n("plugin.tasks.component.taskGroupsPanel." + (km?"normalMode":"kanbanMode")));
        
        
        let kanbanDisabledSettings = [
            "show-task-column",
            "show-status-column",
            "show-attachments-column",
            "show-created-column",
        ];
        if (!this.isKanban()) {
            kanbanDisabledSettings = [];
        }
        let isParentEnabled = true;
        let $items =  this.$container.find(".context-menu-content").children("li");
        for (let i = 0; i < $items.length; ++i) {
            let $li = $items.eq(i);
            if ($li.is(".subitem")) {
                let isDisabled = !isParentEnabled || kanbanDisabledSettings.indexOf($li.find("input").data("setting")) >= 0;
                $li.toggleClass("disabled", isDisabled);
                $li.find("input").prop("disabled", isDisabled);
            }
            else {
                isParentEnabled = $li.find("input").is(":checked");
                let isDisabled = false;
                if (this.isKanban()) {
                    let setting = $li.find("input").data("setting");
                    isDisabled = kanbanDisabledSettings.indexOf(setting) >= 0;
                    isParentEnabled = isParentEnabled && !isDisabled;
                }
                $li.toggleClass("disabled", isDisabled);
                $li.find("input").prop("disabled", isDisabled);
            }
        }
    }
    
    updateClasses() {
        if (!this.model) {
            return;
        }
        this.$container.toggleClass("combines-multiple-sections", this.model.combinesMultipleSections);
        
        let recentlyModifiedMode = this.model.settings["show-recently-modified"];
        this.$container.toggleClass("mode-default", !recentlyModifiedMode);
        this.$container.toggleClass("mode-recently-modified", !!recentlyModifiedMode);
        this.$modeSwitch.toggleClass("fa-th-list", !recentlyModifiedMode);
        this.$modeSwitch.toggleClass("fa-list-alt", !!recentlyModifiedMode);
        
        let kanbanMode = this.model.settings["kanban-mode"];
        this.$container.toggleClass("not-kanban-mode", !kanbanMode);
        this.$container.toggleClass("kanban-mode", !!kanbanMode);
        this.$kanbanModeSwitch.toggleClass("fa-th", !kanbanMode);
        this.$kanbanModeSwitch.toggleClass("fa-align-justify", !!kanbanMode);
        
        let showHeaderPerList = this.model.settings["show-header-per-list"];
        this.$container.toggleClass("single-header", !showHeaderPerList);
        
        let allCollapsed = this.areAllCollapsed();
        this.$container.toggleClass("all-collapsed", allCollapsed);
        
        let sortBy = this.fastListSettings.sortBy;
        let sortAsc = this.fastListSettings.sortAsc;
        let $headers = this.$container.find(".floating-single-header").find("th");
        $headers.removeClass("sorted-asc").removeClass("sorted-desc");
        $headers.filter("[data-sort-by='" + sortBy + "']").addClass("sorted-" + (sortAsc ? "asc" : "desc"));
        
        let hideDone = this.model.settings[this.isKanban() ? "kanban-filter" : "filter"] == Filter.onlyNotDone;
        this.$container.toggleClass("hide-done", !!hideDone);
        
        let hideListProgress = !this.model.settings["show-list-progress"];
        this.$container.toggleClass("hide-list-progress", hideListProgress);
        
        let hideTaskNumbers = !this.model.settings["show-task-numbers"];
        this.$container.toggleClass("hide-task-numbers", hideTaskNumbers);
        
        let showFullTaskDescriptions = !!this.model.settings["show-full-task-descriptions"];
        this.$container.toggleClass("show-full-task-descriptions", showFullTaskDescriptions);
        this.$container.toggleClass("hide-full-task-descriptions", !showFullTaskDescriptions);
        
        let showAllOtherListNames = !!this.model.settings["show-all-other-list-names"];
        this.$container.toggleClass("show-all-other-list-names", showAllOtherListNames);
        this.$container.toggleClass("dont-show-all-other-list-names", !showAllOtherListNames);
        
        let showOnlyUnread = this.model.settings[this.isKanban() ? "kanban-filter" : "filter"] == Filter.onlyUnread;
        this.$container.toggleClass("show-only-unread", showOnlyUnread);
        
        let textsWithStatusColor = !!this.model.settings["texts-with-status-color"];
        this.$container.toggleClass("texts-with-status-color", textsWithStatusColor);
        this.$container.toggleClass("no-texts-with-status-color", !textsWithStatusColor);
        
        let narrowIssueRows = !!this.model.settings["narrow-issue-rows"];
        this.$container.toggleClass("narrow-issue-rows", narrowIssueRows);
        this.$container.toggleClass("no-narrow-issue-rows", !narrowIssueRows);
        
        let cols = [
            "hash-id",
            "task",
            "status",
            "assigned-to",
            "attachments",
            "created",
            "modified",
        ];
        this.nVisibleCols = 1;
        let prevSthVisible = false;
        for (let col of cols) {
            let visible = !!this.model.settings["show-" + col + "-column"];
            this.$container.toggleClass("no-" + col, !visible);
            this.$container.toggleClass("no-" + col + "-resizer", !prevSthVisible);
            if (visible) {
                this.nVisibleCols++;
                prevSthVisible = true;
            }
        }
        
        this.$container.toggleClass("no-task-in-clipboard", this.isClipboardEmpty());
        this.$container.toggleClass("no-task-selected", this.selectedTasks.length == 0);
        this.$container.toggleClass("no-taskgroups", Object.keys(this.model.taskGroups).length == 1);
        this.$container.toggleClass("no-creating-new-tasks", !this.model.canCreateNewTasks);
    }
    
    areAllCollapsed(): boolean {
        for (let tgId in this.model.taskGroups) {
            if (!this.model.taskGroups[tgId].isCollapsed) {
                return false;
            }
        }
        return true;
    }
    
    setPreviewDirty(dirty: boolean): void {
        this.previewDirty = dirty;
    }
    
    
    
    
    
    /****************************************
    *************** DragDrop ****************
    *****************************************/
    initKanbanDragDrop(): void {
        this.kanbanDragDrop = new DragDrop(this.$container, "td.for-kanban-tasks.with-task", ".kanban-dropzone");
        this.kanbanDragDrop.bringToTop = true;
        this.kanbanDragDrop.setOnDragStart(($draggable, e) => {
            if (e.ctrlKey || e.metaKey) {
                let el = <HTMLElement>e.currentTarget;
                if (!(<HTMLElement>el.childNodes[0]).classList.contains("selected")) {
                    this.onTaskMouseDown(e);
                }
            }
            this.currKanbanDropZones = [];
            this.kanbanDragDropCurrColumnId = null;
            this.kanbanDragDropCurrFullTaskGroupId = null;
            this.scrollIntoViewSpeed = 0;
            this.scrollIntoViewInterval = <any>setInterval(this.scrollIntoViewStep.bind(this), 1000.0 / 60.0);
            this.cacheDragDropContainerRect();
            let taskFullId = $draggable.children(".kanban-task-box-content").attr("data-task-full-id");
            let [currProjectId, currTaskGroupId, currTaskId] = taskFullId.split("/");
            let fullTaskIds = [currProjectId + "/" + currTaskGroupId + "/" + currTaskId];
            for (let el of this.selectedTasks) {
                if (fullTaskIds.indexOf(el) < 0) {
                    fullTaskIds.push(el);
                }
            }
            this.kanbanDragDropTaskFullIds = fullTaskIds;
            let entries: FastListEntry<EntryModel>[] = [];
            for (let entry of this.fastList.entries) {
                if (entry.data && entry.data.tasksByStatus) {
                    for (let status in entry.data.tasksByStatus) {
                        let t = entry.data.tasksByStatus[status];
                        if (t) {
                            let fullId = t.context.projectId + "/" + t.context.taskGroupId + "/" + t.task.id;
                            if (fullTaskIds.indexOf(fullId) >= 0 && entries.indexOf(entry) < 0) {
                                entries.push(entry);
                            }
                        }
                    }
                }
            }
            
            entries = JSON.parse(JSON.stringify(entries));
            let tasksByStatus: { [status: string]: { context: EntryContext, task: TaskModel}[] } = {};
            for (let entry of entries) {
                for (let status in entry.data.tasksByStatus) {
                    let tbs = entry.data.tasksByStatus[status];
                    if (!(status in tasksByStatus)) {
                        tasksByStatus[status] = [];
                    }
                    if (tbs) {
                        let fullTaskId = tbs.context.projectId + "/" + tbs.context.taskGroupId + "/" + tbs.task.id;
                        if (fullTaskIds.indexOf(fullTaskId) >= 0) {
                            tasksByStatus[status].push({
                                context: tbs.context,
                                task: tbs.task,
                            });
                        }
                    }
                }
            }
            
            let maxN = 0;
            for (let status in tasksByStatus) {
                maxN = Math.max(maxN, tasksByStatus[status].length);
            }
            
            let newEntries: FastListEntry<EntryModel>[] = [];
            for (let i = 0; i < maxN; ++i) {
                let _tasksByStatus: { [status: string]: { context: EntryContext, task: TaskModel } } = {};
                for (let status in tasksByStatus) {
                    let task = tasksByStatus[status][i];
                    if (task) {
                        _tasksByStatus[status] = task;
                    }
                }
                
                newEntries.push({
                    data: {
                        context: null,
                        tasksByStatus: _tasksByStatus,
                    },
                    height: this.fastListSettings.hKanbanEntryBox,
                    startsAt: 0,
                });
            }
            entries = newEntries;
            
            let w = $(this.fastList.entriesContainer).find("td.for-kanban-tasks.with-task").outerWidth();
            let $el = $("<tbody class='fl-entries-container ghost-image'></tbody>");
            for (let entry of entries) {
                let el = this.createFastListEmptyElement();
                this.fillFastListElement(el, entry);
                (<any>el.querySelectorAll("td.for-kanban-tasks.with-task")).forEach((el: HTMLElement) => {
                    (<HTMLElement>el.childNodes[0]).classList.add("selected");
                    el.style.width = w + "px";
                });
                el.classList.remove("last-row-in-tg");
                el.style.height = this.fastListSettings.hKanbanEntryBox + "px";
                $el.append(el);
            }
            $(this.fastList.entriesContainer).parent().append($el);
            e.dataTransfer.setDragImage($el[0], 0, 0);
            this.personsComponent.refreshAvatars();
            Q().then(() => {
                $el.remove();
            });
        });
        this.kanbanDragDrop.setOnDragCancel(($draggable) => {
            clearInterval(this.scrollIntoViewInterval);
            this.scrollIntoViewInterval = null;
            this.scrollIntoViewSpeed = 0;
            this.clearDragDropHighlights();
            this.kanbanDragDropCurrColumnId = null;
            this.kanbanDragDropCurrFullTaskGroupId = null;
        });
        this.kanbanDragDrop.setOnDragDrop(($draggable, $dropZone) => {
            clearInterval(this.scrollIntoViewInterval);
            this.scrollIntoViewInterval = null;
            this.scrollIntoViewSpeed = 0;
            let newStatus: TaskStatus = null;
            let newProjectId: string = null;
            let newTaskGroupId: string = null;
            if (this.kanbanDragDropCurrColumnId !== null) {
                newStatus = this.getTaskStatusFromNumId(this.kanbanDragDropCurrColumnId);
            }
            if (this.kanbanDragDropCurrFullTaskGroupId !== null) {
                [newProjectId, newTaskGroupId] = this.kanbanDragDropCurrFullTaskGroupId.split("/");
            }
            let fullTaskIds = this.kanbanDragDropTaskFullIds;
            this.triggerEvent("dropTasks", fullTaskIds, newStatus, newProjectId, newTaskGroupId);
            this.clearDragDropHighlights();
            this.kanbanDragDropCurrColumnId = null;
            this.kanbanDragDropCurrFullTaskGroupId = null;
        });
        this.kanbanDragDrop.setOnDragEnterZone(($draggable, $dropZone) => {
            let highlighted = false;
            for (let dropZone of this.currKanbanDropZones) {
                if (dropZone.dropZoneElement == $dropZone[0]) {
                    highlighted = true;
                    break;
                }
            }
            if (!highlighted) {
                let dropZone: KanbanDropZone = {
                    fullTaskGroupId: $dropZone[0].getAttribute("data-kanban-dropzone-taskgroup-full-id"),
                    status: <TaskStatus>$dropZone[0].getAttribute("data-kanban-dropzone-status"),
                    dropZoneElement: $dropZone[0],
                    highlightElement: null,
                };
                this.currKanbanDropZones.push(dropZone);
                this.highlightKanbanDropZone(dropZone);
            }
        });
        this.kanbanDragDrop.setOnDragLeaveZone(($draggable, $dropZone) => {
            let idx = -1;
            for (let index in this.currKanbanDropZones) {
                let dropZone = this.currKanbanDropZones[index];
                if (dropZone.dropZoneElement == $dropZone[0]) {
                    idx = Number(index);
                    break;
                }
            }
            if (idx >= 0) {
                if (this.currKanbanDropZones.length <= 1) {
                    this.removeKanbanDropZoneHighlight(this.currKanbanDropZones[idx]);
                }
                this.currKanbanDropZones.splice(idx, 1);
            }
        });
        this.kanbanDragDrop.setOnMouseMove(data => {
            this.tryScrollWhileDragging(data.currY);
            if (!this.currKanbanDropZones || this.currKanbanDropZones.length != 1) {
                return;
            }
            let dropZone = this.currKanbanDropZones[0];
            if (dropZone.status === null) {
                let contW = this.kanbanDragDrop.containerWidth;
                let prevCol = Math.floor(this.getCurrentNVisibleCols() * data.prevX / contW);
                let currCol = Math.floor(this.getCurrentNVisibleCols() * data.currX / contW);
                if (prevCol != currCol) {
                    this.highlightKanbanDropZone(dropZone);
                }
            }
        });
    }
    
    clearDragDropHighlights(): void {
        this.currKanbanDropZones = [];
        this.$dropZoneHighlightsContainer.html("");
    }
    
    highlightKanbanDropZone(dropZone: KanbanDropZone): void {
        let $dropZoneHighlights = this.$dropZoneHighlightsContainer.children();
        let newElement = $dropZoneHighlights.length == 0;
        let $highlight = newElement ? $("<div></div>") : $dropZoneHighlights.eq(0);
        
        let contW = this.$dropZoneHighlightsContainer.width();
        let columnWidth = contW / this.getCurrentNVisibleCols();
        let columnId = dropZone.status === null ? Math.floor(this.getCurrentNVisibleCols() * this.kanbanDragDrop.mouseX / contW) : this.getTaskStatusNumId(dropZone.status);
        this.kanbanDragDropCurrColumnId = columnId;
        this.kanbanDragDropCurrFullTaskGroupId = null;
        
        let x: number = columnWidth * columnId;
        let y: number = 0;
        let w: number = columnWidth;
        let h: number = 0;
        if (this.model.settings["show-recently-modified"]) {
            y = 0;
            h = this.$dropZoneHighlightsContainer.height();
        }
        else {
            let $tr = $(dropZone.dropZoneElement).closest("tr.entry");
            let y1: number = 0;
            let y2: number = this.$dropZoneHighlightsContainer.height();
            let offsetTop = parseInt(this.$dropZoneHighlightsContainer.css("top"));
            
            let $tgStart = null;
            let $prev = $tr;
            while ($prev.length > 0) {
                if ($prev.hasClass("entry-taskgroup")) {
                    $tgStart = $prev;
                    break;
                }
                $prev = $prev.prev();
            }
            if ($tgStart != null && $tgStart.length > 0) {
                if ($tgStart[0] == $tr[0]) {
                    y1 = $tgStart.offset().top - offsetTop;
                }
                else {
                    y1 = $tgStart.offset().top - offsetTop;
                }
            }
            
            let $tgEnd = null;
            let $next = $tr.next();
            while ($next.length > 0) {
                if ($next.hasClass("entry-taskgroup")) {
                    $tgEnd = $next;
                    break;
                }
                $next = $next.next();
            }
            if ($tgEnd != null && $tgEnd.length > 0) {
                y2 = $tgEnd.offset().top - offsetTop;
            }
            
            y = y1;
            h = y2 - y1;
            
            let tg: TaskGroupModel = null;
            let entryId = parseInt($tr[0].dataset.entryId);
            while (entryId >= 0) {
                let entry = this.fastList.entries[entryId];
                if (entry.data.taskGroup) {
                    tg = entry.data.taskGroup;
                    break;
                }
                entryId--;
            }
            if (tg) {
                this.kanbanDragDropCurrFullTaskGroupId = tg.projectId + "/" + tg.id;
            }
        }
        let cssObj = {
            left: x,
            top: y,
            width: w,
            height: h,
        };
        if (newElement) {
            $highlight.css({
                left: x + w / 2,
                top: y + h / 2,
                width: 0,
                height: 0,
            });
        }
        else {
            $highlight.css(cssObj);
        }
        
        dropZone.highlightElement = $highlight[0];
        dropZone.highlightElement.style.visibility = "visible";
        if (newElement) {
            this.$dropZoneHighlightsContainer.append($highlight);
            Q().then(() => {
                $highlight.css(cssObj);
            });
        }
    }
    
    removeKanbanDropZoneHighlight(dropZone: KanbanDropZone): void {
        dropZone.highlightElement.style.visibility = "hidden";
    }
    
    getTaskStatusNumId(status: TaskStatus): number {
        if (status == TaskStatus.IDEA) {
            return 0;
        }
        if (status == TaskStatus.TODO) {
            return 1;
        }
        if (status == TaskStatus.INPROGRESS) {
            return 2;
        }
        if (status == TaskStatus.DONE) {
            return 3;
        }
        return 0;
    }
    
    getTaskStatusFromNumId(numId: number): TaskStatus {
        if (numId == 0) {
            return TaskStatus.IDEA;
        }
        if (numId == 1) {
            return TaskStatus.TODO;
        }
        if (numId == 2) {
            return TaskStatus.INPROGRESS;
        }
        if (numId == 3) {
            return TaskStatus.DONE;
        }
        return TaskStatus.UNKNOWN;
    }
    
    initDragDrop(): void {
        this.dragDrop = new DragDrop(this.$container, "tr.entry-task", ".dropzone");
        this.dragDrop.setOnDragStart(($draggable, e) => {
            if (e.ctrlKey || e.metaKey) {
                let el = <HTMLElement>e.currentTarget;
                if (!el.classList.contains("selected")) {
                    this.onTaskMouseDown(e);
                }
            }
            this.currDropZones = [];
            this.dragDropCurrFullTaskGroupId = null;
            this.scrollIntoViewSpeed = 0;
            this.scrollIntoViewInterval = <any>setInterval(this.scrollIntoViewStep.bind(this), 1000.0 / 60.0);
            this.cacheDragDropContainerRect();
            let entry = this.getEntry($draggable[0]);
            let fullTaskIds = [entry.data.context.projectId + "/" + entry.data.context.taskGroupId + "/" + entry.data.task.id];
            for (let el of this.selectedTasks) {
                if (fullTaskIds.indexOf(el) < 0) {
                    fullTaskIds.push(el);
                }
            }
            this.dragDropTaskFullIds = fullTaskIds;
            let entries: FastListEntry<EntryModel>[] = [];
            for (let entry of this.fastList.entries) {
                if (entry.data && entry.data.task) {
                    let fullId = entry.data.context.projectId + "/" + entry.data.context.taskGroupId + "/" + entry.data.task.id;
                    if (fullTaskIds.indexOf(fullId) >= 0) {
                        entries.push(entry);
                    }
                }
            }
            let $el = $("<tbody class='fl-entries-container ghost-image'></tbody>");
            let ws: { [cls: string]: number } = {};
            $(this.fastList.entriesContainer).children("tr.entry.entry-task").first().children(".for-task").each((_, el) => {
                let cls = null;
                for (let i in el.classList) {
                    if (el.classList[i].substr(0, 5) == "task-") {
                        cls = el.classList[i];
                        break;
                    }
                }
                if (cls) {
                    ws[cls] = $(el).outerWidth();
                }
            }).outerWidth();
            for (let entry of entries) {
                let el = this.createFastListEmptyElement();
                this.fillFastListElement(el, entry);
                el.classList.add("selected");
                for (let cls in ws) {
                    let st = (<HTMLElement>el.querySelector(".for-task." + cls)).style;
                    st.width = ws[cls] + "px";
                    st.minWidth = ws[cls] + "px";
                    st.maxWidth = ws[cls] + "px";
                }
                $el.append(el);
            }
            $(this.fastList.entriesContainer).parent().append($el);
            e.dataTransfer.setDragImage($el[0], 0, 0);
            this.personsComponent.refreshAvatars();
            Q().then(() => {
                $el.remove();
            });
        });
        this.dragDrop.setOnDragCancel(($draggable) => {
            clearInterval(this.scrollIntoViewInterval);
            this.scrollIntoViewInterval = null;
            this.scrollIntoViewSpeed = 0;
            this.clearDragDropHighlights();
            this.dragDropCurrFullTaskGroupId = null;
        });
        this.dragDrop.setOnDragDrop(($draggable, $dropZone) => {
            clearInterval(this.scrollIntoViewInterval);
            this.scrollIntoViewInterval = null;
            this.scrollIntoViewSpeed = 0;
            let newProjectId: string = null;
            let newTaskGroupId: string = null;
            if (this.dragDropCurrFullTaskGroupId !== null) {
                [newProjectId, newTaskGroupId] = this.dragDropCurrFullTaskGroupId.split("/");
            }
            let fullTaskIds = this.dragDropTaskFullIds;
            this.triggerEvent("dropTasks", fullTaskIds, null, newProjectId, newTaskGroupId);
            this.clearDragDropHighlights();
            this.dragDropCurrFullTaskGroupId = null;
        });
        this.dragDrop.setOnDragEnterZone(($draggable, $dropZone) => {
            let highlighted = false;
            for (let dropZone of this.currDropZones) {
                if (dropZone.dropZoneElement == $dropZone[0]) {
                    highlighted = true;
                    break;
                }
            }
            if (!highlighted) {
                let dropZone: DropZone = {
                    fullTaskGroupId: $dropZone[0].getAttribute("data-dropzone-taskgroup-full-id"),
                    dropZoneElement: $dropZone[0],
                    highlightElement: null,
                };
                this.currDropZones.push(dropZone);
                this.highlightDropZone(dropZone);
            }
        });
        this.dragDrop.setOnDragLeaveZone(($draggable, $dropZone) => {
            let idx = -1;
            for (let index in this.currDropZones) {
                let dropZone = this.currDropZones[index];
                if (dropZone.dropZoneElement == $dropZone[0]) {
                    idx = Number(index);
                    break;
                }
            }
            if (idx >= 0) {
                if (this.currDropZones.length <= 1) {
                    this.removeDropZoneHighlight(this.currDropZones[idx]);
                }
                this.currDropZones.splice(idx, 1);
            }
        });
        this.dragDrop.setOnMouseMove(data => {
            this.tryScrollWhileDragging(data.currY);
        });
    }
    
    highlightDropZone(dropZone: DropZone): void {
        let $dropZoneHighlights = this.$dropZoneHighlightsContainer.children();
        let newElement = $dropZoneHighlights.length == 0;
        let $highlight = newElement ? $("<div></div>") : $dropZoneHighlights.eq(0);
        
        let x: number = 0;
        let y: number = 0;
        let w: number = this.$dropZoneHighlightsContainer.width();
        let h: number = 0;
        if (this.model.settings["show-recently-modified"]) {
            y = 0;
            h = this.$dropZoneHighlightsContainer.height();
        }
        else {
            let $tr = $(dropZone.dropZoneElement).closest("tr.entry");
            let y1: number = 0;
            let y2: number = this.$dropZoneHighlightsContainer.height();
            let offsetTop = parseInt(this.$dropZoneHighlightsContainer.css("top"));
            
            let $tgStart = null;
            let $prev = $tr;
            while ($prev.length > 0) {
                if ($prev.hasClass("entry-taskgroup")) {
                    $tgStart = $prev;
                    break;
                }
                $prev = $prev.prev();
            }
            if ($tgStart != null && $tgStart.length > 0) {
                if ($tgStart[0] == $tr[0]) {
                    y1 = $tgStart.offset().top - offsetTop;
                }
                else {
                    y1 = $tgStart.offset().top - offsetTop;
                }
            }
            
            let $tgEnd = null;
            let $next = $tr.next();
            while ($next.length > 0) {
                if ($next.hasClass("entry-taskgroup")) {
                    $tgEnd = $next;
                    break;
                }
                $next = $next.next();
            }
            if ($tgEnd != null && $tgEnd.length > 0) {
                y2 = $tgEnd.offset().top - offsetTop;
            }
            
            y = y1;
            h = y2 - y1;
            
            let tg: TaskGroupModel = null;
            let entryId = parseInt($tr[0].dataset.entryId);
            while (entryId >= 0) {
                let entry = this.fastList.entries[entryId];
                if (entry.data.taskGroup) {
                    tg = entry.data.taskGroup;
                    break;
                }
                entryId--;
            }
            if (tg) {
                this.dragDropCurrFullTaskGroupId = tg.projectId + "/" + tg.id;
            }
        }
        
        let cssObj = {
            left: x,
            top: y,
            width: w,
            height: h,
        };
        if (newElement) {
            $highlight.css({
                left: x + w / 2,
                top: y + h / 2,
                width: 0,
                height: 0,
            });
        }
        else {
            $highlight.css(cssObj);
        }
        
        dropZone.highlightElement = $highlight[0];
        dropZone.highlightElement.style.visibility = "visible";
        if (newElement) {
            this.$dropZoneHighlightsContainer.append($highlight);
            Q().then(() => {
                $highlight.css(cssObj);
            });
        }
    }
    
    removeDropZoneHighlight(dropZone: DropZone): void {
        dropZone.highlightElement.style.visibility = "hidden";
    }
    
    cacheDragDropContainerRect(): void {
        let offset = $(this.fastList.container).offset();
        this.dragDropContainerRect = {
            x: offset.left,
            y: offset.top,
            w: $(this.fastList.container).width(),
            h: $(this.fastList.container).height(),
        };
    }
    
    tryScrollWhileDragging(mouseY: number): void {
        let yTop = mouseY - this.dragDropContainerRect.y;
        let yBtm = this.dragDropContainerRect.h - (mouseY - this.dragDropContainerRect.y);
        yTop = Math.max(0, yTop);
        yBtm = Math.max(0, yBtm);
        
        let threshold = 100;
        let dir: "top"|"btm"  = null;
        let d: number = 0;
        if (yTop < yBtm && yTop <= threshold) {
            dir = "top";
            d = yTop;
        }
        if (yBtm < yTop && yBtm <= threshold) {
            dir = "btm";
            d = yBtm;
        }
        
        if (dir) {
            let v = threshold - d;
            v = Math.min(Math.max(v, 0), threshold) / threshold;
            if (dir == "top") {
                v = -v;
            }
            this.scrollIntoViewSpeed = v;
        }
        else {
            this.scrollIntoViewSpeed = 0;
        }
    }
    
    scrollIntoViewStep(): void {
        let d = this.scrollIntoViewSpeed * 10;
        let currScrollTop = this.fastList.container.scrollTop;
        let minScrollTop = 0;
        let maxScrollTop = this.fastList.container.scrollHeight - this.fastList.container.clientHeight;
        let newScrollTop = Math.round(Math.min(maxScrollTop, Math.max(minScrollTop, currScrollTop + d)));
        if (newScrollTop == currScrollTop) {
            return;
        }
        this.fastList.container.scrollTo(0, newScrollTop);
        
        this.toggleDropZoneHighlightsAnimations(false);
        if (this.isKanban()) {
            let dz = this.currKanbanDropZones[this.currKanbanDropZones.length - 1];
            if (dz) {
                if (document.contains(dz.dropZoneElement)) {
                    this.highlightKanbanDropZone(dz);
                }
                else {
                    this.removeKanbanDropZoneHighlight(dz);
                }
            }
        }
        else {
            let dz = this.currDropZones[this.currDropZones.length - 1];
            if (dz) {
                if (document.contains(dz.dropZoneElement)) {
                    this.highlightDropZone(dz);
                }
                else {
                    this.removeDropZoneHighlight(dz);
                }
            }
        }
        this.toggleDropZoneHighlightsAnimations(true);
    }
    
    toggleDropZoneHighlightsAnimations(enabled: boolean): void {
        this.$dropZoneHighlightsContainer.toggleClass("no-animations", !enabled);
    }
    
    
    
    
    
    
    /****************************************
    *************** FastList ****************
    *****************************************/
    updateFastListEntries() {
        this.debug("starting updateFastListEntries()");
        if (!this.model) {
            this.debug("updateFastListEntries() error: no model");
            return;
        }
        let groupped = !this.model.settings["show-recently-modified"]; // Whether to group in taskgroups
        let headers = this.model.settings["show-header-per-list"]; // Whether to show a header in each taskgroup
        let showOrphans = this.model.settings["show-orphans"]; // Whether to show orphans pseudo-taskgroup
        let filterSetting = <Filter>this.model.settings[this.isKanban() ? "kanban-filter" : "filter"];
        let sortBy = this.fastListSettings.sortBy;
        let sortAsc = this.fastListSettings.sortAsc;
        let hTaskGroup = this.fastListSettings.hTaskGroup;
        let hHeader = this.fastListSettings.hHeader;
        let hKanbanHeader = this.fastListSettings.hKanbanHeader;
        let hEmptyTgInfo = this.fastListSettings.hEmptyTgInfo;
        let hKanbanEmptyTgInfo = this.fastListSettings.hKanbanEmptyTgInfo;
        let hKanbanEntryBox = this.fastListSettings.hKanbanEntryBox;
        let hKanbanLastEntryBox = this.fastListSettings.hKanbanLastEntryBox;
        let hHiddenTasksInfo = this.fastListSettings.hHiddenTasksInfo;
        let search = !!this.currSearchFilter;
        let filter = this.currSearchFilter;
        let skipEmptyTaskGroups = search || !this.model.showsEmptyTaskGroups;
        const TG_ORPHANS = "__orphans__";
        const TG_RECENTLY_MODIFIED = "__recently_modified__";
        
        // Group tasks
        let nHiddenTasks = 0;
        let groups: { [id: string]: { tg: TaskGroupModel, tasks: TaskModel[] } } = {};
        if (groupped) {
            for (let id in this.model.taskGroups) {
                groups[id] = { tg: this.model.taskGroups[id], tasks: [] };
            }
            for (let id in this.model.tasks) {
                let task = this.model.tasks[id];
                if (task.trashed != this.model.isTrash) {
                    continue;
                }
                if (!this.meetsFilter(filterSetting, task)) {
                    continue;
                }
                if (search && !Task.matchesSearchString(task.id, task.cachedSearchString, filter)) {
                    continue;
                }
                for (let tgId of task.taskGroupIds) {
                    if (tgId in groups) {
                        groups[tgId].tasks.push(task);
                    }
                }
                if (task.taskGroupIds.length == 0 || (task.taskGroupIds.length == 1 && task.taskGroupIds[0] == TG_ORPHANS)) {
                    groups[task.projectId + "/" + TG_ORPHANS].tasks.push(task);// @todo tasks of undefined
                }
            }
            if (!this.model.settings["show-orphans"]) {
                for (let id in this.model.taskGroups) {
                    if (id.indexOf(TG_ORPHANS) >= 0) {
                        nHiddenTasks += groups[id].tasks.length;
                        delete groups[id];
                    }
                }
            }
        }
        else {
            groups[TG_RECENTLY_MODIFIED] = { tg: this.getRecentlyModifiedTaskGroupModel(this.model.projectId), tasks: [] };
            for (let id in this.model.tasks) {
                let task = this.model.tasks[id];
                if (task.trashed != this.model.isTrash) {
                    continue;
                }
                if (!this.meetsFilter(filterSetting, task)) {
                    continue;
                }
                if (search && !Task.matchesSearchString(task.id, task.cachedSearchString, filter)) {
                    continue;
                }
                groups[TG_RECENTLY_MODIFIED].tasks.push(task);
            }
        }
        
        // Sort tasks and taskgroups
        let groupsArr: { tg: TaskGroupModel, tasks: TaskModel[] }[] = [];
        for (let groupId in groups) {
            groupsArr.push(groups[groupId]);
            let tasks = groups[groupId].tasks;
            if (groups[groupId].tg.isCollapsed) {
                continue;
            }
            groups[groupId].tasks = TasksSorter.sort(tasks, sortBy, sortAsc, groups[groupId].tg.id);
        }
        groupsArr = TaskGroupsSorter.sort(groupsArr, this.model.projects).filter(x => {
            if (skipEmptyTaskGroups && x.tasks.length == 0 && x.tg.id != TG_RECENTLY_MODIFIED) {
                return false;
            }
            return true;
        });
        
        // Build flat entries array
        let afterPinned: boolean = false;
        let gotNotFirstPinned: boolean = false;
        let entries: FastListEntry<EntryModel>[] = [];
        let nTgs = groupsArr.length;
        for (let id in groupsArr) {
            let idx = Number(id);
            let taskGroup = groupsArr[id];
            let proj = this.model.projects[taskGroup.tg.projectId];
            let pp = proj ? proj.pinnedTaskGroupIds : [];
            let pinned = pp.indexOf(taskGroup.tg.id) >= 0;
            let context: EntryContext = {
                taskGroupId: taskGroup.tg.id,
                projectId: taskGroup.tg.projectId,
                isFirstPinnedTg: !afterPinned && pinned && idx == 0,
                isLastPinnedTg: !afterPinned && pinned && (idx + 1 < nTgs && pp.indexOf(groupsArr[idx + 1].tg.id) < 0),
                isFirstNotPinnedTg: !afterPinned && !gotNotFirstPinned && !pinned,
                isLastNotPinnedTg: idx == nTgs - 1 && !pinned,
            };
            if (context.isFirstNotPinnedTg) {
                gotNotFirstPinned = true;
            }
            if (!pinned) {
                afterPinned = true;
            }
            if (groupped) {
                let computedName = this.model.combinesMultipleSections ? (taskGroup.tg.name + " (" + this.model.projects[taskGroup.tg.projectId].name + ")") : taskGroup.tg.name;
                entries.push({
                    height: hTaskGroup,
                    startsAt: 0,
                    data: { taskGroup: taskGroup.tg, context: context, computedName: computedName },
                });
            }
            if (taskGroup.tg.isCollapsed) {
                continue;
            }
            if (headers) {
                entries.push({
                    height: hHeader,
                    startsAt: 0,
                    data: { header: true, context: context },
                });
            }
            if (taskGroup.tasks.length == 0) {
                entries.push({
                    height: this.isKanban() ? hKanbanEmptyTgInfo : hEmptyTgInfo,
                    startsAt: 0,
                    data: { emptyTgInfo: true, context: context },
                });
            }
            for (let task of taskGroup.tasks) {
                entries.push({
                    height: this.getTaskHeight(task.id),
                    startsAt: 0,
                    data: { task: task, context: context },
                });
            }
        }
        if (groupped && !showOrphans && nHiddenTasks > 0) {
            entries.push({
                height: hHiddenTasksInfo,
                startsAt: 0,
                data: { hiddenTasksInfo: nHiddenTasks, context: null },
            });
        }
        
        // Remove non-existing items from selection/clipboard
        let arr = this.selectedTasks.slice();
        let clipboardFullTaskIds = this.getClipboardTasks();
        arr.push(...clipboardFullTaskIds);
        let obj: { [key: string]: number } = {};
        for (let x of arr) {
            obj[x] = 0;
        }
        let toRm: string[] = [];
        for (let entry of entries) {
            if (entry.data.task) {
                let str = entry.data.context.projectId + "/" + entry.data.context.taskGroupId + "/" + entry.data.task.id;
                if (arr.indexOf(str) >= 0) {
                    obj[str]++;
                }
            }
        }
        for (let k in obj) {
            if (obj[k] == 0) {
                toRm.push(k);
            }
        }
        let n = this.selectedTasks.length;
        this.selectedTasks = this.selectedTasks.filter(x => toRm.indexOf(x) < 0);
        if (this.selectedTasks.length < n) {
            this.notifySelectionChanged();
        }
        this.updateClipboard(clipboardFullTaskIds.filter(x => toRm.indexOf(x) < 0), this.getClipboardIsCut());
        
        // Kanban - merge
        let taskStatuses = this._statuses;
        if (this.isKanban()) {
            let entries2: FastListEntry<EntryModel>[] = [];
            for (let i = 0; i < entries.length; ++i) {
                let entry = entries[i];
                if (entry.data.task) {
                    // Group tasks by status
                    let entryModelsByTaskStatus: { [status: string]: FastListEntry<EntryModel>[] } = {};
                    for (let status of taskStatuses) {
                        entryModelsByTaskStatus[status] = [];
                    }
                    for (let j = i; j < entries.length; ++j) {
                        let taskEntry = entries[j];
                        if (taskEntry.data.task) {
                            let task = taskEntry.data.task;
                            if (entryModelsByTaskStatus[task.status]) {
                                entryModelsByTaskStatus[task.status].push(taskEntry);
                            }
                            if (j + 1 == entries.length) {
                                i = j;
                            }
                        }
                        else {
                            i = j - 1;
                            break;
                        }
                    }
                    
                    // Count max number of tasks having specific status
                    let maxCount = 0;
                    for (let status of taskStatuses) {
                        maxCount = Math.max(maxCount, entryModelsByTaskStatus[status].length);
                    }
                    
                    // Arrange into rows
                    for (let j = 0; j < maxCount; ++j) {
                        let tasksByStatus: { [status: string]: EntryModel } = {};
                        for (let status of taskStatuses) {
                            tasksByStatus[status] = entryModelsByTaskStatus[status][j] ? entryModelsByTaskStatus[status][j].data : null;
                        }
                        let newEntry: FastListEntry<EntryModel> = {
                            height: j + 1 == maxCount ? hKanbanLastEntryBox : hKanbanEntryBox,
                            startsAt: 0,
                            data: {
                                context: null,
                                tasksByStatus: tasksByStatus,
                                isLastTGRow: j + 1 == maxCount,
                            },
                        };
                        entries2.push(newEntry);
                    }
                }
                else if (entry.data.header) {
                    entries2.push({
                        height: hKanbanHeader,
                        startsAt: 0,
                        data: {
                            context: null,
                            kanbanHeader: true,
                        },
                    });
                }
                else {
                    entries2.push(entry);
                }
            }
            entries = entries2;
        }
        
        this.fastList.setEntries(entries);
        this.debug("updateFastListEntries(): num entries = " + entries.length);
        this.debug("updateFastListEntries(): sum entries start+height = " + entries.map(x => `${x.startsAt}+${x.height}`).join(","));
    }
    
    getRecentlyModifiedTaskGroupModel(projectId: string): TaskGroupModel {
        let project = this.model.projects[projectId];
        if (!project) {
            project = this.model.projects[Object.keys(this.model.projects)[0]];
        }
        let nTasksByStatus: { [key: string]: number } = {};
        let statuses = Task.getStatuses();
        for (let status of statuses) {
            nTasksByStatus[status] = 0;
        }
        return {
            id: "__recently_modified__",
            name: this.parent.i18n("plugin.tasks.component.taskGroupsPanel.recentlyModifiedGroup"),
            projectId: projectId,
            taskLabelClasses: project ? project.taskLabelClasses : this.model.defaultTaskLabelClasses,
            isCollapsed: false,
            isDetached: false,
            isOrphans: false,
            nTasksByStatus: nTasksByStatus,
            isClosed: false,
            icon: null,
            withUnread: false,
        };
    }
    
    setOrphansTaskGroupModels(modelsStr: string): void {
        // console.log(`[${new Date().getSeconds()}.${new Date().getMilliseconds()}] setOrphansTaskGroupModels`);
        let models: { [projectId: string]: TaskGroupModel } = JSON.parse(modelsStr);
        for (let tgId in models) {
            let model = models[tgId];
            this.model.taskGroups[model.projectId + "/" + model.id] = model;
        }
        // this.repaint();
        this.lazyRenderScheduler.schedule();
    }
    
    renderFastList() {
        this.debug("starting renderFastList()");
        this.fastList.render();
        this.debug("finished renderFastList()");
    }
    
    fillFastListElement(element: HTMLElement, entry: FastListEntry<EntryModel>): void {
        let data = entry.data;
        let childNodes = <HTMLElement[]><any>element.childNodes;
        this.collectUnusedAvatars(<HTMLElement>element);
        if (element.classList.contains("kanban-dropzone")) {
            element.classList.remove("kanban-dropzone");
        }
        if (element.classList.contains("dropzone")) {
            element.classList.remove("dropzone");
        }
        element.setAttribute("draggable", "false");
        if (data.task) {
            let cache = data.taskCache;
            if (!cache) {
                cache = {
                    createdCalendarDate: this.parent.helper.calendarDate(data.task.createdAt),
                    createdDateWithHourLocal: this.parent.helper.dateWithHourLocal(data.task.createdAt),
                    modifiedCalendarDate: this.parent.helper.calendarDate(data.task.modifiedAt),
                    modifiedDateWithHourLocal: this.parent.helper.dateWithHourLocal(data.task.modifiedAt),
                };
                data.taskCache = cache;
            }
            
            const isKanban = this.isKanban();
            const hideTaskNumbers = !this.model.settings["show-task-numbers"];
            
            if (!isKanban && !this.isInRecentlyModifiedMode()) {
                element.setAttribute("draggable", "true");
            }
            
            let taskFullId = data.context.projectId + "/" + data.context.taskGroupId + "/" + data.task.id;
            let pinned = data.task.pinnedInTaskGroupIds.indexOf(data.context.taskGroupId) >= 0;
            let overdue = this.isTaskOverdue(data.task);
            element.className = "entry entry-task" + (isKanban ? "" : " dropzone") + (this.isTaskSelected(taskFullId) ? " selected" : "") + (this.isTaskCut(taskFullId) ? " cut" : "") + (pinned ? " pinned" : "") + (data.task.unread ? " unread" : "") + (overdue ? " overdue" : "") + " status-" + data.task.status;
            (<HTMLElement>childNodes[1].childNodes[0]).className = "task-label " + data.task.labelClass;
            (<HTMLElement>childNodes[1].childNodes[0]).innerText = "#" + (isKanban && hideTaskNumbers ? "" : data.task.id);
            (<HTMLElement>childNodes[2].childNodes[0]).style.height = (entry.height - 7) + "px";
            (<HTMLElement>childNodes[2].childNodes[0].childNodes[0].childNodes[0]).innerText = data.task.title;
            (<HTMLElement>childNodes[2].childNodes[0].childNodes[0].childNodes[2]).innerText = data.task.description;
            (<HTMLElement>childNodes[3]).className = "for-task task-status " + data.task.labelClass + "-color";
            (<HTMLElement>childNodes[3]).innerText = Task.getStatusText(data.task.status);
            if (this.hasAssignedToColumn) {
                this.appendAvatars(childNodes[4], data.task.assignedTo);
            }
            (<HTMLElement>childNodes[5]).title = this.getAttachmentsString(data.task);
            (<HTMLElement>childNodes[5]).innerText = this.getAttachmentsString(data.task);
            if (this.hasCreatedColumn) {
                (<any>childNodes[6]).prepend(this.getAvatar(data.task.createdBy));
                (<HTMLElement>childNodes[6].childNodes[1]).innerText = cache.createdCalendarDate;
                (<HTMLElement>childNodes[6].childNodes[1]).title = cache.createdDateWithHourLocal;
            }
            if (this.hasModifiedColumn) {
                (<any>childNodes[7]).prepend(this.getAvatar(data.task.modifiedBy));
                (<HTMLElement>childNodes[7].childNodes[1]).innerText = cache.modifiedCalendarDate;
                (<HTMLElement>childNodes[7].childNodes[1]).title = cache.modifiedDateWithHourLocal;
            }
            
            let badgesContainer = (<HTMLElement>childNodes[2].childNodes[0].childNodes[1]);
            (<HTMLElement>badgesContainer.childNodes[0]).classList.toggle("hidden", data.task.nComments == 0);
            (<HTMLElement>badgesContainer.childNodes[1]).classList.toggle("hidden", data.task.attachments.length == 0);
            
            let calendarIcon = (<HTMLElement>badgesContainer.childNodes[2]);
            calendarIcon.classList.toggle("hidden", !data.task.startTimestamp);
            if (data.task.startTimestamp) {
                calendarIcon.setAttribute("title", this.formatTaskDateRange(data.task.startTimestamp, data.task.endTimestamp, data.task.wholeDays));
            }
            
            let idx = 3;
            for (let i = idx; i < badgesContainer.childNodes.length; ++i) {
                (<HTMLElement>badgesContainer.childNodes[i]).classList.toggle("hidden", true);
            }
            let showAllOtherListNames = this.model.settings["show-all-other-list-names"];
            for (let i = 0, len = data.task.taskGroupIds.length; i < len; ++i) {
                let tgId = data.task.taskGroupIds[i];
                if (tgId != data.context.taskGroupId) {
                    let tg = this.model.taskGroups[tgId];
                    if (!tg) {
                        continue;
                    }
                    let proj = this.model.projects[tg.projectId];
                    if (!proj) {
                        continue;
                    }
                    let el = (<HTMLElement>badgesContainer.childNodes[idx]);
                    if (!el) {
                        el = <HTMLElement>this.emptyTgBadgeTemplate.cloneNode(true);
                        (<any>badgesContainer).append(el);
                    }
                    let count = 1;
                    if (!showAllOtherListNames && (i + 1 == len || (i + 2 == len && data.task.taskGroupIds[i + 1] == data.context.taskGroupId))) {
                        count = data.task.taskGroupIds.length - 1;
                    }
                    this.fillTgBadge(el, tg.name, proj.pinnedTaskGroupIds.indexOf(tgId) >= 0, tg.icon, count);
                    ++idx;
                }
            }
        }
        else if (data.taskGroup) {
            element.className = "entry entry-taskgroup hover" + (data.taskGroup.isClosed ? " closed" : "") + (this.isKanban() ? " kanban-dropzone" : " dropzone") + (data.taskGroup.withUnread ? " with-unread" : "");
            let proj = this.model.projects[data.context.projectId];
            let pinned = proj && proj.pinnedTaskGroupIds.indexOf(data.context.taskGroupId) >= 0;
            (<HTMLTableCellElement>childNodes[8]).colSpan = this.getCurrentNVisibleCols();
            let cont = <HTMLElement>childNodes[8].children[0].children[0].children[1].children[0].children[0];
            while (cont.firstChild) {
                cont.removeChild(cont.firstChild);
            }
            if (data.taskGroup.icon) {
                let tpl = this.emptyTgIconTemplates[this.getIconId(data.taskGroup.icon)];
                let el = <HTMLElement>tpl.cloneNode(true);
                el.style.color = data.taskGroup.icon.color;
                (<HTMLElement>childNodes[8].children[0].children[0].children[1].children[0].children[0]).appendChild(el);
            }
            (<HTMLElement>childNodes[8].children[0].children[0].children[1].children[0].children[1]).innerText = data.computedName;
            (<HTMLElement>childNodes[8].children[0].children[0].children[1].children[0]).title = data.computedName;
            (<HTMLElement>childNodes[8].children[0].children[0].children[1].children[0]).classList.toggle("orphans-tg-label", data.taskGroup.isOrphans);
            (<HTMLElement>childNodes[8]).className = "for-taskgroup taskgroup" + (data.taskGroup.isCollapsed ? " collapsed" : "");
            (<HTMLElement>childNodes[8]).classList.toggle("orphans-tg", data.taskGroup.isOrphans);
            (<HTMLElement>childNodes[8]).classList.toggle("pinned", pinned);
            (<HTMLElement>childNodes[8].children[0].children[1].children[0]).setAttribute("data-payload", data.taskGroup.id);
            (<HTMLElement>childNodes[8].children[0].children[1].children[0]).setAttribute("data-taskgroup-project-id", data.taskGroup.projectId);
            (<HTMLElement>childNodes[8].children[0].children[1].children[1]).setAttribute("data-payload", data.taskGroup.id);
            (<HTMLElement>childNodes[8].children[0].children[1].children[1]).setAttribute("data-taskgroup-project-id", data.taskGroup.projectId);
            (<HTMLElement>childNodes[8].children[0].children[1].children[2]).setAttribute("data-payload", data.taskGroup.id);
            (<HTMLElement>childNodes[8].children[0].children[1].children[2]).setAttribute("data-taskgroup-project-id", data.taskGroup.projectId);
            let arrowsContainer = (<HTMLElement>childNodes[8].children[0].children[1].children[3]);
            (<HTMLElement>arrowsContainer.children[0]).classList.toggle("hidden-o", data.context.isFirstPinnedTg || data.context.isFirstNotPinnedTg);
            (<HTMLElement>arrowsContainer.children[1]).classList.toggle("hidden-o", data.context.isFirstPinnedTg || data.context.isFirstNotPinnedTg);
            (<HTMLElement>arrowsContainer.children[2]).classList.toggle("hidden-o", data.context.isLastPinnedTg || data.context.isLastNotPinnedTg);
            (<HTMLElement>arrowsContainer.children[3]).classList.toggle("hidden-o", data.context.isLastPinnedTg || data.context.isLastNotPinnedTg);
            
            this.fillProgressBar(<HTMLElement>childNodes[8].children[0].children[0].children[3], data.taskGroup.nTasksByStatus);
        }
        else if (data.header) {
            element.className = "entry entry-header" + (this.isKanban() ? "" : " dropzone");
            for (let i = 9; i < 17; ++i) {
                let el = <HTMLElement>element.children[i];
                if (el.dataset.sortBy == this.fastListSettings.sortBy) {
                    el.className = "for-header sorted-" + (this.fastListSettings.sortAsc ? "asc" : "desc");
                }
                else {
                    el.className = "for-header";
                }
            }
        }
        else if (data.emptyTgInfo) {
            element.className = "entry entry-empty-tg-info" + (this.isKanban() ? " kanban-dropzone" : " dropzone");
            (<HTMLTableCellElement>childNodes[17]).colSpan = this.getCurrentNVisibleCols();
        }
        else if (data.hiddenTasksInfo) {
            element.className = "entry entry-hidden-tasks-info";
            (<HTMLTableCellElement>childNodes[18]).colSpan = this.getCurrentNVisibleCols();
            (<HTMLTableCellElement>childNodes[18]).children[0].textContent = this.parent.i18n("plugin.tasks.component.taskGroupsPanel.table.hiddenTasks.info", data.hiddenTasksInfo);
        }
        else if (data.kanbanHeader) {
            element.className = "entry entry-kanban-header" + (this.isKanban() ? " kanban-dropzone" : "");
        }
        else if (data.tasksByStatus) {
            const isKanban = this.isKanban();
            const hideTaskNumbers = !this.model.settings["show-task-numbers"];
            element.className = "entry entry-kanban-tasks" + (data.isLastTGRow ? " last-row-in-tg" : "");
            let taskStatuses = this._statuses;
            let nTaskStatuses = taskStatuses.length;
            let x = 23;
            for (let i = 0; i < nTaskStatuses; ++i) {
                let taskEntry = data.tasksByStatus[taskStatuses[i]];
                let task = taskEntry ? taskEntry.task : null;
                let context = taskEntry ? taskEntry.context : null;
                let taskGroupFullId = (task && context) ? (context.projectId + "/" + context.taskGroupId) : "";
                let taskFullId = (task && context) ? (context.projectId + "/" + context.taskGroupId + "/" + task.id) : "";
                let td = childNodes[x + i];
                let box: HTMLElement = <HTMLElement>td.childNodes[0];
                element.setAttribute(`data-kanban-has-${taskStatuses[i]}`, task ? "1" : "0");
                box.classList.toggle("empty", !task);
                box.classList.toggle("selected", task && this.isTaskSelected(taskFullId));
                box.classList.toggle("unread", task && task.unread);
                td.classList.toggle("with-task", !!task);
                td.classList.toggle("no-task", !task);
                td.classList.toggle("unassigned", task && task.assignedTo.length == 0);
                td.setAttribute("data-kanban-dropzone-taskgroup-full-id", taskGroupFullId);
                box.setAttribute("draggable", task ? "true" : "false");
                box.setAttribute("data-task-full-id", taskFullId);
                box.childNodes[0].childNodes[0].textContent = task ? ("#" + (isKanban && hideTaskNumbers ? "" : task.id)) : "";
                (<HTMLElement>box.childNodes[0].childNodes[0]).className = "task-label "  + (task ? (task.labelClass + " has-task-tooltip") : "");
                (<HTMLElement>box.childNodes[0].childNodes[0]).setAttribute("data-task-id", task ? task.id : "");
                $(box.childNodes[0].childNodes[0]).data("task-id", task ? task.id : "");
                box.childNodes[0].childNodes[1].textContent = task ? task.title : "";
                box.childNodes[0].childNodes[2].textContent = task ? (task.description ? (" " + task.description) : "") : "";
                
                // Task box lower panel
                let lp = box.childNodes[1];
                let mby = <HTMLElement>lp.childNodes[0]; // Modified by
                let mdt = <HTMLElement>lp.childNodes[1]; // Modified dt
                let ato = <HTMLElement>lp.childNodes[2]; // Assigned to
                mdt.textContent = task ? this.parent.helper.calendarDate(task.modifiedAt) : "";
                mdt.title = task ? this.parent.helper.dateWithHourLocal(task.modifiedAt) : "";
                if (task) {
                    (<any>mby).prepend(this.getAvatar(task.modifiedBy));
                }
                ato.textContent = "";
                if (task) {
                    this.appendAvatars(ato, task.assignedTo);
                }
            }
        }
        element.style.height = entry.height + "px";
    }
    
    getCurrentNVisibleCols(): number {
        if (this.isKanban()) {
            if (this.model.settings["kanban-filter"] == Filter.onlyNotDone) {
                return 3;
            }
            return 4;
        }
        return this.nVisibleCols;
    }
    
    fillProgressBar(el: HTMLElement, data: { [key: string]: number }) {
        let total = 0;
        for (let k in data) {
            total += data[k];
        }
        for (let i = 0; i < this._statuses.length; ++i) {
            let j = el.children.length - i - 1;
            let el2 = <HTMLElement>el.children[j];
            let n = data[this._statuses[i]];
            el2.innerText = "" + n;
            el2.style.width = "" + (total == 0 ? 0 : (100 * n / total)) + "%";
        }
    }
    
    fillTgBadge(el: HTMLElement, tgName: string, pinned: boolean, icon: TaskGroupIcon, count: number): void {
        let iconEl: HTMLElement = null;
        if (icon) {
            let tpl = this.emptyTgIconTemplates[this.getIconId(icon)];
            iconEl = <HTMLElement>tpl.cloneNode(true);
            iconEl.style.color = icon.color;
        }
        (<HTMLElement>el).classList.toggle("hidden", false);
        (<HTMLElement>el.childNodes[0]).classList.toggle("pinned", pinned);
        (<HTMLElement>el.childNodes[0]).title = tgName;
        (<HTMLElement>el.childNodes[0].childNodes[0]).classList.toggle("hidden", count == 1);
        if (count > 1) {
            (<HTMLElement>el.childNodes[0].childNodes[0]).innerText = "(" + count + ")";
        }
        let iconsContainer = (<HTMLElement>el.childNodes[0].childNodes[1]);
        while (iconsContainer.firstChild) {
            iconsContainer.removeChild(iconsContainer.firstChild);
        }
        if (iconEl) {
            iconsContainer.appendChild(iconEl);
        }
        (<HTMLElement>el.childNodes[0].childNodes[2]).innerText = tgName;
    }
    
    formatTaskDateRange(startTimestamp: number, endTimestamp: number, wholeDays: boolean): string {
        let start = new Date(startTimestamp);
        let end = new Date(endTimestamp);
        let sameDay = start.getDate() == end.getDate() && start.getMonth() == end.getMonth() && start.getFullYear() == end.getFullYear();
        
        let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
        if (sameDay) {
            if (wholeDays) {
                return this.formatDate(start, true);
            }
            else {
                return this.formatDate(start) + " - " + pad0s(end.getHours()) + ":" + pad0s(end.getMinutes());
            }
        }
        return this.formatDate(start, wholeDays) + " - " + this.formatDate(end, wholeDays);
    }
    
    formatDate(dt: Date, onlyDate: boolean = false): string {
        let pad0s = (x: number) => (x < 10 ? "0" : "") + x;
        let str = pad0s(dt.getDate()) + "." + pad0s(dt.getMonth() + 1) + "." + dt.getFullYear();
        if (!onlyDate) {
            str += " " + pad0s(dt.getHours()) + ":" + pad0s(dt.getMinutes());
        }
        return str;
    }
    
    beforeFastListRender(): void {
        let now = new Date();
        this.nowTimestamp = now.getTime();
        this.nowDMY = {
            day: now.getDate(),
            month: now.getMonth(),
            year: now.getFullYear(),
        };
    }
    
    afterFastListRender(range: [number, number]): void {
        if (this.hasAvatarsToRender && this.personsComponent.$main) {
            this.hasAvatarsToRender = false;
            this.personsComponent.refreshAvatars();
        }
        this.visibleTaskGroupElements = {};
        let n = this.fastList.entriesContainer.childElementCount;
        for (let i = 0; i < n; ++i) {
            let el = <HTMLElement>this.fastList.entriesContainer.children[i];
            if (el.classList.contains("entry-taskgroup")) {
                let id = parseInt(el.dataset.entryId);
                let entry = this.fastList.entries[id];
                if (entry) {
                    let tgFullId = entry.data.context.projectId + "/" + entry.data.context.taskGroupId;
                    this.visibleTaskGroupElements[tgFullId] = el;
                }
            }
        }
        this.updateHoverTaskGroup();
    }
    
    beforeFastListDeleteElement(el: HTMLElement): void {
        this.collectUnusedAvatars(el);
    }
    
    createFastListEmptyElement(): HTMLElement {
        return <HTMLElement>this.emptyEntryTemplate.cloneNode(true);
    }
    
    getAttachmentsString(task: TaskModel): string {
        if (!task.attachments) {
            return "";
        }
        if ((<any>task)._cached_attachments) {
            return (<any>task)._cached_attachments;
        }
        
        let str = task.attachments.length > 0 ? ("(" + task.attachments.length + ") " + task.attachments.map(x => JSON.parse(x).name).join(", ")) : "";
        (<any>task)._cached_attachments = str;
        return str;
    }
    
    appendAvatars(el: HTMLElement, users: string[]) {
        for (let user of users) {
            (<any>el).append(this.getAvatar(user));
        }
    }
    
    createAvatar(): HTMLElement {
        let cnv = document.createElement("canvas");
        cnv.className = "icon not-rendered";
        cnv.setAttribute("data-auto-refresh", "true");
        cnv.setAttribute("data-auto-size", "true");
        
        let span = document.createElement("span");
        span.className = "av-cnv";
        (<any>span).append(cnv);
        
        return span;
    }
    
    getAvatar(user: string): HTMLElement {
        if (this.freeAvatars[user] && this.freeAvatars[user].length > 0) {
            return this.freeAvatars[user].pop();
        }
        if (!this.freeAvatars[user]) {
            this.freeAvatars[user] = [];
        }
        let av = this.createAvatar();
        (<HTMLElement>av.childNodes[0]).setAttribute("data-hashmail-image", user);
        (<HTMLElement>av.childNodes[0]).setAttribute("data-tooltip-trigger", user);
        this.hasAvatarsToRender = true;
        return av;
    }
    
    collectUnusedAvatars(el: HTMLElement): void {
        let $avatars = $(el).find(".av-cnv");
        for (let i = $avatars.length - 1; i >= 0; --i) {
            let av = $avatars[i];
            let user = (<HTMLElement>av.childNodes[0]).getAttribute("data-hashmail-image");
            if (!this.freeAvatars[user]) {
                this.freeAvatars[user] = [];
            }
            this.freeAvatars[user].push(av);
            av.remove();
        }
    }
    
    removeTextNodes(el: HTMLElement) {
        for (let i = el.childNodes.length - 1; i >= 0; --i) {
            let node = el.childNodes[i];
            if (node.nodeType == Node.TEXT_NODE || node.nodeType == Node.COMMENT_NODE) {
                node.remove();
            }
            else if (node.nodeType == Node.ELEMENT_NODE) {
                if ((<HTMLElement>node).dataset.keepText == "1") {
                    continue;
                }
                this.removeTextNodes(<HTMLElement>node);
            }
        }
    }
    
    grabFocus(): void {
        this.$container.children(".panel").focus();
    }
    
    isTaskOverdue(task: TaskModel): boolean {
        if (task.status == "done") {
            return false;
        }
        if (!this.nowDMY) {
            return false;
        }
        if (!task.wholeDays) {
            return task.overdueInfo.timestamp < this.nowTimestamp;
        }
        else {
            if (task.overdueInfo.year != this.nowDMY.year) {
                return task.overdueInfo.year < this.nowDMY.year;
            }
            if (task.overdueInfo.month != this.nowDMY.month) {
                return task.overdueInfo.month < this.nowDMY.month;
            }
            if (task.overdueInfo.day != this.nowDMY.day) {
                return task.overdueInfo.day < this.nowDMY.day;
            }
            return false;
        }
    }
    
    onSizeChanged(w: number): void {
        this.$container.toggleClass("collapse-header-button-texts", w < 520);
        if (this.$settingsMenu && this.$settingsMenu.hasClass("visible")) {
            this.$settingsMenu.removeClass("visible");
        }
        this.$container.toggleClass("hide-progress", w < 440);
    }
    
    
    
    
    
    
    /****************************************
    **************** Events *****************
    *****************************************/
    onSettingsButtonClick(e: MouseEvent): void {
        let $next = $(e.currentTarget).next();
        this.$settingsMenu.children(".context-menu-content").css("right", Math.round($next.outerWidth(true)) - 30);
        this.$settingsMenu.addClass("visible");
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
    
    onTaskMouseDown(e: MouseEvent): void {
        let id = this.getPointerEntryId();
        let el = <HTMLElement>e.currentTarget;
        if (this.isKanban() && el.tagName == "TD") {
            el = <HTMLElement>el.childNodes[0];
        }
        let ptr = this.buildPointer(el);
        if (!ptr) {
            return;
        }
        let taskFullId = ptr.projectId + "/" + ptr.taskGroupId + "/" + ptr.taskId;
        
        Q().then(() => {
            if (this.previewDirty) {
                this.previewExit = Q.defer();
                this.triggerEvent("confirmPreviewExit");
                return this.previewExit.promise;
            }
        }).then(() => {
            if (e.ctrlKey || e.metaKey) {
                // Toggle this one
                this.toggleTaskSelection(taskFullId);
            }
            else if (e.shiftKey) {
                // Range selection
                this.selectRange(id, ptr.entryId);
            }
            else {
                // Select only this one
                const isTaskAlreadySelected = this.selectedTasks.includes(taskFullId);
                this.selectTask(taskFullId, !isTaskAlreadySelected); 
                // HACK: drugi parameter jest false (bez odznaczania innych taskow) bo jezeli ktos w tym momencie zacznie przeciagac
                // to straci wczesniej zaznaczone inne taski
                // W przypadku, jezeli nie zacznie przeciagac i pusci przycisk myszy - zostanie odpalona metoda onTaskMouseUp, gdzie
                // wywolanie selectTask jest juz z parametrem true
            }
            // console.log("selected tasks on onTaskMouseDown", this.selectedTasks);
            this.pointer = ptr;
            this.updateClasses();
            this.renderFastList();
            this.notifySelectionChanged();
        });
    }

    onTaskMouseUp(e: MouseEvent): void {
        // console.log("onTaksMouseUp")
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        let id = this.getPointerEntryId();
        let el = <HTMLElement>e.currentTarget;
        if (this.isKanban() && el.tagName == "TD") {
            el = <HTMLElement>el.childNodes[0];
        }
        let ptr = this.buildPointer(el);
        if (!ptr) {
            return;
        }
        let taskFullId = ptr.projectId + "/" + ptr.taskGroupId + "/" + ptr.taskId;
        // console.log("taskFullId", taskFullId);

        Q().then(() => {
            if (this.previewDirty) {
                this.previewExit = Q.defer();
                this.triggerEvent("confirmPreviewExit");
                return this.previewExit.promise;
            }
        }).then(() => {
            this.selectTask(taskFullId, true);
            this.pointer = ptr;
            this.updateClasses();
            this.renderFastList();
            this.notifySelectionChanged();
        });
    }    

    onTaskDoubleClick(e: MouseEvent): void {
        if ($(e.target).is("i.fa.fa-thumb-tack")) {
            return;
        }
        let el = (<HTMLElement>e.currentTarget);
        if (el.classList.contains("kanban-task-box-content")) {
            if (!el.classList.contains("empty")) {
                let taskId = el.dataset.taskFullId.split("/")[2];
                this.triggerEvent("openTaskWindow", taskId, true);
            }
            return;
        }
        let entry = this.getEntry(el);
        this.triggerEvent("openTaskWindow", entry.data.task.id, true);
    }
    
    onNewTaskGroupClick(e: MouseEvent) {
        e.stopPropagation();
        let projectId = (<HTMLElement>e.currentTarget).getAttribute("data-payload") + "";
        if (!projectId) {
            projectId = this.model.projectId;
        }
        this.$settingsMenu.removeClass("visible");
        this.triggerEvent("newTaskGroup", projectId);
    }
    
    onEditTaskGroupClick(e: MouseEvent) {
        let taskGroupId = (<HTMLElement>e.currentTarget).getAttribute("data-payload") + "";
        let pId = (<HTMLElement>e.currentTarget).getAttribute("data-taskgroup-project-id") + "";
        this.triggerEvent("editTaskGroup", pId, taskGroupId);
    }
    
    onPasteIntoTaskGroupClick(e: MouseEvent) {
        let taskGroupId = (<HTMLElement>e.currentTarget).getAttribute("data-payload") + "";
        let pId = (<HTMLElement>e.currentTarget).getAttribute("data-taskgroup-project-id") + "";
        this.pasteTasks(taskGroupId, pId);
    }
    
    onNewTaskClick(e: MouseEvent) {
        let $btn = $(e.currentTarget);
        let taskGroupId = (<HTMLElement>e.currentTarget).getAttribute("data-payload") + "";
        let pId = (<HTMLElement>e.currentTarget).getAttribute("data-taskgroup-project-id") + "";
        if (taskGroupId && taskGroupId.substr(0, 2) == "__") {
            taskGroupId = "__orphans__";
        }
        if (!pId && $btn.is("[data-action-id=\"item-new-task\"]") && this.model.projectId != CustomTasksElements.ALL_TASKS_ID && this.model.projectId != CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID && this.model.projectId != CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
            pId = this.model.projectId;
        }
        this.triggerEvent("newTask", pId, taskGroupId);
    }
    
    onDeleteTaskClick(e: MouseEvent) {
        if (!this.selectedTasks || this.selectedTasks.length == 0) {
            return;
        }
        this.lockSelection();
        this.triggerEvent("deleteTasks", JSON.stringify(this.selectedTasks));
    }
    
    onRestoreTaskClick(e: MouseEvent) {
        if (!this.selectedTasks || this.selectedTasks.length == 0) {
            return;
        }
        this.lockSelection();
        this.triggerEvent("restoreTasks", JSON.stringify(this.selectedTasks));
    }
    
    onTaskGroupHeaderClick(e: MouseEvent) {
        let $target = $(e.target);
        let collapse = false;
        let validTargets: string[] = [
            "div.taskgroup-header",
            "div.left",
            "div.right",
            "span.taskgroup-label",
            "div.progress",
            "[data-action=\"taskgroup-toggle-collapsed\"]",
            "i.fa.fa-caret-down",
        ];
        for (let validTarget of validTargets) {
            if ($target.is(validTarget)) {
                collapse = true;
            }
        }
        if (!collapse && $target.parent().is(".progress")) {
           collapse = true;
        }
        if (collapse) {
            let $entry = $target.closest(".entry");
            let entryEl = <HTMLElement>$entry[0];
            let entry = this.fastList.entries[Number(entryEl.getAttribute("data-entry-id"))];
            entry.data.taskGroup.isCollapsed = !entry.data.taskGroup.isCollapsed;
            if (e.ctrlKey || e.metaKey) {
                this.setAllCollapsed(entry.data.taskGroup.isCollapsed);
            }
            else {
                let arr = this.collapsedTaskGroups;
                let fullId = entry.data.taskGroup.projectId + "/" + entry.data.taskGroup.id;
                let idx = arr.indexOf(fullId);
                if (idx >= 0 != entry.data.taskGroup.isCollapsed) {
                    if (entry.data.taskGroup.isCollapsed) {
                        arr.push(fullId);
                    }
                    else if (idx >= 0) {
                        arr.splice(idx, 1);
                    }
                }
                this.saveCollapsed();
            }
        }
    }
    
    onToggleCollapsedAllClick(e: MouseEvent): void {
        this.setAllCollapsed(!this.$container.hasClass("all-collapsed"));
    }
    
    setAllCollapsed(collapsed: boolean): void {
        let arr: string[] = [];
        for (let tgId in this.model.taskGroups) {
            let tg = this.model.taskGroups[tgId];
            tg.isCollapsed = collapsed;
            if (collapsed) {
                arr.push(tg.projectId + "/" + tg.id);
            }
        }
        this.collapsedTaskGroups = arr;
        this.saveCollapsed();
    }
    
    saveCollapsed(): void {
        this.model.settings["collapsed-taskgroups"] = JSON.stringify(this.collapsedTaskGroups);
        this.triggerEvent("settingChanged", "collapsed-taskgroups", this.model.settings["collapsed-taskgroups"], true);
        this.repaint();
    }
    
    onTaskGroupMoveToTop(e: MouseEvent): void {
        this.moveTaskGroup(e.target, MOVE_TG_DST.top);
    }
    
    onTaskGroupMoveUp(e: MouseEvent): void {
        this.moveTaskGroup(e.target, MOVE_TG_DST.up);
    }
    
    onTaskGroupMoveDown(e: MouseEvent): void {
        this.moveTaskGroup(e.target, MOVE_TG_DST.down);
    }
    
    onTaskGroupMoveToBottom(e: MouseEvent): void {
        this.moveTaskGroup(e.target, MOVE_TG_DST.bottom);
    }
    
    moveTaskGroup(e: EventTarget, pos: number): void {
        let el = $(e).closest(".entry")[0];
        let entry = this.getEntry(<HTMLElement>el);
        if (!entry || !entry.data.taskGroup) {
            return;
        }
        this.triggerEvent("moveTaskGroup", entry.data.taskGroup.id, pos);
    }
    
    onPinTaskGroupClick(e: MouseEvent): void {
        if (this.showsFixedSection() || this.model.isConv2Section) {
            return;
        }
        let el = $(e.currentTarget).closest(".entry")[0];
        let entry = this.getEntry(<HTMLElement>el);
        if (!entry || !entry.data.taskGroup) {
            return;
        }
        let tgId = entry.data.taskGroup.id;
        let proj = this.model.projects[entry.data.taskGroup.projectId];
        
        if (proj) {
            let idx = proj.pinnedTaskGroupIds.indexOf(tgId);
            let newState = idx < 0;
            this.triggerEvent("toggleTaskGroupPinned", tgId, newState);
        }
    }
    
    onPinTaskClick(e: MouseEvent): void {
        if (this.showsFixedSection() || this.model.isConv2Section) {
            return;
        }
        let el = $(e.currentTarget).closest(".entry")[0];
        let entry = this.getEntry(<HTMLElement>el);
        if (!entry || !entry.data.task) {
            return;
        }
        let t = entry.data.task;
        let tgId = entry.data.context.taskGroupId;
        let idx = t.pinnedInTaskGroupIds.indexOf(tgId);
        let newState = idx < 0;
        this.triggerEvent("toggleTaskPinned", t.id, tgId, newState);
    }
    
    onFullRefreshClick(): void {
        this.triggerEvent("fullRefresh", true, true);
    }
    
    onMarkAllAsReadClick(e: MouseEvent): void {
        e.stopPropagation();
        this.$settingsMenu.removeClass("visible");
        
        this.triggerEvent("markAllAsRead");
    }
    
    onTableHeaderClick(e: MouseEvent): void {
        if (this.preventSort) {
            return;
        }
        let $th = <JQuery>$(e.currentTarget);
        let sortBy = $th.data("sort-by");
        if (this.fastListSettings.sortBy == sortBy) {
            this.fastListSettings.sortAsc = !this.fastListSettings.sortAsc;
        }
        else {
            this.fastListSettings.sortBy = sortBy;
        }
        this.repaint();
    }
    
    onColResizerMouseDown(e: MouseEvent): void {
        this.preventSort = true;
        let $resizer = <JQuery>$(e.currentTarget);
        let $right = $resizer.closest("th");
        if ($right.length == 0) {
            $right = $resizer.closest("td.for-header");
        }
        let $left = $right.prevAll(":visible").first();
        this.colResizerPos0 = $left.outerWidth();
        this.colResizerPos1 = $right.outerWidth();
        this.colResizerClient0 = e.clientX;
        this.colResizerLeftCol = $left.data("col");
        this.colResizerRightCol = $right.data("col");
        this.$colResizerLeftCols = this.$container.find("col[data-col='" + $left.data("col") + "']");
        this.$colResizerRightCols = this.$container.find("col[data-col='" + $right.data("col") + "']");
        this.colResizerPosMin = 20;
        this.colResizerPosMax = this.colResizerPos0 + this.colResizerPos1 - this.colResizerPosMin;
        
        if (e.ctrlKey || e.metaKey) {
            let newPos = this.$colResizerLeftCols.data("default-width");
            if (newPos != undefined) {
                this.$colResizerLeftCols.css("width", newPos);
            }
            newPos = this.$colResizerRightCols.data("default-width");
            if (newPos != undefined) {
                this.$colResizerRightCols.css("width", newPos);
            }
            setTimeout(() => {
                this.preventSort = false;
            }, 100);
            let diff: { [key: string]: number } = {};
            if (this.colResizerLeftCol != "task") {
                diff[this.colResizerLeftCol] = parseInt(this.$colResizerLeftCols.css("width"));
                this.model.colWidths[this.colResizerLeftCol] = diff[this.colResizerLeftCol];
            }
            if (this.colResizerRightCol != "task") {
                diff[this.colResizerRightCol] = parseInt(this.$colResizerRightCols.css("width"));
                this.model.colWidths[this.colResizerRightCol] = diff[this.colResizerRightCol];
            }
            this.triggerEvent("setColWidths", JSON.stringify(diff));
            this.updateTaskHeights();
            return;
        }
        
        $(document).on("mouseup", this.onColResizerDocumentMouseUpBound);
        $(document).on("mousemove", this.onColResizerDocumentMouseMoveBound);
    }
    
    onColResizerDocumentMouseUp(e: MouseEvent): void {
        $(document).off("mouseup", this.onColResizerDocumentMouseUpBound);
        $(document).off("mousemove", this.onColResizerDocumentMouseMoveBound);
        setTimeout(() => {
            this.preventSort = false;
        }, 100);
        let diff: { [key: string]: number } = {};
        if (this.colResizerLeftCol != "task") {
            diff[this.colResizerLeftCol] = parseInt(this.$colResizerLeftCols.css("width"));
            this.model.colWidths[this.colResizerLeftCol] = diff[this.colResizerLeftCol];
        }
        if (this.colResizerRightCol != "task") {
            diff[this.colResizerRightCol] = parseInt(this.$colResizerRightCols.css("width"));
            this.model.colWidths[this.colResizerRightCol] = diff[this.colResizerRightCol];
        }
        this.triggerEvent("setColWidths", JSON.stringify(diff));
        this.updateTaskHeights();
    }
    
    onColResizerDocumentMouseMove(e: MouseEvent): void {
        let dx = e.clientX - this.colResizerClient0;
        let newPos = Math.min(this.colResizerPosMax, Math.max(this.colResizerPosMin, this.colResizerPos0 + dx));
        if (this.colResizerLeftCol != "task") {
            this.$colResizerLeftCols.css("width", newPos);
        }
        if (this.colResizerRightCol != "task") {
            this.$colResizerRightCols.css("width", this.colResizerPos1 - (newPos - this.colResizerPos0));
        }
    }
    
    onCutClick(): void {
        this.cutSelectedTasks();
    }
    
    onCopyClick(): void {
        this.copySelectedTasks();
    }
    
    onPasteClick(): void {
        this.pasteTasksIntoSelection();
    }
    
    onMoveClick(e: MouseEvent): void {
        if (this.$container.hasClass("no-taskgroups") || this.$container.hasClass("no-task-selected")) {
            return;
        }
        if (this.model.combinesMultipleSections) {
            return;
        }
        this.moveTasks();
    }
    
    onShowHiddenTasksClick(e: MouseEvent): void {
        this.settingChanged("show-orphans", true, true);
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if ((e.key == "x" || e.key == "X") && (e.ctrlKey || e.metaKey)) {
            // Ctrl+X
            e.stopPropagation();
            this.cutSelectedTasks();
        }
        else if ((e.key == "c" || e.key == "C") && (e.ctrlKey || e.metaKey)) {
            // Ctrl+C
            e.stopPropagation();
            this.copySelectedTasks();
        }
        else if ((e.key == "v" || e.key == "V") && (e.ctrlKey || e.metaKey)) {
            // Ctrl+V
            e.stopPropagation();
            this.pasteTasksIntoSelection();
        }
        else if (e.key == "Delete") {
            this.lockSelection();
            e.stopPropagation();
            this.triggerEvent("deleteTasks", JSON.stringify(this.selectedTasks));
        }
        else if (e.key == "ArrowUp" || e.key == "ArrowDown") {
            if (this.taskSelectionLocked) {
                return;
            }
            e.stopPropagation();
            
            let down = e.key == "ArrowDown";
            let id: number;
            if (e.shiftKey) {
                if (e.altKey) {
                    down = !down;
                }
                id = down ? this.getLastSelectionEntryId() : this.getFirstSelectionEntryId();
                if (id < 0) {
                    id = this.getPointerEntryId();
                }
                if (!e.altKey) {
                    id = this.getClosestTaskEntryId(id, (down ? 1 : -1));
                }
            }
            else {
                id = this.getClosestTaskEntryId(this.getPointerEntryId(), (down ? 1 : -1));
            }
            let ptr = this.getPointerFromId(id);
            if (ptr != null) {
                let taskFullId = ptr.projectId + "/" + ptr.taskGroupId + "/" + ptr.taskId;
                Q().then(() => {
                    if (this.previewDirty) {
                        this.previewExit = Q.defer();
                        this.triggerEvent("confirmPreviewExit");
                        return this.previewExit.promise;
                    }
                }).then(() => {
                    if (e.shiftKey) {
                        if (e.altKey) {
                            // Shrink range
                            this.deselectTask(taskFullId);
                        }
                        else {
                            // Extend range
                            this.selectTask(taskFullId, false);
                        }
                    }
                    else {
                        // Select only this one
                        this.selectTask(taskFullId, true);
                    }
                    
                    this.fastList.scrollTo(ptr.entryId);
                    
                    this.pointer = ptr;
                    this.updateClasses();
                    this.renderFastList();
                    this.notifySelectionChanged();
                });
            }
        }
        else if (e.key == "Enter") {
            // Enter open selected task
            e.stopPropagation();
            if (this.selectedTasks.length == 1) {
                this.triggerEvent("openTaskWindow", this.selectedTasks[0].split("/")[2], true);
            }
        }
        else if (e.key == "Escape") {
            // Escape - deselect all tasks, cancel cut
            e.stopPropagation();
            if (this.getClipboardIsCut()) {
                this.updateClipboard(this.getClipboardTasks(), false);
            }
            this.updateClasses();
            Q().then(() => {
                if (this.previewDirty) {
                    this.previewExit = Q.defer();
                    this.triggerEvent("confirmPreviewExit");
                    return this.previewExit.promise;
                }
            }).then(() => {
                this.deselectTasks(this.getSelectedTaskIds());
                this.updateClasses();
                this.renderFastList();
                this.notifySelectionChanged();
            });
        }
    }
    
    confirmPreviewExit(): void {
        if (this.previewExit) {
            this.previewExit.resolve();
        }
    }
    
    onEntryMouseOver(e: MouseEvent) {
        let entry = this.getEntry(<HTMLElement>e.currentTarget);
        if (!entry.data.context) {
            return;
        }
        let str = entry.data.context.projectId + "/" + entry.data.context.taskGroupId;
        if (this.hoverTaskGroup != str) {
            this.hoverTaskGroup = str;
            this.updateHoverTaskGroup();
        }
    }
    
    onEntryMouseOut(e: MouseEvent) {
        let entry = this.getEntry(<HTMLElement>e.currentTarget);
        if (!entry.data.context) {
            return;
        }
        if (this.hoverTaskGroup == entry.data.context.projectId + "/" + entry.data.context.taskGroupId) {
            this.hoverTaskGroup = null;
            this.updateHoverTaskGroup();
        }
    }
    
    updateHoverTaskGroup() {
        for (let id in this.visibleTaskGroupElements) {
            let el = this.visibleTaskGroupElements[id];
            el.classList.toggle("hover", this.hoverTaskGroup == id);
        }
    }
    
    getEntry(el: HTMLElement): FastListEntry<EntryModel> {
        let id = Number(el.dataset.entryId);
        return this.fastList.entries[id];
    }
    
    onTgBadgeMouseEnter(e: MouseEvent): void {
        if (!this.model.settings["show-all-other-list-names"]) {
            $(e.currentTarget).closest(".task-taskgroups-badges").addClass("hover");
        }
    }
    
    onTgBadgeMouseLeave(e: MouseEvent): void {
        $(e.currentTarget).removeClass("hover");
    }
    
    
    
    
    
    /****************************************
    ******** Activation/deactivation ********
    *****************************************/
    activate() {
        this.isActive = true;
        Q().then(() => {
            this.repaint();
            if (!this.isContainerReady()) {
                return this.repaintWhenReady();
            }
        });
    }
    
    deactivate() {
        this.isActive = false;
    }
    
    
    
    
    
    /****************************************
    **************** Search *****************
    *****************************************/
    applySearchFilter(searchFilter: string): void {
        this.currSearchFilter = searchFilter;
        if (this.isActive) {
            this.updateFastListEntries();
            this.renderFastList();
        }
    }
    
    
    
    
    
    /****************************************
    *************** Selection ***************
    *****************************************/
    getSelectedTaskIds(): Array<string> {
        return this.selectedTasks;
    }

    getFirstSelectedTaskGroupIds(): [string, string] {
        let first: [string, string] = null;
        for (let entryId = 0, len = this.fastList.entries.length; entryId < len; ++entryId) {
            let entry = this.fastList.entries[entryId];
            if (entry && entry.data.task) {
                if (!first) {
                    first = [entry.data.context.projectId, entry.data.context.taskGroupId];
                }
                let fullTaskId = entry.data.context.projectId + "/" + entry.data.context.taskGroupId + "/" + entry.data.task.id;
                if (this.isTaskSelected(fullTaskId) && !this.isTaskCut(fullTaskId)) {
                    return [entry.data.context.projectId, entry.data.context.taskGroupId];
                }
            }
        }
        return first;
    }
    lockSelection() {
        this.taskSelectionLocked = true;
    }
    
    unLockSelection() {
        this.taskSelectionLocked = false;
    }
    
    selectTask(taskFullId: string, deselectOthers: boolean): void {
        if (deselectOthers) {
            this.deselectTasks(this.getSelectedTaskIds());
        }
        this.selectTasks([taskFullId], deselectOthers);
    }
    
    selectTasks(tasksFullIds: string[], clearSelection: boolean): void {
        if (clearSelection) {
            this.selectedTasks = [];
        }
        for (let taskFullId of tasksFullIds) {
            if (!this.isTaskSelected(taskFullId)) {
                this.selectedTasks.push(taskFullId);
            }
        }
    }
    
    deselectTask(taskFullId: string): void {
        this.deselectTasks([taskFullId]);
    }
    
    deselectTasks(tasksFullIds: string[]): void {
        let updateFastListEntries = false;
        let arr: string[] = [];
        let filter = <Filter>this.model.settings[this.isKanban() ? "kanban-filter" : "filter"];
        for (let selectedTaskFullId of this.selectedTasks) {
            if (tasksFullIds.indexOf(selectedTaskFullId) < 0) {
                arr.push(selectedTaskFullId);
            }
            else {
                if (filter == Filter.onlyUnread) {
                    updateFastListEntries = true;
                }
            }
        }
        this.selectedTasks = arr;
        if (updateFastListEntries) {
            this.updateFastListEntries();
        }
    }
    
    isTaskSelected(taskFullId: string): boolean {
        return this.selectedTasks.indexOf(taskFullId) >= 0;
    }
    
    isTaskSelectedInAnyRow(taskId: string): boolean {
        let searchStr = "/" + taskId;
        for (let i = 0; i < this.selectedTasks.length; ++i) {
            let id = this.selectedTasks[i];
            if (id.lastIndexOf(searchStr) == id.length - searchStr.length) {
                return true;
            }
        }
        return false;
    }
    
    toggleTaskSelection(taskFullId: string): void {
        if (this.isTaskSelected(taskFullId)) {
            this.deselectTask(taskFullId);
        }
        else {
            this.selectTask(taskFullId, false);
        }
    }
    
    selectRange(entryId0: number, entryId1: number): void {
        if (entryId0 == entryId1) {
            this.selectTaskByEntryId(entryId0);
            return;
        }
        let a = Math.min(entryId0, entryId1);
        let b = Math.max(entryId0, entryId1);
        for (let i = a; i <= b; ++i) {
            this.selectTaskByEntryId(i);
        }
    }
    
    selectTaskByEntryId(entryId: number) {
        let entry = this.fastList.entries[entryId];
        if (entry && entry.data.task) {
            this.selectTask(entry.data.context.projectId + "/" + entry.data.context.taskGroupId + "/" + entry.data.task.id, false);
        }
    }
    
    getPointerEntryId(): number {
        let p = this.pointer;
        let e = this.fastList.entries[p.entryId];
        
        // If the list was not changed, return the entry id
        if (e) {
            if (e.data.tasksByStatus) {
                for (let status in e.data.tasksByStatus) {
                    let task = e.data.tasksByStatus[status];
                    if (task && task.context.projectId == p.projectId && task.context.taskGroupId == p.taskGroupId && task.task && task.task.id == p.taskId) {
                        return p.entryId;
                    }
                }
            }
            else {
                if (e.data.context.projectId == p.projectId && e.data.context.taskGroupId == p.taskGroupId && e.data.task && e.data.task.id == p.taskId) {
                    return p.entryId;
                }
            }
        }
        
        // The list was changed, find the new entry
        e = null;
        let id: number = 0;
        let firstTaskEntryId: number = -1;
        for (id = this.fastList.entries.length - 1; id >= 0; --id) {
            let x = this.fastList.entries[id];
            if (x.data.task) {
                firstTaskEntryId = id;
                if (x.data.task.id == p.taskId && x.data.context.taskGroupId == p.taskGroupId && x.data.context.projectId == p.projectId) {
                    e = x;
                    break;
                }
            }
            else if (x.data.tasksByStatus) {
                firstTaskEntryId = id;
                for (let status in x.data.tasksByStatus) {
                    let task = x.data.tasksByStatus[status];
                    if (task && task.task.id == p.taskId && task.context.taskGroupId == p.taskGroupId && task.context.projectId == p.projectId) {
                        return p.entryId;
                    }
                }
            }
        }
        if (e) {
            // The task is still there, return new entry's id
            return id;
        }
        else {
            // Task doesn't exist anymore, use first task id
            return firstTaskEntryId;
        }
    }
    
    getPointerFromId(id: number): TaskPointer {
        let entry = this.fastList.entries[id];
        if (!entry || !entry.data.task) {
            return null;
        }
        return {
            entryId: id,
            projectId: entry.data.context.projectId,
            taskGroupId: entry.data.context.taskGroupId,
            taskId: entry.data.task.id,
        };
    }
    
    getClosestTaskEntryId(id: number, step: number): number {
        while (true) {
            id += step;
            let entry = this.fastList.entries[id];
            if (!entry) {
                return -1;
            }
            if (entry.data.task) {
                return id;
            }
        }
    }
    
    getFirstSelectionEntryId(): number {
        for (let entryId = 0, len = this.fastList.entries.length; entryId < len; ++entryId) {
            let entry = this.fastList.entries[entryId];
            if (entry.data.task) {
                let fullTaskId = entry.data.context.projectId + "/" + entry.data.context.taskGroupId + "/" + entry.data.task.id;
                if (this.selectedTasks.indexOf(fullTaskId) >= 0) {
                    return <any>entryId;
                }
            }
        }
        return -1;
    }
    
    getLastSelectionEntryId(): number {
        for (let entryId = this.fastList.entries.length - 1; entryId >= 0; --entryId) {
            let entry = this.fastList.entries[entryId];
            if (entry.data.task) {
                let fullTaskId = entry.data.context.projectId + "/" + entry.data.context.taskGroupId + "/" + entry.data.task.id;
                if (this.selectedTasks.indexOf(fullTaskId) >= 0) {
                    return <any>entryId;
                }
            }
        }
        return -1;
    }
    
    buildPointer(el: HTMLElement): TaskPointer {
        let entry = this.getEntry(el);
        let ptr: TaskPointer = null;
        if (entry) {
            ptr = {
                entryId: Number(el.dataset.entryId),
                taskId: entry.data.task.id,
                taskGroupId: entry.data.context.taskGroupId,
                projectId: entry.data.context.projectId,
            };
        }
        else if (el.classList.contains("kanban-task-box-content")) {
            if (el.classList.contains("empty")) {
                return null;
            }
            let [projectId, taskGroupId, taskId] = el.dataset.taskFullId.split("/");
            ptr = {
                entryId: Number(el.parentElement.parentElement.dataset.entryId),
                taskId: taskId,
                taskGroupId: taskGroupId,
                projectId: projectId,
            };
        }
        return ptr;
    }
    
    notifySelectionChanged(): void {
        this.triggerEvent("selectionChanged", JSON.stringify(this.selectedTasks));
    }
    
    
    
    
    /****************************************
    ************ Cut/copy/paste *************
    *****************************************/
    isTaskCut(taskId: string): boolean {
        return this.getClipboardIsCut() && this.isTaskInClipboard(taskId);
    }
    
    cutSelectedTasks(): void {
        this.cutTasks(this.getSelectedTaskIds());
        this.triggerEvent("notifyTasksCut", this.getClipboardTasksCount());
    }
    
    copySelectedTasks(): void {
        this.copyTasks(this.getSelectedTaskIds());
        this.triggerEvent("notifyTasksCopied", this.getClipboardTasksCount());
        this.triggerEvent("copyTasksToClipboard", JSON.stringify(this.getSelectedTaskIds()));
    }
    
    pasteTasksIntoSelection(): void {
        this.triggerEvent("paste");
    }
    
    doPasteTasksIntoSelection(): void {
        if (this.isClipboardEmpty()) {
            return;
        }
        let data = this.getFirstSelectedTaskGroupIds();
        if (!data) {
            return;
        }
        let [pId, tgId] = data;
        if (this.isInRecentlyModifiedMode()) {
            tgId = "__orphans__";
        }
        this.pasteTasks(tgId, pId);
    }

    moveTasks(): void {
        this.triggerEvent("moveTasks", JSON.stringify(this.getSelectedTaskIds()));
    }
    
    cutTasks(taskIds: Array<string>) {
        this.addToClipboard(taskIds, true);
        this.updateClasses();
        this.renderFastList();
    }
    
    copyTasks(taskIds: Array<string>) {
        this.addToClipboard(taskIds, false);
        this.updateClasses();
    }
    
    pasteTasks(taskGroupId: string, projectId: string) {
        if (this.isClipboardEmpty()) {
            return;
        }
        
        if (this.getClipboardIsCut()) {
            this.triggerEvent("changeTasksParent", JSON.stringify(this.getClipboardTasks()), taskGroupId, projectId);
            this.updateClipboard(this.getClipboardTasks(), false);
            this.updateClasses();
        }
        else {
            this.triggerEvent("duplicateTasks", JSON.stringify(this.getClipboardTasks()), taskGroupId, projectId);
        }
        setTimeout(() => {
            $("tr.cut").removeClass("cut");
        }, 250);
    }
    
    
    
    
    
    
    /****************************************
    ***************** Data ******************
    *****************************************/
    setTask(taskModelStr: string, height: number): void {
        // console.log(`[${new Date().getSeconds()}.${new Date().getMilliseconds()}] setTask`);
        let taskModel: TaskModel = JSON.parse(taskModelStr);
        this.model.tasks[taskModel.id] = taskModel;
        if (height !== null) {
            this.tasksLines[taskModel.id] = height;
        }
        // this.repaint();
        this.lazyRenderScheduler.schedule();
    }
    
    setTaskGroup(taskGroupModelStr: string): void {
        // console.log(`[${new Date().getSeconds()}.${new Date().getMilliseconds()}] setTaskGroup`);
        let taskGroupModel: TaskGroupModel = JSON.parse(taskGroupModelStr);
        this.model.taskGroups[taskGroupModel.id] = taskGroupModel;
        // this.repaint();
        this.lazyRenderScheduler.schedule();
    }
    
    setProject(projectModelStr: string): void {
        // console.log(`[${new Date().getSeconds()}.${new Date().getMilliseconds()}] setProject`);
        let projectModel: ProjectModel = JSON.parse(projectModelStr);
        this.model.projects[projectModel.id] = projectModel;
        // this.repaint();
        this.lazyRenderScheduler.schedule();
    }
    
    delTask(taskId: string): void {
        if (!(taskId in this.model.tasks)) {
            return;
        }
        delete this.model.tasks[taskId];
        this.repaint();
    }
    
    delTaskGroup(taskGroupId: string): void {
        delete this.model.taskGroups[taskGroupId];
        this.repaint();
    }
    
    delProject(projectId: string): void {
        delete this.model.projects[projectId];
        this.repaint();
    }
    
    
    
    
    
    
    /****************************************
    ************** Col widths ***************
    *****************************************/
    setColWidths(colWidthsData: string|{ [key: string]: number }): void {
        if (!this.$container) {
            return;
        }
        let colWidths: { [key: string]: number } = typeof(colWidthsData) == "string" ? JSON.parse(colWidthsData) : colWidthsData;
        for (let k in colWidths) {
            let w = colWidths[k];
            let $el = this.$container.find("col[data-col='" + k + "']");
            if ($el) {
                $el.css("width", w);
            }
        }
    }
    
    
    
    
    
    
    /****************************************
    **************** Unreads ****************
    *****************************************/
    updateUnread(unreadTaskIdsStr: string, unreadTaskGroupIdsStr: string): void {
        let unreadTaskIds: { [id: string]: boolean } = JSON.parse(unreadTaskIdsStr);
        let unreadTaskGroupIds: { [id: string]: boolean } = JSON.parse(unreadTaskGroupIdsStr);
        for (let tId in unreadTaskIds) {
            let t = this.model.tasks[tId];
            if (t) {
                t.unread = unreadTaskIds[tId];
            }
        }
        for (let tgId in unreadTaskGroupIds) {
            let tg = this.model.taskGroups[tgId];
            if (tg) {
                tg.withUnread = unreadTaskGroupIds[tgId];
            }
        }
        this.repaint();
    }
    
    
    
    
    
    
    /****************************************
    ************* Font metrics **************
    *****************************************/
    getTaskTextAvailableWidth(): number {
        let w = this.$container.width();
        w -= 6;
        for (let col in this.model.colWidths) {
            let visible = !!this.model.settings["show-" + col + "-column"];
            if (!visible) {
                continue;
            }
            if (col == "hash-id" && !this.model.settings["show-task-numbers"]) {
                w -= 28;
            }
            else {
                w -= this.model.colWidths[col];
            }
        }
        w -= 10;
        
        return w;
    }
    
    updateTaskHeights(taskIds: string[] = null, updateEntries: boolean = true): Q.Promise<void> {
        if (!this.model.settings["show-full-task-descriptions"]) {
            return Q();
        }
        let w = this.getTaskTextAvailableWidth();
        if (taskIds === null) {
            if (w == this.prevTasksHeightRecalcAvailWidth) {
                return Q();
            }
            this.prevTasksHeightRecalcAvailWidth = w;
        }
        else {
            this.prevTasksHeightRecalcAvailWidth = null;
        }
        return this.channelPromise<string>("countTaskLines", taskIds ? JSON.stringify(taskIds) : null, w).then(linesStr => {
            let lines: { [id: string]: number } = JSON.parse(linesStr);
            if (taskIds) {
                for (let taskId of taskIds) {
                    this.tasksLines[taskId] = lines[taskId];
                }
            }
            else {
                this.tasksLines = lines;
            }
            if (updateEntries) {
                this.updateFastListEntries();
                this.renderFastList();
            }
        });
    }
    
    getTaskHeight(id: string): number {
        if (!this.model.settings["show-full-task-descriptions"] || !this.model.settings["show-task-column"]) {
            return this.fastListSettings.hTask;
        }
        let n = this.tasksLines[id];
        if (!n) {
            n = 1;
        }
        let h = this.fastListSettings.hTask;
        if (n > 1) {
            h += this.fastListSettings.hTask2ndLine;
            h += this.fastListSettings.hTaskNextLines * (n - 2);
        }
        return h;
    }
    
    onContainerWidthChanged(): void {
        if (!this.model) {
            return;
        }
        if (!this.model.settings["show-full-task-descriptions"]) {
            return;
        }
        this.updateTaskHeights(null, this.isActive);
    }
    
    onContainerHeightChanged(): void {
        if (!this.model || !this.isActive) {
            return;
        }
        this.renderFastList();
    }
    
    onContainerWidthChangedStep(): void {
        if (!this.model) {
            return;
        }
        if (!this.model.settings["show-full-task-descriptions"]) {
            return;
        }
        if (this._onContainerWidthChangedTO) {
            clearTimeout(this._onContainerWidthChangedTO);
            this._onContainerWidthChangedTO = null;
        }
        this._onContainerWidthChangedTO = setTimeout(() => {
            this.onContainerWidthChanged();
        }, 500);
        
        let start = this.fastList.visibleRange[0];
        let end = this.fastList.visibleRange[1];
        let delta = end - start + 1;
        start = Math.max(0, start - delta);
        end = Math.min(this.fastList.entries.length - 1, end + delta);
        let tIds: string[] = [];
        for (let i = start; i <= end; ++i) {
            let entry = this.fastList.entries[i];
            if (entry.data.task) {
                tIds.push(entry.data.task.id);
            }
        }
        this.updateTaskHeights(tIds, this.isActive);
    }
    
    onContainerHeightChangedStep(): void {
        if (!this.model || !this.isActive) {
            return;
        }
        this.renderFastList();
    }
    
    
    
    
    
    
    /****************************************
    **************** Filter *****************
    *****************************************/
    onFilterChange(value: string): void {
        if (!value) {
            return;
        }
        this.settingChanged(this.isKanban() ? "kanban-filter" : "filter", value);
    }
    
    meetsFilter(filter: Filter, task: TaskModel): boolean {
        if (filter == Filter.allTasks) {
            return true;
        }
        if (filter == Filter.onlyUnread) {
            if (!task.unread && this.isTaskSelectedInAnyRow(task.id)) {
                return true;
            }
            return task.unread;
        }
        if (filter == Filter.onlyIdea) {
            return task.status == TaskStatus.IDEA;
        }
        if (filter == Filter.onlyTodo) {
            return task.status == TaskStatus.TODO;
        }
        if (filter == Filter.onlyInProgress) {
            return task.status == TaskStatus.INPROGRESS;
        }
        if (filter == Filter.onlyDone) {
            return task.status == TaskStatus.DONE;
        }
        if (filter == Filter.onlyNotDone) {
            return task.status != TaskStatus.DONE;
        }
        return true;
    }
    
    updatePersonPresence(hashmail: string, present: boolean): void {
        this.$container.find("[data-person-hashmail='" + hashmail + "']").toggleClass("present", present);
    }
    
    
    
    
    /****************************************
    **************** Kanban *****************
    *****************************************/
    isKanban(): boolean {
        if (this.isSummaryWindow) {
            return false;
        }
        return !!this.getSetting("kanban-mode");
    }
    
    
    
    
    /****************************************
    *************** Clipboard ***************
    *****************************************/
    clipboardElementAddedAt: Date = null;
    clipboardData: TasksClipboardData = null;
    
    isClipboardEmpty(): boolean {
        return !this.clipboardData || this.clipboardData.fullTaskIds.length == 0;
    }
    
    getClipboardTasksCount(): number {
        return this.clipboardData ? this.clipboardData.fullTaskIds.length : 0;
    }
    
    getClipboardTasks(): string[] {
        return this.clipboardData ? this.clipboardData.fullTaskIds : [];
    }
    
    getClipboardIsCut(): boolean {
        return this.clipboardData ? this.clipboardData.isCut : false;
    }
    
    addToClipboard(fullTaskIds: string[], isCut: boolean): void {
        this.clipboardElementAddedAt = new Date();
        this.clipboardData = {
            type: "__privmx_tasks__",
            fullTaskIds: fullTaskIds,
            isCut: isCut,
        };
        this.triggerEvent("addToClipboard", JSON.stringify(this.clipboardData), this.clipboardElementAddedAt.getTime());
    }
    
    updateClipboard(fullTaskIds: string[], isCut: boolean): void {
        if (!this.clipboardData) {
            return;
        }
        this.clipboardData.fullTaskIds = fullTaskIds;
        this.clipboardData.isCut = isCut;
        this.triggerEvent("updateClipboard", JSON.stringify(this.clipboardData), this.clipboardElementAddedAt.getTime());
    }
    
    isTaskInClipboard(taskId: string): boolean {
        return this.getClipboardTasks().indexOf(taskId) >= 0;
    }
    
    updateFromClipboard(dataStr: string, addedAtTs: number, paste: boolean = false): void {
        let addedAt = new Date(addedAtTs);
        let clipboardData: TasksClipboardData = JSON.parse(dataStr);
        this.clipboardElementAddedAt = addedAt;
        this.clipboardData = clipboardData;
        if (paste) {
            this.doPasteTasksIntoSelection();
        }
    }
    
}
