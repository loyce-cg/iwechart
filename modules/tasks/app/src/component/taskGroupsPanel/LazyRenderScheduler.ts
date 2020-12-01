export interface LazyRenderSchedulerOptions {
    rescheduleDelay: number;
    maxWaitingTime: number;
    renderCallback: () => void;
}

export class LazyRenderScheduler {
    
    protected _timeoutId: number = null;
    protected _firstScheduleTime: number = null;
    
    constructor(public options: LazyRenderSchedulerOptions) {
        
    }
    
    schedule(): void {
        let now = performance.now();
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
            if (this._firstScheduleTime + this.options.maxWaitingTime <= now) {
                this._render();
                return;
            }
        }
        else {
            this._firstScheduleTime = now;
        }
        this._timeoutId = <any>setTimeout(() => {
            this._render();
        }, this.options.rescheduleDelay);
    }
    
    protected _render(): void {
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        this.options.renderCallback();
    }
    
}
