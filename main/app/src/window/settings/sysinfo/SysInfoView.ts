import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./SysInfoController";
import { InfoTooltip } from "../../../component/infotooltip/InfoTooltip";

export class SysInfoView extends BaseView<Model> {
    cacheTooltip: InfoTooltip;
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "sysInfo",
            priority: 100,
            groupId: "info",
            icon: "hdd-o",
            labelKey: "window.settings.menu.item.sysinfo.label"
        };
        
        this.cacheTooltip = this.addComponent("infoTooltip", new InfoTooltip(this.parent));
    }
    
    initTab() {
        this.$main.on("click", "[data-action=clear-cache]", this.onClearCacheButtonClick.bind(this));
        this.$main.on("click", "[data-action=clear-tmp]", this.onClearTmpButtonClick.bind(this));

    }
    
    afterRenderContent(model: Model): void {
        this.cacheTooltip.init(this.$main);
    }
    
    onClearCacheButtonClick(): void {
        this.triggerEvent("clearCacheAndLogout");
    }
    onClearTmpButtonClick(): void {
        this.triggerEvent("clearTempFiles");
    }
}
