import { component, JQuery as $, Q, Types } from "pmc-web";
import { Model, ItemModel, CustomSelectItem, CustomSelectOptions } from "./CustomSelectController";
import { func as mainTemplate } from "./template/main.html";
import { func as itemTemplate } from "./template/item.html";


export class CustomSelectView extends component.base.ComponentView {
    
    $container: JQuery;
    $main: JQuery;
    $dropDown: JQuery;
    $itemsContainer: JQuery;
    $btn: JQuery;
    $selectedItemsContainer: JQuery;
    
    items: Array<CustomSelectItem>;
    options: CustomSelectOptions = {};
    
    isDropDownOpen: boolean = false;
    docClickHandler: () => void;
    onChangeHandler: (value: string) => void = null;
    
    ignoreOneDocClick: boolean = false;
    
    lastClickedIdx: number = -1;
    
    dragSelectStartIdx: number = -1;
    dragSelectMode: boolean = true;
    dragSelectOrigStates: Array<boolean>;
    
    prevVal: string = null;
    newTaskListRequested: boolean = false;
    prev1lh: number = -1;
    refreshAvatars: () => void = () => {};
    
    constructor(parent: Types.app.ViewParent) {
        super(parent);
    }
    
    init(model: Model): any {
        this.items = JSON.parse(model.itemsStr);
        this.options = JSON.parse(model.optionsStr);
        
        this.$main = this.templateManager.createTemplate(mainTemplate).renderToJQ(model);
        this.$dropDown = this.$main.find(".custom-select-dropdown");
        this.$itemsContainer = this.$dropDown.children(".context-menu-content");
        this.$btn = this.$main.find(".custom-select-button");
        this.$selectedItemsContainer = this.$btn.children(".selected-items");
        this.$main.on("click", "input[type=checkbox]", (e: any) => { e.preventDefault(); });
        this.$itemsContainer.on("mousedown", (() => {
            if (!this.options.multi) {
                this.toggleOpen();
            }
        }).bind(this));
        this.$main.on("keydown", this.onKeyDown.bind(this));
        
        this.docClickHandler = this.onDocumentClick.bind(this);
        
        if (this.options.gridColsCount) {
            this.$main.addClass("grid-" + this.options.gridColsCount);
            this.$main.addClass("grid");
        }
        
        this.updateItems();
        this.updateEditable();
        
        return Q.resolve();
    }
    
    $currHintItem: JQuery = null;
    onKeyDown(e: KeyboardEvent): void {
        if (e.key == "Escape") {
            if (this.isDropDownOpen) {
                e.stopPropagation();
                this.toggleOpen();
            }
        }
        else if (e.key == "Enter") {
            let wasOpen = true;
            if (!this.isDropDownOpen) {
                wasOpen = false;
                e.stopPropagation();
                this.toggleOpen();
            }
            if (this.$currHintItem != null) {
                e.stopPropagation();
                this.selectItem(this.$currHintItem, e.shiftKey);
            }
            else if (wasOpen) {
                this.toggleOpen();
            }
        }
        else if (e.key == "Tab") {
            if (this.isDropDownOpen) {
                this.toggleOpen();
            }
        }
        else if (e.key == "ArrowUp" || e.key == "ArrowDown" || e.key == "ArrowLeft" || e.key == "ArrowRight") {
            e.stopPropagation();
            let cols = this.options.gridColsCount;
            let isGrid = !!cols;
            if (this.$currHintItem == null) {
                this.$currHintItem = this.$itemsContainer.find("li.item.selected").first();
                if (this.$currHintItem.length == 0) {
                    this.$currHintItem = this.$itemsContainer.find("li.item").first();
                }
            }
            if ((e.key == "ArrowUp" && !isGrid) || (e.key == "ArrowLeft" && isGrid)) {
                let $prev = this.$currHintItem.prev();
                if ($prev.length > 0) {
                    this.$currHintItem = $prev;
                }
                else if (this.$currHintItem.parent().children().last().length > 0) {
                    this.$currHintItem = this.$currHintItem.parent().children().last();
                }
            }
            else if ((e.key == "ArrowDown" && !isGrid) || (e.key == "ArrowRight" && isGrid)) {
                if (!this.isDropDownOpen) {
                    this.toggleOpen();
                    return;
                }
                else {
                    let $next = this.$currHintItem.next();
                    if ($next.length > 0) {
                        this.$currHintItem = $next;
                    }
                    else if (this.$currHintItem.parent().children().first().length > 0) {
                        this.$currHintItem = this.$currHintItem.parent().children().first();
                    }
                }
            }
            else if (e.key == "ArrowUp" && isGrid) {
                let $prev = this.$currHintItem;
                for (let i = 0; i < cols; ++i) {
                    $prev = $prev.prev();
                }
                if ($prev.length > 0) {
                    this.$currHintItem = $prev;
                }
                
            }
            else if (e.key == "ArrowDown" && isGrid) {
                let $next = this.$currHintItem;
                for (let i = 0; i < cols; ++i) {
                    $next = $next.next();
                }
                if ($next.length > 0) {
                    this.$currHintItem = $next;
                }
            }
            this.$itemsContainer.find("li.item").removeClass("select-hint");
            this.$currHintItem.addClass("select-hint");
            this.scrollToCurrHintItem();
        }
    }
    
    setContainer($container: JQuery): void {
        this.$container = $container;
        this.$container.empty().append(this.$main);
        
        if (!this.$btn.data("events-bound")) {
            this.$btn.data("events-bound", true);
            this.$btn.on("mousedown", this.onBtnMouseDown.bind(this));
            if (!this.options.multi) {
                this.$itemsContainer.on("mousedown mouseup", "li", this.onItemClick.bind(this));
            }
            else {
                this.$itemsContainer.on("mousedown", "li", this.onMultiItemMouseDown.bind(this));
                this.$itemsContainer.on("mousemove", "li", this.onMultiItemMouseMove.bind(this));
                $(document).on("mouseup", this.onMultiDocMouseUp.bind(this));
            }
        }
    }
    
    updateItems(newValue: string = null): void {
        if (newValue !== null) {
            this.items = JSON.parse(newValue);
        }
        this.$main.toggleClass("disabled", !this.items || this.items.length == 0);
        
        this.$itemsContainer.empty();
        for (let item of this.items) {
            let itemModel: ItemModel = {
                item: item,
                multi: this.options.multi,
                extraClass: item.extraClass,
                extraStyle: item.extraStyle,
                textNoEscape: item.textNoEscape,
            };
            let $tpl = this.templateManager.createTemplate(itemTemplate).renderToJQ(itemModel);
            this.$itemsContainer.append($tpl);
        }
        this.updateMainSelectedItem();
        this.emitValueChanged(newValue ? true : false);
        this.refreshAvatars();
    }
    
    updateEditable(newValue: boolean = null): void {
        if (newValue !== null) {
            this.options.editable = newValue;
        }
        
        if (this.options.editable) {
            this.$main.addClass("editable");
            this.$main.removeClass("readonly");
        }
        else {
            this.$main.removeClass("editable");
            this.$main.addClass("readonly");
        }
    }
    
    updateSelection(e: EventTarget|HTMLElement): void {
        let $li: JQuery = $(<HTMLElement>e);
        if (!$li.is("li.item")) {
            $li = $li.parents("li.item").first();
        }
        let orphClick = $li.data("val") == "__orphans__";
        
        let $items = this.$itemsContainer.children();
        let fiis = this.options.firstItemIsStandalone;
        let deselect = false;
        let deselectFirst = fiis && !orphClick;
        let nSelected = 0;
        for (let idxS in this.items) {
            let idx: number = <any>idxS;
            let it = this.items[idx];
            if (deselect) {
                it.selected = false;
            }
            if (idxS == <any>0 && deselectFirst) {
                it.selected = false;
            }
            if (it.selected) {
                nSelected++;
                $items.eq(idx).addClass("selected");
            }
            else {
                $items.eq(idx).removeClass("selected");
            }
            if (this.options.multi) {
                $items.eq(idx).find("input[type=checkbox]").prop("checked", it.selected);
            }
            if (idxS == <any>0 && fiis && it.selected && orphClick) {
                deselect = true;
            }
        }
        if (fiis && nSelected == 0 && this.items.length > 0) {
            $items.eq(0).addClass("selected");
            this.items[0].selected = true;
            if (this.options.multi) {
                $items.eq(0).find("input[type=checkbox]").prop("checked", true);
            }
        }
        this.updateMainSelectedItem();
    }
    
    updateMainSelectedItem(): void {
        let selectedItems = this.items.filter(it => it.selected);
        let nSelectedItems = selectedItems.length;
        let hasSelectedItems = nSelectedItems > 0;
        if (this.options.collapseCanvases && nSelectedItems > 1) {
            let $cnvs = $();
            selectedItems
                .map(it => this.$itemsContainer.children("[data-val='" + it.val + "']").find("canvas").first())
                .forEach($cnv => {
                    if ($cnv.length == 0) {
                        return null;
                    }
                    let $cnv2: JQuery;
                    try {
                        $cnv2 = <JQuery>$($cnv[0].cloneNode(true));
                    }
                    catch (e) {
                        return;
                    }
                    $cnv2.attr("data-tooltip-trigger", $cnv.attr("data-hashmail-image"));
                    $cnv2.addClass("not-rendered");
                    $cnvs = $cnvs.add($cnv2);
                });
            $cnvs.wrap("<span class=\"avatar-container\"></span>");
            let $li = $("<li class=\"item\"></li>");
            let $span = $("<span></span>");
            $li.append($span);
            $span.append($cnvs.parent());
            this.$selectedItemsContainer.empty();
            this.$selectedItemsContainer.append($li);
            return;
        }
        
        if (!hasSelectedItems) {
            let $el = $("<li class=\"item\"><span class=\"no-selection-text\"></span></li>");
            $el.children().text(this.options.noSelectionText);
            if (this.options.noSelectionPersonCanvas) {
                let $cnv = $("<canvas class=\"icon not-rendered\" data-auto-size=\"true\"></canvas>");
                $cnv.prependTo($el.find(".no-selection-text"));
            }
            this.$selectedItemsContainer.empty();
            this.$selectedItemsContainer.append($el);
            return;
        }
        
        let selectedItemIdx: number = null;
        let selectedArr: Array<string> = [];
        let selectedEls: Array<JQuery> = [];
        let allNoEscape: boolean = true;
        let $itemsContainerChildren = this.$itemsContainer.children();
        for (let idxS in this.items) {
            let idx: number = <any>idxS;
            let it = this.items[idx];
            if (it.selected) {
                if (selectedItemIdx === null) {
                    selectedItemIdx = idx;
                }
                selectedArr.push(it.text);
                selectedEls.push($itemsContainerChildren.eq(idx));
            }
            if (!it.textNoEscape) {
                allNoEscape = false;
            }
        }
        
        if (selectedItemIdx !== null) {
            let $it = $itemsContainerChildren.eq(selectedItemIdx);
            let $itClone = $("<li class=\"item\">" + $it.html() + "</li>");
            let $txt = $itClone.find(".text");
            if ($txt.hasClass("taskgroup-label-container")) {
                let item = this.items[selectedItemIdx];
                let itemModel: ItemModel = {
                    item: item,
                    multi: this.options.multi,
                    extraClass: item.extraClass,
                    extraStyle: item.extraStyle,
                    textNoEscape: item.textNoEscape,
                };
                $itClone = this.templateManager.createTemplate(itemTemplate).renderToJQ(itemModel);
                $itClone.removeClass("selected");
                for (let s of selectedArr) {
                    let $txtClone = $($txt[0].outerHTML);
                    $txtClone.text(s);
                    $txt.parent().append($txtClone);
                }
                $txt.remove();
            }
            else if ($txt.hasClass("taskgroup-label")) {
                for (let i = 0; i < selectedArr.length; ++i) {
                    let $el = selectedEls[i];
                    let $itClone = $("<li class=\"item\">" + $el.html() + "</li>");
                    let $txt0 = $itClone.find(".text");
                    let $txtClone = $($txt0[0].outerHTML);
                    $txt.parent().append($txtClone);
                }
                $txt.remove();
            }
            else {
                if (allNoEscape) {
                    $txt.html(selectedArr.join(", "));
                }
                else {
                    $txt.text(selectedArr.join(", "));
                }
            }
            if (this.$selectedItemsContainer.children().html() != $itClone.html()) {
                this.$selectedItemsContainer.empty();
                this.$selectedItemsContainer.append($itClone);
                if (selectedItems.length == 1) {
                    let $el = this.$itemsContainer.children("[data-val='" + selectedItems[0].val + "']");
                    if ($el.hasClass("has-section-tooltip")) {
                        $itClone.addClass("has-section-tooltip").attr("data-section-id", $el.attr("data-section-id"));
                    }
                }
            }
        }
        else {
            this.$selectedItemsContainer.empty();
        }
    }
    
    toggleOpen(): void {
        if (!this.isDropDownOpen && this.items.length == 0) {
            return;
        }
        this.$currHintItem = null;
        this.$itemsContainer.find("li.select-hint").removeClass("select-hint");
        if (this.isDropDownOpen) {
            $(document).off("mouseup mousedown", this.docClickHandler);
            this.isDropDownOpen = false;
            this.$main.removeClass("open");
            this.$dropDown.removeClass("visible");
        }
        else if (this.options.editable) {
            this.updateDropDownSizeAndDirection();
            this.isDropDownOpen = true;
            this.$main.addClass("open");
            this.$dropDown.addClass("visible");
            if (this.options.scrollToFirstSelected) {
                this.centerToFirstSelected();
            }
        }
    }
    
    onBtnMouseDown(e: MouseEvent): void {
        this.toggleOpen();
    }
    
    onDocumentClick(e: MouseEvent): void {
        if ($.contains(this.$main[0], <Element>e.target) || this.$main[0] == e.target) {
            return;
        }
        if (this.ignoreOneDocClick) {
            this.ignoreOneDocClick = false;
            return;
        }
        this.toggleOpen();
    }
    
    onMultiItemMouseDown(e: MouseEvent): void {
        let $li = $(e.currentTarget);
        let idx = $li.index();
        this.dragSelectStartIdx = idx;
        this.dragSelectMode = !this.items[idx].selected;
        this.items[idx].selected = this.dragSelectMode;
        this.dragSelectOrigStates = this.items.map(x => x.selected);
        
        this.$currHintItem = <any>$li;
        this.handleTaskGroupCreator();
        this.updateSelection(e.target);
        this.emitValueChanged();
    }
    
    onMultiItemMouseMove(e: MouseEvent): void {
        if (this.dragSelectStartIdx < 0) {
            return;
        }
        e.stopPropagation();
        let modified = false;
        let $li = $(e.currentTarget);
        let idx = $li.index();
        if (this.options.firstItemIsStandalone && $li.data("val") == "__orphans__") {
            return;
        }        
        
        let from = this.dragSelectStartIdx;
        let to = idx;
        if (from > to) {
            let tmp = from;
            from = to;
            to = tmp;
        }
        
        for (let i = 0; i < this.items.length; ++i) {
            if (i < from || i > to) {
                if (this.items[i].selected != this.dragSelectOrigStates[i]) {
                    this.items[i].selected = this.dragSelectOrigStates[i];
                    modified = true;
                }
            }
        }
        for (let i = from; i <= to; ++i) {
            if (this.items[i].selected != this.dragSelectMode) {
                this.items[i].selected = this.dragSelectMode;
                modified = true;
            }
        }
        
        if (modified) {
            this.handleTaskGroupCreator();
            this.updateSelection(e.target);
            this.emitValueChanged();
        }
    }
    
    onMultiDocMouseUp(e: MouseEvent): void {
        this.dragSelectStartIdx = -1;
    }
    
    onItemClick(e: MouseEvent): void {
        e.stopPropagation();
        let $li = $(e.currentTarget);
        this.$currHintItem = <any>$li;
        this.selectItem(<any>$li, e.shiftKey);
    }
    
    selectItem($li: JQuery, shiftKey: boolean) {
        let idx = $li.index();
        
        if (this.lastClickedIdx >= 0 && this.options.multi && shiftKey) {
            let from = this.lastClickedIdx;
            let to = idx;
            if (to > from) {
                from++;
            }
            else if (to < from) {
                from--;
            }
            let n = $li.parent().children().length;
            from = Math.min(n, Math.max(0, from));
            to = Math.min(n, Math.max(0, to));
            if (from > to) {
                let tmp = from;
                from = to;
                to = tmp;
            }
            if (from != to) {
                let newStatus = !this.items[idx].selected;
                for (let i = from; i <= to; ++i) {
                    this.items[i].selected = newStatus;
                }
                this.items[idx].selected = !newStatus;
            }
        }
        this.lastClickedIdx = idx;
        
        if (this.options.multi) {
            this.items[idx].selected = !this.items[idx].selected;
        }
        else {
            for (let it of this.items) {
                it.selected = false;
            }
            this.items[idx].selected = true;
        }
        this.handleTaskGroupCreator();
        this.updateSelection($li[0]);
        this.emitValueChanged();

        if (!this.options.multi) {
            this.toggleOpen();
        }
    }
    
    onChange(handler: (value: string) => void): CustomSelectView {
        this.onChangeHandler = handler;
        return this;
    }
    
    emitValueChanged(skipHandler: boolean = false): void {
        let valArr: Array<string> = [];
        for (let it of this.items) {
            if (it.selected) {
                valArr.push(it.val);
            }
        }
        if (this.options.multi && valArr.length == 0) {
            valArr = [this.options.noSelectionValue];
        }
        let val = valArr.join(",");
        if (val == this.prevVal) {
            return;
        }
        this.prevVal = val;
        if (!skipHandler && this.onChangeHandler) {
            this.onChangeHandler(val);
        }
        this.triggerEvent("valueChanged", val);
    }
    
    updateDropDownSizeAndDirection(): void {
        this.$dropDown = this.$main.find(".custom-select-dropdown");
        let $ddHeader = this.$dropDown.find(".dropdown-header");
        $ddHeader.detach();
        let h = this.$dropDown.height();
        if (this.$dropDown.children(".context-menu-content").length == 0) {
            this.$dropDown.height("auto");
            let $el = this.$dropDown.children(".pf-content");
            $el.removeClass("pf-content");
            h = this.$dropDown.height();
            $el.addClass("pf-content");
        }
        let dstHeight = Math.min(h, 250) + ($ddHeader.length > 0 ? 20 : 0);
        if (this.items.length == 1 && this.prev1lh > 0) {
            dstHeight = this.prev1lh;
        }
        else if (this.items.length == 1) {
            this.prev1lh = dstHeight;
        }
        (<any>this.$dropDown).height(dstHeight);
        (<any>this.$dropDown).pfScroll().turnOn();
        if (this.$dropDown.children(".pf-content").children(".pf-content").length > 0) {
            let $el = this.$dropDown.children(".pf-content");
            let $cnt = $el.find(".context-menu-content");
            $cnt.detach();
            $el.empty();
            $el.append($cnt);
        }
        this.$dropDown.toggleClass("with-dropdown-header", $ddHeader.length > 0);
        if ($ddHeader.length > 0) {
            $ddHeader.prependTo(this.$dropDown);
        }
        
        this.$dropDown.find(".pf-mover, .pf-scroll").on("mousedown", () => {
            this.ignoreOneDocClick = true;
        });
        this.$dropDown.on("mousewheel", (e: any) => {
            e.stopPropagation();
        });
        setTimeout(() => {
            $(document).on("mouseup mousedown", this.docClickHandler);
        }, 15);
        
        let dropDownMarginTop = -5; // dir = down
        let dropDownMarginBottom = -5; // dir = up
        let windowHeight = $(window).height() - 53;
        let buttonStart = this.$btn.offset().top;
        let $cont = this.$btn.closest("[data-cs-container]");
        if ($cont.length > 0) {
            windowHeight = $cont.height();
            buttonStart = buttonStart - $cont.offset().top;
        }
        let buttonEnd = buttonStart + this.$btn.outerHeight();
        let availDown = windowHeight - buttonEnd + dropDownMarginTop;
        let availUp = buttonStart + dropDownMarginBottom;
        let dir: "up"|"down" = "down";
        if (availDown >= dstHeight) {
            dir = "down";
        }
        else if (availUp >= dstHeight) {
            dir = "up";
        }
        else if (availDown >= availUp) {
            dir = "down";
            this.$dropDown.height(availDown);
        }
        else {
            dir = "up";
            this.$dropDown.height(availUp);
        }
        this.$main.toggleClass("dropdown-down", dir == "down");
        this.$main.toggleClass("dropdown-up", dir == "up");
    }
    
    handleTaskGroupCreator() {
        let tgCreator = this.items.filter(it => it.selected && it.isTaskGroupCreator);
        if (tgCreator.length > 0) {
            tgCreator[0].selected = false;
            if (!this.newTaskListRequested) {
                this.newTaskListRequested = true;
                this.dragSelectStartIdx = -1;
                this.triggerEvent("createTaskGroupRequest");
            }
        }
    }
    
    grabFocus(highlightFirstItem: boolean = false) {
        if (highlightFirstItem) {
            this.$currHintItem = this.$itemsContainer.find("li.item").first();
            this.$itemsContainer.find("li.item").removeClass("select-hint");
            this.$currHintItem.addClass("select-hint");
            this.scrollToCurrHintItem();
        }
        this.$main.focus();
        this.newTaskListRequested = false;
        this.updateDropDownSizeAndDirection();
    }
    
    scrollToCurrHintItem(): void {
        let $el = this.$currHintItem;
        if (!$el || $el.length == 0) {
            return;
        }
        
        let margin = 10;
        let $scrollable = $el.closest(".pf-content");
        let scrollTo = $scrollable.scrollTop();
        let viewportHeight = $scrollable.height();
        let elStart = $el.offset().top - margin;
        let elEnd = elStart + $el.outerHeight() + margin;
        
        if (elStart >= 0 && elEnd <= viewportHeight) {
            return;
        }
        
        if (elStart < 0) {
            scrollTo += elStart;
            $scrollable.scrollTop(scrollTo);
        }
        else if (elEnd > viewportHeight) {
            scrollTo += elEnd - viewportHeight;
            $scrollable.scrollTop(scrollTo);
        }
    }
    
    centerToFirstSelected(): void {
        let $el = this.$dropDown.find(".selected").first();
        if (!$el || $el.length == 0) {
            return;
        }
        
        let $scrollable = $el.closest(".pf-content");
        let viewportHeight = $scrollable.height();
        let elStart = $el[0].offsetTop;
        let elHeight = $el.outerHeight();
        let scrollTo = elStart - viewportHeight / 2 + elHeight / 2;
        $scrollable.scrollTop(scrollTo);
    }
    
}