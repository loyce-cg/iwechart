import { component, JQuery as $, Q, Types, webUtils } from "pmc-web";
import { Model } from "./IconPickerController";
import { func as mainTemplate } from "./template/main.html";
import { func as iconTemplate } from "../../window/taskGroupForm/template/icon.html";
import MailClientViewHelper = webUtils.MailClientViewHelper;
import Template = webUtils.template.Template;

export class IconPickerView extends component.base.ComponentView {
    
    $container: JQuery;
    $main: JQuery;
    $iconsContainer: JQuery;
    $colorsContainer: JQuery;
    iconTemplate: Template<string, void, MailClientViewHelper>;
    model: Model;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent);
    }
    
    init(model: Model): any {
        this.setModel(model);
        
        return Q.resolve();
    }
    
    setModel(model: Model): void {
        this.model = model;
        this.$main = this.templateManager.createTemplate(mainTemplate).renderToJQ(model);
        this.$container.append(this.$main);
        this.$iconsContainer = this.$main.find(".icons-container");
        this.$colorsContainer = this.$main.find(".colors-container");
        this.iconTemplate = this.templateManager.createTemplate(iconTemplate);
        
        for (let i = 0; i < model.items.length; ++i) {
            let iconStr = model.items[i];
            let $icon = this.iconTemplate.renderToJQ(iconStr);
            let $iconWrapper = $("<div />");
            $iconWrapper.attr("data-item-index", i);
            $iconWrapper.append($icon);
            if (i == model.selectedItemIndex) {
                $iconWrapper.addClass("selected");
            }
            this.$iconsContainer.append($iconWrapper);
        }
        for (let i = 0; i < model.colors.length; ++i) {
            let $colorWrapper = $("<div></div>");
            $colorWrapper.attr("data-color-index", i);
            $colorWrapper.append("<div style='color:" + this.iconTemplate.helper.escapeHtml(model.colors[i]) + "'><i class='fa fa-tint'></i></div>");
            if (i == model.selectedColorIndex) {
                $colorWrapper.addClass("selected");
            }
            this.$colorsContainer.append($colorWrapper);
        }
        
        let color = this.model.colors[this.model.selectedColorIndex];
        this.$iconsContainer.css("color", color);
        
        this.$main.on("click", "[data-item-index]", this.onItemClick.bind(this));
        this.$main.on("click", "[data-color-index]", this.onColorClick.bind(this));
    }
    
    onItemClick(e: MouseEvent): void {
        let itemIndex = parseInt($(e.currentTarget).attr("data-item-index"));
        this.triggerEvent("selectedItemIndexChanged", itemIndex);
        this.$iconsContainer.find(".selected").removeClass("selected");
        this.$iconsContainer.children().eq(itemIndex).addClass("selected");
        this.model.selectedItemIndex = itemIndex;
    }
    
    onColorClick(e: MouseEvent): void {
        let colorIndex = parseInt($(e.currentTarget).attr("data-color-index"));
        this.triggerEvent("selectedColorIndexChanged", colorIndex);
        this.$colorsContainer.find(".selected").removeClass("selected");
        this.$colorsContainer.children().eq(colorIndex).addClass("selected");
        this.model.selectedColorIndex = colorIndex;
        
        let color = this.model.colors[colorIndex];
        this.$iconsContainer.css("color", color);
    }
    
}