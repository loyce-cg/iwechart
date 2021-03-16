import {JQuery as $} from "pmc-web";

export interface TreeItem {
    id: string;
    parentId: string;
    type: string;
    checked: boolean;
}

export class ViewTreeItem implements TreeItem {
    $el: JQuery<EventTarget>;
    id: string;
    parentId: string;
    type: string;
    checked: boolean;

    constructor($el: JQuery<HTMLElement>) {
        // this.$el = $(e.currentTarget).closest(".file-entry");
        this.$el = $el;
        this.id = this.$el.data("id");
        this.type = this.$el.data("type");
        this.parentId = this.$el.data("parent-id");
        this.checked = this.$el.find("input[type=checkbox]").prop("checked");
    }

    public static fromId(parent: HTMLElement, id: string): ViewTreeItem {
        let $el = $(parent).find(".file-entry[data-id='" + id + "']");
        return new ViewTreeItem($el);
    }

    public static fromEvent(e: Event): ViewTreeItem {
        let $el = <JQuery<HTMLElement>>$(e.currentTarget).closest(".file-entry");
        return new ViewTreeItem($el);

    }

    serialize(): string {
        return JSON.stringify({
            id: this.id,
            parentId: this.parentId,
            type: this.type,
            checked: this.checked
        })
    }
}
