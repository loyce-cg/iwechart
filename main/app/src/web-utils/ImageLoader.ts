import * as $ from "jquery";
import {Image} from "./AvatarService";

export class ImageLoader {
    
    max: {width: number, height: number};
    onLoad: (dataUrl: string) => void;
    testMode: boolean;
    $input: JQuery;
    
    start() {
        this.$input = $("<input>").attr("type", "file");
        this.$input.on("change", this.onImageFileChoose.bind(this));
        if (this.testMode) {
            (<any>window).imageLoader = this;
            this.$input.addClass("nightwatch-file-upload");
            this.$input.css("height", "0px");
            $("body").append(this.$input);
        }
        else {
            this.$input.trigger("click");
        }
    }
    
    onImageFileChoose(event: Event): void {
        let reader = new FileReader();
        reader.onload = this.onImageFileLoad.bind(this);
        reader.readAsDataURL((<HTMLInputElement>event.target).files[0]);
        if (this.testMode) {
            delete (<any>window).imageLoader;
            this.$input.remove();
        }
    }
    
    onImageFileLoad(event: Event): void {
        let img = document.createElement("img");
        img.onload = this.onImageLoad.bind(this, img);
        img.src = (<FileReader>event.target).result;
    }
    
    onImageLoad(img: HTMLImageElement): void {
        let image = new Image(img, false);
        let canvas = document.createElement("canvas");
        image.drawTo(canvas, {
            width: this.max.width,
            height: this.max.height,
            autoSize: true
        });
        let dataUrl = canvas.toDataURL("image/png");
        if (dataUrl != "data:," && this.onLoad) {
            this.onLoad(dataUrl);
        }
    }
}

