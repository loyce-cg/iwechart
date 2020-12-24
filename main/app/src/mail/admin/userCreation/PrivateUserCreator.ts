import * as privfs from "privfs-client";
import {utils} from "../../../Types";
import { AdminDataCreatorService } from "../AdminDataCreatorService";

export interface CreatePrivateUserParams {
    creator: string;
    host: string;
    username: string;
    email: string;
    description: string;
    sendActivationLink: boolean;
    shareCommonKvdb: boolean;
    notificationEnabled: boolean;
    language: string;
}

export interface CreatePrivateUserResult {
    activationToken: string;
    token: string;
    link: string;
    linkSent: privfs.core.LinkSentStatus;
    email: string;
    shareCommonKvdb: boolean;
}

export class PrivateUserCreator {
    
    constructor(
        private adminDataCreatorService: AdminDataCreatorService,
        private sharedKvdbExtKey: privfs.crypto.ecc.ExtKey,
        private srpSecure: privfs.core.PrivFsSrpSecure
    ) {
    }
    
    async createPrivateUser(params: CreatePrivateUserParams): Promise<CreatePrivateUserResult> {
        const sendActivationLink = params.sendActivationLink && !params.shareCommonKvdb;
        const linkPattern = await this.getLinkPattern(params.username);
        const addUserResult = await this.srpSecure.addUserWithToken(
            params.creator,
            params.username,
            params.email,
            params.description,
            sendActivationLink,
            params.notificationEnabled,
            params.language,
            params.shareCommonKvdb ? "" : linkPattern,
            "private"
        );
        const activationToken = await this.createActivationToken(params.username, params.host, addUserResult.token, linkPattern, params.shareCommonKvdb);
        return {
            activationToken: activationToken,
            token: addUserResult.token,
            link: addUserResult.link,
            linkSent: addUserResult.linkSent,
            email: params.email,
            shareCommonKvdb: params.shareCommonKvdb
        };
    }
    
    private async createActivationToken(username: string, host: string, token: string, linkPattern: string, shareCommonKvdb: boolean) {
        if (shareCommonKvdb) {
            return await this.shareCommonKvdb(username, host, token, linkPattern);
        }
        return this.createActivationTokenFromInfo({
            domain: host,
            token: token,
            isAdmin: false,
            username: username
        });
    }
    
    private async shareCommonKvdb(username: string, host: string, token: string, linkPattern: string) {
        const adminDataForUser = await this.adminDataCreatorService.encryptSharedKeyInAdminDataForUser(this.sharedKvdbExtKey);
        const tokenInfo: utils.RegisterTokenInfo = {
            domain: host,
            token: token,
            isAdmin: false,
            username: username,
            key: adminDataForUser.key
        };
        const activationToken = this.createActivationTokenFromInfo(tokenInfo);
        const userIdentifier = username || token;
        const link = linkPattern.replace("{token}", token) + "&k=" + adminDataForUser.key;
        const adminDataBuffer = await this.adminDataCreatorService.encryptAdminData(userIdentifier, {
            key: adminDataForUser.key,
            link: link,
            activateToken: activationToken
        });
        await this.srpSecure.request("modifyUser", {
            username: userIdentifier,
            properties: {
                adminDataForUser: adminDataForUser.serverData,
                adminData: adminDataBuffer.toString("base64")
            }
        });
        return activationToken;
    }
    
    private async getLinkPattern(username: string) {
        const config = await this.srpSecure.getConfigEx();
        const linkPattern = config.defaultInvitationLinkPattern;
        return username ? linkPattern.replace("{token}", "{token}&u=" + username) : linkPattern;
    }
    
    private createActivationTokenFromInfo(tokenInfo: utils.RegisterTokenInfo): string {
        const buffer = Buffer.from(JSON.stringify(tokenInfo), "utf-8");
        return "activate:" + privfs.bs58.encode(buffer);
    }
}