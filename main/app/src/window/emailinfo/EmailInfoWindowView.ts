import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as contentTemplate} from "./template/content.html";
import * as $ from "jquery";
import {EmailInfoModel} from "./EmailInfoWindowController";
import {app} from "../../Types";

@WindowView
export class EmailInfoWindowView extends BaseWindowView<EmailInfoModel> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: EmailInfoModel): void {
        this.$main.on("click", "[data-trigger]", this.onDataTriggerClick.bind(this));
        this.$main.on("click", "[data-action='edit-user']", this.onEditUserClick.bind(this));
        this.$main.on("click", "[data-action='block-user']", this.onBlockUserClick.bind(this));
        this.$main.on("click", "[data-action='unblock-user']", this.onUnblockUserClick.bind(this));
        this.focus();
    }
    
    startProcessing(type: string) {
        let $i = this.$main.find("[data-action='" + type + "'] i");
        $i.data("orgClass", $i.attr("class"));
        $i.attr("class", "fa fa-spin fa-circle-o-notch");
    }
    
    stopProcessing(type: string) {
        let $i = this.$main.find("[data-action='" + type + "'] i");
        $i.attr("class", $i.data("orgClass"));
    }
    
    focus(): void {
        this.$main.find("[data-input]").focus().select();
    }
    
    onBlockUserClick(): void {
        this.triggerEvent("blockUser");
    }
    
    onUnblockUserClick(): void {
        this.triggerEvent("unblockUser");
    }
    
    onDataTriggerClick(event: MouseEvent): void {
        let action = $(event.target).closest("[data-trigger]").data("trigger");
        if (action == "ok") {
            this.triggerEvent("action", "ok");
        }
        else if (action == "show-password") {
            this.$main.find(".fake-password").addClass("hide");
            this.$main.find(".real-password").removeClass("hide");
            this.$main.find("[data-trigger='show-password']").addClass("hide");
            this.$main.find("[data-trigger='hide-password']").removeClass("hide");
        }
        else if (action == "hide-password") {
            this.$main.find(".fake-password").removeClass("hide");
            this.$main.find(".real-password").addClass("hide");
            this.$main.find("[data-trigger='show-password']").removeClass("hide");
            this.$main.find("[data-trigger='hide-password']").addClass("hide");
        }
    }
    
    onBodyKeydown(event: KeyboardEvent): void {
        if (event.keyCode == 27) {
            event.preventDefault();
            this.triggerEvent("action", "escape");
        }
    }
    
    onEditUserClick() {
        this.triggerEvent("editUser");
    }
    
    refresh(model: EmailInfoModel): void {
        this.$main.html("");
        this.$main.append(this.templateManager.createTemplate(contentTemplate).renderToJQ(model));
    }
}
