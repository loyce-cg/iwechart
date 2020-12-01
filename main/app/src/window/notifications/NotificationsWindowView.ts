import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as sectionEntryTemplate} from "./template/sectionEntry.html";
import * as $ from "jquery";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import { TreeView } from "../../component/tree/TreeView";
import {Model, SectionEntry} from "./NotificationsWindowController";

@WindowView
export class NotificationsWindowView extends BaseWindowView<Model> {
    
    static GLOBAL_STATE_ID = "__global__";
    
    sectionsTree: TreeView<SectionEntry>;
    scrollTid: NodeJS.Timer;
    notificationsEnabled: boolean;
    changes: { [key: string]: boolean } = {};
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.sectionsTree = this.addComponent("sectionsTree", new TreeView(this, {
            mainTemplate: sectionEntryTemplate
        }));
    }
    
    initWindow(model: Model): Q.IWhenable<void> {
        this.notificationsEnabled = model.notificationsEnabled;
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-action=refresh]", this.onRefreshClick.bind(this));
        this.$main.on("click", "[data-action=toggle-global]", this.onNotificationsMainSwitchChange.bind(this));
        this.$main.on("click", "[data-action=change-muted]", this.onChangeMutedClick.bind(this));
        this.$main.on("click", "[data-action=change-muted-col]", this.onChangeMutedColClick.bind(this));
        this.$main.on("click", ".wi-element-icon", this.onChangeMutedRowClick.bind(this));
        this.$main.on("mouseenter", "[data-action=change-muted-col]", this.onHighlightCol.bind(this));
        this.$main.on("mouseenter", ".wi-element-icon", this.onHighlightRow.bind(this));
        this.$main.on("mouseleave", "[data-action=change-muted-col]", this.onRemoveColHighlight.bind(this));
        this.$main.on("mouseleave", ".wi-element-icon", this.onRemoveRowHighlight.bind(this));
        this.$main.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        
        this.sectionsTree.$container = this.$main.find(".sections-list");
        return this.sectionsTree.triggerInit().then(() => {
            this.$main.find(".sections-list").pfScroll();
            this.updateRowsAndCols();
        });
    }
    
    onSaveClick(): void {
        if (Object.getOwnPropertyNames(this.changes).length > 0) {
            this.triggerEvent("save", JSON.stringify(this.changes));
        }
        else {
            this.triggerEvent("close");
        }
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onRefreshClick(): void {
        this.triggerEvent("refresh");
    }
    
    onNotificationsMainSwitchChange(): void {
        let newState = !this.$body.find(".switch[data-action=toggle-global]").hasClass("active");
        this.setNotificationsEnabled(newState);
        this.addOrRemoveChange(NotificationsWindowView.GLOBAL_STATE_ID, newState);
        this.$body.find(".switch[data-action=toggle-global]").toggleClass("active", newState);
    }
    
    setNotificationsEnabled(enabled: boolean) {
        let $switch = this.$body.find(".switch[data-action=toggle-global]");
        if ($switch.is(".active") != enabled) {
            $switch.toggleClass("active", enabled);
        }
        this.$main.find(".sections-list").toggleClass("disabled", !enabled);
        this.$main.find(".wi-element-parent.header").toggleClass("disabled", !enabled);
    }
    
    onChangeMutedClick(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget);
        let sectionId = $el.data("section-id");
        let moduleName = $el.data("module");
        let newIsMuted = !$el.hasClass("dimmed");
        this.addOrRemoveChange(sectionId + "/" + moduleName, newIsMuted);
        $el.toggleClass("dimmed", newIsMuted);
        this.updateRowsAndCols();
    }
    
    onChangeMutedRowClick(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget);
        let sectionId = $el.data("section-id");
        let availableModules: [string, boolean][] = [];
        let $moduleIcons = $el.closest(".wi-element-inner").find(".module-icon:not(.disabled)");
        $moduleIcons.each((idx, el) => {
            availableModules.push([$(el).data("module"), $(el).hasClass("dimmed")]);
        });
        let newIsMuted = !$el.closest(".section-entry").hasClass("dimmed");
        for (let [moduleName, isMuted] of availableModules) {
            if (newIsMuted != isMuted) {
                this.addOrRemoveChange(sectionId + "/" + moduleName, newIsMuted);
            }
            $moduleIcons.toggleClass("dimmed", newIsMuted);
        }
        this.updateRowsAndCols();
    }
    
    onChangeMutedColClick(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget);
        let moduleName = $el.data("module");
        let newIsMuted = !$el.hasClass("dimmed");
        let $rows = this.$main.find(".section-entry .module-icon[data-module='" + moduleName + "']");
        $rows.each((idx, el) => {
            let $el = $(el);
            let sectionId = $el.data("section-id");
            let isMuted = $el.hasClass("dimmed");
            if (newIsMuted != isMuted && sectionId) {
                this.addOrRemoveChange(sectionId + "/" + moduleName, newIsMuted);
            }
            $el.toggleClass("dimmed", newIsMuted);
        });
        this.updateRowsAndCols();
    }
    
    addOrRemoveChange(id: string, value: boolean) {
        if (id in this.changes) {
            delete this.changes[id];
        }
        else {
            this.changes[id] = value;
        }
    }
    
    updateRowsAndCols(): void {
        this.$main.find(".sections-list").find(".section-entry").each((idx, el) => {
            let $entry = $(el);
            let hasEnabled = $entry.children(".section-name").find(".module-icon:not(.disabled):not(.dimmed)").length > 0;
            $entry.toggleClass("dimmed", !hasEnabled);
        });
        this.$main.find(".section-entry.header .module-icon").each((idx, el) => {
            let $col = $(el);
            let moduleName = $col.data("module");
            let hasEnabled = this.$main.find(".sections-list").find(".module-icon[data-module='" + moduleName + "']:not(.disabled):not(.dimmed)").length > 0;
            $col.toggleClass("dimmed", !hasEnabled);
        });
    }
    
    onHighlightRow(e: MouseEvent): void {
        $(e.currentTarget).closest(".section-name").find(".module-icon").addClass("highlighted");
    }
    
    onRemoveRowHighlight(e: MouseEvent): void {
        $(e.currentTarget).closest(".section-name").find(".module-icon").removeClass("highlighted");
    }
    
    onHighlightCol(e: MouseEvent): void {
        let moduleName = $(e.currentTarget).data("module");
        this.$main.find(".sections-list").find(".module-icon[data-module='" + moduleName + "']").addClass("highlighted");
    }
    
    onRemoveColHighlight(e: MouseEvent): void {
        let moduleName = $(e.currentTarget).data("module");
        this.$main.find(".sections-list").find(".module-icon[data-module='" + moduleName + "']").removeClass("highlighted");
    }
    
}
