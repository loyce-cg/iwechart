import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as entryTemplate} from "./template/entry.html";
import {func as emptyTemplate} from "./template/empty.html";
import {ExtListView} from "../../../component/extlist/ExtListView";
import {Scope} from "../../../web-utils/Scope";
import * as $ from "jquery";
import {AdminWindowView} from "../AdminWindowView";
import {Entry, Model} from "./BlacklistController";

export class BlacklistView extends BaseView<void> {
    
    blacklist: ExtListView<Entry>;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        this.menuModel = {
            id: "blacklist",
            priority: 200,
            groupId: "security",
            icon: "hand-stop-o",
            labelKey: "window.admin.menu.blacklist"
        };
        this.blacklist = this.addComponent("blacklist", new ExtListView(this, {
            template: entryTemplate,
            emptyTemplate: emptyTemplate,
            onAfterListRender: list => {
                let $prev: JQuery = null;
                list.$container.find("tr").removeClass("lim-top lim-bottom").each((i, e) => {
                    let $e = $(e);
                    if ($prev != null && $e.hasClass("with-mode") && !$prev.hasClass("with-mode")) {
                        $prev.addClass("lim-bottom");
                        $e.addClass("lim-top");
                        return false;
                    }
                    $prev = $e;
                });
            }
        }));
    }
    
    init(model: Model): Q.IWhenable<void> {
        this.menuModel.indicator = model.todo ? 'fa-wrench' : null;
        this.parent.refreshMenuEntry(this.menuModel);
        return super.init(model);
    }
    
    initTab(): Q.Promise<void> {
        this.$main.on("click", ".list-container .pf-switcher", this.onSwitcherClick.bind(this));
        this.$main.on("click", "[data-action='add-domain']", this.onAddDomainClick.bind(this));
        this.$main.on("click", "[data-action='delete-domain']", this.onDeleteDomainClick.bind(this));
        this.blacklist.$container = this.$main.find(".list-container");
        return this.blacklist.triggerInit();
    }
    
    refreshContent(): void {
    }
    
    refreshToDo(todo: boolean): void {
        this.menuModel.indicator = todo ? 'fa-wrench' : null;
        this.parent.refreshMenuEntry(this.menuModel);
    }
    
    onAddDomainClick(): void {
        this.triggerEvent("addDomain");
    }
    
    onSwitcherClick(e: Event): void {
        let $option = $(e.target).closest(".option");
        let $domain = $option.closest(".domain-entry");
        this.triggerEventWithProgress(e, "setDomain", $domain.data("domain"), $option.data("mode"));
    }
    
    onDeleteDomainClick(e: Event): void {
        let $domain = $(e.target).closest(".domain-entry");
        this.triggerEventWithProgress(e, "deleteDomain", $domain.data("domain"));
    }
}
