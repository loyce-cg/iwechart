import { Types, component } from "pmc-web";
import { ConnectionStatsModel } from "./Types";
import { func as mainTemplate } from "./template/main.html";

export class ConnectionStatsTooltipView extends component.tooltip.TooltipView {
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
        this.tooltipName = "connection-stats";
    }
    
    setContent(sectionId: string, cnt: string) {
        if (this.currTargetId != sectionId) {
            return;
        }
        
        let data: ConnectionStatsModel = JSON.parse(cnt);
        if (!data) {
            return;
        }
        
        const $tpl = this.templateManager.createTemplate(mainTemplate).renderToJQ(data);
        this.$tooltipContent.empty();
        this.$tooltipContent.append($tpl);
        this.show();
    }

}