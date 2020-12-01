import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.webutils.template.Manager");
import {Helper} from "./Helper";
import {Template} from "./Template";
import {Compiler} from "./Compiler";
import {webUtils} from "../../Types";

export class TemplateManager {
    
    compiled: {[id: string]: webUtils.TemplateDefinition<any, any, any>};
    defaultHelper: Helper;
    helpers: {[name: string]: Helper};
    registeredTemplates: {[id: string]: webUtils.TemplateDefinition<any, any, any>};
    
    constructor() {
        this.compiled = {};
        this.helpers = {};
        this.registeredTemplates = {};
        this.defaultHelper = new Helper(this);
    }
    
    registerHelper(helper: Helper): void {
        this.registerHelperByName(helper.className, helper);
    }
    
    registerHelperByName(name: string, helper: Helper): void {
        if (name in this.helpers) {
            throw new Error("Helper with name '" + name + "' already registered");
        }
        this.helpers[name] = helper;
    }
    
    getHelperByClass<H = Helper>(clazz: {new(...args: any[]): H}): H {
        return this.getHelper<H>(clazz.prototype.className);
    }
    
    getHelper<H = Helper>(name: string): H {
        if (!(name in this.helpers)) {
            throw new Error("Helper with name '" + name + "' is not registered");
        }
        return <H><any>this.helpers[name];
    }
    
    compile(code: string): Function {
        return Compiler.eval(code);
    }
    
    registerTemplate<M, C, H>(id: string, template: webUtils.TemplateDefinition<M, C, H>): void {
        this.compiled[id] = template;
    }
    
    resolveHelper<H>(definition: webUtils.HelperDefinition<H>, helper: H): H {
        if (helper) {
            return helper;
        }
        if (definition) {
            if (typeof(definition) == "string") {
                return this.getHelper<H>(definition);
            }
            return this.getHelperByClass<H>(<any>definition);
        }
        return <H><any>this.defaultHelper;
    }
    
    resolveTemplateDefinition<M, C, H>(definition: webUtils.TemplateDefinition<M, C, H>, id: string, helper: H): Template<M, C, H> {
        if (definition instanceof Template) {
            return definition;
        }
        else if (typeof(definition) == "function") {
            return new Template<M, C, H>(id, definition, this.resolveHelper<H>(null, helper));
        }
        return new Template<M, C, H>(id, definition.func, this.resolveHelper<H>(definition.helper, helper));
    }
    
    get<M, C, H>(id: string): Template<M, C, H> {
        let compiled = this.compiled[id];
        if (compiled == null) {
            return null;
        }
        return this.resolveTemplateDefinition(this.compiled[id], id, null);
    }
    
    createTemplate<M, C, H>(template: webUtils.TemplateDefinition<M, C, H>, helper?: H): Template<M, C, H> {
        return this.resolveTemplateDefinition(template, null, helper);
    }
    
    createTemplateById<M, C, H>(templateId: string, helper?: H): Template<M, C, H> {
        if (!(templateId in this.registeredTemplates)) {
            throw new Error("Template with id " + templateId + " does not exist");
        }
        return this.createTemplate(this.registeredTemplates[templateId], helper);
    }
    
    getTemplate<M, C, H>(id: string, helper?: H): Template<M, C, H> {
        Logger.debug("getTemplate", id);
        let compiled = this.compiled[id];
        if (compiled == null) {
            return null;
        }
        return this.resolveTemplateDefinition(this.compiled[id], id, helper);
    }
    
    getTemplateWithCheck<M, C, H>(id: string, helper?: H): Template<M, C, H> {
        let template = this.getTemplate<M, C, H>(id, helper);
        if (template == null) {
            throw new Error("Cannot find template with name '" + id + "'");
        }
        return template;
    }
    
    createTemplateFromHtmlElement<M, C, H>($ele: JQuery): Template<M, C, H> {
        return new Template<M, C, H>(null, <any>this.compile($ele.html()), this.resolveHelper<H>(null, null));
    }
    
    renderToJQFromHtmlElement($ele: JQuery, model?: any, context?: any, helper?: Helper) {
        return this.createTemplateFromHtmlElement($ele).renderToJQ(model, context, helper);
    }
    
    render<M, C, H>(id: string, model?: M, context?: C, helper?: H): string {
        Logger.debug("render", id, model);
        return this.getTemplateWithCheck<M, C, H>(id).render(model, context, helper);
    }
    
    renderToJQ<M, C, H>(id: string, model?: M, context?: C, helper?: H): JQuery {
        Logger.debug("renderToJQ", id, model);
        return this.getTemplateWithCheck<M, C, H>(id).renderToJQ(model, context, helper);
    }
}
