import {EditorWindowController, Options} from "../editor/EditorWindowController";
import {app} from "../../Types";
import {AddToPlaylistEvent, DeleteFromPlaylistEvent, ClearPlaylistEvent, SetPlayerVolumeEvent, SetPlayerOptionEvent, BasicPlayerEvent} from "../../app/common/musicPlayer/PlayerManager";
import {ButtonsState} from "../../component/editorbuttons/EditorButtonsController";
import { PlayerControlsController } from "../../component/playercontrols/main";
import { OpenableElement } from "../../app/common/shell/ShellTypes";
import Q = require("q");
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";

export class Model {
    name: string;
    mimeType: string;
    size: number;
    isInPlaylist: boolean;
    showOpenButton: boolean;
    previewMode: boolean;
    canPlay: boolean;
}

export class AudioWindowController extends EditorWindowController {
    
    static textsPrefix: string = "window.audio.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    playerControls: PlayerControlsController;
    durationDeferred: Q.Deferred<{ duration: number, currentTime: number }>;
    tickInterval: number = null;
    dataLoadedFor: number = null;
    time: number;
    
    constructor(parent: app.WindowParent, public session: Session, options: Options) {    
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
        
        this.app.addEventListener<AddToPlaylistEvent>("add-to-playlist", event => {
            if (event.id == this.openableElement.getElementId()) {
                this.callViewMethod("setInPlaylist", true);
            }
        });
        this.app.addEventListener<DeleteFromPlaylistEvent>("delete-from-playlist", event => {
            if (event.id == this.openableElement.getElementId()) {
                this.callViewMethod("setInPlaylist", false);
            }
        });
        this.app.addEventListener<ClearPlaylistEvent>("clear-playlist", () => {
            this.callViewMethod("setInPlaylist", false);
        });
        this.playerControls = this.addComponent("playerControls", this.componentFactory.createComponent("playercontrols", [this, true]));
        this.playerControls.setApp(this.app);
        this.playerControls.onViewPlay = () => {
            this.play(this.openableElement);
        };
        this.playerControls.onViewPause = () => {
            this.pause();
        };
        this.playerControls.addEventListener<SetPlayerVolumeEvent>("set-player-volume", event => {
            this.callViewMethod("setVolume", event.volume);
            this.playerControls.setVolume(event.volume);
        });
        this.playerControls.addEventListener<SetPlayerOptionEvent>("set-player-option", event => {
            if (event.option == "muted") {
                this.callViewMethod("setMuted", event.value);
            }
        });
        this.playerControls.addEventListener<BasicPlayerEvent>("player-set-time", event => {
            this.time = event.value;
            this.callViewMethod("setTime", this.time);
            if (this.tickInterval) {
                if (this.tickInterval !== null) {
                    clearInterval(this.tickInterval);
                    this.tickInterval = null;
                }
                this.tickInterval = <any>setInterval(() => {
                    this.playerControls.slider.setValue(++this.time);
                }, 1000);
            }
        });
    }
    
    getButtonsState(): ButtonsState {
        let state = super.getButtonsState();
        state.edit = false;
        return state;
    }
    
    onViewLoad(): void {
        let currentViewId = this.currentViewId;
        this.app.getPlayerManager().canPlayType(this.openableElement.getMimeType()).then(canPlay => {
            let playerManager = this.app.getPlayerManager();
            let model: Model = {
                name: this.name,
                mimeType: this.openableElement ? this.openableElement.getMimeType() : "",
                size: this.openableElement ? this.openableElement.getSize() : 0,
                isInPlaylist: this.openableElement && playerManager ? playerManager.has(this.openableElement.getElementId()) : false,
                showOpenButton: this.app.isElectronApp(),
                previewMode: this.previewMode,
                canPlay: canPlay,
            };
            this.callViewMethod("setData", currentViewId, model, this.getButtonsState());
        });
    }
    
    onViewAddToPlaylist(): void {
        this.app.dispatchEvent<AddToPlaylistEvent>({
            type: "add-to-playlist",
            id: this.openableElement.getElementId(),
            title: this.name,
            data: null,
        });
        this.callViewMethod("setInPlaylist", true);
    }
    
    onViewAddToPlaylistAndPlay(): void {
        this.app.dispatchEvent<AddToPlaylistEvent>({
            type: "add-to-playlist",
            id: this.openableElement.getElementId(),
            title: this.name,
            data: null,
            play: true,
        });
        this.callViewMethod("setInPlaylist", true);
    }
    
    onViewDelFromPlaylist(): void {
        this.app.dispatchEvent<DeleteFromPlaylistEvent>({
            type: "delete-from-playlist",
            id: this.openableElement.getElementId(),
        });
        this.callViewMethod("setInPlaylist", false);
    }
    
    onViewAudioEnded(): void {
        this.pause();
    }
    
    onViewAudioDurationChanged(_currentViewId: number, duration: number, currentTime: number): void {
        if (this.durationDeferred && this.currentViewId == _currentViewId) {
            this.durationDeferred.resolve({ duration, currentTime });
            this.durationDeferred = null;
        }
    }
    
    play(el: OpenableElement): Q.Promise<void> {
        if (el) {
            this.playerControls.slider.setLoading(true);
            
            return Q().then(() => {
                if (this.dataLoadedFor == this.currentViewId) {
                    return null;
                }
                else {
                    return el.getBlobData()
                }
            })
            .progress(p => {
                if (p && p.percent) {
                    this.playerControls.slider.setProgress(p.percent);
                }
            })
            .then(data => {
                this.durationDeferred = Q.defer();
                if (data) {
                    this.callViewMethod("setAudioData", data);
                }
                else {
                    this.callViewMethod("onAudioDurationChanged");
                }
                return this.durationDeferred.promise.then(info => {
                    this.dataLoadedFor = this.currentViewId;
                    this.playerControls.slider.setLoading(false);
                    this.playerControls.setPlaying(true);
                    this.playerControls.slider.setMax(info.duration);
                    this.time = info.currentTime;
                    if (this.tickInterval !== null) {
                        clearInterval(this.tickInterval);
                        this.tickInterval = null;
                    }
                    this.tickInterval = <any>setInterval(() => {
                        this.playerControls.slider.setValue(++this.time);
                    }, 1000);
                    this.callViewMethod("play");
                });
            });
        }
        else {
            this.playerControls.slider.setLoading(false);
            this.playerControls.setPlaying(false);
            this.playerControls.slider.setMax(0);
            this.playerControls.slider.setValue(0);
            this.callViewMethod("pause");
        }
    }
    
    pause(): void {
        if (this.tickInterval !== null) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        this.playerControls.setPlaying(false);
        this.callViewMethod("pause");
    }
    
    onViewPause(): void {
        this.pause();
        this.play(null);
    }
    
}
