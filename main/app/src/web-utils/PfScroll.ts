import * as $ from "jquery";
require("jquery-mousewheel")($);

export class PfScroll {
    
    $ele: JQuery;
    $content: JQuery;
    $scrollPanel: JQuery;
    $scroll: JQuery;
    $mover: JQuery;
    $backdrop: JQuery;
    skipOnClick: number;
    contentHeight: number;
    visibleContentHeight: number;
    drag: {mouse: number, mover: number};
    diff: number;
    horizontal: boolean;
    
    constructor(ele: HTMLElement) {
        this.$ele = $(ele);
        this.$ele.addClass("pf-scrollable");
        this.$ele.data("pf-scroll", this);
        this.$content = $('<div class="pf-content"></div>');
        this.$scrollPanel = $('<div class="pf-scroll-panel"></div>');
        this.$scroll = $('<div class="pf-scroll"></div>');
        this.$mover = $('<div class="pf-mover"></div>');
        this.$backdrop = $('<div class="pf-scrollable-backdrop"></div>');
        this.$content.append(this.$ele.contents());
        this.$ele.append(this.$content);
        this.$ele.append(this.$scrollPanel);
        this.$scrollPanel.append(this.$scroll);
        this.$scroll.append(this.$mover);
        this.horizontal = this.$ele.hasClass("pf-scrollable-horizontal");
        $("body").append(this.$backdrop);
        this.updateMover();
        this.$scroll.on("click", this.onScrollClick.bind(this));
        this.$mover.on("mousedown", this.onMoverMouseDown.bind(this));
        this.$backdrop.on("mouseup", this.onBackdropMouseUp.bind(this));
        this.$backdrop.on("mousemove", this.onBackdropMouseMove.bind(this));
        this.$ele.on("mousewheel", this.onMouseWheel.bind(this));
        this.$ele.on("mousemove", this.onMouseMove.bind(this));
        this.$content.on("scroll", this.onContentScroll.bind(this));
    }
    
    updateMover(): void {
        let content = this.$content[0];
        let contentHeight = this.horizontal ? content.scrollWidth : content.scrollHeight;
        if (this.horizontal && this.$content.children(".pf-content")[0]) {
            contentHeight = this.$content.children(".pf-content")[0].scrollWidth;
        }
        let contentScrollTop = this.horizontal ? content.scrollLeft : content.scrollTop;
        let visibleContentHeight = this.horizontal ? content.clientWidth : content.clientHeight;
        let scrollHeight = this.horizontal ? this.$scroll.width() : this.$scroll.height();
        let moverHeight = Math.max(scrollHeight * visibleContentHeight / contentHeight, 20);
        let moverTop = (scrollHeight - moverHeight) * contentScrollTop / (contentHeight - visibleContentHeight);
        this.skipOnClick = contentHeight * 0.05;
        if (this.horizontal) {
            this.$mover.css("left", moverTop);
            this.$mover.css("width", moverHeight);
        }
        else {
            this.$mover.css("top", moverTop);
            this.$mover.css("height", moverHeight);
        }
        this.contentHeight = contentHeight;
        this.visibleContentHeight = visibleContentHeight;
        if (contentHeight == visibleContentHeight) {
            this.$scrollPanel.css("visibility", "hidden");
            this.$content.parent().toggleClass((this.horizontal ? "h" : "v") + "-scrollbar-visible", false);
            this.$content.parent().toggleClass((this.horizontal ? "h" : "v") + "-scrollbar-hidden", true);
        }
        else {
            this.$scrollPanel.css("visibility", "visible");
            this.$content.parent().toggleClass((this.horizontal ? "h" : "v") + "-scrollbar-visible", true);
            this.$content.parent().toggleClass((this.horizontal ? "h" : "v") + "-scrollbar-hidden", false);
        }
    }
    
    onScrollClick(event: MouseEvent): void {
        let bbox = this.$mover[0].getBoundingClientRect();
        if (this.horizontal) {
            if (event.pageX < bbox.left) {
                this.$content[0].scrollLeft -= this.skipOnClick;
                this.updateMover();
            }
            if (event.pageX > bbox.right) {
                this.$content[0].scrollLeft += this.skipOnClick;
                this.updateMover();
            }
        }
        else {
            if (event.pageY < bbox.top) {
                this.$content[0].scrollTop -= this.skipOnClick;
                this.updateMover();
            }
            if (event.pageY > bbox.bottom) {
                this.$content[0].scrollTop += this.skipOnClick;
                this.updateMover();
            }
        }
    }
    
    onMoverMouseDown(event: MouseEvent): boolean {
        this.$ele.addClass("dragged");
        this.$backdrop.show();
        this.drag = {
            mouse: this.horizontal ? event.pageX : event.pageY,
            mover: parseInt(this.$mover.css(this.horizontal ? "left" : "top").replace("px", ""))
        };
        return false;
    }
    
    onBackdropMouseUp(event: MouseEvent): void {
        this.$ele.removeClass("dragged");
        this.$backdrop.hide();
        this.drag = null;
    }
    
    onBackdropMouseMove(event: MouseEvent): void {
        if (!this.drag) {
            return;
        }
        this.diff = (this.horizontal ? event.pageX : event.pageY) - this.drag.mouse;
        let top = this.drag.mover + this.diff;
        if (top < -1) {
            top = 0;
        }
        let moverHeight = this.horizontal ? this.$mover.width() : this.$mover.height();
        let scrollHeight = this.horizontal ? this.$scroll.width() : this.$scroll.height();
        let maxTop = scrollHeight - moverHeight;
        if (top > maxTop) {
            top = maxTop;
        }
        this.$mover.css(this.horizontal ? "left" : "top", top + "px");
        let content = this.$content[0];
        if (this.horizontal) {
            content.scrollLeft = (content.scrollWidth - content.clientWidth) * top / maxTop;
        }
        else {
            content.scrollTop = (content.scrollHeight - content.clientHeight) * top / maxTop;
        }
    }
    
    onMouseWheel(event: JQueryMouseWheelEvent): void {
        let deltaX = event.shiftKey ? event.deltaY : -event.deltaX;
        let deltaY = event.shiftKey ? event.deltaX : event.deltaY;
        if (this.horizontal) {
            this.$content[0].scrollLeft -= deltaX * event.deltaFactor;
        }
        else {
            this.$content[0].scrollTop -= deltaY * event.deltaFactor;
        }
        this.updateMover();
    }
    
    onMouseMove(event: MouseEvent): void {
        let contentScrollHeight = this.horizontal ? this.$content[0].scrollWidth : this.$content[0].scrollHeight;
        let contentClientHeight = this.horizontal ? this.$content[0].clientWidth : this.$content[0].clientHeight;
        if (this.contentHeight != contentScrollHeight || this.visibleContentHeight != contentClientHeight) {
            this.updateMover();
        }
    }
    
    scrollToTop(): void {
        if (this.horizontal) {
            this.$content[0].scrollLeft = 0;
        }
        else {
            this.$content[0].scrollTop = 0;
        }
        this.updateMover();
    }
    
    scrollToBottom(): void {
        if (this.horizontal) {
            this.$content[0].scrollLeft = this.$content[0].scrollWidth;
        }
        else {
            this.$content[0].scrollTop = this.$content[0].scrollHeight;
        }
        this.updateMover();
    }
    
    turnOn(): void {
        this.$ele.removeClass("pf-scrollable-turned-off");
        this.updateMover();
    }
    
    turnOff(): void {
        this.$ele.addClass("pf-scrollable-turned-off");
    }
    
    onContentScroll(): void {
        this.updateMover();
    }
    
    destroy(): void {
        this.$ele.data("pf-scroll", null);
    }
}
$.fn.pfScroll = function() {
    let pfScroll = $(this).data("pf-scroll");
    if (pfScroll == null) {
        pfScroll = new PfScroll(this);
    }
    return pfScroll;
};
