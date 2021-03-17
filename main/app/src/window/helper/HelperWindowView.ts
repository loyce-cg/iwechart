import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {AudioPlayer} from "../../web-utils/AudioPlayer";
import * as $ from "jquery";
import {app} from "../../Types";
import { SoundsCategoryName } from "../../sounds/SoundsLibrary";

@WindowView
export class HelperWindowView extends BaseWindowView<void> {
    
    audioPlayer: AudioPlayer;
    
    constructor(parent: app.ViewParent) {
        super(parent, () => "<div></div>");
        (<any>window).view = this;
        this.audioPlayer = new AudioPlayer();
        this.audioPlayer.add("notification", this.helper.getAsset("sounds/new-messages.wav"));
        this.audioPlayer.add("message-sent", this.helper.getAsset("sounds/message-sent.wav"));
        this.audioPlayer.add("message-deleted", this.helper.getAsset("sounds/message-deleted.wav"));
        this.audioPlayer.add("screenshot", this.helper.getAsset("sounds/screenshot.mp3"));
        this.audioPlayer.add("gong", this.helper.getAsset("sounds/new-messages.wav"));
    }
    
    setSound(categoryName: SoundsCategoryName, fileName: string): void {
        this.audioPlayer.add(categoryName, this.helper.getAsset(`sounds/${fileName}`));
    }
    
    playAudio(soundName: string, force: boolean = false): void {
        if (!this.audioPlayer.has(soundName) && soundName.indexOf(".") >= 0) {
            this.audioPlayer.add(soundName, this.helper.getAsset(`sounds/${soundName}`));
        }
        this.audioPlayer.play(soundName, force);
    }
    
    setAudioEnabled(enabled: boolean): void {
        if (enabled) {
            this.audioPlayer.enable();
        }
        else {
            this.audioPlayer.disable();
        }
    }
}
