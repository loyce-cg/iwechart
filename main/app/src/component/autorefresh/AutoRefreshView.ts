import {ComponentView} from "../base/ComponentView";
import {Flex} from "../../web-utils/Flex";
import {Template} from "../../web-utils/template/Template";
import {webUtils} from "../../Types";
import {app} from "../../Types";

export interface Options<M, C, H> {
    template: webUtils.TemplateDefinition<M, C, H>;
    refreshFlex?: boolean;
    onAfterRender?: (model: M) => void;
    onBeforeRender?: (model: M) => void;
    context?: C;
}

export class AutoRefreshView<M, C = any, H = any> extends ComponentView {
    
    mainTemplate: Template<M, C, H>;
    $container: JQuery;
    refreshFlex: boolean;
    onAfterRender: (model: M) => void;
    onBeforeRender: (model: M) => void;
    context: C;
    
    constructor(parent: app.ViewParent, options: Options<M, C, H>) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(options.template);
        this.refreshFlex = options.refreshFlex;
        this.onAfterRender = options.onAfterRender;
        this.onBeforeRender = options.onBeforeRender;
        this.context = options.context;
    }
    
    init(model: M): void {
        this.render(model);
    }
    
    render(modelStr: string|M): void {
        let model = typeof(modelStr) == "string" ? JSON.parse(modelStr) : modelStr;
        if (this.onBeforeRender) {
            this.onBeforeRender(model);
        }
        this.$container.content(this.mainTemplate.renderToJQ(model, this.context));
        if (this.refreshFlex) {
            Flex.refreshFlex();
        }
        if (this.onAfterRender) {
            this.onAfterRender(model);
        }
    }
}
