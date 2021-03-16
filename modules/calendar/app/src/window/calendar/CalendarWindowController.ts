import { window, component, Types, Q, utils, mail, app} from "pmc-mail";
import { CalendarPanelController } from "../../component/calendarPanel/CalendarPanelController";
import Dependencies = utils.decorators.Dependencies;
import { CalendarPlugin, CalendarTaskPreviewRequestEvent, CalendarDayPreviewRequestEvent, CalendarPreviewUpdateRequestEvent, CalendarTaskPreviewChangeVisibilityRequestEvent, HorizontalCalendarTaskPreviewWindowLayoutChangeRequestEvent, CalendarBadgesUpdateRequestEvent, CalendarSearchUpdateEvent, CalendarComponentFactory, CalendarDayPreviewChangeVisibilityRequestEvent, CalendarSettingChanged, CalendarsFileAdded, CalendarsFileRemoved, ExtraCalendarsChanged } from "../../main/CalendarPlugin";
import { CalendarTasksCountManager } from "../../main/CalendarTasksCountManager";
import { TaskPanelController } from "privfs-mail-client-tasks-plugin/src/component/taskPanel/TaskPanelController";
import { CustomTasksElements, ViewContext, Modes } from "../../main/Types";
import { DatePickerController } from "../../component/datePicker/DatePickerController";
import { Watchable, Action, EventHandler } from "privfs-mail-client-tasks-plugin/src/main/Types";
import { i18n } from "./i18n/index";
import Inject = utils.decorators.Inject;

export interface Model {
    docked: boolean;
    myId: string;
    activeProjectId: string;
    privateSectionId: string;
    horizontalTaskLayout: boolean;
    enableDayPreviewPanel: boolean;
    showTaskPreviewPanel: boolean;
    showTaskTooltip: boolean;
}

@Dependencies(["splitter", "extlist", "persons", "notification", "calendarPanel", "sidebar"])
export class CalendarWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.calendar.window.calendar.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static ENABLE_PREVIEW_IN_WEEK_MODE: boolean = false;
    @Inject router: app.common.Router;
    docked: boolean;
    activeProjectId: string;
    activeProjectHostHash: string;
    verticalSplitter: component.splitter.SplitterController;
    verticalSplitter2: component.splitter.SplitterController;
    horizontalSplitter: component.splitter.SplitterController;
    calendarsSplitter: component.splitter.SplitterController;
    personsComponent: component.persons.PersonsController;
    notifications: component.notification.NotificationController;
    sectionTooltip: component.sectiontooltip.SectionTooltipController;
    datePicker: DatePickerController;
    sidebar: component.sidebar.SidebarController;
    componentFactory: CalendarComponentFactory;
    calendarPlugin: CalendarPlugin;
    subSettings: { [key: string]: utils.Settings } = {};
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    privateSection: mail.section.SectionService;
    dirty: boolean = false;
    calendarTasksCountManager: CalendarTasksCountManager;
    remoteCalendarTasksCountManagers: { [hostHash: string]: CalendarTasksCountManager } = {};
    calendar1PanelPromises: { [key: string]: Q.Promise<CalendarPanelController> } = {};
    calendar2PanelPromises: { [key: string]: Q.Promise<CalendarPanelController> } = {};
    previewPanel: TaskPanelController;
    activePanel1: CalendarPanelController;
    activePanel2: CalendarPanelController;
    disabledSection: component.disabledsection.DisabledSectionController;
    dataChangedListener: EventHandler;
    remoteDataChangedListeners: { [hostHash: string]: EventHandler } = {};
    historyStateProjectId: string;
    
    remoteServers: {[hostHash: string]: component.remotehostlist.HostEntry} = {};

    constructor(parentWindow: Types.app.WindowParent, docked: boolean) {
        super(parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "calendar-splitter-vertical": { defaultValue: 340 },
                "calendar-splitter-vertical2-proportional": { defaultValue: JSON.stringify({handlePos:600,totalSize:1600}) },
                "calendar-splitter-horizontal-proportional": { defaultValue: JSON.stringify({handlePos:300,totalSize:1000}) },
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({handlePos:250,totalSize:1000}) },
                "calendar-splitter-calendars-proportional": { defaultValue: JSON.stringify({handlePos:800,totalSize:1600}) },
            }
        });
        this.ipcMode = true;
        
        this.docked = docked;
        let localSession = this.app.sessionManager.getLocalSession();
        this.setPluginViewAssets("calendar");
        this.addViewStyle({path: "window/component/taskPanel/template/main.css", plugin: "tasks"});
        this.addViewScript({path: "build/view.js", plugin: "tasks"});
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 900;
        this.openWindowOptions.height = 500;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = this.i18n("plugin.calendar.window.calendar.title");
        this.openWindowOptions.icon = "icon fa fa-calendar";
        this.calendarPlugin = this.app.getComponent("calendar-plugin");
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.sectionTooltip = this.addComponent("sectiontooltip", this.componentFactory.createComponent("sectiontooltip", [this]));
        this.datePicker = this.addComponent("datePicker", this.componentFactory.createComponent("datePicker", [this, {
            prev: true,
            next: true,
            day: true,
            month: true,
            year: true,
            buttons: false,
        }]));
        this.disabledSection = this.addComponent("disabled-section", this.componentFactory.createComponent("disabledsection", [this, Types.section.NotificationModule.CALENDAR]));
        this.bindEvent<CalendarSettingChanged>(this.app, "calendar-setting-changed", async (event) => {
            if (event.setting == "enable-day-preview-panel") {
                await this.onToggleDayPreviewPanel(!!event.value);
            }
            else if (event.setting == "horizontal-task-preview-window-layout") {
                this.previewPanel.overrideIsHorizontalLayout = !!this.calendarPlugin.getSetting(localSession, "horizontal-task-preview-window-layout", null, null);
                this.previewPanel.refreshIsHorizontalLayout();
            }
            else if (event.setting == "show-files") {
                let showFiles = !!this.calendarPlugin.getSetting(localSession, "show-files", null, null);
                let refreshSidebarCounts = false;
                if (this.calendarTasksCountManager && this.calendarTasksCountManager.countFiles != showFiles) {
                    this.calendarTasksCountManager.countFiles = showFiles;
                    refreshSidebarCounts = true;
                }
                for (let hostHash in this.remoteCalendarTasksCountManagers) {
                    if (this.remoteCalendarTasksCountManagers[hostHash].countFiles != showFiles) {
                        this.remoteCalendarTasksCountManagers[hostHash].countFiles = showFiles;
                        refreshSidebarCounts = true;
                    }
                }
                if (refreshSidebarCounts) {
                    this.refreshSidebarCounts();
                }
            }
        });
        this.bindEvent<Types.event.ActiveAppWindowChangedEvent>(this.app, "active-app-window-changed", e => {
            this.callViewMethod("setIsCalendarTabOpen", e.appWindowId == "calendar");
        });
        this.dataChangedListener = this.onDataChanged.bind(this);
        this.calendarPlugin.tasksPlugin.watch(localSession, "*", "*", "*", this.dataChangedListener);
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
        let data = this.app.searchModel.get();
        let isSearchOn = data.visible && data.value.length > 1;
        this.callViewMethod("onSearchChanged", isSearchOn, false);
        
        this.initSpellChecker();
    }
    
    beforeClose(): void {
        this.calendarPlugin.tasksPlugin.unWatch(this.app.sessionManager.getLocalSession(), "*", "*", "*", this.dataChangedListener);
        for (let hostHash in this.remoteDataChangedListeners) {
            this.calendarPlugin.tasksPlugin.unWatch(this.app.sessionManager.sessions[hostHash], "*", "*", "*", this.remoteDataChangedListeners[hostHash]);
        }
        for (let id in this.calendar1PanelPromises) {
            this.calendar1PanelPromises[id].then(panel => panel.beforeClose());
        }
        for (let id in this.calendar2PanelPromises) {
            this.calendar2PanelPromises[id].then(panel => panel.beforeClose());
        }
        this.previewPanel.beforeClose();
    }
    
    init() {
        let localSession = this.app.sessionManager.getLocalSession();
        this.privateSection = localSession.sectionManager.getMyPrivateSection();
        this.calendarTasksCountManager = new CalendarTasksCountManager(localSession, this.privateSection, this.calendarPlugin, this.calendarPlugin.tasksPlugin, this.sidebar, !!this.calendarPlugin.getSetting(localSession, "show-files", null, null));
        
        this.previewPanel = this.addComponent("previewPanel", (<any>this.componentFactory).createComponent("taskpanel", [this, localSession, this.personsComponent, {
            close: () => this.close(),
            confirm: (msg: string) => this.confirm(msg),
            confirmEx: this.confirmEx.bind(this),
            openWindowParent: this,
            openChildWindow: this.openChildWindow.bind(this),
            updateDirty: this.updateDirty.bind(this),
        }, true, false, []]));
        this.previewPanel.overrideIsHorizontalLayout = !!this.calendarPlugin.getSetting(localSession, "horizontal-task-preview-window-layout", null, null);
        this.verticalSplitter = this.addComponent("verticalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-vertical")]));
        this.verticalSplitter2 = this.addComponent("verticalSplitter2", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-vertical2-proportional")]));
        this.horizontalSplitter = this.addComponent("horizontalSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-horizontal-proportional")]));
        this.calendarsSplitter = this.addComponent("calendarsSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("calendar-splitter-calendars-proportional")]));
        this.verticalSplitter.ipcMode = true;
        this.verticalSplitter2.ipcMode = true;
        this.horizontalSplitter.ipcMode = true;
        this.calendarsSplitter.ipcMode = true;
        
        this.subSettings["active-project-id"] = this.settings.create("active-project-id");
        
        this.activeProjectId = this.historyStateProjectId ? this.historyStateProjectId : this.calendarPlugin.getPrivateSectionId();
        this.activeProjectHostHash = localSession.hostHash;
        this.calendarPlugin.tasksPlugin.projectsReady.then(() => {
            this.selectProject(this.getActiveSession(), this.activeProjectId ? this.activeProjectId : this.calendarPlugin.getPrivateSectionId());
        });
        
        let promProjectCreator = Q();
        let prevUpdate: Date = null;
        this.registerChangeEvent(this.calendarPlugin.tasksPlugin.tasksSectionsCollection[localSession.hostHash].changeEvent, event => {
            if (event.type == "add") {
                promProjectCreator = promProjectCreator.then(() => <any>this.calendarPlugin.tasksPlugin.ensureProjectExists(event.element.getId(), event.element.getName(), localSession)).then(() => {
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
                        this.callViewMethod("renderProjectsPanel");
                        return <any>Q.resolve();
                    });
                }, 100);
            }
        });
        for (let element of this.calendarPlugin.tasksPlugin.tasksSectionsCollection[localSession.hostHash].list) {
            let id = element.getId();
            let name = element.getName();
            if (id == this.calendarPlugin.getPrivateSectionId()) {
                name = this.i18n("plugin.calendar.window.calendar.sidebar.private");
            }
            promProjectCreator = promProjectCreator.then(() => <any>this.calendarPlugin.tasksPlugin.ensureProjectExists(id, name, localSession));
        }
        
        this.bindEvent<CalendarsFileAdded>(this.app, "calendars-file-added", e => {
            if (e.hostHash == localSession.hostHash) {
                this.calendarTasksCountManager.addFile(e.identifier);
            }
            else {
                this.getOrCreateRemoteTasksCountManager(e.hostHash).addFile(e.identifier);
            }
        });
        this.bindEvent<CalendarsFileRemoved>(this.app, "calendars-file-removed", e => {
            if (e.hostHash == localSession.hostHash) {
                this.calendarTasksCountManager.removeFile(e.identifier);
            }
            else {
                this.getOrCreateRemoteTasksCountManager(e.hostHash).removeFile(e.identifier);
            }
        });
        this.bindEvent<ExtraCalendarsChanged>(this.app, "extra-calendars-changed", e => {
            this.refreshSidebarCounts();
        });
        
        this.bindEvent(this.app, "focusChanged", (event) => {
            let windowId = (<any>event).windowId;
            this.calendarPlugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? (<window.container.ContainerWindowController>this.parent.parent).activeModel.get() : windowId;
            if (windowId == "tasks" || (windowId == "main-window" && (<window.container.ContainerWindowController>this.parent.parent).activeModel.get() == "tasks") ) {
                setTimeout(() => {
                    this.callViewMethod("grabFocus", true);
                }, 200);
            }
        });
        this.bindEvent(this.app, "focusLost", (event) => {
            this.calendarPlugin.activeWindowFocused = null;
        });
        
        
        this.bindEvent(this.app, "onToggleMaximize-notify", () => {
            setTimeout(() => {
                this.callViewMethod("grabFocus", false);
            }, 10);
        });
        
        this.bindEvent(this.app, "focusLost", () => {
            this.callViewMethod("pauseTimeAgoRefresher");
        });
        
        this.bindEvent(this.app, "focusChanged", event => {
            if ((<any>event).windowId == "main-window") {
                this.callViewMethod("resumeTimeAgoRefresher");
            }
        });
        
        return Q().then(() => {
            return Q.all([
                this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                this.calendarPlugin.sectionManager.isSectionsLimitReached()
            ])
        })
        .then(res => {
            let [identityProvider, isSectionsLimitReached] = res;
            let customElements: component.customelementlist.CustomElement[] = [];
            if (this.calendarPlugin.getPrivateSectionId()) {
                customElements.push(
                    {
                        id: this.calendarPlugin.getPrivateSectionId(),
                        icon: {
                            type: "hashmail",
                            value: this.calendarPlugin.identity.hashmail,
                        },
                        label: this.i18n("plugin.calendar.window.calendar.sidebar.private"),
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
                        value: "privmx-icon privmx-icon-calendar",
                    },
                    label: this.i18n("plugin.calendar.window.calendar.sidebar.all"),
                    private: false,
                },
                {
                    id: CustomTasksElements.TASKS_CREATED_BY_ME_ID,
                    icon: {
                        type: "hashmail",
                        value: this.calendarPlugin.identity.hashmail,
                    },
                    label: this.i18n("plugin.calendar.window.calendar.sidebar.created-by-me"),
                    private: false,
                },
                {
                    id: CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
                    icon: {
                        type: "hashmail",
                        value: this.calendarPlugin.identity.hashmail,
                    },
                    label: this.i18n("plugin.calendar.window.calendar.sidebar.assigned-to-me"),
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
                    label: this.i18n("plugin.calendar.window.calendar.sidebar.trash"),
                    private: false,
                }
            );
            
            let sidebarOptions: component.sidebar.SidebarOptions = {
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: new utils.collection.MutableCollection(customElements),
                    elementsCountProvider: ce => this.calendarTasksCountManager.getCustomElementElementsCount(ce),
                    unreadProvider: ce => this.getUnread(localSession, ce),
                    searchCountProvider: ce => this.calendarPlugin.getSearchCount(localSession, ce),
                    unmutedUnreadProvider: ce => this.getUnread(localSession, ce, true),
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    elementsCountProvider: c2s => this.calendarTasksCountManager.getConv2ElementsCount(c2s),
                    unreadProvider: c2s => this.getUnread(localSession, c2s),
                    searchCountProvider: c2s => this.calendarPlugin.getSearchCount(localSession, c2s),
                    searchAllSearchedProvider: null,
                    unmutedUnreadProvider: c2s => this.getUnread(localSession, c2s, true),
                    sorter: (a, b) => {
                        return this.calendarTasksCountManager.getConv2LastDate(b) - this.calendarTasksCountManager.getConv2LastDate(a);
                    },
                    hideConversations: true,
                    assignedTo: true,
                },
                sectionList: {
                    baseCollection: this.calendarPlugin.sidebarSectionsCollection,
                    elementsCountProvider: section => this.calendarTasksCountManager.getSectionElementsCount(section),
                    unreadProvider: section => this.getUnread(localSession, section),
                    searchCountProvider: section => this.calendarPlugin.getSearchCount(localSession, section),
                    searchAllSearchedProvider: null,
                    moduleName: Types.section.NotificationModule.CALENDAR,
                    sorter: (a, b) => {
                        let res = this.calendarTasksCountManager.getSectionLastDate(b) - this.calendarTasksCountManager.getSectionLastDate(a);
                        return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                customSectionList: {
                    baseCollection: null,
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                    moduleName: Types.section.NotificationModule.CALENDAR,
                    sorter: null
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: component.remotehostlist.ElementCountsAggregationStrategy.SECTIONS,
                },
                conv2ListEnabled: true,
                conv2Splitter: this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: [],
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push(
                    {
                        id: "new-section",
                        label: this.i18n("plugin.calendar.window.calendar.sidebar.newsection"),
                        title: this.i18n("plugin.calendar.window.calendar.sidebar.newsection"),
                        icon: "ico-comment",
                        windowOpener: true,
                        onSectionList: true
                    }
                );
            }

            this.sidebar = this.addComponent("sidebar", this.componentFactory.createComponent("sidebar", [this, sidebarOptions]));
            this.bindEvent(this.sidebar, "elementbeforeactivate", this.onBeforeActivateSidebarElement.bind(this));
            this.bindEvent(this.sidebar, "elementactivated", this.onActivatedSidebarElement.bind(this));
            this.bindEvent(this.sidebar, "sidebarbuttonaction", this.onSidebarButtonAction.bind(this));
            this.sidebar.usersListTooltip.getContent = (sectionId: string): string => {
                return this.app.getUsersListTooltipContent(this.app.sessionManager.getLocalSession(), sectionId);
            }
            
            this.bindEvent(this.app, "reopen-section", (event: component.disabledsection.ReopenSectionEvent) => {
                this.selectProject(localSession, event.element.getId());
            });
            this.bindEvent<Types.event.SectionsLimitReachedEvent>(this.app, "sectionsLimitReached", event => {
                this.sidebar.onSectionsLimitReached(event.reached);
            });
            this.calendarTasksCountManager.sidebar = this.sidebar;
            this.initSessionEvents(localSession);
            this.setSidebarActiveItem(this.getActiveSession(), this.activeProjectId);
            
            this.bindEvent<CalendarSearchUpdateEvent>(this.app, "calendar-search-update", event => {
                let refreshAvatars = this.updateSidebarCustomElements(this.app.sessionManager.getLocalSession(), this.sidebar.customElementList.customElementsCollection);
                this.updateBadges();
                this.callViewMethod("onSearchChanged", event.searchString.length > 0, refreshAvatars);
            });
            
            this.app.dispatchEvent({type: "focusChanged", windowId: "tasks"});
            return <any>this.calendarPlugin.checkInit().then(() => this.calendarPlugin.tasksPlugin.projectsReady).then(() => {
                return this.datePicker.init();
            }).then(() => {
                return this.previewPanel.init();
            })
            .then(() => {
                this.selectProject(this.getActiveSession(), this.activeProjectId);
            });
        })
    }
    
    getActiveSession(): mail.session.Session {
        if (this.activeProjectHostHash && this.app.sessionManager.isSessionExistsByHostHash(this.activeProjectHostHash)) {
            return this.app.sessionManager.getSessionByHostHash(this.activeProjectHostHash);
        }
        return this.app.sessionManager.getLocalSession();
    }
    
    isSectionPrimary(session: mail.session.Session, section: mail.section.SectionService) {
        let cps = this.calendarPlugin.calendarPrimarySections;
        return cps && cps[session.hostHash].contains(section);
    }
    
    openDisabledSectionView(session: mail.session.Session, section: mail.section.SectionService) {
        this.sidebar.setActive({
            type: this.isSectionPrimary(session, section) ? component.sidebar.SidebarElementType.CUSTOM_SECTION : component.sidebar.SidebarElementType.SECTION,
            section: section,
        }, false);
        this.calendarPlugin.activeSinkId = section.getChatSink().id;
        this.calendarPlugin.activeSinkHostHash = session.hostHash;
        this.disabledSection.setSection(section);
        this.callViewMethod("toggleDisabledSection", true);
    }
    
    updateSidebarCustomElements(session: mail.session.Session, collection: utils.collection.BaseCollection<component.customelementlist.CustomElement>, all: boolean = false): boolean {
        let hostHash = session.hostHash;
        let refreshAvatars = false;
        let len = collection.size();
        for (let i = 0; i < len; ++i) {
            let el = collection.get(i);
            if (all || this.calendarPlugin.searchCountsModified[hostHash][el.id]) {
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
            if (all || this.calendarPlugin.searchCountsModified[hostHash][collection.get(i).getId()]) {
                collection.triggerUpdateAt(i);
            }
        }
    }
    
    updateConv2Sections(session: mail.session.Session, collection: utils.collection.SortedCollection<mail.section.Conv2Section>, all: boolean = false) {
        let hostHash = session.hostHash;
        let len = collection.size();
        for (let i = 0; i < len; ++i) {
            if (all || this.calendarPlugin.searchCountsModified[hostHash][collection.get(i).id]) {
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
        if (event.element.type == component.sidebar.SidebarElementType.SECTION) {
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CALENDAR,
                contextType: "section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: localSession.hostHash
            });            
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.section.getId());
        }
        else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
            let session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CALENDAR,
                contextType: "remote-section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: event.element.hostHash
            });            
            this.contextHistory.append(context);
            this.selectProject(session, event.element.section.getId());
        }
        else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            let session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CALENDAR,
                contextType: "remote-conversation",
                contextId: event.element.conv2.id,
                hostHash: event.element.hostHash
            });            
            this.contextHistory.append(context);
            this.selectProject(session, event.element.conv2.id);
        }
        else if (event.element.type == component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CALENDAR,
                contextType: "custom",
                contextId: event.element.customElement.id,
                hostHash: localSession.hostHash
            });            
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.customElement.id);
        }
        else if (event.element.type == component.sidebar.SidebarElementType.CONVERSATION) {
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CALENDAR,
                contextType: "conversation",
                contextId: event.element.conv2.id,
                hostHash: localSession.hostHash
            });            
            this.contextHistory.append(context);
            this.selectProject(localSession, event.element.conv2.id);
        }
    }
    
    onSidebarButtonAction(event: component.sidebar.SidebarButtonActionEvent) {
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }
    }
    
    openSectionsWindow(): void {
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
        // if (section instanceof mail.section.SectionService) {
        //     return this.calendarPlugin.getUnreadForSection(section.getId());
        // }
        // else if (section instanceof mail.section.Conv2Section) {
        //     return this.calendarPlugin.getUnreadForConv2Section(section.id, skipMuted);
        // }
        // else if (section.id == CustomTasksElements.ALL_TASKS_ID) {
        //     return null;
        // }
        // else if (section.id == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID) {
        //     return this.calendarPlugin.getUnread(true, false);
        // }
        // else if (section.id == CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
        //     return this.calendarPlugin.getUnread(false, true, skipMuted);
        // }
        // else if (section.id == CustomTasksElements.TRASH_ID) {
        //     return this.calendarPlugin.getUnread(false, false, false, true);
        // }
        return 0;
    }
    
    applyHistoryState(processed: boolean, state: string) {
        let usedState = state;
        let localSession = this.app.sessionManager.getLocalSession();
        const context = this.contextHistory.getCurrent();

        if (context) {
            if (this.app.switchModuleWithContext() || state) {
                if (context.getType() == "section") {
                    let contextSection = localSession.sectionManager.getSection(context.getSectionIdFromContextId());
                    if (contextSection && contextSection.isCalendarModuleEnabled()) {
                        usedState = context.getSectionIdFromContextId();
                    }
                }
                else if (context.getType() == "conversation") {
                    const contextData = context.getContextId().split(":");
                    if (contextData[2].split("|").length < 3) {
                        usedState = context.getContextId();
                    }
                }
                else if (context.getType() == "custom") {
                    const subId = context.getContextId();
                    if (subId == "private") {
                        let privateSection = localSession.sectionManager.getMyPrivateSection();
                        if (privateSection) {
                            usedState = privateSection.getId();
                        }    
                    }
                    else {
                        usedState = subId;
                    }
                }
            }
        }
        this.app.resetModuleSwitchingModifier();

        if (usedState != null) {
            this.historyStateProjectId = usedState;
            if (this.activeProjectId !== usedState && this.activeProjectHostHash !== localSession.hostHash) {
                this.activeProjectId = usedState;
                this.activeProjectHostHash = localSession.hostHash;
                this.selectProject(localSession, usedState);
            }
        }
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
        for (let hostHash in this.remoteCalendarTasksCountManagers) {
            this.remoteCalendarTasksCountManagers[hostHash].updateSidebarHostElement();
        }
    }
    
    getModel(): Model {
        let localSession = this.app.sessionManager.getLocalSession();
        return {
            docked: this.docked,
            myId: this.calendarPlugin.getMyId(this.app.sessionManager.getLocalSession()),
            activeProjectId: this.activeProjectId,
            privateSectionId: this.calendarPlugin.getPrivateSectionId(),
            horizontalTaskLayout: this.calendarPlugin.getSetting(localSession, "horizontal-task-preview-window-layout", null, null) ? true : false,
            enableDayPreviewPanel: this.calendarPlugin.getSetting(localSession, "enable-day-preview-panel", null, null) ? true : false,
            showTaskPreviewPanel: this.calendarPlugin.getSetting(localSession, "show-task-preview-panel", null, null) ? true : false,
            showTaskTooltip: this.calendarPlugin.getSetting(localSession, "show-task-tooltip", null, null) ? true : false,
        };
    }
    
    setSidebarActiveItem(session: mail.session.Session, projectId: string): void {
        let fixedSectionsNames = [
            CustomTasksElements.ALL_TASKS_ID,
            CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            CustomTasksElements.TRASH_ID,
            this.calendarPlugin.getPrivateSectionId(),
        ];
        if (session.sessionType == "local") {
            if (fixedSectionsNames.indexOf(projectId) >= 0) {
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
                    customElement: this.sidebar.options.customElementList.baseCollection.find(x => x.id == projectId),
                }, false);
                this.calendarPlugin.activeSinkId = null;
                this.calendarPlugin.activeSinkHostHash = null;
            }
            else if (this.calendarPlugin.tasksPlugin.isConv2Project(projectId)) {
                let conv2 = this.calendarPlugin.conv2Service.collection.find(c2s => c2s.id == projectId);
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.CONVERSATION,
                    conv2: conv2,
                }, false);
                this.calendarPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
            else if (session.sectionManager.getSection(projectId)) {
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.SECTION,
                    section: session.sectionManager.getSection(projectId),
                }, false);
                this.calendarPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
        }
        else if (session.sessionType == "remote") {
            if (this.calendarPlugin.tasksPlugin.isConv2Project(projectId)) {
                let conv2 = session.conv2Service.collection.find(c2s => c2s.id == projectId);
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                    conv2: conv2,
                    hostHash: session.hostHash,
                }, false);
                this.calendarPlugin.activeSinkId = conv2 && conv2.sinkIndex ? conv2.sinkIndex.sink.id : null;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
            else if (session.sectionManager.getSection(projectId)) {
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.REMOTE_SECTION,
                    section: session.sectionManager.getSection(projectId),
                    hostHash: session.hostHash,
                }, false);
                this.calendarPlugin.activeSinkId = session.sectionManager.getSection(projectId).getChatSink().id;
                this.calendarPlugin.activeSinkHostHash = session.hostHash;
            }
        }
    }
    
    selectProject(session: mail.session.Session, projectId: string) {
        if (!this.sidebar) {
            return;
        }
        let fixedSectionsNames = [
            CustomTasksElements.ALL_TASKS_ID,
            CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID,
            CustomTasksElements.TASKS_CREATED_BY_ME_ID,
            CustomTasksElements.TRASH_ID,
            this.calendarPlugin.getPrivateSectionId(),
        ];
        this.setSidebarActiveItem(session, projectId);
        let activeId: string;
        let rootId: string;
        this.callViewMethod("toggleDisabledSection", false);
        let prom1 = Q();
        let prom2 = Q();
        if (fixedSectionsNames.indexOf(projectId) >= 0) {
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CALENDAR,
                contextType: "custom",
                contextId: projectId,
                hostHash: session.hostHash
            });    
            this.contextHistory.append(context);

            activeId = projectId;
            rootId = projectId;
            if (projectId == this.calendarPlugin.getPrivateSectionId()) {
                if (this.privateSection) {
                    prom1 = this.openCalendar1Panel(session, this.privateSection);
                    prom2 = this.openCalendar2Panel(session, this.privateSection);
                }
            }
            else {
                prom1 = this.openCalendar1Panel(session, projectId);
                prom2 = this.openCalendar2Panel(session, projectId);
            }
        }
        else if (this.calendarPlugin.tasksPlugin.isConv2Project(projectId)) {
            let c2s = this.calendarPlugin.tasksPlugin.getConv2Section(session, projectId);
            if (c2s) {
                const context = app.common.Context.create({
                    moduleName: Types.section.NotificationModule.CALENDAR,
                    contextType: "conversation",
                    contextId: projectId,
                    hostHash: session.hostHash
                });    
                this.contextHistory.append(context);
    
                this.afterViewLoaded.promise.then(() => {
                    prom1 = this.openCalendar1Panel(session, c2s);
                    prom2 = this.openCalendar2Panel(session, c2s);
                });
                activeId = c2s.id;
                rootId = c2s.id;
            }
        }
        else {
            let section = session.sectionManager.getSection(projectId);
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CALENDAR,
                contextType: "section",
                contextId: "section:" + projectId,
                hostHash: session.hostHash
            });    
            this.contextHistory.append(context);

            if (section instanceof mail.section.SectionService && !section.isCalendarModuleEnabled()) {
                this.disabledSection.setSection(section);
                this.callViewMethod("toggleDisabledSection", true);
                return;
            }
            
            let state = session.sectionManager.getDescantsForModule(projectId, "calendar");
            if (state == null) {
                return;
            }
            this.afterViewLoaded.promise.then(() => {
                prom1 = this.openCalendar1Panel(session, state.active);
                prom2 = this.openCalendar2Panel(session, state.active);
            });
            activeId = state.active.getId();
            rootId = state.active.getId();
        }
        let enableDayPreview = !!this.calendarPlugin.getSetting(this.getActiveSession(), "enable-day-preview-panel", this.activeProjectId, ViewContext.CalendarWindow);
        this.afterViewLoaded.promise.then(() => {
            Q.all([prom1, prom2]).then(() => {
                return this.onToggleDayPreviewPanel(enableDayPreview, activeId, session);
            });
        });
    }
    
    onSectionsCollectionChange(session: mail.session.Session, event: Types.utils.collection.CollectionEvent<mail.section.SectionService>): void {
        // if (event.type == "update" && event.element) {
        //     // this.callViewMethod("updateProjectName", event.element.getId(), event.element.getName());
        // }
        // else if (event.type == "remove" && event.element) {
        if (event.type == "remove" && event.element) {
            let countsManager: CalendarTasksCountManager = null;
            let customElementList: component.customelementlist.CustomElementListController = null;
            let sectionList: component.sectionlist.SectionListController | component.remotesectionlist.RemoteSectionListController = null;
            let conv2List: component.conv2list.Conv2ListController | component.remoteconv2list.RemoteConv2ListController = null;
            if (session.hostHash == this.app.sessionManager.getLocalSession().hostHash) {
                countsManager = this.calendarTasksCountManager;
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
    }
    
    setActiveProjectId(session: mail.session.Session, value: string): void {
        this.activeProjectId = value;
        this.activeProjectHostHash = session.hostHash;
    }
    
    getProjectId(section: mail.section.SectionService|mail.section.Conv2Section|string): string {
        if (section instanceof mail.section.Conv2Section) {
            return section.id;
        }
        return typeof(section) == "string" ? section : (section ? section.getId() : null);
    }
    
    getCalendar1Panel(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|string): Q.Promise<CalendarPanelController> {
        return this.createCalendar1Panel(session, this.getProjectId(section));
    }
    
    createCalendar1Panel(session: mail.session.Session, projectId: string): Q.Promise<CalendarPanelController> {
        let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
        if (calendarPanelKey in this.calendar1PanelPromises) {
            return this.calendar1PanelPromises[calendarPanelKey];
        }
        
        let panel = this.addComponent("calendar1Panel-" + calendarPanelKey, this.componentFactory.createComponent("calendarPanel", [this, this.personsComponent]));
        return this.calendar1PanelPromises[calendarPanelKey] = Q().then(() => {
            return this.calendarPlugin.initSession(session);
        })
        .then(() => {
            return panel.setSession(session);
        })
        .then(() => {
            panel.calendarId = 1;
            panel.init();
            this.bindEvent<CalendarTaskPreviewRequestEvent>(panel, "calendar-task-preview-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.previewPanel.setTaskId(session, event.task);
                    let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
                    let otherPanelPromise = this.calendar2PanelPromises[calendarPanelKey];
                    if (otherPanelPromise) {
                        otherPanelPromise.then(otherPanel => otherPanel.markTaskAsSelected(event.task));
                    }
                    if (!event.task) {
                        return;
                    }
                    
                    let task = this.calendarPlugin.tasksPlugin.tasks[session.hostHash][event.task];
                    if (task && this.calendarPlugin.wasTaskUnread(session, task, task.getProjectId())) {
                        this.calendarPlugin.markTaskAsWatched(session, task.getId(), task.getProjectId());
                        this.updateBadges();
                    }
                });
            });
            this.bindEvent<CalendarDayPreviewRequestEvent>(panel, "calendar-day-preview-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.previewDay(event.day);
                });
            });
            this.bindEvent<CalendarPreviewUpdateRequestEvent>(panel, "calendar-preview-update-request", () => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.previewPanel.updateView();
                });
            });
            this.bindEvent<CalendarDayPreviewChangeVisibilityRequestEvent>(panel, "calendar-day-preview-change-visibility-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(async () => {
                    let canFirstCalendarShowPreview = await this.canFirstCalendarShowPreview(session);
                    this.callViewMethod("changeDayPreviewPanelVisibility", !canFirstCalendarShowPreview && event.show);
                });
            });
            this.bindEvent<CalendarTaskPreviewChangeVisibilityRequestEvent>(panel, "calendar-task-preview-change-visibility-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("changeTaskPreviewPanelVisibility", event.show);
                });
            });
            this.bindEvent<HorizontalCalendarTaskPreviewWindowLayoutChangeRequestEvent>(panel, "horizontal-calendar-task-preview-window-layout-change-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("updatePreviewLocation", event.horizontalLayout);
                });
            });
            this.bindEvent<CalendarBadgesUpdateRequestEvent>(panel, "calendar-badges-update-request", event => {
                this.afterViewLoaded.promise.then(() => {
                    this.updateBadges();
                });
            });
            
            this.afterViewLoaded.promise.then(() => {
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("createCalendar1Panel", session.hostHash, projectId);
                });
            });
            
            return Q(panel);
    
        })
    }
    
    openCalendar1Panel(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|string): Q.Promise<void> {
        return this.openRemoteCalendar1Panel(session.hostHash, section);
    }

    openRemoteCalendar1Panel(hostHash: string, section: mail.section.SectionService|mail.section.Conv2Section|string): Q.Promise<void> {
        return Q().then(() => {
            return this.app.sessionManager.init(hostHash);
        })
        .then(() => {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            this.calendarPlugin.tasksPlugin.ensureSessionInit(session);
            this.calendarPlugin.tasksPlugin.ensureInitSessionCollections(session);
            return this.afterViewLoaded.promise.then(() => {
                let projectId = typeof section == "string" ? section : this.getProjectId(section);
                if (section instanceof mail.section.SectionService) {
                    return this.calendarPlugin.tasksPlugin.ensureProjectExists(projectId, section.getName(), session);
                }
            })
            .then(() => {
                return this.getCalendar1Panel(session, section).then(panel => {
                    if (!panel.wasDataSet) {
                        return panel.setSectionData(section).then(() => Q(panel));
                    }
                    return panel;
                })
                .then(panel => {
                    this.activeProjectId = this.getProjectId(section);
                    this.activeProjectHostHash = hostHash;
                    if (this.activePanel1) {
                        this.activePanel1.deactivate();
                    }
                    panel.beforeActivate();
                    this.activePanel1 = panel;
                    panel.activate();
                    this.afterViewLoaded.promise.then(() => {
                        this.callViewMethod("openCalendar1Panel", session.hostHash, this.getProjectId(section));
                    });
                });
            });
    
        })
    }


    
    getCalendar2Panel(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|string): Q.Promise<CalendarPanelController> {
        return this.createCalendar2Panel(session, this.getProjectId(section));
    }
    
    createCalendar2Panel(session: mail.session.Session, projectId: string): Q.Promise<CalendarPanelController> {
        let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
        if (calendarPanelKey in this.calendar2PanelPromises) {
            return this.calendar2PanelPromises[calendarPanelKey];
        }
        
        let panel = this.addComponent("calendar2Panel-" + calendarPanelKey, this.componentFactory.createComponent("calendarPanel", [this, this.personsComponent]));
        return this.calendar2PanelPromises[calendarPanelKey] = Q().then(() => {
            return this.calendarPlugin.initSession(session);
        })
        .then(() => {
            return panel.setSession(session);
        })
        .then(() => {
            panel.calendarId = 2;
            panel.init();
            this.bindEvent<CalendarTaskPreviewRequestEvent>(panel, "calendar-task-preview-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                let sess = this.app.sessionManager.getSessionByHostHash(event.hostHash);
                this.afterViewLoaded.promise.then(() => {
                    this.previewPanel.setTaskId(sess, event.task);
                    let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
                    let otherPanelPromise = this.calendar1PanelPromises[calendarPanelKey];
                    if (otherPanelPromise) {
                        otherPanelPromise.then(otherPanel => otherPanel.markTaskAsSelected(event.task));
                    }
                    if (!event.task) {
                        return;
                    }
                    
                    let task = this.calendarPlugin.tasksPlugin.tasks[sess.hostHash][event.task];
                    if (task && this.calendarPlugin.wasTaskUnread(sess, task, task.getProjectId())) {
                        this.calendarPlugin.markTaskAsWatched(sess, task.getId(), task.getProjectId());
                        this.updateBadges();
                    }
                });
            });
            this.bindEvent<CalendarPreviewUpdateRequestEvent>(panel, "calendar-preview-update-request", () => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.previewPanel.updateView();
                });
            });
            this.bindEvent<CalendarDayPreviewChangeVisibilityRequestEvent>(panel, "calendar-day-preview-change-visibility-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(async () => {
                    let canFirstCalendarShowPreview = await this.canFirstCalendarShowPreview(session);
                    this.callViewMethod("changeDayPreviewPanelVisibility", !canFirstCalendarShowPreview && event.show);
                });
            });
            this.bindEvent<CalendarTaskPreviewChangeVisibilityRequestEvent>(panel, "calendar-task-preview-change-visibility-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("changeTaskPreviewPanelVisibility", event.show);
                });
            });
            this.bindEvent<HorizontalCalendarTaskPreviewWindowLayoutChangeRequestEvent>(panel, "horizontal-calendar-task-preview-window-layout-change-request", event => {
                if (this.activeProjectId != projectId || this.activeProjectHostHash != session.hostHash) {
                    return;
                }
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("updatePreviewLocation", event.horizontalLayout);
                });
            });
            this.bindEvent<CalendarBadgesUpdateRequestEvent>(panel, "calendar-badges-update-request", event => {
                this.afterViewLoaded.promise.then(() => {
                    this.updateBadges();
                });
            });
            
            this.afterViewLoaded.promise.then(() => {
                this.afterViewLoaded.promise.then(() => {
                    this.callViewMethod("createCalendar2Panel", session.hostHash, projectId);
                });
            });
            
            return Q(panel);
    
        })
    }
    
    openCalendar2Panel(session: mail.session.Session, section: mail.section.SectionService|mail.section.Conv2Section|string): Q.Promise<void> {
        return this.openRemoteCalendar2Panel(session.hostHash, section);
    }

    openRemoteCalendar2Panel(hostHash: string, section: mail.section.SectionService|mail.section.Conv2Section|string): Q.Promise<void> {
        return Q().then(() => {
            return this.app.sessionManager.init(hostHash);
        })
        .then(() => {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            this.calendarPlugin.tasksPlugin.ensureSessionInit(session);
            this.calendarPlugin.tasksPlugin.ensureInitSessionCollections(session);
            return this.afterViewLoaded.promise.then(() => {
                let projectId = typeof section == "string" ? section : this.getProjectId(section);
                if (section instanceof mail.section.SectionService) {
                    return this.calendarPlugin.tasksPlugin.ensureProjectExists(projectId, section.getName(), session);
                }
            })
            .then(() => {
                return this.getCalendar2Panel(session, section).then(panel => {
                    if (!panel.wasDataSet) {
                        return panel.setSectionData(section).then(() => Q(panel));
                    }
                    return panel;
                })
                .then(panel => {
                    this.activeProjectId = this.getProjectId(section);
                    this.activeProjectHostHash = hostHash;
                    if (this.activePanel2) {
                        this.activePanel2.deactivate();
                    }
                    panel.beforeActivate();
                    this.activePanel2 = panel;
                    panel.activate();
                    this.afterViewLoaded.promise.then(() => {
                        this.callViewMethod("openCalendar2Panel", session.hostHash, this.getProjectId(section));
                    });
                });
            });
        })
    }
    

    updateDirty(dirty: boolean): void {
        this.dirty = dirty;
    }
    
    
    
    
    
    async onToggleDayPreviewPanel(show: boolean, projectId: string = null, session: mail.session.Session = null): Promise<boolean> {
        if (projectId === null) {
            projectId = this.activeProjectId;
        }
        if (session === null) {
            session = this.getActiveSession();
        }
        if (show) {
            return this.onEnableDayPreviewPanel(session, projectId);
        }
        else {
            return this.onHideDayPreviewPanel(session, projectId);
        }
    }
    
    async onEnableDayPreviewPanel(session: mail.session.Session, projectId: string): Promise<boolean> {
        let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
        let panel1Promise = this.calendar1PanelPromises[calendarPanelKey];
        let panel2Promise = this.calendar2PanelPromises[calendarPanelKey];
        if (!panel1Promise || !panel2Promise) {
            return false;
        }
        let panel1 = await panel1Promise;
        let panel2 = await panel2Promise;
        if (!panel1 || !panel2) {
            return false;
        }
        if (!panel1.afterUserGoToToday) {
            panel1.afterUserGoToToday = () => {
                let now = new Date();
                panel1.setSelectedDate(now.getDate(), now.getMonth(), now.getFullYear());
                panel2.setSelectedDate(now.getDate(), now.getMonth(), now.getFullYear());
            };
        }
        if (!panel2.afterUserPreviewDayChange) {
            panel2.afterUserPreviewDayChange = (d: number, m: number, y: number) => {
                panel1.setSelectedDate(d, m, y);
            };
        }
        if (!panel1.modeChanged) {
            panel1.modeChanged = async (mode: Modes) => {
                if (mode == Modes.SINGLE_DAY || (!CalendarWindowController.ENABLE_PREVIEW_IN_WEEK_MODE && (mode == Modes.SINGLE_WEEK || mode == Modes.WEEK))) {
                    await this.ensureDayPreviewState(session, false);
                }
                else {
                    await this.ensureDayPreviewState(session, true);
                }
            };
        }
        // if (panel1.currMode == Modes.SINGLE_DAY) {
        //     panel1.overrideMode(panel1.currMode == Modes.SINGLE_DAY ? Modes.SINGLE_WEEK : panel1.currMode);
        // }
        panel2.overrideMode(Modes.SINGLE_DAY);
        
        let d: number;
        let m: number;
        let y: number;
        if (panel1.previewDay) {
            [d, m, y] = panel1.previewDay.split(".").map(x => parseInt(x));
        }
        else if (panel1.currDataModel) {
            d = panel1.currDataModel.selectedDay;
            m = panel1.currDataModel.selectedMonth;
            y = panel1.currDataModel.selectedYear;
        }
        else {
            let now = new Date();
            d = now.getDate();
            m = now.getMonth();
            y = now.getFullYear();
        }
        panel2.goToDate(d, m, y);
        return true;
    }
    
    async onHideDayPreviewPanel(session: mail.session.Session, projectId: string): Promise<boolean> {
        let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
        let panel1Promise = this.calendar1PanelPromises[calendarPanelKey];
        let panel2Promise = this.calendar2PanelPromises[calendarPanelKey];
        if (!panel1Promise || !panel2Promise) {
            return false;
        }
        let panel1 = await panel1Promise;
        let panel2 = await panel2Promise;
        if (!panel1 || !panel2) {
            return false;
        }
        panel1.overrideMode(null);
        panel2.overrideMode(null);
        return true;
    }
    
    async previewDay(day: string): Promise<void> {
        let projectId = this.activeProjectId;
        let session = this.getActiveSession();
        let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, projectId);
        let panel2Promise = this.calendar2PanelPromises[calendarPanelKey];
        await this.ensureDayPreviewState(session, true);
        if (!panel2Promise) {
            return;
        }
        let panel2 = await panel2Promise;
        if (panel2 && panel2.currDataModel && day) {
            let [d, m, y] = day.split(".").map(x => parseInt(x));
            panel2.goToDate(d, m, y);
        }
    }
    
    onDataChanged(type: Watchable, id: string, action: Action): void {
        if (type == "task" && this.calendarTasksCountManager != null) {
            this.calendarTasksCountManager.updateTasksCount(id, action);
        }
    }
    
    onRemoteDataChanged(type: Watchable, id: string, action: Action, hostHash: string): void {
        if (type == "task") {
            this.getOrCreateRemoteTasksCountManager(hostHash).updateTasksCount(id, action);
        }
    }
    
    async closeDayPreview(session: mail.session.Session): Promise<void> {
        await this.ensureDayPreviewState(session, false);
    }
    
    onViewCloseDayPreview(): void {
        this.closeDayPreview(this.getActiveSession());
    }
    
    async ensureDayPreviewState(session: mail.session.Session, enabled: boolean): Promise<void> {
        let canFirstCalendarShowPreview = await this.canFirstCalendarShowPreview(session);
        if (canFirstCalendarShowPreview) {
            enabled = false;
        }
        if (this.calendarPlugin.getSetting(session, "enable-day-preview-panel", null, null)) {
            this.callViewMethod("changeDayPreviewPanelVisibility", enabled);
        }
    }
    
    async canFirstCalendarShowPreview(session: mail.session.Session): Promise<boolean> {
        let calendarPanelKey = this.getCalendarPanelKey(session.hostHash, this.activeProjectId);
        let panel1Promise = this.calendar1PanelPromises[calendarPanelKey];
        if (!panel1Promise) {
            return false;
        }
        let panel1 = await panel1Promise;
        return panel1 && (panel1.currMode == Modes.SINGLE_DAY || (!CalendarWindowController.ENABLE_PREVIEW_IN_WEEK_MODE && (panel1.currMode == Modes.SINGLE_WEEK || panel1.currMode == Modes.WEEK)));
    }
    
    onViewRefresh(): void {
        if (this.activePanel1) {
            this.activePanel1.onViewRefresh(true, true);
        }
        if (this.activePanel2) {
            this.activePanel2.onViewRefresh(true, true);
        }
    }
    
    refreshSidebarCounts(): void {
        this.calendarTasksCountManager.refresh();
        for (let hostHash in this.remoteCalendarTasksCountManagers) {
            this.remoteCalendarTasksCountManagers[hostHash].refresh();
        }
        this.sidebar.refresh();
        for (let hostHash in this.remoteCalendarTasksCountManagers) {
            this.sidebar.remoteSectionsLists[hostHash].refresh();
            this.sidebar.remoteConv2Lists[hostHash].refresh();
            this.remoteCalendarTasksCountManagers[hostHash].updateSidebarHostElement();
        }
    }

    expandRemoteSectionsList(hostEntry: component.remotehostlist.HostEntry): void {
        let session: mail.session.Session;
        let hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        let checkSessionExists: boolean = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if ( checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        
        let watchEvents: boolean = false;
        if (!this.remoteDataChangedListeners[hostHash]) {
            watchEvents = true;
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
            if (watchEvents) {
                this.calendarPlugin.tasksPlugin.watch(session, "*", "*", "*", this.remoteDataChangedListeners[hostHash]);
            }
            return Q.all(
                this.calendarPlugin.tasksPlugin.tasksSectionsCollection[session.hostHash].list.map(
                    x => this.calendarPlugin.tasksPlugin.ensureProjectExists(x.getId(), x.getName(), session)
                ),
            );
        })
        .then(() => {
            return this.calendarPlugin.initSession(session);
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
            this.refreshSidebarCounts();
        });
    }
    
    initSessionEvents(session: mail.session.Session): void {
        this.bindEvent<Types.event.SectionStateChangedEvent>(session.sectionManager.sectionAccessManager.eventDispatcher, "section-state-changed", event => {
            if (this.activePanel1 && this.activeProjectId == event.sectionId && this.activeProjectHostHash == session.hostHash) {
                Q().then(() => {
                    return session.sectionManager.load();
                })
                .then(() => {
                    let section = session.sectionManager.getSection(event.sectionId);
                    let moduleEnabled = section.isCalendarModuleEnabled();
                    if (!moduleEnabled) {
                        this.openDisabledSectionView(session, section);
                    }
                    else {
                        this.selectProject(session, section.getId());
                    }
                })
            }
        });
        
        this.registerChangeEvent(this.calendarPlugin.tasksPlugin.tasksSectionsCollectionNoPrivate[session.hostHash].changeEvent, event => this.onSectionsCollectionChange(session, event));
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.sinkIndexCollection.changeEvent, event => this.onSinkChange(session, event));
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
            searchCountProvider: section => this.calendarPlugin.getSearchCount(session, section),
            searchAllSearchedProvider: null,
            sorter: (a, b) => {
                let res = this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(b) - this.getOrCreateRemoteTasksCountManager(hostHash).getSectionLastDate(a);
                return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: Types.section.NotificationModule.CALENDAR,
            checkShowAllAvailSections: false,
            session: session,
        }
        
        
        let conv2ListOptions: component.remoteconv2list.RemoteConv2ListOptions = {
            elementsCountProvider: conversation => this.getRemoteConversationElementsCount(hostHash, conversation),
            unreadProvider: conversation => this.getUnread(session, conversation),
            searchCountProvider: conversation => this.calendarPlugin.getSearchCount(session, conversation),
            searchAllSearchedProvider: null,
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

    checkRemoteHostComponentsInitialized(hostHash: string): boolean {
        let ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    }
    
    getOrCreateRemoteTasksCountManager(hostHash: string): CalendarTasksCountManager {
        if (!(hostHash in this.remoteCalendarTasksCountManagers)) {
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            this.remoteCalendarTasksCountManagers[hostHash] = new CalendarTasksCountManager(session, null, this.calendarPlugin, this.calendarPlugin.tasksPlugin, this.sidebar, !!this.calendarPlugin.getSetting(session, "show-files", null, null), true);
        }
        return this.remoteCalendarTasksCountManagers[hostHash];
    }
    
    getRemoteSectionElementsCount(hostHash: string, section: mail.section.SectionService): number {
        let rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getSectionElementsCount(section);
    }
    
    getRemoteConversationElementsCount(hostHash: string, conversation: mail.section.Conv2Section): number {
        let rtcm = this.getOrCreateRemoteTasksCountManager(hostHash);
        return rtcm.getConv2ElementsCount(conversation);
    }
    
    getCalendarPanelKey(hostHash: string, projectId: string): string {
        return `${hostHash}--${projectId}`;
    }

    onViewHistoryArrowLeft(): void {
        this.router.goPrev();
    }

    onViewHistoryArrowRight(): void {
        this.router.goNext();
    }
}
