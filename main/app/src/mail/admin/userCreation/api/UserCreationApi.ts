import * as PmxApi from "privmx-server-api";
import * as privfs from "privfs-client";

export class UserCreationApi {
    
    constructor(public gateway: privfs.gateway.RpcGateway) {
    }
    
    async addUserEx(model: PmxApi.api.admin.AddUserExModel): Promise<void> {
        return await this.gateway.request("addUserEx", model);
    }
}
