import fs = require("fs");
import os = require("os");
import path = require("path");

export enum ProcessType {
    MAIN,
    RENDERER,
    WEB,
}

export interface PerformanceLogEntry {
    time: number;
    key: string;
    extra: string;
}

export interface PerformanceLoggerConfig {
    enabled?: boolean;
    scheduledOpDelay?: number;
    captureKeyPatterns?: string[];
    outputFileName?: string;
}

export class PerformanceLogger {
    
    private static _instance: PerformanceLogger = null;
    
    static getInstance(): PerformanceLogger {
        if (!this._instance) {
            this._instance = new PerformanceLogger();
        }
        return this._instance;
    }
    
    static log(key: string, extra?: string, time?: number): void {
        this.getInstance().log(key, extra, time);
    }
    
    static configure(config: PerformanceLoggerConfig): void {
        let inst = this.getInstance();
        if ("enabled" in config && config.enabled !== null) {
            inst.capture = !!config.enabled;
        }
        if (config.scheduledOpDelay) {
            inst.scheduledOpDelay = config.scheduledOpDelay;
        }
        if (config.captureKeyPatterns) {
            inst.captureKeyPatterns = config.captureKeyPatterns;
        }
        if (config.outputFileName) {
            inst.fileName = config.outputFileName;
        }
    }
    
    
    
    
    
    private _processType: ProcessType;
    protected captureKeyPatternsCache: string[][] = null;
    protected ipcTransferTimeout: number = null;
    protected fileDumpTimeout: number = null;
    protected currentLogs: PerformanceLogEntry[] = [];
    public get processType(): ProcessType { return this._processType; }
    public readonly channelName = "privfs-mail-client.app.common.PerformanceLogger-ipc";
    public fileName = "performance.log";
    public scheduledOpDelay: number = 1000;
    public captureKeyPatterns: string[] = ["openingWindows.*"];
    public capture: boolean = false;
    
    protected constructor() {
        if (typeof(process) == "object" && process.versions) {
            if (process.type == "browser") {
                this._processType = ProcessType.MAIN;
            }
            else if (typeof(window) == "object" && ((<any>window).isElectron)) {
                this._processType = ProcessType.RENDERER;
            }
            else {
                this._processType = ProcessType.WEB;
            }
        }
        else {
            this._processType = ProcessType.WEB;
        }
        
        if (this.processType == ProcessType.MAIN) {
            let fn = require;
            fn("electron").ipcMain.on(this.channelName, this.onIpcTransfer.bind(this));
        }
    }
    
    now(): number {
        return new Date().getTime() * 0.001;
    }
    
    log(key: string, extra?: string, time?: number): void {
        if (this.processType == ProcessType.WEB) {
            return;
        }
        if (!this.canCapture(key)) {
            return;
        }
        if (!time) {
            time = this.now();
        }
        this.currentLogs.push({ time, key, extra });
        if (this.processType == ProcessType.MAIN) {
            this.scheduleFileDump();
        }
        else if (this.processType == ProcessType.RENDERER) {
            this.scheduleIpcTransfer();
        }
    }
    
    canCapture(key: string): boolean {
        if (!this.capture) {
            return false;
        }
        if (!this.captureKeyPatternsCache) {
            this.buildCaptureKeyPatternsCache();
        }
        let parts = key.split(".");
        for (let pattern of this.captureKeyPatternsCache) {
            let matches: boolean = true;
            for (let i = 0; i < parts.length; ++i) {
                if (pattern[i] == "*") {
                    return true;
                }
                if (pattern[i] != parts[i]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                return true;
            }
        }
        return false;
    }
    
    buildCaptureKeyPatternsCache(): void {
        this.captureKeyPatternsCache = [];
        for (let str of this.captureKeyPatterns) {
            let parts = str.split(".");
            this.captureKeyPatternsCache.push(parts);
        }
    }
    
    
    
    
    
    /***************************************
    ************** Main thread *************
    ****************************************/
    protected scheduleFileDump(): void {
        if (this.fileDumpTimeout) {
            clearInterval(this.fileDumpTimeout);
        }
        this.fileDumpTimeout = <any>setTimeout(this.executeFileDump.bind(this), this.scheduledOpDelay);
    }
    
    protected executeFileDump(): void {
        this.fileDumpTimeout = null;
        let str = this.currentLogs.map(x => JSON.stringify(x)).join("\n");
        fs.appendFileSync(this.getLogPath(), str + "\n");
        this.currentLogs = [];
    }
    
    protected onIpcTransfer(_: any, logsStr: string): void {
        let logs: PerformanceLogEntry[] = JSON.parse(logsStr);
        for (let log of logs) {
            this.currentLogs.push(log);
        }
        this.scheduleFileDump();
    }
    
    protected getLogPath(): string {
        return path.join(path.resolve(os.homedir(), ".privmx"), this.fileName);
    }
    
    
    
    
    
    /***************************************
    ************ Renderer thread ***********
    ****************************************/
    protected scheduleIpcTransfer(): void {
        if (this.ipcTransferTimeout) {
            clearInterval(this.ipcTransferTimeout);
        }
        this.ipcTransferTimeout = <any>setTimeout(this.executeIpcTransfer.bind(this), this.scheduledOpDelay);
    }
    
    protected executeIpcTransfer(): void {
        this.ipcTransferTimeout = null;
        (<any>window).electronRequire("electron").ipcRenderer.send(this.channelName, JSON.stringify(this.currentLogs));
        this.currentLogs = [];
    }
    
}