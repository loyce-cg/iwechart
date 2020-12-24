import * as web from "pmc-web";
import { func as mainTemplate }  from "./template/main.html";
import { func as iconTemplate }  from "./template/icon.html";
import { Model } from "./TaskGroupFormWindowController";
import $ = web.JQuery;
import MailClientViewHelper = web.webUtils.MailClientViewHelper;
import Template = web.webUtils.template.Template;
import Q = web.Q;

interface InitialData {
    name: string;
    icon: string;
}

export class TaskGroupFormWindowView extends web.window.base.BaseWindowView<Model> {
    
    $name: JQuery;
    $changeIconLink: JQuery;
    notifications: web.component.notification.NotificationView;
    dirty: boolean = false;
    initialData: InitialData;
    onDocumentClickBound: any;
    iconTemplate: Template<string, void, MailClientViewHelper>;
    renderedIcon: string;
    
    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.notifications = this.addComponent("notifications", new web.component.notification.NotificationView(this, {xs: true}));
    }
    
    initWindow(model: Model): any {
        this.iconTemplate = this.templateManager.createTemplate(iconTemplate);
        
        this.initialData = {
            name: model.name,
            icon: model.icon,
        };
        this.renderedIcon = model.icon;
        
        this.$main.on("click", "a", this.onLinkClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", ".ok", this.onOkClick.bind(this));
        this.$main.on("click", ".cancel", this.onCancelClick.bind(this));
        this.$main.on("input", "input[type=text]", this.onInput.bind(this));
        this.$main.on("blur", "input[type=text]", this.onBlur.bind(this));
        this.$main.on("click", ".btn-delete", this.onDeleteClick.bind(this));
        this.$main.on("click", ".btn-detach", this.onDetachClick.bind(this));
        this.$main.on("click", "[data-action=change-icon]", this.onChangeIconClick.bind(this));
        $(document).on("keyup", this.onKeyUp.bind(this));
        
        this.$name = this.$main.find("#taskgroup-name");
        this.$name.val(model.name);
        
        this.$changeIconLink = this.$main.find("[data-action=change-icon]");
        
        this.$name.select();
        this.$name.focus();
        
        if (!model.id || true) {
            let $dd = this.$main.find(".due-date-field");
            $dd.css("display", "none");
        }
        
        this.notifications.$container = this.$main.find(".notifications-container-wrapper");
        
        this.updateDirty();
        
        return Q.all([
            this.notifications.triggerInit(),
        ]);
    }
    
    setProjectName(name: string) {
        this.$main.find(".project-name").text(name);
    }
    
    onDeleteClick(): void {
        this.triggerEvent("deleteTaskGroup");
    }
    
    ok(): void {
        let name = this.validateInput(this.$name);
        if (name !== false) {
            let res = {
                name: name,
            };
            this.triggerEvent("ok", JSON.stringify(res));
        }
    }
    
    cancel(): void {
        this.triggerEvent("close");
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", (<HTMLAnchorElement>event.currentTarget).href);
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onOkClick(): void {
        this.ok();
    }
        
    onCancelClick(): void {
        this.cancel();
    }
    
    onInput(e: any): void {
        let $input = $(e.currentTarget);
        this.validateInput($input);
        this.updateDirty();
    }
    
    onBlur(e: any): void {
        let $input = $(e.currentTarget);
        this.validateInput($input);
    }
    
    validateInput($input: JQuery): string|boolean {
        let val = (<string>$input.val()).trim();
        if (val.length == 0 && $input.data("v-not-empty")) {
            //$input.addClass("error");
            return false;
        }
        else {
            //$input.removeClass("error");
            return val;
        }
    }
    
    onKeyUp(e: KeyboardEvent): void {
        if (e.key == "Enter") {
            if (!$(e.target).is("textarea")) {
                this.ok();
            }
        }
        else if (e.key == "Escape") {
            this.cancel();
        }
    }
    
    onDetachClick(): void {
        this.triggerEvent("detach");
    }
    
    onChangeIconClick(): void {
        this.triggerEvent("changeIcon");
    }
    
    onAfterDetached(): void {
        this.$main.find("[data-action=detach]").prop("disabled", true);
    }
    
    updateDirty(): void {
        let prevDirty = this.dirty;
        this.dirty = false;
        if (this.$name.val() != this.initialData.name) {
            this.dirty = true;
        }
        if (this.renderedIcon != this.initialData.icon) {
            this.dirty = true;
        }
        if (this.dirty != prevDirty) {
            this.triggerEvent("dirtyChanged", this.dirty);
        }
    }
    
    renderIcon(icon: string): void {
        let $icon = this.iconTemplate.renderToJQ(icon);
        this.$main.find(".flex-row.icon").children(".taskgroup-icon").replaceWith($icon);
        this.renderedIcon = icon;
        this.updateDirty();
    }
    
    onAfterCloseList(): void {
        this.$main.find(".btn-detach").remove();
    }
    
}