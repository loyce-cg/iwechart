import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as loadingTemplate} from "../../component/template/loading.html";
import {Model} from "./EditorWindowController";
import {app, webUtils} from "../../Types";
import {WebUtils} from "../../web-utils/WebUtils";
import {NotificationView} from "../../component/notification/NotificationView";
import * as Q from "q";
import {ButtonsState} from "../../component/editorbuttons/EditorButtonsController";
import {EditorButtonsView} from "../../component/editorbuttons/EditorButtonsView";

@WindowView
export class EditorWindowView<T = app.BlobData> extends BaseWindowView<Model> {
    
    currentViewId: number;
    $inner: JQuery;
    editorButtons: EditorButtonsView;
    notifications: NotificationView;
    currentDataUrl: string;
    previewMode: boolean;
    printMode: boolean;
        
    constructor(parent: app.ViewParent, template?: webUtils.MailTemplateDefinition<Model>) {
        super(parent, template || mainTemplate);
        this.notifications = this.addComponent("notifications", new NotificationView(this));
        this.editorButtons = this.addComponent("editorbuttons", new EditorButtonsView(this));
    }
    
    initWindow(model: Model) {
        return Q().then(() => {
            this.currentViewId = model.currentViewId;
            this.previewMode = model.previewMode;
            this.printMode = model.printMode;
            this.$inner = this.$main.find(".inner");
            this.editorButtons.$main = this.$main;
            this.editorButtons.$container = this.getButtonsContainer();
            this.notifications.$container = this.$main.find(".notifications");
            this.$html.toggleClass("print-mode", model.printMode);
            this.$main.on("click", this.onFocusedIn.bind(this));
            this.$main.closest("html").toggleClass("print-mode", this.printMode);
            
            return Q.all([
                this.editorButtons.triggerInit(),
                this.notifications.triggerInit()
            ]);
        })
        .then(() => {
            this.onInitWindow();
            this.bindTabSwitch();
            this.bindEnterPressed();
            this.clearState(true);
            
        });
    }
    
    onInitWindow(): void {
    }
    
    reopen(currentViewId: number): void {
        this.currentViewId = currentViewId;
        if (this.loaded) {
            this.clearState(true);
            this.triggerEvent("load");
        }
    }
    
    release(currentViewId: number): void {
        this.currentViewId = currentViewId;
        this.clearState(false);
    }
    
    clearState(addLoading: boolean) {
        this.clearLoading();
        if (addLoading) {
            this.getLoadingContainer().append(this.templateManager.createTemplate(loadingTemplate).renderToJQ());
        }
    }
    
    getLoadingContainer(): JQuery {
        return this.$inner;
    }
    
    getButtonsContainer(): JQuery {
        return this.$inner;
    }
    
    clearLoading(): void {
        this.$main.find(".screen-loading").remove();
    }
    
    getResourceDataUrl(data: app.BlobData): string {
        if (this.currentDataUrl) {
            URL.revokeObjectURL(this.currentDataUrl);
        }
        return this.currentDataUrl = WebUtils.createObjectURL(data);
    }
    
    setData(currentViewId: number, data: T, buttonsState: ButtonsState): void {
        if (window == null || currentViewId != this.currentViewId) {
            return;
        }
        this.editorButtons.setButtonsState(buttonsState);
        this.setDataCore(currentViewId, data);
    }
    
    setDataCore(_currentViewId: number, _data: T) {
    }
    
    setProgress(currentViewId: number, progress: {percent: number}): void {
        if (window == null || currentViewId != this.currentViewId) {
            return;
        }
        this.$main.find(".screen-loading-progress-text").html(progress.percent + "%");
    }
    
    onFocusedIn(): void {
        this.triggerEvent("focusedIn");
    }
    
    setPrintHeader(printHeader: string): void {
        printHeader = this.helper.escapeHtml(printHeader);
        this.$inner.closest(".window-editor-main").prepend(`<div class="print-header">${printHeader}</div>`);
    }
    
}
