import {WindowView} from "../base/BaseWindowView";
import {app} from "../../Types";
import {func as infoTemplate} from "./template/info.html";
import {EditorWindowView} from "../editor/EditorWindowView";

@WindowView
export class UrlWindowView extends EditorWindowView {
    
    url: string;
    
    constructor(parent: app.ViewParent) {
        super(parent);
    }
    
    onInitWindow(): void {
        this.$main.on("click", "[data-action='go-to-url']", this.onGoToUrlClick.bind(this));
    }
    
    clearState(addLoading: boolean) {
        this.$inner.find(".url-info").remove();
        super.clearState(addLoading);
    }
    
    setUrlData(currentViewId: number, name: string, url: string): void {
        if (window == null || currentViewId != this.currentViewId) {
            return;
        }
        this.url = url;
        this.$inner.find(".url-info").remove();
        this.$inner.append(this.templateManager.createTemplate(infoTemplate).renderToJQ({
            name: name,
            url: url
        }));
        this.clearLoading();
    }
    
    onGoToUrlClick(): void {
        if (this.url) {
            let url = this.url.indexOf("www") == 0 ? "http://" + this.url : this.url;
            window.open(url, '_blank');
        }
    }
}
