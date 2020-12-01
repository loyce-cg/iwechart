import {component, JQuery as $, window, Types, Q, webUtils} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {func as versionTemplate} from "./template/version.html";
import {Model, DescriptorVersion} from "./HistoryWindowController";

export class HistoryWindowView extends window.base.BaseWindowView<Model> {
    
    static DOUBLE_CLICK_TIME = 400;
    
    versions: component.extlist.ExtListView<DescriptorVersion>;
    personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    notifications: component.notification.NotificationView;
    lastClickTid: NodeJS.Timer;
    lastClickId: string;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));
        this.personTooltip = new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        
        this.versions = this.addComponent("versions", new component.extlist.ExtListView(this, {
            template: versionTemplate
        }));
        this.versions.addEventListener("ext-list-change", this.onAfterVersionListRender.bind(this));
        
    }
    
    initWindow(_model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.turnTimeAgoRefresher();
            this.$main.on("click", "[data-signature]", this.onVersionClick.bind(this));
            this.$main.on("click", "[data-action='open']", this.onOpenClick.bind(this));
            this.$main.on("click", "[data-action='copy']", this.onCopyClick.bind(this));
            this.$main.on("click", "[data-action='close']", this.onCloseClick.bind(this));
            $(document).on("keydown", this.onKeyDown.bind(this));
            this.personsComponent.$main = this.$main;
            this.personTooltip.init(this.$main);
            this.versions.$container = this.$main.find(".versions");
            this.notifications.$container = this.$main.find(".notifications");
            
            return Q.all([
                this.personsComponent.triggerInit(),
                this.versions.triggerInit(),
                this.notifications.triggerInit()
            ]);
        })
        .then(() => {
            this.personsComponent.refreshAvatars();
            this.$main.focus();
        });
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.keyCode === webUtils.KEY_CODES.upArrow) {
            e.preventDefault();
            this.triggerEvent("selectUp");
        }
        else if (e.keyCode === webUtils.KEY_CODES.downArrow) {
            e.preventDefault();
            this.triggerEvent("selectDown");
        }
        else if (e.keyCode === webUtils.KEY_CODES.enter) {
            e.preventDefault();
            this.triggerEvent("openSelectedVersion");
        }
        else if (e.keyCode == webUtils.KEY_CODES.c && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.triggerEvent("copySelectedVersion");
        }
        else if (e.keyCode === webUtils.KEY_CODES.escape) {
            e.preventDefault();
            this.triggerEvent("close");
        }
    }
    
    onVersionClick(e: MouseEvent): void {
        let id = $(e.target).closest("[data-signature]").data("signature");
        this.triggerEvent("setActive", id);
        if (this.lastClickTid && this.lastClickId == id) {
            clearTimeout(this.lastClickTid);
            this.lastClickTid = null;
            this.lastClickId = null;
            this.triggerEvent("openSelectedVersion");
        }
        else {
            this.lastClickId = id;
            this.lastClickTid = setTimeout(() => {
                this.lastClickTid = null;
                this.lastClickId = null;
                //Single click - do nothing, active already selected
            }, HistoryWindowView.DOUBLE_CLICK_TIME);
        }
    }
    
    onOpenClick(): void {
        this.triggerEvent("openSelectedVersion");
    }
    
    onCopyClick(): void {
        this.triggerEvent("copySelectedVersion");
    }
    
    onCloseClick() {
        this.triggerEvent("close");
    }
    
    onAfterVersionListRender() {
        this.personsComponent.refreshAvatars();
        this.scrollTo(this.$main.find(".active"));
    }
    
    scrollTo($ele: JQuery): void {
        if ($ele.length == 0) {
            return;
        }
        let ch = this.$main.find(".table-container")[0];
        let eBB = $ele[0].getBoundingClientRect();
        let lBB = ch.getBoundingClientRect();
        if (eBB.bottom > lBB.bottom) {
            ch.scrollTo(0, ch.scrollTop + (eBB.bottom - lBB.bottom));
        }
        if (eBB.top < lBB.top) {
            ch.scrollTo(0, ch.scrollTop - (lBB.top - eBB.top));
        }
    }
}
