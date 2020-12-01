import * as $ from "jquery";

export class WindowWidget {
    
    domElement: HTMLElement;
    titleSpan: HTMLElement;
    closer: HTMLElement;
    icon: HTMLElement;
    
    constructor() {
        let wrapper = document.createElement("div");
        let inner = document.createElement("div");
        let titleHolder = document.createElement("div");
        let titleSpan = document.createElement("span");
        let dirtyMarker = document.createElement("i");
        let closer = document.createElement("div");
        closer.classList.add("ico-x");
        wrapper.appendChild(inner);
        inner.appendChild(titleHolder);
        inner.appendChild(closer);
        dirtyMarker.classList.add("fa", "fa-circle", "dirty-marker");
        wrapper.classList.add("cell");
        titleHolder.classList.add("title");
        closer.classList.add("closer");
        titleHolder.appendChild(dirtyMarker);
        titleHolder.appendChild(titleSpan);
        this.domElement = wrapper;
        this.titleSpan = titleSpan;
        this.closer = closer;
    }
    
    setTitle(title: string): void {
        $(this.titleSpan).text(title);
    }
    
    destroy(): void {
        if (this.domElement.parentNode) {
            this.domElement.parentNode.removeChild(this.domElement);
        }
    }
    
    setActive(): void {
        $("#opened-windows-bar").find(".cell.active").removeClass("active");
        this.domElement.classList.add("active");
    }
    
    setInactive(): void {
        this.domElement.classList.remove("active");
    }
    
    setDirty(dirty: boolean): void {
        if (dirty) {
            this.domElement.classList.add("dirty");
        }
        else {
            this.domElement.classList.remove("dirty");
        }
    }
    
    setIcon(icon: string): void {
        if (icon) {
            if (!this.icon) {
                this.icon = document.createElement("i");
                let parent = this.titleSpan.parentNode;
                parent.insertBefore(this.icon, this.titleSpan);
            }
            this.icon.className = icon;
        }
        else {
            if (this.icon) {
                this.icon.remove();
            }
        }
    }
}

