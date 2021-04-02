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
import { AudioPlayerController, LoadAudioTrackEvent } from "../../component/audioplayer/main";

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
    
    audioPlayer: AudioPlayerController;
    protected auotPlay: boolean;
    
    constructor(parent: app.WindowParent, public session: Session, options: Options & { autoPlay?: boolean }) {    
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
        this.auotPlay = !!options.autoPlay;
        
        this.bindEvent<AddToPlaylistEvent>(this.app, "add-to-playlist", event => {
            if (event.id == this.openableElement.getElementId()) {
                this.callViewMethod("setInPlaylist", true);
            }
        });
        this.bindEvent<DeleteFromPlaylistEvent>(this.app, "delete-from-playlist", event => {
            if (event.id == this.openableElement.getElementId()) {
                this.callViewMethod("setInPlaylist", false);
            }
        });
        this.bindEvent<ClearPlaylistEvent>(this.app, "clear-playlist", () => {
            this.callViewMethod("setInPlaylist", false);
        });
        
        this.audioPlayer = this.addComponent("audioplayer", this.componentFactory.createComponent("audioplayer", [this, this.app]));
        this.bindEvent<LoadAudioTrackEvent>(this.audioPlayer, "load-audio-track", () => {
            this.loadPlayerData();
        });
    }
    
    reopen(openableElement: OpenableElement): void {
        this.audioPlayer.reopen();
        super.reopen(openableElement);
    }
    
    getButtonsState(): ButtonsState {
        let state = super.getButtonsState();
        state.edit = false;
        return state;
    }
    
    onViewLoad(): void {
        this.callViewMethod("setAutoPlay", this.auotPlay);
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
    
    loadPlayerData(): Q.Promise<void> {
        let el = this.openableElement;
        let currentViewId = this.currentViewId;
        return Q().then(() => {
            if (this.currentViewId == currentViewId) {
                return el.getBlobData();
            }
        })
        .progress(p => {
            if (p && p.percent && this.currentViewId == currentViewId) {
                this.audioPlayer.setLoadingProgress(p.percent);
            }
        })
        .then(data => {
            if (data && this.currentViewId == currentViewId) {
                this.callViewMethod("setAudioData", data);
            }
        });
    }
    
}
