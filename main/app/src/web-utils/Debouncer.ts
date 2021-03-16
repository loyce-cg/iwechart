export class Debouncer {
    
    private lastActionCallTimestamp: number = 0;
    private timeoutHandler: number | null = null;
    
    constructor(private action: () => void, private intervalMs: number) {
    }
    
    trigger(): void {
        if (this.timeoutHandler) {
            return;
        }
        const nowTimestamp = new Date().getTime();
        if (nowTimestamp - this.lastActionCallTimestamp >= this.intervalMs) {
            this.callAction();
        }
        else {
            this.timeoutHandler = window.setTimeout(() => {
                this.timeoutHandler = null;
                this.callAction();
            }, this.intervalMs);
        }
    }
    
    private callAction(): void {
        this.action();
        this.lastActionCallTimestamp = new Date().getTime();
    }
    
}
