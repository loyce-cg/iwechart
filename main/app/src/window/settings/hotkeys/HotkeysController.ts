import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {UserPreferences} from "../../../mail/UserPreferences";
import {Inject} from "../../../utils/Decorators";
import { ElectronApplication } from "../../../app/electron/ElectronApplication";
import path = require("path");
import fs = require("fs");
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Shortcut {
    actionName: string, accelerator: string;
}

export interface Model {
    shortcuts: Shortcut[];
}

export class HotkeysController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "hotkeys";
    
    @Inject userPreferences: UserPreferences;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
    }
    
    prepare(): void {
        if (!this.app.isElectronApp()) {
            return;
        }
        let app = <ElectronApplication>this.app;
        let shortcuts: Shortcut[] = app.keyboardShortcuts.getShortcuts("global.").map(x => ({
            actionName: x.id,
            accelerator: app.keyboardShortcuts.getUserFriendlyAccelerator(x),
        }));
        let model: Model = {
            shortcuts: shortcuts,
        };
        this.callViewMethod("renderContent", model);
    }
}
