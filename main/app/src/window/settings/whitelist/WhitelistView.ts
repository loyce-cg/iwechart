import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as whitelistEntryTemplate} from "./template/section-whitelist-entry.html";
import {func as sectionWhitelistMessagesTemplate} from "./template/section-whitelist-messages.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {WhiteListEntry, Model, LastMessagesModel} from "./WhitelistController";
import {ExtListView} from "../../../component/extlist/ExtListView";
import * as $ from "jquery";
import {FilterMode} from "../../../mail/FilterMode";
import {Dropdown} from "../../../component/dropdown/Dropdown";

export class WhitelistView extends BaseView<Model> {
    
    whitelist: ExtListView<WhiteListEntry>;
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "whitelist",
            priority: 200,
            groupId: "misc",
            icon: "filter",
            labelKey: "window.settings.menu.item.whitelist.label"
        };
        this.whitelist = this.addComponent("whitelist", new ExtListView(this, {
            template: whitelistEntryTemplate
        }));
    }
    
    initTab(model?: Model): Q.Promise<void> {
        this.$main.on("click", ".whitelist-section table .switch", this.onSwitcherClick.bind(this));
        this.$main.on("click", "[data-action=whitelist-delete]", this.onWhitelistDelete.bind(this));
        this.$main.on("click", "[data-action=whitelist-suggest]", this.onWhitelistSuggest.bind(this));
        this.$main.on("click", "[data-action=whitelist-show-last-messages]", this.onWhitelistShowLastMessages.bind(this));
        this.whitelist.$container = $("<tbody></tbody>");
        return this.whitelist.triggerInit();
    }
    
    afterRenderContent() {
        this.$main.find("table").append(this.whitelist.$container);
    }
    
    whitelistShowLastMessages(model: LastMessagesModel): void {
        new Dropdown({
            model: model,
            template: this.templateManager.createTemplate(sectionWhitelistMessagesTemplate),
            $container: this.$main.find(".domain-entry[data-domain='" + model.domain + "'] [data-action=whitelist-show-last-messages]"),
            templateManager: this.templateManager
        });
    }
    
    onWhitelistAllow(e: Event): void {
        let domain = $(e.target).closest(".domain-entry").data("domain");
        this.triggerEvent("whitelistSetDomainMode", domain, FilterMode.ALLOW);
    }
    
    onSwitcherClick(e: Event): void {
        let $option = $(e.target).closest(".switch");
        let $domain = $option.closest(".domain-entry");
        this.triggerEvent("whitelistSetDomainMode", $domain.data("domain"), parseInt($option.data("mode")));
    }
    
    onWhitelistDelete(e: Event): void {
        let domain = $(e.target).closest(".domain-entry").data("domain");
        this.triggerEvent("whitelistDeleteDomain", domain);
    }
    
    onWhitelistSuggest(e: Event): void {
        let domain = $(e.target).closest(".domain-entry").data("domain");
        this.triggerEvent("whitelistSuggestBlacklist", domain);
    }
    
    onWhitelistShowLastMessages(e: Event): void {
        let domain = $(e.target).closest(".domain-entry").data("domain");
        this.triggerEvent("whitelistShowLastMessages", domain, 5);
    }
}
