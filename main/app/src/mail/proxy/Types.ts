import * as privfs from "privfs-client";

export interface AddServerProxyModel {
    host: string;
    serverKey: string; //eccpub58
    enabled: boolean;
    inEnabled: boolean;
    outEnabled: boolean;
    acl: string; //<user>|<local>|<admin>|username
}

export interface ModifyServerProxyModel {
    host: string;
    enabled: boolean;
    inEnabled: boolean;
    outEnabled: boolean;
    acl: string;
}

export interface RemoveServerProxyModel {
    host: string;
}

export interface ProxyAccessKeyMessage {
    type: string;
    host: string;
    lbkDataKey: string;
}

export interface ProxyServerKey {
    host: string;
    lbkKeyHex: string;
}

export interface ServerProxy {
    host: string;
    serverKey: string;
    createDate: string; //mili timestamp as string
    enabled: boolean;
    inEnabled: boolean;
    outEnabled: boolean;
    acl: string;
}

export interface SetUserlbkModel {
    username: string;
    pub: string; //eccpub58
    data: string; //base64
    loginByProxy: string; //login host
}

export interface ProxyUserInfo {
    key: privfs.crypto.ecc.PublicKey,
    userInfo: privfs.types.core.UserInfo
}

export interface ServerProxyInfo {
    inEnabled: boolean;
    outEnabled: boolean;
}
