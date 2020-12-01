import * as Mail from "pmc-mail";
import Q = Mail.Q;
import {ChatEntry} from "./ChatEntry";
import {UsersGroup, UsersGroupApi} from "./UsersGroupApi";
import { ChatMessagesController } from "../component/chatmessages/ChatMessagesController";
import { ChatsCollection } from "./ChatsCollection";
import { ChatMessage } from "./ChatMessage";
import { PrivateConversationsController } from "../component/privateconversations/PrivateConversationsController";
import { i18n } from "../i18n/index";
import { MessagesMarkerQueue } from "./MessagesMarkerQueue";
import { ActiveElementInfo } from "../window/chat/ChatWindowController";
import { mail } from "pmc-mail/out/window/settings/main";
import { NoSectionsController } from "../component/nosections/NoSectionsController";

let Logger = Mail.Logger.get("privfs-chat-plugin.ChatPlugin");

export interface MailPluginActionEvent {
    type: string;
    entryId: string;
    entryType: string;
}

export interface MailPlugin {
    constructor: MailPluginStatic;
    eventDispatcher: Mail.utils.EventDispatcher;
    addCollectionGetter(getter: (sid: string) => Mail.utils.collection.BaseCollection<any>): void;
    addViewScript(assetSpec: Mail.app.common.AssetSpec): void;
    addViewStyle(assetSpec: Mail.app.common.AssetSpec): void;
    addToRawConverter(converter: (entry: any) => any): void;
}

export interface ChatRawEntry {
    id: string;
    type: string;
    broken: boolean;
    isOutbox: boolean;
    isTrash: boolean;
    unreadCount: number;
    persons: {
        name: string;
        hashmail: string;
    }[];
    sender: {
        showPicture: boolean;
        hashmail: string;
        name: string;
    };
    showReceiverPicture: boolean;
    receivers: {
        hashmail: string;
        name: string;
    }[],
    serverDate: number;
}

export interface MailPluginStatic {
    isMailMessage(entry: Mail.mail.SinkIndexEntry): boolean;
}

export interface Channel {
    channelName: string;
    sinkWif: string;
    descriptorRef: string;
    group: UsersGroup;
}

export interface KvdbChannelsEntry {
    channels: Channel[];
}

export interface PersonModel {
    hashmail: string;
    username: string;
    name: string;
    present: boolean;
    description: string;
    deleted?: boolean;
}

export interface NotificationData {
    entry: Mail.mail.SinkIndexEntry
}

export interface RenderedNotificationData extends NotificationData {
    renderedTitle: string;
    renderedMessage: string;
    filtered: boolean;
    customTitleLength?: number;
    customMessageLength?: number;
    customEllipsis?: string;
}

export interface NotificationInterface {
    sinkType: string;
    notificationType: string;
    render: (data: NotificationData) => RenderedNotificationData;
}

export interface ChannelSetting {
    sinkId: string;
    id: string;
    mutedModules: {
        [key: string]: boolean,
        chat?: boolean;
        notes2?: boolean;
        tasks?: boolean;
    };
    hostHash?: string;
}

export interface GUISettings {
    [id: string]: boolean;
}

export interface UploadResult {
    sinkId: string;
    serverId: number;
    success: boolean;
    couse: any;
    result: Mail.privfs.types.message.MessagePostResult;
    message: Mail.privfs.message.Message;
}

export interface ChatChannel {
    sink: Mail.privfs.message.MessageSinkPriv;
    sinkId: string;
    raw: Channel;
    scope: string;
    hasAccess: boolean;
    groupId: string;
    sinkIndex: Mail.mail.SinkIndex;
}

export type ChatComponentFactory = Mail.component.ComponentFactory&{
    createComponent(componentName: "chatmessages", args: [Mail.window.base.BaseWindowController]): ChatMessagesController;
    createComponent(componentName: "privateconversations", args: [Mail.window.base.BaseWindowController]): PrivateConversationsController;
    createComponent(componentName: "nosections", args: [Mail.window.base.BaseWindowController]): NoSectionsController;
}

export interface ChatValidMessageTypeForDisplayChangeEvent extends Mail.Types.event.Event {
    type: "chatvalidmessagetypefordisplaychange"
}

export interface ChatValidMessageTypeForUnreadChangeEvent extends Mail.Types.event.Event {
    type: "chatvalidmessagetypeforunreadchange"
}

export interface RequestOpenChatEvent extends Mail.Types.event.Event {
    type: "requestopenchat";
    hashmails: string[];
    showContactsWindow?: boolean;
}

export interface UpdateChatSidebarSpinnersEvent extends Mail.Types.event.Event {
    type: "update-chat-sidebar-spinners";
    customElementId?: string;
    conv2SectionId?: string;
    sectionId?: string;
    hostHash?: string;
}

export interface MarkedChatsAsReadEvent extends Mail.Types.event.Event {
    type: "marked-chats-as-read";
    projectId: string;
    hostHash: string;
}

export class ChatPlugin {
    static CHAT_MESSAGES_LIST_COMPONENT: string = "chat-plugin.chatMessagesList";
    
    static CHANNELS_SETTINGS_KEY = "chat-plugin.muted-channels";
    static GUI_SETTINGS_KEY = "chat-plugin.gui-settings";
    static VIEW_SETTINGS_KEY = "chat-plugin.view-settings";
    
    static contactService: Mail.mail.contact.ContactService;
    
    chatUnreadCountModel: Mail.utils.Model<number>;
    chatUnreadCountFullyLoadedModel: Mail.utils.Model<boolean>;
    mailPlugin: MailPlugin;
    chatSections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    // proxyHosts: Mail.utils.collection.BaseCollection<Mail.component.remotehostlist.HostEntry>;
    chatPrimarySections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    chatRootSections: { [hostHash: string]: Mail.utils.collection.BaseCollection<Mail.mail.section.SectionService> } = {};
    chatChannelsSettings: ChannelSetting[];
    isGloballyMuted: boolean = false;
    activeMessages: ChatMessagesController;
    activeSinkId: string;
    activeSinkHostHash: string;
    activeWindowFocused: string;
    actionOnSendFileToChannel: (channelId: string) => void;
    usersGroupApi: UsersGroupApi;
    sectionManager: Mail.mail.section.SectionManager;
    serverProxyService: Mail.mail.proxy.ServerProxyService;
    notes2PluginPresent: boolean;
    tasksPluginPresent: boolean;
    conversationService: Mail.mail.conversation.ConversationService;
    userPreferences: Mail.mail.UserPreferences.UserPreferences;
    srpSecure: Mail.privfs.core.PrivFsSrpSecure;
    sinkIndexManager: Mail.mail.SinkIndexManager;
    personService: Mail.mail.person.PersonService;
    identity: Mail.privfs.identity.Identity;
    contactService: Mail.mail.contact.ContactService;
    utilApi: Mail.mail.UtilApi;
    collectionFactory: Mail.mail.CollectionFactory;
    conv2Service: Mail.mail.section.Conv2Service;
    mailStats: { [hostHash: string]: Mail.mail.MailStats } = {};
    messageFlagsUpdater: { [hostHash: string]: Mail.mail.MessageFlagsUpdater } = {};
    messagesMarkerQueue: { [hostHash: string]: MessagesMarkerQueue } = {};
    onLoginPromise: Q.Promise<void>;
    loadChannelsPromise: Q.Promise<void>;
    validMessageTypesForDisplay: string[];
    validMessageJsonTypesForDisplay: string[];
    validMessageTypesForUnread: string[];
    validMessageJsonTypesForUnread: string[];
    sectionsWithSpinner: { [hostHash: string]: { [id: string]: boolean } } = {};

    constructor(public app: Mail.app.common.CommonApplication) {
        this.chatUnreadCountModel = new Mail.utils.Model(0);
        this.chatUnreadCountFullyLoadedModel = new Mail.utils.Model(false);
        this.validMessageTypesForDisplay = [
            Mail.mail.section.ChatModuleService.CHAT_MESSAGE_TYPE
        ];
        this.validMessageJsonTypesForDisplay = [
            "create-task",
            "create-file",
            "task-comment",
            "joined-voicechat",
            "left-voicechat"
        ];
        this.validMessageTypesForUnread = [
            Mail.mail.section.ChatModuleService.CHAT_MESSAGE_TYPE
        ];
        this.validMessageJsonTypesForUnread = [
            ""
        ];
    }
    
    reset() {
        this.chatSections = {};
        // this.proxyHosts = null;
        this.chatPrimarySections = {};
        this.chatRootSections = {};
        this.usersGroupApi = null;
        this.loadChannelsPromise = null;
        this.onLoginPromise = null;
        this.chatUnreadCountFullyLoadedModel.setWithCheck(false);
        this.sectionsWithSpinner = {};
        
        // this.app.eventDispatcher.removeEventListenerByReferrer("chat");
    }
    
    registerTexts(localeService: Mail.mail.LocaleService): void {
        localeService.registerTexts(i18n, "plugin.chat.");
    }
    

    isNotes2PluginPresent() {
        return this.notes2PluginPresent;
    }
    
    isTasksPluginPresent() {
        return this.tasksPluginPresent;
    }
    
    addValidMessageTypeForDisplay(type: string) {
        Mail.utils.Lang.uniqueAdd(this.validMessageTypesForDisplay, type);
        this.app.dispatchEvent<ChatValidMessageTypeForDisplayChangeEvent>({
            type: "chatvalidmessagetypefordisplaychange"
        });
    }
    
    addValidMessageJsonTypeForDisplay(jsonType: string) {
        Mail.utils.Lang.uniqueAdd(this.validMessageJsonTypesForDisplay, jsonType);
        this.app.dispatchEvent<ChatValidMessageTypeForDisplayChangeEvent>({
            type: "chatvalidmessagetypefordisplaychange"
        });
    }
    
    addValidMessageTypeForUnread(type: string) {
        Mail.utils.Lang.uniqueAdd(this.validMessageTypesForUnread, type);
        this.refreshChatUnreadCount();
        this.app.dispatchEvent<ChatValidMessageTypeForUnreadChangeEvent>({
            type: "chatvalidmessagetypeforunreadchange"
        });
    }
    
    addValidMessageJsonTypeForUnread(jsonType: string) {
        Mail.utils.Lang.uniqueAdd(this.validMessageJsonTypesForUnread, jsonType);
        this.refreshChatUnreadCount();
        this.app.dispatchEvent<ChatValidMessageTypeForUnreadChangeEvent>({
            type: "chatvalidmessagetypeforunreadchange"
        });
    }
    
    filterMessagesForDisplay(entry: Mail.mail.SinkIndexEntry): boolean {
        if (this.validMessageTypesForDisplay.indexOf(entry.source.data.type) == -1) {
            return false;
        }
        if (entry.source.data.contentType != "application/json") {
            return true;
        }
        let data = entry.getContentAsJson();
        let jsonType = data && data.type ? data.type : "";
        return this.validMessageJsonTypesForDisplay.indexOf(jsonType) != -1;
    }
    
    initSessionSpecificFields(): void {
        this.mailStats = {};
        this.messageFlagsUpdater = {};
        this.messagesMarkerQueue = {};
    }
    
    onLogin() {
        // console.log("chatPlugin: ")
        if (this.onLoginPromise == null) {
            this.onLoginPromise = Q().then(() => {
            //     return (<any>this.app.sessionManager).initAfterLogin();
            // })
            // .then(() => {
                return Q.all([
                    Q.all([
                        this.app.mailClientApi.privmxRegistry.getConversationService(),
                        this.app.mailClientApi.privmxRegistry.getUserPreferences(),
                        this.app.mailClientApi.privmxRegistry.getSrpSecure(),
                        this.app.mailClientApi.privmxRegistry.getSinkIndexManager(),
                        this.app.mailClientApi.privmxRegistry.getPersonService(),
                        this.app.mailClientApi.privmxRegistry.getIdentity()
                    ]),
                    Q.all([
                        this.app.mailClientApi.privmxRegistry.getContactService(),
                        this.app.mailClientApi.privmxRegistry.getUtilApi(),
                        this.app.mailClientApi.privmxRegistry.getSectionManager(),
                        this.app.mailClientApi.privmxRegistry.getCollectionFactory(),
                        this.app.mailClientApi.privmxRegistry.getConv2Service(),
                        this.app.mailClientApi.privmxRegistry.getMailStats()
                    ]),
                    Q.all([
                        this.app.mailClientApi.privmxRegistry.getMessageFlagsUpdater(),
                        this.app.mailClientApi.privmxRegistry.getServerProxyService()
                    ]),
                ]);
            })
            .then(res => {
                let hostHash = this.app.sessionManager.getLocalSession().hostHash;
                this.conversationService = res[0][0];
                this.userPreferences = res[0][1];
                this.srpSecure = res[0][2];
                this.sinkIndexManager = res[0][3];
                this.personService = res[0][4];
                this.identity = res[0][5];
                this.contactService = res[1][0];
                this.utilApi = res[1][1];
                this.sectionManager = res[1][2];
                this.collectionFactory = res[1][3];
                this.conv2Service = res[1][4];
                this.messageFlagsUpdater[hostHash] = res[2][0];
                this.messagesMarkerQueue[hostHash] = new MessagesMarkerQueue(this.messageFlagsUpdater[hostHash], () => {});
                this.usersGroupApi = new UsersGroupApi(this.srpSecure);
                this.serverProxyService = res[2][1];
                
                let mailStats = res[1][5];
                if (mailStats) {
                    this.mailStats[mailStats.hostHash || this.app.sessionManager.getLocalSession().hostHash] = mailStats;
                }

                ChatPlugin.contactService = this.contactService;
                
                this.validMessageJsonTypesForDisplay = this.getValidMessagesTypesFromGUISettings(this.getGUISettings());
                
                if (this.mailPlugin) {
                    this.mailPlugin.addToRawConverter(this.convertToChatRawEntry.bind(this));
                    this.mailPlugin.addCollectionGetter(sid => {
                        let messagesFromSink = new Mail.utils.collection.FilteredCollection(this.collectionFactory.getMessagesCollectionBySid(sid), entry => {
                            return ChatMessage.isChatMessage(entry);
                        });
                        return new ChatsCollection(this.personService, this.conversationService, messagesFromSink).getCollection();
                    });
                }
            })
            .then(() => {
                this.serverProxyService.prepareCollection();
            })
        }
        return this.onLoginPromise;
    }
    
    refreshChatUnreadCount(mailStats?: Mail.mail.MailStats) {
        if (! this.sinkIndexManager) {
            return;
        }
        
        if (!this.mailStats) {
            return;
        }
        
        if (mailStats) {
            this.mailStats[mailStats.hostHash] = mailStats;
        }
        
        let count = 0;
        for (let session of this.getReadySessions()) {
            let ms = this.mailStats[session.hostHash];
            if (!ms) {
                continue;
            }
            let inboxes = session.sectionManager.sinkIndexManager.getAllIndexesBySinkType("inbox").map(x => x.sink.id);
            let allIndexes = session.sectionManager.sinkIndexManager.getAllIndexes();
            let allIndexesIds: string[] = [];
            for (let idxId in allIndexes) {
                if (session.sectionManager.getSectionBySinkIndex(allIndexes[idxId])) {
                    allIndexesIds.push(idxId);
                }
            }
            let map = ms.map;
            for (let sid in map) {
                //console.log(`  sid=${sid}`)
                if (inboxes.indexOf(sid) >= 0) {
                    continue;
                }
                if (allIndexesIds.indexOf(sid) < 0) {
                    continue;
                }
                if (this.isChannelMuted(session, sid) || !map[sid].index.includeStatsToCombined()) {
                    continue;
                }
                let stats = map[sid].stats.getStats();
                count += this.getUnreadCountFromStats(stats);
            }
        }
        this.chatUnreadCountModel.setWithCheck(count);
    }
    
    getSessions(): Mail.mail.session.Session[] {
        let sessions: Mail.mail.session.Session[] = [];
        for (let hostHash in this.app.sessionManager.sessions) {
            let session = this.app.sessionManager.sessions[hostHash];
            sessions.push(session);
        }
        return sessions;
    }
    
    getReadySessions(): Mail.mail.session.Session[] {
        let sessions: Mail.mail.session.Session[] = [];
        for (let hostHash in this.app.sessionManager.sessions) {
            let session = this.app.sessionManager.sessions[hostHash];
            if ((!session.initPromise || session.initPromise.isFulfilled()) && (!session.loadingPromise || session.loadingPromise.isFulfilled())) {
                sessions.push(session);
            }
        }
        return sessions;
    }
    
    getUnreadMessages(session: Mail.mail.session.Session, projectId?: string): Q.Promise<Mail.mail.SinkIndexEntry[]> {
        let sectionId: string = null;
        if (projectId) {
            if (projectId.indexOf("c2:") == 0) {
                let conversation = session.conv2Service.collection.find(x => x.id == projectId);
                if (conversation && conversation.section) {
                    sectionId = conversation.section.getId();
                }
            }
            else {
                sectionId = projectId;
            }
        }
        
        let messages: Mail.mail.SinkIndexEntry[] = [];
        let prom: Q.Promise<void> = Q();
        session.sectionManager.sectionsCollection.forEach(section => {
            if (sectionId && section.getId() != sectionId) {
                return;
            }
            prom = prom.then(() => {
                return section.getChatModule().getSinkIndex().then(sinkIndex => {
                    sinkIndex.entries.list.forEach(x => {
                        if (this.filterMessagesForDisplay(x) && ChatMessagesController.isUnread(x)) {
                            messages.push(x);
                        }
                    })
                });
            });
        });
        return prom.thenResolve(messages);
    }
    
    getUnreadCountFromStats(stats: Mail.Types.mail.UnreadStatsBySid): number {
        //console.log("  getUnreadCountFromStats", stats);
        if (stats == null) {
            return 0;
        }
        let count = 0;
        this.validMessageTypesForUnread.forEach(type => {
            if (!stats.byType[type]) {
                return;
            }
            this.validMessageJsonTypesForUnread.forEach(jsonType => {
                count += stats.byType[type].byJsonType[jsonType] ? stats.byType[type].byJsonType[jsonType].unread : 0;
            });
        });
        return count;
    }
    
    onSendFileToChannel(channelId: string): boolean {
        if (this.actionOnSendFileToChannel) {
            this.actionOnSendFileToChannel(channelId);
            return true;
        }
        return false;
    }
    
    convertToChatRawEntry(session: Mail.mail.session.Session, chatEntry: ChatEntry): false|ChatRawEntry {
        if (chatEntry.getEntryType() != "chat") {
            return <any>false;
        }
        if (chatEntry.lastEntry == null) {
            return <any>{
                id: chatEntry.getEntryId(),
                type: "chat-plugin-chat-entry",
                broken: true
            };
        }
        let isOutbox = chatEntry.lastEntry.index.sink.extra.type == "outbox";
        let isTrash = chatEntry.lastEntry.index.sink.extra.type == "trash";
        let showSenderPicture = !isOutbox && !isTrash;
        let showReceiverPicture = isOutbox;
        let persons = chatEntry.conversationId.split(",").map(hashmail => {
            let person = session.conv2Service.personService.getPerson(hashmail);
            return {
                hashmail: person.getHashmail(),
                name: person.getName()
            };
        });
        let sender = session.conv2Service.personService.getPerson(chatEntry.lastEntry.source.data.sender.hashmail);
        let receivers = chatEntry.lastEntry.source.data.receivers.map(r => {
            var receiver = session.conv2Service.personService.getPerson(r.hashmail);
            return {
                hashmail: receiver.getHashmail(),
                name: receiver.getName()
            };
        });
        return {
            id: chatEntry.getEntryId(),
            type: "chat-plugin-chat-entry",
            broken: false,
            isOutbox: isOutbox,
            isTrash: isTrash,
            unreadCount: chatEntry.unreadCount,
            persons: persons,
            sender: {
                showPicture: showSenderPicture,
                hashmail: sender.getHashmail(),
                name: sender.getName()
            },
            showReceiverPicture: showReceiverPicture,
            receivers: receivers,
            serverDate: chatEntry.lastEntry.source.serverDate
        };
    }
    
    isMailMessage(entry: Mail.mail.SinkIndexEntry): boolean {
        return this.mailPlugin ? this.mailPlugin.constructor.isMailMessage(entry) : (!entry.source.data.type || entry.source.data.type == "pki-event");
    }
    
    getSinkIndexByWif(wif: string): Mail.mail.SinkIndex {
        let en = this.sinkIndexManager.getAllIndexes();
        for (let id in en) {
            if (en[id].sink.privWif == wif) {
                return en[id];
            }
        }
        return null;
    }
    
    prepareSession(session: Mail.mail.session.Session): Q.Promise<void> {
        return Q.all([
            session.mailClientApi.privmxRegistry.getMessageFlagsUpdater(),
        ])
        .then(res => {
            this.chatSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && !(<any>x.sectionData).primary);
            this.chatSections[session.hostHash].changeEvent.add(this.onAnySectionChange.bind(this));
            this.chatPrimarySections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, x => !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && (<any>x.sectionData).primary);
            this.chatPrimarySections[session.hostHash].changeEvent.add(this.onAnySectionChange.bind(this));
            this.chatRootSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.rootSectionsCollection, x => !x.isPrivateOrUserGroup() && x.isChatModuleEnabled(true));
            this.chatRootSections[session.hostHash].changeEvent.add(this.onAnySectionChange.bind(this));
            this.messageFlagsUpdater[session.hostHash] = res[0];
            this.messagesMarkerQueue[session.hostHash] = new MessagesMarkerQueue(this.messageFlagsUpdater[session.hostHash], () => {})
        });
    }
    
    loadChannels(): Q.Promise<void> {
        if (this.app.mailClientApi == null) {
            return Q();
        }
        return this.app.mailClientApi.lazyLoader.registerWithDeps("loadChannels", {}, () => {
            if (this.loadChannelsPromise == null) {
                this.initSessionSpecificFields();
                this.loadChannelsPromise = Q().then(() => {
                    return this.onLogin();
                })
                .then(() => {
                    return this.app.mailClientApi.prepareSectionManager();
                })
                .then(() => {
                    let localSession = this.app.sessionManager.getSession(this.identity.host);
                    return this.prepareSession(localSession);
                })
                .then(() => {
                    this.sectionManager.filteredCollection.changeEvent.add(this.onChatSectionChange.bind(this));
                    this.userPreferences.eventDispatcher.addEventListener<Mail.Types.event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this));
                    this.chatChannelsSettings = this.getChannelsSettings();
                    this.isGloballyMuted = this.userPreferences.isGloballyMuted();
                    let promises: Q.Promise<void>[] = [];
                    this.sectionManager.filteredCollection.forEach(section => {
                        if (section.hasChatModule()) {
                            promises.push(section.getChatSinkIndex()
                            .then(sinkIndex => {
                                if (section.isUserGroup()) {
                                    return this.conv2Service.addSection(section).prepareMessagesCollection();
                                }
                            }));
                        }
                    });
                    return Q.all(promises).thenResolve(null);
                })
                .then(() => {
                    this.app.addEventListener<Mail.Types.event.MarkAsReadEvent>("mark-as-read", event => {
                        let sessions: Mail.mail.session.Session[] = event.hostHash ? [this.app.sessionManager.getSessionByHostHash(event.hostHash)] : this.getReadySessions();
                        if (event.moduleName == "chat" || !event.moduleName) {
                            let projectId = event.sectionId || event.conversationId || event.customElementId;
                            Q().then(() => {
                                this.app.dispatchEvent<Mail.Types.event.SetBubblesState>({
                                    type: "set-bubbles-state",
                                    markingAsRead: true,
                                    scope: event,
                                });
                                let def = Q.defer();
                                setTimeout(() => def.resolve(), 300);
                                return def.promise;
                            }).then(() => {
                                return Q.all([sessions.map(session => this.markAllAsRead(session, projectId))]);
                            })
                            .fin(() => {
                                this.app.dispatchEvent<Mail.Types.event.SetBubblesState>({
                                    type: "set-bubbles-state",
                                    markingAsRead: false,
                                    scope: event,
                                });
                                this.app.dispatchEvent<MarkedChatsAsReadEvent>({
                                    type: "marked-chats-as-read",
                                    projectId: projectId,
                                    hostHash: event.hostHash,
                                });
                            });
                        }
                    });
                    this.app.addEventListener<Mail.Types.event.SetBubblesState>("set-bubbles-state", e => {
                        if (e.scope.moduleName && e.scope.moduleName != "chat") {
                            return;
                        }
                        let newState = e.markingAsRead;
                        let hostHash: string = e.scope.hostHash;
                        let id = e.scope.conversationId || e.scope.customElementId || e.scope.sectionId || "__all__";
                        if (hostHash) {
                            if (!this.sectionsWithSpinner[hostHash]) {
                                this.sectionsWithSpinner[hostHash] = {};
                            }
                            this.sectionsWithSpinner[hostHash][id] = newState;
                        }
                        else {
                            for (let hh in this.sectionsWithSpinner) {
                                this.sectionsWithSpinner[hh][id] = newState;
                            }
                        }
                        
                        this.app.dispatchEvent<UpdateChatSidebarSpinnersEvent>({
                            type: "update-chat-sidebar-spinners",
                            conv2SectionId: e.scope.conversationId || undefined,
                            customElementId: e.scope.customElementId || undefined,
                            sectionId: e.scope.sectionId || undefined,
                            hostHash: e.scope.hostHash || undefined,
                        });
                    });
                });
            }
            this.loadChannelsPromise.then(() => {
                this.chatUnreadCountFullyLoadedModel.setWithCheck(true);
            });
            return this.loadChannelsPromise;
        })
    }
    

    getChannelsSettings(): ChannelSetting[] {
        let settings: ChannelSetting[] = this.userPreferences.getValue(ChatPlugin.CHANNELS_SETTINGS_KEY);
        if (settings) {
            let sessMgr = this.app.sessionManager;
            for (let setting of settings) {
                let session = setting.hostHash && sessMgr.isSessionExistsByHostHash(setting.hostHash) ? sessMgr.getSessionByHostHash(setting.hostHash) : sessMgr.getLocalSession();
                let sectionManager = session.sectionManager || this.sectionManager;
                let section = sectionManager.getSection(setting.id);
                if (section) {
                    let sink = section.getChatSink();
                    if (sink) {
                        setting.sinkId = section.getChatSink().id;
                    }
                }
            }
        }
        return settings;
    }
    
    getGUISettings(): GUISettings {
        let rawSettings: string = this.userPreferences.getValue(ChatPlugin.GUI_SETTINGS_KEY);
        let settings: GUISettings;
        if (! rawSettings) {
            settings = this.getDefaultGUISettings();
            this.updateGUISettings(settings).fail(() => Logger.error("Error during saving default GUI settings."));
            return settings;
        }
        settings = JSON.parse(rawSettings);
        if (! settings) {
          settings = {};
        }
        return settings;
    }
    
    getDefaultGUISettings(): GUISettings {
        let settings: GUISettings = {};
        this.validMessageJsonTypesForDisplay.forEach( x => {
            settings[x] = false;
        });
        settings["create-file"] = true;
        return settings;
    }
    
    getViewSettings(): { [key: string]: any } {
        let rawSettings: string = this.userPreferences.getValue(ChatPlugin.VIEW_SETTINGS_KEY);
        let settings: { [key: string]: string };
        if (! rawSettings) {
            settings = this.getDefaultViewSettings();
            this.updateViewSettings(settings).fail(() => Logger.error("Error during saving default view settings."));
            return settings;
        }
        let defaults = this.getDefaultViewSettings();
        settings = JSON.parse(rawSettings);
        if (! settings) {
          settings = {};
        }
        for (let k in defaults) {
            if (!(k in settings)) {
                settings[k] = defaults[k];
            }
        }
        return settings;
    }
    
    getDefaultViewSettings(): { [key: string]: any } {
        let settings: { [key: string]: any } = {
            "invert-message-backgrounds": false,
            "hide-usernames": false,
            "show-search-contexts": false,
        };
        return settings;
    }
    
    getShowSearchContexts(): boolean {
        return !!this.getViewSettings()["show-search-contexts"];
    }
    
    updateViewSettings(settings: { [key: string]: any }) {
        return this.userPreferences.set(ChatPlugin.VIEW_SETTINGS_KEY, JSON.stringify(settings), true);
    }
    
    onAnySectionChange(event: Mail.Types.utils.collection.CollectionEvent<Mail.mail.section.SectionService>) {
        this.refreshChatUnreadCount();
    }
        
    onChatSectionChange(event: Mail.Types.utils.collection.CollectionEvent<Mail.mail.section.SectionService>) {
        if (event.type == "remove") {
            return;
        }
        if (event.element != null) {
            if (event.element.hasChatModule()) {
                event.element.getChatSinkIndex()
                .then(sinkIndex => {
                    if (event.element.isUserGroup()) {
                        if (this.activeMessages && this.activeMessages.chatInfo && this.activeMessages.chatInfo.conversation && this.activeMessages.chatInfo.conversation.section && this.activeMessages.chatInfo.conversation.section.getId() == event.element.getId()) {
                            this.activeSinkId = event.element.getChatSink().id;
                            this.activeSinkHostHash = (this.activeMessages && this.activeMessages.session ? this.activeMessages.session.hostHash : null) || this.app.sessionManager.getLocalSession().hostHash;
                        }
                        return this.conv2Service.addSection(event.element).prepareMessagesCollection()
                    }
                })
                .fail(e => {
                    Logger.error("Error during loading chat sink", event.element, e)
                });
            }
        }
    }
    
    onUserPreferencesChange() {
        this.chatChannelsSettings = this.getChannelsSettings();
        this.isGloballyMuted = this.userPreferences.isGloballyMuted();
        this.refreshChatUnreadCount();
    }
    
    updateGUISettings(settings: GUISettings) {
        this.validMessageJsonTypesForDisplay = this.getValidMessagesTypesFromGUISettings(settings);
        this.app.dispatchEvent<ChatValidMessageTypeForDisplayChangeEvent>({
            type: "chatvalidmessagetypefordisplaychange",
        });
        return this.userPreferences.set(ChatPlugin.GUI_SETTINGS_KEY, JSON.stringify(settings), true);
    }
    
    onBeforeSinkIndexEntryAdd(entry: Mail.mail.SinkIndexEntry) {
        if (entry.source.data.sender.pub58 == this.identity.pub58) {
            entry.addMods([{
                type: "setFlag",
                name: "read",
                value: true
            }]);
        }
    }
        
    isChannelMuted(session: Mail.mail.session.Session, sinkId: string, moduleName: Mail.Types.section.NotificationModule = Mail.Types.section.NotificationModule.CHAT): boolean {
        let sink = session.sectionManager.sinkIndexManager ? session.sectionManager.sinkIndexManager.getSinkById(sinkId) : null;
        if (sink && sink.name && sink.name.indexOf("<usergroup:") >= 0) {
            return false;
        }
        if (!this.chatChannelsSettings) {
            return false;
        }
        let muted: boolean = false;
        for (let i = 0; i < this.chatChannelsSettings.length; i++) {
            let settings = this.chatChannelsSettings[i];
            let settingsHostHash = settings.hostHash || this.app.sessionManager.getLocalSession().hostHash;
            if (session.hostHash == settingsHostHash && sinkId == settings.sinkId && settings.mutedModules && moduleName in settings.mutedModules) {
                muted = settings.mutedModules[moduleName];
                break;
            }
        }
        return muted;
    }
    
    isChannelFiltered(session: Mail.mail.session.Session, sinkId: string, moduleName: Mail.Types.section.NotificationModule = Mail.Types.section.NotificationModule.CHAT): boolean {
        let filtered = this.isChannelMuted(session, sinkId, moduleName) || ((this.activeSinkId === sinkId) && (this.activeSinkHostHash === session.hostHash) && this.activeWindowFocused === moduleName);
        return filtered;
    }
    
    static getPersonModel(person: Mail.mail.person.Person, session: Mail.mail.session.Session): PersonModel {
        let contactService = session && session.conv2Service && session.conv2Service.contactService ? session.conv2Service.contactService : ChatPlugin.contactService;
        return {
            hashmail: person.getHashmail(),
            username: person.username,
            name: person.hasContact() && person.contact.hasName() ? person.contact.getDisplayName() : "",
            description: person.getDescription(),
            present: person.isPresent(),
            deleted: contactService.deletedUsers.indexOf(person.usernameCore) >= 0,
        };
    }
    
    openTask(session: Mail.mail.session.Session, _sectionId: string, id: string, scrollToComments: boolean = false): void {
        let tasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksPlugin) {
            return;
        }
        (<any>tasksPlugin).openEditTaskWindow(session, id, true, scrollToComments);
    }
    
    getValidMessagesTypesFromGUISettings(settings: GUISettings): string[] {
        let arr: string[] = ["joined-voicechat", "left-voicechat"];
        for (let key in settings) {
            if (settings[key] == true) {
                arr.push(key);
            }
        }
        return arr;
    }
    
    onPollingResult(entries: Mail.mail.PollingItem[]) {
        this.notifyUser(entries);
    }
    
    isPollingItemComingFromMe(item: Mail.mail.PollingItem): boolean {
        if (item.entry) {
            let session = this.app.sessionManager.getSession(item.entry.host);
            let message = item.entry.getMessage();
            if (message.sender.pub58 == session.userData.identity.pub58) {
                return true;
            }
        }
        return false;
    }
    
    getContextFromSinkId(session: Mail.mail.session.Session, sinkId: string): string {
        let section: Mail.mail.section.SectionService = null;

        session.sectionManager.filteredCollection.list.forEach(x => {
            let sink = x.getChatSink();
            
            if (sink && sinkId == sink.id) {
                section = x;
                return;
            }
        });
        if (section) {
            let sectionId = section.getId();
            let conv2Id: string;
            if (sectionId.indexOf("usergroup") >= 0) {
                session.conv2Service.collection.list.forEach(x => {
                    if (x.section && x.section.getId() == sectionId) {
                        conv2Id = x.id;
                        return;
                    }
                });
                return conv2Id;
            }
            
            return "section:" + sectionId;
        }
        return null;
    }

    decodeStickerFromSinkId(session: Mail.mail.session.Session, sinkId: string, sticker: string): string {
        let section: Mail.mail.section.SectionService = null;
        session.sectionManager.filteredCollection.list.forEach(x => {
            if (sinkId == x.getChatSink().id) {
                section = x;
                return;
            }
        });
        if (section) {
            let sectionId = section.getId();
            return session.sectionManager.getSection(sectionId).stickersService.decodeSticker(sticker);
        }
        return null;
    }

    
    notifyUser(data: Mail.mail.PollingItem[]) {
        if (data.length == 0) {
            return;
        }
        let allowedMessages = data.filter(x => x.entry.source.data.contentType == "html" || x.entry.source.data.contentType == "text" || (x.entry.source.data.contentType == "application/json") && x.newStickers && x.newStickers.length > 0);
        if (allowedMessages) {
            allowedMessages.forEach(x => {
                if (!this.app.sessionManager.isSessionExistsByHost(x.entry.host)) {
                    return;
                }
                let session: Mail.mail.session.Session = this.app.sessionManager.getSession(x.entry.host);
                if (this.isChannelFiltered(session, x.entry.index.sink.id, x.entry.getModule()) || this.isChannelMuted(session, x.entry.index.sink.id, x.entry.getModule())) {
                    return;
                }
                let message = x.entry.getMessage();
                let isEmojiMessage: boolean = x.newStickers && x.newStickers.length > 0;
                let isJsonMessage = message.contentType == "application/json";
                if (isJsonMessage && !isEmojiMessage) {
                    return;
                }
                let context: string = this.getContextFromSinkId(session, x.entry.sink.id);
                if (isEmojiMessage) {
                    let identity = session.userData.identity;
                    if (message.sender.pub58 == identity.pub58) {
                        let stickers: {u: string, t: string, s: string}[] = x.newStickers;
                        stickers.forEach(sticker => {
                            if (identity.user == sticker.u) {
                                return;
                            }
                            let fileName: string = null;
                            if (isJsonMessage) {
                                fileName = JSON.parse(message.text).path;
                                fileName = fileName.substr(fileName.lastIndexOf("/") + 1);
                            }
                            let event: Mail.Types.event.NotificationServiceEvent = {type: "notifyUser", options: {
                                sender: sticker.u,
                                tray: false,
                                sound: true,
                                tooltip: true,
                                tooltipOptions: {
                                    title: "",
                                    text: this.getMarkedNotificationText(isJsonMessage ? fileName : message.text),
                                    sender: sticker.u,
                                    withAvatar: false,
                                    withUserName: true,
                                    withSticker: this.decodeStickerFromSinkId(session, x.entry.sink.id, sticker.s)
                                },
                                context: {
                                    module: Mail.Types.section.NotificationModule.CHAT,
                                    sinkId: context,
                                    hostHash: session.hostHash,
                                },
                            }};
                            this.app.dispatchEvent<Mail.Types.event.NotificationServiceEvent>(event);
                        })
                    }
                }
                else {
                    if (this.isPollingItemComingFromMe(x)) {
                        return;
                    }
                    let event: Mail.Types.event.NotificationServiceEvent = {type: "notifyUser", options: {
                        sender: message.sender.hashmail,
                        tray: true,
                        sound: true,
                        tooltip: true,
                        tooltipOptions: {
                            title: "", //this.app.localeService.i18n("plugin.chat.notifications.wrote_message"),
                            text: this.prepareMessageForNotification(message.text),
                            sender: message.sender.hashmail,
                            withAvatar: true,
                            withUserName: true
                        },
                        context: {
                            module: Mail.Types.section.NotificationModule.CHAT,
                            sinkId: context,
                            hostHash: session.hostHash,
                        },
                    }};
                    this.app.dispatchEvent<Mail.Types.event.NotificationServiceEvent>(event);
                }
            });
        }
    }
    
    getMarkedNotificationText(msgText: string): string {
        let maxLength = this.app.getNotificationTitleMaxLength();
        let ellipsis = this.app.getNotificationTitleEllipsis().trim();
        
        let basicText = this.app.localeService.i18n("plugin.chat.notifications.marked", "{0}");
        let basicTextLength = basicText.length - 3; // -3 for the {0}
        
        let msgTextMaxLength = maxLength - basicTextLength;
        msgText = msgText.replace(/<[^>]+>/g, "");
        if (msgText.length > msgTextMaxLength) {
            msgText = msgText.substr(0, msgTextMaxLength - ellipsis.length) + ellipsis;
        }
        
        return basicText.replace("{0}", msgText);
    }
    
    prepareMessageForNotification(text: string): string {
        let lines = text.split("<br>");
        let inQuote: boolean = false;
        let newLines: string[] = [];
        for (let line of lines) {
            if ((<any>line).startsWith("@<privmx-quote-header")) {
                inQuote = true;
            }
            else if (inQuote) {
                if (!(<any>line).startsWith("&gt;")) {
                    inQuote = false;
                }
            }
            if (!inQuote) {
                newLines.push(line);
            }
        }
        let newText = newLines.join(" ").replace(/<[^>]*>/g, "").trim();
        if (newText.length == 0) {
            newText = text;
        }
        return newText;
    }
    
    markAllAsRead(session: Mail.mail.session.Session, projectId: string): Q.Promise<void> {
        return this.getUnreadMessages(session, projectId).then(messages => {
            return this.messagesMarkerQueue[session.hostHash].add(messages, 0);
        });
    }
}