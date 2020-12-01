import {BaseWindowView} from "./BaseWindowView";
import {NavBarView} from "../../component/navbar/NavBarView";
import {webUtils} from "../../Types";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {TemplateManager} from "../../web-utils/template/Manager";
import {app} from "../../Types";
import * as Q from "q";

export class BaseAppWindowView<M, C = any> extends BaseWindowView<M, C> {
    
    navBar: NavBarView;
    $navBar: JQuery;
    $mainContainer: JQuery;
    
    constructor(parent: app.ViewParent, templateFunc: webUtils.MailTemplateDefinition<M, C>|{type: string, template: webUtils.MailTemplateDefinition<M, C>}, i18nPrefix?: string) {
        super(parent, BaseAppWindowView.getAppTemplate(parent.viewManager.getTemplateManager(), templateFunc), i18nPrefix);
        this.navBar = this.addComponent("navBar", new NavBarView(this));
    }
    
    static getAppTemplate<M, C>(templateManager: TemplateManager, template: webUtils.MailTemplateDefinition<M, C>|{type: string, template: webUtils.MailTemplateDefinition<M, C>}): webUtils.MailTemplateDefinition<M, C> {
        if ("type" in template) {
            if (template.type == "privmx-chrome") {
                let t = templateManager.createTemplate(template.template);
                return templateManager.createTemplate((model: M, context: C, helper: MailClientViewHelper) => {
                    let html = t.render(model, context, helper);
                    return '<div class="window-main"><div class="app-nav-bar"></div><div class="app-main-container">' + html + '</div></div>';
                }, t.helper);
            }
            return template.template;
        }
        return template;
    }
    
    init(model: M): Q.Promise<void> {
        return this.initCore(model).then(() => {
            this.$mainContainer = this.$main.find(".app-main-container");
            this.$navBar = this.$main.find(".app-nav-bar");
            if (this.$navBar.length) {
                this.navBar.$container = this.$navBar;
                return this.navBar.triggerInit();
            }
        })
        .then(() => {
            return this.initWindow(model);
        });
    }
}
