import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {ComponentView} from "../../component/base/ComponentView";
import {StatusBarView} from "../../component/statusbar/StatusBarView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Lang} from "../../utils/Lang";
import {Model} from "./FontsWindowController";
import * as Q from "q";
import {app} from "../../Types";

@WindowView
export class FontsWindowView extends BaseWindowView<Model> {
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.$body.on("click", "[data-trigger=set-text]", this.onSetTextClick.bind(this));
        return Q();
    }
    
    onSetTextClick(): void {
        this.triggerEvent("setText");
    }
    
    setModel(modelStr: string): void {
        let $el = this.mainTemplate.renderToJQ(JSON.parse(modelStr));
        this.$main.replaceWith($el);
        this.$main = $el;
    }
    
}
