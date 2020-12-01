import {window, Types} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./FileConflictResolverWindowController";

export class FileConflictResolverWindowView extends window.base.BaseWindowView<Model> {
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(_model: Model) {
        this.$main.on("click", "[data-action='cancel']", this.onCancelClick.bind(this));
        this.$main.on("click", "[data-action='omit']", this.onOmitClick.bind(this));
        this.$main.on("click", "[data-action='overwrite']", this.onOverwriteClick.bind(this));
    }
    
    onCancelClick(): void {
        this.triggerEvent("abort");
    }
    
    onOmitClick(): void {
        this.triggerEvent("omit", this.getForAll());
    }
    
    onOverwriteClick() {
        this.triggerEvent("overwrite", this.getForAll());
    }
    
    getForAll(): boolean {
        return this.$main.find("[data-name=forall]").is(':checked');
    }
}
