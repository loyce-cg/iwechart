import {ComponentController} from "../base/ComponentController";
import * as Types from "../../Types";
import { TooltipController } from "../tooltip/main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class TaskTooltipController extends TooltipController {
    
    static textsPrefix: string = "component.taskTooltip.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    getContent: (taskId: string) => string = () => "";
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
    onViewRequestContent(taskId: string): void {
        let cnt = this.getContent(taskId);
        this.callViewMethod("setContent", taskId, cnt);
    }
    
}