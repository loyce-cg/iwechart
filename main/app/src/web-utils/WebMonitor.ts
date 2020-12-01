import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.webutils.WebMonitor");
Logger.setLevel(Logger.WARN);

export class WebMonitorEvent {
    
    name: string;
    data: any;
    
    constructor(name: string, data: any) {
        this.name = name;
        this.data = data;
    }
}

export type Callback = (event: WebMonitorEvent) => void;

export class WebMonitor {
    
    static MAX_SCRIPT_EXECUTION_PAUSE_TIME = 1000 * 10;
    
    currentNetworkStatus: string;
    listeners: {[name: string]: Callback[]};
    intervalId: number;
    lastLoopTime: number;
    
    constructor() {
        this.currentNetworkStatus = navigator.onLine ? "online" : "offline";
        this.listeners = {};
    }
    
    addEventListener(name: string, fn: Callback): void {
        if (!this.listeners[name]) {
            this.listeners[name] = [];
        }
        this.listeners[name].push(fn);
    }
    
    trigger(name: string, data?: any): void {
        Logger.debug("trigger", name, data);
        let event = new WebMonitorEvent(name, data);
        if (this.listeners[name]) {
            this.listeners[name].forEach(fn => {
                fn(event);
            });
        }
        if (this.listeners["*"]) {
            this.listeners["*"].forEach(fn => {
                fn(event);
            });
        }
    }
    
    start(): void {
        window.addEventListener('online', this.updateNetworkStatus.bind(this, 'online'));
        window.addEventListener('offline', this.updateNetworkStatus.bind(this, 'offline'));
        this.intervalId = setInterval(this.loop.bind(this), 2500);
        this.loop();
    }
    
    loop(): void {
        this.trigger("loop");
        let currentTime = new Date().getTime();
        if (this.lastLoopTime) {
            if (currentTime - this.lastLoopTime > WebMonitor.MAX_SCRIPT_EXECUTION_PAUSE_TIME) {
                this.trigger("wakeup");
            }
        }
        this.lastLoopTime = currentTime;
    }
    
    updateNetworkStatus(status: string): void {
        if (this.currentNetworkStatus !== status) {
            this.currentNetworkStatus = status;
            this.trigger("network-status-change", status);
        }
    }
    
    getNetworkStatus(): string {
        return this.currentNetworkStatus;
    }
}


