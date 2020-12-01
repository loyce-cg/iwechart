import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import {Inject} from "../../utils/Decorators"
import {UserPreferences} from "../../mail/UserPreferences";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Options {
    name: string;
    mimeType: string;
}

export interface Model {
    name: string;
    showWarning?: boolean;
}

export enum Result {
    CANCEL,
    OK,
}

export class OpenExternalWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.openExternal.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject userPreferences: UserPreferences;
    options: Options;
    onModalClose: (result: Result) => void;
    dontShowWarning: boolean;
    
    constructor(parent: app.WindowParent, options: Options) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.options = options
        this.openWindowOptions = {
            modal: true,
            alwaysOnTop: true,
            showInactive: false,
            toolbar: false,
            maximized: false,
            maximizable: false,
            minimizable: false,
            show: false,
            position: "center-always",
            minWidth: 350,
            minHeight: 215,
            width: 400,
            height: 220,
            resizable: false,
            title: this.options.name,
            icon: this.app.shellRegistry.resolveIcon(this.options.mimeType)
        };
    }
    
    getModel(): Model {
        return {
            name: this.options.name
        };
    }
    
    onViewOpen(): void {
        this.dontShowWarning = this.userPreferences.getValue("ui.showOpenExternalWarning", false);
    }
    
    onViewClose(): void {
        this.onModalClose(Result.CANCEL);
        this.close();
    }
    
    showModal(onModalClose: (result: Result) => void) {
        this.onModalClose = onModalClose;
        this.open();
        this.nwin.focus();
    }
    
    onViewDontShowAgain(): void {
    }
    
    onViewOk() {
        this.onModalClose(Result.OK);
        this.close();
    }
    
    onViewCheckboxChange(): void {
        this.dontShowWarning = !this.dontShowWarning;
        this.userPreferences.set("ui.showOpenExternalWarning", this.dontShowWarning, true);
    }
}
