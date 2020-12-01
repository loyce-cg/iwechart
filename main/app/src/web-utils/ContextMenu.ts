import * as $ from "jquery";
import {Template} from "./template/Template";

export interface Coord {
    x: number;
    y: number;
}

export interface Options<M = void, C = void, H = void> {
    $element?: boolean;
    $contextMenu?: JQuery;
    html?: string;
    template?: Template<M, C, H>;
    coord?: Coord;
    event?: MouseEvent;
    closeHandler?: () => void;
    handler?: () => void;
    stopEvent?: boolean;
    helper?: H;
    context?: C;
    model?: M;
}

export class ContextMenu {
    
    static initWithRightClick(): void {
        $("body").on("contextmenu", ".context-menu > .context-menu-backdrop", () => {
            ContextMenu.closeAll();
            return false;
        });
        $("body").on("contextmenu", ".context-menu > .context-menu-content li", () => {
            return false;
        });
        $("body").on("contextmenu", ".blockUI", () => {
            return false;
        });
        ContextMenu.init();
    }
    
    static init(): void {
        $("body").on("click", ".context-menu > .context-menu-backdrop", () => {
            ContextMenu.closeAll();
            return false;
        });
        $("body").on("click", ".context-menu > .context-menu-content [data-action]", (event: any) => {
            let $trigger = $(event.target).closest("[data-action]");
            let action = $trigger.data("action");
            let handler = $trigger.closest(".context-menu").data("context-menu-handler");
            ContextMenu.closeAll();
            if (typeof(handler) == "function") {
                handler(action, event);
            }
        });
    }
    
    static closeAll(): void {
        $(".context-menu").each((idx, elem) => {
            let $elem = $(elem);
            let handler = $elem.data("context-menu-close-handler");
            if (typeof(handler) == "function") {
                handler();
            }
            $elem.remove();
        });
    }
    
    static show<M = void, C = void, H = void>(options: Options<M, C, H>): JQuery {
        let $contextMenu;
        if (options.$element) {
            $contextMenu = options.$contextMenu;
        }
        else if (options.html) {
            $contextMenu = $(options.html.trim());
        }
        else if (options.template) {
            $contextMenu = options.template.renderToJQ(options.model, options.context, options.helper);
        }
        else {
            throw "Invalid parameter. Expect html as JQery, string or template";
        }
        let coord: Coord;
        if (options.coord) {
            coord = options.coord;
        }
        else if (options.event) {
            coord = {
                x: options.event.pageX,
                y: options.event.pageY
            };
            if (options.stopEvent) {
                if (typeof(event.preventDefault) == "function") {
                    event.preventDefault();
                }
                if (typeof(event.stopPropagation) == "function") {
                    event.stopPropagation();
                }
            }
        }
        $contextMenu.data("context-menu-handler", options.handler);
        $contextMenu.data("context-menu-close-handler", options.closeHandler);
        $("body").append($contextMenu);
        if (coord) {
            let $content = $contextMenu.find(".context-menu-content");
            $content.css(ContextMenu.getPosition($content, coord));
        }
        return $contextMenu;
    }
    
    static getPosition($menu: JQuery, coord: Coord): {[name: string]: string|number} {
        let mouseX = coord.x + 2;
        let mouseY = coord.y + 2;
        let boundsX = $(window).width() - 5;
        let boundsY = $(window).height() - 5;
        let menuWidth = $menu.outerWidth();
        let menuHeight = $menu.outerHeight();
        let tp = {
            "position": "absolute",
            "z-index": 9999
        };
        let Y: {top: number}, X: {left: number};
        if (mouseY + menuHeight > boundsY) {
            let top = boundsY - menuHeight;
            Y = {top: (top < 5 ? 5 : top) + $(window).scrollTop()};
        }
        else {
            Y = {top: mouseY + $(window).scrollTop()};
        }
        if ((mouseX + menuWidth > boundsX) && ((mouseX - menuWidth) > 0)) {
            X = {left: mouseX - menuWidth + $(window).scrollLeft()};
        }
        else {
            X = {left: mouseX + $(window).scrollLeft()};
        }
        let parentOffset = $menu.offsetParent().offset();
        X.left = X.left - parentOffset.left;
        Y.top = Y.top - parentOffset.top;
        return $.extend(tp, Y, X);
    }
}

ContextMenu.init();
