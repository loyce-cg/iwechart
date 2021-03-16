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
import {Model} from "./SettingsWindowController";
import {app} from "../../Types";
import {GroupedElements} from "../../utils/GroupedElements";
import { KEY_CODES } from "../../web-utils/UI";

export interface TabModel extends MenuModel {
    tab: BaseView<any>;
}

@WindowView
export class SettingsWindowView extends BaseWindowView<Model> {
    
    active: string;
    afterTabsInit: boolean;
    $menuContainer: JQuery;
    $panelsContainer: JQuery;
    tabDataName: string;
    tabs: GroupedElements<TabModel>;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.tabs = new GroupedElements();
        ["account", "misc", "forms", "info"].forEach((groupId, i) => {
            this.tabs.addGroup(groupId, (i + 1) * 100);
        });
        TabsViews.forEach(tabClass => {
            let tab = new tabClass(this);
            this.registerTab({tab: tab});
        });
        this.tabDataName = "section";
    }
    
    getMenuEntrySelector(section?: string, active?: boolean) {
        return ".settings-menu-item[data-" + this.tabDataName + (section ? "='" + section + "'" : "") + "]" + (active ? ".active" : "");
    }
    
    initWindow(model: Model): Q.Promise<void> {
        if (!model.supportsSecureForms) {
            this.tabs.removeElement("secureForms");
        }
        if (!model.supportWhitelist) {
            this.tabs.removeElement("whitelist");
        }
        if (!model.isElectron) {
            this.tabs.removeElement("hotkeys");
        }
        if (!model.isMnemonicEnabled) {
            this.tabs.removeElement("alternativeLogin");
        }
        $(document).on("keydown", this.onKeyDown.bind(this));
        this.$main.on("click", "[data-action='close-popup']", this.onClosePopupClick.bind(this));
        this.$menuContainer = this.$main.find(".settings-menu");
        this.$panelsContainer = this.$main.find(".settings-content");
        this.afterTabsInit = true;
        return Q.all(this.tabs.getElements().map(ele => {
            return ele.tab.triggerInit().then(() => {
                this.$panelsContainer.append(ele.tab.$main);
            });
        }))
        .then(() => {
            this.$menuContainer.on("click", this.getMenuEntrySelector(), this.onMenuEntryClick.bind(this));
            this.$main.on("click", "[data-action='close-popup']", this.onClosePopupClick.bind(this));
            let menuEntryTmpl = this.templateManager.createTemplate(menuEntryTemplate);
            let separatorTmpl = this.templateManager.createTemplate(separatorTemplate);
            this.tabs.groups.forEach((group, i) => {
                let count = group.elements.filter(x => x.id != "plugin-editor").length;
                if (i > 0 && count > 0) {
                    this.$menuContainer.append(separatorTmpl.renderToJQ());
                }
                group.elements.forEach(ele => {
                    if (ele.id == "plugin-editor") {
                        return;
                    }
                    if (ele.addSeparatorBefore) {
                        this.$menuContainer.append(separatorTmpl.renderToJQ());
                    }
                    this.$menuContainer.append(menuEntryTmpl.renderToJQ(ele));
                    if (ele.addSeparatorAfter) {
                        this.$menuContainer.append(separatorTmpl.renderToJQ());
                    }
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
    
    refreshMenuEntry(model: TabModel): void {
        let menuEntryTmpl = this.templateManager.createTemplate(menuEntryTemplate);
        let $element = menuEntryTmpl.renderToJQ(model);
        this.$menuContainer.find(".settings-menu-item[data-section='" + model.id + "']").replaceWith($element);
        if (this.active == model.id) {
            $element.addClass("active");
        }
    }
    
    loadingTab(name: string): void {
        this.$main.find(".loading-panel-backdrop").content(this.templateManager.createTemplate(loadingTemplate).renderToJQ()).removeClass("hide");
    }
    
    activateTab(name: string): void {
        let oldTab: BaseView<any> = null;
        if (this.active) {
            this.tabs.getElement(this.active).tab.$main.removeClass("active");
            this.$menuContainer.find(this.getMenuEntrySelector("", true)).removeClass("active");
            oldTab = this.tabs.getElement(this.active).tab;
        }
        let newTab = this.tabs.getElement(name).tab;
        newTab.$main.addClass("active");
        this.$menuContainer.find(this.getMenuEntrySelector(name)).addClass("active");
        this.active = name;
        Q().then(() => {
            return newTab.activate();
        })
        .fin(() => {
            if (oldTab) {
                oldTab.afterDeactivated();
            }
            this.$main.find(".loading-panel-backdrop").html("").addClass("hide");
        });
    }
    
    onMenuEntryClick(e: MouseEvent): void {
        let $e = $(e.target).closest(this.getMenuEntrySelector());
        let name = $e.data(this.tabDataName);
        this.$menuContainer.find(this.getMenuEntrySelector("", true)).removeClass("active");
        this.$menuContainer.find(this.getMenuEntrySelector(name)).addClass("active");
        this.triggerEvent("choose", name);
    }
    
    onClosePopupClick(e: MouseEvent): void {
        $(e.target).closest(".popup-ex").remove();
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.keyCode == KEY_CODES.key8 && e.ctrlKey) {
            this.triggerEvent("exportUserData");
        }
        // if (e.keyCode == KEY_CODES.key9 && e.ctrlKey) {
        //     this.triggerEvent("importUserData");
        // }
        if (e.keyCode == KEY_CODES.key0 && e.ctrlKey) {
            this.triggerEvent("showPlayerWindow");
        }
        if (e.keyCode == KEY_CODES.key7 && e.ctrlKey) {
            document.body.classList.toggle("show-hidden-fields");
        }
    }
}
