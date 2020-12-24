import { Utils } from "../../../utils/Utils";
import * as PmxApi from "privmx-server-api";
import { UserCreationService } from "./UserCreationService";
import { UserGroupCreatorService } from "../../section/UserGroupCreatorService";
import { AdminRightService } from "../AdminRightService";

export interface CreateNormalUserParams {
    username: string;
    host: string;
    language: string;
    email: string;
    description: string;
    admin: boolean;
    shareCommonKvdb: boolean;
}

export interface CreateBasicUserParams {
    username: string;
    host: string;
    language: string;
    description: string;
    privateSectionAllowed: boolean;
}

export interface CreateManagableUserParams {
    username: string;
    host: string;
    language: string;
    email: string;
    description: string;
    privateSectionAllowed: boolean;
    type: PmxApi.api.admin.AddUser;
    shareCommonKvdb: boolean;
}

export class ManagableUserCreator {
    
    constructor(
        private userCreationService: UserCreationService,
        private adminRightService: AdminRightService,
        private userGroupCreatorService: UserGroupCreatorService
    ) {
    }
    
    async createNormalUser(params: CreateNormalUserParams) {
        const context = await this.createManagableUser({
            username: params.username,
            host: params.host,
            language: params.language,
            email: params.email,
            description: params.description,
            privateSectionAllowed: true,
            type: {
                type: "normal"
            },
            shareCommonKvdb: params.shareCommonKvdb
        });
        if (params.admin) {
            await this.adminRightService.grantAdminRights(context.username, context.identity.identityKey);
        }
        return {
            context: context,
            job: this.userGroupCreatorService.createSectionWithUser(context.username)
        };
    }
    
    async createBasicUser(params: CreateBasicUserParams) {
        const context = await this.createManagableUser({
            username: params.username,
            host: params.host,
            language: params.language,
            email: "",
            description: params.description,
            privateSectionAllowed: params.privateSectionAllowed,
            type: {
                type: "basic"
            },
            shareCommonKvdb: false
        });
        return {
            context: context,
            job: this.userGroupCreatorService.createSectionWithUser(context.username)
        };
    }
    
    private async createManagableUser(params: CreateManagableUserParams) {
        const password = this.generatedPassword();
        
        const context = await this.userCreationService.createUser({
            username: params.username,
            host: params.host,
            password: password,
            email: params.email,
            language: params.language,
            description: params.description,
            notificationEnabled: true,
            privateSectionAllowed: params.privateSectionAllowed,
            type: params.type,
            generatedPassword: true,
            shareKvdb: params.shareCommonKvdb,
            weakPassword: false
        });
        return {
            ...context,
            language: params.language,
            username: params.username,
            password: password,
            host: params.host
        };
    }
    
    private generatedPassword() {
        return Utils.randomTemporaryPassword(6);
    }
}