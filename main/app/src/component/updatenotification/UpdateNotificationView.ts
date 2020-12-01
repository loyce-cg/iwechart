import {ComponentView} from "../base/ComponentView";
import {func as mainTemplate} from "./template/index.html";
import {func as notificationTemplate} from "./template/updatenotification.html";
import {app} from "../../Types";
import * as $ from "jquery";
import {UpdateNotificationViewOptions} from "./UpdateNotificationController"
import { BaseWindowView } from "../../window/base/web";


export class UpdateNotificationView extends ComponentView {
    
    $container: JQuery;
    $component: JQuery;
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this.ipcMode = true;
    }
    
    init(): void {
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ();
        this.$container.content(this.$component);
        this.$container.on("click", "[data-action-id]", this.onActionClick.bind(this));
    }
    
    onActionClick(e: MouseEvent): void {
        let action = $(e.currentTarget).closest("[data-action-id]").data("action-id");
        let id = $(e.currentTarget).closest("[data-update-notification-id]").data("update-notification-id");

        this.setUpdateStatus(id, "checking");
        this.triggerEvent("action", id, action);
    }
    
    
    createNotification(id: number, options: UpdateNotificationViewOptions): void {
        let $notification = this.templateManager.createTemplate(notificationTemplate).renderToJQ({id: id, options: options});
        if (!options || options.autoHide !== false) {
            setTimeout(() => {
                this.hideNotification(id);
            }, 3000);
        }
        let status = options.updateReadyToInstall ? "readyToInstall" : (options.updateAvail ? "available": "idle");

        this.$component.removeClass("hide").empty().append($notification);
        this.setUpdateStatus(id, status);
        
        if (options.forceUpdate) {
            this.$component.find(".hide-button").hide();
        }
        let notifWidth = this.measureHiddenElement($notification);
        $notification.css("right", "calc(50% - calc("+ notifWidth +"px / 2))");
        $notification.fadeIn();
    }
    
    
    hideNotification(id: number): void {
        let $notification = this.$component.find("[data-update-notification-id=" + id + "]");
        $notification.fadeOut();
    }

    showNotification(id: number): void {
        let $notification = this.$component.find("[data-update-notification-id=" + id + "]");
        
        let notifWidth = this.measureHiddenElement($notification);
        $notification.css("right", "calc(50% - calc("+ notifWidth +"px / 2))");
        $notification.fadeIn();
    }

    measureHiddenElement($element: JQuery<HTMLElement>) {
        $element.css("visibility", "hidden");
        $element.css("display", "block");
        let w = this.getElementWidth($element[0]);
        $element.css("display", "none");
        $element.css("visibility", "visible");
        return w;
    }

    getElementWidth(element: HTMLElement): number {
        let style = window.getComputedStyle(element);
        let totalWidth = 0;
        totalWidth += element.offsetWidth, // or use style.width
        totalWidth += parseFloat(style.marginLeft) + parseFloat(style.marginRight),
        totalWidth += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
        totalWidth += parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        return totalWidth;
    }
    
    removeNotification(id: number): void {
        let $notification = this.$component.find("[data-update-notification-id=" + id + "]");
        if ($notification.length == 0) {
            this.clearNotifications();
        }
        $notification.fadeOut(() => {
            $notification.remove();
            this.clearNotifications();
        });
        
    }
    
    clearNotifications(): void {
        if (this.$component.find("[data-update-notification-id]").length == 0) {
            this.$component.find(".notifications-container").addClass("hide");
        }
    }
    
    setUpdateStatus(id: number, status: string): void {
        let $notification = this.$component.find("[data-update-notification-id=" + id + "]");
        if ($notification.length > 0) {
            let $updates = $notification.find(".updates");
            let $updatesInProgress = $notification.find('.updates-in-progress');
            
            $updates.toggleClass("hide", !(status == "available" || status == "readyToInstall"));
            $updatesInProgress.toggleClass("hide", status == "available" || status == "readyToInstall");

            $updates.children("span").toggleClass("hide", true);
            $updatesInProgress.children("span").toggleClass("hide", true);
            $updates.find("." + status).toggleClass("hide", false);
            $updatesInProgress.find("." + status).toggleClass("hide", false);
        }
    }
    
    setProgress(id: number, progress: number): void {
        let $notification = this.$component.find("[data-update-notification-id=" + id + "]");
        if ($notification.length > 0) {
            $notification.find(".download-progress").text(progress + "%");
        }
    }
    
}
