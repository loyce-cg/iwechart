import {ComponentController} from "../base/ComponentController";
import * as Types from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class LoadingController extends ComponentController {
    
    static textsPrefix: string = "component.loading.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
}