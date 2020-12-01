import {ComponentView} from "../../component/base/ComponentView";
import {func as mainTemplate} from "./template/tab-container.html";
import {ProgressViewContainer} from "../../component/channel/ProgressViewContainer";
import * as $ from "jquery";
import {webUtils} from "../../Types";
import {AdminWindowView} from "./AdminWindowView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";

export interface MenuModel {
    id: string;
    priority: number;
    groupId: string;
    icon: string;
    altIcon?: string;
    label?: string;
    labelKey: string;
    indicator?: string;
    hidden?: boolean;
}

export class BaseView<T> extends ComponentView {
    
    parent: AdminWindowView;
    helper: MailClientViewHelper;
    contentTemplate: webUtils.MailTemplateDefinition<T>;
    instantContentRender: boolean;
    menuModel: MenuModel;
    $main: JQuery;
    
    constructor(parent: AdminWindowView, contentTemplate: webUtils.MailTemplateDefinition<T>, instantContentRender?: boolean) {
        super(parent);
        this.helper = this.parent.helper;
        this.contentTemplate = contentTemplate;
        this.instantContentRender = instantContentRender;
    }
    
    init(model?: any): Q.IWhenable<void> {
        this.$main = this.templateManager.createTemplate(mainTemplate).renderToJQ(this.menuModel.id);
        if (this.instantContentRender) {
            this.renderContent(null);
        }
        return this.initTab(model);
    }
    
    initTab(model?: any): Q.IWhenable<void> {
    }
    
    renderContent(model: T): void {
        if (this.contentTemplate != null) {
            this.$main.content(this.templateManager.createTemplate(this.contentTemplate).renderToJQ(model));
        }
    }
    
    triggerEventWithProgress(event: Event, ...args: any[]): ProgressViewContainer {
        return this.triggerEventWithProgressCore.apply(this, Array.prototype.slice.call(arguments, 1))
            .addButton($(event.target).closest("button"));
    }
    
    triggerEventWithProgressCore(name: string, ...argsArg: any[]): ProgressViewContainer {
        let progress = new ProgressViewContainer(this.parent);
        let args = [name, progress.id].concat(Array.prototype.slice.call(arguments, 1));
        this.triggerEvent.apply(this, args);
        return progress;
    }
}
