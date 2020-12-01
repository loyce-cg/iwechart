import { ComponentController } from "../base/ComponentController";
import * as Types from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class TooltipController extends ComponentController {
    static textsPrefix: string = "component.tooltip.";

    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }

    getContent: (targetId: string) => string = null;

    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }

    onViewRequestContent(targetId: string): void {
        let cnt = this.getContent ? this.getContent(targetId) : targetId;
        this.callViewMethod("setContent", targetId, cnt);
    }
}
