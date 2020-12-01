import * as web from "pmc-web";
import { func as mainTemplate }  from "./template/main.html";
import { Model } from "./DetachTaskGroupWindowController";
import $ = web.JQuery;
import Q = web.Q;

export class DetachTaskGroupWindowView extends web.window.base.BaseWindowView<Model> {
    
    notifications: web.component.notification.NotificationView;
    
    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.notifications = this.addComponent("notifications", new web.component.notification.NotificationView(this, {xs: true}));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.setModel(model);
        
        this.$main.on("click", "[data-action=yes]", this.onDetachClick.bind(this));
        this.$main.on("click", "[data-action=no]", this.onCancelClick.bind(this));
        
        return Q().then(() => {
            this.notifications.$container = this.$main.find(".notifications-container-wrapper");
            return this.notifications.triggerInit();
        });
    }
    
    setModel(model: Model): void {
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", (<HTMLAnchorElement>event.currentTarget).href);
    }
    
    onCloseClick(): void {
        this.toggleButtonsEnabled(false);
        this.triggerEvent("close");
    }
    
    onDetachClick(): void {
        this.toggleButtonsEnabled(false);
        this.triggerEvent("detach");
    }
    
    onCancelClick(): void {
        this.toggleButtonsEnabled(false);
        this.triggerEvent("cancel");
    }
    
    toggleButtonsEnabled(enabled: boolean): void {
        this.$main.find("[data-action=yes]").prop("disabled", !enabled);
        this.$main.find("[data-action=no]").prop("disabled", !enabled);
    }

}