export interface TimerOptions {
    fixedWidth: boolean;
    showMinutes: boolean;
    showSeconds: boolean;
    showMilliseconds: boolean;
    initialValue: number | null;
    tickInterval: number;
}

export class Timer {
    
    private _value: number | null = null;
    private _options: TimerOptions = {
        fixedWidth: true,
        showMinutes: true,
        showSeconds: true,
        showMilliseconds: false,
        initialValue: null,
        tickInterval: 100,
    };
    private _intervalStartDate: Date | null = null;
    private _interval: number | null = null;
    
    constructor(public $element: JQuery, options?: Partial<TimerOptions>) {
        this._options = { ...this._options, ...options };
        this.setValue(this._options.initialValue);
    }
    
    setValue(value: number | null): void {
        if (this._value === value) {
            return;
        }
        
        this._value = value;
        
        let valueStr = "";
        
        if (typeof(value) == "number") {
            let tmpValue = value;
            
            const minutes = Math.floor(tmpValue / (60 * 1000));
            tmpValue -= minutes * (60 * 1000);
            if (this._options.showMinutes) {
                const minutesStr = this._formatNumber(minutes, 2);
                valueStr = valueStr ? `${valueStr}:${minutesStr}` : `${minutesStr}`;
            }
            
            const seconds = Math.floor(tmpValue / (1000));
            tmpValue -= seconds * (1000);
            if (this._options.showSeconds) {
                const secondsStr = this._formatNumber(seconds, 2);
                valueStr = valueStr ? `${valueStr}:${secondsStr}` : `${secondsStr}`;
            }
            
            const milliseconds = Math.floor(tmpValue);
            if (this._options.showMilliseconds) {
                const millisecondsStr = this._formatNumber(milliseconds, 3);
                valueStr = valueStr ? `${valueStr}.${millisecondsStr}` : `${millisecondsStr}`;
            }
        }
        
        this.$element.text(valueStr);
    }
    
    start(): void {
        this.stop();
        this.setValue(0);
        this._intervalStartDate = new Date();
        this._interval = setInterval(() => {
            this._onIntervalTick();
        }), this._options.tickInterval;
    }
    
    stop(): void {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }
    
    private _onIntervalTick(): void {
        const elapsed = new Date().getTime() - this._intervalStartDate.getTime();
        this.setValue(elapsed);
    }
    
    private _formatNumber(x: number, desiredLength: number): string {
        let str = x.toFixed(0);
        if (this._options.fixedWidth) {
            str = (<any>str).padStart(desiredLength, 0);
        }
        return str;
    }
    
}
