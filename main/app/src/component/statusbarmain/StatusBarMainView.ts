import {ComponentView} from "../base/ComponentView";
import {app} from "../../Types";

export class StatusBarMainView extends ComponentView {
    
    $container: JQuery;
    
    constructor(parent: app.ViewParent) {
        super(parent);
    }
    
    showTasksInfo(info: string, important: boolean): void {
        if (important) {
            this.$container.addClass("important");
        }
        else {
            this.$container.removeClass("important");
        }
        if (!this.$container.find(".fa").length) {
            this.$container.prepend("<i class='fa fa-circle-o-notch fa-spin'></i>");
        }
        this.$container.find(".info").text(info);
        this.$container.show();
    }
    
    hideTasksInfo(): void {
        this.$container.find(".fa").remove();
        this.$container.hide().find(".info").text("");
    }
}
