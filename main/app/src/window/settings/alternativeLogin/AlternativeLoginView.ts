import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./AlternativeLoginController";

export class AlternativeLoginView extends BaseView<Model> {
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "alternativeLogin",
            priority: 201,
            groupId: "account",
            icon: "ellipsis-h",
            labelKey: "window.settings.menu.item.alternativeLogin.label"
        };
    }
    
    initTab() {
        this.$main.on("click", "[data-action=show-secret-id-words]", this.onShowSecretIdWordsClick.bind(this));
    }
    
    afterRenderContent(model: Model) {
    }
    
    onShowSecretIdWordsClick(): void {
        this.triggerEvent("showSecretIdWords");
    }
    
}
