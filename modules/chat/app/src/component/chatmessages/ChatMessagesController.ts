import { app, component, mail, utils, window, Q, PrivmxException, privfs, Types } from "pmc-mail";
import { ChatMessage } from "../../main/ChatMessage";
import { ChatType } from "../../main/Types";
import { MessagesMarkerQueue, MessagesMarkerQueueEx } from "../../main/MessagesMarkerQueue";
import { PersonModel, ChatPlugin, ChatValidMessageTypeForDisplayChangeEvent, GUISettings, RequestOpenChatEvent } from "../../main/ChatPlugin";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";
import SectionManager = mail.section.SectionManager;
import SinkIndexEntry = mail.SinkIndexEntry;

import { SendingQueue } from "./SendingQueue";
import { SendingFileLocksManager } from "./SendingFileLocksManager";

export interface ChannelModel {
    id: string;
    name: string;
    scope: string;
    breadcrumb: string;
}

export interface UpdateVoiceChatUsersEvent {
    type: "update-voice-chat-users";
    sectionId: string;
    hostHash: string;
}

export interface Model {
    maxMsgTextSize: number;
    enterSends: boolean;
    chatType: ChatType;
    hasUnread: boolean;
    messagesCount: number;
    persons: PersonModel[];
    channel: ChannelModel;
    hasNotes2: boolean;
    hasTasks: boolean;
    unreadMarkers: Marker[];
    customStyle: string;
    customTemplate: string;
    guiSettings: GUISettings;
    viewSettings: { [key: string]: any };
    hostHash: string;
    sectionId: string;
    canWrite: boolean;
    isRemote: boolean;
    usersWithAccess: PersonModel[];
    platform: string;
    contextSize: number;
    isInVoiceChatInThisSection: boolean;
    isVoiceChatActiveInThisSection: boolean;
    isInVoiceChatInAnotherSection: boolean;
    isTalkingInThisSection: boolean;
    isTalkingInAnotherSection: boolean;
    isRingTheBellAvailable: boolean;
    isVoiceChatEnabled: boolean;
}

export interface TaskBadge {
    taskId: string;
    status: string;
    labelClass: string;
}

export interface InnerMessageModel {
    type: string;
    msgId: string;
    msgNum: number;
    sendingId: string;
    serverDate: number;
    sender: {
        hashmail: string;
        name: string;
        defaultName: string;
        description: string;
    };
    title: string;
    text: string;
    textAsJson: any;
    fileInfoIcon: string;
    contentType: string;
    attachments: {
        name: string;
        mimeType: string;
        size: number;
        icon: string;
    }[];
    read: boolean;
    myMessage: boolean;
    sending: boolean;
    taskLabelClass?: string;
    lastEdit: number;
    deleted: boolean;
    editCount: number;
    isEditable: boolean;
    emoji: Types.webUtils.EmojiIconsModel;
    taskStatuses: { [taskId: string]: string };
    nonExistantFileLink: boolean;
    isTldr: boolean;
    isExpanded: boolean;
    expandedQuotes: number[];
    distanceFromClosestMatch: number;
    sectionId: string;
    newFilePaths: { [did: string]: string };
    fileTaskBadges: TaskBadge[];
    hostHash: string;
}

export interface ChatInfo {
    type: ChatType;
    conversation: mail.section.Conv2Section;
    section: mail.section.SectionService;
}

export interface Marker {
    beg: number;
    end: number;
}

export interface MessagesFilterData {
    value: string;
    visible: boolean;
}

export interface ChatUpdateSearchStatsEvent extends Types.event.Event {
    type: "chatupdatesearchstatsevent";
    hostHash: string;
    sectionId: string;
    searchCount: number;
    allSearched: boolean;
}

export class SearchState {
    active: boolean;
    resultsCount: number;
    mayHaveMoreResults: boolean;
}

export class MessagesFilterUpdater {
    static UPDATE_DELAY: number = 400;
    static MIN_CHARS_NUM: number = 2;
    toUpdate: MessagesFilterData;
    previousFilter: MessagesFilterData;
    filter: MessagesFilterData;
    originalTakeCollectionSeq: number;
    originalSeqAlreadyKept: boolean;
    updateTimer: NodeJS.Timer;
    onUpdate: () => boolean;
    restoreSeq: (origSeq: number) => void;
    constructor() {
        this.originalSeqAlreadyKept = false;
        this.setFilter({ value: "", visible: false });
    }

    setFilter(filter: MessagesFilterData): void {
        this.filter = filter;
    }

    keepSeq(seq: number): void {
        // originalTakeCollectionSeq jest wykorzystywane do optymalizacji przy zamykaniu wyszukiwania
        // zapobiega wczytywania wszystkich wiadomosci do widoku, ktore zostaly pobrane
        // jedynie na potrzeby wyszukiwania, co w pewnych przypadkach potrafilo wywolac "freeze"
        // komputera na 10 sek..
        if (this.originalSeqAlreadyKept) {
            return;
        }
        this.originalTakeCollectionSeq = seq;
        this.originalSeqAlreadyKept = true;
    }

    resetSeq(): void {
        this.originalSeqAlreadyKept = false;
    }

    needsUpdate(): boolean {
        if (!this.previousFilter || !this.filter) {
            return true;
        }

        if (this.previousFilter.visible != this.filter.visible) {
            return true;
        }

        if (!this.previousFilter.visible && !this.filter.visible) {
            return false;
        }

        return this.previousFilter.value != this.filter.value;
    }

    updateFilter(filter: MessagesFilterData, onPanelActivate: boolean = false) {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (!filter.visible || filter.value.length < MessagesFilterUpdater.MIN_CHARS_NUM) {
            if (this.originalTakeCollectionSeq != null && typeof this.restoreSeq == "function") {
                this.restoreSeq(this.originalTakeCollectionSeq);
            }
            this.setFilter({ value: "", visible: false });
            if (this.onUpdate && this.needsUpdate()) {
                if (this.onUpdate()) {
                    this.previousFilter = this.filter;
                }
            }
            return;
        }
        if (filter.value.length < MessagesFilterUpdater.MIN_CHARS_NUM && filter.value.length != 0) {
            return;
        }
        this.toUpdate = {
            value: app.common.SearchFilter.prepareNeedle(filter.value),
            visible: filter.visible,
        };
        let f = () => {
            this.updateTimer = null;
            this.setFilter(this.toUpdate);
            if (this.onUpdate && this.needsUpdate()) {
                if (this.onUpdate()) {
                    this.previousFilter = this.filter;
                }
            }
        };
        if (onPanelActivate) {
            f();
        }
        else {
            this.updateTimer = setTimeout(f, MessagesFilterUpdater.UPDATE_DELAY);
        }
    }
}

@Dependencies(["splitter", "extlist", "persons", "emojipicker", "emojiviewbar", "notification"])
export class ChatMessagesController extends window.base.WindowComponentController<window.base.BaseWindowController> {

    static textsPrefix: string = "plugin.chat.component.chatMessages.";

    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }

    static MAX_MSG_TEXT_SIZE = 100000;
    static MESSAGES_TO_LOAD = 30;
    static MIN_SEARCH_RESULTS_TO_LOAD = 10;

    static SEARCH_CONTEXT_SIZE = 3;
    
    @Inject messageFlagsUpdater: mail.MessageFlagsUpdater;
    @Inject identity: privfs.identity.Identity;
    @Inject hashmailResolver: mail.HashmailResolver;
    @Inject personService: mail.person.PersonService;
    @Inject sinkIndexManager: mail.SinkIndexManager;
    @Inject messageService: mail.MessageService;
    @Inject conv2Service: mail.section.Conv2Service;

    horizontalSplitter: component.splitter.SplitterController;
    proxyCollection: utils.collection.FilteredCollection<mail.SinkIndexEntry>;
    filesMessagesProxyCollection: utils.collection.ProxyCollection<mail.SinkIndexEntry>;

    messagesCollection: utils.collection.SortedCollection<mail.SinkIndexEntry>;
    messages: component.extlist.ExtListController<InnerMessageModel>;
    takeCollection: utils.collection.FilteredCollection<mail.SinkIndexEntry>;
    transformCollection: utils.collection.TransformCollection<InnerMessageModel, mail.SinkIndexEntry>;
    messagesMarkerQueueEx: MessagesMarkerQueueEx;
    sendingId: number;
    sendMessages: number[];
    enterSends: utils.Settings;
    unreadMarkers: Marker[];
    loadingMoreMessages: Q.Promise<void>;
    filteredCollection: utils.collection.FilteredCollection<mail.SinkIndexEntry>;
    messagesFilterUpdater: MessagesFilterUpdater;
    chatPlugin: ChatPlugin;
    chatInfo: ChatInfo;
    // personsComponent: component.persons.PersonsController;
    emojiPicker: component.emojipicker.EmojiPickerController;
    emojiViewBar: component.emojiviewbar.EmojiViewBarController;
    taskTooltip: component.tasktooltip.TaskTooltipController;
    notifications: component.notification.NotificationController;
    encryptionEffect: component.encryptioneffect.EncryptionEffectController;
    thumbs: component.thumbs.ThumbsController;
    loading: component.loading.LoadingController;
    editing: {[id: string]: {text: string, date: number, deleted: boolean}};
    isSectionSet: boolean = false;
    takeCollectionSeq: number;
    isActive: boolean = true;
    previousSearchState: SearchState = null;
    tasksPlugin: any;
    creatingUserGroupLock: boolean = false;
    sendingFileLocksManager: SendingFileLocksManager;
    lastEditableSinkEntry: mail.SinkIndexEntry = null;
    lastMessageIndex: number;
    pastingInProgress: boolean = false;
    nonExistantFilesMessagesRefreshTimer: any;
    entriesWithNonExistantFiles: SinkIndexEntry[] = [];
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    msgIsTldr: { [msgNum: string]: boolean } = {};
    msgIsExpanded: { [msgNum: string]: boolean } = {};
    quoteIsExpanded: { [msgNum: string]: { [quoteId: string]: boolean } } = {};
    imgDidsToProcess: string[] = [];
    sectionTreeCollectionChangedBound: () => void;
    sectionTree: mail.filetree.nt.Tree = null;
    sendingQueue: SendingQueue;
    scrollToBottomOnLoadImages: boolean = false;
    distancesFromClosestMatch: number[] = [];
    // showContextForSinkIndexEntryIds: number[] = [];
    fileMessagesByDid: { [did: string]: mail.SinkIndexEntry } = {};

    session: mail.session.Session;
    sectionManager: SectionManager;

    constructor(parent: window.base.BaseWindowController, public personsComponent: component.persons.PersonsController) {
        super(parent);
        this.ipcMode = true;
        this.editing = {};
        this.chatPlugin = this.app.getComponent("chat-plugin");

        // this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        // this.personsComponent = parent.personsComponent;
        this.messagesMarkerQueueEx = new MessagesMarkerQueueEx(new MessagesMarkerQueue(this.messageFlagsUpdater, this.logErrorCallback), this);
        this.messagesMarkerQueueEx.reset();
        this.proxyCollection = this.addComponent("proxyCollection", new utils.collection.FilteredCollection<mail.SinkIndexEntry>(null, (entry) => {
            return this.chatPlugin.filterMessagesForDisplay(entry);
        }));
        this.messagesCollection = this.addComponent("chatMessageCollection", new utils.collection.SortedCollection<mail.SinkIndexEntry>(this.proxyCollection, (a, b) => {
            return a.source.serverDate - b.source.serverDate;
        }));
        this.messagesCollection.changeEvent.add(event => {
            Q().then(() => {
                if (this.isFilterEnabled()) {
                    this.refreshMatches(false);
                }
                else {
                    this.refreshMatches(true);
                }
            })
        });

        this.messagesFilterUpdater = new MessagesFilterUpdater();
        this.sendingFileLocksManager = new SendingFileLocksManager();

        this.filteredCollection = this.addComponent("filteredChatMessagesCollection", new utils.collection.FilteredCollection<mail.SinkIndexEntry>(this.messagesCollection, (entry) => {
            return this.distancesFromClosestMatch[entry.id] < Number.POSITIVE_INFINITY || !(entry.id in this.distancesFromClosestMatch);
            // let meets = ChatMessagesController.meetsFilter(entry, this.messagesFilterUpdater.filter.value);
            // return meets;
        }, ));
        this.takeCollection = this.addComponent("takeCollection", new utils.collection.FilteredCollection<mail.SinkIndexEntry>(this.filteredCollection, x => {
            return x.id > this.takeCollectionSeq;
        }));

        this.messagesFilterUpdater.restoreSeq = (origSeq: number) => {
            this.takeCollectionSeq = origSeq;
            this.messagesFilterUpdater.resetSeq();

            this.proxyCollection.rebuild();
            // this.takeCollection.rebuild();

            if (this.takeCollectionSeq != 0) {
                this.callViewMethod("setAllMessagesRendered", false);
            }
            if (this.thumbs) {
                this.thumbs.processThumbs();
            }
        }

        this.messagesFilterUpdater.onUpdate = () => {
            if (!this.isActive) {
                return false;
            }
            this.refreshMatches();

            this.callViewMethod("updateMessagesFiltered", this.isFilterEnabled());
            this.updateSearchState();
            return true;
        };
        
        let messagesTransform = this.addComponent("chatMessagesTransform", new utils.collection.TransformCollection<InnerMessageModel, mail.SinkIndexEntry>(this.takeCollection, (entry) => {
            let conv = this.convertSinkIndex(entry);
            return conv;
        }));
        this.transformCollection = messagesTransform;
        this.messages = this.addComponent("chatMessages", this.componentFactory.createComponent("extlist", [this, messagesTransform]));

        this.messages.ipcMode = true;
        this.registerChangeEvent(this.messagesCollection.changeEvent, this.onMessageChange.bind(this), "multi");
        this.registerChangeEvent(this.app.searchModel.changeEvent, this.onFilterMessages, "multi");
        this.registerChangeEvent(this.personService.persons.changeEvent, this.onPersonChange.bind(this));

        this.registerChangeEvent(this.messages.collection.changeEvent, this.onMessagesChange.bind(this), "multi");
        this.app.addEventListener<Types.event.UserDeletedEvent>("user-deleted", event => {
            this.callViewMethod("updateCanWrite", this.canWrite());
        });

        this.messagesCollection.changeEvent.add(this.onSingleMessageChange.bind(this));
        
        this.sendingQueue = new SendingQueue(this.sendQueuedTextMessage.bind(this), this.messages.freeze.bind(this), this.messages.unfreeze.bind(this));

        this.sendingId = 0;
        this.sendMessages = [];
        this.unreadMarkers = [];
        this.loadingMoreMessages = null;
        this.emojiPicker = this.addComponent("emojiPicker", this.componentFactory.createComponent("emojipicker", <any>[this, {app: this.app}]));
        this.emojiViewBar = this.addComponent("emojiViewBar", this.componentFactory.createComponent("emojiviewbar", [this]));
        this.emojiPicker.setOnIconSelectedListener(((id, parentId) => {
            let section = this.getSection();
            if (section == null) {
                return;
            }
            let splitted = parentId.split("/");
            section.setStickersAtChatMessage(parseInt(splitted[1]), [id], true).fail(this.errorCallback);
        }));
        this.bindEvent<ChatValidMessageTypeForDisplayChangeEvent>(this.app, "chatvalidmessagetypefordisplaychange", () => {
            this.proxyCollection.refresh();
            this.loadUntilFillTakeCollection().then(() => {
                this.refreshMatches();
                this.updateSearchState();
            });
        });


        let tasksPlugin = this.app.getComponent("tasks-plugin");
        this.tasksPlugin = tasksPlugin;
        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            return tasksPlugin ? tasksPlugin.getTaskTooltipContent(this.session, taskId) : null;
        };

        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.encryptionEffect = this.addComponent("encryptionEffect", this.componentFactory.createComponent("encryptioneffect", [this]));
        this.thumbs = this.addComponent("thumbs", this.componentFactory.createComponent("thumbs", [this, this.app, {
            missingThumbAction: component.thumbs.MissingThumbAction.USE_ORIGINAL_IMAGE,
        }]));
        this.loading = this.addComponent("loading", this.componentFactory.createComponent("loading", [this]));
        this.app.addEventListener<Types.event.FileRenamedEvent>("fileRenamed", event => {
            if (event.isLocal) {
                return;
            }
            let hostHash = event.hostHash || this.app.sessionManager.getLocalSession().hostHash;
            if (hostHash != this.session.hostHash) {
                return;
            }
            this.proxyCollection.forEach(msg => {
                if (msg && msg.source && msg.source.data && msg.source.data.type == "chat-message" && msg.source.data.contentType == "application/json") {
                    let obj = JSON.parse(msg.source.data.text);
                    if (obj && obj.type == "create-file" && obj.did == event.did) {
                        let section = this.getSection();
                        if (section) {
                            section.getFileTree().then(tree => {
                                return tree.refreshDeep(true);
                            })
                            .then(() => {
                                this.proxyCollection.triggerUpdateElement(msg);
                            })
                        }
                    }
                }
            });
        //     if (!this.openableElement) {
        //         return;
        //     }
        //     let newFullFileName: string = null;
        //     if (event.isLocal) {
        //         if (this.app.isElectronApp() && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
        //             if (event.oldPath == this.openableElement.getElementId() || (this.updatedFullFileName && event.oldPath == this.updatedFullFileName)) {
        //                 newFullFileName = event.newPath;
        //             }
        //         }
        //     }
        //     else {
        //         if (this.openableElement instanceof mail.section.OpenableSectionFile && (this.openableElement.path == event.oldPath || (this.updatedFullFileName && event.oldPath == this.updatedFullFileName))) {
        //             newFullFileName = event.newPath;
        //         }
        //     }
        //     if (newFullFileName) {
        //         let newFileName: string = newFullFileName.substr(newFullFileName.lastIndexOf("/") + 1);
        //         this.updateFileName(newFileName, newFullFileName, this.getTitle(newFullFileName));
        //     }
        });
        this.app.addEventListener<Types.event.JoinedVoiceChatTalkingEvent>("joinedVoiceChat", event => {
            if (event.sectionId == this.getSection().getId()) {
                this.toggleIsVoiceChatActiveInThisSection(false);
                this.toggleIsInVoiceChatInThisSection(true);
                this.toggleIsTalkingInThisSection(true);
                this.toggleRingTheBellAvailable(true);
            }
            else {
                this.toggleIsInVoiceChatInAnotherSection(true);
                this.toggleIsTalkingInAnotherSection(true);
            }
        });
        this.app.addEventListener<Types.event.LeftVoiceChatTalkingEvent>("leftVoiceChat", event => {
            if (event.sectionId == this.getSection().getId()) {
                this.toggleIsInVoiceChatInThisSection(false);
                this.toggleIsVoiceChatActiveInThisSection(this.app.voiceChatService.isVoiceChatActive(this.session, event.sectionId))
                this.toggleIsTalkingInThisSection(false);
                this.toggleRingTheBellAvailable(false);
            }
            else {
                this.toggleIsInVoiceChatInAnotherSection(false);
                this.toggleIsTalkingInAnotherSection(false);
            }
        });
        this.app.addEventListener<Types.event.StartedTalkingEvent>("startedTalking", event => {
            if (event.sectionId == this.getSection().getId()) {
                this.toggleIsTalkingInThisSection(true);
            }
            else {
                this.toggleIsTalkingInAnotherSection(true);
            }
        });
        this.app.addEventListener<Types.event.StoppedTalkingEvent>("stoppedTalking", event => {
            if (event.sectionId == this.getSection().getId()) {
                this.toggleIsTalkingInThisSection(false);
            }
            else {
                this.toggleIsTalkingInAnotherSection(false);
            }
        });
        this.app.addEventListener("file-attached-to-task", (event: any) => {
            this.refreshFileMessagesByDid(event.did);
        });
        this.app.addEventListener("file-detached-from-task", (event: any) => {
            this.refreshFileMessagesByDid(event.did);
        });
    }

    onPersonChange(person: mail.person.Person): void {
        this.callViewMethod("renderHeader", this.getModel());
    }
    
    setConversationFilesChangeListener(): void {
        let section = this.getSection();
        this.filesMessagesProxyCollection = this.addComponent("filesMessagesCollection", new utils.collection.ProxyCollection<SinkIndexEntry>(section.getChatModule().filesMessagesCollection));
        this.filesMessagesProxyCollection.changeEvent.add(this.onFilesMessagesChange.bind(this));
    }

    onSectionChange(): void {
        this.callViewMethod("renderHeader", this.getModel());
    }

    init() {
        this.horizontalSplitter = this.addComponent("horizontalSplitter", this.componentFactory.createComponent("splitter", [this, this.parent.settings.create("chat-splitter-horizontal")]));
        this.enterSends = this.parent.settings.create("enter-sends");
        this.registerChangeEvent(this.enterSends.changeEvent, this.onEnterSendsChange);
    }

    setSection(section: mail.section.SectionService): Q.Promise<boolean> {
        if (!section.isChatModuleEnabled()) {
            this.isSectionSet = false;
            return Q(false);
        }
        return section.getChatSinkIndex().then(() => {
            if (section.isUserGroup()) {
                let conversation = this.conv2Service.collection.find(x => x.section == section);
                this.setChatData({
                    type: ChatType.CONVERSATION,
                    section: null,
                    conversation: conversation
                }, section.getChatModule().sinkIndex.entries);
            }
            else {
                this.setSectionData(section);
            }
            return true;
        });
    }

    setSectionData(section: mail.section.SectionService) {
        if (!section) {
            return;
        }
        this.app.addEventListener("reopen-section", (event: component.disabledsection.ReopenSectionEvent) => {
            if (event.element && event.element.getId() == section.getId()) {
                this.callViewMethod("updateEnabledModules", { notes2: section.isFileModuleEnabled(), tasks: section.isKvdbModuleEnabled() });
                this.onSectionChange();
            }
        }, "chat");
        this.sectionManager.sectionAccessManager.eventDispatcher.addEventListener<Types.event.SectionStateChangedEvent>("section-state-changed", event => {
            if (section.getId() == event.sectionId) {
                Q().then(() => {
                    return this.sectionManager.load();
                })
                    .then(() => {
                        let section = this.sectionManager.getSection(event.sectionId);
                        this.callViewMethod("updateEnabledModules", { notes2: section.isFileModuleEnabled(), tasks: section.isKvdbModuleEnabled() });
                    })
            }
        }, "chat");
        this.filesMessagesProxyCollection = this.addComponent("filesMessagesCollection", new utils.collection.ProxyCollection<SinkIndexEntry>(section.getChatModule().filesMessagesCollection));
        this.filesMessagesProxyCollection.changeEvent.add(this.onFilesMessagesChange.bind(this));
        this.setChatData({
            type: ChatType.CHANNEL,
            section: section,
            conversation: null
        }, section.getChatModule().sinkIndex.entries);
    }
    
    onFilesMessagesChange(event: Types.utils.collection.CollectionEvent<mail.SinkIndexEntry>): void {
        if ((event.type == "update" || event.type == "add") && event.element) {
            let content = event.element.getContentAsJson();
            if (content && (content.type == "delete-file" || content.type == "delete-directory" || content.type == "delete-directory-permanent")) {
                this.disableFileLinksForNonExistantFiles();
            }
        }
    }

    disableFileLinksForNonExistantFiles(): void {
        if (!this.filesMessagesProxyCollection) {
            return;
        }
        if (this.nonExistantFilesMessagesRefreshTimer != null) {
            clearTimeout(this.nonExistantFilesMessagesRefreshTimer);
        }
        this.nonExistantFilesMessagesRefreshTimer = setTimeout(() => {
            Q().then(() => {
                return this.getEntriesWithNonExistantFilesDids(this.filesMessagesProxyCollection, this.getSection());
            })
            .then(list => {
                this.entriesWithNonExistantFiles = list;
                list.forEach(entry => {
                    this.triggerUpdateNonExistantFileMessage(entry.id)
                });
            });
        }, 500);
    }

    waitPromise(ms: number): Q.Promise<void> {
        return Q.Promise<void>(resolve => {
            setTimeout(() => resolve(), ms);
        })
    }

    getEntriesWithNonExistantFilesDids(collection: utils.collection.BaseCollection<SinkIndexEntry>, section: mail.section.SectionService): Q.Promise<SinkIndexEntry[]> {
        return Q().then(() => {
            let messagesDids: string[] = [];
            let availFilesDids: string[] = [];
            let nonExistant: string[] = [];
            collection.forEach(msgEntry => {
                let data = msgEntry.getContentAsJson();
                if (data.did && data.did.length > 0) {
                    utils.Lang.uniqueAdd(messagesDids, data.did);
                }
            });
            return this.waitPromise(1000)
            .then(() => {
                return section.getFileTree().then(t => {
                    return t.refreshDeep(true).thenResolve(t);
                })
                .then(tree => {
                    availFilesDids = tree.collection.list.filter(f => f.path.indexOf("/.trash/") == -1).map(fileEntry => fileEntry.ref.did);
                    nonExistant = messagesDids.filter(msgDid => availFilesDids.indexOf(msgDid) == -1);
                    return collection.list.filter(entry => {
                        let data = entry.getContentAsJson();
                        return data && data.did && nonExistant.indexOf(data.did) > -1;
                    });
                })
            })
        })
    }


    setChatData(chatInfo: ChatInfo, collection: utils.collection.BaseCollection<mail.SinkIndexEntry>) {
        this.chatInfo = chatInfo;
        let section = this.getSection();
        if (section && section.getChatModule() && section.getChatModule().sinkIndex) {
            this.takeCollectionSeq = Math.max(0, section.getChatModule().sinkIndex.cursor.seq - ChatMessagesController.MESSAGES_TO_LOAD);
        }
        else {
            this.takeCollectionSeq = 0;
        }
        Q().then(() => { this.proxyCollection.setCollection(collection) });
        this.isSectionSet = true;
        this.processUnreadMarkers();
        this.loadUntilFillTakeCollection();
        this.messagesFilterUpdater.updateFilter(this.app.searchModel.get(), true);
        this.disableFileLinksForNonExistantFiles();
    }

    getModel(): Model {
        if (!this.isSectionSet) {
            return null;
        }
        let active = this.getSection();
        let hasNotes2 = false;
        let hasTasks = false;
        if (this.chatInfo.type == ChatType.CONVERSATION) {
            hasNotes2 = true;
            hasTasks = this.chatInfo.conversation.isSingleContact();
        }
        else {
            hasNotes2 = active && this.chatPlugin.isNotes2PluginPresent() && active.isFileModuleEnabled();
            hasTasks = active && this.chatPlugin.isTasksPluginPresent() && active.isKvdbModuleEnabled();
        }

        return {
            maxMsgTextSize: ChatMessagesController.MAX_MSG_TEXT_SIZE,
            enterSends: this.enterSends.get("boolean"),
            chatType: this.chatInfo.type,
            hasUnread: this.thereAreUnreadMessages(),
            messagesCount: this.getCollectionSize(),
            persons: this.chatInfo.type == ChatType.CONVERSATION ? this.chatInfo.conversation.persons.map(x => ChatPlugin.getPersonModel(x, this.session)) : [],
            channel: this.chatInfo.type == ChatType.CHANNEL ? {
                id: this.chatInfo.section.getId(),
                name: this.chatInfo.section.getName(),
                scope: this.chatInfo.section.getScope(),
                breadcrumb: ""
            } : null,
            hasNotes2: hasNotes2,
            hasTasks: hasTasks,
            unreadMarkers: this.unreadMarkers,
            customStyle: this.app.loadCustomizationAsset("chat-plugin/style.css"),
            customTemplate: this.app.loadCustomizationAsset("chat-plugin/channel-message.html"),
            guiSettings: this.chatPlugin.getGUISettings(),
            hostHash: this.session.hostHash,
            sectionId: this.chatInfo.type == ChatType.CHANNEL ? this.chatInfo.section.getId() : this.chatInfo.conversation.id,
            canWrite: this.canWrite(),
            isRemote: this.session.sessionType == "remote",
            viewSettings: this.chatPlugin.getViewSettings(),
            usersWithAccess: this.chatInfo.type == ChatType.CHANNEL ? this.getUsersWithAccess().map(x => ChatPlugin.getPersonModel(x, this.session)) : [],
            platform: this.app.getPlatform(),
            contextSize: ChatMessagesController.SEARCH_CONTEXT_SIZE,
            isInVoiceChatInThisSection: this.isInVoiceChatInThisSection(),
            isVoiceChatActiveInThisSection: this.isVoiceChatActiveInThisSection(),
            isInVoiceChatInAnotherSection: this.isInVoiceChatInAnotherSection(),
            isTalkingInThisSection: this.isTalkingInThisSection(),
            isTalkingInAnotherSection: this.isTalkingInAnotherSection(),
            isRingTheBellAvailable: this.isRingTheBellAvailable(),
            isVoiceChatEnabled: (<any>this.app).serverConfigForUser.privmxStreamsEnabled
        };
    }
    
    isInVoiceChatInThisSection(): boolean {
        return this.app.voiceChatService.isInVoiceChat() && this.app.voiceChatService.getActiveSection().getId() == this.getSection().getId();
    }

    isVoiceChatActiveInThisSection(): boolean {
        let section = this.chatInfo.section ? this.chatInfo.section: null;
        let conv = this.chatInfo.conversation ? this.chatInfo.conversation: null;

        let ret = (<any>this.app.voiceChatService).isVoiceChatActive(this.session, section ? section.getId(): conv.id);
        return ret;
    }

    isInVoiceChatInAnotherSection(): boolean {
        return this.app.voiceChatService.isInVoiceChat() && this.app.voiceChatService.getActiveSection().getId() != this.getSection().getId();
    }
    
    isTalkingInThisSection(): boolean {
        return this.app.voiceChatService.isTalking() && this.app.voiceChatService.getActiveSection().getId() == this.getSection().getId();
    }

    isRingTheBellAvailable(): boolean {
        return this.isTalkingInThisSection();
    }

    isTalkingInAnotherSection(): boolean {
        return this.app.voiceChatService.isTalking() && this.app.voiceChatService.getActiveSection().getId() != this.getSection().getId();
    }

    getUsersWithAccess(): mail.person.Person[] {
        let section = this.getSection();
        if (!section) {
            return [];
        }
        let contactsWithAccess = section.getContactsWithAccess(true);
        if (!contactsWithAccess) {
            return [];
        }
        return contactsWithAccess
            .map(x => this.personService.getPerson(x.getHashmail()));
    }

    //===========================
    //       VIEW EVENTS
    //===========================

    onViewLoad() {
        this.refreshMatches();
        this.updateSearchState();
        this.callViewMethod("updateMessagesFiltered", this.isFilterEnabled());
        this.afterViewLoaded.resolve();
    }

    onViewOpenMail(id: number, sinkId: string): void {
        this.addTaskEx(this.i18n("plugin.chat.component.chatMessages.task.openMessage.text"), false, () => {
            let entry = this.getMessageEntryById(id, sinkId);
            this.app.openMessage(this.parent, entry);
        });
    }

    onViewOpenTask(id: string, scrollToComments: boolean): void {
        this.chatPlugin.openTask(this.session, null, id, scrollToComments);
    }

    onViewOpenNotes2() {
        let cnt = <window.container.ContainerWindowController>this.app.windows.container;
        if (this.chatInfo.type == ChatType.CHANNEL) {
            cnt.redirectToAppWindow("notes2", this.chatInfo.section.getId());
        }
        else {
            cnt.redirectToAppWindow("notes2", this.chatInfo.conversation.id);
        }
    }

    onViewOpenTasks() {
        let cnt = <window.container.ContainerWindowController>this.app.windows.container;
        if (this.chatInfo.type == ChatType.CHANNEL) {
            cnt.redirectToAppWindow("tasks", this.chatInfo.section.getId());
        }
        else if (this.chatInfo.type == ChatType.CONVERSATION) {
            cnt.redirectToAppWindow("tasks", this.chatInfo.conversation.id);
        }
    }

    onViewNewFiles(): void {
        let notes2Plugin = this.app.getComponent("notes2-plugin");
        if (!notes2Plugin) {
            return null;
        }

        if (this.isConversationWithDeletedUserOnly()) {
            return;
        }

        (<any>notes2Plugin).openFileChooser(this.parent, this.session, null, "messageslist-" + this.getId()).then((result: app.common.shelltypes.OpenableElement[]) => {
            result.forEach(element => {
                this.sendMessage({ attachments: [element.content] });
            })
        });
    }

    onViewNewTask(): void {
        let section = this.getSection();
        let tasksModule = section.getKvdbModule();
        let tasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksModule || !tasksPlugin) {
            return null;
        }
        (<any>tasksPlugin).openNewTaskWindow(this.session, section);
    }

    onViewDeleteMessage(originalMessageId: number) {
        this.parent.confirm(this.i18n("plugin.chat.component.chatMessages.deleteMessageQuestion")).then(result => {
            if (result.result == "yes") {
                this.deleteMessage(originalMessageId);
            }
        });
    }

    onViewStartEditMessage(originalMessageId: number) {
        let sinkEntry = this.filteredCollection.find(x => x.id == originalMessageId);
        if (sinkEntry == null) {
            return;
        }
        this.callViewMethod("enterEditMode", originalMessageId, sinkEntry.getMessage().text);
    }

    onViewStartEditLastMessage() {
        let sinkEntry = this.getLastEditableMessageSinkEntry();
        if (sinkEntry) {
            let message = sinkEntry.getMessage();
            this.callViewMethod("enterEditMode", sinkEntry.id, message.text);
        }
    }

    getLastEditableMessageSinkEntry(): mail.SinkIndexEntry {
        let list = this.filteredCollection.list;
        for (let i = list.length - 1; i >= 0; i--) {
            let sinkEntry = list[i];
            let message = sinkEntry.getMessage();
            if (message.sender.hashmail == this.identity.hashmail && message.contentType != "application/json") {
                if (!message.deleted) {
                    return sinkEntry;
                }
            }
        }
        return null;
    }

    isLastEditableMessageSinkEntry(sinkEntry: mail.SinkIndexEntry): boolean {
        let lastSinkEntry = this.getLastEditableMessageSinkEntry();
        if (!lastSinkEntry) {
            return false;
        }
        return lastSinkEntry.id == sinkEntry.id;
    }

    onViewSendMessage(text: string): void {
        this.encryptionEffect.customShowForChat(text);
        this.sendingQueue.add(text);
    }

    onViewEditMessage(originalMessageId: number, text: string): void {
        this.editMessage(originalMessageId, text);
    }

    actionOpenableElement(element: app.common.shelltypes.OpenableElement) {
        let resolvedApp = this.app.shellRegistry.resolveApplicationByElement({ element: element, session: this.session });
        if (resolvedApp.id == "core.unsupported") {
            this.app.shellRegistry.shellOpen({
                action: app.common.shelltypes.ShellOpenAction.DOWNLOAD,
                element: element,
                session: this.session,
            });
            return;
        }
        if (resolvedApp.id == "plugin.editor") {
            this.app.shellRegistry.shellOpen({
                element: element,
                action: app.common.shelltypes.ShellOpenAction.PREVIEW,
                session: this.session,
            });
            return;
        }
        this.app.shellRegistry.shellOpen({
            element: element,
            action: app.common.shelltypes.ShellOpenAction.PREVIEW,
            session: this.session
        });
    }

    onViewOpenAttachment(id: number, sinkId: string, attachmentIndex: number): void {
        if (this.networkIsDown()) {
            this.parent.showOfflineError();
            return;
        }
        let entry = this.getMessageEntryById(id, sinkId);
        if (entry != null) {
            let element = app.common.shelltypes.OpenableAttachment.create(entry.getMessage().attachments[attachmentIndex], true, true);
            this.actionOpenableElement(element);
        }
    }

    getSectionFileByDid(section: mail.section.SectionService, did: string): Q.Promise<mail.section.OpenableSectionFile> {
        return Q().then(() => {
            return section.getFileTree();
        })
            .then(tree => {
                if (tree.collection.list.filter(x => x.ref.did == did).length == 0) {
                    throw "File doesn't exist";
                }
                return tree.getPathFromDescriptor(did);
            })
            .then(path => {
                if (path.indexOf("/.trash/") >= 0) {
                    throw "File doesn't exist";
                }
                return section.getFileOpenableElement(path, false)
            })
    }

    isFileExistsByDid(did: string, section: mail.section.SectionService): Q.Promise<boolean> {
        return Q().then(() => {
            return section.getFileTree();
        })
        .then(fTree => {
            return fTree.refreshDeep(true).thenResolve(fTree)
        })
        .then(tree => {
            if (tree.collection.list.filter(x => x.ref.did == did).length == 0) {
                return false;
            }
            return true;
        })
    }

    onViewOpenChannelFile(path: string, did: string) {
        let section = this.getSection();
        if (section == null || !section.hasFileModule()) {
            return;
        }
        Q().then(() => {
            return did.length > 0 ? this.getSectionFileByDid(section, did) : section.getFileOpenableElement(path, true);
        })
            .then(element => {
                this.actionOpenableElement(element);
            })
            .fail(e => {
                if (privfs.exception.PrivFsException.is(e, "FILE_DOES_NOT_EXIST") ||
                    privfs.exception.PrivFsException.is(e, "DIRECTORY_DOES_NOT_EXIST") ||
                    privfs.exception.PrivFsException.is(e, "ELEMENT_IS_NOT_DIRECTORY")) {
                    this.parent.alert(this.i18n("plugin.chat.component.chatMessages.info.fileDoesNotExist"));
                    return;
                }
                if (privfs.exception.PrivFsException.is(e, "ELEMENT_IS_NOT_FILE")) {
                    this.parent.alert(this.i18n("plugin.chat.component.chatMessages.info.fileInvalidType"));
                    return;
                }
                this.errorCallback(e);
            });
    }

    onViewSetEnterSends(checked: boolean): void {
        this.enterSends.set(checked, this);
    }

    onViewUserAction(): void {
        if (this.app.userPreferences.getAutoMarkAsRead()) {
            this.messagesMarkerQueueEx.onUserAction();
        }
    }

    onViewShowMessageTextTooLarge(): void {
        this.parent.alert(this.i18n("plugin.chat.component.chatMessages.info.messageTextTooLarge", ChatMessagesController.MAX_MSG_TEXT_SIZE))
            .then(() => {
                this.callViewMethod("focusReplyField");
            });
    }

    onViewLoadMoreMessages(): void {
        if (this.isFilterEnabled()) {
            this.callViewMethod("hideLoading");
            return;
        }
        this.loadMoreMessages();
    }

    onViewSearchHistoricalData(): void {
        let notificationId = this.notifications.showNotification(this.i18n("plugin.chat.component.chatMessages.notification.searching"), { autoHide: false, progress: true });
        this.loadHistoricalSearchResults(ChatMessagesController.MIN_SEARCH_RESULTS_TO_LOAD).then(() => {
            this.updateSearchState();
        })
            .fin(() => {
                this.callViewMethod("enableSearchHistoricalDataButton");
                this.notifications.hideNotification(notificationId);
            });
    }

    onViewAddPerson(): void {
        if (this.isConversationWithDeletedUserOnly()) {
            return;
        }
        let hashmails: string[] = this.chatInfo.conversation.persons.map(p => p.hashmail);
        this.app.dispatchEvent<RequestOpenChatEvent>({
            type: "requestopenchat",
            showContactsWindow: true,
            hashmails: hashmails,
        });
    }

    onViewRemovePerson(hashmail: string): void {
        let hashmails: string[] = this.chatInfo.conversation.persons.map(p => p.hashmail).filter(h => h != hashmail);
        this.app.dispatchEvent<RequestOpenChatEvent>({
            type: "requestopenchat",
            hashmails: hashmails,
        });
    }

    isFilterEnabled() {
        return this.messagesFilterUpdater.filter.visible && this.messagesFilterUpdater.filter.value && this.messagesFilterUpdater.filter.value.length >= 2;
    }

    loadMoreMessages(allowFilter: boolean = false): Q.Promise<void> {
        let fullyLoaded = this.isFullyLoaded();
        if (fullyLoaded == null || (!allowFilter && this.isFilterEnabled())) {
            this.callViewMethod("setAllMessagesRendered", true);
            return;
        }
        if (this.takeCollectionSeq == 0) {
            this.callViewMethod("setAllMessagesRendered", true);
        }
        if (fullyLoaded) {
            this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController.MESSAGES_TO_LOAD);
            this.takeCollection.refresh();
        }
        else {
            if (this.loadingMoreMessages == null) {
                this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController.MESSAGES_TO_LOAD);
                return this.singleLoadMoreMessages(this.takeCollectionSeq, allowFilter).then(() => {
                    this.takeCollection.refresh();
                });
            }
        }
        return Q();
    }

    singleLoadMoreMessages(seq: number, allowFilter: boolean = false): Q.Promise<void> {
        if (!allowFilter && this.isFilterEnabled()) {
            return Q();
        }
        if (this.loadingMoreMessages) {
            return this.loadingMoreMessages;
        }
        this.callViewMethod("showMessagesLoading");
        return this.loadingMoreMessages = Q().then(() => {
            let sinkIndex = this.getSection().getChatModule().sinkIndex;
            return sinkIndex.loadLastMessages(sinkIndex.baseEntries.list.length - seq);
        })
            .fail(this.errorCallback)
            .fin(() => {
                this.callViewMethod("hideMessagesLoading");
                this.loadingMoreMessages = null;
            });
    }

    loadUntilFillTakeCollection(): Q.Promise<void> {
        if (this.isFilterEnabled()) {
            return Q();
        }
        let fullyLoaded = this.isFullyLoaded();
        if (fullyLoaded || fullyLoaded == null || this.takeCollectionSeq == 0) {
            return Q();
        }
        if (this.takeCollection.size() < ChatMessagesController.MESSAGES_TO_LOAD) {
            this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController.MESSAGES_TO_LOAD);
            if (this.takeCollectionSeq == 0) {
                return Q();
            }
            return this.singleLoadMoreMessages(this.takeCollectionSeq).then(() => {
                return this.loadUntilFillTakeCollection();
            });
        }
        return Q();
    }

    loadHistoricalSearchResults(nExtra: number): Q.Promise<void> {
        if (nExtra <= 0) {
            return Q();
        }
        if (!this.isFilterEnabled()) {
            return Q();
        }
        this.messagesFilterUpdater.keepSeq(this.takeCollectionSeq);

        let cachedSeq = this.getCachedSeq();
        if (cachedSeq < this.takeCollectionSeq) {
            this.takeNMatching(ChatMessagesController.MIN_SEARCH_RESULTS_TO_LOAD);
            return Q();
        }

        let fullyLoaded = this.isFullyLoaded();
        if (fullyLoaded || fullyLoaded == null || this.takeCollectionSeq == 0) {
            if (this.takeCollectionSeq > 0) {
                this.takeNMatching(ChatMessagesController.MIN_SEARCH_RESULTS_TO_LOAD);
            }
            return Q();
        }
        if (this.takeCollectionSeq == 0) {
            return Q();
        }
        this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController.MESSAGES_TO_LOAD);
        let count0 = this.takeCollection.list.length;
        return this.singleLoadMoreMessages(this.takeCollectionSeq, true).then(() => {
            let count1 = this.takeCollection.list.length;
            nExtra -= count1 - count0;
            return this.loadHistoricalSearchResults(nExtra);
        });
    }

    getCachedSeq(): number {
        let section = this.getSection();
        if (section == null || !section.hasChatModule() || section.getChatModule().sinkIndex == null) {
            return null;
        }
        let sinkIndex = section.getChatModule().sinkIndex;
        let seqCached = sinkIndex.entries.collection.list.length - sinkIndex.entries.list.length;
        return seqCached;
    }

    isFullyLoaded(): boolean {
        let section = this.getSection();
        if (section == null || !section.hasChatModule() || section.getChatModule().sinkIndex == null) {
            return null;
        }
        let sinkIndex = section.getChatModule().sinkIndex;
        return sinkIndex.entries.list.length == sinkIndex.entries.collection.list.length;
    }

    takeNMatching(nExtra: number): void {
        let n = this.takeCollection.list.length + nExtra;
        while (this.takeCollectionSeq > 0 && this.takeCollection.list.length < n) {
            this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController.MESSAGES_TO_LOAD);
        }
        this.takeCollection.refresh();
    }

    onViewRenderAttachmentImage(sinkId: string, id: number, attachmentIndex: number): void {
        if (this.networkIsDown()) {
            return;
        }
        let entry = this.getMessageEntryById(id, sinkId);
        if (entry == null) {
            return;
        }
        let attachment = entry.getMessage().attachments[attachmentIndex];
        if (attachment == null || attachment.getMimeType().indexOf("image/") != 0) {
            return;
        }
        Q().then(() => {
            return attachment.getContent();
        })
            .progress(progress => {
                this.callViewMethod("setImageProgress", sinkId, id, attachmentIndex, progress);
            })
            .then(content => {
                let data: Types.app.BlobData = {
                    mimetype: content.getMimeType(),
                    buffer: content.getBuffer()
                };
                this.callViewMethod("setImageData", sinkId, id, attachmentIndex, data);
            })
            .fail(this.errorCallback);
    }

    onFilterMessages() {
        this.messagesFilterUpdater.updateFilter(this.app.searchModel.get());
    }

    //===========================
    //    COLLECTION EVENTS
    //===========================
    
    onMessageChange(event: Types.utils.collection.CollectionEvent<mail.SinkIndexEntry>) {
        this.processUnreadMarkers();
    }

    onSingleMessageChange(event: Types.utils.collection.CollectionEvent<mail.SinkIndexEntry>) {
        // processes new messages and removes sendingMessages when new message arrive from polling
        if(event && event.type == "add" && event.element) {
            let msgId = event.element.message ? event.element.message.msgId : event.element.source.data.msgId;
            let sinkId = event.element.message ? event.element.message.sink.id : event.element.sink.id;
            let serverId = event.element.message && event.element.message.serverId ? event.element.message.serverId : event.element.source.serverId;
            this.callViewMethod("removeSendingMessageIfRealMessageExists", msgId, sinkId + "/" + serverId);
            //this.callViewMethod("removeSendingMessage", msgId, null, null);
        }
    }
    
    onMessagesChange(event?: Types.utils.collection.CollectionEvent<InnerMessageModel>) {
        // if (!event || (event && this.lastMessageIndex != event.index)) {
        //     if (event) {
        //         this.lastMessageIndex = event.index;
        //     }
        //     this.processUnreadMarkers();
        // }
    }

    processUnreadMarkers(): void {
        let unread = this.messagesCollection.findAll(ChatMessagesController.isUnread);
        if (unread.length > 0) {
            if (unread.length >= 5) {
                let beg = unread[0].id;
                let end = unread[unread.length - 1].id;
                let marker = utils.Lang.find(this.unreadMarkers, x => x.beg == beg);
                if (marker == null) {
                    this.unreadMarkers.push({beg: beg, end: end});
                    this.unreadMarkers.sort((a, b) => a.beg - b.beg);
                    this.unreadMarkers = [this.unreadMarkers[this.unreadMarkers.length - 1]];
                    this.callViewMethod("setUnreadMarkers", this.unreadMarkers);
                }
                else {
                    marker.end = Math.max(marker.end, end);
                }
            }
        }
        this.callViewMethod("renderMessagesCount", this.getCollectionSize());
    }

    onEnterSendsChange(_type: string, _settings: utils.Settings, caller: any) {
        if (this != caller) {
            this.callViewMethod("setEnterSends", this.enterSends.get("boolean"));
        }
    }

    //===========================
    //          MISC
    //===========================

    getId(): string {
        if (this.chatInfo) {
            if (this.chatInfo.type == ChatType.CHANNEL) {
                return this.chatInfo.section.getId();
            }
            if (this.chatInfo.type == ChatType.CONVERSATION) {
                return this.chatInfo.conversation.id;
            }
        }
        return null;
    }

    getSection(): mail.section.SectionService {
        if (this.chatInfo.type == ChatType.CHANNEL) {
            return this.chatInfo.section;
        }
        if (this.chatInfo.type == ChatType.CONVERSATION) {
            return this.chatInfo.conversation.section;
        }
        return null;
    }

    getCollectionSize() {
        let sentCount = 0;
        let newList: number[] = [];
        this.sendMessages.forEach(x => {
            if (this.messagesCollection.find(y => y.source.serverId == x) != null) {
                return;
            }
            sentCount++;
            newList.push(x);
        });
        this.sendMessages = newList;
        let baseSize = this.messagesCollection.size();
        if (this.chatInfo.section) {
            let chatModule = this.chatInfo.section.getChatModule();
            if (chatModule && chatModule.sinkIndex) {
                baseSize = this.chatInfo.section.getChatModule().sinkIndex.getMessagesCount();
            }
        }
        else if (this.chatInfo.conversation && this.chatInfo.conversation.section) {
            let chatModule = this.chatInfo.conversation.section.getChatModule();
            if (chatModule && chatModule.sinkIndex) {
                baseSize = this.chatInfo.conversation.section.getChatModule().sinkIndex.getMessagesCount();
            }
        }
        return baseSize + sentCount;
    }

    getMessageEntryById(id: number, sinkId: string): mail.SinkIndexEntry {
        let index = this.sinkIndexManager.getIndexBySinkId(sinkId);
        return index ? index.getEntry(id) : null;
    }

    chatIsActive(): Q.Promise<boolean> {
        return this.retrieveFromView<boolean>("replyFieldHasFocus");
    }

    thereAreUnreadMessages(): boolean {
        return this.messagesCollection.find(ChatMessagesController.isUnread) != null;
    }

    getUnreadMessages(): mail.SinkIndexEntry[] {
        return this.messagesCollection.findAll(ChatMessagesController.isUnread);
    }

    focus(): void {
        this.callViewMethod("focus");
    }

    networkIsDown(): boolean {
        return this.parent.networkIsDown();
    }
    
    processMessageQuotes(text: string): string {
        let lines = text.split("<br>");
        for (let i = 0; i + 1 < lines.length; ++i) {
            if (lines[i][0] == "@" && lines[i][1] != "<" && (<any>lines[i + 1]).startsWith("&gt;")) {
                let uname = lines[i].substr(1).trim();
                let users = this.personService.persons.contactCollection.list.filter(x => x && x.user);
                let matchingUsers: mail.contact.Contact[] = [];
                users.filter(x => x.getHashmail() == uname).forEach(u => matchingUsers.push(u));
                users.filter(x => x.getHashmail().split("#")[0] == uname).forEach(u => matchingUsers.push(u));
                users.filter(x => x.getDisplayName() == uname).forEach(u => matchingUsers.push(u));
                
                let user: mail.contact.Contact = matchingUsers.filter(u => u && u.getHashmail() && u.getHashmail().indexOf("#") > 0)[0];
                if (user) {
                    let hashmail = user.getHashmail();
                    let username = user.getDisplayName();
                    lines[i] = `@<privmx-quote-header data-hashmail="${hashmail}">${username}</privmx-quote-header>`;
                }
            }
        }
        return lines.join("<br>");
    }
    
    trySendMessageWithDelay(...args: any[]): Q.Promise<void> {
        return Q().then(() => {
            let def = Q.defer<void>();
            setTimeout(() => {
                def.resolve();
            }, 5000);
            return def.promise;
        })
        .then(() => {
            return (<any>this.sendMessage)(...args);
        })
    }
    
    sendMessage(options: {text?: string, attachments?: privfs.lazyBuffer.IContent[]}, queueId?: number): Q.Promise<void> {
        let resendOnError: boolean = false;
        if (this.creatingUserGroupLock) {
            return this.trySendMessageWithDelay(options, queueId);
        }
        if (options.attachments && this.sendingFileLocksManager.isAnyLocked(options.attachments)) {
            options.attachments = this.sendingFileLocksManager.filterOutLocked(options.attachments);
            return options.attachments.length > 0 ? this.trySendMessageWithDelay(options, queueId) : Q();
        }
        if (this.networkIsDown()) {
            this.parent.showOfflineError();
            return Q();
        }
        let section = this.getSection();

        if (this.isConversationWithDeletedUserOnly()) {
            return Q();
        }
        
        if (options && options.text) {
            options.text = this.processMessageQuotes(options.text);
        }
        if (section == null && this.chatInfo.type == ChatType.CONVERSATION && !this.creatingUserGroupLock) {
            this.creatingUserGroupLock = true;
            let notificationId = this.notifications.showNotification(this.i18n("plugin.chat.component.chatMessages.notification.sending-message"), { autoHide: false, progress: true });
            return Q().then(() => {
                return this.conv2Service.createUserGroup(this.chatInfo.conversation.users);
            })
            .then(() => {
                this.disableFileLinksForNonExistantFiles();
                if (this.isActive) {
                    this.chatPlugin.activeSinkId = this.chatInfo.conversation.sinkIndex ? this.chatInfo.conversation.sinkIndex.sink.id : null;
                    this.chatPlugin.activeSinkHostHash = this.session.hostHash;
                }
                this.creatingUserGroupLock = false;
                return this.sendMessage(options);
            })
            .fin(() => {
                this.notifications.hideNotification(notificationId);
                this.creatingUserGroupLock = false;
                return;
            });
        }
        if (section == null) {
            return;
        }
        let sendingId = ++this.sendingId;
        let refreshMessagesListOnRemoveMessage: boolean = false;
        let isFileAndFilesDisabled: boolean = false;
        let isChannelThroughFileModule = options.attachments && options.attachments.length == 1 && section.hasFileModule();
        let sendingMessage = isChannelThroughFileModule ?
            this.creatingChannelFileUploadSendingMessage(options.attachments[0], sendingId) :
            this.createSendingMessage(options.text || "", options.attachments || [], sendingId);
        // return this.addTaskEx(this.i18n("plugin.chat.component.chatMessages.task.sendMessage.text"), true, () => {
        if (isChannelThroughFileModule) {
            if (options.attachments) {
                this.sendingFileLocksManager.lockMany(options.attachments);
            }
        }
        return Q().then(() => {
            if (options && options.text) {
                return this.app.prepareHtmlMessageBeforeSending(options.text, this.session).then(newText => {
                    options.text = newText;
                });
            }
        }).then(() => {
            return Q().then(() => {
                if (isChannelThroughFileModule) {
                    this.callViewMethod("renderSendingMessage", sendingMessage);
                    this.callViewMethod("renderMessagesCount", this.getCollectionSize() + 1);
    
                    if (this.chatPlugin.validMessageJsonTypesForDisplay.indexOf("create-file") == -1) {
                        refreshMessagesListOnRemoveMessage = true;
                        isFileAndFilesDisabled = true;
                    }
                    return Q().then(() => {
                    //     let d = Q.defer();
                    //     setTimeout(() => {
                    //         d.resolve();
                    //     }, 5000);
                    //     return d.promise;
                    // })
                    // .then(() => {
                        return section.uploadFile({
                            data: options.attachments[0]
                        })
                    })
                    .then(res => {
                        let result = res.mailResult || res.mailWithFileInfoResult;
                        if (result == null || !result.success) {
                            return Q.reject(result ? result.couse : "Unknown result");
                        }
                        return { sinkId: result.receiver.sink.id, serverId: result.source.serverId };
                    });
                }
                return this.sectionManager.createMessage({
                    destination: section.getId(),
                    text: options.text,
                    attachments: options.attachments
                })
                .then(message => {
                    sendingMessage.msgId = "sending-" + message.msgId;
                    this.callViewMethod("renderSendingMessage", sendingMessage);
                    this.callViewMethod("renderMessagesCount", this.getCollectionSize() + 1);
    
                    if (!queueId) {
                        this.messages.freeze();
                    }
                    // return this.falsyMessageTest()
                    return Q.resolve()
                    .then(() => {
                    //     let d = Q.defer();
                    //     setTimeout(() => {
                    //         d.resolve();
                    //     }, 5000);
                    //     return d.promise;
                    // })
                    // .then(() => {
                        return this.sectionManager.sendPreparedMessage({
                            destination: section.getId(),
                            text: options.text,
                            attachments: options.attachments
                        }, message)
                    })
                })
            })
            .then((info: {sinkId: string, serverId: number}) => {
                this.callViewMethod("removeSendingMessageIfRealMessageExists", sendingId, info.sinkId + "/" + info.serverId);
        
                if (options.text) {
                    section.linkFileCreator.uploadLinkFilesFromText(options.text, this.errorCallback);
                }
            })
            .fail(e => {
                resendOnError = true;
                // this.callViewMethod("removeSendingMessage", sendingMessage.msgId.replace("sending-", ""), null, null);
                this.callViewMethod("removeSendingMessage2", sendingMessage.msgId);
                this.callViewMethod("renderMessagesCount", this.getCollectionSize());
                if (e instanceof PrivmxException.Exception && e.message == "invalid-receivers") {
                    resendOnError = false;
                    let msg = this.i18n("plugin.chat.component.chatMessages.task.sendMessage.error.invalidReceivers", [e.data.join(", ")]);
                    return this.onErrorCustom(msg, e);
                }
                else
                if (e && e.message && e.message == "send-msg-error") {
                    resendOnError = false; // that means this is not strictly send-message-error from server so we should resend.
                }
                // this.onError(e);
            })
            .fin(() => {

                if (! queueId) {
                    this.messages.unfreeze();
                }
                if (options.attachments) {
                    this.sendingFileLocksManager.unlockMany(options.attachments);
                }

                if (resendOnError && queueId) {
                    this.sendingQueue.resend(queueId);
                    return Q.reject<void>();
                }

            })
        });
    }
    
    falsyMessageTest(): Q.Promise<void> {
        return Q().then(() => {
            if (Math.random() > 0.7) {
                throw new Error("cannot-send-message-from-client");
            }
        })
    }

    triggerUpdateNonExistantFileMessage(messageId: number) {
        let sinkEntry = this.filteredCollection.find(x => x.id == messageId);
        let messagesEntryIndex = this.messages.collection.indexOfBy(x => x.msgNum == messageId);
        if (messagesEntryIndex == -1 || sinkEntry == null) {
            return;
        }

        this.messages.onCollectionChange({
            type: "update",
            changeId: 0,
            index: messagesEntryIndex,
            element: this.convertSinkIndex(sinkEntry)
        });
    }

    triggerUpdateMessage(messageId: number) {
        let sinkEntryIndex = this.filteredCollection.indexOfBy(x => x.id == messageId);
        if (sinkEntryIndex == -1) {
            return;
        }
        let sinkEntry = this.filteredCollection.get(sinkEntryIndex);
        this.messages.onCollectionChange({
            type: "update",
            changeId: 0,
            index: sinkEntryIndex,
            element: this.convertSinkIndex(sinkEntry)
        });
    }

    startEditingMessage(messageId: number, text: string, deleted: boolean) {
        this.editing[messageId] = {
            text: text,
            date: new Date().getTime(),
            deleted: deleted
        };
        this.triggerUpdateMessage(messageId);
    }

    finishEditingMessage(messageId: number) {
        delete this.editing[messageId];
        setTimeout(() => {
            this.triggerUpdateMessage(messageId);
        }, 100);
    }

    editMessageCore(originalMessageId: number, text: string, deleted: boolean): void {
        if (this.networkIsDown()) {
            this.parent.showOfflineError();
            return;
        }
        let section = this.getSection();
        if (section == null) {
            return;
        }
        this.addTaskEx(this.i18n("plugin.chat.component.chatMessages.task.sendMessage.text"), true, () => {
            this.startEditingMessage(originalMessageId, text, deleted);
            return Q().then(() => {
                if (!deleted && text) {
                    // return this.encryptionEffect.show(text, this.getEncryptedText.bind(this), "");
                    this.encryptionEffect.customShowForChat(text);
                }
            }).then(() => {
                if (text) {
                    return this.app.prepareHtmlMessageBeforeSending(text, this.session).then(newText => {
                        text = newText;
                    });
                }
            }).then(() => {
                return section.editMessage(originalMessageId, {
                    text: text,
                    attachments: [],
                    deleted: deleted
                });
            })
                .then(() => {
                    this.finishEditingMessage(originalMessageId);
                    if (text) {
                        section.linkFileCreator.uploadLinkFilesFromText(text, this.errorCallback);
                    }
                })
                .fail(e => {
                    this.finishEditingMessage(originalMessageId);
                    return this.onError(e);
                });
        });
    }

    editMessage(originalMessageId: number, text: string): void {
        return this.editMessageCore(originalMessageId, text, false);
    }

    deleteMessage(originalMessageId: number): void {
        return this.editMessageCore(originalMessageId, "", true);
    }
    
    //===========================
    //       CONVERTERS
    //===========================

    convertSinkIndex(model: mail.SinkIndexEntry): InnerMessageModel {
        let message = model.getMessage();
        let sender = this.personService.getPersonProxy(message.sender);
        let obj: any = null;
        let fileInfoIcon: string = null;
        let taskLabelClass: string = null;

        let newFilePaths: { [did: string]: string } = {};
        
        if (message.contentType == "application/json") {
            try {
                obj = model.getContentAsJson();
            }
            catch (e) {
                obj = { type: "error", text: message.text };
            }
            let mimeType = obj.path ? mail.filetree.MimeType.resolve2(obj.path, obj.mimeType) : obj.mimeType;
            fileInfoIcon = mimeType ? this.app.shellRegistry.resolveIcon(mimeType) : obj.icon;
            if (obj.type == "create-task" || obj.type == "remove-task" || obj.type == "modify-task" || obj.type == "task-comment") {
                let tasksPlugin = this.app.getComponent("tasks-plugin");
                if (tasksPlugin) {
                    taskLabelClass = tasksPlugin.getLabelClassFor(this.session, this.chatInfo.section.getId(), obj.status, obj.numOfStatuses);
                }
            }
            else if (obj.type == "create-file") {
                let did = obj.did;
                let section = this.getSection();
                let tree = section.getFileModule().fileTree;
                if (tree) {
                    let file = tree.collection.find(x => x.ref.did == did);
                    if (file) {
                        newFilePaths[did] = file.path;
                    }
                }
            }
        }
        let emojiMap: { [id: string]: Types.webUtils.EmojiIconModel } = {};
        let section = this.getSection();
        if (section) {
            model.stickers.forEach(x => {
                let contact = this.personService.persons.contactCollection.find(item => item.getUsername() == x.u);
                if (!contact) {
                    return;
                }
                let person = this.personService.getPerson(contact.getHashmail());
                if (!person) {
                    return;
                }
                let client: string = "";
                let userExtraInfo = this.personService.persons.contactService.getUserExtraInfo(person.username);
                if (userExtraInfo) {
                    let data = <any>userExtraInfo;
                    client = data.client.platform ? "Desktop " + data.client.version : "Web" + data.client.version;
                }
                let personModel: Types.webUtils.PersonModelFull = {
                    hashmail: person.getHashmail(),
                    username: person.username,
                    name: person.getName(),
                    present: person.isPresent(),
                    avatar: person.getAvatar(),
                    description: person.getDescription(),
                    lastUpdate: person.getLastUpdate().getTime(),
                    isEmail: person.isEmail(),
                    isStarred: person.isStarred(),
                    isExternal: person.username.indexOf("@") >= 0,
                    client: client,
                    deviceName: userExtraInfo ? (<any>userExtraInfo).deviceName : "",
                    isAdmin: userExtraInfo ? userExtraInfo.isAdmin : false,
                    lastSeen: userExtraInfo ? Number((<any>userExtraInfo).lastSeenDate) : null,
                    loggedInSince: userExtraInfo ? Number(userExtraInfo.lastLoginDate) : null,
                    ipAddress: ""
                }
                let id = section.decodeSticker(x.s);
                if (!id) {
                    return;
                }
                if (id in emojiMap) {
                    emojiMap[id].count++;
                    emojiMap[id].names += "," + x.u;
                    emojiMap[id].isMy = emojiMap[id].isMy || x.u == this.identity.user,
                        emojiMap[id].persons.push(personModel)
                }
                else {
                    (<any>emojiMap[id]) = {
                        id: id,
                        count: 1,
                        names: x.u,
                        isMy: x.u == this.identity.user,
                        persons: [personModel]

                    };
                }
            });
        }
        let editing = this.editing[model.id];
        let text = editing ? editing.text : message.text;
        let taskStatuses: { [taskId: string]: string } = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, taskStatuses, text);
        if (obj && obj.type == "task-comment") {
            this.tasksPlugin.addTaskStatusesFromMessage(this.session, taskStatuses, obj.comment);
        }
        let isEditable = message.sender.hashmail == this.identity.hashmail && editing == null && (!obj || !obj.type) && this.isLastEditableMessageSinkEntry(model);
        if (isEditable) {
            if (this.lastEditableSinkEntry && this.lastEditableSinkEntry.id != model.id && this.lastEditableSinkEntry.getMessage()) {
                this.transformCollection.triggerBaseUpdateElement(this.lastEditableSinkEntry)
            }
            this.lastEditableSinkEntry = model;
        }
        let nonExistantFileLink = this.entriesWithNonExistantFiles.filter(entry => entry.id == model.id).length > 0;
        return {
            type: ChatMessage.isChatMessage(model) ? "chat" : "mail",
            msgId: model.sink.id + "/" + model.id,
            sendingId: model.message.msgId,
            msgNum: model.id,
            serverDate: message.serverDate.getTime(),
            sender: {
                hashmail: sender.hashmail,
                name: sender.getName(message.sender.name),
                defaultName: utils.Lang.getTrimmedString(message.sender.name),
                description: sender.getDescription()
            },
            title: message.title,
            text: text,
            textAsJson: obj,
            fileInfoIcon: fileInfoIcon,
            contentType: message.contentType,
            attachments: message.attachments.map(x => {
                return {
                    name: x.getName(),
                    mimeType: x.getMimeType(),
                    size: x.getSize(),
                    icon: this.app.shellRegistry.resolveIcon(x.getMimeType())
                };
            }),
            read: model.isRead(),
            myMessage: message.sender.hashmail == this.identity.hashmail,
            sending: editing != null,
            taskLabelClass: taskLabelClass,
            lastEdit: editing ? editing.date : model.source.lastEdit,
            deleted: editing ? editing.deleted : message.deleted,
            editCount: editing ? (model.source.editCount ? model.source.editCount + 1 : 1) : model.source.editCount,
            isEditable: isEditable,
            emoji: {
                icons: utils.Lang.getValues(emojiMap)
            },
            taskStatuses: taskStatuses,
            nonExistantFileLink: nonExistantFileLink,
            isTldr: !!this.msgIsTldr[model.id],
            isExpanded: !!this.msgIsExpanded[model.id],
            expandedQuotes: this.getExpandedQuotes(model.id),
            distanceFromClosestMatch: this.isFilterEnabled() ? this.distancesFromClosestMatch[model.id] : null,
            sectionId: section ? section.getId() : null,
            newFilePaths: newFilePaths,
            fileTaskBadges: section && !nonExistantFileLink && obj && obj.type == "create-file" ? this.getFileTaskLabels(section, obj.did, model) : [],
            hostHash: this.session.hostHash,
        };
    }
    
    getFileTaskLabels(section: mail.section.SectionService, did: string, msg: mail.SinkIndexEntry): TaskBadge[] {
        this.fileMessagesByDid[did] = msg;
        let tree = section && section.getFileModule() && section.getFileModule().fileTree ? section.getFileModule().fileTree : null;
        if (!tree || !this.tasksPlugin) {
            return [];
        }
        let entry = tree.collection.find(x => x.ref.did == did);
        if (!entry || !entry.meta || !entry.meta.bindedElementId) {
            return [];
        }
        let obj: { taskIds: string[] } = null;
        try {
            obj = JSON.parse(entry.meta.bindedElementId);
        }
        catch {}
        if (!obj || !obj.taskIds) {
            return [];
        }
        return obj.taskIds
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(taskId => {
                let task = this.tasksPlugin.getTask(this.session, taskId);
                if (!task) {
                    return null;
                }
                return <TaskBadge>{
                    taskId: task.getId(),
                    status: task.getStatus(),
                    labelClass: this.tasksPlugin.getTaskLabelClassByTaskId(this.session, task.getId()),
                };
            })
            .filter(x => !!x);
    }

    
    getCurrentFileNames(): void {
        
    }
    
    createSendingMessage(text: string, attachments: privfs.lazyBuffer.IContent[], sendingId: number): InnerMessageModel {
        let me = this.personService.getPerson(this.identity.hashmail);
        let now = new Date();
        let taskStatuses: { [taskId: string]: string } = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, taskStatuses, text);
        let section = this.getSection();
        let model: InnerMessageModel = {
            type: "chat",
            msgId: "sending-" + sendingId,
            sendingId: sendingId.toString(),
            msgNum: -sendingId,
            serverDate: now.getTime(),
            sender: {
                hashmail: me.hashmail,
                name: me.getName(),
                defaultName: "",
                description: me.getDescription()
            },
            title: "",
            text: text,
            textAsJson: null,
            fileInfoIcon: null,
            contentType: "html",
            attachments: attachments.map(x => {
                return {
                    name: x.getName(),
                    size: x.getSize(),
                    mimeType: x.getMimeType(),
                    icon: this.app.shellRegistry.resolveIcon(x.getMimeType())
                };
            }),
            read: true,
            myMessage: true,
            sending: true,
            lastEdit: null,
            deleted: false,
            editCount: null,
            isEditable: false,
            emoji: {
                icons: []
            },
            taskStatuses: taskStatuses,
            nonExistantFileLink: false,
            isTldr: false,
            isExpanded: false,
            expandedQuotes: [],
            distanceFromClosestMatch: this.isFilterEnabled() ? 0 : null,
            sectionId: section ? section.getId() : null,
            newFilePaths: {},
            fileTaskBadges: [],
            hostHash: this.session.hostHash,
        };
        return model;
    }

    creatingChannelFileUploadSendingMessage(attachment: privfs.lazyBuffer.IContent, sendingId: number): InnerMessageModel {
        let me = this.personService.getPerson(this.identity.hashmail);
        let now = new Date();
        let json = {
            type: "create-file",
            path: "/" + attachment.getName(),
            size: attachment.getSize(),
            mimeType: attachment.getMimeType(),
            icon: this.app.shellRegistry.resolveIcon(attachment.getMimeType())
        };
        let section = this.getSection();
        let model: InnerMessageModel = {
            type: "chat",
            msgId: "sending-" + sendingId,
            sendingId: sendingId.toString(),
            msgNum: -sendingId,
            serverDate: now.getTime(),
            sender: {
                hashmail: me.hashmail,
                name: me.getName(),
                defaultName: "",
                description: me.getDescription()
            },
            title: "",
            text: JSON.stringify(json),
            textAsJson: json,
            fileInfoIcon: json.icon,
            contentType: "application/json",
            attachments: <any[]>[],
            read: true,
            myMessage: true,
            sending: true,
            lastEdit: null,
            deleted: false,
            editCount: null,
            isEditable: false,
            emoji: {
                icons: []
            },
            taskStatuses: {},
            nonExistantFileLink: false,
            isTldr: false,
            isExpanded: false,
            expandedQuotes: [],
            distanceFromClosestMatch: this.isFilterEnabled() ? 0 : null,
            sectionId: section ? section.getId() : null,
            newFilePaths: {},
            fileTaskBadges: [],
            hostHash: this.session.hostHash,
        };
        return model;
    }

    onViewTaskCommentClick(_msgId: number, _sinkId: string, taskId: string) {
        this.onViewOpenTask(taskId, false);
    }

    static getMsgStats(serverDate: Date, senderHashmail: string, prevDate: Date, prevHashmail: string) {
        let newContext = true;
        let dateSeparator = false;
        if (prevDate) {
            newContext = dateSeparator || prevHashmail != senderHashmail;
            dateSeparator = prevDate.toDateString() != serverDate.toDateString();
        }
        return {
            newContext: newContext,
            dateSeparator: dateSeparator
        };
    }

    static isUnread(entry: mail.SinkIndexEntry): boolean {
        return ChatMessage.isChatMessage(entry) && !entry.isRead();
    }

    static meetsFilter(entry: mail.SinkIndexEntry, word: string): boolean {
        if (!entry) {
            return false;
        }
        if (entry.source.data.contentType == "application/json") {
            let data = entry.getContentAsJson();
            if (data.type == "create-file") {
                let name = data.path.substr(data.path.lastIndexOf("/") + 1);
                return app.common.SearchFilter.matches(word, name);
                // return name.toLocaleLowerCase().indexOf(word) > -1;
            }
            if (data.type == "create-task" || data.type == "modify-task") {
                return app.common.SearchFilter.matches(word, data.name);
                // return data.name.toLocaleLowerCase().indexOf(word) > -1;
            }
            if (data.type == "task-comment") {
                return app.common.SearchFilter.matches(word, data.comment);
                // return data.comment.toLocaleLowerCase().indexOf(word) > -1;
            }
            return false;
        }
        // if (entry.source.data.text.toLocaleLowerCase().indexOf(word) > -1) {
        if (app.common.SearchFilter.matches(word, entry.source.data.text)) {
            return true;
        }
        // if (message.attachments) {
        //     let found: boolean = false;
        //     message.attachments.forEach(x => {
        //         if (x.getName().toLocaleLowerCase().indexOf(word) > -1) {
        //             found = true;
        //             return;
        //         }
        //     });
        //     return found;
        // }
        return false;
    }

    onViewChangeSetting(setting: string, value: boolean): void {
        let settings = this.chatPlugin.getGUISettings();
        settings[setting] = value;
        this.chatPlugin.updateGUISettings(settings);
    }

    onViewChangeViewSetting(setting: string, value: boolean): void {
        let settings = this.chatPlugin.getViewSettings();
        settings[setting] = value;
        this.chatPlugin.updateViewSettings(settings).then(() => {
            if (setting == "show-search-contexts") {
                if (this.isFilterEnabled()) {
                    this.refreshMatches();
                    this.updateSearchState();
                }
            }
        });
    }

    activate(): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("ensureActivated");
        });
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.messagesFilterUpdater.updateFilter(this.app.searchModel.get(), true);
        this.updateVoiceChatUsersOfMine();
        
    }


    deactivate(): void {
        if (!this.isActive) {
            return;
        }
        this.isActive = false;
    }


    getSearchState(): SearchState {
        return {
            active: this.isFilterEnabled(),
            resultsCount: this.takeCollection.list.length,
            mayHaveMoreResults: this.takeCollectionSeq > 0,
        };
    }

    updateSearchState(): void {
        let newState = this.getSearchState();
        if (this.previousSearchState != newState && this.parent && newState.active) {
            let section = null;
            // console.log("on updateSearchState - chatInfo", this.chatInfo);
            if (this.chatInfo.section) {
                section = this.chatInfo.section;
            }
            else if (this.chatInfo.conversation && this.chatInfo.conversation.section) {
                section = this.chatInfo.conversation.section;
            }
            this.parent.dispatchEvent<ChatUpdateSearchStatsEvent>({
                type: "chatupdatesearchstatsevent",
                hostHash: this.session.hostHash,
                sectionId: section.getId(),
                allSearched: !newState.mayHaveMoreResults,
                searchCount: newState.resultsCount,
            });
        }
        this.previousSearchState = newState;
        this.callViewMethod("updateSearchState", JSON.stringify(newState));
    }

    onViewUpdateCanWrite(): void {
        this.callViewMethod("updateCanWrite", this.canWrite());
    }

    canWrite(): boolean {
        let person = this.personService.getMe();
        return !(this.getSection() == null && this.chatInfo.type == ChatType.CONVERSATION && person.username.indexOf("@") >= 0) && !this.isConversationWithDeletedUserOnly();
    }

    isConversationWithDeletedUserOnly(): boolean {
        if (this.chatInfo.type == ChatType.CONVERSATION) {
            if (this.chatInfo.conversation.isSingleContact()) {
                let userName = this.chatInfo.conversation.getFirstPerson().contact.getUsername();
                if (this.chatInfo.conversation.conv2Service.contactService.isUserDeleted(userName)) {
                    return true;
                }
            }
        }
        return false;
    }

    onViewPasteSeemsEmpty(): void {
        Q().then(() => {
            return this.app.getClipboardElementToPaste(
                [
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE,
                    app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES,
                ], [
                    app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES,
                ]
            );
        })
        .then((element: app.common.clipboard.ClipboardElement) => {
            if (element && element.data && element.data[app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]) {
                let files: { mime: string, data?: Buffer, path?: string }[] = JSON.parse(element.data[app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]).map((x: { mime: string, path?: string, data?: any }) => {
                    if (x.data && x.data.type == "Buffer" && x.data.data) {
                        x.data = new Buffer(x.data.data);
                    }
                    return x;
                });
                for (let file of files) {
                    let fileName = file.path;
                    let data: Buffer = file.data ? file.data : require("fs").readFileSync(file.path);
                    Q().then(() => {
                        let section = this.getSection();
                        if (section == null && this.chatInfo.type == ChatType.CONVERSATION && !this.creatingUserGroupLock) {
                            this.creatingUserGroupLock = true;
                            return Q().then(() => {
                                return this.conv2Service.createUserGroup(this.chatInfo.conversation.users);
                            });
                        }
                        return section;
                    })
                    .then(() => {
                        if (!fileName) {
                            return this.app.generateUniqueFileName(this.getSection(), "/", file.mime.split("/")[1]);
                        }
                        else if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                            return fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                        }
                        return fileName;
                    })
                    .then(fn => {
                        fileName = fn;
                        this.sendMessage({
                            attachments: [privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)],
                        });
                    });
                }
            }
        });
    }
    
    tryPaste(element: app.common.clipboard.ClipboardElement, originalText: string): void {
        if (element && element.data && element.data[app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]) {
            let files: { mime: string, data?: Buffer, path?: string }[] = JSON.parse(element.data[app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]).map((x: { mime: string, path?: string, data?: any }) => {
                if (x.data && x.data.type == "Buffer" && x.data.data) {
                    x.data = new Buffer(x.data.data);
                }
                return x;
            });
            for (let file of files) {
                let fileName = file.path;
                let data: Buffer = file.data ? file.data : require("fs").readFileSync(file.path);
                Q().then(() => {
                    let section = this.getSection();
                    if (section == null && this.chatInfo.type == ChatType.CONVERSATION && !this.creatingUserGroupLock) {
                        this.creatingUserGroupLock = true;
                        return Q().then(() => {
                            return this.conv2Service.createUserGroup(this.chatInfo.conversation.users);
                        });
                    }
                    return section;
                })
                .then(() => {
                    if (!fileName) {
                        return this.app.generateUniqueFileName(this.getSection(), "/", file.mime.split("/")[1]);
                    }
                    else if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                        return fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                    }
                    return fileName;
                })
                .then(fn => {
                    fileName = fn;
                    this.sendMessage({
                        attachments: [privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)],
                    });
                });
            }
        }
    }

    onViewPasteSeemsFile(pathsStr: string, originalText: string): void {
        let paths: string[] = [];
        if (this.app.getPlatform() == "darwin") {
            let files = this.app.getSystemClipboardFiles();
            if (files && files.length > 0) {
                files.forEach(f => {
                    if (f.data && f.path && f.mime) {
                        paths.push(f.path);
                    }
                });
            }
        }
        else {
            paths = JSON.parse(pathsStr);
            paths = paths.map(x => decodeURI(x));
        }
        
        this.parent.tryPasteFiles(paths).then(pasteAsFile => {
            if (pasteAsFile) {
                for (let path of paths) {
                    path = (<any>path).startsWith("file://") ? path.substr("file://".length) : path;
                    let buff = this.app.getFileBuffer(path);
                    if (buff === null) {
                        continue;
                    }
                    let mime = mail.filetree.MimeType.resolve(path);
                    this.pasteFile(mime, buff, path);
                }
            }
            else {
                this.callViewMethod("pastePlainText", originalText);
            }
        });
    }
    
    pasteFile(mime: string, data: Buffer, path: string): Q.Promise<void> {
        return Q().then(() => {
            let filename = this.app.getFileName(path);
            return this.sendMessage({
                attachments: [privfs.lazyBuffer.Content.createFromBuffer(data, mime, filename)],
            });
        })
    }

    rewindMessagesIfNeeded(): void {
        this.callViewMethod("checkMessagesAndRewind");
    }

    onViewUpdateIsTldr(isTldrStr: string): void {
        let isTldr: { [msgNum: string]: boolean } = JSON.parse(isTldrStr);
        for (let msgNum in isTldr) {
            if (isTldr[msgNum]) {
                this.msgIsTldr[msgNum] = true;
            }
            else {
                delete this.msgIsTldr[msgNum];
            }
        }
    }

    onViewUpdateIsExpanded(msgNum: string, isExpanded: boolean): void {
        if (isExpanded) {
            this.msgIsExpanded[msgNum] = true;
        }
        else {
            delete this.msgIsExpanded[msgNum];
        }
    }

    onViewUpdateQuoteIsExpanded(msgNum: string, quoteId: string, isExpanded: boolean): void {
        if (isExpanded) {
            if (!this.quoteIsExpanded[msgNum]) {
                this.quoteIsExpanded[msgNum] = {};
            }
            this.quoteIsExpanded[msgNum][quoteId] = true;
        }
        else {
            if (this.quoteIsExpanded[msgNum]) {
                delete this.quoteIsExpanded[msgNum][quoteId];
                if (Object.keys(this.quoteIsExpanded[msgNum]).length == 0) {
                    delete this.quoteIsExpanded[msgNum];
                }
            }
        }
    }
    
    getExpandedQuotes(msgNum: any): number[] {
        return this.quoteIsExpanded[msgNum] ? Object.keys(this.quoteIsExpanded[msgNum]).map(x => parseInt(x)) : [];
    }

    setSession(session: mail.session.Session): Q.Promise<void> {
        return Q().then(() => {
            this.session = session;
            this.thumbs.setSession(session);
            
            //override services
            return Q.all([
                Q.all([
                    this.session.mailClientApi.privmxRegistry.getMessageFlagsUpdater(),
                    this.session.mailClientApi.privmxRegistry.getIdentity(),
                    this.session.mailClientApi.privmxRegistry.getHashmailResolver(),
                    this.session.mailClientApi.privmxRegistry.getPersonService(),
                ]),
                Q.all([
                    this.session.mailClientApi.privmxRegistry.getSinkIndexManager(),
                    this.session.mailClientApi.privmxRegistry.getMessageService(),
                    this.session.mailClientApi.privmxRegistry.getConv2Service(),
                    this.session.mailClientApi.privmxRegistry.getSectionManager().then(sm => {
                        return sm.load().thenResolve(sm);
                    })
                ])
            ])
            .then(res => {
                this.messageFlagsUpdater = res[0][0];
                this.identity = res[0][1];
                this.hashmailResolver = res[0][2];
                this.personService = res[0][3];
                this.sinkIndexManager = res[1][0];
                this.messageService = res[1][1];
                this.conv2Service = res[1][2];
                this.sectionManager = res[1][3];
                this.messagesMarkerQueueEx = new MessagesMarkerQueueEx(new MessagesMarkerQueue(this.messageFlagsUpdater, this.logErrorCallback), this);
                this.messagesMarkerQueueEx.reset();
            })
        })
    }

    getSession(): mail.session.Session {
        return this.session;
    }
    sendQueuedTextMessage(text: string, queueId: number): Q.Promise<void> {
        // console.log("send queued text message..")
        return this.sendMessage({text: text}, queueId);
    }
    
    onViewLoadImages(didsStr: string, scrollToBottom: boolean): void {
        this.scrollToBottomOnLoadImages = scrollToBottom;
        let dids: string[] = JSON.parse(didsStr);
        let section = this.getSection();
        if (!section) {
            return;
        }
        section.getFileTree().then(tree => {
            this.sectionTree = tree;
            return this.sendEntriesImagesToView(dids, scrollToBottom);
        })
        .then(() => {
            setTimeout(() => {
                this.callViewMethod("toggleScrollEnabled", true, scrollToBottom);
            }, 100);
        })
        .fail(this.errorCallback);
    }
    
    sectionTreeCollectionChanged(): void {
        if (!this.sectionTree || !this.imgDidsToProcess || this.imgDidsToProcess.length == 0) {
            return;
        }
        let dids = this.imgDidsToProcess.slice();
        this.imgDidsToProcess = [];
        this.sendEntriesImagesToView(dids, this.scrollToBottomOnLoadImages);
    }
    
    sendEntriesImagesToView(dids: string[], scrollToBottom: boolean): Q.Promise<void> {
        let entries = this.sectionTree.collection.list.filter(f => f.path.indexOf("/.trash/") == -1).filter(x => dids.indexOf(x.ref.did) >= 0);
        let missingDids: string[] = dids.filter(x => this.sectionTree.collection.list.filter(y => y.ref.did == x).length == 0);
        if (missingDids.length > 0) {
            for (let did of missingDids) {
                if (this.imgDidsToProcess.indexOf(did) < 0) {
                    this.imgDidsToProcess.push(did);
                }
            }
            if (!this.sectionTreeCollectionChangedBound) {
                this.sectionTreeCollectionChangedBound = this.sectionTreeCollectionChanged.bind(this);
                this.sectionTree.collection.changeEvent.add(this.sectionTreeCollectionChangedBound);
            }
        }
        let prom = Q();
        for (let entry of entries) {
            prom = prom.then(() => {
                return this.getSection().getFileOpenableElement(entry.path, false).then(file => {
                    return file.getContent();
                })
                .then(content => {
                    let data: Types.app.BlobData = {
                        mimetype: content.getMimeType(),
                        buffer: content.getBuffer()
                    };
                    this.afterViewLoaded.promise.then(() => {
                        this.callViewMethod("setImageSrc", entry.ref.did, data, scrollToBottom);
                    });
                });
            });
        }
        return prom;
    }
    
    getContextSize(): number {
        return this.chatPlugin.getShowSearchContexts() ? ChatMessagesController.SEARCH_CONTEXT_SIZE : 0;
    }
    
    refreshMatches(withoutRebuild: boolean = false): void {
        let searchStr = this.isFilterEnabled() ? this.messagesFilterUpdater.filter.value : null;
        if (!searchStr) {
            for (let entry of this.messagesCollection.list) {
                this.distancesFromClosestMatch[entry.id] = 0;
            }
        }
        else {
            // let showAllSearchContexts = this.chatPlugin.getShowSearchContexts();
            // let contextSize: number = this.getContextSize();
            let lastMatchingIndex = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < this.messagesCollection.list.length; ++i) {
                let entry = this.messagesCollection.list[i];
                // let currContextSize = showAllSearchContexts ? contextSize : (this.showContextForSinkIndexEntryIds.indexOf(entry.id) >= 0 ? ChatMessagesController.SEARCH_CONTEXT_SIZE : 0);
                let currContextSize = ChatMessagesController.SEARCH_CONTEXT_SIZE;
                if (ChatMessagesController.meetsFilter(entry, searchStr)) {
                    this.distancesFromClosestMatch[entry.id] = 0;
                    lastMatchingIndex = i;
                    for (let d = 1; d <= currContextSize; ++d) {
                        let j = i - d;
                        if (j < 0) {
                            break;
                        }
                        let id2 = this.messagesCollection.list[j].id;
                        let newValue = Math.min(d, this.distancesFromClosestMatch[id2]);
                        this.distancesFromClosestMatch[id2] = newValue;
                    }
                }
                else {
                    let dist = i - lastMatchingIndex;
                    this.distancesFromClosestMatch[entry.id] = dist <= currContextSize ? dist : Number.POSITIVE_INFINITY;
                }
            }
        }
        if (!withoutRebuild) {
            this.filteredCollection.rebuild();
        }
    }
    
    onViewStartTalk(): void {
        this.app.dispatchEvent<Types.event.StreamsActionEvent>({type: "streamsAction", action: "talk", sectionId: this.getSection().getId(), hostHash: this.session.hostHash});
    }

    // toggleContextAround(sinkIndexEntryId: number, newShowContext: boolean = null): void {
    //     let idx = this.showContextForSinkIndexEntryIds.indexOf(sinkIndexEntryId);
    //     let showContext = newShowContext ? newShowContext : (idx < 0);
    //     if (showContext == (idx >= 0)) {
    //         return;
    //     }
    //     if (idx < 0) {
    //         this.showContextForSinkIndexEntryIds.push(sinkIndexEntryId);
    //     }
    //     else {
    //         this.showContextForSinkIndexEntryIds.splice(idx, 1);
    //     }
    //     let entryIdx = this.messagesCollection.indexOfBy(x => x.id == sinkIndexEntryId);
    //     let contextSize = ChatMessagesController.SEARCH_CONTEXT_SIZE;
    //     let firstCtxEntryIdx = Math.max(0, entryIdx - contextSize);
    //     let lastCtxEntryIdx = Math.min(this.messagesCollection.size() - 1, entryIdx + contextSize);
    //     for (let i = firstCtxEntryIdx; i <= lastCtxEntryIdx; ++i) {
    //         this.distancesFromClosestMatch[this.messagesCollection.get(i).id] = Math.abs(i - entryIdx);
    //     }
    //     this.filteredCollection.rebuild();
    // }
    
    // onViewToggleContextAround(msgNum: number): void {
    //     this.toggleContextAround(msgNum);
    // }
    
    refreshFileMessagesByDid(did: string): void {
        let msg = this.fileMessagesByDid[did];
        if (msg) {
            setTimeout(() => {
                this.triggerUpdateMessage(msg.id);
                this.transformCollection.triggerBaseUpdateElement(msg);
            }, 2000);
        }
    }
    
    
    
    
    
    /*******************************
    ********** Voice chat **********
    *******************************/
    toggleIsInVoiceChatInThisSection(isInVoiceChat: boolean): void {
        this.callViewMethod("toggleIsInVoiceChatInThisSection", isInVoiceChat);
    }
    
    toggleIsInVoiceChatInAnotherSection(isInVoiceChat: boolean): void {
        this.callViewMethod("toggleIsInVoiceChatInAnotherSection", isInVoiceChat);
    }

    toggleIsVoiceChatActiveInThisSection(isActive: boolean): void {
        this.callViewMethod("toggleIsVoiceChatActiveInThisSection", isActive);
    }
    

    toggleIsTalkingInThisSection(isTalking: boolean): void {
        this.callViewMethod("toggleIsTalkingInThisSection", isTalking);
    }
    
    toggleIsTalkingInAnotherSection(isTalking: boolean): void {
        this.callViewMethod("toggleIsTalkingInAnotherSection", isTalking);
    }

    toggleRingTheBellAvailable(avail: boolean): void {
        this.callViewMethod("toggleRingTheBellAvailable", avail);
    }
    
    onViewJoinVoiceChat(): void {
        Q().then(() => {
            if (this.isInVoiceChatInAnotherSection()) {
                return this.app.openSwitchVoiceChatConfirm()
                .then(confirmResult => {
                    if (confirmResult == true) {
                        this.app.voiceChatService.leaveVoiceChat();
                        return true;
                    }
                    else {
                        return false;
                    }
                })
            } else {
                return true;
            }
        })
        .then(res => {
            if (res == true) {
                let section = this.getSection();
                return Q().then(() => {
                    if (section == null && this.chatInfo.type == ChatType.CONVERSATION && !this.creatingUserGroupLock) {
                        this.creatingUserGroupLock = true;
                        let notificationId = this.notifications.showNotification(this.i18n("plugin.chat.component.chatMessages.notification.preparing"), { autoHide: false, progress: true });
                        return Q().then(() => {
                            return this.conv2Service.createUserGroup(this.chatInfo.conversation.users);
                        })
                        .then(createdSection => {
                            section = createdSection;
                            if (this.isActive) {
                                this.chatPlugin.activeSinkId = this.chatInfo.conversation.sinkIndex ? this.chatInfo.conversation.sinkIndex.sink.id : null;
                                this.chatPlugin.activeSinkHostHash = this.session.hostHash;
                            }
                        })
                        .fin(() => {
                            this.notifications.hideNotification(notificationId);
                            this.creatingUserGroupLock = false;
                        });
                    }
                })
                .then(() => {
                    return this.session.services.voiceChatServiceApi.getRoomInfo(section)
                })
                .then(roomInfo => {
                    this.app.voiceChatService.joinVoiceChat(this.session, section, roomInfo.users, () => {
                        return this.session.services.voiceChatServiceApi.getRoomInfo(section).then(roomInfo => roomInfo.users);
                    });
                })
                .then(() => {
                    this.getSection().getChatModule().sendVoiceChatActivityMessage("joined-voicechat", this.identity.hashmail);
                    this.updateVoiceChatUsersOfMine();
                })
                .fail(e => console.log(e));
        
            }
        })

    }
    
    onViewLeaveVoiceChat(): void {
        this.app.voiceChatService.leaveVoiceChat();
        this.getSection().getChatModule().sendVoiceChatActivityMessage("left-voicechat", this.identity.hashmail);
        this.updateVoiceChatUsersOfMine();
    }

    updateVoiceChatUsersOfMine(): void {
        let section = this.chatInfo.section ? this.chatInfo.section: null;
        let conv = this.chatInfo.conversation ? this.chatInfo.conversation: null;

        let id = section ? section.getId(): conv.id;
        this.app.eventDispatcher.dispatchEvent<UpdateVoiceChatUsersEvent>({type: "update-voice-chat-users", hostHash: this.session.hostHash, sectionId: id });
    }
    
    onViewToggleTalking(): void {
        if (this.isTalkingInThisSection()) {
            this.app.voiceChatService.stopTalking();
        }
        else {
            this.app.voiceChatService.startTalking();
        }
    }
    
    onViewRingTheBell(): void {
        let section = this.getSection();
        if (!section) {
            return;
        }
        this.app.voiceChatService.ringTheBell(this.session, section, this.chatInfo.conversation);
    }

        // for debug voicchat only
    onViewShowPlayerWindow() {
        console.log("show player window event")
        let playerHelperWindow = this.app.windows.playerHelper;
        if (playerHelperWindow) {
            playerHelperWindow.nwin.show();
        }
    }
    
    
}
