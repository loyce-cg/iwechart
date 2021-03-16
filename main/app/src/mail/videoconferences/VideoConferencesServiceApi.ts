import * as privfs from "privfs-client";
import * as Q from "q";
import * as PmxApi from "privmx-server-api";
import { SectionService } from "../section/SectionService";

export enum VideoRoomAction {
    CREATE,
    JOIN,
}

export type JoinResult = JoinGetResult|JoinCreateResult;

export interface JoinGetResult {
    action: VideoRoomAction.JOIN;
    roomSecret: string;
    tsVideoRoomId: string;
}

export interface JoinCreateResult {
    action: VideoRoomAction.CREATE;
    domain: string;
    tmpUser: {
        username: string;
        password: string;
    };
    token: string;
}

export interface SwitchVideoRoomStateResult {
    tsVideoRoomId: string;
}

export interface ConferenceData {
    id: string;
    sectionId: string;
    users: string[];
}

export class VideoApi implements PmxApi.api.video.IVideoApi {
    
    constructor(
        public gateway: privfs.gateway.RpcGateway,
    ) {
    }
    
    request(method: string, model: any): Promise<any> {
        return <any>this.gateway.request(method, model);
    }
    
    joinToVideoRoom(model: {sectionId: PmxApi.api.section.SectionId;}): Promise<PmxApi.api.video.JoinResult> {
        return this.request("joinToVideoRoom", model);
    }
    
    switchVideoRoomState(model: PmxApi.api.video.SwitchVideoRoomModel): Promise<PmxApi.api.video.RoomResult> {
        return this.request("switchVideoRoomState", model);
    }
    
    cancelVideoRoomCreation(model: PmxApi.api.video.CancelVideoRoomCreationModel): Promise<PmxApi.api.core.OK> {
        return this.request("cancelVideoRoomCreation", model);
    }
    
    commitVideoRoomAccess(model: PmxApi.api.video.VideoRoomHandler): Promise<PmxApi.api.core.OK> {
        return this.request("commitVideoRoomAccess", model);
    }
    
    disconnectFromVideoRoom(model: PmxApi.api.video.VideoRoomHandler): Promise<PmxApi.api.core.OK> {
        return this.request("disconnectFromVideoRoom", model);
    }
    
    getVideoRoomsState(): Promise<PmxApi.api.video.RoomInfo[]> {
        return this.request("getVideoRoomsState", {});
    }
}

export class NewVideoConferencesServiceApi {
    
    videoApi: VideoApi;
    
    constructor(
        public gateway: privfs.gateway.RpcGateway
    ) {
        this.videoApi = new VideoApi(this.gateway);
    }
    
    joinToVideoRoom(section: SectionService): Q.Promise<PmxApi.api.video.JoinResult> {
        return Q().then(() => this.videoApi.joinToVideoRoom({
            sectionId: <PmxApi.api.section.SectionId>section.getId(),
        }));
    }
    
    switchVideoRoomState(section: SectionService, token: string, roomPassword: string, roomUrl: string): Q.Promise<PmxApi.api.video.RoomResult> {
        return Q().then(() => this.videoApi.switchVideoRoomState({
            sectionId: <PmxApi.api.section.SectionId>section.getId(),
            token: <PmxApi.api.video.VideoRoomCreateToken>token,
            roomPassword: <PmxApi.api.video.RoomPassword>roomPassword,
            roomUrl: <PmxApi.api.core.Url>roomUrl,
        }));
    }
    
    cancelVideoRoomCreation(section: SectionService, token: string) {
        return Q().then(() => this.videoApi.cancelVideoRoomCreation({
            sectionId: <PmxApi.api.section.SectionId>section.getId(),
            token: <PmxApi.api.video.VideoRoomCreateToken>token
        }));
    }
    
    disconnectFromVideoRoom(section: SectionService, videoRoomId: string): Q.Promise<PmxApi.api.core.OK> {
        return Q().then(() => this.videoApi.disconnectFromVideoRoom({
            sectionId: <PmxApi.api.section.SectionId>section.getId(),
            videoRoomId: <PmxApi.api.video.VideoRoomId>videoRoomId
        }));
    }
    
    commitVideoRoomAccess(section: SectionService, videoRoomId: string): Q.Promise<PmxApi.api.core.OK> {
        return Q().then(() => this.videoApi.commitVideoRoomAccess({
            sectionId: <PmxApi.api.section.SectionId>section.getId(),
            videoRoomId: <PmxApi.api.video.VideoRoomId>videoRoomId
        }));
    }
    
    getVideoRoomsState(): Q.Promise<PmxApi.api.video.RoomInfo[]> {
        return Q().then(() => this.videoApi.getVideoRoomsState());
    }
}

export class VideoConferencesServiceApi {
    
    protected newApi: NewVideoConferencesServiceApi;
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public host: string
    ) {
        this.newApi = new NewVideoConferencesServiceApi(this.srpSecure.gateway);
    }
    
    joinToVideoRoom(section: SectionService): Q.Promise<JoinResult> {
        return this.newApi.joinToVideoRoom(section).then(result => {
            if (result.type == "create") {
                const domain = this._convertRoomUrlToJitsiDomain(result.videoUrl);
                const res: JoinCreateResult = {
                    action: <VideoRoomAction.CREATE>VideoRoomAction.CREATE,
                    domain: domain,
                    tmpUser: {
                        username: `${result.credentials.user}@${domain}`,
                        password: result.credentials.password,
                    },
                    token: result.token,
                };
                return res;
            }
            else if (result.type == "room") {
                const res: JoinGetResult = {
                    action: <VideoRoomAction.JOIN>VideoRoomAction.JOIN,
                    roomSecret: result.roomPassword,
                    tsVideoRoomId: result.videoRoomId
                };
                return res;
            }
            throw new Error("Unsupported type " + (<PmxApi.api.video.JoinResult>result).type);
        });
    }
    
    switchVideoRoomState(section: SectionService, roomSecret: string, token: string): Q.Promise<SwitchVideoRoomStateResult> {
        return this.newApi.switchVideoRoomState(section, token, roomSecret, "")
        .then((result: PmxApi.api.video.RoomResult) => {
            return {
                tsVideoRoomId: result.videoRoomId,
            };
        });
    }
    
    disconnectFromVideoRoom(section: SectionService, tsVideoRoomId: string): Q.Promise<void> {
        return this.newApi.disconnectFromVideoRoom(section, tsVideoRoomId).thenResolve(null);
    }
    
    commitVideoRoomAccess(section: SectionService, tsVideoRoomId: string): Q.Promise<void> {
        return this.newApi.commitVideoRoomAccess(section, tsVideoRoomId).thenResolve(null);
    }
    
    getVideoRoomsState(): Q.Promise<ConferenceData[]> {
        return this.newApi.getVideoRoomsState()
        .then((result: PmxApi.api.video.RoomInfo[]) => {
            return result.map(roomInfo => {
                return {
                    id: null,
                    sectionId: roomInfo.sectionId,
                    users: this._convertUserNamesToHashmails(roomInfo.users),
                };
            });
        });
    }
    
    protected _convertUserNamesToHashmails(userNames: string[]): string[] {
        return userNames.map(userName => `${userName}#${this.host}`)
    }
    
    protected _getRoomUrl(domain: string, roomName: string): string {
        return `https://${domain}/${roomName}`;
    }
    
    protected _convertRoomUrlToJitsiDomain(roomUrl: string): string {
        if (roomUrl.indexOf("http://") == 0) {
            roomUrl = roomUrl.substr("http://".length);
        }
        if (roomUrl.indexOf("https://") == 0) {
            roomUrl = roomUrl.substr("https://".length);
        }
        if (roomUrl.indexOf("www.") == 0) {
            roomUrl = roomUrl.substr("www.".length);
        }
        
        [roomUrl] = roomUrl.split("/");
        
        return roomUrl;
    }
    
    protected _convertRoomUrlToRoomId(roomUrl: string): string {
        if (roomUrl.indexOf("http://") == 0) {
            roomUrl = roomUrl.substr("http://".length);
        }
        if (roomUrl.indexOf("https://") == 0) {
            roomUrl = roomUrl.substr("https://".length);
        }
        if (roomUrl.indexOf("www.") == 0) {
            roomUrl = roomUrl.substr("www.".length);
        }
        
        let roomId = roomUrl.split("/").splice(1).join("/");
        
        return roomId;
    }
    
}