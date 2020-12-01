import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./HotkeysController";

export class HotkeysView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "hotkeys",
            priority: 310,
            groupId: "account",
            icon: "keyboard-o",
            labelKey: "window.settings.menu.item.hotkeys.label"
        };
    }
}
