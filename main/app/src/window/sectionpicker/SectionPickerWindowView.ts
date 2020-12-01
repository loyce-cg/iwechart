import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as sectionEntryTemplate} from "./template/sectionEntry.html";
import * as $ from "jquery";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import { TreeView } from "../../component/tree/TreeView";
import { SectionEntry, Model, State } from "../sections/SectionsWindowController";
import { ExtListView } from "../../component/extlist/ExtListView";


@WindowView
export class SectionPickerWindowView extends BaseWindowView<Model> {
    sections: ExtListView<SectionEntry>;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.sections = this.addComponent("sections", new ExtListView<SectionEntry>(this, {
            template: sectionEntryTemplate
        }));
        
        this.sections.addEventListener("change", this.onTreeChange.bind(this));
    }
    
    initWindow(): Q.IWhenable<void> {
        this.$main.on("click", "[data-action=select]", this.onSelectClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-action=refresh]", this.onRefreshClick.bind(this));
        this.$main.on("click", "[data-tree-id]", this.onSectionClick.bind(this));
        this.bindKeyPresses();
        
        this.sections.$container = this.$main.find(".sections-list");
        return this.sections.triggerInit();
    }

    
    setButtonsState(state: State): void {
        this.$main.find("[data-action=select]").prop("disabled", !state.canAdd);
    }
    
    onSelectClick(): void {
        this.triggerEvent("select");
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
                this.onSelectClick();
            }
            else if (e.keyCode == KEY_CODES.escape) {
                e.preventDefault();
                this.onCloseClick();
            }
            else if (e.keyCode === KEY_CODES.upArrow) {
                e.preventDefault();
                this.scrollViewIfNeeded();
                this.selectUp();
            }
            else if (e.keyCode === KEY_CODES.downArrow) {
                e.preventDefault();
                this.scrollViewIfNeeded();
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
        // this.scrollViewIfNeeded();
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
        let idx = $list.index($active);
        
        let eleNext = idx < $list.length - 1 ? $list.get(idx+1) : $list.get(idx);
        let elePrev = idx > 0 ? $list.get(idx-1) : $list.get(idx);
        
        let eleNextBB = eleNext.getBoundingClientRect();
        let elePrevBB = elePrev.getBoundingClientRect();

        if (elePrevBB.top < parentBB.top) {
            parent.scrollTop += elePrevBB.top - parentBB.top;
        }
        else if (eleNextBB.bottom > parentBB.bottom) {
            parent.scrollTop += eleNextBB.bottom - parentBB.bottom;
        }
    }
    
    getPrevItem($active: JQuery) {
        let $toRet = $active.prev();
        if ($toRet.hasClass("hidden-section")) {
            $toRet = this.getPrevItem($toRet);
        }
        return $toRet;
    }
    
    getNextItem($active: JQuery) {
        let $toRet = $active.next();
        if ($toRet.hasClass("hidden-section")) {
            $toRet = this.getNextItem($toRet);
        }
        return $toRet;
    }
    
    selectUp() {
        let $active = this.sections.$container.find(".active");
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
        let $active = this.sections.$container.find(".active");
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
}
