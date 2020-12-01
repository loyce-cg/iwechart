import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./DownloadAttachmentWindowController";
import {app} from "../../Types";

@WindowView
export class DownloadAttachmentWindowView extends BaseWindowView<Model> {
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    setDownloadProgress(percent: number): void {
        this.$main.find(".progress-value").text(percent + "%");
    }
}
