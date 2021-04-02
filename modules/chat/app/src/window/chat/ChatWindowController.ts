import {component, mail, privfs, utils, window, Types, Q, app, Logger as RootLogger} from "pmc-mail";
import {ChatMessagesController, MessagesFilterUpdater, ChatUpdateSearchStatsEvent, UpdateVoiceChatUsersEvent} from "../../component/chatmessages/ChatMessagesController";
import {ChatMessage} from "../../main/ChatMessage";
import {ChatType} from "../../main/Types";
import {ChatPlugin, ChatComponentFactory, ChatValidMessageTypeForUnreadChangeEvent, ChatValidMessageTypeForDisplayChangeEvent, GUISettings, RequestOpenChatEvent, UpdateChatSidebarSpinnersEvent, MarkedChatsAsReadEvent } from "../../main/ChatPlugin";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { PrivateConversationsController } from "../../component/privateconversations/PrivateConversationsController";
import { i18n } from "./i18n/index";
import { NoSectionsController } from "../../component/nosections/NoSectionsController";
const Logger = RootLogger.get("privfs-chat-plugin.ChatWindowController");
export interface Model {
    hashmail: string;
    domain: string;
    activeElementInfo: ActiveElementInfo;
}

export interface ActiveElementInfo {
    elementId?: string;
    parentId?: string;
    conversationId?: string;
    channelId?: string;
    guiSettings?: GUISettings;
    viewSettings?: { [key: string]: any };
    hostHash: string;
}

interface SearchResults {
    [sectionId: string]: {
        count: number,
        allSearched: boolean,
    }
}

@Dependencies(["chatmessages", "conv2list", "remoteconv2list", "remotesectionlist", "persons", "extlist", "splitter", "sectionlist", "sectionstabs", "sidebar", "privateconversations","nosections", "videoconference"])
export class ChatWindowController extends window.base.BaseAppWindowController {
    
    static textsPrefix: string = "plugin.chat.window.chat.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static MY_PRIVATE = "my";
    
    @Inject identity: privfs.identity.Identity;
    @Inject personService: mail.person.PersonService;
    @Inject sinkIndexManager: mail.SinkIndexManager;
    @Inject messageService: mail.MessageService;
    @Inject sectionManager: mail.section.SectionManager;
    @Inject conv2Service: mail.section.Conv2Service;
    @Inject localStorage: Types.utils.IStorage;
    @Inject collectionFactory: mail.CollectionFactory;
    @Inject contactService: mail.contact.ContactService;
    sidebarOptions: component.sidebar.SidebarOptions;
    sidebar: component.sidebar.SidebarController;
    loading: component.loading.LoadingController;
    personsComponent: component.persons.PersonsController;
    sectionsSplitter: component.splitter.SplitterController;
    previewSplitter: component.splitter.SplitterController;
    // videoConference: VideoConferenceController;
    messages: {[id: string]: ChatMessagesController};
    remoteServers: {[hostHash: string]: component.remotehostlist.HostEntry};
    privateConversations: PrivateConversationsController;
    noSections: NoSectionsController;
    disabledSection: component.disabledsection.DisabledSectionController;
    activeMessages: ChatMessagesController;
    chatPlugin: ChatPlugin;
    componentFactory: ChatComponentFactory;
    messagesCollection: utils.collection.SortedCollection<mail.SinkIndexEntry>;
    searchResults: { [hostHash: string]: SearchResults } = {};
    searchCountFilterUpdater: MessagesFilterUpdater;
    isSearchOn: boolean = false;
    sectionTooltip: component.sectiontooltip.SectionTooltipController;
    openChannelViewLock: boolean = false;
    
    constructor(parentWindow: window.container.ContainerWindowController) {
        super(parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "splitter-vertical": {defaultValue: 340},
                "splitter-vertical2": {defaultValue: 340},
                "chat-channels-splitter-vertical": {defaultValue: 200},
                "chat-splitter-horizontal": {defaultValue: 170},
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({handlePos:250,totalSize:1000}) },
                "enter-sends": {defaultValue: true}
            }
        });
        this.ipcMode = true;
        this.chatPlugin = this.app.getComponent("chat-plugin");
        this.setPluginViewAssets("chat");
        this.openWindowOptions.fullscreen = true;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = this.i18n("plugin.chat.window.chat.title");
        this.searchCountFilterUpdater = new MessagesFilterUpdater();
        this.searchCountFilterUpdater.onUpdate = this.onSearchCountFilterUpdate.bind(this);
        this.sectionTooltip = this.addComponent("sectiontooltip", this.componentFactory.createComponent("sectiontooltip", [this]));      
        this.loading = this.addComponent("loading", this.componentFactory.createComponent("loading", [this]));  
        this.enableTaskBadgeAutoUpdater();
    }
        
    onPrimarySectionChange(event: Types.utils.collection.CollectionEvent<mail.section.SectionService>) {
        let hostHash = this.app.sessionManager.getLocalSession().hostHash;
        this.sidebar.toggleCustomElements(this.chatPlugin.chatPrimarySections[hostHash].list.length > 0);
    }
    
    init(): Q.IWhenable<void> {
        let localSession = this.app.sessionManager.getLocalSession();
        return this.app.mailClientApi.checkLoginCore().then(() => {
            return this.app.mailClientApi.prepareSectionManager();
        })
        .then(() => {
            return Q.all([
                this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                this.sectionManager.isSectionsLimitReached()
            ])
        })
        .then(res => {
            let [identityProvider, isSectionsLimitReached] = res;
            let sidebarOptions: component.sidebar.SidebarOptions = {
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: new utils.collection.MutableCollection([{
                        id: ChatWindowController.MY_PRIVATE,
                        icon: {
                            type: "hashmail",
                            value: this.identity.hashmail
                        },
                        label: this.i18n("plugin.chat.window.chat.my-messages"),
                        private: true,
                        emphasized: true,
                    }]),
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    unreadProvider: c2s => this.getUnreadFromConv2(localSession, c2s),
                    elementsCountProvider: c2s => this.getConv2ElementsCount(localSession, c2s),
                    searchCountProvider: c2s => this.getConv2SearchCount(localSession, c2s),
                    searchAllSearchedProvider: c2s => this.getConv2SearchAllSearched(localSession, c2s),
                    withSpinnerProvider: c2s => this.getConv2WithSpinner(localSession, c2s),
                    activeVoiceChatInfoProvider: c2s => this.getConvActiveVoiceChatInfo(localSession, c2s),
                },
                sectionList: {
                    baseCollection: this.chatPlugin.chatSections[localSession.hostHash],
                    unreadProvider: section => this.getUnread(localSession, section),
                    elementsCountProvider: section => this.getSectionElementsCount(localSession, section),
                    searchCountProvider: section => this.getSectionSearchCount(localSession, section),
                    searchAllSearchedProvider: section => this.getSectionSearchAllSearched(localSession, section),
                    withSpinnerProvider: section => this.getSectionWithSpinner(localSession, section),
                    activeVoiceChatInfoProvider: section => this.getSectionActiveVoiceChatInfo(localSession, section),

                    moduleName: Types.section.NotificationModule.CHAT,
                    sorter: (a, b) => {
                        let res = b.getChatLastDate() - a.getChatLastDate();
                        return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                customSectionList: {
                    baseCollection: this.chatPlugin.chatPrimarySections[localSession.hostHash],
                    unreadProvider: section => this.getUnread(localSession, section),
                    elementsCountProvider: section => this.getSectionElementsCount(localSession, section),
                    searchCountProvider: section => this.getSectionSearchCount(localSession, section),
                    searchAllSearchedProvider: section => this.getSectionSearchAllSearched(localSession, section),
                    withSpinnerProvider: section => this.getSectionWithSpinner(localSession, section),
                    moduleName: Types.section.NotificationModule.CHAT,
                    sorter: (a, b) => {
                        let res = b.getChatLastDate() - a.getChatLastDate();
                        return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: component.remotehostlist.ElementCountsAggregationStrategy.ALL,
                },
                
                conv2ListEnabled: true,
                conv2Splitter: this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: []       
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push(
                    {
                        id: "new-section",
                        label: this.i18n("plugin.chat.window.chat.sidebar.newsection"),
                        title: this.i18n("plugin.chat.window.chat.sidebar.newsection"),
                        icon: "ico-comment",
                        windowOpener: true,
                        onSectionList: true
                    },
                    {
                        id: "new-chat",
                        label: this.i18n("plugin.chat.window.chat.button.newChat.label"),
                        title: this.i18n("plugin.chat.window.chat.button.newChat.title"),
                        icon: "ico-comment",
                        windowOpener: true,
                    }
                );
            }
            if (identityProvider.getType() == "basic") {
                sidebarOptions.sidebarButtons.push(
                    <any>{
                        id: "new-chat",
                        label: this.i18n("plugin.chat.window.chat.button.newChat.label"),
                        title: this.i18n("plugin.chat.window.chat.button.newChat.titleForBasic"),
                        icon: "ico-comment",
                        windowOpener: true,
                        disabled: true,
                    }    
                )
            }
            
            this.sidebarOptions = sidebarOptions;
            this.sidebar = this.addComponent("sidebar", this.componentFactory.createComponent("sidebar", [this, sidebarOptions]));
            this.bindEvent(this.sidebar, "elementbeforeactivate", this.onBeforeActivateSidebarElement.bind(this));
            this.bindEvent(this.sidebar, "elementactivated", this.onActivatedSidebarElement.bind(this));
            this.bindEvent(this.sidebar, "sidebarbuttonaction", this.onSidebarButtonAction.bind(this));
            this.sidebar.usersListTooltip.getContent = (sectionId: string): string => {
                return this.app.getUsersListTooltipContent(this.app.sessionManager.getLocalSession(), sectionId);
            }

            this.chatPlugin.chatPrimarySections[localSession.hostHash].changeEvent.add(this.onPrimarySectionChange.bind(this));
            this.bindEvent<Types.event.SectionStateChangedEvent>(this.sectionManager.sectionAccessManager.eventDispatcher, "section-state-changed", event => {
                if (this.activeMessages && this.activeMessages.chatInfo && this.activeMessages.chatInfo.type == ChatType.CHANNEL && this.activeMessages.chatInfo.section.getId() == event.sectionId) {
                    Q().then(() => {
                        return this.sectionManager.load();
                    })
                    .then(() => {
                        if (! this.areAnySectionsExceptPrivate()) {
                            this.openNoSectionsView();
                            return;
                        }
                        console.log("check available - there are some sections..");
                        let section = this.sectionManager.getSection(event.sectionId);
                        let moduleEnabled = section.isChatModuleEnabled();
                        if (! moduleEnabled) {
                            this.openDisabledSectionView(localSession, section);
                        }
                        else {
                            this.refreshActive(localSession);
                        }
                    })
                }
            });
                    
            this.bindEvent(this.app, "reopen-section", (event: component.disabledsection.ReopenSectionEvent) => {
                this.openChannelView(localSession, event.element.getId(), true);
            });
            
            this.bindEvent<Types.event.SectionsLimitReachedEvent>(this.app, "sectionsLimitReached", event => {
                this.sidebar.onSectionsLimitReached(event.reached);
            });

            this.bindEvent(this.app, "requestopenchat", (event: RequestOpenChatEvent) => {
                let hashmails = event.hashmails.filter(x => this.personService.getPerson(x) != null && this.personService.getPerson(x).contact != null);
                if (hashmails.length == 0) {
                    this.alert(this.i18n("plugin.chat.window.chat.cantCreateConversationWithoutUsers"));
                    return;
                }
                if (event.showContactsWindow) {
                    this.openNewChat(hashmails);
                }
                else {
                    let convId = this.conv2Service.getConvIdFromHashmails(hashmails);
                    const context = app.common.Context.create({
                        moduleName: Types.section.NotificationModule.CHAT,
                        contextType: "conversation",
                        contextId: convId,
                        hostHash: this.app.sessionManager.getLocalSession().hostHash
                    });
                    this.contextHistory.append(context); 
                    this.openChatOrConversationView(convId, true);
                }
            });

            this.bindEvent(this.app, "focusLost", () => {
                this.callViewMethod("pauseTimeAgoRefresher");
            });
            
            this.bindEvent<UpdateChatSidebarSpinnersEvent>(this.app, "update-chat-sidebar-spinners", e => {
                this.sidebar.updateSidebarSpinners({
                    conv2SectionId: e.conv2SectionId,
                    customElementId: e.customElementId,
                    sectionId: e.sectionId,
                    hosts: e.hostHash ? [this.app.sessionManager.getSessionByHostHash(e.hostHash).host] : Object.values(this.app.sessionManager.sessions).map(x => x.host),
                });
            });
            
            this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
            this.privateConversations = this.addComponent("private-conversations", this.componentFactory.createComponent("privateconversations", [this]));
            this.disabledSection = this.addComponent("disabled-section", this.componentFactory.createComponent("disabledsection", [this, Types.section.NotificationModule.CHAT]));
            this.noSections = this.addComponent("no-sections", this.componentFactory.createComponent("nosections", [this]));
            this.sectionsSplitter = this.addComponent("sectionsSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("splitter-vertical")]));
            this.previewSplitter = this.addComponent("previewSplitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("splitter-vertical2")]));
            this.messages = {};
            
            this.registerChangeEvent(this.sinkIndexManager.sinkIndexCollection.changeEvent, this.onSinkChange);
            this.registerChangeEvent(this.sinkIndexManager.messagesCollection.changeEvent, events => {
                let map: {[sid: string]: boolean} = {};
                utils.Event.applyEvents(events, event => {
                    if (event.element) {
                        map[event.element.index.sink.id] = true;
                    }
                });
                for (let sid in map) {
                    this.refreshSidebarBySid(sid);
                }
            }, "multi");
            this.chatPlugin.chatSections[localSession.hostHash].changeEvent.add(event => {
                if (event.element && event.type == "remove" && this.activeMessages && this.activeMessages.chatInfo && this.activeMessages.chatInfo.section && this.activeMessages.chatInfo.section.getId() == event.element.getId()) {
                    this.refreshActive(localSession);
                }
            });
            
            this.bindEvent(this.app, "focusChanged", (event) => {
                let windowId = (<any>event).windowId;
                this.chatPlugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? this.parent.activeModel.get() : windowId;
                if (windowId == "chat" || (windowId == "main-window" && this.parent.activeModel.get() == "chat") ) {
                    setTimeout(() => {
                        this.refreshActivePanelThumbs();
                        if ((<any>event).windowId == "main-window") {
                            this.callViewMethod("resumeTimeAgoRefresher");
                        }
                        this.callViewMethod("grabFocus", true);
                    }, 200);
                }
            });


            this.bindEvent(this.app, "focusLost", (event) => {
                this.chatPlugin.activeWindowFocused = null;
            });

        
            this.bindEvent(this, "chatupdatesearchstatsevent", this.onChatUpdateSearchStatsEvent.bind(this));
            
            
            this.bindEvent(this.app, "onToggleMaximize-notify", () => {
                setTimeout(() => {
                    this.callViewMethod("grabFocus", false);
                }, 10);
            });
            
            this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterMessages, "multi");
            if (this.app.searchModel.data.visible && this.app.searchModel.data.value != "") {
                this.onFilterMessages();
            }
            this.bindEvent<ChatValidMessageTypeForUnreadChangeEvent>(this.app, "chatvalidmessagetypeforunreadchange", () => {
                this.sidebar.refresh();
            });
            this.bindEvent<ChatValidMessageTypeForDisplayChangeEvent>(this.app, "chatvalidmessagetypefordisplaychange", () => {
                this.searchCountFilterUpdater.previousFilter = null;
                this.searchCountFilterUpdater.updateFilter(this.app.searchModel.get(), true);
            });


            this.bindEvent<Types.event.VoiceChatUsersPresenceChangeEvent>(this.app, "voice-chat-users-presence-change", event => { 
                this.updateActiveVoiceChatUsersView(event.hostHash, event.sectionId);
            });

            this.bindEvent<UpdateVoiceChatUsersEvent>(this.app, "update-voice-chat-users", event => {
                this.onUpdateVoiceChatUsers(event);
            })

            this.app.dispatchEvent({type: "focusChanged", windowId: "chat"});
        })
        .then(() => {
            let tasksPlugin = this.app.getComponent("tasks-plugin");
            return tasksPlugin.projectsReady;
        });
    }

    async onUpdateVoiceChatUsers(event: UpdateVoiceChatUsersEvent): Promise<void> { 
        if (! this.app.serverConfigForUser.privmxStreamsEnabled) {
            return;
        }
        if (event.sectionId) {
            const session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
            let section = this.getSectionServiceFromConvIdOrSectionId(session, event.sectionId);
            if (!section) {
                return;
            }
            try {
                let api = this.app.sessionManager.getVoiceChatServiceApi(event.hostHash);
                let data = await api.getRoomInfo(section);
                session.webSocketNotifier._notifyVoiceChatUsersChange(session, data.users, event.sectionId);    
            }
            catch (e) {
                Logger.warn("voice chat unavailable");
            }             
        }
    }

    getSectionServiceFromConvIdOrSectionId(session: mail.session.Session, sectionOrConvId: string): mail.section.SectionService {
        let conv = session.conv2Service.collection.find(x => x.section && (x.section.getId() == sectionOrConvId || x.id == sectionOrConvId));
        let sectionService: mail.section.SectionService;
        if (conv) {
            sectionService = conv.section;
        }
        else {
            sectionService = session.sectionManager.getSection(sectionOrConvId);
        }
        return sectionService;
    }
    
    getUsergroupIdByMessagesId(session: mail.session.Session, id: string): string {
        if (id.indexOf("c2:") == 0) {
            let conv2Section = session.conv2Service.collection.find(x => x.id == id);
            let convSectionId = conv2Section && conv2Section.section  ? conv2Section.section.getId() : null;
            return convSectionId;
        }
        return id;
    }

    getActiveVoiceChatUsers(hostHash: string, sectionId: string): Types.webUtils.PersonSimpleModel[] {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash); 
        let section = session.sectionManager.getSection(sectionId);
        let users = (<any>session.webSocketNotifier).getVoiceChatCachedUsers(session, sectionId);
        return mail.WebSocketNotifier.getListeningPeople(session, sectionId, users)
    }

    updateActiveVoiceChatUsersView(hostHash: string, sectionId: string): void {
        let session: mail.session.Session;
        try {
            session = this.app.sessionManager.getSessionByHostHash(hostHash);
        } catch (e) {
            console.log("cannot get session", e);
        }
    
        // console.log("status check", this.activeMessages ? "activeMessages ok" : "activeMessages fail", this.activeMessages.session ? "session ok" : "session fail", "sectionId", sectionId);

        if (this.activeMessages && this.activeMessages.session && this.activeMessages.session.hostHash == hostHash) {
            this.activeMessages.afterViewLoaded.promise.then(() => {
                if(this.getUsergroupIdByMessagesId(session, this.activeMessages.getId()) == this.getUsergroupIdByMessagesId(session, sectionId)) {
                    let users = this.getActiveVoiceChatUsers(hostHash, sectionId);
                    let personModelUsers = users.map<app.common.voicechat.PersonModel>(x => {
                        return {
                            name: x.name,
                            hashmail: x.hashmail,
                            networkInfo: {ping: 0}
                        }
                    })
            
                    let usersStr = JSON.stringify(personModelUsers);
                    this.activeMessages.callViewMethod("updateActiveVoiceChatUsers", usersStr);        
                    this.activeMessages.toggleIsVoiceChatActiveInThisSection(this.app.voiceChatService.isVoiceChatActive(session, sectionId));
    
                }
            })
        }
        else {
            // Logger.warn("doesnt meet criteria in updateActiveVoiceChatUsersView",sectionId);
        }

    }

    getModel(): Model {
        return {
            hashmail: this.identity.hashmail,
            domain: this.identity.host,
            activeElementInfo: this.getActiveElementInfo(),
        };
    }
    
    //===========================
    //       VIEW EVENTS
    //===========================
    
    onViewLoad(): void {
        if (! this.areAnySectionsExceptPrivate()) {
            this.openNoSectionsView();
            return;
        }

        this.activateMessages();
    }

    activateMessages():void {
        let activeElementInfo = this.getActiveElementInfo();
        this.callViewMethod("activateMessages", activeElementInfo);
        this.callViewMethod("changeIsSearchOn", this.isSearchOn);
        
        this.initSpellChecker();
        let localSession = this.app.sessionManager.getLocalSession();
        this.sidebar.toggleCustomElements(this.chatPlugin.chatPrimarySections[localSession.hostHash].list.length > 0);
    }

    onViewDragDrop(fileHandle: Types.app.FileHandle[])  {
        let active = this.sidebar.getActive();
        if (active.type == component.sidebar.SidebarElementType.CONVERSATION) {
            if (active.conv2.hasDeletedUserOnly()) {
                return;
            }
        }
        return Q().then(() => {
            let filesActions: Q.Promise<any>[] = [];
            fileHandle.forEach(x => {
                filesActions.push(this.onDragDropSingle(x));
            })
            return Q.all(filesActions);
        })
        .fail(this.errorCallback);
    }
    onDragDropSingle(fileHandle: Types.app.FileHandle) {
        let formatter = new utils.Formatter();
        let content = this.app.createContent(fileHandle);
        let limit = this.app.getMaxFileSizeLimit();
        if (content.getSize() > limit) {
            return Q.reject<void>(this.i18n("plugin.chat.window.chat.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit))).thenResolve(null);
        }
        else {
            this.activeMessages.sendMessage({attachments: [content]});
        }
    }
    
    onViewUserAction() {
        if (this.activeMessages) {
            this.activeMessages.onViewUserAction();
        }
    }
    
    //===========================
    //          MISC
    //===========================
    
    applyHistoryState(processed: boolean, state: string) {
        let localSession = this.app.sessionManager.getLocalSession();
        let context = this.contextHistory.getCurrent();

        let handled: boolean = false;
        if (context) {
            if (this.app.switchModuleWithContext() || state) {
                
                if (context.getType() == "section") {
                    let contextSection = this.chatPlugin.sectionManager.getSection(context.getSectionIdFromContextId());
                    if (contextSection && contextSection.isChatModuleEnabled()) {
                        this.openChannelView(localSession, context.getSectionIdFromContextId());
                        handled = true;
                    }
                }
                else
                if (context.getType() == "conversation") {
                    this.openChatOrConversationView(context.getContextId());
                    handled = true;
                }
                else
                if (context.getType() == "custom") {
                    if (context.getContextId() == "my") {
                        if (this.chatPlugin.chatPrimarySections[localSession.hostHash].list.length > 0) {
                            this.openChannelView(localSession, this.chatPlugin.chatPrimarySections[localSession.hostHash].get(0).getId());
                        }
                        else {
                            this.openPrivateConversationsView();
                        }
                        handled = true;
                    }
                }
            }
        }
        this.app.resetModuleSwitchingModifier();
        if (handled) {
            return;
        }
        if (state) {
            if (state == ChatWindowController.MY_PRIVATE) {
                this.openPrivateConversationsView();
            }
            else if (this.getConversationIfExists(state) == null)  {
                this.openChannelView(localSession, state);
            }
            else {
                this.openChatOrConversationView(state);
            }
        }
        else {
            this.openLastActiveChat().fail(this.errorCallback);
        }
    }
    
    openLastActiveChat(): Q.Promise<void> {
        const moduleName = Types.section.NotificationModule.CHAT;
        let localSession = this.app.sessionManager.getLocalSession();
        return Q().then(() => {
            return this.localStorage.get("last-active-chat");
        })
        .then((lastActiveChat: string) => {
            if (lastActiveChat == ChatWindowController.MY_PRIVATE) {
                const context = app.common.Context.create({
                    moduleName: moduleName,
                    contextType: "custom",
                    contextId: ChatWindowController.MY_PRIVATE,
                    hostHash: this.app.sessionManager.getLocalSession().hostHash
                });
                this.contextHistory.append(context); 
                this.openPrivateConversationsView();
                return;
            }
            if (this.getConversationIfExists(lastActiveChat) != null) {
                const context = app.common.Context.create({
                    moduleName: moduleName,
                    contextType: "conversation",
                    contextId: lastActiveChat,
                    hostHash: this.app.sessionManager.getLocalSession().hostHash
                });
                this.contextHistory.append(context); 
                this.openChatOrConversationView(lastActiveChat);
                return;
            }
            let section = this.sectionManager.getSection(lastActiveChat);
            if (section == null || !section.isChatModuleEnabled()) {
                section = this.sidebar.sectionList.sectionsCollection.get(0);
            }
            if (section) {
                const context = app.common.Context.create({
                    moduleName: moduleName,
                    contextType: "section",
                    contextId: "section:" + section.getId(),
                    hostHash: this.app.sessionManager.getLocalSession().hostHash
                });
                this.contextHistory.append(context); 
                return this.openChannelView(localSession, section.getId());
            }
            if (lastActiveChat == null) {
                return this.openAnyChat();
            }
        });
    }

    openAnyChat(): void {
        const firstConv = this.chatPlugin.conv2Service.collection ? this.chatPlugin.conv2Service.collection.get(0): null;
        if (firstConv) {
            const context = app.common.Context.create({
                moduleName: Types.section.NotificationModule.CHAT,
                contextType: "conversation",
                contextId: firstConv.id,
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context); 
            this.openChatOrConversationView(firstConv.id);
        }     
    }
    
    reopenChat(): void {
        let active = this.sidebar.getActive();
        if (!active) {
            return;
        }
        if (active.type == component.sidebar.SidebarElementType.CONVERSATION) {
            this.openChatOrConversationView(active.conv2.id);
        }
        else if (active.type == component.sidebar.SidebarElementType.SECTION) {
            let session = this.app.sessionManager.getLocalSession();
            this.openChannelView(session, active.section.getId());
        }
        else if (active.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
            let session = this.app.sessionManager.getSessionByHostHash(active.hostHash);
            this.openRemoteChannelView(active.hostHash, active.section.getId());
        }
        else if (active.type == component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            if (active.customElement.id == ChatWindowController.MY_PRIVATE) {
                this.openPrivateConversationsView();
            }
        }
    }
    


    getActiveId(): string {
        let active = this.sidebar.getActive();
        let localSession = this.app.sessionManager.getLocalSession();
        let session = active && active.hostHash && this.app.sessionManager.isSessionExistsByHostHash(active.hostHash)
            ? this.app.sessionManager.getSessionByHostHash(active.hostHash)
            : localSession;
        if (active != null && active.type == component.sidebar.SidebarElementType.CONVERSATION) {
            return this.getConversationId(session, active.conv2);
        }
        if (active != null && active.type == component.sidebar.SidebarElementType.SECTION) {
            return this.getChannelId(session, active.section);
        }
        if (active != null && active.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
            return this.getChannelId(session, active.section);
        }        
        if (active != null && active.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            return this.getConversationId(session, active.conv2);
        }        
        if (active != null && active.type == component.sidebar.SidebarElementType.CUSTOM_SECTION) {
            return this.getChannelId(session, active.section);
        }
        return null;
    }
    
    getActiveElementInfo(): ActiveElementInfo {
        let active = this.sidebar.getActive();
        let localSession = this.app.sessionManager.getLocalSession();
        let session = active && active.hostHash && this.app.sessionManager.isSessionExistsByHostHash(active.hostHash)
            ? this.app.sessionManager.getSessionByHostHash(active.hostHash)
            : localSession;
        let hostHash = session.hostHash;
        let activeElement: ActiveElementInfo = { hostHash: hostHash };
        activeElement.guiSettings = this.chatPlugin.getGUISettings();
        activeElement.viewSettings = this.chatPlugin.getViewSettings();
        if (active != null && active.type == component.sidebar.SidebarElementType.CONVERSATION) {
            activeElement.elementId = active.conv2.id;
            activeElement.conversationId = this.getConversationId(session, active.conv2);
        }
        if (active != null && (active.type == component.sidebar.SidebarElementType.SECTION || active.type == component.sidebar.SidebarElementType.CUSTOM_SECTION) ) {
            activeElement.elementId = active.section.getId();
            activeElement.parentId = active.section.getRoot().getId();
            activeElement.channelId = this.getChannelId(session, active.section);
        }
        if (active != null && (active.type == component.sidebar.SidebarElementType.REMOTE_SECTION) ) {
            activeElement.elementId = active.section.getId();
            activeElement.parentId = active.section.getRoot().getId();
            activeElement.channelId = this.getChannelId(session, active.section);
        }
        if (active != null && active.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            activeElement.elementId = active.conv2.id;
            activeElement.conversationId = this.getConversationId(session, active.conv2);
        }

        return activeElement;
    }
    
    refreshActive(session: mail.session.Session) {
        if (! this.areAnySectionsExceptPrivate()) {
            this.openNoSectionsView();
            return;
        }
        let section = session.sectionManager.getSection(this.getActiveElementInfo().elementId);
        if (section && !section.isChatModuleEnabled()) {
            return;
        }
        let id = this.getActiveId();
        let prevActive = this.activeMessages;
        let messagesChatController = this.messages[id];
        this.activeMessages = messagesChatController;
        this.callViewMethod("activateMessages", this.getActiveElementInfo(), this.getActiveId());
        if (messagesChatController) {
            this.localStorage.set("last-active-chat", messagesChatController.getId());
        }
        if (this.activeMessages) {
            this.activeMessages.activate();
        }
        this.chatPlugin.activeMessages = this.activeMessages;
        if (prevActive && prevActive != this.activeMessages) {
            prevActive.deactivate();
        }
        
        // let currentSection = this.activeMessages.chatInfo.section ? this.activeMessages.chatInfo.section: null;
        // let conv = this.activeMessages.chatInfo.conversation ? this.activeMessages.chatInfo.conversation: null;

        // let currId = currentSection ? currentSection.getId(): conv.id;
        // this.updateActiveVoiceChatUsersView(session.hostHash, currId);
        this.updateActiveVoiceChatUsersView(session.hostHash, this.activeMessages.getId())
        this.refreshActivePanelThumbs();
    }
    
    //===========================
    //      CONVERSATION
    //===========================
    
    getConversationId(session: mail.session.Session, conversation: mail.section.Conv2Section): string {
        return "messages-conversation-" + session.hostHash + "-" + conversation.id;
    }

    // getOrCreateConversation(conversation: mail.section.Conv2Section): ChatMessagesController {
    //     let id = this.getConversationId(conversation);
    //     if (!(id in this.messages)) {
    //         let baseCollection = conversation.messagesCollection;
    //         conversation.prepareMessagesCollection().fail(e => {
    //             this.getLogger().error("Error during preparing messages", e);
    //         });
    //         let collection = new utils.collection.FilteredCollection<mail.SinkIndexEntry>(baseCollection, entry => {
    //             return ChatMessage.isChatMessage(entry) || this.chatPlugin.isMailMessage(entry);
    //         });
    //         this.messages[id] = this.addComponent(id, this.componentFactory.createComponent("chatmessages", [this]));
    //         this.messages[id].init();
    //         this.messages[id].setChatData({
    //             type: ChatType.CONVERSATION,
    //             section: null,
    //             conversation: conversation
    //         }, collection);


    //         this.messages[id].disableFileLinksForNonExistantFiles();
    //         if (conversation && conversation.section && conversation.section.getChatModule()) {
    //             this.messages[id].setConversationFilesChangeListener();
    //             let chatModule = conversation.section.getChatModule();
    //             chatModule.chatMessagesCollection.changeEvent.add(() => {
    //                 if (chatModule.sink) {
    //                     this.refreshSidebarBySid(chatModule.sink.id);
                        
    //                 }
    //             }, "multi");
    //         }
    //     }
    //     return this.messages[id];
    // }

    getOrCreateConversation(conversation: mail.section.Conv2Section): Q.Promise<ChatMessagesController> {
        return this.getOrCreateRemoteConversation(this.app.sessionManager.getLocalSession().hostHash, conversation);
    }

    openChatOrConversationView(conversationId: string, force?: boolean, focus?: boolean): Q.Promise<mail.section.Conv2Section> {
        if (this.openChannelViewLock) {
            return Q(null);
        }
        this.openChannelViewLock = true;
        return Q().then(() => {
            if (focus !== false) {
                this.onViewFocus();
            }
            let active = this.sidebar.getActive();
            if (active != null && active.type == component.sidebar.SidebarElementType.CONVERSATION && active.conv2.id == conversationId) {
                if (focus !== false && this.activeMessages) {
                    this.activeMessages.focus();
                }
                return active.conv2;
            }
            let conversation = this.conv2Service.collection.find(x => x.id == conversationId);
            if (conversation == null) {
                if (force && conversationId) {
                    let users = this.conv2Service.getUsersFromConvId(conversationId);
                    conversation = this.conv2Service.getOrCreateConv(users, true);
                    if (conversation == null) {
                        console.log("exit with conv null")
                        return null;
                    }
                }
                else {
                    console.log("exit with conv null (2)")
                    return null;
                }
            }
            this.chatPlugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
            let session = this.app.sessionManager.getLocalSession();
            this.chatPlugin.activeSinkHostHash = session.hostHash;
            return this.getOrCreateConversation(conversation)
            .then(messagesController => {
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.CONVERSATION,
                    conv2: conversation,
                }, false);
                return conversation;
        
            })
    
        })
        .fin(() => {
            this.openChannelViewLock = false;
        })
    }
    
    getConversationIfExists(conversationId: string, force?: boolean): mail.section.Conv2Section {
        let conversation = this.conv2Service.collection.find(x => x.id == conversationId);
        if (conversation) {
            return conversation;
        }
        if (force && conversationId) {
            let users = this.conv2Service.getUsersFromConvId(conversationId);
            conversation = this.conv2Service.getOrCreateConv(users, true);
            if (conversation == null) {
                return null;
            }
        }
        else {
            return null;
        }
        return conversation;
    }
    
    //===========================
    //          CHANNEL
    //===========================
    
    getChannelId(session: mail.session.Session, section: mail.section.SectionService): string {
        return "messages-channel-" + session.hostHash + "-" + section.getId();
    }
    
    getOrCreateChannel(section: mail.section.SectionService): Q.Promise<ChatMessagesController> {
        return Q().then(() => {
            return section.getChatModule().sinkIndex == null ? section.getChatModule().getSinkIndex() : Q.resolve();
        })
        .then(() => {
            let id = this.getChannelId(this.app.sessionManager.getLocalSession(), section);
            if (!(id in this.messages) || ! this.messages[id].getSection().getChatModule().sinkIndex) {
                this.messages[id] = this.addComponent(id, this.componentFactory.createComponent("chatmessages", [this]));
                this.messages[id].init();
                
                return this.messages[id].setSession(this.app.sessionManager.getLocalSession())
                .then(() => {
                    this.messages[id].setSectionData(section);
                    if (section && section.getChatModule()) {
                        let chatModule = section.getChatModule();
                        chatModule.chatMessagesCollection.changeEvent.add(() => {
                            if (chatModule.sink) {
                                this.refreshSidebarBySid(chatModule.sink.id);
                            }
                        }, "multi");
                    }
                    return this.messages[id];
                })
            }
            return this.messages[id];
        })
    }
    
    isSectionPrimary(session: mail.session.Session, section: mail.section.SectionService) {
        return this.chatPlugin.chatPrimarySections[session.hostHash].contains(section);
    }
    
    openChannelView(session: mail.session.Session, sectionId: string, fromDisabled?: boolean) {
        if (this.openChannelViewLock) {
            return;
        }
        let active = this.sidebar.getActive();
        if (fromDisabled !== true && active != null
           && (active.type == component.sidebar.SidebarElementType.SECTION || active.type == component.sidebar.SidebarElementType.CUSTOM_SECTION) && active.section.getId() == sectionId) {
            return Q.resolve(null);
        }
        let section = this.sectionManager.getSection(sectionId);
        if (section == null) {
            return Q.resolve(null);
        }
        this.openChannelViewLock = true;
        return Q().then(() => {
            if (! this.areAnySectionsExceptPrivate()) {
                this.openNoSectionsView();
                return;
            }
            if (!section.isChatModuleEnabled()) {
                this.openDisabledSectionView(session, section);
                this.openChannelViewLock = false;
                return;
            }
            else {
                return section.getChatModule().getSinkIndex().then(sinkIndex => {
                    section.getChatModule().sinkIndex = sinkIndex;
                    return;
                })
                .then(() => {
                    return this.getOrCreateChannel(section);
                })
                .then(() => {
                    this.sidebar.setActive({
                        type: this.isSectionPrimary(session, section) ? component.sidebar.SidebarElementType.CUSTOM_SECTION : component.sidebar.SidebarElementType.SECTION,
                        section: section
                    }, false);

                    this.chatPlugin.activeSinkId = section.getChatSink().id;
                    this.chatPlugin.activeSinkHostHash = this.app.sessionManager.getLocalSession().hostHash;
                     this.refreshActive(session);
                    
                    this.openChannelViewLock = false;
                    return;
                })
            }
        })
        .fin(() => {
            this.openChannelViewLock = false;
        })
    }
    
    openDisabledSectionView(session: mail.session.Session, section: mail.section.SectionService) {
        console.log("on openDisabledSectionView")
        this.sidebar.setActive({
            type: this.isSectionPrimary(session, section) ? component.sidebar.SidebarElementType.CUSTOM_SECTION : component.sidebar.SidebarElementType.SECTION,
            section: section
        }, false);
        this.chatPlugin.activeSinkId = section.getChatSink().id;
        this.chatPlugin.activeSinkHostHash = this.app.sessionManager.getLocalSession().hostHash;
        this.disabledSection.setSection(section);
        this.callViewMethod("openDisabledSectionView");
    }
    
    openPrivateConversationsView(): void {
        this.chatPlugin.activeSinkId = null;
        this.chatPlugin.activeSinkHostHash = null;
        this.sidebar.setActive({
            type: component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
            customElement: this.sidebar.customElementList.customElementsCollection.find(x => x.id == ChatWindowController.MY_PRIVATE)
        }, false);
        this.callViewMethod("openPrivateConversations");
    }

    openNoSectionsView(): void {
        this.chatPlugin.activeSinkId = null;
        this.chatPlugin.activeSinkHostHash = null;
        this.callViewMethod("openNoSections");
    }



    //===========================
    // Remote Channels
    //===========================

    getOrCreateRemoteChannel(hostHash:string, section: mail.section.SectionService): Q.Promise<ChatMessagesController> {
        return Q().then(() => {
            let id = this.getChannelId(this.app.sessionManager.getSessionByHostHash(hostHash), section);
            if (!(id in this.messages) || ! this.messages[id].getSection().getChatModule().sinkIndex) {
                    this.messages[id] = this.addComponent(id, this.componentFactory.createComponent("chatmessages", [this]));
                    this.messages[id].init();
                    return this.messages[id].setSession(this.app.sessionManager.getSessionByHostHash(hostHash))
                    .then(() => {
                        this.messages[id].setSectionData(section);
                        if (section && section.getChatModule()) {
                            let chatModule = section.getChatModule();
                            chatModule.chatMessagesCollection.changeEvent.add(() => {
                                if (chatModule.sink) {
                                    this.refreshSidebarBySidRemote(hostHash, chatModule.sink.id);
                                }
                            }, "multi");
                        }
                        return this.messages[id];
                    });
            }
            return this.messages[id];
        })
    }

    getOrCreateRemoteConversation(hostHash: string, conversation: mail.section.Conv2Section): Q.Promise<ChatMessagesController> {
        return Q().then(() => {
            let id = this.getConversationId(this.app.sessionManager.getSessionByHostHash(hostHash), conversation);
            // console.log("getOrCreateRemoteConversation id", id);
            if (!(id in this.messages)) {
                let baseCollection = conversation.messagesCollection;
                let collection = new utils.collection.FilteredCollection<mail.SinkIndexEntry>(baseCollection, entry => {
                    return ChatMessage.isChatMessage(entry) || this.chatPlugin.isMailMessage(entry);
                });
                this.messages[id] = this.addComponent(id, this.componentFactory.createComponent("chatmessages", [this]));
                // console.log("before init");
                this.messages[id].init();
                // console.log("before setSession");
                return this.messages[id].setSession(this.app.sessionManager.getSessionByHostHash(hostHash))
                .then(() => {
                    // console.log("after setSession");
                    conversation.prepareMessagesCollection().fail(e => {
                        this.getLogger().error("Error during preparing messages", e);
                    });
                    
                    // console.log("getOrCreateRemoteConversation: setChatData");
                    this.messages[id].setChatData({
                        type: ChatType.CONVERSATION,
                        section: null,
                        conversation: conversation
                    }, collection);
                    
                    // console.log(1);
                    // console.log(2)
                    if (conversation && conversation.section && conversation.section.getChatModule()) {
                        // console.log("2.1")
                        this.messages[id].setConversationFilesChangeListener();
                        let chatModule = conversation.section.getChatModule();
                        // console.log("2.2", chatModule.chatMessagesCollection)
                        if (chatModule.chatMessagesCollection) {
                            chatModule.chatMessagesCollection.changeEvent.add(() => {
                                // console.log("on add..")
                                if (chatModule.sink) {
                                    // console.log(3)
                                    this.refreshSidebarBySidRemote(hostHash, chatModule.sink.id);
                                    // console.log(4)
                                }
                            }, "multi");    
                        }
                        // console.log("2.3");
                    }
                    // console.log("getOrCreateRemoteConversation after..");
                    return this.messages[id];
                });
            }
            return this.messages[id];
        });
    }


    openRemoteChannelView(hostHash: string, sectionId: string, fromDisabled?: boolean) {
        if (this.openChannelViewLock) {
            return;
        }
        // console.log(1)
        let active = this.sidebar.getActive();
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        // console.log(2)

        if (fromDisabled !== true && active != null
           && (active.type != component.sidebar.SidebarElementType.HOST && active.section && active.section.getId() == sectionId)) {
            return Q.resolve(null);
        }
        // console.log(3)

        return Q().then(() => {
            // console.log(4)

            return session.mailClientApi.privmxRegistry.getSectionManager().then(sm => {
                // console.log(5)

                return sm.load().thenResolve(sm);
            })
        })
        .then(sectionManager => {
            let section = sectionManager.getSection(sectionId);
            if (section == null) {
                return Q.resolve(null);
            }
            this.openChannelViewLock = true;
            return Q().then(() => {
                if (!section.isChatModuleEnabled()) {
                    this.openDisabledSectionView(session, section);
                    this.openChannelViewLock = false;
                    return;
                }
                else {
                    // console.log(6)

                    return section.getChatModule().getSinkIndex().then(sinkIndex => {
                        section.getChatModule().sinkIndex = sinkIndex;
                        return;
                    })
                    .then(() => {
                        // console.log(7)

                        return this.getOrCreateRemoteChannel(hostHash, section);
                    })
                    .then(() => {
                        // console.log(8)

                        this.sidebar.setActive({
                            type: component.sidebar.SidebarElementType.REMOTE_SECTION,
                            section: section,
                            hostHash: hostHash
                        }, false);
                        this.chatPlugin.activeSinkId = section.getChatSink().id;
                        this.chatPlugin.activeSinkHostHash = session.hostHash;
                        this.refreshActive(session);
                        
                        this.openChannelViewLock = false;
                        return;
                    })
                }
            })
                
        })

        .fin(() => {
            this.openChannelViewLock = false;
        })
    }

    openRemoteChatOrConversationView(hostHash: string, conversationId: string, force?: boolean, focus?: boolean): Q.Promise<mail.section.Conv2Section> {
        // console.log("on openRemoteConversationView");
        return Q().then(() => {
            if (focus !== false) {
                this.onViewFocus();
            }
            let active = this.sidebar.getActive();
            if (active != null && active.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION && active.conv2.id == conversationId) {
                if (focus !== false && this.activeMessages) {
                    this.activeMessages.focus();
                }
                return active.conv2;
            }
            let session = this.app.sessionManager.getSessionByHostHash(hostHash);
            let conversation = session.conv2Service.collection.find(x => x.id == conversationId);
            if (conversation == null) {
                if (force && conversationId) {
                    let users = session.conv2Service.getUsersFromConvId(conversationId);
                    conversation = session.conv2Service.getOrCreateConv(users, true);
                    if (conversation == null) {
                        return null;
                    }
                }
                else {
                    return null;
                }
            }
            this.chatPlugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
            this.chatPlugin.activeSinkHostHash = session.hostHash;
            // console.log("openRemoteConversation: before getOrCreateRemoteConversation")
            return this.getOrCreateRemoteConversation(hostHash, conversation)
            .then(() => {
                // console.log("openRemoteConversation: after getOrCreateRemoteConversation")
                this.sidebar.setActive({
                    type: component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                    conv2: conversation,
                    hostHash: session.hostHash
                }, false);
                return conversation;
        
            })
    
        })
    }
    
    refreshRemoteConversation(session: mail.session.Session, conversation: mail.section.Conv2Section): void {
        if (this.networkIsDown()) {
            this.showOfflineError();
            return;
        }
        let controller = this;
        conversation.persons.forEach(person => {
            if (person.hasContact()) {
                session.sectionManager.contactService.refreshContact(person.getHashmail(), true)
                .fail(controller.logErrorCallback);
            }
        });
    }



    expandRemoteSectionsList(hostEntry: component.remotehostlist.HostEntry): void {
        let session: mail.session.Session;
        let hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        let checkSessionExists: boolean = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if ( checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
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
            return this.chatPlugin.prepareSession(session);
        })
        .then(() => {
            return Q.all(session.sectionManager.sectionsCollection.list.map(x => x.getChatSinkIndex()));
        })
        .then(() => {
            this.registerRemoteChangeEvents(session);
            if (! this.remoteServers) {
                this.remoteServers = {};
            }
                
            this.initRemoteHostComponents(hostEntry, session);
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
        })
        .then(() => {
            this.updateSidebarHostElement(session);
        });

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
            elementsCountProvider: section => this.getSectionElementsCount(session, section),
            searchCountProvider: section => this.getSectionSearchCount(session, section),
            searchAllSearchedProvider: section => this.getSectionSearchAllSearched(session, section),
            withSpinnerProvider: section => this.getSectionWithSpinner(session, section),
            sorter: (a, b) => {
                let res = b.getChatLastDate() - a.getChatLastDate();
                return res == 0 ? component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: Types.section.NotificationModule.CHAT,
            checkShowAllAvailSections: false,
            session: session
        }

        let conv2ListOptions: component.remoteconv2list.RemoteConv2ListOptions = {
            unreadProvider: c2s => this.getUnreadFromConv2(session, c2s),
            elementsCountProvider: c2s => this.getConv2ElementsCount(session, c2s),
            searchCountProvider: c2s => this.getConv2SearchCount(session, c2s),
            searchAllSearchedProvider: c2s => this.getConv2SearchAllSearched(session, c2s),
            withSpinnerProvider: c2s => this.getConv2WithSpinner(session, c2s),
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


    //===========================
    //      SIDEBAR EVENTS
    //===========================
    
    onBeforeActivateSidebarElement(event: component.sidebar.ElementBeforeActivateEvent) {
        const moduleName = "chat";
        event.result = false;
        if (event.element.type == component.sidebar.SidebarElementType.HOST) {
            this.expandRemoteSectionsList(event.element.host);
        }
        else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
            const context = app.common.Context.create({
                moduleName: moduleName,
                contextType: "remote-section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: event.element.hostHash
                
            });
            this.contextHistory.append(context);            
            this.openRemoteChannelView(event.element.hostHash, event.element.section.getId());
        }
        else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            const context = app.common.Context.create({
                moduleName: moduleName,
                contextType: "remote-conversation",
                contextId: event.element.conv2.id,
                hostHash: event.element.hostHash
            });
            this.contextHistory.append(context);            
            this.openRemoteChatOrConversationView(event.element.hostHash, event.element.conv2.id, false);
        }

        else if (event.element.type == component.sidebar.SidebarElementType.CONVERSATION) {
            const context = app.common.Context.create({
                moduleName: moduleName,
                contextType: "conversation",
                contextId: event.element.conv2.id,
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);            
            this.openChatOrConversationView(event.element.conv2.id, false);
        }
        else if (event.element.type == component.sidebar.SidebarElementType.SECTION) {
            const context = app.common.Context.create({
                moduleName: moduleName,
                contextType: "section",
                contextId: event.element.section.getId(),
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);            
            this.openChannelView(this.app.sessionManager.getLocalSession(), event.element.section.getId());
        }
        else if (event.element.type == component.sidebar.SidebarElementType.CUSTOM_SECTION) {
            const context = app.common.Context.create({
                moduleName: moduleName,
                contextType: "custom",
                contextId: event.element.section.getId(),
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);            
            this.openChannelView(this.app.sessionManager.getLocalSession(), event.element.section.getId());
        }
        else if (event.element.type == component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            const context = app.common.Context.create({
                moduleName: moduleName,
                contextType: "custom",
                contextId: event.element.customElement.id,
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);            

            if (event.element.customElement.id == ChatWindowController.MY_PRIVATE) {
                this.openPrivateConversationsView();
            }
        }
    }
    
    onActivatedSidebarElement(event: component.sidebar.ElementActivatedEvent) {
        let localSession = this.app.sessionManager.getLocalSession();
        if (event.element.type == component.sidebar.SidebarElementType.HOST) {
        }
        if (event.element.type == component.sidebar.SidebarElementType.CONVERSATION) {
            this.refreshActive(localSession);
        }
        else if (event.element.type == component.sidebar.SidebarElementType.SECTION) {
            this.refreshActive(localSession);
        }
        if (event.element.type == component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            let session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            this.refreshActive(session);
        }
        else if (event.element.type == component.sidebar.SidebarElementType.REMOTE_SECTION) {
            let session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            this.refreshActive(session);
        }

        else if (event.element.type == component.sidebar.SidebarElementType.CUSTOM_SECTION) {
            this.refreshActive(localSession);
        }
    }
    
    onSidebarButtonAction(event: component.sidebar.SidebarButtonActionEvent) {
        if (event.sidebarButton.id == "new-chat" && !(<any>event.sidebarButton).disabled) {
            this.openNewChat();
        }
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }

    }

    
    //===========================
    //          UTILS
    //===========================
    
    onSinkChange(event: Types.utils.collection.CollectionEvent<mail.SinkIndex>) {
        if (event.element == null) {
            return;
        }
        this.refreshSidebarBySid(event.element.sink.id);
    }
    
    registerRemoteChangeEvents(session: mail.session.Session): void {
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.sinkIndexCollection.changeEvent, event => {
            if (event.element) {
                this.refreshSidebarBySidRemote(session.hostHash, event.element.sink.id)
            }
        });
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.messagesCollection.changeEvent, events => {
            let map: {[sid: string]: boolean} = {};
            utils.Event.applyEvents(events, event => {
                if (event.element) {
                    map[event.element.index.sink.id] = true;
                }
            });
            for (let sid in map) {
                this.refreshSidebarBySidRemote(session.hostHash, sid);
            }
        }, "multi");
    }
    
    refreshSidebarBySid(sid: string) {
        // console.log("on refreshSidebarBySinkId")
        let section = this.sectionManager.getSectionBySinkId(sid);
        if (section == null) {
            return;
        }
        let convIndex = this.sidebar.conv2List.conversationCollection.indexOfBy(x => x.section == section);
        if (convIndex != -1) {
            this.sidebar.conv2List.conversationCollection.triggerUpdateAt(convIndex);
            return;
        }
        let sectionIndex = this.sidebar.sectionList.sectionsCollection.indexOfBy(x => x.getId() == section.getId());
        if (sectionIndex != -1) {
            this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
            return;
        }
        let customSectionIndex = this.sidebar.customSectionList.sectionsCollection.indexOfBy(x => x.getId() == section.getId());
        if (customSectionIndex != -1) {
            this.sidebar.customSectionList.sortedCollection.triggerBaseUpdateElement(section);
            return;
        }
        // console.log("refreshSidebarBySinkId end.")
    }
    
    refreshSidebarBySidRemote(hostHash: string, sid: string) {
        if (hostHash == this.app.sessionManager.getLocalSession().hostHash) {
            return this.refreshSidebarBySid(sid);
        }
        // console.log("on refreshSidebarBySinkId")
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        let section = session.sectionManager.getSectionBySinkId(sid);
        if (section == null) {
            return;
        }
        let convIndex = this.sidebar.remoteConv2Lists[hostHash].conversationCollection.indexOfBy(x => x.section == section);
        if (convIndex != -1) {
            this.sidebar.remoteConv2Lists[hostHash].conversationCollection.triggerUpdateAt(convIndex);
            this.updateSidebarHostElement(session);
            return;
        }
        let sectionIndex = this.sidebar.remoteSectionsLists[hostHash].sortedCollection.indexOfBy(x => x.getId() == section.getId());
        if (sectionIndex != -1) {
            this.sidebar.remoteSectionsLists[hostHash].sortedCollection.triggerBaseUpdateElement(section);
            this.updateSidebarHostElement(session);
            return;
        }
    }
    
    updateSidebarHostElement(session: mail.session.Session): void {
        if (this.app.sessionManager.getLocalSession() == session) {
            return;
        }
        let element = this.sidebar.hostList.hostsSortedCollection.find(x => x.host == session.host);
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    }
    
    openNewChat(hashmails: string[] = []): void {
        this.app.ioc.create(window.selectcontacts.SelectContactsWindowController, [this, {
            message: this.i18n("plugin.chat.window.chat.selectContacts.header.newChat.text"),
            editable: true,
            hashmails: hashmails,
            fromServerUsers: true
        }])
        .then(win => {
            let singletonSuffix = !hashmails || hashmails.length == 0 || !this.activeMessages ? "new-conv2" : this.activeMessages.getId();
            this.app.openSingletonWindow("selectContacts-" + singletonSuffix , win);
            win.getPromise().then(hashmails => {
                let convId = this.conv2Service.getConvIdFromHashmails(hashmails);
                const context = app.common.Context.create({
                    moduleName: Types.section.NotificationModule.CHAT,
                    contextType: "conversation",
                    contextId: convId,
                    hostHash: this.app.sessionManager.getLocalSession().hostHash
                });
                this.contextHistory.append(context); 
                this.openChatOrConversationView(convId, true);
            });
        });
    }
    
    openSectionsWindow(): void {
        // this.app.openSingletonWindow("sections", window.sections.SectionsWindowController);
        this.app.openNewSectionDialogFromSidebar();
    }
    
    
    //=======================
    //   SECTION COUNTERS
    //=======================
    
    getUnread(session: mail.session.Session, section: mail.section.SectionService): number {
        if (!section.hasChatModule()) {
            return 0;
        }
        let mailStats = this.chatPlugin.mailStats[session.hostHash];
        if (!mailStats) {
            return 0;
        }
        let stats = mailStats.getStats(section.getChatSink().id);
        return this.chatPlugin.getUnreadCountFromStats(stats);
    }
    
    getSectionElementsCount(session: mail.session.Session, section: mail.section.SectionService): number {
        if (!section.hasChatModule() || section.getChatModule().sinkIndex == null) {
            return 0;
        }
        return section.getChatModule().sinkIndex.getMessagesCount();
    }
    
    getSectionSearchCount(session: mail.session.Session, section: mail.section.SectionService): number {
        let id = section.getId();
        let searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].count;
        }
        return 0;
    }
    
    getSectionSearchAllSearched(session: mail.session.Session, section: mail.section.SectionService): boolean {
        let id = section.getId();
        let searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].allSearched;
        }
        return true;
    }
    
    getSectionWithSpinner(session: mail.session.Session, section: mail.section.SectionService): boolean {
        let sws = this.chatPlugin.sectionsWithSpinner;
        if (sws[session.hostHash] && sws[session.hostHash]["__all__"]) {
            return true;
        }
        if (!sws[session.hostHash]) {
            return false;
        }
        return !!sws[session.hostHash][section.getId()];
    }
    
    getSectionActiveVoiceChatInfo(session: mail.session.Session, section: mail.section.SectionService) {
        let users = this.getActiveVoiceChatUsers(session.hostHash, section.getId());
        let ret = {
            active: users.length > 0,
            users: users
        }
        return ret;
    }

    //=======================
    // CONVERSATION COUNTERS
    //=======================
    
    getUnreadFromConv2(session: mail.session.Session, conv2Section: mail.section.Conv2Section): number {
        return conv2Section.section == null ? 0 : this.getUnread(session, conv2Section.section);
    }
    
    getConv2ElementsCount(session: mail.session.Session, conv2Section: mail.section.Conv2Section): number {
        if (conv2Section.section == null) {
            return 0;
        }
        if (!conv2Section.section.hasChatModule() || conv2Section.section.getChatModule().sinkIndex == null) {
            return 0;
        }
        return conv2Section.section.getChatModule().sinkIndex.getMessagesCount();
    }
    
    getConv2SearchCount(session: mail.session.Session, conv2Section: mail.section.Conv2Section): number {
        let id = conv2Section.id;
        let searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].count;
        }
        return 0;
    }
    
    getConv2SearchAllSearched(session: mail.session.Session, conv2Section: mail.section.Conv2Section): boolean {
        let id = conv2Section.id;
        let searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].allSearched;
        }
        return true;
    }

    getConvActiveVoiceChatInfo(session: mail.session.Session, conv2: mail.section.Conv2Section) {
        let users = this.getActiveVoiceChatUsers(session.hostHash, conv2.id);
        return {
            active: users.length > 0,
            users: users
        }
    }


    //=======================
    //   REMOTE COUNTERS
    //=======================
    
    getRemoteUnread(host: string): number {
        return 0;
    }
    
    getRemoteSectionElementsCount(host: string): number {
        return 0;
    }
    
    getRemoteSectionSearchCount(host: string): number {
        return 0;
    }
    
    getRemoteSectionSearchAllSearched(host: string): boolean {
        return true;
    }

    
    getConv2WithSpinner(session: mail.session.Session, conv2Section: mail.section.Conv2Section): boolean {
        let sws = this.chatPlugin.sectionsWithSpinner;
        if (sws[session.hostHash] && sws[session.hostHash]["__all__"]) {
            return true;
        }
        if (!sws[session.hostHash]) {
            return false;
        }
        return !!sws[conv2Section.id];
    }
    
    //=======================
    //        SEARCH
    //=======================
    
    onFilterMessages(): void {
        this.searchCountFilterUpdater.updateFilter(this.app.searchModel.get());
    }
    
    onSearchCountFilterUpdate(): boolean {
        let sm = this.app.searchModel.get();
        let searchStr = sm.visible && sm.value && sm.value.length >= MessagesFilterUpdater.MIN_CHARS_NUM ? sm.value : "";
        let localSession = this.app.sessionManager.getLocalSession();
        for (let session of this.chatPlugin.getReadySessions()) {
            let sections: mail.section.SectionService[] = [];
            this.chatPlugin.chatSections[session.hostHash].forEach(x => sections.push(x));
            session.conv2Service.collection.list.forEach(x => sections.push(x.section));
            sections.forEach(section => {
                if (!section) {
                    return;
                }
                let isUserGroup = section.isUserGroup();
                let id = section.getId();
                let count = 0;
                let allSearched = true;
                if (searchStr != "") {
                    let sinkIndex = session.sectionManager.sinkIndexManager.getIndexBySink(section.getChatSink());
                    
                    let seqLoaded = Math.max(0, section.getChatModule().sinkIndex.cursor.seq - ChatMessagesController.MESSAGES_TO_LOAD);
                    let conv2Section: mail.section.Conv2Section = isUserGroup ? session.conv2Service.collection.find(x => x.section && x.section.getId() == id) : null;
                    let messagesId = isUserGroup
                        ? this.getConversationId(session, conv2Section)
                        : this.getChannelId(session, section);
                    if (messagesId in this.messages) {
                        seqLoaded = this.messages[messagesId].takeCollectionSeq;
                    }
                    allSearched = seqLoaded == 0;
                    for (let i = sinkIndex.entries.indexMap.length - 1; i >= seqLoaded; --i) {
                        let idx = sinkIndex.entries.indexMap[i];
                        if (idx === null || idx === undefined) {
                            continue;
                        }
                        let entry = sinkIndex.entries.list[idx];
                        if (!entry || typeof(entry.getMessage) != "function") {
                            continue;
                        }
                        if (this.chatPlugin.filterMessagesForDisplay(entry) && ChatMessagesController.meetsFilter(entry, searchStr)) {
                            count++;
                        }
                    }
                }
                if (isUserGroup) {
                    this.updateConversationSearchResults(session, id, count, allSearched);
                }
                else {
                    this.updateChannelSearchResults(session, id, count, allSearched);
                }
            });
            if (session.hostHash != localSession.hostHash) {
                this.sidebar.remoteSectionsLists[session.hostHash].sortedCollection.refresh();
                this.sidebar.remoteConv2Lists[session.hostHash].sortedCollection.refresh();
            }
        }
        this.sidebar.sectionList.sortedCollection.refresh();
        this.sidebar.conv2List.sortedCollection.refresh();
        this.isSearchOn = searchStr != "";
        this.callViewMethod("changeIsSearchOn", this.isSearchOn);
        return true;
    }
    
    updateConversationSearchResults(session: mail.session.Session, sectionId: string, count: number, allSearched: boolean) {
        let convId = session.conv2Service.collection.find(x => x.section && x.section.getId() == sectionId).id;
        let searchResults = this.getSearchResults(session);
        if (convId in searchResults && searchResults[convId].count == count && searchResults[convId].allSearched == allSearched) {
            return;
        }
        searchResults[convId] = { count, allSearched };
        let isLocalSession = session.hostHash == this.app.sessionManager.getLocalSession().hostHash;
        let collection = isLocalSession ? this.sidebar.conv2List.sortedCollection : (this.sidebar.remoteConv2Lists[session.hostHash] ? this.sidebar.remoteConv2Lists[session.hostHash].sortedCollection : null);
        if (collection) {
            let idx = collection.indexOfBy(cm => cm.id == convId);
            if (idx >= 0) {
                collection.triggerUpdateAt(idx);
            }
        }
    }
    
    updateChannelSearchResults(session: mail.session.Session, sectionId: string, count: number, allSearched: boolean) {
        let searchResults = this.getSearchResults(session);
        if (sectionId in searchResults && searchResults[sectionId].count == count && searchResults[sectionId].allSearched == allSearched) {
            return;
        }
        searchResults[sectionId] = { count, allSearched };
        let isLocalSession = session.hostHash == this.app.sessionManager.getLocalSession().hostHash;
        let collection = isLocalSession ? this.sidebar.sectionList.sortedCollection : (this.sidebar.remoteSectionsLists[session.hostHash] ? this.sidebar.remoteSectionsLists[session.hostHash].sortedCollection : null);
        if (collection) {
            let idx = collection.indexOfBy(cm => cm.getId() == sectionId);
            if (idx >= 0) {
                collection.triggerUpdateAt(idx);
            }
        }
    }
    
    getSearchResults(session: mail.session.Session): SearchResults {
        if (!this.searchResults[session.hostHash]) {
            this.searchResults[session.hostHash] = {};
        }
        return this.searchResults[session.hostHash];
    }
    
    onChatUpdateSearchStatsEvent(event: ChatUpdateSearchStatsEvent): void {
        let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
        if (!session) {
            return;
        }
        let sectionId = event.sectionId;
        let section = this.chatPlugin.chatSections[session.hostHash].find(x => x.getId() == sectionId);
        let count = event.searchCount;
        let allSearched = event.allSearched;
        if (!section) {
            return;
        }
        if (section.isUserGroup()) {
            this.updateConversationSearchResults(session, sectionId, count, allSearched);
        }
        else {
            this.updateChannelSearchResults(session, sectionId, count, allSearched);
        }
    }
    
    handleFilePaste(element: app.common.clipboard.ClipboardElement): boolean {
        if (app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES in element.data && this.activeMessages) {
            this.activeMessages.tryPaste(element, "text" in element.data ? element.data.text : null);
            return true;
        }
        else if (element.data.file && element.data.file.element instanceof mail.section.OpenableSectionFile) {
            let osf: mail.section.OpenableSectionFile = element.data.file.element;
            osf.getBuffer().then(buff => {
                this.activeMessages.pasteFile(osf.mimeType, buff, osf.path);
            });
            return true;
        }
        else if (element.data.files && element.data.files.filter((x: any) => !x || !(x.element instanceof mail.section.OpenableSectionFile)).length == 0) {
            let prom = Q();
            element.data.files.forEach((x: any) => {
                let osf: mail.section.OpenableSectionFile = x.element;
                prom = prom.then(() => {
                    return osf.getBuffer().then(buff => {
                        return this.activeMessages.pasteFile(osf.mimeType, buff, osf.path);
                    });
                });
            });
            return true;
        }
        return false;
    }
    
    refreshActivePanelThumbs(): void {
        if (this.activeMessages && this.activeMessages.thumbs) {
            (<any>this.activeMessages.thumbs).processThumbs();
        }
    }

    areAnySectionsExceptPrivate(): boolean {
        let sectionsCount = this.chatPlugin.chatRootSections[this.app.sessionManager.getLocalSession().hostHash].list.filter(x => !x.isPrivate()).length;
        let conversationsCount = this.chatPlugin.conv2Service.collection.list.length;
        return sectionsCount > 0 || conversationsCount > 0;
    }
    
    // onJoinVideoConference(event: Types.event.JoinVideoConferenceEvent): void {
    //     this.callViewMethod("openVideoConferencePanel");
    //     let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
    //     let section = event.section ? event.section : (event.conversation ? event.conversation.section : null);
    //     if (session && section) {
    //         this.videoConference.connect(session, section)
    //         .fail(e => {
    //             this.videoConference.disconnect();
    //         });
    //     }
    // }
    
    // onLeaveVideoConference(event: Types.event.LeaveVideoConferenceEvent): void {
    //     this.closeVideoConferencePanel();
    // }
    
    // closeVideoConferencePanel(): void {
    //     this.callViewMethod("closeVideoConferencePanel");
    // }
    
}

