/**
* DragDrop - komponent dla widoku implementujący przeciąganie i upload plików
* Użycie w modułach:
*   new component.dragdrop.DragDrop(<parentView>, <jQuery container element>)
*
* Ważne:
* Komponent emituje event {"dragDrop", app.FileHandle} do nadrzędnego kontrolera przy uploadzie pliku.
*
* Do poprawnego działania musimy też zaimportować style komponentu np:
* @import "../../../../node_modules/pmc-web/src/component/dragdrop/index.less"
*/

import { BaseAppWindowView } from "../../window/base/BaseAppWindowView";
import { WebUtils } from "../../web-utils/WebUtils";
import * as $ from "jquery";

export class DragDrop {
    draggingStarted: boolean = false;
    draggingState:boolean = false;
    $dropOverlay: JQuery<HTMLElement>;
    constructor(public view: BaseAppWindowView<any>, public $dropZoneElement: JQuery) {
        this.init();
    }

    init(): void {
        this.$dropOverlay = $("<div class='drop-overlay'></div>");
        this.$dropZoneElement.append(this.$dropOverlay);
        this.$dropZoneElement.on("dragenter", this.onFileDragEnter.bind(this));
        this.$dropZoneElement.find(".drop-overlay").on("dragover", this.onFileDragged.bind(this));
        this.$dropZoneElement.find(".drop-overlay").on("dragleave", this.onFileDragCancelled.bind(this));
        this.$dropZoneElement.find(".drop-overlay").on("drop", this.onFileDropped.bind(this));
    }
    
    onFileDragEnter(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        if (!this.draggingState) {
            this.draggingStarted = true;
            this.switchDragZone();
        }
    }

    
    onFileDragged(event:Event): void {
        event.preventDefault();
        event.stopPropagation();
    }
    
    onFileDragCancelled(event:Event): void {
        event.preventDefault();
        event.stopPropagation();
        if (this.draggingState) {
            this.draggingStarted = false;
            this.switchDragZone();
        }
    }
    
    checkForFiles(event: JQuery.Event) {
        let ev: DragEvent = <DragEvent>event.originalEvent;
        if (ev.dataTransfer.items) {
            for (let i = 0; i < ev.dataTransfer.items.length; i++) {
                if (ev.dataTransfer.items[i].kind === 'file') {
                    return true;
                }
            }
        }
        else {
            if (ev.dataTransfer.files.length > 0) {
                return true;
            }
        }
        return false;
    }

    onFileDropped(event:JQuery.Event): void {
        if (!this.checkForFiles(event)) {
            this.resetDragZone();
            return;
        }
        
        let ev:DragEvent = <DragEvent>event.originalEvent;
        event.preventDefault();
        event.stopPropagation();
        if (this.draggingState) {
            this.draggingStarted = false;
            this.switchDragZone();
            
            // process drop
            let draggedFiles: any[] = [];
            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to access the file(s)
                for (let i = 0; i < ev.dataTransfer.items.length; i++) {
                    // If dropped items aren't files, reject them
                    if (ev.dataTransfer.items[i].kind === 'file') {
                        let file = ev.dataTransfer.items[i].getAsFile();
                        draggedFiles.push(WebUtils.createFileHandle(file));
                    }
                }
            }
            else {
                // Use DataTransfer interface to access the file(s)
                for (let i = 0; i < ev.dataTransfer.files.length; i++) {
                    let file = ev.dataTransfer.files[i];
                    draggedFiles.push(WebUtils.createFileHandle(file));
                }
            }
            if (draggedFiles.length > 0) {
                this.view.triggerEvent("dragDrop", draggedFiles);
            }
        }
    }
    
    switchDragZone(): void {
        if (this.draggingStarted && this.draggingState === false) {
            this.draggingState = true;
            this.$dropZoneElement.children(".drop-overlay").addClass("file-drag");
        }
        else
        if (this.draggingStarted == false && this.draggingState){
            this.draggingState = false;
            this.$dropZoneElement.children(".drop-overlay").removeClass("file-drag");
        }
    }
    resetDragZone(): void {
        this.draggingStarted = false;
        this.draggingState = false;
        this.$dropZoneElement.children(".drop-overlay").removeClass("file-drag");
    }
}