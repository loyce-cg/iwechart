"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var ChatMessagesController_1 = require("../../component/chatmessages/ChatMessagesController");
var ChatMessage_1 = require("../../main/ChatMessage");
var Types_1 = require("../../main/Types");
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var index_1 = require("./i18n/index");
var Logger = pmc_mail_1.Logger.get("privfs-chat-plugin.ChatWindowController");
var ChatWindowController = (function (_super) {
    __extends(ChatWindowController, _super);
    function ChatWindowController(parentWindow) {
        var _this = _super.call(this, parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "splitter-vertical": { defaultValue: 340 },
                "splitter-vertical2": { defaultValue: 340 },
                "chat-channels-splitter-vertical": { defaultValue: 200 },
                "chat-splitter-horizontal": { defaultValue: 170 },
                "left-panel-sections-splitter-proportional": { defaultValue: JSON.stringify({ handlePos: 250, totalSize: 1000 }) },
                "enter-sends": { defaultValue: true }
            }
        }) || this;
        _this.searchResults = {};
        _this.isSearchOn = false;
        _this.openChannelViewLock = false;
        _this.ipcMode = true;
        _this.chatPlugin = _this.app.getComponent("chat-plugin");
        _this.setPluginViewAssets("chat");
        _this.openWindowOptions.fullscreen = true;
        _this.openWindowOptions.cssClass = "app-window";
        _this.openWindowOptions.title = _this.i18n("plugin.chat.window.chat.title");
        _this.searchCountFilterUpdater = new ChatMessagesController_1.MessagesFilterUpdater();
        _this.searchCountFilterUpdater.onUpdate = _this.onSearchCountFilterUpdate.bind(_this);
        _this.sectionTooltip = _this.addComponent("sectiontooltip", _this.componentFactory.createComponent("sectiontooltip", [_this]));
        _this.loading = _this.addComponent("loading", _this.componentFactory.createComponent("loading", [_this]));
        _this.enableTaskBadgeAutoUpdater();
        return _this;
    }
    ChatWindowController_1 = ChatWindowController;
    ChatWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    ChatWindowController.prototype.onPrimarySectionChange = function (event) {
        var hostHash = this.app.sessionManager.getLocalSession().hostHash;
        this.sidebar.toggleCustomElements(this.chatPlugin.chatPrimarySections[hostHash].list.length > 0);
    };
    ChatWindowController.prototype.init = function () {
        var _this = this;
        var localSession = this.app.sessionManager.getLocalSession();
        return this.app.mailClientApi.checkLoginCore().then(function () {
            return _this.app.mailClientApi.prepareSectionManager();
        })
            .then(function () {
            return pmc_mail_1.Q.all([
                _this.app.mailClientApi.privmxRegistry.getIdentityProvider(),
                _this.sectionManager.isSectionsLimitReached()
            ]);
        })
            .then(function (res) {
            var identityProvider = res[0], isSectionsLimitReached = res[1];
            var sidebarOptions = {
                sectionsLimitReached: isSectionsLimitReached,
                customElementList: {
                    baseCollection: new pmc_mail_1.utils.collection.MutableCollection([{
                            id: ChatWindowController_1.MY_PRIVATE,
                            icon: {
                                type: "hashmail",
                                value: _this.identity.hashmail
                            },
                            label: _this.i18n("plugin.chat.window.chat.my-messages"),
                            private: true,
                            emphasized: true,
                        }]),
                    unreadProvider: null,
                    elementsCountProvider: null,
                    searchCountProvider: null,
                    searchAllSearchedProvider: null,
                },
                conv2List: {
                    unreadProvider: function (c2s) { return _this.getUnreadFromConv2(localSession, c2s); },
                    elementsCountProvider: function (c2s) { return _this.getConv2ElementsCount(localSession, c2s); },
                    searchCountProvider: function (c2s) { return _this.getConv2SearchCount(localSession, c2s); },
                    searchAllSearchedProvider: function (c2s) { return _this.getConv2SearchAllSearched(localSession, c2s); },
                    withSpinnerProvider: function (c2s) { return _this.getConv2WithSpinner(localSession, c2s); },
                    activeVoiceChatInfoProvider: function (c2s) { return _this.getConvActiveVoiceChatInfo(localSession, c2s); },
                },
                sectionList: {
                    baseCollection: _this.chatPlugin.chatSections[localSession.hostHash],
                    unreadProvider: function (section) { return _this.getUnread(localSession, section); },
                    elementsCountProvider: function (section) { return _this.getSectionElementsCount(localSession, section); },
                    searchCountProvider: function (section) { return _this.getSectionSearchCount(localSession, section); },
                    searchAllSearchedProvider: function (section) { return _this.getSectionSearchAllSearched(localSession, section); },
                    withSpinnerProvider: function (section) { return _this.getSectionWithSpinner(localSession, section); },
                    activeVoiceChatInfoProvider: function (section) { return _this.getSectionActiveVoiceChatInfo(localSession, section); },
                    moduleName: pmc_mail_1.Types.section.NotificationModule.CHAT,
                    sorter: function (a, b) {
                        var res = b.getChatLastDate() - a.getChatLastDate();
                        return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                customSectionList: {
                    baseCollection: _this.chatPlugin.chatPrimarySections[localSession.hostHash],
                    unreadProvider: function (section) { return _this.getUnread(localSession, section); },
                    elementsCountProvider: function (section) { return _this.getSectionElementsCount(localSession, section); },
                    searchCountProvider: function (section) { return _this.getSectionSearchCount(localSession, section); },
                    searchAllSearchedProvider: function (section) { return _this.getSectionSearchAllSearched(localSession, section); },
                    withSpinnerProvider: function (section) { return _this.getSectionWithSpinner(localSession, section); },
                    moduleName: pmc_mail_1.Types.section.NotificationModule.CHAT,
                    sorter: function (a, b) {
                        var res = b.getChatLastDate() - a.getChatLastDate();
                        return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
                    }
                },
                remoteHostList: {
                    elementCountsAggregationStrategy: pmc_mail_1.component.remotehostlist.ElementCountsAggregationStrategy.ALL,
                },
                conv2ListEnabled: true,
                conv2Splitter: _this.settings.create("left-panel-sections-splitter-proportional"),
                sidebarButtons: []
            };
            if (identityProvider.getRights().indexOf("normal") != -1) {
                sidebarOptions.sidebarButtons.push({
                    id: "new-section",
                    label: _this.i18n("plugin.chat.window.chat.sidebar.newsection"),
                    title: _this.i18n("plugin.chat.window.chat.sidebar.newsection"),
                    icon: "ico-comment",
                    windowOpener: true,
                    onSectionList: true
                }, {
                    id: "new-chat",
                    label: _this.i18n("plugin.chat.window.chat.button.newChat.label"),
                    title: _this.i18n("plugin.chat.window.chat.button.newChat.title"),
                    icon: "ico-comment",
                    windowOpener: true,
                });
            }
            if (identityProvider.getType() == "basic") {
                sidebarOptions.sidebarButtons.push({
                    id: "new-chat",
                    label: _this.i18n("plugin.chat.window.chat.button.newChat.label"),
                    title: _this.i18n("plugin.chat.window.chat.button.newChat.titleForBasic"),
                    icon: "ico-comment",
                    windowOpener: true,
                    disabled: true,
                });
            }
            _this.sidebarOptions = sidebarOptions;
            _this.sidebar = _this.addComponent("sidebar", _this.componentFactory.createComponent("sidebar", [_this, sidebarOptions]));
            _this.bindEvent(_this.sidebar, "elementbeforeactivate", _this.onBeforeActivateSidebarElement.bind(_this));
            _this.bindEvent(_this.sidebar, "elementactivated", _this.onActivatedSidebarElement.bind(_this));
            _this.bindEvent(_this.sidebar, "sidebarbuttonaction", _this.onSidebarButtonAction.bind(_this));
            _this.sidebar.usersListTooltip.getContent = function (sectionId) {
                return _this.app.getUsersListTooltipContent(_this.app.sessionManager.getLocalSession(), sectionId);
            };
            _this.chatPlugin.chatPrimarySections[localSession.hostHash].changeEvent.add(_this.onPrimarySectionChange.bind(_this));
            _this.bindEvent(_this.sectionManager.sectionAccessManager.eventDispatcher, "section-state-changed", function (event) {
                if (_this.activeMessages && _this.activeMessages.chatInfo && _this.activeMessages.chatInfo.type == Types_1.ChatType.CHANNEL && _this.activeMessages.chatInfo.section.getId() == event.sectionId) {
                    pmc_mail_1.Q().then(function () {
                        return _this.sectionManager.load();
                    })
                        .then(function () {
                        if (!_this.areAnySectionsExceptPrivate()) {
                            _this.openNoSectionsView();
                            return;
                        }
                        console.log("check available - there are some sections..");
                        var section = _this.sectionManager.getSection(event.sectionId);
                        var moduleEnabled = section.isChatModuleEnabled();
                        if (!moduleEnabled) {
                            _this.openDisabledSectionView(localSession, section);
                        }
                        else {
                            _this.refreshActive(localSession);
                        }
                    });
                }
            });
            _this.bindEvent(_this.app, "reopen-section", function (event) {
                _this.openChannelView(localSession, event.element.getId(), true);
            });
            _this.bindEvent(_this.app, "sectionsLimitReached", function (event) {
                _this.sidebar.onSectionsLimitReached(event.reached);
            });
            _this.bindEvent(_this.app, "requestopenchat", function (event) {
                var hashmails = event.hashmails.filter(function (x) { return _this.personService.getPerson(x) != null && _this.personService.getPerson(x).contact != null; });
                if (hashmails.length == 0) {
                    _this.alert(_this.i18n("plugin.chat.window.chat.cantCreateConversationWithoutUsers"));
                    return;
                }
                if (event.showContactsWindow) {
                    _this.openNewChat(hashmails);
                }
                else {
                    var convId = _this.conv2Service.getConvIdFromHashmails(hashmails);
                    var context = pmc_mail_1.app.common.Context.create({
                        moduleName: pmc_mail_1.Types.section.NotificationModule.CHAT,
                        contextType: "conversation",
                        contextId: convId,
                        hostHash: _this.app.sessionManager.getLocalSession().hostHash
                    });
                    _this.contextHistory.append(context);
                    _this.openChatOrConversationView(convId, true);
                }
            });
            _this.bindEvent(_this.app, "focusLost", function () {
                _this.callViewMethod("pauseTimeAgoRefresher");
            });
            _this.bindEvent(_this.app, "update-chat-sidebar-spinners", function (e) {
                _this.sidebar.updateSidebarSpinners({
                    conv2SectionId: e.conv2SectionId,
                    customElementId: e.customElementId,
                    sectionId: e.sectionId,
                    hosts: e.hostHash ? [_this.app.sessionManager.getSessionByHostHash(e.hostHash).host] : Object.values(_this.app.sessionManager.sessions).map(function (x) { return x.host; }),
                });
            });
            _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
            _this.privateConversations = _this.addComponent("private-conversations", _this.componentFactory.createComponent("privateconversations", [_this]));
            _this.disabledSection = _this.addComponent("disabled-section", _this.componentFactory.createComponent("disabledsection", [_this, pmc_mail_1.Types.section.NotificationModule.CHAT]));
            _this.noSections = _this.addComponent("no-sections", _this.componentFactory.createComponent("nosections", [_this]));
            _this.sectionsSplitter = _this.addComponent("sectionsSplitter", _this.componentFactory.createComponent("splitter", [_this, _this.settings.create("splitter-vertical")]));
            _this.previewSplitter = _this.addComponent("previewSplitter", _this.componentFactory.createComponent("splitter", [_this, _this.settings.create("splitter-vertical2")]));
            _this.messages = {};
            _this.registerChangeEvent(_this.sinkIndexManager.sinkIndexCollection.changeEvent, _this.onSinkChange);
            _this.registerChangeEvent(_this.sinkIndexManager.messagesCollection.changeEvent, function (events) {
                var map = {};
                pmc_mail_1.utils.Event.applyEvents(events, function (event) {
                    if (event.element) {
                        map[event.element.index.sink.id] = true;
                    }
                });
                for (var sid in map) {
                    _this.refreshSidebarBySid(sid);
                }
            }, "multi");
            _this.chatPlugin.chatSections[localSession.hostHash].changeEvent.add(function (event) {
                if (event.element && event.type == "remove" && _this.activeMessages && _this.activeMessages.chatInfo && _this.activeMessages.chatInfo.section && _this.activeMessages.chatInfo.section.getId() == event.element.getId()) {
                    _this.refreshActive(localSession);
                }
            });
            _this.bindEvent(_this.app, "focusChanged", function (event) {
                var windowId = event.windowId;
                _this.chatPlugin.activeWindowFocused = windowId == "main-window" || windowId == "focus-restored" ? _this.parent.activeModel.get() : windowId;
                if (windowId == "chat" || (windowId == "main-window" && _this.parent.activeModel.get() == "chat")) {
                    setTimeout(function () {
                        _this.refreshActivePanelThumbs();
                        if (event.windowId == "main-window") {
                            _this.callViewMethod("resumeTimeAgoRefresher");
                        }
                        _this.callViewMethod("grabFocus", true);
                    }, 200);
                }
            });
            _this.bindEvent(_this.app, "focusLost", function (event) {
                _this.chatPlugin.activeWindowFocused = null;
            });
            _this.bindEvent(_this, "chatupdatesearchstatsevent", _this.onChatUpdateSearchStatsEvent.bind(_this));
            _this.bindEvent(_this.app, "onToggleMaximize-notify", function () {
                setTimeout(function () {
                    _this.callViewMethod("grabFocus", false);
                }, 10);
            });
            _this.registerChangeEvent(_this.app.searchModel.changeEvent, _this.onFilterMessages, "multi");
            if (_this.app.searchModel.data.visible && _this.app.searchModel.data.value != "") {
                _this.onFilterMessages();
            }
            _this.bindEvent(_this.app, "chatvalidmessagetypeforunreadchange", function () {
                _this.sidebar.refresh();
            });
            _this.bindEvent(_this.app, "chatvalidmessagetypefordisplaychange", function () {
                _this.searchCountFilterUpdater.previousFilter = null;
                _this.searchCountFilterUpdater.updateFilter(_this.app.searchModel.get(), true);
            });
            _this.bindEvent(_this.app, "voice-chat-users-presence-change", function (event) {
                _this.updateActiveVoiceChatUsersView(event.hostHash, event.sectionId);
            });
            _this.bindEvent(_this.app, "update-voice-chat-users", function (event) {
                _this.onUpdateVoiceChatUsers(event);
            });
            _this.app.dispatchEvent({ type: "focusChanged", windowId: "chat" });
        })
            .then(function () {
            var tasksPlugin = _this.app.getComponent("tasks-plugin");
            return tasksPlugin.projectsReady;
        });
    };
    ChatWindowController.prototype.onUpdateVoiceChatUsers = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var session, section, api, data, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.app.serverConfigForUser.privmxStreamsEnabled) {
                            return [2];
                        }
                        if (!event.sectionId) return [3, 4];
                        session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
                        section = this.getSectionServiceFromConvIdOrSectionId(session, event.sectionId);
                        if (!section) {
                            return [2];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        api = this.app.sessionManager.getVoiceChatServiceApi(event.hostHash);
                        return [4, api.getRoomInfo(section)];
                    case 2:
                        data = _a.sent();
                        session.webSocketNotifier._notifyVoiceChatUsersChange(session, data.users, event.sectionId);
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        Logger.warn("voice chat unavailable");
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    ChatWindowController.prototype.getSectionServiceFromConvIdOrSectionId = function (session, sectionOrConvId) {
        var conv = session.conv2Service.collection.find(function (x) { return x.section && (x.section.getId() == sectionOrConvId || x.id == sectionOrConvId); });
        var sectionService;
        if (conv) {
            sectionService = conv.section;
        }
        else {
            sectionService = session.sectionManager.getSection(sectionOrConvId);
        }
        return sectionService;
    };
    ChatWindowController.prototype.getUsergroupIdByMessagesId = function (session, id) {
        if (id.indexOf("c2:") == 0) {
            var conv2Section = session.conv2Service.collection.find(function (x) { return x.id == id; });
            var convSectionId = conv2Section && conv2Section.section ? conv2Section.section.getId() : null;
            return convSectionId;
        }
        return id;
    };
    ChatWindowController.prototype.getActiveVoiceChatUsers = function (hostHash, sectionId) {
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var section = session.sectionManager.getSection(sectionId);
        var users = session.webSocketNotifier.getVoiceChatCachedUsers(session, sectionId);
        return pmc_mail_1.mail.WebSocketNotifier.getListeningPeople(session, sectionId, users);
    };
    ChatWindowController.prototype.updateActiveVoiceChatUsersView = function (hostHash, sectionId) {
        var _this = this;
        var session;
        try {
            session = this.app.sessionManager.getSessionByHostHash(hostHash);
        }
        catch (e) {
            console.log("cannot get session", e);
        }
        if (this.activeMessages && this.activeMessages.session && this.activeMessages.session.hostHash == hostHash) {
            this.activeMessages.afterViewLoaded.promise.then(function () {
                if (_this.getUsergroupIdByMessagesId(session, _this.activeMessages.getId()) == _this.getUsergroupIdByMessagesId(session, sectionId)) {
                    var users = _this.getActiveVoiceChatUsers(hostHash, sectionId);
                    var personModelUsers = users.map(function (x) {
                        return {
                            name: x.name,
                            hashmail: x.hashmail,
                            networkInfo: { ping: 0 }
                        };
                    });
                    var usersStr = JSON.stringify(personModelUsers);
                    _this.activeMessages.callViewMethod("updateActiveVoiceChatUsers", usersStr);
                    _this.activeMessages.toggleIsVoiceChatActiveInThisSection(_this.app.voiceChatService.isVoiceChatActive(session, sectionId));
                }
            });
        }
        else {
        }
    };
    ChatWindowController.prototype.getModel = function () {
        return {
            hashmail: this.identity.hashmail,
            domain: this.identity.host,
            activeElementInfo: this.getActiveElementInfo(),
        };
    };
    ChatWindowController.prototype.onViewLoad = function () {
        if (!this.areAnySectionsExceptPrivate()) {
            this.openNoSectionsView();
            return;
        }
        this.activateMessages();
    };
    ChatWindowController.prototype.activateMessages = function () {
        var activeElementInfo = this.getActiveElementInfo();
        this.callViewMethod("activateMessages", activeElementInfo);
        this.callViewMethod("changeIsSearchOn", this.isSearchOn);
        this.initSpellChecker();
        var localSession = this.app.sessionManager.getLocalSession();
        this.sidebar.toggleCustomElements(this.chatPlugin.chatPrimarySections[localSession.hostHash].list.length > 0);
    };
    ChatWindowController.prototype.onViewDragDrop = function (fileHandle) {
        var _this = this;
        var active = this.sidebar.getActive();
        if (active.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            if (active.conv2.hasDeletedUserOnly()) {
                return;
            }
        }
        return pmc_mail_1.Q().then(function () {
            var filesActions = [];
            fileHandle.forEach(function (x) {
                filesActions.push(_this.onDragDropSingle(x));
            });
            return pmc_mail_1.Q.all(filesActions);
        })
            .fail(this.errorCallback);
    };
    ChatWindowController.prototype.onDragDropSingle = function (fileHandle) {
        var formatter = new pmc_mail_1.utils.Formatter();
        var content = this.app.createContent(fileHandle);
        var limit = this.app.getMaxFileSizeLimit();
        if (content.getSize() > limit) {
            return pmc_mail_1.Q.reject(this.i18n("plugin.chat.window.chat.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit))).thenResolve(null);
        }
        else {
            this.activeMessages.sendMessage({ attachments: [content] });
        }
    };
    ChatWindowController.prototype.onViewUserAction = function () {
        if (this.activeMessages) {
            this.activeMessages.onViewUserAction();
        }
    };
    ChatWindowController.prototype.applyHistoryState = function (processed, state) {
        var localSession = this.app.sessionManager.getLocalSession();
        var context = this.contextHistory.getCurrent();
        var handled = false;
        if (context) {
            if (this.app.switchModuleWithContext() || state) {
                if (context.getType() == "section") {
                    var contextSection = this.chatPlugin.sectionManager.getSection(context.getSectionIdFromContextId());
                    if (contextSection && contextSection.isChatModuleEnabled()) {
                        this.openChannelView(localSession, context.getSectionIdFromContextId());
                        handled = true;
                    }
                }
                else if (context.getType() == "conversation") {
                    this.openChatOrConversationView(context.getContextId());
                    handled = true;
                }
                else if (context.getType() == "custom") {
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
            if (state == ChatWindowController_1.MY_PRIVATE) {
                this.openPrivateConversationsView();
            }
            else if (this.getConversationIfExists(state) == null) {
                this.openChannelView(localSession, state);
            }
            else {
                this.openChatOrConversationView(state);
            }
        }
        else {
            this.openLastActiveChat().fail(this.errorCallback);
        }
    };
    ChatWindowController.prototype.openLastActiveChat = function () {
        var _this = this;
        var moduleName = pmc_mail_1.Types.section.NotificationModule.CHAT;
        var localSession = this.app.sessionManager.getLocalSession();
        return pmc_mail_1.Q().then(function () {
            return _this.localStorage.get("last-active-chat");
        })
            .then(function (lastActiveChat) {
            if (lastActiveChat == ChatWindowController_1.MY_PRIVATE) {
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: moduleName,
                    contextType: "custom",
                    contextId: ChatWindowController_1.MY_PRIVATE,
                    hostHash: _this.app.sessionManager.getLocalSession().hostHash
                });
                _this.contextHistory.append(context);
                _this.openPrivateConversationsView();
                return;
            }
            if (_this.getConversationIfExists(lastActiveChat) != null) {
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: moduleName,
                    contextType: "conversation",
                    contextId: lastActiveChat,
                    hostHash: _this.app.sessionManager.getLocalSession().hostHash
                });
                _this.contextHistory.append(context);
                _this.openChatOrConversationView(lastActiveChat);
                return;
            }
            var section = _this.sectionManager.getSection(lastActiveChat);
            if (section == null || !section.isChatModuleEnabled()) {
                section = _this.sidebar.sectionList.sectionsCollection.get(0);
            }
            if (section) {
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: moduleName,
                    contextType: "section",
                    contextId: "section:" + section.getId(),
                    hostHash: _this.app.sessionManager.getLocalSession().hostHash
                });
                _this.contextHistory.append(context);
                return _this.openChannelView(localSession, section.getId());
            }
            if (lastActiveChat == null) {
                return _this.openAnyChat();
            }
        });
    };
    ChatWindowController.prototype.openAnyChat = function () {
        var firstConv = this.chatPlugin.conv2Service.collection ? this.chatPlugin.conv2Service.collection.get(0) : null;
        if (firstConv) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: pmc_mail_1.Types.section.NotificationModule.CHAT,
                contextType: "conversation",
                contextId: firstConv.id,
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);
            this.openChatOrConversationView(firstConv.id);
        }
    };
    ChatWindowController.prototype.reopenChat = function () {
        var active = this.sidebar.getActive();
        if (!active) {
            return;
        }
        if (active.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            this.openChatOrConversationView(active.conv2.id);
        }
        else if (active.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
            var session = this.app.sessionManager.getLocalSession();
            this.openChannelView(session, active.section.getId());
        }
        else if (active.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
            var session = this.app.sessionManager.getSessionByHostHash(active.hostHash);
            this.openRemoteChannelView(active.hostHash, active.section.getId());
        }
        else if (active.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            if (active.customElement.id == ChatWindowController_1.MY_PRIVATE) {
                this.openPrivateConversationsView();
            }
        }
    };
    ChatWindowController.prototype.getActiveId = function () {
        var active = this.sidebar.getActive();
        var localSession = this.app.sessionManager.getLocalSession();
        var session = active && active.hostHash && this.app.sessionManager.isSessionExistsByHostHash(active.hostHash)
            ? this.app.sessionManager.getSessionByHostHash(active.hostHash)
            : localSession;
        if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            return this.getConversationId(session, active.conv2);
        }
        if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
            return this.getChannelId(session, active.section);
        }
        if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
            return this.getChannelId(session, active.section);
        }
        if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            return this.getConversationId(session, active.conv2);
        }
        if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION) {
            return this.getChannelId(session, active.section);
        }
        return null;
    };
    ChatWindowController.prototype.getActiveElementInfo = function () {
        var active = this.sidebar.getActive();
        var localSession = this.app.sessionManager.getLocalSession();
        var session = active && active.hostHash && this.app.sessionManager.isSessionExistsByHostHash(active.hostHash)
            ? this.app.sessionManager.getSessionByHostHash(active.hostHash)
            : localSession;
        var hostHash = session.hostHash;
        var activeElement = { hostHash: hostHash };
        activeElement.guiSettings = this.chatPlugin.getGUISettings();
        activeElement.viewSettings = this.chatPlugin.getViewSettings();
        if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            activeElement.elementId = active.conv2.id;
            activeElement.conversationId = this.getConversationId(session, active.conv2);
        }
        if (active != null && (active.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION || active.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION)) {
            activeElement.elementId = active.section.getId();
            activeElement.parentId = active.section.getRoot().getId();
            activeElement.channelId = this.getChannelId(session, active.section);
        }
        if (active != null && (active.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION)) {
            activeElement.elementId = active.section.getId();
            activeElement.parentId = active.section.getRoot().getId();
            activeElement.channelId = this.getChannelId(session, active.section);
        }
        if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            activeElement.elementId = active.conv2.id;
            activeElement.conversationId = this.getConversationId(session, active.conv2);
        }
        return activeElement;
    };
    ChatWindowController.prototype.refreshActive = function (session) {
        if (!this.areAnySectionsExceptPrivate()) {
            this.openNoSectionsView();
            return;
        }
        var section = session.sectionManager.getSection(this.getActiveElementInfo().elementId);
        if (section && !section.isChatModuleEnabled()) {
            return;
        }
        var id = this.getActiveId();
        var prevActive = this.activeMessages;
        var messagesChatController = this.messages[id];
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
        this.updateActiveVoiceChatUsersView(session.hostHash, this.activeMessages.getId());
        this.refreshActivePanelThumbs();
    };
    ChatWindowController.prototype.getConversationId = function (session, conversation) {
        return "messages-conversation-" + session.hostHash + "-" + conversation.id;
    };
    ChatWindowController.prototype.getOrCreateConversation = function (conversation) {
        return this.getOrCreateRemoteConversation(this.app.sessionManager.getLocalSession().hostHash, conversation);
    };
    ChatWindowController.prototype.openChatOrConversationView = function (conversationId, force, focus) {
        var _this = this;
        if (this.openChannelViewLock) {
            return pmc_mail_1.Q(null);
        }
        this.openChannelViewLock = true;
        return pmc_mail_1.Q().then(function () {
            if (focus !== false) {
                _this.onViewFocus();
            }
            var active = _this.sidebar.getActive();
            if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION && active.conv2.id == conversationId) {
                if (focus !== false && _this.activeMessages) {
                    _this.activeMessages.focus();
                }
                return active.conv2;
            }
            var conversation = _this.conv2Service.collection.find(function (x) { return x.id == conversationId; });
            if (conversation == null) {
                if (force && conversationId) {
                    var users = _this.conv2Service.getUsersFromConvId(conversationId);
                    conversation = _this.conv2Service.getOrCreateConv(users, true);
                    if (conversation == null) {
                        console.log("exit with conv null");
                        return null;
                    }
                }
                else {
                    console.log("exit with conv null (2)");
                    return null;
                }
            }
            _this.chatPlugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
            var session = _this.app.sessionManager.getLocalSession();
            _this.chatPlugin.activeSinkHostHash = session.hostHash;
            return _this.getOrCreateConversation(conversation)
                .then(function (messagesController) {
                _this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION,
                    conv2: conversation,
                }, false);
                return conversation;
            });
        })
            .fin(function () {
            _this.openChannelViewLock = false;
        });
    };
    ChatWindowController.prototype.getConversationIfExists = function (conversationId, force) {
        var conversation = this.conv2Service.collection.find(function (x) { return x.id == conversationId; });
        if (conversation) {
            return conversation;
        }
        if (force && conversationId) {
            var users = this.conv2Service.getUsersFromConvId(conversationId);
            conversation = this.conv2Service.getOrCreateConv(users, true);
            if (conversation == null) {
                return null;
            }
        }
        else {
            return null;
        }
        return conversation;
    };
    ChatWindowController.prototype.getChannelId = function (session, section) {
        return "messages-channel-" + session.hostHash + "-" + section.getId();
    };
    ChatWindowController.prototype.getOrCreateChannel = function (section) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return section.getChatModule().sinkIndex == null ? section.getChatModule().getSinkIndex() : pmc_mail_1.Q.resolve();
        })
            .then(function () {
            var id = _this.getChannelId(_this.app.sessionManager.getLocalSession(), section);
            if (!(id in _this.messages) || !_this.messages[id].getSection().getChatModule().sinkIndex) {
                _this.messages[id] = _this.addComponent(id, _this.componentFactory.createComponent("chatmessages", [_this]));
                _this.messages[id].init();
                return _this.messages[id].setSession(_this.app.sessionManager.getLocalSession())
                    .then(function () {
                    _this.messages[id].setSectionData(section);
                    if (section && section.getChatModule()) {
                        var chatModule_1 = section.getChatModule();
                        chatModule_1.chatMessagesCollection.changeEvent.add(function () {
                            if (chatModule_1.sink) {
                                _this.refreshSidebarBySid(chatModule_1.sink.id);
                            }
                        }, "multi");
                    }
                    return _this.messages[id];
                });
            }
            return _this.messages[id];
        });
    };
    ChatWindowController.prototype.isSectionPrimary = function (session, section) {
        return this.chatPlugin.chatPrimarySections[session.hostHash].contains(section);
    };
    ChatWindowController.prototype.openChannelView = function (session, sectionId, fromDisabled) {
        var _this = this;
        if (this.openChannelViewLock) {
            return;
        }
        var active = this.sidebar.getActive();
        if (fromDisabled !== true && active != null
            && (active.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION || active.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION) && active.section.getId() == sectionId) {
            return pmc_mail_1.Q.resolve(null);
        }
        var section = this.sectionManager.getSection(sectionId);
        if (section == null) {
            return pmc_mail_1.Q.resolve(null);
        }
        this.openChannelViewLock = true;
        return pmc_mail_1.Q().then(function () {
            if (!_this.areAnySectionsExceptPrivate()) {
                _this.openNoSectionsView();
                return;
            }
            if (!section.isChatModuleEnabled()) {
                _this.openDisabledSectionView(session, section);
                _this.openChannelViewLock = false;
                return;
            }
            else {
                return section.getChatModule().getSinkIndex().then(function (sinkIndex) {
                    section.getChatModule().sinkIndex = sinkIndex;
                    return;
                })
                    .then(function () {
                    return _this.getOrCreateChannel(section);
                })
                    .then(function () {
                    _this.sidebar.setActive({
                        type: _this.isSectionPrimary(session, section) ? pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION : pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
                        section: section
                    }, false);
                    _this.chatPlugin.activeSinkId = section.getChatSink().id;
                    _this.chatPlugin.activeSinkHostHash = _this.app.sessionManager.getLocalSession().hostHash;
                    _this.refreshActive(session);
                    _this.openChannelViewLock = false;
                    return;
                });
            }
        })
            .fin(function () {
            _this.openChannelViewLock = false;
        });
    };
    ChatWindowController.prototype.openDisabledSectionView = function (session, section) {
        console.log("on openDisabledSectionView");
        this.sidebar.setActive({
            type: this.isSectionPrimary(session, section) ? pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION : pmc_mail_1.component.sidebar.SidebarElementType.SECTION,
            section: section
        }, false);
        this.chatPlugin.activeSinkId = section.getChatSink().id;
        this.chatPlugin.activeSinkHostHash = this.app.sessionManager.getLocalSession().hostHash;
        this.disabledSection.setSection(section);
        this.callViewMethod("openDisabledSectionView");
    };
    ChatWindowController.prototype.openPrivateConversationsView = function () {
        this.chatPlugin.activeSinkId = null;
        this.chatPlugin.activeSinkHostHash = null;
        this.sidebar.setActive({
            type: pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT,
            customElement: this.sidebar.customElementList.customElementsCollection.find(function (x) { return x.id == ChatWindowController_1.MY_PRIVATE; })
        }, false);
        this.callViewMethod("openPrivateConversations");
    };
    ChatWindowController.prototype.openNoSectionsView = function () {
        this.chatPlugin.activeSinkId = null;
        this.chatPlugin.activeSinkHostHash = null;
        this.callViewMethod("openNoSections");
    };
    ChatWindowController.prototype.getOrCreateRemoteChannel = function (hostHash, section) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var id = _this.getChannelId(_this.app.sessionManager.getSessionByHostHash(hostHash), section);
            if (!(id in _this.messages) || !_this.messages[id].getSection().getChatModule().sinkIndex) {
                _this.messages[id] = _this.addComponent(id, _this.componentFactory.createComponent("chatmessages", [_this]));
                _this.messages[id].init();
                return _this.messages[id].setSession(_this.app.sessionManager.getSessionByHostHash(hostHash))
                    .then(function () {
                    _this.messages[id].setSectionData(section);
                    if (section && section.getChatModule()) {
                        var chatModule_2 = section.getChatModule();
                        chatModule_2.chatMessagesCollection.changeEvent.add(function () {
                            if (chatModule_2.sink) {
                                _this.refreshSidebarBySidRemote(hostHash, chatModule_2.sink.id);
                            }
                        }, "multi");
                    }
                    return _this.messages[id];
                });
            }
            return _this.messages[id];
        });
    };
    ChatWindowController.prototype.getOrCreateRemoteConversation = function (hostHash, conversation) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var id = _this.getConversationId(_this.app.sessionManager.getSessionByHostHash(hostHash), conversation);
            if (!(id in _this.messages)) {
                var baseCollection = conversation.messagesCollection;
                var collection_1 = new pmc_mail_1.utils.collection.FilteredCollection(baseCollection, function (entry) {
                    return ChatMessage_1.ChatMessage.isChatMessage(entry) || _this.chatPlugin.isMailMessage(entry);
                });
                _this.messages[id] = _this.addComponent(id, _this.componentFactory.createComponent("chatmessages", [_this]));
                _this.messages[id].init();
                return _this.messages[id].setSession(_this.app.sessionManager.getSessionByHostHash(hostHash))
                    .then(function () {
                    conversation.prepareMessagesCollection().fail(function (e) {
                        _this.getLogger().error("Error during preparing messages", e);
                    });
                    _this.messages[id].setChatData({
                        type: Types_1.ChatType.CONVERSATION,
                        section: null,
                        conversation: conversation
                    }, collection_1);
                    if (conversation && conversation.section && conversation.section.getChatModule()) {
                        _this.messages[id].setConversationFilesChangeListener();
                        var chatModule_3 = conversation.section.getChatModule();
                        if (chatModule_3.chatMessagesCollection) {
                            chatModule_3.chatMessagesCollection.changeEvent.add(function () {
                                if (chatModule_3.sink) {
                                    _this.refreshSidebarBySidRemote(hostHash, chatModule_3.sink.id);
                                }
                            }, "multi");
                        }
                    }
                    return _this.messages[id];
                });
            }
            return _this.messages[id];
        });
    };
    ChatWindowController.prototype.openRemoteChannelView = function (hostHash, sectionId, fromDisabled) {
        var _this = this;
        if (this.openChannelViewLock) {
            return;
        }
        var active = this.sidebar.getActive();
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        if (fromDisabled !== true && active != null
            && (active.type != pmc_mail_1.component.sidebar.SidebarElementType.HOST && active.section && active.section.getId() == sectionId)) {
            return pmc_mail_1.Q.resolve(null);
        }
        return pmc_mail_1.Q().then(function () {
            return session.mailClientApi.privmxRegistry.getSectionManager().then(function (sm) {
                return sm.load().thenResolve(sm);
            });
        })
            .then(function (sectionManager) {
            var section = sectionManager.getSection(sectionId);
            if (section == null) {
                return pmc_mail_1.Q.resolve(null);
            }
            _this.openChannelViewLock = true;
            return pmc_mail_1.Q().then(function () {
                if (!section.isChatModuleEnabled()) {
                    _this.openDisabledSectionView(session, section);
                    _this.openChannelViewLock = false;
                    return;
                }
                else {
                    return section.getChatModule().getSinkIndex().then(function (sinkIndex) {
                        section.getChatModule().sinkIndex = sinkIndex;
                        return;
                    })
                        .then(function () {
                        return _this.getOrCreateRemoteChannel(hostHash, section);
                    })
                        .then(function () {
                        _this.sidebar.setActive({
                            type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION,
                            section: section,
                            hostHash: hostHash
                        }, false);
                        _this.chatPlugin.activeSinkId = section.getChatSink().id;
                        _this.chatPlugin.activeSinkHostHash = session.hostHash;
                        _this.refreshActive(session);
                        _this.openChannelViewLock = false;
                        return;
                    });
                }
            });
        })
            .fin(function () {
            _this.openChannelViewLock = false;
        });
    };
    ChatWindowController.prototype.openRemoteChatOrConversationView = function (hostHash, conversationId, force, focus) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (focus !== false) {
                _this.onViewFocus();
            }
            var active = _this.sidebar.getActive();
            if (active != null && active.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION && active.conv2.id == conversationId) {
                if (focus !== false && _this.activeMessages) {
                    _this.activeMessages.focus();
                }
                return active.conv2;
            }
            var session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            var conversation = session.conv2Service.collection.find(function (x) { return x.id == conversationId; });
            if (conversation == null) {
                if (force && conversationId) {
                    var users = session.conv2Service.getUsersFromConvId(conversationId);
                    conversation = session.conv2Service.getOrCreateConv(users, true);
                    if (conversation == null) {
                        return null;
                    }
                }
                else {
                    return null;
                }
            }
            _this.chatPlugin.activeSinkId = conversation.sinkIndex ? conversation.sinkIndex.sink.id : null;
            _this.chatPlugin.activeSinkHostHash = session.hostHash;
            return _this.getOrCreateRemoteConversation(hostHash, conversation)
                .then(function () {
                _this.sidebar.setActive({
                    type: pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION,
                    conv2: conversation,
                    hostHash: session.hostHash
                }, false);
                return conversation;
            });
        });
    };
    ChatWindowController.prototype.refreshRemoteConversation = function (session, conversation) {
        if (this.networkIsDown()) {
            this.showOfflineError();
            return;
        }
        var controller = this;
        conversation.persons.forEach(function (person) {
            if (person.hasContact()) {
                session.sectionManager.contactService.refreshContact(person.getHashmail(), true)
                    .fail(controller.logErrorCallback);
            }
        });
    };
    ChatWindowController.prototype.expandRemoteSectionsList = function (hostEntry) {
        var _this = this;
        var session;
        var hostHash = this.app.sessionManager.getHashFromHost(hostEntry.host);
        var checkSessionExists = this.app.sessionManager.isSessionExistsByHostHash(hostHash);
        if (checkSessionExists && hostEntry.sectionList != null && hostEntry.conv2List != null) {
            this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
            return;
        }
        pmc_mail_1.Q().then(function () {
            _this.sidebar.callViewMethod("showHostLoading", hostHash, true);
            if (!checkSessionExists) {
                return _this.app.sessionManager.createRemoteSession(hostEntry.host)
                    .then(function () {
                    return _this.app.sessionManager.init(hostHash);
                })
                    .fail(function () {
                    _this.sidebar.callViewMethod("showHostLoading", hostHash, false);
                    return _this.errorCallback;
                });
            }
        })
            .then(function () {
            session = _this.app.sessionManager.getSessionByHostHash(hostHash);
            return _this.chatPlugin.prepareSession(session);
        })
            .then(function () {
            return pmc_mail_1.Q.all(session.sectionManager.sectionsCollection.list.map(function (x) { return x.getChatSinkIndex(); }));
        })
            .then(function () {
            _this.registerRemoteChangeEvents(session);
            if (!_this.remoteServers) {
                _this.remoteServers = {};
            }
            _this.initRemoteHostComponents(hostEntry, session);
            _this.callViewMethod("expandRemoteSectionsList", hostEntry.host, hostHash);
        })
            .then(function () {
            _this.updateSidebarHostElement(session);
        });
    };
    ChatWindowController.prototype.checkRemoteHostComponentsInitialized = function (hostHash) {
        var ret = (hostHash in this.remoteServers) && this.remoteServers[hostHash].sectionList != null && this.remoteServers[hostHash].conv2List != null;
        return ret;
    };
    ChatWindowController.prototype.initRemoteHostComponents = function (hostEntry, session) {
        var _this = this;
        var hostHash = session.hostHash;
        if (this.checkRemoteHostComponentsInitialized(hostHash)) {
            return;
        }
        var sectionsListOptions = {
            baseCollection: session.sectionManager.filteredCollection,
            unreadProvider: function (section) { return _this.getUnread(session, section); },
            elementsCountProvider: function (section) { return _this.getSectionElementsCount(session, section); },
            searchCountProvider: function (section) { return _this.getSectionSearchCount(session, section); },
            searchAllSearchedProvider: function (section) { return _this.getSectionSearchAllSearched(session, section); },
            withSpinnerProvider: function (section) { return _this.getSectionWithSpinner(session, section); },
            sorter: function (a, b) {
                var res = b.getChatLastDate() - a.getChatLastDate();
                return res == 0 ? pmc_mail_1.component.sectionlist.SectionListController.nameSectionSorter(a, b) : res;
            },
            moduleName: pmc_mail_1.Types.section.NotificationModule.CHAT,
            checkShowAllAvailSections: false,
            session: session
        };
        var conv2ListOptions = {
            unreadProvider: function (c2s) { return _this.getUnreadFromConv2(session, c2s); },
            elementsCountProvider: function (c2s) { return _this.getConv2ElementsCount(session, c2s); },
            searchCountProvider: function (c2s) { return _this.getConv2SearchCount(session, c2s); },
            searchAllSearchedProvider: function (c2s) { return _this.getConv2SearchAllSearched(session, c2s); },
            withSpinnerProvider: function (c2s) { return _this.getConv2WithSpinner(session, c2s); },
            session: session,
        };
        var hostList = hostEntry;
        hostList.sectionList = this.addComponent("remoteSectionsList-" + hostHash, this.componentFactory.createComponent("remotesectionlist", [this, sectionsListOptions]));
        hostList.sectionList.ipcMode = true;
        hostList.conv2List = this.addComponent("remoteConv2List-" + hostHash, this.componentFactory.createComponent("remoteconv2list", [this, conv2ListOptions]));
        hostList.conv2List.ipcMode = true;
        this.remoteServers[hostHash] = hostList;
        this.sidebar.registerRemoteSectionsList(hostHash, hostList.sectionList);
        this.sidebar.registerRemoteConv2List(hostHash, hostList.conv2List);
    };
    ChatWindowController.prototype.onBeforeActivateSidebarElement = function (event) {
        var moduleName = "chat";
        event.result = false;
        if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.HOST) {
            this.expandRemoteSectionsList(event.element.host);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: moduleName,
                contextType: "remote-section",
                contextId: "section:" + event.element.section.getId(),
                hostHash: event.element.hostHash
            });
            this.contextHistory.append(context);
            this.openRemoteChannelView(event.element.hostHash, event.element.section.getId());
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: moduleName,
                contextType: "remote-conversation",
                contextId: event.element.conv2.id,
                hostHash: event.element.hostHash
            });
            this.contextHistory.append(context);
            this.openRemoteChatOrConversationView(event.element.hostHash, event.element.conv2.id, false);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: moduleName,
                contextType: "conversation",
                contextId: event.element.conv2.id,
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);
            this.openChatOrConversationView(event.element.conv2.id, false);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: moduleName,
                contextType: "section",
                contextId: event.element.section.getId(),
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);
            this.openChannelView(this.app.sessionManager.getLocalSession(), event.element.section.getId());
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: moduleName,
                contextType: "custom",
                contextId: event.element.section.getId(),
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);
            this.openChannelView(this.app.sessionManager.getLocalSession(), event.element.section.getId());
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_ELEMENT) {
            var context = pmc_mail_1.app.common.Context.create({
                moduleName: moduleName,
                contextType: "custom",
                contextId: event.element.customElement.id,
                hostHash: this.app.sessionManager.getLocalSession().hostHash
            });
            this.contextHistory.append(context);
            if (event.element.customElement.id == ChatWindowController_1.MY_PRIVATE) {
                this.openPrivateConversationsView();
            }
        }
    };
    ChatWindowController.prototype.onActivatedSidebarElement = function (event) {
        var localSession = this.app.sessionManager.getLocalSession();
        if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.HOST) {
        }
        if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CONVERSATION) {
            this.refreshActive(localSession);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.SECTION) {
            this.refreshActive(localSession);
        }
        if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_CONVERSATION) {
            var session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            this.refreshActive(session);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.REMOTE_SECTION) {
            var session = this.app.sessionManager.getSessionByHostHash(event.element.hostHash);
            this.refreshActive(session);
        }
        else if (event.element.type == pmc_mail_1.component.sidebar.SidebarElementType.CUSTOM_SECTION) {
            this.refreshActive(localSession);
        }
    };
    ChatWindowController.prototype.onSidebarButtonAction = function (event) {
        if (event.sidebarButton.id == "new-chat" && !event.sidebarButton.disabled) {
            this.openNewChat();
        }
        if (event.sidebarButton.id == "new-section") {
            this.openSectionsWindow();
        }
    };
    ChatWindowController.prototype.onSinkChange = function (event) {
        if (event.element == null) {
            return;
        }
        this.refreshSidebarBySid(event.element.sink.id);
    };
    ChatWindowController.prototype.registerRemoteChangeEvents = function (session) {
        var _this = this;
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.sinkIndexCollection.changeEvent, function (event) {
            if (event.element) {
                _this.refreshSidebarBySidRemote(session.hostHash, event.element.sink.id);
            }
        });
        this.registerChangeEvent(session.sectionManager.sinkIndexManager.messagesCollection.changeEvent, function (events) {
            var map = {};
            pmc_mail_1.utils.Event.applyEvents(events, function (event) {
                if (event.element) {
                    map[event.element.index.sink.id] = true;
                }
            });
            for (var sid in map) {
                _this.refreshSidebarBySidRemote(session.hostHash, sid);
            }
        }, "multi");
    };
    ChatWindowController.prototype.refreshSidebarBySid = function (sid) {
        var section = this.sectionManager.getSectionBySinkId(sid);
        if (section == null) {
            return;
        }
        var convIndex = this.sidebar.conv2List.conversationCollection.indexOfBy(function (x) { return x.section == section; });
        if (convIndex != -1) {
            this.sidebar.conv2List.conversationCollection.triggerUpdateAt(convIndex);
            return;
        }
        var sectionIndex = this.sidebar.sectionList.sectionsCollection.indexOfBy(function (x) { return x.getId() == section.getId(); });
        if (sectionIndex != -1) {
            this.sidebar.sectionList.sortedCollection.triggerBaseUpdateElement(section);
            return;
        }
        var customSectionIndex = this.sidebar.customSectionList.sectionsCollection.indexOfBy(function (x) { return x.getId() == section.getId(); });
        if (customSectionIndex != -1) {
            this.sidebar.customSectionList.sortedCollection.triggerBaseUpdateElement(section);
            return;
        }
    };
    ChatWindowController.prototype.refreshSidebarBySidRemote = function (hostHash, sid) {
        if (hostHash == this.app.sessionManager.getLocalSession().hostHash) {
            return this.refreshSidebarBySid(sid);
        }
        var session = this.app.sessionManager.getSessionByHostHash(hostHash);
        var section = session.sectionManager.getSectionBySinkId(sid);
        if (section == null) {
            return;
        }
        var convIndex = this.sidebar.remoteConv2Lists[hostHash].conversationCollection.indexOfBy(function (x) { return x.section == section; });
        if (convIndex != -1) {
            this.sidebar.remoteConv2Lists[hostHash].conversationCollection.triggerUpdateAt(convIndex);
            this.updateSidebarHostElement(session);
            return;
        }
        var sectionIndex = this.sidebar.remoteSectionsLists[hostHash].sortedCollection.indexOfBy(function (x) { return x.getId() == section.getId(); });
        if (sectionIndex != -1) {
            this.sidebar.remoteSectionsLists[hostHash].sortedCollection.triggerBaseUpdateElement(section);
            this.updateSidebarHostElement(session);
            return;
        }
    };
    ChatWindowController.prototype.updateSidebarHostElement = function (session) {
        if (this.app.sessionManager.getLocalSession() == session) {
            return;
        }
        var element = this.sidebar.hostList.hostsSortedCollection.find(function (x) { return x.host == session.host; });
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    };
    ChatWindowController.prototype.openNewChat = function (hashmails) {
        var _this = this;
        if (hashmails === void 0) { hashmails = []; }
        this.app.ioc.create(pmc_mail_1.window.selectcontacts.SelectContactsWindowController, [this, {
                message: this.i18n("plugin.chat.window.chat.selectContacts.header.newChat.text"),
                editable: true,
                hashmails: hashmails,
                fromServerUsers: true
            }])
            .then(function (win) {
            var singletonSuffix = !hashmails || hashmails.length == 0 || !_this.activeMessages ? "new-conv2" : _this.activeMessages.getId();
            _this.app.openSingletonWindow("selectContacts-" + singletonSuffix, win);
            win.getPromise().then(function (hashmails) {
                var convId = _this.conv2Service.getConvIdFromHashmails(hashmails);
                var context = pmc_mail_1.app.common.Context.create({
                    moduleName: pmc_mail_1.Types.section.NotificationModule.CHAT,
                    contextType: "conversation",
                    contextId: convId,
                    hostHash: _this.app.sessionManager.getLocalSession().hostHash
                });
                _this.contextHistory.append(context);
                _this.openChatOrConversationView(convId, true);
            });
        });
    };
    ChatWindowController.prototype.openSectionsWindow = function () {
        this.app.openNewSectionDialogFromSidebar();
    };
    ChatWindowController.prototype.getUnread = function (session, section) {
        if (!section.hasChatModule()) {
            return 0;
        }
        var mailStats = this.chatPlugin.mailStats[session.hostHash];
        if (!mailStats) {
            return 0;
        }
        var stats = mailStats.getStats(section.getChatSink().id);
        return this.chatPlugin.getUnreadCountFromStats(stats);
    };
    ChatWindowController.prototype.getSectionElementsCount = function (session, section) {
        if (!section.hasChatModule() || section.getChatModule().sinkIndex == null) {
            return 0;
        }
        return section.getChatModule().sinkIndex.getMessagesCount();
    };
    ChatWindowController.prototype.getSectionSearchCount = function (session, section) {
        var id = section.getId();
        var searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].count;
        }
        return 0;
    };
    ChatWindowController.prototype.getSectionSearchAllSearched = function (session, section) {
        var id = section.getId();
        var searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].allSearched;
        }
        return true;
    };
    ChatWindowController.prototype.getSectionWithSpinner = function (session, section) {
        var sws = this.chatPlugin.sectionsWithSpinner;
        if (sws[session.hostHash] && sws[session.hostHash]["__all__"]) {
            return true;
        }
        if (!sws[session.hostHash]) {
            return false;
        }
        return !!sws[session.hostHash][section.getId()];
    };
    ChatWindowController.prototype.getSectionActiveVoiceChatInfo = function (session, section) {
        var users = this.getActiveVoiceChatUsers(session.hostHash, section.getId());
        var ret = {
            active: users.length > 0,
            users: users
        };
        return ret;
    };
    ChatWindowController.prototype.getUnreadFromConv2 = function (session, conv2Section) {
        return conv2Section.section == null ? 0 : this.getUnread(session, conv2Section.section);
    };
    ChatWindowController.prototype.getConv2ElementsCount = function (session, conv2Section) {
        if (conv2Section.section == null) {
            return 0;
        }
        if (!conv2Section.section.hasChatModule() || conv2Section.section.getChatModule().sinkIndex == null) {
            return 0;
        }
        return conv2Section.section.getChatModule().sinkIndex.getMessagesCount();
    };
    ChatWindowController.prototype.getConv2SearchCount = function (session, conv2Section) {
        var id = conv2Section.id;
        var searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].count;
        }
        return 0;
    };
    ChatWindowController.prototype.getConv2SearchAllSearched = function (session, conv2Section) {
        var id = conv2Section.id;
        var searchResults = this.getSearchResults(session);
        if (searchResults && (id in searchResults)) {
            return searchResults[id].allSearched;
        }
        return true;
    };
    ChatWindowController.prototype.getConvActiveVoiceChatInfo = function (session, conv2) {
        var users = this.getActiveVoiceChatUsers(session.hostHash, conv2.id);
        return {
            active: users.length > 0,
            users: users
        };
    };
    ChatWindowController.prototype.getRemoteUnread = function (host) {
        return 0;
    };
    ChatWindowController.prototype.getRemoteSectionElementsCount = function (host) {
        return 0;
    };
    ChatWindowController.prototype.getRemoteSectionSearchCount = function (host) {
        return 0;
    };
    ChatWindowController.prototype.getRemoteSectionSearchAllSearched = function (host) {
        return true;
    };
    ChatWindowController.prototype.getConv2WithSpinner = function (session, conv2Section) {
        var sws = this.chatPlugin.sectionsWithSpinner;
        if (sws[session.hostHash] && sws[session.hostHash]["__all__"]) {
            return true;
        }
        if (!sws[session.hostHash]) {
            return false;
        }
        return !!sws[conv2Section.id];
    };
    ChatWindowController.prototype.onFilterMessages = function () {
        this.searchCountFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    ChatWindowController.prototype.onSearchCountFilterUpdate = function () {
        var _this = this;
        var sm = this.app.searchModel.get();
        var searchStr = sm.visible && sm.value && sm.value.length >= ChatMessagesController_1.MessagesFilterUpdater.MIN_CHARS_NUM ? sm.value : "";
        var localSession = this.app.sessionManager.getLocalSession();
        var _loop_1 = function (session) {
            var sections = [];
            this_1.chatPlugin.chatSections[session.hostHash].forEach(function (x) { return sections.push(x); });
            session.conv2Service.collection.list.forEach(function (x) { return sections.push(x.section); });
            sections.forEach(function (section) {
                if (!section) {
                    return;
                }
                var isUserGroup = section.isUserGroup();
                var id = section.getId();
                var count = 0;
                var allSearched = true;
                if (searchStr != "") {
                    var sinkIndex = session.sectionManager.sinkIndexManager.getIndexBySink(section.getChatSink());
                    var seqLoaded = Math.max(0, section.getChatModule().sinkIndex.cursor.seq - ChatMessagesController_1.ChatMessagesController.MESSAGES_TO_LOAD);
                    var conv2Section = isUserGroup ? session.conv2Service.collection.find(function (x) { return x.section && x.section.getId() == id; }) : null;
                    var messagesId = isUserGroup
                        ? _this.getConversationId(session, conv2Section)
                        : _this.getChannelId(session, section);
                    if (messagesId in _this.messages) {
                        seqLoaded = _this.messages[messagesId].takeCollectionSeq;
                    }
                    allSearched = seqLoaded == 0;
                    for (var i = sinkIndex.entries.indexMap.length - 1; i >= seqLoaded; --i) {
                        var idx = sinkIndex.entries.indexMap[i];
                        if (idx === null || idx === undefined) {
                            continue;
                        }
                        var entry = sinkIndex.entries.list[idx];
                        if (!entry || typeof (entry.getMessage) != "function") {
                            continue;
                        }
                        if (_this.chatPlugin.filterMessagesForDisplay(entry) && ChatMessagesController_1.ChatMessagesController.meetsFilter(entry, searchStr)) {
                            count++;
                        }
                    }
                }
                if (isUserGroup) {
                    _this.updateConversationSearchResults(session, id, count, allSearched);
                }
                else {
                    _this.updateChannelSearchResults(session, id, count, allSearched);
                }
            });
            if (session.hostHash != localSession.hostHash) {
                this_1.sidebar.remoteSectionsLists[session.hostHash].sortedCollection.refresh();
                this_1.sidebar.remoteConv2Lists[session.hostHash].sortedCollection.refresh();
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = this.chatPlugin.getReadySessions(); _i < _a.length; _i++) {
            var session = _a[_i];
            _loop_1(session);
        }
        this.sidebar.sectionList.sortedCollection.refresh();
        this.sidebar.conv2List.sortedCollection.refresh();
        this.isSearchOn = searchStr != "";
        this.callViewMethod("changeIsSearchOn", this.isSearchOn);
        return true;
    };
    ChatWindowController.prototype.updateConversationSearchResults = function (session, sectionId, count, allSearched) {
        var convId = session.conv2Service.collection.find(function (x) { return x.section && x.section.getId() == sectionId; }).id;
        var searchResults = this.getSearchResults(session);
        if (convId in searchResults && searchResults[convId].count == count && searchResults[convId].allSearched == allSearched) {
            return;
        }
        searchResults[convId] = { count: count, allSearched: allSearched };
        var isLocalSession = session.hostHash == this.app.sessionManager.getLocalSession().hostHash;
        var collection = isLocalSession ? this.sidebar.conv2List.sortedCollection : (this.sidebar.remoteConv2Lists[session.hostHash] ? this.sidebar.remoteConv2Lists[session.hostHash].sortedCollection : null);
        if (collection) {
            var idx = collection.indexOfBy(function (cm) { return cm.id == convId; });
            if (idx >= 0) {
                collection.triggerUpdateAt(idx);
            }
        }
    };
    ChatWindowController.prototype.updateChannelSearchResults = function (session, sectionId, count, allSearched) {
        var searchResults = this.getSearchResults(session);
        if (sectionId in searchResults && searchResults[sectionId].count == count && searchResults[sectionId].allSearched == allSearched) {
            return;
        }
        searchResults[sectionId] = { count: count, allSearched: allSearched };
        var isLocalSession = session.hostHash == this.app.sessionManager.getLocalSession().hostHash;
        var collection = isLocalSession ? this.sidebar.sectionList.sortedCollection : (this.sidebar.remoteSectionsLists[session.hostHash] ? this.sidebar.remoteSectionsLists[session.hostHash].sortedCollection : null);
        if (collection) {
            var idx = collection.indexOfBy(function (cm) { return cm.getId() == sectionId; });
            if (idx >= 0) {
                collection.triggerUpdateAt(idx);
            }
        }
    };
    ChatWindowController.prototype.getSearchResults = function (session) {
        if (!this.searchResults[session.hostHash]) {
            this.searchResults[session.hostHash] = {};
        }
        return this.searchResults[session.hostHash];
    };
    ChatWindowController.prototype.onChatUpdateSearchStatsEvent = function (event) {
        var session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
        if (!session) {
            return;
        }
        var sectionId = event.sectionId;
        var section = this.chatPlugin.chatSections[session.hostHash].find(function (x) { return x.getId() == sectionId; });
        var count = event.searchCount;
        var allSearched = event.allSearched;
        if (!section) {
            return;
        }
        if (section.isUserGroup()) {
            this.updateConversationSearchResults(session, sectionId, count, allSearched);
        }
        else {
            this.updateChannelSearchResults(session, sectionId, count, allSearched);
        }
    };
    ChatWindowController.prototype.handleFilePaste = function (element) {
        var _this = this;
        if (pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES in element.data && this.activeMessages) {
            this.activeMessages.tryPaste(element, "text" in element.data ? element.data.text : null);
            return true;
        }
        else if (element.data.file && element.data.file.element instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
            var osf_1 = element.data.file.element;
            osf_1.getBuffer().then(function (buff) {
                _this.activeMessages.pasteFile(osf_1.mimeType, buff, osf_1.path);
            });
            return true;
        }
        else if (element.data.files && element.data.files.filter(function (x) { return !x || !(x.element instanceof pmc_mail_1.mail.section.OpenableSectionFile); }).length == 0) {
            var prom_1 = pmc_mail_1.Q();
            element.data.files.forEach(function (x) {
                var osf = x.element;
                prom_1 = prom_1.then(function () {
                    return osf.getBuffer().then(function (buff) {
                        return _this.activeMessages.pasteFile(osf.mimeType, buff, osf.path);
                    });
                });
            });
            return true;
        }
        return false;
    };
    ChatWindowController.prototype.refreshActivePanelThumbs = function () {
        if (this.activeMessages && this.activeMessages.thumbs) {
            this.activeMessages.thumbs.processThumbs();
        }
    };
    ChatWindowController.prototype.areAnySectionsExceptPrivate = function () {
        var sectionsCount = this.chatPlugin.chatRootSections[this.app.sessionManager.getLocalSession().hostHash].list.filter(function (x) { return !x.isPrivate(); }).length;
        var conversationsCount = this.chatPlugin.conv2Service.collection.list.length;
        return sectionsCount > 0 || conversationsCount > 0;
    };
    var ChatWindowController_1;
    ChatWindowController.textsPrefix = "plugin.chat.window.chat.";
    ChatWindowController.MY_PRIVATE = "my";
    __decorate([
        Inject
    ], ChatWindowController.prototype, "identity", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "personService", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "sinkIndexManager", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "messageService", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "sectionManager", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "conv2Service", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "localStorage", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "collectionFactory", void 0);
    __decorate([
        Inject
    ], ChatWindowController.prototype, "contactService", void 0);
    ChatWindowController = ChatWindowController_1 = __decorate([
        Dependencies(["chatmessages", "conv2list", "remoteconv2list", "remotesectionlist", "persons", "extlist", "splitter", "sectionlist", "sectionstabs", "sidebar", "privateconversations", "nosections", "videoconference"])
    ], ChatWindowController);
    return ChatWindowController;
}(pmc_mail_1.window.base.BaseAppWindowController));
exports.ChatWindowController = ChatWindowController;
ChatWindowController.prototype.className = "com.privmx.plugin.chat.window.chat.ChatWindowController";

//# sourceMappingURL=ChatWindowController.js.map
