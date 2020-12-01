import {ComponentView} from "../base/ComponentView";
import {func as mainTemplate} from "./template/index.html";
import {app} from "../../Types";
import { Model } from "./CustomizationEditorController";
import * as $ from "jquery";
import { CustomizationParsingResult, CssParser } from "../../app/common/customization/CssParser";
import { CssGenerator } from "../../app/common/customization/CssGenerator";
import { ColorUtils } from "../../app/common/customization/ColorUtils";
import { SliderView, SliderTextFormat } from "../slider/web";
import Q = require("q");
const ColorPicker = require("a-color-picker");

enum LogoTypes {
    header = "logo-header",
    headerWh = "logo-header-wh",
    loginScreen = "logo-login-screen",
}

export class CustomizationEditorView extends ComponentView {
    
    static EDITOR_STYLE_PREFIX: string = "customization-editor-preview";
    static DEFAULT_ADVANCED_MODE: boolean = false;
    
    $container: JQuery;
    $component: JQuery;
    $colorPickerContainer: JQuery;
    css: string;
    origData: CustomizationParsingResult = null;
    data: CustomizationParsingResult = null;
    logoHeader: string;
    logoHeaderWh: string;
    logoLoginScreen: string;
    title: string;
    onOutsideOfColorInputMouseDownBound: any = this.onOutsideOfColorInputMouseDown.bind(this);
    onColorPickerMouseMoveBound: any = this.onColorPickerMouseMove.bind(this);
    onColorPickerMouseUpBound: any = this.onColorPickerMouseUp.bind(this);
    colorPicker: any;
    $colorPickerTarget: JQuery;
    colorPickerDragStartX: number = 0;
    colorPickerDragStartY: number = 0;
    colorPickerDragStartMouseX: number = 0;
    colorPickerDragStartMouseY: number = 0;
    $draggedElement: JQuery;
    sliders: SliderView[] = [];
    nAddedSliders: number = 0;
    
    constructor(parent: app.ViewParent) {
        super(parent);
    }
    
    init(model: Model) {
        this.setModel(model);
        
        this.$container.on("change", "[data-customization-variable]", this.onInputChange.bind(this));
        this.$container.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        this.$container.on("click", "[data-action=export]", this.onExportClick.bind(this));
        this.$container.on("click", "[data-action=import]", this.onImportClick.bind(this));
        this.$container.on("click", "[data-action=cancel]", this.onCancelClick.bind(this));
        this.$container.on("click", ".color-input", this.onColorInputClick.bind(this));
        this.$container.on("mousedown", ".a-color-picker", this.onColorPickerMouseDown.bind(this));
        this.$container.on("click", ".color-input-cancel", this.onRestoreValueClick.bind(this));
        this.$container.on("click", ".file-input-cancel", this.onRestoreFileClick.bind(this));
        this.$container.on("click", ".switch", this.onSwitchClick.bind(this));
        this.$container.on("click", "[data-action='toggle-screen-cover']", this.onToggleScreenCoverClick.bind(this));
        this.$container.on("click", "[data-action='show-full-preview']", this.onShowFullPreviewClick.bind(this));
        this.$container.on("change", "input[type=file][data-file-id]", this.onUploadLogo.bind(this));
        this.$container.on("click", "[data-action=\"restore\"]", this.onRestoreClick.bind(this));
        this.$container.on("click", "[data-action=\"toggle-advanced-gradient\"]", this.onToggleAdvancedGradientClick.bind(this));
    }
    
    setModel(model: Model) {
        let oldData = this.origData;
        this.css = model.css;
        this.data = CssParser.parseVariables(model.css);
        if (oldData) {
            for (let k in oldData.cssVars) {
                if (!(k in this.data.cssVars)) {
                    this.data.cssVars[k] = oldData.cssVars[k];
                }
            }
            for (let k in oldData.customizationVars) {
                if (!(k in this.data.customizationVars)) {
                    this.data.customizationVars[k] = oldData.customizationVars[k];
                }
            }
        }
        this.origData = JSON.parse(JSON.stringify(this.data));
        this.logoHeader = model.logoHeader;
        this.logoHeaderWh = model.logoHeaderWh;
        this.logoLoginScreen = model.logoLoginScreen;
        this.title = model.title;
        this.render();
    }
    
    render(): void {
        this.$container.empty();
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ({
            data: this.data,
            advancedMode: CustomizationEditorView.DEFAULT_ADVANCED_MODE,
            logoHeader: this.logoHeader,
            logoHeaderWh: this.logoHeaderWh,
            logoLoginScreen: this.logoLoginScreen,
            title: this.title,
        });
        this.$colorPickerContainer = this.$component.find(".colorpicker-container");
        this.$container.append(this.$component);
        this.updatePreviewStyle();
        this.colorPicker = ColorPicker.createPicker(this.$colorPickerContainer);
        this.colorPicker.on("change", this.onColorPickerChange.bind(this));
        
        for (let el of this.$container.find(".color-input").toArray()) {
            let $el = $(el);
            let varName = $el.data("customization-variable");
            $el.toggleClass("on-light", parseInt(this.data.cssVars[varName + "-l"]) > 50);
        }
        
        this.updateGradientMode(false);
        this.addSliders();
    }
    
    addSlider(id: number, perc: boolean): void {
        let slider = this.addComponent("slider-" + id, new SliderView(this, {
            textFormat: perc ? SliderTextFormat.INT_PERCENT : SliderTextFormat.FRACTION,
            changeEventDelay: 0,
        }));
        let $input = this.$component.find("input[data-slider-id=" + id + "]");
        this.sliders[id] = slider;
        slider.$container = this.$component.find("[data-slider-container-id=" + id + "]");
        slider.triggerInit().then(() => {
            slider.setMin(parseFloat($input.prop("min")));
            slider.setMax(parseFloat($input.prop("max")));
            slider.setStep(parseFloat($input.prop("step")));
            slider.setValue(parseFloat(<string>$input.val()));
        });
        slider.onValueChange = value => {
            let precision = perc ? 0 : 2;
            let d = Math.pow(10, precision);
            value = Math.round(value * d) / d;
            $input.val(value);
            this.onInputChange(<any>{
                currentTarget: $input[0],
            });
        };
        $input.on("change", () => {
            slider.setValue(parseFloat(<string>$input.val()));
        });
    }
    
    addSliders(): void {
        this.$component.find("input[type=number][step]").each((idx, el) => {
            let $el = $(el);
            let id = this.nAddedSliders++;
            $el.attr("data-slider-id", id);
            $el.after("<div data-slider-container-id='" + id + "'></div>");
            this.triggerEvent("addSlider", id, $el.attr("step").indexOf(".") < 0);
        });
    }
    
    prepare(): void {
        for (let slider of this.sliders) {
            slider.update();
        }
    }
    
    updatePreviewStyle(): void {
        for (let name in this.data.cssVars) {
            this.setCssVariable(name, this.data.cssVars[name]);
        }
    }
    
    setCssVariable(name: string, value: string): void {
        this.data.cssVars[name] = value;
        name = "--" + CustomizationEditorView.EDITOR_STYLE_PREFIX + "-" + name.substr(2);
        value = value.replace(/\-\-/g, "--" + CustomizationEditorView.EDITOR_STYLE_PREFIX + "-");
        document.documentElement.style.setProperty(name, value);
    }
    
    getCssVariable(name: string): string {
        return this.data.cssVars[name];
    }
    
    getCssHsla(name: string): number[] {
        return [
            parseInt(this.getCssVariable(name + "-h")),
            parseInt(this.getCssVariable(name + "-s")),
            parseInt(this.getCssVariable(name + "-l")),
            parseFloat(this.getCssVariable(name + "-a")),
        ];
    }
    
    gatherData() {
        this.css = CssGenerator.generate(this.data);
        this.title = <string>this.$component.find("input[data-editor=\"title\"]").val();
        return {
            title: this.title,
            css: this.css,
            cssVariables: <string>null,
            logoHeader: this.logoHeader,
            logoHeaderWh: this.logoHeaderWh,
            logoLoginScreen: this.logoLoginScreen,
        };
    }
    
    save(): void {
        this.triggerEvent("save", JSON.stringify(this.gatherData()));
    }
    
    export(): void {
        this.triggerEvent("export", this.gatherData());
    }
    
    cancel(): void {
        this.data = CssParser.parseVariables(this.css);
        this.render();
        this.triggerEvent("cancel");
    }
    
    onInputChange(e: MouseEvent): void {
        let $input = <JQuery>$(e.currentTarget);
        let varName = $input.data("customization-variable");
        let varValue = <string>$input.val();
        if ($input.attr("type") == "number") {
            let min = Math.max(-999999, parseFloat($input.attr("min")));
            let max = Math.min(999999, parseFloat($input.attr("max")));
            let val = parseFloat(varValue);
            varValue = "" + Math.min(max, Math.max(min, val));
            if (varValue != "" + val) {
                $input.val(varValue);
            }
        }
        if (this.data.cssVars[varName].substr(-2) == "px") {
            varValue += "px";
        }
        if (this.data.cssVars[varName].substr(-1) == "%") {
            varValue += "%";
        }
        this.setCssVariable(varName, varValue);
    }
    
    onColorInputClick(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget);
        this.$colorPickerTarget = $el;
        let varName = this.$colorPickerTarget.data("customization-variable");
        this.colorPicker.hsla = this.getCssHsla(varName);
        
        let $cp = this.$colorPickerContainer;
        $cp.addClass("visible");
        $cp.css({
            left: $el.offset().left - this.$container.offset().left + e.offsetX,
            top: $el.offset().top - this.$container.offset().top + e.offsetY,
        });
        $(document).on("mousedown", this.onOutsideOfColorInputMouseDownBound);
    }
    
    onOutsideOfColorInputMouseDown(e: MouseEvent): void {
        let $cp = this.$colorPickerContainer;
        if ($.contains($cp[0], <HTMLElement>e.target)) {
            return;
        }
        $cp.removeClass("visible");
        $(document).off("mousedown", this.onOutsideOfColorInputMouseDownBound);
    }
    
    onColorPickerChange(): void {
        let hsla = this.colorPicker.hsla;
        let varName = this.$colorPickerTarget.data("customization-variable");
        this.setCssVariable(varName + "-h", hsla[0] + "");
        this.setCssVariable(varName + "-s", hsla[1] + "%");
        this.setCssVariable(varName + "-l", hsla[2] + "%");
        this.setCssVariable(varName + "-a", hsla[3] + "");
        this.$colorPickerTarget.toggleClass("on-light", hsla[2] > 50);
        
        if (varName == "--body-fg" || varName == "--body-secondary-fg") {
            this.updateColorMix();
        }
    }
    
    updateColorMix() {
        let hsla1 = this.getCssHsla("--body-fg");
        let hsla2 = this.getCssHsla("--body-secondary-fg");
        let hsla3 = ColorUtils.mixColors(hsla1, hsla2);
        this.setCssVariable("--body-mixed-fg-h", hsla3[0] + "");
        this.setCssVariable("--body-mixed-fg-s", hsla3[1] + "%");
        this.setCssVariable("--body-mixed-fg-l", hsla3[2] + "%");
        this.setCssVariable("--body-mixed-fg-a", hsla3[3] + "");
        
        let h = (x: number) => (x + 360) % 360;
        let s = (x: number) => (x + 100) % 100;
        let l = (x: number) => (x + 100) % 100;
        
        this.setCssVariable("--gradient-color1-h", h(hsla3[0] + 76) + "");
        this.setCssVariable("--gradient-color1-s", s(hsla3[1] + 39) + "%");
        this.setCssVariable("--gradient-color1-l", l(hsla3[2] + 22) + "%");
        this.setCssVariable("--gradient-color1-a", hsla3[3] + "");
        this.$component.find(".color-input[data-customization-variable='--gradient-color1']").toggleClass("on-light", hsla3[2] + 22 > 50);
        
        this.setCssVariable("--gradient-color2-h", h(hsla3[0] - 69) + "");
        this.setCssVariable("--gradient-color2-s", s(hsla3[1] + 67) + "%");
        this.setCssVariable("--gradient-color2-l", l(hsla3[2] + 43) + "%");
        this.setCssVariable("--gradient-color2-a", hsla3[3] + "");
        this.$component.find(".color-input[data-customization-variable='--gradient-color2']").toggleClass("on-light", hsla3[2] + 43 > 50);
        
        this.setCssVariable("--gradient-color3-h", h(hsla3[0] + 21) + "");
        this.setCssVariable("--gradient-color3-s", s(hsla3[1] + 52) + "%");
        this.setCssVariable("--gradient-color3-l", l(hsla3[2] + 55) + "%");
        this.setCssVariable("--gradient-color3-a", hsla3[3] + "");
        this.$component.find(".color-input[data-customization-variable='--gradient-color3']").toggleClass("on-light", hsla3[2] + 55 > 50);
        
        this.setCssVariable("--gradient-color4-h", h(hsla3[0] + 73) + "");
        this.setCssVariable("--gradient-color4-s", s(hsla3[1] + 5) + "%");
        this.setCssVariable("--gradient-color4-l", l(hsla3[2] - 20) + "%");
        this.setCssVariable("--gradient-color4-a", hsla3[3] + "");
        this.$component.find(".color-input[data-customization-variable='--gradient-color4']").toggleClass("on-light", hsla3[2] - 20 > 50);
    }
    
    onSaveClick(): void {
        this.save();
    }
    
    onExportClick(): void {
        this.export();
    }
    
    onImportClick(): void {
        this.triggerEvent("import");
    }
    
    onCancelClick(): void {
        this.cancel();
    }
    
    onColorPickerMouseDown(e: MouseEvent): void {
        if ($.contains(this.$colorPickerContainer.find(".a-color-picker-row")[0], <HTMLElement>e.target)) {
            return;
        }
        if ($(e.target).closest(".a-color-picker-stack").length > 0) {
            return;
        }
        if ($(e.target).is("input")) {
            return;
        }
        this.$draggedElement = this.$colorPickerContainer;
        $(document).on("mousemove", this.onColorPickerMouseMoveBound);
        $(document).on("mouseup", this.onColorPickerMouseUpBound);
        this.colorPickerDragStartMouseX = e.screenX;
        this.colorPickerDragStartMouseY = e.screenY;
        this.colorPickerDragStartX = parseInt(this.$colorPickerContainer.css("left"));
        this.colorPickerDragStartY = parseInt(this.$colorPickerContainer.css("top"));
    }
    
    onColorPickerMouseMove(e: MouseEvent): void {
        this.$draggedElement.css({
            left: this.colorPickerDragStartX + (e.screenX - this.colorPickerDragStartMouseX),
            top: this.colorPickerDragStartY + (e.screenY - this.colorPickerDragStartMouseY),
        });
    }
    
    onColorPickerMouseUp(e: MouseEvent): void {
        $(document).off("mousemove", this.onColorPickerMouseMoveBound);
        $(document).off("mouseup", this.onColorPickerMouseUpBound);
    }
    
    onRestoreValueClick(e: MouseEvent): void {
        let $el = $(e.currentTarget).closest(".color-input-wrapper").find(".color-input");
        let varName = $el.data("customization-variable");
        if ((varName + "-h") in this.origData.cssVars) {
            this.setCssVariable(varName + "-h", this.origData.cssVars[varName + "-h"]);
            this.setCssVariable(varName + "-s", this.origData.cssVars[varName + "-s"]);
            this.setCssVariable(varName + "-l", this.origData.cssVars[varName + "-l"]);
            this.setCssVariable(varName + "-a", this.origData.cssVars[varName + "-a"]);
            $el.toggleClass("on-light", parseInt(this.origData.cssVars[varName + "-l"]) > 50);
        }
        if (varName == "--body-fg" || varName == "--body-secondary-fg") {
            this.updateColorMix();
        }
    }
    
    onRestoreFileClick(e: MouseEvent): void {
        let $input = $(e.currentTarget).closest(".editor.file").find("input[type=file]");
        $input.val("");
        let type = $input.data("file-id") == LogoTypes.header ? LogoTypes.header : ($input.data("file-id") == LogoTypes.headerWh ? LogoTypes.headerWh : LogoTypes.loginScreen);
        if (type == LogoTypes.header) {
            this.logoHeader = "";
        }
        else if (type == LogoTypes.headerWh) {
            this.logoHeaderWh = "";
        }
        else {
            this.logoLoginScreen = "";
        }
        let $img = this.$component.find("img.preview-" + type);
        if ($img.data("prev-src")) {
            $img.attr("src", $img.data("prev-src"));
        }
    }
    
    onSwitchClick(e: MouseEvent): void {
        $(e.currentTarget).toggleClass("active");
    }
    
    onToggleScreenCoverClick(): void {
        this.$container.find(".screen-cover").closest(".preview").toggleClass("with-overlay");
    }
    
    onShowFullPreviewClick(): void {
        this.css = CssGenerator.generate(this.data);
        this.title = <string>this.$component.find("input[data-editor=\"title\"]").val();
        this.triggerEvent("fullPreview", JSON.stringify({
            title: this.title,
            css: this.css,
            cssVariables: null,
            logoHeader: this.logoHeader,
            logoHeaderWh: this.logoHeaderWh,
            logoLoginScreen: this.logoLoginScreen,
        }));
    }
    
    setAdvancedMode(advancedMode: boolean) {
        this.$component.toggleClass("advanced-mode", advancedMode);
        this.$component.toggleClass("simple-mode", !advancedMode);
    }
    
    onUploadLogo(e: any): void {
        let files = e.target.files;
        let id = $(e.target).data("file-id");
        let type = id == LogoTypes.header ? LogoTypes.header : (id == LogoTypes.headerWh ? LogoTypes.headerWh : LogoTypes.loginScreen);
        for (let f of files) {
            if (!f.type.match('image.*')) {
                continue;
            }
            var reader = new FileReader();
            reader.onload = (e: any) => {
                let $img = this.$component.find(".preview-" + type);
                if (!$img.data("prev-src")) {
                    $img.data("prev-src", $img.attr("src"));
                }
                $img.attr("src", e.target.result);
                if (type == LogoTypes.header) {
                    this.logoHeader = e.target.result;
                }
                else if (type == LogoTypes.headerWh) {
                    this.logoHeaderWh = e.target.result;
                }
                else {
                    this.logoLoginScreen = e.target.result;
                }
            };
            reader.readAsDataURL(f);
        }
    }
    
    onRestoreClick(): void {
        this.triggerEvent("restoreDefaults");
    }
    
    onToggleAdvancedGradientClick(): void {
        this.toggleGradientMode();
    }
    
    toggleGradientMode(): void {
        let $btn = this.$container.find("[data-action=\"toggle-advanced-gradient\"]");
        let advanced = $btn.data("mode") == "advanced";
        advanced = !advanced;
        $btn.data("mode", advanced ? "advanced" : "simple");
        $btn.find(".simple-text").toggleClass("hidden", advanced);
        $btn.find(".advanced-text").toggleClass("hidden", !advanced);
        this.updateGradientMode(advanced);
    }
    
    updateGradientMode(advanced: boolean): void {
        this.$component.find(".color-input[data-customization-variable=\"--body-secondary-fg\"]").closest(".color-input-wrapper").toggleClass("hidden", advanced);
        this.$component.find(".color-input[data-customization-variable=\"--gradient-color1\"]").closest(".color-input-wrapper").toggleClass("hidden", !advanced);
        this.$component.find(".color-input[data-customization-variable=\"--gradient-color2\"]").closest(".color-input-wrapper").toggleClass("hidden", !advanced);
        this.$component.find(".color-input[data-customization-variable=\"--gradient-color3\"]").closest(".color-input-wrapper").toggleClass("hidden", !advanced);
        this.$component.find(".color-input[data-customization-variable=\"--gradient-color4\"]").closest(".color-input-wrapper").toggleClass("hidden", !advanced);
    }
    
}
