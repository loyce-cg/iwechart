import {window, Types} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./FileErrorWindowController";

export class FileErrorWindowView extends window.base.BaseWindowView<Model> {
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(_model: Model) {
        this.$main.on("click", "[data-action='cancel']", this.onCancelClick.bind(this));
        this.$main.on("click", "[data-action='omit']", this.onOmitClick.bind(this));
        this.$main.on("click", "[data-action='retry']", this.onRetryClick.bind(this));
    }
    
    onCancelClick(): void {
        this.triggerEvent("abort");
    }
    
    onOmitClick(): void {
        this.triggerEvent("omit");
    }
    
    onRetryClick() {
        this.triggerEvent("retry");
    }
}
