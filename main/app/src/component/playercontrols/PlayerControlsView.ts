import {ComponentView} from "../base/ComponentView";
import {func as mainTemplate} from "./template/index.html";
import {func as playlistItemTemplate} from "./template/playlist-item.html";
import {app} from "../../Types";
import { ExtListView } from "../extlist/web";
import { PlaylistSimpleItem } from "../../app/common/musicPlayer/PlayerManager";
import * as $ from "jquery";
import { SliderView, SliderTextFormat, SliderOrientation } from "../slider/web";
import { Model } from "./PlayerControlsController";

export class PlayerControlsView extends ComponentView {
    
    $container: JQuery;
    $component: JQuery;
    playing: boolean = false;
    loop: boolean = false;
    random: boolean = false;
    currIndex: number = -1;
    isCollapsed: boolean = false;
    isMuted: boolean = false;
    playlist: ExtListView<PlaylistSimpleItem>;
    slider: SliderView;
    volumeSlider: SliderView;
    hideVolumeSliderTimer: any = null;
    
    constructor(parent: app.ViewParent) {
        super(parent);
    }
    
    init(model: Model): Q.Promise<void> {
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ(model);
        this.$container.content(this.$component);
        this.bindEvents();
        this.$container.find(".playlist-scroller").pfScroll();
        this.playlist = this.addComponent("playlist", new ExtListView(this, {
            template: this.templateManager.createTemplate(playlistItemTemplate),
            onEmptyChange: () => {
                this.$component.toggleClass("empty-playlist", this.playlist.empty.value);
            },
            onAfterListRender: () => {
                this.updatePrevNextButtons();
            },
        }));
        this.slider = this.addComponent("slider", new SliderView(this, {
            textIncludeMax: true,
            textFormat: SliderTextFormat.HMS,
        }));
        this.volumeSlider = this.addComponent("volumeSlider", new SliderView(this, {
            textFormat: SliderTextFormat.NO_TEXT,
            orientation: SliderOrientation.VERTICAL,
            reverse: true,
            size: 100,
        }));
        this.playlist.$container = this.$component.find(".playlist");
        return this.playlist.triggerInit().then(() => {
            this.slider.$container = this.$component.find(".slider-container");
            return this.slider.triggerInit();
        })
        .then(() => {
            this.volumeSlider.$container = this.$component.find(".volume-slider-container");
            return this.volumeSlider.triggerInit();
        });
    }
    
    bindEvents(): void {
        this.$container.off("click.pcv-pp").on("click.pcv-pp", "[data-action=play-pause]", this.onPlayPauseClick.bind(this));
        this.$container.off("click.pcv-pprev").on("click.pcv-pprev", "[data-action=play-prev]:not(.disabled)", this.onPlayPrevClick.bind(this));
        this.$container.off("click.pcv-pnext").on("clickpcv-pnext", "[data-action=play-next]:not(.disabled)", this.onPlayNextClick.bind(this));
        this.$container.off("click.pcv-sl").on("click.pcv-sl", "[data-action=set-loop]", this.onSetLoopClick.bind(this));
        this.$container.off("click.pcv-sr").on("click.pcv-sr", "[data-action=set-random]", this.onSetRandomClick.bind(this));
        this.$container.off("click.pcv-op").on("click.pcv-op", "[data-action=open-playlist]", this.onOpenPlaylistClick.bind(this));
        this.$container.off("click.pcv-li").on("click.pcv-li", "li[data-id]:not(.active)", this.onPlaylistItemClick.bind(this));
        this.$container.off("click.pcv-ctx").on("click.pcv-ctx", ".x-context-menu-backdrop2", this.onPlaylistBackdropClick.bind(this));
        this.$container.off("click.pcv-dfp").on("click.pcv-dfp", "[data-action=delete-from-playlist]", this.onDeleteFromPlaylistClick.bind(this));
        this.$container.off("click.pcv-cp").on("click.pcv-cp", "[data-action=clear-playlist]", this.onClearPlaylistClick.bind(this));
        this.$container.off("click.pcv-tpb").on("click.pcv-tpb", "[data-action=toggle-player-button]", this.onTogglePlayerClick.bind(this));
        this.$container.off("click.pcv-tm").on("click.pcv-tm", "[data-action=toggle-muted]", this.onToggleMutedClick.bind(this));
        this.$container.off("mousemove.pcv-mm").on("mousemove.pcv-mm", this.onMouseMove.bind(this));
        this.$container.off("mouseleave.pcv-ml").on("mouseleave.pcv-ml", this.onMouseLeave.bind(this));
        if (this.slider) {
            this.slider.bindEvents();
        }
        if (this.volumeSlider) {
            this.volumeSlider.bindEvents();
        }
    }
    
    setPlaying(playing: boolean) {
        this.playing = playing;
        this.$component.toggleClass("playing", playing);
        this.$component.toggleClass("paused", !playing);
    }
    
    setIndex(idx: number) {
        if (idx != this.currIndex) {
            this.currIndex = idx;
            this.updatePrevNextButtons();
        }
    }
    
    setLoop(loop: boolean) {
        if (this.loop != loop) {
            this.loop = loop;
            this.$component.find("[data-action=set-loop]").toggleClass("on", loop);
            this.updatePrevNextButtons();
        }
    }
    
    setRandom(random: boolean) {
        if (this.random != random) {
            this.random = random;
            this.$component.find("[data-action=set-random]").toggleClass("on", random);
            this.updatePrevNextButtons();
        }
    }
    
    setIsCollapsed(collapsed: boolean) {
        if (this.isCollapsed != collapsed) {
            this.isCollapsed = collapsed;
            this.$component.toggleClass("open", !this.isCollapsed);
            this.$component.toggleClass("collapsed", this.isCollapsed);
            if (collapsed) {
                if (this.hideVolumeSliderTimer) {
                    clearTimeout(this.hideVolumeSliderTimer);
                }
                this.hideVolumeSlider();
                this.hideVolumeSliderTimer = null;
            }
        }
    }
    
    setIsMuted(muted: boolean) {
        if (this.isMuted != muted) {
            this.isMuted = muted;
            this.$component.find(".volume-control").children(".fa")
                .toggleClass("fa-volume-up", !this.isMuted)
                .toggleClass("fa-volume-off", this.isMuted);
        }
    }
    
    setTitle(title: string) {
        this.$component.find(".title").text(title);
    }
    
    onPlayPauseClick(): void {
        if (this.playing) {
            this.triggerEvent("pause");
            this.setPlaying(false);
        }
        else {
            this.triggerEvent("play");
            this.setPlaying(true);
        }
    }
    
    onPlayPrevClick(): void {
        this.triggerEvent("playPrev");
    }
    
    onPlayNextClick(): void {
        this.triggerEvent("playNext");
    }
    
    onSetLoopClick(): void {
        this.triggerEvent("setLoop", !this.loop);
    }
    
    onSetRandomClick(): void {
        this.triggerEvent("setRandom", !this.random);
    }
    
    onOpenPlaylistClick(): void {
        this.$component.find(".playlist-dropdown").toggleClass("visible");
        this.$component.toggleClass("dropdown-open");
    }
    
    onPlaylistBackdropClick(e: MouseEvent): void {
        this.closeDropdown();
        e.preventDefault();
        e.stopPropagation();
    }
    
    onPlaylistItemClick(e: MouseEvent): void {
        let id = $(e.currentTarget).data("id");
        this.triggerEvent("setCurrentId", id);
        this.closeDropdown();
    }
    
    onDeleteFromPlaylistClick(e: MouseEvent): void {
        e.stopPropagation();
        let id = $(e.currentTarget).closest("li").data("id");
        if (this.$component.find(".playlist").children("li").length == 1) {
            this.closeDropdown();
        }
        this.triggerEvent("deleteFromPlaylist", id);
    }
    
    onClearPlaylistClick(e: MouseEvent): void {
        e.stopPropagation();
        this.closeDropdown();
        this.triggerEvent("clearPlaylist");
    }
    
    onTogglePlayerClick(): void {
        this.isCollapsed = !this.isCollapsed;
        this.$component.toggleClass("open", !this.isCollapsed);
        this.$component.toggleClass("collapsed", this.isCollapsed);
        this.triggerEvent("setCollapsed", this.isCollapsed);
        if (this.isCollapsed) {
            if (this.hideVolumeSliderTimer) {
                clearTimeout(this.hideVolumeSliderTimer);
            }
            this.hideVolumeSlider(true);
            this.hideVolumeSliderTimer = null;
        }
    }
    
    onToggleMutedClick(): void {
        this.isMuted = !this.isMuted;
        this.$component.find(".volume-control").children(".fa")
            .toggleClass("fa-volume-up", !this.isMuted)
            .toggleClass("fa-volume-off", this.isMuted);
        this.triggerEvent("setMuted", this.isMuted);
    }
    
    onMouseMove(e: MouseEvent): void {
        if (this.hideVolumeSliderTimer !== null) {
            clearTimeout(this.hideVolumeSliderTimer);
            this.hideVolumeSliderTimer = null;
        }
        else {
            let el = this.$component.find(".volume-control")[0];
            if (el == e.target || $.contains(el, <Element>e.target)) {
                this.triggerEvent("showVolumeSlider");
            }
        }
    }
    
    onMouseLeave(e: MouseEvent): void {
        if (this.hideVolumeSliderTimer) {
            clearTimeout(this.hideVolumeSliderTimer);
        }
        this.hideVolumeSliderTimer = setTimeout(() => {
            this.hideVolumeSlider();
            this.hideVolumeSliderTimer = null;
        }, 300);
    }
    
    showVolumeSlider(): void {
        this.$component.find(".volume-slider-container").addClass("visible");
    }
    
    hideVolumeSlider(immediately: boolean = false): void {
        let $el = this.$component.find(".volume-slider-container")
        if (immediately) {
            $el.css("display", "none");
            setTimeout(() => {
                $el.css("display", "block");
            }, 200);
        }
        $el.removeClass("visible");
    }
    
    updatePrevNextButtons() {
        let $playlist = this.$component.find(".playlist");
        let playingFirst = $playlist.children("li.active:first-child").length == 1;
        let playingLast = $playlist.children("li.active:last-child").length == 1;
        let isAnyActive = $playlist.children("li.active").length > 0;
        if ($playlist.children("li").length < 2) {
            playingFirst = true;
            playingLast = true;
        }
        if (!isAnyActive) {
            playingFirst = true;
        }
        this.$component.find("[data-action=play-prev]").toggleClass("disabled", !this.loop && !this.random && playingFirst);
        this.$component.find("[data-action=play-next]").toggleClass("disabled", !this.loop && !this.random && playingLast);
    }
    
    closeDropdown(): void {
        this.$component.find(".playlist-dropdown").removeClass("visible");
        this.$component.removeClass("dropdown-open");
    }
    
}
