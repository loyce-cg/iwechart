import { IMusicPlayer } from "./IMusicPlayer";
import { CommonApplication } from "..";
import { EventDispatcher } from "../../../utils";
import { event } from "../../../Types";
import { MailConst, SinkIndexManager, UserPreferences } from "../../../mail";
import { SectionManager } from "../../../mail/section";
import { OpenableElement, OpenableAttachment } from "../shell/ShellTypes";
import { Types } from "../../../build/core";
import * as Q from "q";
import { Entry } from "../../../mail/filetree/NewTree";


export interface PlaylistSimpleItem {
    id: string;
    title: string;
}

export interface UpdatePlaylistEvent extends Types.event.Event {
    type: "update-playlist";
    playlist: PlaylistSimpleItem[];
}
export interface AddToPlaylistEvent extends Types.event.Event {
    type: "add-to-playlist";
    id: string;
    title: string;
    data: Types.app.BlobData;
    play?: boolean;
}
export interface DeleteFromPlaylistEvent extends Types.event.Event {
    type: "delete-from-playlist";
    id: string;
}
export interface ClearPlaylistEvent extends Types.event.Event {
    type: "clear-playlist";
}
export interface BasicPlayerEvent extends Types.event.Event {
    type: "player-play" | "player-pause" | "player-play-next" | "player-play-prev" | "update-currently-played-index" | "player-set-time" | "player-set-duration" | "player-time-changed" | "player-set-title" | "player-track-loading" | "player-track-load-progress";
    idx?: number;
    value?: number;
    title?: string;
    onlyVisualUpdate?: boolean;
}
export interface SetPlayerOptionEvent extends Types.event.Event {
    type: "set-player-option";
    option: "loop"|"random"|"collapsed"|"muted";
    value: boolean;
}

export interface SetPlayerVolumeEvent extends Types.event.Event {
    type: "set-player-volume";
    volume: number;
}

export interface PlayerTrackLoadedEvent extends Types.event.Event {
    type: "player-track-loaded";
    id: string;
    title: string;
    data: Types.app.BlobData;
}

enum TrackState {
    UNLOADED,
    LOADING,
    LOADED,
    FAILED,
}

interface Track {
    id: string;
    title: string;
    data: Types.app.BlobData;
    state: TrackState;
}

export class PlayerManager {
    
    sectionManagerPromise: Q.Promise<SectionManager>;
    sinkIndexManagerPromise: Q.Promise<SinkIndexManager>;
    userPreferences: UserPreferences.UserPreferences;
    playlist: Track[] = [];
    order: number[] = [];
    currentOrderIdx: number = -1;
    nextOrderIdx: number = -1;
    playing: boolean = false;
    loop: boolean = true;
    random: boolean = false;
    time: number = 0;
    duration: number = 0;
    title: string = "";
    heldTriggerPreferencesChange: number = 0;
    isCollapsed: boolean = false;
    isMuted: boolean = false;
    volume: number = 1.0;
    canPlayCache: { [mime: string]: boolean } = {};
    
    constructor(public app: CommonApplication, public player: IMusicPlayer) {
        app.addEventListener<AddToPlaylistEvent>("add-to-playlist", event => {
            this.add(event.id, event.title, event.data);
            if (event.play) {
                let id = null;
                let i = 0;
                for (let _id of this.order) {
                    if (this.playlist[_id].id == event.id) {
                        id = i;
                    }
                    ++i;
                }
                this.play(id);
            }
            if (this.userPreferences && this.userPreferences.getValue(MailConst.PLAYER_PLAYLIST, []).filter(it => it.id == event.id).length == 0) {
                if (this.heldTriggerPreferencesChange == 0) {
                    this.userPreferences.set(MailConst.PLAYER_PLAYLIST, this.getPlaylist(), true);
                }
            }
        }, "playerManager", "normal");
        app.addEventListener<DeleteFromPlaylistEvent>("delete-from-playlist", event => {
            this.delete(event.id);
            if (this.userPreferences && this.userPreferences.getValue(MailConst.PLAYER_PLAYLIST, []).filter(it => it.id == event.id).length > 0) {
                if (this.heldTriggerPreferencesChange == 0) {
                    this.userPreferences.set(MailConst.PLAYER_PLAYLIST, this.getPlaylist(), true);
                }
            }
        }, "playerManager", "normal");
        app.addEventListener<ClearPlaylistEvent>("clear-playlist", () => {
            this.clearPlaylist();
            if (this.heldTriggerPreferencesChange == 0) {
                this.userPreferences.set(MailConst.PLAYER_PLAYLIST, this.getPlaylist(), true);
            }
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("player-play", () => {
            this.play();
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("player-pause", () => {
            this.pause();
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("player-play-next", () => {
            this.playNext();
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("player-play-prev", () => {
            this.playPrev();
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("update-currently-played-index", event => {
            if (!event.onlyVisualUpdate) {
                this.play(event.idx);
            }
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("player-set-time", event => {
            this.player.seekTo(event.value);
            this.time = event.value;
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("player-set-duration", event => {
            this.duration = event.value;
        }, "playerManager", "normal");
        app.addEventListener<BasicPlayerEvent>("player-time-changed", event => {
            this.time = event.value;
        }, "playerManager", "normal");
        app.addEventListener<SetPlayerVolumeEvent>("set-player-volume", event => {
            this.setVolume(event.volume);
            if (this.heldTriggerPreferencesChange == 0) {
                this.userPreferences.set(MailConst.PLAYER_VOLUME, event.volume, true);
            }
        }, "playerManager", "normal");
        app.addEventListener<SetPlayerOptionEvent>("set-player-option", event => {
            if (event.option == "loop") {
                if (this.loop != event.value) {
                    this.loop = event.value;
                    this.setLoop(event.value);
                }
                if (this.userPreferences && this.userPreferences.getValue(MailConst.PLAYER_LOOP, true) != event.value) {
                    if (this.heldTriggerPreferencesChange == 0) {
                        this.userPreferences.set(MailConst.PLAYER_LOOP, event.value, true);
                    }
                }
            }
            else if (event.option == "random") {
                if (this.random != event.value) {
                    this.random = event.value;
                    this.setRandom(event.value);
                }
                if (this.userPreferences && this.userPreferences.getValue(MailConst.PLAYER_RANDOM, true) != event.value) {
                    if (this.heldTriggerPreferencesChange == 0) {
                        this.userPreferences.set(MailConst.PLAYER_RANDOM, event.value, true);
                    }
                }
            }
            else if (event.option == "collapsed") {
                if (this.isCollapsed != event.value) {
                    this.isCollapsed = event.value;
                    this.setIsCollapsed(event.value);
                }
                if (this.userPreferences && this.userPreferences.getValue(MailConst.PLAYER_COLLAPSED, true) != event.value) {
                    if (this.heldTriggerPreferencesChange == 0) {
                        this.userPreferences.set(MailConst.PLAYER_COLLAPSED, event.value, true);
                    }
                }
            }
            else if (event.option == "muted") {
                if (this.isMuted != event.value) {
                    this.isMuted = event.value;
                    this.setIsMuted(event.value);
                }
                if (this.userPreferences && this.userPreferences.getValue(MailConst.PLAYER_MUTED, true) != event.value) {
                    if (this.heldTriggerPreferencesChange == 0) {
                        this.userPreferences.set(MailConst.PLAYER_MUTED, event.value, true);
                    }
                }
            }
        }, "playerManager", "normal");
        player.onTrackEnded(this.onTrackEnded.bind(this));
        player.onGotDuration(this.onGotDuration.bind(this));
        player.onTimeChanged(this.onTimeChanged.bind(this));
    }
    
    init(eventDispatcher: EventDispatcher) {
        this.sectionManagerPromise = this.app.mailClientApi.privmxRegistry.getSectionManager().then(sectionManager => {
            return sectionManager.load().then(() => {
                return sectionManager;
            });
        });
        this.sinkIndexManagerPromise = this.app.mailClientApi.privmxRegistry.getSinkIndexManager();
        eventDispatcher.addEventListener<event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this));
    }
    
    onUserPreferencesChange(event: event.UserPreferencesChangeEvent) {
        this.userPreferences = event.userPreferences;
        let loop = event.userPreferences.getValue(MailConst.PLAYER_LOOP, true);
        let random = event.userPreferences.getValue(MailConst.PLAYER_RANDOM, false);
        let collapsed = event.userPreferences.getValue(MailConst.PLAYER_COLLAPSED, false);
        let muted = event.userPreferences.getValue(MailConst.PLAYER_MUTED, false);
        let volume = event.userPreferences.getValue(MailConst.PLAYER_VOLUME, 1.0);
        let playlist: PlaylistSimpleItem[] = event.userPreferences.getValue(MailConst.PLAYER_PLAYLIST, []);
        if (this.loop != loop) {
            this._triggerSetOption("loop", loop);
        }
        if (this.random != random) {
            this._triggerSetOption("random", random);
        }
        if (this.isCollapsed != collapsed) {
            this._triggerSetOption("collapsed", collapsed);
        }
        if (this.isMuted != muted) {
            this._triggerSetOption("muted", muted);
        }
        if (this.volume != volume) {
            this._triggerSetVolume(volume);
        }
        
        let currPlaylist = this.playlist.map(x => x.id);
        let toAdd: PlaylistSimpleItem[] = [];
        let toRemove: string[] = [];
        this.holdTriggerPreferencesChange();
        for (let x of currPlaylist) {
            if (playlist.filter(it => it.id == x).length == 0) {
                toRemove.push(x);
            }
        }
        for (let x of playlist) {
            if (currPlaylist.indexOf(x.id) < 0) {
                toAdd.push(x);
            }
        }
        for (let x of toRemove) {
            this.delFromPlaylistById(x);
        }
        for (let x of toAdd) {
            this.addToPlaylistById(x.id, x.title);
        }
        this.releaseTriggerPreferencesChange();
        this.markFirstAsCurrent();
    }
    
    markFirstAsCurrent() {
        if (this.currentOrderIdx >= 0 || this.playlist.length == 0) {
            return;
        }
        this.currentOrderIdx = 0;
        this.onTitleChanged();
    }
    
    addToPlaylistById(id: string, title?: string) {
        this.app.dispatchEvent<AddToPlaylistEvent>({
            type: "add-to-playlist",
            id: id,
            title: title ? title : null,
            data: null,
        });
    }
    
    delFromPlaylistById(id: string) {
        this.app.dispatchEvent<DeleteFromPlaylistEvent>({
            type: "delete-from-playlist",
            id: id,
        });
    }
    
    loadData(id: string): Q.Promise<void> {
        let tracks = this.playlist.filter(it => it.id == id);
        if (tracks.length == 0) {
            return;
        }
        let track = tracks[0];
        if (track.state != TrackState.UNLOADED && track.state != TrackState.FAILED) {
            return;
        }
        let idx = this.playlist.indexOf(track);
        track.state = TrackState.LOADING;
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "player-track-loading"
        });
        return this.getOpenableElement(id).then(openableElement => {
            return openableElement.getBlobData().progress(p => {
                if (p && p.percent) {
                    this.app.dispatchEvent<BasicPlayerEvent>({
                        type: "player-track-load-progress",
                        value: p.percent
                    });
                }
            })
            .then(data => {
                if (!openableElement) {
                    return;
                }
                track.data = data;
                track.title = openableElement.name;
                track.state = TrackState.LOADED;
                this.player.setData(idx, this.playlist[idx].data);
                this.app.dispatchEvent<PlayerTrackLoadedEvent>({
                    type: "player-track-loaded",
                    id: id,
                    title: track.title,
                    data: track.data,
                });
            });
        }).fail(() => {
            track.state = TrackState.FAILED;
        });
    }
    
    holdTriggerPreferencesChange() {
        this.heldTriggerPreferencesChange++;
    }
    
    releaseTriggerPreferencesChange() {
        this.heldTriggerPreferencesChange--;
    }
    
    onTrackEnded(): void {
        this.playNext();
    }
    
    onGotDuration(duration: number): void {
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "player-set-duration",
            value: duration,
        });
        this.onTitleChanged();
    }
    
    onTimeChanged(duration: number): void {
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "player-time-changed",
            value: duration,
        });
    }
    
    onTitleChanged(): void {
        this.title = this.currentOrderIdx in this.order ? this.playlist[this.order[this.currentOrderIdx]].title : "";
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "player-set-title",
            title: this.title,
        });
        this._triggerUpdateCurrentlyPlayed(true);
    }
    
    add(id: string, title: string, data: Types.app.BlobData): boolean {
        if (this.has(id)) {
            return false;
        }
        this.playlist.push({ id, title, data, state: TrackState.UNLOADED });
        this.order.push(this.order.length);
        this._add(this.playlist.length - 1);
        if (this.nextOrderIdx == this.currentOrderIdx) {
            this._prepNext();
        }
        if (this.playlist.length == 0) {
            this.markFirstAsCurrent();
        }
        return true;
    }
    
    delete(id: string): boolean {
        let idx = this.indexOfBy(x => x.id == id);
        if (idx < 0) {
            return false;
        }
        if (this.playlist.length == 1) {
            this.clearPlaylist();
            return;
        }
        let orderIdx = this.order.indexOf(idx);
        this.playlist.splice(idx, 1);
        this.order.splice(orderIdx, 1);
        for (let i in this.order) {
            if (this.order[i] >= idx) {
                this.order[i]--;
            }
        }
        if (this.currentOrderIdx == orderIdx) {
            this.pause();
            this.playNext();
        }
        this._delete(idx);
        this.onTitleChanged();
    }
    
    clearPlaylist(): void {
        this.playlist.length = 0;
        this.order.length = 0;
        this.currentOrderIdx = -1;
        this.nextOrderIdx = -1;
        this.player.clear();
        this._triggerUpdatePlaylist();
        this.onTitleChanged();
        this._pause();
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "player-set-time",
            value: 0,
        });
    }
    
    play(idx: number = null): void {
        if (idx !== null) {
            if (this.currentOrderIdx == idx && this.playing) {
                return;
            }
            this.currentOrderIdx = idx;
        }
        this._play();
    }
    
    pause(): void {
        this._pause();
    }
    
    playNext(): void {
        this._prepNext();
        this.currentOrderIdx = this.nextOrderIdx;
        this._play();
    }
    
    playPrev(): void {
        let newIdx = this.currentOrderIdx - 1;
        if (newIdx < 0 && !this.loop) {
            this._pause();
            return;
        }
        this.currentOrderIdx = newIdx < 0 ? Math.max(0, this.order.length - 1) : newIdx;
        this._play();
    }
    
    setLoop(loop: boolean) {
        let trigger = this.loop != loop;
        this.loop = loop;
        if (trigger) {
            this._triggerSetOption("loop", loop);
        }
    }
    
    setRandom(random: boolean) {
        let trigger = this.random != random;
        this.random = random;
        if (trigger) {
            this._triggerSetOption("random", random);
        }
    }
    
    setIsCollapsed(collapsed: boolean) {
        let trigger = this.isCollapsed != collapsed;
        this.isCollapsed = collapsed;
        if (trigger) {
            this._triggerSetOption("collapsed", collapsed);
        }
    }
    
    setIsMuted(muted: boolean) {
        let trigger = this.isMuted != muted;
        this.isMuted = muted;
        if (trigger) {
            this._triggerSetOption("muted", muted);
        }
        this._updateMuted();
    }
    
    setVolume(volume: number) {
        let trigger = this.volume != volume;
        this.volume = volume;
        if (trigger) {
            this._triggerSetVolume(volume);
        }
        this._updateVolume();
    }
    
    has(id: string): boolean {
        return this.playlist.filter(x => x.id == id).length > 0;
    }
    
    indexOfBy(func: (track: Track) => boolean): number {
        for (let i in this.playlist) {
            if (func(this.playlist[i])) {
                return Number(i);
            }
        }
        return -1;
    }
    
    getPlaylist(): PlaylistSimpleItem[] {
        let playlist = [];
        for (let idx of this.order) {
            playlist.push(this.playlist[idx]);
        }
        return playlist.map(x => { return { id: x.id, title: x.title }; });
    }
    
    canPlayType(mime: string): Q.Promise<boolean> {
        return this.canPlayTypes([mime]).then(canPlay => {
            return canPlay[mime];
        });
    }
    
    canPlayTypes(mimes: string[]): Q.Promise<{ [key: string]: boolean }> {
        let canPlay: { [key: string]: boolean } = {};
        for (let mime of mimes) {
            if (mime in this.canPlayCache) {
                canPlay[mime] = this.canPlayCache[mime];
            }
        }
        mimes = mimes.filter(mime => !(mime in this.canPlayCache));
        return this.player.canPlayTypes(mimes).then(res => {
            for (let mime in res) {
                this.canPlayCache[mime] = res[mime];
            }
            for (let mime in canPlay) {
                res[mime] = canPlay[mime];
            }
            return res;
        });
    }
    
    private _prepNext() {
        let nextIdx = -1;
        if (this.random) {
            if (this.order.length > 1) {
                for (let i = 0; i < 100; ++i) {
                    let newIdx = this.order[Math.floor(Math.random() * this.order.length)];
                    if (newIdx != this.currentOrderIdx) {
                        nextIdx = newIdx;
                        break;
                    }
                }
            }
            else {
                nextIdx = this.order.length == 0 ? -1 : 0;
            }
        }
        else {
            let newIdx = this.currentOrderIdx + 1;
            if (newIdx >= this.order.length && !this.loop) {
                nextIdx = -1;
            }
            else {
                nextIdx = newIdx >= this.order.length ? 0 : newIdx;
            }
        }
        this.nextOrderIdx = nextIdx;
    }
    
    private _add(idx: number) {
        this.player.add(this.playlist[idx].data);
        this._triggerUpdatePlaylist();
    }
    
    private _delete(idx: number) {
        this.player.delete(idx);
        this._triggerUpdatePlaylist();
    }
    
    private _play() {
        let orderIdx = this.currentOrderIdx;
        if (orderIdx == -1 && this.order.length > 0) {
            orderIdx = 0;
        }
        if (orderIdx >= 0 && orderIdx < this.order.length) {
            let idx = this.order[orderIdx];
            Q().then(() => {
                this.onTitleChanged();
                if (this.playlist[idx].data === null) {
                    return this.loadData(this.playlist[idx].id);
                }
            }).then(() => {
                this.player.play(idx);
                if (!this.playing) {
                    this.playing = true;
                    this.onTitleChanged();
                    this._triggerPlay();
                }
                this.currentOrderIdx = orderIdx;
                this._triggerUpdateCurrentlyPlayed();
            });
        }
        else {
            this._pause();
        }
    }
    
    private _pause() {
        if (this.playing) {
            this.playing = false;
            this.player.pause();
            this._triggerPause();
        }
    }
    
    private _triggerUpdatePlaylist() {
        this.app.dispatchEvent<UpdatePlaylistEvent>({
            type: "update-playlist",
            playlist: this.getPlaylist(),
        })
    }
    
    private _triggerPlay() {
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "player-play",
        });
    }

    private _triggerPause() {
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "player-pause",
        });
    }

    private _triggerUpdateCurrentlyPlayed(onlyVisualUpdate: boolean = false) {
        this.app.dispatchEvent<BasicPlayerEvent>({
            type: "update-currently-played-index",
            idx: this.order[this.currentOrderIdx],
            onlyVisualUpdate: onlyVisualUpdate,
        });
    }
    
    private _triggerSetOption(option: "loop"|"random"|"collapsed"|"muted", value: boolean) {
        this.app.dispatchEvent<SetPlayerOptionEvent>({
            type: "set-player-option",
            option: option,
            value: value,
        });
    }
    
    private _triggerSetVolume(volume: number) {
        this.app.dispatchEvent<SetPlayerVolumeEvent>({
            type: "set-player-volume",
            volume: volume,
        });
    }
    
    private getOpenableElement(id: string): Q.Promise<OpenableElement> {
        if (!id) {
            return null;
        }
        let parsed = Entry.parseId(id);
        if (parsed != null) {
            let def = Q.defer<OpenableElement>();
            this.sectionManagerPromise.then(sectionManager => {
                return sectionManager.getFileOpenableElement(id, true);
            }).then(oe => {
                def.resolve(oe);
            }).catch(() => {
                def.resolve(null);
            });
            return def.promise;
        }
        else {
            let def = Q.defer<OpenableAttachment>();
            this.sinkIndexManagerPromise.then(sinkIndexManager => {
                let splitted = id.split("/");
                let sinkIndex = sinkIndexManager.getSinkIndexById(splitted[0]);
                if (sinkIndex == null) {
                    return null;
                }
                let entry = sinkIndex.getEntry(parseInt(splitted[1]));
                if (entry == null) {
                    return null;
                }
                let message = entry.getMessage();
                let attachmentIndex = parseInt(splitted[2]);
                let attachment = message.attachments[attachmentIndex];
                if (attachment == null) {
                    return null;
                }
                return OpenableAttachment.create(attachment, true, true);
            }).then(oa => {
                def.resolve(oa);
            }).catch(() => {
                def.resolve(null);
            });
            return def.promise;
        }
    }
    
    private _updateMuted() {
        this.player.setIsMuted(this.isMuted);
    }
    
    private _updateVolume() {
        this.player.setVolume(this.volume);
    }
    
}