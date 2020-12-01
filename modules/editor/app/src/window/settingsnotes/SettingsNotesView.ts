import {window} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./SettingsNotesController";

export class SettingsNotesView extends window.settings.BaseView<Model> {
    
    constructor(parent: window.settings.SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "plugin-editor",
            priority: 400,
            groupId: "misc",
            icon: "file-o fa-flip-vertical",
            labelKey: "plugin.editor.window.settings.menu.item.editor.label"
        };
        this.parent.registerTab({tab: this});
    }
}
