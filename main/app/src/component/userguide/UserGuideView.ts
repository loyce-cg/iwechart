import { ComponentView } from "../base/ComponentView";
import {func as mainTemplate} from "./template/index.html";
import Q = require("q");
import { Model } from "./UserGuideController";
import * as $ from "jquery";

export interface ElementPos {
    top: number;
    left: number;
    angle?: number;
}

export class UserGuideView extends ComponentView {
    animationOffset: number = 15;
    $main: JQuery;
    $container: JQuery;
    arrowWidth: number;
    arrowHeight: number;
    model: Model;
    $hole: JQuery;
    $holeContainer: JQuery;
    $arrow: JQuery;
    holeContainerOffset: number;
    constructor(public parent: ComponentView) {
        super(parent);
    }
    
    init(model: Model): Q.Promise<void> {
        this.model = model;
        return Q().then(() => {
            let $template = this.templateManager.createTemplate(mainTemplate).renderToJQ(model);
            this.$container.append($template);
            this.$container.on("click", "[trigger-action]", this.onActionClick.bind(this));
            this.$hole = this.$container.find(".hole");
            this.$hole.css("width", model.options.width + "px");
            this.$hole.css("height", model.options.height + "px");

            this.$holeContainer = this.$container.find(".info");
            this.holeContainerOffset = (this.$holeContainer.outerWidth() - model.options.width) / 2;
            let holeContainerLeft = (model.options.centerX - model.options.width / 2) - this.holeContainerOffset; 
            this.$holeContainer.css("top", (model.options.centerY - model.options.height / 2) + "px");
            this.$holeContainer.css("left", holeContainerLeft + "px");

            this.$hole.css("top", 0);
            this.$hole.css("left", this.holeContainerOffset + "px");

            // shape
            if (model.options.shape) {
                switch(model.options.shape) {
                    case "rectangle": break;
                    case "circle": this.$hole.css("border-radius", "50%"); break;
                    case "rounded-rectangle": this.$hole.css("border-radius", ((model.options.width + model.options.height) / 2 * 5 / 100) + "px"); break;
                }
            }

            this.$arrow = this.$container.find(".arrow");
            this.arrowWidth = this.$arrow.outerWidth();
            this.arrowHeight = this.$arrow.outerHeight();

            let arrowPos = this.getArrowPos(model);
            this.$arrow.css("top", arrowPos.top + "px");
            this.$arrow.css("left", arrowPos.left + this.holeContainerOffset + "px");
            this.$arrow.addClass("rotate-" + arrowPos.angle);
        });
    }

    onActionClick(e: Event): void {
        let action = $(e.target).attr("trigger-action");
        this.triggerEvent("action", action);
    }

    close(): void {
        this.$container.remove();
    }

    getArrowPos(model: Model): ElementPos {
        let pos: ElementPos;        
        switch(model.options.side) {
            case "top": pos = {
                top: -this.arrowHeight - this.animationOffset,
                left: model.options.width / 2 - this.arrowWidth / 2,
                angle: 180
            };  break;
            case "right": pos = {
                top: model.options.height / 2 - this.arrowHeight / 2,
                left: model.options.width + this.arrowWidth / 2,
                angle: 270
            };  break;
            case "bottom": pos = {
                top: model.options.height + this.animationOffset,
                left: model.options.width / 2 - this.arrowWidth / 2,
                angle: 0
            };  break;
            case "left": pos = {
                top: model.options.height / 2 - this.arrowHeight / 2,
                left: -this.arrowWidth - this.animationOffset,
                angle: 90
            };  break;
            case "top-right": pos = {
                top: -this.arrowHeight - this.animationOffset / 2,
                left: model.options.width + this.animationOffset / 2,
                angle: 225
            };  break;
            case "top-left": pos = {
                top: -this.arrowHeight - this.animationOffset/2,
                left: -this.arrowWidth - this.animationOffset/2,
                angle: 135
            };  break;
            case "bottom-right": pos = {
                top: model.options.height + this.animationOffset / 2,
                left: model.options.width + this.animationOffset / 2,
                angle: 315
            };  break;
            case "bottom-left": pos = {
                top: model.options.height + this.animationOffset / 2,
                left: -this.arrowWidth - this.animationOffset / 2,
                angle: 45
            };  break;

        }
        return pos;
    }

    updatePos(x: number, y: number): void {
        let holeContainerLeft = (x - this.model.options.width / 2) - this.holeContainerOffset; 
        this.$holeContainer.css("top", (y - this.model.options.height / 2) + "px");
        this.$holeContainer.css("left", holeContainerLeft + "px");

        this.$hole.css("top", 0);
        this.$hole.css("left", this.holeContainerOffset + "px");

        let arrowPos = this.getArrowPos(this.model);
        this.$arrow.css("top", arrowPos.top + "px");
        this.$arrow.css("left", arrowPos.left + this.holeContainerOffset + "px");

    }
}