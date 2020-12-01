import * as $ from "jquery";

export class WindowHeader {
    
    domElement: HTMLElement;
    buttons: {
        maximize: HTMLElement;
        minimize: HTMLElement;
        close: HTMLElement;
    };
    titleSpan: HTMLElement;
    icon: HTMLElement;
    
    constructor() {
        let wrapper = document.createElement("div");
        let maxBtn = document.createElement("a");
        let minBtn = document.createElement("a");
        let closeBtn = document.createElement("a");
        let titleHolder = document.createElement("div");
        let titleSpan = document.createElement("span");
        let dirtyMarker = document.createElement("i");
        let buttonsWrapper = document.createElement("div");
        wrapper.classList.add("window-header");
        buttonsWrapper.classList.add("window-header-buttons");
        maxBtn.classList.add("window-header-button", "window-header-button-maximize", 'ico-maximize');
        minBtn.classList.add("window-header-button", "window-header-button-minimize", 'ico-minimize');
        closeBtn.classList.add("window-header-button", "window-header-button-close", 'ico-x');
        titleHolder.classList.add("window-header-title");
        dirtyMarker.classList.add("fa", "fa-circle", "window-dirty-marker");
        wrapper.appendChild(titleHolder);
        wrapper.appendChild(buttonsWrapper);
        buttonsWrapper.appendChild(closeBtn);
        buttonsWrapper.appendChild(maxBtn);
        buttonsWrapper.appendChild(minBtn);
        titleHolder.appendChild(dirtyMarker);
        titleHolder.appendChild(titleSpan);
        this.domElement = wrapper;
        this.buttons = {
            maximize: maxBtn,
            minimize: minBtn,
            close: closeBtn
        };
        this.titleSpan = titleSpan;
    }
    
    setTitle(title: string): void {
        $(this.titleSpan).text(title);
    }
    
    hideMaximizeButton(): void {
        this.buttons.maximize.style.display = "none";
    }
    
    hideMinimizeButton(): void {
        this.buttons.minimize.style.display = "none";
    }

    hideCloseButton(): void {
        this.buttons.close.style.display = "none";
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

