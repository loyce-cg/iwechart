import * as $ from "jquery";

export class Flex {
    
    static isDetachedIframe() {
        return window == null || (window.parent != window && window.parent == null);
    }
    
    static refreshFlex() {
        if (this.isDetachedIframe()) {
            return;
        }
        $(".flex-container").each((i, e) => {
            let $e = $(e);
            let height = $e.height();
            let fixedHeight = 0;
            let flexValue = 0;
            let flexChildren: JQuery[] = [];
            $e.children().each((i, e) => {
                let $child = $(e);
                if ($child.data().flex) {
                    flexValue += $child.data().flex;
                    flexChildren.push($child);
                }
                else {
                    fixedHeight += $child.outerHeight(true);
                }
            });
            if (flexValue == 0) {
                return;
            }
            let flexPixel = (height - fixedHeight) / flexValue;
            for (var i = 0; i < flexChildren.length; i++) {
                flexChildren[i].css("height", (flexChildren[i].data("flex") * flexPixel) + "px");
            }
        });
    }
}
