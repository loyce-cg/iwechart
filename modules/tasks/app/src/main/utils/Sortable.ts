import * as web from "pmc-web";
import $ = web.JQuery;

export class Sortable {
    
    $container: JQuery;
    itemSelector: string;
    headerSelector: string;
    secondaryDataExtractor: ($el: JQuery) => string|number;
    
    constructor($container: JQuery, itemSelector: string, headerSelector: string, secondaryDataExtractor: ($el: JQuery) => string|number = ($el) => 0) {
        this.$container = $container;
        this.itemSelector = itemSelector;
        this.headerSelector = headerSelector;
        this.secondaryDataExtractor = secondaryDataExtractor;
    }
    
    sort($container: JQuery, dataSetIdx: number = -1, keepOrder: boolean = false): void {
        $container.data("data-set-idx", dataSetIdx);
        
        // Determine direction
        let orderStr = $container.data("sort-direction");
        if (orderStr) {
            if (keepOrder) {
                orderStr = orderStr == "asc" ? "asc" : "desc";
            }
            else {
                orderStr = orderStr == "asc" ? "desc" : "asc";
            }
        }
        else {
            orderStr = "asc";
        }
        $container.data("sort-direction", orderStr);
        
        // Collect items
        let $items = $container.find(this.itemSelector);
        
        // Sort only if there are any items
        if ($items.length > 0) {
            // Collect data
            let data: Array<[number, [string|number, string|number]]> = [];
            $items.each((idx, el) => {
                data.push([idx, this.extractData($(el), dataSetIdx)]);
            });
            
            // Sort
            let dataType1 = typeof(data[0][1][0]);
            let dataType2 = typeof(data[0][1][1]);
            if (dataType1 == "string" || dataType2 == "string") {
                let d1s = dataType1 == "string";
                let d2s = dataType2 == "string";
                for (let x of data) {
                    if (d1s) {
                        x[1][0] = "" + x[1][0];
                    }
                    if (d2s) {
                        x[1][1] = "" + x[1][1];
                    }
                }
            }
            data.sort(this.getMultiComparator(dataType1, dataType2, orderStr))
            
            // Apply permutation
            let $parent = $items.eq(0).parent();
            for (let newIdx in data) {
                let [idx] = data[newIdx];
                $items.eq(idx).appendTo($parent);
            }
            
            // Move pinned elements to top
            let $pinned = $parent.find("tr.pinned");
            $pinned.prependTo($parent);
        }
        
        // Update headers
        if (this.headerSelector && dataSetIdx != -1) {
            let $headers: JQuery = $container.find(this.headerSelector);
            $headers.removeClass("sorted-asc").removeClass("sorted-desc");
            $headers.eq(dataSetIdx).addClass("sorted-" + orderStr);
        }
        
        // Sort all?
        if ($container.hasClass("sort-all")) {
            this.sortAll(dataSetIdx, orderStr);
        }
    }
    
    extractData($el: JQuery, dataSetIdx: number): [string|number, string|number] {
        let str: string = null;
        if (dataSetIdx == -1) {
            str = $el.data("sortable-val");
        }
        else {
            let $child = $el.children().eq(dataSetIdx);
            str = $child.data("sortable-val");
            
            if (typeof(str) == "number") {
                return [str, this.secondaryDataExtractor($el)];
            }
            else if (typeof(str) != "string") {
                str = $child.text().trim();
            }
        }
        
        return [str, this.secondaryDataExtractor($el)];
    }
    
    isSorted($headersContainer: JQuery): boolean {
        return $headersContainer.children(".sorted-asc, .sorted-desc").length > 0;
    }
    
    restoreOrder($table: JQuery): void {
        this.sort($table, $table.data("data-set-idx"), true);
    }
    
    getMultiComparator(dataType1: string, dataType2: string, orderStr: string): (a: [number, [any, any]], b: [number, [any, any]]) => number {
        let cmp1 = (<any>this)[dataType1 + "Comparator" + orderStr[0].toUpperCase() + orderStr.substr(1)];
        let cmp2 = (<any>this)[dataType2 + "Comparator" + orderStr[0].toUpperCase() + orderStr.substr(1)];
        return (a: [number, [any, any]], b: [number, [any, any]]) => {
            let r1 = cmp1(a[1][0], b[1][0]);
            if (r1 == 0) {
                return cmp2(a[1][1], b[1][1]);
            }
            return r1;
        };
    }
    
    stringComparatorAsc(a: string, b: string): number {
        return a.localeCompare(b);
    }
    
    stringComparatorDesc(a: string, b: string): number {
        return -a.localeCompare(b);
    }
    
    numberComparatorAsc(a: number, b: number): number {
        return a - b;
    }
    
    numberComparatorDesc(a: number, b: number): number {
        return -(a - b);
    }
    
    onHeaderClick(e: MouseEvent): void {
        let $el = $(<HTMLElement>e.currentTarget);
        let idx = $el.index();
        this.sort($el.parents("table"), idx);
    }
    
    sortAll(dataSetIdx: number, orderStr: string) {
        this.$container.find("table").each((idx, table) => {
            let $table = $(table);
            if ($table.hasClass("sort-all")) {
                return;
            }
            $table.data("sort-direction", orderStr);
            this.sort($table, dataSetIdx);
        });
    }
    
}
