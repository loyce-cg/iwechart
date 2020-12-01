import {component, webUtils, window as wnd, Q, JQuery as $, VoiceChatViewModule as VoiceChat} from "pmc-web";
import {mail, Types} from "pmc-mail";
import {func as chatTemplate} from "./template/chat.html";
import {func as chatMessageInnerTemplate} from "./template/chat-message-inner.html";
import {func as chatReplyTemplate} from "./template/chat-reply.html";
import {func as voiceChatPeopleTemplate} from "./template/voice-chat-people.html";

import {func as chatHeaderProfilesTemplate} from "./template/chat-header-profiles.html";
import {func as msgCountTemplate} from "./template/msg-count.html";
import {Model, InnerMessageModel, Marker, SearchState} from "./ChatMessagesController";
import {ChatType} from "../../main/Types";
import { GUISettings } from "../../main/ChatPlugin";
import { ChatWindowView } from "../../window/chat/ChatWindowView";

export interface EntryToRemove {
    sendingId: number;
    realMessageId: number;
    isFileAndFilesDisabled: boolean;
}

export class EditMessageState {
    dirty: boolean;
    originalText: string;
    onInput: () => void;
    constructor(originalText: string, onInput: () => void) {
        this.originalText = originalText;
        this.dirty = false;
        this.onInput = onInput;
    }
}

export class ChatMessagesView extends component.base.ComponentView {
    
    static readonly LOAD_MORE_MESSAGES_SCROLL_OFFSET: number = 100;
    static readonly CHAT_INPUT_PANEL_MIN_WIDTH: number = 135;
    static readonly CHAT_MESSAGES_LIST_MIN_WIDTH: number = 150;
    parent: wnd.base.BaseWindowView<any>;
    $container: JQuery;
    $componentMain: JQuery;
    horizontalSplitter: component.splitter.SplitterView;
    $chat: JQuery;
    $privateConversations: JQuery;
    $messages: JQuery;
    $scrollContainer: JQuery;
    $searchInfo: JQuery;
    $searchInfoNoResults: JQuery;
    $searchHistoricalButton: JQuery;
    sendingToRemove: EntryToRemove[];
    chatMessages: component.extlist.ExtListView<InnerMessageModel>;
    $chatReply: JQuery;
    chatReplyEditor: webUtils.ContentEditableEditor;
    enterSends: boolean;
    maxMsgTextSize: number;
    avatarLastZoom: number = 0;
    userActionsEnabled: boolean;
    onUserActionBinded: (event: any) => void;
    channelMessageInnerTemplate: Types.webUtils.MailTemplateDefinition<InnerMessageModel>;
    chatType: ChatType;
    $avatarPlaceholder: JQuery;
    scrollState: {
        ele: Element;
        childrenHolder: Element;
        top: number;
        height: number;
        bottom: number;
        isScrolledToBottom: boolean;
        first: Element;
        firstTop: number;
        last: Element;
        lastTop: number;
    };
    unreadMarkers: number[];
    attachmentsCache: {[id: string]: string};
    order: number;
    emojiPicker: component.emojipicker.EmojiPickerView;
    emojiViewBar: component.emojiviewbar.EmojiViewBarView;
    taskTooltip: component.tasktooltip.TaskTooltipView;
    notifications: component.notification.NotificationView;
    encryptionEffect: component.encryptioneffect.EncryptionEffectView;
    thumbs: component.thumbs.ThumbsView;
    loading: component.loading.LoadingView;
    editMode: boolean;
    editMsgId: number;
    $settingsMenu: JQuery;
    checkMoreMessagesTid: any;
    allMessagesRendered: boolean;
    helper: webUtils.MailClientViewHelper;
    editMessageState: EditMessageState;
    userActionTimer: any;
    rewindTimer: NodeJS.Timer;
    platform: string;
    $imagesToLoad: { [did: string]: JQuery } = {};
    imagesCache: { [did: string]: string } = {};
    scrollEnabled: boolean = true;
    voiceChatModule: VoiceChat.VoiceChatViewModule;
    sendingMsgs: InnerMessageModel[] = [];
    rewindOnActivate: boolean = false;

    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent);
        this.order = 10;
        this.attachmentsCache = {};
        this.horizontalSplitter = this.addComponent("horizontalSplitter", new component.splitter.SplitterView(this, {
            firstPanelMinSize: ChatMessagesView.CHAT_MESSAGES_LIST_MIN_WIDTH,
            secondPanelMinSize: ChatMessagesView.CHAT_INPUT_PANEL_MIN_WIDTH,
            type: "horizontal",
            handlePlacement: "bottom",
            handleDot: true,
            flip: true
        }));
        this.chatMessages = this.addComponent("chatMessages", new component.extlist.ExtListView(this, {
            template: {func: this.chatMessageTemplate.bind(this), helper: "com.privmx.core.web-utils.MailClientViewHelper"},
            onAfterListRender: this.onAfterRenderMessageList.bind(this)
        }));
        this.emojiPicker = this.addComponent("emojiPicker", new component.emojipicker.EmojiPickerView(this));
        this.parent.addEventListener("hide-emoji-picker", () => {
            this.emojiPicker.hide();
            this.$container.find(".emoji-picker-open").removeClass("emoji-picker-open");
        })
        this.emojiViewBar = this.addComponent("emojiViewBar", new component.emojiviewbar.EmojiViewBarView(this));
        
        this.userActionsEnabled = true;
        this.onUserActionBinded = this.onUserAction.bind(this);
        // component.persons.PersonsView.fixAvatarRenderInExtListUpdate(this.chatMessages);
        
        this.taskTooltip = this.addComponent("tasktooltip", new component.tasktooltip.TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); };

        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.encryptionEffect = this.addComponent("encryptionEffect", new component.encryptioneffect.EncryptionEffectView(this));
        this.loading = this.addComponent("loading", new component.loading.LoadingView(this));
        this.thumbs = this.addComponent("thumbs", new component.thumbs.ThumbsView(this));
        this.thumbs.addEventListener<component.thumbs.ThumbLoadedEvent>("thumbLoaded", e => {
            e.$thumb.closest(".message.file-box").removeClass("with-not-loaded-image").addClass("with-loaded-image");
        });

    }
    

    init(model: Model): Q.Promise<void> {
        if (!model) {
            return;
        }
        this.platform = model.platform;
        this.allMessagesRendered = false;
        $("head").append('<style>' + model.customStyle + '</style>');
        if (this.userActionsEnabled) {
            this.turnOnUserActions();
        }
        let msgHtml = model.customTemplate;
        if (msgHtml) {
            let func = <Types.webUtils.TemplateFunctionRaw<InnerMessageModel, any, webUtils.MailClientViewHelper>>webUtils.template.Compiler.eval(msgHtml);
            this.channelMessageInnerTemplate = {func: func, helper: "com.privmx.core.web-utils.MailClientViewHelper"};
        }
        else {
            this.channelMessageInnerTemplate = chatMessageInnerTemplate;
        }
        return Q().then(() => {
            this.setUnreadMarkers(model.unreadMarkers, false);
            this.chatType = model.chatType;
            this.enterSends = model.enterSends;
            this.maxMsgTextSize = model.maxMsgTextSize;
            this.$container.attr("tabindex", "-1");
            this.$container.on("keydown", this.onKeydown.bind(this));
            this.$container.on("click", "[data-url]", this.onLinkClick.bind(this));
            this.$container.on("click", "[data-action=open-mail]", this.onMessageTitleClick.bind(this));
            this.$container.on("click", ".task-id", this.onTaskTitleClick.bind(this));
            this.$container.on("click", ".link.reply", this.onTaskReplyClick.bind(this));
            
            this.$container.on("click", "[data-action=open-notes2]", this.onOpenNotes2Click.bind(this));
            this.$container.on("click", "[data-action=open-tasks]", this.onOpenTasksClick.bind(this));
            this.$container.on("click", "[data-action=talk]", this.onStartTalkClick.bind(this));

            this.$container.on("click", "[data-action=open-settings]", this.onOpenSettingsClick.bind(this));
            this.$container.on("click", ".context-menu-backdrop2", this.onCloseSettingsClick.bind(this));
            this.$container.on("change", "input[data-setting]", this.onSettingChanged.bind(this));
            this.$container.on("change", "input[data-view-setting]", this.onViewSettingChanged.bind(this));
            this.$container.on("click", "[data-action=send-chat-message]", this.onSendMessageClick.bind(this));
            this.$container.on("click", "[data-action=send-message-edit]", this.onSendMessageEditClick.bind(this));
            this.$container.on("click", "[data-action=cancel-message-edit]", this.onCancelMessageEditClick.bind(this));
            this.$container.on("click", "[data-action=edit-message]", this.onEditMessageClick.bind(this));
            this.$container.on("click", "[data-action=delete-message]", this.onDeleteMessageClick.bind(this));
            this.$container.on("click", "[data-action=quote-message]", this.onQuoteMessageClick.bind(this));
            this.$container.on("click", "[data-action=new-file]", this.onNewFilesClick.bind(this));
            this.$container.on("click", "[data-action=new-task]", this.onNewTaskClick.bind(this));
            this.$container.on("click", "[data-action=open-attachment]", this.onOpenAttachmentClick.bind(this));
            this.$container.on("click", "[data-action=open-channel-file]", this.onOpenChannelFile.bind(this));
            this.$container.on("change", "[data-trigger=enter-sends-toggle]", this.onEnterSendsChange.bind(this));
            this.$container.on("click", "[data-action=emoji-picker]", this.onEmojiBtnClick.bind(this));
            this.$container.on("click", ".message-quote-toggle", this.onMessageQuoteToggleClick.bind(this));
            this.$container.on("click", "[data-action=search-historical-data]", this.onSearchHistoricalDataClick.bind(this));
            this.$container.on("click", "[data-action=add-person]", this.onAddPersonClick.bind(this));
            this.$container.on("click", "[data-action=remove-person]", this.onRemovePersonClick.bind(this));
            this.$container.on("click", "[data-action=toggle-expanded]", this.onToggleExpandedClick.bind(this));
            this.$container.on("click", "[data-action=toggle-context]", this.onToggleContextBtnClick.bind(this));
            this.$container.on("click", "[data-action=join-voice-chat]", this.onJoinVoiceChatClick.bind(this));
            this.$container.on("click", "[data-action=leave-voice-chat]", this.onLeaveVoiceChatTalkingClick.bind(this));
            this.$container.on("click", "[data-action=toggle-talking]", this.onToggleTalkingClick.bind(this));
            this.$container.on("click", "[data-action=ring-the-bell]", this.onRingTheBellClick.bind(this));
            this.$container.on("click", ".privmx-quote-tldr-toggle", this.privmxQuoteTldrToggleClick.bind(this))
            //this.$container.on("click", ".many-profiles canvas[data-hashmail-image]", this.onRemovePersonClick.bind(this));
            
            // this.personsComponent.$main = this.$container;
            // return this.personsComponent.triggerInit();
            return;
        })
        .then(() => {
            this.horizontalSplitter.$container = this.$container;
            return this.horizontalSplitter.triggerInit();
        })
        .then(() => {
            this.thumbs.$container = this.$container;
            return this.thumbs.triggerInit();
        })
        .then(() => {
            this.horizontalSplitter.$handle.addClass("reply-handle");
            let tpl = this.templateManager.createTemplate(chatTemplate);
            this.helper = tpl.helper;
            this.$chat = tpl.renderToJQ(model);
            this.horizontalSplitter.$top.empty().append(this.$chat);
            this.sendingToRemove = [];
            this.$messages = this.$chat.find("[data-container=chat-messages]");
            this.$scrollContainer = this.$chat.find(".chat-inner");
            this.scrollState = {
                ele: this.$scrollContainer[0],
                childrenHolder: this.$messages[0],
                top: 0,
                height: 0,
                bottom: 0,
                isScrolledToBottom: true,
                first: null,
                firstTop: 0,
                last: null,
                lastTop: 0
            };
            this.$scrollContainer.on("scroll", this.onContainerScroll.bind(this));
            this.chatMessages.$container = this.$messages;
            this.emojiViewBar.$container = this.$container;
            return this.emojiViewBar.triggerInit();
        })
        .then(() => {
            return this.chatMessages.triggerInit();
        })
        .then(() => {
            this.loading.$container = this.$container;
            return this.loading.triggerInit();
        })
        .then(() => {
            this.showLoading();
            this.chatMessages.addEventListener<component.extlist.ExtListChangeEvent>("ext-list-change", event => {
                this.onChatMessagesChanged();
                this.fireRewindTillSuccess();
            });
            this.$searchInfo = this.$chat.find(".search-info");
            this.$searchInfoNoResults = this.$searchInfo.find(".search-no-results");
            this.$searchHistoricalButton = this.$searchInfo.find("[data-action=search-historical-data]");
        })
        .then(() => {
            this.$chatReply = this.templateManager.createTemplate(chatReplyTemplate).renderToJQ(model);
            this.horizontalSplitter.$bottom.empty().append(this.$chatReply);
            let $chatReplyEditor = this.$chatReply.find("[data-role=reply-field]");
            this.chatReplyEditor = new webUtils.ContentEditableEditor($chatReplyEditor, {
                onKeyDown: this.onChatReplyEditorKeyDown.bind(this),
                onFocus: this.onChatReplyEditorFocus.bind(this),
                onChange: this.onChatReplyEditorChange.bind(this),
                disallowTab: true,
                // onPasteSeemsEmpty: this.onPasteSeemsEmpty.bind(this),
                // onPasteSeemsFile: this.onPasteSeemsFile.bind(this),
                isDarwin: this.platform == "darwin",
                onRequestTaskPicker: (...args: any[]) => {
                    (<any>this.parent).onTaskPickerResult(this.chatReplyEditor.onTaskPickerResult.bind(this.chatReplyEditor));
                    return (<any>this.parent).onRequestTaskPicker(...args);
                },
                onRequestFilePicker: (...args: any[]) => {
                    (<any>this.parent).onFilePickerResult(this.chatReplyEditor.onFilePickerResult.bind(this.chatReplyEditor));
                    return (<any>this.parent).onRequestFilePicker(...args);
                },
                relatedSectionId: this._model.sectionId,
                relatedHostHash: this._model.hostHash,
            });
            
            this.encryptionEffect.$field = $chatReplyEditor;
            this.encryptionEffect.$button = this.$chatReply.find("[data-action=send-chat-message]");
            this.emojiPicker.$container = this.$container.find(".emoji-picker");
            return Q.all([
                this.encryptionEffect.triggerInit(),
                this.emojiPicker.triggerInit(),
            ]);
        })
        .then(() => {
            this.taskTooltip.$container = this.$container;
            return this.taskTooltip.triggerInit();
        })

        .then(() => {
            this.notifications.$container = this.$container.find(".chat-notifications-container");
            return this.notifications.triggerInit();
        })
        .then(() => {
            this.$settingsMenu = this.$container.find(".context-menu-settings");
            this.setEnterSends(model.enterSends);

            this.refresh(model);
            
            this.$container.find(".sections-tabs-container").css("display", model.chatType == ChatType.CHANNEL ? "block": "none");
            this.checkMoreMessages();
            this.updateCanWrite(model.canWrite);
            
            if ((<any>window).ResizeObserver) {
                let reprocessTldrsTimeout: number = null;
                let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                    if (this.$settingsMenu && this.$settingsMenu.hasClass("visible")) {
                        this.$settingsMenu.removeClass("visible");
                    }
                    if (reprocessTldrsTimeout !== null) {
                        clearInterval(reprocessTldrsTimeout);
                    }
                    reprocessTldrsTimeout = <any>setTimeout(() => {
                        reprocessTldrsTimeout = null;
                        this.processTldrs(true);
                    }, 100);
                    this.updateHeaderHeight();
                });
                resizeObserver.observe(this.$container[0]);
            }
            this.onChatMessagesChanged();
            this.updateHeaderHeight();
        })
        .then(() => {
            this.toggleIsInVoiceChatInThisSection(model.isInVoiceChatInThisSection);
            this.toggleIsInVoiceChatInAnotherSection(model.isInVoiceChatInAnotherSection);
            this.toggleIsVoiceChatActiveInThisSection(model.isVoiceChatActiveInThisSection);

            this.toggleIsVoiceChatEnabled(model.isVoiceChatEnabled);

            this.toggleIsTalkingInThisSection(model.isTalkingInThisSection);
            this.toggleIsTalkingInAnotherSection(model.isTalkingInAnotherSection);
            this.toggleRingTheBellAvailable(model.isRingTheBellAvailable);
            this.updateIsRemoteSection(model.isRemote);
        });
    }
    
    onStartTalkClick(): void {
        this.triggerEvent("startTalk");
    }

    setAllMessagesRendered(allMessagesRendered: boolean) {
        this.allMessagesRendered = allMessagesRendered;
    }
    
    setUnreadMarkers(unreadMarkers: Marker[], refreshListIndicators?: boolean) {
        this.unreadMarkers = unreadMarkers.map(x => x.beg);
        if (refreshListIndicators !== false) {
            this.refreshListIndicators();
        }
    }
    
    getInnerMessageTemplate(): Types.webUtils.MailTemplateDefinition<InnerMessageModel> {
        return this.chatType == ChatType.CHANNEL ? this.channelMessageInnerTemplate : chatMessageInnerTemplate;
    }
    
    chatMessageTemplate(model: InnerMessageModel, context: component.extlist.Context<InnerMessageModel>, Helper: webUtils.MailClientViewHelper) {
        return Helper.createTemplate(this.getInnerMessageTemplate()).render(model, context);
    }
    
    refresh(model: Model): void {
        //this.$container.css("visibility", "visible");
        this.renderHeader(model);
        // this.focusReplyField();
        if (this.chatType == ChatType.CHANNEL) {
            this.$container.find(".chat").addClass("channel-mode").removeClass("chat-mode");
        }
        else {
            this.$container.find(".chat").addClass("chat-mode").removeClass("channel-mode");
        }
        this.rewind();
    }
    
    static getMsgStats(serverDate: Date, senderHashmail: string, prev: mail.SinkIndexEntry) {
        let newContext = true;
        let dateSeparator = false;
        if (prev) {
            let prevMessage = prev.getMessage();
            newContext = dateSeparator || prevMessage.sender.hashmail != senderHashmail;
            dateSeparator = prevMessage.serverDate.toDateString() != serverDate.toDateString();
        }
        return {
            newContext: newContext,
            dateSeparator: dateSeparator
        };
    }

    clearOldSendingMessages(): void {
        Q().then(() => {
            let sentIds: string[] = [];
            this.$container.find("[data-sent-id]").slice(-10).each((_i, e) => {
                sentIds.push($(e).data("sent-id"));
            })
            let sendingMessages = this.$container.find("[data-msg-id^='sending']");
            sendingMessages.each((_i, el) => {
                let sendingId = $(el).data("msg-id");
                if (sentIds.includes(sendingId)) {
                    this.removeSendingMessage2(sendingId.split("-")[1]);
                }
            })
            
        })
    }
    
    renderSendingMessage(model: InnerMessageModel): void {
        if (this.$container.find("[data-msg-id='sending-"+model.msgId+"']").length > 0 || this.$container.find("[data-sent-id='"+model.msgId+"']").length > 0) {
            return;
        }
        // if (this.sendingMsgs.indexOf(model) < 0) {
        //     this.sendingMsgs.push(model);
        // }
        let $msg = this.templateManager.createTemplate(this.getInnerMessageTemplate()).renderToJQ(model);
        this.$messages.append($msg);
        this.personsComponent.refreshAvatars();
        this.refreshListIndicators();
        this.rewind();
        this.processTldrs();
    }
    
    removeSendingMessage(sendingId: number, realMessageId: number, _model: InnerMessageModel, refreshListOnRemove?: boolean, isFileAndFilesDisabled?: boolean): void {
        let indexToRemove: number = -1;
        for (let idx = 0; idx < this.sendingMsgs.length; ++idx) {
            if (
                (_model && this.sendingMsgs[idx].msgId == _model.msgId && this.sendingMsgs[idx].msgNum == _model.msgNum)
                ||
                (!_model && this.sendingMsgs[idx].msgId == `sending-${sendingId}`)
            ) {
                indexToRemove = idx;
                break;
            }
        }
        if (indexToRemove >= 0) {
            this.sendingMsgs.splice(indexToRemove, 1);
        }
        
        if (realMessageId == null) {
            this.$container.find("[data-msg-id='sending-" + sendingId + "']").remove();
        }
        else {
            this.sendingToRemove.push({
                sendingId: sendingId,
                realMessageId: realMessageId,
                isFileAndFilesDisabled: isFileAndFilesDisabled,
            });
            refreshListOnRemove ? this.processSendingList() : null;
        }
    }

    removeSendingMessage2(sendingId: number): void {
        this.$container.find("[data-msg-id='sending-" + sendingId + "']").remove();
    }

    removeSendingMessageIfRealMessageExists(sendingId: any, realId: any): void {
        if (this.$container.find("[data-msg-id='" + realId + "']").length > 0) {
            this.removeSendingMessage2(sendingId);
        }
        Q().then(() => {
            this.clearOldSendingMessages();
        })
    }

    setEnterSends(enterSends: boolean): void {
        this.enterSends = enterSends;
        this.$container.find("[data-trigger=enter-sends-toggle]").prop("checked", enterSends);
    }
    
    rewind(): void {
        if (this.scrollState && this.scrollState.ele.scrollHeight) {
          this.scrollState.ele.scrollTop = this.scrollState.ele.scrollHeight;
          this.refreshScrollState();
        }
    }
    
    focus(): void {
        this.focusReplyField();
    }
    
    replyFieldHasFocus(): boolean {
        let hasFocus = this.chatReplyEditor.hasFocus();
        if (hasFocus && document.visibilityState) {
            return "visible" === document.visibilityState;
        }
        return hasFocus;
    }
    
    onLinkClick(e: MouseEvent): void {
        let $el = $(e.target).closest("[data-url]");
        let url = $el.data("url");
        this.triggerEventInTheSameTick("openUrl", url);
    }
    
    onMessageTitleClick(event: MouseEvent): void {
        let msgId = $(event.target).closest("[data-msg-id]").data("msg-id").split("/");
        this.triggerEvent("openMail", msgId[1], msgId[0]);
    }
    
    onTaskTitleClick(event: MouseEvent): void {
        let taskId = $(event.target).closest("[data-task-id]").data("task-id");
        this.triggerEvent("openTask", taskId, false);
    }
    
    onTaskReplyClick(event: MouseEvent): void {
        let taskId = $(event.target).closest("[data-task-id]").data("task-id");
        this.triggerEvent("openTask", taskId, true);
    }
    
    onOpenNotes2Click(): void {
        this.triggerEvent("openNotes2");
    }
    
    onOpenTasksClick(): void {
        this.triggerEvent("openTasks");
    }
    
    onOpenSettingsClick(e: MouseEvent): void {
        let $btn = <JQuery>$(e.currentTarget);
        this.$settingsMenu.addClass("visible");
        let x = $btn.offset().left + $btn.outerWidth() / 2 - this.$settingsMenu.find(".context-menu-settings-content").outerWidth();
        let y = $btn.offset().top + $btn.outerHeight();
        let dx = Math.max(x, -25.0) - x;
        this.$settingsMenu.find(".ptr").css("left", (-dx) + "px");
        this.$settingsMenu.css("left", Math.max(x, -25.0)).css("top", y);
    }

    onCloseSettingsClick(): void {
        this.$settingsMenu.removeClass("visible");
    }
    
    onSettingChanged(e: MouseEvent): void {
        let $e = $(e.target).closest("input");
        let setting = $e.data("setting");
        let value = $e.is("input") ? $e.is(":checked") : ($e.data("checked") == "1" ? false : true);
        $e.prop("checked", value ? "checked" : "");
        this.triggerEvent("changeSetting", setting, value);
    }
    
    onViewSettingChanged(e: MouseEvent): void {
        let $e = $(e.target).closest("input");
        let setting = $e.data("viewSetting");
        let value = $e.is("input") ? $e.is(":checked") : ($e.data("checked") == "1" ? false : true);
        $e.prop("checked", value ? "checked" : "");
        this.triggerEvent("changeViewSetting", setting, value);
        if (setting == "invert-message-backgrounds") {
            this.$chat.toggleClass("invert-message-backgrounds", value);
        }
        else if (setting == "hide-usernames") {
            this.$chat.toggleClass("hide-usernames", value);
        }
        else if (setting == "show-search-contexts") {
            this.$chat.toggleClass("show-search-contexts", value);
        }
    }
    
    updateSettinsMenu(guiSettings: GUISettings): void {
        for (let id in guiSettings) {
            this.$settingsMenu.find("input[data-setting='" + id + "']").prop("checked", guiSettings[id] ? "checked" : "");
        }
    }
    
    updateViewSettingsMenu(viewSettings: { [key: string]: any }): void {
        for (let id in viewSettings) {
            this.$settingsMenu.find("input[data-view-setting='" + id + "']").prop("checked", viewSettings[id] ? "checked" : "");
        }
        this.$chat.toggleClass("invert-message-backgrounds", viewSettings["invert-message-backgrounds"]);
        this.$chat.toggleClass("hide-usernames", viewSettings["hide-usernames"]);
        this.$chat.toggleClass("show-search-contexts", viewSettings["show-search-contexts"]);
    }
    
    onSendMessageClick(): void {
        this.sendMessage();
    }
    
    onSendMessageEditClick(): void {
        this.sendMessageEdit();
    }
    
    onCancelMessageEditClick(): void {
        this.exitEditMode();
    }
    
    onEditMessageClick(event: MouseEvent): void {
        let msgNum = $(event.target).closest("[data-msg-num]").data("msg-num");
        this.triggerEvent("startEditMessage", parseInt(msgNum));
    }
    
    onDeleteMessageClick(event: MouseEvent): void {
        let msgNum = $(event.target).closest("[data-msg-num]").data("msg-num");
        this.triggerEvent("deleteMessage", parseInt(msgNum));
    }
    
    onQuoteMessageClick(event: MouseEvent): void {
        let selection = this.parent.copySelection(false);
        let $btn = $(event.currentTarget);
        let hashmail = $btn.data("hashmail");
        let username = $btn.data("username");
        let timestamp = $btn.data("timestamp");
        let msgNum = $(event.target).closest("[data-msg-num]").data("msg-num");
        let html: string = null;
        if (selection && selection.html && selection.text) {
            let $el = selection.$parent;
            if ($el && $el.length > 0) {
                let $parent = $el.closest(".message-text-from-user");
                if ($parent.length > 0 && $parent.parent().is(".text-inner") && $parent.parent().parent().is(".text")) {
                    let msgNum1 = msgNum;
                    let msgNum2 = $parent.closest("[data-msg-num]").data("msg-num");
                    if (msgNum1 == msgNum2) {
                        html = selection.html;
                    }
                }
            }
        }
        if (html === null) {
            html = $(event.target).closest("[data-msg-num]").find(".text>.text-inner>.message-text-from-user").html();
        }
        if (!html || !hashmail || !username || !timestamp || !msgNum) {
            return;
        }
        
        html = html.split("<br>").map(x => ">" + x).join("<br>");
        html = html.replace(/<a[^>]+>/g, '').replace(/<\/a>/g, '');
        html = `@<privmx-quote-header data-hashmail="${hashmail}" data-timestamp="${timestamp}" data-msg-num="${msgNum}">${username}</privmx-quote-header><br>` + html;
        
        let currentValue = this.chatReplyEditor.getValue().trim();
        this.chatReplyEditor.setValue((currentValue ? (currentValue + "<br>") : "") + html + "<br><br>");
        this.chatReplyEditor.$elem.focus();
        let range = document.createRange();
        range.selectNodeContents(this.chatReplyEditor.$elem[0]);
        range.collapse(false);
        let sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
    
    onNewFilesClick(): void {
        this.triggerEvent("newFiles");
    }
    
    onNewTaskClick(): void {
        this.triggerEvent("newTask");
    }
    
    onOpenAttachmentClick(event: MouseEvent): void {
        let $e = $(event.target).closest("[data-attachment-index]");
        let msgId = $e.closest("[data-msg-id]").data("msg-id").split("/");
        this.triggerEvent("openAttachment", msgId[1], msgId[0], $e.data("attachment-index"));
    }
    
    onOpenChannelFile(event: MouseEvent): void {
        let $e = $(event.target).closest(".channel-file, .img-in-chat");
        this.triggerEvent("openChannelFile", $e.data("path"), $e.data("did"));
    }
    
    onEnterSendsChange(event: MouseEvent): void {
        this.enterSends = (<HTMLInputElement>event.currentTarget).checked;
        this.triggerEvent("setEnterSends", this.enterSends);
    }
    
    onContainerScroll(): void {
        if (!this.scrollEnabled) {
            return;
        }
        this.refreshScrollState();
        if (!this.allMessagesRendered && this.scrollState.top <= ChatMessagesView.LOAD_MORE_MESSAGES_SCROLL_OFFSET) {
            this.triggerEvent("loadMoreMessages");
            this.checkMoreMessages();
        }
    }
    
    checkMoreMessages() {
        clearTimeout(this.checkMoreMessagesTid);
        if (this.allMessagesRendered) {
            this.hideLoading();
            return;
        }
        this.checkMoreMessagesTid = setTimeout(() => {
            if (!this.allMessagesRendered && this.scrollState.top <= ChatMessagesView.LOAD_MORE_MESSAGES_SCROLL_OFFSET) {
                if (this.$chat.is(":visible")) {
                    this.triggerEvent("loadMoreMessages");
                }
                else {
                    this.hideLoading();
                }
                this.checkMoreMessages();
            }
            else {
                this.hideLoading();
            }
        }, 500);
    }
    
    showLoading(): void {
        // this.loading.onStartLoading();
    }
    
    hideLoading(): void {
        // this.loading.onFinishedLoading();
        if (this.parent && this.parent instanceof ChatWindowView) {
            this.parent.loading.hideLoading();    
        }
    }
    
    refreshScrollState(): boolean {
        let ele = this.scrollState.ele;
        if (ele.scrollHeight == 0) {
            return false;
        }
        let chEle = this.scrollState.childrenHolder;
        let first = chEle.children.length > 0 ? chEle.children[0] : null;
        let last = chEle.children.length > 0 ? chEle.children[chEle.children.length - 1] : null;
        this.scrollState.top = ele.scrollTop;
        this.scrollState.height = ele.scrollHeight;
        this.scrollState.bottom = this.scrollState.height - this.scrollState.top;
        this.scrollState.isScrolledToBottom = ele.scrollTop + ele.getBoundingClientRect().height + 10 >= ele.scrollHeight;
        this.scrollState.first = first;
        this.scrollState.firstTop = first ? first.getBoundingClientRect().top : 0;
        this.scrollState.last = last;
        this.scrollState.lastTop = last ? last.getBoundingClientRect().top: 0;
        return true;
    }
    
    onActivate() {
        if (!this.userActionsEnabled) {
            this.turnOnUserActions();
        }
        if (this.rewindOnActivate) {
            this.fireRewindTillSuccess();
        }
    }
    
    onDeactivate() {
        if (this.userActionsEnabled) {
            this.turnOffUserActions();
        }
    }
    
    turnOnUserActions() {
        this.userActionsEnabled = true;
        this.$container.on("mousemove click keydown", this.onUserActionBinded);
    }
    
    turnOffUserActions() {
        this.userActionsEnabled = false;
        this.$container.off("mousemove click keydown", this.onUserActionBinded);
    }
    
    onUserAction() {
        // onUserAction podpiety jest do eventa mousemove, wiec dodany jest debouncer (1000 ms)
        if (this.userActionTimer == null) {
            this.userActionTimer = setTimeout(() => {
                this.triggerEvent("userAction");
                clearTimeout(this.userActionTimer);
                this.userActionTimer = null;
            }, 1000);
        }
    }
    
    onChatReplyEditorKeyDown(e: KeyboardEvent): void {
        if (e.keyCode == webUtils.KEY_CODES.enter) {
            if (e.ctrlKey || (!e.shiftKey && !e.altKey && this.enterSends)) {
                e.preventDefault();
                if (this.editMode) {
                    this.sendMessageEdit();
                }
                else {
                    this.sendMessage();
                }
                return;
            }
        }
        else if (e.keyCode == webUtils.KEY_CODES.upArrow) {
            if (!this.editMode && !this.getMessageText()) {
                this.triggerEvent("startEditLastMessage");
            }
        }
        else if (e.keyCode == webUtils.KEY_CODES.escape) {
            if (this.editMode) {
                this.exitEditMode();
            }
        }

        this.chatReplyEditor.onKeyDown(e);


    }
    
    onChatReplyEditorFocus(e: FocusEvent): void {
        this.chatReplyEditor.onFocus(e);
    }
    
    onKeydown(e: KeyboardEvent): void {
        if (e.keyCode === webUtils.KEY_CODES.pageUp) {
            this.scrollConversation(true);
        }
        else if (e.keyCode === webUtils.KEY_CODES.pageDown) {
            this.scrollConversation(false);
        }
    }
    
    scrollConversation(up: boolean) {
        const offset: number = 40;
        let $conv = this.$container.find(".chat > .chat-inner");
        let currPos = $conv.scrollTop();
        $conv.scrollTop(up ? currPos - offset : currPos + offset);
    }
    
    onAfterRenderMessageList(): void {}
    
    onChatMessagesChanged(): void {
        this.personsComponent.refreshAvatars();
        this.emojiViewBar.refreshEmoji();
        this.triggerEvent("updateCanWrite");
        this.refreshListIndicators();
        this.refreshAttachments();
        if (this.scrollState.isScrolledToBottom) {
            this.rewind();
        }
        else {
            if (this.scrollState.first && this.scrollState.first.getBoundingClientRect().top != this.scrollState.firstTop) {
                this.scrollState.ele.scrollTop = this.scrollState.ele.scrollHeight - this.scrollState.bottom;
            }
            this.refreshScrollState();
        }
        this.processSendingList();
        this.processTldrs();
        this.processThumbs();
    }
    processTldrs(reprocessAll: boolean = false): void {
        if (!this.$container.is(":visible")) {
            return;
        }
        let scrolledToBottom = this.scrollState ? this.scrollState.isScrolledToBottom : false;
        let changes: { [msgNum: string]: boolean } = {};
        let $toProcess = this.$messages.find(
            reprocessAll
                ? ".text[data-tldr-processed], .privmx-quote"
                : ".text[data-tldr-processed='0'], .privmx-quote[data-tldr-processed='0'], .privmx-quote:not([data-tldr-processed])"
        );
        $toProcess.each((_, el) => {
            let $el = $(el);
            let isQuote = $el.is(".privmx-quote");
            if ($el.attr("data-tldr-processed") != "1") {
                $el.attr("data-tldr-processed", "1");
            }
            let $cont = $el.data("cached-chat-message") || (isQuote ? $el.closest(".privmx-quote") : $el.closest(".chat-message"));
            $el.data("cached-chat-message", $cont);
            let $userText = $el.data("cached-user-text") || (isQuote ? $el.find(".privmx-quote-text") : $el.find(".text-inner, .task-comment"));
            if ($userText.is(".task-comment")) {
                $userText = $userText.closest(".line");
            }
            $el.data("cached-user-text", $userText);
            if (isQuote) {
                // console.log($userText.parent()[0], $userText.parent()[0].getBoundingClientRect().height);
                let isTldr = $userText[0].getBoundingClientRect().height >= 30;
                if ($cont.hasClass("tldr") != isTldr) {
                    $cont.toggleClass("tldr");
                    if (isTldr) {
                        let $toggleBtn = $cont.find(".privmx-quote-tldr-toggle");
                        if ($toggleBtn.length == 0) {
                            $cont.append(`<span class="privmx-quote-tldr-toggle"></span>`)
                        }
                    }
                    // let $parent = $cont.parent();
                    // if (!$parent.is(".chat-sending")) {
                    //     let msgNum = $parent.data("msg-num");
                    //     changes[msgNum] = isTldr;
                    // }
                }
            }
            else {
                let isTldr = $userText[0].getBoundingClientRect().height >= 126;
                if ($cont.hasClass("tldr") != isTldr) {
                    $cont.toggleClass("tldr");
                    let $parent = $cont.parent();
                    if (!$parent.is(".chat-sending")) {
                        let msgNum = $parent.data("msg-num");
                        changes[msgNum] = isTldr;
                    }
                }
            }
        });
        this.triggerEvent("updateIsTldr", JSON.stringify(changes));
        if (scrolledToBottom) {
            this.rewind();
        }
    }
    
    ensureActivated(): void {
        this.processTldrs();
    }
    
    onToggleExpandedClick(e: MouseEvent): void {
        let $el = $(e.currentTarget).prev(".text");
        $el.toggleClass("expanded");
        let msgNum = $el.closest("[data-msg-num]").data("msg-num");
        let isExpanded = $el.hasClass("expanded");
        this.triggerEvent("updateIsExpanded", msgNum, isExpanded);
        this.refreshScrollState();
    }
    
    onToggleContextBtnClick(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget).closest("[data-msg-num]");
        let $context = $();
        let contextSize = this._model.contextSize;
        let $prev = $el.prev();
        let $next = $el.next();
        for (let i = 0; i < contextSize && $prev.find(".chat-message.dist-0").length == 0; ++i) {
            $context = $context.add($prev);
            $prev = $prev.prev();
        }
        for (let i = 0; i < contextSize && $next.find(".chat-message.dist-0").length == 0; ++i) {
            $context = $context.add($next);
            $next = $next.next();
        }
        $context = $context.add($el);
        $context.toggleClass("show-as-context");
        this.refreshListIndicators();
        // let msgNum = $el.closest("[data-msg-num]").data("msg-num");
        // this.triggerEvent("toggleContextAround", msgNum);
    }
    
    clearContext(): void {
        this.$container.find(".show-as-context").removeClass("show-as-context");
    }
    
    processSendingList(): void {
        // Ensure sending msgs exist
        for (let msg of this.sendingMsgs) {
            this.renderSendingMessage(msg);
        }
        
        // Sending to remove
        if (this.sendingToRemove.length == 0) {
            return;
        }
        let newList = [];
        for (let i = 0; i < this.sendingToRemove.length; i++) {
            let toRemove = this.sendingToRemove[i];
            if (toRemove.isFileAndFilesDisabled) {
                let $el = this.$container.find("[data-msg-id='sending-" + toRemove.sendingId + "']");
                let $spinner = $el.find(".fa.fa-circle-o-notch.fa-spin");
                $spinner.removeClass("fa-circle-o-notch fa-spin");
                $spinner.addClass("fa-check fa-lg");
                $spinner.css({
                    "color": "var(--color-link)",
                    "margin-top": "3px",
                });
                setTimeout(() => {
                    $el.remove();
                }, 1000);
            }
            else if (this.$container.find("[data-msg-id='" + toRemove.realMessageId + "']").length > 0) {
                this.$container.find("[data-msg-id='sending-" + toRemove.sendingId + "']").remove();
            }
            else {
                newList.push(toRemove);
            }
        }
        this.sendingToRemove = newList;
    }
    
    refreshAttachments(): void {
        this.$container.find(".attachment-image.not-rendered").each((_i, e) => {
            let $img = $(e);
            $img.removeClass("not-rendered");
            let $att = $img.closest("[data-attachment-index]");
            let msgId = $img.closest("[data-msg-id]").data("msg-id").split("/");
            let sinkId = msgId[0];
            let id = msgId[1];
            let attachmentIndex = $att.data("attachment-index");
            let cacheId = this.getAttchmentCacheId(sinkId, id, attachmentIndex);
            if (cacheId in this.attachmentsCache) {
                $img.attr("src", this.attachmentsCache[cacheId]).removeClass("hide");
                $att.find(".attachment-loading").remove();
            }
            else {
                this.triggerEvent("renderAttachmentImage", sinkId, id, attachmentIndex);
            }
        });
    }
    
    getAttchmentCacheId(sinkId: string, id: number, attachmentIndex: number) {
        return sinkId + "/" + id + "/" + attachmentIndex;
    }
    
    setImageData(sinkId: string, id: number, attachmentIndex: number, data: Types.app.BlobData): void {
        let objectUrl = webUtils.WebUtils.createObjectURL(data);
        this.attachmentsCache[sinkId + "/" + id + "/" + attachmentIndex] = objectUrl;
        let $e = this.$container.find("[data-msg-id='" + sinkId + "/" + id + "'] [data-attachment-index='" + attachmentIndex + "']");
        let $img = $e.find("img");
        let $loading = $e.find(".attachment-loading");
        $img.on("load", () => {
            $img.removeClass("hide");
            $loading.remove();
        }).attr("src", objectUrl);
    }
    
    refreshListIndicators(): void {
        let prevHashmail: string;
        let prevDate: number;
        let $children = this.$messages.children();
        let lastIndex = $children.length - 1;
        let withHiddenMessages = this.$container.hasClass("messages-filtered") && !this.$chat.hasClass("show-search-contexts");
        let canBeFirstVisibleChild: boolean = true;
        $children.each((i, e) => {
            let $e = $(e);
            let hashmail = $e.data("hashmail");
            let date = $e.data("date");
            let msgNum = $e.data("msg-num");
            let isHidden = withHiddenMessages && !$e.hasClass("dist-0") && !$e.hasClass("show-as-context");
            $e.toggleClass("with-new-context", i == 0 || prevHashmail != hashmail);
            $e.toggleClass("last-in-context", i >= lastIndex || $e.next().data("hashmail") != hashmail);
            $e.toggleClass("with-date-separator", i > 0 && prevDate != date);
            $e.toggleClass("last-before-date-separator", $e.next().data("date") != date);
            $e.toggleClass("with-unread-marker", i > 0 && this.unreadMarkers.indexOf(msgNum) != -1);
            $e.toggleClass("first-visible-child", !isHidden && canBeFirstVisibleChild);
            if (!isHidden) {
                prevHashmail = hashmail;
                if (canBeFirstVisibleChild) {
                    canBeFirstVisibleChild = false;
                }
            }
            prevDate = date;
        });
        this.tryRewind();
    }
    
    renderHeader(model: Model): void {
        let template = this.templateManager.createTemplate(chatHeaderProfilesTemplate);
        let $container = this.$container.find("[data-container=chat-header-profiles-contact]");
        $container.empty().append(template.renderToJQ(model));
        this.personsComponent.refreshAvatars();
        $container.find(".chat-reply-profile").each((idx, el) => {
            let $profile = $(el);
            let $rmBtn = $profile.prev();
            if ($rmBtn.length > 0 && $rmBtn.hasClass("remove-person-button")) {
                $rmBtn.appendTo($profile);
            }
        });
        setTimeout(() => {
            //Electron hax #066
            $container.append($container.children().detach());
        }, 1);
    }
    
    renderMessagesCount(messagesCount: number): void {
        this.$container.find(".msg-count").replaceWith(this.templateManager.createTemplate(msgCountTemplate).render(messagesCount));
    }
    
    getMessageText(): string {
        let text = this.chatReplyEditor.getValue().trim();
        if (!text) {
            return null;
        }
        return text.replace(/^(<br>)+/, '').replace(/(<br>)+$/, '');
    }
    
    getMessageTextEx(): string {
        let text = this.getMessageText();
        if (!text) {
            return null;
        }
        if (text.length > this.maxMsgTextSize) {
            this.triggerEvent("showMessageTextTooLarge");
            return null;
        }
        return text;
    }
    
    sendMessage(): void {
        let text = this.getMessageTextEx();
        if (text) {
            this.chatReplyEditor.setValue("");
            this.triggerEvent("sendMessage", text);
        }
    }
    
    sendMessageEdit(): void {
        if (this.editMessageState && !this.editMessageState.dirty) {
            return;
        }
        let text = this.getMessageTextEx();
        if (text) {
            this.triggerEvent("editMessage", this.editMsgId, text);
            this.exitEditMode();
        }
    }
    
    focusReplyField(str?: string): void {
        if (!this.chatReplyEditor.hasFocus()) {
            if (typeof(str) == "string") {
                this.chatReplyEditor.appendValue(str);
            }
            setTimeout(() => {
                this.chatReplyEditor.focus("end");
            }, 1);
        }
    }
    
    showMessagesLoading() {
        this.$container.find(".chat-inner").prepend('<div class="message-loading"><i class="fa fa-circle-o-notch fa-spin"></i></div>');
    }
    
    hideMessagesLoading() {
        this.$container.find(".chat-inner .message-loading").remove();
    }
    
    blurInputFocus(): void {
        let $replyField = this.$container.find(".reply-field");
        $replyField.blur();
    }
    
    onEmojiBtnClick(e: MouseEvent): void {
        let $parent = $(e.currentTarget).closest("[data-msg-id]");
        let userStickerSelected = $parent.find(".emoji-view .is-my").data("icon");
        this.$container.find(".component-emoji-picker .emoji-icon").each((_i, ele) => {
            $(ele).toggleClass("is-my", $(ele).data("icon") == userStickerSelected);
        });
        
        let msgId = $parent.data("msg-id");
        this.emojiPicker.showHide(msgId, <JQuery<HTMLElement>>$parent, e.clientX, e.clientY);
        $parent.toggleClass("emoji-picker-open", this.emojiPicker.opened);
    }
    
    onChatReplyEditorChange(e: Event): void {
        if (this.editMode && this.editMessageState) {
            this.editMessageState.onInput();
        }
    }
    
    toggleMessageEditButton(enabled: boolean) {
        this.$chatReply.find("[data-action=send-message-edit]").prop("disabled", !enabled);
    }
    
    enterEditMode(mid: number, text: string) {
        this.editMode = true;
        this.editMsgId = mid;
        this.chatReplyEditor.setValue(text);
        this.editMessageState = new EditMessageState(text, () => {
            if (this.chatReplyEditor.getValue() != this.editMessageState.originalText) {
                this.editMessageState.dirty = true;
                this.toggleMessageEditButton(true);
            }
        })
        this.$chatReply.find(".buttons").addClass("edit-mode");
        this.toggleMessageEditButton(false);
        this.$chatReply.toggleClass("edit-mode", true);
        let $replyField = this.$chatReply.find(".reply-field");
        if ($replyField.length > 0) {
            if (!$replyField.is(":focus")) {
                $replyField.focus();
            }
            let range = document.createRange();
            range.selectNodeContents($replyField[0]);
            range.collapse(false);
            let sel = document.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    
    exitEditMode() {
        this.editMode = false;
        this.editMsgId = null;
        this.chatReplyEditor.setValue("");
        this.$chatReply.find(".buttons").removeClass("edit-mode");
        this.$chatReply.toggleClass("edit-mode", false);
    }
    
    onMessageQuoteToggleClick(e: MouseEvent) {
        let $toggle = $(e.target).closest(".message-quote-toggle");
        let visible = $toggle.next().is(":visible");
        $toggle.find("span").html(this.helper.i18n("plugin.chat.component.chatMessages." + (visible ? "quote.show" : "quote.hide")));
        $toggle.find("i").attr("class", visible ? "fa fa-caret-right" : "fa fa-caret-down");
        $toggle.next().toggle();
        $toggle.closest('[data-tldr-processed="1"]').attr("data-tldr-processed", "0");
        this.processTldrs();
    }
    
    onSearchHistoricalDataClick(): void {
        this.disableSearchHistoricalDataButton();
        this.triggerEvent("searchHistoricalData");
    }
    
    onAddPersonClick(e: MouseEvent): void {
        if ($(e.currentTarget).is("button.disabled")) {
            return;
        }
        this.triggerEvent("addPerson");
    }
    
    onRemovePersonClick(e: MouseEvent): void {
        let hashmail = $(e.currentTarget).data("hashmail") || $(e.currentTarget).data("hashmail-image");
        this.triggerEvent("removePerson", hashmail);
    }
    
    disableSearchHistoricalDataButton(): void {
        this.$searchHistoricalButton.prop("disabled", true);
    }
    
    enableSearchHistoricalDataButton(): void {
        this.$searchHistoricalButton.prop("disabled", false);
    }
    
    updateSearchState(searchStateStr: string): void {
        let searchState: SearchState = JSON.parse(searchStateStr);
        this.$searchInfo.toggleClass("hidden", searchState.active == false || (searchState.resultsCount > 0 && searchState.mayHaveMoreResults == false));
        this.$searchInfoNoResults.toggleClass("hidden", searchState.resultsCount > 0);
        this.$searchHistoricalButton.toggleClass("hidden", searchState.mayHaveMoreResults == false);
    }
    
    updateMessagesFiltered(filtered: boolean): void {
        this.$container.toggleClass("messages-filtered", filtered);
        this.refreshListIndicators();
    }
    
    updateCanWrite(canWrite: boolean): void {
        let $textBox = this.$container.find(".chat-reply [data-role=reply-field]");
        this.$container.find("[data-action=send-chat-message]").prop("disabled", !canWrite);
        this.$container.find(".additional-buttons button[data-action]").prop("disabled", !canWrite);
        this.$container.find(".additional-buttons button[data-action='ring-the-bell']").prop("disabled", !canWrite || ! this._model.isRingTheBellAvailable);
        // this.$container.find(".additional-buttons button[data-action='join-voice-chat']").prop("disabled", !canWrite || this._model.isTalkingInAnotherSection);
        this.$container.find("[data-trigger=enter-sends-toggle]").prop("disabled", !canWrite);
        this.$container.find("[data-trigger=enter-sends-toggle]").prop("disabled", !canWrite);
        $textBox.prop("contenteditable", canWrite);
        $textBox.toggleClass("disabled", !canWrite);
        this.$container.find("[data-action=add-person]").toggleClass("disabled", !canWrite);
        
        let placeholder = canWrite ? this.helper.i18n("plugin.chat.component.chatMessages.chatReply.input.placeholder") : this.helper.i18n("plugin.chat.component.chatMessages.chatReply.input.placeholder-cant-write");
        $textBox.attr("placeholder", placeholder);
    }

    updateIsRemoteSection(isRemote: boolean): void {
        this.$container.find(".additional-buttons button[data-action='ring-the-bell']").toggleClass("hidden", isRemote);
        this.$container.find(".additional-buttons button[data-action='join-voice-chat']").toggleClass("hidden", isRemote);
    }
    
    updateEnabledModules(info: { notes2: boolean, tasks: boolean }): void {
        this.$container.find("[data-action='new-task']").toggleClass("hidden", !info.tasks);
    }
    
    onPasteSeemsEmpty(): void {
        this.triggerEvent("pasteSeemsEmpty");
    }
    
    onPasteSeemsFile(paths: string[], originalText: string): void {
        this.triggerEvent("pasteSeemsFile", JSON.stringify(paths), originalText);
    }
    
    pastePlainText(text: string): void {
        this.chatReplyEditor.pastePlainText(text);
    }
    
    tryRewind(): boolean {
        let needRewind = this.scrollState && this.scrollState.isScrolledToBottom;
        if (! needRewind) {
            return true;
        }
        let stateOk = this.refreshScrollState();
        if (needRewind && stateOk) {
            this.rewind();
            return true;
        }
        return false;
    }

    fireRewindTillSuccess(): void {
        if (!this.isVisible()) {
            this.rewindOnActivate = true;
            return;
        }
        this.rewindOnActivate = false;
        if (this.rewindTimer == null) {
            this.rewindTimer = setTimeout(() => {
                clearTimeout(this.rewindTimer);
                this.rewindTimer = null;
                if (! this.tryRewind()) {
                    this.fireRewindTillSuccess();
                };
            }, 100);
        }
    }
    
    isVisible(): boolean {
        return this.$messages.is(":visible");
    }
    
    processImages(): void {
        let dids: string[] = [];
        this.$messages.find("img.img-in-chat.not-loaded").each((_, el) => {
            let $el = $(el);
            $el.removeClass("not-loaded");
            let did = $el.data("did");
            if (did) {
                if (did in this.imagesCache) {
                    $el.attr("src", this.imagesCache[did]);
                    $el.closest(".message.file-box").removeClass("with-not-loaded-image").addClass("with-loaded-image");
                }
                this.$imagesToLoad[did] = $el;
                dids.push(did);
            }
        });
        if (dids.length > 0) {
            this.toggleScrollEnabled(false, false);
            this.triggerEvent("loadImages", JSON.stringify(dids), this.scrollState.isScrolledToBottom);
        }
    }
    
    setImageSrc(did: string, src: Types.app.BlobData, scrollToBottom: boolean): void {
        let $el = this.$imagesToLoad[did];
        if ($el) {
            delete this.$imagesToLoad[did];
            let objectUrl = webUtils.WebUtils.createObjectURL(src);
            this.imagesCache[did] = objectUrl;
            $el.attr("src", objectUrl);
            $el[0].onload = () => {
                $el.closest(".message.file-box").removeClass("with-not-loaded-image").addClass("with-loaded-image");
                if (scrollToBottom) {
                    this.rewind();
                }
            };
            if (scrollToBottom) {
                this.rewind();
            }
        }
    }
    
    toggleScrollEnabled(enabled: boolean, scrollToBottom: boolean): void {
        this.scrollEnabled = enabled;
        if (scrollToBottom) {
            this.rewind();
        }
    }
    
    processThumbs(): void {
        this.thumbs.processThumbs();
    }
   
    toggleIsInVoiceChatInThisSection(isInVoiceChat: boolean): void {
        this._model.isTalkingInThisSection = isInVoiceChat;
        this.$container.toggleClass("is-not-in-voice-chat", !isInVoiceChat);
        this.$container.toggleClass("is-in-voice-chat", isInVoiceChat);

    }

    toggleIsVoiceChatEnabled(isEnabled: boolean): void {
        this._model.isVoiceChatEnabled = isEnabled;
        this.$container.toggleClass("voice-chat-disabled", !isEnabled);
    }

    

    toggleIsVoiceChatActiveInThisSection(isVoiceChatActive: boolean): void {
        this._model.toggleIsVoiceChatActiveInThisSection = isVoiceChatActive;
        this.$container.toggleClass("is-voice-chat-active", isVoiceChatActive);
        this.$container.toggleClass("is-not-voice-chat-active", !isVoiceChatActive);


    }

    toggleIsInVoiceChatInAnotherSection(isInVoiceChat: boolean): void {
        this._model.isTalkingInAnotherSection = isInVoiceChat;
        this.$container.toggleClass("can-join-voice-chat", isInVoiceChat);
        this.$container.toggleClass("can-not-join-voice-chat", !isInVoiceChat);
        // this.$container.find("button[data-action='join-voice-chat']").prop("disabled", isInVoiceChat);
    }
    
    toggleIsTalkingInThisSection(isTalking: boolean): void {
        this._model.isTalkingInThisSection = isTalking;
        this.$container.toggleClass("is-talking", isTalking);
        this.$container.toggleClass("is-not-talking", !isTalking);
    }
    
    toggleIsTalkingInAnotherSection(isTalking: boolean): void {
        this._model.isTalkingInAnotherSection = isTalking;
    }

    toggleRingTheBellAvailable(avail: boolean): void {
        this._model.isRingTheBellAvailable = avail;
        let $btn = this.$chatReply.find("button[data-action='ring-the-bell']");
        $btn.prop("disabled", !avail);
    }
    
    onJoinVoiceChatClick(): void {
        this.triggerEvent("joinVoiceChat");
    }
    
    onLeaveVoiceChatTalkingClick(): void {
        this.triggerEvent("leaveVoiceChat");
    }
    
    onToggleTalkingClick(e: MouseEvent): void {
        if (e.ctrlKey || e.metaKey) {
            // for debug voicechat only
            this.triggerEvent("showPlayerWindow");
            return;
        }
        this.triggerEvent("toggleTalking");
    }
    
    onRingTheBellClick(): void {
        let $btn = this.$chatReply.find("button[data-action='ring-the-bell']");
        if ($btn.is(".ringing")) {
            return;
        }
        this.triggerEvent("ringTheBell");
        this.toggleRinging();
        setTimeout(() => {
            this.toggleRinging();
        }, 700);
    }
    
    privmxQuoteTldrToggleClick(e: MouseEvent): void {
        let $quote = $(e.currentTarget).closest(".privmx-quote");
        $quote.toggleClass("expanded");
        let isExpanded = $quote.hasClass("expanded");
        if (isExpanded) {
            let $msgText = $quote.closest(".chat-message").children(".text-col").children(".message").children(".text:not(.expanded)");
            if ($msgText.length > 0) {
                $msgText.addClass("expanded");
                let msgNum = $msgText.closest("[data-msg-num]").data("msg-num");
                this.triggerEvent("updateIsExpanded", msgNum, true);
            }
        }
        let msgNum = $quote.closest("[data-msg-num]").data("msg-num");
        this.triggerEvent("updateQuoteIsExpanded", msgNum, $quote.data("quote-id"), isExpanded);
        this.refreshScrollState();
    }
    
    toggleRinging(): void {
        let $btn = this.$chatReply.find("button[data-action='ring-the-bell']");
        $btn.toggleClass("ringing");
    }
    
    updateHeaderHeight(): void {
        let $container = this.$container.find("[data-container=chat-header-profiles-contact]");
        let $avatars = $container.find(".small-avatars-list");
        let $header = $container.parents(".header").first();
        let $chat = $header.next(".chat-inner");
        let height = Math.max(42, $avatars.outerHeight() + 10);
        $header.css("height", height + "px");
        $chat.css("top", (height + 7) + "px");
    }

    updateActiveVoiceChatUsers(usersStr: string): void {
        let $users = this.$container.find(".voice-chat-people > .inner > .list");
        let $content = this.templateManager.createTemplate(voiceChatPeopleTemplate).renderToJQ(JSON.parse(usersStr));
        $users.empty().append($content);
        this.personsComponent.refreshAvatars();
    }
    
}