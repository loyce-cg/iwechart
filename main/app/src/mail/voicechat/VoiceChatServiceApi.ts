import * as privfs from "privfs-client";
import * as Q from "q";
import * as PmxApi from "privmx-server-api";
import { SectionService } from "../section/SectionService";
import { AssetsManager } from "../../app/common/AssetsManager";

export class VoiceChatServiceApi {

    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
    ) {
    }

    joinToRoom(section: SectionService): Q.Promise<PmxApi.api.talk.JoinResult> {
        this.log("joinToRoom", section.getId());
        return this.srpSecure.gateway.request("joinToRoom", {sectionId: section.getId()});
    }

    getRoomInfo(section: SectionService): Q.Promise<PmxApi.api.talk.RoomInfo> {
        this.log("getRoomInfo", section.getId());
        return this.srpSecure.gateway.request("getRoomInfo", {sectionId: section.getId()});

    }

    getRoomsInfo(): Q.Promise<any> {
        this.log("getRoomsInfo");
        return this.srpSecure.gateway.request("getRoomsInfo", {});
    }

    getScriptsPath(assetsManager: AssetsManager): string {
        return assetsManager.getAsset("build/voicechat");
    }

    log(text: string, ...rest: any[]) {
        // console.log("VoiceChatService: ", text, ...rest);
    }
}