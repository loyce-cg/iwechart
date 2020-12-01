import * as web from "pmc-web";
import { func as mainTemplate } from "./template/main.html";
import { func as taskGroupsPanelTemplate } from "./template/panel-taskgroups.html";
import { func as taskPanelTemplate } from "./template/panel-task.html";
import { Model, ProjectsModel, TaskGroupsModel, TasksWindowController } from "./TasksWindowController";
import Q = web.Q;
import $ = web.JQuery;
import { ProjectId, WatchedTasksMap, ProjectsMap, PersonId, PeopleMap, SinkInfo, CustomTasksElements } from "../../main/Types";
import { Task } from "../../main/data/Task";
import { Project } from "../../main/data/Project";
import { TaskGroup } from "../../main/data/TaskGroup";
import { TaskPanelView } from "../../component/taskPanel/TaskPanelView";
import { TaskGroupsPanelView } from "../../component/taskGroupsPanel/TaskGroupsPanelView";
import { ConversationsCollection } from "pmc-mail/out/mail/conversation";
const ResizeObserverPolyfill = require("resize-observer-polyfill");

export interface ActionItemModel {
    id: string;
    labelKey: string;
    icon?: string;
    hidden?: boolean;
}

export interface ActionsModel {
    items: ActionItemModel[];
}

export interface ActiveProjectItems {
    taskGroups: Array<TaskGroup>;
    taskGroupsTasks: { [key: string]: Array<Task> };
}

export interface HostEntryModel {
    host: string;
    sectionsList: web.component.remotesectionlist.RemoteSectionListView;
    conv2List: web.component.remoteconv2list.RemoteConv2ListView;

}

const enum ACTIVE_PANEL {
    projects = 0,
    taskGroups = 1,
    task = 2,
}

const enum MOVE_TG_DST {
    top = -999999,
    up = -1,
    down = 1,
    bottom = 999999,
}

export class TasksWindowView extends web.window.base.BaseWindowView<Model> {
    
    static readonly SIDEBAR_MIN_WIDTH = 100;
    static readonly TGP_MIN_WIDTH = 300;
    static readonly TGP_MIN_HEIGHT = 100;
    static readonly PREVIEW_MIN_WIDTH = 100;
    static readonly PREVIEW_MIN_HEIGHT = 50;
    
    private _showTaskPanel: boolean;
    private _showOrphans: boolean;
    // private _activeProjectId: ProjectId;
    private _myId: PersonId;
    private _privateSectionId: string;
    private _members: PeopleMap;
    // projects: ProjectsMap;
    
    verticalSplitter: web.component.splitter.SplitterView;
    verticalSplitter2: web.component.splitter.SplitterView;
    horizontalSplitter: web.component.splitter.SplitterView;
    $fixedSections: JQuery;
    $standardSections: JQuery;
    $taskGroups: JQuery = null;
    $task: JQuery = null;
    $settingsMenu: JQuery;
    $tabbedTasks: JQuery;
    disabledSection: web.component.disabledsection.DisabledSectionView;
    $disabledSectionContainer: JQuery;
    
    taskGroupsPanels: { [key: string]: TaskGroupsPanelView } = {};
    
    dropdown: web.component.dropdown.Dropdown<ActionsModel>;
    
    dragDropContainerTop: number;
    dragDropContainerBottom: number;
    $dragDropScrollable: JQuery;
    
    taskPanel: TaskPanelView;
    sectionsList: web.component.sectionlist.SectionListView;
    remoteServers: {[hostHash: string]: HostEntryModel} = {};

    sidebar: web.component.sidebar.SidebarView;
    personsComponent: web.component.persons.PersonsView;
    personTooltip: web.component.persontooltip.PersonTooltipView;
    notifications: web.component.notification.NotificationView;
    infoTooltip: web.component.infotooltip.InfoTooltip;
    sectionTooltip: web.component.sectiontooltip.SectionTooltipView;
    initializedDeferred: Q.Deferred<void> = Q.defer();
    needsCustomSelectsFlashing: boolean = false;
    
    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
        
        if (!(<any>window).ResizeObserver) {
            (<any>window).ResizeObserver = ResizeObserverPolyfill;
        }
        
        this.verticalSplitter = this.addComponent("verticalSplitter", new web.component.splitter.SplitterView(this, {
            type: "vertical",
            handlePlacement: "right",
            handleDot: true,
            firstPanelMinSize: TasksWindowView.SIDEBAR_MIN_WIDTH,
            secondPanelMinSize: () =>  {
                if (!this.verticalSplitter2 || !this.verticalSplitter2.$right || this.verticalSplitter2.$right.children().length == 0 || !this._showTaskPanel) {
                    return TasksWindowView.TGP_MIN_WIDTH;
                }
                return TasksWindowView.TGP_MIN_WIDTH + this.verticalSplitter2.$right.outerWidth();
            },
        }));
        this.verticalSplitter2 = this.addComponent("verticalSplitter2", new web.component.splitter.SplitterView(this, {
            type: "vertical",
            handlePlacement: "right",
            flip: true,
            handleDot: true,
            firstPanelMinSize: TasksWindowView.TGP_MIN_WIDTH,
            secondPanelMinSize: TasksWindowView.PREVIEW_MIN_WIDTH,
        }));
        this.horizontalSplitter = this.addComponent("horizontalSplitter", new web.component.splitter.SplitterView(this, {
            type: "horizontal",
            handlePlacement: "bottom",
            flip: true,
            handleDot: true,
            firstPanelMinSize: TasksWindowView.TGP_MIN_HEIGHT,
            secondPanelMinSize: TasksWindowView.PREVIEW_MIN_HEIGHT,
        }));
        this.verticalSplitter.addEventListener("handleUp", event => {
            for (let id in this.taskGroupsPanels) {
                this.taskGroupsPanels[id].onContainerWidthChanged();
            }
        });
        this.verticalSplitter2.addEventListener("handleUp", event => {
            for (let id in this.taskGroupsPanels) {
                this.taskGroupsPanels[id].onContainerWidthChanged();
            }
        });
        this.horizontalSplitter.addEventListener("handleUp", event => {
            for (let id in this.taskGroupsPanels) {
                this.taskGroupsPanels[id].onContainerHeightChanged();
            }
        });
        this.verticalSplitter.addEventListener("handleMove", event => {
            for (let id in this.taskGroupsPanels) {
                this.taskGroupsPanels[id].onContainerWidthChangedStep();
            }
        });
        this.verticalSplitter2.addEventListener("handleMove", event => {
            for (let id in this.taskGroupsPanels) {
                this.taskGroupsPanels[id].onContainerWidthChangedStep();
            }
        });
        this.horizontalSplitter.addEventListener("handleMove", event => {
            for (let id in this.taskGroupsPanels) {
                this.taskGroupsPanels[id].onContainerHeightChangedStep();
            }
        });
        window.addEventListener("resize", this.onWindowResize.bind(this));
        
        this.personsComponent = this.addComponent("personsComponent", new web.component.persons.PersonsView(this, this.helper));
        this.taskPanel = this.addComponent("taskPanel", new TaskPanelView(this, this.personsComponent));

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
        this.sidebar.customElementList.customElements.addEventListener("ext-list-change", this.refreshAvatars.bind(this));
        this.sidebar.customElementList.customElementsA.addEventListener("ext-list-change", this.refreshAvatars.bind(this));
        this.turnTimeAgoRefresher(5 * 60 * 1000);
    }
    
    onAfterRenderCustomList(): void {
        this.personsComponent.refreshAvatars();
    }
    
    initWindow(model: Model): any {
        this.personsComponent.$main = this.$main;
        this.personTooltip.init(this.$main);
        
        this.setModel(model);
        
        this.$settingsMenu = this.$main.find(".context-menu-settings");
        
        this.renderAll();
        
        this.taskPanel.$container = this.$task.children().eq(0);
        this.taskPanel.triggerInit();
        
        this.$taskGroups.on("click", this.onTaskGroupsPanelClick.bind(this));
        this.$task.on("click", this.onTaskPanelClick.bind(this));
        this.bindKeyboardEvents();
        
        if (this.getShowTaskPanel()) {
            this.$main.children(".right-buttons").children().addClass("gray");
        }
        else {
            this.$main.children(".right-buttons").children().removeClass("gray");
        }
        
        this.notifications.$container = this.$taskGroups.find(".notifications-container-wrapper");
        
        return Q().then(() => {
            this.verticalSplitter.$container = this.$main.find(".panels");
            return this.verticalSplitter.triggerInit();
        })
        .then(() => {
            this.$tabbedTasks = $("<div class='section-tasks'></div>");
            this.verticalSplitter.$right.append(this.$tabbedTasks);
            this.verticalSplitter2.$container = this.$tabbedTasks;
            return this.verticalSplitter2.triggerInit();
        })
        .then(() => {
            this.$disabledSectionContainer = $("<div class='disabled-section hidden'></div>");
            this.verticalSplitter.$right.append(this.$disabledSectionContainer);
            this.disabledSection.$container = this.$disabledSectionContainer;
            this.disabledSection.triggerInit();
        })
        .then(() => {
            this.horizontalSplitter.$container = this.verticalSplitter2.$left;
            return this.horizontalSplitter.triggerInit();
        })
        .then(() => {
            this.horizontalSplitter.$top.append(this.$taskGroups);
            if (!this.getShowTaskPanel()) {
                this.hideTaskPanel();
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
            this.sidebar.$container.on("click", this.onProjectsPanelClick.bind(this));
            return this.sidebar.triggerInit();
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
            this.sectionTooltip.refreshAvatars = this.refreshAvatars.bind(this);
            this.sidebar.usersListTooltip.refreshAvatars = this.refreshAvatars.bind(this);
            this.sectionTooltip.$container = this.$main;
            return this.sectionTooltip.triggerInit();
        });
    }
    
    checkInit(): Q.Promise<void> {
        return this.initializedDeferred.promise;
    }
    
    setModel(model: Model) {
        // this._activeProjectId = model.activeProjectId;
        this._myId = model.myId;
        this._privateSectionId = model.privateSectionId;
        this._members = JSON.parse(model.membersStr);
        
        let fMkObj = (str: string, cls: any) => {
            let tmp = JSON.parse(str);
            let obj: any = {};
            for (let id in tmp) {
                obj[id] = new cls(tmp[id]);
            }
            return obj;
        };
        
        // this.projects = fMkObj(model.projectsStr, Project);
        
        // this.updateProjectProps();
    }
    
    getShowTaskPanel(): boolean {
        return this._showTaskPanel;
    }
    setShowTaskPanel(value: boolean) {
        this._showTaskPanel = value;
    }
    
    getShowOrphans(): boolean {
        return this._showOrphans;
    }
    setShowOrphans(value: boolean) {
        this._showOrphans = value;
    }
    
    // getActiveProjectId(): ProjectId {
    //     return this._activeProjectId;
    // }
    // setActiveProjectId(value: ProjectId) {
    //     if (this._activeProjectId != value) {
    //         this.needsCustomSelectsFlashing = true;
    //     }
    //     this._activeProjectId = value;
    //     this.triggerEvent("setActiveProjectId", value);
    // }
    
    getMyId(): PersonId {
        return this._myId;
    }
    
    getPrivateSectionId(): ProjectId {
        return this._privateSectionId;
    }
    
    getMembers(): PeopleMap {
        return this._members;
    }
    
    // updateProjectProps(): void {
    //     if (this.showsFixedSection() && !this.showsOnlyPrivateTasks()) {
    //         this.$main.addClass("shows-fixed-section");
    //     }
    //     else {
    //         this.$main.removeClass("shows-fixed-section");
    //     }
    // }
    
    // hasActiveProject(): boolean {
    //     return (this.getActiveProjectId() && this.getActiveProjectId() in this.projects);
    // }
    
    // showsOnlyTasksAssignedToMe(): boolean {
    //     return this.getActiveProjectId() == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID;
    // }
    
    // showsOnlyTasksCreatedByMe(): boolean {
    //     return this.getActiveProjectId() == CustomTasksElements.TASKS_CREATED_BY_ME_ID;
    // }
    
    // showsOnlyAllTasks(): boolean {
    //     return this.getActiveProjectId() == CustomTasksElements.ALL_TASKS_ID;
    // }
    
    // showsOnlyTrash(): boolean {
    //     return this.getActiveProjectId() == CustomTasksElements.TRASH_ID;
    // }
    
    // showsOnlyPrivateTasks(): boolean {
    //     return this.getActiveProjectId() == this.getPrivateSectionId();
    // }
    
    // showsFixedSection(): boolean {
    //     let fixedSectionsNames = [
    //         CustomTasksElements.ALL_TASKS_ID,
    //         CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
    //         CustomTasksElements.TASKS_CREATED_BY_ME_ID,
    //         CustomTasksElements.TRASH_ID,
    //         this.getPrivateSectionId(),
    //     ];
    //     return fixedSectionsNames.indexOf(this.getActiveProjectId()) >= 0;
    // }
    
    toggleDisabledSection(show: boolean): void {
        this.$tabbedTasks.toggleClass("hidden", show);
        this.$disabledSectionContainer.toggleClass("hidden", !show);
    }
    
    hideContainer(id: string): void {
        this.$main.find(".taskgroupspanel-container[data-id='" + id + "']").removeClass("active");
        this.$main.find(".section-tasks").toggleClass("hidden", this.$main.find(".taskgroupspanel-container.active").length == 0);
    }
    
    renderAll(): void {
        this.renderTaskGroupsPanel();
        this.renderTaskPanel();
    }
    
    renderTaskGroupsPanel(): void {
        if (this.$taskGroups == null) {
            this.$taskGroups = this.templateManager.createTemplate(taskGroupsPanelTemplate).renderToJQ(this.getTaskGroupsModel());
        }
    }
    
    getUserAvatar(id: string = null) {
        if (id === null) {
            id = this.getMyId();
        }
        let s = this.helper.escapeHtml(this.getMembers()[id].avatar);
        return '<canvas class="not-rendered icon" data-auto-refresh="true" data-auto-size="true" data-hashmail-image="' + s + '" data-tooltip-trigger="' + s + '"></canvas>';
    }
    
    renderTaskPanel(): void {
        if (this.$task != null) {
            return;
        }
        this.$task = $("<div class=\"task-scrollable\" data-cs-container=\"1\"></div>").append(this.templateManager.createTemplate(taskPanelTemplate).renderToJQ());
        this.$task.find(".panel-task").append(this.taskPanel.$main);
    }
    
    getProjectsModel(): ProjectsModel {
        return {
        };
    }
    
    getTaskGroupsModel(): TaskGroupsModel {
        return {};
    }
    
    showTaskPanel(): void {
        this.$taskGroups.parent().addClass("show-task-panel");
        this.$taskGroups.parent().removeClass("hide-task-panel");
        this.$taskGroups.parent().closest(".component-splitter-panel-left").addClass("show-task-panel");
        this.$taskGroups.parent().closest(".component-splitter-panel-left").removeClass("hide-task-panel");
        this.fixPanelsArrangement();
    }
    
    hideTaskPanel(): void {
        this.$taskGroups.parent().removeClass("show-task-panel");
        this.$taskGroups.parent().addClass("hide-task-panel");
        this.$taskGroups.parent().closest(".component-splitter-panel-left").removeClass("show-task-panel");
        this.$taskGroups.parent().closest(".component-splitter-panel-left").addClass("hide-task-panel");
    }
    
    changeTaskPanelVisibility(show: boolean) {
        if (this.getShowTaskPanel() == show) {
            return;
        }
        this.setShowTaskPanel(show);
        if (show) {
            this.showTaskPanel();
        }
        else {
            this.hideTaskPanel();
        }
    }
    
    onProjectClick(e: MouseEvent): void {
        // console.log("TasksWindowView - onProjectClick");
        let $proj = $(e.currentTarget);
        if ($proj.hasClass("active")) {
            return;
        }
        this.triggerEvent("selectProject", $proj.data("project-id"));
    }
    
    onSectionClick(e: MouseEvent): void {
        let $proj = $(e.currentTarget);
        if ($proj.hasClass("active")) {
            return;
        }
        this.triggerEvent("selectProject", $proj.data("section-id"));
    }
    
    fixPanelsArrangement(): void {
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
    
    scrollViewIfNeeded($elem: JQuery<HTMLElement>, up: boolean) {
        let H = $elem.offsetParent().height();
        let t = $elem[0].getBoundingClientRect().top;
        let p = $elem.position().top;
        let elemOffset = $elem.outerHeight() + Math.max(parseFloat($elem.css("margin-bottom")),  parseFloat($elem.css("margin-top")));

        if (up === false && t >= H) {
            $elem.offsetParent().scrollTop($elem.offsetParent().scrollTop() + elemOffset );
        }
        else if (up === true && p - elemOffset <= 0) {
            $elem.offsetParent().scrollTop($elem.offsetParent().scrollTop() - elemOffset );
        }
    }
    
    // onSelectTab(projectId: string, rootProjectId: string): void {
    //     this.setActiveProjectId(projectId);
    //     this.triggerEvent("settingChanged", "active-project-id", projectId);
    //     this.$main.find(".section-tasks").toggleClass("hidden", this.$main.find(".taskgroupspanel-container.active").length == 0);
    // }
    
    
    
    
    
    
    
    /****************************************
    *********** Focus management ************
    ****************************************/
    activePanelId: ACTIVE_PANEL = ACTIVE_PANEL.projects;
    
    focusNextPanel(): void {
        this.switchToPanel(this.activePanelId + 1, true);
    }
    
    focusPrevPanel(): void {
        this.switchToPanel(this.activePanelId - 1, true);
    }
    
    switchToPanel(id: number, showHighlight: boolean) {
        let max = this.getShowTaskPanel() ? 3 : 2;
        let newId = (id + max) % max;
        
        this.$main.find(".focus-highlight").remove();
        let $highlight = $('<div class="focus-highlight"></div>');
        
        let oldPanelId = this.activePanelId;
        this.activePanelId = newId < 0 ? newId + max : newId;
        if (showHighlight && oldPanelId != this.activePanelId) {
            let $neigh: JQuery = $();
            let $toFocus: JQuery = $();
            if (this.activePanelId == ACTIVE_PANEL.projects) {
                $toFocus = this.$main.find(".sidebar-container");
                $neigh = $toFocus.children(".sidebar").first();
            }
            else if (this.activePanelId == ACTIVE_PANEL.taskGroups) {
                $neigh = this.$taskGroups.children(".taskgroupspanel-container.active");
                $toFocus = $neigh.children(".panel");
            }
            else if (this.activePanelId == ACTIVE_PANEL.task) {
                $neigh = this.$task.children(".panel");
                $toFocus = $neigh;
            }
            $highlight.insertAfter($neigh);
            $toFocus.focus();
        }
        this.triggerEvent("switchToPanel", this.activePanelId);
        setTimeout(() => {
            $highlight.remove();
        }, 500);
    }
    
    grabFocus(highlight: boolean = true): void {
        let activePanel = this.activePanelId;
        this.activePanelId = activePanel == 0 ? activePanel + 1 : activePanel - 1;
        this.switchToPanel(activePanel, highlight);
    }
    
    onProjectsPanelClick(): void {
        this.switchToPanel(ACTIVE_PANEL.projects, false);
    }
    
    onTaskGroupsPanelClick(): void {
        this.switchToPanel(ACTIVE_PANEL.taskGroups, false);
    }
    
    onTaskPanelClick(): void {
        this.switchToPanel(ACTIVE_PANEL.task, false);
    }
    
    
    
    /****************************************
    ********** Smart modifications **********
    ****************************************/
    // addProject(project: Project|string) {
    //     // Ensure project is an object
    //     project = typeof(project) == "string" ? new Project(JSON.parse(project)) : project;
        
    //     // Add to model and DOM
    //     this.modelAddProject(project);
    //     this.visualAddProject(project);
    // }
    // modelAddProject(project: Project, refresh: boolean = false) {
    //     // If the taskgroup already exists, update. Otherwise add.
    //     if (project.getId() in this.projects) {
    //         this.modelUpdateProject(project);
    //     }
    //     else {
    //         this.projects[project.getId()] = project;
    //     }
    //     if (refresh) {
    //         //this.renderProjectsPanel();
    //     }
    // }
    // visualAddProject(project: Project) {
    //     // Ensure the project is not displayed already to avoid duplication
    //     this.visualDeleteProject(project.getId());
    // }
    
    // updateProject(project: Project|string) {
    //     // Ensure project is an object
    //     project = typeof(project) == "string" ? new Project(JSON.parse(project)) : project;
        
    //     // Update model and DOM
    //     this.modelUpdateProject(project);
    //     this.visualUpdateProject(project);
        
    //     // Update active project properties
    //     if (project.getId() == this.getActiveProjectId()) {
    //         this.updateProjectProps();
    //     }
    // }
    // modelUpdateProject(project: Project) {
    //     if (project.getId() in this.projects) {
    //         this.projects[project.getId()].updateObjectProperties(project);
    //     }
    //     else {
    //         this.modelAddProject(project);
    //     }
    // }
    // visualUpdateProject(project: Project) {
    // }
    
    // deleteProject(projectId: ProjectId) {
    //     this.modelDeleteProject(projectId);
    //     this.visualDeleteProject(projectId);
    // }
    // modelDeleteProject(projectId: ProjectId) {
    //     delete this.projects[projectId];
    // }
    // visualDeleteProject(projectId: ProjectId) {
    // }
    
    // updateProjectName(projectId: string, projectName: string): void {
    //     if (!(projectId in this.projects)) {
    //         return;
    //     }
    //     let project = new Project(this.projects[projectId]);
    //     project.setName(projectName);
    //     this.updateProject(project);
    // }
    
    // updateProjectBadge(id: string, unread: number) {
    //     let $proj = this.sidebar.$container.find(".wi-element[data-project-id='"+id+"'],.wi-element[data-section-id='"+id+"'],.wi-element[data-custom-element-id='"+id+"']");
    //     let $badge = $proj.find(".wi-element-badge");
    //     $proj.toggleClass("with-badge", unread > 0);
    //     if (unread == 0) {
    //         $badge.text("");
    //     }
    //     else {
    //         $badge.text(unread);
    //     }
    // }
    
    
    
    
    /****************************************
    ********* TaskGroupsPanel multi *********
    ****************************************/
    createTaskGroupsPanel(hostHash: string, projectId: string): TaskGroupsPanelView {
        // console.log("on createTaskGroupsPanel in view", projectId, hostHash)
        let tgPanelKey = this.getTaskGroupsPanelKey(hostHash, projectId);
        if (tgPanelKey in this.taskGroupsPanels) {
            return this.taskGroupsPanels[tgPanelKey];
        }
        let panel = this.addComponent("taskGroupsPanel-" + tgPanelKey, new TaskGroupsPanelView(this, this.personsComponent, true));
        let $container = $("<div class='taskgroupspanel-container' data-id='" + projectId + "' data-host-hash='" + hostHash + "'></div>");
        this.$taskGroups.append($container);
        panel.$container = $container;
        panel.triggerInit();
        // console.log("createTaskGroupsPanel done");
        this.taskGroupsPanels[tgPanelKey] = panel;
    }
    
    openTaskGroupsPanel(hostHash: string, projectId: string): void {
        let $containers = this.$taskGroups.find(".taskgroupspanel-container");
        let $container = $containers.filter("[data-id='" + projectId + "'][data-host-hash='" + hostHash + "']");
        $containers.removeClass("active");
        $container.addClass("active");
        this.$main.find(".section-tasks").toggleClass("hidden", this.$main.find(".taskgroupspanel-container.active").length == 0);
        if (this.needsCustomSelectsFlashing) {
            this.needsCustomSelectsFlashing = false;
            this.flashCustomSelects(hostHash, projectId);
        }
        this.triggerEvent("openedTaskGroupsPanel", hostHash, projectId);
    }
    
    getTaskGroupsPanelKey(hostHash: string, projectId: string): string {
        return `${hostHash}--${projectId}`;
    }
    
    
    
    
    
    onSearchChanged(searchOn: boolean, refreshAvatars: boolean) {
        if (refreshAvatars) {
            this.personsComponent.refreshAvatars();
        }
        this.$main.toggleClass("search-on", searchOn);
        this.sidebar.refreshInfoTooltips();
    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    updatePreviewLocation(horizontalLayout: boolean): void {
        let $horizontalSplitter = this.$taskGroups.parent();
        let $verticalSplitter = $horizontalSplitter.closest(".component-splitter-panel-left");
        $horizontalSplitter.toggleClass("show-preview", horizontalLayout);
        $horizontalSplitter.toggleClass("hide-preview", !horizontalLayout);
        $verticalSplitter.toggleClass("show-preview", !horizontalLayout);
        $verticalSplitter.toggleClass("hide-preview", horizontalLayout);
        if (horizontalLayout) {
            this.horizontalSplitter.$bottom.append(this.$task);
        }
        else {
            this.verticalSplitter2.$right.append(this.$task);
        }
        for (let id in this.taskGroupsPanels) {
            this.taskGroupsPanels[id].onContainerWidthChanged();
            this.taskGroupsPanels[id].onContainerHeightChanged();
        }
        this.fixPanelsArrangement();
    }
    
    onWindowResize(): void {
        for (let id in this.taskGroupsPanels) {
            this.taskGroupsPanels[id].onContainerWidthChangedStep();
            this.taskGroupsPanels[id].onContainerHeightChangedStep();
        }
    }
    
    flashCustomSelects(hostHash: string, projectId: string): void {
        let tgPanelKey = this.getTaskGroupsPanelKey(hostHash, projectId);
        let tgp = this.taskGroupsPanels[tgPanelKey];
        if (tgp) {
            tgp.$container.find(".top .component-custom-select-main").fadeOut(150).fadeIn(300);
        }
    }

    /////////////////////////////
    //// REMOTE SECTIONS ////////
    /////////////////////////////


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

}
