import {WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import {EditorWindowView} from "../editor/EditorWindowView";
import {Model} from "./AudioWindowController";
import {func as fileInfoTemplate} from "./template/file-info.html";
import { PlayerControlsView } from "../../component/playercontrols/web";
import {WebUtils} from "../../web-utils/WebUtils";
import Q = require("q");

@WindowView
export class AudioWindowView extends EditorWindowView<Model> {
        
    playerControls: PlayerControlsView;
    audio: HTMLAudioElement;
    data: string;
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this.playerControls = this.addComponent("playerControls", new PlayerControlsView(this));
    }
    
    initWindow(model: any): Q.Promise<void> {
        return Q().then(() => {
            return super.initWindow(model);
        })
        .then(() => {
            this.playerControls.$container = this.$main.find(".independent-player-container");
            return this.playerControls.triggerInit();
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
        this.$inner.find(".file-info").remove();
        super.clearState(addLoading);
    }
    
    setDataCore(_currentViewId: number, model: Model): void {
        this.playerControls.$container.detach();
        this.$inner.find(".file-info").remove();
        this.$inner.append(this.templateManager.createTemplate(fileInfoTemplate).renderToJQ(model));
        if (this.audio) {
            this.$inner.find("audio").replaceWith(this.audio);
        }
        else {
            this.audio = <HTMLAudioElement>this.$inner.find("audio")[0];
        }
        this.audio.onended = this.onAudioEnded.bind(this);
        this.audio.ondurationchange = this.onAudioDurationChanged.bind(this);
        this.$inner.find(".file-info").append(this.playerControls.$container);
        this.clearLoading();
        this.$inner.find(".audio-buttons").css("display", model.canPlay ? "block" : "none");
        this.triggerEvent("pause");
        this.playerControls.bindEvents();
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
        this.audio.src = this.data;
    }
    
    onAudioEnded(): void {
        this.triggerEvent("audioEnded");
    }
    
    onAudioDurationChanged(): void {
        this.triggerEvent("audioDurationChanged", this.currentViewId, this.audio.duration, this.audio.currentTime);
    }
    
    play(): void {
        this.audio.play();
    }
    
    pause(): void {
        this.audio.pause();
    }
    
    setVolume(volume: number): void {
        this.audio.volume = volume;
    }
    
    setMuted(muted: boolean): void {
        this.audio.muted = muted;
    }
    
    setTime(time: number): void {
        this.audio.currentTime = time;
    }
    
}
