import * as Q from "q";
import {subidentity, utils} from "../../Types";

export class SubidentityApi {
    
    constructor(public gateway: utils.Gateway) {
    }
    
    assignDeviceToSubidentity(pub58: string, deviceId: string, deviceName: string): Q.Promise<void> {
        return this.gateway.request("assignDeviceToSubidentity", {
            pub: pub58,
            deviceId: deviceId,
            deviceName: deviceName
        });
    }
    
    getSubidentityData(): Q.Promise<subidentity.SubidentyRawData> {
        return this.gateway.request("getSubidentityData", {});
    }
    
    getSubidentities(): Q.Promise<subidentity.SubidentitiesRaw> {
        return this.gateway.request("getSubidentities", {});
    }
    
    setSubidentity(pub58: string, data: subidentity.SubidentyRawData): Q.Promise<void> {
        return this.gateway.request("setSubidentity", {
            pub: pub58,
            data: data
        });
    }
    
    removeSubidentity(pub58: string): Q.Promise<void> {
        return this.gateway.request("removeSubidentity", {
            pub: pub58
        });
    }
}