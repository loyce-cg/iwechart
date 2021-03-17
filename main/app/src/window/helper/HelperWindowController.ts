import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { SoundsCategoryName } from "../../sounds/SoundsLibrary";
import Q = require("q");

export class HelperWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.helper.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    enableScreenCover: boolean = false;
    audioEnabled: boolean;
    viewLoaded: boolean = false;
    viewLoadedDeferred: Q.Deferred<void> = Q.defer();
    
    silentMode: boolean = false;

    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname, null, null, "basic");
        this.ipcMode = true;
        this.openWindowOptions.hidden = true;
        this.skipLoadingFonts();
    }

    setSilentMode(value: boolean): void {
        this.silentMode = value;
    }
    
    playAudio(soundName: string, force: boolean = false, _ignoreSilentMode: boolean = undefined): void {
        if (! this.silentMode || (this.silentMode && force) || _ignoreSilentMode === true) {
            this.callViewMethod("playAudio", soundName, force);
        } 
    }
    
    setAudioEnabled(enabled: boolean): void {
        this.audioEnabled = enabled;
        if (this.viewLoaded) {
            this.callViewMethod("setAudioEnabled", this.audioEnabled);
        }
    }
    
    onViewLoad(): void {
        this.viewLoaded = true;
        this.callViewMethod("setAudioEnabled", this.audioEnabled);
        this.viewLoadedDeferred.resolve();
    }
    
    setSound(categoryName: SoundsCategoryName, fileName: string): void {
        this.viewLoadedDeferred.promise.then(() => {
            this.callViewMethod("setSound", categoryName, fileName);
        });
    }
    
}

