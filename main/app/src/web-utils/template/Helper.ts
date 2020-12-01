import {Formatter} from "../../utils/Formatter";
import {TemplateManager} from "./Manager";
import {Template} from "./Template";
import {webUtils} from "../../Types";

export class Helper extends Formatter {
    
    manager: TemplateManager;
    
    constructor(manager: TemplateManager) {
        super();
        this.manager = manager;
    }
    
    registerTemplate<M, C, H>(id: string, func: webUtils.TemplateDefinition<M, C, H>): void {
        this.manager.registerTemplate(id, func);
    }
    
    createTemplate<M, C, H>(func: webUtils.TemplateDefinition<M, C, H>, helper?: H): Template<M, C, H> {
        return this.manager.createTemplate(func, helper);
    }
    
    createTemplateById<M, C, H>(templateId: string, helper?: H): Template<M, C, H> {
        return this.manager.createTemplateById(templateId, helper);
    }
    
    render<M, C, H>(id: string, model?: M, context?: C, helper?: H): string {
        return this.manager.render(id, model, context, helper);
    }
    
    renderToJQ<M, C, H>(id: string, model?: M, context?: C, helper?: H): JQuery {
        return this.manager.renderToJQ(id, model, context, helper);
    }
}
