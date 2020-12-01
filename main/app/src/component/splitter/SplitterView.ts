import {ComponentView} from "../base/ComponentView";
import {func as mainTemplate} from "./index.html";
import * as $ from "jquery";
import {webUtils} from "../../Types";
import {app} from "../../Types";
import {Model} from "./SplitterController";

export interface Options {
    type: string;
    flip?: boolean;
    handlePlacement?: string;
    handleDot?: boolean;
    firstPanelMinSize?: number|(() => number);
    secondPanelMinSize?: number|(() => number);
}

export class SplitterView extends ComponentView {
    
    mainTemplate: webUtils.MailTemplate<{type: string}>;
    $container: JQuery;
    type: string;
    flip: boolean;
    handleDot: boolean;
    firstPanelMinSize: number|(() => number);
    secondPanelMinSize: number|(() => number);
    handlePlacement: string;
    relativeHandlePosition: number;
    relativeHandlePositionPercent: number;
    proportional: boolean;
    $component: JQuery;
    $handle: JQuery;
    $left: JQuery;
    $right: JQuery;
    $top: JQuery;
    $bottom: JQuery;
    _onRedrawHandler: () => void;
    
    constructor(parent: app.ViewParent, options: Options) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.type = options.type || "vertical";
        this.flip = options.flip;
        this.handlePlacement = options.handlePlacement;
        this.handleDot = options.handleDot;
        this.firstPanelMinSize = options.firstPanelMinSize ? options.firstPanelMinSize : 0;
        this.secondPanelMinSize = options.secondPanelMinSize ? options.secondPanelMinSize : 0;
        if (this.type != "horizontal" && this.type != "vertical") {
            throw new Error("Invalid type - " + this.type);
        }
        $(window).on("resize", this.onWindowResize.bind(this));
    }
    
    init(model: Model): void {
        this.render(model);
        this.$container.on("custom-redraw", this.onCustomRedraw.bind(this));
    }
    
    render(model: Model): void {
        this.$component = this.mainTemplate.renderToJQ({type: this.type});
        this.$container.content(this.$component);
        if (this.type == "vertical") {
            this.initVertical();
        }
        else {
            this.initHorizontal();
        }
        this.setModel(model);
    }
    
    initVertical() {
        this.$handle = this.$component.find(".component-splitter-handle").first();
        if (this.handleDot) {
            this.$handle.append("<div class='handle-dot-"+this.type+"'></div>");
        }
        this.$left = this.$component.find(".component-splitter-panel-left");
        this.$right = this.$component.find(".component-splitter-panel-right");
        this.$handle.off("mousedown.component-splitter").on("mousedown.component-splitter", this.getHandleFunction(event => {
            let posX = event.pageX - this.$component.offset().left;
            this.setFirstElementSize(posX);
        }));
    }
    
    onHandleMove() {
        this.dispatchEvent({type: "handleMove", position: this.relativeHandlePosition, emitterElement: this.$handle});
        this.triggerEvent("changeRelativeHandlePosition", this.relativeHandlePosition, this.proportional ? this.getTotalSize() : null, this.flip);
        this.redraw();
        this.updateRelativeHandlePositionPercent();
    }
    
    setFirstElementSize(size: number): void {
        let firstPanelMinSize = typeof(this.firstPanelMinSize) == "function" ? this.firstPanelMinSize() : this.firstPanelMinSize;
        let secondPanelMinSize = typeof(this.secondPanelMinSize) == "function" ? this.secondPanelMinSize() : this.secondPanelMinSize;
        if (this.type == "vertical") {
            let posX = size;
            let firstPanelMaxSize = this.$component.outerWidth() - this.$handle.outerWidth() - secondPanelMinSize;
            let handlePosition = Math.min(Math.max(posX, firstPanelMinSize), firstPanelMaxSize);
            this.relativeHandlePosition = this.flip ? this.$component.outerWidth() - handlePosition : handlePosition;
            this.onHandleMove();
        }
        else {
            let posY = size;
            let firstPanelMaxSize = this.$component.outerHeight() - this.$handle.outerHeight() - secondPanelMinSize;
            let handlePosition = Math.min(Math.max(posY, firstPanelMinSize), firstPanelMaxSize);
            this.relativeHandlePosition = this.flip ? this.$component.outerHeight() - handlePosition : handlePosition;
            this.onHandleMove();
        }
    }
    
    
    initHorizontal() {
        this.$handle = this.$component.find(".component-splitter-handle").first();
        if (this.handleDot) {
            this.$handle.append("<div class='handle-dot-"+this.type+"'></div>");
        }
        this.$top = this.$component.find(".component-splitter-panel-top");
        this.$bottom = this.$component.find(".component-splitter-panel-bottom");
        this.$handle.off("mousedown.component-splitter").on("mousedown.component-splitter", this.getHandleFunction(event => {
            let posY = event.pageY - this.$component.offset().top;
            this.setFirstElementSize(posY);
        }));
    }
    
    setModel(model: Model) {
        if (model.totalSize !== null) {
            this.proportional = true;
            let diffFlip = typeof(model.flip) == "boolean" && model.flip != this.flip;
            this.relativeHandlePositionPercent = model.handlePos / model.totalSize;
            if (diffFlip) {
                this.relativeHandlePositionPercent = 1 - this.relativeHandlePositionPercent;
            }
            this.updateRelativeHandlePosition();
        }
        else {
            this.proportional = false;
            this.relativeHandlePosition = model.handlePos;
        }
        this.redraw();
    }
    
    onCustomRedraw(e: Event): void {
        if (e.target == this.$container.get(0)) {
            this.redraw();
        }
    }
    
    redraw(): void {
        if (this.type == "vertical") {
            let handleWidth = this.$handle.outerWidth();
            if (this.flip) {
                this.$handle.css({left: "auto", right: this.relativeHandlePosition + "px"});
                this.$left.css({left: "0", right: this.relativeHandlePosition + (this.handlePlacement == "left" ? 0 : handleWidth) + "px", width: "auto"});
                this.$right.css({left: "auto", right: "0", width: this.relativeHandlePosition + (this.handlePlacement == "right" ? handleWidth : 0) + "px"});
            }
            else {
                this.$handle.css({left: this.relativeHandlePosition + "px", right: "auto"});
                this.$left.css({left: "0", right: "auto", width: this.relativeHandlePosition + (this.handlePlacement == "left" ? handleWidth : 0) + "px"});
                this.$right.css({left: this.relativeHandlePosition + (this.handlePlacement == "right" ? 0 : handleWidth) + "px", right: "0", width: "auto"});
            }
            this.$left.trigger("custom-redraw");
            this.$right.trigger("custom-redraw");
        }
        else {
            let handleHeight = this.$handle.outerHeight();
            if (this.flip) {
                this.$handle.css({top: "auto", bottom: this.relativeHandlePosition + "px"});
                this.$top.css({top: "0", bottom: this.relativeHandlePosition + (this.handlePlacement == "top" ? 0 : handleHeight) + "px", height: "auto"});
                this.$bottom.css({top: "auto", bottom: "0", height: this.relativeHandlePosition + (this.handlePlacement == "bottom" ? handleHeight : 0) + "px"});
            }
            else {
                this.$handle.css({top: this.relativeHandlePosition + "px", bottom: "auto"});
                this.$top.css({top: "0", bottom: "auto", height: this.relativeHandlePosition + (this.handlePlacement == "top" ? handleHeight : 0) + "px"});
                this.$bottom.css({top: this.relativeHandlePosition + (this.handlePlacement == "bottom" ? 0 : handleHeight) + "px", bottom: "0", height: "auto"});
            }
            this.$top.trigger("custom-redraw");
            this.$bottom.trigger("custom-redraw");
        }
        if (this._onRedrawHandler) {
            this._onRedrawHandler();
        }
    }
    
    getHandleFunction(cb: (e: JQueryEventObject) => void): () => void {
        return () => {
            let $backdrop = $('<div class="component-splitter-backdrop"></div>');
            $backdrop.addClass("component-splitter-backdrop-" + this.type);
            $backdrop.on("mousemove.component-splitter", cb);
            $backdrop.on("mouseup.component-splitter", () => {
                $backdrop.remove();
                $("body").removeClass("table-column-resizer-unselectable");
                this.dispatchEvent({type: "handleUp", position: this.relativeHandlePosition});
            });
            $("body").append($backdrop).addClass("table-column-resizer-unselectable");
        };
    }
    
    onWindowResize(): void {
        if (!this.proportional) {
            return;
        }
        this.updateRelativeHandlePosition();
    }
    
    getTotalSize(): number {
        return this.type == "vertical" ? this.$component.outerWidth() : this.$component.outerHeight();
    }
    
    updateRelativeHandlePosition(): void {
        this.relativeHandlePosition = this.relativeHandlePositionPercent * Math.max(1, this.getTotalSize());
        this.redraw();
    }
    
    updateRelativeHandlePositionPercent(): void {
        this.relativeHandlePositionPercent = this.relativeHandlePosition / Math.max(1, this.getTotalSize());
    }
    
    onRedraw(cb: () => void): void {
        this._onRedrawHandler = cb;
    }
    
}
