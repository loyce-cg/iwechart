import {MessageTagsFactory} from "../mail/MessageTagsFactory";
import {LowUserPrivData, LowUserService} from "../mail/LowUser";
import {FileUtils} from "../app/browser/FileUtils";
import {Lang} from "../utils/Lang";
import * as Q from "q";
import * as privfs from "privfs-client";
import {ImageTypeDetector} from "../utils/ImageTypeDetector";
import {PromiseUtils} from "simplito-promise";
import Logger = require("simplito-logger");
import * as ViewLiteModule from "../build/view-lite";

export {
    FileUtils,
    Lang,
    Q,
    privfs,
    ImageTypeDetector,
    PromiseUtils
}

declare var DEFAULT_AVATAR_URL: string;
declare var DEFAULT_EMAIL_URL: string;
declare var HASHMAIL: string;
declare var I18N_DATA: {[key: string]: string};
declare var LANG: string;
declare var PASSWORD: string;
declare function privmxViewLiteRequire(name: string): any;

let ViewLite = <typeof ViewLiteModule>("privmxViewLiteRequire" in window ? privmxViewLiteRequire("privmx-view-lite") : null);
let $ = ViewLite ? ViewLite.$ : null;

export interface MsgModel {
    id: number;
    avatar: string;
    name: string;
    hashmail: string;
    address: string;
    ago: string;
    date: Date;
    text: string;
    contentType: string;
    attachments: privfs.message.MessageAttachment[];
}

export interface LowUserPrivDataL2 extends privfs.types.core.MasterRecordLevel2 {
    displayName?: string;
    avatarSeed?: number;
}

export class TalkPageApp {
    
    query: {[name: string]: any};
    
    constructor() {
        this.query = this.parseQueryString(window.location.search);
        let validateLogLevel = (level: string): boolean => {
            return level == "DEBUG" || level == "ERROR" || level == "INFO" || level == "OFF" || level == "WARN";
        };
        let devMode = !!this.query.devmode;
        let logLevel = devMode ? "WARN" : "ERROR";
        if (validateLogLevel(this.query.loglevel)) {
            logLevel = this.query.loglevel;
        }
        Logger.setLevel((<any>Logger)[logLevel]);
        if (devMode) {
            Logger.get("privfs-client.gateway.RpcGateway").setLevel(Logger.DEBUG);
        }
    }
    
    parseQueryString(query: string): {[name: string]: any} {
        if (!query) {
            return {};
        }
        query = query.indexOf("?") == 0 ? query.substring(1) : query;
        let paramsList = query.split("&");
        let paramMap: {[name: string]: any} = {};
        for (var i in paramsList) {
            if (paramsList[i].indexOf("=") == -1) {
                paramMap[paramsList[i]] = true;
            }
            else {
                let p = paramsList[i].split("=");
                paramMap[p[0]] = (<any>window).decodeURIComponent(p[1]);
            }
        }
        return paramMap;
    }
    
    login(hashmail: string, password: string): Q.Promise<TalkPageAppSession> {
        let hm: privfs.identity.Hashmail;
        return Q().then(() => {
            hm = new privfs.identity.Hashmail(hashmail);
            return privfs.core.PrivFsRpcManager.getHttpSrpByHost({host: hm.host});
        })
        .then(srp => {
            return srp.login(hm.user, hm.host, password, false, true);
        })
        .then(result => {
            return TalkPageAppSession.create(
                hm,
                <LowUserPrivData>result.decryptedMasterRecord.masterRecord.l1,
                <LowUserPrivDataL2>result.decryptedMasterRecord.masterRecord.l2,
                result.srpSecure
            );
        });
    }
    
    openAttachment(): Q.Promise<privfs.lazyBuffer.IContent> {
        return FileUtils.openFile();
    }
    
    openAttachments(): Q.Promise<privfs.lazyBuffer.IContent[]> {
        return FileUtils.openFiles();
    }
}

export interface ReceiverProfile {
    user: privfs.identity.User;
    name: string;
    displayName: string;
    hashmail: string;
    image: string;
}

export class TalkPageAppSession {
    
    receiversMap: {[hashmail: string]: ReceiverProfile};
    receiversLoadingMap: {[hashmail: string]: Q.Promise<void>};
    userProfileLoadCallback: (profile: ReceiverProfile) => void;
    
    constructor(
        public hashmail: privfs.identity.Hashmail,
        public privData: LowUserPrivData,
        public privDataL2: LowUserPrivDataL2,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public identity: privfs.identity.Identity,
        public sink: privfs.message.MessageSinkPriv,
        public receiver: ReceiverProfile,
        public client: privfs.core.Client,
        public messageManager: privfs.message.MessageManager
    ) {
        this.receiversMap = {};
        this.receiversMap[this.receiver.hashmail] = this.receiver;
        this.receiversLoadingMap = {};
    }
    
    static create(hashmail: privfs.identity.Hashmail, privData: LowUserPrivData, privDataL2: LowUserPrivDataL2, srpSecure: privfs.core.PrivFsSrpSecure): Q.Promise<TalkPageAppSession> {
        let pde = LowUserService.getPrivDataEx(hashmail, privData);
        let client = new privfs.core.Client(srpSecure.gateway, pde.identity, null);
        return Q().then(() => {
            return client.init();
        })
        .then(() => {
            let profile: ReceiverProfile = {
                user: pde.receiver,
                name: pde.receiver.name,
                displayName: pde.receiver.name || pde.receiver.hashmail,
                hashmail: pde.receiver.hashmail,
                image: null
            };
            let res = new TalkPageAppSession(hashmail, privData, privDataL2, srpSecure, pde.identity, pde.sink, profile, client, client.getMessageManager());
            
            return srpSecure.getUserInfo(pde.receiver.user, pde.receiver.host, true)
            .then(info => {
                profile.name = info.profile.name ? info.profile.name : "";
                profile.displayName = profile.name || profile.hashmail;
                if (info.profile.image) {
                    profile.image = ImageTypeDetector.createDataUrlFromBuffer(info.profile.image);
                }
            })
            .fail(e => {
                console.log("Fetching pki profile error", e);
            })
            .thenResolve(res);
        });
    }
    
    getReceiver(hashmail: string): ReceiverProfile {
        if (!(hashmail in this.receiversMap)) {
            this.loadHashmailInfo(hashmail);
        }
        return this.receiversMap[hashmail];
    }
    
    loadHashmailInfo(hashmail: string) {
        if (!(hashmail in this.receiversLoadingMap)) {
            let h = new privfs.identity.Hashmail(hashmail);
            this.receiversLoadingMap[hashmail] = this.srpSecure.getUserInfo(h.user, h.host, true)
            .then(info => {
                this.receiversMap[hashmail] = {
                    user: info.user,
                    name: info.profile.name ? info.profile.name : "",
                    displayName: info.profile.name ? info.profile.name : info.user.hashmail,
                    hashmail: info.user.hashmail,
                    image: info.profile.image ? ImageTypeDetector.createDataUrlFromBuffer(info.profile.image) : null
                };
                if (this.userProfileLoadCallback) {
                    this.userProfileLoadCallback(this.receiversMap[hashmail]);
                }
            })
            .fail(e => {
                console.log("Fetching pki profile error", e);
            })
        }
    }
    
    createMessage(title: string, text: string, attachments: privfs.lazyBuffer.IContent[]): privfs.message.Message {
        let message = new privfs.message.Message();
        message.setSender(this.identity);
        message.addReceiver(new privfs.message.MessageReceiver(this.sink, this.receiver.user));
        message.title = title;
        message.text = text;
        attachments.forEach(x => {
            message.addAttachment(x);
        });
        return message;
    }
    
    sendMessage(title: string, text: string, attachments: privfs.lazyBuffer.IContent[]): Q.Promise<void> {
        return this.postMessage(this.createMessage(title, text, attachments));
    }
    
    postMessage(message: privfs.message.Message): Q.Promise<void> {
        return Q().then(() => {
            return this.messageManager.messagePost(message, MessageTagsFactory.getMessageTags(message));
        })
        .then((result: privfs.types.message.ReceiverData[]) => {
            if (!result || result.length != 1) {
                return Q.reject(result);
            }
            if (!result[0].success) {
                return Q.reject(result[0]);
            }
        });
    }
    
    getMessages(lastSeq?: number): Q.Promise<{messages: privfs.types.message.MessageEntryParsed[], cursor: privfs.message.MessageSinkCursor}> {
        let cursor: privfs.message.MessageSinkCursor;
        return Q().then(() => {
            return this.messageManager.sinkInfo(this.sink.id, true);
        })
        .then(info => {
            cursor = new privfs.message.MessageSinkCursor(this.sink, info.seq, info.modSeq);
            if (lastSeq != null && lastSeq == info.seq) {
                return null;
            }
            return <Q.Promise<privfs.types.message.MessageEntryParsed[]>>this.messageManager.messageGet(this.sink, info.mids, "DATA_AND_META", false);
        })
        .then(messages => {
            return {messages: messages, cursor: cursor};
        });
    }
}

export class View {
    
    app: TalkPageApp;
    session: TalkPageAppSession;
    attachmentId: number;
    attachments: {[id: string]: privfs.lazyBuffer.IContent};
    lastCursor: privfs.message.MessageSinkCursor;
    messages: privfs.types.message.MessageEntryParsed[];
    newMessages: privfs.types.message.MessageEntryParsed[];
    oldMessages: privfs.types.message.MessageEntryParsed[];
    manager: ViewLiteModule.TemplateManager;
    helper: ViewLiteModule.ViewHelper;
    msgTemplate: ViewLiteModule.Template<any, any, any>;
    attachmentTemplate: ViewLiteModule.Template<any, any, any>;
    msgLoadingTemplate: ViewLiteModule.Template<any, any, any>;
    alertTemplate: ViewLiteModule.Template<any, any, any>;
    loginDialogTemplate: ViewLiteModule.Template<any, any, any>;
    momentService: ViewLiteModule.MomentService;
    messagesSortAsc: boolean;
    showOnlyWithAttachment: boolean;
    currentTitle: string;
    attachmentsCount: number;
    myName: string;
    myAvatar: string;
    
    $loginPage: JQuery;
    $messagePage: JQuery;
    $newMessagePage: JQuery;
    $pmxButtons: JQuery;
    $pageHeader: JQuery;
    
    constructor(public $ele: JQuery) {
        privfs.core.PrivFsRpcManager.setServiceDiscoveryJsonMode(window.location.protocol === "https:" ?
            privfs.serviceDiscovery.JsonMode.HTTPS_ONLY : privfs.serviceDiscovery.JsonMode.HTTP_ONLY);
        
        this.app = new TalkPageApp();
        this.attachmentId = 0;
        this.attachments = {};
        this.manager = new ViewLite.TemplateManager();
        this.helper = new ViewLite.ViewHelper(this.manager);
        this.helper.i18n = this.i18n.bind(this);
        this.manager.defaultHelper = this.helper;
        this.msgTemplate = this.manager.createTemplateFromHtmlElement(this.$ele.find("#msg-template"));
        this.attachmentTemplate = this.manager.createTemplateFromHtmlElement(this.$ele.find("#attachment-template"));
        this.msgLoadingTemplate = this.manager.createTemplateFromHtmlElement(this.$ele.find("#msg-loading-template"));
        this.alertTemplate = this.manager.createTemplateFromHtmlElement(this.$ele.find("#alert-template"));
        this.loginDialogTemplate = this.manager.createTemplateFromHtmlElement(this.$ele.find("#login-dialog-template"));
        this.momentService = ViewLite.MomentService.create();
        this.momentService.setLang(LANG);
        this.messagesSortAsc = false;
        
        this.$loginPage = this.$ele.find(".lg-login-page");
        this.$messagePage = this.$ele.find(".lg-message-page");
        this.$newMessagePage = this.$ele.find(".lg-new-message-page");
        this.$pmxButtons = this.$ele.find(".pmxbuttons");
        this.$pageHeader = this.$ele.find(".header");
        
        this.$loginPage.find(".lg-login-btn").click(this.onLoginClick.bind(this));
        this.$loginPage.find("input").keydown(this.onLoginInput.bind(this));
        this.$loginPage.find(".pass-trigger").click(this.onPassTrigger.bind(this));
        this.$loginPage.find(".pass-hint-content").click(this.onPassContentClick.bind(this));
        this.$pmxButtons.find(".lg-refresh-btn").click(this.onRefreshClick.bind(this));
        this.$pmxButtons.find(".lg-new-msg-btn").click(this.onNewMsgBtnClick.bind(this));
        this.$pmxButtons.find(".lg-file-filter").click(this.onFileFilterClick.bind(this));
        this.$newMessagePage.find(".lg-add-attachments-btn").click(this.onAddAttachmentClick.bind(this));
        this.$newMessagePage.find(".lg-send-btn").click(this.onSendClick.bind(this));
        this.$newMessagePage.find(".lg-close-btn").click(this.onCloseBtnClick.bind(this));
        this.$newMessagePage.find(".lg-show-messages").click(this.onShowMessagesClick.bind(this));
        this.$newMessagePage.on("click", ".lg-attachment-delete", this.onDeleteAttachmentClick.bind(this));
        this.$messagePage.on("click", ".lg-msg-attachment-download", this.onMsgDownloadAttachmentClick.bind(this));
        this.$messagePage.change(".lg-msg-sort-type", this.onSortTypeChange.bind(this));
        this.$messagePage.on("click", ".message-quote-toggle", this.onMessageQuoteToggleClick.bind(this));
        this.$messagePage.on("click", "a", this.onAhrefClick.bind(this));
        this.$messagePage.on("click", ".lg-content-toggle", this.onPostConentToggleClick.bind(this));
        this.$messagePage.on("click", ".post-quote", this.onPostQuoteClick.bind(this));
        this.$pageHeader.on("click", ".info-with-popup", this.onInfoWithPopupClick.bind(this));
        
        this.$ele.find(".footer").append("<span>" + (new Date().getFullYear()) + "</span>");
        setTimeout(() => {
            this.$loginPage.find("input").focus();
            this.resetNewMsgForm();
        }, 100);
    }
    
    static init() {
        $(document).ready(() => {
            (<any>window).app = new View($("body"));
            
            $("body").on("click", () => {
                $(".info-with-popup").removeClass("opened");
            });
        });
    }
    
    i18n(key: string, ..._args: any[]): string {
        let text = key in I18N_DATA ? I18N_DATA[key] : key;
        let params = Array.prototype.slice.call(arguments);
        params[0] = text;
        return this.formatText.apply(this, params);
    }
    
    formatText(text: string, ..._args: any[]): string {
        text = text.toString();
        if (arguments.length < 2) {
            return text;
        }
        let params = ("object" == typeof(arguments[1])) ? arguments[1] : Array.prototype.slice.call(arguments, 1);
        for (var k in params) {
            text = text.replace(new RegExp("\\{" + k + "\\}", "gi"), params[k]);
        }
        return text;
    }
    
    onPassTrigger() {
        this.$loginPage.find(".pass-trigger").addClass("hide");
        this.$loginPage.find(".pass-hint-content").removeClass("hide");
    }
    
    onPassContentClick() {
        this.$loginPage.find(".pass-trigger").removeClass("hide");
        this.$loginPage.find(".pass-hint-content").addClass("hide");
    }
    
    onAhrefClick(e: MouseEvent): boolean {
        let $el = $(e.target).closest("a");
        let href = $el.attr("href");
        if (href.indexOf("mailto:") == 0) {
            e.preventDefault();
            return false;
        }
    }
    
    customMsgBox(options: {message: string, buttons?: string[], onClose?: (result: string) => void}) {
        let $alert = this.alertTemplate.renderToJQ(options);
        this.$ele.append($alert);
        $alert.on("click", ".lg-close-alert", e => {
            let $trigger = $(e.target).closest(".lg-close-alert");
            let result = $trigger.data("result");
            if (options.onClose) {
                options.onClose(result);
            }
            $alert.remove();
        });
    }
    
    customAlert(message: string, onClose?: (result: string) => void) {
        this.customMsgBox({message: message, buttons: ["ok"], onClose: onClose});
    }
    
    customConfirm(message: string, onClose?: (result: string) => void) {
        this.customMsgBox({message: message, buttons: ["yes", "no"], onClose: onClose});
    }
    
    onLoginInput(e: KeyboardEvent) {
        if (e.keyCode == 13) {
            this.onLoginClick();
        }
    }
    
    onLoginClick() {
        let password = PASSWORD == "empty" ? "<empty>" : <string>this.$loginPage.find(".lg-password").val();
        let $error = this.$loginPage.find(".lg-error");
        if (!password) {
            $error.removeClass("hide").text(this.i18n("login.password.required"));
            return;
        }
        let $inputs = this.$loginPage.find("button, input, textarea");
        let $btn = this.$loginPage.find(".lg-login-btn");
        $inputs.prop("disabled", true);
        $error.addClass("hide");
        $btn.prepend('<i class="fa fa-spin fa-circle-o-notch"></i>');
        return Q().then(() => {
            return this.app.login(HASHMAIL, password);
        })
        .then(session => {
            this.$loginPage.find(".lg-password").val("");
            this.$loginPage.addClass("hide");
            this.$pmxButtons.removeClass("hide");
            this.$messagePage.removeClass("hide");
            $btn.find("i").remove();
            this.session = session;
            this.session.userProfileLoadCallback = this.onUserProfileLoad.bind(this);
            this.myName = this.session.privDataL2.displayName || "";
            this.myAvatar = this.session.privDataL2.avatarSeed ? new ViewLite.AvatarGenerator({seed: this.session.privDataL2.avatarSeed, imageWidth: 60, imageHeight: 60}).getDataUrl() : DEFAULT_EMAIL_URL;
            this.renderMessages(false);
            this.messagesCheck();
            let receiver = this.session.receiver.hashmail;
            if (this.session.receiver.name) {
                receiver = "<b>" + this.helper.escapeHtml(this.session.receiver.name) + "</b> <span class='hashmail'>&lt;" + this.session.receiver.hashmail + "&gt;</span>";
            }
            this.$newMessagePage.find(".lg-receiver-avatar").attr("src", this.session.receiver.image ? this.session.receiver.image : DEFAULT_AVATAR_URL);
            this.$newMessagePage.find(".lg-receiver-name").html(receiver);
        })
        .fail(e => {
            console.log("Login error", e);
            $inputs.prop("disabled", false);
            $btn.find("i").remove();
            let message = this.i18n("login.error.unknown");
            if (PASSWORD != "empty") {
                if (privfs.core.ApiErrorCodes.isEx(e, "DIFFERENT_M1")) {
                    message = this.i18n("login.error.invalid");
                }
                else if (privfs.core.ApiErrorCodes.isEx(e, "USER_DOESNT_EXIST")) {
                    message = this.i18n("login.error.invalid");
                }
                else if (privfs.core.ApiErrorCodes.isEx(e, "INVALID_VERIFER")) {
                    message = this.i18n("login.error.invalid");
                }
            }
            $error.removeClass("hide").text(message);
        });
    }
    
    onUserProfileLoad(profile: ReceiverProfile): void {
        let $e = this.$messagePage.find("[data-hashmail='" + profile.hashmail + "']");
        $e.find(".post-author").text(profile.displayName);
        if (profile.image) {
            $e.find(".post-header-avatar img").attr("src", profile.image);
        }
    }
    
    getMsgModel(msg: privfs.types.message.MessageEntryParsed): MsgModel {
        let me = msg.data.sender.pub58 == this.session.identity.pub58;
        let receiver = me ? null : this.session.getReceiver(msg.data.sender.hashmail);
        return {
            id: msg.meta.msgId,
            avatar: me ? this.myAvatar : (receiver && receiver.image ? receiver.image : DEFAULT_AVATAR_URL),
            name: me ? this.myName : (receiver ? receiver.displayName : msg.data.sender.name),
            hashmail: msg.data.sender.hashmail,
            address: me ? this.session.identity.name : (receiver ? receiver.hashmail : msg.data.sender.hashmail),
            ago: this.momentService.timeAgo(msg.data.createDate),
            date: msg.data.createDate,
            text: msg.data.text,
            contentType: msg.data.contentType,
            attachments: msg.data.attachments
        };
    }
    
    onFileFilterClick() {
        this.showOnlyWithAttachment = !this.showOnlyWithAttachment;
        this.$ele.toggleClass("lg-show-all-msg", !this.showOnlyWithAttachment);
        this.refreshFilesFilterButton();
        this.renderNewMessages();
        this.renderOldMessages();
    }
    
    refreshFilesFilterButton() {
        let $button = this.$messagePage.find(".lg-file-filter");
        if (this.showOnlyWithAttachment) {
            $button.html(this.i18n("messages.buttons.files.showAll"));
        }
        else {
            if (this.attachmentsCount) {
                $button.html(this.i18n("messages.buttons.files.short") + " (" + this.attachmentsCount + ")");
            }
            else {
                $button.html(this.i18n("messages.buttons.files"));
            }
        }
        $button.prop("disabled", !this.showOnlyWithAttachment && !this.attachmentsCount);
    }
    
    onRefreshClick() {
        this.renderMessages(false);
    }
    
    messagesCheck() {
        setTimeout(() => {
            this.renderMessages(true);
            this.messagesCheck();
        }, 10000)
    }
    
    renderMessages(checkMode: boolean) {
        let $loadingContainer = this.$messagePage.find(".lg-load-messages");
        let $oldMsgContainer = this.$messagePage.find(".lg-old-messages");
        let $newMsgContainer = this.$messagePage.find(".lg-new-messages");
        if (checkMode !== true) {
            $loadingContainer.content(this.msgLoadingTemplate.renderToJQ()).removeClass("hide");
            $oldMsgContainer.addClass("hide");
            $newMsgContainer.addClass("hide");
        }
        
        return this.session.getMessages(checkMode === true && this.lastCursor ? this.lastCursor.seq : null).then(res => {
            if (checkMode === true && res.messages == null) {
                return;
            }
            this.lastCursor = res.cursor;
            this.messages = res.messages;
            this.currentTitle = this.messages.length > 0 ? this.messages[0].data.title : "<no-title>";
            this.$messagePage.find(".lg-title").text(this.currentTitle);
            this.$newMessagePage.find(".lg-title").text(this.currentTitle);
            window.document.title = this.currentTitle + " -- " + this.i18n("title2");
            
            let noReadMessages = this.messages.filter(x => !x.meta.data || !x.meta.data.read);
            PromiseUtils.oneByOne(noReadMessages, (_i, x) => {
                let data = x.meta.data || {};
                data.read = true;
                return this.session.messageManager.messageModify(res.cursor, x.meta.msgId, data, x.meta.tags, true, true);
            })
            .fail(e => {
                console.log("Error during changing messages flags", e);
            })
            this.newMessages = noReadMessages.filter(x => x.data.sender.pub58 != this.session.identity.pub58);
            this.renderNewMessages();
            
            this.oldMessages = this.messages.filter(x => x.data.sender.pub58 == this.session.identity.pub58 || (x.meta.data && x.meta.data.read == true));
            this.renderOldMessages();
            
            $loadingContainer.html("").addClass("hide");
            if (this.newMessages.length == 0) {
                $oldMsgContainer.removeClass("hide");
            }
            else {
                $oldMsgContainer.removeClass("hide");
                $newMsgContainer.removeClass("hide");
            }
            $oldMsgContainer.find(".section-label").html(this.newMessages.length == 0 ? this.i18n("messages.messages") : this.i18n("messages.previous"));
            this.attachmentsCount = 0;
            this.messages.forEach(x => {
                this.attachmentsCount += x.data.attachments.length;
            });
            this.refreshFilesFilterButton();
        })
        .fail(e => {
            console.log("Read messages error", e);
            if (checkMode !== true) {
                if (this.isSessionExpiredError(e)) {
                    this.relogin().then(() => {
                        this.renderMessages(checkMode);
                    })
                    .fail(() => {
                        $loadingContainer.html("").addClass("hide");
                        $oldMsgContainer.removeClass("hide");
                        $newMsgContainer.removeClass("hide");
                    });
                }
                else {
                    $loadingContainer.html("").addClass("hide");
                    $oldMsgContainer.removeClass("hide");
                    $newMsgContainer.removeClass("hide");
                    this.customAlert(this.formatError(this.i18n("messages.error.read"), e));
                }
            }
        })
    }
    
    renderMsg(model: any) {
        var $ele = this.msgTemplate.renderToJQ(model);
        $ele.find("a.linkified[href^='mailto:']").each((_i, e) => {
            $('<span>' + this.helper.escapeHtml($(e).text()) + '</span>').insertAfter(e);
            $(e).remove();
        });
        return $ele;
    }
    
    renderNewMessages() {
        this.newMessages.sort((a, b) => {
            return b.data.createDate.getTime() - a.data.createDate.getTime();
        });
        let $newMsgContainer = this.$messagePage.find(".lg-new-messages-list");
        $newMsgContainer.html("");
        this.$messagePage.find(".lg-new-messages-counter").text(this.newMessages.length);
        this.newMessages.forEach(msg => {
            let model = this.getMsgModel(msg);
            if (this.showOnlyWithAttachment && model.attachments.length == 0) {
                return;
            }
            $newMsgContainer.append(this.renderMsg(model));
        });
    }
    
    renderOldMessages() {
        this.oldMessages.sort((a, b) => {
            return (this.messagesSortAsc ? -1 : 1) * (b.data.createDate.getTime() - a.data.createDate.getTime());
        });
        let $oldMsgContainer = this.$messagePage.find(".lg-old-messages-list");
        $oldMsgContainer.html("");
        this.$messagePage.find(".lg-messages-counter").text(this.oldMessages.length);
        this.oldMessages.forEach(msg => {
            let model = this.getMsgModel(msg);
            if (this.showOnlyWithAttachment && model.attachments.length == 0) {
                return;
            }
            $oldMsgContainer.append(this.renderMsg(model));
        });
    }
    
    onSortTypeChange() {
        this.messagesSortAsc = (<string>this.$messagePage.find(".lg-msg-sort-type").val()) == "asc";
        this.renderOldMessages();
    }
    
    onMessageQuoteToggleClick(e: MouseEvent) {
        let $toggle = $(e.target).closest(".message-quote-toggle");
        let visible = $toggle.next().is(":visible");
        $toggle.find("span").html(this.i18n(visible ? "core.toggleQuote" : "core.hideQuote"));
        $toggle.find("i").attr("class", visible ? "fa fa-caret-right" : "fa fa-caret-down");
        $toggle.next().toggle();
    }
    
    onPostConentToggleClick(e: MouseEvent) {
        let $toggle = $(e.target).closest(".lg-content-toggle");
        let visible = $toggle.next().hasClass("lg-visible");
        $toggle.find("span").html(this.i18n(visible ? "core.showContent" : "core.hideContent"));
        $toggle.find("i").attr("class", visible ? "fa fa-caret-right" : "fa fa-caret-down");
        $toggle.next().toggleClass("lg-visible", !visible);
    }
    
    onPostQuoteClick(e: MouseEvent) {
        let $post = $(e.target).closest(".post");
        let id = $post.data("id");
        let msg = Lang.find(this.messages, x => x.meta.msgId == id);
        if (msg == null) {
            return;
        }
        this.onNewMsgBtnClick();
        let $txt = this.$newMessagePage.find(".lg-text");
        let value = <string>$txt.val();
        let quote = this.getMessageQuote(msg);
        if (value) {
            $txt.val(value + quote + "\n");
        }
        else {
            $txt.val(quote);
            this.resetCursor(<HTMLTextAreaElement>$txt[0]);
        }
    }

    onInfoWithPopupClick(e: MouseEvent) {
        $(e.target).closest(".info-with-popup").toggleClass('opened');
        return false;
    }
    
    resetCursor(txtElement: HTMLTextAreaElement) {
        if (txtElement.setSelectionRange) {
            txtElement.focus();
            txtElement.setSelectionRange(0, 0);
        }
        else if ((<any>txtElement).createTextRange) {
            var range = (<any>txtElement).createTextRange();
            range.moveStart('character', 0);
            range.select();
        }
    }
    
    getMessageQuote(msg: privfs.types.message.MessageEntryParsed): string {
        let me = msg.data.sender.pub58 == this.session.identity.pub58;
        let receiver = msg.data.sender.pub58 == this.session.receiver.user.pub58;
        let sender = me ? this.session.identity.name : (receiver ? this.session.receiver.hashmail : msg.data.sender.hashmail);
        let text = msg.data.text.replace(/<br\s*\/?>/gmi, "\n").replace(/\&gt\;/gmi, ">");
        let quote = "> " + text.split("\n").join("\n> ");
        let createDate = this.momentService.longDate(msg.data.createDate);
        let prefix = this.i18n("messages.quote.text", [createDate, sender]);
        let parts = ["\n\n", prefix, "\n", quote];
        return parts.join("");
    }
    
    onMsgDownloadAttachmentClick(event: MouseEvent) {
        let $attachment = $(<HTMLElement>event.target).closest(".lg-msg-attachment");
        let msgId = $attachment.data("msg-id");
        let attIndex = $attachment.data("att-index");
        let msg = Lang.find(this.messages, x => x.meta.msgId == msgId);
        if (msg == null) {
            return;
        }
        let att = msg.data.attachments[attIndex];
        if (att == null) {
            return;
        }
        let $spinner = $attachment.find(".att-loading");
        if ($spinner.length == 0) {
            $spinner = $('<div class="att-loading"><i class="fa fa-spin fa-circle-o-notch"></i></div>');
            $attachment.append($spinner);
        }
        Q().then(() => {
            return att.getContent(true);
        })
        .then(data => {
            $spinner.remove();
            return FileUtils.saveContent(data.getContent());
        })
        .fail(e => {
            console.log("Download attachment error", e);
            if (this.isSessionExpiredError(e)) {
                this.relogin().then(() => {
                    this.onMsgDownloadAttachmentClick(event);
                })
                .fail(() => {
                    $spinner.remove();
                });
            }
            else {
                $spinner.remove();
                this.customAlert(this.formatError(this.i18n("messages.error.downloadAttachment"), e));
            }
        });
    }
    
    onAddAttachmentClick() {
        this.app.openAttachments().then(attachments => {
            let $container = this.$newMessagePage.find(".lg-attachments");
            attachments.forEach(x => {
                let id = this.attachmentId++;
                this.attachments[id] = x;
                $container.append(this.attachmentTemplate.renderToJQ({
                    id: id,
                    name: x.getName(),
                    icon: x.getMimeType().indexOf("image/") == 0 ? "fa-file-image-o" : "fa-file-o"
                }));
            });
            this.$newMessagePage.find(".lg-attachments-empty").toggleClass("hide", Lang.getValues(this.attachments).length > 0);
        })
        .fail(e => console.log("Error during adding attachment", e));
    }
    
    onDeleteAttachmentClick(e: MouseEvent) {
        let $attachment = $(e.target).closest(".lg-attachment");
        let id = $attachment.data("id");
        delete this.attachments[id];
        $attachment.remove();
        this.$newMessagePage.find(".lg-attachments-empty").toggleClass("hide", Lang.getValues(this.attachments).length > 0);
    }
    
    onNewMsgBtnClick() {
        this.$messagePage.addClass("hide");
        this.$newMessagePage.removeClass("hide");
        this.$newMessagePage.find(".lg-text").focus();
    }
    
    onCloseBtnClick() {
        this.$messagePage.find(".lg-new-msg-btn").removeClass("lg-continue-mode");
        this.$messagePage.removeClass("hide");
        this.$newMessagePage.addClass("hide");
        this.resetNewMsgForm();
    }
    
    onShowMessagesClick() {
        this.$messagePage.find(".lg-new-msg-btn").addClass("lg-continue-mode");
        this.$messagePage.removeClass("hide");
        this.$newMessagePage.addClass("hide");
    }
    
    resetNewMsgForm() {
        this.$newMessagePage.find(".lg-text").val("");
        this.attachments = {};
        this.$newMessagePage.find(".lg-attachments .lg-attachment").remove();
        this.$newMessagePage.find(".lg-attachments-empty").removeClass("hide");
    }
    
    onSendClick() {
        let text = <string>this.$newMessagePage.find(".lg-text").val();
        if (!text) {
            return;
        }
        this.customConfirm(this.i18n("newMessage.question"), result => {
            if (result != "yes") {
                return;
            }
            this.sendCore();
        });
    }
    
    sendCore() {
        let text = <string>this.$newMessagePage.find(".lg-text").val();
        if (!text) {
            return;
        }
        let $error = this.$newMessagePage.find(".lg-error");
        let $inputs = this.$newMessagePage.find("button, input, textarea");
        let $btn = this.$newMessagePage.find(".lg-send-btn");
        $btn.addClass("sending").prepend('<i class="fa fa-spin fa-circle-o-notch"></i>');
        $inputs.prop("disabled", true);
        $error.addClass("hide");
        return Q().then(() => {
            let title = this.currentTitle && this.currentTitle.indexOf("Re:") == 0 ? this.currentTitle : "Re: " + this.currentTitle;
            return this.session.sendMessage(title, text, Lang.getValues(this.attachments));
        })
        .then(() => {
            $inputs.prop("disabled", false);
            $btn.removeClass("sending").find("> i").remove();
            this.$messagePage.find(".lg-new-msg-btn").removeClass("lg-continue-mode");
            this.$messagePage.removeClass("hide");
            this.$newMessagePage.addClass("hide");
            this.resetNewMsgForm();
            this.renderMessages(false);
        })
        .fail(e => {
            console.log("Send message error", e);
            if (this.isSessionExpiredError(e)) {
                this.relogin().then(() => {
                    this.sendCore();
                })
                .fail(() => {
                    $inputs.prop("disabled", false);
                    $btn.removeClass("sending").find("> i").remove();
                })
            }
            else {
                $inputs.prop("disabled", false);
                $btn.removeClass("sending").find("> i").remove();
                this.customAlert(this.formatError(this.i18n("newMessage.error"), e));
            }
        });
    }
    
    formatError(mainMsg: string, e: any) {
        if ("transferId" in e && e.couse) {
            e = e.couse;
        }
        var msg = "";
        if (e && e.message) {
            msg = e.message;
        }
        else if (e && e.msg) {
            msg = e.msg;
        }
        var code = null;
        if (e && e.data && e.data.error && e.data.error.code) {
            code = e.data.error.code;
        }
        if (e && e.errorObject && e.errorObject.code) {
            code = e.errorObject.code;
        }
        if (code != null) {
            msg = (typeof(code) == "number" ? "0x" + code.toString(16) : code) + (msg ? ": " + msg : "");
        }
        return mainMsg + (msg ? " (" + msg + ")": "");
    }
    
    isSessionExpiredError(e: any): boolean {
        return e && ((typeof(e) == "string" && e.indexOf("Connection Broken") == 0) || (typeof(e.couse) == "string" && e.couse.indexOf("Connection Broken") == 0));
    }
    
    relogin(): Q.Promise<void> {
        let defer = Q.defer<void>();
        if (PASSWORD == "empty") {
            Q().then(() => {
                return this.session.srpSecure.gateway.srpRelogin(this.session.identity.user, "<empty>");
            })
            .then(() => {
                console.log("Relogin successfully");
                defer.resolve();
            })
            .fail(e => {
                console.log("Relogin error", e);
                defer.reject(e);
                this.customAlert(this.formatError(this.i18n("relogin.error"), e));
            });
        }
        else {
            let $loginDialog = this.loginDialogTemplate.renderToJQ();
            this.$ele.append($loginDialog);
            let reloginFunc = () => {
                let password = <string>$loginDialog.find(".lg-relogin-password").val();
                let $error = $loginDialog.find(".lg-relogin-error");
                if (!password) {
                    $error.removeClass("hide").text(this.i18n("login.password.required"));
                    return;
                }
                let $inputs = $loginDialog.find("button, input, textarea");
                let $btn = $loginDialog.find(".lg-relogin-btn");
                $inputs.prop("disabled", true);
                $error.addClass("hide");
                $btn.prepend('<i class="fa fa-spin fa-circle-o-notch"></i>');
                Q().then(() => {
                    return this.session.srpSecure.gateway.srpRelogin(this.session.identity.user, password);
                })
                .then(() => {
                    console.log("Relogin successfully");
                    $loginDialog.remove();
                    defer.resolve();
                })
                .fail(e => {
                    console.log("Relogin error", e);
                    $inputs.prop("disabled", false);
                    $btn.find("i").remove();
                    let message = this.i18n("relogin.error");
                    if (privfs.core.ApiErrorCodes.isEx(e, "DIFFERENT_M1")) {
                        message = this.i18n("login.error.invalid");
                    }
                    else if (privfs.core.ApiErrorCodes.isEx(e, "USER_DOESNT_EXIST")) {
                        message = this.i18n("login.error.invalid");
                    }
                    else if (privfs.core.ApiErrorCodes.isEx(e, "INVALID_VERIFER")) {
                        message = this.i18n("login.error.invalid");
                    }
                    $error.removeClass("hide").text(message);
                });
            };
            $loginDialog.find(".lg-relogin-btn").click(() => {
                reloginFunc();
            });
            $loginDialog.find(".lg-relogin-password").on("keydown", e => {
                if (e.keyCode == 13) {
                    reloginFunc();
                }
            }).focus();
        }
        return defer.promise;
    }
}