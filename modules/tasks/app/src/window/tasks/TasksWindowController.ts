import { window, component, Types, Q, utils, mail, privfs, app } from "pmc-mail";
import { TasksPlugin, UpdateSectionBadgeEvent, TasksComponentFactory, TaskPreviewRequestEvent, TaskPanelUpdateRequestEvent, TaskPanelChangeVisibilityRequestEvent, TasksSearchUpdateEvent, BadgesUpdateRequestEvent, UpdatePinnedTaskGroupsEvent, HorizontalTaskWindowLayoutChangeRequestEvent, MarkedTasksAsReadEvent, UpdateTasksSidebarSpinnersEvent } from "../../main/TasksPlugin";
import { Settings } from "pmc-web/out/utils";
import { ProjectsMap, ProjectId, TaskId, Watchable, Action, EventHandler, PersonId, SinkInfo, CustomTasksElements, PeopleMap } from "../../main/Types";
import { TaskPanelController } from "../../component/taskPanel/TaskPanelController";
import { ContainerWindowController } from "pmc-web/out/window/container/main";
import { TaskGroupsPanelController } from "../../component/taskGroupsPanel/TaskGroupsPanelController";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { TasksCountManager } from "./TasksCountManager";
import { i18n } from "./i18n/index";
import { session } from "pmc-mail/out/mail";

export interface Model {
    docked: boolean;
    // projectsStr: string;
    activeProjectId: ProjectId;
    membersStr: string;
    myId: PersonId;
    privateSectionId: string;
    horizontalTaskLayout: boolean;
}

export interface ProjectsModel {
}

// export interface ProjectModel {
//     id: ProjectId;
//     name: string;
//     active: boolean;
//     myTasks: boolean;
//     public: boolean;
// }

export interface TaskGroupsModel {
}

export type TaskGroupProgressModel = Array<[string, number, number]>;


// export interface SectionModel {
//     id: string;
//     name: string;
//     scope: string;
//     unread: number;
//     userAvatar: null|string;
//     overrideIsActive: null|boolean;
//     breadcrumb: string;
// }

@Dependencies(["splitter", "extlist", "persons", "notification", "taskGroupsPanel", "sidebar"])
export class TasksWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.tasks.window.tasks.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    
    docked: boolean;
    activeProjectId: ProjectId;
    activeProjectHostHash: string;
    // sinksInfo: Array<SinkInfo>;
    verticalSplitter: component.splitter.SplitterController;
    verticalSplitter2: component.splitter.SplitterController;
    horizontalSplitter: component.splitter.SplitterController;
    sidebar: component.sidebar.SidebarController;
    
    tasksPlugin: TasksPlugin;
    subSettings: { [key: string]: Settings } = {};
    
    dataChangedListener: EventHandler;
    remoteDataChangedListeners:  { [hostHash: string]: EventHandler } = {};
    
    taskPanel: TaskPanelController;
    
    personsComponent: component.persons.PersonsController;
    notifications: component.notification.NotificationController;
    
    privateSection: mail.section.SectionService;
    tasksCountManager: TasksCountManager;
    remoteTasksCountManagers: { [hostHash: string]: TasksCountManager } = {};
    
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    componentFactory: TasksComponentFactory;
    
    taskGroupsPanels: { [key: string]: TaskGroupsPanelController } = {};
    activePanel: TaskGroupsPanelController = null;
    
    remoteServers: { [hostHash: string]: component.remotehostlist.HostEntry } = {};

    initWithProject: string = null;
    sectionTooltip: component.sectiontooltip.SectionTooltipController;
    dirty: boolean = false;
    
    disabledSection: component.disabledsection.DisabledSectionController;

    constructor(parentWindow: Types.app.WindowParent, docked: boolean) {
        super(parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "tasks-splitter-vertical": { defaultValue: 340 },
                "tasks-splitter-vertical2-proportional": { defaultValue: JSON.stringify({handlePos:600,totalSize:1600}) },
                "tasks-splitter-horizontal-proportional": { defaultValue: JSON.stringify({handlePos:300,totalSize:1000}) },
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({handlePos:250,totalSize:1000}) },
                "active-project-id": { defaultValue: "" },
            }
        });
        this.ipcMode = true;
        let localSession = this.app.sessionManager.getLocalSession();

        this.docked = docked;
        this.setPluginViewAssets("tasks");
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 900;
        this.openWindowOptions.height = 500;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = this.i18n("plugin.tasks.window.tasks.title");
        this.openWindowOptions.icon = "icon fa fa-tasks";
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        this.taskPanel = this.addComponent("taskPanel", this.componentFactory.createComponent("taskpanel", [this, localSession, this.personsComponent, {
            close: () => this.close(),
            alert: (msg: string) => this.alert(msg),
            confirm: (msg: string) => this.confirm(msg),
            confirmEx: this.confirmEx.bind(this),
            openWindowParent: this,
            openChildWindow: this.openChildWindow.bind(this),
            updateDirty: this.updateDirty.bind(this),
        }, true, false, []]));
        this.taskPanel.onDirtyChanged = () => {
            let dirty = this.taskPanel.editable && this.taskPanel.dirty;
            if (this.activePanel) {
                this.activePanel.setPreviewDirty(dirty);
            }
        };
        this.dataChangedListener = this.onDataChanged.bind(this);
        this.tasksPlugin.watch(localSession, "*", "*", "*", this.dataChangedListener);
        this.tasksPlugin.activeTasksWindowController = this;
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.sectionTooltip = this.addComponent("sectiontooltip", this.componentFactory.createComponent("sectiontooltip", [this]));
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
        let data = this.app.searchModel.get();
        let isSearchOn = data.visible && data.value.length > 1;
        this.callViewMethod("onSearchChanged", isSearchOn, false);
        
        this.initSpellChecker(this.tasksPlugin.userPreferences);
    }
    
    beforeClose(): void {
        this.tasksPlugin.unWatch(this.app.sessionManager.getLocalSession(), "*", "*", "*", this.dataChangedListener);
        for (let hostHash in this.remoteDataChangedListeners) {
            this.tasksPlugin.unWatch(this.app.sessionManager.sessions[hostHash], "*", "*", "*", this.remoteDataChangedListeners[hostHash]);
        }
        this.taskPanel.beforeClose();
    }
    
    init() {
        let localSession = this.app.sessionManager.getLocalSession();

        this.privateSection = localSession.sectionManager.getMyPrivateSection();
        this.tasksCountManager = new TasksCountManager(localSession, this.privateSection, this.tasksPlugin, null);
        this.app.addEventListener<UpdateSectionBadgeEvent>("update-section-badge", this.onUpdateSectionBadge.bind(this));
        this.app.addEventListener<UpdateTasksSidebarSpinnersEvent>("update-tasks-sidebar-spinners", e => {
            this.sidebar.updateSidebarSpinners({
                conv2SectionId: e.conv2SectionId,
                customElementId: e.customElementId,
                sectionId: e.sectionId,
                hosts: e.hostHash ? [this.app.sessionManager.getSessionByHostHash(e.hostHash).host] : Object.values(this.app.sessionManager.sessions).map(x => x.host),
            });
        }, "tasks");

        this.verticalSplitter = this.addComponent("verticalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("tasks-splitter-vertical")]));
        this.verticalSplitter2 = this.addComponent("verticalSplitter2", this.componentFactory.createComponent("splitter", [this, this.settings.create("tasks-splitter-vertical2-proportional")]));
        this.horizontalSplitter = this.addComponent("horizontalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("tasks-splitter-horizontal-proportional")]));
        this.verticalSplitter.ipcMode = true;
        this.verticalSplitter2.ipcMode = true;
        this.horizontalSplitter.ipcMode = true;
        
        this.disabledSection = this.addComponent("disabled-section", this.componentFactory.createComponent("disabledsection", [this, Types.section.NotificationModule.TASKS]));
        
        
        this.subSettings["active-project-id"] = this.settings.create("active-project-id");        
        
        this.initWithProject = this.initWithProject || this.tasksPlugin.getPrivateSectionId();
        this.activeProjectId = this.initWithProject ? this.initWithProject : this.subSettings["active-project-id"].get();
        this.activeProjectHostHash = localSession.hostHash;
        if (!this.activeProjectId) {
            this.activeProjectId = TasksWindowController.getProjectId(this.tasksPlugin.getPrivateSectionId() ? this.tasksPlugin.getPrivateSectionId() : CustomTasksElements.ALL_TASKS_ID);
        }
        this.tasksPlugin.projectsReady.then(() => {
            this.selectProject(localSession, this.activeProjectId);
        });
        
        let promProjectCreator = Q();
        let prevUpdate: Date = null;
        this.registerChangeEvent(this.tasksPlugin.tasksSectionsCollection[localSession.hostHash].changeEvent, event => {
            // this.sinksInfo = this.getSinksInfo(localSession);
            // this.callViewMethod("updateSinksInfo", JSON.stringify(this.sinksInfo));
            
            if (event.type == "add") {
                promProjectCreator = promProjectCreator.then(() => <any>this.tasksPlugin.ensureProjectExists(event.element.getId(), event.element.getName(), localSession)).then(() => {
                    return <any>Q.resolve();
                })
                .fail(e => {
                    this.getLogger().error("Error during adding project", e);
                })
            }
            else if (event.type == "update") {
                let now = new Date();
                if (prevUpdate != null) {
                    if (<any>now - <any>prevUpdate < 5) {
                        prevUpdate = now;
                        return;
                    }
                }
                prevUpdate = now;
                setTimeout(() => {
                    promProjectCreator = promProjectCreator.then(() => {
                        // this.callViewMethod("renderProjectsPanel");
                        return <any>Q.resolve();
                    });
                }, 100);
            }
        });
        for (let element of this.tasksPlugin.tasksSectionsCollection[localSession.hostHash].list) {
            let id = element.getId();
            let name = element.getName();
            if (id == this.tasksPlugin.getPrivateSectionId()) {
                name = this.i18n("plugin.tasks.window.tasks.sidebar.privateTasks");
            }
            promProjectCreator = promProjectCreator.then(() => <any>this.tasksPlugin.ensureProjectExists(id, name, localSession));
        }
        // promProjectCreator = promProjectCreator.then(() => {
        //     // this.sinksInfo = this.getSinksInfo(localSession);
        //     // this.callViewMethod("updateSinksInfo", JSON.stringify(this.sinksInfo));
        //     // this.callViewMethod("renderProjectsPanel");
        //     return <any>Q.resolve();
        // });
        
        this.app.addEventListener("focusChanged", (event) => {
            let windowId = (<any>event).windowId;
            this.tasksPlugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? (<ContainerWindowController>this.parent.parent).activeModel.get() : windowId;
            if (windowId == "tasks" || (windowId == "main-window" && (<ContainerWindowController>this.parent.parent).activeModel.get() == "tasks") ) {
                setTimeout(() => {
                    this.callViewMethod("grabFocus", true);
                }, 200);
            }
        });
        this.app.addEventListener("focusLost", (event) => {
            this.tasksPlugin.activeWindowFocused = null;
        });
        this.app.addEventListener<BadgesUpdateRequestEvent>("badges-update-request", event => {
            this.updateBadges();
        });
        this.app.addEventListener<MarkedTasksAsReadEvent>("marked-tasks-as-read", event => {
            this.updateBadges();
        });
        
        this.app.addEventListener("focusLost", () => {
            this.callViewMethod("pauseTimeAgoRefresher");
        }, "tasks");
        
        this.app.addEventListener("focusChanged", event => {
            if ((<any>event).windowId == "main-window") {
                this.callViewMethod("resumeTimeAgoRefresher");
            }
        }, "tasks");
        
        
        this.app.addEventListener("onToggleMaximize-notify", () => {
            setTimeout(() => {
                this.callViewMethod("grabFocus", false);
            }, 10);
        });
        
        // this.sinksInfo = this.getSinksInfo(localSession);
        
        return Q().then(() => {
            return Q.all([
                this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                this.tasksPlugin.sectionManager.isSectionsLimitReached(),
            ])
        })
        .then(res => {
            let [identityProvider, isSectionsLimitReached] = res;
            let customElements: component.customelementlist.CustomElement[] = [];
            if (this.tasksPlugin.getPrivateSectionId()) {
                customElements.push(
                    {
                        id: this.tasksPlugin.getPrivateSectionId(),
                        icon: {
                            type: "hashmail",
                            value: this.identity.hashmail
                        },
                        label: this.i18n("plugin.tasks.window.tasks.sidebar.privateTasks"),
                        private: true,
                        emphasized: true,
                    }
                );
            }
            customElements.push(
                {
                    id: CustomTasksElements.ALL_TASKS_ID,
                    icon: {
                        type: "fa",
                        value: "fa-tasks",
                    },
                    label: this.i18n("plugin.tasks.window.tasks.sidebar.allTasks"),
                    private: false,
                },
                {
                    id: CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                    icon: {
                        type: "hashmail",
                        value: this.identity.hashmail,
                    },
                    label: this.i18n("plugin.tasks.window.tasks.sidebar.tasksCreatedByMe"),
                    private: false,
                },
                {
                    id: CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                    icon: {
                        type: "hashmail",
                        value: this.identity.hashmail,
                    },
                    label: this.i18n("plugin.tasks.window.tasks.sidebar.tasksAssignedToMe"),
                    private: false,
                    alternative: true,
                    emphasized: true,
                },
                {
                    id: CustomTasksElements.TRASH_ID,
                    icon: {
                        type: "fa",
                        value: "ico-bin",
                    },
                    label: this.i18n("plugin.tasks.window.tasks.sidebar.trash"),
                    private: false,
                }
            );
            
            let sidebarOptions: component.sidebar.SidebarOptions = {
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: new utils.collection.MutableCollection(customElements),
                    elementsCountProvider: (ce: component.customelementlist.CustomElement) => this.tasksCountManager.getCustomElementElementsCount(ce),
                    unreadProvider: (ce: component.customelementlist.CustomElement) => this.getUnread(localSession, ce),
                    searchCountProvider: (ce: component.customelementlist.CustomElement) => this.tasksPlugin.getSearchCount(localSession, ce),
                    unmutedUnreadProvider: (ce: component.customelementlist.CustomElement) => this.getUnread(localSession, ce, true),
                    withSpinnerProvider: (ce: component.customelementlist.CustomElement) => this.getWithSpinner(localSession, ce),
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    elementsCountProvider: (c2s: mail.section.Conv2Section) => this.tasksCountManager.getConv2ElementsCount(c2s),
                    unreadProvider: (c2s: mail.section.Conv2Section) => this.getUnread(localSession, c2s),
                    searchCountProvider: (ce: mail.section.Conv2Section) => this.tasksPlugin.getSearchCount(localSession, ce),
                    searchAllSearchedProvider: null,
                    unmutedUnreadProvider: (c2s: mail.section.Conv2Section) => this.getUnread(localSession, c2s, true),
                    withSpinnerProvider: (c2s: mail.section.Conv2Section) => this.getWithSpinner(localSession, c2s),
                    sorter: (a, b) => {
                        return this.tasksCountManager.getConv2LastDate(b) - this.tasksCountManager.getConv2LastDate(a);
                    },
                    hideConversations: true,
                    assignedTo: true,
                },
                sectionList: {
                    baseCollection: this.tasksPlugin.sidebarSectionsCollection,
                    elementsCountProvider: (section: mail.section.SectionService) => this.tasksCountManager.getSectionElementsCount(section),
                    unreadProvider: (section: mail.section.SectionService) => this.getUnread(localSession, section), 
                    searchCountProvider: (section: mail.section.SectionService) => this.tasksPlugin.getSearchCount(localSession, section),
                    searchAllSearchedProvider: null,
                    withSpinnerProvider: (section: mail.section.SectionService) => this.getWithSpinner(localSession, section),
                    moduleName: Types.section.NotificationModule.TASKS,
                    sorter: (a, b) => {
                        let res = this.tasksCountManager.getSectionLastDate(b) - this.tasksCountManager.getSectionLastDate(a);
                        return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: component.remotehostlist.ElementCountsAggregationStrategy.SECTIONS,
                },
                customSectionList: {
                    baseCollection: null,
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    moduleName: Types.section.NotificationModule.TASKS,
                    sorter: null
                },
                conv2ListEnabled: true,
                conv2Splitter: this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: [],
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push(
                    {
                        id: "new-section",
                        label: this.i18n("plugin.tasks.window.tasks.sidebar.newSection"),
                        title: this.i18n("plugin.tasks.window.tasks.sidebar.newSection"),
                        icon: "ico-comment",
                        windowOpener: true,
                        onSectionList: true
                    }
                );
            }
            
            this.sidebar = this.addComponent("sidebar", this.componentFactory.createComponent("sidebar", [this, sidebarOptions]));
            this.sidebar.addEventListener("elementbeforeactivate", this.onBeforeActivateSidebarElement.bind(this));
            this.sidebar.addEventListener("elementactivated", this.onActivatedSidebarElement.bind(this));
            this.sidebar.addEventListener("sidebarbuttonaction", this.onSidebarButtonAction.bind(this));
            
            this.sidebar.usersListTooltip.getContent = (sectionId: string): string => {
                return this.app.getUsersListTooltipContent(this.app.sessionManager.getLocalSession(), sectionId);
            }
            
            this.app.addEventListener("reopen-section", (event: component.disabledsection.ReopenSectionEvent) => {
                this.selectProject(localSession, event.element.getId());
            });
            this.app.addEventListener<Types.event.SectionsLimitReachedEvent>("sectionsLimitReached", event => {
                this.sidebar.onSectionsLimitReached(event.reached);
            });
            
            this.initSessionEvents(localSession);
            
            this.tasksCountManager.sidebar = this.sidebar;
            this.setSidebarActiveItem(localSession, this.activeProjectId);
            
            this.app.addEventListener<TasksSearchUpdateEvent>("tasks-search-update", event => {
                let refreshAvatars = this.updateSidebarCustomElements(localSession, this.sidebar.customElementList.customElementsCollection);
                this.updateBadges();
                this.callViewMethod("onSearchChanged", event.searchString.length > 0, refreshAvatars);
            });
            
            this.app.dispatchEvent({type: "focusChanged", windowId: "tasks"});
            return <any>this.tasksPlugin.checkInit().then(() => this.tasksPlugin.projectsReady).then(() => {
                return this.taskPanel.init();
            })
            .then(() => {
                this.selectProject(localSession, this.activeProjectId);
            })
        })
        
    }
    
    isSectionPrimary(session: mail.session.Session, section: mail.section.SectionService) {
        return this.tasksPlugin.tasksPrimarySections[session.hostHash].contains(section);
    }
    
    openDisabledSectionView(session: mail.session.Session, section: mail.section.SectionService) {
        this.sidebar.setActive({
            type: this.isSectionPrimary(session, section) ? component.sidebar.SidebarElementType.CUSTOM_SECTION : component.sidebar.SidebarElementType.SECTION,
            section: section,
        }, false);
        this.tasksPlugin.activeSinkId = section.getChatSink().id;
        this.tasksPlugin.activeSinkHostHash = session.hostHash;
        this.disabledSection.setSection(section);
        this.callViewMethod("toggleDisabledSection", true);
    }
    
    refreshTaskCounts(): void {
        this.tasksCountManager.refresh();
        for (let hostHash in this.remoteTasksCountManagers) {
            this.remoteTasksCountManagers[hostHash].refresh();
        }
        this.sidebar.refresh();
    }
    
    updateSidebarCustomElements(session: mail.session.Session, collection: utils.collection.BaseCollection<component.customelementlist.CustomElement>, all: boolean = false): boolean {
        let hostHash = session.hostHash;
        let refreshAvatars = false;
        let len = collection.size();
        for (let i = 0; i < len; ++i) {
            let el = collection.get(i);
            if (all || (this.tasksPlugin.searchCountsModified[hostHash] && this.tasksPlugin.searchCountsModified[hostHash][el.id])) {
                collection.triggerUpdateAt(i);
                if (el.icon.type == "hashmail") {
                    refreshAvatars = true;
                }
            }
        }
        return refreshAvatars;
    }
    
    updateSidebarSections(session: mail.session.Session, collection: utils.collection.SortedCollection<mail.section.SectionService>, all: boolean = false) {
        let hostHash = session.hostHash;
        let len = collection.size();
        for (let i = 0; i < len; ++i) {
            let id = collection.get(i).getId();
            if (all || (this.tasksPlugin.searchCountsModified[hostHash] && this.tasksPlugin.searchCountsModified[hostHash][id])) {
                collection.triggerUpdateAt(i);
            }
        }
    }
    
    updateConv2Sections(session: mail.session.Session, collection: utils.collection.SortedCollection<mail.section.Conv2Section>, all: boolean = false) {
        let hostHash = session.hostHash;
        let len = collection.size();
        for (let i = 0; i < len; ++i) {
            let id = collection.get(i).id;
            if (all || (this.tasksPlugin.searchCountsModified[hostHash] && this.tasksPlugin.searchCountsModified[hostHash][id])) {
                collection.triggerUpdateAt(i);
            }
        }
    }
    
    onBeforeActivateSidebarElement(event: component.sidebar.ElementBeforeActivateEvent) {
        let localSession = this.app.sessionManager.getLocalSession();
        event.result = false;
        if (event.element.type == component.sidebar.SidebarElementType.HOST) {
            this.expandRemoteSectionsList(event.element.host);
        }
        else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
            // console.log("onBeforeActivateSidebarElement - remote section clicked...");
            //this.openRemoteTaskGroupsPanel(event.element.hostHash, event.element.section);
            let session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            this.selectProject(session, event.element.section.getId());
            this.app.viewContext = "section:" + event.element.section.getId();
        }
        else if (event.element.type == component.sidebar.SidebarElementType.SECTION) {
            this.selectProject(localSession, event.element.section.getId());
            this.app.viewContext = "section:" + event.element.section.getId();
        }
        else if (event.element.type == component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            this.selectProject(localSession, event.element.customElement.id);
            if (event.element.customElement.id.indexOf("private:") > -1) {
                this.app.viewContext = "custom:my";
            }
        }
        else if (event.element.type == component.sidebar.SidebarElementType.CONVERSATION) {
            this.selectProject(localSession, event.element.conv2.id);
            this.app.viewContext = event.element.conv2.id;
        }
        else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            let session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            this.selectProject(session, event.element.conv2.id);
            this.app.viewContext = event.element.conv2.id;
        }

    }
    
    onSidebarButtonAction(event: component.sidebar.SidebarButtonActionEvent) {
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }
    }
    
    openSectionsWindow(): void {
        // this.app.openSingletonWindow("sections", window.sections.SectionsWindowController);
        this.app.openNewSectionDialogFromSidebar();
    }
    
    onActivatedSidebarElement(event: component.sidebar.ElementActivatedEvent) {
    }
    
    onSinkChange(session: mail.session.Session, event: Types.utils.collection.CollectionEvent<mail.SinkIndex>) {
        if (event.element == null) {
            return;
        }
        let section = session.sectionManager.getSectionBySinkIndex(event.element);
        if (section == null) {
            return;
        }
        if (session.hostHash == this.app.sessionManager.getLocalSession().hostHash) {
            this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
        }
        else {
            let list = this.sidebar.remoteSectionsLists[session.hostHash];
            if (list) {
                list.sortedCollection.triggerBaseUpdateElement(section);
            }
        }
    }
    
    getUnread(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|component.customelementlist.CustomElement, skipMuted: boolean = false): number {
        if (!section) {
            return 0;
        }
        else if (section instanceof mail.section.SectionService) {
            return this.tasksPlugin.getUnreadForSection(session, section.getId());
        }
        else if (section instanceof mail.section.Conv2Section) {
            return this.tasksPlugin.getUnreadForConv2Section(session, section.id, skipMuted);
        }
        else if (section.id == CustomTasksElements.ALL_TASKS_ID) {
            return null;
        }
        else if (section.id == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID) {
            // console.log(1);
            return this.tasksPlugin.getUnread(session, true, false);
        }
        else if (section.id == CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
            // console.log(2);
            return this.tasksPlugin.getUnread(session, false, true, skipMuted);
        }
        else if (section.id == CustomTasksElements.TRASH_ID) {
            // console.log(3);
            return this.tasksPlugin.getUnread(session, false, false, false, true);
        }
        return 0;
    }
    
    getWithSpinner(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|component.customelementlist.CustomElement): boolean {
        if (this.tasksPlugin.sectionsWithSpinner[session.hostHash]["__all__"]) {
            return true;
        }
        if (section instanceof mail.section.SectionService) {
            return this.tasksPlugin.sectionsWithSpinner[session.hostHash][section.getId()];
        }
        else if (section instanceof mail.section.Conv2Section) {
            return this.tasksPlugin.sectionsWithSpinner[session.hostHash][section.id];
        }
        else {
            return this.tasksPlugin.sectionsWithSpinner[session.hostHash][section.id];
        }
    }
    
    applyHistoryState(processed: boolean, state: string) {
        if (processed) {
            return;
        }
        let usedState = state;
        let localSession = this.app.sessionManager.getLocalSession();
        if (this.app.viewContext) {
            let contextData = this.app.viewContext.split(":");
            
            if (this.app.switchModuleWithContext()) {
                if (contextData[0] == "section") {
                    let contextSection = localSession.sectionManager.getSection(contextData[1]);
                    if (contextSection && contextSection.isKvdbModuleEnabled()) {
                        usedState = contextData[1];
                    }
                }
                else if (contextData[0] == "c2" && contextData[2].split("|").length < 3) {
                    usedState = this.app.viewContext;
                }
                else if (contextData[0] == "custom" && contextData[1] == "my") {
                    let privateSection = localSession.sectionManager.getMyPrivateSection();
                    if (privateSection) {
                        usedState = privateSection.getId();
                    }
                }
            }
        }
        this.app.resetModuleSwitchingModifier();
        
        if (usedState != null) {
            let newActiveProjectId = usedState.startsWith("section:") ? usedState.substring("section:".length) : usedState;
            this.activeProjectId = newActiveProjectId;
            this.activeProjectHostHash = localSession.hostHash;
            this.initWithProject = newActiveProjectId;
            this.selectProject(localSession, newActiveProjectId);
        }
    }
    
    onUpdateSectionBadge(event: UpdateSectionBadgeEvent): void {
        this.updateBadges();
    }
    
    updateBadges(): void {
        this.updateSidebarCustomElements(this.app.sessionManager.getLocalSession(), this.sidebar.customElementList.customElementsCollection, true);
        this.updateSidebarSections(this.app.sessionManager.getLocalSession(), this.sidebar.sectionList.sortedCollection, true);
        this.updateConv2Sections(this.app.sessionManager.getLocalSession(), this.sidebar.conv2List.sortedCollection, true);
        this.sidebar.conv2List.sortedCollection.refresh();
        this.sidebar.sectionList.sortedCollection.refresh();
        for (let hostHash in this.sidebar.remoteSectionsLists) {
            let rsl = this.sidebar.remoteSectionsLists[hostHash];
            this.updateSidebarSections(this.app.sessionManager.getSessionByHostHash(hostHash), rsl.sortedCollection, true);
            rsl.sortedCollection.refresh();
        }
        for (let hostHash in this.sidebar.remoteConv2Lists) {
            let rsl = this.sidebar.remoteConv2Lists[hostHash];
            this.updateConv2Sections(this.app.sessionManager.getSessionByHostHash(hostHash), rsl.sortedCollection, true);
            rsl.sortedCollection.refresh();
        }
        for (let hostHash in this.remoteTasksCountManagers) {
            this.remoteTasksCountManagers[hostHash].updateSidebarHostElement();
        }
    }
    // -- UNUSED METHOD
    // getTabBadge(sectionId: string): number {
    //     let unread: number = 0;
    //     for (let tId in this.tasksPlugin.tasks) {
    //         let task = this.tasksPlugin.tasks[tId];
    //         if (this.tasksPlugin.wasTaskUnread(task, sectionId)) {
    //             unread++;
    //         }
    //     }
    //     return unread;
    // }
    
    getModel(): Model {
        let allAvailMembers: {[hostHash: string]: PeopleMap} = {};
        for (let hostHash in this.app.sessionManager.sessions) {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            if (session.loadingPromise.isFulfilled()) {
                allAvailMembers[hostHash] = this.tasksPlugin.getAllPeople(session);
            }
        }
        return {
            docked: this.docked,
            activeProjectId: this.activeProjectId,
            membersStr: JSON.stringify(allAvailMembers),
            myId: this.tasksPlugin.getMyId(this.app.sessionManager.getLocalSession()),
            privateSectionId: this.tasksPlugin.getPrivateSectionId(),
            // projectsStr: JSON.stringify(this.tasksPlugin.projects),
            horizontalTaskLayout: this.tasksPlugin.getSetting(null, "horizontal-task-window-layout", null, null) ? true : false,
        };
    }
    
    // getSinksInfo(session: mail.session.Session): Array<SinkInfo> {
    //     let sinksInfo: Array<SinkInfo> = [];
        
    //     for (let el of this.tasksPlugin.tasksSectionsCollection[session.hostHash].list) {
    //         sinksInfo.push({
    //             id: el.getId(),
    //             public: el.getScope() == "public",
    //         });
    //     }
    //     sinksInfo.push({
    //         id: this.tasksPlugin.getPrivateSectionId(),
    //         public: true,
    //     });
        
    //     return sinksInfo;
    // }
    
    onDataChanged(type: Watchable, id: string, action: Action): void {
        if (this.activeProjectHostHash != this.app.sessionManager.getLocalSession().hostHash) {
            return;
        }
        if (type == "project") {
            let proj = this.tasksPlugin.getProject(this.app.sessionManager.getLocalSession(), id);
            if (!proj && action != "deleted") {
                return;
            }
            if (action == "added") {
                // this.callViewMethod("addProject", JSON.stringify(proj));
            }
            else if (action == "deleted") {
                // this.callViewMethod("deleteProject", id);
                if (this.activeProjectId == id) {
                    this.activeProjectId = "";
                    this.onViewSettingChanged("active-project-id", "");
                    this.callViewMethod("hideContainer", id);
                }
            }
            else if (action == "modified") {
                // this.callViewMethod("updateProject", JSON.stringify(proj));
            }
        }
        if (type == "task" && this.tasksCountManager != null) {
            this.tasksCountManager.updateTasksCount(id, action);
        }
    }
    
    onRemoteDataChanged(type: Watchable, id: string, action: Action, hostHash: string): void {
        if (type == "task") {
            this.getOrCreateRemoteTasksCountManager(hostHash).updateTasksCount(id, action);
        }
    }
    
    onViewSettingChanged(setting: string, value: any): void {
        if (setting in this.subSettings) {
            if (typeof(value) == "boolean") {
                value = value ? 1 : 0;
            }
            let fixedSectionsNames = [
                CustomTasksElements.ALL_TASKS_ID,
                CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                CustomTasksElements.TRASH_ID,
                this.tasksPlugin.getPrivateSectionId(),
            ];
            
            this.subSettings[setting].set(value);
        }
    }
    
    // onSelectTab(sectionId: string): void {
    //     this.selectProject(sectionId);
    // }
    
    onViewSelectProject(projectId: string) {
        // TODO WRONG PARAM
        this.selectProject(this.app.sessionManager.getLocalSession(), projectId);
    }
    
    setSidebarActiveItem(session: mail.session.Session, projectId: ProjectId): void {
        let fixedSectionsNames = [
            CustomTasksElements.ALL_TASKS_ID,
            CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            CustomTasksElements.TRASH_ID,
            this.tasksPlugin.getPrivateSectionId(),
        ];
        if (fixedSectionsNames.indexOf(projectId) >= 0) {
            this.sidebar.setActive({
                type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                customElement: this.sidebar.options.customElementList.baseCollection.find(x => x.id == projectId),
            }, false);
            this.tasksPlugin.activeSinkId = null;
            this.tasksPlugin.activeSinkHostHash = null;
        }
        else {
            if (session.sessionType == "local") {
                if (this.tasksPlugin.isConv2Project(projectId)) {
                    Q().then(() => {
                        return session.mailClientApi.privmxRegistry.getConv2Service();
                    })
                    .then(conv2service => {
                        let conv2 = conv2service.collection.find(c2s => c2s.id == projectId);
                        this.sidebar.setActive({
                            type: component.sidebar.SidebarElementType.CONVERSATION,
                            conv2: conv2,
                        }, false);
                        this.tasksPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                        this.tasksPlugin.activeSinkHostHash = session.hostHash;
    
                    })
                }
                else if (session.sectionManager.getSection(projectId)) {
                    this.sidebar.setActive({
                        type: component.sidebar.SidebarElementType.SECTION,
                        section: session.sectionManager.getSection(projectId),
                    }, false);
                    this.tasksPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                    this.tasksPlugin.activeSinkHostHash = session.hostHash;
                }    
            }
            if (session.sessionType == "remote") {
                if (this.tasksPlugin.isConv2Project(projectId)) {
                    Q().then(() => {
                        return session.mailClientApi.privmxRegistry.getConv2Service();
                    })
                    .then(conv2service => {
                        let conv2 = conv2service.collection.find(c2s => c2s.id == projectId);
                        this.sidebar.setActive({
                            type: component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                            conv2: conv2,
                            hostHash: session.hostHash,
                        }, false);
                        this.tasksPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                        this.tasksPlugin.activeSinkHostHash = session.hostHash;
                    })
                }
                else if (session.sectionManager.getSection(projectId)) {
                    this.sidebar.setActive({
                        type: component.sidebar.SidebarElementType.REMOTE_SECTION,
                        section: session.sectionManager.getSection(projectId),
                        hostHash: session.hostHash,
                    }, false);
                    this.tasksPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                    this.tasksPlugin.activeSinkHostHash = session.hostHash;
                }    
            }
    
        }
    }
    
    selectProject(session: mail.session.Session, projectId: ProjectId) {
        if (!this.sidebar) {
            return;
        }
        let isRemote = session.hostHash != this.app.sessionManager.getLocalSession().hostHash;
        let fixedSectionsNames = [
            CustomTasksElements.ALL_TASKS_ID,
            CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            CustomTasksElements.TRASH_ID,
            this.tasksPlugin.getPrivateSectionId(),
        ];
        this.setSidebarActiveItem(session, projectId);
        let activeId: string;
        let rootId: string;
        this.callViewMethod("toggleDisabledSection", false);
        if (fixedSectionsNames.indexOf(projectId) >= 0) {
            activeId = projectId;
            rootId = projectId;
            if (projectId == this.tasksPlugin.getPrivateSectionId()) {
                if (this.privateSection) {
                    this.openTaskGroupsPanel(session, this.privateSection);
                }
            }
            else {
                this.openTaskGroupsPanel(session, projectId);
            }
        }
        else if (this.tasksPlugin.isConv2Project(projectId)) {
            let c2s = this.tasksPlugin.getConv2Section(session, projectId);
            if (!c2s) {
                return;
            }
            this.afterViewLoaded.promise.then(() => {
                this.openTaskGroupsPanel(session, c2s);
            });
            activeId = c2s.id;
            rootId = c2s.id;
        }
        else {
            let section = session.sectionManager.getSection(projectId);
            if (section instanceof mail.section.SectionService && !section.isKvdbModuleEnabled()) {
                this.disabledSection.setSection(section);
                this.callViewMethod("toggleDisabledSection", true);
                return;
            }
            
            let state = session.sectionManager.getDescantsForModule(projectId, "kvdb");
            if (state == null) {
                return;
            }
            this.afterViewLoaded.promise.then(() => {
                this.openTaskGroupsPanel(session, state.active);
            });
            activeId = state.active.getId();
            rootId = state.active.getId();
        }
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("onSelectTab", activeId, rootId);
        });
    }
    
    onSectionsCollectionChange(session: mail.session.Session, event: Types.utils.collection.CollectionEvent<mail.section.SectionService>): void {
        let countsManager: TasksCountManager = null;
        let customElementList: component.customelementlist.CustomElementListController = null;
        let sectionList: component.sectionlist.SectionListController | component.remotesectionlist.RemoteSectionListController = null;
        let conv2List: component.conv2list.Conv2ListController | component.remoteconv2list.RemoteConv2ListController = null;
        if (session.hostHash == this.app.sessionManager.getLocalSession().hostHash) {
            countsManager = this.tasksCountManager;
            customElementList = this.sidebar.customElementList;
            sectionList = this.sidebar.sectionList;
            conv2List = this.sidebar.conv2List;
        }
        else {
            countsManager = this.getOrCreateRemoteTasksCountManager(session.hostHash);
            customElementList = null;
            sectionList = this.sidebar.remoteSectionsLists[session.hostHash];
            conv2List = this.sidebar.remoteConv2Lists[session.hostHash];
        }
        if (countsManager) {
            countsManager.conv2Count = {};
            countsManager.customsCount = {};
            countsManager.sectionsCount = {};
        }
        if (customElementList) {
            this.updateSidebarCustomElements(session, customElementList.customElementsCollection, true);
        }
        if (sectionList) {
            this.updateSidebarSections(session, sectionList.sortedCollection, true);
        }
        if (conv2List) {
            this.updateConv2Sections(session, conv2List.sortedCollection, true);
        }
    }
    
    setActiveProjectId(hostHash: string, value: ProjectId): void {
        this.activeProjectId = value;
        this.activeProjectHostHash = hostHash;
    }
    
    
    getTaskGroupsPanel(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|string, hostHash?: string): Q.Promise<TaskGroupsPanelController> {
        return this.createTaskGroupsPanel(session, TasksWindowController.getProjectId(section));
    }
    
    createTaskGroupsPanel(session: mail.session.Session, projectId: string): Q.Promise<TaskGroupsPanelController> {
        // console.log("on createTaskGroupsPanel", projectId);
        let tgPanelKey = this.getTaskGroupsPanelKey(session.hostHash, projectId);
        if (tgPanelKey in this.taskGroupsPanels) {
            return Q(this.taskGroupsPanels[tgPanelKey]);
        }
        let panel = this.taskGroupsPanels[tgPanelKey] = this.addComponent("taskGroupsPanel-" + tgPanelKey, this.componentFactory.createComponent("taskGroupsPanel", [this]));
        return Q().then(() => {
            let mergedSectionsNames = [
                CustomTasksElements.ALL_TASKS_ID,
                CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                CustomTasksElements.TRASH_ID,
            ];
            return panel.setSession(session, mergedSectionsNames.indexOf(projectId) >= 0 ? undefined : projectId);
        })
        .then(() => {
            panel.onViewConfirmPreviewExit = () => {
                this.taskPanel.closeConfirm().then(close => {
                    if (close) {
                        panel.callViewMethod("confirmPreviewExit");
                    }
                });
            };
            panel.init();
            panel.addEventListener<TaskPreviewRequestEvent>("task-preview-request", event => {
                return Q().then(() => {
                    return this.taskPanel.setSession(this.app.sessionManager.getSessionByHostHash(event.hostHash));
                })
                .then(() => {
                    // console.log("after setSeesion")
                    // console.log("on TaskPreviewRequestEvent", this.activeProjectId, projectId, "hostHash", event.hostHash)
                    if (this.activeProjectId != projectId || this.activeProjectHostHash != event.hostHash) {
                        // console.log("warn: diff projectId - return")
                        return;
                    }
                    this.afterViewLoaded.promise.then(() => {
                        let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
                        this.taskPanel.setTaskId(session, event.taskId);
                        
                        if (!event.taskId) {
                            // console.log("task-preview-request - no taskId")
                            return;
                        }
                        
                        let task = this.tasksPlugin.tasks[session.hostHash][event.taskId];
                        
                        if (task && this.tasksPlugin.wasTaskUnread(session, task, task.getProjectId()) && this.app.userPreferences.getAutoMarkAsRead()) {
                           // console.log("before mark task as watched")
                            this.tasksPlugin.markTaskAsWatched(session, task.getId(), task.getProjectId());
                            // console.log("before updateBadges");
                            this.updateBadges();
                            // console.log("after updateBadges");
                        }
                    });
    
                })
            });
            panel.addEventListener<TaskPanelUpdateRequestEvent>("taskpanel-update-request", () => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.taskPanel.updateView();
                });
            });
            panel.addEventListener<TaskPanelChangeVisibilityRequestEvent>("taskpanel-change-visibility-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("changeTaskPanelVisibility", event.show);
                });
            });
            panel.addEventListener<HorizontalTaskWindowLayoutChangeRequestEvent>("horizontal-task-window-layout-change-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("updatePreviewLocation", event.horizontalLayout);
                });
            });
            panel.addEventListener<BadgesUpdateRequestEvent>("badges-update-request", event => {
                this.afterViewLoaded.promise.then(() => {
                    this.updateBadges();
                });
            });
            
            this.afterViewLoaded.promise.then(() => {
                this.afterViewLoaded.promise.then(() => {
                    // console.log("call createTaskGroupsPanel in view")
                    this.callViewMethod("createTaskGroupsPanel", session.hostHash, projectId);
                });
            });
            
            // console.log("on createTaskGroupsPanel - return panel");
            return Q(panel);
    
        })
        
    }
    
    openTaskGroupsPanel(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|string): void {
        this.openRemoteTaskGroupsPanel(session.hostHash, section);
        // this.afterViewLoaded.promise.then(() => {

        //     this.getTaskGroupsPanel(session, section).then(panel => {
        //         if (!panel.wasDataSet) {
        //             return panel.setSectionData(section).then(() => Q(panel));
        //         }
        //         return panel;
        //     }).then(panel => {
        //         this.activeProjectId = TasksWindowController.getProjectId(section);
        //         if (this.activePanel) {
        //             this.activePanel.deactivate();
        //         }
        //         panel.beforeActivate();
        //         this.activePanel = panel;
        //         this.tasksPlugin.activeTaskGroupsPanel = panel;
        //         this.afterViewLoaded.promise.then(() => {
        //             this.callViewMethod("openTaskGroupsPanel", TasksWindowController.getProjectId(section));
        //         });
        //     });
        // });
    }    
    
    onViewOpenedTaskGroupsPanel(hostHash: string, projectId: string): void {
        // console.log("on openedTaskGroupsPanel - projectId" , projectId);
        if (projectId != this.activeProjectId || hostHash != this.activeProjectHostHash) {
            // console.log("projectId diff from this.activeProjectId");
            return;
        }
        let tgPanelKey = this.getTaskGroupsPanelKey(hostHash, projectId);
        let panel = this.taskGroupsPanels[tgPanelKey];
        if (panel) {
            // console.log("openedTaskGroupsPanel - call activate");
            panel.activate();
        }
    }
    
    updateDirty(dirty: boolean): void {
        this.dirty = dirty;
    }
    
    onViewRefresh(): void {
        if (this.activePanel) {
            this.activePanel.onViewFullRefresh(true, true);
        }
    }
    
    panelId: number = 1;
    onViewSwitchToPanel(id: number): void {
        this.panelId = id;
    }
    
    handleFilePaste(element: app.common.clipboard.ClipboardElement): boolean {
        if (this.panelId == 2) {
            if (
                (app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES in element.data && this.taskPanel)
                    || (element.data.file && element.data.file.element instanceof mail.section.OpenableSectionFile)
                    || (element.data.files && element.data.files.filter((x: any) => !x || !(x.element instanceof mail.section.OpenableSectionFile)).length == 0)
                ) {
                this.taskPanel.tryPaste(element, "text" in element.data ? element.data.text : null);
                return true;
            }
        }
        return false;
    }
    

      ////////////////////////
     //// REMOTE SECTIONS ///
    ////////////////////////

    expandRemoteSectionsList(hostEntry: component.remotehostlist.HostEntry): void {
        let session: mail.session.Session;
        let hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        let checkSessionExists: boolean = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if (checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        
        let bindChangedListener = false;
        if (!this.remoteDataChangedListeners[hostHash]) {
            bindChangedListener = true;
            this.remoteDataChangedListeners[hostHash] = (t, i, a) => this.onRemoteDataChanged(t, i, a, hostHash);
        }

        Q().then(() => {
            this.sidebar.callViewMethod("showHostLoading", hostHash, true);
            if (!checkSessionExists) {
                return this.app.sessionManager.createRemoteSession(hostEntry.host)
                .then(() => {
                    return this.app.sessionManager.init(hostHash);
                })        
                .fail(() => {
                    this.sidebar.callViewMethod("showHostLoading", hostHash, false);
                    return this.errorCallback;
                });
            }
        })
        .then(() => {
            session = this.app.sessionManager.getSessionByHostHash(hostHash);
            if (bindChangedListener) {
                this.tasksPlugin.watch(session, "*", "*", "*", this.remoteDataChangedListeners[hostHash]);
            }
            return this.tasksPlugin.ensureSessionProjectsInitialized(session);
        })
        .then(() => {
            this.initSessionEvents(session);
            if (!this.remoteServers) {
                this.remoteServers = {};
            }
                
            this.initRemoteHostComponents(hostEntry, session);
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
        })
        .then(() => {
            let rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
            rtcm.updateSidebarHostElement();
        });
    }
    
    initSessionEvents(session: mail.session.Session): void {
        session.sectionManager.sectionAccessManager.eventDispatcher.addEventListener<Types.event.SectionStateChangedEvent>("section-state-changed", event => {
            if (this.activePanel && this.activeProjectId == event.sectionId && this.activeProjectHostHash == session.hostHash) {
                Q().then(() => {
                    return session.sectionManager.load();
                })
                .then(() => {
                    let section = session.sectionManager.getSection(event.sectionId);
                    let moduleEnabled = section.isKvdbModuleEnabled();
                    if (! moduleEnabled) {
                        this.openDisabledSectionView(session, section);
                    }
                    else {
                        this.selectProject(session, section.getId());
                    }
                })
            }
        }, "tasks");
        this.registerChangeEvent(this.tasksPlugin.tasksSectionsCollectionNoPrivate[session.hostHash].changeEvent, event => this.onSectionsCollectionChange(session, event));
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.sinkIndexCollection.changeEvent, event => this.onSinkChange(session, event));
    }

    checkRemoteHostComponentsInitialized(hostHash: string): boolean {
        let ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    }

    initRemoteHostComponents(hostEntry: component.remotehostlist.HostEntry, session: mail.session.Session): void {
        let hostHash = session.hostHash;
        if (this.checkRemoteHostComponentsInitialized(hostHash)) {
            return;
        }

        let sectionsListOptions: component.remotesectionlist.RemoteSectionListOptions = {
            baseCollection: session.sectionManager.filteredCollection,
            unreadProvider: section => this.getUnread(session, section),
            elementsCountProvider: section => this.getRemoteSectionElementsCount(hostHash, section),
            searchCountProvider: section => this.tasksPlugin.getSearchCount(session, section),
            withSpinnerProvider: section => this.getWithSpinner(session, section),
            searchAllSearchedProvider: null,
            sorter: (a, b) => {
                let res = this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(b) - this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(a);
                return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: Types.section.NotificationModule.TASKS,
            checkShowAllAvailSections: false,
            session: session,
        }


        let conv2ListOptions: component.remoteconv2list.RemoteConv2ListOptions = {
            elementsCountProvider: conversation => this.getRemoteConversationElementsCount(hostHash, conversation),
            unreadProvider: c2s => this.getUnread(session, c2s),
            searchCountProvider: c2s => this.tasksPlugin.getSearchCount(session, c2s),
            searchAllSearchedProvider: null,
            withSpinnerProvider: c2s => this.getWithSpinner(session, c2s),
            sorter: (a, b) => {
                return this.getOrCreateRemoteTasksCountManager(hostHash).getConv2LastDate(b) - this.getOrCreateRemoteTasksCountManager(hostHash).getConv2LastDate(a);
            },
            hideConversations: true,
            assignedTo: true,
            session: session,
        };
        
        let hostList = hostEntry;
        hostList.sectionList = this.addComponent("remoteSectionsList-" + hostHash, this.componentFactory.createComponent("remotesectionlist", [this, sectionsListOptions]));
        hostList.sectionList.ipcMode = true;
        hostList.conv2List = this.addComponent("remoteConv2List-" + hostHash, this.componentFactory.createComponent("remoteconv2list", [this, conv2ListOptions]));
        hostList.conv2List.ipcMode = true;
        this.remoteServers[hostHash] = hostList;
        this.sidebar.registerRemoteSectionsList(hostHash, hostList.sectionList);
        this.sidebar.registerRemoteConv2List(hostHash, hostList.conv2List);

    }


    openRemoteTaskGroupsPanel(hostHash: string, section: mail.section.SectionService|mail.section.Conv2Section|string): Q.Promise<void> {
        return Q().then(() => {
            return this.app.sessionManager.init(hostHash);
        })
        .then(() => {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            this.tasksPlugin.ensureSessionInit(session);
            this.tasksPlugin.ensureInitSessionCollections(session);
            return this.afterViewLoaded.promise.then(() => {
                let projectId = typeof section == "string" ? section : TasksWindowController.getProjectId(section);
                let sectionName = (section instanceof mail.section.SectionService) ? section.getName() : (typeof section == "string" ? "" : section.getFirstPerson().getName());
                // console.log("openRemoteGroupsPanel - id: ", projectId, "name: ", sectionName);
                if (section instanceof mail.section.SectionService) {
                    return this.tasksPlugin.ensureProjectExists(projectId, sectionName, session);
                }
            })
            .then(() => {
                // console.log("openRemoteGroupsPanel - ensureProjectExists after")
                return this.getTaskGroupsPanel(session, section, hostHash).then(panel => {
                    if (!panel.wasDataSet) {
                        // console.log("set panel data");
                        return panel.setSectionData(section).then(() => Q(panel));  
                    }
                    return panel;
                }).then(panel => {
                    // console.log("on openRemoteTaskGroupsPanel - panel created")
                    this.activeProjectId = TasksWindowController.getProjectId(section);
                    this.activeProjectHostHash = hostHash;
                    if (this.activePanel) {
                        this.activePanel.deactivate();
                    }
                    panel.beforeActivate();
                    this.activePanel = panel;
                    this.tasksPlugin.activeTaskGroupsPanel = panel;
                    this.afterViewLoaded.promise.then(() => {
                        this.callViewMethod("openTaskGroupsPanel", session.hostHash, TasksWindowController.getProjectId(section));
                    });
                });
            })

        });
    }
    
    getOrCreateRemoteTasksCountManager(hostHash: string): TasksCountManager {
        if (!(hostHash in this.remoteTasksCountManagers)) {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            this.remoteTasksCountManagers[hostHash] = new TasksCountManager(session, null, this.tasksPlugin, this.sidebar, true);
        }
        return this.remoteTasksCountManagers[hostHash];
    }
    
    getRemoteSectionElementsCount(hostHash: string, section: mail.section.SectionService): number {
        let rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getSectionElementsCount(section);
    }
    
    getRemoteConversationElementsCount(hostHash: string, conversation: mail.section.Conv2Section): number {
        let rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getConv2ElementsCount(conversation);
    }
    
    getRemoteSectionUnreadElementsCount(hostHash: string, section: mail.section.SectionService): number {
        let rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getSectionElementsCount(section);
    }
    
    getRemoteConversationUnreadElementsCount(hostHash: string, conversation: mail.section.Conv2Section): number {
        let rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getConv2ElementsCount(conversation);
    }
    
    getTaskGroupsPanelKey(hostHash: string, projectId: string): string {
        return `${hostHash}--${projectId}`;
    }

    static getProjectId(section: mail.section.SectionService|mail.section.Conv2Section|string): string {
        if (section instanceof mail.section.Conv2Section) {
            return section.id;
        }
        return typeof(section) == "string" ?  section :  section.getId();
    }
}
