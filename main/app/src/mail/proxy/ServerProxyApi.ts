import * as privfs from "privfs-client";
import { ServerProxy, AddServerProxyModel, ModifyServerProxyModel, RemoveServerProxyModel, ServerProxyInfo } from "./Types";
export class ServerProxyApi {
    
    constructor(
        public gateway: privfs.gateway.RpcGateway
    ) {
    }
    
    getAllServerProxy(): Q.Promise<ServerProxy[]> {
        return this.gateway.request("getAllServerProxy", {});
    }
    
    addServerProxy(model: AddServerProxyModel): Q.Promise<ServerProxy> {
        return this.gateway.request("addServerProxy", model);
    }
    
    modifyServerProxy(model: ModifyServerProxyModel): Q.Promise<ServerProxy> {
        return this.gateway.request("modifyServerProxy", model);
    }
    
    removeServerProxy(model: RemoveServerProxyModel): Q.Promise<"OK"> {
        return this.gateway.request("removeServerProxy", model);
    }
    
    addExternalPrivmxUser(creator: string, username: string, displayName: string, email: string, description: string, notificationsEnabled: boolean, language: string, privateSectionAllowed: boolean): Q.Promise<privfs.types.core.AddUserResult> {
        return this.gateway.request<privfs.types.core.AddUserResult>("addExternalPrivmxUser", {
            creator: creator,
            username: username,
            displayName: displayName,
            email: email,
            description: description,
            language: language,
            privateSectionAllowed: privateSectionAllowed,
            notificationsEnabled: notificationsEnabled
        });
    }

    checkRemoteServerProxy(host: string): Q.Promise<ServerProxyInfo> {
        return this.gateway.request("checkRemoteServerProxy", {host: host});
    }
}
