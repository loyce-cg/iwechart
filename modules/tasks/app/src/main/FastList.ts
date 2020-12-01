import { FastListRenderScheduler } from "./FastListRenderScheduler";

export class FastListEntry<T> {
    data: T;
    height: number;
    startsAt: number;
}

export class FastList<T> {
    
    container: HTMLElement = null;
    paddingContainer: HTMLElement = null;
    entriesContainer: HTMLElement = null;
    
    entries: FastListEntry<T>[] = [];
    fixedEntryHeight: number = 0;
    totalHeight: number = 0;
    
    visibleRange: [number, number] = [-1, -1];
    nVisible: number = 0;
    
    fillElement: (element: HTMLElement, entry: FastListEntry<T>, entryId?: number) => void = null;
    createEmptyElement: () => HTMLElement = null;
    beforeRender: (range: [number, number]) => void = null;
    afterRender: (range: [number, number], causedByContainerEvent: boolean) => void = null;
    beforeDelElement: (el: HTMLElement) => void = null;
    afterContainerResize: (width: number, height: number) => void = null;
    
    prevContainerInfo: [number, number] = null;
    
    debug: (msg: string) => void = () => {};
    
    renderScheduler: FastListRenderScheduler;
    
    constructor(container: HTMLElement, paddingContainer: HTMLElement, entriesContainer: HTMLElement) {
        this.container = container;
        this.paddingContainer = paddingContainer
        this.entriesContainer = entriesContainer;
        this.renderScheduler = new FastListRenderScheduler(this);
    }
    
    init(render: boolean = true) {
        if (render) {
            this.debug("FastList.render() from FastList.init()");
            this.render();
        }
        this.container.addEventListener("scroll", this.onContainerScroll.bind(this));
    }
    
    onContainerScroll() {
        this.debug("FastList.render() from FastList.onContainerScroll()");
        this.render(true);
    }
    
    onWindowResize() {
        this.debug("FastList.render() from FastList.onWindowResize()");
        this.render(true);
    }
    
    render(causedByContainerEvent: boolean = false): void {
        this.renderScheduler.scheduleRender(1, causedByContainerEvent);
    }
    
    _render(attemptId: number, causedByContainerEvent: boolean): void {
        this.debug("starting FastList.render(); attemptId=" + attemptId);
        let range = this.calcVisibleRange();
        if (range == null) {
            // Failure: reschedule
            this.renderScheduler.scheduleRender(attemptId + 1, causedByContainerEvent);
            return;
        }
        let nVisible = range[1] - range[0] + 1;
        if (range[1] == -1 && range[0] == -1) {
            nVisible = 0;
        }
        let nToAdd = nVisible - this.nVisible;
        if (nToAdd > 0) {
            this.addElements(nToAdd);
        }
        else if (nToAdd < 0) {
            this.delElements(-nToAdd);
        }
        
        if (this.beforeRender) {
            this.beforeRender(range);
        }
        
        this.debug("FastList.render() nVisible=" + nVisible);
        this.debug("FastList.render() nToAdd=" + nToAdd);
        this.debug("FastList.render() visibleRange=" + JSON.stringify(range));
        
        for (let i = 0, l = nVisible; i < l; ++i) {
            let el = <HTMLElement>this.entriesContainer.childNodes[i];
            this.fillElement(el, this.entries[range[0] + i], range[0] + i);
            el.setAttribute("data-entry-id", "" + (range[0] + i));
        }
        
        this.visibleRange = range;
        this.nVisible = nVisible;
        
        let upperMargin = this.calcUpperMargin();
        let lowerMargin = this.calcLowerMargin();
        this.paddingContainer.style.marginTop = upperMargin + "px";
        this.paddingContainer.style.marginBottom = lowerMargin + "px";
        this.debug("FastList.render() upperMargin=" + upperMargin);
        this.debug("FastList.render() lowerMargin=" + lowerMargin);
        
        if (this.afterRender) {
            this.afterRender(range, causedByContainerEvent);
        }
    }
    
    addElements(n: number) {
        for (let i = 0; i < n; ++i) {
            let el = this.createEmptyElement();
            (<any>this.entriesContainer).append(el);
        }
    }
    
    delElements(n: number) {
        let idx = this.entriesContainer.childNodes.length - 1;
        for (let i = 0; i < n; ++i) {
            let el = this.entriesContainer.childNodes[idx - i];
            if (this.beforeDelElement) {
                this.beforeDelElement(<HTMLElement>el);
            }
            el.remove();
        }
    }
    
    setEmptyElementCreator(func: () => HTMLElement) {
        this.createEmptyElement = func;
    }
    
    setElementFiller(func: (element: HTMLElement, entry: FastListEntry<T>, entryId?: number) => void) {
        this.fillElement = func;
    }
    
    setBeforeRender(func: (range: [number, number]) => void): void {
        this.beforeRender = func;
    }
    
    setAfterRender(func: (range: [number, number], causedByContainerEvent: boolean) => void): void {
        this.afterRender = func;
    }
    
    setBeforeDelElement(func: (el: HTMLElement) => void): void {
        this.beforeDelElement = func;
    }
    
    setAfterContainerResize(func: (width: number, height: number) => void, excludeInitialEvent: boolean = false, anotherElement: HTMLElement = null): void {
        this.afterContainerResize = func;
        let isAfterFirstEvent: boolean = false;
        if (this.afterContainerResize) {
            if ((<any>window).ResizeObserver) {
                let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                    let entry = entries[0];
                    if (entry && this.afterContainerResize) {
                        if (excludeInitialEvent && !isAfterFirstEvent) {
                            isAfterFirstEvent = true;
                            return;
                        }
                        isAfterFirstEvent = true;
                        this.afterContainerResize(entry.contentRect.width, entry.contentRect.height);
                    }
                });
                resizeObserver.observe(anotherElement ? anotherElement : this.container);
            }
        }
    }
    
    setEntries(entries: FastListEntry<T>[]): void {
        this.entries = entries;
        this.calcEntryStartPoints();
    }
    
    calcEntryStartPoints(): void {
        if (this.entries.length == 0) {
            return;
        }
        this.totalHeight = this.entries[0].height;
        this.entries[0].startsAt = 0;
        let prevEntry = this.entries[0];
        let h0 = prevEntry.height;
        let fixedHeight = true;
        for (let i = 1, l = this.entries.length; i < l; ++i) {
            let entry = this.entries[i];
            entry.startsAt = prevEntry.startsAt + prevEntry.height;
            prevEntry = entry;
            if (entry.height != h0) {
                fixedHeight = false;
            }
            this.totalHeight += entry.height;
        }
        this.fixedEntryHeight = fixedHeight ? h0 : 0;
    }
    
    calcVisibleRange(): [number, number] {
        this.debug("starting FastList.calcVisibleRange()");
        let scrollTop = this.container.scrollTop;
        let height = this.container.clientHeight;
        if (height == 0) {
            return null;
        }
        this.debug("FastList.calcVisibleRange() scrollTop=" + scrollTop);
        this.debug("FastList.calcVisibleRange() height=" + height);
        this.debug("FastList.calcVisibleRange() prevContainerInfo=" + JSON.stringify(this.prevContainerInfo));
        if (scrollTop == 0 && height == 0 && this.prevContainerInfo != null) {
            scrollTop = this.prevContainerInfo[0];
            height = this.prevContainerInfo[1];
        }
        this.prevContainerInfo = [scrollTop, height];
        let first = 0;
        let last = 0;
        if (this.fixedEntryHeight) {
            first = Math.floor(scrollTop / this.fixedEntryHeight);
            last = first + Math.ceil(height / this.fixedEntryHeight);
        }
        else {
            first = this.getEntryIdStartingAtOrBeforePoint(scrollTop);
            last = this.getEntryIdEndingAtOrAfterPoint(scrollTop + height);
        }
        let nEntries = this.entries.length;
        first = Math.min(first, nEntries - 1);
        last = Math.min(last, nEntries - 1);
        this.debug("FastList.calcVisibleRange() nEntries=" + nEntries);
        this.debug("FastList.calcVisibleRange() first=" + first);
        this.debug("FastList.calcVisibleRange() last=" + last);
        return [first, last];
    }
    
    calcUpperMargin(): number {
        let entry = this.entries[this.visibleRange[0]];
        return entry ? entry.startsAt : 0;
    }
    
    calcLowerMargin(): number {
        let last = this.entries[this.entries.length - 1];
        let entry = this.entries[this.visibleRange[1]];
        return (last ? last.startsAt + last.height : 0) - (entry ? entry.startsAt + entry.height : 0);
    }
    
    getEntryIdStartingAtOrBeforePoint(pt: number): number {
        return this.binFindPt(pt);
    }
    
    getEntryIdEndingAtOrAfterPoint(pt: number): number {
        let id = this.binFindPt(pt);
        if (id < 0) {
            return -1;
        }
        let entry = this.entries[id];
        if (entry.startsAt == pt) {
            --id;
        }
        return id;
    }
    
    binFindPt(pt: number): number {
        let start = 0;
        let end = this.entries.length - 1;
        while (start + 1 < end) {
            let mid = Math.floor((start + end) / 2);
            let entry = this.entries[mid];
            if (entry.startsAt == pt) {
                return mid;
            }
            else if (entry.startsAt < pt) {
                if (entry.startsAt + entry.height > pt) {
                    return mid;
                }
                start = mid;
            }
            else { // entry.startsAt > pt
                end = mid;
            }
        }
        for (let i = start; i <= end; ++i) {
            let entry = this.entries[i];
            if (entry.startsAt <= pt && entry.startsAt + entry.height > pt) {
                return i;
            }
        }
        return this.entries.length - 1;
    }
    
    scrollTo(entryId: number): void {
        let scrollTop = this.container.scrollTop;
        let height = this.container.clientHeight;
        let entry = this.entries[entryId];
        let startsAt = entry.startsAt;
        let endsAt = entry.startsAt + entry.height;
        if (startsAt - 50 < scrollTop) {
            this.container.scrollTo(0, startsAt - 50);
        }
        else if (endsAt + 50 > scrollTop + height) {
            this.container.scrollTo(0, endsAt + 50 - height);
        }
    }
    
    center(entryId: number = null, delta: number = null): boolean {
        let availableHeight = this.container.clientHeight;
        let totalHeight = this.totalHeight;
        if (availableHeight == 0 || totalHeight <= availableHeight) {
            return false;
        }
        if (!delta) {
            delta = 0;
        }
        if (entryId === null) {
            this.container.scrollTo(0, (totalHeight - availableHeight) / 2 + delta);
        }
        else {
            let entry = this.entries[entryId];
            let startsAt = entry.startsAt;
            let center = startsAt + entry.height / 2;
            this.container.scrollTo(0, center - availableHeight / 2 + delta);
        }
        return true;
    }
    
    getScrollTop(): number {
        if (this.prevContainerInfo) {
            return this.prevContainerInfo[0];
        }
        return this.container.scrollTop;
    }
    
    getClientHeight(): number {
        if (this.prevContainerInfo) {
            return this.prevContainerInfo[1];
        }
        return this.container.clientHeight;
    }
    
}