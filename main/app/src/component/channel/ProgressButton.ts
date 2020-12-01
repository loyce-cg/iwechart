import {ProgressView} from "./ProgressView";
import {webUtils} from "../../Types";

export class ProgressButton extends ProgressView {
    
    $btn: JQuery;
    
    constructor(view: webUtils.ProgressManager, $btn: JQuery) {
        super(view);
        this.$btn = $btn;
    }
    
    onStart() {
        let $icon = this.$btn.find(".fa");
        let $text = this.$btn.find("span");
        $icon.attr("class", $icon.data("proc"));
        $text.html($text.data("proc"));
        (<HTMLButtonElement>this.$btn[0]).disabled = true;
    }
    
    onProgress() {
    }
    
    onFinish() {
        setTimeout(() => {
            let $icon = this.$btn.find(".fa");
            let $text = this.$btn.find("span");
            $icon.attr("class", $icon.data("org"));
            $text.html($text.data("org"));
            (<HTMLButtonElement>this.$btn[0]).disabled = false;
        }, 300);
        ProgressView.prototype.onFinish.apply(this, arguments);
    }
}

