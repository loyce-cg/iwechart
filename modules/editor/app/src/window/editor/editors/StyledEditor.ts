import {Editor, EditorOptions} from "./Editor";
import {func as styleSwitcherTemplate} from "../template/style-switcher.html";
import {JQuery as $} from "pmc-web";
import { component } from "pmc-web";

export interface DataWithStyle {
    style: Style;
}

export interface Style {
    name?: string;
    fontSize?: string;
    margin?: string;
}

export interface StyleSwitcherTemplateModel {
    id: string;
    style: Style;
}

export interface FontSizeSwitcherTemplateModel {
    id: string;
    style: Style;
}

export class StyledEditor<T extends DataWithStyle> extends Editor<T> {
    
    static clazz = "StyledEditor";
    
    styleSwitcherID: string;
    
    constructor(options: EditorOptions) {
        super(options);
        this.styleSwitcherID = randomID();
        this.bindStyleSwitcherEvents();
    }
    
    initContainer(): void {
        super.initContainer();
        this.initStyle();
    }
    
    bindStyleSwitcherEvents(): void {
        $("body").on("click", "#" + this.styleSwitcherID + " [data-action=switch-style]", this.onSwitchStyleClick.bind(this));
        $("body").on("click", "#" + this.styleSwitcherID + " [data-action=open]", this.onSwitchStyleTriggerClick.bind(this));
        $("body").on("click", "#" + this.styleSwitcherID + " .backdrop", this.onSwitchStyleBackdropClick.bind(this));
        $("body").on("click", "#" + this.styleSwitcherID + " [data-action=switch-font-size]", this.onSwitchFontSizeClick.bind(this));
        $("body").on("click", "#" + this.styleSwitcherID + " [data-action=switch-margin]", this.onSwitchMarginClick.bind(this));
        $("body").on("click", "#font-size-" + this.styleSwitcherID + " [data-action=open]", this.onSwitchFontSizeTriggerClick.bind(this));
        $("body").on("click", "#font-size-" + this.styleSwitcherID + " .backdrop", this.onSwitchFontSizeBackdropClick.bind(this));
    }
    
    initStyle(): void {
        if (this.data.style && this.data.style.name) {
            this.$body.attr("data-style-name", this.data.style.name);
        }
        else {
            this.$body.attr("data-style-name", this.preferences.style || "default");
        }
        this.$container.css("font-size", this.data.style && this.data.style.fontSize ? this.data.style.fontSize : component.mindmap.Mindmap.DEFAULT_FONT_SIZE);
        this.setMargin(this.data.style.margin);
    }
    
    setStyle(name: string, fontSize: string, margin: string): void {
        if (name || fontSize || margin) {
            this.data.style = {
                name: name ? name : (this.data.style ? this.data.style.name : component.mindmap.Mindmap.DEFAULT_STYLE_NAME),
                fontSize: fontSize ? fontSize : (this.data.style ? this.data.style.fontSize : component.mindmap.Mindmap.DEFAULT_FONT_SIZE),
                margin: margin ? margin : (this.data.style ? this.data.style.margin : component.mindmap.Mindmap.DEFAULT_MARGIN),
            };
            this.$body.attr("data-style-name", name);
        }
        else {
            this.data.style = {};
            this.$body.removeAttr("data-style-name");
        }
        this.$container.css("font-size", this.data.style && this.data.style.fontSize ? this.data.style.fontSize : component.mindmap.Mindmap.DEFAULT_FONT_SIZE);
        this.setMargin(this.data.style.margin);
        this.triggerEvent("change", this.isChanged());
        this.refreshStyleSwitcherStateView();
        this.refreshFontSizeSwitcherStateView();
        this.focus();
    }
    
    setMargin(marginPercentStr: string): void {
        // let marginPercent = parseInt(marginPercentStr);
        // let $el = this.$container.closest(".main-content");
        // let $editor = $el.find(".editor");
        this.$body.attr("data-editor-margin", marginPercentStr);
        // $el.css("margin-left", marginPercentStr);
        // $el.css("margin-right", marginPercentStr);
        // $el.css("width", `calc(100% - ${marginPercent * 2}%)`);
        // $editor.css("left", `calc(14px + ${marginPercent}%)`);
        // $editor.css("right", `calc(14px + ${marginPercent}%)`);
    }
    
    getStyleSwitcherTemplateModel(): StyleSwitcherTemplateModel {
        return {
            id: this.styleSwitcherID,
            style: this.data.style,
        };
    }
    
    getFontSizeSwitcherTemplateModel(): StyleSwitcherTemplateModel {
        return {
            id: this.styleSwitcherID,
            style: this.data.style,
        };
    }
    
    getCustomToolbarMenuHtml(): string {
        let model = this.getStyleSwitcherTemplateModel();
        return this.parent.viewManager.getTemplateManager().createTemplate(styleSwitcherTemplate).render(model);// + this.parent.viewManager.getTemplateManager().createTemplate(fontSizeSwitcherTemplate).render(model);
    }

    getCustomToolbarRightSideMenuHtml(): string {
        return "";
    }
    
    getStyleSwitcher(): JQuery {
        return $("#" + this.styleSwitcherID);
    }
    
    getFontSizeSwitcher(): JQuery {
        return $("#font-size-" + this.styleSwitcherID);
    }
    
    refreshStyleSwitcherStateView(): void {
        let $items = $("#" + this.styleSwitcherID).find("[data-action=switch-style]");
        $items.filter('.active').removeClass('active');
        if (this.data.style && this.data.style.name) {
            $items.filter('[data-name="' + this.data.style.name + '"]').addClass("active");
        }
        this.refreshFontSizeSwitcherStateView();
        this.refreshMarginSwitcherStateView();
    }
    
    refreshFontSizeSwitcherStateView(): void {
        let $items = $("#" + this.styleSwitcherID).find("[data-action=switch-font-size]");
        $items.filter('.active').removeClass('active');
        if (this.data.style && this.data.style.fontSize) {
            $items.filter('[data-name="' + this.data.style.fontSize + '"]').addClass("active");
        }
    }
    
    refreshMarginSwitcherStateView(): void {
        let $items = $("#" + this.styleSwitcherID).find("[data-action=switch-margin]");
        $items.filter('.active').removeClass('active');
        if (this.data.style && this.data.style.margin) {
            $items.filter('[data-name="' + this.data.style.margin + '"]').addClass("active");
        }
    }
    
    onSwitchStyleClick(event: Event): void {
        this.setStyle($(event.currentTarget).data("name"), undefined, undefined);
        this.hideStyleSwitcher();
    }
    
    onSwitchFontSizeClick(event: Event): void {
        this.setStyle(undefined, $(event.currentTarget).data("name"), undefined);
        this.hideStyleSwitcher();
        //this.hideFontSizeSwitcher();
    }
    
    onSwitchMarginClick(event: Event): void {
        this.setStyle(undefined, undefined, $(event.currentTarget).data("name"));
        this.hideStyleSwitcher();
        //this.hideFontSizeSwitcher();
    }
    
    onSwitchStyleTriggerClick(): void {
        this.toggleStyleSwitcher();
    }
    
    onSwitchFontSizeTriggerClick(): void {
        this.toggleFontSizeSwitcher();
    }
    
    onSwitchStyleBackdropClick(): void {
        this.hideStyleSwitcher();
    }
    
    onSwitchFontSizeBackdropClick(): void {
        this.hideFontSizeSwitcher();
    }
    
    hideStyleSwitcher(): void {
        let $switcher = this.getStyleSwitcher();
        $switcher.removeClass("open");
        $switcher.closest(".toolbar-container").trigger("mouseout");
    }
    
    hideFontSizeSwitcher(): void {
        let $switcher = this.getFontSizeSwitcher();
        $switcher.removeClass("open");
        $switcher.closest(".toolbar-container").trigger("mouseout");
    }
    
    showStyleSwitcher(): void {
        this.refreshStyleSwitcherStateView();
        this.getStyleSwitcher().addClass("open");
    }
    
    showFontSizeSwitcher(): void {
        this.refreshFontSizeSwitcherStateView();
        this.getFontSizeSwitcher().addClass("open");
    }
    
    toggleStyleSwitcher(): void {
        let $switcher = this.getStyleSwitcher();
        if ($switcher.hasClass("open")) {
            this.hideStyleSwitcher();
        }
        else {
            this.showStyleSwitcher();
        }
    }
    
    toggleFontSizeSwitcher(): void {
        let $switcher = this.getFontSizeSwitcher();
        if ($switcher.hasClass("open")) {
            this.hideFontSizeSwitcher();
        }
        else {
            this.showFontSizeSwitcher();
        }
    }
    
    getFontSize(): string {
        return this.data.style && this.data.style.fontSize && this.data.style.fontSize in component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? this.data.style.fontSize : component.mindmap.Mindmap.DEFAULT_FONT_SIZE;
    }
    
    getMargin(): string {
        return this.data.style && this.data.style.margin && this.data.style.margin in component.mindmap.Mindmap.AVAILABLE_MARGINS ? this.data.style.margin : component.mindmap.Mindmap.DEFAULT_MARGIN;
    }
    
}

function randomID(): string {
    return ["id", Math.random().toString(36).substr(2, 5), new Date().getTime()].join("-");
}
