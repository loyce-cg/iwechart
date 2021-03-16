import {WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import {EditorWindowView} from "../editor/EditorWindowView";
import {Model} from "./AudioWindowController";
import {func as fileInfoTemplate} from "./template/file-info.html";
import { PlayerControlsView } from "../../component/playercontrols/web";
import {WebUtils} from "../../web-utils/WebUtils";
import Q = require("q");
import { AudioPlayerView } from "../../component/audioplayer/web";

@WindowView
export class AudioWindowView extends EditorWindowView<Model> {
    
    data: string;
    audioPlayer: AudioPlayerView;
    private _initialized: boolean = false;
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this.audioPlayer = this.addComponent("audioplayer", new AudioPlayerView(this));
    }
    
    initWindow(model: any): Q.Promise<void> {
        return Q().then(() => {
            return super.initWindow(model);
        })
        .then(() => {
            this.audioPlayer.$container = this.$main.find(".independent-player-container");
            return this.audioPlayer.triggerInit();
        })
        .then(() => {
            this._initialized = true;
        });
    }
    
    onInitWindow() {
        this.$main.on("click", "[data-action=add-to-playlist]", this.onAddToPlaylistClick.bind(this));
        this.$main.on("click", "[data-action=del-from-playlist]", this.onDelFromPlaylistClick.bind(this));
        this.$main.on("click", "[data-action=add-to-playlist-and-play]", this.onAddToPlaylistAndPlayClick.bind(this));
        this.$main.on("click", "[data-action=open]", this.onOpenClick.bind(this));
        this.$main.on("click", "[data-action=save]", this.onSaveClick.bind(this));
    }
    
    clearState(addLoading: boolean) {
        if (this._initialized) {
            this.audioPlayer.beforeContainerDetach();
        }
        this.detachAudioPlayerContainer();
        this.$inner.find(".file-info").remove();
        super.clearState(addLoading);
    }
    
    setDataCore(_currentViewId: number, model: Model): void {
        this.audioPlayer.$container.detach();
        this.audioPlayer.beforeContainerDetach();
        this.detachAudioPlayerContainer();
        this.$inner.find(".file-info").remove();
        this.$inner.append(this.templateManager.createTemplate(fileInfoTemplate).renderToJQ(model));
        this.$inner.find(".file-info").append(this.audioPlayer.$container);
        this.clearLoading();
        this.$inner.find(".audio-buttons").css("display", model.canPlay ? "block" : "none");
        this.audioPlayer.afterContainerReattach();
    }
    
    detachAudioPlayerContainer(): void {
        if (this.audioPlayer && this.audioPlayer.$container) {
            this.audioPlayer.$container.detach();
        }
    }
    
    setInPlaylist(inPlaylist: boolean) {
        this.$main.find("[data-action=add-to-playlist]").toggleClass("hidden", inPlaylist);
        this.$main.find("[data-action=del-from-playlist]").toggleClass("hidden", !inPlaylist);
    }
    
    onAddToPlaylistClick(): void {
        this.triggerEvent("addToPlaylist");
    }
    
    onAddToPlaylistAndPlayClick(): void {
        this.triggerEvent("addToPlaylistAndPlay");
    }
    
    onDelFromPlaylistClick(): void {
        this.triggerEvent("delFromPlaylist");
    }
    
    onOpenClick(): void {
        this.triggerEvent("openExternal");
    }

    onSaveClick(): void {
        this.triggerEvent("export");
    }
    
    setAudioData(data: app.BlobData): void {
        if (this.data) {
            URL.revokeObjectURL(this.data);
        }
        this.data = WebUtils.createObjectURL(data);
        this.audioPlayer.setSrc(this.data);
    }
    
}
