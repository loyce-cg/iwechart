import {ComponentController} from "../base/ComponentController";
import {app, event} from "../../Types";
import { CommonApplication } from "../../app/common";
import { BasicPlayerEvent, DeleteFromPlaylistEvent, ClearPlaylistEvent, UpdatePlaylistEvent, PlaylistSimpleItem, SetPlayerOptionEvent, PlayerTrackLoadedEvent, SetPlayerVolumeEvent } from "../../app/common/musicPlayer/PlayerManager";
import Q = require("q");
import { MutableCollection, WithActiveCollection } from "../../utils/collection";
import {Inject, Dependencies} from "../../utils/Decorators";
import { ComponentFactory } from "../main";
import { ExtListController } from "../extlist/main";
import { SliderController } from "../slider/main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class Model {
    independent: boolean;
}

@Dependencies(["extlist", "slider"])
export class PlayerControlsController extends ComponentController {
    
    static textsPrefix: string = "component.playerControls.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject componentFactory: ComponentFactory;
    
    afterViewLoaded: Q.Deferred<void>;
    app: CommonApplication;
    playing: boolean = false;
    loop: boolean = false;
    random: boolean = false;
    isCollapsed: boolean = false;
    isMuted: boolean = false;
    volume: number = 1.0;
    mutableCollection: MutableCollection<PlaylistSimpleItem>;
    activeCollection: WithActiveCollection<PlaylistSimpleItem>;
    playlist: ExtListController<PlaylistSimpleItem>;
    slider: SliderController;
    volumeSlider: SliderController;
    
    constructor(parent: app.IpcContainer, public independent: boolean = false) {
        super(parent);
        this.mutableCollection = this.addComponent("mutableCollection", new MutableCollection([]));
        this.activeCollection = this.addComponent("activeCollection", new WithActiveCollection(this.mutableCollection));
        this.playlist = this.addComponent("playlist", this.componentFactory.createComponent("extlist", [this, this.activeCollection]));
        this.playlist.ipcMode = true;
        this.slider = this.addComponent("slider", this.componentFactory.createComponent("slider", [this, {
            onUserValueChange: value => {
                this.dispatchPlayerEvent<BasicPlayerEvent>({
                    type: "player-set-time",
                    value: value,
                });
            },
        }]));
        this.volumeSlider = this.addComponent("volumeSlider", this.componentFactory.createComponent("slider", [this, {
            onUserValueChange: value => {
                this.dispatchPlayerEvent<SetPlayerVolumeEvent>({
                    type: "set-player-volume",
                    volume: value,
                });
            },
        }]));
        this.volumeSlider.setMax(1.0);
        this.volumeSlider.setValue(0.0);
        this.afterViewLoaded = Q.defer();
        this.ipcMode = true;
    }
    
    getModel(): Model {
        return {
            independent: this.independent,
        };
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
        this.callViewMethod("setIndex", 0);
        this.activeCollection.setActive(this.activeCollection.get(0));
    }
    
    dispatchPlayerEvent<T extends event.Event>(evt: T): void {
        if (this.independent) {
            this.dispatchEvent(evt);
        }
        else {
            this.app.dispatchEvent(evt);
        }
    }
    
    setApp(app: CommonApplication) {
        this.app = app;
        
        if (!this.independent) {
            app.addEventListener<UpdatePlaylistEvent>("update-playlist", event => {
                this.setPlaylist(event.playlist);
            });
            app.addEventListener<BasicPlayerEvent>("player-play", event => {
                if (!this.playing) {
                    this.setPlaying(true);
                }
            });
            app.addEventListener<BasicPlayerEvent>("player-pause", event => {
                if (this.playing) {
                    this.setPlaying(false);
                }
            });
            app.addEventListener<BasicPlayerEvent>("update-currently-played-index", event => {
                this.callViewMethod("setIndex", event.idx);
                this.activeCollection.setActive(this.activeCollection.get(event.idx));
                if (!this.playing && !event.onlyVisualUpdate) {
                    this.setPlaying(true);
                }
            });
            app.addEventListener<BasicPlayerEvent>("player-set-time", event => {
                this.slider.setValue(event.value);
            });
            app.addEventListener<BasicPlayerEvent>("player-set-duration", event => {
                this.slider.setMax(event.value);
            });
            app.addEventListener<BasicPlayerEvent>("player-time-changed", event => {
                this.slider.setValue(event.value);
            });
            app.addEventListener<BasicPlayerEvent>("player-track-loading", () => {
                this.slider.setLoading(true);
            });
            app.addEventListener<BasicPlayerEvent>("player-track-load-progress", event => {
                this.slider.setProgress(event.value);
            });
            app.addEventListener<PlayerTrackLoadedEvent>("player-track-loaded", () => {
                this.slider.setLoading(false);
            });
            app.addEventListener<BasicPlayerEvent>("player-set-title", event => {
                this.setTitle(event.title);
            });
            app.addEventListener<PlayerTrackLoadedEvent>("player-track-loaded", event => {
                let it = this.mutableCollection.find(it => it.id == event.id);
                if (it) {
                    it.title = event.title;
                    this.mutableCollection.triggerUpdateElement(it);
                }
            });
            app.addEventListener<SetPlayerVolumeEvent>("set-player-volume", event => {
                this.setVolume(event.volume);
            });
            app.addEventListener<SetPlayerOptionEvent>("set-player-option", event => {
                if (event.option == "loop") {
                    if (this.loop != event.value) {
                        this.setLoop(event.value);
                    }
                }
                else if (event.option == "random") {
                    if (this.random != event.value) {
                        this.setRandom(event.value);
                    }
                }
                else if (event.option == "collapsed") {
                    if (this.isCollapsed != event.value) {
                        this.setIsCollapsed(event.value);
                    }
                }
                else if (event.option == "muted") {
                    if (this.isMuted != event.value) {
                        this.setIsMuted(event.value);
                    }
                }
            });
            
            let playerManager = this.app.getPlayerManager();
            if (playerManager) {
                this.setPlaylist(playerManager.getPlaylist());
                this.setPlaying(playerManager.playing);
                this.setLoop(playerManager.loop);
                this.setRandom(playerManager.random);
                this.setIsCollapsed(playerManager.isCollapsed);
                this.setIsMuted(playerManager.isMuted);
                this.setVolume(playerManager.volume);
                this.setTitle(playerManager.title);
                this.slider.setMax(playerManager.duration);
                this.slider.setValue(playerManager.time);
            }
        }
    }
    
    setPlaying(playing: boolean) {
        this.playing = playing;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setPlaying", playing);
        });
    }
    
    setLoop(loop: boolean) {
        this.loop = loop;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setLoop", loop);
        });
    }
    
    setRandom(random: boolean) {
        this.random = random;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setRandom", random);
        });
    }
    
    setIsCollapsed(collapsed: boolean) {
        this.isCollapsed = collapsed;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setIsCollapsed", collapsed);
        });
    }
    
    setIsMuted(muted: boolean) {
        this.isMuted = muted;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setIsMuted", muted);
        });
    }
    
    setTitle(title: string) {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setTitle", title);
        });
    }
    
    setVolume(volume: number) {
        this.volume = volume;
        this.volumeSlider.setValue(volume);
    }
    
    setPlaylist(playlist: PlaylistSimpleItem[]) {
        this.afterViewLoaded.promise.then(() => {
            this.mutableCollection.rebuild(playlist);
            this.callViewMethod("setIndex", 0);
            this.activeCollection.setActive(this.activeCollection.get(0));
        });
    }
    
    onViewDeleteFromPlaylist(id: string): void {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<DeleteFromPlaylistEvent>({
            type: "delete-from-playlist",
            id: id,
        });
    }
    
    onViewClearPlaylist(): void {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<ClearPlaylistEvent>({
            type: "clear-playlist",
        });
    }
    
    onViewPlay(): void {
        this.playing = true;
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<BasicPlayerEvent>({
            type: "player-play",
        });
    }
    
    onViewPause(): void {
        this.playing = false;
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<BasicPlayerEvent>({
            type: "player-pause",
        });
    }
    
    onViewPlayNext(): void {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<BasicPlayerEvent>({
            type: "player-play-next",
        });
    }
    
    onViewPlayPrev(): void {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<BasicPlayerEvent>({
            type: "player-play-prev",
        });
    }
    
    onViewSetCurrentId(id: string) {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<BasicPlayerEvent>({
            type: "update-currently-played-index",
            idx: this.activeCollection.indexOfBy(x => x.id == id),
        });
    }
    
    onViewSetLoop(loop: boolean) {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<SetPlayerOptionEvent>({
            type: "set-player-option",
            option: "loop",
            value: loop,
        });
    }
    
    onViewSetRandom(random: boolean) {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<SetPlayerOptionEvent>({
            type: "set-player-option",
            option: "random",
            value: random,
        });
    }
    
    onViewSetCollapsed(collapsed: boolean) {
        if (this.independent) {
            return;
        }
        this.dispatchPlayerEvent<SetPlayerOptionEvent>({
            type: "set-player-option",
            option: "collapsed",
            value: collapsed,
        });
    }
    
    onViewSetMuted(muted: boolean) {
        this.dispatchPlayerEvent<SetPlayerOptionEvent>({
            type: "set-player-option",
            option: "muted",
            value: muted,
        });
    }
    
    onViewShowVolumeSlider() {
        this.volumeSlider.setValue(this.volume);
        this.callViewMethod("showVolumeSlider");
    }
    
}

