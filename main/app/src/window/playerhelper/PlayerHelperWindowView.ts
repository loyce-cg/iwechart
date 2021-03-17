import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import { IMusicPlayer } from "../../app/common/musicPlayer/IMusicPlayer";
import { MusicPlayer } from "../../app/common/musicPlayer/MusicPlayer";
import { VoiceChatViewModule } from "../../mail/voicechat/VoiceChatViewModule";
import Q = require("q");
import {func as mainTemplate} from "./template/main.html";
import { ProcessorsPaths } from "./PlayerHelperWindowController";

@WindowView
export class PlayerHelperWindowView extends BaseWindowView<void> implements IMusicPlayer {
    
    musicPlayer: MusicPlayer;
    voiceChatModule: VoiceChatViewModule;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow() {
        this.musicPlayer = new MusicPlayer();
        this.musicPlayer.initPlayer(<HTMLAudioElement>this.$main.find("#main-audio-player").get(0));
        this.onTrackEnded(() => {
            this.triggerEvent("trackEnded");
        });
        this.onGotDuration(duration => {
            this.triggerEvent("gotDuration", duration);
        });
        this.onTimeChanged(value => {
            this.triggerEvent("timeChanged", value);
        });
        this.$main.on("click", "[data-action='hide-window']", this.onHideWindowBtnClick.bind(this));
        this.$main.on("click", "[data-action='toggle-dev-tools']", this.onToggleDevTools.bind(this));
    }
    
    add(data: app.BlobData): void {
        this.musicPlayer.add(data);
    }
    
    setData(idx: number, data: app.BlobData): void {
        this.musicPlayer.setData(idx, data);
    }
    
    delete(idx: number): void {
        this.musicPlayer.delete(idx);
    }
    
    clear(): void {
        this.musicPlayer.clear();
    }
    
    play(idx: number): void {
        this.musicPlayer.play(idx);
    }
    
    pause(): void {
        this.musicPlayer.pause();
    }
    
    seekTo(value: number): void {
        this.musicPlayer.seekTo(value);
    }
    
    setIsMuted(muted: boolean): void {
        this.musicPlayer.setIsMuted(muted);
    }
    
    setVolume(volume: number): void {
        this.musicPlayer.setVolume(volume);
    }
    
    onTrackEnded(cb: () => void): void {
        this.musicPlayer.onTrackEnded(cb);
    }
    
    onGotDuration(cb: (duration: number) => void): void {
        this.musicPlayer.onGotDuration(cb);
    }
    
    onTimeChanged(cb: (value: number) => void): void {
        this.musicPlayer.onTimeChanged(cb);
    }
    
    canPlayTypes(_mimes: string[]): Q.Promise<{ [key: string]: boolean }> {
        let def = Q.defer<{ [key: string]: boolean }>();
        def.resolve();
        return def.promise;
    }
    
    canPlayTypes2(mimesStr: string): string {
        return JSON.stringify(this.musicPlayer.canPlayTypes2(JSON.parse(mimesStr)));
    }
    
    initVoiceChatViewModule(processorsPaths: ProcessorsPaths, url: string) {
        if (typeof((<any>window)["AudioWorkletNode"]) === "undefined") {
            console.warn("AudioWorkletNode not available");
            return;
        }
        if (this.voiceChatModule) {
            return;
        }
        this.voiceChatModule = new VoiceChatViewModule({
            audioProcessor: processorsPaths.audioProcessor,
            recordProcessor: processorsPaths.recordProcessor
        }, url, this.onDingDongStreamsEvent.bind(this));
    }
    
    streamsTalk(url: string, processorsPaths: ProcessorsPaths, roomId: string, auth: string, _username: string, key: ArrayBuffer) {
        this.initVoiceChatViewModule(processorsPaths, url);
        if (!this.voiceChatModule) {
            return;
        }
        this.voiceChatModule.streamsTalk({name: roomId, key: key}, auth)
        .fail(e => {
            this.triggerEvent("talkFailed");
            this.logError(e);
            this.msgBox.alert("VoiceChat error: " + this.prepareErrorMessage(e));
        });
    }
    
    streamsMute(mute: boolean): void {
        if (!this.voiceChatModule) {
            return;
        }
        this.voiceChatModule.streamsMute(mute);
    }
    
    streamsHangup(): void {
        if (!this.voiceChatModule) {
            return;
        }
        this.voiceChatModule.streamsHangup();
    }
    
    streamsRingTheBell(url: string, processorsPaths: ProcessorsPaths, _roomId: string): void {
        this.initVoiceChatViewModule(processorsPaths, url);
        if (!this.voiceChatModule) {
            return;
        }
        this.voiceChatModule.streamsRingTheBell();
    }
    
    onDingDongStreamsEvent(): void {
        this.triggerEvent("dingDong");
    }
    
    onHideWindowBtnClick(): void {
        this.triggerEvent("hideWindow");
    }
    
    onToggleDevTools(): void {
        this.triggerEvent("toggleDevTools");
    }
}
