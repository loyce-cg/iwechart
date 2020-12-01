import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as sectionEntryTemplate} from "./template/sectionEntry.html";
import * as $ from "jquery";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import { TreeView } from "../../component/tree/TreeView";
import {Model, State, SectionEntry} from "./SectionsWindowController";

@WindowView
export class SectionsWindowView extends BaseWindowView<Model> {
    
    sectionsTree: TreeView<SectionEntry>;
    scrollTid: NodeJS.Timer;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.sectionsTree = this.addComponent("sectionsTree", new TreeView(this, {
            mainTemplate: sectionEntryTemplate
        }));
        this.sectionsTree.addEventListener("change", this.onTreeChange.bind(this));
    }
    
    initWindow(): Q.IWhenable<void> {
        this.$main.on("click", "[data-action=edit]", this.onEditClick.bind(this));
        this.$main.on("click", "[data-action=add]", this.onAddClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-action=refresh]", this.onRefreshClick.bind(this));
        this.$main.on("click", "[data-tree-id]", this.onSectionClick.bind(this));
        this.bindKeyPresses();
        
        this.sectionsTree.$container = this.$main.find(".sections-list");
        
        this.sectionsTree.$container.on("scroll", this.onSectionsTreeScroll.bind(this));
        return this.sectionsTree.triggerInit();
    }
    
    openIframe(id: number, load: app.WindowLoadOptions): void {
        let iframe = this.viewManager.parent.registerDockedWindow(id, load, this.$main.find(".edit-container")[0]);
        iframe.setAttribute("id", "iframe-" + id);
    }
    
    setButtonsState(state: State): void {
        this.$main.find("[data-action=add]").prop("disabled", state.sectionsLimitReached);
        this.$main.find("[data-action=add]").css("visibility", state.canAdd ? "visible": "hidden");
    }
    
    onEditClick(): void {
        this.triggerEvent("editSelected");
    }
    
    onAddClick(): void {
        this.triggerEvent("addSection");
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onRefreshClick(): void {
        this.triggerEvent("refresh");
    }
    
    bindKeyPresses(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == KEY_CODES.enter) {
                e.preventDefault();
                this.onEditClick();
            }
            else if (e.keyCode == KEY_CODES.escape) {
                e.preventDefault();
                this.onCloseClick();
            }
            else if (e.keyCode === KEY_CODES.upArrow) {
                e.preventDefault();
                this.selectUp();
            }
            else if (e.keyCode === KEY_CODES.downArrow) {
                e.preventDefault();
                this.selectDown();
            }
        });
    }
    
    onSectionClick(e: MouseEvent): boolean {
        let id = $(e.target).closest("[data-tree-id]").data("tree-id");
        this.triggerEvent("setActive", id);
        return false;
    }
    
    onTreeChange() {
        clearTimeout(this.scrollTid);
        this.scrollTid = setTimeout(() => {
            this.scrollViewIfNeeded();
            this.scrollTid = null
        }, 1);
    }
    
    scrollViewIfNeeded() {
        let $parent = this.$main.find(".sections-list");
        let parent = $parent[0];
        if (! parent) {
          return;
        }
        let $list = $parent.find(".section-name");
        let $active = $parent.find(".active > .section-name");
        if ($active.length == 0) {
            return;
        }
        if ($parent.length == 0 || $list.length == 0) {
            return;
        }
        let parentBB = parent.getBoundingClientRect();
        let active = $active.get(0);
        let eleBB = active.getBoundingClientRect();
        
        if (eleBB.top < parentBB.top) {
            parent.scrollTop += eleBB.top - parentBB.top;
        }
        else if (eleBB.bottom > parentBB.bottom) {
            parent.scrollTop += eleBB.bottom - parentBB.bottom;
        }
    }
    
    selectUp() {
        let $active = this.sectionsTree.$container.find(".active");
        if ($active.length == 0) {
            return;
        }
        let $prev = $active.prev();
        if ($prev.length > 0) {
            let $child = $prev.find("[data-tree-id]").last();
            this.triggerEvent("setActive", $child.length > 0 ? $child.data("tree-id") : $prev.data("tree-id"));
        }
        else {
            let $parent = $active.parent().closest("[data-tree-id]");
            if ($parent.length > 0) {
                this.triggerEvent("setActive", $parent.data("tree-id"));
            }
        }
    }
    
    selectDown() {
        let $active = this.sectionsTree.$container.find(".active");
        this.selectDownCore($active, true);
    }
    
    selectDownCore($ele: JQuery, checkChildren: boolean) {
        if ($ele.length == 0) {
            return;
        }
        if (checkChildren) {
            let $child = $ele.find("[data-tree-id]").first();
            if ($child.length > 0) {
                this.triggerEvent("setActive", $child.data("tree-id"));
                return;
            }
        }
        let $next = $ele.next();
        if ($next.length > 0) {
            this.triggerEvent("setActive", $next.data("tree-id"));
        }
        else {
            let $parent = $ele.parent().closest("[data-tree-id]");
            if ($parent.length > 0) {
                this.selectDownCore($parent, false);
            }
        }
    }
    
    setSectionsChangeLock(lock: boolean): void {
        this.$main.find("[data-action=add]").prop("disabled", lock);
        this.$main.find(".sections-list-lock-overlay").css("display", lock ? "block" : "none");
    }
    
    centerSelectedSection(): void {
        let $container = this.sectionsTree.$container;
        let $selectedSection = $container.find(".active");
        if ($container.length == 0) {
            return;
        }
        let containerMaxScrollTop = $container[0].scrollHeight - $container[0].clientHeight;
        let selectedSectionCenter = Math.round($selectedSection[0].children[0].scrollHeight / 2) + $selectedSection[0].offsetTop;
        let containerNewScrollTop = selectedSectionCenter - Math.round($container[0].clientHeight / 2);
        let missingScrollTop = containerNewScrollTop - containerMaxScrollTop;
        if (missingScrollTop > 0) {
            $container.css("padding-bottom", missingScrollTop + "px");
        }
        else if (containerNewScrollTop < 0) {
            $container.css("padding-top", (-containerNewScrollTop) + "px");
        }
        $container.scrollTop(containerNewScrollTop);
    }
    
    onSectionsTreeScroll(e: JQueryEventObject): void {
        this.handleScrollForPaddingBottom(e);
        this.handleScrollForPaddingTop(e);
    }
    
    handleScrollForPaddingBottom(e: JQueryEventObject): void {
        let paddingBottom = parseInt(this.sectionsTree.$container.css("padding-bottom"));
        if (paddingBottom <= 0) {
            return;
        }
        let scrollTop = this.sectionsTree.$container[0].scrollTop;
        let height = this.sectionsTree.$container[0].clientHeight;
        let bottom = scrollTop + height;
        let dPadding = this.sectionsTree.$container[0].scrollHeight - bottom;
        if (dPadding <= 0) {
            return;
        }
        let newPaddingBottom = Math.max(0, paddingBottom - dPadding);
        this.sectionsTree.$container.css("padding-bottom", newPaddingBottom + "px");
    }
    
    handleScrollForPaddingTop(e: JQueryEventObject): void {
        let paddingTop = parseInt(this.sectionsTree.$container.css("padding-top"));
        if (paddingTop <= 0) {
            return;
        }
        let scrollTop = this.sectionsTree.$container[0].scrollTop;
        let newPaddingTop = Math.max(0, paddingTop - scrollTop);
        this.sectionsTree.$container.css("padding-top", newPaddingTop + "px");
        this.sectionsTree.$container[0].scrollTop = 0;
    }
    
}
