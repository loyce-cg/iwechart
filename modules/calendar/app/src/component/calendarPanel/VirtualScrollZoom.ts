import { JQuery as $, Q } from "pmc-web";

export interface VirtualScrollZoomElement {
    $element: JQuery;
    $viewport: JQuery;
}

export class VirtualScrollZoom {
    
    static SCROLL_PX = 50;
    static ZOOM_VIRTUAL_COUNT = 2;
    
    totalVirtualHeight: number = 24;
    virtualHeight: number = 12;
    virtualScrollTop: number = 8;
    minVirtualHeight: number = 2;
    height: number = 1000;
    elements: VirtualScrollZoomElement[] = [];
    $container: JQuery = null;
    afterZoomChanged: () => void = null;
    
    constructor(public deltaH: number = 0) {
    }
    
    init(): void {
        let $first = this.elements[0].$viewport;
        if ((<any>window).ResizeObserver) {
            let resizeObserver = new (<any>window).ResizeObserver(this.onElementResize.bind(this));
            resizeObserver.observe($first[0]);
        }
        
        this.$container.on("mousewheel", this.onMouseWheel.bind(this));
        this.repaint();
    }
    
    onElementResize(): void {
        this.height = this.elements[0].$viewport.height() + this.deltaH;
        this.repaint();
    }
    
    onMouseWheel(e: MouseWheelEvent): void {
        if (e.deltaY == 0) {
            return;
        }
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            let delta = (e.deltaY > 0 ? 1 : -1) * VirtualScrollZoom.ZOOM_VIRTUAL_COUNT;
            let h0 = this.virtualHeight;
            this.virtualHeight = Math.max(this.minVirtualHeight, Math.min(this.totalVirtualHeight, this.virtualHeight + delta));
            let dh = this.virtualHeight - h0;
            let delta2 = dh / 2;
            this.virtualScrollTop = Math.max(0, Math.min(this.calcMaxVirtualScrollTop(), this.virtualScrollTop - delta2));
            if (this.afterZoomChanged) {
                this.afterZoomChanged();
            }
        }
        else if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            let delta = (e.deltaY > 0 ? -1 : 1) * this.pxToVirtual(VirtualScrollZoom.SCROLL_PX);
            this.virtualScrollTop = Math.max(0, Math.min(this.calcMaxVirtualScrollTop(), this.virtualScrollTop + delta));
        }
        this.repaint();
    }
    
    repaint(): void {
        let scrollTop = this.calcScrollTop();
        let totalHeight = this.calcTotalHeight();
        for (let el of this.elements) {
            el.$element.css({
                marginTop: -scrollTop,
                height: totalHeight,
            });
            el.$element.addClass("virtual-scroll-zoom-element");
        }
    }
    
    virtualToPx(virtual: number): number {
        return virtual * this.height / this.virtualHeight;
    }
    
    pxToVirtual(px: number): number {
        return px / this.height * this.virtualHeight;
    }
    
    calcScaleFactor(): number {
        return this.totalVirtualHeight / this.virtualHeight;
    }
    
    calcTotalHeight(): number {
        return this.height * this.calcScaleFactor();
    }
    
    calcScrollTop(): number {
        return this.height / this.virtualHeight * this.virtualScrollTop;
    }
    
    calcMaxVirtualScrollTop(): number {
        return Math.max(0, this.totalVirtualHeight - this.virtualHeight);
    }
    
}
