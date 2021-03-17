import { BaseController } from "../BaseController";
import { SettingsWindowController } from "../SettingsWindowController";
import * as Q from "q";
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";
import { DeviceSelectorWindowController } from "../../deviceselector/main";
import { DockedWindow } from "../../../app/common/window";
import { SoundsLibrary } from "../../../sounds/SoundsLibrary";

export interface Model {
}

export class DevicesController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "devices";
    
    deviceSelector: DeviceSelectorWindowController = null;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
    }
    
    prepare(): Q.Promise<void> {
        let soundsLibrary = new SoundsLibrary();
        return Q().then(() => {
            let model = {};
            this.callViewMethod("renderContent", model);
        })
        .then(() => {
            this.app.ioc.create(DeviceSelectorWindowController, [this.parent, {
                audioInput: true,
                audioOutput: true,
                videoInput: true,
                docked: true,
                withDisabledOption: false,
                withPreviews: true,
                audioOutputPreviewFilePath: SoundsLibrary.SOUNDS_ASSET_PATH + soundsLibrary.getDefaultSoundName("audioOutputTest"),
            }])
            .then(win => {
                this.deviceSelector = win;
                win.openDocked(this.parent.nwin, win.id);
                let docked = <DockedWindow>win.nwin;
                this.callViewMethod("registerDockedSelectorWindow", docked.id, docked.load);
            });
        });
    }
    
    onViewRemoveDeviceSelector(): void {
        if (this.deviceSelector) {
            this.deviceSelector.close();
            this.deviceSelector = null;
        }
    }
    
}
