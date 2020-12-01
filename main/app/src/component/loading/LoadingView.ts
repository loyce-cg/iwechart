import * as $ from "jquery";
import { ComponentView } from "../base/ComponentView";
import * as Types from "../../Types";
import { MailClientViewHelper } from "../../web-utils";
import { func as mainTemplate } from "./template/index.html";

export interface LoadingOptions {
    showDelay?: number;
}

export class LoadingView extends ComponentView {
    
    static defaultOptions: LoadingOptions = {
        showDelay: 150,
    };
    options: LoadingOptions;
    $container: JQuery;
    $component: JQuery;
    helper: MailClientViewHelper;
    showTimeout: number;
    hideTimeout: NodeJS.Timer;
    isLoadingVisible: boolean = false;
    
    constructor(public parent: Types.app.ViewParent, options?: LoadingOptions) {
        super(parent);
        this.helper = this.templateManager.getHelperByClass(MailClientViewHelper);
        this.options = $.extend({}, LoadingView.defaultOptions, options || {});
    }
    
    init() {
        if (this.$container.hasClass("loading-component-initialized")) {
            return;
        }
        this.$container.addClass("loading-component-initialized");
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ();
        this.$container.append(this.$component);
    }
    
    onStartLoading(): void {
        if (this.showTimeout) {
            return;
        }
        this.showTimeout = <any>setTimeout(() => {
            this.showLoading();
        }, this.options.showDelay);
    }
    
    onFinishedLoading(): void {
        this.hideLoading();
    }
    
    clearShowTimeout(): void {
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
    }
    
    showLoading(): void {
        this.toggleLoading(true);
    }
    
    hideLoading(): void {
        this.toggleLoading(false);
    }

    hideLoadingWithDelay(delayMs: number): void {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = setTimeout(() => this.hideLoading(), delayMs);
    }
    
    toggleLoading(visible: boolean): void {
        if (visible == false) {
            this.clearShowTimeout();
        }
        if (!this.$component) {
            return;
        }
        this.$component.toggleClass("visible", visible);
        this.$component.find(".fa.loading-spinner").toggleClass("fa-spin", visible);
    }
    
}