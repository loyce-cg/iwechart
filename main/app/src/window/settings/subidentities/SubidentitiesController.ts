import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import * as privfs from "privfs-client";
import {Inject} from "../../../utils/Decorators"
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    host: string;
}

export class SubidentitiesController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "subidentities";
    
    @Inject identity: privfs.identity.Identity;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.identity = this.parent.identity;
    }
    
    prepare(): void{
        let model: Model = {
            host: this.identity.host
        };
        this.callViewMethod("renderContent", model);
    }
}
