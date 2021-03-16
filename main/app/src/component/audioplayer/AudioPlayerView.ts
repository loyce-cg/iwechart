import { ComponentView } from "../base/ComponentView";
import { func as mainTemplate } from "./template/index.html";
import { app } from "../../Types";
import { Model } from "./AudioPlayerController";
import { PlayerControlsView } from "../playercontrols/web";

export class AudioPlayerView extends ComponentView {
    
    $container: JQuery;
    $component: JQuery;
    $audio: JQuery<HTMLAudioElement>;
    playerControls: PlayerControlsView;
    
    set volume(value: number) {
        this.triggerEvent("setVolume", value);
        this.$audio[0].volume = value;
    }
    get volume(): number {
        return this.$audio[0].volume;
    }
    
    set muted(value: boolean) {
        this.triggerEvent("setMuted", value);
        this.$audio[0].muted = value;
    }
    get muted(): boolean {
        return this.$audio[0].muted;
    }
    
    set currentTime(value: number) {
        this.triggerEvent("setCurrentTime", value);
        this.$audio[0].currentTime = value;
    }
    get currentTime(): number {
        return this.$audio[0].currentTime;
    }
    
    set src(value: string) {
        this.$audio[0].src = value;
    }
    get src(): string {
        return this.$audio[0].src;
    }
    
    set srcObject(value: MediaStream | MediaSource | Blob) {
        this.$audio[0].srcObject = value;
    }
    get srcObject(): MediaStream | MediaSource | Blob {
        return this.$audio[0].srcObject;
    }
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this.playerControls = this.addComponent("playercontrols", new PlayerControlsView(this));
    }
    
    async init(model: Model): Promise<void> {
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ(model);
        this.$container.content(this.$component);
        
        this.$audio = this.$component.find("audio") as JQuery<HTMLAudioElement>;
        this.$audio[0].onended = this.onAudioEnded.bind(this);
        this.$audio[0].ondurationchange = this.onAudioDurationChanged.bind(this);
        
        this.playerControls.$container = this.$component.find(".player-controls-container");
        await this.playerControls.triggerInit();
    }
    
    setVolume(volume: number): void {
        this.volume = volume;
    }
    
    setMuted(muted: boolean): void {
        this.muted = muted;
    }
    
    setCurrentTime(time: number): void {
        this.currentTime = time;
    }
    
    setSrc(source: string): void {
        this.src = source;
    }
    
    setSrcObject(sourceObject: MediaStream | MediaSource | Blob): void {
        this.srcObject = sourceObject;
    }
    
    protected _play(): void {
        this.$audio[0].play();
    }
    
    protected _pause(): void {
        this.$audio[0].pause();
    }
    
    play(): void {
        this.triggerEvent("play");
    }
    
    pause(): void {
        this.triggerEvent("pause");
    }
    
    onAudioEnded(): void {
        this.triggerEvent("audioEnded");
    }
    
    onAudioDurationChanged(): void {
        if (Number.isFinite(this.$audio[0].duration)) {
            this.$audio[0].currentTime = 0;
            this.triggerEvent("audioDurationChanged", this.$audio[0].duration, this.$audio[0].currentTime);
        }
        else {
            this.$audio[0].currentTime = 86400;
        }
    }
    
    beforeContainerDetach(): void {
        this.triggerEvent("stop")
    }
    
    afterContainerReattach(): void {
        this.playerControls.slider.update();
    }
    
}
