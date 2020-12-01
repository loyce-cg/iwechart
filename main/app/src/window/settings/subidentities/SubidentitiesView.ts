import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as listTemplate} from "./template/list.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./SubidentitiesController";
import * as Q from "q";
import * as $ from "jquery";
import {IUserService} from "../../../common/service/IUserService";
import {UI} from "../../../web-utils/UI";
import {subidentity} from "../../../Types";

export class SubidentitiesView extends BaseView<Model> {
    
    userService: IUserService;
    currentSubidentities: subidentity.SubidentitiesPriv;
    refreshPromise: Q.Promise<void>;
    host: string;
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.userService = this.parent.viewManager.getService<IUserService>("userService");
        this.menuModel = {
            id: "subidentities",
            priority: 250,
            groupId: "account",
            icon: "users",
            labelKey: "window.settings.menu.item.subidentities.label"
        };
    }
    
    initTab(): void {
        this.$main.on("click", "[data-action=remove]", this.onRemoveClick.bind(this));
        this.$main.on("click", "[data-action=refresh]", this.onRefreshClick.bind(this));
        this.$main.on("click", "[data-action=mnemonic]", this.onMnemonicClick.bind(this));
    }
    
    renderContent(model: Model) {
        super.renderContent(model);
        this.host = model.host;
    }
    
    activate() {
        return this.refresh();
    }
    
    refresh() {
        return Q().then(() => {
            return this.userService.getSubidentities();
        })
        .then(subidentities => {
            this.currentSubidentities = subidentities;
            this.$main.find(".list-container").empty().append(this.templateManager.createTemplate(listTemplate).renderToJQ(subidentities));
        })
        .fail(this.parent.onErrorCallback);
    }
    
    onRemoveClick(e: MouseEvent) {
        let $btn = <JQuery>$(e.target).closest("[data-action=remove]");
        let $icon = $btn.find("i");
        let $subId = $btn.closest("[data-sub-id]");
        let id = $subId.data("sub-id");
        this.parent.msgBox.confirm().then(result => {
            if (result.result != "yes") {
                return;
            }
            let loading = UI.faIconLoading($icon);
            return Q().then(() => {
                return this.userService.removeSubidentity(id);
            })
            .then(() => {
                $subId.remove();
                if (this.$main.find(".entry").length == 0) {
                    this.$main.find(".empty-info").removeClass("hide");
                }
            })
            .fail(e => {
                loading();
                this.parent.onError(e);
            });
        });
    }
    
    onRefreshClick() {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }
        let $btn = this.$main.find("[data-action=refresh]");
        let loading = UI.btnLoading($btn, this.parent.i18n("core.button.refreshing.label"), () => {
            this.refreshPromise = null;
        }, 500);
        this.refreshPromise = this.refresh().fin(() => {
            loading();
        });
    }
    
    onMnemonicClick(e: MouseEvent) {
        let id = $(e.target).closest("[data-sub-id]").data("sub-id");
        let entry = this.currentSubidentities ? this.currentSubidentities[id] : null;
        if (!entry) {
            return;
        }
        this.parent.msgBox.subId({
            host: this.host,
            mnemonic: entry.bip39Mnemonic
        });
    }
}
