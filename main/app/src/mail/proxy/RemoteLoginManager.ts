import * as privfs from "privfs-client";
import * as Q from "q";
import { RemoteLoginService } from "./RemoteLoginService";

export class RemoteLoginManager {
    constructor(
        public gateway: privfs.gateway.RpcGateway
    ) {
    }
    
    getRpcGatewayForHost(host: string) {
        // console.log("on getRpcGatewayForHost", host);
        return Q().then(() => {
            return this.gateway.rpc.proxyManager.getProxyRpc(host);
        })
        .then(proxyRpc => {
            // console.log("after getRpcGatewayForHost", proxyRpc);
            return new privfs.gateway.RpcGateway(proxyRpc, {...privfs.core.PrivFsRpcManager.gatewayProperties}, null);
        });
    }
    
    getRemoteLoginServiceForHost(identityIndex: number, host: string) {
        // console.log("on getRemoteLoginServiceForHost", identityIndex, host);
        return Q().then(() => {
            return this.getRpcGatewayForHost(host);
        })
        .then(gateway => {
            // console.log("privFsKeyLogin", privFsKeyLogin);
            return new RemoteLoginService(gateway, identityIndex);
        });
    }
}
