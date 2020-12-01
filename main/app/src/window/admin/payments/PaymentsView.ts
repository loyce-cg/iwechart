import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {AdminWindowView} from "../AdminWindowView";
import {Model} from "./PaymentsController";
import * as $ from "jquery";

export class PaymentsView extends BaseView<Model> {
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "payments",
            priority: 600,
            groupId: "pay",
            icon: "usd",
            labelKey: "window.admin.menu.payments"
        };

    }

    initTab(): Q.Promise<void> {
        this.$main.on("click", "[data-action='open-cc']", this.onCCLinkClick.bind(this));
        return;
    }

    onCCLinkClick(event: Event): void {
        let orderId = $(event.currentTarget).closest("[data-order-id").data("order-id");
        this.triggerEvent("openControlCenter");
    }
}
