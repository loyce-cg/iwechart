import * as Types from "../../Types";
import { TooltipView } from "../tooltip/web";
import { func as mainTemplate } from "./index.html";
import { Model } from "./FileTooltipController";

export interface ViewModel {
    text: string;
}

export class FileTooltipView extends TooltipView {
    
    refreshAvatars: () => void = () => null;
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
        this.tooltipName = "file";
    }
    
    setContent(fileId: string, cnt: string) {
        if (this.currTargetId != fileId) {
            return;
        }
        
        let data: Model = JSON.parse(cnt);
        if (!data) {
            return;
        }
        let sectionName = data.isPrivateSection ? this.helper.i18n("plugin.notes2.component.filesList.filter.my") : data.sectionName;
        
        let $main = this.templateManager.createTemplate(mainTemplate).renderToJQ({
            text: sectionName + data.filePath,
        });
        this.$tooltipContent.empty().append($main);
        this.show();
        this.refreshAvatars();
    }
    
}