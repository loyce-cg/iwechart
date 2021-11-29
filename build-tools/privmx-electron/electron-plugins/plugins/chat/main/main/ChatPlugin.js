"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
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
var Mail = require("pmc-mail");
var Q = Mail.Q;
var UsersGroupApi_1 = require("./UsersGroupApi");
var ChatMessagesController_1 = require("../component/chatmessages/ChatMessagesController");
var ChatsCollection_1 = require("./ChatsCollection");
var ChatMessage_1 = require("./ChatMessage");
var index_1 = require("../i18n/index");
var MessagesMarkerQueue_1 = require("./MessagesMarkerQueue");
var VideoConferenceWindowController_1 = require("../window/videoConference/VideoConferenceWindowController");
var Logger = Mail.Logger.get("privfs-chat-plugin.ChatPlugin");
var ChatPlugin = (function () {
    function ChatPlugin(app) {
        this.app = app;
        this.chatSections = {};
        this.chatPrimarySections = {};
        this.chatRootSections = {};
        this.isGloballyMuted = false;
        this.mailStats = {};
        this.messageFlagsUpdater = {};
        this.messagesMarkerQueue = {};
        this.sectionsWithSpinner = {};
        this.currentVideoConferenceWindowController = null;
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
            "left-voicechat",
            "video-conference-start",
            "video-conference-end",
            "video-conference-gong",
        ];
        this.validMessageTypesForUnread = [
            Mail.mail.section.ChatModuleService.CHAT_MESSAGE_TYPE
        ];
        this.validMessageJsonTypesForUnread = [
            "",
            "video-conference-gong",
        ];
    }
    ChatPlugin.prototype.reset = function () {
        this.chatSections = {};
        this.chatPrimarySections = {};
        this.chatRootSections = {};
        this.usersGroupApi = null;
        this.loadChannelsPromise = null;
        this.onLoginPromise = null;
        this.chatUnreadCountModel.setWithCheck(0);
        this.chatUnreadCountFullyLoadedModel.setWithCheck(false);
        this.sectionsWithSpinner = {};
    };
    ChatPlugin.prototype.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, "plugin.chat.");
    };
    ChatPlugin.prototype.isNotes2PluginPresent = function () {
        return this.notes2PluginPresent;
    };
    ChatPlugin.prototype.isTasksPluginPresent = function () {
        return this.tasksPluginPresent;
    };
    ChatPlugin.prototype.addValidMessageTypeForDisplay = function (type) {
        Mail.utils.Lang.uniqueAdd(this.validMessageTypesForDisplay, type);
        this.app.dispatchEvent({
            type: "chatvalidmessagetypefordisplaychange"
        });
    };
    ChatPlugin.prototype.addValidMessageJsonTypeForDisplay = function (jsonType) {
        Mail.utils.Lang.uniqueAdd(this.validMessageJsonTypesForDisplay, jsonType);
        this.app.dispatchEvent({
            type: "chatvalidmessagetypefordisplaychange"
        });
    };
    ChatPlugin.prototype.addValidMessageTypeForUnread = function (type) {
        Mail.utils.Lang.uniqueAdd(this.validMessageTypesForUnread, type);
        this.refreshChatUnreadCount();
        this.app.dispatchEvent({
            type: "chatvalidmessagetypeforunreadchange"
        });
    };
    ChatPlugin.prototype.addValidMessageJsonTypeForUnread = function (jsonType) {
        Mail.utils.Lang.uniqueAdd(this.validMessageJsonTypesForUnread, jsonType);
        this.refreshChatUnreadCount();
        this.app.dispatchEvent({
            type: "chatvalidmessagetypeforunreadchange"
        });
    };
    ChatPlugin.prototype.filterMessagesForDisplay = function (entry) {
        if (this.validMessageTypesForDisplay.indexOf(entry.source.data.type) == -1) {
            return false;
        }
        if (entry.source.data.contentType != "application/json") {
            return true;
        }
        var data = entry.getContentAsJson();
        var jsonType = data && data.type ? data.type : "";
        return this.validMessageJsonTypesForDisplay.indexOf(jsonType) != -1;
    };
    ChatPlugin.prototype.initSessionSpecificFields = function () {
        this.mailStats = {};
        this.messageFlagsUpdater = {};
        this.messagesMarkerQueue = {};
    };
    ChatPlugin.prototype.onLogin = function () {
        var _this = this;
        if (this.onLoginPromise == null) {
            this.onLoginPromise = Q().then(function () {
                return Q.all([
                    Q.all([
                        _this.app.mailClientApi.privmxRegistry.getConversationService(),
                        _this.app.mailClientApi.privmxRegistry.getUserPreferences(),
                        _this.app.mailClientApi.privmxRegistry.getSrpSecure(),
                        _this.app.mailClientApi.privmxRegistry.getSinkIndexManager(),
                        _this.app.mailClientApi.privmxRegistry.getPersonService(),
                        _this.app.mailClientApi.privmxRegistry.getIdentity()
                    ]),
                    Q.all([
                        _this.app.mailClientApi.privmxRegistry.getContactService(),
                        _this.app.mailClientApi.privmxRegistry.getUtilApi(),
                        _this.app.mailClientApi.privmxRegistry.getSectionManager(),
                        _this.app.mailClientApi.privmxRegistry.getCollectionFactory(),
                        _this.app.mailClientApi.privmxRegistry.getConv2Service(),
                        _this.app.mailClientApi.privmxRegistry.getMailStats()
                    ]),
                    Q.all([
                        _this.app.mailClientApi.privmxRegistry.getMessageFlagsUpdater(),
                        _this.app.mailClientApi.privmxRegistry.getServerProxyService()
                    ]),
                ]);
            })
                .then(function (res) {
                var hostHash = _this.app.sessionManager.getLocalSession().hostHash;
                _this.conversationService = res[0][0];
                _this.userPreferences = res[0][1];
                _this.srpSecure = res[0][2];
                _this.sinkIndexManager = res[0][3];
                _this.personService = res[0][4];
                _this.identity = res[0][5];
                _this.contactService = res[1][0];
                _this.utilApi = res[1][1];
                _this.sectionManager = res[1][2];
                _this.collectionFactory = res[1][3];
                _this.conv2Service = res[1][4];
                _this.messageFlagsUpdater[hostHash] = res[2][0];
                _this.messagesMarkerQueue[hostHash] = new MessagesMarkerQueue_1.MessagesMarkerQueue(_this.messageFlagsUpdater[hostHash], function () { });
                _this.usersGroupApi = new UsersGroupApi_1.UsersGroupApi(_this.srpSecure);
                _this.serverProxyService = res[2][1];
                var mailStats = res[1][5];
                if (mailStats) {
                    _this.mailStats[mailStats.hostHash || _this.app.sessionManager.getLocalSession().hostHash] = mailStats;
                }
                ChatPlugin.contactService = _this.contactService;
                _this.validMessageJsonTypesForDisplay = _this.getValidMessagesTypesFromGUISettings(_this.getGUISettings());
                if (_this.mailPlugin) {
                    _this.mailPlugin.addToRawConverter(_this.convertToChatRawEntry.bind(_this));
                    _this.mailPlugin.addCollectionGetter(function (sid) {
                        var messagesFromSink = new Mail.utils.collection.FilteredCollection(_this.collectionFactory.getMessagesCollectionBySid(sid), function (entry) {
                            return ChatMessage_1.ChatMessage.isChatMessage(entry);
                        });
                        return new ChatsCollection_1.ChatsCollection(_this.personService, _this.conversationService, messagesFromSink).getCollection();
                    });
                }
            })
                .then(function () {
                _this.serverProxyService.prepareCollection();
            });
        }
        return this.onLoginPromise;
    };
    ChatPlugin.prototype.refreshChatUnreadCount = function (mailStats) {
        if (!this.sinkIndexManager) {
            return;
        }
        if (!this.mailStats) {
            return;
        }
        if (mailStats) {
            this.mailStats[mailStats.hostHash] = mailStats;
        }
        var count = 0;
        for (var _i = 0, _a = this.getReadySessions(); _i < _a.length; _i++) {
            var session = _a[_i];
            var ms = this.mailStats[session.hostHash];
            if (!ms) {
                continue;
            }
            var inboxes = session.sectionManager.sinkIndexManager.getAllIndexesBySinkType("inbox").map(function (x) { return x.sink.id; });
            var allIndexes = session.sectionManager.sinkIndexManager.getAllIndexes();
            var allIndexesIds = [];
            for (var idxId in allIndexes) {
                if (session.sectionManager.getSectionBySinkIndex(allIndexes[idxId])) {
                    allIndexesIds.push(idxId);
                }
            }
            var map = ms.map;
            for (var sid in map) {
                if (inboxes.indexOf(sid) >= 0) {
                    continue;
                }
                if (allIndexesIds.indexOf(sid) < 0) {
                    continue;
                }
                if (this.isChannelMuted(session, sid) || !map[sid].index.includeStatsToCombined()) {
                    continue;
                }
                var stats = map[sid].stats.getStats();
                count += this.getUnreadCountFromStats(stats);
            }
        }
        this.chatUnreadCountModel.setWithCheck(count);
    };
    ChatPlugin.prototype.getSessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            sessions.push(session);
        }
        return sessions;
    };
    ChatPlugin.prototype.getReadySessions = function () {
        var sessions = [];
        for (var hostHash in this.app.sessionManager.sessions) {
            var session = this.app.sessionManager.sessions[hostHash];
            if ((!session.initPromise || session.initPromise.isFulfilled()) && (!session.loadingPromise || session.loadingPromise.isFulfilled())) {
                sessions.push(session);
            }
        }
        return sessions;
    };
    ChatPlugin.prototype.getUnreadMessages = function (session, projectId) {
        var _this = this;
        var sectionId = null;
        if (projectId) {
            if (projectId.indexOf("c2:") == 0) {
                var conversation = session.conv2Service.collection.find(function (x) { return x.id == projectId; });
                if (conversation && conversation.section) {
                    sectionId = conversation.section.getId();
                }
            }
            else {
                sectionId = projectId;
            }
        }
        var messages = [];
        var prom = Q();
        session.sectionManager.sectionsCollection.forEach(function (section) {
            if (sectionId && section.getId() != sectionId) {
                return;
            }
            prom = prom.then(function () {
                return section.getChatModule().getSinkIndex().then(function (sinkIndex) {
                    sinkIndex.entries.list.forEach(function (x) {
                        if (_this.filterMessagesForDisplay(x) && ChatMessagesController_1.ChatMessagesController.isUnread(x)) {
                            messages.push(x);
                        }
                    });
                });
            });
        });
        return prom.thenResolve(messages);
    };
    ChatPlugin.prototype.getUnreadCountFromStats = function (stats) {
        var _this = this;
        if (stats == null) {
            return 0;
        }
        var count = 0;
        var validMessageJsonTypesForUnread = this.validMessageJsonTypesForUnread.filter(function (x) { return x == "" || _this.validMessageJsonTypesForDisplay.indexOf(x) >= 0; });
        this.validMessageTypesForUnread.forEach(function (type) {
            if (!stats.byType[type]) {
                return;
            }
            validMessageJsonTypesForUnread.forEach(function (jsonType) {
                count += stats.byType[type].byJsonType[jsonType] ? stats.byType[type].byJsonType[jsonType].unread : 0;
            });
        });
        return count;
    };
    ChatPlugin.prototype.onSendFileToChannel = function (channelId) {
        if (this.actionOnSendFileToChannel) {
            this.actionOnSendFileToChannel(channelId);
            return true;
        }
        return false;
    };
    ChatPlugin.prototype.convertToChatRawEntry = function (session, chatEntry) {
        if (chatEntry.getEntryType() != "chat") {
            return false;
        }
        if (chatEntry.lastEntry == null) {
            return {
                id: chatEntry.getEntryId(),
                type: "chat-plugin-chat-entry",
                broken: true
            };
        }
        var isOutbox = chatEntry.lastEntry.index.sink.extra.type == "outbox";
        var isTrash = chatEntry.lastEntry.index.sink.extra.type == "trash";
        var showSenderPicture = !isOutbox && !isTrash;
        var showReceiverPicture = isOutbox;
        var persons = chatEntry.conversationId.split(",").map(function (hashmail) {
            var person = session.conv2Service.personService.getPerson(hashmail);
            return {
                hashmail: person.getHashmail(),
                name: person.getName()
            };
        });
        var sender = session.conv2Service.personService.getPerson(chatEntry.lastEntry.source.data.sender.hashmail);
        var receivers = chatEntry.lastEntry.source.data.receivers.map(function (r) {
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
    };
    ChatPlugin.prototype.isMailMessage = function (entry) {
        return this.mailPlugin ? this.mailPlugin.constructor.isMailMessage(entry) : (!entry.source.data.type || entry.source.data.type == "pki-event");
    };
    ChatPlugin.prototype.getSinkIndexByWif = function (wif) {
        var en = this.sinkIndexManager.getAllIndexes();
        for (var id in en) {
            if (en[id].sink.privWif == wif) {
                return en[id];
            }
        }
        return null;
    };
    ChatPlugin.prototype.prepareSession = function (session) {
        var _this = this;
        return Q.all([
            session.mailClientApi.privmxRegistry.getMessageFlagsUpdater(),
        ])
            .then(function (res) {
            _this.chatSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) { return !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && !x.sectionData.primary; });
            _this.chatSections[session.hostHash].changeEvent.add(_this.onAnySectionChange.bind(_this));
            _this.chatPrimarySections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.filteredCollection, function (x) { return !x.isPrivateOrUserGroup() && x.isVisible() && x.hasAccess() && x.sectionData.primary; });
            _this.chatPrimarySections[session.hostHash].changeEvent.add(_this.onAnySectionChange.bind(_this));
            _this.chatRootSections[session.hostHash] = new Mail.utils.collection.FilteredCollection(session.sectionManager.rootSectionsCollection, function (x) { return !x.isPrivateOrUserGroup() && x.isChatModuleEnabled(true); });
            _this.chatRootSections[session.hostHash].changeEvent.add(_this.onAnySectionChange.bind(_this));
            _this.messageFlagsUpdater[session.hostHash] = res[0];
            _this.messagesMarkerQueue[session.hostHash] = new MessagesMarkerQueue_1.MessagesMarkerQueue(_this.messageFlagsUpdater[session.hostHash], function () { });
        });
    };
    ChatPlugin.prototype.loadChannels = function () {
        var _this = this;
        if (this.app.mailClientApi == null) {
            return Q();
        }
        return this.app.mailClientApi.lazyLoader.registerWithDeps("loadChannels", {}, function () {
            if (_this.loadChannelsPromise == null) {
                _this.initSessionSpecificFields();
                _this.loadChannelsPromise = Q().then(function () {
                    return _this.onLogin();
                })
                    .then(function () {
                    return _this.app.mailClientApi.prepareSectionManager();
                })
                    .then(function () {
                    var localSession = _this.app.sessionManager.getSession(_this.identity.host);
                    return _this.prepareSession(localSession);
                })
                    .then(function () {
                    _this.sectionManager.filteredCollection.changeEvent.add(_this.onChatSectionChange.bind(_this));
                    _this.userPreferences.eventDispatcher.addEventListener("userpreferenceschange", _this.onUserPreferencesChange.bind(_this));
                    _this.chatChannelsSettings = _this.getChannelsSettings();
                    _this.isGloballyMuted = _this.userPreferences.isGloballyMuted();
                    var promises = [];
                    _this.sectionManager.filteredCollection.forEach(function (section) {
                        if (section.hasChatModule()) {
                            promises.push(section.getChatSinkIndex()
                                .then(function (sinkIndex) {
                                if (section.isUserGroup()) {
                                    return _this.conv2Service.addSection(section).prepareMessagesCollection();
                                }
                            }));
                        }
                    });
                    return Q.all(promises).thenResolve(null);
                })
                    .then(function () {
                    _this.app.addEventListener("mark-as-read", function (event) {
                        var sessions = event.hostHash ? [_this.app.sessionManager.getSessionByHostHash(event.hostHash)] : _this.getReadySessions();
                        if (event.moduleName == "chat" || !event.moduleName) {
                            var projectId_1 = event.sectionId || event.conversationId || event.customElementId;
                            Q().then(function () {
                                _this.app.dispatchEvent({
                                    type: "set-bubbles-state",
                                    markingAsRead: true,
                                    scope: event,
                                });
                                var def = Q.defer();
                                setTimeout(function () { return def.resolve(); }, 300);
                                return def.promise;
                            }).then(function () {
                                return Q.all([sessions.map(function (session) { return _this.markAllAsRead(session, projectId_1); })]);
                            })
                                .fin(function () {
                                _this.app.dispatchEvent({
                                    type: "set-bubbles-state",
                                    markingAsRead: false,
                                    scope: event,
                                });
                                _this.app.dispatchEvent({
                                    type: "marked-chats-as-read",
                                    projectId: projectId_1,
                                    hostHash: event.hostHash,
                                });
                            });
                        }
                    });
                    _this.app.addEventListener("set-bubbles-state", function (e) {
                        if (e.scope.moduleName && e.scope.moduleName != "chat") {
                            return;
                        }
                        var newState = e.markingAsRead;
                        var hostHash = e.scope.hostHash;
                        var id = e.scope.conversationId || e.scope.customElementId || e.scope.sectionId || "__all__";
                        if (hostHash) {
                            if (!_this.sectionsWithSpinner[hostHash]) {
                                _this.sectionsWithSpinner[hostHash] = {};
                            }
                            _this.sectionsWithSpinner[hostHash][id] = newState;
                        }
                        else {
                            for (var hh in _this.sectionsWithSpinner) {
                                _this.sectionsWithSpinner[hh][id] = newState;
                            }
                        }
                        _this.app.dispatchEvent({
                            type: "update-chat-sidebar-spinners",
                            conv2SectionId: e.scope.conversationId || undefined,
                            customElementId: e.scope.customElementId || undefined,
                            sectionId: e.scope.sectionId || undefined,
                            hostHash: e.scope.hostHash || undefined,
                        });
                    });
                    _this.app.addEventListener("join-video-conference", function (event) {
                        _this.openVideoConferenceWindow(event);
                    });
                });
            }
            _this.loadChannelsPromise.then(function () {
                _this.chatUnreadCountFullyLoadedModel.setWithCheck(true);
            });
            return _this.loadChannelsPromise;
        });
    };
    ChatPlugin.prototype.getChannelsSettings = function () {
        var settings = this.userPreferences.getValue(ChatPlugin.CHANNELS_SETTINGS_KEY);
        if (settings) {
            var sessMgr = this.app.sessionManager;
            for (var _i = 0, settings_1 = settings; _i < settings_1.length; _i++) {
                var setting = settings_1[_i];
                var session = setting.hostHash && sessMgr.isSessionExistsByHostHash(setting.hostHash) ? sessMgr.getSessionByHostHash(setting.hostHash) : sessMgr.getLocalSession();
                var sectionManager = session.sectionManager || this.sectionManager;
                var section = sectionManager.getSection(setting.id);
                if (section) {
                    var sink = section.getChatSink();
                    if (sink) {
                        setting.sinkId = section.getChatSink().id;
                    }
                }
            }
        }
        return settings;
    };
    ChatPlugin.prototype.getGUISettings = function () {
        var rawSettings = this.userPreferences.getValue(ChatPlugin.GUI_SETTINGS_KEY);
        var settings;
        if (!rawSettings) {
            settings = this.getDefaultGUISettings();
            this.updateGUISettings(settings).fail(function () { return Logger.error("Error during saving default GUI settings."); });
            return settings;
        }
        settings = JSON.parse(rawSettings);
        if (!settings) {
            settings = {};
        }
        settings = __assign({}, this.getDefaultGUISettings(), settings);
        return settings;
    };
    ChatPlugin.prototype.getDefaultGUISettings = function () {
        var settings = {};
        this.validMessageJsonTypesForDisplay.forEach(function (x) {
            settings[x] = false;
        });
        settings["create-file"] = true;
        settings["video-conference-gong"] = true;
        return settings;
    };
    ChatPlugin.prototype.getViewSettings = function () {
        var rawSettings = this.userPreferences.getValue(ChatPlugin.VIEW_SETTINGS_KEY);
        var settings;
        if (!rawSettings) {
            settings = this.getDefaultViewSettings();
            this.updateViewSettings(settings).fail(function () { return Logger.error("Error during saving default view settings."); });
            return settings;
        }
        var defaults = this.getDefaultViewSettings();
        settings = JSON.parse(rawSettings);
        if (!settings) {
            settings = {};
        }
        for (var k in defaults) {
            if (!(k in settings)) {
                settings[k] = defaults[k];
            }
        }
        return settings;
    };
    ChatPlugin.prototype.getDefaultViewSettings = function () {
        var settings = {
            "invert-message-backgrounds": false,
            "hide-usernames": false,
            "show-search-contexts": false,
        };
        return settings;
    };
    ChatPlugin.prototype.getShowSearchContexts = function () {
        return !!this.getViewSettings()["show-search-contexts"];
    };
    ChatPlugin.prototype.updateViewSettings = function (settings) {
        return this.userPreferences.set(ChatPlugin.VIEW_SETTINGS_KEY, JSON.stringify(settings), true);
    };
    ChatPlugin.prototype.onAnySectionChange = function (event) {
        this.refreshChatUnreadCount();
    };
    ChatPlugin.prototype.onChatSectionChange = function (event) {
        var _this = this;
        if (event.type == "remove") {
            return;
        }
        if (event.element != null) {
            if (event.element.hasChatModule()) {
                event.element.getChatSinkIndex()
                    .then(function (sinkIndex) {
                    if (event.element.isUserGroup()) {
                        if (_this.activeMessages && _this.activeMessages.chatInfo && _this.activeMessages.chatInfo.conversation && _this.activeMessages.chatInfo.conversation.section && _this.activeMessages.chatInfo.conversation.section.getId() == event.element.getId()) {
                            _this.activeSinkId = event.element.getChatSink().id;
                            _this.activeSinkHostHash = (_this.activeMessages && _this.activeMessages.session ? _this.activeMessages.session.hostHash : null) || _this.app.sessionManager.getLocalSession().hostHash;
                        }
                        return _this.conv2Service.addSection(event.element).prepareMessagesCollection();
                    }
                })
                    .fail(function (e) {
                    Logger.error("Error during loading chat sink", event.element, e);
                });
            }
        }
    };
    ChatPlugin.prototype.onUserPreferencesChange = function () {
        this.chatChannelsSettings = this.getChannelsSettings();
        this.isGloballyMuted = this.userPreferences.isGloballyMuted();
        this.refreshChatUnreadCount();
    };
    ChatPlugin.prototype.updateGUISettings = function (settings) {
        this.validMessageJsonTypesForDisplay = this.getValidMessagesTypesFromGUISettings(settings);
        this.app.dispatchEvent({
            type: "chatvalidmessagetypefordisplaychange",
        });
        return this.userPreferences.set(ChatPlugin.GUI_SETTINGS_KEY, JSON.stringify(settings), true);
    };
    ChatPlugin.prototype.onBeforeSinkIndexEntryAdd = function (entry) {
        if (entry.source.data.sender.pub58 == this.identity.pub58) {
            entry.addMods([{
                    type: "setFlag",
                    name: "read",
                    value: true
                }]);
        }
    };
    ChatPlugin.prototype.isChannelMuted = function (session, sinkId, moduleName) {
        if (moduleName === void 0) { moduleName = Mail.Types.section.NotificationModule.CHAT; }
        var sink = session.sectionManager.sinkIndexManager ? session.sectionManager.sinkIndexManager.getSinkById(sinkId) : null;
        if (sink && sink.name && sink.name.indexOf("<usergroup:") >= 0) {
            return false;
        }
        if (!this.chatChannelsSettings) {
            return false;
        }
        var muted = false;
        for (var i = 0; i < this.chatChannelsSettings.length; i++) {
            var settings = this.chatChannelsSettings[i];
            var settingsHostHash = settings.hostHash || this.app.sessionManager.getLocalSession().hostHash;
            if (session.hostHash == settingsHostHash && sinkId == settings.sinkId && settings.mutedModules && moduleName in settings.mutedModules) {
                muted = settings.mutedModules[moduleName];
                break;
            }
        }
        return muted;
    };
    ChatPlugin.prototype.isChannelFiltered = function (session, sinkId, moduleName) {
        if (moduleName === void 0) { moduleName = Mail.Types.section.NotificationModule.CHAT; }
        var filtered = this.isChannelMuted(session, sinkId, moduleName) || ((this.activeSinkId === sinkId) && (this.activeSinkHostHash === session.hostHash) && this.activeWindowFocused === moduleName);
        return filtered;
    };
    ChatPlugin.getPersonModel = function (person, session) {
        var contactService = session && session.conv2Service && session.conv2Service.contactService ? session.conv2Service.contactService : ChatPlugin.contactService;
        return {
            hashmail: person.getHashmail(),
            username: person.username,
            name: person.hasContact() && person.contact.hasName() ? person.contact.getDisplayName() : "",
            description: person.getDescription(),
            present: person.isPresent(),
            deleted: contactService.deletedUsers.indexOf(person.usernameCore) >= 0,
        };
    };
    ChatPlugin.prototype.openTask = function (session, _sectionId, id, scrollToComments) {
        if (scrollToComments === void 0) { scrollToComments = false; }
        var tasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksPlugin) {
            return;
        }
        tasksPlugin.openEditTaskWindow(session, id, true, scrollToComments);
    };
    ChatPlugin.prototype.getValidMessagesTypesFromGUISettings = function (settings) {
        var arr = ["joined-voicechat", "left-voicechat", "video-conference-start", "video-conference-end"];
        for (var key in settings) {
            if (settings[key] == true) {
                arr.push(key);
            }
        }
        return arr;
    };
    ChatPlugin.prototype.onPollingResult = function (entries) {
        this.notifyUser(entries);
    };
    ChatPlugin.prototype.isPollingItemComingFromMe = function (item) {
        if (item.entry) {
            var session = this.app.sessionManager.getSession(item.entry.host);
            var message = item.entry.getMessage();
            if (message.sender.pub58 == session.userData.identity.pub58) {
                return true;
            }
        }
        return false;
    };
    ChatPlugin.prototype.getContextFromSinkId = function (session, sinkId) {
        var section = null;
        session.sectionManager.filteredCollection.list.forEach(function (x) {
            var sink = x.getChatSink();
            if (sink && sinkId == sink.id) {
                section = x;
                return;
            }
        });
        if (section) {
            var sectionId_1 = section.getId();
            var conv2Id_1;
            if (sectionId_1.indexOf("usergroup") >= 0) {
                session.conv2Service.collection.list.forEach(function (x) {
                    if (x.section && x.section.getId() == sectionId_1) {
                        conv2Id_1 = x.id;
                        return;
                    }
                });
                return conv2Id_1;
            }
            return "section:" + sectionId_1;
        }
        return null;
    };
    ChatPlugin.prototype.decodeStickerFromSinkId = function (session, sinkId, sticker) {
        var section = null;
        session.sectionManager.filteredCollection.list.forEach(function (x) {
            if (sinkId == x.getChatSink().id) {
                section = x;
                return;
            }
        });
        if (section) {
            var sectionId = section.getId();
            return session.sectionManager.getSection(sectionId).stickersService.decodeSticker(sticker);
        }
        return null;
    };
    ChatPlugin.prototype.notifyUser = function (data) {
        var _this = this;
        if (data.length == 0) {
            return;
        }
        var allowedMessages = data.filter(function (x) {
            return x.entry.source.data.contentType == "html"
                || x.entry.source.data.contentType == "text"
                || (x.entry.source.data.contentType == "application/json") && x.newStickers && x.newStickers.length > 0
                || _this.isVideoConferenceGongMessage(x)
                || _this.isVideoConferenceStartMessage(x);
        });
        if (allowedMessages) {
            allowedMessages.forEach(function (x) {
                if (!_this.app.sessionManager.isSessionExistsByHost(x.entry.host)) {
                    return;
                }
                var isVideoConferenceGongMessage = _this.isVideoConferenceGongMessage(x);
                var isVideoConferenceStartMessage = _this.isVideoConferenceStartMessage(x);
                var session = _this.app.sessionManager.getSession(x.entry.host);
                if (!isVideoConferenceGongMessage && (_this.isChannelFiltered(session, x.entry.index.sink.id, x.entry.getModule()) || _this.isChannelMuted(session, x.entry.index.sink.id, x.entry.getModule()))) {
                    return;
                }
                var message = x.entry.getMessage();
                var isEmojiMessage = x.newStickers && x.newStickers.length > 0;
                var isJsonMessage = message.contentType == "application/json";
                if (isJsonMessage && !isEmojiMessage && !isVideoConferenceGongMessage && !isVideoConferenceStartMessage) {
                    return;
                }
                var context = _this.getContextFromSinkId(session, x.entry.sink.id);
                if (isEmojiMessage) {
                    var identity_1 = session.userData.identity;
                    if (message.sender.pub58 == identity_1.pub58) {
                        var stickers = x.newStickers;
                        stickers.forEach(function (sticker) {
                            if (identity_1.user == sticker.u) {
                                return;
                            }
                            var fileName = null;
                            if (isJsonMessage) {
                                fileName = JSON.parse(message.text).path;
                                fileName = fileName.substr(fileName.lastIndexOf("/") + 1);
                            }
                            var event = { type: "notifyUser", options: {
                                    sender: sticker.u,
                                    tray: false,
                                    sound: true,
                                    tooltip: true,
                                    tooltipOptions: {
                                        title: "",
                                        text: _this.getMarkedNotificationText(isJsonMessage ? fileName : message.text),
                                        sender: sticker.u,
                                        withAvatar: false,
                                        withUserName: true,
                                        withSticker: _this.decodeStickerFromSinkId(session, x.entry.sink.id, sticker.s)
                                    },
                                    context: {
                                        module: Mail.Types.section.NotificationModule.CHAT,
                                        sinkId: context,
                                        hostHash: session.hostHash,
                                    },
                                } };
                            _this.app.dispatchEvent(event);
                        });
                    }
                }
                else {
                    if (_this.isPollingItemComingFromMe(x)) {
                        return;
                    }
                    var tooltipText = void 0;
                    if (isVideoConferenceGongMessage) {
                        var section = session.sectionManager.getSectionBySinkId(x.entry.index.sink.id);
                        tooltipText = _this.app.localeService.i18n("plugin.chat.notifications.videoConferenceGong", section.getFullSectionName(true, false, false));
                        tooltipText = _this.notificationTextEllipsis(tooltipText);
                    }
                    else if (isVideoConferenceStartMessage) {
                        var videoConferenceTitle = JSON.parse(message.text).conferenceTitle;
                        if (videoConferenceTitle) {
                            tooltipText = _this.app.localeService.i18n("plugin.chat.notifications.videoConferenceStart.withTitle", videoConferenceTitle);
                        }
                        else {
                            tooltipText = _this.app.localeService.i18n("plugin.chat.notifications.videoConferenceStart.withoutTitle");
                        }
                        tooltipText = _this.notificationTextEllipsis(tooltipText);
                    }
                    else {
                        tooltipText = _this.prepareMessageForNotification(message.text);
                    }
                    var event_1 = { type: "notifyUser", options: {
                            sender: message.sender.hashmail,
                            tray: true,
                            sound: true,
                            tooltip: true,
                            ignoreSilentMode: false,
                            tooltipOptions: {
                                title: "",
                                text: tooltipText,
                                sender: message.sender.hashmail,
                                withAvatar: true,
                                withUserName: true
                            },
                            context: {
                                module: Mail.Types.section.NotificationModule.CHAT,
                                sinkId: context,
                                hostHash: session.hostHash,
                            },
                            overrideSoundCategoryName: isVideoConferenceGongMessage || isVideoConferenceStartMessage ? "gong" : null,
                        } };
                    _this.app.dispatchEvent(event_1);
                }
            });
        }
    };
    ChatPlugin.prototype.notificationTextEllipsis = function (text) {
        var maxLength = this.app.getNotificationTitleMaxLength();
        if (text.length > maxLength) {
            var ellipsis = this.app.getNotificationTitleEllipsis().trim();
            text = text.substr(0, maxLength - ellipsis.length) + ellipsis;
        }
        return text;
    };
    ChatPlugin.prototype.isVideoConferenceGongMessage = function (msg) {
        if (msg.entry.source.data.contentType != "application/json") {
            return false;
        }
        var content = msg.entry.getContentAsJson();
        return content && content.type == "video-conference-gong";
    };
    ChatPlugin.prototype.isVideoConferenceStartMessage = function (msg) {
        if (msg.entry.source.data.contentType != "application/json") {
            return false;
        }
        var content = msg.entry.getContentAsJson();
        return content && content.type == "video-conference-start";
    };
    ChatPlugin.prototype.getMarkedNotificationText = function (msgText) {
        var maxLength = this.app.getNotificationTitleMaxLength();
        var ellipsis = this.app.getNotificationTitleEllipsis().trim();
        var basicText = this.app.localeService.i18n("plugin.chat.notifications.marked", "{0}");
        var basicTextLength = basicText.length - 3;
        var msgTextMaxLength = maxLength - basicTextLength;
        msgText = msgText.replace(/<[^>]+>/g, "");
        if (msgText.length > msgTextMaxLength) {
            msgText = msgText.substr(0, msgTextMaxLength - ellipsis.length) + ellipsis;
        }
        return basicText.replace("{0}", msgText);
    };
    ChatPlugin.prototype.prepareMessageForNotification = function (text) {
        var lines = text.split("<br>");
        var inQuote = false;
        var newLines = [];
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            if (line.startsWith("@<privmx-quote-header")) {
                inQuote = true;
            }
            else if (inQuote) {
                if (!line.startsWith("&gt;")) {
                    inQuote = false;
                }
            }
            if (!inQuote) {
                newLines.push(line);
            }
        }
        var newText = newLines.join(" ").replace(/<[^>]*>/g, "").trim();
        if (newText.length == 0) {
            newText = text;
        }
        return newText;
    };
    ChatPlugin.prototype.markAllAsRead = function (session, projectId) {
        var _this = this;
        return this.getUnreadMessages(session, projectId).then(function (messages) {
            return _this.messagesMarkerQueue[session.hostHash].add(messages, 0);
        });
    };
    ChatPlugin.prototype.openVideoConferenceWindow = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var hasMicRights, hasCameraRights;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.app.askForMicrophoneAccess()];
                    case 1:
                        hasMicRights = _a.sent();
                        return [4, this.app.askForCameraAccess()];
                    case 2:
                        hasCameraRights = _a.sent();
                        if (!(!hasMicRights || !hasCameraRights)) return [3, 4];
                        return [4, this.openNoMediaAlert()];
                    case 3:
                        _a.sent();
                        return [3, 6];
                    case 4: return [4, this.app.openSingletonWindow("videoconference", VideoConferenceWindowController_1.VideoConferenceWindowController, event)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [2];
                }
            });
        });
    };
    ChatPlugin.prototype.openNoMediaAlert = function () {
        return __awaiter(this, void 0, void 0, function () {
            var confirmResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.app.msgBox.confirmEx({
                            message: this.app.localeService.i18n("plugin.chat.videoconf.media.access.refused.darwin"),
                            yes: {
                                faIcon: "",
                                btnClass: "btn-success",
                                label: this.app.localeService.i18n("plugin.chat.videoconf.media.access.goprefs")
                            },
                            no: {
                                faIcon: "",
                                btnClass: "btn-default",
                                label: this.app.localeService.i18n("core.button.cancel.label")
                            }
                        })];
                    case 1:
                        confirmResult = _a.sent();
                        if (!(confirmResult.result == "yes")) return [3, 3];
                        return [4, this.app.openMacOSSystemPreferencesWindow("security")];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2];
                }
            });
        });
    };
    ChatPlugin.prototype.bringVideoConferenceWindowToFront = function () {
        var wnd = this.currentVideoConferenceWindowController;
        if (!wnd || !wnd.nwin) {
            return;
        }
        if (wnd.nwin.isMinimized()) {
            wnd.nwin.minimizeToggle();
        }
        wnd.nwin.focus();
    };
    ChatPlugin.prototype.switchVideoConference = function (session, section, conversation, options) {
        var _this = this;
        var wnd = this.currentVideoConferenceWindowController;
        var def = Q.defer();
        wnd.closeDeferred.promise.then(function () {
            _this.app.dispatchEvent({
                type: "join-video-conference",
                hostHash: session.hostHash,
                section: section,
                conversation: conversation,
                roomMetadata: {
                    creatorHashmail: session.conv2Service.identity.hashmail,
                    title: options.title,
                    experimentalH264: options.experimentalH264,
                },
            });
            def.resolve();
        });
        wnd.leaveVideoConference();
        return def.promise;
    };
    ChatPlugin.prototype.isInVideoConference = function (session, section, conversation) {
        var _this = this;
        if (!this.isVideoConferenceActive(session, section, conversation)) {
            return false;
        }
        var conferenceData = this.getVideoConferenceData(session, section, conversation);
        return !!conferenceData.users.find(function (hashmail) { return hashmail == _this.identity.hashmail; });
    };
    ChatPlugin.prototype.getVideoConferenceData = function (session, section, conversation) {
        var recentPollingResults = this.app.videoConferencesService.polling.recentPollingResults[session.hostHash];
        if (!recentPollingResults || !recentPollingResults.conferencesData) {
            return null;
        }
        var sectionId = conversation && conversation.section ? conversation.section.getId() : (section ? section.getId() : null);
        if (!sectionId) {
            return null;
        }
        var conferenceData = recentPollingResults.conferencesData.filter(function (conferenceData) { return conferenceData.sectionId == sectionId; })[0];
        return conferenceData;
    };
    ChatPlugin.prototype.isVideoConferenceActive = function (session, section, conversation) {
        return !!this.getVideoConferenceData(session, section, conversation);
    };
    ChatPlugin.prototype.getVideoConferenceParticipantHashmails = function (session, section, conversation) {
        if (!this.isVideoConferenceActive(session, section, conversation)) {
            return [];
        }
        var conferenceData = this.getVideoConferenceData(session, section, conversation);
        return conferenceData.users.slice();
    };
    ChatPlugin.prototype.isUserInAnyVideoConference = function () {
        return this.app.videoConferencesService.isUserInAnyConference();
    };
    ChatPlugin.prototype.tryJoinExistingVideoConference = function (session, section, conv2section) {
        return __awaiter(this, void 0, void 0, function () {
            var polling, conferenceExists, sectionId_2, conferenceData, result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        polling = this.app.videoConferencesService.polling.recentPollingResults;
                        conferenceExists = false;
                        if (polling && polling[session.hostHash] && polling[session.hostHash].conferencesData) {
                            sectionId_2 = section.getId();
                            conferenceData = polling[session.hostHash].conferencesData.filter(function (conferenceData) { return conferenceData.sectionId == sectionId_2; })[0];
                            conferenceExists = !!conferenceData;
                        }
                        if (!conferenceExists) {
                            return [2];
                        }
                        if (!(this.isUserInAnyVideoConference() && this.currentVideoConferenceWindowController)) return [3, 4];
                        if (!this.isInVideoConference(session, section.isUserGroup() ? null : section, conv2section)) return [3, 1];
                        this.bringVideoConferenceWindowToFront();
                        return [3, 3];
                    case 1: return [4, this.app.msgBox.msgBox({
                            message: this.app.localeService.i18n("plugin.chat.switchVideoConferenceMsgBox.message"),
                            yes: {
                                faIcon: "",
                                btnClass: "btn-success",
                                label: this.app.localeService.i18n("plugin.chat.switchVideoConferenceMsgBox.switch"),
                                visible: true,
                            },
                            cancel: {
                                faIcon: "",
                                btnClass: "btn-default",
                                label: this.app.localeService.i18n("plugin.chat.switchVideoConferenceMsgBox.cancel"),
                                visible: true,
                            },
                        })];
                    case 2:
                        result = _a.sent();
                        if (result.result == "yes") {
                            this.switchVideoConference(session, section.isUserGroup() ? null : section, conv2section, {
                                title: "",
                                experimentalH264: false,
                            });
                        }
                        else if (result.result == "no") {
                            setTimeout(function () {
                                _this.bringVideoConferenceWindowToFront();
                            }, 500);
                        }
                        else if (result.result == "cancel") {
                        }
                        _a.label = 3;
                    case 3: return [3, 5];
                    case 4:
                        this.app.dispatchEvent({
                            type: "join-video-conference",
                            hostHash: session.hostHash,
                            section: section.isUserGroup() ? null : section,
                            conversation: conv2section,
                            roomMetadata: {
                                creatorHashmail: session.conv2Service.identity.hashmail,
                                title: "",
                            },
                        });
                        _a.label = 5;
                    case 5: return [2];
                }
            });
        });
    };
    ChatPlugin.prototype.gong = function (session, section, message) {
        this.app.videoConferencesService.gong(session, section, message);
        this.app.playAudio("gong");
    };
    ChatPlugin.CHAT_MESSAGES_LIST_COMPONENT = "chat-plugin.chatMessagesList";
    ChatPlugin.CHANNELS_SETTINGS_KEY = "chat-plugin.muted-channels";
    ChatPlugin.GUI_SETTINGS_KEY = "chat-plugin.gui-settings";
    ChatPlugin.VIEW_SETTINGS_KEY = "chat-plugin.view-settings";
    return ChatPlugin;
}());
exports.ChatPlugin = ChatPlugin;
ChatPlugin.prototype.className = "com.privmx.plugin.chat.main.ChatPlugin";

//# sourceMappingURL=ChatPlugin.js.map
