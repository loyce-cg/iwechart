import {WindowView} from "../base/BaseWindowView";
import {func as playerTemplate} from "./template/player.html";
import {app} from "../../Types";
import {EditorWindowView} from "../editor/EditorWindowView";

@WindowView
export class VideoWindowView extends EditorWindowView {
    
    constructor(parent: app.ViewParent) {
        super(parent);
    }
    
    focus() {
        this.$main.find(".c-player video").focus();
    }
    
    clearState(addLoading: boolean) {
        this.$inner.find(".c-player").remove();
        super.clearState(addLoading);
    }
    
    setDataCore(currentViewId: number, data: app.BlobData) {
        this.$inner.find(".c-player").remove();
        this.$inner.append(this.templateManager.createTemplate(playerTemplate).renderToJQ());
        let vid = <HTMLVideoElement>this.$inner.find("video")[0];
        
        vid.onloadeddata = this.onVideoLoad.bind(this, currentViewId);
        vid.src = this.getResourceDataUrl(data);
    }
    
    setSize(type: string): void {
        if (type != "minimize") {
            this.$main.find(".inner video").hide().show(0);
        }
    }
    
    onVideoLoad(currentViewId: number): void {
        if (currentViewId != this.currentViewId) {
            return;
        }
        this.clearLoading();
        this.$inner.find(".c-player").removeClass("hide");
        let video = <HTMLVideoElement>this.$inner.find("video")[0];
        this.triggerEvent("detectVideoSize", this.currentViewId, video.videoWidth, video.videoHeight);
    }
    
    stopPlayback(): void {
        if (!this.$inner) {
            return;
        }
        let video = <HTMLVideoElement>this.$inner.find("video")[0];
        if (!video) {
            return;
        }
        video.pause();
    }
}
