import { JQuery as $, Q } from "pmc-web";

export type DragDropCallback = ($draggable: JQuery, e?: DragEvent) => void;
export type DragDropZoneCallback = ($draggable: JQuery, $dropZone: JQuery) => void;
export type MouseMoveCallback = (data: MouseMoveData) => void;

export interface DropZoneData {
    dropZone: HTMLElement;
    hitCount: number;
}

export interface MouseMoveData {
    prevX: number;
    prevY: number;
    currX: number;
    currY: number;
}

export class DragDrop {
    
    public mouseX: number = null;
    public mouseY: number = null;
    public containerOffsetLeft: number = 0;
    public containerOffsetTop: number = 0;
    public containerWidth: number = 0;
    public containerHeight: number = 0;
    public bringToTop: boolean = false;
    protected dragStartHandler: DragDropCallback = null;
    protected dragCancelHandler: DragDropCallback = null;
    protected dragDropHandler: DragDropZoneCallback = null;
    protected dragEnterZoneHandler: DragDropZoneCallback = null;
    protected dragLeaveZoneHandler: DragDropZoneCallback = null;
    protected mouseMoveHandler: MouseMoveCallback = null;
    protected $currDraggable: JQuery = null;
    protected $currDropZone: JQuery = null;
    protected currDropZonesData: DropZoneData[] = [];
    
    constructor(public $container: JQuery, draggableSelector: string, dropZoneSelector: string) {
        this.$container.on("dragstart", draggableSelector, this.onDragStart.bind(this));
        $(document).on("dragend", this.onDragEnd.bind(this));
        this.$container.on("dragover", dropZoneSelector, this.onDragOver.bind(this));
        this.$container.on("dragenter", dropZoneSelector, this.onDragEnter.bind(this));
        this.$container.on("dragleave", dropZoneSelector, this.onDragLeave.bind(this));
        this.$container.on("drop", dropZoneSelector, this.onDrop.bind(this));
    }
    
    setOnDragStart(fn: DragDropCallback): void {
        this.dragStartHandler = fn;
    }
    
    setOnDragCancel(fn: DragDropCallback): void {
        this.dragCancelHandler = fn;
    }
    
    setOnDragDrop(fn: DragDropZoneCallback): void {
        this.dragDropHandler = fn;
    }
    
    setOnDragEnterZone(fn: DragDropZoneCallback): void {
        this.dragEnterZoneHandler = fn;
    }
    
    setOnDragLeaveZone(fn: DragDropZoneCallback): void {
        this.dragLeaveZoneHandler = fn;
    }
    
    setOnMouseMove(fn: MouseMoveCallback): void {
        this.mouseMoveHandler = fn;
    }
    
    protected onDragStart(e: DragEvent): void {
        let containerOffset = this.$container.offset();
        this.containerOffsetLeft = containerOffset.left;
        this.containerOffsetTop = containerOffset.top;
        this.containerWidth = this.$container.width();
        this.containerHeight = this.$container.height();
        this.mouseX = null;
        this.mouseY = null;
        
        e.stopPropagation();
        this.updateMousePos(e);
        this.currDropZonesData = [];
        this.$currDraggable = $(<HTMLElement>e.currentTarget);
        this.$currDropZone = null;
        (<any>e).dataTransfer = (<any>e).originalEvent.dataTransfer;
        this.triggerDragStart(this.$currDraggable, e);
        
        if (this.bringToTop) {
            this.$currDraggable.css({
                position: "absolute",
                width: this.$currDraggable.width(),
                height: this.$currDraggable.height(),
                zIndex: 99999999,
            });
            Q().then(() => {
                this.$currDraggable.css({
                    position: "relative",
                    width: "auto",
                    height: "auto",
                    zIndex: "auto",
                });
            });
        }
    }
    
    protected onDragEnd(e: DragEvent): void {
        if (!this.$currDraggable) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.updateMousePos(e);
        this.triggerDragCancel(this.$currDraggable);
        this.$currDraggable = null;
    }
    
    protected onDragOver(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.updateMousePos(e);
    }
    
    protected onDragEnter(e: DragEvent): void {
        if (!this.$currDraggable) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.updateMousePos(e);
        this.$currDropZone = $(<HTMLElement>e.currentTarget);
        
        let dropZoneData = this.getDropZoneData(<HTMLElement>e.currentTarget);
        if (dropZoneData.hitCount <= 0) {
            this.triggerDragEnterZone(this.$currDraggable, this.$currDropZone);
        }
        dropZoneData.hitCount++;
        this.setDropZoneData(dropZoneData);
    }
    
    protected onDragLeave(e: DragEvent): void {
        if (!this.$currDraggable) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.updateMousePos(e);
        
        let dropZoneData = this.getDropZoneData(<HTMLElement>e.currentTarget);
        if (dropZoneData.hitCount <= 0) {
            return;
        }
        if (dropZoneData.hitCount == 1) {
            this.triggerDragLeaveZone(this.$currDraggable, $(<HTMLElement>e.currentTarget));
        }
        dropZoneData.hitCount--;
        this.setDropZoneData(dropZoneData);
    }
    
    protected onDrop(e: DragEvent): void {
        if (!this.$currDraggable) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.updateMousePos(e);
        this.$currDropZone = $(<HTMLElement>e.currentTarget);
        this.triggerDragDrop(this.$currDraggable, this.$currDropZone);
        this.$currDraggable = null;
        this.$currDropZone = null;
    }
    
    protected triggerDragStart($draggable: JQuery, e: DragEvent): void {
        if (this.dragStartHandler) {
            this.dragStartHandler($draggable, e);
        }
    }
    
    protected triggerDragCancel($draggable: JQuery): void {
        if (this.dragCancelHandler) {
            this.dragCancelHandler($draggable);
        }
    }
    
    protected triggerDragDrop($draggable: JQuery, $dropZone: JQuery): void {
        if (this.dragDropHandler) {
            this.dragDropHandler($draggable, $dropZone);
        }
    }
    
    protected triggerDragEnterZone($draggable: JQuery, $dropZone: JQuery): void {
        if (this.dragEnterZoneHandler) {
            this.dragEnterZoneHandler($draggable, $dropZone);
        }
    }
    
    protected triggerDragLeaveZone($draggable: JQuery, $dropZone: JQuery): void {
        if (this.dragLeaveZoneHandler) {
            this.dragLeaveZoneHandler($draggable, $dropZone);
        }
    }
    
    protected triggerMouseMove(data: MouseMoveData): void {
        if (this.mouseMoveHandler) {
            this.mouseMoveHandler(data);
        }
    }
    
    protected getDropZoneData(dropZone: HTMLElement): DropZoneData {
        for (let dropZoneData of this.currDropZonesData) {
            if (dropZoneData.dropZone == dropZone) {
                return dropZoneData;
            }
        }
        let dropZoneData: DropZoneData = {
            dropZone: dropZone,
            hitCount: 0,
        };
        return dropZoneData;
    }
    
    protected setDropZoneData(newDropZoneData: DropZoneData): void {
        for (let idx in this.currDropZonesData) {
            let dropZoneData = this.currDropZonesData[idx];
            if (dropZoneData.dropZone == newDropZoneData.dropZone) {
                if (newDropZoneData.hitCount <= 0) {
                    this.currDropZonesData.splice(Number(idx), 1);
                }
                else {
                    dropZoneData.hitCount = newDropZoneData.hitCount;
                }
                return;
            }
        }
        this.currDropZonesData.push(newDropZoneData);
    }
    
    protected updateMousePos(e: { pageX: number, pageY: number }): void {
        let prevX = this.mouseX;
        let prevY = this.mouseY;
        this.mouseX = e.pageX - this.containerOffsetLeft;
        this.mouseY = e.pageY - this.containerOffsetTop;
        if (prevX !== null && prevY !== null) {
            this.triggerMouseMove({
                prevX: prevX,
                prevY: prevY,
                currX: this.mouseX,
                currY: this.mouseY,
            });
        }
    }
    
}
