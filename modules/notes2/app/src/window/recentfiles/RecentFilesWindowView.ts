import {component, JQuery as $, webUtils, window, Types, Q} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {func as fileItemTemplate} from "./template/fileItem.html";
import {func as emptyTemplate} from "./template/empty.html";

import {EntryViewModel} from "./RecentFilesWindowController";

export class RecentFilesWindowView extends window.base.BaseWindowView<void> {
    
    static DOUBLE_CLICK_TIME = 400;
    
    personsComponent: component.persons.PersonsView;
    recentList: component.extlist.ExtListView<EntryViewModel>;
    notifications: component.notification.NotificationView;
    lastClickTid: NodeJS.Timer;
    lastClickId: string;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));
        this.recentList = this.addComponent("recentList", new component.extlist.ExtListView(this, {
            template: fileItemTemplate,
            emptyTemplate: emptyTemplate,
            extra: <any>this.templateManager.createTemplate(component.template.conversation)
        }));
        this.recentList.addEventListener("ext-list-change", this.onAfterVersionListRender.bind(this));
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
    }
    
    initWindow(): Q.Promise<void> {
        return Q().then(() => {
            this.turnTimeAgoRefresher();
            this.$main.on("click", "[data-file-id]", this.onFileClick.bind(this));
            this.$main.on("click", "[data-action='open']", this.onOpenClick.bind(this));
            this.$main.on("click", "[data-action='close']", this.onCloseClick.bind(this));
            this.$main.on("click", "[data-action='clear-list']", this.onClearListClick.bind(this));
            this.$main.on("click", "[data-action='refresh']", this.onRefreshClick.bind(this));
            $(document).on("keydown", this.onKeyDown.bind(this));
            this.personsComponent.$main = this.$main;
            this.recentList.$container = this.$main.find("tbody");
            
            return Q.all([
                this.personsComponent.triggerInit(),
                this.recentList.triggerInit()
            ]);
        })
        .then(() => {
            this.notifications.$container = this.$main.find(".notifications-container");
            return this.notifications.triggerInit();
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
            this.triggerEvent("openSelected");
        }
        else if (e.keyCode === webUtils.KEY_CODES.escape) {
            e.preventDefault();
            this.triggerEvent("close");
        }
    }
    
    onFileClick(e: MouseEvent): void {
        let id = $(e.target).closest("[data-file-id]").data("file-id");
        let did = $(e.target).closest("[data-file-did]").data("file-did");
        this.triggerEvent("setActive", id, did);
        if (this.lastClickTid && this.lastClickId == id) {
            clearTimeout(this.lastClickTid);
            this.lastClickTid = null;
            this.lastClickId = null;
            this.triggerEvent("openSelected");
        }
        else {
            this.lastClickId = id;
            this.lastClickTid = setTimeout(() => {
                this.lastClickTid = null;
                this.lastClickId = null;
                //Single click - do nothing, active already selected
            }, RecentFilesWindowView.DOUBLE_CLICK_TIME);
        }
    }
    
    onOpenClick(): void {
        this.triggerEvent("openSelected");
    }
    
    onCloseClick() {
        this.triggerEvent("close");
    }
    
    onClearListClick(): void {
        this.triggerEvent("clearList");
    }
    
    onRefreshClick(): void {
        this.triggerEvent("refresh");
    }
    
    onAfterVersionListRender() {
        this.recentList.$container.find(".image canvas:not(.resized)").each((_i, e) => {
            $(e).addClass("resized").attr("data-width", "16").attr("data-height", "16").attr("width", "16").attr("height", "16");
        });
        this.recentList.$container.find(".avatar-2 canvas:not(.resized)").each((_i, e) => {
            $(e).addClass("resized").attr("data-width", "8").attr("data-height", "8").attr("width", "8").attr("height", "8");
        });
        this.personsComponent.refreshAvatars();
        this.scrollTo(this.$main.find(".active"));
        
        let isEmpty = this.recentList.$container.children(".empty").length == 1;
        this.$main.find("button[data-action=open]").prop("disabled", isEmpty);
        this.$main.find(".button-clear-list").toggleClass("disabled", isEmpty);
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
    
    recentFilesListLoaded(): void {
        this.$main.addClass("recent-files-list-loaded");
    }
    
    recentFilesListLoading(): void {
        this.$main.removeClass("recent-files-list-loaded");
    }
    
    setRefreshing(refreshing: boolean): void {
        this.$main.toggleClass("refreshing", refreshing);
        this.$main.find(".loading-container .fa").toggleClass("fa-spin", refreshing);
    }
    
}
