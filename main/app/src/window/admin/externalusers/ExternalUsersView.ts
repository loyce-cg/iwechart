import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as userTemplate} from "./template/user.html";
import {ExtListView} from "../../../component/extlist/ExtListView";
import {AutoRefreshView} from "../../../component/autorefresh/AutoRefreshView";
import * as $ from "jquery";
import {AdminWindowView} from "../AdminWindowView";
import * as Q from "q";
import * as privfs from "privfs-client";

export class ExternalUsersView extends BaseView<void> {
    
    users: ExtListView<privfs.types.core.RawUserAdminData>;
    usersSize: AutoRefreshView<number>;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        this.menuModel = {
            id: "externalusers",
            priority: 100,
            groupId: "users",
            hidden: true,
            icon: "address-book-o",
            labelKey: "window.admin.menu.externalusers"
        };
        this.users = this.addComponent("users", new ExtListView(this, {
            template: userTemplate
        }));
        this.usersSize = this.addComponent("usersSize", new AutoRefreshView(this, {
            template: (model: number) => "<span>" + model + "</span>"
        }));
    }
    
    initTab(): Q.Promise<void> {
        return Q().then(() => {
            this.$main.on("click", "[data-action='add-user']", this.onAddUserClick.bind(this));
            this.$main.on("click", "[data-action='edit-user']", this.onEditUserClick.bind(this));
            this.$main.on("click", "[data-action='remove-user']", this.onRemoveUserClick.bind(this));
            this.$main.on("click", "[data-action='refresh-users']", this.onRefreshUsersClick.bind(this));
            this.$main.on("click", "[data-action='disable-2fa']", this.onDisable2FaClick.bind(this));
            this.$main.on("click", "[data-action='block-user']", this.onBlockUserClick.bind(this));
            this.$main.on("click", "[data-action='unblock-user']", this.onUnblockUserClick.bind(this));
            this.users.$container = this.$main.find("tbody");
            return this.users.triggerInit();
        })
        .then(() => {
            this.usersSize.$container = this.$main.find(".users-count");
            return this.usersSize.triggerInit();
        });
    }
    
    onRefreshUsersClick(event: Event): void {
        this.triggerEventWithProgress(event, "refreshUsers");
    }
    
    onAddUserClick(event: Event): void {
        this.triggerEvent("addUser");
    }
    
    onEditUserClick(event: Event): void {
        this.triggerEvent("editUser", $(event.currentTarget).data("username").toString());
    }
    
    onRemoveUserClick(event: Event): void {
        this.triggerEventWithProgress(event, "removeUser", $(event.currentTarget).data("username"));
    }

    onDisable2FaClick(e: Event): void {
        this.triggerEventWithProgress(e, "disable2Fa", $(e.currentTarget).closest("[data-username]").data("username"));
    }

    onBlockUserClick(e: Event): void {
        this.triggerEventWithProgress(e, "blockUser", $(e.currentTarget).closest("[data-username]").data("username"));
    }

    onUnblockUserClick(e: Event): void {
        this.triggerEventWithProgress(e, "unblockUser", $(e.currentTarget).closest("[data-username]").data("username"));
    }

    setAddUserButtonState(limitReached: boolean): void {
        this.$main.find("[data-action=add-user]").prop("disabled", limitReached);
    }

}
