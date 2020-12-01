import { ServerApi, RoomInfo } from "./api/ServerApi";
import { AudioContextManagerOptions } from "./api/AudioContextManager";
import * as RootLogger from "simplito-logger";
import * as Q from "q";

export class VoiceChatViewModule {

    audioContextOptions: AudioContextManagerOptions;
    webSocketUrl: string;
    onDingDong: () => void;
    currentServerApi: ServerApi;
    
    constructor(audioContextOptions: AudioContextManagerOptions, webSocketUrl: string, onDingDong: () => void) {
        this.audioContextOptions = audioContextOptions;
        this.webSocketUrl = webSocketUrl;
        this.onDingDong = onDingDong;
    }
    
    
    // lib API
    streamsTalk(roomInfo: RoomInfo, auth: string): Q.Promise<void> {
        this.streamsHangup();
        let serverApi = new ServerApi(this.audioContextOptions);
        serverApi.onDingDong = this.onDingDong;
        return Q().then(() => {
            return Q(serverApi.STREAMS_talk(this.webSocketUrl, roomInfo, auth))
            .then(() => {
                this.currentServerApi = serverApi;    
            })
            .catch(e => {
                serverApi.STREAMS_hangup();
                if (serverApi == this.currentServerApi) {
                    this.currentServerApi = null;
                }
                console.error("Error STREAMS_talk", this.webSocketUrl, e);
                return Q.reject(e);
            });
        })
    }
    
    streamsSetUrl(url: string): void {
        this.webSocketUrl = url;
    }
    
    peerpinger(id: string) {
        if (!this.currentServerApi) {
            return;
        }
        this.currentServerApi.connection_ping(id);
    }
    
    streamsHangup(): void {
        if (!this.currentServerApi) {
            return;
        }
        this.currentServerApi.STREAMS_hangup();
        this.currentServerApi = null;
    }
    
    streamsMute(mute: boolean): void {
        if (!this.currentServerApi) {
            return;
        }
        this.currentServerApi.STREAMS_mute(mute);
    }
    
    streamsRingTheBell(): void {
        if (!this.currentServerApi) {
            return;
        }
        this.currentServerApi.server_dingdong();
    }
    
    toogleDebugLogLevel() {
        let logger = RootLogger.get("privfs-mail-client.mail.voicechat.api.OpusAudio");
        logger.setLevel(logger.getLevel() == RootLogger.DEBUG ? RootLogger.WARN : RootLogger.DEBUG);
        console.log("Setting log level to " + logger.getLevel().name)
    }
}
