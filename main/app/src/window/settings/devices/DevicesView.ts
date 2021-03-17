import { BaseView } from "../BaseView";
import { func as mainTemplate } from "./template/main.html";
import { SettingsWindowView } from "../SettingsWindowView";
import { Model } from "./DevicesController";
import { app } from "../../../Types";

export class DevicesView extends BaseView<Model> {
    
    private iframe: HTMLIFrameElement = null;
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "devices",
            priority: 320,
            groupId: "account",
            icon: " privmx-icon privmx-icon-videocall",
            labelKey: "window.settings.menu.item.devices.label"
        };
        
    }
    
    initTab() {
    }
    
    afterRenderContent(model: Model): void {
    }

    registerDockedSelectorWindow(id: number, load: app.WindowLoadOptions) {
        let $container = this.$main.find(".devices-selector-docked-container");
        this.iframe = this.viewManager.parent.registerDockedWindow(id, load, $container[0]);
    }
    
    afterDeactivated(): void {
        super.afterDeactivated();
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }
        this.triggerEvent("removeDeviceSelector");
    }
    
}
