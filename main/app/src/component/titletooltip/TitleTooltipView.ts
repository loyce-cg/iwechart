import * as Types from "../../Types";
import { TooltipView } from "../tooltip/web";
import { func as mainTemplate } from "./index.html";
import { Model } from "./TitleTooltipController";

export interface ViewModel {
    text: string;
}

export class TitleTooltipView extends TooltipView {
    
    static readonly TOOLTIP_DELAY: number = 350;
    
    refreshAvatars: () => void = () => null;
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
        this.tooltipName = "title";
    }
    
    setContent(titleId: string, title: string) {
        if (this.currTargetId != titleId) {
            return;
        }
        
        setTimeout(() => {
           this.setContentCore(titleId, title); 
        }, TitleTooltipView.TOOLTIP_DELAY);
    }
    
    setContentCore(titleId: string, title: string): void {
        if (this.currTargetId != titleId) {
            return;
        }
        
        let $main = this.templateManager.createTemplate(mainTemplate).renderToJQ({
            text: title,
        });
        this.$tooltipContent.empty().append($main);
        this.show();
        this.refreshAvatars();
    }
    
}