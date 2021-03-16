import * as $ from "jquery";
import { Debouncer } from "./Debouncer";
require("jquery-mousewheel")($);

export class PfScrollExperimental {
    
    private $ele: JQuery;
    private $content: JQuery;
    private $contentInner: JQuery;
    private $scrollPanel: JQuery;
    private $scroll: JQuery;
    private $mover: JQuery;
    private $backdrop: JQuery;
    
    private contentSize: number | null = null;
    private containerSize: number | null = null;
    private scrollbarSize: number | null = null;
    private moverSize: number | null = null;
    private position: number = 0;
    private lastAppliedPosition: number | null = null;
    private moverPosition: number = 0;
    private isMoverVisible: boolean | null = null;
    private drag: { mouse: number, mover: number };
    private horizontal: boolean;
    private moverUpdateDebouncer: Debouncer = new Debouncer(() => { this.updateMover(); }, 100);
    
    get minPosition(): number {
        return 0;
    }
    
    get maxPosition(): number {
        return Math.max(0, this.contentSize - this.containerSize);
    }
    
    get visibleRange(): [number, number] {
        return [
            this.position,
            this.position + this.containerSize,
        ];
    }
    
    constructor(ele: HTMLElement) {
        this.$ele = $(ele);
        this.$ele.addClass("pf-scrollable pf-scrollable-2");
        this.$ele.data("pf-scroll", this);
        this.$content = $('<div class="pf-content pf-content-2"></div>');
        this.$contentInner = $('<div class="pf-content-inner"></div>');
        this.$scrollPanel = $('<div class="pf-scroll-panel"></div>');
        this.$scroll = $('<div class="pf-scroll"></div>');
        this.$mover = $('<div class="pf-mover"></div>');
        this.$backdrop = $('<div class="pf-scrollable-backdrop"></div>');
        this.$content.append(this.$contentInner);
        this.$contentInner.append(this.$ele.contents());
        this.$ele.append(this.$content);
        this.$ele.append(this.$scrollPanel);
        this.$scrollPanel.append(this.$scroll);
        this.$scroll.append(this.$mover);
        this.horizontal = this.$ele.hasClass("pf-scrollable-horizontal");
        $("body").append(this.$backdrop);
        
        this.$scroll.on("click", this.onScrollClick.bind(this));
        this.$mover.on("mousedown", this.onMoverMouseDown.bind(this));
        this.$backdrop.on("mouseup", this.onBackdropMouseUp.bind(this));
        this.$backdrop.on("mousemove", this.onBackdropMouseMove.bind(this));
        this.$ele.on("mousewheel", this.onMouseWheel.bind(this));
        
        const contentResizeObserver = new (window as any).ResizeObserver(() => { this.onContainerSizeChanged(); });
        contentResizeObserver.observe(this.$content[0]);
        
        const contentInnerResizeObserver = new (window as any).ResizeObserver(() => { this.onContentSizeChanged(); });
        contentInnerResizeObserver.observe(this.$contentInner[0]);
        
        const scrollbarResizeObserver = new (window as any).ResizeObserver(() => { this.onScrollbarSizeChanged(); });
        scrollbarResizeObserver.observe(this.$scroll[0]);
        
        this.$content.on("scroll", () => { this.onScroll(); });
    }
    
    private onContentSizeChanged(): void {
        const contentInner = this.$contentInner[0];
        this.contentSize = this.horizontal ? contentInner.clientWidth : contentInner.clientHeight;
        this.updateMoverDebounced();
    }
    
    private onContainerSizeChanged(): void {
        const content = this.$content[0];
        this.containerSize = this.horizontal ? content.clientWidth : content.clientHeight;
        this.updateMoverDebounced();
    }
    
    private onScrollbarSizeChanged(): void {
        const scroll = this.$scroll[0];
        this.scrollbarSize = this.horizontal ? scroll.clientWidth : scroll.clientHeight;
        this.updateMoverDebounced();
    }
    
    private onScroll(): void {
        this.updateMoverPosition();
    }
    
    private updateMoverDebounced(): void {
        this.moverUpdateDebouncer.trigger();
    }
    
    private updateMover(): void {
        this.updateMoverSize();
        this.updateMoverPosition();
        this.updateMoverVisibility();
    }
    
    private updateMoverPosition(): void {
        if (this.containerSize === null || this.contentSize === null || this.moverSize === null || this.scrollbarSize === null) {
            return;
        }
        this.moverPosition = (this.scrollbarSize - this.moverSize) * this.position / this.maxPosition;
        const coord = this.horizontal ? "X" : "Y";
        this.$mover[0].style.transform = `translate${coord}(${Math.round(this.moverPosition)}px)`;
    }
    
    private updateMoverSize(): void {
        if (this.containerSize === null || this.contentSize === null || this.scrollbarSize === null) {
            return;
        }
        this.moverSize = Math.max(this.scrollbarSize * this.containerSize / this.contentSize, 20);
        if (this.horizontal) {
            this.$mover[0].style.width = `${this.moverSize}px`;
        }
        else {
            this.$mover[0].style.height = `${this.moverSize}px`;
        }
    }
    
    private updateMoverVisibility(): void {
        if (this.containerSize === null || this.contentSize === null) {
            return;
        }
        const isMoverVisible = this.contentSize > this.containerSize;
        if (this.isMoverVisible === isMoverVisible) {
            return;
        }
        this.isMoverVisible = isMoverVisible;
        this.$scrollPanel[0].style.visibility = isMoverVisible ? "visible" : "hidden";
        this.$ele[0].classList.toggle((this.horizontal ? "h" : "v") + "-scrollbar-visible", isMoverVisible);
        this.$ele[0].classList.toggle((this.horizontal ? "h" : "v") + "-scrollbar-hidden", !isMoverVisible);
    }
    
    private onScrollClick(event: MouseEvent): void {
        const clickPos = this.horizontal ? event.offsetX : event.offsetY;
        const moverStartPos = this.moverPosition;
        const moverEndPos = this.moverPosition + this.moverSize;
        const deltaPx = this.contentSize * 0.05;
        if (clickPos < moverStartPos) {
            this.scrollBy(-deltaPx);
        }
        else if (clickPos > moverEndPos) {
            this.scrollBy(deltaPx);
        }
    }
    
    private onMoverMouseDown(event: MouseEvent): boolean {
        this.$ele.addClass("dragged");
        this.$backdrop.show();
        this.drag = {
            mouse: this.horizontal ? event.pageX : event.pageY,
            mover: this.moverPosition,
        };
        return false;
    }
    
    private onBackdropMouseUp(event: MouseEvent): void {
        this.$ele.removeClass("dragged");
        this.$backdrop.hide();
        this.drag = null;
    }
    
    private onBackdropMouseMove(event: MouseEvent): void {
        if (!this.drag) {
            return;
        }
        const diff = (this.horizontal ? event.pageX : event.pageY) - this.drag.mouse;
        let top = this.drag.mover + diff;
        top = Math.max(top, 0);
        top = Math.min(top, this.scrollbarSize - this.moverSize);
        this.scrollTo(this.maxPosition * top / (this.scrollbarSize - this.moverSize));
    }
    
    private onMouseWheel(event: JQueryMouseWheelEvent): void {
        const deltaX = event.shiftKey ? event.deltaY : -event.deltaX;
        const deltaY = event.shiftKey ? event.deltaX : event.deltaY;
        const delta = this.horizontal ? deltaX : deltaY;
        this.scrollBy(-delta * event.deltaFactor);
    }
    
    scrollBy(deltaPosition: number): void {
        this.scrollTo(this.position + deltaPosition);
    }
    
    scrollTo(newPosition: number): void {
        newPosition = Math.max(newPosition, 0);
        newPosition = Math.min(newPosition, this.maxPosition);
        this.position = newPosition;
        requestAnimationFrame(() => {
            if (this.position == this.lastAppliedPosition) {
                return;
            }
            this.lastAppliedPosition = this.position;
            const content = this.$content[0];
            if (this.horizontal) {
                content.scrollLeft = Math.round(this.position);
            }
            else {
                content.scrollTop = Math.round(this.position);
            }
        });
    }
    
    scrollToTop(): void {
        this.scrollTo(0);
    }
    
    scrollToBottom(): void {
        this.scrollTo(this.maxPosition);
    }
    
    turnOn(): void {
        this.$ele.removeClass("pf-scrollable-turned-off");
        this.updateMover();
    }
    
    turnOff(): void {
        this.$ele.addClass("pf-scrollable-turned-off");
    }
    
    destroy(): void {
        this.$ele.data("pf-scroll", null);
    }
}
$.fn.pfScrollExperimental = function() {
    let pfScroll = $(this).data("pf-scroll");
    if (pfScroll == null) {
        pfScroll = new PfScrollExperimental(this);
    }
    return pfScroll;
};
