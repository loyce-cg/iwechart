import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.webutils.ScreenCover");

export interface Options {
    $cover: JQuery;
    $toCover: JQuery;
    timeout: number;
    timeoutCheck: number;
}

export class ScreenCover {
    
    options: Options;
    onEventBinded: () => void;
    onTimeoutBinded: () => void;
    lastEventDate: Date;
    timeoutId: NodeJS.Timer;
        
    constructor(options: Options) {
        this.options = options;
        this.onEventBinded = this.onEvent.bind(this);
        this.onTimeoutBinded = this.onTimeout.bind(this);
        this.options.$cover.on("click", this.onCoverClick.bind(this));
    }
    
    start(): void {
        Logger.debug("start");
        this.onEvent();
        this.onTimeout();
    }

    stop(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    
    onEvent(): void {
        this.lastEventDate = new Date();
    }
    
    onTimeout(): void {
        let diff = new Date().getTime() - this.lastEventDate.getTime();
        if (diff > this.options.timeout) {
            this.options.$cover.show().focus();
            this.options.$toCover.addClass("covered");
        }
        else {
            clearTimeout(this.timeoutId);
            let timeout = this.options.timeout - diff;
            if (timeout > this.options.timeoutCheck) {
                timeout = this.options.timeoutCheck;
            }
            this.timeoutId = setTimeout(this.onTimeoutBinded, timeout);
        }
    }
    
    onCoverClick(): void {
        this.options.$cover.hide();
        this.options.$toCover.removeClass("covered");
        this.onEvent();
        this.onTimeout();
    }
}

