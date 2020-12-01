import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model, PartialResult} from "./AudioConfigController";
import * as $ from "jquery";

export class AudioConfigView extends BaseView<Model> {
    
    model: Model = null;
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "audioconfig",
            priority: 310,
            groupId: "account",
            icon: "volume-up",
            labelKey: "window.settings.menu.item.audioconfig.label"
        };
    }
    
    renderContent(model: Model): void {
        super.renderContent(model);
        this.model = model;
        this.update();
    }
    
    initTab() {
        this.$main.on("click", "[data-play]", this.onPlayClick.bind(this));
        this.$main.on("change", "[data-sound-category]", this.onSoundCategoryChange.bind(this));
        this.$main.on("click", ".switch", this.onSwitchClick.bind(this));
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
    
    onSwitchClick(e: MouseEvent): void {
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
        let audioNotifications = this.$main.find("[data-setting=audioNotifications]").hasClass("active");
        this.$main.find("[data-sound-category=notification]").prop("disabled", !audioNotifications);
    }
    
    isDirty(): boolean {
        // if (this.$main.find("[data-setting=notifications]").hasClass("active") != this.model.notifications) {
        //     return true;
        // }
        if (this.$main.find("[data-setting=audioNotifications]").hasClass("active") != this.model.audioNotifications) {
            return true;
        }
        return false;
    }
    
    onSaveButtonClick(): void {
        let result: PartialResult = {
            // notifications: this.$main.find("[data-setting=notifications]").hasClass("active"),
            audioNotifications: this.$main.find("[data-setting=audioNotifications]").hasClass("active"),
        };
        this.triggerEvent("savePartialResult", JSON.stringify(result));
        super.onSaveButtonClick();
        this.update();
    }
    
}
