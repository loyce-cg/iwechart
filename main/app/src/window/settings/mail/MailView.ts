import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./MailController";

export class MailView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "mail",
            priority: 100,
            groupId: "misc",
            icon: "pencil",
            labelKey: "window.settings.menu.item.mail.label"
        };
    }
}
