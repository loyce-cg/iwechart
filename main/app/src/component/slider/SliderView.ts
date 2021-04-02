import {ComponentView} from "../base/ComponentView";
import {func as mainTemplate} from "./template/index.html";
import {app} from "../../Types";
import * as $ from "jquery";

export enum SliderTextFormat {
    INT = 1,
    HMS = 2,
    NO_TEXT = 3,
    INT_PERCENT = 4,
    FRACTION = 5,
    INT_FRACTION = 6,
}

export enum SliderOrientation {
    HORIZONTAL = 1,
    VERTICAL = 2,
}

export interface SliderOptions {
    textIncludeMax?: boolean;
    textFormat?: SliderTextFormat;
    orientation?: SliderOrientation;
    reverse?: boolean;
    size?: number;
    step?: number;
    changeEventDelay?: number;
}

export class SliderView extends ComponentView {
    
    $container: JQuery;
    $component: JQuery;
    $inner: JQuery;
    $fill: JQuery;
    $draggable: JQuery;
    $text: JQuery;
    $backdrop: JQuery;
    textIncludeMax: boolean;
    loading: boolean;
    progress: number;
    textFormat: SliderTextFormat;
    orientation: SliderOrientation;
    reverse: boolean;
    min: number = 0;
    max: number = 0;
    value: number = 0;
    size: number = 0;
    step: number = 0;
    changeEventDelay: number = 100;
    mouseMoveBound: any;
    mouseUpBound: any;
    dragStartState: { pos: number, clientX: number, clientY: number, width: number, height: number };
    dragTimeout: any;
    onValueChange: (value: number) => void = () => {};
    prevKnownLen: number = 0;
    
    constructor(parent: app.ViewParent, options: SliderOptions) {
        super(parent);
        this.textIncludeMax = !!options.textIncludeMax;
        this.textFormat = options.textFormat ? options.textFormat : SliderTextFormat.INT;
        this.orientation = options.orientation ? options.orientation : SliderOrientation.HORIZONTAL;
        this.reverse = options.reverse;
        this.size = options.size ? options.size : 200;
        this.changeEventDelay = typeof(options.changeEventDelay) == "number" ? options.changeEventDelay : 100;
        this.step = typeof(options.step) == "number" ? options.step : -1;
    }
    
    init() {
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ({
            orientation: this.orientation,
            reverse: this.reverse,
        });
        this.$container.content(this.$component);
        this.$inner = this.$component.find(".inner");
        this.$fill = this.$component.find(".fill");
        this.$draggable = this.$component.find(".draggable");
        this.$text = this.$component.find(".text");
        this.$backdrop = this.$component.find(".backdrop");
        
        this.bindEvents();
        this.mouseMoveBound = this.onDraggableMouseMove.bind(this);
        this.mouseUpBound = this.onDraggableMouseUp.bind(this);
        
        if (this.textFormat == SliderTextFormat.NO_TEXT) {
            this.$component.find(".text").css("display", "none");
        }
        if (this.orientation == SliderOrientation.HORIZONTAL) {
            this.$component.css("min-width", this.size);
        }
        else {
            this.$component.css("min-height", this.size);
        }
        
        this.update();
    }
    
    bindEvents(): void {
        this.$component.off("mousedown.sv-md").on("mousedown.sv-md", ".draggable", this.onDraggableMouseDown.bind(this));
        this.$component.off("click.sv-cl").on("click.sv-cl", ".inner", this.onInnerClick.bind(this));
    }
    
    setMin(min: number) {
        this.min = min;
        this.update();
    }
    
    setMax(max: number) {
        this.max = max;
        this.update();
    }
    
    setStep(step: number) {
        this.step = step;
        this.update();
    }
    
    setValue(value: number) {
        this.value = value;
        this.update();
    }
    
    setLoading(loading: boolean) {
        this.loading = loading;
        this.progress = 0;
        this.update();
    }
    
    setProgress(progress: number) {
        this.progress = progress;
        this.update();
    }
    
    update() {
        if (this.$fill.closest("html").length == 0) {
            return;
        }
        let ver = this.orientation == SliderOrientation.VERTICAL;
        // Position
        let len = ver ? this.$inner.height() : this.$inner.width();
        if (len == 0) {
            len = this.prevKnownLen;
        }
        else {
            this.prevKnownLen = len;
        }
        let v = this.value;
        if (this.step > 0) {
            let n = Math.round((v - this.min) / this.step);
            v = n * this.step + this.min;
        }
        v = (v - this.min) / (this.max - this.min);
        let pos = (this.max - this.min == 0) ? 0 : (len * v);
        let prop = this.orientation == SliderOrientation.HORIZONTAL ? (this.reverse ? "right" : "left") : (this.reverse ? "bottom" : "top");
        pos = Math.min(len, Math.max(0, pos));
        this.$draggable.css(prop, pos);
        if (ver) {
            this.$fill.height(pos);
        }
        else {
            this.$fill.width(pos);
        }
        
        // Text
        if (this.loading) {
            let $progress = this.$text.find(".slider-progress");
            if ($progress.length == 0) {
                this.$text.empty().append('<i class="fa fa-spin fa-circle-o-notch"></i> <span class="slider-progress"></span>');
                $progress = this.$text.find(".slider-progress");
            }
            $progress.text(this.progress != null ? this.progress + "%" : "");
        }
        else {
            let text = this.formatText(this.value) + (this.textIncludeMax ? " / " + this.formatText(this.max) : "");
            this.$text.text(text);
        }
    }
    
    formatText(value: number): string {
        let text = "";
        if (this.textFormat == SliderTextFormat.INT) {
            value = Math.round(value);
            text += value;
        }
        else if (this.textFormat == SliderTextFormat.HMS) {
            value = Math.round(value);
            let h = Math.floor(value / 3600);
            value -= h * 3600;
            let m = Math.floor(value / 60);
            value -= m * 60;
            let s = value;
            if (h > 0) {
                text += h + ":";
            }
            text += (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
        }
        else if (this.textFormat == SliderTextFormat.NO_TEXT) {
            text = "";
        }
        else if (this.textFormat == SliderTextFormat.INT_PERCENT) {
            value = Math.round(value * 100);
            text = `${value}%`;
        }
        else if (this.textFormat == SliderTextFormat.FRACTION) {
            value = Math.round(value * 100) / 100;
            const maxValue = Math.round(this.max * 100) / 100;
            text = `${value} / ${maxValue}`;
        }
        else if (this.textFormat == SliderTextFormat.INT_FRACTION) {
            value = Math.round(value);
            const maxValue = Math.round(this.max);
            text = `${value} / ${maxValue}`;
        }
        return text;
    }
    
    onInnerClick(e: MouseEvent): void {
        let ver = this.orientation == SliderOrientation.VERTICAL;
        let bbox = this.$inner.get(0).getBoundingClientRect();
        let bboxSize = ver ? bbox.height : bbox.width;
        let offset = ver ? e.clientY - bbox.top : e.clientX - bbox.left;
        let relPos = this.reverse ? 1 - offset / bboxSize : offset / bboxSize;
        let newValue = this.min + relPos * (this.max - this.min);
        this.setValue(newValue);
        this.triggerUserValueChange(newValue);
    }
    
    onDraggableMouseDown(e: MouseEvent): boolean {
        let ver = this.orientation == SliderOrientation.VERTICAL;
        this.dragStartState = {
            pos: ver ? this.$fill.height() : this.$fill.width(),
            clientX: e.clientX,
            clientY: e.clientY,
            width: this.$inner.width(),
            height: this.$inner.height(),
        };
        $(document).on("mouseup", this.mouseUpBound);
        $(document).on("mousemove", this.mouseMoveBound);
        this.$backdrop.css("display", "block");
        return false;
    }
    
    onDraggableMouseUp(e: MouseEvent): void {
        $(document).off("mouseup", this.mouseUpBound);
        $(document).off("mousemove", this.mouseMoveBound);
        this.$backdrop.css("display", "none");
    }
    
    onDraggableMouseMove(e: MouseEvent): void {
        let ver = this.orientation == SliderOrientation.VERTICAL;
        let newPos = this.dragStartState.pos + (ver ? this.dragStartState.clientY - e.clientY : e.clientX - this.dragStartState.clientX);
        let newValue = newPos * (this.max - this.min) / (ver ? this.dragStartState.height : this.dragStartState.width) + this.min;
        newValue = Math.min(this.max, Math.max(this.min, newValue));
        this.setValue(newValue);
        if (this.changeEventDelay > 0) {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = setTimeout(() => {
                this.triggerUserValueChange(newValue);
            }, 100);
        }
        else {
            this.triggerUserValueChange(newValue);
        }
    }
    
    triggerUserValueChange(value: number): void {
        this.onValueChange(value);
        this.triggerEvent("userValueChange", value);
    }
    
}
