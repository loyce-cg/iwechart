import * as Q from "q";
import { utils } from "../Types";
import { CustomizationData } from "../app/common/customization/CustomizationData";


export class CustomizationApi {
    
    constructor(public gateway: utils.Gateway) {
    }
    
    getCustomization(): Q.Promise<CustomizationData> {
        return this.gateway.request("getCustomization", {});
    }
    
    saveCustomization(data: CustomizationData): Q.Promise<void> {
        return this.gateway.request("saveCustomization", {
            title: data.title,
            css: data.css,
            logoHeader: data.logoHeader,
            logoHeaderWh: data.logoHeaderWh,
            logoLoginScreen: data.logoLoginScreen,
        });
    }
    
}