import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {Flex} from "../../web-utils/Flex";
import {UI} from "../../web-utils/UI";
import * as $ from "jquery";
import {Dropdown} from "../../component/dropdown/Dropdown";
import {func as mainTemplate} from "./template/main.html";
import {func as previewTemplate} from "./template/preview.html";
import {func as headerTemplate} from "./template/header.html";
import {func as sinksTemplate} from "./template/sinks.html";
import {func as verifyInfoTemplate} from "./template/verifyInfo.html";
import {func as senderStateTemplate} from "./template/senderState.html";
import {Model, VerifyInfoModel, HeaderModel} from "./MessageWindowController";
import {SinkIndexEntry} from "../../mail/SinkIndexEntry";
import * as privfs from "privfs-client";
import {app} from "../../Types";
import { WebUtils } from "../../web-utils/WebUtils";

export interface CustomButton {
    icon: string;
    labelKey: string;
    action: string;
    visible?: (sinkIndexEntry: SinkIndexEntry, sinkType: string) => boolean;
}

export interface PreviewModel extends HeaderModel {
    customButtons: CustomButton[];
}

@WindowView
export class MessageWindowView extends BaseWindowView<Model> {
    
    dropdown: Dropdown<privfs.message.MessageSinkPriv[]>;
    verifyDropdown: Dropdown<VerifyInfoModel>;
    customButtons: CustomButton[];
    imagesUrls: string[];
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.customButtons = [];
        this.imagesUrls = [];
    }
    
    initWindow(_model: Model): void {
        this.$main.on("click", "[data-url]", this.onLinkClick.bind(this));
        this.$main.on("click", "a", this.onAhrefClick.bind(this));
        this.$main.on("click", "[data-add-contact]", this.onMessagePreviewAddContactClick.bind(this));
        this.$main.on("click", "[data-send-message]", this.onSendMessageClick.bind(this));
        this.$main.on("click", "[data-attachment]", this.onAttachmentClick.bind(this));
        this.$main.on("click", "[data-container=header] [data-action]", this.onHeaderActionClick.bind(this));
        $(window).on("resize", this.onResize.bind(this));
    }
    
    registerCustomButton(customButton: CustomButton) {
        this.customButtons.push(customButton);
    }
    
    readyToRenderMessage(): void {
        this.triggerEvent("readyToRenderMessage");
    }
    
    renderMessage(model: PreviewModel): void {
        if (model) {
            model.customButtons = this.customButtons;
        }
        this.imagesUrls.forEach(x => {
            URL.revokeObjectURL(x);
        });
        this.imagesUrls = [];
        this.$main.find(".preview").content(this.templateManager.createTemplate(previewTemplate).renderToJQ(model));
        Flex.refreshFlex();
    }
    
    renderHeader(model: PreviewModel): void {
        if (model) {
            model.customButtons = this.customButtons;
        }
        this.$main.find("[data-container=header]").replaceWith(this.templateManager.createTemplate(headerTemplate).renderToJQ(model));
        Flex.refreshFlex();
    }
    
    setImageProgress(msgId: number, attachmentIndex: number, progress: {percent: number}): void {
        this.$main.find(".image[data-index=" + msgId + "-" + attachmentIndex + "]").find(".inner .progress-text").html(progress.percent + "%");
    }
    
    setImageDataUrl(msgId: number, attachmentIndex: number, data: app.BlobData): void {
        let $inner = this.$main.find(".image[data-index=" + msgId + "-" + attachmentIndex + "]").find(".inner");
        if ($inner.find("img").length > 0) {
            return;
        }
        let url = WebUtils.createObjectURL(data);
        this.imagesUrls.push(url);
        let img = document.createElement("img");
        img.src = url;
        img.onload = () => {
            $inner.find(".progress-container").remove();
            $inner.find("img").addClass("loaded");
        };
        $inner.append(img);
    }
    
    showMoveToDialog(sinks: privfs.message.MessageSinkPriv[]): void {
        this.dropdown = new Dropdown({
            model: sinks,
            template: this.templateManager.createTemplate(sinksTemplate),
            $container: this.$main.find("header .move-btn"),
            templateManager: this.templateManager
        });
    }
    
    showVerifyInfoDialog(model: VerifyInfoModel): void {
        this.verifyDropdown = new Dropdown({
            model: model,
            template: this.templateManager.createTemplate(verifyInfoTemplate),
            $container: this.$main.find("header .sender-state"),
            templateManager: this.templateManager
        });
    }
    
    refreshVerifyInfoDialog(model: VerifyInfoModel): void {
        if (this.verifyDropdown) {
            this.verifyDropdown.options.model = model;
            this.verifyDropdown.refresh();
        }
    }
    
    refreshVerifyInfo(indexEntry: SinkIndexEntry): void {
        this.$main.find("header .sender-state > i").replaceWith(this.templateManager.createTemplate(senderStateTemplate).renderToJQ(indexEntry));
    }
    
    onResize(): void {
        Flex.refreshFlex();
    }
    
    onSendMessageClick(event: MouseEvent): void {
        let $e = $(event.target).closest("[data-send-message]");
        let type = $e.data("send-message");
        let hashmail = $e.data("hashmail");
        let sid = $e.data("sid");
        this.triggerEvent("sendMessage", type, hashmail, sid);
    }
    
    onAttachmentClick(event: MouseEvent): void {
        let idx = $(event.target).data("attachment");
        this.triggerEvent("downloadAttachment", idx);
    }
    
    onLinkClick(e: MouseEvent): void {
        let $el = $(e.target).closest("[data-url]");
        let url = $el.data("url");
        this.triggerEventInTheSameTick("openUrl", url);
    }
    
    onAhrefClick(e: MouseEvent): boolean {
        let $el = $(e.target).closest("a");
        let href = $el.attr("href");
        if (href.indexOf("mailto:") == 0) {
            e.preventDefault();
            this.triggerEventInTheSameTick("openUrl", href);
            return false;
        }
    }
    
    onHeaderActionClick(event: MouseEvent): void {
        let $trigger = $(event.target).closest("[data-action]");
        let action = $trigger.data("action");
        let selectedText = UI.getSelectionText();
        switch (action) {
            case "reply-to-all":
                this.triggerEvent("replyToAll", selectedText || null);
                break;
            case "reply":
                this.triggerEvent("reply", selectedText || null);
                break;
            case "forward":
                this.triggerEvent("forward");
                break;
            case "move":
                this.triggerEvent("move");
                break;
            case "move-to":
                this.dropdown.destroy();
                this.triggerEvent("moveTo", $trigger.data("sink-id"));
                break;
            case "delete":
                this.triggerEvent("delete");
                break;
            case "show-source":
                this.triggerEvent("showSource");
                break;
            case "resend":
                this.triggerEvent("resendMessage");
                break;
            case "verify-info":
                this.showVerifyInfoDialog("loading");
                this.triggerEvent("showVerifyInfo");
                break;
            case "refresh-verify-info":
                this.triggerEvent("refreshVerifyInfo");
                break;
            case "info":
                this.triggerEvent("showInfo");
                break;
            case "custom-action":
                this.triggerEvent("customAction", $trigger.data("action-type"));
                break;
        }
    }
    
    onMessagePreviewAddContactClick(event: MouseEvent): void {
        event.stopPropagation();
        event.preventDefault();
        let $e = $(event.target).closest("[data-add-contact]");
        let type = $e.data("add-contact");
        let hashmail = $e.data("hashmail");
        let sid = $e.data("sid");
        this.triggerEvent("addContact", type, hashmail, sid);
    }
}
