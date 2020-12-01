import {ComponentView} from "../base/ComponentView";
import {func as mainTemplate} from "./index.html";
import {func as tabTemplate} from "./tab.html";
import * as $ from "jquery";
import {webUtils} from "../../Types";
import {app} from "../../Types";
import {Model, SectionTab} from "./SectionsTabsController";

export interface Options {
    onChangeVisibility?: (visible: boolean) => void;
}

export class SectionsTabsView extends ComponentView {
    
    mainTemplate: webUtils.MailTemplate<Model>;
    tabTemplate: webUtils.MailTemplate<SectionTab>;

    $container: JQuery;
    $component: JQuery;
    model: Model;
    options: Options;
    
    constructor(parent: app.ViewParent, options?: Options) {
        super(parent);
        this.options = options;
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.tabTemplate = this.templateManager.createTemplate(tabTemplate);
    }
    
    init(model: Model): void {
        this.model = model;
        this.render(model);
        this.$container.on("click", "[data-section-id]", this.onTabClick.bind(this));
    }
    
    existsInModel(model: Model, id: string): boolean {
        let exists = false;
        for (let i = 0; i < model.tabs.length; i++) {
            if (model.tabs[i].id == id) {
                exists = true;
                break;
            }
        }
        return exists;
    }
    
    clear(model: Model): void {
        this.model = model;
        let $tabs = this.$container.find(".sections-tabs").children();
        $tabs.each((_i, x) => {
            let sectionId = $(x).data("section-id");
            if (! this.existsInModel(model, sectionId)) {
                x.remove();
            }
        })
    }
    
    render(model: Model): void {
        this.model = model;
        this.clear(model);
        let $tabs = this.$container.find(".sections-tabs");
        if ($tabs.length == 0) {
            this.$container.empty().append(this.mainTemplate.renderToJQ(model));
            $tabs = this.$container.find(".sections-tabs");
        }
        let $current: JQuery;
        model.tabs.forEach(x => {
            let $found = $tabs.find(".tab[data-section-id='"+x.id+"']");
            
            if ($found.length == 0) {
                $found = this.tabTemplate.renderToJQ(x);
                if ($current) {
                    $found.insertAfter($current);
                }
                else {
                    $tabs.prepend($found);
                }
            }
            else {
                if (x.active) {
                    $found.addClass("active");
                }
                else {
                    $found.removeClass("active");
                }
                let $new = this.tabTemplate.renderToJQ(x);
                $found.replaceWith($new);
                $found = $new;
            }
            $current = $found;
        })
        this.setTabsVisible(model.tabs.length > 1);
    }
    
    refreshTab(model: SectionTab) {
        let $tab = this.$container.find(".sections-tabs .tab[data-section-id='" + model.id + "']");
        $tab.replaceWith(this.tabTemplate.renderToJQ(model));
    }
    
    setTabsVisible(visible: boolean): void {
        if (visible) {
            this.$container.css("display", "block");
        } else {
            this.$container.css("display", "none");
        }
        if (this.options && this.options.onChangeVisibility) {
            this.options.onChangeVisibility(visible);
        }
    }
    
    onTabClick(event: MouseEvent): void {
        let $el = $(event.target).closest("[data-section-id]");
        let sectionId = $el.data("section-id");
        this.triggerEvent("selectTab", sectionId);
    }
    
    updateActive(id: string) {
        this.setTabsVisible(this.areTabsVisible());
        this.$container.find("[data-section-id="+id+"]").addClass("active");
        this.$container.find(".active:not([data-section-id="+id+"])").removeClass("active");
    }
    
    areTabsVisible(): boolean {
        if (this.model && this.model.tabs) {
            return this.model.tabs.length > 1;
        }
        return false;
    }
}
