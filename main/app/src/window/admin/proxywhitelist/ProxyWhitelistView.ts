import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as entryTemplate} from "./template/entry.html";
import {func as emptyTemplate} from "./template/empty.html";
import {ExtListView} from "../../../component/extlist/ExtListView";
import * as $ from "jquery";
import {AdminWindowView} from "../AdminWindowView";
import {Model} from "./ProxyWhitelistController";
import {Entry} from "./ProxyWhitelistController";

export class ProxyWhitelistView extends BaseView<void> {
    
    proxywhitelist: ExtListView<Entry>;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        // console.log("view constr");
        this.menuModel = {
            id: "proxywhitelist",
            priority: 200,
            groupId: "users",
            hidden: true,
            icon: null,
            altIcon: "ico-teamserver blue",
            labelKey: "window.admin.menu.proxywhitelist"
        };
        this.proxywhitelist = this.addComponent("proxywhitelist", new ExtListView(this, {
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
        // console.log("init tab")
        this.$main.on("click", ".list-container .pf-switcher", this.onSwitcherClick.bind(this));
        this.$main.on("click", "[data-action='add-domain']", this.onAddDomainClick.bind(this));
        this.$main.on("click", "[data-action='delete-domain']", this.onDeleteDomainClick.bind(this));
        this.$main.on("click", "[data-action='change-acl']", this.onChangeAclClick.bind(this));

        this.proxywhitelist.$container = this.$main.find(".list-container");
        return this.proxywhitelist.triggerInit();
    }
    
    refreshContent(domain: string): void {
        this.$main.find(".panel-info").empty().append(this.helper.i18n("window.admin.proxywhitelist.info", [domain]));
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
        let id = $domain.data("id");
        let action = $option.data("action");
        let value = $option.data("value");
        // console.log("id", id , "clicked", action, value);
        this.triggerEventWithProgress(e, "setDomain", id, action, value);
    }
    
    onDeleteDomainClick(e: Event): void {
        let $domain = $(e.target).closest(".domain-entry");
        this.triggerEventWithProgress(e, "deleteDomain", $domain.data("id"));
    }

    onChangeAclClick(e: Event): void {
        // DISABLED IN CURRENT VERSION
        // let $domain = $(e.target).closest(".domain-entry");
        // this.triggerEventWithProgress(e, "changeAcl", $domain.data("id"));
    }
    
    
}
