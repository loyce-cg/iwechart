import {BaseWindowController} from "../base/BaseWindowController";
import {app, event} from "../../Types";
import { IMusicPlayer } from "../../app/common/musicPlayer/IMusicPlayer";
import Q = require("q");
import { PlayerManager } from "../../app/common/musicPlayer/PlayerManager";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { EventDispatcher } from "../../utils";
import { ElectronWindow } from "../../app/electron/window/ElectronWindow";
import { ElectronPartitions } from "../../app/electron/ElectronPartitions";

export interface ProcessorsPaths {
    recordProcessor: string;
    audioProcessor: string;
}

export class PlayerHelperWindowController extends BaseWindowController implements IMusicPlayer {
    
    static textsPrefix: string = "window.playerHelper.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    enableScreenCover: boolean = false;
    afterViewLoaded: Q.Deferred<void>;
    playerManager: PlayerManager;
    onTrackEndedCB: () => void = () => {};
    onGotDurationCB: (duration: number) => void = () => {};
    onTimeChangedCB: (value: number) => void = () => {};
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.openWindowOptions.hidden = true;
        this.openWindowOptions.height = 400;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.electronPartition = ElectronPartitions.HTTPS_SECURE_CONTEXT;
        this.skipLoadingFonts();
        this.afterViewLoaded = Q.defer();
        this.ipcMode = true;
        this.loadVoiceChatScripts();
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
    }
    
    add(data: app.BlobData): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("add", data);
        });
    }
    
    setData(idx: number, data: app.BlobData): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setData", idx, data);
        });
    }
    
    delete(idx: number): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("delete", idx);
        });
    }
    
    clear(): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("clear");
        });
    }
    
    play(idx: number): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("play", idx);
        });
    }
    
    pause(): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("pause");
        });
    }
    
    seekTo(value: number): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("seekTo", value);
        });
    }
    
    setIsMuted(muted: boolean): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setMuted", muted);
        });
    }
    
    setVolume(volume: number): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setVolume", volume);
        });
    }
    
    onTrackEnded(cb: () => void): void {
        this.onTrackEndedCB = cb;
    }
    
    onViewTrackEnded(): void {
        if (this.onTrackEndedCB) {
            this.onTrackEndedCB();
        }
    }
    
    onGotDuration(cb: (duration: number) => void): void {
        this.onGotDurationCB = cb;
    }
    
    onViewGotDuration(duration: number): void {
        if (this.onGotDurationCB) {
            this.onGotDurationCB(duration);
        }
    }
    
    onTimeChanged(cb: (duration: number) => void): void {
        this.onTimeChangedCB = cb;
    }
    
    onViewTimeChanged(value: number): void {
        if (this.onTimeChangedCB) {
            this.onTimeChangedCB(value);
        }
    }
    
    canPlayTypes(mimes: string[]): Q.Promise<{ [key: string]: boolean }> {
        return this.afterViewLoaded.promise.then(() => {
            return this.retrieveFromView("canPlayTypes2", JSON.stringify(mimes)).then((data: string) => {
                return JSON.parse(data);
            });
        });
    }
    
    
    ////////////// STREAMS
    
    talk(hostHash: string, sectionId: string): void {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        let voiceApi = session.services.voiceChatServiceApi;
        let section = session.sectionManager.getSection(sectionId);
        let voiceChatEncryptionKey: Buffer;
        
        Q().then(() => {
            return section.getVoiceChatEncryptionKey();
        })
        .then(encKey => {
            voiceChatEncryptionKey = encKey;
            return this.app.askForMicrophoneAccess()
        })
        .then(micAccessible => {
            return !micAccessible ? Q.reject<void>() : voiceApi.joinToRoom(section)
            .then(data => {
                // console.log("joinToRoom result", data);
                let url: string = data.url;
                
                // url dla audio processorow
                let processorsPaths = this.getProcessorsPaths();
                
                // url websocketowy
                let webSocketUrl = PlayerHelperWindowController._getWebSocketAddrFromUrl(url);
                let username = session.sectionManager.identity.user;
                // console.log("calling startTalk...")
                
                this.callViewMethod("streamsTalk", webSocketUrl, processorsPaths, data.roomId, data.auth, username, voiceChatEncryptionKey);
            });
        })
        .fail(e => {
            console.log("talk failed", e);
            this.errorCallback(e);
        })
    }
    
    mute(mute: boolean): void {
        this.callViewMethod("streamsMute", mute);
    }
    
    hangup(): void {
        this.callViewMethod("streamsHangup");
    }
    
    ringTheBell(hostHash: string, sectionId: string): void {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        let voiceApi = session.services.voiceChatServiceApi;
        voiceApi.joinToRoom(session.sectionManager.getSection(sectionId))
        .then(data => {
            let url: string = data.url;
            
            let processorsPaths = this.getProcessorsPaths();
            let webSocketUrl = PlayerHelperWindowController._getWebSocketAddrFromUrl(url);
            
            this.callViewMethod("streamsRingTheBell", webSocketUrl, processorsPaths, data.roomId);
        })
        .fail(e => {
            console.log("ringTheBell failed", e);
        })
    }
    
    registerStreamsEvents(eventDispatcher: EventDispatcher): void {
        //@todo ten event listener jest do usuniecia - dotyczy testowego przycisku Talk
        eventDispatcher.addEventListener<event.StreamsActionEvent>("streamsAction", event => {
            if (event.action == "talk") {
                this.talk(event.hostHash, event.sectionId);
            }
        });
        eventDispatcher.addEventListener<event.JoinedVoiceChatTalkingEvent>("joinedVoiceChat", event => {
            this.talk(event.hostHash, event.sectionId);
        });
        
        eventDispatcher.addEventListener<event.LeftVoiceChatTalkingEvent>("leftVoiceChat", _event => {
            this.hangup();
        });
        
        eventDispatcher.addEventListener<event.StartedTalkingEvent>("startedTalking", _event => {
            this.mute(false);
        });
        
        eventDispatcher.addEventListener<event.StoppedTalkingEvent>("stoppedTalking", _event => {
            this.mute(true);
        });
        
        eventDispatcher.addEventListener<event.RingTheBellTalkingEvent>("ringTheBell", event => {
            this.ringTheBell(event.hostHash, event.sectionId);
        })
    }

    onViewTalkFailed(): void {
        this.app.voiceChatService.leaveVoiceChat();
    }
    
    onViewDingDong(): void {
        this.app.playAudio("notification", true);
        this.app.voiceChatService.onDingDong();
    }
    
    onViewHideWindow() {
        this.nwin.hide();
    }
    
    onViewToggleDevTools() {
        if ((<ElectronWindow>this.nwin).toogleDevTools) {
            (<ElectronWindow>this.nwin).toogleDevTools();
        }
    }
    
    loadVoiceChatScripts(): void {
        let session = this.app.sessionManager.getLocalSession();
        let voiceApi = session.services.voiceChatServiceApi;
        let path = voiceApi.getScriptsPath(this.app.assetsManager);
        let fullNormalizedPath = this.escapeBackslashes(path + "/libopus.wasm");
        this.addDynamicScript("LIBOPUS_WASM_URL = '" + fullNormalizedPath + "';");
        let scripts: string[] = ["libopus.wasm.js"];
        scripts.forEach(x => this.addViewScript({path: "build/voicechat/" + x}));
    }
    
    static _getWebSocketAddrFromUrl(url: string): string {
        return url.replace("http://", "ws://").replace("https://", "wss://");
    }
    

    getProcessorsPaths(): ProcessorsPaths {
        return {
            audioProcessor: this.app.getAssetSafeUrl("build/voicechat/stream-audio-processor.js"),
            recordProcessor: this.app.getAssetSafeUrl("build/voicechat/stream-record-processor.js")
        };
    }

    escapeBackslashes(str: string): string {
        return str.replace(/\\/g, '\\\\');
    }
}
