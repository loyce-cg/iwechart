import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as entryTemplate} from "./template/entry.html";
import {func as emptyTemplate} from "./template/empty.html";
import {ExtListView} from "../../../component/extlist/ExtListView";
import {AutoRefreshView} from "../../../component/autorefresh/AutoRefreshView";
import {Scope} from "../../../web-utils/Scope";
import * as $ from "jquery";
import {AdminWindowView} from "../AdminWindowView";
import {Model, Cosigner} from "./TrustedController";

import * as Q from "q";

export interface ScopeData {
    error: boolean;
    hasEntriesToPublish: boolean;
    publishTrustedServerList: () => void;
}

export class TrustedView extends BaseView<Model> {
    
    entries: ExtListView<Cosigner>;
    scope: Scope<ScopeData>;
    entriesSize: AutoRefreshView<number>;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        this.menuModel = {
            id: "trusted",
            priority: 100,
            groupId: "security",
            icon: "certificate",
            labelKey: "window.admin.menu.trusted"
        };
        this.entries = this.addComponent("entries", new ExtListView(this, {
            template: entryTemplate,
            emptyTemplate: emptyTemplate
        }));
        this.entriesSize = this.addComponent("entriesSize", new AutoRefreshView(this, {
            template: (model: number) => "<span>" + model + "</span>"
        }));
    }
    
    init(model: Model): Q.IWhenable<void> {
        this.menuModel.indicator = model.hasEntriesToPublish ? 'fa-wrench' : null;
        this.parent.refreshMenuEntry(this.menuModel);
        return super.init(model);
    }
    
    initTab(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.$main.on("click", "[data-action='delete-domain']", this.onDeleteDomainClick.bind(this));
            this.$main.on("click", "[data-action='accept-domain']", this.onAcceptDomainClick.bind(this));
            this.$main.on("click", "[data-action='add-domain']", this.onAddDomainClick.bind(this));
            this.$main.on("click", "[data-action='verify-domain']", this.onVerifyDomainClick.bind(this));
            this.$main.on("click", "[data-action='clear-domain-cache']", this.onClearDomainCacheClick.bind(this));

            this.$main.on("input", ".form input", this.onDomainInput.bind(this));
            this.$main.on("click", "[data-action='refresh-domains']", this.onRefreshDomainsClick.bind(this));
            this.scope = new Scope(this.$main, {
                error: false,
                hasEntriesToPublish: model.hasEntriesToPublish,
                publishTrustedServerList: this.onPublishTrustedServerListClick.bind(this)
            });
            this.entries.$container = this.$main.find("tbody");
            return this.entries.triggerInit();
        })
        .then(() => {
            this.entriesSize.$container = this.$main.find(".domains-count");
            return this.entriesSize.triggerInit();
        });
    }
    
    afterAddDomain(): void {
        this.scope.onChange();
    }
    
    afterRemoveDomain(): void {
        this.scope.onChange();
    }
    
    refreshToPublish(hasEntriesToPublish: boolean): void {
        this.scope.data.hasEntriesToPublish = hasEntriesToPublish;
        this.scope.onChange();
        this.menuModel.indicator = hasEntriesToPublish ? 'fa-wrench' : null;
        this.parent.refreshMenuEntry(this.menuModel);
    }
    
    onPublishTrustedServerListClick(e: Event): void {
        this.triggerEventWithProgress(e, "publish");
    }
    
    onDeleteDomainClick(e: Event): void {
        let domain = $(e.target).closest("[data-domain]").data("domain");
        this.triggerEventWithProgress(e, "deleteDomain", domain);
    }
    
    onAcceptDomainClick(e: Event): void {
        let domain = $(e.target).closest("[data-domain]").data("domain");
        this.triggerEventWithProgress(e, "acceptDomain", domain);
    }
    
    onRefreshDomainsClick(event: Event): void {
        this.triggerEventWithProgress(event, "refreshDomains");
    }
    
    onDomainInput(): void {
        this.scope.data.error = false;
        this.scope.onChange();
    }
    
    onAddDomainClick(): void {
        this.triggerEvent("addDomain");
    }

    onVerifyDomainClick(): void {
        this.triggerEvent("verifyDomain");
    }

    onClearDomainCacheClick(): void {
        this.triggerEvent("clearDomainCache");
    }

}
