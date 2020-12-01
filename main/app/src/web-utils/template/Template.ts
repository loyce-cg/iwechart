import * as $ from "jquery";
import {Helper} from "./Helper";
import {webUtils} from "../../Types";

export class Template<M, C, H> {
    
    static SUPPORT_TEMPLATE = typeof(document) != "undefined" && "content" in document.createElement("template");
    static CREATE_FROM_FRAGMENT = true;
    
    id: string;
    template: webUtils.TemplateFunctionRaw<M, C, H>;
    helper: H;
    
    constructor(id: string, template: webUtils.TemplateFunctionRaw<M, C, H>, helper: H) {
        this.id = id;
        this.template = template;
        this.helper = helper;
    }
    
    render(model?: M, context?: C, helper?: H): string {
        return this.template(model, context, helper || this.helper);
    }
    
    renderToJQ(model?: M, context?: C, helper?: H): JQuery {
        let html = this.render(model, context, helper);
        if (Template.SUPPORT_TEMPLATE) {
            let template = document.createElement("template");
            template.innerHTML = html.trim();
            return $(<HTMLElement><any>(template.content.children || template.content.childNodes));
        }
        if (Template.CREATE_FROM_FRAGMENT) {
            let fragment = document.createDocumentFragment();
            let tmp = document.createElement("body");
            let child = null;
            tmp.innerHTML = html;
            while (child = tmp.firstElementChild) {
                fragment.appendChild(child);
            }
            return $(<HTMLElement><any>(fragment.children || fragment.childNodes));
        }
        return $(html.trim());
    }
}
