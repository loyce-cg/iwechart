import {WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import {EditorWindowView} from "../editor/EditorWindowView";
import Q = require("q");
import * as $ from "jquery";
import { ThumbsView, ThumbLoadedEvent, ThumbState } from "../../component/thumbs/ThumbsView";

@WindowView
export class ImageWindowView extends EditorWindowView {
    
    zoomLevels: number[] = [0.25, 0.375, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];
    zoomLevelId: number = 7;
    thumbs: ThumbsView;
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this.thumbs = this.addComponent("thumbs", new ThumbsView(this));
        this.thumbs.addEventListener<ThumbLoadedEvent>("thumbLoaded", e => {
        });
    }
    
    initWindow(model: any): Q.Promise<void> {
        return Q().then(() => {
            return super.initWindow(model);
        })
        .then(() => {
            this.thumbs.$container = this.$body;
            return this.thumbs.triggerInit();
        })
        .then(() => {
            this.$inner.append('<div class="zoom-in-out"><span class="zoom-out"><i class="fa fa-minus"></i></span><span class="zoom-in"><i class="fa fa-plus"></i></span></div>');
            this.$inner.on("click", ".zoom-in", this.onZoomInClick.bind(this));
            this.$inner.on("click", ".zoom-out", this.onZoomOutClick.bind(this));
        });
    }
    
    clearState(addLoading: boolean) {
        this.$inner.find("img").remove();
        super.clearState(addLoading);
    }
    
    setDataCore(currentViewId: number, data: app.BlobData) {
        this.$inner.find("img").remove();
        let img = document.createElement("img");
        img.src = this.getResourceDataUrl(data);
        img.onload = this.onImageLoad.bind(this, currentViewId);
        this.$inner.append(img);
    }
    
    setSize(type: string): void {
        if (type != "minimize") {
            this.$inner.find("img").hide().show(0);
        }
    }
    
    onImageLoad(currentViewId: number): void {
        if (currentViewId != this.currentViewId) {
            return;
        }
        this.clearLoading();
        this.$inner.find("img").addClass("loaded");
        let img = <HTMLImageElement>this.$inner.find("img")[0];
        this.triggerEvent("detectImageSize", this.currentViewId, img.naturalWidth, img.naturalHeight);
    }
    
    beforeImagePrint(): void {
        window.frameElement.parentElement.classList.add("absolute");
    }
    
    onZoomInClick(): void {
        this.zoomIn();
    }
    
    onZoomOutClick(): void {
        this.zoomOut();
    }
    
    zoomIn(): void {
        let zoomLevelId = Math.min(this.zoomLevels.length - 1, this.zoomLevelId + 1);
        this.setZoomLevelId(zoomLevelId);
    }
    
    zoomOut(): void {
        let zoomLevelId = Math.max(0, this.zoomLevelId - 1);
        this.setZoomLevelId(zoomLevelId);
    }
    
    setZoomLevelId(zoomLevelId: number): void {
        if (this.zoomLevelId == zoomLevelId) {
            return;
        }
        this.zoomLevelId = zoomLevelId;
        let zoomLevel = this.zoomLevels[this.zoomLevelId];
        let $elem = this.$inner.find("img");
        $elem.css("transform", `scale(${zoomLevel})`);
        if (zoomLevel < 1.0001) {
            let pos0 = $elem.data("orig-position");
            $elem.css("position", pos0);
            $elem.off("mousedown.dragmove");
            $elem.off("mousewheel.wheelmove");
            $elem.css({
                left: "initial",
                top: "initial",
                marginLeft: "initial",
                marginTop: "initial",
            });
            return;
        }
        else {
            let x = parseInt($elem.css("left")) || 0;
            let y = parseInt($elem.css("top")) || 0;
            [x, y] = this.adjustMarginCoords($elem, x, y);
            $elem.css("left", x + "px");
            $elem.css("top", y + "px");
        }
        let x0 = 0;
        let y0 = 0;
        $elem.off("mousedown.dragmove").on("mousedown.dragmove", e0 => {
            x0 = parseInt($elem.css("left")) || 0;
            y0 = parseInt($elem.css("top")) || 0;
            $elem.data("orig-position", $elem.css("position"));
            $elem.css("position", "relative");
            $elem.attr("draggable", "false");
            $(document).off("mousemove.dragmove").on("mousemove.dragmove", e => {
                let x = x0 + (e.screenX - e0.screenX);
                let y = y0 + (e.screenY - e0.screenY);
                [x, y] = this.adjustMarginCoords($elem, x, y);
                $elem.css("left", x + "px");
                $elem.css("top", y + "px");
            });
            $(document).off("mouseup.dragmove").on("mouseup.dragmove", () => {
                $(document).off("mousemove.dragmove");
                $(document).off("mouseup.dragmove");
            });
        });
        $elem.off("mousewheel.wheelmove").on("mousewheel.wheelmove", e => {
            let x = parseInt($elem.css("left")) || 0;
            let y = parseInt($elem.css("top")) || 0;
            $elem.data("orig-position", $elem.css("position"));
            $elem.css("position", "relative");
            let d = (<any>e).originalEvent.wheelDelta / 2;
            if (e.shiftKey) { 
                x += d;
                [x, y] = this.adjustMarginCoords($elem, x, y);
                $elem.css("left", x + "px");
            }
            else {
                y += d;
                [x, y] = this.adjustMarginCoords($elem, x, y);
                $elem.css("top", y + "px");
            }
        });
    }
    
    adjustMarginCoords($img: JQuery, x: number, y: number): [number, number] {
        let box = { left0: 0, top0: 0, left1: 0, top1: 0 };
        let imgW = $img.width();
        let imgH = $img.height();
        let parentW = $img.parent().width();
        let parentH = $img.parent().height();
        
        box.left0 = -(imgW - parentW) / 2;
        box.left1 = (imgW - parentW) / 2;
        box.top0 = -(imgH - parentH) / 2;
        box.top1 = (imgH - parentH) / 2;
        
        x = Math.min(Math.max(x, box.left0), box.left1);
        y = Math.min(Math.max(y, box.top0), box.top1);
        
        return [x, y];
    }
    
    processThumbs(): void {
        this.thumbs.processThumbs();
    }
    
    setThumb(did: string, sectionId: string, currentViewId: number): void {
        if (this.currentViewId != currentViewId) {
            return;
        }
        this.$inner.find("img").remove();
        let $img = $(`<img style="display:inline-block;" data-thumb-did="${did}" data-thumb-section-id="${sectionId}" data-thumb-state="${ThumbState.UNINITIALIZED}" data-thumb-in-place="false" />`);
        this.$inner.append($img);
        this.processThumbs();
    }
    
}
