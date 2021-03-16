import { Model, ItemModel, CustomSelectItem, CustomSelectOptions, MergeStrategy, TakeAllMergeStrategy, CustomFunctionMergeStrategy, TakePartsMergeStrategy, CustomSelectSeparator } from "./Types";
import * as Types from "../../Types";
import { ComponentView } from "../base/web";
import { func as mainTemplate } from "./template/main.html";
import { func as itemTemplate } from "./template/item.html";
import { func as itemSeparatorTemplate } from "./template/itemSeparator.html";
import { MailClientViewHelper, template } from "../../web-utils";
import * as $ from "jquery";
export * from "./Types";

export interface CustomSelectViewOptions {
    customItemTemplates?: { [name: string]: template.Template<CustomSelectItem, void, MailClientViewHelper> };
    customMergeFunctions?: { [name: string]: (selectedItems: CustomSelectItem[], $collector: JQuery) => JQuery };
}

export interface ItemModelEx<T extends CustomSelectItem | CustomSelectSeparator = CustomSelectItem> extends ItemModel<T> {
    customTemplate?: template.Template<CustomSelectItem, void, MailClientViewHelper>;
}

export class CustomSelectView extends ComponentView {
    
    static readonly DEFAULT_MERGE_STRATEGY: MergeStrategy = <TakeAllMergeStrategy>{
        strategyType: "take-all",
        separator: ", ",
    };
    
    $container: JQuery;
    $main: JQuery;
    $dropDown: JQuery;
    $itemsContainer: JQuery;
    $btn: JQuery;
    $selectedItemsContainer: JQuery;
    
    items: (CustomSelectItem | CustomSelectSeparator)[];
    options: CustomSelectOptions = { items: [] };
    
    isDropDownOpen: boolean = false;
    docClickHandler: () => void;
    onChangeHandler: (value: string) => void = null;
    
    ignoreOneDocClick: boolean = false;
    
    lastClickedIdx: number = -1;
    
    dragSelectStartIdx: number = -1;
    dragSelectMode: boolean = true;
    dragSelectOrigStates: Array<boolean>;
    
    prevVal: string = null;
    prev1lh: number = -1;
    refreshAvatars: () => void = () => {};
    
    itemTemplate: template.Template<ItemModel, void, MailClientViewHelper>;
    itemSeparatorTemplate: template.Template<string, void, MailClientViewHelper>;
    
    constructor(parent: Types.app.ViewParent, public viewOptions: CustomSelectViewOptions) {
        super(parent);
    }
    
    async init(model: Model): Promise<void> {
        this.items = JSON.parse(model.itemsStr);
        this.options = JSON.parse(model.optionsStr);
        this.itemTemplate = this.templateManager.createTemplate(itemTemplate);
        this.itemSeparatorTemplate = this.templateManager.createTemplate(itemSeparatorTemplate);
        
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
        if (this.$container) {
            this.setContainer(this.$container);
        }
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
    
    updateItems(newValue: string = null, suppressSelectionChangedEvent: boolean = false): void {
        if (newValue !== null) {
            this.items = JSON.parse(newValue);
        }
        this.$main.toggleClass("disabled", !this.items || this.items.length == 0);
        
        this.$itemsContainer.empty();
        for (let item of this.items) {
            const $item = this.renderItemToJQ(item);
            this.$itemsContainer.append($item);
        }
        this.updateMainSelectedItem();
        this.updateClasses();
        if (suppressSelectionChangedEvent) {
            const tmp = this.onChangeHandler;
            this.onChangeHandler = null;
            this.emitValueChanged();
            this.onChangeHandler = tmp;
        }
        else {
            this.emitValueChanged();
        }
        this.refreshAvatars();
    }
    
    renderItemToJQ(item: CustomSelectItem | CustomSelectSeparator): JQuery {
        if (!item || item.type == "item") {
            const itemModelEx = this.getItemModel(item as CustomSelectItem | null);
            const $item = this.itemTemplate.renderToJQ(itemModelEx);
            return $item;
        }
        else if (item.type == "separator") {
            const $separator = this.itemSeparatorTemplate.renderToJQ();
            return $separator;
        }
    }
    
    getItemModel(item: CustomSelectItem): ItemModelEx {
        if (!item) {
            item = {
                type: "item",
                icon: null,
                text: null,
                value: null,
                selected: false,
            };
        }
        return {
            item: item,
            multi: this.options.multi,
            extraClass: item.extraClass,
            extraStyle: item.extraStyle,
            textNoEscape: item.textNoEscape,
            customTemplate: this._getCustomItemTemplate(item),
        };
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
            if (it.type == "separator") {
                continue;
            }
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
            const firstItemIdx = this.items.findIndex(x => x.type == "item");
            if (firstItemIdx >= 0) {
                $items.eq(firstItemIdx).addClass("selected");
                (this.items[firstItemIdx] as CustomSelectItem).selected = true;
                if (this.options.multi) {
                    $items.eq(firstItemIdx).find("input[type=checkbox]").prop("checked", true);
                }
            }
        }
        this.updateMainSelectedItem();
        this.updateClasses();
    }
    
    updateMainSelectedItem(): void {
        let selectedItems = this.items.filter(it => it.type == "item" && it.selected) as CustomSelectItem[];
        
        let $selectedItems = $();
        if (selectedItems.length == 0) {
            const $noSelectionItem: JQuery = this.renderItemToJQ(this.options.noSelectionItem);
            $selectedItems = $selectedItems.add(this.prepareItemForDisplayInMainButton($noSelectionItem));
        }
        else if (selectedItems.length == 1) {
            const $selectedItem = this.renderItemToJQ(selectedItems[0]);
            $selectedItems = $selectedItems.add(this.prepareItemForDisplayInMainButton($selectedItem));
        }
        else if (selectedItems.length > 1) {
            const mergeStrategy = this.options.mergeStrategy || CustomSelectView.DEFAULT_MERGE_STRATEGY;
            if (mergeStrategy.strategyType == "take-all") {
                const takeAllStrategy = mergeStrategy as TakeAllMergeStrategy;
                const $itemSeparator = this.itemSeparatorTemplate.renderToJQ(takeAllStrategy.separator);
                for (let i = 0; i < selectedItems.length; ++i) {
                    if (i > 0) {
                        $selectedItems = $selectedItems.add($itemSeparator[0].cloneNode(true) as HTMLElement);
                    }
                    const $selectedItem = this.renderItemToJQ(selectedItems[i]);
                    $selectedItems = $selectedItems.add(this.prepareItemForDisplayInMainButton($selectedItem));
                }
            }
            else if (mergeStrategy.strategyType == "take-first") {
                const $firstSelectedItem = this.renderItemToJQ(selectedItems[0]);
                $selectedItems = $selectedItems.add(this.prepareItemForDisplayInMainButton($firstSelectedItem));
            }
            else if (mergeStrategy.strategyType == "take-parts") {
                const takePartsStrategy = mergeStrategy as TakePartsMergeStrategy;
                const iconsStrategy = takePartsStrategy.icons;
                const textsStrategy = takePartsStrategy.texts;
                const $iconsSeparator = this.itemSeparatorTemplate.renderToJQ(takePartsStrategy.iconsSeparator);
                const $textsSeparator = this.itemSeparatorTemplate.renderToJQ(takePartsStrategy.textsSeparator);
                
                let numIconsToTake: number = 0;
                if (iconsStrategy == "take-all") { numIconsToTake = selectedItems.length; }
                else if (iconsStrategy == "take-first") { numIconsToTake = 1; }
                else if (iconsStrategy == "take-none") { numIconsToTake = 0; }
                
                let numTextsToTake: number = 0;
                if (textsStrategy == "take-all") { numTextsToTake = selectedItems.length; }
                else if (textsStrategy == "take-first") { numTextsToTake = 1; }
                else if (textsStrategy == "take-none") { numTextsToTake = 0; }
                
                for (let i = 0; i < numIconsToTake; ++i) {
                    if (i > 0) {
                        $selectedItems = $selectedItems.add($iconsSeparator[0].cloneNode(true) as HTMLElement);
                    }
                    const $selectedItem = this.renderItemToJQ(selectedItems[i]);
                    $selectedItem.find(".item-content").children(".text").remove();
                    $selectedItems = $selectedItems.add(this.prepareItemForDisplayInMainButton($selectedItem));
                }
                
                for (let i = 0; i < numTextsToTake; ++i) {
                    if (i > 0) {
                        $selectedItems = $selectedItems.add($textsSeparator[0].cloneNode(true) as HTMLElement);
                    }
                    const $selectedItem = this.renderItemToJQ(selectedItems[i]);
                    $selectedItem.find(".item-content").children(".icon").remove();
                    $selectedItems = $selectedItems.add(this.prepareItemForDisplayInMainButton($selectedItem));
                }
            }
            else if (mergeStrategy.strategyType == "custom-function") {
                const customFunctionStrategy = mergeStrategy as CustomFunctionMergeStrategy;
                const customFunction = this.viewOptions.customMergeFunctions ? this.viewOptions.customMergeFunctions[customFunctionStrategy.functionName] : null;
                if (customFunction) {
                    customFunction(selectedItems, $selectedItems);
                }
            }
        }
        
        this.$selectedItemsContainer.empty();
        this.$selectedItemsContainer.append($selectedItems);
    }
    
    prepareItemForDisplayInMainButton($item: JQuery): JQuery {
        $item.removeClass("selected");
        return $item;
    }
    
    updateClasses(): void {
        const numSelectedItems = this.items.filter(item => item.type == "item" && item.selected).length;
        this.$main.toggleClass("no-selected-items", numSelectedItems === 0);
        this.$main.toggleClass("one-selected-item", numSelectedItems === 1);
        this.$main.toggleClass("multiple-selected-items", numSelectedItems > 1);
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
        const it = this.items[idx];
        if (it.type == "separator") {
            return;
        }
        this.dragSelectMode = !it.selected;
        it.selected = this.dragSelectMode;
        const items = this.items.filter(x => x.type == "item") as CustomSelectItem[];
        this.dragSelectOrigStates = items.map(x => x.selected);
        
        this.$currHintItem = <any>$li;
        this.handleActionClick();
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
            const it = this.items[i];
            if (it.type == "separator") {
                continue;
            }
            if (i < from || i > to) {
                if (it.selected != this.dragSelectOrigStates[i]) {
                    it.selected = this.dragSelectOrigStates[i];
                    modified = true;
                }
            }
        }
        for (let i = from; i <= to; ++i) {
            const it = this.items[i];
            if (it.type == "separator") {
                continue;
            }
            if (it.selected != this.dragSelectMode) {
                it.selected = this.dragSelectMode;
                modified = true;
            }
        }
        
        if (modified) {
            this.handleActionClick();
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
        
        const it = this.items[idx];
        if (it.type == "separator") {
            return;
        }
        
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
                let newStatus = !it.selected;
                for (let i = from; i <= to; ++i) {
                    const _it = this.items[i];
                    if (_it.type == "separator") {
                        continue
                    }
                    _it.selected = newStatus;
                }
                it.selected = !newStatus;
            }
        }
        this.lastClickedIdx = idx;
        
        if (this.options.multi) {
            it.selected = !it.selected;
        }
        else {
            for (let _it of this.items) {
                if (_it.type == "separator") {
                    continue
                }
                _it.selected = false;
            }
            it.selected = true;
        }
        this.handleActionClick();
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
    
    emitValueChanged(): void {
        let valArr: Array<string> = [];
        for (let it of this.items) {
            if (it.type == "item" && it.selected) {
                valArr.push(it.value);
            }
        }
        if (this.options.multi && valArr.length == 0 && this.options.noSelectionItem) {
            valArr = [this.options.noSelectionItem.value];
        }
        let val = valArr.join(",");
        if (val == this.prevVal) {
            return;
        }
        this.prevVal = val;
        if (this.onChangeHandler) {
            this.onChangeHandler(val);
        }
        this.triggerEvent("valueChanged", val);
    }
    
    updateDropDownSizeAndDirection(): void {
        this.$dropDown = this.$main.find(".custom-select-dropdown");
        const $btn = this.$main.find(".custom-select-button");
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
        let windowHeight = $(window).height();
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
        this.$dropDown[0].style.width = "";
        const cssDisplay = this.$dropDown[0].style.display;
        this.$dropDown[0].style.display = "none";
        const computedStyle = getComputedStyle(this.$dropDown[0]);
        if (computedStyle.width == "100%") {
            this.$dropDown[0].style.width = `${$btn.outerWidth()}px`;
        }
        this.$dropDown[0].style.display = cssDisplay;
        if (dir == "up") {
            const marginTopOffset = this.options.size == "small" ? 33 : 43;
            this.$dropDown[0].style.marginTop = `${-parseFloat(computedStyle.height) - marginTopOffset}px`;
        }
        this.$main.toggleClass("dropdown-down", dir == "down");
        this.$main.toggleClass("dropdown-up", dir == "up");
    }
    
    handleActionClick() {
        let selectedActionItems = this.items.filter(it => it.type == "item" && it.selected && it.actionId) as CustomSelectItem[];
        if (selectedActionItems.length > 0) {
            selectedActionItems[0].selected = false;
            this.dragSelectStartIdx = -1;
            this.triggerEvent("callActionHandler", selectedActionItems[0].actionId);
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
    
    private _getCustomItemTemplate(item: CustomSelectItem): template.Template<CustomSelectItem, void, MailClientViewHelper> | null {
        if (item.customTemplateName && this.viewOptions.customItemTemplates && this.viewOptions.customItemTemplates[item.customTemplateName]) {
            return this.viewOptions.customItemTemplates[item.customTemplateName];
        }
        return null;
    }
    
    getValue(): string | string[] | null {
        if (!this.items || this.items.length == 0) {
            return null;
        }
        const selectedItems = this.items.filter(item => item.type == "item" && item.selected) as CustomSelectItem[];
        const values = selectedItems.map(item => item.value);
        return this.options.multi ? values : (values.length > 0 ? values[0] : null);
    }
    
}