import { ComponentController } from "../base/ComponentController";
import { Inject } from "../../utils/Decorators";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { BaseAppWindowController } from "../../window/base/BaseAppWindowController";

export interface Model {
    options: UserGuideOptions,
}

export interface UserGuideOptions {
    text?: string;
    shape?: "rectangle" | "rounded-rectangle" | "circle";
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    side: "top" | "left" | "bottom" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    onClick: () => void;
    actionButton?: {
        text: string;
        onClick: () => void;
    }
}


export class UserGuideController extends ComponentController {
    
    static textsPrefix: string = "component.userGuide.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(
        public parent: BaseAppWindowController,
        public options: UserGuideOptions
    ) {
        super(parent);
        this.ipcMode = true;
    }
    
    getModel(): Model {

        return {
            options: this.options
        }
    }
    
    onViewAction(action: string): void {
        if (action == "button-action") {
            if (this.options.actionButton) {
                this.options.actionButton.onClick();
            }
        }
        else if (action == "overlay-action") {
            this.options.onClick();
        }
    }
    
    close(): void {
        this.callViewMethod("close");
    }
}