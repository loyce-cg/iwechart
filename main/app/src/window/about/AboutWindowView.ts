import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {ComponentView} from "../../component/base/ComponentView";
import {StatusBarView} from "../../component/statusbar/StatusBarView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Lang} from "../../utils/Lang";
import {Model} from "./AboutWindowController";
import * as Q from "q";
import {app} from "../../Types";
import { KEY_CODES } from "../../web-utils/UI";

@WindowView
export class AboutWindowView extends BaseWindowView<Model> {
    $updates: JQuery;
    $updatesInProgress: JQuery;
    $checkForUpdate: JQuery;
    $checkingForUpdate: JQuery;
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q.all(Lang.getValues(this.components).map(component => {
            return !(component instanceof StatusBarView) && component instanceof ComponentView ? component.triggerInit() : null;
        }))
        .then(() => {
            this.$main.on("click", "a", this.onLinkClick.bind(this));
            this.$main.on("click", "[data-action='close']", this.onCloseClick.bind(this));
            this.$main.on("click", "[data-action='download-desktop']", this.onDownloadDesktopClick.bind(this));
            this.$main.on("click", "[data-action='feedback']", this.onFeedbackClick.bind(this));
            this.$main.on("click", "[data-action-id]", this.onUpdateActionClick.bind(this));
            this.$main.on("click", "[data-action='show-licence']", this.onShowLicenceClick.bind(this));
            this.$updates = this.$main.find(".updates");
            this.$updatesInProgress = this.$main.find(".updates-in-progress");
            this.$checkForUpdate = this.$main.find(".check-for-update");
            this.$checkingForUpdate = this.$main.find(".checking-for-update");
            this.bindKeyPresses();
            this.triggerEventInTheSameTick("setWindowHeight", Math.ceil(this.$main.outerHeight()));
        });
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", (<HTMLAnchorElement>event.currentTarget).href);
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onDownloadDesktopClick(): void {
        this.triggerEventInTheSameTick("downloadDesktop");
    }
    
    onFeedbackClick(): void {
        this.triggerEventInTheSameTick("feedback");
    }
    
    onUpdateActionClick(e: MouseEvent): void {
        let action = $(e.currentTarget).closest("[data-action-id]").data("action-id");
        this.setUpdateStatus("checking");
        this.triggerEvent("updateAction", action);

        if (action == "check-for-update") {
            this.$checkForUpdate.addClass("hidden");
            this.$checkingForUpdate.removeClass("hidden");
        }
    }
    
    setUpdateStatus(status: string): void {
        this.$updates.toggleClass("hide", !(status == "available" || status == "readyToInstall"));
        this.$updatesInProgress.toggleClass("hide", status == "available" || status == "readyToInstall");
        
        this.$updates.children("span").toggleClass("hide", true);
        this.$updatesInProgress.children("span").toggleClass("hide", true);
        this.$updates.find("." + status).toggleClass("hide", false);
        this.$updatesInProgress.find("." + status).toggleClass("hide", false);
    }
    
    setDownloadProgress(progress: number): void {
        this.$updatesInProgress.find(".download-progress").text(progress + "%");
    }

    redraw(modelStr: string): void {
        let model = JSON.parse(modelStr);
        let $rendered = this.templateManager.createTemplate(mainTemplate).renderToJQ(model).content();
        this.$main.find("div.info").html($rendered.find("div.info").html());
        this.$updates = this.$main.find(".updates");
        this.$updatesInProgress = this.$main.find(".updates-in-progress");
        this.$checkForUpdate = this.$main.find(".check-for-update");
        this.$checkingForUpdate = this.$main.find(".checking-for-update");
    }
    
    bindKeyPresses(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == KEY_CODES.r && e.altKey && e.shiftKey && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.onRevertAction();
            }
        });
    }

    onRevertAction(): void {
        this.triggerEvent("performRevert");
    }
    
    onShowLicenceClick(): void {
        this.triggerEvent("showLicence");
    }
}
