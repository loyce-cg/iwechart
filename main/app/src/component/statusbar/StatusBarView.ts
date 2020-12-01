import {ComponentView} from "../base/ComponentView";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.component.statusbar.StatusBarView");
import {func as mainTemplate} from "./index.html";
import * as $ from "jquery";
import {AutoTaskModel} from "./StatusBarController";
import {webUtils} from "../../Types";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {app} from "../../Types";

export class StatusBarView extends ComponentView {
    
    mainTemplate: webUtils.MailTemplate<AutoTaskModel>;
    i18nPrefix: string;
    $container: JQuery;
    $backdrop: JQuery;
    
    constructor(parent: app.ViewParent, i18nPrefix?: string) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.i18nPrefix = i18nPrefix;
        this.$backdrop = $("<div>").css({
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "none"
        }).addClass("component-status-bar-backdrop");
        $("body").append(this.$backdrop);
    }
    
    init(model: AutoTaskModel): void {
        this.render(model);
    }
    
    render(model: AutoTaskModel): void {
        try {
            this.$container.content(this.mainTemplate.renderToJQ(model, this));
            if (!this.$backdrop) {
                return;
            }
            if (model && model.blockUI) {
                this.$backdrop.show();
                setTimeout(() => {
                    this.$backdrop.css("cursor", "wait");
                }, 1);
            }
            else {
                this.$backdrop.css("cursor", "default");
                setTimeout(() => {
                    this.$backdrop.hide();
                }, 1);
            }
        }
        catch (e) {
            if (e.name == "NS_ERROR_NOT_INITIALIZED") {
                Logger.debug("Firefox issue: NS_ERROR_NOT_INITIALIZED", e.stack);
            }
            else {
                Logger.error("render error", e, e.stack);
            }
        }
    }
    
    setProgress(progressData: any): void {
        this.$container.find("[data-display=progress]").text(this.formatProgress(progressData));
    }
    
    formatProgress(progress: any): string {
        if (typeof(progress) == "string") {
            if (progress.indexOf("code.") == 0) {
                let helper = this.templateManager.getHelperByClass(MailClientViewHelper);
                return helper.i18n((this.i18nPrefix ? this.i18nPrefix + "." : "") + progress.substring(5));
            }
            return progress;
        }
        else if (typeof(progress) == "object" && progress != null && progress.percent != null) {
            return progress.percent + "%";
        }
    }
}
