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
    
    playAudio(soundName: string, _options?: app.PlayAudioOptions): void {
        const options: app.PlayAudioOptions = {
            force: false,
            ignoreSilentMode: false,
            defaultVolume: undefined,
            ..._options,
        };
        if (! this.silentMode || (this.silentMode && options.force) || options.ignoreSilentMode === true) {
            this.callViewMethod("playAudio", soundName, options);
        } 
    }
    
    setAudioEnabled(enabled: boolean): void {
        this.audioEnabled = enabled;
        if (this.viewLoaded) {
            this.callViewMethod("setAudioEnabled", this.audioEnabled);
        }
    }
    
    setDefaultVolume(volume: number): void {
        this.viewLoadedDeferred.promise.then(() => {
            this.callViewMethod("setDefaultVolume", volume);
        });
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

