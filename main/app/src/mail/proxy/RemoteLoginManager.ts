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
            return new privfs.gateway.RpcGateway(proxyRpc, privfs.core.PrivFsRpcManagerClass.GATEWAY_PROPERTIES);
        });
    }
    
    getPrivFsSrpForHost(host: string) {
        // console.log("on getPrivFsSrpForHost", host);
        return Q().then(() => {
            return this.getRpcGatewayForHost(host);
        })
        .then(gateway => {
            // console.log("aftert getRpcGatewayForHost", gateway);
            return new privfs.core.PrivFsSrp(gateway);
        });
    }
    
    getPrivFsKeyLoginForHost(identityIndex: number, host: string) {
        // console.log("on getPrivFsKeyLoginForHost", identityIndex, host);
        return Q().then(() => {
            return this.getPrivFsSrpForHost(host);
        })
        .then(privFsSrp => {
            // console.log("after getting srp for host", privFsSrp);
            return new privfs.core.PrivFsKeyLogin(privFsSrp.rpcGateway, privFsSrp, identityIndex);
        })
        .then(keyLogin => {
            // console.log("after keyLogin", keyLogin);
            return keyLogin;
        })
    }
    
    getRemoteLoginServiceForHost(identityIndex: number, host: string) {
        // console.log("on getRemoteLoginServiceForHost", identityIndex, host);
        return Q().then(() => {
            return this.getPrivFsKeyLoginForHost(identityIndex, host);
        })
        .then(privFsKeyLogin => {
            // console.log("privFsKeyLogin", privFsKeyLogin);
            return new RemoteLoginService(privFsKeyLogin);
        });
    }
}
