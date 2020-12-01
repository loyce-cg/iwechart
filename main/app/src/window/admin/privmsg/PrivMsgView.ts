import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as sysMsgSummaryTemplate} from "./template/sys-msg-summary.html";
import {func as usersTemplate} from "./template/users.html";
import * as $ from "jquery";
import {AdminWindowView} from "../AdminWindowView";
import {SendResult, ProgressModel, Model, UsersInfo} from "./PrivMsgController";
import {ProgressViewContainer} from "../../../component/channel/ProgressViewContainer";

export class PrivMsgView extends BaseView<Model> {
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        this.menuModel = {
            id: "privmsg",
            priority: 300,
            groupId: "misc",
            icon: " privmx-icon privmx-icon-chat",
            labelKey: "window.admin.menu.privmsg"
        };
    }
    
    initTab(): void {
        this.$main.on("click", "[data-action=close-summary]", this.onCloseSummaryClick.bind(this));
        this.$main.on("click", "[data-action=send]", this.onSendSysMsgClick.bind(this));
        this.$main.on("click", "[data-action=choose-users]", this.onChooseUsers.bind(this));
    }
    
    renderContent(model: Model): void {
        super.renderContent(model);
        this.parent.personsComponent.refreshAvatars();
    }
    
    showSendSysMsgResults(results: SendResult[]): void {
        let $html = this.templateManager.createTemplate(sysMsgSummaryTemplate).renderToJQ(results);
        this.$main.append($html);
        this.parent.personsComponent.refreshAvatars();
    }
    
    removeSendSysMsgResults(): void {
        this.$main.find(".sys-msg-summary").remove();
    }
    
    onCloseSummaryClick(): void {
        this.removeSendSysMsgResults();
    }
    
    onSendSysMsgClick(event: Event): ProgressViewContainer {
        this.removeSendSysMsgResults();
        return this.triggerEventWithProgressCore("sendSysMsg", this.$main.find("[data-content]").val()).addButton($(<HTMLElement>event.target)).addNotifier(this.$main.find(".progress-info"), (progress: ProgressModel) => {
            return progress.type == "mail-info" ? this.helper.i18n("window.admin.privmsg.info", progress.i + 1, progress.size, progress.username) : false;
        });
    }
    
    onChooseUsers() {
        this.triggerEvent("chooseUsers");
    }
    
    updateUsers(model: UsersInfo) {
        this.$main.find(".users-container").empty().append(this.templateManager.createTemplate(usersTemplate).renderToJQ(model));
        this.parent.personsComponent.refreshAvatars();
    }
}
