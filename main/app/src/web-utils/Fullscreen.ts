import {Model} from "../utils/Model";

export class ModelWithToggle extends Model<boolean> {
    toggle: () => void;
}

export class FullscreenClass {
    
    model: ModelWithToggle;
    
    constructor(interval?: number) {
        this.model = new ModelWithToggle(this.isInFullscreenMode());
        this.model.toggle = this.toggleFullscreenMode.bind(this);
        setInterval(this.onInterval.bind(this), interval || 250);
    }
    
    onInterval() {
        this.model.setWithCheck(this.isInFullscreenMode());
    }
    
    isInFullscreenMode() {
        return !!(document.fullscreenElement || (<any>document).mozFullScreenElement || document.webkitFullscreenElement);
    }
    
    toggleFullscreenMode() {
        if (this.isInFullscreenMode()) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            else if ((<any>document).msExitFullscreen) {
                (<any>document).msExitFullscreen();
            }
            else if ((<any>document).mozCancelFullScreen) {
                (<any>document).mozCancelFullScreen();
            }
            else if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            }
        }
        else {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
            else if ((<any>document).documentElement.msRequestFullscreen) {
                (<any>document).documentElement.msRequestFullscreen();
            }
            else if ((<any>document).documentElement.mozRequestFullScreen) {
                (<any>document).documentElement.mozRequestFullScreen();
            }
            else if (document.documentElement.webkitRequestFullscreen) {
                (<any>document).documentElement.webkitRequestFullscreen((<any>Element).ALLOW_KEYBOARD_INPUT);
            }
        }
    }
    
    getFullscreenModel(): ModelWithToggle {
        return this.model;
    }
}

export let Fullscreen = new FullscreenClass();
