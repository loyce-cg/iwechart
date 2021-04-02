import { func as mainTemplate } from "./template/template.html";
import { func as backdropTemplate } from "./template/backdrop.html";
import { TemplateManager } from "../../web-utils/template/Manager";
import * as $ from "jquery";
import { PopupPositionCalculator } from "../../web-utils";
import { PopupPlacement } from "../../web-utils/PopupPositionCalculator";

export enum OutsideClickBehavior {
    CLOSE_POPUP = "close-popup",
    FLASH_POPUP = "flash-popup",
    BLOCK_CLICK = "block-click",
    NONE = "none",
}

export interface SimplePopupButton {
    text?: string;
    icon?: string;
    cssClasses?: string;
    onClick: () => void;
}

export interface SimplePopupOptions {
    buttons: SimplePopupButton[] | false;
    $content: JQuery;
    outsideClickBehavior: OutsideClickBehavior;
    width?: number;
    height?: number;
    $target: JQuery;
    horizontalPlacement: PopupPlacement;
    verticalPlacement: PopupPlacement;
    theme?: "dark" | "light";
    adornmentOffset?: number;
}

export interface SimplePopupBackdropOptions {
}

export class SimplePopup {
    
    protected $main: JQuery;
    protected $backdrop: JQuery;
    protected options: SimplePopupOptions;
    protected closePromise: Promise<void>;
    protected resolveClosePromise: () => void;
    
    constructor(
        public templateManager: TemplateManager,
    ) {
        this.closePromise = new Promise(resolve => {
            this.resolveClosePromise = resolve;
        });
    }
    
    async init(options: SimplePopupOptions): Promise<void> {
        if (!("adornmentOffset" in options)) {
            const isHorizontal = options.verticalPlacement == PopupPlacement.AFTER || options.verticalPlacement == PopupPlacement.BEFORE;
            options.adornmentOffset = (isHorizontal ? options.$target[0].clientWidth : options.$target[0].clientHeight) / 2 - 5;
        }
        this.options = options;
        
        this.$main = this.templateManager.createTemplate(mainTemplate).renderToJQ(this.options);
        this.$backdrop = this.templateManager.createTemplate(backdropTemplate).renderToJQ({});
        
        this.$main.find(".content").append(this.options.$content);
        $(document.body).append(this.$main);
        $(document.body).append(this.$backdrop);
        
        this.$backdrop.on("click", () => { this.onBackdropClick(); });
        
        if (this.options.buttons) {
            const $buttons = this.$main.find(".buttons").find(".btn");
            for (let i = 0; i < this.options.buttons.length; ++i) {
                const onClick = this.options.buttons[i].onClick;
                $buttons.eq(i).on("click", () => {
                    onClick();
                });
            }
        }
        
        if (this.options.width) {
            this.$main.css("width", `${this.options.width}px`);
        }
        if (this.options.height) {
            this.$main.css("height", `${this.options.height}px`);
        }
        
        this.setOutsideClickBehavior(this.options.outsideClickBehavior);
    }
    
    onBackdropClick(): void {
        if (this.options.outsideClickBehavior == OutsideClickBehavior.CLOSE_POPUP) {
            this.close();
        }
        else if (this.options.outsideClickBehavior == OutsideClickBehavior.FLASH_POPUP) {
            this.flashPopup();
        }
    }
    
    setOutsideClickBehavior(outsideClickBehavior: OutsideClickBehavior): void {
        this.setHtmlElementData(this.$backdrop, "outside-click-behavior", outsideClickBehavior);
    }
    
    show() {
        this.$main.addClass("visible");
        this.updatePosition();
    }
    
    hide() {
        this.$main.removeClass("visible");
    }
    
    async flashPopup(): Promise<void> {
        this.$main.addClass("zoomed");
        await new Promise<void>(resolve => {
            setTimeout(() => {
                resolve();
            }, 150);
        });
        this.$main.removeClass("zoomed");
    }
    
    close(): void {
        this.hide();
        this.resolveClosePromise();
        this.destroy();
    }
    
    destroy() {
        this.$main.remove();
        this.$backdrop.remove();
    }
    
    getClosePromise(): Promise<void> {
        return this.closePromise;
    }
    
    setHtmlElementData($el: JQuery, dataName: string, value: string): void {
        $el.data(dataName, value);
        $el.attr(`data-${dataName}`, value);
    }
    
    updatePosition(): void {
        const position = PopupPositionCalculator.calculatePosition(this.$main, this.options.$target, this.options.horizontalPlacement, this.options.verticalPlacement);
        this.$main.css({
            left: position.left,
            top: position.top,
        });
    }
    
}