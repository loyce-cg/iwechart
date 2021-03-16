import {WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import {EditorWindowView} from "../editor/EditorWindowView";
import Q = require("q");
import * as $ from "jquery";
import { ThumbsView, ThumbLoadedEvent, ThumbState } from "../../component/thumbs/ThumbsView";
import { WebUtils } from "../../web-utils";
import { section } from "../../mail";

@WindowView
export class ImageWindowView extends EditorWindowView {
    
    static readonly AVAILABLE_ZOOM_LEVELS: number[] = [0.25, 0.375, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];
    static readonly DEFAULT_ZOOM_LEVEL_ID: number = 7;
    
    zoomLevels: number[] = ImageWindowView.AVAILABLE_ZOOM_LEVELS;
    zoomLevelId: number = ImageWindowView.DEFAULT_ZOOM_LEVEL_ID;
    thumbs: ThumbsView;
    image: HTMLImageElement;
    dataUrl: string;
    fileDid: string;
    fileSectionId: string;
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
        super.setDataCore(this.currentViewId, data);
        if (this.image) {
            this.image.src = "";
            this.image = null;
            this.$inner.find("img").remove();
        }
        this.$inner.find("img").remove();

        this.image = document.createElement("img");
        console.log("setting up src", this.getNamedResourceDataURL(this.fileDid, data));
        this.image.src = this.currentDataUrl;
        this.image.onload = () => {
            WebUtils.revokeNamedObjectURL(this.fileDid);
            this.onImageLoad(currentViewId);
        }
        this.$inner.append(this.image);
        this.setZoomLevelId(ImageWindowView.DEFAULT_ZOOM_LEVEL_ID);
    }
    
    setSize(type: string): void {
        if (type != "minimize") {
            this.$inner.find("img").hide().show(0);
        }
    }
    
    onImageLoad(currentViewId: number): void {
        
        if (currentViewId != this.currentViewId) {
            console.log("onImageLoad: wrong viewId")
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
        this.zoomLevelId = zoomLevelId;
        let zoomLevel = this.zoomLevels[this.zoomLevelId];
        let $elem = this.$inner.find("img");
        $elem.css("position", "relative");
        $elem.css("transform", `scale(${zoomLevel})`);
        let x = parseInt($elem.css("left")) || 0;
        let y = parseInt($elem.css("top")) || 0;
        [x, y] = this.adjustCoordsToMakeImgVisible($elem, x, y);
        $elem.css("left", x + "px");
        $elem.css("top", y + "px");
        let x0 = 0;
        let y0 = 0;
        $elem.parent().off("mousedown.dragmove").on("mousedown.dragmove", e0 => {
            x0 = parseInt($elem.css("left")) || 0;
            y0 = parseInt($elem.css("top")) || 0;
            $elem.data("orig-position", $elem.css("position"));
            $elem.css("position", "relative");
            $elem.attr("draggable", "false");
            $(document).off("mousemove.dragmove").on("mousemove.dragmove", e => {
                let x = x0 + (e.screenX - e0.screenX);
                let y = y0 + (e.screenY - e0.screenY);
                [x, y] = this.adjustCoordsToMakeImgVisible($elem, x, y);
                $elem.css("left", x + "px");
                $elem.css("top", y + "px");
            });
            $(document).off("mouseup.dragmove").on("mouseup.dragmove", () => {
                $(document).off("mousemove.dragmove");
                $(document).off("mouseup.dragmove");
            });
        });
        $elem.parent().off("mousewheel.wheelmove").on("mousewheel.wheelmove", e => {
            let x = parseInt($elem.css("left")) || 0;
            let y = parseInt($elem.css("top")) || 0;
            $elem.data("orig-position", $elem.css("position"));
            $elem.css("position", "relative");
            let d = (<any>e).originalEvent.wheelDelta / 2;
            if (e.shiftKey) {
                x += d;
                [x, y] = this.adjustCoordsToMakeImgVisible($elem, x, y);
                $elem.css("left", x + "px");
            }
            else {
                y += d;
                [x, y] = this.adjustCoordsToMakeImgVisible($elem, x, y);
                $elem.css("top", y + "px");
            }
        });
    }
    
    adjustCoordsToMakeImgVisible($img: JQuery, x: number, y: number): [number, number] {
        let imgW = $img.width();
        let imgH = $img.height();
        let parentW = $img.parent().width();
        let parentH = $img.parent().height();
        
        
        let offsetX = (parentW - imgW) / 2;
        let offsetY = (parentH - imgH) / 2;
        let imgBox = {
            x0: offsetX + x,
            y0: offsetY + y,
            x1: offsetX + x + imgW,
            y1: offsetY + y + imgH,
        };
        let containerBox = {
            x0: 0,
            y0: 0,
            x1: 0 + parentW,
            y1: 0 + parentH,
        };
        let zoomLevel = this.zoomLevels[this.zoomLevelId];
        let minVisibleSize = 64 * zoomLevel;
        let viewBox = {
            x0: containerBox.x0 + minVisibleSize,
            y0: containerBox.y0 + minVisibleSize,
            x1: containerBox.x1 - minVisibleSize,
            y1: containerBox.y1 - minVisibleSize,
        };
        
        if (imgBox.x1 < viewBox.x0) {
            // Image too far left
            x += viewBox.x0 - imgBox.x1;
        }
        else if (imgBox.x0 > viewBox.x1) {
            // Image too far right
            x -= imgBox.x0 - viewBox.x1;
        }
        if (imgBox.y1 < viewBox.y0) {
            // Image too far up
            y += viewBox.y0 - imgBox.y1;
        }
        else if (imgBox.y0 > viewBox.y1) {
            // Image too far down
            y -= imgBox.y0 - viewBox.y1;
        }
        
        return [x, y];
    }
    
    processThumbs(): void {
        this.thumbs.processThumbs();
    }
    
    setThumb(did: string, sectionId: string, currentViewId: number): void {
        if (this.currentViewId != currentViewId) {
            return;
        }

        this.releaseImg();
        let $img = $(`<img style="display:inline-block;" data-thumb-did="${did}" data-thumb-section-id="${sectionId}" data-thumb-state="${ThumbState.UNINITIALIZED}" data-thumb-in-place="false" />`);
        this.$inner.append($img);
        this.processThumbs();
    }

    updateFileData(did: string, sectionId: string, currentViewId: number): void {
        this.fileDid = did;
        this.fileSectionId = sectionId;
        this.setThumb(did, sectionId, this.currentViewId);
    }
    
    releaseImg() {
        if (this.image) {
            this.image.src = '';
            this.image.onload = null;
        }
        this.image = null;
        this.$inner.find("img").remove();
    }

    release(currentViewId: number) {
        if (this.currentViewId != currentViewId) {
            return;
        }
        this.releaseImg();
        super.release(currentViewId);
    }
}
