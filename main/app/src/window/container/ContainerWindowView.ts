import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as autoUpdateStatusTemplate} from "./template/auto-update-status.html";
import {func as loadingScreenTemplate} from "./template/loading-screen.html";
import {func as initializingScreenTemplate} from "./template/initializing-screen.html";
import {StatusBarMainView} from "../../component/statusbarmain/StatusBarMainView";
import {AutoRefreshView} from "../../component/autorefresh/AutoRefreshView";
import {Model} from "./ContainerWindowController";
import {app} from "../../Types";
import * as $ from "jquery";
import * as Q from "q";
import { UpdateNotificationView } from "../../component/updatenotification/UpdateNotificationView";

@WindowView
export class ContainerWindowView extends BaseWindowView<Model> {
    
    statusBarMain: StatusBarMainView;
    autoUpdateStatus: AutoRefreshView<app.AutoUpdateStatusData>;
    updateNotification: UpdateNotificationView;
    $active: JQuery;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.statusBarMain = this.addComponent("statusBarMain", new StatusBarMainView(this));
        
        this.updateNotification = this.addComponent("updatenotifications", new UpdateNotificationView(this));
        this.autoUpdateStatus = this.addComponent("autoUpdateStatus", new AutoRefreshView(this, {template: autoUpdateStatusTemplate}));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q().then(() => {
            if (model.isElectronApp) {
                this.updateNotification.$container = this.$main.find(".update-notification");
                return this.updateNotification.triggerInit();
            }
            else {
                return;
            }
        })
        .then(() => {
            if (model.showStatusBar) {
                this.statusBarMain.$container = $(".current-tasks-info");
                return this.statusBarMain.triggerInit();
            }
        })
        .then(() => {
            if (model.showAutoUpdateStatus) {
                this.autoUpdateStatus.$container = this.$main.find(".auto-update-status-container");
                return this.autoUpdateStatus.triggerInit();
            }
        })
    }
    
    openIframe(id: number, load: app.WindowLoadOptions): void {
        this.showLoading();
        if (this.$active) {
            this.$active.removeClass("active");
            this.$active = null;
        }
        this.$active = $('<div id="iframe-' + id + '" class="iframe-container active"></div>');
        this.$main.find(".windows-container").append(this.$active);
        this.viewManager.parent.registerDockedWindow(id, load, this.$active[0]);
    }
    
    showIframe(id: number, load: app.WindowLoadOptions): void {
        let $iframe = this.$main.find(".windows-container .iframe-container#iframe-" + id);
        if ($iframe.length == 0) {
            this.openIframe(id, load);
        }
        else if (!$iframe.is(this.$active)) {
            if (this.$active) {
                this.$active.removeClass("active");
            }
            $iframe.addClass("active");
            this.$active = $iframe;
        }
    }
    
    destroyIframe(id: number): void {
        let $iframe = this.$main.find(".windows-container .iframe-container#iframe-" + id);
        if ($iframe.is(this.$active)) {
            this.showLoading();
            this.$active = null;
        }
        $iframe.remove();
    }
    
    focusIframe(id: number): void {
        let $iframe = this.$main.find(".windows-container .iframe-container#iframe-" + id + " iframe");
        (<HTMLIFrameElement>$iframe[0]).contentWindow.focus();
    }
    
    showLoading(): void {
        this.$main.append(this.templateManager.createTemplate(loadingScreenTemplate).renderToJQ());
    }
    
    hideLoading(): void {
        this.$main.find(".window-loading-screen").remove();
    }

    showInitializing(): void {
        this.$main.append(this.templateManager.createTemplate(initializingScreenTemplate).renderToJQ());
    }
    
    hideInitializing(): void {
        this.$main.find(".window-initializing-screen").remove();
    }

    cleanWindowsContainer(): void {
        this.$main.find(".windows-container").empty();
    }
}
