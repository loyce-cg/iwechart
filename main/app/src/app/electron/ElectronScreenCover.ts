export interface Options {
    timeout: number;
    timeoutCheck: number;
    showCover(): () => void;
    hideCover(): () => void;
}

export class ElectronScreenCover {
    
    onEventBinded: () => void;
    onTimeoutBinded: () => void;
    lastEventDate: Date;
    timeoutId: NodeJS.Timer;
        
    constructor(public options: Options) {
        this.onEventBinded = this.onEvent.bind(this);
        this.onTimeoutBinded = this.onTimeout.bind(this);
    }
    
    start(): void {
        this.restart();
    }
    
    stop(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    
    restart(): void {
        this.onEvent();
        this.onTimeout();
    }
    
    onEvent(): void {
        this.lastEventDate = new Date();
    }
    
    onTimeout(): void {
        let diff = new Date().getTime() - this.lastEventDate.getTime();
        if (diff > this.options.timeout) {
            this.options.showCover();
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
        this.options.hideCover();
        this.restart();
    }
    
}
