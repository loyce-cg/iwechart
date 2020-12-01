import * as $ from "jquery";

$.fn.content = function(param?: JQuery) {
    return param ? this.empty().append(param) : this.children();
};