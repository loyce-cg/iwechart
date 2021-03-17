import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model} from "./ErrorWindowController";
import * as Q from "q";
import {app} from "../../Types";
import { KEY_CODES } from "../../web-utils/UI";
import { NotificationView } from "../../component/notification/NotificationView";

@WindowView
export class ErrorWindowView extends BaseWindowView<Model> {
    
    protected notifications: NotificationView;
    protected model: Model;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.notifications = this.addComponent("notifications", new NotificationView(this));
    }
    

    initWindow(model: Model): Q.Promise<void> {
        this.model = model;
        return Q()
        .then(() => {
            this.$main.on("click", "a", this.onLinkClick.bind(this));
            this.$main.on("click", "[data-action=send]", this.onSendClick.bind(this));
            this.$main.on("click", "[data-action=dontSend]", this.onDontSendClick.bind(this));
            this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
            this.$main.on("click", "[data-action=toggle-report-option]", this.onToggleReportOptionClick.bind(this));
            this.$main.on("click", "input[name=errorsLoggingEnabled]", this.onErrorsLoggingSwitchClick.bind(this))
            this.$main.on("click", "[data-copy-textarea-id]", (e: Event) => this.helper.onTextAreaCopyClick(<MouseEvent>e));
            this.$main.on("click", "[data-action=show-full-report]", this.onShowFullReport.bind(this));
            $(document).on("keydown", this.onKeyDown.bind(this));
            this.notifications.$container = this.$main.find(".notifications-container");
            return Q.all([
                this.notifications.triggerInit(),
            ]);
        }).thenResolve(null);
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", (<HTMLAnchorElement>event.currentTarget).href);
    }
    
    onSendClick(): void {
        let includeErrorLog: boolean = this.$main.find("[data-report-option=include-error-log] .switch").is(".active");
        let includeSystemInformation: boolean = this.$main.find("[data-report-option=include-system-information] .switch").is(".active");
        this.triggerEvent("send", includeErrorLog, includeSystemInformation);
    }
    
    onDontSendClick(): void {
        this.triggerEvent("dontSend");
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onToggleReportOptionClick(e: MouseEvent): void {
        let $optionContainer = $(e.currentTarget).closest("[data-report-option]");
        $optionContainer.find(".switch").toggleClass("active");
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.keyCode == KEY_CODES.escape) {
            if (this.model.error.askToReport) {
                this.triggerEvent("dontSend");
            }
            else {
                this.triggerEvent("close");
            }
        }
        else if (e.keyCode == KEY_CODES.enter) {
            if (this.model.error.askToReport) {
                this.triggerEvent("send");
            }
            else {
                this.triggerEvent("close");
            }
        }
    }

    onUpdateErrorsLoggingEnabled(enabled: boolean): void {
        this.$main.find("input[name=errorsLoggingEnabled]").prop("checked", enabled);
    }

    onErrorsLoggingSwitchClick(event: MouseEvent): void {
        let checked = this.$main.find("input[name=errorsLoggingEnabled]").prop("checked");
        this.triggerEvent("errorsLoggingEnabled", checked);
    }

    onShowFullReport(): void {
        this.triggerEvent("showFullReport");
    }
    
}
