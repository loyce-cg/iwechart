import * as Types from "../../Types";
import { BasicViewHelper } from "../../web-utils/BasicViewHelper";
import { SectionModel } from "./SectionTooltipController";
import { TooltipView } from "../tooltip/web";
import { func as mainTemplate } from "./template/main.html";

export class SectionTooltipView extends TooltipView {
    
    refreshAvatars: () => void = () => null;
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
        this.tooltipName = "section";
    }
    
    setContent(sectionId: string, cnt: string) {
        if (this.currTargetId != sectionId) {
            return;
        }
        
        let data: SectionModel = JSON.parse(cnt);
        if (!data) {
            return;
        }
        
        let $tpl = this.templateManager.createTemplate(mainTemplate).renderToJQ(data);
        this.$tooltipContent.content($tpl);
        this.ellipsis(this.$tooltipContent.find(".section-tooltip-section-description"));
        this.show();
        this.refreshAvatars();
    }

}