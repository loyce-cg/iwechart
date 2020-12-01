import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./TextController";
import { InfoTooltip } from "../../../component/infotooltip/InfoTooltip";

export class TextView extends BaseView<Model> {
    
    infoTooltip: InfoTooltip;
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "text",
            priority: 310,
            groupId: "account",
            icon: "align-justify",
            labelKey: "window.settings.menu.item.text.label",
        };
        
        this.infoTooltip = this.addComponent("infoTooltip", new InfoTooltip(this.parent));
    }
    
    initTab() {
    }
    
    afterRenderContent(model: Model): void {
        this.infoTooltip.init(this.$main);
    }
    
    
}
