import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {AdminWindowView} from "../AdminWindowView";
import * as Q from "q";
import { CustomizationEditorView } from "../../../component/customizationeditor/web";

export class CustomizationView extends BaseView<void> {
    
    editor: CustomizationEditorView;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        this.menuModel = {
            id: "customization",
            priority: 110,
            hidden: true,
            groupId: "misc",
            icon: "paint-brush",
            labelKey: "window.admin.menu.customization"
        };
        this.editor = this.addComponent("editor", new CustomizationEditorView(this));
    }
    
    initTab(): Q.Promise<void> {
        return Q().then(() => {
            this.editor.$container = this.$main.find(".editor-container");
            return this.editor.triggerInit();
        });
    }

}
