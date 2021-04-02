import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import * as Q from "q";
import {UploadServiceOptions} from "./UploadServiceWindowController";
import {app} from "../../Types";
import { Progress, FileToUploadStatus } from "../../app/common/uploadservice/UploadService";
import { UploadFileItem } from "./UploadServiceWindowController";
import { ExtListView } from "../../component/extlist/ExtListView";
import {func as filesListItemTemplate} from "./template/fileslist-item.html";
@WindowView
export class UploadServiceWindowView extends BaseWindowView<UploadServiceOptions> {
    
    options: UploadServiceOptions;
    $files: JQuery;
    $progressBar: JQuery;
    $progress: JQuery;
    $buttons: JQuery;
    $closeButton: JQuery;
    $cancellAllButton: JQuery;
    $completed: JQuery;
    filesList: ExtListView<UploadFileItem>;

    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: UploadServiceOptions): Q.Promise<void> {
        this.options = model;
        this.$main.on("click", "[data-action=open]", this.onOpenFileClick.bind(this));
        this.$main.on("click", "[data-action=cancel]", this.onCancelFileUploadClick.bind(this));
        this.$main.on("click", "[data-action=cancel-all]", this.onCancelAllUploadsClick.bind(this));
        this.$main.on("click", "[data-action=retry]", this.onRetryFileUploadClick.bind(this));
        this.$main.on("click", "[data-action=close]", this.onClose.bind(this));

        this.$files = this.$main.find(".files");
        this.$progressBar = this.$main.find(".progress-indicator");
        this.$progress = this.$progressBar.find(".percent");
        this.$buttons = this.$main.find(".buttons");
        this.$closeButton = this.$buttons.find("[data-action=close]");
        this.$cancellAllButton = this.$buttons.find("[data-action=cancel-all]");
        this.$completed = this.$buttons.find(".completed");
        this.$files.pfScroll();

        this.filesList = this.addComponent("filesList", new ExtListView(this, {
            template: this.templateManager.createTemplate(filesListItemTemplate),
            onEmptyChange: () => {
                // this.$files.toggleClass("empty", this.filesList.empty.value);
            },
            onAfterListRender: () => {
               this.$files.find(".file-item").each((i, el) => {
                   this.setProgress(el);
               })
            },
        }));


        if (model.autoHeight) {
            let $content = this.$main.find(".content");
            let newHeight = $("body").outerHeight() - $content.outerHeight() + $content[0].scrollHeight;
            this.triggerEventInTheSameTick("setWindowHeight", Math.ceil(newHeight));
        }
        return Q().then(() => {
            this.filesList.$container = this.$files.find(".pf-content");
            return this.filesList.triggerInit();
        })
    }
        
    // onDataTriggerClick(event: MouseEvent): void {
    //     this.triggerEvent("action", $(event.target).closest("[data-trigger]").data("trigger"));
    // }
    

    setProgress(el: HTMLElement): void {
        
        // let $el = $(el);
        // let status = $el.data("progress-status");
        // let percent = status == "done" ? 100 : Math.round(Number($el.data("progress")));
        
        // let circle = <any>$el.find("circle")[0];
        // let radius = circle.r.baseVal.value;
        // let circumference = radius * 2 * Math.PI;

        // circle.style.strokeDasharray = `${circumference} ${circumference}`;
        // circle.style.strokeDashoffset = `${circumference}`;

        // const offset = circumference - percent / 100 * circumference;
        // circle.style.strokeDashoffset = offset;
  
    }

    updateTotalProgress(progress: number): void {
        const roundedProgress = Math.round(progress);
        const uploadsInProgress = roundedProgress < 100;

        this.$progress.text(roundedProgress + "%");
        this.$progressBar.toggleClass("hide", ! uploadsInProgress);
        this.$completed.toggleClass("hide", uploadsInProgress)
        this.$closeButton.toggleClass("hide", uploadsInProgress);
        this.$cancellAllButton.toggleClass("hide", ! uploadsInProgress);
    }

    onOpenFileClick(e: MouseEvent): void {
        this.triggerEvent("openFile", this.getFileIdByMouseEvent(e));
    }

    onCancelFileUploadClick(e: MouseEvent): void {
        this.triggerEvent("cancelFileUpload", this.getFileIdByMouseEvent(e));
    }

    onCancelAllUploadsClick(_e: MouseEvent): void {
        this.triggerEvent("cancelAllUploads");
    }

    onRetryFileUploadClick(e: MouseEvent): void {
        this.triggerEvent("retryFileUpload", this.getFileIdByMouseEvent(e));
    }

    getFileIdByMouseEvent(e: MouseEvent): number {
        return $(e.currentTarget).closest(".file-item").data("id");
    }
      
    
    onClose(): void {
        this.triggerEvent("close");
    }
}
