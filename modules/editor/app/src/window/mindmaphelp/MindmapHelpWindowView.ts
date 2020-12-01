import {window, Types} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";

export class MindmapHelpWindowView extends window.base.BaseWindowView<void> {
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
    }
}
