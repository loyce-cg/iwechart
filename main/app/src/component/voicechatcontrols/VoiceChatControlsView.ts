import { ComponentView } from "../base/ComponentView";
import { func as mainTemplate } from "./template/main.html";
import { func as listeningUsersDropdownContentTemplate } from "./template/listening-users-dropdown-content.html";
import { func as avatarTemplate } from "./template/avatar.html";
import { Model, PersonModel } from "./VoiceChatControlsController";
import * as $ from "jquery";
import * as Q from "q";
import * as Types from "../../Types";
import { PersonsView } from "../persons/web";
import { VoiceChatUserNetworkInfo } from "../../app/common/voicechat/VoiceChatService";

export class VoiceChatControlsView extends ComponentView {
    
    static readonly MAX_VISIBLE_AVATARS_NORMAL: number = 8;
    static readonly MAX_VISIBLE_AVATARS_NARROW: number = 3;
    
    parent: Types.app.ViewParent;
    $container: JQuery;
    $main: JQuery;
    mainTemplate: Types.webUtils.MailTemplate<Model>;
    listeningUsersDropdownContentTemplate: Types.webUtils.MailTemplate<Model>;
    avatarTemplate: Types.webUtils.MailTemplate<PersonModel>;
    personsComponent: PersonsView;
    isInAppsWindow: boolean = false;
    _model: Model;
    _isNarrow: boolean = false;

    constructor(parent: Types.app.ViewParent) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.listeningUsersDropdownContentTemplate = this.templateManager.createTemplate(listeningUsersDropdownContentTemplate);
        this.avatarTemplate = this.templateManager.createTemplate(avatarTemplate);
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.mainTemplate.helper));
    }
    
    init(model: Model): Q.Promise<void> {
        this.$main = $("<div></div>");
        this.$main.on("click", "[data-action='leave-voice-chat']", this.onLeaveVoiceChatClick.bind(this));
        this.$main.on("click", "[data-action='ring-the-bell']", this.onRingTheBellClick.bind(this));
        this.$main.on("click", "[data-action='toggle-listening-users-dropdown']", this.onToggleListeningUsersDropdownClick.bind(this));
        this.$main.on("click", ".listening-users-dropdown-backdrop", this.onListeningUsersDropdownBackdropClick.bind(this));
        this.$main.on("click", "[data-action=toggle-talking]", this.onToggleTalkingClick.bind(this));
        this.$container.content(this.$main);
        this.isInAppsWindow = this.$container.closest(".window-apps-main").length > 0;
        $(window).on("resize", () => {
            this.updateNarrowState();
        });
        return Q().then(() => {
            this.personsComponent.$main = this.$main;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this._model = null;
            this.setModel(model);
        });
    }
    
    setModel(model: Model): void {
        let fullRender: boolean = false;
        if (!this._model) {
            fullRender = true;
        }
        else {
            let prevConvId = this._model.conversationModel ? this._model.conversationModel.id : null;
            let newConvId = model.conversationModel ? model.conversationModel.id : null;
            let prevSectionId = this._model.sectionModel ? this._model.sectionModel.id : null;
            let newSectionId = model.sectionModel ? model.sectionModel.id : null;
            if (model.isInVoiceChat != this._model.isInVoiceChat || prevConvId != newConvId || prevSectionId != newSectionId) {
                fullRender = true;
            }
        }
        this.$container.toggleClass("is-visible", model.isInVoiceChat);
        if (fullRender) {
            this._model = model;
            this.render(model);
        }
        else {
            this.$main.children(".component-voice-chat-controls").toggleClass("is-talking", model.isTalking).toggleClass("is-not-talking", !model.isTalking);
            
            let prevHashmails = this._model.listeningUsers.map(x => x.hashmail).sort((a, b) => a.localeCompare(b));
            let newHashmails = model.listeningUsers.map(x => x.hashmail).sort((a, b) => a.localeCompare(b));
            let prevNames = this._model.listeningUsers.map(x => x.name).sort((a, b) => a.localeCompare(b));
            let newNames = model.listeningUsers.map(x => x.name).sort((a, b) => a.localeCompare(b));
            this._model = model;
            if (JSON.stringify(prevHashmails) != JSON.stringify(newHashmails) || JSON.stringify(prevNames) != JSON.stringify(newNames)) {
                // Users list changed: render inc. avatars
                let $dd = this.$main.find(".listening-users-dropdown");
                if ($dd.is(".open")) {
                    let $cnt = $dd.find(".pf-content");
                    this.renderListeningUsersDropdown($cnt.length > 0 ? $cnt : $dd);
                }
                this.renderVisibleAvatarsList();
                this.refreshAvatars();
            }
            else {
                // Users list not changed, update only pings
                let $dd = this.$main.find(".listening-users-dropdown");
                let networkInfos: { [hashmail: string]: VoiceChatUserNetworkInfo } = {};
                model.listeningUsers.forEach(x => networkInfos[x.hashmail] = x.networkInfo);
                if ($dd.is(".open")) {
                    let $pings = $dd.find("[data-ping-for]");
                    $pings.each((_, el) => {
                        let $el = $(el);
                        let hashmail = $el.data("ping-for");
                        let networkInfo = networkInfos[hashmail];
                        if (networkInfo) {
                            $el.text(`${networkInfo.ping} ms`);
                            $el.prev().attr("data-network-info-num-bars", VoiceChatControlsView.getSignalQualityBarsCount(networkInfo));
                        }
                    });
                }
            }
        }
    }
    
    setModelStr(modelStr: string): void {
        this.setModel(JSON.parse(modelStr));
    }
    
    render(model: Model): void {
        this.$main.content(this.mainTemplate.renderToJQ(model));
        this.updateNarrowState();
        let $dd = this.$main.find(".listening-users-dropdown");
        if ($dd.is(".open")) {
            this.renderListeningUsersDropdown($dd);
        }
        this.renderVisibleAvatarsList();
        this.refreshAvatars();
    }
    
    renderListeningUsersDropdown($dd: JQuery): void {
        $dd.content(this.listeningUsersDropdownContentTemplate.renderToJQ(this._model));
        if ($dd.is(".open")) {
            $dd.pfScroll();
        }
    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    onLeaveVoiceChatClick(): void {
        this.triggerEvent("leaveVoiceChat");
    }
    
    onToggleTalkingClick(): void {
        this.triggerEvent("toggleTalking");
    }
    
    onRingTheBellClick(): void {
        let $btn = this.$main.find("button[data-action='ring-the-bell']");
        if ($btn.is(".ringing")) {
            return;
        }
        this.triggerEvent("ringTheBell");
        this.toggleRinging();
        setTimeout(() => {
            this.toggleRinging();
        }, 700);
    }
    
    onToggleListeningUsersDropdownClick(): void {
        this.toggleListeningUsersDropdown();
    }
    
    onListeningUsersDropdownBackdropClick(): void {
        this.toggleListeningUsersDropdown();
    }
    
    toggleListeningUsersDropdown(): void {
        let $dd = this.$main.find(".listening-users-dropdown");
        let $ddb = this.$main.find(".listening-users-dropdown-backdrop");
        let $btn = this.$main.find("[data-action='toggle-listening-users-dropdown']");
        let ddMaxHeight = parseInt($dd.css("max-height"));
        if ($dd.is(".open")) {
            $dd.removeClass("open");
            $btn.removeClass("open");
            $ddb.removeClass("visible");
            this.$container.removeClass("with-dropdown-open");
        }
        else {
            this.renderListeningUsersDropdown($dd);
            this.updateDropdownPosition();
            $dd.addClass("open");
            $btn.addClass("open");
            $ddb.addClass("visible");
            this.$container.addClass("with-dropdown-open");
            if ($dd.content().outerHeight(true) > ddMaxHeight) {
                let w = $dd.content().outerWidth(true) + 10;
                $dd.css("width", w + "px");
                $dd.css("height", ddMaxHeight + "px");
                $dd.children("div").pfScroll();
            }
        }
        this.refreshAvatars();
    }
    
    toggleRinging(): void {
        let $btn = this.$main.find("button[data-action='ring-the-bell']");
        $btn.toggleClass("ringing");
    }
    
    updateNarrowState(): void {
        if (this.isInAppsWindow) {
            return;
        }
        let $header = $("#header");
        let availWidth = $header.innerWidth();
        let wasNarrow = this.$main.children().hasClass("narrow");
        this.$main.children().removeClass("narrow");
        let takenWidth = 0;
        $header.children().each((_, el) => {
            let $el = $(el);
            takenWidth += $el.outerWidth(true);
        });
        if (wasNarrow) {
            takenWidth += Math.max(0, this.getVisisbleAvatarsWidth(VoiceChatControlsView.MAX_VISIBLE_AVATARS_NORMAL) - this.getVisisbleAvatarsWidth(VoiceChatControlsView.MAX_VISIBLE_AVATARS_NARROW));
        }
        if (takenWidth > availWidth) {
            this.$main.children().addClass("narrow");
            this._isNarrow = true;
        }
        else {
            this._isNarrow = false;
        }
        if (this._isNarrow != wasNarrow) {
            this.renderVisibleAvatarsList();
            this.refreshAvatars();
        }
        let $dd = this.$main.find(".listening-users-dropdown");
        if ($dd.is(".open")) {
            this.updateDropdownPosition();
        }
    }
    
    updateDropdownPosition(): void {
        let $dd = this.$main.find(".listening-users-dropdown");
        let rect = this.$container[0].getBoundingClientRect();
        $dd.css({
            left: rect.left,
            top: rect.top + rect.height,
        });
    }
    
    renderVisibleAvatarsList(): void {
        let maxCount = this._isNarrow ? VoiceChatControlsView.MAX_VISIBLE_AVATARS_NARROW : VoiceChatControlsView.MAX_VISIBLE_AVATARS_NORMAL;
        let count = Math.min(maxCount, this._model.listeningUsers.length);
        let hasMore = this._model.listeningUsers.length > count;
        if (hasMore) {
            count--;
        }
        let $avatars = $();
        for (let i = 0; i < count; ++i) {
            $avatars = $avatars.add(this.avatarTemplate.renderToJQ(this._model.listeningUsers[i]));
        }
        if (hasMore) {
            $avatars = $avatars.add($("<span class='has-more-avatars-info'>...</span>"));
        }
        let $list = this.$main.find(".visible-avatars-list");
        $list.content($avatars);
        let w: number = this.getVisisbleAvatarsWidth(maxCount);
        $list.parent().find(".wi-element-name, .avatars-names, .text-col").css("min-width", w);
    }
    
    getVisisbleAvatarsWidth(count: number): number {
        count = Math.min(count, this._model.listeningUsers.length);
        let hasMore = this._model.listeningUsers.length > count;
        if (hasMore) {
            count--;
        }
        return count * 16 + (hasMore ? 5 : 0);
    }
    
    static getSignalQualityBarsCount(networkInfo: VoiceChatUserNetworkInfo): number {
        if (networkInfo.ping < 100) {
            return 3;
        }
        if (networkInfo.ping < 200) {
            return 2;
        }
        return 1;
    }
    
}
