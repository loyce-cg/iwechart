import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Model} from "./TextViewerWindowController";
import * as Q from "q";
import {app} from "../../Types";
import { KEY_CODES } from "../../web-utils/UI";

@WindowView
export class TextViewerWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q()
        .then(() => {
            this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
            this.$main.find(".text").pfScroll();
        });
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
}
