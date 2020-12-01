import {ComponentView} from "../base/ComponentView";
import {func as mainTemplate} from "./template/index.html";
import {func as notificationTemplate} from "./template/notification.html";
import {app} from "../../Types";
import {NotificationEntryOptions} from "./NotificationController"

export interface ViewModel {
    xs: boolean;
}

export class NotificationView extends ComponentView {
    
    $container: JQuery;
    $component: JQuery;
    options: ViewModel;
    
    constructor(parent: app.ViewParent, options?: ViewModel) {
        super(parent);
        this.options = options;
    }
    
    init(): void {
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ(this.options);
        this.$container.content(this.$component);
    }
    
    showNotification(id: number, label: string, options: NotificationEntryOptions): void {
        let $notification = this.templateManager.createTemplate(notificationTemplate).renderToJQ({id: id, label: label, options: options});
        if (!options || options.autoHide !== false) {
            setTimeout(() => {
                this.hideNotification(id);
            }, options && options.duration ? options.duration : 1000);
        }
        this.$component.removeClass("hide").find(".inner-2").append($notification);
        $notification.fadeIn();
    }
    
    progressNotification(id: number, progress: any): void {
        if (progress.percent > 0 && progress.percent < 100) {
            this.$component.find("[data-notification-id=" + id + "] .progress-info").removeClass("hide").text(progress.percent + "%");
        }
    }
    
    hideNotification(id: number): void {
        let $notification = this.$component.find("[data-notification-id=" + id + "]");
        if ($notification.length == 0) {
            this.clearNotifications();
        }
        $notification.fadeOut(() => {
            $notification.remove();
            this.clearNotifications();
        });
    }
    
    clearNotifications(): void {
        if (this.$component.find("[data-notification-id]").length == 0) {
            this.$component.find(".notifications-container").addClass("hide");
        }
    }
}
