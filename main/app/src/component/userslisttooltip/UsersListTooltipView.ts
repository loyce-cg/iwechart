import * as Types from "../../Types";
import { BasicViewHelper } from "../../web-utils/BasicViewHelper";
import { UsersListModel } from "./UsersListTooltipController";
import { TooltipView } from "../tooltip/web";
import { func as mainTemplate } from "./template/main.html";
import * as $ from "jquery";

export class UsersListTooltipView extends TooltipView {
    
    refreshAvatars: () => void = () => null;
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
        this.tooltipName = "userslist";
    }
    
    setContent(sectionId: string, cnt: string) {
        if (this.currTargetId != sectionId) {
            return;
        }
        
        let data: UsersListModel = JSON.parse(cnt);
        if (!data) {
            return;
        }
        
        let $tpl = this.templateManager.createTemplate(mainTemplate).renderToJQ(data);
        this.$tooltipContent.content($tpl);
        // this.ellipsis(this.$tooltipContent.find(".section-tooltip-section-description"));
        this.show();
        this.refreshAvatars();
    }
    
}