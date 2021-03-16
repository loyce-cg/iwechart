import { CommonApplication } from "../../app/common";
import { MailConst } from "../../mail";

export interface SelectedDevices {
    videoInput?: string | null;
    audioInput?: string | null;
    audioOutput?: string | null;
}

export interface AllSelectedDevices {
    [deviceId: string]: SelectedDevices;
}

export class SelectedDevicesManager {
    constructor(public app: CommonApplication) {
    }
    
    getAllSelectedDevices(): AllSelectedDevices {
        let str: string | null = this.app.userPreferences.getValue(MailConst.UI_SELECTED_DEVICES, null) || "{}";
        let allSelectedDevices: AllSelectedDevices | null = null;
        try {
            allSelectedDevices = JSON.parse(str);
        }
        catch {}
        if (!allSelectedDevices) {
            allSelectedDevices = {};
        }
        return allSelectedDevices;
    }
    
    getCurrentSelectedDevices(): SelectedDevices | null {
        let currentSelectedDevices = this.getAllSelectedDevices()[this._getDeviceId()];
        return currentSelectedDevices ? currentSelectedDevices : null;
    }
    
    async setAllSelectedDevices(allSelectedDevices: AllSelectedDevices): Promise<void> {
        await this.app.userPreferences.set(MailConst.UI_SELECTED_DEVICES, JSON.stringify(allSelectedDevices), true);
    }
    
    async setCurrentSelectedDevices(selectedDevices: SelectedDevices): Promise<void> {
        let allSelectedDevices = this.getAllSelectedDevices();
        allSelectedDevices[this._getDeviceId()] = selectedDevices;
        await this.setAllSelectedDevices(allSelectedDevices);
    }
    
    private _getDeviceId(): string {
        return this.app.deviceId;
    }
}
