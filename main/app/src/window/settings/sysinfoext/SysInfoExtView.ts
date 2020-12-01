import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./SysInfoExtController";

export class SysInfoExtView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "sysInfoExt",
            priority: 101,
            groupId: "info",
            icon: "desktop",
            labelKey: "window.settings.menu.item.sysinfoext.label"
        };
    }
    
    initTab() {
        // this.$main.on("click", "[data-action=clear-cache]", this.onClearCacheButtonClick.bind(this));
    }

}
