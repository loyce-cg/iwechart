import * as fs from "fs";
import * as nodePath from "path";
import {filesimporter} from "../../../Types";
export class RunMessage implements filesimporter.Message {
    name: string;
    path: string;
    constructor(path: string) {
        this.path = path;
        this.name = "run";
    }    
}

export class StopMessage implements filesimporter.Message {
    name: string;
    constructor() {
        this.name = "stop";
    }
}

export class FilesBrowserWorker {
    dirsToScan: filesimporter.FileEntry[] = [];
    processingInterval: NodeJS.Timer;
    scanInProgress: boolean = false;
    readonly processingDelay: number = 10;

    constructor() {
        this.bindEvents();
    }

    private manageScanning(startPath: string): void {
        this.addItemToQueue(startPath);
        this.startProcessingQueue();
    }

    private stopScanning(): void {
        this.toggleScanning(false);
        this.stopProcessingQueue();
        process.exit();
    }

    private startProcessingQueue(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        this.processingInterval = setInterval(() => {
            this.processItemFromQueue();
            if (! this.areItemsInQueue()) {
                this.stopProcessingQueue();
            }
        }, 
        this.processingDelay);
    }

    private stopProcessingQueue(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
    }

    private processItemFromQueue(): void {
        if (! this.areItemsInQueue()) {
            this.toggleScanning(false);
            return;
        }
        if (this.isScanningNow()) {
            return;
        }

        this.toggleScanning(true);

        let item = this.getItemFromQueue();
        
        let scanResult = this.scan(item.path);

        process.send({
            path: item.path, files: scanResult
        });    

        if (scanResult.length > 0) {
            let filtered = scanResult.filter(x => x.fileType == "directory");
            this.addItemsListToQueue(filtered);
        }

        this.toggleScanning(false);

        if (! this.areItemsInQueue()) {
            process.exit();
        }
    }

    private addItemToQueue(path: string): void {
        this.dirsToScan.push({fileType: "directory", path: path, size: 0});
    }

    private addItemsListToQueue(items: filesimporter.FileEntry[]): void {
        this.dirsToScan = this.dirsToScan.concat(items);
    }

    private getItemFromQueue(): filesimporter.FileEntry {
        return this.dirsToScan.splice(0, 1)[0];
    }

    private areItemsInQueue(): boolean {
        return this.dirsToScan.length > 0;
    }

    private toggleScanning(enabled: boolean): void {
        this.scanInProgress = enabled;
    }

    private isScanningNow(): boolean {
        return this.scanInProgress;
    }

    private scan(path: string): filesimporter.FileEntry[] {
        let result: filesimporter.FileEntry[] = [];
        const files = fs.readdirSync(path).filter(x => x != "." && x != "..");
        for (let f of files) {
            const fName = nodePath.join(path, f);
            try {
                fs.accessSync(fName, fs.constants.R_OK);
                const stats = fs.lstatSync(fName);
                result.push({
                    path: fName,
                    fileType: stats.isFile() ? "file" : (stats.isDirectory() ? "directory" : "unknown"),
                    size: stats.size
                });
            }
            catch(e) {
                process.send({err: e});
            }
        }
        return result;
    }

    private bindEvents(): void {
        process.on('message', (msg) => {
            let message = this.parseMessage(msg);
            if (message instanceof RunMessage) {
                this.manageScanning(message.path);
            }
            else if (message instanceof StopMessage) {
                this.stopScanning();
            }        
        });
    }

    private parseMessage(rawData: any): filesimporter.Message {
        try {
            // const msg = JSON.parse(rawData);
            const msg = rawData;
            if (msg && msg.name) {
                if (msg.name === "run") {
                    return new RunMessage(msg.path);
                }
            }
            else
            if (msg && msg.name === "stop") {
                return new StopMessage();
            }
        }
        catch(e) {}

    } 
}
new FilesBrowserWorker();