import {ComponentView} from "../base/ComponentView";
import {Context, ExtListView, Options} from "../extlist/ExtListView";
import * as $ from "jquery";
import {Column} from "./ExtTableController";
import {webUtils} from "../../Types";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {app} from "../../Types";

export class ExtTableView<T, E = void, H = MailClientViewHelper> extends ComponentView {
    
    list: ExtListView<T, E, H>;
    $container: JQuery;
    customOnAfterListRender: Function;
    columns: Column[];
    $headers: JQuery;
    fixedWidth: number;
    flexValue: number;
    flexWidth: number;
    flexPixel: number;
    width: number;
    
    constructor(parent: app.ViewParent, options: {template: webUtils.TemplateDefinition<T, Context<T, E, H>, H>, onAfterListRender: Function, extra?: E}) {
        super(parent);
        this.customOnAfterListRender = options.onAfterListRender;
        this.list = this.addComponent("list", new ExtListView(this, {
            extra: options.extra,
            template: options.template,
            onAfterListRender: this.onAfterListRender.bind(this)
        }));
    }
    
    onScroll(): void {
        //this.$container.find(".table-head").css("top", this.$container.scrollTop() + "px");
    }
    
    init(model: Column[]): Q.Promise<void> {
        this.$container.on("scroll", this.onScroll.bind(this));
        this.render(model);
        return this.list.triggerInit();
    }
    
    render(model: Column[]): void {
        this.columns = model;
        this.$headers = this.$container.find(".table-head .table-cell");
        if (this.columns.length != this.$headers.length) {
            throw new Error("Invalid columns count. Controller's model columns count is not equal to template's columns count. Controller has: "+this.columns.length+" Template has: "+this.$headers.length);
        }
        this.fixedWidth = 0;
        this.flexValue = 0;
        for (let i = 0; i < this.columns.length; i++) {
            let column = this.columns[i];
            if (column.type == "fixed") {
                this.fixedWidth += column.value;
            }
            else if (column.type == "flex") {
                this.flexValue += column.value;
            }
            else {
                throw new Error("Invalid column type");
            }
        }
        let handles: HTMLElement[] = [];
        this.$headers.each((index, th) => {
            let $th = $(th);
            let column = this.columns[index];
            column.index = index;
            column.$header = $th;
            $th.data("column", column);
            if (index > 0) {
                let $handle = $('<div class="component-ext-table-column-resizer-handle"></div>');
                $th.append($handle);
                handles.push($handle.get(0));
            }
        });
        $(handles).off("mousedown.table-column-resizer").on("mousedown.table-column-resizer", this.getResizeHandleFunction.bind(this));
        this.redraw();
    }
    
    onAfterListRender(): void {
        this.redraw();
        if (this.customOnAfterListRender) {
            this.customOnAfterListRender();
        }
    }
    
    redraw(): void {
        let newWidth:number = 0;
        let getWidth:number = 0;
        try {
            getWidth = this.$container.find(".table-body").outerWidth();
            if (getWidth) {
                newWidth = getWidth;
            }
        }
        catch (e) {
            // Quiet error
        }
        if (this.width == newWidth) {
            return;
        }
        this.width = newWidth;
        this.flexWidth = this.width - this.fixedWidth - 1;
        this.flexPixel = this.flexWidth / this.flexValue;
        this.$headers.each(i => {
            let column = this.columns[i];
            column.width = column.type == "fixed" ? column.value : column.value * this.flexPixel;
            this.setColumnWidth(column, column.width);
        });
    }
    
    getResizeHandleFunction(event: JQueryEventObject): void {
        let $right = $(event.target).closest(".table-cell");
        let $left = $right.prev();
        let rightColumn = $right.data("column");
        let leftColumn = $left.data("column");
        let valid = false;
        let holdX = event.pageX;
        let rightOriginal: number;
        let leftOriginal: number;
        if (rightColumn.type != "fixed" || leftColumn.type != "fixed") {
            while (rightColumn != null && rightColumn.type != "flex") {
                rightColumn = this.columns[rightColumn.index + 1];
            }
            if (rightColumn != null) {
                while (leftColumn != null && leftColumn.type != "flex") {
                    leftColumn = this.columns[leftColumn.index - 1];
                }
                if (leftColumn != null) {
                    valid = true;
                    rightOriginal = rightColumn.value;
                    leftOriginal = leftColumn.value;
                }
            }
        }
        let $backdrop = $('<div class="component-ext-table-column-resizer-backdrop"></div>');
        $backdrop.on("mousemove.table-column-resizer", (e: JQueryEventObject) => {
            if (!valid) {
                return;
            }
            let diff = e.pageX - holdX;
            let flexDiff = diff / this.flexWidth * this.flexValue;
            let rightFlex = rightOriginal - flexDiff;
            let leftFlex = leftOriginal + flexDiff;
            if (rightFlex < rightColumn.min) {
                flexDiff = rightOriginal - rightColumn.min;
                rightFlex = rightOriginal - flexDiff;
                leftFlex = leftOriginal + flexDiff;
            }
            if (leftFlex < leftColumn.min) {
                flexDiff = leftOriginal - leftColumn.min;
                rightFlex = rightOriginal + flexDiff;
                leftFlex = leftOriginal - flexDiff;
            }
            rightColumn.value = rightFlex;
            leftColumn.value = leftFlex;
            rightColumn.width = rightFlex * this.flexPixel;
            leftColumn.width = leftFlex * this.flexPixel;
            this.triggerEvent("columnValueChange", rightColumn.index, rightColumn.value);
            this.triggerEvent("columnValueChange", leftColumn.index, leftColumn.value);
            this.setColumnWidth(rightColumn, rightColumn.width);
            this.setColumnWidth(leftColumn, leftColumn.width);
        });
        $backdrop.on("mouseup.table-column-resizer", () => {
            $backdrop.remove();
            $("body").removeClass("component-ext-table-column-resizer-unselectable");
        });
        $("body").append($backdrop).addClass("component-ext-table-column-resizer-unselectable");
    }
    
    setColumnWidth(column: Column, width: number): void {
        this.$container.find(".table-row").each((index, row) => {
            let $row = $(row);
            $row.find(".table-cell").eq(column.index).css("width", width + "px");
        });
    }
}
