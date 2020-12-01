export class FilteredContainer {
    
    $container: JQuery;
    filter: string;
    
    constructor($container: JQuery, filter: string) {
        this.$container = $container;
        this.filter = filter;
    }
    
    empty() {
        this.$container.find(this.filter).remove();
        return this;
    }
    
    append($element: JQuery) {
        this.$container.append($element);
        return this;
    }
    
    children() {
        return this.$container.find(this.filter);
    }
    
    static createTbodyRows($table: JQuery) {
        return new FilteredContainer($table, "tbody");
    }
}

