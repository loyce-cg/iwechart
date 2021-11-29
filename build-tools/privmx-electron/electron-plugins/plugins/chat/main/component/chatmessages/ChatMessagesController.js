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
var ChatMessage_1 = require("../../main/ChatMessage");
var Types_1 = require("../../main/Types");
var MessagesMarkerQueue_1 = require("../../main/MessagesMarkerQueue");
var ChatPlugin_1 = require("../../main/ChatPlugin");
var Inject = pmc_mail_1.utils.decorators.Inject;
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var index_1 = require("./i18n/index");
var SendingQueue_1 = require("./SendingQueue");
var SendingFileLocksManager_1 = require("./SendingFileLocksManager");
var Logger = pmc_mail_1.Logger.get("privfs-chat-plugin.Plugin");
var SearchState = (function () {
    function SearchState() {
    }
    return SearchState;
}());
exports.SearchState = SearchState;
var MessagesFilterUpdater = (function () {
    function MessagesFilterUpdater() {
        this.originalSeqAlreadyKept = false;
        this.setFilter({ value: "", visible: false });
    }
    MessagesFilterUpdater.prototype.setFilter = function (filter) {
        this.filter = filter;
        this.lastFilterChangeTime = Date.now();
    };
    MessagesFilterUpdater.prototype.onDeactivateMessages = function () {
        this.deactivateMessagesTime = Date.now();
    };
    MessagesFilterUpdater.prototype.keepSeq = function (seq) {
        if (this.originalSeqAlreadyKept) {
            return;
        }
        this.originalTakeCollectionSeq = seq;
        this.originalSeqAlreadyKept = true;
    };
    MessagesFilterUpdater.prototype.resetSeq = function () {
        this.originalSeqAlreadyKept = false;
    };
    MessagesFilterUpdater.prototype.needsUpdate = function () {
        if (this.deactivateMessagesTime && this.deactivateMessagesTime < this.lastFilterChangeTime && this.previousFilter && this.previousFilter.value.length > 0) {
            return true;
        }
        if (!this.previousFilter || !this.filter) {
            return true;
        }
        if (this.previousFilter.visible && !this.filter.visible) {
            return true;
        }
        if (this.previousFilter.visible != this.filter.visible) {
            return true;
        }
        if (!this.previousFilter.visible && !this.filter.visible) {
            return false;
        }
        return this.previousFilter.value != this.filter.value;
    };
    MessagesFilterUpdater.prototype.updateFilter = function (filter, onPanelActivate) {
        var _this = this;
        if (onPanelActivate === void 0) { onPanelActivate = false; }
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
            value: pmc_mail_1.app.common.SearchFilter.prepareNeedle(filter.value),
            visible: filter.visible,
        };
        var f = function () {
            _this.updateTimer = null;
            _this.setFilter(_this.toUpdate);
            if (_this.onUpdate && _this.needsUpdate()) {
                if (_this.onUpdate()) {
                    _this.previousFilter = _this.filter;
                }
            }
        };
        if (onPanelActivate) {
            f();
        }
        else {
            this.updateTimer = setTimeout(f, MessagesFilterUpdater.UPDATE_DELAY);
        }
    };
    MessagesFilterUpdater.UPDATE_DELAY = 500;
    MessagesFilterUpdater.MIN_CHARS_NUM = 3;
    return MessagesFilterUpdater;
}());
exports.MessagesFilterUpdater = MessagesFilterUpdater;
var ChatMessagesController = (function (_super) {
    __extends(ChatMessagesController, _super);
    function ChatMessagesController(parent, personsComponent) {
        var _this = _super.call(this, parent) || this;
        _this.personsComponent = personsComponent;
        _this.isSectionSet = false;
        _this.isActive = true;
        _this.previousSearchState = null;
        _this.creatingUserGroupLock = false;
        _this.lastEditableSinkEntry = null;
        _this.pastingInProgress = false;
        _this.entriesWithNonExistantFiles = [];
        _this.afterViewLoaded = pmc_mail_1.Q.defer();
        _this.msgIsTldr = {};
        _this.msgIsExpanded = {};
        _this.quoteIsExpanded = {};
        _this.imgDidsToProcess = [];
        _this.sectionTree = null;
        _this.scrollToBottomOnLoadImages = false;
        _this.distancesFromClosestMatch = [];
        _this.fileMessagesByDid = {};
        _this.ipcMode = true;
        _this.editing = {};
        _this.chatPlugin = _this.app.getComponent("chat-plugin");
        _this.messagesMarkerQueueEx = new MessagesMarkerQueue_1.MessagesMarkerQueueEx(new MessagesMarkerQueue_1.MessagesMarkerQueue(_this.messageFlagsUpdater, _this.logErrorCallback), _this);
        _this.messagesMarkerQueueEx.reset();
        _this.proxyCollection = _this.addComponent("proxyCollection", new pmc_mail_1.utils.collection.FilteredCollection(null, function (entry) {
            return _this.chatPlugin.filterMessagesForDisplay(entry);
        }));
        _this.messagesCollection = _this.addComponent("chatMessageCollection", new pmc_mail_1.utils.collection.SortedCollection(_this.proxyCollection, function (a, b) {
            return a.source.serverDate - b.source.serverDate;
        }));
        _this.messagesCollection.changeEvent.add(function (event) {
            pmc_mail_1.Q().then(function () {
                if (_this.isFilterEnabled()) {
                    _this.refreshMatches(false);
                }
                else {
                    _this.refreshMatches(true);
                }
            });
        });
        _this.messagesFilterUpdater = new MessagesFilterUpdater();
        _this.sendingFileLocksManager = new SendingFileLocksManager_1.SendingFileLocksManager();
        _this.filteredCollection = _this.addComponent("filteredChatMessagesCollection", new pmc_mail_1.utils.collection.FilteredCollection(_this.messagesCollection, function (entry) {
            return _this.distancesFromClosestMatch[entry.id] < Number.POSITIVE_INFINITY || !(entry.id in _this.distancesFromClosestMatch);
        }));
        _this.takeCollection = _this.addComponent("takeCollection", new pmc_mail_1.utils.collection.FilteredCollection(_this.filteredCollection, function (x) {
            return x.id > _this.takeCollectionSeq;
        }));
        _this.messagesFilterUpdater.restoreSeq = function (origSeq) {
            _this.takeCollectionSeq = origSeq;
            _this.messagesFilterUpdater.resetSeq();
            _this.proxyCollection.rebuild();
            if (_this.takeCollectionSeq != 0) {
                _this.callViewMethod("setAllMessagesRendered", false);
            }
            if (_this.thumbs) {
                _this.thumbs.processThumbs();
            }
        };
        _this.messagesFilterUpdater.onUpdate = function () {
            if (!_this.isActive) {
                return false;
            }
            _this.refreshMatches();
            _this.callViewMethod("updateMessagesFiltered", _this.isFilterEnabled());
            _this.updateSearchState();
            return true;
        };
        var messagesTransform = _this.addComponent("chatMessagesTransform", new pmc_mail_1.utils.collection.TransformCollection(_this.takeCollection, function (entry) {
            var conv = _this.convertSinkIndex(entry);
            return conv;
        }));
        _this.transformCollection = messagesTransform;
        _this.messages = _this.addComponent("chatMessages", _this.componentFactory.createComponent("extlist", [_this, messagesTransform]));
        _this.messages.ipcMode = true;
        _this.registerChangeEvent(_this.messagesCollection.changeEvent, _this.onMessageChange.bind(_this), "multi");
        _this.registerChangeEvent(_this.app.searchModel.changeEvent, _this.onFilterMessages, "multi");
        _this.registerChangeEvent(_this.personService.persons.changeEvent, _this.onPersonChange.bind(_this));
        _this.registerChangeEvent(_this.messages.collection.changeEvent, _this.onMessagesChange.bind(_this), "multi");
        _this.bindEvent(_this.app, "user-deleted", function (event) {
            _this.callViewMethod("updateCanWrite", _this.canWrite());
        });
        _this.messagesCollection.changeEvent.add(_this.onSingleMessageChange.bind(_this));
        _this.sendingQueue = new SendingQueue_1.SendingQueue(_this.sendQueuedTextMessage.bind(_this), _this.messages.freeze.bind(_this), _this.messages.unfreeze.bind(_this));
        _this.sendingId = 0;
        _this.sendMessages = [];
        _this.unreadMarkers = [];
        _this.loadingMoreMessages = null;
        _this.emojiPicker = _this.addComponent("emojiPicker", _this.componentFactory.createComponent("emojipicker", [_this, { app: _this.app }]));
        _this.emojiViewBar = _this.addComponent("emojiViewBar", _this.componentFactory.createComponent("emojiviewbar", [_this]));
        _this.emojiPicker.setOnIconSelectedListener((function (id, parentId) {
            var section = _this.getSection();
            if (section == null) {
                return;
            }
            var splitted = parentId.split("/");
            section.setStickersAtChatMessage(parseInt(splitted[1]), [id], true).fail(_this.errorCallback);
        }));
        _this.bindEvent(_this.app, "chatvalidmessagetypefordisplaychange", function () {
            _this.proxyCollection.refresh();
            _this.loadUntilFillTakeCollection().then(function () {
                _this.refreshMatches();
                _this.updateSearchState();
            });
        });
        var tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.tasksPlugin = tasksPlugin;
        _this.taskTooltip = _this.addComponent("tasktooltip", _this.componentFactory.createComponent("tasktooltip", [_this]));
        _this.taskTooltip.getContent = function (taskId) {
            return tasksPlugin ? tasksPlugin.getTaskTooltipContent(_this.session, taskId) : null;
        };
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.encryptionEffect = _this.addComponent("encryptionEffect", _this.componentFactory.createComponent("encryptioneffect", [_this]));
        _this.thumbs = _this.addComponent("thumbs", _this.componentFactory.createComponent("thumbs", [_this, _this.app, {
                missingThumbAction: pmc_mail_1.component.thumbs.MissingThumbAction.USE_ORIGINAL_IMAGE,
            }]));
        _this.loading = _this.addComponent("loading", _this.componentFactory.createComponent("loading", [_this]));
        _this.bindEvent(_this.app, "fileRenamed", function (event) {
            if (event.isLocal) {
                return;
            }
            var hostHash = event.hostHash || _this.app.sessionManager.getLocalSession().hostHash;
            if (hostHash != _this.session.hostHash) {
                return;
            }
            _this.proxyCollection.forEach(function (msg) {
                if (msg && msg.source && msg.source.data && msg.source.data.type == "chat-message" && msg.source.data.contentType == "application/json") {
                    var obj = JSON.parse(msg.source.data.text);
                    if (obj && obj.type == "create-file" && obj.did == event.did) {
                        var section = _this.getSection();
                        if (section) {
                            section.getFileTree().then(function (tree) {
                                return tree.refreshDeep(true);
                            })
                                .then(function () {
                                _this.proxyCollection.triggerUpdateElement(msg);
                            });
                        }
                    }
                }
            });
        });
        _this.bindEvent(_this.app, "joinedVoiceChat", function (event) {
            if (event.sectionId == _this.getSection().getId()) {
                _this.toggleIsVoiceChatActiveInThisSection(false);
                _this.toggleIsInVoiceChatInThisSection(true);
                _this.toggleIsTalkingInThisSection(true);
                _this.toggleRingTheBellAvailable(true);
            }
            else {
                _this.toggleIsInVoiceChatInAnotherSection(true);
                _this.toggleIsTalkingInAnotherSection(true);
            }
        });
        _this.bindEvent(_this.app, "leftVoiceChat", function (event) {
            if (event.sectionId == _this.getSection().getId()) {
                _this.toggleIsInVoiceChatInThisSection(false);
                _this.toggleIsVoiceChatActiveInThisSection(_this.app.voiceChatService.isVoiceChatActive(_this.session, event.sectionId));
                _this.toggleIsTalkingInThisSection(false);
                _this.toggleRingTheBellAvailable(false);
            }
            else {
                _this.toggleIsInVoiceChatInAnotherSection(false);
                _this.toggleIsTalkingInAnotherSection(false);
            }
        });
        _this.bindEvent(_this.app, "startedTalking", function (event) {
            if (event.sectionId == _this.getSection().getId()) {
                _this.toggleIsTalkingInThisSection(true);
            }
            else {
                _this.toggleIsTalkingInAnotherSection(true);
            }
        });
        _this.bindEvent(_this.app, "stoppedTalking", function (event) {
            if (event.sectionId == _this.getSection().getId()) {
                _this.toggleIsTalkingInThisSection(false);
            }
            else {
                _this.toggleIsTalkingInAnotherSection(false);
            }
        });
        _this.bindEvent(_this.app, "file-attached-to-task", function (event) {
            _this.refreshFileMessagesByDid(event.did);
        });
        _this.bindEvent(_this.app, "file-detached-from-task", function (event) {
            _this.refreshFileMessagesByDid(event.did);
        });
        _this.bindEvent(_this.app, "got-video-conferences-polling-result", _this.onGotVideoConferencesPollingResult.bind(_this));
        return _this;
    }
    ChatMessagesController_1 = ChatMessagesController;
    ChatMessagesController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    ChatMessagesController.prototype.onPersonChange = function (person) {
        this.callViewMethod("renderHeader", this.getModel());
    };
    ChatMessagesController.prototype.setConversationFilesChangeListener = function () {
        var section = this.getSection();
        this.filesMessagesProxyCollection = this.addComponent("filesMessagesCollection", new pmc_mail_1.utils.collection.ProxyCollection(section.getChatModule().filesMessagesCollection));
        this.filesMessagesProxyCollection.changeEvent.add(this.onFilesMessagesChange.bind(this));
    };
    ChatMessagesController.prototype.onSectionChange = function () {
        this.callViewMethod("renderHeader", this.getModel());
    };
    ChatMessagesController.prototype.init = function () {
        this.horizontalSplitter = this.addComponent("horizontalSplitter", this.componentFactory.createComponent("splitter", [this, this.parent.settings.create("chat-splitter-horizontal")]));
        this.enterSends = this.parent.settings.create("enter-sends");
        this.registerChangeEvent(this.enterSends.changeEvent, this.onEnterSendsChange);
    };
    ChatMessagesController.prototype.setSection = function (section) {
        var _this = this;
        if (!section.isChatModuleEnabled()) {
            this.isSectionSet = false;
            return pmc_mail_1.Q(false);
        }
        return section.getChatSinkIndex().then(function () {
            if (section.isUserGroup()) {
                var conversation = _this.conv2Service.collection.find(function (x) { return x.section == section; });
                _this.setChatData({
                    type: Types_1.ChatType.CONVERSATION,
                    section: null,
                    conversation: conversation
                }, section.getChatModule().sinkIndex.entries);
            }
            else {
                _this.setSectionData(section);
            }
            return true;
        });
    };
    ChatMessagesController.prototype.setSectionData = function (section) {
        var _this = this;
        if (!section) {
            return;
        }
        this.bindEvent(this.app, "reopen-section", function (event) {
            if (event.element && event.element.getId() == section.getId()) {
                _this.callViewMethod("updateEnabledModules", { notes2: section.isFileModuleEnabled(), tasks: section.isKvdbModuleEnabled() });
                _this.onSectionChange();
            }
        });
        this.bindEvent(this.sectionManager.sectionAccessManager.eventDispatcher, "section-state-changed", function (event) {
            if (section.getId() == event.sectionId) {
                pmc_mail_1.Q().then(function () {
                    return _this.sectionManager.load();
                })
                    .then(function () {
                    var section = _this.sectionManager.getSection(event.sectionId);
                    _this.callViewMethod("updateEnabledModules", { notes2: section.isFileModuleEnabled(), tasks: section.isKvdbModuleEnabled() });
                });
            }
        });
        this.filesMessagesProxyCollection = this.addComponent("filesMessagesCollection", new pmc_mail_1.utils.collection.ProxyCollection(section.getChatModule().filesMessagesCollection));
        this.filesMessagesProxyCollection.changeEvent.add(this.onFilesMessagesChange.bind(this));
        this.setChatData({
            type: Types_1.ChatType.CHANNEL,
            section: section,
            conversation: null
        }, section.getChatModule().sinkIndex.entries);
    };
    ChatMessagesController.prototype.onFilesMessagesChange = function (event) {
        if ((event.type == "update" || event.type == "add") && event.element) {
            var content = event.element.getContentAsJson();
            if (content && (content.type == "delete-file" || content.type == "delete-directory" || content.type == "delete-directory-permanent")) {
                this.disableFileLinksForNonExistantFiles();
            }
        }
    };
    ChatMessagesController.prototype.disableFileLinksForNonExistantFiles = function () {
        var _this = this;
        if (!this.filesMessagesProxyCollection) {
            return;
        }
        if (this.nonExistantFilesMessagesRefreshTimer != null) {
            clearTimeout(this.nonExistantFilesMessagesRefreshTimer);
        }
        this.nonExistantFilesMessagesRefreshTimer = setTimeout(function () {
            pmc_mail_1.Q().then(function () {
                return _this.getEntriesWithNonExistantFilesDids(_this.filesMessagesProxyCollection, _this.getSection());
            })
                .then(function (list) {
                _this.entriesWithNonExistantFiles = list;
                list.forEach(function (entry) {
                    _this.triggerUpdateNonExistantFileMessage(entry.id);
                });
            });
        }, 500);
    };
    ChatMessagesController.prototype.waitPromise = function (ms) {
        return pmc_mail_1.Q.Promise(function (resolve) {
            setTimeout(function () { return resolve(); }, ms);
        });
    };
    ChatMessagesController.prototype.getEntriesWithNonExistantFilesDids = function (collection, section) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var messagesDids = [];
            var availFilesDids = [];
            var nonExistant = [];
            collection.forEach(function (msgEntry) {
                var data = msgEntry.getContentAsJson();
                if (data.did && data.did.length > 0) {
                    pmc_mail_1.utils.Lang.uniqueAdd(messagesDids, data.did);
                }
            });
            return _this.waitPromise(1000)
                .then(function () {
                return section.getFileTree().then(function (t) {
                    return t.refreshDeep(true).thenResolve(t);
                })
                    .then(function (tree) {
                    availFilesDids = tree.collection.list.filter(function (f) { return f.path.indexOf("/.trash/") == -1; }).map(function (fileEntry) { return fileEntry.ref.did; });
                    nonExistant = messagesDids.filter(function (msgDid) { return availFilesDids.indexOf(msgDid) == -1; });
                    return collection.list.filter(function (entry) {
                        var data = entry.getContentAsJson();
                        return data && data.did && nonExistant.indexOf(data.did) > -1;
                    });
                });
            });
        });
    };
    ChatMessagesController.prototype.setChatData = function (chatInfo, collection) {
        var _this = this;
        this.chatInfo = chatInfo;
        var section = this.getSection();
        if (section && section.getChatModule() && section.getChatModule().sinkIndex) {
            this.takeCollectionSeq = Math.max(0, section.getChatModule().sinkIndex.cursor.seq - ChatMessagesController_1.MESSAGES_TO_LOAD);
        }
        else {
            this.takeCollectionSeq = 0;
        }
        pmc_mail_1.Q().then(function () { _this.proxyCollection.setCollection(collection); });
        this.isSectionSet = true;
        this.processUnreadMarkers();
        this.loadUntilFillTakeCollection();
        this.messagesFilterUpdater.updateFilter(this.app.searchModel.get(), true);
        this.disableFileLinksForNonExistantFiles();
    };
    ChatMessagesController.prototype.getModel = function () {
        var _this = this;
        if (!this.isSectionSet) {
            return null;
        }
        var active = this.getSection();
        var hasNotes2 = false;
        var hasTasks = false;
        var canCreateTask = this.chatInfo && !this.chatInfo.conversation;
        if (this.chatInfo.type == Types_1.ChatType.CONVERSATION) {
            hasNotes2 = true;
            hasTasks = this.chatInfo.conversation.isSingleContact();
        }
        else {
            hasNotes2 = active && this.chatPlugin.isNotes2PluginPresent() && active.isFileModuleEnabled();
            hasTasks = active && this.chatPlugin.isTasksPluginPresent() && active.isKvdbModuleEnabled();
        }
        return {
            userType: this.session.sectionManager.identityProvider.getType(),
            maxMsgTextSize: ChatMessagesController_1.MAX_MSG_TEXT_SIZE,
            enterSends: this.enterSends.get("boolean"),
            chatType: this.chatInfo.type,
            hasUnread: this.thereAreUnreadMessages(),
            messagesCount: this.getCollectionSize(),
            persons: this.chatInfo.type == Types_1.ChatType.CONVERSATION ? this.chatInfo.conversation.persons.map(function (x) { return ChatPlugin_1.ChatPlugin.getPersonModel(x, _this.session); }) : [],
            channel: this.chatInfo.type == Types_1.ChatType.CHANNEL ? {
                id: this.chatInfo.section.getId(),
                name: this.chatInfo.section.getName(),
                scope: this.chatInfo.section.getScope(),
                breadcrumb: ""
            } : null,
            hasNotes2: hasNotes2,
            hasTasks: hasTasks,
            canCreateTask: canCreateTask,
            unreadMarkers: this.unreadMarkers,
            customStyle: this.app.loadCustomizationAsset("chat-plugin/style.css"),
            customTemplate: this.app.loadCustomizationAsset("chat-plugin/channel-message.html"),
            guiSettings: this.chatPlugin.getGUISettings(),
            hostHash: this.session.hostHash,
            sectionId: this.chatInfo.type == Types_1.ChatType.CHANNEL ? this.chatInfo.section.getId() : this.chatInfo.conversation.id,
            canWrite: this.canWrite(),
            isRemote: this.session.sessionType == "remote",
            viewSettings: this.chatPlugin.getViewSettings(),
            usersWithAccess: this.chatInfo.type == Types_1.ChatType.CHANNEL ? this.getUsersWithAccess().map(function (x) { return ChatPlugin_1.ChatPlugin.getPersonModel(x, _this.session); }) : [],
            platform: this.app.getPlatform(),
            systemLabel: this.app.isElectronApp() ? this.app.getSystemLabel() : null,
            contextSize: ChatMessagesController_1.SEARCH_CONTEXT_SIZE,
            isInVoiceChatInThisSection: this.isInVoiceChatInThisSection(),
            isVoiceChatActiveInThisSection: this.isVoiceChatActiveInThisSection(),
            isInVoiceChatInAnotherSection: this.isInVoiceChatInAnotherSection(),
            isTalkingInThisSection: this.isTalkingInThisSection(),
            isTalkingInAnotherSection: this.isTalkingInAnotherSection(),
            isRingTheBellAvailable: this.isRingTheBellAvailable(),
            isVoiceChatEnabled: ChatMessagesController_1.IS_VOICE_CHAT_ENABLED && this.app.serverConfigForUser.privmxStreamsEnabled,
            inAnyVideoConference: this.isUserInAnyVideoConference(),
            inVideoConferenceInThisSection: this.isUserInVideoConferenceInThisSection(),
        };
    };
    ChatMessagesController.prototype.isInVoiceChatInThisSection = function () {
        return this.app.voiceChatService.isInVoiceChat() && this.app.voiceChatService.getActiveSection().getId() == this.getSection().getId();
    };
    ChatMessagesController.prototype.isVoiceChatActiveInThisSection = function () {
        var section = this.chatInfo.section ? this.chatInfo.section : null;
        var conv = this.chatInfo.conversation ? this.chatInfo.conversation : null;
        var ret = this.app.voiceChatService.isVoiceChatActive(this.session, section ? section.getId() : conv.id);
        return ret;
    };
    ChatMessagesController.prototype.isInVoiceChatInAnotherSection = function () {
        return this.app.voiceChatService.isInVoiceChat() && this.app.voiceChatService.getActiveSection().getId() != this.getSection().getId();
    };
    ChatMessagesController.prototype.isTalkingInThisSection = function () {
        return this.app.voiceChatService.isTalking() && this.app.voiceChatService.getActiveSection().getId() == this.getSection().getId();
    };
    ChatMessagesController.prototype.isRingTheBellAvailable = function () {
        return this.isTalkingInThisSection();
    };
    ChatMessagesController.prototype.isTalkingInAnotherSection = function () {
        return this.app.voiceChatService.isTalking() && this.app.voiceChatService.getActiveSection().getId() != this.getSection().getId();
    };
    ChatMessagesController.prototype.getUsersWithAccess = function () {
        var _this = this;
        var section = this.getSection();
        if (!section) {
            return [];
        }
        var contactsWithAccess = section.getContactsWithAccess(true);
        if (!contactsWithAccess) {
            return [];
        }
        return contactsWithAccess
            .map(function (x) { return _this.personService.getPerson(x.getHashmail()); });
    };
    ChatMessagesController.prototype.onViewLoad = function () {
        this.refreshMatches();
        this.updateSearchState();
        this.callViewMethod("updateMessagesFiltered", this.isFilterEnabled());
        this.updateSectionVideoConferenceModelIfChanged();
        this.afterViewLoaded.resolve();
    };
    ChatMessagesController.prototype.onViewOpenMail = function (id, sinkId) {
        var _this = this;
        this.addTaskEx(this.i18n("plugin.chat.component.chatMessages.task.openMessage.text"), false, function () {
            var entry = _this.getMessageEntryById(id, sinkId);
            _this.app.openMessage(_this.parent, entry);
        });
    };
    ChatMessagesController.prototype.onViewOpenTask = function (id, scrollToComments) {
        this.chatPlugin.openTask(this.session, null, id, scrollToComments);
    };
    ChatMessagesController.prototype.onViewOpenFileChooser = function () {
        var _this = this;
        var notes2Plugin = this.app.getComponent("notes2-plugin");
        if (!notes2Plugin) {
            return null;
        }
        if (this.isConversationWithDeletedUserOnly()) {
            return;
        }
        notes2Plugin.openFileChooser(this.parent, this.session, null, "messageslist-" + this.getId()).then(function (result) {
            result.forEach(function (element) {
                _this.sendMessage({ attachments: [element.content] });
            });
        });
    };
    ChatMessagesController.prototype.onViewUploadFile = function () {
        this.upload("/");
    };
    ChatMessagesController.prototype.onViewCreateNewNote = function (type) {
        var sectionId = this.getSection().getId();
        var notes2Plugin = this.app.getComponent("notes2-plugin");
        if (!notes2Plugin) {
            return;
        }
        if (type == "text-note") {
            notes2Plugin.openNewTextNoteWindow(this.session, sectionId, "/");
        }
        else if (type == "mindmap") {
            notes2Plugin.openNewMindmapWindow(this.session, sectionId, "/");
        }
        else if (type == "new-audioAndVideo-note-window") {
            notes2Plugin.openNewAudioAndVideoNoteWindow(this.session, sectionId, "/");
        }
        else if (type == "new-audio-note-window") {
            notes2Plugin.openNewAudioNoteWindow(this.session, sectionId, "/");
        }
        else if (type == "new-photo-note-window") {
            notes2Plugin.openNewPhotoNoteWindow(this.session, sectionId, "/");
        }
    };
    ChatMessagesController.prototype.onViewDeleteMessage = function (originalMessageId) {
        var _this = this;
        this.parent.confirm(this.i18n("plugin.chat.component.chatMessages.deleteMessageQuestion")).then(function (result) {
            if (result.result == "yes") {
                _this.deleteMessage(originalMessageId);
            }
        });
    };
    ChatMessagesController.prototype.onViewStartEditMessage = function (originalMessageId) {
        var sinkEntry = this.filteredCollection.find(function (x) { return x.id == originalMessageId; });
        if (sinkEntry == null) {
            return;
        }
        this.callViewMethod("enterEditMode", originalMessageId, sinkEntry.getMessage().text);
    };
    ChatMessagesController.prototype.onViewStartEditLastMessage = function () {
        var sinkEntry = this.getLastEditableMessageSinkEntry();
        if (sinkEntry) {
            var message = sinkEntry.getMessage();
            this.callViewMethod("enterEditMode", sinkEntry.id, message.text);
        }
    };
    ChatMessagesController.prototype.getLastEditableMessageSinkEntry = function () {
        var list = this.filteredCollection.list;
        for (var i = list.length - 1; i >= 0; i--) {
            var sinkEntry = list[i];
            var message = sinkEntry.getMessage();
            if (message.sender.hashmail == this.identity.hashmail && message.contentType != "application/json") {
                if (!message.deleted) {
                    return sinkEntry;
                }
            }
        }
        return null;
    };
    ChatMessagesController.prototype.isLastEditableMessageSinkEntry = function (sinkEntry) {
        var lastSinkEntry = this.getLastEditableMessageSinkEntry();
        if (!lastSinkEntry) {
            return false;
        }
        return lastSinkEntry.id == sinkEntry.id;
    };
    ChatMessagesController.prototype.closeSearchIfOpened = function () {
        var search = this.app.searchModel.get();
        if (search.visible) {
            search.visible = false;
            this.app.searchModel.set(search);
        }
    };
    ChatMessagesController.prototype.onViewSendMessage = function (text) {
        this.closeSearchIfOpened();
        this.encryptionEffect.customShowForChat(text);
        this.sendingQueue.add(text);
    };
    ChatMessagesController.prototype.onViewEditMessage = function (originalMessageId, text) {
        this.closeSearchIfOpened();
        this.editMessage(originalMessageId, text);
    };
    ChatMessagesController.prototype.actionOpenableElement = function (element, autoPlay) {
        var resolvedApp = this.app.shellRegistry.resolveApplicationByElement({ element: element, session: this.session });
        if (resolvedApp.id == "core.unsupported") {
            this.app.shellRegistry.shellOpen({
                action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.DOWNLOAD,
                element: element,
                session: this.session,
            });
            return;
        }
        if (resolvedApp.id == "plugin.editor") {
            this.app.shellRegistry.shellOpen({
                element: element,
                action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW,
                session: this.session,
            });
            return;
        }
        if (resolvedApp.id == "core.audio" || resolvedApp.id == "core.video") {
            this.app.shellRegistry.shellOpen({
                element: element,
                action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW,
                session: this.session,
                editorOptions: {
                    autoPlay: autoPlay,
                },
            });
            return;
        }
        this.app.shellRegistry.shellOpen({
            element: element,
            action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW,
            session: this.session
        });
    };
    ChatMessagesController.prototype.onViewOpenAttachment = function (id, sinkId, attachmentIndex) {
        if (this.networkIsDown()) {
            this.parent.showOfflineError();
            return;
        }
        var entry = this.getMessageEntryById(id, sinkId);
        if (entry != null) {
            var element = pmc_mail_1.app.common.shelltypes.OpenableAttachment.create(entry.getMessage().attachments[attachmentIndex], true, true);
            this.actionOpenableElement(element);
        }
    };
    ChatMessagesController.prototype.getSectionFileByDid = function (section, did) {
        return pmc_mail_1.Q().then(function () {
            return section.getFileTree();
        })
            .then(function (tree) {
            if (tree.collection.list.filter(function (x) { return x.ref.did == did; }).length == 0) {
                throw "File doesn't exist";
            }
            return tree.getPathFromDescriptor(did);
        })
            .then(function (path) {
            if (path.indexOf("/.trash/") >= 0) {
                throw "File doesn't exist";
            }
            return section.getFileOpenableElement(path, false);
        });
    };
    ChatMessagesController.prototype.isFileExistsByDid = function (did, section) {
        return pmc_mail_1.Q().then(function () {
            return section.getFileTree();
        })
            .then(function (fTree) {
            return fTree.refreshDeep(true).thenResolve(fTree);
        })
            .then(function (tree) {
            if (tree.collection.list.filter(function (x) { return x.ref.did == did; }).length == 0) {
                return false;
            }
            return true;
        });
    };
    ChatMessagesController.prototype.onViewOpenChannelFile = function (path, did, autoPlay) {
        var _this = this;
        var section = this.getSection();
        if (section == null || !section.hasFileModule()) {
            return;
        }
        pmc_mail_1.Q().then(function () {
            return did.length > 0 ? _this.getSectionFileByDid(section, did) : section.getFileOpenableElement(path, true);
        })
            .then(function (element) {
            _this.actionOpenableElement(element, autoPlay);
        })
            .fail(function (e) {
            if (pmc_mail_1.privfs.exception.PrivFsException.is(e, "FILE_DOES_NOT_EXIST") ||
                pmc_mail_1.privfs.exception.PrivFsException.is(e, "DIRECTORY_DOES_NOT_EXIST") ||
                pmc_mail_1.privfs.exception.PrivFsException.is(e, "ELEMENT_IS_NOT_DIRECTORY")) {
                _this.parent.alert(_this.i18n("plugin.chat.component.chatMessages.info.fileDoesNotExist"));
                return;
            }
            if (pmc_mail_1.privfs.exception.PrivFsException.is(e, "ELEMENT_IS_NOT_FILE")) {
                _this.parent.alert(_this.i18n("plugin.chat.component.chatMessages.info.fileInvalidType"));
                return;
            }
            _this.errorCallback(e);
        });
    };
    ChatMessagesController.prototype.onViewSetEnterSends = function (checked) {
        this.enterSends.set(checked, this);
    };
    ChatMessagesController.prototype.onViewUserAction = function () {
        if (this.app.userPreferences.getAutoMarkAsRead()) {
            this.messagesMarkerQueueEx.onUserAction();
        }
    };
    ChatMessagesController.prototype.onViewShowMessageTextTooLarge = function () {
        var _this = this;
        this.parent.alert(this.i18n("plugin.chat.component.chatMessages.info.messageTextTooLarge", ChatMessagesController_1.MAX_MSG_TEXT_SIZE))
            .then(function () {
            _this.callViewMethod("focusReplyField");
        });
    };
    ChatMessagesController.prototype.onViewLoadMoreMessages = function () {
        if (this.isFilterEnabled()) {
            this.callViewMethod("hideLoading");
            return;
        }
        this.loadMoreMessages();
    };
    ChatMessagesController.prototype.onViewSearchHistoricalData = function () {
        var _this = this;
        var notificationId = this.notifications.showNotification(this.i18n("plugin.chat.component.chatMessages.notification.searching"), { autoHide: false, progress: true });
        this.loadHistoricalSearchResults(ChatMessagesController_1.MIN_SEARCH_RESULTS_TO_LOAD).then(function () {
            _this.updateSearchState();
        })
            .fin(function () {
            _this.callViewMethod("enableSearchHistoricalDataButton");
            _this.notifications.hideNotification(notificationId);
        });
    };
    ChatMessagesController.prototype.onViewAddPerson = function () {
        if (this.isConversationWithDeletedUserOnly()) {
            return;
        }
        var hashmails = this.chatInfo.conversation.persons.map(function (p) { return p.hashmail; });
        this.app.dispatchEvent({
            type: "requestopenchat",
            showContactsWindow: true,
            hashmails: hashmails,
        });
    };
    ChatMessagesController.prototype.onViewRemovePerson = function (hashmail) {
        var hashmails = this.chatInfo.conversation.persons.map(function (p) { return p.hashmail; }).filter(function (h) { return h != hashmail; });
        this.app.dispatchEvent({
            type: "requestopenchat",
            hashmails: hashmails,
        });
    };
    ChatMessagesController.prototype.isFilterEnabled = function () {
        return this.messagesFilterUpdater.filter.visible && this.messagesFilterUpdater.filter.value && this.messagesFilterUpdater.filter.value.length >= 2;
    };
    ChatMessagesController.prototype.loadMoreMessages = function (allowFilter) {
        var _this = this;
        if (allowFilter === void 0) { allowFilter = false; }
        var fullyLoaded = this.isFullyLoaded();
        if (fullyLoaded == null || (!allowFilter && this.isFilterEnabled())) {
            this.callViewMethod("setAllMessagesRendered", true);
            return;
        }
        if (this.takeCollectionSeq == 0) {
            this.callViewMethod("setAllMessagesRendered", true);
        }
        if (fullyLoaded) {
            this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController_1.MESSAGES_TO_LOAD);
            this.takeCollection.refresh();
        }
        else {
            if (this.loadingMoreMessages == null) {
                this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController_1.MESSAGES_TO_LOAD);
                return this.singleLoadMoreMessages(this.takeCollectionSeq, allowFilter).then(function () {
                    _this.takeCollection.refresh();
                });
            }
        }
        return pmc_mail_1.Q();
    };
    ChatMessagesController.prototype.singleLoadMoreMessages = function (seq, allowFilter) {
        var _this = this;
        if (allowFilter === void 0) { allowFilter = false; }
        if (!allowFilter && this.isFilterEnabled()) {
            return pmc_mail_1.Q();
        }
        if (this.loadingMoreMessages) {
            return this.loadingMoreMessages;
        }
        this.callViewMethod("showMessagesLoading");
        return this.loadingMoreMessages = pmc_mail_1.Q().then(function () {
            var sinkIndex = _this.getSection().getChatModule().sinkIndex;
            return sinkIndex.loadLastMessages(sinkIndex.baseEntries.list.length - seq);
        })
            .fail(this.errorCallback)
            .fin(function () {
            _this.callViewMethod("hideMessagesLoading");
            _this.loadingMoreMessages = null;
        });
    };
    ChatMessagesController.prototype.loadUntilFillTakeCollection = function () {
        var _this = this;
        if (this.isFilterEnabled()) {
            return pmc_mail_1.Q();
        }
        var fullyLoaded = this.isFullyLoaded();
        if (fullyLoaded || fullyLoaded == null || this.takeCollectionSeq == 0) {
            return pmc_mail_1.Q();
        }
        if (this.takeCollection.size() < ChatMessagesController_1.MESSAGES_TO_LOAD) {
            this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController_1.MESSAGES_TO_LOAD);
            if (this.takeCollectionSeq == 0) {
                return pmc_mail_1.Q();
            }
            return this.singleLoadMoreMessages(this.takeCollectionSeq).then(function () {
                return _this.loadUntilFillTakeCollection();
            });
        }
        return pmc_mail_1.Q();
    };
    ChatMessagesController.prototype.loadHistoricalSearchResults = function (nExtra) {
        var _this = this;
        if (nExtra <= 0) {
            return pmc_mail_1.Q();
        }
        if (!this.isFilterEnabled()) {
            return pmc_mail_1.Q();
        }
        this.messagesFilterUpdater.keepSeq(this.takeCollectionSeq);
        var cachedSeq = this.getCachedSeq();
        if (cachedSeq < this.takeCollectionSeq) {
            this.takeNMatching(ChatMessagesController_1.MIN_SEARCH_RESULTS_TO_LOAD);
            return pmc_mail_1.Q();
        }
        var fullyLoaded = this.isFullyLoaded();
        if (fullyLoaded || fullyLoaded == null || this.takeCollectionSeq == 0) {
            if (this.takeCollectionSeq > 0) {
                this.takeNMatching(ChatMessagesController_1.MIN_SEARCH_RESULTS_TO_LOAD);
            }
            return pmc_mail_1.Q();
        }
        if (this.takeCollectionSeq == 0) {
            return pmc_mail_1.Q();
        }
        this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController_1.MESSAGES_TO_LOAD);
        var count0 = this.takeCollection.list.length;
        return this.singleLoadMoreMessages(this.takeCollectionSeq, true).then(function () {
            var count1 = _this.takeCollection.list.length;
            nExtra -= count1 - count0;
            return _this.loadHistoricalSearchResults(nExtra);
        });
    };
    ChatMessagesController.prototype.getCachedSeq = function () {
        var section = this.getSection();
        if (section == null || !section.hasChatModule() || section.getChatModule().sinkIndex == null) {
            return null;
        }
        var sinkIndex = section.getChatModule().sinkIndex;
        var seqCached = sinkIndex.entries.collection.list.length - sinkIndex.entries.list.length;
        return seqCached;
    };
    ChatMessagesController.prototype.isFullyLoaded = function () {
        var section = this.getSection();
        if (section == null || !section.hasChatModule() || section.getChatModule().sinkIndex == null) {
            return null;
        }
        var sinkIndex = section.getChatModule().sinkIndex;
        return sinkIndex.entries.list.length == sinkIndex.entries.collection.list.length;
    };
    ChatMessagesController.prototype.takeNMatching = function (nExtra) {
        var n = this.takeCollection.list.length + nExtra;
        while (this.takeCollectionSeq > 0 && this.takeCollection.list.length < n) {
            this.takeCollectionSeq = Math.max(0, this.takeCollectionSeq - ChatMessagesController_1.MESSAGES_TO_LOAD);
        }
        this.takeCollection.refresh();
    };
    ChatMessagesController.prototype.onViewRenderAttachmentImage = function (sinkId, id, attachmentIndex) {
        var _this = this;
        if (this.networkIsDown()) {
            return;
        }
        var entry = this.getMessageEntryById(id, sinkId);
        if (entry == null) {
            return;
        }
        var attachment = entry.getMessage().attachments[attachmentIndex];
        if (attachment == null || attachment.getMimeType().indexOf("image/") != 0) {
            return;
        }
        pmc_mail_1.Q().then(function () {
            return attachment.getContent();
        })
            .progress(function (progress) {
            _this.callViewMethod("setImageProgress", sinkId, id, attachmentIndex, progress);
        })
            .then(function (content) {
            var data = {
                mimetype: content.getMimeType(),
                buffer: content.getBuffer()
            };
            _this.callViewMethod("setImageData", sinkId, id, attachmentIndex, data);
        })
            .fail(this.errorCallback);
    };
    ChatMessagesController.prototype.onFilterMessages = function () {
        this.messagesFilterUpdater.updateFilter(this.app.searchModel.get());
    };
    ChatMessagesController.prototype.onMessageChange = function (event) {
        this.processUnreadMarkers();
    };
    ChatMessagesController.prototype.onSingleMessageChange = function (event) {
        if (event && event.type == "add" && event.element) {
            var msgId = event.element.message ? event.element.message.msgId : event.element.source.data.msgId;
            var sinkId = event.element.message ? event.element.message.sink.id : event.element.sink.id;
            var serverId = event.element.message && event.element.message.serverId ? event.element.message.serverId : event.element.source.serverId;
            this.callViewMethod("removeSendingMessageIfRealMessageExists", msgId, sinkId + "/" + serverId);
        }
    };
    ChatMessagesController.prototype.onMessagesChange = function (event) {
    };
    ChatMessagesController.prototype.processUnreadMarkers = function () {
        var unread = this.messagesCollection.findAll(ChatMessagesController_1.isUnread);
        if (unread.length > 0) {
            if (unread.length >= 5) {
                var beg_1 = unread[0].id;
                var end = unread[unread.length - 1].id;
                var marker = pmc_mail_1.utils.Lang.find(this.unreadMarkers, function (x) { return x.beg == beg_1; });
                if (marker == null) {
                    this.unreadMarkers.push({ beg: beg_1, end: end });
                    this.unreadMarkers.sort(function (a, b) { return a.beg - b.beg; });
                    this.unreadMarkers = [this.unreadMarkers[this.unreadMarkers.length - 1]];
                    this.callViewMethod("setUnreadMarkers", this.unreadMarkers);
                }
                else {
                    marker.end = Math.max(marker.end, end);
                }
            }
        }
        this.callViewMethod("renderMessagesCount", this.getCollectionSize());
    };
    ChatMessagesController.prototype.onEnterSendsChange = function (_type, _settings, caller) {
        if (this != caller) {
            this.callViewMethod("setEnterSends", this.enterSends.get("boolean"));
        }
    };
    ChatMessagesController.prototype.getId = function () {
        if (this.chatInfo) {
            if (this.chatInfo.type == Types_1.ChatType.CHANNEL) {
                return this.chatInfo.section.getId();
            }
            if (this.chatInfo.type == Types_1.ChatType.CONVERSATION) {
                return this.chatInfo.conversation.id;
            }
        }
        return null;
    };
    ChatMessagesController.prototype.getSection = function () {
        if (this.chatInfo.type == Types_1.ChatType.CHANNEL) {
            return this.chatInfo.section;
        }
        if (this.chatInfo.type == Types_1.ChatType.CONVERSATION) {
            return this.chatInfo.conversation.section;
        }
        return null;
    };
    ChatMessagesController.prototype.getOrCreateSection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var section, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        section = this.getSection();
                        if (!(!section && this.chatInfo.type == Types_1.ChatType.CONVERSATION && !this.creatingUserGroupLock)) return [3, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4, this.conv2Service.createUserGroup(this.chatInfo.conversation.users)];
                    case 2:
                        section = _b.sent();
                        if (this.isActive) {
                            this.chatPlugin.activeSinkId = this.chatInfo.conversation.sinkIndex ? this.chatInfo.conversation.sinkIndex.sink.id : null;
                            this.chatPlugin.activeSinkHostHash = this.session.hostHash;
                        }
                        return [3, 4];
                    case 3:
                        _a = _b.sent();
                        this.creatingUserGroupLock = false;
                        return [3, 4];
                    case 4: return [2, section];
                }
            });
        });
    };
    ChatMessagesController.prototype.getSectionId = function () {
        var section = this.getSection();
        return section ? section.getId() : null;
    };
    ChatMessagesController.prototype.getCollectionSize = function () {
        var _this = this;
        var sentCount = 0;
        var newList = [];
        this.sendMessages.forEach(function (x) {
            if (_this.messagesCollection.find(function (y) { return y.source.serverId == x; }) != null) {
                return;
            }
            sentCount++;
            newList.push(x);
        });
        this.sendMessages = newList;
        var baseSize = this.messagesCollection.size();
        if (this.chatInfo.section) {
            var chatModule = this.chatInfo.section.getChatModule();
            if (chatModule && chatModule.sinkIndex) {
                baseSize = this.chatInfo.section.getChatModule().sinkIndex.getMessagesCount();
            }
        }
        else if (this.chatInfo.conversation && this.chatInfo.conversation.section) {
            var chatModule = this.chatInfo.conversation.section.getChatModule();
            if (chatModule && chatModule.sinkIndex) {
                baseSize = this.chatInfo.conversation.section.getChatModule().sinkIndex.getMessagesCount();
            }
        }
        return baseSize + sentCount;
    };
    ChatMessagesController.prototype.getMessageEntryById = function (id, sinkId) {
        var index = this.sinkIndexManager.getIndexBySinkId(sinkId);
        return index ? index.getEntry(id) : null;
    };
    ChatMessagesController.prototype.chatIsActive = function () {
        return this.retrieveFromView("replyFieldHasFocus");
    };
    ChatMessagesController.prototype.thereAreUnreadMessages = function () {
        return this.messagesCollection.find(ChatMessagesController_1.isUnread) != null;
    };
    ChatMessagesController.prototype.getUnreadMessages = function () {
        return this.messagesCollection.findAll(ChatMessagesController_1.isUnread);
    };
    ChatMessagesController.prototype.focus = function () {
        this.callViewMethod("focus");
    };
    ChatMessagesController.prototype.networkIsDown = function () {
        return this.parent.networkIsDown();
    };
    ChatMessagesController.prototype.processMessageQuotes = function (text) {
        var lines = text.split("<br>");
        var _loop_1 = function (i) {
            if (lines[i][0] == "@" && lines[i][1] != "<" && lines[i + 1].startsWith("&gt;")) {
                var uname_1 = lines[i].substr(1).trim();
                var users = this_1.personService.persons.contactCollection.list.filter(function (x) { return x && x.user; });
                var matchingUsers_1 = [];
                users.filter(function (x) { return x.getHashmail() == uname_1; }).forEach(function (u) { return matchingUsers_1.push(u); });
                users.filter(function (x) { return x.getHashmail().split("#")[0] == uname_1; }).forEach(function (u) { return matchingUsers_1.push(u); });
                users.filter(function (x) { return x.getDisplayName() == uname_1; }).forEach(function (u) { return matchingUsers_1.push(u); });
                var user = matchingUsers_1.filter(function (u) { return u && u.getHashmail() && u.getHashmail().indexOf("#") > 0; })[0];
                if (user) {
                    var hashmail = user.getHashmail();
                    var username = user.getDisplayName();
                    lines[i] = "@<privmx-quote-header data-hashmail=\"" + hashmail + "\">" + username + "</privmx-quote-header>";
                }
            }
        };
        var this_1 = this;
        for (var i = 0; i + 1 < lines.length; ++i) {
            _loop_1(i);
        }
        return lines.join("<br>");
    };
    ChatMessagesController.prototype.trySendMessageWithDelay = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return pmc_mail_1.Q().then(function () {
            var def = pmc_mail_1.Q.defer();
            setTimeout(function () {
                def.resolve();
            }, 5000);
            return def.promise;
        })
            .then(function () {
            return _this.sendMessage.apply(_this, args);
        });
    };
    ChatMessagesController.prototype.sendMessage = function (options, queueId) {
        var _this = this;
        var resendOnError = false;
        if (this.creatingUserGroupLock) {
            return this.trySendMessageWithDelay(options, queueId);
        }
        if (options.attachments && this.sendingFileLocksManager.isAnyLocked(options.attachments)) {
            options.attachments = this.sendingFileLocksManager.filterOutLocked(options.attachments);
            return options.attachments.length > 0 ? this.trySendMessageWithDelay(options, queueId) : pmc_mail_1.Q();
        }
        if (this.networkIsDown()) {
            this.parent.showOfflineError();
            return pmc_mail_1.Q();
        }
        var section = this.getSection();
        if (this.isConversationWithDeletedUserOnly()) {
            return pmc_mail_1.Q();
        }
        if (options && options.text) {
            options.text = this.processMessageQuotes(options.text);
        }
        if (section == null && this.chatInfo.type == Types_1.ChatType.CONVERSATION && !this.creatingUserGroupLock) {
            this.creatingUserGroupLock = true;
            var notificationId_1 = this.notifications.showNotification(this.i18n("plugin.chat.component.chatMessages.notification.sending-message"), { autoHide: false, progress: true });
            return pmc_mail_1.Q().then(function () {
                return _this.conv2Service.createUserGroup(_this.chatInfo.conversation.users);
            })
                .then(function () {
                _this.disableFileLinksForNonExistantFiles();
                if (_this.isActive) {
                    _this.chatPlugin.activeSinkId = _this.chatInfo.conversation.sinkIndex ? _this.chatInfo.conversation.sinkIndex.sink.id : null;
                    _this.chatPlugin.activeSinkHostHash = _this.session.hostHash;
                }
                _this.creatingUserGroupLock = false;
                return _this.sendMessage(options);
            })
                .fin(function () {
                _this.notifications.hideNotification(notificationId_1);
                _this.creatingUserGroupLock = false;
                return;
            });
        }
        if (section == null) {
            return;
        }
        var sendingId = ++this.sendingId;
        var refreshMessagesListOnRemoveMessage = false;
        var isFileAndFilesDisabled = false;
        var isChannelThroughFileModule = options.attachments && options.attachments.length == 1 && section.hasFileModule();
        var sendingMessage = isChannelThroughFileModule ?
            this.creatingChannelFileUploadSendingMessage(options.attachments[0], sendingId) :
            this.createSendingMessage(options.text || "", options.attachments || [], sendingId);
        if (isChannelThroughFileModule) {
            if (options.attachments) {
                this.sendingFileLocksManager.lockMany(options.attachments);
            }
        }
        return pmc_mail_1.Q().then(function () {
            if (options && options.text) {
                return _this.app.prepareHtmlMessageBeforeSending(options.text, _this.session).then(function (newText) {
                    options.text = newText;
                });
            }
        }).then(function () {
            return pmc_mail_1.Q().then(function () {
                if (isChannelThroughFileModule) {
                    _this.callViewMethod("renderSendingMessage", sendingMessage);
                    _this.callViewMethod("renderMessagesCount", _this.getCollectionSize() + 1);
                    if (_this.chatPlugin.validMessageJsonTypesForDisplay.indexOf("create-file") == -1) {
                        refreshMessagesListOnRemoveMessage = true;
                        isFileAndFilesDisabled = true;
                    }
                    return pmc_mail_1.Q().then(function () {
                        return section.uploadFile({
                            data: options.attachments[0]
                        });
                    })
                        .then(function (res) {
                        var result = res.mailResult || res.mailWithFileInfoResult;
                        if (result == null || !result.success) {
                            return pmc_mail_1.Q.reject(result ? result.couse : "Unknown result");
                        }
                        return { sinkId: result.receiver.sink.id, serverId: result.source.serverId };
                    });
                }
                return _this.sectionManager.createMessage({
                    destination: section.getId(),
                    text: options.text,
                    attachments: options.attachments
                })
                    .then(function (message) {
                    sendingMessage.msgId = "sending-" + message.msgId;
                    _this.callViewMethod("renderSendingMessage", sendingMessage);
                    _this.callViewMethod("renderMessagesCount", _this.getCollectionSize() + 1);
                    if (!queueId) {
                        _this.messages.freeze();
                    }
                    return pmc_mail_1.Q.resolve()
                        .then(function () {
                        return _this.sectionManager.sendPreparedMessage({
                            destination: section.getId(),
                            text: options.text,
                            attachments: options.attachments
                        }, message);
                    });
                });
            })
                .then(function (info) {
                _this.callViewMethod("removeSendingMessageIfRealMessageExists", sendingId, info.sinkId + "/" + info.serverId);
                if (options.text) {
                    _this.uploadLinkFilesFromText(options.text);
                }
            })
                .fail(function (e) {
                resendOnError = true;
                _this.callViewMethod("removeSendingMessage2", sendingMessage.msgId);
                _this.callViewMethod("renderMessagesCount", _this.getCollectionSize());
                if (e instanceof pmc_mail_1.PrivmxException.Exception && e.message == "invalid-receivers") {
                    resendOnError = false;
                    var msg = _this.i18n("plugin.chat.component.chatMessages.task.sendMessage.error.invalidReceivers", [e.data.join(", ")]);
                    return _this.onErrorCustom(msg, e);
                }
                else if (e && e.message && e.message == "send-msg-error") {
                    resendOnError = false;
                }
            })
                .fin(function () {
                if (!queueId) {
                    _this.messages.unfreeze();
                }
                if (options.attachments) {
                    _this.sendingFileLocksManager.unlockMany(options.attachments);
                }
                if (resendOnError && queueId) {
                    _this.sendingQueue.resend(queueId);
                    return pmc_mail_1.Q.reject();
                }
            });
        });
    };
    ChatMessagesController.prototype.uploadLinkFilesFromText = function (text) {
        var _this = this;
        var section = this.getSection();
        if (section) {
            var numberOfLinks_1 = section.linkFileCreator.getLinksFromText(text).length;
            pmc_mail_1.Q().then(function () {
                if (numberOfLinks_1 >= 3) {
                    return _this.parent.confirm(_this.i18n("plugin.chat.component.chatMessages.confirmCreatingUrlFiles"))
                        .then(function (result) {
                        return result.result == "yes";
                    });
                }
                else {
                    return true;
                }
            })
                .then(function (createLinkFiles) {
                if (createLinkFiles) {
                    section.linkFileCreator.uploadLinkFilesFromText(text, _this.errorCallback);
                }
            });
        }
    };
    ChatMessagesController.prototype.falsyMessageTest = function () {
        return pmc_mail_1.Q().then(function () {
            if (Math.random() > 0.7) {
                throw new Error("cannot-send-message-from-client");
            }
        });
    };
    ChatMessagesController.prototype.triggerUpdateNonExistantFileMessage = function (messageId) {
        var sinkEntry = this.filteredCollection.find(function (x) { return x.id == messageId; });
        var messagesEntryIndex = this.messages.collection.indexOfBy(function (x) { return x.msgNum == messageId; });
        if (messagesEntryIndex == -1 || sinkEntry == null) {
            return;
        }
        this.messages.onCollectionChange({
            type: "update",
            changeId: 0,
            index: messagesEntryIndex,
            element: this.convertSinkIndex(sinkEntry)
        });
    };
    ChatMessagesController.prototype.triggerUpdateMessage = function (messageId) {
        var sinkEntryIndex = this.filteredCollection.indexOfBy(function (x) { return x.id == messageId; });
        if (sinkEntryIndex == -1) {
            return;
        }
        var sinkEntry = this.filteredCollection.get(sinkEntryIndex);
        this.messages.onCollectionChange({
            type: "update",
            changeId: 0,
            index: sinkEntryIndex,
            element: this.convertSinkIndex(sinkEntry)
        });
    };
    ChatMessagesController.prototype.startEditingMessage = function (messageId, text, deleted) {
        this.editing[messageId] = {
            text: text,
            date: new Date().getTime(),
            deleted: deleted
        };
        this.triggerUpdateMessage(messageId);
    };
    ChatMessagesController.prototype.finishEditingMessage = function (messageId) {
        var _this = this;
        delete this.editing[messageId];
        setTimeout(function () {
            _this.triggerUpdateMessage(messageId);
        }, 100);
    };
    ChatMessagesController.prototype.editMessageCore = function (originalMessageId, text, deleted) {
        var _this = this;
        if (this.networkIsDown()) {
            this.parent.showOfflineError();
            return;
        }
        var section = this.getSection();
        if (section == null) {
            return;
        }
        this.addTaskEx(this.i18n("plugin.chat.component.chatMessages.task.sendMessage.text"), true, function () {
            _this.startEditingMessage(originalMessageId, text, deleted);
            return pmc_mail_1.Q().then(function () {
                if (!deleted && text) {
                    _this.encryptionEffect.customShowForChat(text);
                }
            }).then(function () {
                if (text) {
                    return _this.app.prepareHtmlMessageBeforeSending(text, _this.session).then(function (newText) {
                        text = newText;
                    });
                }
            }).then(function () {
                return section.editMessage(originalMessageId, {
                    text: text,
                    attachments: [],
                    deleted: deleted
                });
            })
                .then(function () {
                _this.finishEditingMessage(originalMessageId);
                if (text) {
                    _this.uploadLinkFilesFromText(text);
                }
            })
                .fail(function (e) {
                _this.finishEditingMessage(originalMessageId);
                return _this.onError(e);
            });
        });
    };
    ChatMessagesController.prototype.editMessage = function (originalMessageId, text) {
        return this.editMessageCore(originalMessageId, text, false);
    };
    ChatMessagesController.prototype.deleteMessage = function (originalMessageId) {
        return this.editMessageCore(originalMessageId, "", true);
    };
    ChatMessagesController.prototype.convertSinkIndex = function (model) {
        var _this = this;
        var message = model.getMessage();
        var sender = this.personService.getPersonProxy(message.sender);
        var obj = null;
        var fileInfoIcon = null;
        var taskLabelClass = null;
        var newFilePaths = {};
        if (message.contentType == "application/json") {
            try {
                obj = model.getContentAsJson();
            }
            catch (e) {
                obj = { type: "error", text: message.text };
            }
            var mimeType = obj.path ? pmc_mail_1.mail.filetree.MimeType.resolve2(obj.path, obj.mimeType) : obj.mimeType;
            fileInfoIcon = mimeType ? this.app.shellRegistry.resolveIcon(mimeType) : obj.icon;
            if (obj.type == "create-task" || obj.type == "remove-task" || obj.type == "modify-task" || obj.type == "task-comment") {
                var tasksPlugin = this.app.getComponent("tasks-plugin");
                if (tasksPlugin) {
                    taskLabelClass = tasksPlugin.getLabelClassFor(this.session, this.chatInfo.section.getId(), obj.status, obj.numOfStatuses);
                }
            }
            else if (obj.type == "create-file") {
                var did_1 = obj.did;
                var section_1 = this.getSection();
                var tree = section_1.getFileModule().fileTree;
                if (tree) {
                    var file = tree.collection.find(function (x) { return x.ref.did == did_1; });
                    if (file) {
                        newFilePaths[did_1] = file.path;
                    }
                }
            }
        }
        var emojiMap = {};
        var section = this.getSection();
        if (section) {
            model.stickers.forEach(function (x) {
                var contact = _this.personService.persons.contactCollection.find(function (item) { return item.getUsername() == x.u; });
                if (!contact) {
                    return;
                }
                var person = _this.personService.getPerson(contact.getHashmail());
                if (!person) {
                    return;
                }
                var client = "";
                var userExtraInfo = _this.personService.persons.contactService.getUserExtraInfo(person.username);
                if (userExtraInfo) {
                    var data = userExtraInfo;
                    client = data.client.platform ? "Desktop " + data.client.version : "Web" + data.client.version;
                }
                var personModel = {
                    hashmail: person.getHashmail(),
                    username: person.username,
                    name: person.getName(),
                    present: person.isPresent(),
                    avatar: person.getAvatarWithVersion(),
                    description: person.getDescription(),
                    lastUpdate: person.getLastUpdate().getTime(),
                    isEmail: person.isEmail(),
                    isStarred: person.isStarred(),
                    isExternal: person.username.indexOf("@") >= 0,
                    client: client,
                    deviceName: userExtraInfo ? userExtraInfo.deviceName : "",
                    isAdmin: userExtraInfo ? userExtraInfo.isAdmin : false,
                    lastSeen: userExtraInfo ? Number(userExtraInfo.lastSeenDate) : null,
                    loggedInSince: userExtraInfo ? Number(userExtraInfo.lastLoginDate) : null,
                    ipAddress: ""
                };
                var id = section.decodeSticker(x.s);
                if (!id) {
                    return;
                }
                if (id in emojiMap) {
                    emojiMap[id].count++;
                    emojiMap[id].names += "," + x.u;
                    emojiMap[id].isMy = emojiMap[id].isMy || x.u == _this.identity.user,
                        emojiMap[id].persons.push(personModel);
                }
                else {
                    emojiMap[id] = {
                        id: id,
                        count: 1,
                        names: x.u,
                        isMy: x.u == _this.identity.user,
                        persons: [personModel]
                    };
                }
            });
        }
        var editing = this.editing[model.id];
        var text = editing ? editing.text : message.text;
        var taskStatuses = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, taskStatuses, text);
        if (obj && obj.type == "task-comment") {
            this.tasksPlugin.addTaskStatusesFromMessage(this.session, taskStatuses, obj.comment);
        }
        var isEditable = message.sender.hashmail == this.identity.hashmail && editing == null && (!obj || !obj.type) && this.isLastEditableMessageSinkEntry(model);
        if (isEditable) {
            if (this.lastEditableSinkEntry && this.lastEditableSinkEntry.id != model.id && this.lastEditableSinkEntry.getMessage()) {
                this.transformCollection.triggerBaseUpdateElement(this.lastEditableSinkEntry);
            }
            this.lastEditableSinkEntry = model;
        }
        var nonExistantFileLink = this.entriesWithNonExistantFiles.filter(function (entry) { return entry.id == model.id; }).length > 0;
        return {
            type: ChatMessage_1.ChatMessage.isChatMessage(model) ? "chat" : "mail",
            msgId: model.sink.id + "/" + model.id,
            sendingId: model.message.msgId,
            msgNum: model.id,
            serverDate: message.serverDate.getTime(),
            sender: {
                hashmail: sender.hashmail,
                name: sender.getName(message.sender.name),
                defaultName: pmc_mail_1.utils.Lang.getTrimmedString(message.sender.name),
                description: sender.getDescription()
            },
            title: message.title,
            text: text,
            textAsJson: obj,
            fileInfoIcon: fileInfoIcon,
            contentType: message.contentType,
            attachments: message.attachments.map(function (x) {
                return {
                    name: x.getName(),
                    mimeType: x.getMimeType(),
                    size: x.getSize(),
                    icon: _this.app.shellRegistry.resolveIcon(x.getMimeType())
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
                icons: pmc_mail_1.utils.Lang.getValues(emojiMap)
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
    };
    ChatMessagesController.prototype.getFileTaskLabels = function (section, did, msg) {
        var _this = this;
        this.fileMessagesByDid[did] = msg;
        var tree = section && section.getFileModule() && section.getFileModule().fileTree ? section.getFileModule().fileTree : null;
        if (!tree || !this.tasksPlugin) {
            return [];
        }
        var entry = tree.collection.find(function (x) { return x.ref.did == did; });
        if (!entry || !entry.meta || !entry.meta.bindedElementId) {
            return [];
        }
        var obj = null;
        try {
            obj = JSON.parse(entry.meta.bindedElementId);
        }
        catch (_a) { }
        if (!obj || !obj.taskIds) {
            return [];
        }
        obj.taskIds = obj.taskIds
            .filter(function (x) { return !!x; })
            .map(function (x) { return x.toString(); })
            .filter(function (val, idx, self) { return self.indexOf(val) === idx; });
        return obj.taskIds
            .sort(function (a, b) { return parseInt(a) - parseInt(b); })
            .map(function (taskId) {
            var task = _this.tasksPlugin.getTask(_this.session, taskId);
            if (!task) {
                return null;
            }
            return {
                taskId: task.getId(),
                status: task.getStatus(),
                labelClass: _this.tasksPlugin.getTaskLabelClassByTaskId(_this.session, task.getId()),
            };
        })
            .filter(function (x) { return !!x; });
    };
    ChatMessagesController.prototype.getCurrentFileNames = function () {
    };
    ChatMessagesController.prototype.createSendingMessage = function (text, attachments, sendingId) {
        var _this = this;
        var me = this.personService.getPerson(this.identity.hashmail);
        var now = new Date();
        var taskStatuses = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, taskStatuses, text);
        var section = this.getSection();
        var model = {
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
            attachments: attachments.map(function (x) {
                return {
                    name: x.getName(),
                    size: x.getSize(),
                    mimeType: x.getMimeType(),
                    icon: _this.app.shellRegistry.resolveIcon(x.getMimeType())
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
    };
    ChatMessagesController.prototype.creatingChannelFileUploadSendingMessage = function (attachment, sendingId) {
        var me = this.personService.getPerson(this.identity.hashmail);
        var now = new Date();
        var json = {
            type: "create-file",
            path: "/" + attachment.getName(),
            size: attachment.getSize(),
            mimeType: attachment.getMimeType(),
            icon: this.app.shellRegistry.resolveIcon(attachment.getMimeType())
        };
        var section = this.getSection();
        var model = {
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
            attachments: [],
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
    };
    ChatMessagesController.prototype.onViewTaskCommentClick = function (_msgId, _sinkId, taskId) {
        this.onViewOpenTask(taskId, false);
    };
    ChatMessagesController.getMsgStats = function (serverDate, senderHashmail, prevDate, prevHashmail) {
        var newContext = true;
        var dateSeparator = false;
        if (prevDate) {
            newContext = dateSeparator || prevHashmail != senderHashmail;
            dateSeparator = prevDate.toDateString() != serverDate.toDateString();
        }
        return {
            newContext: newContext,
            dateSeparator: dateSeparator
        };
    };
    ChatMessagesController.isUnread = function (entry) {
        return ChatMessage_1.ChatMessage.isChatMessage(entry) && !entry.isRead();
    };
    ChatMessagesController.meetsFilter = function (entry, word) {
        if (!entry) {
            return false;
        }
        if (entry.source.data.contentType == "application/json") {
            var data = entry.getContentAsJson();
            if (data.type == "create-file") {
                var name_1 = data.path.substr(data.path.lastIndexOf("/") + 1);
                return pmc_mail_1.app.common.SearchFilter.matches(word, name_1);
            }
            if (data.type == "create-task" || data.type == "modify-task") {
                return pmc_mail_1.app.common.SearchFilter.matches(word, data.name);
            }
            if (data.type == "task-comment") {
                return pmc_mail_1.app.common.SearchFilter.matches(word, data.comment);
            }
            return false;
        }
        if (pmc_mail_1.app.common.SearchFilter.matches(word, entry.source.data.text)) {
            return true;
        }
        return false;
    };
    ChatMessagesController.prototype.onViewChangeSetting = function (setting, value) {
        var settings = this.chatPlugin.getGUISettings();
        settings[setting] = value;
        this.chatPlugin.updateGUISettings(settings);
    };
    ChatMessagesController.prototype.onViewChangeViewSetting = function (setting, value) {
        var _this = this;
        var settings = this.chatPlugin.getViewSettings();
        settings[setting] = value;
        this.chatPlugin.updateViewSettings(settings).then(function () {
            if (setting == "show-search-contexts") {
                if (_this.isFilterEnabled()) {
                    _this.refreshMatches();
                    _this.updateSearchState();
                }
            }
        });
    };
    ChatMessagesController.prototype.activate = function () {
        var _this = this;
        this.afterViewLoaded.promise.then(function () {
            _this.callViewMethod("ensureActivated");
        });
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.messagesFilterUpdater.updateFilter(this.app.searchModel.get(), true);
        this.updateVoiceChatUsersOfMine();
    };
    ChatMessagesController.prototype.deactivate = function () {
        if (!this.isActive) {
            return;
        }
        this.isActive = false;
        this.messagesFilterUpdater.onDeactivateMessages();
    };
    ChatMessagesController.prototype.getSearchState = function () {
        return {
            active: this.isFilterEnabled(),
            resultsCount: this.takeCollection.list.length,
            mayHaveMoreResults: this.takeCollectionSeq > 0,
        };
    };
    ChatMessagesController.prototype.updateSearchState = function () {
        var newState = this.getSearchState();
        if (this.previousSearchState != newState && this.parent && newState.active) {
            var section = null;
            if (this.chatInfo.section) {
                section = this.chatInfo.section;
            }
            else if (this.chatInfo.conversation && this.chatInfo.conversation.section) {
                section = this.chatInfo.conversation.section;
            }
            this.parent.dispatchEvent({
                type: "chatupdatesearchstatsevent",
                hostHash: this.session.hostHash,
                sectionId: section.getId(),
                allSearched: !newState.mayHaveMoreResults,
                searchCount: newState.resultsCount,
            });
        }
        this.previousSearchState = newState;
        this.callViewMethod("updateSearchState", JSON.stringify(newState));
    };
    ChatMessagesController.prototype.onViewUpdateCanWrite = function () {
        this.callViewMethod("updateCanWrite", this.canWrite());
    };
    ChatMessagesController.prototype.canWrite = function () {
        var person = this.personService.getMe();
        return !(this.getSection() == null && this.chatInfo.type == Types_1.ChatType.CONVERSATION && person.username.indexOf("@") >= 0) && !this.isConversationWithDeletedUserOnly();
    };
    ChatMessagesController.prototype.isConversationWithDeletedUserOnly = function () {
        if (this.chatInfo.type == Types_1.ChatType.CONVERSATION) {
            if (this.chatInfo.conversation.isSingleContact()) {
                var userName = this.chatInfo.conversation.getFirstPerson().contact.getUsername();
                if (this.chatInfo.conversation.conv2Service.contactService.isUserDeleted(userName)) {
                    return true;
                }
            }
        }
        return false;
    };
    ChatMessagesController.prototype.onViewPasteSeemsEmpty = function () {
        var _this = this;
        pmc_mail_1.Q().then(function () {
            return _this.app.getClipboardElementToPaste([
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILE,
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_PRIVMX_FILES,
            ], [
                pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES,
            ]);
        })
            .then(function (element) {
            if (element && element.data && element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]) {
                var files = JSON.parse(element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]).map(function (x) {
                    if (x.data && x.data.type == "Buffer" && x.data.data) {
                        x.data = new Buffer(x.data.data);
                    }
                    return x;
                });
                var _loop_2 = function (file) {
                    var fileName = file.path;
                    var data = file.data ? file.data : require("fs").readFileSync(file.path);
                    pmc_mail_1.Q().then(function () {
                        var section = _this.getSection();
                        if (section == null && _this.chatInfo.type == Types_1.ChatType.CONVERSATION && !_this.creatingUserGroupLock) {
                            _this.creatingUserGroupLock = true;
                            return pmc_mail_1.Q().then(function () {
                                return _this.conv2Service.createUserGroup(_this.chatInfo.conversation.users);
                            })
                                .then(function (usergroup) {
                                if (_this.isActive) {
                                    _this.chatPlugin.activeSinkId = _this.chatInfo.conversation.sinkIndex ? _this.chatInfo.conversation.sinkIndex.sink.id : null;
                                    _this.chatPlugin.activeSinkHostHash = _this.session.hostHash;
                                }
                                _this.creatingUserGroupLock = false;
                                return usergroup;
                            });
                        }
                        return section;
                    })
                        .then(function () {
                        if (!fileName) {
                            return _this.app.generateUniqueFileName(_this.getSection(), "/", file.mime.split("/")[1]);
                        }
                        else if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                            return fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                        }
                        return fileName;
                    })
                        .then(function (fn) {
                        fileName = fn;
                        _this.sendMessage({
                            attachments: [pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)],
                        });
                    });
                };
                for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
                    var file = files_1[_i];
                    _loop_2(file);
                }
            }
        });
    };
    ChatMessagesController.prototype.tryPaste = function (element, originalText) {
        var _this = this;
        if (element && element.data && element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]) {
            var files = JSON.parse(element.data[pmc_mail_1.app.common.clipboard.Clipboard.FORMAT_SYSTEM_FILES]).map(function (x) {
                if (x.data && x.data.type == "Buffer" && x.data.data) {
                    x.data = new Buffer(x.data.data);
                }
                return x;
            });
            var _loop_3 = function (file) {
                var fileName = file.path;
                var data = file.data ? file.data : require("fs").readFileSync(file.path);
                pmc_mail_1.Q().then(function () {
                    var section = _this.getSection();
                    if (section == null && _this.chatInfo.type == Types_1.ChatType.CONVERSATION && !_this.creatingUserGroupLock) {
                        _this.creatingUserGroupLock = true;
                        return pmc_mail_1.Q().then(function () {
                            return _this.conv2Service.createUserGroup(_this.chatInfo.conversation.users);
                        })
                            .then(function (usergroup) {
                            if (_this.isActive) {
                                _this.chatPlugin.activeSinkId = _this.chatInfo.conversation.sinkIndex ? _this.chatInfo.conversation.sinkIndex.sink.id : null;
                                _this.chatPlugin.activeSinkHostHash = _this.session.hostHash;
                            }
                            _this.creatingUserGroupLock = false;
                            return usergroup;
                        });
                    }
                    return section;
                })
                    .then(function () {
                    if (!fileName) {
                        return _this.app.generateUniqueFileName(_this.getSection(), "/", file.mime.split("/")[1]);
                    }
                    else if (fileName.indexOf("/") >= 0 || fileName.indexOf("\\") >= 0) {
                        return fileName.substr(fileName.replace(/\\/g, "/").lastIndexOf("/") + 1);
                    }
                    return fileName;
                })
                    .then(function (fn) {
                    fileName = fn;
                    _this.sendMessage({
                        attachments: [pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(data, file.mime, fileName)],
                    });
                });
            };
            for (var _i = 0, files_2 = files; _i < files_2.length; _i++) {
                var file = files_2[_i];
                _loop_3(file);
            }
        }
    };
    ChatMessagesController.prototype.onViewPasteSeemsFile = function (pathsStr, originalText) {
        var _this = this;
        var paths = [];
        if (this.app.getPlatform() == "darwin") {
            var files = this.app.getSystemClipboardFiles();
            if (files && files.length > 0) {
                files.forEach(function (f) {
                    if (f.data && f.path && f.mime) {
                        paths.push(f.path);
                    }
                });
            }
        }
        else {
            paths = JSON.parse(pathsStr);
            paths = paths.map(function (x) { return decodeURI(x); });
        }
        this.parent.tryPasteFiles(paths).then(function (pasteAsFile) {
            if (pasteAsFile) {
                for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
                    var path = paths_1[_i];
                    path = path.startsWith("file://") ? path.substr("file://".length) : path;
                    var buff = _this.app.getFileBuffer(path);
                    if (buff === null) {
                        continue;
                    }
                    var mime = pmc_mail_1.mail.filetree.MimeType.resolve(path);
                    _this.pasteFile(mime, buff, path);
                }
            }
            else {
                _this.callViewMethod("pastePlainText", originalText);
            }
        });
    };
    ChatMessagesController.prototype.pasteFile = function (mime, data, path) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var filename = _this.app.getFileName(path);
            return _this.sendMessage({
                attachments: [pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(data, mime, filename)],
            });
        });
    };
    ChatMessagesController.prototype.rewindMessagesIfNeeded = function () {
        this.callViewMethod("checkMessagesAndRewind");
    };
    ChatMessagesController.prototype.onViewUpdateIsTldr = function (isTldrStr) {
        var isTldr = JSON.parse(isTldrStr);
        for (var msgNum in isTldr) {
            if (isTldr[msgNum]) {
                this.msgIsTldr[msgNum] = true;
            }
            else {
                delete this.msgIsTldr[msgNum];
            }
        }
    };
    ChatMessagesController.prototype.onViewUpdateIsExpanded = function (msgNum, isExpanded) {
        if (isExpanded) {
            this.msgIsExpanded[msgNum] = true;
        }
        else {
            delete this.msgIsExpanded[msgNum];
        }
    };
    ChatMessagesController.prototype.onViewUpdateQuoteIsExpanded = function (msgNum, quoteId, isExpanded) {
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
    };
    ChatMessagesController.prototype.getExpandedQuotes = function (msgNum) {
        return this.quoteIsExpanded[msgNum] ? Object.keys(this.quoteIsExpanded[msgNum]).map(function (x) { return parseInt(x); }) : [];
    };
    ChatMessagesController.prototype.setSession = function (session) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.session = session;
            _this.thumbs.setSession(session);
            return pmc_mail_1.Q.all([
                pmc_mail_1.Q.all([
                    _this.session.mailClientApi.privmxRegistry.getMessageFlagsUpdater(),
                    _this.session.mailClientApi.privmxRegistry.getIdentity(),
                    _this.session.mailClientApi.privmxRegistry.getHashmailResolver(),
                    _this.session.mailClientApi.privmxRegistry.getPersonService(),
                ]),
                pmc_mail_1.Q.all([
                    _this.session.mailClientApi.privmxRegistry.getSinkIndexManager(),
                    _this.session.mailClientApi.privmxRegistry.getMessageService(),
                    _this.session.mailClientApi.privmxRegistry.getConv2Service(),
                    _this.session.mailClientApi.privmxRegistry.getSectionManager().then(function (sm) {
                        return sm.load().thenResolve(sm);
                    })
                ])
            ])
                .then(function (res) {
                _this.messageFlagsUpdater = res[0][0];
                _this.identity = res[0][1];
                _this.hashmailResolver = res[0][2];
                _this.personService = res[0][3];
                _this.sinkIndexManager = res[1][0];
                _this.messageService = res[1][1];
                _this.conv2Service = res[1][2];
                _this.sectionManager = res[1][3];
                _this.messagesMarkerQueueEx = new MessagesMarkerQueue_1.MessagesMarkerQueueEx(new MessagesMarkerQueue_1.MessagesMarkerQueue(_this.messageFlagsUpdater, _this.logErrorCallback), _this);
                _this.messagesMarkerQueueEx.reset();
            });
        });
    };
    ChatMessagesController.prototype.getSession = function () {
        return this.session;
    };
    ChatMessagesController.prototype.sendQueuedTextMessage = function (text, queueId) {
        return this.sendMessage({ text: text }, queueId);
    };
    ChatMessagesController.prototype.onViewLoadImages = function (didsStr, scrollToBottom) {
        var _this = this;
        this.scrollToBottomOnLoadImages = scrollToBottom;
        var dids = JSON.parse(didsStr);
        var section = this.getSection();
        if (!section) {
            return;
        }
        section.getFileTree().then(function (tree) {
            _this.sectionTree = tree;
            return _this.sendEntriesImagesToView(dids, scrollToBottom);
        })
            .then(function () {
            setTimeout(function () {
                _this.callViewMethod("toggleScrollEnabled", true, scrollToBottom);
            }, 100);
        })
            .fail(this.errorCallback);
    };
    ChatMessagesController.prototype.sectionTreeCollectionChanged = function () {
        if (!this.sectionTree || !this.imgDidsToProcess || this.imgDidsToProcess.length == 0) {
            return;
        }
        var dids = this.imgDidsToProcess.slice();
        this.imgDidsToProcess = [];
        this.sendEntriesImagesToView(dids, this.scrollToBottomOnLoadImages);
    };
    ChatMessagesController.prototype.sendEntriesImagesToView = function (dids, scrollToBottom) {
        var _this = this;
        var entries = this.sectionTree.collection.list.filter(function (f) { return f.path.indexOf("/.trash/") == -1; }).filter(function (x) { return dids.indexOf(x.ref.did) >= 0; });
        var missingDids = dids.filter(function (x) { return _this.sectionTree.collection.list.filter(function (y) { return y.ref.did == x; }).length == 0; });
        if (missingDids.length > 0) {
            for (var _i = 0, missingDids_1 = missingDids; _i < missingDids_1.length; _i++) {
                var did = missingDids_1[_i];
                if (this.imgDidsToProcess.indexOf(did) < 0) {
                    this.imgDidsToProcess.push(did);
                }
            }
            if (!this.sectionTreeCollectionChangedBound) {
                this.sectionTreeCollectionChangedBound = this.sectionTreeCollectionChanged.bind(this);
                this.sectionTree.collection.changeEvent.add(this.sectionTreeCollectionChangedBound);
            }
        }
        var prom = pmc_mail_1.Q();
        var _loop_4 = function (entry) {
            prom = prom.then(function () {
                return _this.getSection().getFileOpenableElement(entry.path, false).then(function (file) {
                    return file.getContent();
                })
                    .then(function (content) {
                    var data = {
                        mimetype: content.getMimeType(),
                        buffer: content.getBuffer()
                    };
                    _this.afterViewLoaded.promise.then(function () {
                        _this.callViewMethod("setImageSrc", entry.ref.did, data, scrollToBottom);
                    });
                });
            });
        };
        for (var _a = 0, entries_1 = entries; _a < entries_1.length; _a++) {
            var entry = entries_1[_a];
            _loop_4(entry);
        }
        return prom;
    };
    ChatMessagesController.prototype.getContextSize = function () {
        return this.chatPlugin.getShowSearchContexts() ? ChatMessagesController_1.SEARCH_CONTEXT_SIZE : 0;
    };
    ChatMessagesController.prototype.refreshMatches = function (withoutRebuild) {
        if (withoutRebuild === void 0) { withoutRebuild = false; }
        var searchStr = this.isFilterEnabled() ? this.messagesFilterUpdater.filter.value : null;
        if (!searchStr) {
            for (var _i = 0, _a = this.messagesCollection.list; _i < _a.length; _i++) {
                var entry = _a[_i];
                this.distancesFromClosestMatch[entry.id] = 0;
            }
        }
        else {
            var lastMatchingIndex = Number.NEGATIVE_INFINITY;
            for (var i = 0; i < this.messagesCollection.list.length; ++i) {
                var entry = this.messagesCollection.list[i];
                var currContextSize = ChatMessagesController_1.SEARCH_CONTEXT_SIZE;
                if (ChatMessagesController_1.meetsFilter(entry, searchStr)) {
                    this.distancesFromClosestMatch[entry.id] = 0;
                    lastMatchingIndex = i;
                    for (var d = 1; d <= currContextSize; ++d) {
                        var j = i - d;
                        if (j < 0) {
                            break;
                        }
                        var id2 = this.messagesCollection.list[j].id;
                        var newValue = Math.min(d, this.distancesFromClosestMatch[id2]);
                        this.distancesFromClosestMatch[id2] = newValue;
                    }
                }
                else {
                    var dist = i - lastMatchingIndex;
                    this.distancesFromClosestMatch[entry.id] = dist <= currContextSize ? dist : Number.POSITIVE_INFINITY;
                }
            }
        }
        if (!withoutRebuild) {
            this.filteredCollection.rebuild();
        }
    };
    ChatMessagesController.prototype.onViewStartTalk = function () {
        this.app.dispatchEvent({ type: "streamsAction", action: "talk", sectionId: this.getSection().getId(), hostHash: this.session.hostHash });
    };
    ChatMessagesController.prototype.refreshFileMessagesByDid = function (did) {
        var _this = this;
        var msg = this.fileMessagesByDid[did];
        if (msg) {
            setTimeout(function () {
                _this.triggerUpdateMessage(msg.id);
                _this.transformCollection.triggerBaseUpdateElement(msg);
            }, 2000);
        }
    };
    ChatMessagesController.prototype.upload = function (path, content, fileNamesDeferred) {
        var _this = this;
        if (content === void 0) { content = null; }
        if (fileNamesDeferred === void 0) { fileNamesDeferred = null; }
        var getCnt;
        if (content) {
            getCnt = pmc_mail_1.Q(Array.isArray(content) ? content : [content]);
        }
        else {
            getCnt = this.app.shellRegistry.callAppMultiAction("core.upload-multi", null, this.parent.getClosestNotDockedController().nwin);
        }
        return getCnt.then(function (contents) {
            if (!contents || (contents && contents.length == 0)) {
                return;
            }
            var notificationId = _this.notifications.showNotification(_this.i18n("plugin.chat.component.chatMessages.notification.importingFile"), { autoHide: false, progress: true });
            var ids = [];
            var prom = pmc_mail_1.Q();
            var _loop_5 = function (content_1) {
                prom = prom.then(function () {
                    return _this.uploadFile({
                        data: content_1,
                        path: path
                    })
                        .then(function (result) {
                        ids.push(result.fileResult.entryId);
                    });
                });
            };
            for (var _i = 0, contents_1 = contents; _i < contents_1.length; _i++) {
                var content_1 = contents_1[_i];
                _loop_5(content_1);
            }
            return prom.then(function (result) {
                if (fileNamesDeferred) {
                    fileNamesDeferred.resolve(ids);
                }
            })
                .progress(function (progress) {
                _this.notifications.progressNotification(notificationId, progress);
            })
                .fin(function () {
                _this.notifications.hideNotification(notificationId);
            });
        })
            .fail(this.errorCallback);
    };
    ChatMessagesController.prototype.uploadFile = function (options) {
        var section = this.getSection();
        if (section == null) {
            throw new Error("Cannot upload file, current chatMessages has no assigned section");
        }
        return section.uploadFile(options);
    };
    ChatMessagesController.prototype.toggleIsInVoiceChatInThisSection = function (isInVoiceChat) {
        this.callViewMethod("toggleIsInVoiceChatInThisSection", isInVoiceChat);
    };
    ChatMessagesController.prototype.toggleIsInVoiceChatInAnotherSection = function (isInVoiceChat) {
        this.callViewMethod("toggleIsInVoiceChatInAnotherSection", isInVoiceChat);
    };
    ChatMessagesController.prototype.toggleIsVoiceChatActiveInThisSection = function (isActive) {
        this.callViewMethod("toggleIsVoiceChatActiveInThisSection", isActive);
    };
    ChatMessagesController.prototype.toggleIsTalkingInThisSection = function (isTalking) {
        this.callViewMethod("toggleIsTalkingInThisSection", isTalking);
    };
    ChatMessagesController.prototype.toggleIsTalkingInAnotherSection = function (isTalking) {
        this.callViewMethod("toggleIsTalkingInAnotherSection", isTalking);
    };
    ChatMessagesController.prototype.toggleRingTheBellAvailable = function (avail) {
        this.callViewMethod("toggleRingTheBellAvailable", avail);
    };
    ChatMessagesController.prototype.onViewJoinVoiceChat = function () {
        var _this = this;
        pmc_mail_1.Q().then(function () {
            if (_this.isInVoiceChatInAnotherSection()) {
                return _this.app.openSwitchVoiceChatConfirm()
                    .then(function (confirmResult) {
                    if (confirmResult == true) {
                        _this.app.voiceChatService.leaveVoiceChat();
                        return true;
                    }
                    else {
                        return false;
                    }
                });
            }
            else {
                return true;
            }
        })
            .then(function (res) {
            if (res == true) {
                var section_2 = _this.getSection();
                return pmc_mail_1.Q().then(function () {
                    if (section_2 == null && _this.chatInfo.type == Types_1.ChatType.CONVERSATION && !_this.creatingUserGroupLock) {
                        _this.creatingUserGroupLock = true;
                        var notificationId_2 = _this.notifications.showNotification(_this.i18n("plugin.chat.component.chatMessages.notification.preparing"), { autoHide: false, progress: true });
                        return pmc_mail_1.Q().then(function () {
                            return _this.conv2Service.createUserGroup(_this.chatInfo.conversation.users);
                        })
                            .then(function (createdSection) {
                            section_2 = createdSection;
                            if (_this.isActive) {
                                _this.chatPlugin.activeSinkId = _this.chatInfo.conversation.sinkIndex ? _this.chatInfo.conversation.sinkIndex.sink.id : null;
                                _this.chatPlugin.activeSinkHostHash = _this.session.hostHash;
                            }
                        })
                            .fin(function () {
                            _this.notifications.hideNotification(notificationId_2);
                            _this.creatingUserGroupLock = false;
                        });
                    }
                })
                    .then(function () {
                    return _this.session.services.voiceChatServiceApi.getRoomInfo(section_2);
                })
                    .then(function (roomInfo) {
                    _this.app.voiceChatService.joinVoiceChat(_this.session, section_2, roomInfo.users, function () {
                        return _this.session.services.voiceChatServiceApi.getRoomInfo(section_2).then(function (roomInfo) { return roomInfo.users; });
                    });
                })
                    .then(function () {
                    _this.getSection().getChatModule().sendVoiceChatActivityMessage("joined-voicechat", _this.identity.hashmail);
                    _this.updateVoiceChatUsersOfMine();
                })
                    .fail(function (e) { return console.log(e); });
            }
        });
    };
    ChatMessagesController.prototype.onViewLeaveVoiceChat = function () {
        this.app.voiceChatService.leaveVoiceChat();
        this.getSection().getChatModule().sendVoiceChatActivityMessage("left-voicechat", this.identity.hashmail);
        this.updateVoiceChatUsersOfMine();
    };
    ChatMessagesController.prototype.onViewJoinVideoConference = function () {
        return __awaiter(this, void 0, void 0, function () {
            var polling, conferenceExists, section, sectionId_1, conferenceData, result, options, options;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        polling = this.app.videoConferencesService.polling.recentPollingResults;
                        conferenceExists = false;
                        return [4, this.getOrCreateSection()];
                    case 1:
                        section = _a.sent();
                        if (polling && polling[this.session.hostHash] && polling[this.session.hostHash].conferencesData) {
                            sectionId_1 = section.getId();
                            conferenceData = polling[this.session.hostHash].conferencesData.filter(function (conferenceData) { return conferenceData.sectionId == sectionId_1; })[0];
                            conferenceExists = !!conferenceData;
                        }
                        if (!(this.isUserInAnyVideoConference() && this.chatPlugin.currentVideoConferenceWindowController)) return [3, 8];
                        if (!this.isUserInVideoConferenceInThisSection()) return [3, 2];
                        this.chatPlugin.bringVideoConferenceWindowToFront();
                        return [3, 7];
                    case 2: return [4, this.parent.msgBox({
                            message: this.i18n("plugin.chat.switchVideoConferenceMsgBox.message"),
                            yes: {
                                faIcon: "",
                                btnClass: "btn-success",
                                label: this.i18n("plugin.chat.switchVideoConferenceMsgBox.switch"),
                                visible: true,
                            },
                            cancel: {
                                faIcon: "",
                                btnClass: "btn-default",
                                label: this.i18n("plugin.chat.switchVideoConferenceMsgBox.cancel"),
                                visible: true,
                            },
                        })];
                    case 3:
                        result = _a.sent();
                        if (!(result.result == "yes")) return [3, 6];
                        options = {
                            title: "",
                            experimentalH264: false,
                        };
                        if (!!conferenceExists) return [3, 5];
                        return [4, this.obtainNewVideoConferenceOptions()];
                    case 4:
                        options = _a.sent();
                        if (!options) {
                            return [2];
                        }
                        _a.label = 5;
                    case 5:
                        this.chatPlugin.switchVideoConference(this.session, this.chatInfo.type == Types_1.ChatType.CHANNEL ? this.chatInfo.section : null, this.chatInfo.type == Types_1.ChatType.CHANNEL ? null : this.chatInfo.conversation, options);
                        return [3, 7];
                    case 6:
                        if (result.result == "no") {
                            setTimeout(function () {
                                _this.chatPlugin.bringVideoConferenceWindowToFront();
                            }, 500);
                        }
                        else if (result.result == "cancel") {
                        }
                        _a.label = 7;
                    case 7: return [3, 11];
                    case 8:
                        options = {
                            title: "",
                            experimentalH264: false,
                        };
                        if (!!conferenceExists) return [3, 10];
                        return [4, this.obtainNewVideoConferenceOptions()];
                    case 9:
                        options = _a.sent();
                        if (!options) {
                            return [2];
                        }
                        _a.label = 10;
                    case 10:
                        this.app.dispatchEvent({
                            type: "join-video-conference",
                            hostHash: this.session.hostHash,
                            section: this.chatInfo.type == Types_1.ChatType.CHANNEL ? this.chatInfo.section : null,
                            conversation: this.chatInfo.type == Types_1.ChatType.CHANNEL ? null : this.chatInfo.conversation,
                            roomMetadata: {
                                creatorHashmail: this.session.conv2Service.identity.hashmail,
                                title: options.title,
                                experimentalH264: options.experimentalH264,
                            },
                        });
                        _a.label = 11;
                    case 11: return [2];
                }
            });
        });
    };
    ChatMessagesController.prototype.obtainNewVideoConferenceOptions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var optionsStr;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.retrieveFromView("obtainNewVideoConferenceOptionsStr")];
                    case 1:
                        optionsStr = _a.sent();
                        return [2, JSON.parse(optionsStr)];
                }
            });
        });
    };
    ChatMessagesController.prototype.onViewVideoConferenceDisconnect = function () {
        if (!this.isUserInAnyVideoConference() || !this.isUserInVideoConferenceInThisSection()) {
            return;
        }
        var section = this.getSection();
        if (!section) {
            return;
        }
        this.app.dispatchEvent({
            type: "leave-video-conference",
        });
        var conferenceId = this.app.videoConferencesService.getConferenceIdBySection(this.session, section);
        this.app.videoConferencesService.leaveConference(this.session, section, conferenceId);
    };
    ChatMessagesController.prototype.onViewVideoConferenceGong = function (message) {
        var section = this.getSection();
        if (section) {
            this.chatPlugin.gong(this.session, section, message);
        }
    };
    ChatMessagesController.prototype.updateVoiceChatUsersOfMine = function () {
        var section = this.chatInfo.section ? this.chatInfo.section : null;
        var conv = this.chatInfo.conversation ? this.chatInfo.conversation : null;
        if (conv == null && section == null) {
            Logger.warn("updateVoiceChatUsersOfMine on not fully loaded section");
            return;
        }
        var id = section ? section.getId() : conv.id;
        this.app.eventDispatcher.dispatchEvent({ type: "update-voice-chat-users", hostHash: this.session.hostHash, sectionId: id });
    };
    ChatMessagesController.prototype.onViewToggleTalking = function () {
        if (this.isTalkingInThisSection()) {
            this.app.voiceChatService.stopTalking();
        }
        else {
            this.app.voiceChatService.startTalking();
        }
    };
    ChatMessagesController.prototype.onViewRingTheBell = function () {
        var section = this.getSection();
        if (!section) {
            return;
        }
        this.app.voiceChatService.ringTheBell(this.session, section, this.chatInfo.conversation);
    };
    ChatMessagesController.prototype.onViewShowPlayerWindow = function () {
        console.log("show player window event");
        var playerHelperWindow = this.app.windows.playerHelper;
        if (playerHelperWindow) {
            playerHelperWindow.nwin.show();
        }
    };
    ChatMessagesController.prototype.onGotVideoConferencesPollingResult = function (event) {
        this.updateSectionVideoConferenceModelIfChanged();
    };
    ChatMessagesController.prototype.updateSectionVideoConferenceModelIfChanged = function () {
        var sectionVideoConferenceModelStr = JSON.stringify(this.getSectionVideoConferenceModel());
        if (sectionVideoConferenceModelStr != this.previousSectionVideoConferenceModelStr) {
            this.previousSectionVideoConferenceModelStr = sectionVideoConferenceModelStr;
            this.callViewMethod("setSectionVideoConferenceModel", sectionVideoConferenceModelStr);
        }
    };
    ChatMessagesController.prototype.doesHostHashMatchCurrentSession = function (hostHash) {
        return this.session && this.session.hostHash == hostHash;
    };
    ChatMessagesController.prototype.convertHashmailToVideoConferencePersonModel = function (hashmail) {
        var contact = this.getContactFromHashmail(hashmail);
        if (!contact) {
            return null;
        }
        return {
            hashmail: hashmail,
            name: contact.getDisplayName(),
        };
    };
    ChatMessagesController.prototype.getContactFromHashmail = function (hashmail) {
        var person = this.personService.getPerson(hashmail);
        return person ? person.contact : null;
    };
    ChatMessagesController.prototype.isUserInAnyVideoConference = function () {
        return this.chatPlugin.isUserInAnyVideoConference();
    };
    ChatMessagesController.prototype.isUserInVideoConferenceInThisSection = function () {
        return this.chatPlugin.isInVideoConference(this.session, this.chatInfo.type == Types_1.ChatType.CHANNEL ? this.chatInfo.section : null, this.chatInfo.type == Types_1.ChatType.CHANNEL ? null : this.chatInfo.conversation);
    };
    ChatMessagesController.prototype.isVideoConferenceActive = function () {
        return this.chatPlugin.isVideoConferenceActive(this.session, this.chatInfo.type == Types_1.ChatType.CHANNEL ? this.chatInfo.section : null, this.chatInfo.type == Types_1.ChatType.CHANNEL ? null : this.chatInfo.conversation);
    };
    ChatMessagesController.prototype.getVideoConferenceParticipantHashmails = function () {
        return this.chatPlugin.getVideoConferenceParticipantHashmails(this.session, this.chatInfo.type == Types_1.ChatType.CHANNEL ? this.chatInfo.section : null, this.chatInfo.type == Types_1.ChatType.CHANNEL ? null : this.chatInfo.conversation);
    };
    ChatMessagesController.prototype.getSectionVideoConferenceModel = function () {
        var _this = this;
        if (!this.chatInfo) {
            return {
                isUserInAnyVideoConference: this.isUserInAnyVideoConference(),
                isUserParticipating: false,
                isVideoConferenceActive: false,
                personModels: [],
            };
        }
        return {
            isUserInAnyVideoConference: this.isUserInAnyVideoConference(),
            isUserParticipating: this.isUserInVideoConferenceInThisSection(),
            isVideoConferenceActive: this.isVideoConferenceActive(),
            personModels: this.getVideoConferenceParticipantHashmails().map(function (hashmail) { return _this.convertHashmailToVideoConferencePersonModel(hashmail); }),
        };
    };
    var ChatMessagesController_1;
    ChatMessagesController.textsPrefix = "plugin.chat.component.chatMessages.";
    ChatMessagesController.MAX_MSG_TEXT_SIZE = 100000;
    ChatMessagesController.MESSAGES_TO_LOAD = 30;
    ChatMessagesController.MIN_SEARCH_RESULTS_TO_LOAD = 10;
    ChatMessagesController.SEARCH_CONTEXT_SIZE = 3;
    ChatMessagesController.IS_VOICE_CHAT_ENABLED = false;
    __decorate([
        Inject
    ], ChatMessagesController.prototype, "messageFlagsUpdater", void 0);
    __decorate([
        Inject
    ], ChatMessagesController.prototype, "identity", void 0);
    __decorate([
        Inject
    ], ChatMessagesController.prototype, "hashmailResolver", void 0);
    __decorate([
        Inject
    ], ChatMessagesController.prototype, "personService", void 0);
    __decorate([
        Inject
    ], ChatMessagesController.prototype, "sinkIndexManager", void 0);
    __decorate([
        Inject
    ], ChatMessagesController.prototype, "messageService", void 0);
    __decorate([
        Inject
    ], ChatMessagesController.prototype, "conv2Service", void 0);
    ChatMessagesController = ChatMessagesController_1 = __decorate([
        Dependencies(["splitter", "extlist", "persons", "emojipicker", "emojiviewbar", "notification"])
    ], ChatMessagesController);
    return ChatMessagesController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.ChatMessagesController = ChatMessagesController;
SearchState.prototype.className = "com.privmx.plugin.chat.component.chatmessages.SearchState";
MessagesFilterUpdater.prototype.className = "com.privmx.plugin.chat.component.chatmessages.MessagesFilterUpdater";
ChatMessagesController.prototype.className = "com.privmx.plugin.chat.component.chatmessages.ChatMessagesController";

//# sourceMappingURL=ChatMessagesController.js.map
