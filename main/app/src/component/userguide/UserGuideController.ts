import { ComponentController } from "../base/ComponentController";
import { Inject } from "../../utils/Decorators";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { BaseAppWindowController } from "../../window/base/BaseAppWindowController";

export interface Model {
    options: UserGuideOptions;
    hasActionButton: boolean;
}

export interface UserGuideOptions {
    text?: string;
    shape?: "rectangle" | "rounded-rectangle" | "circle";
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    side: "top" | "left" | "bottom" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    // onClick: () => void;
    // actionButton?: {
    //     text: string;
    //     onClick: () => void;
    // }
    actionButtonText?: string
}


export class UserGuideController extends ComponentController {
    
    static textsPrefix: string = "component.userGuide.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    private onActionButtonClick?: () => void;
    private onClick: () => void;

    constructor(
        public parent: BaseAppWindowController,
        public options: UserGuideOptions
    ) {
        super(parent);
        this.ipcMode = true;
    }
    
    setOnClick(fn: () => void): void {
        this.onClick = fn;
    } 

    setOnActionButtonClick(fn: () => void): void {
        this.onActionButtonClick = fn;
    }

    getModel(): Model {

        return {
            options: this.options,
            hasActionButton: typeof this.onActionButtonClick == "function"
        }
    }
    
    onViewAction(action: string): void {
        if (action == "button-action") {
            if (typeof this.onActionButtonClick == "function") {
                this.onActionButtonClick();
            }
        }
        else if (action == "overlay-action") {
            if (typeof this.onClick == "function") {
                this.onClick();
            }
        }
    }
    
    close(): void {
        this.callViewMethod("close");
    }
}