import { ComponentController } from "../base/ComponentController";
import { app, event } from "../../Types";
import Q = require("q");
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Dependencies, Inject } from "../../utils/Decorators";
import { PlayerControlsController } from "../playercontrols/main";
import { CommonApplication } from "../../app/common";
import { BasicPlayerEvent, SetPlayerOptionEvent, SetPlayerVolumeEvent } from "../../app/common/musicPlayer/PlayerManager";
import { ComponentFactory } from "../main";

export interface LoadAudioTrackEvent extends event.Event {
    type: "load-audio-track";
}

export interface Model {
}

@Dependencies(["playercontrols"])
export class AudioPlayerController extends ComponentController {
    
    static textsPrefix: string = "component.audioplayer.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject componentFactory: ComponentFactory;
    
    afterViewLoaded: Q.Deferred<void>;
    playerControls: PlayerControlsController;
    tickInterval: number = null;
    time: number;
    trackEnded: boolean = false;
    trackLoaded: boolean = false;
    playing: boolean = false;
    
    constructor(parent: app.IpcContainer, public app: CommonApplication) {
        super(parent);
        this.afterViewLoaded = Q.defer();
        this.ipcMode = true;
        
        this.playerControls = this.addComponent("playercontrols", this.componentFactory.createComponent("playercontrols", [this, true]));
        this.playerControls.setApp(this.app);
        this.playerControls.onViewPlay = () => {
            this.play();
        };
        this.playerControls.onViewPause = () => {
            this.pause();
        };
        this.bindEvent<SetPlayerVolumeEvent>(this.playerControls, "set-player-volume", event => {
            this.callViewMethod("setVolume", event.volume);
            this.playerControls.setVolume(event.volume);
        });
        this.bindEvent<SetPlayerOptionEvent>(this.playerControls, "set-player-option", event => {
            if (event.option == "muted") {
                this.callViewMethod("setMuted", event.value);
            }
        });
        this.bindEvent<BasicPlayerEvent>(this.playerControls, "player-set-time", event => {
            let time = Math.min(event.value, this.playerControls.slider.max)
            this.time = time;
            this.trackEnded = time >= this.playerControls.slider.max;
            this.callViewMethod("setCurrentTime", this.time);
            if (this.tickInterval) {
                this._clearTickInterval();
                this._setTickInterval();
            }
        });
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
    }
    
    onViewAudioEnded(): void {
        this.trackEnded = true;
        this.playing = false;
        this.time = this.playerControls.slider.max;
        this.playerControls.slider.setValue(this.time);
        this.playerControls.setPlaying(false);
        this._clearTickInterval();
    }
    
    getModel(): Model {
        return {};
    }
    
    reopen(): void {
        this.trackLoaded = false;
        this.trackEnded = false;
        this.time = 0;
        this.playerControls.setPlaying(false);
        this.playerControls.slider.setLoading(false);
        this.playerControls.slider.setValue(0);
        this.playerControls.slider.setMax(0);
    }
    
    onViewAudioDurationChanged(duration: number, currentTime: number): void {
        this.trackLoaded = true;
        this.time = currentTime;
        this.trackEnded = false;
        this.playerControls.slider.setLoading(false);
        this.playerControls.slider.setMax(duration);
        this.playerControls.slider.setValue(0);
        this.playerControls.setPlaying(false);
        this._clearTickInterval();
        if (this.playing) {
            this.play(); 
        }
    }
    
    onViewSetVolume(volume: number): void {
        this.playerControls.setVolume(volume);
    }
    
    onViewSetMuted(muted: boolean): void {
        this.playerControls.setIsMuted(muted);
    }
    
    onViewSetCurrentTime(currentTime: number): void {
        this.time = currentTime;
        this.playerControls.slider.setValue(this.time);
    }
    
    pause(): void {
        this.playing = false;
        this._clearTickInterval();
        this.playerControls.setPlaying(false);
        this.callViewMethod("_pause");
    }
    
    play(): void {
        this.playing = true;
        if (!this.trackLoaded) {
            this.playerControls.slider.setLoading(true);
            this.dispatchEvent<LoadAudioTrackEvent>({
                type: "load-audio-track",
            });
            return;
        }
        if (this.trackEnded) {
            this.time = 0;
            this.playerControls.slider.setValue(0);
            this.trackEnded = false;
        }
        this._setTickInterval();
        this.playerControls.setPlaying(true);
        this.callViewMethod("_play");
    }
    
    setLoadingProgress(progress: number): void {
        this.playerControls.slider.setProgress(progress);
    }
    
    onViewPlay(): void {
        this.play();
    }
    
    onViewPause(): void {
        this.pause();
    }
    
    onViewStop(): void {
        this.pause();
    }
    
    private _setTickInterval(): void {
        this._clearTickInterval();
        let intervalMs = this._calculateTickInterval();
        let startedAt = new Date().getTime();
        let startTime = this.time;
        this.tickInterval = <any>setInterval(() => {
            let now = new Date().getTime();
            this.time = startTime + (now - startedAt) / 1000;
            this.playerControls.slider.setValue(this.time);
        }, intervalMs);
    }
    
    private _calculateTickInterval(): number {
        let duration = this.playerControls.slider.max;
        let intervalMs = 1000;
        let durationMs = duration * 1000;
        intervalMs = Math.floor(durationMs / 50);
        intervalMs = Math.max(Math.min(intervalMs, 1000), 50);
        return intervalMs;
    }
    
    private _clearTickInterval(): void {
        if (this.tickInterval !== null) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
    
    destroy() {
        super.destroy();
        this._clearTickInterval();
    }
    
}

