import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./NotificationsController";
import * as $ from "jquery";

export class NotificationsView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "notifications",
            priority: 305,
            groupId: "account",
            icon: "bell-o",
            labelKey: "window.settings.menu.item.notifications.label",
        };
    }
    
    initTab() {
        this.$main.on("input", "[name='notifications.email']", this.onNotificationsEmailInput.bind(this));
        this.$main.on("click", "[data-trigger=open-sections]", this.onOpenSectionsClick.bind(this));
        this.$main.on("click", "[data-play]", this.onPlayClick.bind(this));
        this.$main.on("change", "[data-sound-category]", this.onSoundCategoryChange.bind(this));
        this.$main.on("click", ".audio-notifications-checkbox", this.onCheckboxClick.bind(this));
        this.update();
    }
    
    onPlayClick(e: MouseEvent): void {
        let soundsCategory = $(e.currentTarget).data("play");
        let sound = this.$main.find(`[data-sound-category='${soundsCategory}']`).val();
        if (sound) {
            this.triggerEvent("play", sound);
        }
    }
    
    onSoundCategoryChange(e: MouseEvent): void {
        let sound = $(e.currentTarget).val();
        if (sound) {
            this.triggerEvent("play", sound);
        }
    }
    
    onCheckboxClick(e: MouseEvent): void {
        let $switch = $(e.currentTarget);
        if ($switch.hasClass("disabled")) {
            return;
        }
        $switch.toggleClass("active");
        this.update();
    }
    
    update(): void {
        // let notifications = this.$main.find("[data-setting=notifications]").hasClass("active");
        // let audioNotifications = this.$main.find("[data-setting=audioNotifications]").hasClass("active");
        // this.$main.find("[data-setting=audioNotifications]").toggleClass("disabled", !notifications);
        // this.$main.find("[data-sound-category=notification]").prop("disabled", !notifications || !audioNotifications);
        let audioNotifications = this.$main.find("[data-setting='ui.audio']").is(":checked");
        this.$main.find("[data-sound-category=notification]").prop("disabled", !audioNotifications);
    }
    
    onNotificationsEmailInput(): void {
        let $input = this.$main.find("[name='notifications.email']");
        $input.removeClass("invalid");
        $input.next(".error").hide();
    }
    
    onOpenSectionsClick(): void {
        this.triggerEvent("openSections");
    }
    
}
