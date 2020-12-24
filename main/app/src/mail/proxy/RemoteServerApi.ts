// Ask your server to execute given method at remote server.
// IMPORTANT; your server know method and parameters

import * as privfs from "privfs-client";
import * as Q from "q";
import { ProxyUserInfo } from "./Types";

export class RemoteServerApi {
    
    gateway: privfs.gateway.RpcGateway;
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public destination: string
    ) {
        this.gateway = srpSecure.gateway;
    }
    
    proxyCall<T = any>(method: string, params: any, auth: boolean): Q.Promise<T> {
        return this.gateway.request("proxyCall", {
            destination: this.destination,
            method: method,
            params: params,
            auth: auth
        });
    }
    
    getServerPubKey(): Q.Promise<privfs.crypto.ecc.PublicKey> {
        return Q().then(() => {
            return this.proxyCall("getKeyStore", {name: "server:", includeAttachments: false}, false);
        })
        .then(res => {
            if (res.error) {
                return Q.reject(res.error);
            }
            let kMsg = privfs.pki.messages.KeyStoreMessage.decode(res.result);
            let keyPair = (<privfs.pki.KeyStore.EccKeyPair>kMsg.getServerKeyStore().getPrimaryKey().keyPair).keyPair;
            return new privfs.crypto.ecc.PublicKey(keyPair);
        });
    }
    
    getUserKeyStore(username: string, includeAttachments: boolean): Q.Promise<privfs.pki.Types.keystore.IKeyStore2> {
        return Q().then(() => {
            return this.proxyCall("getKeyStore", {name: "user:" + username, includeAttachments: includeAttachments}, true);
        })
        .then(res => {
            if (res.error) {
                return Q.reject(res.error);
            }
            let kMsg = privfs.pki.messages.KeyStoreMessage.decode(res.result);
            let leaf = kMsg.getLeaf();
            if (! leaf) {
                return Q.reject({msg: "Non-existant user"});
            }
            return <privfs.pki.Types.keystore.IKeyStore2>kMsg.getLeaf().getKeyStore();
        });
    }
    
    getUserInfo(username: string): Q.Promise<ProxyUserInfo> {
        return Q().then(() => {
            return this.getUserKeyStore(username, true);
        })
        .then(keyStore => {
            let usreInfo = privfs.core.MyDataDecoder.parseUserInfo(username, this.destination, keyStore, null, null);
            let keyPair = (<privfs.pki.KeyStore.EccKeyPair>keyStore.getPrimaryKey().keyPair).keyPair;
            return {
                key: new privfs.crypto.ecc.PublicKey(keyPair),
                userInfo: usreInfo
            };
        });
    }
}
