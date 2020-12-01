import {ProgressView} from "./ProgressView";
import {webUtils} from "../../Types";

export class ProgressNotifier extends ProgressView {
    
    $container: JQuery;
    notifier: webUtils.ProgressNotifier;
    
    constructor(view: webUtils.ProgressManager, $container: JQuery, notifier: webUtils.ProgressNotifier) {
        super(view);
        this.$container = $container;
        this.notifier = notifier;
    }
    
    onStart() {
    }
    
    onProgress(data: any): void {
        let html = "";
        if (this.notifier) {
            let res = this.notifier(data);
            if (res === false) {
                return;
            }
            html = res;
        }
        else if (data) {
            html = data.toString();
        }
        this.$container.html(html);
    }
    
    onFinish() {
        this.$container.html("");
    }
}

