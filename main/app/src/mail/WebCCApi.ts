import * as privfs from "privfs-client";
import * as Q from "q";
import * as types from "./WebCCApiTypes";
import {JsonRpcRequest, Params} from "simplito-net";

interface VerifyDataModel {
    url: string;
    lang: string;
    appVersion: string;
    nonce: string;
    signature: string;
    timestamp: number;
}
export class WebCCApi {
    static ApiEndpoint: string = "https://cc.privmx.com/api/cc";
    static RegistrationKey: string = "6d723idsu238sdhfd2jmd";
    static Pub: string = "6i1WHbno9SSZi6fdzbLf5McMV3p7pZfJoP6EtAaXed7hggjrDH";

    static verifyApplicationCode(endpoint: string, model: {applicationCode: types.user.ApplicationCode}): Q.Promise<{email: types.core.Email, domainSuffix: string}> {
        return JsonRpcRequest.promise({
            url: endpoint,
            method: "verifyApplicationCode",
            params: {["applicationCode"]: model.applicationCode}
        });
    }

    static getPrefix(endpoint: string, model: {companyName: types.company.CompanyName}): Q.Promise<{prefix: types.server.ServerPrefix}> {
        return JsonRpcRequest.promise({
            url: endpoint,
            method: "getPrefix",
            params: {["companyName"]: model.companyName}
        });
    }

    static verifyPrefix(endpoint: string, model: {prefix: types.server.ServerPrefix}): Q.Promise<types.core.OK> {
        return JsonRpcRequest.promise({
            url: endpoint,
            method: "verifyPrefix",
            params: {["prefix"]: model.prefix}
        });
    }

    static registerByApplicationCode(endpoint: string, model: types.api.auth.RegisterByAppCode): Q.Promise<types.api.auth.RegisterByAppCodeResult> {
        return JsonRpcRequest.promise({
            url: endpoint,
            method: "registerByApplicationCode",
            params: {["prefix"]: model.prefix, ["applicationCode"]: model.applicationCode, ["companyName"]: model.companyName}
        });
    }

    static getRegistrationInfo(endpoint: string, model: {lang: string, version: string, locale: string}): Q.Promise<{url: types.core.Url}> {
        let data: types.api.auth.ServerInfoResult = null;
        let nonce: string = null;

        return Q().then(() => {
            return privfs.crypto.service.randomBytes(40).toString();
        })
        .then(rand => {
            nonce = rand;
            return JsonRpcRequest.promise({
                url: endpoint,
                method: "getRegistrationInfo",
                params: {["lang"]: model.lang, locale: model.locale, ["version"]: model.version, ["key"]: "6d723idsu238sdhfd2jmd", ["nonce"]: nonce}
            })
            .then((_data: types.api.auth.ServerInfoResult) => {
                data = _data;
                let verifyModel: VerifyDataModel = {
                    url: data.url,
                    lang: model.lang,
                    appVersion: model.version,
                    nonce: nonce,
                    signature: data.sign,
                    timestamp: data.timestamp
                }
                
                return this._verifyDataSource(verifyModel);
            })
            .then(valid => {
                return valid ? Q.resolve(data) : Q.reject("Error(10001): Untrusted resource");
            })
        })
    }

    static _verifyDataSource(model: VerifyDataModel): Q.Promise<boolean> {
        //we build sigData
        let sigData = Buffer.from(["privmx-desktop-views", model.url, model.timestamp, model.lang, model.appVersion, WebCCApi.RegistrationKey, model.nonce].join(":"), "utf8");

        //decode key
        let pubKey = privfs.crypto.ecc.PublicKey.fromBase58DER(WebCCApi.Pub);

        //Check signature
        return privfs.crypto.service.verifyCompactSignatureWithHash(pubKey, sigData, Buffer.from(model.signature, "base64"))
    }

    static CONTROL_CENTER_TOKEN_CURRENT_ORDER: string = "currentOrder";
    static getControlCenterToken(gateway: privfs.gateway.RpcGateway, destination?: string): Q.Promise<types.api.auth.ControlCenterTokenResult> {
        return gateway.request("getControlCenterToken", destination ? {destination} : {});
    }

    static getControlCenterSupportForm(gateway: privfs.gateway.RpcGateway, model: {lang: string, version: string}):Q.Promise<any> {
        return gateway.request("getControlCenterSupportFormUrl", {lang: model.lang, version: model.version});
    }
    
}
