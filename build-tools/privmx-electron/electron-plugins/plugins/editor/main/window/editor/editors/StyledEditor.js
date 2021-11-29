"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Editor_1 = require("./Editor");
var style_switcher_html_1 = require("../template/style-switcher.html");
var pmc_web_1 = require("pmc-web");
var pmc_web_2 = require("pmc-web");
var StyledEditor = (function (_super) {
    __extends(StyledEditor, _super);
    function StyledEditor(options) {
        var _this = _super.call(this, options) || this;
        _this.styleSwitcherID = randomID();
        _this.bindStyleSwitcherEvents();
        return _this;
    }
    StyledEditor.prototype.initContainer = function () {
        _super.prototype.initContainer.call(this);
        this.initStyle();
    };
    StyledEditor.prototype.bindStyleSwitcherEvents = function () {
        pmc_web_1.JQuery("body").on("click", "#" + this.styleSwitcherID + " [data-action=switch-style]", this.onSwitchStyleClick.bind(this));
        pmc_web_1.JQuery("body").on("click", "#" + this.styleSwitcherID + " [data-action=open]", this.onSwitchStyleTriggerClick.bind(this));
        pmc_web_1.JQuery("body").on("click", "#" + this.styleSwitcherID + " .backdrop", this.onSwitchStyleBackdropClick.bind(this));
        pmc_web_1.JQuery("body").on("click", "#" + this.styleSwitcherID + " [data-action=switch-font-size]", this.onSwitchFontSizeClick.bind(this));
        pmc_web_1.JQuery("body").on("click", "#" + this.styleSwitcherID + " [data-action=switch-margin]", this.onSwitchMarginClick.bind(this));
        pmc_web_1.JQuery("body").on("click", "#font-size-" + this.styleSwitcherID + " [data-action=open]", this.onSwitchFontSizeTriggerClick.bind(this));
        pmc_web_1.JQuery("body").on("click", "#font-size-" + this.styleSwitcherID + " .backdrop", this.onSwitchFontSizeBackdropClick.bind(this));
    };
    StyledEditor.prototype.initStyle = function () {
        if (this.data.style && this.data.style.name) {
            this.$body.attr("data-style-name", this.data.style.name);
        }
        else {
            this.$body.attr("data-style-name", this.preferences.style || "default");
        }
        this.$container.css("font-size", this.data.style && this.data.style.fontSize ? this.data.style.fontSize : pmc_web_2.component.mindmap.Mindmap.DEFAULT_FONT_SIZE);
        this.setMargin(this.data.style.margin);
    };
    StyledEditor.prototype.setStyle = function (name, fontSize, margin) {
        if (name || fontSize || margin) {
            this.data.style = {
                name: name ? name : (this.data.style ? this.data.style.name : pmc_web_2.component.mindmap.Mindmap.DEFAULT_STYLE_NAME),
                fontSize: fontSize ? fontSize : (this.data.style ? this.data.style.fontSize : pmc_web_2.component.mindmap.Mindmap.DEFAULT_FONT_SIZE),
                margin: margin ? margin : (this.data.style ? this.data.style.margin : pmc_web_2.component.mindmap.Mindmap.DEFAULT_MARGIN),
            };
            this.$body.attr("data-style-name", name);
        }
        else {
            this.data.style = {};
            this.$body.removeAttr("data-style-name");
        }
        this.$container.css("font-size", this.data.style && this.data.style.fontSize ? this.data.style.fontSize : pmc_web_2.component.mindmap.Mindmap.DEFAULT_FONT_SIZE);
        this.setMargin(this.data.style.margin);
        this.triggerEvent("change", this.isChanged());
        this.refreshStyleSwitcherStateView();
        this.refreshFontSizeSwitcherStateView();
        this.focus();
    };
    StyledEditor.prototype.setMargin = function (marginPercentStr) {
        this.$body.attr("data-editor-margin", marginPercentStr);
    };
    StyledEditor.prototype.getStyleSwitcherTemplateModel = function () {
        return {
            id: this.styleSwitcherID,
            style: this.data.style,
        };
    };
    StyledEditor.prototype.getFontSizeSwitcherTemplateModel = function () {
        return {
            id: this.styleSwitcherID,
            style: this.data.style,
        };
    };
    StyledEditor.prototype.getCustomToolbarMenuHtml = function () {
        var model = this.getStyleSwitcherTemplateModel();
        return this.parent.viewManager.getTemplateManager().createTemplate(style_switcher_html_1.func).render(model);
    };
    StyledEditor.prototype.getCustomToolbarRightSideMenuHtml = function () {
        return "";
    };
    StyledEditor.prototype.getStyleSwitcher = function () {
        return pmc_web_1.JQuery("#" + this.styleSwitcherID);
    };
    StyledEditor.prototype.getFontSizeSwitcher = function () {
        return pmc_web_1.JQuery("#font-size-" + this.styleSwitcherID);
    };
    StyledEditor.prototype.refreshStyleSwitcherStateView = function () {
        var $items = pmc_web_1.JQuery("#" + this.styleSwitcherID).find("[data-action=switch-style]");
        $items.filter('.active').removeClass('active');
        if (this.data.style && this.data.style.name) {
            $items.filter('[data-name="' + this.data.style.name + '"]').addClass("active");
        }
        this.refreshFontSizeSwitcherStateView();
        this.refreshMarginSwitcherStateView();
    };
    StyledEditor.prototype.refreshFontSizeSwitcherStateView = function () {
        var $items = pmc_web_1.JQuery("#" + this.styleSwitcherID).find("[data-action=switch-font-size]");
        $items.filter('.active').removeClass('active');
        if (this.data.style && this.data.style.fontSize) {
            $items.filter('[data-name="' + this.data.style.fontSize + '"]').addClass("active");
        }
    };
    StyledEditor.prototype.refreshMarginSwitcherStateView = function () {
        var $items = pmc_web_1.JQuery("#" + this.styleSwitcherID).find("[data-action=switch-margin]");
        $items.filter('.active').removeClass('active');
        if (this.data.style && this.data.style.margin) {
            $items.filter('[data-name="' + this.data.style.margin + '"]').addClass("active");
        }
    };
    StyledEditor.prototype.onSwitchStyleClick = function (event) {
        this.setStyle(pmc_web_1.JQuery(event.currentTarget).data("name"), undefined, undefined);
        this.hideStyleSwitcher();
    };
    StyledEditor.prototype.onSwitchFontSizeClick = function (event) {
        this.setStyle(undefined, pmc_web_1.JQuery(event.currentTarget).data("name"), undefined);
        this.hideStyleSwitcher();
    };
    StyledEditor.prototype.onSwitchMarginClick = function (event) {
        this.setStyle(undefined, undefined, pmc_web_1.JQuery(event.currentTarget).data("name"));
        this.hideStyleSwitcher();
    };
    StyledEditor.prototype.onSwitchStyleTriggerClick = function () {
        this.toggleStyleSwitcher();
    };
    StyledEditor.prototype.onSwitchFontSizeTriggerClick = function () {
        this.toggleFontSizeSwitcher();
    };
    StyledEditor.prototype.onSwitchStyleBackdropClick = function () {
        this.hideStyleSwitcher();
    };
    StyledEditor.prototype.onSwitchFontSizeBackdropClick = function () {
        this.hideFontSizeSwitcher();
    };
    StyledEditor.prototype.hideStyleSwitcher = function () {
        var $switcher = this.getStyleSwitcher();
        $switcher.removeClass("open");
        $switcher.closest(".toolbar-container").trigger("mouseout");
    };
    StyledEditor.prototype.hideFontSizeSwitcher = function () {
        var $switcher = this.getFontSizeSwitcher();
        $switcher.removeClass("open");
        $switcher.closest(".toolbar-container").trigger("mouseout");
    };
    StyledEditor.prototype.showStyleSwitcher = function () {
        this.refreshStyleSwitcherStateView();
        this.getStyleSwitcher().addClass("open");
    };
    StyledEditor.prototype.showFontSizeSwitcher = function () {
        this.refreshFontSizeSwitcherStateView();
        this.getFontSizeSwitcher().addClass("open");
    };
    StyledEditor.prototype.toggleStyleSwitcher = function () {
        var $switcher = this.getStyleSwitcher();
        if ($switcher.hasClass("open")) {
            this.hideStyleSwitcher();
        }
        else {
            this.showStyleSwitcher();
        }
    };
    StyledEditor.prototype.toggleFontSizeSwitcher = function () {
        var $switcher = this.getFontSizeSwitcher();
        if ($switcher.hasClass("open")) {
            this.hideFontSizeSwitcher();
        }
        else {
            this.showFontSizeSwitcher();
        }
    };
    StyledEditor.prototype.getFontSize = function () {
        return this.data.style && this.data.style.fontSize && this.data.style.fontSize in pmc_web_2.component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? this.data.style.fontSize : pmc_web_2.component.mindmap.Mindmap.DEFAULT_FONT_SIZE;
    };
    StyledEditor.prototype.getMargin = function () {
        return this.data.style && this.data.style.margin && this.data.style.margin in pmc_web_2.component.mindmap.Mindmap.AVAILABLE_MARGINS ? this.data.style.margin : pmc_web_2.component.mindmap.Mindmap.DEFAULT_MARGIN;
    };
    StyledEditor.clazz = "StyledEditor";
    return StyledEditor;
}(Editor_1.Editor));
exports.StyledEditor = StyledEditor;
function randomID() {
    return ["id", Math.random().toString(36).substr(2, 5), new Date().getTime()].join("-");
}
StyledEditor.prototype.className = "com.privmx.plugin.editor.window.editor.editors.StyledEditor";

//# sourceMappingURL=StyledEditor.js.map
