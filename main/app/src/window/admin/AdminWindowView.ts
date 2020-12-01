import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {MenuModel} from "./BaseView";
import {TabsViews} from "./TabsViews";
import {BaseView} from "./BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as menuEntryTemplate} from "./template/menu-entry.html";
import {func as loadingTemplate} from "./template/loading.html";
import {func as separatorTemplate} from "./template/separator.html";
import * as $ from "jquery";
import * as Q from "q";
import {app} from "../../Types";
import {GroupedElements} from "../../utils/GroupedElements";
import {KEY_CODES} from "../../web-utils/UI";
import {PersonsView} from "../../component/persons/PersonsView";

export interface TabModel extends MenuModel {
    tab: BaseView<any>;
}

@WindowView
export class AdminWindowView extends BaseWindowView<void> {
    
    tabs: GroupedElements<TabModel>;
    active: string;
    afterTabsInit: boolean;
    $menuContainer: JQuery;
    personsComponent: PersonsView;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.helper));
        this.tabs = new GroupedElements();
        ["info", "users", "misc", "security"].forEach((groupId, i) => {
            this.tabs.addGroup(groupId, (i + 1) * 100);
        });
        TabsViews.forEach(tabClass => {
            let tab = new tabClass(this);
            this.registerTab({tab: tab});
        });
    }
    
    initWindow(model: void): Q.Promise<void> {
        this.afterTabsInit = true;
        this.$menuContainer = this.$main.find(".menu .entries");
        this.personsComponent.$main = this.$main;
        return this.personsComponent.triggerInit().then(() => {
            return Q.all(this.tabs.getElements().map(ele => {
                return ele.tab.triggerInit().then(() => {
                    this.$main.find(".panels").append(ele.tab.$main);
                });
            }))
        })
        .then(() => {
            $(document).on("keydown", this.onKeyDown.bind(this));
            this.$main.on("click", ".menu .entry[data-entry]", this.onMenuEntryClick.bind(this));
            this.$main.on("click", "[data-action='close-popup']", this.onClosePopupClick.bind(this));
            this.$main.on("click", "[data-action='close-popup']", this.onClosePopupClick.bind(this));
            let menuEntryTmpl = this.templateManager.createTemplate(menuEntryTemplate);
            let separatorTmpl = this.templateManager.createTemplate(separatorTemplate);
            this.tabs.groups.forEach((group, i) => {
                if (i > 0 && group.elements.length > 0) {
                    this.$menuContainer.append(separatorTmpl.renderToJQ());
                }
                group.elements.forEach(ele => {
                    this.$menuContainer.append(menuEntryTmpl.renderToJQ(ele));
                });
            });
        });
    }
    
    registerTab(options: {tab: BaseView<any>, componentId?: string, replace?: boolean}): void {
        if (this.afterTabsInit) {
            throw new Error("Cannot register tab after initialization");
        }
        let tabModel = <TabModel>options.tab.menuModel;
        tabModel.tab = options.tab;
        let componentId = options.componentId || tabModel.id;
        if (options.replace) {
            this.tabs.removeElement(tabModel.id);
        }
        this.tabs.addElement(tabModel);
        this.addComponent("tab-component-" + componentId, options.tab);
    }
    
    refreshMenuEntry(model: MenuModel): void {
        let menuEntryTmpl = this.templateManager.createTemplate(menuEntryTemplate);
        let $element = menuEntryTmpl.renderToJQ(model);
        this.$menuContainer.find(".entry[data-entry='" + model.id + "']").replaceWith($element);
        if (this.active == model.id) {
            $element.addClass("active");
        }
    }
    
    loadingTab(name: string): void {
        this.$main.find(".loading-panel-backdrop").content(this.templateManager.createTemplate(loadingTemplate).renderToJQ()).removeClass("hide");
    }
    
    activateTab(name: string): void {
        this.$main.find(".loading-panel-backdrop").html("").addClass("hide");
        if (this.active) {
            this.tabs.getElement(this.active).tab.$main.removeClass("active");
            this.$main.find(".menu .entry.active").removeClass("active");
        }
        this.tabs.getElement(name).tab.$main.addClass("active");
        this.$main.find(".menu .entry[data-entry='" + name + "']").addClass("active");
        this.active = name;
    }
    
    onMenuEntryClick(e: MouseEvent): void {
        let $e = $(e.target).closest(".entry[data-entry]");
        let name = $e.data("entry");
        this.$main.find(".menu .entry.active").removeClass("active");
        this.$main.find(".menu .entry[data-entry='" + name + "']").addClass("active");
        this.triggerEvent("choose", name);
    }
    
    onClosePopupClick(e: MouseEvent): void {
        $(e.target).closest(".popup-ex").remove();
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.keyCode == KEY_CODES.key8 && e.ctrlKey) {
            e.preventDefault();
            this.$main.find(".menu .entry[data-entry='customization']").css("display", "block");
        }
        if (e.keyCode == KEY_CODES.key9 && e.ctrlKey) {
            e.preventDefault();
            this.$main.find(".menu .entry[data-entry='proxywhitelist']").css("display", "block");
            this.$main.find(".menu .entry[data-entry='externalusers']").css("display", "block");
        }

    }
}
