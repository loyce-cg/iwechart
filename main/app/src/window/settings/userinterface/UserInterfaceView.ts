import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./UserInterfaceController";

export class UserInterfaceView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "userinterface",
            priority: 300,
            groupId: "account",
            icon: "laptop",
            labelKey: "window.settings.menu.item.interface.label",
            addSeparatorBefore: true,
        };
    }
    
    systemClipboardIntegrationConverter($elem: JQuery): string {
        let origValue = $elem.data("orig-value");
        if ($elem.is(":checked")) {
            return "enabled";
        }
        else {
            if (origValue == "ask") {
                return "ask";
            }
            return "disabled";
        }
    }
    
}
