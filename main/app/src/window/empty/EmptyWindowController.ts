import {BaseAppWindowController} from "../base/BaseAppWindowController";
import {ContainerWindowController} from "../container/ContainerWindowController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class EmptyWindowController extends BaseAppWindowController {
    
    static textsPrefix: string = "window.empty.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parent: ContainerWindowController) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.fullscreen = true;
        this.openWindowOptions.cssClass = "app-window";
        this.openWindowOptions.title = this.i18n("window.empty.title");
    }
    
    init(): Q.Promise<void> {
        return this.app.mailClientApi.loadUserPreferences();
    }
}
