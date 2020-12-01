import {WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import {EditorWindowView} from "../editor/EditorWindowView";
import {Model} from "./UnsupportedWindowController";
import {func as fileInfoTemplate} from "./template/file-info.html";

@WindowView
export class UnsupportedWindowView extends EditorWindowView<Model> {
        
    constructor(parent: app.ViewParent) {
        super(parent);
    }
    
    onInitWindow() {
        this.$main.on("click", "[data-action=open]", this.onOpenClick.bind(this));
        this.$main.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        this.$main.on("click", "[data-action=releaseLock]", this.onReleaseLockClick.bind(this));
    }
    
    clearState(addLoading: boolean) {
        this.$inner.find(".file-info").remove();
        super.clearState(addLoading);
    }
    
    setDataCore(_currentViewId: number, model: Model): void {
        this.$inner.find(".file-info").remove();
        this.$inner.append(this.templateManager.createTemplate(fileInfoTemplate).renderToJQ(model));
        this.clearLoading();
    }
    
    setLockState(isLockSet: boolean): void {
        this.$main.find("[data-action=releaseLock]").toggleClass("hide", !isLockSet);
        this.$main.find(".file-lock").toggleClass("hide", !isLockSet);
        this.$main.find("[data-action=open]").toggleClass("hide", isLockSet);
    }
    
    onOpenClick(): void {
        this.triggerEvent("openExternal");
    }

    onSaveClick(): void {
        this.triggerEvent("export");
    }
    
    onReleaseLockClick(): void {
      this.triggerEvent("releaseLock");
    }
}
