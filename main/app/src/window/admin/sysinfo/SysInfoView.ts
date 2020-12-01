import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {AdminWindowView} from "../AdminWindowView";
import {Model} from "./SysInfoController";
import * as $ from "jquery";

export class SysInfoView extends BaseView<Model> {
    
    $deletingDemoContent: JQuery = null;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "sysinfo",
            priority: 100,
            groupId: "info",
            icon: "info",
            labelKey: "window.admin.menu.sysinfo"
        };

    }

    initTab(): Q.Promise<void> {
        this.$main.on("click", "[data-action='open-cc']", this.onCCLinkClick.bind(this));
        this.$main.on("click", "[data-action='delete-demo-content']", this.onDeleteDemoContentClick.bind(this));
        return;
    }

    onCCLinkClick(): void {
        this.triggerEvent("openControlCenter");
    }
    
    onDeleteDemoContentClick(): void {
        this.triggerEvent("deleteDemoContent");
    }
    
    updateDeleteDemoContentProgress(done: number, total: number): void {
        if (total == 0) {
            let $cont = this.$main.find("[data-action='delete-demo-content']").parent();
            let $el = $("<div class='delete-demo-content-progress'>" + this.helper.escapeHtml(this.helper.i18n("window.admin.sysinfo.deleteDemoContent.progress0")) + "</div>");
            $cont.append($el);
            this.$deletingDemoContent = $el;
        }
        else if (done == total) {
            this.$main.find("[data-action='delete-demo-content']").remove();
            this.$deletingDemoContent.remove();
            this.$deletingDemoContent = null;
        }
        else if (this.$deletingDemoContent) {
            this.$deletingDemoContent.text(this.helper.i18n("window.admin.sysinfo.deleteDemoContent.progress", done, total));
        }
    }
    
}
